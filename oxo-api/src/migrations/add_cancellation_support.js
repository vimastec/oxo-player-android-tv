/**
 * Migration: Add Cancellation Support
 * - Add was_cancelled column to devices table
 * - This tracks if a device has been cancelled before (one-time only)
 */

const { db, usePostgres } = require('../database');

function runMigration() {
  console.log('🔄 Running cancellation support migration...');

  try {
    if (usePostgres) {
      // PostgreSQL
      const checkColumn = db.prepare(`
        SELECT column_name 
        FROM information_schema.columns 
        WHERE table_name = 'devices' AND column_name = 'was_cancelled'
      `).get();

      if (!checkColumn) {
        db.prepare(`ALTER TABLE devices ADD COLUMN was_cancelled BOOLEAN DEFAULT FALSE`).run();
        console.log('✅ Added was_cancelled column to devices table (PostgreSQL)');
      } else {
        console.log('✅ was_cancelled column already exists (PostgreSQL)');
      }
    } else {
      // SQLite
      const columns = db.pragma('table_info(devices)');
      const hasWasCancelled = columns.some(col => col.name === 'was_cancelled');

      if (!hasWasCancelled) {
        db.exec(`ALTER TABLE devices ADD COLUMN was_cancelled INTEGER DEFAULT 0`);
        console.log('✅ Added was_cancelled column to devices table (SQLite)');
      } else {
        console.log('✅ was_cancelled column already exists (SQLite)');
      }
    }

    console.log('✅ Cancellation support migration completed');
    
  } catch (err) {
    console.error('❌ Migration error:', err.message);
  }
}

module.exports = { runMigration };

