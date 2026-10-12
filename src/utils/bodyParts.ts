import { BodyPart, BodyPartTarget, Exercise, MuscleGroup, Workout } from '../types';

export const BODY_PARTS: BodyPart[] = [
  'chest', 'back', 'shoulders', 'traps',
  'biceps', 'triceps', 'forearms',
  'legs', 'quads', 'hamstrings', 'glutes', 'adductors', 'abductors', 'calves', 'core',
];

/** The leg muscles: shown as subcategories of Legs wherever muscles are listed. */
export const LEG_MUSCLES: MuscleGroup[] = ['quads', 'hamstrings', 'glutes', 'adductors', 'abductors', 'calves'];

/** What a Legs target takes: any of these. */
export const LEG_PARTS: BodyPart[] = LEG_MUSCLES as BodyPart[];

/** A muscle filter: one muscle group, or Legs for every leg muscle at once. */
export type MuscleChip = MuscleGroup | 'legs';

/** Legs, or one of its subcategories, is selected. */
export function isLegChip(c: MuscleChip | null): boolean {
  return c === 'legs' || (!!c && LEG_MUSCLES.includes(c));
}

/** Is an exercise in this muscle group? Full-body ones count where their name places them. */
export function exerciseInMuscle(m: MuscleGroup, e: Exercise): boolean {
  return e.primaryMuscle === m || (e.primaryMuscle === 'full_body' && bodyPartOf(e) === m);
}

export const BODY_PART_LABELS: Record<BodyPart, string> = {
  chest: 'Chest',
  back: 'Back',
  traps: 'Traps',
  shoulders: 'Shoulders',
  biceps: 'Biceps',
  triceps: 'Triceps',
  forearms: 'Forearms',
  legs: 'Legs',
  quads: 'Quads',
  hamstrings: 'Hamstrings',
  glutes: 'Glutes',
  adductors: 'Adductors',
  abductors: 'Abductors',
  calves: 'Calves',
  core: 'Core',
};

// Exercises filed as full body (mostly ones imported from Strong under names
// the app didn't know, like "Squat (Barbell)") are placed by their name.
const NAME_HINTS: [RegExp, BodyPart][] = [
  [/\bcalf|calves/i, 'calves'],
  [/leg curl|hamstring|romanian|\brdl\b|stiff[- ]?leg|good ?morning|nordic/i, 'hamstrings'],
  [/adduct|copenhagen/i, 'adductors'],
  [/abduct|clamshell|fire hydrant/i, 'abductors'],
  [/hip thrust|glute|kick ?back|bridge/i, 'glutes'],
  [/squat|lunge|leg press|leg extension|step[- ]?up|sissy|pistol/i, 'quads'],
];

/** Which body part an exercise trains. */
export function bodyPartOf(e: Exercise): BodyPart | null {
  switch (e.primaryMuscle) {
    case 'lats':
    case 'back':
      return 'back';
    case 'cardio':
      return null;
    case 'full_body':
      return NAME_HINTS.find(([re]) => re.test(e.name))?.[1] ?? null;
    default:
      return e.primaryMuscle as BodyPart;
  }
}

/** Does an exercise count for a target on this body part? Legs takes any leg part. */
export function partMatches(part: BodyPart, e: Exercise): boolean {
  const p = bodyPartOf(e);
  if (!p) return false;
  return part === 'legs' ? LEG_PARTS.includes(p) : p === part;
}

/** The muscle groups a body part covers (for badges and stats). */
export function musclesOfPart(part: BodyPart): MuscleGroup[] {
  return part === 'legs' ? LEG_MUSCLES : [part as MuscleGroup];
}

/** Targets an exercise could count for: an exact body part before Legs. */
function matchingTargets<T extends BodyPartTarget>(targets: T[], e: Exercise): T[] {
  const fits = targets.filter(t => partMatches(t.part, e));
  return [...fits.filter(t => t.part !== 'legs'), ...fits.filter(t => t.part === 'legs')];
}

