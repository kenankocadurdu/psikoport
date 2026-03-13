import {
  Controller,
  Get,
  Post,
  Patch,
  Param,
  Query,
  Body,
  UseGuards,
} from '@nestjs/common';
import { FormDefinitionsService } from './form-definitions.service';
import { FormDefinitionQueryDto } from './dto/form-definition-query.dto';
import { CreateFormDefinitionDto } from './dto/create-form-definition.dto';
import { UpdateFormDefinitionDto } from './dto/update-form-definition.dto';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { QuotaGuard } from '../../common/guards/quota.guard';
import { Quota } from '../../common/decorators/quota.decorator';
import type { JwtUser } from '../../common/types/request.types';

@Controller('form-definitions')
@Roles('psychologist', 'assistant')
export class FormDefinitionsController {
  constructor(private readonly service: FormDefinitionsService) {}

  @Get()
  async findAll(
    @Query() query: FormDefinitionQueryDto,
    @CurrentUser() user: JwtUser,
  ) {
    return this.service.findAll(query, user.tenantId);
  }

  @Get(':code')
  async findByCode(
    @Param('code') code: string,
    @CurrentUser() user: JwtUser,
  ) {
    return this.service.findByCode(code, user.tenantId);
  }

  @Roles('psychologist')
  @UseGuards(QuotaGuard)
  @Quota('custom_forms')
  @Post()
  async create(
    @Body() dto: CreateFormDefinitionDto,
    @CurrentUser() user: JwtUser,
  ) {
    return this.service.create(dto, user.tenantId);
  }

  @Roles('psychologist')
  @Patch(':id')
  async update(
    @Param('id') id: string,
    @Body() dto: UpdateFormDefinitionDto,
    @CurrentUser() user: JwtUser,
  ) {
    return this.service.update(id, dto, user.tenantId);
  }
}
