# Slice 7 review: a spot check of eight entries against the packet P2
# implementation, chosen where the reviewer wanted a second look rather
# than copied from p2-mutations.py. Each entry is (id, file, find,
# replace, expect). The first three are the harness controls. Run with:
#   python3 docs/architecture/ncc-slice-7-proof/mutate.py . docs/architecture/ncc-slice-7-proof/review-spot-mutations.py
R = 'src/Registry.ts'
DELETE = "  delete(key: string): void {\n    this.entries.delete(key);\n  }"
CLEAR = "  clear(): void {\n    this.entries.clear();\n  }"
REPLACE_BODY = "  ): void {\n    this.entries.set(key, {\n      factory,\n      instance: null,\n      metadata,\n    });\n  }\n\n  /**\n   * Gets an item by key"
MUTATIONS = [
  ('C1-must-catch: getKeys answers nothing', R, "  getKeys(): string[] {\n    return this.keys();", "  getKeys(): string[] {\n    return [];", 'killed'),
  ('C2-must-survive: comment only', R, DELETE, "  // harmless\n" + DELETE, 'survive'),
  ('C3-must-refuse: syntax break', R, DELETE, DELETE + "(", 'refuse'),

  ('S1 delete keeps an entry whose run is in flight', R, DELETE,
   "  delete(key: string): void {\n    if (!this.entries.get(key)?.pending) this.entries.delete(key);\n  }", 'killed'),
  ('S2 clear resets entries in place instead of dropping them', R, CLEAR,
   "  clear(): void {\n    for (const [k, e] of this.entries) { if (e.pending) { e.built = false; e.instance = null; } else { this.entries.delete(k); } }\n  }", 'killed'),
  ('S3 replace rewrites the entry in place, so a run in flight writes to the new one', R, REPLACE_BODY,
   "  ): void {\n    const live = this.entries.get(key);\n    if (live) { live.factory = factory; live.instance = null; live.built = false; live.metadata = metadata; return; }\n    this.entries.set(key, {\n      factory,\n      instance: null,\n      metadata,\n    });\n  }\n\n  /**\n   * Gets an item by key", 'killed'),
  ('S4 a failed run marks the entry built', R, "      (error: unknown) => {\n        frame.settled = true;\n        entry.pending = undefined;",
   "      (error: unknown) => {\n        frame.settled = true;\n        entry.pending = undefined;\n        entry.built = true;", 'killed'),
  ('S5 the entry is marked built before the factory answers', R, "  private build(entry: RegistryEntry<T>, key: string): Promise<T> {\n    const frame",
   "  private build(entry: RegistryEntry<T>, key: string): Promise<T> {\n    entry.built = true;\n    const frame", 'killed'),
]
