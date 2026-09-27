import { randomUUID } from 'node:crypto';

import {
  TaxGuardLiveWorkflowCase,
  TaxGuardWorkflowAuditEvent,
  TaxGuardWorkflowStage
} from './liveWorkflow.types';

import { getFirebaseAdminDb } from '../firebase-admin';

const CASE_COLLECTION = 'taxguard_live_cases';
const AUDIT_COLLECTION = 'taxguard_live_audit';

function nowIso(): string {
  return new Date().toISOString();
}

function caseDocumentId(
  clientId: string,
  taxYear: number
): string {
  return `${clientId}__${taxYear}`;
}

function assertClientId(clientId: string): void {
  if (!clientId || !clientId.trim()) {
    throw new Error(
      'Permanent TaxGuard Client ID is required.'
    );
  }
}

function assertTaxYear(taxYear: number): void {
  if (
    !Number.isInteger(taxYear) ||
    taxYear < 2000 ||
    taxYear > 2200
  ) {
    throw new Error('Invalid tax year.');
  }
}

export class LiveWorkflowRepository {

  static async getCase(
    clientId: string,
    taxYear: number
  ): Promise<TaxGuardLiveWorkflowCase | null> {

    assertClientId(clientId);
    assertTaxYear(taxYear);

    const db = getFirebaseAdminDb();

    const snapshot = await db
      .collection(CASE_COLLECTION)
      .doc(caseDocumentId(clientId, taxYear))
      .get();

    if (!snapshot.exists) {
      return null;
    }

    return snapshot.data() as TaxGuardLiveWorkflowCase;
  }

  static async getOrCreateCase(
    clientId: string,
    taxYear: number,
    actorUserId: string,
    actorRole: string
  ): Promise<TaxGuardLiveWorkflowCase> {

    assertClientId(clientId);
    assertTaxYear(taxYear);

    const db = getFirebaseAdminDb();

    const ref = db
      .collection(CASE_COLLECTION)
      .doc(caseDocumentId(clientId, taxYear));

    const result = await db.runTransaction(
      async transaction => {

        const snapshot = await transaction.get(ref);

        if (snapshot.exists) {
          return snapshot.data() as TaxGuardLiveWorkflowCase;
        }

        const timestamp = nowIso();

        const created: TaxGuardLiveWorkflowCase = {
          clientId,
          taxYear,

          environment: 'live',

          revision: 1,

          activeStage: 1,

          stage1: {
            stage: 1,
            status: 'IN_PROGRESS'
          },

          stage2: {
            stage: 2,
            status: 'LOCKED'
          },

          stage3: {
            stage: 3,
            status: 'LOCKED'
          },

          externalSubmissionEnabled: false,

          createdAt: timestamp,
          updatedAt: timestamp
        };

        transaction.create(ref, created);

        return created;
      }
    );

    await this.appendAudit({
      eventId: randomUUID(),

      clientId,
      taxYear,

      actorUserId,
      actorRole,

      action: 'LIVE_WORKFLOW_CASE_ENSURED',

      result: 'success',

      serverTimestamp: nowIso()
    });

    return result;
  }

  static async completeStage(
    clientId: string,
    taxYear: number,
    stage: TaxGuardWorkflowStage,
    actorUserId: string,
    actorRole: string,
    expectedRevision: number,
    gateEvidence?: Record<string, unknown>
  ): Promise<TaxGuardLiveWorkflowCase> {

    assertClientId(clientId);
    assertTaxYear(taxYear);

    const db = getFirebaseAdminDb();

    const ref = db
      .collection(CASE_COLLECTION)
      .doc(caseDocumentId(clientId, taxYear));

    const updated = await db.runTransaction(
      async transaction => {

        const snapshot = await transaction.get(ref);

        if (!snapshot.exists) {
          throw new Error(
            'LIVE workflow case does not exist.'
          );
        }

        const current =
          snapshot.data() as TaxGuardLiveWorkflowCase;

        if (current.clientId !== clientId) {
          throw new Error('Client identity mismatch.');
        }

        if (current.environment !== 'live') {
          throw new Error('LIVE workflow required.');
        }

        if (current.revision !== expectedRevision) {
          throw new Error(
            'Workflow revision conflict. Refresh and retry.'
          );
        }

        /*
         * Sequential gate enforcement.
         */

        if (stage === 1) {

          if (current.stage1.status === 'COMPLETED') {
            return current;
          }

          current.stage1 = {
            stage: 1,
            status: 'COMPLETED',
            completedAt: nowIso(),
            completedBy: actorUserId
          };

          current.stage2 = {
            stage: 2,
            status: 'IN_PROGRESS'
          };

          current.activeStage = 2;

        } else if (stage === 2) {

          if (current.stage1.status !== 'COMPLETED') {
            throw new Error(
              'Stage 01 must be completed first.'
            );
          }

          if (current.stage2.status === 'COMPLETED') {
            return current;
          }

          current.stage2 = {
            stage: 2,
            status: 'COMPLETED',
            completedAt: nowIso(),
            completedBy: actorUserId
          };

          current.stage3 = {
            stage: 3,
            status: 'IN_PROGRESS'
          };

          current.activeStage = 3;

        } else if (stage === 3) {

          if (
            current.stage1.status !== 'COMPLETED' ||
            current.stage2.status !== 'COMPLETED'
          ) {
            throw new Error(
              'Stages 01 and 02 must be completed first.'
            );
          }

          current.stage3 = {
            stage: 3,
            status: 'COMPLETED',
            completedAt: nowIso(),
            completedBy: actorUserId
          };

          /*
           * M5 intentionally stops here.
           * A later milestone owns Stage 04+.
           */

          current.activeStage = 3;
        }

        current.revision += 1;
        current.updatedAt = nowIso();

        transaction.set(ref, current);

        return current;
      }
    );

    await this.appendAudit({
      eventId: randomUUID(),

      clientId,
      taxYear,

      actorUserId,
      actorRole,

      action: `STAGE_${stage}_SERVER_COMPLETED`,
      stage,

      result: 'success',

      serverTimestamp: nowIso(),

      metadata: {
        revision: updated.revision,
        gateEvidence: gateEvidence || {}
      }
    });

    return updated;
  }

  static async appendAudit(
    event: TaxGuardWorkflowAuditEvent
  ): Promise<void> {

    const db = getFirebaseAdminDb();

    await db
      .collection(AUDIT_COLLECTION)
      .doc(event.eventId)
      .create(event);
  }
}
