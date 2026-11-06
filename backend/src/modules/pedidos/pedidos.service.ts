import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { UsuarioAutenticado } from '../../common/auth/auth.decorators';
import { BusinessRuleError, NotFoundError } from '../../common/errors';
import { DatabaseService } from '../../database/database.service';
import { Pedido, StatusPedido } from '../../domain/entities';
import { calcularNecessidade, verificarFaltas } from '../../domain/estoque.rules';
import {
  calcularTotais,
  statusInicialPagamento,
  validarAvaliacao,
  validarCancelamento,
  validarPedidoReembolso,
  validarRespostaReembolso,
  validarTransicao,
} from '../../domain/pedido.rules';
import { EnderecosRepository } from '../enderecos/enderecos.repository';
import { EstoqueService } from '../insumos/estoque.service';
import { InsumosRepository } from '../insumos/insumos.repository';
import { ProdutosRepository } from '../produtos/produtos.repository';
import { AvaliarPedidoDto, CreatePedidoDto, ResponderReembolsoDto, SolicitarReembolsoDto } from './dto/pedido.dto';
import { PedidosRepository, SaidaProduto } from './pedidos.repository';

@Injectable()
export class PedidosService {
  private readonly taxaEntrega: number;

  constructor(
    config: ConfigService,
    private readonly db: DatabaseService,
    private readonly repo: PedidosRepository,
    private readonly produtos: ProdutosRepository,
    private readonly enderecos: EnderecosRepository,
    private readonly insumos: InsumosRepository,
    private readonly estoque: EstoqueService,
  ) {
    this.taxaEntrega = Number(config.get<string>('TAXA_ENTREGA') ?? 5);
  }

  /**
   * RNF03 — pedido, itens, pagamento e baixa de insumos em UM bloco atômico.
   * Se qualquer passo falhar (ex.: estoque insuficiente), o ROLLBACK desfaz tudo e o saldo não muda.
   */
  async criar(cliente: UsuarioAutenticado, dto: CreatePedidoDto): Promise<Pedido> {
    const pedidoId = await this.db.transaction(async (tx) => {
      const endereco = await this.enderecos.findById(dto.enderecoId, tx);
      if (!endereco || endereco.usuarioId !== cliente.id) {
        throw new BusinessRuleError('Endereço de entrega não encontrado para este cliente', { enderecoId: dto.enderecoId });
      }

      const produtoIds = [...new Set(dto.itens.map((i) => i.produtoId))];
      const produtos = await this.produtos.findManyByIds(produtoIds, tx);
      const inexistentes = produtoIds.filter((id) => !produtos.some((p) => p.id === id));
      if (inexistentes.length) throw new BusinessRuleError('Produto(s) inexistente(s) no pedido', { produtoIds: inexistentes });

      // Fora do cardápio: marcado indisponível pelo admin ou de uma categoria desativada
      const indisponiveis = produtos.filter((p) => !p.disponivel || !p.categoriaAtiva);
      if (indisponiveis.length) {
        throw new BusinessRuleError('Produto(s) indisponível(is) para venda', {
          produtos: indisponiveis.map((p) => ({ produtoId: p.id, nome: p.nome })),
        });
      }

      // RF05 + RN01 — calcula o consumo pela ficha técnica e confere o saldo com as linhas travadas
      const receitas = await this.produtos.findFicha(produtoIds, tx);
      const necessidade = calcularNecessidade(dto.itens, receitas);
      const saldos = await this.insumos.lockByIds([...necessidade.keys()], tx);
      const faltas = verificarFaltas(necessidade, saldos);
      if (faltas.length) throw new BusinessRuleError('Estoque insuficiente para atender o pedido', faltas);

      // RF06 — preço unitário histórico: o preço de agora fica gravado no item
      const precoPorProduto = new Map(produtos.map((p) => [p.id, p.preco]));
      const linhas = dto.itens.map((i) => ({
        produtoId: i.produtoId,
        quantidade: i.quantidade,
        precoUnitario: precoPorProduto.get(i.produtoId) as number,
        observacao: i.observacao ?? null,
      }));
      const { valorTotal } = calcularTotais(linhas, this.taxaEntrega);

      const id = await this.repo.insertPedido(
        { clienteId: cliente.id, enderecoId: endereco.id, valorTotal, taxaEntrega: this.taxaEntrega },
        tx,
      );
      await this.repo.insertItens(id, linhas, tx);
      await this.repo.insertPagamento(id, dto.formaPagamento, statusInicialPagamento(dto.formaPagamento), valorTotal, tx);
      await this.estoque.baixar(
        [...necessidade].map(([insumoId, quantidade]) => ({ insumoId, quantidade })),
        id,
        tx,
      );
      return id;
    });

    return this.buscar(cliente, pedidoId);
  }

