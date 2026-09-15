import { View, Application } from 'marionette';
export function createStateWorkspace(el, sharedState, domain, lifecycle) {
  const stateApi = {
    disposeOwned(source) {
      source.dispose();
    }
  };
  const EditorView = View.extend({
    template: false
  });
  EditorView.setStateApi(stateApi);
  let view;
  const Editor = Application.extend({
    onStart() {
      view = new EditorView({
        model: domain,
        state: sharedState
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
    async onBeforeStart(application, options, context) {
      await lifecycle.ready(context.signal);
      if (context.signal.aborted) { return; }
      const started = await this.getChildApp('editor')?.start();
      if (!started && !context.signal.aborted) { throw new Error('Editor startup canceled'); }
    },
    onStart() {
      unsubscribe = lifecycle.subscribe();
    },
    onStop: releaseSession,
    onDestroy: releaseSession
  });
  Workspace.setStateApi(stateApi);
  const app = new Workspace({
    state: sharedState
  });
  const child = new Editor({
    region: {
      el
    },
    state: sharedState
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
