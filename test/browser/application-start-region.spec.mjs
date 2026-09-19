import assert from 'node:assert/strict';
import { test } from './fixtures.mjs';

test('registered child follows a recreated parent layout Region across restart', async({ page }) => {
  const result = await page.evaluate(async() => {
    const { Application, View } = await import('marionette');
    const ChildScreen = View.extend({ template: () => '<p data-child-screen>Child screen</p>' });
    const Layout = View.extend({
      template: () => '<section data-layout><div data-child-slot></div></section>',
      regions: { child: '[data-child-slot]' }
    });
    const child = new (Application.extend({
      onStart() { this.showView(new ChildScreen()); }
    }))();
    let layout;
    let childRegion;
    const parent = new (Application.extend({
      region: '#content',
      onBeforeStart() {
        layout = new Layout();
        this.showView(layout);
        childRegion = layout.getRegion('child');
      },
      prepareStart() {
        return child.start({ region: childRegion, source: 'parent-layout' });
      }
    }))();
    parent.addChildApp('child', child);

    await parent.start();
    const firstLayout = layout;
    const firstRegion = childRegion;
    const firstScreen = child.getView();
    const firstSnapshot = {
      childRunning: child.isRunning(),
      parentRunning: parent.isRunning(),
      regionIsNested: firstRegion === firstLayout.getRegion('child'),
      screenVisible: firstScreen.el.isConnected,
      screenText: firstScreen.el.textContent
    };

    await parent.restart();
    const secondLayout = layout;
    const secondRegion = childRegion;
    const secondScreen = child.getView();
    const secondSnapshot = {
      sameChild: child === parent.getChildApp('child'),
      newLayout: secondLayout !== firstLayout,
      newRegion: secondRegion !== firstRegion,
      regionIsNested: secondRegion === secondLayout.getRegion('child'),
      firstLayoutDestroyed: firstLayout.isDestroyed(),
      firstScreenDestroyed: firstScreen.isDestroyed(),
      childRunning: child.isRunning(),
      screenVisible: secondScreen.el.isConnected,
      screenText: secondScreen.el.textContent
    };

    await parent.destroy();
    return {
      firstSnapshot,
      secondSnapshot,
      cleanup: {
        parentDestroyed: parent.isDestroyed(),
        childDestroyed: child.isDestroyed(),
        secondLayoutDestroyed: secondLayout.isDestroyed(),
        hostEmpty: document.querySelector('#content').childElementCount === 0
      }
    };
  });

  assert.deepEqual(result.firstSnapshot, {
    childRunning: true,
    parentRunning: true,
    regionIsNested: true,
    screenVisible: true,
    screenText: 'Child screen'
  });
  assert.deepEqual(result.secondSnapshot, {
    sameChild: true,
    newLayout: true,
    newRegion: true,
    regionIsNested: true,
    firstLayoutDestroyed: true,
    firstScreenDestroyed: true,
    childRunning: true,
    screenVisible: true,
    screenText: 'Child screen'
  });
  assert.deepEqual(result.cleanup, {
    parentDestroyed: true,
    childDestroyed: true,
    secondLayoutDestroyed: true,
    hostEmpty: true
  });
});
