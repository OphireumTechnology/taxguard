import { useEffect, useState } from 'react';
import { api, getStoredToken } from '../services/api';
import type { Appointment, DocumentItem, Engagement, Invoice, Message, User } from '../types';
import type { GeneratedDocumentRequirement, StoredQuestionnaireRecord } from '../server/taxguard/taxQuestionnaire';
import { ClientDashboardData, ClientScope, DashboardRequest, Resource, emptyDashboardData, scopeAppointments, scopeDocuments, scopeEngagements, scopeInvoices, scopeMessages, scopeRequests, scopeRequirements, validClientScope } from '../components/portal/dashboard/clientDashboardModel';

export function useClientDashboardData(user: User | null, authState: string, clientId: string, taxYear: number, refreshVersion = 0) {
  // Cached reads belong to the exact authenticated session, not just the client identity.
  const key = JSON.stringify([user?.id, user?.tenantId, user?.clientId, user?.role, user?.status, authState, getStoredToken(), clientId, taxYear, refreshVersion]);
  const allowed = validClientScope(user, clientId, taxYear, authState);
  const [state, setState] = useState<{ key: string; data: ClientDashboardData }>({ key: '', data: emptyDashboardData() });
  useEffect(() => {
    if (!allowed || !user) {
      setState({ key, data: emptyDashboardData('unavailable') });
      return;
    }
    const scope: ClientScope = { userId: user.id, tenantId: user.tenantId!, clientId, taxYear };
    const controller = new AbortController();
    let active = true;
    setState({ key, data: emptyDashboardData() });
    const read = <T,>(resource: Parameters<typeof api.clientDashboard.read>[0]) => api.clientDashboard.read<T>(resource, clientId, taxYear, controller.signal);
    const resource = async <T,>(promise: Promise<T>): Promise<Resource<T>> => {
      try { return { status: 'ready', data: await promise }; } catch { return { status: 'unavailable', data: null }; }
    };
    void (async () => {
      const [docs, engagements, messages, appointments, invoices, questionnaire, requests] = await Promise.all([
        resource(read<{ documents: DocumentItem[] }>('documents')), resource(read<{ engagements: Engagement[] }>('engagements')),
        resource(read<{ messages: Message[] }>('messages')), resource(read<{ appointments: Appointment[] }>('appointments')),
        resource(read<{ invoices: Invoice[] }>('invoices')),
        resource(read<{ clientId: string; tenantId: string; taxYear: number; questionnaire: StoredQuestionnaireRecord | null }>('questionnaire')),
        resource(read<{ requests: DashboardRequest[] }>('requests')),
      ]);
      const mapList = <T, R>(input: Resource<R>, list: (data: R) => T[] | undefined, filter: (rows: T[]) => T[]): Resource<T[]> =>
        input.status === 'ready' && input.data && Array.isArray(list(input.data))
          ? { status: 'ready', data: filter(list(input.data)!) } : { status: 'unavailable', data: null };
      const q = questionnaire.data;
      const record = q?.questionnaire;
      const qValid = q?.clientId === clientId && q.taxYear === taxYear && q.tenantId === scope.tenantId;
      const qRecordValid = record?.clientId === clientId && record.taxYear === taxYear && record.tenantId === scope.tenantId;
      let requirements: Resource<GeneratedDocumentRequirement[]> = { status: 'unavailable', data: null };
      // Do not trigger the requirements endpoint's default/fabricated questionnaire path.
      if (qValid && qRecordValid) {
        const response = await resource(read<{ requirements: GeneratedDocumentRequirement[] }>('requirements'));
        requirements = mapList(response, value => value.requirements, rows => scopeRequirements(rows, scope));
      }
      const scopedEngagements = mapList(engagements, value => value.engagements, rows => scopeEngagements(rows, scope));
      const data: ClientDashboardData = {
        documents: mapList(docs, value => value.documents, rows => scopeDocuments(rows, scope)), engagements: scopedEngagements,
        messages: mapList(messages, value => value.messages, rows => scopeMessages(rows, scopedEngagements.data || [], scope)),
        appointments: mapList(appointments, value => value.appointments, rows => scopeAppointments(rows, scope)),
        invoices: mapList(invoices, value => value.invoices, rows => scopeInvoices(rows, scope)),
        requests: mapList(requests, value => value.requests, rows => scopeRequests(rows, scope)),
        questionnaire: { status: qValid && (!record || qRecordValid) ? 'ready' : 'unavailable', data: qRecordValid ? record! : null }, requirements,
      };
      if (active) setState({ key, data });
    })();
    return () => { active = false; controller.abort(); };
  }, [key, allowed, user?.id, user?.tenantId]);
  return !allowed ? emptyDashboardData('unavailable') : state.key === key ? state.data : emptyDashboardData();
}
