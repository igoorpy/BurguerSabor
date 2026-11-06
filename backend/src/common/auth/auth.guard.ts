import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { JwtService } from '@nestjs/jwt';
import { Request } from 'express';
import { ForbiddenError, UnauthorizedError } from '../errors';
import { IS_PUBLIC_KEY, ROLES_KEY, TipoUsuario, UsuarioAutenticado } from './auth.decorators';

interface JwtPayload {
  sub: number;
  email: string;
  tipoUsuario: TipoUsuario;
}

/** Guard global: exige token válido, exceto em rotas @Public, e confere o perfil exigido por @Roles. */
@Injectable()
export class AuthGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly jwt: JwtService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const targets = [context.getHandler(), context.getClass()];
    if (this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, targets)) return true;

    const request = context.switchToHttp().getRequest<Request & { user?: UsuarioAutenticado }>();
    const [scheme, token] = (request.headers.authorization ?? '').split(' ');
    if (scheme !== 'Bearer' || !token) throw new UnauthorizedError('Token de acesso ausente');

    let payload: JwtPayload;
    try {
      payload = await this.jwt.verifyAsync<JwtPayload>(token);
    } catch {
      throw new UnauthorizedError('Token de acesso inválido ou expirado');
    }
    request.user = { id: payload.sub, email: payload.email, tipoUsuario: payload.tipoUsuario };

    const roles = this.reflector.getAllAndOverride<TipoUsuario[] | undefined>(ROLES_KEY, targets);
    if (roles && !roles.includes(payload.tipoUsuario)) {
      throw new ForbiddenError('Seu perfil não tem permissão para esta operação');
    }
    return true;
  }
}
