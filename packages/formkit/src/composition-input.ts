import { cloneAny, undefine } from '@formkit/utils';
import { valueRemoved } from '@formkit/core';
import type { FormKitNode } from '@formkit/core';
import { inputFactory } from './runtime.ts';
import type { InputMount, RuntimeOptions, InputFactoryDecorator } from './runtime.ts';
import { fieldPathKey } from './composition.ts';
import type { Composition, FieldResource, FieldPath } from './composition.ts';
import { rowLocation } from './row-ownership.ts';
import type { SchemaComponentFactory } from './schema.ts';
export function ownedInputFactory(parent: FormKitNode, options: RuntimeOptions, composition: Composition, onRelease?: () => void): (...args: Parameters<SchemaComponentFactory>) => InputMount {
  const wrap = (inherited: FormKitNode, base: (...args: Parameters<SchemaComponentFactory>) => InputMount, releaseOwner?: () => void) => (context: Parameters<SchemaComponentFactory>[0]): InputMount => {
    const { props } = context;
    if (props.type === 'form') {
      throw new Error('Composed inputs cannot create a nested form.');
    }
    const owner = (props.parent as FormKitNode | undefined) ?? inherited;
    if (owner.context === null || owner.root !== parent.root) {
      throw new Error('Schema inputs require a live parent belonging to the same form.');
    }
    const name = props.name as string | undefined;
    if (owner.type === 'group' && name !== undefined && (!name || name.includes('.') || owner.children.some(child => child.name === name))) {
      throw new Error('Field names must be non-empty, unique within their group, and contain no dots.');
    }
    let mounted: InputMount;
    let disposed = false;
    let current = context;
    let resource!: FieldResource;
    let ignored = false;
    composition.mutate(() => {
      const supplied = name !== undefined && Object.hasOwn(owner.value as object, name);
      const initialPath: FieldPath | undefined = name === undefined ? undefined : rowLocation(owner, name) ?? [...owner.address.slice(1).map(String), name];
      mounted = base(context);
      if (!mounted.node.parent || mounted.node.props.ignore) {
        ignored = true;
        return;
      }
      const remount = initialPath !== undefined && composition.excluded.delete(fieldPathKey(initialPath));
      const path: FieldPath = rowLocation(mounted.node) ?? mounted.node.address.slice(1).map(String);
      if (remount) {
        void mounted.node.input(cloneAny(composition.baseline(path, props.value === undefined ? mounted.node.value : props.value)), false);
      } else if (!supplied && mounted.node.value === undefined && props.value !== undefined) {
        void mounted.node.input(cloneAny(props.value), false);
      }
      composition.baseline(path, mounted.node.value);
      resource = {
        parent: owner, release: () => releaseOwner ? releaseOwner() : destroy(), update: () => update(current.props, current.data, current.children)
      };
      composition.fields.add(resource);
    });
    if (ignored && !releaseOwner) {
      return mounted!;
    }
    if (ignored) {
      resource = {
        parent: owner, release: () => releaseOwner!(), update: () => update(current.props, current.data, current.children)
      };
      composition.fields.add(resource);
    }
    function update(...args: Parameters<InputMount['update']>) {
      // A native parent override may end this input before its separate
      // SchemaView renderer ends; its retained record must not recreate it.
      if (disposed) {
        return;
      }
      current = {
        ...current, props: args[0], data: args[1], children: args[2]
      };
      mounted.update(args[0], args[1], args[2]);
    }
    function destroy() {
      if (disposed) {
        return;
      }
      disposed = true;
      composition.mutate(() => {
        const node = mounted.node;
        for (const child of [...composition.fields].reverse()) {
          if (child === resource) {
            continue;
          }
          let ancestor: FormKitNode | null = child.parent;
          while (ancestor && ancestor !== node) {
            ancestor = ancestor.parent;
          }
          if (ancestor === node) {
            child.release();
          }
        }
        let preserved: boolean | undefined;
        for (let ancestor: FormKitNode | null = node; ancestor && preserved === undefined; ancestor = ancestor.parent) {
          preserved = undefine(ancestor.props.preserve);
        }
        const path = node.address.slice(1).map(String), clear = !ignored && ((!!releaseOwner && current.props.preserve === false) || !preserved);
        if (clear) {
          const location = rowLocation(node) ?? path;
          composition.excluded.set(fieldPathKey(location), location);
        }
        composition.fields.delete(resource);
        mounted.destroy();
        if (clear && owner.context !== null && owner.type === 'group' && Object.hasOwn(owner.value as object, String(node.name))) {
          owner.disturb();
          owner.calm({
            name: node.name, value: valueRemoved
          });
        }
      });
    }
    return {
      element: mounted!.element, get node() {
        return mounted.node;
      }, update, destroy
    };
  };
  const decorate: InputFactoryDecorator = (inherited, base) => wrap(inherited, base);
  return wrap(parent, inputFactory(parent, options, decorate), onRelease);
}
