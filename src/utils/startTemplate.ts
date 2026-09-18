import { EXERCISE_MAP } from '../data/exercises';
import { generateId } from './helpers';
import { WorkoutExercise, WorkoutTemplate } from '../types';

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
