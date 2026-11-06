import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { ADMIN, bearer, CLIENTE, contratoCategoria, criarApp, esperarErro, login } from '../helpers';

describe('Categorias — CRUD /categorias (RF03 / RN03)', () => {
  let app: INestApplication;
  let admin: string;
  let cliente: string;
  let criadaId: number;

  beforeAll(async () => {
    app = await criarApp();
    admin = await login(app, ADMIN);
    cliente = await login(app, CLIENTE);
  });
  afterAll(() => app.close());

  const api = () => request(app.getHttpServer());

  it('GET 200: público, ordenado por ordem de exibição', async () => {
    const res = await api().get('/categorias').expect(200);
    expect(res.body.length).toBe(6);
    res.body.forEach((c: unknown) => expect(c).toEqual(contratoCategoria));
    expect(res.body.map((c: { nome: string }) => c.nome)).toEqual(['Combos', 'Hambúrgueres', 'Bebidas', 'Acompanhamentos', 'Pizzas', 'Sobremesas']);
  });

  it('GET /:id 200 e 404', async () => {
    const res = await api().get('/categorias/1').expect(200);
    expect(res.body).toEqual({ ...contratoCategoria, id: 1, nome: 'Hambúrgueres' });
    esperarErro((await api().get('/categorias/9999').expect(404)).body, 404);
  });

  it('GET /:id 400: id que não é número', async () => {
    esperarErro((await api().get('/categorias/abc').expect(400)).body, 400);
  });

  it('POST 201: admin cria categoria', async () => {
    const res = await api().post('/categorias').set(bearer(admin)).send({ nome: 'Saladas', ordemExibicao: 7 }).expect(201);
    expect(res.body).toEqual({ id: expect.any(Number), nome: 'Saladas', ordemExibicao: 7, ativo: true });
    criadaId = res.body.id;
  });

  it('POST 409: nome repetido (sem diferenciar maiúsculas)', async () => {
    esperarErro((await api().post('/categorias').set(bearer(admin)).send({ nome: 'sobremesas' }).expect(409)).body, 409);
  });

  it('POST 422: nome vazio', async () => {
    esperarErro((await api().post('/categorias').set(bearer(admin)).send({ nome: '' }).expect(422)).body, 422);
  });

  it('POST 401 sem token e 403 para cliente', async () => {
    esperarErro((await api().post('/categorias').send({ nome: 'X' }).expect(401)).body, 401);
    esperarErro((await api().post('/categorias').set(bearer(cliente)).send({ nome: 'X' }).expect(403)).body, 403);
  });

  it('PATCH 200: desativa e some da lista do app (somenteAtivas=true)', async () => {
    const res = await api().patch(`/categorias/${criadaId}`).set(bearer(admin)).send({ ativo: false }).expect(200);
    expect(res.body.ativo).toBe(false);
    const ativas = await api().get('/categorias?somenteAtivas=true').expect(200);
    expect(ativas.body.some((c: { id: number }) => c.id === criadaId)).toBe(false);
  });

  it('PATCH 400: nenhum campo para atualizar', async () => {
    esperarErro((await api().patch(`/categorias/${criadaId}`).set(bearer(admin)).send({}).expect(400)).body, 400);
  });

  it('PATCH 404: categoria inexistente', async () => {
    await api().patch('/categorias/9999').set(bearer(admin)).send({ nome: 'Y' }).expect(404);
  });

  it('CT-CAT-003 — DELETE 409: categoria com produtos não pode ser excluída', async () => {
    const res = await api().delete('/categorias/1').set(bearer(admin)).expect(409);
    esperarErro(res.body, 409);
    expect(res.body.message).toMatch(/produto/);
    await api().get('/categorias/1').expect(200);
  });

  it('DELETE 204: exclui categoria sem produtos; depois 404', async () => {
    const res = await api().delete(`/categorias/${criadaId}`).set(bearer(admin)).expect(204);
    expect(res.body).toEqual({});
    await api().get(`/categorias/${criadaId}`).expect(404);
  });
});
