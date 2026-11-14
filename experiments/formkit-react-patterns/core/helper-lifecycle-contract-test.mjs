import assert from 'node:assert/strict';import {JSDOM} from 'jsdom';
const dom = new JSDOM('<body><main></main>');for (const key of ['window','document','Node','Element','HTMLElement','HTMLInputElement','HTMLFormElement','Event','CustomEvent','MutationObserver','getComputedStyle']) {globalThis[key] = dom.window[key];}
const {mount} = await import('./index.mjs');const pause = ()=>new Promise(resolve=>setTimeout(resolve,35));
const svg = '<svg viewBox="0 0 10 10"><path d="M0 0L10 10"/></svg>',host = document.querySelector('main');
const api = mount({host,fields: [{name: 'x'}],values: {x: 'before'},slots: {default: [{$cmp: 'FormKitIcon',props: {icon: svg}},{$cmp: 'FormKitSummary',props: {forceShow: true}},'$slots.fields']}});
await pause();const initial = host.querySelector('svg');
if (process.argv[2] !== 'terminal') {try {await api.node.at('x').input('after');await pause();assert.equal(host.querySelector('svg'),initial,'unrelated Core context updates retain the unchanged icon subtree');} finally {api.destroy();}} else {const observer = new MutationObserver(()=>{});observer.observe(api.form.el,{childList: true,subtree: true});api.destroy();const records = observer.takeRecords();observer.disconnect();assert.equal(records.length,1,'owned helpers defer terminal DOM removal to the root clear');assert.equal(records[0].target,api.form.el);}
dom.window.close();console.log('helper lifecycle: unchanged icon DOM retained or terminal helper removal owned by root passed');
