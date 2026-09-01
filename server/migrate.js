import { readFile } from 'node:fs/promises';
import { pool } from './db.js';

try {
  const sql = await readFile(new URL('./schema.sql', import.meta.url), 'utf8');
  await pool.query(sql);
  console.log('Database migration complete.');
} finally {
  await pool.end();
}
