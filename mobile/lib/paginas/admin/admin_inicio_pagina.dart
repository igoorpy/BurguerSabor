import 'package:flutter/material.dart';

import '../../componentes/comum.dart';
import '../../dados/banco.dart';
import '../../estado/sessao.dart';
import '../../tema.dart';
import '../boas_vindas_pagina.dart';
import 'categorias_aba.dart';
import 'pedidos_aba.dart';
import 'produtos_aba.dart';

/// Painel da loja: (b) barra de opções no topo e navegação embaixo entre Produtos, Categorias e Pedidos.
class AdminInicioPagina extends StatefulWidget {
  const AdminInicioPagina({super.key});

  @override
  State<AdminInicioPagina> createState() => _AdminInicioPaginaState();
}

class _AdminInicioPaginaState extends State<AdminInicioPagina> {
  int _aba = 0;
  static const _titulos = ['Produtos', 'Categorias', 'Pedidos'];

  void _irParaBoasVindas() {
    Navigator.pushAndRemoveUntil(
        context, MaterialPageRoute(builder: (_) => const BoasVindasPagina()), (rota) => false);
  }

  Future<void> _opcao(String opcao) async {
    switch (opcao) {
      case 'sair':
        Sessao.sair();
        _irParaBoasVindas();
      case 'resetar':
        final ok = await confirmar(
          context,
          'Voltar aos dados de exemplo?',
          'Apaga pedidos, contas novas e alterações no cardápio, e volta ao começo. Bom antes de apresentar.',
          botao: 'Resetar',
        );
        if (!ok) return;
        await Banco.resetar();
        Sessao.sair();
        if (!mounted) return;
        avisar(context, 'Dados de exemplo restaurados. Entre de novo.');
        _irParaBoasVindas();
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: Text('Loja · ${_titulos[_aba]}'),
        actions: [
          PopupMenuButton<String>(
            tooltip: 'Opções',
            onSelected: _opcao,
            itemBuilder: (_) => const [
              PopupMenuItem(value: 'resetar', child: ListTile(leading: Icon(Icons.restart_alt), title: Text('Resetar dados de exemplo'))),
              PopupMenuItem(value: 'sair', child: ListTile(leading: Icon(Icons.logout), title: Text('Sair'))),
            ],
          ),
        ],
      ),
      body: switch (_aba) {
        0 => const ProdutosAba(),
        1 => const CategoriasAba(),
        _ => const PedidosAba(),
      },
      bottomNavigationBar: NavigationBar(
        selectedIndex: _aba,
        indicatorColor: Cores.mostarda,
        onDestinationSelected: (i) => setState(() => _aba = i),
        destinations: const [
          NavigationDestination(icon: Icon(Icons.restaurant_menu), label: 'Produtos'),
          NavigationDestination(icon: Icon(Icons.category_outlined), label: 'Categorias'),
          NavigationDestination(icon: Icon(Icons.receipt_long), label: 'Pedidos'),
        ],
      ),
    );
  }
}
