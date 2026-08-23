import postgres from 'postgres';

const sql = postgres(process.env.DATABASE_URL, { connect_timeout: 10 });

try {
  const result = await sql`select 1 as ok, version()`;
  console.log('CONNECTED:', JSON.stringify(result));
  await sql.end();
  process.exit(0);
} catch (err) {
  console.error('CONNECTION FAILED:', err.message);
  process.exit(1);
}
