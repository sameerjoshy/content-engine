// Apply a SQL file to Supabase via the Management API.
// Usage: node scripts/apply-migration.mjs <file.sql>
// Env: SUPABASE_ACCESS_TOKEN, SUPABASE_PROJECT_REF
import { readFileSync } from 'node:fs';

const file = process.argv[2];
if (!file) {
  console.error('Usage: node scripts/apply-migration.mjs <file.sql>');
  process.exit(1);
}

const token = process.env.SUPABASE_ACCESS_TOKEN;
const ref = process.env.SUPABASE_PROJECT_REF;
if (!token || !ref) {
  console.error('Missing SUPABASE_ACCESS_TOKEN or SUPABASE_PROJECT_REF');
  process.exit(1);
}

const sql = readFileSync(file, 'utf8');
const url = `https://api.supabase.com/v1/projects/${ref}/database/query`;

console.log(`Applying ${file} (${sql.length} chars) ...`);

const res = await fetch(url, {
  method: 'POST',
  headers: {
    Authorization: `Bearer ${token}`,
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({ query: sql }),
});

const text = await res.text();
if (!res.ok) {
  console.error(`FAILED (${res.status})`);
  console.error(text.slice(0, 3000));
  process.exit(1);
}
console.log('OK');
if (text.trim()) {
  try {
    const rows = JSON.parse(text);
    if (Array.isArray(rows)) {
      for (const r of rows.slice(0, 10)) console.log(r);
      if (rows.length > 10) console.log(`... ${rows.length} rows`);
    } else {
      console.log(text.slice(0, 1000));
    }
  } catch {
    console.log(text.slice(0, 1000));
  }
}