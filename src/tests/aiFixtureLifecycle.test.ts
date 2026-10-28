import { describe,expect,it,vi } from 'vitest';
import { PGlite } from '@electric-sql/pglite';
import { capabilityFixture } from './aiCapabilities.fixture';

describe('owned AI database fixture lifecycle',()=>{
  it('closes its database if setup fails before ownership reaches afterAll',async()=>{
    const pg=new PGlite();
    await pg.waitReady;
    const close=vi.spyOn(pg,'close');
    vi.spyOn(pg,'exec').mockRejectedValueOnce(new Error('Synthetic fixture setup failure'));
    try {
      await expect(capabilityFixture(()=>pg)).rejects.toThrow('Synthetic fixture setup failure');
      expect(close).toHaveBeenCalledTimes(1);
      expect(pg.closed).toBe(true);
    } finally {
      if(!pg.closed)await pg.close();
      vi.restoreAllMocks();
    }
  });
});
