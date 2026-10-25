import {chromium} from '@playwright/test';
import assert from 'node:assert/strict';
import {startLocalShop} from './local-shop-server.mjs';
const server=await startLocalShop(4181);const b=await chromium.launch({executablePath:'/usr/bin/chromium',args:['--no-sandbox']});
try{
 const page=await b.newPage();await page.goto(server.url+'/admin');await page.locator('#login').waitFor();await page.locator('[name=email]').fill(process.env.ADMIN_EMAIL);await page.locator('[name=password]').fill(process.env.ADMIN_PASSWORD);await page.locator('#login button').click();await page.locator('.dashboard-stats').waitFor();
 assert.ok(!(await page.evaluate(()=>document.cookie)).includes('__Host-tazi_admin'));assert.equal(await page.evaluate(()=>sessionStorage.getItem('tazi-admin')),null);await page.reload();await page.locator('.dashboard-stats').waitFor();await page.locator('#logout').click();await page.locator('#login').waitFor();assert.ok(!(await page.context().cookies()).some(c=>c.name==='__Host-tazi_admin'));assert.equal((await page.request.get(server.url+'/.netlify/functions/shop?admin=1')).status(),401);
 console.log('PASS: real auth and dashboard handlers, HttpOnly session, reload persistence, server logout and rejected anonymous private-state access. Local storage adapter.');
}finally{await b.close();await server.close()}
