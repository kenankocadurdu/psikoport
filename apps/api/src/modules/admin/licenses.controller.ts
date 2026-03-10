import { Body, Controller, Get, Param, Patch } from '@nestjs/common';
import { LicensesService } from './licenses.service';
import { Roles } from '../common/decorators/roles.decorator';

@Controller('admin/licenses')
@Roles('super_admin')
export class LicensesController {
  constructor(private readonly licensesService: LicensesService) {}

  @Get('pending')
  async getPending() {
    return this.licensesService.getPending();
  }

  @Patch(':userId/approve')
  async approve(@Param('userId') userId: string) {
    return this.licensesService.approve(userId);
  }

  @Patch(':userId/reject')
  async reject(@Param('userId') userId: string) {
    return this.licensesService.reject(userId);
  }
}
