const express = require('express');
const bcrypt = require('bcryptjs');
const { db } = require('../database');
const { generateToken, verifyToken } = require('../middleware/auth');

const router = express.Router();

// Login (Admin or Reseller)
router.post('/login', async (req, res) => {
  const { email, password } = req.body;

  if (!email || !password) {
    return res.status(400).json({ error: 'Email et mot de passe requis' });
  }

  // Check admin first
  let user = await db.prepare('SELECT * FROM admins WHERE email = ?').get(email);
  let role = 'admin';

  if (!user) {
    // Check reseller
    user = await db.prepare('SELECT * FROM resellers WHERE email = ?').get(email);
    role = 'reseller';
  }

  if (!user) {
    return res.status(401).json({ error: 'Email ou mot de passe incorrect' });
  }

  if (role === 'reseller' && user.status !== 'active') {
    return res.status(401).json({ error: 'Compte désactivé' });
  }

  const validPassword = bcrypt.compareSync(password, user.password);
  if (!validPassword) {
    return res.status(401).json({ error: 'Email ou mot de passe incorrect' });
  }

  const token = generateToken({
    id: user.id,
    email: user.email,
    name: user.name,
    role: role,
    credits: role === 'reseller' ? user.credits : undefined
  });

  res.json({
    token,
    user: {
      id: user.id,
      email: user.email,
      name: user.name,
      role: role,
      credits: role === 'reseller' ? user.credits : undefined
    }
  });
});

// Get current user info
router.get('/me', verifyToken, async (req, res) => {
  const { id, role } = req.user;

  let user;
  if (role === 'admin') {
    user = await db.prepare('SELECT id, email, name, created_at FROM admins WHERE id = ?').get(id);
  } else {
    user = await db.prepare('SELECT id, email, name, credits, status, created_at FROM resellers WHERE id = ?').get(id);
  }

  if (!user) {
    return res.status(404).json({ error: 'Utilisateur non trouvé' });
  }

  res.json({ ...user, role });
});

// Change password
router.post('/change-password', verifyToken, async (req, res) => {
  const { currentPassword, newPassword } = req.body;
  const { id, role } = req.user;

  if (!currentPassword || !newPassword) {
    return res.status(400).json({ error: 'Mot de passe actuel et nouveau requis' });
  }

  const table = role === 'admin' ? 'admins' : 'resellers';
  const user = await db.prepare(`SELECT password FROM ${table} WHERE id = ?`).get(id);

  if (!bcrypt.compareSync(currentPassword, user.password)) {
    return res.status(400).json({ error: 'Mot de passe actuel incorrect' });
  }

  const hashedPassword = bcrypt.hashSync(newPassword, 10);
  await db.prepare(`UPDATE ${table} SET password = ? WHERE id = ?`).run(hashedPassword, id);

  res.json({ message: 'Mot de passe modifié avec succès' });
});

module.exports = router;






















