# BloKade — STL Import Design Spec

**Date:** 2026-10-22
**Authors:** Larry & Kade (with Claude)
**Status:** Draft for review
**Builds on:** `docs/superpowers/specs/2026-10-11-blokade-design.md` (the main spec) and
`docs/superpowers/specs/2026-10-12-blokade-face-handles-design.md`. Everything there still applies unless this
document changes it.

Larry asked for this design without a question round, so the decisions below are Claude's calls unless marked
otherwise. Each one says why, so it can be challenged in review.

## 1. Purpose

Today BloKade can only open its own `.blokade` design files and Kade's `.js` shape code. Kade wants to bring in
models made somewhere else, mainly STL files from Thingiverse or exported from TinkerCAD, and keep working on them
in BloKade.

An imported model becomes an ordinary part. Kade can:

- move it, turn it and size it, with the handles and the properties panel, like any other part;
- make it a **hole**, or group it with a hole to cut part of it away (the L-shape trick from the face-handles work);
- copy it, repeat it, mirror it and group it;
- save it in the design, undo it, and export it for printing with the rest of the design.

### Success criteria

- Kade imports a typical Thingiverse STL, puts a hole through it, and exports the result for printing, without
  help.
- Saving the design and opening it on another computer brings the model with it.
- A file that can't be used (wrong type, broken, empty) gets a short, friendly message, and the design is
  untouched.

### Goals

