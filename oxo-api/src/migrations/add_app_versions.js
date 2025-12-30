/**
 * Migration to add app_versions table for OTA updates
 */

const { db, usePostgres } = require('../database');

async function runMigration() {
  console.log('Running app_versions migration...');

  if (usePostgres) {
    // PostgreSQL
    const { Pool } = require('pg');
    const pool = new Pool({
      connectionString: process.env.DATABASE_URL,
      ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
    });

    await pool.query(`
      CREATE TABLE IF NOT EXISTS app_versions (
        id SERIAL PRIMARY KEY,
        version_code INTEGER UNIQUE NOT NULL,
        version_name TEXT NOT NULL,
        download_url TEXT NOT NULL,
        changelog TEXT,
        is_mandatory BOOLEAN DEFAULT FALSE,
        min_supported_version INTEGER,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    console.log('✅ app_versions table created (PostgreSQL)');
    await pool.end();
  } else {
    // SQLite
    db.exec(`
      CREATE TABLE IF NOT EXISTS app_versions (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        version_code INTEGER UNIQUE NOT NULL,
        version_name TEXT NOT NULL,
        download_url TEXT NOT NULL,
        changelog TEXT,
        is_mandatory INTEGER DEFAULT 0,
        min_supported_version INTEGER,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `);

    console.log('✅ app_versions table created (SQLite)');
  }
}

module.exports = { runMigration };

