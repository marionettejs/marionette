import type {
  ApplicationConstructor, ApplicationInstance, ApplicationOptions,
  ViewConfiguration, ViewConstructor, ViewInstance, LifecycleContext
} from 'marionette';
import type {
  ErrorMessages, FormKitConfig, FormKitFrameworkContext,
  FormKitNode, FormKitPlugin, FormKitRootConfig, FormKitSchemaDefinition,
  FormKitSchemaComponent, FormKitSchemaCondition, FormKitSchemaDOMNode, FormKitSchemaFormKit,
  FormKitSectionsSchema, FormKitTypeDefinition
} from '@formkit/core';
import type { FormKitValidationRule, FormKitValidationMessages } from '@formkit/validation';
import type { FormKitLocale, FormKitLocaleRegistry } from '@formkit/i18n';

export type FormValues = Record<string, unknown>;
type ComponentSchema = Omit<FormKitSchemaComponent, 'children' | 'slots'> & {
  children?: Schema;
  slots?: Readonly<Record<string, Schema | undefined>>;
};
type DOMSchema = Omit<FormKitSchemaDOMNode, 'children'> & { children?: Schema };
type ConditionalSchema = Omit<FormKitSchemaCondition, 'then' | 'else'> & { then: Schema; else?: Schema };
type FieldSchema = Omit<FormKitSchemaFormKit, 'children'> & { $formkit: string; children?: Schema };
export type Schema = FormKitSchemaDefinition | ComponentSchema | DOMSchema | ConditionalSchema | FieldSchema |
  number | false | null | readonly Schema[];
export type SectionClasses = NonNullable<FormKitConfig['classes']>;
export type Dispose = (remove?: boolean) => void;
export type IconLoader = (name: string) => string | undefined | PromiseLike<string | undefined>;
export type IconLoaderUrl = (name: string) => string;

export interface ComponentInstance<Props extends object = Record<string, unknown>> {
  update?(props: Props): void;
  refresh?(): void;
  destroy?(remove?: boolean): void;
}
export interface ComponentSlotInstance {
  update(data?: Record<PropertyKey, unknown>): void;
  destroy(remove?: boolean): void;
}
export interface ComponentFactoryContext<Props extends object = Record<string, unknown>> {
  host: HTMLElement;
  props: Props;
  context: Partial<FormKitFrameworkContext>;
  parentNode?: FormKitNode;
  domRoot?: Document | ShadowRoot;
  locals: Record<PropertyKey, unknown>;
  schemaData: Record<string, unknown>;
  configScope?: { options?: FormKitConfigOptions; definitions?: Record<string, FormKitTypeDefinition> };
  hasChildren: boolean;
  schemaChildren?: Schema;
  renderSlot(name: string, target?: Node, before?: Node | null, data?: Record<PropertyKey, unknown>): ComponentSlotInstance | undefined;
  renderChildren(target?: Node, before?: Node | null, data?: Record<PropertyKey, unknown>, inheritedProps?: () => Record<string, unknown>): Dispose;
}
export type ComponentFactory<Props extends object = Record<string, unknown>> =
  (args: ComponentFactoryContext<Props>) => ComponentInstance<Props> | void;
export type ComponentLibrary = Record<string, ComponentFactory>;
export interface SlotContext {
  parent: Node;
  before: Node | null;
  context: Partial<FormKitFrameworkContext>;
  locals: Record<PropertyKey, unknown>;
}
export interface SlotInstance {
  update?(args: SlotContext): void;
  destroy?(remove?: boolean): void;
}
export type Slot = (args: SlotContext) => Dispose | SlotInstance | void;
export interface RootSlotContext extends SlotContext {
  renderFields(parent?: Node, before?: Node | null): Dispose;
}
export type RootSlot = (args: RootSlotContext) => Dispose | SlotInstance | void;
export type RootSlots = Record<string, Schema | RootSlot>;

