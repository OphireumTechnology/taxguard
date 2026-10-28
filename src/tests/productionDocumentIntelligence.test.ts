import {
  describe,
  expect,
  it
} from 'vitest';

import {
  TaxGuardDocumentProcessingBoundary,
  TaxGuardDocumentProviderRegistry,
  TaxGuardDocumentQuarantineRegistry,
  TaxGuardDocumentSecurityGate,
  TaxGuardSecureDocumentIntakeRegistry
} from '../taxguard/document-intelligence/ProductionDocumentIntelligence';

import {
  TaxGuardDocumentIntelligenceBoundary,
  TaxGuardProductionExtractionRegistry,
  TaxGuardProductionOcrRegistry
} from '../taxguard/document-intelligence/ProductionDocumentExtraction';

import {
  TaxGuardDocumentDownstreamGate,
  TaxGuardDocumentReleaseGate,
  TaxGuardDocumentVerificationBoundary,
  TaxGuardHumanFieldVerificationRegistry,
  TaxGuardValidatedDocumentFactRegistry
} from '../taxguard/document-intelligence/ProductionDocumentVerification';

function context() {
  return {
    clientId: 'CLIENT-M14-001',
    engagementId: 'ENGAGEMENT-M14-001',
    taxYear: 2025,
    correlationId: 'CORRELATION-M14-001'
  };
}

function createSecureDocument() {
  const intake =
    new TaxGuardSecureDocumentIntakeRegistry();

  const document =
    intake.receive({
      sourceDocumentId: 'SOURCE-M14-001',
      context: context(),
      originalFileName: '2025 W-2.pdf',
      declaredMimeType: 'application/pdf',
      detectedMimeType: 'application/pdf',
      sizeBytes: 125000,
      sha256: 'a'.repeat(64),
      uploadedBy: 'CLIENT-M14-001'
    });

  const quarantineRegistry =
    new TaxGuardDocumentQuarantineRegistry();

  const quarantine =
    quarantineRegistry.quarantine({
      quarantineId: 'QUARANTINE-M14-001',
      document,
      reason: 'NEW_UPLOAD'
    });

  const securityGate =
    new TaxGuardDocumentSecurityGate();

  const security =
    securityGate.evaluate({
      securityRecordId: 'SECURITY-M14-001',
      document,
      fileSignatureValid: true,
      malwareScanStatus: 'CLEAN',
      scannerProvider: 'MALWARE-PROVIDER-M14',
      scannerReferenceId: 'SCAN-M14-001',
      checkedBy: 'SECOPS-M14'
    });

  const releasedQuarantine =
    quarantineRegistry.release(
      quarantine.quarantineId,
      security
    );

  return {
    document,
    security,
    quarantine: releasedQuarantine
  };
}

function createProviders() {
  const registry =
    new TaxGuardDocumentProviderRegistry();

  const ocrProvider =
    registry.register({
      providerId: 'OCR-PROVIDER-M14',
      providerType: 'OCR',
      configured: true,
      productionConnected: true,
      lastVerifiedAt: new Date().toISOString()
    });

  const extractionProvider =
    registry.register({
      providerId: 'EXTRACTION-PROVIDER-M14',
      providerType: 'DOCUMENT_EXTRACTION',
      configured: true,
      productionConnected: true,
      lastVerifiedAt: new Date().toISOString()
    });

  return {
    registry,
    ocrProvider,
    extractionProvider
  };
}

function createExtraction(
  confidence = 0.98
) {
  const secure =
    createSecureDocument();

  const providers =
    createProviders();

  const ocrRegistry =
    new TaxGuardProductionOcrRegistry();

  const ocr =
    ocrRegistry.create({
      ocrArtifactId: 'OCR-M14-001',
      document: secure.document,
      quarantine: secure.quarantine,
      security: secure.security,
      provider: providers.ocrProvider,
      providerReferenceId: 'OCR-REMOTE-M14-001',
      pages: [
        {
          pageNumber: 1,
          text: 'Wages tips other compensation 50000.00',
          confidence: 0.99
        }
      ]
    });

  const extractionRegistry =
    new TaxGuardProductionExtractionRegistry();

  const extraction =
    extractionRegistry.create({
      extractionArtifactId: 'EXTRACT-M14-001',
      document: secure.document,
      ocr,
      provider: providers.extractionProvider,
      providerReferenceId: 'EXTRACT-REMOTE-M14-001',
      minimumConfidence: 0.90,
      fields: [
        {
          extractedFieldId: 'FIELD-M14-001',
          fieldPath: 'w2.box1.wages',
          rawValue: '50000.00',
          normalizedValue: '50000.00',
          confidence,
          pageNumber: 1,
          boundingBox: {
            pageNumber: 1,
            x: 100,
            y: 200,
            width: 180,
            height: 30
          },
          sourceText: '50000.00',
          requiresHumanReview: false,
          immutable: true
        }
      ]
    });

  return {
    ...secure,
    ...providers,
    ocr,
    extraction
  };
}

