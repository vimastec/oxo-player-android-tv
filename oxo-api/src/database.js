const bcrypt = require('bcryptjs');
const path = require('path');
const fs = require('fs');

// Déterminer le type de base de données
const DATABASE_URL = process.env.DATABASE_URL;
const usePostgres = DATABASE_URL && DATABASE_URL.startsWith('postgres');

let db;
let pool;

if (usePostgres) {
  // PostgreSQL pour production
  const { Pool } = require('pg');
  pool = new Pool({
    connectionString: DATABASE_URL,
    ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
  });
  
  console.log('🐘 Using PostgreSQL database');
  
  // Wrapper compatible avec better-sqlite3
  db = {
    prepare: (sql) => {
      // Convertir ? en $1, $2, etc.
      let paramIndex = 0;
      const pgSql = sql.replace(/\?/g, () => `$${++paramIndex}`);
      
      return {
        run: async (...params) => {
          try {
            const result = await pool.query(pgSql + ' RETURNING id', params);
            return { 
              lastInsertRowid: result.rows[0]?.id, 
              changes: result.rowCount 
            };
          } catch (err) {
            // Si pas de RETURNING, essayer sans
            const result = await pool.query(pgSql, params);
            return { changes: result.rowCount };
          }
        },
        get: async (...params) => {
          const result = await pool.query(pgSql, params);
          return result.rows[0];
        },
        all: async (...params) => {
          const result = await pool.query(pgSql, params);
          return result.rows;
        }
      };
    },
    exec: async (sql) => {
      // Exécuter chaque statement séparément pour PostgreSQL
      const statements = sql.split(';').filter(s => s.trim());
      for (const statement of statements) {
        if (statement.trim()) {
          await pool.query(statement);
        }
      }
    }
  };
} else {
  // SQLite pour développement local
  const Database = require('better-sqlite3');
  const dbPath = process.env.DATABASE_PATH || path.join(__dirname, '../database.sqlite');
  
  const dbDir = path.dirname(dbPath);
  if (!fs.existsSync(dbDir)) {
    fs.mkdirSync(dbDir, { recursive: true });
  }
  
  db = new Database(dbPath);
  console.log(`📁 Using SQLite database: ${dbPath}`);
}

