/**
 * A/R Tax Services, LLC - Dual Onboarding System Types
 * Strict separation between Client Onboarding and Staff (Accountant/Consultant) Onboarding.
 */

import { UserRole } from './index';

// -------------------------------------------------------------
// CLIENT ONBOARDING DEFINITIONS
// -------------------------------------------------------------

export type ClientCategory =
  | 'individual_taxpayer'
  | 'married_household'
  | 'sole_proprietor'
  | 'independent_contractor'
  | 'partnership'
  | 'corporation'
  | 'scorporation'
  | 'llc'
  | 'nonprofit'
  | 'estate_trust'
  | 'prospective_client';

export type ClientOnboardingStatus =
  | 'account_created'
  | 'email_verification_pending'
  | 'onboarding_not_started'
  | 'onboarding_in_progress'
  | 'onboarding_submitted'
  | 'staff_review'
  | 'correction_requested'
  | 'client_resubmitted'
  | 'approved'
  | 'engagement_pending'
  | 'active_client'
  | 'declined'
  | 'archived';

export interface ClientRegistrationData {
  firstName: string;
  middleName?: string;
  lastName: string;
  email: string;
  phone: string;
  password?: string;
  preferredLanguage: string;
  preferredContactMethod: 'email' | 'phone' | 'sms' | 'portal';
  timeZone: string;
  clientCategory: ClientCategory;
  referralSource: string;
  privacyPolicyAccepted: boolean;
  termsAccepted: boolean;
  electronicConsentAccepted: boolean;
  policyVersion: string;
  recaptchaVerified?: boolean;
}

export interface ClientOnboardingDossier {
  id: string;
  clientId: string;
  status: ClientOnboardingStatus;
  currentSection: 'A' | 'B' | 'C' | 'D' | 'E' | 'F' | 'G' | 'H' | 'I';
  percentComplete: number;

  // Section A: Identity and Contact Information
  identityContact: {
    legalFirstName: string;
    legalMiddleName?: string;
    legalLastName: string;
    preferredName?: string;
    dob?: string;
    email: string;
    mobilePhone: string;
    alternatePhone?: string;
    residentialAddress: {
      street: string;
      unit?: string;
      city: string;
      state: string;
      zip: string;
      country: string;
    };
    mailingAddressSameAsResidential: boolean;
    mailingAddress?: {
      street: string;
      unit?: string;
      city: string;
      state: string;
      zip: string;
      country: string;
    };
    preferredLanguage: string;
    preferredChannel: 'email' | 'phone' | 'sms' | 'portal';
    timeZone: string;
    accessibilityRequirements?: string;
    authorizedContact?: {
      name: string;
      relationship: string;
      phone: string;
      email: string;
    };
  };

  // Section B: Client and Entity Classification
  entityClassification: {
    isBusiness: boolean;
    legalEntityName?: string;
    dbaName?: string;
    entityType: 'individual' | 'sole_proprietorship' | 'partnership' | 'llc' | 'scorp' | 'ccorp' | 'nonprofit' | 'trust_estate';
    dateEstablished?: string;
    formationState?: string;
    businessAddress?: {
      street: string;
      city: string;
      state: string;
      zip: string;
    };
    industry?: string;
    accountingYearEnd?: string;
    ownershipDetails?: string;
    relatedEntities?: string;
    hasExistingAccountant: boolean;
    existingAccountantName?: string;
    numberOfEmployees?: number;
    statesOfOperation: string[];
  };

  // Section C: Tax Profile
  taxProfile: {
    requestedTaxYear: number;
    filingStatus: 'single' | 'married_filing_jointly' | 'married_filing_separately' | 'head_of_household' | 'qualifying_surviving_spouse';
    priorYearFilingStatus?: string;
    dependentsCount: number;
    dependentsDetails?: Array<{ name: string; relation: string; dob: string }>;
    incomeCategories: string[]; // e.g. ['w2', '1099_misc', '1099_nec', 'k1', 'dividends', 'capital_gains']
    selfEmploymentActivity: boolean;
    rentalPropertiesCount: number;
    investmentActivity: boolean;
    foreignIncomeOrAccounts: boolean;
    digitalAssetActivity: boolean;
    madeEstimatedTaxPayments: boolean;
    estimatedPaymentsAmount?: number;
    priorYearReturnAvailable: boolean;
    hasIrsOrStateNotices: boolean;
    outstandingTaxBalances: boolean;
    extensionOrAmendedRequired: boolean;
    multiStateFilingRequired: boolean;
    multiStatesList: string[];
  };

