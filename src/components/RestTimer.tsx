import React from 'react';
import { View, Text, StyleSheet, Pressable } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useWorkout } from '../context/WorkoutContext';
import { formatTimer } from '../utils/helpers';
import { Colors, BorderRadius, Spacing, FontSize } from '../theme/colors';

export function RestTimerBar() {
  const { restTimer, isRestTimerRunning, stopRestTimer, startRestTimer } = useWorkout();

  if (!isRestTimerRunning && restTimer === 0) return null;

  const progress = restTimer > 0 ? 1 : 0;

  return (
    <View style={styles.container}>
      <View style={styles.content}>
        <Ionicons name="timer-outline" size={20} color={Colors.primary} />
        <Text style={styles.label}>Rest</Text>
        <Text style={styles.time}>{formatTimer(restTimer)}</Text>

        <View style={styles.actions}>
          <Pressable
            onPress={() => startRestTimer(30)}
            style={styles.quickBtn}
          >
            <Text style={styles.quickText}>+30s</Text>
          </Pressable>
          <Pressable
            onPress={() => startRestTimer(60)}
            style={styles.quickBtn}
          >
            <Text style={styles.quickText}>1:00</Text>
          </Pressable>
          <Pressable
            onPress={() => startRestTimer(90)}
            style={styles.quickBtn}
          >
            <Text style={styles.quickText}>1:30</Text>
          </Pressable>

          <Pressable onPress={stopRestTimer} style={styles.stopBtn}>
            <Ionicons name="close" size={18} color={Colors.danger} />
          </Pressable>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: Colors.bgElevated,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm + 2,
  },
  content: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  label: {
    color: Colors.textSecondary,
    fontSize: FontSize.sm,
    fontWeight: '600',
  },
  time: {
    color: Colors.primary,
    fontSize: FontSize.xl,
    fontWeight: '800',
    fontVariant: ['tabular-nums'],
    minWidth: 50,
  },
  actions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
    marginLeft: 'auto',
  },
  quickBtn: {
    backgroundColor: Colors.primaryMuted,
    paddingHorizontal: Spacing.sm + 2,
    paddingVertical: Spacing.xs,
    borderRadius: BorderRadius.sm,
  },
  quickText: {
    color: Colors.primary,
    fontSize: FontSize.xs,
    fontWeight: '700',
  },
  stopBtn: {
    padding: Spacing.xs,
  },
});
