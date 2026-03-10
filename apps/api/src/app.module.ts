import { Module } from '@nestjs/common';
import { APP_GUARD, APP_FILTER, APP_PIPE, APP_INTERCEPTOR } from '@nestjs/core';
import { ConfigModule } from '@nestjs/config';
import { ThrottlerModule, ThrottlerGuard } from '@nestjs/throttler';
import { BullModule } from '@nestjs/bullmq';
import { ConfigService } from '@nestjs/config';
import Redis from 'ioredis';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { PrismaModule } from './database/prisma.module';
import { AuthModule } from './modules/auth/auth.module';
import { StorageModule } from './modules/common/services/storage.module';
import { NotificationModule } from './modules/common/services/notification.module';
import { ClientsModule } from './modules/clients/clients.module';
import { LegalModule } from './modules/legal/legal.module';
import { TestsModule } from './modules/tests/tests.module';
import { CalendarModule } from './modules/calendar/calendar.module';
import { FinanceModule } from './modules/finance/finance.module';
import { ProfileModule } from './modules/profile/profile.module';
import { CrisisModule } from './modules/crisis/crisis.module';
import { AdminModule } from './modules/admin/admin.module';
import { BlogModule } from './modules/blog/blog.module';
import { QueueModule } from './queue/queue.module';
import { JwtAuthGuard } from './modules/common/guards/auth.guard';
import { TwoFactorGuard } from './modules/common/guards/two-factor.guard';
import { RolesGuard } from './modules/common/guards/roles.guard';
import { HttpExceptionFilter } from './modules/common/filters/http-exception.filter';
import { ValidationPipe } from './modules/common/pipes/validation.pipe';
import { AuditLogInterceptor } from './modules/common/interceptors/audit-log.interceptor';
import { ResponseTimingInterceptor } from './modules/common/interceptors/response-timing.interceptor';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
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
    ThrottlerModule.forRoot([
      { name: 'default', limit: 600, ttl: 60000 },
    ]),
    AuthModule,
    StorageModule,
    NotificationModule,
    ClientsModule,
    LegalModule,
    TestsModule,
    CalendarModule,
    FinanceModule,
    ProfileModule,
    CrisisModule,
    AdminModule,
    BlogModule,
    QueueModule,
  ],
  controllers: [AppController],
  providers: [
    AppService,
    {
      provide: APP_GUARD,
      useClass: ThrottlerGuard,
    },
    {
      provide: APP_GUARD,
      useClass: JwtAuthGuard,
    },
    {
      provide: APP_GUARD,
      useClass: TwoFactorGuard,
    },
    {
      provide: APP_GUARD,
      useClass: RolesGuard,
    },
    {
      provide: APP_FILTER,
      useClass: HttpExceptionFilter,
    },
    {
      provide: APP_PIPE,
      useClass: ValidationPipe,
    },
    {
      provide: APP_INTERCEPTOR,
      useClass: ResponseTimingInterceptor,
    },
    {
      provide: APP_INTERCEPTOR,
      useClass: AuditLogInterceptor,
    },
  ],
})
export class AppModule {}
