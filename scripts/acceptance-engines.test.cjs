// Self-contained regression test for acceptance engines. No production requests.
'use strict';
const assert = require('node:assert/strict');
const { test } = require('node:test');
const { createServer } = require('node:http');
const { spawnSync } = require('node:child_process');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const runner = path.join(__dirname, 'acceptance-engines.cjs');
test('read-only probes distinguish expected auth denials from missing routes', async () => {
  let broken = false;
  const server = createServer((req, res) => {
    const status = {
      '/': 200,
      '/api/auth/login': 400,
      '/api/auth/refresh': broken ? 404 : 401,
      '/api/auth/session': 403,
      '/api/crm/contacts': 401,
    }[req.url] ?? 404;
    res.writeHead(status, { 'Content-Type': 'application/json' });
    res.end('{}');
  });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const origin = 'http://127.0.0.1:' + server.address().port;
  const folder = fs.mkdtempSync(path.join(os.tmpdir(), 'scc-acceptance-'));
  const run = () => {
    const proc = spawnSync(process.execPath, [runner, '--web', origin, '--api', origin, '--output', folder, '--safe-auth-probes'], { encoding: 'utf8', timeout: 30000 });
    return { proc, report: JSON.parse(fs.readFileSync(path.join(folder, 'result.json'), 'utf8')) };
  };
  try {
    const good = run();
    assert.equal(good.proc.status, 2, good.proc.stderr); // PARTIAL only because real session + attestations are UNKNOWN
    assert.equal(good.report.status, 'PARTIAL');
    assert.ok(good.report.records.filter(x => x.engine === 'auth').every(x => x.status === 'PASS'));
    assert.equal(good.report.records.find(x => x.name === 'real-token-rotation').status, 'UNKNOWN');
    broken = true;
    const bad = run();
    assert.equal(bad.proc.status, 1, bad.proc.stderr);
    assert.equal(bad.report.status, 'FAIL');
    assert.equal(bad.report.records.find(x => x.name === 'refresh-route').status, 'FAIL');
  } finally {
    await new Promise(resolve => server.close(resolve));
    fs.rmSync(folder, { recursive: true, force: true });
  }
});
