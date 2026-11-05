import { ArgumentsHost, Catch, ExceptionFilter, HttpException, HttpStatus, Logger } from '@nestjs/common';
import { Request, Response } from 'express';
import { DomainError } from './errors';

interface PgError {
  code: string;
  detail?: string;
  constraint?: string;
}

const isPgError = (error: unknown): error is PgError =>
  typeof error === 'object' &&
  error !== null &&
  typeof (error as PgError).code === 'string' &&
  /^[0-9A-Z]{5}$/.test((error as PgError).code);

/** Tratamento centralizado de erros: toda resposta de erro sai no mesmo formato JSON. */
@Catch()
export class HttpErrorFilter implements ExceptionFilter {
  private readonly logger = new Logger(HttpErrorFilter.name);

  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    const { status, message, details } = this.resolve(exception);

    response.status(status).json({
      statusCode: status,
      error: HttpStatus[status] ?? 'Error',
      message,
      ...(details !== undefined ? { details } : {}),
      path: request.url,
      timestamp: new Date().toISOString(),
    });
  }

  private resolve(exception: unknown): { status: number; message: string | string[]; details?: unknown } {
    if (exception instanceof DomainError) {
      return { status: exception.status, message: exception.message, details: exception.details };
    }

    if (exception instanceof HttpException) {
      const body = exception.getResponse();
      const message =
        typeof body === 'object' && body !== null && 'message' in body
          ? (body as { message: string | string[] }).message
          : exception.message;
      return { status: exception.getStatus(), message };
    }

    // Erros do PostgreSQL que escaparam das validações do Service.
    // O texto interno do banco (exception.detail) não é repassado ao cliente.
    if (isPgError(exception)) {
      switch (exception.code) {
        case '23505':
          return { status: 409, message: 'Registro duplicado' };
        case '23503':
          return { status: 409, message: 'Operação bloqueada por registros relacionados' };
        case '23502':
          return { status: 422, message: 'Campo obrigatório não pode ficar vazio' };
        case '23514':
          return { status: 422, message: 'Valor viola uma regra do banco de dados' };
        case '22P02':
        case '22003':
          return { status: 400, message: 'Valor em formato inválido' };
      }
    }

    this.logger.error(exception instanceof Error ? exception.stack : String(exception));
    return { status: 500, message: 'Erro interno do servidor' };
  }
}
