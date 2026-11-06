# Burguer & Sabor — Backend (NestJS + PostgreSQL)

API REST do Burguer & Sabor, um **projeto de apresentação**: os pagamentos são simulados e as senhas são fictícias.
Segue os requisitos de [`docs/01-requisitos-e-regras.md`](../docs/01-requisitos-e-regras.md) e os casos de teste de
[`docs/03-casos-de-teste.md`](../docs/03-casos-de-teste.md).

## Arquitetura em camadas

```
src/
├── domain/            Regras de negócio puras (sem banco e sem HTTP)
│   ├── entities.ts        Entidades e enums do DER
│   ├── pedido.rules.ts    Fluxo de status, cancelamento, totais, pagamento simulado
│   ├── estoque.rules.ts   Consumo pela ficha técnica, falta de insumo, alerta de reposição
│   ├── produto.rules.ts   Custo, lucro e margem
│   └── money.ts           Contas em centavos (sem erro de ponto flutuante)
├── database/          Pool de conexões pg, transações (COMMIT/ROLLBACK) e UPDATE parametrizado
├── common/            Erros de domínio, filtro global de erros, autenticação JWT e perfis (RBAC)
└── modules/<recurso>/
    ├── *.controller.ts    Rotas HTTP + documentação Swagger
    ├── *.service.ts       Regras de negócio e orquestração (transações)
    ├── *.repository.ts    Único lugar com SQL (sempre parametrizado: $1, $2...)
    └── dto/               Validação de entrada (class-validator) e formato de saída
```

O fluxo de uma requisição é **Controller → Service → Repository → PostgreSQL**. O Controller não conhece SQL e o
Repository não conhece regra de negócio. Os Services lançam erros de domínio (`NotFoundError`, `BusinessRuleError`...),
e o `HttpErrorFilter` traduz cada um para o status HTTP correto, sempre no mesmo formato JSON.

## Pré-requisitos

- Node.js 20 ou mais novo
- PostgreSQL 14 ou mais novo, com dois bancos vazios: `burguer_sabor` (uso) e `burguer_sabor_test` (testes)

## Como rodar

No Windows, o jeito mais fácil é dar dois cliques em `Iniciar BurguerSabor.bat`, na pasta principal. Pelo terminal:

```bash
cd backend
npm install
node scripts/preparar.js      # cria o .env (pergunta a senha do PostgreSQL), gera o JWT_SECRET e cria os bancos
npm run start:dev
```

- Site (cliente e admin): <http://localhost:3000>
- Swagger: <http://localhost:3000/api-docs> (especificação em JSON: `/api-docs-json`)
- Voltar aos dados de exemplo: `npm run db:reset`

## O site

A pasta `public/` tem um site em HTML, CSS e JavaScript puro, servido pela própria API (sem etapa de build):

- **Cliente (estilo app de delivery):** capa da loja com nota, tempo e taxa de entrega; cardápio com 21 itens em 6 categorias, incluindo combos, com fotos e busca; detalhe do produto com observação; sacola (com lixeira em cada item; só para quem está logado e esvaziada ao sair); cadastro e login; endereços; forma de pagamento (Pix, cartão de crédito, cartão de débito ou dinheiro); acompanhamento do pedido que atualiza sozinho, com previsão de entrega; avaliação com estrelas e pedido de reembolso depois da entrega.
- **Admin:** fila de pedidos ao vivo com avanço de status, cancelamento e resposta aos pedidos de reembolso, avaliações dos clientes, foto no cadastro de produto, cadastro de produtos e categorias, receita (ficha técnica) e custo/lucro, estoque com reposição, extrato e alertas, e relatório de saída de produtos.

### Contas de teste (senhas fictícias)

| Perfil | E-mail | Senha |
|---|---|---|
| Admin | admin@burguersabor.com | admin123 |
| Cliente | hudson@email.com | cliente123 |

No Swagger, faça `POST /auth/login`, copie o `accessToken`, clique em **Authorize** e cole o token.

## Testes automatizados

```bash
npm test          # todos os testes (Jest + Supertest)
npm run test:cov  # com relatório de cobertura
```

Os testes de API sobem a aplicação de verdade e usam o banco `burguer_sabor_test`, que é **apagado e recriado** no
início de cada arquivo de teste. Nunca aponte `DATABASE_URL_TEST` para o banco principal.

| Arquivo | O que cobre |
|---|---|
| `test/unit/regras-dominio.spec.ts` | Regras puras: transições de status, totais, consumo de insumos, valor limite do estoque, custo e lucro |
| `test/e2e/auth.e2e.spec.ts` | Login, cadastro, token, perfis e hash Bcrypt no banco |
| `test/e2e/categorias.e2e.spec.ts` | CRUD completo e bloqueio de exclusão com produtos (CT-CAT-003) |
| `test/e2e/produtos.e2e.spec.ts` | CRUD, busca (CT-MOB-004), preço ≤ 0 (CT-PRD-002), ficha técnica, custo e RN04 |
| `test/e2e/insumos.e2e.spec.ts` | CRUD de insumos, reposição, extrato e alertas de reposição |
| `test/e2e/enderecos.e2e.spec.ts` | Endereços do cliente (1:N) e isolamento entre clientes |
| `test/e2e/pedidos.e2e.spec.ts` | Pedido atômico, baixa de estoque, CT-EST-001, CT-KDS-006, CT-MOB-005, cancelamento e relatório |
| `test/e2e/loja.e2e.spec.ts` | Dados da loja, avaliação do pedido (só depois de entregue, uma vez) e foto do produto |
| `test/e2e/reembolso.e2e.spec.ts` | Reembolso: só depois de entregue, motivo obrigatório, aprovar ou recusar, estoque não volta |
| `test/e2e/swagger.e2e.spec.ts` | Swagger no ar, rotas e schemas documentados (CT-SWG-007) |

