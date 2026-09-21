import { Workout, WorkoutTemplate } from '../types';

export const DAY_LETTERS = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];
export const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

/** The seven dates of the current week, starting on Sunday (0) or Monday (1). */
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

export function plannedOn(templates: WorkoutTemplate[], dayOfWeek: number): WorkoutTemplate[] {
  return templates.filter(t => (t.days ?? []).includes(dayOfWeek));
}

export function workoutsOn(workouts: Workout[], date: Date): Workout[] {
  return workouts.filter(w => sameDay(new Date(w.startTime), date));
}
