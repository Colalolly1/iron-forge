import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  Pressable,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { Card } from '../components/Card';
import { MuscleGroupBadge } from '../components/MuscleGroupBadge';
import { Button } from '../components/Button';
import { useWorkout } from '../context/WorkoutContext';
import { startOrReplace } from '../utils/startFlow';
import { getTemplates, saveTemplate, deleteTemplate, getProfile } from '../utils/storage';
import { DAY_LETTERS } from '../utils/plan';
import { importTemplatesJSON } from '../utils/importTemplates';
import { readPickedFile } from '../utils/export';
import * as DocumentPicker from 'expo-document-picker';
import { EXERCISE_MAP } from '../data/exercises';
import { exercisesFromTemplate, toPickFromTemplate, bodyPartsLine } from '../utils/startTemplate';
import { DEFAULT_TEMPLATES } from '../data/templates';
import {
  formatDuration,
  generateId,
  getMuscleGroupColor,
} from '../utils/helpers';
import { WorkoutTemplate, WorkoutExercise } from '../types';
import { Colors, Spacing, FontSize, BorderRadius } from '../theme/colors';

export function TemplatesScreen({ navigation }: any) {
  const { startWorkout, isWorkoutActive, discardWorkout } = useWorkout();
  const [templates, setTemplates] = useState<WorkoutTemplate[]>([]);

  const loadData = useCallback(async () => {
    let ts = await getTemplates();
    // Seed defaults if none exist
    if (ts.length === 0) {
      for (const t of DEFAULT_TEMPLATES) {
        await saveTemplate(t);
      }
      ts = DEFAULT_TEMPLATES;
    }
    setTemplates(ts);
  }, []);

  useEffect(() => {
    loadData();
    const unsub = navigation?.addListener?.('focus', loadData);
    return unsub;
  }, [loadData, navigation]);

  const handleStartFromTemplate = (template: WorkoutTemplate) => {
    const exercises = exercisesFromTemplate(template);
    startOrReplace({ isWorkoutActive, discardWorkout, navigation, start: () => startWorkout(template.name, exercises, toPickFromTemplate(template)) });
  };

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <View style={styles.header}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: Spacing.sm }}>
            {navigation.canGoBack?.() && (
              <Pressable onPress={() => navigation.goBack()} hitSlop={12}>
                <Ionicons name="chevron-back" size={26} color={Colors.text} />
              </Pressable>
            )}
            <Text style={styles.title}>Templates</Text>
          </View>
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        {/* Quick Start */}
        <Button
          title="Empty Workout"
          onPress={() => startOrReplace({ isWorkoutActive, discardWorkout, navigation, start: () => startWorkout() })}
          size="lg"
          fullWidth
          icon={<Ionicons name="flash" size={20} color={Colors.textInverse} />}
        />

        <Button
          title="Create Template"
          onPress={() => navigation.navigate('EditTemplate')}
          variant="secondary"
          size="lg"
          fullWidth
          icon={<Ionicons name="add-circle-outline" size={20} color={Colors.text} />}
        />

        <Button
          title="Import Template"
          onPress={async () => {
            try {
              const result = await DocumentPicker.getDocumentAsync({
                type: ['application/json', 'text/plain', '*/*'],
                copyToCacheDirectory: true,
              });
              if (result.canceled || !result.assets?.[0]) return;
              const content = await readPickedFile(result.assets[0].uri);
              const r = await importTemplatesJSON(content);
              const parts: string[] = [];
              if (r.imported > 0) parts.push(`${r.imported} new template${r.imported !== 1 ? 's' : ''}`);
              if (r.updated > 0) parts.push(`${r.updated} updated`);
              let msg = `Imported ${parts.join(', ')}.`;
              if (r.customExercisesAdded > 0) {
                msg += `\n${r.customExercisesAdded} custom exercise${r.customExercisesAdded !== 1 ? 's' : ''} restored.`;
              }
              if (r.notesRestored > 0 || r.timersRestored > 0) {
                msg += `\n${r.notesRestored} note${r.notesRestored !== 1 ? 's' : ''}, ${r.timersRestored} rest timer${r.timersRestored !== 1 ? 's' : ''} restored.`;
              }
              if (r.createdCustom.length > 0) {
                msg += `\n\nCreated ${r.createdCustom.length} new custom exercise${r.createdCustom.length !== 1 ? 's' : ''}:\n${r.createdCustom.slice(0, 5).join('\n')}`;
              }
              if (r.skippedExercises.length > 0) {
                msg += `\n\nSkipped ${r.skippedExercises.length} unrecognised exercise${r.skippedExercises.length !== 1 ? 's' : ''}.`;
              }
              Alert.alert('Import Complete', msg);
              loadData();
            } catch (e: any) {
              Alert.alert('Import Failed', e.message || 'Could not read the file.');
            }
          }}
          variant="secondary"
          size="lg"
          fullWidth
          icon={<Ionicons name="download-outline" size={20} color={Colors.text} />}
        />

        {/* Template Grid */}
        <Text style={styles.sectionTitle}>Workout Templates</Text>

        {templates.map(template => (
          <View key={template.id} style={styles.templateCard}>
              <View style={styles.templateHeader}>
                <Text style={styles.templateIcon}>{template.icon}</Text>
                <View style={{ flex: 1 }}>
                  <Text style={styles.templateName}>
                    {template.name}
                    {template.isCustom && (
                      <Text style={styles.customBadge}> (Custom)</Text>
                    )}
                  </Text>
                  <Text style={styles.templateDesc}>{template.description}</Text>
                </View>
                <View style={styles.templateActions}>
                  <Pressable
                    onPress={() => {
                      Alert.alert(
                        'Delete Template?',
                        `Remove "${template.name}"? This cannot be undone.`,
                        [
                          { text: 'Cancel', style: 'cancel' },
                          {
                            text: 'Delete',
                            style: 'destructive',
                            onPress: async () => {
                              await deleteTemplate(template.id);
                              loadData();
                            },
                          },
                        ]
                      );
                    }}
                    hitSlop={8}
                  >
                    <Ionicons name="trash-outline" size={20} color={Colors.danger} />
                  </Pressable>
                </View>
              </View>

              <View style={styles.templateExercises}>
                {template.exercises.map((te, i) => {
                  const ex = EXERCISE_MAP.get(te.exerciseId);
                  const isInSuperset = !!te.supersetGroupId;
                  const prevInSame = i > 0 && template.exercises[i - 1]?.supersetGroupId === te.supersetGroupId && isInSuperset;
                  return (
                    <View key={i} style={isInSuperset ? styles.exerciseSupersetRow : undefined}>
                      {isInSuperset && <View style={styles.exerciseSupersetBar} />}
                      <View>
                        <Text style={styles.exerciseItem}>
                          {ex?.name ?? te.exerciseId}
                        </Text>
                        {te.notes ? (
                          <Text style={styles.exerciseNote}>{te.notes}</Text>
                        ) : null}
                      </View>
                    </View>
                  );
                })}
                {template.bodyParts && template.bodyParts.length > 0 ? (
                  <Text style={styles.exerciseItem}>Choose on the day: {bodyPartsLine(template.bodyParts)}</Text>
                ) : null}
              </View>

              <View style={styles.templateMuscles}>
                {template.muscleGroups.map(m => (
                  <MuscleGroupBadge key={m} muscle={m} />
                ))}
                {template.estimatedDuration && (
                  <View style={styles.durationBadge}>
                    <Ionicons name="time-outline" size={14} color={Colors.textSecondary} />
                    <Text style={styles.durationText}>
                      ~{template.estimatedDuration}m
                    </Text>
                  </View>
                )}
              </View>

              {/* Weekly plan: which days this one belongs to. */}
              <View style={styles.planRow}>
                <Text style={styles.planLabel}>Days</Text>
                <View style={styles.dayChips}>
                  {[1, 2, 3, 4, 5, 6, 0].map(d => {
                    const on = (template.days ?? []).includes(d);
                    return (
                      <Pressable
                        key={d}
                        hitSlop={4}
                        onPress={async () => {
                          const days = on
                            ? (template.days ?? []).filter(x => x !== d)
                            : [...(template.days ?? []), d];
                          await saveTemplate({ ...template, days });
                          loadData();
                        }}
                        style={[styles.dayChip, on && styles.dayChipOn]}
                      >
                        <Text style={[styles.dayChipText, on && styles.dayChipTextOn]}>{DAY_LETTERS[d]}</Text>
                      </Pressable>
                    );
                  })}
                </View>
              </View>

              <View style={styles.templateButtonRow}>
                <Pressable
                  onPress={() => handleStartFromTemplate(template)}
                  style={styles.startBtn}
                >
                  <Ionicons name="play" size={16} color={Colors.textInverse} />
                  <Text style={styles.startBtnText}>Start Workout</Text>
                </Pressable>
                <Pressable
                  onPress={() => navigation.navigate('EditTemplate', { template })}
                  style={styles.editBtn}
                >
                  <Ionicons name="create-outline" size={16} color={Colors.text} />
                  <Text style={styles.editBtnText}>Edit</Text>
                </Pressable>
              </View>
          </View>
        ))}

        <View style={{ height: 100 }} />
      </ScrollView>
    </SafeAreaView>
  );
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
  content: {
    padding: Spacing.md,
    gap: Spacing.md,
  },
  sectionTitle: {
    color: Colors.text,
    fontSize: FontSize.xl,
    fontWeight: '700',
    marginTop: Spacing.sm,
  },
  templateCard: {
    backgroundColor: Colors.bgCard,
    borderRadius: BorderRadius.lg,
    padding: Spacing.md,
    gap: Spacing.md,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  templateHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
  },
  templateActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  customBadge: {
    color: Colors.accent,
    fontSize: FontSize.xs,
    fontWeight: '600',
  },
  templateIcon: {
    fontSize: 28,
  },
  templateName: {
    color: Colors.text,
    fontSize: FontSize.lg,
    fontWeight: '700',
  },
  templateDesc: {
    color: Colors.textSecondary,
    fontSize: FontSize.sm,
  },
  durationBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: Colors.bgElevated,
    paddingHorizontal: Spacing.sm + 2,
    paddingVertical: Spacing.xs,
    borderRadius: BorderRadius.round,
  },
  durationText: {
    color: Colors.textSecondary,
    fontSize: FontSize.xs,
    fontWeight: '600',
  },
  templateExercises: {
    gap: 3,
  },
  exerciseItem: {
    color: Colors.textSecondary,
    fontSize: FontSize.sm,
  },
  exerciseNote: {
    color: Colors.textSecondary,
    fontSize: FontSize.xs,
    
    marginLeft: Spacing.sm,
  },
  exerciseSupersetRow: {
    flexDirection: 'row',
    alignItems: 'stretch',
  },
  exerciseSupersetBar: {
    width: 2,
    backgroundColor: Colors.primary,
    marginRight: Spacing.xs,
    borderRadius: 1,
  },
  templateMuscles: {
    flexDirection: 'row',
    gap: Spacing.xs,
    flexWrap: 'wrap',
  },
  planRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    marginTop: Spacing.sm,
    marginBottom: Spacing.sm,
  },
  planLabel: { color: Colors.textSecondary, fontSize: FontSize.sm, fontWeight: '600', width: 36 },
  dayChips: { flexDirection: 'row', gap: 6, flex: 1, justifyContent: 'space-between' },
  dayChip: {
    width: 30,
    height: 30,
    borderRadius: 15,
    borderWidth: 1,
    borderColor: Colors.borderLight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dayChipOn: { backgroundColor: Colors.primary, borderColor: Colors.primary },
  dayChipText: { color: Colors.textSecondary, fontSize: FontSize.xs, fontWeight: '700' },
  dayChipTextOn: { color: Colors.textInverse },
  templateButtonRow: {
    flexDirection: 'row',
    gap: Spacing.sm,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
    paddingTop: Spacing.md,
  },
  startBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.xs,
    backgroundColor: Colors.text,
    paddingVertical: Spacing.sm + 2,
    borderRadius: BorderRadius.md,
  },
  startBtnText: {
    color: Colors.textInverse,
    fontSize: FontSize.sm,
    fontWeight: '700',
  },
  editBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.xs,
    paddingVertical: Spacing.sm + 2,
    paddingHorizontal: Spacing.lg,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    borderColor: Colors.borderLight,
  },
  editBtnText: {
    color: Colors.text,
    fontSize: FontSize.sm,
    fontWeight: '700',
  },
});
