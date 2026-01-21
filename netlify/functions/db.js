import pg from 'pg';

const { Pool } = pg;

// Use connection pooling for serverless functions
const pool = new Pool({
  connectionString: process.env.NETLIFY_DATABASE_URL || process.env.DATABASE_URL,
  ssl: {
    rejectUnauthorized: false
  },
  max: 10,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 10000
});

// Initialize database tables
export async function initDatabase() {
  // Tables already exist in Neon - no need to run CREATE on every request
  // This was causing issues with the subtasks foreign key
  return;
}

// Query helper
export async function query(text, params) {
  const client = await pool.connect();
  try {
    const result = await client.query(text, params);
    return result;
  } finally {
    client.release();
  }
}

// Get single row
export async function queryOne(text, params) {
  const result = await query(text, params);
  return result.rows[0] || null;
}

// Get all rows
export async function queryAll(text, params) {
  const result = await query(text, params);
  return result.rows;
}

export default { query, queryOne, queryAll, initDatabase, pool };

