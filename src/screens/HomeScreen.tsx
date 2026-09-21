import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  Pressable,
  RefreshControl,
  Modal,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useWorkout } from '../context/WorkoutContext';
import { Card } from '../components/Card';
import { Button } from '../components/Button';
import { MuscleGroupBadge } from '../components/MuscleGroupBadge';
import { getWorkouts, getProfile, getPRs, getTemplates } from '../utils/storage';
import { exercisesFromTemplate } from '../utils/startTemplate';
import { startOrReplace } from '../utils/startFlow';
import {
  formatDuration,
  formatWeight,
  formatNumber,
  getRelativeTime,
  getWorkoutMuscleGroups,
} from '../utils/helpers';
import { Workout, UserProfile, WorkoutStats, MuscleGroup, PersonalRecord, WorkoutTemplate } from '../types';
import { EXERCISE_MAP } from '../data/exercises';
import { Colors, Spacing, FontSize, BorderRadius } from '../theme/colors';

export function HomeScreen({ navigation }: any) {
  const { isWorkoutActive, activeWorkout, startWorkout, discardWorkout } = useWorkout();
  const [templates, setTemplates] = useState<WorkoutTemplate[]>([]);
  const [showStart, setShowStart] = useState(false);
  const [workouts, setWorkouts] = useState<Workout[]>([]);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [stats, setStats] = useState<WorkoutStats | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [weekPRs, setWeekPRs] = useState<PersonalRecord[]>([]);
  const [showWeekPRsModal, setShowWeekPRsModal] = useState(false);

  const loadData = useCallback(async () => {
    const [ws, p, prs, ts] = await Promise.all([getWorkouts(), getProfile(), getPRs(), getTemplates()]);
    setTemplates(ts);
    setWorkouts(ws);
    setProfile(p);

    // Calculate stats
    const now = new Date();
    const weekStart = new Date(now);
    weekStart.setDate(now.getDate() - now.getDay() + (p.startOfWeek === 1 ? 1 : 0));
    weekStart.setHours(0, 0, 0, 0);

    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);

    const thisWeek = ws.filter(w => new Date(w.startTime) >= weekStart);
    const thisMonth = ws.filter(w => new Date(w.startTime) >= monthStart);
    // Only count E1RM PRs from the simplified system, filtered to this week
    const prsThisWeek = prs.filter(
      pr => pr.type === 'one_rep_max' && new Date(pr.date) >= weekStart
    );
    setWeekPRs(prsThisWeek.sort((a, b) => b.value - a.value));

    // Calculate streak
    let streak = 0;
    const dayMs = 86400000;
    let checkDate = new Date();
    checkDate.setHours(0, 0, 0, 0);

    while (true) {
      const dayStr = checkDate.toISOString().split('T')[0];
      const hasWorkout = ws.some(w => w.startTime.startsWith(dayStr));
      if (hasWorkout) {
        streak++;
        checkDate = new Date(checkDate.getTime() - dayMs);
      } else if (streak === 0) {
        // Allow today to not have a workout yet
        checkDate = new Date(checkDate.getTime() - dayMs);
        const prevDay = checkDate.toISOString().split('T')[0];
        if (ws.some(w => w.startTime.startsWith(prevDay))) {
          streak++;
          checkDate = new Date(checkDate.getTime() - dayMs);
          continue;
        }
        break;
      } else {
        break;
      }
    }

    // Find favorite exercise
    const exerciseCounts: Record<string, number> = {};
    ws.forEach(w =>
      w.exercises.forEach(e => {
        exerciseCounts[e.exercise.name] = (exerciseCounts[e.exercise.name] || 0) + 1;
      })
    );
    const fav = Object.entries(exerciseCounts).sort((a, b) => b[1] - a[1])[0];

    // This-week-only volume and sets
    const weeklyVolume = thisWeek.reduce((s, w) => s + w.totalVolume, 0);
    const weeklySets = thisWeek.reduce((s, w) => s + w.totalSets, 0);

    setStats({
      totalWorkouts: ws.length,
      totalVolume: weeklyVolume,
      totalSets: weeklySets,
      totalReps: ws.reduce(
        (s, w) =>
          s +
          w.exercises.reduce(
            (es, e) =>
              es + e.sets.filter(set => set.completed).reduce((rs, set) => rs + set.reps, 0),
            0
          ),
        0
      ),
      totalDuration: ws.reduce((s, w) => s + w.duration, 0),
      averageDuration: ws.length > 0 ? ws.reduce((s, w) => s + w.duration, 0) / ws.length : 0,
      currentStreak: streak,
      longestStreak: streak, // simplified
      favoriteExercise: fav?.[0],
      thisWeekWorkouts: thisWeek.length,
      thisMonthWorkouts: thisMonth.length,
      prsThisMonth: prsThisWeek.length,
    });
  }, []);

  useEffect(() => {
    loadData();
    const unsub = navigation?.addListener?.('focus', loadData);
    return unsub;
  }, [loadData, navigation]);

  const onRefresh = async () => {
    setRefreshing(true);
    await loadData();
    setRefreshing(false);
  };

  const recentWorkouts = workouts.slice(0, 5);
  const unit = profile?.weightUnit ?? 'lbs';

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.content}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={Colors.primary}
          />
        }
      >
        {/* Header: the app's name, and the two places that are not tabs. */}
        <View style={styles.header}>
          <Text style={styles.greeting}>Iron Forge</Text>
          <View style={styles.headerWords}>
            <Pressable onPress={() => navigation.navigate('Exercises')} hitSlop={8}>
              <Text style={styles.word}>Exercises</Text>
            </Pressable>
            <Pressable onPress={() => navigation.navigate('Templates')} hitSlop={8}>
              <Text style={styles.word}>Templates</Text>
            </Pressable>
          </View>
        </View>

        {/* Active Workout Banner */}
        {isWorkoutActive && (
          <Pressable onPress={() => navigation.navigate('ActiveWorkout')}>
            <LinearGradient
              colors={[...Colors.gradientPrimary]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={styles.activeBanner}
            >
              <View style={styles.activeDot} />
              <View style={{ flex: 1 }}>
                <Text style={styles.activeTitle}>Workout in Progress</Text>
                <Text style={styles.activeSubtitle}>
                  {activeWorkout?.exercises.length ?? 0} exercises
                </Text>
              </View>
              <Ionicons name="chevron-forward" size={24} color={Colors.textInverse} />
            </LinearGradient>
          </Pressable>
        )}

        {/* Start: one button, then choose a template or go empty. */}
        {!isWorkoutActive && (
          <Pressable
            onPress={() => setShowStart(true)}
            style={({ pressed }) => [styles.startButton, pressed && { opacity: 0.85 }]}
          >
            <Ionicons name="barbell" size={22} color={Colors.textInverse} />
            <View style={{ flex: 1 }}>
              <Text style={styles.startTitle}>Start a workout</Text>
              <Text style={styles.startHint}>
                {templates.length > 0 ? `${templates.length} template${templates.length === 1 ? '' : 's'} · or start empty` : 'Start empty, or make a template'}
              </Text>
            </View>
            <Ionicons name="chevron-forward" size={22} color={Colors.textInverse} />
          </Pressable>
        )}

        {/* Stats Cards */}
        {stats && stats.totalWorkouts > 0 && (
          <>
            <Text style={[styles.sectionTitle, styles.firstSection]}>This Week</Text>
            <View style={styles.statsGrid}>
              <StatCard
                label="Workouts"
                value={String(stats.thisWeekWorkouts)}
                icon="barbell-outline"
                color={Colors.primary}
              />
              <StatCard
                label="Sets"
                value={String(stats.totalSets)}
                icon="layers-outline"
                color={Colors.warning}
              />
              <StatCard
                label="Volume"
                value={formatNumber(stats.totalVolume)}
                icon="trending-up"
                color={Colors.accent}
                subtitle={unit}
              />
              <StatCard
                label="PRs"
                value={String(stats.prsThisMonth)}
                icon="trophy"
                color="#FFD700"
                onPress={() => setShowWeekPRsModal(true)}
              />
            </View>
          </>
        )}

        {/* Recent Workouts */}
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Recent Workouts</Text>
          {workouts.length > 0 && (
            <Pressable onPress={() => navigation.navigate('History')}>
              <Text style={styles.seeAll}>See All</Text>
            </Pressable>
          )}
        </View>

        {recentWorkouts.length === 0 ? (
          <Card style={styles.emptyCard}>
            <Ionicons
              name="barbell-outline"
              size={48}
              color={Colors.textTertiary}
            />
            <Text style={styles.emptyTitle}>No workouts yet</Text>
            <Text style={styles.emptySubtitle}>
              Start your first workout to begin tracking your progress
            </Text>
          </Card>
        ) : (
          recentWorkouts.map(w => (
            <WorkoutCard
              key={w.id}
              workout={w}
              unit={unit}
              onPress={() =>
                navigation.navigate('WorkoutDetail', { workoutId: w.id })
              }
            />
          ))
        )}

        <View style={{ height: 100 }} />
      </ScrollView>

      {/* Start sheet */}
      <Modal visible={showStart} transparent animationType="none" onRequestClose={() => setShowStart(false)}>
        <Pressable style={sheetStyles.scrim} onPress={() => setShowStart(false)}>
          <Pressable style={sheetStyles.sheet} onPress={() => {}}>
            <View style={sheetStyles.handleRow}>
              <Text style={sheetStyles.title}>Start</Text>
              <Pressable onPress={() => setShowStart(false)} hitSlop={10}>
                <Text style={sheetStyles.close}>Close</Text>
              </Pressable>
            </View>
            <ScrollView style={{ maxHeight: 420 }}>
              {templates.map(t => (
                <Pressable
                  key={t.id}
                  onPress={() => {
                    setShowStart(false);
                    startOrReplace({
                      isWorkoutActive,
                      discardWorkout,
                      navigation,
                      start: () => startWorkout(t.name, exercisesFromTemplate(t)),
                    });
                  }}
                  style={({ pressed }) => [sheetStyles.row, pressed && { opacity: 0.7 }]}
                >
                  <View style={{ flex: 1 }}>
                    <Text style={sheetStyles.rowTitle}>{t.name}</Text>
                    <Text style={sheetStyles.rowMeta} numberOfLines={1}>
                      {t.exercises.map(te => EXERCISE_MAP.get(te.exerciseId)?.name ?? '?').join(' · ')}
                    </Text>
                  </View>
                  <Text style={sheetStyles.rowGo}>Start</Text>
                </Pressable>
              ))}
              <Pressable
                onPress={() => {
                  setShowStart(false);
                  startOrReplace({ isWorkoutActive, discardWorkout, navigation, start: () => startWorkout() });
                }}
                style={({ pressed }) => [sheetStyles.row, pressed && { opacity: 0.7 }]}
              >
                <View style={{ flex: 1 }}>
                  <Text style={sheetStyles.rowTitle}>Empty workout</Text>
                  <Text style={sheetStyles.rowMeta}>Add exercises as you go</Text>
                </View>
                <Text style={sheetStyles.rowGo}>Start</Text>
              </Pressable>
            </ScrollView>
            <Pressable
              onPress={() => { setShowStart(false); navigation.navigate('Templates'); }}
              style={sheetStyles.manage}
              hitSlop={8}
            >
              <Text style={sheetStyles.manageText}>Manage templates</Text>
            </Pressable>
          </Pressable>
        </Pressable>
      </Modal>

      {/* This Week's PRs Modal */}
      <Modal
        visible={showWeekPRsModal}
        animationType="slide"
        transparent
        onRequestClose={() => setShowWeekPRsModal(false)}
      >
        <View style={modalStyles.backdrop}>
          <View style={modalStyles.sheet}>
            <View style={modalStyles.header}>
              <View style={modalStyles.headerLeft}>
                <Ionicons name="trophy" size={22} color="#FFD700" />
                <Text style={modalStyles.title}>This Week's PRs</Text>
              </View>
              <Pressable onPress={() => setShowWeekPRsModal(false)} hitSlop={8}>
                <Ionicons name="close" size={24} color={Colors.text} />
              </Pressable>
            </View>

            <ScrollView style={modalStyles.scroll} contentContainerStyle={modalStyles.scrollContent}>
              {weekPRs.length === 0 ? (
                <View style={modalStyles.empty}>
                  <Ionicons name="trophy-outline" size={48} color={Colors.textTertiary} />
                  <Text style={modalStyles.emptyTitle}>No PRs this week</Text>
                  <Text style={modalStyles.emptySubtitle}>
                    Hit a new estimated 1RM to see it here
                  </Text>
                </View>
              ) : (
                weekPRs.map(pr => {
                  const exName = pr.exerciseName || EXERCISE_MAP.get(pr.exerciseId)?.name || 'Exercise';
                  const u = profile?.weightUnit ?? 'lbs';
                  const dateStr = new Date(pr.date).toLocaleDateString('en-GB', {
                    weekday: 'short',
                    day: 'numeric',
                    month: 'short',
                  });
                  return (
                    <View key={pr.id} style={modalStyles.prRow}>
                      <View style={modalStyles.prRowLeft}>
                        <Text style={modalStyles.prExName}>{exName}</Text>
                        <Text style={modalStyles.prDate}>{dateStr}</Text>
                      </View>
                      <View style={modalStyles.prRowRight}>
                        <Text style={modalStyles.prValue}>
                          {Math.round(pr.value)}{u}
                        </Text>
                        {pr.setWeight && pr.setReps ? (
                          <Text style={modalStyles.prSet}>
                            {pr.setWeight}{u} × {pr.setReps}
                          </Text>
                        ) : null}
                      </View>
                    </View>
                  );
                })
              )}
            </ScrollView>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

function StatCard({
  label,
  value,
  icon,
  color,
  subtitle,
  onPress,
}: {
  label: string;
  value: string;
  icon: string;
  color: string;
  subtitle?: string;
  onPress?: () => void;
}) {
  const Wrapper: any = onPress ? Pressable : View;
  return (
    <Wrapper onPress={onPress} style={[statStyles.card, { borderColor: color + '33' }]}>
      <Ionicons name={icon as any} size={20} color={color} />
      <Text style={[statStyles.value, { color }]}>{value}</Text>
      <Text style={statStyles.label}>
        {label}
        {subtitle ? ` (${subtitle})` : ''}
      </Text>
    </Wrapper>
  );
}

function WorkoutCard({
  workout,
  unit,
  onPress,
}: {
  workout: Workout;
  unit: 'kg' | 'lbs';
  onPress: () => void;
}) {
  const muscles = getWorkoutMuscleGroups(workout);
  return (
    <Card onPress={onPress} style={wcStyles.card}>
      <View style={wcStyles.header}>
        <View style={{ flex: 1 }}>
          <Text style={wcStyles.name}>{workout.name}</Text>
          <Text style={wcStyles.time}>{getRelativeTime(workout.startTime)}</Text>
        </View>
        <Ionicons name="chevron-forward" size={20} color={Colors.textTertiary} />
      </View>
      <View style={wcStyles.stats}>
        <View style={wcStyles.stat}>
          <Text style={wcStyles.statValue}>{formatDuration(workout.duration)}</Text>
          <Text style={wcStyles.statLabel}>Duration</Text>
        </View>
        <View style={wcStyles.divider} />
        <View style={wcStyles.stat}>
          <Text style={wcStyles.statValue}>{workout.totalSets}</Text>
          <Text style={wcStyles.statLabel}>Sets</Text>
        </View>
        <View style={wcStyles.divider} />
        <View style={wcStyles.stat}>
          <Text style={wcStyles.statValue}>
            {formatNumber(workout.totalVolume)}
          </Text>
          <Text style={wcStyles.statLabel}>Volume</Text>
        </View>
      </View>
      <View style={wcStyles.muscles}>
        {muscles.slice(0, 4).map(m => (
          <MuscleGroupBadge key={m} muscle={m} />
        ))}
      </View>
    </Card>
  );
}

function getGreeting(): string {
  const h = new Date().getHours();
  if (h < 12) return 'Good morning';
  if (h < 17) return 'Good afternoon';
  return 'Good evening';
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.bg },
  scroll: { flex: 1 },
  content: { padding: Spacing.md, gap: Spacing.md },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  greeting: {
    color: Colors.text,
    fontSize: FontSize.xl,
    fontWeight: '700',
  },
  headerWords: {
    flexDirection: 'row',
    gap: Spacing.lg,
  },
  word: {
    color: Colors.textSecondary,
    fontSize: FontSize.md,
    fontWeight: '500',
  },
  startButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    backgroundColor: Colors.primary,
    borderRadius: BorderRadius.lg,
    paddingVertical: Spacing.md + 2,
    paddingHorizontal: Spacing.md,
  },
  startTitle: {
    color: Colors.textInverse,
    fontSize: FontSize.lg,
    fontWeight: '700',
  },
  startHint: {
    color: 'rgba(0,0,0,0.6)',
    fontSize: FontSize.sm,
    marginTop: 2,
  },
  activeBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: Spacing.md,
    borderRadius: BorderRadius.lg,
    gap: Spacing.md,
  },
  activeDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: Colors.textInverse,
  },
  activeTitle: {
    color: Colors.textInverse,
    fontSize: FontSize.lg,
    fontWeight: '700',
  },
  activeSubtitle: {
    color: 'rgba(0,0,0,0.6)',
    fontSize: FontSize.sm,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  firstSection: {
    marginTop: 4,
  },
  sectionTitle: {
    color: Colors.text,
    fontSize: FontSize.xl,
    fontWeight: '700',
  },
  seeAll: {
    color: Colors.primary,
    fontSize: FontSize.sm,
    fontWeight: '600',
  },
  statsGrid: {
    flexDirection: 'row',
    gap: Spacing.sm,
  },
  emptyCard: {
    alignItems: 'center',
    padding: Spacing.xxl,
    gap: Spacing.md,
  },
  emptyTitle: {
    color: Colors.text,
    fontSize: FontSize.lg,
    fontWeight: '700',
  },
  emptySubtitle: {
    color: Colors.textSecondary,
    fontSize: FontSize.sm,
    textAlign: 'center',
  },
});

