// Migration to add Xtream Code fields to devices table
const { db, usePostgres } = require('../database');

function runMigration() {
  console.log('Running migration: add_xtream_fields');

  // PostgreSQL already has these columns in the schema (created in database.js)
  if (usePostgres) {
    console.log('✅ PostgreSQL detected - skipping SQLite migration add_xtream_fields');
    return;
  }
  
  try {
    // Check if columns already exist
    const tableInfo = db.prepare("PRAGMA table_info(devices)").all();
    const columnNames = tableInfo.map(col => col.name);
    
    // Add playlist_type column if not exists
    if (!columnNames.includes('playlist_type')) {
      db.prepare(`ALTER TABLE devices ADD COLUMN playlist_type TEXT DEFAULT 'm3u'`).run();
      console.log('✅ Added playlist_type column');
    }
    
    // Add xtream_host column if not exists
    if (!columnNames.includes('xtream_host')) {
      db.prepare(`ALTER TABLE devices ADD COLUMN xtream_host TEXT`).run();
      console.log('✅ Added xtream_host column');
    }
    
    // Add xtream_username column if not exists
    if (!columnNames.includes('xtream_username')) {
      db.prepare(`ALTER TABLE devices ADD COLUMN xtream_username TEXT`).run();
      console.log('✅ Added xtream_username column');
    }
    
    // Add xtream_password column if not exists
    if (!columnNames.includes('xtream_password')) {
      db.prepare(`ALTER TABLE devices ADD COLUMN xtream_password TEXT`).run();
      console.log('✅ Added xtream_password column');
    }
    
    console.log('✅ Migration completed successfully');
  } catch (error) {
    console.error('❌ Migration failed:', error);
    throw error;
  }
}

// Run if called directly
if (require.main === module) {
  runMigration();
  process.exit(0);
}

module.exports = { runMigration };









