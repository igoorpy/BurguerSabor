import { ApiProperty, ApiPropertyOptional, PartialType } from '@nestjs/swagger';
import { IsBoolean, IsInt, IsNotEmpty, IsOptional, IsString, Max, MaxLength, Min } from 'class-validator';
import { ToBoolean } from '../../../common/dto/query.transforms';
import { Categoria } from '../../../domain/entities';

export class CreateCategoriaDto {
  @ApiProperty({ example: 'Sobremesas', maxLength: 50 })
  @IsString() @IsNotEmpty() @MaxLength(50)
  nome: string;

  @ApiPropertyOptional({ example: 5, minimum: 0, default: 0 })
  @IsOptional() @IsInt() @Min(0) @Max(999)
  ordemExibicao?: number;

  @ApiPropertyOptional({ example: true, default: true })
  @IsOptional() @IsBoolean()
  ativo?: boolean;
}

export class UpdateCategoriaDto extends PartialType(CreateCategoriaDto) {}

export class ListCategoriasQueryDto {
  @ApiPropertyOptional({ description: 'true = só categorias ativas (padrão do app)', example: true })
  @IsOptional() @ToBoolean() @IsBoolean()
  somenteAtivas?: boolean;
}

export class CategoriaResponseDto {
  @ApiProperty({ example: 1 }) id: number;
  @ApiProperty({ example: 'Hambúrgueres' }) nome: string;
  @ApiProperty({ example: 1 }) ordemExibicao: number;
  @ApiProperty({ example: true }) ativo: boolean;

  static from(c: Categoria): CategoriaResponseDto {
    return { ...c };
  }
}
