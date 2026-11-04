export function clearLegacyWorkflowHints(): void {
  if (typeof window === 'undefined') return;
  try {
    const legacyKeys = [
      'taxguard_legacy_step',
      'taxguard_workflow_hint',
      'tg_stage_hint_1',
      'tg_stage_hint_2',
      'tg_stage_hint_3',
      'tg_stage_hint_4',
      'tg_stage_hint_5',
      'tg_stage_hint_6',
      'tg_stage_hint_7',
      'tg_stage_hint_8'
    ];
    for (const key of legacyKeys) {
      sessionStorage.removeItem(key);
      localStorage.removeItem(key);
    }
  } catch {
    // Ignore storage unavailability
  }
}
