import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ManagementClient } from 'auth0';
import jwt from 'jsonwebtoken';
import jwksRsa from 'jwks-rsa';
import { randomBytes } from 'crypto';
import * as argon2 from 'argon2';
import { PrismaService } from '../../database/prisma.service';
import { UserRole } from 'prisma-client';
import { RegisterDto } from './dto/register.dto';
import { LocalLoginDto } from './dto/local-login.dto';
import { NotificationService } from '../common/services/notification.service';
import { StorageService } from '../common/services/storage.service';
import { SubscriptionService } from '../subscriptions/subscription.service';
import { SystemConfigService, SYSTEM_CONFIG_KEYS } from '../admin/system-config.service';

/** Decoded JWT payload from Auth0 */
interface Auth0TokenPayload {
  sub: string;
  email?: string;
  name?: string;
  amr?: string[];
  [key: string]: unknown;
}

@Injectable()
export class AuthService {
  private auth0Management: ManagementClient | null = null;

  constructor(
    private readonly configService: ConfigService,
    private readonly prisma: PrismaService,
    private readonly notification: NotificationService,
    private readonly storage: StorageService,
    private readonly subscriptionService: SubscriptionService,
    private readonly systemConfigService: SystemConfigService,
  ) {
    const domain = this.configService.get<string>('AUTH0_DOMAIN');
    const clientId = this.configService.get<string>('AUTH0_M2M_CLIENT_ID');
    const clientSecret = this.configService.get<string>(
      'AUTH0_M2M_CLIENT_SECRET',
    );
    if (domain && clientId && clientSecret) {
      this.auth0Management = new ManagementClient({
        domain,
        clientId,
        clientSecret,
      });
    }
  }

  private async verifyAuth0Token(token: string): Promise<Auth0TokenPayload> {
    const domain = this.configService.get<string>('AUTH0_DOMAIN') ?? '';
    const audience = this.configService.get<string>('AUTH0_AUDIENCE') ?? '';

    const decoded = jwt.decode(token, { complete: true }) as
      | { header?: { kid?: string }; payload?: Auth0TokenPayload }
      | null;
    if (!decoded?.header?.kid || !decoded?.payload) {
      throw new UnauthorizedException('Invalid token');
    }

    const client = jwksRsa({
      jwksUri: `https://${domain}/.well-known/jwks.json`,
      cache: true,
      rateLimit: true,
    });

    const key = await client.getSigningKey(decoded.header.kid);
    const publicKey = key.getPublicKey();

    const payload = jwt.verify(token, publicKey, {
      algorithms: ['RS256'],
      audience,
      issuer: `https://${domain}/`,
    }) as Auth0TokenPayload;

    return payload;
  }

  /**
   * E2E test token — only when E2E_TEST=1. Returns HS256 JWT for demo user.
   */
  async getE2EToken(): Promise<{ accessToken: string }> {
    if (this.configService.get<string>('E2E_TEST') !== '1') {
      throw new UnauthorizedException('E2E token only available when E2E_TEST=1');
    }
    const user = await this.prisma.user.findFirst({
      where: { auth0Sub: 'auth0|demo-psychologist-123' },
      include: { tenant: true },
    });
    if (!user || !user.tenant) {
      throw new UnauthorizedException('Demo user not found. Run db:seed.');
    }
    const secret =
      this.configService.get<string>('E2E_JWT_SECRET') ?? 'e2e-test-secret';
    const payload = {
      sub: user.auth0Sub,
      tenant_id: user.tenantId,
      exp: Math.floor(Date.now() / 1000) + 3600,
    };
    const accessToken = jwt.sign(payload, secret, { algorithm: 'HS256' });
    return { accessToken };
  }

  async getAuthConfig(): Promise<{ useAuth0: boolean }> {
    const useAuth0 = await this.systemConfigService.getBoolean(SYSTEM_CONFIG_KEYS.USE_AUTH0);
    return { useAuth0 };
  }

  private issueLocalToken(user: { auth0Sub: string; tenantId: string }): string {
    const secret = this.configService.get<string>('JWT_LOCAL_SECRET');
    if (!secret) throw new Error('JWT_LOCAL_SECRET is not configured');
    return jwt.sign(
      { sub: user.auth0Sub, tenantId: user.tenantId },
      secret,
      { algorithm: 'HS256', expiresIn: '7d' },
    );
  }

