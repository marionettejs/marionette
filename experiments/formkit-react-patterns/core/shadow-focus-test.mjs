import {setupProjectionDom} from './schema-projection-reference.mjs';
const dom = setupProjectionDom(),{runShadowFocus} = await import('./shadow-focus-fixture.mjs');
try {for (const mode of process.argv[2] ? [process.argv[2]] : ['direct','schema']) {const host = document.body.appendChild(document.createElement('main'));console.log(JSON.stringify(await runShadowFocus(host,mode)));host.remove();}} finally {dom.window.close();}
