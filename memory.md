# InsightVis — Project Memory

> **Purpose of this file.** InsightVis is a long-running project spanning many work sessions.
> This file is the durable memory: the brief, the standing mandates, the decisions, the
> conventions and the calibration constants. **Read it before starting any work. Update it
> whenever a decision is made or a constraint is discovered.** A stale memory is worse than
> no memory — fix anything here that no longer matches reality.

Last updated: 2026-09-23 (v8, artifact v22)

---

## 1. Project identity

| | |
|---|---|
| **Name** | InsightVis · the flagship module is **Insight Smart Lab** |
| **Client** | Insight Coaching — a coaching institute preparing students for JEE and NEET |
| **Repository** | `pranshukesavmishra/insightvis` |
| **Audience** | Class 11–12 students and droppers preparing for JEE (engineering) and NEET (medical) |
| **Secondary audience** | Insight Coaching faculty, using the simulations as live teaching aids in class |

---

## 2. The standing mandate — read this every session

These three rules were set by the client and apply to **every** piece of work on this
project, permanently. They are not preferences.

### 2.1 Real working models, never decorative animation
Every experiment must compute the actual governing equations. Numerical integration of real
physics, chemistry and biology. If a quantity is displayed, it was calculated — not keyframed,
not faked, not approximated for convenience.

### 2.2 Competitive-exam level, not school level
JEE and NEET are among the most competitive examinations in the world. The content must be
pitched at that difficulty. That means: the subtle distinctions examiners actually test, the
traps students actually fall into, the second-order effects (missing orders, the refractory
period, racemisation statistics, afterload on the PV loop) — not just the headline formula.
**Assume the student is bright, under pressure, and has already read the textbook.**

### 2.3 Graphics and UI/UX: no compromise, ever
This is stated by the client as a hard requirement. The visual and interaction quality is a
first-class deliverable, equal in weight to correctness. No placeholder styling, no default
component looks, no "we'll polish it later". Every screen must look like a piece of
professional scientific instrumentation. If a choice trades visual quality for convenience,
make the other choice.

### 2.4 Biology figures must be anatomically drawn, never boxes and blobs
Added after client feedback on v3: *"the diagrams and figure you have used in biology are
unrealistic so it is making it tough for a student to visualise."* A NEET student is examined
on labelled diagrams. A heart drawn as four rounded rectangles, or an axon drawn as a grey
bar, teaches them nothing they can carry into the exam hall. Every biological structure is
drawn as the organ or cell actually looks — chambers with real proportions, great vessels
in correct anteroposterior order, a neuron with soma, dendrites, hillock, myelin and nodes,
a bilayer with heads and tails. `art-bio.js` is the single library for these; a lab never
hand-draws anatomy again.

### 2.11 THE BUILD METHOD — how every experiment in this project is made
*This is the procedure — what to decide, in what order. **§14 is the format** — the exact shape of
every field you then write. Read this one first, build from that one.*
Written down at the client's explicit request (2026-09-14): *"whatever methods using put that into
memory file so in future can be designed in same ways."* **Follow this procedure for every new
experiment, in this order.** It is not a description of what was done; it is the instruction.

**Step 1 — Pick the chapter by exam weight, not by what is easy to draw.**
Open a chapter that is not yet covered and that JEE/NEET actually load marks onto. Check §4 for what
exists so two labs never cover the same ground.

**Step 2 — Find the real computation at the core.**
Every lab integrates or solves something a student could do by hand but never would: an ODE by RK4,
a matrix diagonalised, a surface integral summed over a lattice, a Boltzmann sum, an N-body
collision. **The exam rule must be the OUTPUT, never the input.** If a lab has to state the rule and
then illustrate it, the lab is wrong. Test: could the student read the answer off the screen without
the formula ever appearing? If not, rebuild the core.

**Step 3 — Make the trap reachable with a control.**
List the mistakes the paper actually punishes, then make each one something the student can *drive
the apparatus into*: detune the RF, drop μ until the body slips, enclose nothing in the Gaussian
surface, raise the lamp to maximum below threshold. A trap that cannot be reached by moving a
control is not in the lab.

**Step 4 — Draw through the subject's figure library, never by hand.**
`art-bio.js`, `art-zoo.js`, `art-organic.js`, `art-physics.js`, all sitting on `render.js`. If a new
subject has no library, **build the library first** — that is what keeps the whole suite looking
like one instrument rather than 31 separate drawings.

**Step 5 — Lay the plate out to §2.7 before drawing anything in it.**
Reserve the header band and the foot band as numbers at the top of `drawStage` (`HDR`, `FOOT`,
`y0`, `y1`, `CH`) and lay every structure out inside what is left. Nothing may cross into either
band. Every examinable structure gets a leader label; a scale bar; a magnified inset where a detail
matters.

**Step 6 — Two plots that answer different questions.**
One about *this* system as it is set; one placing it on the landscape of all comparable systems
(every metal's V₀–ν line, every body's k, every damping's resonance curve). The second plot is
where the generalisation lives.

**Step 7 — Let the student build the input.**
Register handles with `g.handle(x, y, r, id)` and implement `def.onDrag(S, e)`. Dragging a charge
onto the field is a larger act of learning than picking its position from a slider. The engine keeps
the sliders in sync automatically (`R.ctlSync`).

**Step 8 — Write the teaching text last, and make it ask before it tells.**
`walkthrough` steps each carry `ask` and `reveal` and a `params` set that puts the apparatus into
the state being discussed. `problems` carry a real exam question and a committed numeric prediction
that is then checked against what the apparatus actually computes. `quiz` and `notes` carry the
exam patterns and the single trap most likely to cost a mark.

**Step 9 — Verify before claiming anything.**
`node audit.mjs` must print CLEAN — it clicks every control and preset on every sim and catches
controls that are declared and never read. Then `node shot.mjs`, `node resz.mjs`, and a screenshot
of every changed plate that I actually look at. **Reading the screenshot is part of the build, not
an optional check**: every layout fault in this project's history was visible in one and found only
because someone looked.

**Step 10 — Ship the whole increment.**
Publish the artifact, sync to `smartlab/`, update `README.md` §4 and this file's §13, commit with a
message that explains the physics and the bugs, push.

### 2.10 CALIBRATION — the client's own scores, and what they mean
The client scores rounds in percentages. These are the only reliable measure of the bar and they
are **lower than they look**, because each score is given on work I had already verified.

| Round | Verdict | What it means |
|---|---|---|
| Organic chemistry, 5 labs (2026-09-13) | **"50% matching my expectations"** | The *shape* was right and became the template (§2.5). |
| Biology, first pass | *"too bad"*, *"the graphics the most I didn't like"* | Led to `art-zoo.js`, then `render.js`. |
| Physics, 5 labs (2026-09-14) | **"I like only 40%"** | **Lower than organic.** Correctness and layout were not the problem; the ceiling is much higher than I have been building to. |
| Physics, after the 3D round (2026-09-15) | **"i like all physics simulations you made recently"** — accepted without the "but" | The round that moved it did four things: **true 3D benches** on `render3d.js`, **draggable apparatus** so the student builds the input, **predict-then-check problems**, and three new chapters. Treat that combination as what 40% → accepted actually costs. |
| The four earliest physics labs, same screenshot (2026-09-15) | *"these you made earlier, i didn't like them that much... the 1st one charged particle and cro— is okay but that also needs very much upgradations. so go deeply into it and improve them at high and advance level"* | **A lab is not finished because it once shipped.** Lorentz, cyclotron, YDSE and resolving power all passed audit, all had correct physics, and all read as the older generation the moment they sat next to the new benches. When the bar moves, everything below it becomes work. |

**Read the 40% as an instruction, not a grade.** The physics round was audited clean, laid out to the
plate standard and numerically correct — and still scored below the organic round. So the gap is
**not** in the things I have been verifying. Where it actually is, in priority order:

1. **The apparatus does not look like apparatus.** Physics plates are schematic diagrams that happen
   to be lit. The biology figures got a volume pass and became objects; the physics benches did not.
   An incline is a hatched quadrilateral, a photo-cell is a rounded rectangle. They need the same
   treatment tissue got: real materials, thickness, wear, cast shadows, depth.
2. **Nothing is in 3D.** The engine has a working camera (`is3D`, `Camera`, orbit drag) and **not one
   physics lab uses it**. Rolling bodies, field lines round a dipole, a magnet falling through a
   coil, gas molecules in a box and a PV surface are all genuinely three-dimensional and are being
   drawn flat. This is the single biggest visible gap.
3. **Density of detail.** §2.9 says *more parts*. A physics stage typically carries one object and
   two labels where the biology plates carry twenty labelled structures.
4. **The student still only turns sliders.** §2.5 asked for building the input; the engine now
   supports it (§2.11 step 7) and the labs must actually use it.

**Never present a round as finished because it verified clean.** Clean is the floor.

**What finally moved the score.** Not more labs, and not more correctness — the physics round that
scored 40% was already audited clean and numerically right. It was **3D, touchability and depth of
interaction**: benches you can orbit, apparatus you can drag into shape, and problems that make the
student commit before the simulation answers. When a round is scored low and the numbers are already
right, look at those three before adding anything new.

**"Advance level" means new physics, not more polish.** Asked to take the four earliest physics labs
"deeply into it", the thing that actually raised them was examinable material they did not have:
a thin plate over one slit, immersion, unequal slits and white light in YDSE; the mass spectrometer
and the cycloid drift in the Lorentz chamber; a logarithmic aperture spanning a pinhole to Hubble,
the microscope form 0.61λ/NA and the Sparrow limit in the resolving lab. Redrawing what was already
there would not have moved any of them.

**And the one place the rebuild found the old lab was simply wrong.** The resolving lab reported a
pair as RESOLVED whenever Δθ ≥ θ_min, because it compared two numbers. Rayleigh's 0.735 dip is
derived for two *equal* sources; a companion at a quarter of the brightness sits inside the bright
one's Airy skirt and the profile has a single maximum. The verdict now scans the summed profile for
two maxima and measures the valley against the **weaker** of them — verified at 0.734 for the equal
pair at exactly θ_min, and 0.997 (one blur) for the unequal pair at the same separation. **When a
rebuild touches a formula, re-derive the special case the formula assumed.**

**And the two rounds of corrections that followed are part of the lesson.** The client caught a
broken bench twice running, both times in a *fullscreen* or *orbited* view I had never looked at.
Screenshotting the default camera is not verification of a 3D scene — orbit it, and check the
apparatus proportions numerically (§2.12).

### 2.12 A 3D bench must still read as the object it is
Found by the client in a fullscreen screenshot of the rolling lab, 2026-09-14: the incline had become
a flat sheet with balls hovering on it. The cause was arithmetic, not art — I had enlarged the drawn
body radius for legibility, spaced four lanes at 2.7R, and the bench grew to **3.04 m wide against a
2.84 m slope**. An incline wider than it is long stops being an incline.

**And the deeper one, found the same day when the first fix made it worse:** the bodies then sank
INTO the bench. `render3d.js` sorts by the painter's algorithm, and every bench piece was submitted
with **one depth key at its own centre** — so a large flat quad is drawn either wholly in front of or
wholly behind each small object resting on it. The near side wall's centre is closer to the camera
than the bodies, so the wall painted straight over them.

**A single depth key cannot sort a large flat surface against small objects standing on it.** That is
a property of the algorithm, not a bug in the scene. Ground geometry therefore declares itself with
`F.GROUND` (a bias far larger than any scene depth, which preserves ordering *within* the bench) and
is pushed behind everything that is not ground. Apply this to every floor, wall, table and slab in
any 3D lab. The alternative — subdividing every quad — costs far more and is still not exact.

Rules that follow, for every 3D bench:
- **Check the aspect ratio of the apparatus numerically, not by eye.** Print the dimensions. A ramp
  is capped here at 60% of the slope length in width.
- **A solid must have thickness on every visible side.** The wedge now carries full-depth triangular
  side walls, a closed back face and a base slab. A skirt that does not scale with the bench reads as
  paper the moment the bench grows.
- **Anything that exists to show motion must face the viewer.** The spokes and reference mark that
  make rolling distinguishable from sliding were drawn on the far end cap only, so they were never
  once visible. Draw such markers on *both* caps, and mirror the phase on the near one or the mark
  appears to run backwards.
- **Check the sign of every vector against a worked case.** ω was drawn along −y; for motion
  down-slope with the axis across the bench, ω = (n × v)/R points along **+y**. Verify on the flat
  case: n = ẑ, v = +x̂, ẑ × x̂ = ŷ.

**Two more rules, from the orbit sweep on 2026-09-15:**
- **Occlusion is a question about the camera, not about the scene.** Both the Lorentz chamber and
  the cyclotron hid their own beam behind a magnet pole face from angles the default view never
  reaches. Deciding by *mode* ("the flat experiments outline their poles") fixed one view and broke
  the rest. The right test is `Math.sin(cam.phi)`: whichever solid sits on the camera's side of the
  mid-plane becomes an outline, the far one stays solid, and the scene is readable from every angle
  the orbit can reach. Generalise: any large solid that can come between the camera and the subject
  should decide its own opacity from the camera, every frame.
- **A 3D label placed by a fixed screen offset is correct from one angle and wrong from the rest.**
  N landed under S, gap captions sat on top of the dees, and leaders ran off the left edge. Ask the
  projection first: pick the extreme point of the object's own silhouette (`highest`/`lowest` over
  its rim), and choose the leader direction from the label's projected x against the scene centre.
  Where an object is always on one side of the picture, hard-code the direction rather than
  computing it.

