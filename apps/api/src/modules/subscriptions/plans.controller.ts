import { Controller, Get } from '@nestjs/common';
import { Public } from '../common/decorators/public.decorator';
import { SubscriptionService } from './subscription.service';

@Controller('plans')
export class PlansController {
  constructor(private readonly subscriptionService: SubscriptionService) {}

  /** Kayıt sayfası için auth gerektirmeyen plan listesi */
  @Public()
  @Get()
  getPublicPlans() {
    return this.subscriptionService.getAllPlanConfigs();
  }
}
