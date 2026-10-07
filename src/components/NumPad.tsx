import React, { createContext, useContext } from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors, Spacing, FontSize, BorderRadius } from '../theme/colors';

/**
 * The app's own number pad for logging sets. The phone keyboard covered the
 * sets, had to be dismissed by hand and made the list jump; this pad sits at
 * the bottom of the workout, never covers the set being typed, and has the
 * keys a set needs: Next (weight → reps → next set), Done (tick the set) and
 * − / + steps.
 */

export interface PadTarget {
  /** Unique per field, e.g. "<setId>:weight". */
  key: string;
  title: string;
  kind: 'weight' | 'reps';
  unit: string;
  /** The value when the pad opened. */
  value: number;
  /** Last time's value, used as the start point for − / +. */
  ghost?: number;
  onInput: (v: number) => void;
  onNext: () => void;
  onDone: () => void;
}

export interface PadApi {
  activeKey: string | null;
  /** What's been typed into the active field so far. */
  buffer: string;
  open: (t: PadTarget) => void;
  close: () => void;
  /** Scroll so a row (window coordinates) sits in view above the pad. */
  ensureVisible: (top: number, bottom: number) => void;
}

export const PadContext = createContext<PadApi | null>(null);

export function usePad(): PadApi | null {
  return useContext(PadContext);
}

/** Turn a key press into the next buffer. Returns null when nothing changes. */
export function applyKey(
  key: string,
  buffer: string,
  fresh: boolean,
  target: PadTarget,
): string | null {
  const isWeight = target.kind === 'weight';
  const cur = fresh ? '' : buffer;
  if (/^[0-9]$/.test(key)) {
    const next = (cur === '0' ? '' : cur === '-0' ? '-' : cur) + key;
    return next.replace('-', '').length > 6 ? null : next;
  }
  if (key === '.') {
    if (!isWeight || cur.includes('.')) return null;
    return (cur === '' || cur === '-' ? cur + '0' : cur) + '.';
  }
  if (key === 'back') return cur.slice(0, -1);
  if (key === 'sign') {
    if (!isWeight) return null;
    const b = buffer;
    return b.startsWith('-') ? b.slice(1) : '-' + b;
  }
  if (key === 'minus' || key === 'plus') {
    const base = parseFloat(buffer) || target.value || target.ghost || 0;
    const step = isWeight ? (target.unit === 'kg' ? 2.5 : 5) : 1;
    let v = base + (key === 'plus' ? step : -step);
    if (!isWeight) v = Math.max(0, Math.round(v));
    return String(Math.round(v * 100) / 100);
  }
  return null;
}

export function parsePad(buffer: string, kind: 'weight' | 'reps'): number {
  return kind === 'weight' ? parseFloat(buffer) || 0 : parseInt(buffer, 10) || 0;
}

export function NumPad({ target, onKey }: { target: PadTarget; onKey: (key: string) => void }) {
  const isWeight = target.kind === 'weight';
  const step = isWeight ? (target.unit === 'kg' ? '2.5' : '5') : '1';
  const Key = ({ k, label, icon, wide, strong }: { k: string; label?: string; icon?: any; wide?: boolean; strong?: boolean }) => (
    <Pressable
      onPress={() => onKey(k)}
      style={({ pressed }) => [styles.key, !wide && styles.keyFlex, strong && styles.keyStrong, pressed && styles.keyPressed]}
    >
      {icon ? (
        <Ionicons name={icon} size={24} color={strong ? Colors.textInverse : Colors.text} />
      ) : (
        <Text style={[styles.keyText, strong && styles.keyTextStrong]}>{label}</Text>
      )}
    </Pressable>
  );
  return (
    <View style={styles.pad}>
      <View style={styles.head}>
        <Text style={styles.title} numberOfLines={1}>{target.title}</Text>
        <Pressable onPress={() => onKey('hide')} hitSlop={10} style={styles.hide}>
          <Text style={styles.hideText}>Hide</Text>
        </Pressable>
      </View>
      <View style={styles.body}>
        <View style={styles.grid}>
          <View style={styles.row}><Key k="1" label="1" /><Key k="2" label="2" /><Key k="3" label="3" /></View>
          <View style={styles.row}><Key k="4" label="4" /><Key k="5" label="5" /><Key k="6" label="6" /></View>
          <View style={styles.row}><Key k="7" label="7" /><Key k="8" label="8" /><Key k="9" label="9" /></View>
          <View style={styles.row}>
            {isWeight ? <Key k="." label="." /> : <View style={[styles.key, styles.keyFlex, styles.keyBlank]} />}
            <Key k="0" label="0" />
            <Key k="back" icon="backspace-outline" />
          </View>
        </View>
        <View style={styles.side}>
          <View style={styles.row}>
            <Key k="minus" label={`−${step}`} />
            <Key k="plus" label={`+${step}`} />
          </View>
          {isWeight ? <Key k="sign" label="+/−" wide /> : <View style={[styles.key, styles.keyBlank]} />}
          <Key k="next" label="Next" wide />
          <Key k="done" icon="checkmark" wide strong />
        </View>
      </View>
    </View>
  );
}

const KEY_H = 52;

const styles = StyleSheet.create({
  pad: {
    backgroundColor: Colors.bgCard,
    borderTopWidth: 1,
    borderTopColor: Colors.borderLight,
    paddingHorizontal: Spacing.sm,
    paddingBottom: Spacing.sm,
  },
  head: { flexDirection: 'row', alignItems: 'center', paddingVertical: Spacing.sm, paddingHorizontal: Spacing.xs },
  title: { flex: 1, color: Colors.text, fontSize: FontSize.sm, fontWeight: '700' },
  hide: { paddingHorizontal: Spacing.sm, paddingVertical: 2 },
  hideText: { color: Colors.text, fontSize: FontSize.sm, fontWeight: '600', textDecorationLine: 'underline' },
  body: { flexDirection: 'row', gap: Spacing.sm },
  grid: { flex: 3, gap: 6 },
  side: { flex: 2, gap: 6 },
  row: { flexDirection: 'row', gap: 6 },
  key: {
    height: KEY_H,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    borderColor: Colors.border,
    backgroundColor: Colors.bgElevated,
    alignItems: 'center',
    justifyContent: 'center',
  },
  keyFlex: { flex: 1 },
  keyBlank: { borderColor: 'transparent', backgroundColor: 'transparent' },
  keyStrong: { backgroundColor: Colors.primary, borderColor: Colors.primary },
  keyPressed: { backgroundColor: Colors.borderLight },
  keyText: { color: Colors.text, fontSize: FontSize.xl, fontWeight: '700' },
  keyTextStrong: { color: Colors.textInverse },
});
