import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  Pressable,
  Dimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import Svg, { Line, Circle, Polyline, Rect, Text as SvgText } from 'react-native-svg';
import { getWorkouts } from '../utils/storage';
import { Workout, WorkoutExercise } from '../types';
import { Colors, Spacing, FontSize, BorderRadius } from '../theme/colors';

interface SetDetail {
  setNumber: number;
  weight: number;
  reps: number;
  isWarmup?: boolean;
}

interface DataPoint {
  date: string;
  label: string;
  bestWeight: number;
  bestReps: number;
  totalVolume: number;
  sets: number;
  estimated1RM: number;
  setDetails: SetDetail[];
}

type Metric = 'weight' | 'volume' | 'e1rm';

const METRICS: { key: Metric; label: string }[] = [
  { key: 'weight', label: 'Best Weight' },
  { key: 'e1rm', label: 'Est. 1RM' },
  { key: 'volume', label: 'Volume' },
];

export function ExerciseHistoryScreen({ navigation, route }: any) {
  const { exerciseId, exerciseName } = route.params;
  const [data, setData] = useState<DataPoint[]>([]);
  const [metric, setMetric] = useState<Metric>('weight');
  const [expandedIdx, setExpandedIdx] = useState<number | null>(null);

  useEffect(() => {
    loadHistory();
  }, []);

  const loadHistory = async () => {
    const workouts = await getWorkouts();
    const points: DataPoint[] = [];

    // Go through workouts in chronological order (oldest first)
    const sorted = [...workouts].reverse();

    for (const w of sorted) {
      const exercises = w.exercises.filter(
        e => e.exerciseId === exerciseId || e.exercise?.id === exerciseId
      );
      if (exercises.length === 0) continue;

      for (const ex of exercises) {
        const completed = ex.sets.filter(s => s.completed && !s.isWarmup);
        if (completed.length === 0) continue;

        const bestWeight = Math.max(...completed.map(s => s.weight));
        const bestReps = Math.max(...completed.map(s => s.reps));
        const totalVolume = completed.reduce((sum, s) => sum + s.weight * s.reps, 0);

        // Epley formula for estimated 1RM
        const best1RM = Math.max(
          ...completed.map(s =>
            s.reps === 1 ? s.weight : s.weight * (1 + s.reps / 30)
          )
        );

        const d = new Date(w.startTime);
        const label = `${d.getDate()}/${d.getMonth() + 1}`;

        const setDetails: SetDetail[] = ex.sets
          .filter(s => s.completed)
          .map((s, i) => ({
            setNumber: i + 1,
            weight: s.weight,
            reps: s.reps,
            isWarmup: s.isWarmup,
          }));

        points.push({
          date: w.startTime,
          label,
          bestWeight,
          bestReps,
          totalVolume,
          sets: completed.length,
          estimated1RM: Math.round(best1RM * 10) / 10,
          setDetails,
        });
      }
    }

    setData(points);
  };

  const getValue = (p: DataPoint): number => {
    switch (metric) {
      case 'weight': return p.bestWeight;
      case 'volume': return p.totalVolume;
      case 'e1rm': return p.estimated1RM;
    }
  };

  const getUnit = (): string => {
    switch (metric) {
      case 'weight': return 'kg';
      case 'volume': return 'kg';
      case 'e1rm': return 'kg';
    }
  };

  // Summary stats
  const latestValue = data.length > 0 ? getValue(data[data.length - 1]) : 0;
  const firstValue = data.length > 0 ? getValue(data[0]) : 0;
  const maxValue = data.length > 0 ? Math.max(...data.map(getValue)) : 0;
  const change = data.length > 1 ? latestValue - firstValue : 0;
  const changePercent = firstValue > 0 ? Math.round((change / firstValue) * 100) : 0;

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <View style={styles.topBar}>
        <Pressable onPress={() => navigation.goBack()} hitSlop={8}>
          <Ionicons name="arrow-back" size={28} color={Colors.text} />
        </Pressable>
        <Text style={styles.topTitle} numberOfLines={1}>
          {exerciseName}
        </Text>
        <View style={{ width: 28 }} />
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        {data.length === 0 ? (
          <View style={styles.empty}>
            <Ionicons name="analytics-outline" size={48} color={Colors.textTertiary} />
            <Text style={styles.emptyTitle}>No history yet</Text>
            <Text style={styles.emptySubtitle}>
              Complete workouts with this exercise to see progress
            </Text>
          </View>
        ) : (
          <>
            {/* Metric Tabs */}
            <View style={styles.tabs}>
              {METRICS.map(m => (
                <Pressable
                  key={m.key}
                  onPress={() => setMetric(m.key)}
                  style={[styles.tab, metric === m.key && styles.tabActive]}
                >
                  <Text
                    style={[styles.tabText, metric === m.key && styles.tabTextActive]}
                  >
                    {m.label}
                  </Text>
                </Pressable>
              ))}
            </View>

            {/* Summary Cards */}
            <View style={styles.summaryRow}>
              <View style={styles.summaryCard}>
                <Text style={styles.summaryValue}>{formatVal(latestValue, metric)}</Text>
                <Text style={styles.summaryLabel}>Latest</Text>
              </View>
              <View style={styles.summaryCard}>
                <Text style={styles.summaryValue}>{formatVal(maxValue, metric)}</Text>
                <Text style={styles.summaryLabel}>Best</Text>
              </View>
              <View style={styles.summaryCard}>
                <Text style={[styles.summaryValue, change > 0 ? styles.positive : change < 0 ? styles.negative : null]}>
                  {change > 0 ? '+' : ''}{formatVal(change, metric)}
                </Text>
                <Text style={styles.summaryLabel}>
                  {changePercent !== 0 ? `${change > 0 ? '+' : ''}${changePercent}%` : 'Change'}
                </Text>
              </View>
              <View style={styles.summaryCard}>
                <Text style={styles.summaryValue}>{data.length}</Text>
                <Text style={styles.summaryLabel}>Sessions</Text>
              </View>
            </View>

            {/* Chart */}
            <View style={styles.chartContainer}>
              <Chart data={data} getValue={getValue} />
            </View>

            {/* History List */}
            <Text style={styles.sectionTitle}>Session History</Text>
            {[...data].reverse().map((p, i) => {
              const d = new Date(p.date);
              const dateStr = d.toLocaleDateString('en-GB', {
                day: 'numeric',
                month: 'short',
                year: 'numeric',
              });
              const isExpanded = expandedIdx === i;
              return (
                <Pressable
                  key={i}
                  onPress={() => setExpandedIdx(isExpanded ? null : i)}
                  style={styles.historyRow}
                >
                  <View style={styles.historyHeader}>
                    <Text style={styles.historyDate}>{dateStr}</Text>
                    <Ionicons
                      name={isExpanded ? 'chevron-up' : 'chevron-down'}
                      size={18}
                      color={Colors.textTertiary}
                    />
                  </View>
                  <View style={styles.historyStats}>
                    <View style={styles.historyStat}>
                      <Text style={styles.historyValue}>{p.bestWeight}</Text>
                      <Text style={styles.historyLabel}>kg</Text>
                    </View>
                    <View style={styles.historyStat}>
                      <Text style={styles.historyValue}>{p.bestReps}</Text>
                      <Text style={styles.historyLabel}>reps</Text>
                    </View>
                    <View style={styles.historyStat}>
                      <Text style={styles.historyValue}>{p.sets}</Text>
                      <Text style={styles.historyLabel}>sets</Text>
                    </View>
                    <View style={styles.historyStat}>
                      <Text style={styles.historyValue}>{p.totalVolume}</Text>
                      <Text style={styles.historyLabel}>vol</Text>
                    </View>
                  </View>

                  {isExpanded && (
                    <View style={styles.setDetailsContainer}>
                      <View style={styles.setDetailsHeader}>
                        <Text style={styles.setDetailsColHeader}>SET</Text>
                        <Text style={[styles.setDetailsColHeader, { flex: 1 }]}>WEIGHT</Text>
                        <Text style={[styles.setDetailsColHeader, { flex: 1 }]}>REPS</Text>
                      </View>
                      {p.setDetails.map((s, si) => (
                        <View key={si} style={styles.setDetailRow}>
                          <Text style={[styles.setDetailNum, s.isWarmup && styles.warmupText]}>
                            {s.isWarmup ? 'W' : s.setNumber}
                          </Text>
                          <Text style={[styles.setDetailValue, { flex: 1 }]}>{s.weight}</Text>
                          <Text style={[styles.setDetailValue, { flex: 1 }]}>{s.reps}</Text>
                        </View>
                      ))}
                    </View>
                  )}
                </Pressable>
              );
            })}
          </>
        )}

        <View style={{ height: 100 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

function formatVal(val: number, metric: Metric): string {
  if (metric === 'volume' && Math.abs(val) >= 1000) {
    return `${(val / 1000).toFixed(1)}k`;
  }
  if (Number.isInteger(val)) return String(val);
  return val.toFixed(1);
}

function Chart({ data, getValue }: { data: DataPoint[]; getValue: (p: DataPoint) => number }) {
  const screenWidth = Dimensions.get('window').width - Spacing.md * 2;
  const chartWidth = screenWidth - 50; // leave room for Y labels
  const chartHeight = 200;
  const padTop = 10;
  const padBottom = 30;
  const padLeft = 50;
  const padRight = 10;

  const values = data.map(getValue);
  const minVal = Math.min(...values);
  const maxVal = Math.max(...values);
  const range = maxVal - minVal || 1;

  const plotWidth = screenWidth - padLeft - padRight;
  const plotHeight = chartHeight - padTop - padBottom;

  const getX = (i: number) =>
    padLeft + (data.length === 1 ? plotWidth / 2 : (i / (data.length - 1)) * plotWidth);
  const getY = (val: number) =>
    padTop + plotHeight - ((val - minVal) / range) * plotHeight;

  const points = values.map((v, i) => `${getX(i)},${getY(v)}`).join(' ');

  // Y-axis labels (5 ticks)
  const yTicks = Array.from({ length: 5 }, (_, i) => {
    const val = minVal + (range * i) / 4;
    return { val, y: getY(val) };
  });

  // X-axis labels (show up to 6)
  const step = Math.max(1, Math.floor(data.length / 6));
  const xLabels = data.filter((_, i) => i % step === 0 || i === data.length - 1);

  return (
    <Svg width={screenWidth} height={chartHeight}>
      {/* Grid lines */}
      {yTicks.map((tick, i) => (
        <Line
          key={i}
          x1={padLeft}
          y1={tick.y}
          x2={screenWidth - padRight}
          y2={tick.y}
          stroke={Colors.border}
          strokeWidth={1}
        />
      ))}

      {/* Y-axis labels */}
      {yTicks.map((tick, i) => (
        <SvgText
          key={`y${i}`}
          x={padLeft - 6}
          y={tick.y + 4}
          fill={Colors.textSecondary}
          fontSize={11}
          fontWeight="600"
          textAnchor="end"
        >
          {tick.val >= 1000 ? `${(tick.val / 1000).toFixed(1)}k` : Math.round(tick.val)}
        </SvgText>
      ))}

      {/* Line */}
      {data.length > 1 && (
        <Polyline
          points={points}
          fill="none"
          stroke={Colors.text}
          strokeWidth={2.5}
          strokeLinejoin="round"
          strokeLinecap="round"
        />
      )}

      {/* Dots */}
      {values.map((v, i) => (
        <Circle
          key={i}
          cx={getX(i)}
          cy={getY(v)}
          r={data.length > 20 ? 2.5 : 4}
          fill={Colors.text}
        />
      ))}

      {/* X-axis labels */}
      {xLabels.map((p, i) => {
        const idx = data.indexOf(p);
        return (
          <SvgText
            key={`x${i}`}
            x={getX(idx)}
            y={chartHeight - 4}
            fill={Colors.textSecondary}
            fontSize={10}
            fontWeight="600"
            textAnchor="middle"
          >
            {p.label}
          </SvgText>
        );
      })}
    </Svg>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.bg },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  topTitle: {
    color: Colors.text,
    fontSize: FontSize.lg,
    fontWeight: '700',
    flex: 1,
    textAlign: 'center',
    marginHorizontal: Spacing.sm,
  },
  content: {
    padding: Spacing.md,
    gap: Spacing.md,
  },
  empty: {
    alignItems: 'center',
    paddingVertical: Spacing.xxl,
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
  tabs: {
    flexDirection: 'row',
    backgroundColor: Colors.bgCard,
    borderRadius: BorderRadius.md,
    padding: 3,
    gap: 3,
  },
  tab: {
    flex: 1,
    paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.sm,
    alignItems: 'center',
  },
  tabActive: {
    backgroundColor: Colors.text,
  },
  tabText: {
    color: Colors.textSecondary,
    fontSize: FontSize.xs,
    fontWeight: '700',
  },
  tabTextActive: {
    color: Colors.textInverse,
  },
  summaryRow: {
    flexDirection: 'row',
    gap: Spacing.sm,
  },
  summaryCard: {
    flex: 1,
    backgroundColor: Colors.bgCard,
    borderRadius: BorderRadius.md,
    padding: Spacing.sm,
    alignItems: 'center',
    gap: 2,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  summaryValue: {
    color: Colors.text,
    fontSize: FontSize.lg,
    fontWeight: '800',
  },
  summaryLabel: {
    color: Colors.textSecondary,
    fontSize: FontSize.xs,
    fontWeight: '600',
  },
  positive: {
    color: Colors.text,
  },
  negative: {
    color: Colors.textSecondary,
  },
  chartContainer: {
    backgroundColor: Colors.bgCard,
    borderRadius: BorderRadius.lg,
    padding: Spacing.sm,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  sectionTitle: {
    color: Colors.text,
    fontSize: FontSize.xl,
    fontWeight: '700',
    marginTop: Spacing.sm,
  },
  historyRow: {
    backgroundColor: Colors.bgCard,
    borderRadius: BorderRadius.md,
    padding: Spacing.md,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  historyHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: Spacing.xs,
  },
  historyDate: {
    color: Colors.text,
    fontSize: FontSize.md,
    fontWeight: '700',
  },
  historyStats: {
    flexDirection: 'row',
    gap: Spacing.md,
  },
  historyStat: {
    alignItems: 'center',
  },
  historyValue: {
    color: Colors.text,
    fontSize: FontSize.lg,
    fontWeight: '800',
  },
  historyLabel: {
    color: Colors.textSecondary,
    fontSize: FontSize.xs,
    fontWeight: '600',
  },
  setDetailsContainer: {
    marginTop: Spacing.sm,
    paddingTop: Spacing.sm,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
  },
  setDetailsHeader: {
    flexDirection: 'row',
    paddingBottom: Spacing.xs,
    marginBottom: Spacing.xs,
  },
  setDetailsColHeader: {
    color: Colors.textTertiary,
    fontSize: FontSize.xs,
    fontWeight: '700',
    width: 36,
    textAlign: 'center',
    letterSpacing: 0.5,
  },
  setDetailRow: {
    flexDirection: 'row',
    paddingVertical: 3,
    alignItems: 'center',
  },
  setDetailNum: {
    color: Colors.text,
    fontSize: FontSize.sm,
    fontWeight: '800',
    width: 36,
    textAlign: 'center',
  },
  setDetailValue: {
    color: Colors.text,
    fontSize: FontSize.md,
    fontWeight: '700',
    textAlign: 'center',
  },
  warmupText: {
    color: Colors.warning,
  },
});
