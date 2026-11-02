# Burguer Sabor — Plano de Testes Ex-Ante e Matriz de Cobertura.

## 1. Visão Geral e Estratégia de Qualidade
Este documento especifica os casos de teste projetados na fase de engenharia de requisitos e modelagem de banco de dados (Shift-Left Testing). A abordagem garante que o desenvolvimento em Java (Spring Boot) e os scripts SQL no PostgreSQL sejam construídos sob critérios claros de aceite (Acceptance Criteria).

### Técnicas Aplicadas:
* **Partição de Equivalência (PE):** Divisão de dados em classes válidas e inválidas.
* **Análise do Valor Limite (AVL):** Teste nas fronteiras exatas das restrições (`CHECK`) do banco de dados.
* **Tabela de Decisão:** Validação de combinação de regras de negócio para autorização de processos.
* **Transição de Estados:** Validação do ciclo de vida do pedido no painel da cozinha (KDS).

## 2. Matriz Rastreável de Casos de Teste Manuais

###  Módulo de Estoque e Ficha Técnica

#### CT-EST-001 — Trava de Saldo Negativo de Insumo no Estoque
* **CTFL:** Análise do Valor Limite (AVL — Fronteira $N = 0.00$).
* **Requisito / Regra Validada:** RN01 — `CHECK (quantidade_disponivel >= 0)` na tabela `insumos_estoque`[cite: 2].
* **Severidade:** Crítica.
* **Pré-condições:** Insumo "Pão Brioche" com `quantidade_disponivel = 1.00`.
* **Passos de Execução:**
  1. Iniciar pedido contendo 2 hambúrgueres "Burguer X-Cheddar" (que requer $2.00$ unidades de "Pão Brioche" na ficha técnica).
  2. Confirmar o pedido no sistema.
* **Resultado Esperado:** O sistema deve interromper o pedido, exibir a mensagem *"Estoque insuficiente para o insumo Pão Brioche"* e reter a baixa no banco, garantindo que o saldo não fique negativo ($-1.00$).

### Módulo de Cardápio e Produtos

#### CT-PRD-002 — Validação do Preço Mínimo do Produto
* **Técnica CTFL:** Partição de Equivalência (Classe de Entrada Inválida).
* **Requisito / Regra Validada:** RN02 — `CHECK (preco > 0)` na tabela `produtos`.
* **Severidade:** Alta.
* **Pré-condições:** Usuário autenticado como `ADMIN`.
* **Passos de Execução:**
  1. Acessar o módulo de cadastro/edição de produtos.
  2. Inserir o produto "Molho Especial" informando o preço `0.00` ou `-5.00`.
  3. Clicar em "Salvar".
* **Resultado Esperado:** Rejeição do cadastro pela camada de validação e restrição do banco de dados, exigindo preço estritamente positivo.

#### CT-CAT-003 — Bloqueio de Exclusão de Categoria com Produtos Vinculados
* **CTFL:** Teste de Restrição de Integridade Referencial.
* **Requisito / Regra Validada:** RNF02 — `FOREIGN KEY (categoria_id) ON DELETE RESTRICT`.
* **Severidade:** Média.
* **Pré-condições:** Categoria "Hambúrgueres" cadastrada contendo o produto "Burguer X-Cheddar" ativo.
* **Passos de Execução:**
  1. Acessar a listagem de categorias.
  2. Disparar a exclusão da categoria "Hambúrgueres".
* **Resultado Esperado:** Bloqueio da ação com erro de restrição de Chave Estrangeira do PostgreSQL, impedindo produtos órfãos no sistema[cite: 3].


### Módulo de Cozinha e Pedidos (KDS)

#### CT-KDS-004 — Validação de Transição Inválida de Status do Pedido
* **CTFL:** Teste de Transição de Estado (Fluxo Negativo).
* **Requisito / Regra Validada:** RF07 — Ciclo de vida: `RECEBIDO` $\rightarrow$ `PREPARANDO` $\rightarrow$ `SAIU_ENTREGA` $\rightarrow$ `CONCLUIDO`.
* **Severidade:** Alta[cite: 8].
* **Pré-condições:** Pedido recém-registrado com status atual `RECEBIDO`.
* **Passos de Execução:**
  1. Acessar o painel KDS do operador.
  2. Tentar alterar o status do pedido diretamente de `RECEBIDO` para `CONCLUIDO` (pulando a etapa de preparo).
* **Resultado Esperado:** O sistema deve proibir a alteração direta e informar que a transição de estado é inválida.

---

### Módulo Financeiro e Processamento de Pedidos

#### CT-PAG-005 — Tabela de Decisão para Processamento de Pedido
* **CTFL:** Tabela de Decisão.
* **Requisito / Regra Validada:** RF08 e RNF03 — Integração de Pedido, Pagamento e Baixa de Insumo.

| Condição 1: Usuário Autenticado? | Condição 2: Insumos em Estoque Válidos? | Condição 3: Pagamento Aprovado? | Ação Esperada do Sistema |
| :---: | :---: | :---: | :--- |
| **Falso** | - | - | **Rejeitar:** Redirecionar para tela de Login. |
| **Verdadeiro** | **Falso** | - | **Rejeitar:** Notificar insumos indisponíveis e cancelar transação. |
| **Verdadeiro** | **Verdadeiro** | **Falso** | **Reter:** Manter status do pagamento como `PENDENTE` e não enviar ao KDS. |
| **Verdadeiro** | **Verdadeiro** | **Verdadeiro** | **Aprovar:** Gravar pedido, realizar baixa de insumos e enviar ao KDS da cozinha. |

---

### Módulo de Segurança e Autenticação

#### CT-SEC-006 — Criptografia de Credenciais
* **CTFL:** Teste Estático / Segurança de Dados.
* **Requisito / Regra Validada:** RNF01 — Armazenamento seguro com Bcrypt.
* **Severidade:** Crítica.
* **Passos de Execução:**
  1. Executar o cadastro de um novo usuário.
  2. Consultar a coluna `senha_hash` diretamente na tabela `usuarios` do PostgreSQL.
* **Resultado Esperado:** A senha em texto plano jamais deve ser visível no banco; a coluna deve conter apenas a string criptografada com salt (ex: `$2b$10$...`).