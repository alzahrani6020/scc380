#!/usr/bin/env node
const { execFileSync } = require('node:child_process');
const { readFileSync } = require('node:fs');

const API_BASE = process.env.SCC_API_URL || 'https://api.dr-talal-h-alzahrani.com';
const WEB_BASE = process.env.SCC_WEB_URL || 'https://dr-talal-h-alzahrani.com';
const RENDER_API_SERVICE_ID = process.env.RENDER_API_SERVICE_ID || 'srv-dboi563l550s739qj6q0';
const RENDER_WEB_SERVICE_ID = process.env.RENDER_WEB_SERVICE_ID || 'srv-dbp5p68n74is73cusvbg';

const checks = [];
let failed = false;
let skipped = false;

function git(args, options = {}) {
  return execFileSync('git', args, {
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
    ...options,
  }).trim();
}

function record(name, status, evidence) {
  checks.push({ name, status, evidence });
  if (status === 'FAIL') failed = true;
  if (status === 'SKIPPED') skipped = true;
  const suffix = evidence ? ' — ' + evidence : '';
  console.log(`[${status}] ${name}${suffix}`);
}

async function httpStatus(url) {
  const response = await fetch(url, { redirect: 'manual', signal: AbortSignal.timeout(15000) });
  return response.status;
}

async function renderLatestDeploy(serviceId, apiKey) {
  const url = `https://api.render.com/v1/services/${encodeURIComponent(serviceId)}/deploys?limit=1`;
  const response = await fetch(url, {
    headers: { Authorization: `Bearer ${apiKey}`, Accept: 'application/json' },
    signal: AbortSignal.timeout(15000),
  });
  if (!response.ok) throw new Error(`Render API HTTP ${response.status}`);
  const data = await response.json();
  const row = Array.isArray(data) ? data[0] : data?.deploys?.[0] || data?.[0];
  const deploy = row?.deploy || row;
  return deploy || null;
}

(async () => {
  console.log('=== SCC380 PREFLIGHT ===');

  let branch = '';
  let head = '';
  let originMain = '';

  try {
    branch = git(['branch', '--show-current']);
    record('branch = main', branch === 'main' ? 'PASS' : 'FAIL', branch || '(detached)');
  } catch (error) {
    record('branch = main', 'FAIL', error.message);
  }

  try {
    head = git(['rev-parse', 'HEAD']);
    originMain = git(['rev-parse', 'origin/main']);
    record('HEAD == origin/main', head === originMain ? 'PASS' : 'FAIL', `HEAD=${head.slice(0, 12)} origin/main=${originMain.slice(0, 12)}`);
  } catch (error) {
    record('HEAD == origin/main', 'FAIL', error.message);
  }

  try {
    const status = git(['status', '--porcelain']);
    record('working tree clean', status === '' ? 'PASS' : 'FAIL', status === '' ? 'clean' : status.split('\n').slice(0, 8).join(' | '));
  } catch (error) {
    record('working tree clean', 'FAIL', error.message);
  }

  try {
    const renderYaml = readFileSync('render.yaml', 'utf8');
    const match = renderYaml.match(/ghcr\.io\/alzahrani6020\/scc380-api-prod:([0-9a-f]{40})/i);
    if (!match) {
      record('render.yaml API image pinned', 'FAIL', 'image SHA not found');
    } else {
      const imageSha = match[1];
      let commitExists = false;
      let ancestor = false;
      try {
        git(['cat-file', '-e', imageSha + '^{commit}']);
        commitExists = true;
        try {
          execFileSync('git', ['merge-base', '--is-ancestor', imageSha, 'HEAD'], { stdio: 'ignore' });
          ancestor = true;
        } catch {}
      } catch {}
      record(
        'render.yaml API image pinned',
        commitExists && ancestor ? 'PASS' : 'FAIL',
        `${imageSha.slice(0, 12)} commit=${commitExists ? 'yes' : 'no'} ancestor=${ancestor ? 'yes' : 'no'}`,
      );
    }
  } catch (error) {
    record('render.yaml API image pinned', 'FAIL', error.message);
  }

  const routes = [
    ['API /', API_BASE + '/', 200],
    ['CRM contacts protected', API_BASE + '/crm/contacts', 401],
    ['CRM companies protected', API_BASE + '/crm/companies', 401],
    ['CRM pipelines protected', API_BASE + '/crm/pipelines', 401],
    ['CRM CSV protected', API_BASE + '/crm/csv/contacts', 401],
    ['CRM deals protected', API_BASE + '/crm/deals', 401],
    ['CRM activities protected', API_BASE + '/crm/activities', 401],
    ['Web /landing', WEB_BASE + '/landing', 200],
  ];

  for (const [name, url, expected] of routes) {
    try {
      const status = await httpStatus(url);
      record(name, status === expected ? 'PASS' : 'FAIL', `HTTP ${status}, expected ${expected}`);
    } catch (error) {
      record(name, 'FAIL', error.message);
    }
  }

  const renderApiKey = process.env.RENDER_API_KEY;
  if (!renderApiKey) {
    record('Render API deploy checks', 'SKIPPED', 'RENDER_API_KEY not set');
  } else {
    for (const [label, serviceId] of [['Render API latest deploy', RENDER_API_SERVICE_ID], ['Render Web latest deploy', RENDER_WEB_SERVICE_ID]]) {
      try {
        const deploy = await renderLatestDeploy(serviceId, renderApiKey);
        const status = deploy?.status || 'unknown';
        const imageRef = deploy?.image?.ref || '';
        const evidence = imageRef ? `${status} ${imageRef}` : status;
        record(label, status === 'live' ? 'PASS' : 'FAIL', evidence);
      } catch (error) {
        record(label, 'FAIL', error.message);
      }
    }
  }

  const finalStatus = failed ? 'FAIL' : skipped ? 'PARTIAL' : 'PASS';
  console.log(`STATUS: ${finalStatus}`);
  console.log(JSON.stringify({ status: finalStatus, checks }, null, 2));
  process.exitCode = failed ? 1 : 0;
})().catch((error) => {
  console.error('STATUS: FAIL');
  console.error(error?.stack || error);
  process.exitCode = 1;
});
