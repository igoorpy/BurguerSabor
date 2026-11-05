import { Injectable } from '@nestjs/common';
import { garantirSemNulos } from '../../common/dto/sem-nulos';
import { BadRequestError, BusinessRuleError, ConflictError, NotFoundError } from '../../common/errors';
import { DatabaseService } from '../../database/database.service';
import { ItemFichaTecnica, Produto } from '../../domain/entities';
import { calcularCusto, CustoProduto } from '../../domain/produto.rules';
import { CategoriasService } from '../categorias/categorias.service';
import { InsumosRepository } from '../insumos/insumos.repository';
import { CreateProdutoDto, ItemFichaDto, UpdateProdutoDto } from './dto/produto.dto';
import { FiltroProdutos, ProdutosRepository } from './produtos.repository';

@Injectable()
export class ProdutosService {
  constructor(
    private readonly db: DatabaseService,
    private readonly repo: ProdutosRepository,
    private readonly categorias: CategoriasService,
    private readonly insumos: InsumosRepository,
  ) {}

  listar(filtro: FiltroProdutos): Promise<Produto[]> {
    return this.repo.findAll(filtro);
  }

  async buscar(id: number): Promise<Produto> {
    const produto = await this.repo.findById(id);
    if (!produto) throw new NotFoundError(`Produto ${id} não encontrado`);
    return produto;
  }

  async criar(dto: CreateProdutoDto): Promise<Produto> {
    await this.garantirCategoria(dto.categoriaId);
    const id = await this.repo.create({
      categoriaId: dto.categoriaId,
      nome: dto.nome,
      descricao: dto.descricao ?? null,
      preco: dto.preco,
      imagemUrl: dto.imagemUrl ?? null,
      disponivel: dto.disponivel ?? true,
    });
    return this.buscar(id);
  }

  async atualizar(id: number, dto: UpdateProdutoDto): Promise<Produto> {
    garantirSemNulos(dto, ['descricao', 'imagemUrl']);
    await this.buscar(id);
    if (dto.categoriaId !== undefined) await this.garantirCategoria(dto.categoriaId);
    if (!(await this.repo.update(id, { ...dto }))) throw new BadRequestError('Informe ao menos um campo para atualizar');
    return this.buscar(id);
  }

  /** Produto que já aparece em pedidos não pode sumir do histórico: use disponivel = false. */
  async remover(id: number): Promise<void> {
    await this.buscar(id);
    if (await this.repo.jaVendido(id)) {
      throw new ConflictError('Produto já vendido não pode ser excluído; marque-o como indisponível');
    }
    await this.repo.delete(id);
  }

  async fichaTecnica(id: number): Promise<ItemFichaTecnica[]> {
    await this.buscar(id);
    return this.repo.findFicha([id]);
  }

  /** RF04 — define a ficha técnica (N:N produto × insumo) de uma vez, de forma atômica. */
  async substituirFicha(id: number, itens: ItemFichaDto[]): Promise<ItemFichaTecnica[]> {
    await this.buscar(id);
    const ids = itens.map((i) => i.insumoId);
    if (new Set(ids).size !== ids.length) {
      throw new BusinessRuleError('Cada insumo pode aparecer apenas uma vez na ficha técnica');
    }
    const encontrados = await this.insumos.findManyByIds(ids);
    const inexistentes = ids.filter((insumoId) => !encontrados.some((e) => e.id === insumoId));
    if (inexistentes.length) {
      throw new BusinessRuleError('Insumo(s) inexistente(s) na ficha técnica', { insumoIds: inexistentes });
    }
    await this.db.transaction((tx) => this.repo.replaceFicha(id, itens, tx));
    return this.repo.findFicha([id]);
  }

  async custo(id: number): Promise<{ produto: Produto; custo: CustoProduto }> {
    const produto = await this.buscar(id);
    const ficha = await this.repo.findFicha([id]);
    return { produto, custo: calcularCusto(produto.preco, ficha) };
  }

  private async garantirCategoria(categoriaId: number): Promise<void> {
    try {
      await this.categorias.buscar(categoriaId);
    } catch (error) {
      if (error instanceof NotFoundError) {
        throw new BusinessRuleError(`Categoria ${categoriaId} não existe`, { categoriaId });
      }
      throw error;
    }
  }
}
