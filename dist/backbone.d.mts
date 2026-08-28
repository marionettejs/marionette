import Backbone from 'backbone';

declare module 'backbone' {
  interface Model<T extends ObjectHash = any, S = ModelSetOptions, E = any> {
    triggerMethod(event: string, ...args: unknown[]): unknown;
  }

  interface Collection<TModel extends Model = Model> {
    triggerMethod(event: string, ...args: unknown[]): unknown;
  }

  interface View<TModel extends Model | undefined = Model, TElement extends Element = HTMLElement> {
    triggerMethod(event: string, ...args: unknown[]): unknown;
  }

  interface Router {
    triggerMethod(event: string, ...args: unknown[]): unknown;
  }
}

export default Backbone;
