import { Module } from '@nestjs/common';
import { PrismaModule } from '../../database/prisma.module';
import { CrisisService } from './crisis.service';
import { CrisisController } from './crisis.controller';

@Module({
  imports: [PrismaModule],
  controllers: [CrisisController],
  providers: [CrisisService],
  exports: [CrisisService],
})
export class CrisisModule {}
