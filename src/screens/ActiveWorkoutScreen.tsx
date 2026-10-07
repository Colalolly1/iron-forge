import React, { useState, useEffect, useRef, useCallback, createRef } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  Pressable,
  Alert,
  Modal,
  TextInput,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useWorkout } from '../context/WorkoutContext';
import { ExerciseCard, ExerciseCardRef } from '../components/ExerciseCard';
import { RestTimerBar } from '../components/RestTimer';
import { Button } from '../components/Button';
import { ExercisePickerModal } from '../components/ExercisePickerModal';
import { getProfile } from '../utils/storage';
import { BODY_PART_LABELS, targetProgress, whatsLeft } from '../utils/bodyParts';
import {
  formatTimer,
  formatWeight,
  calculateVolume,
} from '../utils/helpers';
import { UserProfile, PersonalRecord } from '../types';
import { Colors, Spacing, FontSize, BorderRadius } from '../theme/colors';

export function ActiveWorkoutScreen({ navigation }: any) {
  const {
    activeWorkout,
    isWorkoutActive,
    finishWorkout,
    discardWorkout,
    addExercise,
    reorderExercise,
    toggleSuperset,
    pickForTarget,
    newPRs,
    clearPRs,
  } = useWorkout();
  const [elapsed, setElapsed] = useState(0);
  const [showExercisePicker, setShowExercisePicker] = useState(false);
  const [pickingTarget, setPickingTarget] = useState<string | null>(null);
  // A second tap on Finish while the first save is still running used to
  // write the workout twice (hence duplicate entries in History). Declared
  // before the early return below so the hook order never changes.
  const finishing = useRef(false);
  const [showFinishModal, setShowFinishModal] = useState(false);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [workoutName, setWorkoutName] = useState('');
  const cardRefs = useRef<Map<string, React.RefObject<ExerciseCardRef | null>>>(new Map());

  // Get or create a ref for an exercise card
  const getCardRef = useCallback((exerciseId: string) => {
    if (!cardRefs.current.has(exerciseId)) {
      cardRefs.current.set(exerciseId, createRef<ExerciseCardRef>());
    }
    return cardRefs.current.get(exerciseId)!;
  }, []);

  // Handle set completion — figures out where to focus next
  // For supersets: A set1 → B set1 → A set2 → B set2 etc.
  // For normal: next uncompleted set in same exercise
  const handleSetCompleted = useCallback((exerciseId: string, setIdx: number) => {
    if (!activeWorkout) return;

    const exercise = activeWorkout.exercises.find(e => e.id === exerciseId);
    if (!exercise) return;

    if (exercise.supersetGroupId) {
      // Find all exercises in this superset group, in order
      const groupExercises = activeWorkout.exercises.filter(
        e => e.supersetGroupId === exercise.supersetGroupId
      );
      const myGroupIdx = groupExercises.findIndex(e => e.id === exerciseId);

      // Try next exercise in the group at the same set index
      for (let offset = 1; offset <= groupExercises.length; offset++) {
        const nextGroupIdx = (myGroupIdx + offset) % groupExercises.length;
        const nextExercise = groupExercises[nextGroupIdx];
        // If we've wrapped around, move to next set index
        const targetSetIdx = nextGroupIdx > myGroupIdx ? setIdx : setIdx + 1;

        if (targetSetIdx < nextExercise.sets.length && !nextExercise.sets[targetSetIdx].completed) {
          const ref = cardRefs.current.get(nextExercise.id);
          ref?.current?.focusSet(targetSetIdx);
          return;
        }
      }
    } else {
      // Non-superset: focus next uncompleted set in same exercise
      const nextIdx = exercise.sets.findIndex((s, i) => i > setIdx && !s.completed);
      if (nextIdx >= 0) {
        const ref = cardRefs.current.get(exerciseId);
        ref?.current?.focusSet(nextIdx);
      }
    }
  }, [activeWorkout]);

  useEffect(() => {
    getProfile().then(setProfile);
  }, []);

  useEffect(() => {
    if (!activeWorkout) return;
    setWorkoutName(activeWorkout.name);

    const timer = setInterval(() => {
      const start = new Date(activeWorkout.startTime).getTime();
      setElapsed(Math.floor((Date.now() - start) / 1000));
    }, 1000);

    return () => clearInterval(timer);
  }, [activeWorkout?.startTime]);

  if (!activeWorkout || !isWorkoutActive) {
    return (
      <SafeAreaView style={styles.safe}>
        <View style={styles.empty}>
          <Ionicons name="barbell-outline" size={64} color={Colors.textTertiary} />
          <Text style={styles.emptyTitle}>No active workout</Text>
          <Button
            title="Start Workout"
            onPress={() => navigation.goBack()}
          />
        </View>
      </SafeAreaView>
    );
  }

  const progress = targetProgress(activeWorkout);
  const targetById = new Map((activeWorkout.targets ?? []).map(t => [t.id, t]));

  const totalVolume = activeWorkout.exercises.reduce(
    (sum, e) => sum + calculateVolume(e.sets),
    0
  );
  const completedSets = activeWorkout.exercises.reduce(
    (sum, e) => sum + e.sets.filter(s => s.completed && !s.isWarmup).length,
    0
  );

  const handleFinish = async () => {
    if (finishing.current) return;
    finishing.current = true;
    let prs: PersonalRecord[] = [];
    try {
      prs = await finishWorkout();
    } finally {
      finishing.current = false;
    }
    setShowFinishModal(false);
    if (prs.length > 0) {
      const prLines = prs.map(pr => {
        const name = pr.exerciseName || 'Exercise';
        const detail = pr.setWeight && pr.setReps
          ? `${pr.setWeight}${unit} × ${pr.setReps} (Est. 1RM: ${pr.value}${unit})`
          : `Est. 1RM: ${pr.value}${unit}`;
        return `${name}\n${detail}`;
      }).join('\n\n');
      Alert.alert(
        `New PR${prs.length > 1 ? 's' : ''}!`,
        prLines,
        [{ text: 'Awesome!', onPress: () => navigation.goBack() }]
      );
    } else {
      navigation.goBack();
    }
  };

  const handleDiscard = () => {
    Alert.alert('Discard Workout?', 'This cannot be undone.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Discard',
        style: 'destructive',
        onPress: () => {
          discardWorkout();
          navigation.goBack();
        },
      },
    ]);
  };

  const unit = profile?.weightUnit ?? 'lbs';

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      {/* Top bar */}
      <View style={styles.topBar}>
        <Pressable onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Ionicons name="chevron-down" size={24} color={Colors.text} />
        </Pressable>

        <View style={styles.timerContainer}>
          <Ionicons name="time-outline" size={16} color={Colors.primary} />
          <Text style={styles.timerText}>{formatTimer(elapsed)}</Text>
        </View>

        <Pressable
          onPress={() => {
            const left = whatsLeft(activeWorkout);
            if (left.length > 0) {
              Alert.alert('Not done yet', `${left.join('\n')}\n\nFinish every target to end the workout.`);
              return;
            }
            setShowFinishModal(true);
          }}
          style={[styles.finishBtn, progress.some(p => !p.done) && styles.finishBtnLocked]}
        >
          <Text style={[styles.finishText, progress.some(p => !p.done) && styles.finishTextLocked]}>Finish</Text>
        </Pressable>
      </View>

      {/* Workout stats bar */}
      <View style={styles.statsBar}>
        <View style={styles.statItem}>
          <Text style={styles.statValue}>{activeWorkout.exercises.length}</Text>
          <Text style={styles.statLabel}>Exercises</Text>
        </View>
        <View style={styles.statDivider} />
        <View style={styles.statItem}>
          <Text style={styles.statValue}>{completedSets}</Text>
          <Text style={styles.statLabel}>Sets</Text>
        </View>
        <View style={styles.statDivider} />
        <View style={styles.statItem}>
          <Text style={styles.statValue}>{formatWeight(totalVolume, unit)}</Text>
          <Text style={styles.statLabel}>Volume</Text>
        </View>
      </View>

      {/* Rest Timer — pinned to top so keyboard doesn't cover it */}
      <RestTimerBar />

      {/* Android already resizes the screen for the keyboard; adjusting again made scrolling jump. */}
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        enabled={Platform.OS === 'ios'}
      >
        <ScrollView
          style={styles.scroll}
          contentContainerStyle={styles.content}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="on-drag"
        >
          {progress.length > 0 && (
            <View style={pickStyles.card}>
              <View style={pickStyles.titleRow}>
                <Text style={pickStyles.title}>Targets</Text>
                <Text style={pickStyles.meta}>{progress.filter(p => p.done).length} of {progress.length} done</Text>
              </View>
              {progress.map(p => (
                <View key={p.id} style={pickStyles.row}>
                  <View style={{ flex: 1 }}>
                    <Text style={[pickStyles.part, p.done && pickStyles.partDone]}>{BODY_PART_LABELS[p.part]}</Text>
                    <Text style={pickStyles.meta}>
                      {p.chosen}/{p.exercisesNeeded} chosen · {p.setsDone}/{p.setsNeeded} sets{p.reps ? ` · ${p.reps} reps` : ''}
                    </Text>
                  </View>
                  {p.done ? (
                    <View style={pickStyles.doneTag}>
                      <Ionicons name="checkmark" size={16} color={Colors.textInverse} />
                      <Text style={pickStyles.doneText}>Done</Text>
                    </View>
                  ) : p.chosen < p.exercisesNeeded ? (
                    <Pressable onPress={() => setPickingTarget(p.id)} style={pickStyles.choose}>
                      <Text style={pickStyles.chooseText}>Choose</Text>
                    </Pressable>
                  ) : null}
                </View>
              ))}
            </View>
          )}

          {activeWorkout.exercises.map((we, idx) => {
            const nextExercise = activeWorkout.exercises[idx + 1];
            const prevExercise = activeWorkout.exercises[idx - 1];
            const isInSuperset = !!we.supersetGroupId;
            const nextInSameSuperset = nextExercise?.supersetGroupId === we.supersetGroupId && isInSuperset;
            const prevInSameSuperset = prevExercise?.supersetGroupId === we.supersetGroupId && isInSuperset;
            const isFirstInGroup = isInSuperset && !prevInSameSuperset;

            return (
              <React.Fragment key={we.id}>
                <View>
                  {isInSuperset && <View style={ssStyles.sideBar} />}
                  <ExerciseCard
                    ref={getCardRef(we.id)}
                    workoutExercise={we}
                    showRPE={profile?.showRPE}
                    unit={unit}
                    isInSuperset={isInSuperset}
                    onMoveUp={idx > 0 ? () => reorderExercise(idx, idx - 1) : undefined}
                    onMoveDown={idx < activeWorkout.exercises.length - 1 ? () => reorderExercise(idx, idx + 1) : undefined}
                    onSetCompleted={handleSetCompleted}
                    targetPart={we.targetId ? targetById.get(we.targetId)?.part : undefined}
                    targetLabel={(() => {
                      const t = we.targetId ? targetById.get(we.targetId) : undefined;
                      return t ? `For ${BODY_PART_LABELS[t.part]} · ${t.sets} sets${t.reps ? ` · ${t.reps} reps` : ''}` : undefined;
                    })()}
                  />
                </View>

                {/* Compact link / unlink between exercises */}
                {nextExercise && (
                  <Pressable
                    onPress={() => toggleSuperset(we.id, nextExercise.id)}
                    style={[
                      ssStyles.linkBtn,
                      nextInSameSuperset && ssStyles.linkBtnActive,
                    ]}
                  >
                    <Ionicons
                      name={nextInSameSuperset ? 'unlink' : 'link'}
                      size={14}
                      color={nextInSameSuperset ? Colors.primary : Colors.textTertiary}
                    />
                    <Text style={[
                      ssStyles.linkText,
                      nextInSameSuperset && ssStyles.linkTextActive,
                    ]}>
                      {nextInSameSuperset ? 'Unlink' : 'Superset'}
                    </Text>
                  </Pressable>
                )}
              </React.Fragment>
            );
          })}

          <Button
            title="Add Exercise"
            onPress={() => setShowExercisePicker(true)}
            variant="secondary"
            size="lg"
            fullWidth
            icon={<Ionicons name="add-circle-outline" size={20} color={Colors.text} />}
          />

          <Button
            title="Discard Workout"
            onPress={handleDiscard}
            variant="danger"
            size="sm"
            style={{ alignSelf: 'center', marginTop: Spacing.md }}
          />

          <View style={{ height: 120 }} />
        </ScrollView>
      </KeyboardAvoidingView>

      {/* Exercise Picker Modal */}
      <ExercisePickerModal
        visible={showExercisePicker || pickingTarget !== null}
        onlyPart={pickingTarget ? activeWorkout.targets?.find(t => t.id === pickingTarget)?.part : undefined}
        onClose={() => { setShowExercisePicker(false); setPickingTarget(null); }}
        onSelect={exercise => {
          if (pickingTarget) pickForTarget(pickingTarget, exercise);
          else addExercise(exercise);
          setShowExercisePicker(false);
          setPickingTarget(null);
        }}
      />

      {/* Finish Modal */}
      <Modal visible={showFinishModal} animationType="slide" transparent>
        <View style={modalStyles.overlay}>
          <View style={modalStyles.container}>
            <Text style={modalStyles.title}>Finish Workout</Text>

            <TextInput
              style={modalStyles.nameInput}
              value={workoutName}
              onChangeText={setWorkoutName}
              placeholder="Workout name"
              placeholderTextColor={Colors.textTertiary}
            />

            <View style={modalStyles.summary}>
              <Text style={modalStyles.summaryText}>
                {formatTimer(elapsed)} | {completedSets} sets | {formatWeight(totalVolume, unit)} volume
              </Text>
            </View>

            <View style={modalStyles.buttons}>
              <Button
                title="Cancel"
                onPress={() => setShowFinishModal(false)}
                variant="ghost"
              />
              <Button title="Finish Workout" onPress={handleFinish} />
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
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
  backBtn: {
    padding: Spacing.xs,
  },
  timerContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
    backgroundColor: Colors.primaryMuted,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.round,
  },
  timerText: {
    color: Colors.primary,
    fontSize: FontSize.lg,
    fontWeight: '800',
    fontVariant: ['tabular-nums'],
  },
  finishBtn: {
    backgroundColor: Colors.accent,
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.round,
  },
  finishBtnLocked: {
    backgroundColor: Colors.bgElevated,
    borderWidth: 1,
    borderColor: Colors.borderLight,
  },
  finishTextLocked: { color: Colors.textSecondary },
  finishText: {
    color: Colors.textInverse,
    fontSize: FontSize.md,
    fontWeight: '700',
  },
  statsBar: {
    flexDirection: 'row',
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  statItem: {
    flex: 1,
    alignItems: 'center',
  },
  statValue: {
    color: Colors.text,
    fontSize: FontSize.md,
    fontWeight: '700',
  },
  statLabel: {
    color: Colors.textSecondary,
    fontSize: FontSize.xs,
  },
  statDivider: {
    width: 1,
    backgroundColor: Colors.border,
  },
  scroll: { flex: 1 },
  content: {
    padding: Spacing.md,
    gap: Spacing.md,
  },
  empty: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.lg,
  },
  emptyTitle: {
    color: Colors.text,
    fontSize: FontSize.xl,
    fontWeight: '700',
  },
});

