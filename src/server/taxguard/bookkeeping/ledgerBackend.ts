import { BookkeepingEngine } from './bookkeeping.engine';

const defaultEngine = new BookkeepingEngine();

export function selectLedger(_options?: Record<string, any>): any {
  return {
    mode: 'memory',
    engine: defaultEngine,
  };
}
