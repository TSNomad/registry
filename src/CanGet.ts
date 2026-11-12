/**
 * CanGet
 *
 * PHPNomad's `PHPNomad\Registry\Interfaces\CanGet`: read items from a
 * registry by id.
 *
 * Where this differs from PHPNomad:
 * - `get` and `getAll` return promises, because an item's factory may
 *   be async.
 * - `get` of an id nothing is set under throws `KeyNotFoundError`, as
 *   the 0.1 registry does. PHPNomad's `get` answers null.
 * - PHPNomad's `getAll` answers an array keyed by id. Here `getAll`
 *   answers the items in key order, as 0.1 does, and the registry's
 *   `getAllEntries` answers the record keyed by id.
 */

export interface CanGet<T> {
  /**
   * Gets the item set under the id, building it from its factory the
   * first time and serving the same item after that.
   *
   * @throws KeyNotFoundError, through the returned promise, when nothing
   *   is set under the id
   */
  get(id: string): Promise<T>;

  /**
   * Gets every item, in the order their ids were set.
   */
  getAll(): Promise<T[]>;

  /**
   * Gets every id, in the order they were set.
   */
  getKeys(): string[];
}
