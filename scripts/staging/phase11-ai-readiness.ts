import fs from 'node:fs';
import {CANONICAL_AGENTS} from '../../src/ai/registry';
import {CANONICAL_ARCHITECTURE} from '../../src/ai/architectureMapping';
import {capabilityDefinitions} from '../../src/server/ai/capabilities/CapabilityRegistry';
const bounded:Record<string,{handler:string;tests:string[];scope:string}>={
 A00:{handler:'src/server/ai/orchestration/A00Orchestrator.ts',tests:['src/tests/aiA00Orchestration.test.ts'],scope:'Bounded advisory routing, no delegated material authority'},
 A10:{handler:'src/server/ai/documents/DocumentDuplicateAdvisory.ts',tests:['src/tests/aiDocumentDuplicateAdvisory.test.ts'],scope:'Verified byte-duplicate metadata only'},
 A34:{handler:'src/server/ai/gateway/GovernedAIGateway.ts',tests:['src/tests/aiGovernedGateway.test.ts','src/tests/aiHumanProposalReview.test.ts'],scope:'Counts-review advisory proposal, independent human return/reject only'},
};
const shared={authorization:'src/server/ai/governance/GovernanceControlPlane.ts',scopedTools:'src/server/ai/capabilities/ScopedReadRepository.ts',prompts:'src/server/ai/gateway/ModelPromptResolver.ts',schemas:'src/server/ai/gateway/structuredOutput.ts',budgets:'src/server/ai/gateway/SqlGatewayStore.ts',killSwitches:'src/server/ai/governance/KillSwitchService.ts',ledger:'src/server/ai/ledger/ExecutionLedgerService.ts',humanReview:'src/server/ai/review/HumanProposalReviewService.ts'};
const matrix={inventoryOnly:true,commissioned:false,materialActionsEnabled:false,shared,availableSharedTools:capabilityDefinitions().map(t=>({id:t.id,version:t.version,action:t.action,maximumRows:t.maximum_rows,timeoutMs:t.timeout_ms})),
 agents:CANONICAL_AGENTS.map(agent=>{const mapping=CANONICAL_ARCHITECTURE.find(m=>m.agent_id===agent.agent_id)!;const local=bounded[agent.agent_id];return{
  id:agent.agent_id,purpose:agent.description,name:agent.agent_name,registeredCapability:mapping.mapping_state,
  actualHandler:local?.handler??null,scope:local?.scope??'No approved specialist mapping or executable handler',tenantCaseScope:'Verified session tenant + assigned case + tax year + current evidence; no browser actor authority',
  productionAllowedTools:mapping.allowed_read_capabilities,productionAllowedActions:mapping.allowed_execution_capabilities,
  modelRequirement:agent.default_model,modelVersion:agent.default_model_version,providerAvailability:'NOT_COMMISSIONED',promptId:agent.prompt_id,promptVersion:agent.prompt_version,schemaVersion:agent.schema_version,
  humanReview:'Required; AI-16 approval/attestation chain and authoritative target adapters blocked',
  tokenBudget:agent.token_budget,costBudget:agent.cost_budget,maximumSeconds:agent.maximum_execution_time,maximumRetries:agent.maximum_retries,
  audit:'Tenant-scoped immutable run transitions, usage and proposal ledger; denied attempts audited by governance',
  tests:local?.tests??['src/tests/aiArchitectureMapping.test.ts','src/tests/aiRegistryFoundation.test.ts'],testScope:local?'Synthetic bounded handler/security tests only':'Metadata and default-deny controls only; no specialist behavior test',
  deploymentStatus:agent.status,stagingValidated:false,productionCommissioned:false,missing:local?['Provider/model/prompt commissioning','Independent environment acceptance','Human material-action authority']:['Owner-approved specialist name/requirements/mapping','Specialist implementation and evaluation','Provider/model commissioning','Human material-action authority'],
 };}),taxEngine:{approvedRealRuleContent:false,stages9Through18:'BLOCKED',filing:false,signatures:false,evidence:['src/tests/taxEngineHttp.test.ts','src/tests/taxRuleVerificationCases.test.ts','src/tests/taxRuleCoverage.test.ts']}};
for(const file of [...Object.values(shared),...Object.values(bounded).flatMap(h=>[h.handler,...h.tests])])if(!fs.existsSync(file))throw new Error('AI_MATRIX_EVIDENCE_MISSING');
if(matrix.agents.length!==61||matrix.agents.some((a,i)=>a.id!==`A${String(i).padStart(2,'0')}`||a.deploymentStatus!=='DRAFT'||a.tokenBudget!==0||a.costBudget!==0||a.productionAllowedActions.length))throw new Error('AI_MATRIX_AUTHORITY_INVARIANT');
const text=JSON.stringify(matrix,null,2)+'\n',target='docs/development/phase11-ai-readiness.json';
if(process.argv.includes('--write'))fs.writeFileSync(target,text);else if(fs.readFileSync(target,'utf8').replace(/\r\n/g,'\n')!==text)throw new Error('AI_MATRIX_STALE');
console.log(JSON.stringify({agents:61,boundedHandlers:3,commissioned:0,materialActionsEnabled:false}));
