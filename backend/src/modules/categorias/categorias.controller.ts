import { Body, Controller, Delete, Get, HttpCode, Param, ParseIntPipe, Patch, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { Public, Roles } from '../../common/auth/auth.decorators';
import { ErroResponseDto } from '../../common/dto/erro-response.dto';
import { CategoriasService } from './categorias.service';
import { CategoriaResponseDto, CreateCategoriaDto, ListCategoriasQueryDto, UpdateCategoriaDto } from './dto/categoria.dto';

@ApiTags('Categorias')
@Controller('categorias')
export class CategoriasController {
  constructor(private readonly service: CategoriasService) {}

  @Public()
  @Get()
  @ApiOperation({ summary: 'Lista as categorias do cardápio (barra de opções do app — RF10)' })
  @ApiResponse({ status: 200, type: [CategoriaResponseDto] })
  async listar(@Query() query: ListCategoriasQueryDto): Promise<CategoriaResponseDto[]> {
    return (await this.service.listar(query.somenteAtivas ?? false)).map(CategoriaResponseDto.from);
  }

  @Public()
  @Get(':id')
  @ApiOperation({ summary: 'Detalha uma categoria' })
  @ApiResponse({ status: 200, type: CategoriaResponseDto })
  @ApiResponse({ status: 404, type: ErroResponseDto })
  async buscar(@Param('id', ParseIntPipe) id: number): Promise<CategoriaResponseDto> {
    return CategoriaResponseDto.from(await this.service.buscar(id));
  }

  @Roles('ADMIN')
  @ApiBearerAuth()
  @Post()
  @ApiOperation({ summary: 'Cria uma categoria (admin)' })
  @ApiResponse({ status: 201, type: CategoriaResponseDto })
  @ApiResponse({ status: 409, description: 'Nome já existe', type: ErroResponseDto })
  @ApiResponse({ status: 422, type: ErroResponseDto })
  async criar(@Body() dto: CreateCategoriaDto): Promise<CategoriaResponseDto> {
    return CategoriaResponseDto.from(await this.service.criar(dto));
  }

  @Roles('ADMIN')
  @ApiBearerAuth()
  @Patch(':id')
  @ApiOperation({ summary: 'Atualiza uma categoria (admin)' })
  @ApiResponse({ status: 200, type: CategoriaResponseDto })
  @ApiResponse({ status: 400, type: ErroResponseDto })
  @ApiResponse({ status: 404, type: ErroResponseDto })
  async atualizar(@Param('id', ParseIntPipe) id: number, @Body() dto: UpdateCategoriaDto): Promise<CategoriaResponseDto> {
    return CategoriaResponseDto.from(await this.service.atualizar(id, dto));
  }

  @Roles('ADMIN')
  @ApiBearerAuth()
  @Delete(':id')
  @HttpCode(204)
  @ApiOperation({ summary: 'Exclui uma categoria sem produtos (admin — RN03)' })
  @ApiResponse({ status: 204, description: 'Excluída' })
  @ApiResponse({ status: 404, type: ErroResponseDto })
  @ApiResponse({ status: 409, description: 'Categoria com produtos', type: ErroResponseDto })
  async remover(@Param('id', ParseIntPipe) id: number): Promise<void> {
    await this.service.remover(id);
  }
}
