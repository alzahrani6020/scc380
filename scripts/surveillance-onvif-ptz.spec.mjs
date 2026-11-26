import assert from 'node:assert/strict';
import { test } from 'node:test';
import http from 'node:http';
import { executePtz } from './surveillance-onvif-ptz.mjs';

test('ONVIF denies non-local targets and missing credentials', async () => {
  await assert.rejects(executePtz({host:'8.8.8.8',onvifPort:80,profileToken:'P1',
    usernameEnv:'SCC_CAMERA_TEST_USER',passwordEnv:'SCC_CAMERA_TEST_PASS'},'PTZ_LEFT'),/ONVIF_CONFIG_UNAVAILABLE/);
  await assert.rejects(executePtz({host:'evil.example.com',onvifPort:80,profileToken:'P1',
    usernameEnv:'SCC_CAMERA_TEST_USER',passwordEnv:'SCC_CAMERA_TEST_PASS'},'PTZ_STOP'),/ONVIF_CONFIG_UNAVAILABLE/);
});
test('bounded ONVIF SOAP move followed by stop; no plaintext secret', async () => {
  const original={user:process.env.SCC_CAMERA_TEST_USER,password:process.env.SCC_CAMERA_TEST_PASS,
    local:process.env.SCC380_ONVIF_TEST_LOCAL};
  process.env.SCC_CAMERA_TEST_USER='localOperator';
  process.env.SCC_CAMERA_TEST_PASS='privateOnlyTestPassword';
  process.env.SCC380_ONVIF_TEST_LOCAL='YES';
  const requests=[];
  const server=http.createServer(async(req,res)=>{
    let body='';
    for await(const chunk of req) body+=chunk.toString();
    requests.push(body);
    assert.equal(req.method,'POST');
    assert.equal(req.url,'/onvif/ptz_service');
    assert.equal(body.includes('privateOnlyTestPassword'),false);
    assert.match(body,/<wsse:UsernameToken>/);
    res.writeHead(200,{'Content-Type':'application/soap+xml'});
    res.end(body.includes('<tptz:ContinuousMove>')?
      '<s:Envelope><s:Body><tptz:ContinuousMoveResponse/></s:Body></s:Envelope>':
      '<s:Envelope><s:Body><tptz:StopResponse/></s:Body></s:Envelope>');
  });
  try{
    await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
    const port=server.address().port;
    const camera={host:'127.0.0.1',onvifPort:port,profileToken:'Profile1',
      usernameEnv:'SCC_CAMERA_TEST_USER',passwordEnv:'SCC_CAMERA_TEST_PASS'};
    await executePtz(camera,'PTZ_LEFT');
    assert.equal(requests.length,2);
    assert.match(requests[0],/<tptz:ContinuousMove>/);
    assert.match(requests[1],/<tptz:Stop>/);
    await executePtz(camera,'PTZ_STOP');
    assert.equal(requests.length,3);
    await assert.rejects(executePtz(camera,'INVALID_ACTION'),/ONVIF_ACTION_UNSUPPORTED/);
  }finally{
    await new Promise(resolve=>server.close(resolve));
    for(const [key,v] of [['SCC_CAMERA_TEST_USER',original.user],
      ['SCC_CAMERA_TEST_PASS',original.password],['SCC380_ONVIF_TEST_LOCAL',original.local]]){
      if(v===undefined)delete process.env[key];else process.env[key]=v;
    }
  }
});
