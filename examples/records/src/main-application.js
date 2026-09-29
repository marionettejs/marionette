import { Application } from 'marionette';
import { RecordsApplication } from './records-application.js';
import { ErrorView } from './records-views.js';
import { PageView } from './page.js';

export const MainApplication = Application.extend({
  childApps: { records: RecordsApplication },
  onStart() {
    const page = this.setView(new PageView({ el: this.getOption('el') }));
    this.listenTo(page, {
      'open:records': this.openRecords,
      'retry:records': this.restartRecords,
      'close:records': this.closeRecords,
    });
    this.openRecords();
  },
  openRecords() {
    const page = this.getView();
    return this.getChildApp('records').start({ region: page.getRegion('content') })
      .catch(error => this.showRecordsError(error))
      .catch(error => console.error('Could not recover records.', error));
  },
  restartRecords() {
    return this.getChildApp('records').restart()
      .catch(error => this.showRecordsError(error))
      .catch(error => console.error('Could not recover records.', error));
  },
  closeRecords() {
    return this.getChildApp('records').stop()
      .catch(error => console.error('Could not close records.', error));
  },
  async showRecordsError(error) {
    const page = this.getView();
    console.error('Could not open records.', error);
    await this.getChildApp('records').stop();
    if (!page.isDestroyed()) { this.getChildApp('records').showView(new ErrorView()); }
  }
});
