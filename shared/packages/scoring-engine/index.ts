/**
 * Test puanlama kütüphanesi
 * Saf TypeScript, framework bağımlılığı yok. BullMQ worker tarafından çağrılır.
 */

import { SumCalculator } from './calculators/sum.calculator';
import { SubscaleCalculator } from './calculators/subscale.calculator';
import type { ScoringConfig, ScoringResult } from './models/scoring.types';

const sumCalculator = new SumCalculator();
const subscaleCalculator = new SubscaleCalculator();

/**
 * Config.type'a göre doğru calculator ile puan hesapla.
 */
export function calculateScore(
  responses: Record<string, unknown>,
  scoringConfig: ScoringConfig,
): ScoringResult {
  const numeric: Record<string, number> = {};
  for (const [k, v] of Object.entries(responses)) {
    const n = typeof v === 'number' ? v : Number(v);
    if (!Number.isNaN(n)) numeric[k] = n;
  }

  switch (scoringConfig.type) {
    case 'sum':
      return sumCalculator.calculate(numeric, scoringConfig);
    case 'subscale':
      return subscaleCalculator.calculate(numeric, scoringConfig);
    case 'weighted':
    case 'custom':
      return sumCalculator.calculate(numeric, scoringConfig);
    default:
      return sumCalculator.calculate(numeric, scoringConfig);
  }
}

export { SumCalculator } from './calculators/sum.calculator';
export { SubscaleCalculator } from './calculators/subscale.calculator';
export { BaseCalculator } from './calculators/base.calculator';
export * from './models/scoring.types';
export const SCORING_ENGINE_VERSION = '0.0.1';
