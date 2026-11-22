export function clearLegacyWorkflowHints(): void {
  if (typeof window === 'undefined') return;
  try {
    ['tg_stage_hint', 'tg_legacy_stage', 'ar_tax_onboarding_stage'].forEach((k) => {
      sessionStorage.removeItem(k);
      localStorage.removeItem(k);
    });
  } catch {
    // ignore
  }
}
