import 'package:flutter/material.dart';

import '../../componentes/comum.dart';
import '../../dados/modelos.dart';
import '../../dados/repositorios.dart';
import '../../estado/sessao.dart';
import '../../tema.dart';
import '../boas_vindas_pagina.dart';
import 'meus_pedidos_pagina.dart';
import 'sacola_pagina.dart';

/// Tela principal do cliente: (b) barra de opções no topo + ferramenta de busca + cardápio.
class ClienteInicioPagina extends StatefulWidget {
  const ClienteInicioPagina({super.key});

  @override
  State<ClienteInicioPagina> createState() => _ClienteInicioPaginaState();
}

class _ClienteInicioPaginaState extends State<ClienteInicioPagina> {
  final _busca = TextEditingController();
  List<Categoria> _categorias = [];
  List<Produto> _produtos = [];
  int? _categoriaId;
  bool _carregando = true;

  @override
  void initState() {
    super.initState();
    _carregarTudo();
  }

  @override
  void dispose() {
    _busca.dispose();
    super.dispose();
  }

  Future<void> _carregarTudo() async {
    final categorias = await CategoriaRepo().listar();
    if (!mounted) return;
    setState(() => _categorias = categorias);
    await _carregarProdutos();
  }

  Future<void> _carregarProdutos() async {
    final produtos = await ProdutoRepo().listar(busca: _busca.text, categoriaId: _categoriaId, somenteNoCardapio: true);
    if (!mounted) return;
    setState(() {
      _produtos = produtos;
      _carregando = false;
    });
  }

  Future<void> _abrir(Widget pagina) async {
    await Navigator.push(context, MaterialPageRoute(builder: (_) => pagina));
    _carregarProdutos(); // o estoque pode ter mudado
  }

  Future<void> _sair() async {
    final ok = await confirmar(context, 'Sair da conta', 'Sua sacola será esvaziada.', botao: 'Sair');
    if (!ok || !mounted) return;
    Sessao.sair();
    Navigator.pushAndRemoveUntil(
        context, MaterialPageRoute(builder: (_) => const BoasVindasPagina()), (rota) => false);
  }

  void _escolherProduto(Produto p) {
    showModalBottomSheet<void>(
      context: context,
      isScrollControlled: true,
      showDragHandle: true,
      builder: (_) => _FolhaProduto(produto: p),
    );
  }

