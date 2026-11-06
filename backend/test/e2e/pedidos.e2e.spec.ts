import { INestApplication } from '@nestjs/common';
import { Client } from 'pg';
import request from 'supertest';
import { ADMIN, bearer, CLIENTE, contratoPedido, criarApp, esperarErro, login } from '../helpers';

/** Lê o saldo direto no banco, para conferir a baixa sem depender da própria API. */
async function saldos(): Promise<Record<string, number>> {
  const client = new Client({ connectionString: process.env.DATABASE_URL });
  await client.connect();
  const { rows } = await client.query<{ nome_item: string; quantidade_disponivel: string }>(
    'SELECT nome_item, quantidade_disponivel FROM insumos_estoque',
  );
  await client.end();
  return Object.fromEntries(rows.map((r) => [r.nome_item, Number(r.quantidade_disponivel)]));
}

async function executar(sql: string): Promise<void> {
  const client = new Client({ connectionString: process.env.DATABASE_URL });
  await client.connect();
  await client.query(sql);
  await client.end();
}

describe('Pedidos, KDS e pagamentos — /pedidos (RF05 a RF08, RF11, RNF03)', () => {
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
  const novoPedido = (body: object) => api().post('/pedidos').set(bearer(cliente)).send(body);

  describe('POST /pedidos — finalizar carrinho', () => {
    it('201: grava pedido, itens com preço histórico e 1 pagamento (RF06 / RF08)', async () => {
      const res = await novoPedido({
        enderecoId: 1,
        formaPagamento: 'PIX',
        itens: [
          { produtoId: 1, quantidade: 2, observacao: 'Sem cebola' },
          { produtoId: 2, quantidade: 1 },
        ],
      }).expect(201);

      expect(res.body).toEqual(expect.objectContaining(contratoPedido));
      expect(res.body).toMatchObject({ clienteId: 2, enderecoId: 1, status: 'RECEBIDO', taxaEntrega: 5, valorTotal: 68 });
      expect(res.body.itens).toEqual([
        expect.objectContaining({ produtoId: 1, quantidade: 2, precoUnitario: 28.5, subtotal: 57, observacao: 'Sem cebola' }),
        expect.objectContaining({ produtoId: 2, quantidade: 1, precoUnitario: 6, subtotal: 6, observacao: null }),
      ]);
      expect(res.body.pagamento).toEqual({ formaPagamento: 'PIX', statusPagamento: 'APROVADO', valorPago: 68, motivoReembolso: null });
      pedidoId = res.body.id;
    });

    it('RF05: baixa automática exata da ficha técnica', async () => {
      const s = await saldos();
      expect(s['Pão Brioche']).toBe(48); // 50 − 2
      expect(s['Hambúrguer Blend 180g']).toBe(38); // 40 − 2
      expect(s['Queijo Cheddar Fatiado']).toBe(920); // 1000 − 2 × 40 g
      expect(s['Refrigerante Lata 350ml']).toBe(29); // 30 − 1
    });

    it('GET /movimentacoes?pedidoId: mostra o que o pedido descontou', async () => {
      const res = await api().get(`/movimentacoes?pedidoId=${pedidoId}`).set(bearer(admin)).expect(200);
      expect(res.body).toHaveLength(4);
      res.body.forEach((m: { tipo: string; motivo: string; pedidoId: number }) =>
        expect(m).toMatchObject({ tipo: 'SAIDA', motivo: 'PEDIDO', pedidoId }),
      );
    });

    it('RF06: mudar o preço do produto não altera o pedido já gravado', async () => {
      await api().patch('/produtos/1').set(bearer(admin)).send({ preco: 30 }).expect(200);
      const res = await api().get(`/pedidos/${pedidoId}`).set(bearer(cliente)).expect(200);
      expect(res.body.itens[0].precoUnitario).toBe(28.5);
      await api().patch('/produtos/1').set(bearer(admin)).send({ preco: 28.5 }).expect(200);
    });

    it('422: carrinho vazio, quantidade zero e forma de pagamento inválida', async () => {
      const res = await novoPedido({ enderecoId: 1, formaPagamento: 'BOLETO', itens: [] }).expect(422);
      esperarErro(res.body, 422);
      expect(res.body.message).toEqual(expect.arrayContaining([expect.stringMatching(/formaPagamento/), expect.stringMatching(/item/)]));
      await novoPedido({ enderecoId: 1, formaPagamento: 'PIX', itens: [{ produtoId: 1, quantidade: 0 }] }).expect(422);
    });

    it('422: produto inexistente e endereço que não é do cliente', async () => {
      await novoPedido({ enderecoId: 1, formaPagamento: 'PIX', itens: [{ produtoId: 999, quantidade: 1 }] }).expect(422);
      const res = await novoPedido({ enderecoId: 999, formaPagamento: 'PIX', itens: [{ produtoId: 2, quantidade: 1 }] }).expect(422);
      expect(res.body.message).toMatch(/Endereço/);
    });

    it('403: admin não finaliza carrinho; 401 sem token', async () => {
      await api().post('/pedidos').set(bearer(admin)).send({ enderecoId: 1, formaPagamento: 'PIX', itens: [{ produtoId: 2, quantidade: 1 }] }).expect(403);
      await api().post('/pedidos').send({}).expect(401);
    });

    it('CT-MOB-005: carrinho editado para 2 unidades grava exatamente 2 no banco', async () => {
      // O app soma +1, +1, +1 e tira 1: o que chega à API é a quantidade final
      const res = await novoPedido({ enderecoId: 1, formaPagamento: 'CARTAO_DEBITO', itens: [{ produtoId: 4, quantidade: 2 }] }).expect(201);
      expect(res.body.itens[0]).toMatchObject({ quantidade: 2, subtotal: 28 });
      expect(res.body.valorTotal).toBe(33);
    });
  });

  describe('CT-EST-001 — trava de saldo negativo (RN01 / RNF03)', () => {
    it('422: pão com saldo 1,00 não atende 2 hambúrgueres; nada é gravado (ROLLBACK)', async () => {
      await executar("UPDATE insumos_estoque SET quantidade_disponivel = 1 WHERE nome_item = 'Pão Brioche'");
      const antes = (await api().get('/pedidos').set(bearer(admin)).expect(200)).body.length;
      const blendAntes = (await saldos())['Hambúrguer Blend 180g'];

      const res = await novoPedido({ enderecoId: 1, formaPagamento: 'PIX', itens: [{ produtoId: 1, quantidade: 2 }] }).expect(422);
      esperarErro(res.body, 422);
      expect(res.body.message).toBe('Estoque insuficiente para atender o pedido');
      expect(res.body.details).toEqual([expect.objectContaining({ nomeItem: 'Pão Brioche', necessario: 2, disponivel: 1 })]);

      const depois = await saldos();
      expect(depois['Pão Brioche']).toBe(1); // continua 1,00, nunca negativo
      expect(depois['Hambúrguer Blend 180g']).toBe(blendAntes); // nenhum insumo foi baixado pela metade
      expect((await api().get('/pedidos').set(bearer(admin)).expect(200)).body.length).toBe(antes);
    });

    it('com saldo exato (1 pão para 1 hambúrguer) o pedido passa e o saldo vai a 0', async () => {
      await novoPedido({ enderecoId: 1, formaPagamento: 'PIX', itens: [{ produtoId: 1, quantidade: 1 }] }).expect(201);
      expect((await saldos())['Pão Brioche']).toBe(0);
      await api().post('/insumos/1/reposicao').set(bearer(admin)).send({ quantidade: 50 }).expect(201);
    });

    it('chegar no estoque mínimo gera alerta de reposição para o admin', async () => {
      // O pão chegou a 0 no teste anterior (mínimo 10) e foi reposto para 50: o alerta abriu e foi resolvido
      const todos = await api().get('/alertas').set(bearer(admin)).expect(200);
      expect(todos.body.some((a: { insumoId: number; resolvido: boolean }) => a.insumoId === 1 && a.resolvido)).toBe(true);
    });
  });

  describe('RF07 / CT-KDS-006 — fluxo de status', () => {
    it('422: RECEBIDO → CONCLUIDO é negado e exige PREPARANDO', async () => {
      const res = await api().patch(`/pedidos/${pedidoId}/status`).set(bearer(admin)).send({ status: 'CONCLUIDO' }).expect(422);
      esperarErro(res.body, 422);
      expect(res.body.details).toMatchObject({ statusAtual: 'RECEBIDO', proximoPermitido: 'PREPARANDO' });
      expect((await api().get(`/pedidos/${pedidoId}`).set(bearer(admin)).expect(200)).body.status).toBe('RECEBIDO');
    });

    it('200: avança uma etapa por vez até CONCLUIDO; dinheiro é aprovado na entrega', async () => {
      const dinheiro = await novoPedido({ enderecoId: 1, formaPagamento: 'DINHEIRO', itens: [{ produtoId: 2, quantidade: 1 }] }).expect(201);
      expect(dinheiro.body.pagamento.statusPagamento).toBe('PENDENTE');

      for (const status of ['PREPARANDO', 'SAIU_ENTREGA', 'CONCLUIDO']) {
        const res = await api().patch(`/pedidos/${dinheiro.body.id}/status`).set(bearer(admin)).send({ status }).expect(200);
        expect(res.body.status).toBe(status);
      }
      const final = await api().get(`/pedidos/${dinheiro.body.id}`).set(bearer(admin)).expect(200);
      expect(final.body.pagamento.statusPagamento).toBe('APROVADO');
      await api().patch(`/pedidos/${dinheiro.body.id}/status`).set(bearer(admin)).send({ status: 'PREPARANDO' }).expect(422);
    });

    it('422 status desconhecido, 403 cliente, 404 pedido inexistente', async () => {
      await api().patch(`/pedidos/${pedidoId}/status`).set(bearer(admin)).send({ status: 'VOANDO' }).expect(422);
      await api().patch(`/pedidos/${pedidoId}/status`).set(bearer(cliente)).send({ status: 'PREPARANDO' }).expect(403);
      await api().patch('/pedidos/9999/status').set(bearer(admin)).send({ status: 'PREPARANDO' }).expect(404);
    });
  });

  describe('RF11 — cancelamento', () => {
    it('cliente cancela o próprio pedido RECEBIDO e os insumos voltam ao estoque', async () => {
      const novo = await novoPedido({ enderecoId: 1, formaPagamento: 'PIX', itens: [{ produtoId: 3, quantidade: 1 }] }).expect(201);
      const antes = await saldos();
      const res = await api().post(`/pedidos/${novo.body.id}/cancelamento`).set(bearer(cliente)).expect(200);
      expect(res.body).toMatchObject({ status: 'CANCELADO', pagamento: { statusPagamento: 'RECUSADO' } });
      const depois = await saldos();
      expect(depois['Pão Brioche']).toBe(antes['Pão Brioche'] + 1);
      expect(depois['Bacon Fatiado']).toBe(antes['Bacon Fatiado'] + 30);
    });

    it('cliente não cancela pedido em preparo; admin cancela', async () => {
      await api().patch(`/pedidos/${pedidoId}/status`).set(bearer(admin)).send({ status: 'PREPARANDO' }).expect(200);
      esperarErro((await api().post(`/pedidos/${pedidoId}/cancelamento`).set(bearer(cliente)).expect(422)).body, 422);
      await api().post(`/pedidos/${pedidoId}/cancelamento`).set(bearer(admin)).expect(200);
      await api().post(`/pedidos/${pedidoId}/cancelamento`).set(bearer(admin)).expect(422); // já cancelado
    });
  });

  describe('Consulta e relatório', () => {
    it('GET 200: cliente vê só os próprios pedidos; admin vê todos', async () => {
      await api().post('/auth/registro').send({ nome: 'Ana', email: 'ana@email.com', senha: 'senha123', telefone: '92995555555' }).expect(201);
      const ana = await login(app, { email: 'ana@email.com', senha: 'senha123' });
      expect((await api().get('/pedidos').set(bearer(ana)).expect(200)).body).toEqual([]);
      await api().get(`/pedidos/${pedidoId}`).set(bearer(ana)).expect(404);
      expect((await api().get('/pedidos').set(bearer(admin)).expect(200)).body.length).toBeGreaterThan(0);
    });

    it('GET ?status filtra; 422 para status inválido', async () => {
      const cancelados = await api().get('/pedidos?status=CANCELADO').set(bearer(admin)).expect(200);
      expect(cancelados.body.every((p: { status: string }) => p.status === 'CANCELADO')).toBe(true);
      await api().get('/pedidos?status=XYZ').set(bearer(admin)).expect(422);
    });

    it('GET /relatorios/saida-produtos: ignora cancelados e soma o faturamento', async () => {
      const res = await api().get('/relatorios/saida-produtos').set(bearer(admin)).expect(200);
      const batata = res.body.find((s: { produtoId: number }) => s.produtoId === 4);
      expect(batata).toEqual({ produtoId: 4, nome: 'Batata Frita Média', quantidadeVendida: 2, faturamento: 28 });
      expect(res.body.some((s: { produtoId: number }) => s.produtoId === 3)).toBe(false); // X-Bacon só teve pedido cancelado
      await api().get('/relatorios/saida-produtos').set(bearer(cliente)).expect(403);
      await api().get('/relatorios/saida-produtos?de=ontem').set(bearer(admin)).expect(422);
    });
  });
});
