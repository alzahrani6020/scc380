import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import net from 'node:net';
import { test } from 'node:test';
import { once } from 'node:events';

test('single-host probe recognizes RTSP challenge and does not send camera credentials', async () => {
  let authHeaderSeen=false;
  const server=net.createServer(socket=>{
    socket.on('data', bytes=>{
      const request=bytes.toString('utf8');
      if (/Authorization:/i.test(request)) authHeaderSeen=true;
      if (request.startsWith('OPTIONS ')) {
        socket.end('RTSP/1.0 401 Unauthorized\r\nCSeq: 1\r\n\r\n');
      }
    });
  });
  server.listen(0, '127.0.0.1');
  await once(server,'listening');
  try {
    const port=server.address().port;
    const child=spawn(process.execPath, ['scripts/surveillance-camera-probe.mjs',
      '--host','127.0.0.1','--rtsp-port',String(port),
      '--onvif-port',String(port),'--timeout-ms','1500'],{stdio:['ignore','pipe','pipe']});
    let out='';let err='';
    child.stdout.on('data',b=>{out+=b.toString();});
    child.stderr.on('data',b=>{err+=b.toString();});
    const [code]=await once(child,'close');
    assert.equal(code,0,err);
    const result=JSON.parse(out);
    assert.equal(result.status,'DIAGNOSTIC_ONLY');
    assert.equal(result.rtsp,'RTSP_AUTH_REQUIRED');
    assert.equal(result.onvifTcp,'TCP_OPEN_ONLY');
    assert.equal(authHeaderSeen,false);
  } finally {server.close();}
});

test('invalid input is rejected before network activity', async()=>{
  const child=spawn(process.execPath,['scripts/surveillance-camera-probe.mjs',
    '--host','example.com/path'],{stdio:['ignore','pipe','pipe']});
  const [code]=await once(child,'close');
  assert.equal(code,2);
});
