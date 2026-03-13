import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { PaymentStatus, Prisma } from 'prisma-client';
import { Decimal } from 'prisma-client/runtime/library';

@Injectable()
export class PaymentsService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Randevu "completed" olduğunda otomatik ödeme kaydı.
   * Ücret: danışan özel ücreti || psikolog varsayılan ücreti || tenant varsayılanı || 0.
   */
  async createFromAppointment(
    appointmentId: string,
    tenantId: string,
  ): Promise<{ id: string }> {
    const appointment = await this.prisma.appointment.findFirst({
      where: { id: appointmentId, tenantId },
      include: {
        client: true,
        tenant: true,
      },
    });
    if (!appointment) {
      throw new NotFoundException('Randevu bulunamadı');
    }

    const paymentSettings = await this.prisma.paymentSettings.findUnique({
      where: {
        tenantId_psychologistId: {
          tenantId,
          psychologistId: appointment.psychologistId,
        },
      },
    });

    const clientFee = appointment.client.sessionFee
      ? Number(appointment.client.sessionFee)
      : null;
    const psychologistFee = paymentSettings?.defaultSessionFee
      ? Number(paymentSettings.defaultSessionFee)
      : null;
    const tenantFee = appointment.tenant.defaultSessionFee
      ? Number(appointment.tenant.defaultSessionFee)
      : null;

    const amount = clientFee ?? psychologistFee ?? tenantFee ?? 0;
    const preferredCurrency =
      paymentSettings?.currency ??
      appointment.tenant.defaultCurrency ??
      'TRY';
    const supported: string[] = (paymentSettings as any)?.supportedCurrencies ?? ['TRY'];
    const currency = supported.includes(preferredCurrency)
      ? preferredCurrency
      : (supported[0] ?? 'TRY');

    const existing = await this.prisma.sessionPayment.findUnique({
      where: { appointmentId },
    });
    if (existing) {
      return { id: existing.id };
    }

    const payment = await this.prisma.sessionPayment.create({
      data: {
        tenantId,
        clientId: appointment.clientId,
        appointmentId: appointment.id,
        psychologistId: appointment.psychologistId,
        sessionDate: appointment.startTime,
        amount,
        currency,
        status: 'PENDING',
      },
    });

    return { id: payment.id };
  }

  async updatePaymentStatus(
    id: string,
    tenantId: string,
    status: PaymentStatus,
    paidAmount?: number,
    paymentMethod?: string,
  ): Promise<{ id: string; status: string }> {
    const existing = await this.prisma.sessionPayment.findFirst({
      where: { id, tenantId },
    });
    if (!existing) {
      throw new NotFoundException('Ödeme bulunamadı');
    }

    const effectivePaidAmount =
      status === 'PAID' ? (paidAmount ?? Number(existing.amount)) : undefined;

    const data: Prisma.SessionPaymentUpdateInput = {
      status,
      ...(status === 'PAID' && {
        paidAmount: effectivePaidAmount,
        paidAt: new Date(),
        ...(paymentMethod && { paymentMethod }),
        // Eğer base amount sıfırsa (ücret ayarlanmamışsa) tahsil edilen tutarı kaydet
        ...(Number(existing.amount) === 0 &&
          effectivePaidAmount != null &&
          effectivePaidAmount > 0 && {
            amount: new Decimal(effectivePaidAmount),
          }),
      }),
      ...(status === 'PARTIAL' &&
        paidAmount != null && {
          paidAmount: new Decimal(paidAmount),
          paidAt: new Date(),
          ...(paymentMethod && { paymentMethod }),
        }),
    };

    const updated = await this.prisma.sessionPayment.update({
      where: { id },
      data,
    });

    return { id: updated.id, status: updated.status };
  }

  async findByClient(
    clientId: string,
    tenantId: string,
    dateRange?: { start?: string; end?: string },
  ) {
    const where: Prisma.SessionPaymentWhereInput = {
      clientId,
      tenantId,
    };
    if (dateRange?.start || dateRange?.end) {
      where.sessionDate = {};
      if (dateRange.start) {
        (where.sessionDate as Prisma.DateTimeFilter).gte = new Date(dateRange.start);
      }
      if (dateRange.end) {
        (where.sessionDate as Prisma.DateTimeFilter).lte = new Date(dateRange.end);
      }
    }

    return this.prisma.sessionPayment.findMany({
      where,
      orderBy: { sessionDate: 'desc' },
      include: {
        appointment: { select: { id: true, startTime: true, status: true } },
        psychologist: { select: { fullName: true } },
      },
    });
  }

  async getRevenueSummary(
    tenantId: string,
    period: 'weekly' | 'monthly',
    psychologistId?: string,
  ) {
    const now = new Date();
    const start =
      period === 'weekly'
        ? new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)
        : new Date(now.getFullYear(), now.getMonth(), 1);

    const where: Prisma.SessionPaymentWhereInput = {
      tenantId,
      sessionDate: { gte: start },
      status: { in: ['PENDING', 'PAID', 'PARTIAL'] },
    };
    if (psychologistId) {
      where.psychologistId = psychologistId;
    }

    const payments = await this.prisma.sessionPayment.findMany({
      where,
      select: {
        amount: true,
        paidAmount: true,
        status: true,
      },
    });

    const totalRevenue = payments.reduce((sum, p) => sum + Number(p.amount), 0);
    const collected = payments.reduce(
      (sum, p) => sum + (p.paidAmount ? Number(p.paidAmount) : 0),
      0,
    );
    const pending = totalRevenue - collected;
    const unpaidCount = payments.filter((p) => p.status === 'PENDING').length;

    return {
      totalRevenue,
      collected,
      pending,
      unpaidCount,
      period,
      from: start.toISOString(),
      to: now.toISOString(),
    };
  }

  /** Son N ay için aylık gelir çizelgesi verisi */
  async getMonthlyChartData(
    tenantId: string,
    months: number = 6,
    psychologistId?: string,
  ) {
    const result: Array<{
      month: string;
      monthLabel: string;
      totalRevenue: number;
      collected: number;
      pending: number;
    }> = [];

    const now = new Date();
    for (let i = months - 1; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const start = new Date(d.getFullYear(), d.getMonth(), 1);
      const end = new Date(d.getFullYear(), d.getMonth() + 1, 0, 23, 59, 59);

      const where: Prisma.SessionPaymentWhereInput = {
        tenantId,
        sessionDate: { gte: start, lte: end },
        status: { in: ['PENDING', 'PAID', 'PARTIAL'] },
      };
      if (psychologistId) where.psychologistId = psychologistId;

      const payments = await this.prisma.sessionPayment.findMany({
        where,
        select: {
          amount: true,
          paidAmount: true,
          status: true,
        },
      });

      const totalRevenue = payments.reduce((sum, p) => sum + Number(p.amount), 0);
      const collected = payments.reduce(
        (sum, p) => sum + (p.paidAmount ? Number(p.paidAmount) : 0),
        0,
      );

      result.push({
        month: `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`,
        monthLabel: d.toLocaleDateString('tr-TR', { month: 'short', year: '2-digit' }),
        totalRevenue,
        collected,
        pending: totalRevenue - collected,
      });
    }

    return result;
  }

  /** Bu ay için özet (toplam, tahsil, bekleyen, iptal) */
  async getMonthSummary(tenantId: string, psychologistId?: string) {
    const now = new Date();
    const start = new Date(now.getFullYear(), now.getMonth(), 1);

    const where: Prisma.SessionPaymentWhereInput = {
      tenantId,
      sessionDate: { gte: start },
    };
    if (psychologistId) where.psychologistId = psychologistId;

    const payments = await this.prisma.sessionPayment.findMany({
      where,
      select: {
        amount: true,
        paidAmount: true,
        status: true,
      },
    });

    const total = payments
      .filter((p) => ['PENDING', 'PAID', 'PARTIAL'].includes(p.status))
      .reduce((sum, p) => sum + Number(p.amount), 0);
    const collected = payments.reduce(
      (sum, p) => sum + (p.paidAmount ? Number(p.paidAmount) : 0),
      0,
    );
    const pending = total - collected;
    const cancelled = payments
      .filter((p) => p.status === 'CANCELLED')
      .reduce((sum, p) => sum + Number(p.amount), 0);

    return { total, collected, pending, cancelled };
  }

  async findAll(
    tenantId: string,
    query: {
      start?: string;
      end?: string;
      status?: string;
      clientId?: string;
      appointmentId?: string;
      psychologistId?: string;
      page?: number;
      limit?: number;
    },
  ) {
    const page = query.page ?? 1;
    const limit = query.limit ?? 50;
    const skip = (page - 1) * limit;

    const where: Prisma.SessionPaymentWhereInput = { tenantId };

    if (query.start || query.end) {
      where.sessionDate = {};
      if (query.start) {
        (where.sessionDate as Prisma.DateTimeFilter).gte = new Date(query.start);
      }
      if (query.end) {
        (where.sessionDate as Prisma.DateTimeFilter).lte = new Date(query.end);
      }
    }
    if (query.status) {
      where.status = query.status as PaymentStatus;
    }
    if (query.clientId) where.clientId = query.clientId;
    if (query.appointmentId) where.appointmentId = query.appointmentId;
    if (query.psychologistId) where.psychologistId = query.psychologistId;

    const [items, total] = await Promise.all([
      this.prisma.sessionPayment.findMany({
        where,
        skip,
        take: limit,
        orderBy: { sessionDate: 'desc' },
        include: {
          client: {
            select: { id: true, firstName: true, lastName: true, phone: true },
          },
          psychologist: { select: { id: true, fullName: true } },
          appointment: { select: { id: true, startTime: true } },
        },
      }),
      this.prisma.sessionPayment.count({ where }),
    ]);

    return {
      items,
      meta: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async findOne(id: string, tenantId: string) {
    const payment = await this.prisma.sessionPayment.findFirst({
      where: { id, tenantId },
      include: {
        client: { select: { id: true, firstName: true, lastName: true } },
        psychologist: { select: { id: true, fullName: true } },
        appointment: { select: { id: true, startTime: true, status: true } },
      },
    });
    if (!payment) {
      throw new NotFoundException('Ödeme bulunamadı');
    }
    return payment;
  }

  /**
   * Ödenmemiş seansları bul (sessionDate + reminderDays sonra).
   * BullMQ payment-reminder job için kullanılır.
   */
  async findUnpaidForReminder(
    tenantId: string,
    reminderDays: number,
    psychologistId?: string,
  ): Promise<
    Array<{
      id: string;
      clientId: string;
      amount: number;
      sessionDate: Date;
      clientPhone: string | null;
    }>
  > {
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - reminderDays);

    const where: Prisma.SessionPaymentWhereInput = {
      tenantId,
      status: 'PENDING',
      sessionDate: { lte: cutoff },
      amount: { gt: 0 },
    };
    if (psychologistId) {
      where.psychologistId = psychologistId;
    }

    const payments = await this.prisma.sessionPayment.findMany({
      where,
      include: {
        client: { select: { phone: true } },
      },
    });

    return payments
      .filter((p) => p.client.phone)
      .map((p) => ({
        id: p.id,
        clientId: p.clientId,
        amount: Number(p.amount),
        sessionDate: p.sessionDate,
        clientPhone: p.client.phone,
      }));
  }
}
