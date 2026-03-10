import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { AppointmentsService } from './appointments.service';
import { AvailabilityService } from './availability.service';
import { CreateAppointmentDto } from './dto/create-appointment.dto';
import { UpdateAppointmentDto } from './dto/update-appointment.dto';
import { AppointmentQueryDto } from './dto/appointment-query.dto';
import { CancelAppointmentDto } from './dto/cancel-appointment.dto';
import { SetAvailabilityDto } from './dto/set-availability.dto';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { AuditLog } from '../../common/decorators/audit-log.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import type { JwtUser } from '../../common/types/request.types';

@Controller('appointments')
@Roles('psychologist', 'assistant')
export class AppointmentsController {
  constructor(
    private readonly appointmentsService: AppointmentsService,
    private readonly availabilityService: AvailabilityService,
  ) {}

  @Post()
  @Roles('psychologist')
  @AuditLog({ action: 'create', resourceType: 'appointment' })
  async create(
    @Body() dto: CreateAppointmentDto,
    @CurrentUser() user: JwtUser,
  ) {
    return this.appointmentsService.create(
      dto,
      user.tenantId!,
      user.userId!,
    );
  }

  @Get('calendar')
  async getCalendar(
    @Query('start') start: string,
    @Query('end') end: string,
    @Query('psychologistId') psychologistId: string | undefined,
    @CurrentUser() user: JwtUser,
  ) {
    return this.appointmentsService.findAll(
      { start, end, psychologistId, limit: 500 },
      user.tenantId!,
    );
  }

  @Get()
  async findAll(
    @Query() query: AppointmentQueryDto,
    @CurrentUser() user: JwtUser,
  ) {
    return this.appointmentsService.findAll(query, user.tenantId!);
  }

  @Get(':id')
  @AuditLog({ action: 'view', resourceType: 'appointment' })
  async findOne(
    @Param('id') id: string,
    @CurrentUser() user: JwtUser,
  ) {
    return this.appointmentsService.findOne(id, user.tenantId!);
  }

  @Patch(':id')
  @Roles('psychologist')
  @AuditLog({ action: 'update', resourceType: 'appointment' })
  async update(
    @Param('id') id: string,
    @Body() dto: UpdateAppointmentDto,
    @CurrentUser() user: JwtUser,
  ) {
    return this.appointmentsService.update(id, dto, user.tenantId!);
  }

  @Post(':id/cancel')
  @Roles('psychologist')
  @AuditLog({ action: 'update', resourceType: 'appointment' })
  async cancel(
    @Param('id') id: string,
    @Body() dto: CancelAppointmentDto,
    @CurrentUser() user: JwtUser,
  ) {
    return this.appointmentsService.cancel(id, dto.reason, user.tenantId!);
  }

  @Post(':id/complete')
  @Roles('psychologist')
  @AuditLog({ action: 'update', resourceType: 'appointment' })
  async complete(
    @Param('id') id: string,
    @CurrentUser() user: JwtUser,
  ) {
    return this.appointmentsService.complete(id, user.tenantId!);
  }

  @Post(':id/no-show')
  @Roles('psychologist')
  @AuditLog({ action: 'update', resourceType: 'appointment' })
  async noShow(
    @Param('id') id: string,
    @CurrentUser() user: JwtUser,
  ) {
    return this.appointmentsService.noShow(id, user.tenantId!);
  }
}
