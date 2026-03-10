import { BaseCalculator } from './base.calculator';
import type { ScoringConfig, ScoringResult } from '../models/scoring.types';

export class SumCalculator extends BaseCalculator {
  calculate(responses: Record<string, number>, config: ScoringConfig): ScoringResult {
    const numeric = this.toNumericResponses(responses as unknown as Record<string, unknown>);
    const totalScore = Object.values(numeric).reduce((a, b) => a + b, 0);
    const severity = this.determineSeverity(totalScore, config.severity_levels);
    const riskFlags = this.checkRiskItems(numeric, config.risk_items);
    return {
      totalScore,
      severityLevel: severity?.level,
      severityLabel: severity?.label,
      riskFlags,
      rawItemScores: { ...numeric },
    };
  }
}