  @override
  Widget build(BuildContext context) {
    final nome = Sessao.atual?.nome.split(' ').first ?? '';
    return Scaffold(
      // (b) Barra de opções
      appBar: AppBar(
        title: const Text('Burguer & Sabor'),
        actions: [
          ListenableBuilder(
            listenable: Sacola.instancia,
            builder: (context, _) => IconButton(
              tooltip: 'Sacola',
              onPressed: () => _abrir(const SacolaPagina()),
              icon: Badge(
                isLabelVisible: Sacola.instancia.quantidade > 0,
                label: Text('${Sacola.instancia.quantidade}'),
                child: const Icon(Icons.shopping_bag_outlined),
              ),
            ),
          ),
          PopupMenuButton<String>(
            tooltip: 'Opções',
            onSelected: (opcao) {
              switch (opcao) {
                case 'pedidos':
                  _abrir(const MeusPedidosPagina());
                case 'sacola':
                  _abrir(const SacolaPagina());
                case 'sair':
                  _sair();
              }
            },
            itemBuilder: (_) => const [
              PopupMenuItem(value: 'pedidos', child: ListTile(leading: Icon(Icons.receipt_long), title: Text('Meus pedidos'))),
              PopupMenuItem(value: 'sacola', child: ListTile(leading: Icon(Icons.shopping_bag), title: Text('Sacola'))),
              PopupMenuItem(value: 'sair', child: ListTile(leading: Icon(Icons.logout), title: Text('Sair'))),
            ],
          ),
        ],
      ),
      body: Column(
        children: [
          Container(
            width: double.infinity,
            color: Cores.mostarda,
            padding: const EdgeInsets.fromLTRB(16, 12, 16, 16),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text('Olá, $nome! O que vai ser hoje?',
                    style: const TextStyle(fontSize: 18, fontWeight: FontWeight.w800, color: Cores.grelha)),
                const SizedBox(height: 10),
                // (b) Ferramenta de busca
                TextField(
                  controller: _busca,
                  textInputAction: TextInputAction.search,
                  decoration: InputDecoration(
                    hintText: 'Buscar no cardápio (ex.: bacon)',
                    prefixIcon: const Icon(Icons.search),
                    suffixIcon: _busca.text.isEmpty
                        ? null
                        : IconButton(
                            tooltip: 'Limpar busca',
                            icon: const Icon(Icons.clear),
                            onPressed: () {
                              _busca.clear();
                              _carregarProdutos();
                            },
                          ),
                    border: OutlineInputBorder(borderRadius: BorderRadius.circular(30)),
                    isDense: true,
                  ),
                  onChanged: (_) => _carregarProdutos(),
                ),
              ],
            ),
          ),
          // Filtro por categoria
          SizedBox(
            height: 56,
            child: ListView(
              scrollDirection: Axis.horizontal,
              padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
              children: [
                Padding(
                  padding: const EdgeInsets.only(right: 8),
                  child: ChoiceChip(
                    label: const Text('Tudo'),
                    selected: _categoriaId == null,
                    onSelected: (_) {
                      setState(() => _categoriaId = null);
                      _carregarProdutos();
                    },
                  ),
                ),
                for (final c in _categorias)
                  Padding(
                    padding: const EdgeInsets.only(right: 8),
                    child: ChoiceChip(
                      avatar: Icon(iconeCategoria(c.icone), size: 18),
                      label: Text(c.nome),
                      selected: _categoriaId == c.id,
                      onSelected: (_) {
                        setState(() => _categoriaId = c.id);
                        _carregarProdutos();
                      },
                    ),
                  ),
              ],
            ),
          ),
          Expanded(
            child: _carregando
                ? const Center(child: CircularProgressIndicator())
                : RefreshIndicator(
                    onRefresh: _carregarProdutos,
                    child: _produtos.isEmpty
                        ? ListView(children: const [
                            SizedBox(height: 80),
                            Icon(Icons.search_off, size: 56, color: Colors.black38),
                            SizedBox(height: 8),
                            Text('Nada encontrado.', textAlign: TextAlign.center),
                          ])
                        : ListView.builder(
                            padding: const EdgeInsets.only(bottom: 90),
                            itemCount: _produtos.length,
                            itemBuilder: (_, i) => _CartaoProduto(
                              produto: _produtos[i],
                              onTap: () => _escolherProduto(_produtos[i]),
                            ),
                          ),
                  ),
          ),
        ],
      ),
      floatingActionButton: ListenableBuilder(
        listenable: Sacola.instancia,
        builder: (context, _) => Sacola.instancia.quantidade == 0
            ? const SizedBox.shrink()
            : FloatingActionButton.extended(
                onPressed: () => _abrir(const SacolaPagina()),
                icon: const Icon(Icons.shopping_bag),
                label: Text('Ver sacola · ${reais(Sacola.instancia.total)}'),
              ),
      ),
    );
  }
}

class _CartaoProduto extends StatelessWidget {
  final Produto produto;
  final VoidCallback onTap;
  const _CartaoProduto({required this.produto, required this.onTap});

