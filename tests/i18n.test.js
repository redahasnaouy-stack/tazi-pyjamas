import {test} from 'node:test';
import assert from 'node:assert/strict';
import {products,validateOrder} from '../src/catalog.js';
import {translate} from '../src/i18n.js';
test('every product name, colour, description, category and tag has Arabic copy',()=>{
 for(const p of products)for(const field of ['name','color','subtitle','category','tag']){assert.notEqual(translate(p[field],'ar'),p[field],`${p.id}.${field}`);assert.match(translate(p[field],'ar'),/[\u0600-\u06ff]/)}
});
test('French stays unchanged and dynamic Arabic messages preserve numbers and product identity',()=>{
 assert.equal(translate('Rêve de Lavande','fr'),'Rêve de Lavande');assert.equal(translate('12 sur 55 pièces','ar'),'12 من أصل 55 قطعة');assert.equal(translate('Rêve de Lavande ajouté au panier','ar'),'تمت إضافة حلم اللافندر إلى السلة');assert.match(translate('Voir la photo 2 de Rêve de Lavande','ar'),/2.*حلم اللافندر/);
});
test('Arabic and Persian phone digits normalize for Moroccan order validation',()=>{
 const body={name:'فاطمة الزهراء',phone:'٠٦٦٣٢٦٦٨١٧',city:'الرباط',address:'شارع الورد 12',items:[{id:'lavande',size:'M',qty:1}]};
 assert.equal(validateOrder(body).phone,'0663266817');assert.equal(validateOrder({...body,phone:'+۲۱۲ ۶۶۳۲۶۶۸۱۷'}).phone,'+212663266817');
});
