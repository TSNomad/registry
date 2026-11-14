/**
 * CanDelete
 *
 * PHPNomad's `PHPNomad\Registry\Interfaces\CanDelete`: remove an item
 * by id. Deleting an id nothing is set under does nothing.
 */

export interface CanDelete {
  delete(id: string): void;
}
