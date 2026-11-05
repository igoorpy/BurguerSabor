import { Injectable } from '@nestjs/common';
import { garantirSemNulos } from '../../common/dto/sem-nulos';
import { BadRequestError, ConflictError, NotFoundError } from '../../common/errors';
import { Categoria } from '../../domain/entities';
import { CategoriasRepository } from './categorias.repository';
import { CreateCategoriaDto, UpdateCategoriaDto } from './dto/categoria.dto';

@Injectable()
export class CategoriasService {
  constructor(private readonly repo: CategoriasRepository) {}

  listar(somenteAtivas = false): Promise<Categoria[]> {
    return this.repo.findAll(somenteAtivas);
  }

  async buscar(id: number): Promise<Categoria> {
    const categoria = await this.repo.findById(id);
    if (!categoria) throw new NotFoundError(`Categoria ${id} não encontrada`);
    return categoria;
  }

  async criar(dto: CreateCategoriaDto): Promise<Categoria> {
    await this.garantirNomeLivre(dto.nome);
    return this.repo.create({ nome: dto.nome, ordemExibicao: dto.ordemExibicao ?? 0, ativo: dto.ativo ?? true });
  }

  async atualizar(id: number, dto: UpdateCategoriaDto): Promise<Categoria> {
    garantirSemNulos(dto);
    await this.buscar(id);
    if (dto.nome !== undefined) await this.garantirNomeLivre(dto.nome, id);
    if (!(await this.repo.update(id, dto))) throw new BadRequestError('Informe ao menos um campo para atualizar');
    return this.buscar(id);
  }

  /** RN03 / CT-CAT-003 — categoria com produtos não pode ser excluída (o FK ON DELETE RESTRICT também bloqueia). */
  async remover(id: number): Promise<void> {
    await this.buscar(id);
    const produtos = await this.repo.contarProdutos(id);
    if (produtos > 0) {
      throw new ConflictError(`Categoria possui ${produtos} produto(s) vinculado(s) e não pode ser excluída`, { produtos });
    }
    await this.repo.delete(id);
  }

  private async garantirNomeLivre(nome: string, ignorarId?: number): Promise<void> {
    const existente = await this.repo.findByNome(nome);
    if (existente && existente.id !== ignorarId) throw new ConflictError(`Já existe a categoria "${nome}"`);
  }
}
