import { INestApplication } from '@nestjs/common';
import { Client } from 'pg';
import request from 'supertest';
import { ADMIN, bearer, CLIENTE, contratoProduto, criarApp, esperarErro, login } from '../helpers';

describe('Produtos, ficha técnica e custo — /produtos (RF03 / RF04 / RF10 / RN02 / RN04)', () => {
  let app: INestApplication;
  let admin: string;
  let cliente: string;
  let novoId: number;

  beforeAll(async () => {
    app = await criarApp();
    admin = await login(app, ADMIN);
    cliente = await login(app, CLIENTE);
  });
  afterAll(() => app.close());

  const api = () => request(app.getHttpServer());

  describe('Catálogo', () => {
    it('CT-SWG-007 / GET 200: catálogo público com o contrato do DTO', async () => {
      const res = await api().get('/produtos').expect(200);
      expect(res.body.length).toBe(5);
      res.body.forEach((p: unknown) => expect(p).toEqual(expect.objectContaining(contratoProduto)));
    });

    it('CT-MOB-004: busca "Cheddar" devolve só produtos com o termo', async () => {
      const res = await api().get('/produtos').query({ busca: 'Cheddar' }).expect(200);
      expect(res.body.map((p: { nome: string }) => p.nome).sort()).toEqual(['Burguer X-Bacon', 'Burguer X-Cheddar']);
    });

    it('busca sem resultados devolve lista vazia', async () => {
      expect((await api().get('/produtos?busca=lasanha').expect(200)).body).toEqual([]);
    });

    it('filtra por categoria (barra de opções do app)', async () => {
      const res = await api().get('/produtos?categoriaId=2').expect(200);
      expect(res.body).toHaveLength(1);
      expect(res.body[0].categoriaNome).toBe('Bebidas');
    });

    it('422: filtro inválido', async () => {
      esperarErro((await api().get('/produtos?categoriaId=abc').expect(422)).body, 422);
      await api().get('/produtos?somenteDisponiveis=talvez').expect(422);
    });

    it('GET /:id 200 e 404', async () => {
      expect((await api().get('/produtos/1').expect(200)).body).toMatchObject({ id: 1, nome: 'Burguer X-Cheddar', preco: 28.5 });
      esperarErro((await api().get('/produtos/9999').expect(404)).body, 404);
    });
  });

  describe('CRUD (admin)', () => {
    it('POST 201: cria produto', async () => {
      const res = await api()
        .post('/produtos')
        .set(bearer(admin))
        .send({ categoriaId: 1, nome: 'Burguer Duplo', descricao: 'Dois blends', preco: 39.9 })
        .expect(201);
      expect(res.body).toEqual(expect.objectContaining({ ...contratoProduto, nome: 'Burguer Duplo', preco: 39.9, disponivel: true }));
      novoId = res.body.id;
    });

    it.each([0, -5])('CT-PRD-002 — POST 422: preço %p é rejeitado (RN02)', async (preco) => {
      const res = await api().post('/produtos').set(bearer(admin)).send({ categoriaId: 1, nome: 'Grátis', preco }).expect(422);
      esperarErro(res.body, 422);
      expect(res.body.message).toEqual(expect.arrayContaining([expect.stringMatching(/preco/)]));
    });

    it('CT-PRD-002: o banco também rejeita preço 0 (CHECK preco > 0)', async () => {
      const client = new Client({ connectionString: process.env.DATABASE_URL });
      await client.connect();
      await expect(client.query("INSERT INTO produtos (categoria_id, nome, preco) VALUES (1, 'X', 0)")).rejects.toMatchObject({ code: '23514' });
      await client.end();
    });

    it('POST 422: categoria inexistente (produto exige categoria — RF03)', async () => {
      const res = await api().post('/produtos').set(bearer(admin)).send({ categoriaId: 999, nome: 'X', preco: 10 }).expect(422);
      expect(res.body.message).toMatch(/Categoria/);
    });

    it('POST 403: cliente não cadastra produto', async () => {
      await api().post('/produtos').set(bearer(cliente)).send({ categoriaId: 1, nome: 'X', preco: 10 }).expect(403);
    });

    it('PATCH 422: nulo em campo obrigatório; descrição pode ser limpa com null', async () => {
      const nome = await api().patch(`/produtos/${novoId}`).set(bearer(admin)).send({ nome: null }).expect(422);
      esperarErro(nome.body, 422);
      expect(nome.body.message).toBe('nome não pode ser nulo');
      await api().patch(`/produtos/${novoId}`).set(bearer(admin)).send({ disponivel: null }).expect(422);
      await api().patch(`/produtos/${novoId}`).set(bearer(admin)).send({ preco: null }).expect(422);
      const limpa = await api().patch(`/produtos/${novoId}`).set(bearer(admin)).send({ descricao: null }).expect(200);
      expect(limpa.body).toMatchObject({ descricao: null, disponivel: true });
    });

    it('PATCH 200: atualiza preço; 400 sem campos; 404 inexistente', async () => {
      expect((await api().patch(`/produtos/${novoId}`).set(bearer(admin)).send({ preco: 41 }).expect(200)).body.preco).toBe(41);
      await api().patch(`/produtos/${novoId}`).set(bearer(admin)).send({}).expect(400);
      await api().patch('/produtos/9999').set(bearer(admin)).send({ preco: 1 }).expect(404);
    });
  });

  describe('Ficha técnica (RF04)', () => {
    it('PUT 200: define a receita; GET 200 devolve a ficha', async () => {
      const itens = [
        { insumoId: 1, quantidadeNecessaria: 1 },
        { insumoId: 2, quantidadeNecessaria: 2 },
      ];
      const res = await api().put(`/produtos/${novoId}/ficha-tecnica`).set(bearer(admin)).send({ itens }).expect(200);
      expect(res.body).toHaveLength(2);
      expect(res.body[0]).toEqual({ insumoId: expect.any(Number), nomeItem: expect.any(String), unidadeMedida: expect.any(String), quantidadeNecessaria: expect.any(Number) });
      expect((await api().get(`/produtos/${novoId}/ficha-tecnica`).set(bearer(admin)).expect(200)).body).toHaveLength(2);
    });

    it('PUT 422: quantidade zero (RN02), insumo repetido e insumo inexistente', async () => {
      await api().put(`/produtos/${novoId}/ficha-tecnica`).set(bearer(admin)).send({ itens: [{ insumoId: 1, quantidadeNecessaria: 0 }] }).expect(422);
      await api()
        .put(`/produtos/${novoId}/ficha-tecnica`)
        .set(bearer(admin))
        .send({ itens: [{ insumoId: 1, quantidadeNecessaria: 1 }, { insumoId: 1, quantidadeNecessaria: 2 }] })
        .expect(422);
      await api().put(`/produtos/${novoId}/ficha-tecnica`).set(bearer(admin)).send({ itens: [{ insumoId: 999, quantidadeNecessaria: 1 }] }).expect(422);
      // Nenhuma tentativa inválida alterou a ficha
      expect((await api().get(`/produtos/${novoId}/ficha-tecnica`).set(bearer(admin)).expect(200)).body).toHaveLength(2);
    });

    it('PUT 404: produto inexistente', async () => {
      await api().put('/produtos/9999/ficha-tecnica').set(bearer(admin)).send({ itens: [] }).expect(404);
    });
  });

  describe('Custo e lucro', () => {
    it('GET 200: X-Cheddar custa R$ 9,50 e dá R$ 19,00 de lucro', async () => {
      const res = await api().get('/produtos/1/custo').set(bearer(admin)).expect(200);
      expect(res.body).toMatchObject({ produtoId: 1, preco: 28.5, custo: 9.5, lucro: 19, margemPercentual: 66.67 });
      expect(res.body.itens).toHaveLength(3);
    });

    it('GET 403: cliente não vê custo', async () => {
      await api().get('/produtos/1/custo').set(bearer(cliente)).expect(403);
    });
  });

  describe('Categoria desativada', () => {
    it('tira os produtos dela do catálogo de venda e eles não podem ser pedidos', async () => {
      await api().patch('/categorias/3').set(bearer(admin)).send({ ativo: false }).expect(200); // Acompanhamentos
      const venda = await api().get('/produtos?somenteDisponiveis=true').expect(200);
      expect(venda.body.some((p: { id: number }) => p.id === 4)).toBe(false);
      expect((await api().get('/produtos/4').expect(200)).body).toMatchObject({ categoriaAtiva: false, disponivelParaVenda: false });

      const pedido = await api()
        .post('/pedidos')
        .set(bearer(cliente))
        .send({ enderecoId: 1, formaPagamento: 'PIX', itens: [{ produtoId: 4, quantidade: 1 }] })
        .expect(422);
      expect(pedido.body.message).toMatch(/indisponível/);
      await api().patch('/categorias/3').set(bearer(admin)).send({ ativo: true }).expect(200);
    });
  });

  describe('RN04 — trava de insumo indisponível', () => {
    it('sem pão no estoque, os hambúrgueres saem do catálogo de venda', async () => {
      const client = new Client({ connectionString: process.env.DATABASE_URL });
      await client.connect();
      await client.query("UPDATE insumos_estoque SET quantidade_disponivel = 0 WHERE nome_item = 'Pão Brioche'");
      await client.end();

      const venda = await api().get('/produtos?somenteDisponiveis=true').expect(200);
      const nomes = venda.body.map((p: { nome: string }) => p.nome);
      expect(nomes).not.toContain('Burguer X-Cheddar');
      expect(nomes).not.toContain('Burguer X-Bacon');
      expect(nomes).toContain('Refrigerante Cola 350ml');

      const xCheddar = await api().get('/produtos/1').expect(200);
      expect(xCheddar.body).toMatchObject({ disponivel: true, temEstoque: false, disponivelParaVenda: false });
    });
  });

  describe('Exclusão', () => {
    it('DELETE 204: produto nunca vendido; depois 404', async () => {
      await api().delete(`/produtos/${novoId}`).set(bearer(admin)).expect(204);
      await api().get(`/produtos/${novoId}`).expect(404);
    });

    it('DELETE 404: inexistente', async () => {
      await api().delete('/produtos/9999').set(bearer(admin)).expect(404);
    });
  });
});
