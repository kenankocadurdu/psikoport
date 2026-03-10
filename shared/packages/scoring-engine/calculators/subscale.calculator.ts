import { BaseCalculator } from './base.calculator';
import type {
  ScoringConfig,
  ScoringResult,
  SubscaleScore,
} from '../models/scoring.types';

/**
 * SUBSCALE type: Compute scores per subscale.
 * Example: DASS-21 (depression, anxiety, stress)
 */
export class SubscaleCalculator extends BaseCalculator {
  calculate(
    responses: Record<string, number>,
    config: ScoringConfig,
  ): ScoringResult {
    const numeric = this.toNumericResponses(
      responses as unknown as Record<string, unknown>,
    );
    const subscales: SubscaleScore[] = [];

    if (!config.subscales) {
      const totalScore = Object.values(numeric).reduce((a, b) => a + b, 0);
      const severity = this.determineSeverity(
        totalScore,
        config.severity_levels,
      );
      const riskFlags = this.checkRiskItems(numeric, config.risk_items);
      return {
        totalScore,
        subscales: [],
        severityLevel: severity?.level,
        severityLabel: severity?.label,
        riskFlags,
        rawItemScores: { ...numeric },
      };
    }

    let totalScore = 0;
    for (const [id, def] of Object.entries(config.subscales)) {
      const multiplier = def.multiplier ?? 1;
      let score = 0;
      for (const itemId of def.item_ids) {
        const v = numeric[itemId];
        if (v !== undefined) score += v;
      }
      const subscaleScore = score * multiplier;
      totalScore += subscaleScore;
      subscales.push({
        id,
        score: subscaleScore,
        maxScore: def.item_ids.length * 3 * multiplier,
      });
    }

    const severity = this.determineSeverity(totalScore, config.severity_levels);
    const riskFlags = this.checkRiskItems(numeric, config.risk_items);

    return {
      totalScore,
      subscales,
      severityLevel: severity?.level,
      severityLabel: severity?.label,
      riskFlags,
      rawItemScores: { ...numeric },
    };
  }
}
