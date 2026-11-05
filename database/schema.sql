-- =============================================================================
-- BURGUER SABOR / SISTEMA DE LANCHONETE E PDV
-- PostgreSQL 16 · modelo normalizado até a 3FN · projeto de apresentação
-- =============================================================================

-- pgcrypto fornece crypt()/gen_salt('bf') para gerar hashes Bcrypt no seed (RNF01)
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- 1. LIMPEZA DO ESQUEMA (Remoção ordenada em cascata para evitar conflito de FK)
DROP TABLE IF EXISTS avaliacoes CASCADE;
DROP TABLE IF EXISTS alertas_estoque CASCADE;
DROP TABLE IF EXISTS movimentacoes_estoque CASCADE;
DROP TABLE IF EXISTS pagamentos CASCADE;
DROP TABLE IF EXISTS itens_pedido CASCADE;
DROP TABLE IF EXISTS pedidos CASCADE;
DROP TABLE IF EXISTS ficha_tecnica CASCADE;
DROP TABLE IF EXISTS insumos_estoque CASCADE;
DROP TABLE IF EXISTS produtos CASCADE;
DROP TABLE IF EXISTS categorias CASCADE;
DROP TABLE IF EXISTS enderecos CASCADE;
DROP TABLE IF EXISTS usuarios CASCADE;

