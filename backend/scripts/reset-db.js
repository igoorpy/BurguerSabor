/* Recria o banco: roda schema.sql e seed.sql. Uso: npm run db:reset */
const fs = require('fs');
const path = require('path');
const { Client } = require('pg');

function loadEnv() {
  const envPath = path.join(__dirname, '..', '.env');
  if (!fs.existsSync(envPath)) return;
  for (const line of fs.readFileSync(envPath, 'utf8').split(/\r?\n/)) {
    const match = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
    if (match && process.env[match[1]] === undefined) process.env[match[1]] = match[2];
  }
}

async function resetDatabase(connectionString) {
  const client = new Client({ connectionString });
  await client.connect();
  try {
    for (const file of ['schema.sql', 'seed.sql']) {
      const sql = fs.readFileSync(path.join(__dirname, '..', '..', 'database', file), 'utf8');
      await client.query(sql);
    }
  } finally {
    await client.end();
  }
}

module.exports = { resetDatabase };

if (require.main === module) {
  loadEnv();
  const url = process.env.DATABASE_URL;
  if (!url) {
    console.error('Defina DATABASE_URL no arquivo .env');
    process.exit(1);
  }
  resetDatabase(url)
    .then(() => console.log('Banco recriado com schema.sql e seed.sql'))
    .catch((err) => {
      console.error(err.message);
      process.exit(1);
    });
}