function createValidatedPipeline() {
  const foundation =
    createExtraction();

  const field =
    foundation.extraction.fields[0];

  const verificationRegistry =
    new TaxGuardHumanFieldVerificationRegistry();

  const verification =
    verificationRegistry.verify({
      verificationId: 'VERIFY-M14-001',
      document: foundation.document,
      ocr: foundation.ocr,
      extraction: foundation.extraction,
      field,
      disposition: 'VERIFIED_AS_EXTRACTED',
      reviewerId: 'REVIEWER-M14',
      reviewerRole: 'REVIEWER',
      evidenceIds: [
        'EVIDENCE-M14-001'
      ],
      provenanceDecisionId: 'PROVENANCE-M14-001'
    });

  const factRegistry =
    new TaxGuardValidatedDocumentFactRegistry();

  const fact =
    factRegistry.create({
      factId: 'FACT-M14-001',
      verification
    });

  return {
    ...foundation,
    verification,
    fact
  };
}

describe(
  'TaxGuard M14 Production Document Intelligence',
  () => {

    it(
      'M14.1 quarantines every newly received document',
      () => {
        const intake =
          new TaxGuardSecureDocumentIntakeRegistry();

        const document =
          intake.receive({
            sourceDocumentId: 'SOURCE-NEW',
            context: context(),
            originalFileName: 'Form W-2.pdf',
            declaredMimeType: 'application/pdf',
            detectedMimeType: 'application/pdf',
            sizeBytes: 1000,
            sha256: 'b'.repeat(64),
            uploadedBy: 'CLIENT'
          });

        expect(document.status)
          .toBe('QUARANTINED');
      }
    );

    it(
      'M14.2 rejects duplicate document content by SHA-256',
      () => {
        const intake =
          new TaxGuardSecureDocumentIntakeRegistry();

        const base = {
          context: context(),
          originalFileName: 'document.pdf',
          declaredMimeType: 'application/pdf',
          detectedMimeType: 'application/pdf',
          sizeBytes: 1000,
          sha256: 'c'.repeat(64),
          uploadedBy: 'CLIENT'
        };

        intake.receive({
          ...base,
          sourceDocumentId: 'SOURCE-DUP-1'
        });

        expect(
          () =>
            intake.receive({
              ...base,
              sourceDocumentId: 'SOURCE-DUP-2'
            })
        ).toThrow(
          'TG_DOC_DUPLICATE_CONTENT'
        );
      }
    );

    it(
      'M14.3 rejects unsupported detected file types',
      () => {
        const intake =
          new TaxGuardSecureDocumentIntakeRegistry();

        expect(
          () =>
            intake.receive({
              sourceDocumentId: 'SOURCE-BAD-TYPE',
              context: context(),
              originalFileName: 'payload.exe',
              declaredMimeType:
                'application/octet-stream',
              detectedMimeType:
                'application/x-msdownload',
              sizeBytes: 1000,
              sha256: 'd'.repeat(64),
              uploadedBy: 'CLIENT'
            })
        ).toThrow(
          'TG_DOC_UNSUPPORTED_FILE_TYPE'
        );
      }
    );

    it(
      'M14.4 fails security validation when malware is detected',
      () => {
        const intake =
          new TaxGuardSecureDocumentIntakeRegistry();

        const document =
          intake.receive({
            sourceDocumentId: 'SOURCE-INFECTED',
            context: context(),
            originalFileName: 'infected.pdf',
            declaredMimeType: 'application/pdf',
            detectedMimeType: 'application/pdf',
            sizeBytes: 1000,
            sha256: 'e'.repeat(64),
            uploadedBy: 'CLIENT'
          });

        const security =
          new TaxGuardDocumentSecurityGate()
            .evaluate({
              securityRecordId: 'SEC-INFECTED',
              document,
              fileSignatureValid: true,
              malwareScanStatus: 'INFECTED',
              scannerProvider: 'SCANNER',
              checkedBy: 'SECOPS'
            });

        expect(security.status)
          .toBe('FAILED');

        expect(
          security.failureReasons
        ).toContain(
          'MALWARE_DETECTED'
        );
      }
    );

    it(
      'M14.5 blocks quarantine release after failed security',
      () => {
        const intake =
          new TaxGuardSecureDocumentIntakeRegistry();

        const document =
          intake.receive({
            sourceDocumentId: 'SOURCE-BLOCKED',
            context: context(),
            originalFileName: 'blocked.pdf',
            declaredMimeType: 'application/pdf',
            detectedMimeType: 'application/pdf',
            sizeBytes: 1000,
            sha256: 'f'.repeat(64),
            uploadedBy: 'CLIENT'
          });

        const quarantineRegistry =
          new TaxGuardDocumentQuarantineRegistry();

        const quarantine =
          quarantineRegistry.quarantine({
            quarantineId: 'Q-BLOCKED',
            document,
            reason: 'NEW_UPLOAD'
          });

        const security =
          new TaxGuardDocumentSecurityGate()
            .evaluate({
              securityRecordId: 'SEC-BLOCKED',
              document,
              fileSignatureValid: false,
              malwareScanStatus: 'CLEAN',
              scannerProvider: 'SCANNER',
              checkedBy: 'SECOPS'
            });

        expect(
          () =>
            quarantineRegistry.release(
              quarantine.quarantineId,
              security
            )
        ).toThrow(
          'TG_DOC_QUARANTINE_RELEASE_BLOCKED'
        );
      }
    );

    it(
      'M14.6 allows processing only after quarantine and security gates pass',
      () => {
        const secure =
          createSecureDocument();

        expect(
          TaxGuardDocumentProcessingBoundary
            .assertMayProcess({
              quarantine: secure.quarantine,
              security: secure.security
            })
        ).toBe(true);
      }
    );

    it(
      'M14.7 blocks provider that is configured but not production connected',
      () => {
        const registry =
          new TaxGuardDocumentProviderRegistry();

        registry.register({
          providerId: 'OCR-NOT-LIVE',
          providerType: 'OCR',
          configured: true,
          productionConnected: false
        });

        expect(
          () =>
            registry.assertProductionReady(
              'OCR-NOT-LIVE'
            )
        ).toThrow(
          'TG_DOC_PROVIDER_NOT_PRODUCTION_READY'
        );
      }
    );

    it(
      'M14.8 creates production OCR artifact only after security release',
      () => {
        const result =
          createExtraction();

        expect(
          result.ocr
            .productionProviderVerified
        ).toBe(true);

        expect(
          result.ocr.averageConfidence
        ).toBeCloseTo(0.99);
      }
    );

    it(
      'M14.9 preserves field page and bounding-box provenance',
      () => {
        const result =
          createExtraction();

        const field =
          result.extraction.fields[0];

        expect(field.pageNumber)
          .toBe(1);

        expect(
          field.boundingBox.pageNumber
        ).toBe(1);

        expect(
          field.boundingBox.width
        ).toBe(180);
      }
    );

    it(
      'M14.10 marks extraction as AI-proposed and not tax verified',
      () => {
        const result =
          createExtraction();

        expect(
          result.extraction.aiProposedOnly
        ).toBe(true);

        expect(
          result.extraction.taxVerified
        ).toBe(false);
      }
    );

    it(
      'M14.11 routes low-confidence extraction to human review',
      () => {
        const result =
          createExtraction(0.70);

        expect(
          result.extraction
            .requiresHumanReview
        ).toBe(true);

        expect(
          result.extraction.reviewReasons
        ).toContain(
          'LOW_CONFIDENCE:FIELD-M14-001'
        );
      }
    );

    it(
      'M14.12 permits authorized human correction of extracted value',
      () => {
        const result =
          createExtraction();

        const registry =
          new TaxGuardHumanFieldVerificationRegistry();

        const verification =
          registry.verify({
            verificationId: 'VERIFY-CORRECTED',
            document: result.document,
            ocr: result.ocr,
            extraction: result.extraction,
            field: result.extraction.fields[0],
            disposition: 'CORRECTED',
            correctedValue: '51000.00',
            reviewerId: 'CPA-M14',
            reviewerRole: 'CPA',
            evidenceIds: [
              'EVIDENCE-CORRECTION'
            ],
            provenanceDecisionId:
              'PROVENANCE-CORRECTION'
          });

        expect(
          verification.verifiedValue
        ).toBe('51000.00');
      }
    );

    it(
      'M14.13 prevents rejected extraction from becoming validated fact',
      () => {
        const result =
          createExtraction();

        const verification =
          new TaxGuardHumanFieldVerificationRegistry()
            .verify({
              verificationId: 'VERIFY-REJECTED',
              document: result.document,
              ocr: result.ocr,
              extraction: result.extraction,
              field: result.extraction.fields[0],
              disposition: 'REJECTED',
              reviewerId: 'REVIEWER',
              reviewerRole: 'REVIEWER',
              evidenceIds: [
                'EVIDENCE-REJECT'
              ],
              provenanceDecisionId:
                'PROVENANCE-REJECT'
            });

        expect(
          () =>
            new TaxGuardValidatedDocumentFactRegistry()
              .create({
                factId: 'FACT-REJECTED',
                verification
              })
        ).toThrow(
          'TG_DOC_REJECTED_FIELD_CANNOT_BECOME_FACT'
        );
      }
    );

    it(
      'M14.14 creates validated fact only from human verification',
      () => {
        const result =
          createValidatedPipeline();

        expect(result.fact.validated)
          .toBe(true);

        expect(
          result.fact.aiProposedOnly
        ).toBe(false);

        expect(
          result.fact.validatedBy
        ).toBe('REVIEWER-M14');
      }
    );

    it(
      'M14.15 preserves full provenance on validated tax fact',
      () => {
        const result =
          createValidatedPipeline();

        expect(
          result.fact.sourceDocumentId
        ).toBe('SOURCE-M14-001');

        expect(
          result.fact.ocrArtifactId
        ).toBe('OCR-M14-001');

        expect(
          result.fact.extractionArtifactId
        ).toBe('EXTRACT-M14-001');

        expect(
          result.fact.extractedFieldId
        ).toBe('FIELD-M14-001');

        expect(
          result.fact.provenanceDecisionId
        ).toBe('PROVENANCE-M14-001');
      }
    );

    it(
      'M14.16 releases fully reviewed validated facts downstream',
      () => {
        const result =
          createValidatedPipeline();

        const release =
          new TaxGuardDocumentReleaseGate()
            .release({
              releaseDecisionId:
                'RELEASE-M14-001',
              document: result.document,
              quarantine: result.quarantine,
              security: result.security,
              extraction: result.extraction,
              verifications: [
                result.verification
              ],
              validatedFacts: [
                result.fact
              ],
              releasedBy: 'CPA-M14',
              releasedByRole: 'CPA'
            });

        expect(
          release.downstreamUseAllowed
        ).toBe(true);

        expect(
          release.validatedFactIds
        ).toContain('FACT-M14-001');
      }
    );

    it(
      'M14.17 blocks release when an extracted field has not been reviewed',
      () => {
        const result =
          createExtraction();

        expect(
          () =>
            new TaxGuardDocumentReleaseGate()
              .release({
                releaseDecisionId:
                  'RELEASE-BLOCKED',
                document: result.document,
                quarantine: result.quarantine,
                security: result.security,
                extraction: result.extraction,
                verifications: [],
                validatedFacts: [],
                releasedBy: 'CPA',
                releasedByRole: 'CPA'
              })
        ).toThrow(
          'TG_DOC_RELEASE_VERIFICATION_REQUIRED'
        );
      }
    );

    it(
      'M14.18 permits downstream use only for released validated facts',
      () => {
        const result =
          createValidatedPipeline();

        const release =
          new TaxGuardDocumentReleaseGate()
            .release({
              releaseDecisionId:
                'RELEASE-DOWNSTREAM',
              document: result.document,
              quarantine: result.quarantine,
              security: result.security,
              extraction: result.extraction,
              verifications: [
                result.verification
              ],
              validatedFacts: [
                result.fact
              ],
              releasedBy: 'CPA-M14',
              releasedByRole: 'CPA'
            });

        expect(
          TaxGuardDocumentDownstreamGate
            .assertMayUseTaxFacts({
              release,
              facts: [
                result.fact
              ]
            })
        ).toBe(true);
      }
    );

    it(
      'M14.19 blocks AI from converting extraction into verified tax fact',
      () => {
        expect(
          () =>
            TaxGuardDocumentIntelligenceBoundary
              .markExtractionTaxVerified()
        ).toThrow(
          'TG_DOC_AI_EXTRACTION_CANNOT_BE_TAX_VERIFIED'
        );

        expect(
          () =>
            TaxGuardDocumentVerificationBoundary
              .aiCreateValidatedTaxFact()
        ).toThrow(
          'TG_DOC_AI_VALIDATED_FACT_BLOCKED'
        );
      }
    );

    it(
      'M14.20 blocks fabricated provider results and human-review bypass',
      () => {
        expect(
          () =>
            TaxGuardDocumentIntelligenceBoundary
              .fabricateProviderResult()
        ).toThrow(
          'TG_DOC_PROVIDER_RESULT_FABRICATION_BLOCKED'
        );

        expect(
          () =>
            TaxGuardDocumentVerificationBoundary
              .bypassHumanVerification()
        ).toThrow(
          'TG_DOC_HUMAN_VERIFICATION_BYPASS_BLOCKED'
        );
      }
    );
  }
);
