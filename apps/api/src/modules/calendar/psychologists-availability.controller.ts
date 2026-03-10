import { Body, Controller, Get, Param, Post, Query } from '@nestjs/common';
import { AvailabilityService } from './scheduling/availability.service';
import { SetAvailabilityDto } from './scheduling/dto/set-availability.dto';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import type { JwtUser } from '../common/types/request.types';

@Controller('psychologists')
@Roles('psychologist', 'assistant')
export class PsychologistsAvailabilityController {
  constructor(private readonly availabilityService: AvailabilityService) {}

  @Get(':id/availability')
  async getAvailability(
    @Param('id') id: string,
    @Query('date') date: string,
    @CurrentUser() user: JwtUser,
  ) {
    return this.availabilityService.getAvailableSlots(
      id,
      date,
      user.tenantId!,
    );
  }

  @Post(':id/availability')
  @Roles('psychologist')
  async setAvailability(
    @Param('id') id: string,
    @Body() dto: SetAvailabilityDto,
    @CurrentUser() user: JwtUser,
  ) {
    return this.availabilityService.setSlots(
      id,
      dto.slots,
      user.tenantId!,
    );
  }
}
