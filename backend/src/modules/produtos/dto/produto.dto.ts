import { ApiProperty, ApiPropertyOptional, PartialType } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsBoolean,
  IsInt,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsPositive,
  IsString,
  IsUrl,
  Max,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';
import { ToBoolean } from '../../../common/dto/query.transforms';
import { ItemFichaTecnica, Produto, UnidadeMedida } from '../../../domain/entities';
import { CustoProduto } from '../../../domain/produto.rules';

export class CreateProdutoDto {
  @ApiProperty({ example: 1, description: 'Categoria obrigatória (RF03)' })
  @IsInt() @IsPositive()
  categoriaId: number;

  @ApiProperty({ example: 'Burguer Duplo Cheddar', maxLength: 100 })
  @IsString() @IsNotEmpty() @MaxLength(100)
  nome: string;

  @ApiPropertyOptional({ example: 'Dois blends de 180g e cheddar' })
  @IsOptional() @IsString() @MaxLength(500)
  descricao?: string;

  @ApiProperty({ example: 36.9, description: 'Preço de venda, maior que zero (RN02)' })
  @IsNumber({ maxDecimalPlaces: 2 }) @IsPositive({ message: 'preco deve ser maior que zero' }) @Max(99_999_999)
  preco: number;

  @ApiPropertyOptional({ example: 'https://exemplo.com/duplo.jpg' })
  @IsOptional() @IsUrl() @MaxLength(255)
  imagemUrl?: string;

  @ApiPropertyOptional({ example: true, default: true })
  @IsOptional() @IsBoolean()
  disponivel?: boolean;
}

export class UpdateProdutoDto extends PartialType(CreateProdutoDto) {}

export class ListProdutosQueryDto {
  @ApiPropertyOptional({ example: 1 })
  @IsOptional() @Type(() => Number) @IsInt() @IsPositive()
  categoriaId?: number;

  @ApiPropertyOptional({ example: 'Cheddar', description: 'Filtra por termo no nome ou na descrição (RF10)' })
  @IsOptional() @IsString() @MaxLength(100)
  busca?: string;

  @ApiPropertyOptional({ example: true, description: 'true = só o que pode ser vendido agora (RN04)' })
  @IsOptional() @ToBoolean() @IsBoolean()
  somenteDisponiveis?: boolean;
}

export class ProdutoResponseDto {
  @ApiProperty({ example: 1 }) id: number;
  @ApiProperty({ example: 1 }) categoriaId: number;
  @ApiProperty({ example: 'Hambúrgueres' }) categoriaNome: string;
  @ApiProperty({ example: true, description: 'Categoria ativa no cardápio' }) categoriaAtiva: boolean;
  @ApiProperty({ example: 'Burguer X-Cheddar' }) nome: string;
  @ApiProperty({ example: 'Pão brioche, blend 180g e cheddar duplo', nullable: true, type: String }) descricao: string | null;
  @ApiProperty({ example: 28.5 }) preco: number;
  @ApiProperty({ example: null, nullable: true, type: String }) imagemUrl: string | null;
  @ApiProperty({ example: true, description: 'Marcado pelo admin' }) disponivel: boolean;
  @ApiProperty({ example: true, description: 'Há insumos para ao menos 1 porção' }) temEstoque: boolean;
  @ApiProperty({ example: true, description: 'disponivel E temEstoque E categoria ativa (RN04)' }) disponivelParaVenda: boolean;

  static from(p: Produto): ProdutoResponseDto {
    return { ...p, disponivelParaVenda: p.disponivel && p.temEstoque && p.categoriaAtiva };
  }
}

export class ItemFichaDto {
  @ApiProperty({ example: 1 })
  @IsInt() @IsPositive()
  insumoId: number;

  @ApiProperty({ example: 40, description: 'Quantidade por porção, maior que zero (RN02)' })
  @IsNumber({ maxDecimalPlaces: 2 }) @IsPositive({ message: 'quantidadeNecessaria deve ser maior que zero' }) @Min(0.01)
  quantidadeNecessaria: number;
}

export class ReplaceFichaDto {
  @ApiProperty({ type: [ItemFichaDto], description: 'Lista completa; substitui a ficha atual' })
  @IsArray() @ArrayMaxSize(50) @ValidateNested({ each: true }) @Type(() => ItemFichaDto)
  itens: ItemFichaDto[];
}

export class ItemFichaResponseDto {
  @ApiProperty({ example: 3 }) insumoId: number;
  @ApiProperty({ example: 'Queijo Cheddar Fatiado' }) nomeItem: string;
  @ApiProperty({ example: 'G' }) unidadeMedida: UnidadeMedida;
  @ApiProperty({ example: 40 }) quantidadeNecessaria: number;

  static from(f: ItemFichaTecnica): ItemFichaResponseDto {
    return { insumoId: f.insumoId, nomeItem: f.nomeItem, unidadeMedida: f.unidadeMedida, quantidadeNecessaria: f.quantidadeNecessaria };
  }
}

class ItemCustoDto {
  @ApiProperty({ example: 3 }) insumoId: number;
  @ApiProperty({ example: 'Queijo Cheddar Fatiado' }) nomeItem: string;
  @ApiProperty({ example: 40 }) quantidadeNecessaria: number;
  @ApiProperty({ example: 0.05 }) precoCusto: number;
  @ApiProperty({ example: 2 }) custo: number;
}

export class CustoProdutoResponseDto {
  @ApiProperty({ example: 1 }) produtoId: number;
  @ApiProperty({ example: 'Burguer X-Cheddar' }) nome: string;
  @ApiProperty({ example: 28.5 }) preco: number;
  @ApiProperty({ example: 9.5 }) custo: number;
  @ApiProperty({ example: 19 }) lucro: number;
  @ApiProperty({ example: 66.67 }) margemPercentual: number;
  @ApiProperty({ type: [ItemCustoDto] }) itens: ItemCustoDto[];

  static from(p: Produto, c: CustoProduto): CustoProdutoResponseDto {
    return { produtoId: p.id, nome: p.nome, preco: p.preco, ...c };
  }
}
