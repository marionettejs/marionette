import { Application } from 'marionette';
import { RecordsApplication } from './records-application.js';
import { ErrorView } from './records-views.js';
import { PageView } from './page.js';

export const MainApplication = Application.extend({
  childApps: { records: RecordsApplication },
  viewEvents: {
    'open:records': 'openRecords',
    'retry:records': 'restartRecords',
    'reload:records': 'restartRecords',
    'close:records': 'closeRecords'
  },
  onStart() {
    if (this.getView()) { return; }
    this.setView(new PageView({ el: this.getOption('el') }));
    this.openRecords();
  },
  openRecords() {
    return this.getChildApp('records').start({ region: this.getView().getRegion('content') })
      .catch(error => this.showRecordsError(error));
  },
  restartRecords() {
    return this.getChildApp('records').restart()
      .catch(error => this.showRecordsError(error));
  },
  closeRecords() {
    return this.getChildApp('records').stop();
  },
  showRecordsError(error) {
    console.error('Could not load records.', error);
    const records = this.getChildApp('records');
    if (records.isRunning()) {
      records.getState().set({ loading: false, error: error.message });
    } else {
      records.stop();
      records.showView(new ErrorView());
    }
  }
});
