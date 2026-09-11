# InsightVis

**High-fidelity interactive simulations and visual experiments for JEE & NEET preparation.**

Built for **Insight Coaching**, InsightVis turns the abstract parts of the JEE and NEET
syllabus into things a student can *see, touch, break, and rebuild*. Every topic that is
normally taught as a static diagram on a whiteboard becomes a real, physically-accurate,
GPU-accelerated simulation that responds to the student in real time.

The flagship module is **Insight Smart Lab** — six shipped experiments, two each from
Physics, Chemistry and Biology. See §4.

---

## 1. Why this exists

A student preparing for JEE or NEET spends two years memorising results they have never
observed. They learn that a charged particle spirals in a magnetic field, that an SN2
reaction inverts the stereocentre, that a nerve impulse is "all-or-none" — but they only ever
see a frozen textbook figure with an arrow on it.

InsightVis exists to close that gap. The goal is not decoration. The goal is that a student
leaves a simulation able to *predict* what happens when a parameter changes, because they
have watched it change a hundred times with their own hands on the slider.

**Design principle:** if a simulation cannot make a student say *"oh — that's why"*, it does
not ship.

---

## 2. The three standing mandates

Set by the client. These apply to every piece of work on this project, permanently.

### 2.1 · Real working models, never decorative animation
Every experiment computes the actual governing equations. If a quantity is displayed, it was
calculated — not keyframed, not faked, not approximated for convenience.

### 2.2 · Competitive-exam level, not school level
JEE and NEET are among the most competitive examinations in the world, and the content must
be pitched at that difficulty: the subtle distinctions examiners actually test, the traps
students actually fall into, the second-order effects. Assume the student is bright, under
pressure, and has already read the textbook.

### 2.3 · Graphics and UI/UX: no compromise
Visual and interaction quality is a first-class deliverable, equal in weight to correctness.
No placeholder styling, no default component looks, no "we'll polish it later". Every screen
must look like professional scientific instrumentation. Where a choice trades visual quality
for convenience, make the other choice.

---

## 3. What "high-level visualisation" means here

Every experiment is held to this bar:

| Requirement | What it means in practice |
|---|---|
| **Physically correct** | Simulations integrate the real governing equations. No faked keyframe animations. |
| **Real-time interactive** | Every physical parameter is a live control, in real SI units, over physically realistic ranges. |
| **Cinematic rendering** | Additive phosphor blending, shaded 3D, true-wavelength colour, considered typography. Science-documentary quality, not a 2005 Java applet. |
| **Multi-representational** | Every scene shows the phenomenon *and* the governing equation with live-substituted values *and* the relevant graph, all on the same clock. |
| **Pedagogically staged** | A guided walkthrough builds the concept step by step, asking the student to predict before it reveals. |
| **Exam-anchored** | Each experiment declares its syllabus chapter and exams, and closes with how it is actually asked — plus the trap to avoid. |

---

## 4. Insight Smart Lab — v1 (shipped)

Source: [`smartlab/`](./smartlab). Six experiments, chosen for maximum exam weight combined
with maximum "impossible to picture from a textbook" value.

### Physics
**1 · Charged Particle in Crossed E and B Fields** — *Moving Charges & Magnetism*
Integrated with a **Boris pusher**, which conserves |v| exactly under a pure magnetic field —
so the flat speed trace is a proof that the magnetic force does no work, not an assertion.
Covers the cyclotron, the helix, the velocity selector and the mass spectrometer.

**2 · Young's Double Slit — Path Difference to Fringe** — *Wave Optics*
The true intensity formula including the **single-slit sinc² envelope**, so missing orders
appear exactly where d/a is integral. The screen is painted in the real wavelength→RGB colour,
and a λ-ruler counts the path difference in whole wavelengths as the point P sweeps.

### Chemistry
**3 · Hydrogen Atomic Orbitals — Shape, Phase and Nodes** — *Structure of Atom*
The point cloud is **rejection-sampled from |ψ|²** using the exact radial functions R<sub>nl</sub>(r)
and real spherical harmonics. Radial nodes, angular nodes and the n−1 counting rule are all
genuinely there rather than drawn in.

**4 · SN1 vs SN2 — Mechanism, Stereochemistry and Rate Law** — *Haloalkanes & Haloarenes*
Real 3D backside attack and **Walden inversion** geometry through a trigonal-bipyramidal
transition state; a planar sp² carbocation for SN1 with a **live racemisation tally** that
settles near 50:50. Both activation barriers are computed from the substrate, nucleophile,
solvent and temperature you set, and the lab tells you which mechanism actually wins.

### Biology
**5 · Nerve Impulse — the Hodgkin–Huxley Action Potential** — *Neural Control & Coordination*
The full 1952 HH equations integrated across a **100-compartment cable**, so the spike
genuinely propagates and the conduction velocity is measured rather than quoted. Membrane
patch view shows the m, h and n gates opening and closing. TTX and TEA block the real channels.

**6 · The Cardiac Cycle — Pressure, Volume and the ECG** — *Body Fluids & Circulation*
A **time-varying elastance** model of the left heart with a Windkessel aorta. Valves open and
close purely from the pressure gradient across them — nothing is scripted. Produces a live
Wiggers diagram, a real **pressure–volume loop**, and stroke volume, ejection fraction and
cardiac output that respond correctly to preload, afterload and contractility.

