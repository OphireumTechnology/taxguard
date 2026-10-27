/**
 * Tax engine foundation: a rule-agnostic, declarative rule-set format. TaxGuard ships NO tax rules.
 * A rule set is authored by the firm, every parameter cites a verified source-of-law record, and it
 * is approved by a different reviewer before any calculation may use it (proposal 033).
 *
 * Steps form a straight-line program: each step may reference inputs, parameters, constants and
 * EARLIER steps only (no loops, no recursion, no dynamic code), so evaluation always terminates and
 * is deterministic. All values are exact decimals (TaxDecimal, BigInt based); binary floating point
 * is rejected everywhere.
 */
import { createHash } from 'node:crypto';
import { TaxDecimal, type TaxRoundingMode } from '../../../taxguard/calculation/TaxDecimal';

export const TAX_ENGINE_VERSION = 'taxguard-engine-1.0.0';
export type Jurisdiction = 'federal' | 'state';
export type StepOp = 'sum' | 'subtract' | 'multiply' | 'min' | 'max' | 'floor_zero' | 'round';
export const STEP_OPS: readonly StepOp[] = ['sum', 'subtract', 'multiply', 'min', 'max', 'floor_zero', 'round'];
export const ROUNDING_MODES: readonly TaxRoundingMode[] = ['HALF_UP', 'HALF_EVEN', 'DOWN', 'UP', 'TRUNCATE'];

export interface RuleParameter { key: string; value: string; unit: 'USD' | 'RATE' | 'COUNT'; sourceId: string; citation: string; filingStatus?: string }
export interface RuleInput { factPath: string; unit: 'USD' | 'COUNT'; required: boolean }
/** A reference: input:<factPath> | param:<key> | step:<id> | const:<decimal> */
export interface RuleStep { id: string; op: StepOp; args: string[]; scale?: number; rounding?: TaxRoundingMode; explanation: string }
export interface RuleSetDefinition {
  jurisdiction: Jurisdiction; jurisdictionCode: string; returnFamily: string; taxYear: number; title: string;
  parameters: RuleParameter[]; inputs: RuleInput[]; steps: RuleStep[]; outputs: Array<{ key: string; step: string }>;
}

export class TaxEngineError extends Error {
  constructor(public readonly code: string, public readonly detail?: string) { super(code); }
}
const KEY = /^[a-z][a-z0-9_.]{0,79}$/;
const record = (v: unknown): v is Record<string, unknown> => v !== null && typeof v === 'object' && !Array.isArray(v);
const validKey = (v: unknown): v is string => typeof v === 'string' && KEY.test(v);
const DECIMAL = /^[+-]?\d{1,15}(?:\.\d{1,8})?$/;

/** Deterministic JSON: object keys sorted recursively; arrays keep their order. */
export function canonicalJson(value: unknown): string {
  if (value === null || typeof value !== 'object') {
    if (typeof value === 'number') throw new TaxEngineError('TAX_ENGINE_FLOAT_REJECTED');
    return JSON.stringify(value);
  }
  if (Array.isArray(value)) return '[' + value.map(canonicalJson).join(',') + ']';
  return '{' + Object.keys(value as object).filter(k => (value as any)[k] !== undefined).sort()
    .map(k => JSON.stringify(k) + ':' + canonicalJson((value as any)[k])).join(',') + '}';
}
export const sha256 = (text: string) => createHash('sha256').update(text, 'utf8').digest('hex');
/** Integers are serialized as strings so that canonical JSON never contains numbers. */
export const definitionHash = (d: RuleSetDefinition) => sha256(canonicalJson({ ...d, taxYear: String(d.taxYear),
  steps: d.steps.map(s => ({ ...s, scale: s.scale === undefined ? undefined : String(s.scale) })) }));

