# BloKade — Face Handles Design Spec

**Date:** 2026-10-12
**Authors:** Larry & Kade (with Claude)
**Status:** Draft for review
**Builds on:** `docs/superpowers/specs/2026-10-11-blokade-design.md` (the main spec) and
`docs/superpowers/specs/2026-10-12-blokade-learn-and-plugins-design.md`. Everything there still applies unless
this document changes it.

## 1. Purpose and decisions

Kade wants to resize a shape the way TinkerCAD does it: grab a handle on the shape and drag it. Today the
**⤢ Size** tool shows a three-axis scale gizmo in the middle of the shape, which stretches the shape evenly in
both directions. That isn't how Kade thinks about it, so they type numbers instead.

Decisions made while designing (with the reason):

- **Face handles replace the Size gizmo.** Pressing **S** or clicking **⤢ Size** shows the new handles instead
  of the gizmo. One way to resize, and it matches what Kade already knows from TinkerCAD.
- **TinkerCAD's handle set.** One handle on each side face, one on the top, and one on each bottom corner. The
  corners change width and depth together.
- **The opposite side stays put.** Dragging a face moves only that face. This is the whole point of the
  feature: Kade can stretch a box to touch another one without it also growing the other way.
- **Custom handles, not a bent gizmo.** BloKade draws and drags the handles itself, in the shape's own frame.
  Reusing three.js's `TransformControls` scale mode and moving the shape afterwards can't do one-sided corners
  or rotated shapes properly.

Also in scope, because Kade asked how to "use a block to delete part of another block": the **Holes and
groups** lesson and the hole help texts gain wording about cutting part of a shape away. The feature itself
already exists (Hole + Group).

### Success criteria

- Kade resizes shapes by dragging handles, without typing numbers, including stretching a box so it touches
  another one.
- Kade makes an L-shaped block on their own, using a hole and **Group**.

## 2. The handles

When exactly one top-level shape is selected and the tool is **Size**, the shape shows handles on its
**local bounding box**: the box around the shape in its own frame, before its rotation. The handles turn with
the shape, so on a tipped-over cylinder the "top" handle is on the cylinder's own top.

| Handle | Where | What it changes |
|---|---|---|
| Side handles (up to 4) | Centre of each side face: −x, +x, −y, +y | One size: the x or y size |
| Top handle (1) | Centre of the top face (+z) | The z size (height) |
| Corner handles (up to 4) | The four bottom corners | The x and y sizes together |

- **Which handles show.** A handle shows only when the axes it changes are linked to a size setting through the
  shape's `size` mapping (`plugin.size`). Examples:
  - **Box, wedge:** all nine.
  - **Screw hole, socket, threaded rod and threaded hole:** only the top handle (they map only `z`).
  - **Snap clip:** the ±y side handles and the top handle. It has no corners, because a corner needs both `x`
    and `y`.
  - **A shape with no `size` mapping, and any group:** no handles. This is the same rule as today's Size gizmo.
- **Kade's own shapes** from 🧩 My shapes get handles when their code sets `size`.
- **Look.** Small white cubes with a dark outline, as in TinkerCAD.
  - They stay the same size on screen at any zoom (about 10 px).
  - They draw on top of the shape, so a handle behind the shape can still be seen and grabbed.
  - The handle under the mouse turns the accent colour, and the cursor shows it can be dragged.
- **Tooltips.** Hovering a handle for half a second shows a tooltip with the existing `help-tooltip` look:
  - side handle: "Drag to change the width" (or "the depth");
  - top handle: "Drag to change the height";
  - corner handle: "Drag to change the width and depth. Hold Alt to keep the shape's proportions."

  The wording uses the size setting's own label when it has one, e.g. "Drag to change the Diameter".
- **Help mode.** Clicking a handle in ❓ help mode shows its help card and never starts a drag.

## 3. Dragging

- **Side and top handles.** The drag follows the handle's own direction only; moving the mouse sideways does
  nothing. The new size is the old size plus how far the handle moved. **The opposite face does not move.**
- **Corner handles.**
  - The corner follows the mouse across the shape's bottom plane, changing the x and y sizes together.
  - The opposite bottom corner stays put.
  - Holding **Alt** keeps the shape's proportions. All three sizes change by the same factor, and the opposite
    bottom corner still stays put.
- **Snapping.**
  - With snapping on (`gridSnap > 0`), each size changed by the drag snaps to a whole number of grid steps.
  - Holding **Shift** turns snapping off, as it does for moving today.
  - The rotate tool's 15° snap is not involved.
- **Smallest size.** A size can't go below one grid step, or 0.1 mm when snapping is off. Dragging a face past
  the opposite face doesn't flip the shape; it just stops at the smallest size.
- **Largest size.**
  - Each size setting keeps its own `max`.
  - When the drag reaches it, the size stops there, and the readout says so: "Biggest size: 500 mm".
- **Live view.**
  - While dragging, the shape's preview stretches straight away. This uses a temporary scale on the drawn
    mesh, as the gizmo does today.
  - The measurement overlay shows the size(s) being changed, e.g. "Width 42 mm" or
    "Width 42 mm × Depth 30 mm".
- **When the drag ends,** BloKade writes the new size settings and the shape's new position in **one** `apply`,
  so one undo step undoes the whole drag. A drag that changed nothing writes nothing.