async function init() {
  if (usePostgres) {
    // PostgreSQL schema
    const schema = `
      CREATE TABLE IF NOT EXISTS admins (
        id SERIAL PRIMARY KEY,
        email TEXT UNIQUE NOT NULL,
        password TEXT NOT NULL,
        name TEXT DEFAULT 'Admin',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS resellers (
        id SERIAL PRIMARY KEY,
        email TEXT UNIQUE NOT NULL,
        password TEXT NOT NULL,
        name TEXT NOT NULL,
        credits INTEGER DEFAULT 0,
        status TEXT DEFAULT 'active',
        allow_cross_reseller_activation BOOLEAN DEFAULT FALSE,
        can_create_subresellers BOOLEAN DEFAULT FALSE,
        parent_reseller_id INTEGER REFERENCES resellers(id),
        is_subreseller BOOLEAN DEFAULT FALSE,
        created_by INTEGER REFERENCES admins(id),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS devices (
        id SERIAL PRIMARY KEY,
        mac_address TEXT UNIQUE NOT NULL,
        reseller_id INTEGER REFERENCES resellers(id),
        playlist_url TEXT,
        playlist_content TEXT,
        playlist_type TEXT DEFAULT 'm3u',
        xtream_host TEXT,
        xtream_username TEXT,
        xtream_password TEXT,
        status TEXT DEFAULT 'trial',
        trial_start TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        activation_date TIMESTAMP,
        expiration_date TIMESTAMP,
        last_seen TIMESTAMP,
        device_info TEXT,
        device_key TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS playlists (
        id SERIAL PRIMARY KEY,
        device_id INTEGER NOT NULL REFERENCES devices(id) ON DELETE CASCADE,
        name TEXT NOT NULL,
        playlist_type TEXT DEFAULT 'm3u',
        playlist_url TEXT,
        xtream_host TEXT,
        xtream_username TEXT,
        xtream_password TEXT,
        epg_url TEXT,
        is_protected INTEGER DEFAULT 0,
        pin TEXT,
        is_active INTEGER DEFAULT 1,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS transactions (
        id SERIAL PRIMARY KEY,
        reseller_id INTEGER REFERENCES resellers(id),
        admin_id INTEGER REFERENCES admins(id),
        from_reseller_id INTEGER REFERENCES resellers(id),
        type TEXT NOT NULL,
        amount INTEGER NOT NULL,
        description TEXT,
        mac_address TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS seller_contacts (
        id SERIAL PRIMARY KEY,
        name TEXT NOT NULL,
        city TEXT NOT NULL,
        phone TEXT NOT NULL,
        email TEXT,
        address TEXT,
        is_active INTEGER DEFAULT 1,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS seller_requests (
        id SERIAL PRIMARY KEY,
        name TEXT NOT NULL,
        phone TEXT NOT NULL,
        city TEXT NOT NULL,
        quantity INTEGER DEFAULT 1,
        message TEXT,
        status TEXT DEFAULT 'pending',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `;
    
    await db.exec(schema);

    // Ensure new columns exist on already-created tables (PostgreSQL)
    // NOTE: CREATE TABLE IF NOT EXISTS won't add new columns to existing tables.
    try {
      await pool.query(`
        ALTER TABLE resellers
        ADD COLUMN IF NOT EXISTS allow_cross_reseller_activation BOOLEAN DEFAULT FALSE
      `);
    } catch (err) {
      console.error('❌ Failed to ensure resellers.allow_cross_reseller_activation:', err.message);
    }

    // Sub-resellers columns
    try {
      await pool.query(`
        ALTER TABLE resellers
        ADD COLUMN IF NOT EXISTS can_create_subresellers BOOLEAN DEFAULT FALSE
      `);
      await pool.query(`
        ALTER TABLE resellers
        ADD COLUMN IF NOT EXISTS parent_reseller_id INTEGER REFERENCES resellers(id)
      `);
      await pool.query(`
        ALTER TABLE resellers
        ADD COLUMN IF NOT EXISTS is_subreseller BOOLEAN DEFAULT FALSE
      `);
      console.log('✅ Sub-resellers columns added to resellers table');
    } catch (err) {
      console.error('❌ Failed to add sub-resellers columns:', err.message);
    }

    // Transaction from_reseller_id column for credit transfers
    try {
      await pool.query(`
        ALTER TABLE transactions
        ADD COLUMN IF NOT EXISTS from_reseller_id INTEGER REFERENCES resellers(id)
      `);
      console.log('✅ from_reseller_id column added to transactions table');
    } catch (err) {
      console.error('❌ Failed to add from_reseller_id column:', err.message);
    }
  } else {
    // SQLite schema
    db.exec(`
      CREATE TABLE IF NOT EXISTS admins (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        email TEXT UNIQUE NOT NULL,
        password TEXT NOT NULL,
        name TEXT DEFAULT 'Admin',
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS resellers (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        email TEXT UNIQUE NOT NULL,
        password TEXT NOT NULL,
        name TEXT NOT NULL,
        credits INTEGER DEFAULT 0,
        status TEXT DEFAULT 'active',
        allow_cross_reseller_activation INTEGER DEFAULT 0,
        can_create_subresellers INTEGER DEFAULT 0,
        parent_reseller_id INTEGER,
        is_subreseller INTEGER DEFAULT 0,
        created_by INTEGER,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (created_by) REFERENCES admins(id),
        FOREIGN KEY (parent_reseller_id) REFERENCES resellers(id)
      );

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
        device_key TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (reseller_id) REFERENCES resellers(id)
      );

      CREATE TABLE IF NOT EXISTS playlists (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        device_id INTEGER NOT NULL,
        name TEXT NOT NULL,
        playlist_type TEXT DEFAULT 'm3u',
        playlist_url TEXT,
        xtream_host TEXT,
        xtream_username TEXT,
        xtream_password TEXT,
        epg_url TEXT,
        is_protected INTEGER DEFAULT 0,
        pin TEXT,
        is_active INTEGER DEFAULT 1,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (device_id) REFERENCES devices(id) ON DELETE CASCADE
      );

      CREATE TABLE IF NOT EXISTS transactions (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        reseller_id INTEGER,
        admin_id INTEGER,
        from_reseller_id INTEGER,
        type TEXT NOT NULL,
        amount INTEGER NOT NULL,
        description TEXT,
        mac_address TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (reseller_id) REFERENCES resellers(id),
        FOREIGN KEY (admin_id) REFERENCES admins(id),
        FOREIGN KEY (from_reseller_id) REFERENCES resellers(id)
      );

      CREATE TABLE IF NOT EXISTS seller_contacts (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        city TEXT NOT NULL,
        phone TEXT NOT NULL,
        email TEXT,
        address TEXT,
        is_active INTEGER DEFAULT 1,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS seller_requests (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        phone TEXT NOT NULL,
        city TEXT NOT NULL,
        quantity INTEGER DEFAULT 1,
        message TEXT,
        status TEXT DEFAULT 'pending',
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      );
    `);

    // Ensure new columns exist on already-created tables (SQLite)
    try {
      const resellerColumns = db.prepare("PRAGMA table_info(resellers)").all();
      const hasFlag = resellerColumns.some((c) => c.name === 'allow_cross_reseller_activation');
      if (!hasFlag) {
        db.prepare('ALTER TABLE resellers ADD COLUMN allow_cross_reseller_activation INTEGER DEFAULT 0').run();
      }
      
      // Sub-resellers columns
      const hasCanCreateSub = resellerColumns.some((c) => c.name === 'can_create_subresellers');
      if (!hasCanCreateSub) {
        db.prepare('ALTER TABLE resellers ADD COLUMN can_create_subresellers INTEGER DEFAULT 0').run();
        console.log('✅ can_create_subresellers column added');
      }
      
      const hasParentId = resellerColumns.some((c) => c.name === 'parent_reseller_id');
      if (!hasParentId) {
        db.prepare('ALTER TABLE resellers ADD COLUMN parent_reseller_id INTEGER').run();
        console.log('✅ parent_reseller_id column added');
      }
      
      const hasIsSub = resellerColumns.some((c) => c.name === 'is_subreseller');
      if (!hasIsSub) {
        db.prepare('ALTER TABLE resellers ADD COLUMN is_subreseller INTEGER DEFAULT 0').run();
        console.log('✅ is_subreseller column added');
      }
    } catch (err) {
      console.error('❌ Failed to ensure resellers columns (SQLite):', err.message);
    }

    // Transaction from_reseller_id column for credit transfers
    try {
      const transactionColumns = db.prepare("PRAGMA table_info(transactions)").all();
      const hasFromReseller = transactionColumns.some((c) => c.name === 'from_reseller_id');
      if (!hasFromReseller) {
        db.prepare('ALTER TABLE transactions ADD COLUMN from_reseller_id INTEGER').run();
        console.log('✅ from_reseller_id column added to transactions');
      }
    } catch (err) {
      console.error('❌ Failed to add from_reseller_id column (SQLite):', err.message);
    }
  }

  // Create default admin
  const adminEmail = process.env.ADMIN_EMAIL || 'admin@oxoplayer.com';
  const adminPassword = process.env.ADMIN_PASSWORD || 'admin123';
  
  const existingAdmin = await db.prepare('SELECT id FROM admins WHERE email = ?').get(adminEmail);
  
  if (!existingAdmin) {
    const hashedPassword = bcrypt.hashSync(adminPassword, 10);
    await db.prepare('INSERT INTO admins (email, password, name) VALUES (?, ?, ?)').run(
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
  init,
  usePostgres
};
