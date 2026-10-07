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

/** "Chest 2×3 · Back 2×3" (exercises × sets) */
export function targetsLine(targets: BodyPartTarget[] | undefined): string {
  return (targets ?? []).map(t => `${BODY_PART_LABELS[t.part]} ${t.exercises}×${t.sets}`).join(' · ');
}

export interface TargetProgress {
  id: string;
  part: BodyPart;
  exercisesNeeded: number;
  setsEach: number;
  reps?: string;
  chosen: number;
  exercisesDone: number;
  setsDone: number;
  setsNeeded: number;
  done: boolean;
}

/**
 * How far each target has got. An exercise counts for a target when it was
 * chosen for it and still trains that body part; it's done when it has the
 * required number of ticked working sets.
 */
export function targetProgress(workout: Workout): TargetProgress[] {
  return (workout.targets ?? []).map(t => {
    const mine = workout.exercises.filter(we => we.targetId === t.id && bodyPartOf(we.exercise) === t.part);
    const counts = mine
      // Only ticked working sets with reps in them count; an empty tick isn't a set.
      .map(we => we.sets.filter(s => s.completed && !s.isWarmup && s.reps > 0).length)
      .sort((a, b) => b - a)
      .slice(0, t.exercises);
    const exercisesDone = counts.filter(c => c >= t.sets).length;
    const setsDone = counts.reduce((n, c) => n + Math.min(c, t.sets), 0);
    return {
      id: t.id,
      part: t.part,
      exercisesNeeded: t.exercises,
      setsEach: t.sets,
      reps: t.reps,
      chosen: mine.length,
      exercisesDone,
      setsDone,
      setsNeeded: t.exercises * t.sets,
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
