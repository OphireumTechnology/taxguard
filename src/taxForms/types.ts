
export const READINESS_LADDER = ["CATALOGED", "MAPPED", "CALCULATED", "E-FILE_READY"] as const;
export const BLOCKED_LABEL = "BLOCKED";

export type ReadinessLevel = typeof READINESS_LADDER[number] | typeof BLOCKED_LABEL;
export type Applicability = "INDIVIDUAL" | "CORPORATE" | "PARTNERSHIP" | "FIDUCIARY" | "ALL";
export type CapabilityKey = "CALCULATION" | "E_FILE" | "PRINT" | "IMPORT";
export type LibraryGroupId = "federal-core" | "federal-schedules" | "state-local" | "specialty";
export type StateJurisdiction = string;
export type StateTaxCategoryId = string;
