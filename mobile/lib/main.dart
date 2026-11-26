import 'package:flutter/material.dart';

import 'paginas/boas_vindas_pagina.dart';
import 'tema.dart';

void main() {
  WidgetsFlutterBinding.ensureInitialized();
  runApp(const BurguerSaborApp());
}

class BurguerSaborApp extends StatelessWidget {
  const BurguerSaborApp({super.key});

  @override
  Widget build(BuildContext context) {
    return MaterialApp(
      title: 'Burguer & Sabor',
      debugShowCheckedModeBanner: false,
      theme: temaApp(),
      home: const BoasVindasPagina(),
    );
  }
}