  async localLogin(dto: LocalLoginDto): Promise<{
    access_token: string;
    user: { id: string; email: string; fullName: string; role: string };
  }> {
    const user = await this.prisma.user.findFirst({
      where: { email: dto.email, isActive: true },
      include: { tenant: true },
    });

    // SUPER_ADMIN'in özel tenantId'si (system) gerçek bir Tenant kaydı olmayabilir
    const isSuperAdmin = user?.role === 'SUPER_ADMIN';
    if (!user || !user.passwordHash || (!isSuperAdmin && !user.tenant?.isActive)) {
      throw new UnauthorizedException('Geçersiz e-posta veya şifre');
    }

    const valid = await argon2.verify(user.passwordHash, dto.password);
    if (!valid) {
      throw new UnauthorizedException('Geçersiz e-posta veya şifre');
    }

    const access_token = this.issueLocalToken(user);
    return {
      access_token,
      user: { id: user.id, email: user.email, fullName: user.fullName, role: user.role },
    };
  }

  private generateSlug(email: string): string {
    const prefix = email.split('@')[0] ?? 'user';
    const safe = prefix.replace(/[^a-z0-9]/gi, '').toLowerCase().slice(0, 20);
    const random = Math.random().toString(36).slice(2, 8);
    return `${safe}-${random}`;
  }

  async register(dto: RegisterDto): Promise<{ message: string } | { access_token: string; user: { id: string; email: string; fullName: string; role: string } }> {
    const { useAuth0 } = await this.getAuthConfig();

    const existingUser = await this.prisma.user.findFirst({
      where: { email: dto.email },
    });
    if (existingUser) {
      throw new ConflictException('Email already registered');
    }

    const slug = this.generateSlug(dto.email);
    const planMap = { free: 'FREE', pro: 'PRO', proplus: 'PROPLUS' } as const;
    const tenantPlan = planMap[dto.plan ?? 'free'];

    // Şifreyi her zaman hash'le (local mod için zorunlu, Auth0 mod için de saklansın)
    const passwordHash = await argon2.hash(dto.password);

    const connection = this.configService.get<string>(
      'AUTH0_DB_CONNECTION',
      'Username-Password-Authentication',
    );

    // Auth0'a kullanıcı oluşturmayı her zaman dene (mümkünse)
    // Local mod kapalıyken bile şifre Auth0'da saklansın → geçişte sorun olmaz
    let auth0UserId: string | null = null;
    if (this.auth0Management) {
      try {
        const created = await this.auth0Management.users.create({
          connection,
          email: dto.email,
          password: dto.password,
          name: dto.fullName,
          email_verified: false,
        });
        const uid =
          (created as { user_id?: string }).user_id ??
          (created as { data?: { user_id?: string } }).data?.user_id;
        auth0UserId = uid ?? null;
      } catch (err: unknown) {
        if (!useAuth0) {
          // Local modda Auth0 erişilemezse devam et — local sub kullan
          auth0UserId = null;
        } else {
          const message =
            err && typeof err === 'object' && 'message' in err
              ? String((err as { message: string }).message)
              : 'Auth0 user creation failed';
          throw new ConflictException(message);
        }
      }
    } else if (!useAuth0) {
      // Auth0 yapılandırılmamış, local mod — sorun değil
      auth0UserId = null;
    } else {
      throw new Error(
        'Auth0 Management API not configured. Set AUTH0_M2M_CLIENT_ID and AUTH0_M2M_CLIENT_SECRET.',
      );
    }

    const finalAuth0Sub = auth0UserId ?? `local|${randomBytes(16).toString('hex')}`;

    const tenant = await this.prisma.tenant.create({
      data: { name: dto.fullName, slug, plan: tenantPlan },
    });

    const user = await this.prisma.user.create({
      data: {
        tenantId: tenant.id,
        auth0Sub: finalAuth0Sub,
        email: dto.email,
        fullName: dto.fullName,
        phone: dto.phone,
        passwordHash,
        role: UserRole.PSYCHOLOGIST,
      },
    });

    // Auth0'da kullanıcı oluşturulduysa app_metadata'yı güncelle
    if (auth0UserId && this.auth0Management) {
      await this.auth0Management.users.update(
        auth0UserId,
        { app_metadata: { tenant_id: tenant.id, role: 'psychologist' } },
      );
    }

    await this.subscriptionService.createInitialSubscription(tenant.id, tenantPlan);

    if (!useAuth0) {
      // Local modda direkt token dön — kullanıcı Auth0'a gitmeden giriş yapabilsin
      const access_token = this.issueLocalToken(user);
      return { access_token, user: { id: user.id, email: user.email, fullName: user.fullName, role: user.role } };
    }

    return {
      message: 'Registration successful. Please log in. Auth0 Action must add tenant_id to JWT.',
    };
  }

