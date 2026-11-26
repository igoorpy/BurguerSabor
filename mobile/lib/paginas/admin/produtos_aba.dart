import 'package:flutter/material.dart';

import '../../componentes/comum.dart';
import '../../dados/modelos.dart';
import '../../dados/repositorios.dart';
import '../../tema.dart';
import 'produto_form_pagina.dart';

/// (c) CRUD de produtos: listar + buscar (Read), novo (Create), tocar para editar (Update), lixeira (Delete).
class ProdutosAba extends StatefulWidget {
  const ProdutosAba({super.key});

  @override
  State<ProdutosAba> createState() => _ProdutosAbaState();
}

class _ProdutosAbaState extends State<ProdutosAba> {
  final _busca = TextEditingController();
  List<Produto> _produtos = [];
  bool _carregando = true;

  @override
  void initState() {
    super.initState();
    _carregar();
  }

  @override
  void dispose() {
    _busca.dispose();
    super.dispose();
  }

  Future<void> _carregar() async {
    final lista = await ProdutoRepo().listar(busca: _busca.text);
    if (!mounted) return;
    setState(() {
      _produtos = lista;
      _carregando = false;
    });
  }

  Future<void> _abrirFormulario([Produto? produto]) async {
    final salvou = await Navigator.push<bool>(
      context,
      MaterialPageRoute(builder: (_) => ProdutoFormPagina(produto: produto)),
    );
    if (salvou == true) {
      _carregar();
      if (mounted) avisar(context, produto == null ? 'Produto cadastrado.' : 'Produto atualizado.');
    }
  }

  Future<void> _excluir(Produto p) async {
    final ok = await confirmar(context, 'Excluir ${p.nome}?', 'Esta ação não pode ser desfeita.', botao: 'Excluir');
    if (!ok) return;
    try {
      await ProdutoRepo().excluir(p.id!);
      if (!mounted) return;
      avisar(context, '${p.nome} excluído.');
      _carregar();
    } on ErroRegra catch (e) {
      if (mounted) avisar(context, e.mensagem, erro: true);
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      body: Column(
        children: [
          Padding(
            padding: const EdgeInsets.fromLTRB(16, 12, 16, 4),
            child: TextField(
              controller: _busca,
              decoration: InputDecoration(
                hintText: 'Buscar produto',
                prefixIcon: const Icon(Icons.search),
                border: OutlineInputBorder(borderRadius: BorderRadius.circular(30)),
                isDense: true,
              ),
              onChanged: (_) => _carregar(),
            ),
          ),
          Expanded(
            child: _carregando
                ? const Center(child: CircularProgressIndicator())
                : RefreshIndicator(
                    onRefresh: _carregar,
                    child: ListView.builder(
                      padding: const EdgeInsets.only(bottom: 90),
                      itemCount: _produtos.length,
                      itemBuilder: (_, i) {
                        final p = _produtos[i];
                        final estoqueBaixo = p.estoque <= 5;
                        return Card(
                          color: Colors.white,
                          margin: const EdgeInsets.symmetric(horizontal: 16, vertical: 5),
                          child: ListTile(
                            onTap: () => _abrirFormulario(p),
                            leading: CircleAvatar(
                              backgroundColor: p.disponivel ? Cores.mostarda : Colors.black12,
                              child: Icon(iconeCategoria(p.categoriaIcone), color: Cores.grelha),
                            ),
                            title: Text(p.nome, style: const TextStyle(fontWeight: FontWeight.w700)),
                            subtitle: Text(
                              '${p.categoriaNome} · ${reais(p.preco)}\n'
                              'Estoque: ${p.estoque}${estoqueBaixo ? ' (repor!)' : ''}'
                              '${p.disponivel ? '' : ' · fora do cardápio'}',
                              style: TextStyle(color: estoqueBaixo ? Cores.molho : null),
                            ),
                            isThreeLine: true,
                            trailing: IconButton(
                              tooltip: 'Excluir',
                              color: Cores.molho,
                              icon: const Icon(Icons.delete_outline),
                              onPressed: () => _excluir(p),
                            ),
                          ),
                        );
                      },
                    ),
                  ),
          ),
        ],
      ),
      floatingActionButton: FloatingActionButton.extended(
        heroTag: 'novo-produto',
        onPressed: () => _abrirFormulario(),
        icon: const Icon(Icons.add),
        label: const Text('Novo produto'),
      ),
    );
  }
}