### Anatomy of every experiment
**Stage** (the visual) · **Control Deck** (live SI-unit parameters) · **Readout strip**
(derived quantities) · **Equation pane** (governing relation with values substituted live) ·
**Graph pane** · **Guided walkthrough** (predict-then-reveal) · **Why this is asked**
(exam framing and the trap to avoid).

---

## 5. Full subject scope (target)

### Physics (JEE + NEET)
Mechanics · oscillations & waves · optics · electromagnetism · thermodynamics & kinetic
theory · modern physics

### Chemistry (JEE + NEET)
Physical (kinetics, equilibrium, electrochemistry) · organic (3D mechanism playback,
stereochemistry, conformational analysis) · inorganic (orbitals, VSEPR, lattices,
coordination complexes and crystal field splitting)

### Mathematics (JEE)
Calculus · coordinate geometry · vectors & 3D · complex numbers · probability

### Biology (NEET)
Cell biology · genetics · human physiology · plant physiology · ecology & evolution

---

## 6. Architecture

```
smartlab/
├── index.html          shell + the complete design system (all CSS)
├── lab-core.js         sim registry, console shell, control deck, walkthrough engine,
│                       RK4 integrator, 3D camera + projection, canvas plotting library
├── sims-physics.js     Lorentz force · Young's double slit
├── sims-chemistry.js   hydrogen orbitals · SN1/SN2
└── sims-biology.js     action potential · cardiac cycle
```

**Zero external JavaScript dependencies.** All 3D is a hand-rolled Z-up perspective projection
with painter's-algorithm depth sorting and additive ("phosphor") blending on Canvas 2D.

A simulation is **data**, not bespoke code: it declares `params`, `controls`, `presets`,
`readouts`, `equation`, `walkthrough` and `notes`, plus `step`, `drawStage` and `drawPlot`.
The shell renders all of it. Adding an experiment does not require touching the shell.

The conceptual split that keeps this maintainable:

```
PEDAGOGY LAYER     guided walkthroughs, syllabus mapping, exam framing
RENDER LAYER       stage, control deck, equation pane, graph pane
SIMULATION CORE    pure numerics — integrators, field solvers, ODE stepping
```

The simulation core carries no rendering assumptions, so a physics bug can be caught by a
numeric test with no browser involved. That is exactly how the Hodgkin–Huxley cable was
calibrated (see `memory.md` §7).

---

## 7. Design system

**Direction:** instrument-grade dark laboratory console — deliberately **dark-committed**,
because the stage renders fields, orbital clouds and traces with additive blending, which
requires a dark ground.

- **Ground** — ink-navy ramp `#05080F` → `#1A2439`. Never pure black.
- **Subject accents**, each grounded in something real from that subject's world:
  Physics `#3DD6F5` (oscilloscope phosphor) · Chemistry `#FFAE4C` (sodium flame test) ·
  Biology `#FF6B9D` (eosin stain). The accent switches with the subject; everything else
  stays constant.
- **Type** — IBM Plex Sans Condensed (headings) · IBM Plex Sans (body) · IBM Plex Mono
  (all numbers, units and readouts) · Georgia italic (maths variables).
- **Charts** — one scale per chart, never dual-axis. Recessive grid, 2px marks, labels in
  text tokens rather than series colour.

---

## 8. Non-negotiables for contributors

- **Correctness and beauty, both.** Neither excuses the other.
- **60 fps or fix it.** Below that, interactivity dies.
- **Real SI units everywhere.** No arbitrary 0–100 dials.
- **Syllabus-anchored.** No chapter mapping, no place in the catalogue.
- **Works on school hardware.** Sample counts and quality tiers are adjustable.
- **Accessible.** Keyboard navigation, visible focus, `prefers-reduced-motion` respected.
- **No faked animation in a physics context.** If it moves, something computed why.
- **No external JS dependencies** in the lab.

---

## 9. Roadmap

**Phase 1 — done.** Engine, design system, six flagship experiments across three subjects.

**Phase 2.** Expand each subject to full coverage — LCR resonance and phasors, the
photoelectric effect, rotational dynamics; chemical equilibrium, electrochemical cells, a
VSEPR builder; DNA replication and translation, nephron filtration, mitosis and meiosis.

**Phase 3.** Add Mathematics as the fourth rail — function and surface plotting, conic
sections from a cutting plane, vector geometry.

**Phase 4 — platform.** Student accounts, progress tracking, teacher dashboard, classroom
projection mode, assessment integration.

**Phase 5 — scale.** Mobile and tablet optimisation, offline mode for low-bandwidth
classrooms, regional language support.

---

## 10. Running it

`smartlab/` is a static bundle with no build step and no dependencies.

```bash
git clone https://github.com/pranshukesavmishra/insightvis.git
cd insightvis/smartlab
python3 -m http.server 8000   # then open http://localhost:8000
```

---

## 11. Project memory

Long-term context — the standing mandates, every decision and its rationale, the calibration
constants that must not be re-guessed, and the open questions — lives in
[`memory.md`](./memory.md). **Read it before starting work and update it when a decision is
made.**

---

*Built for Insight Coaching.*
