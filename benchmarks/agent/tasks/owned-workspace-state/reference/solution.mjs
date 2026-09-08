import { View, Application } from 'marionette';
export function createStateWorkspace(el, makeState, domain, lifecycle) {
  const stateApi = {
    disposeOwned(source) {
      source.dispose();
    }
  };
  const EditorView = View.extend({
    template: false,
    createState() {
      return makeState('view');
    }
  });
  EditorView.setStateApi(stateApi);
  let view;
  const Editor = Application.extend({
    createState() {
      return makeState('child');
    },
    onStart() {
      view = new EditorView({
        model: domain
      });
      view.getState();
      this.showView(view);
    }
  });
  Editor.setStateApi(stateApi);
  let unsubscribe;
  const releaseSession = () => {
    if (unsubscribe) {
      const release = unsubscribe;
      unsubscribe = undefined;
      release();
    }
  };
  const Workspace = Application.extend({
    createState() { return makeState('app'); },
    onBeforeStart(application, options, context) {
      return lifecycle.ready(context.signal);
    },
    onStart() {
      unsubscribe = lifecycle.subscribe();
    },
    onStop: releaseSession,
    onDestroy: releaseSession
  });
  Workspace.setStateApi(stateApi);
  const app = new Workspace();
  const child = new Editor({
    region: {
      el
    }
  });
  app.addChildApp('editor', child);
  app.getState();
  child.getState();
  return {
    app,
    child,
    get view() {
      return view;
    }
  };
}
