import { View, CollectionView } from 'marionette';
import type { ViewInstance, CollectionViewInstance } from 'marionette';
type ComponentView = ViewInstance | CollectionViewInstance;
import { FormView, FieldView } from './index.ts';
import { isNode } from '@formkit/core';
import { copyProps, sameValues } from './runtime.ts';
import type { FormKitNode } from '@formkit/core';
import type { FormValues, FieldOptions } from './index.ts';
import type { SchemaComponentFactory, SchemaComponent } from './schema.ts';
export interface ViewComponentRegistration<Values extends object = FormValues, Props extends Record<string, unknown> = Record<string, unknown>, Result extends ComponentView = ComponentView> {
    kind: 'view';
    create(context: {
        form: FormView<Values>;
        parent: FormKitNode;
        props: Props;
        data: Record<string, unknown>;
        children?: unknown;
    }): Result;
    update?(view: Result, props: Props, data: Record<string, unknown>, children?: unknown): void;
}
export interface FieldComponentRegistration<Values extends object = FormValues> {
    kind: 'field';
    create(options: FieldOptions<Values>): FieldView<Values>;
}
export interface ViewComponentsOptions<Values extends object = FormValues> {
    getForm(): FormView<Values>;
    getOwner?(): ViewInstance;
    getParent?(props: Record<string, unknown>, data: Record<string, unknown>): FormKitNode;
    registrations: Record<string, ViewComponentRegistration<Values> | FieldComponentRegistration<Values>>;
}
const immutable = ['type', 'id', 'plugins', 'config', 'name', 'parent', 'preserve', 'ignore'];
let nextRegion = 0;
// Views share the existing native schema factory contract and ordinary Regions.
export function createViewComponents<Values extends object = FormValues>({ getForm, getOwner = getForm, getParent, registrations }: ViewComponentsOptions<Values>): Record<string, SchemaComponentFactory> {
  const registry = Object.fromEntries(Object.entries(registrations).map(([name, spec]) => [name, (context: Parameters<SchemaComponentFactory>[0]) => {
    const { document, data, children } = context;
    const props = context.props as Record<string, any>;
    const form = getForm(), owner = getOwner();
    if (!form || form.isDestroyed() || !owner || owner.isDestroyed()) {
      throw new Error('A live form and ordinary Region owner are required.');
    }
    const parent = getParent ? getParent(props, data) : isNode(data.node) ? data.node : form.node;
    const wrapper = document.createElement('div');
    wrapper.setAttribute('data-schema-view', name);
    const regionName = `schemaViewBridge${++nextRegion}`;
    const region = owner.addRegion(regionName, {
      el: wrapper
    });
    let view!: ComponentView, disposed = false, previous = copyProps(props) as Record<string, any>;
    const isField = spec.kind === 'field';
    if (isField && props.input?.type === 'form') {
      owner.removeRegion(regionName);
      throw new Error('Nested form inputs are excluded from this bridge.');
    }
    const identity = (fieldProps: Record<string, any>) => ({
      name: fieldProps.name, removal: fieldProps.removal ?? 'preserve', input: Object.fromEntries(immutable.filter(key => Object.hasOwn(fieldProps.input ?? {}, key)).map(key => [key, fieldProps.input[key]]))
    });
    const originalIdentity = identity(props);
    function destroy() {
      if (disposed) {
        return;
      }
      disposed = true;
      owner.off('before:destroy', destroy);
      view?.off('destroy', destroy);
      if (!region.isDestroyed()) {
        owner.removeRegion(regionName);
      }
      if (view && !view.isDestroyed()) {
        view.destroy();
      }
    }
    try {
      view = isField ? (spec as FieldComponentRegistration<Values>).create({
        form, parent, name: props.name, removal: props.removal ?? 'preserve', input: props.input
      }) : (spec as ViewComponentRegistration<Values, any, any>).create({
        form, parent, props, data, children
      });
      if (!(view instanceof View || view instanceof CollectionView) || view instanceof FormView) {
        throw new Error('The registry must return an ordinary Marionette View, CollectionView or FieldView, never FormView.');
      }
      if (!isField && view instanceof FieldView) {
        throw new Error('FieldView requires an explicit field registration.');
      }
      if (isField && !(view instanceof FieldView)) {
        throw new Error('Field registration must return an actual FieldView.');
      }
      view.render();
      view.on('destroy', destroy);
      owner.on('before:destroy', destroy);
    } catch (error) {
      destroy();
      throw error;
    }
    const component: SchemaComponent = {
      element: wrapper, update(nextProps, nextData, nextChildren) {
        const next = nextProps as Record<string, any>;
        if (disposed || view.isDestroyed()) {
          return;
        }
        if (isField && (!sameValues(identity(next), originalIdentity) || getParent && getParent(next, nextData) !== parent)) {
          throw new Error('Change the schema key to replace FieldView identity; dispose first when reusing its group/name.');
        }
        const old = previous;
        // A field write can synchronously refresh its owning schema. Publish the
        // snapshot first so that refresh observes this update as already applied.
        previous = copyProps(next) as Record<string, any>;
        if (isField) {
          const allowed = Object.fromEntries(Object.entries(next.input ?? {}).filter(([key]) => !immutable.includes(key) && key !== 'value'));
          const oldAllowed = Object.fromEntries(Object.entries(old.input ?? {}).filter(([key]) => !immutable.includes(key) && key !== 'value'));
          if (!sameValues(allowed, oldAllowed)) {
            const cleared = Object.fromEntries(Object.keys(oldAllowed).filter(key => !Object.hasOwn(allowed, key)).map(key => [key, undefined]));
            (view as FieldView<Values>).setInput({
              ...cleared, ...allowed
            });
          }
          if (Object.hasOwn(next.input ?? {}, 'value') && !sameValues(next.input.value, old.input?.value)) {
            (view as FieldView<Values>).setValue(next.input.value);
          }
        } else {
          (spec as ViewComponentRegistration<Values, any, any>).update?.(view, next, nextData, nextChildren);
        }
      }, destroy
    };
    queueMicrotask(() => {
      if (disposed || view.isDestroyed() || owner.isDestroyed()) {
        return;
      }
      if (!owner.el.contains(wrapper)) {
        destroy();
        throw new Error('The schema wrapper must be inserted inside its Region owner before placement.');
      }
      region.show(view);
    });
    return component;
  }]));
  return registry;
}
