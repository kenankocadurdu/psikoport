import { Module } from '@nestjs/common';
import { PrismaModule } from '../../database/prisma.module';
import { SubscriptionService } from './subscription.service';
import { PlansController } from './plans.controller';

@Module({
  imports: [PrismaModule],
  controllers: [PlansController],
  providers: [SubscriptionService],
  exports: [SubscriptionService],
})
export class SubscriptionModule {}
