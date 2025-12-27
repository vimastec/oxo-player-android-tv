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

// Check MAC address status before activation
router.post('/check-mac', (req, res) => {
  const { mac_address } = req.body;
  const resellerId = req.user.id;

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

  // Check if device exists
  const device = db.prepare('SELECT * FROM devices WHERE mac_address = ?').get(formattedMac);

  if (!device) {
    // New device - can be activated
    return res.json({
      status: 'new',
      mac_address: formattedMac,
      message: 'Nouvelle adresse MAC - prête pour activation'
    });
  }

  const now = new Date();
  const expirationDate = new Date(device.expiration_date);
  const isActive = device.status === 'active' && expirationDate > now;

  // Calculate days remaining
  const daysRemaining = Math.ceil((expirationDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));

  res.json({
    status: isActive ? 'active' : 'expired',
    mac_address: formattedMac,
    expiration_date: device.expiration_date,
    days_remaining: isActive ? daysRemaining : 0,
    reseller_id: device.reseller_id,
    is_own_device: device.reseller_id === resellerId,
    message: isActive 
      ? `Cette MAC est déjà active jusqu'au ${new Date(device.expiration_date).toLocaleDateString('fr-FR')}. Voulez-vous prolonger de 365 jours ?`
      : 'Abonnement expiré - peut être réactivé'
  });
});

