import { Injectable } from '@nestjs/common';
import { DatabaseService, Queryable } from '../../database/database.service';
import { buildUpdate } from '../../database/sql.util';
import { Endereco } from '../../domain/entities';

type EnderecoRow = {
  id: number;
  usuario_id: number;
  rua: string;
  numero: string;
  bairro: string;
  cep: string;
  ponto_referencia: string | null;
}

const toEndereco = (r: EnderecoRow): Endereco => ({
  id: r.id,
  usuarioId: r.usuario_id,
  rua: r.rua,
  numero: r.numero,
  bairro: r.bairro,
  cep: r.cep,
  pontoReferencia: r.ponto_referencia,
});

const COLUNAS = { rua: 'rua', numero: 'numero', bairro: 'bairro', cep: 'cep', pontoReferencia: 'ponto_referencia' };

@Injectable()
export class EnderecosRepository {
  constructor(private readonly db: DatabaseService) {}

  async findByUsuario(usuarioId: number): Promise<Endereco[]> {
    const { rows } = await this.db.query<EnderecoRow>('SELECT * FROM enderecos WHERE usuario_id = $1 ORDER BY id', [usuarioId]);
    return rows.map(toEndereco);
  }

  async findById(id: number, q: Queryable = this.db): Promise<Endereco | null> {
    const { rows } = await q.query<EnderecoRow>('SELECT * FROM enderecos WHERE id = $1', [id]);
    return rows[0] ? toEndereco(rows[0]) : null;
  }

  async create(usuarioId: number, data: Omit<Endereco, 'id' | 'usuarioId'>): Promise<Endereco> {
    const { rows } = await this.db.query<EnderecoRow>(
      `INSERT INTO enderecos (usuario_id, rua, numero, bairro, cep, ponto_referencia)
       VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`,
      [usuarioId, data.rua, data.numero, data.bairro, data.cep, data.pontoReferencia ?? null],
    );
    return toEndereco(rows[0]);
  }

  async update(id: number, changes: Partial<Endereco>): Promise<boolean> {
    const sql = buildUpdate('enderecos', COLUNAS, changes, id);
    if (!sql) return false;
    const { rowCount } = await this.db.query(sql.text, sql.params);
    return (rowCount ?? 0) > 0;
  }

  async delete(id: number): Promise<void> {
    await this.db.query('DELETE FROM enderecos WHERE id = $1', [id]);
  }

  async usadoEmPedido(id: number): Promise<boolean> {
    const { rows } = await this.db.query('SELECT 1 FROM pedidos WHERE endereco_id = $1 LIMIT 1', [id]);
    return rows.length > 0;
  }
}
