import { getStore } from '@netlify/blobs';
import { validateOrder } from '../../src/catalog.js';
const json=(body,status=200)=>new Response(JSON.stringify(body),{status,headers:{'Content-Type':'application/json','Cache-Control':'no-store'}});
export default async (request,context)=>{
 try{
  const store=getStore({name:'tazi-orders',consistency:'strong'});
  if(request.method==='POST'){
   if(!process.env.ORDERS_ENABLED||process.env.ORDERS_ENABLED!=='true')return json({error:'La commande en ligne ouvre bientôt. Envoyez votre panier sur WhatsApp.'},503);
   const length=request.headers.get('content-length');if(length&&Number(length)>12000)return json({error:'Requête trop volumineuse.'},413);
   const text=await request.text();if(text.length>12000)return json({error:'Requête trop volumineuse.'},413);
   let order;try{order=validateOrder(JSON.parse(text))}catch(e){return json({error:e.message},400)}
   const id='TZ-'+crypto.randomUUID();await store.setJSON(id,{...order,id,createdAt:new Date().toISOString()});return json({id},201);
  }
  if(!['GET','PATCH'].includes(request.method))return json({error:'Méthode non autorisée.'},405);
  const token=request.headers.get('Authorization');if(!token?.startsWith('Bearer '))return json({error:'Connexion requise.'},401);
  const identityUrl=new URL('/.netlify/identity/user',request.url);
  const auth=await fetch(identityUrl,{headers:{Authorization:token}});if(!auth.ok)return json({error:'Session expirée.'},401);
  const user=await auth.json();if(!user.app_metadata?.roles?.includes('admin'))return json({error:'Accès interdit.'},403);
  if(request.method==='GET'){
   const orders=[];for await(const page of store.list({paginate:true})){for(const blob of page.blobs){const order=await store.get(blob.key,{type:'json'});if(order)orders.push(order)}}
   return json(orders.sort((a,b)=>b.createdAt.localeCompare(a.createdAt)));
  }
  const body=await request.json();if(!/^TZ-[a-f0-9-]{36}$/.test(body.id)||!['Nouvelle','Confirmée','Expédiée','Livrée','Annulée'].includes(body.status))return json({error:'Données invalides.'},400);
  const order=await store.get(body.id,{type:'json'});if(!order)return json({error:'Commande introuvable.'},404);
  await store.setJSON(body.id,{...order,status:body.status});return json({ok:true});
 }catch(error){console.error('Order service failure:',error.name);return json({error:'Service indisponible. Contactez-nous sur WhatsApp ; votre panier est conservé.'},503)}
};
