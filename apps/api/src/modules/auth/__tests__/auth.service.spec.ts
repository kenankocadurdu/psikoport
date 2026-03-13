import { Test, TestingModule } from '@nestjs/testing';
import { ConflictException, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import jwt from 'jsonwebtoken';
import * as argon2 from 'argon2';
import { ManagementClient } from 'auth0';

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

// ─────────────────────────────────────────────────────────────────────────────
// 6.2 register()
// ─────────────────────────────────────────────────────────────────────────────

describe('AuthService – 6.2 register()', () => {
  const REGISTER_DTO = {
    email: 'new@example.com',
    password: 'password123',
    fullName: 'New User',
  };

  const NEW_TENANT = { id: 'new-tenant-id', name: 'New User', slug: 'newuser-abc123', plan: 'FREE' };
  const NEW_USER = {
    id: 'new-user-id',
    email: 'new@example.com',
    fullName: 'New User',
    role: 'PSYCHOLOGIST',
    auth0Sub: 'local|generated',
    tenantId: 'new-tenant-id',
  };

  // ── Module builders ────────────────────────────────────────────────────────

  async function buildLocalModeService(
    prismaMock: ReturnType<typeof makePrisma>,
    subscriptionMock: { createInitialSubscription: jest.Mock },
    systemConfigMock: { getBoolean: jest.Mock },
  ) {
    // No AUTH0_DOMAIN/CLIENT_ID/SECRET → auth0Management stays null
    const configMock = {
      get: jest.fn((key: string, defaultVal?: unknown) => {
        if (key === 'JWT_LOCAL_SECRET') return JWT_SECRET;
        return defaultVal ?? undefined;
      }),
    };
    const module = await Test.createTestingModule({
      providers: [
        AuthService,
        { provide: PrismaService, useValue: prismaMock },
        { provide: ConfigService, useValue: configMock },
        { provide: NotificationService, useValue: { sendEmail: jest.fn() } },
        { provide: StorageService, useValue: { buildLicenseDocKey: jest.fn(), generateUploadUrl: jest.fn() } },
        { provide: SubscriptionService, useValue: subscriptionMock },
        { provide: SystemConfigService, useValue: systemConfigMock },
      ],
    }).compile();
    return module.get<AuthService>(AuthService);
  }

  async function buildAuth0ModeService(
    prismaMock: ReturnType<typeof makePrisma>,
    subscriptionMock: { createInitialSubscription: jest.Mock },
    systemConfigMock: { getBoolean: jest.Mock },
  ) {
    // With AUTH0 credentials → ManagementClient constructor is called
    const configMock = {
      get: jest.fn((key: string, defaultVal?: unknown) => {
        if (key === 'JWT_LOCAL_SECRET') return JWT_SECRET;
        if (key === 'AUTH0_DOMAIN') return 'example.auth0.com';
        if (key === 'AUTH0_M2M_CLIENT_ID') return 'client-id';
        if (key === 'AUTH0_M2M_CLIENT_SECRET') return 'client-secret';
        return defaultVal ?? undefined;
      }),
    };
    const module = await Test.createTestingModule({
      providers: [
        AuthService,
        { provide: PrismaService, useValue: prismaMock },
        { provide: ConfigService, useValue: configMock },
        { provide: NotificationService, useValue: { sendEmail: jest.fn() } },
        { provide: StorageService, useValue: { buildLicenseDocKey: jest.fn(), generateUploadUrl: jest.fn() } },
        { provide: SubscriptionService, useValue: subscriptionMock },
        { provide: SystemConfigService, useValue: systemConfigMock },
      ],
    }).compile();
    return module.get<AuthService>(AuthService);
  }

  // ── Shared fixtures ────────────────────────────────────────────────────────

  let prisma: ReturnType<typeof makePrisma>;
  let subscription: { createInitialSubscription: jest.Mock };
  let systemConfig: { getBoolean: jest.Mock };

  beforeEach(() => {
    prisma = makePrisma();
    subscription = { createInitialSubscription: jest.fn() };
    systemConfig = { getBoolean: jest.fn() };

    prisma.user.findFirst.mockResolvedValue(null);        // email not taken
    prisma.tenant.create.mockResolvedValue(NEW_TENANT);
    prisma.user.create.mockResolvedValue(NEW_USER);

    (argon2.hash as jest.Mock).mockResolvedValue('$argon2id$hashed');

    // Reset ManagementClient mock to a no-op (overridden per describe)
    (ManagementClient as jest.Mock).mockImplementation(() => ({}));
  });

  // ── Local mode ─────────────────────────────────────────────────────────────

  describe('local mode (useAuth0=false, no Auth0 client)', () => {
    it('returns access_token and user info', async () => {
      systemConfig.getBoolean.mockResolvedValue(false);
      const svc = await buildLocalModeService(prisma, subscription, systemConfig);

      const result = await svc.register(REGISTER_DTO);

      expect('access_token' in result).toBe(true);
      if ('access_token' in result) {
        expect(result.user).toEqual({
          id: NEW_USER.id,
          email: NEW_USER.email,
          fullName: NEW_USER.fullName,
          role: NEW_USER.role,
        });
      }
    });

    it('access_token JWT contains correct tenantId', async () => {
      systemConfig.getBoolean.mockResolvedValue(false);
      const svc = await buildLocalModeService(prisma, subscription, systemConfig);

      const result = await svc.register(REGISTER_DTO);

      if ('access_token' in result) {
        const decoded = jwt.verify(result.access_token, JWT_SECRET) as Record<string, unknown>;
        expect(decoded['tenantId']).toBe(NEW_TENANT.id);
      } else {
        fail('Expected access_token response');
      }
    });

    it('hashes password via argon2 before storing', async () => {
      systemConfig.getBoolean.mockResolvedValue(false);
      const svc = await buildLocalModeService(prisma, subscription, systemConfig);

      await svc.register(REGISTER_DTO);

      expect(argon2.hash).toHaveBeenCalledWith(REGISTER_DTO.password);
      expect(prisma.user.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ passwordHash: '$argon2id$hashed' }),
        }),
      );
    });

    it('defaults plan to FREE when plan not specified', async () => {
      systemConfig.getBoolean.mockResolvedValue(false);
      const svc = await buildLocalModeService(prisma, subscription, systemConfig);

      await svc.register(REGISTER_DTO);

      expect(prisma.tenant.create).toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ plan: 'FREE' }) }),
      );
    });

    it('maps plan pro → PRO', async () => {
      systemConfig.getBoolean.mockResolvedValue(false);
      const svc = await buildLocalModeService(prisma, subscription, systemConfig);

      await svc.register({ ...REGISTER_DTO, plan: 'pro' });

      expect(prisma.tenant.create).toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ plan: 'PRO' }) }),
      );
    });

    it('maps plan proplus → PROPLUS', async () => {
      systemConfig.getBoolean.mockResolvedValue(false);
      const svc = await buildLocalModeService(prisma, subscription, systemConfig);

      await svc.register({ ...REGISTER_DTO, plan: 'proplus' });

      expect(prisma.tenant.create).toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ plan: 'PROPLUS' }) }),
      );
    });

    it('creates user with PSYCHOLOGIST role', async () => {
      systemConfig.getBoolean.mockResolvedValue(false);
      const svc = await buildLocalModeService(prisma, subscription, systemConfig);

      await svc.register(REGISTER_DTO);

      expect(prisma.user.create).toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ role: 'PSYCHOLOGIST' }) }),
      );
    });

    it('calls createInitialSubscription with tenantId and plan', async () => {
      systemConfig.getBoolean.mockResolvedValue(false);
      const svc = await buildLocalModeService(prisma, subscription, systemConfig);

      await svc.register(REGISTER_DTO);

      expect(subscription.createInitialSubscription).toHaveBeenCalledWith(NEW_TENANT.id, 'FREE');
    });

    it('throws ConflictException when email is already registered', async () => {
      systemConfig.getBoolean.mockResolvedValue(false);
      prisma.user.findFirst.mockResolvedValue(makeActiveUser({ email: REGISTER_DTO.email }));
      const svc = await buildLocalModeService(prisma, subscription, systemConfig);

      await expect(svc.register(REGISTER_DTO)).rejects.toThrow(ConflictException);
    });

    it('generates a local|<hex> auth0Sub when no auth0 client is configured', async () => {
      systemConfig.getBoolean.mockResolvedValue(false);
      const svc = await buildLocalModeService(prisma, subscription, systemConfig);

      await svc.register(REGISTER_DTO);

      const call = prisma.user.create.mock.calls[0][0] as { data: { auth0Sub: string } };
      expect(call.data.auth0Sub).toMatch(/^local\|[0-9a-f]{32}$/);
    });
  });

  // ── Auth0 mode ─────────────────────────────────────────────────────────────

  describe('Auth0 mode (useAuth0=true, Management client configured)', () => {
    let auth0Users: { create: jest.Mock; update: jest.Mock };

    beforeEach(() => {
      auth0Users = {
        create: jest.fn().mockResolvedValue({ user_id: 'auth0|newuser123' }),
        update: jest.fn().mockResolvedValue({}),
      };
      (ManagementClient as jest.Mock).mockImplementation(() => ({ users: auth0Users }));
    });

    it('returns { message } instead of access_token', async () => {
      systemConfig.getBoolean.mockResolvedValue(true);
      const svc = await buildAuth0ModeService(prisma, subscription, systemConfig);

      const result = await svc.register(REGISTER_DTO);

      expect('message' in result).toBe(true);
      expect('access_token' in result).toBe(false);
    });

    it('calls auth0Management.users.create with email and password', async () => {
      systemConfig.getBoolean.mockResolvedValue(true);
      const svc = await buildAuth0ModeService(prisma, subscription, systemConfig);

      await svc.register(REGISTER_DTO);

      expect(auth0Users.create).toHaveBeenCalledWith(
        expect.objectContaining({ email: REGISTER_DTO.email, password: REGISTER_DTO.password }),
      );
    });

    it('calls auth0Management.users.update with app_metadata after tenant is created', async () => {
      systemConfig.getBoolean.mockResolvedValue(true);
      const svc = await buildAuth0ModeService(prisma, subscription, systemConfig);

      await svc.register(REGISTER_DTO);

      expect(auth0Users.update).toHaveBeenCalledWith(
        'auth0|newuser123',
        expect.objectContaining({
          app_metadata: expect.objectContaining({ tenant_id: NEW_TENANT.id }),
        }),
      );
    });

    it('throws ConflictException when auth0 user creation fails in Auth0 mode', async () => {
      systemConfig.getBoolean.mockResolvedValue(true);
      auth0Users.create.mockRejectedValue(new Error('User already exists'));
      const svc = await buildAuth0ModeService(prisma, subscription, systemConfig);

      await expect(svc.register(REGISTER_DTO)).rejects.toThrow(ConflictException);
    });
  });

  describe('Auth0 mode (useAuth0=true, no Management client)', () => {
    it('throws Error when auth0Management is null but useAuth0=true', async () => {
      systemConfig.getBoolean.mockResolvedValue(true);
      // buildLocalModeService → no auth0 credentials → auth0Management = null
      const svc = await buildLocalModeService(prisma, subscription, systemConfig);

      await expect(svc.register(REGISTER_DTO)).rejects.toThrow(
        'Auth0 Management API not configured',
      );
    });
  });

  describe('mixed mode (auth0 client configured, useAuth0=false)', () => {
    it('swallows auth0 creation failure and continues with local| sub', async () => {
      systemConfig.getBoolean.mockResolvedValue(false);
      (ManagementClient as jest.Mock).mockImplementation(() => ({
        users: {
          create: jest.fn().mockRejectedValue(new Error('Auth0 unreachable')),
          update: jest.fn(),
        },
      }));
      const svc = await buildAuth0ModeService(prisma, subscription, systemConfig);

      const result = await svc.register(REGISTER_DTO);

      expect('access_token' in result).toBe(true);
      const call = prisma.user.create.mock.calls[0][0] as { data: { auth0Sub: string } };
      expect(call.data.auth0Sub).toMatch(/^local\|/);
    });
  });
});
