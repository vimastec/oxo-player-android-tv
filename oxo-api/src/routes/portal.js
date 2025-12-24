/**
 * Portal Routes - User self-service portal
 * Allows users to login with MAC + Device Key and manage their playlists
 */

const express = require('express');
const { db } = require('../database');
const { generateDeviceKey } = require('../migrations/add_portal_support');

const router = express.Router();

// Simple captcha storage (in production, use Redis or similar)
const captchaStore = new Map();

/**
 * Generate captcha
 * GET /api/portal/captcha
 */
router.get('/captcha', (req, res) => {
  const captchaId = generateCaptchaId();
  const captchaCode = generateCaptchaCode();
  
  // Store captcha (expires in 5 minutes)
  captchaStore.set(captchaId, {
    code: captchaCode,
    expires: Date.now() + 5 * 60 * 1000
  });

  // Clean up expired captchas
  cleanupExpiredCaptchas();

  res.json({
    captcha_id: captchaId,
    captcha_image: generateCaptchaImage(captchaCode)
  });
});

/**
 * Login with MAC + Device Key
 * POST /api/portal/login
 */
router.post('/login', (req, res) => {
  const { mac_address, device_key, captcha_id, captcha_code } = req.body;

  // Validate captcha
  const captcha = captchaStore.get(captcha_id);
  if (!captcha || captcha.expires < Date.now()) {
    return res.status(400).json({ error: 'Captcha expiré. Veuillez rafraîchir.' });
  }
  
  if (captcha.code.toLowerCase() !== captcha_code?.toLowerCase()) {
    return res.status(400).json({ error: 'Captcha incorrect' });
  }

  // Remove used captcha
  captchaStore.delete(captcha_id);

  // Validate MAC address
  if (!mac_address) {
    return res.status(400).json({ error: 'Adresse MAC requise' });
  }

  // Normalize MAC address
  const normalizedMac = mac_address.toUpperCase().replace(/[^A-F0-9]/g, '');
  if (normalizedMac.length !== 12) {
    return res.status(400).json({ error: 'Format d\'adresse MAC invalide' });
  }

  const formattedMac = normalizedMac.match(/.{2}/g).join(':');

  // Find device
  const device = db.prepare('SELECT * FROM devices WHERE mac_address = ?').get(formattedMac);

  if (!device) {
    return res.status(404).json({ error: 'Appareil non trouvé. Lancez d\'abord l\'application OXO Player.' });
  }

  // Verify device key
  if (device.device_key !== device_key) {
    return res.status(401).json({ error: 'Device Key incorrect' });
  }

  // Check if device is expired
  if (device.status === 'expired') {
    return res.status(403).json({ 
      error: 'Abonnement expiré',
      message: 'Votre abonnement a expiré. Contactez votre revendeur pour renouveler.'
    });
  }

  // Generate session token (simple implementation)
  const sessionToken = generateSessionToken();
  
  // Store session (in production, use JWT or Redis)
  const sessionExpires = Date.now() + 24 * 60 * 60 * 1000; // 24 hours

  res.json({
    success: true,
    token: sessionToken,
    device: {
      mac_address: formattedMac,
      device_key: device.device_key,
      status: device.status,
      expiration_date: device.expiration_date
    }
  });
});

/**
 * Get device info and playlists
 * GET /api/portal/device/:mac
 */
