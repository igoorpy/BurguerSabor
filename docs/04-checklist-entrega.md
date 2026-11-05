# BurguerSabor — Como o projeto atende ao checklist (tópicos 1, 2, 4 e 5)

Este documento mostra, item por item do checklist de validação, **onde** cada exigência está no projeto e **como
demonstrar** na apresentação. O tópico 3 (Docker) e o tópico 6 (documentação e Git) estão fora deste documento.

Para ligar tudo: dê dois cliques em `Iniciar BurguerSabor.bat` (na pasta principal). O site abre em
<http://localhost:3000> e o Swagger em <http://localhost:3000/api-docs>.

---

## 1. Modelagem & Banco (PostgreSQL)

| Exigência | Onde está | Como mostrar |
|---|---|---|
| Modelo conceitual e lógico relacional normalizado até a 3FN, com entidades, atributos e cardinalidades | [`docs/02-modelagem-banco-e-uml.md`](02-modelagem-banco-e-uml.md) — DER com as 12 tabelas e as cardinalidades (1:N, N:N pela ficha técnica, 1:1 em pagamentos) | Abrir o DER e explicar a ficha técnica (N:N produto × insumo) e o preço histórico em `itens_pedido` |
| Dicionário de dados com tipos (SERIAL, NUMERIC/DECIMAL, TIMESTAMP), PKs, FKs e constraints (CHECK, NOT NULL, UNIQUE) | Mesmo arquivo, seção "Dicionário de dados": uma tabela por entidade com tipo, restrições e descrição de cada coluna | Mostrar `insumos_estoque.quantidade_disponivel` com `CHECK >= 0` (RN01) e `pagamentos.pedido_id` com `UNIQUE` (1:1) |
| Scripts SQL executáveis: `schema.sql` (DDL + índices) e `seed.sql` (dados iniciais de teste) | [`database/schema.sql`](../database/schema.sql) e [`database/seed.sql`](../database/seed.sql) | `Resetar dados de exemplo.bat` (ou `npm run db:reset`) executa os dois do zero |

**Pontos para destacar:**
- Toda FK tem comportamento explícito (RNF02): `ON DELETE RESTRICT` protege o histórico (categoria com produtos, produto já vendido) e `ON DELETE CASCADE` remove o que só existe junto (endereços de um usuário, itens de um pedido).
- As senhas do seed são gravadas com hash Bcrypt (`crypt(..., gen_salt('bf', 10))`), nunca em texto (RNF01).
- Um índice único parcial (`ux_alerta_aberto_insumo`) impede alertas de reposição duplicados.

---

## 2. Backend & Arquitetura (Node.js / NestJS)

| Exigência | Onde está | Como mostrar |
|---|---|---|
| Arquitetura em camadas estrita: Domain, Repository/DAO, Service (regras de negócio) e Controllers/Routers | `backend/src/domain/` (regras puras), `backend/src/modules/<recurso>/` com `*.controller.ts`, `*.service.ts`, `*.repository.ts` e `dto/` | Seguir uma requisição: `PedidosController` → `PedidosService` → `PedidosRepository` → PostgreSQL |
| Regras de negócio isoladas no Service | `pedidos.service.ts`, `insumos.service.ts`, `estoque.service.ts` e as funções de `domain/*.rules.ts` (fluxo de status, baixa pela ficha técnica, faltas, custo e lucro) | Abrir `domain/pedido.rules.ts`: a regra "não pular etapa" não conhece banco nem HTTP |
| Pool de conexões ativo e seguro (pg Pool) | `backend/src/database/database.service.ts`: `Pool` com limite de conexões e timeouts, e `transaction()` com BEGIN/COMMIT/ROLLBACK | Mostrar `PedidosService.criar`: pedido, itens, pagamento e baixa numa transação só (RNF03) |
| Consultas parametrizadas (anti-SQL Injection) | Todos os `*.repository.ts` usam `$1, $2...`; os UPDATEs dinâmicos usam nomes de coluna de um mapa fixo (`database/sql.util.ts`) | Buscar no projeto: nenhum valor do usuário é concatenado no SQL |
| Tratamento centralizado de erros | `backend/src/common/http-error.filter.ts`: converte erros de domínio e do PostgreSQL em HTTP, sempre no mesmo JSON | Provocar um erro no Swagger (ex.: estoque insuficiente) e mostrar o formato `{ statusCode, error, message, details, path, timestamp }` |

