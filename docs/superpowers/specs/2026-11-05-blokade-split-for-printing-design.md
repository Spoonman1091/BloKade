# Split for printing: design

**Date:** 2026-11-05
**Status:** Draft for review
**Builds on:** STL reading (`src/import/stl.ts`, `src/import/prepare.ts`), the printer list and picker
(`src/printers/`), the Fit gap idea, the My shapes screen pattern (`src/ui/MyShapesScreen.tsx`)

## Why

Kade (11) and their parent want to print a Punisher chest plate: a flat 10 × 12 in (254 × 305 mm) plate, about
¼ in (6.4 mm) thick, with the skull raised on top. It comes as an STL from elsewhere. The printer is a Bambu Lab A1
mini, whose plate is 180 × 180 mm, so the plate has to be printed in pieces that join back together.

Importing the STL into a BloKade design doesn't work for this. Imports are simplified to 5,000 triangles so the
designer stays fast, and a detailed skull would lose its sharp edges. The user chose a **separate tool** that works on
the original file at full detail and saves the pieces as STL files ready to print.

The user asked for the design without further questions, so everything marked **(my call)** is a default chosen by the
designer, open to change in review.

## Goals

- Open an STL at **full detail** (no simplifying), up to BloKade's existing 50 MB file limit.
- Work out the **fewest pieces** that fit the chosen printer, place the cuts **where they cross the least raised
  detail**, and let the user move a cut before going ahead.
- Add **joints** along every cut so the printed pieces fit together, made a little looser by a **Fit gap**.
- Make every piece **print without supports**, lying flat as it already is.
- **Number** every piece and show a map of how they go together.
- Save the pieces as **one STL per piece**, in a single ZIP download.

## Non-goals

- Repairing broken STL files (gaps, flipped faces). If the model isn't watertight, say so and point to Bambu Studio's
  Repair.
- Curved or non-flat models (a curved breastplate). The tool works on models with a flat bottom; anything else gets
  straight cuts with no joints, and a note (see "When there's no flat base").
- Putting the pieces back into a BloKade design, or editing the model.
- Glue tabs, keys, or alignment pins beyond the joint styles below.
- Arranging the pieces onto print plates. Each STL is one print.

## Anti-goals (would make this a failure even if it works)

- **Losing detail.** The pieces must be the original model's triangles, cut, never simplified.
- **Joints that need supports or print badly.** In particular, no part of the raised image may end up hanging over an
  empty pocket (see "Where joints go").
- **Pieces that don't fit the plate** or **don't fit together.**
- **Freezing the app.** All the heavy work runs in a worker, with progress and a Cancel button.
- **Jargon.** Plain words: "pieces", "cuts", "joints", "Fit gap".

## Where it lives

- A **✂ Split for printing** button in the top bar opens its own screen, the way 🛠️ My shapes does, with
  **⬅ Back to my design**. The current design is untouched. **(my call)**
- The screen has: a 3D view of the model sitting on the printer plate outline, the settings on the right, and the steps
  as buttons: **Open STL…**, then **Make pieces**, then **Save pieces**.

## How it works

### 1. Open the STL

- Read it with the existing STL reader (binary and ASCII), weld the corners, and keep every triangle.
- Units: the same unit choice as the importer's Import dialog (`src/ui/ImportDialog.tsx`: mm, inches, …); a model over 2000 mm gives the importer's existing message.
- Put it flat on the plate: lowest point at z = 0, centred on x and y. Don't rotate it (the user's file already lies
  the way they want). **(my call)**
- If the mesh isn't watertight even after welding: "This model has gaps in its surface, so it can't be cut cleanly.
  Open it in Bambu Studio, use Repair, save it, and try again."
- Show the size ("254 × 305 × 12 mm, 812,000 triangles").

### 2. Plan the pieces

**Printer:** the one picked in the toolbar (the A1 mini by default). With "No printer" picked, the tool asks for one.

**Grid:** the fewest pieces in a grid of columns × rows such that every piece, with its joints and a 5 mm safety
margin, fits the printer's plate. Try the model as it is and turned 90° on the plate, and pieces may be turned 90° on
their own plate too. For the chest plate on the A1 mini this is 2 × 2. **(my call: grid cuts only, straight lines
parallel to x or y.)**

**Base thickness:** detected from the model: the highest height at which a horizontal slice still covers at least 95 %
of the slice just above the bottom. For the chest plate that's about 6.4 mm. Shown in the settings and editable.
**(my call: 95 %.)**

**Where the cuts go:** each cut has a window of positions that keep every piece within the plate. Inside that window,
pick the position that crosses the least raised detail, measured as the length of the cut line that runs through
anything above the base, with a small preference for pieces of even size. Score candidate positions every 1 mm.
**(my call)**

**The user can move a cut:** drag its line in the 3D view, within its window (the window is shaded). The pieces'
sizes and whether they fit update live.

### 3. Joints

