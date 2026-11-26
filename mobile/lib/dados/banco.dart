import 'package:path/path.dart';
import 'package:sqflite/sqflite.dart';

import 'seguranca.dart';

/// Abre o banco SQLite que fica DENTRO do celular (arquivo burguer_sabor.db).
/// Na primeira vez, cria as tabelas e coloca os dados de exemplo.
class Banco {
  Banco._();

  static const _arquivo = 'burguer_sabor.db';
  static Database? _db;

  static Future<Database> get db async => _db ??= await _abrir();

  static Future<Database> _abrir() async {
    final caminho = join(await getDatabasesPath(), _arquivo);
    return openDatabase(
      caminho,
      version: 1,
      // Liga as chaves estrangeiras (no SQLite elas vêm desligadas)
      onConfigure: (db) => db.execute('PRAGMA foreign_keys = ON'),
      onCreate: (db, versao) async {
        await _criarTabelas(db);
        await _dadosDeExemplo(db);
      },
    );
  }

  /// Apaga o banco e volta aos dados de exemplo (bom antes de apresentar).
  static Future<void> resetar() async {
    await _db?.close();
    _db = null;
    await deleteDatabase(join(await getDatabasesPath(), _arquivo));
  }

  static Future<void> _criarTabelas(Database db) async {
    await db.execute('''
      CREATE TABLE usuarios (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        nome TEXT NOT NULL,
        email TEXT NOT NULL UNIQUE,
        senha_hash TEXT NOT NULL,
        tipo_usuario TEXT NOT NULL CHECK (tipo_usuario IN ('CLIENTE', 'ADMIN'))
      )''');
    await db.execute('''
      CREATE TABLE categorias (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        nome TEXT NOT NULL UNIQUE,
        icone TEXT NOT NULL DEFAULT 'lanche',
        ordem INTEGER NOT NULL DEFAULT 0
      )''');
    await db.execute('''
      CREATE TABLE produtos (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        categoria_id INTEGER NOT NULL REFERENCES categorias(id) ON DELETE RESTRICT,
        nome TEXT NOT NULL,
        descricao TEXT NOT NULL DEFAULT '',
        preco REAL NOT NULL CHECK (preco > 0),
        estoque INTEGER NOT NULL DEFAULT 0 CHECK (estoque >= 0),
        disponivel INTEGER NOT NULL DEFAULT 1
      )''');
    await db.execute('''
      CREATE TABLE pedidos (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        cliente_id INTEGER NOT NULL REFERENCES usuarios(id) ON DELETE RESTRICT,
        status TEXT NOT NULL DEFAULT 'RECEBIDO'
          CHECK (status IN ('RECEBIDO', 'PREPARANDO', 'SAIU_ENTREGA', 'ENTREGUE', 'CANCELADO')),
        forma_pagamento TEXT NOT NULL,
        taxa_entrega REAL NOT NULL,
        total REAL NOT NULL CHECK (total >= 0),
        criado_em TEXT NOT NULL
      )''');
    await db.execute('''
      CREATE TABLE itens_pedido (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        pedido_id INTEGER NOT NULL REFERENCES pedidos(id) ON DELETE CASCADE,
        produto_id INTEGER NOT NULL REFERENCES produtos(id) ON DELETE RESTRICT,
        quantidade INTEGER NOT NULL CHECK (quantidade > 0),
        preco_unitario REAL NOT NULL CHECK (preco_unitario > 0),
        observacao TEXT NOT NULL DEFAULT ''
      )''');
  }

  static Future<void> _dadosDeExemplo(Database db) async {
    // Contas de teste (senhas fictícias)
    await db.insert('usuarios', {
      'nome': 'Gerente Admin',
      'email': 'admin@burguersabor.com',
      'senha_hash': hashSenha('admin@burguersabor.com', 'admin123'),
      'tipo_usuario': 'ADMIN',
    });
    await db.insert('usuarios', {
      'nome': 'Hudson Cliente',
      'email': 'hudson@email.com',
      'senha_hash': hashSenha('hudson@email.com', 'cliente123'),
      'tipo_usuario': 'CLIENTE',
    });

    final categorias = [
      ['Combos', 'combo', 0],
      ['Hambúrgueres', 'lanche', 1],
      ['Bebidas', 'bebida', 2],
      ['Acompanhamentos', 'porcao', 3],
      ['Pizzas', 'pizza', 4],
      ['Sobremesas', 'sobremesa', 5],
    ];
    final ids = <String, int>{};
    for (final c in categorias) {
      ids[c[0] as String] = await db.insert('categorias', {'nome': c[0], 'icone': c[1], 'ordem': c[2]});
    }

    // [categoria, nome, descrição, preço, estoque]
    final produtos = [
      ['Combos', 'Combo X-Bacon', 'X-Bacon + batata média + refrigerante', 46.90, 15],
      ['Combos', 'Combo X-Cheddar', 'X-Cheddar + batata média + refrigerante', 42.90, 15],
      ['Combos', 'Combo Casal', 'Dois X-Bacon + batata grande + dois refrigerantes', 84.90, 8],
      ['Hambúrgueres', 'Burguer X-Bacon', 'Pão brioche, blend 180g, cheddar e bacon crocante', 32.00, 20],
      ['Hambúrgueres', 'Burguer X-Cheddar', 'Pão brioche, blend 180g e cheddar em dobro', 28.50, 20],
      ['Hambúrgueres', 'Burguer Salada', 'Blend 180g, cheddar, alface, tomate e molho especial', 26.90, 20],
      ['Hambúrgueres', 'Chicken Crispy', 'Frango empanado crocante, alface e molho especial', 27.90, 12],
      ['Bebidas', 'Refrigerante Cola 350ml', 'Lata gelada', 6.00, 40],
      ['Bebidas', 'Guaraná 350ml', 'Lata gelada', 6.00, 40],
      ['Bebidas', 'Suco de Laranja 300ml', 'Natural, feito na hora', 8.50, 20],
      ['Acompanhamentos', 'Batata Frita Média', 'Porção de 200g', 14.00, 25],
      ['Acompanhamentos', 'Anéis de Cebola', 'Porção de 200g, empanados e crocantes', 17.90, 15],
      ['Pizzas', 'Pizza Calabresa', 'Massa, mussarela e calabresa', 45.00, 10],
      ['Pizzas', 'Pizza Margherita', 'Massa, mussarela e tomate', 42.00, 10],
      ['Sobremesas', 'Brownie com Sorvete', 'Brownie de chocolate com sorvete de creme', 16.90, 4],
      ['Sobremesas', 'Sorvete com Calda', 'Duas bolas de creme com calda de chocolate', 11.90, 12],
    ];
    for (final p in produtos) {
      await db.insert('produtos', {
        'categoria_id': ids[p[0]],
        'nome': p[1],
        'descricao': p[2],
        'preco': p[3],
        'estoque': p[4],
        'disponivel': 1,
      });
    }
  }
}
