import {
  Controller,
  Get,
  Post,
  Patch,
  Param,
  Body,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { FormSubmissionsService } from './form-submissions.service';
import { FormTokenService } from '../form-token.service';
import { CreateFormSubmissionDto } from './dto/create-form-submission.dto';
import { UpdateFormSubmissionDraftDto } from './dto/update-form-submission-draft.dto';
import { GenerateFormTokenDto } from './dto/generate-form-token.dto';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import type { JwtUser } from '../../common/types/request.types';

@Controller('form-submissions')
@Roles('psychologist', 'assistant')
export class FormSubmissionsController {
  constructor(
    private readonly service: FormSubmissionsService,
    private readonly formToken: FormTokenService,
    private readonly config: ConfigService,
  ) {}

  @Post('generate-link')
  @Roles('psychologist')
  async generateLink(
    @Body() dto: GenerateFormTokenDto,
    @CurrentUser() user: JwtUser,
  ) {
    const token = this.formToken.generateToken({
      clientId: dto.clientId,
      formDefinitionId: dto.formDefinitionId,
      tenantId: user.tenantId!,
      psychologistId: user.userId!,
    });
    const frontendUrl = this.config.get<string>('FRONTEND_URL', 'http://localhost:3000');
    const url = `${frontendUrl}/forms/${token}`;
    return { token, url };
  }

  @Post()
  async create(
    @Body() dto: CreateFormSubmissionDto,
    @CurrentUser() user: JwtUser,
  ) {
    return this.service.create(dto, user.tenantId!, user.userId!);
  }

  @Patch(':id/draft')
  @Roles('psychologist')
  async saveDraft(
    @Param('id') id: string,
    @Body() dto: UpdateFormSubmissionDraftDto,
    @CurrentUser() user: JwtUser,
  ) {
    return this.service.saveDraft(id, dto, user.tenantId!);
  }

  @Post(':id/complete')
  @Roles('psychologist')
  async complete(@Param('id') id: string, @CurrentUser() user: JwtUser) {
    return this.service.complete(id, user.tenantId!);
  }

  @Get(':id')
  async findOne(@Param('id') id: string, @CurrentUser() user: JwtUser) {
    return this.service.findOne(id, user.tenantId!);
  }
}
