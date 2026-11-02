# BurguerSabor — Modelagem de Banco de Dados (DER) e Diagrama de Classes UML

```mermaid
erDiagram
    usuarios ||--o{ enderecos : "possui (1:N)"
    usuarios ||--o{ pedidos : "realiza (1:N)"
    categorias ||--o{ produtos : "agrupa (1:N)"
    produtos ||--o{ ficha_tecnica : "requer (1:N)"
    insumos_estoque ||--o{ ficha_tecnica : "compoe (1:N)"
    pedidos ||--|{ itens_pedido : "contem (1:N)"
    produtos ||--o{ itens_pedido : "pertence (1:N)"
    pedidos ||--|| pagamentos : "possui (1:1)"

    usuarios {
        int id PK
        string nome
        string email
        string senha_hash
        string tipo_usuario
    }
    enderecos {
        int id PK
        int usuario_id FK
        string rua
        string cep
    }
    categorias {
        int id PK
        string nome
        boolean ativo
    }
    produtos {
        int id PK
        int categoria_id FK
        string nome
        decimal preco
        boolean disponivel
    }
    insumos_estoque {
        int id PK
        string nome_item
        decimal quantidade_disponivel
        string unidade_medida
    }
    ficha_tecnica {
        int id PK
        int produto_id FK
        int insumo_id FK
        decimal quantidade_necessaria
    }
    pedidos {
        int id PK
        int cliente_id FK
        int endereco_id FK
        string status
        decimal valor_total
    }
    itens_pedido {
        int id PK
        int pedido_id FK
        int produto_id FK
        int quantidade
        decimal preco_unitario
    }
    pagamentos {
        int id PK
        int pedido_id FK
        string forma_pagamento
        string status_pagamento
    }
```
```mermaid
classDiagram
    class Usuario {
        +Long id
        +String nome
        +String email
        +String senhaHash
        +String telefone
        +TipoUsuarioEnum tipoUsuario
        +autenticar() Boolean
        +eAdmin() Boolean
    }

    class Endereco {
        +Long id
        +Long usuarioId
        +String rua
        +String numero
        +String bairro
        +String cep
        +formatarEndereco() String
    }

    class Categoria {
        +Long id
        +String nome
        +Integer ordemExibicao
        +Boolean ativo
    }

    class Produto {
        +Long id
        +Long categoriaId
        +String nome
        +BigDecimal preco
        +Boolean disponivel
        +verificarDisponibilidade() Boolean
    }

    class InsumoEstoque {
        +Long id
        +String nomeItem
        +BigDecimal quantidadeDisponivel
        +UnidadeMedidaEnum unidadeMedida
        +abaterEstoque(BigDecimal qtd) void
        +reporEstoque(BigDecimal qtd) void
    }

    class FichaTecnica {
        +Long id
        +Long produtoId
        +Long insumoId
        +BigDecimal quantidadeNecessaria
        +calcularGastoTotal() BigDecimal
    }

    class Pedido {
        +Long id
        +Long clienteId
        +Long enderecoId
        +StatusPedidoEnum status
        +BigDecimal valorTotal
        +BigDecimal taxaEntrega
        +calcularTotal() BigDecimal
        +atualizarStatus(StatusPedidoEnum s) void
    }

    class ItemPedido {
        +Long id
        +Long pedidoId
        +Long produtoId
        +Integer quantidade
        +BigDecimal precoUnitario
        +calcularSubtotal() BigDecimal
    }

    class Pagamento {
        +Long id
        +Long pedidoId
        +FormaPagamentoEnum formaPagamento
        +StatusPagamentoEnum statusPagamento
        +BigDecimal valorPago
        +processarPagamento() Boolean
    }

    Usuario "1" *-- "N" Endereco : Composicao
    Usuario "1" -- "N" Pedido : Associacao
    Categoria "1" o-- "N" Produto : Agregacao
    Produto "1" -- "N" FichaTecnica : Associacao
    InsumoEstoque "1" -- "N" FichaTecnica : Associacao
    Pedido "1" *-- "N" ItemPedido : Composicao
    Produto "1" -- "N" ItemPedido : Associacao
    Pedido "1" -- "1" Pagamento : Associacao Direta
```