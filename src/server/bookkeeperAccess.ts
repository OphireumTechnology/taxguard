// New roles receive no legacy tax or administrative authority by default.
export function bookkeeperRequestAllowed(role:string,method:string,url:string):boolean {
  if(role!=='bookkeeper')return true;
  const path=url.split('?')[0];
  return (method==='GET' && ['/api/bookkeeping/bookkeeper-clients','/api/bookkeeping/bookkeeper-dashboard','/api/auth/me','/api/auth/session'].includes(path)) || (method==='POST' && path==='/api/auth/logout');
}
