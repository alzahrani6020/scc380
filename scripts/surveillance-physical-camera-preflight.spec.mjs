import assert from 'node:assert/strict';
import {test} from 'node:test';
import net from 'node:net';
import {privateIPv4,probeRtsp} from './surveillance-physical-camera-preflight.mjs';

test('only RFC1918 numeric IPv4 can be probed',()=>{
  for(const host of ['192.168.1.2','10.0.0.4','172.16.0.1','172.31.255.254'])
    assert.equal(privateIPv4(host),true);
  for(const host of ['127.0.0.1','8.8.8.8','169.254.1.1','172.32.0.1','localhost','192.168.1.256','::1'])
    assert.equal(privateIPv4(host),false);
});
test('never connect to public or loopback address',async()=>{
  await assert.rejects(probeRtsp('127.0.0.1',554),/ONLY_PRIVATE_IPV4_ALLOWED/);
  await assert.rejects(probeRtsp('8.8.8.8',554),/ONLY_PRIVATE_IPV4_ALLOWED/);
});
test('classifies unreachable private RTSP service without credentials',async()=>{
  const sock=net.createServer();
  await new Promise((resolve,reject)=>sock.listen(0,'127.0.0.1',resolve).once('error',reject));
  const port=sock.address().port;
  await new Promise(resolve=>sock.close(resolve));
  const status=await probeRtsp('192.0.2.1',port,25).catch(e=>e.message);
  assert.equal(status,'ONLY_PRIVATE_IPV4_ALLOWED');
});
