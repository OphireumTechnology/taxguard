import type { Router } from 'express';

export function registerLedgerDispatch(_router: Router): void {
  // No-op when durable ledger dispatch backend is not commissioned.
}
