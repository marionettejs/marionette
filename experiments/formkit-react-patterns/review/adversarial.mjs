import {JSDOM} from 'jsdom';
const dom = new JSDOM('<body><div id="a"></div><div id="b"></div>');for (const k of ['window','document','Node','Element','HTMLElement','HTMLFormElement','HTMLInputElement','Event','CustomEvent','MutationObserver'])globalThis[k] = dom.window[k];
const {mount,createStore} = await import('../core/index.mjs');const wait = ()=>new Promise(r=>setTimeout(r,30));
const s = createStore();let afterDestroy = 0;s.subscribe(()=>s.destroy());s.subscribe(()=>afterDestroy++);s.notify();await wait();
const a = mount({host: document.querySelector('#a'),fields: [{name: 'x',label: 'A'}]});const b = mount({host: document.querySelector('#b'),fields: [{name: 'x',label: 'B'}]});await wait();
const ids = [...document.querySelectorAll('[id]')].map(x=>x.id);const duplicateIds = ids.filter((id,i)=>ids.indexOf(id) !== i);
a.destroy();let error;try {a.setFields([{name: 'z',label: 'Z'}])} catch (e) {error = String(e)} await wait();
console.log(JSON.stringify({afterDestroySubscriberCalls: afterDestroy,duplicateIds,setFieldsAfterDestroy: {error,fields: a.form.fields.size,children: a.node.children.length,detachedInputs: a.form.el.querySelectorAll('input').length}},null,2));b.destroy();dom.window.close();
