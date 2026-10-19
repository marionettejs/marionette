import type { Driver } from '../types.ts';

/*
 * Adapts the document Navigation API. No browser resources are acquired until called.
 */
export function navigationDriver(navigation: Navigation | Omit<Driver, 'capabilities'> | undefined = globalThis.navigation): Driver {
  if (!navigation) {
    throw new TypeError('navigationDriver requires the Navigation API');
  }
  // Active document entries have URLs. The native types also cover detached
  // entries, which the Router does not use. No wrapper entries are allocated.
  const source = navigation as Omit<Driver, 'capabilities'>;
  return {
    capabilities: { cancelTraverse: false, interceptsLinks: true },
    get currentEntry() { return source.currentEntry; },
    entries: () => source.entries(),
    navigate: (url, options) => source.navigate(url, options),
    reload: options => source.reload(options),
    back: () => source.back(),
    traverseTo: key => source.traverseTo(key),
    updateCurrentEntry: options => source.updateCurrentEntry(options),
    addEventListener: (type, listener, options) => source.addEventListener(type, listener, options),
  };
}
