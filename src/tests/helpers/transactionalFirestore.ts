// Unit-test adapter for transaction behavior. Not a substitute for emulator/rules tests.
export class TransactionalFirestore {
  records = new Map<string, any>();
  failCommit = false;
  private tail = Promise.resolve();
  doc(path: string): any { return { path, get: async () => this.snapshot(this.records.get(path)) }; }
  private snapshot(value: any) { return { exists: value !== undefined, data: () => value === undefined ? undefined : structuredClone(value) }; }
  async runTransaction<T>(callback: (tx: any) => Promise<T>): Promise<T> {
    const previous = this.tail; let release!: () => void;
    this.tail = new Promise<void>(resolve => { release = resolve; });
    await previous;
    const pending = structuredClone(this.records); let wrote = false;
    const tx = {
      get: async (ref: any) => { if (wrote) throw new Error('Read after write'); return this.snapshot(pending.get(ref.path)); },
      create: (ref: any, value: any) => { wrote = true; if (pending.has(ref.path)) throw new Error('Already exists'); pending.set(ref.path, structuredClone(value)); },
      set: (ref: any, value: any, options?: any) => { wrote = true; pending.set(ref.path, options?.merge ? { ...pending.get(ref.path), ...structuredClone(value) } : structuredClone(value)); },
      update: (ref: any, value: any) => { wrote = true; if (!pending.has(ref.path)) throw new Error('Missing document'); pending.set(ref.path, { ...pending.get(ref.path), ...structuredClone(value) }); },
    };
    try {
      const result = await callback(tx);
      if (this.failCommit) throw new Error('Commit unavailable');
      this.records = pending; return structuredClone(result);
    } finally { release(); }
  }
}
