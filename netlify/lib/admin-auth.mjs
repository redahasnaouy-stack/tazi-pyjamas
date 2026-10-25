import {createHash,createHmac,timingSafeEqual,scryptSync} from 'node:crypto';
export const COOKIE='__Host-tazi_admin';
export const MAX_AGE=4*60*60;
export function settings(){
 const email=process.env.ADMIN_EMAIL?.trim().toLowerCase();const password=process.env.ADMIN_PASSWORD;const secret=process.env.ADMIN_SESSION_SECRET;
 return email&&password?.length>=16&&secret?.length>=32?{email,password,secret}:null;
}
const digest=value=>createHash('sha256').update(value).digest();
const equal=(a,b)=>timingSafeEqual(digest(a),digest(b));
const key=s=>createHmac('sha256',s.secret).update(s.email+'\0'+s.password).digest();
export function validCredentials(email,password,s){
 if(typeof email!=='string'||typeof password!=='string'||email.length>254||password.length>1024)return false;
 const actual=scryptSync(password,s.email,32);const expected=scryptSync(s.password,s.email,32);
 return timingSafeEqual(actual,expected)&&equal(email.trim().toLowerCase(),s.email);
}
export function issueSession(s,now=Date.now()){
 const payload=Buffer.from(JSON.stringify({email:s.email,exp:Math.floor(now/1000)+MAX_AGE})).toString('base64url');
 return payload+'.'+createHmac('sha256',key(s)).update(payload).digest('base64url');
}
export function authenticated(request,s=settings(),now=Date.now()){
 if(!s)return false;
 const cookie=request.headers.get('cookie')?.split(';').map(v=>v.trim()).find(v=>v.startsWith(COOKIE+'='))?.slice(COOKIE.length+1);
 if(!cookie||cookie.length>2048)return false;
 const [payload,signature,...extra]=cookie.split('.');if(!payload||!signature||extra.length)return false;
 const expected=createHmac('sha256',key(s)).update(payload).digest('base64url');if(!equal(signature,expected))return false;
 try{const data=JSON.parse(Buffer.from(payload,'base64url'));return data.email===s.email&&Number.isInteger(data.exp)&&data.exp>Math.floor(now/1000)&&data.exp<=Math.floor(now/1000)+MAX_AGE}catch{return false}
}
export const sameOrigin=request=>request.headers.get('origin')===new URL(request.url).origin;
export const sessionCookie=(value,age=MAX_AGE)=>`${COOKIE}=${value}; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=${age}`;
export const json=(body,status=200,headers={})=>new Response(JSON.stringify(body),{status,headers:{'Content-Type':'application/json','Cache-Control':'no-store',...headers}});
