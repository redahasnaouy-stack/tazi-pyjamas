import {chromium} from '@playwright/test';
import assert from 'node:assert/strict';
import auth from '../netlify/functions/admin-auth.mjs';
import {authenticated} from '../netlify/lib/admin-auth.mjs';
// Isolated fixtures used only by this local test process, never production credentials.
process.env.ADMIN_EMAIL='owner@example.test';process.env.ADMIN_PASSWORD='test-only-password-not-for-deployment';process.env.ADMIN_SESSION_SECRET='test-only-session-secret-not-for-deployment';
const b=await chromium.launch({executablePath:'/usr/bin/chromium',args:['--no-sandbox']});
try{
 const page=await b.newPage();
 await page.route('**/.netlify/functions/admin-auth',async route=>{
  const r=route.request();const request=new Request(r.url(),{method:r.method(),headers:await r.allHeaders(),...(r.postData()?{body:r.postData()}:{})});
  const response=await auth(request);await route.fulfill({status:response.status,headers:Object.fromEntries(response.headers),body:await response.text()});
 });
 await page.route('**/.netlify/functions/orders',async route=>{
  const r=route.request();const ok=authenticated(new Request(r.url(),{headers:await r.allHeaders()}));await route.fulfill({status:ok?200:401,contentType:'application/json',body:ok?'[]':'{"error":"Connexion requise"}'});
 });
 await page.goto((process.env.TAZI_BASE_URL||'http://localhost:4173')+'/admin');await page.locator('#login').waitFor();
 await page.locator('[name=email]').fill(process.env.ADMIN_EMAIL);await page.locator('[name=password]').fill(process.env.ADMIN_PASSWORD);await page.locator('#login button').click();await page.locator('.orders-card').waitFor();
 assert.ok(!(await page.evaluate(()=>document.cookie)).includes('__Host-tazi_admin'));
 assert.equal(await page.evaluate(()=>sessionStorage.getItem('tazi-admin')),null);
 await page.reload();await page.locator('.orders-card').waitFor();await page.locator('#logout').click();await page.locator('#login').waitFor();
 assert.ok(!(await page.context().cookies()).some(c=>c.name==='__Host-tazi_admin'));
 console.log('PASS: real auth handler login, HttpOnly session, reload persistence, authenticated orders UI, server logout. Orders storage mocked locally.');
}finally{await b.close()}
