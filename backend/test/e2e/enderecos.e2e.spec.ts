import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { ADMIN, bearer, CLIENTE, contratoEndereco, criarApp, esperarErro, login } from '../helpers';

describe('Endereços do cliente — /enderecos (RF02)', () => {
  let app: INestApplication;
  let cliente: string;
  let outroCliente: string;
  let admin: string;
  let enderecoId: number;

  beforeAll(async () => {
    app = await criarApp();
    cliente = await login(app, CLIENTE);
    admin = await login(app, ADMIN);
    await request(app.getHttpServer())
      .post('/auth/registro')
      .send({ nome: 'Outra Pessoa', email: 'outra@email.com', senha: 'senha123', telefone: '92994444444' })
      .expect(201);
    outroCliente = await login(app, { email: 'outra@email.com', senha: 'senha123' });
  });
  afterAll(() => app.close());

  const api = () => request(app.getHttpServer());

  it('GET 200: lista só os endereços do cliente logado', async () => {
    const res = await api().get('/enderecos').set(bearer(cliente)).expect(200);
    expect(res.body).toHaveLength(1);
    expect(res.body[0]).toEqual(expect.objectContaining(contratoEndereco));
    expect((await api().get('/enderecos').set(bearer(outroCliente)).expect(200)).body).toEqual([]);
  });

  it('POST 201: cadastra mais um endereço (1:N)', async () => {
    const res = await api()
      .post('/enderecos')
      .set(bearer(cliente))
      .send({ rua: 'Av. Djalma Batista', numero: '1200', bairro: 'Chapada', cep: '69050-010', pontoReferencia: 'Shopping' })
      .expect(201);
    expect(res.body).toEqual({ ...contratoEndereco, pontoReferencia: 'Shopping', usuarioId: 2 });
    enderecoId = res.body.id;
    expect((await api().get('/enderecos').set(bearer(cliente)).expect(200)).body).toHaveLength(2);
  });

  it('POST 422: CEP fora do formato', async () => {
    esperarErro((await api().post('/enderecos').set(bearer(cliente)).send({ rua: 'R', numero: '1', bairro: 'B', cep: '69050010' }).expect(422)).body, 422);
  });

  it('GET /:id 404 para endereço de outro cliente', async () => {
    await api().get(`/enderecos/${enderecoId}`).set(bearer(cliente)).expect(200);
    await api().get(`/enderecos/${enderecoId}`).set(bearer(outroCliente)).expect(404);
  });

  it('PATCH 200 e 400 sem campos', async () => {
    expect((await api().patch(`/enderecos/${enderecoId}`).set(bearer(cliente)).send({ numero: '1300' }).expect(200)).body.numero).toBe('1300');
    await api().patch(`/enderecos/${enderecoId}`).set(bearer(cliente)).send({}).expect(400);
  });

  it('403: admin não usa a rota de endereços de cliente', async () => {
    await api().get('/enderecos').set(bearer(admin)).expect(403);
  });

  it('DELETE 409: endereço já usado em pedido', async () => {
    await api()
      .post('/pedidos')
      .set(bearer(cliente))
      .send({ enderecoId: 1, formaPagamento: 'PIX', itens: [{ produtoId: 2, quantidade: 1 }] })
      .expect(201);
    esperarErro((await api().delete('/enderecos/1').set(bearer(cliente)).expect(409)).body, 409);
  });

  it('DELETE 204: endereço sem pedidos; depois 404', async () => {
    await api().delete(`/enderecos/${enderecoId}`).set(bearer(cliente)).expect(204);
    await api().get(`/enderecos/${enderecoId}`).set(bearer(cliente)).expect(404);
  });
});