const statStyles = StyleSheet.create({
  card: {
    flex: 1,
    backgroundColor: Colors.bgCard,
    borderRadius: BorderRadius.md,
    padding: Spacing.md,
    alignItems: 'center',
    gap: Spacing.xs,
    borderWidth: 1,
  },
  value: {
    fontSize: FontSize.xl,
    fontWeight: '800',
  },
  label: {
    color: Colors.textSecondary,
    fontSize: FontSize.xs,
    fontWeight: '600',
  },
});

const wcStyles = StyleSheet.create({
  card: { gap: Spacing.sm },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  name: {
    color: Colors.text,
    fontSize: FontSize.lg,
    fontWeight: '700',
  },
  time: {
    color: Colors.textSecondary,
    fontSize: FontSize.sm,
  },
  stats: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  stat: {
    flex: 1,
    alignItems: 'center',
  },
  statValue: {
    color: Colors.text,
    fontSize: FontSize.lg,
    fontWeight: '700',
  },
  statLabel: {
    color: Colors.textSecondary,
    fontSize: FontSize.xs,
    marginTop: 2,
  },
  divider: {
    width: 1,
    height: 30,
    backgroundColor: Colors.border,
  },
  muscles: {
    flexDirection: 'row',
    gap: Spacing.xs,
    flexWrap: 'wrap',
  },
});

