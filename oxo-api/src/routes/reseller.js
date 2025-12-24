const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { v4: uuidv4 } = require('uuid');
const { db } = require('../database');
const { verifyToken, isReseller } = require('../middleware/auth');

const router = express.Router();

// Configure multer for M3U file uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadDir = path.join(__dirname, '../../uploads');
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    const uniqueName = `${uuidv4()}${path.extname(file.originalname)}`;
    cb(null, uniqueName);
  }
});

const upload = multer({
  storage,
  fileFilter: (req, file, cb) => {
    const allowedTypes = ['.m3u', '.m3u8', '.txt'];
    const ext = path.extname(file.originalname).toLowerCase();
    if (allowedTypes.includes(ext)) {
      cb(null, true);
    } else {
      cb(new Error('Seuls les fichiers M3U sont autorisés'));
    }
  },
  limits: {
    fileSize: 10 * 1024 * 1024 // 10MB max
  }
});

// All routes require reseller authentication
router.use(verifyToken, isReseller);

// Dashboard stats for reseller
router.get('/dashboard', (req, res) => {
  const resellerId = req.user.id;
  
  // Get reseller info with credits
  const reseller = db.prepare('SELECT credits FROM resellers WHERE id = ?').get(resellerId);
  
  const totalDevices = db.prepare('SELECT COUNT(*) as count FROM devices WHERE reseller_id = ?').get(resellerId).count;
  const activeDevices = db.prepare("SELECT COUNT(*) as count FROM devices WHERE reseller_id = ? AND status = 'active'").get(resellerId).count;
  const expiredDevices = db.prepare("SELECT COUNT(*) as count FROM devices WHERE reseller_id = ? AND status = 'expired'").get(resellerId).count;

  // Recent devices
  const recentDevices = db.prepare(`
    SELECT mac_address, status, activation_date, expiration_date
    FROM devices
    WHERE reseller_id = ?
    ORDER BY created_at DESC
    LIMIT 10
  `).all(resellerId);

  res.json({
    credits: reseller?.credits || 0,
    stats: {
      totalDevices,
      activeDevices,
      expiredDevices
    },
    recentDevices
  });
});

// List reseller's devices
router.get('/devices', (req, res) => {
  const resellerId = req.user.id;
  
  const devices = db.prepare(`
    SELECT *
    FROM devices
    WHERE reseller_id = ?
    ORDER BY created_at DESC
  `).all(resellerId);

  res.json(devices);
});

// Activate a MAC address
router.post('/activate', (req, res) => {
  const { mac_address } = req.body;
  const resellerId = req.user.id;
  const creditsRequired = parseInt(process.env.CREDITS_PER_ACTIVATION) || 10;
  const activationMonths = parseInt(process.env.ACTIVATION_MONTHS) || 12;

  if (!mac_address) {
    return res.status(400).json({ error: 'Adresse MAC requise' });
  }

  // Normalize MAC address
  const normalizedMac = mac_address.toUpperCase().replace(/[^A-F0-9]/g, '');
  if (normalizedMac.length !== 12) {
    return res.status(400).json({ error: 'Format d\'adresse MAC invalide' });
  }

  // Format as XX:XX:XX:XX:XX:XX
  const formattedMac = normalizedMac.match(/.{2}/g).join(':');

  // Check reseller credits
  const reseller = db.prepare('SELECT credits FROM resellers WHERE id = ?').get(resellerId);
  if (!reseller || reseller.credits < creditsRequired) {
    return res.status(400).json({ 
      error: `Crédits insuffisants. Requis: ${creditsRequired}, Disponible: ${reseller?.credits || 0}` 
    });
  }

  // Check if device exists
  let device = db.prepare('SELECT * FROM devices WHERE mac_address = ?').get(formattedMac);

  const now = new Date();
  const expirationDate = new Date();
  expirationDate.setMonth(expirationDate.getMonth() + activationMonths);

  if (device) {
    // Device exists - check if it belongs to this reseller or is unassigned
    if (device.reseller_id && device.reseller_id !== resellerId) {
      return res.status(400).json({ error: 'Cette adresse MAC appartient à un autre revendeur' });
    }

    // Update existing device
    db.prepare(`
      UPDATE devices 
      SET reseller_id = ?, status = 'active', activation_date = ?, expiration_date = ?
      WHERE mac_address = ?
    `).run(resellerId, now.toISOString(), expirationDate.toISOString(), formattedMac);
  } else {
    // Create new device
    db.prepare(`
      INSERT INTO devices (mac_address, reseller_id, status, activation_date, expiration_date)
      VALUES (?, ?, 'active', ?, ?)
    `).run(formattedMac, resellerId, now.toISOString(), expirationDate.toISOString());
  }

  // Deduct credits
  db.prepare('UPDATE resellers SET credits = credits - ? WHERE id = ?').run(creditsRequired, resellerId);

  // Log transaction
  db.prepare(`
    INSERT INTO transactions (reseller_id, type, amount, description, mac_address)
    VALUES (?, 'activation', ?, 'Activation MAC', ?)
  `).run(resellerId, creditsRequired, formattedMac);

  const updatedReseller = db.prepare('SELECT credits FROM resellers WHERE id = ?').get(resellerId);

  res.json({
    message: 'Activation réussie',
    mac_address: formattedMac,
    expiration_date: expirationDate.toISOString(),
    credits_used: creditsRequired,
    credits_remaining: updatedReseller.credits
  });
});

