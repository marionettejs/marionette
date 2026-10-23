import { Application } from 'marionette';
import type { ApplicationInstance, ApplicationStartOptions, ApplicationOptions, ApplicationConstructor } from 'marionette';
import { isEqual } from './is-equal.ts';

export type SelectionKey = string | number | boolean | null | undefined | SelectionKey[] | { [name: string]: SelectionKey };
export interface ChildAppSwitcherOptions extends ApplicationOptions {
  onCleanupError?: (this: ChildAppSwitcherInstance, error: unknown, app: ApplicationInstance<object, unknown>) => void;
}
export interface SwitchOptions {
  key?: SelectionKey;
  reconstruct?: boolean;
  options?: ApplicationStartOptions;
  signal?: AbortSignal;
}
interface Methods {
  switchTo(appName: string, selection?: SwitchOptions): Promise<ApplicationInstance<object, unknown> | undefined>;
  clear(): boolean;
  getCurrent(): ApplicationInstance<object, unknown> | null;
}
export type ChildAppSwitcherInstance = ApplicationInstance<ChildAppSwitcherOptions, unknown> & Methods;
type Selection = { app: ApplicationInstance<object, unknown>; appName: string; key: SelectionKey };
type State = {
  selection: Selection | null;
  intent: object | null;
  stopping: boolean;
};
const states = new WeakMap<ChildAppSwitcherInstance, State>();
const stateFor = (switcher: ChildAppSwitcherInstance) => states.get(switcher)!;

function currentSelection(switcher: ChildAppSwitcherInstance) {
  const state = stateFor(switcher);
  const selection = state.selection;
  if (selection && switcher.getChildApp(selection.appName) !== selection.app) {
    state.selection = null;
  }
  return state.selection;
}

function canSelect(switcher: ChildAppSwitcherInstance) {
  return switcher.isRunning() && !stateFor(switcher).stopping;
}

function stopSelection(switcher: ChildAppSwitcherInstance) {
  const state = stateFor(switcher);
  const selection = currentSelection(switcher);
  if (!selection) { return; }
  selection.app.stop();
  if (state.selection === selection) { state.selection = null; }
}

function cleanup(switcher: ChildAppSwitcherInstance, selection: Selection) {
  try {
    stopSelection(switcher);
  } catch (error) {
    const report = switcher.getOption('onCleanupError') as ChildAppSwitcherOptions['onCleanupError'];
    report?.call(switcher, error, selection.app);
  }
}

async function activate(switcher: ChildAppSwitcherInstance, intent: object, selection: Selection, options?: ApplicationStartOptions) {
  const state = stateFor(switcher);
  const { app } = selection;
  try {
    const started = await app.start(options);
    if (state.intent !== intent || currentSelection(switcher) !== selection) { return; }
    if (started) { return app; }
    // False means the requested start lost authority. A stopped child may
    // already be preparing its own replacement: do not cancel that operation.
    // Keep the selection so the next switcher operation can still stop it.
  } catch (error) {
    if (state.intent !== intent || currentSelection(switcher) !== selection) { return; }
    cleanup(switcher, selection);
    throw error;
  }
}

async function select(switcher: ChildAppSwitcherInstance, intent: object, app: ApplicationInstance<object, unknown>,
  appName: string, { key, reconstruct = false, options }: SwitchOptions) {
  const state = stateFor(switcher);
  const current = currentSelection(switcher);
  if (!reconstruct && current?.app === app && isEqual(current.key, key)) {
    return activate(switcher, intent, current, options);
  }
  stopSelection(switcher);
  if (state.intent !== intent) { return; }
  const selected = { app, appName, key };
  state.selection = selected;
  return activate(switcher, intent, selected, options);
}

// Owns one selectable group of child Applications.
function constructSwitcher(this: ChildAppSwitcherInstance, options: ChildAppSwitcherOptions = {}) {
  const state: State = {
    selection: null, intent: null, stopping: false
  };
  states.set(this, state);
  // Application's stop guard already blocks descendant activation when these
  // mandatory listeners invalidate selection, even if user hooks reenter.
  const invalidate = () => {
    state.stopping = true;
    state.intent = null;
    state.selection = null;
  };
  this.on({
    'before:stop': invalidate,
    'stop': () => { state.stopping = false; },
    'before:destroy': invalidate,
  });
  Application.call(this, options);
}
export const ChildAppSwitcher = Application.extend({
  constructor: constructSwitcher,

  async switchTo(this: ChildAppSwitcherInstance, appName: string, selection: SwitchOptions = {}) {
    const state = stateFor(this);
    if (!canSelect(this) || selection.signal?.aborted) { return; }
    const app = this.getChildApp(appName);
    if (!app) { throw new Error(`Child application "${ appName }" is not registered`); }
    const intent = {};
    state.intent = intent;
    try {
      const selected = await select(this, intent, app, appName, selection);
      return selection.signal?.aborted ? undefined : selected;
    } catch (error) {
      if (state.intent !== intent || selection.signal?.aborted) { return; }
      throw error;
    }
  },

  clear(this: ChildAppSwitcherInstance) {
    if (!canSelect(this)) { return true; }
    stateFor(this).intent = null;
    stopSelection(this);
    return true;
  },

  getCurrent(this: ChildAppSwitcherInstance) {
    return currentSelection(this)?.app ?? null;
  },
}) as unknown as ApplicationConstructor<Methods, [options?: ChildAppSwitcherOptions]>;