Cada teste confere o **status HTTP** e o **formato do JSON** devolvido (contratos em `test/helpers.ts`).

## Rotas

Legenda: 🌐 pública · 👤 cliente · 🛠 admin · 🔑 qualquer usuário logado

| Método | Rota | Acesso | Descrição |
|---|---|---|---|
| POST | `/auth/registro` | 🌐 | Cria conta de cliente |
| POST | `/auth/login` | 🌐 | Devolve o token JWT |
| GET | `/auth/me` | 🔑 | Usuário logado |
| GET/POST | `/enderecos` | 👤 | Lista / cadastra endereços |
| GET/PATCH/DELETE | `/enderecos/:id` | 👤 | Detalha / altera / exclui endereço |
| GET | `/categorias` | 🌐 | Lista categorias (`?somenteAtivas=true`) |
| GET | `/categorias/:id` | 🌐 | Detalha categoria |
| POST, PATCH, DELETE | `/categorias`, `/categorias/:id` | 🛠 | CRUD de categorias |
| GET | `/produtos` | 🌐 | Catálogo (`?busca=`, `?categoriaId=`, `?somenteDisponiveis=true`) |
| GET | `/produtos/:id` | 🌐 | Detalha produto |
| POST, PATCH, DELETE | `/produtos`, `/produtos/:id` | 🛠 | CRUD de produtos |
| GET/PUT | `/produtos/:id/ficha-tecnica` | 🛠 | Lê / substitui a ficha técnica |
| GET | `/produtos/:id/custo` | 🛠 | Custo, lucro e margem |
| GET/POST | `/insumos` | 🛠 | Lista (`?abaixoDoMinimo=true`) / cadastra insumo |
| GET/PATCH/DELETE | `/insumos/:id` | 🛠 | Detalha / altera / exclui insumo |
| POST | `/insumos/:id/reposicao` | 🛠 | Registra entrada de estoque |
| GET | `/movimentacoes` | 🛠 | Extrato (`?pedidoId=`, `?insumoId=`, `?tipo=`) |
| GET | `/alertas` | 🛠 | Alertas de reposição (`?resolvido=false`) |
| PATCH | `/alertas/:id/resolver` | 🛠 | Marca alerta como resolvido |
| POST | `/pedidos` | 👤 | Finaliza o carrinho |
| GET | `/pedidos`, `/pedidos/:id` | 🔑 | Admin vê todos; cliente vê os próprios |
| PATCH | `/pedidos/:id/status` | 🛠 | Avança o status, uma etapa por vez |
| POST | `/pedidos/:id/cancelamento` | 🔑 | Cancela e devolve os insumos |
| GET | `/relatorios/saida-produtos` | 🛠 | Saída de produtos e faturamento (`?de=&ate=`) |
| POST | `/pedidos/:id/avaliacao` | 👤 | Avalia o pedido entregue (nota de 1 a 5, uma vez) |
| POST | `/pedidos/:id/reembolso` | 👤 | Pede reembolso de pedido entregue e pago, com motivo (o estoque não volta) |
| PATCH | `/pedidos/:id/reembolso` | 🛠 | Aprova (`REEMBOLSADO`) ou recusa (volta a `APROVADO`) o pedido de reembolso |
| GET | `/loja` | 🌐 | Taxa e tempo de entrega e nota média da loja |
| GET | `/avaliacoes` | 🛠 | Avaliações dos clientes |

### Status HTTP usados

| Código | Quando |
|---|---|
| 200 | Consulta, atualização, login, cancelamento |
| 201 | Recurso criado (cadastro, pedido, reposição) |
| 204 | Exclusão bem-sucedida (sem corpo) |
| 400 | Requisição mal formada: id que não é número, JSON quebrado, PATCH sem campos |
| 401 | Sem token, token inválido ou login errado |
| 403 | Perfil sem permissão (ex.: cliente em rota de admin) |
| 404 | Recurso não existe ou não pertence ao usuário |
| 409 | Conflito: nome/e-mail repetido, registro em uso |
| 422 | Dados inválidos ou regra de negócio violada (estoque insuficiente, transição de status inválida) |

## Onde cada item do checklist é atendido

**2. Backend & Arquitetura**
- Camadas Domain / Repository / Service / Controller: veja a árvore acima.
- Regras de negócio isoladas no Service e no `src/domain/`; pool de conexões `pg` em `src/database/database.service.ts`.
- Consultas parametrizadas em todos os repositórios (nenhum dado do usuário é concatenado no SQL).
- Tratamento centralizado de erros em `src/common/http-error.filter.ts`.
- Transação atômica do pedido (RNF03) em `PedidosService.criar`, com travamento de linhas (`FOR UPDATE`) para dois pedidos não gastarem o mesmo saldo.

**4. Endpoints & Swagger**
- CRUD completo com GET, POST, PATCH/PUT e DELETE e os status da tabela acima.
- Swagger interativo em `/api-docs`.
- DTOs com validação estrita (`whitelist` + `forbidNonWhitelisted`) e exemplos em cada campo.

**5. Testes automatizados**
- Jest + Supertest, cobrindo cada endpoint com sucesso, erro e regras de negócio.
- Asserções explícitas de status HTTP e do contrato JSON.

## Variáveis de ambiente

Todas documentadas em [`.env.example`](.env.example). O `.env` real fica só no seu computador (está no `.gitignore`), e a API se recusa a subir com o `JWT_SECRET` de exemplo.
