// List-owned row groups and ordinary Marionette row placements.
import { View } from 'marionette';
import { createNode, valueRemoved } from '@formkit/core';
import type { ViewConfiguration, ViewInstance } from 'marionette';
import type { FormKitNode } from '@formkit/core';
import type { FormView, FormValues, RemovalPolicy } from './index.ts';

export interface RowLocation { list: string[] | RowLocation; keyProperty: string; key: string; suffix: string[] }
interface RootOwner { mutate(operation: () => void): void; forget(location: RowLocation): void }
interface RowEntry { key: string; node: FormKitNode; view?: ViewInstance; ending: boolean }
interface ListOwner {
  node: FormKitNode; path: RowLocation['list']; keyProperty: string;
  rows: Map<string, RowEntry>; ending: boolean; bridge: RootOwner;
}
const roots = new WeakMap<FormKitNode, { bridge: RootOwner; lists: Set<ListOwner> }>();
const lists = new WeakMap<FormKitNode, ListOwner>();
const rowNodes = new WeakMap<FormKitNode, { owner: ListOwner; entry: RowEntry }>();

export function connectRows(root: FormKitNode, bridge: RootOwner) { roots.set(root, { bridge, lists: new Set() }); }
export function disconnectRows(root: FormKitNode) { roots.delete(root); }
export function rowLocation(node: FormKitNode, name?: string): RowLocation | undefined {
  const suffix = name === undefined ? [] : [name];
  for (let current: FormKitNode | null = node; current; current = current.parent) {
    const row = rowNodes.get(current);
    if (row) { return { list: row.owner.path, keyProperty: row.owner.keyProperty, key: row.entry.key, suffix }; }
    suffix.unshift(String(current.name));
  }
  return undefined;
}
export function resolveRow(values: unknown, location: RowLocation): string[] | undefined {
  const path = Array.isArray(location.list) ? location.list : resolveRow(values, location.list);
  if (!path) { return; }
  let list = values as Record<string, unknown> | undefined;
  for (const name of path) { list = list?.[name] as Record<string, unknown> | undefined; }
  if (!Array.isArray(list)) { return; }
  const index = list.findIndex(item => item?.[location.keyProperty] === location.key);
  return index < 0 ? undefined : [...path, String(index), ...location.suffix];
}
export function rowLocationKey(location: RowLocation): string { return JSON.stringify([location.list, location.keyProperty, location.key]); }
export function isRowWithin(location: RowLocation, ancestor: RowLocation): boolean {
  const key = rowLocationKey(ancestor);
  for (let current: RowLocation | undefined = location; current; current = Array.isArray(current.list) ? undefined : current.list) {
    if (rowLocationKey(current) === key) { return true; }
  }
  return false;
}
function rowOwnerLocation(owner: ListOwner, key: string): RowLocation {
  return { list: owner.path, keyProperty: owner.keyProperty, key, suffix: [] };
}
function keys(value: unknown, property: string): string[] {
  if (!Array.isArray(value)) { throw new Error('Owned rows require an array.'); }
  const found = new Set<string>();
  for (const row of value) {
    const key = row?.[property];
    if (!row || typeof row !== 'object' || Array.isArray(row) || typeof key !== 'string' || !key || found.has(key)) {
      throw new Error('Owned row keys must be unique non-empty strings on objects.');
    }
    found.add(key);
  }
  return [...found];
}
function endRow(owner: ListOwner, entry: RowEntry, forget: boolean) {
  entry.ending = true;
  entry.view?.destroy();
  if (entry.node.context !== null) { entry.node.props.preserve = true; entry.node.destroy(); }
  owner.rows.delete(entry.key);
  rowNodes.delete(entry.node);
  if (forget) { owner.bridge.forget(rowOwnerLocation(owner, entry.key)); }
}
function clearRow(owner: ListOwner, entry: RowEntry) {
  owner.bridge.mutate(() => {
    entry.ending = true;
    entry.node.props.preserve = false;
    entry.node.destroy();
    // Same version-pinned partial-removal adapter already used by FieldView.
    // Core preserve:false inherits preserve:true. Remove exactly this remaining
    // array item without inputting a parent snapshot or replaying normalizers.
    const index = (owner.node.value as Record<string, unknown>[]).findIndex(item => item[owner.keyProperty] === entry.key);
    if (index >= 0) { owner.node.disturb(); owner.node.calm({ name: index, value: valueRemoved }); }
    owner.rows.delete(entry.key);
    rowNodes.delete(entry.node);
    owner.bridge.forget(rowOwnerLocation(owner, entry.key));
  });
}
function listOwner(node: FormKitNode, root: FormKitNode): ListOwner {
  const rootOwner = roots.get(root);
  if (!rootOwner || node.root !== root || node.type !== 'list' || node.context === null) {
    throw new Error('A RowView requires a live list owned by its form.');
  }
  const existing = lists.get(node);
  if (existing) { return existing; }
  for (let current = node; current.parent && current.parent !== root; current = current.parent) {
    const parent = current.parent;
    if (parent.type === 'list' && rowNodes.get(current)?.owner.node !== parent) {
      throw new Error('Nested owned lists require owned RowView ancestors.');
    }
  }
  const keyProperty = node.props.itemKey;
  if (typeof keyProperty !== 'string' || !keyProperty) { throw new Error('Owned lists require a string itemKey.'); }
  keys(node.value, keyProperty);
  const owner: ListOwner = { node, path: rowLocation(node) ?? node.address.slice(1).map(String), keyProperty,
    rows: new Map(), ending: false, bridge: rootOwner.bridge };
  lists.set(node, owner); rootOwner.lists.add(owner);
  const projection = (value: unknown, next: (value: unknown) => unknown) => {
    const nextKeys = new Set(keys(value, keyProperty));
    for (const entry of [...owner.rows.values()]) {
      if (!nextKeys.has(entry.key)) { endRow(owner, entry, true); }
    }
    return next(value);
  };
  node.hook.input.unshift(projection);
  const receipt = node.on('destroying', () => {
    owner.ending = true;
    node.hook.input.remove(projection); node.off(receipt);
    for (const entry of [...owner.rows.values()].reverse()) { endRow(owner, entry, false); }
    lists.delete(node); roots.get(root)?.lists.delete(owner);
  });
  return owner;
}
export function prepareRowReset(root: FormKitNode, values: unknown) {
  // Live FormView reset always has a connected row registry.
  for (const owner of roots.get(root)!.lists) {
    // Ancestor owners register first. Iterate the live Set: ending an ancestor
    // releases its nested owners before their turn, including added ancestors
    // absent from construction values. No dead/absent numeric fallback is used.
    const path = Array.isArray(owner.path) ? owner.path : resolveRow(values, owner.path)!;
    let target = values as Record<string, unknown> | undefined;
    for (const name of path) { target = target?.[name] as Record<string, unknown> | undefined; }
    // Owned list construction captures its baseline before rows can mount.
    const nextKeys = keys(target, owner.keyProperty);
    const currentKeys = keys(owner.node.value, owner.keyProperty);
    if (nextKeys.length === currentKeys.length && nextKeys.every(key => currentKeys.includes(key))) { continue; }
    // Membership-changing reset deliberately ends row placements. The ordinary
    // feature owner rebuilds its presentation from the completed reset values.
    // End widgets before releasing retained groups, so no sibling commit uses a
    // collapsed index. This does not promise widget identity across that reset.
    for (const entry of owner.rows.values()) { entry.ending = true; entry.view?.destroy(); }
    for (const entry of [...owner.rows.values()].reverse()) { endRow(owner, entry, true); }
  }
}
export interface RowOptions<Values extends object = FormValues> extends ViewConfiguration {
  form: FormView<Values>; parent: FormKitNode; rowKey: string; removal: RemovalPolicy;
}
export class RowView<Values extends object = FormValues> extends View {
  #rowOptions: RowOptions<Values>;
  #owner?: ListOwner;
  #entry?: RowEntry;
  constructor(options: RowOptions<Values>) {
    super(options); this.#rowOptions = options;
    this.on('destroy', () => {
      const entry = this.#entry;
      if (!entry) { return; }
      entry.view = undefined;
      if (options.removal === 'clear' && !entry.ending && !this.#owner!.ending) { clearRow(this.#owner!, entry); }
    });
  }
  get node(): FormKitNode {
    if (!this.#entry) { throw new Error('Render the RowView before accessing its node.'); }
    return this.#entry.node;
  }
  render() {
    if (this.isDestroyed()) { return this; }
    if (!this.#entry) {
      const { form, parent, rowKey } = this.#rowOptions;
      const owner = this.#owner = listOwner(parent, form.node);
      const index = keys(parent.value, owner.keyProperty).indexOf(rowKey);
      if (index < 0) { throw new Error('Row key must already exist.'); }
      let entry = owner.rows.get(rowKey);
      if (entry?.view && !entry.view.isDestroyed()) { throw new Error('Row already mounted.'); }
      owner.bridge.mutate(() => {
        if (!entry) {
          const node = createNode({ type: 'group', parent, index, value: (parent.value as unknown[])[index],
            props: { type: 'group', id: `${this.cid}-group`, preserve: true } });
          entry = { key: rowKey, node, view: this, ending: false };
          owner.rows.set(rowKey, entry); rowNodes.set(node, { owner, entry });
          node.on('destroying', () => {
            entry!.ending = true; entry!.view?.destroy(); owner.rows.delete(rowKey); rowNodes.delete(node);
          });
        }
        entry.view = this; this.#entry = entry;
      });
    }
    return super.render();
  }
}