**Pontos para destacar:**
- Concorrência: o pedido trava as linhas dos insumos (`SELECT ... FOR UPDATE`), então dois pedidos ao mesmo tempo não gastam o mesmo saldo.
- Segurança: login com JWT, perfis CLIENTE e ADMIN, senha com Bcrypt, e a API não sobe sem um segredo de login próprio no `.env`.

---

## 4. Endpoints & Swagger (OpenAPI)

| Exigência | Onde está | Como mostrar |
|---|---|---|
| Endpoints CRUD completos (GET, POST, PUT/PATCH, DELETE) | Categorias, produtos, insumos e endereços têm CRUD completo; produtos ainda têm `PUT /produtos/{id}/ficha-tecnica`; pedidos têm criação, consulta, `PATCH .../status`, cancelamento e avaliação (`POST .../avaliacao`); `GET /loja` traz taxa, tempo de entrega e nota média | Tabela de rotas no [README do backend](../backend/README.md#rotas) |
| Status HTTP semânticos (200, 201, 204, 400, 404, 422) | 200 consulta e alteração; 201 criação; 204 exclusão sem corpo; 400 requisição mal formada; 404 não encontrado; 422 validação ou regra de negócio. Também 401, 403 e 409 onde fazem sentido | No Swagger: `DELETE /categorias/{id}` com uma categoria vazia (204) e com a categoria 1 (409); `POST /produtos` com `preco: 0` (422) |
| Swagger UI / OpenAPI interativo e testável pelo navegador (`/api-docs`) | `backend/src/configure-app.ts`; interface em `/api-docs`, especificação JSON em `/api-docs-json` | Fazer login, clicar em **Authorize** e executar uma rota |
| Schemas de entrada e saída (DTOs) com validação estrita e exemplos de payload | `backend/src/modules/*/dto/*.dto.ts`: `class-validator` com `whitelist` e `forbidNonWhitelisted` (campo desconhecido = 422) e `@ApiProperty({ example })` em cada campo | Abrir um schema no Swagger (ex.: `CreatePedidoDto`) e mostrar os exemplos |

O passo a passo completo pelo Swagger está no guia de uso, com cada requisição e a resposta esperada.

---

## 5. Testes automatizados (Jest + Supertest)

| Exigência | Onde está | Como mostrar |
|---|---|---|
| Suíte de testes automatizados implementada | `backend/test/`: 1 arquivo de unidade (regras de domínio) e 8 arquivos de API (`test/e2e/*.e2e.spec.ts`) que sobem a aplicação de verdade com um banco de teste | Dar dois cliques em `Rodar testes.bat` (ou `npm test`) |
| Testes cobrindo cada endpoint CRUD, com sucesso, erro e regras de negócio | Um arquivo por recurso: auth, categorias, produtos, insumos, endereços, pedidos, loja/avaliações e swagger. Inclui os casos do [`docs/03`](03-casos-de-teste.md): CT-EST-001, CT-PRD-002, CT-CAT-003, CT-MOB-004, CT-MOB-005, CT-KDS-006 e CT-SWG-007 | Mostrar `pedidos.e2e.spec.ts`: o pedido com saldo insuficiente é recusado e o saldo continua igual (ROLLBACK) |
| Asserções explícitas de status HTTP e da estrutura do JSON | Cada teste usa `.expect(<status>)` e confere o corpo com os contratos de `test/helpers.ts` (`contratoProduto`, `contratoPedido`, `esperarErro`...) | Mostrar `helpers.ts` e um teste que compara o JSON com o contrato |

**Como os testes funcionam:** o banco `burguer_sabor_test` é apagado e recriado no início de cada arquivo, então os
testes nunca mexem nos dados da apresentação e sempre partem do mesmo estado.
