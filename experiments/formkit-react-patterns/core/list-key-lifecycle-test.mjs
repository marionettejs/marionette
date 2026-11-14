import assert from 'node:assert/strict';
import {setupProjectionDom,settle} from './schema-projection-reference.mjs';
const dom=setupProjectionDom(),{mount}=await import('./index.mjs'),host=document.querySelector('main');
const declaration=name=>({$formkit:'list',name,dynamic:true,value:['A','B'],children:[{$formkit:'text',for:['item','index','$items'],key:'$item',index:'$index'}]});
const api=mount({host,instrument:true,schema:[declaration('left'),declaration('right')],config:{delay:0},formProps:{actions:false}});
try{
 await settle();const left=api.node.at('left'),right=api.node.at('right'),keys=[...left.context.items],other=[...right.context.items],first=left.children[0],second=left.children[1];assert.equal(new Set([...keys,...other]).size,4);
 await left.input(['B','A','C']);await settle();assert.equal(left.children[0],second);assert.equal(left.children[1],first);assert.deepEqual(left.context.items.slice(0,2),[keys[1],keys[0]]);assert.ok(!keys.includes(left.context.items[2]));assert.deepEqual(right.context.items,other);const added=left.children[2],addedKey=left.context.items[2];
 await left.input(['B','A']);await settle();assert.equal(added.context==null,true);assert.deepEqual(left.context.items,[keys[1],keys[0]]);await left.input(['B','A','C']);await settle();assert.notEqual(left.children[2],added);assert.notEqual(left.context.items[2],addedKey);assert.deepEqual(left.context.items.slice(0,2),[keys[1],keys[0]]);
 await left.input([]);await settle();assert.deepEqual(left.context.items,[]);assert.equal(left.children.length,0);assert.deepEqual(right.context.items,other);assert.equal(host.querySelectorAll('input').length,2);
}finally{api.destroy();await settle();assert.equal(api.metrics.coreNodesCreated,api.metrics.coreNodesDestroyed);assert.equal(host.childElementCount,0);dom.window.close();}
console.log(JSON.stringify({passed:true,checks:['live per-list item keys are unique and retained across reorder','unchanged sibling-list keys','removed and readded Core items get new keys','empty list removes all item keys','exact teardown'],scope:'Observable identity/lifecycle contract; retained-string evidence is a separate isolated heap diagnostic'}));
