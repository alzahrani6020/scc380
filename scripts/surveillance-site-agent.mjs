#!/usr/bin/env node
// A single-run, outbound-only RTSP availability reporter for a customer-controlled site.
// Actual media playback, RTSP authentication, ONVIF/PTZ/audio are NOT implemented here.
// Never put credentials in the JSON config, CLI arguments, URLs, or source repository.
import net from 'node:net';
import { readFile } from 'node:fs/promises';
import { executePtz } from './surveillance-onvif-ptz.mjs';
import { gatewayFailure } from './surveillance-gateway-error.mjs';

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
          seen.has(camera.cameraId) || Object.keys(camera).some(k => !['cameraId','host','port','telemetryFile'].includes(k)) ||
          (camera.telemetryFile!==undefined &&
           (typeof camera.telemetryFile!=='string' || !camera.telemetryFile.startsWith('/') ||
             camera.telemetryFile.length>240))) {
        throw new Error('Invalid camera entry; only cameraId, host and port are allowed');
      }
      seen.add(camera.cameraId);
      return { cameraId: camera.cameraId, host: camera.host, port: camera.port ?? 554,
        telemetryFile: camera.telemetryFile };
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
    for (const camera of cameras) {
      const report=await probe(camera);
      if(camera.telemetryFile){
        // Device GPS adapter writes a fresh local JSON file; no credentials or external API URLs.
        try{
          const geo=JSON.parse(await readFile(camera.telemetryFile,'utf8'));
          const recordedAt=Date.parse(geo.timestamp);
          if(Number.isFinite(recordedAt) && Math.abs(Date.now()-recordedAt)<=120_000 &&
             typeof geo.latitude==='number' && geo.latitude>=-90 && geo.latitude<=90 &&
             typeof geo.longitude==='number' && geo.longitude>=-180 && geo.longitude<=180 &&
             Object.keys(geo).every(k=>['latitude','longitude','timestamp'].includes(k))) {
            report.latitude=geo.latitude;report.longitude=geo.longitude;
          } else console.warn('GPS_TELEMETRY_SKIPPED: stale or invalid format for camera '+camera.cameraId);
        }catch{console.warn('GPS_TELEMETRY_SKIPPED: unavailable local file for camera '+camera.cameraId);}
      }
      statuses.push(report);
    }
    const response=await fetch(new URL('/surveillance/gateways/heartbeat',target),{
      method:'POST',redirect:'error',signal:AbortSignal.timeout(10000),
      headers:{Authorization:'Bearer '+token,'Content-Type':'application/json'},
      body:JSON.stringify({cameras:statuses}),
    });
    if (!response.ok) throw new Error('Gateway heartbeat rejected: ' + await gatewayFailure(response));
    const data = await response.json();
    if (!Number.isInteger(data.accepted) || data.accepted !== statuses.length) throw new Error('Unexpected heartbeat acknowledgement');
    console.log(JSON.stringify({status:'HEARTBEAT_ACCEPTED',accepted:data.accepted,
      online:statuses.filter(c=>c.status==='ONLINE').length,
      degraded:statuses.filter(c=>c.status==='DEGRADED').length,
      offline:statuses.filter(c=>c.status==='OFFLINE').length}));
    // Pilot adapter: inspect and explicitly reject unsupported PTZ intents, NEVER perform movement.
    // This makes audit state deterministic without trusting camera-side vendor behavior.
    const pending=await fetch(new URL('/surveillance/device-commands/pending',target),{
      method:'GET',redirect:'error',signal:AbortSignal.timeout(10000),
      headers:{Authorization:'Bearer '+token},
    });
    if(!pending.ok) throw new Error('Gateway command polling rejected: HTTP '+pending.status);
    const queue=await pending.json();
    if(!Array.isArray(queue.commands) || queue.commands.length>20 ||
       typeof queue.executionEnabled !== 'boolean')
      throw new Error('Unexpected command queue response; refusing execution');
    const localEnabled = process.env.SCC_ONVIF_PTZ_ENABLED === 'YES';
    const physicalEnabled = localEnabled && queue.executionEnabled;
    let onvifDevices = new Map();
    if(physicalEnabled){
      if(!process.env.SCC_ONVIF_CONFIG) throw new Error('Missing local SCC_ONVIF_CONFIG');
      const cfg = JSON.parse(await readFile(process.env.SCC_ONVIF_CONFIG,'utf8'));
      if(!Array.isArray(cfg.devices) || cfg.devices.length>100) throw new Error('Invalid ONVIF device list');
      for(const device of cfg.devices) {
        if(!cameras.some(c=>c.cameraId===device.cameraId) || onvifDevices.has(device.cameraId) ||
           typeof device.cameraId!=='string' || Object.keys(device).some(k=>
             !['cameraId','host','onvifPort','profileToken','usernameEnv','passwordEnv','ptzPath'].includes(k)))
          throw new Error('ONVIF camera not found in this site config');
        onvifDevices.set(device.cameraId,device);
      }
    }
    for(const command of queue.commands){
      if(typeof command.id !== 'string' || !/^[a-zA-Z0-9_-]{10,80}$/.test(command.id) ||
         !['PTZ_LEFT','PTZ_RIGHT','PTZ_UP','PTZ_DOWN','ZOOM_IN','ZOOM_OUT','PTZ_STOP'].includes(command.action))
        throw new Error('Invalid command envelope; refusing execution');
      if(physicalEnabled && onvifDevices.has(command.cameraId) &&
         Date.parse(command.expiresAt)>Date.now()+1000) {
        const claimed=await fetch(new URL('/surveillance/device-commands/'+encodeURIComponent(command.id)+'/claim',target),{
          method:'POST',redirect:'error',signal:AbortSignal.timeout(5000),
          headers:{Authorization:'Bearer '+token},
        });
        if(claimed.status===404) continue; // Another agent claimed or command expired.
        if(!claimed.ok) throw new Error('Command claim refused: HTTP '+claimed.status);
        const lease=await claimed.json();
        if(lease.cameraId!==command.cameraId || lease.action!==command.action ||
           typeof lease.leaseToken!=='string' || !/^[A-Za-z0-9_-]{43}$/.test(lease.leaseToken))
          throw new Error('Command lease did not match envelope');
        let resultCode='SOAP_ACKNOWLEDGED';
        try { await executePtz(onvifDevices.get(command.cameraId), command.action); }
        catch { resultCode='FAILED'; }
        const completion=await fetch(new URL('/surveillance/device-commands/'+encodeURIComponent(command.id)+'/complete',target),{
          method:'POST',redirect:'error',signal:AbortSignal.timeout(10000),
          headers:{Authorization:'Bearer '+token,'Content-Type':'application/json'},
          body:JSON.stringify({leaseToken:lease.leaseToken,resultCode}),
        });
        if(!completion.ok) throw new Error('Command completion not confirmed: HTTP '+completion.status);
        console.log(JSON.stringify({status:resultCode,id:command.id,deviceMovementVerified:false}));
      } else {
        const rejected=await fetch(new URL('/surveillance/device-commands/'+encodeURIComponent(command.id)+'/reject',target),{
          method:'POST',redirect:'error',signal:AbortSignal.timeout(10000),
          headers:{Authorization:'Bearer '+token,'Content-Type':'application/json'},
          body:JSON.stringify({resultCode:'UNSUPPORTED'}),
        });
        if(!rejected.ok && rejected.status!==404) throw new Error('Command rejection failed: HTTP '+rejected.status);
        console.log(JSON.stringify({status:'COMMAND_REJECTED_UNSUPPORTED',id:command.id}));
      }
    }
  } catch (error) { fail(error.message); }
}
