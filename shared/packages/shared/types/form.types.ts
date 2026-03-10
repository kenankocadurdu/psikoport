/**
 * Form & Test Motoru types — MASTER_README Section 7
 */

export type FormFieldType =
  | 'text_short'
  | 'text_long'
  | 'single_select'
  | 'multi_select'
  | 'likert'
  | 'number'
  | 'date'
  | 'time'
  | 'phone'
  | 'email'
  | 'rating'
  | 'yes_no'
  | 'scale';

export interface FormFieldOption {
  value: string;
  label: string;
}

export interface FormFieldValidation {
  minLength?: number;
  maxLength?: number;
  min?: number;
  max?: number;
}

export interface FormFieldCondition {
  field: string;
  operator: 'equals' | 'not_equals' | 'contains' | 'greater_than';
  value: string | number;
}

export interface FormFieldCrisisTrigger {
  values: string[];
  action: 'crisis_protocol';
}

export interface FormField {
  id: string;
  type: FormFieldType;
  label: string;
  placeholder?: string;
  required?: boolean;
  options?: FormFieldOption[];
  validation?: FormFieldValidation;
  condition?: FormFieldCondition;
  crisisTrigger?: FormFieldCrisisTrigger;
  triggersAddonForms?: boolean;
}

export interface FormSection {
  id: string;
  title: string;
  icon?: string;
  fields: FormField[];
}

export interface FormDefinitionSchema {
  version: number;
  sections: FormSection[];
}

export interface FormSubmissionPayload {
  formId: string;
  clientId?: string;
  responses: Record<string, string | number | string[]>;
}

export interface SeverityLevel {
  range: [number, number];
  level: string;
  label: string;
}

export interface ScoringResult {
  totalScore: number;
  severityLevel?: string;
  severityLabel?: string;
  riskFlags?: string[];
}
