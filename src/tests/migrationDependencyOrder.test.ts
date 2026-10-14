import { expect,it } from 'vitest';
import { dependencyOrder } from '../../scripts/staging/migration-order.mjs';
const a='docs/proposed-migrations/20261015020000_a.sql',b='docs/proposed-migrations/20261015010000_b.sql';
it('honors prerequisites even when timestamp/name order disagrees',()=>{
 expect(dependencyOrder([{file:b,dependsOn:[a]},{file:a,dependsOn:[]}]).map(e=>e.file)).toEqual([a,b]);
});
it('rejects cycles, missing files, duplicates and protected/traversal paths',()=>{
 expect(()=>dependencyOrder([{file:a,dependsOn:[b]},{file:b,dependsOn:[a]}])).toThrow('MIGRATION_DEPENDENCY_CYCLE');
 expect(()=>dependencyOrder([{file:a,dependsOn:[b]}])).toThrow('MIGRATION_DEPENDENCY_MISSING');
 expect(()=>dependencyOrder([{file:a,dependsOn:[]},{file:a,dependsOn:[]}])).toThrow('MIGRATION_PLAN_INVALID');
 expect(()=>dependencyOrder([{file:'../private.sql',dependsOn:[]}])).toThrow('MIGRATION_PLAN_INVALID');
});
