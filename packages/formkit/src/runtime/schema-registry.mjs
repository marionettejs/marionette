// $get returns FormKit's public context, not the Core node (Vue Schema contract).
import { getNode, watchRegistry, stopWatch } from '@formkit/core';
import { subscribeReactiveStore } from './upstream-bindings.mjs';

let evaluation;
// Each compiler/binding owns its reads independently of partial renderer updates.
export function createSchemaDependencies() {
  const owner = Symbol('schema dependencies');
  let dependencies, closed = false;
  return {
    run(read) {
      const previous = evaluation, frame = {owner, used: undefined};
      evaluation = frame;
      try {
        return read();
      } finally {
        evaluation = previous;
        for (const entry of dependencies ?? []) {
          if (closed || !frame.used?.has(entry)) {
            entry.release(owner);
          }
        }
        if (closed) {
          for (const entry of frame.used ?? []) {
            entry.release(owner);
          }
        }
        dependencies = closed ? undefined : frame.used;
      }
    },
    destroy() {
      closed = true;
      for (const entry of dependencies ?? []) {
        entry.release(owner);
      }
      dependencies = undefined;
    }
  };
}

export function createSchemaRegistry(onChange) {
  const entries = new Map(), pendingEntries = new Set(), lifetime = Symbol('registry lifetime');
  let dead = false, pending = false;
  function changed(entry) {
    if (dead) {
      return;
    }
    pendingEntries.add(entry);
    if (pending) {
      return;
    }
    pending = true;
    queueMicrotask(() => {
      pending = false;
      const active = [...pendingEntries].some(source => entries.get(source.id) === source);
      pendingEntries.clear();
      if (!dead && active) {
        onChange();
      }
    });
  }
  function remove(entry) {
    if (entries.get(entry.id) !== entry) {
      return;
    }
    stopWatch(entry.receipt);
    entry.dispose?.();
    entry.dispose = undefined;
    entry.node = undefined;
    entry.owners.clear();
    pendingEntries.delete(entry);
    entries.delete(entry.id);
  }
  function attach(entry, node) {
    if (entries.get(entry.id) !== entry) {
      return;
    }
    entry.dispose?.();
    entry.node = node;
    const receipts = [];
    if (node) {
      receipts.push(node.on('created', () => {
        attach(entry, getNode(entry.id));
        changed(entry);
      }));
      for (const event of ['input', 'commit', 'prop', 'message-added', 'message-updated', 'message-removed', 'settled', 'child', 'destroyed']) {
        receipts.push(node.on(event, () => changed(entry)));
      }
    }
    const unsubscribe = node?.context ? subscribeReactiveStore(node.context, () => changed(entry)) : () => {};
    entry.dispose = () => {
      unsubscribe();
      for (const receipt of receipts) {
        node.off(receipt);
      }
    };
  }
  return {
    get(id) {
      if (typeof id !== 'string' || dead) {
        return null;
      }
      let entry = entries.get(id);
      if (!entry) {
        entry = {id, owners: new Set()};
        entry.release = owner => {
          entry.owners.delete(owner);
          if (!entry.owners.size) {
            remove(entry);
          }
        };
        entries.set(id, entry);
        attach(entry, getNode(id));
        entry.receipt = watchRegistry(id, () => {
          attach(entry, getNode(id));
          changed(entry);
        });
      }
      entry.owners.add(evaluation?.owner ?? lifetime);
      if (evaluation) {
        evaluation.used ??= new Set();
        evaluation.used.add(entry);
      }
      return entry.node?.context ?? null;
    },
    destroy() {
      if (dead) {
        return;
      }
      dead = true;
      for (const entry of entries.values()) {
        remove(entry);
      }
      pendingEntries.clear();
    }
  };
}