-- 2. TABELA DE USUÁRIOS E AUTENTICAÇÃO (RBAC)
CREATE TABLE usuarios (
    id SERIAL PRIMARY KEY,
    nome VARCHAR(100) NOT NULL,
    email VARCHAR(150) UNIQUE NOT NULL,
    senha_hash VARCHAR(255) NOT NULL,
    telefone VARCHAR(20) NOT NULL,
    tipo_usuario VARCHAR(20) NOT NULL CHECK (tipo_usuario IN ('CLIENTE', 'ADMIN')),
    criado_em TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 3. TABELA DE ENDEREÇOS DE ENTREGA (1:N com usuarios)
CREATE TABLE enderecos (
    id SERIAL PRIMARY KEY,
    usuario_id INT NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
    rua VARCHAR(150) NOT NULL,
    numero VARCHAR(20) NOT NULL,
    bairro VARCHAR(100) NOT NULL,
    cep VARCHAR(9) NOT NULL,
    ponto_referencia VARCHAR(150)
);

-- 4. TABELA DE CATEGORIAS DO CARDÁPIO
CREATE TABLE categorias (
    id SERIAL PRIMARY KEY,
    nome VARCHAR(50) UNIQUE NOT NULL,
    ordem_exibicao INT NOT NULL DEFAULT 0,
    ativo BOOLEAN NOT NULL DEFAULT TRUE
);

-- 5. TABELA DE PRODUTOS / ITENS DO CARDÁPIO
CREATE TABLE produtos (
    id SERIAL PRIMARY KEY,
    categoria_id INT NOT NULL REFERENCES categorias(id) ON DELETE RESTRICT,
    nome VARCHAR(100) NOT NULL,
    descricao TEXT,
    preco DECIMAL(10,2) NOT NULL CHECK (preco > 0),
    imagem_url VARCHAR(255),
    disponivel BOOLEAN NOT NULL DEFAULT TRUE
);

-- 6. TABELA DE INSUMOS E MATÉRIA-PRIMA DO ESTOQUE
--    preco_custo e estoque_minimo: custo/lucro e alerta de reposição
CREATE TABLE insumos_estoque (
    id SERIAL PRIMARY KEY,
    nome_item VARCHAR(100) UNIQUE NOT NULL,
    unidade_medida VARCHAR(10) NOT NULL CHECK (unidade_medida IN ('UN', 'KG', 'L', 'G', 'ML')),
    quantidade_disponivel DECIMAL(10,2) NOT NULL CHECK (quantidade_disponivel >= 0),
    preco_custo DECIMAL(10,2) NOT NULL DEFAULT 0.01 CHECK (preco_custo > 0),
    estoque_minimo DECIMAL(10,2) NOT NULL DEFAULT 0 CHECK (estoque_minimo >= 0)
);

-- 7. TABELA ASSOCIATIVA FICHA TÉCNICA (N:N entre produtos e insumos_estoque)
CREATE TABLE ficha_tecnica (
    id SERIAL PRIMARY KEY,
    produto_id INT NOT NULL REFERENCES produtos(id) ON DELETE CASCADE,
    insumo_id INT NOT NULL REFERENCES insumos_estoque(id) ON DELETE RESTRICT,
    quantidade_necessaria DECIMAL(10,2) NOT NULL CHECK (quantidade_necessaria > 0),
    UNIQUE (produto_id, insumo_id)
);

-- 8. TABELA DE PEDIDOS E KDS DA COZINHA
CREATE TABLE pedidos (
    id SERIAL PRIMARY KEY,
    cliente_id INT NOT NULL REFERENCES usuarios(id) ON DELETE RESTRICT,
    endereco_id INT NOT NULL REFERENCES enderecos(id) ON DELETE RESTRICT,
    status VARCHAR(30) NOT NULL DEFAULT 'RECEBIDO' CHECK (status IN ('RECEBIDO', 'PREPARANDO', 'SAIU_ENTREGA', 'CONCLUIDO', 'CANCELADO')),
    valor_total DECIMAL(10,2) NOT NULL CHECK (valor_total >= 0),
    taxa_entrega DECIMAL(10,2) NOT NULL DEFAULT 0.00 CHECK (taxa_entrega >= 0),
    criado_em TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 9. TABELA DE ITENS DO PEDIDO (1:N com pedidos)
CREATE TABLE itens_pedido (
    id SERIAL PRIMARY KEY,
    pedido_id INT NOT NULL REFERENCES pedidos(id) ON DELETE CASCADE,
    produto_id INT NOT NULL REFERENCES produtos(id) ON DELETE RESTRICT,
    quantidade INT NOT NULL CHECK (quantidade > 0),
    preco_unitario DECIMAL(10,2) NOT NULL CHECK (preco_unitario > 0),
    observacao VARCHAR(200)
);

-- 10. TABELA DE TRANSAÇÕES FINANCEIRAS (1:1 com pedidos — UNIQUE garante o 1:1)
CREATE TABLE pagamentos (
    id SERIAL PRIMARY KEY,
    pedido_id INT NOT NULL UNIQUE REFERENCES pedidos(id) ON DELETE CASCADE,
    forma_pagamento VARCHAR(30) NOT NULL CHECK (forma_pagamento IN ('PIX', 'CARTAO_CREDITO', 'CARTAO_DEBITO', 'DINHEIRO')),
    status_pagamento VARCHAR(30) NOT NULL DEFAULT 'PENDENTE' CHECK (status_pagamento IN ('PENDENTE', 'APROVADO', 'RECUSADO')),
    valor_pago DECIMAL(10,2) NOT NULL CHECK (valor_pago > 0),
    criado_em TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 11. EXTRATO DO ESTOQUE: cada entrada e saída fica registrada
CREATE TABLE movimentacoes_estoque (
    id SERIAL PRIMARY KEY,
    insumo_id INT NOT NULL REFERENCES insumos_estoque(id) ON DELETE RESTRICT,
    tipo VARCHAR(10) NOT NULL CHECK (tipo IN ('ENTRADA', 'SAIDA')),
    motivo VARCHAR(20) NOT NULL CHECK (motivo IN ('PEDIDO', 'CANCELAMENTO', 'REPOSICAO', 'CADASTRO')),
    quantidade DECIMAL(10,2) NOT NULL CHECK (quantidade > 0),
    pedido_id INT REFERENCES pedidos(id) ON DELETE SET NULL,
    criado_em TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 12. ALERTAS DE REPOSIÇÃO PARA O ADMIN
CREATE TABLE alertas_estoque (
    id SERIAL PRIMARY KEY,
    insumo_id INT NOT NULL REFERENCES insumos_estoque(id) ON DELETE CASCADE,
    saldo DECIMAL(10,2) NOT NULL,
    resolvido BOOLEAN NOT NULL DEFAULT FALSE,
    criado_em TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 13. AVALIAÇÃO DO PEDIDO PELO CLIENTE (1:1 com pedidos, só depois de entregue)
CREATE TABLE avaliacoes (
    id SERIAL PRIMARY KEY,
    pedido_id INT NOT NULL UNIQUE REFERENCES pedidos(id) ON DELETE CASCADE,
    nota INT NOT NULL CHECK (nota BETWEEN 1 AND 5),
    comentario VARCHAR(300),
    criado_em TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 14. ÍNDICES DE DESEMPENHO E OTIMIZAÇÃO DE CONSULTAS
CREATE INDEX idx_produtos_categoria ON produtos (categoria_id);
CREATE INDEX idx_pedidos_cliente ON pedidos (cliente_id);
CREATE INDEX idx_pedidos_status ON pedidos (status);
CREATE INDEX idx_ficha_tecnica_produto ON ficha_tecnica (produto_id);
CREATE INDEX idx_itens_pedido_pedido ON itens_pedido (pedido_id);
CREATE INDEX idx_enderecos_usuario ON enderecos (usuario_id);
CREATE INDEX idx_movimentacoes_insumo ON movimentacoes_estoque (insumo_id, criado_em DESC);
CREATE INDEX idx_movimentacoes_pedido ON movimentacoes_estoque (pedido_id);
-- No máximo um alerta em aberto por insumo
CREATE UNIQUE INDEX ux_alerta_aberto_insumo ON alertas_estoque (insumo_id) WHERE resolvido = FALSE;
