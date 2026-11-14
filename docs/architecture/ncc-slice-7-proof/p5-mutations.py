# Packet P5: the re-entrant get rule, one mutation per guard, against the
# committed Registry, errors and package root on this branch. Each entry
# is (id, file, find, replace, expect). The first three are the harness
# controls. U entries guard the P5 unit tests in
# test/registry-build.test.ts. Run with:
#   python3 docs/architecture/ncc-slice-7-proof/mutate.py . docs/architecture/ncc-slice-7-proof/p5-mutations.py
R = 'src/Registry.ts'
E = 'src/errors.ts'
I = 'src/index.ts'
CHECK = "    const path = this.reentrantPath(key);\n    if (path) {\n      throw new ReentrantGetError(key, path);\n    }\n\n"
LOOKUP = "    const entry = this.entries.get(key);\n\n    if (!entry) {\n      throw new KeyNotFoundError(key, this.keys());\n    }\n\n"
BUILT = "    if (entry.built) {\n      return entry.instance as T;\n    }\n\n"
RUN = "    return Promise.resolve().then(() => this.runs.run(frame, () => entry.factory())).then(\n"
SETTLE_OK = "        frame.settled = true;\n        entry.instance = item;\n"
SETTLE_FAIL = "        frame.settled = true;\n        entry.pending = undefined;\n        throw error;\n"
SKIP_SETTLED = "      if (frame.settled) {\n        continue;\n      }\n"
UNSHIFT = "      inFlight.unshift(frame.key);\n"
WALK = "    for (let frame = this.runs.getStore(); frame; frame = frame.parent) {\n"
FIELD = "  private readonly runs = new AsyncLocalStorage<RunFrame>();\n"
MATCH = "      if (frame.key === key) {\n"
MUTATIONS = [
  ('C1-must-catch: the re-entrant check never throws', R, CHECK, "", 'killed'),
  ('C2-must-survive: comment only', R, UNSHIFT, "      // harmless\n" + UNSHIFT, 'survive'),
  ('C3-must-refuse: syntax break', R, UNSHIFT, UNSHIFT + "(", 'refuse'),

  # The rule
  ('P5-1 no frame ever matches its key', R, MATCH, "      if (frame.key === key && key.length < 0) {\n", 'killed'),
  ('P5-2 only the innermost run is checked, so a cycle through another key is missed', R, WALK,
   "    for (let frame = this.runs.getStore(); frame; frame = undefined) {\n", 'killed'),
  ('P5-3 a settled run still counts, so later work the factory started is refused', R, SKIP_SETTLED, "", 'killed'),
  ('P5-4 factories run outside the run context', R, RUN, "    return Promise.resolve().then(() => entry.factory()).then(\n", 'killed'),
  ('P5-5 a run never marks itself settled on success', R, SETTLE_OK, "        entry.instance = item;\n", 'killed'),
  ('P5-6 a run never marks itself settled on failure', R, SETTLE_FAIL, "        entry.pending = undefined;\n        throw error;\n", 'killed'),
  ('P5-7 a run does not link to the run that started it', R, "{ key, parent: this.runs.getStore(), settled: false }", "{ key, parent: undefined, settled: false }", 'killed'),
  ('P5-8 a run that fails on a re-entrant get caches undefined as the item', R,
   SETTLE_FAIL, "        frame.settled = true;\n        entry.pending = undefined;\n        if (error instanceof ReentrantGetError) {\n          return undefined as T;\n        }\n        throw error;\n", 'killed'),

  # The path
  ('P5-9 the path leaves out the runs that led back', R, UNSHIFT, "", 'killed'),
  ('P5-10 the path lists the runs innermost first', R, UNSHIFT, "      inFlight.push(frame.key);\n", 'killed'),
  ('P5-11 the path does not end with the key got', R, "    return reentrant ? [...inFlight, key] : undefined;\n", "    return reentrant ? inFlight : undefined;\n", 'killed'),

  # The error
  ('P5-12 the error is a KeyNotFoundError', R, "      throw new ReentrantGetError(key, path);\n", "      throw new KeyNotFoundError(key, path);\n", 'killed'),
  ('P5-13 the error names the outermost key, not the key got', R, "      throw new ReentrantGetError(key, path);\n", "      throw new ReentrantGetError(path[0], path);\n", 'killed'),
  ('P5-14 the error has another name', E, "    this.name = 'ReentrantGetError';\n", "    this.name = 'RegistryError';\n", 'killed'),
  ('P5-15 the error is not a RegistryError', E, "export class ReentrantGetError extends RegistryError {\n",
   "export class ReentrantGetError extends Error {\n", 'killed'),
  ('P5-16 the message does not name the path', E,
   "was got from inside its own factory run: ${path.map((step) => `'${step}'`).join(' -> ')}. ", "was got from inside its own factory run. ", 'killed'),
  ('P5-17 the root does not export the error', I, ", DuplicateKeyError, ReentrantGetError } from './errors.js';", ", DuplicateKeyError } from './errors.js';", 'killed'),

  # Unit tests, test/registry-build.test.ts
  ('U1 the factory starts inside get, before get stores the run', R, RUN,
   "    return Promise.resolve(this.runs.run(frame, () => entry.factory())).then(\n", 'killed'),
  ('U2 the factory starts two microtasks after get stores the run', R, RUN,
   "    return Promise.resolve().then().then(() => this.runs.run(frame, () => entry.factory())).then(\n", 'killed'),
  ('U3 one run context shared by every registry', R,
   [(FIELD, "  private readonly runs = sharedRuns as AsyncLocalStorage<RunFrame>;\n"),
    ("interface RunFrame {\n", "const sharedRuns = new AsyncLocalStorage<any>();\n\ninterface RunFrame {\n")], None, 'killed'),
  ('U4 the check runs after the key lookup, so a deleted own key is KeyNotFoundError', R,
   [(CHECK, ""), (LOOKUP, LOOKUP + CHECK)], None, 'killed'),
  ('U5 the check runs after the built check, so a key built outside is served', R,
   [(CHECK, ""), (BUILT, BUILT + CHECK)], None, 'killed'),
]
