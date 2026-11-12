# One mutation per guard in the registry's acceptance tests, against the
# architecture phase's scratch Registry.get in a separate clone. Each
# entry is (id, file, find, replace, expect). The first three are the
# harness controls.
R = 'src/Registry.ts'
KEYS = "  getKeys(): string[] {\n    return this.keys();\n  }"
MUTATIONS = [
  ('C1-must-catch: get answers undefined', R, "    return entry.pending;\n  }", "    return undefined as T;\n  }", 'killed'),
  ('C2-must-survive: comment only', R, KEYS, "  // harmless\n" + KEYS, 'survive'),
  ('C3-must-refuse: syntax break', R, KEYS, KEYS + "(", 'refuse'),

  ('G1 concurrent first gets each run the factory', R, "    if (!entry.pending) {", "    {", 'killed'),
  ('G2 null and undefined not cached (0.1)', R, "    if (entry.built) {", "    if (entry.instance !== null && entry.instance !== undefined) {", 'killed'),
  ('G3 a rejection stays cached', R, "        (error) => {\n          entry.pending = undefined;\n          throw error;", "        (error) => {\n          throw error;", 'killed'),
  ('G4 a run lands on whatever entry holds the key now', R,
   "          entry.instance = value;\n          entry.built = true;",
   "          const live = this.entries.get(key) ?? entry;\n          live.instance = value;\n          live.built = true;", 'killed'),
  ('G5 replace keeps the old run', R,
   "  replace(\n    key: string,\n    factory: ItemFactory<T>,\n    metadata: ItemMetadata = {}\n  ): void {\n    this.entries.set(key, {\n      factory,\n      instance: null,\n      metadata,\n    });",
   "  replace(\n    key: string,\n    factory: ItemFactory<T>,\n    metadata: ItemMetadata = {}\n  ): void {\n    this.entries.set(key, {\n      factory,\n      instance: null,\n      metadata,\n      pending: this.entries.get(key)?.pending,\n    });", 'killed'),
  ('G6 a failed run retried inline for its waiters', R, "        (error) => {\n          entry.pending = undefined;\n          throw error;", "        (error) => {\n          entry.pending = undefined;\n          if (!(entry as any).retried) { (entry as any).retried = true; return this.get(key); }\n          throw error;", 'killed'),
  ('G7 getKeys answers nothing', R, KEYS, "  getKeys(): string[] {\n    return [];\n  }", 'killed'),
  ('G8 getKeys in reverse order', R, KEYS, "  getKeys(): string[] {\n    return this.keys().reverse();\n  }", 'killed'),
  ('G9 getAll runs factories itself', R, "      items.push(await this.get(key));", "      items.push(await this.entries.get(key)!.factory());", 'killed'),
  ('G10 get rebuilds after a success', R, "    if (entry.built) {\n      return entry.instance as T;\n    }", "", 'killed'),
  ('G11 getAllEntries runs factories itself', R, "      result[key] = await this.get(key);", "      result[key] = (await this.entries.get(key)!.factory()) as T;", 'killed'),
  ('G12 getAll gets every key at once', R, "    for (const key of this.keys()) {\n      items.push(await this.get(key));\n    }", "    items.push(...(await Promise.all(this.keys().map((key) => this.get(key)))));", 'killed'),
  ('G13 getAll skips a key deleted before its turn', R, "      items.push(await this.get(key));", "      if (this.has(key)) items.push(await this.get(key));", 'killed'),
  ('G14 getAllEntries skips a failing key', R, "      result[key] = await this.get(key);", "      try { result[key] = await this.get(key); } catch { /* skipped */ }", 'killed'),
]
