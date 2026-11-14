#!/usr/bin/env node
'use strict';
// SCC380 read-only production acceptance engines. Node 20+; no npm dependencies.
const fs = require('node:fs');
const path = require('node:path');
const dns = require('node:dns').promises;
const tls = require('node:tls');

const args = process.argv.slice(2);
const opt = (name, fallback) => {
  const i = args.indexOf('--' + name);
  return i >= 0 ? args[i + 1] : fallback;
};
const truthy = name => args.includes('--' + name);
const web = opt('web', 'https://dr-talal-h-alzahrani.com');
const api = opt('api', 'https://scc380-api.onrender.com');
const expected = opt('expected-sha', '');
const outDir = path.resolve(opt('output', path.join('artifacts', 'acceptance')));
const timeout = Math.min(30000, Math.max(1000, Number(opt('timeout-ms', '10000')) || 10000));
const allowHosts = new Set(['dr-talal-h-alzahrani.com', 'www.dr-talal-h-alzahrani.com', 'scc380-web-render3.onrender.com', 'scc380-api.onrender.com', 'localhost', '127.0.0.1']);
const records = [];
const now = new Date().toISOString();
function record(engine, name, status, evidence, reason) {
  records.push({ engine, name, status, evidence, ...(reason ? { reason: String(reason).slice(0, 300) } : {}) });
  console.log(status + ' ' + engine + '/' + name + (reason ? ': ' + String(reason).slice(0, 140) : ''));
}
function safeUrl(raw) {
  const u = new URL(raw);
  if (!['http:', 'https:'].includes(u.protocol) || !allowHosts.has(u.hostname) || u.username || u.password || u.search || u.hash || u.pathname !== '/') {
    throw new Error('Only allowlisted origin URLs without path, query, or credentials are allowed');
  }
  if (u.protocol !== 'https:' && !['localhost', '127.0.0.1'].includes(u.hostname)) throw new Error('HTTPS required for remote targets');
  return u.origin;
}
async function limitedFetch(url, options = {}) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeout);
  try {
    const r = await fetch(url, { ...options, redirect: 'manual', signal: controller.signal, cache: 'no-store' });
    return { status: r.status, contentType: (r.headers.get('content-type') || '').split(';')[0], location: r.headers.get('location') || '', cacheControl: r.headers.get('cache-control') || '' };
  } finally { clearTimeout(timer); }
}
function connectivityError(e) {
  const code = e?.cause?.code || e?.code || e?.name || 'NETWORK_ERROR';
  return ['ENOTFOUND', 'EAI_AGAIN', 'ECONNREFUSED', 'ETIMEDOUT', 'AbortError', 'UND_ERR_CONNECT_TIMEOUT', 'ECONNRESET'].includes(code) ? 'BLOCKED' : 'FAIL';
}
async function network(name, origin) {
  const host = new URL(origin).hostname;
  try {
    const entries = await dns.lookup(host, { all: true });
    record('network', name + '-dns', entries.length ? 'PASS' : 'FAIL', { host, addressCount: entries.length });
  } catch (e) { record('network', name + '-dns', 'BLOCKED', { host }, e.code || e.message); }
  if (origin.startsWith('https:')) {
    try {
      const result = await new Promise((resolve, reject) => {
        const socket = tls.connect({ host, port: 443, servername: host, rejectUnauthorized: true, timeout }, () => {
          const cert = socket.getPeerCertificate();
          const outcome = { authorized: socket.authorized, validTo: cert.valid_to, protocol: socket.getProtocol() };
          socket.end(); resolve(outcome);
        });
        socket.once('error', reject);
        socket.once('timeout', () => { socket.destroy(); reject(Object.assign(new Error('timeout'), { code: 'ETIMEDOUT' })); });
      });
      record('network', name + '-tls', result.authorized ? 'PASS' : 'FAIL', result);
    } catch (e) { record('network', name + '-tls', connectivityError(e), {}, e.code || e.message); }
  }
  try {
    const response = await limitedFetch(origin + '/');
    record('network', name + '-http', response.status >= 200 && response.status < 500 ? 'PASS' : 'FAIL', response);
  } catch (e) { record('network', name + '-http', connectivityError(e), {}, e.cause?.code || e.message); }
}
async function negativeAuthTests(origin) {
  const tests = [
    { name: 'login-route', path: '/api/auth/login', method: 'POST', body: '{}', accepted: [400, 401, 422, 429] },
    { name: 'refresh-route', path: '/api/auth/refresh', method: 'POST', body: '{}', accepted: [400, 401, 422, 429] },
    { name: 'session-csrf', path: '/api/auth/session', method: 'POST', body: '{}', accepted: [403] },
    { name: 'unauthorized-crm', path: '/api/crm/contacts', method: 'GET', accepted: [401, 403] }
  ];
  if (!truthy('safe-auth-probes')) {
    for (const t of tests) record('auth', t.name, 'UNKNOWN', {}, 'Enable explicitly with --safe-auth-probes');
    return;
  }
  for (const t of tests) {
    try {
      const r = await limitedFetch(origin + t.path, { method: t.method, headers: t.method === 'POST' ? { 'content-type': 'application/json' } : {}, body: t.body });
      record('auth', t.name, t.accepted.includes(r.status) ? 'PASS' : 'FAIL', { status: r.status, expected: t.accepted }, t.accepted.includes(r.status) ? '' : 'Unexpected HTTP status or routing');
    } catch (e) { record('auth', t.name, connectivityError(e), {}, e.cause?.code || e.message); }
  }
}
async function browserCheck(origin) {
  if (!truthy('browser')) { record('browser', 'login-page', 'UNKNOWN', {}, 'Opt in with --browser; requires installed playwright and Chromium'); return; }
  let chromium;
  try { ({ chromium } = require('playwright')); }
  catch { record('browser', 'login-page', 'BLOCKED', {}, 'Playwright is not installed; use existing CRM Browser E2E environment'); return; }
  let browser;
  try {
    browser = await chromium.launch({ headless: true });
    const page = await browser.newPage();
    const r = await page.goto(origin + '/auth/login', { waitUntil: 'domcontentloaded', timeout });
    const hasLogin = await page.locator('input[type="email"]').count();
    record('browser', 'login-page', r?.ok() && hasLogin ? 'PASS' : 'FAIL', { status: r?.status() ?? null, hasEmailInput: !!hasLogin });
  } catch(e) { record('browser', 'login-page', 'BLOCKED', {}, e.message); }
  finally { await browser?.close(); }
}
async function reconcile() {
  if (!expected) { record('reconcile', 'expected-sha', 'UNKNOWN', {}, 'Provide --expected-sha'); return; }
  if (!/^[0-9a-f]{40}$/i.test(expected)) { record('reconcile', 'expected-sha', 'FAIL', {}, 'Expected SHA must be 40 hex characters'); return; }
  record('reconcile', 'expected-sha', 'PASS', { expected });
  // Render's current production image/commit must be supplied by trusted API or separate attestation.
  const observed = opt('observed-api-image', '');
  if (!observed) { record('reconcile', 'api-image', 'UNKNOWN', {}, 'Provide verified Render image using --observed-api-image'); return; }
  const actualTag = observed.split(':').pop();
  record('reconcile', 'api-image', actualTag === expected ? 'PASS' : 'FAIL', { expected, observedImage: observed }, actualTag === expected ? '' : 'Published image tag differs');
}
async function main() {
  fs.mkdirSync(outDir, { recursive: true });
  let webOrigin, apiOrigin;
  try { webOrigin = safeUrl(web); apiOrigin = safeUrl(api); }
  catch (e) { record('preflight', 'targets', 'FAIL', {}, e.message); return; }
  record('preflight', 'targets', 'PASS', { web: webOrigin, api: apiOrigin });
  await network('web', webOrigin);
  await network('api', apiOrigin);
  await negativeAuthTests(webOrigin);
  await browserCheck(webOrigin);
  await reconcile();
  record('session', 'real-token-rotation', 'UNKNOWN', {}, 'Requires authorized isolated session; never inferred from anonymous probes');
}
(async () => {
  try { await main(); }
  catch(e) { record('engine', 'exception', 'FAIL', {}, e.message); }
  const fail = records.some(x => x.status === 'FAIL');
  const incomplete = records.some(x => x.status === 'BLOCKED' || x.status === 'UNKNOWN');
  const status = fail ? 'FAIL' : incomplete ? 'PARTIAL' : 'PASS';
  const report = { schemaVersion: 1, startedAt: now, finishedAt: new Date().toISOString(), status, records, remaining: records.filter(x => x.status !== 'PASS').map(x => x.engine + '/' + x.name) };
  const file = path.join(outDir, 'result.json');
  fs.writeFileSync(file, JSON.stringify(report, null, 2) + '\n');
  console.log('STATUS: ' + status + '\nEVIDENCE: ' + file + '\nREMAINING: ' + report.remaining.join(', '));
  process.exitCode = fail ? 1 : incomplete ? 2 : 0;
})();
