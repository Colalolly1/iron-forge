import React from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors, Spacing, FontSize, BorderRadius } from '../theme/colors';
import { Workout, WorkoutTemplate } from '../types';
import { DAY_LETTERS, PlanOverrides, planFor, weekDates, workoutsOn, sameDay } from '../utils/plan';

interface Props {
  templates: WorkoutTemplate[];
  workouts: Workout[];
  overrides: PlanOverrides;
  startOfWeek: 0 | 1;
  onStart: (template: WorkoutTemplate) => void;
  onPickDay: (date: Date) => void;
}

/**
 * The week as seven tappable days. Hollow = planned, filled = done, a ring
 * marks today. Tap any day to decide what it's for; tap Start for today's.
 */
export function WeekStrip({ templates, workouts, overrides, startOfWeek, onStart, onPickDay }: Props) {
  const today = new Date();
  const days = weekDates(startOfWeek, today);
  const anyPlan = templates.some(t => (t.days ?? []).length > 0) || Object.keys(overrides).length > 0;
  const todaysPlan = planFor(today, templates, overrides);
  const doneToday = workoutsOn(workouts, today);

  return (
    <View style={styles.wrap}>
      <View style={styles.row}>
        {days.map(d => {
          const isToday = sameDay(d, today);
          const planned = planFor(d, templates, overrides);
          const done = workoutsOn(workouts, d).length > 0;
          const past = d < today && !isToday;
          return (
            <Pressable key={d.toISOString()} onPress={() => onPickDay(d)} style={({ pressed }) => [styles.cell, pressed && { opacity: 0.6 }]} hitSlop={6}>
              <Text style={[styles.letter, isToday && styles.letterToday]}>{DAY_LETTERS[d.getDay()]}</Text>
              <View style={[styles.ring, isToday && styles.ringToday]}>
                {done ? (
                  <View style={styles.dotDone}><Ionicons name="checkmark" size={14} color={Colors.textInverse} /></View>
                ) : planned ? (
                  <View style={[styles.dotPlanned, past && styles.dotMissed]} />
                ) : (
                  <View style={styles.dotRest} />
                )}
              </View>
              <Text style={styles.cellName} numberOfLines={1}>{planned ? shortName(planned.name) : ''}</Text>
            </Pressable>
          );
        })}
      </View>

      <View style={styles.todayRow}>
        {doneToday.length > 0 ? (
          <Text style={styles.todayText}>Today · {doneToday[0].name} <Text style={styles.todayDone}>done</Text></Text>
        ) : todaysPlan ? (
          <>
            <Text style={styles.todayText} numberOfLines={1}>Today · {todaysPlan.name}</Text>
            <Pressable onPress={() => onStart(todaysPlan)} style={({ pressed }) => [styles.startPill, pressed && { opacity: 0.8 }]}>
              <Text style={styles.startPillText}>Start</Text>
            </Pressable>
          </>
        ) : anyPlan ? (
          <Text style={styles.todayText}>Rest day</Text>
        ) : (
          <Text style={styles.todayHint}>Tap a day to plan it</Text>
        )}
      </View>
    </View>
  );
}

/** "Upper 1 — Bench" → "Upper 1", short enough for a 40px column. */
function shortName(name: string): string {
  const head = name.split(/[—–\-:(]/)[0].trim();
  return head.length > 7 ? head.slice(0, 6) + '…' : head;
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
  cell: { alignItems: 'center', gap: 5, width: 42 },
  letter: { color: Colors.textSecondary, fontSize: FontSize.xs, fontWeight: '600' },
  letterToday: { color: Colors.text },
  cellName: { color: Colors.textSecondary, fontSize: 10, height: 12 },
  ring: { width: 32, height: 32, borderRadius: 16, alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderColor: 'transparent' },
  ringToday: { borderColor: Colors.textSecondary },
  dotDone: { width: 22, height: 22, borderRadius: 11, backgroundColor: Colors.primary, alignItems: 'center', justifyContent: 'center' },
  dotPlanned: { width: 22, height: 22, borderRadius: 11, borderWidth: 1.5, borderColor: Colors.primary },
  dotMissed: { borderColor: Colors.textSecondary, borderStyle: 'dashed' },
  dotRest: { width: 5, height: 5, borderRadius: 3, backgroundColor: Colors.textSecondary },
  todayRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: Spacing.md, borderTopWidth: 1, borderTopColor: Colors.border, paddingTop: Spacing.md },
  todayText: { flex: 1, color: Colors.text, fontSize: FontSize.md, fontWeight: '500' },
  todayDone: { color: Colors.textSecondary },
  todayHint: { flex: 1, color: Colors.textSecondary, fontSize: FontSize.sm },
  startPill: { backgroundColor: Colors.primary, paddingHorizontal: Spacing.md, paddingVertical: Spacing.sm, borderRadius: BorderRadius.md },
  startPillText: { color: Colors.textInverse, fontWeight: '700', fontSize: FontSize.sm },
});
