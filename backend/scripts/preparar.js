/*
 * Prepara tudo para rodar (usado pelo "Iniciar BurguerSabor.bat"):
 *  1. cria o arquivo .env na primeira vez (pergunta a senha do PostgreSQL) e gera um JWT_SECRET aleatório;
 *  2. confere a conexão com o PostgreSQL;
 *  3. cria os bancos burguer_sabor e burguer_sabor_test se não existirem;
 *  4. cria as tabelas e os dados de exemplo se o banco estiver vazio.
 * O .env fica só no seu computador: ele está no .gitignore e nunca vai para o GitHub.
 */
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const readline = require('readline');
const { Client } = require('pg');
const { resetDatabase } = require('./reset-db');

const raiz = path.join(__dirname, '..');
const envPath = path.join(raiz, '.env');
const exemploPath = path.join(raiz, '.env.example');
const SEGREDO_EXEMPLO = 'troque-este-segredo';

const perguntar = (texto) =>
  new Promise((resolve) => {
    const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
    rl.question(texto, (resposta) => {
      rl.close();
      resolve(resposta.trim());
    });
  });

function lerEnv() {
  const valores = {};
  for (const linha of fs.readFileSync(envPath, 'utf8').split(/\r?\n/)) {
    const m = linha.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
    if (m) valores[m[1]] = m[2];
  }
  return valores;
}

function trocarNoEnv(chave, valor) {
  const conteudo = fs.readFileSync(envPath, 'utf8').replace(new RegExp(`^${chave}=.*$`, 'm'), `${chave}=${valor}`);
  fs.writeFileSync(envPath, conteudo);
}

async function criarEnv() {
  console.log('\nPrimeira vez por aqui: vou criar o arquivo de configuração (.env).');
  const usuario = (await perguntar('Usuário do PostgreSQL [postgres]: ')) || 'postgres';
  const senha = await perguntar('Senha desse usuário: ');
  // A porta é só o número do PostgreSQL (normalmente 5432), não o endereço do site
  let porta = '';
  while (!/^\d{2,5}$/.test(porta)) {
    porta = (await perguntar('Porta do PostgreSQL [5432] (só aperte Enter): ')) || '5432';
    if (!/^\d{2,5}$/.test(porta)) console.log('A porta é só um número, normalmente 5432. Tente de novo.');
  }
  const credencial = `${encodeURIComponent(usuario)}:${encodeURIComponent(senha)}`;
  let conteudo = fs.readFileSync(exemploPath, 'utf8');
  conteudo = conteudo
    .replace(/^DATABASE_URL=.*$/m, `DATABASE_URL=postgres://${credencial}@localhost:${porta}/burguer_sabor`)
    .replace(/^DATABASE_URL_TEST=.*$/m, `DATABASE_URL_TEST=postgres://${credencial}@localhost:${porta}/burguer_sabor_test`);
  fs.writeFileSync(envPath, conteudo);
  console.log('Arquivo .env criado (ele fica só neste computador).');
}

function nomeDoBanco(url) {
  return decodeURIComponent(new URL(url).pathname.replace(/^\//, ''));
}

function urlDoServidor(url) {
  const u = new URL(url);
  u.pathname = '/postgres';
  return u.toString();
}

async function main() {
  if (!fs.existsSync(envPath)) await criarEnv();

  let env = lerEnv();
  for (const chave of ['DATABASE_URL', 'DATABASE_URL_TEST']) {
    try {
      new URL(env[chave]);
    } catch {
      console.error(`\nO endereço do banco (${chave}) no arquivo backend\\.env está inválido.`);
      console.error('Apague o arquivo backend\\.env e rode o Iniciar de novo. Na pergunta da porta, só aperte Enter (5432).');
      process.exit(1);
    }
  }
  if (!env.JWT_SECRET || env.JWT_SECRET === SEGREDO_EXEMPLO || env.JWT_SECRET.length < 16) {
    trocarNoEnv('JWT_SECRET', crypto.randomBytes(32).toString('hex'));
    console.log('Segredo de login (JWT_SECRET) gerado automaticamente.');
    env = lerEnv();
  }

  const servidor = new Client({ connectionString: urlDoServidor(env.DATABASE_URL) });
  try {
    await servidor.connect();
  } catch (erro) {
    console.error('\nNão consegui conectar no PostgreSQL.');
    if (erro.code === '28P01') console.error('A senha está errada. Corrija DATABASE_URL e DATABASE_URL_TEST no arquivo backend\\.env.');
    else if (erro.code === 'ECONNREFUSED') console.error('O PostgreSQL parece desligado. Abra "Serviços" do Windows e inicie o serviço postgresql.');
    else console.error(`Detalhe: ${erro.message}`);
    console.error('Para refazer a configuração do zero, apague o arquivo backend\\.env e rode o Iniciar de novo.');
    process.exit(1);
  }

  for (const url of [env.DATABASE_URL, env.DATABASE_URL_TEST].filter(Boolean)) {
    const nome = nomeDoBanco(url);
    const { rows } = await servidor.query('SELECT 1 FROM pg_database WHERE datname = $1', [nome]);
    if (rows.length === 0) {
      // Nome de banco não aceita parâmetro ($1); ele vem do .env local e é validado aqui
      if (!/^[a-z0-9_]+$/.test(nome)) throw new Error(`Nome de banco inválido no .env: ${nome}`);
      await servidor.query(`CREATE DATABASE ${nome}`);
      console.log(`Banco ${nome} criado.`);
    }
  }
  await servidor.end();

  const banco = new Client({ connectionString: env.DATABASE_URL });
  await banco.connect();
  // Se faltar alguma tabela (banco novo ou criado por uma versão antiga), recria tudo com os dados de exemplo
  const tabelas = ['usuarios', 'pedidos', 'movimentacoes_estoque', 'alertas_estoque', 'avaliacoes'];
  const { rows } = await banco.query(
    'SELECT COUNT(*)::int AS existentes FROM unnest($1::text[]) AS t(nome) WHERE to_regclass($2 || t.nome) IS NOT NULL',
    [tabelas, 'public.'],
  );
  await banco.end();
  if (rows[0].existentes < tabelas.length) {
    await resetDatabase(env.DATABASE_URL);
    console.log('Tabelas e dados de exemplo criados.');
  }
  console.log('Banco de dados pronto.');
}

main().catch((erro) => {
  console.error(`\nErro ao preparar: ${erro.message}`);
  // Detalhe técnico para diagnóstico (a senha do banco é escondida)
  console.error(String(erro.stack || '').replace(/(:\/\/[^:\s]*:)[^@\s]*@/g, '$1****@'));
  process.exit(1);
});
