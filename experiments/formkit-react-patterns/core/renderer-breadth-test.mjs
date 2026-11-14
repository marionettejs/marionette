import assert from 'node:assert/strict';
import {JSDOM} from 'jsdom';
const dom=new JSDOM('<main></main>');globalThis.document=dom.window.document;
const {renderSections}=await import('./section-renderer.mjs');
const host=document.querySelector('main');
const context={items:['one','two'], tag:'p', color:'red', active:true, count:3, bag:{x:'X'}, icon:'<svg><path d="M0 0" /></svg>'};
const renderer=renderSections({host,context,schema:[
 {$el:'div',for:['item','index','$items'],attrs:{'data-index':'$index'},children:'$item'},
 {$el:'b',for:['value','key','$bag'],children:'$: $key + ":" + $value'},
 {$el:'i',for:['n','$count'],children:'$n'},
 {$el:'$tag',attrs:{style:{color:'$color'},'data-active':{if:'$active',then:'yes',else:'no'}},children:'dynamic'},
 {$el:'text',children:'plain'},
 {$el:'span',attrs:{innerHTML:'$icon'}},
 {$el:'input',attrs:{multiple:true,required:true}},
 {$el:'aside',attrs:{if:'$active',then:{title:'active'},else:{'data-id':'inactive'}}}
]});
assert.deepEqual([...host.querySelectorAll('div')].map(el=>[el.dataset.index,el.textContent]),[['0','one'],['1','two']]);
assert.equal(host.querySelector('b').textContent,'x:X');assert.equal(host.querySelectorAll('i').length,3);
assert.equal(host.querySelector('p').style.color,'red');assert.ok(host.querySelector('svg'));assert.ok(host.querySelector('input').multiple);
context.items=['three'];context.tag='section';context.color='blue';context.active=false;renderer.update();
assert.equal(host.querySelectorAll('div').length,1);assert.equal(host.querySelector('section').style.color,'blue');assert.equal(host.querySelector('section').dataset.active,'no');assert.equal(host.querySelector('p'),null);assert.equal(host.querySelector('aside').title,'');assert.equal(host.querySelector('aside').dataset.id,'inactive');
renderer.destroy();assert.equal(host.childNodes.length,0);
console.log('renderer breadth: 3-part/object/numeric loops, dynamic tags, recursive attrs, icons, Boolean properties, text and teardown passed');
let destroyed=0;context.caption='first';
const componentRenderer=renderSections({host,context,components:{Badge:({host,props,renderChildren})=>{
 const strong=document.createElement('strong');host.append(strong);strong.textContent=props.caption;renderChildren();
 return {update(next){strong.textContent=next.caption;},destroy(){destroyed++;}};
}},schema:{$cmp:'Badge',props:{caption:'$caption'},children:'child'}});
assert.equal(host.querySelector('strong').textContent,'first');assert.ok(host.textContent.includes('child'));context.caption='second';componentRenderer.update();assert.equal(host.querySelector('strong').textContent,'second');componentRenderer.destroy();assert.equal(destroyed,1);assert.equal(host.childNodes.length,0);
assert.throws(()=>renderSections({host,context,schema:{$cmp:'Missing'}}),/Unknown component factory/);
console.log('component registry lifecycle, reactive props, child slot, and unknown-component failure passed');