**And the harnesses this needs.** `sweep.mjs id [wait] [views]` renders one lab from a list of
camera angles; `sweepall.mjs a,b,c` walks several labs at the home view plus two extremes derived
from it; `narrow.mjs a,b,c` renders at 430 px and reports horizontal overflow. **Reading the default
view is not verification.** Both bugs above were invisible from the camera each lab opens on.

**And the rule that governs every bias, found when the client caught both optics benches layering
wrongly on 2026-09-15.** A depth bias is a licence to lie about where something is, and every lie
has to be small enough to stay true from a camera you have not looked from yet. Three bands, and
nothing else:

1. **`F.GROUND` — only for a surface other things physically stand on.** The rail and its posts.
   Nothing else. I had been handing out fractions of it (`F.GROUND * 0.35`, `* 0.5`, `* 0.7`) to
   put components "roughly in order", which freezes that order: the screen was painted over the
   stop that stood in front of it, because 0.35 beat 0.7 regardless of where the camera was.
   **A fraction of GROUND is not a depth, it is a hard-coded answer to a question the camera asks
   every frame.** Components sort on their own depth, bias 0.
2. **A few hundredths — for decoration attached to one component.** A glow on a lamp, a ruler on a
   screen, a marker on a face: enough to sit on its parent, never enough to jump a component that
   is genuinely nearer. Large negatives (`-2`, `-20`, `-50`) are the same bug with the sign flipped
   and were doing the same damage: rays drawn through solid plates, a lamp glowing through the
   apparatus in front of it.
3. **`-1e5` — text only**, which `R3.label` and `R3.callout` already apply. A label that is
   occluded is a label that failed.

**When a large flat face carries small marks of its own — a slit plate and its slits, a stop and
its aperture — the two are ONE item, drawn in a single `F.push`:** the face filled `evenodd` so the
marks are genuinely holes, then the light painted into them. Anything else recreates the §2.12
problem one level down, and the fix is not a bias, because no bias exists that beats the face's own
depth spread without also beating the next component along the bench. Measure it if tempted: the
slit plate's own spread was 0.67 depth units and the screen was only 0.81 further on.

### 2.13 A drag handle on a compressed axis needs a gain, and the gain is not a fudge
Several benches draw a quantity on a deliberately compressed or non-linear scale, because the true
one is unviewable: the double slit's screen distance spans 2.6 m inside 0.90 display units, its slit
separation is sub-millimetre, and the resolving bench's aperture runs over four decades on a
logarithmic slider. Mapping a drag 1:1 through that projection sends the parameter from one end of
its range to the other in a flick — measured, not guessed: 60 px took D across half its range and d
to its floor.

So: **invert the drawn map first** (recover the parameter from the drawn quantity, not from a
pixel-per-metre figure taken off the projection), then apply an explicit gain chosen so the full
range takes roughly a third of the stage, and say in a comment why the gain exists. Verify with
`drag.mjs id dx dy handleId`, at several dx, in both directions. A handle that saturates is worse
than no handle.

### 2.9 The agreed look: rich, volumetric, vivid, dense
Asked directly on 2026-09-13, the client chose **all three** of rich 3D realism, vivid colour and
more detail per figure, with no reference — my judgement. That is now the target, and `render.js`
carries the volume pass that delivers it:
- `RX.ball` — a properly lit sphere: key highlight, terminator, bounce light off the shadow side,
  subsurface warmth, specular and rim.
- `RX.tube` — a round tube along a polyline, built from stacked strokes offset toward the light.
  **Tentacles, vessels, canals, axons and neurites must all use this.** Flat strokes are precisely
  what made them read as drawn lines rather than structures.
- `RX.volume` — a closed form with a lit body, a bounce, tissue grain and a specular band.
- `RX.sat` — the vivid control; tissue colours are pushed through it rather than picked pale.

Two rules learned the hard way, both easy to get wrong again:
- **A cavity is not a solid.** Running `RX.volume` on the gastrovascular cavity put a specular
  highlight in the middle of a hole. A cavity is dark at its centre and catches light only at the
  rim, plus whatever spills in through its opening.
- **A gradient must span the shape it fills.** The body-wall bands were shaded with a radial
  gradient whose radius was the band *thickness* while the band was 230 px tall, so everything
  past the first few pixels fell to the final dark stop and the walls went black. For a long thin
  band, light it with a linear gradient across its thickness.

### 2.8 Rendering quality is a layer, not a per-figure effort
After the plate standard landed the client still said the graphics needed "very much upgrade".
Layout was no longer the fault — **rendering** was. Flat fills with one gradient look like plastic
whatever their layout. `render.js` (`window.RX`) is the fix and every figure library draws through
it: `RX.body(ctx, pathFn, opts)` gives a shape a lit base gradient, ambient occlusion inside the
contact edge, a narrow bright rim on the lit side, procedural tissue grain, an optional cast
shadow, and a confident contour. `RX.blob` is the ellipse shortcut, `RX.contour` varies line weight
with the light, `RX.contact` drops a soft shadow where one structure overlaps another.

Two things learned tuning it, both non-obvious:
- **Effects must fade out below about ten pixels** (`sz` in `RX.body`). At cell scale a 2 px
  occlusion band swallows the whole form — the first attempt turned every epithelium into a row
  of dark rings.
- **At low magnification a plate draws tissue layers, not cells.** The Hydra column was drawn
  cell-by-cell at 6 px per cell, which is sub-pixel detail masquerading as rigour. It is now three
  lit, textured bands (epidermis, mesoglea, gastrodermis) with cell boundaries as tick marks, and
  the cells themselves belong in a magnified callout.
- **Never draw a structure at low global alpha to push it back.** The cnidoblast was at 0.55 alpha
  and read as a smudge. Use a darker colour, not transparency.

### 2.7 THE PLATE STANDARD — the exact shape the client approved
On 2026-09-13 the client went through the whole biology suite and named
**three** labs as acceptable — the nerve impulse, the sponge canal system and the
cnidarian lab — and called everything else "very bad". Those three share one shape, and it is
now the required layout for **every** biology stage:

1. **The figure dominates the stage.** It is the subject, not a thumbnail beside a chart.
2. **Drawn at section quality** — cells as cells, layers named, nothing solid-filled that should
   have internal structure.
3. **Leader-line labels on every structure the exam asks you to name.** Turning leaders off to
   save space is what made the cardiac lab fail; if the labels do not fit, the figure is in the
   wrong place, not the labels.
4. **A magnified inset** of the cell or structure that does the work, joined to its source on the
   main figure by a dashed callout.
5. **A scale bar** on the figure and on the inset.
6. **Graphs go in the plots panel, not on the stage.** A Wiggers diagram or a ladder diagram is a
   graph; it must not compete with the anatomy for the stage.

Applying this to the cardiac lab meant moving the Wiggers stack out entirely and rebuilding the
stage as a labelled heart plus a magnified cardiac-muscle fibre. **`audit.mjs` caught the
regression that caused** — `showECG` went dead the moment its only reader was removed. Run the
audit after every layout change, not just after adding controls.

### 2.6 Biology is behind, and the gap is graphics first
Client verdict, 2026-09-13, after the organic suite landed: *"I still didn't like the biology part,
it's too bad — the graphics things the most I didn't like, and rest everything is also kind of
unsatisfied."* Two separate faults, both real:

**Graphics.** The organism art was cartoon-grade — a Hydra drawn as a blue rounded rectangle with
stick tentacles, a nematocyst as a flat egg with a spiral scribble, a sponge as an orange blob with
yellow dots. `art-zoo.js` is the answer, and it is to zoology what `art-organic.js` is to organic:
cells drawn as cells with membranes and nuclei, epithelia as real sheets, body walls as named
layers, a nematocyst with capsule wall, operculum, cnidocil, coiled tubule, barbs and stylets, a
choanocyte with a microvillar collar and a beating flagellum. **No lab hand-draws an organism.**

**Substance.** Most Animal Kingdom labs are *data browsers, not simulations* — `ak-key` filters a
matrix, `ak-challenge` is a quiz, `ak-chordata` is a checklist. They look things up; they compute
nothing, which breaks mandate 2.1 and is exactly why they feel weaker than organic chemistry. Where
the biology genuinely has physics (sponge hydraulics, nematocyst kinetics, water-vascular pressure,
circulation), the computation exists but the drawing showed none of the anatomy the numbers
describe. Fixing a lab means **both**: rebuild the figure on `art-zoo.js`, and give it something
real to compute.

### 2.5 The organic chemistry labs are the template — and the bar is twice as high
Client verdict on v5, 2026-09-13: *"I like this organic chemistry experiments, 50% matching my
expectations but definitely more improvement and upgradation needed — build these type of
experiments."*

**Read that as two instructions.** First, the five organic labs are the **model** for everything
built from now on; match their shape rather than inventing a new one. Second, they are only
**halfway** to what the client wants, so the ceiling is roughly double — do not treat that
shape as finished.

**What makes them the right type** (copy all six of these into every new lab):
1. A **real computation at the core** that a student could in principle do by hand but never
   would — a diagonalised matrix, an integrated ODE, a Boltzmann sum, a Hammett product.
   The exam rule is the *output*, never the input.
2. **The rule emerges.** 4n+2, Markovnikov and ortho/para directing are never stated and then
   illustrated; they fall out of numbers the student can watch change.
3. A **purpose-built figure library** (`art-organic.js`, `art-bio.js`) so the drawing is
   discipline-accurate and consistent across labs.
4. **Every parameter is physically meaningful** and in real units, with the traps that JEE
   actually examines reachable by moving a control (COT planarity, the anilinium ion,
   peroxide-with-HBr-only, the t-butyl lock).
5. **Two plots that answer different questions** — one about this system, one placing it on a
   landscape of all comparable systems.
6. A **walkthrough that asks before it tells**, and a quiz written from real exam patterns.

**Where the missing 50% is.** These are the directions to push, in the order they are likely
to matter:
- **Mechanisms must animate step by step.** Curly arrows should play through, bonds should
  break and form on screen, intermediates should appear and be consumed. Static snapshots with
  a cycling resonance contributor is the weakest part of what shipped.
- **Let the student build the input.** Drag a substituent onto a ring, assemble an alkyl halide,
  set a stereocentre by dragging groups. Choosing from a dropdown is a much smaller act of
  learning than constructing.
- **Go 3D where the chemistry is 3D.** Conformers, stereocentres and orbitals are being drawn
  in 2D projections. The engine already has a working camera — use it.
- **More depth inside each topic**, the same instruction as v2: several linked experiments per
  chapter rather than one, e.g. E1/E2/SN1/SN2 competition on one substrate, or a full
  aldol/Cannizzaro/carbonyl-addition set.
- **A worked-problem mode** — take an actual JEE question, let the student predict, then run
  the simulation to check the prediction and show where the reasoning went wrong.
- **Cover the rest of organic.** Still missing: carbonyl chemistry, aldol and named reactions,
  amines and diazonium, biomolecules, polymers, reaction-mechanism practice across GOC.

---

## 3. Scope

Four subjects, two exams, one engine.

- **Physics** (JEE + NEET) — mechanics, waves & oscillations, optics, electromagnetism,
  thermodynamics & kinetic theory, modern physics
- **Chemistry** (JEE + NEET) — physical, organic (3D mechanism playback), inorganic
  (orbitals, VSEPR, lattices, coordination chemistry)
- **Mathematics** (JEE only) — calculus, coordinate geometry, vectors & 3D, complex numbers,
  probability
- **Biology** (NEET only) — cell biology, genetics, human physiology, plant physiology,
  ecology & evolution

Full topic breakdown lives in `README.md` §3. Keep the two documents consistent.

---

## 4. What is built — Insight Smart Lab v3

**Live artifact:** https://claude.ai/code/artifact/bff145e7-cd07-46c2-85d5-b579094767e6
**Source:** `smartlab/` in this repository.

