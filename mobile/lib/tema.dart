import 'package:flutter/material.dart';

/// Cores da marca (as mesmas do site).
class Cores {
  static const mostarda = Color(0xFFF2B705);
  static const molho = Color(0xFFC8102E);
  static const grelha = Color(0xFF2A1E17);
  static const papel = Color(0xFFFFFBF0);
  static const verde = Color(0xFF2E7D4F);
}

ThemeData temaApp() {
  final esquema = ColorScheme.fromSeed(
    seedColor: Cores.molho,
    primary: Cores.molho,
    secondary: Cores.mostarda,
  );
  return ThemeData(
    useMaterial3: true,
    colorScheme: esquema,
    scaffoldBackgroundColor: Cores.papel,
    appBarTheme: const AppBarTheme(
      backgroundColor: Cores.grelha,
      foregroundColor: Colors.white,
    ),
    inputDecorationTheme: const InputDecorationTheme(
      border: OutlineInputBorder(),
      filled: true,
      fillColor: Colors.white,
    ),
  );
}

/// 12.5 -> "R$ 12,50"
String reais(double valor) => 'R\$ ${valor.toStringAsFixed(2).replaceAll('.', ',')}';

/// "2026-11-22T20:15:00" -> "22/11 20:15"
String dataHora(String iso) {
  final d = DateTime.tryParse(iso);
  if (d == null) return iso;
  String dois(int n) => n.toString().padLeft(2, '0');
  return '${dois(d.day)}/${dois(d.month)} ${dois(d.hour)}:${dois(d.minute)}';
}

/// Ícone de cada categoria (guardado no banco como uma palavra).
const iconesCategoria = <String, IconData>{
  'combo': Icons.takeout_dining,
  'lanche': Icons.lunch_dining,
  'bebida': Icons.local_drink,
  'porcao': Icons.fastfood,
  'pizza': Icons.local_pizza,
  'sobremesa': Icons.icecream,
};

IconData iconeCategoria(String? chave) => iconesCategoria[chave] ?? Icons.restaurant;
