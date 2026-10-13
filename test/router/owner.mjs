// Executable design sketch using real Marionette public APIs, not a replacement
// for a production feature. Dependencies stand in for the existing entities-service calls.
export function createPatientOwner({ Application, View }, { loadPatient, loadInteractions }) {
  const Shell = View.extend({
    template: () => '<aside>Patient sidebar</aside><main class="content"></main>',
    regions: { content: '.content' },
  });
  const FeedView = View.extend({
    template: () => '<p role="status">Loading interactions</p>',
  });
  const WorkflowView = View.extend({ template: () => '<p>Workflow</p>' });
  const Feed = Application.extend({
    viewEvents: { 'before:destroy': 'onHostLost' },
    onHostLost() { this.stop(); },
    onBeforeStart() {
      if (!this.getView()) {this.showView(new FeedView());}
    },
    prepareStart(options, { signal }) { return loadInteractions(options, { signal }); },
    onStart(_app, _options, rows) {
      this.getView().el.textContent = rows.join(',');
    },
    handleRequestFailure() {
      // Expected data failure keeps the feature-owned shell available for Retry.
      // This sketch does not promise recovery from rendering/teardown failures.
      this.getView().el.textContent = 'Retry interactions';
      return false;
    },
  });
  const Workflow = Application.extend({
    onStart() { this.showView(new WorkflowView()); },
  });
  const Patient = Application.extend({
    childApps: { feed: Feed, workflow: Workflow },
    viewEvents: { 'before:destroy': 'onHostLost' },
    onHostLost() { this.stop(); },
    prepareStart({ patientId }, { signal }) { return loadPatient(patientId, { signal }); },
    onStart(_app, _options, patient) {
      this.patient = patient;
      if (!this.getView()) {this.showView(new Shell());}
    },
    onStop() { this.page = undefined; },
    showRoute(context) {
      const { name, params } = context.match;
      const page = name.startsWith('patient:interaction') ? 'feed' : 'workflow';
      const child = this.getChildApp(page);
      const retained = this.page === page;
      if (!retained && this.page) {this.getChildApp(this.page).stop();}
      this.page = page;
      const options = { region: this.getView().getRegion('content'), patientId: params.patientId, interactionId: params.interactionId };
      const task = retained && (page === 'feed' || context.kind === 'refresh') ?
        child.restart(options) : child.start(options);
      return page === 'feed' ? task.catch(error => {
        if (error?.kind !== 'data') {throw error;}
        return child.handleRequestFailure(error);
      }) : task;
    },
  });
  return Application.extend({
    childApps: { patient: Patient },
    initialize({ hostRegion }) {
      // Bind host lifetime before any preparation: no View may exist yet.
      // The host owns this coordinator's lifetime; the Region remains borrowed.
      this.listenTo(hostRegion, 'before:destroy', () => this.destroy());
    },
    onStop() { this.scope = undefined; },
    async accept(context, region) {
      if (!this.isRunning() || !context.isCurrent()) {return;}
      const patient = this.getChildApp('patient');
      if (!context.match?.name.startsWith('patient:')) {
        patient.stop();
        this.scope = undefined;
        return;
      }
      const { workspace, patientId } = context.match.params;
      const scope = JSON.stringify([workspace, patientId]);
      if (scope !== this.scope) {
        patient.stop();
        this.scope = scope;
      }
      // Do NOT bind context.signal to patient.stop. Same-resource routes share
      // the first preparation; the newest waiter dispatches the latest detail.
      const started = await patient.start({ region, patientId });
      if (!started || !this.isRunning() || !patient.isRunning() || !context.isCurrent()) {return;}
      return patient.showRoute(context);
    },
  });
}
