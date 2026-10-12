# BloKade

Kade's 3D design app for 3D printing. It's as easy as TinkerCAD, and it's built so we can keep adding to it.

**Use it online:** [spoonman1091.github.io/BloKade](https://spoonman1091.github.io/BloKade/)

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

**On a server managed by Portainer:** see [Deploy with Portainer](#deploy-with-portainer) below.

**Back up your designs.** Designs live in each browser, not on the server, so clearing the browser's data
deletes them. To keep a copy (or move a design to another computer), click the **📁** button with the
design's name in the toolbar, then **Save to file**. Use **Load from file** in the same window to bring it back.

**For development:**

```bash
npm install
npm run dev
```

## Deploy with Portainer

`docker-compose.prod.yml` is the same stack without a `build:` step, so Portainer can deploy it straight
from Git. You build the image yourself first, then Portainer runs it. Two settings come from environment
variables:

| Variable | Default | What it does |
|---|---|---|
| `BLOKADE_IMAGE` | `blokade:latest` | The image to run |
| `BLOKADE_PORT` | `5233` | The port BloKade is served on |

### 1. Build the image

Pick one of these.

**Option A: build on the Docker host itself** (simplest; no registry needed). On the server Portainer manages:

```bash
git clone https://github.com/Spoonman1091/BloKade.git
cd BloKade
docker build -t blokade:latest .
```

To update later: `git pull`, then run the same `docker build` command again.

**Option B: build somewhere else and push to a registry**, for example GitHub Container Registry. Log in
first with a GitHub token that has the `write:packages` scope:

```bash
echo "$GITHUB_TOKEN" | docker login ghcr.io -u spoonman1091 --password-stdin
```

Then build for the server's CPU and push. Use `linux/arm64` instead of `linux/amd64` for a Raspberry Pi
or another ARM server. Building on a Mac for an Intel/AMD server needs `--platform`.

```bash
docker buildx build --platform linux/amd64 -t ghcr.io/spoonman1091/blokade:latest --push .
```

If the package is private, add the registry in Portainer under **Registries** so the server can pull it.

**Option C: copy the image over SSH** (no registry, built on another machine):

```bash
docker buildx build --platform linux/amd64 -t blokade:latest --load .
docker save blokade:latest | ssh user@server docker load
```

### 2. Create the stack in Portainer

1. In Portainer, open your environment, then **Stacks → Add stack**.
2. Name it `blokade` and choose **Repository** as the build method.
3. Fill in the repository fields:
   - **Repository URL:** `https://github.com/Spoonman1091/BloKade`
   - **Repository reference:** `refs/heads/master`
   - **Compose path:** `docker-compose.prod.yml`
   - Turn on **Authentication** only if the repository is private, using a GitHub token with read access.
4. Under **Environment variables**, add `BLOKADE_IMAGE` if you used a registry (for example
   `ghcr.io/spoonman1091/blokade:latest`), and `BLOKADE_PORT` if you want a port other than 5233.
5. Optional: turn on **GitOps updates** (polling, or a webhook) so the stack redeploys when
   `docker-compose.prod.yml` changes in Git.
6. Click **Deploy the stack**, then open `http://<server-ip>:5233`.

### 3. Update to a new version

Git only holds the stack file; the app itself is inside the image. So updating takes two steps:

1. Build the new image again, using the same option and tag as in step 1.
2. In Portainer, open the stack and redeploy it:
   - With **Option B** (registry), click **Pull and redeploy** so Portainer downloads the new image.
   - With **Option A or C** (image already on the server), redeploy *without* re-pulling. There is no
     registry for Portainer to pull from, and a pull would fail.

## GitHub Pages

Every push to `master` builds BloKade and publishes it to
`https://spoonman1091.github.io/BloKade/` using `.github/workflows/pages.yml`. The workflow runs the unit
tests first, so a broken build is never published.

**One-time setup:** on GitHub, open the repository's **Settings → Pages**, and under **Build and deployment**
set **Source** to **GitHub Actions**. To publish without pushing, open **Actions → Deploy to GitHub Pages →
Run workflow**.

Good to know:

- **Designs don't move between sites.** Each website keeps its own designs in the browser, so designs made on
  the home server don't appear on GitHub Pages, and the other way round. Use **Save to file** and
  **Load from file** to move one across.
- **Anyone with the link can use it.** Nothing is uploaded: every person's designs stay in their own browser.
- **The first visit is slower,** because the 23 MB geometry engine downloads once. After that the browser
  keeps it.

The site lives under `/BloKade/`, so the workflow builds with `BLOKADE_BASE=/BloKade/`. To try that build
locally:

```bash
BLOKADE_BASE=/BloKade/ npm run build
BLOKADE_BASE=/BloKade/ npx vite preview
```

Then open `http://localhost:4173/BloKade/`. Docker and `npm run dev` keep using `/`.

## Test it

```bash
npm test              # unit + geometry tests
npm run coverage      # with coverage report (80% minimum)
npx playwright install chromium
npm run e2e           # end-to-end tests in a real browser
```

## Using BloKade

### Learning BloKade

- **📘 Learn** (top bar) opens the lessons: nine short step-by-step guides, from "Your first shape" to "Ready to
  print". Each lesson opens its own practice design, so your real designs stay safe. Steps tick themselves off
  when you do them, and every step has **💡 Show me** if you get stuck. Finished lessons get a ✓.
- **Coding lessons:** open **🧩 My shapes**, then **📘 Lessons**. Ten short lessons teach coding with shapes, from
  changing a number to building a gear. Each lesson makes its own practice shape.
- **Tooltips:** rest the mouse on any button or box for half a second to see what it does.
- **❓ Help mode:** click ❓ in the top bar, then click anything to read what it does (nothing changes while
  help mode is on). Press Esc to stop.

Lesson progress is kept in this browser. In a private window the lessons still work, but they forget your
✓ marks when you close it.

### Keyboard shortcuts

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
| Esc | Deselect (or stop picking edges or a workplane) |

### Smart sizes

- **Formulas:** any size, position or rotation box takes a formula, such as `wall * 2 + fit`. The box shows
  the answer underneath. If a formula has a problem, the box turns red and the part keeps its last good size.
- **Variables:** in the Variables panel (right side), press **+ Add variable**, give it a name like `wall`, and
  type a number. Change it later and every part that uses it updates. Renaming a variable updates every formula that uses it.
- **Fit gap:** the `fit` number (0.2 mm to start) is extra room for parts that slot together. Use it in formulas,
  for example a hole of `peg + 2 * fit`.
- **Text:** the 🔤 Text shape makes raised letters. Change the words in Properties.
- **Line up:** select two or more parts (Shift-click) and use the Line up buttons.
- **Snapping:** while dragging, a part snaps flush against parts within 2 mm. Hold **Shift** to move freely.
- **Workplane:** press 📐 Workplane, then click any face. New shapes are built on that face. **Ground** goes back to the floor.

### Round & repeat

Select a part (or a group) and use **+ Add a modifier…** under Properties. Modifiers run top to bottom; use
↑ ↓ to change the order, the tick box to switch one off, and 🗑 to remove it.

- **◠ Round edges / ◿ Bevel edges:** pick *Top edges*, *Bottom edges*, *Upright edges*, *Flat edges* or
  *All edges*. To choose exact edges, press **👆 Pick edges** and click them in the 3D view (orange = chosen).
  BloKade remembers where they were, so they stay rounded when you resize the part. If an edge disappears,
  the modifier says it lost track of some edges and you can pick again.
- **⋯ Repeat in a row:** how many copies, and the step between them.
- **✲ Repeat in a circle:** how many copies, how far round (360° = all the way), which axis to turn around (up, left–right or front–back), and the
  center to turn around (measured from the part's own origin — the middle of its bottom).
- **⇋ Mirror:** flip left↔right, front↔back or top↕bottom, keeping the original or not.

Every modifier number takes formulas too, like `holes + 1`.

**⬇ STEP** saves the design for other CAD programs (Fusion 360, FreeCAD, Onshape…).

### Perfect fit

The **Fit tools** section (left side) makes parts that go together. Every one of them uses the **Fit gap**
(Variables panel, 0.2 mm to start): holes get that much extra room on every side, so parts slide together
after printing. If your printer makes tight parts, raise the fit gap and every hole grows.
Tip: printed threads usually need a bigger fit gap. If the rod won't screw in, try 0.3 to 0.4 mm in the Fit gap.

- **🧷 Peg & socket:** adds a peg and its socket (a hole) together, linked by the variables `peg_size` and
  `peg_length`. Change those and both follow. Put the socket in a part and group them to cut it.
- **🪝 Snap-fit clip:** a bendy arm with a hook, and the slot it snaps through (linked by `clip_width` and
  `clip_thickness`). Set the catch's *Wall thickness* to the wall it goes through.
- **🔩 Screw hole:** M2–M5, as a plain hole, countersunk (flat-head screws), counterbored (cap-head screws),
  with a nut trap at the bottom, or for a heat-set insert at the top. The screw goes in from the top.
- **🪛 Threaded rod / 🌀 Threaded hole:** printable M6–M20 threads, up to 40 turns long. M8 and bigger print
  best.
- **🔍 Check overlap:** select two parts (Shift-click) and press *Check overlap* under *Fit check* in Properties.
  Any overlap shows in red, with its size.

Every fit tool's **Extra room** starts as the formula `fit`. Type a number there to give one part its own gap.

### My shapes (shapes you write in code)

**🧩 My shapes** (top bar) opens the shape editor. **⬅ Back to my design** returns, with the design unchanged.

- **Left:** your shapes, with **+ New shape**, **Duplicate**, **Delete**, **💾 Save to file** and **📂 Load from file**.
  Below them are **📘 Lessons** and **❓ Commands** (every `cad` command with an example, plus a ready-made ⚙️ Gear).
- **Middle:** the code. It saves as you type. If something is wrong, the message under it says which line to look at;
  click the message to jump there.
- **Right:** a live preview, updated half a second after you stop typing, with the shape's settings to try.
  **➕ Add to my design** puts the shape in your design.

A shape is a file like this:

```js
export default {
  name: 'Robot head',
  icon: '🤖',
  settings: { size: { type: 'mm', default: 20, label: 'Size' } },
  build({ size }, cad) {
    return cad.box(size, size, size).cut(cad.cylinder(6, size + 2).move(0, 0, -1))
  },
}
```

Setting types are `mm`, `whole`, `number`, `angle`, `text`, `choice` and `yesno` (a tick box).

Designs carry the code of every shape they use, so a design file works on any computer. When you change a shape
after adding it, the design offers **Use my newest version** (one undo step). Your shapes are kept in this browser,
separate from your designs: use **💾 Save to file** to keep a copy.

Kade's code runs only inside the geometry engine's worker, never on the page. A shape that never finishes building
(an endless loop) is stopped after 30 seconds and shows "This shape took too long to build".

## How it's built

- `src/document`: the design "recipe" (shapes, groups, transforms) and immutable edits
- `src/plugins`: every shape is a plugin; the built-in ones are in `builtin/`
- `src/geometry`: the OpenCascade engine (in a Web Worker) that turns the recipe into solids, meshes, and STL/3MF files
- `src/viewport`: the 3D view (Three.js)
- `src/ui`, `src/app`: panels, toolbar, shortcuts, and wiring
- `src/kade`: Kade's own shapes: the friendly `cad` toolkit, the code checks, the shape library, the editor and the coding lessons
- `src/persistence`: autosave, design files, and the designs list

Design spec: `docs/superpowers/specs/2026-10-11-blokade-design.md`.

## Shape files in the plugins/ folder

Most shapes are made in **🧩 My shapes**. Shape files can also live in the `plugins/` folder, where they are built into
the app for everyone. See [`plugins/README.md`](plugins/README.md).
