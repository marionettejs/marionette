/* global beforeEach, afterEach, Cypress, cy */
import { defineComponent, h, onMounted, ref } from 'vue';
import { mount } from '@cypress/vue';
import { mountView } from '@mnjs/test';

let mounted;
beforeEach(async() => { await mounted?.cleanup(); mounted = undefined; });
afterEach(async() => { await mounted?.cleanup(); mounted = undefined; });

// Cypress's supported Vue/Vite harness owns the shell; Marionette owns its children.
Cypress.Commands.add('mountMarionette', createView => {
  const Shell = defineComponent({
    setup() {
      const host = ref();
      onMounted(() => { mounted = mountView(createView(), { container: host.value }); });
      return () => h('div', { ref: host });
    }
  });
  return cy.then(async() => {
    await mounted?.cleanup();
    mounted = undefined;
  }).then(() => mount(Shell)).then(() => mounted);
});
