import { Injectable } from '@nestjs/common';
import { DatabaseService } from '../../database/database.service';
import { toNumber } from '../../database/sql.util';

export interface ResumoAvaliacoes {
  notaMedia: number | null;
  totalAvaliacoes: number;
}

export interface AvaliacaoDetalhada {
  pedidoId: number;
  clienteNome: string;
  nota: number;
  comentario: string | null;
  criadoEm: Date;
}

@Injectable()
export class LojaRepository {
  constructor(private readonly db: DatabaseService) {}

  async resumoAvaliacoes(): Promise<ResumoAvaliacoes> {
    const { rows } = await this.db.query<{ media: string | null; total: string }>(
      'SELECT ROUND(AVG(nota)::numeric, 1) AS media, COUNT(*) AS total FROM avaliacoes',
    );
    return { notaMedia: rows[0].media === null ? null : toNumber(rows[0].media), totalAvaliacoes: Number(rows[0].total) };
  }

  async listarAvaliacoes(): Promise<AvaliacaoDetalhada[]> {
    const { rows } = await this.db.query<{
      pedido_id: number;
      nome: string;
      nota: number;
      comentario: string | null;
      criado_em: Date;
    }>(
      `SELECT av.pedido_id, u.nome, av.nota, av.comentario, av.criado_em
       FROM avaliacoes av
       JOIN pedidos p ON p.id = av.pedido_id
       JOIN usuarios u ON u.id = p.cliente_id
       ORDER BY av.criado_em DESC
       LIMIT 200`,
    );
    return rows.map((r) => ({ pedidoId: r.pedido_id, clienteNome: r.nome, nota: r.nota, comentario: r.comentario, criadoEm: r.criado_em }));
  }
}
