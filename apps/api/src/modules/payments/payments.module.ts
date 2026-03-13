import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { StripeService } from './stripe.service';
import { PaymentsController } from './payments.controller';
import { WebhookIdempotencyService } from '../common/services/webhook-idempotency.service';
import { PrismaModule } from '../../database/prisma.module';

@Module({
  imports: [ConfigModule, PrismaModule],
  controllers: [PaymentsController],
  providers: [StripeService, WebhookIdempotencyService],
  exports: [StripeService],
})
export class PaymentsModule {}
