import React from 'react';
import { Modal, View, Text, Pressable, ScrollView, StyleSheet } from 'react-native';
import { Colors, Spacing, FontSize, BorderRadius } from '../theme/colors';
import { WorkoutTemplate } from '../types';
import { DAY_NAMES } from '../utils/plan';

interface Props {
  date: Date | null;
  templates: WorkoutTemplate[];
  current: WorkoutTemplate | null;
  onClose: () => void;
  /** Pick a template for this date only, or for every week on this weekday. */
  onPick: (template: WorkoutTemplate, everyWeek: boolean) => void;
  onRest: (everyWeek: boolean) => void;
}

/**
 * Tap a day, choose a workout for it. Two columns of buttons: "Just this
 * Monday" changes one date; "Every Monday" changes the weekly pattern.
 */
export function PlanSheet({ date, templates, current, onClose, onPick, onRest }: Props) {
  if (!date) return null;
  const weekday = DAY_NAMES[date.getDay()];
  const label = date.toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long' });
  return (
    <Modal visible transparent animationType="none" onRequestClose={onClose}>
      <Pressable style={styles.scrim} onPress={onClose}>
        <Pressable style={styles.sheet} onPress={() => {}}>
          <View style={styles.head}>
            <View style={{ flex: 1 }}>
              <Text style={styles.title}>{label}</Text>
              <Text style={styles.sub}>{current ? `Planned: ${current.name}` : 'Rest day'}</Text>
            </View>
            <Pressable onPress={onClose} hitSlop={10}><Text style={styles.close}>Close</Text></Pressable>
          </View>
          <View style={styles.legend}>
            <Text style={[styles.legendText, { flex: 1 }]} />
            <Text style={styles.legendText}>This date</Text>
            <Text style={styles.legendText}>Every {weekday}</Text>
          </View>
          <ScrollView style={{ maxHeight: 400 }}>
            {templates.map(t => (
              <View key={t.id} style={styles.row}>
                <Text style={[styles.name, current?.id === t.id && styles.nameOn]} numberOfLines={1}>{t.name}</Text>
                <Pressable onPress={() => onPick(t, false)} style={styles.btn}><Text style={styles.btnText}>Once</Text></Pressable>
                <Pressable onPress={() => onPick(t, true)} style={[styles.btn, styles.btnStrong]}><Text style={[styles.btnText, styles.btnTextStrong]}>Weekly</Text></Pressable>
              </View>
            ))}
            <View style={styles.row}>
              <Text style={styles.name}>Rest</Text>
              <Pressable onPress={() => onRest(false)} style={styles.btn}><Text style={styles.btnText}>Once</Text></Pressable>
              <Pressable onPress={() => onRest(true)} style={[styles.btn, styles.btnStrong]}><Text style={[styles.btnText, styles.btnTextStrong]}>Weekly</Text></Pressable>
            </View>
          </ScrollView>
          <Text style={styles.hint}>Weekly sets the pattern for every {weekday}. Once changes only this date.</Text>
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
  head: { flexDirection: 'row', alignItems: 'flex-start', marginBottom: Spacing.sm },
  title: { color: Colors.text, fontSize: FontSize.lg, fontWeight: '700' },
  sub: { color: Colors.textSecondary, fontSize: FontSize.sm, marginTop: 2 },
  close: { color: Colors.textSecondary, fontSize: FontSize.md, paddingTop: 2 },
  legend: { flexDirection: 'row', gap: Spacing.sm, paddingBottom: 4 },
  legendText: { color: Colors.textSecondary, fontSize: FontSize.xs, width: 76, textAlign: 'center' },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    paddingVertical: Spacing.sm + 2,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
  },
  name: { flex: 1, color: Colors.text, fontSize: FontSize.md, fontWeight: '500' },
  nameOn: { fontWeight: '700', textDecorationLine: 'underline' },
  btn: {
    width: 76,
    paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    borderColor: Colors.borderLight,
    alignItems: 'center',
  },
  btnStrong: { backgroundColor: Colors.primary, borderColor: Colors.primary },
  btnText: { color: Colors.text, fontSize: FontSize.sm, fontWeight: '600' },
  btnTextStrong: { color: Colors.textInverse },
  hint: { color: Colors.textSecondary, fontSize: FontSize.xs, marginTop: Spacing.md },
});
