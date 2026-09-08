import { View, Application } from 'marionette';
export function createStateWorkspace(el, makeState, domain) {
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
  const Workspace = Application.extend({
    createState() {
      return makeState('app');
    }
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
