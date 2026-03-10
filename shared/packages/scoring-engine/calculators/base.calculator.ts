import type {
  ScoringConfig,
  ScoringResult,
  SeverityLevel,
  RiskItem,
} from '../models/scoring.types';

export abstract class BaseCalculator {
  abstract calculate(
    responses: Record<string, number>,
    config: ScoringConfig,
  ): ScoringResult;

  protected determineSeverity(
    score: number,
    levels: SeverityLevel[] | undefined,
  ): { level: string; label: string } | undefined {
    if (!levels || levels.length === 0) return undefined;
    const sorted = [...levels].sort((a, b) => b.range[0] - a.range[0]);
    const found = sorted.find(
      (s) => score >= s.range[0] && score <= s.range[1],
    );
    return found ? { level: found.level, label: found.label } : undefined;
  }

  protected checkRiskItems(
    responses: Record<string, number>,
    riskItems: RiskItem[] | undefined,
  ): string[] {
    if (!riskItems) return [];
    const flags: string[] = [];
    for (const item of riskItems) {
      const val = responses[item.item_id];
      if (val !== undefined && val >= item.threshold) {
        flags.push(item.flag);
      }
    }
    return flags;
  }

  protected toNumericResponses(
    responses: Record<string, unknown>,
  ): Record<string, number> {
    const out: Record<string, number> = {};
    for (const [k, v] of Object.entries(responses)) {
      const n = typeof v === 'number' ? v : Number(v);
      if (!Number.isNaN(n)) out[k] = n;
    }
    return out;
  }
}
