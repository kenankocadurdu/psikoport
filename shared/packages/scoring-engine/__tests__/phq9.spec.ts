import { describe, it, expect } from 'vitest';
import { calculateScore } from '../index';
import type { ScoringConfig } from '../models/scoring.types';

const PHQ9_CONFIG: ScoringConfig = {
  type: 'sum',
  total_score: { min: 0, max: 27, calculation: 'SUM(all_items)' },
  severity_levels: [
    { range: [0, 4], level: 'minimal', label: 'Minimal depresyon' },
    { range: [5, 9], level: 'mild', label: 'Hafif depresyon' },
    { range: [10, 14], level: 'moderate', label: 'Orta depresyon' },
    { range: [15, 19], level: 'moderately_severe', label: 'Orta-agir depresyon' },
    { range: [20, 27], level: 'severe', label: 'Agir depresyon' },
  ],
  risk_items: [
    { item_id: 'q9', threshold: 1, flag: 'suicide_risk', action: 'crisis_protocol' },
  ],
};

const PHQ9_ITEMS = ['q1', 'q2', 'q3', 'q4', 'q5', 'q6', 'q7', 'q8', 'q9'];

function makeResponses(values: number[]): Record<string, number> {
  const out: Record<string, number> = {};
  PHQ9_ITEMS.forEach((id, i) => {
    out[id] = values[i] ?? 0;
  });
  return out;
}

describe('PHQ-9 scoring', () => {
  it('responses all 0 -> totalScore=0, severity=minimal', () => {
    const responses = makeResponses([0, 0, 0, 0, 0, 0, 0, 0, 0]);
    const result = calculateScore(responses, PHQ9_CONFIG);
    expect(result.totalScore).toBe(0);
    expect(result.severityLevel).toBe('minimal');
    expect(result.riskFlags).toEqual([]);
  });

  it('responses all 3 -> totalScore=27, severity=severe', () => {
    const responses = makeResponses([3, 3, 3, 3, 3, 3, 3, 3, 3]);
    const result = calculateScore(responses, PHQ9_CONFIG);
    expect(result.totalScore).toBe(27);
    expect(result.severityLevel).toBe('severe');
  });

  it('q9=2 -> riskFlags includes suicide_risk', () => {
    const responses = makeResponses([0, 0, 0, 0, 0, 0, 0, 0, 2]);
    const result = calculateScore(responses, PHQ9_CONFIG);
    expect(result.riskFlags).toContain('suicide_risk');
  });

  it('q9=0 -> no suicide_risk', () => {
    const responses = makeResponses([1, 1, 1, 1, 1, 1, 1, 1, 0]);
    const result = calculateScore(responses, PHQ9_CONFIG);
    expect(result.riskFlags).not.toContain('suicide_risk');
  });
});
