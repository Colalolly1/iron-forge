import { WorkoutTemplate, MuscleGroup, Exercise, BodyPart, BodyPartTarget } from '../types';
import { EXERCISE_MAP } from '../data/exercises';
import { BODY_PART_LABELS, muscleOfPart } from './bodyParts';
import { generateId } from './helpers';
import {
  getTemplates,
  saveTemplate,
  saveCustomExercise,
  getCustomExercises,
  getExerciseNotes,
  getExerciseRestTimers,
  mergeExerciseNotes,
  mergeExerciseRestTimers,
} from './storage';
import { fuzzyMatchExercise, createCustomExerciseFromName } from './importStrong';

/**
 * Template transfer file format (import + export).
 *
 * {
 *   "ironforge": "templates",
 *   "version": 2,
 *   "customExercises": [ { "id", "name", "primaryMuscle", "secondaryMuscles", "category", "force" } ],
 *   "templates": [
 *     {
 *       "name": "Upper 1", "description": "optional", "icon": "🏋️",
 *       "exercises": [
 *         { "exercise": "Barbell Bench Press", "exerciseId": "bb-bench-press", "sets": 4,
 *           "supersetGroup": "A", "notes": "optional", "targetReps": 8, "targetWeight": 40 }
 *       ],
 *       "type": "targets", "targets": [ { "part": "chest", "exercises": 2, "sets": 3, "reps": "8-12" } ]
 *       (a targets template has no "exercises"; body parts are chosen on the day)
 *     }
 *   ],
 *   "exerciseNotes": [ { "exerciseId", "exercise", "note" } ],
 *   "restTimers":    [ { "exerciseId", "exercise", "seconds" } ]
 * }
 *
 * Only "templates" is required. Exercises are matched by exerciseId, then exact
 * name, then fuzzy name; unmatched names become custom exercises. A template
 * whose name already exists is updated in place rather than duplicated.
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
  /** Body parts chosen on the day, e.g. { "muscle": "chest", "exercises": 3, "sets": 3 } */
  type?: string;
  targets?: { part?: string; exercises?: number; sets?: number; reps?: string }[];
}

interface TemplateFileCustomExercise {
  id?: string;
  name?: string;
  primaryMuscle?: string;
  secondaryMuscles?: string[];
  category?: string;
  force?: string;
}

interface NoteEntry { exerciseId?: string; exercise?: string; note?: string }
interface TimerEntry { exerciseId?: string; exercise?: string; seconds?: number }

interface TemplateFile {
  ironforge?: string;
  version?: number;
  customExercises?: TemplateFileCustomExercise[];
  templates?: TemplateFileEntry[];
  exerciseNotes?: NoteEntry[] | Record<string, string>;
  restTimers?: TimerEntry[] | Record<string, number>;
}

export interface TemplateImportResult {
  imported: number;
  updated: number;
  customExercisesAdded: number;
  notesRestored: number;
  timersRestored: number;
  createdCustom: string[];
  skippedExercises: string[];
}

function resolveExercise(fe: { exerciseId?: string; exercise?: string }): Exercise | null {
  if (fe.exerciseId && EXERCISE_MAP.has(fe.exerciseId)) return EXERCISE_MAP.get(fe.exerciseId)!;
  if (fe.exercise) return fuzzyMatchExercise(fe.exercise);
  return null;
}

