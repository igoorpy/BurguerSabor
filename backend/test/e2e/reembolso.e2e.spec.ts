import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { ADMIN, bearer, CLIENTE, contratoPedido, criarApp, esperarErro, login } from '../helpers';

describe('Reembolso de pedido entregue — /pedidos/{id}/reembolso', () => {
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
  const saldoBatata = async () =>
    (await api().get('/insumos/6').set(bearer(admin)).expect(200)).body.quantidadeDisponivel as number;

  it('422: não dá para pedir reembolso antes de o pedido ser entregue', async () => {
    const novo = await api()
      .post('/pedidos')
      .set(bearer(cliente))
      .send({ enderecoId: 1, formaPagamento: 'PIX', itens: [{ produtoId: 4, quantidade: 1 }] })
      .expect(201);
    pedidoId = novo.body.id;
    expect(novo.body.pagamento.motivoReembolso).toBeNull();
    const res = await api().post(`/pedidos/${pedidoId}/reembolso`).set(bearer(cliente)).send({ motivo: 'Chegou frio' }).expect(422);
    esperarErro(res.body, 422);
    expect(res.body.message).toMatch(/entregue/);
  });

  it('422: motivo curto demais ou ausente', async () => {
    for (const status of ['PREPARANDO', 'SAIU_ENTREGA', 'CONCLUIDO']) {
      await api().patch(`/pedidos/${pedidoId}/status`).set(bearer(admin)).send({ status }).expect(200);
    }
    esperarErro((await api().post(`/pedidos/${pedidoId}/reembolso`).set(bearer(cliente)).send({ motivo: 'ok' }).expect(422)).body, 422);
    esperarErro((await api().post(`/pedidos/${pedidoId}/reembolso`).set(bearer(cliente)).send({}).expect(422)).body, 422);
  });

  it('403: o admin não pede reembolso; 422: a loja não responde sem pedido aguardando', async () => {
    await api().post(`/pedidos/${pedidoId}/reembolso`).set(bearer(admin)).send({ motivo: 'Chegou frio' }).expect(403);
    const res = await api().patch(`/pedidos/${pedidoId}/reembolso`).set(bearer(admin)).send({ aprovar: true }).expect(422);
    expect(res.body.message).toMatch(/aguardando/);
  });

  it('201: o cliente pede reembolso com motivo; 409 se pedir de novo', async () => {
    const res = await api()
      .post(`/pedidos/${pedidoId}/reembolso`)
      .set(bearer(cliente))
      .send({ motivo: 'O lanche chegou frio' })
      .expect(201);
    expect(res.body).toMatchObject(contratoPedido);
    expect(res.body.pagamento).toMatchObject({ statusPagamento: 'REEMBOLSO_SOLICITADO', motivoReembolso: 'O lanche chegou frio' });
    await api().post(`/pedidos/${pedidoId}/reembolso`).set(bearer(cliente)).send({ motivo: 'De novo, por favor' }).expect(409);
  });

  it('200: a loja recusa e o pagamento volta a aprovado', async () => {
    const res = await api().patch(`/pedidos/${pedidoId}/reembolso`).set(bearer(admin)).send({ aprovar: false }).expect(200);
    expect(res.body.pagamento.statusPagamento).toBe('APROVADO');
  });

  it('200: a loja aprova, o pagamento vira reembolsado e o estoque NÃO volta', async () => {
    const antes = await saldoBatata();
    await api().post(`/pedidos/${pedidoId}/reembolso`).set(bearer(cliente)).send({ motivo: 'Chegou frio mesmo' }).expect(201);
    const res = await api().patch(`/pedidos/${pedidoId}/reembolso`).set(bearer(admin)).send({ aprovar: true }).expect(200);
    expect(res.body.pagamento.statusPagamento).toBe('REEMBOLSADO');
    expect(await saldoBatata()).toBe(antes);
    await api().post(`/pedidos/${pedidoId}/reembolso`).set(bearer(cliente)).send({ motivo: 'Mais uma vez' }).expect(409);
  });

  it('422: aprovar precisa ser verdadeiro ou falso', async () => {
    esperarErro((await api().patch(`/pedidos/${pedidoId}/reembolso`).set(bearer(admin)).send({ aprovar: 'sim' }).expect(422)).body, 422);
  });
});
