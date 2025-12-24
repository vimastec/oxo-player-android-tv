/**
 * Migration: Add Portal Support
 * - Add device_key (PIN) to devices table
 * - Create playlists table for multiple playlists per device
 */

const { db } = require('../database');

function runMigration() {
  console.log('🔄 Running portal support migration...');

  try {
    // Check if device_key column exists
    const deviceColumns = db.pragma('table_info(devices)');
    const hasDeviceKey = deviceColumns.some(col => col.name === 'device_key');

    if (!hasDeviceKey) {
      // Add device_key column to devices
      db.exec(`ALTER TABLE devices ADD COLUMN device_key TEXT`);
      console.log('✅ Added device_key column to devices table');
      
      // Generate device_key for existing devices
      const devices = db.prepare('SELECT id FROM devices WHERE device_key IS NULL').all();
      const updateStmt = db.prepare('UPDATE devices SET device_key = ? WHERE id = ?');
      
      for (const device of devices) {
        const key = generateDeviceKey();
        updateStmt.run(key, device.id);
      }
      console.log(`✅ Generated device_key for ${devices.length} existing devices`);
    }

    // Create playlists table if not exists
    db.exec(`
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
      )
    `);
    console.log('✅ Created playlists table');

    // Migrate existing playlists from devices table to playlists table
    const devicesWithPlaylists = db.prepare(`
      SELECT id, playlist_url, playlist_type, xtream_host, xtream_username, xtream_password
      FROM devices 
      WHERE playlist_url IS NOT NULL OR xtream_host IS NOT NULL
    `).all();

    const insertPlaylist = db.prepare(`
      INSERT INTO playlists (device_id, name, playlist_type, playlist_url, xtream_host, xtream_username, xtream_password)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `);

    let migratedCount = 0;
    for (const device of devicesWithPlaylists) {
      // Check if already migrated
      const existing = db.prepare('SELECT id FROM playlists WHERE device_id = ?').get(device.id);
      if (!existing) {
        const name = device.playlist_type === 'xtream' ? 'Xtream Playlist' : 'Main Playlist';
        insertPlaylist.run(
          device.id,
          name,
          device.playlist_type || 'm3u',
          device.playlist_url,
          device.xtream_host,
          device.xtream_username,
          device.xtream_password
        );
        migratedCount++;
      }
    }
    
    if (migratedCount > 0) {
      console.log(`✅ Migrated ${migratedCount} existing playlists`);
    }

    console.log('✅ Portal support migration completed');
    
  } catch (err) {
    console.error('❌ Migration error:', err.message);
  }
}

/**
 * Generate a random 6-digit device key (like 765498)
 */
function generateDeviceKey() {
  // Generate 6 random digits
  let key = '';
  for (let i = 0; i < 6; i++) {
    key += Math.floor(Math.random() * 10).toString();
  }
  return key;
}

module.exports = {
  runMigration,
  generateDeviceKey
};

