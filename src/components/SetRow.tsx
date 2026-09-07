import React, { useState, useEffect, useRef, useImperativeHandle, forwardRef } from 'react';
import { View, Text, TextInput, StyleSheet, Pressable } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { WorkoutSet } from '../types';
import { Colors, BorderRadius, Spacing, FontSize } from '../theme/colors';

interface SetRowProps {
  set: WorkoutSet;
  onUpdate: (data: Partial<WorkoutSet>) => void;
  onComplete: () => void;
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
        style={styles.input}
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
        placeholderTextColor={previousWeight ? Colors.textSecondary : Colors.textTertiary}
        keyboardType="numbers-and-punctuation"
        selectTextOnFocus
      />

      <Text style={styles.x}>×</Text>

      <TextInput
        style={styles.input}
        value={repsText}
        onChangeText={t => {
          const cleaned = t.replace(/[^0-9]/g, '');
          setRepsText(cleaned);
          onUpdate({ reps: parseInt(cleaned) || 0 });
        }}
        placeholder={previousReps ? String(previousReps) : 'reps'}
        placeholderTextColor={previousReps ? Colors.textSecondary : Colors.textTertiary}
        keyboardType="numeric"
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
        onPress={onComplete}
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
    width: 24,
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
