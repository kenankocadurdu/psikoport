import {
  Injectable,
  CanActivate,
  ExecutionContext,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { QUOTA_RESOURCE_KEY, QuotaResource } from '../decorators/quota.decorator';
import { SubscriptionService } from '../../subscriptions/subscription.service';
import { PrismaService } from '../../../database/prisma.service';
import type { Request } from 'express';

@Injectable()
export class QuotaGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly subscriptionService: SubscriptionService,
    private readonly prisma: PrismaService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const resource = this.reflector.getAllAndOverride<QuotaResource>(
      QUOTA_RESOURCE_KEY,
      [context.getHandler(), context.getClass()],
    );

    if (!resource) return true;

    const request = context.switchToHttp().getRequest<Request & { user?: { tenantId?: string } }>();
    const tenantId = request.user?.tenantId;

    if (!tenantId) return true;

    const exceeded = await this.isQuotaExceeded(tenantId, resource);

    if (exceeded) {
      throw new HttpException(
        { message: 'Quota exceeded', code: 'QUOTA_EXCEEDED', resource },
        HttpStatus.PAYMENT_REQUIRED,
      );
    }

    return true;
  }

  private async isQuotaExceeded(tenantId: string, resource: QuotaResource): Promise<boolean> {
    if (resource === 'sessions') {
      const usage = await this.subscriptionService.getMonthlyUsage(tenantId);
      return usage.remaining === 0;
    }

    const sub = await this.subscriptionService.getActiveSubscription(tenantId);
    if (!sub) return false;

    const planConfig = await this.subscriptionService.getCurrentPlanConfig(sub.planCode);

    if (resource === 'custom_forms') {
      const count = await this.prisma.formDefinition.count({
        where: { tenantId, isActive: true },
      });
      return count >= planConfig.customFormQuota;
    }

    // 'clients': no hard limit defined in current schema
    return false;
  }
}
