-- Carga Inicial de Teste (Seed Data) — projeto de apresentação, senhas fictícias
-- As senhas são gravadas com hash Bcrypt (RNF01): crypt(senha, gen_salt('bf', 10))
--   admin@burguersabor.com / admin123   ·   hudson@email.com / cliente123
INSERT INTO usuarios (nome, email, senha_hash, telefone, tipo_usuario) VALUES
('Gerente Admin', 'admin@burguersabor.com', crypt('admin123', gen_salt('bf', 10)), '92991111111', 'ADMIN'),
('Hudson Cliente', 'hudson@email.com', crypt('cliente123', gen_salt('bf', 10)), '92992222222', 'CLIENTE');

INSERT INTO enderecos (usuario_id, rua, numero, bairro, cep, ponto_referencia) VALUES
(2, 'Av. Principal', '100', 'Centro', '69000-000', 'Próximo à Praça');

INSERT INTO categorias (nome, ordem_exibicao) VALUES
('Hambúrgueres', 1),
('Bebidas', 2),
('Acompanhamentos', 3),
('Pizzas', 4),
('Combos', 0),        -- 5: aparece primeiro no cardápio
('Sobremesas', 5);    -- 6

-- id | insumo
INSERT INTO insumos_estoque (nome_item, unidade_medida, quantidade_disponivel, preco_custo, estoque_minimo) VALUES
('Pão Brioche', 'UN', 50.00, 1.50, 10.00),               -- 1
('Hambúrguer Blend 180g', 'UN', 40.00, 6.00, 10.00),     -- 2
('Queijo Cheddar Fatiado', 'G', 1000.00, 0.05, 200.00),  -- 3  (R$ 0,05 por grama)
('Refrigerante Lata 350ml', 'UN', 30.00, 3.00, 6.00),    -- 4
('Bacon Fatiado', 'G', 800.00, 0.06, 150.00),            -- 5
('Batata Palito Congelada', 'G', 5000.00, 0.02, 1000.00),-- 6
('Massa de Pizza', 'UN', 20.00, 5.00, 5.00),             -- 7
('Mussarela', 'G', 3000.00, 0.04, 500.00),               -- 8
('Calabresa', 'G', 2000.00, 0.03, 400.00),               -- 9
('Frango Empanado', 'UN', 30.00, 4.00, 8.00),            -- 10
('Alface Americana', 'G', 1500.00, 0.02, 300.00),        -- 11
('Tomate', 'G', 2000.00, 0.01, 400.00),                  -- 12
('Molho Especial', 'ML', 2000.00, 0.03, 400.00),         -- 13
('Cebola Caramelizada', 'G', 1500.00, 0.03, 300.00),     -- 14
('Guaraná Lata 350ml', 'UN', 30.00, 3.00, 6.00),         -- 15
('Suco de Laranja 300ml', 'UN', 20.00, 4.00, 5.00),      -- 16
('Água Mineral 500ml', 'UN', 30.00, 1.20, 6.00),         -- 17
('Anéis de Cebola Congelados', 'G', 3000.00, 0.03, 600.00), -- 18
('Sorvete de Creme', 'G', 3000.00, 0.02, 500.00),        -- 19
('Calda de Chocolate', 'ML', 1000.00, 0.04, 200.00),     -- 20
('Brownie', 'UN', 15.00, 3.50, 4.00);                    -- 21

-- O saldo inicial também entra no extrato do estoque, para o histórico bater com o saldo
INSERT INTO movimentacoes_estoque (insumo_id, tipo, motivo, quantidade)
SELECT id, 'ENTRADA', 'CADASTRO', quantidade_disponivel FROM insumos_estoque WHERE quantidade_disponivel > 0;