/** Sets for each of a target's exercises, e.g. [4, 3]. */
export function slotSets(t: BodyPartTarget): number[] {
  return Array.from({ length: t.exercises }, (_, k) => t.setsPer?.[k] ?? t.sets);
}

/** Sets for the target's k-th chosen exercise; extras get the last one's. */
export function setsForSlot(t: BodyPartTarget, k: number): number {
  const per = slotSets(t);
  return per[Math.min(k, per.length - 1)] ?? t.sets;
}

/** "2×3" when every exercise has the same sets, else "4+3". */
export function setsText(t: BodyPartTarget): string {
  const per = slotSets(t);
  return per.every(s => s === per[0]) ? `${t.exercises}×${per[0] ?? t.sets}` : per.join('+');
}

/** "Chest 2×3 · Back 4+3" (exercises × sets, or each exercise's sets) */
export function targetsLine(targets: BodyPartTarget[] | undefined): string {
  return (targets ?? []).map(t => `${BODY_PART_LABELS[t.part]} ${setsText(t)}`).join(' · ');
}

export interface TargetProgress {
  id: string;
  part: BodyPart;
  exercisesNeeded: number;
  reps?: string;
  chosen: number;
  exercisesDone: number;
  setsDone: number;
  setsNeeded: number;
  done: boolean;
}

/**
 * The target an exercise added with Add Exercise counts toward: the first one
 * for its body part that still needs exercises, else the first for that part.
 */
export function targetForExercise(workout: Workout, exercise: Exercise): (BodyPartTarget & { id: string }) | undefined {
  const matching = matchingTargets(workout.targets ?? [], exercise);
  return matching.find(t => workout.exercises.filter(we => we.targetId === t.id).length < t.exercises) ?? matching[0];
}

/**
 * How far each target has got. An exercise counts for a target when it was
 * chosen for it (or has no target and trains that body part) and still trains
 * that body part. The exercise with the most ticked working sets is measured
 * against the biggest set count, the next against the next, and so on.
 */
export function targetProgress(workout: Workout): TargetProgress[] {
  const targets = workout.targets ?? [];
  return targets.map(t => {
    // Exercises with no target go to the first target they fit.
    const mine = workout.exercises.filter(we =>
      partMatches(t.part, we.exercise) &&
      (we.targetId === t.id || (!we.targetId && matchingTargets(targets, we.exercise)[0]?.id === t.id)));
    const counts = mine
      // Only ticked working sets with reps in them count; an empty tick isn't a set.
      .map(we => we.sets.filter(s => s.completed && !s.isWarmup && s.reps > 0).length)
      .sort((a, b) => b - a)
      .slice(0, t.exercises);
    const needed = slotSets(t).sort((a, b) => b - a);
    const exercisesDone = needed.filter((s, i) => (counts[i] ?? 0) >= s).length;
    const setsDone = needed.reduce((n, s, i) => n + Math.min(counts[i] ?? 0, s), 0);
    return {
      id: t.id,
      part: t.part,
      exercisesNeeded: t.exercises,
      reps: t.reps,
      chosen: mine.length,
      exercisesDone,
      setsDone,
      setsNeeded: needed.reduce((n, s) => n + s, 0),
      done: exercisesDone >= t.exercises,
    };
  });
}

/** What's still missing, one line per unfinished target, for the Finish check. */
export function whatsLeft(workout: Workout): string[] {
  return targetProgress(workout)
    .filter(p => !p.done)
    .map(p => `${BODY_PART_LABELS[p.part]}: ${p.setsNeeded - p.setsDone} more set${p.setsNeeded - p.setsDone === 1 ? '' : 's'}`
      + (p.chosen < p.exercisesNeeded ? `, ${p.exercisesNeeded - p.chosen} exercise${p.exercisesNeeded - p.chosen === 1 ? '' : 's'} still to choose` : ''));
}
