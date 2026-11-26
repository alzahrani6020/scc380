# SCC380 surveillance integrations — workspace/company boundary and fleet dashcams

## Company/workspace scope

Each authenticated SCC380 workspace is represented by its existing tenant ID. Surveillance sites, cameras, gateways, incident records and dashcam links all remain inside that tenant. The module does **not** create another workspace, membership or invitation.

A fleet dashcam is registered as a camera with a `DASHCAM_FRONT`, `DASHCAM_REAR`, `DASHCAM_CABIN` or `DASHCAM_MULTI` type. It can optionally reference an **already existing vehicle in the same tenant**. A camera is attached to a surveillance site representing its operational depot/gateway, not to a vehicle's changing GPS position. Vehicle tracking data is reported separately and is never treated as verified just because it is recorded.

## Integration paths (device compatibility is not universal)

| Device/vendor interface | Current integration level | Required conditions |
| --- | --- | --- |
| Fixed camera RTSP / ONVIF | Outbound site gateway reports availability; separately gated PTZ adapter and local MediaMTX live recording | Supported URLs/codecs, trusted site machine, local credentials, optional on-site acceptance |
| Vehicle dashcam with RTSP on LAN | Same camera registration and site gateway RTSP probe; optional local media relay | Connectivity to the dashcam (e.g. vehicle dock or authorized private mobile tunnel) and valid RTSP endpoint |
| Vehicle dashcam that exports its position to a local file | Fresh GPS coordinates can be forwarded by the authenticated site gateway | Trusted vendor-side telemetry exporter and a file under site control |
| Manufacturer fleet cloud APIs | `VENDOR_ADAPTER` enrollment marker only, **not integrated yet** | Vendor API documentation, credentials, permission and an independently reviewed adapter |
| Proprietary DVR/NVR, LTE P2P or dashcam without RTSP | Unsupported until a compatible site/vendor adapter is built | Vendor support and test device |

**Do not claim that all camera brands are operationally compatible.** Some models need vendor SDKs, proprietary authentication, relay services or cloud contracts. No credentials, vendor access tokens or raw media are stored in SCC380 cloud from the camera enrollment workflow.

## Register a dashcam

1. Open SCC380 Surveillance inside the company's existing authenticated workspace.
2. Add a surveillance site (fleet depot, logistics branch or fleet control room) if needed.
3. Open `داش كام المركبات`, select the site and optionally select a vehicle from the company's existing fleet list.
4. Enter type, manufacturer, model, supported audio and connector protocol. `DASHCAM_RTSP` means the device has **declared** compatibility; it does not automatically provision or open a network stream.
5. Register and reload the company camera list. Unconfigured cameras remain unverified until site gateway reports establish connectivity.
6. For a network-accessible RTSP dashcam, enroll a **site-specific** outbound gateway and use its local configuration as in `surveillance-pilot-onboarding.md`. Do not open public ports on moving vehicles.
7. For manufacturer API devices, request documentation and deploy a device-specific adapter after independent authorization, security and compatibility tests.

## Optional authenticated GPS forwarding

The Node.js site agent can accept a local optional `telemetryFile` for a camera, for example:

```json
{"cameras":[{"cameraId":"REGISTERED_DASHCAM_ID","host":"192.168.1.20","port":554,"telemetryFile":"/private/dashcam-location.json"}]}
```

The local vendor adapter (not included for any particular brand) writes:

```json
{"latitude":21.54321,"longitude":39.19876,"timestamp":"2026-11-27T00:00:00Z"}
```

The sample timestamp above is illustrative; real data must be current. Coordinates are accepted only when the file's timestamp is within 120 seconds of the agent's clock. If absent/stale/malformed, the agent sends no location; the gateway still attempts the camera heartbeat. The server accepts valid coordinates only for an authenticated same-tenant, same-site enrolled dashcam. It records server receipt time and the reported location for the company's operator, **not independent GPS accuracy or vehicle ownership verification**.

For mobile LTE fleets, a vendor adapter may need to report through an authorized outbound service instead of an on-prem RTSP gateway. That adapter is **not** installed by merely selecting `VENDOR_ADAPTER`.

## Production acceptance

Test at least one approved physical brand/model for each transport: authorized enrollment, GPS report freshness and loss, cross-company access denial, missing network, trip start/stop, video and sound (if available), local or vendor recording and retrieval, and correct handling of vendor credential revocation. Fleet location visibility may be sensitive; apply company authorization, lawful use, data retention limits and proper driver notification before enabling continuous tracking.

**Current confidence:** database/API/UI isolation can be tested in CI; physical cameras, vendor accounts, cellular coverage and GPS accuracy remain UNKNOWN without field tests.
