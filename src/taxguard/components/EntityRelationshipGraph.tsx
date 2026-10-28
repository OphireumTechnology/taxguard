/**
 * TaxGuard AI – Client & Related Entity Intelligence Graph
 * Multi-entity relationship mapping, shareholder/partner basis tracking,
 * K-1 flow-through links, related-party transactions, and professional verification gates.
 */

import React, { useState } from 'react';
import { 
  Building2, 
  Users, 
  Share2, 
  ShieldCheck, 
  CheckCircle2, 
  AlertCircle, 
  ArrowRight, 
  DollarSign, 
  Percent, 
  Layers, 
  ExternalLink,
  Plus,
  Lock,
  Sparkles
} from 'lucide-react';
import { TaxGuardAuditService } from '../services/TaxGuardAuditService';

export type EntityType = 
  | 'Individual'
  | 'Spouse'
  | 'Dependent'
  | 'Sole Proprietorship'
  | 'Single-Member LLC'
  | 'Multi-Member LLC'
  | 'S Corporation'
  | 'C Corporation'
  | 'Partnership'
  | 'Trust'
  | 'Estate'
  | 'Exempt Organization'
  | 'Payroll Entity'
  | 'Rental Property'
  | 'Investment Entity';

export type RelationshipType = 
  | 'Shareholder'
  | 'Partner'
  | 'Beneficiary'
  | 'Trustee'
  | 'Guaranteed Payment'
  | 'K-1 Flow-Through'
  | 'Related-Party Loan'
  | 'Related-Party Transaction'
  | 'Common Asset'
  | 'Capital Contribution'
  | 'Distributions'
  | 'Multi-State Activity';

export interface EntityNode {
  id: string;
  name: string;
  type: EntityType;
  einOrSsnMasked: string;
  jurisdiction: string;
  taxYear: number;
  returnType: string;
  shareholderBasis?: number;
  partnerBasis?: number;
  capitalAccount?: number;
  verified: boolean;
  verifiedBy?: string;
  sourceDoc: string;
}

export interface EntityRelationshipEdge {
  id: string;
  fromEntityId: string;
  toEntityId: string;
  relationshipType: RelationshipType;
  ownershipPercentage?: number;
  annualFlowAmount?: number;
  details: string;
  suggestedByAI: boolean;
  confidence: number;
  verifiedByCPA: boolean;
  verifiedBy?: string;
  sourceCitation: string;
}

const INITIAL_NODES: EntityNode[] = [
  {
    id: 'ent_perotti_indiv',
    name: 'Michael Perotti (Taxpayer)',
    type: 'Individual',
    einOrSsnMasked: '***-**-4912',
    jurisdiction: 'SC / Federal',
    taxYear: 2024,
    returnType: 'Form 1040',
    verified: true,
    verifiedBy: 'Elena Rostova, CPA',
    sourceDoc: 'Client Identification & W-2 Records'
  },
  {
    id: 'ent_perotti_holdings',
    name: 'Perotti Holdings, LLC',
    type: 'S Corporation',
    einOrSsnMasked: '**-***9821',
    jurisdiction: 'SC / NC / GA',
    taxYear: 2024,
    returnType: 'Form 1120-S',
    shareholderBasis: 485000,
    capitalAccount: 390000,
    verified: true,
    verifiedBy: 'Elena Rostova, CPA',
    sourceDoc: 'Articles of Org & Form 2553 Election'
  },
  {
    id: 'ent_perotti_realty',
    name: 'Palmetto Commercial Properties, LLC',
    type: 'Partnership',
    einOrSsnMasked: '**-***6144',
    jurisdiction: 'SC',
    taxYear: 2024,
    returnType: 'Form 1065',
    partnerBasis: 245000,
    capitalAccount: 210000,
    verified: true,
    verifiedBy: 'Marcus Vance, EA',
    sourceDoc: 'Operating Agreement & Form 1065 Schedule B'
  },
  {
    id: 'ent_perotti_trust',
    name: 'Perotti Family Irrevocable Asset Trust',
    type: 'Trust',
    einOrSsnMasked: '**-***3391',
    jurisdiction: 'SC',
    taxYear: 2024,
    returnType: 'Form 1041',
    verified: false,
    sourceDoc: '2024 Trust Agreement (Draft Extraction)'
  }
];

