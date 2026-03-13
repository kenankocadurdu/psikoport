import { NestFactory } from '@nestjs/core';
import { WorkerModule } from './worker.module';

async function bootstrap() {
  // ApplicationContext: no HTTP server, just the DI container + BullMQ processors
  const app = await NestFactory.createApplicationContext(WorkerModule);
  await app.init();
}

void bootstrap();
