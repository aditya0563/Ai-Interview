import { drizzle } from 'drizzle-orm/postgres-js';
import { migrate } from 'drizzle-orm/postgres-js/migrator';
import postgres from 'postgres';
import { resolve } from 'path';

const runMigrate = async () => {
  if (!process.env.DATABASE_URL) {
    throw new Error('DATABASE_URL is not set');
  }

  // Create a dedicated, single-query connection for migrations
  const migrationClient = postgres(process.env.DATABASE_URL, { max: 1 });
  const db = drizzle(migrationClient);

  console.log('Running migrations...');
  
  try {
    // Resolve the migrations folder relative to this script
    const migrationsFolder = resolve(__dirname, '../migrations');
    await migrate(db, { migrationsFolder });
    
    console.log('Migrations complete!');
    await migrationClient.end();
    process.exit(0);
  } catch (error) {
    console.error('Migration failed!', error);
    await migrationClient.end();
    process.exit(1);
  }
};

runMigrate();