const modalStyles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.7)',
    justifyContent: 'center',
    padding: Spacing.lg,
  },
  container: {
    backgroundColor: Colors.bgCard,
    borderRadius: BorderRadius.xl,
    padding: Spacing.lg,
    gap: Spacing.md,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  title: {
    color: Colors.text,
    fontSize: FontSize.xxl,
    fontWeight: '800',
    textAlign: 'center',
  },
  nameInput: {
    backgroundColor: Colors.bgInput,
    borderRadius: BorderRadius.md,
    padding: Spacing.md,
    color: Colors.text,
    fontSize: FontSize.lg,
    fontWeight: '600',
    borderWidth: 1,
    borderColor: Colors.border,
  },
  summary: {
    alignItems: 'center',
  },
  summaryText: {
    color: Colors.textSecondary,
    fontSize: FontSize.md,
  },
  buttons: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: Spacing.md,
  },
});

const ssStyles = StyleSheet.create({
  sideBar: {
    position: 'absolute',
    left: 0,
    top: 0,
    bottom: 0,
    width: 3,
    backgroundColor: Colors.primary,
    borderTopLeftRadius: BorderRadius.lg,
    borderBottomLeftRadius: BorderRadius.lg,
    zIndex: 1,
  },
  linkBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    paddingVertical: 2,
    marginVertical: -Spacing.sm,
  },
  linkBtnActive: {},
  linkText: {
    color: Colors.textTertiary,
    fontSize: 11,
    fontWeight: '600',
  },
  linkTextActive: {
    color: Colors.primary,
    fontWeight: '700',
  },
});

const pickStyles = StyleSheet.create({
  card: {
    backgroundColor: Colors.bgCard,
    borderRadius: BorderRadius.lg,
    borderWidth: 1,
    borderColor: Colors.borderLight,
    padding: Spacing.md,
    gap: Spacing.sm,
  },
  title: { color: Colors.text, fontSize: FontSize.lg, fontWeight: '700' },
  titleRow: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between' },
  partDone: { textDecorationLine: 'line-through', color: Colors.textSecondary },
  doneTag: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: Colors.primary,
    paddingHorizontal: Spacing.sm + 2,
    paddingVertical: Spacing.xs + 2,
    borderRadius: BorderRadius.md,
  },
  doneText: { color: Colors.textInverse, fontWeight: '700', fontSize: FontSize.sm },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    paddingVertical: Spacing.sm,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
  },
  part: { color: Colors.text, fontSize: FontSize.md, fontWeight: '700' },
  meta: { color: Colors.textSecondary, fontSize: FontSize.xs, marginTop: 2 },
  choose: {
    backgroundColor: Colors.primary,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.md,
  },
  chooseText: { color: Colors.textInverse, fontWeight: '700', fontSize: FontSize.sm },
});
