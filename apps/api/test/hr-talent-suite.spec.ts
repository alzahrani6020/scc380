import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { test } from 'node:test';
import assert from 'node:assert/strict';

const src=(p:string)=>readFileSync(join(process.cwd(),p),'utf8');

test('talent suite migration is additive and constrains workflow states',()=>{
 const m=src('../../packages/database/prisma/migrations/20261112203000_hr_talent_suite/migration.sql');
 for(const table of ['recruitment_job_openings','recruitment_candidates','performance_reviews','performance_goals','training_courses','training_sessions','training_enrollments']){
  assert.match(m,new RegExp('CREATE TABLE "'+table+'"'));
 }
 assert.match(m,/performance_goals_weight_check/);
 assert.match(m,/training_enrollments_status_check/);
 assert.doesNotMatch(m,/(^|\n)\s*DROP\s+/i);
 assert.doesNotMatch(m,/(^|\n)\s*TRUNCATE\s+/i);
 assert.doesNotMatch(m,/(^|\n)\s*DELETE\s+FROM\s+/i);
});

test('recruitment hiring is transactional and creates onboarding',()=>{
 const s=src('src/hr/recruitment.service.ts');
 assert.match(s,/prisma\.\$transaction/);
 assert.match(s,/status !== 'OFFER'/);
 assert.match(s,/defaultLifecycleTasks\('ONBOARDING'\)/);
 assert.match(s,/hrLifecycleCase\.create/);
 assert.match(s,/status: 'HIRED'/);
});

test('performance submission requires 100 percent weighted rated goals',()=>{
 const s=src('src/hr/performance.service.ts');
 assert.match(s,/Math\.abs\(totalWeight - 100\) > 0\.01/);
 assert.match(s,/goal\.rating === null/);
 assert.match(s,/money\(goal\.weight\) \* money\(goal\.rating\) \/ 100/);
 assert.match(s,/status: 'SUBMITTED'/);
});

test('training enforces capacity and certificate evidence',()=>{
 const s=src('src/hr/training.service.ts');
 assert.match(s,/Training session capacity is full/);
 assert.match(s,/certificateRequired/);
 assert.match(s,/Certificate evidence is required for this course/);
 assert.match(s,/Resolve pending enrollments before completing the training session/);
});

test('self performance and training resolve employee by explicit user link',()=>{
 assert.match(src('src/hr/performance.service.ts'),/employee\.findFirst\(\{ where: \{ \.\.\.tenantWhere\(tenantId\), userId \} \}\)/);
 assert.match(src('src/hr/training.service.ts'),/employee\.findFirst\(\{ where: \{ \.\.\.tenantWhere\(tenantId\), userId \} \}\)/);
});
