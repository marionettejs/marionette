import './setup.js';
import './styles.css';
import { MainApplication } from './main-application.js';

export const application = new MainApplication({ el: document.getElementById('app') });
application.start().catch(console.error);
