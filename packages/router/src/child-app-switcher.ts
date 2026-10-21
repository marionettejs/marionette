import { MnObject } from 'marionette';
import type { ApplicationInstance, ApplicationStartOptions, MnObjectInstance, MnObjectConstructor } from 'marionette';
import { isEqual } from './is-equal.ts';

export type SelectionKey = string | number | boolean | null | undefined | SelectionKey[] | { [name: string]: SelectionKey };
export interface ChildAppSwitcherOptions {
  owner: ApplicationInstance<object, unknown>;
  onCleanupError?: (error: unknown, app: ApplicationInstance<object, unknown>) => void;
}
export interface SwitchOptions {
  key?: SelectionKey;
  reconstruct?: boolean;
  options?: ApplicationStartOptions;
}
interface Methods {
  switchTo(appName: string, selection?: SwitchOptions): Promise<ApplicationInstance<object, unknown> | undefined>;
  stop(): boolean;
  getCurrent(): ApplicationInstance<object, unknown> | null;
}
export type ChildAppSwitcherInstance = MnObjectInstance<ChildAppSwitcherOptions> & Methods;
type Selection = { app: ApplicationInstance<object, unknown>; appName: string; key: SelectionKey };
type State = {
  owner: ApplicationInstance<object, unknown>;
  onCleanupError: (error: unknown, app: ApplicationInstance<object, unknown>) => void;
  selection: Selection | null;
  intent: object | null;
  closed: boolean;
};
const states = new WeakMap<ChildAppSwitcherInstance, State>();
const stateFor = (switcher: ChildAppSwitcherInstance) => states.get(switcher)!;

function invalidate(switcher: ChildAppSwitcherInstance) {
  stateFor(switcher).intent = null;
}

function stopSelection(switcher: ChildAppSwitcherInstance) {
  const state = stateFor(switcher);
  const selection = state.selection;
  if (!selection) { return; }
  selection.app.stop();
  if (state.selection === selection) { state.selection = null; }
}

function cleanup(switcher: ChildAppSwitcherInstance, selection: Selection) {
  try {
    stopSelection(switcher);
  } catch (error) {
    stateFor(switcher).onCleanupError(error, selection.app);
  }
}

async function activate(switcher: ChildAppSwitcherInstance, intent: object, selection: Selection, options?: ApplicationStartOptions) {
  const state = stateFor(switcher);
  const { app } = selection;
  try {
    const started = await app.start(options);
    if (state.intent !== intent) { return; }
    if (started) { return app; }
    // False means the requested start lost authority. A stopped child may
    // already be preparing its own replacement: do not cancel that operation.
    // Keep the selection so the next switcher operation can still stop it.
  } catch (error) {
    if (state.intent !== intent) { return; }
    cleanup(switcher, selection);
    throw error;
  }
}

async function select(switcher: ChildAppSwitcherInstance, intent: object, app: ApplicationInstance<object, unknown>,
  appName: string, { key, reconstruct = false, options }: SwitchOptions) {
  const state = stateFor(switcher);
  const current = state.selection;
  if (!reconstruct && current?.app === app && current.appName === appName && isEqual(current.key, key)) {
    return activate(switcher, intent, current, options);
  }
  stopSelection(switcher);
  if (state.intent !== intent) { return; }
  const selected = { app, appName, key };
  state.selection = selected;
  return activate(switcher, intent, selected, options);
}

function constructSwitcher(this: ChildAppSwitcherInstance, options: ChildAppSwitcherOptions) {
  const state: State = {
    owner: options.owner, onCleanupError: options.onCleanupError ?? (() => {}), selection: null, intent: null, closed: false
  };
  states.set(this, state);
  // Mandatory ownership setup precedes initialize, and survives hook overrides.
  this.listenTo(options.owner, {
    'before:stop': () => invalidate(this),
    'stop': () => { if (!state.intent) { state.selection = null; } },
    'before:destroy': () => invalidate(this),
    'destroy': () => this.destroy(),
  });
  MnObject.call(this, options);
}

/** Selects a registered child Application; the owner retains lifecycle authority. */
export const ChildAppSwitcher = MnObject.extend({
  constructor: constructSwitcher,

  async switchTo(this: ChildAppSwitcherInstance, appName: string, selection: SwitchOptions = {}) {
    const state = stateFor(this);
    if (state.closed || state.owner.isDestroyed()) { return; }
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

  destroy(this: ChildAppSwitcherInstance, options?: unknown) {
    const state = stateFor(this);
    if (state.closed) { return this; }
    state.closed = true;
    state.intent = null;
    state.selection = null;
    return MnObject.prototype.destroy.call(this, options);
  },

  stop(this: ChildAppSwitcherInstance) {
    invalidate(this);
    stopSelection(this);
    return true;
  },

  getCurrent(this: ChildAppSwitcherInstance) {
    return stateFor(this).selection?.app ?? null;
  },
}) as unknown as MnObjectConstructor<Methods, [options: ChildAppSwitcherOptions]>;
