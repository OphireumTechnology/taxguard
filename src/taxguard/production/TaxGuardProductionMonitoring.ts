export type TaxGuardOperationalSeverity =
  | 'INFO'
  | 'WARNING'
  | 'ERROR'
  | 'CRITICAL';

export interface TaxGuardOperationalEvent {
  eventId: string;

  component: string;

  eventType: string;

  severity:
    TaxGuardOperationalSeverity;

  correlationId: string;

  occurredAt: string;

  containsSensitiveData:
    false;

  message: string;
}

export interface TaxGuardOperationalAlert {
  alertId: string;

  sourceEventId: string;

  severity:
    'ERROR' |
    'CRITICAL';

  requiresHumanResponse:
    true;

  createdAt: string;
}

function requireText(
  value: string,
  code: string
): string {

  const normalized =
    value.trim();

  if (!normalized) {
    throw new Error(code);
  }

  return normalized;
}

export class TaxGuardOperationalEventGuard {

  static validate(
    event:
      TaxGuardOperationalEvent
  ):
    TaxGuardOperationalEvent {

    requireText(
      event.eventId,
      'TG_MONITOR_EVENT_ID_REQUIRED'
    );

    requireText(
      event.component,
      'TG_MONITOR_COMPONENT_REQUIRED'
    );

    requireText(
      event.eventType,
      'TG_MONITOR_EVENT_TYPE_REQUIRED'
    );

    requireText(
      event.correlationId,
      'TG_MONITOR_CORRELATION_REQUIRED'
    );

    requireText(
      event.message,
      'TG_MONITOR_MESSAGE_REQUIRED'
    );

    if (
      event.containsSensitiveData
    ) {
      throw new Error(
        'TG_MONITOR_SENSITIVE_DATA_BLOCKED'
      );
    }

    if (
      !Number.isFinite(
        Date.parse(
          event.occurredAt
        )
      )
    ) {
      throw new Error(
        'TG_MONITOR_TIMESTAMP_INVALID'
      );
    }

    return Object.freeze({
      ...event
    });
  }
}

export class TaxGuardOperationalAlertEngine {

  static createAlert(
    event:
      TaxGuardOperationalEvent
  ):
    TaxGuardOperationalAlert | null {

    const validated =
      TaxGuardOperationalEventGuard
        .validate(
          event
        );

    if (
      validated.severity !==
        'ERROR' &&
      validated.severity !==
        'CRITICAL'
    ) {
      return null;
    }

    return Object.freeze({
      alertId:
        'alert-' +
        validated.eventId,

      sourceEventId:
        validated.eventId,

      severity:
        validated.severity,

      requiresHumanResponse:
        true,

      createdAt:
        new Date()
          .toISOString()
    });
  }
}

export interface TaxGuardProductionMetric {
  metricId: string;

  name: string;

  value: number;

  unit:
    'count' |
    'milliseconds' |
    'percent';

  recordedAt: string;
}

export class TaxGuardProductionMetricGuard {

  static validate(
    metric:
      TaxGuardProductionMetric
  ):
    TaxGuardProductionMetric {

    requireText(
      metric.metricId,
      'TG_METRIC_ID_REQUIRED'
    );

    requireText(
      metric.name,
      'TG_METRIC_NAME_REQUIRED'
    );

    if (
      !Number.isFinite(
        metric.value
      )
    ) {
      throw new Error(
        'TG_METRIC_VALUE_INVALID'
      );
    }

    if (
      metric.unit ===
        'percent' &&
      (
        metric.value < 0 ||
        metric.value > 100
      )
    ) {
      throw new Error(
        'TG_METRIC_PERCENT_INVALID'
      );
    }

    return Object.freeze({
      ...metric
    });
  }
}

export class TaxGuardProductionLoggingBoundary {

  static logPassword():
    never {

    throw new Error(
      'TG_LOG_PASSWORD_BLOCKED'
    );
  }

  static logSessionToken():
    never {

    throw new Error(
      'TG_LOG_SESSION_TOKEN_BLOCKED'
    );
  }

  static logPrivateKey():
    never {

    throw new Error(
      'TG_LOG_PRIVATE_KEY_BLOCKED'
    );
  }

  static logFullSsn():
    never {

    throw new Error(
      'TG_LOG_FULL_SSN_BLOCKED'
    );
  }
}