**Twenty-one experiments across seven chapters.** Six chapters carry two each; **Animal Kingdom
carries nine**. The client flagged Animal Kingdom as the topic they are evaluated on and asked for
it to be as vast as possible — treat it as the flagship and keep it ahead of everything else.

### Animal Kingdom suite (NCERT Class XI, Chapter 4)
`data-animalia.js` is the single source of truth: 11 phyla + 3 chordate subphyla + 7 vertebrate
classes, every examinable character, every NCERT example genus. `art-animalia.js` holds hand-built
Canvas silhouettes for every group. **All nine labs read from that one dataset — never duplicate
taxonomic facts into a sim file.**

| Lab | What makes it computational rather than illustrative |
|---|---|
| A1 Classification key | live dichotomous-key logic + best-next-character selection |
| A2 Symmetry | mirror score computed from the real outline; peak count = plane count |
| A3 Germ layers & coelom | animated gastrulation; schizocoely vs enterocoely |
| A4 Sponge canal systems | continuity equation Q = Av; velocity drops in chambers, spikes at osculum |
| A5 Cnidaria | discharge kinematics anchored to 18.6 m/s and ~5.4×10⁶ g |
| A6 Water vascular system | extension = ΔV/A; metachronal gait; adhesion-limited force |
| A7 Vertebrate heart | oxygen-saturation mixing model + supply/demand for endothermy |
| A8 Chordate cladogram | character states distinguish "for life" from "larva only" |
| A9 Identification challenge | scored drill with per-taxon weakness tracking |

**Five upgrade passes were run on this suite** (the client asked explicitly): (1) exam depth — the
organ-systems matrix and expanded question banks; (2) graphics — card clipping, a proper
anatomical circulation circuit, cleaner starfish; (3) more control — variable-fold model animal,
multiple oscula, germ-layer derivative map, larva/adult chart; (4) the identification challenge;
(5) verification, which caught two real bugs (see §7).

| # | Subject · Chapter | Experiment | What makes it real |
|---|---|---|---|
| 1 | Physics · Moving Charges | Charged particle in crossed E and B | **Boris pusher** conserves \|v\| exactly under pure B |
| 2 | Physics · Moving Charges | **The cyclotron** | E acts only in the gap; RF can be detuned out of resonance |
| 3 | Physics · Wave Optics | Young's double slit | True intensity with the single-slit sinc² envelope; μ immersion |
| 4 | Physics · Wave Optics | **Diffraction & resolving power** | Real **Airy pattern from Bessel J₁**, Rayleigh verdict |
| 5 | Chemistry · Structure of Atom | Hydrogen orbitals | Rejection-sampled from \|ψ\|²; signed R(r) graph |
| 6 | Chemistry · Structure of Atom | **Bohr model & spectrum** | Rydberg for H/He⁺/Li²⁺/Be³⁺; true-colour Balmer lines |
| 7 | Chemistry · Haloalkanes | SN1 vs SN2 | Walden inversion; live racemisation tally; rate-vs-[Nu] graph |
| 8 | Chemistry · Haloalkanes | **E1 vs E2 elimination** | **Anti-periplanar dihedral gates the reaction**; Saytzeff/Hofmann |
| 9 | Biology · Neural Control | Hodgkin–Huxley action potential | Full HH on a 100-compartment cable; gating variables plotted |
| 10 | Biology · Neural Control | **The synapse** | Real Ca²⁺ fourth-power release law; curare/botox/neostigmine |
| 11 | Biology · Circulation | Cardiac cycle | Time-varying elastance + Windkessel; PV loop; Frank–Starling curve |
| 12 | Biology · Circulation | **Cardiac conduction & heart block** | Event-driven SA→AV→His→Purkinje; ladder diagram; Wenckebach |

### Engine capability (lab-core v2)
- **Multiple graphs per experiment**, each with a hover crosshair and a live tooltip
- **Click any control value to type an exact number** (students need exact inputs, not slider guesses)
- **Ghost overlay** — freeze the current graph and compare the next configuration against it
- Fullscreen stage; keyboard shortcuts (space play/pause, R reset, L log, ← → walkthrough)
- **Lab notebook** — record every readout as a table row, the way a real practical is written up
- **Self-check quizzes** with worked explanations
- Chapter-grouped navigation (subject → chapter → experiment)
- `InsightLab.extend(id, patch)` deepens an already-registered sim without touching its module —
  used by `sims-extend.js` to add controls, second graphs, readouts and quizzes to the original six

### Architecture that shipped
```
smartlab/
├── index.html           shell + complete design system (all CSS)
├── lab-core.js          registry, console shell, control deck, multi-plot canvas library with
│                        hover inspection, walkthrough + quiz engines, lab notebook, RK4,
│                        3D camera + projection, extend() hook
├── sims-physics.js      Lorentz force · Young's double slit
├── sims-physics2.js     cyclotron · diffraction & resolving power
├── sims-chemistry.js    hydrogen orbitals · SN1/SN2
├── sims-chemistry2.js   Bohr model & spectrum · E1/E2 elimination
├── sims-biology.js      action potential · cardiac cycle
├── sims-biology2.js     synapse · cardiac conduction & heart block
└── sims-extend.js       depth pass on the original six
```
Zero external JS dependencies. All 3D is a hand-rolled Z-up perspective projection with
painter's-algorithm sorting and additive ("phosphor") blending on Canvas 2D.

### Every experiment ships the same anatomy
**Stage** · **Control Deck** · **Readout strip** · **Equation pane** (values substituted live) ·
**one or two graphs** · **Guided walkthrough** (predict-then-reveal) · **Check yourself** quiz ·
**Lab notebook** · **Why this is asked** exam framing with a trap-to-avoid callout.

---

## 5. Design system — locked, do not drift

**Direction:** instrument-grade dark laboratory console. Deliberately **dark-committed**
(single theme, no light mode) because the stage renders fields, orbital clouds and traces with
additive blending, which requires a dark ground. This is a decision, not an omission — every
colour is painted explicitly so the page holds on any host background.

**Colour**
| Token | Value | Role |
|---|---|---|
| `--ink-950 / 900 / 850 / 800 / 750 / 700` | `#05080F` → `#1A2439` | ink-navy ground and panel ramp (never pure black) |
| `--text / --text-2 / --text-3` | `#E7EDFB` / `#98A6C6` / `#63729A` | text ramp |
| `--phys` | `#3DD6F5` | Physics — oscilloscope phosphor cyan |
| `--chem` | `#FFAE4C` | Chemistry — sodium flame-test amber |
| `--bio` | `#FF6B9D` | Biology — eosin stain rose (H&E) |

Each subject accent is grounded in something real from that subject's own world. The accent
switches with the subject via `[data-subject]` on the root; everything else stays constant.

**Type** — IBM Plex Sans Condensed (headings), IBM Plex Sans (body/UI), IBM Plex Mono
(all numbers, units, labels, readouts), Georgia italic (maths variables). Chosen for technical
heritage; deliberately **not** Inter or Space Grotesk, which read as generic AI defaults.

**Maths rendering** — hand-rolled HTML/CSS (`.eq`, `.frac`, `.num`, `.unit`). KaTeX is not
usable because the Artifact CSP only admits stylesheets from `fonts.googleapis.com`.

**Charts** — single scale per chart, never dual-axis. Recessive grid, 2px marks, labels in
text tokens rather than series colour, legend whenever there are ≥2 series.

---

## 6. Non-negotiable engineering rules

1. **Correctness over prettiness** — but both, always. Models validated against analytical
   solutions or known physiological values.
2. **60 fps or fix it.** Below that, interactivity dies.
3. **Real SI units everywhere.** No arbitrary 0–100 sliders.
4. **Syllabus-anchored.** Every simulation declares its JEE/NEET chapter and exams.
5. **Works on school hardware.** Graceful quality tiers; sample counts are adjustable.
6. **Accessible.** Keyboard navigation, visible focus, `prefers-reduced-motion` respected.
7. **No faked animation in a physics context.** If it moves, something computed why.
8. **No external JS dependencies** in the lab. The CSP allowlist is narrow and the physics
   is ours.
9. **Canvas: a path does not survive `beginPath()`.** `clip()` and `stroke()` act on the
   *current* path, and any loop that calls `beginPath()` replaces it. Every silhouette that is
   clipped to or stroked more than once must be a **path function**, re-laid each time. Getting
   this wrong is silent: the clip shrinks to whatever was drawn last, and the stroke outlines
   the wrong shape somewhere else on the figure.
10. **`g.mix()` returns `'rgb(...)'`; `RX.mix()` returns hex.** Only hex can be fed back in.
   Nesting `g.mix` parses to `NaN` and renders **black**, with no error. Any colour that is
   mixed twice — a saturation ramp, a gradient stop built from a computed base — must use
   `RX.mix`. This has now cost three figures; treat a black fill as this bug until proven
   otherwise.

---

## 7. Calibration constants — hard-won, do not re-guess

These were found by direct numerical testing. Changing them will break the teaching points.

**Hodgkin–Huxley cable**
- Axial coupling `gax = 8`. At 1.6 the spike does **not** propagate along the axon.
- Firing threshold ≈ **11 µA/cm² at 1.0 ms** pulse. Defaults: `Istim 20, dur 1.0`.
- Subthreshold demo: `Istim 9`. Paired-pulse refractory demo: `Istim 24, gap 5 ms`.
- **Myelination (v4).** Internodes get `exc 0.02`, `gL 0.3/40`, `cm CM/25`; `gax` goes 8 → 12
  everywhere. Explicit Euler on the cable is only stable while `h·2·gax/cm < 2`, so the
  myelinated case **must** drop `hstep` from 0.005 to 0.0015 — at 0.005 with `cm/25` it sits
  exactly on the limit and blows up. Measured result: **3.56 m/s unmyelinated → 8.29 m/s
  myelinated**, nodes firing and internodes staying silent, i.e. genuine saltatory conduction.
- **Conduction-velocity markers must sit on excitable membrane** (`S.iA`, `S.iB` snap to the
  nearest node), and the measurement is re-armed only when the **whole cable** is quiet. The
  old reset (`V[iA] < -50 && V[iB] < -50`) fired while the spike was still in transit, so the
  velocity readout was permanently blank.
- Peak locks at ≈ +26 mV for any stimulus from 12 to 26 µA/cm² — this constancy **is** the
  all-or-none demonstration, verified numerically.
- TTX 70% abolishes the spike; TTX 40% gives a reduced spike (~+10 mV); TEA 80% gives a
  taller, broader spike (~+41 mV) with no undershoot. All physiologically correct.
- Integration: forward Euler, h = 0.005 ms. RK4 is too slow for 100 compartments at 60 fps.
- Playback: 15 simulated ms per wall-clock second.

**Lorentz force**
- Boris pusher, ~140 substeps per cyclotron period, 2.2 periods per wall second.
- Scene auto-scales by `max(r_c, 0.5 × pitch)`; camera target follows the trail centroid so
  E×B drift stays framed.

**Orbitals**
- Frame the camera on **r95** (radius containing 95% of the probability), not the sampling
  cutoff — framing on `rmax` leaves the cloud tiny.
- Sampling: inverse-CDF on r²R(r)² for the radius, rejection on |Y|² for direction.

**Animal Kingdom**
- `readTheme()` must list **every** CSS token a sim uses. `ink-750` was missing, so `alpha()` fell
  back to white and the challenge buttons rendered as white blocks. `alpha()` now falls back to a
  dark panel colour instead of white, so a future omission degrades safely.
- `setPointerCapture` must be wrapped in try/catch — it throws for synthetic pointer events and
  would otherwise kill the click handler.
- Symmetry scan: threshold 0.985 over 720 samples in [0°, 180°). A mirror line at φ and φ+180° is
  the same line, so the scan must cover a half turn only, or every plane is double-counted.
- Sponge flow is anchored to the classic Leuconia figures: ~0.1 cm/s at the incurrent canals,
  nearly stationary in the chambers, ~8.5 cm/s at the osculum.

**Cyclotron**
- Trail points must be pushed **inside** the substep loop (~14 per frame), not once per frame, or
  the spiral renders as a visible polygon.
- Readouts run once before the first `step`, so `setup` must initialise every value a readout
  reads (`S.KE`, `S.r`). This caused a real crash.

**Resolving power**
- Airy pattern uses Abramowitz & Stegun 9.4.4 / 9.4.6 for J₁ — accurate to ~1e-7, fast enough
  for a 460-point curve every frame.

**Synapse**
- Release uses the Dodge–Rahamimoff fourth power: quanta ∝ [Ca²⁺]⁴/([Ca²⁺]⁴ + 1.6⁴).
- `gmax` 0.004 per synapse gives a ~5 mV single EPSP, so ~4 synapses or ~90 Hz reaches threshold.

