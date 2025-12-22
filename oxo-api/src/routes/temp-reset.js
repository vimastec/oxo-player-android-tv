const express = require('express');
const bcrypt = require('bcryptjs');
const { db } = require('../database');

const router = express.Router();

// Temporary endpoint to reset password
router.post('/reset-password-temp', (req, res) => {
  const email = 'casamorino@gmail.com';
  const newPassword = '123456';
  
  try {
    const hashedPassword = bcrypt.hashSync(newPassword, 10);
    const result = db.prepare('UPDATE resellers SET password = ? WHERE email = ?')
      .run(hashedPassword, email);
    
    if (result.changes > 0) {
      res.json({ 
        success: true, 
        message: 'Mot de passe réinitialisé!',
        email: email,
        password: newPassword
      });
    } else {
      res.status(404).json({ success: false, error: 'Utilisateur non trouvé' });
    }
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

module.exports = router;
