/** Explicit dependency ordering, never inferred from proposal numbers or timestamps. */
export function dependencyOrder(entries) {
  if (!Array.isArray(entries)) throw new Error('MIGRATION_PLAN_INVALID');
  const byFile=new Map();
  for(const entry of entries) {
    if(!entry || typeof entry.file!=='string' || !/^(supabase\/migrations|docs\/proposed-migrations)\/[A-Za-z0-9_]+\.sql$/.test(entry.file) || !Array.isArray(entry.dependsOn) || byFile.has(entry.file)) throw new Error('MIGRATION_PLAN_INVALID');
    byFile.set(entry.file,entry);
  }
  const visiting=new Set(),done=new Set(),ordered=[];
  const visit=file=> {
    if(done.has(file))return;
    if(visiting.has(file))throw new Error('MIGRATION_DEPENDENCY_CYCLE');
    const entry=byFile.get(file);if(!entry)throw new Error('MIGRATION_DEPENDENCY_MISSING');
    visiting.add(file);for(const dependency of entry.dependsOn)visit(dependency);visiting.delete(file);done.add(file);ordered.push(entry);
  };
  for(const entry of entries)visit(entry.file);
  return ordered;
}
