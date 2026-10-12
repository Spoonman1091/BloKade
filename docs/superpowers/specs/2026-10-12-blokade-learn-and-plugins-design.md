# BloKade — Learn BloKade & Kade's Plugins Design Spec

**Date:** 2026-10-12
**Authors:** Larry & Kade (with Claude)
**Status:** Draft for review
**Builds on:** `docs/superpowers/specs/2026-10-11-blokade-design.md` (the main spec). Everything there still
applies unless this document changes it.

## 1. Purpose and decisions

Kade has never written code. They will learn BloKade, and later learn to code their own shapes, with Larry
beside them. The aim is to keep the loop short: do one small thing, see the result, and keep going without
setup steps in the way.

This replaces the main spec's single Milestone 5 ("Kade's Plugins") with two milestones:

| # | Name | Scope |
|---|---|---|
| 5 | **Learn BloKade** | Guided tutorials for the app; help everywhere (tooltips, ❓ help mode, empty-state nudge); the shared lesson panel and ✓ progress. |
| 6 | **Kade's Plugins** | In-app shape editor (CodeMirror) with live preview; Kade's shape library; friendly `cad` toolkit; coding-basics and `cad` lessons; Commands reference; gear example; `yesno` params; designs carry their shapes (schema v4). |

Decisions made while designing (with the reason):

- **Learn the app before learning to code.** Kade uses BloKade today and has never coded. Milestone 5 also
  builds the lesson panel that Milestone 6's coding lessons reuse.
- **Code is written inside BloKade, not in files.** An in-app editor works the same on the home server, on
  GitHub Pages and on any computer, with nothing to install. The `plugins/` folder keeps working for Larry.
- **Designs carry the code of Kade's shapes** they use, so a design file opens anywhere.
- **CodeMirror** is the code box. It is Milestone 6's only new dependency. Line numbers, colours, auto-indent
  and bracket matching matter a lot for a beginner.
- **Kade's code never runs in the page.** It runs only in the geometry worker, so a runaway loop is stopped by
  the existing 30 s restart and the app keeps working.

### Success criteria

- **Milestone 5:** Kade finishes all nine tutorials with Larry nearby but not driving. Afterwards Kade can
  answer "what does this button do?" with ❓ help mode instead of asking.
- **Milestone 6:** Kade finishes the coding lessons and makes a shape of their own that isn't a copy of a
  lesson. It goes into a design and prints.

### Writing style for every kid-facing text

- Short sentences, everyday words, one idea per sentence.
- Name the control the way the screen shows it (**bold**, with its icon).
- Say what to do, then what will happen.
- No blame ("That didn't work" rather than "You did it wrong").
- The same rules as the existing error messages.

---

## 2. Milestone 5 — Learn BloKade

### 2.1 Guided tutorials

- **📘 Learn button** in the top bar opens the **Lessons** side panel. It lists every tutorial with a ✓ when
  finished, and a progress bar for the one in progress.
