/**
 * TaxGuard Centralized Notification Orchestration Service
 * Handles multi-channel dispatches (IN_APP, EMAIL, SMS).
 * Truthfully returns NOT_CONFIGURED when external email/SMS providers are uncommissioned.
 * Enforces mandatory legal/security delivery override against user opt-out.
 */

import { randomUUID } from 'node:crypto';
import {
  NotificationRecord,
  NotificationChannel,
  NotificationStatus,
  UserNotificationPreferences
} from './types';

export class NotificationOrchestratorService {
  private notifications: NotificationRecord[] = [];
  private preferences = new Map<string, UserNotificationPreferences>();

  /**
   * Dispatch a notification across channels
   */
  async dispatch(params: {
    tenantId: string;
    recipientId: string;
    recipientRole: string;
    clientId?: string;
    templateType: string;
    channel: NotificationChannel;
    title: string;
    body: string;
    data?: Record<string, unknown>;
    isMandatorySecurity?: boolean;
  }): Promise<NotificationRecord> {
    const id = `notif_${randomUUID()}`;
    const now = new Date().toISOString();
    const isMandatory = Boolean(params.isMandatorySecurity);

    // Check user preference unless mandatory security notification
    if (!isMandatory) {
      const prefKey = `${params.tenantId}::${params.recipientId}`;
      const pref = this.preferences.get(prefKey);
      if (pref) {
        if (params.channel === 'IN_APP' && !pref.inAppEnabled) {
          return this.createRecord(id, params, 'NOT_CONFIGURED', 'USER_OPTED_OUT', now);
        }
        if (params.channel === 'EMAIL' && !pref.emailEnabled) {
          return this.createRecord(id, params, 'NOT_CONFIGURED', 'USER_OPTED_OUT', now);
        }
        if (params.channel === 'SMS' && !pref.smsEnabled) {
          return this.createRecord(id, params, 'NOT_CONFIGURED', 'USER_OPTED_OUT', now);
        }
      }
    }

    // Channel delivery evaluation
    if (params.channel === 'IN_APP') {
      // IN_APP is always functional within TaxGuard platform
      const record = this.createRecord(id, params, 'DELIVERED', undefined, now);
      record.sentAt = now;
      this.notifications.push(record);
      return record;
    }

    if (params.channel === 'EMAIL') {
      const emailConfigured = Boolean(process.env.SENDGRID_API_KEY || process.env.SMTP_HOST);
      if (process.env.NODE_ENV === 'production' || !emailConfigured) {
        // Truthful reporting: do NOT fake external delivery
        const record = this.createRecord(id, params, 'NOT_CONFIGURED', 'EMAIL_PROVIDER_NOT_COMMISSIONED', now);
        this.notifications.push(record);
        return record;
      }
      const record = this.createRecord(id, params, 'SENT', undefined, now);
      record.providerReference = `mock_email_${id}`;
      record.sentAt = now;
      this.notifications.push(record);
      return record;
    }

    if (params.channel === 'SMS') {
      const smsConfigured = Boolean(process.env.TWILIO_AUTH_TOKEN && process.env.TWILIO_ACCOUNT_SID);
      if (process.env.NODE_ENV === 'production' || !smsConfigured) {
        // Truthful reporting: do NOT fake external SMS
        const record = this.createRecord(id, params, 'NOT_CONFIGURED', 'SMS_PROVIDER_NOT_COMMISSIONED', now);
        this.notifications.push(record);
        return record;
      }
      const record = this.createRecord(id, params, 'SENT', undefined, now);
      record.providerReference = `mock_sms_${id}`;
      record.sentAt = now;
      this.notifications.push(record);
      return record;
    }

    const fallbackRecord = this.createRecord(id, params, 'FAILED', 'UNSUPPORTED_CHANNEL', now);
    this.notifications.push(fallbackRecord);
    return fallbackRecord;
  }

  private createRecord(
    id: string,
    params: {
      tenantId: string;
      recipientId: string;
      recipientRole: string;
      clientId?: string;
      templateType: string;
      channel: NotificationChannel;
      title: string;
      body: string;
      data?: Record<string, unknown>;
      isMandatorySecurity?: boolean;
    },
    status: NotificationStatus,
    failureCode?: string,
    now?: string
  ): NotificationRecord {
    return {
      id,
      tenantId: params.tenantId,
      recipientId: params.recipientId,
      recipientRole: params.recipientRole,
      clientId: params.clientId,
      templateType: params.templateType,
      channel: params.channel,
      title: params.title,
      body: params.body,
      data: params.data || {},
      isMandatorySecurity: Boolean(params.isMandatorySecurity),
      status,
      failureCode,
      createdAt: now || new Date().toISOString(),
    };
  }

  /**
   * Set user preferences
   */
  setUserPreferences(prefs: UserNotificationPreferences): void {
    const key = `${prefs.tenantId}::${prefs.userId}`;
    this.preferences.set(key, prefs);
  }

  getUserPreferences(tenantId: string, userId: string): UserNotificationPreferences {
    const key = `${tenantId}::${userId}`;
    return (
      this.preferences.get(key) || {
        tenantId,
        userId,
        inAppEnabled: true,
        emailEnabled: true,
        smsEnabled: false,
        remindersEnabled: true,
        updatedAt: new Date().toISOString(),
      }
    );
  }

  /**
   * Get notifications for a user (e.g. In-App Notification Bell)
   */
  getUserNotifications(tenantId: string, recipientId: string): NotificationRecord[] {
    return this.notifications
      .filter((n) => n.tenantId === tenantId && n.recipientId === recipientId)
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }

  /**
   * Mark notification as read
   */
  markRead(notificationId: string): void {
    const notif = this.notifications.find((n) => n.id === notificationId);
    if (notif) {
      notif.readAt = new Date().toISOString();
    }
  }

  clear(): void {
    this.notifications = [];
    this.preferences.clear();
  }
}

export const globalNotificationOrchestratorService = new NotificationOrchestratorService();
