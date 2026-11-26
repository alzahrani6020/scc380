// Site-only ONVIF PTZ adapter. No cloud-side device addresses or credentials.
// Requires a device-scoped private LAN address and explicit opt-in at each site.
import { createHash, randomBytes } from 'node:crypto';
import { setTimeout as sleep } from 'node:timers/promises';

const actions = {
  PTZ_LEFT: [-0.25, 0, 0], PTZ_RIGHT: [0.25, 0, 0],
  PTZ_UP: [0, 0.25, 0], PTZ_DOWN: [0, -0.25, 0],
  ZOOM_IN: [0, 0, 0.25], ZOOM_OUT: [0, 0, -0.25],
};
const xml = value => String(value).replace(/[&<>"']/g, ch => ({
  '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&apos;',
})[ch]);
const sha1 = buf => createHash('sha1').update(buf).digest('base64');
const privateIp = host => {
  if (host === '127.0.0.1' && process.env.SCC380_ONVIF_TEST_LOCAL === 'YES') return true;
  const m = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/.exec(host);
  if (!m) return false; // No DNS names: avoid resolution to external IPs / rebinding.
  const parts = m.slice(1).map(Number);
  if (parts.some(n => n > 255)) return false;
  return parts[0] === 10 || (parts[0] === 172 && parts[1] >= 16 && parts[1] <= 31)
    || (parts[0] === 192 && parts[1] === 168);
};
function validate(camera) {
  if (!privateIp(camera.host) ||
      !Number.isInteger(camera.onvifPort) || camera.onvifPort < 1 || camera.onvifPort > 65535 ||
      !/^[A-Za-z0-9_.:-]{1,80}$/.test(camera.profileToken ?? '') ||
      !/^[A-Z][A-Z0-9_]{1,79}$/.test(camera.usernameEnv ?? '') ||
      !/^[A-Z][A-Z0-9_]{1,79}$/.test(camera.passwordEnv ?? '') ||
      !process.env[camera.usernameEnv] || !process.env[camera.passwordEnv])
    throw new Error('ONVIF_CONFIG_UNAVAILABLE');
  return { user:process.env[camera.usernameEnv], password:process.env[camera.passwordEnv] };
}
function envelope(inner, user, password) {
  const nonce = randomBytes(20);
  const created = new Date().toISOString();
  const digest = sha1(Buffer.concat([nonce, Buffer.from(created), Buffer.from(password)]));
  return '<?xml version="1.0" encoding="UTF-8"?>' +
    '<s:Envelope xmlns:s="http://www.w3.org/2003/05/soap-envelope" ' +
    'xmlns:tptz="http://www.onvif.org/ver20/ptz/wsdl" ' +
    'xmlns:tt="http://www.onvif.org/ver10/schema" ' +
    'xmlns:wsse="http://docs.oasis-open.org/wss/2004/01/oasis-200401-wss-wssecurity-secext-1.0.xsd" ' +
    'xmlns:wsu="http://docs.oasis-open.org/wss/2004/01/oasis-200401-wss-wssecurity-utility-1.0.xsd">' +
    '<s:Header><wsse:Security s:mustUnderstand="1"><wsse:UsernameToken>' +
    '<wsse:Username>'+xml(user)+'</wsse:Username>' +
    '<wsse:Password Type="http://docs.oasis-open.org/wss/2004/01/oasis-200401-wss-username-token-profile-1.0#PasswordDigest">'+digest+'</wsse:Password>' +
    '<wsse:Nonce EncodingType="http://docs.oasis-open.org/wss/2004/01/oasis-200401-wss-soap-message-security-1.0#Base64Binary">'+nonce.toString('base64')+'</wsse:Nonce>' +
    '<wsu:Created>'+created+'</wsu:Created></wsse:UsernameToken></wsse:Security></s:Header>' +
    '<s:Body>'+inner+'</s:Body></s:Envelope>';
}
async function send(camera, creds, action, inner) {
  // Static trusted ONVIF service path, no user-provided URL, no redirects, no proxy.
  const path = camera.ptzPath ?? '/onvif/ptz_service';
  if(!/^\/onvif\/[A-Za-z0-9/_-]{1,100}$/.test(path) || path.includes('..'))
    throw new Error('ONVIF_PATH_NOT_ALLOWED');
  const url = 'http://'+camera.host+':'+camera.onvifPort+path;
  const response=await fetch(url,{method:'POST',redirect:'error',signal:AbortSignal.timeout(3000),
    headers:{'Content-Type':'application/soap+xml; charset=utf-8; action="http://www.onvif.org/ver20/ptz/wsdl/'+action+'"'},
    body:envelope(inner,creds.user,creds.password)});
  const body=await response.text();
  if (!response.ok || /<(?:[\w-]+:)?Fault(?:\s|>)/i.test(body) ||
      !new RegExp('(?:<|:)' + action + 'Response(?:\\s|/|>)').test(body))
    throw new Error('ONVIF_'+action.toUpperCase()+'_REJECTED');
}
export async function executePtz(camera, action) {
  if (action !== 'PTZ_STOP' && !Object.hasOwn(actions,action)) throw new Error('ONVIF_ACTION_UNSUPPORTED');
  const creds=validate(camera);
  const token=xml(camera.profileToken);
  const stop='<tptz:Stop><tptz:ProfileToken>'+token+'</tptz:ProfileToken><tptz:PanTilt>true</tptz:PanTilt><tptz:Zoom>true</tptz:Zoom></tptz:Stop>';
  if (action === 'PTZ_STOP') { await send(camera,creds,'Stop',stop); return; }
  const [x,y,z]=actions[action];
  const velocity=z ? '<tt:Zoom x="'+z+'"/>' : '<tt:PanTilt x="'+x+'" y="'+y+'"/>';
  const move='<tptz:ContinuousMove><tptz:ProfileToken>'+token+'</tptz:ProfileToken><tptz:Velocity>'+
    velocity+'</tptz:Velocity><tptz:Timeout>PT0.4S</tptz:Timeout></tptz:ContinuousMove>';
  let moveError;
  try { await send(camera,creds,'ContinuousMove',move); await sleep(180); }
  catch(error) { moveError=error; }
  // Fail closed: always attempt Stop, even if movement acknowledgment fails.
  await send(camera,creds,'Stop',stop);
  if (moveError) throw moveError;
}
