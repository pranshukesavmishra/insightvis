# InsightVis — Project Memory

> **Purpose of this file.** InsightVis is a long-running project that will span many work
> sessions. This file is the durable memory: the brief, the decisions, the conventions, and
> the open questions. Read it before starting any work. Update it whenever a decision is
> made or a constraint is discovered. If something here is stale, fix it — a wrong memory is
> worse than no memory.

Last updated: 2026-09-11

---

## 1. Project identity

| | |
|---|---|
| **Name** | InsightVis |
| **Client** | Insight Coaching — a coaching institute preparing students for JEE and NEET |
| **Repository** | `pranshukesavmishra/insightvis` |
| **Audience** | Indian students in classes 11–12 and droppers, preparing for JEE (engineering) and NEET (medical) |
| **Secondary audience** | Insight Coaching faculty, who will use simulations as live teaching aids in class |

---

## 2. The standing brief

This is the mandate. Everything else serves it.

> Build a large, production-grade software platform of **high-graphics-level interactive
> visualisation experiments and simulations** for every topic covered in the JEE and NEET
> syllabus. The simulations must be of a genuinely high standard — real working models, not
> decorative animations — so that a JEE/NEET student gains **clear conceptual understanding**
> through a high-end visual environment.

Key words from the brief, and how they are being interpreted:

- **"high level of experiments and workings"** → the underlying models must actually compute
  the physics/chemistry/biology. Numerical integration of real governing equations. Not
  pre-baked keyframe animation.
- **"high level visualisation environment"** → cinematic rendering quality. Custom shaders,
  volumetric fields, physically-based materials, post-processing. The visual bar is science
  documentary, not classroom applet.
- **"clear understanding about the concept"** → pedagogy is a first-class layer, not an
  afterthought. Guided walkthroughs, predict-then-reveal questioning, multi-representational
  display (scene + equation + graph, synchronised).
- **"big and real software"** → this is a product with architecture, tests, and a roadmap.
  Not a collection of demos.

---

## 3. Scope summary

Four subjects, two exams, one engine.

- **Physics** (JEE + NEET) — mechanics, waves & oscillations, optics, electromagnetism,
  thermodynamics & kinetic theory, modern physics
- **Chemistry** (JEE + NEET) — physical, organic (3D mechanism playback), inorganic
  (orbitals, VSEPR, lattices, coordination chemistry)
- **Mathematics** (JEE only) — calculus, coordinate geometry, vectors & 3D, complex numbers,
  probability
- **Biology** (NEET only) — cell biology, genetics, human physiology, plant physiology,
  ecology & evolution

Full topic breakdown is in `README.md` §3. Keep the two documents consistent — if scope
changes, change both.

---

## 4. Architecture decisions

### Three-layer split (decided)

```
Pedagogy Layer   — walkthroughs, syllabus mapping, PYQ linkage, assessment
Render Layer     — R3F scenes, GLSL, plot panes, equation pane, control deck
Simulation Core  — pure TypeScript numerics. No React. Runs in a Web Worker.
```

**Rationale:** the simulation core must be unit-testable against analytical solutions with no
browser in the loop. Physics bugs get caught by tests, not by students. This separation is
load-bearing — do not let React state leak into the engine.

### Stack (PROPOSED — not yet confirmed by the client)

| Concern | Proposed choice |
|---|---|
| Framework | Next.js (App Router) + TypeScript |
| 3D | React Three Fiber + drei + Three.js |
| Shaders | Custom GLSL |
| 2D plots | visx or uPlot |
| Equations | KaTeX |
| State | Zustand |
| Heavy compute | Web Workers; WASM (Rust or AssemblyScript) where profiling demands it |
| Styling | Tailwind CSS + Radix UI primitives |
| Animation | Framer Motion (UI only — never for physics) |

**Status:** awaiting confirmation. Do not scaffold until this is signed off. See Open
Questions §8.

### Simulation anatomy (decided)

Every experiment ships with four synchronised parts — **Stage**, **Control Deck**,
**Equation Pane**, **Graph Pane** — and two modes — **Guided** and **Lab**. This structure is
uniform across the entire catalogue. It is what makes the platform feel like one product.

---

## 5. Non-negotiable engineering rules

Carry these into every session.

