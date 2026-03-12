import { Body, Controller, Get, Param, Patch, Post, Query } from '@nestjs/common';
import { IsBoolean, IsEnum, IsInt, IsOptional, Min } from 'class-validator';
import { TenantPlan } from 'prisma-client';
import { AdminService } from './admin.service';
import { SystemConfigService, SYSTEM_CONFIG_KEYS } from './system-config.service';
import { Roles } from '../common/decorators/roles.decorator';
import { SubscriptionService } from '../subscriptions/subscription.service';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import type { JwtUser } from '../common/types/request.types';

class UpdatePlanConfigDto {
  @IsEnum(TenantPlan)
  planCode!: TenantPlan;

  @IsInt()
  @Min(1)
  monthlySessionQuota!: number;

  @IsInt()
  @Min(1)
  @IsOptional()
  testsPerSession?: number;

  @IsInt()
  @Min(0)
  @IsOptional()
  monthlyPrice?: number;

  @IsInt()
  @Min(0)
  @IsOptional()
  trialDays?: number;
}

class UpdateSystemConfigDto {
  @IsOptional()
  @IsBoolean()
  useAuth0?: boolean;
}

@Controller('admin')
@Roles('super_admin')
export class AdminController {
  constructor(
    private readonly adminService: AdminService,
    private readonly subscriptionService: SubscriptionService,
    private readonly systemConfigService: SystemConfigService,
  ) {}

  // --- Plan Config ---

  @Get('plan-config')
  getPlanConfigs() {
    return this.subscriptionService.getAllPlanConfigs();
  }

  @Post('plan-config')
  updatePlanConfig(
    @Body() dto: UpdatePlanConfigDto,
    @CurrentUser() user: JwtUser,
  ) {
    return this.subscriptionService.upsertPlanConfig(
      dto.planCode,
      dto.monthlySessionQuota,
      dto.testsPerSession ?? 10,
      dto.monthlyPrice ?? 0,
      dto.trialDays ?? 0,
      user.userId,
    );
  }

  // --- Tenant: session quota ---

  @Get('tenants/:id/quota')
  getTenantQuota(@Param('id') id: string) {
    return this.subscriptionService.getMonthlyUsage(id);
  }

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

  // --- System Config ---

  @Get('system-config')
  async getSystemConfig() {
    return this.systemConfigService.getAll();
  }

  @Patch('system-config')
  async updateSystemConfig(
    @Body() dto: UpdateSystemConfigDto,
    @CurrentUser() user: JwtUser,
  ) {
    if (dto.useAuth0 !== undefined) {
      await this.systemConfigService.set(
        SYSTEM_CONFIG_KEYS.USE_AUTH0,
        String(dto.useAuth0),
        user.userId,
      );
    }
    return this.systemConfigService.getAll();
  }
}
