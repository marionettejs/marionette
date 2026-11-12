import type { FormKitNode } from '@formkit/core';

const resources = new WeakSet<FormKitNode>();
const owners = new WeakMap<FormKitNode, Set<NodeOwnership>>();

export function ownNodeResource(node: FormKitNode) {
  resources.add(node);
  owners.get(node)?.forEach(owner => owner.manage(node));
}

export function releaseNodeResource(node: FormKitNode) {
  resources.delete(node);
  for (const owner of [...owners.get(node) ?? []]) { owner.release(node); }
}

interface Boundary {
  node: FormKitNode;
  members: Set<FormKitNode>;
  input: (value: unknown, next: (value: unknown) => unknown) => unknown;
  receipts: string[];
  phase?: { dispatching: boolean; settled?: boolean };
  settled?: boolean;
}

// The input resource owns its terminal release. A group/list input can also
// retire children inside Core before their buffered lifecycle callbacks run.
// Keep the old membership at that boundary until refresh reconciles it.
export class NodeOwnership {
  #parents = new Map<FormKitNode, FormKitNode | null>();
  #boundaries = new Map<FormKitNode, Boundary>();
  #pending = new Set<FormKitNode>();
  #dirty = new Set<Boundary>();
  #fallback = new Set<FormKitNode>();
  #disposed = false;

  constructor(private nodes: Set<FormKitNode>) {}

