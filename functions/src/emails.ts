import { Resend } from 'resend';
import * as admin from 'firebase-admin';

export interface EmailPayload {
  to: string;
  subject: string;
  html: string;
  category: 'welcome' | 'appointment' | 'document' | 'invoice' | 'alert';
}

export async function sendTransactionalEmail(payload: EmailPayload): Promise<{ success: boolean; id?: string; notice?: string }> {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    console.warn(`[Resend Email] RESEND_API_KEY not configured. Mocking delivery for category: ${payload.category} to ${payload.to}`);
    // Record audit event for email requirement
    try {
      await admin.firestore().collection('auditLogs').add({
        action: 'EMAIL_QUEUED_MOCK',
        actorId: 'system',
        targetResource: 'email',
        metadata: JSON.stringify({ to: payload.to, subject: payload.subject, category: payload.category }),
        createdAt: admin.firestore.FieldValue.serverTimestamp()
      });
    } catch (e) {
      // ignore
    }
    return { success: false, notice: 'Resend API key configuration required.' };
  }

  try {
    const resend = new Resend(apiKey);
    const result = await resend.emails.send({
      from: 'A/R Tax Services <notifications@artaxservices.com>',
      to: payload.to,
      subject: payload.subject,
      html: payload.html
    });

    return { success: true, id: result.data?.id };
  } catch (error: any) {
    console.error('[Resend Error]', error);
    return { success: false, notice: error.message };
  }
}
