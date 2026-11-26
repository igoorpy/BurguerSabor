import 'package:flutter/material.dart';

import '../dados/repositorios.dart';
import '../tema.dart';
import 'login_pagina.dart';

/// Criar conta de cliente.
class CadastroPagina extends StatefulWidget {
  const CadastroPagina({super.key});

  @override
  State<CadastroPagina> createState() => _CadastroPaginaState();
}

class _CadastroPaginaState extends State<CadastroPagina> {
  final _form = GlobalKey<FormState>();
  final _nome = TextEditingController();
  final _email = TextEditingController();
  final _senha = TextEditingController();
  final _confirmar = TextEditingController();
  bool _carregando = false;
  String? _erro;

  @override
  void dispose() {
    _nome.dispose();
    _email.dispose();
    _senha.dispose();
    _confirmar.dispose();
    super.dispose();
  }

  Future<void> _criar() async {
    if (!_form.currentState!.validate()) return;
    setState(() {
      _carregando = true;
      _erro = null;
    });
    try {
      final usuario = await UsuarioRepo().cadastrar(_nome.text, _email.text, _senha.text);
      if (!mounted) return;
      irParaInicio(context, usuario);
    } on ErroRegra catch (e) {
      setState(() => _erro = e.mensagem);
    } finally {
      if (mounted) setState(() => _carregando = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('Criar conta')),
      body: SafeArea(
        child: Form(
          key: _form,
          child: ListView(
            padding: const EdgeInsets.all(24),
            children: [
              TextFormField(
                controller: _nome,
                textCapitalization: TextCapitalization.words,
                decoration: const InputDecoration(labelText: 'Nome', prefixIcon: Icon(Icons.person_outline)),
                validator: (v) => (v == null || v.trim().length < 2) ? 'Digite seu nome' : null,
              ),
              const SizedBox(height: 14),
              TextFormField(
                controller: _email,
                keyboardType: TextInputType.emailAddress,
                decoration: const InputDecoration(labelText: 'E-mail', prefixIcon: Icon(Icons.email_outlined)),
                validator: (v) {
                  final t = v?.trim() ?? '';
                  return (!t.contains('@') || !t.contains('.')) ? 'Digite um e-mail válido' : null;
                },
              ),
              const SizedBox(height: 14),
              TextFormField(
                controller: _senha,
                obscureText: true,
                decoration: const InputDecoration(labelText: 'Senha', prefixIcon: Icon(Icons.lock_outline)),
                validator: (v) => (v == null || v.length < 6) ? 'Use pelo menos 6 caracteres' : null,
              ),
              const SizedBox(height: 14),
              TextFormField(
                controller: _confirmar,
                obscureText: true,
                decoration: const InputDecoration(labelText: 'Confirmar senha', prefixIcon: Icon(Icons.lock_outline)),
                validator: (v) => v != _senha.text ? 'As senhas não são iguais' : null,
              ),
              if (_erro != null) ...[
                const SizedBox(height: 12),
                Text(_erro!, style: const TextStyle(color: Cores.molho, fontWeight: FontWeight.w600)),
              ],
              const SizedBox(height: 20),
              FilledButton(
                style: FilledButton.styleFrom(padding: const EdgeInsets.symmetric(vertical: 16)),
                onPressed: _carregando ? null : _criar,
                child: const Text('Criar conta', style: TextStyle(fontSize: 16)),
              ),
            ],
          ),
        ),
      ),
    );
  }
}
