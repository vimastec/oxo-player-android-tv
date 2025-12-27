const express = require('express');
const path = require('path');
const fs = require('fs');
const { db } = require('../database');
const { generateDeviceKey } = require('../migrations/add_portal_support');

const router = express.Router();

const TRIAL_DAYS = parseInt(process.env.TRIAL_DAYS) || 7;

// Register/Check device (called by OXO Player app)
router.post('/register', (req, res) => {
  const { mac_address, device_info } = req.body;

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
  let device = db.prepare('SELECT * FROM devices WHERE mac_address = ?').get(formattedMac);

  const now = new Date();

  if (!device) {
    // Create new device with trial period and device key
    const trialEnd = new Date();
    trialEnd.setDate(trialEnd.getDate() + TRIAL_DAYS);
    const deviceKey = generateDeviceKey();

    db.prepare(`
      INSERT INTO devices (mac_address, device_key, status, trial_start, expiration_date, device_info, last_seen)
      VALUES (?, ?, 'trial', ?, ?, ?, ?)
    `).run(formattedMac, deviceKey, now.toISOString(), trialEnd.toISOString(), device_info || null, now.toISOString());

    device = db.prepare('SELECT * FROM devices WHERE mac_address = ?').get(formattedMac);
  } else if (!device.device_key) {
    // Generate device_key for existing devices without one
    const deviceKey = generateDeviceKey();
    db.prepare('UPDATE devices SET device_key = ? WHERE mac_address = ?').run(deviceKey, formattedMac);
    device.device_key = deviceKey;
  } else {
    // Update last seen
    db.prepare('UPDATE devices SET last_seen = ?, device_info = ? WHERE mac_address = ?')
      .run(now.toISOString(), device_info || device.device_info, formattedMac);

    // Check if expired
    if (device.expiration_date) {
      const expirationDate = new Date(device.expiration_date);
      if (now > expirationDate && device.status !== 'expired') {
        db.prepare("UPDATE devices SET status = 'expired' WHERE mac_address = ?").run(formattedMac);
        device.status = 'expired';
      }
    }

    // Refresh device data
    device = db.prepare('SELECT * FROM devices WHERE mac_address = ?').get(formattedMac);
  }

  // Calculate days remaining
  let daysRemaining = 0;
  if (device.expiration_date) {
    const expDate = new Date(device.expiration_date);
    const diffTime = expDate.getTime() - now.getTime();
    daysRemaining = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    if (daysRemaining < 0) daysRemaining = 0;
  }

  // Check if device has playlist configured (check new playlists table first, then device table)
  const playlistCount = db.prepare('SELECT COUNT(*) as count FROM playlists WHERE device_id = ? AND is_active = 1').get(device.id);
  const hasPlaylistInTable = playlistCount && playlistCount.count > 0;
  const hasPlaylistInDevice = !!(device.playlist_url || (device.xtream_host && device.xtream_username));
  const hasPlaylist = hasPlaylistInTable || hasPlaylistInDevice;

  // Get playlist type from playlists table if available
  let playlistType = device.playlist_type || 'm3u';
  if (hasPlaylistInTable) {
    const firstPlaylist = db.prepare('SELECT playlist_type FROM playlists WHERE device_id = ? AND is_active = 1 ORDER BY created_at DESC LIMIT 1').get(device.id);
    if (firstPlaylist) {
      playlistType = firstPlaylist.playlist_type;
    }
  }

  res.json({
    mac_address: formattedMac,
    device_key: device.device_key,
    status: device.status,
    trial_start: device.trial_start,
    activation_date: device.activation_date,
    expiration_date: device.expiration_date,
    days_remaining: daysRemaining,
    has_playlist: hasPlaylist,
    playlist_type: playlistType
  });
});

