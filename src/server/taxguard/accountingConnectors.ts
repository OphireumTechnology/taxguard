export interface AccountingConnectorInfo {
  type: string;
  name: string;
  status: 'NOT_CONFIGURED';
  configured: boolean;
}

const CONNECTORS: AccountingConnectorInfo[] = [
  { type: 'quickbooks', name: 'QuickBooks Online', status: 'NOT_CONFIGURED', configured: false },
  { type: 'xero', name: 'Xero', status: 'NOT_CONFIGURED', configured: false },
  { type: 'wave', name: 'Wave Accounting', status: 'NOT_CONFIGURED', configured: false },
];

export class ConnectorRegistry {
  static getAllConnectors(): AccountingConnectorInfo[] {
    return [...CONNECTORS];
  }

  static getConnector(type: string): any {
    const found = CONNECTORS.find((c) => c.type === String(type || '').toLowerCase());
    if (!found) return null;
    return {
      ...found,
      getAuthorizationUrl: () => {
        throw new Error('ACCOUNTING_CONNECTOR_NOT_CONFIGURED');
      },
      exchangeCode: async () => {
        throw new Error('ACCOUNTING_CONNECTOR_NOT_CONFIGURED');
      },
      syncAccounts: async () => {
        throw new Error('ACCOUNTING_CONNECTOR_NOT_CONFIGURED');
      },
    };
  }
}
