import 'package:flutter/material.dart';

import '../../componentes/comum.dart';
import '../../dados/modelos.dart';
import '../../dados/repositorios.dart';
import '../../estado/sessao.dart';
import '../../tema.dart';
import 'meus_pedidos_pagina.dart';

/// Sacola: mudar quantidade, tirar item (lixeira), escolher pagamento e fazer o pedido.
class SacolaPagina extends StatefulWidget {
  const SacolaPagina({super.key});

  @override
  State<SacolaPagina> createState() => _SacolaPaginaState();
}

class _SacolaPaginaState extends State<SacolaPagina> {
  String _pagamento = 'PIX';
  bool _enviando = false;

  Future<void> _fazerPedido() async {
    final cliente = Sessao.atual;
    if (cliente == null) return;
    setState(() => _enviando = true);
    try {
      final id = await PedidoRepo().criar(cliente, Sacola.instancia.itens, _pagamento);
      Sacola.instancia.limpar();
      if (!mounted) return;
      avisar(context, 'Pedido #$id recebido pela loja!');
      Navigator.pushReplacement(context, MaterialPageRoute(builder: (_) => const MeusPedidosPagina()));
    } on ErroRegra catch (e) {
      if (mounted) avisar(context, e.mensagem, erro: true);
    } finally {
      if (mounted) setState(() => _enviando = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('Sua sacola')),
      body: ListenableBuilder(
        listenable: Sacola.instancia,
        builder: (context, _) {
          final sacola = Sacola.instancia;
          if (sacola.itens.isEmpty) {
            return Center(
              child: Column(
                mainAxisSize: MainAxisSize.min,
                children: [
                  const Icon(Icons.shopping_bag_outlined, size: 64, color: Colors.black38),
                  const SizedBox(height: 8),
                  const Text('Sua sacola está vazia.'),
                  const SizedBox(height: 12),
                  OutlinedButton(onPressed: () => Navigator.pop(context), child: const Text('Ver cardápio')),
                ],
              ),
            );
          }
          return ListView(
            padding: const EdgeInsets.only(bottom: 24),
            children: [
              for (final item in sacola.itens) _LinhaItem(item: item),
              const SizedBox(height: 8),
              Padding(
                padding: const EdgeInsets.symmetric(horizontal: 20),
                child: Column(
                  children: [
                    _LinhaValor('Subtotal', sacola.subtotal),
                    _LinhaValor('Taxa de entrega', Sacola.taxaEntrega),
                    const Divider(),
                    _LinhaValor('Total', sacola.total, forte: true),
                    const SizedBox(height: 16),
                    const Align(
                      alignment: Alignment.centerLeft,
                      child: Text('Forma de pagamento (simulado)', style: TextStyle(fontWeight: FontWeight.w700)),
                    ),
                    const SizedBox(height: 8),
                    Wrap(
                      spacing: 8,
                      runSpacing: 8,
                      children: [
                        for (final f in formasPagamento.entries)
                          ChoiceChip(
                            label: Text(f.value),
                            selected: _pagamento == f.key,
                            onSelected: (_) => setState(() => _pagamento = f.key),
                          ),
                      ],
                    ),
                    const SizedBox(height: 20),
                    SizedBox(
                      width: double.infinity,
                      child: FilledButton.icon(
                        style: FilledButton.styleFrom(padding: const EdgeInsets.symmetric(vertical: 16)),
                        onPressed: _enviando ? null : _fazerPedido,
                        icon: const Icon(Icons.check),
                        label: Text('Fazer pedido · ${reais(sacola.total)}', style: const TextStyle(fontSize: 16)),
                      ),
                    ),
                  ],
                ),
              ),
            ],
          );
        },
      ),
    );
  }
}

class _LinhaItem extends StatelessWidget {
  final ItemSacola item;
  const _LinhaItem({required this.item});

  @override
  Widget build(BuildContext context) {
    final sacola = Sacola.instancia;
    final podeMais = sacola.quantidadeDe(item.produto) < item.produto.estoque;
    return Card(
      color: Colors.white,
      margin: const EdgeInsets.symmetric(horizontal: 16, vertical: 6),
      child: Padding(
        padding: const EdgeInsets.fromLTRB(14, 10, 6, 10),
        child: Row(
          children: [
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(item.produto.nome, style: const TextStyle(fontWeight: FontWeight.w700)),
                  if (item.observacao.isNotEmpty)
                    Text('Obs.: ${item.observacao}', style: const TextStyle(color: Colors.black54)),
                  Text(reais(item.subtotal), style: const TextStyle(color: Cores.molho, fontWeight: FontWeight.w700)),
                ],
              ),
            ),
            IconButton(
              tooltip: 'Menos',
              onPressed: () => sacola.alterar(item, -1),
              icon: const Icon(Icons.remove_circle_outline),
            ),
            Text('${item.quantidade}', style: const TextStyle(fontSize: 16, fontWeight: FontWeight.w800)),
            IconButton(
              tooltip: 'Mais',
              onPressed: podeMais ? () => sacola.alterar(item, 1) : null,
              icon: const Icon(Icons.add_circle_outline),
            ),
            IconButton(
              tooltip: 'Tirar da sacola',
              color: Cores.molho,
              onPressed: () => sacola.remover(item),
              icon: const Icon(Icons.delete_outline),
            ),
          ],
        ),
      ),
    );
  }
}

class _LinhaValor extends StatelessWidget {
  final String rotulo;
  final double valor;
  final bool forte;
  const _LinhaValor(this.rotulo, this.valor, {this.forte = false});

  @override
  Widget build(BuildContext context) {
    final estilo = TextStyle(fontSize: forte ? 18 : 15, fontWeight: forte ? FontWeight.w800 : FontWeight.w400);
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 3),
      child: Row(children: [Text(rotulo, style: estilo), const Spacer(), Text(reais(valor), style: estilo)]),
    );
  }
}
