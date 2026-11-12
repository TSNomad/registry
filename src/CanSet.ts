/**
 * CanSet
 *
 * PHPNomad's `PHPNomad\Registry\Interfaces\CanSet`: set an item's
 * factory under an id. The registry calls the factory the first time
 * the id is read.
 *
 * Where this differs from PHPNomad: setting an id twice throws
 * `DuplicateKeyError`, as the 0.1 registry does, so a wiring mistake
 * shows when it happens. PHPNomad replaces the earlier entry. The
 * registry's `replace` replaces on purpose. TypeScript does not force
 * this difference. It is an open gap under TS Nomad Alignment With
 * PHPNomad (Charter 5012, https://navigator.novatori.us/r/charter/5012),
 * kept for current consumers.
 */

import type { ItemFactory } from './types.js';

export interface CanSet<T> {
  /**
   * @param id - The id to set the item under
   * @param factory - Builds the item, sync or async, on first read
   * @throws DuplicateKeyError when the id is already set
   */
  set(id: string, factory: ItemFactory<T>): void;
}