/** Plugins may add props; declared native prop types still reject invalid values. */
export interface FieldSpec {
  name?: string | number;
  key?: unknown;
  type?: string;
  value?: unknown;
  modelValue?: unknown;
  defaultValue?: unknown;
  label?: string;
  help?: string;
  disabled?: boolean | string;
  validation?: string | readonly unknown[];
  validationVisibility?: string;
  validationLabel?: string | ((node: FormKitNode) => string);
  validationRules?: Record<string, FormKitValidationRule>;
  validationMessages?: FormKitValidationMessages;
  attrs?: Record<string, unknown>;
  classes?: SectionClasses;
  config?: Partial<FormKitConfig>;
  plugins?: readonly FormKitPlugin[];
  definition?: FormKitTypeDefinition;
  library?: ComponentLibrary;
  sectionsSchema?: FormKitSectionsSchema;
  errors?: readonly string[];
  inputErrors?: Record<string, string | readonly string[]>;
  children?: readonly FieldSpec[] | Record<string, Schema>;
  onNode?(node: FormKitNode): void;
  onInput?(value: unknown, node: FormKitNode): void;
  onInputRaw?(value: unknown, node: FormKitNode): void;
  onChange?(value: unknown, node: FormKitNode): void;
  onUpdateModelValue?(value: unknown): void;
  'onUpdate:modelValue'?(value: unknown): void;
  [prop: string]: unknown;
}
export interface FormKitConfigOptions {
  inputs?: Record<string, FormKitTypeDefinition>;
  plugins?: readonly FormKitPlugin[];
  config?: Partial<FormKitConfig>;
  locale?: string;
  classes?: SectionClasses;
  rules?: Record<string, FormKitValidationRule>;
  locales?: FormKitLocaleRegistry;
  messages?: Record<string, Partial<FormKitLocale>>;
  theme?: string;
  icons?: Record<string, string | undefined>;
  iconLoader?: IconLoader;
  iconLoaderUrl?: IconLoaderUrl;
}
export interface FormProps {
  id?: string;
  name?: string;
  attrs?: Record<string, unknown>;
  actions?: boolean;
  disabled?: boolean;
  submitLabel?: string;
  incompleteMessage?: string | false;
  library?: ComponentLibrary;
  sectionsSchema?: FormKitSectionsSchema;
  [prop: string]: unknown;
}
export interface Declaration {
  fields?: readonly FieldSpec[];
  schema?: Schema;
}
export interface FormOptions<Values extends object = FormValues> extends FormKitConfigOptions {
  values?: Partial<Values>;
  components?: ComponentLibrary;
  data?: Record<string, unknown>;
  slots?: RootSlots;
  schemaSlots?: Record<string, Slot>;
  formProps?: FormProps;
  sectionsSchema?: FormKitSectionsSchema;
  defaultConfig?: boolean;
  instrument?: boolean;
  /** Compatibility fixture option. Prefer an explicit fields or schema declaration. */
  count?: number;
  onSubmit?(values: Values, node: FormKitNode): unknown | PromiseLike<unknown>;
  onSubmitInvalid?(node: FormKitNode): void;
  onSubmitRaw?(event: Event | undefined, node: FormKitNode): void;
}
export type FormKitViewOptions<Values extends object = FormValues> =
  ViewConfiguration & FormOptions<Values> & Declaration;
export type MountOptions<Values extends object = FormValues> =
  FormOptions<Values> & Declaration & { host: Element | string };
export interface FormState {
  submitted: boolean;
  submitting: boolean;
  valid: boolean;
  errors: string[];
}
/** Origin established by an explicit adapter operation; other origins remain unknown. */
export type FieldCommitSource = 'programmatic' | 'reset' | 'unknown';
/** Detached commit-time data. node is an identity handle, not a captured live value. */
export interface FieldCommitFact {
  readonly node: FormKitNode;
  readonly generation: symbol;
  readonly path: readonly (string | number)[];
  readonly value: unknown;
  readonly previous: unknown;
  readonly changed: boolean;
  readonly source: FieldCommitSource;
}
export type FieldCommitObserver = (this: void, fact: FieldCommitFact) => void;
export interface ValueProjectionOptions<Values extends object = FormValues> {
  /** Read the latest application projection, including any explicit pending-intent policy. */
  read(): Partial<Values>;
  source?: string;
  /** false replaces supplied top-level branches instead of recursively merging. */
  merge?: boolean;
  /** Reports once per failed operation, including fire-and-forget requests. */
  onError?: (this: void, error: unknown) => void;
}
export interface ValueProjection {
  /** Coalesces current requests and reads after the pending-edit fence. Handle rejection explicitly. */
  request(): Promise<void>;
  /** Requests a fresh current projection; a previous failure does not poison retry. */
  flush(): Promise<void>;
  dispose(): void;
  readonly disposed: boolean;
}
export interface PendingEditsOptions { signal?: AbortSignal }
export interface ChangeInfo { source: string }
export interface SetValuesOptions {
  source?: string;
  notify?: boolean;
  /** false replaces supplied top-level branches; omitted fields in retained records become empty. */
  merge?: boolean;
}
export interface FormMetrics {
  enabled: boolean;
  coreNodesCreated: number;
  coreNodesDestroyed: number;
  contextNotifications: number;
  domWrites: number;
  structuralChanges: number;
  [metric: string]: number | boolean;
}
export interface FormKitViewMembers<Values extends object = FormValues> {
  preinitialize(options?: FormKitViewOptions<Values>): void;
  render(): this;
  readonly node: FormKitNode;
  readonly config: FormKitConfig;
  readonly metrics: FormMetrics;
  readonly components: ComponentLibrary;
  readonly formMessages: HTMLElement | null;
  createValueProjection(options: ValueProjectionOptions<Values>): ValueProjection;
  observeFieldCommits(callback: FieldCommitObserver): () => void;
  whenPendingEditsSettled(options?: PendingEditsOptions): Promise<void>;
  getValues(): Values;
  getFormState(): FormState;
  setValues(values: Partial<Values>, options?: SetValuesOptions): FormKitViewInstance<Values>;
  setErrors(errors?: ErrorMessages, fieldErrors?: ErrorMessages): void;
  setFields(fields: readonly FieldSpec[]): void;
  setSchema(schema: Schema | undefined): FormKitViewInstance<Values> | undefined;
  updateData(data?: Record<string, unknown>): FormKitViewInstance<Values> | undefined;
  setSlots(slots?: RootSlots): FormKitViewInstance<Values> | undefined;
  setSectionsSchema(sections?: FormKitSectionsSchema): FormKitViewInstance<Values> | undefined;
  resetForm(): void;
  submit(): Promise<unknown> | undefined;
  onFormChange?(values: Values, state: FormState, info: ChangeInfo): void;
  onFormState?(state: FormState): void;
}
/** The instance class keeps native subclass lifecycle methods as methods. */
declare class NativeFormKitView<Values extends object = FormValues> {
  constructor(options?: FormKitViewOptions<Values>);
  preinitialize(options?: FormKitViewOptions<Values>): void;
  render(): this;
}
declare interface NativeFormKitView<Values extends object = FormValues> extends
  Omit<ViewInstance<FormKitViewOptions<Values>>, keyof FormKitViewMembers<Values>>,
  FormKitViewMembers<Values> {}
