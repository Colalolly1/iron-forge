import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  Pressable,
  SectionList,
  Dimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { Card } from '../components/Card';
import { MuscleGroupBadge } from '../components/MuscleGroupBadge';
import { getWorkouts, getProfile } from '../utils/storage';
import {
  formatDuration,
  formatNumber,
  getWorkoutMuscleGroups,
} from '../utils/helpers';
import { Workout, UserProfile } from '../types';
import { Colors, Spacing, FontSize, BorderRadius } from '../theme/colors';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const DAY_NAMES = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

interface WorkoutSection {
  title: string;
  data: Workout[];
}

/** One workout in a list: date and time on the left, what it was on the right. */
function WorkoutRow({ workout: w, unit, navigation }: { workout: Workout; unit: string; navigation: any }) {
  const muscles = getWorkoutMuscleGroups(w);
  const d = new Date(w.startTime);
  const time = d.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
  return (
    <Pressable
      onPress={() => navigation.navigate('WorkoutDetail', { workoutId: w.id })}
      style={({ pressed }) => [histStyles.card, pressed && { opacity: 0.8 }]}
    >
      <View style={histStyles.dateCol}>
        <Text style={histStyles.day}>{d.getDate()}</Text>
        <Text style={histStyles.weekday}>
          {d.toLocaleDateString('en-US', { weekday: 'short' })}
        </Text>
        <Text style={histStyles.time}>{time}</Text>
      </View>

      <View style={histStyles.content}>
        <Text style={histStyles.name}>{w.name}</Text>
        <View style={histStyles.stats}>
          <Text style={histStyles.stat}>{formatDuration(w.duration)}</Text>
          <Text style={histStyles.statSep}>|</Text>
          <Text style={histStyles.stat}>{w.totalSets} sets</Text>
          <Text style={histStyles.statSep}>|</Text>
          <Text style={histStyles.stat}>{formatNumber(w.totalVolume)} {unit}</Text>
        </View>
        <View style={histStyles.muscles}>
          {muscles.slice(0, 3).map(m => (
            <MuscleGroupBadge key={m} muscle={m} />
          ))}
        </View>
      </View>

      <Ionicons name="chevron-forward" size={20} color={Colors.textTertiary} />
    </Pressable>
  );
}

