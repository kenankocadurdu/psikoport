import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Put,
  Query,
} from '@nestjs/common';
import { PaymentsService } from './payments.service';
import { PaymentSettingsService } from './payment-settings.service';
import { PaymentQueryDto } from './dto/payment-query.dto';
import { UpdatePaymentStatusDto } from './dto/update-payment-status.dto';
import { UpdatePaymentSettingsDto } from './dto/update-payment-settings.dto';
import { SummaryQueryDto } from './dto/summary-query.dto';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { AuditLog } from '../common/decorators/audit-log.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import type { JwtUser } from '../common/types/request.types';

@Controller('finance')
@Roles('psychologist', 'assistant')
export class FinanceController {
  constructor(
    private readonly paymentsService: PaymentsService,
    private readonly paymentSettingsService: PaymentSettingsService,
  ) {}

  @Get('payments')
  async listPayments(
    @Query() query: PaymentQueryDto,
    @CurrentUser() user: JwtUser,
  ) {
    return this.paymentsService.findAll(user.tenantId!, {
      start: query.start,
      end: query.end,
      status: query.status,
      clientId: query.clientId,
      appointmentId: query.appointmentId,
      psychologistId: query.psychologistId,
      page: query.page,
      limit: query.limit,
    });
  }

  @Get('payments/:id')
  @AuditLog({ action: 'view', resourceType: 'payment' })
  async getPayment(
    @Param('id') id: string,
    @CurrentUser() user: JwtUser,
  ) {
    const payment = await this.paymentsService.findOne(id, user.tenantId!);
    const invoiceWarning =
      payment.status === 'PAID' && payment.invoiceStatus === 'NOT_ISSUED'
        ? 'Makbuz kesilmedi'
        : undefined;
    return { ...payment, invoiceWarning };
  }

  @Patch('payments/:id')
  @Roles('psychologist')
  @AuditLog({ action: 'update', resourceType: 'payment' })
  async updatePaymentStatus(
    @Param('id') id: string,
    @Body() dto: UpdatePaymentStatusDto,
    @CurrentUser() user: JwtUser,
  ) {
    const result = await this.paymentsService.updatePaymentStatus(
      id,
      user.tenantId!,
      dto.status as 'PENDING' | 'PAID' | 'PARTIAL' | 'CANCELLED',
      dto.paidAmount,
      dto.paymentMethod,
    );
    const payment = await this.paymentsService.findOne(id, user.tenantId!);
    const invoiceWarning =
      payment.status === 'PAID' && payment.invoiceStatus === 'NOT_ISSUED'
        ? 'Makbuz kesilmedi'
        : undefined;
    return { ...result, invoiceWarning };
  }

  @Get('summary')
  async getSummary(
    @Query() query: SummaryQueryDto,
    @CurrentUser() user: JwtUser,
  ) {
    return this.paymentsService.getRevenueSummary(
      user.tenantId!,
      query.period ?? 'monthly',
      undefined,
    );
  }

  @Get('summary/month')
  async getMonthSummary(@CurrentUser() user: JwtUser) {
    return this.paymentsService.getMonthSummary(user.tenantId!);
  }

  @Get('summary/chart')
  async getChartData(
    @CurrentUser() user: JwtUser,
    @Query('months') monthsStr?: string,
  ) {
    const months = Math.min(Math.max(parseInt(monthsStr ?? '6', 10) || 6, 1), 12);
    return this.paymentsService.getMonthlyChartData(user.tenantId!, months);
  }

  @Get('settings')
  async getSettings(@CurrentUser() user: JwtUser) {
    return this.paymentSettingsService.getSettings(
      user.userId!,
      user.tenantId!,
    );
  }

  @Put('settings')
  @Roles('psychologist')
  @AuditLog({ action: 'update', resourceType: 'payment-settings' })
  async updateSettings(
    @Body() dto: UpdatePaymentSettingsDto,
    @CurrentUser() user: JwtUser,
  ) {
    return this.paymentSettingsService.updateSettings(
      user.userId!,
      user.tenantId!,
      dto,
    );
  }
}
