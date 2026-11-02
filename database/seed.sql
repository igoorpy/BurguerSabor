-- Carga Inicial de Teste (Seed Data)
INSERT INTO usuarios (nome, email, senha_hash, telefone, tipo_usuario) VALUES
('Gerente Admin', 'admin@burguersabor.com', 'admin123', '92991111111', 'ADMIN'),
('Hudson Cliente', 'hudson@email.com', 'cliente123', '92992222222', 'CLIENTE');

INSERT INTO enderecos (usuario_id, rua, numero, bairro, cep, ponto_referencia) VALUES
(2, 'Av. Principal', '100', 'Centro', '69000-000', 'Próximo à Praça');

INSERT INTO categorias (nome, ordem_exibicao) VALUES
('Hambúrgueres', 1),
('Bebidas', 2),
('Acompanhamentos', 3);

INSERT INTO insumos_estoque (nome_item, unidade_medida, quantidade_disponivel) VALUES
('Pão Brioche', 'UN', 50.00),
('Hambúrguer Blend 180g', 'UN', 40.00),
('Queijo Cheddar Fatiado', 'G', 1000.00),
('Refrigerante Lata 350ml', 'UN', 30.00);

INSERT INTO produtos (categoria_id, nome, descricao, preco) VALUES
(1, 'Burguer X-Cheddar', 'Pão brioche, blend 180g e cheddar duplo', 28.50),
(2, 'Refrigerante Cola 350ml', 'Lata trincando de gelada', 6.00);

INSERT INTO ficha_tecnica (produto_id, insumo_id, quantidade_necessaria) VALUES
(1, 1, 1.00), -- 1 Pão Brioche
(1, 2, 1.00), -- 1 Blend 180g
(1, 3, 40.00); -- 40g de Cheddar