import {
  Controller,
  Get,
  Post,
  Delete,
  Param,
  Query,
  Res,
  Headers,
} from '@nestjs/common';
import type { Response } from 'express';
import { ConfigService } from '@nestjs/config';
import { CalendarIntegrationsService } from './calendar-integrations.service';
import { GoogleCalendarService } from '../calendar-sync/google-calendar.service';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { Public } from '../../common/decorators/public.decorator';
import type { JwtUser } from '../../common/types/request.types';

@Controller('calendar-integrations')
@Roles('psychologist', 'assistant')
export class CalendarIntegrationsController {
  constructor(
    private readonly service: CalendarIntegrationsService,
    private readonly config: ConfigService,
  ) {}

  @Get('google/auth-url')
  @Roles('psychologist')
  getGoogleAuthUrl(@CurrentUser() user: JwtUser) {
    return this.service.getGoogleAuthUrl(user.tenantId!, user.userId!);
  }

  @Get('outlook/auth-url')
  @Roles('psychologist')
  getOutlookAuthUrl(@CurrentUser() user: JwtUser) {
    return this.service.getOutlookAuthUrl(user.tenantId!, user.userId!);
  }

  @Get('google/callback')
  @Public()
  async googleCallback(
    @Query('code') code: string,
    @Query('state') state: string,
    @Res() res: Response,
  ) {
    const frontend = this.config.get('FRONTEND_URL', 'http://localhost:3000');
    if (!code || !state) {
      return res.redirect(`${frontend}/settings/integrations?error=missing_params`);
    }
    try {
      const result = await this.service.handleGoogleCallback(code, state);
      if (!result) {
        return res.redirect(`${frontend}/settings/integrations?error=invalid_state`);
      }
      return res.redirect(`${frontend}/settings/integrations?google=connected`);
    } catch {
      return res.redirect(`${frontend}/settings/integrations?error=exchange_failed`);
    }
  }

  @Get('outlook/callback')
  @Public()
  async outlookCallback(
    @Query('code') code: string,
    @Query('state') state: string,
    @Res() res: Response,
  ) {
    const frontend = this.config.get('FRONTEND_URL', 'http://localhost:3000');
    if (!code || !state) {
      return res.redirect(`${frontend}/settings/integrations?error=missing_params`);
    }
    try {
      const result = await this.service.handleOutlookCallback(code, state);
      if (!result) {
        return res.redirect(`${frontend}/settings/integrations?error=invalid_state`);
      }
      return res.redirect(`${frontend}/settings/integrations?outlook=connected`);
    } catch {
      return res.redirect(`${frontend}/settings/integrations?error=exchange_failed`);
    }
  }

  @Get()
  list(@CurrentUser() user: JwtUser) {
    return this.service.list(user.tenantId!, user.userId);
  }

  @Delete(':id')
  @Roles('psychologist')
  async disconnect(
    @Param('id') id: string,
    @CurrentUser() user: JwtUser,
  ) {
    await this.service.disconnect(id, user.tenantId!);
    return { success: true };
  }

  @Post(':id/sync')
  @Roles('psychologist')
  async triggerSync(
    @Param('id') id: string,
    @CurrentUser() user: JwtUser,
  ) {
    await this.service.triggerSync(id, user.tenantId!);
    return { success: true };
  }

  @Post('webhook')
  @Public()
  async webhook(@Headers('x-goog-channel-id') channelId: string) {
    if (!channelId) return { received: true };
    await this.service.handleWebhook(channelId);
    return { received: true };
  }
}
