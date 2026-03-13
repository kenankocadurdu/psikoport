/**
 * Test puanlama kütüphanesi
 * Saf TypeScript, framework bağımlılığı yok. BullMQ worker tarafından çağrılır.
 */

import { SumCalculator } from './calculators/sum.calculator';
import { SubscaleCalculator } from './calculators/subscale.calculator';
import { CalculatorRegistry } from './registry/calculator-registry';
import type { ScoringConfig, ScoringResult } from './models/scoring.types';

const registry = new CalculatorRegistry();
registry.register('sum', new SumCalculator());
registry.register('subscale', new SubscaleCalculator());
registry.register('weighted', new SumCalculator());
registry.register('custom', new SumCalculator());

/**
 * Config.type'a göre doğru calculator ile puan hesapla.
 */
export function calculateScore(
  responses: Record<string, unknown>,
  scoringConfig: ScoringConfig,
): ScoringResult {
  return registry.calculate(responses, scoringConfig);
}

export { CalculatorRegistry } from './registry/calculator-registry';
export { SumCalculator } from './calculators/sum.calculator';
export { SubscaleCalculator } from './calculators/subscale.calculator';
export { BaseCalculator } from './calculators/base.calculator';
export * from './models/scoring.types';
export const SCORING_ENGINE_VERSION = '0.0.1';
