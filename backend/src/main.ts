import 'reflect-metadata';
import { Logger } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { NestExpressApplication } from '@nestjs/platform-express';
import { join } from 'path';
import { AppModule } from './app.module';
import { configureApp } from './configure-app';

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create<NestExpressApplication>(AppModule);
  configureApp(app);
  // O site (pasta public/) é servido pela própria API: http://localhost:3000
  app.useStaticAssets(join(__dirname, '..', 'public'));
  app.enableShutdownHooks();

  const port = Number(process.env.PORT ?? 3000);
  await app.listen(port);
  Logger.log(`Site em http://localhost:${port} · Swagger em http://localhost:${port}/api-docs`, 'Bootstrap');
}

void bootstrap();
