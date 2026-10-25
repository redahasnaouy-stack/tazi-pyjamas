import {test} from 'node:test';
import assert from 'node:assert/strict';
import {products,validateOrder} from '../src/catalog.js';
const valid=()=>({name:'Test Client',phone:'0663266817',city:'Rabat',address:'Rue des fleurs 12',items:[{id:'lavande',size:'M',qty:2,price:1}]});
test('prices stay within the requested range',()=>{assert.ok(products.every(p=>p.price>=200&&p.price<=350))});
test('server derives total from catalog, ignoring supplied price',()=>{assert.equal(validateOrder(valid()).total,580)});
test('rejects missing contact, unsupported sizes and invalid quantities',()=>{for(const patch of [{phone:'123'},{name:''},{items:[{id:'lavande',size:'XXL',qty:1}]},{items:[{id:'lavande',size:'M',qty:-2}]},{items:[{id:'unknown',size:'M',qty:1}]}])assert.throws(()=>validateOrder({...valid(),...patch}))});
test('normalizes Moroccan contact numbers',()=>{assert.equal(validateOrder({...valid(),phone:'+212 663-266817'}).phone,'+212663266817')});

test('all 83 source photos are included once across product galleries',()=>{
 const indices=products.flatMap(p=>p.sourceImages).sort((a,b)=>a-b);
 assert.deepEqual(indices,Array.from({length:83},(_,i)=>i));
 assert.equal(new Set(products.map(p=>p.id)).size,products.length);
 for(const p of products){assert.equal(p.images.length,p.sourceImages.length);assert.ok(p.images.every(image=>/^\/images\/catalogue\/\d{2}\.jpg$/.test(image)))}
});

test('a basket may include every product in the expanded catalogue',()=>{
 const order=validateOrder({...valid(),items:products.map(p=>({id:p.id,size:'M',qty:1}))});
 assert.equal(order.items.length,products.length);
 assert.equal(order.total,products.reduce((sum,p)=>sum+p.price,0));
});

test('each catalogue product can be ordered at its server-side catalogue price',()=>{
 for(const p of products){const order=validateOrder({...valid(),items:[{id:p.id,size:'M',qty:1,price:0}]});assert.equal(order.total,p.price);assert.equal(order.items[0].name,p.name)}
});

test('published product photos preserve the original uploaded JPEG bytes',async()=>{
 const {readFile}=await import('node:fs/promises');const {createHash}=await import('node:crypto');
 const manifest=JSON.parse(await readFile(new URL('../data/image-manifest.json',import.meta.url),'utf8'));
 assert.equal(manifest.length,83);assert.equal(manifest.filter(e=>e.archive.startsWith('WhatsApp Unknown')).length,31);
 for(const entry of manifest){const bytes=await readFile(new URL('../public'+entry.output,import.meta.url));assert.equal(createHash('sha256').update(bytes).digest('hex'),entry.sha256);assert.equal(entry.processing,'original-unchanged');assert.equal(bytes[0],0xff);assert.equal(bytes[1],0xd8)}
});
