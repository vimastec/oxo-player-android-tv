const { Pool } = require('pg');
const pool = new Pool({ 
  connectionString: process.env.DATABASE_URL, 
  ssl: { rejectUnauthorized: false } 
});

async function checkDevices() {
  try {
    const result = await pool.query(`
      SELECT mac_address, status, trial_start, expiration_date, last_seen,
             EXTRACT(EPOCH FROM (expiration_date - NOW()))/86400 as days_remaining
      FROM devices 
      ORDER BY created_at DESC 
      LIMIT 10
    `);
    console.log('=== DEVICES TRIAL STATUS ===');
    result.rows.forEach(d => {
      console.log(`MAC: ${d.mac_address}`);
      console.log(`  Status: ${d.status}`);
      console.log(`  Trial Start: ${d.trial_start}`);
      console.log(`  Expiration: ${d.expiration_date}`);
      console.log(`  Days Remaining: ${Math.ceil(d.days_remaining || 0)}`);
      console.log(`  Last Seen: ${d.last_seen}`);
      console.log('---');
    });
  } catch (e) {
    console.error('Error:', e.message);
  } finally {
    await pool.end();
  }
}
checkDevices();
