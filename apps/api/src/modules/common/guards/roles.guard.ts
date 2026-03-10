import {
  CanActivate,
  ExecutionContext,
  Injectable,
  ForbiddenException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { ROLES_KEY, RoleType } from '../decorators/roles.decorator';
import { ASSISTANT_FORBIDDEN_KEY } from '../decorators/assistant-forbidden.decorator';
import { IS_PUBLIC_KEY } from '../decorators/public.decorator';

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPublic) return true;

    const request = context
      .switchToHttp()
      .getRequest<{ user?: { role: string } }>();
    const user = request.user;

    // Assistant cannot access endpoints marked @AssistantForbidden (e.g. notes read)
    const assistantForbidden = this.reflector.getAllAndOverride<boolean>(
      ASSISTANT_FORBIDDEN_KEY,
      [context.getHandler(), context.getClass()],
    );
    if (assistantForbidden && user?.role) {
      const userRole = String(user.role).toUpperCase();
      if (userRole === 'ASSISTANT') {
        throw new ForbiddenException(
          'Bu kaynağa erişim yetkiniz yok (sadece psikolog)',
        );
      }
    }

    const requiredRoles = this.reflector.getAllAndOverride<RoleType[]>(
      ROLES_KEY,
      [context.getHandler(), context.getClass()],
    );

    if (!requiredRoles?.length) {
      return true;
    }

    if (!user?.role) {
      throw new ForbiddenException('Access denied');
    }

    const userRole = String(user.role).toUpperCase();
    const hasRole = requiredRoles.some(
      (role) => String(role).toUpperCase() === userRole,
    );

    if (!hasRole) {
      throw new ForbiddenException('Insufficient permissions');
    }

    return true;
  }
}
