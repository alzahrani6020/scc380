# SCC380 Surveillance — original-scope acceptance register

This register is a **non-optional acceptance checklist**, not a claim that CI or a merged PR is a production VMS. It covers camera types, branches, sound, synchronized recording, control, intelligent incidents, maintenance, security, playback and field acceptance. No task may be marked PASS until the listed customer-visible behavior is verified. The cloud UI, media-plane gateway and Windows workstation are separate components.

| Area | Existing grounded evidence | Acceptance still required | Status |
|---|---|---|---|
| 1. Camera/vendor enrollment | Existing site and camera records; RTSP OPTIONS, initial ONVIF/PTZ pilot | Physical ONVIF discovery and verified vendor profiles; multi-brand acceptance | PARTIAL |
| 2. Multi-site control center | Tenant-scoped sites, gateways, heartbeat and operations UI | Production A/B tenant and large-fleet acceptance | PARTIAL |
| 3. >200 camera navigation | Read-only JWT-tenant fleet paging/search in PR #258; CI isolated tenant tests | API deployment + real tenant pages >200, concurrent writes and latency | TESTED IN CI, NOT DEPLOYED |
| 4. Live multi-camera streaming | MediaMTX local HLS/WebRTC runbook; local RTSP pilot; links | Authenticated continuous mosaic, multi-branch VPN/relay, capacity | PARTIAL |
| 5. Audio input capture | Windows DirectShow discovery, AAC + H264 short pilot; synthetic AV CI | Actual Windows wired/wireless/headset/USB failover testing | PARTIAL |
| 6. Sync and audio failover | FFmpeg aresample, ffprobe structural report | Perceptual A/V sync; long-duration drift, source switchover without gap | UNVERIFIED |
| 7. Continuous and scheduled recording | MediaMTX local fMP4 rolling segments | Event/scheduled retention with lifecycle & indexed playback | PARTIAL |
| 8. Playback and index | Authenticated local MediaMTX API via PowerShell; MP4 manual in-browser playback | No Basic Auth error in Chrome; index UI and seamless playback | PARTIAL |
| 9. Smart detection and alarms | Incident manual entry + role-controlled read/write | On-device motion/sound detection, thresholds, false positive test | NOT IMPLEMENTED |
| 10. Camera PTZ and talkback | Short-lived commands, ONVIF pilot, ACK audit | Real PTZ, optical zoom/focus, vendor talkback and audio | UNVERIFIED |
| 11. Maintenance and cleaning | Existing create/update/close tasks | Scheduled recurring maintenance, sensor health, operator alerts | PARTIAL |
| 12. Privacy and tenant isolation | JWT tenant-bound REST + gateway token; isolated CI tests | Media-plane SSO, audio permissions, per-company encryption, two-tenant media access | PARTIAL |
| 13. Evidence exports and audit | Recorded local MP4 and incident registry | Signed evidence manifest, who/when download log, verified checksums | NOT IMPLEMENTED |
| 14. Offline recording and synchronization | On-prem MediaMTX can persist while upstream unavailable | Sync queue, backpressure, bandwidth/offline endurance test | NOT IMPLEMENTED |
| 15. Capacity and observability | Recent heartbeat and synthetic media CI | 1/10/100/1000-camera measured ingest and live egress, storage alarms | UNVERIFIED |
| 16. Multi-client UX | Web monitoring UI with local file player | Mobile browser, full native mobile, accessible control and field acceptance | PARTIAL |

## Delivery gates

1. **Code gate:** targeted unit tests, API build, web build and isolated two-tenant API tests must pass on exact commit.
2. **Production compatibility gate:** inspect current Render image `ghcr.io/alzahrani6020/scc380-api-prod:c17f6f5022d0e907fdedb600709faf2485898edb`, pending main changes and image build/pin workflow before updating API. A build can deploy unrelated code; passing tests alone does not authorize replacement.
3. **Media security gate:** no camera URLs or secrets in browser URLs or public git; no new public ports; isolate per-site/tenant streams and recordings separately from JWT-scoped metadata.
4. **Hardware gate:** operator-authorized real camera/mic with a clap/talking test must establish both tracks and perceptual lip-sync; RTSP OPTIONS, ACK and ffprobe duration match do not establish actual AV quality.
5. **Functional gate:** playback/list under an authenticated session, PTZ stop/motion, talk only on compatible models, retention and offline reconnect must be checked independently.
6. **Reliability gate:** sustained durations, CPU/GPU load, disk-full, wired/wireless mic loss, link loss, recording segment integrity and reconnect behavior are measured on site.
7. **Acceptance gate:** cross-tenant media access rejection, privacy controls, audit, export and mobile UX before declaring the enterprise VMS complete.

## Known next integration order

- API fleet paging in PR #258 is **CI-tested but not deployed**: the UI must not be promoted before a compatible deployed `/surveillance/fleet` API returns bounded results. The previous `GET /surveillance/cameras` is limited to 200 and remains intact for legacy selectors.
- Verify Render API image promotion and rollback path independently; Vercel READY does not imply API-ready.
- Make real audio capture and MediaMTX authenticated recording index work on the operator's Windows PC without operator password/clipboard manipulation.
- Implement cloud-to-site media access using an authorized tenant-scoped relay or VPN, not a public localhost URL.
- Move feature statuses to PASS only when original acceptance cases are observed. Do not fabricate hardware acceptance or mark an abstract roadmap item as done.
