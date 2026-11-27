import assert from 'node:assert/strict';
import {test} from 'node:test';
import {categorizeGatewayError, gatewayFailure} from './surveillance-gateway-error.mjs';

test('403 gateway auth failure is distinguishable from company-site mismatch', async () => {
  for(const [message,reason] of [
    ['Gateway credentials rejected','GATEWAY_TOKEN_NOT_RECOGNIZED_OR_REVOKED'],
    ['Camera not assigned to this gateway site','CAMERA_SITE_TENANT_MISMATCH'],
    ['Valid gateway authentication required','GATEWAY_TOKEN_FORMAT_OR_MISSING'],
    ['Gateway revoked','GATEWAY_REVOKED_DURING_REQUEST'],
  ]) {
    const response=new Response(JSON.stringify({statusCode:403,message}),{
      status:403,headers:{'content-type':'application/json'}
    });
    assert.equal(await gatewayFailure(response),'HTTP 403 reason='+reason);
  }
});
test('never reflects secrets or arbitrary server error text',async()=>{
  const raw='Bearer sccg_abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ_notreal';
  const unknown=await gatewayFailure(new Response(JSON.stringify({message:raw}),{
    status:403,headers:{'content-type':'application/json'}
  }));
  assert.equal(unknown,'HTTP 403 reason=HTTP_403_UNCLASSIFIED');
  assert.ok(!unknown.includes('sccg_'));
  assert.equal(categorizeGatewayError(502,{message:raw}),'HTTP_502');
  const html=await gatewayFailure(new Response('<html>bad gateway</html>',{
    status:403,headers:{'content-type':'text/html'}
  }));
  assert.equal(html,'HTTP 403 reason=HTTP_403_UNCLASSIFIED');
});
