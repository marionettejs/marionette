/* global Cypress */
import { mount, mountApplication, setupCypress } from '@mnjs/test/cypress';

setupCypress();
Cypress.Commands.add('mount', mount);
Cypress.Commands.add('mountApplication', mountApplication);
