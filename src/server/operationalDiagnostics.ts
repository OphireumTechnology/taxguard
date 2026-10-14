import type { Response,NextFunction } from 'express';
import type { AuthenticatedRequest } from './auth';
import { sessionAssuranceLevel } from './staffMfa';
/** Runs after session verification and before any infrastructure probe. */
export function requireOperationalAdministrator(req:AuthenticatedRequest,res:Response,next:NextFunction){
 res.setHeader('Cache-Control','no-store');
 if(!req.user)return res.status(401).json({code:'AUTH_REQUIRED'});
 if(req.user.status!=='active'||!req.user.tenantId||!['admin','administrator','super_admin','super_administrator'].includes(req.user.role))return res.status(403).json({code:'DIAGNOSTICS_ACCESS_DENIED'});
 if(sessionAssuranceLevel(req.user)!=='aal2')return res.status(403).json({code:'STAFF_MFA_REQUIRED'});
 next();
}
