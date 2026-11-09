/**
 * DESTRIA TAX SERVICES LLC dashboard theme design tokens.
 * Single source of truth for dashboard chrome and workspace styling.
 */
export const DASHBOARD_THEME = {
  shell: '#06182B',
  gold: '#D4A843',
  radius: '8px',
  navigation: '#071A2E',
  workspace: '#06182B',
  interactive: '#0068BD',
  border: 'rgba(148, 163, 184, 0.22)',
  text: '#F8FAFC',
  surface: '#0D2745',
} as const;

export type DashboardTheme = typeof DASHBOARD_THEME;
