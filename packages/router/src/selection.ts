import type { ApplicationInstance, ApplicationStartOptions } from 'marionette';
import { equalKeys, snapshotKey } from './selection-key.ts';

type Primitive = string | number | boolean | null | undefined;
export type SelectionKey = Primitive | Readonly<Record<string, Primitive>>;
export interface SwitchOptions {
  key?: SelectionKey;
  restart?: boolean;
  options?: ApplicationStartOptions;
  signal?: AbortSignal;
}
type Owner = ApplicationInstance<object, unknown>;
type Selection = { app: Owner; appName: string; key: SelectionKey; failed?: boolean };
type State = { selection: Selection | null; intent: object | null; stopping: boolean };
const states = new WeakMap<Owner, State>();
const stateFor = (owner: Owner) => states.get(owner)!;

function currentSelection(owner: Owner) {
  const state = stateFor(owner);
  const selection = state.selection;
  if (selection && owner.getChildApp(selection.appName) !== selection.app) {state.selection = null;}
  return state.selection;
}

function canSelect(owner: Owner) {
  return owner.isRunning() && !stateFor(owner).stopping;
}

function stopSelection(owner: Owner) {
  const state = stateFor(owner);
  const selection = currentSelection(owner);
  if (!selection) {return;}
  const intent = state.intent;
  selection.app.stop();
  if (state.intent === intent && state.selection === selection) {state.selection = null;}
}

function cleanup(owner: Owner, selection: Selection) {
  try {stopSelection(owner);} catch (error) {
    const report = owner.getOption('onCleanupError') as ((error: unknown, app: Owner) => void) | undefined;
    report?.call(owner, error, selection.app);
  }
}

// Same-key callers join one selection; failed preparation is cleaned up once.
async function activate(owner: Owner, selection: Selection, options?: ApplicationStartOptions) {
  try {return await selection.app.start(options);} catch (error) {
    if (!selection.failed) {
      if (currentSelection(owner) !== selection) {return false;}
      selection.failed = true;
      cleanup(owner, selection);
    }
    throw error;
  }
}

function choose(owner: Owner, intent: object, app: Owner, appName: string, key: SelectionKey, restart?: boolean) {
  const state = stateFor(owner);
  const current = currentSelection(owner);
  if (!restart && current?.app === app && equalKeys(current.key, key)) {return current;}
  stopSelection(owner);
  if (state.intent !== intent) {return;}
  state.selection = { app, appName, key };
  return state.selection;
}

// Install mandatory invalidation before Application invokes consumer hooks.
export function initSelection(owner: Owner) {
  const state: State = { selection: null, intent: null, stopping: false };
  states.set(owner, state);
  const invalidate = () => {state.stopping = true; state.intent = null; state.selection = null;};
  owner.on({
    'before:stop': invalidate,
    'stop': () => {state.stopping = false;},
    'before:destroy': invalidate,
  });
}

export async function switchTo(owner: Owner, appName: string, selection: SwitchOptions = {}) {
  const state = stateFor(owner);
  if (!canSelect(owner) || selection.signal?.aborted) {return;}
  const app = owner.getChildApp(appName);
  if (!app) {throw new Error(`Child application "${ appName }" is not registered`);}
  const key = snapshotKey(selection.key);
  const intent = {};
  state.intent = intent;
  const chosen = choose(owner, intent, app, appName, key, selection.restart);
  if (!chosen) {return;}
  try {
    const started = await activate(owner, chosen, selection.options);
    if (!started || currentSelection(owner) !== chosen || !canSelect(owner) || selection.signal?.aborted || !app.isRunning()) {return;}
    return app;
  } catch (error) {
    if (selection.signal?.aborted) {return;}
    throw error;
  }
}

export function clearSelection(owner: Owner) {
  if (!canSelect(owner)) {return true;}
  stateFor(owner).intent = null;
  stopSelection(owner);
  return true;
}

export function currentApp(owner: Owner) {
  return currentSelection(owner)?.app ?? null;
}
