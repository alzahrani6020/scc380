import assert from 'node:assert/strict';
import { test } from 'node:test';
import net from 'node:net';
import { startRtspSimulator } from './surveillance-rtsp-simulator.mjs';

const port = 18560;
function send(options) {
  return new Promise((resolve, reject) => {
    const socket=net.createConnection({host:'127.0.0.1',port});
    let received='';
    socket.setTimeout(2500,()=>socket.destroy(new Error('timeout')));
    socket.on('connect',()=>socket.write(options));
    socket.on('data',chunk=>{received+=chunk.toString('ascii');if(received.includes('\r\n\r\n'))socket.end();});
    socket.on('end',()=>resolve(received));
    socket.on('error',reject);
  });
}
test('localhost simulator answers actual RTSP OPTIONS, rejects invalid requests and stays local',async()=>{
  const server=await startRtspSimulator(port);
  try {
    assert.equal(server.address().address,'127.0.0.1');
    const ok=await send('OPTIONS rtsp://127.0.0.1:'+port+'/ RTSP/1.0\r\nCSeq: 1\r\n\r\n');
    assert.match(ok,/^RTSP\/1\.0 200 OK/);
    const bad=await send('DESCRIBE rtsp://127.0.0.1:'+port+'/ RTSP/1.0\r\nCSeq: 2\r\n\r\n');
    assert.match(bad,/^RTSP\/1\.0 400 Bad Request/);
  } finally {
    await new Promise((resolve,reject)=>server.close(err=>err?reject(err):resolve()));
  }
});
test('forbids privileged and invalid simulation ports',async()=>{
  assert.throws(()=>startRtspSimulator(554),/unprivileged/);
  assert.throws(()=>startRtspSimulator(65536),/unprivileged/);
});
