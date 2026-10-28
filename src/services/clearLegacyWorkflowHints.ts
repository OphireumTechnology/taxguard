export function clearLegacyWorkflowHints(): void {
  if (typeof window === 'undefined') return;
  const legacyKeys = [
    'stage1_complete',
    'stage2_complete',
    'stage3_complete',
    'stage4_complete',
    'stage5_complete',
    'stage6_complete',
    'stage7_complete',
    'stage8_complete',
  ];
  try {
    for (const key of legacyKeys) {
      localStorage.removeItem(key);
      sessionStorage.removeItem(key);
    }
  } catch {
    // Silent catch
  }
}