- STL in, both binary and text (ASCII) STL.
- The imported part behaves like a box wherever that is possible (see §5 for where it can't).
- Designs stay self-contained: the model's triangles are stored in the design.

### Non-goals (not in this version)

- Other formats: OBJ, 3MF, STEP, SVG. STL is what Thingiverse and TinkerCAD both give out.
- Editing the triangles themselves. An imported model can't be reshaped the way a box's settings reshape it.
- Rounded or bevelled edges (fillet, chamfer) on imported models.
- Fixing broken meshes (holes in the surface, flipped triangles) beyond what the engine does on its own.
- A shared model library across designs. Each design carries its own copy.

### Anti-goals (would make this a failure even if it "works")

- Freezing the app. Importing a big file or cutting a hole in an imported model must not lock the page for more
  than a few seconds; the 3D view and buttons keep responding while the geometry worker works.
- Losing the model. A saved design must never come back with the imported part missing or empty.
- Scary errors. No stack traces, no "invalid manifold" jargon; every message is in Kade's words.

## 2. How the model fits into the geometry engine (Claude's call)

BloKade builds every part with OpenCascade (through replicad) in a web worker, and does holes and groups as
OpenCascade boolean operations. An imported model goes through the **same** engine:

- The STL's triangles become an OpenCascade solid made of flat triangular faces, the way replicad's `importSTL`
  does it (read the triangles, merge flat neighbours with `ShapeUpgrade_UnifySameDomain`, build a solid).
- From then on it is just another solid: placement, holes, groups, copies, mirror, the overlap check and export
  all work unchanged.

**Why this and not a mesh engine.** Replicad also offers Manifold, a mesh engine with fast, robust cuts. Using it
would mean a second engine (another download on top of the 23 MB one), and every step that builds, cuts or exports
would need to handle two kinds of shape. That is a much bigger change for one feature. The cost of staying in
OpenCascade is speed with detailed models, which §3's triangle limit handles.

## 3. Importing a file

### Where Kade starts

- A new **📥 Import STL** button in the **Shapes** panel of the palette (left side), after the built-in shapes.
- Dropping an `.stl` file onto the 3D view does the same thing.

### The import dialog

After Kade picks a file, a small dialog shows:

- the file's name;
- its size in mm (width × depth × height), worked out from the file, assuming mm;
- **Units:** mm (default), cm, or inches. Changing the units updates the size shown. STL files have no units, and
  some sites use cm or inches, so this is the only way to get the size right. (TinkerCAD asks the same question.)
- If the model had to be simplified (below), one line saying so: "This model was very detailed, so BloKade
  simplified it to 20,000 triangles. It will look a little smoother."
- If the model has gaps in its surface (below), one line saying so.
- **Import** and **Cancel**.

### Checks, in this order

1. **Too big a file.** Over 50 MB: refuse before reading it. "This file is too big for BloKade (over 50 MB)."
2. **Not an STL, or unreadable.** "BloKade couldn't read this file. Is it an STL?"
3. **No triangles.** "This file has no shape in it."
4. **Too detailed.** More triangles than the limit (`MAX_IMPORT_TRIANGLES`): simplify it down to the limit and say
   so in the dialog.
   - The limit starts at **20,000** and is set for real by a timing check in the plan's first task: cutting one
     cylinder hole through an imported model at the limit should take under about 3 seconds on Larry's machine.
   - Simplifying uses a mesh simplifier library (Claude's pick: `meshoptimizer`'s simplifier, which is small and
     MIT-licensed; the builder may pick another with the same job and licence).
5. **Gaps in the surface.** After welding matching corners together, every edge should belong to exactly two
   triangles. If not, import anyway and say in the dialog: "This model has gaps in its surface, so holes might not
   cut it properly." The part shows a build problem the normal way if a cut then fails.
6. **Too large in mm.** If any size after the units choice is over the largest part size (2000 mm), the
   **Import** button stays off and the dialog says "This is bigger than BloKade allows (2000 mm). Try another
   unit."

### Where it lands

- The new part is called after the file (without `.stl`), sits on the floor (its bottom at height 0), and is
  centred on the middle of the grid, like other new parts.
- It starts as a **solid**, selected, with the colour new parts get.
- Importing is one undo step.

## 4. How it is stored

### In the document

- The document gains a `models` map, next to `plugins` (the carried copies of Kade's shapes). Each entry is an
  imported model: an id, the file name, and the triangles as welded vertices plus triangle indices, stored as
  base64 text so the design still saves as JSON.
- The model's vertices are stored already converted to mm and moved so the model is centred on x and y and sits
  on z = 0, the same way every built-in shape is built.
- A model's id is a hash of its triangles, so importing the same file twice stores it once.
- The part is a normal shape node with `shapeType: 'imported'` and these settings:
  - `model`: the model's id (text). Not shown in the properties panel.
  - `width`, `depth`, `height`: its size in mm, starting at the model's own size. These show in the properties
    panel like a box's, can be typed or set with formulas, and are what the size handles change
    (`size: { x: 'width', y: 'depth', z: 'height' }`).
- The part is built by scaling the stored model to `width × depth × height` (each axis on its own, so it can be
  stretched).
- The document's schema version goes up by one, with a migration that adds an empty `models` map to older designs.

### Copies and cleanup

- **Duplicate**, copy-paste and patterns reuse the same model id; the triangles are stored once.
- A model no longer used by any part is dropped when the design is saved (autosave and **Save to file**). Undo
  within the same session still works, because the undo history keeps its own copies of the document.

### Size budget

At 20,000 triangles a model is roughly 0.5 MB of base64 text. That is fine for the browser's design storage and
for design files. The builder should check that autosave and the worker's build messages stay quick with three
models of that size in one design.

## 5. How an imported part behaves

| Feature | Imported part |
|---|---|
| Move, rotate, align | Same as any part |
| Size handles, typing sizes, formulas | Same as a box: width, depth and height |
| Solid / hole, groups | Same as any part |
| Repeat (linear, circular), mirror | Same as any part |
| Round edges, bevel (fillet, chamfer) | Not offered: the buttons don't show for imported parts |
| Edge lines in the 3D view | Not drawn for every triangle (see below) |
| Overlap check, export STL / 3MF | Same as any part |
| Help mode, tooltips | The new controls have help texts |

**Edge lines.** BloKade draws a part's edges as dark lines. An imported model would show every triangle edge,
which looks like a wireframe. Imported parts draw only sharp edges, where the two faces meet at more than about
30° (Claude's call; the builder may tune the angle).

## 6. Help and learning

- Help texts for **📥 Import STL**, the import dialog's controls, and the units choice.
- The `mode-hole` help card already explains cutting a part away with a hole; nothing new is needed there.
- No new lesson in this version. The README gains a short "Importing models" section: where to find STL files,
  the units question, and that very detailed models get simplified.

## 7. Testing

- **Unit tests:**
  - parsing binary and ASCII STL;
  - welding and the gap check;
  - simplifying to the limit;
  - the units conversion and the 2000 mm limit;
  - storing and reading back the model;
  - the schema migration;
  - dropping unused models on save, but keeping them while any part uses them.
- **Geometry tests (worker, like the existing ones):**
  - an imported cube builds to the right size;
  - a cylinder hole cuts through it;
  - stretching width changes only x;
  - it exports to STL.
- **End to end (Playwright):**
  - import a small STL from a test fixture, resize it with a handle, make a hole through it, then undo;
  - import a broken file and see the message;
  - save to file, load it in a new page, and the model is still there.
- **The timing check** in §3 is a one-off measurement recorded in the plan, not a test that runs every time.

## 8. Left to the builder

- Exactly where the import dialog sits on screen and how it looks, following the existing dialogs
  (`DesignsDialog`).
- How the worker gets the model's triangles (inside the document it already receives, or a separate cache keyed
  by model id), as long as unchanged models aren't rebuilt.
- The final triangle limit (from the timing check) and the sharp-edge angle.
- The simplifier library, within the limits in §3.