const modalStyles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.7)',
    justifyContent: 'flex-end',
  },
  sheet: {
    backgroundColor: Colors.bg,
    borderTopLeftRadius: BorderRadius.xl,
    borderTopRightRadius: BorderRadius.xl,
    maxHeight: '85%',
    borderTopWidth: 1,
    borderColor: Colors.border,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: Spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  title: {
    color: Colors.text,
    fontSize: FontSize.xl,
    fontWeight: '800',
  },
  scroll: {
    maxHeight: 600,
  },
  scrollContent: {
    padding: Spacing.md,
    gap: Spacing.sm,
  },
  empty: {
    alignItems: 'center',
    paddingVertical: Spacing.xxl,
    gap: Spacing.sm,
  },
  emptyTitle: {
    color: Colors.text,
    fontSize: FontSize.lg,
    fontWeight: '700',
  },
  emptySubtitle: {
    color: Colors.textSecondary,
    fontSize: FontSize.sm,
    textAlign: 'center',
  },
  prRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: Colors.bgCard,
    borderRadius: BorderRadius.md,
    padding: Spacing.md,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  prRowLeft: {
    flex: 1,
    gap: 2,
  },
  prRowRight: {
    alignItems: 'flex-end',
    gap: 2,
  },
  prExName: {
    color: Colors.text,
    fontSize: FontSize.md,
    fontWeight: '700',
  },
  prDate: {
    color: Colors.textTertiary,
    fontSize: FontSize.xs,
    fontWeight: '600',
  },
  prValue: {
    color: Colors.text,
    fontSize: FontSize.xl,
    fontWeight: '900',
    letterSpacing: -0.5,
  },
  prSet: {
    color: Colors.textSecondary,
    fontSize: FontSize.xs,
    fontWeight: '600',
  },
});

const sheetStyles = StyleSheet.create({
  scrim: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'flex-end',
  },
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
  handleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: Spacing.sm,
  },
  title: { color: Colors.text, fontSize: FontSize.xl, fontWeight: '700' },
  close: { color: Colors.textSecondary, fontSize: FontSize.md },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    paddingVertical: Spacing.md,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
  },
  rowTitle: { color: Colors.text, fontSize: FontSize.md, fontWeight: '600' },
  rowMeta: { color: Colors.textSecondary, fontSize: FontSize.sm, marginTop: 2 },
  rowGo: {
    color: Colors.textInverse,
    backgroundColor: Colors.primary,
    fontSize: FontSize.sm,
    fontWeight: '700',
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.md,
  },
  manage: { paddingTop: Spacing.md, alignItems: 'center' },
  manageText: { color: Colors.textSecondary, fontSize: FontSize.sm, textDecorationLine: 'underline' },
});
