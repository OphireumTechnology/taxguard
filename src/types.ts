/**
 * `../types` resolves to this file before `./types/index.ts`, so any separate definitions here shadow the
 * shared contracts every module relies on (the cause of Recovery Repair 1). The shared types live in
 * `src/types/index.ts`; this file only re-exports them. The previous AI Studio definitions are preserved in
 * Git history (commit c5bc3e4); their only definition not present in `src/types/` (ExtractedDataField) had no users.
 */
export * from './types/index';
