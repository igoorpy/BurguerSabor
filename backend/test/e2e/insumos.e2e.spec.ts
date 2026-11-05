import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { ADMIN, bearer, CLIENTE, contratoInsumo, criarApp, esperarErro, login } from '../helpers';

describe('Estoque — /insumos, /movimentacoes e /alertas', () => {
  let app: INestApplication;
  let admin: string;
  let cliente: string;
  let cebolaId: number;

  beforeAll(async () => {
    app = await criarApp();
    admin = await login(app, ADMIN);
    cliente = await login(app, CLIENTE);
  });
  afterAll(() => app.close());

  const api = () => request(app.getHttpServer());

  describe('CRUD de insumos', () => {
    it('GET 200: lista com o contrato do DTO', async () => {
      const res = await api().get('/insumos').set(bearer(admin)).expect(200);
      expect(res.body.length).toBe(9);
      res.body.forEach((i: unknown) => expect(i).toEqual(contratoInsumo));
    });

    it('GET 401 sem token e 403 para cliente', async () => {
      await api().get('/insumos').expect(401);
      esperarErro((await api().get('/insumos').set(bearer(cliente)).expect(403)).body, 403);
    });

    it('POST 201: cria insumo e registra o saldo inicial no extrato', async () => {
      const res = await api()
        .post('/insumos')
        .set(bearer(admin))
        .send({ nomeItem: 'Cebola Roxa', unidadeMedida: 'KG', quantidadeDisponivel: 5, precoCusto: 6.5, estoqueMinimo: 1 })
        .expect(201);
      expect(res.body).toEqual({ ...contratoInsumo, nomeItem: 'Cebola Roxa', quantidadeDisponivel: 5, precisaRepor: false });
      cebolaId = res.body.id;

      const extrato = await api().get(`/movimentacoes?insumoId=${cebolaId}`).set(bearer(admin)).expect(200);
      expect(extrato.body).toEqual([expect.objectContaining({ tipo: 'ENTRADA', motivo: 'CADASTRO', quantidade: 5, pedidoId: null })]);
    });

    it('POST 422: saldo negativo (RN01), unidade inválida e custo zero', async () => {
      const res = await api()
        .post('/insumos')
        .set(bearer(admin))
        .send({ nomeItem: 'Teste', unidadeMedida: 'CX', quantidadeDisponivel: -1, precoCusto: 0, estoqueMinimo: 0 })
        .expect(422);
      expect(res.body.message).toEqual(
        expect.arrayContaining([
          expect.stringMatching(/quantidadeDisponivel/),
          expect.stringMatching(/unidadeMedida/),
          expect.stringMatching(/precoCusto/),
        ]),
      );
    });

    it('POST 409: nome repetido', async () => {
      await api()
        .post('/insumos')
        .set(bearer(admin))
        .send({ nomeItem: 'cebola roxa', unidadeMedida: 'KG', quantidadeDisponivel: 1, precoCusto: 1, estoqueMinimo: 0 })
        .expect(409);
    });

    it('PATCH 200: atualiza custo; 422 ao tentar editar o saldo direto', async () => {
      expect((await api().patch(`/insumos/${cebolaId}`).set(bearer(admin)).send({ precoCusto: 7 }).expect(200)).body.precoCusto).toBe(7);
      const res = await api().patch(`/insumos/${cebolaId}`).set(bearer(admin)).send({ quantidadeDisponivel: 999 }).expect(422);
      expect(res.body.message).toEqual(expect.arrayContaining([expect.stringMatching(/quantidadeDisponivel should not exist/)]));
    });

    it('GET /:id 200 e 404', async () => {
      await api().get(`/insumos/${cebolaId}`).set(bearer(admin)).expect(200);
      esperarErro((await api().get('/insumos/9999').set(bearer(admin)).expect(404)).body, 404);
    });

    it('DELETE 409: insumo com histórico ou usado em ficha técnica', async () => {
      await api().delete(`/insumos/${cebolaId}`).set(bearer(admin)).expect(409);
      await api().delete('/insumos/1').set(bearer(admin)).expect(409);
    });

    it('DELETE 204: insumo sem uso e sem histórico', async () => {
      const novo = await api()
        .post('/insumos')
        .set(bearer(admin))
        .send({ nomeItem: 'Gergelim', unidadeMedida: 'G', quantidadeDisponivel: 0, precoCusto: 0.02, estoqueMinimo: 0 })
        .expect(201);
      await api().delete(`/insumos/${novo.body.id}`).set(bearer(admin)).expect(204);
      await api().get(`/insumos/${novo.body.id}`).set(bearer(admin)).expect(404);
    });
  });

  describe('Alertas de reposição e reposição', () => {
    let alertaId: number;

    it('subir o estoque mínimo acima do saldo abre um alerta', async () => {
      await api().patch('/insumos/1').set(bearer(admin)).send({ estoqueMinimo: 60 }).expect(200); // pão: saldo 50
      const res = await api().get('/alertas?resolvido=false').set(bearer(admin)).expect(200);
      const alerta = res.body.find((a: { insumoId: number }) => a.insumoId === 1);
      expect(alerta).toEqual(
        expect.objectContaining({ id: expect.any(Number), nomeItem: 'Pão Brioche', saldo: 50, estoqueMinimo: 60, resolvido: false, mensagem: expect.stringMatching(/acabando/) }),
      );
      alertaId = alerta.id;
      expect((await api().get('/insumos?abaixoDoMinimo=true').set(bearer(admin)).expect(200)).body.map((i: { id: number }) => i.id)).toContain(1);
    });

    it('POST /reposicao 201: saldo sobe, entra no extrato e o alerta é resolvido sozinho', async () => {
      const res = await api().post('/insumos/1/reposicao').set(bearer(admin)).send({ quantidade: 30 }).expect(201);
      expect(res.body).toMatchObject({ id: 1, quantidadeDisponivel: 80, precisaRepor: false });

      const abertos = await api().get('/alertas?resolvido=false').set(bearer(admin)).expect(200);
      expect(abertos.body.some((a: { id: number }) => a.id === alertaId)).toBe(false);

      const extrato = await api().get('/movimentacoes?insumoId=1&tipo=ENTRADA').set(bearer(admin)).expect(200);
      expect(extrato.body[0]).toMatchObject({ motivo: 'REPOSICAO', quantidade: 30 });
    });

    it('POST /reposicao 422 quantidade zero e 404 insumo inexistente', async () => {
      await api().post('/insumos/1/reposicao').set(bearer(admin)).send({ quantidade: 0 }).expect(422);
      await api().post('/insumos/9999/reposicao').set(bearer(admin)).send({ quantidade: 1 }).expect(404);
    });

    it('PATCH /alertas/:id/resolver 200 e 404', async () => {
      await api().patch(`/insumos/${cebolaId}`).set(bearer(admin)).send({ estoqueMinimo: 10 }).expect(200);
      const aberto = (await api().get('/alertas?resolvido=false').set(bearer(admin)).expect(200)).body.find(
        (a: { insumoId: number }) => a.insumoId === cebolaId,
      );
      const res = await api().patch(`/alertas/${aberto.id}/resolver`).set(bearer(admin)).expect(200);
      expect(res.body.resolvido).toBe(true);
      await api().patch('/alertas/9999/resolver').set(bearer(admin)).expect(404);
    });

    it('GET /movimentacoes 422 com tipo inválido', async () => {
      await api().get('/movimentacoes?tipo=OUTRO').set(bearer(admin)).expect(422);
    });
  });
});
