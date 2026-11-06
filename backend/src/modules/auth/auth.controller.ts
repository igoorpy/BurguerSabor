import { Body, Controller, Get, HttpCode, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { CurrentUser, Public, UsuarioAutenticado } from '../../common/auth/auth.decorators';
import { ErroResponseDto } from '../../common/dto/erro-response.dto';
import { AuthService } from './auth.service';
import { LoginDto, LoginResponseDto, RegistroDto, UsuarioResponseDto } from './dto/auth.dto';

@ApiTags('Autenticação')
@Controller('auth')
export class AuthController {
  constructor(private readonly auth: AuthService) {}

  @Public()
  @Post('registro')
  @ApiOperation({ summary: 'Cria uma conta de cliente' })
  @ApiResponse({ status: 201, type: UsuarioResponseDto })
  @ApiResponse({ status: 409, description: 'E-mail já cadastrado', type: ErroResponseDto })
  @ApiResponse({ status: 422, description: 'Dados inválidos', type: ErroResponseDto })
  async registrar(@Body() dto: RegistroDto): Promise<UsuarioResponseDto> {
    return UsuarioResponseDto.from(await this.auth.registrar(dto));
  }

  @Public()
  @Post('login')
  @HttpCode(200)
  @ApiOperation({ summary: 'Entra com e-mail e senha e recebe o token de acesso' })
  @ApiResponse({ status: 200, type: LoginResponseDto })
  @ApiResponse({ status: 401, description: 'E-mail ou senha inválidos', type: ErroResponseDto })
  async login(@Body() dto: LoginDto): Promise<LoginResponseDto> {
    const { accessToken, usuario } = await this.auth.login(dto);
    return { accessToken, tokenType: 'Bearer', usuario: UsuarioResponseDto.from(usuario) };
  }

  @Get('me')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Dados do usuário logado' })
  @ApiResponse({ status: 200, type: UsuarioResponseDto })
  @ApiResponse({ status: 401, type: ErroResponseDto })
  async me(@CurrentUser() user: UsuarioAutenticado): Promise<UsuarioResponseDto> {
    return UsuarioResponseDto.from(await this.auth.perfil(user.id));
  }
}
