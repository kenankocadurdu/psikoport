/**
 * Node.js note encryption for seed — matches frontend envelope format.
 * Demo password + fixed salt → KEK → encrypt note content.
 */
import * as argon2 from 'argon2';
import * as crypto from 'crypto';

const GCM_IV_LENGTH = 12;
const GCM_TAG_LENGTH = 16;
const DEK_LENGTH = 32;

export const DEMO_PASSWORD = 'demo';
/** Fixed 16-byte salt for demo — must match NEXT_PUBLIC_KEK_SALT_B64 in .env */
export const DEMO_SALT_B64 = Buffer.alloc(16, 'psikoport-demo').toString('base64');

async function deriveKEK(password: string, salt: Buffer): Promise<Buffer> {
  const encoded = await argon2.hash(password, {
    type: argon2.argon2id,
    memoryCost: 65536,
    timeCost: 3,
    hashLength: 32,
    salt,
  });
  const parts = encoded.split('$');
  const hashB64 = parts[parts.length - 1];
  if (!hashB64) throw new Error('Invalid argon2 output');
  return Buffer.from(hashB64, 'base64');
}

function aesGcmEncrypt(plaintext: Buffer, key: Buffer): { ciphertext: Buffer; nonce: Buffer; tag: Buffer } {
  const nonce = crypto.randomBytes(GCM_IV_LENGTH);
  const cipher = crypto.createCipheriv('aes-256-gcm', key, nonce, { authTagLength: GCM_TAG_LENGTH });
  const encrypted = Buffer.concat([cipher.update(plaintext), cipher.final()]);
  const tag = cipher.getAuthTag();
  return { ciphertext: encrypted, nonce, tag };
}

export async function encryptNoteForSeed(plaintext: string): Promise<{
  encryptedContent: Buffer;
  encryptedDek: Buffer;
  contentNonce: Buffer;
  contentAuthTag: Buffer;
  dekNonce: Buffer;
  dekAuthTag: Buffer;
}> {
  const salt = Buffer.from(DEMO_SALT_B64, 'base64');
  if (salt.length !== 16) {
    throw new Error('DEMO_SALT_B64 must decode to 16 bytes');
  }
  const kek = await deriveKEK(DEMO_PASSWORD, salt);

  const dek = crypto.randomBytes(DEK_LENGTH);
  const plaintextBuf = Buffer.from(plaintext, 'utf8');
  const { ciphertext: encryptedContent, nonce: contentNonce, tag: contentAuthTag } = aesGcmEncrypt(
    plaintextBuf,
    dek,
  );

  const { ciphertext: encryptedDek, nonce: dekNonce, tag: dekAuthTag } = aesGcmEncrypt(dek, kek);

  return {
    encryptedContent,
    encryptedDek,
    contentNonce,
    contentAuthTag,
    dekNonce,
    dekAuthTag,
  };
}
