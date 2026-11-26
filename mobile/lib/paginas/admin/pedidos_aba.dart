import 'package:flutter/material.dart';

import '../../componentes/comum.dart';
import '../../dados/modelos.dart';
import '../../dados/repositorios.dart';

/// Fila de pedidos da loja: avançar etapa e cancelar.
class PedidosAba extends StatefulWidget {
  const PedidosAba({super.key});

  @override
  State<PedidosAba> createState() => _PedidosAbaState();
}

class _PedidosAbaState extends State<PedidosAba> {
  List<Pedido> _pedidos = [];
  String? _filtro; // null = todos
  bool _carregando = true;

  @override
  void initState() {
    super.initState();
    _carregar();
  }

  Future<void> _carregar() async {
    final lista = await PedidoRepo().listar();
    if (!mounted) return;
    setState(() {
      _pedidos = lista;
      _carregando = false;
    });
  }

  Future<void> _avancar(Pedido p) async {
    try {
      await PedidoRepo().avancar(p);
      if (!mounted) return;
      avisar(context, 'Pedido #${p.id}: ${nomesStatus[p.proximaEtapa]}.');
      _carregar();
    } on ErroRegra catch (e) {
      if (mounted) avisar(context, e.mensagem, erro: true);
    }
  }

  Future<void> _cancelar(Pedido p) async {
    final ok = await confirmar(context, 'Cancelar pedido #${p.id}?', 'Os produtos voltam ao estoque.',
        botao: 'Cancelar pedido');
    if (!ok) return;
    try {
      await PedidoRepo().cancelar(p);
      if (!mounted) return;
      avisar(context, 'Pedido #${p.id} cancelado.');
      _carregar();
    } on ErroRegra catch (e) {
      if (mounted) avisar(context, e.mensagem, erro: true);
    }
  }

  @override
  Widget build(BuildContext context) {
    final visiveis = _filtro == null ? _pedidos : _pedidos.where((p) => p.status == _filtro).toList();
    return Column(
      children: [
        SizedBox(
          height: 56,
          child: ListView(
            scrollDirection: Axis.horizontal,
            padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
            children: [
              for (final s in <String?>[null, ...etapasPedido, 'CANCELADO'])
                Padding(
                  padding: const EdgeInsets.only(right: 8),
                  child: ChoiceChip(
                    label: Text(s == null ? 'Todos' : nomesStatus[s]!),
                    selected: _filtro == s,
                    onSelected: (_) => setState(() => _filtro = s),
                  ),
                ),
            ],
          ),
        ),
        Expanded(
          child: _carregando
              ? const Center(child: CircularProgressIndicator())
              : RefreshIndicator(
                  onRefresh: _carregar,
                  child: visiveis.isEmpty
                      ? ListView(children: const [
                          SizedBox(height: 100),
                          Icon(Icons.inbox_outlined, size: 56, color: Colors.black38),
                          SizedBox(height: 8),
                          Text('Nenhum pedido aqui.', textAlign: TextAlign.center),
                        ])
                      : ListView(
                          padding: const EdgeInsets.only(bottom: 16),
                          children: [
                            for (final p in visiveis)
                              CartaoPedido(
                                pedido: p,
                                mostrarCliente: true,
                                acoes: [
                                  if (p.proximaEtapa != null)
                                    FilledButton.icon(
                                      onPressed: () => _avancar(p),
                                      icon: const Icon(Icons.arrow_forward),
                                      label: Text('Marcar: ${nomesStatus[p.proximaEtapa]}'),
                                    ),
                                  if (p.podeCancelar)
                                    OutlinedButton(onPressed: () => _cancelar(p), child: const Text('Cancelar')),
                                ],
                              ),
                          ],
                        ),
                ),
        ),
      ],
    );
  }
}
