class NotificationOrchestratorService {
  private preferences = new Map<string, any>();

  getUserNotifications(_tenantId?: string, _userId?: string, _options?: any): any[] {
    return [];
  }

  dispatch(..._args: any[]): any {
    return {
      dispatched: false,
      status: 'UNAVAILABLE',
      reason: 'Notification delivery provider is not configured.',
    };
  }

  getUserPreferences(tenantId: string, userId: string): any {
    return (
      this.preferences.get(`${tenantId}:${userId}`) ?? {
        tenantId,
        userId,
        emailEnabled: true,
        inAppEnabled: true,
        smsEnabled: false,
      }
    );
  }

  setUserPreferences(
    tenantIdOrPrefs: string | Record<string, any>,
    userId?: string,
    prefs?: Record<string, any>
  ): any {
    const resolvedTenantId =
      typeof tenantIdOrPrefs === 'string' ? tenantIdOrPrefs : String(tenantIdOrPrefs.tenantId || '');
    const resolvedUserId =
      typeof tenantIdOrPrefs === 'string' ? String(userId || '') : String(tenantIdOrPrefs.userId || '');
    const incoming = typeof tenantIdOrPrefs === 'string' ? prefs || {} : tenantIdOrPrefs;
    const next = {
      ...this.getUserPreferences(resolvedTenantId, resolvedUserId),
      ...incoming,
      tenantId: resolvedTenantId,
      userId: resolvedUserId,
      updatedAt: new Date().toISOString(),
    };
    this.preferences.set(`${resolvedTenantId}:${resolvedUserId}`, next);
    return next;
  }
}

export const globalNotificationOrchestratorService = new NotificationOrchestratorService();
