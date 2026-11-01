# More shapes: design

**Date:** 2026-11-01
**Status:** Draft for review
**Builds on:** the shape plugins (`src/plugins/builtin/`, `src/plugins/types.ts`), the cad toolkit
(`src/plugins/cad.ts`, `cad-types.ts`), the palette (`src/ui/ShapePalette.tsx`) and the drawn kit picture
(`src/ui/KitPicture.tsx`)

## Why

Kade (11) designs in BloKade and prints on a Bambu Lab A1 mini. BloKade has 7 everyday shapes (Box, Cylinder,
Sphere, Cone, Ring, Wedge, Text). TinkerCAD's Basic Shapes has ten more that kids reach for, and building them by
hand is slow or impossible: a tube is a cylinder minus a cylinder, a pyramid can't be made at all.

The user asked for TinkerCAD's ten missing basic shapes and for the design to be written without further questions,
so everything marked **(my call)** below is a default chosen by the designer, open to change in review.

## Goals

Ten new shapes, each added with one click and changed in Properties like the existing ones:

**Roof, Round roof, Tube, Half sphere, Pyramid, Polygon, Paraboloid, Star, Heart, Icosahedron.**

- They live in a **More shapes** section of the palette, so the everyday seven stay where Kade knows them.
- Each one prints well at its default size: Check print says "Looks ready to print" for every default shape on the
  plate.
- They behave like every other part: size handles, holes, groups, modifiers (round edges, patterns, mirror),
  formulas and variables, undo, export.

## Non-goals

- **Scribble** (drawing a shape with the mouse). It is a drawing tool, not a shape, and a separate project.
- TinkerCAD's other libraries (characters, connectors, electronics).
- Adding these shapes to the 🛠️ My shapes coding toolkit. Kade's code can already make most of them; a new code
  command can come later.
- A lesson for the new shapes.

## Anti-goals (would make this a failure even if it works)

- **A cluttered palette.** Fit tools must not get pushed off the bottom of a laptop screen. That is why the new
  shapes get their own section that can be closed.
- **Shapes that nag.** If Check print complains about a new shape at its default size, the shape is wrong, not the
  check.
- **Jargon.** Labels are words Kade knows ("Sides", "Points", "Wall thickness"), never "apothem" or "circumradius".
- **Breaking saved designs.** Existing shapes, their ids and their parameters do not change.

## Where they go

- A new **More shapes** section directly below **Shapes**, above **Fit tools**, with the same two-column grid.
  **(my call)**
- Its heading is a button that opens and closes it (▸ / ▾). It starts **open** on the first visit, so Kade sees the
  new shapes, and then remembers its state per browser, the same way the printer choice is remembered
  (`KeyValueStorage`, never throws when storage is unavailable). **(my call)**
