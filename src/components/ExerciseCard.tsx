import React, { useState, useEffect, useRef, createRef, useImperativeHandle } from 'react';
import { View, Text, StyleSheet, Pressable, TextInput, Alert, Keyboard } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { WorkoutExercise, WorkoutSet, Exercise, BodyPart } from '../types';
import { SetRow, SetRowRef } from './SetRow';
import { usePad } from './NumPad';
import { ExercisePickerModal } from './ExercisePickerModal';
import { useWorkout } from '../context/WorkoutContext';
import { getExerciseNote, saveExerciseNote, getPreviousExerciseData, PreviousSetData, getExerciseRestTimer, saveExerciseRestTimer } from '../utils/storage';
import { Colors, BorderRadius, Spacing, FontSize } from '../theme/colors';

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
  const [editing, setEditing] = useState(false);
  const [stickyNote, setStickyNote] = useState('');
  const [editingNote, setEditingNote] = useState(false);
  const [noteInput, setNoteInput] = useState('');
  const [previousData, setPreviousData] = useState<PreviousSetData[]>([]);
  const [restSeconds, setRestSeconds] = useState(90);
  const [editingRest, setEditingRest] = useState(false);
  const [restInput, setRestInput] = useState('90');

  const exercise = workoutExercise.exercise;
  const pad = usePad();

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

  return (
    <View style={styles.container}>
      {/* Header: tap to fold away; Edit holds everything that changes the exercise */}
      <Pressable onPress={() => setCollapsed(!collapsed)} style={styles.header}>
        <View style={styles.headerLeft}>
          <Text style={styles.exerciseName}>{exercise.name}</Text>
          {targetLabel ? <Text style={styles.targetLabel}>{targetLabel}</Text> : null}
          <Text style={styles.meta}>
            {completedSets.length}/{workoutExercise.sets.length} sets{collapsed ? ' · folded, tap to open' : ''}
          </Text>
        </View>
        <Pressable onPress={() => { setEditing(!editing); setEditingRest(false); }} hitSlop={8} style={styles.editBtn}>
          <Text style={styles.editText}>{editing ? 'Done' : 'Edit'}</Text>
        </Pressable>
      </Pressable>

      {editing && (
        <View style={styles.editRow}>
          <EditAction
            label="History"
            onPress={() => navigation.navigate('ExerciseHistory', {
              exerciseId: exercise.id,
              exerciseName: exercise.name,
            })}
          />
          {onMoveUp !== undefined && <EditAction label="Move up" onPress={onMoveUp} />}
          {onMoveDown !== undefined && <EditAction label="Move down" onPress={onMoveDown} />}
          <EditAction label="Swap" onPress={() => setShowSwapPicker(true)} />
          <EditAction
            label={`Rest ${restSeconds}s`}
            active={editingRest}
            onPress={() => { setRestInput(String(restSeconds)); setEditingRest(!editingRest); }}
          />
          {!stickyNote && !editingNote && (
            <EditAction label="Add note" onPress={() => { setNoteInput(''); setEditingNote(true); }} />
          )}
          <EditAction
            label="Remove"
            danger
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
          />
        </View>
      )}

      {/* Per-exercise rest timer */}
      {editing && editingRest && (
        <View style={styles.restRow}>
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

      {editingNote && (
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

      {!collapsed && (
        <>
          {/* Column headers */}
          <View style={styles.columnHeaders}>
            <Text style={[styles.colHeader, { width: 34 }]} numberOfLines={1}>SET</Text>
            <Text style={[styles.colHeader, { flex: 1 }]}>{unit.toUpperCase()}</Text>
            <View style={{ width: 12 }} />
            <Text style={[styles.colHeader, { flex: 1 }]}>REPS</Text>
            {showRPE && <Text style={[styles.colHeader, { width: 55 }]}>RPE</Text>}
            <View style={{ width: 38 }} />
          </View>

          {/* Sets */}
          {workoutExercise.sets.map((set, idx) => (
            <SetRow
              key={set.id}
              ref={setRowRefs.current[idx]}
              set={set}
              onUpdate={data => updateSet(workoutExercise.id, set.id, data)}
              onComplete={() => {
                completeSet(workoutExercise.id, set.id);
                Keyboard.dismiss();
                // Unticking a set stays put and leaves the rest timer alone.
                if (set.completed) return;
                // Ticked, by hand or with the pad's Done: carry on to the next set.
                if (onSetCompleted) {
                  // Let parent handle focus (supports superset navigation)
                  onSetCompleted(workoutExercise.id, idx);
                } else {
                  // Fallback: focus next set within this card
                  const nextIdx = workoutExercise.sets.findIndex((s, i) => i > idx && !s.completed);
                  if (nextIdx >= 0) {
                    setTimeout(() => setRowRefs.current[nextIdx]?.current?.focusWeight(), 100);
                  } else {
                    pad?.close();
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
              exerciseName={exercise.name}
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

/** One word button in the Edit row. */
function EditAction({ label, onPress, danger, active }: { label: string; onPress: () => void; danger?: boolean; active?: boolean }) {
  return (
    <Pressable onPress={onPress} hitSlop={4} style={[styles.editAction, active && styles.editActionActive]}>
      <Text style={[styles.editActionText, danger && styles.editActionDanger]}>{label}</Text>
    </Pressable>
  );
}

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
  editBtn: {
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    borderColor: Colors.borderLight,
  },
  editText: {
    color: Colors.text,
    fontSize: FontSize.sm,
    fontWeight: '700',
  },
  editRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.xs,
    paddingHorizontal: Spacing.md,
    paddingBottom: Spacing.sm,
  },
  editAction: {
    paddingHorizontal: Spacing.sm + 2,
    paddingVertical: Spacing.xs + 2,
    borderRadius: BorderRadius.sm,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  editActionActive: {
    borderColor: Colors.text,
  },
  editActionText: {
    color: Colors.text,
    fontSize: FontSize.sm,
    fontWeight: '600',
  },
  editActionDanger: {
    color: Colors.danger,
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
  meta: {
    color: Colors.textSecondary,
    fontSize: FontSize.xs,
    fontWeight: '600',
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
  restRow: {
    paddingHorizontal: Spacing.md,
    paddingBottom: Spacing.xs,
    gap: Spacing.xs,
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
