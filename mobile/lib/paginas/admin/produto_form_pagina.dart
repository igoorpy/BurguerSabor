import 'package:flutter/material.dart';

import '../../dados/modelos.dart';
import '../../dados/repositorios.dart';

/// Formulário para cadastrar (produto == null) ou editar um produto.
class ProdutoFormPagina extends StatefulWidget {
  final Produto? produto;
  const ProdutoFormPagina({super.key, this.produto});

  @override
  State<ProdutoFormPagina> createState() => _ProdutoFormPaginaState();
}

class _ProdutoFormPaginaState extends State<ProdutoFormPagina> {
  final _form = GlobalKey<FormState>();
  late final TextEditingController _nome;
  late final TextEditingController _descricao;
  late final TextEditingController _preco;
  late final TextEditingController _estoque;
  List<Categoria> _categorias = [];
  int? _categoriaId;
  bool _disponivel = true;
  bool _salvando = false;

  bool get _editando => widget.produto != null;

  @override
  void initState() {
    super.initState();
    final p = widget.produto;
    _nome = TextEditingController(text: p?.nome ?? '');
    _descricao = TextEditingController(text: p?.descricao ?? '');
    _preco = TextEditingController(text: p == null ? '' : p.preco.toStringAsFixed(2).replaceAll('.', ','));
    _estoque = TextEditingController(text: p == null ? '' : '${p.estoque}');
    _categoriaId = p?.categoriaId;
    _disponivel = p?.disponivel ?? true;
    CategoriaRepo().listar().then((lista) {
      if (mounted) setState(() => _categorias = lista);
    });
  }

  @override
  void dispose() {
    _nome.dispose();
    _descricao.dispose();
    _preco.dispose();
    _estoque.dispose();
    super.dispose();
  }

  double? _lerPreco(String texto) => double.tryParse(texto.trim().replaceAll(',', '.'));

  Future<void> _salvar() async {
    if (!_form.currentState!.validate()) return;
    setState(() => _salvando = true);
    await ProdutoRepo().salvar(Produto(
      id: widget.produto?.id,
      categoriaId: _categoriaId!,
      nome: _nome.text.trim(),
      descricao: _descricao.text.trim(),
      preco: _lerPreco(_preco.text)!,
      estoque: int.parse(_estoque.text.trim()),
      disponivel: _disponivel,
    ));
    if (mounted) Navigator.pop(context, true);
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: Text(_editando ? 'Editar produto' : 'Novo produto')),
      body: Form(
        key: _form,
        child: ListView(
          padding: const EdgeInsets.all(20),
          children: [
            TextFormField(
              controller: _nome,
              textCapitalization: TextCapitalization.sentences,
              decoration: const InputDecoration(labelText: 'Nome *'),
              validator: (v) => (v == null || v.trim().isEmpty) ? 'Digite o nome' : null,
            ),
            const SizedBox(height: 14),
            TextFormField(
              controller: _descricao,
              maxLines: 2,
              decoration: const InputDecoration(labelText: 'Descrição'),
            ),
            const SizedBox(height: 14),
            // Espera as categorias carregarem para já mostrar a categoria certa ao editar
            if (_categorias.isEmpty)
              const LinearProgressIndicator()
            else
              DropdownButtonFormField<int>(
                initialValue: _categorias.any((c) => c.id == _categoriaId) ? _categoriaId : null,
                decoration: const InputDecoration(labelText: 'Categoria *'),
                items: [
                  for (final c in _categorias) DropdownMenuItem(value: c.id, child: Text(c.nome)),
                ],
                onChanged: (v) => setState(() => _categoriaId = v),
                validator: (v) => v == null ? 'Escolha a categoria' : null,
              ),
            const SizedBox(height: 14),
            Row(
              children: [
                Expanded(
                  child: TextFormField(
                    controller: _preco,
                    keyboardType: const TextInputType.numberWithOptions(decimal: true),
                    decoration: const InputDecoration(labelText: 'Preço (R\$) *', hintText: '32,00'),
                    validator: (v) {
                      final preco = _lerPreco(v ?? '');
                      if (preco == null) return 'Digite o preço';
                      if (preco <= 0) return 'Deve ser maior que zero';
                      return null;
                    },
                  ),
                ),
                const SizedBox(width: 12),
                Expanded(
                  child: TextFormField(
                    controller: _estoque,
                    keyboardType: TextInputType.number,
                    decoration: const InputDecoration(labelText: 'Estoque *', hintText: '20'),
                    validator: (v) {
                      final qtd = int.tryParse(v?.trim() ?? '');
                      if (qtd == null) return 'Digite um número';
                      if (qtd < 0) return 'Não pode ser negativo';
                      return null;
                    },
                  ),
                ),
              ],
            ),
            const SizedBox(height: 8),
            SwitchListTile(
              contentPadding: EdgeInsets.zero,
              title: const Text('No cardápio'),
              subtitle: const Text('Desligado, o produto some para o cliente (sem apagar).'),
              value: _disponivel,
              onChanged: (v) => setState(() => _disponivel = v),
            ),
            const SizedBox(height: 16),
            FilledButton.icon(
              style: FilledButton.styleFrom(padding: const EdgeInsets.symmetric(vertical: 16)),
              onPressed: _salvando ? null : _salvar,
              icon: const Icon(Icons.save),
              label: Text(_editando ? 'Salvar alterações' : 'Cadastrar produto'),
            ),
          ],
        ),
      ),
    );
  }
}
