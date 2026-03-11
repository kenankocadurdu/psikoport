import { Body, Controller, Get, Param, Patch, Post, Query } from '@nestjs/common';
import { IsEnum, IsInt, IsOptional, Min } from 'class-validator';
import { TenantPlan } from 'prisma-client';
import { AdminService } from './admin.service';
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

@Controller('admin')
@Roles('super_admin')
export class AdminController {
  constructor(
    private readonly adminService: AdminService,
    private readonly subscriptionService: SubscriptionService,
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
}
