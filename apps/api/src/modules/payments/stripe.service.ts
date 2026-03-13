import { Injectable, InternalServerErrorException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Stripe from 'stripe';

@Injectable()
export class StripeService {
  private readonly stripe: Stripe;
  private readonly webhookSecret: string;

  constructor(private readonly config: ConfigService) {
    const secretKey = this.config.get<string>('STRIPE_SECRET_KEY') ?? '';
    this.stripe = new Stripe(secretKey, { apiVersion: '2026-02-25.clover' });
    this.webhookSecret = this.config.get<string>('STRIPE_WEBHOOK_SECRET') ?? '';
  }

  async createPaymentIntent(
    amount: number,
    currency: string,
    metadata: Record<string, string>,
  ): Promise<Stripe.PaymentIntent> {
    return this.stripe.paymentIntents.create({
      amount,
      currency,
      metadata,
      capture_method: 'manual',
    });
  }

  async capturePayment(paymentIntentId: string): Promise<Stripe.PaymentIntent> {
    return this.stripe.paymentIntents.capture(paymentIntentId);
  }

  async voidPayment(paymentIntentId: string): Promise<Stripe.PaymentIntent> {
    return this.stripe.paymentIntents.cancel(paymentIntentId);
  }

  async createCheckoutSession(
    amount: number,
    currency: string,
    metadata: Record<string, string>,
    successUrl: string,
    cancelUrl: string,
  ): Promise<Stripe.Checkout.Session> {
    return this.stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      line_items: [
        {
          price_data: {
            currency,
            product_data: { name: metadata.description ?? 'Seans Ücreti' },
            unit_amount: amount,
          },
          quantity: 1,
        },
      ],
      mode: 'payment',
      success_url: successUrl,
      cancel_url: cancelUrl,
      metadata,
    });
  }

  constructWebhookEvent(body: Buffer, signature: string): Stripe.Event {
    if (!this.webhookSecret) {
      throw new InternalServerErrorException('STRIPE_WEBHOOK_SECRET yapılandırılmamış');
    }
    return this.stripe.webhooks.constructEvent(body, signature, this.webhookSecret);
  }
}
