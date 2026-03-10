import { SetMetadata } from '@nestjs/common';

export const ROLES_KEY = 'roles';

export type RoleType =
  | 'super_admin'
  | 'psychologist'
  | 'assistant'
  | 'SUPER_ADMIN'
  | 'PSYCHOLOGIST'
  | 'ASSISTANT';

export const Roles = (...roles: RoleType[]) => SetMetadata(ROLES_KEY, roles);
