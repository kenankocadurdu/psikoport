import {
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Reflector } from '@nestjs/core';
import { AuthGuard } from '@nestjs/passport';
import * as jwt from 'jsonwebtoken';
import type { JwtUser } from '../types/request.types';
import { PrismaService } from '../../../database/prisma.service';
import { IS_PUBLIC_KEY } from '../decorators/public.decorator';

@Injectable()
export class JwtAuthGuard extends AuthGuard('jwt') {
  constructor(
    private readonly reflector: Reflector,
    private readonly prisma: PrismaService,
    private readonly configService: ConfigService,
  ) {
    super();
  }

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPublic) return true;

    const request = context
      .switchToHttp()
      .getRequest<{ url?: string; headers?: { authorization?: string }; user?: JwtUser }>();
    if (request.url?.startsWith('/api/docs')) return true;

    // E2E: try HS256 token first when E2E_TEST=1
    if (this.configService.get<string>('E2E_TEST') === '1') {
      const auth = request.headers?.authorization;
      const token = auth?.startsWith('Bearer ') ? auth.slice(7) : null;
      if (token) {
        const secret = this.configService.get<string>('E2E_JWT_SECRET') ?? 'e2e-test-secret';
        try {
          const payload = jwt.verify(token, secret, { algorithms: ['HS256'] }) as { sub?: string; tenant_id?: string };
          if (payload?.sub && payload?.tenant_id) {
            const user = await this.prisma.user.findFirst({
              where: { auth0Sub: payload.sub, tenantId: payload.tenant_id },
              include: { tenant: true },
            });
            if (user?.isActive && user?.tenant?.isActive) {
              request.user = {
                sub: payload.sub,
                tenantId: user.tenantId,
                userId: user.id,
                email: user.email ?? undefined,
                fullName: user.fullName ?? undefined,
                role: user.role,
                is2faEnabled: user.is2faEnabled ?? true,
              };
              await this.prisma.$executeRaw`SELECT set_current_tenant(${user.tenantId})`;
              return true;
            }
          }
        } catch {
          // Not an E2E token, fall through to Auth0 JWT
        }
      }
    }

    const result = (await super.canActivate(context)) as boolean;
    if (!result) return false;

    const user = request.user;
    if (!user?.tenantId) {
      throw new UnauthorizedException('Invalid token: missing tenant');
    }

    await this.prisma.$executeRaw`SELECT set_current_tenant(${user.tenantId})`;

    return true;
  }
}
