import 'package:flutter/material.dart';

import '../../componentes/comum.dart';
import '../../dados/modelos.dart';
import '../../dados/repositorios.dart';
import '../../estado/sessao.dart';

/// Histórico de pedidos do cliente, com cancelamento enquanto está "Recebido".
class MeusPedidosPagina extends StatefulWidget {
  const MeusPedidosPagina({super.key});

  @override
  State<MeusPedidosPagina> createState() => _MeusPedidosPaginaState();
}

class _MeusPedidosPaginaState extends State<MeusPedidosPagina> {
  late Future<List<Pedido>> _pedidos;

  @override
  void initState() {
    super.initState();
    _carregar();
  }

  void _carregar() {
    _pedidos = PedidoRepo().listar(clienteId: Sessao.atual?.id);
  }

  Future<void> _atualizar() async {
    setState(_carregar);
    await _pedidos;
  }

  Future<void> _cancelar(Pedido p) async {
    final ok = await confirmar(context, 'Cancelar pedido #${p.id}?',
        'O pagamento é estornado (simulado) e os produtos voltam ao estoque.', botao: 'Cancelar pedido');
    if (!ok) return;
    try {
      await PedidoRepo().cancelar(p);
      if (!mounted) return;
      avisar(context, 'Pedido #${p.id} cancelado.');
      _atualizar();
    } on ErroRegra catch (e) {
      if (mounted) avisar(context, e.mensagem, erro: true);
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('Meus pedidos')),
      body: FutureBuilder<List<Pedido>>(
        future: _pedidos,
        builder: (context, snap) {
          if (snap.connectionState != ConnectionState.done) {
            return const Center(child: CircularProgressIndicator());
          }
          final pedidos = snap.data ?? [];
          return RefreshIndicator(
            onRefresh: _atualizar,
            child: pedidos.isEmpty
                ? ListView(children: const [
                    SizedBox(height: 100),
                    Icon(Icons.receipt_long, size: 56, color: Colors.black38),
                    SizedBox(height: 8),
                    Text('Você ainda não fez pedidos.', textAlign: TextAlign.center),
                  ])
                : ListView(
                    padding: const EdgeInsets.symmetric(vertical: 8),
                    children: [
                      const Padding(
                        padding: EdgeInsets.fromLTRB(20, 4, 20, 8),
                        child: Text('Puxe a tela para baixo para atualizar o status.',
                            style: TextStyle(color: Colors.black54)),
                      ),
                      for (final p in pedidos)
                        CartaoPedido(
                          pedido: p,
                          acoes: [
                            if (p.status == 'RECEBIDO')
                              OutlinedButton.icon(
                                onPressed: () => _cancelar(p),
                                icon: const Icon(Icons.close),
                                label: const Text('Cancelar pedido'),
                              ),
                          ],
                        ),
                    ],
                  ),
          );
        },
      ),
    );
  }
}