export function HistoryScreen({ navigation }: any) {
  const [allWorkouts, setAllWorkouts] = useState<Workout[]>([]);
  const [sections, setSections] = useState<WorkoutSection[]>([]);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [viewMode, setViewMode] = useState<'list' | 'calendar'>('list');
  const [calendarMonth, setCalendarMonth] = useState(() => {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth(), 1);
  });

  const loadData = useCallback(async () => {
    const [ws, p] = await Promise.all([getWorkouts(), getProfile()]);
    setProfile(p);
    setAllWorkouts(ws);

    // Newest first, so the most recent month is the first section and the
    // most recent workout the first row in it.
    const newestFirst = [...ws].sort(
      (a, b) => new Date(b.startTime).getTime() - new Date(a.startTime).getTime()
    );

    // Group by month
    const groups: Record<string, Workout[]> = {};
    newestFirst.forEach(w => {
      const d = new Date(w.startTime);
      const key = d.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
      if (!groups[key]) groups[key] = [];
      groups[key].push(w);
    });

    setSections(
      Object.entries(groups).map(([title, data]) => ({ title, data }))
    );
  }, []);

  useEffect(() => {
    loadData();
    const unsub = navigation?.addListener?.('focus', loadData);
    return unsub;
  }, [loadData, navigation]);

  const unit = profile?.weightUnit ?? 'lbs';

  // Build workout lookup by date string for calendar
  const workoutsByDate = useMemo(() => {
    const map: Record<string, Workout[]> = {};
    allWorkouts.forEach(w => {
      const d = new Date(w.startTime);
      const key = `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
      if (!map[key]) map[key] = [];
      map[key].push(w);
    });
    return map;
  }, [allWorkouts]);

  // Calendar data
  const calendarDays = useMemo(() => {
    const year = calendarMonth.getFullYear();
    const month = calendarMonth.getMonth();
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    const daysInMonth = lastDay.getDate();

    // Monday = 0, Sunday = 6
    let startDow = firstDay.getDay() - 1;
    if (startDow < 0) startDow = 6;

    const days: { day: number; workouts: Workout[] }[] = [];

    // Empty slots before first day
    for (let i = 0; i < startDow; i++) {
      days.push({ day: 0, workouts: [] });
    }

    for (let d = 1; d <= daysInMonth; d++) {
      const key = `${year}-${month}-${d}`;
      days.push({ day: d, workouts: workoutsByDate[key] || [] });
    }

    return days;
  }, [calendarMonth, workoutsByDate]);

  const monthLabel = calendarMonth.toLocaleDateString('en-US', {
    month: 'long',
    year: 'numeric',
  });

  const goToPrevMonth = () => {
    setCalendarMonth(prev => new Date(prev.getFullYear(), prev.getMonth() - 1, 1));
  };
  const goToNextMonth = () => {
    setCalendarMonth(prev => new Date(prev.getFullYear(), prev.getMonth() + 1, 1));
  };

  // Count workouts this month
  const monthWorkoutCount = useMemo(() => {
    return calendarDays.reduce((sum, d) => sum + d.workouts.length, 0);
  }, [calendarDays]);

  const renderWorkout = ({ item: w }: { item: Workout }) => (
    <WorkoutRow workout={w} unit={unit} navigation={navigation} />
  );

  const cellSize = Math.floor((SCREEN_WIDTH - Spacing.md * 2) / 7);

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <View style={styles.header}>
        <Text style={styles.title}>History</Text>
        <Pressable
          onPress={() => setViewMode(viewMode === 'list' ? 'calendar' : 'list')}
          style={styles.viewToggle}
        >
          <Ionicons
            name={viewMode === 'list' ? 'calendar-outline' : 'list-outline'}
            size={24}
            color={Colors.primary}
          />
        </Pressable>
      </View>

      {viewMode === 'calendar' ? (
        <ScrollView contentContainerStyle={{ paddingBottom: 100 }}>
          {/* Month navigation */}
          <View style={calStyles.monthNav}>
            <Pressable onPress={goToPrevMonth} hitSlop={12}>
              <Ionicons name="chevron-back" size={24} color={Colors.text} />
            </Pressable>
            <Text style={calStyles.monthLabel}>{monthLabel}</Text>
            <Pressable onPress={goToNextMonth} hitSlop={12}>
              <Ionicons name="chevron-forward" size={24} color={Colors.text} />
            </Pressable>
          </View>

          {/* Summary */}
          <Text style={calStyles.summary}>
            {monthWorkoutCount} workout{monthWorkoutCount !== 1 ? 's' : ''} this month
          </Text>

          {/* Day headers */}
          <View style={calStyles.dayHeaders}>
            {DAY_NAMES.map(d => (
              <View key={d} style={[calStyles.dayHeaderCell, { width: cellSize }]}>
                <Text style={calStyles.dayHeaderText}>{d}</Text>
              </View>
            ))}
          </View>

          {/* Calendar grid */}
          <View style={calStyles.grid}>
            {calendarDays.map((item, i) => {
              const hasWorkout = item.workouts.length > 0;
              const isToday =
                item.day > 0 &&
                new Date().getDate() === item.day &&
                new Date().getMonth() === calendarMonth.getMonth() &&
                new Date().getFullYear() === calendarMonth.getFullYear();

              return (
                <Pressable
                  key={i}
                  style={[
                    calStyles.cell,
                    { width: cellSize, height: cellSize },
                    hasWorkout && calStyles.cellWorkout,
                    isToday && calStyles.cellToday,
                  ]}
                  onPress={() => {
                    if (item.workouts.length === 1) {
                      navigation.navigate('WorkoutDetail', {
                        workoutId: item.workouts[0].id,
                      });
                    }
                  }}
                  disabled={!hasWorkout}
                >
                  {item.day > 0 && (
                    <>
                      <Text
                        style={[
                          calStyles.cellDay,
                          hasWorkout && calStyles.cellDayWorkout,
                          isToday && calStyles.cellDayToday,
                        ]}
                      >
                        {item.day}
                      </Text>
                      {hasWorkout && (
                        <View style={calStyles.dots}>
                          {item.workouts.slice(0, 3).map((_, wi) => (
                            <View key={wi} style={calStyles.dot} />
                          ))}
                        </View>
                      )}
                    </>
                  )}
                </Pressable>
              );
            })}
          </View>

          {/* Workouts for this month below calendar */}
          <View style={{ paddingHorizontal: Spacing.md, marginTop: Spacing.lg, gap: Spacing.sm }}>
            <Text style={calStyles.workoutsLabel}>Workouts in {monthLabel}</Text>
            {calendarDays
              .flatMap(d => d.workouts)
              .sort((a, b) => new Date(b.startTime).getTime() - new Date(a.startTime).getTime())
              .map(w => (
                <WorkoutRow key={w.id} workout={w} unit={unit} navigation={navigation} />
              ))}
            {monthWorkoutCount === 0 && (
              <Text style={calStyles.noWorkouts}>No workouts this month</Text>
            )}
          </View>
        </ScrollView>
      ) : sections.length === 0 ? (
        <View style={styles.empty}>
          <Ionicons name="time-outline" size={64} color={Colors.textTertiary} />
          <Text style={styles.emptyTitle}>No workout history</Text>
          <Text style={styles.emptySubtitle}>
            Complete your first workout to see it here
          </Text>
        </View>
      ) : (
        <SectionList
          sections={sections}
          keyExtractor={w => w.id}
          renderItem={renderWorkout}
          renderSectionHeader={({ section: { title } }) => (
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>{title}</Text>
            </View>
          )}
          contentContainerStyle={styles.list}
          stickySectionHeadersEnabled={false}
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.bg },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: Spacing.md,
  },
  title: {
    color: Colors.text,
    fontSize: FontSize.xxxl,
    fontWeight: '800',
  },
  viewToggle: {
    padding: Spacing.sm,
    backgroundColor: Colors.bgElevated,
    borderRadius: BorderRadius.md,
  },
  sectionHeader: {
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.md,
  },
  sectionTitle: {
    color: Colors.textSecondary,
    fontSize: FontSize.sm,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  list: {
    paddingHorizontal: Spacing.md,
    paddingBottom: 100,
  },
  empty: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.md,
  },
  emptyTitle: {
    color: Colors.text,
    fontSize: FontSize.xl,
    fontWeight: '700',
  },
  emptySubtitle: {
    color: Colors.textSecondary,
    fontSize: FontSize.md,
  },
});

const calStyles = StyleSheet.create({
  monthNav: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.sm,
  },
  monthLabel: {
    color: Colors.text,
    fontSize: FontSize.xl,
    fontWeight: '800',
  },
  summary: {
    color: Colors.textSecondary,
    fontSize: FontSize.sm,
    fontWeight: '600',
    textAlign: 'center',
    marginBottom: Spacing.sm,
  },
  dayHeaders: {
    flexDirection: 'row',
    paddingHorizontal: Spacing.md,
  },
  dayHeaderCell: {
    alignItems: 'center',
    paddingVertical: Spacing.xs,
  },
  dayHeaderText: {
    color: Colors.textSecondary,
    fontSize: FontSize.xs,
    fontWeight: '700',
    textTransform: 'uppercase',
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    paddingHorizontal: Spacing.md,
  },
  cell: {
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: BorderRadius.sm,
  },
  cellWorkout: {
    backgroundColor: Colors.primaryMuted,
  },
  cellToday: {
    borderWidth: 2,
    borderColor: Colors.primary,
  },
  cellDay: {
    color: Colors.text,
    fontSize: FontSize.md,
    fontWeight: '700',
  },
  cellDayWorkout: {
    color: Colors.primary,
    fontWeight: '800',
  },
  cellDayToday: {
    color: Colors.primary,
  },
  dots: {
    flexDirection: 'row',
    gap: 2,
    marginTop: 2,
  },
  dot: {
    width: 5,
    height: 5,
    borderRadius: 2.5,
    backgroundColor: Colors.primary,
  },
  workoutsLabel: {
    color: Colors.text,
    fontSize: FontSize.lg,
    fontWeight: '700',
    marginBottom: Spacing.xs,
  },
  noWorkouts: {
    color: Colors.textSecondary,
    fontSize: FontSize.md,
    textAlign: 'center',
    paddingVertical: Spacing.lg,
  },
});

const histStyles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.bgCard,
    borderRadius: BorderRadius.lg,
    padding: Spacing.md,
    marginBottom: Spacing.sm,
    borderWidth: 1,
    borderColor: Colors.border,
    gap: Spacing.md,
  },
  dateCol: {
    alignItems: 'center',
    width: 44,
  },
  day: {
    color: Colors.primary,
    fontSize: FontSize.xxl,
    fontWeight: '800',
  },
  weekday: {
    color: Colors.textSecondary,
    fontSize: FontSize.xs,
    fontWeight: '600',
  },
  time: {
    color: Colors.textTertiary,
    fontSize: FontSize.xs,
    marginTop: 2,
    fontVariant: ['tabular-nums'],
  },
  content: {
    flex: 1,
    gap: Spacing.xs,
  },
  name: {
    color: Colors.text,
    fontSize: FontSize.lg,
    fontWeight: '700',
  },
  stats: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
  },
  stat: {
    color: Colors.text,
    fontSize: FontSize.md,
    fontWeight: '600',
  },
  statSep: {
    color: Colors.textSecondary,
    fontSize: FontSize.md,
  },
  muscles: {
    flexDirection: 'row',
    gap: Spacing.xs,
    flexWrap: 'wrap',
  },
});