  @override
  Widget build(BuildContext context) {
    final esgotado = !produto.podeVender;
    return Card(
      color: Colors.white,
      margin: const EdgeInsets.symmetric(horizontal: 16, vertical: 6),
      child: ListTile(
        enabled: !esgotado,
        onTap: esgotado ? null : onTap,
        contentPadding: const EdgeInsets.symmetric(horizontal: 14, vertical: 6),
        leading: CircleAvatar(
          radius: 26,
          backgroundColor: Cores.mostarda,
          child: Icon(iconeCategoria(produto.categoriaIcone), color: Cores.grelha, size: 28),
        ),
        title: Text(produto.nome, style: const TextStyle(fontWeight: FontWeight.w700)),
        subtitle: Text(esgotado ? 'Esgotado no momento' : produto.descricao, maxLines: 2, overflow: TextOverflow.ellipsis),
        trailing: Text(reais(produto.preco),
            style: const TextStyle(fontWeight: FontWeight.w800, color: Cores.molho, fontSize: 15)),
      ),
    );
  }
}

/// Folha que sobe de baixo: quantidade, observação e "Adicionar".
class _FolhaProduto extends StatefulWidget {
  final Produto produto;
  const _FolhaProduto({required this.produto});

  @override
  State<_FolhaProduto> createState() => _FolhaProdutoState();
}

class _FolhaProdutoState extends State<_FolhaProduto> {
  final _obs = TextEditingController();
  int _qtd = 1;

  @override
  void dispose() {
    _obs.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final p = widget.produto;
    final jaNaSacola = Sacola.instancia.quantidadeDe(p);
    var maximo = p.estoque - jaNaSacola; // não deixa pedir mais do que tem no estoque
    if (maximo < 0) maximo = 0;
    if (maximo > 50) maximo = 50;
    return Padding(
      padding: EdgeInsets.fromLTRB(20, 0, 20, MediaQuery.of(context).viewInsets.bottom + 20),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Row(
            children: [
              CircleAvatar(
                radius: 30,
                backgroundColor: Cores.mostarda,
                child: Icon(iconeCategoria(p.categoriaIcone), color: Cores.grelha, size: 32),
              ),
              const SizedBox(width: 14),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(p.nome, style: const TextStyle(fontSize: 20, fontWeight: FontWeight.w800)),
                    Text(reais(p.preco), style: const TextStyle(color: Cores.molho, fontWeight: FontWeight.w700)),
                  ],
                ),
              ),
            ],
          ),
          const SizedBox(height: 10),
          Text(p.descricao),
          const SizedBox(height: 14),
          TextField(
            controller: _obs,
            maxLength: 100,
            decoration: const InputDecoration(labelText: 'Alguma observação?', hintText: 'Ex.: sem cebola'),
          ),
          if (maximo == 0)
            const Text('Você já colocou na sacola todo o estoque deste item.',
                style: TextStyle(color: Cores.molho, fontWeight: FontWeight.w600)),
          Row(
            children: [
              IconButton.outlined(
                tooltip: 'Menos',
                onPressed: _qtd > 1 ? () => setState(() => _qtd--) : null,
                icon: const Icon(Icons.remove),
              ),
              Padding(
                padding: const EdgeInsets.symmetric(horizontal: 14),
                child: Text('$_qtd', style: const TextStyle(fontSize: 20, fontWeight: FontWeight.w800)),
              ),
              IconButton.outlined(
                tooltip: 'Mais',
                onPressed: _qtd < maximo ? () => setState(() => _qtd++) : null,
                icon: const Icon(Icons.add),
              ),
              const SizedBox(width: 12),
              Expanded(
                child: FilledButton(
                  style: FilledButton.styleFrom(padding: const EdgeInsets.symmetric(vertical: 14)),
                  onPressed: maximo == 0
                      ? null
                      : () {
                          final mensageiro = ScaffoldMessenger.of(context);
                          Sacola.instancia.adicionar(p, _qtd, observacao: _obs.text);
                          Navigator.pop(context);
                          mensageiro.showSnackBar(SnackBar(
                            content: Text('$_qtd× ${p.nome} na sacola'),
                            behavior: SnackBarBehavior.floating,
                          ));
                        },
                  child: Text('Adicionar ${reais(p.preco * _qtd)}'),
                ),
              ),
            ],
          ),
        ],
      ),
    );
  }
}
