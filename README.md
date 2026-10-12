# BloKade

Kade's 3D design app for 3D printing. It's as easy as TinkerCAD, and it's built so we can keep adding to it.

## Run it

**On the home server (Docker):**

```bash
docker compose up -d --build
```

Then open `http://<server-ip>:5233` (5233 spells KADE on a phone keypad) in a browser on any computer at home, using the server's IP address,
for example `http://192.168.1.50:5233`.

- **Change the port:** edit the number before the colon in `docker-compose.yml` (`"5233:80"`, for example
  `"9000:80"`), then run `docker compose up -d` again.
- **Stop it:** `docker compose down`
- **Update it:** `git pull`, then `docker compose up -d --build`

**Back up your designs.** Designs live in each browser, not on the server, so clearing the browser's data
deletes them. To keep a copy (or move a design to another computer), click the **📁** button with the
design's name in the toolbar, then **Save to file**. Use **Load from file** in the same window to bring it back.

**For development:**

```bash
npm install
npm run dev
```

## Test it

```bash
npm test              # unit + geometry tests
npm run coverage      # with coverage report (80% minimum)
npx playwright install chromium
npm run e2e           # end-to-end tests in a real browser
```

## Using BloKade

| Keys | What it does |
|---|---|
| M / R / S | Move / rotate / size handles |
| Shift (while dragging) | Turn snapping off |
| H | Switch between solid and hole |
| Ctrl/Cmd + G | Group (holes cut out of solids) |
| Ctrl/Cmd + Shift + G | Ungroup |
| Ctrl/Cmd + D | Duplicate |
| Delete | Delete |
| Ctrl/Cmd + Z / Shift + Z | Undo / redo |
| Esc | Deselect |

## How it's built

- `src/document`: the design "recipe" (shapes, groups, transforms) and immutable edits
- `src/plugins`: every shape is a plugin; the built-in ones are in `builtin/`
- `src/geometry`: the OpenCascade engine (in a Web Worker) that turns the recipe into solids, meshes, and STL/3MF files
- `src/viewport`: the 3D view (Three.js)
- `src/ui`, `src/app`: panels, toolbar, shortcuts, and wiring
- `src/persistence`: autosave, design files, and the designs list

Design spec: `docs/superpowers/specs/2026-10-11-blokade-design.md`.

## Making your own shapes

See [`plugins/README.md`](plugins/README.md). The full plugin guide arrives in Milestone 5.
