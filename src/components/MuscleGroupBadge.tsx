import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { MuscleGroup } from '../types';
import { MUSCLE_GROUP_LABELS } from '../data/exercises';
import { getMuscleGroupColor } from '../utils/helpers';
import { BorderRadius, FontSize, Spacing } from '../theme/colors';

interface MuscleGroupBadgeProps {
  muscle: MuscleGroup;
  size?: 'sm' | 'md';
}

export function MuscleGroupBadge({ muscle, size = 'sm' }: MuscleGroupBadgeProps) {
  const color = getMuscleGroupColor(muscle);
  return (
    <View style={[styles.badge, size === 'md' && styles.md, { backgroundColor: color + '22', borderColor: color + '44' }]}>
      <Text style={[styles.text, size === 'md' && styles.mdText, { color }]}>
        {MUSCLE_GROUP_LABELS[muscle]}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    paddingHorizontal: Spacing.sm + 2,
    paddingVertical: 2,
    borderRadius: BorderRadius.round,
    borderWidth: 1,
  },
  md: {
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.xs,
  },
  text: {
    fontSize: FontSize.xs,
    fontWeight: '600',
  },
  mdText: {
    fontSize: FontSize.sm,
  },
});
