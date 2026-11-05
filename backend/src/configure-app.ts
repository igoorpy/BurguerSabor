import { HttpStatus, INestApplication, ValidationPipe } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { HttpErrorFilter } from './common/http-error.filter';

/**
 * Configuração compartilhada entre a aplicação real (main.ts) e os testes,
 * para que os testes exercitem exatamente o mesmo comportamento.
 */
export function configureApp(app: INestApplication): void {
  app.enableCors();

  // Validação estrita dos DTOs: campos desconhecidos são rejeitados; erro de validação = 422
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      errorHttpStatusCode: HttpStatus.UNPROCESSABLE_ENTITY,
    }),
  );
  app.useGlobalFilters(new HttpErrorFilter());

  const config = new DocumentBuilder()
    .setTitle('Burguer & Sabor API')
    .setDescription(
      [
        'API REST do Burguer & Sabor — projeto de apresentação (pagamentos simulados, senhas fictícias).',
        '',
        '**Como testar aqui:** use `POST /auth/login` com `admin@burguersabor.com` / `admin123` ou',
        '`hudson@email.com` / `cliente123`, copie o `accessToken` e clique em **Authorize**.',
      ].join('\n'),
    )
    .setVersion('1.0.0')
    .addBearerAuth({ type: 'http', scheme: 'bearer', bearerFormat: 'JWT' })
    .build();

  const document = SwaggerModule.createDocument(app, config);
  // Interface em /api-docs e especificação OpenAPI em JSON em /api-docs-json
  SwaggerModule.setup('api-docs', app, document, {
    swaggerOptions: { persistAuthorization: true },
  });
}
