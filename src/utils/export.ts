import { Paths, File } from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import { Alert } from 'react-native';
import { Workout, BodyMeasurement } from '../types';

function escapeCsv(val: string): string {
  if (val.includes(',') || val.includes('"') || val.includes('\n')) {
    return `"${val.replace(/"/g, '""')}"`;
  }
  return val;
}

export function exportWorkoutsCSV(workouts: Workout[], unit: string): string {
  // Strong app compatible format — one row per set
  // Duration is Strong's own column ("1h 5m"); without it a re-import gives every workout 0 minutes.
  const header = 'Date,Workout Name,Duration,Exercise Name,Set Order,Weight,Reps,Distance,Seconds,Notes,Workout Notes,RPE';
  const rows: string[] = [];
  workouts.forEach(w => {
    const date = new Date(w.startTime).toISOString().replace('T', ' ').slice(0, 19);
    const mins = Math.max(0, Math.round(w.duration ?? 0));
    const duration = mins >= 60 ? `${Math.floor(mins / 60)}h ${mins % 60}m` : `${mins}m`;
    w.exercises.forEach(e => {
      // Only sets that were done; warm-ups are "W", as in Strong. Weights go out as logged,
      // so assisted lifts keep their minus sign.
      e.sets.filter(s => s.completed).forEach(s => {
        rows.push([
          date,
          escapeCsv(w.name),
          duration,
          escapeCsv(e.exercise.name),
          s.isWarmup ? 'W' : String(s.setNumber),
          String(s.weight || 0),
          s.reps > 0 ? String(s.reps) : '0',
          s.distance ? String(s.distance) : '0',
          s.seconds ? String(s.seconds) : '0',
          escapeCsv(e.notes ?? ''),
          escapeCsv(w.notes ?? ''),
          s.rpe ? String(s.rpe) : '',
        ].join(','));
      });
    });
  });
  return [header, ...rows].join('\n');
}

export function exportMeasurementsCSV(
  measurements: BodyMeasurement[],
  weightUnit: string,
  measurementUnit: string,
): string {
  const u = measurementUnit;
  const header = [
    'Date',
    `Weight (${weightUnit})`,
    'Body Fat %',
    `Chest (${u})`,
    `Waist (${u})`,
    `Hips (${u})`,
    `Bicep L (${u})`,
    `Bicep R (${u})`,
    `Thigh L (${u})`,
    `Thigh R (${u})`,
    `Calf L (${u})`,
    `Calf R (${u})`,
    `Neck (${u})`,
    'Notes',
  ].join(',');

  const rows = measurements.map(m => {
    return [
      new Date(m.date).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }),
      m.weight ?? '',
      m.bodyFat ?? '',
      m.chest ?? '',
      m.waist ?? '',
      m.hips ?? '',
      m.bicepLeft ?? '',
      m.bicepRight ?? '',
      m.thighLeft ?? '',
      m.thighRight ?? '',
      m.calfLeft ?? '',
      m.calfRight ?? '',
      m.neck ?? '',
      escapeCsv(m.notes ?? ''),
    ].join(',');
  });

  return [header, ...rows].join('\n');
}

async function shareFile(content: string, filename: string, mimeType: string): Promise<void> {
  const file = new File(Paths.cache, filename);
  try { file.delete(); } catch {}
  file.create();
  file.write(content);

  const isAvailable = await Sharing.isAvailableAsync();
  if (!isAvailable) {
    Alert.alert('Sharing not available', 'Sharing is not supported on this device.');
    return;
  }
  await Sharing.shareAsync(file.uri, {
    mimeType,
    dialogTitle: 'Export ' + filename,
  });
}

export async function shareJSON(jsonContent: string, filename: string): Promise<void> {
  await shareFile(jsonContent, filename, 'application/json');
}

export async function shareCSV(csvContent: string, filename: string): Promise<void> {
  await shareFile(csvContent, filename, 'text/csv');
}

export async function readPickedFile(uri: string): Promise<string> {
  // DocumentPicker with copyToCacheDirectory gives us a file:// URI in cache
  const file = new File(uri);
  if (!file.exists) {
    throw new Error('File not found: ' + uri);
  }
  return await file.text();
}
