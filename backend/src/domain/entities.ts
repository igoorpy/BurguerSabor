/** Entidades do domínio (espelham o DER em docs/02-modelagem-banco-e-uml.md). */

export type TipoUsuario = 'CLIENTE' | 'ADMIN';
export type UnidadeMedida = 'UN' | 'KG' | 'L' | 'G' | 'ML';
export type StatusPedido = 'RECEBIDO' | 'PREPARANDO' | 'SAIU_ENTREGA' | 'CONCLUIDO' | 'CANCELADO';
export type FormaPagamento = 'PIX' | 'CARTAO_CREDITO' | 'CARTAO_DEBITO' | 'DINHEIRO';
export type StatusPagamento = 'PENDENTE' | 'APROVADO' | 'RECUSADO' | 'REEMBOLSO_SOLICITADO' | 'REEMBOLSADO';
export const STATUS_PAGAMENTO: StatusPagamento[] = ['PENDENTE', 'APROVADO', 'RECUSADO', 'REEMBOLSO_SOLICITADO', 'REEMBOLSADO'];
export type TipoMovimentacao = 'ENTRADA' | 'SAIDA';
export type MotivoMovimentacao = 'PEDIDO' | 'CANCELAMENTO' | 'REPOSICAO' | 'CADASTRO';

export const UNIDADES_MEDIDA: UnidadeMedida[] = ['UN', 'KG', 'L', 'G', 'ML'];
export const STATUS_PEDIDO: StatusPedido[] = ['RECEBIDO', 'PREPARANDO', 'SAIU_ENTREGA', 'CONCLUIDO', 'CANCELADO'];
export const FORMAS_PAGAMENTO: FormaPagamento[] = ['PIX', 'CARTAO_CREDITO', 'CARTAO_DEBITO', 'DINHEIRO'];

export interface Usuario {
  id: number;
  nome: string;
  email: string;
  senhaHash: string;
  telefone: string;
  tipoUsuario: TipoUsuario;
  criadoEm: Date;
}

export interface Endereco {
  id: number;
  usuarioId: number;
  rua: string;
  numero: string;
  bairro: string;
  cep: string;
  pontoReferencia: string | null;
}

export interface Categoria {
  id: number;
  nome: string;
  ordemExibicao: number;
  ativo: boolean;
}

export interface Produto {
  id: number;
  categoriaId: number;
  categoriaNome: string;
  /** Categoria desativada tira o produto do cardápio */
  categoriaAtiva: boolean;
  nome: string;
  descricao: string | null;
  preco: number;
  imagemUrl: string | null;
  /** Marcado pelo admin */
  disponivel: boolean;
  /** Há saldo de todos os insumos para ao menos 1 unidade (RN04) */
  temEstoque: boolean;
}

export interface InsumoEstoque {
  id: number;
  nomeItem: string;
  unidadeMedida: UnidadeMedida;
  quantidadeDisponivel: number;
  precoCusto: number;
  estoqueMinimo: number;
}

export interface ItemFichaTecnica {
  produtoId: number;
  insumoId: number;
  nomeItem: string;
  unidadeMedida: UnidadeMedida;
  quantidadeNecessaria: number;
  precoCusto: number;
}

export interface ItemPedido {
  id: number;
  produtoId: number;
  produtoNome: string;
  quantidade: number;
  precoUnitario: number;
  observacao: string | null;
}

export interface Pagamento {
  formaPagamento: FormaPagamento;
  statusPagamento: StatusPagamento;
  valorPago: number;
  /** Motivo escrito pelo cliente ao pedir reembolso (null se nunca pediu). */
  motivoReembolso: string | null;
}

export interface Avaliacao {
  nota: number;
  comentario: string | null;
  criadoEm: Date;
}

export interface Pedido {
  id: number;
  clienteId: number;
  enderecoId: number;
  status: StatusPedido;
  valorTotal: number;
  taxaEntrega: number;
  criadoEm: Date;
  itens: ItemPedido[];
  pagamento: Pagamento | null;
  avaliacao: Avaliacao | null;
}

export interface MovimentacaoEstoque {
  id: number;
  insumoId: number;
  nomeItem: string;
  tipo: TipoMovimentacao;
  motivo: MotivoMovimentacao;
  quantidade: number;
  pedidoId: number | null;
  criadoEm: Date;
}

export interface AlertaEstoque {
  id: number;
  insumoId: number;
  nomeItem: string;
  unidadeMedida: UnidadeMedida;
  saldo: number;
  estoqueMinimo: number;
  resolvido: boolean;
  criadoEm: Date;
}
