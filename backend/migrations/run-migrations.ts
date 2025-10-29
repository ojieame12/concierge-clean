/**
 * Migration Runner
 * 
 * Runs SQL migrations using direct Postgres connection
 */

import { readFileSync, readdirSync } from 'fs';
import { join } from 'path';
import { Client } from 'pg';

(async () => {
  const connectionString = process.env.SUPABASE_DB_URL || process.env.DATABASE_URL;
  
  if (!connectionString) {
    console.error('❌ Missing DATABASE_URL or SUPABASE_DB_URL environment variable');
    process.exit(1);
  }

  const client = new Client({ connectionString });
  
  try {
    await client.connect();
    console.log('✅ Connected to database');

    const dir = __dirname; // contains *.sql files
    const files = readdirSync(dir)
      .filter(f => f.endsWith('.sql'))
      .sort();

    if (files.length === 0) {
      console.log('ℹ️  No migration files found');
      process.exit(0);
    }

    console.log(`\n📝 Found ${files.length} migration(s):\n`);

    for (const f of files) {
      const sql = readFileSync(join(dir, f), 'utf-8');
      console.log(`Running migration: ${f}`);
      
      await client.query('BEGIN');
      
      try {
        await client.query(sql);
        await client.query('COMMIT');
        console.log(`  ✅ ${f} completed successfully`);
      } catch (e) {
        await client.query('ROLLBACK');
        console.error(`  ❌ ${f} failed:`, e);
        process.exit(1);
      }
    }

    console.log('\n✅ All migrations completed successfully\n');
    await client.end();
    process.exit(0);
  } catch (error) {
    console.error('❌ Migration error:', error);
    await client.end();
    process.exit(1);
  }
})();
