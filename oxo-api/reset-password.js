// Script to reset reseller password
const bcrypt = require('bcryptjs');
const { db } = require('./src/database');

const email = 'casamorino@gmail.com';
const newPassword = '123456';

// Hash the new password
const hashedPassword = bcrypt.hashSync(newPassword, 10);

// Update in database
const result = db.prepare('UPDATE resellers SET password = ? WHERE email = ?')
  .run(hashedPassword, email);

if (result.changes > 0) {
  console.log('✅ Mot de passe réinitialisé avec succès!');
  console.log(`Email: ${email}`);
  console.log(`Nouveau mot de passe: ${newPassword}`);
} else {
  console.log('❌ Erreur: Utilisateur non trouvé');
}

process.exit(0);














