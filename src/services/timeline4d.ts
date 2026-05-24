/** 4D construction timeline — visibility + cost phasing for xeokit viewer. */

export interface TimelineActivity {
  id: string;
  ifc_type?: string;
  start_week: number;
  duration_weeks: number;
  cost_usd?: number;
  element_ids?: string[];
}

export function getActivityEndWeek(a: TimelineActivity): number {
  return a.start_week + a.duration_weeks;
}

/** IFC types visible at a given week (started or complete). */
export function getVisibleTypesAtWeek(activities: TimelineActivity[], week: number): Set<string> {
  const visible = new Set<string>();
  for (const a of activities) {
    const type = a.ifc_type ?? a.id;
    if (a.start_week <= week) visible.add(type);
  }
  return visible;
}

/** Types currently under construction (in progress highlight). */
export function getInProgressTypesAtWeek(activities: TimelineActivity[], week: number): Set<string> {
  const active = new Set<string>();
  for (const a of activities) {
    const type = a.ifc_type ?? a.id;
    if (a.start_week <= week && week <= getActivityEndWeek(a)) active.add(type);
  }
  return active;
}

export function getHiddenTypesAtWeek(
  activities: TimelineActivity[],
  week: number,
  allTypes: string[]
): string[] {
  const visible = getVisibleTypesAtWeek(activities, week);
  return allTypes.filter((t) => !visible.has(t));
}

export function getCumulativeCostAtWeek(activities: TimelineActivity[], week: number): number {
  return activities.reduce((total, a) => {
    const end = getActivityEndWeek(a);
    if (week < a.start_week) return total;
    const progress =
      week >= end ? 1 : (week - a.start_week) / Math.max(a.duration_weeks, 1);
    return total + (a.cost_usd ?? 0) * Math.min(1, Math.max(0, progress));
  }, 0);
}

export function buildWeekRange(durationWeeks: number): number[] {
  return Array.from({ length: durationWeeks + 1 }, (_, i) => i);
}
