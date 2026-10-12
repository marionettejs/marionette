import { defineConfig } from 'cypress';
export default defineConfig({
  video: false,
  screenshotsFolder: '../../tmp/test-package/cypress/screenshots',
  component: {
    devServer: { framework: 'vue', bundler: 'vite' },
    specPattern: 'cypress/component/**/*.cy.js',
    supportFile: 'cypress/support/component.js',
    indexHtmlFile: 'cypress/support/component-index.html'
  }
});
