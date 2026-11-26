# SCC380 Surveillance — pilot camera connection and acceptance

**Production interface:** https://scc380-web-dr-talal.vercel.app/dashboard/surveillance
**Current product:** Metadata workflows for sites, camera inventory, preventive maintenance and incident handling. This is *not* a deployed VMS media gateway. Live RTSP, ONVIF PTZ, outbound speaker audio and recording retrieval remain pending; never tell a pilot customer those controls are already operational.

## Safe pilot prerequisites

1. Create a test tenant/site using an existing authorized SCC380 account (no new platform owner or automatic membership).
2. For each device, collect **non-secret** details: manufacturer, exact model, firmware version, fixed or PTZ, optical zoom support, microphone, speaker, wiper/washer, NVR/DVR vs direct IP, indoor/outdoor, ONVIF profiles and device documentation.
3. Record company, branch/site, physical position, on-site contact, local LAN/VPN camera IP and supported transport port **in the customer's controlled inventory**. Do not publish IPs or credentials in GitHub, screenshots, issue comments, browser JavaScript or camera notes accessible to other tenants.
4. Ensure an authorized technician has LAN/VPN access. Keep camera ports closed to the public internet. Use an outbound-only encrypted edge gateway for remote operation; device credentials live on the gateway in encrypted secret storage. No SSH, RTSP or ONVIF internet port forwarding.
5. Confirm audio use, recording and retention comply with the country's rules and site-specific consent/approval. Do not enable microphone/audio recordings by default.
6. Select a test camera from at least 3 different manufacturers where available, including one fixed IP camera and one PTZ/two-way-audio device if available.

## Technician connectivity check (Windows/Node.js)

Run **on a machine inside the same authorized camera LAN**, with Node.js 20+:

```powershell
node scripts/surveillance-camera-probe.mjs --host 192.168.1.20 --rtsp-port 554 --onvif-port 80
```

This is a **single-host diagnostic**, not subnet scanning, a discovery broadcast, credential verification, or a video decoder. It issues one RTSP OPTIONS request without credentials and a single TCP reachability check against the presumed ONVIF port.

| Result | Meaning | Next action |
| --- | --- | --- |
| `RTSP_OPTIONS_OK` | RTSP server replied to OPTIONS | Validate the actual stream URI and media decoding on the local gateway |
| `RTSP_AUTH_REQUIRED` | RTSP authentication requested | Authenticate on the local gateway; never post the password to SCC380 |
| `TIMEOUT` / `UNREACHABLE` | No response in allowed time | Check LAN, VPN and device/service availability |
| `REFUSED` | TCP connection rejected | Validate device port and service enablement |
| `TCP_OPEN_ONLY` (ONVIF) | ONVIF candidate port accepts TCP | **Not proof** of an ONVIF device or profile support |

**No video, sound, PTZ, voice command, footage retention or cross-site reliability is proved by this tool.** Run certified ONVIF capability negotiation and supported vendor APIs using a secured edge gateway and test camera.

## Customer-facing acceptance matrix

| Acceptance | Verify | Result before actual devices |
| --- | --- | --- |
| Open company Surveillance page with active session | Page loads and current tenant is correct | Requires authenticated browser check |
| Register site and camera | Create, reload, and confirm persisted values | Testable now |
| Prevent tenant B accessing camera A | Two separate authenticated tenant sessions | Covered in isolated automated tests; production acceptance pending |
| Register and complete cleaning/maintenance | Read-back after refresh and a second session | Testable now |
| Create, acknowledge and close incident | Persisted state, mandatory closure details, tenant denial | Testable now |
| On-site connectivity | Technician probe from LAN/VPN | PENDING DEVICE |
| RTSP live playback/WebRTC stream | Real encrypted gateway, authorized browser | NOT IMPLEMENTED |
| Two-way talk | Real compatible microphone/speaker and vendor adapter | NOT IMPLEMENTED |
| PTZ optical zoom/presets/wiper | Device-specific ONVIF/vendor commands and stop-on-release | NOT IMPLEMENTED |
| Record/retrieve footage and audit | Actual recorder with verified retention policy | NOT IMPLEMENTED |
| Multi-site failover, capacity, SLA | Fault injection and measured load | NOT IMPLEMENTED |

## Integration contract for next implementation

**Do not call camera IPs, RTSP/ONVIF URLs or user-supplied hostnames from the public SCC380 API**, because that creates SSRF and private-network exposure risk. The browser contacts SCC380's authenticated API for authorization and obtains a short-lived media session, while an **outbound-only edge connector** receives signed commands over a secure channel.

Gateway requirements:
- One registered gateway identity and hardware key per customer site, with revocable short-lived credentials and tenant/site binding.
- Pairing flow must require approval by authorized company administrator and never generate user memberships.
- Local camera secrets remain gateway-side, never in PostgreSQL and never in browser logs or URLs.
- Explicit `capabilities` negotiation: `video`, `audio_in`, `audio_out`, `ptz_pan`, `ptz_tilt`, `optical_zoom`, `wiper`, `washer`, `recording`.
- Every PTZ/talk command binds to camera ID, tenant ID, role and short-lived operator lease. Fail closed on disconnection, revoke lease and send STOP for PTZ.
- Strict outbound media destinations, timeouts and rate limits; no unrestricted URL fetch or public camera IP.
- Idempotent event delivery and disconnected buffering; recording retention remains local/site-level according to policy.

**Release checkpoint:** distinguish GitHub merge, API image LIVE, Prisma migration completion, Vercel READY + alias, authenticated production tenant workflows, and physical camera acceptance. All are separate conditions; do not infer one from another.

## Outbound-only site agent (new)

1. In SCC380 /dashboard/surveillance -> **ربط الفروع**, create a gateway for a company-owned site. Copy the one-time key to a protected machine at that site.
2. From the same tenant, register cameras and copy their SCC380 camera IDs. On the site machine, create a local, **not committed to Git**, config file:

```json
{
  "cameras": [
    {"cameraId":"REPLACE_WITH_SCC380_CAMERA_ID","host":"192.168.1.20","port":554}
  ]
}
```

3. Set `SCC_GATEWAY_TOKEN` in a protected machine/environment secret (not a command-line argument). Then run `node scripts/surveillance-site-agent.mjs --config /private/site-cameras.json` locally within the authorized LAN. Schedule repeat runs through the site's operating system only after checking network and device load.
4. Verify the gateway's `lastSeenAt` and camera's `lastSeenAt` in SCC380 and repeat after restart and network interruption. Revoke the gateway in the UI if its token is lost.
5. **This initial agent reports RTSP OPTIONS availability only.** A 200 or 401 response indicates RTSP service reachability, NOT viewable video, ONVIF compliance, or availability of audio, PTZ, wiper, records, two-way talk and AI. Nothing in this script reads or sends camera credentials.
6. Do not interpret the last reported `ONLINE` status as live availability when heartbeat timestamps are stale. A site can lose its network without being able to tell the server it went offline.

Security: never expose device ports publicly; restrict the gateway host to appropriate LAN devices; do not store secrets in config or SCC380's camera inventory; retain TLS verification, server-side site/tenant validation and explicit revocation. For a true VMS connection use an approved secure gateway with authenticated ONVIF/RTSP, WebRTC media relay, PTZ safety stops and audio/legal controls.
