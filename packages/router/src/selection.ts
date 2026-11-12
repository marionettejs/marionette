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
type Selection = { app: Owner; appName: string; key: SelectionKey; activation?: { start: Promise<boolean>; result: Promise<boolean> } };
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

// Each preparation owns one shared outcome and cleanup, including later retries.
async function completeStart(owner: Owner, selection: Selection, start: Promise<boolean>) {
  try {return await start;} catch (error) {
    if (currentSelection(owner) !== selection || selection.activation?.start !== start) {return false;}
    cleanup(owner, selection);
    throw error;
  } finally {
    if (selection.activation?.start === start) {delete selection.activation;}
  }
}

function activate(owner: Owner, selection: Selection, options?: ApplicationStartOptions) {
  const start = selection.app.start(options);
  if (selection.activation?.start === start) {return selection.activation.result;}
  const result = completeStart(owner, selection, start);
  selection.activation = { start, result };
  return result;
}

// Release only the caller; shared preparation and its eventual error stay observed.
function callerResult(work: Promise<boolean>, signal?: AbortSignal): Promise<boolean> {
  if (!signal) {return work;}
  return new Promise((resolve, reject) => {
    const abort = () => {signal.removeEventListener('abort', abort); resolve(false);};
    signal.addEventListener('abort', abort, { once: true });
    work.then(value => {signal.removeEventListener('abort', abort); resolve(value);},
      error => {signal.removeEventListener('abort', abort); reject(error);});
    if (signal.aborted) {abort();}
  });
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

// Register before consumer event listeners. Method hooks still run before events.
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
    const started = await callerResult(activate(owner, chosen, selection.options), selection.signal);
    if (!started || currentSelection(owner) !== chosen || !canSelect(owner) || selection.signal?.aborted || !app.isRunning()) {return;}
    return app;
  } catch (error) {
    if (selection.signal?.aborted) {return;}
    throw error;
  }
}

export function clearSelection(owner: Owner) {
  if (!canSelect(owner)) {return;}
  stateFor(owner).intent = null;
  stopSelection(owner);
}

export function currentApp(owner: Owner) {
  return currentSelection(owner)?.app ?? null;
}
