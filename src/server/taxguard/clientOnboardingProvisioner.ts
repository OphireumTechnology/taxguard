import { randomBytes } from 'node:crypto';
import { db } from '../db';
import { OnboardingState, User } from '../../types';
import { SupabaseDurableSessions } from '../supabase-db';
import {
  LiveWorkflowRepository,
  clearInMemoryWorkflowCase
} from './liveWorkflow.repository';
import { TaxGuardLiveWorkflowCase } from './liveWorkflow.types';

export function evaluateLiveWorkflowEligibility(workflow: TaxGuardLiveWorkflowCase) {
  const stage1Complete = workflow.stage1.status === 'COMPLETED';
  const stage2Complete = workflow.stage2.status === 'COMPLETED';
  return {
    stage1Eligible: true,
    stage2Eligible: stage1Complete,
    stage3Eligible: stage1Complete && stage2Complete,
  };
}

export interface CanonicalOnboardingStageStates {
  STAGE_01_IDENTITY: 'IN_PROGRESS' | 'READY_FOR_REVIEW' | 'COMPLETED';
  STAGE_02_DOCUMENTS: 'LOCKED' | 'IN_PROGRESS' | 'READY_FOR_REVIEW' | 'COMPLETED';
  STAGE_03_EXTRACTION: 'LOCKED' | 'IN_PROGRESS' | 'READY_FOR_REVIEW' | 'COMPLETED';
  STAGE_04_PREPARATION: 'LOCKED' | 'IN_PROGRESS' | 'READY_FOR_REVIEW' | 'COMPLETED';
  STAGE_05_REVIEW: 'LOCKED' | 'IN_PROGRESS' | 'READY_FOR_REVIEW' | 'COMPLETED';
  STAGE_06_APPROVAL: 'LOCKED' | 'IN_PROGRESS' | 'READY_FOR_REVIEW' | 'COMPLETED';
  STAGE_07_FILING: 'LOCKED' | 'IN_PROGRESS' | 'READY_FOR_REVIEW' | 'COMPLETED';
}

export interface CanonicalTenantRecord {
  tenantId: string;
  name: string;
  status: 'active';
  createdAt: string;
}

export interface CanonicalClientProfileRecord {
  tenantId: string;
  clientId: string;
  ownerUid: string;
  email: string;
  fullName: string;
  phone: string;
  companyName: string;
  clientType: 'individual' | 'business';
  status: 'active';
  createdAt: string;
  updatedAt: string;
}

export interface CanonicalEngagementRecord {
  tenantId: string;
  clientId: string;
  engagementId: string;
  status: 'ACTIVE';
  taxYears: number[];
  createdAt: string;
  updatedAt: string;
}

export interface CanonicalTaxYearRecord {
  tenantId: string;
  clientId: string;
  engagementId: string;
  taxYearId: string;
  taxYear: number;
  status: 'OPEN';
  createdAt: string;
}

export interface CanonicalTaxCaseRecord {
  tenantId: string;
  clientId: string;
  engagementId: string;
  taxYear: number;
  caseId: string;
  clientUid: string;
  status: 'ONBOARDING_IN_PROGRESS' | 'ACTIVE';
  activeStage: 1 | 2 | 3;
  revision: number;
  stageStates: CanonicalOnboardingStageStates;
  externalSubmissionEnabled: false;
  createdAt: string;
  updatedAt: string;
}

export interface ProvisionedClientOnboardingBundle {
  resumed: boolean;
  tenant: CanonicalTenantRecord;
  client: CanonicalClientProfileRecord;
  engagement: CanonicalEngagementRecord;
  taxYearRecord: CanonicalTaxYearRecord;
  taxCase: CanonicalTaxCaseRecord;
  stageStates: CanonicalOnboardingStageStates;
  workflow: TaxGuardLiveWorkflowCase;
  eligibility: {
    clientId: string;
    taxYear: number;
    revision: number;
    activeStage: 1 | 2 | 3;
    eligibility: {
      stage1: boolean;
      stage2: boolean;
      stage3: boolean;
    };
    status: {
      stage1: string;
      stage2: string;
      stage3: string;
    };
    externalSubmissionEnabled: false;
  };
}

const tenantsStore = new Map<string, CanonicalTenantRecord>();
const clientsStore = new Map<string, CanonicalClientProfileRecord>();
const engagementsStore = new Map<string, CanonicalEngagementRecord>();
const taxYearsStore = new Map<string, CanonicalTaxYearRecord>();
const taxCasesStore = new Map<string, CanonicalTaxCaseRecord>();
const provisioningLocks = new Map<string, Promise<void>>();

async function withProvisioningLock<T>(key: string, fn: () => Promise<T>): Promise<T> {
  const prev = provisioningLocks.get(key) || Promise.resolve();
  let release: () => void = () => {};
  const gate = new Promise<void>(resolve => {
    release = resolve;
  });
  const tail = prev.catch(() => {}).then(() => gate);
  provisioningLocks.set(key, tail);

  await prev.catch(() => {});

  try {
    return await fn();
  } finally {
    release();
    if (provisioningLocks.get(key) === tail) {
      provisioningLocks.delete(key);
    }
  }
}

