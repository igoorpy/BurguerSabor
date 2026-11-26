/// Os "moldes" dos dados do app. Cada classe corresponde a uma tabela do banco.
library;

class Usuario {
  final int id;
  final String nome;
  final String email;
  final String tipo; // CLIENTE ou ADMIN

  const Usuario({required this.id, required this.nome, required this.email, required this.tipo});

  bool get ehAdmin => tipo == 'ADMIN';

  factory Usuario.fromMap(Map<String, Object?> m) => Usuario(
        id: m['id'] as int,
        nome: m['nome'] as String,
        email: m['email'] as String,
        tipo: m['tipo_usuario'] as String,
      );
}

class Categoria {
  final int? id;
  final String nome;
  final String icone;
  final int ordem;

  const Categoria({this.id, required this.nome, required this.icone, required this.ordem});

  factory Categoria.fromMap(Map<String, Object?> m) => Categoria(
        id: m['id'] as int,
        nome: m['nome'] as String,
        icone: m['icone'] as String,
        ordem: m['ordem'] as int,
      );

  Map<String, Object?> toMap() => {'nome': nome, 'icone': icone, 'ordem': ordem};
}

class Produto {
  final int? id;
  final int categoriaId;
  final String? categoriaNome;
  final String? categoriaIcone;
  final String nome;
  final String descricao;
  final double preco;
  final int estoque;
  final bool disponivel;

  const Produto({
    this.id,
    required this.categoriaId,
    this.categoriaNome,
    this.categoriaIcone,
    required this.nome,
    required this.descricao,
    required this.preco,
    required this.estoque,
    required this.disponivel,
  });

  /// Só pode ser vendido se está no cardápio e tem estoque.
  bool get podeVender => disponivel && estoque > 0;

  factory Produto.fromMap(Map<String, Object?> m) => Produto(
        id: m['id'] as int,
        categoriaId: m['categoria_id'] as int,
        categoriaNome: m['categoria_nome'] as String?,
        categoriaIcone: m['categoria_icone'] as String?,
        nome: m['nome'] as String,
        descricao: m['descricao'] as String,
        preco: (m['preco'] as num).toDouble(),
        estoque: m['estoque'] as int,
        disponivel: (m['disponivel'] as int) == 1,
      );

  Map<String, Object?> toMap() => {
        'categoria_id': categoriaId,
        'nome': nome,
        'descricao': descricao,
        'preco': preco,
        'estoque': estoque,
        'disponivel': disponivel ? 1 : 0,
      };
}

class ItemSacola {
  final Produto produto;
  int quantidade;
  final String observacao;

  ItemSacola({required this.produto, required this.quantidade, this.observacao = ''});

  double get subtotal => produto.preco * quantidade;
}

class ItemPedido {
  final String produtoNome;
  final int quantidade;
  final double precoUnitario;
  final String observacao;

  const ItemPedido({required this.produtoNome, required this.quantidade, required this.precoUnitario, required this.observacao});

  factory ItemPedido.fromMap(Map<String, Object?> m) => ItemPedido(
        produtoNome: m['produto_nome'] as String,
        quantidade: m['quantidade'] as int,
        precoUnitario: (m['preco_unitario'] as num).toDouble(),
        observacao: m['observacao'] as String,
      );
}

/// Etapas do pedido, na ordem.
const etapasPedido = ['RECEBIDO', 'PREPARANDO', 'SAIU_ENTREGA', 'ENTREGUE'];

const nomesStatus = {
  'RECEBIDO': 'Recebido',
  'PREPARANDO': 'Em preparo',
  'SAIU_ENTREGA': 'Saiu para entrega',
  'ENTREGUE': 'Entregue',
  'CANCELADO': 'Cancelado',
};

const formasPagamento = {
  'PIX': 'Pix',
  'CARTAO_CREDITO': 'Cartão de crédito',
  'CARTAO_DEBITO': 'Cartão de débito',
  'DINHEIRO': 'Dinheiro',
};

class Pedido {
  final int id;
  final int clienteId;
  final String clienteNome;
  final String status;
  final String formaPagamento;
  final double taxaEntrega;
  final double total;
  final String criadoEm;
  final List<ItemPedido> itens;

  const Pedido({
    required this.id,
    required this.clienteId,
    required this.clienteNome,
    required this.status,
    required this.formaPagamento,
    required this.taxaEntrega,
    required this.total,
    required this.criadoEm,
    required this.itens,
  });

  /// Próxima etapa, ou null se já terminou (entregue ou cancelado).
  String? get proximaEtapa {
    final i = etapasPedido.indexOf(status);
    if (i < 0 || i == etapasPedido.length - 1) return null;
    return etapasPedido[i + 1];
  }

  bool get podeCancelar => status == 'RECEBIDO' || status == 'PREPARANDO';
}
