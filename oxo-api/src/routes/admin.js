const express = require('express');
const bcrypt = require('bcryptjs');
const { db, usePostgres } = require('../database');
const { verifyToken, isAdmin } = require('../middleware/auth');

const router = express.Router();

// All routes require admin authentication
router.use(verifyToken, isAdmin);

// Dashboard stats
router.get('/dashboard', async (req, res) => {
  const totalResellersRow = await db.prepare('SELECT COUNT(*) as count FROM resellers').get();
  const activeResellersRow = await db.prepare("SELECT COUNT(*) as count FROM resellers WHERE status = 'active'").get();
  const totalDevicesRow = await db.prepare('SELECT COUNT(*) as count FROM devices').get();
  const activeDevicesRow = await db.prepare("SELECT COUNT(*) as count FROM devices WHERE status = 'active'").get();
  const trialDevicesRow = await db.prepare("SELECT COUNT(*) as count FROM devices WHERE status = 'trial'").get();
  const totalCreditsGivenRow = await db.prepare("SELECT COALESCE(SUM(amount), 0) as total FROM transactions WHERE type = 'credit_add'").get();
  const totalCreditsUsedRow = await db.prepare("SELECT COALESCE(SUM(amount), 0) as total FROM transactions WHERE type = 'activation'").get();

  const totalResellers = Number(totalResellersRow?.count || 0);
  const activeResellers = Number(activeResellersRow?.count || 0);
  const totalDevices = Number(totalDevicesRow?.count || 0);
  const activeDevices = Number(activeDevicesRow?.count || 0);
  const trialDevices = Number(trialDevicesRow?.count || 0);
  const totalCreditsGiven = Number(totalCreditsGivenRow?.total || 0);
  const totalCreditsUsed = Number(totalCreditsUsedRow?.total || 0);

  // Recent activations
  const recentActivations = await db.prepare(`
    SELECT d.mac_address, d.activation_date, r.name as reseller_name
    FROM devices d
    LEFT JOIN resellers r ON d.reseller_id = r.id
    WHERE d.status = 'active'
    ORDER BY d.activation_date DESC
    LIMIT 10
  `).all();

  res.json({
    stats: {
      totalResellers,
      activeResellers,
      totalDevices,
      activeDevices,
      trialDevices,
      totalCreditsGiven,
      totalCreditsUsed
    },
    recentActivations
  });
});

// List all resellers (only main resellers, not sub-resellers)
router.get('/resellers', async (req, res) => {
  const isSubresellerFalse = usePostgres ? 'FALSE' : '0';
  const resellers = await db.prepare(`
    SELECT r.*, 
           (SELECT COUNT(*) FROM devices WHERE reseller_id = r.id) as device_count,
           (SELECT COUNT(*) FROM devices WHERE reseller_id = r.id AND status = 'active') as active_devices,
           (SELECT COUNT(*) FROM resellers WHERE parent_reseller_id = r.id) as subreseller_count
    FROM resellers r
    WHERE r.is_subreseller = ${isSubresellerFalse} OR r.is_subreseller IS NULL
    ORDER BY r.created_at DESC
  `).all();

  res.json(resellers.map(r => ({
    ...r,
    password: undefined,
    can_create_subresellers: usePostgres ? r.can_create_subresellers : !!r.can_create_subresellers
  })));
});

