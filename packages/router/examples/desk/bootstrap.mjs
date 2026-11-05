// This module imports no application/router module and constructs no globals.
export function missingRouterCapabilities({ native = true } = {}) {
  const available = {
    URLPattern: typeof globalThis.URLPattern === 'function',
    'AbortSignal.any': typeof globalThis.AbortSignal?.any === 'function',
    'Promise.withResolvers': typeof Promise.withResolvers === 'function',
    'URL.canParse': typeof globalThis.URL?.canParse === 'function',
    ...(native ? { 'Navigation API': Boolean(globalThis.navigation) } : {}),
  };
  return Object.keys(available).filter(name => !available[name]);
}

export async function boot(loadApplication, options) {
  const missing = missingRouterCapabilities(options);
  if (missing.length) { return { status: 'unsupported', missing }; }
  const application = await loadApplication();
  return { status: 'started', app: await application.start() };
}
