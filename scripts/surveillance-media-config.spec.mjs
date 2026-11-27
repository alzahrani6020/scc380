import assert from 'node:assert/strict';
import { test } from 'node:test';
import { buildMediaConfig } from './surveillance-media-config.mjs';
const env={SCC_MEDIA_VIEWER_USER:'SiteOperator',SCC_MEDIA_VIEWER_PASSWORD:'the-long-test-password-123456',
  SCC_MEDIA_TEST_RTSP:'rtsp://operator:password@192.168.1.24:554/Streaming/Channels/101'};
test('on-prem HLS, WebRTC, recordings require auth and loopback listeners',()=>{
  const cfg=buildMediaConfig({devices:[{cameraId:'camera12345',rtspUrlEnv:'SCC_MEDIA_TEST_RTSP'}]},env);
  assert.match(cfg,/hlsAddress: 127.0.0.1:8888/);
  assert.match(cfg,/webrtcAddress: 127.0.0.1:8889/);
  assert.match(cfg,/playbackAddress: 127.0.0.1:9996/);
  assert.match(cfg,/record: true/);
  assert.match(cfg,/recordDeleteAfter: 24h/);
  assert.match(cfg,/sourceOnDemand: false/);
  assert.match(cfg,/action: playback/);
  assert.match(cfg,/source: "rtsp:\/\//);
  assert.match(cfg,/ips: \["127\.0\.0\.1", "::1"\]\n    permissions:\n      - action: api/);
});
test('reject public camera addresses, missing secrets and duplicate sources',()=>{
  assert.throws(()=>buildMediaConfig({devices:[{cameraId:'camera12345',rtspUrlEnv:'SCC_MEDIA_TEST_RTSP'}]},
    {...env,SCC_MEDIA_TEST_RTSP:'rtsp://8.8.8.8/live'}),/Public RTSP sources forbidden/);
  assert.throws(()=>buildMediaConfig({devices:[{cameraId:'camera12345',rtspUrlEnv:'SCC_MEDIA_TEST_RTSP'}]},
    {...env,SCC_MEDIA_VIEWER_PASSWORD:'weak'}),/strong local media viewer credentials/);
  assert.throws(()=>buildMediaConfig({devices:[{cameraId:'camera12345',rtspUrlEnv:'SCC_MEDIA_TEST_RTSP'},
    {cameraId:'camera12345',rtspUrlEnv:'SCC_MEDIA_TEST_RTSP'}]},env),/duplicate/);
});

test('site retention accepts 1..720 hours without modifying stored media',()=>{
  const devices=[{cameraId:'camera12345',rtspUrlEnv:'SCC_MEDIA_TEST_RTSP'}];
  const cfg=buildMediaConfig({devices,recordingRetentionHours:168},env);
  assert.match(cfg,/recordDeleteAfter: 168h/);
  assert.doesNotMatch(cfg,/recordDeleteAfter: 24h/);
  for(const recordingRetentionHours of [0,-1,721,1.5,'24',null,NaN,Infinity]){
    assert.throws(()=>buildMediaConfig({devices,recordingRetentionHours},env),
      /Recording retention must be 1\.\.720 whole hours/);
  }
  assert.throws(()=>buildMediaConfig({devices,recordingRetentionHours:24,tenantId:'foreign'},env),
    /Unexpected media configuration field/);
});
