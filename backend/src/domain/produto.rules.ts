import { ItemFichaTecnica } from './entities';
import { multiplicar, somar } from './money';

export interface CustoProduto {
  custo: number;
  lucro: number;
  margemPercentual: number;
  itens: { insumoId: number; nomeItem: string; quantidadeNecessaria: number; precoCusto: number; custo: number }[];
}

/** Lucro = preço de venda − custo dos insumos da ficha técnica. */
export function calcularCusto(preco: number, ficha: ItemFichaTecnica[]): CustoProduto {
  const itens = ficha.map((f) => ({
    insumoId: f.insumoId,
    nomeItem: f.nomeItem,
    quantidadeNecessaria: f.quantidadeNecessaria,
    precoCusto: f.precoCusto,
    custo: multiplicar(f.precoCusto, f.quantidadeNecessaria),
  }));
  const custo = somar(...itens.map((i) => i.custo));
  const lucro = somar(preco, -custo);
  const margemPercentual = Math.round((lucro / preco) * 10_000) / 100;
  return { custo, lucro, margemPercentual, itens };
}
