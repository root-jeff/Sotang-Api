import { migrate } from 'drizzle-orm/node-postgres/migrator';
import { getDb, getPool, closePool } from '../core/db';

async function main() {
  console.log('⏳ Running migrations...');
  const db = getDb();
  await migrate(db, { migrationsFolder: './src/db/migrations' });
  console.log('✅ Migrations complete');
  await closePool();
  process.exit(0);
}

main().catch((err) => {
  console.error('❌ Migration failed:', err);
  process.exit(1);
});
