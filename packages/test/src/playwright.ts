import { createMountSession } from './session.ts';
import type { TestMounts } from './context.ts';
import type { MountOptions } from './index.ts';
export type { TestMounts } from './context.ts';

export interface StoryHandle<Props> {
  update(props: Props): unknown;
}
export type Story<Props = Record<string, unknown>> = (props: Props, mounts: TestMounts) =>
  void | StoryHandle<Props> | Promise<void | StoryHandle<Props>>;
export interface GalleryOptions extends MountOptions {
  container: Element;
}
// A registry contains heterogeneous prop types; each mount retains its selected story's type.
type StoryRegistry = Record<string, Story<any>>;
type StoryProps<Props> = undefined extends Props ? { props?: Props } : { props: Props };
export interface Gallery<Stories extends StoryRegistry = StoryRegistry> {
  mount<Name extends keyof Stories & string>(params: { story: Name } & StoryProps<Parameters<Stories[Name]>[0]>): Promise<void>;
  unmount(): Promise<void>;
}

// Browser-side stories only. Playwright owns Node fixtures, navigation and Locators.
export function createGallery<Stories extends StoryRegistry>(stories: Stories, options: GalleryOptions): Gallery<Stories>;
export function createGallery(stories: StoryRegistry, options: GalleryOptions): Gallery {
  const session = createMountSession();
  let current: { name: string; context: TestMounts; ready: Promise<void | StoryHandle<any>> } | undefined;
  function unmount() {
    current = undefined;
    return session.cleanup();
  }
  return {
    unmount,
    async mount({ story, props }) {
      if (!Object.hasOwn(stories, story)) { throw new Error(`Unknown story: ${story}`); }
      if (current?.name === story) {
        const active = current;
        const handle = await active.ready;
        if (!session.owns(active.context)) { throw new Error(`Story was unmounted during setup: ${story}`); }
        if (!handle) { throw new Error(`Story has no update callback: ${story}`); }
        await handle.update(props);
        if (!session.owns(active.context)) { throw new Error(`Story was unmounted during update: ${story}`); }
        return;
      }
      const context = await session.replace({ replaceElement: true, ...options });
      // Own the context before invoking any asynchronous story setup.
      const active = { name: story, context, ready: Promise.resolve().then(() => stories[story](props, context)) };
      current = active;
      try {
        await active.ready;
        if (!session.owns(context)) { throw new Error(`Story was unmounted during setup: ${story}`); }
      } catch (error) {
        if (session.owns(context)) {
          try { await unmount(); } catch (cleanupError) {
            throw new AggregateError([error, cleanupError], `Story setup and cleanup failed: ${story}`, { cause: cleanupError });
          }
        }
        throw error;
      }
    }
  };
}
