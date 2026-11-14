// Reproduce the adapted dependency-free context from locked published React2.5.
import {readFileSync,writeFileSync} from 'node:fs';
import {createRequire} from 'node:module';
import {fileURLToPath} from 'node:url';
import {ESLint} from 'eslint';
const require = createRequire(import.meta.url);
const pkg = JSON.parse(readFileSync(require.resolve('@formkit/react/package.json'),'utf8'));
if (pkg.version !== '2.5.0') {throw Error('Extraction requires published React2.5.0');}
const source = readFileSync(new URL('./dist/index.mjs','file://' + require.resolve('@formkit/react/package.json')),'utf8');
let body = source.slice(source.indexOf('function isObject2'),source.indexOf('\n// ',source.indexOf('bindings_default = reactBindings;')));
const start = body.indexOf('function useReactiveStore('),end = body.indexOf('var formKitReactiveStoreSymbol',start);body = body.slice(0,start) + body.slice(end);
const header = `// Adapted from @formkit/react 2.5.0 published reactiveStore.ts/bindings.ts.
// Copyright (c) 2021-2026 FormKit, Inc. MIT: LICENSE.formkit.
// Removed React hook; added observer ownership cleanup and explicit cache refresh.
import {createMessage,createClasses,generateClassList} from '@formkit/core';
import {cloneAny,camel,undefine,shallowClone,eq,has,empty} from '@formkit/utils';
import {createObserver} from '@formkit/observer';
import {enumerableKeys} from './scope-properties.mjs';
const __getOwnPropNames=Object.getOwnPropertyNames;
const createInitializer = (factory, result) => function initialize() {
  if (factory) {
    const initializeFactory = factory[__getOwnPropNames(factory)[0]];
    factory = 0;
    result = initializeFactory(0);
  }
  return result;
};
`;
body = body.replace('const cachedClasses = {};','let contextAlive = true;\n      const cachedClasses = {};\n      const classObservers = new Set();')
  .replace('const observedNode = createObserver(node);','const observedNode = createObserver(node);\n              classObservers.add(observedNode);')
  .replace('clearReactiveStore(context);','contextAlive = false;\n        for (const observed of classObservers) observed.kill();\n        classObservers.clear();\n        clearReactiveStore(context);')
  .replace('node.context = context;',`context.refreshClasses = () => { if (!contextAlive) return; for(const observed of classObservers) observed.kill(); classObservers.clear(); for(const key of Object.keys(cachedClasses)) delete cachedClasses[key]; notifyReactiveStore(context); };
      for(const event of ["config:classes","config:rootClasses","prop:rootClasses"])node.on(event,context.refreshClasses);
      node.context = context;`)
  .replace('subscribers.forEach((subscriber) => subscriber());','subscribers.forEach((subscriber) => { if (store.subscribers.has(subscriber)) subscriber(); });')
  .replace('version: 0,\n    pending:', 'version: 0,\n    dead: false,\n    pending:')
  .replace('if (!store) return;\n  store.version++','if (!store || store.dead) return;\n  store.version++')
  .replace('  store.subscribers.clear();','  store.dead = true;\n  store.subscribers.clear();')
  .replace('if (!store) return () => {','if (!store || store.dead) return () => {')
  .replace('if (!node) return "";','if (!node || !contextAlive) return "";');
// Reproduce the owner-scoped list-key adaptation from c353a4d6.
body = body.replace('function getReactListItems(node) {\n  return node.children.map((child) => {\n    if (!listItemKeys.has(child.uid)) {\n      listItemKeys.set(child.uid, `fk-item-${nextListItemKey++}`);\n    }\n    return listItemKeys.get(child.uid);\n  });\n}','function getReactListItems(node) {\n  const previous = listItemKeys.get(node), current = new Map();\n  const items = node.children.map((child) => {\n    const key = previous?.get(child.uid) ?? `fk-item-${nextListItemKey++}`;\n    current.set(child.uid, key);\n    return key;\n  });\n  // Retain keys only for this parent\'s current children, preserving Core UIDs.\n  listItemKeys.set(node, current);\n  return items;\n}')
  .replace('listItemKeys = /* @__PURE__ */ new Map();','listItemKeys = /* @__PURE__ */ new WeakMap();')
  .replace('node.on("destroyed", () => {\n        contextAlive = false;','node.on("destroyed", () => {\n        listItemKeys.delete(node);\n        contextAlive = false;');
// Explicit module declarations are initialized before either factory is invoked.
body = body.replace('var formKitReactiveStoreSymbol;', 'let formKitReactiveStoreSymbol;')
  .replace('var init_reactiveStore = __esm(', 'const initializeReactiveStore = createInitializer(')
  .replace('var listItemKeys, nextListItemKey, reactBindings, bindings_default;', 'let listItemKeys, nextListItemKey, reactBindings, bindingsDefault;')
  .replace('var init_bindings = __esm(', 'const initializeBindings = createInitializer(')
  .replaceAll('init_reactiveStore();', 'initializeReactiveStore();')
  .replace('bindings_default = reactBindings;', 'bindingsDefault = reactBindings;')
  .replace('for (const key in availableMessages)', 'for (const key of enumerableKeys(availableMessages))')
  .replace('for (const key in context.messages)', 'for (const key of enumerableKeys(context.messages))');
const unformatted = header + body + '\ninitializeBindings();\nexport {bindingsDefault as bindings, subscribeReactiveStore, getReactiveStore};\n';
// Apply only the reviewed control-flow blocks and deterministic layout fixes.
const options = {cwd: fileURLToPath(new URL('../../../',import.meta.url)),overrideConfigFile: fileURLToPath(new URL('../../../eslint.config.mjs',import.meta.url))};
const filePath = fileURLToPath(new URL('./upstream-bindings.mjs',import.meta.url));
const blocks = new ESLint({...options,fix: message => message.ruleId === 'curly'});
const [blocked] = await blocks.lintText(unformatted,{filePath});
const layout = new ESLint({...options,fix: true,fixTypes: ['layout']});
const [formatted] = await layout.lintText(blocked.output ?? unformatted,{filePath});
const result = formatted.output ?? unformatted;
if (process.argv[2]) {writeFileSync(process.argv[2],result);} else if (readFileSync(new URL('./upstream-bindings.mjs',import.meta.url),'utf8') !== result) {throw Error('Extracted source differs');} else {console.log('Exact source extraction matches');}
