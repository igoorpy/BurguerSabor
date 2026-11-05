import { Module } from '@nestjs/common';
import { EnderecosModule } from '../enderecos/enderecos.module';
import { InsumosModule } from '../insumos/insumos.module';
import { ProdutosModule } from '../produtos/produtos.module';
import { PedidosController, RelatoriosController } from './pedidos.controller';
import { PedidosRepository } from './pedidos.repository';
import { PedidosService } from './pedidos.service';

@Module({
  imports: [ProdutosModule, EnderecosModule, InsumosModule],
  controllers: [PedidosController, RelatoriosController],
  providers: [PedidosService, PedidosRepository],
})
export class PedidosModule {}
