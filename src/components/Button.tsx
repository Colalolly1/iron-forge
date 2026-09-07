import React from 'react';
import {
  Pressable,
  Text,
  StyleSheet,
  ViewStyle,
  TextStyle,
  ActivityIndicator,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Colors, BorderRadius, Spacing, FontSize } from '../theme/colors';

type ButtonVariant = 'primary' | 'secondary' | 'danger' | 'ghost' | 'accent';
type ButtonSize = 'sm' | 'md' | 'lg';

interface ButtonProps {
  title: string;
  onPress: () => void;
  variant?: ButtonVariant;
  size?: ButtonSize;
  disabled?: boolean;
  loading?: boolean;
  icon?: React.ReactNode;
  style?: ViewStyle;
  fullWidth?: boolean;
}

export function Button({
  title,
  onPress,
  variant = 'primary',
  size = 'md',
  disabled,
  loading,
  icon,
  style,
  fullWidth,
}: ButtonProps) {
  const isGradient = variant === 'primary' || variant === 'accent';

  const content = (pressed: boolean) => (
    <>
      {loading ? (
        <ActivityIndicator size="small" color={Colors.text} />
      ) : (
        <>
          {icon}
          <Text
            style={[
              styles.text,
              sizeStyles[size].text,
              isGradient && { color: Colors.textInverse },
              variant === 'ghost' && { color: Colors.text },
              variant === 'danger' && { color: Colors.text },
              variant === 'secondary' && { color: Colors.text },
            ]}
          >
            {title}
          </Text>
        </>
      )}
    </>
  );

  if (isGradient) {
    const gradientColors =
      variant === 'accent' ? Colors.gradientAccent : Colors.gradientPrimary;
    return (
      <Pressable
        onPress={onPress}
        disabled={disabled || loading}
        style={[fullWidth && { width: '100%' }, style]}
      >
        {({ pressed }) => (
          <LinearGradient
            colors={[...gradientColors]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={[
              styles.base,
              sizeStyles[size].button,
              pressed && styles.pressed,
              disabled && styles.disabled,
            ]}
          >
            {content(pressed)}
          </LinearGradient>
        )}
      </Pressable>
    );
  }

  return (
    <Pressable
      onPress={onPress}
      disabled={disabled || loading}
      style={({ pressed }) => [
        styles.base,
        sizeStyles[size].button,
        variant === 'secondary' && styles.secondary,
        variant === 'danger' && styles.dangerBg,
        variant === 'ghost' && styles.ghost,
        pressed && styles.pressed,
        disabled && styles.disabled,
        fullWidth && { width: '100%' },
        style,
      ]}
    >
      {({ pressed }) => content(pressed)}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: BorderRadius.md,
    gap: Spacing.sm,
  },
  text: {
    color: Colors.text,
    fontWeight: '700',
  },
  secondary: {
    backgroundColor: Colors.bgElevated,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  dangerBg: {
    backgroundColor: Colors.dangerMuted,
    borderWidth: 1,
    borderColor: Colors.danger,
  },
  ghost: {
    backgroundColor: 'transparent',
  },
  pressed: {
    opacity: 0.85,
    transform: [{ scale: 0.97 }],
  },
  disabled: {
    opacity: 0.4,
  },
});

const sizeStyles = {
  sm: StyleSheet.create({
    button: { paddingVertical: Spacing.sm, paddingHorizontal: Spacing.md },
    text: { fontSize: FontSize.sm },
  }),
  md: StyleSheet.create({
    button: { paddingVertical: Spacing.md - 2, paddingHorizontal: Spacing.lg },
    text: { fontSize: FontSize.md },
  }),
  lg: StyleSheet.create({
    button: { paddingVertical: Spacing.md + 2, paddingHorizontal: Spacing.xl },
    text: { fontSize: FontSize.lg },
  }),
};
