import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  Workout,
  WorkoutTemplate,
  PersonalRecord,
  BodyMeasurement,
  UserProfile,
  Exercise,
} from '../types';

const KEYS = {
  WORKOUTS: '@ironforge/workouts',
  TEMPLATES: '@ironforge/templates',
  PLAN: '@ironforge/plan',
  PRS: '@ironforge/prs',
  MEASUREMENTS: '@ironforge/measurements',
  PROFILE: '@ironforge/profile',
  ACTIVE_WORKOUT: '@ironforge/active_workout',
  CUSTOM_EXERCISES: '@ironforge/custom_exercises',
  EXERCISE_NOTES: '@ironforge/exercise_notes',
  EXERCISE_REST_TIMERS: '@ironforge/exercise_rest_timers',
} as const;

// ─── Generic helpers ────────────────────────────────────────

async function getJSON<T>(key: string): Promise<T | null> {
  try {
    const raw = await AsyncStorage.getItem(key);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

async function setJSON(key: string, data: unknown): Promise<void> {
  await AsyncStorage.setItem(key, JSON.stringify(data));
}

// ─── Workouts ────────────────────────────────────────────────

// ─── Weekly plan overrides ───────────────────────────────────
// Keyed by local date "YYYY-MM-DD". Value is a template id, or "rest" to
// clear a day that the weekly pattern would otherwise fill.
export async function getPlanOverrides(): Promise<Record<string, string>> {
  return (await getJSON<Record<string, string>>(KEYS.PLAN)) ?? {};
}

export async function setPlanOverride(dateKey: string, value: string | null): Promise<void> {
  const all = await getPlanOverrides();
  if (value === null) delete all[dateKey];
  else all[dateKey] = value;
  await setJSON(KEYS.PLAN, all);
}

export async function getWorkouts(): Promise<Workout[]> {
  return (await getJSON<Workout[]>(KEYS.WORKOUTS)) ?? [];
}

export async function saveWorkout(workout: Workout): Promise<void> {
  const workouts = await getWorkouts();
  const idx = workouts.findIndex(w => w.id === workout.id);
  if (idx >= 0) {
    workouts[idx] = workout;
  } else {
    workouts.unshift(workout);
  }
  await setJSON(KEYS.WORKOUTS, workouts);
}

export async function deleteWorkout(id: string): Promise<void> {
  const workouts = await getWorkouts();
  await setJSON(KEYS.WORKOUTS, workouts.filter(w => w.id !== id));
  // Rebuild PRs so deleted workout's records don't linger
  await rebuildAllPRs();
}

// ─── Active Workout ──────────────────────────────────────────

export async function getActiveWorkout(): Promise<Workout | null> {
  return getJSON<Workout>(KEYS.ACTIVE_WORKOUT);
}

export async function saveActiveWorkout(workout: Workout | null): Promise<void> {
  if (workout) {
    await setJSON(KEYS.ACTIVE_WORKOUT, workout);
  } else {
    await AsyncStorage.removeItem(KEYS.ACTIVE_WORKOUT);
  }
}

// ─── Templates ───────────────────────────────────────────────

export async function getTemplates(): Promise<WorkoutTemplate[]> {
  return (await getJSON<WorkoutTemplate[]>(KEYS.TEMPLATES)) ?? [];
}

export async function saveTemplate(template: WorkoutTemplate): Promise<void> {
  const templates = await getTemplates();
  const idx = templates.findIndex(t => t.id === template.id);
  if (idx >= 0) {
    templates[idx] = template;
  } else {
    templates.unshift(template);
  }
  await setJSON(KEYS.TEMPLATES, templates);
}

export async function deleteTemplate(id: string): Promise<void> {
  const templates = await getTemplates();
  await setJSON(KEYS.TEMPLATES, templates.filter(t => t.id !== id));
}

// ─── Personal Records ────────────────────────────────────────

export async function getPRs(): Promise<PersonalRecord[]> {
  const all = (await getJSON<PersonalRecord[]>(KEYS.PRS)) ?? [];
  // Migrate: only keep E1RM PRs (legacy weight/volume PRs from old system are dropped)
  const filtered = all.filter(p => p.type === 'one_rep_max');
  if (filtered.length !== all.length) {
    await setJSON(KEYS.PRS, filtered);
  }
  return filtered;
}

export async function savePR(pr: PersonalRecord): Promise<void> {
  const prs = await getPRs();
  prs.unshift(pr);
  await setJSON(KEYS.PRS, prs);
}

export async function checkAndSavePRs(workout: Workout): Promise<PersonalRecord[]> {
  const existingPRs = await getPRs();
  const newPRs: PersonalRecord[] = [];

  for (const we of workout.exercises) {
    // Find the best estimated 1RM across ALL completed sets for this exercise in this workout
    let bestE1RMThisWorkout = 0;
    let bestSetWeight = 0;
    let bestSetReps = 0;

    let hasAnyCompletedSet = false;
    for (const set of we.sets) {
      if (!set.completed || set.isWarmup || set.weight === 0 || set.reps <= 0) continue;
      hasAnyCompletedSet = true;

      // Epley formula. Works for negative weights too (assisted exercises):
      // less assistance is a higher (less negative) value = better PR.
      const repsForCalc = Math.min(set.reps, 12);
      const e1rm = set.weight * (1 + repsForCalc / 30);

      // For first set or if this is a new best (more positive / less negative)
      if (!bestSetWeight && bestSetReps === 0) {
        bestE1RMThisWorkout = e1rm;
        bestSetWeight = set.weight;
        bestSetReps = set.reps;
      } else if (e1rm > bestE1RMThisWorkout) {
        bestE1RMThisWorkout = e1rm;
        bestSetWeight = set.weight;
        bestSetReps = set.reps;
      }
    }

    if (!hasAnyCompletedSet) continue;

    // Compare against existing best E1RM for this exercise
    const bestExisting = existingPRs
      .filter(p => p.exerciseId === we.exerciseId && p.type === 'one_rep_max')
      .sort((a, b) => b.value - a.value)[0];

    if (!bestExisting || bestE1RMThisWorkout > bestExisting.value) {
      const pr: PersonalRecord = {
        id: `${we.exerciseId}-e1rm-${Date.now()}`,
        exerciseId: we.exerciseId,
        exerciseName: we.exercise?.name,
        type: 'one_rep_max',
        value: Math.round(bestE1RMThisWorkout * 10) / 10,
        date: workout.startTime,
        workoutId: workout.id,
        previousValue: bestExisting?.value,
        setWeight: bestSetWeight,
        setReps: bestSetReps,
      };
      newPRs.push(pr);
    }
  }

  // Save all new PRs (replace old PRs for same exercise+type)
  if (newPRs.length > 0) {
    // Remove old E1RM PRs for exercises that just got new ones
    const newPRExerciseIds = new Set(newPRs.map(p => p.exerciseId));
    const filtered = existingPRs.filter(p =>
      !(p.type === 'one_rep_max' && newPRExerciseIds.has(p.exerciseId))
    );
    await setJSON(KEYS.PRS, [...newPRs, ...filtered]);
  }

  return newPRs;
}

export async function deletePR(prId: string): Promise<void> {
  const prs = await getPRs();
  await setJSON(KEYS.PRS, prs.filter(p => p.id !== prId));
}

export async function deletePRsForExercise(exerciseId: string): Promise<void> {
  const prs = await getPRs();
  await setJSON(KEYS.PRS, prs.filter(p => p.exerciseId !== exerciseId));
}

// ─── Body Measurements ──────────────────────────────────────

export async function getMeasurements(): Promise<BodyMeasurement[]> {
  return (await getJSON<BodyMeasurement[]>(KEYS.MEASUREMENTS)) ?? [];
}

export async function saveMeasurement(m: BodyMeasurement): Promise<void> {
  const all = await getMeasurements();
  const idx = all.findIndex(x => x.id === m.id);
  if (idx >= 0) {
    all[idx] = m;
  } else {
    all.unshift(m);
  }
  await setJSON(KEYS.MEASUREMENTS, all);
}

export async function deleteMeasurement(id: string): Promise<void> {
  const all = await getMeasurements();
  await setJSON(KEYS.MEASUREMENTS, all.filter(x => x.id !== id));
}

// ─── User Profile ────────────────────────────────────────────

export const DEFAULT_PROFILE: UserProfile = {
  name: 'Athlete',
  weightUnit: 'lbs',
  measurementUnit: 'in',
  restTimerDefault: 90,
  theme: 'dark',
  startOfWeek: 1,
  showRPE: true,
  autoRestTimer: true,
  sound: true,
  vibration: true,
  previousDataSource: 'last_workout',
};

export async function getProfile(): Promise<UserProfile> {
  return (await getJSON<UserProfile>(KEYS.PROFILE)) ?? DEFAULT_PROFILE;
}

export async function saveProfile(profile: UserProfile): Promise<void> {
  await setJSON(KEYS.PROFILE, profile);
}

// ─── Previous Exercise Data ─────────────────────────────────

export interface PreviousSetData {
  weight: number;
  reps: number;
}

export async function getPreviousExerciseData(exerciseId: string): Promise<PreviousSetData[]> {
  const workouts = await getWorkouts();
  // Find the most recent workout where this exercise was actually performed (had completed sets).
  // Skip workouts where the exercise was added but skipped (no completed working sets).
  for (const w of workouts) {
    const we = w.exercises.find(e => e.exerciseId === exerciseId);
    if (!we) continue;
    const completedSets = we.sets
      .filter(s => s.completed && !s.isWarmup)
      .map(s => ({ weight: s.weight, reps: s.reps }));
    if (completedSets.length > 0) {
      return completedSets;
    }
  }
  return [];
}

// ─── Custom Exercises ────────────────────────────────────────

export async function getCustomExercises(): Promise<Exercise[]> {
  return (await getJSON<Exercise[]>(KEYS.CUSTOM_EXERCISES)) ?? [];
}

export async function saveCustomExercise(exercise: Exercise): Promise<void> {
  const exercises = await getCustomExercises();
  const idx = exercises.findIndex(e => e.id === exercise.id);
  if (idx >= 0) {
    exercises[idx] = exercise;
  } else {
    exercises.unshift(exercise);
  }
  await setJSON(KEYS.CUSTOM_EXERCISES, exercises);
}

export async function deleteCustomExercise(id: string): Promise<void> {
  const exercises = await getCustomExercises();
  await setJSON(KEYS.CUSTOM_EXERCISES, exercises.filter(e => e.id !== id));
}

// ─── Rename Exercise ────────────────────────────────────────

export async function renameExercise(exerciseId: string, newName: string, newMuscle?: string, originalExercise?: Exercise): Promise<void> {
  // 1. Update custom exercises (or create override for built-in)
  const custom = await getCustomExercises();
  const customIdx = custom.findIndex(e => e.id === exerciseId);
  if (customIdx >= 0) {
    custom[customIdx].name = newName;
    if (newMuscle) custom[customIdx].primaryMuscle = newMuscle as any;
    await setJSON(KEYS.CUSTOM_EXERCISES, custom);
  } else if (originalExercise) {
    // Built-in exercise — save an override entry so rename persists across restarts
    const override: Exercise = {
      ...originalExercise,
      name: newName,
      primaryMuscle: newMuscle ? (newMuscle as any) : originalExercise.primaryMuscle,
      isCustom: true,
    };
    custom.push(override);
    await setJSON(KEYS.CUSTOM_EXERCISES, custom);
  }

  // 2. Update all past workouts
  const workouts = await getWorkouts();
  let changed = false;
  for (const w of workouts) {
    for (const we of w.exercises) {
      if (we.exerciseId === exerciseId && we.exercise) {
        we.exercise.name = newName;
        if (newMuscle) we.exercise.primaryMuscle = newMuscle as any;
        changed = true;
      }
    }
  }
  if (changed) await setJSON(KEYS.WORKOUTS, workouts);

  // 3. Update active workout if any
  const active = await getActiveWorkout();
  if (active) {
    let activeChanged = false;
    for (const we of active.exercises) {
      if (we.exerciseId === exerciseId && we.exercise) {
        we.exercise.name = newName;
        if (newMuscle) we.exercise.primaryMuscle = newMuscle as any;
        activeChanged = true;
      }
    }
    if (activeChanged) await saveActiveWorkout(active);
  }
}

// ─── Rebuild PRs from All Workouts ──────────────────────────

export async function rebuildAllPRs(): Promise<number> {
  const workouts = await getWorkouts();
  // Only track best estimated 1RM per exercise
  const bestPRs: Record<string, PersonalRecord> = {};

  for (const w of workouts) {
    for (const we of w.exercises) {
      const eid = we.exerciseId;

      for (const set of we.sets) {
        if (!set.completed || set.isWarmup || set.weight === 0 || set.reps <= 0) continue;

        const repsForCalc = Math.min(set.reps, 12);
        const e1rm = set.weight * (1 + repsForCalc / 30);

        const existing = bestPRs[eid];
        if (!existing || e1rm > existing.value) {
          bestPRs[eid] = {
            id: `${eid}-e1rm-rebuilt`,
            exerciseId: eid,
            exerciseName: we.exercise?.name,
            type: 'one_rep_max',
            value: Math.round(e1rm * 10) / 10,
            date: w.startTime,
            workoutId: w.id,
            previousValue: existing?.value,
            setWeight: set.weight,
            setReps: set.reps,
          };
        }
      }
    }
  }

  const prs = Object.values(bestPRs);
  await setJSON(KEYS.PRS, prs);
  return prs.length;
}

// ─── Backup & Restore ────────────────────────────────────────

export async function exportAllData(): Promise<string> {
  const data: Record<string, unknown> = {};
  for (const [name, key] of Object.entries(KEYS)) {
    const raw = await AsyncStorage.getItem(key);
    if (raw) data[name] = JSON.parse(raw);
  }
  return JSON.stringify(data, null, 2);
}

export async function importAllData(json: string): Promise<void> {
  const data = JSON.parse(json) as Record<string, unknown>;
  const keyMap = KEYS as Record<string, string>;
  for (const [name, value] of Object.entries(data)) {
    const key = keyMap[name];
    if (key) {
      await AsyncStorage.setItem(key, JSON.stringify(value));
    }
  }
}

// ─── Clear All Data ─────────────────────────────────────────

export async function clearAllData(): Promise<void> {
  const allKeys = Object.values(KEYS);
  for (const key of allKeys) {
    await AsyncStorage.removeItem(key);
  }
}

// ─── Exercise Notes (Sticky Notes) ──────────────────────────

export async function getExerciseNotes(): Promise<Record<string, string>> {
  return (await getJSON<Record<string, string>>(KEYS.EXERCISE_NOTES)) ?? {};
}

export async function getExerciseNote(exerciseId: string): Promise<string | null> {
  const notes = await getExerciseNotes();
  return notes[exerciseId] ?? null;
}

export async function saveExerciseNote(exerciseId: string, note: string): Promise<void> {
  const notes = await getExerciseNotes();
  if (note.trim()) {
    notes[exerciseId] = note.trim();
  } else {
    delete notes[exerciseId];
  }
  await setJSON(KEYS.EXERCISE_NOTES, notes);
}

// ─── Exercise Rest Timers (persistent per exercise) ─────────

export async function getExerciseRestTimer(exerciseId: string): Promise<number | null> {
  const timers = (await getJSON<Record<string, number>>(KEYS.EXERCISE_REST_TIMERS)) ?? {};
  return timers[exerciseId] ?? null;
}

export async function saveExerciseRestTimer(exerciseId: string, seconds: number): Promise<void> {
  const timers = (await getJSON<Record<string, number>>(KEYS.EXERCISE_REST_TIMERS)) ?? {};
  timers[exerciseId] = seconds;
  await setJSON(KEYS.EXERCISE_REST_TIMERS, timers);
}

export async function getExerciseRestTimers(): Promise<Record<string, number>> {
  return (await getJSON<Record<string, number>>(KEYS.EXERCISE_REST_TIMERS)) ?? {};
}

// Bulk merges used by template import — existing entries for other exercises are kept
export async function mergeExerciseNotes(notes: Record<string, string>): Promise<void> {
  const existing = await getExerciseNotes();
  for (const [id, note] of Object.entries(notes)) {
    if (note && note.trim()) existing[id] = note.trim();
  }
  await setJSON(KEYS.EXERCISE_NOTES, existing);
}

export async function mergeExerciseRestTimers(timers: Record<string, number>): Promise<void> {
  const existing = await getExerciseRestTimers();
  for (const [id, secs] of Object.entries(timers)) {
    if (Number.isFinite(secs) && secs > 0) existing[id] = Math.round(secs);
  }
  await setJSON(KEYS.EXERCISE_REST_TIMERS, existing);
}
