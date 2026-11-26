# Burguer & Sabor — App Mobile (Flutter)

App Android do Burguer & Sabor, feito em **Dart com Flutter** no Android Studio. É uma versão para celular inspirada no site, não uma cópia: os dados ficam num **banco SQLite dentro do próprio celular**, então o app funciona sozinho, sem o notebook ligado e sem internet.

Projeto de apresentação: pagamento simulado e contas de teste com senhas fictícias.

## O que o professor pediu e onde está

| Requisito do quadro | Onde está no app |
|---|---|
| **(a) Tela de boas-vindas / login** | Boas-vindas (`lib/paginas/boas_vindas_pagina.dart`) → Entrar (`login_pagina.dart`) e Criar conta (`cadastro_pagina.dart`) |
| **(b) Barra de opções e ferramenta de busca** | Cliente: barra no topo com sacola e menu (Meus pedidos, Sacola, Sair) + campo **Buscar no cardápio** + filtro por categoria. Loja: barra no topo com menu (Resetar dados, Sair) + barra de navegação embaixo (Produtos, Categorias, Pedidos) + busca de produtos |
| **(c) Solução com CRUD** | Loja: **Produtos** e **Categorias** com criar, listar/buscar, editar e excluir. Cliente: cria pedidos, vê e cancela |

## Contas de teste

| Perfil | E-mail | Senha |
|---|---|---|
| Cliente | hudson@email.com | cliente123 |
| Loja (admin) | admin@burguersabor.com | admin123 |

Na tela **Entrar**, os botões *Cliente* e *Loja (admin)* preenchem as contas sozinhos.

## Como rodar no celular pelo cabo USB

### 1. No notebook (só uma vez)
1. Instale o **Flutter SDK**: <https://docs.flutter.dev/get-started/install/windows/mobile>. Coloque a pasta `flutter\bin` no PATH do Windows.
2. No Android Studio: **File > Settings > Plugins**, instale os plugins **Flutter** e **Dart**.
3. Abra uma janela do Prompt de Comando e rode `flutter doctor`. Se aparecer um aviso de licenças, rode `flutter doctor --android-licenses` e aceite com `y`.

### 2. No celular (só uma vez)
1. **Configurações > Sobre o telefone** e toque **7 vezes** em **Número da versão** (em alguns celulares fica em *Informações do software*).
2. Volte e abra **Opções do desenvolvedor**. Ligue **Depuração USB**.
3. Conecte o cabo. Na tela do celular aparece **"Permitir depuração USB?"**: marque *Sempre permitir* e toque em **Permitir**.

### 3. Rodar
1. Dê dois cliques em **`Preparar projeto.bat`** (só na primeira vez). Ele gera os arquivos do Android, baixa as bibliotecas e mostra se o celular foi reconhecido.
2. Dê dois cliques em **`Rodar no celular.bat`**. O app é compilado no notebook e instalado no celular.
   - A **primeira vez demora** (pode passar de 10 minutos). Depois é rápido.
   - Com a janela aberta: tecle **r** para atualizar o app depois de mudar o código, **q** para sair.
   - Depois de instalado, o app fica no celular com o nome **Burguer & Sabor** e abre mesmo sem o cabo.

**Por que não usar o emulador?** O emulador simula um celular inteiro dentro do notebook e consome muita memória. Com o celular no cabo, o notebook só compila. Rodar pelo `.bat` (sem o Android Studio aberto) economiza ainda mais.

**Pelo Android Studio (se preferir):** *File > Open* e escolha esta pasta. Em cima, escolha o seu celular na lista de aparelhos e clique no ▶ verde.

## Estrutura

```
lib/
├── main.dart                     Começo do app e tema
├── tema.dart                     Cores, formatação de R$ e data, ícones das categorias
├── dados/
│   ├── banco.dart                Cria o banco SQLite, as 5 tabelas e os dados de exemplo
│   ├── modelos.dart              Usuario, Categoria, Produto, Pedido...
│   ├── repositorios.dart         Todo o SQL (sempre com "?": consulta parametrizada)
│   └── seguranca.dart            Senha guardada como hash SHA-256
├── estado/sessao.dart            Quem está logado e a sacola
├── componentes/comum.dart        Avisos, confirmação, cartão de pedido
└── paginas/
    ├── boas_vindas_pagina.dart · login_pagina.dart · cadastro_pagina.dart
    ├── cliente/  cliente_inicio_pagina.dart · sacola_pagina.dart · meus_pedidos_pagina.dart
    └── admin/    admin_inicio_pagina.dart · produtos_aba.dart · produto_form_pagina.dart · categorias_aba.dart · pedidos_aba.dart
```

## Banco de dados (SQLite no celular)

| Tabela | Guarda |
|---|---|
| `usuarios` | Clientes e admin (`tipo_usuario`), senha como hash |
| `categorias` | Combos, Hambúrgueres, Bebidas, Acompanhamentos, Pizzas, Sobremesas |
| `produtos` | Itens do cardápio, com preço, **estoque** e se está no cardápio |
| `pedidos` | Cliente, status, forma de pagamento, taxa e total |
| `itens_pedido` | Produtos de cada pedido, com o preço do dia |

Regras que o app garante:
- **Pedido "tudo ou nada"**: o pedido é gravado numa transação. Se faltar estoque de qualquer item, nada é gravado.
- **Estoque baixa sozinho** quando o pedido é feito e **volta** se o pedido for cancelado.
- O banco não aceita preço zero, estoque negativo nem e-mail repetido (`CHECK` e `UNIQUE`).
- Não dá para excluir uma categoria com produtos, nem um produto que já foi vendido (só tirar do cardápio).
- Na loja, **Opções > Resetar dados de exemplo** volta tudo ao começo (bom antes de apresentar).

## Testes

`Rodar testes.bat` roda os testes de `test/widget_test.dart` (regras da sacola, das etapas do pedido e da senha).
