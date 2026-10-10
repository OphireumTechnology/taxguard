/**
 * A/R TAX SERVICES, LLC - Centralized Brand Design System Tokens
 * Canonical Semantic Design Tokens:
 * - Page Background: #06182B
 * - Deepest Surface: #071A2E
 * - Primary Card / Panel: #0D2745
 * - Secondary / Elevated Surface: #102D4F
 * - Interactive Surface: #143657
 * - Primary Brand Gold: #D4A843
 * - Gold Hover / Active: #E1BB60
 * - Soft Gold Background: rgba(212, 168, 67, 0.10)
 * - Primary Text: #F8FAFC
 * - Secondary Text: #A9B7C8
 * - Muted Text: #7F91A6
 * - Subtle Border: rgba(148, 163, 184, 0.18)
 * - Gold Border: rgba(212, 168, 67, 0.40)
 * - Success: #10B981
 * - Warning: #F59E0B
 * - Error: #EF4444
 */

/** Additive light-workspace tokens; never remap the existing public/dark theme. */
export const DASHBOARD_THEME = {
  shell: '#06182B',
  navigation: '#08243F',
  workspace: '#F0F5FA',
  surface: '#FFFFFF',
  text: '#102C49',
  muted: '#52677E',
  border: '#CBD8E6',
  gold: '#D4A843',
  interactive: '#0068BD',
  success: '#087F46',
  warning: '#946000',
  critical: '#BE253C',
  ai: '#6936B5',
  radius: '6px',
  spacing: { compact: '8px', standard: '16px', section: '24px' },
} as const;

export const CANONICAL_PALETTE = {
  pageBackground: '#06182B',
  deepestSurface: '#071A2E',
  primaryCard: '#0D2745',
  secondarySurface: '#102D4F',
  interactiveSurface: '#143657',
  primaryGold: '#D4A843',
  goldHover: '#E1BB60',
  softGoldBg: 'rgba(212, 168, 67, 0.10)',
  primaryText: '#F8FAFC',
  secondaryText: '#A9B7C8',
  mutedText: '#7F91A6',
  subtleBorder: 'rgba(148, 163, 184, 0.18)',
  goldBorder: 'rgba(212, 168, 67, 0.40)',
  success: '#10B981',
  warning: '#F59E0B',
  error: '#EF4444',
} as const;

export const BRAND_COLORS = {
  // Navy scale
  primaryNavy: '#06182B',
  deepNavy: '#071A2E',
  midnight: '#020D18',
  elevatedNavy: '#102D4F',
  cardNavy: '#0D2745',
  interactiveNavy: '#143657',
  navyHover: '#143657',

  // Gold scale
  refinedGold: '#D4A843',
  premiumGold: '#E1BB60',
  softGold: '#E1BB60',
  mutedGoldSurface: 'rgba(212, 168, 67, 0.10)',

  // Ivory & Light scale
  warmIvory: '#F8FAFC',
  offWhite: '#F8FAFC',
  pureWhite: '#FFFFFF',

  // Typography colors
  charcoalText: '#06182B',
  primaryDarkText: '#06182B',
  secondaryText: '#A9B7C8',
  mutedText: '#7F91A6',
  textOnDark: '#F8FAFC',

  // Borders
  border: 'rgba(148, 163, 184, 0.18)',
  navyBorder: 'rgba(148, 163, 184, 0.18)',
  goldBorder: 'rgba(212, 168, 67, 0.40)',
  lightBorder: 'rgba(148, 163, 184, 0.18)',

  // Status indicators
  success: '#10B981',
  warning: '#F59E0B',
  error: '#EF4444',
  errorBackground: 'rgba(239, 68, 68, 0.12)',
  information: '#3B82F6',

  // Backward-compatible aliases
  primaryMidnightNavy: '#06182B',
  softIvorySurface: '#F8FAFC',
  brightGold: '#E1BB60',
  softChampagne: '#E1BB60',
} as const;

export const SEMANTIC_THEME = {
  // Shell & Layout
  pageBackground: CANONICAL_PALETTE.pageBackground,
  surfaceDark: CANONICAL_PALETTE.deepestSurface,
  surfaceElevated: CANONICAL_PALETTE.secondarySurface,
  surfaceCard: CANONICAL_PALETTE.primaryCard,
  surfaceInteractive: CANONICAL_PALETTE.interactiveSurface,
  surfaceLight: CANONICAL_PALETTE.primaryCard,
  surfaceHighlight: CANONICAL_PALETTE.secondarySurface,
  surfaceMutedGold: CANONICAL_PALETTE.softGoldBg,
  workspaceBackground: CANONICAL_PALETTE.pageBackground,
  sidebarBackground: CANONICAL_PALETTE.deepestSurface,

  // Brand Accents
  brandPrimary: CANONICAL_PALETTE.primaryGold,
  brandHover: CANONICAL_PALETTE.goldHover,
  brandGoldSoft: CANONICAL_PALETTE.softGoldBg,
  brandBorder: CANONICAL_PALETTE.goldBorder,

  // Text
  textOnDark: CANONICAL_PALETTE.primaryText,
  textPrimary: CANONICAL_PALETTE.primaryText,
  textSecondary: CANONICAL_PALETTE.secondaryText,
  textMuted: CANONICAL_PALETTE.mutedText,

  // Borders & Focus
  borderDark: CANONICAL_PALETTE.subtleBorder,
  borderLight: CANONICAL_PALETTE.subtleBorder,
  borderGold: CANONICAL_PALETTE.goldBorder,
  focusRing: CANONICAL_PALETTE.primaryGold,

  // Statuses
  statusSuccess: CANONICAL_PALETTE.success,
  statusWarning: CANONICAL_PALETTE.warning,
  statusError: CANONICAL_PALETTE.error,
  statusErrorBg: 'rgba(239, 68, 68, 0.12)',
  statusInfo: '#3B82F6',
} as const;
