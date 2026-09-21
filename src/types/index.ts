// ─── Core Data Types ────────────────────────────────────────

export type MuscleGroup =
  | 'chest'
  | 'back'
  | 'shoulders'
  | 'biceps'
  | 'triceps'
  | 'forearms'
  | 'quads'
  | 'hamstrings'
  | 'glutes'
  | 'calves'
  | 'core'
  | 'traps'
  | 'lats'
  | 'full_body'
  | 'cardio';

export type ExerciseCategory =
  | 'barbell'
  | 'dumbbell'
  | 'machine'
  | 'cable'
  | 'bodyweight'
  | 'cardio'
  | 'kettlebell'
  | 'band'
  | 'smith_machine'
  | 'other';

export type ExerciseForce = 'push' | 'pull' | 'static' | 'compound';

export interface Exercise {
  id: string;
  name: string;
  primaryMuscle: MuscleGroup;
  secondaryMuscles: MuscleGroup[];
  category: ExerciseCategory;
  force: ExerciseForce;
  instructions?: string;
  isCustom?: boolean;
}

export interface WorkoutSet {
  id: string;
  setNumber: number;
  weight: number;       // in user's preferred unit
  reps: number;
  rpe?: number;         // Rate of Perceived Exertion (1-10)
  isWarmup?: boolean;
  isDropset?: boolean;
  isFailure?: boolean;
  completed: boolean;
  restSeconds?: number;
  distance?: number;    // meters (for cardio)
  seconds?: number;     // duration of set (for cardio/timed)
  notes?: string;
}

export interface WorkoutExercise {
  id: string;
  exerciseId: string;
  exercise: Exercise;
  sets: WorkoutSet[];
  notes?: string;
  supersetGroupId?: string;
  order: number;
}

export interface Workout {
  id: string;
  name: string;
  startTime: string;    // ISO date
  endTime?: string;     // ISO date
  exercises: WorkoutExercise[];
  notes?: string;
  totalVolume: number;   // total weight × reps
  totalSets: number;
  duration: number;      // minutes
  isTemplate?: boolean;
  templateId?: string;
  rating?: number;       // 1-5 stars
}

export interface WorkoutTemplate {
  id: string;
  name: string;
  description?: string;
  exercises: {
    exerciseId: string;
    sets: number;
    targetReps?: number;
    targetWeight?: number;
    order: number;
    supersetGroupId?: string;
    notes?: string;
  }[];
  muscleGroups: MuscleGroup[];
  estimatedDuration?: number;
  color?: string;
  icon?: string;
  lastUsed?: string;
  timesUsed: number;
  /** Weekly plan: days of the week this template is meant for (0 = Sunday … 6 = Saturday). */
  days?: number[];
  createdAt: string;
  isCustom?: boolean;
}

export interface PersonalRecord {
  id: string;
  exerciseId: string;
  exerciseName?: string;
  type: 'weight' | 'reps' | 'volume' | 'one_rep_max';
  value: number;
  date: string;
  workoutId: string;
  previousValue?: number;
  setWeight?: number;
  setReps?: number;
}

export interface BodyMeasurement {
  id: string;
  date: string;
  weight?: number;
  bodyFat?: number;
  chest?: number;
  waist?: number;
  hips?: number;
  bicepLeft?: number;
  bicepRight?: number;
  thighLeft?: number;
  thighRight?: number;
  calfLeft?: number;
  calfRight?: number;
  neck?: number;
  notes?: string;
}

export interface UserProfile {
  name: string;
  weightUnit: 'kg' | 'lbs';
  measurementUnit: 'cm' | 'in';
  restTimerDefault: number;    // seconds
  theme: 'dark' | 'light';
  startOfWeek: 0 | 1;         // 0=Sunday, 1=Monday
  showRPE: boolean;
  autoRestTimer: boolean;
  sound: boolean;
  vibration: boolean;
  previousDataSource: 'last_workout' | 'template';
}

export interface WorkoutStats {
  totalWorkouts: number;
  totalVolume: number;
  totalSets: number;
  totalReps: number;
  totalDuration: number;
  averageDuration: number;
  currentStreak: number;
  longestStreak: number;
  favoriteExercise?: string;
  favoriteMuscleGroup?: MuscleGroup;
  thisWeekWorkouts: number;
  thisMonthWorkouts: number;
  prsThisMonth: number;
}

export interface DayWorkoutSummary {
  date: string;
  hasWorkout: boolean;
  workoutId?: string;
  muscleGroups?: MuscleGroup[];
}
