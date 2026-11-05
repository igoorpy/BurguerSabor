import { Module } from '@nestjs/common';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { UsuariosRepository } from './usuarios.repository';

@Module({
  controllers: [AuthController],
  providers: [AuthService, UsuariosRepository],
  exports: [UsuariosRepository],
})
export class AuthModule {}
