import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsDateString,
  IsIn,
  IsInt,
  IsOptional,
  IsPositive,
  IsString,
  Max,
  Min,
  MaxLength,
  ValidateNested,
} from 'class-validator';
import {
  Avaliacao,
  FORMAS_PAGAMENTO,
  FormaPagamento,
  Pedido,
  STATUS_PEDIDO,
  StatusPagamento,
  StatusPedido,
} from '../../../domain/entities';
import { multiplicar } from '../../../domain/money';
import { SaidaProduto } from '../pedidos.repository';

export class ItemPedidoDto {
  @ApiProperty({ example: 1 })
  @IsInt() @IsPositive()
  produtoId: number;

  @ApiProperty({ example: 2, minimum: 1, maximum: 50 })
  @IsInt() @IsPositive() @Max(50)
  quantidade: number;

  @ApiPropertyOptional({ example: 'Sem cebola', maxLength: 200 })
  @IsOptional() @IsString() @MaxLength(200)
  observacao?: string;
}

export class CreatePedidoDto {
  @ApiProperty({ example: 1, description: 'Endereço do próprio cliente' })
  @IsInt() @IsPositive()
  enderecoId: number;

  @ApiProperty({ enum: FORMAS_PAGAMENTO, example: 'PIX', description: 'Pagamento simulado (projeto de apresentação)' })
  @IsIn(FORMAS_PAGAMENTO, { message: `formaPagamento deve ser uma de: ${FORMAS_PAGAMENTO.join(', ')}` })
  formaPagamento: FormaPagamento;

  @ApiProperty({ type: [ItemPedidoDto], description: 'Itens do carrinho (1 a 30)' })
  @IsArray() @ArrayMinSize(1, { message: 'o pedido precisa de ao menos 1 item' }) @ArrayMaxSize(30)
  @ValidateNested({ each: true }) @Type(() => ItemPedidoDto)
  itens: ItemPedidoDto[];
}

export class AvaliarPedidoDto {
  @ApiProperty({ example: 5, minimum: 1, maximum: 5, description: 'Nota de 1 a 5' })
  @IsInt() @Min(1) @Max(5)
  nota: number;

  @ApiPropertyOptional({ example: 'Chegou quentinho!', maxLength: 300 })
  @IsOptional() @IsString() @MaxLength(300)
  comentario?: string;
}

export class UpdateStatusDto {
  @ApiProperty({ enum: ['PREPARANDO', 'SAIU_ENTREGA', 'CONCLUIDO'], example: 'PREPARANDO' })
  @IsIn(STATUS_PEDIDO, { message: `status deve ser um de: ${STATUS_PEDIDO.join(', ')}` })
  status: StatusPedido;
}

export class ListPedidosQueryDto {
  @ApiPropertyOptional({ enum: STATUS_PEDIDO })
  @IsOptional() @IsIn(STATUS_PEDIDO)
  status?: StatusPedido;
}

export class RelatorioQueryDto {
  @ApiPropertyOptional({ example: '2026-11-01', description: 'Data inicial (AAAA-MM-DD)' })
  @IsOptional() @IsDateString({ strict: true })
  de?: string;

  @ApiPropertyOptional({ example: '2026-11-30', description: 'Data final, inclusiva (AAAA-MM-DD)' })
  @IsOptional() @IsDateString({ strict: true })
  ate?: string;
}

class ItemPedidoResponseDto {
  @ApiProperty({ example: 1 }) id: number;
  @ApiProperty({ example: 1 }) produtoId: number;
  @ApiProperty({ example: 'Burguer X-Cheddar' }) produtoNome: string;
  @ApiProperty({ example: 2 }) quantidade: number;
  @ApiProperty({ example: 28.5, description: 'Preço do dia da compra' }) precoUnitario: number;
  @ApiProperty({ example: 57, description: 'quantidade × precoUnitario' }) subtotal: number;
  @ApiProperty({ example: 'Sem cebola', nullable: true, type: String }) observacao: string | null;
}

class PagamentoResponseDto {
  @ApiProperty({ enum: FORMAS_PAGAMENTO, example: 'PIX' }) formaPagamento: FormaPagamento;
  @ApiProperty({ enum: ['PENDENTE', 'APROVADO', 'RECUSADO'], example: 'APROVADO' }) statusPagamento: StatusPagamento;
  @ApiProperty({ example: 62 }) valorPago: number;
}

class AvaliacaoResponseDto {
  @ApiProperty({ example: 5 }) nota: number;
  @ApiProperty({ example: 'Chegou quentinho!', nullable: true, type: String }) comentario: string | null;
  @ApiProperty({ example: '2026-11-04T23:40:00.000Z' }) criadoEm: Date;
}

export class PedidoResponseDto {
  @ApiProperty({ example: 1 }) id: number;
  @ApiProperty({ example: 2 }) clienteId: number;
  @ApiProperty({ example: 1 }) enderecoId: number;
  @ApiProperty({ enum: STATUS_PEDIDO, example: 'RECEBIDO' }) status: StatusPedido;
  @ApiProperty({ example: 5 }) taxaEntrega: number;
  @ApiProperty({ example: 62, description: 'Itens + taxa de entrega' }) valorTotal: number;
  @ApiProperty({ example: '2026-11-04T23:40:00.000Z' }) criadoEm: Date;
  @ApiProperty({ type: [ItemPedidoResponseDto] }) itens: ItemPedidoResponseDto[];
  @ApiProperty({ type: PagamentoResponseDto, nullable: true }) pagamento: PagamentoResponseDto | null;
  @ApiProperty({ type: AvaliacaoResponseDto, nullable: true, description: 'Preenchida depois que o cliente avalia' }) avaliacao: Avaliacao | null;

  static from(p: Pedido): PedidoResponseDto {
    return {
      ...p,
      itens: p.itens.map((i) => ({ ...i, subtotal: multiplicar(i.precoUnitario, i.quantidade) })),
    };
  }
}

export class SaidaProdutoResponseDto {
  @ApiProperty({ example: 1 }) produtoId: number;
  @ApiProperty({ example: 'Burguer X-Cheddar' }) nome: string;
  @ApiProperty({ example: 12 }) quantidadeVendida: number;
  @ApiProperty({ example: 342 }) faturamento: number;

  static from(s: SaidaProduto): SaidaProdutoResponseDto {
    return { ...s };
  }
}
