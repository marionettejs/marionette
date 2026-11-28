import type { FormKitNode, FormKitPlugin, FormKitSectionsSchema } from '@formkit/core';
import type { ComponentFactory, ComponentFactoryContext, ComponentInstance, ComponentLibrary, IconLoader, IconLoaderUrl } from './index.js';
export type HelperFactoryContext<Props extends object> =
  Pick<ComponentFactoryContext<Props>, 'host' | 'props'> & Partial<Omit<ComponentFactoryContext<Props>, 'host' | 'props'>>;
export interface MessageProps {
  node?: FormKitNode;
  defaultPosition?: boolean | string;
  sectionsSchema?: FormKitSectionsSchema;
  library?: ComponentLibrary;
}
export interface SummaryEntry { message: string; id: string; key: string; type: string }
export interface SummaryProps {
  node?: FormKitNode;
  forceShow?: boolean;
  sectionsSchema?: FormKitSectionsSchema;
  onShow?(summaries: SummaryEntry[]): void;
}
export interface IconProps {
  node?: FormKitNode;
  icon?: string;
  iconLoader?: IconLoader;
  iconLoaderUrl?: IconLoaderUrl;
  class?: string;
  className?: string;
  id?: string;
  title?: string;
  role?: string;
  tabIndex?: number;
  tabindex?: number | string;
  onClick?(event: MouseEvent): void;
  onKeyDown?(event: KeyboardEvent): void;
  onKeydown?(event: KeyboardEvent): void;
  [attr: string]: unknown;
}
export interface HelperEnvironment {
  getNode?(): FormKitNode | undefined;
  getComponents?(): ComponentLibrary;
  getPlugins?(): readonly (FormKitPlugin & { iconHandler?: IconLoader })[];
}
export declare function FormKitMessages(args: HelperFactoryContext<MessageProps>, environment?: HelperEnvironment): ComponentInstance<MessageProps>;
export declare function FormKitSummary(args: HelperFactoryContext<SummaryProps>, environment?: HelperEnvironment): ComponentInstance<SummaryProps>;
export declare function FormKitIcon(args: HelperFactoryContext<IconProps>, environment?: HelperEnvironment): ComponentInstance<IconProps>;
export declare function createFormKitHelpers(environment?: HelperEnvironment): {
  FormKitMessages: ComponentFactory<MessageProps>;
  FormKitSummary: ComponentFactory<SummaryProps>;
  FormKitIcon: ComponentFactory<IconProps>;
};
