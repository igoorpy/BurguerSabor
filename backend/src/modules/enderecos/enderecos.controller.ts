import { Body, Controller, Delete, Get, HttpCode, Param, ParseIntPipe, Patch, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { CurrentUser, Roles, UsuarioAutenticado } from '../../common/auth/auth.decorators';
import { ErroResponseDto } from '../../common/dto/erro-response.dto';
import { CreateEnderecoDto, EnderecoResponseDto, UpdateEnderecoDto } from './dto/endereco.dto';
import { EnderecosService } from './enderecos.service';

@ApiTags('Endereços (cliente)')
@ApiBearerAuth()
@Roles('CLIENTE')
@ApiResponse({ status: 401, description: 'Sem token', type: ErroResponseDto })
@ApiResponse({ status: 403, description: 'Somente clientes', type: ErroResponseDto })
@Controller('enderecos')
export class EnderecosController {
  constructor(private readonly service: EnderecosService) {}

  @Get()
  @ApiOperation({ summary: 'Lista os endereços do cliente logado' })
  @ApiResponse({ status: 200, type: [EnderecoResponseDto] })
  async listar(@CurrentUser() user: UsuarioAutenticado): Promise<EnderecoResponseDto[]> {
    return (await this.service.listar(user.id)).map(EnderecoResponseDto.from);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Detalha um endereço do cliente logado' })
  @ApiResponse({ status: 200, type: EnderecoResponseDto })
  @ApiResponse({ status: 404, type: ErroResponseDto })
  async buscar(@CurrentUser() user: UsuarioAutenticado, @Param('id', ParseIntPipe) id: number): Promise<EnderecoResponseDto> {
    return EnderecoResponseDto.from(await this.service.buscar(user.id, id));
  }

  @Post()
  @ApiOperation({ summary: 'Cadastra um endereço de entrega' })
  @ApiResponse({ status: 201, type: EnderecoResponseDto })
  @ApiResponse({ status: 422, type: ErroResponseDto })
  async criar(@CurrentUser() user: UsuarioAutenticado, @Body() dto: CreateEnderecoDto): Promise<EnderecoResponseDto> {
    return EnderecoResponseDto.from(await this.service.criar(user.id, dto));
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Atualiza campos de um endereço' })
  @ApiResponse({ status: 200, type: EnderecoResponseDto })
  @ApiResponse({ status: 400, type: ErroResponseDto })
  @ApiResponse({ status: 404, type: ErroResponseDto })
  async atualizar(
    @CurrentUser() user: UsuarioAutenticado,
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateEnderecoDto,
  ): Promise<EnderecoResponseDto> {
    return EnderecoResponseDto.from(await this.service.atualizar(user.id, id, dto));
  }

  @Delete(':id')
  @HttpCode(204)
  @ApiOperation({ summary: 'Exclui um endereço que ainda não foi usado em pedidos' })
  @ApiResponse({ status: 204, description: 'Excluído' })
  @ApiResponse({ status: 404, type: ErroResponseDto })
  @ApiResponse({ status: 409, type: ErroResponseDto })
  async remover(@CurrentUser() user: UsuarioAutenticado, @Param('id', ParseIntPipe) id: number): Promise<void> {
    await this.service.remover(user.id, id);
  }
}
