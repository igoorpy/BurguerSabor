import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

/** Formato único de erro devolvido pelo HttpErrorFilter. */
export class ErroResponseDto {
  @ApiProperty({ example: 422 })
  statusCode: number;

  @ApiProperty({ example: 'UNPROCESSABLE_ENTITY' })
  error: string;

  @ApiProperty({ example: 'Estoque insuficiente para atender o pedido', oneOf: [{ type: 'string' }, { type: 'array', items: { type: 'string' } }] })
  message: string | string[];

  @ApiPropertyOptional({ example: [{ insumoId: 1, nome: 'Pão Brioche', necessario: 2, disponivel: 1 }] })
  details?: unknown;

  @ApiProperty({ example: '/pedidos' })
  path: string;

  @ApiProperty({ example: '2026-11-04T23:40:00.000Z' })
  timestamp: string;
}
