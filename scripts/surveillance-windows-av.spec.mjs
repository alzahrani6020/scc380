import {test} from 'node:test';
import assert from 'node:assert/strict';
import {parseDevices,sortedAudio,recordingArgs,assessStreams} from './surveillance-windows-av.mjs';
const listing=[
'[dshow @ 0000] DirectShow video devices (some may be both video and audio devices)',
'[dshow @ 0000]  "USB2.0 FHD UVC WebCam"',
'[dshow @ 0000]     Alternative name "@device_pnp_\\?\\usb#vid_0000"',
'[dshow @ 0000] DirectShow audio devices',
'[dshow @ 0000]  "Microphone Array (Realtek(R) Audio)"',
'[dshow @ 0000]  "Headset (Bluetooth Audio)"',
'[dshow @ 0000]     Alternative name "@device_cm_0000"'
].join('\r\n');
test('detect Windows cameras/microphones without treating alt device paths as devices',()=>{
 const d=parseDevices(listing);
 assert.deepEqual(d.video,['USB2.0 FHD UVC WebCam']);
 assert.deepEqual(d.audio,['Microphone Array (Realtek(R) Audio)','Headset (Bluetooth Audio)']);
 assert.deepEqual(sortedAudio(d.audio),['Headset (Bluetooth Audio)','Microphone Array (Realtek(R) Audio)']);
});
test('capture maps audio and video, uses AAC/H264 resampling and no overwrite flag',()=>{
 const a=recordingArgs('USB2.0 FHD UVC WebCam','Microphone Array',15,'C:\\Temp\\new.mp4');
 assert.ok(a.includes('-n'));assert.ok(!a.includes('-y'));
 assert.ok(a.includes('-map'));assert.ok(a.includes('0:v:0'));assert.ok(a.includes('0:a:0'));
 assert.ok(a.includes('aresample=async=1:first_pts=0'));
 assert.equal(a.at(-1),'C:\\Temp\\new.mp4');
 assert.throws(()=>recordingArgs('cam','mic',0,'new.mp4'),/INVALID_CAPTURE_ARGUMENT/);
});
test('two tracks pass structural recording acceptance but not perceptual synchronization',()=>{
 const info={format:{duration:'15.01'},streams:[
 {codec_type:'video',codec_name:'h264',duration:'15.00'},
 {codec_type:'audio',codec_name:'aac',duration:'14.98'}
 ]};
 const a=assessStreams(info,15);
 assert.equal(a.valid,true);
 assert.equal(a.deltaMs,20);
 assert.equal(a.perceptualSyncVerified,false);
 assert.equal(assessStreams({...info,streams:info.streams.slice(0,1)},15).valid,false);
});
