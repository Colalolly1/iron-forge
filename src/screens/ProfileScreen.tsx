import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  Pressable,
  TextInput,
  Switch,
  Alert,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { Card } from '../components/Card';
import { Button } from '../components/Button';
import { getProfile, saveProfile, getMeasurements, saveMeasurement, deleteMeasurement, getWorkouts, clearAllData, rebuildAllPRs, exportAllData, importAllData } from '../utils/storage';
import { exportWorkoutsCSV, exportMeasurementsCSV, shareCSV, shareJSON, readPickedFile } from '../utils/export';
import { importStrongWorkouts } from '../utils/importStrong';
import * as DocumentPicker from 'expo-document-picker';
import { generateId } from '../utils/helpers';
import { UserProfile, BodyMeasurement } from '../types';
import { Colors, Spacing, FontSize, BorderRadius } from '../theme/colors';

export function ProfileScreen({ navigation }: any) {
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [measurements, setMeasurements] = useState<BodyMeasurement[]>([]);
  const [showMeasurementForm, setShowMeasurementForm] = useState(false);
  const [newMeasurement, setNewMeasurement] = useState<Partial<BodyMeasurement>>({});
  const [restTimerText, setRestTimerText] = useState('');

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    const [p, m] = await Promise.all([getProfile(), getMeasurements()]);
    setProfile(p);
    setRestTimerText(String(p.restTimerDefault));
    setMeasurements(m);
  };

  const updateProfile = async (updates: Partial<UserProfile>) => {
    if (!profile) return;
    const updated = { ...profile, ...updates };
    setProfile(updated);
    await saveProfile(updated);
  };

  const handleSaveMeasurement = async () => {
    const m: BodyMeasurement = {
      id: generateId(),
      date: new Date().toISOString(),
      ...newMeasurement,
    };
    await saveMeasurement(m);
    setNewMeasurement({});
    setShowMeasurementForm(false);
    loadData();
  };

  if (!profile) return null;

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.title}>Settings</Text>

        {/* Profile */}
        <Card style={styles.section}>
          <Text style={styles.sectionTitle}>Profile</Text>
          <View style={styles.field}>
            <Text style={styles.label}>Name</Text>
            <TextInput
              style={styles.input}
              value={profile.name}
              onChangeText={name => updateProfile({ name })}
              placeholder="Your name"
              placeholderTextColor={Colors.textTertiary}
            />
          </View>
        </Card>

        {/* Units */}
        <Card style={styles.section}>
          <Text style={styles.sectionTitle}>Units</Text>
          <View style={styles.toggleRow}>
            <Text style={styles.label}>Weight Unit</Text>
            <View style={styles.segmented}>
              <Pressable
                onPress={() => updateProfile({ weightUnit: 'lbs' })}
                style={[
                  styles.segBtn,
                  profile.weightUnit === 'lbs' && styles.segBtnActive,
                ]}
              >
                <Text
                  style={[
                    styles.segText,
                    profile.weightUnit === 'lbs' && styles.segTextActive,
                  ]}
                >
                  lbs
                </Text>
              </Pressable>
              <Pressable
                onPress={() => updateProfile({ weightUnit: 'kg' })}
                style={[
                  styles.segBtn,
                  profile.weightUnit === 'kg' && styles.segBtnActive,
                ]}
              >
                <Text
                  style={[
                    styles.segText,
                    profile.weightUnit === 'kg' && styles.segTextActive,
                  ]}
                >
                  kg
                </Text>
              </Pressable>
            </View>
          </View>

          <View style={styles.toggleRow}>
            <Text style={styles.label}>Measurement Unit</Text>
            <View style={styles.segmented}>
              <Pressable
                onPress={() => updateProfile({ measurementUnit: 'in' })}
                style={[
                  styles.segBtn,
                  profile.measurementUnit === 'in' && styles.segBtnActive,
                ]}
              >
                <Text
                  style={[
                    styles.segText,
                    profile.measurementUnit === 'in' && styles.segTextActive,
                  ]}
                >
                  in
                </Text>
              </Pressable>
              <Pressable
                onPress={() => updateProfile({ measurementUnit: 'cm' })}
                style={[
                  styles.segBtn,
                  profile.measurementUnit === 'cm' && styles.segBtnActive,
                ]}
              >
                <Text
                  style={[
                    styles.segText,
                    profile.measurementUnit === 'cm' && styles.segTextActive,
                  ]}
                >
                  cm
                </Text>
              </Pressable>
            </View>
          </View>
        </Card>

        {/* Workout Settings */}
        <Card style={styles.section}>
          <Text style={styles.sectionTitle}>Workout</Text>

          <View style={styles.field}>
            <Text style={styles.label}>Default Rest Timer (seconds)</Text>
            <TextInput
              style={styles.input}
              value={restTimerText}
              onChangeText={t => setRestTimerText(t.replace(/[^0-9]/g, ''))}
              onBlur={() => {
                const val = parseInt(restTimerText) || 90;
                setRestTimerText(String(val));
                updateProfile({ restTimerDefault: val });
              }}
              keyboardType="numeric"
            />
          </View>

          <View style={styles.toggleRow}>
            <View>
              <Text style={styles.label}>Show RPE</Text>
              <Text style={styles.sublabel}>Rate of Perceived Exertion</Text>
            </View>
            <Switch
              value={profile.showRPE}
              onValueChange={v => updateProfile({ showRPE: v })}
              trackColor={{ true: Colors.primary, false: Colors.bgInput }}
              thumbColor={Colors.text}
            />
          </View>

          <View style={styles.toggleRow}>
            <View>
              <Text style={styles.label}>Auto Rest Timer</Text>
              <Text style={styles.sublabel}>Start timer after completing a set</Text>
            </View>
            <Switch
              value={profile.autoRestTimer}
              onValueChange={v => updateProfile({ autoRestTimer: v })}
              trackColor={{ true: Colors.primary, false: Colors.bgInput }}
              thumbColor={Colors.text}
            />
          </View>

          <View style={styles.toggleRow}>
            <View>
              <Text style={styles.label}>Timer Vibration</Text>
              <Text style={styles.sublabel}>Vibrate when rest timer ends</Text>
            </View>
            <Switch
              value={profile.vibration}
              onValueChange={v => updateProfile({ vibration: v })}
              trackColor={{ true: Colors.primary, false: Colors.bgInput }}
              thumbColor={Colors.text}
            />
          </View>

          <View style={styles.toggleRow}>
            <View>
              <Text style={styles.label}>Timer Sound</Text>
              <Text style={styles.sublabel}>Play bell when rest timer ends</Text>
            </View>
            <Switch
              value={profile.sound}
              onValueChange={v => updateProfile({ sound: v })}
              trackColor={{ true: Colors.primary, false: Colors.bgInput }}
              thumbColor={Colors.text}
            />
          </View>

          <View style={styles.toggleRow}>
            <View>
              <Text style={styles.label}>Previous Data Source</Text>
              <Text style={styles.sublabel}>Show past weight/reps in inputs</Text>
            </View>
            <View style={styles.segmented}>
              <Pressable
                onPress={() => updateProfile({ previousDataSource: 'last_workout' })}
                style={[
                  styles.segBtn,
                  profile.previousDataSource === 'last_workout' && styles.segBtnActive,
                ]}
              >
                <Text
                  style={[
                    styles.segText,
                    profile.previousDataSource === 'last_workout' && styles.segTextActive,
                  ]}
                >
                  Last Workout
                </Text>
              </Pressable>
              <Pressable
                onPress={() => updateProfile({ previousDataSource: 'template' })}
                style={[
                  styles.segBtn,
                  profile.previousDataSource === 'template' && styles.segBtnActive,
                ]}
              >
                <Text
                  style={[
                    styles.segText,
                    profile.previousDataSource === 'template' && styles.segTextActive,
                  ]}
                >
                  Template
                </Text>
              </Pressable>
            </View>
          </View>
        </Card>

        {/* Body Measurements */}
        <Card style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Body Measurements</Text>
            <Pressable onPress={() => setShowMeasurementForm(!showMeasurementForm)}>
              <Ionicons
                name={showMeasurementForm ? 'close' : 'add-circle'}
                size={24}
                color={Colors.primary}
              />
            </Pressable>
          </View>

          {showMeasurementForm && (
            <View style={styles.measurementForm}>
              <MeasurementInput
                label={`Body Weight (${profile.weightUnit})`}
                value={newMeasurement.weight}
                onChange={v => setNewMeasurement(prev => ({ ...prev, weight: v }))}
              />
              <MeasurementInput
                label="Body Fat %"
                value={newMeasurement.bodyFat}
                onChange={v =>
                  setNewMeasurement(prev => ({ ...prev, bodyFat: v }))
                }
              />
              <MeasurementInput
                label={`Chest (${profile.measurementUnit})`}
                value={newMeasurement.chest}
                onChange={v => setNewMeasurement(prev => ({ ...prev, chest: v }))}
              />
              <MeasurementInput
                label={`Waist (${profile.measurementUnit})`}
                value={newMeasurement.waist}
                onChange={v => setNewMeasurement(prev => ({ ...prev, waist: v }))}
              />
              <MeasurementInput
                label={`Bicep (${profile.measurementUnit})`}
                value={newMeasurement.bicepLeft}
                onChange={v =>
                  setNewMeasurement(prev => ({ ...prev, bicepLeft: v }))
                }
              />

              <Button
                title="Save Measurement"
                onPress={handleSaveMeasurement}
                variant="accent"
                fullWidth
                style={{ marginTop: Spacing.sm }}
              />
            </View>
          )}

          {measurements.slice(0, 5).map(m => (
            <View key={m.id} style={styles.measurementRow}>
              <View style={{ flex: 1 }}>
                <Text style={styles.measurementDate}>
                  {new Date(m.date).toLocaleDateString()}
                </Text>
                <View style={styles.measurementValues}>
                  {m.weight && (
                    <Text style={styles.measurementValue}>
                      {m.weight} {profile.weightUnit}
                    </Text>
                  )}
                  {m.bodyFat && (
                    <Text style={styles.measurementValue}>{m.bodyFat}% BF</Text>
                  )}
                </View>
              </View>
              <Pressable
                onPress={() => {
                  const doDelete = async () => {
                    await deleteMeasurement(m.id);
                    setMeasurements(prev => prev.filter(x => x.id !== m.id));
                  };
                  if (Platform.OS === 'web') {
                    if (window.confirm('Delete this measurement?')) doDelete();
                  } else {
                    Alert.alert('Delete', 'Delete this measurement?', [
                      { text: 'Cancel', style: 'cancel' },
                      { text: 'Delete', style: 'destructive', onPress: doDelete },
                    ]);
                  }
                }}
                hitSlop={8}
              >
                <Ionicons name="trash-outline" size={18} color={Colors.danger} />
              </Pressable>
            </View>
          ))}
        </Card>

        {/* Tools */}
        <Card style={styles.section}>
          <Text style={styles.sectionTitle}>Tools</Text>

          <Pressable
            onPress={() => navigation.navigate('PlateCalculator')}
            style={styles.toolRow}
          >
            <Ionicons name="calculator-outline" size={22} color={Colors.primary} />
            <Text style={styles.toolText}>Plate Calculator</Text>
            <Ionicons name="chevron-forward" size={20} color={Colors.textTertiary} />
          </Pressable>

          <Pressable
            onPress={() => navigation.navigate('OneRepMax')}
            style={styles.toolRow}
          >
            <Ionicons name="trophy-outline" size={22} color={Colors.warning} />
            <Text style={styles.toolText}>1RM Calculator</Text>
            <Ionicons name="chevron-forward" size={20} color={Colors.textTertiary} />
          </Pressable>

          <Pressable
            onPress={async () => {
              try {
                const workouts = await getWorkouts();
                if (workouts.length === 0) {
                  Alert.alert('No Data', 'Complete some workouts first to export.');
                  return;
                }
                const csv = exportWorkoutsCSV(workouts, profile.weightUnit);
                await shareCSV(csv, 'ironforge-workouts.csv');
              } catch (e: any) {
                Alert.alert('Export Failed', e.message || 'Could not export workout history.');
              }
            }}
            style={styles.toolRow}
          >
            <Ionicons name="download-outline" size={22} color={Colors.accent} />
            <Text style={styles.toolText}>Export Workout History</Text>
            <Ionicons name="chevron-forward" size={20} color={Colors.textTertiary} />
          </Pressable>

          <Pressable
            onPress={async () => {
              try {
                if (measurements.length === 0) {
                  Alert.alert('No Data', 'Add some body measurements first to export.');
                  return;
                }
                const csv = exportMeasurementsCSV(measurements, profile.weightUnit, profile.measurementUnit);
                await shareCSV(csv, 'ironforge-measurements.csv');
              } catch (e: any) {
                Alert.alert('Export Failed', e.message || 'Could not export measurements.');
              }
            }}
            style={styles.toolRow}
          >
            <Ionicons name="body-outline" size={22} color={Colors.primary} />
            <Text style={styles.toolText}>Export Body Measurements</Text>
            <Ionicons name="chevron-forward" size={20} color={Colors.textTertiary} />
          </Pressable>

          <Pressable
            onPress={async () => {
              try {
                const result = await DocumentPicker.getDocumentAsync({
                  type: ['text/csv', 'text/comma-separated-values', 'application/csv', '*/*'],
                  copyToCacheDirectory: true,
                });
                if (result.canceled || !result.assets?.[0]) return;
                const asset = result.assets[0];
                const csvContent = await readPickedFile(asset.uri);
                const { imported, unmatchedExercises } = await importStrongWorkouts(csvContent);
                let msg = `Successfully imported ${imported} workout${imported !== 1 ? 's' : ''}.`;
                if (unmatchedExercises.length > 0) {
                  msg += `\n\n${unmatchedExercises.length} exercise${unmatchedExercises.length !== 1 ? 's' : ''} couldn't be matched and were added as custom:\n${unmatchedExercises.slice(0, 5).join('\n')}`;
                  if (unmatchedExercises.length > 5) msg += `\n...and ${unmatchedExercises.length - 5} more`;
                }
                Alert.alert('Import Complete', msg);
              } catch (e: any) {
                Alert.alert('Import Failed', e.message || 'Could not read the file.');
              }
            }}
            style={styles.toolRow}
          >
            <Ionicons name="cloud-upload-outline" size={22} color={Colors.warning} />
            <Text style={styles.toolText}>Import Data</Text>
            <Ionicons name="chevron-forward" size={20} color={Colors.textTertiary} />
          </Pressable>
        </Card>

        {/* Data Tools */}
        <Card style={styles.section}>
          <Text style={styles.sectionTitle}>Data Tools</Text>

          <Pressable
            onPress={async () => {
              try {
                const json = await exportAllData();
                const date = new Date().toISOString().slice(0, 10);
                await shareJSON(json, `ironforge-backup-${date}.json`);
              } catch (e: any) {
                Alert.alert('Backup Failed', e.message || 'Could not export data.');
              }
            }}
            style={[styles.toolRow, { borderTopWidth: 0 }]}
          >
            <Ionicons name="save-outline" size={22} color={Colors.accent} />
            <Text style={styles.toolText}>Backup All Data</Text>
            <Ionicons name="chevron-forward" size={20} color={Colors.textTertiary} />
          </Pressable>

          <Pressable
            onPress={async () => {
              try {
                const result = await DocumentPicker.getDocumentAsync({
                  type: ['application/json', '*/*'],
                  copyToCacheDirectory: true,
                });
                if (result.canceled || !result.assets?.[0]) return;
                const asset = result.assets[0];
                const jsonContent = await readPickedFile(asset.uri);
                Alert.alert(
                  'Restore Data?',
                  'This will overwrite all current data with the backup. Are you sure?',
                  [
                    { text: 'Cancel', style: 'cancel' },
                    {
                      text: 'Restore',
                      style: 'destructive',
                      onPress: async () => {
                        await importAllData(jsonContent);
                        Alert.alert('Restore Complete', 'All data has been restored from backup.');
                        loadData();
                      },
                    },
                  ],
                );
              } catch (e: any) {
                Alert.alert('Restore Failed', e.message || 'Could not read the file.');
              }
            }}
            style={styles.toolRow}
          >
            <Ionicons name="cloud-download-outline" size={22} color={Colors.primary} />
            <Text style={styles.toolText}>Restore from Backup</Text>
            <Ionicons name="chevron-forward" size={20} color={Colors.textTertiary} />
          </Pressable>

          <Pressable
            onPress={async () => {
              const count = await rebuildAllPRs();
              Alert.alert('PRs Rebuilt', `Found ${count} personal records across all workouts (including imported data).`);
            }}
            style={styles.toolRow}
          >
            <Ionicons name="trophy-outline" size={22} color={Colors.text} />
            <Text style={styles.toolText}>Rebuild PRs from All Workouts</Text>
            <Ionicons name="chevron-forward" size={20} color={Colors.textTertiary} />
          </Pressable>
        </Card>

        {/* Danger Zone */}
        <Card style={styles.section}>
          <Text style={styles.sectionTitle}>Danger Zone</Text>
          <Pressable
            onPress={() => {
              const doDelete = async () => {
                await clearAllData();
                Alert.alert('Data Cleared', 'All workout data has been erased.');
                loadData();
              };
              if (Platform.OS === 'web') {
                if (window.confirm('Delete ALL data? This will erase all workouts, templates, measurements, custom exercises, and personal records. This cannot be undone.')) {
                  doDelete();
                }
              } else {
                Alert.alert(
                  'Delete ALL Data?',
                  'This will erase all workouts, templates, measurements, custom exercises, and personal records. This cannot be undone.',
                  [
                    { text: 'Cancel', style: 'cancel' },
                    { text: 'Delete Everything', style: 'destructive', onPress: doDelete },
                  ],
                );
              }
            }}
            style={[styles.toolRow, { borderTopWidth: 0 }]}
          >
            <Ionicons name="nuclear-outline" size={22} color={Colors.danger} />
            <Text style={[styles.toolText, { color: Colors.danger }]}>Clear All Data</Text>
            <Ionicons name="chevron-forward" size={20} color={Colors.danger} />
          </Pressable>
        </Card>

        <View style={{ height: 100 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

function MeasurementInput({
  label,
  value,
  onChange,
}: {
  label: string;
  value?: number;
  onChange: (v: number) => void;
}) {
  return (
    <View style={styles.measureField}>
      <Text style={styles.measureLabel}>{label}</Text>
      <TextInput
        style={styles.measureInput}
        value={value ? String(value) : ''}
        onChangeText={t => onChange(parseFloat(t) || 0)}
        keyboardType="numeric"
        placeholder="—"
        placeholderTextColor={Colors.textTertiary}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.bg },
  content: { padding: Spacing.md, gap: Spacing.md },
  title: {
    color: Colors.text,
    fontSize: FontSize.xxxl,
    fontWeight: '800',
  },
  section: {
    gap: Spacing.md,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  sectionTitle: {
    color: Colors.text,
    fontSize: FontSize.lg,
    fontWeight: '700',
  },
  field: {
    gap: Spacing.xs,
  },
  label: {
    color: Colors.text,
    fontSize: FontSize.md,
    fontWeight: '700',
  },
  sublabel: {
    color: Colors.textSecondary,
    fontSize: FontSize.sm,
    fontWeight: '500',
  },
  input: {
    backgroundColor: Colors.bgInput,
    borderRadius: BorderRadius.md,
    padding: Spacing.md,
    color: Colors.text,
    fontSize: FontSize.md,
    fontWeight: '600',
    borderWidth: 1,
    borderColor: Colors.border,
  },
  toggleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  segmented: {
    flexDirection: 'row',
    backgroundColor: Colors.bgInput,
    borderRadius: BorderRadius.md,
    padding: 2,
  },
  segBtn: {
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.sm,
  },
  segBtnActive: {
    backgroundColor: Colors.primary,
  },
  segText: {
    color: Colors.textSecondary,
    fontSize: FontSize.sm,
    fontWeight: '700',
  },
  segTextActive: {
    color: Colors.textInverse,
  },
  measurementForm: {
    gap: Spacing.sm,
    padding: Spacing.sm,
    backgroundColor: Colors.bgElevated,
    borderRadius: BorderRadius.md,
  },
  measureField: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  measureLabel: {
    color: Colors.textSecondary,
    fontSize: FontSize.sm,
    fontWeight: '600',
    flex: 1,
  },
  measureInput: {
    backgroundColor: Colors.bgInput,
    borderRadius: BorderRadius.sm,
    padding: Spacing.sm,
    color: Colors.text,
    fontSize: FontSize.md,
    fontWeight: '600',
    textAlign: 'center',
    width: 80,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  measurementRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: Spacing.sm,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
  },
  measurementDate: {
    color: Colors.textSecondary,
    fontSize: FontSize.sm,
  },
  measurementValues: {
    flexDirection: 'row',
    gap: Spacing.md,
  },
  measurementValue: {
    color: Colors.text,
    fontSize: FontSize.md,
    fontWeight: '600',
  },
  toolRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    paddingVertical: Spacing.sm,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
  },
  toolText: {
    flex: 1,
    color: Colors.text,
    fontSize: FontSize.md,
    fontWeight: '600',
  },
});
