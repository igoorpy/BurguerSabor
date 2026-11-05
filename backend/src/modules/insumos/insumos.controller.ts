import { applyDecorators, Body, Controller, Delete, Get, HttpCode, Param, ParseIntPipe, Patch, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { Roles } from '../../common/auth/auth.decorators';
import { ErroResponseDto } from '../../common/dto/erro-response.dto';
import {
  AlertaResponseDto,
  CreateInsumoDto,
  InsumoResponseDto,
  ListAlertasQueryDto,
  ListInsumosQueryDto,
  ListMovimentacoesQueryDto,
  MovimentacaoResponseDto,
  ReposicaoDto,
  UpdateInsumoDto,
} from './dto/insumo.dto';
import { InsumosService } from './insumos.service';

/** Rotas exclusivas do admin: exige token e documenta 401/403 no Swagger. */
const SomenteAdmin = () =>
  applyDecorators(
    Roles('ADMIN'),
    ApiBearerAuth(),
    ApiResponse({ status: 401, description: 'Sem token', type: ErroResponseDto }),
    ApiResponse({ status: 403, description: 'Somente admin', type: ErroResponseDto }),
  );

@ApiTags('Estoque — insumos')
@SomenteAdmin()
@Controller('insumos')
export class InsumosController {
  constructor(private readonly service: InsumosService) {}

  @Get()
  @ApiOperation({ summary: 'Lista os insumos do estoque' })
  @ApiResponse({ status: 200, type: [InsumoResponseDto] })
  async listar(@Query() query: ListInsumosQueryDto): Promise<InsumoResponseDto[]> {
    return (await this.service.listar(query.abaixoDoMinimo ?? false)).map(InsumoResponseDto.from);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Detalha um insumo' })
  @ApiResponse({ status: 200, type: InsumoResponseDto })
  @ApiResponse({ status: 404, type: ErroResponseDto })
  async buscar(@Param('id', ParseIntPipe) id: number): Promise<InsumoResponseDto> {
    return InsumoResponseDto.from(await this.service.buscar(id));
  }

  @Post()
  @ApiOperation({ summary: 'Cadastra um insumo com saldo inicial, custo e estoque mínimo' })
  @ApiResponse({ status: 201, type: InsumoResponseDto })
  @ApiResponse({ status: 409, type: ErroResponseDto })
  @ApiResponse({ status: 422, type: ErroResponseDto })
  async criar(@Body() dto: CreateInsumoDto): Promise<InsumoResponseDto> {
    return InsumoResponseDto.from(await this.service.criar(dto));
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Atualiza nome, unidade, custo ou estoque mínimo (o saldo muda só por movimentação)' })
  @ApiResponse({ status: 200, type: InsumoResponseDto })
  @ApiResponse({ status: 400, type: ErroResponseDto })
  @ApiResponse({ status: 404, type: ErroResponseDto })
  async atualizar(@Param('id', ParseIntPipe) id: number, @Body() dto: UpdateInsumoDto): Promise<InsumoResponseDto> {
    return InsumoResponseDto.from(await this.service.atualizar(id, dto));
  }

  @Delete(':id')
  @HttpCode(204)
  @ApiOperation({ summary: 'Exclui um insumo sem uso em fichas e sem histórico' })
  @ApiResponse({ status: 204, description: 'Excluído' })
  @ApiResponse({ status: 404, type: ErroResponseDto })
  @ApiResponse({ status: 409, type: ErroResponseDto })
  async remover(@Param('id', ParseIntPipe) id: number): Promise<void> {
    await this.service.remover(id);
  }

  @Post(':id/reposicao')
  @ApiOperation({ summary: 'Registra a reposição (entrada) de estoque' })
  @ApiResponse({ status: 201, type: InsumoResponseDto })
  @ApiResponse({ status: 404, type: ErroResponseDto })
  @ApiResponse({ status: 422, type: ErroResponseDto })
  async repor(@Param('id', ParseIntPipe) id: number, @Body() dto: ReposicaoDto): Promise<InsumoResponseDto> {
    return InsumoResponseDto.from(await this.service.repor(id, dto));
  }
}

@ApiTags('Estoque — movimentações')
@SomenteAdmin()
@Controller('movimentacoes')
export class MovimentacoesController {
  constructor(private readonly service: InsumosService) {}

  @Get()
  @ApiOperation({ summary: 'Extrato do estoque: o que entrou e o que saiu (filtre por pedido para ver o que ele descontou)' })
  @ApiResponse({ status: 200, type: [MovimentacaoResponseDto] })
  async listar(@Query() query: ListMovimentacoesQueryDto): Promise<MovimentacaoResponseDto[]> {
    return (await this.service.movimentacoes(query)).map(MovimentacaoResponseDto.from);
  }
}

@ApiTags('Estoque — alertas de reposição')
@SomenteAdmin()
@Controller('alertas')
export class AlertasController {
  constructor(private readonly service: InsumosService) {}

  @Get()
  @ApiOperation({ summary: 'Alertas de insumos que chegaram no estoque mínimo' })
  @ApiResponse({ status: 200, type: [AlertaResponseDto] })
  async listar(@Query() query: ListAlertasQueryDto): Promise<AlertaResponseDto[]> {
    return (await this.service.alertas(query.resolvido)).map(AlertaResponseDto.from);
  }

  @Patch(':id/resolver')
  @ApiOperation({ summary: 'Marca um alerta como resolvido' })
  @ApiResponse({ status: 200, type: AlertaResponseDto })
  @ApiResponse({ status: 404, type: ErroResponseDto })
  async resolver(@Param('id', ParseIntPipe) id: number): Promise<AlertaResponseDto> {
    return AlertaResponseDto.from(await this.service.resolverAlerta(id));
  }
}
