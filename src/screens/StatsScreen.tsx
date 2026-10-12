import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  Pressable,
  TextInput,
  Dimensions,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { Card } from '../components/Card';
import { MuscleGroupBadge } from '../components/MuscleGroupBadge';
import { getWorkouts, getPRs, getProfile, getMeasurements, saveMeasurement, deletePR, deletePRsForExercise } from '../utils/storage';
import { EXERCISE_MAP, MUSCLE_GROUP_LABELS } from '../data/exercises';
import {
  formatDuration,
  formatNumber,
  formatWeight,
  generateId,
  getMuscleGroupColor,
} from '../utils/helpers';
import Svg, { Polyline, Circle, Line, Text as SvgText } from 'react-native-svg';
import { Workout, PersonalRecord, BodyMeasurement, MuscleGroup, UserProfile } from '../types';
import { Colors, Spacing, FontSize, BorderRadius } from '../theme/colors';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

export function StatsScreen({ navigation }: any) {
  const [workouts, setWorkouts] = useState<Workout[]>([]);
  const [prs, setPRs] = useState<PersonalRecord[]>([]);
  const [measurements, setMeasurements] = useState<BodyMeasurement[]>([]);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [activeTab, setActiveTab] = useState<'overview' | 'prs' | 'muscles' | 'weight'>('overview');
  const [weightInput, setWeightInput] = useState('');

  const loadData = useCallback(async () => {
    const [ws, p, pr, ms] = await Promise.all([getWorkouts(), getProfile(), getPRs(), getMeasurements()]);
    setWorkouts(ws);
    setProfile(p);
    setPRs(pr);
    setMeasurements(ms);
  }, []);

  useEffect(() => {
    loadData();
    const unsub = navigation?.addListener?.('focus', loadData);
    return unsub;
  }, [loadData, navigation]);

  const unit = profile?.weightUnit ?? 'lbs';

  // Calculate weekly volume data (last 8 weeks)
  const weeklyVolume = getWeeklyData(workouts, 8);
  const maxVolume = Math.max(...weeklyVolume.map(w => w.volume), 1);

  // New charts: muscle volume, top lifts, frequency heatmap
  const muscleVolumeWeeks = getMuscleVolumeByWeek(workouts, 8);
  const top1RMTrends = getTop1RMTrends(workouts, 5);
  const frequencyHeatmap = getFrequencyHeatmap(workouts, 16);

  // Muscle group distribution
  const muscleDistribution = getMuscleDistribution(workouts);

  // Total stats
  const totalVolume = workouts.reduce((s, w) => s + w.totalVolume, 0);
  const totalSets = workouts.reduce((s, w) => s + w.totalSets, 0);
  const totalDuration = workouts.reduce((s, w) => s + w.duration, 0);
  const avgDuration = workouts.length > 0 ? totalDuration / workouts.length : 0;

  // Best PRs grouped by exercise
  const prsByExercise = groupPRsByExercise(prs);

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <View style={styles.header}>
        <Text style={styles.title}>Analytics</Text>
      </View>

      {/* Tabs */}
      <View style={styles.tabs}>
        {(['overview', 'prs', 'muscles', 'weight'] as const).map(tab => (
          <Pressable
            key={tab}
            onPress={() => setActiveTab(tab)}
            style={[styles.tab, activeTab === tab && styles.tabActive]}
          >
            <Text
              style={[
                styles.tabText,
                activeTab === tab && styles.tabTextActive,
              ]}
            >
              {tab === 'prs' ? 'PRs' : tab.charAt(0).toUpperCase() + tab.slice(1)}
            </Text>
          </Pressable>
        ))}
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        {activeTab === 'overview' && (
          <>
            {/* Summary Cards */}
            <View style={styles.grid}>
              <SummaryCard
                icon="barbell-outline"
                label="Total Workouts"
                value={String(workouts.length)}
                color={Colors.primary}
              />
              <SummaryCard
                icon="fitness-outline"
                label="Total Volume"
                value={formatNumber(totalVolume)}
                subtitle={unit}
                color={Colors.accent}
              />
              <SummaryCard
                icon="layers-outline"
                label="Total Sets"
                value={formatNumber(totalSets)}
                color={Colors.warning}
              />
              <SummaryCard
                icon="time-outline"
                label="Avg Duration"
                value={formatDuration(avgDuration)}
                color={Colors.cardio}
              />
            </View>

            {/* Volume Chart */}
            <Card style={styles.chartCard}>
              <Text style={styles.chartTitle}>Weekly Volume ({unit})</Text>
              <View style={styles.chart}>
                {weeklyVolume.map((w, i) => (
                  <View key={i} style={styles.barContainer}>
                    <Text style={styles.barValueLabel}>
                      {w.volume > 0 ? formatNumber(w.volume) : ''}
                    </Text>
                    <View style={styles.barWrapper}>
                      <LinearGradient
                        colors={[...Colors.gradientPrimary]}
                        style={[
                          styles.bar,
                          {
                            height: `${Math.max((w.volume / maxVolume) * 100, 2)}%`,
                          },
                        ]}
                      />
                    </View>
                    <Text style={styles.barLabel}>{w.label}</Text>
                  </View>
                ))}
              </View>
            </Card>

            {/* Workout Frequency Chart */}
            <Card style={styles.chartCard}>
              <Text style={styles.chartTitle}>Workouts per Week</Text>
              <View style={styles.chart}>
                {weeklyVolume.map((w, i) => {
                  const maxCount = Math.max(...weeklyVolume.map(x => x.count), 1);
                  return (
                    <View key={i} style={styles.barContainer}>
                      <Text style={styles.barValueLabel}>
                        {w.count > 0 ? w.count : ''}
                      </Text>
                      <View style={styles.barWrapper}>
                        <LinearGradient
                          colors={[...Colors.gradientAccent]}
                          style={[
                            styles.bar,
                            {
                              height: `${Math.max((w.count / maxCount) * 100, 2)}%`,
                            },
                          ]}
                        />
                      </View>
                      <Text style={styles.barLabel}>{w.label}</Text>
                    </View>
                  );
                })}
              </View>
            </Card>

            {/* Muscle Volume Stacked Chart */}
            <Card style={styles.chartCard}>
              <Text style={styles.chartTitle}>Volume by Muscle Group ({unit})</Text>
              <Text style={styles.chartSubtitle}>Last 8 weeks · stacked</Text>
              <MuscleVolumeChart weeks={muscleVolumeWeeks} />
              <View style={styles.legend}>
                {MUSCLE_BUCKETS.map(b => (
                  <View key={b.label} style={styles.legendItem}>
                    <View style={[styles.legendSwatch, { backgroundColor: muscleColor(b.label) }]} />
                    <Text style={styles.legendText}>{b.label}</Text>
                  </View>
                ))}
              </View>
            </Card>

            {/* Top Lifts 1RM Trend */}
            {top1RMTrends.length > 0 && (
              <Card style={styles.chartCard}>
                <Text style={styles.chartTitle}>Estimated 1RM Trends</Text>
                <Text style={styles.chartSubtitle}>Top {top1RMTrends.length} most-trained lifts</Text>
                <Top1RMChart trends={top1RMTrends} />
                <View style={styles.legend}>
                  {top1RMTrends.map((t, i) => (
                    <View key={t.exerciseId} style={styles.legendItem}>
                      <View style={[styles.legendSwatch, { backgroundColor: liftColor(i) }]} />
                      <Text style={styles.legendText} numberOfLines={1}>{t.exerciseName}</Text>
                    </View>
                  ))}
                </View>
              </Card>
            )}

            {/* Workout Frequency Heatmap */}
            <Card style={styles.chartCard}>
              <Text style={styles.chartTitle}>Workout Activity</Text>
              <Text style={styles.chartSubtitle}>Last 16 weeks</Text>
              <FrequencyHeatmap columns={frequencyHeatmap} />
            </Card>
          </>
        )}

        {activeTab === 'prs' && (
          <>
            {prsByExercise.length === 0 ? (
              <View style={styles.empty}>
                <Ionicons name="trophy-outline" size={64} color={Colors.textTertiary} />
                <Text style={styles.emptyTitle}>No PRs yet</Text>
                <Text style={styles.emptySubtitle}>
                  Complete workouts to start tracking personal records
                </Text>
              </View>
            ) : (
              prsByExercise.map(group => (
                <Pressable
                  key={group.exerciseId}
                  onLongPress={() => {
                    Alert.alert(
                      'Delete PR?',
                      `Remove personal record for ${group.exerciseName}?`,
                      [
                        { text: 'Cancel', style: 'cancel' },
                        {
                          text: 'Delete',
                          style: 'destructive',
                          onPress: async () => {
                            await deletePRsForExercise(group.exerciseId);
                            loadData();
                          },
                        },
                      ]
                    );
                  }}
                >
                  <Card style={styles.prCard}>
                    {/* Top row: exercise name */}
                    <Text style={styles.prExercise}>{group.exerciseName}</Text>

                    {/* Big E1RM display */}
                    <View style={styles.prE1RMRow}>
                      <View style={styles.prE1RMBadge}>
                        <Ionicons name="trophy" size={22} color="#000000" />
                      </View>
                      <View style={styles.prE1RMInfo}>
                        <Text style={styles.prE1RMValue}>
                          {formatWeight(Math.round(group.bestE1RM!), unit)}
                        </Text>
                        <Text style={styles.prE1RMLabel}>Estimated 1RM</Text>
                      </View>
                    </View>

                    {/* Details row */}
                    <View style={styles.prBottomRow}>
                      {group.setWeight && group.setReps ? (
                        <View style={styles.prDetailChip}>
                          <Ionicons name="barbell-outline" size={12} color={Colors.textSecondary} />
                          <Text style={styles.prDetailText}>
                            {group.setWeight}{unit} × {group.setReps}
                          </Text>
                        </View>
                      ) : null}
                      {group.date ? (
                        <View style={styles.prDetailChip}>
                          <Ionicons name="calendar-outline" size={12} color={Colors.textSecondary} />
                          <Text style={styles.prDetailText}>
                            {new Date(group.date).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}
                          </Text>
                        </View>
                      ) : null}
                    </View>
                  </Card>
                </Pressable>
              ))
            )}
          </>
        )}

        {activeTab === 'muscles' && (
          <>
            <Card style={styles.chartCard}>
              <Text style={styles.chartTitle}>Muscle Group Distribution</Text>
              <View style={styles.muscleList}>
                {muscleDistribution.map(m => (
                  <View key={m.muscle} style={styles.muscleRow}>
                    <MuscleGroupBadge muscle={m.muscle} size="md" />
                    <View style={styles.muscleBar}>
                      <View
                        style={[
                          styles.muscleBarFill,
                          {
                            width: `${m.percentage}%`,
                            backgroundColor: getMuscleGroupColor(m.muscle),
                          },
                        ]}
                      />
                    </View>
                    <Text style={styles.musclePercent}>
                      {Math.round(m.percentage)}%
                    </Text>
                    <Text style={styles.muscleSets}>{m.sets} sets</Text>
                  </View>
                ))}
              </View>
            </Card>
          </>
        )}

        {activeTab === 'weight' && (
          <>
            {/* Quick Log */}
            <Card style={styles.chartCard}>
              <Text style={styles.chartTitle}>Log Body Weight</Text>
              <View style={weightStyles.logRow}>
                <TextInput
                  style={weightStyles.logInput}
                  value={weightInput}
                  onChangeText={t => setWeightInput(t.replace(/[^0-9.]/g, ''))}
                  keyboardType="numeric"
                  placeholder={`Weight (${unit})`}
                  placeholderTextColor={Colors.textTertiary}
                />
                <Pressable
                  onPress={async () => {
                    const val = parseFloat(weightInput);
                    if (!val || val <= 0) {
                      Alert.alert('Invalid', 'Enter a valid weight.');
                      return;
                    }
                    await saveMeasurement({
                      id: generateId(),
                      date: new Date().toISOString(),
                      weight: val,
                    });
                    setWeightInput('');
                    loadData();
                  }}
                  style={weightStyles.logBtn}
                >
                  <Text style={weightStyles.logBtnText}>Log</Text>
                </Pressable>
              </View>
            </Card>

            {/* Weight Chart */}
            {(() => {
              const weightEntries = measurements
                .filter(m => m.weight && m.weight > 0)
                .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

              if (weightEntries.length < 2) {
                return (
                  <View style={styles.empty}>
                    <Ionicons name="scale-outline" size={64} color={Colors.textTertiary} />
                    <Text style={styles.emptyTitle}>Not enough data</Text>
                    <Text style={styles.emptySubtitle}>
                      Log at least 2 weigh-ins to see your trend
                    </Text>
                  </View>
                );
              }

              const weights = weightEntries.map(m => m.weight!);
              const minW = Math.min(...weights);
              const maxW = Math.max(...weights);
              const range = maxW - minW || 1;
              const chartW = SCREEN_WIDTH - Spacing.md * 2 - Spacing.lg * 2;
              const chartH = 180;
              const padT = 20;
              const padB = 30;
              const graphH = chartH - padT - padB;

              const points = weightEntries.map((m, i) => {
                const x = weightEntries.length === 1 ? chartW / 2 :
                  (i / (weightEntries.length - 1)) * chartW;
                const y = padT + graphH - ((m.weight! - minW) / range) * graphH;
                return { x, y, weight: m.weight!, date: m.date };
              });

              const polyPoints = points.map(p => `${p.x},${p.y}`).join(' ');

              const latest = weights[weights.length - 1];
              const first = weights[0];
              const change = latest - first;
              const changePercent = ((change / first) * 100).toFixed(1);

              return (
                <>
                  {/* Summary */}
                  <View style={styles.grid}>
                    <SummaryCard
                      icon="scale-outline"
                      label="Current"
                      value={String(latest)}
                      subtitle={unit}
                      color={Colors.primary}
                    />
                    <SummaryCard
                      icon="trending-up"
                      label="Change"
                      value={`${change > 0 ? '+' : ''}${change.toFixed(1)}`}
                      subtitle={`${changePercent}%`}
                      color={change > 0 ? Colors.warning : Colors.accent}
                    />
                  </View>

                  {/* Graph */}
                  <Card style={styles.chartCard}>
                    <Text style={styles.chartTitle}>Weight Trend</Text>
                    <Svg width={chartW} height={chartH}>
                      {/* Grid lines */}
                      {[0, 0.25, 0.5, 0.75, 1].map(frac => {
                        const y = padT + graphH - frac * graphH;
                        const val = (minW + frac * range).toFixed(1);
                        return (
                          <React.Fragment key={frac}>
                            <Line x1={0} y1={y} x2={chartW} y2={y} stroke={Colors.border} strokeWidth={1} />
                            <SvgText x={0} y={y - 4} fill={Colors.textTertiary} fontSize={10}>
                              {val}
                            </SvgText>
                          </React.Fragment>
                        );
                      })}
                      <Polyline
                        points={polyPoints}
                        fill="none"
                        stroke={Colors.primary}
                        strokeWidth={2.5}
                        strokeLinejoin="round"
                      />
                      {points.map((p, i) => (
                        <Circle
                          key={i}
                          cx={p.x}
                          cy={p.y}
                          r={4}
                          fill={Colors.primary}
                          stroke={Colors.bg}
                          strokeWidth={2}
                        />
                      ))}
                      {/* Date labels for first and last */}
                      {points.length > 0 && (
                        <>
                          <SvgText x={0} y={chartH - 4} fill={Colors.textTertiary} fontSize={10}>
                            {new Date(points[0].date).toLocaleDateString('en-GB', { month: 'short', day: 'numeric' })}
                          </SvgText>
                          <SvgText x={chartW} y={chartH - 4} fill={Colors.textTertiary} fontSize={10} textAnchor="end">
                            {new Date(points[points.length - 1].date).toLocaleDateString('en-GB', { month: 'short', day: 'numeric' })}
                          </SvgText>
                        </>
                      )}
                    </Svg>
                  </Card>

                  {/* History */}
                  <Card style={styles.chartCard}>
                    <Text style={styles.chartTitle}>History</Text>
                    {weightEntries.slice().reverse().slice(0, 20).map(m => (
                      <View key={m.id} style={weightStyles.histRow}>
                        <Text style={weightStyles.histDate}>
                          {new Date(m.date).toLocaleDateString('en-GB', {
                            month: 'short', day: 'numeric', year: 'numeric',
                          })}
                        </Text>
                        <Text style={weightStyles.histWeight}>
                          {m.weight} {unit}
                        </Text>
                      </View>
                    ))}
                  </Card>
                </>
              );
            })()}
          </>
        )}

        <View style={{ height: 100 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

function SummaryCard({
  icon,
  label,
  value,
  subtitle,
  color,
}: {
  icon: string;
  label: string;
  value: string;
  subtitle?: string;
  color: string;
}) {
  return (
    <View style={[sumStyles.card, { borderColor: color + '33' }]}>
      <Ionicons name={icon as any} size={24} color={color} />
      <Text style={[sumStyles.value, { color }]}>
        {value}
        {subtitle && <Text style={sumStyles.subtitle}> {subtitle}</Text>}
      </Text>
      <Text style={sumStyles.label}>{label}</Text>
    </View>
  );
}

// Helpers
function getWeeklyData(workouts: Workout[], weeks: number) {
  const result = [];
  const now = new Date();

  for (let i = weeks - 1; i >= 0; i--) {
    const weekStart = new Date(now);
    weekStart.setDate(now.getDate() - now.getDay() - i * 7);
    weekStart.setHours(0, 0, 0, 0);
    const weekEnd = new Date(weekStart);
    weekEnd.setDate(weekStart.getDate() + 7);

    const weekWorkouts = workouts.filter(w => {
      const d = new Date(w.startTime);
      return d >= weekStart && d < weekEnd;
    });

    // Show date range like "3/9" (month/day of week start)
    const label = `${weekStart.getMonth() + 1}/${weekStart.getDate()}`;

    result.push({
      label,
      volume: weekWorkouts.reduce((s, w) => s + w.totalVolume, 0),
      count: weekWorkouts.length,
    });
  }

  return result;
}

function getMuscleDistribution(workouts: Workout[]) {
  const counts: Record<string, number> = {};
  let total = 0;

  workouts.forEach(w => {
    w.exercises.forEach(e => {
      const muscle = e.exercise.primaryMuscle;
      const sets = e.sets.filter(s => s.completed && !s.isWarmup).length;
      counts[muscle] = (counts[muscle] || 0) + sets;
      total += sets;
    });
  });

  return Object.entries(counts)
    .map(([muscle, sets]) => ({
      muscle: muscle as MuscleGroup,
      sets,
      percentage: total > 0 ? (sets / total) * 100 : 0,
    }))
    .sort((a, b) => b.sets - a.sets);
}

// Top-level muscle group categories that the heatmap groups into
const MUSCLE_BUCKETS: { label: string; matches: MuscleGroup[] }[] = [
  { label: 'Chest', matches: ['chest'] },
  { label: 'Back', matches: ['back', 'lats', 'traps'] },
  { label: 'Legs', matches: ['quads', 'hamstrings', 'glutes', 'adductors', 'abductors', 'calves'] },
  { label: 'Shoulders', matches: ['shoulders'] },
  { label: 'Arms', matches: ['biceps', 'triceps', 'forearms'] },
  { label: 'Core', matches: ['core'] },
];

function bucketForMuscle(m: MuscleGroup): string | null {
  for (const b of MUSCLE_BUCKETS) {
    if (b.matches.includes(m)) return b.label;
  }
  return null;
}

// Weekly volume by muscle group bucket (last N weeks)
function getMuscleVolumeByWeek(workouts: Workout[], weeks: number) {
  const now = new Date();
  const result: { label: string; byMuscle: Record<string, number>; total: number }[] = [];

  for (let i = weeks - 1; i >= 0; i--) {
    const weekStart = new Date(now);
    weekStart.setDate(now.getDate() - now.getDay() - i * 7);
    weekStart.setHours(0, 0, 0, 0);
    const weekEnd = new Date(weekStart);
    weekEnd.setDate(weekStart.getDate() + 7);

    const weekWorkouts = workouts.filter(w => {
      const d = new Date(w.startTime);
      return d >= weekStart && d < weekEnd;
    });

    const byMuscle: Record<string, number> = {};
    let total = 0;
    weekWorkouts.forEach(w => {
      w.exercises.forEach(e => {
        const bucket = bucketForMuscle(e.exercise.primaryMuscle) || 'Other';
        const vol = e.sets
          .filter(s => s.completed && !s.isWarmup)
          .reduce((sum, s) => sum + Math.abs(s.weight) * s.reps, 0);
        byMuscle[bucket] = (byMuscle[bucket] || 0) + vol;
        total += vol;
      });
    });

    result.push({
      label: `${weekStart.getMonth() + 1}/${weekStart.getDate()}`,
      byMuscle,
      total,
    });
  }
  return result;
}

// E1RM trend over time for top N most-frequent exercises
function getTop1RMTrends(workouts: Workout[], n: number) {
  // Count frequency of each exercise across all workouts
  const freq: Record<string, number> = {};
  workouts.forEach(w => {
    const seenInWorkout = new Set<string>();
    w.exercises.forEach(e => {
      if (!seenInWorkout.has(e.exerciseId)) {
        freq[e.exerciseId] = (freq[e.exerciseId] || 0) + 1;
        seenInWorkout.add(e.exerciseId);
      }
    });
  });

  const topIds = Object.entries(freq)
    .sort((a, b) => b[1] - a[1])
    .slice(0, n)
    .map(([id]) => id);

  // For each top exercise, compute best E1RM per workout
  const sorted = [...workouts].sort(
    (a, b) => new Date(a.startTime).getTime() - new Date(b.startTime).getTime()
  );

  const trends = topIds.map(eid => {
    const points: { date: string; e1rm: number }[] = [];
    let exerciseName = '';
    sorted.forEach(w => {
      w.exercises.forEach(e => {
        if (e.exerciseId !== eid) return;
        if (!exerciseName) exerciseName = e.exercise?.name || EXERCISE_MAP.get(eid)?.name || eid;
        let bestE1RM = 0;
        e.sets.forEach(s => {
          if (s.completed && !s.isWarmup && s.weight !== 0 && s.reps > 0) {
            const repsForCalc = Math.min(s.reps, 12);
            const e1rm = s.weight * (1 + repsForCalc / 30);
            if (e1rm > bestE1RM) bestE1RM = e1rm;
          }
        });
        if (bestE1RM > 0) {
          points.push({ date: w.startTime, e1rm: Math.round(bestE1RM * 10) / 10 });
        }
      });
    });
    return { exerciseId: eid, exerciseName, points };
  }).filter(t => t.points.length >= 2);

  return trends;
}

// Workout frequency: 7 rows (days of week) x weeks columns of booleans
function getFrequencyHeatmap(workouts: Workout[], weeks: number) {
  const now = new Date();
  const todayStr = now.toISOString().split('T')[0];

  // Workout dates as set of YYYY-MM-DD strings
  const workoutDates = new Set(
    workouts.map(w => new Date(w.startTime).toISOString().split('T')[0])
  );

  // Build columns from oldest to newest
  const columns: { dates: string[]; activity: boolean[] }[] = [];
  for (let w = weeks - 1; w >= 0; w--) {
    const weekStart = new Date(now);
    weekStart.setDate(now.getDate() - now.getDay() - w * 7);
    weekStart.setHours(0, 0, 0, 0);

    const dates: string[] = [];
    const activity: boolean[] = [];
    for (let d = 0; d < 7; d++) {
      const day = new Date(weekStart);
      day.setDate(weekStart.getDate() + d);
      const ds = day.toISOString().split('T')[0];
      dates.push(ds);
      // Don't show future days as available
      activity.push(day <= now && workoutDates.has(ds));
    }
    columns.push({ dates, activity });
  }
  return columns;
}

// Monochrome color palette for muscle groups (e-ink friendly grayscale)
const MUSCLE_COLORS: Record<string, string> = {
  Chest: '#FFFFFF',
  Back: '#CCCCCC',
  Legs: '#999999',
  Shoulders: '#777777',
  Arms: '#555555',
  Core: '#333333',
  Other: '#222222',
};
function muscleColor(label: string): string {
  return MUSCLE_COLORS[label] ?? '#666666';
}

// Different shades for top lifts trend lines
const LIFT_SHADES = ['#FFFFFF', '#CCCCCC', '#999999', '#777777', '#555555'];
function liftColor(idx: number): string {
  return LIFT_SHADES[idx % LIFT_SHADES.length];
}

function MuscleVolumeChart({ weeks }: { weeks: { label: string; byMuscle: Record<string, number>; total: number }[] }) {
  const maxTotal = Math.max(...weeks.map(w => w.total), 1);
  const buckets = [...MUSCLE_BUCKETS.map(b => b.label), 'Other'];

  return (
    <View style={styles.chart}>
      {weeks.map((w, i) => {
        const heightPct = (w.total / maxTotal) * 100;
        return (
          <View key={i} style={styles.barContainer}>
            <Text style={styles.barValueLabel}>
              {w.total > 0 ? formatNumber(w.total) : ''}
            </Text>
            <View style={styles.barWrapper}>
              <View style={[styles.stackedBar, { height: `${Math.max(heightPct, 2)}%` }]}>
                {buckets.map(label => {
                  const v = w.byMuscle[label] || 0;
                  if (v <= 0) return null;
                  const pct = (v / w.total) * 100;
                  return (
                    <View
                      key={label}
                      style={{
                        height: `${pct}%`,
                        backgroundColor: muscleColor(label),
                        width: '100%',
                      }}
                    />
                  );
                })}
              </View>
            </View>
            <Text style={styles.barLabel}>{w.label}</Text>
          </View>
        );
      })}
    </View>
  );
}

function Top1RMChart({ trends }: { trends: { exerciseId: string; exerciseName: string; points: { date: string; e1rm: number }[] }[] }) {
  const chartW = SCREEN_WIDTH - Spacing.md * 4;
  const chartH = 180;
  const padTop = 10;
  const padBottom = 22;
  const padLeft = 36;
  const padRight = 8;

  // Find global min/max e1rm across all trends to align scale
  const allValues = trends.flatMap(t => t.points.map(p => p.e1rm));
  const allDates = trends.flatMap(t => t.points.map(p => new Date(p.date).getTime()));
  if (allValues.length === 0 || allDates.length === 0) return null;
  const minVal = Math.min(...allValues);
  const maxVal = Math.max(...allValues);
  const minDate = Math.min(...allDates);
  const maxDate = Math.max(...allDates);
  const valRange = maxVal - minVal || 1;
  const dateRange = maxDate - minDate || 1;
  const plotW = chartW - padLeft - padRight;
  const plotH = chartH - padTop - padBottom;

  const xFor = (d: number) => padLeft + ((d - minDate) / dateRange) * plotW;
  const yFor = (v: number) => padTop + plotH - ((v - minVal) / valRange) * plotH;

  // Y-axis ticks
  const yTicks = Array.from({ length: 4 }, (_, i) => {
    const val = minVal + (valRange * i) / 3;
    return { val, y: yFor(val) };
  });

  return (
    <Svg width={chartW} height={chartH}>
      {yTicks.map((t, i) => (
        <Line
          key={`g${i}`}
          x1={padLeft}
          y1={t.y}
          x2={chartW - padRight}
          y2={t.y}
          stroke={Colors.border}
          strokeWidth={1}
        />
      ))}
      {yTicks.map((t, i) => (
        <SvgText
          key={`yl${i}`}
          x={padLeft - 4}
          y={t.y + 3}
          fill={Colors.textSecondary}
          fontSize={10}
          fontWeight="600"
          textAnchor="end"
        >
          {Math.round(t.val)}
        </SvgText>
      ))}
      {trends.map((t, ti) => {
        const points = t.points
          .map(p => `${xFor(new Date(p.date).getTime())},${yFor(p.e1rm)}`)
          .join(' ');
        return (
          <React.Fragment key={t.exerciseId}>
            <Polyline
              points={points}
              fill="none"
              stroke={liftColor(ti)}
              strokeWidth={2}
              strokeLinejoin="round"
              strokeLinecap="round"
            />
            {t.points.map((p, pi) => (
              <Circle
                key={`${t.exerciseId}-${pi}`}
                cx={xFor(new Date(p.date).getTime())}
                cy={yFor(p.e1rm)}
                r={2.5}
                fill={liftColor(ti)}
              />
            ))}
          </React.Fragment>
        );
      })}
    </Svg>
  );
}

function FrequencyHeatmap({ columns }: { columns: { dates: string[]; activity: boolean[] }[] }) {
  const cellSize = 14;
  const gap = 3;
  const dayLabels = ['M', '', 'W', '', 'F', '', 'S']; // Sun start: shifts below

  // Standard week-starts-on-Sunday (matches getDay() output)
  const sundayLabels = ['S', '', 'T', '', 'T', '', 'S'];

  return (
    <View>
      <View style={{ flexDirection: 'row' }}>
        {/* Day-of-week labels on the left */}
        <View style={{ marginRight: 6, justifyContent: 'space-between', paddingVertical: 1 }}>
          {sundayLabels.map((l, i) => (
            <Text key={i} style={styles.heatmapDayLabel}>{l}</Text>
          ))}
        </View>
        <View style={{ flexDirection: 'row', flex: 1, justifyContent: 'space-between' }}>
          {columns.map((col, ci) => (
            <View key={ci} style={{ gap }}>
              {col.activity.map((on, di) => (
                <View
                  key={di}
                  style={{
                    width: cellSize,
                    height: cellSize,
                    borderRadius: 2,
                    backgroundColor: on ? Colors.text : Colors.bgElevated,
                    borderWidth: 1,
                    borderColor: Colors.border,
                  }}
                />
              ))}
            </View>
          ))}
        </View>
      </View>
    </View>
  );
}

function groupPRsByExercise(prs: PersonalRecord[]) {
  const groups: Record<
    string,
    {
      exerciseId: string;
      exerciseName: string;
      bestE1RM?: number;
      bestE1RMId?: string;
      setWeight?: number;
      setReps?: number;
      date?: string;
    }
  > = {};

  prs.forEach(pr => {
    if (!groups[pr.exerciseId]) {
      const ex = EXERCISE_MAP.get(pr.exerciseId);
      groups[pr.exerciseId] = {
        exerciseId: pr.exerciseId,
        exerciseName: pr.exerciseName || ex?.name || pr.exerciseId,
      };
    }

    const g = groups[pr.exerciseId];
    if (pr.type === 'one_rep_max' && (!g.bestE1RM || pr.value > g.bestE1RM)) {
      g.bestE1RM = pr.value;
      g.bestE1RMId = pr.id;
      g.setWeight = pr.setWeight;
      g.setReps = pr.setReps;
      g.date = pr.date;
    }
  });

  return Object.values(groups).filter(g => g.bestE1RM);
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.bg },
  header: {
    paddingHorizontal: Spacing.md,
    paddingTop: Spacing.md,
  },
  title: {
    color: Colors.text,
    fontSize: FontSize.xxxl,
    fontWeight: '800',
  },
  tabs: {
    flexDirection: 'row',
    margin: Spacing.md,
    backgroundColor: Colors.bgCard,
    borderRadius: BorderRadius.md,
    padding: 3,
  },
  tab: {
    flex: 1,
    paddingVertical: Spacing.sm + 2,
    alignItems: 'center',
    borderRadius: BorderRadius.sm,
  },
  tabActive: {
    backgroundColor: Colors.primary,
  },
  tabText: {
    color: Colors.textSecondary,
    fontSize: FontSize.sm,
    fontWeight: '700',
  },
  tabTextActive: {
    color: Colors.textInverse,
  },
  content: {
    padding: Spacing.md,
    gap: Spacing.md,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.sm,
  },
  chartCard: {
    gap: Spacing.md,
  },
  chartTitle: {
    color: Colors.text,
    fontSize: FontSize.lg,
    fontWeight: '700',
  },
  chartSubtitle: {
    color: Colors.textTertiary,
    fontSize: FontSize.xs,
    fontWeight: '600',
    marginTop: -Spacing.sm,
  },
  stackedBar: {
    width: '100%',
    flexDirection: 'column-reverse',
    borderRadius: BorderRadius.sm,
    overflow: 'hidden',
    minHeight: 4,
  },
  legend: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.sm,
    marginTop: Spacing.xs,
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
  },
  legendSwatch: {
    width: 10,
    height: 10,
    borderRadius: 2,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  legendText: {
    color: Colors.textSecondary,
    fontSize: FontSize.xs,
    fontWeight: '600',
  },
  heatmapDayLabel: {
    color: Colors.textTertiary,
    fontSize: 9,
    fontWeight: '700',
    height: 14,
    lineHeight: 14,
  },
  chart: {
    flexDirection: 'row',
    height: 160,
    gap: Spacing.xs,
    alignItems: 'flex-end',
  },
  barContainer: {
    flex: 1,
    alignItems: 'center',
    gap: Spacing.xs,
  },
  barWrapper: {
    flex: 1,
    width: '100%',
    justifyContent: 'flex-end',
    borderRadius: BorderRadius.sm,
    overflow: 'hidden',
  },
  bar: {
    width: '100%',
    borderRadius: BorderRadius.sm,
    minHeight: 4,
  },
  barValueLabel: {
    color: Colors.text,
    fontSize: 9,
    fontWeight: '700',
    textAlign: 'center',
  },
  barLabel: {
    color: Colors.text,
    fontSize: 10,
    fontWeight: '700',
  },
  prCard: {
    gap: Spacing.md,
    borderWidth: 1,
    borderColor: Colors.borderLight,
  },
  prExercise: {
    color: Colors.text,
    fontSize: FontSize.md,
    fontWeight: '700',
    letterSpacing: 0.3,
  },
  prE1RMRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
  },
  prE1RMBadge: {
    width: 44,
    height: 44,
    borderRadius: BorderRadius.round,
    backgroundColor: Colors.text,
    alignItems: 'center',
    justifyContent: 'center',
  },
  prE1RMInfo: {
    flex: 1,
  },
  prE1RMValue: {
    color: Colors.text,
    fontSize: FontSize.xxxl,
    fontWeight: '900',
    letterSpacing: -1,
  },
  prE1RMLabel: {
    color: Colors.textTertiary,
    fontSize: FontSize.xs,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  prBottomRow: {
    flexDirection: 'row',
    gap: Spacing.sm,
  },
  prDetailChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
    backgroundColor: Colors.bgElevated,
    paddingHorizontal: Spacing.sm + 2,
    paddingVertical: Spacing.xs + 1,
    borderRadius: BorderRadius.round,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  prDetailText: {
    color: Colors.textSecondary,
    fontSize: FontSize.xs,
    fontWeight: '600',
  },
  empty: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: Spacing.xxl,
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
    textAlign: 'center',
  },
  muscleList: {
    gap: Spacing.sm,
  },
  muscleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  muscleBar: {
    flex: 1,
    height: 8,
    backgroundColor: Colors.bgInput,
    borderRadius: 4,
    overflow: 'hidden',
  },
  muscleBarFill: {
    height: '100%',
    borderRadius: 4,
  },
  musclePercent: {
    color: Colors.text,
    fontSize: FontSize.sm,
    fontWeight: '700',
    width: 40,
    textAlign: 'right',
  },
  muscleSets: {
    color: Colors.textSecondary,
    fontSize: FontSize.xs,
    width: 50,
    textAlign: 'right',
  },
});

