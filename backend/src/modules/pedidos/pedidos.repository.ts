import { Injectable } from '@nestjs/common';
import { DatabaseService, Queryable } from '../../database/database.service';
import { toNumber } from '../../database/sql.util';
import { FormaPagamento, ItemPedido, Pagamento, Pedido, StatusPagamento, StatusPedido } from '../../domain/entities';

type PedidoRow = {
  id: number;
  cliente_id: number;
  endereco_id: number;
  status: StatusPedido;
  valor_total: string;
  taxa_entrega: string;
  criado_em: Date;
  itens: (Omit<ItemPedido, 'precoUnitario'> & { precoUnitario: number | string })[];
  pagamento: (Omit<Pagamento, 'valorPago'> & { valorPago: number | string }) | null;
}

const toPedido = (r: PedidoRow): Pedido => ({
  id: r.id,
  clienteId: r.cliente_id,
  enderecoId: r.endereco_id,
  status: r.status,
  valorTotal: toNumber(r.valor_total),
  taxaEntrega: toNumber(r.taxa_entrega),
  criadoEm: r.criado_em,
  itens: r.itens.map((i) => ({ ...i, precoUnitario: toNumber(i.precoUnitario) })),
  pagamento: r.pagamento ? { ...r.pagamento, valorPago: toNumber(r.pagamento.valorPago) } : null,
});

/** Pedido com itens e pagamento em uma única consulta (json_agg). */
const SELECT_PEDIDO = `
  SELECT p.id, p.cliente_id, p.endereco_id, p.status, p.valor_total, p.taxa_entrega, p.criado_em,
         COALESCE((
           SELECT json_agg(json_build_object(
                    'id', ip.id, 'produtoId', ip.produto_id, 'produtoNome', pr.nome,
                    'quantidade', ip.quantidade, 'precoUnitario', ip.preco_unitario, 'observacao', ip.observacao
                  ) ORDER BY ip.id)
           FROM itens_pedido ip JOIN produtos pr ON pr.id = ip.produto_id
           WHERE ip.pedido_id = p.id
         ), '[]'::json) AS itens,
         (
           SELECT json_build_object(
                    'formaPagamento', pg.forma_pagamento, 'statusPagamento', pg.status_pagamento, 'valorPago', pg.valor_pago)
           FROM pagamentos pg WHERE pg.pedido_id = p.id
         ) AS pagamento
  FROM pedidos p`;

export interface NovaLinhaPedido {
  produtoId: number;
  quantidade: number;
  precoUnitario: number;
  observacao: string | null;
}

export interface SaidaProduto {
  produtoId: number;
  nome: string;
  quantidadeVendida: number;
  faturamento: number;
}

@Injectable()
export class PedidosRepository {
  constructor(private readonly db: DatabaseService) {}

  async findById(id: number, q: Queryable = this.db): Promise<Pedido | null> {
    const { rows } = await q.query<PedidoRow>(`${SELECT_PEDIDO} WHERE p.id = $1`, [id]);
    return rows[0] ? toPedido(rows[0]) : null;
  }

  async findAll(filtro: { clienteId?: number; status?: StatusPedido }): Promise<Pedido[]> {
    const { rows } = await this.db.query<PedidoRow>(
      `${SELECT_PEDIDO}
       WHERE ($1::int IS NULL OR p.cliente_id = $1)
         AND ($2::text IS NULL OR p.status = $2)
       ORDER BY p.criado_em DESC, p.id DESC
       LIMIT 200`,
      [filtro.clienteId ?? null, filtro.status ?? null],
    );
    return rows.map(toPedido);
  }

  /** Trava o pedido até o fim da transação, para duas mudanças de status não se atropelarem. */
  async lockById(id: number, q: Queryable): Promise<{ id: number; clienteId: number; status: StatusPedido } | null> {
    const { rows } = await q.query<{ id: number; cliente_id: number; status: StatusPedido }>(
      'SELECT id, cliente_id, status FROM pedidos WHERE id = $1 FOR UPDATE',
      [id],
    );
    return rows[0] ? { id: rows[0].id, clienteId: rows[0].cliente_id, status: rows[0].status } : null;
  }

  async insertPedido(
    data: { clienteId: number; enderecoId: number; valorTotal: number; taxaEntrega: number },
    q: Queryable,
  ): Promise<number> {
    const { rows } = await q.query<{ id: number }>(
      `INSERT INTO pedidos (cliente_id, endereco_id, status, valor_total, taxa_entrega)
       VALUES ($1, $2, 'RECEBIDO', $3, $4) RETURNING id`,
      [data.clienteId, data.enderecoId, data.valorTotal, data.taxaEntrega],
    );
    return rows[0].id;
  }

  /** RF06 — grava o preço unitário histórico de cada item. */
  async insertItens(pedidoId: number, linhas: NovaLinhaPedido[], q: Queryable): Promise<void> {
    await q.query(
      `INSERT INTO itens_pedido (pedido_id, produto_id, quantidade, preco_unitario, observacao)
       SELECT $1, v.produto_id, v.quantidade, v.preco, v.observacao
       FROM unnest($2::int[], $3::int[], $4::numeric[], $5::text[]) AS v(produto_id, quantidade, preco, observacao)`,
      [
        pedidoId,
        linhas.map((l) => l.produtoId),
        linhas.map((l) => l.quantidade),
        linhas.map((l) => l.precoUnitario),
        linhas.map((l) => l.observacao),
      ],
    );
  }

  /** RF08 — exatamente 1 pagamento por pedido (pedido_id é UNIQUE). */
  async insertPagamento(pedidoId: number, forma: FormaPagamento, status: StatusPagamento, valor: number, q: Queryable): Promise<void> {
    await q.query(
      `INSERT INTO pagamentos (pedido_id, forma_pagamento, status_pagamento, valor_pago) VALUES ($1, $2, $3, $4)`,
      [pedidoId, forma, status, valor],
    );
  }

  async updateStatus(id: number, status: StatusPedido, q: Queryable): Promise<void> {
    await q.query('UPDATE pedidos SET status = $2 WHERE id = $1', [id, status]);
  }

  async updateStatusPagamento(pedidoId: number, de: StatusPagamento[], para: StatusPagamento, q: Queryable): Promise<void> {
    await q.query(
      'UPDATE pagamentos SET status_pagamento = $3 WHERE pedido_id = $1 AND status_pagamento = ANY($2::text[])',
      [pedidoId, de, para],
    );
  }

  /** Relatório de saída: quanto de cada produto foi vendido (pedidos não cancelados). */
  async saidaProdutos(de?: string, ate?: string): Promise<SaidaProduto[]> {
    const { rows } = await this.db.query<{ produto_id: number; nome: string; quantidade: string; faturamento: string }>(
      `SELECT pr.id AS produto_id, pr.nome,
              SUM(ip.quantidade) AS quantidade,
              SUM(ip.quantidade * ip.preco_unitario) AS faturamento
       FROM itens_pedido ip
       JOIN pedidos p ON p.id = ip.pedido_id
       JOIN produtos pr ON pr.id = ip.produto_id
       WHERE p.status <> 'CANCELADO'
         AND ($1::date IS NULL OR p.criado_em >= $1::date)
         AND ($2::date IS NULL OR p.criado_em < $2::date + 1)
       GROUP BY pr.id, pr.nome
       ORDER BY quantidade DESC, pr.nome`,
      [de ?? null, ate ?? null],
    );
    return rows.map((r) => ({
      produtoId: r.produto_id,
      nome: r.nome,
      quantidadeVendida: Number(r.quantidade),
      faturamento: toNumber(r.faturamento),
    }));
  }
}
