// Refund records (proposal 20261018010000) on a real PostgreSQL server with independent connections, expressed
// as the implementation-neutral refund contract so the same regressions can be run against the canonical
// Phase 15 contract during reconciliation (see refundContract.ts). Synthetic data only.
import { defineRefundContract, phase14Adapter } from './refundContract';

defineRefundContract(phase14Adapter);
