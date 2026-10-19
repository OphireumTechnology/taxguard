# Unreachable frontend code inventory (read-only, 2026-10-20)

**Nothing was deleted.** The repository's own rule (`phase10-reviews.md`) retires unreachable components only after
the owner's deletion decision. This is the evidence for that decision.

## Method

- **Roots:** the import graph was built from every runtime and tooling root: `src/main.tsx` (browser), `server.ts`
  (server) and every `scripts/**/*.ts|mjs`.
- **Imports followed:** static `import` / `export … from` and dynamic `import()`.
- **Exclusions:** tests are excluded from both roots and results. A module that only a test imports is listed:
  it is tested, but no product path reaches it.
- **Alias check:** the `@/` alias is configured, but no source file imports through it, so the relative graph is
  complete.
- **Not shipped:** Vite bundles only what the entry imports, so unreachable modules are not shipped to browsers. The
  cost is maintenance, type-checking time and misleading "reachable consumer" claims, as below.

## Counts

| Directory | Files | Unreachable |
|---|---|---|
| `src/components` | 208 | 75 |
| `src/services` | 41 | 6 |
| `src/taxguard` | 107 | 96 |
| `src/demo` | 93 | 93 |
| `src/ai` | 5 | 1 |
| `src/config` | 6 | 2 |
| `src/supabase` | 6 | 1 |
| `src/public-v2`, `src/hooks`, `src/context`, `src/utils`, `src/data`, `src/taxForms` | 46 | 0 |

## Findings that change recorded decisions

1. **`/api/documents` (in-memory) no longer has a reachable consumer.** `phase10-reviews.md` retains it for
   "reachable consumers (portal `DocumentsView` download, `ProductionDocumentService`)". All of them are
   unreachable: `DocumentsView`, `MyDocumentsClientVault`, `services/production/*` and `supabase/storage.ts`. The
   live portal uses the durable vault (`AuthenticatedClientDashboard`, which says so in a comment). `/api/documents`
   can therefore be retired together with those modules once the owner approves their deletion.
2. **`src/demo` is entirely unreachable (93 files).** It is demonstration content, outside every product path.
3. **`src/taxguard` is almost entirely unreachable (96 of 107).** It holds an earlier application shell
   (`TaxGuardApp.tsx` and its views and components). Only 11 modules are still used by the server or scripts.
4. **Portal stage views 09–18 (`src/components/portal/views/stages/*`) are unreachable.** No product path imports
   them. The server enforces that Stage 09 onwards stays blocked; that does not depend on these files.

## Recommendation (owner decision)

Approve deleting the unreachable modules in reviewed batches: `src/demo`, then `src/taxguard` (minus the 11 used),
then the portal and services leftovers. Retire `/api/documents`, `/api/calendar` and `/api/intake` with their only
consumers. Each batch is a separate commit, with the full suites and a re-run of this inventory showing no newly
unreachable live module.

## Appendix: unreachable modules

