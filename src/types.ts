/**
 * TSNomad Registry Types
 *
 * Generic registry with lazy loading support.
 * Used for managing collections of related items (strategies, handlers, etc.)
 */

/**
 * Factory function that creates a registry item.
 * Can be sync or async for lazy loading.
 */
export type ItemFactory<T> = () => T | Promise<T>;

/**
 * Metadata that can be attached to registry items.
 */
export interface ItemMetadata {
  /**
   * Human-readable description of this item.
   */
  description?: string;

  /**
   * Priority for ordering (higher = first).
   */
  priority?: number;

  /**
   * Arbitrary tags for filtering.
   */
  tags?: string[];

  /**
   * Additional custom metadata.
   */
  [key: string]: unknown;
}
