import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  Modal,
  TextInput,
  FlatList,
  ScrollView,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { MuscleGroupBadge } from './MuscleGroupBadge';
import { getAllExercises, searchExercises, MUSCLE_GROUP_LABELS, registerCustomExercises } from '../data/exercises';
import { getMuscleGroupColor, generateId, getRelativeTime } from '../utils/helpers';
import { getCustomExercises, saveCustomExercise, getLastUsed } from '../utils/storage';
import { Exercise, MuscleGroup, ExerciseCategory, ExerciseForce, BodyPart } from '../types';
import { bodyPartOf, partMatches, isLegChip, LEG_MUSCLES, MuscleChip, BODY_PART_LABELS } from '../utils/bodyParts';
import { Colors, Spacing, FontSize, BorderRadius } from '../theme/colors';

const MUSCLE_GROUPS: MuscleGroup[] = [
  'chest', 'back', 'shoulders', 'biceps', 'triceps',
  'quads', 'hamstrings', 'glutes', 'adductors', 'abductors', 'calves', 'core', 'full_body', 'cardio',
];

/** Back covers lats and traps too; arms-adjacent forearms sit under biceps. */
const MUSCLE_FAMILY: Partial<Record<MuscleGroup, MuscleGroup[]>> = {
  back: ['back', 'lats', 'traps'],
  biceps: ['biceps', 'forearms'],
};

/** The filter tabs. Legs is one tab; its muscles appear in a second row once it's picked. */
type Chip = MuscleChip;
const CHIPS: Chip[] = ['chest', 'back', 'shoulders', 'biceps', 'triceps', 'legs', 'core', 'full_body', 'cardio'];
const LEG_CHIPS: Chip[] = ['legs', ...LEG_MUSCLES];
const chipLabel = (c: Chip, inLegRow = false) => (c === 'legs' ? (inLegRow ? 'All legs' : 'Legs') : MUSCLE_GROUP_LABELS[c]);
const chipColor = (c: Chip) => getMuscleGroupColor(c === 'legs' ? 'quads' : c);

function inChip(c: Chip, e: Exercise): boolean {
  if (c === 'legs') return partMatches('legs', e);
  if (LEG_MUSCLES.includes(c)) return partMatches(c as BodyPart, e);
  const family = MUSCLE_FAMILY[c] ?? [c];
  // Full-body exercises placed by their name (e.g. "Squat (Barbell)" from Strong) show under that muscle too.
  const part = bodyPartOf(e);
  return family.includes(e.primaryMuscle) || (e.primaryMuscle === 'full_body' && !!part && family.includes(part as MuscleGroup));
}

const CATEGORIES: { value: ExerciseCategory; label: string }[] = [
  { value: 'barbell', label: 'Barbell' },
  { value: 'dumbbell', label: 'Dumbbell' },
  { value: 'machine', label: 'Machine' },
  { value: 'cable', label: 'Cable' },
  { value: 'bodyweight', label: 'Bodyweight' },
  { value: 'kettlebell', label: 'Kettlebell' },
  { value: 'band', label: 'Band' },
  { value: 'smith_machine', label: 'Smith Machine' },
  { value: 'cardio', label: 'Cardio' },
  { value: 'other', label: 'Other' },
];

const FORCES: { value: ExerciseForce; label: string }[] = [
  { value: 'push', label: 'Push' },
  { value: 'pull', label: 'Pull' },
  { value: 'compound', label: 'Compound' },
  { value: 'static', label: 'Static' },
];

