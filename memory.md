# InsightVis — Project Memory

> **Purpose of this file.** InsightVis is a long-running project spanning many work sessions.
> This file is the durable memory: the brief, the standing mandates, the decisions, the
> conventions and the calibration constants. **Read it before starting any work. Update it
> whenever a decision is made or a constraint is discovered.** A stale memory is worse than
> no memory — fix anything here that no longer matches reality.

Last updated: 2026-09-11

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

## 4. What is built — Insight Smart Lab v1

**Live artifact:** https://claude.ai/code/artifact/bff145e7-cd07-46c2-85d5-b579094767e6
**Source:** `smartlab/` in this repository.

Six flagship experiments — two per science subject — chosen for maximum exam weight combined
with maximum "impossible to picture from a textbook" value.

| # | Subject | Experiment | Chapter | What makes it real |
|---|---|---|---|---|
| 1 | Physics | Charged particle in crossed E and B fields | Moving Charges & Magnetism | **Boris pusher** integration — conserves \|v\| exactly under pure B, so the flat speed trace is a proof, not an assertion |
| 2 | Physics | Young's double slit — path difference to fringe | Wave Optics | True intensity formula with the single-slit sinc² envelope; screen painted in real wavelength→RGB colour |
| 3 | Chemistry | Hydrogen atomic orbitals | Structure of Atom | Point cloud is **rejection-sampled from \|ψ\|²** using exact R<sub>nl</sub>(r) and real spherical harmonics |
| 4 | Chemistry | SN1 vs SN2 | Haloalkanes & Haloarenes | Real 3D Walden inversion geometry; barriers computed from substrate/nucleophile/solvent; live racemisation tally |
| 5 | Biology | Hodgkin–Huxley action potential | Neural Control & Coordination | Full HH equations on a **100-compartment cable** — the spike genuinely propagates |
| 6 | Biology | Cardiac cycle, PV loop and ECG | Body Fluids & Circulation | **Time-varying elastance** model + Windkessel aorta; valves open purely on pressure gradient |

### Why these six
Physics 1 and 2 are the two topics where students memorise a result they have never observed.
Chemistry 3 is the single highest-leverage visual in inorganic (node counting is examined
relentlessly), and 4 is the highest-weightage organic mechanism. Biology 5 and 6 are the two
heaviest NEET physiology units, and both are genuinely simulatable from first principles
rather than merely illustrated.

### Architecture that shipped
```
smartlab/
├── index.html          shell + complete design system (all CSS)
├── lab-core.js         registry, console shell, control deck, walkthrough engine,
│                       RK4, 3D camera + projection, canvas plotting library
├── sims-physics.js     Lorentz force, Young's double slit
├── sims-chemistry.js   hydrogen orbitals, SN1/SN2
└── sims-biology.js     action potential, cardiac cycle
```
Zero external JS dependencies. All 3D is a hand-rolled Z-up perspective projection with
painter's-algorithm sorting and additive ("phosphor") blending on Canvas 2D.

### Every experiment ships the same anatomy
**Stage** (the visual) · **Control Deck** (live SI-unit parameters) · **Readout strip**
(derived quantities) · **Equation pane** (governing relation with values substituted live) ·
**Graph pane** · **Guided walkthrough** (predict-then-reveal) · **Why this is asked**
(exam framing + a trap-to-avoid callout).

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

---

## 7. Calibration constants — hard-won, do not re-guess

These were found by direct numerical testing. Changing them will break the teaching points.

**Hodgkin–Huxley cable**
- Axial coupling `gax = 8`. At 1.6 the spike does **not** propagate along the axon.
- Firing threshold ≈ **11 µA/cm² at 1.0 ms** pulse. Defaults: `Istim 20, dur 1.0`.
- Subthreshold demo: `Istim 9`. Paired-pulse refractory demo: `Istim 24, gap 5 ms`.
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
- **Sim methods live in the definition object, not on the state object `S`.** A helper needed
  by `drawStage`/`drawPlot` goes at module scope. (This caused a real runtime bug — `S.intensity`
  was called but never existed on `S`.)

---

## 9. Current status

**Insight Smart Lab v1 shipped** — six experiments, published and running.

Next, in rough priority order:
1. Client review of the six experiments and the visual direction.
2. Expand Physics (LCR resonance and phasors, photoelectric effect, rotational dynamics).
3. Expand Chemistry (chemical equilibrium / Le Chatelier, electrochemical cells, VSEPR builder).
4. Expand Biology (DNA replication & translation, nephron filtration, mitosis/meiosis).
5. Add Mathematics as the fourth subject rail.
6. Platform layer: student accounts, progress tracking, teacher/projection mode.

---

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

---

## 13. Session log

- **2026-09-11 (a)** — Cloned repo (near-empty: placeholder README). Established brief, scope,
  architecture, conventions. Wrote `README.md` and `memory.md`. Identified push-access blocker.
- **2026-09-11 (b)** — **Built and shipped Insight Smart Lab v1.** Selected six experiments
  (2 each from Physics, Chemistry, Biology). Built `lab-core` framework + three simulation
  modules + full instrument-console design system. Numerically verified the Hodgkin–Huxley
  model (found and fixed a non-propagating cable and a subthreshold default), fixed a real
  runtime bug (`S.intensity` not on the state object), recalibrated orbital framing and
  molecule camera, separated the cardiac aorta colour from the LV trace. Published as an
  artifact. Recorded the client's three standing mandates in §2.
