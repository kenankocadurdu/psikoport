import { Controller, Get, Param, Patch, Query } from '@nestjs/common';
import { AdminService } from './admin.service';
import { Roles } from '../common/decorators/roles.decorator';

@Controller('admin')
@Roles('super_admin')
export class AdminController {
  constructor(private readonly adminService: AdminService) {}

  @Get('stats')
  getStats() {
    return this.adminService.getStats();
  }

  @Get('tenants')
  getTenants(
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @Query('search') search?: string,
  ) {
    return this.adminService.getTenants(
      page ? parseInt(page) : 1,
      limit ? parseInt(limit) : 20,
      search,
    );
  }

  @Patch('tenants/:id/toggle')
  toggleTenant(@Param('id') id: string) {
    return this.adminService.toggleTenantActive(id);
  }

  @Get('users')
  getUsers(
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @Query('search') search?: string,
  ) {
    return this.adminService.getUsers(
      page ? parseInt(page) : 1,
      limit ? parseInt(limit) : 20,
      search,
    );
  }

  @Patch('users/:id/toggle')
  toggleUser(@Param('id') id: string) {
    return this.adminService.toggleUserActive(id);
  }
}
