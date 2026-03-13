import type { ScoringType } from '../models/scoring.types';

const VALID_TYPES: ScoringType[] = ['sum', 'weighted', 'subscale', 'custom'];

export function validateScoringConfig(config: unknown): {
  valid: boolean;
  errors: string[];
} {
  const errors: string[] = [];

  if (!config || typeof config !== 'object' || Array.isArray(config)) {
    return { valid: false, errors: ['scoringConfig bir obje olmalıdır'] };
  }

  const c = config as Record<string, unknown>;

  // type zorunlu
  if (!c.type) {
    errors.push('"type" alanı zorunludur');
  } else if (typeof c.type !== 'string') {
    errors.push('"type" string olmalıdır');
  } else if (!VALID_TYPES.includes(c.type as ScoringType)) {
    errors.push(`"type" şu değerlerden biri olmalıdır: ${VALID_TYPES.join(', ')}`);
  }

  // subscale tipi için subscales zorunlu
  if (c.type === 'subscale') {
    if (!c.subscales) {
      errors.push('"subscale" tipinde "subscales" alanı zorunludur');
    } else if (typeof c.subscales !== 'object' || Array.isArray(c.subscales)) {
      errors.push('"subscales" bir obje olmalıdır');
    } else {
      const subscales = c.subscales as Record<string, unknown>;
      for (const [key, val] of Object.entries(subscales)) {
        if (!val || typeof val !== 'object' || Array.isArray(val)) {
          errors.push(`subscales["${key}"] bir obje olmalıdır`);
          continue;
        }
        const subscale = val as Record<string, unknown>;
        if (!Array.isArray(subscale.item_ids) || subscale.item_ids.length === 0) {
          errors.push(`subscales["${key}"].item_ids dolu bir dizi olmalıdır`);
        }
      }
    }
  }

  // weighted tipi için weights zorunlu
  if (c.type === 'weighted') {
    if (!c.weights) {
      errors.push('"weighted" tipinde "weights" alanı zorunludur');
    } else if (typeof c.weights !== 'object' || Array.isArray(c.weights)) {
      errors.push('"weights" bir obje olmalıdır');
    } else {
      const weights = c.weights as Record<string, unknown>;
      for (const [key, val] of Object.entries(weights)) {
        if (typeof val !== 'number') {
          errors.push(`weights["${key}"] sayı olmalıdır`);
        }
      }
    }
  }

  // total_score varsa min/max kontrol
  if (c.total_score !== undefined) {
    if (typeof c.total_score !== 'object' || Array.isArray(c.total_score)) {
      errors.push('"total_score" bir obje olmalıdır');
    } else {
      const ts = c.total_score as Record<string, unknown>;
      if (typeof ts.min !== 'number') errors.push('"total_score.min" sayı olmalıdır');
      if (typeof ts.max !== 'number') errors.push('"total_score.max" sayı olmalıdır');
      if (typeof ts.min === 'number' && typeof ts.max === 'number' && ts.min > ts.max) {
        errors.push('"total_score.min", "total_score.max"\'tan büyük olamaz');
      }
    }
  }

  // severity_levels varsa her birinin range, level, label alanları kontrol
  if (c.severity_levels !== undefined) {
    if (!Array.isArray(c.severity_levels)) {
      errors.push('"severity_levels" bir dizi olmalıdır');
    } else {
      c.severity_levels.forEach((item: unknown, i: number) => {
        if (!item || typeof item !== 'object' || Array.isArray(item)) {
          errors.push(`severity_levels[${i}] bir obje olmalıdır`);
          return;
        }
        const sl = item as Record<string, unknown>;
        if (!Array.isArray(sl.range) || sl.range.length !== 2) {
          errors.push(`severity_levels[${i}].range 2 elemanlı bir dizi olmalıdır`);
        }
        if (typeof sl.level !== 'string') errors.push(`severity_levels[${i}].level string olmalıdır`);
        if (typeof sl.label !== 'string') errors.push(`severity_levels[${i}].label string olmalıdır`);
      });
    }
  }

  return { valid: errors.length === 0, errors };
}
