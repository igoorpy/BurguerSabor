import { Injectable } from '@nestjs/common';
import { DatabaseService, Queryable } from '../../database/database.service';
import { buildUpdate, toNumber } from '../../database/sql.util';
import { ItemFichaTecnica, Produto, UnidadeMedida } from '../../domain/entities';

type ProdutoRow = {
  id: number;
  categoria_id: number;
  categoria_nome: string;
  categoria_ativa: boolean;
  nome: string;
  descricao: string | null;
  preco: string;
  imagem_url: string | null;
  disponivel: boolean;
  tem_estoque: boolean;
}

type FichaRow = {
  produto_id: number;
  insumo_id: number;
  nome_item: string;
  unidade_medida: UnidadeMedida;
  quantidade_necessaria: string;
  preco_custo: string;
}

const toProduto = (r: ProdutoRow): Produto => ({
  id: r.id,
  categoriaId: r.categoria_id,
  categoriaNome: r.categoria_nome,
  categoriaAtiva: r.categoria_ativa,
  nome: r.nome,
  descricao: r.descricao,
  preco: toNumber(r.preco),
  imagemUrl: r.imagem_url,
  disponivel: r.disponivel,
  temEstoque: r.tem_estoque,
});

const toFicha = (r: FichaRow): ItemFichaTecnica => ({
  produtoId: r.produto_id,
  insumoId: r.insumo_id,
  nomeItem: r.nome_item,
  unidadeMedida: r.unidade_medida,
  quantidadeNecessaria: toNumber(r.quantidade_necessaria),
  precoCusto: toNumber(r.preco_custo),
});

/**
 * tem_estoque (RN04): verdadeiro quando NENHUM insumo da ficha técnica está abaixo
 * da quantidade necessária para 1 porção.
 */
const SELECT_PRODUTO = `
  SELECT p.id, p.categoria_id, c.nome AS categoria_nome, c.ativo AS categoria_ativa, p.nome, p.descricao, p.preco,
         p.imagem_url, p.disponivel,
         NOT EXISTS (
           SELECT 1 FROM ficha_tecnica f
           JOIN insumos_estoque i ON i.id = f.insumo_id
           WHERE f.produto_id = p.id AND i.quantidade_disponivel < f.quantidade_necessaria
         ) AS tem_estoque
  FROM produtos p
  JOIN categorias c ON c.id = p.categoria_id`;

const COLUNAS = {
  categoriaId: 'categoria_id',
  nome: 'nome',
  descricao: 'descricao',
  preco: 'preco',
  imagemUrl: 'imagem_url',
  disponivel: 'disponivel',
};

export interface FiltroProdutos {
  categoriaId?: number;
  busca?: string;
  somenteDisponiveis?: boolean;
}

@Injectable()
export class ProdutosRepository {
  constructor(private readonly db: DatabaseService) {}

  /** RF10 / CT-MOB-004 — busca por termo no nome ou na descrição (ILIKE parametrizado). */
  async findAll(filtro: FiltroProdutos): Promise<Produto[]> {
    const { rows } = await this.db.query<ProdutoRow>(
      `SELECT * FROM (${SELECT_PRODUTO}
         WHERE ($1::int IS NULL OR p.categoria_id = $1)
           AND ($2::text IS NULL OR p.nome ILIKE '%' || $2 || '%' OR p.descricao ILIKE '%' || $2 || '%')
       ) produtos
       WHERE ($3::boolean = FALSE OR (disponivel = TRUE AND tem_estoque = TRUE AND categoria_ativa = TRUE))
       ORDER BY categoria_id, nome`,
      [filtro.categoriaId ?? null, filtro.busca?.trim() || null, filtro.somenteDisponiveis ?? false],
    );
    return rows.map(toProduto);
  }

  async findById(id: number, q: Queryable = this.db): Promise<Produto | null> {
    const { rows } = await q.query<ProdutoRow>(`${SELECT_PRODUTO} WHERE p.id = $1`, [id]);
    return rows[0] ? toProduto(rows[0]) : null;
  }

  async findManyByIds(ids: number[], q: Queryable = this.db): Promise<Produto[]> {
    const { rows } = await q.query<ProdutoRow>(`${SELECT_PRODUTO} WHERE p.id = ANY($1::int[])`, [ids]);
    return rows.map(toProduto);
  }

  async create(data: {
    categoriaId: number;
    nome: string;
    descricao: string | null;
    preco: number;
    imagemUrl: string | null;
    disponivel: boolean;
  }): Promise<number> {
    const { rows } = await this.db.query<{ id: number }>(
      `INSERT INTO produtos (categoria_id, nome, descricao, preco, imagem_url, disponivel)
       VALUES ($1, $2, $3, $4, $5, $6) RETURNING id`,
      [data.categoriaId, data.nome, data.descricao, data.preco, data.imagemUrl, data.disponivel],
    );
    return rows[0].id;
  }

  async update(id: number, changes: Record<string, unknown>): Promise<boolean> {
    const sql = buildUpdate('produtos', COLUNAS, changes, id);
    if (!sql) return false;
    await this.db.query(sql.text, sql.params);
    return true;
  }

  async delete(id: number): Promise<void> {
    await this.db.query('DELETE FROM produtos WHERE id = $1', [id]);
  }

  async jaVendido(id: number): Promise<boolean> {
    const { rows } = await this.db.query('SELECT 1 FROM itens_pedido WHERE produto_id = $1 LIMIT 1', [id]);
    return rows.length > 0;
  }

  async findFicha(produtoIds: number[], q: Queryable = this.db): Promise<ItemFichaTecnica[]> {
    const { rows } = await q.query<FichaRow>(
      `SELECT f.produto_id, f.insumo_id, i.nome_item, i.unidade_medida, f.quantidade_necessaria, i.preco_custo
       FROM ficha_tecnica f
       JOIN insumos_estoque i ON i.id = f.insumo_id
       WHERE f.produto_id = ANY($1::int[])
       ORDER BY f.produto_id, i.nome_item`,
      [produtoIds],
    );
    return rows.map(toFicha);
  }

  /** Substitui a ficha técnica inteira dentro de uma transação. */
  async replaceFicha(produtoId: number, itens: { insumoId: number; quantidadeNecessaria: number }[], q: Queryable): Promise<void> {
    await q.query('DELETE FROM ficha_tecnica WHERE produto_id = $1', [produtoId]);
    if (itens.length === 0) return;
    await q.query(
      `INSERT INTO ficha_tecnica (produto_id, insumo_id, quantidade_necessaria)
       SELECT $1, insumo_id, quantidade FROM unnest($2::int[], $3::numeric[]) AS t(insumo_id, quantidade)`,
      [produtoId, itens.map((i) => i.insumoId), itens.map((i) => i.quantidadeNecessaria)],
    );
  }
}
