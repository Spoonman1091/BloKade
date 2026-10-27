# Put on plate and Print checks: design

**Date:** 2026-10-27
**Status:** Draft for review
**Builds on:** the printer plate (`src/printers/`, `src/viewport/PrinterPlate.tsx`, `src/viewport/usePlateFit.ts`)

## Why

Kade (11) designs in BloKade and prints on a Bambu Lab A1 mini. The printer plate already turns parts red when they
don't fit. Two gaps remain between "it looks right on screen" and "it prints":

1. Parts that sit in mid-air or hang off the plate have to be fixed by typing positions. A single button should fix it.
2. Some designs fit the plate but still print badly: steep overhangs that need supports, walls too thin for a 0.4 mm
   nozzle, and pieces that float above the plate and fall into spaghetti. Kade finds out after an hour of printing.
   BloKade should say so before export, in words an 11-year-old understands, and show where.

The user chose these two from a list of ideas and asked for the design without further questions, so everything
marked **(my call)** below is a default chosen by the designer, open to change in review.

## Goals

- **Put on plate:** one click puts the selected parts on the plate: down onto the floor and, with a printer picked,
  back inside the plate's edges. One undo step.
- **Print checks:** one click checks what would actually be exported and lists three kinds of problems, each with a
  plain-language fix and the problem area highlighted in the 3D view:
  - **Floating pieces**: a separate piece whose bottom is above the plate.
  - **Overhangs**: downward-facing surfaces too steep to print without supports.
  - **Thin walls**: places thinner than the printer can make reliably.
- Both work with "No printer" too (see the rules below).

## Non-goals

- Arranging parts so they don't overlap each other (that's a separate "Arrange on plate" idea).
- Rotating parts to lay them flat, or auto-adding supports or chamfers. The checks advise; Kade decides.
- Slicer-grade analysis (bridges, first-layer area, warping, print time). The checks catch the common beginner
  failures, not everything.
- Blocking export. Like the plate warning, checks never stop saving or exporting.

## Anti-goals (would make this a failure even if it works)

- **Nagging.** A sphere or a round-edged box must not light up as a problem every time. Small overhangs that print
  fine are not reported (thresholds below). If most normal designs fail the check, it has failed.
- **Jargon.** No "manifold", "normals", "degrees from vertical" in the text Kade sees.
- **Freezing the app.** The check runs in the geometry worker, never on the main thread.
- **Moving parts Kade didn't pick.** Put on plate touches only the selection.

## Part 1: Put on plate

### Where

- A **⬇ Put on plate** button in the Properties panel, in the Line up area (`src/ui/AlignTools.tsx`), shown whenever
  one or more parts are selected (Line up needs two; this needs one). **(my call)**
- Keyboard: **D** (TinkerCAD's "drop" key, so it's familiar), added to the README shortcut table and to the shortcut
  hints Kade already sees. **(my call)** Plain `D` is free in `src/app/shortcuts.ts` (`PLAIN`); Ctrl/Cmd + D stays
  Duplicate.
- The red fit-warning bar (`viewport-warning`) gets a **Put on plate** button when at least one misfit is off the
  plate. It acts on all parts that are off the plate, not on the selection. **(my call)**

### What it does

For each selected part (a selected child inside a group counts as its whole top-level group, as export does via
`rootAncestorOf`; duplicates collapse):

1. **Drop:** move it down or up so its lowest point is at z = 0. Each part drops on its own (parts stacked on each
   other separate if Kade selects both; that matches TinkerCAD). **(my call)**
2. **Pull inside** (only when a printer is picked): if the part's footprint pokes past an edge of the plate, move it
   the shortest distance in x and/or y so it's inside. If it is wider (or deeper) than the plate, centre it on that
   axis instead; it stays red because it still doesn't fit.
3. Nothing rotates or changes size.

Rules:

- Uses the world boxes of the meshes on screen (`topLevelBoxes`), like Line up does.
- Holes are moved too if selected; they're parts Kade can place.
- Hidden parts and parts with no mesh yet are skipped.
- The whole action is **one** undo step and goes through the store's `apply`, so it gets the same notices on failure.
- If nothing would move, the document doesn't change (no empty undo step).
- With no selection the button is disabled, and `D` does nothing.

### Code shape

- A pure function in `src/document/` (next to `align.ts`), e.g.
  `putOnPlate(doc, boxes, ids, printer | null): BloKadeDocument`, unit-tested with plain boxes.
- A small `app/` wrapper like `alignSelection` that reads boxes and calls `apply`.
- Positions are tidied the same way `align.ts` does (round to 1e-6, no `-0`).

## Part 2: Print checks

### Where and when

- A **🔍 Check print** button next to the Printer picker in the toolbar. **(my call)** On-demand rather than
  always-on, because the thin-wall check is too slow to run on every edit, and so the overhang marks don't nag while
  Kade is still building. This mirrors the existing **Check overlap** tool.
- It checks what **Export** would export now: the visible solid top-level parts, fused, as in `exportShape` in
  `src/geometry/api.ts`. Loose top-level holes are left out, as they are in export.
- The result shows in a **Print check** panel (or a section above the Properties panel) and stays visible only while
  the design is exactly the one that was checked, following `visibleOverlap` in `src/store/overlap.ts`. Any edit
  hides it; Kade presses the button again.
