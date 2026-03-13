import {
  Body,
  Controller,
  Headers,
  HttpCode,
  HttpStatus,
  Post,
  RawBodyRequest,
  Req,
  BadRequestException,
  UseGuards,
} from '@nestjs/common';
import type { Request } from 'express';
import { StripeService } from './stripe.service';
import { WebhookIdempotencyService } from '../common/services/webhook-idempotency.service';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import type { JwtUser } from '../common/types/request.types';
import { ConfigService } from '@nestjs/config';

@Controller('payments')
export class PaymentsController {
  constructor(
    private readonly stripeService: StripeService,
    private readonly webhookIdempotency: WebhookIdempotencyService,
    private readonly config: ConfigService,
  ) {}

  @Post('webhook')
  @HttpCode(HttpStatus.OK)
  async handleWebhook(
    @Req() req: RawBodyRequest<Request>,
    @Headers('stripe-signature') signature: string,
  ) {
    const rawBody = req.rawBody;
    if (!rawBody || !signature) {
      throw new BadRequestException('Webhook imzası eksik');
    }

    let event;
    try {
      event = this.stripeService.constructWebhookEvent(rawBody, signature);
    } catch {
      throw new BadRequestException('Geçersiz webhook imzası');
    }

    const alreadyProcessed = await this.webhookIdempotency.isProcessed('stripe', event.id);
    if (alreadyProcessed) {
      return { received: true, duplicate: true };
    }

    await this.webhookIdempotency.markProcessed('stripe', event.id, event.type);

    // Event type handler'ları buraya eklenecek
    return { received: true };
  }

  @Post('checkout')
  @Roles('psychologist')
  async createCheckoutSession(
    @Body()
    body: {
      amount: number;
      currency?: string;
      description?: string;
      sessionPaymentId?: string;
    },
    @CurrentUser() user: JwtUser,
  ) {
    const frontendUrl = this.config.get<string>('FRONTEND_URL', 'http://localhost:3000');
    const session = await this.stripeService.createCheckoutSession(
      body.amount,
      body.currency ?? 'try',
      {
        tenantId: user.tenantId!,
        userId: user.userId!,
        description: body.description ?? 'Seans Ücreti',
        ...(body.sessionPaymentId && { sessionPaymentId: body.sessionPaymentId }),
      },
      `${frontendUrl}/finance?checkout=success`,
      `${frontendUrl}/finance?checkout=cancel`,
    );

    return { checkoutUrl: session.url, sessionId: session.id };
  }
}
