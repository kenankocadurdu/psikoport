import { Global, Module } from '@nestjs/common';
import { DekCacheService } from './dek-cache.service';
import { EncryptionService } from './encryption.service';

/**
 * Global module — import once in AppModule (or WorkerModule) and
 * EncryptionService + DekCacheService become available everywhere
 * without re-importing.
 */
@Global()
@Module({
  providers: [DekCacheService, EncryptionService],
  exports: [DekCacheService, EncryptionService],
})
export class EncryptionModule {}
