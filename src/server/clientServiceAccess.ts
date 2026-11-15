export function clientServiceRequestAllowed(role:string,method:string,url:string):boolean {
 if(role!=='operations')return true;
 const path=url.split('?')[0];
 return (method==='GET' && ['/api/operations/client-service/dashboard','/api/operations/client-service/search','/api/operations/client-service/conversation','/api/operations/client-service/request','/api/auth/me','/api/auth/session'].includes(path)) || (method==='POST'&&path==='/api/auth/logout');
}
