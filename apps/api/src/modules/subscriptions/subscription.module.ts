import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { PrismaModule } from '../../database/prisma.module';
import { SubscriptionService } from './subscription.service';
import { PlansController } from './plans.controller';
import { StripeSubscriptionService } from '../payments/stripe-subscription.service';

@Module({
  imports: [PrismaModule, ConfigModule],
  controllers: [PlansController],
  providers: [SubscriptionService, StripeSubscriptionService],
  exports: [SubscriptionService],
})
export class SubscriptionModule {}
