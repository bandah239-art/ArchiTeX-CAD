export interface ScheduleActivityRow {
  id: string;
  name: string;
  start_week: number;
  duration_weeks: number;
  cost_usd: number;
}

export interface ScheduleResult {
  duration_weeks: number;
  total_cost_usd: number;
  activities: ScheduleActivityRow[];
}
