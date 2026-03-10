import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import type { UpdatePaymentSettingsDto } from './dto/update-payment-settings.dto';

@Injectable()
export class PaymentSettingsService {
  constructor(private readonly prisma: PrismaService) {}

  async getSettings(userId: string, tenantId: string) {
    let settings = await this.prisma.paymentSettings.findUnique({
      where: {
        tenantId_psychologistId: {
          tenantId,
          psychologistId: userId,
        },
      },
    });

    if (!settings) {
      settings = await this.prisma.paymentSettings.create({
        data: {
          tenantId,
          psychologistId: userId,
          currency: 'TRY',
          reminderDays: 3,
        },
      });
    }

    return settings;
  }

  async updateSettings(
    userId: string,
    tenantId: string,
    dto: UpdatePaymentSettingsDto,
  ) {
    return this.prisma.paymentSettings.upsert({
      where: {
        tenantId_psychologistId: {
          tenantId,
          psychologistId: userId,
        },
      },
      create: {
        tenantId,
        psychologistId: userId,
        defaultSessionFee: dto.defaultSessionFee,
        currency: dto.currency ?? 'TRY',
        reminderDays: dto.reminderDays ?? 3,
      },
      update: {
        ...(dto.defaultSessionFee !== undefined && {
          defaultSessionFee: dto.defaultSessionFee,
        }),
        ...(dto.currency !== undefined && { currency: dto.currency }),
        ...(dto.reminderDays !== undefined && {
          reminderDays: dto.reminderDays,
        }),
      },
    });
  }

  /**
   * Tüm psikologlar için reminderDays ayarını al.
   * BullMQ payment-reminder job tarafından kullanılır.
   */
  async getAllReminderDays(tenantId: string): Promise<Map<string, number>> {
    const settings = await this.prisma.paymentSettings.findMany({
      where: { tenantId },
      select: { psychologistId: true, reminderDays: true },
    });
    const map = new Map<string, number>();
    for (const s of settings) {
      map.set(s.psychologistId, s.reminderDays);
    }
    return map;
  }
}
