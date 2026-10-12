import React, { useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  Pressable,
  TextInput,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { Card } from '../components/Card';
import { Button } from '../components/Button';
import { ExercisePickerModal } from '../components/ExercisePickerModal';
import { EXERCISE_MAP } from '../data/exercises';
import { BODY_PARTS, BODY_PART_LABELS, LEG_PARTS, musclesOfPart, slotSets } from '../utils/bodyParts';
import { saveTemplate, getExerciseRestTimer, saveExerciseRestTimer } from '../utils/storage';
import { generateId } from '../utils/helpers';
import { WorkoutTemplate, Exercise, MuscleGroup, BodyPartTarget, BodyPart } from '../types';
import { Colors, Spacing, FontSize, BorderRadius } from '../theme/colors';

const TEMPLATE_COLORS = [
  '#FF6B6B', '#4ECDC4', '#F97316', '#A78BFA',
  '#06B6D4', '#8B5CF6', '#4F8EF7', '#00E676',
];

interface TemplateExercise {
  exerciseId: string;
  name: string;
  sets: number;
  targetReps?: number;
  targetWeight?: number;
  notes?: string;
  restSeconds?: number;
  supersetGroupId?: string;
}

export function EditTemplateScreen({ navigation, route }: any) {
  const existingTemplate: WorkoutTemplate | undefined = route.params?.template;
  const isEditing = !!existingTemplate;

  const [name, setName] = useState(existingTemplate?.name ?? '');
  const [description, setDescription] = useState(existingTemplate?.description ?? '');
  const [color, setColor] = useState(existingTemplate?.color ?? TEMPLATE_COLORS[0]);
  const [exercises, setExercises] = useState<TemplateExercise[]>(() => {
    if (!existingTemplate) return [];
    return existingTemplate.exercises.map(e => {
      const ex = EXERCISE_MAP.get(e.exerciseId);
      return {
        exerciseId: e.exerciseId,
        name: ex?.name ?? e.exerciseId,
        sets: e.sets,
        targetReps: e.targetReps,
        targetWeight: e.targetWeight,
        notes: e.notes,
        supersetGroupId: e.supersetGroupId,
      };
    });
  });
  /** 'targets' templates have no fixed exercises: body-part targets chosen on the day. */
  const kind: 'fixed' | 'targets' = existingTemplate?.kind ?? route.params?.kind ?? 'fixed';
  const [targets, setTargets] = useState<BodyPartTarget[]>(existingTemplate?.targets ?? []);
  const updateTarget = (i: number, patch: Partial<BodyPartTarget>) =>
    setTargets(prev => prev.map((t, j) => (j === i ? { ...t, ...patch } : t)));
  const [showPicker, setShowPicker] = useState(false);
  const [swapIndex, setSwapIndex] = useState<number | null>(null);

  // Load saved rest timers for each exercise
  useState(() => {
    if (!existingTemplate) return;
    existingTemplate.exercises.forEach((e, i) => {
      getExerciseRestTimer(e.exerciseId).then(saved => {
        if (saved !== null) {
          setExercises(prev => prev.map((ex, j) => j === i ? { ...ex, restSeconds: saved } : ex));
        }
      });
    });
  });

  const handleAddExercise = (exercise: Exercise) => {
    setExercises(prev => [
      ...prev,
      {
        exerciseId: exercise.id,
        name: exercise.name,
        sets: 3,
      },
    ]);
    setShowPicker(false);
  };

  const handleRemoveExercise = (index: number) => {
    setExercises(prev => prev.filter((_, i) => i !== index));
  };

  const handleMoveExercise = (index: number, direction: -1 | 1) => {
    const newIndex = index + direction;
    if (newIndex < 0 || newIndex >= exercises.length) return;
    setExercises(prev => {
      const copy = [...prev];
      [copy[index], copy[newIndex]] = [copy[newIndex], copy[index]];
      return copy;
    });
  };

  const updateExercise = (index: number, updates: Partial<TemplateExercise>) => {
    setExercises(prev =>
      prev.map((e, i) => (i === index ? { ...e, ...updates } : e))
    );
  };

  const handleToggleSuperset = (idx1: number, idx2: number) => {
    setExercises(prev => {
      const copy = [...prev];
      const e1 = copy[idx1];
      const e2 = copy[idx2];
      // If already in same superset, unlink
      if (e1.supersetGroupId && e1.supersetGroupId === e2.supersetGroupId) {
        copy[idx1] = { ...e1, supersetGroupId: undefined };
        copy[idx2] = { ...e2, supersetGroupId: undefined };
      } else {
        const groupId = e1.supersetGroupId || e2.supersetGroupId || generateId();
        copy[idx1] = { ...e1, supersetGroupId: groupId };
        copy[idx2] = { ...e2, supersetGroupId: groupId };
      }
      return copy;
    });
  };

  const handleSave = async () => {
    if (!name.trim()) {
      Alert.alert('Missing Name', 'Please enter a template name.');
      return;
    }
    if (kind === 'targets' && targets.length === 0) {
      Alert.alert('No targets', 'Add at least one body part.');
      return;
    }
    if (kind === 'fixed' && exercises.length === 0) {
      Alert.alert('No Exercises', 'Add at least one exercise to the template.');
      return;
    }

    const muscleGroups: MuscleGroup[] = [];
    exercises.forEach(e => {
      const ex = EXERCISE_MAP.get(e.exerciseId);
      if (ex && !muscleGroups.includes(ex.primaryMuscle)) {
        muscleGroups.push(ex.primaryMuscle);
      }
    });
    targets.forEach(t => {
      for (const m of musclesOfPart(t.part)) {
        if (kind === 'targets' && !muscleGroups.includes(m)) muscleGroups.push(m);
      }
    });

    const template: WorkoutTemplate = {
      id: isEditing ? existingTemplate!.id : generateId(),
      name: name.trim(),
      description: description.trim() || undefined,
      exercises: kind === 'targets' ? [] : exercises.map((e, i) => ({
        exerciseId: e.exerciseId,
        sets: e.sets,
        targetReps: e.targetReps,
        targetWeight: e.targetWeight,
        notes: e.notes?.trim() || undefined,
        supersetGroupId: e.supersetGroupId,
        order: i,
      })),
      muscleGroups,
      kind,
      targets: kind === 'targets' ? targets.map(t => {
        // Keep sets as the first exercise's, for older copies of the app; setsPer only when they differ.
        const per = slotSets(t);
        const same = per.every(s => s === per[0]);
        return { part: t.part, exercises: t.exercises, sets: per[0], ...(same ? {} : { setsPer: per }), reps: t.reps?.trim() || undefined };
      }) : undefined,
      estimatedDuration: kind === 'targets' ? targets.reduce((n, t) => n + t.exercises, 0) * 8 : exercises.length * 8,
      color,
      icon: existingTemplate?.icon,
      lastUsed: existingTemplate?.lastUsed,
      timesUsed: existingTemplate?.timesUsed ?? 0,
      createdAt: existingTemplate?.createdAt ?? new Date().toISOString(),
      isCustom: true,
    };

    await saveTemplate(template);
    // Save rest timers for each exercise
    for (const ex of exercises) {
      if (ex.restSeconds) {
        await saveExerciseRestTimer(ex.exerciseId, ex.restSeconds);
      }
    }
    navigation.goBack();
  };

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <View style={styles.topBar}>
        <Pressable onPress={() => navigation.goBack()} hitSlop={8}>
          <Ionicons name="close" size={28} color={Colors.text} />
        </Pressable>
        <Text style={styles.topTitle}>
          {kind === 'targets' ? (isEditing ? 'Edit Targets' : 'New Targets Template') : isEditing ? 'Edit Template' : 'New Template'}
        </Text>
        <Pressable onPress={handleSave} style={styles.saveBtn}>
          <Text style={styles.saveText}>Save</Text>
        </Pressable>
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        {/* Name & Description */}
        <Card style={styles.section}>
          <TextInput
            style={styles.nameInput}
            value={name}
            onChangeText={setName}
            placeholder="Template name"
            placeholderTextColor={Colors.textTertiary}
          />
          <TextInput
            style={styles.descInput}
            value={description}
            onChangeText={setDescription}
            placeholder="Description (optional)"
            placeholderTextColor={Colors.textTertiary}
          />
        </Card>

        {/* Exercises */}
        {kind === 'fixed' && <Card style={styles.section}>
          <Text style={styles.sectionLabel}>
            Exercises ({exercises.length})
          </Text>

          {exercises.map((ex, index) => {
            const isInSuperset = !!ex.supersetGroupId;
            const nextEx = exercises[index + 1];
            const nextInSameSuperset = nextEx?.supersetGroupId === ex.supersetGroupId && isInSuperset;
            const prevEx = exercises[index - 1];
            const isFirstInGroup = isInSuperset && (!prevEx || prevEx.supersetGroupId !== ex.supersetGroupId);

            return (
              <React.Fragment key={`${ex.exerciseId}-${index}`}>
                {isFirstInGroup && (
                  <View style={styles.ssLabel}>
                    <Ionicons name="link" size={12} color={Colors.primary} />
                    <Text style={styles.ssLabelText}>Superset</Text>
                  </View>
                )}
                <View style={[styles.exerciseRow, isInSuperset && styles.exerciseRowSuperset]}>
                  {isInSuperset && <View style={styles.ssSideBar} />}
                  <View style={isInSuperset ? { flex: 1 } : undefined}>
                    <View style={styles.exerciseHeader}>
                      <Text style={styles.exerciseName} numberOfLines={1}>
                        {ex.name}
                      </Text>
                      <View style={styles.exerciseActions}>
                        <Pressable
                          onPress={() => handleMoveExercise(index, -1)}
                          hitSlop={6}
                          disabled={index === 0}
                        >
                          <Ionicons
                            name="chevron-up"
                            size={20}
                            color={index === 0 ? Colors.textTertiary : Colors.text}
                          />
                        </Pressable>
                        <Pressable
                          onPress={() => handleMoveExercise(index, 1)}
                          hitSlop={6}
                          disabled={index === exercises.length - 1}
                        >
                          <Ionicons
                            name="chevron-down"
                            size={20}
                            color={index === exercises.length - 1 ? Colors.textTertiary : Colors.text}
                          />
                        </Pressable>
                        <Pressable onPress={() => setSwapIndex(index)} hitSlop={6}>
                          <Ionicons name="swap-horizontal" size={18} color={Colors.textSecondary} />
                        </Pressable>
                        <Pressable onPress={() => handleRemoveExercise(index)} hitSlop={6}>
                          <Ionicons name="trash-outline" size={18} color={Colors.danger} />
                        </Pressable>
                      </View>
                    </View>

                    <View style={styles.setInputs}>
                      <View style={styles.inputGroup}>
                        <Text style={styles.inputLabel}>Sets</Text>
                        <TextInput
                          style={styles.smallInput}
                          value={String(ex.sets)}
                          onChangeText={t => updateExercise(index, { sets: parseInt(t) || 1 })}
                          keyboardType="numeric"
                        />
                      </View>
                      <View style={styles.inputGroup}>
                        <Text style={styles.inputLabel}>Rest (s)</Text>
                        <TextInput
                          style={styles.smallInput}
                          value={String(ex.restSeconds ?? 90)}
                          onChangeText={t => {
                            const val = parseInt(t.replace(/[^0-9]/g, '')) || 90;
                            updateExercise(index, { restSeconds: val });
                          }}
                          onBlur={() => {
                            const val = ex.restSeconds ?? 90;
                            saveExerciseRestTimer(ex.exerciseId, val);
                          }}
                          keyboardType="numeric"
                        />
                      </View>
                    </View>

                    <TextInput
                      style={styles.notesInput}
                      value={ex.notes ?? ''}
                      onChangeText={t => updateExercise(index, { notes: t })}
                      placeholder="Notes (e.g. grip, tempo, cues...)"
                      placeholderTextColor={Colors.textTertiary}
                      multiline
                    />
                  </View>
                </View>

                {/* Superset link button between exercises */}
                {nextEx && (
                  <Pressable
                    onPress={() => handleToggleSuperset(index, index + 1)}
                    style={[styles.ssLinkBtn, nextInSameSuperset && styles.ssLinkBtnActive]}
                  >
                    <Ionicons
                      name={nextInSameSuperset ? 'unlink' : 'link'}
                      size={14}
                      color={nextInSameSuperset ? Colors.primary : Colors.textTertiary}
                    />
                    <Text style={[
                      styles.ssLinkText,
                      nextInSameSuperset && styles.ssLinkTextActive,
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
            onPress={() => setShowPicker(true)}
            variant="secondary"
            fullWidth
            icon={<Ionicons name="add-circle-outline" size={20} color={Colors.text} />}
          />
        </Card>}

        {/* Targets: body parts done on the day, required to finish */}
        {kind === 'targets' && (
          <Card style={styles.section}>
            <Text style={styles.sectionLabel}>Targets ({targets.length})</Text>
            <Text style={styles.bpHint}>
              You choose the exercises in the gym. The workout can't be finished until every target is done.
            </Text>
            {targets.map((t, i) => (
              <View key={t.part} style={styles.bpBlock}>
                <View style={styles.bpHead}>
                  <Text style={styles.bpName}>{BODY_PART_LABELS[t.part]}</Text>
                  <Pressable onPress={() => setTargets(prev => prev.filter((_, j) => j !== i))} hitSlop={8}>
                    <Ionicons name="trash-outline" size={18} color={Colors.danger} />
                  </Pressable>
                </View>
                <View style={styles.bpRow}>
                  <Stepper
                    label="Exercises"
                    value={t.exercises}
                    onChange={v => {
                      // New exercises start with the last one's sets.
                      const per = slotSets(t);
                      updateTarget(i, { exercises: v, setsPer: Array.from({ length: v }, (_, k) => per[k] ?? per[per.length - 1] ?? 3) });
                    }}
                  />
                  <View style={styles.stepper}>
                    <Text style={styles.stepperLabel}>Reps</Text>
                    <TextInput
                      style={styles.repsInput}
                      value={t.reps ?? ''}
                      onChangeText={v => updateTarget(i, { reps: v.replace(/[^0-9\- ]/g, '') })}
                      placeholder="8-12"
                      placeholderTextColor={Colors.textTertiary}
                      keyboardType="numbers-and-punctuation"
                    />
                  </View>
                </View>
                <View style={styles.bpSets}>
                  {slotSets(t).map((s, k) => (
                    <Stepper
                      key={k}
                      label={t.exercises === 1 ? 'Sets' : `Exercise ${k + 1} sets`}
                      value={s}
                      onChange={v => updateTarget(i, { setsPer: slotSets(t).map((x, j) => (j === k ? v : x)) })}
                    />
                  ))}
                </View>
              </View>
            ))}
            {(() => {
              // Body parts not added yet; the leg ones sit together under "Legs".
              const free = BODY_PARTS.filter(p => !targets.some(t => t.part === p));
              const isLeg = (p: BodyPart) => p === 'legs' || LEG_PARTS.includes(p);
              const chip = (p: BodyPart) => (
                <Pressable
                  key={p}
                  onPress={() => setTargets(prev => [...prev, { part: p, exercises: 1, sets: 3 }])}
                  style={styles.bpChip}
                >
                  <Ionicons name="add" size={14} color={Colors.text} />
                  <Text style={styles.bpChipText}>{p === 'legs' ? 'Any leg exercise' : BODY_PART_LABELS[p]}</Text>
                </Pressable>
              );
              return (
                <>
                  <View style={styles.bpChips}>{free.filter(p => !isLeg(p)).map(chip)}</View>
                  {free.some(isLeg) && (
                    <View style={styles.bpLegs}>
                      <Text style={styles.bpLegsLabel}>Legs</Text>
                      <View style={styles.bpChips}>{free.filter(isLeg).map(chip)}</View>
                    </View>
                  )}
                </>
              );
            })()}
          </Card>
        )}

        <View style={{ height: 100 }} />
      </ScrollView>

      <ExercisePickerModal
        visible={showPicker || swapIndex !== null}
        onClose={() => { setShowPicker(false); setSwapIndex(null); }}
        onSelect={(exercise) => {
          if (swapIndex !== null) {
            updateExercise(swapIndex, {
              exerciseId: exercise.id,
              name: exercise.name,
            });
            setSwapIndex(null);
          } else {
            handleAddExercise(exercise);
          }
        }}
      />
    </SafeAreaView>
  );
}

/** − value + with a small label above; never below 1. */
function Stepper({ label, value, onChange }: { label: string; value: number; onChange: (v: number) => void }) {
  return (
    <View style={styles.stepper}>
      <Text style={styles.stepperLabel}>{label}</Text>
      <View style={styles.stepperRow}>
        <Pressable onPress={() => onChange(Math.max(1, value - 1))} hitSlop={6} style={styles.stepBtn}>
          <Ionicons name="remove" size={16} color={Colors.text} />
        </Pressable>
        <Text style={styles.stepValue}>{value}</Text>
        <Pressable onPress={() => onChange(Math.min(20, value + 1))} hitSlop={6} style={styles.stepBtn}>
          <Ionicons name="add" size={16} color={Colors.text} />
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  bpHint: { color: Colors.textSecondary, fontSize: FontSize.xs, marginBottom: Spacing.sm },
  bpBlock: { paddingVertical: Spacing.sm, borderTopWidth: 1, borderTopColor: Colors.border, gap: Spacing.sm },
  bpHead: { flexDirection: 'row', alignItems: 'center' },
  bpRow: { flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between' },
  bpSets: { flexDirection: 'row', flexWrap: 'wrap', columnGap: Spacing.lg, rowGap: Spacing.sm },
  bpName: { flex: 1, color: Colors.text, fontSize: FontSize.md, fontWeight: '700' },
  repsInput: {
    width: 72,
    height: 28,
    paddingVertical: 0,
    borderRadius: BorderRadius.sm,
    borderWidth: 1,
    borderColor: Colors.borderLight,
    color: Colors.text,
    fontSize: FontSize.md,
    fontWeight: '700',
    textAlign: 'center',
  },
  bpChips: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.xs, marginTop: Spacing.sm },
  bpChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: Spacing.sm + 2,
    paddingVertical: Spacing.xs + 2,
    borderRadius: BorderRadius.sm,
    borderWidth: 1,
    borderColor: Colors.borderLight,
  },
  bpChipText: { color: Colors.text, fontSize: FontSize.sm, fontWeight: '600' },
  bpLegs: { marginTop: Spacing.sm, paddingTop: Spacing.sm, borderTopWidth: 1, borderTopColor: Colors.border },
  bpLegsLabel: { color: Colors.textSecondary, fontSize: FontSize.xs, fontWeight: '700', letterSpacing: 1, textTransform: 'uppercase' },
  stepper: { alignItems: 'center' },
  stepperLabel: { color: Colors.textSecondary, fontSize: 10, marginBottom: 2 },
  stepperRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  stepBtn: {
    width: 28,
    height: 28,
    borderRadius: BorderRadius.sm,
    borderWidth: 1,
    borderColor: Colors.borderLight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepValue: { color: Colors.text, fontSize: FontSize.md, fontWeight: '800', minWidth: 18, textAlign: 'center' },

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
  },
  saveBtn: {
    backgroundColor: Colors.accent,
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.round,
  },
  saveText: {
    color: Colors.textInverse,
    fontSize: FontSize.md,
    fontWeight: '700',
  },
  content: {
    padding: Spacing.md,
    gap: Spacing.md,
  },
  section: {
    gap: Spacing.md,
  },
  sectionLabel: {
    color: Colors.textSecondary,
    fontSize: FontSize.sm,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 1,
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
  descInput: {
    backgroundColor: Colors.bgInput,
    borderRadius: BorderRadius.md,
    padding: Spacing.md,
    color: Colors.text,
    fontSize: FontSize.md,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  pickerRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.sm,
  },
  colorSwatch: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  swatchSelected: {
    borderWidth: 3,
    borderColor: Colors.text,
  },
  iconOption: {
    width: 44,
    height: 44,
    borderRadius: BorderRadius.md,
    backgroundColor: Colors.bgElevated,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: 'transparent',
  },
  iconSelected: {
    borderColor: Colors.primary,
    backgroundColor: Colors.primaryMuted,
  },
  iconText: {
    fontSize: 22,
  },
  exerciseRow: {
    backgroundColor: Colors.bgElevated,
    borderRadius: BorderRadius.md,
    padding: Spacing.md,
    gap: Spacing.sm,
  },
  exerciseHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  exerciseName: {
    color: Colors.text,
    fontSize: FontSize.md,
    fontWeight: '600',
    flex: 1,
    marginRight: Spacing.sm,
  },
  exerciseActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  setInputs: {
    flexDirection: 'row',
    gap: Spacing.md,
  },
  inputGroup: {
    flex: 1,
    gap: Spacing.xs,
  },
  inputLabel: {
    color: Colors.textTertiary,
    fontSize: FontSize.xs,
    fontWeight: '600',
    textAlign: 'center',
  },
  smallInput: {
    backgroundColor: Colors.bgInput,
    borderRadius: BorderRadius.sm,
    padding: Spacing.sm,
    color: Colors.text,
    fontSize: FontSize.md,
    fontWeight: '600',
    textAlign: 'center',
    borderWidth: 1,
    borderColor: Colors.border,
  },
  notesInput: {
    backgroundColor: Colors.bgInput,
    borderRadius: BorderRadius.sm,
    padding: Spacing.sm,
    color: Colors.text,
    fontSize: FontSize.sm,
    borderWidth: 1,
    borderColor: Colors.border,
    minHeight: 36,
  },
  exerciseRowSuperset: {
    flexDirection: 'row',
    overflow: 'hidden',
  },
  ssSideBar: {
    width: 3,
    backgroundColor: Colors.primary,
    borderTopLeftRadius: BorderRadius.md,
    borderBottomLeftRadius: BorderRadius.md,
  },
  ssLabel: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingLeft: Spacing.sm,
    marginBottom: -Spacing.xs,
  },
  ssLabelText: {
    color: Colors.primary,
    fontSize: 10,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  ssLinkBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    paddingVertical: 2,
    marginVertical: -Spacing.xs,
  },
  ssLinkBtnActive: {},
  ssLinkText: {
    color: Colors.textTertiary,
    fontSize: 11,
    fontWeight: '600',
  },
  ssLinkTextActive: {
    color: Colors.primary,
    fontWeight: '700',
  },
});
