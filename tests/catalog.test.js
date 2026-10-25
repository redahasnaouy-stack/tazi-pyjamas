import {test} from 'node:test';
import assert from 'node:assert/strict';
import {products,validateOrder} from '../src/catalog.js';
const valid=()=>({name:'Test Client',phone:'0663266817',city:'Rabat',address:'Rue des fleurs 12',items:[{id:'lavande',size:'M',qty:2,price:1}]});
test('prices stay within the requested range',()=>{assert.ok(products.every(p=>p.price>=200&&p.price<=350))});
test('server derives total from catalog, ignoring supplied price',()=>{assert.equal(validateOrder(valid()).total,580)});
test('rejects missing contact, unsupported sizes and invalid quantities',()=>{for(const patch of [{phone:'123'},{name:''},{items:[{id:'lavande',size:'XXL',qty:1}]},{items:[{id:'lavande',size:'M',qty:-2}]},{items:[{id:'unknown',size:'M',qty:1}]}])assert.throws(()=>validateOrder({...valid(),...patch}))});
test('normalizes Moroccan contact numbers',()=>{assert.equal(validateOrder({...valid(),phone:'+212 663-266817'}).phone,'+212663266817')});
