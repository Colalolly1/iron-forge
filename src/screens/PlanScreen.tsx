import React, { useCallback, useEffect, useState } from 'react';
import { View, Text, Pressable, StyleSheet, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { Colors, Spacing, FontSize, BorderRadius } from '../theme/colors';
import { getProfile, getTemplates, getWorkouts, getPlanOverrides, setPlanOverride, saveTemplate } from '../utils/storage';
import { Workout, WorkoutTemplate } from '../types';
import { DAY_LETTERS, PlanOverrides, REST, dateKey, monthGrid, planFor, sameDay, workoutsOn } from '../utils/plan';
import { PlanSheet } from '../components/PlanSheet';

/**
 * A month of training, planned. Each date shows what's on it and whether it
 * got done. Tap a date to set it, once or every week.
 */
export function PlanScreen({ navigation }: any) {
  const [templates, setTemplates] = useState<WorkoutTemplate[]>([]);
  const [workouts, setWorkouts] = useState<Workout[]>([]);
  const [overrides, setOverrides] = useState<PlanOverrides>({});
  const [startOfWeek, setStartOfWeek] = useState<0 | 1>(1);
  const [cursor, setCursor] = useState(() => { const d = new Date(); return new Date(d.getFullYear(), d.getMonth(), 1); });
  const [picking, setPicking] = useState<Date | null>(null);

  const load = useCallback(async () => {
    const [t, w, o, p] = await Promise.all([getTemplates(), getWorkouts(), getPlanOverrides(), getProfile()]);
    setTemplates(t); setWorkouts(w); setOverrides(o); setStartOfWeek(p.startOfWeek === 1 ? 1 : 0);
  }, []);
  useEffect(() => { load(); }, [load]);

  const today = new Date();
  const cells = monthGrid(cursor.getFullYear(), cursor.getMonth(), startOfWeek);
  const headers = Array.from({ length: 7 }, (_, i) => DAY_LETTERS[(startOfWeek + i) % 7]);
  const monthLabel = cursor.toLocaleDateString('en-GB', { month: 'long', year: 'numeric' });
  const plannedThisMonth = cells.filter(d => d.getMonth() === cursor.getMonth() && planFor(d, templates, overrides)).length;
  const doneThisMonth = cells.filter(d => d.getMonth() === cursor.getMonth() && workoutsOn(workouts, d).length > 0).length;

  const pick = async (t: WorkoutTemplate, everyWeek: boolean) => {
    if (!picking) return;
    if (everyWeek) {
      const dow = picking.getDay();
      // One template per weekday: give the day to this one, take it off the others.
      for (const other of templates) {
        const has = (other.days ?? []).includes(dow);
        if (other.id === t.id && !has) await saveTemplate({ ...other, days: [...(other.days ?? []), dow] });
        if (other.id !== t.id && has) await saveTemplate({ ...other, days: (other.days ?? []).filter(d => d !== dow) });
      }
      await setPlanOverride(dateKey(picking), null);
    } else {
      await setPlanOverride(dateKey(picking), t.id);
    }
    setPicking(null); load();
  };
  const rest = async (everyWeek: boolean) => {
    if (!picking) return;
    if (everyWeek) {
      const dow = picking.getDay();
      for (const t of templates) if ((t.days ?? []).includes(dow)) await saveTemplate({ ...t, days: (t.days ?? []).filter(d => d !== dow) });
      await setPlanOverride(dateKey(picking), null);
    } else {
      await setPlanOverride(dateKey(picking), REST);
    }
    setPicking(null); load();
  };

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <View style={styles.header}>
        <Pressable onPress={() => navigation.goBack()} hitSlop={12}><Ionicons name="chevron-back" size={26} color={Colors.text} /></Pressable>
        <Text style={styles.title}>Plan</Text>
      </View>
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.monthRow}>
          <Pressable onPress={() => setCursor(new Date(cursor.getFullYear(), cursor.getMonth() - 1, 1))} hitSlop={12}><Ionicons name="chevron-back" size={22} color={Colors.text} /></Pressable>
          <View style={{ alignItems: 'center' }}>
            <Text style={styles.month}>{monthLabel}</Text>
            <Text style={styles.summary}>{plannedThisMonth} planned · {doneThisMonth} done</Text>
          </View>
          <Pressable onPress={() => setCursor(new Date(cursor.getFullYear(), cursor.getMonth() + 1, 1))} hitSlop={12}><Ionicons name="chevron-forward" size={22} color={Colors.text} /></Pressable>
        </View>
        <View style={styles.grid}>
          {headers.map((h, i) => <Text key={`h${i}`} style={styles.dayHeader}>{h}</Text>)}
          {cells.map(d => {
            const inMonth = d.getMonth() === cursor.getMonth();
            const planned = planFor(d, templates, overrides);
            const done = workoutsOn(workouts, d).length > 0;
            const isToday = sameDay(d, today);
            const overridden = !!overrides[dateKey(d)];
            return (
              <Pressable key={d.toISOString()} onPress={() => setPicking(d)} style={({ pressed }) => [styles.cell, isToday && styles.cellToday, pressed && { opacity: 0.6 }]}>
                <Text style={[styles.dayNum, !inMonth && styles.dim, isToday && styles.dayNumToday]}>{d.getDate()}</Text>
                {done ? (
                  <View style={styles.doneDot}><Ionicons name="checkmark" size={11} color={Colors.textInverse} /></View>
                ) : planned ? (
                  <Text style={[styles.cellName, !inMonth && styles.dim, overridden && styles.cellNameOnce]} numberOfLines={1}>{shortName(planned.name)}</Text>
                ) : <View style={{ height: 14 }} />}
              </Pressable>
            );
          })}
        </View>
        <View style={styles.legend}>
          <Text style={styles.legendText}>Tap a date to choose its workout. Weekly repeats every week; Once is that date only and shows in italics.</Text>
        </View>
        <View style={{ height: 60 }} />
      </ScrollView>
      <PlanSheet
        date={picking}
        templates={templates}
        current={picking ? planFor(picking, templates, overrides) : null}
        onClose={() => setPicking(null)}
        onPick={pick}
        onRest={rest}
      />
    </SafeAreaView>
  );
}

