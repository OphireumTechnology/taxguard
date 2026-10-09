export function practiceManagerRequestAllowed(role:string,method:string,url:string):boolean {
  if(role!=='practice_manager')return true;
  const path=url.split('?')[0];
  return (method==='GET' && ['/api/operations/manager-dashboard','/api/auth/me','/api/auth/session'].includes(path)) || (method==='POST' && path==='/api/auth/logout');
}
