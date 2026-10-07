import React, { useState, useEffect, useRef, createRef, useImperativeHandle } from 'react';
import { View, Text, StyleSheet, Pressable, TextInput, Alert, Keyboard } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { WorkoutExercise, WorkoutSet, Exercise, BodyPart } from '../types';
import { SetRow, SetRowRef } from './SetRow';
import { MuscleGroupBadge } from './MuscleGroupBadge';
import { ExercisePickerModal } from './ExercisePickerModal';
import { useWorkout } from '../context/WorkoutContext';
import { getExerciseNote, saveExerciseNote, getPreviousExerciseData, PreviousSetData, getExerciseRestTimer, saveExerciseRestTimer } from '../utils/storage';
import { Colors, BorderRadius, Spacing, FontSize } from '../theme/colors';
import { calculateVolume, formatWeight } from '../utils/helpers';

interface ExerciseCardProps {
  workoutExercise: WorkoutExercise;
  showRPE?: boolean;
  unit: 'kg' | 'lbs';
  isInSuperset?: boolean;
  onMoveUp?: () => void;
  onMoveDown?: () => void;
  onSetCompleted?: (exerciseId: string, setIdx: number) => void;
  /** Set when this exercise was chosen for a body-part target, e.g. "For Chest · 3 sets · 8-12 reps". */
  targetLabel?: string;
  targetPart?: BodyPart;
}

export interface ExerciseCardRef {
  focusSet: (setIdx: number) => void;
}

