import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { Logger } from '@nestjs/common';

async function bootstrap() {
  const app = await NestFactory.create(AppModule, { cors: true });
  const port = process.env.PORT || 4000;
  await app.listen(port);
  const logger = new Logger('Bootstrap');
  logger.log(`🌍 Data Harvester running on http://localhost:${port}`);
  logger.log(`📊 Datasets: GET http://localhost:${port}/datasets`);
  logger.log(`🚀 Trigger all: POST http://localhost:${port}/harvest`);
}
bootstrap();