  /** Admin vê todos (KDS); cliente vê só os próprios. */
  listar(usuario: UsuarioAutenticado, status?: StatusPedido): Promise<Pedido[]> {
    return this.repo.findAll({ status, clienteId: usuario.tipoUsuario === 'ADMIN' ? undefined : usuario.id });
  }

  async buscar(usuario: UsuarioAutenticado, id: number): Promise<Pedido> {
    const pedido = await this.repo.findById(id);
    if (!pedido || (usuario.tipoUsuario !== 'ADMIN' && pedido.clienteId !== usuario.id)) {
      throw new NotFoundError(`Pedido ${id} não encontrado`);
    }
    return pedido;
  }

  /** RF07 / CT-KDS-006 — avança uma etapa por vez. Concluir libera o pagamento em dinheiro. */
  async atualizarStatus(admin: UsuarioAutenticado, id: number, novo: StatusPedido): Promise<Pedido> {
    await this.db.transaction(async (tx) => {
      const pedido = await this.repo.lockById(id, tx);
      if (!pedido) throw new NotFoundError(`Pedido ${id} não encontrado`);
      validarTransicao(pedido.status, novo);
      await this.repo.updateStatus(id, novo, tx);
      if (novo === 'CONCLUIDO') await this.repo.updateStatusPagamento(id, ['PENDENTE'], 'APROVADO', tx);
    });
    return this.buscar(admin, id);
  }

  /**
   * RF11 — cancelamento: o cliente cancela o próprio pedido enquanto ele está RECEBIDO;
   * o admin cancela até a etapa PREPARANDO. Os insumos voltam ao estoque e o pagamento é marcado como RECUSADO.
   */
  async cancelar(usuario: UsuarioAutenticado, id: number): Promise<Pedido> {
    await this.db.transaction(async (tx) => {
      const pedido = await this.repo.lockById(id, tx);
      const ehAdmin = usuario.tipoUsuario === 'ADMIN';
      if (!pedido || (!ehAdmin && pedido.clienteId !== usuario.id)) throw new NotFoundError(`Pedido ${id} não encontrado`);

      validarCancelamento(pedido.status);
      if (!ehAdmin && pedido.status !== 'RECEBIDO') {
        throw new BusinessRuleError('O pedido já está em preparo; peça o cancelamento à loja', { statusAtual: pedido.status });
      }

      const consumido = await this.insumos.saidasDoPedido(id, tx);
      await this.estoque.devolver(consumido, id, tx);
      await this.repo.updateStatus(id, 'CANCELADO', tx);
      await this.repo.updateStatusPagamento(id, ['PENDENTE', 'APROVADO'], 'RECUSADO', tx);
    });
    return this.buscar(usuario, id);
  }

  /** O cliente avalia o próprio pedido, uma vez, depois de entregue. */
  async avaliar(cliente: UsuarioAutenticado, id: number, dto: AvaliarPedidoDto): Promise<Pedido> {
    await this.db.transaction(async (tx) => {
      const pedido = await this.repo.lockById(id, tx);
      if (!pedido || pedido.clienteId !== cliente.id) throw new NotFoundError(`Pedido ${id} não encontrado`);
      validarAvaliacao(pedido.status, await this.repo.jaAvaliado(id, tx));
      await this.repo.insertAvaliacao(id, dto.nota, dto.comentario?.trim() || null, tx);
    });
    return this.buscar(cliente, id);
  }

  /**
   * O cliente pede reembolso de um pedido já entregue e pago.
   * O estoque não volta: o lanche já foi preparado e entregue.
   */
  async solicitarReembolso(cliente: UsuarioAutenticado, id: number, dto: SolicitarReembolsoDto): Promise<Pedido> {
    await this.db.transaction(async (tx) => {
      const pedido = await this.repo.lockById(id, tx);
      if (!pedido || pedido.clienteId !== cliente.id) throw new NotFoundError(`Pedido ${id} não encontrado`);
      validarPedidoReembolso(pedido.status, await this.repo.lockStatusPagamento(id, tx));
      await this.repo.solicitarReembolso(id, dto.motivo.trim(), tx);
    });
    return this.buscar(cliente, id);
  }

  /** A loja aprova (vira REEMBOLSADO) ou recusa (o pagamento volta a APROVADO). O motivo fica guardado. */
  async responderReembolso(admin: UsuarioAutenticado, id: number, dto: ResponderReembolsoDto): Promise<Pedido> {
    await this.db.transaction(async (tx) => {
      const pedido = await this.repo.lockById(id, tx);
      if (!pedido) throw new NotFoundError(`Pedido ${id} não encontrado`);
      validarRespostaReembolso(await this.repo.lockStatusPagamento(id, tx));
      await this.repo.updateStatusPagamento(id, ['REEMBOLSO_SOLICITADO'], dto.aprovar ? 'REEMBOLSADO' : 'APROVADO', tx);
    });
    return this.buscar(admin, id);
  }

  saidaProdutos(de?: string, ate?: string): Promise<SaidaProduto[]> {
    return this.repo.saidaProdutos(de, ate);
  }
}
