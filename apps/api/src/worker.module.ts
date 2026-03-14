import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { BullModule } from '@nestjs/bullmq';
import Redis from 'ioredis';
import { PrismaModule } from './database/prisma.module';
import { QueueModule } from './queue/queue.module';
import { NotificationModule } from './modules/common/services/notification.module';
import { LegalModule } from './modules/legal/legal.module';

/**
 * Minimal NestJS module for the BullMQ worker process.
 * Contains only what processors need: config, DB, queues, notifications.
 * No HTTP server, no guards, no controllers, no interceptors.
 */
@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true, envFilePath: '../../.env' }),
    PrismaModule,
    BullModule.forRootAsync({
      imports: [ConfigModule],
      useFactory: (config: ConfigService) => {
        const url = config.get<string>('REDIS_URL');
        const connection = url
          ? new Redis(url, { maxRetriesPerRequest: null })
          : new Redis({
              host: config.get('REDIS_HOST', 'localhost'),
              port: config.get('REDIS_PORT', 6379),
              password: config.get('REDIS_PASSWORD'),
              maxRetriesPerRequest: null,
            });
        return { connection };
      },
      inject: [ConfigService],
    }),
    QueueModule,
    NotificationModule,
    LegalModule,
  ],
})
export class WorkerModule {}
