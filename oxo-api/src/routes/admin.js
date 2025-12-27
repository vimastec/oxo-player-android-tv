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

// List all resellers
router.get('/resellers', async (req, res) => {
  const resellers = await db.prepare(`
    SELECT r.*, 
           (SELECT COUNT(*) FROM devices WHERE reseller_id = r.id) as device_count,
           (SELECT COUNT(*) FROM devices WHERE reseller_id = r.id AND status = 'active') as active_devices
    FROM resellers r
    ORDER BY r.created_at DESC
  `).all();

  res.json(resellers.map(r => ({
    ...r,
    password: undefined
  })));
});

// Create reseller
router.post('/resellers', async (req, res) => {
  const { email, password, name, credits, allow_cross_reseller_activation } = req.body;

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

  const result = await db.prepare(`
    INSERT INTO resellers (email, password, name, credits, created_by, allow_cross_reseller_activation)
    VALUES (?, ?, ?, ?, ?, ?)
  `).run(
    email,
    hashedPassword,
    name,
    initialCredits,
    req.user.id,
    usePostgres ? allowCross : (allowCross ? 1 : 0)
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
    message: 'Revendeur créé avec succès'
  });
});

// Update reseller
router.put('/resellers/:id', async (req, res) => {
  const { id } = req.params;
  const { name, status, password, allow_cross_reseller_activation } = req.body;

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

  res.json({ message: 'Revendeur mis à jour' });
});

// Add credits to reseller
router.post('/resellers/:id/credits', async (req, res) => {
  const { id } = req.params;
  const { amount, description } = req.body;

  if (!amount || amount <= 0) {
    return res.status(400).json({ error: 'Montant invalide' });
  }

  const reseller = await db.prepare('SELECT * FROM resellers WHERE id = ?').get(id);
  if (!reseller) {
    return res.status(404).json({ error: 'Revendeur non trouvé' });
  }

  await db.prepare('UPDATE resellers SET credits = credits + ? WHERE id = ?').run(amount, id);

  await db.prepare(`
    INSERT INTO transactions (reseller_id, admin_id, type, amount, description)
    VALUES (?, ?, 'credit_add', ?, ?)
  `).run(id, req.user.id, amount, description || 'Ajout de crédits');

  const updatedReseller = await db.prepare('SELECT credits FROM resellers WHERE id = ?').get(id);

  res.json({
    message: `${amount} crédits ajoutés`,
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

// Transaction history
router.get('/transactions', async (req, res) => {
  const transactions = await db.prepare(`
    SELECT t.*, r.name as reseller_name, r.email as reseller_email
    FROM transactions t
    LEFT JOIN resellers r ON t.reseller_id = r.id
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

module.exports = router;



