**Cardiac conduction**
- Ladder time window 3.6 s — at 6 s the AV delay slope is too shallow to read.

**Cardiac**
- Double-Hill elastance, `Emax` default 1.85 mmHg/mL, `V0` 10 mL, Windkessel `Cao` 1.45.
- Aorta trace is amber `#FFB454` — it must not be red, or it collides visually with the
  pink LV trace.

---

## 8. Conventions

- One folder or module section per simulation; the engine never imports React/Three/Next.
- Physics constants declared once per module, never re-inlined.
- Indian exam terminology used as students know it: PYQ, JEE Main / JEE Advanced, NEET UG,
  NCERT.
- Sim definitions are data (`params`, `controls`, `presets`, `walkthrough`, `notes`); the
  shell renders them. Adding an experiment should not require touching the shell.
- **Anatomy lives in `art-bio.js` (`window.BIOART`), never in a sim file.** Same rule as
  taxonomy in `data-animalia.js`: one source of truth. `BIOART` exports `heart`, `heart2`,
  `neuron`, `bilayer`, `synapticKnob`, `postsynapticMembrane`, `satColour`. Every figure is
  drawn in a normalised box and scaled, so any lab can place one at any size. Options that
  matter: `leaders:false` drops the external leader-line labels but keeps the chamber tags
  (use it in narrow panels); `vessels:false` drops the great vessels and the semilunar
  valves (use it when the lab draws its own circulation).
- **Colour helpers must return hex.** `mixHex` returning `rgb(...)` and then being fed back
  into itself silently produced invalid gradient stops and black chamber cavities. `parseHex`
  now tolerates bad input and `mixHex` returns `#rrggbb`.
- **Every control must be exercised before shipping.** `smartlab/audit.mjs` does it: a static wiring
  check (does the key exist in `params`, is it read anywhere in the owning file or its `-x`/extend
  patches) plus a live click-through of every range, toggle, select option and preset on all 26 sims,
  asserting the param actually moves. Run `node audit.mjs` — it must print CLEAN. It has already found
  two genuinely dead controls (`matrixView` on ak-key, declared and never read) and one crash.
- **Stage graphics come from the engine, not from each sim.** `lab-core.js` paints the instrument
  ground and runs the bloom pass around `drawStage`, and hands every sim a toolkit on `g`:
  `ramp`, `tween`, `label` (collision-aware), `sphere`, `shadow`, `layout`, `scaleBar`, `hit`,
  `pointer`, `quality`. A sim opts out with `ground:false` or `bloom:false` on its definition.
- **A canvas must never size the box that measures it.** Client report, 2026-09-13: the stage
  "keeps increasing, it should be constant size". A `<canvas>` with width/height *attributes*
  contributes them as intrinsic content height. Inside an `aspect-ratio` box whose height is auto,
  the taller of the two wins — so measuring the box and writing that height back into the attribute
  every frame ratchets it upward about a pixel per frame (measured: ~35 px/second, unbounded).
  The fix is `position:absolute;inset:0` on every stage and plot canvas, which takes it out of
  flow so the box height comes purely from `aspect-ratio`; plus a 2 px tolerance in
  `Surface.resize()` so sub-pixel jitter can never start a loop. `smartlab/grow.mjs` samples the
  stage over six seconds and `smartlab/resz.mjs` checks every breakpoint — run both after any
  change to stage or plot layout.
- **A mechanism is data, not drawing code.** `mech.js` (`window.MECH`) takes a list of scenes —
  each naming its atoms, bonds and the curly arrows that turn it into the next — and interpolates
  between them, so bonds genuinely break and form, charges fade in, and fractional bond orders
  render as delocalisation. Timing: the arrows draw over ~0.55 s as soon as a scene appears, then
  the geometry morphs from 28% to 100% of the transition, so a scene always reads before it moves.
  `MECH.frame(steps, i, u, arrowProgress)` → `MECH.draw(ctx, frame, {x,y,s}, opts)`, plus
  `MECH.transport(...)` for the clickable step strip. Always pass `st.a` as the fourth argument or
  the arrows vanish when the player is paused — which is exactly when a student wants to read them.
- **Sim methods live in the definition object, not on the state object `S`.** A helper needed
  by `drawStage`/`drawPlot` goes at module scope. (This caused a real runtime bug — `S.intensity`
  was called but never existed on `S`.)

---

## 9. Current status

**Insight Smart Lab v2 shipped** — twelve experiments, engine v2, published and running.

Next, in rough priority order:
1. Client review of the twelve experiments, the lab environment and the visual direction.
2. Widen to new chapters (see README §9 Phase 2).
3. Add Mathematics as the fourth subject rail.
4. Platform layer: student accounts, progress tracking, teacher/projection mode.

## 10. Open questions — need client input

1. **Framework migration.** v1 is dependency-free vanilla JS in one artifact. Do we keep that,
   or move to Next.js + React Three Fiber as the catalogue grows past ~15 experiments?
   (Recommendation: keep the engine vanilla and testable; wrap it in Next.js for routing,
   accounts and content when the platform layer starts.)
2. **Branding.** Are there Insight Coaching brand colours, a logo and typography to apply?
   The current identity is ours; it should be reconciled with theirs.
3. **Device floor.** Weakest device that must run this well — student phones, school desktops,
   classroom projectors? Sets the performance budget and the default sample counts.
4. **Offline mode.** Do classrooms have reliable connectivity, or is offline delivery needed?
5. **Content ownership.** Who supplies the PYQ bank — Insight faculty, or is that in scope here?
6. **Language.** Is regional-language support required?
7. **Timeline and team.** Solo build or team? Is there a demo milestone before the deadline?

---

## 11. Environment and access notes

- `pranshukesavmishra/insightvis` is **public, readable and now pushable** — `git push origin main`
  succeeded on 2026-09-15. (Earlier sessions had read-only access and committed locally only; that
  note is kept here because if push ever fails again, the remedy is to reconnect GitHub under
  claude.ai Settings → Connectors with the owning account, or add the working account as a
  collaborator.)
- Local working clone: `/home/user/pranshukesavmishra/insightvis`
- A separate repository, `pranshukesavmishra/sih-2026`, is also attached to this workspace.
  It is unrelated to InsightVis. Do not mix work between them.

---

## 12. Decision log

Append only. Never rewrite history.

| Date | Decision | Rationale |
|---|---|---|
| 2026-09-11 | Scoped across Physics, Chemistry, Maths, Biology for JEE + NEET | One engine serves both exams; syllabi overlap heavily |
| 2026-09-11 | Three-layer architecture (Pedagogy / Render / Simulation core) | Engine must be testable without a browser; physics correctness is the top risk |
| 2026-09-11 | Uniform seven-part simulation anatomy + guided walkthrough | Consistency across a large catalogue; multi-representational learning |
| 2026-09-11 | **Graphics/UX elevated to a hard client mandate** | Stated explicitly by the client: "no compromise" |
| 2026-09-11 | **Content pitched at competitive-exam difficulty, not school level** | JEE/NEET are elite filters; school-level content is worthless here |
| 2026-09-11 | Built v1 as dependency-free vanilla JS + Canvas 2D, not Next.js + R3F | Artifact CSP is narrow; hand-rolled 3D gave full control of the phosphor aesthetic and zero dependency risk |
| 2026-09-11 | Dark-committed single theme | Additive blending for fields, orbitals and traces requires a dark ground |
| 2026-09-11 | Subject accents grounded in real subject artefacts (phosphor cyan / sodium amber / eosin rose) | Avoids generic AI-default palettes; each colour means something |
| 2026-09-12 | Depth over breadth: two experiments per chapter, not one per topic | Client asked for more experiments *within* a topic |
| 2026-09-12 | Engine v2: multi-plot, hover inspection, typed numeric entry, ghost compare, notebook, quizzes | Exam-level work needs exact inputs, comparison and self-testing, not just a slider |
| 2026-09-12 | `extend(id, patch)` hook rather than rewriting the original six | Deepens shipped sims without risking regressions in working physics |
| 2026-09-12 | **`art-bio.js` — one anatomical figure library, no hand-drawn anatomy in sims** | Client rejected the v3 biology figures as unrealistic; a single library keeps every lab's anatomy correct and consistent |
| 2026-09-12 | Myelin modelled as a real cable property, not a drawing | A toggle that only changed the picture would violate mandate 2.1; internodes genuinely lose their channels and the spike genuinely jumps |
| 2026-09-12 | Vertebrate-heart lab keeps its schematic circulation loops but draws the organ | The loops are the teaching point; only the heart itself needed to stop being four boxes |
| 2026-09-13 | **A control audit that runs the UI, not just greps it** | The client reported dead controls; static analysis alone gives false positives on dynamic `p[key]` access and misses stale-DOM bugs |
| 2026-09-13 | Graphics upgrades built into `lab-core`, not per-sim | Ten layers applied once lift all 26 labs; per-sim tweaks would drift apart immediately |
| 2026-09-13 | Organic chemistry chosen as the fifth subject block, five labs deep | Highest-yield JEE Advanced territory that was entirely missing, and all five topics have genuinely computable models |
| 2026-09-13 | **The organic labs become the template for every future experiment (§2.5)** | Client called them the right type at 50% of expectation — so copy the shape, and treat the current depth as halfway, not done |

---

## 13. Session log

