import {
  Controller,
  Get,
  Post,
  Query,
  Body,
  Headers,
  UnauthorizedException,
} from '@nestjs/common';
import { Public } from '../../common/decorators/public.decorator';
import { FormSubmissionsService } from './form-submissions.service';
import { FormTokenService } from '../form-token.service';
import { SubmitByTokenBodyDto } from './dto/submit-by-token-body.dto';

/**
 * Token-based form access — danışan Auth0 login olmadan form doldurur.
 * formToken = JWT(clientId, formDefinitionId, tenantId, psychologistId, exp: 7d)
 */
@Controller('forms/public')
@Public()
export class FormsPublicController {
  constructor(
    private readonly service: FormSubmissionsService,
    private readonly formToken: FormTokenService,
  ) {}

  @Get('schema')
  async getSchema(
    @Query('token') token?: string,
    @Headers('x-form-token') headerToken?: string,
  ) {
    const formToken = token ?? headerToken;
    if (!formToken) {
      throw new UnauthorizedException(
        'Form token gerekli (query ?token= veya X-Form-Token header)',
      );
    }
    const payload = this.formToken.verifyToken(formToken);
    return this.service.getFormSchemaByToken(payload);
  }

  @Post('submit')
  async submit(
    @Body() dto: SubmitByTokenBodyDto,
    @Headers('x-form-token') headerToken?: string,
  ) {
    const formToken = dto.token ?? headerToken;
    if (!formToken) {
      throw new UnauthorizedException(
        'Form token gerekli (body.token veya X-Form-Token header)',
      );
    }
    const payload = this.formToken.verifyToken(formToken);
    return this.service.submitByToken(payload, {
      responses: dto.responses,
      completionStatus: dto.completionStatus,
    });
  }
}
