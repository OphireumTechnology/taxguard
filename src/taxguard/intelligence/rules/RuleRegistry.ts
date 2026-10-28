import type { RuleDefinition } from '../types';

/**
 * TG-CORE-002 — Deterministic Rule Registry
 *
 * Stores versioned deterministic tax-rule definitions.
 *
 * AI-generated reasoning must never be registered here as a
 * deterministic rule unless it has gone through the authorized
 * rule-governance process.
 */
export class RuleRegistry {
  private static readonly rules = new Map<string, RuleDefinition>();

  public static register(rule: RuleDefinition): RuleDefinition {
    if (!rule.ruleId.trim()) {
      throw new Error('Rule requires ruleId.');
    }

    if (!rule.ruleCode.trim()) {
      throw new Error('Rule requires ruleCode.');
    }

    if (!rule.name.trim()) {
      throw new Error('Rule requires name.');
    }

    if (!rule.jurisdiction.trim()) {
      throw new Error('Rule requires jurisdiction.');
    }

    if (!rule.version.trim()) {
      throw new Error('Rule requires version.');
    }

    if (!rule.deterministic) {
      throw new Error(
        'Only deterministic rules may be registered in RuleRegistry.'
      );
    }

    if (rule.authoritySourceIds.length === 0) {
      throw new Error(
        'Deterministic rule requires at least one authority source.'
      );
    }

    if (this.rules.has(rule.ruleId)) {
      throw new Error(`Rule already registered: ${rule.ruleId}`);
    }

    const stored: RuleDefinition = {
      ...rule,
      taxYears: [...rule.taxYears],
      authoritySourceIds: [...rule.authoritySourceIds],
    };

    this.rules.set(stored.ruleId, stored);

    return this.clone(stored);
  }

  public static get(ruleId: string): RuleDefinition | undefined {
    const rule = this.rules.get(ruleId);

    return rule ? this.clone(rule) : undefined;
  }

  public static getAll(): RuleDefinition[] {
    return Array.from(this.rules.values()).map(rule =>
      this.clone(rule)
    );
  }

  public static getActive(): RuleDefinition[] {
    return this.getAll().filter(rule => rule.isActive);
  }

  public static findForTaxYear(taxYear: number): RuleDefinition[] {
    return this.getActive().filter(rule =>
      rule.taxYears.includes(taxYear)
    );
  }

  public static findByCode(ruleCode: string): RuleDefinition[] {
    return this.getAll().filter(
      rule => rule.ruleCode === ruleCode
    );
  }

  public static deactivate(ruleId: string): RuleDefinition {
    const existing = this.rules.get(ruleId);

    if (!existing) {
      throw new Error(`Rule not found: ${ruleId}`);
    }

    const updated: RuleDefinition = {
      ...existing,
      isActive: false,
      updatedAt: new Date().toISOString(),
    };

    this.rules.set(ruleId, updated);

    return this.clone(updated);
  }

  public static clear(): void {
    this.rules.clear();
  }

  private static clone(rule: RuleDefinition): RuleDefinition {
    return {
      ...rule,
      taxYears: [...rule.taxYears],
      authoritySourceIds: [...rule.authoritySourceIds],
    };
  }
}