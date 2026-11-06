import { Injectable } from '@nestjs/common';
import { DatabaseService, Queryable } from '../../database/database.service';
import { buildUpdate, toNumber } from '../../database/sql.util';
import {
  AlertaEstoque,
  InsumoEstoque,
  MotivoMovimentacao,
  MovimentacaoEstoque,
  TipoMovimentacao,
  UnidadeMedida,
} from '../../domain/entities';

type InsumoRow = {
  id: number;
  nome_item: string;
  unidade_medida: UnidadeMedida;
  quantidade_disponivel: string;
  preco_custo: string;
  estoque_minimo: string;
}

type MovimentacaoRow = {
  id: number;
  insumo_id: number;
  nome_item: string;
  tipo: TipoMovimentacao;
  motivo: MotivoMovimentacao;
  quantidade: string;
  pedido_id: number | null;
  criado_em: Date;
}

type AlertaRow = {
  id: number;
  insumo_id: number;
  nome_item: string;
  unidade_medida: UnidadeMedida;
  saldo: string;
  estoque_minimo: string;
  resolvido: boolean;
  criado_em: Date;
}

const toInsumo = (r: InsumoRow): InsumoEstoque => ({
  id: r.id,
  nomeItem: r.nome_item,
  unidadeMedida: r.unidade_medida,
  quantidadeDisponivel: toNumber(r.quantidade_disponivel),
  precoCusto: toNumber(r.preco_custo),
  estoqueMinimo: toNumber(r.estoque_minimo),
});

const toMovimentacao = (r: MovimentacaoRow): MovimentacaoEstoque => ({
  id: r.id,
  insumoId: r.insumo_id,
  nomeItem: r.nome_item,
  tipo: r.tipo,
  motivo: r.motivo,
  quantidade: toNumber(r.quantidade),
  pedidoId: r.pedido_id,
  criadoEm: r.criado_em,
});

const toAlerta = (r: AlertaRow): AlertaEstoque => ({
  id: r.id,
  insumoId: r.insumo_id,
  nomeItem: r.nome_item,
  unidadeMedida: r.unidade_medida,
  saldo: toNumber(r.saldo),
  estoqueMinimo: toNumber(r.estoque_minimo),
  resolvido: r.resolvido,
  criadoEm: r.criado_em,
});

/** quantidade_disponivel NÃO é editável por aqui: o saldo só muda por movimentação (pedido, cancelamento, reposição). */
const COLUNAS = {
  nomeItem: 'nome_item',
  unidadeMedida: 'unidade_medida',
  precoCusto: 'preco_custo',
  estoqueMinimo: 'estoque_minimo',
};

export interface FiltroMovimentacoes {
  insumoId?: number;
  pedidoId?: number;
  tipo?: TipoMovimentacao;
}

@Injectable()
export class InsumosRepository {
  constructor(private readonly db: DatabaseService) {}

  // ---------- Insumos ----------

  async findAll(somenteAbaixoDoMinimo: boolean): Promise<InsumoEstoque[]> {
    const { rows } = await this.db.query<InsumoRow>(
      `SELECT * FROM insumos_estoque
       WHERE ($1::boolean = FALSE OR quantidade_disponivel <= estoque_minimo)
       ORDER BY nome_item`,
      [somenteAbaixoDoMinimo],
    );
    return rows.map(toInsumo);
  }

  async findById(id: number, q: Queryable = this.db): Promise<InsumoEstoque | null> {
    const { rows } = await q.query<InsumoRow>('SELECT * FROM insumos_estoque WHERE id = $1', [id]);
    return rows[0] ? toInsumo(rows[0]) : null;
  }

  async findByNome(nome: string): Promise<InsumoEstoque | null> {
    const { rows } = await this.db.query<InsumoRow>('SELECT * FROM insumos_estoque WHERE LOWER(nome_item) = LOWER($1)', [nome]);
    return rows[0] ? toInsumo(rows[0]) : null;
  }

