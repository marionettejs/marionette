import { View } from 'marionette';

export function createWidgetView(mountWidget) {
  let widget;

  const WidgetView = View.extend({
    template: () => '<div class="widget-host"></div>',

    onDomRefresh() {
      widget = mountWidget(this.el.querySelector('.widget-host'));
    },

    onDomRemove() {
      const activeWidget = widget;
      widget = undefined;
      activeWidget?.destroy();
    },
  });

  return new WidgetView();
}
