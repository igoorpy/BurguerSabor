import { Injectable } from '@nestjs/common';
import { garantirSemNulos } from '../../common/dto/sem-nulos';
import { BadRequestError, ConflictError, NotFoundError } from '../../common/errors';
import { DatabaseService } from '../../database/database.service';
import { AlertaEstoque, InsumoEstoque, MovimentacaoEstoque } from '../../domain/entities';
import { CreateInsumoDto, ReposicaoDto, UpdateInsumoDto } from './dto/insumo.dto';
import { EstoqueService } from './estoque.service';
import { FiltroMovimentacoes, InsumosRepository } from './insumos.repository';

@Injectable()
export class InsumosService {
  constructor(
    private readonly db: DatabaseService,
    private readonly repo: InsumosRepository,
    private readonly estoque: EstoqueService,
  ) {}

  listar(somenteAbaixoDoMinimo = false): Promise<InsumoEstoque[]> {
    return this.repo.findAll(somenteAbaixoDoMinimo);
  }

  async buscar(id: number): Promise<InsumoEstoque> {
    const insumo = await this.repo.findById(id);
    if (!insumo) throw new NotFoundError(`Insumo ${id} não encontrado`);
    return insumo;
  }

  /** O saldo inicial entra como movimentação CADASTRO, para o extrato bater com o saldo. */
  async criar(dto: CreateInsumoDto): Promise<InsumoEstoque> {
    await this.garantirNomeLivre(dto.nomeItem);
    const id = await this.db.transaction(async (tx) => {
      const novoId = await this.repo.create({ ...dto, quantidadeDisponivel: 0 }, tx);
      if (dto.quantidadeDisponivel > 0) {
        await this.estoque.entrada([{ insumoId: novoId, quantidade: dto.quantidadeDisponivel }], 'CADASTRO', tx);
      } else {
        await this.repo.sincronizarAlertas([novoId], tx);
      }
      return novoId;
    });
    return this.buscar(id);
  }

  async atualizar(id: number, dto: UpdateInsumoDto): Promise<InsumoEstoque> {
    garantirSemNulos(dto);
    await this.buscar(id);
    if (dto.nomeItem !== undefined) await this.garantirNomeLivre(dto.nomeItem, id);
    const alterou = await this.db.transaction(async (tx) => {
      const ok = await this.repo.update(id, { ...dto }, tx);
      // Mudar o estoque mínimo pode abrir ou resolver um alerta
      if (ok) await this.repo.sincronizarAlertas([id], tx);
      return ok;
    });
    if (!alterou) throw new BadRequestError('Informe ao menos um campo para atualizar');
    return this.buscar(id);
  }

  async remover(id: number): Promise<void> {
    await this.buscar(id);
    const uso = await this.repo.emUso(id);
    if (uso.fichas > 0 || uso.movimentacoes > 0) {
      throw new ConflictError('Insumo usado em fichas técnicas ou com histórico de estoque não pode ser excluído', uso);
    }
    await this.repo.delete(id);
  }

  /** Registra a compra de mais insumo: o saldo sobe e o alerta é resolvido se passar do mínimo. */
  async repor(id: number, dto: ReposicaoDto): Promise<InsumoEstoque> {
    await this.buscar(id);
    await this.db.transaction((tx) => this.estoque.entrada([{ insumoId: id, quantidade: dto.quantidade }], 'REPOSICAO', tx));
    return this.buscar(id);
  }

  movimentacoes(filtro: FiltroMovimentacoes): Promise<MovimentacaoEstoque[]> {
    return this.repo.findMovimentacoes(filtro);
  }

  alertas(resolvido?: boolean): Promise<AlertaEstoque[]> {
    return this.repo.findAlertas(resolvido);
  }

  async resolverAlerta(id: number): Promise<AlertaEstoque> {
    const alerta = await this.repo.findAlertaById(id);
    if (!alerta) throw new NotFoundError(`Alerta ${id} não encontrado`);
    if (!alerta.resolvido) await this.repo.resolverAlerta(id);
    return { ...alerta, resolvido: true };
  }

  private async garantirNomeLivre(nome: string, ignorarId?: number): Promise<void> {
    const existente = await this.repo.findByNome(nome);
    if (existente && existente.id !== ignorarId) throw new ConflictError(`Já existe o insumo "${nome}"`);
  }
}
