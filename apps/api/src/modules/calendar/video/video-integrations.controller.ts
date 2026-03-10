import {
  Controller,
  Get,
  Delete,
  Param,
  Query,
  Res,
} from '@nestjs/common';
import type { Response } from 'express';
import { ConfigService } from '@nestjs/config';
import { VideoIntegrationsService } from './video-integrations.service';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { Public } from '../../common/decorators/public.decorator';
import type { JwtUser } from '../../common/types/request.types';

@Controller('video-integrations')
@Roles('psychologist', 'assistant')
export class VideoIntegrationsController {
  constructor(
    private readonly service: VideoIntegrationsService,
    private readonly config: ConfigService,
  ) {}

  @Get('zoom/auth-url')
  @Roles('psychologist')
  getZoomAuthUrl(@CurrentUser() user: JwtUser) {
    return this.service.getZoomAuthUrl(user.tenantId!, user.userId!);
  }

  @Get('zoom/callback')
  @Public()
  async zoomCallback(
    @Query('code') code: string,
    @Query('state') state: string,
    @Res() res: Response,
  ) {
    const frontend = this.config.get('FRONTEND_URL', 'http://localhost:3000');
    if (!code || !state) {
      return res.redirect(`${frontend}/settings/integrations?error=missing_params`);
    }
    try {
      const result = await this.service.handleZoomCallback(code, state);
      if (!result) {
        return res.redirect(`${frontend}/settings/integrations?error=invalid_state`);
      }
      return res.redirect(`${frontend}/settings/integrations?zoom=connected`);
    } catch {
      return res.redirect(`${frontend}/settings/integrations?error=exchange_failed`);
    }
  }

  @Get()
  list(@CurrentUser() user: JwtUser) {
    return this.service.listVideo(user.tenantId!, user.userId);
  }

  @Delete(':id')
  @Roles('psychologist')
  async disconnect(
    @Param('id') id: string,
    @CurrentUser() user: JwtUser,
  ) {
    await this.service.disconnectVideo(id, user.tenantId!);
    return { success: true };
  }
}
