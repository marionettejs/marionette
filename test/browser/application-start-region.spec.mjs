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

test('a borrowed shell survives canceled loading and controller restart', async({ page }) => {
  const result = await page.evaluate(async() => {
    const { Application, Region, View } = await import('marionette');
    const host = new Region({ el: '#content' });
    const shell = new (View.extend({
      template: () => '<input aria-label="Persistent draft"><main></main>',
      regions: { content: 'main' }
    }))();
    host.show(shell);
    const input = shell.el.querySelector('input');
    input.value = 'Keep this draft';
    const pending = Promise.withResolvers();
    const Screen = Application.extend({
      onBeforeStart() { this.showView(new View({ template: () => 'Loading' })); },
      prepareStart({ ready }) { return ready; },
      onStart(app, options, label) {
        this.showView(new View({ template: () => label }));
      }
    });
    const coordinator = new (Application.extend({
      initialize() {
        this.addChildApp('a', new Screen());
        this.addChildApp('b', new Screen());
      },
      async prepareStart({ screen, ready }, { signal }) {
        const started = await this.getChildApp(screen).start({
          region: this.options.layout.getRegion('content'), ready
        });
        if (!started && !signal.aborted) { throw new Error('Required screen canceled'); }
      }
    }))({ layout: shell });
    const firstA = coordinator.getChildApp('a');
    const first = coordinator.start({ screen: 'a', ready: pending.promise });
    const loading = firstA.getView();
    const replacement = coordinator.restart({ screen: 'b', ready: Promise.resolve('Screen B') });
    const firstCompleted = await first;
    const replacementCompleted = await replacement;
    pending.resolve('Obsolete A');
    await pending.promise;
    const afterB = shell.getRegion('content').currentView.el.textContent;
    const restarted = await coordinator.restart({ screen: 'a', ready: Promise.resolve('Screen A again') });
    const afterA = shell.getRegion('content').currentView.el.textContent;
    const reusedChild = coordinator.getChildApp('a') === firstA;
    await coordinator.destroy();
    const snapshot = {
      firstCompleted, replacementCompleted, restarted, afterB, afterA,
      loadingDestroyed: loading.isDestroyed(),
      reusedChild,
      childDestroyed: firstA.isDestroyed(),
      shellAlive: !shell.isDestroyed() && shell.el.isConnected,
      sameInput: shell.el.querySelector('input') === input,
      draft: input.value,
      screenEmpty: shell.getRegion('content').currentView === undefined,
      hostAlive: !host.isDestroyed()
    };
    host.destroy();
    return snapshot;
  });
  assert.deepEqual(result, {
    firstCompleted: false, replacementCompleted: true, restarted: true,
    afterB: 'Screen B', afterA: 'Screen A again', loadingDestroyed: true,
    reusedChild: true, childDestroyed: true, shellAlive: true, sameInput: true,
    draft: 'Keep this draft', screenEmpty: true, hostAlive: true
  });
});
