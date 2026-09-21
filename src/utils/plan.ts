import { Workout, WorkoutTemplate } from '../types';

export const DAY_LETTERS = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];
export const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
export const REST = 'rest';

export type PlanOverrides = Record<string, string>;

export function dateKey(d: Date): string {
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${d.getFullYear()}-${m}-${day}`;
}

/** The seven dates of the week containing [now], starting Sunday (0) or Monday (1). */
export function weekDates(startOfWeek: 0 | 1, now = new Date()): Date[] {
  const start = new Date(now);
  start.setHours(0, 0, 0, 0);
  const offset = (start.getDay() - startOfWeek + 7) % 7;
  start.setDate(start.getDate() - offset);
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(start);
    d.setDate(start.getDate() + i);
    return d;
  });
}

export function sameDay(a: Date, b: Date): boolean {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}

/** Templates whose weekly pattern includes this weekday. */
export function plannedOn(templates: WorkoutTemplate[], dayOfWeek: number): WorkoutTemplate[] {
  return templates.filter(t => (t.days ?? []).includes(dayOfWeek));
}

/**
 * What is planned for one date: a one-off choice for that date wins, then
 * the weekly pattern. Null means a rest day.
 */
export function planFor(date: Date, templates: WorkoutTemplate[], overrides: PlanOverrides): WorkoutTemplate | null {
  const o = overrides[dateKey(date)];
  if (o === REST) return null;
  if (o) return templates.find(t => t.id === o) ?? null;
  return plannedOn(templates, date.getDay())[0] ?? null;
}

export function workoutsOn(workouts: Workout[], date: Date): Workout[] {
  return workouts.filter(w => sameDay(new Date(w.startTime), date));
}

/** All dates shown on a month grid: leading days from the previous month so the first row is full. */
export function monthGrid(year: number, month: number, startOfWeek: 0 | 1): Date[] {
  const first = new Date(year, month, 1);
  const lead = (first.getDay() - startOfWeek + 7) % 7;
  const start = new Date(year, month, 1 - lead);
  const cells: Date[] = [];
  for (let i = 0; i < 42; i++) {
    const d = new Date(start);
    d.setDate(start.getDate() + i);
    cells.push(d);
  }
  // Trim trailing weeks that are entirely next month.
  while (cells.length > 7 && cells[cells.length - 7].getMonth() !== month) cells.splice(-7);
  return cells;
}
