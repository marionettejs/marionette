import MarionetteError from './error.ts';

// Dispatch requires one name; registration may still expand maps and whitespace.
export default function assertSingleEvent(name: string): void {
  if (typeof name !== 'string') {
    throw new MarionetteError({
      code: 'MN0041',
      name: 'EventError',
      message: 'Trigger one string event name per call; event maps are not supported.',
      url: 'events.html'
    });
  }
}
