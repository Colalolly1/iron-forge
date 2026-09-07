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
import { saveTemplate, getExerciseRestTimer, saveExerciseRestTimer } from '../utils/storage';
import { generateId } from '../utils/helpers';
import { WorkoutTemplate, Exercise, MuscleGroup } from '../types';
import { Colors, Spacing, FontSize, BorderRadius } from '../theme/colors';

const TEMPLATE_COLORS = [
  '#FF6B6B', '#4ECDC4', '#F97316', '#A78BFA',
  '#06B6D4', '#8B5CF6', '#4F8EF7', '#00E676',
];

const TEMPLATE_ICONS = [
  '💪', '🏋️', '🔥', '⚡', '🎯', '💥',
  '🏆', '🦾', '🫀', '🧘', '🚀', '⭐',
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
  const [icon, setIcon] = useState(existingTemplate?.icon ?? TEMPLATE_ICONS[0]);
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
    if (exercises.length === 0) {
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

    const template: WorkoutTemplate = {
      id: isEditing ? existingTemplate!.id : generateId(),
      name: name.trim(),
      description: description.trim() || undefined,
      exercises: exercises.map((e, i) => ({
        exerciseId: e.exerciseId,
        sets: e.sets,
        targetReps: e.targetReps,
        targetWeight: e.targetWeight,
        notes: e.notes?.trim() || undefined,
        supersetGroupId: e.supersetGroupId,
        order: i,
      })),
      muscleGroups,
      estimatedDuration: exercises.length * 8,
      color,
      icon,
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
          {isEditing ? 'Edit Template' : 'New Template'}
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
        <Card style={styles.section}>
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
        </Card>

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
