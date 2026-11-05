import { BusinessRuleError } from '../common/errors';
import { FormaPagamento, StatusPagamento, StatusPedido } from './entities';
import { multiplicar, somar } from './money';

/**
 * RF07 — fluxo sequencial do pedido:
 * RECEBIDO → PREPARANDO → SAIU_ENTREGA → CONCLUIDO (ou CANCELADO antes de sair para entrega).
 */
const PROXIMO_STATUS: Record<StatusPedido, StatusPedido | null> = {
  RECEBIDO: 'PREPARANDO',
  PREPARANDO: 'SAIU_ENTREGA',
  SAIU_ENTREGA: 'CONCLUIDO',
  CONCLUIDO: null,
  CANCELADO: null,
};

const PODE_CANCELAR: StatusPedido[] = ['RECEBIDO', 'PREPARANDO'];

/** CT-KDS-006: lança 422 em qualquer salto ou volta de etapa. */
export function validarTransicao(atual: StatusPedido, novo: StatusPedido): void {
  if (novo === 'CANCELADO') {
    throw new BusinessRuleError('Para cancelar, use a rota de cancelamento do pedido');
  }
  const esperado = PROXIMO_STATUS[atual];
  if (esperado !== novo) {
    const dica = esperado ? `O próximo status permitido é ${esperado}.` : `O pedido já está ${atual} e não muda mais.`;
    throw new BusinessRuleError(`Transição inválida de ${atual} para ${novo}. ${dica}`, {
      statusAtual: atual,
      statusSolicitado: novo,
      proximoPermitido: esperado,
    });
  }
}

export function validarCancelamento(atual: StatusPedido): void {
  if (!PODE_CANCELAR.includes(atual)) {
    throw new BusinessRuleError(`Pedido com status ${atual} não pode mais ser cancelado`, {
      statusAtual: atual,
      cancelavelEm: PODE_CANCELAR,
    });
  }
}

export interface LinhaValor {
  quantidade: number;
  precoUnitario: number;
}

/** valor_total = soma(quantidade × preço unitário histórico) + taxa de entrega. */
export function calcularTotais(linhas: LinhaValor[], taxaEntrega: number): { subtotal: number; valorTotal: number } {
  const subtotal = somar(...linhas.map((l) => multiplicar(l.precoUnitario, l.quantidade)));
  return { subtotal, valorTotal: somar(subtotal, taxaEntrega) };
}

/**
 * Pagamento simulado (projeto de apresentação):
 * PIX e cartões são aprovados na hora; dinheiro fica PENDENTE até a entrega ser concluída.
 */
export function statusInicialPagamento(forma: FormaPagamento): StatusPagamento {
  return forma === 'DINHEIRO' ? 'PENDENTE' : 'APROVADO';
}
