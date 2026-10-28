import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {it,expect} from 'vitest';
it('preserves all approved main SQL content while additions use new proposal identifiers',()=>{
 const map=JSON.parse(readFileSync('docs/development/phase11-historical-migration-preservation.json','utf8'));
 expect(map.baselineMain).toBe('5f1553c7d73445081d51635310173a53373694bf');expect(map.approvedFiles).toHaveLength(56);
 for(const entry of map.approvedFiles)expect(createHash('sha256').update(readFileSync(entry.file,'utf8').replace(/\r\n/g,'\n')).digest('hex'),entry.file).toBe(entry.sha256);
 expect(map.overlays).toEqual(['057','058']);
});