Settings:
- **Joint style:** **Jigsaw tabs** (default), **Tongue and groove**, or **None (glue only)**. **(my call)**
- **Fit gap:** 0.2 mm by default (the same default as BloKade's Fit gap), editable.

**Where joints go.** A joint sits in the base only, from z = 0 up to the base thickness. It may only go on stretches
of a cut that cross **bare base** (nothing raised above the base within the joint's reach of the line). Along stretches
where the raised image crosses the cut, the cut is straight and full height, so the image lines up exactly and nothing
is left hanging over a pocket. If a cut has no bare stretch long enough for one joint, it falls back to a straight
cut and the map marks it "glue here".

**Jigsaw tabs:** a dovetail-shaped tab (wider at the tip than at the neck, so it can't pull straight out), about
10 mm long and 10 mm wide at the tip, every 40–50 mm along each bare stretch, alternating which piece the tab
belongs to. The pocket in the other piece is the same shape grown by the Fit gap on every side. Tabs go through the
whole base thickness, so they print with no overhang. **(my call: sizes)**

**Tongue and groove:** a continuous tongue along each bare stretch, one third of the base thickness tall, centred in
the base, sticking out 3 mm; the groove is the same grown by the Fit gap. It needs a base of at least 4 mm; below that
the option is greyed out with "The base is too thin for a tongue." The tongue's underside is a short 3 mm overhang,
which prints fine without supports.

### 4. Make pieces

- Cut the model along every cut, then add each tab or tongue to one piece and subtract the grown pocket or groove from
  the other.
- **Number** each piece on its **underside**: the number engraved 0.6 mm deep, mirrored so it reads correctly when the
  piece is turned over, placed in bare base away from the joints. On by default, can be turned off. **(my call)**
- Check every piece: watertight, fits the plate with its 5 mm margin. A piece that doesn't fit shows red, like the
  designer's misfits, and Save is disabled with the reason.
- The 3D view shows the pieces spread slightly apart with their numbers, plus a small **map**: the grid with piece
  numbers and any "glue here" cuts.

### 5. Save pieces

- One ZIP named after the model, e.g. `punisher-chest-plate-pieces.zip`, holding `punisher-chest-plate-1.stl` …
  `-4.stl` (binary STL, mm), each piece lying flat at z = 0 and centred, ready to open in Bambu Studio as its own
  print.

### When there's no flat base

If no base is detected (the 95 % rule never holds, e.g. a curved or open shape), joints are turned off, the cuts are
straight and full height, and the screen says "This model doesn't have a flat base, so the pieces get straight cuts.
Glue them together."

## Technology

- **Mesh cutting:** [Manifold](https://github.com/elalish/manifold) (`manifold-3d` on npm, WebAssembly, Apache-2.0).
  It's built for fast, reliable boolean operations on big triangle meshes, which OpenCascade (used by the designer)
  is too slow for at this size. It runs in its **own worker** (Comlink, like the geometry worker), loaded only when the
  Split screen opens, so the designer's start-up isn't slowed down. **(my call)**
- **ZIP:** a small zip library such as `fflate` (builder's call).
- Pin exact versions in `package.json` like the existing dependencies, and make sure the WebAssembly file is served
  by both the GitHub Pages and Docker builds.

### Performance

- Target: a 1,000,000-triangle model split into 4 pieces with jigsaw tabs in under 30 s on a laptop, with a progress
  bar ("Cutting piece 2 of 4…") and Cancel.
- Opening a 50 MB file must not freeze the page; reading happens in the worker.

## Errors

All in plain words, never OpenCascade or Manifold text:
- Not an STL, too big a file, too large in size: the importer's existing messages.
- Gaps in the surface: the message in "Open the STL".
- No printer picked: "Pick your printer in the toolbar first, so BloKade knows how big the pieces can be."
- The model is too big even for many pieces (over 6 × 6): "This model would need more than 36 pieces. Try a bigger
  printer or scale it down first."
- Anything unexpected: "Couldn't split this model. Try again, or open it in Bambu Studio and use Cut there." The
  error is logged.

## Help, README, tests

- Help entries for every new control (the help coverage test requires them).
- README: a short "Split for printing" section.
- Unit tests, on small made-up meshes (a 254 × 305 × 6.4 plate with a raised block or two):
  - the grid: 2 × 2 on the A1 mini, 2 × 1 for a 300 × 150 plate, 1 piece when it fits, the 36-piece limit;
  - base thickness detection (6.4 for the test plate; "no base" for a sphere);
  - cut placement avoids a raised block when the window allows, and stays inside the window;
  - joints only on bare stretches; a cut fully under raised detail falls back to straight with "glue here";
  - fit: putting the pieces back in place, no two overlap (intersection volume ≈ 0), and together they make the
    original volume minus the Fit gap slivers (within a tolerance);
  - every piece is watertight and fits the plate with the margin;
  - tongue greyed out under a 4 mm base;
  - the ZIP has one STL per piece, named and numbered.
- A timing test with a ~1,000,000-triangle mesh against the 30 s target (skippable on slow CI, as the existing
  timing tests are).
- E2E: open a test STL, make pieces, the map shows 4 pieces, save, and the ZIP holds 4 STLs.

## Left to the builder

- Exact tab shape and spacing within the ranges above; the engraving font and size.
- How cut lines are dragged in the 3D view.
- How the worker reports progress and handles Cancel.
- File layout, as long as files stay small and match the surrounding code.