1. **Correctness over prettiness.** Models validated against analytical solutions in tests.
2. **60fps or fix it.** Below 60fps interactivity dies. Heavy compute goes to a worker.
3. **Real SI units everywhere.** No arbitrary 0–100 sliders. Physically realistic ranges.
4. **Syllabus-anchored.** Every simulation declares its JEE/NEET syllabus node in `meta.ts`.
   No syllabus mapping means it does not ship.
5. **Works on school hardware.** Graceful quality tiers. Entry-level laptops must still run it.
6. **Accessible.** Keyboard navigation, colour-blind-safe palettes, text alternatives.
7. **No faked animation in a physics context.** If it moves, something computed why.

---

## 6. Conventions

- One folder per simulation under `src/simulations/<subject>/<topic>/`, containing
  `model.ts`, `Scene.tsx`, `controls.ts`, `walkthrough.ts`, `meta.ts`.
- The engine (`src/engine/`) imports nothing from React, Three.js, or Next.js. Ever.
- Physics constants live in one shared module. Never redeclare `g` or `c` inline.
- Every new integrator or solver lands with a test comparing it to a known analytical result.
- Indian exam terminology is used as students know it: PYQ (previous year question), JEE
  Main / JEE Advanced, NEET UG, NCERT.

---

## 7. Current status

**Phase 0 — planning.**

Done:
- Scope defined across all four subjects
- Three-layer architecture drafted
- Simulation anatomy and pedagogy model defined
- `README.md` and `memory.md` written

Next:
- Confirm the stack (§4)
- Scaffold the project
- Build the simulation core with integrators + tests
- Build the shared UI shell (Control Deck, Equation Pane, Graph Pane)
- Build **one** reference simulation end to end as the pattern for all others

---

## 8. Open questions — need client input

These are blocking or shaping decisions. Resolve them and record the answers here.

1. **Stack sign-off.** Is the Next.js + React Three Fiber stack approved? Any existing
   Insight Coaching web platform this must integrate with or match visually?
2. **Reference simulation.** Which experiment should be built first as the quality bar?
   (Recommendation: a Physics electromagnetism sim — charged particle in a magnetic field, or
   volumetric field visualisation. High visual payoff, universally hard to picture, serves
   both JEE and NEET.)
3. **Delivery target.** Web-only, or does this need to run offline in classrooms with poor
   connectivity? Affects architecture significantly.
4. **Device floor.** What is the weakest device that must run this well — student phones,
   school desktops, classroom projectors? Sets the performance budget.
5. **Content ownership.** Who supplies the PYQ bank and concept text — Insight faculty, or is
   that in scope for this project?
6. **Branding.** Are there Insight Coaching brand colours, logo, and typography to follow?
7. **Team size and timeline.** Is this a solo build or a team? What is the deadline, and is
   there a demo milestone before it?

---

## 9. Environment and access notes

- The repository `pranshukesavmishra/insightvis` is **public and readable**, but this
  session does **not have push access** to it. Changes can be developed locally but cannot be
  committed and pushed until write access is granted — either by reconnecting GitHub under
  claude.ai Settings → Connectors with the owning account, or by adding the working account
  as a collaborator with write permission.
- Local working clone in session: `/home/user/pranshukesavmishra/insightvis`
- Note: a separate repository, `pranshukesavmishra/sih-2026`, is also attached to this
  workspace. It is unrelated to InsightVis. Do not mix work between them.

---

## 10. Decision log

Append here. Never rewrite history — add a new entry instead.

| Date | Decision | Rationale |
|---|---|---|
| 2026-09-11 | Project scoped across Physics, Chemistry, Maths, Biology for JEE + NEET | Single engine serves both exams; syllabi overlap heavily in PCB/PCM |
| 2026-09-11 | Three-layer architecture (Pedagogy / Render / Simulation Core) | Engine must be testable without a browser; physics correctness is the highest risk |
| 2026-09-11 | Uniform four-pane simulation anatomy + Guided/Lab modes | Consistency across a large catalogue; multi-representational learning |
| 2026-09-11 | Stack proposed (Next.js + R3F + GLSL + Zustand), pending sign-off | Best fit for declarative 3D at scale with strong typing |

---

## 11. Session log

Short notes on what each work session accomplished, so context is never lost.

- **2026-09-11** — Cloned repository (found it near-empty: placeholder README only).
  Established the full project brief, scope, architecture, and conventions. Wrote
  `README.md` and this `memory.md`. Identified push-access blocker. Awaiting client answers
  on the open questions in §8 before scaffolding.
