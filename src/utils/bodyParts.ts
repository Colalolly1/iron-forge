import { BodyPart, BodyPartTarget, Exercise, MuscleGroup, Workout } from '../types';

export const BODY_PARTS: BodyPart[] = [
  'chest', 'back', 'shoulders', 'traps',
  'biceps', 'triceps', 'forearms',
  'quads', 'hamstrings', 'glutes', 'calves', 'core',
];

export const BODY_PART_LABELS: Record<BodyPart, string> = {
  chest: 'Chest',
  back: 'Back',
  traps: 'Traps',
  shoulders: 'Shoulders',
  biceps: 'Biceps',
  triceps: 'Triceps',
  forearms: 'Forearms',
  quads: 'Quads',
  hamstrings: 'Hamstrings',
  glutes: 'Glutes',
  calves: 'Calves',
  core: 'Core',
};

/** Which body part an exercise trains. */
export function bodyPartOf(e: Exercise): BodyPart | null {
  switch (e.primaryMuscle) {
    case 'lats':
    case 'back':
      return 'back';
    case 'full_body':
    case 'cardio':
      return null;
    default:
      return e.primaryMuscle as BodyPart;
  }
}

/** The broader muscle group a body part belongs to (for badges and stats). */
export function muscleOfPart(part: BodyPart): MuscleGroup {
  return part;
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
  const part = bodyPartOf(exercise);
  const matching = (workout.targets ?? []).filter(t => t.part === part);
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
    // Exercises with no target go to the first target for their body part.
    const takesLoose = targets.find(x => x.part === t.part)?.id === t.id;
    const mine = workout.exercises.filter(we =>
      bodyPartOf(we.exercise) === t.part && (we.targetId === t.id || (!we.targetId && takesLoose)));
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
