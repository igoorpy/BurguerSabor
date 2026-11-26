import 'package:sqflite/sqflite.dart';

import 'banco.dart';
import 'modelos.dart';
import 'seguranca.dart';

/// Erro de regra de negócio, com uma mensagem para mostrar na tela.
class ErroRegra implements Exception {
  final String mensagem;
  ErroRegra(this.mensagem);

  @override
  String toString() => mensagem;
}

/// Todo SQL usa "?" no lugar dos valores (consulta parametrizada):
/// o que a pessoa digita nunca vira parte do comando.

class UsuarioRepo {
  Future<Usuario> entrar(String email, String senha) async {
    final db = await Banco.db;
    final e = email.trim().toLowerCase();
    final linhas = await db.query(
      'usuarios',
      where: 'email = ? AND senha_hash = ?',
      whereArgs: [e, hashSenha(e, senha)],
      limit: 1,
    );
    if (linhas.isEmpty) throw ErroRegra('E-mail ou senha incorretos.');
    return Usuario.fromMap(linhas.first);
  }

  Future<Usuario> cadastrar(String nome, String email, String senha) async {
    final db = await Banco.db;
    final e = email.trim().toLowerCase();
    final existe = await db.query('usuarios', where: 'email = ?', whereArgs: [e], limit: 1);
    if (existe.isNotEmpty) throw ErroRegra('Já existe uma conta com esse e-mail.');
    final id = await db.insert('usuarios', {
      'nome': nome.trim(),
      'email': e,
      'senha_hash': hashSenha(e, senha),
      'tipo_usuario': 'CLIENTE',
    });
    return Usuario(id: id, nome: nome.trim(), email: e, tipo: 'CLIENTE');
  }
}

class CategoriaRepo {
  Future<List<Categoria>> listar() async {
    final db = await Banco.db;
    final linhas = await db.query('categorias', orderBy: 'ordem, nome');
    return linhas.map(Categoria.fromMap).toList();
  }

  /// Cria (sem id) ou altera (com id).
  Future<void> salvar(Categoria c) async {
    final db = await Banco.db;
    try {
      if (c.id == null) {
        await db.insert('categorias', c.toMap());
      } else {
        await db.update('categorias', c.toMap(), where: 'id = ?', whereArgs: [c.id]);
      }
    } on DatabaseException catch (e) {
      if (e.isUniqueConstraintError()) throw ErroRegra('Já existe uma categoria com esse nome.');
      rethrow;
    }
  }

  Future<void> excluir(int id) async {
    final db = await Banco.db;
    final usados = Sqflite.firstIntValue(
          await db.rawQuery('SELECT COUNT(*) FROM produtos WHERE categoria_id = ?', [id]),
        ) ??
        0;
    if (usados > 0) {
      throw ErroRegra('Esta categoria tem $usados produto(s). Mova ou exclua os produtos antes.');
    }
    await db.delete('categorias', where: 'id = ?', whereArgs: [id]);
  }
}

class ProdutoRepo {
  /// Lista com busca por nome/descrição e filtro de categoria.
  Future<List<Produto>> listar({String busca = '', int? categoriaId, bool somenteNoCardapio = false}) async {
    final db = await Banco.db;
    final condicoes = <String>[];
    final valores = <Object?>[];
    if (busca.trim().isNotEmpty) {
      condicoes.add('(p.nome LIKE ? OR p.descricao LIKE ?)');
      final termo = '%${busca.trim()}%';
      valores
        ..add(termo)
        ..add(termo);
    }
    if (categoriaId != null) {
      condicoes.add('p.categoria_id = ?');
      valores.add(categoriaId);
    }
    if (somenteNoCardapio) condicoes.add('p.disponivel = 1');
    final where = condicoes.isEmpty ? '' : 'WHERE ${condicoes.join(' AND ')}';
    final linhas = await db.rawQuery(
      'SELECT p.*, c.nome AS categoria_nome, c.icone AS categoria_icone '
      'FROM produtos p JOIN categorias c ON c.id = p.categoria_id '
      '$where ORDER BY c.ordem, p.nome',
      valores,
    );
    return linhas.map(Produto.fromMap).toList();
  }

  Future<void> salvar(Produto p) async {
    final db = await Banco.db;
    if (p.id == null) {
      await db.insert('produtos', p.toMap());
    } else {
      await db.update('produtos', p.toMap(), where: 'id = ?', whereArgs: [p.id]);
    }
  }

  Future<void> excluir(int id) async {
    final db = await Banco.db;
    final vendido = Sqflite.firstIntValue(
          await db.rawQuery('SELECT COUNT(*) FROM itens_pedido WHERE produto_id = ?', [id]),
        ) ??
        0;
    if (vendido > 0) {
      throw ErroRegra('Este produto já foi vendido e não pode ser excluído. Desligue "No cardápio" para escondê-lo.');
    }
    await db.delete('produtos', where: 'id = ?', whereArgs: [id]);
  }
}

class PedidoRepo {
  static const taxaEntrega = 5.0;

