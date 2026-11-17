import { Pool } from 'pg';
import { SupabaseDurableSessions } from '../../supabase-db';
import { GovernanceControlPlane } from './GovernanceControlPlane';
import { KillSwitchService } from './KillSwitchService';
import { ControlCenterReadService } from './ControlCenterReadService';
import { PgGovernanceDatabase, SqlGovernanceStore } from './SqlGovernanceStore';
import { GovernanceError, type SessionAuthority } from './contracts';

let shared:{db:PgGovernanceDatabase;sessions:SessionAuthority}|null=null;
let plane:GovernanceControlPlane|null=null;
let killSwitches:KillSwitchService|null=null;
let controlCenter:ControlCenterReadService|null=null;

const LOOPBACK_HOSTS=['127.0.0.1','localhost','[::1]'];
/**
 * Production: DATABASE_URL over verified TLS. Outside production only: an explicitly configured
 * loopback database (TAXGUARD_AI_GOVERNANCE_LOCAL_DATABASE_URL) so a disposable local PostgreSQL can
 * exercise the same SQL store and session verification. Never both, never a remote host locally.
 */
export function governanceDatabaseTarget(env:Readonly<Record<string,string|undefined>>=process.env):{url:string;tls:boolean}|null {
  if(env.NODE_ENV==='production') return env.DATABASE_URL?{url:env.DATABASE_URL,tls:true}:null;
  const local=env.TAXGUARD_AI_GOVERNANCE_LOCAL_DATABASE_URL;
  if(!local) return null;
  try { const u=new URL(local); return ['postgres:','postgresql:'].includes(u.protocol)&&LOOPBACK_HOSTS.includes(u.hostname)?{url:local,tls:false}:null; }
  catch { return null; }
}

/** No in-memory fallback, model activation or migration execution. */
function productionResources() {
  const target=governanceDatabaseTarget();
  if(!target||process.env.TAXGUARD_AI_GOVERNANCE_ENABLED!=='true'||
    !process.env.SUPABASE_URL||!process.env.SUPABASE_SERVICE_ROLE_KEY||!process.env.TAXGUARD_TENANT_ID)throw new GovernanceError('AI_GOVERNANCE_UNAVAILABLE',503);
  if(!shared) {
    const pool=new Pool({connectionString:target.url,...(target.tls?{ssl:{rejectUnauthorized:true}}:{}),max:3,connectionTimeoutMillis:5000,idleTimeoutMillis:10000});
    pool.on('error',()=>console.warn('AI_GOVERNANCE_DATABASE_UNAVAILABLE'));
    const durable=new SupabaseDurableSessions();
    shared={db:new PgGovernanceDatabase(pool),sessions:{verify:async token=>{
      // Only live durable tokens: never session fallback or browser-supplied User objects.
      if(!/^tg_live_[a-f0-9]{64}$/.test(token))return null;
      const user=await durable.verify(token);
      return user&&user.status==='active'&&user.tenantId===process.env.TAXGUARD_TENANT_ID?{uid:user.id,tenant_id:user.tenantId}:null;
    }}};
  }
  return shared;
}

export function getProductionGovernance():GovernanceControlPlane {
  const {db,sessions}=productionResources();
  if(!plane)plane=new GovernanceControlPlane(sessions,new SqlGovernanceStore(db));
  return plane;
}

export function getProductionKillSwitches():KillSwitchService {
  const {db,sessions}=productionResources();
  if(!killSwitches)killSwitches=new KillSwitchService(sessions,db);
  return killSwitches;
}

export function getProductionControlCenter():ControlCenterReadService {
  const {db,sessions}=productionResources();
  if(!controlCenter)controlCenter=new ControlCenterReadService(sessions,db);
  return controlCenter;
}
