/**
 * Acceptance tests: how `Registry.get` builds and caches an item. One
 * factory run per entry, under concurrent gets too, any answer cached,
 * null included, no failure cached, and a run never landing on an entry
 * that replaced the one that started it.
 *
 * Packet P2 removes each `skip`. The tests that already pass on the 0.1
 * code run now.
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Registry } from '../dist/Registry.js';
import { KeyNotFoundError } from '../dist/errors.js';

/**
 * Waits until every pending promise job has run, so each get started
 * above has reached its factory. No timer is involved: `setImmediate`
 * runs after the microtask queue is empty.
 */
const settle = (): Promise<void> => new Promise((resolve) => setImmediate(resolve));

/**
 * A factory whose runs are counted and that settles when told to.
 * `release` and `fail` settle every run so far, so code that runs the
 * factory more than once fails an assertion instead of hanging.
 */
function gated<T>(answer: () => T) {
  const pending: Array<{ resolve: (value: T) => void; reject: (error: unknown) => void }> = [];
  const state = {
    runs: 0,
    release: () => {
      for (const run of pending.splice(0)) run.resolve(answer());
    },
    fail: (error: unknown) => {
      for (const run of pending.splice(0)) run.reject(error);
    },
  };
  const factory = () => {
    state.runs += 1;
    return new Promise<T>((resolve, reject) => {
      pending.push({ resolve, reject });
    });
  };
  return { state, factory };
}

test('the factory does not run until the key is read, and runs once for later reads', async () => {
  const registry = new Registry<{ n: number }>();
  let runs = 0;
  registry.set('claude', () => ({ n: ++runs }));
  assert.equal(runs, 0);

  const first = await registry.get('claude');
  assert.equal(await registry.get('claude'), first);
  assert.equal(runs, 1);
});

test.skip('concurrent first gets share one factory run and receive the same item', async () => {
  const registry = new Registry<object>();
  const { state, factory } = gated(() => ({}));
  registry.set('claude', factory);

  const both = Promise.all([registry.get('claude'), registry.get('claude'), registry.get('claude')]);
  await settle();
  state.release();
  const [a, b, c] = await both;

  assert.equal(state.runs, 1);
  assert.equal(a, b);
  assert.equal(b, c);
});

test.skip('a factory that answers null or undefined runs once, and the answer is served after', async () => {
  for (const answer of [null, undefined]) {
    const registry = new Registry<object | null | undefined>();
    let runs = 0;
    registry.set('empty', () => {
      runs += 1;
      return answer;
    });

    assert.equal(await registry.get('empty'), answer);
    assert.equal(await registry.get('empty'), answer);
    assert.equal(runs, 1, `answer ${String(answer)}`);
  }
});

test('a factory that throws caches nothing, and the next get runs it again', async () => {
  const registry = new Registry<string>();
  let runs = 0;
  registry.set('flaky', async () => {
    runs += 1;
    if (runs === 1) {
      throw new Error('first run fails');
    }
    return 'second run';
  });

  await assert.rejects(registry.get('flaky'), /first run fails/);
  assert.equal(await registry.get('flaky'), 'second run');
  assert.equal(runs, 2);
});

test.skip('every get waiting on a failed run gets its error, and the run is not repeated for them', async () => {
  const registry = new Registry<string>();
  const { state, factory } = gated(() => 'never');
  registry.set('flaky', factory);
  const boom = new Error('down');

  const waiting = [registry.get('flaky'), registry.get('flaky')];
  await settle();
  state.fail(boom);

  for (const get of waiting) {
    await assert.rejects(get, (error) => error === boom);
  }
  assert.equal(state.runs, 1);
});

test('replace during a run: the old run never lands on the new entry, and the next get runs the new factory', async () => {
  const registry = new Registry<string>();
  const { state, factory } = gated(() => 'old');
  registry.set('claude', factory);

  const inFlight = registry.get('claude');
  await settle();
  registry.replace('claude', () => 'new');
  state.release();

  assert.equal(await inFlight, 'old');
  assert.equal(await registry.get('claude'), 'new');
  assert.equal(state.runs, 1);
});

