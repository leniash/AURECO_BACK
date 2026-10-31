const fs = require('fs');
const path = require('path');
const { pool } = require('../config/db');

async function migrate() {
  console.log('--- Running Neon Database Migration ---');
  try {
    const sql = fs.readFileSync(path.join(__dirname, 'schema.sql'), 'utf-8');
    await pool.query(sql);
    console.log('✓ Migration completed successfully.');
  } catch (err) {
    console.error('Migration failed:', err.message);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

if (require.main === module) {
  migrate();
}

module.exports = migrate;
