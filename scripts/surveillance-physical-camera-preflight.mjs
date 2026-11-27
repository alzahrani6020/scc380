#!/usr/bin/env node
// Read-only, local RTSP OPTIONS preflight for one authorized camera.
// Does not authenticate, create SCC380 records, update production, or stream video.
import net from 'node:net';
import { pathToFileURL } from 'node:url';
import { resolve } from 'node:path';

export function privateIPv4(host) {
  if (net.isIP(host) !== 4) return false;
  const n = host.split('.').map(Number);
  return n[0] === 10 || (n[0] === 172 && n[1] >= 16 && n[1] <= 31) ||
    (n[0] === 192 && n[1] === 168);
}
export async function probeRtsp(host, port = 554, timeoutMs = 4000) {
  if (!privateIPv4(host)) throw new Error('ONLY_PRIVATE_IPV4_ALLOWED');
  if (!Number.isInteger(port) || port < 1 || port > 65535) throw new Error('INVALID_PORT');
  return new Promise(resolveProbe => {
    const socket = net.createConnection({host,port});
    let done = false, buffer = '';
    const finish = (code) => {
      if (done) return;
      done = true;
      socket.destroy();
      resolveProbe(code);
    };
    socket.setTimeout(timeoutMs, () => finish('TIMEOUT'));
    socket.on('error', () => finish('UNREACHABLE'));
    socket.once('connect', () => {
      socket.write('OPTIONS rtsp://' + host + ':' + port +
        '/ RTSP/1.0\r\nCSeq: 1\r\nUser-Agent: SCC380-Preflight\r\n\r\n');
    });
    socket.on('data', chunk => {
      buffer += chunk.toString('ascii').slice(0,512);
      const code = buffer.match(/^RTSP\/1\.0\s+(\d{3})/);
      if (code) finish(code[1] === '200' ? 'RTSP_200' :
        code[1] === '401' ? 'RTSP_AUTH_REQUIRED' : 'RTSP_' + code[1]);
      else if (buffer.length > 512) finish('INVALID_RTSP_RESPONSE');
    });
    socket.once('end', () => finish('NO_RTSP_RESPONSE'));
  });
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  const host = process.argv[2], portRaw = process.argv[3] ?? '554';
  const port = Number(portRaw);
  if (!host || !/^\d+$/.test(portRaw) || !privateIPv4(host) ||
    !Number.isInteger(port) || port < 1 || port > 65535) {
    console.error('STATUS: FAIL - Usage: node scripts/surveillance-physical-camera-preflight.mjs PRIVATE_IPV4 [PORT]');
    process.exitCode = 1;
  } else {
    probeRtsp(host,port).then(code => {
      console.log('RTSP_PROBE_RESULT: ' + code);
      if (code === 'RTSP_200' || code === 'RTSP_AUTH_REQUIRED') {
        console.log('STATUS: PASS - RTSP service detected (not video acceptance)');
      } else {
        console.log('STATUS: FAIL - No confirmed RTSP service');
        process.exitCode = 1;
      }
    }).catch(err => {
      console.error('STATUS: FAIL - ' + (err.message === 'ONLY_PRIVATE_IPV4_ALLOWED' ? err.message : 'PROBE_ERROR'));
      process.exitCode = 1;
    });
  }
}
