import { ApiProperty, ApiPropertyOptional, OmitType, PartialType } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsBoolean, IsIn, IsInt, IsNotEmpty, IsNumber, IsOptional, IsPositive, IsString, Max, MaxLength, Min } from 'class-validator';
import { ToBoolean } from '../../../common/dto/query.transforms';
import {
  AlertaEstoque,
  InsumoEstoque,
  MotivoMovimentacao,
  MovimentacaoEstoque,
  TipoMovimentacao,
  UNIDADES_MEDIDA,
  UnidadeMedida,
} from '../../../domain/entities';

export class CreateInsumoDto {
  @ApiProperty({ example: 'Cebola Roxa', maxLength: 100 })
  @IsString() @IsNotEmpty() @MaxLength(100)
  nomeItem: string;

  @ApiProperty({ enum: UNIDADES_MEDIDA, example: 'KG' })
  @IsIn(UNIDADES_MEDIDA, { message: `unidadeMedida deve ser uma de: ${UNIDADES_MEDIDA.join(', ')}` })
  unidadeMedida: UnidadeMedida;

  @ApiProperty({ example: 5, description: 'Saldo inicial (não pode ser negativo — RN01)' })
  @IsNumber({ maxDecimalPlaces: 2 }) @Min(0) @Max(99_999_999)
  quantidadeDisponivel: number;

  @ApiProperty({ example: 6.5, description: 'Quanto a loja paga por unidade de medida' })
  @IsNumber({ maxDecimalPlaces: 2 }) @IsPositive({ message: 'precoCusto deve ser maior que zero' })
  precoCusto: number;

  @ApiProperty({ example: 1, description: 'Ao chegar neste saldo, o admin recebe um alerta de reposição' })
  @IsNumber({ maxDecimalPlaces: 2 }) @Min(0)
  estoqueMinimo: number;
}

/** O saldo não é editável diretamente: muda só por reposição, pedido ou cancelamento (fica no extrato). */
export class UpdateInsumoDto extends PartialType(OmitType(CreateInsumoDto, ['quantidadeDisponivel'] as const)) {}

export class ReposicaoDto {
  @ApiProperty({ example: 30, description: 'Quantidade que entrou no estoque' })
  @IsNumber({ maxDecimalPlaces: 2 }) @IsPositive({ message: 'quantidade deve ser maior que zero' }) @Max(99_999_999)
  quantidade: number;
}

export class ListInsumosQueryDto {
  @ApiPropertyOptional({ example: true, description: 'true = só os que chegaram no estoque mínimo' })
  @IsOptional() @ToBoolean() @IsBoolean()
  abaixoDoMinimo?: boolean;
}

export class ListMovimentacoesQueryDto {
  @ApiPropertyOptional({ example: 1 })
  @IsOptional() @Type(() => Number) @IsInt() @IsPositive()
  insumoId?: number;

  @ApiPropertyOptional({ example: 1, description: 'O que foi descontado do estoque por um pedido' })
  @IsOptional() @Type(() => Number) @IsInt() @IsPositive()
  pedidoId?: number;

  @ApiPropertyOptional({ enum: ['ENTRADA', 'SAIDA'] })
  @IsOptional() @IsIn(['ENTRADA', 'SAIDA'])
  tipo?: TipoMovimentacao;
}

export class ListAlertasQueryDto {
  @ApiPropertyOptional({ example: false, description: 'false = só alertas em aberto' })
  @IsOptional() @ToBoolean() @IsBoolean()
  resolvido?: boolean;
}

export class InsumoResponseDto {
  @ApiProperty({ example: 1 }) id: number;
  @ApiProperty({ example: 'Pão Brioche' }) nomeItem: string;
  @ApiProperty({ enum: UNIDADES_MEDIDA, example: 'UN' }) unidadeMedida: UnidadeMedida;
  @ApiProperty({ example: 50 }) quantidadeDisponivel: number;
  @ApiProperty({ example: 1.5 }) precoCusto: number;
  @ApiProperty({ example: 10 }) estoqueMinimo: number;
  @ApiProperty({ example: false, description: 'Saldo no estoque mínimo ou abaixo' }) precisaRepor: boolean;

  static from(i: InsumoEstoque): InsumoResponseDto {
    return { ...i, precisaRepor: i.quantidadeDisponivel <= i.estoqueMinimo };
  }
}

export class MovimentacaoResponseDto {
  @ApiProperty({ example: 1 }) id: number;
  @ApiProperty({ example: 1 }) insumoId: number;
  @ApiProperty({ example: 'Pão Brioche' }) nomeItem: string;
  @ApiProperty({ enum: ['ENTRADA', 'SAIDA'], example: 'SAIDA' }) tipo: TipoMovimentacao;
  @ApiProperty({ enum: ['PEDIDO', 'CANCELAMENTO', 'REPOSICAO', 'CADASTRO'], example: 'PEDIDO' }) motivo: MotivoMovimentacao;
  @ApiProperty({ example: 2 }) quantidade: number;
  @ApiProperty({ example: 1, nullable: true, type: Number }) pedidoId: number | null;
  @ApiProperty({ example: '2026-11-04T23:40:00.000Z' }) criadoEm: Date;

  static from(m: MovimentacaoEstoque): MovimentacaoResponseDto {
    return { ...m };
  }
}

export class AlertaResponseDto {
  @ApiProperty({ example: 1 }) id: number;
  @ApiProperty({ example: 1 }) insumoId: number;
  @ApiProperty({ example: 'Pão Brioche' }) nomeItem: string;
  @ApiProperty({ enum: UNIDADES_MEDIDA, example: 'UN' }) unidadeMedida: UnidadeMedida;
  @ApiProperty({ example: 9, description: 'Saldo no momento do alerta' }) saldo: number;
  @ApiProperty({ example: 10 }) estoqueMinimo: number;
  @ApiProperty({ example: false }) resolvido: boolean;
  @ApiProperty({ example: '2026-11-04T23:40:00.000Z' }) criadoEm: Date;
  @ApiProperty({ example: 'Pão Brioche está acabando: restam 9 UN (mínimo 10)' }) mensagem: string;

  static from(a: AlertaEstoque): AlertaResponseDto {
    return {
      ...a,
      mensagem: `${a.nomeItem} está acabando: restam ${a.saldo} ${a.unidadeMedida} (mínimo ${a.estoqueMinimo})`,
    };
  }
}
