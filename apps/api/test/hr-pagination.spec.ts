import { test } from 'node:test';
import assert from 'node:assert/strict';
import { pagedResult, parsePagination } from '../src/hr/pagination';

test('HR pagination keeps legacy default and clamps unsafe values', () => {
  assert.deepEqual(parsePagination({}), { page: 1, limit: 200, skip: 0 });
  assert.deepEqual(parsePagination({ page: '3', limit: '25' }), { page: 3, limit: 25, skip: 50 });
  assert.deepEqual(parsePagination({ page: '-4', limit: '9999' }), { page: 1, limit: 200, skip: 0 });
  assert.deepEqual(parsePagination({ page: 'x', limit: '0' }), { page: 1, limit: 1, skip: 0 });
});

test('HR pagination result exposes total pages without zero-page states', () => {
  assert.deepEqual(pagedResult(['a'], 51, 2, 25), {
    data: ['a'],
    count: 51,
    page: 2,
    limit: 25,
    totalPages: 3,
  });
  assert.equal(pagedResult([], 0, 1, 25).totalPages, 1);
});
