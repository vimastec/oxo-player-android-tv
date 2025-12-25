const { db } = require('./src/database');

const hashedPassword = '$2a$10$MfJmJV.ASvoPER14hMGOQO0Hoia4ChWhbqMFpOOd0If6YweRDtKM2';
const email = 'casamorino@gmail.com';

try {
  const result = db.prepare('UPDATE resellers SET password = ? WHERE email = ?')
    .run(hashedPassword, email);
  
  if (result.changes > 0) {
    console.log('✅ Mot de passe mis à jour!');
    console.log('Email: casamorino@gmail.com');
    console.log('Mot de passe: 123456');
  } else {
    console.log('❌ Utilisateur non trouvé');
  }
} catch (err) {
  console.error('Erreur:', err.message);
}






