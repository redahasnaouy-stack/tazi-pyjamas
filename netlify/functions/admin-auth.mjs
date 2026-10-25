import {settings,authenticated,validCredentials,issueSession,sameOrigin,sessionCookie,json} from '../lib/admin-auth.mjs';
export const config={rateLimit:{windowLimit:10,windowSize:60,aggregateBy:['ip','domain']}};
export default async request=>{
 const s=settings();if(!s)return json({error:'L’accès administrateur doit être configuré dans les paramètres Netlify.'},503);
 if(request.method==='GET')return authenticated(request,s)?json({authenticated:true}):json({error:'Connexion requise.'},401);
 if(!['POST','DELETE'].includes(request.method))return json({error:'Méthode non autorisée.'},405);
 if(!sameOrigin(request))return json({error:'Origine non autorisée.'},403);
 if(request.method==='DELETE')return json({ok:true},200,{'Set-Cookie':sessionCookie('',0)});
 try{
  const text=await request.text();if(text.length>4096)return json({error:'Requête trop volumineuse.'},413);
  const body=JSON.parse(text);if(!validCredentials(body.email,body.password,s))return json({error:'Email ou mot de passe incorrect.'},401);
  return json({ok:true},200,{'Set-Cookie':sessionCookie(issueSession(s))});
 }catch{return json({error:'Requête invalide.'},400)}
};