// Get playlist for device (called by OXO Player app)
router.get('/playlist/:mac', async (req, res) => {
  const { mac } = req.params;

  // Normalize MAC
  const normalizedMac = mac.toUpperCase().replace(/[^A-F0-9]/g, '');
  if (normalizedMac.length !== 12) {
    return res.status(400).json({ error: 'Format MAC invalide' });
  }

  const formattedMac = normalizedMac.match(/.{2}/g).join(':');

  // Get device
  const device = db.prepare('SELECT * FROM devices WHERE mac_address = ?').get(formattedMac);

  if (!device) {
    return res.status(404).json({ error: 'Appareil non enregistré' });
  }

  // Check status
  const now = new Date();
  
  if (device.status === 'expired') {
    return res.status(403).json({ 
      error: 'Abonnement expiré',
      status: 'expired',
      message: 'Votre abonnement a expiré. Contactez votre revendeur pour renouveler.'
    });
  }

  if (device.status === 'trial') {
    const trialEnd = new Date(device.expiration_date);
    if (now > trialEnd) {
      db.prepare("UPDATE devices SET status = 'expired' WHERE mac_address = ?").run(formattedMac);
      return res.status(403).json({
        error: 'Période d\'essai terminée',
        status: 'trial_expired',
        message: 'Votre période d\'essai de 7 jours est terminée. Contactez un revendeur pour activer.'
      });
    }
  }

  // Check if playlist exists in new playlists table first
  const playlist = db.prepare(`
    SELECT * FROM playlists 
    WHERE device_id = ? AND is_active = 1 
    ORDER BY created_at DESC 
    LIMIT 1
  `).get(device.id);

  // Fallback to old device table for backwards compatibility
  const hasM3U = !!device.playlist_url;
  const hasXtream = !!(device.xtream_host && device.xtream_username);
  
  if (!playlist && !hasM3U && !hasXtream) {
    return res.status(404).json({
      error: 'Aucune playlist configurée',
      status: device.status,
      message: 'Aucune playlist n\'a été configurée pour cet appareil. Contactez votre revendeur.'
    });
  }

  // Return playlist info (M3U or Xtream)
  const response = {
    mac_address: formattedMac,
    status: device.status,
    expiration_date: device.expiration_date,
    playlist_type: playlist ? playlist.playlist_type : (device.playlist_type || 'm3u')
  };

  // Use new playlists table if available
  if (playlist) {
    if (playlist.playlist_type === 'xtream' && playlist.xtream_host) {
      response.xtream = {
        host: playlist.xtream_host,
        username: playlist.xtream_username,
        password: playlist.xtream_password
      };
    } else {
      response.playlist_url = playlist.playlist_url;
    }
  }
  // Fallback to old device table
  else if (device.playlist_type === 'xtream' && device.xtream_host) {
    response.xtream = {
      host: device.xtream_host,
      username: device.xtream_username,
      password: device.xtream_password
    };
  } else {
    response.playlist_url = device.playlist_url;
    response.playlist_content = device.playlist_content;
  }

  res.json(response);
});

