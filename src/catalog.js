export const products = [
{id:'lavande',name:'Rêve de Lavande',subtitle:'Satin & dentelle délicate',price:290,color:'Lavande',swatch:'#b29acb',category:'Satin',panel:0,tag:'Coup de cœur',stock:12},
{id:'rose',name:'Éclat de Rose',subtitle:'Satin & détails contrastés',price:320,color:'Rose fuchsia',swatch:'#d65898',category:'Satin',panel:1,tag:'Nouveauté',stock:10},
{id:'sauge',name:'Jardin de Sauge',subtitle:'Imprimé floral & dentelle',price:250,color:'Vert sauge',swatch:'#9ba581',category:'Fleuri',panel:2,tag:'Douceur florale',stock:15}
];
export function validateOrder(body){
 if(!body || typeof body.name!=='string'||body.name.trim().length<2||body.name.length>100)throw Error('Indiquez votre nom complet.');
 if(typeof body.phone!=='string'||! /^(?:\+212|0)[5-7]\d{8}$/.test(body.phone.replace(/[\s-]/g,'')))throw Error('Indiquez un numéro marocain valide.');
 for(const k of ['city','address'])if(typeof body[k]!=='string'||body[k].trim().length<3||body[k].length>300)throw Error('Complétez votre ville et votre adresse.');
 if(!Array.isArray(body.items)||body.items.length<1||body.items.length>20)throw Error('Panier invalide.');
 const items=body.items.map(i=>{const p=products.find(p=>p.id===i.id);if(!p||!['S','M','L','XL'].includes(i.size)||!Number.isInteger(i.qty)||i.qty<1||i.qty>5)throw Error('Article invalide.');return {id:p.id,name:p.name,price:p.price,size:i.size,qty:i.qty};});
 return {name:body.name.trim(),phone:body.phone.replace(/[\s-]/g,''),city:body.city.trim(),address:body.address.trim(),items,total:items.reduce((s,i)=>s+i.price*i.qty,0),status:'Nouvelle'};
}