test('delete during a run: the run never lands on an entry set later under the same key', async () => {
  const registry = new Registry<string>();
  const { state, factory } = gated(() => 'old');
  registry.set('claude', factory);

  const inFlight = registry.get('claude');
  await settle();
  registry.delete('claude');
  registry.set('claude', () => 'fresh');
  state.release();
  await inFlight;

  assert.equal(await registry.get('claude'), 'fresh');
});

test('clear during a run: the run never lands on an entry set later under the same key', async () => {
  const registry = new Registry<string>();
  const { state, factory } = gated(() => 'old');
  registry.set('claude', factory);

  const inFlight = registry.get('claude');
  await settle();
  registry.clear();
  registry.set('claude', () => 'fresh');
  state.release();
  await inFlight;

  assert.equal(await registry.get('claude'), 'fresh');
});

test('a get that started before replace and fails does not stop the new entry from building', async () => {
  const registry = new Registry<string>();
  const { state, factory } = gated(() => 'never');
  registry.set('claude', factory);

  const inFlight = registry.get('claude');
  await settle();
  registry.replace('claude', () => 'new');
  state.fail(new Error('old run failed'));

  await assert.rejects(inFlight, /old run failed/);
  assert.equal(await registry.get('claude'), 'new');
});

test('a key nothing is set under rejects with KeyNotFoundError naming the available keys', async () => {
  const registry = new Registry<string>();
  registry.set('claude', () => 'c');
  await assert.rejects(registry.get('codex'), (error: unknown) => {
    assert.ok(error instanceof KeyNotFoundError);
    assert.equal(error.key, 'codex');
    assert.deepEqual(error.availableKeys, ['claude']);
    return true;
  });
});

test.skip('getAll builds each item once, in the order keys were set, sharing runs with gets in flight', async () => {
  const registry = new Registry<string>();
  const { state, factory } = gated(() => 'b');
  registry.set('a', () => 'a');
  registry.set('b', factory);

  const single = registry.get('b');
  const all = registry.getAll();
  await settle();
  state.release();

  assert.deepEqual(await all, ['a', 'b']);
  assert.equal(await single, 'b');
  assert.equal(state.runs, 1);
});

test.skip('getAllEntries builds each item once, keyed by id, sharing runs with gets in flight', async () => {
  const registry = new Registry<string>();
  const { state, factory } = gated(() => 'b');
  registry.set('a', () => 'a');
  registry.set('b', factory);

  const single = registry.get('b');
  const entries = registry.getAllEntries();
  await settle();
  state.release();

  assert.deepEqual(await entries, { a: 'a', b: 'b' });
  assert.equal(await single, 'b');
  assert.equal(state.runs, 1);
});

test('getAll and getAllEntries reject with the error of the first key whose factory fails, in key order', async () => {
  const boom = new Error('b is down');
  for (const read of ['getAll', 'getAllEntries'] as const) {
    const registry = new Registry<string>();
    registry.set('a', () => 'a');
    registry.set('b', () => {
      throw boom;
    });
    registry.set('c', () => {
      throw new Error('c is down');
    });

    await assert.rejects(registry[read](), (error: unknown) => error === boom, read);
  }
});

test('getAll and getAllEntries read the keys set when they start, and a key deleted before its turn rejects with KeyNotFoundError', async () => {
  for (const read of ['getAll', 'getAllEntries'] as const) {
    const registry = new Registry<string>();
    const { state, factory } = gated(() => 'a');
    registry.set('a', factory);
    registry.set('b', () => 'b');

    const all = registry[read]();
    await settle();
    registry.delete('b');
    registry.set('c', () => 'c');
    state.release();

    await assert.rejects(all, (error: unknown) => error instanceof KeyNotFoundError && error.key === 'b', read);
  }
});
