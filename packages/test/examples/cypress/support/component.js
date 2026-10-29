/* global Cypress, afterEach */
import { mount, mountApplication, setupCypress } from '@mnjs/test/cypress';
import { checkMountCleanup } from './cleanup-checks.js';

setupCypress();
Cypress.Commands.add('mount', mount);
Cypress.Commands.add('mountApplication', mountApplication);
afterEach(checkMountCleanup);
