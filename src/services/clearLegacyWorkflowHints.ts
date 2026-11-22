export function clearLegacyWorkflowHints(): void {
  if (typeof window === 'undefined') return;
  try {
    const keys = [
      'taxguard_legacy_stage',
      'taxguard_workflow_hint',
      'taxguard_demo_stage',
      'ar_tax_stage_override',
    ];
    for (const key of keys) {
      window.localStorage.removeItem(key);
      window.sessionStorage.removeItem(key);
    }
  } catch {
    // Ignore storage access errors
  }
}