export function deriveCanonicalStageStates(
  workflow: TaxGuardLiveWorkflowCase
): CanonicalOnboardingStageStates {
  return {
    STAGE_01_IDENTITY: workflow.stage1.status === 'LOCKED' ? 'IN_PROGRESS' : workflow.stage1.status,
    STAGE_02_DOCUMENTS: workflow.stage2.status,
    STAGE_03_EXTRACTION: workflow.stage3.status,
    STAGE_04_PREPARATION: 'LOCKED',
    STAGE_05_REVIEW: 'LOCKED',
    STAGE_06_APPROVAL: 'LOCKED',
    STAGE_07_FILING: 'LOCKED',
  };
}

/**
 * Idempotently provisions or resolves the canonical client onboarding hierarchy:
 * Tenant -> Client -> Engagement -> Tax Year -> Tax Case -> Stage States
 */
export async function provisionOrResolveClientOnboarding(params: {
  tenantId: string;
  user: User;
  taxYear?: number;
}): Promise<ProvisionedClientOnboardingBundle> {
  const tenantId = (params.tenantId || process.env.TAXGUARD_TENANT_ID || 'tenantA').trim();
  const user = params.user;
  const clientId = (user.clientId || '').trim();

  if (!user.id || !clientId) {
    throw new Error('CLIENT_INITIALIZATION_FAILED: Authenticated user and permanent clientId are required.');
  }

  const taxYear =
    params.taxYear && Number.isInteger(params.taxYear) && params.taxYear >= 2000 && params.taxYear <= 2200
      ? params.taxYear
      : 2025;

  const lockKey = `${tenantId}:${clientId}:${taxYear}`;

  return withProvisioningLock(lockKey, async () => {
    const now = new Date().toISOString();

    // Sync server in-memory user & onboarding draft state for legacy client routes
    db.users.set(user.id, user);
    if (!db.onboardingStates.has(user.id)) {
      const onboardingState: OnboardingState = {
        id: `onb_${randomBytes(12).toString('hex')}`,
        userId: user.id,
        createdAt: now,
        updatedAt: now,
        step: 1,
        percentComplete: 5,
        entityType: user.clientType === 'business' ? 'business' : 'individual',
        contactInfo: {
          fullName: user.name || user.email,
          email: user.email,
          phone: user.phone || '',
          address: '',
          city: '',
          state: '',
          zipCode: '',
        },
        selectedServices: [],
        intakeAnswers: {},
        uploadedDocuments: [],
        paymentMethodAuthorized: false,
        engagementAgreementSigned: false,
        privacyDisclaimerAccepted: false,
        accountingSoftwareConnected: false,
        consultationBooked: false,
        status: 'draft',
        missingRequirements: [
          'Complete identity verification',
          'Complete onboarding information',
        ],
      };
      db.onboardingStates.set(user.id, onboardingState);
    }

    // 1. Resolve or create Tenant
    let tenant = tenantsStore.get(tenantId);
    if (!tenant) {
      tenant = {
        tenantId,
        name: 'A/R Tax Services — TaxGuard Primary Tenant',
        status: 'active',
        createdAt: now,
      };
      tenantsStore.set(tenantId, tenant);
    }

    // 2. Resolve or create Client Profile
    const clientKey = `${tenantId}:${clientId}`;
    let client = clientsStore.get(clientKey);
    const ownerChangedInTest = Boolean(client && client.ownerUid !== user.id);
    if (!client || ownerChangedInTest) {
      if (ownerChangedInTest) {
        clearInMemoryWorkflowCase(clientId, taxYear);
      }
      client = {
        tenantId,
        clientId,
        ownerUid: user.id,
        email: user.email.toLowerCase(),
        fullName: user.name || user.email,
        phone: user.phone || '',
        companyName: user.companyName || user.company || '',
        clientType: user.clientType === 'business' ? 'business' : 'individual',
        status: 'active',
        createdAt: user.createdAt || now,
        updatedAt: now,
      };
      clientsStore.set(clientKey, client);
    }

    // 3. Resolve or create Engagement
    const engagementId = `eng_${taxYear}_${clientId}`;
    const engagementKey = `${tenantId}:${user.id}:${clientId}:${engagementId}`;
    let engagement = engagementsStore.get(engagementKey);
    if (!engagement) {
      engagement = {
        tenantId,
        clientId,
        engagementId,
        status: 'ACTIVE',
        taxYears: [taxYear],
        createdAt: now,
        updatedAt: now,
      };
      engagementsStore.set(engagementKey, engagement);
    } else if (!engagement.taxYears.includes(taxYear)) {
      engagement = {
        ...engagement,
        taxYears: [...engagement.taxYears, taxYear],
        updatedAt: now,
      };
      engagementsStore.set(engagementKey, engagement);
    }

    // 4. Resolve or create Tax Year
    const taxYearId = `ty_${taxYear}_${clientId}`;
    const taxYearKey = `${tenantId}:${user.id}:${clientId}:${engagementId}:${taxYear}`;
    let taxYearRecord = taxYearsStore.get(taxYearKey);
    if (!taxYearRecord) {
      taxYearRecord = {
        tenantId,
        clientId,
        engagementId,
        taxYearId,
        taxYear,
        status: 'OPEN',
        createdAt: now,
      };
      taxYearsStore.set(taxYearKey, taxYearRecord);
    }

    // 5. Resolve or create authoritative Live Workflow Case & Stage States
    const existingWorkflow = await LiveWorkflowRepository.getCase(clientId, taxYear);
    const workflow =
      existingWorkflow ||
      (await LiveWorkflowRepository.getOrCreateCase(
        clientId,
        taxYear,
        user.id,
        user.role || 'client'
      ));

    const caseId = `case_${taxYear}_${clientId}`;
    const caseKey = `${tenantId}:${user.id}:${clientId}:${engagementId}:${taxYear}`;
    const existingTaxCase = taxCasesStore.get(caseKey);
    const resumed = Boolean(existingTaxCase || existingWorkflow);

    // Harmonize onboarding completion across user record and workflow
    const userIsCompleted =
      (user.onboardingStatus || '').toUpperCase() === 'COMPLETED' ||
      (user.onboardingStatus || '').toUpperCase() === 'APPROVED' ||
      (user.onboardingStatus || '').toUpperCase() === 'SUBMITTED' ||
      Boolean(user.onboardingCompletedAt) ||
      Boolean(existingTaxCase && (existingTaxCase.activeStage >= 2 || existingTaxCase.stageStates?.STAGE_01_IDENTITY === 'COMPLETED')) ||
      Boolean(existingWorkflow && (existingWorkflow.activeStage >= 2 || existingWorkflow.stage1?.status === 'COMPLETED'));

    if (userIsCompleted && workflow.stage1.status !== 'COMPLETED') {
      workflow.stage1 = {
        stage: 1,
        status: 'COMPLETED',
        completedAt: user.onboardingCompletedAt || workflow.stage1?.completedAt || now,
        completedBy: user.id
      };
      if (workflow.activeStage < 2) {
        workflow.activeStage = 2;
        workflow.stage2 = {
          stage: 2,
          status: 'IN_PROGRESS'
        };
      }
      workflow.updatedAt = now;
    }

    if (workflow.stage1.status === 'COMPLETED' || workflow.activeStage >= 2 || userIsCompleted) {
      user.onboardingStatus = 'COMPLETED';
      user.onboardingCompletedAt = user.onboardingCompletedAt || workflow.stage1.completedAt || now;
      db.users.set(user.id, user);
      new SupabaseDurableSessions(undefined, tenantId).updateUser(user.id, {
        onboardingStatus: 'COMPLETED',
        onboardingCompletedAt: user.onboardingCompletedAt
      }).catch(() => {});
    }

    const stageStates = deriveCanonicalStageStates(workflow);

    const activeStage = (
      workflow.activeStage === 1 || workflow.activeStage === 2 || workflow.activeStage === 3
        ? workflow.activeStage
        : 1
    ) as 1 | 2 | 3;

    const taxCase: CanonicalTaxCaseRecord = {
      tenantId,
      clientId,
      engagementId,
      taxYear,
      caseId,
      clientUid: user.id,
      status: workflow.stage1.status === 'COMPLETED' ? 'ACTIVE' : 'ONBOARDING_IN_PROGRESS',
      activeStage,
      revision: workflow.revision,
      stageStates,
      externalSubmissionEnabled: false,
      createdAt: existingTaxCase?.createdAt || workflow.createdAt || now,
      updatedAt: workflow.updatedAt || now,
    };
    taxCasesStore.set(caseKey, taxCase);

    const eligibilityCheck = evaluateLiveWorkflowEligibility(workflow);

    return {
      resumed,
      tenant,
      client,
      engagement,
      taxYearRecord,
      taxCase,
      stageStates,
      workflow,
      eligibility: {
        clientId,
        taxYear,
        revision: workflow.revision,
        activeStage,
        eligibility: {
          stage1: eligibilityCheck.stage1Eligible,
          stage2: eligibilityCheck.stage2Eligible,
          stage3: eligibilityCheck.stage3Eligible,
        },
        status: {
          stage1: workflow.stage1.status,
          stage2: workflow.stage2.status,
          stage3: workflow.stage3.status,
        },
        externalSubmissionEnabled: false,
      },
    };
  });
}

export function updateProvisionedCaseStage(
  _tenantId: string,
  clientId: string,
  taxYear: number,
  stage: 1 | 2 | 3,
  _status: string
) {
  for (const [key, taxCase] of taxCasesStore.entries()) {
    if (taxCase.clientId === clientId && taxCase.taxYear === taxYear) {
      taxCase.activeStage = stage;
      taxCase.status = 'ACTIVE';
      taxCase.updatedAt = new Date().toISOString();
      if (stage >= 2) {
        taxCase.stageStates.STAGE_01_IDENTITY = 'COMPLETED';
        taxCase.stageStates.STAGE_02_DOCUMENTS = 'IN_PROGRESS';
      }
      taxCasesStore.set(key, taxCase);
    }
  }
}
