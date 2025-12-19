const express = require('express');
const path = require('path');
const fs = require('fs');
const { db } = require('../database');

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
    // Create new device with trial period
    const trialEnd = new Date();
    trialEnd.setDate(trialEnd.getDate() + TRIAL_DAYS);

    db.prepare(`
      INSERT INTO devices (mac_address, status, trial_start, expiration_date, device_info, last_seen)
      VALUES (?, 'trial', ?, ?, ?, ?)
    `).run(formattedMac, now.toISOString(), trialEnd.toISOString(), device_info || null, now.toISOString());

    device = db.prepare('SELECT * FROM devices WHERE mac_address = ?').get(formattedMac);
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

  res.json({
    mac_address: formattedMac,
    status: device.status,
    trial_start: device.trial_start,
    activation_date: device.activation_date,
    expiration_date: device.expiration_date,
    days_remaining: daysRemaining,
    has_playlist: !!device.playlist_url
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

  // Check if playlist exists
  if (!device.playlist_url) {
    return res.status(404).json({
      error: 'Aucune playlist configurée',
      status: device.status,
      message: 'Aucune playlist n\'a été configurée pour cet appareil. Contactez votre revendeur.'
    });
  }

  // Return playlist info
  res.json({
    mac_address: formattedMac,
    status: device.status,
    playlist_url: device.playlist_url,
    playlist_content: device.playlist_content,
    expiration_date: device.expiration_date
  });
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

  if (!device.playlist_url) {
    return res.status(404).json({ error: 'Aucune playlist configurée' });
  }

  try {
    let content = '';

    // Check if it's a local file (starts with /uploads/)
    if (device.playlist_url.startsWith('/uploads/')) {
      const filePath = path.join(__dirname, '../../', device.playlist_url);
      console.log('Loading local file:', filePath);
      
      if (fs.existsSync(filePath)) {
        content = fs.readFileSync(filePath, 'utf8');
      } else {
        return res.status(404).json({ error: 'Fichier playlist non trouvé' });
      }
    }
    // Check if it's an external URL
    else if (device.playlist_url.startsWith('http://') || device.playlist_url.startsWith('https://')) {
      console.log('Fetching external URL:', device.playlist_url);
      
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 120000); // 120s timeout for large playlists
      
      try {
        const response = await fetch(device.playlist_url, {
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
    else if (device.playlist_content) {
      content = device.playlist_content;
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

// Check device status (quick check for app)
router.get('/status/:mac', (req, res) => {
  const { mac } = req.params;

  // Normalize MAC
  const normalizedMac = mac.toUpperCase().replace(/[^A-F0-9]/g, '');
  if (normalizedMac.length !== 12) {
    return res.status(400).json({ error: 'Format MAC invalide' });
  }

  const formattedMac = normalizedMac.match(/.{2}/g).join(':');

  const device = db.prepare('SELECT status, expiration_date, playlist_url FROM devices WHERE mac_address = ?').get(formattedMac);

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

  res.json({
    registered: true,
    status,
    has_playlist: !!device.playlist_url,
    days_remaining: daysRemaining,
    expiration_date: device.expiration_date
  });
});

module.exports = router;