// Upload M3U playlist for a device
router.post('/devices/:mac/playlist', upload.single('playlist'), (req, res) => {
  const { mac } = req.params;
  const { playlist_url } = req.body;
  const resellerId = req.user.id;

  // Normalize MAC
  const formattedMac = mac.toUpperCase().replace(/[^A-F0-9]/g, '').match(/.{2}/g)?.join(':');
  
  if (!formattedMac) {
    return res.status(400).json({ error: 'Format MAC invalide' });
  }

  // Check device belongs to reseller
  const device = db.prepare('SELECT * FROM devices WHERE mac_address = ? AND reseller_id = ?').get(formattedMac, resellerId);
  
  if (!device) {
    return res.status(404).json({ error: 'Appareil non trouvé ou non autorisé' });
  }

  let playlistPath = null;
  let playlistContent = null;

  if (req.file) {
    // File uploaded
    playlistPath = `/uploads/${req.file.filename}`;
    // Read content for API response
    playlistContent = fs.readFileSync(req.file.path, 'utf8');
  } else if (playlist_url) {
    // URL provided
    playlistPath = playlist_url;
  } else {
    return res.status(400).json({ error: 'Fichier M3U ou URL requis' });
  }

  db.prepare('UPDATE devices SET playlist_url = ?, playlist_content = ? WHERE mac_address = ?')
    .run(playlistPath, playlistContent, formattedMac);

  res.json({
    message: 'Playlist mise à jour',
    mac_address: formattedMac,
    playlist_url: playlistPath
  });
});

// Set playlist URL for a device
router.put('/devices/:mac/playlist-url', (req, res) => {
  const { mac } = req.params;
  const { url } = req.body;
  const resellerId = req.user.id;

  if (!url) {
    return res.status(400).json({ error: 'URL requise' });
  }

  // Normalize MAC
  const formattedMac = mac.toUpperCase().replace(/[^A-F0-9]/g, '').match(/.{2}/g)?.join(':');
  
  if (!formattedMac) {
    return res.status(400).json({ error: 'Format MAC invalide' });
  }

  // Check device belongs to reseller
  const device = db.prepare('SELECT * FROM devices WHERE mac_address = ? AND reseller_id = ?').get(formattedMac, resellerId);
  
  if (!device) {
    return res.status(404).json({ error: 'Appareil non trouvé ou non autorisé' });
  }

  // Clear Xtream credentials when setting M3U URL
  db.prepare(`
    UPDATE devices 
    SET playlist_url = ?, 
        playlist_type = 'm3u',
        xtream_host = NULL, 
        xtream_username = NULL, 
        xtream_password = NULL 
    WHERE mac_address = ?
  `).run(url, formattedMac);

  res.json({
    message: 'URL playlist mise à jour',
    mac_address: formattedMac,
    playlist_url: url
  });
});

// Set Xtream Code credentials for a device
router.put('/devices/:mac/xtream', (req, res) => {
  const { mac } = req.params;
  const { host, username, password } = req.body;
  const resellerId = req.user.id;

  // Validate required fields
  if (!host || !username || !password) {
    return res.status(400).json({ error: 'Host, username et password sont requis' });
  }

  // Normalize MAC
  const formattedMac = mac.toUpperCase().replace(/[^A-F0-9]/g, '').match(/.{2}/g)?.join(':');
  
  if (!formattedMac) {
    return res.status(400).json({ error: 'Format MAC invalide' });
  }

  // Check device belongs to reseller
  const device = db.prepare('SELECT * FROM devices WHERE mac_address = ? AND reseller_id = ?').get(formattedMac, resellerId);
  
  if (!device) {
    return res.status(404).json({ error: 'Appareil non trouvé ou non autorisé' });
  }

  // Clean host URL (remove trailing slash, http/https)
  let cleanHost = host.trim();
  cleanHost = cleanHost.replace(/^https?:\/\//, '');
  cleanHost = cleanHost.replace(/\/$/, '');

  // Update device with Xtream credentials
  db.prepare(`
    UPDATE devices 
    SET playlist_type = 'xtream',
        xtream_host = ?,
        xtream_username = ?,
        xtream_password = ?,
        playlist_url = NULL,
        playlist_content = NULL
    WHERE mac_address = ?
  `).run(cleanHost, username, password, formattedMac);

  res.json({
    message: 'Identifiants Xtream Code configurés',
    mac_address: formattedMac,
    xtream_host: cleanHost,
    xtream_username: username
  });
});

// Get reseller's transaction history
router.get('/transactions', (req, res) => {
  const resellerId = req.user.id;
  
  const transactions = db.prepare(`
    SELECT *
    FROM transactions
    WHERE reseller_id = ?
    ORDER BY created_at DESC
    LIMIT 50
  `).all(resellerId);

  res.json(transactions);
});

module.exports = router;


















