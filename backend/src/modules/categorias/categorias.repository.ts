import { Injectable } from '@nestjs/common';
import { DatabaseService } from '../../database/database.service';
import { buildUpdate } from '../../database/sql.util';
import { Categoria } from '../../domain/entities';

type CategoriaRow = {
  id: number;
  nome: string;
  ordem_exibicao: number;
  ativo: boolean;
}

const toCategoria = (r: CategoriaRow): Categoria => ({
  id: r.id,
  nome: r.nome,
  ordemExibicao: r.ordem_exibicao,
  ativo: r.ativo,
});

const COLUNAS = { nome: 'nome', ordemExibicao: 'ordem_exibicao', ativo: 'ativo' };

@Injectable()
export class CategoriasRepository {
  constructor(private readonly db: DatabaseService) {}

  async findAll(somenteAtivas: boolean): Promise<Categoria[]> {
    const { rows } = await this.db.query<CategoriaRow>(
      `SELECT * FROM categorias WHERE ($1::boolean = FALSE OR ativo = TRUE) ORDER BY ordem_exibicao, nome`,
      [somenteAtivas],
    );
    return rows.map(toCategoria);
  }

  async findById(id: number): Promise<Categoria | null> {
    const { rows } = await this.db.query<CategoriaRow>('SELECT * FROM categorias WHERE id = $1', [id]);
    return rows[0] ? toCategoria(rows[0]) : null;
  }

  async findByNome(nome: string): Promise<Categoria | null> {
    const { rows } = await this.db.query<CategoriaRow>('SELECT * FROM categorias WHERE LOWER(nome) = LOWER($1)', [nome]);
    return rows[0] ? toCategoria(rows[0]) : null;
  }

  async create(data: { nome: string; ordemExibicao: number; ativo: boolean }): Promise<Categoria> {
    const { rows } = await this.db.query<CategoriaRow>(
      'INSERT INTO categorias (nome, ordem_exibicao, ativo) VALUES ($1, $2, $3) RETURNING *',
      [data.nome, data.ordemExibicao, data.ativo],
    );
    return toCategoria(rows[0]);
  }

  async update(id: number, changes: Partial<Categoria>): Promise<boolean> {
    const sql = buildUpdate('categorias', COLUNAS, changes, id);
    if (!sql) return false;
    await this.db.query(sql.text, sql.params);
    return true;
  }

  async delete(id: number): Promise<void> {
    await this.db.query('DELETE FROM categorias WHERE id = $1', [id]);
  }

  async contarProdutos(id: number): Promise<number> {
    const { rows } = await this.db.query<{ total: string }>('SELECT COUNT(*) AS total FROM produtos WHERE categoria_id = $1', [id]);
    return Number(rows[0].total);
  }
}
