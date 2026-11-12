// Reproduce the adapted dependency-free context from locked published React2.5.
import {readFileSync,writeFileSync} from 'node:fs';
import {createRequire} from 'node:module';
const require=createRequire(import.meta.url);
const pkg=JSON.parse(readFileSync(require.resolve('@formkit/react/package.json'),'utf8'));
if(pkg.version!=='2.5.0')throw Error('Extraction requires published React2.5.0');
const source=readFileSync(new URL('./dist/index.mjs','file://'+require.resolve('@formkit/react/package.json')),'utf8');
let body=source.slice(source.indexOf('function isObject2'),source.indexOf('\n// ',source.indexOf('bindings_default = reactBindings;')));
const start=body.indexOf('function useReactiveStore('),end=body.indexOf('var formKitReactiveStoreSymbol',start);body=body.slice(0,start)+body.slice(end);
const header=`// Adapted from @formkit/react 2.5.0 published reactiveStore.ts/bindings.ts.
// Copyright (c) 2021-2026 FormKit, Inc. MIT: LICENSE.formkit.
// Removed React hook; added observer ownership cleanup and explicit cache refresh.
import {createMessage,createClasses,generateClassList} from '@formkit/core';
import {cloneAny,camel,token,undefine,shallowClone,eq,has,empty} from '@formkit/utils';
import {createObserver} from '@formkit/observer';
const __getOwnPropNames=Object.getOwnPropertyNames;
const __esm=(fn,res)=>function(){return fn&&(res=(0,fn[__getOwnPropNames(fn)[0]])(fn=0)),res;};
`;
body=body.replace('const cachedClasses = {};','let contextAlive = true;\n      const cachedClasses = {};\n      const classObservers = new Set();')
.replace('const observedNode = createObserver(node);','const observedNode = createObserver(node);\n              classObservers.add(observedNode);')
.replace('clearReactiveStore(context);','contextAlive = false;\n        for (const observed of classObservers) observed.kill();\n        classObservers.clear();\n        clearReactiveStore(context);')
.replace('node.context = context;',`context.refreshClasses = () => { if (!contextAlive) return; for(const observed of classObservers) observed.kill(); classObservers.clear(); for(const key of Object.keys(cachedClasses)) delete cachedClasses[key]; notifyReactiveStore(context); };
      node.context = context;`)
.replace('subscribers.forEach((subscriber) => subscriber());','subscribers.forEach((subscriber) => { if (store.subscribers.has(subscriber)) subscriber(); });')
.replace('version: 0,\n    pending:', 'version: 0,\n    dead: false,\n    pending:')
.replace('if (!store) return;\n  store.version++','if (!store || store.dead) return;\n  store.version++')
.replace('  store.subscribers.clear();','  store.dead = true;\n  store.subscribers.clear();')
.replace('if (!store) return () => {','if (!store || store.dead) return () => {')
.replace('if (!node) return "";','if (!node || !contextAlive) return "";');
const result=header+body+'\ninit_bindings();\nexport {bindings_default as bindings, subscribeReactiveStore, getReactiveStore};\n';
if(process.argv[2])writeFileSync(process.argv[2],result);else if(readFileSync(new URL('./upstream-bindings.mjs',import.meta.url),'utf8')!==result)throw Error('Extracted source differs');else console.log('Exact source extraction matches');
