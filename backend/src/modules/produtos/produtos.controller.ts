import { Body, Controller, Delete, Get, HttpCode, Param, ParseIntPipe, Patch, Post, Put, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { Public, Roles } from '../../common/auth/auth.decorators';
import { ErroResponseDto } from '../../common/dto/erro-response.dto';
import {
  CreateProdutoDto,
  CustoProdutoResponseDto,
  ItemFichaResponseDto,
  ListProdutosQueryDto,
  ProdutoResponseDto,
  ReplaceFichaDto,
  UpdateProdutoDto,
} from './dto/produto.dto';
import { ProdutosService } from './produtos.service';

@ApiTags('Produtos')
@Controller('produtos')
export class ProdutosController {
  constructor(private readonly service: ProdutosService) {}

  @Public()
  @Get()
  @ApiOperation({ summary: 'Catálogo de produtos, com filtro por categoria e busca por termo (RF10)' })
  @ApiResponse({ status: 200, type: [ProdutoResponseDto] })
  @ApiResponse({ status: 422, type: ErroResponseDto })
  async listar(@Query() query: ListProdutosQueryDto): Promise<ProdutoResponseDto[]> {
    return (await this.service.listar(query)).map(ProdutoResponseDto.from);
  }

  @Public()
  @Get(':id')
  @ApiOperation({ summary: 'Detalha um produto' })
  @ApiResponse({ status: 200, type: ProdutoResponseDto })
  @ApiResponse({ status: 404, type: ErroResponseDto })
  async buscar(@Param('id', ParseIntPipe) id: number): Promise<ProdutoResponseDto> {
    return ProdutoResponseDto.from(await this.service.buscar(id));
  }

  @Roles('ADMIN')
  @ApiBearerAuth()
  @Post()
  @ApiOperation({ summary: 'Cadastra um produto (admin)' })
  @ApiResponse({ status: 201, type: ProdutoResponseDto })
  @ApiResponse({ status: 422, description: 'Preço ≤ 0 ou categoria inexistente', type: ErroResponseDto })
  async criar(@Body() dto: CreateProdutoDto): Promise<ProdutoResponseDto> {
    return ProdutoResponseDto.from(await this.service.criar(dto));
  }

  @Roles('ADMIN')
  @ApiBearerAuth()
  @Patch(':id')
  @ApiOperation({ summary: 'Atualiza um produto (admin)' })
  @ApiResponse({ status: 200, type: ProdutoResponseDto })
  @ApiResponse({ status: 400, type: ErroResponseDto })
  @ApiResponse({ status: 404, type: ErroResponseDto })
  @ApiResponse({ status: 422, type: ErroResponseDto })
  async atualizar(@Param('id', ParseIntPipe) id: number, @Body() dto: UpdateProdutoDto): Promise<ProdutoResponseDto> {
    return ProdutoResponseDto.from(await this.service.atualizar(id, dto));
  }

  @Roles('ADMIN')
  @ApiBearerAuth()
  @Delete(':id')
  @HttpCode(204)
  @ApiOperation({ summary: 'Exclui um produto que nunca foi vendido (admin)' })
  @ApiResponse({ status: 204, description: 'Excluído' })
  @ApiResponse({ status: 404, type: ErroResponseDto })
  @ApiResponse({ status: 409, description: 'Produto já vendido', type: ErroResponseDto })
  async remover(@Param('id', ParseIntPipe) id: number): Promise<void> {
    await this.service.remover(id);
  }

  @Roles('ADMIN')
  @ApiBearerAuth()
  @Get(':id/ficha-tecnica')
  @ApiOperation({ summary: 'Ficha técnica (receita) do produto (admin — RF04)' })
  @ApiResponse({ status: 200, type: [ItemFichaResponseDto] })
  @ApiResponse({ status: 404, type: ErroResponseDto })
  async ficha(@Param('id', ParseIntPipe) id: number): Promise<ItemFichaResponseDto[]> {
    return (await this.service.fichaTecnica(id)).map(ItemFichaResponseDto.from);
  }

  @Roles('ADMIN')
  @ApiBearerAuth()
  @Put(':id/ficha-tecnica')
  @ApiOperation({ summary: 'Substitui a ficha técnica do produto (admin — RF04)' })
  @ApiResponse({ status: 200, type: [ItemFichaResponseDto] })
  @ApiResponse({ status: 404, type: ErroResponseDto })
  @ApiResponse({ status: 422, description: 'Insumo inexistente, repetido ou quantidade ≤ 0', type: ErroResponseDto })
  async substituirFicha(@Param('id', ParseIntPipe) id: number, @Body() dto: ReplaceFichaDto): Promise<ItemFichaResponseDto[]> {
    return (await this.service.substituirFicha(id, dto.itens)).map(ItemFichaResponseDto.from);
  }

  @Roles('ADMIN')
  @ApiBearerAuth()
  @Get(':id/custo')
  @ApiOperation({ summary: 'Custo dos insumos, lucro e margem do produto (admin)' })
  @ApiResponse({ status: 200, type: CustoProdutoResponseDto })
  @ApiResponse({ status: 404, type: ErroResponseDto })
  async custo(@Param('id', ParseIntPipe) id: number): Promise<CustoProdutoResponseDto> {
    const { produto, custo } = await this.service.custo(id);
    return CustoProdutoResponseDto.from(produto, custo);
  }
}
