import { Workout, WorkoutExercise, WorkoutSet, Exercise } from '../types';
import { EXERCISE_MAP, getAllExercises } from '../data/exercises';
import { generateId } from './helpers';
import { saveWorkout, saveCustomExercise, rebuildAllPRs } from './storage';

/**
 * Parse a Strong app CSV export and import workouts.
 * Strong CSV columns (may vary by version):
 *   Date, Workout Name, Duration, Exercise Name, Set Order,
 *   Weight, Weight (kgs), Weight (lbs), Reps,
 *   Distance, Distance (km), Distance (m),
 *   Seconds, Notes, Workout Notes, RPE
 */

interface StrongRow {
  date: string;
  workoutName: string;
  duration: string; // raw duration string e.g. "1h 23m" or seconds
  exerciseName: string;
  setOrder: number;
  weight: number;
  reps: number;
  distance: number;
  seconds: number;
  notes: string;
  workoutNotes: string;
  rpe: number | undefined;
}

function parseCSVLine(line: string): string[] {
  const fields: string[] = [];
  let current = '';
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (inQuotes) {
      if (ch === '"' && line[i + 1] === '"') {
        current += '"';
        i++;
      } else if (ch === '"') {
        inQuotes = false;
      } else {
        current += ch;
      }
    } else {
      if (ch === '"') {
        inQuotes = true;
      } else if (ch === ',' || ch === ';') {
        fields.push(current.trim());
        current = '';
      } else {
        current += ch;
      }
    }
  }
  fields.push(current.trim());
  return fields;
}

function parseDurationToMinutes(raw: string): number {
  if (!raw) return 0;

  // Try "1h 23m 10s" format
  const hMatch = raw.match(/(\d+)\s*h/);
  const mMatch = raw.match(/(\d+)\s*m/);
  const sMatch = raw.match(/(\d+)\s*s/);
  if (hMatch || mMatch || sMatch) {
    const h = hMatch ? parseInt(hMatch[1]) : 0;
    const m = mMatch ? parseInt(mMatch[1]) : 0;
    const s = sMatch ? parseInt(sMatch[1]) : 0;
    return h * 60 + m + s / 60;
  }

  // Try HH:MM:SS or MM:SS format
  const parts = raw.split(':').map(Number);
  if (parts.length === 3 && parts.every(p => !isNaN(p))) {
    return parts[0] * 60 + parts[1] + parts[2] / 60;
  }
  if (parts.length === 2 && parts.every(p => !isNaN(p))) {
    return parts[0] + parts[1] / 60;
  }

  // Try raw seconds
  const num = parseFloat(raw);
  if (!isNaN(num) && num > 200) return num / 60; // likely seconds
  if (!isNaN(num)) return num; // likely minutes

  return 0;
}

export function fuzzyMatchExercise(name: string): Exercise | null {
  const lower = name.toLowerCase().trim();

  // Exact name match first
  for (const ex of getAllExercises()) {
    if (ex.name.toLowerCase() === lower) return ex;
  }

  // Partial match
  for (const ex of getAllExercises()) {
    if (ex.name.toLowerCase().includes(lower) || lower.includes(ex.name.toLowerCase())) {
      return ex;
    }
  }

  // Word overlap match (at least 2 words match)
  const words = lower.split(/\s+/);
  let bestMatch: Exercise | null = null;
  let bestScore = 0;
  for (const ex of getAllExercises()) {
    const exWords = ex.name.toLowerCase().split(/\s+/);
    const score = words.filter(w => exWords.some(ew => ew.includes(w) || w.includes(ew))).length;
    if (score > bestScore && score >= 2) {
      bestScore = score;
      bestMatch = ex;
    }
  }

  return bestMatch;
}

export function createCustomExerciseFromName(name: string): Exercise {
  return {
    id: `import-${name.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`,
    name,
    primaryMuscle: 'full_body',
    secondaryMuscles: [],
    category: 'other',
    force: 'compound',
    isCustom: true,
  };
}

/**
 * Find column index by checking multiple possible header names.
 * Strong app CSV headers vary between versions and unit preferences.
 */
function findCol(headers: string[], ...patterns: string[]): number {
  for (const p of patterns) {
    const idx = headers.findIndex(h => h.includes(p));
    if (idx !== -1) return idx;
  }
  return -1;
}

