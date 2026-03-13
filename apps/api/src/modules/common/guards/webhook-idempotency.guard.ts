import {
  Injectable,
  CanActivate,
  ExecutionContext,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import type { Request, Response } from 'express';
import { WebhookIdempotencyService } from '../services/webhook-idempotency.service';

@Injectable()
export class WebhookIdempotencyGuard implements CanActivate {
  constructor(
    private readonly webhookIdempotencyService: WebhookIdempotencyService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<Request & { webhookProvider?: string }>();
    const response = context.switchToHttp().getResponse<Response>();

    const provider = request.webhookProvider ?? 'unknown';
    const body = request.body as Record<string, unknown> | undefined;

    const eventId = body?.id as string | undefined;
    const eventType = body?.type as string | undefined;

    if (!eventId) {
      return true;
    }

    const alreadyProcessed = await this.webhookIdempotencyService.isProcessed(
      provider,
      eventId,
    );

    if (alreadyProcessed) {
      response.status(HttpStatus.OK).json({ received: true, duplicate: true });
      return false;
    }

    if (eventType) {
      await this.webhookIdempotencyService.markProcessed(provider, eventId, eventType);
    }

    return true;
  }
}