router.get('/device/:mac', (req, res) => {
  const { mac } = req.params;
  const deviceKey = req.headers['x-device-key'];

  // Normalize MAC
  const normalizedMac = mac.toUpperCase().replace(/[^A-F0-9]/g, '');
  if (normalizedMac.length !== 12) {
    return res.status(400).json({ error: 'Format MAC invalide' });
  }

  const formattedMac = normalizedMac.match(/.{2}/g).join(':');

  // Find device
  const device = db.prepare('SELECT * FROM devices WHERE mac_address = ?').get(formattedMac);

  if (!device) {
    return res.status(404).json({ error: 'Appareil non trouvé' });
  }

  // Verify device key
  if (device.device_key !== deviceKey) {
    return res.status(401).json({ error: 'Non autorisé' });
  }

  // Get playlists
  const playlists = db.prepare(`
    SELECT id, name, playlist_type, playlist_url, xtream_host, xtream_username, 
           epg_url, is_protected, is_active, created_at
    FROM playlists 
    WHERE device_id = ?
    ORDER BY created_at DESC
  `).all(device.id);

  // Mask sensitive data for protected playlists
  const maskedPlaylists = playlists.map(p => ({
    id: p.id,
    name: p.name,
    playlist_type: p.playlist_type,
    url: p.is_protected ? 'Protected' : (p.playlist_url || `http://${p.xtream_host}`),
    username: p.is_protected ? 'Protected' : p.xtream_username,
    password: p.is_protected ? 'Protected' : null,
    epg_url: p.epg_url,
    is_protected: p.is_protected === 1,
    is_active: p.is_active === 1,
    created_at: p.created_at
  }));

  res.json({
    mac_address: formattedMac,
    status: device.status,
    expiration_date: device.expiration_date,
    playlists: maskedPlaylists
  });
});

/**
 * Add M3U Playlist
 * POST /api/portal/playlists
 */
router.post('/playlists', (req, res) => {
  const { mac_address, device_key, name, playlist_url, epg_url, is_protected, pin } = req.body;

  // Validate
  if (!mac_address || !device_key) {
    return res.status(401).json({ error: 'Non autorisé' });
  }

  if (!name || !playlist_url) {
    return res.status(400).json({ error: 'Nom et URL requis' });
  }

  // Normalize MAC
  const normalizedMac = mac_address.toUpperCase().replace(/[^A-F0-9]/g, '');
  const formattedMac = normalizedMac.match(/.{2}/g).join(':');

  // Find device
  const device = db.prepare('SELECT * FROM devices WHERE mac_address = ? AND device_key = ?')
    .get(formattedMac, device_key);

  if (!device) {
    return res.status(401).json({ error: 'Non autorisé' });
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
    INSERT INTO playlists (device_id, name, playlist_type, playlist_url, epg_url, is_protected, pin, is_active)
    VALUES (?, ?, 'm3u', ?, ?, ?, ?, 1)
  `).run(device.id, name, playlist_url, epg_url || null, is_protected ? 1 : 0, is_protected ? pin : null);

  res.json({
    success: true,
    message: 'Playlist ajoutée',
    playlist_id: result.lastInsertRowid
  });
});

/**
 * Add Xtream Code Playlist
 * POST /api/portal/playlists/xtream
 */
router.post('/playlists/xtream', (req, res) => {
  const { mac_address, device_key, name, host, username, password, epg_url, is_protected, pin } = req.body;

  // Validate
  if (!mac_address || !device_key) {
    return res.status(401).json({ error: 'Non autorisé' });
  }

  if (!name || !host || !username || !password) {
    return res.status(400).json({ error: 'Nom, host, username et password requis' });
  }

  // Normalize MAC
  const normalizedMac = mac_address.toUpperCase().replace(/[^A-F0-9]/g, '');
  const formattedMac = normalizedMac.match(/.{2}/g).join(':');

  // Find device
  const device = db.prepare('SELECT * FROM devices WHERE mac_address = ? AND device_key = ?')
    .get(formattedMac, device_key);

  if (!device) {
    return res.status(401).json({ error: 'Non autorisé' });
  }

  // Check playlist limit
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
    INSERT INTO playlists (device_id, name, playlist_type, xtream_host, xtream_username, xtream_password, epg_url, is_protected, pin, is_active)
    VALUES (?, ?, 'xtream', ?, ?, ?, ?, ?, ?, 1)
  `).run(device.id, name, cleanHost, username, password, epg_url || null, is_protected ? 1 : 0, is_protected ? pin : null);

  res.json({
    success: true,
    message: 'Playlist Xtream ajoutée',
    playlist_id: result.lastInsertRowid
  });
});

