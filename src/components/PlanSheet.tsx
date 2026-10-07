import React, { useEffect, useState } from 'react';
import { Modal, View, Text, Pressable, ScrollView, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors, Spacing, FontSize, BorderRadius } from '../theme/colors';
import { WorkoutTemplate } from '../types';
import { DAY_NAMES } from '../utils/plan';

interface Props {
  date: Date | null;
  templates: WorkoutTemplate[];
  /** What this date shows now. */
  current: WorkoutTemplate | null;
  /** True when this date has its own one-off choice, not the weekly one. */
  isOnce: boolean;
  /** What the weekly pattern puts on this weekday. */
  weekly: WorkoutTemplate | null;
  onClose: () => void;
  /** template null = nothing planned. */
  onSet: (template: WorkoutTemplate | null, everyWeek: boolean) => void;
  onBackToWeekly: () => void;
}

/**
 * Tap a day, then: choose "This date" or "Every Monday" at the top, and tap
 * a workout (or Nothing) once. Nothing is how a day gets cleared.
 */
export function PlanSheet({ date, templates, current, isOnce, weekly, onClose, onSet, onBackToWeekly }: Props) {
  const [everyWeek, setEveryWeek] = useState(false);
  useEffect(() => { setEveryWeek(false); }, [date?.getTime()]);
  if (!date) return null;

  const weekday = DAY_NAMES[date.getDay()];
  const label = date.toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long' });
  const status = current
    ? `${current.name} · ${isOnce ? 'this date only' : `every ${weekday}`}`
    : isOnce ? 'Nothing, this date only' : 'Nothing planned';
  // Which row to tick depends on the mode: this date's plan, or the weekly one.
  const ticked = everyWeek ? weekly : current;

  return (
    <Modal visible transparent animationType="none" onRequestClose={onClose}>
      <Pressable style={styles.scrim} onPress={onClose}>
        <Pressable style={styles.sheet} onPress={() => {}}>
          <View style={styles.head}>
            <View style={{ flex: 1 }}>
              <Text style={styles.title}>{label}</Text>
              <Text style={styles.sub}>{status}</Text>
            </View>
            <Pressable onPress={onClose} hitSlop={10}><Text style={styles.close}>Close</Text></Pressable>
          </View>

          <View style={styles.toggle}>
            <Pressable onPress={() => setEveryWeek(false)} style={[styles.seg, !everyWeek && styles.segOn]}>
              <Text style={[styles.segText, !everyWeek && styles.segTextOn]}>This date</Text>
            </Pressable>
            <Pressable onPress={() => setEveryWeek(true)} style={[styles.seg, everyWeek && styles.segOn]}>
              <Text style={[styles.segText, everyWeek && styles.segTextOn]}>Every {weekday}</Text>
            </Pressable>
          </View>

          <ScrollView style={{ maxHeight: 380 }}>
            {templates.map(t => {
              const on = ticked?.id === t.id;
              return (
                <Pressable key={t.id} onPress={() => onSet(t, everyWeek)} style={({ pressed }) => [styles.row, pressed && { opacity: 0.6 }]}>
                  <Text style={[styles.name, on && styles.nameOn]} numberOfLines={1}>{t.name}</Text>
                  {on && <Ionicons name="checkmark" size={20} color={Colors.text} />}
                </Pressable>
              );
            })}
            <Pressable onPress={() => onSet(null, everyWeek)} style={({ pressed }) => [styles.row, pressed && { opacity: 0.6 }]}>
              <Text style={[styles.name, !ticked && styles.nameOn]}>Nothing (rest day)</Text>
              {!ticked && <Ionicons name="checkmark" size={20} color={Colors.text} />}
            </Pressable>
          </ScrollView>

          {isOnce && (
            <Pressable onPress={onBackToWeekly} style={styles.undo}>
              <Text style={styles.undoText}>
                Back to the weekly plan{weekly ? ` (${weekly.name})` : ' (nothing)'}
              </Text>
            </Pressable>
          )}

          <Text style={styles.hint}>
            {everyWeek
              ? `Your choice repeats every ${weekday}.`
              : 'Your choice is for this date only.'}
          </Text>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  scrim: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'flex-end' },
  sheet: {
    backgroundColor: Colors.bgCard,
    borderTopLeftRadius: BorderRadius.xl,
    borderTopRightRadius: BorderRadius.xl,
    borderTopWidth: 1,
    borderColor: Colors.border,
    paddingHorizontal: Spacing.md,
    paddingTop: Spacing.md,
    paddingBottom: Spacing.xl,
  },
  head: { flexDirection: 'row', alignItems: 'flex-start', marginBottom: Spacing.md },
  title: { color: Colors.text, fontSize: FontSize.lg, fontWeight: '700' },
  sub: { color: Colors.textSecondary, fontSize: FontSize.sm, marginTop: 2 },
  close: { color: Colors.textSecondary, fontSize: FontSize.md, paddingTop: 2 },
  toggle: {
    flexDirection: 'row',
    borderWidth: 1,
    borderColor: Colors.borderLight,
    borderRadius: BorderRadius.md,
    overflow: 'hidden',
    marginBottom: Spacing.sm,
  },
  seg: { flex: 1, paddingVertical: Spacing.sm + 2, alignItems: 'center' },
  segOn: { backgroundColor: Colors.primary },
  segText: { color: Colors.text, fontSize: FontSize.sm, fontWeight: '600' },
  segTextOn: { color: Colors.textInverse, fontWeight: '700' },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    paddingVertical: Spacing.md,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
  },
  name: { flex: 1, color: Colors.text, fontSize: FontSize.md, fontWeight: '500' },
  nameOn: { fontWeight: '800' },
  undo: {
    marginTop: Spacing.sm,
    paddingVertical: Spacing.sm + 2,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    borderColor: Colors.borderLight,
    alignItems: 'center',
  },
  undoText: { color: Colors.text, fontSize: FontSize.sm, fontWeight: '600' },
  hint: { color: Colors.textSecondary, fontSize: FontSize.xs, marginTop: Spacing.md },
});
