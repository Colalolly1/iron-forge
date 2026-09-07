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
import {
  formatTimer,
  formatWeight,
  calculateVolume,
} from '../utils/helpers';
import { UserProfile } from '../types';
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
    newPRs,
    clearPRs,
  } = useWorkout();
  const [elapsed, setElapsed] = useState(0);
  const [showExercisePicker, setShowExercisePicker] = useState(false);
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

  const totalVolume = activeWorkout.exercises.reduce(
    (sum, e) => sum + calculateVolume(e.sets),
    0
  );
  const completedSets = activeWorkout.exercises.reduce(
    (sum, e) => sum + e.sets.filter(s => s.completed && !s.isWarmup).length,
    0
  );

  const handleFinish = async () => {
    const prs = await finishWorkout();
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

        <Pressable onPress={() => setShowFinishModal(true)} style={styles.finishBtn}>
          <Text style={styles.finishText}>Finish</Text>
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

      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 20}
      >
        <ScrollView
          style={styles.scroll}
          contentContainerStyle={styles.content}
          keyboardShouldPersistTaps="handled"
        >
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
        visible={showExercisePicker}
        onClose={() => setShowExercisePicker(false)}
        onSelect={exercise => {
          addExercise(exercise);
          setShowExercisePicker(false);
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

