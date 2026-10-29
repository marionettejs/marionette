import { expect } from 'vitest';
import { test } from '@mnjs/test/vitest';
import { createMarionette } from 'marionette';
import { within } from '@testing-library/dom';

test('isolates runtime channels and releases the Radio resources owned by a test', async({ mounts }) => {
  const first = createMarionette();
  const second = createMarionette();
  mounts.scope.defer(() => first.Radio.reset());
  mounts.scope.defer(() => second.Radio.reset());
  const Card = first.View.extend({ template: () => '<p role="status">Waiting</p>' });
  const mounted = mounts.mountView(new Card(), { regionClass: first.Region });
  const status = within(mounted.container).getByRole('status');
  const firstChannel = first.Radio.channel('selection');
  const secondChannel = second.Radio.channel('selection');
  const secondMessages = [];
  firstChannel.on('selected', value => { status.textContent = value; });
  secondChannel.on('selected', value => { secondMessages.push(value); });

  secondChannel.trigger('selected', 'Second');
  expect(status.textContent).toBe('Waiting');
  firstChannel.trigger('selected', 'First');
  expect(status.textContent).toBe('First');
  expect(secondMessages).toEqual(['Second']);

  await mounts.cleanup();
  expect(mounted.view.isDestroyed()).toBe(true);
  firstChannel.trigger('selected', 'After cleanup');
  secondChannel.trigger('selected', 'After cleanup');
  expect(status.textContent).toBe('First');
  expect(secondMessages).toEqual(['Second']);
});
