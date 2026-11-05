import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { configureApp } from '../src/configure-app';

// eslint-disable-next-line @typescript-eslint/no-var-requires
const { resetDatabase } = require('../scripts/reset-db');

export const ADMIN = { email: 'admin@burguersabor.com', senha: 'admin123' };
export const CLIENTE = { email: 'hudson@email.com', senha: 'cliente123' };

/** Recria o banco de teste (schema.sql + seed.sql) e sobe a API com a mesma configuração do main.ts. */
export async function criarApp(): Promise<INestApplication> {
  await resetDatabase(process.env.DATABASE_URL);
  const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
  const app = moduleRef.createNestApplication();
  configureApp(app);
  await app.init();
  return app;
}

export async function login(app: INestApplication, credenciais: { email: string; senha: string }): Promise<string> {
  const res = await request(app.getHttpServer()).post('/auth/login').send(credenciais).expect(200);
  return res.body.accessToken as string;
}

export const bearer = (token: string) => ({ Authorization: `Bearer ${token}` });

/** Contrato do corpo de erro, igual para toda a API. */
export function esperarErro(body: unknown, status: number): void {
  expect(body).toEqual(
    expect.objectContaining({
      statusCode: status,
      error: expect.any(String),
      message: expect.anything(),
      path: expect.any(String),
      timestamp: expect.any(String),
    }),
  );
}

// ---------- Contratos JSON de sucesso ----------

export const contratoUsuario = {
  id: expect.any(Number),
  nome: expect.any(String),
  email: expect.any(String),
  telefone: expect.any(String),
  tipoUsuario: expect.stringMatching(/^(CLIENTE|ADMIN)$/),
};

export const contratoCategoria = {
  id: expect.any(Number),
  nome: expect.any(String),
  ordemExibicao: expect.any(Number),
  ativo: expect.any(Boolean),
};

export const contratoProduto = {
  id: expect.any(Number),
  categoriaId: expect.any(Number),
  categoriaNome: expect.any(String),
  categoriaAtiva: expect.any(Boolean),
  nome: expect.any(String),
  preco: expect.any(Number),
  disponivel: expect.any(Boolean),
  temEstoque: expect.any(Boolean),
  disponivelParaVenda: expect.any(Boolean),
};

export const contratoInsumo = {
  id: expect.any(Number),
  nomeItem: expect.any(String),
  unidadeMedida: expect.stringMatching(/^(UN|KG|L|G|ML)$/),
  quantidadeDisponivel: expect.any(Number),
  precoCusto: expect.any(Number),
  estoqueMinimo: expect.any(Number),
  precisaRepor: expect.any(Boolean),
};

export const contratoEndereco = {
  id: expect.any(Number),
  usuarioId: expect.any(Number),
  rua: expect.any(String),
  numero: expect.any(String),
  bairro: expect.any(String),
  cep: expect.stringMatching(/^\d{5}-\d{3}$/),
};

export const contratoPedido = {
  id: expect.any(Number),
  clienteId: expect.any(Number),
  enderecoId: expect.any(Number),
  status: expect.stringMatching(/^(RECEBIDO|PREPARANDO|SAIU_ENTREGA|CONCLUIDO|CANCELADO)$/),
  taxaEntrega: expect.any(Number),
  valorTotal: expect.any(Number),
  criadoEm: expect.any(String),
  itens: expect.arrayContaining([
    expect.objectContaining({
      produtoId: expect.any(Number),
      produtoNome: expect.any(String),
      quantidade: expect.any(Number),
      precoUnitario: expect.any(Number),
      subtotal: expect.any(Number),
    }),
  ]),
  pagamento: expect.objectContaining({
    formaPagamento: expect.any(String),
    statusPagamento: expect.any(String),
    valorPago: expect.any(Number),
  }),
};
