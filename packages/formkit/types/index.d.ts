import type {
  ApplicationConstructor, ApplicationInstance, ApplicationOptions,
  ViewConfiguration, ViewConstructor, ViewInstance, LifecycleContext
} from 'marionette';
import type {
  ErrorMessages, FormKitConfig, FormKitFrameworkContext,
  FormKitNode, FormKitPlugin, FormKitRootConfig, FormKitSchemaDefinition,
  FormKitSectionsSchema, FormKitTypeDefinition
} from '@formkit/core';
import type { FormKitValidationRule, FormKitValidationMessages } from '@formkit/validation';
import type { FormKitLocale, FormKitLocaleRegistry } from '@formkit/i18n';

export type FormValues = Record<string, unknown>;
export type Schema = FormKitSchemaDefinition | number | false | null | readonly Schema[];
export type SectionClasses = NonNullable<FormKitConfig['classes']>;
export type Dispose = (remove?: boolean) => void;
export type IconLoader = (name: string) => string | undefined | PromiseLike<string | undefined>;
export type IconLoaderUrl = (name: string) => string;

export interface ComponentInstance<Props extends object = Record<string, unknown>> {
  update?(props: Props): void;
  refresh?(): void;
  destroy?(remove?: boolean): void;
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
export interface ChangeInfo { source: string }
export interface SetValuesOptions { source?: string; notify?: boolean }
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
  readonly node: FormKitNode;
  readonly config: FormKitConfig;
  readonly metrics: FormMetrics;
  readonly components: ComponentLibrary;
  readonly formMessages: HTMLElement | null;
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
export type FormKitViewInstance<Values extends object = FormValues> =
  Omit<ViewInstance<FormKitViewOptions<Values>>, keyof FormKitViewMembers<Values>> & FormKitViewMembers<Values>;
export type FormKitViewConstructor = {
  new <Values extends object = FormValues>(options?: FormKitViewOptions<Values>): FormKitViewInstance<Values>;
} & ViewConstructor<FormKitViewMembers, [options?: FormKitViewOptions]>;
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
