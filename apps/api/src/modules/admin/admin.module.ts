import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { PrismaModule } from '../../database/prisma.module';
import { AdminController } from './admin.controller';
import { AdminService } from './admin.service';
import { AdminBootstrapService } from './admin-bootstrap.service';
import { LicensesController } from './licenses.controller';
import { LicensesService } from './licenses.service';
import { SubscriptionModule } from '../subscriptions/subscription.module';

@Module({
  imports: [PrismaModule, ConfigModule, SubscriptionModule],
  controllers: [AdminController, LicensesController],
  providers: [AdminService, AdminBootstrapService, LicensesService],
})
export class AdminModule {}