const INITIAL_EDGES: EntityRelationshipEdge[] = [
  {
    id: 'edge_1',
    fromEntityId: 'ent_perotti_indiv',
    toEntityId: 'ent_perotti_holdings',
    relationshipType: 'Shareholder',
    ownershipPercentage: 100,
    annualFlowAmount: 185000,
    details: '100% Managing Shareholder. Officer Compensation $115,000 W-2, $70,000 S-Corp Distribution.',
    suggestedByAI: false,
    confidence: 1.0,
    verifiedByCPA: true,
    verifiedBy: 'Elena Rostova, CPA',
    sourceCitation: 'Form 1120-S Schedule K-1 & 2024 W-2'
  },
  {
    id: 'edge_2',
    fromEntityId: 'ent_perotti_holdings',
    toEntityId: 'ent_perotti_realty',
    relationshipType: 'Related-Party Loan',
    annualFlowAmount: 65000,
    details: 'Demand promissory note @ AFR 4.62%. Complies with IRC § 7872 below-market loan rules.',
    suggestedByAI: true,
    confidence: 0.94,
    verifiedByCPA: true,
    verifiedBy: 'Marcus Vance, EA',
    sourceCitation: 'General Ledger Account 2150 (Due from Affiliate)'
  },
  {
    id: 'edge_3',
    fromEntityId: 'ent_perotti_indiv',
    toEntityId: 'ent_perotti_realty',
    relationshipType: 'Partner',
    ownershipPercentage: 50,
    annualFlowAmount: 42000,
    details: '50% General Partner. Schedule K-1 rental real estate loss limitation under § 469 active participation.',
    suggestedByAI: true,
    confidence: 0.96,
    verifiedByCPA: true,
    verifiedBy: 'Elena Rostova, CPA',
    sourceCitation: 'Form 1065 Schedule K-1 Box 1 & 2'
  },
  {
    id: 'edge_4',
    fromEntityId: 'ent_perotti_indiv',
    toEntityId: 'ent_perotti_trust',
    relationshipType: 'Beneficiary',
    details: 'Discretionary income beneficiary. Suggested by AI from Trust Agreement Article 4.',
    suggestedByAI: true,
    confidence: 0.88,
    verifiedByCPA: false,
    sourceCitation: 'Trust Agreement Article 4, § 2'
  }
];

