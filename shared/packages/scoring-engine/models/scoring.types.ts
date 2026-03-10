/**
 * Scoring types — MASTER_README Bölüm 7.3
 */

export type ScoringType = 'sum' | 'weighted' | 'subscale' | 'custom';

export type ResponseScale = Record<string, string>;

export interface TotalScoreConfig {
  min: number;
  max: number;
  calculation?: string;
}

export interface SeverityLevel {
  range: [number, number];
  level: string;
  label: string;
}

export interface RiskItem {
  item_id: string;
  threshold: number;
  flag: string;
  action?: string;
}

export interface ScoringConfig {
  type: ScoringType;
  response_scale?: ResponseScale;
  total_score?: TotalScoreConfig;
  severity_levels?: SeverityLevel[];
  risk_items?: RiskItem[];
  clinical_cutoff?: number;
  subscales?: Record<string, { item_ids: string[]; multiplier?: number }>;
  weights?: Record<string, number>;
}

export interface SubscaleScore {
  id: string;
  score: number;
  maxScore?: number;
}

export interface ScoringResult {
  totalScore: number;
  subscales?: SubscaleScore[];
  severityLevel?: string;
  severityLabel?: string;
  riskFlags: string[];
  rawItemScores: Record<string, number>;
}
