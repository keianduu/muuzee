export const CORE_PRIORITY_TIERS = ["A", "B", "C"] as const;
export type CorePriorityTier = (typeof CORE_PRIORITY_TIERS)[number];

export function tiersForCoreFilter(value?: string): CorePriorityTier[] | null {
  if (value === "A-B") return ["A", "B"];
  return (CORE_PRIORITY_TIERS as readonly string[]).includes(value || "") ? [value as CorePriorityTier] : null;
}

export function effectivePriorityTier(row: Record<string, unknown>): CorePriorityTier | null {
  const value = row.manual_priority_tier || row.effective_priority_tier || row.auto_priority_tier;
  return (CORE_PRIORITY_TIERS as readonly unknown[]).includes(value) ? value as CorePriorityTier : null;
}

export function priorityTierRank(row: Record<string, unknown>) {
  const tier = effectivePriorityTier(row);
  return tier ? CORE_PRIORITY_TIERS.indexOf(tier) : CORE_PRIORITY_TIERS.length;
}
