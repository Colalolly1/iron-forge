// Iron Forge — Pure monochrome theme for e-ink displays
export const Colors = {
  // Backgrounds — pure black
  bg: '#000000',
  bgCard: '#111111',
  bgElevated: '#1A1A1A',
  bgInput: '#1A1A1A',
  bgModal: '#0A0A0A',

  // Primary — white (used for emphasis)
  primary: '#FFFFFF',
  primaryLight: '#FFFFFF',
  primaryDark: '#CCCCCC',
  primaryMuted: 'rgba(255, 255, 255, 0.08)',

  // Accent — white (for PRs, success)
  accent: '#FFFFFF',
  accentLight: '#FFFFFF',
  accentDark: '#CCCCCC',
  accentMuted: 'rgba(255, 255, 255, 0.06)',

  // Warning — light gray
  warning: '#CCCCCC',
  warningMuted: 'rgba(204, 204, 204, 0.08)',

  // Danger — medium gray
  danger: '#999999',
  dangerMuted: 'rgba(153, 153, 153, 0.08)',

  // Text — high contrast B&W
  text: '#FFFFFF',
  textSecondary: '#AAAAAA',
  textTertiary: '#666666',
  textInverse: '#000000',

  // Borders
  border: '#222222',
  borderLight: '#333333',

  // Muscle group colors — all same gray (no color on e-ink)
  chest: '#BBBBBB',
  back: '#BBBBBB',
  shoulders: '#BBBBBB',
  arms: '#BBBBBB',
  legs: '#BBBBBB',
  core: '#BBBBBB',
  cardio: '#BBBBBB',
  fullBody: '#BBBBBB',

  // Gradients — solid white/gray (no color)
  gradientPrimary: ['#FFFFFF', '#CCCCCC'] as const,
  gradientAccent: ['#FFFFFF', '#CCCCCC'] as const,
  gradientFire: ['#CCCCCC', '#999999'] as const,
  gradientDark: ['#000000', '#111111'] as const,
} as const;

export const Spacing = {
  xs: 4,
  sm: 8,
  md: 16,
  lg: 24,
  xl: 32,
  xxl: 48,
} as const;

export const BorderRadius = {
  sm: 6,
  md: 10,
  lg: 14,
  xl: 20,
  round: 9999,
} as const;

export const FontSize = {
  xs: 12,
  sm: 14,
  md: 16,
  lg: 18,
  xl: 22,
  xxl: 28,
  xxxl: 34,
  hero: 46,
} as const;
