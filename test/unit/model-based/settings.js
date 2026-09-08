function integer(name, fallback, maximum) {
  const value = process.env[name];
  if (value === undefined) { return fallback; }
  const parsed = Number(value);
  if (!Number.isSafeInteger(parsed) || parsed < 1 || parsed > maximum) {
    throw new Error(`${name} must be an integer from 1 to ${maximum}.`);
  }
  return parsed;
}

export function modelSettings() {
  const seed = Number(process.env.MARIONETTE_MODEL_SEED ?? 20260908);
  if (!Number.isSafeInteger(seed) || seed < -2147483648 || seed > 2147483647) {
    throw new Error('MARIONETTE_MODEL_SEED must be a signed 32-bit integer.');
  }
  return {
    commands: {
      size: 'max',
      maxCommands: integer('MARIONETTE_MODEL_STEPS', 40, 1000),
      ...(process.env.MARIONETTE_MODEL_REPLAY_PATH ? { replayPath: process.env.MARIONETTE_MODEL_REPLAY_PATH } : {})
    },
    assert: {
      seed,
      numRuns: integer('MARIONETTE_MODEL_RUNS', 75, 10000),
      verbose: 1,
      ...(process.env.MARIONETTE_MODEL_PATH ? { path: process.env.MARIONETTE_MODEL_PATH } : {})
    }
  };
}

export class Command {
  constructor(name, args, check, run) {
    this.name = name;
    this.args = args;
    this.check = check;
    this.run = run;
  }
  toString() { return `${this.name}(${this.args.join(',')})`; }
}
