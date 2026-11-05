import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { ADMIN, bearer, CLIENTE, criarApp, esperarErro, login } from '../helpers';

describe('Loja e avaliação do pedido — /loja, /pedidos/{id}/avaliacao, /avaliacoes', () => {
  let app: INestApplication;
  let admin: string;
  let cliente: string;
  let pedidoId: number;

  beforeAll(async () => {
    app = await criarApp();
    admin = await login(app, ADMIN);
    cliente = await login(app, CLIENTE);
  });
  afterAll(() => app.close());

  const api = () => request(app.getHttpServer());

  it('GET /loja 200: público, com taxa, tempo de entrega e sem nota ainda', async () => {
    const res = await api().get('/loja').expect(200);
    expect(res.body).toEqual({
      nome: 'Burguer & Sabor',
      taxaEntrega: 5,
      tempoEntregaMin: expect.any(Number),
      tempoEntregaMax: expect.any(Number),
      notaMedia: null,
      totalAvaliacoes: 0,
    });
    expect(res.body.tempoEntregaMax).toBeGreaterThanOrEqual(res.body.tempoEntregaMin);
  });

  it('produtos do seed vêm com foto (imagemUrl)', async () => {
    const res = await api().get('/produtos/1').expect(200);
    expect(res.body.imagemUrl).toBe('/img/x-cheddar.svg');
  });

  it('422: não dá para avaliar antes de o pedido ser entregue', async () => {
    const novo = await api()
      .post('/pedidos')
      .set(bearer(cliente))
      .send({ enderecoId: 1, formaPagamento: 'PIX', itens: [{ produtoId: 2, quantidade: 1 }] })
      .expect(201);
    pedidoId = novo.body.id;
    expect(novo.body.avaliacao).toBeNull();
    const res = await api().post(`/pedidos/${pedidoId}/avaliacao`).set(bearer(cliente)).send({ nota: 5 }).expect(422);
    esperarErro(res.body, 422);
    expect(res.body.message).toMatch(/entregue/);
  });

  it('201: depois de entregue, o cliente avalia e a avaliação volta no pedido', async () => {
    for (const status of ['PREPARANDO', 'SAIU_ENTREGA', 'CONCLUIDO']) {
      await api().patch(`/pedidos/${pedidoId}/status`).set(bearer(admin)).send({ status }).expect(200);
    }
    const res = await api()
      .post(`/pedidos/${pedidoId}/avaliacao`)
      .set(bearer(cliente))
      .send({ nota: 4, comentario: 'Chegou quentinho!' })
      .expect(201);
    expect(res.body.avaliacao).toEqual({ nota: 4, comentario: 'Chegou quentinho!', criadoEm: expect.any(String) });
  });

  it('409: o mesmo pedido não é avaliado duas vezes', async () => {
    esperarErro((await api().post(`/pedidos/${pedidoId}/avaliacao`).set(bearer(cliente)).send({ nota: 5 }).expect(409)).body, 409);
  });

  it('422: nota fora de 1 a 5; 403: admin não avalia; 404: pedido inexistente', async () => {
    await api().post(`/pedidos/${pedidoId}/avaliacao`).set(bearer(cliente)).send({ nota: 6 }).expect(422);
    await api().post(`/pedidos/${pedidoId}/avaliacao`).set(bearer(cliente)).send({ nota: 0 }).expect(422);
    await api().post(`/pedidos/${pedidoId}/avaliacao`).set(bearer(admin)).send({ nota: 5 }).expect(403);
    await api().post('/pedidos/9999/avaliacao').set(bearer(cliente)).send({ nota: 5 }).expect(404);
  });

  it('GET /loja: a nota média passa a considerar a avaliação', async () => {
    const res = await api().get('/loja').expect(200);
    expect(res.body).toMatchObject({ notaMedia: 4, totalAvaliacoes: 1 });
  });

  it('GET /avaliacoes 200 para o admin (com nome do cliente) e 403 para o cliente', async () => {
    const res = await api().get('/avaliacoes').set(bearer(admin)).expect(200);
    expect(res.body).toEqual([
      { pedidoId, clienteNome: 'Hudson Cliente', nota: 4, comentario: 'Chegou quentinho!', criadoEm: expect.any(String) },
    ]);
    await api().get('/avaliacoes').set(bearer(cliente)).expect(403);
  });

  it('foto do produto: aceita https:// ou caminho do site e recusa outros formatos', async () => {
    await api().patch('/produtos/2').set(bearer(admin)).send({ imagemUrl: 'https://exemplo.com/refri.jpg' }).expect(200);
    await api().patch('/produtos/2').set(bearer(admin)).send({ imagemUrl: '/img/refrigerante.svg' }).expect(200);
    const res = await api().patch('/produtos/2').set(bearer(admin)).send({ imagemUrl: 'ftp://x/y.png' }).expect(422);
    expect(res.body.message).toEqual(expect.arrayContaining([expect.stringMatching(/imagemUrl/)]));
  });
});
