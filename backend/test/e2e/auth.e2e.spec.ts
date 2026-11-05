import { INestApplication } from '@nestjs/common';
import { Client } from 'pg';
import request from 'supertest';
import { ADMIN, bearer, CLIENTE, contratoUsuario, criarApp, esperarErro, login } from '../helpers';

describe('Autenticação e perfis (RF01 / RNF01)', () => {
  let app: INestApplication;

  beforeAll(async () => {
    app = await criarApp();
  });
  afterAll(() => app.close());

  describe('POST /auth/login', () => {
    it('200: devolve token e usuário sem o hash da senha', async () => {
      const res = await request(app.getHttpServer()).post('/auth/login').send(CLIENTE).expect(200);
      expect(res.body).toEqual({ accessToken: expect.any(String), tokenType: 'Bearer', usuario: contratoUsuario });
      expect(res.body.usuario).not.toHaveProperty('senhaHash');
      expect(res.body.usuario.tipoUsuario).toBe('CLIENTE');
    });

    it('200: admin recebe perfil ADMIN', async () => {
      const res = await request(app.getHttpServer()).post('/auth/login').send(ADMIN).expect(200);
      expect(res.body.usuario.tipoUsuario).toBe('ADMIN');
    });

    it('401: senha errada', async () => {
      const res = await request(app.getHttpServer()).post('/auth/login').send({ ...CLIENTE, senha: 'errada' }).expect(401);
      esperarErro(res.body, 401);
      expect(res.body.message).toBe('E-mail ou senha inválidos');
    });

    it('401: e-mail inexistente recebe a mesma mensagem', async () => {
      const res = await request(app.getHttpServer()).post('/auth/login').send({ email: 'ninguem@x.com', senha: '123456' }).expect(401);
      expect(res.body.message).toBe('E-mail ou senha inválidos');
    });

    it('422: e-mail em formato inválido', async () => {
      const res = await request(app.getHttpServer()).post('/auth/login').send({ email: 'x', senha: '123' }).expect(422);
      esperarErro(res.body, 422);
    });

    it('400: JSON mal formado', async () => {
      await request(app.getHttpServer())
        .post('/auth/login')
        .set('Content-Type', 'application/json')
        .send('{"email": ')
        .expect(400);
    });
  });

  describe('POST /auth/registro', () => {
    const nova = { nome: 'Maria Souza', email: 'maria@email.com', senha: 'senha123', telefone: '92993333333' };

    it('201: cria sempre um CLIENTE e permite login com a nova senha', async () => {
      const res = await request(app.getHttpServer()).post('/auth/registro').send(nova).expect(201);
      expect(res.body).toEqual({ ...contratoUsuario, id: expect.any(Number) });
      expect(res.body).toMatchObject({ email: 'maria@email.com', tipoUsuario: 'CLIENTE' });
      await login(app, { email: nova.email, senha: nova.senha });
    });

    it('409: e-mail já cadastrado', async () => {
      const res = await request(app.getHttpServer()).post('/auth/registro').send({ ...nova, email: 'MARIA@email.com' }).expect(409);
      esperarErro(res.body, 409);
    });

    it('422: senha curta, telefone inválido e campo extra', async () => {
      const res = await request(app.getHttpServer())
        .post('/auth/registro')
        .send({ ...nova, email: 'outra@email.com', senha: '123', telefone: 'abc', tipoUsuario: 'ADMIN' })
        .expect(422);
      esperarErro(res.body, 422);
      expect(res.body.message).toEqual(
        expect.arrayContaining([expect.stringMatching(/senha/), expect.stringMatching(/telefone/), expect.stringMatching(/tipoUsuario/)]),
      );
    });
  });

  describe('GET /auth/me', () => {
    it('200: com token válido', async () => {
      const token = await login(app, CLIENTE);
      const res = await request(app.getHttpServer()).get('/auth/me').set(bearer(token)).expect(200);
      expect(res.body).toEqual(contratoUsuario);
    });

    it('401: sem token', async () => {
      const res = await request(app.getHttpServer()).get('/auth/me').expect(401);
      esperarErro(res.body, 401);
    });

    it('401: token adulterado', async () => {
      await request(app.getHttpServer()).get('/auth/me').set(bearer('abc.def.ghi')).expect(401);
    });
  });

  it('RNF01: nenhuma senha é gravada em texto, só hash Bcrypt com salt', async () => {
    const client = new Client({ connectionString: process.env.DATABASE_URL });
    await client.connect();
    try {
      const { rows } = await client.query<{ email: string; senha_hash: string }>('SELECT email, senha_hash FROM usuarios');
      expect(rows.length).toBeGreaterThanOrEqual(3);
      for (const row of rows) {
        expect(row.senha_hash).toMatch(/^\$2[aby]\$10\$.{53}$/);
        expect(row.senha_hash).not.toMatch(/^(admin123|cliente123|senha123)$/);
      }
      // Mesma senha gera hashes diferentes (salt)
      const hashes = new Set(rows.map((r) => r.senha_hash));
      expect(hashes.size).toBe(rows.length);
    } finally {
      await client.end();
    }
  });
});
