import { ApiProperty } from '@nestjs/swagger';
import { IsEmail, IsNotEmpty, IsString, Length, Matches, MaxLength } from 'class-validator';
import { TipoUsuario, Usuario } from '../../../domain/entities';

export class RegistroDto {
  @ApiProperty({ example: 'Maria Souza', minLength: 2, maxLength: 100 })
  @IsString()
  @Length(2, 100)
  nome: string;

  @ApiProperty({ example: 'maria@email.com', maxLength: 150 })
  @IsEmail({}, { message: 'email deve ser um e-mail válido' })
  @MaxLength(150)
  email: string;

  @ApiProperty({ example: 'senha123', minLength: 6, maxLength: 72, description: 'Gravada apenas como hash Bcrypt' })
  @IsString()
  @Length(6, 72)
  senha: string;

  @ApiProperty({ example: '92993333333', description: 'Somente números, com DDD (10 ou 11 dígitos)' })
  @Matches(/^\d{10,11}$/, { message: 'telefone deve ter 10 ou 11 dígitos numéricos' })
  telefone: string;
}

export class LoginDto {
  @ApiProperty({ example: 'hudson@email.com' })
  @IsEmail({}, { message: 'email deve ser um e-mail válido' })
  email: string;

  @ApiProperty({ example: 'cliente123' })
  @IsString()
  @IsNotEmpty()
  senha: string;
}

export class UsuarioResponseDto {
  @ApiProperty({ example: 2 }) id: number;
  @ApiProperty({ example: 'Hudson Cliente' }) nome: string;
  @ApiProperty({ example: 'hudson@email.com' }) email: string;
  @ApiProperty({ example: '92992222222' }) telefone: string;
  @ApiProperty({ enum: ['CLIENTE', 'ADMIN'], example: 'CLIENTE' }) tipoUsuario: TipoUsuario;

  /** Nunca expõe o hash da senha. */
  static from(u: Usuario): UsuarioResponseDto {
    return { id: u.id, nome: u.nome, email: u.email, telefone: u.telefone, tipoUsuario: u.tipoUsuario };
  }
}

export class LoginResponseDto {
  @ApiProperty({ example: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...' }) accessToken: string;
  @ApiProperty({ example: 'Bearer' }) tokenType: string;
  @ApiProperty({ type: UsuarioResponseDto }) usuario: UsuarioResponseDto;
}