/** Structural validation. Returns the set of source IDs the definition cites. */
export function validateRuleSet(d: RuleSetDefinition): string[] {
  const fail = (detail: string): never => { throw new TaxEngineError('TAX_ENGINE_DEFINITION_INVALID', detail); };
  if (!record(d)) fail('definition');
  if (!['federal', 'state'].includes(d.jurisdiction)) fail('jurisdiction');
  if (!/^[A-Z]{2}$/.test(d.jurisdictionCode || '')) fail('jurisdictionCode');
  if (!/^[A-Z0-9-]{2,16}$/.test(d.returnFamily || '')) fail('returnFamily');
  if (!Number.isInteger(d.taxYear) || d.taxYear < 2000 || d.taxYear > 2100) fail('taxYear');
  if (typeof d.title !== 'string' || d.title.trim().length < 3 || d.title.length > 200) fail('title');
  for (const list of ['parameters', 'inputs', 'steps', 'outputs'] as const) if (!Array.isArray(d[list]) || d[list].length > 500) fail(list);
  if (d.steps.length === 0 || d.outputs.length === 0) fail('steps/outputs required');
  const params = new Set<string>(); const sources = new Set<string>();
  for (const p of d.parameters) {
    if (!record(p)) fail('parameter record');
    const id = p.key + '|' + (p.filingStatus ?? '');
    if (!validKey(p.key) || params.has(id)) fail('parameter key');
    if (typeof p.value !== 'string' || !DECIMAL.test(p.value)) fail('parameter value ' + p.key);
    if (!['USD', 'RATE', 'COUNT'].includes(p.unit)) fail('parameter unit ' + p.key);
    if (typeof p.sourceId !== 'string' || !/^[A-Za-z0-9_.:-]{3,80}$/.test(p.sourceId)) fail('parameter source ' + p.key);
    if (typeof p.citation !== 'string' || p.citation.trim().length < 3 || p.citation.length > 300) fail('parameter citation ' + p.key);
    if (p.filingStatus !== undefined && !/^[a-z_]{2,40}$/.test(p.filingStatus)) fail('parameter filing status ' + p.key);
    params.add(id); sources.add(p.sourceId);
  }
  const paramKeys = new Set(d.parameters.map(p => p.key));
  const inputs = new Set<string>();
  for (const i of d.inputs) { if (!record(i) || !validKey(i.factPath) || inputs.has(i.factPath) || !['USD', 'COUNT'].includes(i.unit) || typeof i.required !== 'boolean') fail('input'); inputs.add(i.factPath); }
  const steps = new Set<string>();
  for (const s of d.steps) {
    if (!record(s) || !validKey(s.id) || steps.has(s.id) || inputs.has(s.id)) fail('step id');
    if (!STEP_OPS.includes(s.op)) fail('step op ' + s.id);
    if (!Array.isArray(s.args) || s.args.length < 1 || s.args.length > 50) fail('step args ' + s.id);
    const arity: Record<StepOp, [number, number]> = { sum: [1, 50], subtract: [2, 2], multiply: [2, 2], min: [2, 50], max: [2, 50], floor_zero: [1, 1], round: [1, 1] };
    if (s.args.length < arity[s.op][0] || s.args.length > arity[s.op][1]) fail('step arity ' + s.id);
    if ((s.op === 'multiply' || s.op === 'round') && !(Number.isInteger(s.scale) && s.scale! >= 0 && s.scale! <= 8)) fail('step scale ' + s.id);
    if (s.rounding !== undefined && !ROUNDING_MODES.includes(s.rounding)) fail('step rounding ' + s.id);
    if (typeof s.explanation !== 'string' || s.explanation.trim().length < 3 || s.explanation.length > 500) fail('step explanation ' + s.id);
    for (const a of s.args) {
      if (typeof a !== 'string') fail('step reference');
      const [kind, ref] = [a.slice(0, a.indexOf(':')), a.slice(a.indexOf(':') + 1)];
      const ok = kind === 'input' ? inputs.has(ref) : kind === 'param' ? paramKeys.has(ref) : kind === 'step' ? steps.has(ref) : kind === 'const' ? DECIMAL.test(ref) : false;
      if (!ok) fail(`step ${s.id} reference ${a}`); // only earlier steps: `steps` holds predecessors only
    }
    steps.add(s.id);
  }
  const outKeys = new Set<string>();
  for (const o of d.outputs) { if (!record(o) || !validKey(o.key) || outKeys.has(o.key) || !steps.has(o.step)) fail('output'); outKeys.add(o.key); }
  return [...sources].sort();
}

export interface CalculationRequest { filingStatus?: string; inputs: Array<{ factPath: string; value: string; evidenceIds: string[] }> }
export interface TraceStep { stepId: string; op: StepOp; args: Array<{ ref: string; value: string; sourceId?: string; citation?: string }>; result: string; explanation: string }
export interface CalculationOutcome { engineVersion: string; ruleSetHash: string; inputHash: string; outputHash: string; outputs: Record<string, string>; trace: TraceStep[];
  inputs: CalculationRequest['inputs']; filingStatus: string | null }

