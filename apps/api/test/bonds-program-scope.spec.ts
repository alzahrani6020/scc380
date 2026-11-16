import test from 'node:test';
import assert from 'node:assert/strict';
import { allowedBondsProgramsForRoute, checkBondsProgramScope } from '../src/auth/bonds-program-scope';

test('all 11 BONDS products have at least one original SCC API route', () => {
 const routes: Record<string,string> = {
  crm:'/crm/contacts',hr:'/hr/employees',real_estate:'/real-estate/properties',
  fleet:'/fleet/vehicles',sales:'/erp/invoices',purchasing:'/supplier',
  inventory:'/inventory',finance:'/finance/payments',
  accounting:'/finance/journal-entries',projects:'/projects/tasks',
  governance:'/compliance',
 };
 assert.equal(Object.keys(routes).length,11);
 for(const [program,route] of Object.entries(routes)){
   assert.equal(checkBondsProgramScope({bondsOrigin:true,bondsProgramKey:program},route,'GET'),true,program);
 }
});
test('BONDS program scope denies cross-program and unknown business routes',()=>{
 const onlyCRM={bondsOrigin:true,bondsProgramKey:'crm'};
 for(const path of ['/hr/payroll-runs','/finance/journal-entries','/real-estate/lease-contracts',
   '/government','/analytics','/reports','/security/api-keys','/billing/subscriptions',
   '/auth/logout-all','/integrations/bonds/verify-mapping','/unknown/route']){
   assert.equal(checkBondsProgramScope(onlyCRM,path,'GET'),false,path);
 }
 assert.equal(checkBondsProgramScope(onlyCRM,'/crm/contacts','GET'),true);
 assert.equal(checkBondsProgramScope(onlyCRM,'/crm/contacts','POST'),true);
});
test('accounting is separated from finance and purchase orders',()=>{
 assert.equal(checkBondsProgramScope({bondsOrigin:true,bondsProgramKey:'accounting'},
   '/finance/payments','GET'),false);
 assert.equal(checkBondsProgramScope({bondsOrigin:true,bondsProgramKey:'finance'},
   '/finance/journal-entries','POST'),false);
 assert.equal(checkBondsProgramScope({bondsOrigin:true,bondsProgramKey:'purchasing'},
   '/finance/purchase-orders','POST'),true);
 assert.equal(checkBondsProgramScope({bondsOrigin:true,bondsProgramKey:'crm'},
   '/finance/purchase-orders','GET'),false);
});
test('HR governance scope is available to HR and governance, not CRM',()=>{
 assert.deepEqual(allowedBondsProgramsForRoute('/hr/governance/cases','GET'),['hr','governance']);
 assert.equal(checkBondsProgramScope({bondsOrigin:true,bondsProgramKey:'governance'},
  '/hr/governance/cases','POST'),true);
});
test('normal SCC380 users remain unaffected by the BONDS integration',()=>{
 for(const path of ['/hr/payroll-runs','/finance/journal-entries','/security/api-keys']){
   assert.equal(checkBondsProgramScope({role:'ADMIN'},path,'POST'),true);
 }
});
test('invalid scope, URL traversal and API injection fail closed',()=>{
 for(const path of ['/../hr/employees','/hr/%2e%2e/finance','/random/unknown']){
  assert.equal(checkBondsProgramScope({bondsOrigin:true,bondsProgramKey:'hr'},path,'GET'),false);
 }
 assert.equal(checkBondsProgramScope({bondsOrigin:true,bondsProgramKey:'all'},
   '/hr/employees','GET'),false);
 assert.equal(checkBondsProgramScope({bondsOrigin:true},'/hr/employees','GET'),false);
});
