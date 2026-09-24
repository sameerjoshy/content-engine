// Ad-hoc SQL runner. Usage: node scripts/sql.mjs '<query>'
const q = process.argv[2];
const token = process.env.SUPABASE_ACCESS_TOKEN;
const ref = process.env.SUPABASE_PROJECT_REF || 'agrnbsaaxdbvlcdqtnwo';
const res = await fetch(`https://api.supabase.com/v1/projects/${ref}/database/query`, {
  method: 'POST',
  headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
  body: JSON.stringify({ query: q }),
});
const text = await res.text();
console.log(text.slice(0, 4000));
process.exit(res.ok ? 0 : 1);