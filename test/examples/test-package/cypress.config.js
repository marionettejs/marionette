import { defineConfig } from 'cypress';
import { devServer } from '@cypress/vite-dev-server';
export default defineConfig({
  video: false,
  screenshotsFolder: '../../tmp/test-package/cypress/screenshots',
  component: {
    // Use Cypress's public custom-server API without a UI-framework preset.
    devServer(config) { return devServer({ ...config, viteConfig: {} }); },
    specPattern: 'cypress/component/**/*.cy.js',
    supportFile: 'cypress/support/component.js',
    indexHtmlFile: 'cypress/support/component-index.html'
  }
});