  // Section D: Accounting Requirements
  accountingRequirements: {
    bookkeepingRequired: boolean;
    frequency?: 'monthly' | 'quarterly' | 'annual';
    accountingSoftware: 'quickbooks_online' | 'xero' | 'freshbooks' | 'wave' | 'other' | 'none';
    otherSoftwareName?: string;
    payrollSupportRequired: boolean;
    salesTaxFilingRequired: boolean;
    accountsPayableRequired: boolean;
    accountsReceivableRequired: boolean;
    financialReportingRequired: boolean;
    bankReconciliationRequired: boolean;
    cleanupOrCatchupNeeded: boolean;
    historicalPeriodsNeedingReconciliation?: string;
    businessAdvisoryRequired: boolean;
  };

  // Section E: Service Selection
  serviceSelection: {
    selectedServices: string[];
    customServiceNotes?: string;
  };

  // Section F: Document Checklist
  documentChecklist: Array<{
    id: string;
    category: string;
    name: string;
    description: string;
    required: boolean;
    uploadedDocumentId?: string;
    status: 'pending' | 'uploaded' | 'verified' | 'rejected';
  }>;

  // Section G: Consultation Preferences
  consultationPreferences: {
    serviceRequired: string;
    preferredProfessional: 'founder' | 'preferred_accountant' | 'preferred_consultant' | 'next_available';
    specificStaffId?: string;
    meetingType: 'virtual' | 'telephone' | 'in_office';
    preferredTimeZone: string;
    notes?: string;
    accessibilityNeeds?: string;
    selectedDate?: string;
    selectedSlot?: string;
    appointmentId?: string;
  };

  // Section H: Engagement and Consent
  engagementConsent: {
    engagementLetterAcknowledged: boolean;
    scopeAcknowledged: boolean;
    pricingAcknowledged: boolean;
    privacyNoticeAcknowledged: boolean;
    electronicConsentAcknowledged: boolean;
    retentionPolicyAcknowledged: boolean;
    electronicSignatureName: string;
    signatureTimestamp: string;
    policyVersion: string;
    ipAddress?: string;
    userAgent?: string;
  };

  // Section I: Final Review & Staff Governance
  reviewSubmission: {
    submittedAt?: string;
    reviewedByStaffId?: string;
    reviewedAt?: string;
    staffDecision?: 'approved' | 'correction_requested' | 'declined';
    staffNotes?: string;
    correctionInstructions?: string;
    lockedForClient: boolean;
  };

  createdAt: string;
  updatedAt: string;
}

// -------------------------------------------------------------
// STAFF (ACCOUNTANT & CONSULTANT) ONBOARDING DEFINITIONS
// -------------------------------------------------------------

export type StaffRole =
  | 'consultant'
  | 'accountant'
  | 'reviewer'
  | 'managing_consultant'
  | 'founder'
  | 'administrator'
  | 'super_administrator';

export type StaffOnboardingStatus =
  | 'invited'
  | 'invitation_opened'
  | 'identity_pending'
  | 'profile_in_progress'
  | 'documents_pending'
  | 'qualifications_pending'
  | 'security_setup_pending'
  | 'calendar_setup_pending'
  | 'submitted'
  | 'administrator_review'
  | 'correction_requested'
  | 'approved'
  | 'active'
  | 'suspended'
  | 'invitation_expired'
  | 'rejected'
  | 'offboarded';

export interface StaffInvitation {
  id: string;
  email: string;
  legalFirstName: string;
  legalLastName: string;
  proposedRole: StaffRole;
  tokenHash: string; // Stored securely hashed
  expiresAt: string;
  status: 'pending' | 'opened' | 'completed' | 'expired' | 'revoked';
  invitedByUserId: string;
  invitedByUserName: string;
  createdAt: string;
  openedAt?: string;
  completedAt?: string;
}

