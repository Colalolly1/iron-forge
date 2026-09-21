import { Workout, WorkoutSet, MuscleGroup } from '../types';
import { Colors } from '../theme/colors';

export function generateId(): string {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 9);
}

export function formatDuration(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = Math.floor(minutes % 60);
  if (h > 0) return `${h}h ${m}m`;
  return `${m}m`;
}

export function formatTimer(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${s.toString().padStart(2, '0')}`;
}

export function formatWeight(weight: number, unit: 'kg' | 'lbs' = 'lbs'): string {
  if (weight === 0) return 'BW';
  return `${weight}${unit}`;
}

export function formatNumber(n: number): string {
  if (n >= 1000000) return `${(n / 1000000).toFixed(1)}M`;
  if (n >= 1000) return `${(n / 1000).toFixed(1)}K`;
  return n.toFixed(0);
}

export function calculateVolume(sets: WorkoutSet[]): number {
  return sets
    .filter(s => s.completed && !s.isWarmup)
    .reduce((sum, s) => sum + Math.abs(s.weight) * s.reps, 0);
}

export function calculateE1RM(weight: number, reps: number): number {
  if (reps === 1) return weight;
  if (reps <= 0) return 0;
  return Math.round(weight * (1 + reps / 30) * 10) / 10;
}

export function getMuscleGroupColor(muscle: MuscleGroup): string {
  const map: Partial<Record<MuscleGroup, string>> = {
    chest: Colors.chest,
    back: Colors.back,
    shoulders: Colors.shoulders,
    biceps: Colors.arms,
    triceps: Colors.arms,
    forearms: Colors.arms,
    quads: Colors.legs,
    hamstrings: Colors.legs,
    glutes: Colors.legs,
    calves: Colors.legs,
    core: Colors.core,
    traps: Colors.back,
    lats: Colors.back,
    full_body: Colors.fullBody,
    cardio: Colors.cardio,
  };
  return map[muscle] ?? Colors.primary;
}

export function getRelativeTime(dateStr: string): string {
  const now = new Date();
  const date = new Date(dateStr);
  const diff = now.getTime() - date.getTime();
  const minutes = Math.floor(diff / 60000);
  const hours = Math.floor(diff / 3600000);
  const days = Math.floor(diff / 86400000);

  if (minutes < 1) return 'just now';
  if (minutes < 60) return `${minutes}m ago`;
  if (hours < 24) return `${hours}h ago`;
  if (days < 7) return `${days}d ago`;
  if (days < 30) return `${Math.floor(days / 7)}w ago`;
  return date.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
}

export function getWeekday(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString('en-GB', { weekday: 'short' });
}

export function isSameDay(d1: string, d2: string): boolean {
  const a = new Date(d1);
  const b = new Date(d2);
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

export function getWorkoutMuscleGroups(workout: Workout): MuscleGroup[] {
  const muscles = new Set<MuscleGroup>();
  workout.exercises.forEach(e => {
    muscles.add(e.exercise.primaryMuscle);
    e.exercise.secondaryMuscles.forEach(m => muscles.add(m));
  });
  return Array.from(muscles);
}

export function plateCalculator(
  targetWeight: number,
  barWeight: number = 45,
  unit: 'lbs' | 'kg' = 'lbs'
): number[] {
  const availablePlates =
    unit === 'lbs'
      ? [45, 35, 25, 10, 5, 2.5]
      : [25, 20, 15, 10, 5, 2.5, 1.25];

  const perSide = (targetWeight - barWeight) / 2;
  if (perSide <= 0) return [];

  const plates: number[] = [];
  let remaining = perSide;

  for (const plate of availablePlates) {
    while (remaining >= plate) {
      plates.push(plate);
      remaining -= plate;
    }
  }

  return plates;
}
