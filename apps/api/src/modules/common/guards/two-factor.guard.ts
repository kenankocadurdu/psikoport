import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { SKIP_2FA_KEY } from '../decorators/skip-2fa.decorator';
import { SystemConfigService, SYSTEM_CONFIG_KEYS } from '../../admin/system-config.service';

/**
 * Auth0 aktifken kullanıcının 2FA kurulumu yoksa 403 döner.
 * Auth0 kapalıysa (local mod) guard tamamen bypass edilir.
 */
@Injectable()
export class TwoFactorGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly systemConfigService: SystemConfigService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const skip2fa = this.reflector.getAllAndOverride<boolean>(SKIP_2FA_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (skip2fa) return true;

    const request = context.switchToHttp().getRequest<{
      user?: { is2faEnabled?: boolean };
    }>();
    const user = request.user;

    if (!user) return true;

    // Auth0 kapalıysa 2FA kontrolü yapma
    const useAuth0 = await this.systemConfigService.getBoolean(SYSTEM_CONFIG_KEYS.USE_AUTH0);
    if (!useAuth0) return true;

    if (user.is2faEnabled !== true) {
      throw new ForbiddenException({
        code: '2FA_REQUIRED',
        message: '2FA kurulumu tamamlanmalı',
        redirectTo: '/setup-2fa',
      });
    }

    return true;
  }
}
