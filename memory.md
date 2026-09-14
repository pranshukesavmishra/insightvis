# InsightVis — Project Memory

> **Purpose of this file.** InsightVis is a long-running project spanning many work sessions.
> This file is the durable memory: the brief, the standing mandates, the decisions, the
> conventions and the calibration constants. **Read it before starting any work. Update it
> whenever a decision is made or a constraint is discovered.** A stale memory is worse than
> no memory — fix anything here that no longer matches reality.

Last updated: 2026-09-14 (v4, artifact v13)

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

- `pranshukesavmishra/insightvis` is **public and readable**, but this session has **no push
  access**. Work is committed locally and must be pushed by the repo owner, or write access
  must be granted (reconnect GitHub under claude.ai Settings → Connectors with the owning
  account, or add the working account as a collaborator).
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
