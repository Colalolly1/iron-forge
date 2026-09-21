import React from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors, Spacing, FontSize, BorderRadius } from '../theme/colors';
import { Workout, WorkoutTemplate } from '../types';
import { DAY_LETTERS, plannedOn, weekDates, workoutsOn, sameDay } from '../utils/plan';

interface Props {
  templates: WorkoutTemplate[];
  workouts: Workout[];
  startOfWeek: 0 | 1;
  onStart: (template: WorkoutTemplate) => void;
  onPlan: () => void;
}

/**
 * The week as seven dots. Hollow = planned, filled = done, a ring marks today.
 * Under it, what today asks of you and one word to begin it.
 */
export function WeekStrip({ templates, workouts, startOfWeek, onStart, onPlan }: Props) {
  const today = new Date();
  const days = weekDates(startOfWeek, today);
  const hasPlan = templates.some(t => (t.days ?? []).length > 0);
  const todaysPlan = plannedOn(templates, today.getDay());
  const doneToday = workoutsOn(workouts, today);

  return (
    <View style={styles.wrap}>
      <View style={styles.row}>
        {days.map(d => {
          const isToday = sameDay(d, today);
          const planned = plannedOn(templates, d.getDay()).length > 0;
          const done = workoutsOn(workouts, d).length > 0;
          const past = d < today && !isToday;
          return (
            <View key={d.toISOString()} style={styles.cell}>
              <Text style={[styles.letter, isToday && styles.letterToday]}>{DAY_LETTERS[d.getDay()]}</Text>
              <View style={[styles.ring, isToday && styles.ringToday]}>
                {done ? (
                  <View style={styles.dotDone}>
                    <Ionicons name="checkmark" size={14} color={Colors.textInverse} />
                  </View>
                ) : planned ? (
                  <View style={[styles.dotPlanned, past && styles.dotMissed]} />
                ) : (
                  <View style={styles.dotRest} />
                )}
              </View>
            </View>
          );
        })}
      </View>

      <View style={styles.todayRow}>
        {doneToday.length > 0 ? (
          <Text style={styles.todayText}>
            Today · {doneToday[0].name} <Text style={styles.todayDone}>done</Text>
          </Text>
        ) : todaysPlan.length > 0 ? (
          <>
            <Text style={styles.todayText} numberOfLines={1}>
              Today · {todaysPlan.map(t => t.name).join(' + ')}
            </Text>
            <Pressable
              onPress={() => onStart(todaysPlan[0])}
              style={({ pressed }) => [styles.startPill, pressed && { opacity: 0.8 }]}
            >
              <Text style={styles.startPillText}>Start</Text>
            </Pressable>
          </>
        ) : hasPlan ? (
          <Text style={styles.todayText}>Rest day</Text>
        ) : (
          <Pressable onPress={onPlan} hitSlop={8}>
            <Text style={styles.planHint}>Plan your week: pick days on each template</Text>
          </Pressable>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    backgroundColor: Colors.bgCard,
    borderRadius: BorderRadius.lg,
    borderWidth: 1,
    borderColor: Colors.border,
    padding: Spacing.md,
    gap: Spacing.md,
  },
  row: { flexDirection: 'row', justifyContent: 'space-between' },
  cell: { alignItems: 'center', gap: 6, width: 36 },
  letter: { color: Colors.textSecondary, fontSize: FontSize.xs, fontWeight: '600' },
  letterToday: { color: Colors.text },
  ring: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: 'transparent',
  },
  ringToday: { borderColor: Colors.textSecondary },
  dotDone: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: Colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dotPlanned: { width: 22, height: 22, borderRadius: 11, borderWidth: 1.5, borderColor: Colors.primary },
  dotMissed: { borderColor: Colors.textTertiary, borderStyle: 'dashed' },
  dotRest: { width: 5, height: 5, borderRadius: 3, backgroundColor: Colors.textTertiary },
  todayRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: Spacing.md,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
    paddingTop: Spacing.md,
  },
  todayText: { flex: 1, color: Colors.text, fontSize: FontSize.md, fontWeight: '500' },
  todayDone: { color: Colors.textSecondary },
  startPill: {
    backgroundColor: Colors.primary,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.md,
  },
  startPillText: { color: Colors.textInverse, fontWeight: '700', fontSize: FontSize.sm },
  planHint: { color: Colors.textSecondary, fontSize: FontSize.sm, textDecorationLine: 'underline' },
});
