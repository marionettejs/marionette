import { Events } from 'marionette';

export { default as Model } from './model.js';
export { default as Collection } from './collection.js';
export { DataApi, StateApi } from './api.js';
export const triggerMethod = Events.triggerMethod;
