import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { criarApp } from '../helpers';

describe('CT-SWG-007 — documentação Swagger / OpenAPI (RNF04)', () => {
  let app: INestApplication;

  beforeAll(async () => {
    app = await criarApp();
  });
  afterAll(() => app.close());

  it('GET /api-docs abre a interface interativa', async () => {
    const res = await request(app.getHttpServer()).get('/api-docs').expect(200);
    expect(res.text).toContain('swagger');
  });

  it('GET /api-docs-json publica todas as rotas do CRUD', async () => {
    const { body } = await request(app.getHttpServer()).get('/api-docs-json').expect(200);
    expect(body.openapi).toMatch(/^3\./);
    const rotas = Object.keys(body.paths);
    expect(rotas).toEqual(
      expect.arrayContaining([
        '/auth/login',
        '/categorias',
        '/categorias/{id}',
        '/produtos',
        '/produtos/{id}',
        '/produtos/{id}/ficha-tecnica',
        '/insumos',
        '/insumos/{id}/reposicao',
        '/pedidos',
        '/pedidos/{id}/status',
        '/pedidos/{id}/cancelamento',
        '/alertas',
        '/movimentacoes',
        '/relatorios/saida-produtos',
        '/loja',
        '/avaliacoes',
        '/pedidos/{id}/avaliacao',
        '/pedidos/{id}/reembolso',
      ]),
    );
    expect(Object.keys(body.paths['/produtos/{id}'])).toEqual(expect.arrayContaining(['get', 'patch', 'delete']));
  });

  it('documenta schemas de entrada e saída com exemplos', async () => {
    const { body } = await request(app.getHttpServer()).get('/api-docs-json').expect(200);
    const schemas = body.components.schemas;
    expect(schemas).toEqual(
      expect.objectContaining({ CreateProdutoDto: expect.any(Object), ProdutoResponseDto: expect.any(Object), CreatePedidoDto: expect.any(Object), ErroResponseDto: expect.any(Object) }),
    );
    expect(schemas.CreateProdutoDto.properties.preco.example).toBe(36.9);
    expect(schemas.CreateProdutoDto.required).toEqual(expect.arrayContaining(['categoriaId', 'nome', 'preco']));
    expect(body.components.securitySchemes.bearer).toMatchObject({ type: 'http', scheme: 'bearer' });
  });
});
