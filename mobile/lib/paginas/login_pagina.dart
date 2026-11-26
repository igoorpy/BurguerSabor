import 'package:flutter/material.dart';

import '../dados/modelos.dart';
import '../dados/repositorios.dart';
import '../estado/sessao.dart';
import '../tema.dart';
import 'admin/admin_inicio_pagina.dart';
import 'cadastro_pagina.dart';
import 'cliente/cliente_inicio_pagina.dart';

/// Depois de entrar, cada perfil vai para a sua tela inicial.
void irParaInicio(BuildContext context, Usuario usuario) {
  Sessao.atual = usuario;
  Navigator.pushAndRemoveUntil(
    context,
    MaterialPageRoute(builder: (_) => usuario.ehAdmin ? const AdminInicioPagina() : const ClienteInicioPagina()),
    (rota) => false,
  );
}

/// (a) Tela de login.
class LoginPagina extends StatefulWidget {
  const LoginPagina({super.key});

  @override
  State<LoginPagina> createState() => _LoginPaginaState();
}

class _LoginPaginaState extends State<LoginPagina> {
  final _form = GlobalKey<FormState>();
  final _email = TextEditingController();
  final _senha = TextEditingController();
  bool _verSenha = false;
  bool _carregando = false;
  String? _erro;

  @override
  void dispose() {
    _email.dispose();
    _senha.dispose();
    super.dispose();
  }

  void _preencher(String email, String senha) {
    setState(() {
      _email.text = email;
      _senha.text = senha;
      _erro = null;
    });
  }

  Future<void> _entrar() async {
    if (!_form.currentState!.validate()) return;
    setState(() {
      _carregando = true;
      _erro = null;
    });
    try {
      final usuario = await UsuarioRepo().entrar(_email.text, _senha.text);
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
      appBar: AppBar(title: const Text('Entrar')),
      body: SafeArea(
        child: ListView(
          padding: const EdgeInsets.all(24),
          children: [
            const Icon(Icons.lunch_dining, size: 64, color: Cores.molho),
            const SizedBox(height: 8),
            const Text('Bem-vindo de volta!',
                textAlign: TextAlign.center, style: TextStyle(fontSize: 22, fontWeight: FontWeight.w800)),
            const SizedBox(height: 24),
            Form(
              key: _form,
              child: Column(
                children: [
                  TextFormField(
                    controller: _email,
                    keyboardType: TextInputType.emailAddress,
                    decoration: const InputDecoration(labelText: 'E-mail', prefixIcon: Icon(Icons.email_outlined)),
                    validator: (v) => (v == null || !v.contains('@')) ? 'Digite um e-mail válido' : null,
                  ),
                  const SizedBox(height: 14),
                  TextFormField(
                    controller: _senha,
                    obscureText: !_verSenha,
                    decoration: InputDecoration(
                      labelText: 'Senha',
                      prefixIcon: const Icon(Icons.lock_outline),
                      suffixIcon: IconButton(
                        tooltip: _verSenha ? 'Esconder senha' : 'Mostrar senha',
                        icon: Icon(_verSenha ? Icons.visibility_off : Icons.visibility),
                        onPressed: () => setState(() => _verSenha = !_verSenha),
                      ),
                    ),
                    validator: (v) => (v == null || v.isEmpty) ? 'Digite a senha' : null,
                    onFieldSubmitted: (_) => _entrar(),
                  ),
                ],
              ),
            ),
            if (_erro != null) ...[
              const SizedBox(height: 12),
              Text(_erro!, style: const TextStyle(color: Cores.molho, fontWeight: FontWeight.w600)),
            ],
            const SizedBox(height: 20),
            FilledButton(
              style: FilledButton.styleFrom(padding: const EdgeInsets.symmetric(vertical: 16)),
              onPressed: _carregando ? null : _entrar,
              child: _carregando
                  ? const SizedBox(width: 20, height: 20, child: CircularProgressIndicator(strokeWidth: 2))
                  : const Text('Entrar', style: TextStyle(fontSize: 16)),
            ),
            TextButton(
              onPressed: () =>
                  Navigator.pushReplacement(context, MaterialPageRoute(builder: (_) => const CadastroPagina())),
              child: const Text('Ainda não tem conta? Criar conta'),
            ),
            const Divider(height: 32),
            const Text('Contas de teste (senhas fictícias):', textAlign: TextAlign.center),
            Wrap(
              alignment: WrapAlignment.center,
              spacing: 8,
              children: [
                ActionChip(
                  avatar: const Icon(Icons.person, size: 18),
                  label: const Text('Cliente'),
                  onPressed: () => _preencher('hudson@email.com', 'cliente123'),
                ),
                ActionChip(
                  avatar: const Icon(Icons.storefront, size: 18),
                  label: const Text('Loja (admin)'),
                  onPressed: () => _preencher('admin@burguersabor.com', 'admin123'),
                ),
              ],
            ),
          ],
        ),
      ),
    );
  }
}
