import 'package:flutter/foundation.dart';

import '../dados/modelos.dart';

/// Quem está logado agora.
class Sessao {
  Sessao._();
  static Usuario? atual;

  static void sair() {
    atual = null;
    Sacola.instancia.limpar(); // a sacola é de quem está logado
  }
}

/// A sacola do cliente. Avisa as telas sempre que muda (ChangeNotifier).
class Sacola extends ChangeNotifier {
  Sacola();
  static final instancia = Sacola();
  static const taxaEntrega = 5.0;

  final List<ItemSacola> _itens = [];

  List<ItemSacola> get itens => List.unmodifiable(_itens);
  int get quantidade => _itens.fold(0, (soma, i) => soma + i.quantidade);
  double get subtotal => _itens.fold(0.0, (soma, i) => soma + i.subtotal);
  double get total => _itens.isEmpty ? 0.0 : subtotal + taxaEntrega;

  /// Quanto deste produto já está na sacola (somando observações diferentes).
  int quantidadeDe(Produto p) =>
      _itens.where((i) => i.produto.id == p.id).fold(0, (soma, i) => soma + i.quantidade);

  void adicionar(Produto produto, int quantidade, {String observacao = ''}) {
    final obs = observacao.trim();
    for (final i in _itens) {
      if (i.produto.id == produto.id && i.observacao == obs) {
        i.quantidade += quantidade;
        notifyListeners();
        return;
      }
    }
    _itens.add(ItemSacola(produto: produto, quantidade: quantidade, observacao: obs));
    notifyListeners();
  }

  /// Soma ou tira 1; se chegar a zero, sai da sacola.
  void alterar(ItemSacola item, int delta) {
    item.quantidade += delta;
    if (item.quantidade <= 0) _itens.remove(item);
    notifyListeners();
  }

  void remover(ItemSacola item) {
    _itens.remove(item);
    notifyListeners();
  }

  void limpar() {
    _itens.clear();
    notifyListeners();
  }
}