- While it runs, the button says "Checking…" and is disabled.

### Thresholds

Defaults are for the A1 mini's 0.4 mm nozzle and apply to every printer in the list (all ship with 0.4 mm nozzles).
They live in one constants block. **(my call, all of them)**

| Check | Reported when |
|---|---|
| Floating piece | a separate solid piece's lowest point is more than 0.05 mm above the lowest point of the whole export |
| Overhang | a surface faces down at more than 45° from upright (normal's z < −cos 45°), is not touching the plate (lowest point + 0.05 mm), and those surfaces add up to at least 4 mm² for the whole design |
| Thin wall | a spot where the solid is less than 0.8 mm thick, measured straight in from the surface; spots under 0.4 mm are "very thin" |

The 4 mm² floor stops a round box's lower edge or a sphere's bottom cap from being reported. The builder should
check this against the default shapes (box with rounded edges, sphere, cone, ring, text) and tune the floor so none
of them is reported when sitting on the plate, while a T-shape's arms still are.

### How each check works (inside the geometry worker)

A new worker call, e.g. `printCheck(doc): Promise<PrintCheckResult>`, alongside `overlap`.

1. **Build** the fused export shape (reuse `exportShape`). No solid parts → result "nothing to check".
2. **Floating pieces:** split the fused shape into its separate solids. Any solid whose lowest point is above the
   export's lowest point (by more than 0.05 mm) is floating. Two parts that touch fuse into one solid, so a lid
   resting on a box is not floating.
3. **Overhangs:** tessellate at export quality. Mark each triangle facing down beyond 45°, skipping triangles at the
   plate. Sum their areas.
4. **Thin walls:** from each triangle's centre, cast a ray straight inward (against its normal) and find the nearest
   other surface it hits. Distance under 0.8 mm marks the triangle. Use a spatial index (a simple grid or BVH) so it
   stays fast. Performance budget: under 2 s for a 20,000-triangle export on a laptop; if it runs past 5 s, stop the
   thin-wall part and report "Couldn't finish the thin-wall check; the design is very detailed." The other checks
   still show.
5. Return, in world coordinates: per kind, whether found, a count or area, and a mesh of the marked triangles (or the
   floating solids) for highlighting.

All three checks report on the export as a whole, not per part, because the export is one fused object. **(my call)**

### What Kade sees

The panel lists only what was found, worst first (floating, thin, overhang), each with a colour swatch matching its
highlight. Proposed wording:

- **Floating:** "**1 piece is floating** above the plate. It would print in mid-air and fall over. Move it down so it
  touches the plate or another part." (plural: "**3 pieces are floating**…")
- **Thin walls:** "**Some walls are very thin** (less than 0.8 mm). They may print broken or not at all. Make them
  thicker." When anything is under 0.4 mm: "…(some are less than 0.4 mm, too thin to print)…"
- **Overhangs:** "**Some parts hang over empty space** (shown in orange). They need supports: turn on **Supports** in
  Bambu Studio, or turn the part so it rests on a flat side, or give the underside a slope."
- **All clear:** "✅ Looks ready to print on the {printer name}." With No printer: "✅ Looks ready to print."

The {printer name} text uses the picked printer. Plate fit is not repeated here; the red bar already covers it.

### Highlights in the 3D view

While the result is visible, draw the marked areas over the parts, like the overlap check's red volume:

- Floating pieces: purple (a new colour, so it doesn't clash with plate-red or overhang-orange).
- Thin walls: yellow.
- Overhangs: orange.

Exact colours are the builder's call as long as the three are clearly different from each other, from the misfit
red, and from the selection colour. Highlights don't take clicks (`raycast={() => null}`).

### Errors

- The worker call never throws to the UI: a failure becomes "Couldn't check this design. Try again, or export it and
  check it in Bambu Studio." and the unexpected error is logged, as `overlap` does.
- A build error in a part (red "can't build" state) → "Fix the part that can't build first, then check again."

## Help, README, tests

- Help entries (the help coverage test requires them) for: the Put on plate button, the Check print button, the
  Print check panel, and the warning bar's Put on plate button.
- README: Put on plate under the features list, **D** in the shortcut table, and a short "Check print" paragraph
  near the printer line.
- Unit tests:
  - `putOnPlate`: drop up and down, pull in from each edge, centre when too big, no printer = drop only, groups and
    selected children, holes, hidden parts skipped, nothing moves = same document.
  - Print check geometry, with real shapes in the worker test setup: a box (all clear), a box floating 5 mm up
    (floating), two touching boxes (not floating), a T-shape (overhang), a sphere and a rounded box on the plate (no
    overhang), a 0.5 mm-thick plate (thin) and a 0.3 mm one (very thin).
  - Message wording, including plurals and the No printer case.
  - The result hides after an edit.
- E2E: add a box, raise it, Check print shows "floating"; press Put on plate; Check print shows all clear. And the
  warning bar's Put on plate button brings an off-plate part back.

## Left to the builder

- Exact layout of the Print check panel and the colours (within the rules above).
- The spatial index for the thin-wall rays, and tessellation details.
- Whether the panel lives in the left column or above Properties.
- File layout, as long as files stay small and match the surrounding code.
