import dotenv from 'dotenv';
import path from 'path';

// Load environment variables from workspace root and local apps/api/.env
dotenv.config({ path: path.resolve(process.cwd(), '.env') });
dotenv.config({ path: path.resolve(process.cwd(), 'apps/api/.env') });
dotenv.config({ path: path.resolve(__dirname, '../.env') });
dotenv.config({ path: path.resolve(__dirname, '../../.env') });

import cookieParser from 'cookie-parser';
import { NestFactory } from '@nestjs/core';
import { ValidationPipe, Logger } from '@nestjs/common';
import { AppModule } from './app.module';

async function bootstrap() {
  const logger = new Logger('Bootstrap');
  const app = await NestFactory.create(AppModule);

  // Enable cookie parsing middleware for secure session & CSRF tokens
  app.use(cookieParser());

  // Enable CORS for frontend applications with credentials (cookies) support
  const rawFrontendUrl = process.env.FRONTEND_URL?.trim() || 'http://localhost:3000';
  const cleanFrontendUrl = rawFrontendUrl.replace(/\/+$/, '');
  const allowedOrigins = Array.from(
    new Set([
      cleanFrontendUrl,
      `${cleanFrontendUrl}/`,
      'https://code-senital-ai.vercel.app',
      'http://localhost:3000',
      'http://127.0.0.1:3000',
    ]),
  );

  app.enableCors({
    origin: allowedOrigins,
    methods: 'GET,HEAD,PUT,PATCH,POST,DELETE,OPTIONS',
    credentials: true,
  });

  // Global request validation
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
      forbidNonWhitelisted: false,
    }),
  );

  const port = process.env.PORT ?? 4000;
  await app.listen(port);
  logger.log(`CodeSentinel AI API server is running on http://localhost:${port}`);
}
bootstrap();