export interface StaffOnboardingDossier {
  id: string;
  invitationId: string;
  userId?: string;
  status: StaffOnboardingStatus;
  currentSection: 'A' | 'B' | 'C' | 'D' | 'E' | 'F' | 'G' | 'H';

  // Section A: Personal and Contact Details
  personalContact: {
    legalFirstName: string;
    legalLastName: string;
    professionalDisplayName: string;
    workEmail: string;
    mobileNumber: string;
    residentialAddress: string;
    emergencyContact: {
      name: string;
      relation: string;
      phone: string;
    };
    preferredLanguage: string;
    timeZone: string;
    profilePhotoUrl?: string;
    professionalBio: string;
  };

  // Section B: Employment Information
  employmentInfo: {
    employmentType: 'employee' | 'independent_contractor';
    jobTitle: string;
    department: 'Tax' | 'Accounting' | 'Advisory' | 'Review' | 'Executive';
    startDate: string;
    supervisorName: string;
    officeLocation: 'Columbia HQ' | 'Remote' | 'Hybrid';
    weeklyWorkingHours: number;
    signedAgreements: {
      employmentAgreement: boolean;
      confidentialityAgreement: boolean;
      acceptableUsePolicy: boolean;
      securityAgreement: boolean;
      signedAt?: string;
    };
  };

  // Section C: Professional Qualifications
  qualifications: {
    degrees: Array<{ institution: string; degree: string; yearGraduated: number }>;
    licenses: Array<{
      type: 'CPA' | 'EA' | 'JD' | 'QuickBooks ProAdvisor' | 'Xero Advisor' | 'Other';
      licenseNumber: string;
      issuingAuthority: string;
      jurisdiction: string;
      issueDate: string;
      expirationDate: string;
      verifiedByAdmin: boolean;
    }>;
    ptinStatus?: string;
    efinAssociation?: string;
    yearsOfExperience: number;
    references: Array<{ name: string; title: string; company: string; contact: string }>;
  };

  // Section D: Services and Specializations
  servicesSpecializations: {
    qualifiedServices: string[];
    canActAsReviewer: boolean;
  };

  // Section E: Jurisdictions and Client Eligibility
  jurisdictionsEligibility: {
    statesAuthorized: string[];
    federalWorkAuthorization: boolean;
    entityExperience: string[];
    clientTypesAccepted: string[];
    languagesSpoken: string[];
    maxActiveClientCapacity: number;
    maxDailyAppointments: number;
    founderOnlyServicesApproved: boolean;
    conflictDisclosures?: string;
  };

  // Section F: Security Setup
  securitySetup: {
    emailVerified: boolean;
    mfaEnrolled: boolean;
    sessionTimeoutAcknowledged: boolean;
    completedTrainings: {
      confidentialityTraining: boolean;
      phishingTraining: boolean;
      dataProtectionTraining: boolean;
      documentHandlingTraining: boolean;
      incidentReportingAcknowledged: boolean;
    };
  };

  // Section G: Calendar Setup
  calendarSetup: {
    timeZone: string;
    workingDays: string[];
    workingHours: { start: string; end: string };
    appointmentDurations: number[]; // e.g. [30, 45, 60]
    bufferMinutesBefore: number;
    bufferMinutesAfter: number;
    lunchBreak: { start: string; end: string };
    minimumBookingNoticeHours: number;
    maximumBookingWindowDays: number;
    maxDailyMeetings: number;
    meetingLocations: Array<'virtual' | 'telephone' | 'in_office'>;
    videoProvider: 'google_meet' | 'teams' | 'zoom';
    connectedGoogleCalendar: boolean;
    connectedOutlookCalendar: boolean;
    personalCalendarPrivacy: 'busy_only' | 'hide_details';
  };

  // Section H: Administrative Review
  adminReview: {
    verifiedIdentity: boolean;
    verifiedEmail: boolean;
    verifiedAgreements: boolean;
    verifiedQualifications: boolean;
    verifiedLicenses: boolean;
    assignedRole: StaffRole;
    assignedPermissions: string[];
    activatedAt?: string;
    activatedByAdminId?: string;
    adminNotes?: string;
  };

  createdAt: string;
  updatedAt: string;
}
