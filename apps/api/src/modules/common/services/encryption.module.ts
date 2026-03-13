import { Global, Module } from '@nestjs/common';
import { DekCacheService } from './dek-cache.service';
import { EncryptionService } from './encryption.service';
import { MetricsService } from './metrics.service';

/**
 * Global module — import once in AppModule (or WorkerModule) and
 * EncryptionService + DekCacheService + MetricsService become available
 * everywhere without re-importing.
 */
@Global()
@Module({
  providers: [DekCacheService, EncryptionService, MetricsService],
  exports: [DekCacheService, EncryptionService, MetricsService],
})
export class EncryptionModule {}
