import React, { createContext, useContext, useState, useCallback, useRef, useEffect, useMemo } from 'react';
import { AppState, AppStateStatus, Vibration, Platform } from 'react-native';
import * as Notifications from 'expo-notifications';
import { Audio } from 'expo-av';
import {
  Workout,
  WorkoutExercise,
  WorkoutSet,
  Exercise,
  PersonalRecord,
} from '../types';
import {
  saveActiveWorkout,
  getActiveWorkout,
  saveWorkout,
  checkAndSavePRs,
  getProfile,
} from '../utils/storage';
import { generateId, calculateVolume } from '../utils/helpers';
import { targetForExercise, setsForSlot } from '../utils/bodyParts';

// Preload bell sound
const bellSound = require('../../assets/bell.wav');

// One rest notification at a time, so it can be replaced or cancelled by name.
const REST_NOTIFICATION_ID = 'rest-timer';
// Android keeps a channel's first settings, so a change of sound or vibration needs a new id.
const REST_CHANNEL_ID = 'rest-timer-v4';

if (Platform.OS !== 'web') {
  // With the app open the in-app bell covers it; the notification is for when it isn't.
  Notifications.setNotificationHandler({
    handleNotification: async () => {
      const open = AppState.currentState === 'active';
      return {
        shouldPlaySound: !open,
        shouldSetBadge: false,
        shouldShowBanner: !open,
        shouldShowList: !open,
      };
    },
  });

  if (Platform.OS === 'android') {
    Notifications.setNotificationChannelAsync(REST_CHANNEL_ID, {
      name: 'Rest Timer',
      importance: Notifications.AndroidImportance.MAX,
      sound: 'bell.wav',
      vibrationPattern: [0, 300],
      enableVibrate: true,
      lightColor: '#FFFFFF',
    });
    // The old channel had vibration off; remove it so it doesn't linger in settings.
    Notifications.deleteNotificationChannelAsync('rest-timer-v3').catch(() => {});
  }
}

interface WorkoutContextType {
  activeWorkout: Workout | null;
  isWorkoutActive: boolean;
  isRestTimerRunning: boolean;
  newPRs: PersonalRecord[];

  startWorkout: (name?: string, templateExercises?: WorkoutExercise[], targets?: Workout['targets']) => void;
  /** Saves the workout, under `name` if one is given. */
  finishWorkout: (name?: string) => Promise<PersonalRecord[]>;
  discardWorkout: () => void;

  addExercise: (exercise: Exercise, sets?: number) => void;
  /** Add an exercise chosen for one body-part target, with that target's number of sets. */
  pickForTarget: (targetId: string, exercise: Exercise) => void;
  removeExercise: (exerciseId: string) => void;
  replaceExercise: (workoutExerciseId: string, newExercise: Exercise) => void;
  reorderExercise: (fromIndex: number, toIndex: number) => void;

  addSet: (workoutExerciseId: string) => void;
  updateSet: (workoutExerciseId: string, setId: string, data: Partial<WorkoutSet>) => void;
  removeSet: (workoutExerciseId: string, setId: string) => void;
  completeSet: (workoutExerciseId: string, setId: string) => void;

  toggleSuperset: (exerciseId1: string, exerciseId2: string) => void;
  getExercisesInSuperset: (supersetGroupId: string) => WorkoutExercise[];

  startRestTimer: (seconds?: number) => void;
  /** Adds time to the running rest timer. */
  extendRestTimer: (seconds: number) => void;
  stopRestTimer: () => void;
  clearPRs: () => void;
}

const WorkoutContext = createContext<WorkoutContextType | null>(null);
const RestSecondsContext = createContext(0);

