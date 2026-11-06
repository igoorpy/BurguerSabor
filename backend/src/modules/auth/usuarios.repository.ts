import { Injectable } from '@nestjs/common';
import { DatabaseService, Queryable } from '../../database/database.service';
import { TipoUsuario, Usuario } from '../../domain/entities';

type UsuarioRow = {
  id: number;
  nome: string;
  email: string;
  senha_hash: string;
  telefone: string;
  tipo_usuario: TipoUsuario;
  criado_em: Date;
}

const toUsuario = (r: UsuarioRow): Usuario => ({
  id: r.id,
  nome: r.nome,
  email: r.email,
  senhaHash: r.senha_hash,
  telefone: r.telefone,
  tipoUsuario: r.tipo_usuario,
  criadoEm: r.criado_em,
});

/** Repository: única camada que conhece SQL da tabela usuarios. */
@Injectable()
export class UsuariosRepository {
  constructor(private readonly db: DatabaseService) {}

  async findByEmail(email: string, q: Queryable = this.db): Promise<Usuario | null> {
    const { rows } = await q.query<UsuarioRow>('SELECT * FROM usuarios WHERE LOWER(email) = LOWER($1)', [email]);
    return rows[0] ? toUsuario(rows[0]) : null;
  }

  async findById(id: number, q: Queryable = this.db): Promise<Usuario | null> {
    const { rows } = await q.query<UsuarioRow>('SELECT * FROM usuarios WHERE id = $1', [id]);
    return rows[0] ? toUsuario(rows[0]) : null;
  }

  async create(
    data: { nome: string; email: string; senhaHash: string; telefone: string; tipoUsuario: TipoUsuario },
    q: Queryable = this.db,
  ): Promise<Usuario> {
    const { rows } = await q.query<UsuarioRow>(
      `INSERT INTO usuarios (nome, email, senha_hash, telefone, tipo_usuario)
       VALUES ($1, $2, $3, $4, $5) RETURNING *`,
      [data.nome, data.email.toLowerCase(), data.senhaHash, data.telefone, data.tipoUsuario],
    );
    return toUsuario(rows[0]);
  }
}
