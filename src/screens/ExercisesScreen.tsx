import React, { useState, useMemo, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  TextInput,
  FlatList,
  ScrollView,
  Modal,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { MuscleGroupBadge } from '../components/MuscleGroupBadge';
import {
  EXERCISES,
  EXERCISE_MAP,
  searchExercises,
  getAllExercises,
  MUSCLE_GROUP_LABELS,
} from '../data/exercises';
import { getMuscleGroupColor, generateId } from '../utils/helpers';
import { renameExercise, saveCustomExercise } from '../utils/storage';
import { Exercise, MuscleGroup, ExerciseCategory, BodyPart } from '../types';
import { exerciseInMuscle, isLegChip, LEG_MUSCLES, MuscleChip, partMatches } from '../utils/bodyParts';
import { Colors, Spacing, FontSize, BorderRadius } from '../theme/colors';

/** Muscles to choose from when making or editing an exercise. */
const MUSCLE_GROUPS: MuscleGroup[] = [
  'chest', 'back', 'shoulders', 'biceps', 'triceps', 'forearms',
  'quads', 'hamstrings', 'glutes', 'adductors', 'abductors', 'calves', 'core', 'traps', 'lats', 'cardio',
];

/** The filter row. Legs is one tab; its muscles appear in a second row once it's picked. */
const FILTER_CHIPS: MuscleChip[] = [
  'chest', 'back', 'shoulders', 'biceps', 'triceps', 'forearms', 'legs', 'core', 'traps', 'lats', 'cardio',
];
const LEG_CHIPS: MuscleChip[] = ['legs', ...LEG_MUSCLES];
const chipLabel = (c: MuscleChip, inLegRow = false) => (c === 'legs' ? (inLegRow ? 'All legs' : 'Legs') : MUSCLE_GROUP_LABELS[c]);
const chipColor = (c: MuscleChip) => getMuscleGroupColor(c === 'legs' ? 'quads' : c);

const CATEGORIES: { label: string; value: ExerciseCategory }[] = [
  { label: 'Barbell', value: 'barbell' },
  { label: 'Dumbbell', value: 'dumbbell' },
  { label: 'Machine', value: 'machine' },
  { label: 'Cable', value: 'cable' },
  { label: 'Bodyweight', value: 'bodyweight' },
  { label: 'Kettlebell', value: 'kettlebell' },
  { label: 'Smith Machine', value: 'smith_machine' },
  { label: 'Cardio', value: 'cardio' },
];

export function ExercisesScreen({ navigation }: any) {
  const [search, setSearch] = useState('');
  const [selectedMuscle, setSelectedMuscle] = useState<MuscleChip | null>(null);
  const [selectedCategory, setSelectedCategory] = useState<ExerciseCategory | null>(null);
  const [renameModalVisible, setRenameModalVisible] = useState(false);
  const [renameTarget, setRenameTarget] = useState<Exercise | null>(null);
  const [renameInput, setRenameInput] = useState('');
  const [editMuscle, setEditMuscle] = useState<MuscleGroup>('chest');
  const [createModalVisible, setCreateModalVisible] = useState(false);
  const [createName, setCreateName] = useState('');
  const [createMuscle, setCreateMuscle] = useState<MuscleGroup>('chest');
  const [createCategory, setCreateCategory] = useState<ExerciseCategory>('barbell');
  const [refreshKey, setRefreshKey] = useState(0);

  const filtered = useMemo(() => {
    // refreshKey forces recompute after rename
    void refreshKey;
    let results = search ? searchExercises(search) : getAllExercises();
    if (selectedMuscle) {
      const m = selectedMuscle;
      results = results.filter(e =>
        m === 'legs' || LEG_MUSCLES.includes(m) ? partMatches(m as BodyPart, e) : exerciseInMuscle(m, e));
    }
    if (selectedCategory) {
      results = results.filter(e => e.category === selectedCategory);
    }
    results.sort((a, b) => a.name.localeCompare(b.name));
    return results;
  }, [search, selectedMuscle, selectedCategory, refreshKey]);

  const handleLongPress = useCallback((exercise: Exercise) => {
    setRenameTarget(exercise);
    setRenameInput(exercise.name);
    setEditMuscle(exercise.primaryMuscle);
    setRenameModalVisible(true);
  }, []);

  const handleRenameConfirm = useCallback(async () => {
    if (!renameTarget || !renameInput.trim()) return;
    const newName = renameInput.trim();
    const muscleChanged = editMuscle !== renameTarget.primaryMuscle;
    const nameChanged = newName !== renameTarget.name;
    if (!nameChanged && !muscleChanged) {
      setRenameModalVisible(false);
      return;
    }
    // Update in-memory EXERCISE_MAP
    const mapEntry = EXERCISE_MAP.get(renameTarget.id);
    if (mapEntry) {
      if (nameChanged) mapEntry.name = newName;
      if (muscleChanged) mapEntry.primaryMuscle = editMuscle;
    }
    // Persist across all workouts (pass original so built-in overrides get saved)
    await renameExercise(renameTarget.id, newName, muscleChanged ? editMuscle : undefined, renameTarget);
    setRenameModalVisible(false);
    setRefreshKey(k => k + 1);
  }, [renameTarget, renameInput, editMuscle]);

  const handleCreateExercise = useCallback(async () => {
    if (!createName.trim()) return;
    const id = `custom-${createName.toLowerCase().replace(/[^a-z0-9]+/g, '-')}-${Date.now()}`;
    const exercise: Exercise = {
      id,
      name: createName.trim(),
      primaryMuscle: createMuscle,
      secondaryMuscles: [],
      category: createCategory,
      force: 'compound',
      isCustom: true,
    };
    await saveCustomExercise(exercise);
    EXERCISE_MAP.set(id, exercise);
    setCreateModalVisible(false);
    setCreateName('');
    setRefreshKey(k => k + 1);
  }, [createName, createMuscle, createCategory]);

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <View style={styles.header}>
        <View>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: Spacing.sm }}>
            {navigation.canGoBack?.() && (
              <Pressable onPress={() => navigation.goBack()} hitSlop={12}>
                <Ionicons name="chevron-back" size={26} color={Colors.text} />
              </Pressable>
            )}
            <Text style={styles.title}>Exercises</Text>
          </View>
          <Text style={styles.hint}>Long press to edit</Text>
        </View>
        <Pressable
          onPress={() => {
            setCreateName('');
            setCreateMuscle('chest');
            setCreateCategory('barbell');
            setCreateModalVisible(true);
          }}
          style={styles.createBtn}
        >
          <Ionicons name="add" size={20} color={Colors.textInverse} />
          <Text style={styles.createBtnText}>New</Text>
        </Pressable>
      </View>

      {/* Search */}
      <View style={styles.searchContainer}>
        <Ionicons name="search" size={20} color={Colors.textTertiary} />
        <TextInput
          style={styles.searchInput}
          value={search}
          onChangeText={setSearch}
          placeholder="Search exercises..."
          placeholderTextColor={Colors.textTertiary}
        />
        {search.length > 0 && (
          <Pressable onPress={() => setSearch('')}>
            <Ionicons name="close-circle" size={20} color={Colors.textTertiary} />
          </Pressable>
        )}
      </View>

      {/* Muscle filter */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={styles.filterScroll}
        contentContainerStyle={styles.filterContent}
      >
        <Pressable
          onPress={() => setSelectedMuscle(null)}
          style={[
            styles.filterChip,
            !selectedMuscle && styles.filterChipActive,
          ]}
        >
          <Text
            style={[
              styles.filterChipText,
              !selectedMuscle && styles.filterChipTextActive,
            ]}
          >
            All
          </Text>
        </Pressable>
        {FILTER_CHIPS.map(m => {
          const on = m === 'legs' ? isLegChip(selectedMuscle) : selectedMuscle === m;
          return (
            <Pressable
              key={m}
              onPress={() => setSelectedMuscle(on ? null : m)}
              style={[
                styles.filterChip,
                on && { backgroundColor: chipColor(m) + '33', borderColor: chipColor(m) },
              ]}
            >
              <Text style={[styles.filterChipText, on && { color: chipColor(m) }]}>
                {chipLabel(m)}{m === 'legs' ? (on ? '  ▾' : '  ▸') : ''}
              </Text>
            </Pressable>
          );
        })}
      </ScrollView>

      {/* Legs' subcategories, under the main row */}
      {isLegChip(selectedMuscle) && (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={[styles.filterScroll, { marginBottom: Spacing.sm }]}
          contentContainerStyle={styles.filterContent}
        >
          {LEG_CHIPS.map(m => (
            <Pressable
              key={m}
              onPress={() => setSelectedMuscle(m)}
              style={[styles.filterChip, selectedMuscle === m && styles.filterChipActive]}
            >
              <Text style={[styles.filterChipText, selectedMuscle === m && styles.filterChipTextActive]}>
                {chipLabel(m, true)}
              </Text>
            </Pressable>
          ))}
        </ScrollView>
      )}

      {/* Category filter */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={[styles.filterScroll, { marginBottom: Spacing.sm }]}
        contentContainerStyle={styles.filterContent}
      >
        {CATEGORIES.map(c => (
          <Pressable
            key={c.value}
            onPress={() =>
              setSelectedCategory(c.value === selectedCategory ? null : c.value)
            }
            style={[
              styles.filterChip,
              styles.categoryChip,
              selectedCategory === c.value && styles.filterChipActive,
            ]}
          >
            <Text
              style={[
                styles.filterChipText,
                selectedCategory === c.value && styles.filterChipTextActive,
              ]}
            >
              {c.label}
            </Text>
          </Pressable>
        ))}
      </ScrollView>

      {/* Exercise List */}
      <FlatList
        data={filtered}
        keyExtractor={e => e.id}
        contentContainerStyle={styles.list}
        renderItem={({ item }) => (
          <Pressable
            onPress={() => navigation.navigate('ExerciseHistory', {
              exerciseId: item.id,
              exerciseName: item.name,
            })}
            onLongPress={() => handleLongPress(item)}
            style={({ pressed }) => [
              styles.exerciseRow,
              pressed && { backgroundColor: Colors.bgElevated },
            ]}
          >
            <View
              style={[
                styles.muscleIndicator,
                { backgroundColor: getMuscleGroupColor(item.primaryMuscle) },
              ]}
            />
            <View style={{ flex: 1 }}>
              <Text style={styles.exerciseName}>{item.name}</Text>
              <View style={styles.exerciseMeta}>
                <MuscleGroupBadge muscle={item.primaryMuscle} />
                {item.secondaryMuscles.slice(0, 2).map(m => (
                  <MuscleGroupBadge key={m} muscle={m} />
                ))}
              </View>
            </View>
            <View style={styles.categoryBadge}>
              <Text style={styles.categoryText}>
                {item.category.replace('_', ' ')}
              </Text>
            </View>
          </Pressable>
        )}
      />

      {/* Rename Modal */}
      <Modal
        visible={renameModalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setRenameModalVisible(false)}
      >
        <Pressable style={styles.modalOverlay} onPress={() => setRenameModalVisible(false)}>
          <Pressable style={styles.modalContent} onPress={() => {}}>
            <Text style={styles.modalTitle}>Edit Exercise</Text>
            <Text style={styles.modalSubtitle}>
              Changes apply everywhere — history, templates, and PRs.
            </Text>
            <Text style={styles.modalLabel}>Name</Text>
            <TextInput
              style={styles.modalInput}
              value={renameInput}
              onChangeText={setRenameInput}
              autoFocus
              selectTextOnFocus
              placeholderTextColor={Colors.textTertiary}
            />
            <Text style={styles.modalLabel}>Primary Muscle</Text>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.muscleChips}
            >
              {MUSCLE_GROUPS.map(m => (
                <Pressable
                  key={m}
                  onPress={() => setEditMuscle(m)}
                  style={[
                    styles.muscleChip,
                    editMuscle === m && styles.muscleChipActive,
                  ]}
                >
                  <Text
                    style={[
                      styles.muscleChipText,
                      editMuscle === m && styles.muscleChipTextActive,
                    ]}
                  >
                    {MUSCLE_GROUP_LABELS[m]}
                  </Text>
                </Pressable>
              ))}
            </ScrollView>
            <View style={styles.modalButtons}>
              <Pressable
                onPress={() => setRenameModalVisible(false)}
                style={styles.modalBtnCancel}
              >
                <Text style={styles.modalBtnCancelText}>Cancel</Text>
              </Pressable>
              <Pressable onPress={handleRenameConfirm} style={styles.modalBtnConfirm}>
                <Text style={styles.modalBtnConfirmText}>Rename</Text>
              </Pressable>
            </View>
          </Pressable>
        </Pressable>
      </Modal>

      {/* Create Exercise Modal */}
      <Modal
        visible={createModalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setCreateModalVisible(false)}
      >
        <Pressable style={styles.modalOverlay} onPress={() => setCreateModalVisible(false)}>
          <Pressable style={styles.modalContent} onPress={() => {}}>
            <Text style={styles.modalTitle}>New Exercise</Text>
            <Text style={styles.modalLabel}>Name</Text>
            <TextInput
              style={styles.modalInput}
              value={createName}
              onChangeText={setCreateName}
              placeholder="Exercise name"
              placeholderTextColor={Colors.textTertiary}
              autoFocus
            />
            <Text style={styles.modalLabel}>Primary Muscle</Text>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.muscleChips}
            >
              {MUSCLE_GROUPS.map(m => (
                <Pressable
                  key={m}
                  onPress={() => setCreateMuscle(m)}
                  style={[
                    styles.muscleChip,
                    createMuscle === m && styles.muscleChipActive,
                  ]}
                >
                  <Text
                    style={[
                      styles.muscleChipText,
                      createMuscle === m && styles.muscleChipTextActive,
                    ]}
                  >
                    {MUSCLE_GROUP_LABELS[m]}
                  </Text>
                </Pressable>
              ))}
            </ScrollView>
            <Text style={styles.modalLabel}>Category</Text>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.muscleChips}
            >
              {CATEGORIES.map(c => (
                <Pressable
                  key={c.value}
                  onPress={() => setCreateCategory(c.value)}
                  style={[
                    styles.muscleChip,
                    createCategory === c.value && styles.muscleChipActive,
                  ]}
                >
                  <Text
                    style={[
                      styles.muscleChipText,
                      createCategory === c.value && styles.muscleChipTextActive,
                    ]}
                  >
                    {c.label}
                  </Text>
                </Pressable>
              ))}
            </ScrollView>
            <View style={styles.modalButtons}>
              <Pressable
                onPress={() => setCreateModalVisible(false)}
                style={styles.modalBtnCancel}
              >
                <Text style={styles.modalBtnCancelText}>Cancel</Text>
              </Pressable>
              <Pressable onPress={handleCreateExercise} style={styles.modalBtnConfirm}>
                <Text style={styles.modalBtnConfirmText}>Create</Text>
              </Pressable>
            </View>
          </Pressable>
        </Pressable>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.bg },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'baseline',
    paddingHorizontal: Spacing.md,
    paddingTop: Spacing.md,
  },
  title: {
    color: Colors.text,
    fontSize: FontSize.xxxl,
    fontWeight: '800',
  },
  hint: {
    color: Colors.textTertiary,
    fontSize: FontSize.xs,
    fontWeight: '600',
    marginTop: 2,
  },
  createBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: Colors.text,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.round,
  },
  createBtnText: {
    color: Colors.textInverse,
    fontSize: FontSize.sm,
    fontWeight: '700',
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.bgInput,
    borderRadius: BorderRadius.md,
    paddingHorizontal: Spacing.md,
    marginHorizontal: Spacing.md,
    marginTop: Spacing.md,
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
  filterScroll: {
    flexGrow: 0,
    flexShrink: 0,
    marginTop: Spacing.sm,
  },
  filterContent: {
    paddingHorizontal: Spacing.md,
    gap: Spacing.sm,
  },
  filterChip: {
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.round,
    backgroundColor: Colors.bgElevated,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  categoryChip: {},
  filterChipActive: {
    backgroundColor: Colors.primaryMuted,
    borderColor: Colors.primary,
  },
  filterChipText: {
    color: Colors.text,
    fontSize: FontSize.sm,
    fontWeight: '700',
  },
  filterChipTextActive: {
    color: Colors.primary,
  },
  list: {
    padding: Spacing.md,
    gap: 2,
    paddingBottom: 100,
  },
  exerciseRow: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: Spacing.md,
    borderRadius: BorderRadius.md,
    gap: Spacing.md,
  },
  muscleIndicator: {
    width: 4,
    height: 36,
    borderRadius: 2,
  },
  exerciseName: {
    color: Colors.text,
    fontSize: FontSize.md,
    fontWeight: '600',
  },
  exerciseMeta: {
    flexDirection: 'row',
    gap: Spacing.xs,
    marginTop: Spacing.xs,
    flexWrap: 'wrap',
  },
  categoryBadge: {
    backgroundColor: Colors.bgElevated,
    paddingHorizontal: Spacing.sm + 2,
    paddingVertical: Spacing.xs,
    borderRadius: BorderRadius.sm,
    borderWidth: 1,
    borderColor: Colors.borderLight,
  },
  categoryText: {
    color: Colors.text,
    fontSize: FontSize.xs,
    fontWeight: '700',
    textTransform: 'capitalize',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.8)',
    justifyContent: 'center',
    padding: Spacing.lg,
  },
  modalContent: {
    backgroundColor: Colors.bgCard,
    borderRadius: BorderRadius.lg,
    padding: Spacing.lg,
    gap: Spacing.md,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  modalTitle: {
    color: Colors.text,
    fontSize: FontSize.xl,
    fontWeight: '700',
  },
  modalSubtitle: {
    color: Colors.textSecondary,
    fontSize: FontSize.sm,
  },
  modalLabel: {
    color: Colors.textSecondary,
    fontSize: FontSize.sm,
    fontWeight: '700',
  },
  modalInput: {
    backgroundColor: Colors.bgInput,
    borderRadius: BorderRadius.md,
    padding: Spacing.md,
    color: Colors.text,
    fontSize: FontSize.lg,
    fontWeight: '700',
    borderWidth: 1,
    borderColor: Colors.borderLight,
  },
  muscleChips: {
    gap: Spacing.xs,
    paddingVertical: Spacing.xs,
  },
  muscleChip: {
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.round,
    backgroundColor: Colors.bgElevated,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  muscleChipActive: {
    backgroundColor: Colors.text,
    borderColor: Colors.text,
  },
  muscleChipText: {
    color: Colors.textSecondary,
    fontSize: FontSize.xs,
    fontWeight: '700',
  },
  muscleChipTextActive: {
    color: Colors.textInverse,
  },
  modalButtons: {
    flexDirection: 'row',
    gap: Spacing.md,
    justifyContent: 'flex-end',
  },
  modalBtnCancel: {
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.sm + 2,
    borderRadius: BorderRadius.md,
    backgroundColor: Colors.bgElevated,
  },
  modalBtnCancelText: {
    color: Colors.text,
    fontSize: FontSize.md,
    fontWeight: '700',
  },
  modalBtnConfirm: {
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.sm + 2,
    borderRadius: BorderRadius.md,
    backgroundColor: Colors.text,
  },
  modalBtnConfirmText: {
    color: Colors.textInverse,
    fontSize: FontSize.md,
    fontWeight: '700',
  },
});
