# InsightVis

**High-fidelity interactive simulations and visual experiments for JEE & NEET preparation.**

Built for **Insight Coaching**, InsightVis turns the abstract parts of the JEE and NEET
syllabus into things a student can *see, touch, break, and rebuild*. Every topic that is
normally taught as a static diagram on a whiteboard becomes a real, physically-accurate,
GPU-accelerated simulation that responds to the student in real time.

---

## 1. Why this exists

A student preparing for JEE or NEET spends two years memorising results they have never
observed. They learn that a charged particle spirals in a magnetic field, that an SN2
reaction inverts the stereocentre, that a standing wave has nodes — but they only ever see
a frozen textbook figure with an arrow on it.

InsightVis exists to close that gap. The goal is not decoration. The goal is that a student
leaves a simulation able to *predict* what happens when a parameter changes, because they
have watched it change a hundred times with their own hands on the slider.

**Design principle:** if a simulation cannot make a student say *"oh — that's why"*, it does
not ship.

---

## 2. What "high-level visualisation" means here

Every experiment in InsightVis is held to the following bar:

| Requirement | What it means in practice |
|---|---|
| **Physically correct** | Simulations integrate the real governing equations. No faked keyframe animations, no "looks about right" motion. |
| **Real-time interactive** | Every physical parameter is a live control. Change mass, charge, refractive index, concentration, or temperature and the scene responds within the same frame. |
| **Cinematic rendering** | Custom GLSL shaders, volumetric field rendering, physically-based materials, depth of field, bloom. It should look like a science documentary, not a 2005 Java applet. |
| **Multi-representational** | Every scene shows the phenomenon *and* the governing equation with live-substituted values *and* the relevant graph, all synchronised to the same clock. |
| **Pedagogically staged** | A guided walkthrough mode builds the concept step by step before handing the student free-play controls. |
| **Exam-anchored** | Each experiment links directly to the JEE/NEET syllabus node it serves, plus solved PYQs that the simulation makes intuitive. |

---

## 3. Scope — subjects covered

InsightVis serves both exams from one engine.

### Physics (JEE + NEET)
- **Mechanics** — projectile motion with drag, circular motion, collisions in the centre-of-mass frame, rigid body rotation, rolling without slipping, gravitation and orbital mechanics
- **Oscillations & Waves** — SHM and phasors, damped/forced resonance, superposition, standing waves, beats, Doppler effect
- **Optics** — ray tracing through lenses and mirrors, total internal reflection, Young's double slit, single-slit diffraction, thin-film interference, polarisation and Malus' law
- **Electromagnetism** — volumetric electric and magnetic field rendering, Gauss's law flux visualisation, capacitors and dielectrics, charged particle motion (cyclotron, velocity selector, mass spectrometer), electromagnetic induction, LCR circuits and phasor diagrams
- **Thermodynamics & Kinetic Theory** — particle-level gas simulation, Maxwell-Boltzmann distribution emerging from collisions, PV diagrams, Carnot and other cycles
- **Modern Physics** — photoelectric effect, atomic spectra and energy levels, hydrogen orbital probability clouds, radioactive decay, nuclear binding energy curve

### Chemistry (JEE + NEET)
- **Physical** — reaction kinetics and rate laws, equilibrium shifting under Le Chatelier's principle, electrochemical cells and ion flow, colligative properties, gas laws
- **Organic** — 3D reaction mechanism playback (SN1, SN2, E1, E2, addition, aromatic substitution) with electron-flow arrows rendered in 3D, stereochemistry and chirality manipulation, conformational analysis with live energy profiles, resonance and hyperconjugation
- **Inorganic** — atomic and molecular orbitals rendered as real probability isosurfaces, VSEPR geometry construction, crystal lattice structures and packing efficiency, coordination complexes and crystal field splitting

### Mathematics (JEE)
- **Calculus** — limits and continuity visualised, derivative as instantaneous slope, area under curve accumulating in real time, solids of revolution, differential equation slope fields
- **Coordinate Geometry** — live conic sections as a plane cuts a cone, loci traced interactively, tangents and normals
- **Vectors & 3D Geometry** — vector operations in manipulable 3D space, planes and lines, shortest distances
- **Complex Numbers** — Argand plane transformations, roots of unity, De Moivre's theorem as rotation
- **Probability** — large-sample simulation convergence, distributions built from repeated trials

### Biology (NEET)
- **Cell Biology** — 3D cell tour, mitosis and meiosis with chromosome-level animation, membrane transport mechanisms
- **Genetics** — DNA replication, transcription and translation at molecular scale, Punnett square and dihybrid cross simulation, mutation effects
- **Human Physiology** — beating heart with live cardiac cycle and ECG correlation, nephron filtration, neuron action potential propagation with ion channel detail, gas exchange in alveoli, digestive enzyme action
- **Plant Physiology** — photosynthesis light and dark reactions, transpiration pull, plant hormone responses
- **Ecology & Evolution** — population growth models, Hardy-Weinberg equilibrium, natural selection simulation

---

## 4. Architecture

InsightVis is deliberately split into three independent layers so that physics correctness,
visual quality, and teaching flow can each evolve without breaking the others.

```
┌──────────────────────────────────────────────────────────┐
│  PEDAGOGY LAYER                                          │
│  Guided walkthroughs, checkpoints, syllabus mapping,      │
│  PYQ linkage, assessment hooks                           │
├──────────────────────────────────────────────────────────┤
│  RENDER LAYER                                            │
│  React Three Fiber scenes, GLSL shaders, 2D plot panes,  │
│  equation panel, control panel                           │
├──────────────────────────────────────────────────────────┤
│  SIMULATION CORE                                         │
│  Pure, framework-free numerical engine.                  │
│  Integrators (RK4, Velocity Verlet), field solvers,      │
│  collision resolution, ODE/PDE stepping.                 │
│  Runs in a Web Worker. Zero React dependency.            │
└──────────────────────────────────────────────────────────┘
```

