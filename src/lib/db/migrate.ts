import { db } from './client';

async function main() {
  const migrate = process.env.DATABASE_URL
    ? (await import('drizzle-orm/postgres-js/migrator')).migrate
    : (await import('drizzle-orm/pglite/migrator')).migrate;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await migrate(db as any, { migrationsFolder: './drizzle' });
  console.log('Migrations applied.');
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
