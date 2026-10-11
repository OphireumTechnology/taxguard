const legacyKeys = [
  'taxguard_stage', 'taxguard_active_stage', 'stageOneCompleted', 'stageTwoCompleted',
  'stageThreeCompleted', 'stage_one_completed', 'stage_two_completed', 'stage_three_completed',
];

/** Best-effort cleanup only. Browser hints never establish LIVE workflow authority. */
export function clearLegacyWorkflowHints(): void {
  for (const key of legacyKeys) {
    try { localStorage.removeItem(key); }
    catch { /* Restricted storage must not crash the server-authorized workflow view. */ }
  }
}
