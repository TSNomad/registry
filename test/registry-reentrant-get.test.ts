/**
 * Acceptance tests: a get of a key from inside that key's own factory
 * run fails loudly instead of hanging. That covers a factory that gets
 * its own key, a cycle through another key's factory, and a factory
 * that replaces its own key and then gets it. Each rejects with a
 * `ReentrantGetError`, a `RegistryError` that names the key and the
 * path of keys that led back to it, and the run caches nothing.
 *
 * Packet P5 implemented the rule, so every test runs and passes. The
 * last test pins the other side of it: a get from work the factory
 * started, made after its run settled, is not re-entrant and serves the
 * item.
 *
 * No test here can hang on a registry without the rule. Each one either
 * stops its own loop after a fixed number of runs or checks the outcome
 * after the microtask queue drains.
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Registry } from '../dist/Registry.js';
import { KeyNotFoundError, RegistryError } from '../dist/errors.js';

/**
 * Waits until every pending promise job has run. No timer is involved:
 * `setImmediate` runs after the microtask queue is empty.
 */
const settle = (): Promise<void> => new Promise((resolve) => setImmediate(resolve));

/** Records how a promise settles, so a test can read it without awaiting a promise that may never settle. */
function observe<T>(promise: Promise<T>) {
  const outcome: { state: 'pending' | 'fulfilled' | 'rejected'; value?: T; error?: unknown } = { state: 'pending' };
  promise.then(
    (value) => {
      outcome.state = 'fulfilled';
      outcome.value = value;
    },
    (error: unknown) => {
      outcome.state = 'rejected';
      outcome.error = error;
    }
  );
  return outcome;
}

/** Checks that an error is the re-entrant get error for this key and path. */
function assertReentrant(error: unknown, key: string, path: string[], label = key): void {
  assert.ok(error instanceof RegistryError, `${label} gave ${String(error)}`);
  assert.ok(!(error instanceof KeyNotFoundError), label);
  assert.equal(error.name, 'ReentrantGetError', label);
  assert.equal((error as { key?: unknown }).key, key, label);
  assert.deepEqual((error as { path?: unknown }).path, path, label);
  for (const step of new Set(path)) {
    assert.ok(error.message.includes(`'${step}'`), `${label}: the message names '${step}': ${error.message}`);
  }
}

test('a factory that replaces its own key and then gets it rejects with a ReentrantGetError, after one run', async () => {
  const registry = new Registry<string>();
  let runs = 0;
  const factory = async (): Promise<string> => {
    runs += 1;
    // Ends the loop a registry without the rule would run forever.
    if (runs > 20) {
      return 'gave up';
    }
    registry.replace('loop', factory);
    return registry.get('loop');
  };
  registry.set('loop', factory);

  await assert.rejects(registry.get('loop'), (error: unknown) => {
    assertReentrant(error, 'loop', ['loop', 'loop']);
    return true;
  });
  assert.equal(runs, 1);

  registry.replace('loop', () => 'built');
  assert.equal(await registry.get('loop'), 'built');
});

test('a factory that gets its own key rejects with a ReentrantGetError instead of waiting on its own run', async () => {
  const factories: Array<[string, (registry: Registry<string>) => () => string | Promise<string>]> = [
    ['synchronously', (registry) => () => registry.get('self')],
    ['after an await', (registry) => async () => {
      await Promise.resolve();
      return registry.get('self');
    }],
  ];
  for (const [label, make] of factories) {
    const registry = new Registry<string>();
    let runs = 0;
    const factory = make(registry);
    registry.set('self', () => {
      runs += 1;
      return factory();
    });

    const outcome = observe(registry.get('self'));
    for (let turn = 0; turn < 5; turn++) {
      await settle();
    }

    assert.equal(outcome.state, 'rejected', `${label}: the get is still ${outcome.state}`);
    assertReentrant(outcome.error, 'self', ['self', 'self'], label);
    assert.equal(runs, 1, label);
  }
});

test("a cycle through another key's factory rejects with a ReentrantGetError naming the path", async () => {
  const registry = new Registry<string>();
  registry.set('a', async () => `a+${await registry.get('b')}`);
  registry.set('b', async () => `b+${await registry.get('a')}`);

  const outcome = observe(registry.get('a'));
  for (let turn = 0; turn < 5; turn++) {
    await settle();
  }

  assert.equal(outcome.state, 'rejected', `the get is still ${outcome.state}`);
  assertReentrant(outcome.error, 'a', ['a', 'b', 'a']);

  registry.replace('b', () => 'b');
  assert.equal(await registry.get('a'), 'a+b');
});

test('a get from work the factory started, made after its run settled, serves the item', async () => {
  const registry = new Registry<string>();
  let later: Promise<string> | undefined;
  let scheduled = false;
  registry.set('k', () => {
    // Scheduled once, so a registry that runs the factory again cannot
    // keep the event loop busy after the test ends.
    if (!scheduled) {
      scheduled = true;
      setImmediate(() => {
        later = registry.get('k');
      });
    }
    return 'item';
  });

  assert.equal(await registry.get('k'), 'item');
  await settle();
  await settle();
  assert.ok(later, 'the factory\'s later work ran');
  assert.equal(await later, 'item');
});
