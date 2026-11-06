import { Injectable } from '@nestjs/common';
import { garantirSemNulos } from '../../common/dto/sem-nulos';
import { BadRequestError, ConflictError, NotFoundError } from '../../common/errors';
import { Endereco } from '../../domain/entities';
import { CreateEnderecoDto, UpdateEnderecoDto } from './dto/endereco.dto';
import { EnderecosRepository } from './enderecos.repository';

/** RF02 — cada cliente gerencia apenas os próprios endereços (1:N). */
@Injectable()
export class EnderecosService {
  constructor(private readonly repo: EnderecosRepository) {}

  listar(usuarioId: number): Promise<Endereco[]> {
    return this.repo.findByUsuario(usuarioId);
  }

  /** Endereço de outro cliente responde 404, para não revelar que ele existe. */
  async buscar(usuarioId: number, id: number): Promise<Endereco> {
    const endereco = await this.repo.findById(id);
    if (!endereco || endereco.usuarioId !== usuarioId) throw new NotFoundError(`Endereço ${id} não encontrado`);
    return endereco;
  }

  criar(usuarioId: number, dto: CreateEnderecoDto): Promise<Endereco> {
    return this.repo.create(usuarioId, { ...dto, pontoReferencia: dto.pontoReferencia ?? null });
  }

  async atualizar(usuarioId: number, id: number, dto: UpdateEnderecoDto): Promise<Endereco> {
    garantirSemNulos(dto, ['pontoReferencia']);
    await this.buscar(usuarioId, id);
    if (!(await this.repo.update(id, dto))) throw new BadRequestError('Informe ao menos um campo para atualizar');
    return this.buscar(usuarioId, id);
  }

  async remover(usuarioId: number, id: number): Promise<void> {
    await this.buscar(usuarioId, id);
    if (await this.repo.usadoEmPedido(id)) {
      throw new ConflictError('Endereço já usado em pedidos e não pode ser excluído');
    }
    await this.repo.delete(id);
  }
}
