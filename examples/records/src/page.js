import { View } from 'marionette';

export const PageView = View.extend({
  template: false,
  regions: { content: '.js-content' },
  triggers: {
    'click .js-open': 'open:records',
    'click .js-close': 'close:records'
  },
  childViewTriggers: { retry: 'retry:records' }
});
