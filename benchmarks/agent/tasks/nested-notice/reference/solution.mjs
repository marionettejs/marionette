import { View } from 'marionette';
export function createNoticeShell(el, onNavigate) {
  const Root = View.extend({
    template: () => '<nav></nav><aside></aside>',
    regions: {
      navigation: 'nav',
      notice: 'aside'
    }
  });
  const Navigation = View.extend({
    template: () => '<button>Home</button>',
    events: {
      'click button'() {
        onNavigate('home');
      }
    }
  });
  const view = new Root({
    el
  }).render();
  view.showChildView('navigation', new Navigation());
  return {
    view,
    notify(text) {
      const notice = new View({
        template: false
      });
      notice.el.textContent = text;
      view.showChildView('notice', notice);
      return notice;
    },
    destroy() {
      view.destroy();
    }
  };
}
