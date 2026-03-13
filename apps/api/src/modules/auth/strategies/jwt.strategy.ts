import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import jwt from 'jsonwebtoken';
import jwksRsa from 'jwks-rsa';
import { PrismaService } from '../../../database/prisma.service';

/** Auth0 JWT payload — custom claims: tenant_id, role (via Action/Rule) */
export interface Auth0JwtPayload {
  sub: string;
  email?: string;
  tenant_id?: string;
  tenantId?: string;
  role?: string;
  [key: string]: unknown;
}

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy, 'jwt') {
  constructor(
    private readonly configService: ConfigService,
    private readonly prisma: PrismaService,
  ) {
    const auth0Domain =
      configService.get<string>('AUTH0_DOMAIN') ?? '';
    const expectedAudience =
      configService.get<string>('AUTH0_AUDIENCE') ?? '';

    // Tek bir jwksRsa client — cache (10dk) tüm isteklerde paylaşılır.
    // Her istekte yeni client oluşturmak cache'i etkisiz kılar ve her
    // doğrulamada Auth0'a ağ isteği atılmasına yol açar.
    const jwksClient = jwksRsa({
      jwksUri: `https://${auth0Domain}/.well-known/jwks.json`,
      cache: true,
      cacheMaxAge: 10 * 60 * 1000, // 10 dakika
      rateLimit: true,
    });

    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      audience: expectedAudience || undefined,
      issuer: `https://${auth0Domain}/`,
      algorithms: ['RS256'],
      secretOrKeyProvider: (req, rawJwtToken, done) => {
        const decoded = jwt.decode(String(rawJwtToken), {
          complete: true,
        }) as { header?: { kid?: string } } | null;
        if (!decoded?.header?.kid) {
          return done(new UnauthorizedException('Invalid JWT header'), undefined);
        }

        jwksClient.getSigningKey(
          decoded.header.kid,
          (err: Error | null, key: { getPublicKey: () => string } | undefined) => {
            if (err) return done(err, undefined);
            done(null, key?.getPublicKey?.());
          },
        );
      },
    });
  }

  async validate(payload: Auth0JwtPayload): Promise<{
    sub: string;
    tenantId: string;
    userId: string;
    email?: string;
    fullName?: string;
    role: string;
    is2faEnabled: boolean;
  }> {
    if (!payload?.sub) {
      throw new UnauthorizedException('Invalid token');
    }

    // tenant_id claim zorunlu (Auth0 Action/Rule ile eklenir, namespace = audience)
    const audience = this.configService.get<string>('AUTH0_AUDIENCE') ?? '';
    const tenantId =
      payload.tenant_id ??
      payload.tenantId ??
      (audience ? (payload[`${audience}/tenant_id`] as string | undefined) : undefined);
    if (!tenantId) {
      throw new UnauthorizedException('Token missing tenant_id claim');
    }

    // role claim'i JWT'den oku (DB roundtrip'ini azaltmak için)
    const role =
      payload.role ??
      (audience ? (payload[`${audience}/role`] as string | undefined) : undefined);

    const user = await this.prisma.user.findFirst({
      where: {
        auth0Sub: payload.sub,
        tenantId,
      },
      include: { tenant: true },
    });

    if (!user || !user.isActive || !user.tenant.isActive) {
      throw new UnauthorizedException('User not found or inactive');
    }

    return {
      sub: payload.sub,
      tenantId,
      userId: user.id,
      email: user.email,
      fullName: user.fullName,
      role: role ?? user.role,
      is2faEnabled: user.is2faEnabled,
    };
  }
}
