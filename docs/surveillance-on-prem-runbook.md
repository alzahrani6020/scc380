# SCC380 camera site — ONVIF PTZ, live video, audio reception, and recordings

This is an opt-in **site-local** integration. It is not a hosted cloud VMS and it does not add an audio talkback channel. End-to-end customer-site acceptance is required.


## A0. Private-network RTSP discovery (read-only)

Before enrolling a physical camera, run a **local-only** RTSP preflight from an authorized PC on the same LAN or approved VPN. This script probes exactly one numeric RFC1918 address; it refuses public addresses, loopback, hostnames and URL credentials. It does not authenticate to the camera, stream video, create SCC380 records, or send a production heartbeat.

```powershell
$repo = "C:\Users\vip\scc380-camera-agent"
git -C $repo pull --ff-only origin main
$cameraIP = Read-Host "Authorized camera private IPv4"
$cameraPort = Read-Host "RTSP port (usually 554)"
node (Join-Path $repo "scripts\surveillance-physical-camera-preflight.mjs") $cameraIP $cameraPort
```

Expected possible results:

- `RTSP_200`: device RTSP protocol accepted OPTIONS (video not proven)
- `RTSP_AUTH_REQUIRED`: RTSP server responds but credentials may be required for media
- `UNREACHABLE` / `TIMEOUT`: routing, IP, port, firewall or device service still need verification
- `RTSP_404` or other RTSP code: server responded but this is not a compatible successful preflight

Do not copy device passwords or RTSP URLs into this command or the chat. Do not replace the existing simulation camera with a physical device. Once preflight passes, enroll the actual camera under the correct site and gateway and test source video separately under the media section below.

## A. Enroll site cameras

1. In SCC380 > Surveillance, create the site, camera IDs, and one site gateway. Use only a camera and network you are authorized to administer.
2. Install Node.js 24+ and MediaMTX (pinned reviewed version) on a secured, always-on workstation **inside that site's network**. Never expose RTSP ports, ONVIF ports, MediaMTX web listeners or site camera credentials directly to the Internet.
3. Keep the gateway enrollment token as `SCC_GATEWAY_TOKEN` in a local protected environment, not in a script, screenshot, repository or URL.
4. Example `/private/site-cameras.json` (no credentials):

```json
{"cameras":[{"cameraId":"CAMERA_ID_FROM_SCC380","host":"192.168.1.20","port":554}]}
```

5. Run the existing site agent regularly, typically once a minute only if site capacity supports this. It reports RTSP `OPTIONS` reachability, not decoded video.

## B. Physical ONVIF PTZ — explicit double opt-in

The cloud API already holds 15-second requests, tenant/site-scoped. This pilot adds an atomic claim, one-time completion lease and bounded ONVIF `ContinuousMove` followed by `Stop`. The client never supplies host or credentials.

Local private `/private/site-onvif.json`:

```json
{"devices":[{"cameraId":"CAMERA_ID_FROM_SCC380","host":"192.168.1.20","onvifPort":80,"ptzPath":"/onvif/ptz_service","profileToken":"PROFILE_TOKEN_FROM_DEVICE","usernameEnv":"SCC_PTZ_USER_1","passwordEnv":"SCC_PTZ_PASSWORD_1"}]}
```

- Credentials are loaded from local environment variables named in the config; never from SCC380 API. ONVIF addresses must be **numeric RFC1918 IPv4**. Only known `/onvif/...` PTZ service paths are permitted.
- **Production API gate:** `SCC_SURVEILLANCE_PTZ_PILOT_ENABLED=YES`. Keep disabled unless explicit operator/device authorization is complete.
- **Local site gate:** `SCC_ONVIF_PTZ_ENABLED=YES`, and `SCC_ONVIF_CONFIG=/private/site-onvif.json`. Both gates are necessary; absent gates cause safe `UNSUPPORTED` rejection.
- Start `node scripts/surveillance-site-agent.mjs --config /private/site-cameras.json` from the site. Use a dedicated service account, secrets restricted to that account, and outbound HTTPS only.
- An API status of `ACKNOWLEDGED` means the device responded to the SOAP request; **camera movement is still not visually verified**. `Stop` is attempted after every move, even on error. Actual response, timing and zoom extent must be checked on real models before production authorization.
- Disable either opt-in, revoke the gateway, or take the physical device offline if results are unexpected. These are site/operator actions, not a remote cloud safety interlock.

## C. Local media server: HLS, WebRTC, source audio, rolling recordings

MediaMTX is an external free/open-source service; **this repository does not install or run MediaMTX automatically**. Its generated private config uses separate restricted viewer credentials and no anonymous viewer. It binds web listeners to loopback so it cannot be accessed from the public Internet.

Private `/private/media-devices.json`:

```json
{"recordingDirectory":"/var/lib/scc380/recordings","devices":[{"cameraId":"CAMERA_ID_FROM_SCC380","rtspUrlEnv":"SCC_MEDIA_RTSP_1"}]}
```

