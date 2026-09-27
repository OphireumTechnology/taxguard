/**
 * Real-Time Telemetry & Security Monitoring Routes
 * Enterprise observability for frontend exceptions, API failures,
 * auth anomalies, Firebase function status, and email delivery telemetry.
 */

import { Router, Request, Response } from 'express';
import { db } from '../db';
import { authenticateToken, AuthenticatedRequest, requireRole } from '../auth';

export const monitoringRouter = Router();

// In-memory monitoring event store
interface MonitoringMetric {
  id: string;
  type: 'client_error' | 'api_failure' | 'auth_failure' | 'firebase_error' | 'email_failure' | 'suspicious_activity';
  message: string;
  details?: any;
  userId?: string;
  ipAddress?: string;
  timestamp: string;
  severity: 'info' | 'warning' | 'error' | 'critical';
}

const monitoringEvents: MonitoringMetric[] = [];
const MAX_MONITORING_EVENTS = 500;

function pushMonitoringEvent(event: Omit<MonitoringMetric, 'id' | 'timestamp'>): MonitoringMetric {
  const record: MonitoringMetric = {
    id: `mon_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
    timestamp: new Date().toISOString(),
    ...event
  };
  monitoringEvents.unshift(record);
  if (monitoringEvents.length > MAX_MONITORING_EVENTS) {
    monitoringEvents.pop();
  }
  return record;
}

// 1. Frontend Runtime Errors
monitoringRouter.post('/client-error', (req: Request, res: Response) => {
  const { message, stack, route, userAgent, incidentId } = req.body;
  const ip = req.ip || 'unknown';

  const record = pushMonitoringEvent({
    type: 'client_error',
    message: message || 'Unknown client runtime error',
    details: {
      route,
      incidentId,
      stackSnippet: typeof stack === 'string' ? stack.slice(0, 300) : undefined,
      userAgent: userAgent ? String(userAgent).slice(0, 150) : undefined
    },
    ipAddress: ip,
    severity: 'error'
  });

  db.logSecurityEvent({
    eventType: 'CLIENT_RUNTIME_ERROR',
    ipAddress: ip,
    details: `Client error on route "${route || 'unknown'}": ${(message || '').slice(0, 100)} (Incident: ${incidentId || record.id})`,
    severity: 'warning'
  });

  return res.status(200).json({ status: 'logged', id: record.id });
});

// 2. Failed API Requests
monitoringRouter.post('/api-failure', (req: Request, res: Response) => {
  const { endpoint, status, error, method } = req.body;
  const ip = req.ip || 'unknown';

  const record = pushMonitoringEvent({
    type: 'api_failure',
    message: `API request failed: ${method || 'GET'} ${endpoint || '/api'} -> HTTP ${status || 500}`,
    details: { endpoint, status, method, error: String(error || '').slice(0, 200) },
    ipAddress: ip,
    severity: status >= 500 ? 'error' : 'warning'
  });

  return res.status(200).json({ status: 'logged', id: record.id });
});

// 3. Authentication Failures
monitoringRouter.post('/auth-failure', (req: Request, res: Response) => {
  const { email, reason, attemptType } = req.body;
  const ip = req.ip || 'unknown';

  const record = pushMonitoringEvent({
    type: 'auth_failure',
    message: `Authentication failed for account: ${email || 'anonymous'} (${reason || 'invalid_credentials'})`,
    details: { email, reason, attemptType },
    ipAddress: ip,
    severity: 'warning'
  });

  db.logSecurityEvent({
    eventType: 'AUTH_FAILURE_TELEMETRY',
    ipAddress: ip,
    details: `Auth failure: ${attemptType || 'login'} for ${email || 'unknown'} - ${reason || 'unauthorized'}`,
    severity: 'warning'
  });

  return res.status(200).json({ status: 'logged', id: record.id });
});

// 4. Firebase Function Errors
monitoringRouter.post('/firebase-error', (req: Request, res: Response) => {
  const { functionName, code, message } = req.body;
  const ip = req.ip || 'unknown';

  const record = pushMonitoringEvent({
    type: 'firebase_error',
    message: `Firebase function failure [${functionName || 'unknown'}]: ${message || code || 'error'}`,
    details: { functionName, code, message: String(message || '').slice(0, 250) },
    ipAddress: ip,
    severity: 'error'
  });

  return res.status(200).json({ status: 'logged', id: record.id });
});

// 5. Failed Email Delivery
monitoringRouter.post('/email-failure', (req: Request, res: Response) => {
  const { recipient, template, error } = req.body;
  const ip = req.ip || 'unknown';

  const record = pushMonitoringEvent({
    type: 'email_failure',
    message: `Email dispatch delivery failed for: ${recipient || 'unknown'} (Template: ${template || 'standard'})`,
    details: { recipient, template, error: String(error || '').slice(0, 200) },
    ipAddress: ip,
    severity: 'error'
  });

  return res.status(200).json({ status: 'logged', id: record.id });
});

// 6. Suspicious Activity / Authorization Anomalies
monitoringRouter.post('/suspicious-activity', (req: Request, res: Response) => {
  const { activityType, targetResource, reason } = req.body;
  const ip = req.ip || 'unknown';

  const record = pushMonitoringEvent({
    type: 'suspicious_activity',
    message: `Suspicious activity detected: ${activityType || 'unauthorized_access'} on ${targetResource || 'resource'}`,
    details: { activityType, targetResource, reason },
    ipAddress: ip,
    severity: 'critical'
  });

  db.logSecurityEvent({
    eventType: 'SUSPICIOUS_ACCESS_ANOMALY',
    ipAddress: ip,
    details: `Suspicious activity: ${activityType} - ${reason}`,
    severity: 'critical'
  });

  return res.status(200).json({ status: 'logged', id: record.id });
});

// Admin Telemetry Dashboard Feed (Secured by Admin / Super Admin token)
monitoringRouter.get('/telemetry', authenticateToken, requireRole('admin', 'super_admin'), (req: AuthenticatedRequest, res: Response) => {
  const countsByType = {
    client_error: monitoringEvents.filter(e => e.type === 'client_error').length,
    api_failure: monitoringEvents.filter(e => e.type === 'api_failure').length,
    auth_failure: monitoringEvents.filter(e => e.type === 'auth_failure').length,
    firebase_error: monitoringEvents.filter(e => e.type === 'firebase_error').length,
    email_failure: monitoringEvents.filter(e => e.type === 'email_failure').length,
    suspicious_activity: monitoringEvents.filter(e => e.type === 'suspicious_activity').length
  };

  return res.json({
    status: 'healthy',
    activeServerTime: new Date().toISOString(),
    totalTracked: monitoringEvents.length,
    countsByType,
    recentEvents: monitoringEvents.slice(0, 50)
  });
});