```
src/components/calendar/LiveCalendarModule.tsx
src/components/collection/AccountingDocumentIntakeAgentView.tsx
src/components/collection/NotApplicableModal.tsx
src/components/collection/StageTwoCollectionReportView.tsx
src/components/collection/StageTwoCollectionWorkspace.tsx
src/components/collection/StageTwoDocumentRequestsView.tsx
src/components/collection/StageTwoExceptionsView.tsx
src/components/collection/StageTwoExitGateView.tsx
src/components/collection/StageTwoMissingDocumentsView.tsx
src/components/collection/StageTwoVaultView.tsx
src/components/common/RoleSwitcherBanner.tsx
src/components/consultation/PreCallWaitingRoom.tsx
src/components/consultation/VirtualConsultationRoom.tsx
src/components/consultation/WatermarkedDocumentReviewer.tsx
src/components/portal/ClientOnboardingWizard.tsx
src/components/portal/ComprehensiveTaxQuestionnaire.tsx
src/components/portal/dashboard/ActionCenter.tsx
src/components/portal/dashboard/AdvisorMessageCard.tsx
src/components/portal/dashboard/ClientCurrentStatusCard.tsx
src/components/portal/dashboard/ClientWelcomePanel.tsx
src/components/portal/dashboard/CompleteClientJourney.tsx
src/components/portal/dashboard/DashboardMetrics.tsx
src/components/portal/dashboard/DocumentChecklistSection.tsx
src/components/portal/dashboard/MessagesPreviewCard.tsx
src/components/portal/dashboard/PriorYearContinuityCard.tsx
src/components/portal/dashboard/QuickActionsToolbar.tsx
src/components/portal/dashboard/QuickStats.tsx
src/components/portal/dashboard/RecentActivity.tsx
src/components/portal/dashboard/RecentDocuments.tsx
src/components/portal/dashboard/ReturnOverviewCard.tsx
src/components/portal/dashboard/RightContextRail.tsx
src/components/portal/dashboard/SecurityReliabilityPanel.tsx
src/components/portal/dashboard/SetupComplianceCard.tsx
src/components/portal/dashboard/StateJurisdictionRequirementsPanel.tsx
src/components/portal/dashboard/TaxReturnStatus.tsx
src/components/portal/dashboard/TaxWorkflowProgress.tsx
src/components/portal/dashboard/TaxYearsArchiveSection.tsx
src/components/portal/dashboard/UpcomingAppointment.tsx
src/components/portal/dashboard/UpcomingAppointmentCard.tsx
src/components/portal/dashboard/WelcomeHeader.tsx
src/components/portal/GuidedIntakeWizard.tsx
src/components/portal/layout/MobileBottomNav.tsx
src/components/portal/layout/MobileDrawer.tsx
src/components/portal/layout/PortalSidebar.tsx
src/components/portal/modals/HelpModal.tsx
src/components/portal/modals/UploadModal.tsx
src/components/portal/views/AccountantTaxCaseReviewWorkspace.tsx
src/components/portal/views/AccountingView.tsx
src/components/portal/views/BillingView.tsx
src/components/portal/views/CollapsibleDocumentRequirements.tsx
src/components/portal/views/DocumentsView.tsx
src/components/portal/views/GuidedTaxQuestionnaireModal.tsx
src/components/portal/views/MyDocumentsClientVault.tsx
src/components/portal/views/NotificationsView.tsx
src/components/portal/views/RequestsView.tsx
src/components/portal/views/stages/StageEighteenRepeatView.tsx
src/components/portal/views/stages/StageElevenSignView.tsx
src/components/portal/views/stages/StageFifteenMonitorView.tsx
src/components/portal/views/stages/StageFourteenResolveView.tsx
src/components/portal/views/stages/StageNinePrepareTaxesView.tsx
src/components/portal/views/stages/StageNinePrepareView.tsx
src/components/portal/views/stages/StageSeventeenRenewView.tsx
src/components/portal/views/stages/StageSixteenArchiveView.tsx
src/components/portal/views/stages/StageTenApproveView.tsx
src/components/portal/views/stages/StageThirteenFeedbackView.tsx
src/components/portal/views/stages/StageTwelveFileView.tsx
src/components/portal/views/TaxReturnView.tsx
src/components/portal/views/TaxStrategiesView.tsx
src/components/ui/BrandedInput.tsx
src/components/ui/BrandedSelect.tsx
src/components/ui/EmptyStateCard.tsx
src/components/validation/StageThreeAccountantReviewWorkspace.tsx
src/components/validation/StageThreeValidationWorkspace.tsx
src/components/workspace/AccountantBookkeepingSection.tsx
src/components/workspace/StaffOnboardingWizard.tsx
src/services/connectors/DocumentSourceConnector.ts
src/services/contracts/index.ts
src/services/contracts/TaxGuardDocumentService.ts
src/services/production/index.ts
src/services/production/ProductionDocumentService.ts
src/services/production/ProductionEnvironmentGuard.ts
src/taxguard/calculation/Federal1040AgiCalculation.ts
src/taxguard/calculation/Federal1040IncomeAggregation.ts
src/taxguard/calculation/Federal1040RemainingCalculations.ts
src/taxguard/calculation/index.ts
src/taxguard/calculation/TaxCalculationContract.ts
src/taxguard/calculation/TaxYearCalculationRegistry.ts
src/taxguard/components/AICreditUsageManager.tsx
src/taxguard/components/BrandedDeliverablesGenerator.tsx
src/taxguard/components/DraftReturnPreparer.tsx
src/taxguard/components/EntityRelationshipGraph.tsx
src/taxguard/components/EstimatedPaymentsCenter.tsx
src/taxguard/components/FixedAssetRegister.tsx
src/taxguard/components/reusableComponents.tsx
src/taxguard/components/SideBySideReviewWorkspace.tsx
src/taxguard/components/TaxGuardNav.tsx
src/taxguard/components/TaxGuardVoiceAssistant.tsx
src/taxguard/components/TaxPlanningScenarioModeler.tsx
src/taxguard/components/TaxResolutionCenter.tsx
src/taxguard/components/UnifiedActionCenter.tsx
src/taxguard/config/taxguardConfig.ts
src/taxguard/deployment/index.ts
src/taxguard/deployment/TaxGuardProductionAdapter.ts
src/taxguard/deployment/TaxGuardProductionDeployment.ts
src/taxguard/deployment/TaxGuardProductionRuntime.ts
src/taxguard/document-intelligence/index.ts
src/taxguard/document-intelligence/ProductionDocumentExtraction.ts
src/taxguard/document-intelligence/ProductionDocumentIntelligence.ts
src/taxguard/document-intelligence/ProductionDocumentVerification.ts
src/taxguard/exceptions/index.ts
src/taxguard/exceptions/TaxGuardExceptionDetection.ts
src/taxguard/exceptions/TaxGuardExceptionProfessionalReview.ts
src/taxguard/exceptions/TaxGuardExceptionWorkflow.ts
src/taxguard/go-live/index.ts
src/taxguard/go-live/ProductionAuthentication.ts
src/taxguard/go-live/ProductionIntegration.ts
src/taxguard/go-live/ProductionOperations.ts
src/taxguard/go-live/ProductionReadiness.ts
src/taxguard/index.ts
src/taxguard/intelligence/decisions/DecisionApprovalOrchestrator.ts
src/taxguard/intelligence/evidence/EvidencePackageBuilder.ts
src/taxguard/intelligence/governance/IntelligenceGovernanceBoundary.ts
src/taxguard/intelligence/knowledge/KnowledgeRegistry.ts
src/taxguard/intelligence/rules/DeterministicRuleEngine.ts
src/taxguard/intelligence/rules/RuleRegistry.ts
src/taxguard/knowledge/Federal1040KnowledgePack2025.ts
src/taxguard/knowledge/index.ts
src/taxguard/knowledge/TaxAIKnowledgeBoundary.ts
src/taxguard/knowledge/TaxAuthoritySourceRegistry.ts
src/taxguard/knowledge/TaxEvidenceCitationBinding.ts
src/taxguard/knowledge/TaxHumanReviewAuditIntegration.ts
src/taxguard/knowledge/TaxKnowledgeConflictEngine.ts
src/taxguard/knowledge/TaxRuleApplicabilityEngine.ts
src/taxguard/knowledge/TaxRuleRegistry.ts
src/taxguard/preparation/Federal1040Preparation.ts
src/taxguard/preparation/index.ts
src/taxguard/production/index.ts
src/taxguard/production/TaxGuardProductionApi.ts
src/taxguard/production/TaxGuardProductionDeployment.ts
src/taxguard/production/TaxGuardProductionEnvironment.ts
src/taxguard/production/TaxGuardProductionMonitoring.ts
src/taxguard/production/TaxGuardProductionOperations.ts
src/taxguard/production/TaxGuardProductionRelease.ts
src/taxguard/production/TaxGuardProductionSecurity.ts
src/taxguard/provenance/index.ts
src/taxguard/provenance/TaxGuardDecisionIntegrity.ts
src/taxguard/provenance/TaxGuardDecisionProvenance.ts
src/taxguard/provenance/TaxGuardProvenanceChain.ts
src/taxguard/roleCapabilityMatrix.ts
src/taxguard/services/TaxGuardAssistantService.ts
src/taxguard/state/index.ts
src/taxguard/state/StateTaxArchitecture.ts
src/taxguard/state/StateTaxCalculation.ts
src/taxguard/state/StateTaxPreparation.ts
src/taxguard/TaxGuardApp.tsx
src/taxguard/views/TaxGuardAdminSettingsView.tsx
src/taxguard/views/TaxGuardAuditLogView.tsx
src/taxguard/views/TaxGuardCasesView.tsx
src/taxguard/views/TaxGuardClassificationView.tsx
src/taxguard/views/TaxGuardDashboardView.tsx
src/taxguard/views/TaxGuardDocumentsView.tsx
src/taxguard/views/TaxGuardEvidenceView.tsx
src/taxguard/views/TaxGuardExtractionView.tsx
src/taxguard/views/TaxGuardFieldMappingView.tsx
src/taxguard/views/TaxGuardIntakeView.tsx
src/taxguard/views/TaxGuardIntegrationsView.tsx
src/taxguard/views/TaxGuardMissingItemsView.tsx
src/taxguard/views/TaxGuardReportsView.tsx
src/taxguard/views/TaxGuardResearchView.tsx
src/taxguard/views/TaxGuardReviewApprovalView.tsx
src/taxguard/views/TaxGuardScannerView.tsx
src/taxguard/views/TaxGuardSummariesView.tsx
src/taxguard/views/TaxGuardWorkpapersView.tsx
src/taxguard/workflow/index.ts
src/taxguard/workflow/TaxGuardReturnWorkflow.ts
src/taxguard/workflow/TaxGuardWorkflowControls.ts
src/taxguard/workflow/TaxGuardWorkflowGovernance.ts
src/demo/components/AiAssistantDrawer.tsx
src/demo/components/CameraScannerModal.tsx
src/demo/components/DashboardShell.tsx
src/demo/components/DemoBanner.tsx
src/demo/components/DeveloperContactNotice.tsx
src/demo/components/ErrorPages.tsx
src/demo/components/IntegrationRegistryModal.tsx
src/demo/components/RoleLoginPage.tsx
src/demo/components/SimulatedActionModal.tsx
src/demo/components/WorkCycleProgress.tsx
src/demo/config/accountantNavGroups.ts
src/demo/config/clientNavGroups.ts
src/demo/DemoAppRouter.tsx
src/demo/lifecycleMockData.ts
src/demo/mockData.ts
src/demo/services/AccountantCenterService.ts
src/demo/services/clientDashboardAdapters.ts
src/demo/services/clientDashboardInterfaces.ts
src/demo/services/clientDashboardServices.ts
src/demo/services/clientInitialData.ts
src/demo/services/DemoAIService.ts
src/demo/services/DemoAuthService.ts
src/demo/services/DemoDataService.ts
src/demo/services/mockServices.ts
src/demo/services/personalizedDocumentsEngine.ts
src/demo/services/preFilingGateRegistryService.ts
src/demo/services/serviceInterfaces.ts
src/demo/types/accountantCenter.ts
src/demo/types/preFilingGateRegistry.ts
src/demo/types.ts
src/demo/views/accountant/AccountantAdminViews.tsx
src/demo/views/accountant/AccountantAuditLogView.tsx
src/demo/views/accountant/AccountantCommandDashboard.tsx
src/demo/views/accountant/AiExceptionCenter.tsx
src/demo/views/accountant/ConsolidatedDocumentCenter.tsx
src/demo/views/accountant/FilingOperationsView.tsx
src/demo/views/accountant/FinalApprovalFilingView.tsx
src/demo/views/accountant/MissingDocumentCenter.tsx
src/demo/views/accountant/PreFilingQcView.tsx
src/demo/views/accountant/PriorYearComparisonView.tsx
src/demo/views/accountant/ReportsExportCenter.tsx
src/demo/views/accountant/TaxPreparationWorkspace.tsx
src/demo/views/accountant/WorkpaperCenter.tsx
src/demo/views/AccountantDashboardView.tsx
src/demo/views/AdminDashboardView.tsx
src/demo/views/AdvisoryDashboardView.tsx
src/demo/views/BillingDashboardView.tsx
src/demo/views/BookkeeperDashboardView.tsx
src/demo/views/client/AccountantReviewStatusSection.tsx
src/demo/views/client/AiProcessingPipelineSection.tsx
src/demo/views/client/ClientAccountingConnectionsSection.tsx
src/demo/views/client/ClientAdvisorySection.tsx
src/demo/views/client/ClientAmendmentsClosureSection.tsx
src/demo/views/client/ClientAssistantModal.tsx
src/demo/views/client/ClientBankConnectionsSection.tsx
src/demo/views/client/ClientBookkeepingSection.tsx
src/demo/views/client/ClientContactsSection.tsx
src/demo/views/client/ClientEngagementDetailsSection.tsx
src/demo/views/client/ClientEstimatedTaxesSection.tsx
src/demo/views/client/ClientFinancialReportsSection.tsx
src/demo/views/client/ClientHelpSupportSection.tsx
src/demo/views/client/ClientIncomeExpensesSection.tsx
src/demo/views/client/ClientInvoicesSection.tsx
src/demo/views/client/ClientJournalLedgerSection.tsx
src/demo/views/client/ClientLenderPackageSection.tsx
src/demo/views/client/ClientMessagesTasksSection.tsx
src/demo/views/client/ClientNoticesSection.tsx
src/demo/views/client/ClientOrganizerSection.tsx
src/demo/views/client/ClientOverviewSection.tsx
src/demo/views/client/ClientPriorArchiveSection.tsx
src/demo/views/client/ClientProfileEntitiesSection.tsx
src/demo/views/client/ClientQuestionnaireSection.tsx
src/demo/views/client/ClientReconciliationSection.tsx
src/demo/views/client/ClientReturnReviewSection.tsx
src/demo/views/client/ClientSettingsConsentSection.tsx
src/demo/views/client/ClientSubViews.tsx
src/demo/views/client/ClientTaxReadinessSection.tsx
src/demo/views/client/ClientVaultSection.tsx
src/demo/views/client/LifecycleDetailModal.tsx
src/demo/views/client/MissingDocumentsSection.tsx
src/demo/views/client/PersonalizedChecklistModals.tsx
src/demo/views/client/PersonalizedChecklistSection.tsx
src/demo/views/client/TaxPackageSection.tsx
src/demo/views/client/UploadScanCenterSection.tsx
src/demo/views/ClientDashboardView.tsx
src/demo/views/ComplianceDashboardView.tsx
src/demo/views/ExecutiveDashboardView.tsx
src/demo/views/IntakeDashboardView.tsx
src/demo/views/LifecycleRoleDashboardView.tsx
src/demo/views/OperationsDashboardView.tsx
src/demo/views/PayrollDashboardView.tsx
src/demo/views/PortalDirectoryView.tsx
src/demo/views/ReviewerDashboardView.tsx
src/ai/schemaManifest.ts
src/config/authRecoveryPolicy.ts
src/config/taxGuardRuntime.ts
src/supabase/storage.ts
```
