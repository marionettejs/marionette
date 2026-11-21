// Portable options context. Symbols stay out of schema expressions and DOM props.
import { createConfig } from '@formkit/core';
import { createLibraryPlugin, inputs } from '@formkit/inputs';
import { createThemePlugin } from '@formkit/themes';
import { createValidationPlugin } from '@formkit/validation';
import * as rules from '@formkit/rules';
import { createI18nPlugin, en } from '@formkit/i18n';
import { extend, kebab } from '@formkit/utils';
import { bindings } from './upstream-bindings.mjs';
export { formKitScope, providerBoundary } from './provider-scope.mjs';

// Provider configs are already configured options, like the official adapters.
// LazyProvider alone applies defaults unless defaultConfig is false.
export function defaultConfig(options = {}) {
  const definitions = extend(inputs,options.inputs ?? {});
  return {...options,inputs: definitions,config: {locale: options.locale ?? 'en',rootClasses: section=>({[`formkit-${kebab(section)}`]: true}),...options.config},plugins: [
    createLibraryPlugin(inputs,options.inputs ?? {}),createThemePlugin(options.theme,options.icons,options.iconLoaderUrl,options.iconLoader),bindings,
    createI18nPlugin(extend({en,...options.locales},options.messages ?? {})),createValidationPlugin({...rules,...options.rules}),...(options.plugins ?? [])
  ]};
}
export function normalizeConfig(config) {
  const raw = (typeof config === 'function' ? config() : config) ?? {};
  const options = {...raw,config: raw.config?.rootConfig ? raw.config : {rootConfig: createConfig(raw.config ?? {})}};
  return {options,definitions: raw.inputs ?? {}};
}
