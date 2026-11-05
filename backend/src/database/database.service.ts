import { Injectable, Logger, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Pool, PoolClient, QueryResult, QueryResultRow } from 'pg';

/**
 * Qualquer objeto capaz de executar SQL parametrizado:
 * o próprio pool ou um cliente dentro de uma transação.
 * Os repositórios recebem um Queryable para funcionarem dentro e fora de transações.
 */
export interface Queryable {
  query<T extends QueryResultRow = QueryResultRow>(text: string, params?: unknown[]): Promise<QueryResult<T>>;
}

@Injectable()
export class DatabaseService implements Queryable, OnModuleDestroy {
  private readonly logger = new Logger(DatabaseService.name);
  private readonly pool: Pool;

  constructor(config: ConfigService) {
    this.pool = new Pool({
      connectionString: config.get<string>('DATABASE_URL'),
      max: Number(config.get<string>('DB_POOL_MAX') ?? 10),
      idleTimeoutMillis: 30_000,
      connectionTimeoutMillis: 5_000,
    });
    this.pool.on('error', (err) => this.logger.error(`Erro inesperado no pool: ${err.message}`));
  }

  /** Sempre usa parâmetros ($1, $2...) — o driver envia os valores separados do SQL (anti-SQL Injection). */
  query<T extends QueryResultRow = QueryResultRow>(text: string, params: unknown[] = []): Promise<QueryResult<T>> {
    return this.pool.query<T>(text, params);
  }

  /** Executa o bloco inteiro em uma transação atômica: COMMIT se tudo der certo, ROLLBACK em qualquer erro (RNF03). */
  async transaction<T>(work: (tx: Queryable) => Promise<T>): Promise<T> {
    const client: PoolClient = await this.pool.connect();
    const tx: Queryable = {
      query: <R extends QueryResultRow = QueryResultRow>(text: string, params: unknown[] = []) =>
        client.query<R>(text, params),
    };
    let conexaoQuebrada: Error | undefined;
    try {
      await client.query('BEGIN');
      const result = await work(tx);
      await client.query('COMMIT');
      return result;
    } catch (error) {
      try {
        await client.query('ROLLBACK');
      } catch (rollbackError) {
        // Conexão caiu: descarta o client do pool, mas devolve o erro ORIGINAL a quem chamou
        conexaoQuebrada = rollbackError as Error;
        this.logger.error(`Falha no ROLLBACK: ${conexaoQuebrada.message}`);
      }
      throw error;
    } finally {
      client.release(conexaoQuebrada);
    }
  }

  async onModuleDestroy(): Promise<void> {
    await this.pool.end();
  }
}
