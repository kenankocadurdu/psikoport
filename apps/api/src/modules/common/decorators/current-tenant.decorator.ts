import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import { JwtUser } from '../types/request.types';

export const CurrentTenant = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): string => {
    const request = ctx.switchToHttp().getRequest<{ user?: JwtUser }>();
    return request.user?.tenantId ?? '';
  },
);