-- imagem_url aponta para as ilustrações em backend/public/img (o admin pode trocar por qualquer URL)
INSERT INTO produtos (categoria_id, nome, descricao, preco, imagem_url) VALUES
(1, 'Burguer X-Cheddar', 'Pão brioche, blend 180g e cheddar duplo', 28.50, '/img/x-cheddar.svg'),  -- 1
(2, 'Refrigerante Cola 350ml', 'Lata trincando de gelada', 6.00, '/img/refrigerante.svg'),         -- 2
(1, 'Burguer X-Bacon', 'Pão brioche, blend 180g, cheddar e bacon', 32.00, '/img/x-bacon.svg'),     -- 3
(3, 'Batata Frita Média', 'Porção de 200g de batata palito', 14.00, '/img/batata.svg'),            -- 4
(4, 'Pizza Calabresa', 'Massa, mussarela e calabresa', 45.00, '/img/pizza.svg'),                   -- 5
(1, 'Burguer Salada', 'Pão brioche, blend 180g, cheddar, alface, tomate e molho especial', 26.90, '/img/burguer-salada.svg'), -- 6
(1, 'Burguer Duplo Bacon', 'Dois blends 180g, cheddar em dobro e muito bacon', 42.90, '/img/duplo-bacon.svg'),            -- 7
(1, 'Chicken Crispy', 'Frango empanado crocante, alface e molho especial', 27.90, '/img/chicken-crispy.svg'),              -- 8
(1, 'Burguer Caramel Onion', 'Blend 180g, cheddar e cebola caramelizada', 33.90, '/img/caramel-onion.svg'),               -- 9
(2, 'Guaraná 350ml', 'Lata trincando de gelada', 6.00, '/img/guarana.svg'),                                               -- 10
(2, 'Suco de Laranja 300ml', 'Natural, feito na hora', 8.50, '/img/suco-laranja.svg'),                                     -- 11
(2, 'Água Mineral 500ml', 'Sem gás', 4.00, '/img/agua.svg'),                                                              -- 12
(3, 'Batata Frita Grande', 'Porção de 350g de batata palito', 19.90, '/img/batata-grande.svg'),                            -- 13
(3, 'Anéis de Cebola', 'Porção de 200g, empanados e crocantes', 17.90, '/img/aneis-cebola.svg'),                           -- 14
(4, 'Pizza Margherita', 'Massa, mussarela e tomate', 42.00, '/img/pizza-margherita.svg'),                                  -- 15
(6, 'Brownie com Sorvete', 'Brownie de chocolate com sorvete de creme e calda', 16.90, '/img/brownie-sorvete.svg'),        -- 16
(6, 'Sorvete com Calda', 'Duas bolas de creme com calda de chocolate', 11.90, '/img/sorvete-calda.svg'),                   -- 17
(5, 'Combo X-Bacon', 'X-Bacon + batata média + refrigerante cola', 46.90, '/img/combo-x-bacon.svg'),                       -- 18
(5, 'Combo X-Cheddar', 'X-Cheddar + batata média + refrigerante cola', 42.90, '/img/combo-x-cheddar.svg'),                 -- 19
(5, 'Combo Chicken Crispy', 'Chicken Crispy + batata média + guaraná', 41.90, '/img/combo-chicken.svg'),                   -- 20
(5, 'Combo Casal', 'Dois X-Bacon + batata grande + dois refrigerantes cola', 84.90, '/img/combo-casal.svg');               -- 21

INSERT INTO ficha_tecnica (produto_id, insumo_id, quantidade_necessaria) VALUES
(1, 1, 1.00),   -- 1 Pão Brioche
(1, 2, 1.00),   -- 1 Blend 180g
(1, 3, 40.00),  -- 40g de Cheddar
(2, 4, 1.00),   -- 1 Lata
(3, 1, 1.00),
(3, 2, 1.00),
(3, 3, 20.00),
(3, 5, 30.00),  -- 30g de Bacon
(4, 6, 200.00), -- 200g de Batata
(5, 7, 1.00),
(5, 8, 250.00),
(5, 9, 200.00),
-- Burguer Salada
(6, 1, 1.00), (6, 2, 1.00), (6, 3, 20.00), (6, 11, 20.00), (6, 12, 30.00), (6, 13, 15.00),
-- Burguer Duplo Bacon
(7, 1, 1.00), (7, 2, 2.00), (7, 3, 40.00), (7, 5, 60.00), (7, 13, 20.00),
-- Chicken Crispy
(8, 1, 1.00), (8, 10, 1.00), (8, 11, 20.00), (8, 13, 20.00),
-- Burguer Caramel Onion
(9, 1, 1.00), (9, 2, 1.00), (9, 3, 20.00), (9, 14, 40.00),
-- Bebidas
(10, 15, 1.00), (11, 16, 1.00), (12, 17, 1.00),
-- Acompanhamentos
(13, 6, 350.00), (14, 18, 200.00),
-- Pizza Margherita
(15, 7, 1.00), (15, 8, 250.00), (15, 12, 120.00),
-- Sobremesas
(16, 21, 1.00), (16, 19, 100.00), (16, 20, 20.00),
(17, 19, 150.00), (17, 20, 30.00),
-- Combos: a receita do combo soma a receita de cada item (o estoque baixa tudo de uma vez)
(18, 1, 1.00), (18, 2, 1.00), (18, 3, 20.00), (18, 5, 30.00), (18, 6, 200.00), (18, 4, 1.00),
(19, 1, 1.00), (19, 2, 1.00), (19, 3, 40.00), (19, 6, 200.00), (19, 4, 1.00),
(20, 1, 1.00), (20, 10, 1.00), (20, 11, 20.00), (20, 13, 20.00), (20, 6, 200.00), (20, 15, 1.00),
(21, 1, 2.00), (21, 2, 2.00), (21, 3, 40.00), (21, 5, 60.00), (21, 6, 350.00), (21, 4, 2.00);
