import { View } from 'marionette';
import type { ViewConfiguration } from 'marionette';
import type { FormKitNode, FormKitSchemaDefinition } from '@formkit/core';
import type { FormValues, FormView } from './index.ts';
import { compositions } from './composition.ts';
import type { FieldResource } from './composition.ts';
import { ownedInputFactory } from './composition-input.ts';
import { createSchemaRenderer, scoped } from './schema.ts';
import type { SchemaComponentFactory } from './schema.ts';
export interface SchemaViewOptions<Values extends object = FormValues> extends Omit<ViewConfiguration, 'template' | 'el'> {
    form: FormView<Values>;
    parent?: FormKitNode;
    schema: FormKitSchemaDefinition;
    schemaData?: Record<string, unknown>;
    components?: Record<string, SchemaComponentFactory>;
}
export class SchemaView<Values extends object = FormValues> extends View {
  #schemaOptions: SchemaViewOptions<Values>;
  #renderer?: ReturnType<typeof createSchemaRenderer>;
  #resource?: FieldResource;
  #parentReceipt?: string;
  #releaseNative?: () => void;
  #disposed = false;
  constructor(options: SchemaViewOptions<Values>) {
    super({
      ...options, template: () => ''
    });
    this.#schemaOptions = options;
    this.on('before:destroy', () => this.#dispose());
  }
  get node(): FormKitNode {
    return this.#schemaOptions.parent ?? this.#schemaOptions.form.node;
  }
  render() {
    if (this.isDestroyed()) {
      return this;
    }
    const { form } = this.#schemaOptions;
    if (!compositions.has(form.node)) {
      throw new Error('The SchemaView owner has been destroyed.');
    }
    if (this.node.context === null || this.node.root !== form.node || this.node.type !== 'group') {
      throw new Error('Schema parent must be a live group owned by its form.');
    }
    if (!this.isRendered()) {
      super.render();
    }
    return this;
  }
  attachElContent() {
    const { form, schema, components } = this.#schemaOptions;
    const parent = this.node;
    const composition = compositions.get(form.node)!;
    this.#releaseNative = composition.captureNativeEvents(this.el);
    this.#resource = {
      // Construction runs inside mutate; refresh cannot observe an unfinished renderer.
      parent, release: () => this.destroy(), update: () => this.#renderer!.update(this.#data())
    };
    composition.fields.add(this.#resource);
    this.#parentReceipt = parent.on('destroying', () => this.destroy());
    try {
      composition.mutate(() => {
        this.#renderer = createSchemaRenderer(this.el, {
          schema, data: this.#data(), components: {
            ...composition.options.components, ...components, FormKit: ownedInputFactory(parent, {
              ...composition.options, components: {
                ...composition.options.components, ...components
              }
            }, composition)
          }
        });
      });
    } catch (error) {
      this.#dispose();
      throw error;
    }
  }
  #data() {
    return scoped(this.#schemaOptions.schemaData ?? {}, { node: this.node });
  }
  setSchemaData(data: Record<string, unknown>) {
    if (!this.#disposed) {
      this.#schemaOptions.schemaData = data;
      this.#renderer?.update(this.#data());
    }
    return this;
  }
  setSchema(schema: FormKitSchemaDefinition) {
    if (!this.#disposed) {
      this.#schemaOptions.schema = schema;
      this.#renderer?.setSchema(schema);
    }
    return this;
  }
  #dispose() {
    if (this.#disposed) {
      return;
    }
    this.#disposed = true;
    this.#releaseNative?.();
    const composition = compositions.get(this.#schemaOptions.form.node);
    if (this.#parentReceipt) {
      this.node.off(this.#parentReceipt);
    }
    if (this.#resource) {
      // FormView releases registered resources before deleting its composition.
      composition!.fields.delete(this.#resource);
    }
    this.#renderer?.destroy();
    this.#renderer = undefined;
  }
}