// Create reseller
router.post('/resellers', async (req, res) => {
  const { email, password, name, credits, allow_cross_reseller_activation, can_create_subresellers } = req.body;

  if (!email || !password || !name) {
    return res.status(400).json({ error: 'Email, mot de passe et nom requis' });
  }

  const existingReseller = await db.prepare('SELECT id FROM resellers WHERE email = ?').get(email);
  if (existingReseller) {
    return res.status(400).json({ error: 'Cet email existe déjà' });
  }

  const hashedPassword = bcrypt.hashSync(password, 10);
  const initialCredits = credits || 0;
  const allowCross = !!allow_cross_reseller_activation;
  const canCreateSub = !!can_create_subresellers;

  const result = await db.prepare(`
    INSERT INTO resellers (email, password, name, credits, created_by, allow_cross_reseller_activation, can_create_subresellers, is_subreseller)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    email,
    hashedPassword,
    name,
    initialCredits,
    req.user.id,
    usePostgres ? allowCross : (allowCross ? 1 : 0),
    usePostgres ? canCreateSub : (canCreateSub ? 1 : 0),
    usePostgres ? false : 0
  );

  const newResellerId = Number(result?.lastInsertRowid || 0);

  // Log transaction if credits given
  if (initialCredits > 0) {
    await db.prepare(`
      INSERT INTO transactions (reseller_id, admin_id, type, amount, description)
      VALUES (?, ?, 'credit_add', ?, 'Crédits initiaux')
    `).run(newResellerId, req.user.id, initialCredits);
  }

  res.json({
    id: newResellerId,
    email,
    name,
    credits: initialCredits,
    can_create_subresellers: canCreateSub,
    message: 'Revendeur créé avec succès'
  });
});

// Update reseller
router.put('/resellers/:id', async (req, res) => {
  const { id } = req.params;
  const { name, status, password, allow_cross_reseller_activation, can_create_subresellers } = req.body;

  const reseller = await db.prepare('SELECT * FROM resellers WHERE id = ?').get(id);
  if (!reseller) {
    return res.status(404).json({ error: 'Revendeur non trouvé' });
  }

  if (password) {
    const hashedPassword = bcrypt.hashSync(password, 10);
    await db.prepare('UPDATE resellers SET password = ? WHERE id = ?').run(hashedPassword, id);
  }

  if (name) {
    await db.prepare('UPDATE resellers SET name = ? WHERE id = ?').run(name, id);
  }

  if (status) {
    await db.prepare('UPDATE resellers SET status = ? WHERE id = ?').run(status, id);
  }

  if (allow_cross_reseller_activation !== undefined) {
    const flagValue = usePostgres ? !!allow_cross_reseller_activation : (allow_cross_reseller_activation ? 1 : 0);
    await db.prepare('UPDATE resellers SET allow_cross_reseller_activation = ? WHERE id = ?').run(flagValue, id);
  }

  if (can_create_subresellers !== undefined) {
    const flagValue = usePostgres ? !!can_create_subresellers : (can_create_subresellers ? 1 : 0);
    await db.prepare('UPDATE resellers SET can_create_subresellers = ? WHERE id = ?').run(flagValue, id);
  }

  res.json({ message: 'Revendeur mis à jour' });
});

// Add or remove credits from reseller
router.post('/resellers/:id/credits', async (req, res) => {
  const { id } = req.params;
  const { amount, description } = req.body;

  if (amount === undefined || amount === 0) {
    return res.status(400).json({ error: 'Montant invalide' });
  }

  const reseller = await db.prepare('SELECT * FROM resellers WHERE id = ?').get(id);
  if (!reseller) {
    return res.status(404).json({ error: 'Revendeur non trouvé' });
  }

  // Si retrait, vérifier que le solde est suffisant
  if (amount < 0 && reseller.credits + amount < 0) {
    return res.status(400).json({ error: 'Solde insuffisant pour ce retrait' });
  }

  await db.prepare('UPDATE resellers SET credits = credits + ? WHERE id = ?').run(amount, id);

  const transactionType = amount > 0 ? 'credit_add' : 'credit_remove';
  const defaultDesc = amount > 0 ? 'Ajout de crédits' : 'Retrait de crédits';

  await db.prepare(`
    INSERT INTO transactions (reseller_id, admin_id, type, amount, description)
    VALUES (?, ?, ?, ?, ?)
  `).run(id, req.user.id, transactionType, Math.abs(amount), description || defaultDesc);

  const updatedReseller = await db.prepare('SELECT credits FROM resellers WHERE id = ?').get(id);

  const message = amount > 0 ? `${amount} crédits ajoutés` : `${Math.abs(amount)} crédits retirés`;
  res.json({
    message,
    newBalance: updatedReseller.credits
  });
});

// Delete reseller
router.delete('/resellers/:id', async (req, res) => {
  const { id } = req.params;

  const reseller = await db.prepare('SELECT * FROM resellers WHERE id = ?').get(id);
  if (!reseller) {
    return res.status(404).json({ error: 'Revendeur non trouvé' });
  }

  // Get all sub-resellers
  const subResellers = await db.prepare('SELECT id FROM resellers WHERE parent_reseller_id = ?').all(id);
  
  // Remove devices from sub-resellers and delete them
  for (const sub of subResellers) {
    await db.prepare('UPDATE devices SET reseller_id = NULL WHERE reseller_id = ?').run(sub.id);
    await db.prepare('DELETE FROM resellers WHERE id = ?').run(sub.id);
  }

  // Remove reseller's devices assignment
  await db.prepare('UPDATE devices SET reseller_id = NULL WHERE reseller_id = ?').run(id);
  
  // Delete reseller
  await db.prepare('DELETE FROM resellers WHERE id = ?').run(id);

  res.json({ message: 'Revendeur supprimé' });
});

// List all devices
router.get('/devices', async (req, res) => {
  const devices = await db.prepare(`
    SELECT d.*, r.name as reseller_name, r.email as reseller_email
    FROM devices d
    LEFT JOIN resellers r ON d.reseller_id = r.id
    ORDER BY d.created_at DESC
  `).all();

  res.json(devices);
});

// Update device status (disable/enable)
router.put('/devices/:id/status', async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body;
    
    // Validate status
    const validStatuses = ['active', 'trial', 'expired', 'disabled'];
    if (!validStatuses.includes(status)) {
      return res.status(400).json({ error: 'Statut invalide' });
    }
    
    // Check if device exists
    const device = await db.prepare('SELECT * FROM devices WHERE id = ?').get(id);
    if (!device) {
      return res.status(404).json({ error: 'Appareil non trouvé' });
    }
    
    // Update status
    await db.prepare('UPDATE devices SET status = ? WHERE id = ?').run(status, id);
    
    res.json({ 
      success: true, 
      message: `Statut mis à jour: ${status}`,
      device_id: id,
      new_status: status
    });
    
  } catch (error) {
    console.error('Error updating device status:', error);
    res.status(500).json({ error: 'Erreur lors de la mise à jour du statut' });
  }
});

// Transaction history
router.get('/transactions', async (req, res) => {
  const transactions = await db.prepare(`
    SELECT t.*, 
           r.name as reseller_name, 
           r.email as reseller_email,
           fr.name as from_reseller_name,
           fr.email as from_reseller_email
    FROM transactions t
    LEFT JOIN resellers r ON t.reseller_id = r.id
    LEFT JOIN resellers fr ON t.from_reseller_id = fr.id
    ORDER BY t.created_at DESC
    LIMIT 100
  `).all();

  res.json(transactions);
});

// =====================================================
// SELLER CONTACTS (Public reseller list for portal)
// =====================================================

// List all seller contacts
router.get('/seller-contacts', async (req, res) => {
  const sellers = await db.prepare(`
    SELECT * FROM seller_contacts
    ORDER BY city ASC, name ASC
  `).all();

  res.json(sellers);
});

// Add seller contact
router.post('/seller-contacts', async (req, res) => {
  const { name, city, phone, email, address } = req.body;

  if (!name || !city || !phone) {
    return res.status(400).json({ error: 'Nom, ville et téléphone sont requis' });
  }

  try {
    const result = await db.prepare(`
      INSERT INTO seller_contacts (name, city, phone, email, address)
      VALUES (?, ?, ?, ?, ?)
    `).run(name, city, phone, email || null, address || null);

    const sellerId = Number(result?.lastInsertRowid || 0);
    const seller = await db.prepare('SELECT * FROM seller_contacts WHERE id = ?').get(sellerId);
    res.status(201).json(seller);
  } catch (error) {
    console.error('Error adding seller contact:', error);
    res.status(500).json({ error: 'Erreur lors de l\'ajout' });
  }
});

// Update seller contact
router.put('/seller-contacts/:id', async (req, res) => {
  const { id } = req.params;
  const { name, city, phone, email, address, is_active } = req.body;

  const seller = await db.prepare('SELECT * FROM seller_contacts WHERE id = ?').get(id);
  if (!seller) {
    return res.status(404).json({ error: 'Revendeur non trouvé' });
  }

  try {
    await db.prepare(`
      UPDATE seller_contacts 
      SET name = ?, city = ?, phone = ?, email = ?, address = ?, is_active = ?, updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `).run(
      name || seller.name,
      city || seller.city,
      phone || seller.phone,
      email !== undefined ? email : seller.email,
      address !== undefined ? address : seller.address,
      is_active !== undefined ? (is_active ? 1 : 0) : seller.is_active,
      id
    );

    const updated = await db.prepare('SELECT * FROM seller_contacts WHERE id = ?').get(id);
    res.json(updated);
  } catch (error) {
    console.error('Error updating seller contact:', error);
    res.status(500).json({ error: 'Erreur lors de la mise à jour' });
  }
});

// Delete seller contact
router.delete('/seller-contacts/:id', async (req, res) => {
  const { id } = req.params;

  const seller = await db.prepare('SELECT * FROM seller_contacts WHERE id = ?').get(id);
  if (!seller) {
    return res.status(404).json({ error: 'Revendeur non trouvé' });
  }

  await db.prepare('DELETE FROM seller_contacts WHERE id = ?').run(id);
  res.json({ success: true, message: 'Revendeur supprimé' });
});

// =====================================================
// SELLER REQUESTS (People wanting to become resellers)
// =====================================================

// List all seller requests
router.get('/seller-requests', async (req, res) => {
  const requests = await db.prepare(`
    SELECT * FROM seller_requests
    ORDER BY 
      CASE status 
        WHEN 'pending' THEN 1 
        WHEN 'contacted' THEN 2 
        WHEN 'approved' THEN 3 
        WHEN 'rejected' THEN 4 
      END,
      created_at DESC
  `).all();

  res.json(requests);
});

// Update seller request status
router.put('/seller-requests/:id', async (req, res) => {
  const { id } = req.params;
  const { status } = req.body;

  const request = await db.prepare('SELECT * FROM seller_requests WHERE id = ?').get(id);
  if (!request) {
    return res.status(404).json({ error: 'Demande non trouvée' });
  }

  const validStatuses = ['pending', 'contacted', 'approved', 'rejected'];
  if (status && !validStatuses.includes(status)) {
    return res.status(400).json({ error: 'Statut invalide' });
  }

  await db.prepare('UPDATE seller_requests SET status = ? WHERE id = ?').run(status, id);

  const updated = await db.prepare('SELECT * FROM seller_requests WHERE id = ?').get(id);
  res.json(updated);
});

// Delete seller request
router.delete('/seller-requests/:id', async (req, res) => {
  const { id } = req.params;

  const request = await db.prepare('SELECT * FROM seller_requests WHERE id = ?').get(id);
  if (!request) {
    return res.status(404).json({ error: 'Demande non trouvée' });
  }

  await db.prepare('DELETE FROM seller_requests WHERE id = ?').run(id);
  res.json({ success: true, message: 'Demande supprimée' });
});

// Get seller requests count (for dashboard badge)
router.get('/seller-requests/count', async (req, res) => {
  const countRow = await db.prepare("SELECT COUNT(*) as count FROM seller_requests WHERE status = 'pending'").get();
  res.json({ pending: Number(countRow?.count || 0) });
});

// =====================================================
// XTREAM HOSTS (For Top 10 service)
// =====================================================

// List all Xtream hosts
router.get('/xtream-hosts', async (req, res) => {
  try {
    const hosts = await db.prepare(`
      SELECT h.id, h.host, h.name, h.test_username, h.is_active, h.last_top10_update, h.created_at,
             (SELECT COUNT(*) FROM top10_cache WHERE host_id = h.id AND type = 'movies') as movies_count,
             (SELECT COUNT(*) FROM top10_cache WHERE host_id = h.id AND type = 'series') as series_count
      FROM xtream_hosts h
      ORDER BY h.created_at DESC
    `).all();

    res.json(hosts.map(h => ({
      ...h,
      is_active: usePostgres ? h.is_active : !!h.is_active
    })));
  } catch (error) {
    console.error('Error fetching Xtream hosts:', error);
    res.status(500).json({ error: 'Failed to fetch hosts' });
  }
});

// Add new Xtream host
router.post('/xtream-hosts', async (req, res) => {
  const { host, name, test_username, test_password } = req.body;

  if (!host) {
    return res.status(400).json({ error: 'Host is required' });
  }

  // Normalize host
  let normalizedHost = host.trim()
    .replace(/^https?:\/\//, '')
    .replace(/\/$/, '')
    .toLowerCase();

  try {
    // Check if host already exists
    const existingHost = await db.prepare('SELECT id FROM xtream_hosts WHERE LOWER(host) = ?').get(normalizedHost);
    if (existingHost) {
      return res.status(400).json({ error: 'Ce host existe déjà' });
    }

    const result = await db.prepare(`
      INSERT INTO xtream_hosts (host, name, test_username, test_password, is_active)
      VALUES (?, ?, ?, ?, ?)
    `).run(normalizedHost, name || normalizedHost.split('.')[0].toUpperCase(), test_username || null, test_password || null, usePostgres ? true : 1);

    const newHostId = Number(result?.lastInsertRowid || 0);
    const newHost = await db.prepare('SELECT * FROM xtream_hosts WHERE id = ?').get(newHostId);

    console.log(`✅ Admin created new Xtream host: ${normalizedHost}`);
    res.status(201).json(newHost);
  } catch (error) {
    console.error('Error adding Xtream host:', error);
    res.status(500).json({ error: 'Failed to add host' });
  }
});

// Update Xtream host
router.put('/xtream-hosts/:id', async (req, res) => {
  const { id } = req.params;
  const { name, test_username, test_password, is_active } = req.body;

  const host = await db.prepare('SELECT * FROM xtream_hosts WHERE id = ?').get(id);
  if (!host) {
    return res.status(404).json({ error: 'Host non trouvé' });
  }

  try {
    await db.prepare(`
      UPDATE xtream_hosts 
      SET name = ?, test_username = ?, test_password = ?, is_active = ?
      WHERE id = ?
    `).run(
      name !== undefined ? name : host.name,
      test_username !== undefined ? test_username : host.test_username,
      test_password !== undefined ? test_password : host.test_password,
      is_active !== undefined ? (usePostgres ? is_active : (is_active ? 1 : 0)) : host.is_active,
      id
    );

    const updated = await db.prepare('SELECT * FROM xtream_hosts WHERE id = ?').get(id);
    res.json(updated);
  } catch (error) {
    console.error('Error updating Xtream host:', error);
    res.status(500).json({ error: 'Failed to update host' });
  }
});

// Delete Xtream host
router.delete('/xtream-hosts/:id', async (req, res) => {
  const { id } = req.params;

  const host = await db.prepare('SELECT * FROM xtream_hosts WHERE id = ?').get(id);
  if (!host) {
    return res.status(404).json({ error: 'Host non trouvé' });
  }

  try {
    // Delete cached Top 10 data
    await db.prepare('DELETE FROM top10_cache WHERE host_id = ?').run(id);
    // Delete host
    await db.prepare('DELETE FROM xtream_hosts WHERE id = ?').run(id);

    console.log(`🗑️ Admin deleted Xtream host: ${host.host}`);
    res.json({ success: true, message: 'Host supprimé' });
  } catch (error) {
    console.error('Error deleting Xtream host:', error);
    res.status(500).json({ error: 'Failed to delete host' });
  }
});

// Refresh Top 10 for a specific host (manual trigger - REAL GENERATION)
router.post('/xtream-hosts/:id/refresh', async (req, res) => {
  const { id } = req.params;

  const host = await db.prepare('SELECT * FROM xtream_hosts WHERE id = ?').get(id);
  if (!host) {
    return res.status(404).json({ error: 'Host non trouvé' });
  }

  if (!host.test_username || !host.test_password) {
    return res.status(400).json({ error: 'Credentials de test manquants pour ce host' });
  }

  try {
    console.log(`🔄 Admin requested Top 10 refresh for: ${host.host}`);
    
    // Generate Top 10 directly (inline implementation)
    const result = await generateTop10ForHost(host);
    
    res.json({ 
      success: true, 
      message: `Top 10 généré: ${result.moviesCount} films, ${result.seriesCount} séries`,
      movies_count: result.moviesCount,
      series_count: result.seriesCount
    });
  } catch (error) {
    console.error('Error generating Top 10:', error);
    res.status(500).json({ error: 'Failed to generate Top 10: ' + error.message });
  }
});

// Generate Top 10 for ALL hosts
router.post('/xtream-hosts/refresh-all', async (req, res) => {
  try {
    const isActiveTrue = usePostgres ? 'TRUE' : '1';
    const hosts = await db.prepare(`
      SELECT * FROM xtream_hosts 
      WHERE is_active = ${isActiveTrue} 
        AND test_username IS NOT NULL 
        AND test_password IS NOT NULL
    `).all();
    
    console.log(`🔄 Admin requested Top 10 refresh for ALL ${hosts.length} hosts`);
    
    const results = [];
    for (const host of hosts) {
      try {
        const result = await generateTop10ForHost(host);
        results.push({ host: host.host, success: true, ...result });
      } catch (e) {
        results.push({ host: host.host, success: false, error: e.message });
      }
    }
    
    res.json({ 
      success: true, 
      message: `Top 10 généré pour ${results.filter(r => r.success).length}/${hosts.length} hosts`,
      results
    });
  } catch (error) {
    console.error('Error generating Top 10 for all hosts:', error);
    res.status(500).json({ error: 'Failed to generate Top 10' });
  }
});

// Helper: Generate Top 10 for a single host
async function generateTop10ForHost(host) {
  const https = require('https');
  const http = require('http');
  
  const TMDB_API_KEY = process.env.TMDB_API_KEY || '5b6e64dafb1dbdf34e8907bc1a0417d0';
  
  // Fetch JSON helper
  const fetchJson = (url) => new Promise((resolve, reject) => {
    const protocol = url.startsWith('https') ? https : http;
    const req = protocol.get(url, { timeout: 30000 }, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try { resolve(JSON.parse(data)); } 
        catch (e) { reject(new Error('Invalid JSON')); }
      });
    });
    req.on('error', reject);
    req.on('timeout', () => { req.destroy(); reject(new Error('Timeout')); });
  });
  
  // Get TMDB trending
  console.log(`📥 Fetching TMDB trending...`);
  const tmdbMovies = [];
  const tmdbSeries = [];
  
  for (let page = 1; page <= 2; page++) {
    try {
      const moviesResp = await fetchJson(`https://api.themoviedb.org/3/movie/popular?api_key=${TMDB_API_KEY}&language=fr-FR&page=${page}`);
      if (moviesResp.results) tmdbMovies.push(...moviesResp.results);
    } catch (e) { console.log('TMDB movies error:', e.message); }
    
    try {
      const seriesResp = await fetchJson(`https://api.themoviedb.org/3/tv/popular?api_key=${TMDB_API_KEY}&language=fr-FR&page=${page}`);
      if (seriesResp.results) tmdbSeries.push(...seriesResp.results);
    } catch (e) { console.log('TMDB series error:', e.message); }
  }
  
  console.log(`✅ TMDB: ${tmdbMovies.length} movies, ${tmdbSeries.length} series`);
  
  // Get Xtream catalog
  const baseUrl = host.host.startsWith('http') ? host.host : `http://${host.host}`;
  console.log(`📥 Fetching Xtream catalog from ${host.host}...`);
  
  const xtreamMovies = [];
  const xtreamSeries = [];
  
  try {
    // Get VOD categories and movies - prioritize FR categories
    const vodCats = await fetchJson(`${baseUrl}/player_api.php?username=${host.test_username}&password=${host.test_password}&action=get_vod_categories`);
    if (Array.isArray(vodCats)) {
      // Sort categories to prioritize FR|, then others
      const sortedCats = vodCats.sort((a, b) => {
        const aFR = a.category_name?.toUpperCase().includes('FR') ? 0 : 1;
        const bFR = b.category_name?.toUpperCase().includes('FR') ? 0 : 1;
        return aFR - bFR;
      });
      // Load more categories (up to 30) to cover more content
      for (const cat of sortedCats.slice(0, 30)) {
        try {
          const movies = await fetchJson(`${baseUrl}/player_api.php?username=${host.test_username}&password=${host.test_password}&action=get_vod_streams&category_id=${cat.category_id}`);
          if (Array.isArray(movies)) xtreamMovies.push(...movies);
        } catch (e) {}
      }
    }
    
    // Get series categories and series - prioritize FR categories
    const seriesCats = await fetchJson(`${baseUrl}/player_api.php?username=${host.test_username}&password=${host.test_password}&action=get_series_categories`);
    if (Array.isArray(seriesCats)) {
      // Sort categories to prioritize FR|, then others
      const sortedCats = seriesCats.sort((a, b) => {
        const aFR = a.category_name?.toUpperCase().includes('FR') ? 0 : 1;
        const bFR = b.category_name?.toUpperCase().includes('FR') ? 0 : 1;
        return aFR - bFR;
      });
      // Load more categories (up to 30) to cover more content
      for (const cat of sortedCats.slice(0, 30)) {
        try {
          const series = await fetchJson(`${baseUrl}/player_api.php?username=${host.test_username}&password=${host.test_password}&action=get_series&category_id=${cat.category_id}`);
          if (Array.isArray(series)) xtreamSeries.push(...series);
        } catch (e) {}
      }
    }
  } catch (e) {
    console.log('Xtream catalog error:', e.message);
  }
  
  console.log(`✅ Xtream: ${xtreamMovies.length} movies, ${xtreamSeries.length} series`);
  
  // Normalize title helper - handles all provider formats
  const normalizeTitle = (title) => {
    if (!title) return '';
    return title.toLowerCase()
      // Remove language prefixes: "FR|", "EN|", "VF|", "VOSTFR|", "MULTI|", etc.
      .replace(/^(fr|en|es|de|it|pt|ar|nl|vf|vo|vostfr|multi)\s*\|\s*/gi, '')
      // Remove country codes at end: (US), (FR), (KR), (UK), etc.
      .replace(/\s*\((us|uk|fr|de|es|it|kr|jp|cn|ar|nl|be|ca|au|multi)\)\s*$/gi, '')
      // Remove quality tags: (4K), (HD), (CAM), etc.
      .replace(/\s*\((4k|hd|sd|cam|ts|r5|dvdrip|bdrip|webrip|bluray)\)\s*/gi, '')
      // Remove year at end (we extract it separately)
      .replace(/\s*\(\d{4}\)\s*$/, '')
      // Remove season/episode info: S01, E01, Season 1, etc.
      .replace(/\s*(s\d+|e\d+|season\s*\d+|saison\s*\d+)\s*/gi, '')
      // Normalize accents
      .replace(/[àáâãäå]/g, 'a').replace(/[èéêë]/g, 'e')
      .replace(/[ìíîï]/g, 'i').replace(/[òóôõö]/g, 'o')
      .replace(/[ùúûü]/g, 'u').replace(/[ç]/g, 'c').replace(/[ñ]/g, 'n')
      // Remove all non-alphanumeric
      .replace(/[^a-z0-9]/g, '')
      .trim();
  };
  
  const extractYear = (title) => {
    // Try to find year in format (2024) or (2024) anywhere in title
    const match = title?.match(/\((\d{4})\)/);
    return match ? match[1] : null;
  };
  
  // Match movies - build index with both year and title-only
  const movieIndexByYear = new Map();
  const movieIndexByTitle = new Map();
  // Keep array for partial matching
  const moviesWithNorms = [];
  for (const m of xtreamMovies) {
    if (!m.name) continue;
    const norm = normalizeTitle(m.name);
    const year = extractYear(m.name);
    if (norm.length >= 3) {
      if (year) movieIndexByYear.set(`${norm}_${year}`, m);
      // Also index by title only (for fallback matching)
      if (!movieIndexByTitle.has(norm)) {
        movieIndexByTitle.set(norm, m);
      }
      moviesWithNorms.push({ movie: m, norm });
    }
  }
  
  // Helper for partial matching - find if TMDB title is contained in Xtream title
  const findPartialMovieMatch = (tmdbNorm) => {
    if (tmdbNorm.length < 4) return null; // Avoid too short matches
    for (const { movie, norm } of moviesWithNorms) {
      if (norm.includes(tmdbNorm)) return movie;
    }
    return null;
  };
  
  const matchedMovies = [];
  let rank = 1;
  for (const tmdb of tmdbMovies) {
    if (rank > 10) break;
    const normFr = normalizeTitle(tmdb.title);
    const normEn = normalizeTitle(tmdb.original_title);
    const year = tmdb.release_date?.substring(0, 4);
    
    // Try exact match with year (French title)
    let match = movieIndexByYear.get(`${normFr}_${year}`);
    // Try exact match with year (English/Original title)
    if (!match) match = movieIndexByYear.get(`${normEn}_${year}`);
    // Fallback: try title only (French)
    if (!match) match = movieIndexByTitle.get(normFr);
    // Fallback: try title only (English)
    if (!match) match = movieIndexByTitle.get(normEn);
    // Fallback: partial match (TMDB title contained in Xtream title)
    if (!match) match = findPartialMovieMatch(normFr);
    if (!match) match = findPartialMovieMatch(normEn);
    
    if (match) {
      matchedMovies.push({
        rank: rank++,
        title: `${tmdb.title} (${year || ''})`,
        posterUrl: tmdb.poster_path ? `https://image.tmdb.org/t/p/w500${tmdb.poster_path}` : null,
        xtreamId: match.stream_id,
        streamIcon: match.stream_icon,
        containerExtension: match.container_extension,
        badge: rank <= 4 ? 'Tendance' : null,
        tmdbId: tmdb.id
      });
    }
  }
  
  // Match series - build index with both year and title-only
  const seriesIndexByYear = new Map();
  const seriesIndexByTitle = new Map();
  // Keep array for partial matching (when title is contained in Xtream name)
  const seriesWithNorms = [];
  for (const s of xtreamSeries) {
    if (!s.name) continue;
    const norm = normalizeTitle(s.name);
    const year = extractYear(s.name);
    if (norm.length >= 3) {
      if (year) seriesIndexByYear.set(`${norm}_${year}`, s);
      // Also index by title only (for fallback matching)
      if (!seriesIndexByTitle.has(norm)) {
        seriesIndexByTitle.set(norm, s);
      }
      seriesWithNorms.push({ series: s, norm });
    }
  }
  
  // Helper for partial matching - find if TMDB title is contained in Xtream title
  const findPartialMatch = (tmdbNorm) => {
    if (tmdbNorm.length < 4) return null; // Avoid too short matches
    for (const { series, norm } of seriesWithNorms) {
      if (norm.includes(tmdbNorm)) return series;
    }
    return null;
  };
  
  const matchedSeries = [];
  rank = 1;
  for (const tmdb of tmdbSeries) {
    if (rank > 10) break;
    const normFr = normalizeTitle(tmdb.name);
    const normEn = normalizeTitle(tmdb.original_name);
    const year = tmdb.first_air_date?.substring(0, 4);
    
    // Try exact match with year (French title)
    let match = seriesIndexByYear.get(`${normFr}_${year}`);
    // Try exact match with year (English/Original title)
    if (!match) match = seriesIndexByYear.get(`${normEn}_${year}`);
    // Fallback: try title only (French)
    if (!match) match = seriesIndexByTitle.get(normFr);
    // Fallback: try title only (English)
    if (!match) match = seriesIndexByTitle.get(normEn);
    // Fallback: partial match (TMDB title contained in Xtream title)
    if (!match) match = findPartialMatch(normFr);
    if (!match) match = findPartialMatch(normEn);
    
    if (match) {
      matchedSeries.push({
        rank: rank++,
        title: `${tmdb.name} (${year || ''})`,
        posterUrl: tmdb.poster_path ? `https://image.tmdb.org/t/p/w500${tmdb.poster_path}` : null,
        xtreamId: match.series_id,
        cover: match.cover,
        badge: rank <= 4 ? 'Tendance' : null,
        tmdbId: tmdb.id
      });
    }
  }
  
  console.log(`✅ Matched: ${matchedMovies.length} movies, ${matchedSeries.length} series`);
  
  // Save to cache
  await db.prepare('DELETE FROM top10_cache WHERE host_id = ?').run(host.id);
  
  for (const m of matchedMovies) {
    await db.prepare(`
      INSERT INTO top10_cache (host_id, type, rank, title, poster_url, xtream_id, stream_icon, container_extension, badge, tmdb_id, updated_at)
      VALUES (?, 'movies', ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
    `).run(host.id, m.rank, m.title, m.posterUrl, m.xtreamId, m.streamIcon, m.containerExtension, m.badge, m.tmdbId);
  }
  
  for (const s of matchedSeries) {
    await db.prepare(`
      INSERT INTO top10_cache (host_id, type, rank, title, poster_url, xtream_id, cover, badge, tmdb_id, updated_at)
      VALUES (?, 'series', ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
    `).run(host.id, s.rank, s.title, s.posterUrl, s.xtreamId, s.cover, s.badge, s.tmdbId);
  }
  
  await db.prepare('UPDATE xtream_hosts SET last_top10_update = CURRENT_TIMESTAMP WHERE id = ?').run(host.id);
  
  console.log(`✅ Saved Top 10 for ${host.host}`);
  
  return { moviesCount: matchedMovies.length, seriesCount: matchedSeries.length };
}

module.exports = router;



















