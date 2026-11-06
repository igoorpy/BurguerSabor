import { ApiProperty, ApiPropertyOptional, PartialType } from '@nestjs/swagger';
import { IsNotEmpty, IsOptional, IsString, Matches, MaxLength } from 'class-validator';
import { Endereco } from '../../../domain/entities';

export class CreateEnderecoDto {
  @ApiProperty({ example: 'Av. Djalma Batista', maxLength: 150 })
  @IsString() @IsNotEmpty() @MaxLength(150)
  rua: string;

  @ApiProperty({ example: '1200', maxLength: 20 })
  @IsString() @IsNotEmpty() @MaxLength(20)
  numero: string;

  @ApiProperty({ example: 'Chapada', maxLength: 100 })
  @IsString() @IsNotEmpty() @MaxLength(100)
  bairro: string;

  @ApiProperty({ example: '69050-010', description: 'Formato 00000-000' })
  @Matches(/^\d{5}-\d{3}$/, { message: 'cep deve estar no formato 00000-000' })
  cep: string;

  @ApiPropertyOptional({ example: 'Em frente ao shopping', maxLength: 150 })
  @IsOptional() @IsString() @MaxLength(150)
  pontoReferencia?: string;
}

export class UpdateEnderecoDto extends PartialType(CreateEnderecoDto) {}

export class EnderecoResponseDto {
  @ApiProperty({ example: 1 }) id: number;
  @ApiProperty({ example: 2 }) usuarioId: number;
  @ApiProperty({ example: 'Av. Principal' }) rua: string;
  @ApiProperty({ example: '100' }) numero: string;
  @ApiProperty({ example: 'Centro' }) bairro: string;
  @ApiProperty({ example: '69000-000' }) cep: string;
  @ApiProperty({ example: 'Próximo à Praça', nullable: true, type: String }) pontoReferencia: string | null;

  static from(e: Endereco): EnderecoResponseDto {
    return { ...e };
  }
}
