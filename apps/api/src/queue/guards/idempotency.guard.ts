import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Redis from 'ioredis';

@Injectable()
export class IdempotencyGuard {
  private readonly redis: Redis;

  constructor(private readonly config: ConfigService) {
    const redisUrl = this.config.get<string>('REDIS_URL', 'redis://localhost:6379');
    this.redis = new Redis(redisUrl);
  }

  async acquireLock(key: string, ttlSeconds: number): Promise<boolean> {
    const result = await this.redis.set(key, '1', 'EX', ttlSeconds, 'NX');
    return result === 'OK';
  }

  async releaseLock(key: string): Promise<void> {
    await this.redis.del(key);
  }
}
