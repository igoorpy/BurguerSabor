/* Executado antes de cada arquivo de teste: aponta a API para o banco de TESTE. */
import * as fs from 'fs';
import * as path from 'path';

const envFile = path.join(__dirname, '..', '.env');
if (fs.existsSync(envFile)) {
  for (const line of fs.readFileSync(envFile, 'utf8').split(/\r?\n/)) {
    const match = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
    if (match && process.env[match[1]] === undefined) process.env[match[1]] = match[2];
  }
}

// O banco de teste é apagado e recriado a cada arquivo — nunca use o banco principal aqui.
process.env.DATABASE_URL =
  process.env.DATABASE_URL_TEST ?? 'postgres://postgres:postgres@localhost:5432/burguer_sabor_test';
process.env.JWT_SECRET = 'segredo-dos-testes';
process.env.TAXA_ENTREGA = '5.00';
