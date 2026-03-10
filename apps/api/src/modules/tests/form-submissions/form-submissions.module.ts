import { Module } from '@nestjs/common';
import { FormSubmissionsController } from './form-submissions.controller';
import { ClientFormSubmissionsController } from './client-form-submissions.controller';
import { FormsPublicController } from './forms-public.controller';
import { FormSubmissionsService } from './form-submissions.service';
import { FormTokenService } from '../form-token.service';
import { PrismaModule } from '../../../database/prisma.module';
import { QueueModule } from '../../../queue/queue.module';

@Module({
  imports: [PrismaModule, QueueModule],
  controllers: [
    FormSubmissionsController,
    ClientFormSubmissionsController,
    FormsPublicController,
  ],
  providers: [FormSubmissionsService, FormTokenService],
  exports: [FormSubmissionsService, FormTokenService],
})
export class FormSubmissionsModule {}
