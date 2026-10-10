import { afterEach, describe, expect, it, vi } from 'vitest';
import { createServer } from 'node:http';
import type { AddressInfo } from 'node:net';
import { createProductionApp } from '../server/productionApp';

afterEach(()=>vi.unstubAllEnvs());
describe('AI-1 legacy extraction production release boundary',()=>{
  it.each(['/api/documents/upload','/api/documents/example/reprocess','/api/taxguard-ai/propose'])('does not release legacy sample extraction or disabled AI at %s',async route=>{
    vi.stubEnv('NODE_ENV','production');
    const server=createServer(createProductionApp());
    await new Promise<void>(resolve=>server.listen(0,'127.0.0.1',resolve));
    try {
      const response=await fetch(`http://127.0.0.1:${(server.address() as AddressInfo).port}${route}`,{method:'POST',headers:{'Content-Type':'application/json'},body:'{}'});
      expect(response.status).toBe(503);
      expect(await response.json()).toMatchObject({code:'API_NOT_RELEASED'});
    } finally { await new Promise<void>((resolve,reject)=>server.close(error=>error?reject(error):resolve())); }
  });
});
