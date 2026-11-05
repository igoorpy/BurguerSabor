/* Testes de unidade das regras de negócio puras (sem banco e sem HTTP). */
import { BusinessRuleError } from '../../src/common/errors';
import { InsumoEstoque } from '../../src/domain/entities';
import { calcularNecessidade, precisaReposicao, verificarFaltas } from '../../src/domain/estoque.rules';
import { somar } from '../../src/domain/money';
import { calcularTotais, statusInicialPagamento, validarCancelamento, validarTransicao } from '../../src/domain/pedido.rules';
import { calcularCusto } from '../../src/domain/produto.rules';

const pao: InsumoEstoque = { id: 1, nomeItem: 'Pão Brioche', unidadeMedida: 'UN', quantidadeDisponivel: 1, precoCusto: 1.5, estoqueMinimo: 10 };

describe('Fluxo de status do pedido (RF07)', () => {
  it.each([
    ['RECEBIDO', 'PREPARANDO'],
    ['PREPARANDO', 'SAIU_ENTREGA'],
    ['SAIU_ENTREGA', 'CONCLUIDO'],
  ] as const)('permite %s → %s', (de, para) => {
    expect(() => validarTransicao(de, para)).not.toThrow();
  });

  it('CT-KDS-006: nega RECEBIDO → CONCLUIDO e indica o próximo passo', () => {
    expect(() => validarTransicao('RECEBIDO', 'CONCLUIDO')).toThrow(BusinessRuleError);
    try {
      validarTransicao('RECEBIDO', 'CONCLUIDO');
    } catch (e) {
      expect((e as BusinessRuleError).status).toBe(422);
      expect((e as BusinessRuleError).details).toMatchObject({ proximoPermitido: 'PREPARANDO' });
    }
  });

  it('nega voltar etapas e mudar pedido concluído', () => {
    expect(() => validarTransicao('PREPARANDO', 'RECEBIDO')).toThrow(BusinessRuleError);
    expect(() => validarTransicao('CONCLUIDO', 'RECEBIDO')).toThrow(/não muda mais/);
  });

  it('cancelamento só por rota própria e só até PREPARANDO', () => {
    expect(() => validarTransicao('RECEBIDO', 'CANCELADO')).toThrow(/cancelamento/);
    expect(() => validarCancelamento('RECEBIDO')).not.toThrow();
    expect(() => validarCancelamento('PREPARANDO')).not.toThrow();
    expect(() => validarCancelamento('SAIU_ENTREGA')).toThrow(BusinessRuleError);
    expect(() => validarCancelamento('CANCELADO')).toThrow(BusinessRuleError);
  });
});

describe('Totais do pedido e pagamento', () => {
  it('soma itens pelo preço unitário e acrescenta a taxa de entrega', () => {
    expect(calcularTotais([{ quantidade: 2, precoUnitario: 28.5 }, { quantidade: 1, precoUnitario: 6 }], 5)).toEqual({
      subtotal: 63,
      valorTotal: 68,
    });
  });

  it('não acumula erro de ponto flutuante', () => {
    expect(somar(0.1, 0.2)).toBe(0.3);
    expect(calcularTotais([{ quantidade: 3, precoUnitario: 0.1 }], 0).valorTotal).toBe(0.3);
  });

  it('pagamento simulado: dinheiro fica pendente, demais aprovados', () => {
    expect(statusInicialPagamento('DINHEIRO')).toBe('PENDENTE');
    expect(statusInicialPagamento('PIX')).toBe('APROVADO');
    expect(statusInicialPagamento('CARTAO_CREDITO')).toBe('APROVADO');
  });
});

describe('Baixa de estoque pela ficha técnica (RF05 / RN01)', () => {
  const receitas = [
    { produtoId: 1, insumoId: 1, quantidadeNecessaria: 1 },
    { produtoId: 1, insumoId: 3, quantidadeNecessaria: 40 },
    { produtoId: 3, insumoId: 1, quantidadeNecessaria: 1 },
    { produtoId: 3, insumoId: 3, quantidadeNecessaria: 20 },
  ];

  it('multiplica a receita pela quantidade e soma insumos repetidos', () => {
    const necessidade = calcularNecessidade(
      [
        { produtoId: 1, quantidade: 2 },
        { produtoId: 3, quantidade: 1 },
        { produtoId: 2, quantidade: 1 }, // sem ficha técnica: não consome insumo
      ],
      receitas,
    );
    expect([...necessidade]).toEqual([
      [1, 3],
      [3, 100],
    ]);
  });

  it('CT-EST-001 (valor limite): saldo 1,00 não atende 2,00', () => {
    const faltas = verificarFaltas(new Map([[1, 2]]), [pao]);
    expect(faltas).toEqual([{ insumoId: 1, nomeItem: 'Pão Brioche', unidadeMedida: 'UN', necessario: 2, disponivel: 1 }]);
  });

  it('CT-EST-001 (valor limite): saldo 1,00 atende exatamente 1,00', () => {
    expect(verificarFaltas(new Map([[1, 1]]), [pao])).toEqual([]);
  });

  it('insumo ausente conta como saldo zero', () => {
    expect(verificarFaltas(new Map([[99, 1]]), [])).toHaveLength(1);
  });

  it('alerta de reposição quando o saldo chega no mínimo', () => {
    expect(precisaReposicao({ quantidadeDisponivel: 10, estoqueMinimo: 10 })).toBe(true);
    expect(precisaReposicao({ quantidadeDisponivel: 10.01, estoqueMinimo: 10 })).toBe(false);
  });
});

describe('Custo e lucro do produto', () => {
  it('X-Cheddar: custo R$ 9,50, lucro R$ 19,00, margem 66,67%', () => {
    const resultado = calcularCusto(28.5, [
      { produtoId: 1, insumoId: 1, nomeItem: 'Pão', unidadeMedida: 'UN', quantidadeNecessaria: 1, precoCusto: 1.5 },
      { produtoId: 1, insumoId: 2, nomeItem: 'Blend', unidadeMedida: 'UN', quantidadeNecessaria: 1, precoCusto: 6 },
      { produtoId: 1, insumoId: 3, nomeItem: 'Cheddar', unidadeMedida: 'G', quantidadeNecessaria: 40, precoCusto: 0.05 },
    ]);
    expect(resultado).toMatchObject({ custo: 9.5, lucro: 19, margemPercentual: 66.67 });
    expect(resultado.itens.map((i) => i.custo)).toEqual([1.5, 6, 2]);
  });
});
