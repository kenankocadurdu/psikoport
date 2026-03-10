import { Module } from '@nestjs/common';
import { PrismaModule } from '../../database/prisma.module';
import { LicensesController } from './licenses.controller';
import { LicensesService } from './licenses.service';

@Module({
  imports: [PrismaModule],
  controllers: [LicensesController],
  providers: [LicensesService],
})
export class AdminModule {}