  /// Grava o pedido e desconta o estoque numa TRANSAÇÃO:
  /// se qualquer item não tiver estoque, nada é gravado (tudo ou nada).
  Future<int> criar(Usuario cliente, List<ItemSacola> itens, String formaPagamento) async {
    if (itens.isEmpty) throw ErroRegra('A sacola está vazia.');
    final db = await Banco.db;
    return db.transaction((txn) async {
      // Soma as quantidades por produto (o mesmo lanche pode vir com observações diferentes)
      final porProduto = <int, int>{};
      for (final i in itens) {
        porProduto[i.produto.id!] = (porProduto[i.produto.id!] ?? 0) + i.quantidade;
      }
      for (final entrada in porProduto.entries) {
        final linhas = await txn.query('produtos', where: 'id = ?', whereArgs: [entrada.key], limit: 1);
        if (linhas.isEmpty) throw ErroRegra('Um produto da sacola não existe mais.');
        final p = Produto.fromMap(linhas.first);
        if (!p.disponivel) throw ErroRegra('${p.nome} saiu do cardápio.');
        if (p.estoque < entrada.value) {
          throw ErroRegra('Estoque insuficiente de ${p.nome}: restam ${p.estoque}.');
        }
      }

      final subtotal = itens.fold<double>(0, (soma, i) => soma + i.subtotal);
      final pedidoId = await txn.insert('pedidos', {
        'cliente_id': cliente.id,
        'status': 'RECEBIDO',
        'forma_pagamento': formaPagamento,
        'taxa_entrega': taxaEntrega,
        'total': subtotal + taxaEntrega,
        'criado_em': DateTime.now().toIso8601String(),
      });
      for (final i in itens) {
        await txn.insert('itens_pedido', {
          'pedido_id': pedidoId,
          'produto_id': i.produto.id,
          'quantidade': i.quantidade,
          'preco_unitario': i.produto.preco,
          'observacao': i.observacao,
        });
      }
      for (final entrada in porProduto.entries) {
        await txn.rawUpdate('UPDATE produtos SET estoque = estoque - ? WHERE id = ?', [entrada.value, entrada.key]);
      }
      return pedidoId;
    });
  }

  /// Pedidos de um cliente (clienteId) ou de todos (admin).
  Future<List<Pedido>> listar({int? clienteId}) async {
    final db = await Banco.db;
    final linhas = await db.rawQuery(
      'SELECT p.*, u.nome AS cliente_nome FROM pedidos p JOIN usuarios u ON u.id = p.cliente_id '
      '${clienteId == null ? '' : 'WHERE p.cliente_id = ?'} ORDER BY p.id DESC',
      clienteId == null ? [] : [clienteId],
    );
    final pedidos = <Pedido>[];
    for (final m in linhas) {
      final itens = await db.rawQuery(
        'SELECT i.quantidade, i.preco_unitario, i.observacao, pr.nome AS produto_nome '
        'FROM itens_pedido i JOIN produtos pr ON pr.id = i.produto_id WHERE i.pedido_id = ? ORDER BY i.id',
        [m['id']],
      );
      pedidos.add(Pedido(
        id: m['id'] as int,
        clienteId: m['cliente_id'] as int,
        clienteNome: m['cliente_nome'] as String,
        status: m['status'] as String,
        formaPagamento: m['forma_pagamento'] as String,
        taxaEntrega: (m['taxa_entrega'] as num).toDouble(),
        total: (m['total'] as num).toDouble(),
        criadoEm: m['criado_em'] as String,
        itens: itens.map(ItemPedido.fromMap).toList(),
      ));
    }
    return pedidos;
  }

  /// Avança uma etapa: Recebido → Em preparo → Saiu para entrega → Entregue.
  Future<void> avancar(Pedido pedido) async {
    final proxima = pedido.proximaEtapa;
    if (proxima == null) throw ErroRegra('Este pedido já foi finalizado.');
    final db = await Banco.db;
    await db.update('pedidos', {'status': proxima}, where: 'id = ? AND status = ?', whereArgs: [pedido.id, pedido.status]);
  }

  /// Cancela e devolve os produtos ao estoque (também numa transação).
  Future<void> cancelar(Pedido pedido) async {
    if (!pedido.podeCancelar) throw ErroRegra('Este pedido não pode mais ser cancelado.');
    final db = await Banco.db;
    await db.transaction((txn) async {
      final alterados = await txn.update(
        'pedidos',
        {'status': 'CANCELADO'},
        where: 'id = ? AND status IN (?, ?)',
        whereArgs: [pedido.id, 'RECEBIDO', 'PREPARANDO'],
      );
      if (alterados == 0) throw ErroRegra('Este pedido não pode mais ser cancelado.');
      final itens = await txn.query('itens_pedido', where: 'pedido_id = ?', whereArgs: [pedido.id]);
      for (final i in itens) {
        await txn.rawUpdate('UPDATE produtos SET estoque = estoque + ? WHERE id = ?', [i['quantidade'], i['produto_id']]);
      }
    });
  }
}
