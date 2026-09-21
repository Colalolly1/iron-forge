import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  Pressable,
  Alert,
  Platform,
  TextInput,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { Card } from '../components/Card';
import { MuscleGroupBadge } from '../components/MuscleGroupBadge';
import { useWorkout } from '../context/WorkoutContext';
import { startOrReplace } from '../utils/startFlow';
import { getWorkouts, deleteWorkout, getProfile, saveWorkout } from '../utils/storage';
import {
  formatDuration,
  formatWeight,
  formatNumber,
  calculateE1RM,
  generateId,
  getWorkoutMuscleGroups,
  calculateVolume,
} from '../utils/helpers';
import { Workout, UserProfile, WorkoutExercise, WorkoutSet } from '../types';
import { Colors, Spacing, FontSize, BorderRadius } from '../theme/colors';

export function WorkoutDetailScreen({ route, navigation }: any) {
  const { workoutId } = route.params;
  const { startWorkout, isWorkoutActive, discardWorkout } = useWorkout();
  const [workout, setWorkout] = useState<Workout | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [editing, setEditing] = useState(false);
  const [editWorkout, setEditWorkout] = useState<Workout | null>(null);

  useEffect(() => {
    loadData();
  }, [workoutId]);

  const loadData = async () => {
    const [ws, p] = await Promise.all([getWorkouts(), getProfile()]);
    const w = ws.find(x => x.id === workoutId);
    setWorkout(w ?? null);
    setProfile(p);
  };

  const handleRepeat = () => {
    if (!workout) return;
    const exercises: WorkoutExercise[] = workout.exercises.map((we, i) => ({
      id: generateId(),
      exerciseId: we.exerciseId,
      exercise: we.exercise,
      sets: we.sets.filter(s => !s.isWarmup).map((s, si) => ({
        id: generateId(),
        setNumber: si + 1,
        weight: 0,
        reps: 0,
        completed: false,
      })),
      notes: we.notes,
      order: i,
    }));
    startOrReplace({
      isWorkoutActive,
      discardWorkout,
      navigation,
      start: () => startWorkout(workout.name, exercises),
    });
  };

  const handleDelete = async () => {
    if (Platform.OS === 'web') {
      if (window.confirm('Delete Workout? This cannot be undone.')) {
        await deleteWorkout(workoutId);
        navigation.goBack();
      }
    } else {
      Alert.alert('Delete Workout?', 'This cannot be undone.', [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            await deleteWorkout(workoutId);
            navigation.goBack();
          },
        },
      ]);
    }
  };

  // --- Edit mode helpers ---
  const startEditing = () => {
    if (!workout) return;
    setEditWorkout(JSON.parse(JSON.stringify(workout)));
    setEditing(true);
  };

  const cancelEditing = () => {
    setEditing(false);
    setEditWorkout(null);
  };

  const saveEdits = async () => {
    if (!editWorkout) return;
    // Recalculate totals
    const totalSets = editWorkout.exercises.reduce(
      (sum, e) => sum + e.sets.filter(s => s.completed && !s.isWarmup).length, 0
    );
    const totalVolume = editWorkout.exercises.reduce(
      (sum, e) => sum + calculateVolume(e.sets), 0
    );
    const updated = { ...editWorkout, totalSets, totalVolume };
    await saveWorkout(updated);
    setWorkout(updated);
    setEditing(false);
    setEditWorkout(null);
  };

  const updateSet = (exerciseId: string, setId: string, field: 'weight' | 'reps', value: string) => {
    if (!editWorkout) return;
    setEditWorkout({
      ...editWorkout,
      exercises: editWorkout.exercises.map(we =>
        we.id === exerciseId
          ? {
              ...we,
              sets: we.sets.map(s =>
                s.id === setId ? { ...s, [field]: parseFloat(value) || 0 } : s
              ),
            }
          : we
      ),
    });
  };

  const removeSetFromHistory = (exerciseId: string, setId: string) => {
    if (!editWorkout) return;
    setEditWorkout({
      ...editWorkout,
      exercises: editWorkout.exercises.map(we =>
        we.id === exerciseId
          ? {
              ...we,
              sets: we.sets.filter(s => s.id !== setId).map((s, i) => ({
                ...s,
                setNumber: s.isWarmup ? s.setNumber : i + 1,
              })),
            }
          : we
      ),
    });
  };

  const addSetToHistory = (exerciseId: string) => {
    if (!editWorkout) return;
    setEditWorkout({
      ...editWorkout,
      exercises: editWorkout.exercises.map(we => {
        if (we.id !== exerciseId) return we;
        const lastSet = we.sets[we.sets.length - 1];
        const newSet: WorkoutSet = {
          id: generateId(),
          setNumber: we.sets.filter(s => !s.isWarmup).length + 1,
          weight: lastSet?.weight ?? 0,
          reps: lastSet?.reps ?? 0,
          completed: true,
        };
        return { ...we, sets: [...we.sets, newSet] };
      }),
    });
  };

  const removeExerciseFromHistory = (exerciseId: string) => {
    if (!editWorkout) return;
    const ex = editWorkout.exercises.find(e => e.id === exerciseId);
    Alert.alert(
      'Remove Exercise?',
      `Remove ${ex?.exercise.name ?? 'this exercise'} from this workout?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Remove',
          style: 'destructive',
          onPress: () => {
            setEditWorkout({
              ...editWorkout,
              exercises: editWorkout.exercises.filter(e => e.id !== exerciseId),
            });
          },
        },
      ]
    );
  };

  if (!workout || !profile) return null;

  const unit = profile.weightUnit;
  const displayWorkout = editing && editWorkout ? editWorkout : workout;
  const muscles = getWorkoutMuscleGroups(displayWorkout);
  const date = new Date(displayWorkout.startTime);

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <View style={styles.header}>
        <Pressable
          onPress={() => {
            if (editing) {
              cancelEditing();
            } else {
              navigation.goBack();
            }
          }}
          style={styles.backBtn}
        >
          {editing ? (
            <Text style={styles.cancelText}>Cancel</Text>
          ) : (
            <Ionicons name="chevron-back" size={24} color={Colors.text} />
          )}
        </Pressable>
        <Text style={styles.headerTitle}>
          {editing ? 'Edit Workout' : 'Workout Details'}
        </Text>
        <View style={{ flexDirection: 'row', gap: Spacing.sm }}>
          {editing ? (
            <Pressable onPress={saveEdits} style={styles.saveBtn}>
              <Text style={styles.saveText}>Save</Text>
            </Pressable>
          ) : (
            <>
              <Pressable onPress={startEditing} style={styles.deleteBtn}>
                <Ionicons name="create-outline" size={22} color={Colors.accent} />
              </Pressable>
              <Pressable onPress={handleRepeat} style={styles.deleteBtn}>
                <Ionicons name="repeat-outline" size={22} color={Colors.primary} />
              </Pressable>
              <Pressable onPress={handleDelete} style={styles.deleteBtn}>
                <Ionicons name="trash-outline" size={22} color={Colors.danger} />
              </Pressable>
            </>
          )}
        </View>
      </View>

      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        {/* Overview */}
        <View style={styles.overview}>
          <Text style={styles.name}>{displayWorkout.name}</Text>
          <Text style={styles.date}>
            {date.toLocaleDateString('en-GB', {
              weekday: 'long',
              month: 'long',
              day: 'numeric',
              year: 'numeric',
            })}
          </Text>
          <Text style={styles.time}>
            {date.toLocaleTimeString('en-GB', {
              hour: 'numeric',
              minute: '2-digit',
            })}
          </Text>
        </View>

        {/* Stats */}
        {!editing && (
          <View style={styles.statsRow}>
            <View style={styles.statCard}>
              <Ionicons name="time-outline" size={20} color={Colors.primary} />
              <Text style={styles.statValue}>{formatDuration(displayWorkout.duration)}</Text>
              <Text style={styles.statLabel}>Duration</Text>
            </View>
            <View style={styles.statCard}>
              <Ionicons name="layers-outline" size={20} color={Colors.accent} />
              <Text style={styles.statValue}>{displayWorkout.totalSets}</Text>
              <Text style={styles.statLabel}>Sets</Text>
            </View>
            <View style={styles.statCard}>
              <Ionicons name="trending-up" size={20} color={Colors.warning} />
              <Text style={styles.statValue}>
                {formatNumber(displayWorkout.totalVolume)}
              </Text>
              <Text style={styles.statLabel}>Volume ({unit})</Text>
            </View>
          </View>
        )}

        {/* Muscle groups */}
        {!editing && (
          <View style={styles.muscleRow}>
            {muscles.map(m => (
              <MuscleGroupBadge key={m} muscle={m} size="md" />
            ))}
          </View>
        )}

        {/* Exercises */}
        {displayWorkout.exercises.map(we => {
          const completedSets = we.sets.filter(s => s.completed && !s.isWarmup);
          return (
            <Card key={we.id} style={styles.exerciseCard}>
              <View style={styles.exerciseNameRow}>
                <Pressable
                  onPress={() => !editing && navigation.navigate('ExerciseHistory', {
                    exerciseId: we.exercise.id,
                    exerciseName: we.exercise.name,
                  })}
                  style={{ flex: 1, flexDirection: 'row', alignItems: 'center', gap: Spacing.sm }}
                >
                  <Text style={styles.exerciseName}>{we.exercise.name}</Text>
                  {!editing && (
                    <Ionicons name="analytics-outline" size={16} color={Colors.textSecondary} />
                  )}
                </Pressable>
                {editing && (
                  <Pressable onPress={() => removeExerciseFromHistory(we.id)} hitSlop={8}>
                    <Ionicons name="trash-outline" size={20} color={Colors.danger} />
                  </Pressable>
                )}
              </View>
              {!editing && <MuscleGroupBadge muscle={we.exercise.primaryMuscle} />}

              <View style={styles.setsTable}>
                {(() => {
                  const hasDistance = we.sets.some(s => s.distance && s.distance > 0);
                  const hasSeconds = we.sets.some(s => s.seconds && s.seconds > 0);
                  const hasWeight = we.sets.some(s => s.weight > 0) || editing;
                  return (
                    <>
                      <View style={styles.tableHeader}>
                        <Text style={[styles.colH, { width: 30 }]}>SET</Text>
                        {hasWeight && (
                          <Text style={[styles.colH, { flex: 1 }]}>
                            {unit.toUpperCase()}
                          </Text>
                        )}
                        <Text style={[styles.colH, { flex: 1 }]}>REPS</Text>
                        {!editing && hasDistance && (
                          <Text style={[styles.colH, { flex: 1 }]}>DIST</Text>
                        )}
                        {!editing && hasSeconds && (
                          <Text style={[styles.colH, { flex: 1 }]}>TIME</Text>
                        )}
                        {!editing && hasWeight && (
                          <Text style={[styles.colH, { flex: 1 }]}>1RM</Text>
                        )}
                        {editing && <View style={{ width: 30 }} />}
                      </View>

                      {we.sets.map(set => {
                        const e1rm =
                          set.reps > 0 && set.weight > 0
                            ? calculateE1RM(set.weight, set.reps)
                            : 0;

                        if (editing) {
                          return (
                            <View key={set.id} style={[styles.tableRow, styles.editRow]}>
                              <Text style={[styles.cell, { width: 30 }]}>
                                {set.isWarmup ? 'W' : set.setNumber}
                              </Text>
                              <TextInput
                                style={[styles.editInput, { flex: 1 }]}
                                value={set.weight > 0 ? String(set.weight) : ''}
                                onChangeText={v => updateSet(we.id, set.id, 'weight', v)}
                                keyboardType="numeric"
                                placeholder="0"
                                placeholderTextColor={Colors.textTertiary}
                              />
                              <TextInput
                                style={[styles.editInput, { flex: 1 }]}
                                value={set.reps > 0 ? String(set.reps) : ''}
                                onChangeText={v => updateSet(we.id, set.id, 'reps', v)}
                                keyboardType="numeric"
                                placeholder="0"
                                placeholderTextColor={Colors.textTertiary}
                              />
                              <Pressable
                                onPress={() => removeSetFromHistory(we.id, set.id)}
                                hitSlop={6}
                                style={{ width: 30, alignItems: 'center' }}
                              >
                                <Ionicons name="close-circle" size={18} color={Colors.danger} />
                              </Pressable>
                            </View>
                          );
                        }

                        return (
                          <View
                            key={set.id}
                            style={[
                              styles.tableRow,
                              set.completed && styles.completedRow,
                              set.isWarmup && styles.warmupRow,
                            ]}
                          >
                            <Text style={[styles.cell, { width: 30 }]}>
                              {set.isWarmup ? 'W' : set.setNumber}
                            </Text>
                            {hasWeight && (
                              <Text style={[styles.cell, styles.weightCell, { flex: 1 }]}>
                                {set.weight > 0 ? formatWeight(set.weight, unit) : '—'}
                              </Text>
                            )}
                            <Text style={[styles.cell, { flex: 1 }]}>
                              {set.reps > 0 ? set.reps : '—'}
                            </Text>
                            {hasDistance && (
                              <Text style={[styles.cell, { flex: 1 }]}>
                                {set.distance && set.distance > 0
                                  ? set.distance >= 1000
                                    ? `${(set.distance / 1000).toFixed(2)}km`
                                    : `${set.distance}m`
                                  : '—'}
                              </Text>
                            )}
                            {hasSeconds && (
                              <Text style={[styles.cell, { flex: 1 }]}>
                                {set.seconds && set.seconds > 0
                                  ? set.seconds >= 60
                                    ? `${Math.floor(set.seconds / 60)}:${String(set.seconds % 60).padStart(2, '0')}`
                                    : `${set.seconds}s`
                                  : '—'}
                              </Text>
                            )}
                            {hasWeight && (
                              <Text style={[styles.cell, styles.e1rmCell, { flex: 1 }]}>
                                {e1rm > 0 ? formatWeight(Math.round(e1rm), unit) : '—'}
                              </Text>
                            )}
                          </View>
                        );
                      })}

                      {editing && (
                        <Pressable
                          onPress={() => addSetToHistory(we.id)}
                          style={styles.addSetBtn}
                        >
                          <Ionicons name="add" size={16} color={Colors.primary} />
                          <Text style={styles.addSetText}>Add Set</Text>
                        </Pressable>
                      )}
                    </>
                  );
                })()}
              </View>
            </Card>
          );
        })}

        <View style={{ height: 40 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.bg },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  backBtn: { padding: Spacing.xs },
  cancelText: {
    color: Colors.textSecondary,
    fontSize: FontSize.md,
    fontWeight: '600',
  },
  headerTitle: {
    color: Colors.text,
    fontSize: FontSize.lg,
    fontWeight: '700',
  },
  deleteBtn: { padding: Spacing.xs },
  saveBtn: {
    backgroundColor: Colors.accent,
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.round,
  },
  saveText: {
    color: Colors.textInverse,
    fontSize: FontSize.md,
    fontWeight: '700',
  },
  content: { padding: Spacing.md, gap: Spacing.md },
  overview: { gap: Spacing.xs },
  name: {
    color: Colors.text,
    fontSize: FontSize.xxl,
    fontWeight: '800',
  },
  date: {
    color: Colors.textSecondary,
    fontSize: FontSize.md,
  },
  time: {
    color: Colors.textTertiary,
    fontSize: FontSize.sm,
  },
  statsRow: {
    flexDirection: 'row',
    gap: Spacing.sm,
  },
  statCard: {
    flex: 1,
    backgroundColor: Colors.bgCard,
    borderRadius: BorderRadius.md,
    padding: Spacing.md,
    alignItems: 'center',
    gap: Spacing.xs,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  statValue: {
    color: Colors.text,
    fontSize: FontSize.xl,
    fontWeight: '800',
  },
  statLabel: {
    color: Colors.textSecondary,
    fontSize: FontSize.xs,
    fontWeight: '600',
  },
  muscleRow: {
    flexDirection: 'row',
    gap: Spacing.sm,
    flexWrap: 'wrap',
  },
  exerciseCard: {
    gap: Spacing.sm,
  },
  exerciseNameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: Spacing.sm,
  },
  exerciseName: {
    color: Colors.text,
    fontSize: FontSize.lg,
    fontWeight: '700',
  },
  setsTable: {
    gap: 2,
  },
  tableHeader: {
    flexDirection: 'row',
    paddingVertical: Spacing.xs,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
    gap: Spacing.xs,
  },
  colH: {
    color: Colors.textSecondary,
    fontSize: FontSize.sm,
    fontWeight: '800',
    textAlign: 'center',
    letterSpacing: 0.5,
  },
  tableRow: {
    flexDirection: 'row',
    paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.sm,
    gap: Spacing.xs,
    alignItems: 'center',
  },
  editRow: {
    paddingVertical: Spacing.xs,
  },
  completedRow: {
    backgroundColor: Colors.accentMuted,
  },
  warmupRow: {
    backgroundColor: Colors.warningMuted,
  },
  cell: {
    color: Colors.text,
    fontSize: FontSize.lg,
    fontWeight: '700',
    textAlign: 'center',
  },
  weightCell: {
    color: Colors.text,
    fontWeight: '800',
  },
  e1rmCell: {
    color: Colors.textSecondary,
  },
  editInput: {
    backgroundColor: Colors.bgInput,
    borderRadius: BorderRadius.sm,
    paddingHorizontal: Spacing.sm,
    paddingVertical: Spacing.xs,
    color: Colors.text,
    fontSize: FontSize.md,
    fontWeight: '700',
    textAlign: 'center',
    borderWidth: 1,
    borderColor: Colors.border,
  },
  addSetBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.xs,
    paddingVertical: Spacing.sm,
    marginTop: Spacing.xs,
  },
  addSetText: {
    color: Colors.primary,
    fontSize: FontSize.sm,
    fontWeight: '700',
  },
});