export const ExerciseCard = React.forwardRef<ExerciseCardRef, ExerciseCardProps>(function ExerciseCard(
  { workoutExercise, showRPE, unit, isInSuperset, onMoveUp, onMoveDown, onSetCompleted, targetLabel, targetPart },
  ref
) {
  const navigation = useNavigation<any>();
  const { activeWorkout, addSet, updateSet, removeSet, completeSet, removeExercise, replaceExercise, startRestTimer, getExercisesInSuperset } = useWorkout();
  const [showSwapPicker, setShowSwapPicker] = useState(false);
  const [collapsed, setCollapsed] = useState(false);
  const [stickyNote, setStickyNote] = useState('');
  const [editingNote, setEditingNote] = useState(false);
  const [noteInput, setNoteInput] = useState('');
  const [previousData, setPreviousData] = useState<PreviousSetData[]>([]);
  const [restSeconds, setRestSeconds] = useState(90);
  const [editingRest, setEditingRest] = useState(false);
  const [restInput, setRestInput] = useState('90');

  const exercise = workoutExercise.exercise;

  // Refs for each SetRow to enable auto-focus on next set
  const setRowRefs = useRef<React.RefObject<SetRowRef>[]>([]);
  // Keep refs array in sync with number of sets
  if (setRowRefs.current.length !== workoutExercise.sets.length) {
    setRowRefs.current = workoutExercise.sets.map(
      (_, i) => setRowRefs.current[i] || createRef<SetRowRef>()
    );
  }

  useImperativeHandle(ref, () => ({
    focusSet: (setIdx: number) => {
      setTimeout(() => setRowRefs.current[setIdx]?.current?.focusWeight(), 100);
    },
  }));

  useEffect(() => {
    getExerciseNote(exercise.id).then(note => {
      if (note) setStickyNote(note);
    });
    getPreviousExerciseData(exercise.id).then(setPreviousData);
    getExerciseRestTimer(exercise.id).then(saved => {
      if (saved !== null) {
        setRestSeconds(saved);
        setRestInput(String(saved));
      }
    });
  }, [exercise.id]);

  const handleSaveNote = async () => {
    await saveExerciseNote(exercise.id, noteInput);
    setStickyNote(noteInput.trim());
    setEditingNote(false);
  };
  const completedSets = workoutExercise.sets.filter(s => s.completed && !s.isWarmup);
  const totalVolume = calculateVolume(workoutExercise.sets);

  return (
    <View style={styles.container}>
      {/* Header */}
      <Pressable onPress={() => setCollapsed(!collapsed)} style={styles.header}>
        <View style={styles.headerLeft}>
          <View style={styles.nameRow}>
            <Text style={styles.exerciseName}>{exercise.name}</Text>
            <Pressable
              onPress={() => navigation.navigate('ExerciseHistory', {
                exerciseId: exercise.id,
                exerciseName: exercise.name,
              })}
              hitSlop={8}
            >
              <Ionicons name="analytics-outline" size={18} color={Colors.textSecondary} />
            </Pressable>
          </View>
          {targetLabel ? <Text style={styles.targetLabel}>{targetLabel}</Text> : null}
          <View style={styles.badges}>
            <MuscleGroupBadge muscle={exercise.primaryMuscle} />
            <Text style={styles.meta}>
              {completedSets.length}/{workoutExercise.sets.length} sets
            </Text>
            {totalVolume > 0 && (
              <Text style={styles.volume}>
                {formatWeight(totalVolume, unit)} vol
              </Text>
            )}
          </View>
        </View>
        <View style={styles.headerRight}>
          {onMoveUp !== undefined && (
            <Pressable onPress={onMoveUp} hitSlop={6}>
              <Ionicons name="chevron-up" size={18} color={Colors.text} />
            </Pressable>
          )}
          {onMoveDown !== undefined && (
            <Pressable onPress={onMoveDown} hitSlop={6}>
              <Ionicons name="chevron-down" size={18} color={Colors.text} />
            </Pressable>
          )}
          <Pressable
            onPress={() => setShowSwapPicker(true)}
            style={styles.removeBtn}
            hitSlop={6}
          >
            <Ionicons name="swap-horizontal" size={20} color={Colors.textSecondary} />
          </Pressable>
          <Pressable
            onPress={() => {
              Alert.alert(
                'Remove Exercise?',
                `Remove ${exercise.name} from this workout?`,
                [
                  { text: 'Cancel', style: 'cancel' },
                  { text: 'Remove', style: 'destructive', onPress: () => removeExercise(workoutExercise.id) },
                ]
              );
            }}
            style={styles.removeBtn}
          >
            <Ionicons name="trash-outline" size={20} color={Colors.danger} />
          </Pressable>
          <Ionicons
            name={collapsed ? 'chevron-down' : 'chevron-up'}
            size={20}
            color={Colors.textTertiary}
          />
        </View>
      </Pressable>

      {/* Per-exercise rest timer */}
      {!collapsed && (
        <View style={styles.restRow}>
          <Pressable
            onPress={() => { setRestInput(String(restSeconds)); setEditingRest(!editingRest); }}
            style={styles.restBtn}
          >
            <Ionicons name="timer-outline" size={14} color={Colors.textSecondary} />
            <Text style={styles.restText}>Rest: {restSeconds}s</Text>
          </Pressable>
          {editingRest && (
            <View style={styles.restEdit}>
              {[30, 60, 90, 120, 180].map(s => (
                <Pressable
                  key={s}
                  onPress={() => { setRestSeconds(s); setEditingRest(false); saveExerciseRestTimer(exercise.id, s); }}
                  style={[styles.restChip, restSeconds === s && styles.restChipActive]}
                >
                  <Text style={[styles.restChipText, restSeconds === s && styles.restChipTextActive]}>
                    {s >= 60 ? `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}` : `${s}s`}
                  </Text>
                </Pressable>
              ))}
              <TextInput
                style={styles.restInput}
                value={restInput}
                onChangeText={t => setRestInput(t.replace(/[^0-9]/g, ''))}
                onBlur={() => {
                  const val = parseInt(restInput) || 90;
                  setRestSeconds(val);
                  setRestInput(String(val));
                  saveExerciseRestTimer(exercise.id, val);
                }}
                keyboardType="numeric"
                placeholder="sec"
                placeholderTextColor={Colors.textTertiary}
              />
            </View>
          )}
        </View>
      )}

      {/* Sticky Note */}
      {!collapsed && !!stickyNote && !editingNote && (
        <Pressable
          onPress={() => { setNoteInput(stickyNote); setEditingNote(true); }}
          style={styles.stickyNote}
        >
          <Ionicons name="document-text" size={14} color={Colors.warning} />
          <Text style={styles.stickyNoteText}>{stickyNote}</Text>
        </Pressable>
      )}

      {!collapsed && editingNote && (
        <View style={styles.stickyNoteEdit}>
          <TextInput
            style={styles.stickyNoteInput}
            value={noteInput}
            onChangeText={setNoteInput}
            placeholder="e.g. Squeeze at the top, slow eccentric..."
            placeholderTextColor={Colors.textTertiary}
            multiline
            autoFocus
          />
          <View style={styles.stickyNoteButtons}>
            <Pressable onPress={() => setEditingNote(false)} style={styles.noteBtn}>
              <Text style={styles.noteBtnCancel}>Cancel</Text>
            </Pressable>
            <Pressable onPress={handleSaveNote} style={styles.noteBtn}>
              <Text style={styles.noteBtnSave}>Save</Text>
            </Pressable>
          </View>
        </View>
      )}

      {!collapsed && !stickyNote && !editingNote && (
        <Pressable
          onPress={() => { setNoteInput(''); setEditingNote(true); }}
          style={styles.addNoteBtn}
        >
          <Ionicons name="add" size={14} color={Colors.textTertiary} />
          <Text style={styles.addNoteText}>Add note</Text>
        </Pressable>
      )}

      {!collapsed && (
        <>
          {previousData.length > 0 && (
            <Text style={styles.ghostHint}>Faded numbers are last time. Tick a set to use them.</Text>
          )}

          {/* Column headers */}
          <View style={styles.columnHeaders}>
            <Text style={[styles.colHeader, { width: 30 }]} numberOfLines={1}>SET</Text>
            <View style={{ width: 20 }} />
            <Text style={[styles.colHeader, { flex: 1 }]}>{unit.toUpperCase()}</Text>
            <View style={{ width: 12 }} />
            <Text style={[styles.colHeader, { flex: 1 }]}>REPS</Text>
            {showRPE && <Text style={[styles.colHeader, { width: 55 }]}>RPE</Text>}
            <View style={{ width: 34 }} />
            <View style={{ width: 24 }} />
          </View>

          {/* Sets */}
          {workoutExercise.sets.map((set, idx) => (
            <SetRow
              key={set.id}
              ref={setRowRefs.current[idx]}
              set={set}
              onUpdate={data => updateSet(workoutExercise.id, set.id, data)}
              onComplete={fromKeyboard => {
                completeSet(workoutExercise.id, set.id);
                if (!set.completed && !fromKeyboard) {
                  // Ticked by hand: put the keyboard away and leave it away.
                  Keyboard.dismiss();
                } else if (!set.completed) {
                  // Finished with Enter while typing: carry on to the next set.
                  if (onSetCompleted) {
                    // Let parent handle focus (supports superset navigation)
                    onSetCompleted(workoutExercise.id, idx);
                  } else {
                    // Fallback: focus next set within this card
                    const nextIdx = workoutExercise.sets.findIndex((s, i) => i > idx && !s.completed);
                    if (nextIdx >= 0) {
                      setTimeout(() => setRowRefs.current[nextIdx]?.current?.focusWeight(), 100);
                    }
                  }
                }
                // In a superset, only start rest timer on the last exercise in the group
                if (isInSuperset && workoutExercise.supersetGroupId) {
                  const groupExercises = getExercisesInSuperset(workoutExercise.supersetGroupId);
                  const lastInGroup = groupExercises[groupExercises.length - 1];
                  if (lastInGroup?.id === workoutExercise.id) {
                    startRestTimer(restSeconds);
                  }
                } else {
                  startRestTimer(restSeconds);
                }
              }}
              onRemove={() => removeSet(workoutExercise.id, set.id)}
              showRPE={showRPE}
              unit={unit}
              previousWeight={previousData[idx]?.weight}
              previousReps={previousData[idx]?.reps}
            />
          ))}

          {/* Add set button */}
          <Pressable
            onPress={() => addSet(workoutExercise.id)}
            style={styles.addSetBtn}
          >
            <Ionicons name="add" size={18} color={Colors.primary} />
            <Text style={styles.addSetText}>Add Set</Text>
          </Pressable>
        </>
      )}

      <ExercisePickerModal
        visible={showSwapPicker}
        onlyPart={targetPart}
        onClose={() => setShowSwapPicker(false)}
        onSelect={(newExercise: Exercise) => {
          replaceExercise(workoutExercise.id, newExercise);
          setShowSwapPicker(false);
        }}
      />
    </View>
  );
});

