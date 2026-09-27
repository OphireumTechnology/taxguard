/**
 * A/R TAX SERVICES, LLC - Centralized Brand Design System Tokens
 * Master UHNW Corporate Editorial Palette:
 * - Primary Navy: #061A2F
 * - Deep Navy: #031323
 * - Midnight: #020D18
 * - Refined Gold: #C99A32
 * - Premium Gold: #D7AC4A
 * - Soft Gold: #E8C66A
 * - Warm Ivory: #F7F4ED
 * - Off White: #FBFAF7
 * - Pure White: #FFFFFF
 * - Charcoal Text: #1A2028
 * - Muted Text: #667085
 * - Border: #D8DCE2
 * - Success: #138A67
 * - Warning: #B87319
 * - Error: #B42318
 * - Information: #2563A6
 */

export const BRAND_COLORS = {
  // Navy scale
  primaryNavy: '#061A2F',
  deepNavy: '#031323',
  midnight: '#020D18',
  elevatedNavy: '#0A2544',
  navyHover: '#0E315A',

  // Gold scale
  refinedGold: '#C99A32',
  premiumGold: '#D7AC4A',
  softGold: '#E8C66A',
  mutedGoldSurface: '#F5ECDA',

  // Ivory & Light scale
  warmIvory: '#F7F4ED',
  offWhite: '#FBFAF7',
  pureWhite: '#FFFFFF',

  // Typography colors
  charcoalText: '#1A2028',
  primaryDarkText: '#1A2028',
  secondaryText: '#4A5568',
  mutedText: '#667085',
  textOnDark: '#F7F4ED',

  // Borders
  border: '#D8DCE2',
  navyBorder: '#1A365D',
  goldBorder: '#C99A32',
  lightBorder: '#D8DCE2',

  // Status indicators
  success: '#138A67',
  warning: '#B87319',
  error: '#B42318',
  errorBackground: '#FFF1F0',
  information: '#2563A6',

  // Backward-compatible aliases
  primaryMidnightNavy: '#061A2F',
  softIvorySurface: '#FBFAF7',
  brightGold: '#D7AC4A',
  softChampagne: '#E8C66A',
} as const;

export const SEMANTIC_THEME = {
  // Shell & Layout
  pageBackground: BRAND_COLORS.primaryNavy,
  surfaceDark: BRAND_COLORS.deepNavy,
  surfaceElevated: BRAND_COLORS.elevatedNavy,
  surfaceLight: BRAND_COLORS.offWhite,
  surfaceHighlight: BRAND_COLORS.warmIvory,
  surfaceMutedGold: BRAND_COLORS.mutedGoldSurface,
  workspaceBackground: BRAND_COLORS.offWhite,
  sidebarBackground: BRAND_COLORS.primaryNavy,

  // Brand Accents
  brandPrimary: BRAND_COLORS.refinedGold,
  brandHover: BRAND_COLORS.premiumGold,
  brandGoldSoft: BRAND_COLORS.softGold,
  brandBorder: BRAND_COLORS.goldBorder,

  // Text
  textOnDark: BRAND_COLORS.textOnDark,
  textPrimary: BRAND_COLORS.charcoalText,
  textSecondary: BRAND_COLORS.secondaryText,
  textMuted: BRAND_COLORS.mutedText,

  // Borders & Focus
  borderDark: BRAND_COLORS.navyBorder,
  borderLight: BRAND_COLORS.border,
  borderGold: BRAND_COLORS.goldBorder,
  focusRing: BRAND_COLORS.refinedGold,

  // Statuses
  statusSuccess: BRAND_COLORS.success,
  statusWarning: BRAND_COLORS.warning,
  statusError: BRAND_COLORS.error,
  statusErrorBg: BRAND_COLORS.errorBackground,
  statusInfo: BRAND_COLORS.information,
} as const;

