import { Module } from '@nestjs/common';
import { PrismaModule } from '../../database/prisma.module';
import { PaymentsService } from './payments.service';
import { PaymentSettingsService } from './payment-settings.service';
import { FinanceController } from './finance.controller';

@Module({
  imports: [PrismaModule],
  controllers: [FinanceController],
  providers: [PaymentsService, PaymentSettingsService],
  exports: [PaymentsService, PaymentSettingsService],
})
export class FinanceModule {}
