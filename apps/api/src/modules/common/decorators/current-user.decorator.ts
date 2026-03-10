import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import { JwtUser } from '../types/request.types';

export type JwtUserPayload = JwtUser;

export const CurrentUser = createParamDecorator(
  (
    data: keyof JwtUser | undefined,
    ctx: ExecutionContext,
  ): JwtUser | string | boolean | undefined => {
    const request = ctx.switchToHttp().getRequest<{ user: JwtUser }>();
    const user = request.user;
    return data ? user?.[data] : user;
  },
);
