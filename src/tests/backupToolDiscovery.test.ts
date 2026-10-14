import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { expect,it } from 'vitest';
import { discoverBackupTools,backupToolMajor } from '../../scripts/staging/backup-tools.mjs';
it('discovers only existing compatible-tool candidates and refuses missing explicit paths',()=>{
  const root=fs.mkdtempSync(path.join(os.tmpdir(),'taxguard-backup-tools-test-'));
  try {
    for (const name of ['pg_dump.exe','pg_restore.exe']) fs.writeFileSync(path.join(root,name),'synthetic fixture; never executed');
    expect(discoverBackupTools({PATH:root,ProgramFiles:root},'win32')).toEqual({dump:fs.realpathSync(path.join(root,'pg_dump.exe')),restore:fs.realpathSync(path.join(root,'pg_restore.exe'))});
    expect(discoverBackupTools({PATH:root,TAXGUARD_PG_DUMP_BIN:'relative.exe',ProgramFiles:root},'win32').dump).toBeNull();
    expect(backupToolMajor('pg_dump (PostgreSQL) 17.10')).toBe(17);
    expect(backupToolMajor('unknown')).toBeNull();
  } finally { const absolute=path.resolve(root); if (!absolute.startsWith(path.resolve(os.tmpdir())+path.sep)||!path.basename(absolute).startsWith('taxguard-backup-tools-test-')) throw new Error('TEST_CLEANUP_PATH_DENIED'); fs.rmSync(absolute,{recursive:true,force:true}); }
});
