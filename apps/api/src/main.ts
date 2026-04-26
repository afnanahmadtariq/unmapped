import { NestFactory } from '@nestjs/core';
import { Logger, ValidationPipe } from '@nestjs/common';
import { AppModule } from './app.module';
import { EnvService } from './infra/config/env.service';

async function bootstrap() {
  const app = await NestFactory.create(AppModule, { bufferLogs: false });
  const env = app.get(EnvService);

  app.enableCors({
    origin: env.get('WEB_ORIGIN'),
    credentials: true,
  });

  app.useGlobalPipes(
    new ValidationPipe({
      transform: true,
      whitelist: true,
      forbidNonWhitelisted: true,
    }),
  );

  const port = env.get('PORT');
  await app.listen(port);
  const logger = new Logger('Bootstrap');
  logger.log(`UNMAPPED API listening on http://localhost:${port}`);
  logger.log(`CORS allowed origin: ${env.get('WEB_ORIGIN')}`);
}
void bootstrap();
