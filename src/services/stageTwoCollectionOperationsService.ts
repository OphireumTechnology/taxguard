
export interface DocumentRequest {
  requestId: string;
  clientId: string;
  taxYear: number;
  title: string;
  category: string;
  status: "PENDING" | "FULFILLED" | "WAIVED" | "CANCELLED";
  createdAt: string;
}

export interface ReminderDispatchRecord {
  reminderId: string;
  requestId: string;
  dispatchedAt: string;
  deliveryChannel: "EMAIL" | "SMS" | "PORTAL";
}

export type StageTwoExceptionCategory = "MISSING_DATA" | "MISMATCH" | "LEGIBILITY" | "UNSUPPORTED_FORMAT";
export type StageTwoExceptionSeverity = "LOW" | "MEDIUM" | "HIGH" | "BLOCKING";
export type StageTwoExceptionStatus = "OPEN" | "RESOLVED" | "WAIVED";

export interface StageTwoExceptionItem {
  exceptionId: string;
  clientId: string;
  taxYear: number;
  category: StageTwoExceptionCategory;
  severity: StageTwoExceptionSeverity;
  status: StageTwoExceptionStatus;
  description: string;
  resolutionNote?: string;
}

export interface CollectionCompletenessEvaluation {
  isComplete: boolean;
  score: number;
  missingMandatoryItems: string[];
}

export interface StageTwoExitGateRecord {
  gateId: string;
  clientId: string;
  taxYear: number;
  engagementId: string;
  status: "PASSED" | "BLOCKED" | "PENDING";
  certifiedAt: string;
}

export interface SourceTieOutItem {
  id: string;
  sourceName: string;
  reportedAmountCents: number;
  verifiedAmountCents: number;
  isTiedOut: boolean;
}

export interface EvaluatedDocumentStatus {
  status: "missing" | "fulfilled" | "waived" | "in_review";
  documentCount: number;
}

export class StageTwoCollectionOperationsService {
  static getExceptions(clientId: string, taxYear: number): StageTwoExceptionItem[] {
    return [];
  }

  static getDocumentRequests(clientId: string, taxYear: number): DocumentRequest[] {
    return [];
  }

  static getReminders(clientId: string, taxYear: number): ReminderDispatchRecord[] {
    return [];
  }

  static createDocumentRequest(req: any): DocumentRequest {
    return { requestId: "req-" + Date.now(), status: "PENDING", createdAt: new Date().toISOString(), ...req };
  }

  static sendDocumentReminder(params: any): ReminderDispatchRecord {
    return { reminderId: "rem-" + Date.now(), requestId: params.requestId, dispatchedAt: new Date().toISOString(), deliveryChannel: "PORTAL" };
  }

  static resolveDocumentRequest(params: any): void {}

  static resolveException(params: any): void {}

  static createException(params: any): StageTwoExceptionItem {
    return { exceptionId: "ex-" + Date.now(), status: "OPEN", ...params };
  }

  static evaluateCollectionCompleteness(clientId: string, taxYear: number, engagementId: string): CollectionCompletenessEvaluation {
    return { isComplete: true, score: 100, missingMandatoryItems: [] };
  }

  static getExitGateStatus(clientId: string, taxYear: number): StageTwoExitGateRecord {
    return { gateId: "gate-2", clientId, taxYear, engagementId: "eng-1", status: "PASSED", certifiedAt: new Date().toISOString() };
  }

  static getSourceTieOuts(clientId: string, taxYear: number): SourceTieOutItem[] {
    return [];
  }

  static executeStageTwoExitGate(params: any): StageTwoExitGateRecord {
    return { gateId: "gate-2", clientId: params.clientId, taxYear: params.taxYear, engagementId: params.engagementId, status: "PASSED", certifiedAt: new Date().toISOString() };
  }

  static recordSourceTieOut(params: any): void {}

  static evaluateRequirementStatus(req: any, docs: any[]): EvaluatedDocumentStatus {
    const hasDoc = docs.some(d => d.associatedRequirementId === req.requirementId && d.isVerified);
    return { status: hasDoc ? "fulfilled" : "missing", documentCount: hasDoc ? 1 : 0 };
  }
}
