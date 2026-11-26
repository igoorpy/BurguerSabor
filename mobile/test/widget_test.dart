// Testes das regras da sacola e do pedido (não precisam de celular nem de banco).
import 'package:burguer_sabor_app/dados/modelos.dart';
import 'package:burguer_sabor_app/dados/seguranca.dart';
import 'package:burguer_sabor_app/estado/sessao.dart';
import 'package:flutter_test/flutter_test.dart';

Produto produto(int id, double preco, {int estoque = 10}) => Produto(
      id: id,
      categoriaId: 1,
      nome: 'Produto $id',
      descricao: '',
      preco: preco,
      estoque: estoque,
      disponivel: true,
    );

Pedido pedido(String status) => Pedido(
      id: 1,
      clienteId: 2,
      clienteNome: 'Hudson',
      status: status,
      formaPagamento: 'PIX',
      taxaEntrega: 5,
      total: 37,
      criadoEm: '2026-11-22T20:00:00',
      itens: const [],
    );

void main() {
  group('Sacola', () {
    test('soma itens, subtotal e taxa de entrega', () {
      final s = Sacola();
      s.adicionar(produto(1, 32.0), 2);
      s.adicionar(produto(2, 6.0), 1);
      expect(s.quantidade, 3);
      expect(s.subtotal, 70.0);
      expect(s.total, 75.0);
    });

    test('mesmo produto e mesma observação viram uma linha só', () {
      final s = Sacola();
      s.adicionar(produto(1, 10), 1, observacao: 'sem cebola');
      s.adicionar(produto(1, 10), 2, observacao: 'sem cebola');
      s.adicionar(produto(1, 10), 1);
      expect(s.itens.length, 2);
      expect(s.quantidadeDe(produto(1, 10)), 4);
    });

    test('tirar até zero remove o item; sacola vazia não cobra taxa', () {
      final s = Sacola();
      s.adicionar(produto(1, 10), 1);
      s.alterar(s.itens.first, -1);
      expect(s.itens, isEmpty);
      expect(s.total, 0.0);
    });
  });

  group('Pedido', () {
    test('avança uma etapa por vez e para em Entregue', () {
      expect(pedido('RECEBIDO').proximaEtapa, 'PREPARANDO');
      expect(pedido('SAIU_ENTREGA').proximaEtapa, 'ENTREGUE');
      expect(pedido('ENTREGUE').proximaEtapa, isNull);
      expect(pedido('CANCELADO').proximaEtapa, isNull);
    });

    test('só cancela antes de sair para entrega', () {
      expect(pedido('RECEBIDO').podeCancelar, isTrue);
      expect(pedido('PREPARANDO').podeCancelar, isTrue);
      expect(pedido('SAIU_ENTREGA').podeCancelar, isFalse);
    });
  });

  test('a senha nunca é guardada como foi digitada', () {
    final hash = hashSenha('hudson@email.com', 'cliente123');
    expect(hash, isNot(contains('cliente123')));
    expect(hash.length, 64);
    expect(hashSenha('HUDSON@email.com ', 'cliente123'), hash);
  });
}