/** Pure, deterministic evaluation. The same definition and request always give byte-identical output. */
export function evaluateRuleSet(d: RuleSetDefinition, request: CalculationRequest): CalculationOutcome {
  validateRuleSet(d);
  if (!request || !Array.isArray(request.inputs) || request.inputs.length > 500) throw new TaxEngineError('TAX_ENGINE_INPUT_INVALID', 'inputs');
  if (request.filingStatus !== undefined && !/^[a-z_]{2,40}$/.test(request.filingStatus)) throw new TaxEngineError('TAX_ENGINE_INPUT_INVALID', 'filingStatus');
  // Check untrusted records before the sorting comparator dereferences their fact paths.
  if (request.inputs.some(i => !record(i) || !validKey(i.factPath))) throw new TaxEngineError('TAX_ENGINE_INPUT_INVALID', 'input record');
  const declared = new Map(d.inputs.map(i => [i.factPath, i]));
  const given = new Map<string, TaxDecimal>();
  const normalizedInputs = [...request.inputs].sort((a, b) => a.factPath.localeCompare(b.factPath)).map(i => {
    if (!declared.has(i.factPath) || given.has(i.factPath)) throw new TaxEngineError('TAX_ENGINE_INPUT_INVALID', 'fact ' + i.factPath);
    if (typeof i.value !== 'string' || !DECIMAL.test(i.value)) throw new TaxEngineError(typeof i.value === 'number' ? 'TAX_ENGINE_FLOAT_REJECTED' : 'TAX_ENGINE_INPUT_INVALID', 'value ' + i.factPath);
    if (!Array.isArray(i.evidenceIds) || i.evidenceIds.length === 0 || i.evidenceIds.some(e => typeof e !== 'string' || !/^[A-Za-z0-9_.:-]{3,128}$/.test(e)))
      throw new TaxEngineError('TAX_ENGINE_EVIDENCE_REQUIRED', i.factPath);
    given.set(i.factPath, TaxDecimal.parse(i.value));
    return { factPath: i.factPath, value: TaxDecimal.parse(i.value).toFixed(), evidenceIds: [...i.evidenceIds].sort() };
  });
  for (const i of d.inputs) if (i.required && !given.has(i.factPath)) throw new TaxEngineError('TAX_ENGINE_REQUIRED_INPUT_MISSING', i.factPath);
  const param = (key: string) => {
    const p = d.parameters.find(x => x.key === key && x.filingStatus !== undefined && x.filingStatus === request.filingStatus) ?? d.parameters.find(x => x.key === key && x.filingStatus === undefined);
    if (!p) throw new TaxEngineError('TAX_ENGINE_PARAMETER_MISSING', key + (request.filingStatus ? ' for ' + request.filingStatus : ''));
    return p;
  };
  const results = new Map<string, TaxDecimal>(); const trace: TraceStep[] = [];
  for (const s of d.steps) {
    const args = s.args.map(a => {
      const kind = a.slice(0, a.indexOf(':')), ref = a.slice(a.indexOf(':') + 1);
      if (kind === 'input') return { ref: a, value: given.get(ref) ?? TaxDecimal.parse('0') };
      if (kind === 'param') { const p = param(ref); return { ref: a, value: TaxDecimal.parse(p.value), sourceId: p.sourceId, citation: p.citation }; }
      if (kind === 'step') return { ref: a, value: results.get(ref)! };
      return { ref: a, value: TaxDecimal.parse(ref) };
    });
    const v = args.map(x => x.value); const mode = s.rounding ?? 'HALF_UP';
    let r: TaxDecimal;
    switch (s.op) {
      case 'sum': r = v.reduce((acc, x) => acc.add(x)); break;
      case 'subtract': r = v[0].subtract(v[1]); break;
      case 'multiply': r = v[0].multiply(v[1]).round(s.scale!, mode); break;
      case 'min': r = v.reduce((acc, x) => (x.compare(acc) < 0 ? x : acc)); break;
      case 'max': r = v.reduce((acc, x) => (x.compare(acc) > 0 ? x : acc)); break;
      case 'floor_zero': r = v[0].isNegative() ? TaxDecimal.parse('0') : v[0]; break;
      case 'round': r = v[0].round(s.scale!, mode); break;
    }
    results.set(s.id, r!);
    trace.push({ stepId: s.id, op: s.op, args: args.map(x => ({ ref: x.ref, value: x.value.toFixed(), ...('sourceId' in x ? { sourceId: x.sourceId, citation: x.citation } : {}) })),
      result: r!.toFixed(), explanation: s.explanation });
  }
  const outputs = Object.fromEntries(d.outputs.map(o => [o.key, results.get(o.step)!.toFixed()]));
  const inputHash = sha256(canonicalJson({ filingStatus: request.filingStatus ?? null, inputs: normalizedInputs }));
  return { engineVersion: TAX_ENGINE_VERSION, ruleSetHash: definitionHash(d), inputHash, outputHash: sha256(canonicalJson({ outputs, trace })), outputs, trace,
    inputs: normalizedInputs, filingStatus: request.filingStatus ?? null };
}
