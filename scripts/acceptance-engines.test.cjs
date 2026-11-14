// Self-contained regression test. No production requests or secrets.
'use strict';
const assert = require('node:assert/strict');
const { test } = require('node:test');
const { createServer } = require('node:http');
const { spawn } = require('node:child_process');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const runner = path.join(__dirname, 'acceptance-engines.cjs');
test('auth route probes catch routing regressions and preserve UNKNOWN for real sessions', { timeout: 45000 }, async () => {
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
  const run = async () => {
    const code = await new Promise((resolve, reject) => {
      const proc = spawn(process.execPath, [runner, '--web', origin, '--api', origin, '--output', folder, '--safe-auth-probes'], { stdio: 'ignore' });
      proc.once('error', reject);
      proc.once('exit', resolve);
    });
    return { code, report: JSON.parse(fs.readFileSync(path.join(folder, 'result.json'), 'utf8')) };
  };
  try {
    const good = await run();
    assert.equal(good.code, 2); // PARTIAL: production session and independent attestation remain UNKNOWN
    assert.equal(good.report.status, 'PARTIAL');
    assert.ok(good.report.records.filter(x => x.engine === 'auth').every(x => x.status === 'PASS'));
    assert.equal(good.report.records.find(x => x.name === 'real-token-rotation').status, 'UNKNOWN');
    broken = true;
    const bad = await run();
    assert.equal(bad.code, 1);
    assert.equal(bad.report.status, 'FAIL');
    assert.equal(bad.report.records.find(x => x.name === 'refresh-route').status, 'FAIL');
  } finally {
    await new Promise(resolve => server.close(resolve));
    fs.rmSync(folder, { recursive: true, force: true });
  }
});

test('HTTP abort is BLOCKED, never a confirmed application FAIL', { timeout: 25000 }, async () => {
  const server = createServer((_req, _res) => { /* Deliberately never responds */ });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const origin = 'http://127.0.0.1:' + server.address().port;
  const folder = fs.mkdtempSync(path.join(os.tmpdir(), 'scc-timeout-'));
  try {
    const code = await new Promise((resolve, reject) => {
      const proc = spawn(process.execPath, [runner, '--web', origin, '--api', origin, '--output', folder, '--timeout-ms', '1000'], { stdio: 'ignore' });
      proc.once('error', reject);
      proc.once('exit', resolve);
    });
    const report = JSON.parse(fs.readFileSync(path.join(folder, 'result.json'), 'utf8'));
    assert.equal(code, 2);
    assert.equal(report.status, 'PARTIAL');
    assert.equal(report.records.find(x => x.name === 'api-http').status, 'BLOCKED');
    assert.equal(report.records.find(x => x.name === 'web-http').status, 'BLOCKED');
  } finally {
    server.closeAllConnections();
    await new Promise(resolve => server.close(resolve));
    fs.rmSync(folder, { recursive: true, force: true });
  }
});
