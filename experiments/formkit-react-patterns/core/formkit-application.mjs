import { formKitScope } from './provider-scope.mjs';
// FormKit config readiness and scope through ordinary Marionette Application ownership.
import { Application } from 'marionette';
import { createConfig } from '@formkit/core';
import { kebab } from '@formkit/utils';

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
        if (!started) throw new Error('FormKit provider preparation was cancelled');
        return settings.provider.getFormKitScope();
      }
      let loaded = settings.config;
      if (loaded === undefined) {
        const module = settings.configFile ? await import(settings.configFile) : {};
        loaded = 'default' in module ? module.default : module;
      }
      signal.throwIfAborted();
      if (typeof loaded === 'function') loaded = loaded();
      signal.throwIfAborted();
      const raw = loaded ?? {}, defaults = settings.defaultConfig !== false;
      const rootConfig = raw.config?.rootConfig ?? createConfig({
        ...(defaults ? { locale: 'en', rootClasses: section => ({ [`formkit-${kebab(section)}`]: true }) } : {}),
        ...(defaults&&raw.locale ? { locale: raw.locale } : {}), ...raw.config
      });
      return { options: raw, defaultConfig: defaults, rootConfig };
    },
    onStart(_application, options, scope) {
      this._formKitScope = scope;
      const region = this.getRegion();
      if (!region) return; // A nonvisual Application can provide config to owned children.
      const host = typeof region.el === 'string' ? region.getEl(region.el) : region.el;
      this.showView(this.createFormView({
        ...this.getFormOptions(options?.form ?? this.getOption('form')),
        domRoot: host.getRootNode()
      }));
    },
    createFormView(options) { return new FormView(options); },
    getFormKitScope() { return this.isRunning() ? this._formKitScope : undefined; },
    getFormOptions(form = {}) {
      const scope = this.getFormKitScope();
      if (!scope) throw new Error('Start the FormKit Application before creating scoped forms');
      return {
        ...scope.options, ...form, [formKitScope]:true,
        config: { rootConfig: scope.rootConfig, ...form.config },
        plugins: [...(scope.options.plugins ?? []), ...(form.plugins ?? [])],
        defaultConfig: scope.defaultConfig
      };
    },
    onStop() { this._formKitScope = undefined; }
  });
}
