import type { BaseCalculator } from '../calculators/base.calculator';
import type { ScoringConfig, ScoringResult } from '../models/scoring.types';

export class CalculatorRegistry {
  private readonly calculators = new Map<string, BaseCalculator>();

  register(type: string, calculator: BaseCalculator): this {
    this.calculators.set(type, calculator);
    return this;
  }

  get(type: string): BaseCalculator {
    const calculator = this.calculators.get(type);
    if (!calculator) {
      const fallback = this.calculators.get('sum');
      if (!fallback) {
        throw new Error(`No calculator registered for type "${type}" and no fallback "sum" calculator`);
      }
      return fallback;
    }
    return calculator;
  }

  calculate(
    responses: Record<string, unknown>,
    scoringConfig: ScoringConfig,
  ): ScoringResult {
    const numeric: Record<string, number> = {};
    for (const [k, v] of Object.entries(responses)) {
      const n = typeof v === 'number' ? v : Number(v);
      if (!Number.isNaN(n)) numeric[k] = n;
    }

    const calculator = this.get(scoringConfig.type);
    return calculator.calculate(numeric, scoringConfig);
  }
}
