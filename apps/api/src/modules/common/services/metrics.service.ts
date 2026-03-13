import { Injectable } from '@nestjs/common';
import { metrics, Histogram, ObservableGauge } from '@opentelemetry/api';
import { DekCacheService } from './dek-cache.service';

@Injectable()
export class MetricsService {
  private readonly scoringDuration: Histogram;
  private readonly queueDepthGauge: ObservableGauge;
  private readonly cacheHitRatioGauge: ObservableGauge;

  private _queueDepths: Record<string, number> = {};

  constructor(private readonly dekCache: DekCacheService) {
    const meter = metrics.getMeter('psikoport');

    this.scoringDuration = meter.createHistogram('scoring_calculation_duration_ms', {
      description: 'Time taken for scoring calculation in milliseconds',
      unit: 'ms',
    });

    this.queueDepthGauge = meter.createObservableGauge('bullmq_queue_depth', {
      description: 'Current depth of BullMQ queues',
    });

    this.cacheHitRatioGauge = meter.createObservableGauge('encryption_dek_cache_hit_ratio', {
      description: 'DEK in-process cache hit ratio (0–1)',
    });

    this.queueDepthGauge.addCallback((result) => {
      for (const [queue, depth] of Object.entries(this._queueDepths)) {
        result.observe(depth, { queue });
      }
    });

    // Pull live ratio directly from DekCacheService at collection time
    this.cacheHitRatioGauge.addCallback((result) => {
      result.observe(this.dekCache.getHitRatio());
    });
  }

  recordScoringDuration(ms: number): void {
    this.scoringDuration.record(ms);
  }

  updateQueueDepth(queue: string, depth: number): void {
    this._queueDepths[queue] = depth;
  }
}
