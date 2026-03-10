import { describe, it, expect } from 'vitest';
import { calculateScore } from '../index';
import type { ScoringConfig } from '../models/scoring.types';

/**
 * DASS-21: 21 items, 7 per subscale.
 * Depression: 3, 5, 10, 13, 16, 17, 21
 * Anxiety: 2, 4, 7, 9, 15, 19, 20
 * Stress: 1, 6, 8, 11, 12, 14, 18
 * Each item 0-3. multiplier 2 to compare to DASS-42.
 */
const DASS21_CONFIG: ScoringConfig = {
  type: 'subscale',
  subscales: {
    depression: {
      item_ids: ['q3', 'q5', 'q10', 'q13', 'q16', 'q17', 'q21'],
      multiplier: 2,
    },
    anxiety: {
      item_ids: ['q2', 'q4', 'q7', 'q9', 'q15', 'q19', 'q20'],
      multiplier: 2,
    },
    stress: {
      item_ids: ['q1', 'q6', 'q8', 'q11', 'q12', 'q14', 'q18'],
      multiplier: 2,
    },
  },
};

function makeDass21Responses(overrides?: Partial<Record<string, number>>): Record<string, number> {
  const out: Record<string, number> = {};
  for (let i = 1; i <= 21; i++) {
    const key = i <= 9 ? `q${i}` : `q${i}`;
    out[key] = overrides?.[key] ?? 0;
  }
  return out;
}

describe('DASS-21 scoring', () => {
  it('all zeros → subscales 0, totalScore 0', () => {
    const responses = makeDass21Responses();
    const result = calculateScore(responses, DASS21_CONFIG);
    expect(result.totalScore).toBe(0);
    expect(result.subscales).toHaveLength(3);
    const dep = result.subscales!.find((s) => s.id === 'depression');
    const anx = result.subscales!.find((s) => s.id === 'anxiety');
    const str = result.subscales!.find((s) => s.id === 'stress');
    expect(dep?.score).toBe(0);
    expect(anx?.score).toBe(0);
    expect(str?.score).toBe(0);
  });

  it('depression items all 3 → depression subscale = 42', () => {
    const responses = makeDass21Responses({
      q3: 3,
      q5: 3,
      q10: 3,
      q13: 3,
      q16: 3,
      q17: 3,
      q21: 3,
    });
    const result = calculateScore(responses, DASS21_CONFIG);
    const dep = result.subscales!.find((s) => s.id === 'depression');
    expect(dep?.score).toBe(7 * 3 * 2);
    expect(dep?.score).toBe(42);
  });

  it('anxiety items all 1 → anxiety subscale = 14', () => {
    const responses = makeDass21Responses({
      q2: 1,
      q4: 1,
      q7: 1,
      q9: 1,
      q15: 1,
      q19: 1,
      q20: 1,
    });
    const result = calculateScore(responses, DASS21_CONFIG);
    const anx = result.subscales!.find((s) => s.id === 'anxiety');
    expect(anx?.score).toBe(7 * 1 * 2);
    expect(anx?.score).toBe(14);
  });

  it('stress items all 2 → stress subscale = 28', () => {
    const responses = makeDass21Responses({
      q1: 2,
      q6: 2,
      q8: 2,
      q11: 2,
      q12: 2,
      q14: 2,
      q18: 2,
    });
    const result = calculateScore(responses, DASS21_CONFIG);
    const str = result.subscales!.find((s) => s.id === 'stress');
    expect(str?.score).toBe(7 * 2 * 2);
    expect(str?.score).toBe(28);
  });

  it('totalScore = sum of subscales', () => {
    const responses = makeDass21Responses({
      q3: 1,
      q5: 1,
      q2: 1,
      q4: 1,
      q1: 1,
      q6: 1,
    });
    const result = calculateScore(responses, DASS21_CONFIG);
    const dep = result.subscales!.find((s) => s.id === 'depression');
    const anx = result.subscales!.find((s) => s.id === 'anxiety');
    const str = result.subscales!.find((s) => s.id === 'stress');
    const manualTotal = (dep?.score ?? 0) + (anx?.score ?? 0) + (str?.score ?? 0);
    expect(result.totalScore).toBe(manualTotal);
  });
});
