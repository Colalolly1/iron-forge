import { WorkoutTemplate } from '../types';
import { saveTemplate, setPlanOverride } from './storage';
import { REST, dateKey } from './plan';

/**
 * Plan one day. template null = nothing planned (a rest day).
 * everyWeek: change the weekly pattern for that weekday (one template per
 * weekday); otherwise change only this date.
 */
export async function planDay(
  date: Date,
  template: WorkoutTemplate | null,
  everyWeek: boolean,
  templates: WorkoutTemplate[],
): Promise<void> {
  if (!everyWeek) {
    await setPlanOverride(dateKey(date), template ? template.id : REST);
    return;
  }
  const dow = date.getDay();
  for (const t of templates) {
    const has = (t.days ?? []).includes(dow);
    const wants = template?.id === t.id;
    if (wants && !has) await saveTemplate({ ...t, days: [...(t.days ?? []), dow] });
    if (!wants && has) await saveTemplate({ ...t, days: (t.days ?? []).filter(d => d !== dow) });
  }
  // The weekly change should show on this date too, so drop any one-off here.
  await setPlanOverride(dateKey(date), null);
}

/** Undo a one-off change on this date: it goes back to the weekly plan. */
export async function backToWeekly(date: Date): Promise<void> {
  await setPlanOverride(dateKey(date), null);
}
