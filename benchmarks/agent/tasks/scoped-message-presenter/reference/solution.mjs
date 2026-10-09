import { MnObject } from 'marionette';
export function createPresenter(source, deliver) {
  const Presenter = MnObject.extend({
    initialize() { this.listenTo(source, 'message', deliver); }
  });
  return new Presenter();
}
