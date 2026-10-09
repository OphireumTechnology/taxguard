import { Pool } from 'pg';
import { SupabaseDurableSessions } from '../../supabase-db';
import { GovernanceControlPlane } from './GovernanceControlPlane';
import { PgGovernanceDatabase, SqlGovernanceStore } from './SqlGovernanceStore';
import { GovernanceError } from './contracts';

let plane:GovernanceControlPlane|null=null;
/** No dev/in-memory fallback, model activation or migration execution. */
export function getProductionGovernance():GovernanceControlPlane {
  if(process.env.NODE_ENV!=='production'||process.env.TAXGUARD_AI_GOVERNANCE_ENABLED!=='true'||
    !process.env.DATABASE_URL||!process.env.SUPABASE_URL||!process.env.SUPABASE_SERVICE_ROLE_KEY||!process.env.TAXGUARD_TENANT_ID)throw new GovernanceError('AI_GOVERNANCE_UNAVAILABLE',503);
  if(!plane) {
    const pool=new Pool({connectionString:process.env.DATABASE_URL,ssl:{rejectUnauthorized:true},max:3,connectionTimeoutMillis:5000,idleTimeoutMillis:10000});
    pool.on('error',()=>console.warn('AI_GOVERNANCE_DATABASE_UNAVAILABLE'));
    const sessions=new SupabaseDurableSessions();
    plane=new GovernanceControlPlane({verify:async token=>{
      // Only live durable tokens: never session fallback or browser-supplied User objects.
      if(!/^tg_live_[a-f0-9]{64}$/.test(token))return null;
      const user=await sessions.verify(token);
      return user&&user.status==='active'&&user.tenantId===process.env.TAXGUARD_TENANT_ID?{uid:user.id,tenant_id:user.tenantId}:null;
    }},new SqlGovernanceStore(new PgGovernanceDatabase(pool)));
  }
  return plane;
}
