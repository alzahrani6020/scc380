const { test } = require('node:test');
const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const { join } = require('node:path');
const vm = require('node:vm');

const page = readFileSync(join(__dirname, '../src/app/dashboard/hr/governance/[category]/page.tsx'), 'utf8');
const start = page.indexOf('  useEffect(()=>{\n    setContracts([]);');
const end = page.indexOf('  const submit = async', start);
assert.ok(start >= 0 && end > start, 'Contract-loading effect must be present');
const effect = page.slice(start, end).trim();
assert.match(effect, /^useEffect\(/);

function deferred() {
  let resolve, reject;
  const promise = new Promise((a, b) => { resolve = a; reject = b; });
  return { promise, resolve, reject };
}

function harness() {
  let contracts = [];
  const requests = [];
  const setContracts = value => { contracts = value; };
  function changeEmployee(employeeId) {
    let cleanup;
    vm.runInNewContext(effect, {
      useEffect: fn => { cleanup = fn(); },
      form: { employeeId },
      setContracts,
      api: { get: (url, options) => {
        const request = deferred();
        requests.push({ url, signal: options.signal, ...request });
        return request.promise;
      } },
      AbortController,
      encodeURIComponent
    }, { timeout: 1000 });
    return cleanup;
  }
  return { changeEmployee, requests, getContracts: () => contracts };
}

const flush = () => new Promise(resolve => setImmediate(resolve));

test('switching employees ignores out-of-order contract responses', async () => {
  const h = harness();
  const cleanupA = h.changeEmployee('employee-A');
  assert.match(h.requests[0].url, /employeeId=employee-A/);
  cleanupA();
  assert.equal(h.requests[0].signal.aborted, true);
  const cleanupB = h.changeEmployee('employee-B');
  h.requests[1].resolve({ data: { data: [{ id: 'contract-B' }] } });
  await flush();
  assert.equal(h.getContracts()[0].id, 'contract-B');
  h.requests[0].resolve({ data: { data: [{ id: 'contract-A' }] } });
  await flush();
  assert.equal(h.getContracts()[0].id, 'contract-B', 'Stale employee A must not overwrite employee B');
  cleanupB();
});

test('a late failed request cannot erase current employee contracts', async () => {
  const h = harness();
  const cleanupA = h.changeEmployee('A');
  cleanupA();
  h.changeEmployee('B');
  h.requests[1].resolve({ data: { data: [{ id: 'B-contract' }] } });
  await flush();
  h.requests[0].reject(new Error('network failure after abort'));
  await flush();
  assert.equal(h.getContracts()[0].id, 'B-contract');
});

test('clearing employee selection removes contracts and cancels prior request', async () => {
  const h = harness();
  const cleanup = h.changeEmployee('A');
  cleanup();
  const emptyCleanup = h.changeEmployee('');
  assert.equal(h.getContracts().length, 0);
  assert.equal(h.requests[0].signal.aborted, true);
  assert.equal(h.requests.length, 1);
  assert.equal(emptyCleanup, undefined);
});

test('selecting a new employee clears the previous contract id', () => {
  assert.match(page, /employeeId:value,contractId:''/);
  assert.match(page, /await api\.post\('\/hr\/governance',\{\.\.\.form,contractId:form\.contractId\|\|undefined,category:space\.category\}\)/);
});