// Proxy endpoint to fetch external M3U playlists (solves CORS issues)
router.get('/playlist/:mac/content', async (req, res) => {
  const { mac } = req.params;

  // Normalize MAC
  const normalizedMac = mac.toUpperCase().replace(/[^A-F0-9]/g, '');
  if (normalizedMac.length !== 12) {
    return res.status(400).json({ error: 'Format MAC invalide' });
  }

  const formattedMac = normalizedMac.match(/.{2}/g).join(':');

  // Get device
  const device = db.prepare('SELECT * FROM devices WHERE mac_address = ?').get(formattedMac);

  if (!device) {
    return res.status(404).json({ error: 'Appareil non enregistré' });
  }

  // Check status
  if (device.status === 'expired') {
    return res.status(403).json({ error: 'Abonnement expiré' });
  }

  // Get active playlist from playlists table
  const playlist = db.prepare(`
    SELECT * FROM playlists 
    WHERE device_id = ? AND is_active = 1 
    ORDER BY created_at DESC 
    LIMIT 1
  `).get(device.id);

  // Fallback to device table for backwards compatibility
  const playlistUrl = playlist?.playlist_url || device.playlist_url;
  const playlistContent = playlist?.playlist_content || device.playlist_content;

  if (!playlistUrl && !playlistContent) {
    return res.status(404).json({ error: 'Aucune playlist configurée' });
  }

  try {
    let content = '';

    // Check if it's a local file (starts with /uploads/)
    if (playlistUrl && playlistUrl.startsWith('/uploads/')) {
      const filePath = path.join(__dirname, '../../', playlistUrl);
      console.log('Loading local file:', filePath);
      
      if (fs.existsSync(filePath)) {
        content = fs.readFileSync(filePath, 'utf8');
      } else {
        return res.status(404).json({ error: 'Fichier playlist non trouvé' });
      }
    }
    // Check if it's an external URL
    else if (playlistUrl && (playlistUrl.startsWith('http://') || playlistUrl.startsWith('https://'))) {
      console.log('Fetching external URL:', playlistUrl);
      
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 120000); // 120s timeout for large playlists
      
      try {
        const response = await fetch(playlistUrl, {
          signal: controller.signal,
          headers: {
            'User-Agent': 'OXO Player/1.0'
          }
        });
        clearTimeout(timeout);
        
        if (!response.ok) {
          console.error('Fetch failed:', response.status, response.statusText);
          return res.status(502).json({ error: `Erreur serveur IPTV: ${response.status}` });
        }
        
        content = await response.text();
        
        if (!content || content.trim().length === 0) {
          return res.status(502).json({ error: 'La playlist est vide. Vérifiez vos identifiants IPTV.' });
        }
      } catch (fetchError) {
        clearTimeout(timeout);
        console.error('Fetch error:', fetchError);
        return res.status(502).json({ error: 'Impossible de contacter le serveur IPTV' });
      }
    }
    // Check if we have stored content
    else if (playlistContent) {
      content = playlistContent;
    }
    else {
      return res.status(404).json({ error: 'Playlist non trouvée' });
    }

    // Send the content
    res.setHeader('Content-Type', 'audio/x-mpegurl; charset=utf-8');
    res.send(content);
    
  } catch (error) {
    console.error('Error loading playlist:', error);
    res.status(500).json({ error: 'Erreur lors du chargement de la playlist' });
  }
});

