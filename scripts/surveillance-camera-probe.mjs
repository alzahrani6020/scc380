#!/usr/bin/env node
// SCC380 camera site probe — run INSIDE the customer-controlled LAN/VPN.
// It does not request, store, or log passwords; it never opens inbound firewall ports.
// A TCP/RTSP response is NOT proof of video playback, ONVIF compatibility or PTZ/talk support.
import net from 'node:net';

function usage() {
  console.error('Usage: node scripts/surveillance-camera-probe.mjs --host 192.168.1.20 [--rtsp-port 554] [--onvif-port 80] [--timeout-ms 3500]');
  process.exitCode = 2;
}
const args = process.argv.slice(2);
const flags = {};
if (args.length % 2) { usage(); } else {
  for (let i = 0; i < args.length; i += 2) {
    if (!['--host','--rtsp-port','--onvif-port','--timeout-ms'].includes(args[i]) ||
        Object.hasOwn(flags,args[i])) { usage(); break; }
    flags[args[i]] = args[i+1];
  }
}
if (!process.exitCode) {
  const host = flags['--host'];
  const validHost = typeof host === 'string' && host.length <= 253 &&
    /^(?:[a-zA-Z0-9.-]+|[a-fA-F0-9:]+)$/.test(host) &&
    !host.startsWith('.') && !host.endsWith('.');
  const port = (name, fallback) => {
    const n = flags[name] === undefined ? fallback : Number(flags[name]);
    return Number.isInteger(n) && n >= 1 && n <= 65535 ? n : null;
  };
  const rtspPort = port('--rtsp-port', 554);
  const onvifPort = port('--onvif-port', 80);
  const timeoutMs = port('--timeout-ms', 3500);
  if (!validHost || !rtspPort || !onvifPort || !timeoutMs ||
      timeoutMs < 500 || timeoutMs > 10000) {
    usage();
  } else {
    async function probe(targetPort, sendRtsp = false) {
      return await new Promise(resolve => {
        const socket = net.createConnection({ host, port: targetPort });
        let settled = false;
        let response = '';
        const done = (result) => {
          if (settled) return;
          settled = true;
          socket.destroy();
          resolve(result);
        };
        socket.setTimeout(timeoutMs, () => done('TIMEOUT'));
        socket.on('error', (err) => done(err.code === 'ECONNREFUSED' ? 'REFUSED' : 'UNREACHABLE'));
        socket.on('connect', () => {
          if (!sendRtsp) return done('TCP_OPEN_ONLY');
          socket.write('OPTIONS rtsp://'+host+':'+targetPort+'/ RTSP/1.0\r\nCSeq: 1\r\nUser-Agent: SCC380-LAN-Readiness-Probe\r\n\r\n');
        });
        socket.on('data', chunk => {
          response += chunk.toString('utf8').slice(0, 2048);
          const match = response.match(/^RTSP\/1\.0\s+(\d{3})/);
          if (match) done(match[1] === '401' ? 'RTSP_AUTH_REQUIRED' :
            match[1] === '200' ? 'RTSP_OPTIONS_OK' : 'RTSP_STATUS_'+match[1]);
          else if (response.length >= 2048) done('RESPONDED_NOT_RTSP');
        });
        socket.on('end', () => done('TCP_CLOSED_NO_RTSP_RESPONSE'));
      });
    }
    const [rtsp, onvifTcp] = await Promise.all([probe(rtspPort, true), probe(onvifPort, false)]);
    console.log(JSON.stringify({
      status: 'DIAGNOSTIC_ONLY',
      host, rtspPort, rtsp, onvifPort, onvifTcp,
      note: 'ONVIF is not verified by TCP probing. Requires authenticated Profile T/G/M, audio, PTZ and playback device tests.',
    }, null, 2));
    if (!['RTSP_OPTIONS_OK','RTSP_AUTH_REQUIRED'].includes(rtsp)) process.exitCode = 1;
  }
}
