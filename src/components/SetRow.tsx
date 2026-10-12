import React, { useState, useEffect, useRef, useImperativeHandle, forwardRef } from 'react';
import { View, Text, TextInput, StyleSheet, Pressable, Alert } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { WorkoutSet } from '../types';
import { Colors, BorderRadius, Spacing, FontSize } from '../theme/colors';
import { usePad } from './NumPad';

interface SetRowProps {
  set: WorkoutSet;
  onUpdate: (data: Partial<WorkoutSet>) => void;
  onComplete: () => void;
  onRemove: () => void;
  showRPE?: boolean;
  unit: string;
  previousWeight?: number;
  previousReps?: number;
  /** For the pad's title, e.g. "Bench Press". */
  exerciseName?: string;
}

export interface SetRowRef {
  focusWeight: () => void;
}

export const SetRow = forwardRef<SetRowRef, SetRowProps>(function SetRow(props, ref) {
  const { set, onUpdate, onRemove, showRPE, unit, previousWeight, previousReps } = props;
  const pad = usePad();
  const rowRef = useRef<View>(null);
  const [rpeText, setRpeText] = useState(set.rpe ? String(set.rpe) : '');
  useEffect(() => { setRpeText(set.rpe ? String(set.rpe) : ''); }, [set.rpe]);

  // The pad's callbacks outlive this render; read the newest props through a ref.
  const latest = useRef(props);
  latest.current = props;

  const weightKey = `${set.id}:weight`;
  const repsKey = `${set.id}:reps`;

  // Ticking an empty set uses last time's numbers, so a repeat set needs no typing.
  const complete = (fromPad?: boolean) => {
    const p = latest.current;
    // Done on the pad with no reps and nothing from last time: ask for reps, don't log a blank set.
    if (fromPad && !p.set.completed && !p.set.reps && !p.previousReps) {
      openField('reps');
      return;
    }
    if (!p.set.completed) {
      const patch: Partial<WorkoutSet> = {};
      if (!p.set.weight && p.previousWeight !== undefined && p.previousWeight !== 0) patch.weight = p.previousWeight;
      if (!p.set.reps && p.previousReps) patch.reps = p.previousReps;
      if (Object.keys(patch).length > 0) p.onUpdate(patch);
    }
    p.onComplete();
  };

  const openField = (kind: 'weight' | 'reps') => {
    if (!pad) return;
    const p = latest.current;
    const label = p.set.isWarmup ? 'Warm-up' : `Set ${p.set.setNumber}`;
    pad.open({
      key: kind === 'weight' ? weightKey : repsKey,
      title: `${p.exerciseName ? p.exerciseName + ' · ' : ''}${label} · ${kind === 'weight' ? p.unit : 'reps'}`,
      kind,
      unit: p.unit,
      value: kind === 'weight' ? p.set.weight : p.set.reps,
      ghost: kind === 'weight' ? p.previousWeight : p.previousReps,
      onInput: v => latest.current.onUpdate(kind === 'weight' ? { weight: v } : { reps: v }),
      onNext: () => (kind === 'weight' ? openField('reps') : complete(true)),
      onDone: () => complete(true),
    });
    // Once the pad is up and the list has shrunk, bring this row into view above it.
    const reveal = () => rowRef.current?.measureInWindow((_x, y, _w, h) => pad.ensureVisible(y, y + h));
    setTimeout(reveal, 80);
    setTimeout(reveal, 250);
  };

  useImperativeHandle(ref, () => ({
    focusWeight: () => openField('weight'),
  }));

  const field = (kind: 'weight' | 'reps') => {
    const key = kind === 'weight' ? weightKey : repsKey;
    const active = pad?.activeKey === key;
    const stored = kind === 'weight' ? set.weight : set.reps;
    const ghost = kind === 'weight' ? previousWeight : previousReps;
    const text = active ? pad!.buffer : stored ? String(stored) : '';
    const showGhost = text === '';
    return (
      <Pressable
        onPress={() => openField(kind)}
        style={[styles.input, showGhost && styles.inputGhost, active && styles.inputActive]}
      >
        <Text style={showGhost ? styles.ghostText : styles.valueText} numberOfLines={1}>
          {showGhost ? (ghost ? String(ghost) : kind === 'weight' ? unit : 'reps') : text}
        </Text>
      </Pressable>
    );
  };

  return (
    <View ref={rowRef} collapsable={false} style={[styles.row, set.completed && styles.completedRow]}>
      {/* Tap: warm-up on/off. Hold: delete. Keeps the bin away from the tick. */}
      <Pressable
        onPress={() => onUpdate({ isWarmup: !set.isWarmup })}
        onLongPress={() =>
          Alert.alert(`Delete ${set.isWarmup ? 'warm-up set' : `set ${set.setNumber}`}?`, undefined, [
            { text: 'Cancel', style: 'cancel' },
            { text: 'Delete', style: 'destructive', onPress: onRemove },
          ])
        }
        hitSlop={6}
        style={[styles.setNum, set.isWarmup && styles.setNumWarmup]}
      >
        <Text style={[styles.setNumText, set.isWarmup && styles.warmupText]}>
          {set.isWarmup ? 'W' : set.setNumber}
        </Text>
      </Pressable>

      {field('weight')}
      <Text style={styles.x}>×</Text>
      {field('reps')}

      {showRPE && (
        <TextInput
          style={[styles.input, styles.rpeInput, styles.valueText]}
          value={rpeText}
          onChangeText={t => {
            const cleaned = t.replace(/[^0-9.]/g, '');
            setRpeText(cleaned);
            const v = parseFloat(cleaned);
            if (v >= 1 && v <= 10) onUpdate({ rpe: v });
            else if (!cleaned) onUpdate({ rpe: undefined });
          }}
          placeholder="RPE"
          placeholderTextColor={GHOST}
          keyboardType="numeric"
          selectTextOnFocus
        />
      )}

      <Pressable onPress={() => complete(false)} hitSlop={10} style={styles.checkBtn}>
        <Ionicons
          name={set.completed ? 'checkmark-circle' : 'checkmark-circle-outline'}
          size={34}
          color={set.completed ? Colors.accent : Colors.textSecondary}
        />
      </Pressable>
    </View>
  );
});

/** Last time's numbers: dimmer and italic in a dashed box, so they never read as typed. Darker greys break up on e-ink. */
const GHOST = '#888888';

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
    width: 34,
    height: 34,
    borderRadius: BorderRadius.sm,
    borderWidth: 1,
    borderColor: Colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  setNumWarmup: {
    borderColor: Colors.warning,
  },
  setNumText: {
    color: Colors.text,
    fontSize: FontSize.md,
    fontWeight: '800',
  },
  warmupText: {
    color: Colors.warning,
  },
  input: {
    flex: 1,
    backgroundColor: Colors.bgInput,
    borderRadius: BorderRadius.sm,
    height: 46,
    paddingHorizontal: Spacing.sm,
    borderWidth: 1.5,
    borderColor: Colors.borderLight,
    minWidth: 60,
    alignItems: 'center',
    justifyContent: 'center',
  },
  inputGhost: {
    borderStyle: 'dashed',
    borderColor: Colors.border,
  },
  inputActive: {
    borderStyle: 'solid',
    borderColor: Colors.text,
    borderWidth: 2.5,
  },
  valueText: {
    color: Colors.text,
    fontSize: FontSize.lg,
    fontWeight: '800',
    textAlign: 'center',
  },
  ghostText: {
    color: GHOST,
    fontSize: FontSize.md,
    fontWeight: '600',
    fontStyle: 'italic',
    textAlign: 'center',
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
});
