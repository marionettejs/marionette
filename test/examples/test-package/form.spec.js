import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { within, waitFor } from '@testing-library/dom';
import userEvent from '@testing-library/user-event';
import { createTestScope, mountApplication, mountView } from '@mnjs/test';
import { ProfileFeature, ProfileForm } from './fixtures.js';

let scope;
beforeEach(() => { scope = createTestScope(); });
afterEach(() => { const previous = scope; scope = undefined; return previous?.cleanup(); });

describe('profile feature and form', () => {
  it('validates, focuses the missing field and saves using semantic queries', async() => {
    const mounted = scope.own(mountView(new ProfileForm()));
    const query = within(mounted.container);
    const user = userEvent.setup({ document: mounted.container.ownerDocument });
    await user.click(query.getByRole('button', { name: 'Save profile' }));
    expect(query.getByRole('alert').textContent).toBe('Enter a name and valid email.');
    expect(document.activeElement).toBe(query.getByRole('textbox', { name: 'Name' }));
    await user.type(query.getByRole('textbox', { name: 'Name' }), 'Ada');
    await user.tab();
    expect(document.activeElement).toBe(query.getByRole('textbox', { name: 'Email' }));
    await user.type(document.activeElement, 'ada@example.test');
    await user.tab();
    await user.keyboard('{Enter}');
    await waitFor(() => expect(query.getByRole('status').textContent).toBe('Profile saved.'));
    expect(mounted.view.savedProfile).toEqual({ name: 'Ada', email: 'ada@example.test' });
  });

  it('shows a save failure, preserves the draft and supports retry', async() => {
    let attempt = 0;
    const mounted = scope.own(mountView(new ProfileForm({
      profile: { name: 'Ada', email: 'ada@example.test' },
      async save(profile) { if (++attempt === 1) { throw new Error('Try again'); } return profile; }
    })));
    const query = within(mounted.container);
    const user = userEvent.setup();
    await user.click(query.getByRole('button', { name: 'Save profile' }));
    await waitFor(() => expect(query.getByRole('alert').textContent).toBe('Try again'));
    expect(query.getByRole('textbox', { name: 'Name' }).value).toBe('Ada');
    await user.click(query.getByRole('button', { name: 'Save profile' }));
    await waitFor(() => expect(query.getByRole('status').textContent).toBe('Profile saved.'));
  });

  it('makes preparation readiness and cancellation observable', async() => {
    const load = Promise.withResolvers();
    let signal;
    const mounted = scope.own(mountApplication(() => new ProfileFeature({
      loadProfile(context) { signal = context.signal; return load.promise; }
    })));
    expect(mounted.el).toBeUndefined();
    mounted.app.stop();
    await expect(mounted.ready).resolves.toBe(false);
    expect(signal.aborted).toBe(true);
    load.resolve({ name: 'Late', email: 'late@example.test' });
    await load.promise;
    expect(mounted.el).toBeUndefined();
  });

  it('mounts the prepared form and cancels its distinct pending save on cleanup', async() => {
    const pendingSave = Promise.withResolvers();
    let saveSignal;
    const mounted = scope.own(mountApplication(() => new ProfileFeature({
      async loadProfile() { return { name: 'Ada', email: 'ada@example.test' }; },
      save(profile, { signal }) { saveSignal = signal; return pendingSave.promise; }
    })));
    await expect(mounted.ready).resolves.toBe(true);
    const form = mounted.app.getView();
    const query = within(mounted.container);
    const user = userEvent.setup();
    await user.click(query.getByRole('button', { name: 'Save profile' }));
    expect(query.getByRole('status').textContent).toBe('Saving…');
    expect(query.getByRole('button').disabled).toBe(true);
    await mounted.cleanup();
    expect(saveSignal.aborted).toBe(true);
    pendingSave.resolve({ name: 'Late', email: 'late@example.test' });
    await pendingSave.promise;
    expect(form.savedProfile).toBeUndefined();
    expect(form.isDestroyed()).toBe(true);
  });
});