  add(node: FormKitNode) {
    if (this.#disposed || this.#parents.has(node)) { return; }
    this.nodes.add(node);
    this.#parents.set(node, null);
    let known = owners.get(node);
    if (!known) { known = new Set(); owners.set(node, known); }
    known.add(this);
    if (!resources.has(node)) { this.#fallback.add(node); }
    this.#link(node);
    if (this.#disposed || !this.nodes.has(node)) { return; }
    if (node.type !== 'input') { this.#boundary(node); }
    this.#pending.add(node);
  }

  manage(node: FormKitNode) {
    this.#fallback.delete(node);
    const boundary = this.#boundaries.get(node);
    // A constructor has returned its Core resource. Its synchronous initial
    // input is complete before the renderer starts mounting descendants.
    if (boundary?.phase?.settled === true) { boundary.phase = undefined; }
  }

  release(node: FormKitNode) {
    if (!this.nodes.has(node)) { return; }
    if (node.context === null) { this.delete(node); } else { this.#fallback.add(node); }
  }

  delete(node: FormKitNode) {
    this.nodes.delete(node);
    this.#fallback.delete(node); this.#pending.delete(node);
    const parent = this.#parents.get(node);
    this.#parents.delete(node);
    owners.get(node)?.delete(this);
    if (parent) {
      this.#boundaries.get(parent)?.members.delete(node);
      this.#unused(parent);
    }
    this.#unused(node);
  }

  #boundary(node: FormKitNode): Boundary {
    let boundary = this.#boundaries.get(node);
    if (boundary) { return boundary; }
    boundary = { node, members: new Set(), receipts: [], input: (value, next) => {
      if (this.#disposed || this.#boundaries.get(node) !== boundary) { return next(value); }
      const previous = boundary!.phase;
      const phase = { dispatching: true, settled: undefined as boolean | undefined };
      boundary!.phase = phase;
      this.#dirty.add(boundary!);
      queueMicrotask(() => {
        if (this.#disposed || this.#boundaries.get(node) !== boundary || boundary!.phase !== phase) { return; }
        phase.dispatching = false;
        if (phase.settled === true) { boundary!.phase = undefined; }
      });
      try { return next(value); } catch (error) {
        if (boundary!.phase === phase) { boundary!.phase = boundary!.settled === true ? undefined : previous; }
        throw error;
      }
    } };
    this.#boundaries.set(node, boundary);
    node.hook.input(boundary.input);
    if (this.#disposed || this.#boundaries.get(node) !== boundary) {
      node.hook.input.remove(boundary.input);
      return boundary;
    }
    for (const event of ['child', 'childRemoved', 'commitRaw', 'settled']) {
      const receipt = node.on(event, ({ payload }) => {
        if (this.#disposed || this.#boundaries.get(node) !== boundary) { return; }
        // Do not treat a delivered removal payload as the complete paused batch.
        // The input boundary above retains every old member, including siblings
        // whose coalesced lifecycle/removal events will never be delivered.
        if (event === 'commitRaw') {
          if (boundary!.phase) { this.#dirty.add(boundary!); }
        } else if (event === 'settled') {
          boundary!.settled = payload === true;
          const phase = boundary!.phase;
          if (phase) {
            phase.settled = payload === true;
            if (payload && !phase.dispatching) { boundary!.phase = undefined; }
          }
        } else if (this.nodes.has(payload)) { this.#pending.add(payload); }
      // Re-arm after hydration, before binding callbacks can publish state.
      }, event === 'commitRaw' ? 'unshift' : 'push');
      if (this.#disposed || this.#boundaries.get(node) !== boundary) { node.off(receipt); break; }
      boundary.receipts.push(receipt);
    }
    return boundary;
  }

  #link(node: FormKitNode) {
    const parent = node.parent;
    if (this.#disposed || !this.nodes.has(node)) { return; }
    const previous = this.#parents.get(node);
    if (previous === parent) { return; }
    this.#parents.set(node, parent);
    if (previous) {
      this.#boundaries.get(previous)?.members.delete(node);
      this.#unused(previous);
    }
    if (parent && !this.#disposed && this.nodes.has(node) && this.#parents.get(node) === parent) {
      const boundary = this.#boundary(parent);
      if (!this.#disposed && this.nodes.has(node) && this.#parents.get(node) === parent && this.#boundaries.get(parent) === boundary) {
        boundary.members.add(node);
      }
    }
  }

  #unused(node: FormKitNode) {
    const boundary = this.#boundaries.get(node);
    if (!boundary || this.nodes.has(node) || boundary.members.size) { return; }
    this.#boundaries.delete(node); this.#dirty.delete(boundary);
    node.hook.input.remove(boundary.input);
    boundary.receipts.forEach(receipt => node.off(receipt));
  }

  refresh() {
    if (this.#disposed) { return; }
    const pending = this.#pending, dirty = this.#dirty;
    this.#pending = new Set(); this.#dirty = new Set();
    const seen = new Set<FormKitNode>();
    const visited = new Set<Boundary>();
    const check = (node: FormKitNode, relink = false) => {
      if (this.#disposed || seen.has(node) || !this.nodes.has(node)) { return; }
      seen.add(node);
      if (node.context === null) { this.delete(node); } else if (relink) { this.#link(node); }
    };
    const visit = (boundary: Boundary) => {
      if (this.#disposed || visited.has(boundary)) { return; }
      visited.add(boundary);
      check(boundary.node, true);
      for (const child of boundary.members) {
        const nested = this.#boundaries.get(child);
        check(child, true);
        if (nested) { visit(nested); }
      }
    };
    let complete = false;
    try {
      dirty.forEach(visit);
      pending.forEach(node => check(node, true));
      this.#fallback.forEach(node => check(node));
      complete = true;
    } finally {
      // A throwing consumer callback still stops this refresh. Retain its work
      // for a later explicit operation; do not attempt recovery or other cleanup.
      if (!complete && !this.#disposed) {
        dirty.forEach(boundary => this.#dirty.add(boundary));
        pending.forEach(node => this.#pending.add(node));
      }
    }
  }

  dispose() {
    this.#disposed = true;
    for (const node of this.nodes) { owners.get(node)?.delete(this); }
    const boundaries = this.#boundaries;
    this.#boundaries = new Map();
    this.#parents.clear(); this.#pending.clear(); this.#dirty.clear(); this.#fallback.clear();
    for (const { node, input, receipts } of boundaries.values()) {
      node.hook.input.remove(input);
      receipts.forEach(receipt => node.off(receipt));
    }
  }
}
