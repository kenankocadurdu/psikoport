import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException, ConflictException, ForbiddenException, UnauthorizedException } from '@nestjs/common';
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
    tenantMember: {
      findFirst: jest.fn(),
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

// ─────────────────────────────────────────────────────────────────────────────
// 6.3 loginCallback() — MFA Detection
// ─────────────────────────────────────────────────────────────────────────────

describe('AuthService – 6.3 loginCallback()', () => {
  const DB_USER = {
    id: 'user-cb-1',
    auth0Sub: 'auth0|sub123',
    tenantId: 'tenant-cb-1',
    email: 'user@example.com',
    fullName: 'DB User',
    role: 'PSYCHOLOGIST',
    isActive: true,
    is2faEnabled: false,
    tenant: { id: 'tenant-cb-1', isActive: true },
  };

  const BASE_PAYLOAD = {
    sub: 'auth0|sub123',
    email: 'user@example.com',
    name: 'DB User',
    amr: [] as string[],
  };

  // ── Module builders ────────────────────────────────────────────────────────

  async function buildNoAuth0Service(prismaMock: ReturnType<typeof makePrisma>) {
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
        { provide: SubscriptionService, useValue: { createInitialSubscription: jest.fn() } },
        { provide: SystemConfigService, useValue: { getBoolean: jest.fn() } },
      ],
    }).compile();
    return module.get<AuthService>(AuthService);
  }

  async function buildWithAuth0Service(
    prismaMock: ReturnType<typeof makePrisma>,
    enrollmentsMock: jest.Mock,
  ) {
    (ManagementClient as jest.Mock).mockImplementation(() => ({
      users: { enrollments: { get: enrollmentsMock } },
    }));
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
        { provide: SubscriptionService, useValue: { createInitialSubscription: jest.fn() } },
        { provide: SystemConfigService, useValue: { getBoolean: jest.fn() } },
      ],
    }).compile();
    return module.get<AuthService>(AuthService);
  }

  // ── Helpers ────────────────────────────────────────────────────────────────

  function setupPrismaForCallback(
    prismaMock: ReturnType<typeof makePrisma>,
    userOverrides: Record<string, unknown> = {},
    updatedOverrides: Record<string, unknown> = {},
  ) {
    const user = { ...DB_USER, ...userOverrides };
    const updated = { ...DB_USER, ...userOverrides, ...updatedOverrides };
    // First findUnique: by auth0Sub (includes tenant)
    // Second findUnique: by id (after update)
    prismaMock.user.findUnique
      .mockResolvedValueOnce(user)
      .mockResolvedValueOnce(updated);
    prismaMock.user.update.mockResolvedValue(updated);
  }

  // ── Happy path ─────────────────────────────────────────────────────────────

  describe('happy path', () => {
    it('returns correct shape with userId, tenantId, email, fullName, role, is2faEnabled', async () => {
      const prisma = makePrisma();
      setupPrismaForCallback(prisma);
      const svc = await buildNoAuth0Service(prisma);
      jest.spyOn(svc as any, 'verifyAuth0Token').mockResolvedValue(BASE_PAYLOAD);

      const result = await svc.loginCallback('fake-token');

      expect(result).toMatchObject({
        userId: DB_USER.id,
        tenantId: DB_USER.tenantId,
        email: DB_USER.email,
        fullName: DB_USER.fullName,
        role: DB_USER.role,
      });
      expect(typeof result.is2faEnabled).toBe('boolean');
    });

    it('updates user email and fullName from JWT payload', async () => {
      const prisma = makePrisma();
      setupPrismaForCallback(prisma);
      const svc = await buildNoAuth0Service(prisma);
      const payload = { ...BASE_PAYLOAD, email: 'new@example.com', name: 'New Name' };
      jest.spyOn(svc as any, 'verifyAuth0Token').mockResolvedValue(payload);

      await svc.loginCallback('fake-token');

      expect(prisma.user.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ email: 'new@example.com', fullName: 'New Name' }),
        }),
      );
    });

    it('keeps existing email/fullName when payload fields are missing', async () => {
      const prisma = makePrisma();
      setupPrismaForCallback(prisma);
      const svc = await buildNoAuth0Service(prisma);
      const payload = { sub: BASE_PAYLOAD.sub }; // no email, no name
      jest.spyOn(svc as any, 'verifyAuth0Token').mockResolvedValue(payload);

      await svc.loginCallback('fake-token');

      expect(prisma.user.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            email: DB_USER.email,
            fullName: DB_USER.fullName,
          }),
        }),
      );
    });

    it('returns is2faEnabled from the second findUnique (post-update)', async () => {
      const prisma = makePrisma();
      // Original user: is2faEnabled=false; after update: is2faEnabled=true
      setupPrismaForCallback(prisma, {}, { is2faEnabled: true });
      const svc = await buildNoAuth0Service(prisma);
      jest.spyOn(svc as any, 'verifyAuth0Token').mockResolvedValue({
        ...BASE_PAYLOAD,
        amr: ['mfa'],
      });

      const result = await svc.loginCallback('fake-token');

      expect(result.is2faEnabled).toBe(true);
    });
  });

  // ── MFA detection via amr claim ────────────────────────────────────────────

  describe('MFA detection via amr claim', () => {
    it.each([['mfa'], ['otp'], ['mfa-otp']])(
      'amr=["%s"] → is2faEnabled set to true in update',
      async (amrValue) => {
        const prisma = makePrisma();
        setupPrismaForCallback(prisma, {}, { is2faEnabled: true });
        const svc = await buildNoAuth0Service(prisma);
        jest.spyOn(svc as any, 'verifyAuth0Token').mockResolvedValue({
          ...BASE_PAYLOAD,
          amr: [amrValue],
        });

        await svc.loginCallback('fake-token');

        expect(prisma.user.update).toHaveBeenCalledWith(
          expect.objectContaining({
            data: expect.objectContaining({ is2faEnabled: true }),
          }),
        );
      },
    );

    it('amr=[] → is2faEnabled keeps existing user value', async () => {
      const prisma = makePrisma();
      // User already had is2faEnabled=true; amr empty; no auth0Management
      setupPrismaForCallback(prisma, { is2faEnabled: true }, {});
      const svc = await buildNoAuth0Service(prisma);
      jest.spyOn(svc as any, 'verifyAuth0Token').mockResolvedValue({
        ...BASE_PAYLOAD,
        amr: [],
      });

      await svc.loginCallback('fake-token');

      expect(prisma.user.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ is2faEnabled: true }),
        }),
      );
    });

    it('amr missing entirely → treated as [] (no MFA)', async () => {
      const prisma = makePrisma();
      setupPrismaForCallback(prisma);
      const svc = await buildNoAuth0Service(prisma);
      const { amr: _, ...payloadWithoutAmr } = BASE_PAYLOAD;
      jest.spyOn(svc as any, 'verifyAuth0Token').mockResolvedValue(payloadWithoutAmr);

      await svc.loginCallback('fake-token');

      expect(prisma.user.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ is2faEnabled: false }),
        }),
      );
    });
  });

  // ── MFA fallback via Management API ───────────────────────────────────────

  describe('MFA fallback via Management API (amr=[])', () => {
    it('hasMfa=true when enrollments.get returns a non-empty array', async () => {
      const prisma = makePrisma();
      setupPrismaForCallback(prisma);
      const enrollmentsGet = jest.fn().mockResolvedValue([{ id: 'enroll-1' }]);
      const svc = await buildWithAuth0Service(prisma, enrollmentsGet);
      jest.spyOn(svc as any, 'verifyAuth0Token').mockResolvedValue(BASE_PAYLOAD);

      await svc.loginCallback('fake-token');

      expect(enrollmentsGet).toHaveBeenCalledWith(BASE_PAYLOAD.sub);
      expect(prisma.user.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ is2faEnabled: true }),
        }),
      );
    });

    it('hasMfa=true when enrollments.get returns { data: [...] } shape', async () => {
      const prisma = makePrisma();
      setupPrismaForCallback(prisma);
      const enrollmentsGet = jest.fn().mockResolvedValue({ data: [{ id: 'enroll-1' }] });
      const svc = await buildWithAuth0Service(prisma, enrollmentsGet);
      jest.spyOn(svc as any, 'verifyAuth0Token').mockResolvedValue(BASE_PAYLOAD);

      await svc.loginCallback('fake-token');

      expect(prisma.user.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ is2faEnabled: true }),
        }),
      );
    });

    it('hasMfa=false when enrollments.get returns empty array', async () => {
      const prisma = makePrisma();
      setupPrismaForCallback(prisma);
      const enrollmentsGet = jest.fn().mockResolvedValue([]);
      const svc = await buildWithAuth0Service(prisma, enrollmentsGet);
      jest.spyOn(svc as any, 'verifyAuth0Token').mockResolvedValue(BASE_PAYLOAD);

      await svc.loginCallback('fake-token');

      expect(prisma.user.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ is2faEnabled: false }),
        }),
      );
    });

    it('swallows enrollments.get error and leaves hasMfa=false', async () => {
      const prisma = makePrisma();
      setupPrismaForCallback(prisma);
      const enrollmentsGet = jest.fn().mockRejectedValue(new Error('Management API down'));
      const svc = await buildWithAuth0Service(prisma, enrollmentsGet);
      jest.spyOn(svc as any, 'verifyAuth0Token').mockResolvedValue(BASE_PAYLOAD);

      await expect(svc.loginCallback('fake-token')).resolves.toBeDefined();
      expect(prisma.user.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ is2faEnabled: false }),
        }),
      );
    });

    it('skips enrollments.get when amr already contains mfa', async () => {
      const prisma = makePrisma();
      setupPrismaForCallback(prisma);
      const enrollmentsGet = jest.fn();
      const svc = await buildWithAuth0Service(prisma, enrollmentsGet);
      jest.spyOn(svc as any, 'verifyAuth0Token').mockResolvedValue({
        ...BASE_PAYLOAD,
        amr: ['mfa'],
      });

      await svc.loginCallback('fake-token');

      expect(enrollmentsGet).not.toHaveBeenCalled();
    });
  });

  // ── Failures ───────────────────────────────────────────────────────────────

  describe('authentication failures', () => {
    it('throws UnauthorizedException when user is not found in DB', async () => {
      const prisma = makePrisma();
      prisma.user.findUnique.mockResolvedValue(null);
      const svc = await buildNoAuth0Service(prisma);
      jest.spyOn(svc as any, 'verifyAuth0Token').mockResolvedValue(BASE_PAYLOAD);

      await expect(svc.loginCallback('fake-token')).rejects.toThrow(UnauthorizedException);
    });

    it('throws UnauthorizedException when user.isActive=false', async () => {
      const prisma = makePrisma();
      prisma.user.findUnique.mockResolvedValue({ ...DB_USER, isActive: false });
      const svc = await buildNoAuth0Service(prisma);
      jest.spyOn(svc as any, 'verifyAuth0Token').mockResolvedValue(BASE_PAYLOAD);

      await expect(svc.loginCallback('fake-token')).rejects.toThrow(UnauthorizedException);
    });

    it('throws UnauthorizedException when tenant.isActive=false', async () => {
      const prisma = makePrisma();
      prisma.user.findUnique.mockResolvedValue({
        ...DB_USER,
        tenant: { ...DB_USER.tenant, isActive: false },
      });
      const svc = await buildNoAuth0Service(prisma);
      jest.spyOn(svc as any, 'verifyAuth0Token').mockResolvedValue(BASE_PAYLOAD);

      await expect(svc.loginCallback('fake-token')).rejects.toThrow(UnauthorizedException);
    });

    it('does not call user.update when pre-conditions fail', async () => {
      const prisma = makePrisma();
      prisma.user.findUnique.mockResolvedValue(null);
      const svc = await buildNoAuth0Service(prisma);
      jest.spyOn(svc as any, 'verifyAuth0Token').mockResolvedValue(BASE_PAYLOAD);

      await svc.loginCallback('fake-token').catch(() => {});

      expect(prisma.user.update).not.toHaveBeenCalled();
    });
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 6.4 invite()
// ─────────────────────────────────────────────────────────────────────────────

describe('AuthService – 6.4 invite()', () => {
  const TENANT_ID_INV = 'tenant-inv-1';
  const INVITER_ID = 'inviter-user-1';
  const INVITER_NAME = 'Dr. Ayşe';
  const INVITE_EMAIL = 'newstaff@example.com';

  const TENANT = { id: TENANT_ID_INV, name: 'Klinik A', isActive: true };
  const CREATED_INVITE = {
    id: 'invite-1',
    tenantId: TENANT_ID_INV,
    email: INVITE_EMAIL,
    role: 'ASSISTANT',
    token: 'deadbeef'.repeat(8),
    expiresAt: new Date(),
  };

  let prisma: ReturnType<typeof makePrisma>;
  let notification: { sendEmail: jest.Mock };
  let configGet: jest.Mock;
  let service: AuthService;

  const NOW = new Date('2026-03-14T10:00:00.000Z');

  beforeEach(async () => {
    jest.useFakeTimers();
    jest.setSystemTime(NOW);

    prisma = makePrisma();
    notification = { sendEmail: jest.fn().mockResolvedValue(undefined) };
    configGet = jest.fn((key: string, defaultVal?: unknown) => {
      if (key === 'JWT_LOCAL_SECRET') return JWT_SECRET;
      if (key === 'FRONTEND_URL') return 'https://app.example.com';
      return defaultVal ?? undefined;
    });

    // Happy-path defaults
    prisma.tenant.findUnique.mockResolvedValue(TENANT);
    prisma.user.findFirst.mockResolvedValue(null);       // no existing user
    prisma.invitation.findFirst.mockResolvedValue(null); // no pending invite
    prisma.invitation.create.mockResolvedValue(CREATED_INVITE);

    const module = await Test.createTestingModule({
      providers: [
        AuthService,
        { provide: PrismaService, useValue: prisma },
        { provide: ConfigService, useValue: { get: configGet } },
        { provide: NotificationService, useValue: notification },
        { provide: StorageService, useValue: { buildLicenseDocKey: jest.fn(), generateUploadUrl: jest.fn() } },
        { provide: SubscriptionService, useValue: { createInitialSubscription: jest.fn() } },
        { provide: SystemConfigService, useValue: { getBoolean: jest.fn() } },
      ],
    }).compile();

    service = module.get<AuthService>(AuthService);
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  // ── Happy path ─────────────────────────────────────────────────────────────

  describe('happy path', () => {
    it('returns { message } containing the invite email', async () => {
      const result = await service.invite(TENANT_ID_INV, INVITER_ID, INVITER_NAME, INVITE_EMAIL);

      expect(result.message).toContain(INVITE_EMAIL);
    });

    it('creates invitation with role=ASSISTANT and correct tenantId/email', async () => {
      await service.invite(TENANT_ID_INV, INVITER_ID, INVITER_NAME, INVITE_EMAIL);

      expect(prisma.invitation.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            tenantId: TENANT_ID_INV,
            email: INVITE_EMAIL,
            role: 'ASSISTANT',
          }),
        }),
      );
    });

    it('invitation expiresAt is 7 days from now', async () => {
      await service.invite(TENANT_ID_INV, INVITER_ID, INVITER_NAME, INVITE_EMAIL);

      const expected = new Date(NOW);
      expected.setDate(expected.getDate() + 7);

      const call = prisma.invitation.create.mock.calls[0][0] as { data: { expiresAt: Date } };
      expect(call.data.expiresAt.getTime()).toBe(expected.getTime());
    });

    it('calls notification.sendEmail with correct recipient, inviterName, tenantName', async () => {
      await service.invite(TENANT_ID_INV, INVITER_ID, INVITER_NAME, INVITE_EMAIL);

      expect(notification.sendEmail).toHaveBeenCalledWith(
        INVITE_EMAIL,
        'invite-email',
        expect.objectContaining({
          inviterName: INVITER_NAME,
          tenantName: TENANT.name,
        }),
        expect.any(String),
        expect.any(String),
      );
    });

    it('inviteUrl in email payload contains the invitation token passed to create', async () => {
      await service.invite(TENANT_ID_INV, INVITER_ID, INVITER_NAME, INVITE_EMAIL);

      // Token is generated locally before create; capture it from the create call args
      const createCall = prisma.invitation.create.mock.calls[0][0] as { data: { token: string } };
      const token = createCall.data.token;

      const [, , templateVars] = notification.sendEmail.mock.calls[0] as [
        string,
        string,
        { inviteUrl: string },
        ...unknown[],
      ];
      expect(templateVars.inviteUrl).toContain(encodeURIComponent(token));
    });

    it('inviteUrl uses configured FRONTEND_URL', async () => {
      await service.invite(TENANT_ID_INV, INVITER_ID, INVITER_NAME, INVITE_EMAIL);

      const [, , templateVars] = notification.sendEmail.mock.calls[0] as [
        string,
        string,
        { inviteUrl: string },
        ...unknown[],
      ];
      expect(templateVars.inviteUrl).toMatch(/^https:\/\/app\.example\.com\//);
    });

    it('inviteUrl falls back to localhost:3000 when FRONTEND_URL is not set', async () => {
      configGet.mockImplementation((key: string, defaultVal?: unknown) => {
        if (key === 'JWT_LOCAL_SECRET') return JWT_SECRET;
        return defaultVal ?? undefined; // FRONTEND_URL not set → default returned
      });

      await service.invite(TENANT_ID_INV, INVITER_ID, INVITER_NAME, INVITE_EMAIL);

      const [, , templateVars] = notification.sendEmail.mock.calls[0] as [
        string,
        string,
        { inviteUrl: string },
        ...unknown[],
      ];
      expect(templateVars.inviteUrl).toMatch(/^http:\/\/localhost:3000\//);
    });
  });

  // ── Failures ───────────────────────────────────────────────────────────────

  describe('guard failures', () => {
    it('throws BadRequestException when tenant is not found', async () => {
      prisma.tenant.findUnique.mockResolvedValue(null);

      await expect(
        service.invite(TENANT_ID_INV, INVITER_ID, INVITER_NAME, INVITE_EMAIL),
      ).rejects.toThrow(BadRequestException);
    });

    it('throws ConflictException when user already belongs to tenant', async () => {
      prisma.user.findFirst.mockResolvedValue(makeActiveUser({ email: INVITE_EMAIL }));

      await expect(
        service.invite(TENANT_ID_INV, INVITER_ID, INVITER_NAME, INVITE_EMAIL),
      ).rejects.toThrow(ConflictException);
    });

    it('throws ConflictException when a pending invite already exists', async () => {
      prisma.invitation.findFirst.mockResolvedValue(CREATED_INVITE);

      await expect(
        service.invite(TENANT_ID_INV, INVITER_ID, INVITER_NAME, INVITE_EMAIL),
      ).rejects.toThrow(ConflictException);
    });

    it('does not send email when tenant is not found', async () => {
      prisma.tenant.findUnique.mockResolvedValue(null);

      await service.invite(TENANT_ID_INV, INVITER_ID, INVITER_NAME, INVITE_EMAIL).catch(() => {});

      expect(notification.sendEmail).not.toHaveBeenCalled();
    });

    it('does not send email when user already exists in tenant', async () => {
      prisma.user.findFirst.mockResolvedValue(makeActiveUser({ email: INVITE_EMAIL }));

      await service.invite(TENANT_ID_INV, INVITER_ID, INVITER_NAME, INVITE_EMAIL).catch(() => {});

      expect(notification.sendEmail).not.toHaveBeenCalled();
    });

    it('does not send email when pending invite already exists', async () => {
      prisma.invitation.findFirst.mockResolvedValue(CREATED_INVITE);

      await service.invite(TENANT_ID_INV, INVITER_ID, INVITER_NAME, INVITE_EMAIL).catch(() => {});

      expect(notification.sendEmail).not.toHaveBeenCalled();
    });

    it('checks for pending invite with acceptedAt=null and expiresAt > now', async () => {
      await service.invite(TENANT_ID_INV, INVITER_ID, INVITER_NAME, INVITE_EMAIL);

      expect(prisma.invitation.findFirst).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            email: INVITE_EMAIL,
            tenantId: TENANT_ID_INV,
            acceptedAt: null,
            expiresAt: { gt: NOW },
          }),
        }),
      );
    });
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 6.5 switchTenant()
// ─────────────────────────────────────────────────────────────────────────────

describe('AuthService – 6.5 switchTenant()', () => {
  const ST_USER_ID = 'user-st-1';
  const ORIGIN_TENANT = 'tenant-origin-1';
  const TARGET_TENANT = 'tenant-target-2';

  const DB_USER = {
    id: ST_USER_ID,
    auth0Sub: 'local|stuser123',
    tenantId: ORIGIN_TENANT,
    email: 'st@example.com',
    fullName: 'ST User',
    role: 'PSYCHOLOGIST',
  };

  const MEMBERSHIP = { userId: ST_USER_ID, tenantId: TARGET_TENANT, isActive: true };

  let prisma: ReturnType<typeof makePrisma>;
  let service: AuthService;

  beforeEach(async () => {
    prisma = makePrisma();

    // Happy-path defaults
    prisma.tenantMember.findFirst.mockResolvedValue(MEMBERSHIP);
    prisma.user.findUnique.mockResolvedValue(DB_USER);

    const module = await Test.createTestingModule({
      providers: [
        AuthService,
        { provide: PrismaService, useValue: prisma },
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn((key: string, defaultVal?: unknown) => {
              if (key === 'JWT_LOCAL_SECRET') return JWT_SECRET;
              return defaultVal ?? undefined;
            }),
          },
        },
        { provide: NotificationService, useValue: { sendEmail: jest.fn() } },
        { provide: StorageService, useValue: { buildLicenseDocKey: jest.fn(), generateUploadUrl: jest.fn() } },
        { provide: SubscriptionService, useValue: { createInitialSubscription: jest.fn() } },
        { provide: SystemConfigService, useValue: { getBoolean: jest.fn() } },
      ],
    }).compile();

    service = module.get<AuthService>(AuthService);
  });

  // ── Happy path ─────────────────────────────────────────────────────────────

  describe('happy path', () => {
    it('returns { token } when membership is active', async () => {
      const result = await service.switchTenant(ST_USER_ID, TARGET_TENANT);

      expect(result).toHaveProperty('token');
      expect(typeof result.token).toBe('string');
    });

    it('token is a valid HS256 JWT with correct sub and targetTenantId', async () => {
      const { token } = await service.switchTenant(ST_USER_ID, TARGET_TENANT);

      const decoded = jwt.verify(token, JWT_SECRET) as Record<string, unknown>;
      expect(decoded['sub']).toBe(DB_USER.auth0Sub);
      expect(decoded['tenantId']).toBe(TARGET_TENANT);
    });

    it('token contains targetTenantId, not the user original tenantId', async () => {
      const { token } = await service.switchTenant(ST_USER_ID, TARGET_TENANT);

      const decoded = jwt.decode(token) as Record<string, unknown>;
      expect(decoded['tenantId']).toBe(TARGET_TENANT);
      expect(decoded['tenantId']).not.toBe(ORIGIN_TENANT);
    });

    it('queries tenantMember with userId, targetTenantId, isActive=true', async () => {
      await service.switchTenant(ST_USER_ID, TARGET_TENANT);

      expect(prisma.tenantMember.findFirst).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { userId: ST_USER_ID, tenantId: TARGET_TENANT, isActive: true },
        }),
      );
    });

    it('fetches user by userId after membership is confirmed', async () => {
      await service.switchTenant(ST_USER_ID, TARGET_TENANT);

      expect(prisma.user.findUnique).toHaveBeenCalledWith(
        expect.objectContaining({ where: { id: ST_USER_ID } }),
      );
    });
  });

  // ── Failures ───────────────────────────────────────────────────────────────

  describe('failures', () => {
    it('throws ForbiddenException when membership not found', async () => {
      prisma.tenantMember.findFirst.mockResolvedValue(null);

      await expect(service.switchTenant(ST_USER_ID, TARGET_TENANT)).rejects.toThrow(
        ForbiddenException,
      );
    });

    it('throws UnauthorizedException when user is not found despite valid membership', async () => {
      prisma.user.findUnique.mockResolvedValue(null);

      await expect(service.switchTenant(ST_USER_ID, TARGET_TENANT)).rejects.toThrow(
        UnauthorizedException,
      );
    });

    it('does not call user.findUnique when membership check fails', async () => {
      prisma.tenantMember.findFirst.mockResolvedValue(null);

      await service.switchTenant(ST_USER_ID, TARGET_TENANT).catch(() => {});

      expect(prisma.user.findUnique).not.toHaveBeenCalled();
    });
  });
});
