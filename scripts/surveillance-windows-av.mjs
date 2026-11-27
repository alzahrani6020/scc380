#!/usr/bin/env node
// User-initiated Windows-only DirectShow camera/microphone recording; local files only.
import {spawn} from 'node:child_process';
import {mkdir,stat,writeFile} from 'node:fs/promises';
import {join,resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
export function parseDevices(text) {
  const devices={video:[],audio:[]};let kind='';
  for(const line of text.split(/\r?\n/)){
    if(/DirectShow video devices/i.test(line)){kind='video';continue;}
    if(/DirectShow audio devices/i.test(line)){kind='audio';continue;}
    if(!kind||/Alternative name/i.test(line))continue;
    const m=line.match(/\[dshow[^\]]*\]\s+"([^"]+)"/i);
    if(m&&!devices[kind].includes(m[1]))devices[kind].push(m[1]);
  }
  return devices;
}
export function audioPriority(name) {
  const s=name.toLowerCase();
  if(/headset|hands.free|سماعة رأس/i.test(s))return 50;
  if(/bluetooth|بلوتوث/i.test(s))return 45;
  if(/usb|external|خارجي/i.test(s))return 40;
  if(/microphone|mic\b|ميكروفون|array/i.test(s))return 25;
  return 10;
}
export function sortedAudio(devices) {
  return devices.map((name,index)=>({name,index})).sort((a,b)=>
    audioPriority(b.name)-audioPriority(a.name)||a.index-b.index).map(x=>x.name);
}
export function recordingArgs(video,audio,duration,output){
  if(!video||!audio||!Number.isInteger(duration)||duration<3||duration>300||!/\.mp4$/i.test(output))
    throw new Error('INVALID_CAPTURE_ARGUMENT');
  // Both tracks originate from the same DirectShow input clock.
  return ['-hide_banner','-nostdin','-loglevel','error','-n',
    '-thread_queue_size','1024','-rtbufsize','256M',
    '-f','dshow','-i','video="'+video.replaceAll('"','')+'":audio="'+audio.replaceAll('"','')+'"',
    '-t',String(duration),'-map','0:v:0','-map','0:a:0',
    '-c:v','libx264','-preset','veryfast','-pix_fmt','yuv420p',
    '-c:a','aac','-b:a','128k','-ar','48000',
    '-af','aresample=async=1:first_pts=0','-movflags','+faststart',output];
}
export function assessStreams(json,duration) {
  const streams=json.streams??[];
  const video=streams.find(x=>x.codec_type==='video');
  const audio=streams.find(x=>x.codec_type==='audio');
  const v=Number(video?.duration??json.format?.duration);
  const a=Number(audio?.duration??json.format?.duration);
  const valid=!!(video&&audio&&video.codec_name==='h264'&&audio.codec_name==='aac'&&
    Number.isFinite(v)&&Number.isFinite(a)&&v>=duration-3&&a>=duration-3);
  return {valid,videoCodec:video?.codec_name??null,audioCodec:audio?.codec_name??null,
    videoDuration:v,audioDuration:a,deltaMs:Math.round(Math.abs(v-a)*1000),
    perceptualSyncVerified:false};
}
function run(program,args,timeoutMs=20000){
  return new Promise((ok,fail)=>{
    const p=spawn(program,args,{windowsHide:true,stdio:['ignore','pipe','pipe']});
    let out='',err='',done=false;
    const finish=(error,result)=>{
      if(done)return;done=true;clearTimeout(timer);
      if(error)fail(error);else ok(result);
    };
    p.stdout.on('data',x=>{out=(out+x.toString()).slice(-64000);});
    p.stderr.on('data',x=>{err=(err+x.toString()).slice(-64000);});
    p.on('error',e=>finish(e));
    p.on('close',code=>finish(null,{code,out,err}));
    const timer=setTimeout(()=>{p.kill();finish(new Error('PROCESS_TIMEOUT'));},timeoutMs);
  });
}
async function main(){
  if(process.platform!=='win32')throw new Error('WINDOWS_ONLY');
  const argv=process.argv.slice(2);
  if(!['--list','--record'].includes(argv[0]))throw new Error('USAGE: --list | --record [--output-dir PATH] [--duration 3..300]');
  const options={};
  for(let i=1;i<argv.length;i+=2){
    if(!['--output-dir','--duration','--ffmpeg','--ffprobe'].includes(argv[i])||!argv[i+1]||
      Object.hasOwn(options,argv[i]))throw new Error('INVALID_OPTIONS');
    options[argv[i]]=argv[i+1];
  }
  const duration=Number(options['--duration']??15);
  if(!Number.isInteger(duration)||duration<3||duration>300)throw new Error('INVALID_DURATION');
  const ffmpeg=options['--ffmpeg']??'ffmpeg';
  const ffprobe=options['--ffprobe']??'ffprobe';
  const listing=await run(ffmpeg,['-hide_banner','-list_devices','true','-f','dshow','-i','dummy']);
  const devices=parseDevices(listing.err+'\n'+listing.out);
  console.log('CAMERA_COUNT: '+devices.video.length+' MICROPHONE_COUNT: '+devices.audio.length);
  if(argv[0]==='--list'){
    for(const x of devices.video)console.log('CAMERA: '+x);
    for(const x of sortedAudio(devices.audio))console.log('MICROPHONE: '+x);
    console.log('STATUS: DEVICE_DISCOVERY_COMPLETE');return;
  }
  if(!devices.video.length||!devices.audio.length)throw new Error('CAMERA_OR_MICROPHONE_MISSING');
  const outputDir=resolve(options['--output-dir']??join(process.env.LOCALAPPDATA??process.cwd(),'SCC380','av-tests'));
  await mkdir(outputDir,{recursive:true});
  const video=devices.video.find(x=>/camera|webcam|كاميرا/i.test(x))??devices.video[0];
  const errors=[];
  let index=0;
  for(const audio of sortedAudio(devices.audio)){
    index++;
    const name='scc380-av-'+new Date().toISOString().replace(/[.:]/g,'-')+'-'+process.pid+'-'+index;
    const file=join(outputDir,name+'.mp4');
    try{await stat(file);throw new Error('OUTPUT_ALREADY_EXISTS');}
    catch(e){if(e.code!=='ENOENT')throw e;}
    console.log('CAPTURE_ATTEMPT: '+index+' SELECTED_MICROPHONE: '+audio);
    const capture=await run(ffmpeg,recordingArgs(video,audio,duration,file),(duration+35)*1000);
    if(capture.code!==0){errors.push('CAPTURE_FAILED');continue;}
    const probe=await run(ffprobe,['-v','error','-show_entries',
      'format=duration:stream=codec_type,codec_name,duration','-of','json',file]);
    if(probe.code!==0){errors.push('PROBE_FAILED');continue;}
    const assessment=assessStreams(JSON.parse(probe.out),duration);
    const report={...assessment,videoSource:video,audioSource:audio,file,
      note:'Structural checks do not establish perceptual sync, long-run drift or microphone failover.'};
    const reportPath=join(outputDir,name+'.report.json');
    await writeFile(reportPath,JSON.stringify(report,null,2),{flag:'wx'});
    if(assessment.valid){
      console.log('STATUS: AV_RECORDING_PASS');
      console.log('VIDEO_FILE: '+file);
      console.log('REPORT_FILE: '+reportPath);
      console.log('DURATION_DIFFERENCE_MS: '+assessment.deltaMs);
      console.log('PERCEPTUAL_SYNC: UNVERIFIED');return;
    }
    errors.push('INVALID_TRACKS');
  }
  throw new Error('ALL_AUDIO_SOURCES_FAILED: '+[...new Set(errors)].join(','));
}
if(process.argv[1]&&fileURLToPath(import.meta.url)===resolve(process.argv[1]))
  main().catch(e=>{console.error('STATUS: FAIL '+e.message);process.exitCode=1;});