const sumStyles = StyleSheet.create({
  card: {
    width: (SCREEN_WIDTH - Spacing.md * 2 - Spacing.sm) / 2,
    backgroundColor: Colors.bgCard,
    borderRadius: BorderRadius.md,
    padding: Spacing.md,
    gap: Spacing.xs,
    borderWidth: 1,
  },
  value: {
    fontSize: FontSize.xxl,
    fontWeight: '800',
  },
  subtitle: {
    fontSize: FontSize.sm,
    fontWeight: '600',
  },
  label: {
    color: Colors.textSecondary,
    fontSize: FontSize.xs,
    fontWeight: '600',
  },
});

const weightStyles = StyleSheet.create({
  logRow: {
    flexDirection: 'row',
    gap: Spacing.sm,
  },
  logInput: {
    flex: 1,
    backgroundColor: Colors.bgInput,
    borderRadius: BorderRadius.md,
    padding: Spacing.md,
    color: Colors.text,
    fontSize: FontSize.lg,
    fontWeight: '700',
    borderWidth: 1,
    borderColor: Colors.border,
  },
  logBtn: {
    backgroundColor: Colors.primary,
    borderRadius: BorderRadius.md,
    paddingHorizontal: Spacing.lg,
    justifyContent: 'center',
    alignItems: 'center',
  },
  logBtnText: {
    color: Colors.textInverse,
    fontSize: FontSize.md,
    fontWeight: '800',
  },
  histRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: Spacing.sm,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
  },
  histDate: {
    color: Colors.textSecondary,
    fontSize: FontSize.sm,
    fontWeight: '600',
  },
  histWeight: {
    color: Colors.text,
    fontSize: FontSize.lg,
    fontWeight: '800',
  },
});
