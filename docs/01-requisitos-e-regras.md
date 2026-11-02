#  Burguer  Sabor — Especificação de Requisitos e Regras de Negócio

## 1. Visão Geral do Sistema
O **Burguer & Sabor** é um sistema de gestão operacional e canal de vendas para hamburguerias e lanchonetes artesanais. O sistema integra os pedidos efetuados no aplicativo mobile do cliente com o painel da cozinha (KDS - Kitchen Display System) e a gestão automática de estoque de insumos por ficha técnica no backend.

## 2. Perfis de Acesso (RBAC)
* **CLIENTE:** Cadastro de dados pessoais e endereços, navegação pelo cardápio por categorias, montagem do carrinho, finalização de pedidos e acompanhamento de status.
* **ADMINISTRADOR (ADMIN):** Gestão do cardápio, controle de insumos e fichas técnicas, monitoramento dos pedidos no KDS e acompanhamento financeiro de pagamentos.

---

## 3. Requisitos Funcionais (RF)

### Módulo de Usuários e Autenticação
* **RF01 - Autenticação e Perfis (RBAC):** O sistema deve autenticar usuários diferenciando permissões entre os perfis `CLIENTE` e `ADMIN`.
* **RF02 - Gestão de Endereços:** O sistema deve permitir que um usuário do tipo `CLIENTE` cadastre múltiplos endereços de entrega (relacionamento $1:N$).

### Módulo de Cardápio e Estoque
* **RF03 - Gestão de Categorias e Produtos:** O sistema deve permitir o cadastro de produtos vinculados obrigatoriamente a uma categoria.
* **RF04 - Controle de Insumos e Ficha Técnica:** O sistema deve associar cada produto do cardápio a um ou mais insumos de estoque por meio de uma Ficha Técnica ($N:N$), registrando a quantidade necessária de cada insumo por porção.
* **RF05 - Baixa Automática de Estoque:** Ao ser confirmado um pedido, o sistema deve deduzir automaticamente do estoque a quantidade exata de insumos cadastrada na ficha técnica dos produtos vendidos.

### Módulo de Pedidos e Cozinha (KDS)
* **RF06 - Registros de Pedido e Itens:** O sistema deve registrar pedidos compostos por um ou mais itens, gravando o preço unitário histórico no momento da compra.
* **RF07 - Fluxo de Status do Pedido:** O sistema deve controlar o progresso operacional do pedido nas seguintes etapas sequenciais: `RECEBIDO` $\rightarrow$ `PREPARANDO` $\rightarrow$ `SAIU_ENTREGA` $\rightarrow$ `CONCLUIDO` (ou `CANCELADO`).
* **RF08 - Processamento Financeiro:** Cada pedido deve ter obrigatoriamente um registro de pagamento associado ($1:1$), com suporte às formas de pagamento: `PIX`, `CARTAO_CREDITO`, `CARTAO_DEBITO` e `DINHEIRO`.

---

## 4. Requisitos Não Funcionais (RNF)

* **RNF01 - Segurança de Credenciais:** As senhas dos usuários devem ser armazenadas no banco de dados obrigatoriamente através de hash criptográfico irreversível com *salting* (algoritmo Bcrypt).
* **RNF02 - Integridade Referencial no Banco de Dados:** O PostgreSQL deve aplicar restrições rígidas de Chave Estrangeira (`FOREIGN KEY`) com comportamentos explícitos (`ON DELETE RESTRICT` / `ON DELETE CASCADE`).
* **RNF03 - Atomicidade de Transações Financeiras/Estoque:** A criação do pedido, a inserção dos itens, o registro do pagamento e o abatimento de insumos no estoque devem ocorrer sob uma única transação SQL atômica (`COMMIT` / `ROLLBACK`).
* **RNF04 - Tecnologia e Arquitetura:**
  * **Backend:** Java (Spring Boot ou Jakarta EE).
  * **Banco de Dados:** PostgreSQL 15 normalizado até a 3ª Forma Normal (3FN).
  * **Mapeamento Objeto-Relacional:** JPA / Hibernate (TypeORM equivalent).

---

## 5. Regras de Negócio Críticas (RN)

* **RN01 - Saldo Não Negativo:** A quantidade disponível de insumos no estoque não pode assumir valores negativos (`CHECK quantidade_disponivel >= 0`).
* **RN02 - Validação de Preços:** O preço de venda dos produtos e a quantidade das fichas técnicas devem ser estritamente maiores que zero (`CHECK preco > 0` e `CHECK quantidade_necessaria > 0`).
* **RN03 - Proteção de Exclusão de Categorias:** O sistema deve proibir a exclusão de qualquer categoria ativa que possua produtos cadastrados atrelados a ela (`ON DELETE RESTRICT`).
* **RN04 - Trava de Insumo Indisponível:** Se qualquer insumo necessário para a confecção de um produto estiver com saldo insuficiente no estoque, o produto não deve ser liberado para venda no app.