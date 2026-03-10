import { Request } from 'express';

export interface JwtUser {
  sub: string;
  tenantId: string;
  userId: string;
  email?: string;
  fullName?: string;
  role: string;
  is2faEnabled: boolean;
}

export interface RequestWithUser extends Request {
  user: JwtUser;
}
