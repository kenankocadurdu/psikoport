import { SetMetadata } from '@nestjs/common';

export const SKIP_2FA_KEY = 'skip2fa';

/** Bu endpoint 2FA kontrolünden muaf — örn. /auth/me (kullanıcı durumunu öğrenmek için) */
export const Skip2FA = () => SetMetadata(SKIP_2FA_KEY, true);
