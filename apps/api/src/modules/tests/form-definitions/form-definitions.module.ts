import { Module } from '@nestjs/common';
import { FormDefinitionsController } from './form-definitions.controller';
import { FormDefinitionsService } from './form-definitions.service';
import { PrismaModule } from '../../../database/prisma.module';

@Module({
  imports: [PrismaModule],
  controllers: [FormDefinitionsController],
  providers: [FormDefinitionsService],
  exports: [FormDefinitionsService],
})
export class FormDefinitionsModule {}
