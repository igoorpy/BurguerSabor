import 'package:flutter/material.dart';

import '../dados/modelos.dart';
import '../tema.dart';

/// Mensagem rápida na parte de baixo da tela.
void avisar(BuildContext context, String texto, {bool erro = false}) {
  ScaffoldMessenger.of(context)
    ..hideCurrentSnackBar()
    ..showSnackBar(SnackBar(
      content: Text(texto),
      backgroundColor: erro ? Cores.molho : Cores.grelha,
      behavior: SnackBarBehavior.floating,
    ));
}

/// Pergunta "tem certeza?" e devolve true se a pessoa confirmar.
Future<bool> confirmar(BuildContext context, String titulo, String texto, {String botao = 'Confirmar'}) async {
  final resposta = await showDialog<bool>(
    context: context,
    builder: (ctx) => AlertDialog(
      title: Text(titulo),
      content: Text(texto),
      actions: [
        TextButton(onPressed: () => Navigator.pop(ctx, false), child: const Text('Voltar')),
        FilledButton(onPressed: () => Navigator.pop(ctx, true), child: Text(botao)),
      ],
    ),
  );
  return resposta ?? false;
}

/// Etiqueta colorida com a etapa do pedido.
class EtiquetaStatus extends StatelessWidget {
  final String status;
  const EtiquetaStatus(this.status, {super.key});

  @override
  Widget build(BuildContext context) {
    final cor = switch (status) {
      'ENTREGUE' => Cores.verde,
      'CANCELADO' => Colors.grey,
      'SAIU_ENTREGA' => Colors.blue,
      _ => Cores.mostarda,
    };
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
      decoration: BoxDecoration(color: cor, borderRadius: BorderRadius.circular(20)),
      child: Text(
        nomesStatus[status] ?? status,
        style: TextStyle(
          color: status == 'RECEBIDO' || status == 'PREPARANDO' ? Cores.grelha : Colors.white,
          fontWeight: FontWeight.w700,
          fontSize: 12,
        ),
      ),
    );
  }
}

/// Cartão com os dados de um pedido (usado pelo cliente e pela loja).
class CartaoPedido extends StatelessWidget {
  final Pedido pedido;
  final bool mostrarCliente;
  final List<Widget> acoes;

  const CartaoPedido({super.key, required this.pedido, this.mostrarCliente = false, this.acoes = const []});

  @override
  Widget build(BuildContext context) {
    return Card(
      color: Colors.white,
      margin: const EdgeInsets.symmetric(horizontal: 16, vertical: 6),
      child: Padding(
        padding: const EdgeInsets.all(14),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              children: [
                Text('Pedido #${pedido.id}', style: const TextStyle(fontWeight: FontWeight.w800, fontSize: 16)),
                const Spacer(),
                EtiquetaStatus(pedido.status),
              ],
            ),
            const SizedBox(height: 4),
            Text(
              '${dataHora(pedido.criadoEm)}${mostrarCliente ? ' · ${pedido.clienteNome}' : ''}',
              style: const TextStyle(color: Colors.black54),
            ),
            const Divider(),
            for (final i in pedido.itens)
              Padding(
                padding: const EdgeInsets.symmetric(vertical: 2),
                child: Text(
                  '${i.quantidade}× ${i.produtoNome}${i.observacao.isEmpty ? '' : ' (${i.observacao})'}',
                ),
              ),
            const SizedBox(height: 6),
            Row(
              children: [
                Text(formasPagamento[pedido.formaPagamento] ?? pedido.formaPagamento,
                    style: const TextStyle(color: Colors.black54)),
                const Spacer(),
                Text(reais(pedido.total), style: const TextStyle(fontWeight: FontWeight.w800, fontSize: 16)),
              ],
            ),
            if (acoes.isNotEmpty) ...[
              const SizedBox(height: 8),
              Wrap(spacing: 8, runSpacing: 8, children: acoes),
            ],
          ],
        ),
      ),
    );
  }
}
