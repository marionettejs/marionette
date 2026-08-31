import assert from 'node:assert/strict';
import { resolve } from 'node:path';
import { chromium, firefox, webkit } from '@playwright/test';

const browsers = { chromium, firefox, webkit };
const underscore = resolve(import.meta.dirname, '../../node_modules/underscore/underscore-umd.js');
const backbone = resolve(import.meta.dirname, '../../node_modules/backbone/backbone.js');
const marionette = resolve(import.meta.dirname, '../../dist/marionette.umd.js');
const failures = [];

for (const [browserName, browserType] of Object.entries(browsers)) {
  let browserInstance;

  try {
    browserInstance = await browserType.launch({ headless: true });
    const page = await browserInstance.newPage();
    await page.setContent('<!doctype html><main id="content"></main>');
    await page.addScriptTag({ path: underscore });
    await page.addScriptTag({ path: backbone });
    await page.addScriptTag({ path: marionette });

    const result = await page.evaluate(() => {
      Object.assign(Backbone.Model.prototype, Marionette.Events);
      Object.assign(Backbone.Collection.prototype, Marionette.Events);

      class SurvivorElement extends HTMLElement {
        connectedCallback() {
          this.connectedCount = (this.connectedCount || 0) + 1;
        }

        disconnectedCallback() {
          this.disconnectedCount = (this.disconnectedCount || 0) + 1;
        }
      }

      customElements.define('mn-survivor', SurvivorElement);

      const ChildView = Marionette.View.extend({
        tagName: 'mn-survivor',

        template() {
          return '<input value="survivor-state"><video muted preload="none"></video>';
        },

        onRender() {
          this.renderCount = (this.renderCount || 0) + 1;
          this.el.dataset.id = this.model.id;
        }
      });

      let attachCount = 0;
      const TestCollectionView = Marionette.CollectionView.extend({
        childView: ChildView,
        viewComparator: false,

        attachHtml() {
          attachCount += 1;
          return Marionette.CollectionView.prototype.attachHtml.apply(this, arguments);
        }
      });

      const collection = new Backbone.Collection(
        Array.from({ length: 1001 }, (value, id) => ({ id }))
      );
      const collectionView = new TestCollectionView({ collection });

      collectionView.render();
      document.querySelector('#content').append(collectionView.el);

      const removedView = collectionView.children.findByModel(collection.at(500));
      const focusedView = collectionView.children.findByModel(collection.at(501));
      const focusedInput = focusedView.el.querySelector('input');
      const media = focusedView.el.querySelector('video');
      const firstNode = collectionView.el.firstElementChild;
      const lastNode = collectionView.el.lastElementChild;
      const firstConnected = firstNode.connectedCount;
      const focusedConnected = focusedView.el.connectedCount;
      const lastConnected = lastNode.connectedCount;

      focusedInput.focus();
      focusedInput.setSelectionRange(2, 8);
      media.volume = 0.35;
      media.muted = true;
      media.playbackRate = 1.25;

      const mediaState = {
        currentTime: media.currentTime,
        muted: media.muted,
        playbackRate: media.playbackRate,
        volume: media.volume
      };

      attachCount = 0;
      collection.remove(removedView.model);

      const outcome = {
        attachCount,
        childCount: collectionView.el.children.length,
        firstNodePreserved: collectionView.el.firstElementChild === firstNode,
        lastNodePreserved: collectionView.el.lastElementChild === lastNode,
        focused: document.activeElement === focusedInput,
        selectionStart: focusedInput.selectionStart,
        selectionEnd: focusedInput.selectionEnd,
        mediaNodePreserved: focusedView.el.querySelector('video') === media,
        mediaConnected: media.isConnected,
        mediaState: {
          currentTime: media.currentTime,
          muted: media.muted,
          playbackRate: media.playbackRate,
          volume: media.volume
        },
        expectedMediaState: mediaState,
        firstConnected: firstNode.connectedCount,
        focusedConnected: focusedView.el.connectedCount,
        lastConnected: lastNode.connectedCount,
        firstDisconnected: firstNode.disconnectedCount || 0,
        focusedDisconnected: focusedView.el.disconnectedCount || 0,
        lastDisconnected: lastNode.disconnectedCount || 0,
        expectedFirstConnected: firstConnected,
        expectedFocusedConnected: focusedConnected,
        expectedLastConnected: lastConnected,
        focusedRenderCount: focusedView.renderCount,
        removedDestroyed: removedView.isDestroyed(),
        removedDisconnected: removedView.el.disconnectedCount || 0,
        ids: [...collectionView.el.children].map(element => Number(element.dataset.id))
      };

      collectionView.destroy();

      return outcome;
    });

    assert.equal(result.attachCount, 0, `${browserName}: survivors are not reattached`);
    assert.equal(result.childCount, 1000, `${browserName}: 1,000 survivors remain`);
    assert.equal(result.firstNodePreserved, true, `${browserName}: first node identity is preserved`);
    assert.equal(result.lastNodePreserved, true, `${browserName}: last node identity is preserved`);
    assert.equal(result.focused, true, `${browserName}: focus is preserved`);
    assert.equal(result.selectionStart, 2, `${browserName}: selection start is preserved`);
    assert.equal(result.selectionEnd, 8, `${browserName}: selection end is preserved`);
    assert.equal(result.mediaNodePreserved, true, `${browserName}: media node identity is preserved`);
    assert.equal(result.mediaConnected, true, `${browserName}: media remains connected`);
    assert.deepEqual(result.mediaState, result.expectedMediaState, `${browserName}: media state is preserved`);
    assert.equal(result.firstConnected, result.expectedFirstConnected, `${browserName}: first survivor is not reconnected`);
    assert.equal(result.focusedConnected, result.expectedFocusedConnected, `${browserName}: focused survivor is not reconnected`);
    assert.equal(result.lastConnected, result.expectedLastConnected, `${browserName}: last survivor is not reconnected`);
    assert.equal(result.firstDisconnected, 0, `${browserName}: first survivor is not disconnected`);
    assert.equal(result.focusedDisconnected, 0, `${browserName}: focused survivor is not disconnected`);
    assert.equal(result.lastDisconnected, 0, `${browserName}: last survivor is not disconnected`);
    assert.equal(result.focusedRenderCount, 1, `${browserName}: focused survivor renders once`);
    assert.equal(result.removedDestroyed, true, `${browserName}: removed child is destroyed`);
    assert.equal(result.removedDisconnected, 1, `${browserName}: removed child disconnects once`);
    assert.deepEqual(
      result.ids,
      Array.from({ length: 1001 }, (value, id) => id).filter(id => id !== 500),
      `${browserName}: DOM order follows collection order`
    );

    console.log(`${browserName}: removal-only survivor state passed`);
  } catch (error) {
    failures.push(new Error(`${browserName}: ${error.message}`, { cause: error }));
  } finally {
    await browserInstance?.close();
  }
}

if (failures.length) {
  throw new AggregateError(failures, 'Removal-only survivor state failed.');
}
