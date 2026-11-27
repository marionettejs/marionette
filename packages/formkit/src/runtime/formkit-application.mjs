import { formKitScope } from './provider-scope.mjs';
import { preparedDefaults } from './config-scope.mjs';
// FormKit config readiness and scope through ordinary Marionette Application ownership.
import { Application } from 'marionette';
import { createConfig } from '@formkit/core';
import { kebab } from '@formkit/utils';

// A FormKit root config is mutable and may be shared with other forms.
const stockRootConfigs = new WeakMap();
export function hasStockRootConfig(config) {
  const defaults = stockRootConfigs.get(config);
  if (!defaults || Object.getPrototypeOf(config) !== Object.prototype ||
    Reflect.ownKeys(config).length !== defaults.length) {return false;}
  return defaults.every(([key, value]) => {
    const property = Object.getOwnPropertyDescriptor(config, key);
    return property && Object.hasOwn(property, 'value') && Object.is(property.value, value);
  });
}

export function createFormKitApplication(FormView) {
  return Application.extend({
    async prepareStart(options = {}, { signal }) {
      const settings = {
        config: this.getOption('config'), configFile: this.getOption('configFile'),
        defaultConfig: this.getOption('defaultConfig'), provider: this.getOption('provider'),
        ...options
      };
      if (settings.provider) {
        const started = await settings.provider.start();
        signal.throwIfAborted();
        if (!started) {throw new Error('FormKit provider preparation was cancelled');}
        return settings.provider.getFormKitScope();
      }
      let loaded = settings.config;
      if (loaded === undefined) {
        const module = settings.configFile ? await import(settings.configFile) : {};
        loaded = 'default' in module ? module.default : module;
      }
      signal.throwIfAborted();
      if (typeof loaded === 'function') {loaded = loaded();}
      signal.throwIfAborted();
      const raw = loaded ?? {}, defaults = settings.defaultConfig !== false;
      const suppliedRootConfig = raw.config?.rootConfig;
      const rootConfig = suppliedRootConfig ?? createConfig({
        ...(defaults ? { locale: 'en', rootClasses: section => ({ [`formkit-${kebab(section)}`]: true }) } : {}),
        ...(raw.locale !== undefined ? { locale: raw.locale } : {}), ...raw.config
      });
      if (defaults && suppliedRootConfig == null && Object.keys(raw.config ?? {}).length === 0) {
        stockRootConfigs.set(rootConfig,Object.entries(rootConfig));
      }
      return { options: raw, defaultConfig: defaults, rootConfig };
    },
    onStart(_application, options, scope) {
      this._formKitScope = scope;
      const region = this.getRegion();
      if (!region) {return;} // A nonvisual Application can provide config to owned children.
      const host = typeof region.el === 'string' ? region.getEl(region.el) : region.el;
      this.showView(this.createFormView({
        ...this.getFormOptions(options?.form ?? this.getOption('form')),
        domRoot: host?.getRootNode()
      }));
    },
    createFormView(options) { return new FormView(options); },
    getFormKitScope() { return this.isRunning() ? this._formKitScope : undefined; },
    getFormOptions(form = {}) {
      const scope = this.getFormKitScope();
      if (!scope) {throw new Error('Start the FormKit Application before creating scoped forms');}
      const inherited = scope.options[preparedDefaults], local = form[preparedDefaults];
      return {
        ...scope.options, ...form, [formKitScope]: true,
        [preparedDefaults]: inherited && local ? [...inherited, ...local] : inherited ?? local,
        config: { rootConfig: scope.rootConfig, ...(form.locale !== undefined ? { locale: form.locale } : {}), ...form.config },
        plugins: [...(scope.options.plugins ?? []), ...(form.plugins ?? [])],
        defaultConfig: scope.defaultConfig
      };
    },
    onStop() { this._formKitScope = undefined; }
  });
}
