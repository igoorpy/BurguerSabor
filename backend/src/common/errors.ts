/**
 * Erros de domínio: lançados pelos Services sem conhecer HTTP.
 * O filtro global (HttpErrorFilter) traduz cada um para o status HTTP correto.
 */
export abstract class DomainError extends Error {
  abstract readonly status: number;

  constructor(
    message: string,
    public readonly details?: unknown,
  ) {
    super(message);
    this.name = new.target.name;
  }
}

/** 400 — requisição mal formada (ex.: nenhum campo para atualizar). */
export class BadRequestError extends DomainError {
  readonly status = 400;
}

/** 401 — não autenticado ou credenciais inválidas. */
export class UnauthorizedError extends DomainError {
  readonly status = 401;
}

/** 403 — autenticado, mas sem permissão para o recurso. */
export class ForbiddenError extends DomainError {
  readonly status = 403;
}

/** 404 — recurso inexistente (ou que não pertence ao usuário). */
export class NotFoundError extends DomainError {
  readonly status = 404;
}

/** 409 — conflito com o estado atual (duplicado, registro em uso). */
export class ConflictError extends DomainError {
  readonly status = 409;
}

/** 422 — dados válidos no formato, mas que violam uma regra de negócio. */
export class BusinessRuleError extends DomainError {
  readonly status = 422;
}
