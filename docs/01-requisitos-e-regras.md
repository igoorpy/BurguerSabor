# BurguerSabor — Especificação de Requisitos, Arquitetura e Regras de Negócio

## 1. Visão Geral do Sistema
O **BurguerSabor** é uma plataforma de gestão operacional e canal de vendas para hamburguerias, lanchonetes e estabelecimentos de alimentação rápida. O sistema integra os pedidos efetuados no aplicativo mobile do cliente com o painel da cozinha (KDS - Kitchen Display System), apoiado por uma API REST em Java e banco relacional PostgreSQL rodando em container Docker.

---

## 2. Perfis de Acesso (RBAC)
* **CLIENTE (App Mobile):** Tela de boas-vindas/login, consulta do cardápio com busca dinâmica, montagem de carrinho e realização de pedidos.
* **ADMINISTRADOR (ADMIN Web / KDS):** Gestão do cardápio, controle de insumos e fichas técnicas, acompanhamento dos pedidos no KDS e acesso aos relatórios de auditoria e pagamentos.

---

## 3. Requisitos Funcionais (RF)

### Módulo de Usuários e Autenticação
* **RF01 - Autenticação e Perfis (RBAC):** O sistema deve autenticar usuários diferenciando permissões entre os perfis `CLIENTE` e `ADMIN`.
* **RF02 - Gestão de Endereços:** O sistema deve permitir que um usuário do tipo `CLIENTE` cadastre múltiplos endereços de entrega (relacionamento $1:N$).

### Módulo de Cardápio, Insumos e Estoque
* **RF03 - Gestão de Categorias e Produtos:** O sistema deve permitir o cadastro de produtos vinculados obrigatoriamente a uma categoria.
* **RF04 - Controle de Insumos e Ficha Técnica:** O sistema deve associar cada produto a seus insumos por meio de uma Ficha Técnica ($N:N$), registrando a quantidade necessária de cada item por porção.
* **RF05 - Baixa Automática de Estoque:** Ao confirmar um pedido, o sistema deve deduzir automaticamente do estoque a quantidade exata de insumos cadastrada na ficha técnica.

### Módulo de Pedidos, Cozinha (KDS) e Pagamentos
* **RF06 - Registros de Pedido e Itens:** O sistema deve registrar pedidos compostos por um ou mais itens, gravando o preço unitário histórico no momento da compra.
* **RF07 - Fluxo de Status do Pedido:** O sistema deve controlar o progresso operacional do pedido nas etapas sequenciais: `RECEBIDO` $\rightarrow$ `PREPARANDO` $\rightarrow$ `SAIU_ENTREGA` $\rightarrow$ `CONCLUIDO` (ou `CANCELADO`).
* **RF08 - Processamento Financeiro:** Cada pedido deve ter obrigatoriamente um registro de pagamento associado ($1:1$), com suporte às formas: `PIX`, `CARTAO_CREDITO`, `CARTAO_DEBITO` e `DINHEIRO`.

### Módulo de Aplicativo Mobile (Requisitos de Avaliação)
* **RF09 - Tela de Boas-Vindas e Autenticação Mobile:** O aplicativo mobile deve disponibilizar uma tela inicial de apresentação e login de usuário.
* **RF10 - Navegação, Categorias e Ferramenta de Busca:** O app deve exibir a barra de opções por categoria e um campo de busca para filtragem de produtos em tempo real.
* **RF11 - Operações de CRUD via API Mobile:** O app mobile deve permitir a consulta de produtos, inclusão de itens no carrinho, edição de quantidades e cancelamento do pedido.

---

## 4. Requisitos Não Funcionais (RNF)

* **RNF01 - Criptografia de Credenciais:** As senhas dos usuários devem ser armazenadas no banco de dados obrigatoriamente através de hash criptográfico irreversível com *salting* (algoritmo Bcrypt).
* **RNF02 - Integridade Referencial no Banco de Dados:** O PostgreSQL deve aplicar restrições rígidas de Chave Estrangeira (`FOREIGN KEY`) com comportamentos explícitos (`ON DELETE RESTRICT` / `ON DELETE CASCADE`).
* **RNF03 - Transação Atômica:** A gravação do pedido, inserção de itens, pagamento e baixa de insumos devem ocorrer dentro de um bloco transacional atômico (`COMMIT` / `ROLLBACK`).
* **RNF04 - Documentação Swagger / OpenAPI:** O backend deve expor a documentação interativa das rotas HTTP no formato Swagger UI (endpoint `/docs` ou `/api-docs`).
* **RNF05 - Conteinerização e Orquestração:** A aplicação e o banco PostgreSQL devem ser orquestrados via `docker-compose.yml`, com volume persistente e verificação de saúde (`healthcheck` com `pg_isready`).

---

## 5. Regras de Negócio Críticas (RN)

* **RN01 - Saldo Não Negativo:** A quantidade disponível de insumos no estoque não pode assumir valores negativos (`CHECK quantidade_disponivel >= 0`).
* **RN02 - Validação de Preços:** O preço de venda dos produtos e a quantidade das fichas técnicas devem ser estritamente maiores que zero (`CHECK preco > 0` e `CHECK quantidade_necessaria > 0`).
* **RN03 - Proteção de Exclusão de Categorias:** O sistema deve proibir a exclusão de qualquer categoria ativa que possua produtos cadastrados atrelados a ela (`ON DELETE RESTRICT`).
* **RN04 - Trava de Insumo Indisponível:** Se qualquer insumo de um produto estiver com saldo insuficiente, o item não deve ficar disponível para venda no app mobile ou no PDV.