import { BusinessRuleError, ConflictError } from '../common/errors';
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

/** O cliente avalia uma única vez, e só depois de receber o pedido. */
export function validarAvaliacao(status: StatusPedido, jaAvaliado: boolean): void {
  if (status !== 'CONCLUIDO') {
    throw new BusinessRuleError('Só dá para avaliar depois que o pedido for entregue', { statusAtual: status });
  }
  if (jaAvaliado) throw new ConflictError('Este pedido já foi avaliado');
}

/** Reembolso só de pedido entregue e pago, uma vez. */
export function validarPedidoReembolso(statusPedido: StatusPedido, statusPagamento: StatusPagamento | null): void {
  if (statusPedido !== 'CONCLUIDO') {
    throw new BusinessRuleError('Só dá para pedir reembolso depois que o pedido for entregue', { statusAtual: statusPedido });
  }
  if (statusPagamento === 'REEMBOLSO_SOLICITADO') throw new ConflictError('O reembolso deste pedido já foi solicitado');
  if (statusPagamento === 'REEMBOLSADO') throw new ConflictError('Este pedido já foi reembolsado');
  if (statusPagamento !== 'APROVADO') {
    throw new BusinessRuleError('Não há pagamento aprovado para reembolsar', { statusPagamento });
  }
}

/** A loja só responde a um pedido de reembolso que está aguardando. */
export function validarRespostaReembolso(statusPagamento: StatusPagamento | null): void {
  if (statusPagamento !== 'REEMBOLSO_SOLICITADO') {
    throw new BusinessRuleError('Não há pedido de reembolso aguardando resposta', { statusPagamento });
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
