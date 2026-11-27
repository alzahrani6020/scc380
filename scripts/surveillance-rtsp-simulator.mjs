#!/usr/bin/env node
// Local test-only RTSP OPTIONS responder. Does not stream video/audio.
// Loopback binding prevents access from other machines.
import net from 'node:net';
import { pathToFileURL } from 'node:url';
import { resolve } from 'node:path';

export function startRtspSimulator(port = 18554) {
  if (!Number.isInteger(port) || port < 1024 || port > 65535)
    throw new Error('Invalid unprivileged RTSP simulation port');
  return new Promise((resolveServer, reject) => {
    const server = net.createServer(socket => {
      socket.setTimeout(4000, () => socket.destroy());
      let incoming = '';
      socket.on('data', chunk => {
        incoming += chunk.toString('ascii');
        if (incoming.length > 8192) return socket.destroy();
        if (!incoming.includes('\r\n\r\n')) return;
        const first = incoming.split('\r\n', 1)[0];
        const valid = /^OPTIONS rtsp:\/\/127\.0\.0\.1:\d+\/ RTSP\/1\.0$/.test(first);
        socket.end('RTSP/1.0 ' + (valid ? '200 OK' : '400 Bad Request') +
          '\r\nCSeq: 1\r\nContent-Length: 0\r\n\r\n');
      });
      socket.on('error', () => {});
    });
    server.once('error', reject);
    server.listen(port, '127.0.0.1', () => {
      server.off('error', reject);
      resolveServer(server);
    });
  });
}
if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  startRtspSimulator(Number(process.argv[2] ?? 18554)).then(server => {
    console.log('STATUS: SIMULATED_RTSP_LISTENING address=127.0.0.1 port=' + server.address().port);
  }).catch(err => { console.error('STATUS: SIMULATOR_FAIL ' + err.code); process.exitCode = 1; });
}
