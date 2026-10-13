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

/** No dev/in-memory fallback, model activation or migration execution. */
function productionResources() {
  if(process.env.NODE_ENV!=='production'||process.env.TAXGUARD_AI_GOVERNANCE_ENABLED!=='true'||
    !process.env.DATABASE_URL||!process.env.SUPABASE_URL||!process.env.SUPABASE_SERVICE_ROLE_KEY||!process.env.TAXGUARD_TENANT_ID)throw new GovernanceError('AI_GOVERNANCE_UNAVAILABLE',503);
  if(!shared) {
    const pool=new Pool({connectionString:process.env.DATABASE_URL,ssl:{rejectUnauthorized:true},max:3,connectionTimeoutMillis:5000,idleTimeoutMillis:10000});
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
