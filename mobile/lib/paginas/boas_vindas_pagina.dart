import 'package:flutter/material.dart';

import '../tema.dart';
import 'cadastro_pagina.dart';
import 'login_pagina.dart';

/// (a) Tela de boas-vindas: a primeira coisa que aparece ao abrir o app.
class BoasVindasPagina extends StatelessWidget {
  const BoasVindasPagina({super.key});

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: Cores.mostarda,
      body: SafeArea(
        child: Padding(
          padding: const EdgeInsets.all(24),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              const Spacer(),
              Container(
                width: 140,
                height: 140,
                alignment: Alignment.center,
                decoration: const BoxDecoration(color: Cores.grelha, shape: BoxShape.circle),
                child: const Icon(Icons.lunch_dining, size: 84, color: Cores.mostarda),
              ),
              const SizedBox(height: 24),
              const Text(
                'Burguer & Sabor',
                textAlign: TextAlign.center,
                style: TextStyle(fontSize: 34, fontWeight: FontWeight.w900, color: Cores.grelha),
              ),
              const SizedBox(height: 8),
              const Text(
                'Seu lanche favorito em poucos toques.\nPeça, acompanhe e aproveite!',
                textAlign: TextAlign.center,
                style: TextStyle(fontSize: 16, color: Cores.grelha),
              ),
              const Spacer(),
              FilledButton(
                style: FilledButton.styleFrom(
                  backgroundColor: Cores.molho,
                  padding: const EdgeInsets.symmetric(vertical: 16),
                ),
                onPressed: () => Navigator.push(context, MaterialPageRoute(builder: (_) => const LoginPagina())),
                child: const Text('Entrar', style: TextStyle(fontSize: 16)),
              ),
              const SizedBox(height: 12),
              OutlinedButton(
                style: OutlinedButton.styleFrom(
                  foregroundColor: Cores.grelha,
                  side: const BorderSide(color: Cores.grelha, width: 2),
                  padding: const EdgeInsets.symmetric(vertical: 16),
                ),
                onPressed: () => Navigator.push(context, MaterialPageRoute(builder: (_) => const CadastroPagina())),
                child: const Text('Criar conta', style: TextStyle(fontSize: 16)),
              ),
              const SizedBox(height: 16),
              const Text(
                'Projeto de apresentação · pagamento simulado',
                textAlign: TextAlign.center,
                style: TextStyle(fontSize: 12, color: Cores.grelha),
              ),
            ],
          ),
        ),
      ),
    );
  }
}