export function WorkoutProvider({ children }: { children: React.ReactNode }) {
  const [activeWorkout, setActiveWorkout] = useState<Workout | null>(null);
  const [restTimer, setRestTimer] = useState(0);
  const [isRestTimerRunning, setIsRestTimerRunning] = useState(false);
  const [newPRs, setNewPRs] = useState<PersonalRecord[]>([]);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const timerEndRef = useRef<number>(0); // Absolute timestamp when timer ends
  const vibrationEnabledRef = useRef(true);
  const soundEnabledRef = useRef(true);

  // Load sound/vibration preferences
  useEffect(() => {
    getProfile().then(p => {
      vibrationEnabledRef.current = p.vibration;
      soundEnabledRef.current = p.sound;
    });
  }, []);
  const soundRef = useRef<Audio.Sound | null>(null);

  // Reload user preferences (called before each timer finish to respect toggle changes)
  const reloadPrefs = useCallback(async () => {
    const p = await getProfile();
    vibrationEnabledRef.current = p.vibration;
    soundEnabledRef.current = p.sound;
  }, []);

  // Play boxing bell sound — does NOT interrupt music
  const playBell = useCallback(async () => {
    try {
      // Set audio mode to mix with other audio (don't pause music)
      await Audio.setAudioModeAsync({
        playsInSilentModeIOS: true,
        staysActiveInBackground: false,
        shouldDuckAndroid: false,
        playThroughEarpieceAndroid: false,
      });
      // Unload previous sound if any
      if (soundRef.current) {
        await soundRef.current.unloadAsync().catch(() => {});
      }
      const { sound } = await Audio.Sound.createAsync(bellSound, { volume: 1.0 });
      soundRef.current = sound;
      await sound.playAsync();
      // Auto-cleanup after playback
      sound.setOnPlaybackStatusUpdate(status => {
        if (status.isLoaded && status.didJustFinish) {
          sound.unloadAsync().catch(() => {});
          soundRef.current = null;
        }
      });
    } catch {}
  }, []);

  // Request notification permissions on mount
  useEffect(() => {
    if (Platform.OS !== 'web') {
      Notifications.requestPermissionsAsync().catch(() => {});
    }
  }, []);

  // Restore active workout on mount. Until that has finished, nothing is saved,
  // or the empty starting state would be written over the stored workout.
  const hydrated = useRef(false);
  useEffect(() => {
    getActiveWorkout()
      .then(w => {
        if (w) setActiveWorkout(prev => prev ?? w);
      })
      .finally(() => {
        hydrated.current = true;
      });
  }, []);

  // Persist active workout on change
  useEffect(() => {
    if (!hydrated.current) return;
    saveActiveWorkout(activeWorkout);
  }, [activeWorkout]);

  // Handle app state changes — recalculate timer when returning from background
  useEffect(() => {
    const subscription = AppState.addEventListener('change', async (nextState: AppStateStatus) => {
      if (nextState === 'active' && timerEndRef.current > 0) {
        const remaining = Math.round((timerEndRef.current - Date.now()) / 1000);
        if (remaining <= 0) {
          // Timer already finished while in background — notification already alerted user
          setRestTimer(0);
          setIsRestTimerRunning(false);
          timerEndRef.current = 0;
          // Don't play sound/vibrate again — notification already did it
        } else {
          setRestTimer(remaining);
          setIsRestTimerRunning(false);
          setTimeout(() => setIsRestTimerRunning(true), 50);
        }
      }
      // Reload prefs when app comes to foreground (user may have changed toggles)
      if (nextState === 'active') {
        reloadPrefs();
      }
    });
    return () => subscription.remove();
  }, [reloadPrefs]);

  // Rest timer logic — uses end timestamp for accuracy
  useEffect(() => {
    if (isRestTimerRunning && timerEndRef.current > 0) {
      timerRef.current = setInterval(async () => {
        const remaining = Math.round((timerEndRef.current - Date.now()) / 1000);
        if (remaining <= 0) {
          setRestTimer(0);
          setIsRestTimerRunning(false);
          timerEndRef.current = 0;
          // Reload prefs so toggles take effect immediately
          await reloadPrefs();
          // Bell sound + vibration when timer finishes (in-app only)
          if (soundEnabledRef.current) playBell();
          if (vibrationEnabledRef.current) Vibration.vibrate(300);
        } else {
          setRestTimer(remaining);
        }
      }, 500);
    }
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [isRestTimerRunning, reloadPrefs, playBell]);

  const updateWorkout = useCallback((updater: (w: Workout) => Workout) => {
    setActiveWorkout(prev => {
      if (!prev) return prev;
      return updater(prev);
    });
  }, []);

  const startWorkout = useCallback(
    (name?: string, templateExercises?: WorkoutExercise[], targets?: Workout['targets']) => {
      const workout: Workout = {
        id: generateId(),
        name: name ?? 'Workout',
        startTime: new Date().toISOString(),
        exercises: templateExercises ?? [],
        ...(targets && targets.length > 0 ? { targets } : {}),
        totalVolume: 0,
        totalSets: 0,
        duration: 0,
      };
      setActiveWorkout(workout);
    },
    []
  );

  const finishWorkout = useCallback(async (name?: string): Promise<PersonalRecord[]> => {
    if (!activeWorkout) return [];

    const endTime = new Date().toISOString();
    const duration = Math.round(
      (new Date(endTime).getTime() - new Date(activeWorkout.startTime).getTime()) / 60000
    );

    let totalVol = 0;
    let totalSets = 0;
    activeWorkout.exercises.forEach(e => {
      const completed = e.sets.filter(s => s.completed && !s.isWarmup);
      totalVol += calculateVolume(e.sets);
      totalSets += completed.length;
    });

    const finishedWorkout: Workout = {
      ...activeWorkout,
      name: name?.trim() || activeWorkout.name,
      endTime,
      duration,
      totalVolume: totalVol,
      totalSets,
    };

    // Throws if the saved history can't be read; the workout then stays open.
    await saveWorkout(finishedWorkout);
    const prs = await checkAndSavePRs(finishedWorkout);
    setNewPRs(prs);
    setActiveWorkout(null);
    setIsRestTimerRunning(false);
    setRestTimer(0);
    timerEndRef.current = 0;
    cancelRestNotification();
    return prs;
  }, [activeWorkout]);

  const discardWorkout = useCallback(() => {
    setActiveWorkout(null);
    setIsRestTimerRunning(false);
    setRestTimer(0);
    timerEndRef.current = 0;
    cancelRestNotification();
  }, []);

  const addExercise = useCallback(
    (exercise: Exercise, sets = 1) => {
      updateWorkout(w => {
        // On a targets workout, an exercise for one of the body parts counts
        // toward that target and gets its number of sets.
        const target = targetForExercise(w, exercise);
        const we = newWorkoutExercise(exercise, target ? setsForSlot(target, chosenFor(w, target.id)) : sets, w.exercises.length);
        return { ...w, exercises: [...w.exercises, target ? { ...we, targetId: target.id } : we] };
      });
    },
    [updateWorkout]
  );

  const pickForTarget = useCallback(
    (targetId: string, exercise: Exercise) => {
      updateWorkout(w => {
        const target = (w.targets ?? []).find(t => t.id === targetId);
        if (!target) return w;
        return {
          ...w,
          exercises: [
            ...w.exercises,
            { ...newWorkoutExercise(exercise, setsForSlot(target, chosenFor(w, targetId)), w.exercises.length), targetId },
          ],
        };
      });
    },
    [updateWorkout]
  );

  const removeExercise = useCallback(
    (workoutExerciseId: string) => {
      updateWorkout(w => ({
        ...w,
        exercises: w.exercises.filter(e => e.id !== workoutExerciseId),
      }));
    },
    [updateWorkout]
  );

  const replaceExercise = useCallback(
    (workoutExerciseId: string, newExercise: Exercise) => {
      updateWorkout(w => ({
        ...w,
        exercises: w.exercises.map(e => {
          if (e.id !== workoutExerciseId) return e;
          return {
            ...e,
            exerciseId: newExercise.id,
            exercise: newExercise,
          };
        }),
      }));
    },
    [updateWorkout]
  );

  const reorderExercise = useCallback(
    (fromIndex: number, toIndex: number) => {
      updateWorkout(w => {
        const exercises = [...w.exercises];
        const [moved] = exercises.splice(fromIndex, 1);
        exercises.splice(toIndex, 0, moved);
        return { ...w, exercises: exercises.map((e, i) => ({ ...e, order: i })) };
      });
    },
    [updateWorkout]
  );

  const toggleSuperset = useCallback(
    (exerciseId1: string, exerciseId2: string) => {
      updateWorkout(w => {
        const ex1 = w.exercises.find(e => e.id === exerciseId1);
        const ex2 = w.exercises.find(e => e.id === exerciseId2);
        if (!ex1 || !ex2) return w;

        // If both already share the same superset group, unlink them
        if (ex1.supersetGroupId && ex1.supersetGroupId === ex2.supersetGroupId) {
          return {
            ...w,
            exercises: w.exercises.map(e => {
              if (e.id === exerciseId1 || e.id === exerciseId2) {
                return { ...e, supersetGroupId: undefined };
              }
              return e;
            }),
          };
        }

        // Otherwise, link them under the same group
        const groupId = ex1.supersetGroupId || ex2.supersetGroupId || generateId();
        return {
          ...w,
          exercises: w.exercises.map(e => {
            if (e.id === exerciseId1 || e.id === exerciseId2) {
              return { ...e, supersetGroupId: groupId };
            }
            // If ex2 had a different group, merge those exercises too
            if (ex2.supersetGroupId && e.supersetGroupId === ex2.supersetGroupId) {
              return { ...e, supersetGroupId: groupId };
            }
            return e;
          }),
        };
      });
    },
    [updateWorkout]
  );

  const getExercisesInSuperset = useCallback(
    (supersetGroupId: string): WorkoutExercise[] => {
      if (!activeWorkout) return [];
      return activeWorkout.exercises.filter(e => e.supersetGroupId === supersetGroupId);
    },
    [activeWorkout]
  );

  const addSet = useCallback(
    (workoutExerciseId: string) => {
      updateWorkout(w => ({
        ...w,
        exercises: w.exercises.map(e => {
          if (e.id !== workoutExerciseId) return e;
          const lastSet = e.sets[e.sets.length - 1];
          return {
            ...e,
            sets: [
              ...e.sets,
              {
                id: generateId(),
                setNumber: e.sets.length + 1,
                weight: lastSet?.weight ?? 0,
                reps: lastSet?.reps ?? 0,
                completed: false,
              },
            ],
          };
        }),
      }));
    },
    [updateWorkout]
  );

  const updateSet = useCallback(
    (workoutExerciseId: string, setId: string, data: Partial<WorkoutSet>) => {
      updateWorkout(w => ({
        ...w,
        exercises: w.exercises.map(e => {
          if (e.id !== workoutExerciseId) return e;
          return {
            ...e,
            sets: e.sets.map(s => (s.id === setId ? { ...s, ...data } : s)),
          };
        }),
      }));
    },
    [updateWorkout]
  );

  const removeSet = useCallback(
    (workoutExerciseId: string, setId: string) => {
      updateWorkout(w => ({
        ...w,
        exercises: w.exercises.map(e => {
          if (e.id !== workoutExerciseId) return e;
          return {
            ...e,
            sets: e.sets
              .filter(s => s.id !== setId)
              .map((s, i) => ({ ...s, setNumber: i + 1 })),
          };
        }),
      }));
    },
    [updateWorkout]
  );

  const completeSet = useCallback(
    (workoutExerciseId: string, setId: string) => {
      updateWorkout(w => ({
        ...w,
        exercises: w.exercises.map(e => {
          if (e.id !== workoutExerciseId) return e;
          return {
            ...e,
            sets: e.sets.map(s =>
              s.id === setId ? { ...s, completed: !s.completed } : s
            ),
          };
        }),
      }));
    },
    [updateWorkout]
  );

  // Schedules the bell for the timer's current end time. The fixed id replaces any rest notification already waiting.
  const scheduleNotification = useCallback(async () => {
    if (Platform.OS === 'web') return;
    try {
      // Reload prefs to respect current toggle state
      await reloadPrefs();
      // The timer may have been stopped while the prefs loaded.
      const seconds = Math.ceil((timerEndRef.current - Date.now()) / 1000);
      if (timerEndRef.current === 0 || seconds <= 0) return;
      await Notifications.scheduleNotificationAsync({
        identifier: REST_NOTIFICATION_ID,
        content: {
          title: 'Rest Timer Done',
          body: 'Time to start your next set!',
          sound: soundEnabledRef.current ? 'bell.wav' : undefined,
          vibrate: vibrationEnabledRef.current ? [0, 300] : undefined,
        },
        trigger: {
          type: Notifications.SchedulableTriggerInputTypes.TIME_INTERVAL,
          seconds,
          channelId: REST_CHANNEL_ID,
        },
      });
    } catch {}
  }, [reloadPrefs]);

  const startRestTimer = useCallback((seconds?: number) => {
    if (seconds) {
      timerEndRef.current = Date.now() + seconds * 1000;
      setRestTimer(seconds);
      setIsRestTimerRunning(true);
      scheduleNotification();
    } else {
      getProfile().then(profile => {
        const dur = profile.restTimerDefault;
        timerEndRef.current = Date.now() + dur * 1000;
        setRestTimer(dur);
        setIsRestTimerRunning(true);
        scheduleNotification();
      });
    }
  }, [scheduleNotification]);

  const extendRestTimer = useCallback((seconds: number) => {
    // From the current end time, or from now if the timer has already run out.
    timerEndRef.current = Math.max(timerEndRef.current, Date.now()) + seconds * 1000;
    setRestTimer(Math.round((timerEndRef.current - Date.now()) / 1000));
    setIsRestTimerRunning(true);
    scheduleNotification();
  }, [scheduleNotification]);

  const stopRestTimer = useCallback(() => {
    setIsRestTimerRunning(false);
    setRestTimer(0);
    timerEndRef.current = 0;
    cancelRestNotification();
  }, []);

  const clearPRs = useCallback(() => setNewPRs([]), []);

  const value = useMemo<WorkoutContextType>(
    () => ({
      activeWorkout,
      isWorkoutActive: !!activeWorkout,
      isRestTimerRunning,
      newPRs,
      startWorkout,
      finishWorkout,
      discardWorkout,
      addExercise,
      pickForTarget,
      removeExercise,
      replaceExercise,
      reorderExercise,
      toggleSuperset,
      getExercisesInSuperset,
      addSet,
      updateSet,
      removeSet,
      completeSet,
      startRestTimer,
      extendRestTimer,
      stopRestTimer,
      clearPRs,
    }),
    [
      activeWorkout,
      isRestTimerRunning,
      newPRs,
      startWorkout,
      finishWorkout,
      discardWorkout,
      addExercise,
      pickForTarget,
      removeExercise,
      replaceExercise,
      reorderExercise,
      toggleSuperset,
      getExercisesInSuperset,
      addSet,
      updateSet,
      removeSet,
      completeSet,
      startRestTimer,
      extendRestTimer,
      stopRestTimer,
      clearPRs,
    ]
  );

  // The seconds left tick on their own context, so only the timer redraws each second.
  return (
    <WorkoutContext.Provider value={value}>
      <RestSecondsContext.Provider value={restTimer}>{children}</RestSecondsContext.Provider>
    </WorkoutContext.Provider>
  );
}

/** Seconds left on the rest timer. Only the timer itself should read this. */
export function useRestSeconds() {
  return useContext(RestSecondsContext);
}

function cancelRestNotification() {
  if (Platform.OS === 'web') return;
  Notifications.cancelScheduledNotificationAsync(REST_NOTIFICATION_ID).catch(() => {});
}

export function useWorkout() {
  const ctx = useContext(WorkoutContext);
  if (!ctx) throw new Error('useWorkout must be used within WorkoutProvider');
  return ctx;
}

/** How many exercises have been chosen for a target so far. */
function chosenFor(w: Workout, targetId: string): number {
  return w.exercises.filter(e => e.targetId === targetId).length;
}

function newWorkoutExercise(exercise: Exercise, sets: number, order: number): WorkoutExercise {
  return {
    id: generateId(),
    exerciseId: exercise.id,
    exercise,
    sets: Array.from({ length: Math.max(1, sets) }, (_, i) => ({
      id: generateId(),
      setNumber: i + 1,
      weight: 0,
      reps: 0,
      completed: false,
    })),
    order,
  };
}
