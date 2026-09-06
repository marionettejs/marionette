import { Events } from 'marionette';
import type { TriggerMethod } from './events.ts';

export { Model } from './model.ts';
export { Collection } from './collection.ts';
export { DataApi, StateApi } from './api.ts';
export const triggerMethod: TriggerMethod = Events.triggerMethod;

export type { EventCallback, EventSource } from './events.ts';
export type { ModelAttributes, MutationOptions } from './model.ts';
export type { ModelInput, CollectionOptions, CollectionChange } from './collection.ts';