const styles = StyleSheet.create({
  container: {
    backgroundColor: Colors.bgCard,
    borderRadius: BorderRadius.lg,
    borderWidth: 1,
    borderColor: Colors.border,
    overflow: 'hidden',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: Spacing.md,
  },
  headerLeft: {
    flex: 1,
    gap: Spacing.xs,
  },
  headerRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  nameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  exerciseName: {
    color: Colors.text,
    fontSize: FontSize.lg,
    fontWeight: '700',
  },
  targetLabel: {
    color: Colors.text,
    fontSize: FontSize.xs,
    fontWeight: '700',
  },
  badges: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  meta: {
    color: Colors.textSecondary,
    fontSize: FontSize.xs,
    fontWeight: '600',
  },
  volume: {
    color: Colors.accent,
    fontSize: FontSize.xs,
    fontWeight: '700',
  },
  removeBtn: {
    padding: 2,
  },
  ghostHint: {
    color: Colors.textSecondary,
    fontSize: FontSize.xs,
    paddingHorizontal: Spacing.md,
    paddingBottom: Spacing.xs,
  },
  columnHeaders: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    paddingHorizontal: Spacing.sm,
    paddingBottom: Spacing.xs,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  colHeader: {
    color: Colors.textTertiary,
    fontSize: FontSize.xs,
    fontWeight: '700',
    textAlign: 'center',
    letterSpacing: 0.5,
  },
  stickyNote: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: Spacing.sm,
    marginHorizontal: Spacing.md,
    marginBottom: Spacing.sm,
    padding: Spacing.sm,
    backgroundColor: Colors.warning + '15',
    borderRadius: BorderRadius.sm,
    borderLeftWidth: 3,
    borderLeftColor: Colors.warning,
  },
  stickyNoteText: {
    flex: 1,
    color: Colors.warning,
    fontSize: FontSize.sm,
    fontWeight: '500',
    fontStyle: 'italic',
  },
  stickyNoteEdit: {
    marginHorizontal: Spacing.md,
    marginBottom: Spacing.sm,
    gap: Spacing.sm,
  },
  stickyNoteInput: {
    backgroundColor: Colors.bgInput,
    borderRadius: BorderRadius.sm,
    padding: Spacing.sm,
    color: Colors.text,
    fontSize: FontSize.sm,
    borderWidth: 1,
    borderColor: Colors.warning + '66',
    minHeight: 40,
  },
  stickyNoteButtons: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: Spacing.sm,
  },
  noteBtn: {
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.xs,
  },
  noteBtnCancel: {
    color: Colors.textSecondary,
    fontSize: FontSize.sm,
    fontWeight: '600',
  },
  noteBtnSave: {
    color: Colors.accent,
    fontSize: FontSize.sm,
    fontWeight: '700',
  },
  addNoteBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
    marginHorizontal: Spacing.md,
    marginBottom: Spacing.sm,
    paddingVertical: Spacing.xs,
  },
  addNoteText: {
    color: Colors.textTertiary,
    fontSize: FontSize.xs,
    fontWeight: '600',
  },
  restRow: {
    paddingHorizontal: Spacing.md,
    paddingBottom: Spacing.xs,
    gap: Spacing.xs,
  },
  restBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
    paddingVertical: Spacing.xs,
  },
  restText: {
    color: Colors.textSecondary,
    fontSize: FontSize.xs,
    fontWeight: '600',
  },
  restEdit: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.xs,
    alignItems: 'center',
  },
  restChip: {
    paddingHorizontal: Spacing.sm + 2,
    paddingVertical: Spacing.xs,
    borderRadius: BorderRadius.sm,
    backgroundColor: Colors.bgInput,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  restChipActive: {
    borderColor: Colors.text,
    backgroundColor: Colors.bgElevated,
  },
  restChipText: {
    color: Colors.textSecondary,
    fontSize: FontSize.xs,
    fontWeight: '600',
  },
  restChipTextActive: {
    color: Colors.text,
  },
  restInput: {
    backgroundColor: Colors.bgInput,
    borderRadius: BorderRadius.sm,
    paddingHorizontal: Spacing.sm,
    paddingVertical: Spacing.xs,
    color: Colors.text,
    fontSize: FontSize.xs,
    fontWeight: '600',
    textAlign: 'center',
    width: 50,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  addSetBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.xs,
    paddingVertical: Spacing.sm + 2,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
  },
  addSetText: {
    color: Colors.primary,
    fontSize: FontSize.sm,
    fontWeight: '700',
  },
});
