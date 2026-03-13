import { Injectable } from '@nestjs/common';
import { metrics, Histogram, ObservableGauge } from '@opentelemetry/api';

@Injectable()
export class MetricsService {
  private readonly scoringDuration: Histogram;
  private readonly queueDepthGauge: ObservableGauge;
  private readonly cacheHitRatioGauge: ObservableGauge;

  private _cacheHitRatio = 0;
  private _queueDepths: Record<string, number> = {};

  constructor() {
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

    this.cacheHitRatioGauge.addCallback((result) => {
      result.observe(this._cacheHitRatio);
    });
  }

  recordScoringDuration(ms: number): void {
    this.scoringDuration.record(ms);
  }

  updateCacheHitRatio(ratio: number): void {
    this._cacheHitRatio = ratio;
  }

  updateQueueDepth(queue: string, depth: number): void {
    this._queueDepths[queue] = depth;
  }
}
