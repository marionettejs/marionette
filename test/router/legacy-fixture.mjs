// Portable test host using only public Backbone/Radio APIs. No application source.
export function createLegacyRoutes(Backbone, channel) {
  const host = new Backbone.Router();
  let inbound = false;
  const fromURL = (event, ...args) => {
    inbound = true;
    try { channel.trigger(event, ...args); } finally { inbound = false; }
  };
  host.route('alpha/schedule', 'schedule', () => fromURL('schedule'));
  host.route('alpha/worklist/:id', 'worklist', id => fromURL('worklist', id));
  const schedule = () => { if (!inbound) { Backbone.history.navigate('alpha/schedule', { trigger: false }); } };
  const worklist = id => { if (!inbound) { Backbone.history.navigate(`alpha/worklist/${id}`, { trigger: false }); } };
  channel.on('schedule', schedule);
  channel.on('worklist', worklist);
  return { destroy() { channel.off('schedule', schedule); channel.off('worklist', worklist); } };
}

export function createProductHistory(Backbone, window) {
  const events = Object.assign({}, Backbone.Events);
  const entries = [Backbone.history.getFragment()];
  const navigate = Backbone.history.navigate;
  Backbone.history.navigate = function(fragment, options = {}) {
    const result = navigate.call(this, fragment, options);
    if (result === false) { return result; }
    if (options.replace) { entries[entries.length - 1] = fragment; } else { entries.push(fragment); }
    events.trigger('change:route', fragment);
    return result;
  };
  const observe = () => events.trigger('change:route', Backbone.history.getFragment());
  window.addEventListener('popstate', observe);
  return {
    events,
    goBack(empty) {
      if (entries.length < 2) { empty(); return; }
      entries.pop();
      Backbone.history.navigate(entries.pop(), { trigger: true });
    },
    destroy() { window.removeEventListener('popstate', observe); events.off(); },
  };
}
