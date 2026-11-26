#!/usr/bin/env node
// A single-run, outbound-only RTSP availability reporter for a customer-controlled site.
// Actual media playback, RTSP authentication, ONVIF/PTZ/audio are NOT implemented here.
// Never put credentials in the JSON config, CLI arguments, URLs, or source repository.
import net from 'node:net';
import { readFile } from 'node:fs/promises';

const fail = (message) => { console.error('EDGE_AGENT_FAIL:', message); process.exitCode = 1; };
const args = process.argv.slice(2);
if (args.length !== 2 || args[0] !== '--config') {
  fail('Usage: SCC_GATEWAY_TOKEN=... node scripts/surveillance-site-agent.mjs --config /private/site-cameras.json');
} else {
  const apiUrl = process.env.SCC_GATEWAY_API_URL ?? 'https://scc380-api.onrender.com';
  const token = process.env.SCC_GATEWAY_TOKEN;
  try {
    const target = new URL(apiUrl);
    if (target.protocol !== 'https:' || target.pathname !== '/' || target.search || target.hash || target.username || target.password) {
      throw new Error('API base URL must be HTTPS origin only');
    }
    if (!/^sccg_[A-Za-z0-9_-]{43}$/.test(token || '')) throw new Error('Missing valid SCC_GATEWAY_TOKEN');
    const config = JSON.parse(await readFile(args[1], 'utf8'));
    if (!Array.isArray(config.cameras) || config.cameras.length > 100) throw new Error('Config must list up to 100 cameras');
    const seen = new Set();
    const cameras = config.cameras.map((camera) => {
      if (typeof camera.cameraId !== 'string' || !/^[a-zA-Z0-9_-]{10,80}$/.test(camera.cameraId) ||
          typeof camera.host !== 'string' || !/^[a-zA-Z0-9.:-]{1,253}$/.test(camera.host) ||
          camera.host.startsWith('-') || camera.host.includes('..') ||
          !Number.isInteger(camera.port ?? 554) || (camera.port ?? 554) < 1 || (camera.port ?? 554) > 65535 ||
          seen.has(camera.cameraId) || Object.keys(camera).some(k => !['cameraId','host','port'].includes(k))) {
        throw new Error('Invalid camera entry; only cameraId, host and port are allowed');
      }
      seen.add(camera.cameraId);
      return { cameraId: camera.cameraId, host: camera.host, port: camera.port ?? 554 };
    });
    const probe = async (camera) => new Promise(resolve => {
      const socket = net.createConnection({ host: camera.host, port: camera.port });
      let status = 'OFFLINE', completed = false, buffer = '';
      const done = () => { if (!completed) { completed = true; socket.destroy(); resolve({cameraId:camera.cameraId,status}); } };
      socket.setTimeout(3000, done);
      socket.once('error', done);
      socket.once('connect', () => socket.write(
        'OPTIONS rtsp://' + camera.host + ':' + camera.port + '/ RTSP/1.0\r\nCSeq: 1\r\nUser-Agent: SCC380-Edge-Agent\r\n\r\n'
      ));
      socket.on('data', chunk => {
        buffer += chunk.toString('utf8').slice(0, 512);
        const code = buffer.match(/^RTSP\/1\.0\s+(\d{3})/);
        if (code) { status = code[1] === '200' || code[1] === '401' ? 'ONLINE' : 'DEGRADED'; done(); }
        else if (buffer.length >= 512) { status='DEGRADED'; done(); }
      });
      socket.once('end', done);
    });
    const statuses=[];
    // Sequential by default: avoids spikes against constrained site networks.
    for (const camera of cameras) statuses.push(await probe(camera));
    const response=await fetch(new URL('/surveillance/gateways/heartbeat',target),{
      method:'POST',redirect:'error',signal:AbortSignal.timeout(10000),
      headers:{Authorization:'Bearer '+token,'Content-Type':'application/json'},
      body:JSON.stringify({cameras:statuses}),
    });
    if (!response.ok) throw new Error('Gateway heartbeat rejected: HTTP ' + response.status);
    const data = await response.json();
    if (!Number.isInteger(data.accepted) || data.accepted !== statuses.length) throw new Error('Unexpected heartbeat acknowledgement');
    console.log(JSON.stringify({status:'HEARTBEAT_ACCEPTED',accepted:data.accepted,
      online:statuses.filter(c=>c.status==='ONLINE').length,
      degraded:statuses.filter(c=>c.status==='DEGRADED').length,
      offline:statuses.filter(c=>c.status==='OFFLINE').length}));
  } catch (error) { fail(error.message); }
}
