import { createParamDecorator, ExecutionContext, SetMetadata } from '@nestjs/common';
import { Request } from 'express';
import { TipoUsuario } from '../../domain/entities';

export type { TipoUsuario };

/** Dados do usuário logado, extraídos do token JWT. */
export interface UsuarioAutenticado {
  id: number;
  email: string;
  tipoUsuario: TipoUsuario;
}

export const IS_PUBLIC_KEY = 'isPublic';
export const ROLES_KEY = 'roles';

/** Rota liberada sem login (ex.: cardápio). */
export const Public = () => SetMetadata(IS_PUBLIC_KEY, true);

/** Restringe a rota a perfis específicos (RBAC — RF01). */
export const Roles = (...roles: TipoUsuario[]) => SetMetadata(ROLES_KEY, roles);

/** Injeta o usuário logado no parâmetro do controller. */
export const CurrentUser = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): UsuarioAutenticado =>
    ctx.switchToHttp().getRequest<Request & { user: UsuarioAutenticado }>().user,
);