Set `SCC_MEDIA_RTSP_1` to the camera RTSP URL (on a private IP, including credentials if required), set strong `SCC_MEDIA_VIEWER_USER` and `SCC_MEDIA_VIEWER_PASSWORD` in the protected local environment. Generate config **outside the repository**:

```sh
node scripts/surveillance-media-config.mjs --config /private/media-devices.json --output /private/mediamtx.yml
mediamtx /private/mediamtx.yml
```

The generator writes a **new, mode 0600** file and refuses to overwrite an existing config. The service reads RTSP camera feeds locally, serves authenticated HLS on `127.0.0.1:8888`, WebRTC on `127.0.0.1:8889`, and recorded footage lists/downloads on `127.0.0.1:9996`. It records continuously when a camera is reachable and expires local media after 24 hours. Sound **from** the camera is available only if that camera exposes a browser-supported audio codec. Talking **to** the camera is not implemented.

To access from an authorized computer outside the branch, establish an **authenticated private tunnel/VPN** with your network administrator, then forward the necessary on-prem endpoints to loopback. For example, forward `8888` and `9996` through an authenticated SSH tunnel; these numbers alone do not enable any public streaming. Open the new SCC380 Surveillance > `البث والتسجيلات` tab and use the camera's local links. A WebRTC connection may require additional UDP/ICE network configuration even with port forwarding; use HLS for the simpler tunnel-based pilot.

MediaMTX will request its **site-only** viewer username/password. Do not put them into links or query strings. Without a running MediaMTX server, authorized tunnel and a real camera, the browser links are intentionally unavailable.

## D. Acceptance gates

1. One authorized camera sends correct PTZ movement and automatic stop; an unauthorized or foreign-company user cannot claim a command, and replay/expiry fails.
2. View 30 seconds of real video and optional source audio on the site, then remotely over an approved private tunnel; measure transport delay and loss.
3. Confirm local rolling recordings, time range search, clip playback and 24h retention, including disconnected-camera behavior and free disk.
4. Confirm two separate companies never share gateway tokens, camera video addresses, recording credentials or playback rights. The on-site media service is not automatically tied to SCC380 SaaS JWT; each site's separate local authentication remains mandatory.
5. Test device vendor/profile compatibility and physical controls before enabling either PTZ opt-in.

**NOT IMPLEMENTED:** cloud-mediated live streaming without a tunnel, cross-site recording storage replication, ONVIF two-way talkback, user-session SSO into MediaMTX, production capacity guarantees. These are separate implementation and device acceptance requirements.


## E. Windows laptop webcam — local pilot in SCC380 UI (no public relay)

The tested Windows laptop pilot uses an existing Docker container called `scc380-camera-media-test`, with protected MediaMTX accounts, loopback host ports `8554` for RTSP, `8890` for HLS (not the already occupied `8888`), and `9996` for recordings. The publisher path is **`laptop`**, not the SCC380 CUID of a camera. Do not change the tenant's camera IDs or assign these media links to another company's camera.

In SCC380 Surveillance > **البث والتسجيلات** choose **فتح اختبار كاميرا اللابتوب**, on the **same Windows machine** where MediaMTX is listening. Use **فتح فهرس التسجيلات المحلي** to open `http://127.0.0.1:9996/list?path=laptop`, or **فتح المشاهدة المباشرة المحلية** to open `http://127.0.0.1:8890/laptop`. MediaMTX challenges for `laptopViewer` and the local viewer password. Do not enter SCC380 passwords or gateway tokens. The optional embedded preview can be blocked by browser HTTPS/HTTP mixed-content restrictions; the explicit new-tab links are the supported fallback. No automatic network request or camera activation occurs until a user clicks a local media action.

**Live viewing requires an actively publishing FFmpeg process.** The earlier bounded 15-second webcam feed has stopped, so recorded videos can still be enumerated, but no live frames are expected until the operator manually starts the camera publisher again with protected credentials. Never store RTSP credentials in the SCC380 SaaS application, browser localStorage, public URLs, chat or screenshot. Cloud SCC380 auth **does not govern** MediaMTX recordings; this remains a separate site-local authentication boundary. The trial proves local media routing only, not remote viewing, SSO, or a production live video service.


## F. Local MP4 playback when Chrome rejects MediaMTX HTTP Basic Auth

In SCC380 > المراقبة والكاميرات > البث والتسجيلات > فتح اختبار كاميرا اللابتوب, use **تشغيل تسجيل MP4 من جهازك** and select the already recovered MP4 from the local Windows TEMP directory. This uses a browser-created object URL and the native video element. It does not send the file, its metadata, or credentials to SCC380 or MediaMTX. The player is a separate fallback from the MediaMTX playback API, intended for **locally held recordings** after an authenticated download. It does not grant access to new recordings, replace MediaMTX authentication, or provide remote live streaming.

The MediaMTX 9996 Basic Auth browser error remains a separate, not-yet-root-caused issue; the successful PowerShell authenticated API download is not affected. Do not change local viewer secrets, drop recording files or open public ports to work around this issue. For a local user to browse new recordings they must use the separately authenticated API or otherwise obtain the file through authorized access.