- Order in the grid: Roof, Round roof, Tube, Half sphere, Pyramid, Polygon, Paraboloid, Star, Heart, Icosahedron
  (TinkerCAD's order, roughly). **(my call)**
- Plugins choose the section with `palette: 'more'`, a new value next to `'shapes' | 'fit' | 'hidden'`.

## The shapes

Every shape follows the existing rules: centred on X and Y, sitting on z = 0, sizes in mm, a `size` mapping for the
handles, and `alsoScales` for any parameter that should grow with a handle. Defaults are 20 mm like the existing
shapes, so a new shape is the size Kade expects. **(my call, all of the numbers)**

| Shape | Parameters (default) | Size handles | Notes |
|---|---|---|---|
| **Roof** | Length 20, Width 20, Height 20 | x Length, y Width, z Height | A triangle across X with its peak in the middle, pushed along Y (`extrudeSide`). |
| **Round roof** | Length 20, Width 20, Height 10 | x Length, y Width, z Height | Half a cylinder lying down: a half-circle (or half-oval when Height ≠ Width / 2) across X, pushed along Y. |
| **Tube** | Diameter 20, Height 20, Wall thickness 2 | x/y Diameter, z Height | A cylinder with a round hole straight through. Wall thickness 0.4 to just under half the diameter. |
| **Half sphere** | Diameter 20, Height 10 | x/y Diameter, z Height | Flat side down. Height ≠ Diameter / 2 makes a squashed or tall dome. |
| **Pyramid** | Width 20, Depth 20, Height 20 | x Width, y Depth, z Height | Rectangular base, one point on top. |
| **Polygon** | Sides 6 (3 to 12), Diameter 20, Height 10 | x/y Diameter, z Height | A flat-sided prism. Diameter is corner to corner. One flat side faces the front (−Y), so a hexagon tile lines up with the grid. |
| **Paraboloid** | Diameter 20, Height 20 | x/y Diameter, z Height | A rounded point on top, like a bullet tip. Radius at height z is R·√(1 − z/H). |
| **Star** | Points 5 (3 to 12), Diameter 20, Inner diameter 10, Height 5 | x/y Diameter, z Height | Flat star. `Inner diameter` (how deep the dents go) grows with the Diameter handle. One point faces the back (+Y), so it stands upright on screen. |
| **Heart** | Width 20, Length 18, Height 5 | x Width, y Length, z Height | Flat heart, point towards the front (−Y). |
| **Icosahedron** | Diameter 20 | x/y/z Diameter | The 20-sided die shape, lying on one **flat face** so it prints without supports. Diameter is corner to corner. |

Size limits: the same `min` the existing shapes use where one applies; whole-number parameters (Sides, Points) use
the `whole` type with the limits above.

Problems use plain words, for example "The wall is too thick for this tube. Make it less than 10 mm." or "The inner
diameter must be smaller than the diameter." They show as the usual red "can't build" state.

### How they're built (toolkit)

- **Roof, Round roof:** `extrudeSide`. The round roof's curve is a smooth arc if `profileDrawing` can draw one;
  otherwise a polyline fine enough that a 20 mm roof looks smooth (builder's call).
- **Tube:** cylinder minus cylinder, both centred, the hole a little taller than the tube so the cut is clean.
- **Half sphere, Paraboloid:** `revolve` of the outline. A smooth curve if possible; otherwise a polyline, as for the
  round roof.
- **Polygon, Star, Heart:** `prism` of the flat outline. The heart's two bumps are arcs (or a fine polyline).
- **Pyramid, Icosahedron:** a **new toolkit command** that turns flat triangles into a solid, e.g.
  `polyhedron(points, triangles)`, built on `meshSolid` (`src/geometry/mesh-solid.ts`), which already does this for
  imported STL files. Documented in `cad-types.ts` like the others. Not added to Kade's coding toolkit (non-goal).

## Pictures

The palette shows a small **drawing** of each new shape, in the style of the Peg & socket picture
(`KitPicture.tsx`), instead of an emoji. Emoji don't exist for most of these (pyramid, paraboloid, icosahedron,
round roof), and a set drawn the same way reads as one family. **(my call)**

- The drawing mechanism is widened from kits to shapes, keyed by id (e.g. a `PalettePicture` that knows kits and
  plugins), falling back to the emoji.
- Each plugin still has an emoji `icon`, used in the Parts list and anywhere text shows: Roof 🏠, Round roof 🌉,
  Tube 🧻, Half sphere 🌗, Pyramid 🗻, Polygon 🛑, Paraboloid 🥚, Star ⭐, Heart ❤️, Icosahedron 🎲. **(my call)**
  None of these is used by an existing shape.
- Drawings use fixed colours that read on both light and dark panels, like the peg picture.

## Help and README

- A help entry for each new shape (`add-<id>`), one line on what it is plus what it's good for, e.g. Tube: "A tube
  with a hole through it. Good for cups, pen holders and wheels." The help coverage test requires them.
- A help entry for the More shapes heading button.
- README: the new shapes in the shapes list.

## Tests

- **Each shape, with real geometry in the worker test setup:**
  - at defaults, its bounding box matches its parameters and it sits on z = 0, centred;
  - its volume matches the formula where there is one (tube, pyramid, paraboloid = ½πR²H, half sphere = ⅔πR²H,
    polygon, icosahedron), within a small tolerance for polylines;
  - a size handle changes the matching parameter, and `alsoScales` keeps the star's shape;
  - impossible sizes (tube wall too thick, star inner ≥ outer, sides < 3) give the plain-words problem.
- **No nagging:** every new shape at its default size, alone on the plate, passes Check print with no findings.
  If one fails, fix the shape's default or orientation, not the check's thresholds.
- **Palette:** the section lists the ten in order, opens and closes, remembers its state, and survives storage
  that throws.
- **Saved designs:** existing shape ids and parameters are unchanged (the existing tests cover this).
- **E2E:** add each new shape from More shapes and export an STL with triangles in it; close and reopen the section.

## Left to the builder

- Smooth arcs vs fine polylines for curved outlines, as long as defaults look smooth and pass Check print.
- The exact drawings.
- How the section's open/closed state is stored and its key name.
- The name and exact signature of the triangles-to-solid command.
- File layout: one file per shape in `src/plugins/builtin/`, matching the existing ones.
