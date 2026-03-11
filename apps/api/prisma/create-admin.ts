/**
 * İlk süper admin kullanıcısını oluşturur.
 *
 * Kullanım:
 *   cd apps/api
 *   pnpm db:create-admin
 *
 * .env dosyasında ADMIN_EMAIL, ADMIN_NAME, ADMIN_PASSWORD dolu olmalı.
 * ⚠️  Sadece ilk kurulumda bir kez çalıştırın.
 */

import * as path from 'path';
// eslint-disable-next-line @typescript-eslint/no-require-imports
require('dotenv').config({ path: path.resolve(__dirname, '../../../.env') });

import { PrismaClient } from 'prisma-client';
import { ManagementClient } from 'auth0';

const prisma = new PrismaClient();

const ADMIN_EMAIL = process.env.ADMIN_EMAIL ?? '';
const ADMIN_NAME = process.env.ADMIN_NAME ?? 'Psikoport Admin';
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD ?? '';
const AUTH0_DOMAIN = process.env.AUTH0_DOMAIN ?? '';
const AUTH0_M2M_CLIENT_ID = process.env.AUTH0_M2M_CLIENT_ID ?? '';
const AUTH0_M2M_CLIENT_SECRET = process.env.AUTH0_M2M_CLIENT_SECRET ?? '';
const AUTH0_DB_CONNECTION =
  process.env.AUTH0_DB_CONNECTION ?? 'Username-Password-Authentication';

async function main() {
  if (!ADMIN_EMAIL) {
    throw new Error('.env dosyasında ADMIN_EMAIL boş');
  }
  if (!ADMIN_PASSWORD) {
    throw new Error('.env dosyasında ADMIN_PASSWORD boş');
  }

  // Sistem tenant'ı oluştur veya bul
  let systemTenant = await prisma.tenant.findFirst({
    where: { slug: 'psikoport-system' },
  });

  if (!systemTenant) {
    systemTenant = await prisma.tenant.create({
      data: {
        id: 'system',
        name: 'Psikoport System',
        slug: 'psikoport-system',
        plan: 'ENTERPRISE',
        maxClients: 0,
        isActive: true,
      },
    });
    console.log('✅ Sistem tenant oluşturuldu');
  } else {
    console.log('ℹ️  Sistem tenant zaten mevcut');
  }

  // Mevcut DB kullanıcısını kontrol et
  const existingUser = await prisma.user.findFirst({
    where: { email: ADMIN_EMAIL },
  });
  if (existingUser) {
    console.log('ℹ️  Bu e-posta ile kullanıcı zaten mevcut:', ADMIN_EMAIL);
    return;
  }

  // Auth0 kullanıcısı oluştur
  let auth0Sub: string;

  if (!AUTH0_M2M_CLIENT_ID || !AUTH0_M2M_CLIENT_SECRET || !AUTH0_DOMAIN) {
    console.warn('⚠️  Auth0 M2M bilgileri eksik — Auth0 kullanıcısı oluşturulmadı.');
    console.warn('    AUTH0_DOMAIN, AUTH0_M2M_CLIENT_ID, AUTH0_M2M_CLIENT_SECRET gerekli.');
    console.warn('    Auth0 kullanıcısını manuel oluşturup auth0Sub değerini düzenleyin.');
    auth0Sub = `manual|${Date.now()}`;
  } else {
    const management = new ManagementClient({
      domain: AUTH0_DOMAIN,
      clientId: AUTH0_M2M_CLIENT_ID,
      clientSecret: AUTH0_M2M_CLIENT_SECRET,
    });

    let uid: string | undefined;

    try {
      const auth0User = await management.users.create({
        connection: AUTH0_DB_CONNECTION,
        email: ADMIN_EMAIL,
        name: ADMIN_NAME,
        password: ADMIN_PASSWORD,
        email_verified: true,
        app_metadata: { tenant_id: systemTenant.id, role: 'super_admin' },
      });
      uid =
        (auth0User as unknown as { user_id?: string }).user_id ??
        (auth0User as { data?: { user_id?: string } }).data?.user_id;
      console.log('✅ Auth0 kullanıcısı oluşturuldu:', uid);
    } catch (err: unknown) {
      const e = err as { statusCode?: number };
      if (e?.statusCode === 409) {
        // Zaten var — email ile bul
        console.log('ℹ️  Auth0 kullanıcısı zaten mevcut, aranıyor...');
        const found = await management.users.listUsersByEmail({ email: ADMIN_EMAIL });
        const users = (found as unknown as { data?: { user_id?: string }[] }).data ??
          (found as unknown as { user_id?: string }[]);
        uid = Array.isArray(users) && users.length > 0 ? users[0].user_id : undefined;
        if (uid) {
          // app_metadata güncelle
          await management.users.update(uid, {
            app_metadata: { tenant_id: systemTenant.id, role: 'super_admin' },
          });
          console.log('✅ Auth0 kullanıcısı bulundu ve güncellendi:', uid);
        }
      } else {
        throw err;
      }
    }

    if (!uid) throw new Error('Auth0 user_id alınamadı');
    auth0Sub = uid;
  }

  // DB kullanıcısı oluştur
  await prisma.user.create({
    data: {
      tenantId: systemTenant.id,
      auth0Sub,
      email: ADMIN_EMAIL,
      fullName: ADMIN_NAME,
      role: 'SUPER_ADMIN',
      is2faEnabled: false,
      isActive: true,
    },
  });

  console.log('✅ Admin kullanıcısı oluşturuldu:', ADMIN_EMAIL);
  console.log('');
  console.log('📌 Sonraki adımlar:');
  console.log('   1. /login sayfasından giriş yapın');
  console.log('   2. 2FA kurulumunu tamamlayın (/setup-2fa)');
  console.log('   3. /admin adresine gidin');
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
