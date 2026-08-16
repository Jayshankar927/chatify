import pg from 'pg';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.resolve(__dirname, '../../../../.env') });
dotenv.config();

const { Pool } = pg;

const rawConnectionString = process.env.DATABASE_URL || 'postgresql://postgres:postgres@localhost:5432/chatify_db';
const isCloudDatabase = rawConnectionString.includes('neon.tech') || rawConnectionString.includes('sslmode=');

export const pool = new Pool({
  connectionString: rawConnectionString,
  ssl: isCloudDatabase ? { rejectUnauthorized: false } : undefined
});

pool.on('error', (err) => {
  console.error('PostgreSQL Pool Error:', err.message);
});