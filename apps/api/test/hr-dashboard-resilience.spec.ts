import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { test } from 'node:test';
import assert from 'node:assert/strict';

const source = (path: string) => readFileSync(join(process.cwd(), path), 'utf8');

test('HR dashboard isolates individual database reads while preserving tenant filters', () => {
  const service = source('src/hr/dashboard.service.ts');
  assert.match(service, /Promise\.allSettled\(\[/);
  assert.match(service, /tenantWhere\(tenantId\)/);
  assert.match(service, /result\.status === 'fulfilled' \? result\.value : null/);
  assert.match(service, /unavailableMetrics/);
  assert.match(service, /Logger\.warn\('HR dashboard query failures:/);
  assert.doesNotMatch(service, /\] = await Promise\.all\(\[/);
});

test('HR dashboard does not report fabricated payroll totals after a failed query', () => {
  const service = source('src/hr/dashboard.service.ts');
  assert.match(service, /records: payrollAggregate\?\._count\?\._all \?\? null/);
  assert.match(service, /netTotal: payrollAggregate \? Number\(payrollAggregate\._sum\.netSalary \|\| 0\) : null/);
});
