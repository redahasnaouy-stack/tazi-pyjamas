import {test} from 'node:test';
import assert from 'node:assert/strict';
import auth from '../netlify/functions/admin-auth.mjs';
import orders from '../netlify/functions/orders.mjs';
import {settings,issueSession,authenticated,sessionCookie,MAX_AGE,COOKIE} from '../netlify/lib/admin-auth.mjs';
const origin='https://store.example';
const request=(method='GET',body,cookie,otherOrigin=origin)=>new Request(origin+'/.netlify/functions/admin-auth',{method,headers:{Origin:otherOrigin,...(cookie?{Cookie:cookie}:{})},...(body?{body:JSON.stringify(body)}:{})});
test('environment credentials protect a signed, expiring, HttpOnly admin session',async()=>{
 const old={...Object.fromEntries(['ADMIN_EMAIL','ADMIN_PASSWORD','ADMIN_SESSION_SECRET'].map(k=>[k,process.env[k]]))};
 try{
  for(const k of Object.keys(old))delete process.env[k];assert.equal((await auth(request())).status,503);
  process.env.ADMIN_EMAIL='owner@example.test';process.env.ADMIN_PASSWORD='test-only-password-not-for-deployment';process.env.ADMIN_SESSION_SECRET='test-only-session-secret-not-for-deployment';
  assert.equal((await auth(request())).status,401);
  assert.equal((await auth(request('POST',{email:process.env.ADMIN_EMAIL,password:'wrong'}))).status,401);
  const credentials={email:process.env.ADMIN_EMAIL,password:process.env.ADMIN_PASSWORD};
  assert.equal((await auth(request('POST',credentials,undefined,'https://attacker.example'))).status,403);
  const login=await auth(request('POST',credentials));assert.equal(login.status,200);const cookie=login.headers.get('set-cookie');
  for(const flag of ['HttpOnly','Secure','SameSite=Strict','Path=/'])assert.ok(cookie.includes(flag));
  assert.deepEqual(await login.json(),{ok:true});assert.equal((await auth(request('GET',undefined,cookie))).status,200);
  const token=issueSession(settings());assert.equal(authenticated(request('GET',undefined,COOKIE+'='+token+'tampered')),false);
  const expired=issueSession(settings(),Date.now()-(MAX_AGE+1)*1000);assert.equal(authenticated(request('GET',undefined,COOKIE+'='+expired)),false);
  process.env.ADMIN_PASSWORD+='rotated';assert.equal(authenticated(request('GET',undefined,cookie)),false);process.env.ADMIN_PASSWORD=credentials.password;
  assert.equal((await orders(new Request(origin+'/.netlify/functions/orders'))).status,401);
  const crossSite=await orders(new Request(origin+'/.netlify/functions/orders',{method:'PATCH',headers:{Origin:'https://attacker.example',Cookie:cookie},body:'{}'}));assert.equal(crossSite.status,403);
  const logout=await auth(request('DELETE',undefined,cookie));assert.equal(logout.status,200);assert.ok(logout.headers.get('set-cookie').includes('Max-Age=0'));
 }finally{for(const [k,v] of Object.entries(old)){if(v===undefined)delete process.env[k];else process.env[k]=v}}
});
