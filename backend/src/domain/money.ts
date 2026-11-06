/** Contas de dinheiro e quantidade em inteiros, para evitar erros de ponto flutuante (0,1 + 0,2). */

const ESCALA = 100; // DECIMAL(10,2) no banco

export const paraCentavos = (valor: number): number => Math.round(valor * ESCALA);
export const deCentavos = (centavos: number): number => centavos / ESCALA;

/** Soma valores com 2 casas decimais sem acumular erro. */
export const somar = (...valores: number[]): number => deCentavos(valores.reduce((acc, v) => acc + paraCentavos(v), 0));

/** Multiplica um valor de 2 casas por uma quantidade, arredondando para 2 casas. */
export const multiplicar = (valor: number, quantidade: number): number => deCentavos(Math.round(paraCentavos(valor) * quantidade));
