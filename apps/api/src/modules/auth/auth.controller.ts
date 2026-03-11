import { Body, Controller, Get, Post, Query } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { AuditLog } from '../common/decorators/audit-log.decorator';
import { AuthService } from './auth.service';
import { RegisterDto } from './dto/register.dto';
import { LoginCallbackDto } from './dto/login-callback.dto';
import { InviteDto } from './dto/invite.dto';
import { InviteAcceptDto } from './dto/invite-accept.dto';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Public } from '../common/decorators/public.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import { Skip2FA } from '../common/decorators/skip-2fa.decorator';
import type { JwtUser } from '../common/types/request.types';

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Public()
  @Throttle({ default: { limit: 20, ttl: 15 * 60 * 1000 } })
  @Post('register')
  async register(@Body() dto: RegisterDto) {
    return this.authService.register(dto);
  }

  @Public()
  @Throttle({ default: { limit: 20, ttl: 15 * 60 * 1000 } })
  @Post('login-callback')
  async loginCallback(@Body() dto: LoginCallbackDto) {
    return this.authService.loginCallback(dto.auth0Token);
  }

  @Roles('psychologist')
  @AuditLog({ action: 'invite', resourceType: 'assistant' })
  @Post('invite')
  async invite(@Body() dto: InviteDto, @CurrentUser() user: JwtUser) {
    return this.authService.invite(
      user.tenantId,
      user.userId,
      user.fullName ?? user.email ?? 'Psikolog',
      dto.email,
    );
  }

  @Public()
  @Get('invite/validate')
  async validateInvite(@Query('token') token: string) {
    const data = await this.authService.validateInvite(token ?? '');
    if (!data) {
      return { valid: false };
    }
    return { valid: true, ...data };
  }

  @Public()
  @Throttle({ default: { limit: 10, ttl: 60 * 1000 } })
  @Post('invite/accept')
  async acceptInvite(@Body() dto: InviteAcceptDto) {
    return this.authService.acceptInvite(dto.token, dto.auth0Token);
  }

  @Public()
  @Get('e2e-token')
  async getE2EToken() {
    return this.authService.getE2EToken();
  }

  @Skip2FA()
  @Get('me')
  async me(@CurrentUser() user: JwtUser) {
    return this.authService.me(user);
  }

  @Roles('psychologist')
  @Post('license/upload-url')
  async getLicenseUploadUrl(
    @Query('filename') filename: string,
    @Query('contentType') contentType: string,
    @CurrentUser() user: JwtUser,
  ) {
    return this.authService.getLicenseUploadUrl(
      user.userId!,
      user.tenantId!,
      filename ?? 'diploma.pdf',
      contentType ?? 'application/pdf',
    );
  }

  @Roles('psychologist')
  @Post('license/confirm')
  async confirmLicenseUpload(
    @Body() dto: { key: string },
    @CurrentUser() user: JwtUser,
  ) {
    return this.authService.confirmLicenseUpload(
      user.userId!,
      user.tenantId!,
      dto.key,
    );
  }
}
