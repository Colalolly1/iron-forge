import React, { useState, useEffect } from 'react';
import { View, Text, ScrollView, StyleSheet, TextInput } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { Pressable } from 'react-native';
import { Card } from '../components/Card';
import { getProfile } from '../utils/storage';
import { plateCalculator } from '../utils/helpers';
import { Colors, Spacing, FontSize, BorderRadius } from '../theme/colors';

const PLATE_COLORS: Record<number, string> = {
  45: '#FF4444',
  35: '#FFD700',
  25: '#22CC44',
  10: '#4488FF',
  5: '#FF8800',
  2.5: '#AAAAAA',
  // kg
  20: '#FF4444',
  15: '#FFD700',
  1.25: '#AAAAAA',
};

export function PlateCalculatorScreen({ navigation }: any) {
  const [targetWeight, setTargetWeight] = useState('');
  const [barWeight, setBarWeight] = useState(45);
  const [unit, setUnit] = useState<'lbs' | 'kg'>('lbs');

  useEffect(() => {
    getProfile().then(p => {
      setUnit(p.weightUnit);
      setBarWeight(p.weightUnit === 'kg' ? 20 : 45);
    });
  }, []);

  const target = parseFloat(targetWeight) || 0;
  const plates = plateCalculator(target, barWeight, unit);
  const actualWeight = barWeight + plates.reduce((s, p) => s + p, 0) * 2;

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <View style={styles.header}>
        <Pressable onPress={() => navigation.goBack()}>
          <Ionicons name="chevron-back" size={24} color={Colors.text} />
        </Pressable>
        <Text style={styles.headerTitle}>Plate Calculator</Text>
        <View style={{ width: 24 }} />
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        <Card style={styles.inputCard}>
          <View style={styles.row}>
            <View style={styles.inputGroup}>
              <Text style={styles.label}>Target Weight ({unit})</Text>
              <TextInput
                style={styles.input}
                value={targetWeight}
                onChangeText={setTargetWeight}
                keyboardType="numeric"
                placeholder="0"
                placeholderTextColor={Colors.textTertiary}
              />
            </View>
            <View style={styles.inputGroup}>
              <Text style={styles.label}>Bar Weight ({unit})</Text>
              <TextInput
                style={styles.input}
                value={String(barWeight)}
                onChangeText={t => setBarWeight(parseFloat(t) || 0)}
                keyboardType="numeric"
              />
            </View>
          </View>
        </Card>

        {target > 0 && (
          <Card style={styles.resultCard}>
            <Text style={styles.resultTitle}>Each Side</Text>

            {/* Visual barbell */}
            <View style={styles.barbell}>
              <View style={styles.barbellBar} />
              {plates.map((plate, i) => (
                <View
                  key={i}
                  style={[
                    styles.plate,
                    {
                      backgroundColor: PLATE_COLORS[plate] ?? Colors.textTertiary,
                      height: Math.max(30, 20 + plate * (unit === 'kg' ? 2 : 1)),
                    },
                  ]}
                >
                  <Text style={styles.plateText}>{plate}</Text>
                </View>
              ))}
              <View style={styles.barbellCollar} />
            </View>

            {/* Plate list */}
            <View style={styles.plateList}>
              {plates.length === 0 ? (
                <Text style={styles.noPlates}>
                  {target <= barWeight
                    ? 'Just the bar!'
                    : 'Cannot reach exact weight'}
                </Text>
              ) : (
                (() => {
                  const counts: Record<number, number> = {};
                  plates.forEach(p => (counts[p] = (counts[p] || 0) + 1));
                  return Object.entries(counts).map(([plate, count]) => (
                    <View key={plate} style={styles.plateRow}>
                      <View
                        style={[
                          styles.plateDot,
                          {
                            backgroundColor:
                              PLATE_COLORS[parseFloat(plate)] ?? Colors.textTertiary,
                          },
                        ]}
                      />
                      <Text style={styles.plateWeight}>
                        {plate} {unit}
                      </Text>
                      <Text style={styles.plateCount}>x{count}</Text>
                    </View>
                  ));
                })()
              )}
            </View>

            <Text style={styles.actualWeight}>
              Actual: {actualWeight} {unit}
            </Text>
          </Card>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.bg },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: Spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  headerTitle: {
    color: Colors.text,
    fontSize: FontSize.lg,
    fontWeight: '700',
  },
  content: { padding: Spacing.md, gap: Spacing.md },
  inputCard: { gap: Spacing.md },
  row: { flexDirection: 'row', gap: Spacing.md },
  inputGroup: { flex: 1, gap: Spacing.xs },
  label: {
    color: Colors.textSecondary,
    fontSize: FontSize.sm,
    fontWeight: '600',
  },
  input: {
    backgroundColor: Colors.bgInput,
    borderRadius: BorderRadius.md,
    padding: Spacing.md,
    color: Colors.text,
    fontSize: FontSize.xxl,
    fontWeight: '800',
    textAlign: 'center',
    borderWidth: 1,
    borderColor: Colors.border,
  },
  resultCard: { gap: Spacing.lg, alignItems: 'center' },
  resultTitle: {
    color: Colors.text,
    fontSize: FontSize.xl,
    fontWeight: '700',
  },
  barbell: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    paddingHorizontal: Spacing.md,
  },
  barbellBar: {
    width: 40,
    height: 8,
    backgroundColor: Colors.textTertiary,
    borderRadius: 4,
  },
  plate: {
    width: 18,
    borderRadius: 3,
    alignItems: 'center',
    justifyContent: 'center',
  },
  plateText: {
    color: Colors.text,
    fontSize: 8,
    fontWeight: '800',
  },
  barbellCollar: {
    width: 10,
    height: 16,
    backgroundColor: Colors.textSecondary,
    borderRadius: 2,
  },
  plateList: { gap: Spacing.sm, width: '100%' },
  noPlates: {
    color: Colors.textSecondary,
    fontSize: FontSize.md,
    textAlign: 'center',
  },
  plateRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  plateDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
  },
  plateWeight: {
    color: Colors.text,
    fontSize: FontSize.lg,
    fontWeight: '600',
    flex: 1,
  },
  plateCount: {
    color: Colors.primary,
    fontSize: FontSize.lg,
    fontWeight: '700',
  },
  actualWeight: {
    color: Colors.textSecondary,
    fontSize: FontSize.md,
    fontWeight: '600',
  },
});
