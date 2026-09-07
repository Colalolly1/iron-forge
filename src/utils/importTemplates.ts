import { WorkoutTemplate, MuscleGroup, Exercise } from '../types';
import { EXERCISE_MAP } from '../data/exercises';
import { generateId } from './helpers';
import { saveTemplate, saveCustomExercise } from './storage';
import { fuzzyMatchExercise, createCustomExerciseFromName } from './importStrong';

/**
 * Import workout templates from a JSON file.
 *
 * Expected format:
 * {
 *   "ironforge": "templates",
 *   "templates": [
 *     {
 *       "name": "Day A — Push",
 *       "description": "optional",
 *       "icon": "🏋️",
 *       "exercises": [
 *         { "exercise": "Barbell Bench Press", "sets": 4, "notes": "optional" },
 *         { "exerciseId": "bb-bench-press", "sets": 4 }
 *       ]
 *     }
 *   ]
 * }
 *
 * Exercises are matched by exerciseId first, then by name (exact then fuzzy).
 * Unmatched names are created as custom exercises.
 */

interface TemplateFileExercise {
  exercise?: string;
  exerciseId?: string;
  sets?: number;
  targetReps?: number;
  targetWeight?: number;
  notes?: string;
  supersetGroup?: string | number;
}

interface TemplateFileEntry {
  name?: string;
  description?: string;
  icon?: string;
  exercises?: TemplateFileExercise[];
}

interface TemplateFile {
  ironforge?: string;
  templates?: TemplateFileEntry[];
}

export async function importTemplatesJSON(jsonContent: string): Promise<{
  imported: number;
  skippedExercises: string[];
  createdCustom: string[];
}> {
  let data: TemplateFile;
  try {
    data = JSON.parse(jsonContent);
  } catch {
    throw new Error('Not a valid JSON file.');
  }

  const entries = data.templates;
  if (!Array.isArray(entries) || entries.length === 0) {
    throw new Error('No templates found in file. Expected a "templates" list.');
  }

  const skippedExercises: string[] = [];
  const createdCustom: string[] = [];
  let imported = 0;

  for (const entry of entries) {
    if (!entry?.name || !Array.isArray(entry.exercises) || entry.exercises.length === 0) {
      continue;
    }

    const templateExercises: WorkoutTemplate['exercises'] = [];
    const muscleSet = new Set<MuscleGroup>();
    // Map file-level superset group labels to generated IDs
    const supersetIds = new Map<string, string>();
    let order = 0;

    for (const fe of entry.exercises) {
      let exercise: Exercise | null = null;

      if (fe.exerciseId && EXERCISE_MAP.has(fe.exerciseId)) {
        exercise = EXERCISE_MAP.get(fe.exerciseId)!;
      } else if (fe.exercise) {
        exercise = fuzzyMatchExercise(fe.exercise);
        if (!exercise) {
          exercise = createCustomExerciseFromName(fe.exercise);
          await saveCustomExercise(exercise);
          EXERCISE_MAP.set(exercise.id, exercise);
          createdCustom.push(fe.exercise);
        }
      }

      if (!exercise) {
        skippedExercises.push(fe.exerciseId || fe.exercise || 'unknown');
        continue;
      }

      let supersetGroupId: string | undefined;
      if (fe.supersetGroup !== undefined && fe.supersetGroup !== null) {
        const key = String(fe.supersetGroup);
        if (!supersetIds.has(key)) supersetIds.set(key, generateId());
        supersetGroupId = supersetIds.get(key);
      }

      templateExercises.push({
        exerciseId: exercise.id,
        sets: Math.max(1, Math.round(fe.sets ?? 3)),
        targetReps: fe.targetReps,
        targetWeight: fe.targetWeight,
        order: order++,
        supersetGroupId,
        notes: fe.notes,
      });
      muscleSet.add(exercise.primaryMuscle);
    }

    if (templateExercises.length === 0) continue;

    const template: WorkoutTemplate = {
      id: generateId(),
      name: entry.name,
      description: entry.description,
      exercises: templateExercises,
      muscleGroups: Array.from(muscleSet),
      icon: entry.icon || '📋',
      timesUsed: 0,
      createdAt: new Date().toISOString(),
      isCustom: true,
    };

    await saveTemplate(template);
    imported++;
  }

  if (imported === 0) {
    throw new Error('No valid templates could be imported from this file.');
  }

  return { imported, skippedExercises, createdCustom };
}