  async loginCallback(auth0Token: string): Promise<{
    userId: string;
    tenantId: string;
    email: string;
    fullName: string;
    role: string;
    is2faEnabled: boolean;
  }> {
    const payload = await this.verifyAuth0Token(auth0Token);

    const user = await this.prisma.user.findUnique({
      where: { auth0Sub: payload.sub },
      include: { tenant: true },
    });

    if (!user) {
      throw new UnauthorizedException(
        'User not found. Please complete registration first.',
      );
    }

    if (!user.isActive || !user.tenant.isActive) {
      throw new UnauthorizedException('User or tenant is inactive');
    }

    const amr = payload.amr ?? [];
    let hasMfa = amr.some(
      (m) => m === 'mfa' || m === 'otp' || m === 'mfa-otp',
    );

    // Fallback: amr claim yoksa (Auth0 Action güncellenmemişse) Management API ile
    // kullanıcının onaylanmış MFA enrollment'ı olup olmadığını kontrol et.
    if (!hasMfa && this.auth0Management) {
      try {
        const enrollmentRes = await this.auth0Management.users.enrollments.get(
          payload.sub,
        );
        const enrollments = Array.isArray(enrollmentRes)
          ? enrollmentRes
          : ((enrollmentRes as { data?: unknown[] }).data ?? []);
        hasMfa = enrollments.length > 0;
      } catch {
        // Management API erişilemezse amr'ye güvenmeye devam et
      }
    }

    await this.prisma.user.update({
      where: { id: user.id },
      data: {
        email: payload.email ?? user.email,
        fullName: payload.name ?? user.fullName,
        is2faEnabled: hasMfa ? true : user.is2faEnabled,
      },
    });

    const updated = await this.prisma.user.findUnique({
      where: { id: user.id },
    });

    return {
      userId: user.id,
      tenantId: user.tenantId,
      email: user.email,
      fullName: user.fullName,
      role: user.role,
      is2faEnabled: updated?.is2faEnabled ?? user.is2faEnabled,
    };
  }

  async me(user: {
    sub: string;
    tenantId: string;
    userId: string;
    email?: string;
    fullName?: string;
    role: string;
    is2faEnabled?: boolean;
  }): Promise<{
    id: string;
    tenantId: string;
    email: string;
    fullName: string;
    role: string;
    is2faEnabled: boolean;
    systemRequires2FA: boolean;
    licenseStatus: string;
    licenseDocUrl: string | null;
  }> {
    const [dbUser, useAuth0] = await Promise.all([
      this.prisma.user.findUnique({
        where: { id: user.userId },
        include: { tenant: true },
      }),
      this.systemConfigService.getBoolean(SYSTEM_CONFIG_KEYS.USE_AUTH0),
    ]);
    // Auth0 aktifken 2FA geçerli; Auth0 kapalıysa asla /setup-2fa'ya yönlendirme
    const systemRequires2FA = useAuth0;

    if (!dbUser) {
      throw new UnauthorizedException('User not found');
    }

    return {
      id: dbUser.id,
      tenantId: dbUser.tenantId,
      email: dbUser.email,
      fullName: dbUser.fullName,
      role: dbUser.role,
      is2faEnabled: dbUser.is2faEnabled,
      systemRequires2FA,
      licenseStatus: dbUser.licenseStatus,
      licenseDocUrl: dbUser.licenseDocUrl,
    };
  }

  async invite(
    tenantId: string,
    inviterUserId: string,
    inviterFullName: string,
    email: string,
  ): Promise<{ message: string }> {
    const tenant = await this.prisma.tenant.findUnique({
      where: { id: tenantId },
    });
    if (!tenant) {
      throw new BadRequestException('Tenant not found');
    }

    const existingUser = await this.prisma.user.findFirst({
      where: { email, tenantId },
    });
    if (existingUser) {
      throw new ConflictException('Bu e-posta adresi zaten bu kuruluşta kayıtlı');
    }

    const pendingInvite = await this.prisma.invitation.findFirst({
      where: {
        tenantId,
        email,
        acceptedAt: null,
        expiresAt: { gt: new Date() },
      },
    });
    if (pendingInvite) {
      throw new ConflictException('Bu e-posta adresine zaten bekleyen bir davet var');
    }

    const token = randomBytes(32).toString('hex');
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 7);

    const invitation = await this.prisma.invitation.create({
      data: {
        tenantId,
        email,
        role: UserRole.ASSISTANT,
        token,
        expiresAt,
      },
    });

    const frontendUrl = this.configService.get<string>('FRONTEND_URL', 'http://localhost:3000');
    const inviteUrl = `${frontendUrl}/invite/accept?token=${encodeURIComponent(token)}`;
    await this.notification.sendEmail(
      email,
      'invite-email',
      {
        inviterName: inviterFullName,
        tenantName: tenant.name,
        inviteUrl,
      },
      'invite-email',
      `${inviterFullName} sizi Psikoport'a asistan olarak davet etti`,
    );

