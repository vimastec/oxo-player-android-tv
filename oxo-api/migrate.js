/**
 * Script de migration SQLite → PostgreSQL
 * Copie toutes les données de la base SQLite locale vers PostgreSQL sur Railway
 */

const Database = require('better-sqlite3');
const { Pool } = require('pg');
const path = require('path');

// Configuration
const SQLITE_PATH = path.join(__dirname, 'database.sqlite');
const POSTGRES_URL = process.argv[2] || process.env.DATABASE_URL;

if (!POSTGRES_URL) {
  console.error('❌ Erreur: DATABASE_URL manquant');
  console.log('Usage: node migrate.js "postgresql://..."');
  process.exit(1);
}

console.log('🔄 Migration SQLite → PostgreSQL');
console.log('📁 Source SQLite:', SQLITE_PATH);
console.log('🐘 Destination PostgreSQL:', POSTGRES_URL.substring(0, 30) + '...');
console.log('');

const sqlite = new Database(SQLITE_PATH, { readonly: true });
const pool = new Pool({
  connectionString: POSTGRES_URL,
  ssl: { rejectUnauthorized: false }
});

async function migrate() {
  try {
    console.log('📐 Création du schéma PostgreSQL...\n');
    
    // Créer les tables PostgreSQL
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

    // Exécuter chaque CREATE TABLE séparément
    const statements = schema.split(';').filter(s => s.trim());
    for (const statement of statements) {
      if (statement.trim()) {
        await pool.query(statement);
      }
    }
    console.log('✅ Schéma créé\n');

    // Tables à migrer dans l'ordre (à cause des foreign keys)
    const tables = [
      'admins',
      'resellers',
      'devices',
      'playlists',
      'transactions',
      'seller_contacts',
      'seller_requests'
    ];

    for (const table of tables) {
      console.log(`\n📋 Migration de la table: ${table}`);
      
      // Récupérer toutes les données de SQLite
      const rows = sqlite.prepare(`SELECT * FROM ${table}`).all();
      console.log(`   Trouvé: ${rows.length} enregistrements`);

      if (rows.length === 0) {
        console.log(`   ⏭️  Aucune donnée à migrer`);
        continue;
      }

      // Récupérer les colonnes
      const columns = Object.keys(rows[0]);
      const placeholders = columns.map((_, i) => `$${i + 1}`).join(', ');
      const columnsList = columns.join(', ');

      // Insérer dans PostgreSQL
      const insertSQL = `
        INSERT INTO ${table} (${columnsList}) 
        VALUES (${placeholders})
        ON CONFLICT DO NOTHING
      `;

      let successCount = 0;
      let skipCount = 0;

      for (const row of rows) {
        try {
          const values = columns.map(col => row[col]);
          await pool.query(insertSQL, values);
          successCount++;
        } catch (err) {
          // Conflit (déjà existant) ou autre erreur
          if (err.code === '23505') { // Unique violation
            skipCount++;
          } else {
            console.error(`   ⚠️  Erreur pour l'enregistrement:`, err.message);
          }
        }
      }

      console.log(`   ✅ Migrés: ${successCount}, Ignorés: ${skipCount}`);

      // Réinitialiser la séquence PostgreSQL pour les IDs
      if (successCount > 0) {
        try {
          await pool.query(`
            SELECT setval('${table}_id_seq', (SELECT MAX(id) FROM ${table}))
          `);
          console.log(`   🔢 Séquence ID réinitialisée`);
        } catch (err) {
          // Ignore si pas de séquence
        }
      }
    }

    console.log('\n✅ Migration terminée avec succès !');
    console.log('\n📊 Vérification:');
    
    // Afficher le résumé
    for (const table of tables) {
      const result = await pool.query(`SELECT COUNT(*) as count FROM ${table}`);
      console.log(`   ${table}: ${result.rows[0].count} enregistrements`);
    }

  } catch (error) {
    console.error('\n❌ Erreur lors de la migration:', error);
    process.exit(1);
  } finally {
    sqlite.close();
    await pool.end();
  }
}

// Exécuter la migration
migrate();

