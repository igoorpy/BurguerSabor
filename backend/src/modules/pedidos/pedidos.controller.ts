import { Body, Controller, Get, HttpCode, Param, ParseIntPipe, Patch, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { CurrentUser, Roles, UsuarioAutenticado } from '../../common/auth/auth.decorators';
import { ErroResponseDto } from '../../common/dto/erro-response.dto';
import {
  AvaliarPedidoDto,
  CreatePedidoDto,
  ListPedidosQueryDto,
  PedidoResponseDto,
  RelatorioQueryDto,
  SaidaProdutoResponseDto,
  UpdateStatusDto,
} from './dto/pedido.dto';
import { PedidosService } from './pedidos.service';

@ApiTags('Pedidos')
@ApiBearerAuth()
@ApiResponse({ status: 401, description: 'Sem token', type: ErroResponseDto })
@Controller('pedidos')
export class PedidosController {
  constructor(private readonly service: PedidosService) {}

  @Roles('CLIENTE')
  @Post()
  @ApiOperation({ summary: 'Finaliza o carrinho: cria o pedido, o pagamento e dá baixa nos insumos (cliente)' })
  @ApiResponse({ status: 201, type: PedidoResponseDto })
  @ApiResponse({ status: 403, description: 'Somente clientes', type: ErroResponseDto })
  @ApiResponse({ status: 422, description: 'Estoque insuficiente, produto indisponível ou dados inválidos', type: ErroResponseDto })
  async criar(@CurrentUser() user: UsuarioAutenticado, @Body() dto: CreatePedidoDto): Promise<PedidoResponseDto> {
    return PedidoResponseDto.from(await this.service.criar(user, dto));
  }

  @Get()
  @ApiOperation({ summary: 'Lista pedidos: todos para o admin (KDS), só os próprios para o cliente' })
  @ApiResponse({ status: 200, type: [PedidoResponseDto] })
  async listar(@CurrentUser() user: UsuarioAutenticado, @Query() query: ListPedidosQueryDto): Promise<PedidoResponseDto[]> {
    return (await this.service.listar(user, query.status)).map(PedidoResponseDto.from);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Detalha um pedido com itens e pagamento' })
  @ApiResponse({ status: 200, type: PedidoResponseDto })
  @ApiResponse({ status: 404, type: ErroResponseDto })
  async buscar(@CurrentUser() user: UsuarioAutenticado, @Param('id', ParseIntPipe) id: number): Promise<PedidoResponseDto> {
    return PedidoResponseDto.from(await this.service.buscar(user, id));
  }

  @Roles('ADMIN')
  @Patch(':id/status')
  @ApiOperation({ summary: 'Avança o status do pedido, uma etapa por vez (admin — RF07)' })
  @ApiResponse({ status: 200, type: PedidoResponseDto })
  @ApiResponse({ status: 403, type: ErroResponseDto })
  @ApiResponse({ status: 404, type: ErroResponseDto })
  @ApiResponse({ status: 422, description: 'Transição inválida (ex.: RECEBIDO → CONCLUIDO)', type: ErroResponseDto })
  async atualizarStatus(
    @CurrentUser() user: UsuarioAutenticado,
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateStatusDto,
  ): Promise<PedidoResponseDto> {
    return PedidoResponseDto.from(await this.service.atualizarStatus(user, id, dto.status));
  }

  @Roles('CLIENTE')
  @Post(':id/avaliacao')
  @ApiOperation({ summary: 'O cliente avalia o pedido entregue com nota de 1 a 5 (uma vez)' })
  @ApiResponse({ status: 201, type: PedidoResponseDto })
  @ApiResponse({ status: 404, type: ErroResponseDto })
  @ApiResponse({ status: 409, description: 'Pedido já avaliado', type: ErroResponseDto })
  @ApiResponse({ status: 422, description: 'Pedido ainda não entregue ou nota fora de 1 a 5', type: ErroResponseDto })
  async avaliar(
    @CurrentUser() user: UsuarioAutenticado,
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: AvaliarPedidoDto,
  ): Promise<PedidoResponseDto> {
    return PedidoResponseDto.from(await this.service.avaliar(user, id, dto));
  }

  @Post(':id/cancelamento')
  @HttpCode(200)
  @ApiOperation({ summary: 'Cancela o pedido e devolve os insumos ao estoque (RF11)' })
  @ApiResponse({ status: 200, type: PedidoResponseDto })
  @ApiResponse({ status: 404, type: ErroResponseDto })
  @ApiResponse({ status: 422, description: 'Pedido em etapa que não permite cancelamento', type: ErroResponseDto })
  async cancelar(@CurrentUser() user: UsuarioAutenticado, @Param('id', ParseIntPipe) id: number): Promise<PedidoResponseDto> {
    return PedidoResponseDto.from(await this.service.cancelar(user, id));
  }
}

@ApiTags('Relatórios')
@ApiBearerAuth()
@Roles('ADMIN')
@ApiResponse({ status: 401, type: ErroResponseDto })
@ApiResponse({ status: 403, type: ErroResponseDto })
@Controller('relatorios')
export class RelatoriosController {
  constructor(private readonly service: PedidosService) {}

  @Get('saida-produtos')
  @ApiOperation({ summary: 'Quanto de cada produto saiu (pedidos não cancelados), com faturamento' })
  @ApiResponse({ status: 200, type: [SaidaProdutoResponseDto] })
  @ApiResponse({ status: 422, type: ErroResponseDto })
  async saidaProdutos(@Query() query: RelatorioQueryDto): Promise<SaidaProdutoResponseDto[]> {
    return (await this.service.saidaProdutos(query.de, query.ate)).map(SaidaProdutoResponseDto.from);
  }
}
