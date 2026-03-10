import { Controller, Get, Param, Query } from '@nestjs/common';
import { FormSubmissionsService } from './form-submissions.service';
import { FormSubmissionQueryDto } from './dto/form-submission-query.dto';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import type { JwtUser } from '../../common/types/request.types';

@Controller('clients/:clientId/form-submissions')
@Roles('psychologist', 'assistant')
export class ClientFormSubmissionsController {
  constructor(private readonly service: FormSubmissionsService) {}

  @Get()
  async findAll(
    @Param('clientId') clientId: string,
    @Query() query: FormSubmissionQueryDto,
    @CurrentUser() user: JwtUser,
  ) {
    return this.service.findByClient(clientId, query, user.tenantId!);
  }
}
