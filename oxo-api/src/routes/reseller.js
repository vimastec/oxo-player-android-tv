const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const bcrypt = require('bcryptjs');
const { v4: uuidv4 } = require('uuid');
const { db, usePostgres } = require('../database');
const { verifyToken, isReseller } = require('../middleware/auth');

const router = express.Router();

/**
 * Auto-register Xtream host for Top 10 service
 * Called when a playlist is added via the reseller panel
 */
async function autoRegisterXtreamHost(host, username, password) {
  if (!host) return;
  
  try {
    // Normalize host
    let normalizedHost = host.trim()
      .replace(/^https?:\/\//, '')
      .replace(/\/$/, '')
      .toLowerCase();

    // Check if host already exists
    const existingHost = await db.prepare(
      'SELECT id FROM xtream_hosts WHERE LOWER(host) = ?'
    ).get(normalizedHost);

    if (!existingHost) {
      // Auto-generate a name from the host
      const autoName = normalizedHost.split('.')[0].toUpperCase();

      // Insert new host
      await db.prepare(`
        INSERT INTO xtream_hosts (host, name, test_username, test_password, is_active)
        VALUES (?, ?, ?, ?, ?)
      `).run(normalizedHost, autoName, username || null, password || null, usePostgres ? true : 1);

      console.log(`🆕 Auto-registered Xtream host from Reseller: ${normalizedHost}`);
    }
  } catch (error) {
    // Silently fail - this is not critical
    console.error('Failed to auto-register Xtream host:', error.message);
  }
}

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
router.get('/dashboard', async (req, res) => {
  const resellerId = req.user.id;
  
  // Get reseller info with credits
  const reseller = await db.prepare('SELECT credits FROM resellers WHERE id = ?').get(resellerId);
  
  const totalDevicesRow = await db.prepare('SELECT COUNT(*) as count FROM devices WHERE reseller_id = ?').get(resellerId);
  const activeDevicesRow = await db.prepare("SELECT COUNT(*) as count FROM devices WHERE reseller_id = ? AND status = 'active'").get(resellerId);
  const expiredDevicesRow = await db.prepare("SELECT COUNT(*) as count FROM devices WHERE reseller_id = ? AND status = 'expired'").get(resellerId);

  // Recent devices
  const recentDevices = await db.prepare(`
    SELECT mac_address, status, activation_date, expiration_date
    FROM devices
    WHERE reseller_id = ?
    ORDER BY created_at DESC
    LIMIT 10
  `).all(resellerId);

  res.json({
    credits: reseller?.credits || 0,
    stats: {
      totalDevices: Number(totalDevicesRow?.count || 0),
      activeDevices: Number(activeDevicesRow?.count || 0),
      expiredDevices: Number(expiredDevicesRow?.count || 0)
    },
    recentDevices
  });
});

// List reseller's devices
router.get('/devices', async (req, res) => {
  const resellerId = req.user.id;
  
  const devices = await db.prepare(`
    SELECT *
    FROM devices
    WHERE reseller_id = ?
    ORDER BY created_at DESC
  `).all(resellerId);

  res.json(devices);
});

// Check MAC address status before activation
router.post('/check-mac', async (req, res) => {
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
  const device = await db.prepare('SELECT * FROM devices WHERE mac_address = ?').get(formattedMac);

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
router.post('/activate', async (req, res) => {
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
  const reseller = await db
    .prepare('SELECT credits, allow_cross_reseller_activation FROM resellers WHERE id = ?')
    .get(resellerId);
  if (!reseller || reseller.credits < creditsRequired) {
    return res.status(400).json({ 
      error: `Crédits insuffisants. Requis: ${creditsRequired}, Disponible: ${reseller?.credits || 0}` 
    });
  }
  const allowCrossResellerActivation =
    reseller.allow_cross_reseller_activation === true || reseller.allow_cross_reseller_activation === 1;

  // Check if device exists
  let device = await db.prepare('SELECT * FROM devices WHERE mac_address = ?').get(formattedMac);

  const now = new Date();
  let expirationDate;
  let isExtension = false;
  let transactionDescription = 'Activation MAC';

  if (device) {
    const currentExpiration = new Date(device.expiration_date);
    const isCurrentlyActive = device.status === 'active' && currentExpiration > now;

    // If device is currently active and belongs to a different reseller
    if (isCurrentlyActive && device.reseller_id && device.reseller_id !== resellerId) {
      if (!allowCrossResellerActivation) {
        return res.status(400).json({ 
          error: 'Cette adresse MAC est active et appartient à un autre revendeur',
          status: 'belongs_to_other'
        });
      }

      // Cross-reseller takeover allowed: ask confirmation unless force_extend
      if (!force_extend) {
        return res.status(409).json({
          error: 'confirmation_required',
          status: 'belongs_to_other',
          mac_address: formattedMac,
          expiration_date: device.expiration_date,
          message: `Cette MAC est déjà active jusqu'au ${currentExpiration.toLocaleDateString('fr-FR')} et appartient à un autre revendeur. Confirmez pour prolonger de 365 jours et transférer cette MAC à votre compte.`
        });
      }
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
    await db.prepare(`
      UPDATE devices 
      SET reseller_id = ?, status = 'active', activation_date = ?, expiration_date = ?
      WHERE mac_address = ?
    `).run(resellerId, now.toISOString(), expirationDate.toISOString(), formattedMac);
  } else {
    // Create new device - start from now
    expirationDate = new Date(now);
    expirationDate.setDate(expirationDate.getDate() + activationDays);

    await db.prepare(`
      INSERT INTO devices (mac_address, reseller_id, status, activation_date, expiration_date)
      VALUES (?, ?, 'active', ?, ?)
    `).run(formattedMac, resellerId, now.toISOString(), expirationDate.toISOString());
  }

  // Deduct credits
  await db.prepare('UPDATE resellers SET credits = credits - ? WHERE id = ?').run(creditsRequired, resellerId);

  // Log transaction
  await db.prepare(`
    INSERT INTO transactions (reseller_id, type, amount, description, mac_address)
    VALUES (?, 'activation', ?, ?, ?)
  `).run(resellerId, creditsRequired, transactionDescription, formattedMac);

  const updatedReseller = await db.prepare('SELECT credits FROM resellers WHERE id = ?').get(resellerId);

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
router.post('/devices/:mac/playlist', upload.single('playlist'), async (req, res) => {
  const { mac } = req.params;
  const { playlist_url } = req.body;
  const resellerId = req.user.id;

  // Normalize MAC
  const formattedMac = mac.toUpperCase().replace(/[^A-F0-9]/g, '').match(/.{2}/g)?.join(':');
  
  if (!formattedMac) {
    return res.status(400).json({ error: 'Format MAC invalide' });
  }

  // Check device belongs to reseller
  const device = await db.prepare('SELECT * FROM devices WHERE mac_address = ? AND reseller_id = ?').get(formattedMac, resellerId);
  
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

  await db.prepare('UPDATE devices SET playlist_url = ?, playlist_content = ? WHERE mac_address = ?')
    .run(playlistPath, playlistContent, formattedMac);

  res.json({
    message: 'Playlist mise à jour',
    mac_address: formattedMac,
    playlist_url: playlistPath
  });
});

// Set playlist URL for a device
router.put('/devices/:mac/playlist-url', async (req, res) => {
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
  const device = await db.prepare('SELECT * FROM devices WHERE mac_address = ? AND reseller_id = ?').get(formattedMac, resellerId);
  
  if (!device) {
    return res.status(404).json({ error: 'Appareil non trouvé ou non autorisé' });
  }

  // Clear Xtream credentials when setting M3U URL
  await db.prepare(`
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
router.put('/devices/:mac/xtream', async (req, res) => {
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
  const device = await db.prepare('SELECT * FROM devices WHERE mac_address = ? AND reseller_id = ?').get(formattedMac, resellerId);
  
  if (!device) {
    return res.status(404).json({ error: 'Appareil non trouvé ou non autorisé' });
  }

  // Clean host URL (remove trailing slash, http/https)
  let cleanHost = host.trim();
  cleanHost = cleanHost.replace(/^https?:\/\//, '');
  cleanHost = cleanHost.replace(/\/$/, '');

  // Update device with Xtream credentials
  await db.prepare(`
    UPDATE devices 
    SET playlist_type = 'xtream',
        xtream_host = ?,
        xtream_username = ?,
        xtream_password = ?,
        playlist_url = NULL,
        playlist_content = NULL
    WHERE mac_address = ?
  `).run(cleanHost, username, password, formattedMac);

  // Auto-register host for Top 10 service
  await autoRegisterXtreamHost(cleanHost, username, password);

  res.json({
    message: 'Identifiants Xtream Code configurés',
    mac_address: formattedMac,
    xtream_host: cleanHost,
    xtream_username: username
  });
});

// Get reseller's transaction history
router.get('/transactions', async (req, res) => {
  const resellerId = req.user.id;
  
  const transactions = await db.prepare(`
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
router.get('/devices/:mac/playlists', async (req, res) => {
  const { mac } = req.params;
  const resellerId = req.user.id;

  // Normalize MAC
  const formattedMac = mac.toUpperCase().replace(/[^A-F0-9]/g, '').match(/.{2}/g)?.join(':');
  
  if (!formattedMac) {
    return res.status(400).json({ error: 'Format MAC invalide' });
  }

  // Check device belongs to reseller
  const device = await db.prepare('SELECT * FROM devices WHERE mac_address = ? AND reseller_id = ?')
    .get(formattedMac, resellerId);
  
  if (!device) {
    return res.status(404).json({ error: 'Appareil non trouvé ou non autorisé' });
  }

  // Get all playlists for this device
  const playlists = await db.prepare(`
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
router.post('/devices/:mac/playlists/m3u', async (req, res) => {
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
  const device = await db.prepare('SELECT * FROM devices WHERE mac_address = ? AND reseller_id = ?')
    .get(formattedMac, resellerId);
  
  if (!device) {
    return res.status(404).json({ error: 'Appareil non trouvé ou non autorisé' });
  }

  // Check playlist limit (max 5 playlists per device)
  const playlistCountRow = await db.prepare('SELECT COUNT(*) as count FROM playlists WHERE device_id = ?')
    .get(device.id);
  const playlistCount = Number(playlistCountRow?.count || 0);
  
  if (playlistCount >= 5) {
    return res.status(400).json({ error: 'Limite de 5 playlists atteinte' });
  }

  // Deactivate all existing playlists for this device
  await db.prepare('UPDATE playlists SET is_active = 0 WHERE device_id = ?').run(device.id);

  // Insert new playlist as active
  const result = await db.prepare(`
    INSERT INTO playlists (device_id, name, playlist_type, playlist_url, epg_url, is_active)
    VALUES (?, ?, 'm3u', ?, ?, 1)
  `).run(device.id, name, playlist_url, epg_url || null);

  res.json({
    success: true,
    message: 'Playlist M3U ajoutée',
    playlist_id: Number(result?.lastInsertRowid || 0)
  });
});

// Add Xtream Code playlist to a device
router.post('/devices/:mac/playlists/xtream', async (req, res) => {
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
  const device = await db.prepare('SELECT * FROM devices WHERE mac_address = ? AND reseller_id = ?')
    .get(formattedMac, resellerId);
  
  if (!device) {
    return res.status(404).json({ error: 'Appareil non trouvé ou non autorisé' });
  }

  // Check playlist limit (max 5 playlists per device)
  const playlistCountRow = await db.prepare('SELECT COUNT(*) as count FROM playlists WHERE device_id = ?')
    .get(device.id);
  const playlistCount = Number(playlistCountRow?.count || 0);
  
  if (playlistCount >= 5) {
    return res.status(400).json({ error: 'Limite de 5 playlists atteinte' });
  }

  // Clean host URL
  let cleanHost = host.trim();
  cleanHost = cleanHost.replace(/^https?:\/\//, '');
  cleanHost = cleanHost.replace(/\/$/, '');

  // Deactivate all existing playlists for this device
  await db.prepare('UPDATE playlists SET is_active = 0 WHERE device_id = ?').run(device.id);

  // Insert new playlist as active
  const result = await db.prepare(`
    INSERT INTO playlists (device_id, name, playlist_type, xtream_host, xtream_username, xtream_password, epg_url, is_active)
    VALUES (?, ?, 'xtream', ?, ?, ?, ?, 1)
  `).run(device.id, name, cleanHost, username, password, epg_url || null);

  // Auto-register host for Top 10 service
  await autoRegisterXtreamHost(cleanHost, username, password);

  res.json({
    success: true,
    message: 'Playlist Xtream ajoutée',
    playlist_id: Number(result?.lastInsertRowid || 0)
  });
});

// Upload M3U file for a device
router.post('/devices/:mac/playlists/upload', upload.single('file'), async (req, res) => {
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
  const device = await db.prepare('SELECT * FROM devices WHERE mac_address = ? AND reseller_id = ?')
    .get(formattedMac, resellerId);
  
  if (!device) {
    return res.status(404).json({ error: 'Appareil non trouvé ou non autorisé' });
  }

  // Check playlist limit
  const playlistCountRow = await db.prepare('SELECT COUNT(*) as count FROM playlists WHERE device_id = ?')
    .get(device.id);
  const playlistCount = Number(playlistCountRow?.count || 0);
  
  if (playlistCount >= 5) {
    return res.status(400).json({ error: 'Limite de 5 playlists atteinte' });
  }

  const playlistUrl = `/uploads/${req.file.filename}`;

  // Deactivate all existing playlists for this device
  await db.prepare('UPDATE playlists SET is_active = 0 WHERE device_id = ?').run(device.id);

  // Insert new playlist as active
  const result = await db.prepare(`
    INSERT INTO playlists (device_id, name, playlist_type, playlist_url, epg_url, is_active)
    VALUES (?, ?, 'm3u', ?, ?, 1)
  `).run(device.id, name || `Playlist ${Date.now()}`, playlistUrl, epg_url || null);

  res.json({
    success: true,
    message: 'Fichier M3U uploadé et playlist ajoutée',
    playlist_id: Number(result?.lastInsertRowid || 0),
    filename: req.file.filename
  });
});

// Set a playlist as active (switch between playlists)
router.put('/devices/:mac/playlists/:playlistId/activate', async (req, res) => {
  const { mac, playlistId } = req.params;
  const resellerId = req.user.id;

  // Normalize MAC
  const formattedMac = mac.toUpperCase().replace(/[^A-F0-9]/g, '').match(/.{2}/g)?.join(':');
  
  if (!formattedMac) {
    return res.status(400).json({ error: 'Format MAC invalide' });
  }

  // Check device belongs to reseller
  const device = await db.prepare('SELECT * FROM devices WHERE mac_address = ? AND reseller_id = ?')
    .get(formattedMac, resellerId);
  
  if (!device) {
    return res.status(404).json({ error: 'Appareil non trouvé ou non autorisé' });
  }

  // Verify playlist belongs to this device
  const playlist = await db.prepare('SELECT * FROM playlists WHERE id = ? AND device_id = ?')
    .get(playlistId, device.id);

  if (!playlist) {
    return res.status(404).json({ error: 'Playlist non trouvée' });
  }

  // Deactivate all playlists for this device
  await db.prepare('UPDATE playlists SET is_active = 0 WHERE device_id = ?').run(device.id);

  // Activate the selected playlist
  await db.prepare('UPDATE playlists SET is_active = 1 WHERE id = ?').run(playlistId);

  res.json({
    success: true,
    message: 'Playlist activée'
  });
});

// Update a playlist
router.put('/devices/:mac/playlists/:playlistId', async (req, res) => {
  const { mac, playlistId } = req.params;
  const { name, playlist_url, host, username, password, epg_url } = req.body;
  const resellerId = req.user.id;

  const formattedMac = mac.toUpperCase().replace(/[^A-F0-9]/g, '').match(/.{2}/g)?.join(':');
  
  if (!formattedMac) {
    return res.status(400).json({ error: 'Format MAC invalide' });
  }

  const device = await db.prepare('SELECT * FROM devices WHERE mac_address = ? AND reseller_id = ?')
    .get(formattedMac, resellerId);
  
  if (!device) {
    return res.status(404).json({ error: 'Appareil non trouvé ou non autorisé' });
  }

  const playlist = await db.prepare('SELECT * FROM playlists WHERE id = ? AND device_id = ?')
    .get(playlistId, device.id);

  if (!playlist) {
    return res.status(404).json({ error: 'Playlist non trouvée' });
  }

  // Build update query dynamically
  const updates = [];
  const values = [];

  if (name) { updates.push('name = ?'); values.push(name); }
  if (playlist_url) { updates.push('playlist_url = ?'); values.push(playlist_url); }
  if (host) { updates.push('xtream_host = ?'); values.push(host); }
  if (username) { updates.push('xtream_username = ?'); values.push(username); }
  if (password) { updates.push('xtream_password = ?'); values.push(password); }
  if (epg_url !== undefined) { updates.push('epg_url = ?'); values.push(epg_url || null); }

  if (updates.length === 0) {
    return res.status(400).json({ error: 'Aucune modification fournie' });
  }

  values.push(playlistId);
  await db.prepare(`UPDATE playlists SET ${updates.join(', ')} WHERE id = ?`).run(...values);

  res.json({ success: true, message: 'Playlist modifiée' });
});

// Delete a playlist
router.delete('/devices/:mac/playlists/:playlistId', async (req, res) => {
  const { mac, playlistId } = req.params;
  const resellerId = req.user.id;

  // Normalize MAC
  const formattedMac = mac.toUpperCase().replace(/[^A-F0-9]/g, '').match(/.{2}/g)?.join(':');
  
  if (!formattedMac) {
    return res.status(400).json({ error: 'Format MAC invalide' });
  }

  // Check device belongs to reseller
  const device = await db.prepare('SELECT * FROM devices WHERE mac_address = ? AND reseller_id = ?')
    .get(formattedMac, resellerId);
  
  if (!device) {
    return res.status(404).json({ error: 'Appareil non trouvé ou non autorisé' });
  }

  // Verify playlist belongs to this device
  const playlist = await db.prepare('SELECT * FROM playlists WHERE id = ? AND device_id = ?')
    .get(playlistId, device.id);

  if (!playlist) {
    return res.status(404).json({ error: 'Playlist non trouvée' });
  }

  // Delete the playlist
  await db.prepare('DELETE FROM playlists WHERE id = ?').run(playlistId);

  // If this was the active playlist, activate the most recent one
  if (playlist.is_active === 1) {
    const latestPlaylist = await db.prepare(`
      SELECT id FROM playlists 
      WHERE device_id = ? 
      ORDER BY created_at DESC 
      LIMIT 1
    `).get(device.id);

    if (latestPlaylist) {
      await db.prepare('UPDATE playlists SET is_active = 1 WHERE id = ?').run(latestPlaylist.id);
    }
  }

  res.json({
    success: true,
    message: 'Playlist supprimée'
  });
});

// ============= SUB-RESELLERS MANAGEMENT =============

// Check if reseller can create sub-resellers
const canCreateSubResellers = async (resellerId) => {
  const reseller = await db.prepare('SELECT can_create_subresellers, is_subreseller FROM resellers WHERE id = ?').get(resellerId);
  if (!reseller) return false;
  // Sub-resellers cannot create sub-sub-resellers
  if (reseller.is_subreseller === true || reseller.is_subreseller === 1) return false;
  return reseller.can_create_subresellers === true || reseller.can_create_subresellers === 1;
};

// Get current reseller info (including permissions)
router.get('/me', async (req, res) => {
  const resellerId = req.user.id;
  
  const reseller = await db.prepare(`
    SELECT id, email, name, credits, status, can_create_subresellers, is_subreseller, parent_reseller_id, created_at
    FROM resellers WHERE id = ?
  `).get(resellerId);
  
  if (!reseller) {
    return res.status(404).json({ error: 'Revendeur non trouvé' });
  }
  
  res.json({
    ...reseller,
    can_create_subresellers: usePostgres ? reseller.can_create_subresellers : !!reseller.can_create_subresellers,
    is_subreseller: usePostgres ? reseller.is_subreseller : !!reseller.is_subreseller
  });
});

// List sub-resellers
router.get('/subresellers', async (req, res) => {
  const resellerId = req.user.id;
  
  // Check permission
  const canCreate = await canCreateSubResellers(resellerId);
  if (!canCreate) {
    return res.status(403).json({ error: 'Vous n\'avez pas la permission de gérer des sous-revendeurs' });
  }
  
  const subResellers = await db.prepare(`
    SELECT r.id, r.email, r.name, r.credits, r.status, r.created_at,
           (SELECT COUNT(*) FROM devices WHERE reseller_id = r.id) as device_count,
           (SELECT COUNT(*) FROM devices WHERE reseller_id = r.id AND status = 'active') as active_devices
    FROM resellers r
    WHERE r.parent_reseller_id = ?
    ORDER BY r.created_at DESC
  `).all(resellerId);
  
  res.json(subResellers);
});

// Create sub-reseller
router.post('/subresellers', async (req, res) => {
  const resellerId = req.user.id;
  const { email, password, name, credits } = req.body;
  
  // Check permission
  const canCreate = await canCreateSubResellers(resellerId);
  if (!canCreate) {
    return res.status(403).json({ error: 'Vous n\'avez pas la permission de créer des sous-revendeurs' });
  }
  
  // Validate input
  if (!email || !password || !name) {
    return res.status(400).json({ error: 'Email, mot de passe et nom sont requis' });
  }
  
  const initialCredits = parseInt(credits) || 0;
  
  // Check if email already exists
  const existingReseller = await db.prepare('SELECT id FROM resellers WHERE email = ?').get(email);
  if (existingReseller) {
    return res.status(400).json({ error: 'Cet email existe déjà' });
  }
  
  // Check if parent has enough credits
  const parentReseller = await db.prepare('SELECT credits FROM resellers WHERE id = ?').get(resellerId);
  if (initialCredits > 0 && parentReseller.credits < initialCredits) {
    return res.status(400).json({ 
      error: `Crédits insuffisants. Disponible: ${parentReseller.credits}, Demandé: ${initialCredits}` 
    });
  }
  
  try {
    const hashedPassword = bcrypt.hashSync(password, 10);
    
    // Create sub-reseller
    const result = await db.prepare(`
      INSERT INTO resellers (email, password, name, credits, status, parent_reseller_id, is_subreseller, can_create_subresellers)
      VALUES (?, ?, ?, ?, 'active', ?, ?, ?)
    `).run(
      email,
      hashedPassword,
      name,
      initialCredits,
      resellerId,
      usePostgres ? true : 1,
      usePostgres ? false : 0
    );
    
    const newSubResellerId = Number(result?.lastInsertRowid || 0);
    
    // Deduct credits from parent
    if (initialCredits > 0) {
      await db.prepare('UPDATE resellers SET credits = credits - ? WHERE id = ?').run(initialCredits, resellerId);
      
      // Log transaction for parent (deduction)
      await db.prepare(`
        INSERT INTO transactions (reseller_id, from_reseller_id, type, amount, description)
        VALUES (?, ?, 'credit_transfer_out', ?, ?)
      `).run(resellerId, null, initialCredits, `Transfert à ${name}`);
      
      // Log transaction for sub-reseller (addition)
      await db.prepare(`
        INSERT INTO transactions (reseller_id, from_reseller_id, type, amount, description)
        VALUES (?, ?, 'credit_transfer_in', ?, ?)
      `).run(newSubResellerId, resellerId, initialCredits, 'Crédits initiaux du parent');
    }
    
    const updatedParent = await db.prepare('SELECT credits FROM resellers WHERE id = ?').get(resellerId);
    
    res.status(201).json({
      success: true,
      message: 'Sous-revendeur créé avec succès',
      subreseller: {
        id: newSubResellerId,
        email,
        name,
        credits: initialCredits
      },
      parent_credits_remaining: updatedParent.credits
    });
  } catch (error) {
    console.error('Error creating sub-reseller:', error);
    res.status(500).json({ error: 'Erreur lors de la création du sous-revendeur' });
  }
});

// Update sub-reseller
router.put('/subresellers/:id', async (req, res) => {
  const resellerId = req.user.id;
  const { id } = req.params;
  const { name, password, status } = req.body;
  
  // Check permission
  const canCreate = await canCreateSubResellers(resellerId);
  if (!canCreate) {
    return res.status(403).json({ error: 'Vous n\'avez pas la permission de gérer des sous-revendeurs' });
  }
  
  // Check if sub-reseller belongs to this reseller
  const subReseller = await db.prepare('SELECT * FROM resellers WHERE id = ? AND parent_reseller_id = ?').get(id, resellerId);
  if (!subReseller) {
    return res.status(404).json({ error: 'Sous-revendeur non trouvé' });
  }
  
  try {
    if (password) {
      const hashedPassword = bcrypt.hashSync(password, 10);
      await db.prepare('UPDATE resellers SET password = ? WHERE id = ?').run(hashedPassword, id);
    }
    
    if (name) {
      await db.prepare('UPDATE resellers SET name = ? WHERE id = ?').run(name, id);
    }
    
    if (status && ['active', 'inactive'].includes(status)) {
      await db.prepare('UPDATE resellers SET status = ? WHERE id = ?').run(status, id);
    }
    
    res.json({ success: true, message: 'Sous-revendeur mis à jour' });
  } catch (error) {
    console.error('Error updating sub-reseller:', error);
    res.status(500).json({ error: 'Erreur lors de la mise à jour' });
  }
});

// Transfer credits to sub-reseller
router.post('/subresellers/:id/credits', async (req, res) => {
  const resellerId = req.user.id;
  const { id } = req.params;
  const { amount } = req.body;
  
  // Check permission
  const canCreate = await canCreateSubResellers(resellerId);
  if (!canCreate) {
    return res.status(403).json({ error: 'Vous n\'avez pas la permission de gérer des sous-revendeurs' });
  }
  
  const creditAmount = parseInt(amount);
  if (!creditAmount || creditAmount <= 0) {
    return res.status(400).json({ error: 'Montant invalide' });
  }
  
  // Check if sub-reseller belongs to this reseller
  const subReseller = await db.prepare('SELECT * FROM resellers WHERE id = ? AND parent_reseller_id = ?').get(id, resellerId);
  if (!subReseller) {
    return res.status(404).json({ error: 'Sous-revendeur non trouvé' });
  }
  
  // Check if parent has enough credits
  const parentReseller = await db.prepare('SELECT credits FROM resellers WHERE id = ?').get(resellerId);
  if (parentReseller.credits < creditAmount) {
    return res.status(400).json({ 
      error: `Crédits insuffisants. Disponible: ${parentReseller.credits}` 
    });
  }
  
  try {
    // Deduct from parent
    await db.prepare('UPDATE resellers SET credits = credits - ? WHERE id = ?').run(creditAmount, resellerId);
    
    // Add to sub-reseller
    await db.prepare('UPDATE resellers SET credits = credits + ? WHERE id = ?').run(creditAmount, id);
    
    // Log transaction for parent (deduction)
    await db.prepare(`
      INSERT INTO transactions (reseller_id, from_reseller_id, type, amount, description)
      VALUES (?, ?, 'credit_transfer_out', ?, ?)
    `).run(resellerId, null, creditAmount, `Transfert à ${subReseller.name}`);
    
    // Log transaction for sub-reseller (addition)
    await db.prepare(`
      INSERT INTO transactions (reseller_id, from_reseller_id, type, amount, description)
      VALUES (?, ?, 'credit_transfer_in', ?, ?)
    `).run(id, resellerId, creditAmount, 'Transfert du parent');
    
    const updatedParent = await db.prepare('SELECT credits FROM resellers WHERE id = ?').get(resellerId);
    const updatedSub = await db.prepare('SELECT credits FROM resellers WHERE id = ?').get(id);
    
    res.json({
      success: true,
      message: `${creditAmount} crédits transférés`,
      parent_credits: updatedParent.credits,
      subreseller_credits: updatedSub.credits
    });
  } catch (error) {
    console.error('Error transferring credits:', error);
    res.status(500).json({ error: 'Erreur lors du transfert' });
  }
});

// Delete sub-reseller
router.delete('/subresellers/:id', async (req, res) => {
  const resellerId = req.user.id;
  const { id } = req.params;
  
  // Check permission
  const canCreate = await canCreateSubResellers(resellerId);
  if (!canCreate) {
    return res.status(403).json({ error: 'Vous n\'avez pas la permission de gérer des sous-revendeurs' });
  }
  
  // Check if sub-reseller belongs to this reseller
  const subReseller = await db.prepare('SELECT * FROM resellers WHERE id = ? AND parent_reseller_id = ?').get(id, resellerId);
  if (!subReseller) {
    return res.status(404).json({ error: 'Sous-revendeur non trouvé' });
  }
  
  try {
    // Remove sub-reseller's devices assignment
    await db.prepare('UPDATE devices SET reseller_id = NULL WHERE reseller_id = ?').run(id);
    
    // Delete sub-reseller
    await db.prepare('DELETE FROM resellers WHERE id = ?').run(id);
    
    res.json({ success: true, message: 'Sous-revendeur supprimé' });
  } catch (error) {
    console.error('Error deleting sub-reseller:', error);
    res.status(500).json({ error: 'Erreur lors de la suppression' });
  }
});

// Get sub-reseller transactions (for history)
router.get('/subresellers/:id/transactions', async (req, res) => {
  const resellerId = req.user.id;
  const { id } = req.params;
  
  // Check permission
  const canCreate = await canCreateSubResellers(resellerId);
  if (!canCreate) {
    return res.status(403).json({ error: 'Vous n\'avez pas la permission de gérer des sous-revendeurs' });
  }
  
  // Check if sub-reseller belongs to this reseller
  const subReseller = await db.prepare('SELECT * FROM resellers WHERE id = ? AND parent_reseller_id = ?').get(id, resellerId);
  if (!subReseller) {
    return res.status(404).json({ error: 'Sous-revendeur non trouvé' });
  }
  
  const transactions = await db.prepare(`
    SELECT t.*, fr.name as from_reseller_name
    FROM transactions t
    LEFT JOIN resellers fr ON t.from_reseller_id = fr.id
    WHERE t.reseller_id = ?
    ORDER BY t.created_at DESC
    LIMIT 50
  `).all(id);
  
  res.json(transactions);
});

// Get MAC address from Link Code
router.get('/link-code/:code', verifyToken, isReseller, async (req, res) => {
  const { code } = req.params;

  if (!code || code.length !== 4) {
    return res.status(400).json({ error: 'Code invalide' });
  }

  try {
    // PostgreSQL uses boolean, SQLite uses integer
    const usedCondition = usePostgres ? 'used = false' : 'used = 0';
    const linkCodeEntry = await db.prepare(`SELECT * FROM link_codes WHERE code = ? AND ${usedCondition}`).get(code.toUpperCase());

    if (!linkCodeEntry) {
      return res.status(404).json({ error: 'Code non trouvé ou déjà utilisé' });
    }

    const now = new Date();
    const expiresAt = new Date(linkCodeEntry.expires_at);

    if (now > expiresAt) {
      // Mark as expired
      const usedValue = usePostgres ? 'true' : '1';
      await db.prepare(`UPDATE link_codes SET used = ${usedValue} WHERE id = ?`).run(linkCodeEntry.id);
      return res.status(400).json({ error: 'Code expiré' });
    }

    // Mark code as used after successful retrieval
    const usedValue = usePostgres ? 'true' : '1';
    await db.prepare(`UPDATE link_codes SET used = ${usedValue} WHERE id = ?`).run(linkCodeEntry.id);

    console.log(`🔗 Link code ${code} used - MAC: ${linkCodeEntry.mac_address}`);
    res.json({ mac_address: linkCodeEntry.mac_address });
  } catch (error) {
    console.error('Error checking link code:', error);
    res.status(500).json({ error: 'Erreur lors de la vérification du code' });
  }
});

module.exports = router;



















