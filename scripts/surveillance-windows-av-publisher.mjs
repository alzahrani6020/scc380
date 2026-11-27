#!/usr/bin/env node
// Windows-only site-local webcam + microphone publisher for an existing MediaMTX RTSP path.
// Never edits MediaMTX, databases, recordings, firewall or Windows default devices.
import { spawn, spawnSync } from 'node:child_process';
import { pathToFileURL } from 'node:url';
import { resolve } from 'node:path';

export function parseDirectShowDevices(log) {
  const devices = { video: [], audio: [] };
  let kind = null;
  for (const line of String(log).split(/\r?\n/)) {
    if (/DirectShow video devices/i.test(line)) { kind = 'video'; continue; }
    if (/DirectShow audio devices/i.test(line)) { kind = 'audio'; continue; }
    if (!kind || /Alternative name/i.test(line)) continue;
    const name = line.match(/\]\s+"([^"]+)"/)?.[1];
    if (name && !devices[kind].includes(name)) devices[kind].push(name);
  }
  return devices;
}
export function orderMicrophones(devices, preferred = '') {
  const list = [...new Set(devices)];
  if (preferred) {
    const exact = list.find(x => x.toLowerCase() === preferred.toLowerCase());
    if (!exact) throw new Error('PREFERRED_MICROPHONE_NOT_AVAILABLE');
    return [exact, ...list.filter(x => x !== exact)];
  }
  const score = x => {
    if (/camera|webcam|uvc/i.test(x)) return 0;
    if (/headset|headphone|usb|bluetooth|wireless|microphone.*external/i.test(x)) return 1;
    if (/array|realtek|integrated|internal/i.test(x)) return 2;
    return 3;
  };
  return list.sort((a,b) => score(a)-score(b));
}
export function selectCamera(devices, preferred = '') {
  if (preferred) {
    const found = devices.find(x => x.toLowerCase() === preferred.toLowerCase());
    if (!found) throw new Error('PREFERRED_CAMERA_NOT_AVAILABLE');
    return found;
  }
  const primary = devices.find(x => !/\bIR\b|infrared/i.test(x));
  if (!primary) throw new Error('NO_SUPPORTED_VIDEO_CAMERA');
  return primary;
}
export function ffmpegArguments({ camera, mic, durationSeconds = 0, rtspUrl }) {
  if (!camera || !rtspUrl || !/^rtsp:\/\/[^/]+@127\.0\.0\.1:\d{1,5}\/laptop$/.test(rtspUrl))
    throw new Error('INVALID_LOCAL_PUBLISHER_CONFIGURATION');
  const args = [
    '-hide_banner', '-nostdin', '-loglevel', 'warning', '-y',
    '-thread_queue_size', '1024', '-f', 'dshow', '-i', 'video=' + camera,
  ];
  if (mic) args.push('-thread_queue_size','1024','-f','dshow','-i','audio='+mic);
  args.push('-map','0:v:0');
  if (mic) args.push('-map','1:a:0');
  args.push('-c:v','libx264','-preset','veryfast','-tune','zerolatency',
    '-pix_fmt','yuv420p','-g','60');
  if (mic) args.push('-c:a','aac','-ar','48000','-b:a','128k',
    '-af','aresample=async=1:first_pts=0');
  if (durationSeconds) args.push('-t',String(durationSeconds));
  args.push('-f','rtsp','-rtsp_transport','tcp',rtspUrl);
  return args;
}
function lookupFfmpeg() {
  const command = process.env.SCC_FFMPEG_PATH || 'ffmpeg';
  const result = spawnSync(command,['-version'],{encoding:'utf8',windowsHide:true,timeout:8000});
  if (result.error || result.status !== 0) throw new Error('FFMPEG_NOT_AVAILABLE');
  return command;
}
export function scanDevices(ffmpeg) {
  const result = spawnSync(ffmpeg,['-hide_banner','-list_devices','true','-f','dshow','-i','dummy'],
    {encoding:'utf8',windowsHide:true,timeout:10000,maxBuffer:2*1024*1024});
  if(result.error) throw new Error('DIRECTSHOW_SCAN_FAILED');
  return parseDirectShowDevices((result.stderr||'')+'\n'+(result.stdout||''));
}
function localPublisherUrl() {
  const user=process.env.SCC_MEDIA_PUBLISHER_USER;
  const password=process.env.SCC_MEDIA_PUBLISHER_PASSWORD;
  if(!user || !password || user.length<8 || password.length<24)
    throw new Error('LOCAL_PUBLISHER_CREDENTIALS_REQUIRED');
  if(/[\r\n]/.test(user+password)) throw new Error('INVALID_PUBLISHER_CREDENTIALS');
  return 'rtsp://'+encodeURIComponent(user)+':'+encodeURIComponent(password)+'@127.0.0.1:8554/laptop';
}
async function publishOnce(ffmpeg, args, stop) {
  return await new Promise((resolveRun,rejectRun)=>{
    const child=spawn(ffmpeg,args,{stdio:['ignore','ignore','pipe'],windowsHide:true});
    let errorTail='';
    child.stderr.on('data',chunk=>{
      // Never emit the RTSP URL or credentials, including from FFmpeg diagnostics.
      errorTail=(errorTail+chunk.toString()).slice(-16000);
    });
    child.once('error',()=>rejectRun(new Error('FFMPEG_START_FAILED')));
    child.once('close',(code,signal)=>{
      stop.child=null;
      if(code===0) resolveRun('COMPLETED');
      else resolveRun('FAILED: '+(signal||code)+
        (/(device|audio|dshow|cannot|error)/i.test(errorTail)?' - DEVICE_OR_STREAM_ERROR':''));
    });
    stop.child=child;
    if(stop.requested) child.kill('SIGINT');
  });
}
function pause(ms,stop) {
  return new Promise(resolvePause=>{
    const until=Date.now()+ms;
    const tick=()=>{
      if(stop.requested || Date.now()>=until) resolvePause();
      else setTimeout(tick,Math.min(200,until-Date.now()));
    };
    tick();
  });
}
export async function main(args=process.argv.slice(2)) {
  if(process.platform!=='win32') throw new Error('WINDOWS_ONLY');
  if(args.length>2 || (args.length>0 && args[0]!=='--duration-seconds'))
    throw new Error('Usage: node scripts/surveillance-windows-av-publisher.mjs [--duration-seconds 20]');
  const durationSeconds=args.length===2?Number(args[1]):0;
  if(!Number.isInteger(durationSeconds) || durationSeconds<0 || durationSeconds>3600 ||
    (args.length===1)) throw new Error('INVALID_DURATION');
  const ffmpeg=lookupFfmpeg();
  const target=localPublisherUrl();
  const stop={requested:false,child:null};
  for(const signal of ['SIGINT','SIGTERM']) process.once(signal,()=>{
    stop.requested=true;
    if(stop.child) stop.child.kill('SIGINT');
  });
  let attempt=0;
  while(!stop.requested) {
    attempt++;
    const available=scanDevices(ffmpeg);
    const camera=selectCamera(available.video,process.env.SCC_CAMERA_NAME||'');
    const microphones=orderMicrophones(available.audio,process.env.SCC_MICROPHONE_NAME||'');
    // On failure: retry other detected microphones, then rescan on the next cycle.
    const candidates= microphones.length?microphones:[null];
    for(const mic of candidates) {
      if(stop.requested) break;
      console.log('MEDIA_INPUT camera='+JSON.stringify(camera)+
        ' microphone='+(mic?JSON.stringify(mic):'NONE (video-only fallback)')+
        ' attempt='+attempt);
      const result=await publishOnce(ffmpeg,ffmpegArguments({
        camera,mic,durationSeconds,rtspUrl:target}),stop);
      console.log('MEDIA_PUBLISH_RESULT: '+result);
      if(result==='COMPLETED' || stop.requested) return;
    }
    // A missing microphone must not stop video forever, but failures are reported.
    await pause(3000,stop);
  }
}
if(process.argv[1] && import.meta.url===pathToFileURL(resolve(process.argv[1])).href)
  main().catch(error=>{
    console.error('STATUS: FAIL - '+error.message);
    process.exitCode=1;
  });
