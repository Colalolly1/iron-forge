import { EXERCISE_MAP } from '../data/exercises';
import { generateId } from './helpers';
import { targetsLine } from './bodyParts';
import { Workout, WorkoutExercise, WorkoutTemplate } from '../types';

/** A template turned into the empty sets of a workout about to start. */
export function exercisesFromTemplate(template: WorkoutTemplate): WorkoutExercise[] {
  return template.exercises
    .map(te => {
      const exercise = EXERCISE_MAP.get(te.exerciseId);
      if (!exercise) return null;
      return {
        id: generateId(),
        exerciseId: te.exerciseId,
        exercise,
        sets: Array.from({ length: te.sets }, (_, i) => ({
          id: generateId(),
          setNumber: i + 1,
          weight: 0,
          reps: 0,
          completed: false,
        })),
        notes: te.notes,
        supersetGroupId: te.supersetGroupId,
        order: te.order,
      } as WorkoutExercise;
    })
    .filter(Boolean) as WorkoutExercise[];
}

/** A target template's targets, each with its own id for this workout. */
export function targetsFromTemplate(template: WorkoutTemplate): NonNullable<Workout['targets']> {
  if (template.kind !== 'targets') return [];
  return (template.targets ?? [])
    .filter(t => t.exercises > 0 && t.sets > 0)
    .map(t => ({ ...t, id: generateId() }));
}

/** What a template holds, as one line. */
export function templateLine(template: WorkoutTemplate): string {
  if (template.kind === 'targets') return targetsLine(template.targets);
  return template.exercises.map(te => EXERCISE_MAP.get(te.exerciseId)?.name ?? '?').join(' · ');
}