// Get all playlists for device (for playlist selector)
router.get('/playlists/:mac', (req, res) => {
  const { mac } = req.params;

  // Normalize MAC
  const normalizedMac = mac.toUpperCase().replace(/[^A-F0-9]/g, '');
  if (normalizedMac.length !== 12) {
    return res.status(400).json({ error: 'Format MAC invalide' });
  }

  const formattedMac = normalizedMac.match(/.{2}/g).join(':');

  // Get device
  const device = db.prepare('SELECT * FROM devices WHERE mac_address = ?').get(formattedMac);

  if (!device) {
    return res.status(404).json({ error: 'Appareil non trouvé' });
  }

  // Get all playlists for this device
  const playlists = db.prepare(`
    SELECT id, name, playlist_type, playlist_url, xtream_host, xtream_username, xtream_password, is_active, created_at
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
      is_active: p.is_active === 1,
      created_at: p.created_at
    }))
  });
});

// Get specific playlist by ID
router.get('/playlist/:mac/:playlistId', (req, res) => {
  const { mac, playlistId } = req.params;

  // Normalize MAC
  const normalizedMac = mac.toUpperCase().replace(/[^A-F0-9]/g, '');
  if (normalizedMac.length !== 12) {
    return res.status(400).json({ error: 'Format MAC invalide' });
  }

  const formattedMac = normalizedMac.match(/.{2}/g).join(':');

  // Get device
  const device = db.prepare('SELECT * FROM devices WHERE mac_address = ?').get(formattedMac);

  if (!device) {
    return res.status(404).json({ error: 'Appareil non trouvé' });
  }

  // Check status
  if (device.status === 'expired') {
    return res.status(403).json({ 
      error: 'Abonnement expiré',
      status: 'expired'
    });
  }

  // Get specific playlist
  const playlist = db.prepare(`
    SELECT * FROM playlists 
    WHERE id = ? AND device_id = ?
  `).get(playlistId, device.id);

  if (!playlist) {
    return res.status(404).json({ error: 'Playlist non trouvée' });
  }

  // Return playlist info
  const response = {
    id: playlist.id,
    name: playlist.name,
    mac_address: formattedMac,
    status: device.status,
    expiration_date: device.expiration_date,
    playlist_type: playlist.playlist_type
  };

  if (playlist.playlist_type === 'xtream' && playlist.xtream_host) {
    response.xtream = {
      host: playlist.xtream_host,
      username: playlist.xtream_username,
      password: playlist.xtream_password
    };
  } else {
    response.playlist_url = playlist.playlist_url;
  }

  res.json(response);
});

// Set active playlist for device
router.post('/playlist/:mac/set-active/:playlistId', (req, res) => {
  const { mac, playlistId } = req.params;

  // Normalize MAC
  const normalizedMac = mac.toUpperCase().replace(/[^A-F0-9]/g, '');
  if (normalizedMac.length !== 12) {
    return res.status(400).json({ error: 'Format MAC invalide' });
  }

  const formattedMac = normalizedMac.match(/.{2}/g).join(':');

  // Get device
  const device = db.prepare('SELECT * FROM devices WHERE mac_address = ?').get(formattedMac);

  if (!device) {
    return res.status(404).json({ error: 'Appareil non trouvé' });
  }

  // Check if playlist belongs to this device
  const playlist = db.prepare('SELECT * FROM playlists WHERE id = ? AND device_id = ?').get(playlistId, device.id);
  
  if (!playlist) {
    return res.status(404).json({ error: 'Playlist non trouvée' });
  }

  // Deactivate all playlists for this device
  db.prepare('UPDATE playlists SET is_active = 0 WHERE device_id = ?').run(device.id);

  // Activate the selected playlist
  db.prepare('UPDATE playlists SET is_active = 1 WHERE id = ?').run(playlistId);

  console.log(`✅ Set playlist ${playlistId} as active for device ${formattedMac}`);

  res.json({
    success: true,
    message: 'Playlist activée',
    active_playlist: {
      id: playlist.id,
      name: playlist.name
    }
  });
});

// Check device status (quick check for app)
router.get('/status/:mac', (req, res) => {
  const { mac } = req.params;

  // Normalize MAC
  const normalizedMac = mac.toUpperCase().replace(/[^A-F0-9]/g, '');
  if (normalizedMac.length !== 12) {
    return res.status(400).json({ error: 'Format MAC invalide' });
  }

  const formattedMac = normalizedMac.match(/.{2}/g).join(':');

  const device = db.prepare('SELECT status, expiration_date, playlist_url, playlist_type, xtream_host, xtream_username FROM devices WHERE mac_address = ?').get(formattedMac);

  if (!device) {
    return res.json({
      registered: false,
      status: 'unregistered'
    });
  }

  // Check expiration
  const now = new Date();
  let status = device.status;
  
  if (device.expiration_date) {
    const expDate = new Date(device.expiration_date);
    if (now > expDate && status !== 'expired') {
      status = 'expired';
    }
  }

  // Calculate days remaining
  let daysRemaining = 0;
  if (device.expiration_date) {
    const expDate = new Date(device.expiration_date);
    const diffTime = expDate.getTime() - now.getTime();
    daysRemaining = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    if (daysRemaining < 0) daysRemaining = 0;
  }

  // Check if device has playlist configured (M3U or Xtream)
  const hasPlaylist = !!(device.playlist_url || (device.xtream_host && device.xtream_username));

  res.json({
    registered: true,
    status,
    has_playlist: hasPlaylist,
    playlist_type: device.playlist_type || 'm3u',
    days_remaining: daysRemaining,
    expiration_date: device.expiration_date
  });
});

module.exports = router;