- **2026-09-25 (c)** — **Client: "when I scroll over the controls, the whole page scrolls too; give the controls their own scroller".**
  - The side column (\`.col-side\`) is now a sticky pane: \`top:64px\`, \`max-height:calc(100vh − 76px)\`,
    \`overflow-y:auto\` and \`overscroll-behavior:contain\`. The wheel over it moves only the controls,
    so the stage stays in view while a slider changes.
  - The left rail is contained the same way.
  - In one-column layouts (≤1120 px) the control deck body has its own scroller, 62vh at most.
  - Verified with the wheel at 1500, 1000 and 390 px: window.scrollY does not change.
  **Lesson:** a max-height flex column squashes \`overflow:hidden\` panels instead of overflowing.
  It needs \`.col-side > * { flex-shrink: 0 }\`.

- **2026-09-25 (b)** — **Client: "more upgrades according to the JEE Main and Advanced point of view".** I read this as
  covering the syllabus's classic problem types, each one computed:
  - **Gravitation 'shapes' mode**: a brute-force superposition over up to 3000 point masses (ring, disc,
    shell, sphere, cavity, polygon), with a softened sum and the axis peak refined by a parabola.
  - A `vr = 0` drop panel.
  - **Fluids**: a hydraulic lift (effort integrated over the stroke), the force on a wall (800
    strips, oil layer, tilt), and merging drops (the area summed as they absorb).
  - 12 new problems, all measured within tolerance: gravitation 4, fluids 8.
  **Lessons:**
  - 1000 `R3.sphere` calls a frame stalled the page (a screenshot timeout). Pre-shade one sprite per
    colour and depth-sort the drops by hand with `drawImage`.
  - Pressure arrows inside a translucent volume get hidden by the wall slab. Put them on the near
    glass plane.
  - A new mode with sub-modes needs its own camera key (`pascal-lift`/`pascal-dam`).

- **2026-09-25 (a)** — **Client: "large upgrade needed, especially gravitation — unsatisfied".** The orbit
  bench had been a 2D equatorial picture with an energy-vs-time plot. Added:
  - Real 3D orbits: an inclination i and an in-plane ω applied as one `rot()` to every drawn point
    and vector.
  - A ground track: each past position taken into the Earth frame at the time it was flown, then
    rotated to now.
  - Eclipses, a satellite glow, and an effective-potential plot with the turning points.
  - A **Solar System** mode: ten bodies from J2000 elements (R_z(Ω)R_x(i)R_z(ω)), integrated and
    timed. Kepler III is plotted from the measurements; Halley's retrograde, e = 0.967 orbit comes
    out at T = 75.31 yr and v_p/v_a = 59.86.
  **Lessons:**
  - A zoomed-out scene must suppress labels crowding the centre (a screen-distance test).
  - Walkthrough blocks appended in patches need a comma check: two SyntaxErrors came from exactly this.

- **2026-09-24 (a)** — **Client: batch 3 liked, "upgrade very much… think what else you can do, ultra
  level".** I read "ultra level" per §2.10 as **new physics the student drives**, not more polish.
  Every addition computes its result, and each has problems checked against the apparatus.
  **Gravitation** (now 5 set-ups):
  - Mission control: a stage button fires a Δv, and `runOrbit(p, state)` restarts from any state.
  - The Hohmann autopilot fires at apogee, found by bisection on ṙ; it ends at e = 1e-4 after a
    5.27 h coast.
  - A rendezvous target shows the speed-up-to-fall-behind paradox.
  - A two-body potential landscape with marching-squares equipotentials, the neutral point at
    0.900 d, and v_min = 11.07 km/s against 11.19 km/s escape. A hollow shell gives a flat floor.
  **Fluids** (now 8 set-ups):
  - An accelerating cart: the first sloshing mode overshoots to about 2 × arctan(a/g); the pendulum
    swings back and the helium balloon leans forward.
  - A spinning vessel: a volume-conserving paraboloid with a dry-spot branch, and Ekman spin-up.
  - Two bubbles on real cap geometry, with Poiseuille flow between them: the small one empties.
  - A U-tube with two liquids, and an integrated oscillation of 1.003 s.
  **Lessons:**
  - A button can be a stage handle that fires on `phase === 'start'`; no lab-core change is needed.
  - A mission needs a fixed frame (`rDisp` covers the target and the ghosts), or the scene rescales
    at every burn.
  - A single-quad colour band looks blocky on a height field: shade smoothly and draw contours as
    segments inside each cell.
  - A backboard texture must match its plane's aspect ratio, or its labels squeeze unreadable
    (`boardTex(wpx)`).

- **2026-09-23 (d)** — **Client: batch 2 is "okay, not excellent"; make batch 3 better "in working by all
  parameters".** Built **Gravitation** (4 set-ups) and **Fluids** (5 set-ups) in `sims-physics11.js`,
  one IIFE holding both labs.
  **New techniques, reusable:**
  - **Ray-traced planets** (`traceBody`):
    - Each pixel in the disc's box is a ray intersected with the sphere.
    - The hit point is turned into latitude and longitude on a procedural equirectangular texture,
      sampled bilinearly, then lit with a soft terminator, ocean glint and city lights.
    - `o.cut` removes the y < 0 half and colours the section face by radius (the PREM layers).
    - The pixel budget is about 170k per frame (≈20 ms).
  - **Glassware and liquids as volumes** (`glassCyl`, `liquidCyl`): the convex hull of the two rim
    ellipses, filled nearly clear with silhouette streaks for glass, or with a graded tint and a lit
    surface for liquid. Contents are drawn before the liquid so they show through it tinted.
  - **`BENCH.faceTex` now maps each tile as two exact affine triangles.** One affine map per tile
    left dark wedges from steep angles. The shading overlay is applied once per face, and tile counts
    follow each edge's length. `BENCH.rule` has a `flip` option so vertical rules read correctly.
  - `lab-core` now omits a control group whose items are all hidden for the current mode, and
    honours a group-level `when`.
  **Measured, not asserted:**
  - Kepler T to 6 figures; equal areas to 10⁻⁶.
  - Drag run: PE lost ÷ KE gained = 2.05.
  - PREM: g peaks at 10.69 m/s² at 3480 km; tunnel 38.2 min against 42.18 min uniform.
  - Cavendish: G = 6.674 after the far-sphere β and damping (1 − ζ²) corrections, with ζ read back
    as 0.121 against 0.12 set.
  - Tank drain matches the formula to 10⁻¹²; venturi Cd 0.948 (water) and 0.68 (laminar oil).
  - Viscometer: η 10% high from the wall, corrected to within 1%.
  - Capillary: a tube that is too short caps the column at θ = 47.7°.
  **Bugs caught in the build:**
  - A comment pasted onto a line swallowed its code.
  - The drag integrator went unstable: the step now stays below v/a_drag, and re-entry is at 120 km.
  - (S₁ + 2S₂ + S₃)/4 drifted under heavy damping. The exact three-point form is
    (S₁S₃ − S₂²)/(S₁ + S₃ − 2S₂).
  - The venturi Cd was inverted, and an open-exit pipe made every throat reading negative. A
    back-pressure valve was added.
  - A negative absolute pressure was shown instead of boiling.
  - The meniscus sag lost the sign of cos θ and filled the stage for mercury.
  - Labels were drawn in front of a globe that hides their object: ask `hidden(pt)` first.

- **2026-09-23 (c)** — **Client: batch 2 is "only 10–20%", upgrade it very much — visuals, working and
  correctness.** Built **`bench3d.js` (window.BENCH)**, the apparatus layer every future bench should use:
  `wood/metal` procedural textures, `texBox` (textured, lit, per-face sorted), `table`, `clampStand`,
  `bossClamp`, `pulley` (flanges, spokes, hub, turning mark), `rule` (graduated metre rule), `meter`
  (LCD redrawn from a live value), `photogate`, `spring`, `string`, `faceTex`, `shadeOverlay`. Its
  texture mapper must compose with the canvas transform (`ctx.transform`, never `setTransform`) or
  it breaks at devicePixelRatio ≠ 1. The headless harness runs at 1 and would not catch this.
  **Rebuilt all three labs** as instrumented experiments: newton (massive pulley, sliding wedge,
  lift trip + cable cut, motion sensor with LS fit), collisions (soft-contact bumpers with calibrated
  e, force–time and impulse, photogates, air table by strobe, Blackwood pendulum), capacitance (three
  dielectric arrangements on the same Laplace grid, plates on posts with meters, breadboard circuits
  with true resistor colour codes). **Bugs found by reading the code or the renders:**
  - The old free-body diagram drew the Atwood tension horizontal, tilted the ramp normal the wrong
    way, drew ramp friction horizontal, and pointed the push force backwards.
  - A statically indeterminate contact force was reported as 0.
  - The bumper "stuck" test fired exactly when the gliders part.
  - Impulse taken from 2 ms samples undercounted short contacts.
  - A smooth sensor-noise wobble biased the fitted slope by 7%; it must be independent per sample.
  - A large texture sheet sorted by its centre was painted over by a nearer box; split it at the
    boxes' x-cuts (§14.6).

  **Rule:** every value a meter shows must be the value a real instrument would give (gates time a
  flag; sensors fit a noisy record), shown beside the model's value.

- **2026-09-23 (b)** — **Client: labels overlap too much, give a tick box to hide them; and the Cardiac
  Cycle lab is only "10–20%" liked, upgrade it very much.** Added a global **Labels** switch to the
  transport bar in `lab-core.js`, remembered per viewer in localStorage. It gates `R3.label`,
  `R3.callout`, `g.label`, and the `labels`/`leaders` defaults in `art-bio.js` and `art-zoo.js`
  (read `window.__LABELS`); instrument panels stay. New labs must route scene annotations through
  those, or check `g.labels`, so the switch keeps working. **Rebuilt `cardiac` from scratch**: a closed
  eight-compartment circulation with all four valves computed (the old lab faked the right-heart
  valves by copying the left ones), exponential passive LV stiffness so Frank–Starling bends over,
  ECG-driven timing with a 35 ms electromechanical delay, a live Wiggers sweep sampled every
  2.5 ms inside the integration (one sample per frame missed the QRS entirely), seven phases
  classified from the valve states, real murmurs, audible S1/S2 via WebAudio, and blood-flow
  particles pushed by the computed flows. The stage is laid out in fixed zones so nothing can
  overlap. **Lessons:** sample fast traces inside the integrator, not per frame; classify phases
  from state ("has this beat ejected yet"), never from a time cut-off; check event order against
  physiology (MC must follow the QRS) — a sharper picture exposed the missing delay.

- **2026-09-23** — **Batch 2 of ten syllabus labs: Laws of Motion, Collisions, Capacitance**
  (`sims-physics10.js`, artifact v20). *newton*: one linear solve for five rigs, friction settled by
  a three-step test (assume static, read the friction needed, compare with μₛN), and the block
  rotated into the slope through `R3.box` axes. *collisions*: the contact instant solved from the
  geometry, the impulse along the line of centres, the CM drawn as a marker, a view from the CM, and
  the ballistic swing done with RK4. *capacitance*: a finite-volume SOR Laplace solver on the plate
  section with sub-cell permittivity mixing. C comes from the energy and F = ½V² dC/dx from a cached
  25-point C(x); dC/dx equals the ideal 1/d_eff − 1/d to every printed figure at three gaps. RC and
  charge-sharing heat are integrated rather than assumed and equal ½CV² and ½μ_C ΔV² for any R.
  **Lessons for §14:** (1) R3.box sorts each face by its own centre, so two boxes whose large faces
  touch (the slab under a plate) must be cut at shared x-boundaries or one paints over the other from
  behind. Decoration belonging to a section plane (field lines, charge marks) goes in ONE `F.push`
  with that plane, never in free labels, which float in front from every angle. (2) A drag gain per
  metre of bench fails on a foreshortened axis; use a fixed gain per screen pixel (§2.13). (3) At
  430 px two stacked panels bury a small bench: move one to the top of the canvas, or cut the
  panel down to its comparison rows. `R3.polyline` gained a `dash` option. Audit clean at 40 sims;
  all fifteen new worked answers reproduce their working text.

- **2026-09-15 (b)** — **Batch 1 of ten syllabus labs: Current Electricity, Ray Optics, Waves.**
  Client chose JEE Main/Advanced syllabus topics over Olympiad exotica, so "ultra level" now means
  depth of computation on common chapters. Built `solve.js` first (linear solve, resistive network
  by modified nodal analysis, the 1D wave equation, Snell in vectors, an accumulating histogram) so
  ten labs reuse machinery instead of inventing it, and added a DC cell and a moving-coil
  galvanometer to `art-physics.js`. **Every solver was verified against hand-worked cases before a
  single pixel was drawn** — series and parallel networks, internal resistance, a balanced
  Wheatstone bridge at 1.8e-17 A, a two-loop Kirchhoff problem giving exactly 19/3 V, the thin-lens
  limit to 4e-5, the thick-lens back focal distance to 0.03%, mirror formula to 5e-6, and the string
  and pipe mode frequencies to five figures. Six real defects found and fixed this way, each
  recorded in its commit: a conductance floor too small to keep a null exact; a 2D least-squares
  crossing point that turned 2 mm of aberration into 60 mm of error; longitudinal aberration measured
  from an off-axis point where it is not defined; field angle breaking the lens formula independently
  of aperture; inverted pipe boundary conditions; and a step-count clamp that broke the Courant
  condition and sent the wave equation to NaN. The waves lab ended up drawing the exact steady state
  rather than an integrator run, because a driven string needs ~Q cycles to settle and Q is in the
  hundreds — the integrator stayed as the authority that fixes the mode frequencies. Audit clean at
  37 sims; all fifteen worked answers reproduce their working.

- **2026-09-15** — **Rebuilt the four earliest physics labs as 3D benches.** The client kept the new
  physics round but singled out lorentz, cyclotron, ydse and resolving as the older generation.
  *Cyclotron*: extruded D-shaped dees tinted by RF polarity, pole faces, a gap that glows only while
  E is on, a draggable dee rim, four worked problems. *YDSE*: an optical bench on a graduated rail
  whose screen carries the intensity integral column by column in true colour with exact sin θ, plus
  four pieces of physics it never had — a thin plate over one slit, immersion, unequal slits and
  white light — three drag handles, a phasor panel, an order-number plot, five problems and a
  nine-step walkthrough. *Resolving power*: the real two-dimensional Airy image painted on the focal
  plane through a new `R3.texPlane`, a logarithmic aperture from a pinhole to Hubble, instrument
  presets, the microscope form 0.61λ/NA, the Sparrow limit, and a resolved/not-resolved verdict that
  scans the profile instead of comparing two numbers — which caught the old lab calling an unequal
  pair resolved. Removed the stale `sims-extend.js` patches for lorentz and ydse; the ydse one had
  come to collide over the key `mu`. The orbit sweep then found the pole faces occluding their own
  beam from angles the default camera never reaches, and the instrument panels overlapping at phone
  width. Wrote `sweep.mjs`, `sweepall.mjs`, `narrow.mjs`, `probchk.mjs`, `preset.mjs`, `ydchk.mjs`,
  `dipchk.mjs` and `instchk.mjs`. Audit clean at 34 sims; all fifteen worked answers across the four
  labs reproduce their own working.

- **2026-09-14 (c)** — **Acted on the 40%.** Client: *"i like what you built, but i like only 40% so it
  still need very much upgradations."* Recorded the build method and the calibration table (§2.11, §2.10)
  at the client's explicit request, then went after the gap those sections name.
  - **`render3d.js`** — the 3D apparatus layer, and the biggest single change. The engine has had a
    working camera since v2 and **not one physics lab used it**. Primitives are submitted to a frame,
    depth-sorted and drawn in one pass: lit spheres, cylinders and tubes (each wall quad shaded by its
    own normal, so a body genuinely turns as the camera moves), boxes, gridded planes, 3D arrows,
    coils, contact shadows, wireframe spheres, world-anchored labels, and a cheap `polyline` for paths
    of thousands of points — field lines would cost more than the rest of the frame as lit cylinders.
  - **Five benches are now genuinely 3D**: `rolling` (a wedge with thickness, four bodies abreast in
    lanes, spokes on the end faces), `gauss` (field lines traced in 3D, a real wireframe Gaussian
    sphere carrying its sample points and normals), `kinetic`, `induction`, `heatengine`.
  - **The student builds the input** (§2.5, long outstanding): `g.handle` + `def.onDrag` in lab-core,
    with the control widgets kept in sync by `R.ctlSync` so a drag moves the slider that owns the
    parameter. Wired to the gauss charges and Gaussian sphere, the rolling release gate and incline,
    and the resonance mass. Verified end to end by `drag.mjs`.
  - **Worked problems** — a predict-then-check panel: a real exam question, a committed numeric answer,
    then the value the apparatus itself computes, and the working. On six physics labs so far.
  - **Three new labs**: kinetic theory, induction, heat engines. All three validate against theory on
    screen (Carnot reproduces its own limit to 0.05%; net ΔS ≈ 10⁻¹⁷ J/K; measured pressure within a
    few percent of nkT).
  - Bugs found and fixed while building: the kinetic-theory cell list applied its `j <= i` filter
    across cells as well as within them, silently dropping **half** the collisions — it showed up as a
    mean free path nearly twice too short. The Carnot construction let the volume run far past the
    assumed maximum, so the cycle is now rescaled before integration. The worked-problem panel was
    overriding every lab's defaults at mount, and ran before `def.setup`.
  - Verified: `audit.mjs` CLEAN across **34 sims / 20 chapters**, `shot.mjs` clean, `resz.mjs` stable
    at all four breakpoints, `drag.mjs` confirms each handle writes through.

- **2026-09-14 (b)** — **Shipped five new physics labs.** Client: *"now make next 5 best experiments
  for physics, more best than organic chemistry, with high JEE Mains and Advance level of experiments
  for ultra visualisation."* Physics had only four labs across two chapters; these five open five new
  chapters, all top-weight for JEE Main + Advanced.
  - **`art-physics.js`** — the physics figure library, the counterpart of `art-bio.js`/`art-organic.js`
    (mandate §2.5 item 3). Lit rigid bodies with surface markings (the rotation has to be *visible* or
    rolling and sliding look identical), wound springs, hatched surfaces, proportional vectors, real
    circuit components, flat instrument dials, an evacuated photo-cell, and a wavelength→visible-colour
    ramp so 400 nm actually looks violet.
  - **`rolling`** (System of Particles & Rotational Motion) — nothing is told to roll. The friction
    rolling *requires* is computed each step and tested against μN; fail it and the equations decouple
    and the body slips. Bodies run out along the flat afterwards, which both stops them piling on the
    finish line and shows that rolling on a horizontal surface needs no friction at all.
  - **`resonance`** (Oscillations) — RK4 on the damped driven ODE, so the transient is a real transient.
    The coupled pair is solved by **diagonalising the stiffness matrix**: the normal-mode frequencies on
    screen are its eigenvalues and the mode cards draw the eigenvectors.
  - **`gauss`** (Electric Charges & Fields) — the flux is **measured**, not asserted: E·n̂ summed over a
    Fibonacci lattice of 600 points on a real sphere, printed next to q_enc/ε₀. Field lines are traced by
    integrating dr/ds = Ê; equipotentials by marching squares.
  - **`lcr`** (Alternating Current) — the circuit equation integrated, with an option to start on the
    steady-state solution instead. Rotating phasors, impedance triangle that flips with the sign of
    X_L−X_C, and voltmeter bars scaled so that at high Q the *supply* bar is the short one.
  - **`photoelectric`** (Dual Nature) — Einstein's equation driving a real photo-cell, the I–V family,
    the V₀–ν line whose slope is h/e for every metal, and the energy-level picture of the surface.
  - Verified: `audit.mjs` CLEAN across **31 sims / 17 chapters**, `shot.mjs` clean, `resz.mjs` stable at
    all four breakpoints. Published artifact **Version 13**.
  - `audit.mjs` earned its keep again: it caught two controls I had declared and never read
    (`resonance.trace`, `lcr.showTransient`). Both are now wired to real behaviour rather than deleted.

- **2026-09-14 (a)** — **Drove the volume pass through four more biology plates** and fixed two
  renderer bugs that had been silently corrupting figures.
  - **`ctx.beginPath()` destroys the current path, and `clip()`/`stroke()` use the current
    path.** In `BIOART.heart` the grain loop's per-dot `beginPath()` meant the spiral muscle
    bands were clipped to a single grain dot (invisible) and the closing `stroke()` re-stroked
    the *last band polyline* instead of the silhouette — that was the stray red arc under the
    heart. Fixed by making the silhouette a reusable `myoPath()` function re-laid before every
    clip and stroke. **Rule: never rely on a path surviving a loop that calls `beginPath()`.**
  - **`g.mix()` returns `'rgb(...)'` and cannot be parsed by `g.mix()` again.** Nesting it
    yields `NaN` → black. This had turned the blood cells and the capillary bed in `ak-heart`
    solid black. Anything that gets mixed twice must use the hex-returning `RX.mix`. This is the
    second time this exact trap has cost a figure (see the chamber-cavity bug in §7).
  - **`ak-heart` rebuilt to the plate standard**: lungs drawn as lobed lungs with fissures and a
    bronchial tree, gills as four holobranchs with filaments coloured by the oxygen they are
    loading, the tissues as a real capillary bed whose blood darkens across it, vessels as round
    `RX.tube` circuits with named leader labels, the animal moved into the header band. The fish
    circuit was also **factually wrong** — it ran blood into the efferent side of the gills; it
    now leaves by the ventral aorta, enters afferently, and is collected dorsally.
  - **`synapse` rebuilt**: the bouton is a lit solid with two cristate mitochondria and smooth ER,
    the nicotinic receptor is a five-subunit funnel with its two α-binding sites and a pore that
    opens in proportion, the end plate runs off both edges (the hard rectangle was what made it
    read as pasted on), and a ×40 inset shows one receptor at the moment of binding.
  - **`ak-wvs` rebuilt**: a real asteroid — central disc, five tapering arms, ossicle plates,
    spines, papulae, madreporite with sieve grooves, Tiedemann's bodies. **The arm profile was
    phase-shifted off the radial canals** (`cos(2.5a)` without the `-π/2` the arm axes carry),
    so the body lobes sat *between* the arms. Tube feet are drawn under the canals, not over.
  - **`ak-coelom` rebuilt**: a germ layer is now a sheet of *cells* — a lit band with radial cell
    walls and a nucleus per cell — and the mesoglea deliberately has none, because it is
    acellular. The dartboard of flat rings is gone.
  - Verified: `audit.mjs` CLEAN (26 sims), `shot.mjs` clean, `resz.mjs` stable at all four
    breakpoints. Published artifact **Version 12**.

- **2026-09-11 (a)** — Cloned repo (near-empty: placeholder README). Established brief, scope,
  architecture, conventions. Wrote `README.md` and `memory.md`. Identified push-access blocker.
- **2026-09-11 (b)** — **Built and shipped Insight Smart Lab v1.** Selected six experiments
  (2 each from Physics, Chemistry, Biology). Built `lab-core` framework + three simulation
  modules + full instrument-console design system. Numerically verified the Hodgkin–Huxley
  model (found and fixed a non-propagating cable and a subthreshold default), fixed a real
  runtime bug (`S.intensity` not on the state object), recalibrated orbital framing and
  molecule camera, separated the cardiac aorta colour from the LV trace. Published as an
  artifact. Recorded the client's three standing mandates in §2.
- **2026-09-12 (b)** — **Shipped v3: the Animal Kingdom suite.** Nine labs plus a shared taxonomic
  data core and an organism-art module. Ran the five requested upgrade passes in order and recorded
  what each one changed. Verification caught the white-button theme-token bug and an unguarded
  `setPointerCapture`; both are now in §7 and §8 so they cannot recur.
- **2026-09-13 (h)** — Asked the client directly what "good" looks like; answer was rich 3D
  realism **and** vivid colour **and** more detail, judgement mine. Added the volume pass to
  `render.js` (`RX.ball`, `RX.tube`, `RX.volume`, `RX.sat`) and rebuilt the cnidarian lab on it:
  tentacles are now round lit tubes carrying batteries of cnidocytes, the gastrovascular cavity
  reads as a cavity with light spilling from the mouth, the body wall is three lit tissue bands,
  and the cnidoblast is a solid cell with a shaded nucleus, a striated mitochondrion, a Golgi
  stack and a bright coiled tubule in a dark lumen. Rules in §2.9.
- **2026-09-13 (g)** — Client: still "very much upgrade" needed on graphics. Layout was no longer
  the problem, so built `render.js`, an illustration renderer every figure library now draws
  through — lit gradients, ambient occlusion, rim light, tissue grain, cast shadows and
  light-aware contours. Reworked the Hydra body wall from per-cell drawing into lit tissue bands,
  gave the nematocyst a genuinely dark lumen so the coiled thread reads, and removed the
  low-alpha wash that made the cnidoblast a smudge. Lessons recorded in §2.8.
- **2026-09-13 (f)** — Client reviewed the whole biology suite and approved exactly three labs
  (nerve impulse, sponge canal system, cnidaria), calling the rest very bad. Extracted what those
  three have in common and recorded it as mandate §2.7, the plate standard. Rebuilt the cardiac
  cycle and cardiac conduction labs to it: the heart is now a large labelled plate with every
  vessel, valve and chamber named, the Wiggers stack moved out to the plots panel, a magnified
  cardiac muscle fibre with intercalated discs and a nodal pacemaker cell as insets, and scale
  bars throughout. `BIOART.heart` gained muscle-fibre banding, endocardial lining and clipped
  coronary vessels; `BIOART.myocyte` is new. **Still to do: the synapse, the phylum-card cartoons,
  and the six remaining Animal Kingdom labs.**
- **2026-09-13 (e)** — Client rejected the biology suite outright: graphics worst, substance also
  unsatisfying. Diagnosed it from screenshots rather than guessing, recorded it as mandate §2.6,
  and built `art-zoo.js` — a real zoological and histological figure library. Rebuilt the two worst
  labs on it: the cnidarian lab (Hydra as a longitudinal section with both epithelia drawn as cell
  sheets, mesoglea, gastrovascular cavity, tentacle nematocyst batteries; the cnidocyte magnified
  with a proper capsule, operculum, cnidocil, coiled tubule, barbs and stylets) and the sponge canal
  system (ostia, canals, flagellated chambers with rings of collar cells, spongocoel, osculum,
  spicules, plus a magnified choanocyte). **Still to do: the phylum-card cartoons in `art-animalia.js`,
  and converting the data-browser labs into things that actually compute.**
- **2026-09-13 (d)** — Client reported the stage box growing without limit. Reproduced it
  (~35 px/second, every lab), traced it to a canvas-intrinsic-size feedback loop against
  `aspect-ratio`, fixed it and added two regression harnesses. Stage now holds exactly 16:9 at
  every breakpoint. Rule recorded in §8.
- **2026-09-13 (c)** — **Started on the §2.5 list, beginning with animated mechanisms.** Built
  `mech.js`, then put it to work in four labs: the full three-step EAS mechanism (π attack →
  arenium with δ+ on the three carbons that carry it → rearomatisation), the carbocation lab's
  three- or four-step mechanism including the 1,2-hydride and methyl shifts and the radical chain
  under peroxide, and curly-arrow insets on SN1/SN2 and E1/E2 — those two already animated their
  geometry in 3D but never showed the electron flow, which is the part an exam answer has to
  reproduce. Added `steps.mjs`, which walks every scene of a mechanism and screenshots each, so a
  broken intermediate cannot hide behind a good-looking first frame.
- **2026-09-13 (b)** — Client reviewed v5: the organic chemistry experiments are the right kind of
  work, at **50% of expectation**, and are to be the template going forward. Recorded as standing
  mandate §2.5, together with a prioritised list of where the missing half sits — animated
  step-by-step mechanisms, student-built inputs, real 3D for conformers and stereocentres, more
  linked experiments per chapter, a predict-then-check worked-problem mode, and the organic
  chapters still uncovered.
- **2026-09-13 (a)** — **Shipped v5: the organic chemistry suite and ten graphics layers.** Built
  `art-organic.js` (skeletal structures, curly arrows, Newman projections, cyclohexane chairs,
  tetrahedral stereocentres, p-orbital lobes, reaction profiles) and five labs on top of it:
  Hückel MO theory with live Jacobi diagonalisation, conformational analysis, electrophilic aromatic
  substitution from Hammett constants, chirality/CIP/polarimetry, and carbocation rearrangement with
  an integrated kinetic scheme. Wrote `audit.mjs` after the client reported dead controls, which found
  and fixed two. Then added ten rendering layers to `lab-core` — instrument ground, bloom, collision-aware
  labels, perceptual ramps, tweening, lit materials, hit targets, layout grid, scale chrome and quality
  tiers — so all 26 labs gained them at once.
- **2026-09-12 (c)** — **Shipped v4: anatomical biology figures.** Client reported the v3
  biology diagrams as unrealistic and hard to visualise. Confirmed it from screenshots (the
  cardiac "heart" was an angular blob with floating ellipses; the axon was a plain rectangle
  and the "bilayer" a row of grey circles). Built `art-bio.js` and rewired five labs onto it:
  cardiac cycle, nerve impulse, synapse, cardiac conduction and the vertebrate-heart evolution
  lab. Added a working myelin toggle with real saltatory conduction. Rebuilt the mammal
  silhouette as a jointed quadruped. Ran repeated screenshot-verify-fix cycles per figure,
  which caught: `mixHex` returning `rgb()` and producing black chamber cavities; the aortic
  arch sweeping to the wrong side; semilunar valves rendering as invisible specks; receptors
  floating off a curved membrane; label collisions in five places; a normalised/pixel unit mix
  that made the mammal's legs 300 px long; and a long-standing bug that left the conduction
  velocity readout permanently blank. All 21 labs verified clean headless.
- **2026-09-12 (a)** — **Shipped v2.** Upgraded the engine (multi-plot with hover crosshair/tooltip,
  click-to-type numeric entry, ghost comparison overlay, fullscreen stage, lab notebook, quiz
  engine, chapter-grouped navigation, keyboard shortcuts, `extend()` hook). Added six new
  experiments so every chapter has two: cyclotron, diffraction & resolving power, Bohr model &
  hydrogen spectrum, E1/E2 elimination, the synapse, and cardiac conduction with heart block.
  Deepened the original six with extra controls (refractive-index immersion in YDSE), second
  graphs (1/B scaling, signed R(r), rate-vs-[Nu], gating variables, Frank–Starling) and a
  four-question quiz each. Caught the same method-on-state bug class again (`S.psf`) — the rule
  is now in §8. Verified all twelve run clean in a headless browser.

---

## 14. THE LAB SPECIFICATION — every structure, every field, copy this

Written at the client's request (2026-09-15): *"put all you building formats and structures in
memory md file, so when we have to build other experiments so it will be remembered."*

§2.11 is the **procedure** — what to decide, in what order. This section is the **format** — the
exact shape of the thing you produce. Read §2.11 first to know what to build; read this to know
how to write it down. Every field listed is one `lab-core.js` actually reads; the ones marked
*optional* in 14.2 are the only ones a lab may leave out. Everything else absent is a blank panel
in the console, not a smaller lab.

**The legacy singular plot API still exists** — `plotTitle`, `legend`, `drawPlot`, `hoverPlot` —
and a few early labs use it. **Do not write new labs against it.** Use `plots: [ … ]`; §2.11 step 6
wants two plots and the array is the only form that takes them.

### 14.1 Where the code goes

One IIFE per file, several labs per file, registered on load:

```js
(function (L) {
  'use strict';
  const { clamp, TAU, fmt, E, Camera } = L;          // engine utilities
  const PA = window.PHYSART, R3 = window.R3, RX = window.RX;   // figure + render layers

  const QE = 1.602176634e-19;                         // module-level constants
  function helperUsedByThisLab(x) { ... }             // module-level maths

  L.register({ /* lab 1 */ });
  L.register({ /* lab 2 */ });
})(window.InsightLab);
```

- New labs go in the **next numbered file for that subject** (`sims-physics9.js`), never appended
  to a full one. Two labs per file is the working size; four is the limit.
- Add the `<script>` tag to `index.html` **in the existing order**: `lab-core.js` first, then data,
  then the render layers (`render.js`, `render3d.js`), then the art libraries, then `mech.js`,
  then every `sims-*.js`, and `sims-extend.js` last. Order matters — `window.R3` must exist before
  a sim file's IIFE runs.
- Module-level helpers (a Bessel function, an intensity integral, a species table) live **above**
  `L.register` in the same file and are shared by the labs in it. Never hang them off `S` or `this`
  — see §8 for the method-on-state bug that has bitten this project three times.

### 14.2 The registration object — every field in order

```js
L.register({
  /* ---- identity: drives the nav rail, the chapter grouping, the exam tags ---- */
  id: 'ydse',                      // unique, lowercase, no spaces — also the drag/preset key
  subject: 'physics',              // 'physics' | 'chemistry' | 'biology' — sets the accent colour
  name: "Young's Double Slit — Path Difference to Fringe",
  chapter: 'Wave Optics',          // groups it in the rail; match an existing string exactly
  exams: ['JEE Main', 'JEE Advanced', 'NEET UG'],
  weight: 'Very high yield',       // shown as a tag; be honest, not promotional

  /* ---- stage behaviour ---- */
  is3D: true,                      // enables orbit-drag on the canvas and the ⌖ View button
                                   // (which calls cam.reset() back to the theta/phi/dist you
                                   // passed to Camera(), captured as cam.home at construction);
                                   // requires S.cam to exist by the end of setup()
  autoplay: true,                  // optional — starts the transport on mount
  ground: false,                   // optional — suppress the instrument-ground wash
  stageHint: 'Drag to walk round the bench · drag the screen along the rail · drag P',
                                   // one line under the stage; name EVERY gesture that exists

  /* ---- the opening paragraph ---- */
  lede: 'Two coherent slits, one screen, and a single controlling quantity: ...',
                                   // 3–5 sentences, <b> on the load-bearing phrases.
                                   // Say what is REAL about it: what is integrated, what is
                                   // computed, what the student can break.

  /* ---- state ---- */
  params: { lam: 589, d: 0.25, mode: 'double', sweep: true },   // every control's key, with defaults
  presets: [ { name: 'Sodium lamp 589 nm', params: { ... } }, ... ],  // 5–8; see 14.3

  controls: [ { group: 'Source', items: [ ... ] }, ... ],       // see 14.3

  setup(S) { ... },                // see 14.4
  step(S, dt) { ... },             // see 14.4

  /* ---- the picture ---- */
  drawStage(S, g) { ... },         // see 14.5 / 14.6
  onDrag(S, e) { ... },            // see 14.7

  /* ---- the numbers ---- */
  plots: [ { title, legend, draw(S,g), hover(S,x) }, ... ],     // 2, see 14.8
  readouts(S) { return [ ... ]; },                              // 6–11, see 14.9
  equation(S) { return '...html...'; },                         // live-substituted, see 14.10
  eqNote: '<b>...</b> ...',                                     // what the equation does NOT say

  /* ---- the teaching ---- */
  problems: [ ... ],               // 4–5, predict-then-check, see 14.11
  walkthrough: [ ... ],            // 5–9 steps, ask-then-reveal, see 14.11
  quiz: [ ... ],                   // 4–5 questions, see 14.11
  notes: '<b>Where this shows up in the paper.</b> <ul>...</ul> <div class="pyq">...</div>'
});
```

`L.extend(id, {...})` patches a registered lab. The full patch surface is `params`,
`addControlGroups`, `addPresets`, `addPlots`, `addReadouts`, `wrapSetup`, `wrapStep`, `hover`
and `quiz`. **Prefer building the material natively.** The extend layer
was written when labs were thin; on 2026-09-15 the YDSE patch had to be deleted because it had come
to collide over the key `mu`. Use `extend` only to add to a lab you are not otherwise touching.

### 14.3 Controls and presets

```js
controls: [
  { group: 'Apparatus', items: [
    { key: 'mode', type: 'select', label: 'Aperture', restructure: true, options: [
      { value: 'double', label: 'Double slit' }, { value: 'single', label: 'Single slit' }] },
    { key: 'd', label: 'Slit separation <i>d</i>', min: 0.06, max: 0.8, step: 0.005,
      unit: 'mm', fmt: v => v.toFixed(3), restructure: true },
    { key: 'trail', type: 'toggle', label: 'Show the spiral trail' }
  ] }
]
```

- No `type` ⇒ a slider. `type: 'select'` ⇒ a segmented button row. `type: 'toggle'` ⇒ a switch.
- **`restructure: true` means "call `setup()` again on change".** Anything that changes a derived
  quantity, a geometry or an array length needs it. Anything that only changes how a frame is
  drawn must NOT have it, or the run restarts on every tick of the slider.
- `label` takes HTML; wrap symbols in `<i>` so they render in the maths face.
- **`unit` is always real SI or the exam's own unit** (§6 rule 3). No 0–100 sliders, ever.
- `fmt` controls the readback only. For a quantity spanning decades, make the **slider key the
  log** and let `fmt` show the real value — that is how the resolving lab puts a 0.5 mm pinhole and
  Hubble's 2.4 m mirror on one control:
  `{ key: 'logD', min: -0.30, max: 3.40, fmt: v => Math.pow(10, v).toFixed(2) }`.
- Group names are headings in the deck. Give every group a purpose a student would recognise:
  *Source*, *Apparatus*, *Thin plate over slit 1*, *Medium*, *Display*.
- **Presets are experiments, not bookmarks.** Each one must show something the defaults do not:
  the missing-order case, the detuned case, the immersed case, the unequal case, the instrument
  case. Name them in the student's words (`'Missing orders (d = 3a)'`, `'Your own eye'`).
- **A preset must set every parameter it depends on.** A preset that leaves `plate: true` from the
  previous preset is a bug the audit will not catch. Spell out the whole state.

### 14.4 `setup(S)` and `step(S, dt)` — the contract

```js
setup(S) {
  const p = S.p;                       // p is the live parameter object; S.p.key === params.key
  if (p.a >= p.d) p.a = Math.max(0.02, p.d * 0.4);   // clamp impossible combinations HERE
  S.lam = p.lam * 1e-9;                // derived SI quantities, computed once
  S.beta = S.lamM * p.D / S.d;
  if (!S.cam) {                        // 3D: create ONCE, never on every setup, or orbit resets
    S.cam = Camera({ theta: -2.08, phi: 0.32, dist: 3.95, target: [0.30, 0, -0.10] });
    S.cam.minDist = 2.0; S.cam.maxDist = 14;
  }
  S.trail = []; S.t = 0;               // reset the run
}
```

- `setup` runs on mount, on every preset, on every `restructure` control, and from `onDrag`.
  **It must be idempotent and cheap.** Anything expensive belongs in a cache keyed on the inputs
  (see `airyImage(S)` in `sims-physics2.js`, which rebuilds its ImageData only when the key changes).
- **Guard the physically impossible.** A velocity selector with `E = 0` is not a selector; a slit
  wider than the separation is not two slits. Fix it in `setup` and say so in a comment.
- `step(S, dt)` advances the integrator. `dt` is already scaled by the speed control and clamped.
  Sub-step internally when the integrator needs it (`n = clamp(Math.ceil(want / hMax), 1, 900)`).
  Trim history arrays every step (`while (S.trail.length > 14000) S.trail.shift();`).
- State lives on `S`. **Never store a function on `S`** — §8.

### 14.5 `drawStage(S, g)` — the 2D plate

Lay the plate out to §2.7 **before drawing anything**:

```js
drawStage(S, g) {
  const ctx = g.ctx, th = g.theme, p = S.p, W = g.w, H = g.h;
  const HDR = 62, FOOT = 34;                  // reserved bands — nothing may cross them
  const y0 = HDR, y1 = H - FOOT, CH = y1 - y0;
  ...
}
```

`g` carries: `ctx, w, h, theme, alpha(col, a), mix(a, b, t), now, dt, ramp, tween, label,
sphere, shadow, layout(cols, rows, pad), scaleBar, hit, handle, dragging, pointer, quality`.

- `th` keys: `text text-2 text-3 accent line line-soft ink-950…ink-700 phys chem bio ok warn crit`.
- Draw through the subject's art library (`PA.*`, `BIOART.*`, `ORGART.*`), never ad-hoc shapes.
- **`g.mix()` returns `rgb(...)` and cannot be re-parsed; `RX.mix()` returns hex.** §6 rule 10.
- The header is three lines at most: a state line in 19 px bold, then two 10 px mono lines of live
  values. It must **never state a rule the stage is not currently obeying** — check the mode first.

### 14.6 The 3D bench — construction order and depth policy

Build in this order, every time:

```js
const cam = S.cam, F = R3.Frame(ctx, cam, { ambient: 0.26, floorZ: null });
// 1. screen-space helpers, so labels can ask the projection which way is "away"
const O = cam.project([0.4, 0, 0]);
const away = (pt) => { const q = cam.project(pt); return (q.ok && O.ok && q.x < O.x) ? -1 : 1; };
// 2. the rail / bench / ground            -> bias F.GROUND
// 3. each component, source to detector   -> bias 0
// 4. the beam, the trail, the particle    -> bias 0
// 5. markers and handles                  -> small negative bias
F.render();                                // <- everything above is queued, this paints it
// 6. 2D overlay: instrument panels, screen-space handles, header
```

**`R3` primitives:** `Frame, sphere, cylinder, tube, box(centre, FULLsize, colour), plane, texPlane,
arrow, coil, polyline, wireSphere, label, callout`, plus `norm sub add scale dot cross perp LIGHT`.
`F.push(at, drawFn, bias)`, `F.shade(colour, normal, opts)`, `F.shadow`, `F.GROUND`, `F.SKY`.
Z is **up**, matching `Camera`.

**THE DEPTH POLICY — four bands and nothing else** (this cost two client-reported bugs):

| Band | Use for | Value |
|---|---|---|
| `F.GROUND` | **only** a surface other things physically stand on — the rail, the floor, the bench | `F.GROUND` |
| true depth | every component: lamp, stop, lens, plate, screen, magnet, dee | `0` (omit) |
| a few hundredths | decoration belonging to one component: a glow, a ruler, a marker on a face | `-0.02 … -0.06` |
| `-1e5` | **text only** — `R3.label` and `R3.callout` already apply it | (automatic) |

- **A fraction of `F.GROUND` is not a depth, it is a hard-coded answer to a question the camera
  asks every frame.** `F.GROUND * 0.35` beating `F.GROUND * 0.7` painted a screen over the stop
  standing in front of it. Large negatives (`-2`, `-20`, `-50`) are the same bug with the sign
  flipped: rays drawn through solid plates.
- **A large flat face and the small marks on it are ONE `F.push`.** A slit plate and its slits, a
  stop and its aperture: fill the face `evenodd` so the marks are genuinely holes, then paint the
  light into them. No bias solves this — measure and see: the slit plate's own depth spread was
  0.67 units and the next component was only 0.81 further along.
- **Occlusion is a question about the camera.** Any solid that can come between the camera and the
  subject decides its own opacity every frame: `Math.sin(cam.phi) >= 0 ? …` picks which magnet pole
  becomes an outline ring and which stays solid.
- **A label placed by a fixed screen offset is right from one angle and wrong from the rest.** Ask
  the projection: pick the extreme point of the object's own silhouette (`highest`/`lowest` over
  its rim) and choose the leader direction from `away()`. Where an object is always on one side of
  the picture, hard-code the direction instead of computing it.
- A component drawn at a **compressed or not-to-scale** distance must say so in a callout
  (`'two sources at infinity'`, `'D = 1.20 m · not to scale'`).

### 14.7 `onDrag(S, e)` — letting the student build the input

Register in `drawStage` **after** `F.render()`, in screen space:

```js
const q = cam.project([XS, 0, -0.80]);
if (q.ok) { /* draw the grip */ g.handle(q.x, q.y, 16, 'scrn'); }
```

```js
onDrag(S, e) {                     // e = { id, x, y, dx, dy, phase: 'start'|'move'|'end' }
  if (e.id !== 'scrn' || !S._axX) return;
  const along = e.dx * S._axX.ux + e.dy * S._axX.uy;     // project the drag onto the axis
  S.p.D = clamp(S.p.D + along * S._axX.perPx * GAIN, 0.4, 3.0);
  this.setup(S);                   // `this` is the definition — setup() is yours to call
}
```

- Stash the screen-space axis in `drawStage` (`S._axX = axis(a, b, perUnit)`), because only
  `drawStage` has the camera and the viewport.
- `e.dx` is **incremental**, not cumulative. `g.dragging` holds the held id, for highlighting.
- The engine syncs the owning slider automatically (`R.ctlSync`) — do not touch the DOM.
- **A drag on a compressed axis needs an explicit gain — see §2.13.** Invert the drawn map first,
  then scale so the full range takes about a third of the stage, and say in a comment why.
- Verify with `node drag.mjs <id> <dx> <dy> <handleId>` at several magnitudes **in both
  directions**. A handle that saturates in one flick is worse than no handle.

### 14.8 `plots` — two, answering different questions

```js
plots: [
  { title: 'Intensity along the screen',
    legend: [{ c: '#3DD6F5', label: 'I / I₀ (observed)' }, { c: '#63729A', label: 'envelope' }],
    draw(S, g) {
      const P = g.Plot({ xmin, xmax, ymin, ymax, xlabel, ylabel,
                         xfmt: v => v.toFixed(1), yfmt: v => v.toFixed(1),
                         xticks, yticks, pad }).frame();   // ticks and pad optional
      P.clip(() => { P.area(pts, 0, g.alpha(g.theme.phys, .16)); P.line(pts, g.theme.phys, 2);
                     P.vline(x, col, [3, 3]); P.hline(y, col, [4, 3]); P.dot(x, y, 4, c, ring); });
      P.tag(x, y, 'β = 2.83 mm', g.theme['text-2'], 'left', 0);
    },
    hover(S, x) { return [{ label: 'y', value: '…' }, { label: 'I/I₀', value: '…', color: '#3DD6F5' }]; } }
]
```

- **Plot 1 is this system as it is set. Plot 2 places it on the landscape of all comparable
  systems** — every metal's V₀–ν line, every body's k, the dip curve against every separation.
  The second plot is where the generalisation lives; a second view of the same trace is a wasted
  panel.
- `P.clip(fn)` is mandatory around anything that can leave the axes.
- Always draw the **current state as a dot** on plot 2, so the student sees where they are.
- `hover` returns rows for the crosshair tooltip. Give it the quantity the student is chasing.
- If a curve costs a scan per point, **cache it on `S` keyed on the parameters it depends on** —
  plots redraw every frame.

### 14.9 `readouts(S)` — the strip

```js
{ label: 'Fringe width β = λD/d', value: (S.beta * 1000).toFixed(3), unit: 'mm',
  flag: 'accent', hint: 'λ is λ_vac/n here' }
```

- `flag`: `'accent'` for the headline quantity, `'ok'` / `'warn'` / `'crit'` for a verdict. Flags
  are a traffic light on the physics, not decoration.
- **Put the formula in the label** (`'Period T = 2πm/qB'`, `'Max energy q²B²R²/2m'`). The strip is
  where a student checks their own substitution.
- `hint` carries the thing the number does not say: `'independent of V'`, `'same at every radius'`,
  `'the profile has one maximum'`.
- **Gate readouts on the mode.** A single-slit run must not show fringe width, missing orders and
  visibility. Build the array conditionally.
- Scale the unit with the value (`µm / mm / m / km`), never print `85982 m`.

### 14.10 `equation(S)` and `eqNote`

Built from `E.v(sym) E.n(value, unit) E.op(sym) E.frac(a, b) E.sub E.sup` — hand-rolled HTML,
because **KaTeX cannot load: the artifact CSP blocks it** (§6 rule 8).

- Substitute the live values, so the pane reads `1.22 λ/D = 1.22 · 550 nm / 3.00 mm = 0.2237 mrad`.
- End with the **verdict line** where there is one (`→ yes` / `→ no`).
- `eqNote` says what the equation does **not**: which symbol is missing and why that matters
  (*"Notice what is missing from KE_max: the voltage"*), and any honest discrepancy between what
  the lab integrates and what the exam formula assumes. State those; do not hide them.

### 14.11 The teaching blocks

```js
problems: [                      // 4–5. The student commits a number BEFORE the lab answers.
  { source: 'JEE Advanced pattern · a thin plate over one slit',
    q: 'A plate of μ = 1.50 and thickness 3.60 µm is placed over one slit …',
    params: { … },               // the apparatus state this question describes — complete
    predict: { label: 'shift', unit: 'fringes', tol: 0.03 },
    measure: S => S.nShift,      // read the answer OUT of the running apparatus
    working: 'The plate adds (μ − 1)t = … = <b>3.00 fringes</b>. The pattern moves toward …' }
],
walkthrough: [                   // 5–9. ask BEFORE reveal, every time.
  { title: '5 · Put a plate over one slit',
    body: 'Insert the mica plate. Watch the pattern march sideways …',
    ask: 'Which way does the pattern move — toward the covered slit or away?',
    reveal: '<b>Toward the covered slit.</b> … and crucially <b>β is unchanged</b>.',
    params: { … } }              // puts the apparatus into the state being discussed
],
quiz: [                          // 4–5, single answer, and `why` teaches rather than confirms.
  { q: '…', options: ['…', '…', '…', '…'], answer: 1,
    why: 'Amplitudes add, not intensities. … Set d = 4a in the lab and look at the fourth fringe.' }
],
notes: '<b>Where this shows up in the paper.</b><ul><li>…</li></ul>' +
       '<div class="pyq"><em>Trap to avoid</em>…</div>'
```

- **`measure` must read the running apparatus, not restate the formula.** That is the whole point
  of the mode: the simulation is the marking scheme. Verify every one with
  `node probchk.mjs <id>` and check the printed value against the `working` text **digit for
  digit**. Fifteen of these were checked on 2026-09-15; all fifteen matched.
- `tol` is fractional (0.02 = 2%).
- `why` and `reveal` should point back at the apparatus (*"run it and count the loops"*,
  *"watch the dip fill in without the separation changing"*).
- `notes` closes with one or two `pyq` blocks: the single trap most likely to cost a mark.

### 14.12 The verification harness — run these, do not guess

All in `smartlab/`, all `node <file>.mjs`, all Playwright + the preinstalled Chromium.

| Harness | What it does |
|---|---|
| `audit.mjs` | Clicks **every control and preset on every sim**; catches declared-but-unread controls. **Must print CLEAN before any release.** |
| `probchk.mjs <id>` | Applies each problem's `params` and prints what `measure` returns — check against the `working`. |
| `preset.mjs <id> '[0,3,5]'` | Screenshots the named presets. |
| `mid.mjs <id> <ms> <tag>` | Screenshots one lab after it has been running for `ms`. |
| `sweep.mjs <id> <ms> '[[θ,φ],…]'` | One lab from a list of camera angles. |
| `sweepall.mjs a,b,c` | Several labs at their home view **plus two extremes derived from it**. |
| `narrow.mjs a,b,c` | Renders at 430 px and reports horizontal overflow. |
| `drag.mjs <id> <dx> <dy> <handleId>` | Drives one handle and prints which params changed. |
| `resz.mjs` | Resizes the viewport and checks the stage settles. |
| `geo.mjs` | Prints apparatus dimensions numerically (written after a bench came out wider than it was long). |
| `userview.mjs <id> <preset> <θ> <φ> [json]` | Reproduces an exact client screenshot. |
| `steps.mjs` | Screenshots every scene of a `mech.js` mechanism. |

**Reading the screenshot is part of the build.** Every layout fault in this project's history was
visible in one and found only because someone looked. And for a 3D bench, **the default camera is
not verification** — both client-reported layering bugs were invisible from the view the lab opens
on (§2.12, §14.6).

### 14.13 Numerical verification — what "correct" means here

A lab is not correct because it runs. Before shipping, prove the core against something
independent, and **write the check into the commit message**:

- Reproduce a known analytical limit (Carnot efficiency to 0.05%; net ΔS ≈ 10⁻¹⁷ J/K).
- Show a conserved quantity is conserved (|v| flat to six figures under a pure magnetic field).
- Recover a textbook number from the simulation (orbit radius 104.4 mm against the problem's 104 mm;
  wall-impulse pressure within 1.5–4.4% of nkT).
- Check a special case the formula assumes (equal sources at exactly θ_min give a 0.734 dip; the
  unequal pair at the same separation gives 0.997 and is **not** resolved).
- **When the lab and the exam formula disagree, find out why before "fixing" either.** The measured
  fringe peaks sit a few percent inside nβ because the falling envelope drags each maximum inward,
  and β = λD/d is the flat-envelope limit. That is the lab being more honest than the formula — so
  it is stated in `eqNote`, not silently corrected away.

### 14.14 The ship checklist

1. `node audit.mjs` → **CLEAN**.
2. `node probchk.mjs <id>` for every changed lab → every value matches its `working`.
3. `node sweepall.mjs <changed ids>` → look at all three views of each.
4. `node narrow.mjs <changed ids>` → no overflow, panels stacked.
5. `node drag.mjs` on every handle, both directions.
6. Publish the artifact (`url:` the existing one — never create a second).
7. Sync the changed files to `smartlab/`, update `README.md` §4 and this file's §13.
8. Commit with a message that explains the physics and names the bugs, then
   `git push origin main`.
