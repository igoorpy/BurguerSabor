import { Module } from '@nestjs/common';
import { CategoriasModule } from '../categorias/categorias.module';
import { InsumosModule } from '../insumos/insumos.module';
import { ProdutosController } from './produtos.controller';
import { ProdutosRepository } from './produtos.repository';
import { ProdutosService } from './produtos.service';

@Module({
  imports: [CategoriasModule, InsumosModule],
  controllers: [ProdutosController],
  providers: [ProdutosService, ProdutosRepository],
  exports: [ProdutosRepository],
})
export class ProdutosModule {}
