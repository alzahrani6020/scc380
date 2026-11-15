import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { ValidationPipe } from '@nestjs/common';
import { json } from 'express';
import { randomUUID } from 'node:crypto';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  app.getHttpAdapter().getInstance().set('trust proxy', 1);
  // Diagnostic-only: never log email, password, token, client IP or request body.
  // Response headers let the browser distinguish NestJS replies from upstream 429s.
  app.use('/auth/login', (req: any, res: any, next: () => void) => {
    const requestId = randomUUID();
    res.setHeader('X-SCC-Auth-Request-Id', requestId);
    res.setHeader('X-SCC-Auth-Origin', 'nest-api');
    res.setHeader('Cache-Control', 'no-store');
    res.on('finish', () => {
      const code = res.getHeader('X-SCC-Auth-Error-Code') || (res.statusCode === 200 ? 'SUCCESS' : 'UNCLASSIFIED');
      console.info(JSON.stringify({
        event: 'AUTH_LOGIN_HTTP',
        requestId,
        status: res.statusCode,
        reason: String(code),
      }));
    });
    next();
  });

  // Only evidence uploads may exceed the default JSON limit (5MB binary = ~7MB base64).
  const evidenceParser = json({ limit: '7mb' });
  app.use('/hr/governance/:id/evidence',
    (req: any, res: any, next: any) => evidenceParser(req, res, next));
  
  const allowedOrigins = (process.env.CORS_ORIGINS || 'http://localhost:3000')
    .split(',').map(o => o.trim()).filter(Boolean);
  
  app.enableCors({
    origin: allowedOrigins,
    credentials: true,
    methods: 'GET,HEAD,PUT,PATCH,POST,DELETE,OPTIONS',
    allowedHeaders: 'Content-Type, Authorization, X-Requested-With, X-Tenant-Slug, X-Branch-Id',
  });

  app.useGlobalPipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }));

  const swaggerConfig = new DocumentBuilder()
    .setTitle('SCC 380 API')
    .setDescription('Smart Command Center API Documentation')
    .setVersion('1.0')
    .addBearerAuth()
    .build();
  const document = SwaggerModule.createDocument(app, swaggerConfig);
    // إخفاء Swagger في الإنتاج إلا إذا فُعّل صراحة (ENABLE_SWAGGER=1)
  if (process.env.NODE_ENV !== 'production' || process.env.ENABLE_SWAGGER === '1') {
    SwaggerModule.setup('api/docs', app, document);
  }

  const port = process.env.PORT || 3001;
  await app.listen(port, '0.0.0.0');
  console.log(`🚀 API running on port ${port}`);
}
bootstrap();
