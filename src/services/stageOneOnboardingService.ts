const DOSSIER_KEY_PREFIX = 'tg_dossier_';
let activeClientIdMem: string | null = null;

export class StageOneOnboardingService {
  static getActiveClientId(): string | null {
    if (activeClientIdMem) return activeClientIdMem;
    if (typeof window !== 'undefined') {
      return localStorage.getItem('tg_active_client_id') || null;
    }
    return null;
  }

  static setActiveClientId(id: string): void {
    activeClientIdMem = id;
    if (typeof window !== 'undefined') {
      localStorage.setItem('tg_active_client_id', id);
    }
  }

  static getDossier(clientId: string): any {
    if (typeof window !== 'undefined') {
      try {
        const raw = localStorage.getItem(`${DOSSIER_KEY_PREFIX}${clientId}`);
        if (raw) return JSON.parse(raw);
      } catch {
        // Fallback
      }
    }
    return null;
  }

  static createInitialDossier(data: any): any {
    const dossier = {
      clientId: data.clientId,
      tinType: data.tinType || 'SSN',
      status: 'DRAFT',
      step: 1,
      ...data,
    };
    this.saveDossier(dossier);
    return dossier;
  }

  static saveDossier(dossier: any): void {
    if (typeof window !== 'undefined' && dossier?.clientId) {
      try {
        localStorage.setItem(`${DOSSIER_KEY_PREFIX}${dossier.clientId}`, JSON.stringify(dossier));
      } catch {
        // Fallback
      }
    }
  }

  static maskTIN(cleaned: string, tinType = 'SSN'): { masked: string; last4: string } {
    const digits = (cleaned || '').replace(/\D/g, '');
    const last4 = digits.slice(-4) || '0000';
    const masked = tinType === 'EIN' ? `XX-XXX${last4}` : `XXX-XX-${last4}`;
    return { masked, last4 };
  }

  static runDuplicateCheck(_dossier: any): { isDuplicate: boolean; matches?: any[] } {
    return { isDuplicate: false, matches: [] };
  }

  static evaluateReadiness(_dossier: any): { ready: boolean; missingFields: string[] } {
    return { ready: true, missingFields: [] };
  }

  static passHardExitGate(clientId: string): { success: boolean } {
    if (typeof window !== 'undefined') {
      localStorage.setItem(`tg_gate_passed_${clientId}`, 'true');
    }
    return { success: true };
  }

  static resolveDuplicateReview(dossier: any, _action?: string): any {
    return dossier;
  }

  static hasPassedHardExitGate(clientId?: string, user?: any): boolean {
    if (user?.onboardingStatus === 'COMPLETED' || user?.onboardingStatus === 'approved') return true;
    if (user?.onboardingCompletedAt) return true;
    if (!clientId) return false;
    if (typeof window !== 'undefined') {
      return localStorage.getItem(`tg_gate_passed_${clientId}`) === 'true';
    }
    return false;
  }

  static clearSensitiveClientData(): void {
    if (typeof window !== 'undefined') {
      try {
        const keys = Object.keys(localStorage);
        for (const k of keys) {
          if (k.startsWith(DOSSIER_KEY_PREFIX)) {
            localStorage.removeItem(k);
          }
        }
      } catch {
        // Fallback
      }
    }
  }

  static restoreDossierFromUser(user: any): any {
    if (!user?.clientId) return null;
    let dossier = this.getDossier(user.clientId);
    if (!dossier) {
      dossier = this.createInitialDossier({
        clientId: user.clientId,
        name: user.name,
        email: user.email,
        phone: user.phone,
        clientType: user.clientType || 'individual',
      });
    }
    return dossier;
  }
}