export type FormKitViewInstance<Values extends object = FormValues> = NativeFormKitView<Values>;
type FormKitViewStatics = Omit<Pick<
  ViewConstructor<FormKitViewMembers, [options?: FormKitViewOptions]>,
  keyof ViewConstructor<FormKitViewMembers, [options?: FormKitViewOptions]>
>, 'prototype'>;
export type FormKitViewConstructor = typeof NativeFormKitView & FormKitViewStatics & {
  (this: object, options?: FormKitViewOptions): void;
};
/** A normal Marionette View. Its Region owns attachment and destruction. */
export declare const FormKitView: FormKitViewConstructor;
export interface MountedForm<Values extends object = FormValues> {
  readonly form: FormKitViewInstance<Values>;
  readonly node: FormKitNode;
  readonly metrics: FormMetrics;
  setFields(fields: readonly FieldSpec[]): void;
  setSchema(schema: Schema | undefined): FormKitViewInstance<Values> | undefined;
  updateData(data?: Record<string, unknown>): FormKitViewInstance<Values> | undefined;
  setSlots(slots?: RootSlots): FormKitViewInstance<Values> | undefined;
  setSectionsSchema(sections?: FormKitSectionsSchema): FormKitViewInstance<Values> | undefined;
  createValueProjection(options: ValueProjectionOptions<Values>): ValueProjection;
  observeFieldCommits(callback: FieldCommitObserver): () => void;
  whenPendingEditsSettled(options?: PendingEditsOptions): Promise<void>;
  getValues(): Values;
  getFormState(): FormState;
  setValues(values: Partial<Values>, options?: SetValuesOptions): FormKitViewInstance<Values>;
  setErrors(errors?: ErrorMessages, fieldErrors?: ErrorMessages): void;
  clearErrors(): ReturnType<FormKitNode['clearErrors']>;
  reset(): void;
  submit(): Promise<unknown> | undefined;
  destroy(): void;
}
/** Creates and owns a Region; call destroy() when the mounted form is no longer needed. */
export declare function mount<Values extends object = FormValues>(options: MountOptions<Values>): MountedForm<Values>;
export declare function defaultConfig(options?: FormKitConfigOptions): FormKitConfigOptions & {
  inputs: Record<string, FormKitTypeDefinition>;
  plugins: FormKitPlugin[];
  config: Partial<FormKitConfig>;
};
/** Adapter binding plugin for explicitly configured raw pipelines. */
export declare const bindings: FormKitPlugin;
export interface FormKitScope {
  options: FormKitConfigOptions;
  rootConfig: FormKitRootConfig;
  defaultConfig: boolean;
}
export type ConfigSource = FormKitConfigOptions | (() => FormKitConfigOptions);
export interface FormKitApplicationOptions extends ApplicationOptions {
  config?: ConfigSource;
  configFile?: string | URL;
  defaultConfig?: boolean;
  provider?: FormKitApplicationInstance;
  form?: FormKitViewOptions;
}
export interface FormKitApplicationMembers {
  prepareStart(options: unknown, context: LifecycleContext): Promise<FormKitScope>;
  getFormKitScope(): FormKitScope | undefined;
  getFormOptions(form?: FormKitViewOptions): FormKitViewOptions;
  createFormView(options: FormKitViewOptions): FormKitViewInstance;
  getView(): FormKitViewInstance | undefined;
}
export type FormKitApplicationInstance =
  Omit<ApplicationInstance<FormKitApplicationOptions, object, FormKitScope>, keyof FormKitApplicationMembers> & FormKitApplicationMembers;
export type FormKitApplicationConstructor = ApplicationConstructor<FormKitApplicationMembers, [options?: FormKitApplicationOptions]>;
/** Application readiness and Region ownership for configured forms. */
export declare const FormKitApplication: FormKitApplicationConstructor;

// Keep declaration helpers local; only the explicit public exports above exist.
export {};
