import React, { useState, useEffect } from 'react';
import { View, Text, ScrollView, StyleSheet, TextInput, Pressable } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { Card } from '../components/Card';
import { getProfile } from '../utils/storage';
import { Colors, Spacing, FontSize, BorderRadius } from '../theme/colors';

const PERCENTAGES = [100, 95, 90, 85, 80, 75, 70, 65, 60, 55, 50];

export function OneRepMaxScreen({ navigation }: any) {
  const [weight, setWeight] = useState('');
  const [reps, setReps] = useState('');
  const [unit, setUnit] = useState<'lbs' | 'kg'>('lbs');

  useEffect(() => {
    getProfile().then(p => setUnit(p.weightUnit));
  }, []);

  const w = parseFloat(weight) || 0;
  const r = parseInt(reps) || 0;

  // Multiple formulas
  const epley = r === 1 ? w : w * (1 + r / 30);
  const brzycki = r === 1 ? w : w * (36 / (37 - r));
  const lombardi = r === 1 ? w : w * Math.pow(r, 0.1);
  const oconner = r === 1 ? w : w * (1 + r * 0.025);

  const avg = (epley + brzycki + lombardi + oconner) / 4;
  const estimated1RM = Math.round(avg);

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <View style={styles.header}>
        <Pressable onPress={() => navigation.goBack()}>
          <Ionicons name="chevron-back" size={24} color={Colors.text} />
        </Pressable>
        <Text style={styles.headerTitle}>1RM Calculator</Text>
        <View style={{ width: 24 }} />
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        <Card style={styles.inputCard}>
          <View style={styles.row}>
            <View style={styles.inputGroup}>
              <Text style={styles.label}>Weight ({unit})</Text>
              <TextInput
                style={styles.input}
                value={weight}
                onChangeText={setWeight}
                keyboardType="numeric"
                placeholder="0"
                placeholderTextColor={Colors.textTertiary}
              />
            </View>
            <View style={styles.inputGroup}>
              <Text style={styles.label}>Reps</Text>
              <TextInput
                style={styles.input}
                value={reps}
                onChangeText={setReps}
                keyboardType="numeric"
                placeholder="0"
                placeholderTextColor={Colors.textTertiary}
              />
            </View>
          </View>
        </Card>

        {w > 0 && r > 0 && (
          <>
            {/* Estimated 1RM */}
            <Card style={styles.resultCard}>
              <Text style={styles.resultLabel}>Estimated 1RM</Text>
              <Text style={styles.resultValue}>
                {estimated1RM} {unit}
              </Text>
              <View style={styles.formulas}>
                <FormulaRow label="Epley" value={Math.round(epley)} unit={unit} />
                <FormulaRow label="Brzycki" value={Math.round(brzycki)} unit={unit} />
                <FormulaRow label="Lombardi" value={Math.round(lombardi)} unit={unit} />
                <FormulaRow label="O'Conner" value={Math.round(oconner)} unit={unit} />
              </View>
            </Card>

            {/* Percentage table */}
            <Card style={styles.tableCard}>
              <Text style={styles.tableTitle}>Percentage Table</Text>
              {PERCENTAGES.map(pct => {
                const pctWeight = Math.round(estimated1RM * (pct / 100));
                const estReps = pct === 100 ? 1 : Math.round(30 * (1 - pct / 100) / (pct / 100) * 100) / 100;
                return (
                  <View key={pct} style={styles.pctRow}>
                    <Text style={styles.pctLabel}>{pct}%</Text>
                    <View style={styles.pctBar}>
                      <View
                        style={[
                          styles.pctFill,
                          { width: `${pct}%` },
                        ]}
                      />
                    </View>
                    <Text style={styles.pctWeight}>
                      {pctWeight} {unit}
                    </Text>
                  </View>
                );
              })}
            </Card>
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

function FormulaRow({ label, value, unit }: { label: string; value: number; unit: string }) {
  return (
    <View style={fStyles.row}>
      <Text style={fStyles.label}>{label}</Text>
      <Text style={fStyles.value}>
        {value} {unit}
      </Text>
    </View>
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
  content: { padding: Spacing.md, gap: Spacing.md, paddingBottom: 40 },
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
  resultCard: {
    alignItems: 'center',
    gap: Spacing.md,
  },
  resultLabel: {
    color: Colors.textSecondary,
    fontSize: FontSize.md,
    fontWeight: '600',
  },
  resultValue: {
    color: Colors.accent,
    fontSize: FontSize.hero,
    fontWeight: '900',
  },
  formulas: {
    width: '100%',
    gap: Spacing.sm,
  },
  tableCard: { gap: Spacing.sm },
  tableTitle: {
    color: Colors.text,
    fontSize: FontSize.lg,
    fontWeight: '700',
    marginBottom: Spacing.sm,
  },
  pctRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  pctLabel: {
    color: Colors.textSecondary,
    fontSize: FontSize.sm,
    fontWeight: '700',
    width: 40,
    textAlign: 'right',
  },
  pctBar: {
    flex: 1,
    height: 6,
    backgroundColor: Colors.bgInput,
    borderRadius: 3,
    overflow: 'hidden',
  },
  pctFill: {
    height: '100%',
    backgroundColor: Colors.primary,
    borderRadius: 3,
  },
  pctWeight: {
    color: Colors.text,
    fontSize: FontSize.md,
    fontWeight: '700',
    width: 70,
    textAlign: 'right',
  },
});

const fStyles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: Spacing.xs,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
  },
  label: {
    color: Colors.textSecondary,
    fontSize: FontSize.sm,
  },
  value: {
    color: Colors.text,
    fontSize: FontSize.sm,
    fontWeight: '700',
  },
});