export function ExercisePickerModal({
  visible,
  onClose,
  onSelect,
  onlyPart,
}: {
  visible: boolean;
  onClose: () => void;
  onSelect: (exercise: Exercise) => void;
  /** Show only exercises for this body part (choosing for a target). */
  onlyPart?: BodyPart;
}) {
  const [search, setSearch] = useState('');
  const [selectedMuscle, setSelectedMuscle] = useState<Chip | null>(null);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);
  const [lastUsed, setLastUsed] = useState<Record<string, string>>({});

  // Create form state
  const [newName, setNewName] = useState('');
  const [newMuscle, setNewMuscle] = useState<MuscleGroup>('chest');
  const [newCategory, setNewCategory] = useState<ExerciseCategory>('barbell');
  const [newForce, setNewForce] = useState<ExerciseForce>('push');

  useEffect(() => {
    if (visible && onlyPart) setSearch('');
  }, [visible, onlyPart]);

  // Keep the body-part view while the sheet slides away, so it doesn't flash the full list.
  const lastPart = React.useRef(onlyPart);
  if (visible) lastPart.current = onlyPart;
  const part = visible ? onlyPart : lastPart.current;

  useEffect(() => {
    if (visible) {
      getCustomExercises().then(custom => {
        registerCustomExercises(custom);
        setRefreshKey(k => k + 1);
      });
      getLastUsed().then(setLastUsed);
    }
  }, [visible]);

  const exercises = getAllExercises();
  const matching = part
    ? (search ? searchExercises(search) : exercises).filter(e => partMatches(part, e))
    : search
    ? searchExercises(search)
    : selectedMuscle
    ? exercises.filter(e => inChip(selectedMuscle, e))
    : exercises;
  // Most recently done first; the rest keep their usual order.
  const usedAt = (e: Exercise) => (lastUsed[e.id] ? new Date(lastUsed[e.id]).getTime() : 0);
  const filtered = matching
    .map((e, i) => ({ e, i, t: usedAt(e) }))
    .sort((a, b) => b.t - a.t || a.i - b.i)
    .map(x => x.e);

  const handleCreate = async () => {
    if (!newName.trim()) {
      Alert.alert('Name required', 'Please enter an exercise name.');
      return;
    }
    const exercise: Exercise = {
      id: `custom-${generateId()}`,
      name: newName.trim(),
      primaryMuscle: newMuscle,
      secondaryMuscles: [],
      category: newCategory,
      force: newForce,
      isCustom: true,
    };
    await saveCustomExercise(exercise);
    registerCustomExercises(await getCustomExercises());
    setShowCreateForm(false);
    setNewName('');
    setRefreshKey(k => k + 1);
    onSelect(exercise);
  };

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet">
      <SafeAreaView style={styles.safe}>
        <View style={styles.header}>
          <Text style={styles.title}>Add Exercise</Text>
          <Pressable onPress={onClose}>
            <Ionicons name="close" size={28} color={Colors.text} />
          </Pressable>
        </View>

        <View style={styles.searchContainer}>
          <Ionicons name="search" size={20} color={Colors.textTertiary} />
          <TextInput
            style={styles.searchInput}
            value={search}
            onChangeText={setSearch}
            placeholder="Search exercises..."
            placeholderTextColor={Colors.textTertiary}
            autoFocus
          />
          {search.length > 0 && (
            <Pressable onPress={() => setSearch('')}>
              <Ionicons name="close-circle" size={20} color={Colors.textTertiary} />
            </Pressable>
          )}
        </View>

        {/* Create Custom Exercise Button */}
        <Pressable
          onPress={() => setShowCreateForm(!showCreateForm)}
          style={styles.createBtn}
        >
          <Ionicons
            name={showCreateForm ? 'close-circle' : 'add-circle'}
            size={22}
            color={Colors.accent}
          />
          <Text style={styles.createBtnText}>
            {showCreateForm ? 'Cancel' : 'Create Custom Exercise'}
          </Text>
        </Pressable>

        {/* Create Form */}
        {showCreateForm && (
          <ScrollView style={styles.createForm} contentContainerStyle={styles.createFormContent}>
            <TextInput
              style={styles.formInput}
              value={newName}
              onChangeText={setNewName}
              placeholder="Exercise name"
              placeholderTextColor={Colors.textTertiary}
              autoFocus
            />

            <Text style={styles.formLabel}>Primary Muscle</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false}>
              <View style={styles.chipRow}>
                {MUSCLE_GROUPS.map(m => (
                  <Pressable
                    key={m}
                    onPress={() => setNewMuscle(m)}
                    style={[
                      styles.formChip,
                      newMuscle === m && { backgroundColor: getMuscleGroupColor(m) + '33', borderColor: getMuscleGroupColor(m) },
                    ]}
                  >
                    <Text style={[styles.formChipText, newMuscle === m && { color: getMuscleGroupColor(m) }]}>
                      {MUSCLE_GROUP_LABELS[m]}
                    </Text>
                  </Pressable>
                ))}
              </View>
            </ScrollView>

            <Text style={styles.formLabel}>Equipment</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false}>
              <View style={styles.chipRow}>
                {CATEGORIES.map(c => (
                  <Pressable
                    key={c.value}
                    onPress={() => setNewCategory(c.value)}
                    style={[styles.formChip, newCategory === c.value && styles.formChipActive]}
                  >
                    <Text style={[styles.formChipText, newCategory === c.value && styles.formChipTextActive]}>
                      {c.label}
                    </Text>
                  </Pressable>
                ))}
              </View>
            </ScrollView>

            <Text style={styles.formLabel}>Force Type</Text>
            <View style={styles.chipRow}>
              {FORCES.map(f => (
                <Pressable
                  key={f.value}
                  onPress={() => setNewForce(f.value)}
                  style={[styles.formChip, newForce === f.value && styles.formChipActive]}
                >
                  <Text style={[styles.formChipText, newForce === f.value && styles.formChipTextActive]}>
                    {f.label}
                  </Text>
                </Pressable>
              ))}
            </View>

            <Pressable onPress={handleCreate} style={styles.saveBtn}>
              <Text style={styles.saveBtnText}>Create & Add</Text>
            </Pressable>
          </ScrollView>
        )}

        {!showCreateForm && (
          <>
            {part && (
              <Text style={styles.onlyPartTitle}>{BODY_PART_LABELS[part]} exercises</Text>
            )}
            {!search && !part && (
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                style={styles.muscleFilter}
                contentContainerStyle={styles.muscleFilterContent}
              >
                <Pressable
                  onPress={() => setSelectedMuscle(null)}
                  style={[
                    styles.muscleChip,
                    !selectedMuscle && styles.muscleChipActive,
                  ]}
                >
                  <Text
                    style={[
                      styles.muscleChipText,
                      !selectedMuscle && styles.muscleChipTextActive,
                    ]}
                  >
                    All
                  </Text>
                </Pressable>
                {CHIPS.map(m => {
                  const on = m === 'legs' ? isLegChip(selectedMuscle) : selectedMuscle === m;
                  return (
                    <Pressable
                      key={m}
                      onPress={() => setSelectedMuscle(on ? null : m)}
                      style={[
                        styles.muscleChip,
                        on && { backgroundColor: chipColor(m) + '33', borderColor: chipColor(m) },
                      ]}
                    >
                      <Text style={[styles.muscleChipText, on && { color: chipColor(m) }]}>
                        {chipLabel(m)}{m === 'legs' ? (on ? '  ▾' : '  ▸') : ''}
                      </Text>
                    </Pressable>
                  );
                })}
              </ScrollView>
            )}

            {/* Legs' subcategories, under the main row */}
            {!search && !part && isLegChip(selectedMuscle) && (
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                style={styles.legFilter}
                contentContainerStyle={styles.muscleFilterContent}
              >
                {LEG_CHIPS.map(m => (
                  <Pressable
                    key={m}
                    onPress={() => setSelectedMuscle(m)}
                    style={[styles.legChip, selectedMuscle === m && styles.legChipActive]}
                  >
                    <Text style={[styles.legChipText, selectedMuscle === m && styles.legChipTextActive]}>
                      {chipLabel(m, true)}
                    </Text>
                  </Pressable>
                ))}
              </ScrollView>
            )}

            <FlatList
              data={filtered}
              keyExtractor={e => e.id}
              extraData={refreshKey}
              contentContainerStyle={styles.list}
              renderItem={({ item }) => (
                <Pressable
                  onPress={() => onSelect(item)}
                  style={({ pressed }) => [
                    styles.exerciseRow,
                    pressed && { backgroundColor: Colors.bgElevated },
                  ]}
                >
                  <View style={{ flex: 1 }}>
                    <Text style={styles.exerciseName}>
                      {item.name}
                      {item.isCustom && <Text style={styles.customTag}> (Custom)</Text>}
                    </Text>
                    <View style={styles.exerciseMeta}>
                      <MuscleGroupBadge muscle={item.primaryMuscle} />
                      <Text style={styles.exerciseCategory}>
                        {item.category.replace('_', ' ')}
                      </Text>
                      {lastUsed[item.id] ? (
                        <Text style={styles.lastUsed}>Last done {getRelativeTime(lastUsed[item.id])}</Text>
                      ) : null}
                    </View>
                  </View>
                  <Ionicons name="add-circle" size={28} color={Colors.primary} />
                </Pressable>
              )}
            />
          </>
        )}
      </SafeAreaView>
    </Modal>
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
    fontSize: FontSize.xxl,
    fontWeight: '800',
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.bgInput,
    borderRadius: BorderRadius.md,
    paddingHorizontal: Spacing.md,
    marginHorizontal: Spacing.md,
    gap: Spacing.sm,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  searchInput: {
    flex: 1,
    color: Colors.text,
    fontSize: FontSize.md,
    paddingVertical: Spacing.md,
  },
  createBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    marginHorizontal: Spacing.md,
    marginTop: Spacing.sm,
    paddingVertical: Spacing.sm,
  },
  createBtnText: {
    color: Colors.accent,
    fontSize: FontSize.md,
    fontWeight: '700',
  },
  createForm: {
    maxHeight: 340,
    marginHorizontal: Spacing.md,
  },
  createFormContent: {
    gap: Spacing.sm,
    paddingBottom: Spacing.md,
  },
  formInput: {
    backgroundColor: Colors.bgInput,
    borderRadius: BorderRadius.md,
    padding: Spacing.md,
    color: Colors.text,
    fontSize: FontSize.md,
    fontWeight: '600',
    borderWidth: 1,
    borderColor: Colors.border,
  },
  formLabel: {
    color: Colors.textSecondary,
    fontSize: FontSize.sm,
    fontWeight: '700',
    marginTop: Spacing.xs,
  },
  chipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.xs,
  },
  formChip: {
    paddingHorizontal: Spacing.sm + 2,
    paddingVertical: Spacing.xs + 2,
    borderRadius: BorderRadius.round,
    backgroundColor: Colors.bgElevated,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  formChipActive: {
    backgroundColor: Colors.primaryMuted,
    borderColor: Colors.primary,
  },
  formChipText: {
    color: Colors.textSecondary,
    fontSize: FontSize.xs,
    fontWeight: '600',
  },
  formChipTextActive: {
    color: Colors.primary,
  },
  saveBtn: {
    backgroundColor: Colors.accent,
    borderRadius: BorderRadius.md,
    paddingVertical: Spacing.md,
    alignItems: 'center',
    marginTop: Spacing.sm,
  },
  saveBtnText: {
    color: Colors.bg,
    fontSize: FontSize.md,
    fontWeight: '800',
  },
  onlyPartTitle: {
    color: Colors.text,
    fontSize: FontSize.md,
    fontWeight: '700',
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
  },
  muscleFilter: {
    flexGrow: 0,
    flexShrink: 0,
    marginTop: Spacing.sm,
    marginBottom: Spacing.sm,
  },
  muscleFilterContent: {
    paddingHorizontal: Spacing.md,
    gap: Spacing.sm,
  },
  muscleChip: {
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.round,
    backgroundColor: Colors.bgElevated,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  legFilter: {
    flexGrow: 0,
    flexShrink: 0,
    marginBottom: Spacing.sm,
  },
  legChip: {
    paddingHorizontal: Spacing.sm + 2,
    paddingVertical: Spacing.xs + 1,
    borderRadius: BorderRadius.sm,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  legChipActive: {
    borderColor: Colors.text,
    borderWidth: 2,
  },
  legChipText: {
    color: Colors.textSecondary,
    fontSize: FontSize.xs,
    fontWeight: '600',
  },
  legChipTextActive: {
    color: Colors.text,
    fontWeight: '800',
  },
  muscleChipActive: {
    backgroundColor: Colors.primaryMuted,
    borderColor: Colors.primary,
  },
  muscleChipText: {
    color: Colors.textSecondary,
    fontSize: FontSize.sm,
    fontWeight: '600',
  },
  muscleChipTextActive: {
    color: Colors.primary,
  },
  list: {
    padding: Spacing.md,
    gap: Spacing.xs,
  },
  exerciseRow: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: Spacing.md,
    borderRadius: BorderRadius.md,
    gap: Spacing.md,
  },
  exerciseName: {
    color: Colors.text,
    fontSize: FontSize.md,
    fontWeight: '600',
  },
  customTag: {
    color: Colors.accent,
    fontSize: FontSize.xs,
    fontWeight: '600',
  },
  exerciseMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    marginTop: Spacing.xs,
  },
  exerciseCategory: {
    color: Colors.textTertiary,
    fontSize: FontSize.xs,
    textTransform: 'capitalize',
  },
  lastUsed: {
    color: Colors.textSecondary,
    fontSize: FontSize.xs,
    fontWeight: '600',
  },
});
