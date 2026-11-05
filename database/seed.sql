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
('Pizzas', 4);

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
('Calabresa', 'G', 2000.00, 0.03, 400.00);               -- 9

-- O saldo inicial também entra no extrato do estoque, para o histórico bater com o saldo
INSERT INTO movimentacoes_estoque (insumo_id, tipo, motivo, quantidade)
SELECT id, 'ENTRADA', 'CADASTRO', quantidade_disponivel FROM insumos_estoque WHERE quantidade_disponivel > 0;

-- imagem_url aponta para as ilustrações em backend/public/img (o admin pode trocar por qualquer URL)
INSERT INTO produtos (categoria_id, nome, descricao, preco, imagem_url) VALUES
(1, 'Burguer X-Cheddar', 'Pão brioche, blend 180g e cheddar duplo', 28.50, '/img/x-cheddar.svg'),  -- 1
(2, 'Refrigerante Cola 350ml', 'Lata trincando de gelada', 6.00, '/img/refrigerante.svg'),         -- 2
(1, 'Burguer X-Bacon', 'Pão brioche, blend 180g, cheddar e bacon', 32.00, '/img/x-bacon.svg'),     -- 3
(3, 'Batata Frita Média', 'Porção de 200g de batata palito', 14.00, '/img/batata.svg'),            -- 4
(4, 'Pizza Calabresa', 'Massa, mussarela e calabresa', 45.00, '/img/pizza.svg');                   -- 5

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
(5, 9, 200.00);
