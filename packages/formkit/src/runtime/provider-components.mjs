import { Application } from 'marionette';
import { defaultConfig, normalizeConfig, formKitScope, providerBoundary } from './config-scope.mjs';

function omit(props,keys) {return Object.fromEntries(Object.entries(props).filter(([key])=>!keys.includes(key)));}

export function createFormKitProviders(view) {
  const FormKitProvider = ({props,configScope,renderChildren})=>{
    // The stable lexical envelope lets new descendants see replacement options
    // without recreating existing Core nodes or overwriting their values/config.
    let attrs = omit(props,['config']);
    let current = props.config,ownScope = current ? normalizeConfig(current) : undefined;
    const scope = {get options() {return ownScope?.options ?? configScope?.options;},get definitions() {return ownScope?.definitions ?? configScope?.definitions;}};
    const dispose = renderChildren(undefined,null,{[formKitScope]: scope},()=>attrs);
    return {update(next) {attrs = omit(next,['config']);if (next.config !== current) {current = next.config;ownScope = current ? normalizeConfig(current) : undefined;}},destroy: dispose};
  };
  const FormKitLazyProvider = ({props,configScope,renderChildren})=>{
    let settingsProps = props,attrs = omit(props,['configFile','defaultConfig','onProvider']);
    let inheritedOptions = configScope?.options,children,loadedScope,application;
    const scope = {get options() {return configScope?.options ?? loadedScope?.options;},get definitions() {return configScope?.options ? configScope.definitions : loadedScope?.definitions;}};
    const clear = ()=>{children?.();children = undefined;};
    const show = next=>{loadedScope = next;if (!children) {children = renderChildren(undefined,null,{[formKitScope]: scope},()=>attrs);}};
    const getApplication = ()=>{
      if (application) {return application;}
      const Loader = Application.extend({
        async prepareStart(options = {}, {signal}) {
          const inherited = configScope?.options;
          if (inherited) {return {options: inherited,definitions: configScope.definitions};}
          const settings = {...settingsProps,...options};
          const module = settings.configFile ? await import(settings.configFile) : {};
          signal.throwIfAborted();
          let loaded = 'default' in module ? module.default : module;
          if (typeof loaded === 'function') {loaded = loaded();}
          signal.throwIfAborted();
          return normalizeConfig(settings.defaultConfig === false ? loaded : defaultConfig(loaded));
        },
        onStart(_application,_options,next) {show(next);view.trigger('provider:ready',this);},
        onStop: clear
      });
      application = new Loader();settingsProps.onProvider?.(application);return application;
    };
    const report = error=>view.trigger('provider:error',error,application);
    if (inheritedOptions) {show({options: inheritedOptions,definitions: configScope.definitions});} else {getApplication().start().catch(report);}
    return {update(next) {
      attrs = omit(next,['configFile','defaultConfig','onProvider']);
      const inherited = configScope?.options,switched = !!inherited !== !!inheritedOptions;
      const reload = next.configFile !== settingsProps.configFile || next.defaultConfig !== settingsProps.defaultConfig || inherited !== inheritedOptions;
      settingsProps = next;inheritedOptions = inherited;
      if (switched) {clear();}
      if (inherited && !application) {if (reload) {show({options: inherited,definitions: configScope.definitions});}} else if (reload) {if (application) {application.restart().catch(report);} else {getApplication().start().catch(report);}}
    },destroy() {application?.destroy();clear();}};
  };
  FormKitProvider[providerBoundary] = true;FormKitLazyProvider[providerBoundary] = true;
  return {FormKitProvider,FormKitLazyProvider};
}