**Why this split matters:** the simulation core can be unit-tested against analytical
solutions with no browser involved. A physics bug is caught by a test, not by a student.

### Proposed stack

| Concern | Choice | Reason |
|---|---|---|
| Framework | Next.js (App Router) + TypeScript | Routing, SSR for content pages, strong typing across a large catalogue |
| 3D | React Three Fiber + drei + Three.js | Declarative Three.js that composes cleanly with React state |
| Shaders | Custom GLSL | Volumetric fields, orbital isosurfaces, wave surfaces — impossible with stock materials |
| 2D plots | visx / uPlot | Fast enough to redraw at 60fps alongside the 3D pane |
| Equations | KaTeX | Live-substituted values inside rendered LaTeX |
| State | Zustand | Simulation parameters shared across panes without prop drilling |
| Heavy compute | Web Workers, WASM where needed | Keeps the main thread free so the UI never stutters |
| Styling | Tailwind CSS + Radix UI primitives | Consistent design system, accessible controls |

> The stack is a proposal until confirmed. See `memory.md` for the current decision status.

### Repository layout (target)

```
insightvis/
├── app/                     # Next.js routes — catalogue, subject pages, simulation pages
├── src/
│   ├── engine/              # Simulation core (pure TS, no React, fully unit-tested)
│   │   ├── integrators/
│   │   ├── fields/
│   │   ├── collisions/
│   │   └── solvers/
│   ├── simulations/         # One folder per experiment
│   │   └── <subject>/<topic>/
│   │       ├── model.ts     # Physics/chemistry/biology model
│   │       ├── Scene.tsx    # 3D render
│   │       ├── controls.ts  # Exposed parameters
│   │       ├── walkthrough.ts  # Guided teaching steps
│   │       └── meta.ts      # Syllabus mapping, PYQ links
│   ├── components/          # Shared UI — control panel, equation pane, graph pane
│   ├── shaders/             # GLSL
│   └── lib/
├── content/                 # Syllabus tree, PYQ bank, concept text
├── tests/                   # Engine correctness tests against analytical solutions
└── memory.md                # Long-term project context
```

---

## 5. Anatomy of a simulation

Every experiment ships with the same four-part structure. This consistency is what makes the
platform feel like one product instead of a pile of demos.

1. **The Stage** — the 3D or 2D scene where the phenomenon happens.
2. **The Control Deck** — every physical parameter as a live slider, toggle, or input, with
   units and realistic ranges.
3. **The Equation Pane** — the governing equation in proper notation, with current values
   substituted and the changing term highlighted.
4. **The Graph Pane** — the relevant plot, drawing in real time as the simulation runs.

On top of that, two modes:

- **Guided Mode** — a staged walkthrough. Parameters are locked, then released one at a
  time, each with a question the student must predict the answer to before the reveal.
- **Lab Mode** — everything unlocked. Free experimentation, preset scenarios, and the ability
  to save and share a parameter configuration.

---

## 6. Roadmap

### Phase 0 — Foundation
Project scaffolding, simulation core with integrators and tests, shared UI shell
(control deck, equation pane, graph pane), design system, one reference simulation built
end to end as the pattern for everything after.

### Phase 1 — Physics vertical slice
Ten flagship Physics simulations covering the highest-yield, hardest-to-visualise topics.
Establishes the visual language and the pedagogical template.

### Phase 2 — Chemistry and Biology
Molecular rendering pipeline, orbital isosurface shaders, reaction mechanism playback
system. Biology anatomical models and physiological process animations.

### Phase 3 — Mathematics
Function and surface plotting engine, geometric construction tools.

### Phase 4 — Platform
Student accounts, progress tracking, teacher dashboard, classroom projection mode,
assessment integration, performance analytics.

### Phase 5 — Scale
Full syllabus coverage, mobile and tablet optimisation, offline mode for low-bandwidth
classrooms, regional language support.

---

## 7. Non-negotiables

These hold for every contribution.

- **Correctness over prettiness.** A beautiful simulation that teaches the wrong thing is
  worse than no simulation. Models are validated against analytical solutions in tests.
- **60fps or fix it.** Interactivity dies below 60fps. Heavy computation goes to a worker.
- **Real units everywhere.** Sliders show SI units and physically realistic ranges. No
  arbitrary 0–100 dials.
- **Syllabus-anchored.** Every simulation declares which JEE/NEET syllabus node it serves.
  If it maps to nothing, it does not belong in the catalogue.
- **Works on school hardware.** Graceful quality degradation. A student on an entry-level
  laptop must still get a usable simulation.
- **Accessible.** Keyboard navigation, colour-blind-safe palettes, text alternatives for
  every visual claim.

---

## 8. Getting started

> Scaffolding is not yet in place. This section will be filled in at the end of Phase 0.

```bash
git clone https://github.com/pranshukesavmishra/insightvis.git
cd insightvis
npm install
npm run dev
```

---

## 9. Project memory

Long-term context for this project — decisions made, conventions agreed, open questions,
and current status — lives in [`memory.md`](./memory.md). Read it before starting work and
update it when a decision is made.

---

## 10. Status

**Currently in Phase 0 planning.** Stack proposed, scope defined, architecture drafted.
Next step is confirming the stack and building the reference simulation.

---

*Built for Insight Coaching.*
