import { Body, Controller, Get, Param, Post } from '@nestjs/common';
import { CrisisService } from './crisis.service';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import type { JwtUser } from '../common/types/request.types';

@Controller('crisis')
@Roles('psychologist')
export class CrisisController {
  constructor(private readonly crisisService: CrisisService) {}

  @Get()
  async getActiveAlerts(@CurrentUser() user: JwtUser) {
    return this.crisisService.getActiveAlerts(user.tenantId!);
  }

  @Post(':id/acknowledge')
  async acknowledge(
    @Param('id') id: string,
    @Body() body: { notes?: string },
    @CurrentUser() user: JwtUser,
  ) {
    return this.crisisService.acknowledge(
      id,
      user.tenantId!,
      user.userId!,
      body.notes,
    );
  }
}
