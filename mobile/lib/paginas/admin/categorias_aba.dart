import 'package:flutter/material.dart';

import '../../componentes/comum.dart';
import '../../dados/modelos.dart';
import '../../dados/repositorios.dart';
import '../../tema.dart';

/// (c) CRUD de categorias, com janelinha para criar/editar.
class CategoriasAba extends StatefulWidget {
  const CategoriasAba({super.key});

  @override
  State<CategoriasAba> createState() => _CategoriasAbaState();
}

class _CategoriasAbaState extends State<CategoriasAba> {
  List<Categoria> _categorias = [];

  @override
  void initState() {
    super.initState();
    _carregar();
  }

  Future<void> _carregar() async {
    final lista = await CategoriaRepo().listar();
    if (mounted) setState(() => _categorias = lista);
  }

  Future<void> _editar([Categoria? categoria]) async {
    final nome = TextEditingController(text: categoria?.nome ?? '');
    final ordem = TextEditingController(text: '${categoria?.ordem ?? _categorias.length}');
    var icone = categoria?.icone ?? 'lanche';
    final formKey = GlobalKey<FormState>();

    final salvar = await showDialog<bool>(
      context: context,
      builder: (ctx) => StatefulBuilder(
        builder: (ctx, setDialog) => AlertDialog(
          title: Text(categoria == null ? 'Nova categoria' : 'Editar categoria'),
          content: Form(
            key: formKey,
            child: Column(
              mainAxisSize: MainAxisSize.min,
              children: [
                TextFormField(
                  controller: nome,
                  decoration: const InputDecoration(labelText: 'Nome'),
                  validator: (v) => (v == null || v.trim().isEmpty) ? 'Digite o nome' : null,
                ),
                const SizedBox(height: 12),
                TextFormField(
                  controller: ordem,
                  keyboardType: TextInputType.number,
                  decoration: const InputDecoration(labelText: 'Ordem no cardápio'),
                  validator: (v) => int.tryParse(v?.trim() ?? '') == null ? 'Digite um número' : null,
                ),
                const SizedBox(height: 12),
                const Align(alignment: Alignment.centerLeft, child: Text('Ícone')),
                Wrap(
                  spacing: 6,
                  children: [
                    for (final e in iconesCategoria.entries)
                      ChoiceChip(
                        label: Icon(e.value, size: 20),
                        selected: icone == e.key,
                        onSelected: (_) => setDialog(() => icone = e.key),
                      ),
                  ],
                ),
              ],
            ),
          ),
          actions: [
            TextButton(onPressed: () => Navigator.pop(ctx, false), child: const Text('Cancelar')),
            FilledButton(
              onPressed: () {
                if (formKey.currentState!.validate()) Navigator.pop(ctx, true);
              },
              child: const Text('Salvar'),
            ),
          ],
        ),
      ),
    );

    if (salvar == true) {
      try {
        await CategoriaRepo().salvar(Categoria(
          id: categoria?.id,
          nome: nome.text.trim(),
          icone: icone,
          ordem: int.parse(ordem.text.trim()),
        ));
        if (!mounted) return;
        avisar(context, 'Categoria salva.');
        _carregar();
      } on ErroRegra catch (e) {
        if (mounted) avisar(context, e.mensagem, erro: true);
      }
    }
    // Os campos da janelinha não são descartados aqui de propósito: a animação de fechar
    // ainda usa os controladores por alguns instantes.
  }

  Future<void> _excluir(Categoria c) async {
    final ok = await confirmar(context, 'Excluir ${c.nome}?', 'Só funciona se ela não tiver produtos.', botao: 'Excluir');
    if (!ok) return;
    try {
      await CategoriaRepo().excluir(c.id!);
      if (!mounted) return;
      avisar(context, 'Categoria excluída.');
      _carregar();
    } on ErroRegra catch (e) {
      if (mounted) avisar(context, e.mensagem, erro: true);
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      body: ListView(
        padding: const EdgeInsets.only(top: 8, bottom: 90),
        children: [
          for (final c in _categorias)
            Card(
              color: Colors.white,
              margin: const EdgeInsets.symmetric(horizontal: 16, vertical: 5),
              child: ListTile(
                onTap: () => _editar(c),
                leading: CircleAvatar(
                  backgroundColor: Cores.mostarda,
                  child: Icon(iconeCategoria(c.icone), color: Cores.grelha),
                ),
                title: Text(c.nome, style: const TextStyle(fontWeight: FontWeight.w700)),
                subtitle: Text('Ordem no cardápio: ${c.ordem}'),
                trailing: IconButton(
                  tooltip: 'Excluir',
                  color: Cores.molho,
                  icon: const Icon(Icons.delete_outline),
                  onPressed: () => _excluir(c),
                ),
              ),
            ),
        ],
      ),
      floatingActionButton: FloatingActionButton.extended(
        heroTag: 'nova-categoria',
        onPressed: () => _editar(),
        icon: const Icon(Icons.add),
        label: const Text('Nova categoria'),
      ),
    );
  }
}
