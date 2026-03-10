import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as crypto from 'crypto';

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 12;
const TAG_LENGTH = 16;
const KEY_LENGTH = 32;

@Injectable()
export class TokenEncryptionService {
  private readonly key: Buffer;

  constructor(private readonly config: ConfigService) {
    const keyB64 = this.config.get<string>('CALENDAR_TOKEN_ENCRYPTION_KEY');
    if (!keyB64 || keyB64.length < 32) {
      this.key = Buffer.alloc(KEY_LENGTH, 0);
    } else {
      this.key = Buffer.from(keyB64, 'base64');
      if (this.key.length !== KEY_LENGTH) {
        this.key = crypto.createHash('sha256').update(keyB64).digest();
      }
    }
  }

  encrypt(plaintext: string): { ciphertext: Buffer; nonce: Buffer } {
    const nonce = crypto.randomBytes(IV_LENGTH);
    const cipher = crypto.createCipheriv(ALGORITHM, this.key, nonce);
    const encrypted = Buffer.concat([
      cipher.update(plaintext, 'utf8'),
      cipher.final(),
    ]);
    const tag = cipher.getAuthTag();
    const ciphertext = Buffer.concat([encrypted, tag]);
    return { ciphertext, nonce };
  }

  decrypt(ciphertext: Buffer, nonce: Buffer): string {
    const tag = ciphertext.subarray(-TAG_LENGTH);
    const encrypted = ciphertext.subarray(0, -TAG_LENGTH);
    const decipher = crypto.createDecipheriv(ALGORITHM, this.key, nonce);
    decipher.setAuthTag(tag);
    return decipher.update(encrypted) + decipher.final('utf8');
  }
}
