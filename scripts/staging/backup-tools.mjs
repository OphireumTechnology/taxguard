import fs from 'node:fs';
import path from 'node:path';
/** Offline discovery only: explicit paths, PATH, then standard PostgreSQL installation roots.
 * Never installs a package, reads a backup, starts a service or logs environment values. */
export function discoverBackupTools(env=process.env, platform=process.platform) {
  const suffix=platform==='win32'?'.exe':'';
  // Never execute worktree-local binaries selected through relative PATH entries.
  const roots=[...(env.PATH||'').split(path.delimiter).filter(root=>path.isAbsolute(root))];
  const base=platform==='win32'?path.join(env.ProgramFiles||'C:/Program Files','PostgreSQL'):null;
  if (base && path.isAbsolute(base) && fs.existsSync(base)) for (const version of fs.readdirSync(base).filter(n=>/^\d+$/.test(n)).sort((a,b)=>+b-+a)) roots.push(path.join(base,version,'bin'));
  const find=(explicit,name)=> {
    if (explicit) return path.isAbsolute(explicit)&&fs.existsSync(explicit)&&fs.statSync(explicit).isFile()?fs.realpathSync(explicit):null;
    for (const root of roots) { const file=path.resolve(root,name+suffix); if (fs.existsSync(file)&&fs.statSync(file).isFile()) return fs.realpathSync(file); }
    return null;
  };
  return {dump:find(env.TAXGUARD_PG_DUMP_BIN,'pg_dump'),restore:find(env.TAXGUARD_PG_RESTORE_BIN,'pg_restore')};
}
export function backupToolMajor(text) { const match=/\(PostgreSQL\)\s+(\d+)\./.exec(text); return match?+match[1]:null; }
