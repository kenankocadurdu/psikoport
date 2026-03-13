import { SetMetadata } from '@nestjs/common';

export type QuotaResource = 'clients' | 'sessions' | 'custom_forms';

export const QUOTA_RESOURCE_KEY = 'quota_resource';

export const Quota = (resource: QuotaResource) =>
  SetMetadata(QUOTA_RESOURCE_KEY, resource);
