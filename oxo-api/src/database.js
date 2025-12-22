const Database = require('better-sqlite3');
const bcrypt = require('bcryptjs');
const path = require('path');
const fs = require('fs');

// Support Railway volume (/data) ou dossier local
const dbPath = process.env.DATABASE_PATH || path.join(__dirname, '../database.sqlite');

// Créer le dossier parent si nécessaire (pour Railway volume)
const dbDir = path.dirname(dbPath);
if (!fs.existsSync(dbDir)) {
  fs.mkdirSync(dbDir, { recursive: true });
}

const db = new Database(dbPath);
console.log(`📁 Database path: ${dbPath}`);

function init() {
  // Create tables
  db.exec(`
    -- Admins table (super admin)
    CREATE TABLE IF NOT EXISTS admins (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      email TEXT UNIQUE NOT NULL,
      password TEXT NOT NULL,
      name TEXT DEFAULT 'Admin',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    -- Resellers table (sub-admins/users)
    CREATE TABLE IF NOT EXISTS resellers (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      email TEXT UNIQUE NOT NULL,
      password TEXT NOT NULL,
      name TEXT NOT NULL,
      credits INTEGER DEFAULT 0,
      status TEXT DEFAULT 'active',
      created_by INTEGER,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (created_by) REFERENCES admins(id)
    );

    -- Devices table (MAC addresses)
    CREATE TABLE IF NOT EXISTS devices (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      mac_address TEXT UNIQUE NOT NULL,
      reseller_id INTEGER,
      playlist_url TEXT,
      playlist_content TEXT,
      playlist_type TEXT DEFAULT 'm3u',
      xtream_host TEXT,
      xtream_username TEXT,
      xtream_password TEXT,
      status TEXT DEFAULT 'trial',
      trial_start DATETIME DEFAULT CURRENT_TIMESTAMP,
      activation_date DATETIME,
      expiration_date DATETIME,
      last_seen DATETIME,
      device_info TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (reseller_id) REFERENCES resellers(id)
    );

    -- Transactions table (credit history)
    CREATE TABLE IF NOT EXISTS transactions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      reseller_id INTEGER,
      admin_id INTEGER,
      type TEXT NOT NULL,
      amount INTEGER NOT NULL,
      description TEXT,
      mac_address TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (reseller_id) REFERENCES resellers(id),
      FOREIGN KEY (admin_id) REFERENCES admins(id)
    );
  `);

  // Create default admin if not exists
  const adminEmail = process.env.ADMIN_EMAIL || 'admin@oxoplayer.com';
  const adminPassword = process.env.ADMIN_PASSWORD || 'admin123';
  
  const existingAdmin = db.prepare('SELECT id FROM admins WHERE email = ?').get(adminEmail);
  
  if (!existingAdmin) {
    const hashedPassword = bcrypt.hashSync(adminPassword, 10);
    db.prepare('INSERT INTO admins (email, password, name) VALUES (?, ?, ?)').run(
      adminEmail,
      hashedPassword,
      'Super Admin'
    );
    console.log('✅ Default admin account created');
  }

  console.log('✅ Database initialized');
}

module.exports = {
  db,
  init
};




