type AssignmentStatusAndDates = {
  status?: unknown;
  effective_from?: unknown;
  effective_to?: unknown;
  effectiveDate?: unknown;
  expirationDate?: unknown;
  effectiveFrom?: unknown;
  effectiveTo?: unknown;
  user_id?: unknown;
  accountantId?: unknown;
  client_id?: unknown;
  clientId?: unknown;
  tenant_id?: unknown;
  tenantId?: unknown;
  engagement_id?: unknown;
  engagementId?: unknown;
  tax_year?: unknown;
  taxYear?: unknown;
  case_id?: unknown;
  caseId?: unknown;
};

export function isAssignmentCurrentlyEffective(
  assignment: AssignmentStatusAndDates,
  now = Date.now()
): boolean {
  if (typeof assignment.status !== 'string' || assignment.status.toLowerCase() !== 'active') {
    return false;
  }

  const effectiveFromValue = assignment.effective_from ?? assignment.effectiveDate ?? assignment.effectiveFrom;
  if (typeof effectiveFromValue !== 'string' || !effectiveFromValue) return false;
  const effectiveFrom = Date.parse(effectiveFromValue);
  if (!Number.isFinite(effectiveFrom) || effectiveFrom > now) return false;

  const effectiveToValue = assignment.effective_to ?? assignment.expirationDate ?? assignment.effectiveTo;
  if (effectiveToValue == null) return true;
  if (typeof effectiveToValue !== 'string' || !effectiveToValue) return false;
  const effectiveTo = Date.parse(effectiveToValue);
  return Number.isFinite(effectiveTo) && effectiveTo > now;
}

export function isStaffCurrentlyAssignedToClient(params: {
  userId: string;
  tenantId: string;
  clientId: string;
  clientTenantId: string | undefined;
  assignments: readonly AssignmentStatusAndDates[];
  authorizedClientIds?: readonly string[];
  production?: boolean;
  engagementId?: string;
  taxYear?: number;
  caseId?: string;
  now?: number;
}): boolean {
  const {
    userId,
    tenantId,
    clientId,
    clientTenantId,
    assignments,
    authorizedClientIds,
    production = false,
    engagementId,
    taxYear,
    caseId,
    now = Date.now()
  } = params;

  if (!tenantId || !clientTenantId || clientTenantId !== tenantId) return false;
  if (production) return authorizedClientIds?.includes(clientId) === true;

  return assignments.some(assignment => {
    const assignmentUserId = assignment.user_id ?? assignment.accountantId;
    const assignmentClientId = assignment.client_id ?? assignment.clientId;
    const assignmentTenantId = assignment.tenant_id ?? assignment.tenantId;
    const assignmentEngagementId = assignment.engagement_id ?? assignment.engagementId;
    const assignmentTaxYear = assignment.tax_year ?? assignment.taxYear;
    const assignmentCaseId = assignment.case_id ?? assignment.caseId;

    return assignmentUserId === userId &&
      assignmentClientId === clientId &&
      (assignmentTenantId == null || assignmentTenantId === tenantId) &&
      isAssignmentCurrentlyEffective(assignment, now) &&
      (assignmentEngagementId == null || assignmentEngagementId === engagementId) &&
      (assignmentTaxYear == null || Number(assignmentTaxYear) === taxYear) &&
      (assignmentCaseId == null || assignmentCaseId === caseId);
  });
}