export async function importTemplatesJSON(jsonContent: string): Promise<TemplateImportResult> {
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

  const result: TemplateImportResult = {
    imported: 0,
    updated: 0,
    customExercisesAdded: 0,
    notesRestored: 0,
    timersRestored: 0,
    createdCustom: [],
    skippedExercises: [],
  };

  // 1. Custom exercise definitions first, so templates can reference them by id
  if (Array.isArray(data.customExercises)) {
    for (const ce of data.customExercises) {
      if (!ce?.name) continue;
      const id = ce.id || `import-${ce.name.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`;
      const exercise: Exercise = {
        ...(EXERCISE_MAP.get(id) ?? {}),
        id,
        name: ce.name,
        primaryMuscle: (ce.primaryMuscle as MuscleGroup) || 'full_body',
        secondaryMuscles: (ce.secondaryMuscles as MuscleGroup[]) || [],
        category: (ce.category as Exercise['category']) || 'other',
        force: (ce.force as Exercise['force']) || 'compound',
        isCustom: true,
      };
      await saveCustomExercise(exercise);
      EXERCISE_MAP.set(id, exercise);
      result.customExercisesAdded++;
    }
  }

  // 2. Templates — update in place when a template with the same name exists
  const existingTemplates = await getTemplates();

  for (const entry of entries) {
    const fileTargets = Array.isArray(entry?.targets) ? entry.targets : [];
    const fileExercises: TemplateFileExercise[] = Array.isArray(entry?.exercises) ? entry.exercises : [];
    if (!entry?.name || (fileExercises.length === 0 && fileTargets.length === 0)) {
      continue;
    }
    const targets: BodyPartTarget[] = fileTargets
      .filter(t => t && typeof t.part === 'string' && t.part in BODY_PART_LABELS)
      .map(t => ({
        part: t.part as BodyPart,
        exercises: Math.max(1, Math.round(Number(t.exercises) || 1)),
        sets: Math.max(1, Math.round(Number(t.sets) || 3)),
        ...(t.reps ? { reps: String(t.reps) } : {}),
      }));
    const isTargets = entry.type === 'targets' || (fileExercises.length === 0 && targets.length > 0);

    const templateExercises: WorkoutTemplate['exercises'] = [];
    const muscleSet = new Set<MuscleGroup>();
    const supersetIds = new Map<string, string>();
    let order = 0;

    for (const fe of fileExercises) {
      let exercise = resolveExercise(fe);
      if (!exercise && fe.exercise) {
        exercise = createCustomExerciseFromName(fe.exercise);
        await saveCustomExercise(exercise);
        EXERCISE_MAP.set(exercise.id, exercise);
        result.createdCustom.push(fe.exercise);
      }
      if (!exercise) {
        result.skippedExercises.push(fe.exerciseId || fe.exercise || 'unknown');
        continue;
      }

      let supersetGroupId: string | undefined;
      if (fe.supersetGroup !== undefined && fe.supersetGroup !== null && fe.supersetGroup !== '') {
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

    if (isTargets ? targets.length === 0 : templateExercises.length === 0) continue;
    if (isTargets) targets.forEach(t => muscleSet.add(muscleOfPart(t.part)));

    const existing = existingTemplates.find(
      t => t.name.trim().toLowerCase() === entry.name!.trim().toLowerCase()
    );

    const template: WorkoutTemplate = {
      id: existing?.id ?? generateId(),
      name: entry.name,
      description: entry.description,
      exercises: isTargets ? [] : templateExercises,
      muscleGroups: Array.from(muscleSet),
      ...(isTargets ? { kind: 'targets' as const, targets } : {}),
      icon: entry.icon || existing?.icon || '📋',
      color: existing?.color,
      timesUsed: existing?.timesUsed ?? 0,
      lastUsed: existing?.lastUsed,
      createdAt: existing?.createdAt ?? new Date().toISOString(),
      isCustom: true,
    };

    await saveTemplate(template);
    if (existing) result.updated++;
    else result.imported++;
  }

  if (result.imported + result.updated === 0) {
    throw new Error('No valid templates could be imported from this file.');
  }

  // 3. Exercise notes and rest timers (optional)
  const notes: Record<string, string> = {};
  if (Array.isArray(data.exerciseNotes)) {
    for (const n of data.exerciseNotes) {
      const ex = resolveExercise(n);
      if (ex && n.note) notes[ex.id] = n.note;
    }
  } else if (data.exerciseNotes && typeof data.exerciseNotes === 'object') {
    for (const [id, note] of Object.entries(data.exerciseNotes)) {
      if (EXERCISE_MAP.has(id) && note) notes[id] = note;
    }
  }
  if (Object.keys(notes).length > 0) {
    await mergeExerciseNotes(notes);
    result.notesRestored = Object.keys(notes).length;
  }

  const timers: Record<string, number> = {};
  if (Array.isArray(data.restTimers)) {
    for (const t of data.restTimers) {
      const ex = resolveExercise(t);
      if (ex && typeof t.seconds === 'number') timers[ex.id] = t.seconds;
    }
  } else if (data.restTimers && typeof data.restTimers === 'object') {
    for (const [id, secs] of Object.entries(data.restTimers)) {
      if (EXERCISE_MAP.has(id) && typeof secs === 'number') timers[id] = secs;
    }
  }
  if (Object.keys(timers).length > 0) {
    await mergeExerciseRestTimers(timers);
    result.timersRestored = Object.keys(timers).length;
  }

  return result;
}

/**
 * Build a transfer file containing every template, every custom exercise
 * (including renamed built-ins), and all exercise notes / rest timers.
 * Output re-imports cleanly via importTemplatesJSON and is readable as-is.
 */
export async function exportTemplatesJSON(): Promise<string> {
  const [templates, customExercises, notes, timers] = await Promise.all([
    getTemplates(),
    getCustomExercises(),
    getExerciseNotes(),
    getExerciseRestTimers(),
  ]);

  const nameOf = (id: string) => EXERCISE_MAP.get(id)?.name ?? id;

  const file = {
    ironforge: 'templates',
    version: 2,
    exportedAt: new Date().toISOString(),
    customExercises: customExercises.map(e => ({
      id: e.id,
      name: e.name,
      primaryMuscle: e.primaryMuscle,
      secondaryMuscles: e.secondaryMuscles,
      category: e.category,
      force: e.force,
    })),
    templates: templates.map(t => {
      // Turn internal superset ids into readable letters (A, B, C…) per template
      const groupLabels = new Map<string, string>();
      const sorted = [...t.exercises].sort((a, b) => a.order - b.order);
      return {
        name: t.name,
        description: t.description,
        icon: t.icon,
        exercises: sorted.map(te => {
          let supersetGroup: string | undefined;
          if (te.supersetGroupId) {
            if (!groupLabels.has(te.supersetGroupId)) {
              groupLabels.set(te.supersetGroupId, String.fromCharCode(65 + groupLabels.size));
            }
            supersetGroup = groupLabels.get(te.supersetGroupId);
          }
          return {
            exerciseId: te.exerciseId,
            exercise: nameOf(te.exerciseId),
            sets: te.sets,
            ...(te.targetReps ? { targetReps: te.targetReps } : {}),
            ...(te.targetWeight ? { targetWeight: te.targetWeight } : {}),
            ...(supersetGroup ? { supersetGroup } : {}),
            ...(te.notes ? { notes: te.notes } : {}),
          };
        }),
        ...(t.kind === 'targets'
          ? { type: 'targets', targets: (t.targets ?? []).map(x => ({ part: x.part, exercises: x.exercises, sets: x.sets, ...(x.reps ? { reps: x.reps } : {}) })) }
          : {}),
      };
    }),
    exerciseNotes: Object.entries(notes).map(([exerciseId, note]) => ({
      exerciseId,
      exercise: nameOf(exerciseId),
      note,
    })),
    restTimers: Object.entries(timers).map(([exerciseId, seconds]) => ({
      exerciseId,
      exercise: nameOf(exerciseId),
      seconds,
    })),
  };

  return JSON.stringify(file, null, 2);
}