function shortName(name: string): string {
  const head = name.split(/[—–\-:(]/)[0].trim();
  return head.length > 8 ? head.slice(0, 7) + '…' : head;
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.bg },
  header: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, paddingHorizontal: Spacing.md, paddingTop: Spacing.md },
  title: { color: Colors.text, fontSize: FontSize.xl, fontWeight: '700' },
  content: { padding: Spacing.md, gap: Spacing.md },
  monthRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  month: { color: Colors.text, fontSize: FontSize.lg, fontWeight: '700' },
  summary: { color: Colors.textSecondary, fontSize: FontSize.xs, marginTop: 2 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', borderTopWidth: 1, borderLeftWidth: 1, borderColor: Colors.border },
  dayHeader: { width: `${100 / 7}%`, textAlign: 'center', color: Colors.textSecondary, fontSize: FontSize.xs, fontWeight: '700', paddingVertical: 6, borderRightWidth: 1, borderBottomWidth: 1, borderColor: Colors.border },
  cell: { width: `${100 / 7}%`, height: 64, padding: 4, alignItems: 'center', justifyContent: 'space-between', borderRightWidth: 1, borderBottomWidth: 1, borderColor: Colors.border },
  cellToday: { backgroundColor: Colors.bgElevated },
  dayNum: { color: Colors.text, fontSize: FontSize.sm, fontWeight: '600' },
  dayNumToday: { textDecorationLine: 'underline' },
  dim: { color: Colors.textSecondary, opacity: 0.5 },
  cellName: { color: Colors.text, fontSize: 10, fontWeight: '600', height: 14 },
  cellNameOnce: { fontStyle: 'italic', fontWeight: '400' },
  doneDot: { width: 18, height: 18, borderRadius: 9, backgroundColor: Colors.primary, alignItems: 'center', justifyContent: 'center' },
  legend: { paddingTop: Spacing.sm },
  legendText: { color: Colors.textSecondary, fontSize: FontSize.sm, lineHeight: 20 },
});
