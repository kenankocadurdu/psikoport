import { Test, TestingModule } from '@nestjs/testing';
import { UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import jwt from 'jsonwebtoken';
import * as argon2 from 'argon2';

import { AuthService } from '../auth.service';
import { PrismaService } from '../../../database/prisma.service';
import { NotificationService } from '../../common/services/notification.service';
import { StorageService } from '../../common/services/storage.service';
import { SubscriptionService } from '../../subscriptions/subscription.service';
import { SystemConfigService } from '../../admin/system-config.service';

jest.mock('argon2', () => ({
  verify: jest.fn(),
  hash: jest.fn(),
}));

// Suppress auth0 ManagementClient constructor (not needed for localLogin)
jest.mock('auth0', () => ({
  ManagementClient: jest.fn().mockImplementation(() => ({})),
}));

// jwks-rsa pulls in jose (ESM-only) — mock it to avoid parsing errors
jest.mock('jwks-rsa', () => jest.fn());

const JWT_SECRET = 'test-jwt-secret-for-unit';
const USER_ID = 'user-uuid-1';
const TENANT_ID = 'tenant-uuid-1';
const AUTH0_SUB = 'local|abc123def456';

// ─── Mock factories ──────────────────────────────────────────────────────────

function makePrisma() {
  return {
    user: {
      findFirst: jest.fn(),
      findUnique: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
    },
    tenant: {
      findUnique: jest.fn(),
      create: jest.fn(),
    },
    invitation: {
      findFirst: jest.fn(),
      findUnique: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
    },
  };
}

function makeConfigService() {
  return {
    get: jest.fn((key: string, defaultVal?: unknown) => {
      if (key === 'JWT_LOCAL_SECRET') return JWT_SECRET;
      // Return undefined for auth0 keys → auth0Management stays null
      return defaultVal ?? undefined;
    }),
  };
}

/** Active user with active tenant — the "happy path" fixture */
function makeActiveUser(overrides: Record<string, unknown> = {}) {
  return {
    id: USER_ID,
    email: 'test@example.com',
    fullName: 'Test User',
    role: 'PSYCHOLOGIST',
    isActive: true,
    passwordHash: '$argon2id$v=19$...',
    auth0Sub: AUTH0_SUB,
    tenantId: TENANT_ID,
    tenant: { id: TENANT_ID, isActive: true },
    ...overrides,
  };
}

// ─── Tests ───────────────────────────────────────────────────────────────────

describe('AuthService – 6.1 localLogin()', () => {
  let service: AuthService;
  let prisma: ReturnType<typeof makePrisma>;
  let configSvc: ReturnType<typeof makeConfigService>;

  beforeEach(async () => {
    prisma = makePrisma();
    configSvc = makeConfigService();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        { provide: PrismaService, useValue: prisma },
        { provide: ConfigService, useValue: configSvc },
        { provide: NotificationService, useValue: { sendEmail: jest.fn() } },
        {
          provide: StorageService,
          useValue: { buildLicenseDocKey: jest.fn(), generateUploadUrl: jest.fn() },
        },
        {
          provide: SubscriptionService,
          useValue: { createInitialSubscription: jest.fn() },
        },
        { provide: SystemConfigService, useValue: { getBoolean: jest.fn() } },
      ],
    }).compile();

    service = module.get<AuthService>(AuthService);
    (argon2.verify as jest.Mock).mockReset();
  });

  // ── Happy paths ─────────────────────────────────────────────────────────

  describe('happy path', () => {
    it('returns access_token and user info for valid credentials', async () => {
      prisma.user.findFirst.mockResolvedValue(makeActiveUser());
      (argon2.verify as jest.Mock).mockResolvedValue(true);

      const result = await service.localLogin({
        email: 'test@example.com',
        password: 'secret123',
      });

      expect(result.access_token).toBeDefined();
      expect(result.user).toEqual({
        id: USER_ID,
        email: 'test@example.com',
        fullName: 'Test User',
        role: 'PSYCHOLOGIST',
      });
    });

    it('access_token is a valid HS256 JWT containing sub and tenantId', async () => {
      prisma.user.findFirst.mockResolvedValue(makeActiveUser());
      (argon2.verify as jest.Mock).mockResolvedValue(true);

      const { access_token } = await service.localLogin({
        email: 'test@example.com',
        password: 'secret123',
      });

      const decoded = jwt.verify(access_token, JWT_SECRET) as Record<string, unknown>;
      expect(decoded['sub']).toBe(AUTH0_SUB);
      expect(decoded['tenantId']).toBe(TENANT_ID);
    });

    it('JWT expires in ~7 days', async () => {
      prisma.user.findFirst.mockResolvedValue(makeActiveUser());
      (argon2.verify as jest.Mock).mockResolvedValue(true);

      const before = Math.floor(Date.now() / 1000);
      const { access_token } = await service.localLogin({
        email: 'test@example.com',
        password: 'secret123',
      });
      const after = Math.floor(Date.now() / 1000);

      const decoded = jwt.decode(access_token) as Record<string, number>;
      const exp = decoded['exp'];
      const sevenDaysSeconds = 7 * 24 * 60 * 60;
      // exp should be approximately now + 7d
      expect(exp).toBeGreaterThanOrEqual(before + sevenDaysSeconds - 5);
      expect(exp).toBeLessThanOrEqual(after + sevenDaysSeconds + 5);
    });

    it('queries user by email with isActive:true filter', async () => {
      prisma.user.findFirst.mockResolvedValue(makeActiveUser());
      (argon2.verify as jest.Mock).mockResolvedValue(true);

      await service.localLogin({ email: 'test@example.com', password: 'secret123' });

      expect(prisma.user.findFirst).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { email: 'test@example.com', isActive: true },
        }),
      );
    });

    it('verifies password against stored passwordHash via argon2', async () => {
      const user = makeActiveUser();
      prisma.user.findFirst.mockResolvedValue(user);
      (argon2.verify as jest.Mock).mockResolvedValue(true);

      await service.localLogin({ email: 'test@example.com', password: 'mypassword' });

      expect(argon2.verify).toHaveBeenCalledWith(user.passwordHash, 'mypassword');
    });

    it('SUPER_ADMIN with inactive tenant can still login', async () => {
      const user = makeActiveUser({
        role: 'SUPER_ADMIN',
        tenant: { id: TENANT_ID, isActive: false },
      });
      prisma.user.findFirst.mockResolvedValue(user);
      (argon2.verify as jest.Mock).mockResolvedValue(true);

      const result = await service.localLogin({
        email: 'admin@example.com',
        password: 'secret123',
      });

      expect(result.access_token).toBeDefined();
      expect(result.user.role).toBe('SUPER_ADMIN');
    });

    it('SUPER_ADMIN with null tenant can still login', async () => {
      const user = makeActiveUser({
        role: 'SUPER_ADMIN',
        tenant: null,
        tenantId: 'system',
      });
      prisma.user.findFirst.mockResolvedValue(user);
      (argon2.verify as jest.Mock).mockResolvedValue(true);

      const result = await service.localLogin({
        email: 'admin@example.com',
        password: 'secret123',
      });

      expect(result.access_token).toBeDefined();
    });
  });

  // ── Authentication failures ──────────────────────────────────────────────

  describe('authentication failures', () => {
    it('throws UnauthorizedException when user is not found', async () => {
      prisma.user.findFirst.mockResolvedValue(null);

      await expect(
        service.localLogin({ email: 'notfound@example.com', password: 'secret123' }),
      ).rejects.toThrow(UnauthorizedException);
    });

    it('throws UnauthorizedException when user has no passwordHash', async () => {
      prisma.user.findFirst.mockResolvedValue(makeActiveUser({ passwordHash: null }));

      await expect(
        service.localLogin({ email: 'test@example.com', password: 'secret123' }),
      ).rejects.toThrow(UnauthorizedException);
    });

    it('throws UnauthorizedException when tenant is inactive (non-SUPER_ADMIN)', async () => {
      prisma.user.findFirst.mockResolvedValue(
        makeActiveUser({ tenant: { id: TENANT_ID, isActive: false } }),
      );

      await expect(
        service.localLogin({ email: 'test@example.com', password: 'secret123' }),
      ).rejects.toThrow(UnauthorizedException);
    });

    it('throws UnauthorizedException when tenant is null (non-SUPER_ADMIN)', async () => {
      prisma.user.findFirst.mockResolvedValue(makeActiveUser({ tenant: null }));

      await expect(
        service.localLogin({ email: 'test@example.com', password: 'secret123' }),
      ).rejects.toThrow(UnauthorizedException);
    });

    it('throws UnauthorizedException when password is incorrect', async () => {
      prisma.user.findFirst.mockResolvedValue(makeActiveUser());
      (argon2.verify as jest.Mock).mockResolvedValue(false);

      await expect(
        service.localLogin({ email: 'test@example.com', password: 'wrongpassword' }),
      ).rejects.toThrow(UnauthorizedException);
    });

    it('does not call argon2.verify when pre-conditions fail (user null)', async () => {
      prisma.user.findFirst.mockResolvedValue(null);

      await service.localLogin({ email: 'x@x.com', password: 'secret123' }).catch(() => {});

      expect(argon2.verify).not.toHaveBeenCalled();
    });

    it('error message is identical for user-not-found and wrong-password (no user enumeration)', async () => {
      // Case 1: user not found
      prisma.user.findFirst.mockResolvedValue(null);
      const err1 = await service
        .localLogin({ email: 'x@x.com', password: 'secret123' })
        .catch((e: unknown) => e as UnauthorizedException);

      // Case 2: wrong password
      prisma.user.findFirst.mockResolvedValue(makeActiveUser());
      (argon2.verify as jest.Mock).mockResolvedValue(false);
      const err2 = await service
        .localLogin({ email: 'test@example.com', password: 'wrong' })
        .catch((e: unknown) => e as UnauthorizedException);

      expect((err1 as UnauthorizedException).message).toBe((err2 as UnauthorizedException).message);
    });
  });

  // ── JWT configuration ────────────────────────────────────────────────────

  describe('JWT configuration', () => {
    it('throws an error when JWT_LOCAL_SECRET is not configured', async () => {
      prisma.user.findFirst.mockResolvedValue(makeActiveUser());
      (argon2.verify as jest.Mock).mockResolvedValue(true);
      // Override to return undefined for JWT_LOCAL_SECRET
      configSvc.get.mockImplementation(() => undefined);

      await expect(
        service.localLogin({ email: 'test@example.com', password: 'secret123' }),
      ).rejects.toThrow('JWT_LOCAL_SECRET is not configured');
    });
  });
});