    return {
      message: `Davet ${email} adresine gönderildi`,
    };
  }

  async validateInvite(token: string): Promise<{
    email: string;
    tenantName: string;
    inviterName?: string;
  } | null> {
    const invitation = await this.prisma.invitation.findUnique({
      where: { token },
      include: { tenant: true },
    });
    if (
      !invitation ||
      invitation.acceptedAt ||
      invitation.expiresAt < new Date()
    ) {
      return null;
    }
    return {
      email: invitation.email,
      tenantName: invitation.tenant.name,
    };
  }

  async acceptInvite(
    token: string,
    auth0Token: string,
  ): Promise<{
    userId: string;
    tenantId: string;
    email: string;
    fullName: string;
    role: string;
    is2faEnabled: boolean;
  }> {
    const invitation = await this.prisma.invitation.findUnique({
      where: { token },
      include: { tenant: true },
    });
    if (!invitation) {
      throw new BadRequestException('Geçersiz davet linki');
    }
    if (invitation.acceptedAt) {
      throw new ConflictException('Bu davet zaten kabul edilmiş');
    }
    if (invitation.expiresAt < new Date()) {
      throw new BadRequestException('Davet süresi dolmuş');
    }

    const payload = await this.verifyAuth0Token(auth0Token);
    const auth0Email = (payload.email ?? '').toLowerCase();
    const inviteEmail = invitation.email.toLowerCase();
    if (auth0Email !== inviteEmail) {
      throw new BadRequestException(
        'Davet edilen e-posta adresi ile giriş yaptığınız hesap eşleşmiyor',
      );
    }

    const existingUser = await this.prisma.user.findFirst({
      where: { email: invitation.email, tenantId: invitation.tenantId },
    });
    if (existingUser) {
      throw new ConflictException('Bu e-posta adresi zaten bu kuruluşta kayıtlı');
    }

    const user = await this.prisma.user.create({
      data: {
        tenantId: invitation.tenantId,
        auth0Sub: payload.sub,
        email: invitation.email,
        fullName: payload.name ?? invitation.email.split('@')[0] ?? 'Asistan',
        role: invitation.role,
      },
    });

    await this.prisma.invitation.update({
      where: { id: invitation.id },
      data: { acceptedAt: new Date() },
    });

    if (this.auth0Management) {
      await this.auth0Management.users.update(
        payload.sub,
        {
          app_metadata: {
            tenant_id: invitation.tenantId,
            role: 'assistant',
          },
        },
      );
    }

    return {
      userId: user.id,
      tenantId: user.tenantId,
      email: user.email,
      fullName: user.fullName,
      role: user.role,
      is2faEnabled: user.is2faEnabled,
    };
  }

  /**
   * Kullanıcının üye olduğu başka bir tenant'a geçiş yapar.
   * TenantMember kaydı aktif değilse ForbiddenException fırlatır.
   */
  async switchTenant(
    userId: string,
    targetTenantId: string,
  ): Promise<{ token: string }> {
    const membership = await (this.prisma as any).tenantMember.findFirst({
      where: { userId, tenantId: targetTenantId, isActive: true },
    });

    if (!membership) {
      throw new ForbiddenException('Bu tenant\'a erişim izniniz yok');
    }

    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) {
      throw new UnauthorizedException('Kullanıcı bulunamadı');
    }

    const token = this.issueLocalToken({ auth0Sub: user.auth0Sub, tenantId: targetTenantId });
    return { token };
  }

  async getLicenseUploadUrl(
    userId: string,
    tenantId: string,
    filename: string,
    contentType: string,
  ): Promise<{ uploadUrl: string; key: string }> {
    const user = await this.prisma.user.findFirst({
      where: { id: userId, tenantId, role: UserRole.PSYCHOLOGIST },
    });
    if (!user) {
      throw new UnauthorizedException('Yetkisiz');
    }
    const key = this.storage.buildLicenseDocKey(tenantId, userId, filename);
    const { url } = await this.storage.generateUploadUrl(key, contentType);
    return { uploadUrl: url, key };
  }

  async confirmLicenseUpload(
    userId: string,
    tenantId: string,
    key: string,
  ): Promise<{ licenseDocUrl: string }> {
    const user = await this.prisma.user.findFirst({
      where: { id: userId, tenantId, role: UserRole.PSYCHOLOGIST },
    });
    if (!user) {
      throw new UnauthorizedException('Yetkisiz');
    }
    await this.prisma.user.update({
      where: { id: userId },
      data: { licenseDocUrl: key },
    });
    return { licenseDocUrl: key };
  }
}