  async findManyByIds(ids: number[]): Promise<InsumoEstoque[]> {
    const { rows } = await this.db.query<InsumoRow>('SELECT * FROM insumos_estoque WHERE id = ANY($1::int[])', [ids]);
    return rows.map(toInsumo);
  }

  /**
   * Trava as linhas dos insumos até o fim da transação (SELECT ... FOR UPDATE).
   * Dois pedidos simultâneos não conseguem gastar o mesmo saldo. ORDER BY id evita deadlock.
   */
  async lockByIds(ids: number[], q: Queryable): Promise<InsumoEstoque[]> {
    const { rows } = await q.query<InsumoRow>(
      'SELECT * FROM insumos_estoque WHERE id = ANY($1::int[]) ORDER BY id FOR UPDATE',
      [ids],
    );
    return rows.map(toInsumo);
  }

  async create(
    data: { nomeItem: string; unidadeMedida: UnidadeMedida; quantidadeDisponivel: number; precoCusto: number; estoqueMinimo: number },
    q: Queryable,
  ): Promise<number> {
    const { rows } = await q.query<{ id: number }>(
      `INSERT INTO insumos_estoque (nome_item, unidade_medida, quantidade_disponivel, preco_custo, estoque_minimo)
       VALUES ($1, $2, $3, $4, $5) RETURNING id`,
      [data.nomeItem, data.unidadeMedida, data.quantidadeDisponivel, data.precoCusto, data.estoqueMinimo],
    );
    return rows[0].id;
  }

  async update(id: number, changes: Record<string, unknown>, q: Queryable = this.db): Promise<boolean> {
    const sql = buildUpdate('insumos_estoque', COLUNAS, changes, id);
    if (!sql) return false;
    await q.query(sql.text, sql.params);
    return true;
  }

  async delete(id: number): Promise<void> {
    await this.db.query('DELETE FROM insumos_estoque WHERE id = $1', [id]);
  }

  async emUso(id: number): Promise<{ fichas: number; movimentacoes: number }> {
    const { rows } = await this.db.query<{ fichas: string; movimentacoes: string }>(
      `SELECT (SELECT COUNT(*) FROM ficha_tecnica WHERE insumo_id = $1) AS fichas,
              (SELECT COUNT(*) FROM movimentacoes_estoque WHERE insumo_id = $1) AS movimentacoes`,
      [id],
    );
    return { fichas: Number(rows[0].fichas), movimentacoes: Number(rows[0].movimentacoes) };
  }

  // ---------- Saldo e extrato ----------

  /** Soma (ou subtrai, com delta negativo) vários saldos em um único UPDATE. O CHECK >= 0 do banco é a última barreira (RN01). */
  async ajustarSaldos(deltas: { insumoId: number; delta: number }[], q: Queryable): Promise<void> {
    if (deltas.length === 0) return;
    await q.query(
      `UPDATE insumos_estoque i
       SET quantidade_disponivel = i.quantidade_disponivel + v.delta
       FROM unnest($1::int[], $2::numeric[]) AS v(id, delta)
       WHERE i.id = v.id`,
      [deltas.map((d) => d.insumoId), deltas.map((d) => d.delta)],
    );
  }

  async registrarMovimentacoes(
    itens: { insumoId: number; quantidade: number }[],
    tipo: TipoMovimentacao,
    motivo: MotivoMovimentacao,
    pedidoId: number | null,
    q: Queryable,
  ): Promise<void> {
    if (itens.length === 0) return;
    await q.query(
      `INSERT INTO movimentacoes_estoque (insumo_id, tipo, motivo, quantidade, pedido_id)
       SELECT v.id, $3, $4, v.quantidade, $5
       FROM unnest($1::int[], $2::numeric[]) AS v(id, quantidade)`,
      [itens.map((i) => i.insumoId), itens.map((i) => i.quantidade), tipo, motivo, pedidoId],
    );
  }

