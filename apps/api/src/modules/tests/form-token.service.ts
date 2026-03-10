import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as jwt from 'jsonwebtoken';

/**
 * JWT payload for form token (danışan formu — Auth0 login gerekmez).
 * formToken = JWT(clientId, formDefinitionId, tenantId, psychologistId, exp: 7d)
 */
export interface FormTokenPayload {
  clientId: string;
  formDefinitionId: string;
  tenantId: string;
  psychologistId: string;
  iat?: number;
  exp?: number;
}

@Injectable()
export class FormTokenService {
  private readonly secret: string;
  private readonly expiresIn = '7d';

  constructor(private readonly config: ConfigService) {
    this.secret =
      this.config.get<string>('FORM_TOKEN_SECRET') ??
      this.config.get<string>('JWT_SECRET') ??
      'dev-form-token-secret-change-in-prod';
  }

  generateToken(payload: Omit<FormTokenPayload, 'iat' | 'exp'>): string {
    return jwt.sign(payload, this.secret, { expiresIn: this.expiresIn });
  }

  verifyToken(token: string): FormTokenPayload {
    try {
      const decoded = jwt.verify(token, this.secret) as FormTokenPayload;
      if (
        !decoded.clientId ||
        !decoded.formDefinitionId ||
        !decoded.tenantId ||
        !decoded.psychologistId
      ) {
        throw new UnauthorizedException('Geçersiz form token');
      }
      return decoded;
    } catch {
      throw new UnauthorizedException('Form token geçersiz veya süresi dolmuş');
    }
  }
}
