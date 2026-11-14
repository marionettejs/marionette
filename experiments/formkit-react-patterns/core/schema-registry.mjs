// $get returns FormKit's public context, not the Core node (Vue Schema contract).
import { getNode, watchRegistry, stopWatch } from '@formkit/core';
import { subscribeReactiveStore } from './upstream-bindings.mjs';
export function createSchemaRegistry(onChange) {
  const entries = new Map();let dead = false,pending = false;
  const changed = ()=>{if (dead || pending) return;pending = true;queueMicrotask(()=>{pending = false;if (!dead)onChange();});};
  function attach(entry,node) {
    entry.dispose?.();entry.node = node;const receipts = [];
    if (node) {receipts.push(node.on('created',()=>{attach(entry,node);changed();}));for (const event of ['input','commit','prop','message-added','message-updated','message-removed','settled','child','destroyed'])receipts.push(node.on(event,changed));}
    const unsubscribe = node?.context ? subscribeReactiveStore(node.context,changed) : ()=>{};
    entry.dispose = ()=>{unsubscribe();for (const receipt of receipts)node.off(receipt);};
  }
  return {
    get(id) {
      if (typeof id !== 'string' || dead) return null;
      let entry = entries.get(id);
      if (!entry) {entry = {};entries.set(id,entry);attach(entry,getNode(id));entry.receipt = watchRegistry(id,({payload})=>{attach(entry,payload);changed();});}
      return entry.node?.context ?? null;
    },
    destroy() {if (dead) return;dead = true;for (const entry of entries.values()) {stopWatch(entry.receipt);entry.dispose?.();}entries.clear();}
  };
}
