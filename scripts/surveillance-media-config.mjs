#!/usr/bin/env node
// On-prem MediaMTX configuration writer: local-only video/audio playback and short-lived recordings.
// No inbound public exposure, cloud camera credentials or cross-tenant shared media server.
import { readFile, writeFile, chmod } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';
import { resolve } from 'node:path';

const quote = x => JSON.stringify(String(x));
export function buildMediaConfig(data, env=process.env) {
  if(!Array.isArray(data.devices) || !data.devices.length || data.devices.length>100)
    throw new Error('Expected 1..100 cameras');
  const user=env.SCC_MEDIA_VIEWER_USER, pass=env.SCC_MEDIA_VIEWER_PASSWORD;
  if(!user || !pass || user.length<8 || pass.length<24)
    throw new Error('Missing strong local media viewer credentials');
  const lines=[
    '# GENERATED PRIVATE CONFIG; never commit or send to SCC380 cloud.',
    'logLevel: warn', 'api: false', 'metrics: false', 'pprof: false',
    'authMethod: internal', 'authInternalUsers:',
    '  - user: '+quote(user),'    pass: '+quote(pass),'    ips: []',
    '    permissions:',
  ];
  const entries=[], ids=new Set();
  for(const device of data.devices) {
    if(!device || !/^[a-zA-Z0-9_-]{10,80}$/.test(device.cameraId) ||
       !/^[A-Z][A-Z0-9_]{1,79}$/.test(device.rtspUrlEnv ?? '') ||
       ids.has(device.cameraId) || Object.keys(device).some(k=>!['cameraId','rtspUrlEnv'].includes(k)))
      throw new Error('Invalid or duplicate media camera entry');
    ids.add(device.cameraId);
    const raw=env[device.rtspUrlEnv];
    if(!raw) throw new Error('Missing RTSP input environment variable for camera');
    const url=new URL(raw);
    if(url.protocol!=='rtsp:' || url.hash || !url.hostname || url.hostname.includes(':'))
      throw new Error('RTSP input must be LAN rtsp://IPv4:port/path');
    const m=/^(\\d{1,3})\\.(\\d{1,3})\\.(\\d{1,3})\\.(\\d{1,3})$/.exec(url.hostname);
    if(!m) throw new Error('Camera RTSP host must be numeric RFC1918 IPv4');
    const x=m.slice(1).map(Number);
    if(x.some(n=>n>255)||!(x[0]===10||(x[0]===172&&x[1]>=16&&x[1]<=31)||(x[0]===192&&x[1]===168)))
      throw new Error('Public RTSP sources forbidden');
    lines.push('      - action: read', '        path: '+quote(device.cameraId),
      '      - action: playback','        path: '+quote(device.cameraId));
    entries.push({id:device.cameraId,url:raw});
  }
  lines.push(
    '  - user: any','    pass:','    ips: ["127.0.0.1", "::1"]',
    '    permissions:','      - action: api',
    'rtspAddress: 127.0.0.1:8554','hls: true','hlsAddress: 127.0.0.1:8888',
    'webrtc: true','webrtcAddress: 127.0.0.1:8889',
    'playback: true','playbackAddress: 127.0.0.1:9996',
    'hlsAllowOrigins: []','webrtcAllowOrigins: []','playbackAllowOrigins: []',
    'paths:'
  );
  for(const e of entries) lines.push('  '+quote(e.id)+':',
    '    source: '+quote(e.url),
    '    sourceOnDemand: true',
    '    record: true',
    '    recordPath: '+quote(resolve(data.recordingDirectory||'/var/lib/scc380/recordings')+'/%path/%Y-%m-%d_%H-%M-%S-%f_%z'),
    '    recordFormat: fmp4',
    '    recordDeleteAfter: 24h');
  return lines.join('\\n')+'\\n';
}
async function main(){
  const args=process.argv.slice(2);
  if(args.length!==4 || args[0]!=='--config' || args[2]!=='--output')
    throw new Error('Usage: node scripts/surveillance-media-config.mjs --config /private/devices.json --output /private/mediamtx.yml');
  const config=JSON.parse(await readFile(args[1],'utf8'));
  const output=resolve(args[3]);
  const yaml=buildMediaConfig(config);
  await writeFile(output,yaml,{flag:'wx',mode:0o600});
  await chmod(output,0o600);
  console.log('PRIVATE_MEDIA_CONFIG_CREATED; camera_count='+config.devices.length);
}
if(process.argv[1] && import.meta.url===pathToFileURL(resolve(process.argv[1])).href)
  main().catch(e=>{console.error('MEDIA_CONFIG_FAILED:',e.message);process.exitCode=1;});
