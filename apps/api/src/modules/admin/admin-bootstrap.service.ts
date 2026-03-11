import { Injectable, Logger, OnApplicationBootstrap } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ManagementClient } from 'auth0';
import { PrismaService } from '../../database/prisma.service';

/**
 * API ilk başladığında süper admin kullanıcısını oluşturur.
 * ADMIN_EMAIL ve ADMIN_PASSWORD env değişkenleri dolu ise çalışır.
 * SUPER_ADMIN zaten varsa hiçbir şey yapmaz.
 */
@Injectable()
export class AdminBootstrapService implements OnApplicationBootstrap {
  private readonly logger = new Logger(AdminBootstrapService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
  ) {}

  async onApplicationBootstrap() {
    // Plan configs: her zaman kontrol et (seed.ts çalışmamış olabilir)
    await this.seedPlanConfigs();

    const email = this.config.get<string>('ADMIN_EMAIL');
    const password = this.config.get<string>('ADMIN_PASSWORD');

    if (!email || !password) {
      this.logger.warn('ADMIN_EMAIL veya ADMIN_PASSWORD eksik — süper admin bootstrap atlandı');
      return;
    }

    try {
      // Zaten bir SUPER_ADMIN var mı?
      const existing = await this.prisma.user.findFirst({
        where: { role: 'SUPER_ADMIN' },
      });
      if (existing) return; // dokunma

      this.logger.log('Süper admin bulunamadı, oluşturuluyor...');

      // Sistem tenant'ı bul veya oluştur
      let systemTenant = await this.prisma.tenant.findFirst({
        where: { slug: 'psikoport-system' },
      });
      if (!systemTenant) {
        systemTenant = await this.prisma.tenant.create({
          data: {
            id: 'system',
            name: 'Psikoport System',
            slug: 'psikoport-system',
            plan: 'PROPLUS',
            maxClients: 0,
            isActive: true,
          },
        });
      }

      // Auth0 Management Client
      const domain = this.config.get<string>('AUTH0_DOMAIN') ?? '';
      const clientId = this.config.get<string>('AUTH0_M2M_CLIENT_ID') ?? '';
      const clientSecret = this.config.get<string>('AUTH0_M2M_CLIENT_SECRET') ?? '';
      const connection =
        this.config.get<string>('AUTH0_DB_CONNECTION') ??
        'Username-Password-Authentication';

      if (!domain || !clientId || !clientSecret) {
        this.logger.warn('Auth0 M2M bilgileri eksik — admin Auth0 kaydı atlandı');
        return;
      }

      const management = new ManagementClient({ domain, clientId, clientSecret });
      const name = this.config.get<string>('ADMIN_NAME') ?? 'Psikoport Admin';

      let auth0Sub: string | undefined;

      try {
        const created = await management.users.create({
          connection,
          email,
          name,
          password,
          email_verified: true,
          app_metadata: { tenant_id: systemTenant.id, role: 'super_admin' },
        });
        auth0Sub =
          (created as unknown as { user_id?: string }).user_id ??
          (created as { data?: { user_id?: string } }).data?.user_id;
      } catch (err: unknown) {
        const e = err as { statusCode?: number };
        if (e?.statusCode === 409) {
          // Auth0'da zaten var — email ile bul
          const found = await management.users.listUsersByEmail({ email });
          const users =
            (found as unknown as { data?: { user_id?: string }[] }).data ??
            (found as unknown as { user_id?: string }[]);
          auth0Sub =
            Array.isArray(users) && users.length > 0
              ? users[0].user_id
              : undefined;
          if (auth0Sub) {
            await management.users.update(auth0Sub, {
              app_metadata: { tenant_id: systemTenant.id, role: 'super_admin' },
            });
          }
        } else {
          throw err;
        }
      }

      if (!auth0Sub) {
        this.logger.error('Auth0 user_id alınamadı');
        return;
      }

      await this.prisma.user.create({
        data: {
          tenantId: systemTenant.id,
          auth0Sub,
          email,
          fullName: name,
          role: 'SUPER_ADMIN',
          is2faEnabled: false,
          isActive: true,
        },
      });

      this.logger.log(`Süper admin oluşturuldu: ${email}`);
    } catch (err) {
      this.logger.error('Admin bootstrap hatası:', err);
    }
  }

  private async seedPlanConfigs() {
    try {
      const hasAny = await this.prisma.planConfig.findFirst();
      if (hasAny) return; // zaten var

      const defaults = [
        { planCode: 'FREE' as const,       monthlySessionQuota: 25,  testsPerSession: 10, monthlyPrice: 0,    trialDays: 7 },
        { planCode: 'PRO' as const,        monthlySessionQuota: 250, testsPerSession: 10, monthlyPrice: 999,  trialDays: 0 },
        { planCode: 'PROPLUS' as const, monthlySessionQuota: 500, testsPerSession: 10, monthlyPrice: 1200, trialDays: 0 },
      ];

      for (const d of defaults) {
        await this.prisma.planConfig.create({ data: d });
      }

      this.logger.log('Başlangıç PlanConfig kayıtları oluşturuldu (FREE:25, PRO:250, PROPLUS:500)');
    } catch (err) {
      this.logger.error('PlanConfig seed hatası:', err);
    }
  }
}
