import { Injectable } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { ConflictError, NotFoundError, UnauthorizedError } from '../../common/errors';
import { Usuario } from '../../domain/entities';
import { LoginDto, RegistroDto } from './dto/auth.dto';
import { UsuariosRepository } from './usuarios.repository';

const BCRYPT_ROUNDS = 10;

@Injectable()
export class AuthService {
  constructor(
    private readonly usuarios: UsuariosRepository,
    private readonly jwt: JwtService,
  ) {}

  /** Cadastro público: sempre cria perfil CLIENTE (admin não se auto-cadastra). */
  async registrar(dto: RegistroDto): Promise<Usuario> {
    if (await this.usuarios.findByEmail(dto.email)) {
      throw new ConflictError('Já existe uma conta com este e-mail');
    }
    const senhaHash = await bcrypt.hash(dto.senha, BCRYPT_ROUNDS); // RNF01: hash com salt
    return this.usuarios.create({ ...dto, senhaHash, tipoUsuario: 'CLIENTE' });
  }

  async login(dto: LoginDto): Promise<{ accessToken: string; usuario: Usuario }> {
    const usuario = await this.usuarios.findByEmail(dto.email);
    // Mesma mensagem para e-mail inexistente e senha errada: não revela quais e-mails existem
    if (!usuario || !(await bcrypt.compare(dto.senha, usuario.senhaHash))) {
      throw new UnauthorizedError('E-mail ou senha inválidos');
    }
    const accessToken = await this.jwt.signAsync({
      sub: usuario.id,
      email: usuario.email,
      tipoUsuario: usuario.tipoUsuario,
    });
    return { accessToken, usuario };
  }

  async perfil(id: number): Promise<Usuario> {
    const usuario = await this.usuarios.findById(id);
    if (!usuario) throw new NotFoundError('Usuário não encontrado');
    return usuario;
  }
}
