import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import { ConsentService } from './consent.service';
import { GrantConsentDto } from './dto/grant-consent.dto';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Public } from '../common/decorators/public.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import type { JwtUser } from '../common/types/request.types';
import type { ConsentType } from 'prisma-client';
import type { Request } from 'express';

@Controller('consents')
export class ConsentController {
  constructor(private readonly consentService: ConsentService) {}

  /**
   * Get active (latest) consent text for a type. Public for display before consent.
   */
  @Public()
  @Get('texts/:type')
  async getConsentText(@Param('type') type: string) {
    const validType = type.toUpperCase().replace(/-/g, '_') as ConsentType;
    const allowed: ConsentType[] = [
      'KVKK_DATA_PROCESSING',
      'KVKK_SPECIAL_DATA',
      'SESSION_RECORDING',
      'ONLINE_CONSULTATION',
      'CANCELLATION_POLICY',
      'PLATFORM_TOS',
    ];
    if (!allowed.includes(validType)) {
      return { data: null };
    }
    const text = await this.consentService.getActiveConsentText(validType);
    return { data: text };
  }

  /**
   * Grant consent. Requires psychologist or assistant.
   */
  @Roles('psychologist', 'assistant')
  @Post()
  async grantConsent(
    @Body() dto: GrantConsentDto,
    @CurrentUser() user: JwtUser,
    @Req() req: Request,
  ) {
    const ip =
      req.ip ?? (req as { connection?: { remoteAddress?: string } }).connection?.remoteAddress;
    const userAgent = req.headers['user-agent'];
    const result = await this.consentService.grantConsent(
      user.tenantId,
      dto.clientId ?? null,
      dto.consentType as ConsentType,
      dto.textVersion,
      dto.bodyHash,
      ip,
      userAgent,
      dto.userId ?? user.userId,
    );
    return { data: result };
  }

  /**
   * Revoke a consent. Psychologist or assistant.
   */
  @Roles('psychologist', 'assistant')
  @Post(':id/revoke')
  async revokeConsent(
    @Param('id') id: string,
    @CurrentUser() user: JwtUser,
  ) {
    await this.consentService.revokeConsent(id, user.tenantId);
    return { data: { success: true } };
  }

  @Get('my-status')
  @Roles('psychologist', 'assistant')
  async getMyConsentStatus(@CurrentUser() user: JwtUser) {
    const pending = await this.consentService.getPendingConsentsForUser(
      user.tenantId!,
      user.userId!,
    );
    return { pendingConsents: pending };
  }

  /**
   * Get client's consent statuses. Psychologist or assistant.
   */
  @Roles('psychologist', 'assistant')
  @Get(':clientId')
  async getClientConsents(
    @Param('clientId') clientId: string,
    @CurrentUser() user: JwtUser,
  ) {
    const consents = await this.consentService.getClientConsents(
      user.tenantId,
      clientId,
    );
    const required = await this.consentService.checkRequiredConsents(
      user.tenantId,
      clientId,
    );
    return {
      data: { consents, required },
    };
  }
}
