import React, { createContext, useContext, useState, useCallback, useRef, useEffect } from 'react';
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

// Preload bell sound
const bellSound = require('../../assets/bell.wav');

// Configure notification handler (show alerts even in foreground)
if (Platform.OS !== 'web') {
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowAlert: true,
      shouldPlaySound: true,
      shouldSetBadge: false,
      shouldShowBanner: true,
      shouldShowList: true,
    }),
  });

  // Create Android notification channel with bell sound + vibration
  // Using unique channel ID so Android doesn't cache old silent settings
  if (Platform.OS === 'android') {
    Notifications.setNotificationChannelAsync('rest-timer-v3', {
      name: 'Rest Timer',
      importance: Notifications.AndroidImportance.MAX,
      sound: 'bell.wav',
      vibrationPattern: [0, 300],
      enableVibrate: false,
      lightColor: '#FFFFFF',
    });
  }
}

interface WorkoutContextType {
  activeWorkout: Workout | null;
  isWorkoutActive: boolean;
  restTimer: number;
  isRestTimerRunning: boolean;
  newPRs: PersonalRecord[];

  startWorkout: (name?: string, templateExercises?: WorkoutExercise[], toPick?: Workout['toPick']) => void;
  finishWorkout: () => Promise<PersonalRecord[]>;
  discardWorkout: () => void;

  addExercise: (exercise: Exercise, sets?: number) => void;
  /** Fill one body-part slot with an exercise; the slot's count goes down by one. */
  pickForSlot: (slotId: string, exercise: Exercise) => void;
  /** Change how many exercises are still to choose for a body part. */
  changeSlotCount: (slotId: string, delta: number) => void;
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
  stopRestTimer: () => void;
  clearPRs: () => void;
}

const WorkoutContext = createContext<WorkoutContextType | null>(null);

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
  const notifIdRef = useRef<string | null>(null);
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

  // Restore active workout on mount
  useEffect(() => {
    getActiveWorkout().then(w => {
      if (w) setActiveWorkout(w);
    });
  }, []);

  // Persist active workout on change
  useEffect(() => {
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
    (name?: string, templateExercises?: WorkoutExercise[], toPick?: Workout['toPick']) => {
      const workout: Workout = {
        id: generateId(),
        name: name ?? 'Workout',
        startTime: new Date().toISOString(),
        exercises: templateExercises ?? [],
        ...(toPick && toPick.length > 0 ? { toPick } : {}),
        totalVolume: 0,
        totalSets: 0,
        duration: 0,
      };
      setActiveWorkout(workout);
    },
    []
  );

  const finishWorkout = useCallback(async (): Promise<PersonalRecord[]> => {
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

    // Unchosen body-part slots belong to the session, not the history.
    const { toPick: _unchosen, ...logged } = activeWorkout;
    const finishedWorkout: Workout = {
      ...logged,
      endTime,
      duration,
      totalVolume: totalVol,
      totalSets,
    };

    await saveWorkout(finishedWorkout);
    const prs = await checkAndSavePRs(finishedWorkout);
    setNewPRs(prs);
    setActiveWorkout(null);
    setIsRestTimerRunning(false);
    setRestTimer(0);
    timerEndRef.current = 0;
    return prs;
  }, [activeWorkout]);

  const discardWorkout = useCallback(() => {
    setActiveWorkout(null);
    setIsRestTimerRunning(false);
    setRestTimer(0);
    timerEndRef.current = 0;
  }, []);

  const addExercise = useCallback(
    (exercise: Exercise, sets = 1) => {
      updateWorkout(w => ({
        ...w,
        exercises: [...w.exercises, newWorkoutExercise(exercise, sets, w.exercises.length)],
      }));
    },
    [updateWorkout]
  );

  const pickForSlot = useCallback(
    (slotId: string, exercise: Exercise) => {
      updateWorkout(w => {
        const slot = (w.toPick ?? []).find(s => s.id === slotId);
        if (!slot) return w;
        const toPick = (w.toPick ?? [])
          .map(s => (s.id === slotId ? { ...s, count: s.count - 1 } : s))
          .filter(s => s.count > 0);
        return {
          ...w,
          toPick,
          exercises: [...w.exercises, newWorkoutExercise(exercise, slot.sets, w.exercises.length)],
        };
      });
    },
    [updateWorkout]
  );

  const changeSlotCount = useCallback(
    (slotId: string, delta: number) => {
      updateWorkout(w => ({
        ...w,
        toPick: (w.toPick ?? [])
          .map(s => (s.id === slotId ? { ...s, count: Math.max(0, s.count + delta) } : s))
          .filter(s => s.count > 0),
      }));
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

  const scheduleNotification = useCallback(async (seconds: number) => {
    if (Platform.OS === 'web') return;
    try {
      // Cancel previous
      if (notifIdRef.current) {
        await Notifications.cancelScheduledNotificationAsync(notifIdRef.current).catch(() => {});
      }
      // Reload prefs to respect current toggle state
      await reloadPrefs();
      notifIdRef.current = await Notifications.scheduleNotificationAsync({
        content: {
          title: 'Rest Timer Done',
          body: 'Time to start your next set!',
          sound: soundEnabledRef.current ? 'bell.wav' : undefined,
          vibrate: vibrationEnabledRef.current ? [0, 300] : undefined,
        },
        trigger: {
          type: Notifications.SchedulableTriggerInputTypes.TIME_INTERVAL,
          seconds,
          channelId: 'rest-timer-v3',
        },
      });
    } catch {}
  }, [reloadPrefs]);

  const cancelNotification = useCallback(async () => {
    if (Platform.OS === 'web' || !notifIdRef.current) return;
    try {
      await Notifications.cancelScheduledNotificationAsync(notifIdRef.current);
    } catch {}
    notifIdRef.current = null;
  }, []);

  const startRestTimer = useCallback((seconds?: number) => {
    if (seconds) {
      timerEndRef.current = Date.now() + seconds * 1000;
      setRestTimer(seconds);
      setIsRestTimerRunning(true);
      scheduleNotification(seconds);
    } else {
      getProfile().then(profile => {
        const dur = profile.restTimerDefault;
        timerEndRef.current = Date.now() + dur * 1000;
        setRestTimer(dur);
        setIsRestTimerRunning(true);
        scheduleNotification(dur);
      });
    }
  }, [scheduleNotification]);

  const stopRestTimer = useCallback(() => {
    setIsRestTimerRunning(false);
    setRestTimer(0);
    timerEndRef.current = 0;
    cancelNotification();
  }, [cancelNotification]);

  const clearPRs = useCallback(() => setNewPRs([]), []);

  return (
    <WorkoutContext.Provider
      value={{
        activeWorkout,
        isWorkoutActive: !!activeWorkout,
        restTimer,
        isRestTimerRunning,
        newPRs,
        startWorkout,
        finishWorkout,
        discardWorkout,
        addExercise,
        pickForSlot,
        changeSlotCount,
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
        stopRestTimer,
        clearPRs,
      }}
    >
      {children}
    </WorkoutContext.Provider>
  );
}

export function useWorkout() {
  const ctx = useContext(WorkoutContext);
  if (!ctx) throw new Error('useWorkout must be used within WorkoutProvider');
  return ctx;
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
