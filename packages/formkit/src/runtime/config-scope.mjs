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
// Providers can use these ready-made plugins as-is. A View that adds defaults
// instead rebuilds from its final declarative options and keeps only extra plugins.
export const preparedDefaults = Symbol('prepared FormKit defaults');
const mergeable = ['inputs', 'rules', 'locales', 'messages', 'icons'];
export function withPreparedDefaults(options) {
  const prepared = options[preparedDefaults];
  if (!prepared?.length) {return options;}
  const extra = options.plugins?.filter(plugin=>!prepared.some(entry=>entry.plugins.includes(plugin)));
  const merged = {...options,plugins: extra};
  for (const key of mergeable) {
    const sources = [...prepared.map(entry=>entry.options[key]),options[key]].filter(Boolean);
    if (sources.length) {
      merged[key] = key === 'messages' ? sources.reduce((messages,next)=>extend(messages,next),{}) :
        Object.assign({},...sources);
    }
  }
  return merged;
}
export function defaultConfig(options = {}) {
  options = withPreparedDefaults(options);
  const definitions = extend(inputs,options.inputs ?? {});
  const plugins = [
    createLibraryPlugin(inputs,options.inputs ?? {}),createThemePlugin(options.theme,options.icons,options.iconLoaderUrl,options.iconLoader),bindings,
    createI18nPlugin(extend({en,...options.locales},options.messages ?? {})),createValidationPlugin({...rules,...options.rules})
  ];
  const declarative = Object.fromEntries(mergeable.map(key=>[key,options[key]]));
  return {...options,[preparedDefaults]: [{plugins,options: declarative}],inputs: definitions,config: {...(options.locale !== undefined ? {locale: options.locale} : {}),rootClasses: section=>({[`formkit-${kebab(section)}`]: true}),...options.config},plugins: [...plugins,...(options.plugins ?? [])]};
}
export function normalizeConfig(config) {
  const raw = (typeof config === 'function' ? config() : config) ?? {};
  const options = {...raw,config: raw.config?.rootConfig ? raw.config : {rootConfig: createConfig(raw.config ?? {})}};
  return {options,definitions: raw.inputs ?? {}};
}
