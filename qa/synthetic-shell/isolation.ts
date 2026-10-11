/** Synthetic fixture must never bundle live sessions, application API clients or provider/server code. */
export function assertSyntheticModuleIsolation(moduleIds: string[]) {
  for (const raw of moduleIds) {
    const id = raw.replaceAll('\\', '/');
    if (/\/src\/(?:server\/|supabase\/|services\/api\.|context\/AppContext\.)/.test(id)) {
      throw new Error('SYNTHETIC_FIXTURE_LIVE_DEPENDENCY_DENIED');
    }
  }
}