export const EntityRelationshipGraph: React.FC<{ userRole: string }> = ({ userRole }) => {
  const [nodes, setNodes] = useState<EntityNode[]>(INITIAL_NODES);
  const [edges, setEdges] = useState<EntityRelationshipEdge[]>(INITIAL_EDGES);
  const [selectedEntityId, setSelectedEntityId] = useState<string>('ent_perotti_holdings');
  const [filterType, setFilterType] = useState<string>('all');
  const [actionNotice, setActionNotice] = useState<string | null>(null);

  const selectedEntity = nodes.find(n => n.id === selectedEntityId) || nodes[0];
  const relatedEdges = edges.filter(
    e => e.fromEntityId === selectedEntityId || e.toEntityId === selectedEntityId
  );

  const handleVerifyEdge = (edgeId: string) => {
    setEdges(prev => prev.map(edge => {
      if (edge.id === edgeId) {
        TaxGuardAuditService.logEvent({
          tenantId: 'tenant_ar_tax_prod',
          userId: userRole,
          userEmail: `${userRole}@artaxservices.com`,
          userRole,
          action: 'RELATIONSHIP_GRAPH_VERIFIED',
          recordType: 'engagement',
          recordId: 'eng_2025_perotti',
          ipAddress: '127.0.0.1 (authenticated)',
          result: 'success',
          riskLevel: 'material',
          details: `Verified relationship edge ${edge.relationshipType} between ${edge.fromEntityId} and ${edge.toEntityId}`
        });
        return {
          ...edge,
          verifiedByCPA: true,
          verifiedBy: 'Authorized Professional'
        };
      }
      return edge;
    }));
    setActionNotice('Relationship certified and locked into permanent workpaper basis trail.');
    setTimeout(() => setActionNotice(null), 3500);
  };

  return (
    <div className="space-y-6">
      {/* Top Banner */}
      <div className="border border-neutral-300 bg-white p-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-neutral-200 pb-4">
          <div>
            <div className="text-[10px] font-mono uppercase text-[#C99A32] font-bold tracking-wider">
              A/R Tax Services, LLC • TaxGuard AI Intelligence Architecture
            </div>
            <h2 className="text-base font-bold text-[#061A2F] uppercase tracking-wide flex items-center gap-2">
              <Share2 className="w-4 h-4 text-[#061A2F]" />
              <span>Multi-Entity Relationship Graph &amp; Tax Flow Engine</span>
            </h2>
            <p className="text-xs text-neutral-600 mt-0.5">
              Tracks ownership percentages, K-1 pass-through allocations, related-party debt under IRC § 7872, and shareholder basis.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <span className="px-2.5 py-1 bg-neutral-100 border border-neutral-300 text-neutral-800 text-[11px] font-mono">
              4 Entities • {edges.length} Cross-Entity Flows
            </span>
          </div>
        </div>

        {actionNotice && (
          <div className="mt-3 p-3 bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-semibold flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-600" />
            <span>{actionNotice}</span>
          </div>
        )}

        {/* Entity Selector Pills */}
        <div className="mt-4 flex flex-wrap gap-2">
          {nodes.map(node => (
            <button
              key={node.id}
              onClick={() => setSelectedEntityId(node.id)}
              className={`px-3 py-1.5 border text-xs font-semibold flex items-center gap-2 transition-colors ${
                selectedEntityId === node.id 
                  ? 'bg-[#061A2F] text-white border-[#061A2F]' 
                  : 'bg-white text-neutral-700 border-neutral-300 hover:border-neutral-500'
              }`}
            >
              <Building2 className="w-3.5 h-3.5" />
              <span>{node.name}</span>
              <span className={`text-[9px] px-1 py-0.2 rounded font-mono ${
                selectedEntityId === node.id ? 'bg-neutral-800 text-neutral-200' : 'bg-neutral-100 text-neutral-600'
              }`}>
                {node.type}
              </span>
            </button>
          ))}
        </div>
      </div>

      {/* Selected Entity Card & Flow Breakdown */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column: Entity Facts & Basis Ledger */}
        <div className="border border-neutral-300 bg-white p-5 space-y-4">
          <div className="border-b border-neutral-200 pb-3">
            <div className="text-[10px] font-mono uppercase text-neutral-500">Selected Entity Ledger</div>
            <h3 className="text-sm font-bold text-[#061A2F]">{selectedEntity.name}</h3>
            <div className="text-xs text-neutral-600 font-mono mt-0.5">{selectedEntity.returnType} • {selectedEntity.jurisdiction}</div>
          </div>

          <div className="space-y-2.5 text-xs">
            <div className="flex justify-between py-1 border-b border-neutral-100">
              <span className="text-neutral-600">Tax Identification:</span>
              <span className="font-mono font-semibold text-neutral-900">{selectedEntity.einOrSsnMasked}</span>
            </div>
            <div className="flex justify-between py-1 border-b border-neutral-100">
              <span className="text-neutral-600">Entity Classification:</span>
              <span className="font-semibold text-neutral-900">{selectedEntity.type}</span>
            </div>
            {selectedEntity.shareholderBasis !== undefined && (
              <div className="flex justify-between py-1 border-b border-neutral-100">
                <span className="text-neutral-600">Shareholder Stock Basis (IRC § 1367):</span>
                <span className="font-mono font-bold text-emerald-700">${selectedEntity.shareholderBasis.toLocaleString()}</span>
              </div>
            )}
            {selectedEntity.partnerBasis !== undefined && (
              <div className="flex justify-between py-1 border-b border-neutral-100">
                <span className="text-neutral-600">Outside Partner Basis (IRC § 705):</span>
                <span className="font-mono font-bold text-emerald-700">${selectedEntity.partnerBasis.toLocaleString()}</span>
              </div>
            )}
            {selectedEntity.capitalAccount !== undefined && (
              <div className="flex justify-between py-1 border-b border-neutral-100">
                <span className="text-neutral-600">Tax Basis Capital Account (704(b)):</span>
                <span className="font-mono font-semibold text-neutral-900">${selectedEntity.capitalAccount.toLocaleString()}</span>
              </div>
            )}
            <div className="flex justify-between py-1 border-b border-neutral-100">
              <span className="text-neutral-600">Primary Source Document:</span>
              <span className="text-neutral-800 text-[11px] font-mono">{selectedEntity.sourceDoc}</span>
            </div>
            <div className="flex justify-between py-1 items-center">
              <span className="text-neutral-600">Verification Status:</span>
              {selectedEntity.verified ? (
                <span className="inline-flex items-center gap-1 text-emerald-800 font-bold text-[10px] bg-emerald-50 px-2 py-0.5 border border-emerald-200">
                  <ShieldCheck className="w-3 h-3 text-emerald-600" />
                  <span>CPA Verified ({selectedEntity.verifiedBy})</span>
                </span>
              ) : (
                <span className="inline-flex items-center gap-1 text-amber-800 font-bold text-[10px] bg-amber-50 px-2 py-0.5 border border-amber-200">
                  <AlertCircle className="w-3 h-3 text-amber-600" />
                  <span>Pending Document Verification</span>
                </span>
              )}
            </div>
          </div>

          <div className="pt-2 text-[11px] text-neutral-500 bg-neutral-50 p-2.5 border border-neutral-200">
            <strong>Compliance Note:</strong> Pass-through loss distributions are strictly limited to shareholder/partner basis under IRC §§ 1366(d) and 704(d).
          </div>
        </div>

        {/* Right 2 Columns: Intercompany Relationships & Flow Verification */}
        <div className="lg:col-span-2 border border-neutral-300 bg-white p-5 space-y-4">
          <div className="flex items-center justify-between border-b border-neutral-200 pb-3">
            <div>
              <div className="text-[10px] font-mono uppercase text-neutral-500">Cross-Entity Flows &amp; Allocations</div>
              <h3 className="text-sm font-bold text-[#061A2F]">
                Connected Relationships for {selectedEntity.name}
              </h3>
            </div>
            <div className="text-xs text-neutral-500 font-mono">
              {relatedEdges.length} Active Vectors
            </div>
          </div>

          <div className="space-y-3">
            {relatedEdges.map(edge => {
              const sourceNode = nodes.find(n => n.id === edge.fromEntityId);
              const targetNode = nodes.find(n => n.id === edge.toEntityId);

              return (
                <div key={edge.id} className="border border-neutral-200 p-4 bg-neutral-50 hover:bg-white transition-colors space-y-2">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-neutral-200 pb-2">
                    <div className="flex items-center gap-2 text-xs font-bold text-neutral-900">
                      <span className="bg-white px-2 py-0.5 border border-neutral-300 font-mono text-[11px]">{sourceNode?.name}</span>
                      <ArrowRight className="w-3.5 h-3.5 text-neutral-400" />
                      <span className="bg-white px-2 py-0.5 border border-neutral-300 font-mono text-[11px]">{targetNode?.name}</span>
                    </div>

                    <div className="flex items-center gap-2">
                      <span className="px-2 py-0.5 bg-[#061A2F] text-white text-[10px] font-bold uppercase tracking-wider">
                        {edge.relationshipType}
                      </span>
                      {edge.suggestedByAI && (
                        <span className="px-1.5 py-0.5 bg-sky-100 text-sky-800 text-[10px] font-mono flex items-center gap-1 border border-sky-200">
                          <Sparkles className="w-2.5 h-2.5 text-sky-600" />
                          AI {(edge.confidence * 100).toFixed(0)}%
                        </span>
                      )}
                    </div>
                  </div>

                  <p className="text-xs text-neutral-700">
                    {edge.details}
                  </p>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 text-[11px] pt-1 border-t border-neutral-200">
                    <div>
                      <span className="text-neutral-500">Ownership: </span>
                      <span className="font-mono font-bold text-neutral-800">
                        {edge.ownershipPercentage ? `${edge.ownershipPercentage}%` : 'N/A'}
                      </span>
                    </div>
                    <div>
                      <span className="text-neutral-500">Annual Flow: </span>
                      <span className="font-mono font-bold text-emerald-700">
                        {edge.annualFlowAmount ? `$${edge.annualFlowAmount.toLocaleString()}` : 'N/A'}
                      </span>
                    </div>
                    <div>
                      <span className="text-neutral-500">Authority Citation: </span>
                      <span className="font-mono text-neutral-700">{edge.sourceCitation}</span>
                    </div>
                  </div>

                  {/* Verification Gate */}
                  <div className="pt-2 flex items-center justify-between">
                    <div>
                      {edge.verifiedByCPA ? (
                        <span className="inline-flex items-center gap-1 text-emerald-800 text-[11px] font-bold">
                          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                          <span>Certified by {edge.verifiedBy || 'Senior Reviewer'}</span>
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-amber-700 text-[11px] font-bold">
                          <AlertCircle className="w-3.5 h-3.5 text-amber-500" />
                          <span>AI Suggestion — Requires Professional CPA/EA Sign-Off</span>
                        </span>
                      )}
                    </div>

                    {!edge.verifiedByCPA && (
                      <button
                        onClick={() => handleVerifyEdge(edge.id)}
                        className="px-3 py-1 bg-[#061A2F] hover:bg-neutral-800 text-white text-[11px] font-bold uppercase transition-colors"
                      >
                        Verify &amp; Certify Flow
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
};
