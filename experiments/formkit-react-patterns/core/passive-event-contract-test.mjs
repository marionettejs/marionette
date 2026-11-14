import assert from 'node:assert/strict';
import {JSDOM} from 'jsdom';
const dom=new JSDOM('<main></main>');globalThis.document=dom.window.document;
const {renderSections}=await import('./section-renderer.mjs');
const host=document.querySelector('main');let starts=0,moves=0;
const context={handlers:{start:event=>{starts++;event.preventDefault();},move:()=>{moves++;}}};
// These exact schema event spellings are present in @formkit/pro 0.131.0 rating.
const renderer=renderSections({host,context,schema:{$el:'span',attrs:{onTouchstartPassive:'$handlers.start',onTouchmovePassive:'$handlers.move'}}});
const element=host.firstChild;
const start=new dom.window.Event('touchstart',{bubbles:true,cancelable:true});element.dispatchEvent(start);
assert.equal(starts,1,'Passive suffix names still listen for native touchstart');
assert.equal(start.defaultPrevented,false,'Passive native listener does not cancel default scrolling');
element.dispatchEvent(new dom.window.Event('touchmove'));assert.equal(moves,1);
context.handlers.move=()=>{moves+=10;};renderer.update();
element.dispatchEvent(new dom.window.Event('touchmove'));assert.equal(moves,11,'Reactive handler replacement removes old listener');
renderer.destroy();element.dispatchEvent(new dom.window.Event('touchstart'));element.dispatchEvent(new dom.window.Event('touchmove'));
assert.equal(starts,1);assert.equal(moves,11,'Destroyed renderer removes passive listeners');
dom.window.close();console.log('PASS: Pro passive touch event names, native passive behavior, replacement and teardown.');
