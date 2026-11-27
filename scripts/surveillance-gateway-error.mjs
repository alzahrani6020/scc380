// Controlled diagnostics for failed gateway HTTP requests.
// Never echo the Authorization bearer, raw response, headers or user-defined error text.
const knownReasons = new Map([
  ['Valid gateway authentication required', 'GATEWAY_TOKEN_FORMAT_OR_MISSING'],
  ['Gateway credentials rejected', 'GATEWAY_TOKEN_NOT_RECOGNIZED_OR_REVOKED'],
  ['Camera not assigned to this gateway site', 'CAMERA_SITE_TENANT_MISMATCH'],
  ['Gateway revoked', 'GATEWAY_REVOKED_DURING_REQUEST'],
  ['Duplicate camera IDs', 'DUPLICATE_CAMERA_IDS'],
  ['Invalid gateway heartbeat payload', 'INVALID_HEARTBEAT_PAYLOAD'],
]);
export function categorizeGatewayError(status, parsedBody) {
  if (status !== 403 && status !== 400) return 'HTTP_' + status;
  const message = parsedBody && typeof parsedBody === 'object' &&
    typeof parsedBody.message === 'string' ? parsedBody.message : '';
  return knownReasons.get(message) || 'HTTP_' + status + '_UNCLASSIFIED';
}
export async function gatewayFailure(response) {
  // No trust in response text or HTML. Parse a bounded JSON object, then
  // output ONLY a hardcoded diagnostic category from the static allowlist.
  let parsed = null;
  try {
    const contentType = response.headers?.get('content-type') || '';
    if (contentType.includes('application/json')) {
      const text = await response.text();
      if (text.length <= 1024) parsed = JSON.parse(text);
    }
  } catch { /* keep generic error */ }
  return 'HTTP ' + response.status + ' reason=' + categorizeGatewayError(response.status, parsed);
}
