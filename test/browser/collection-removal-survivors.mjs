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

    const results = await page.evaluate(() => {
      Object.assign(Backbone.Model.prototype, Marionette.Events);
      Object.assign(Backbone.Collection.prototype, Marionette.Events);
      // Install only the operations this DOM regression exercises. The complete
      // Backbone adapter contract and rollback behavior have focused unit coverage.
      Marionette.setDataApi({
        key: model => model.cid,
        serialize: model => model.attributes,
        items: collection => collection.models,
        observeCollection(collection, callback, context) {
          const onUpdate = (currentCollection, { changes }) => callback.call(context, {
            kind: 'update',
            added: changes.added,
            removed: changes.removed,
            updated: changes.merged.map(model => ({ previous: model, current: model }))
          });
          const onSort = () => callback.call(context, { kind: 'reorder' });
          collection.on({ update: onUpdate, sort: onSort }, context);
          return () => {
            collection.off({ update: onUpdate, sort: onSort }, context);
          };
        }
      });

      class SurvivorElement extends HTMLElement {
        connectedCallback() {
          this.connectedCount = (this.connectedCount || 0) + 1;
        }

        disconnectedCallback() {
          this.disconnectedCount = (this.disconnectedCount || 0) + 1;
        }

        connectedMoveCallback() {
          this.movedCount = (this.movedCount || 0) + 1;
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

      return [
        { name: 'unsorted', viewOptions: { viewComparator: false } },
        { name: 'default collection order', viewOptions: {} }
      ].map(({ name, viewOptions }) => {
        let attachCount = 0;
        const TestCollectionView = Marionette.CollectionView.extend({
          childView: ChildView,
          ...viewOptions,

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

        const nodes = [...collectionView.el.children];
        collection.models.reverse();
        collection.trigger('sort', collection);
        Object.assign(outcome, {
          reordered: true,
          nativeStatePreservingMove: typeof collectionView.container.moveBefore === 'function',
          reorderFocused: document.activeElement === focusedInput,
          reorderSelectionStart: focusedInput.selectionStart,
          reorderSelectionEnd: focusedInput.selectionEnd,
          reorderMediaNodePreserved: focusedView.el.querySelector('video') === media,
          reorderFirstConnected: firstNode.connectedCount,
          reorderFocusedConnected: focusedView.el.connectedCount,
          reorderLastConnected: lastNode.connectedCount,
          reorderFirstDisconnected: firstNode.disconnectedCount || 0,
          reorderFocusedDisconnected: focusedView.el.disconnectedCount || 0,
          reorderLastDisconnected: lastNode.disconnectedCount || 0,
          reorderMoveCount: (firstNode.movedCount || 0) +
            (focusedView.el.movedCount || 0) + (lastNode.movedCount || 0),
          reorderRenderCount: focusedView.renderCount,
          reorderNodesReversed: [...collectionView.el.children]
            .every((element, index) => element === nodes[nodes.length - index - 1])
        });

        collectionView.destroy();

        return { name, outcome };
      });
    });

    for (const { name, outcome: result } of results) {
      const scenario = `${browserName} (${name})`;
      assert.equal(result.attachCount, 0, `${scenario}: survivors are not reattached`);
      assert.equal(result.childCount, 1000, `${scenario}: 1,000 survivors remain`);
      assert.equal(result.firstNodePreserved, true, `${scenario}: first node identity is preserved`);
      assert.equal(result.lastNodePreserved, true, `${scenario}: last node identity is preserved`);
      assert.equal(result.focused, true, `${scenario}: focus is preserved`);
      assert.equal(result.selectionStart, 2, `${scenario}: selection start is preserved`);
      assert.equal(result.selectionEnd, 8, `${scenario}: selection end is preserved`);
      assert.equal(result.mediaNodePreserved, true, `${scenario}: media node identity is preserved`);
      assert.equal(result.mediaConnected, true, `${scenario}: media remains connected`);
      assert.deepEqual(result.mediaState, result.expectedMediaState, `${scenario}: media state is preserved`);
      assert.equal(result.firstConnected, result.expectedFirstConnected, `${scenario}: first survivor is not reconnected`);
      assert.equal(result.focusedConnected, result.expectedFocusedConnected, `${scenario}: focused survivor is not reconnected`);
      assert.equal(result.lastConnected, result.expectedLastConnected, `${scenario}: last survivor is not reconnected`);
      assert.equal(result.firstDisconnected, 0, `${scenario}: first survivor is not disconnected`);
      assert.equal(result.focusedDisconnected, 0, `${scenario}: focused survivor is not disconnected`);
      assert.equal(result.lastDisconnected, 0, `${scenario}: last survivor is not disconnected`);
      assert.equal(result.focusedRenderCount, 1, `${scenario}: focused survivor renders once`);
      assert.equal(result.removedDestroyed, true, `${scenario}: removed child is destroyed`);
      assert.equal(result.removedDisconnected, 1, `${scenario}: removed child disconnects once`);
      assert.deepEqual(
        result.ids,
        Array.from({ length: 1001 }, (value, id) => id).filter(id => id !== 500),
        `${scenario}: DOM order follows collection order`
      );

      if (result.reordered) {
        assert.equal(result.reorderFocused, true, `${scenario}: reorder preserves focus`);
        assert.equal(result.reorderSelectionStart, 2, `${scenario}: reorder preserves selection start`);
        assert.equal(result.reorderSelectionEnd, 8, `${scenario}: reorder preserves selection end`);
        assert.equal(result.reorderMediaNodePreserved, true, `${scenario}: reorder preserves media node`);
        if (result.nativeStatePreservingMove) {
          assert.equal(result.reorderFirstConnected, result.expectedFirstConnected, `${scenario}: native move does not reconnect first survivor`);
          assert.equal(result.reorderFocusedConnected, result.expectedFocusedConnected, `${scenario}: native move does not reconnect focused survivor`);
          assert.equal(result.reorderLastConnected, result.expectedLastConnected, `${scenario}: native move does not reconnect last survivor`);
          assert.equal(result.reorderFirstDisconnected, 0, `${scenario}: native move does not disconnect first survivor`);
          assert.equal(result.reorderFocusedDisconnected, 0, `${scenario}: native move does not disconnect focused survivor`);
          assert.equal(result.reorderLastDisconnected, 0, `${scenario}: native move does not disconnect last survivor`);
          assert.ok(result.reorderMoveCount > 0, `${scenario}: native move uses connectedMoveCallback`);
        }
        assert.equal(result.reorderRenderCount, 1, `${scenario}: reorder does not rerender survivor`);
        assert.equal(result.reorderNodesReversed, true, `${scenario}: reorder moves existing nodes`);
      }

      console.log(`${scenario}: removal-only survivor state passed`);
    }
  } catch (error) {
    failures.push(new Error(`${browserName}: ${error.message}`, { cause: error }));
  } finally {
    await browserInstance?.close();
  }
}

if (failures.length) {
  throw new AggregateError(failures, 'Removal-only survivor state failed.');
}
