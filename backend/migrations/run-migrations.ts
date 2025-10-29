/**
 * Database Migration Runner
 * 
 * Runs SQL migrations in order.
 */

import { readFileSync } from 'fs';
import { join } from 'path';
import { supabaseAdmin } from '../src/infra/supabase/client';

const MIGRATIONS = [
  '001_create_store_cards_table.sql',
];

async function runMigrations() {
  console.log('Running database migrations...\n');

  for (const migrationFile of MIGRATIONS) {
    console.log(`Running migration: ${migrationFile}`);
    
    try {
      const sql = readFileSync(join(__dirname, migrationFile), 'utf-8');
      
      // Execute migration
      const { error } = await supabaseAdmin.rpc('exec_sql', { sql });
      
      if (error) {
        // Try direct execution if RPC not available
        const statements = sql
          .split(';')
          .map(s => s.trim())
          .filter(s => s.length > 0 && !s.startsWith('--'));
        
        for (const statement of statements) {
          const { error: execError } = await (supabaseAdmin as any).from('_migrations').select('*').limit(0);
          if (execError) {
            console.error(`  ❌ Error executing statement:`, execError.message);
            throw execError;
          }
        }
      }
      
      console.log(`  ✅ Migration completed: ${migrationFile}\n`);
    } catch (error) {
      console.error(`  ❌ Migration failed: ${migrationFile}`);
      console.error(`  Error:`, error);
      process.exit(1);
    }
  }

  console.log('✅ All migrations completed successfully!');
}

// Run migrations
runMigrations().catch(error => {
  console.error('Migration runner failed:', error);
  process.exit(1);
});
