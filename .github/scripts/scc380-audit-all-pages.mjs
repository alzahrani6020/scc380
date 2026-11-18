import fs from 'node:fs';
import path from 'node:path';

const root = 'apps/web/src/app';
function pages(dir, out = []) {
  for (const file of fs.readdirSync(dir, { withFileTypes: true })) {
    const abs = path.join(dir, file.name);
    if (file.isDirectory()) pages(abs, out);
    else if (file.name === 'page.tsx' || file.name === 'page.jsx') {
      const route = '/' + path.relative(root, dir).replaceAll(path.sep, '/');
      out.push(route === '/.' ? '/' : route);
    }
  }
  return out.sort();
}
const routes = pages(root);
const fakePayload = Buffer.from(JSON.stringify({
  type: 'access',
  exp: Math.floor(Date.now() / 1000) + 3600
})).toString('base64url');
const fakeToken = 'audit.' + fakePayload + '.not-a-real-signature';
const origin = 'https://dr-talal-h-alzahrani.com';
const results = [];
function resolvedRoute(route) {
  return route.replace(/\[[^/]+?\]/g, '__audit_no_real_record__');
}
async function check(route) {
  const url = origin + resolvedRoute(route);
  const out = {route};
  for (const [mode, headers] of [
    ['anonymous', {}],
    ['shell', {Cookie: 'accessToken=' + fakeToken}],
  ]) {
    try {
      const c = new AbortController();
      const timer = setTimeout(() => c.abort(), 25000);
      const t0 = Date.now();
      const res = await fetch(url, {redirect:'manual', headers, signal:c.signal});
      clearTimeout(timer);
      out[mode] = res.status;
      out[mode+'_ms'] = Date.now()-t0;
      out[mode+'_location'] = (res.headers.get('location') || '').slice(0,90);
      const body = await res.text();
      out[mode+'_body'] = body.length;
      if (res.status === 200 && (body.includes('Internal Server Error') || body.includes('Application error:'))) out[mode+'_content_error'] = true;
    } catch (e) {
      out[mode] = 'ERROR_'+String(e.name).slice(0,24);
    }
  }
  console.log('PAGE_AUDIT '+JSON.stringify(out));
  return out;
}
let index=0;
async function worker() {
  while (index < routes.length) {
    const r = routes[index++];
    results.push(await check(r));
  }
}
await Promise.all(Array.from({length:6},worker));
const stat = {
  found:routes.length,
  checked:results.length,
  anonymous_2xx:results.filter(r=>r.anonymous>=200&&r.anonymous<300).length,
  anonymous_3xx:results.filter(r=>r.anonymous>=300&&r.anonymous<400).length,
  anonymous_4xx:results.filter(r=>r.anonymous>=400&&r.anonymous<500).length,
  anonymous_5xx:results.filter(r=>r.anonymous>=500&&r.anonymous<600).length,
  shell_200:results.filter(r=>r.shell===200).length,
  shell_3xx:results.filter(r=>r.shell>=300&&r.shell<400).length,
  shell_4xx:results.filter(r=>r.shell>=400&&r.shell<500).length,
  shell_5xx:results.filter(r=>r.shell>=500&&r.shell<600).length,
  shell_error:results.filter(r=>typeof r.shell==='string').length,
};
console.log('PAGE_AUDIT_SUMMARY '+JSON.stringify(stat));
if (stat.checked!==94 || stat.shell_5xx || stat.shell_error) process.exitCode=1;