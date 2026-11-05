import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { APP_GUARD } from '@nestjs/core';
import { JwtModule } from '@nestjs/jwt';
import { AuthGuard } from './common/auth/auth.guard';
import { DatabaseModule } from './database/database.module';
import { AuthModule } from './modules/auth/auth.module';
import { CategoriasModule } from './modules/categorias/categorias.module';
import { EnderecosModule } from './modules/enderecos/enderecos.module';
import { InsumosModule } from './modules/insumos/insumos.module';
import { PedidosModule } from './modules/pedidos/pedidos.module';
import { ProdutosModule } from './modules/produtos/produtos.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    JwtModule.registerAsync({
      global: true,
      inject: [ConfigService],
      useFactory: (config: ConfigService) => {
        const secret = config.get<string>('JWT_SECRET');
        // Com o segredo de exemplo (público no .env.example), qualquer pessoa poderia forjar um token de admin
        if (!secret || secret === 'troque-este-segredo' || secret.length < 16) {
          throw new Error('Defina JWT_SECRET no arquivo .env com um valor aleatório de pelo menos 16 caracteres.');
        }
        return {
          secret,
          signOptions: { expiresIn: Number(config.get<string>('JWT_EXPIRES_IN_SECONDS') ?? 28_800) }, // padrão: 8 horas
        };
      },
    }),
    DatabaseModule,
    AuthModule,
    EnderecosModule,
    CategoriasModule,
    ProdutosModule,
    InsumosModule,
    PedidosModule,
  ],
  providers: [{ provide: APP_GUARD, useClass: AuthGuard }],
})
export class AppModule {}
