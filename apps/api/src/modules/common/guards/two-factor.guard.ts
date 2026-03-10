import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { SKIP_2FA_KEY } from '../decorators/skip-2fa.decorator';

/**
 * is2faEnabled = false olan kullanıcılar dashboard API'lerine erişemez.
 * 403 döner, frontend /setup-2fa'ya yönlendirir.
 */
@Injectable()
export class TwoFactorGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const skip2fa = this.reflector.getAllAndOverride<boolean>(SKIP_2FA_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (skip2fa) return true;

    const request = context.switchToHttp().getRequest<{
      user?: { is2faEnabled?: boolean };
    }>();
    const user = request.user;

    if (!user) return true; // JWT guard zaten geçmediyse buraya gelmez

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
