import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { ClientsService } from './clients.service';
import { CreateClientDto } from './dto/create-client.dto';
import { UpdateClientDto } from './dto/update-client.dto';
import { ClientQueryDto } from './dto/client-query.dto';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { AuditLog } from '../common/decorators/audit-log.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import type { JwtUser } from '../common/types/request.types';

@Controller('clients')
@Roles('psychologist', 'assistant')
export class ClientsController {
  constructor(private readonly clientsService: ClientsService) {}

  @Roles('psychologist')
  @AuditLog({ action: 'create', resourceType: 'client' })
  @Post('import')
  async import(
    @Body() body: { rows: Array<Record<string, unknown>> },
    @CurrentUser() user: JwtUser,
  ) {
    const rows = Array.isArray(body?.rows) ? body.rows : [];
    return this.clientsService.importBulk(rows, user.tenantId);
  }

  @Get()
  async findAll(
    @Query() query: ClientQueryDto,
    @CurrentUser() user: JwtUser,
  ) {
    return this.clientsService.findAll(query, user.tenantId);
  }

  @AuditLog({ action: 'view', resourceType: 'client' })
  @Get(':id')
  async findOne(@Param('id') id: string, @CurrentUser() user: JwtUser) {
    return this.clientsService.findOne(id, user.tenantId);
  }

  @Roles('psychologist')
  @Post()
  async create(@Body() dto: CreateClientDto, @CurrentUser() user: JwtUser) {
    return this.clientsService.create(dto, user.tenantId);
  }

  @AuditLog({ action: 'update', resourceType: 'client' })
  @Patch(':id')
  async update(
    @Param('id') id: string,
    @Body() dto: UpdateClientDto,
    @CurrentUser() user: JwtUser,
  ) {
    return this.clientsService.update(id, dto, user.tenantId);
  }

  @AuditLog({ action: 'delete', resourceType: 'client' })
  @Delete(':id')
  async remove(@Param('id') id: string, @CurrentUser() user: JwtUser) {
    return this.clientsService.softDelete(id, user.tenantId);
  }
}