  async findMovimentacoes(filtro: FiltroMovimentacoes): Promise<MovimentacaoEstoque[]> {
    const { rows } = await this.db.query<MovimentacaoRow>(
      `SELECT m.id, m.insumo_id, i.nome_item, m.tipo, m.motivo, m.quantidade, m.pedido_id, m.criado_em
       FROM movimentacoes_estoque m
       JOIN insumos_estoque i ON i.id = m.insumo_id
       WHERE ($1::int IS NULL OR m.insumo_id = $1)
         AND ($2::int IS NULL OR m.pedido_id = $2)
         AND ($3::text IS NULL OR m.tipo = $3)
       ORDER BY m.criado_em DESC, m.id DESC
       LIMIT 500`,
      [filtro.insumoId ?? null, filtro.pedidoId ?? null, filtro.tipo ?? null],
    );
    return rows.map(toMovimentacao);
  }

  /** Quanto cada insumo saiu por causa de um pedido (para devolver no cancelamento). */
  async saidasDoPedido(pedidoId: number, q: Queryable): Promise<{ insumoId: number; quantidade: number }[]> {
    const { rows } = await q.query<{ insumo_id: number; total: string }>(
      `SELECT insumo_id, SUM(quantidade) AS total
       FROM movimentacoes_estoque
       WHERE pedido_id = $1 AND tipo = 'SAIDA' AND motivo = 'PEDIDO'
       GROUP BY insumo_id ORDER BY insumo_id`,
      [pedidoId],
    );
    return rows.map((r) => ({ insumoId: r.insumo_id, quantidade: toNumber(r.total) }));
  }

  // ---------- Alertas de reposição ----------

  /**
   * Abre alerta para quem chegou no mínimo (no máximo 1 aberto por insumo — índice único parcial)
   * e resolve os alertas de quem voltou a ficar acima do mínimo.
   */
  async sincronizarAlertas(insumoIds: number[], q: Queryable): Promise<void> {
    if (insumoIds.length === 0) return;
    await q.query(
      `INSERT INTO alertas_estoque (insumo_id, saldo)
       SELECT id, quantidade_disponivel FROM insumos_estoque
       WHERE id = ANY($1::int[]) AND quantidade_disponivel <= estoque_minimo
       ON CONFLICT (insumo_id) WHERE resolvido = FALSE
       DO UPDATE SET saldo = EXCLUDED.saldo`,
      [insumoIds],
    );
    await q.query(
      `UPDATE alertas_estoque a SET resolvido = TRUE
       FROM insumos_estoque i
       WHERE a.insumo_id = i.id AND a.resolvido = FALSE
         AND i.id = ANY($1::int[]) AND i.quantidade_disponivel > i.estoque_minimo`,
      [insumoIds],
    );
  }

  async findAlertas(resolvido?: boolean): Promise<AlertaEstoque[]> {
    const { rows } = await this.db.query<AlertaRow>(
      `SELECT a.id, a.insumo_id, i.nome_item, i.unidade_medida, a.saldo, i.estoque_minimo, a.resolvido, a.criado_em
       FROM alertas_estoque a
       JOIN insumos_estoque i ON i.id = a.insumo_id
       WHERE ($1::boolean IS NULL OR a.resolvido = $1)
       ORDER BY a.resolvido, a.criado_em DESC`,
      [resolvido ?? null],
    );
    return rows.map(toAlerta);
  }

  async findAlertaById(id: number): Promise<AlertaEstoque | null> {
    const { rows } = await this.db.query<AlertaRow>(
      `SELECT a.id, a.insumo_id, i.nome_item, i.unidade_medida, a.saldo, i.estoque_minimo, a.resolvido, a.criado_em
       FROM alertas_estoque a JOIN insumos_estoque i ON i.id = a.insumo_id
       WHERE a.id = $1`,
      [id],
    );
    return rows[0] ? toAlerta(rows[0]) : null;
  }

  async resolverAlerta(id: number): Promise<void> {
    await this.db.query('UPDATE alertas_estoque SET resolvido = TRUE WHERE id = $1', [id]);
  }
}
