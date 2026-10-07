import { EXERCISE_MAP, MUSCLE_GROUP_LABELS } from '../data/exercises';
import { generateId } from './helpers';
import { BodyPartSlot, Workout, WorkoutExercise, WorkoutTemplate } from '../types';

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

/** The body parts a template leaves to be chosen on the day. */
export function toPickFromTemplate(template: WorkoutTemplate): NonNullable<Workout['toPick']> {
  return (template.bodyParts ?? [])
    .filter(b => b.count > 0)
    .map(b => ({ ...b, id: generateId() }));
}

/** "Chest ×3 · Back ×2" */
export function bodyPartsLine(parts: BodyPartSlot[] | undefined): string {
  return (parts ?? []).map(b => `${MUSCLE_GROUP_LABELS[b.muscle]} ×${b.count}`).join(' · ');
}

/** What a template holds, as one line: fixed exercises, then body parts. */
export function templateLine(template: WorkoutTemplate): string {
  const names = template.exercises.map(te => EXERCISE_MAP.get(te.exerciseId)?.name ?? '?');
  const parts = bodyPartsLine(template.bodyParts);
  return [...names, ...(parts ? [parts] : [])].join(' · ');
}
