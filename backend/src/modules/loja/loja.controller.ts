import { Controller, Get } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiProperty, ApiResponse, ApiTags } from '@nestjs/swagger';
import { Public, Roles } from '../../common/auth/auth.decorators';
import { ErroResponseDto } from '../../common/dto/erro-response.dto';
import { LojaService } from './loja.service';

class LojaResponseDto {
  @ApiProperty({ example: 'Burguer & Sabor' }) nome: string;
  @ApiProperty({ example: 5 }) taxaEntrega: number;
  @ApiProperty({ example: 30, description: 'Minutos' }) tempoEntregaMin: number;
  @ApiProperty({ example: 45, description: 'Minutos' }) tempoEntregaMax: number;
  @ApiProperty({ example: 4.8, nullable: true, type: Number, description: 'Média das avaliações (null se ainda não há)' }) notaMedia: number | null;
  @ApiProperty({ example: 12 }) totalAvaliacoes: number;
}

class AvaliacaoAdminDto {
  @ApiProperty({ example: 1 }) pedidoId: number;
  @ApiProperty({ example: 'Hudson Cliente' }) clienteNome: string;
  @ApiProperty({ example: 5 }) nota: number;
  @ApiProperty({ example: 'Chegou quentinho!', nullable: true, type: String }) comentario: string | null;
  @ApiProperty({ example: '2026-11-04T23:40:00.000Z' }) criadoEm: Date;
}

@ApiTags('Loja')
@Controller()
export class LojaController {
  constructor(private readonly service: LojaService) {}

  @Public()
  @Get('loja')
  @ApiOperation({ summary: 'Dados do topo da loja: taxa e tempo de entrega e nota média' })
  @ApiResponse({ status: 200, type: LojaResponseDto })
  dados(): Promise<LojaResponseDto> {
    return this.service.dados();
  }

  @Roles('ADMIN')
  @ApiBearerAuth()
  @Get('avaliacoes')
  @ApiOperation({ summary: 'Avaliações dos clientes, das mais recentes para as mais antigas (admin)' })
  @ApiResponse({ status: 200, type: [AvaliacaoAdminDto] })
  @ApiResponse({ status: 401, type: ErroResponseDto })
  @ApiResponse({ status: 403, type: ErroResponseDto })
  avaliacoes(): Promise<AvaliacaoAdminDto[]> {
    return this.service.avaliacoes();
  }
}
