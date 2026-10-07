import React, { useState, useEffect, useRef, useImperativeHandle, forwardRef } from 'react';
import { View, Text, TextInput, StyleSheet, Pressable } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { WorkoutSet } from '../types';
import { Colors, BorderRadius, Spacing, FontSize } from '../theme/colors';

interface SetRowProps {
  set: WorkoutSet;
  onUpdate: (data: Partial<WorkoutSet>) => void;
  /** fromKeyboard: the set was finished with Enter on the keyboard, so typing can carry on. */
  onComplete: (fromKeyboard?: boolean) => void;
  onRemove: () => void;
  showRPE?: boolean;
  unit: string;
  previousWeight?: number;
  previousReps?: number;
}

export interface SetRowRef {
  focusWeight: () => void;
}

export const SetRow = forwardRef<SetRowRef, SetRowProps>(function SetRow(
  { set, onUpdate, onComplete, onRemove, showRPE, unit, previousWeight, previousReps },
  ref
) {
  const weightRef = useRef<TextInput>(null);
  const repsRef = useRef<TextInput>(null);
  const [weightText, setWeightText] = useState(set.weight > 0 ? String(set.weight) : '');
  const [repsText, setRepsText] = useState(set.reps > 0 ? String(set.reps) : '');
  const [rpeText, setRpeText] = useState(set.rpe ? String(set.rpe) : '');

  useImperativeHandle(ref, () => ({
    focusWeight: () => {
      weightRef.current?.focus();
    },
  }));

  useEffect(() => {
    setWeightText(set.weight > 0 ? String(set.weight) : '');
  }, [set.weight]);
  useEffect(() => {
    setRepsText(set.reps > 0 ? String(set.reps) : '');
  }, [set.reps]);
  useEffect(() => {
    setRpeText(set.rpe ? String(set.rpe) : '');
  }, [set.rpe]);

  // Ticking an empty set uses last time's numbers, so a repeat set needs no typing.
  const complete = (fromKeyboard?: boolean) => {
    if (!set.completed) {
      const patch: Partial<WorkoutSet> = {};
      if (!weightText && previousWeight !== undefined && previousWeight !== 0) patch.weight = previousWeight;
      if (!repsText && previousReps) patch.reps = previousReps;
      if (Object.keys(patch).length > 0) onUpdate(patch);
    }
    onComplete(fromKeyboard);
  };

  return (
    <View style={[styles.row, set.completed && styles.completedRow]}>
      <View style={styles.setNum}>
        <Text
          style={[
            styles.setNumText,
            set.isWarmup && styles.warmupText,
          ]}
        >
          {set.isWarmup ? 'W' : set.setNumber}
        </Text>
      </View>

      <Pressable
        onPress={() => onUpdate({ isWarmup: !set.isWarmup })}
        style={styles.warmupBtn}
      >
        <Ionicons
          name={set.isWarmup ? 'flame' : 'flame-outline'}
          size={16}
          color={set.isWarmup ? Colors.warning : Colors.textTertiary}
        />
      </Pressable>

      <TextInput
        ref={weightRef}
        style={[styles.input, !weightText && styles.inputGhost]}
        value={weightText}
        onChangeText={t => {
          // Allow optional leading minus, then digits and a single dot
          const negative = t.startsWith('-');
          const stripped = (negative ? t.slice(1) : t).replace(/[^0-9.]/g, '');
          const cleaned = (negative ? '-' : '') + stripped;
          setWeightText(cleaned);
          onUpdate({ weight: parseFloat(cleaned) || 0 });
        }}
        placeholder={previousWeight ? String(previousWeight) : unit}
        placeholderTextColor={GHOST}
        keyboardType="numeric"
        returnKeyType="next"
        blurOnSubmit={false}
        onSubmitEditing={() => repsRef.current?.focus()}
        selectTextOnFocus
      />

      <Text style={styles.x}>×</Text>

      <TextInput
        ref={repsRef}
        style={[styles.input, !repsText && styles.inputGhost]}
        value={repsText}
        onChangeText={t => {
          const cleaned = t.replace(/[^0-9]/g, '');
          setRepsText(cleaned);
          onUpdate({ reps: parseInt(cleaned) || 0 });
        }}
        placeholder={previousReps ? String(previousReps) : 'reps'}
        placeholderTextColor={GHOST}
        keyboardType="number-pad"
        returnKeyType="done"
        onSubmitEditing={() => complete(true)}
        selectTextOnFocus
      />

      {showRPE && (
        <TextInput
          style={[styles.input, styles.rpeInput]}
          value={rpeText}
          onChangeText={t => {
            const cleaned = t.replace(/[^0-9.]/g, '');
            setRpeText(cleaned);
            const v = parseFloat(cleaned);
            if (v >= 1 && v <= 10) onUpdate({ rpe: v });
            else if (!cleaned) onUpdate({ rpe: undefined });
          }}
          placeholder="RPE"
          placeholderTextColor={Colors.textTertiary}
          keyboardType="numeric"
          selectTextOnFocus
        />
      )}

      <Pressable
        onPress={() => complete(false)}
        hitSlop={8}
        style={[styles.checkBtn, set.completed && styles.checkBtnDone]}
      >
        <Ionicons
          name={set.completed ? 'checkmark-circle' : 'checkmark-circle-outline'}
          size={28}
          color={set.completed ? Colors.accent : Colors.textTertiary}
        />
      </Pressable>

      <Pressable onPress={onRemove} style={styles.deleteBtn}>
        <Ionicons name="trash-outline" size={16} color={Colors.danger} />
      </Pressable>
    </View>
  );
});

/** Last time's numbers: dim, thin and italic, so they never read as typed. */
const GHOST = '#5A5A5A';

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.sm,
    borderRadius: BorderRadius.sm,
  },
  completedRow: {
    backgroundColor: Colors.accentMuted,
  },
  setNum: {
    width: 30,
    alignItems: 'center',
  },
  setNumText: {
    color: Colors.text,
    fontSize: FontSize.md,
    fontWeight: '800',
  },
  warmupText: {
    color: Colors.warning,
  },
  warmupBtn: {
    padding: 2,
  },
  input: {
    flex: 1,
    backgroundColor: Colors.bgInput,
    borderRadius: BorderRadius.sm,
    paddingVertical: Spacing.sm + 2,
    paddingHorizontal: Spacing.sm + 2,
    color: Colors.text,
    fontSize: FontSize.lg,
    fontWeight: '800',
    textAlign: 'center',
    borderWidth: 1.5,
    borderColor: Colors.borderLight,
    minWidth: 60,
  },
  inputGhost: {
    fontWeight: '400',
    fontStyle: 'italic',
    fontSize: FontSize.md,
    borderStyle: 'dashed',
    borderColor: Colors.border,
  },
  rpeInput: {
    maxWidth: 55,
    flex: 0,
  },
  x: {
    color: Colors.textSecondary,
    fontSize: FontSize.lg,
    fontWeight: '800',
  },
  checkBtn: {
    padding: 2,
  },
  checkBtnDone: {},
  deleteBtn: {
    padding: 4,
  },
});
