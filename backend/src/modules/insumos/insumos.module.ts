import { Module } from '@nestjs/common';
import { AlertasController, InsumosController, MovimentacoesController } from './insumos.controller';
import { EstoqueService } from './estoque.service';
import { InsumosRepository } from './insumos.repository';
import { InsumosService } from './insumos.service';

@Module({
  controllers: [InsumosController, MovimentacoesController, AlertasController],
  providers: [InsumosService, InsumosRepository, EstoqueService],
  exports: [InsumosRepository, EstoqueService],
})
export class InsumosModule {}
