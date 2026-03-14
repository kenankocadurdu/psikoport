import { Module } from '@nestjs/common';
import { FormDefinitionsController } from './form-definitions.controller';
import { FormDefinitionsService } from './form-definitions.service';
import { PrismaModule } from '../../../database/prisma.module';
import { SubscriptionModule } from '../../subscriptions/subscription.module';
import { QuotaGuard } from '../../common/guards/quota.guard';

@Module({
  imports: [PrismaModule, SubscriptionModule],
  controllers: [FormDefinitionsController],
  providers: [FormDefinitionsService, QuotaGuard],
  exports: [FormDefinitionsService],
})
export class FormDefinitionsModule {}
