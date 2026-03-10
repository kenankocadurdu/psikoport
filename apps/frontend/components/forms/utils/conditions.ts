export interface FieldCondition {
  field: string;
  operator: "equals" | "not_equals" | "contains" | "greater_than";
  value: string | number;
}

export function evaluateCondition(
  condition: FieldCondition,
  responses: Record<string, unknown>
): boolean {
  const depValue = responses[condition.field];
  const target = condition.value;

  switch (condition.operator) {
    case "equals":
      return String(depValue ?? "") === String(target);
    case "not_equals":
      return String(depValue ?? "") !== String(target);
    case "contains":
      if (Array.isArray(depValue)) {
        return depValue.includes(target);
      }
      return String(depValue ?? "").includes(String(target));
    case "greater_than":
      return Number(depValue ?? 0) > Number(target);
    default:
      return false;
  }
}
