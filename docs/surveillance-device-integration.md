# SCC380 Surveillance — device command integration contract (pilot)

## Current production boundary

The existing outbound-only site agent can check RTSP reachability and report gateway and camera heartbeats. This addition **does not** implement media playback, recording, PTZ movement, or two-way audio. It creates a 15-second, tenant-scoped, auditable PTZ **intent** that the current site agent can only reject as `UNSUPPORTED`.

## Authorization and transport

- Company `ADMIN`/`MANAGER`/`SUPER_ADMIN` uses its session JWT for `POST /surveillance/device-commands`, with **only** `cameraId` and `action`. Unknown fields and a foreign tenant camera are rejected.
- The server derives tenant, site and gateway from session/database records; the client cannot choose them.
- Only cameras declared PTZ-capable with a recent **ONLINE** report and a recent active gateway may create an intent.
- The one-time-enrolled, site-specific gateway bearer token authenticates `GET /surveillance/device-commands/pending` and `POST /surveillance/device-commands/:id/reject`. A revoked token has no access.
- All command envelopes expire in 15 seconds. The server returns `deviceExecuted:false`. Polling returns `executionEnabled:false`.
- The baseline site agent, when run, checks the queue and explicitly rejects recognized commands as `UNSUPPORTED`. It never opens an ONVIF session or controls a camera.
- The admin view displays queue and rejected records, not fictional movement acknowledgments. No camera URL or password is sent to the API.

## Required before enabling actual physical device commands

1. Choose, install and independently verify an ONVIF/vendor adapter **inside** each authorized site; do not run server-origin network requests to customer device URLs.
2. Separate per-camera approved capabilities from user-declared capabilities; map a stable camera ID to a locally provisioned device identity. Store vendor credentials locally in a secret store, not API, GitHub, URL or logs.
3. Provide short-lived per-command authorization and atomic claim/ack semantics for concurrent agents; design reliable expiry, STOP priority, rate limits, and explicit operator permissions. Treat `QUEUED` and `REJECTED` as **not executed**.
4. Test a real movable camera and its zoom limits with the site owner's authorization, then verify revoke, offline/failover, tenant isolation and behavior on expiry before exposing physical controls.
5. Implement an authenticated, authorized media relay with measured bandwidth and TURN/WebRTC/HLS choices before promising remote video and two-way audio. Recording needs retention/deletion policies and an independently protected storage plane.

## Field acceptance gates

Until a pilot is physically exercised, record `UNKNOWN` for real camera video, PTZ, sound, recordings, cross-site WAN performance and device compatibility. Browser UI readiness and isolated DB tests alone cannot satisfy these gates.
