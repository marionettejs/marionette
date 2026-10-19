import { MnObject } from 'marionette';
import type { ApplicationInstance, ApplicationStartOptions, MnObjectInstance, MnObjectConstructor } from 'marionette';
import { isEqual } from './is-equal.ts';

export type SelectionKey = string | number | boolean | null | undefined | SelectionKey[] | { [name: string]: SelectionKey };
export interface RouteOutletOptions {
  owner: ApplicationInstance<object, unknown>;
  onCleanupError?: (error: unknown, app: ApplicationInstance<object, unknown>) => void;
}
export interface SelectionOptions {
  key?: SelectionKey;
  restart?: boolean;
  options?: ApplicationStartOptions;
}
interface Methods {
  constructor: (options: RouteOutletOptions) => void;
  show(appName: string, selection?: SelectionOptions): Promise<ApplicationInstance<object, unknown> | undefined>;
  stop(): boolean;
  getCurrent(): ApplicationInstance<object, unknown> | null;
}
export type RouteOutletInstance = MnObjectInstance<RouteOutletOptions> & Methods;
type Selection = { app: ApplicationInstance<object, unknown>; appName: string; key: SelectionKey };
type State = {
  owner: ApplicationInstance<object, unknown>;
  onCleanupError: (error: unknown, app: ApplicationInstance<object, unknown>) => void;
  selection: Selection | null;
  intent: object | null;
};
const states = new WeakMap<RouteOutletInstance, State>();
const stateFor = (outlet: RouteOutletInstance) => states.get(outlet)!;

function invalidate(outlet: RouteOutletInstance) {
  stateFor(outlet).intent = null;
}

function stopSelection(outlet: RouteOutletInstance) {
  const state = stateFor(outlet);
  const selection = state.selection;
  if (!selection) { return; }
  selection.app.stop();
  if (state.selection === selection) { state.selection = null; }
}

function cleanup(outlet: RouteOutletInstance, selection: Selection) {
  try {
    stopSelection(outlet);
  } catch (error) {
    stateFor(outlet).onCleanupError(error, selection.app);
  }
}

async function activate(outlet: RouteOutletInstance, intent: object, selection: Selection, options?: ApplicationStartOptions) {
  const state = stateFor(outlet);
  const { app } = selection;
  try {
    const started = await app.start(options);
    if (state.intent !== intent) { return; }
    if (started) { return app; }
    // False means the requested start lost authority. A stopped child may
    // already be preparing its own replacement: do not cancel that operation.
    // Keep the selection so the next outlet operation can still stop it.
  } catch (error) {
    if (state.intent !== intent) { return; }
    cleanup(outlet, selection);
    throw error;
  }
}

async function select(outlet: RouteOutletInstance, intent: object, app: ApplicationInstance<object, unknown>,
  appName: string, { key, restart = false, options }: SelectionOptions) {
  const state = stateFor(outlet);
  const current = state.selection;
  if (!restart && current?.app === app && current.appName === appName && isEqual(current.key, key)) {
    return activate(outlet, intent, current, options);
  }
  stopSelection(outlet);
  if (state.intent !== intent) { return; }
  const selected = { app, appName, key };
  state.selection = selected;
  return activate(outlet, intent, selected, options);
}

function constructOutlet(this: RouteOutletInstance, options: RouteOutletOptions) {
  const state: State = {
    owner: options.owner, onCleanupError: options.onCleanupError ?? (() => {}), selection: null, intent: null
  };
  states.set(this, state);
  // Mandatory ownership setup precedes initialize, and survives hook overrides.
  this.listenTo(options.owner, {
    'before:stop': () => invalidate(this),
    'stop': () => { if (!state.intent) { state.selection = null; } },
    'before:destroy': () => invalidate(this),
    'destroy': () => this.destroy(),
  });
  this.on('before:destroy', () => {
    invalidate(this);
    state.selection = null;
  });
  MnObject.call(this, options);
}

/** Selects a registered child Application; the owner retains lifecycle authority. */
export const RouteOutlet = MnObject.extend({
  constructor: constructOutlet,

  async show(this: RouteOutletInstance, appName: string, selection: SelectionOptions = {}) {
    const state = stateFor(this);
    if (this.isDestroyed() || state.owner.isDestroyed()) { return; }
    const app = state.owner.getChildApp(appName);
    if (!app) { throw new Error(`Child application "${ appName }" is not registered`); }
    const intent = {};
    state.intent = intent;
    try {
      return await select(this, intent, app, appName, selection);
    } catch (error) {
      if (state.intent !== intent) { return; }
      throw error;
    }
  },

  stop(this: RouteOutletInstance) {
    invalidate(this);
    stopSelection(this);
    return true;
  },

  getCurrent(this: RouteOutletInstance) {
    return stateFor(this).selection?.app ?? null;
  },
}) as unknown as MnObjectConstructor<Methods, [options: RouteOutletOptions]>;