export function parseStrongCSV(csvContent: string): StrongRow[] {
  const lines = csvContent.split(/\r?\n/).filter(l => l.trim());
  if (lines.length < 2) return [];

  const headerLine = lines[0];
  const headers = parseCSVLine(headerLine).map(h => h.toLowerCase().trim());

  // Map column indices — flexible matching for different Strong versions
  const dateIdx = findCol(headers, 'date');
  const nameIdx = findCol(headers, 'workout name');
  const durationIdx = findCol(headers, 'duration');
  const exIdx = findCol(headers, 'exercise name');
  const setIdx = findCol(headers, 'set order');
  // Weight can be "weight", "weight (kgs)", "weight (lbs)", "weight (kg)"
  const weightIdx = findCol(headers, 'weight');
  const repsIdx = findCol(headers, 'reps');
  // Distance can be "distance", "distance (km)", "distance (m)"
  const distIdx = findCol(headers, 'distance');
  const secIdx = findCol(headers, 'seconds');
  const notesIdx = findCol(headers, 'notes');
  const wNotesIdx = findCol(headers, 'workout notes');
  const rpeIdx = findCol(headers, 'rpe');

  if (dateIdx === -1 || exIdx === -1) return [];

  const rows: StrongRow[] = [];
  for (let i = 1; i < lines.length; i++) {
    const fields = parseCSVLine(lines[i]);
    if (fields.length < 3) continue;

    const rawWeight = weightIdx >= 0 ? fields[weightIdx] : '';
    const rawReps = repsIdx >= 0 ? fields[repsIdx] : '';
    const rawDist = distIdx >= 0 ? fields[distIdx] : '';
    const rawSec = secIdx >= 0 ? fields[secIdx] : '';
    const rawRpe = rpeIdx >= 0 ? fields[rpeIdx] : '';

    rows.push({
      date: fields[dateIdx] ?? '',
      workoutName: nameIdx >= 0 ? fields[nameIdx] ?? '' : 'Workout',
      duration: durationIdx >= 0 ? fields[durationIdx] ?? '' : '',
      exerciseName: fields[exIdx] ?? '',
      setOrder: setIdx >= 0 ? parseInt(fields[setIdx]) || 1 : 1,
      weight: rawWeight ? parseFloat(rawWeight) : 0,
      reps: rawReps ? parseInt(rawReps) : 0,
      distance: rawDist ? parseFloat(rawDist) : 0,
      seconds: rawSec ? parseInt(rawSec) : 0,
      notes: notesIdx >= 0 ? fields[notesIdx] ?? '' : '',
      workoutNotes: wNotesIdx >= 0 ? fields[wNotesIdx] ?? '' : '',
      rpe: rawRpe ? parseFloat(rawRpe) : undefined,
    });
  }

  return rows;
}

export async function importStrongWorkouts(csvContent: string): Promise<{
  imported: number;
  skipped: number;
  unmatchedExercises: string[];
}> {
  const rows = parseStrongCSV(csvContent);
  if (rows.length === 0) return { imported: 0, skipped: 0, unmatchedExercises: [] };

  // Group rows by workout (date + name)
  const workoutGroups = new Map<string, StrongRow[]>();
  for (const row of rows) {
    const key = `${row.date}|||${row.workoutName}`;
    if (!workoutGroups.has(key)) workoutGroups.set(key, []);
    workoutGroups.get(key)!.push(row);
  }

  const unmatchedSet = new Set<string>();
  let imported = 0;

  for (const [key, groupRows] of workoutGroups) {
    // Group rows by exercise within the workout
    const exerciseGroups = new Map<string, StrongRow[]>();
    for (const row of groupRows) {
      if (!exerciseGroups.has(row.exerciseName)) exerciseGroups.set(row.exerciseName, []);
      exerciseGroups.get(row.exerciseName)!.push(row);
    }

    const exercises: WorkoutExercise[] = [];
    let exerciseOrder = 0;

    for (const [exName, exRows] of exerciseGroups) {
      let exercise = fuzzyMatchExercise(exName);
      if (!exercise) {
        exercise = createCustomExerciseFromName(exName);
        unmatchedSet.add(exName);
        // Persist custom exercise so it shows up in the exercise picker
        await saveCustomExercise(exercise);
      }

      // Register in EXERCISE_MAP if not present
      if (!EXERCISE_MAP.has(exercise.id)) {
        EXERCISE_MAP.set(exercise.id, exercise);
      }

      const sets: WorkoutSet[] = exRows.map((r, i) => ({
        id: generateId(),
        setNumber: r.setOrder || i + 1,
        weight: r.weight,
        reps: r.reps,
        rpe: r.rpe,
        completed: true,
        distance: r.distance > 0 ? r.distance : undefined,
        seconds: r.seconds > 0 ? r.seconds : undefined,
        notes: r.notes || undefined,
      }));

      exercises.push({
        id: generateId(),
        exerciseId: exercise.id,
        exercise,
        sets,
        notes: exRows[0].notes || undefined,
        order: exerciseOrder++,
      });
    }

    const firstRow = groupRows[0];
    const startDate = new Date(firstRow.date);
    if (isNaN(startDate.getTime())) continue;

    // Parse duration from Strong's Duration column
    const durationMinutes = parseDurationToMinutes(firstRow.duration);

    // Calculate end time from duration
    const endDate = new Date(startDate.getTime() + durationMinutes * 60 * 1000);

    // Calculate totals
    const totalSets = exercises.reduce((sum, e) => sum + e.sets.filter(s => s.completed).length, 0);
    const totalVolume = exercises.reduce(
      (sum, e) => sum + e.sets.filter(s => s.completed).reduce((s2, set) => s2 + set.weight * set.reps, 0),
      0,
    );
    const totalReps = exercises.reduce(
      (sum, e) => sum + e.sets.filter(s => s.completed).reduce((s2, set) => s2 + set.reps, 0),
      0,
    );

    const workout: Workout = {
      id: generateId(),
      name: firstRow.workoutName || 'Imported Workout',
      startTime: startDate.toISOString(),
      endTime: endDate.toISOString(),
      exercises,
      totalVolume,
      totalSets,
      duration: Math.round(durationMinutes),
      notes: firstRow.workoutNotes || undefined,
    };

    await saveWorkout(workout);
    imported++;
  }

  // Rebuild PRs from all workouts (including newly imported ones)
  if (imported > 0) {
    await rebuildAllPRs();
  }

  return {
    imported,
    skipped: 0,
    unmatchedExercises: Array.from(unmatchedSet),
  };
}
