import { View, Application } from 'marionette';
export function createStateWorkspace(el, sharedState, domain) {
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
  const Workspace = Application.extend({});
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