// Activate a MAC address
router.post('/activate', (req, res) => {
  const { mac_address, force_extend } = req.body;
  const resellerId = req.user.id;
  const creditsRequired = parseInt(process.env.CREDITS_PER_ACTIVATION) || 10;
  const activationDays = 365; // Always add 365 days

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
  let expirationDate;
  let isExtension = false;
  let transactionDescription = 'Activation MAC';

  if (device) {
    const currentExpiration = new Date(device.expiration_date);
    const isCurrentlyActive = device.status === 'active' && currentExpiration > now;

    // If device is currently active and belongs to a different reseller
    if (isCurrentlyActive && device.reseller_id && device.reseller_id !== resellerId) {
      return res.status(400).json({ 
        error: 'Cette adresse MAC est active et appartient à un autre revendeur',
        status: 'belongs_to_other'
      });
    }

    // If device is active and no force_extend flag, return info for confirmation
    if (isCurrentlyActive && !force_extend) {
      return res.status(409).json({
        error: 'confirmation_required',
        status: 'active',
        mac_address: formattedMac,
        expiration_date: device.expiration_date,
        message: `Cette MAC est déjà active jusqu'au ${currentExpiration.toLocaleDateString('fr-FR')}. Confirmez pour prolonger de 365 jours.`
      });
    }

    // Calculate new expiration date
    if (isCurrentlyActive) {
      // Extend from current expiration date
      expirationDate = new Date(currentExpiration);
      expirationDate.setDate(expirationDate.getDate() + activationDays);
      isExtension = true;
      transactionDescription = 'Prolongation MAC (+365 jours)';
    } else {
      // Expired or inactive - start from now
      expirationDate = new Date(now);
      expirationDate.setDate(expirationDate.getDate() + activationDays);
      transactionDescription = 'Réactivation MAC';
    }

    // Update existing device
    db.prepare(`
      UPDATE devices 
      SET reseller_id = ?, status = 'active', activation_date = ?, expiration_date = ?
      WHERE mac_address = ?
    `).run(resellerId, now.toISOString(), expirationDate.toISOString(), formattedMac);
  } else {
    // Create new device - start from now
    expirationDate = new Date(now);
    expirationDate.setDate(expirationDate.getDate() + activationDays);

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
    VALUES (?, 'activation', ?, ?, ?)
  `).run(resellerId, creditsRequired, transactionDescription, formattedMac);

  const updatedReseller = db.prepare('SELECT credits FROM resellers WHERE id = ?').get(resellerId);

  res.json({
    message: isExtension ? 'Prolongation réussie (+365 jours)' : 'Activation réussie',
    mac_address: formattedMac,
    expiration_date: expirationDate.toISOString(),
    credits_used: creditsRequired,
    credits_remaining: updatedReseller.credits,
    is_extension: isExtension
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

// ============= NEW: Multi-Playlist Management =============

// Get all playlists for a device
router.get('/devices/:mac/playlists', (req, res) => {
  const { mac } = req.params;
  const resellerId = req.user.id;

  // Normalize MAC
  const formattedMac = mac.toUpperCase().replace(/[^A-F0-9]/g, '').match(/.{2}/g)?.join(':');
  
  if (!formattedMac) {
    return res.status(400).json({ error: 'Format MAC invalide' });
  }

  // Check device belongs to reseller
  const device = db.prepare('SELECT * FROM devices WHERE mac_address = ? AND reseller_id = ?')
    .get(formattedMac, resellerId);
  
  if (!device) {
    return res.status(404).json({ error: 'Appareil non trouvé ou non autorisé' });
  }

  // Get all playlists for this device
  const playlists = db.prepare(`
    SELECT id, name, playlist_type, playlist_url, xtream_host, xtream_username, 
           epg_url, is_active, created_at
    FROM playlists 
    WHERE device_id = ? 
    ORDER BY created_at DESC
  `).all(device.id);

  res.json({
    mac_address: formattedMac,
    playlists: playlists.map(p => ({
      id: p.id,
      name: p.name,
      playlist_type: p.playlist_type,
      playlist_url: p.playlist_url,
      xtream_host: p.xtream_host,
      xtream_username: p.xtream_username,
      epg_url: p.epg_url,
      is_active: p.is_active === 1,
      created_at: p.created_at
    }))
  });
});

// Add M3U playlist to a device
router.post('/devices/:mac/playlists/m3u', (req, res) => {
  const { mac } = req.params;
  const { name, playlist_url, epg_url } = req.body;
  const resellerId = req.user.id;

  // Normalize MAC
  const formattedMac = mac.toUpperCase().replace(/[^A-F0-9]/g, '').match(/.{2}/g)?.join(':');
  
  if (!formattedMac) {
    return res.status(400).json({ error: 'Format MAC invalide' });
  }

  if (!name || !playlist_url) {
    return res.status(400).json({ error: 'Nom et URL requis' });
  }

  // Check device belongs to reseller
  const device = db.prepare('SELECT * FROM devices WHERE mac_address = ? AND reseller_id = ?')
    .get(formattedMac, resellerId);
  
  if (!device) {
    return res.status(404).json({ error: 'Appareil non trouvé ou non autorisé' });
  }

  // Check playlist limit (max 5 playlists per device)
  const playlistCount = db.prepare('SELECT COUNT(*) as count FROM playlists WHERE device_id = ?')
    .get(device.id).count;
  
  if (playlistCount >= 5) {
    return res.status(400).json({ error: 'Limite de 5 playlists atteinte' });
  }

  // Deactivate all existing playlists for this device
  db.prepare('UPDATE playlists SET is_active = 0 WHERE device_id = ?').run(device.id);

  // Insert new playlist as active
  const result = db.prepare(`
    INSERT INTO playlists (device_id, name, playlist_type, playlist_url, epg_url, is_active)
    VALUES (?, ?, 'm3u', ?, ?, 1)
  `).run(device.id, name, playlist_url, epg_url || null);

  res.json({
    success: true,
    message: 'Playlist M3U ajoutée',
    playlist_id: result.lastInsertRowid
  });
});

// Add Xtream Code playlist to a device
router.post('/devices/:mac/playlists/xtream', (req, res) => {
  const { mac } = req.params;
  const { name, host, username, password, epg_url } = req.body;
  const resellerId = req.user.id;

  // Normalize MAC
  const formattedMac = mac.toUpperCase().replace(/[^A-F0-9]/g, '').match(/.{2}/g)?.join(':');
  
  if (!formattedMac) {
    return res.status(400).json({ error: 'Format MAC invalide' });
  }

  if (!name || !host || !username || !password) {
    return res.status(400).json({ error: 'Nom, host, username et password requis' });
  }

  // Check device belongs to reseller
  const device = db.prepare('SELECT * FROM devices WHERE mac_address = ? AND reseller_id = ?')
    .get(formattedMac, resellerId);
  
  if (!device) {
    return res.status(404).json({ error: 'Appareil non trouvé ou non autorisé' });
  }

  // Check playlist limit (max 5 playlists per device)
  const playlistCount = db.prepare('SELECT COUNT(*) as count FROM playlists WHERE device_id = ?')
    .get(device.id).count;
  
  if (playlistCount >= 5) {
    return res.status(400).json({ error: 'Limite de 5 playlists atteinte' });
  }

  // Clean host URL
  let cleanHost = host.trim();
  cleanHost = cleanHost.replace(/^https?:\/\//, '');
  cleanHost = cleanHost.replace(/\/$/, '');

  // Deactivate all existing playlists for this device
  db.prepare('UPDATE playlists SET is_active = 0 WHERE device_id = ?').run(device.id);

  // Insert new playlist as active
  const result = db.prepare(`
    INSERT INTO playlists (device_id, name, playlist_type, xtream_host, xtream_username, xtream_password, epg_url, is_active)
    VALUES (?, ?, 'xtream', ?, ?, ?, ?, 1)
  `).run(device.id, name, cleanHost, username, password, epg_url || null);

  res.json({
    success: true,
    message: 'Playlist Xtream ajoutée',
    playlist_id: result.lastInsertRowid
  });
});

// Upload M3U file for a device
router.post('/devices/:mac/playlists/upload', upload.single('file'), (req, res) => {
  const { mac } = req.params;
  const { name, epg_url } = req.body;
  const resellerId = req.user.id;

  if (!req.file) {
    return res.status(400).json({ error: 'Aucun fichier fourni' });
  }

  // Normalize MAC
  const formattedMac = mac.toUpperCase().replace(/[^A-F0-9]/g, '').match(/.{2}/g)?.join(':');
  
  if (!formattedMac) {
    return res.status(400).json({ error: 'Format MAC invalide' });
  }

  // Check device belongs to reseller
  const device = db.prepare('SELECT * FROM devices WHERE mac_address = ? AND reseller_id = ?')
    .get(formattedMac, resellerId);
  
  if (!device) {
    return res.status(404).json({ error: 'Appareil non trouvé ou non autorisé' });
  }

  // Check playlist limit
  const playlistCount = db.prepare('SELECT COUNT(*) as count FROM playlists WHERE device_id = ?')
    .get(device.id).count;
  
  if (playlistCount >= 5) {
    return res.status(400).json({ error: 'Limite de 5 playlists atteinte' });
  }

  const playlistUrl = `/uploads/${req.file.filename}`;

  // Deactivate all existing playlists for this device
  db.prepare('UPDATE playlists SET is_active = 0 WHERE device_id = ?').run(device.id);

  // Insert new playlist as active
  const result = db.prepare(`
    INSERT INTO playlists (device_id, name, playlist_type, playlist_url, epg_url, is_active)
    VALUES (?, ?, 'm3u', ?, ?, 1)
  `).run(device.id, name || `Playlist ${Date.now()}`, playlistUrl, epg_url || null);

  res.json({
    success: true,
    message: 'Fichier M3U uploadé et playlist ajoutée',
    playlist_id: result.lastInsertRowid,
    filename: req.file.filename
  });
});

// Set a playlist as active (switch between playlists)
router.put('/devices/:mac/playlists/:playlistId/activate', (req, res) => {
  const { mac, playlistId } = req.params;
  const resellerId = req.user.id;

  // Normalize MAC
  const formattedMac = mac.toUpperCase().replace(/[^A-F0-9]/g, '').match(/.{2}/g)?.join(':');
  
  if (!formattedMac) {
    return res.status(400).json({ error: 'Format MAC invalide' });
  }

  // Check device belongs to reseller
  const device = db.prepare('SELECT * FROM devices WHERE mac_address = ? AND reseller_id = ?')
    .get(formattedMac, resellerId);
  
  if (!device) {
    return res.status(404).json({ error: 'Appareil non trouvé ou non autorisé' });
  }

  // Verify playlist belongs to this device
  const playlist = db.prepare('SELECT * FROM playlists WHERE id = ? AND device_id = ?')
    .get(playlistId, device.id);

  if (!playlist) {
    return res.status(404).json({ error: 'Playlist non trouvée' });
  }

  // Deactivate all playlists for this device
  db.prepare('UPDATE playlists SET is_active = 0 WHERE device_id = ?').run(device.id);

  // Activate the selected playlist
  db.prepare('UPDATE playlists SET is_active = 1 WHERE id = ?').run(playlistId);

  res.json({
    success: true,
    message: 'Playlist activée'
  });
});

// Delete a playlist
router.delete('/devices/:mac/playlists/:playlistId', (req, res) => {
  const { mac, playlistId } = req.params;
  const resellerId = req.user.id;

  // Normalize MAC
  const formattedMac = mac.toUpperCase().replace(/[^A-F0-9]/g, '').match(/.{2}/g)?.join(':');
  
  if (!formattedMac) {
    return res.status(400).json({ error: 'Format MAC invalide' });
  }

  // Check device belongs to reseller
  const device = db.prepare('SELECT * FROM devices WHERE mac_address = ? AND reseller_id = ?')
    .get(formattedMac, resellerId);
  
  if (!device) {
    return res.status(404).json({ error: 'Appareil non trouvé ou non autorisé' });
  }

  // Verify playlist belongs to this device
  const playlist = db.prepare('SELECT * FROM playlists WHERE id = ? AND device_id = ?')
    .get(playlistId, device.id);

  if (!playlist) {
    return res.status(404).json({ error: 'Playlist non trouvée' });
  }

  // Delete the playlist
  db.prepare('DELETE FROM playlists WHERE id = ?').run(playlistId);

  // If this was the active playlist, activate the most recent one
  if (playlist.is_active === 1) {
    const latestPlaylist = db.prepare(`
      SELECT id FROM playlists 
      WHERE device_id = ? 
      ORDER BY created_at DESC 
      LIMIT 1
    `).get(device.id);

    if (latestPlaylist) {
      db.prepare('UPDATE playlists SET is_active = 1 WHERE id = ?').run(latestPlaylist.id);
    }
  }

  res.json({
    success: true,
    message: 'Playlist supprimée'
  });
});

module.exports = router;



















