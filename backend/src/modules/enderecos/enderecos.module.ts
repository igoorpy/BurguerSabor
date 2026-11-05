import { Module } from '@nestjs/common';
import { EnderecosController } from './enderecos.controller';
import { EnderecosRepository } from './enderecos.repository';
import { EnderecosService } from './enderecos.service';

@Module({
  controllers: [EnderecosController],
  providers: [EnderecosService, EnderecosRepository],
  exports: [EnderecosRepository],
})
export class EnderecosModule {}
