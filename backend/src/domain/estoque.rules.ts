import { InsumoEstoque } from './entities';
import { multiplicar, paraCentavos, deCentavos } from './money';

export interface ItemSolicitado {
  produtoId: number;
  quantidade: number;
}

export interface ReceitaItem {
  produtoId: number;
  insumoId: number;
  quantidadeNecessaria: number;
}

export interface FaltaDeInsumo {
  insumoId: number;
  nomeItem: string;
  unidadeMedida: string;
  necessario: number;
  disponivel: number;
}

/**
 * RF05 — quanto de cada insumo o pedido consome:
 * para cada item, quantidade × ficha técnica do produto, somando insumos repetidos.
 */
export function calcularNecessidade(itens: ItemSolicitado[], receitas: ReceitaItem[]): Map<number, number> {
  const centavosPorInsumo = new Map<number, number>();
  for (const item of itens) {
    for (const r of receitas.filter((rec) => rec.produtoId === item.produtoId)) {
      const consumo = paraCentavos(multiplicar(r.quantidadeNecessaria, item.quantidade));
      centavosPorInsumo.set(r.insumoId, (centavosPorInsumo.get(r.insumoId) ?? 0) + consumo);
    }
  }
  return new Map([...centavosPorInsumo].map(([id, c]) => [id, deCentavos(c)]));
}

/** RN01 / CT-EST-001 — lista os insumos cujo saldo não cobre a necessidade (nada fica negativo). */
export function verificarFaltas(necessidade: Map<number, number>, insumos: InsumoEstoque[]): FaltaDeInsumo[] {
  const faltas: FaltaDeInsumo[] = [];
  for (const [insumoId, necessario] of necessidade) {
    const insumo = insumos.find((i) => i.id === insumoId);
    const disponivel = insumo?.quantidadeDisponivel ?? 0;
    if (paraCentavos(disponivel) < paraCentavos(necessario)) {
      faltas.push({
        insumoId,
        nomeItem: insumo?.nomeItem ?? `Insumo ${insumoId}`,
        unidadeMedida: insumo?.unidadeMedida ?? '',
        necessario,
        disponivel,
      });
    }
  }
  return faltas;
}

/** Alerta de reposição: saldo chegou no estoque mínimo ou abaixo. */
export const precisaReposicao = (insumo: Pick<InsumoEstoque, 'quantidadeDisponivel' | 'estoqueMinimo'>): boolean =>
  paraCentavos(insumo.quantidadeDisponivel) <= paraCentavos(insumo.estoqueMinimo);
