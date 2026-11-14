# Packet P5 architecture proof: a get of a key from inside its own
# factory run rejects with ReentrantGetError. These target a scratch
# implementation of P5 in a separate clone that is never committed, so
# their find texts do not apply to this branch's src. Each entry is
# (id, file, find, replace, expect). The first three are the controls.
R = 'src/Registry.ts'
E = 'src/errors.ts'
I = 'src/index.ts'
CHECK = "      if (frame.key === key && !frame.settled) {\n"
UNSHIFT = "          path.unshift(step.key);\n"
RUN = "    return Promise.resolve().then(() => this.runs.run(frame, () => entry.factory())).then(\n"
MUTATIONS = [
  ('C1-must-catch: the item is never stored', R, "        entry.instance = item;\n", "", 'killed'),
  ('C2-must-survive: comment only', R, CHECK, "      // harmless\n" + CHECK, 'survive'),
  ('C3-must-refuse: syntax break', R, CHECK, CHECK + "(", 'refuse'),

  ('P5-1 no re-entrant check at all', R, CHECK, "      if (frame.key === key && !frame.settled && key.length < 0) {\n", 'killed'),
  ('P5-2 only the innermost run is checked, so a cycle through another key is missed', R,
   "    for (let frame = current; frame; frame = frame.parent) {\n", "    for (let frame = current; frame; frame = undefined) {\n", 'killed'),
  ('P5-3 a settled run still counts, so later work the factory started is refused', R, CHECK, "      if (frame.key === key) {\n", 'killed'),
  ('P5-4 factories run outside the run context', R, RUN, "    return Promise.resolve().then(() => entry.factory()).then(\n", 'killed'),
  ('P5-5 a run never marks itself settled on success', R, "        frame.settled = true;\n        entry.instance = item;\n", "        entry.instance = item;\n", 'killed'),
  ('P5-6 the path leaves out the runs that led back', R, UNSHIFT, "", 'killed'),
  ('P5-7 the error is a KeyNotFoundError', R, "        throw new ReentrantGetError(key, path);\n", "        throw new KeyNotFoundError(key, path);\n", 'killed'),
  ('P5-8 the error has another name', E, "    this.name = 'ReentrantGetError';\n", "    this.name = 'RegistryError';\n", 'killed'),
  ('P5-9 the message does not name the path', E,
   "was read from inside its own factory run: ${path.map((step) => `'${step}'`).join(' -> ')}.", "was read from inside its own factory run.", 'killed'),
  ('P5-10 the root does not export the error', I, ", ReentrantGetError } from './errors.js';", " } from './errors.js';", 'killed'),
]
