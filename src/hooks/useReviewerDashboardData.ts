import { useEffect, useState } from 'react';
import { api, getStoredToken } from '../services/api';
import type { User } from '../types';
import type { ReviewerQueueCase, ReviewerSnapshot } from '../types/reviewerDashboard';
import { reviewerAccess, safeReviewQueue, sameReviewScope } from '../components/workspace/reviewerDashboardModel';
type ReadState<T> = { key: string; status: 'loading' | 'ready' | 'error'; data: T; error: string };
export function useReviewerDashboardData(user: User | null, auth: string, selectedId: string, refresh: number) {
  const allowed = reviewerAccess(user, auth);
  const sessionKey = allowed ? JSON.stringify([user!.id, user!.tenantId, user!.role, getStoredToken(), user!.authorizedClientIds]) : '';
  const queueKey = sessionKey + ':' + refresh;
  const [queue, setQueue] = useState<ReadState<ReviewerQueueCase[]>>({key:'', status:'loading', data:[], error:''});
  const [snapshot, setSnapshot] = useState<ReadState<ReviewerSnapshot | null>>({key:'', status:'loading', data:null, error:''});
  useEffect(() => {
    if (!allowed) { setQueue({key:'',status:'loading',data:[],error:''}); return; }
    const abort = new AbortController(); let live = true;
    setQueue({key:queueKey,status:'loading',data:[],error:''});
    api.reviewer.getDashboard(abort.signal).then(result => {
      if(live) setQueue({key:queueKey,status:'ready',data:safeReviewQueue(result.cases,user!.tenantId!,user!.id),error:''});
    }).catch(() => {if(live)setQueue({key:queueKey,status:'error',data:[],error:'The authorized review queue could not be loaded. Retry to restore access.'});});
    return () => {live=false;abort.abort();};
  }, [queueKey, allowed]);
  const visibleQueue = allowed && queue.key === queueKey ? queue : {key:queueKey,status:'loading' as const,data:[],error:''};
  const selected = visibleQueue.data.find(row => row.id === selectedId);
  const caseKey = selected ? queueKey + ':' + selected.id : '';
  useEffect(() => {
    if (!allowed || !selected) { setSnapshot({key:'',status:'loading',data:null,error:''}); return; }
    const abort = new AbortController(); let live = true;
    setSnapshot({key:caseKey,status:'loading',data:null,error:''});
    api.reviewer.getWorkspace(selected.scope,abort.signal).then(result => {
      if(!sameReviewScope(result.scope,selected.scope) || result.case.reviewerUid !== user!.id) throw Error('SCOPE_MISMATCH');
      if(live)setSnapshot({key:caseKey,status:'ready',data:result,error:''});
    }).catch(() => {if(live)setSnapshot({key:caseKey,status:'error',data:null,error:'This case workspace is unavailable or access changed. No fallback case is displayed.'});});
    return () => {live=false;abort.abort();};
  }, [caseKey, allowed]);
  const visibleSnapshot = allowed && selected && snapshot.key === caseKey ? snapshot : {key:caseKey,status:'loading' as const,data:null,error:''};
  return { allowed, queue:visibleQueue, selected, snapshot:visibleSnapshot, caseKey, sessionKey };
}