/**
 * Update Playlist
 * PUT /api/portal/playlists/:id
 */
router.put('/playlists/:id', (req, res) => {
  const { id } = req.params;
  const { mac_address, device_key, name, playlist_url, host, username, password, epg_url, is_protected, pin, unlock_pin } = req.body;

  // Validate auth
  if (!mac_address || !device_key) {
    return res.status(401).json({ error: 'Non autorisé' });
  }

  // Normalize MAC
  const normalizedMac = mac_address.toUpperCase().replace(/[^A-F0-9]/g, '');
  const formattedMac = normalizedMac.match(/.{2}/g).join(':');

  // Find device
  const device = db.prepare('SELECT * FROM devices WHERE mac_address = ? AND device_key = ?')
    .get(formattedMac, device_key);

  if (!device) {
    return res.status(401).json({ error: 'Non autorisé' });
  }

  // Find playlist
  const playlist = db.prepare('SELECT * FROM playlists WHERE id = ? AND device_id = ?')
    .get(id, device.id);

  if (!playlist) {
    return res.status(404).json({ error: 'Playlist non trouvée' });
  }

  // Check PIN if protected
  if (playlist.is_protected && playlist.pin !== unlock_pin) {
    return res.status(403).json({ error: 'PIN incorrect' });
  }

  // Update playlist based on type
  if (playlist.playlist_type === 'xtream') {
    let cleanHost = host?.trim() || playlist.xtream_host;
    cleanHost = cleanHost.replace(/^https?:\/\//, '');
    cleanHost = cleanHost.replace(/\/$/, '');

    db.prepare(`
      UPDATE playlists 
      SET name = ?, xtream_host = ?, xtream_username = ?, xtream_password = ?, 
          epg_url = ?, is_protected = ?, pin = ?, updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `).run(
      name || playlist.name,
      cleanHost,
      username || playlist.xtream_username,
      password || playlist.xtream_password,
      epg_url,
      is_protected ? 1 : 0,
      is_protected ? (pin || playlist.pin) : null,
      id
    );
  } else {
    db.prepare(`
      UPDATE playlists 
      SET name = ?, playlist_url = ?, epg_url = ?, is_protected = ?, pin = ?, updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `).run(
      name || playlist.name,
      playlist_url || playlist.playlist_url,
      epg_url,
      is_protected ? 1 : 0,
      is_protected ? (pin || playlist.pin) : null,
      id
    );
  }

  res.json({
    success: true,
    message: 'Playlist mise à jour'
  });
});

/**
 * Delete Playlist
 * DELETE /api/portal/playlists/:id
 */
router.delete('/playlists/:id', (req, res) => {
  const { id } = req.params;
  const { mac_address, device_key, unlock_pin } = req.body;

  // Validate auth
  if (!mac_address || !device_key) {
    return res.status(401).json({ error: 'Non autorisé' });
  }

  // Normalize MAC
  const normalizedMac = mac_address.toUpperCase().replace(/[^A-F0-9]/g, '');
  const formattedMac = normalizedMac.match(/.{2}/g).join(':');

  // Find device
  const device = db.prepare('SELECT * FROM devices WHERE mac_address = ? AND device_key = ?')
    .get(formattedMac, device_key);

  if (!device) {
    return res.status(401).json({ error: 'Non autorisé' });
  }

  // Find playlist
  const playlist = db.prepare('SELECT * FROM playlists WHERE id = ? AND device_id = ?')
    .get(id, device.id);

  if (!playlist) {
    return res.status(404).json({ error: 'Playlist non trouvée' });
  }

  // Check PIN if protected
  if (playlist.is_protected && playlist.pin !== unlock_pin) {
    return res.status(403).json({ error: 'PIN incorrect' });
  }

  // Delete playlist
  db.prepare('DELETE FROM playlists WHERE id = ?').run(id);

  res.json({
    success: true,
    message: 'Playlist supprimée'
  });
});

/**
 * Get playlist details (for editing)
 * POST /api/portal/playlists/:id/unlock
 */
router.post('/playlists/:id/unlock', (req, res) => {
  const { id } = req.params;
  const { mac_address, device_key, pin } = req.body;

  // Validate auth
  if (!mac_address || !device_key) {
    return res.status(401).json({ error: 'Non autorisé' });
  }

  // Normalize MAC
  const normalizedMac = mac_address.toUpperCase().replace(/[^A-F0-9]/g, '');
  const formattedMac = normalizedMac.match(/.{2}/g).join(':');

  // Find device
  const device = db.prepare('SELECT * FROM devices WHERE mac_address = ? AND device_key = ?')
    .get(formattedMac, device_key);

  if (!device) {
    return res.status(401).json({ error: 'Non autorisé' });
  }

  // Find playlist
  const playlist = db.prepare('SELECT * FROM playlists WHERE id = ? AND device_id = ?')
    .get(id, device.id);

  if (!playlist) {
    return res.status(404).json({ error: 'Playlist non trouvée' });
  }

  // Check PIN if protected
  if (playlist.is_protected && playlist.pin !== pin) {
    return res.status(403).json({ error: 'PIN incorrect' });
  }

  // Return full playlist details
  res.json({
    id: playlist.id,
    name: playlist.name,
    playlist_type: playlist.playlist_type,
    playlist_url: playlist.playlist_url,
    xtream_host: playlist.xtream_host,
    xtream_username: playlist.xtream_username,
    xtream_password: playlist.xtream_password,
    epg_url: playlist.epg_url,
    is_protected: playlist.is_protected === 1,
    pin: playlist.pin
  });
});

// Helper functions
function generateCaptchaId() {
  return Math.random().toString(36).substring(2, 15);
}

function generateCaptchaCode() {
  const chars = '0123456789';
  let code = '';
  for (let i = 0; i < 4; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return code;
}

function generateCaptchaImage(code) {
  // Generate SVG captcha image
  const colors = ['#FF6B6B', '#4ECDC4', '#45B7D1', '#96CEB4', '#FFEAA7'];
  const bgColor = '#1a1a2e';
  
  let svg = `<svg xmlns="http://www.w3.org/2000/svg" width="150" height="60" viewBox="0 0 150 60">`;
  svg += `<rect width="150" height="60" fill="${bgColor}"/>`;
  
  // Add noise lines
  for (let i = 0; i < 5; i++) {
    const x1 = Math.random() * 150;
    const y1 = Math.random() * 60;
    const x2 = Math.random() * 150;
    const y2 = Math.random() * 60;
    const color = colors[Math.floor(Math.random() * colors.length)];
    svg += `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="${color}" stroke-width="1" opacity="0.3"/>`;
  }
  
  // Add characters
  for (let i = 0; i < code.length; i++) {
    const x = 25 + i * 30;
    const y = 35 + Math.random() * 10 - 5;
    const rotation = Math.random() * 30 - 15;
    const color = colors[Math.floor(Math.random() * colors.length)];
    svg += `<text x="${x}" y="${y}" font-family="Arial, sans-serif" font-size="28" font-weight="bold" fill="${color}" transform="rotate(${rotation} ${x} ${y})">${code[i]}</text>`;
  }
  
  svg += `</svg>`;
  
  return `data:image/svg+xml;base64,${Buffer.from(svg).toString('base64')}`;
}

function generateSessionToken() {
  return Math.random().toString(36).substring(2) + Math.random().toString(36).substring(2);
}

function cleanupExpiredCaptchas() {
  const now = Date.now();
  for (const [id, captcha] of captchaStore.entries()) {
    if (captcha.expires < now) {
      captchaStore.delete(id);
    }
  }
}

module.exports = router;

