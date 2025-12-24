const express = require('express');
const bcrypt = require('bcryptjs');
const { db } = require('../database');
const { verifyToken, isAdmin } = require('../middleware/auth');

const router = express.Router();

// All routes require admin authentication
router.use(verifyToken, isAdmin);

// Dashboard stats
router.get('/dashboard', (req, res) => {
  const totalResellers = db.prepare('SELECT COUNT(*) as count FROM resellers').get().count;
  const activeResellers = db.prepare("SELECT COUNT(*) as count FROM resellers WHERE status = 'active'").get().count;
  const totalDevices = db.prepare('SELECT COUNT(*) as count FROM devices').get().count;
  const activeDevices = db.prepare("SELECT COUNT(*) as count FROM devices WHERE status = 'active'").get().count;
  const trialDevices = db.prepare("SELECT COUNT(*) as count FROM devices WHERE status = 'trial'").get().count;
  const totalCreditsGiven = db.prepare("SELECT COALESCE(SUM(amount), 0) as total FROM transactions WHERE type = 'credit_add'").get().total;
  const totalCreditsUsed = db.prepare("SELECT COALESCE(SUM(amount), 0) as total FROM transactions WHERE type = 'activation'").get().total;

  // Recent activations
  const recentActivations = db.prepare(`
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
router.get('/resellers', (req, res) => {
  const resellers = db.prepare(`
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
router.post('/resellers', (req, res) => {
  const { email, password, name, credits } = req.body;

  if (!email || !password || !name) {
    return res.status(400).json({ error: 'Email, mot de passe et nom requis' });
  }

  const existingReseller = db.prepare('SELECT id FROM resellers WHERE email = ?').get(email);
  if (existingReseller) {
    return res.status(400).json({ error: 'Cet email existe déjà' });
  }

  const hashedPassword = bcrypt.hashSync(password, 10);
  const initialCredits = credits || 0;

  const result = db.prepare(`
    INSERT INTO resellers (email, password, name, credits, created_by)
    VALUES (?, ?, ?, ?, ?)
  `).run(email, hashedPassword, name, initialCredits, req.user.id);

  // Log transaction if credits given
  if (initialCredits > 0) {
    db.prepare(`
      INSERT INTO transactions (reseller_id, admin_id, type, amount, description)
      VALUES (?, ?, 'credit_add', ?, 'Crédits initiaux')
    `).run(result.lastInsertRowid, req.user.id, initialCredits);
  }

  res.json({
    id: result.lastInsertRowid,
    email,
    name,
    credits: initialCredits,
    message: 'Revendeur créé avec succès'
  });
});

// Update reseller
router.put('/resellers/:id', (req, res) => {
  const { id } = req.params;
  const { name, status, password } = req.body;

  const reseller = db.prepare('SELECT * FROM resellers WHERE id = ?').get(id);
  if (!reseller) {
    return res.status(404).json({ error: 'Revendeur non trouvé' });
  }

  if (password) {
    const hashedPassword = bcrypt.hashSync(password, 10);
    db.prepare('UPDATE resellers SET password = ? WHERE id = ?').run(hashedPassword, id);
  }

  if (name) {
    db.prepare('UPDATE resellers SET name = ? WHERE id = ?').run(name, id);
  }

  if (status) {
    db.prepare('UPDATE resellers SET status = ? WHERE id = ?').run(status, id);
  }

  res.json({ message: 'Revendeur mis à jour' });
});

// Add credits to reseller
router.post('/resellers/:id/credits', (req, res) => {
  const { id } = req.params;
  const { amount, description } = req.body;

  if (!amount || amount <= 0) {
    return res.status(400).json({ error: 'Montant invalide' });
  }

  const reseller = db.prepare('SELECT * FROM resellers WHERE id = ?').get(id);
  if (!reseller) {
    return res.status(404).json({ error: 'Revendeur non trouvé' });
  }

  db.prepare('UPDATE resellers SET credits = credits + ? WHERE id = ?').run(amount, id);

  db.prepare(`
    INSERT INTO transactions (reseller_id, admin_id, type, amount, description)
    VALUES (?, ?, 'credit_add', ?, ?)
  `).run(id, req.user.id, amount, description || 'Ajout de crédits');

  const updatedReseller = db.prepare('SELECT credits FROM resellers WHERE id = ?').get(id);

  res.json({
    message: `${amount} crédits ajoutés`,
    newBalance: updatedReseller.credits
  });
});

// Delete reseller
router.delete('/resellers/:id', (req, res) => {
  const { id } = req.params;

  const reseller = db.prepare('SELECT * FROM resellers WHERE id = ?').get(id);
  if (!reseller) {
    return res.status(404).json({ error: 'Revendeur non trouvé' });
  }

  // Remove reseller's devices assignment
  db.prepare('UPDATE devices SET reseller_id = NULL WHERE reseller_id = ?').run(id);
  
  // Delete reseller
  db.prepare('DELETE FROM resellers WHERE id = ?').run(id);

  res.json({ message: 'Revendeur supprimé' });
});

// List all devices
router.get('/devices', (req, res) => {
  const devices = db.prepare(`
    SELECT d.*, r.name as reseller_name, r.email as reseller_email
    FROM devices d
    LEFT JOIN resellers r ON d.reseller_id = r.id
    ORDER BY d.created_at DESC
  `).all();

  res.json(devices);
});

// Transaction history
router.get('/transactions', (req, res) => {
  const transactions = db.prepare(`
    SELECT t.*, r.name as reseller_name, r.email as reseller_email
    FROM transactions t
    LEFT JOIN resellers r ON t.reseller_id = r.id
    ORDER BY t.created_at DESC
    LIMIT 100
  `).all();

  res.json(transactions);
});

module.exports = router;


















