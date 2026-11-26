# BurguerSabor

Sistema de pedidos e controle de estoque para lanchonetes — **projeto de apresentação** (pagamentos simulados, contas de teste fictícias).

O projeto tem duas partes:

- **Site de delivery** (NestJS + PostgreSQL): o cliente faz o pedido pelo site; o sistema desconta os ingredientes do estoque pela receita (ficha técnica) e avisa o administrador do que está acabando.
- **App de delivery para Android** (Dart + Flutter, pasta [`mobile/`](mobile)): boas-vindas e login, barra de opções com busca e CRUD de produtos e categorias, com o banco SQLite dentro do próprio celular.

## Links rápidos

| O quê | Onde |
|---|---|
| Site (com o Iniciar aberto) | <http://localhost:3000> |
| Back-end: Swagger para testar a API | <http://localhost:3000/api-docs> |
| Código do back-end | [`backend/`](backend) |
| Código do app | [`mobile/`](mobile) |
| Documentação em PDF | [`docs/pdf/`](docs/pdf) |

## Como rodar no Windows (dois cliques)

Pré-requisitos: [Node.js LTS](https://nodejs.org) e [PostgreSQL](https://www.postgresql.org/download/windows/) instalados.

1. Dê dois cliques em **`Iniciar BurguerSabor.bat`**.
2. Na primeira vez, ele pergunta o usuário e a senha do seu PostgreSQL, instala as dependências e cria o banco com dados de exemplo.
3. O site abre sozinho em <http://localhost:3000>. Para desligar, feche a janela preta.

| Atalho | O que faz |
|---|---|
| `Iniciar BurguerSabor.bat` | Prepara o banco, liga a API e abre o site |
| `Resetar dados de exemplo.bat` | Apaga pedidos e cadastros e volta aos dados de exemplo (bom antes de apresentar) |
| `Rodar testes.bat` | Roda a suíte de testes automatizados |

### Contas de teste (senhas fictícias)

| Perfil | E-mail | Senha |
|---|---|---|
| Admin | admin@burguersabor.com | admin123 |
| Cliente | hudson@email.com | cliente123 |

## Ver o banco no PostgreSQL (pgAdmin)

O `Iniciar BurguerSabor.bat` cria o banco **`burguer_sabor`** no PostgreSQL do seu computador. Para abrir:

1. Abra o **pgAdmin** e conecte no servidor local (usuário `postgres`, a mesma senha que você digitou no Iniciar).
2. Vá em **Databases > burguer_sabor > Schemas > public > Tables**: aparecem as 12 tabelas (usuarios, produtos, insumos_estoque, pedidos, avaliacoes...).
3. Clique com o botão direito numa tabela > **View/Edit Data > All Rows** para ver os dados.
4. Ou abra o **Query Tool** (botão direito em `burguer_sabor`) e rode, por exemplo:

```sql
-- Pedidos com status e pagamento
SELECT p.id, u.nome AS cliente, p.status, p.valor_total, pg.forma_pagamento, pg.status_pagamento
FROM pedidos p JOIN usuarios u ON u.id = p.cliente_id JOIN pagamentos pg ON pg.pedido_id = p.id
ORDER BY p.id DESC;

-- O que saiu do estoque em cada pedido
SELECT m.pedido_id, i.nome_item, m.tipo, m.quantidade, m.criado_em
FROM movimentacoes_estoque m JOIN insumos_estoque i ON i.id = m.insumo_id
WHERE m.pedido_id IS NOT NULL ORDER BY m.id DESC;

-- Ingredientes acabando
SELECT nome_item, quantidade_disponivel, estoque_minimo FROM insumos_estoque
WHERE quantidade_disponivel <= estoque_minimo;
```

Tudo que acontece no site (cadastro, pedido, baixa de estoque, avaliação) aparece nessas tabelas na hora. O banco `burguer_sabor_test` é só dos testes automatizados e é apagado a cada execução.

## App Android (Flutter)

O app fica na pasta [`mobile/`](mobile) e roda no celular pelo cabo USB, sem emulador. Resumo:

1. Instale o Flutter (canal `stable`) e ligue a **Depuração USB** no celular.
2. Na pasta `mobile`, dê dois cliques em **`Preparar projeto.bat`** (só na primeira vez).
3. Dê dois cliques em **`Rodar no celular.bat`**.

As contas de teste são as mesmas do site. O passo a passo completo está no [README do app](mobile/README.md) e no PDF [O app parte por parte](docs/pdf/BurguerSabor%20-%20O%20app%20parte%20por%20parte.pdf).

## Documentação em PDF

Material didático para estudar e apresentar, na pasta [`docs/pdf/`](docs/pdf):

| PDF | Assunto |
|---|---|
| O site parte por parte | Cada tela do site, o que muda no banco e exemplos de cadastro pelo Swagger |
| O app parte por parte | Cada tela do app, organização do código e as 5 tabelas do SQLite |
| As 12 tabelas e suas relações | O banco do site tabela por tabela, com as ligações entre elas |
| Banco de Dados (aula) e Aula Banco de Dados | Aula sobre o banco de dados do site |
| Os 4 tópicos do checklist | Os 4 tópicos da entrega, em versão completa, com detalhes e resumo |

## Estrutura

| Pasta | Conteúdo |
|---|---|
| [`docs/`](docs) | Requisitos e regras, modelagem do banco (DER, dicionário de dados, UML), casos de teste e o [checklist de entrega](docs/04-checklist-entrega.md) |
| [`database/`](database) | `schema.sql` (tabelas, restrições e índices), `seed.sql` (dados de teste) e `migracoes.sql` (atualiza um banco existente sem apagar os dados; o Iniciar roda sozinho) |
| [`backend/`](backend) | API REST em NestJS, site (`backend/public`), Swagger e testes — veja o [README do backend](backend/README.md) |
| [`mobile/`](mobile) | App Android em Dart/Flutter com banco SQLite — veja o [README do app](mobile/README.md) |
| [`docs/pdf/`](docs/pdf) | PDFs didáticos do site, do app e do banco de dados |

## Segurança

O arquivo `backend/.env` guarda a senha do seu PostgreSQL e o segredo de login. Ele é criado no seu computador na primeira execução e **nunca vai para o GitHub** (está no `.gitignore`). O repositório só tem o modelo `backend/.env.example`, sem senhas reais.
