import { Injectable } from '@nestjs/common';
import { Queryable } from '../../database/database.service';
import { MotivoMovimentacao } from '../../domain/entities';
import { InsumosRepository } from './insumos.repository';

export type Quantidades = { insumoId: number; quantidade: number }[];

/**
 * Toda mudança de saldo passa por aqui, sempre dentro de uma transação:
 * ajusta o saldo, registra a movimentação e sincroniza os alertas de reposição.
 */
@Injectable()
export class EstoqueService {
  constructor(private readonly repo: InsumosRepository) {}

  /** RF05 — baixa automática dos insumos de um pedido. */
  async baixar(itens: Quantidades, pedidoId: number, tx: Queryable): Promise<void> {
    await this.movimentar(itens, -1, 'PEDIDO', pedidoId, tx);
  }

  /** Cancelamento devolve ao estoque exatamente o que o pedido tinha consumido. */
  async devolver(itens: Quantidades, pedidoId: number, tx: Queryable): Promise<void> {
    await this.movimentar(itens, +1, 'CANCELAMENTO', pedidoId, tx);
  }

  async entrada(itens: Quantidades, motivo: Extract<MotivoMovimentacao, 'REPOSICAO' | 'CADASTRO'>, tx: Queryable): Promise<void> {
    await this.movimentar(itens, +1, motivo, null, tx);
  }

  private async movimentar(itens: Quantidades, sinal: 1 | -1, motivo: MotivoMovimentacao, pedidoId: number | null, tx: Queryable) {
    const validos = itens.filter((i) => i.quantidade > 0);
    if (validos.length === 0) return;
    // Trava as linhas sempre na mesma ordem (por id) antes de alterar: evita deadlock entre pedidos e cancelamentos
    await this.repo.lockByIds(validos.map((i) => i.insumoId), tx);
    await this.repo.ajustarSaldos(validos.map((i) => ({ insumoId: i.insumoId, delta: sinal * i.quantidade })), tx);
    await this.repo.registrarMovimentacoes(validos, sinal < 0 ? 'SAIDA' : 'ENTRADA', motivo, pedidoId, tx);
    await this.repo.sincronizarAlertas(validos.map((i) => i.insumoId), tx);
  }
}
