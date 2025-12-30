/**
 * Migration: Add app_versions table for OTA updates
 * Supports both SQLite (dev) and PostgreSQL (production)
 */

const { db, usePostgres } = require('../database');

async function runMigration() {
  console.log('🔄 Running app_versions migration...');

  if (usePostgres) {
    // PostgreSQL
    try {
      await db.exec(`
        CREATE TABLE IF NOT EXISTS app_versions (
          id SERIAL PRIMARY KEY,
          version_code INTEGER NOT NULL UNIQUE,
          version_name TEXT NOT NULL,
          download_url TEXT NOT NULL,
          changelog TEXT,
          is_mandatory BOOLEAN DEFAULT FALSE,
          min_supported_version INTEGER,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
      `);
      console.log('✅ app_versions table created (PostgreSQL)');
    } catch (err) {
      if (err.message && err.message.includes('already exists')) {
        console.log('ℹ️ app_versions table already exists');
      } else {
        throw err;
      }
    }
  } else {
    // SQLite
    try {
      db.exec(`
        CREATE TABLE IF NOT EXISTS app_versions (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          version_code INTEGER NOT NULL UNIQUE,
          version_name TEXT NOT NULL,
          download_url TEXT NOT NULL,
          changelog TEXT,
          is_mandatory INTEGER DEFAULT 0,
          min_supported_version INTEGER,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )
      `);
      console.log('✅ app_versions table created (SQLite)');
    } catch (err) {
      console.log('ℹ️ app_versions migration:', err.message);
    }
  }
}

module.exports = { runMigration };