- **Each tutorial runs in its own practice design**, named after the tutorial (for example "Lesson: Your first
  shape"). Starting one creates and opens it, so Kade's real designs are never touched.
  - Restarting a finished tutorial makes a fresh practice design.
  - Practice designs are ordinary designs: Kade can keep them, rename them or delete them.
- **Steps.** A step shows one short instruction, for example "Click **Box** to add a box."
  - The control it means gets a pulsing outline (the *highlight*), found by its `data-testid`.
  - BloKade ticks the step off by itself when the design and selection show it is done.
  - Every step has **Back**, **Skip** and **💡 Show me**. Show me gives a longer hint, with where to find the
    control.
  - Some steps are only reading ("Look around: drag to orbit, scroll to zoom") and have a **Next** button
    instead of a done-check.
- **Tutorial list.** Each tutorial has 4–10 steps.

  | # | Title | Teaches |
  |---|---|---|
  | 1 | Your first shape | Add a box; change its width in Properties; orbit and zoom the view. |
  | 2 | Move, turn and size | Move with handles and by typing a position; rotate 45°; size handles. |
  | 3 | Holes and groups | Add a cylinder; make it a hole; Shift-click to select both; group, and see it cut. |
  | 4 | Undo, names and saving | Undo and redo; rename the design; save it to a file; open the list of designs. |
  | 5 | Smart sizes | Add a variable; use it in a formula on two parts; change it and watch both update. |
  | 6 | Build on a face | Pick a workplane on a face; add a shape on it; go back to the ground. |
  | 7 | Round and repeat | Round a part's edges; add a row of copies; mirror. |
  | 8 | Perfect fit | Add the Peg & socket kit; change the fit gap; check overlap. |
  | 9 | Ready to print | Export STL and 3MF; a short "what to do in your slicer" read-only step. |

- **Tutorials are data.** Each tutorial is a module exporting:
  - `id`, `title`, `icon` and `intro`;
  - `steps`: `{ id, text, target?, check?, hint }[]`.
  - `target` is a `data-testid`.
  - `check` is a pure function `(view) => boolean`, where `view` holds the design, selection, tool,
    workplane and the open design's id. It never reads the 3D view, the DOM or pixels.
  - A step without `check` is a reading step.

  Milestone 6 adds coding lessons as more tutorial modules with a different step kind.
- **Progress.**
  - Kept per tutorial: the ✓ when done; the current step; and the practice design's id.
  - Stored in browser storage, wrapped in try/catch. In a private window it still works but forgets.
  - Closing the panel pauses a tutorial; reopening resumes at the same step.
- **Pausing and resuming.**
  - If Kade opens a different design while a tutorial is running, the panel shows "This lesson uses its own
    design. Go back to it to keep going." with a **Go back** button.
  - If the practice design was deleted, **Start again** makes a new one.
- **Robustness.**
  - A done-check that throws counts as "not done yet" and is logged once.
  - If a step's target isn't on screen (a collapsed panel, or a scrolled-away field), the step text gets
    "Find it under …" from the step's hint instead of highlighting nothing.

### 2.2 Help everywhere

- **Tooltips.** Hovering over or focusing any button, field or panel heading for about 500 ms shows a small
  bubble with one sentence. It hides on leave, blur or Esc. The highlighted control's own tooltip is
  hidden while a tutorial highlight is on it, so the two don't cover each other; other tooltips still work.
- **❓ Help mode.** A **❓** button in the top bar turns help mode on, and the cursor becomes a question mark.
  - Clicking any control with help shows a help card instead of doing the action. The card has a few
    sentences, a **Try it** tip, and **Learn more →** when a tutorial covers it (this opens that tutorial).
  - Clicking something without help shows "No help for this yet."
  - Help mode never changes the design: clicks on the page are captured before they reach the control.
  - Esc, the ❓ button again, or the card's **Close** leaves help mode.
- **One help list.** `src/help/help-texts.ts` maps a `data-testid` (or a stable id for panel headings) to
  `{ tip, card, tutorial? }`.
  - Controls without a fixed test id (palette buttons for plugins, `param-*` fields) get help from patterns,
    with the shape's or field's label filled in. For example, `add-*` gives "Adds a {name} to your design."
  - A test fails if a control rendered on the main screen has no help entry.
- **Empty-state nudge.** An empty design shows "New here? Try **📘 Learn → Your first shape**" in the 3D view,
  with **Show me** (starts tutorial 1) and **Don't show again** (remembered in browser storage).
- **Not included:** videos, animations, voice-over and translations.

### 2.3 Architecture (Milestone 5)

- **New folders:**
  - `src/learn/`: the tutorial data, the progress store and the step engine;
  - `src/help/`: help texts, the tooltip, help mode and the help card;
  - `src/ui/LessonsPanel.tsx`.
- **The step engine** subscribes to the existing store and evaluates the current step's `check` against a
  `view` built from it. It never changes the design.
- **Tutorial state** (open tutorial, current step, pause reason) lives in a small separate Zustand store, so
  undo and redo never move tutorial steps.
- **The highlight** is an absolutely positioned outline placed with `getBoundingClientRect` on the target.
  - It tracks resize and scroll.
  - It is drawn above the panels and lets clicks through (`pointer-events: none`).
- **Unchanged:** the geometry worker and the document schema. No new npm dependencies.

### 2.4 Testing (Milestone 5)

- **Unit tests:**
  - every tutorial's step `target`s exist in the app's rendered test ids (via a shared list built from a
    render of the main screen);
  - every check against small hand-built sample views (done and not-done);
  - the help list covers every control on the main screen;
  - the progress store survives storage that throws.
- **Component tests:**
  - the Lessons panel (start, Back, Skip, Show me, ✓, resume);
  - the pause on design switch;
  - tooltips (show after the delay, hide on Esc);
  - help mode (a click shows the card and does not run the action; Esc leaves it).
- **End-to-end tests:** Playwright runs **all nine tutorials** from start to ✓, doing each step the way Kade
  would. This keeps the tutorials working as the app changes.
- **Coverage:** non-UI logic stays at or above the current thresholds.

---

## 3. Milestone 6 — Kade's Plugins

### 3.1 Shape library and plugin format

- **Kade's shape library** lives in browser storage next to designs.
  - Each entry has a stable id assigned by BloKade (Kade never types one), plus `name` and `code`.
  - Shapes can be saved to, and loaded from, a `.js` file.
- **What Kade writes** is plain JavaScript (no TypeScript):

  ```js
  export default {
    name: 'Robot head', icon: '🤖',
    settings: { size: { type: 'mm', default: 20, label: 'Size' } },
    build({ size }, cad) {
      return cad.box(size, size, size).cut(cad.cylinder(6, size + 2).move(0, 0, -1))
    },
  }
  ```

  - `settings` is the beginner name for `params`; both are accepted.
  - `id` and `version` come from the library; the cache key uses a hash of the code.
- **The combined shape list** puts built-ins first, then the `plugins/` folder, then Kade's library, then
  shapes carried by the open design.
  - It replaces today's fixed registry for the palette, Properties panel, size handles and field normaliser.
  - Kade's shapes appear in a **My shapes** palette section.
- **Designs carry their shapes (schema v4).**
  - A design stores `plugins: { [id]: { name, code } }` for each of Kade's shapes it uses.
  - Adding one of Kade's shapes to a design copies its current code in.
  - When the library has a different version of a shape a design carries, a notice offers **Use my newest
    version**, which counts as one undo step.
  - v3 designs migrate by adding `plugins: {}`.
  - The design file format carries the same field.

### 3.2 Running Kade's code

- **Kade's code runs only in the geometry worker.** The worker loads it as a module (from a blob URL), checks
  it, and reports back `{ name, icon, settings, size?, mode?, palette? }` or a friendly problem.
  - The page never evaluates Kade's code.
  - The page's shape list holds that metadata, plus a build that calls the worker.
- **Runaway code** (an endless loop) is caught by the existing 30 s worker restart. The shape then shows
  "This shape took too long to build. Check for a loop that never ends."
- **Plugins are trusted household code** (main spec §5), so the worker boundary is the only sandbox.
  - Formulas are unaffected and keep their own no-`eval` parser.
  - `new Function` and `eval` stay banned in BloKade's own code; a blob-module import is the one sanctioned
    way to run Kade's code.

### 3.3 The friendly `cad` toolkit

- **Parts are never changed in place.** Every command returns a new part.
  - Each build tracks every shape it makes and frees all of them except the result, so Kade never sees
    `delete()`.
  - Built-in shapes keep the current internal toolkit. Kade's library shapes and `plugins/` folder files get
    this one.
- **Starting parts:** `box(width, depth, height)`, `cylinder(diameter, height)`, `sphere(diameter)`,
  `cone(bottomDiameter, topDiameter, height)`, `ring(outerDiameter, thickness)`, `wedge(width, depth, height)`
  and `text('Hi', size, depth)`. Each is centred on X/Y and sits on the ground.
- **Flat outlines:** `rect(width, depth)`, `circle(diameter)` and `polygon([[x, y], …])`. An outline becomes a
  part with `.extrude(height)` or `.spin()`, which revolves it around the up axis.
- **Part steps:** `.move(x, y, z)`, `.rotate('x' | 'y' | 'z', degrees)`, `.add(other)`, `.cut(other)`,
  `.overlap(other)`, `.mirror('x' | 'y' | 'z')` and `.copy()`.
- **Helpers:**
  - `cad.repeat(count, (i) => part)` adds up copies, up to 200;
  - `cad.angle(i, count)` gives `360 * i / count`;
  - `cad.sin(degrees)` and `cad.cos(degrees)`.
- **Errors in plain English.**
  - Every command checks its inputs. Examples: "cad.box needs 3 sizes, like cad.box(20, 10, 5)" and "Sizes
    must be bigger than 0 — width was -3".
  - Sizes are capped at the existing 2000 mm.
  - Common JavaScript errors are translated, with line numbers. For example: "Line 4: there's nothing called
    "widht" — check the spelling."
  - A `build` that doesn't return a part says "build() needs to end with return and a part, like return
    cad.box(10, 10, 10)."
- **Settings types:** `mm`, `whole`, `number`, `angle`, `text` and `choice`, plus the new `yesno` (a checkbox
  that `build` receives as `true` or `false`). `yesno` is also available to built-ins.

### 3.4 The My shapes editor, lessons and reference

- **Getting there:** **🧩 My shapes** in the top bar switches the left and centre panes to the editor.
  **⬅ Back to my design** returns, and the design is unchanged.
- **Left:** the library, with **+ New shape**, **Duplicate**, **Delete** (asks first), **Save to file** and
  **Load from file**. The tabs are **📘 Lessons** and **❓ Commands**.
- **Centre:** the CodeMirror code box, with the error list under it. Clicking an error jumps to its line. Code
  autosaves to the library as Kade types.
- **Right:** a live preview of the shape, rebuilt about 500 ms after typing stops. The shape's settings appear
  as normal Properties fields to try out. **Add to my design** puts the shape in the current design.
- **Coding lessons** reuse Milestone 5's lesson panel and ✓ progress. Each lesson loads its starter code as
  a new shape and has 2–3 "Try this" challenges; a step is done when the shape builds and matches a check
  (for example "it is taller than 20 mm").
  1. **Numbers:** change the numbers in `return cad.box(20, 10, 5)`.
  2. **Names for numbers (variables):** `const width = 30`.
  3. **Doing it again (functions):** write a `post(x)` function and use it twice.
  4. **Reading error messages:** fix three small broken programs.
  5. **Your first shape:** a shape of your own from a box.
  6. **Settings:** make the size a setting so it appears in Properties.
  7. **Add and cut:** stick parts together and drill a hole.
  8. **Move and turn:** place parts with `move` and `rotate`.
  9. **Outlines:** draw a flat shape with `polygon` and push it up with `extrude`.
  10. **Repeat:** use `cad.repeat` to make a gear's teeth. This ends at the finished gear.
- **❓ Commands:** every `cad` command with a one-line description and a tiny example. It is generated from
  the same list the toolkit is built from, so the two can't drift.
- **Gear example:** a ready-made **⚙️ Gear** (teeth, size, thickness, hole) built only from the commands
  above. **Use as a starting point** copies it into Kade's shapes.

### 3.5 Testing (Milestone 6)

- **Unit tests:**
  - every toolkit command (normal use, bad inputs, and that no shape is leaked);
  - the error translation (syntax errors, a misspelt name, a missing return);
  - the library store;
  - the v3 → v4 migration;
  - the "newest version" swap as one undo step.
- **Worker tests:**
  - loading good and bad code;
  - metadata extraction;
  - a runaway loop is caught;
  - a design carrying a shape builds in a fresh worker with an empty library.
- **End-to-end tests:**
  - write a shape in the editor, see the preview, add it to a design, export;
  - open that design file in a fresh browser profile and it still builds;
  - finish lesson 1.

---

## 4. Changes to the main spec

- §9 Milestones: Milestone 5 becomes **Learn BloKade**, and **Kade's Plugins** becomes Milestone 6, as
  described here.
- §5 Plugin System: Kade's plugins are written in the in-app editor and carried by designs (§3.1). The `cad`
  toolkit surface is §3.3, which replaces the "Initial surface" list.
- §3 Design Document Model: schema v4 adds `plugins` (Milestone 6 only).