- **Esc during a drag** cancels it: the shape goes back to how it was and nothing is written.

## 4. How a drag becomes settings

All of this lives in a small, pure module, `src/viewport/face-handles.ts`, so it can be unit tested without a
3D view.

- **Handles.** `handlesFor(plugin, localBox)` lists the handles for a shape. Each handle has an id (for example
  `x+`, `z+`, `corner-x-y+`), its position in local space, and the axes it changes.
- **Scale factors.** For a drag, BloKade works out a scale factor for each changed axis: the new size divided
  by the old local box size.
  - It then hands those factors to the existing `paramsFromScale(plugin, params, scale)`.
  - That function already turns per-axis scale into new settings. It also keeps the formulas of settings the
    drag didn't change.
- **Keeping the opposite face still.**
  - Size settings scale the shape about its local origin, so a local box `[min, max]` becomes
    `[s·min, s·max]`.
  - The opposite face sits at `min` when dragging `+`, or `max` when dragging `−`. It stays put if the shape
    moves, in local space, by `opposite · (1 − s)` along that axis.
  - That local shift is turned by the shape's rotation and added to its position.
- **Linked sizes.**
  - Some sizes share one setting, e.g. a cylinder's `diameter` covers x and y, and a sphere's `diameter`
    covers all three.
  - When a drag changes a shared setting, every axis linked to it grows by the same factor.
  - The opposite face stays put only along the dragged axis. The other linked axes grow evenly about the
    shape's local origin, which is what the setting itself does.
- **Formulas.** A size setting that was a formula (e.g. `wall * 2`) becomes a plain number when the drag
  changes it. This is the same as dragging today's gizmo. The properties panel already shows the new number.
- **Snapping to the grid.**
  - Snapping rounds the new size, not the mouse position.
  - When a shared setting is changed, the snapped value is the setting's value (e.g. the diameter).
- **Proportions with Alt.** Alt on a corner uses one factor for x, y and z: the larger of the x and y factors.
  When snapping is on, the snapped x size sets that factor.

## 5. Pieces

| Piece | Kind | Job |
|---|---|---|
| `src/viewport/face-handles.ts` | pure | `handlesFor`, `dragToScale` (handle + local drag distance + snapping/Alt/limits → per-axis scale), `anchorShift` (scale + local box + handle → position change). |
| `src/viewport/handle-drag.ts` | pure | Turns pointer rays into a local drag distance. A side or top handle uses the closest point on the handle's axis line. A corner uses the hit point on the local bottom plane. |
| `src/viewport/SizeHandles.tsx` | React/three | Draws the handles, handles hover, tooltips, pointer capture, the live preview scale, the measurement text and Esc. On release it commits one `apply`. |
| `src/viewport/TransformHandles.tsx` | changed | Size mode no longer renders `TransformControls`. It renders `SizeHandles` instead. Move and rotate are unchanged. |
| `src/viewport/sizing.ts` | reused | `paramsFromScale` stays as it is. |

- **While dragging:** camera orbit is turned off (OrbitControls disabled) and turned back on at the end, as
  `TransformControls` does today.
- **Clicks:** a click on a handle never changes the selection.

## 6. Learning and help

- **Move, turn and size** lesson, step `taller`. Its text becomes: "Make it taller: drag the white handle on
  top, or type **40** into **Height**." The check is unchanged (height > 20), so dragging or typing both work.
- **Holes and groups** lesson. The intro gains: "A hole is how you cut part of a shape away, like making an L
  from a block."
- **Hole help.** The `mode-hole` and `tree-mode` help cards gain one sentence: "To cut part of a shape away,
  put a hole where you want the gap, select both, and click **Group**."
- **Size help.** The `tool-size` help card becomes: "With Size on, drag a white handle on the part. The other
  side stays put. Drag a bottom corner to change width and depth together; hold Alt to keep the shape's
  proportions."
- **New help entries** for the handles (`size-handle`, `size-corner`) match the tooltips above.
- **README.** The keyboard table row for S becomes "Size handles (drag a face; the other side stays put)". The
  Alt-on-a-corner tip is added.

## 7. Testing

- **Unit tests (`face-handles`, `handle-drag`):**
  - every handle on a box;
  - top-only and y-only shapes;
  - linked sizes (cylinder, sphere);
  - a rotated shape, where the opposite face's world position is unchanged;
  - snapping on and off;
  - the smallest and largest sizes;
  - Alt proportions;
  - formulas surviving on settings the drag didn't change.
- **Component test (`SizeHandles`):**
  - the right handles render for a box, a cylinder and a group (none);
  - a simulated drag commits one `apply`, and undo restores the shape;
  - Esc cancels the drag;
  - help mode blocks the drag.
- **End to end (Playwright):**
  - add a box, pick **⤢ Size**, and drag the `+x` handle;
  - the width grows and the box's `−x` face hasn't moved;
  - one **Undo** restores it.
- **Existing tests:** the **Move, turn and size** lesson e2e still passes. It types the height, which is
  unchanged.

## 8. Not included

- Handles on groups or on several selected parts at once.
- A bottom handle or a "lift off the ground" handle (TinkerCAD's cone arrow). **Move** already does that.
- Resizing shapes that have no `size` mapping.
- Touch-screen dragging beyond what pointer events give for free.
