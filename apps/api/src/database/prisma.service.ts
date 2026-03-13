import { Injectable, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { PrismaClient } from 'prisma-client';
import { tenantExtension } from './prisma-tenant.extension';

@Injectable()
export class PrismaService
  extends PrismaClient
  implements OnModuleInit, OnModuleDestroy
{
  async onModuleInit() {
    await this.$connect();
    // Apply the tenant RLS extension. $extends() returns a new proxied client;
    // Object.assign copies the model delegates (user, client, etc.) onto this
    // instance so all existing injections continue to work without changes.
    Object.assign(this, this.$extends(tenantExtension));
  }

  async onModuleDestroy() {
    await this.$disconnect();
  }
}
