# BurguerSabor — Plano de Testes Ex-Ante e Matriz de Cobertura (ISTQB CTFL v4.0)

## 1. Visão Geral e Estratégia de Qualidade
Este documento especifica os casos de teste projetados no papel (Shift-Left Testing) para atender aos critérios de avaliação da disciplina e aos padrões da certificação ISTQB CTFL v4.0.

---

## 2. Matriz Rastreável de Casos de Teste Manuais e de API

### Módulo de Estoque e Ficha Técnica

#### CT-EST-001 — Trava de Saldo Negativo de Insumo no Estoque
* **Técnica CTFL:** Análise do Valor Limite (AVL — Fronteira $N = 0.00$).
* **Requisito / Regra Validada:** RN01 — `CHECK (quantidade_disponivel >= 0)` na tabela `insumos_estoque`.
* **Severidade:** Crítica.
* **Pré-condições:** Insumo "Pão Brioche" com `quantidade_disponivel = 1.00`.
* **Passos de Execução:**
  1. Iniciar pedido no App contendo 2 hambúrgueres que requerem 2.00 unidades de "Pão Brioche".
  2. Confirmar a compra.
* **Resultado Esperado:** Bloqueio do pedido, mensagem de erro de estoque insuficiente e manutenção do saldo em 1.00 (sem valor negativo).

---

### Módulo de Cardápio e Produtos (API & DB)

#### CT-PRD-002 — Validação do Preço Mínimo do Produto
* **Técnica CTFL:** Partição de Equivalência (Classe Inválida).
* **Requisito / Regra Validada:** RN02 — `CHECK (preco > 0)` na tabela `produtos`.
* **Severidade:** Alta.
* **Passos de Execução:**
  1. Tentar cadastrar um produto com o valor `0.00` ou `-5.00` via requisição HTTP POST ou formulário admin.
* **Resultado Esperado:** Rejeição pelo backend e pela constraint do PostgreSQL com erro HTTP `400 Bad Request` ou `422 Unprocessable Entity`.

#### CT-CAT-003 — Bloqueio de Exclusão de Categoria com Produtos Ativos
* **Técnica CTFL:** Teste de Integridade Referencial.
* **Requisito / Regra Validada:** RNF02 — `FOREIGN KEY (categoria_id) ON DELETE RESTRICT`.
* **Severidade:** Média.
* **Passos de Execução:**
  1. Tentar apagar uma categoria que possui produtos vinculados.
* **Resultado Esperado:** Bloqueio da ação por violação de Chave Estrangeira.

---

### Módulo de Aplicativo Mobile (Requisitos de Avaliação)

#### CT-MOB-004 — Busca de Produtos em Tempo Real no App Mobile
* **Técnica CTFL:** Partição de Equivalência (Pesquisa / Filtro).
* **Requisito / Regra Validada:** RF10 — Barra de Opções e Ferramenta de Busca no App.
* **Severidade:** Média.
* **Passos de Execução:**
  1. Abrir a tela do cardápio no aplicativo mobile.
  2. Digitar o termo "Cheddar" no campo de busca.
* **Resultado Esperado:** O aplicativo deve filtrar dinamicamente o cardápio e exibir apenas os produtos que contenham o termo digitado.

#### CT-MOB-005 — Validação das Operações do Carrinho (CRUD Mobile)
* **Técnica CTFL:** Teste de Caminho Feliz e Exceções.
* **Requisito / Regra Validada:** RF11 — CRUD e inclusão de itens no carrinho.
* **Severidade:** Alta.
* **Passos de Execução:**
  1. Adicionar 1 item ao carrinho no App.
  2. Incrementar a quantidade para 3 unidades.
  3. Remover 1 unidade e finalizar o pedido.
* **Resultado Esperado:** Atualização dinâmica dos subtotais no app e gravação correta da quantidade final (2 unidades) no banco de dados.

---

### Módulo de Cozinha e KDS (Transição de Estados)

#### CT-KDS-006 — Transição Inválida de Status do Pedido
* **Técnica CTFL:** Teste de Transição de Estado.
* **Requisito / Regra Validada:** RF07 — Fluxo operacional do KDS.
* **Severidade:** Alta.
* **Passos de Execução:**
  1. Tentar alterar o status de um pedido recém-criado de `RECEBIDO` direto para `CONCLUIDO`.
* **Resultado Esperado:** O sistema deve negar a alteração e exigir a passagem prévia pelo estado `PREPARANDO`.

---

### Módulo de Documentação da API (Swagger / OpenAPI)

#### CT-SWG-007 — Inspeção e Validação dos Endpoints no Swagger UI
* **Técnica CTFL:** Teste de Interface de API / Documentação.
* **Requisito / Regra Validada:** RNF04 — Disponibilidade da documentação OpenAPI.
* **Severidade:** Média.
* **Passos de Execução:**
  1. Acessar a URL `/docs` ou `/api-docs` no navegador.
  2. Testar o disparo do endpoint `GET /produtos` diretamente pela interface interativa.
* **Resultado Esperado:** Exibição clara dos esquemas de dados (DTOs) e retorno do JSON do catálogo com Status HTTP `200 OK`.