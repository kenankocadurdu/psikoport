import { Module } from '@nestjs/common';
import { FormDefinitionsModule } from './form-definitions/form-definitions.module';
import { FormSubmissionsModule } from './form-submissions/form-submissions.module';

@Module({
  imports: [FormDefinitionsModule, FormSubmissionsModule],
})
export class TestsModule {}
