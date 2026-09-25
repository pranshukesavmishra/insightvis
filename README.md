# InsightVis

**High-fidelity interactive simulations and visual experiments for JEE & NEET preparation.**

Built for **Insight Coaching**, InsightVis turns the abstract parts of the JEE and NEET
syllabus into things a student can *see, touch, break, and rebuild*. Every topic that is
normally taught as a static diagram on a whiteboard becomes a real, physically-accurate,
GPU-accelerated simulation that responds to the student in real time.

The flagship module is **Insight Smart Lab** — **twenty-one shipped experiments**, including a
nine-lab **Animal Kingdom** suite built to NCERT Chapter 4. See §4.

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

### 2.7 · The plate standard
Every biology stage is a labelled anatomical plate: the figure dominates, it is drawn at section
quality, every structure the exam names carries a leader label, a magnified inset shows the cell
doing the work, and both carry scale bars. Graphs belong in the plots panel — a Wiggers diagram or
a ladder diagram must never compete with the anatomy for the stage.

### 2.6 · Biology figures are zoological plates, and every lab must compute
Two faults the client named in the biology suite. The **graphics** were cartoon-grade, so
`smartlab/art-zoo.js` now draws them properly — cells with membranes and nuclei, epithelia as real
sheets, body walls as named layers, a nematocyst with capsule wall, operculum, cnidocil, coiled
tubule, barbs and stylets, a choanocyte with a microvillar collar and beating flagellum. The
**substance** problem is that several Animal Kingdom labs browse data rather than simulate anything.
Fixing a lab means both: rebuild the figure on `art-zoo.js`, and give it something real to compute.

### 2.5 · The organic chemistry labs are the template, and the bar is twice as high
Client verdict on v5: the organic chemistry suite is the right **kind** of experiment, at about
**half** the intended depth. Every lab built from here copies its shape — a real computation at the
core, the exam rule emerging from the numbers rather than being stated, a purpose-built figure
library, physically meaningful parameters that can reach the traps JEE examines, two plots
answering different questions, and a walkthrough that asks before it tells.

The remaining half, in priority order: **animate mechanisms step by step** (curly arrows that play,
bonds that break and form); **let the student build the input** rather than pick from a dropdown;
**go 3D** where the chemistry is 3D (conformers, stereocentres, orbitals); **more linked experiments
per chapter**; a **worked-problem mode** that has the student predict before the simulation checks
them; and coverage of the organic chapters still missing — carbonyl chemistry, named reactions,
amines and diazonium, biomolecules, polymers.

### 2.4 · Biology figures are anatomical drawings, not boxes and blobs
A NEET student is examined on labelled diagrams. A heart drawn as four rounded rectangles, or
an axon drawn as a grey bar, gives them nothing they can carry into the exam hall. Every
biological structure is drawn as the organ or cell actually looks — chambers in real
proportion, great vessels in correct order, a neuron with soma, dendrites, axon hillock,
myelin sheath and nodes of Ranvier, a membrane with real phospholipid heads and tails.
All of it lives in one library, `smartlab/art-bio.js`; a lab never hand-draws anatomy.

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

## 4. Insight Smart Lab — v10 (shipped)

Source: [`smartlab/`](./smartlab). **Forty-two experiments across twenty-seven chapters.**
**Animal Kingdom carries nine**, because it is the highest-preference topic for this client, and
**Physics now spans seventeen chapters** — fifteen of its benches are built in true 3D on `render3d.js`,
and the student can drag the apparatus into shape rather than only dial it in.

### Physics · Moving Charges & Magnetism
**1 · Charged Particle in Crossed E and B Fields**
A vacuum chamber you can walk around, with pole faces, deflecting plates, an aimable injector and a
detector. Integrated with a **Boris pusher**, which conserves |v| exactly under a pure magnetic
field — so the flat speed trace is a proof that the magnetic force does no work. Five modes: the
helix, the velocity selector, a **mass spectrometer** that separates ¹²C from ¹³C by 22 mm on a real
detector strip, the **cycloid drift**, and E parallel to B.

**2 · The Cyclotron — Resonance and Maximum Energy**
The real machine in 3D: two extruded D-shaped dees tinted by the RF polarity, magnet pole faces with
the field running between them, and an accelerating gap that glows **only while E is on**. Drag the
dee rim to resize the machine. **Detune the RF** and watch the acceleration collapse as the phase
error accumulates. Proves that KE_max = q²B²R²/2m is independent of the gap voltage.

### Physics · Wave Optics
**3 · Young's Double Slit — Path Difference to Fringe**
An optical bench on a graduated rail: lamp, collimating slit, slit plate and screen, each on its own
post. The pattern is the intensity integral evaluated column by column **across the real screen** in
the true colour of the light, with exact sin θ rather than the small-angle form — including the
**single-slit sinc² envelope**, so missing orders appear exactly where d/a is integral. Four further
effects, all examined: a **thin plate over one slit** translates the whole pattern by (μ−n)tD/nd
while β is untouched; **immersion** makes λ into λ/n; **unequal slits** kill the contrast and move
nothing; and **white light** shows why only the central fringe is white. Drag P across the pattern,
the screen along the rail, or a slit across the plate.

**4 · Diffraction & Resolving Power — the Rayleigh Criterion**
The focal plane carries the real **two-dimensional Airy image** — the J₁ rings and all — with the
first dark ring drawn on it, so the Rayleigh criterion is something you look at rather than read.
The aperture slider is logarithmic and spans a 0.5 mm pinhole to Hubble's 2.4 m mirror, with
instrument presets that say what each one separates at 25 cm, at 1 km and on the Moon. Carries the
microscope form 0.61 λ/NA and the **Sparrow limit** alongside Rayleigh's 1.22. The verdict scans the
summed profile for two maxima and measures the valley against the *weaker* of them, because
Rayleigh's 0.735 dip assumes an equal pair — a faint companion at exactly θ_min is **not** resolved.

### Physics · Current Electricity
**The Circuit Bench — Kirchhoff, Wheatstone and the Potentiometer**
Knows no circuit law. It assembles the **node-admittance matrix** from whatever is wired up and
solves it, so the Wheatstone balance condition, the metre-bridge null and the potentiometer's
zero-current reading are all read back out of the solution. Drag the jockey and hunt the null: at
balance the galvanometer reads 10⁻¹⁷ A, and the potentiometer's balance point does not move when
you change the test cell's internal resistance — which is the whole reason the instrument exists.

### Physics · Ray Optics & Optical Instruments
**The Optical Bench — Lenses, Mirrors and Real Images**
Every ray is refracted with **Snell's law at both spherical surfaces** of a real thick lens, and the
image is found as the plane of least confusion of the emergent bundle. The lens formula is printed
beside the traced result so you can watch the two agree at a narrow aperture and **pull apart as you
open it** — that gap is spherical aberration. Convex and concave lenses, both mirrors, and a
two-lens combination.

### Physics · Waves
**Waves and Sound — Standing Waves, Beats and Doppler**
The harmonic series is a **result of the boundary conditions**, not a rule: a closed pipe resonates
at f₁ and 3f₁ and flatly refuses at 2f₁, while an open pipe of the same length takes every
harmonic. Beats are drawn as an exact sum, and the Doppler panel shows that a moving source and a
moving observer at the same speed give **genuinely different** frequencies.

### Physics · Laws of Motion
**Laws of Motion — Pulleys, Wedges, Lifts and Friction** *(rebuilt as a working bench)*
A wooden lab bench with clamp stands, spoked pulleys, brass slotted masses and a ramp on a stand. Seven
rigs, each solved from Newton's second law for every body plus its constraints (SOLVE.lin):
- an Atwood machine whose pulley has mass, so **T₁ ≠ T₂**
- a table and a ramp, with the static-friction test
- a wedge free to slide away from under its block (A, a_rel and N solved together)
- a lift on a real trip, with a scale reading N = m(g + a), and a cable-cut free fall
- blocks in contact, and a banked road

An ultrasonic **motion sensor** logs position at 50 Hz with real noise, and the acceleration is
**fitted by least squares** and shown beside the solved value. Digital meters on the bench read
tension, normal force and the scale.

### Physics · System of Particles · Collisions
**Collisions — Air Track, Photogates and the Centre of Mass** *(rebuilt)*
Gliders on an air track carry **spring bumpers**. Each collision is integrated through about 30 ms of
contact, so the **force–time curve** is real and its area, the impulse, equals Δp. The damping is
calibrated so the bumpers produce the chosen e, and velcro gives e = 0. **Photogates** time a 10 cm
flag (v = L/Δt), and the momentum book is kept from those readings. The bench also has:
- a spring recoil, where a thread is burned
- a 2D **air table** recorded by strobe; equal masses leave 90.000° apart without any angle being assumed
- a Blackwood **ballistic pendulum** with a ratchet that locks at the top of the swing
- the exploding shell

### Physics · Electrostatic Potential & Capacitance
**Capacitors — Dielectrics, Energy and the Pull on a Slab** *(rebuilt)*
The field is **solved** on a grid (∇·(ε∇φ) = 0) for three arrangements: a slab sliding in (with the
force from ½V² dC/dx, fringe and all), two dielectrics **side by side** (parallel), and two
**stacked** layers (series). A metal slab is also available. For the side-by-side and stacked cases,
graphs read E and σ straight off the solution.

The bench:
- plates on acrylic posts
- a supply with a switch in its lead
- a voltmeter, a charge meter, and a force gauge on the slab

The circuits sit on a breadboard, with resistors whose colour bands match their value, electrolytic
capacitors and handheld multimeters. They cover RC charging, charge sharing and series/parallel networks.

### Physics · Gravitation
**Gravitation — Orbits, the Inside of the Earth and Weighing G**
Four set-ups. No path is drawn from a conic-section formula: every one is integrated from F = GMm/r²,
and each exam result is **read off the run**.
- **Launch a satellite** round a ray-traced planet (Earth, Moon, Mars, Jupiter). The globe has
  procedural continents, clouds, sun glint and city lights on the night side. Drag the velocity arrow
  to launch faster or steeper, and the launch point to go higher. The lab times the period, measures
  the semi-major axis from the nearest and furthest points reached, and sums the areas swept in twelve
  equal times; they agree to 10⁻⁶. It also covers:
  - a geostationary satellite hanging over a ground station;
  - Newton's cannon;
  - the "same speed, aimed upward" orbit that crashes;
  - escape;
  - **air drag and the satellite paradox**: kinetic energy rises while total energy falls, and the
    potential energy lost is exactly twice the kinetic energy gained.
- **Binary star**: both stars are integrated, and the centre of mass is checked rather than assumed.
  Radial-velocity curves show what a telescope records.
- **Inside the Earth**: a cut-away globe built on the PREM seismic density model, where g **rises** to
  10.69 m/s² at the core boundary. A ball in a straight tunnel takes 42.2 min one way for every chord
  of a uniform Earth, but only 38 min through the real one. A plumb line shows the effect of spin, and
  a shortened day can make the equator float.
- **True 3D orbits**: an inclination control tips the orbit plane, and the launch point can be set
  anywhere round the orbit. A polar orbit's gold **ground track** sweeps the turning Earth strip by
  strip. A Molniya orbit (63.4°, 12 h) hangs its apogee over the north. The satellite glows, and
  darkens in Earth's shadow. The effective potential U = −GM/r + L²/2r² is plotted against the
  energy line: the turning points are where they cross, and the gap between them is the radial
  kinetic energy.
- **The solar system**: the Sun, eight planets, Pluto and Halley's comet on their real J2000
  elements, each integrated from perihelion. Kepler III is plotted from the *timed* periods, all on
  the line of slope 3/2 (Mars 1.881 yr, Halley 75.31 yr). Equal-area sectors and a speed plot are
  shown for the body being followed: Halley moves 59.9× faster at perihelion, and its tail points
  away from the Sun.
- **Mission control**: a FIRE ENGINE button on the stage applies a Δv (prograde, retrograde or
  radial) to the live orbit, and the integrator restarts from that exact state. A Hohmann autopilot
  climbs from 300 km to geostationary orbit with two burns (2.43 and 1.47 km/s). The apogee is found
  by bisection, and the craft finishes with e = 0.0001. A rendezvous mission puts a target 10° ahead:
  speeding up makes you fall behind; dropping lower catches it.
- **Field and potential**: the Earth–Moon potential drawn as a 3D landscape with equipotential
  contours (marching squares). The neutral point sits at 0.900 d. A probe launched at 11.05 km/s falls
  back; at 11.09 km/s it crests the saddle and reaches the Moon, below the 11.19 km/s escape speed. A
  hollow-shell option shows the flat, field-free interior.
- **Cavendish torsion balance**: the torque is summed over all four sphere pairs, and a laser spot is
  read on a scale 5 m away. The lab works out G from turning points exactly as a student does. The
  textbook formula comes out 7.5% low because of the far spheres; with the far-sphere and damping
  corrections it returns **6.674 × 10⁻¹¹**.
- **Shapes and superposition** (JEE Advanced): a ring, disc, shell, solid sphere, sphere with a
  cavity, or n point masses, each built from up to 3000 point masses and summed by brute force. g and
  V along the axis are plotted as the sum (dots) against the formula (dashes). The ring's field peaks
  at the measured 0.707 R = R/√2. The field inside a cavity is uniform and parallel, 0.502 against
  the formula's 0.500. Four masses on a square have U = −(4 + √2)Gm²/a. Drag the probe anywhere.
- **Dropped from h = R**: set the launch speed to zero and the integrated impact speed (7.91 km/s)
  is shown beside the wrong √(2gh) = 11.19 km/s.

### Physics · Mechanical Properties of Fluids
**Fluids — Pressure, Flow, Viscosity and Surface Tension**
Twelve set-ups, each computing what it shows.
- **A draining tank** with real jets landing on a rule. Two holes at y and H − y hit the same spot, and
  the drain time matches (A/a)√(2H/g) to the second.
- **A venturimeter** with five manometer tubes, and the pressure and energy lines drawn on a
  backboard. Friction comes out of f(Re), so Cd falls below one, and far below in a laminar oil. Open
  the exit and the throat sucks air; push the flow hard enough and the water cavitates.
- **A falling-ball viscometer** timed by two light gates, with the full drag law, added mass and the
  wall correction. Stokes' law holds in creeping flow and fails for a steel ball in water. An inset
  shows the Stokes streamlines and the three forces.
- **Archimedes**: a spring balance and a beaker on a scale show both halves at once. Iron floats on
  mercury. Cut the string and the block bobs.
- **Moving frames**: in an accelerating cart the water surface settles at tan θ = a/g. It first
  overshoots to about twice that tilt, because the first sloshing mode rings. A pendulum swings
  back while a helium balloon leans **forward**. In a spinning vessel the surface is a paraboloid; its
  volume is conserved, it spins up over the Ekman time, and above 27 rad/s the centre runs dry.
- **Two soap bubbles** joined by a valve: each cap's pressure is 4T/R from its real geometry, and the
  air flows through the tube by Poiseuille's law. The small bubble empties into the large one.
- **A U-tube** with oil poured on water. The two columns balance at the interface. Tip it and it
  oscillates with T = 2π√(L/2g).
- **Capillary rise** in three tubes, integrated with inertia: the wide tube overshoots and rings. A
  tube that is too short does **not** overflow; its contact angle gives way instead.
- **Hydraulic lift** (Pascal): drag the pump handle. The effort is A₁(Mg/A₂ + ρgx(1 + A₁/A₂)): it
  creeps up because the big piston rises as the small one sinks. The work is integrated over the
  stroke and equals Mgy plus the oil raised (19.674 J for 1000 kg, 2 cm and 20 cm pistons, 20 cm stroke).
- **Force on a wall**: the wetted face is summed over 800 strips (881.13 N for 60 cm of water on a
  50 cm wall, acting H/3 up, moment ρgwH³/6). An oil layer on top (818.35 N) and an inclined wall
  (1017.4 N at 60°) are included; the horizontal part never changes.
- **Merging drops**: 1000 drops join the central one nearest first, while the surface area is summed
  every frame. Water releases 0.8233 mJ = 4πR²T(n^⅓ − 1); mercury heats by 0.691 mK.

### Physics · System of Particles & Rotational Motion
**27 · Rolling, Slipping and the Moment of Inertia**
Nothing is told to roll. The friction that rolling *requires* is computed every step and tested
against μN; when it cannot be supplied the two equations decouple and the body genuinely slips.
Four bodies race from the same height, and mass and radius cancel out of the answer entirely.

### Physics · Oscillations
**28 · Resonance, Damping and Normal Modes**
RK4 on the damped driven equation, so the switch-on transient is a real transient that decays at
the system's own frequency. The coupled pair is solved by **diagonalising the stiffness matrix** —
the normal-mode frequencies on screen are its eigenvalues and the mode cards draw its eigenvectors.

### Physics · Electric Charges & Fields
**29 · Electric Field, Potential and Gauss's Law**
The flux is **measured, not asserted**: E·n̂ is summed over a Fibonacci lattice of six hundred points
on a real sphere and printed next to q_enc/ε₀. Field lines are traced by integrating dr/ds = Ê and
equipotentials by marching squares. Move the surface and the number does not budge.

### Physics · Alternating Current
**30 · Series LCR — Phasors, Resonance and Power Factor**
The circuit equation is integrated, with the option of starting already on the steady-state solution.
Rotating phasors, an impedance triangle that flips with the sign of X_L − X_C, and voltmeter bars
scaled so that at high Q the **supply** bar is the short one.

### Physics · Dual Nature of Radiation & Matter
**31 · The Photoelectric Effect and Matter Waves**
Einstein's equation driving a real photo-cell: the I–V family, the V₀–ν line whose slope is h/e for
every metal, and the energy-level picture of the surface. Turn the lamp down and the electrons still
come out — just fewer of them.

### Physics · Kinetic Theory of Gases
**32 · Kinetic Theory — Where the Maxwell Curve Comes From**
The curve is **not drawn**. A box of molecules is given random velocities, they collide elastically
with each other on a cell list and with the walls, and the histogram of their speeds is measured as
the simulation runs — settling onto the analytic curve nobody put there. Pressure is measured the
same way, from the momentum actually delivered to the walls, and comes out within a few percent of
nkT.

### Physics · Electromagnetic Induction
**33 · Electromagnetic Induction — Lenz's Law, Measured**
A magnet falls through a coil. The flux linkage is integrated from the real dipole field,
differentiated for the emf, divided by the resistance for the current, and the force on that current
is fed back into the magnet's equation of motion. It brakes because the numbers say so — and a
free-falling twin drops alongside for comparison.

### Physics · Thermodynamics
**34 · Heat Engines — the PV Cycle and the Carnot Limit**
Carnot, Otto, Diesel and Stirling, with the work obtained by **numerically integrating P dV** round
the loop and the heat per leg from the first law. The Carnot cycle reproduces its own limit to
within 0.05%, and the net entropy change round any cycle comes out at 10⁻¹⁷ J/K — both of which are
checks on the integrator, not assumptions fed into it.

### Chemistry · Structure of Atom
**5 · Hydrogen Atomic Orbitals — Shape, Phase and Nodes**
The point cloud is **rejection-sampled from |ψ|²** using exact radial functions and real spherical
harmonics. A second graph shows the signed R(r) so nodes are visible as genuine zero crossings.

**6 · Bohr Model & the Hydrogen Spectrum**
Every wavelength from **1/λ = RZ²(1/n_f² − 1/n_i²)**, with the Balmer lines painted in their true
colours, all five series on one wavenumber axis, and a Rydberg linearity check. Switches to He⁺,
Li²⁺ and Be³⁺ for the Z² scaling.

### Chemistry · Aromaticity & Molecular Orbitals
**· Hückel MO Theory — Where 4n + 2 Actually Comes From**
Builds the secular determinant for any π system you choose and **diagonalises it live** by Jacobi rotations.
Fills the levels respecting degeneracy, reports delocalisation energy and the HOMO–LUMO gap, and draws the
selected MO as phased p-orbital lobes on the ring. A **Frost circle** is drawn beside the computed ladder with
tie lines proving the mnemonic and the eigenvalues are the same thing. Aromatic, antiaromatic and non-aromatic
are verdicts from the arithmetic, including the planarity trap that catches cyclooctatetraene.

### Chemistry · Stereochemistry & Conformation
**· Conformational Analysis — Newman Projections & the Ring Flip**
A real torsional potential — threefold bond term plus a pairwise van der Waals term — sampled every degree,
with **Boltzmann populations** integrated over the whole curve. The anti/gauche/eclipsed/syn-periplanar
structure emerges rather than being labelled. Switch to cyclohexane and the same thermodynamics drives the
chair–chair flip using measured **A-values**, with the 1,2/1,3/1,4 cis–trans logic computed.

**· Chirality, CIP and the Polarimeter**
A genuine Cahn–Ingold–Prelog comparison over the four branches assigns R/S — including the inversion when the
lowest priority is not pointing away. Alongside it a working polarimeter: α = [α]·l·c, a plane of polarisation
drawn as a ribbon that genuinely twists along the tube, an analyser obeying **Malus's law**, and optical
rotatory dispersion from a one-term Drude equation.

### Chemistry · Aromatic Compounds
**· Electrophilic Aromatic Substitution — Directing Effects from First Principles**
Takes the **Hammett σ⁺** of the substituent and the **ρ⁺** of the electrophile, computes a partial rate factor
for every position, and turns those into an isomer distribution and a rate relative to benzene. The arenium ion
is drawn with its three resonance contributors, so you can watch the donor lone pair quench the charge at ortho
and para — and fail to at meta. Halogens, sterics and the anilinium trap all fall out of the numbers.

### Chemistry · Hydrocarbons & Reaction Mechanisms
**· Carbocations — Markovnikov, Hyperconjugation and Rearrangement**
Markovnikov as a consequence rather than a premise: both protonation barriers are computed from cation
stability through a Hammond relation, and the **competing kinetic scheme is integrated** to give the product
distribution. 1,2-hydride and methyl shifts are in the scheme, so the "unexpected" rearranged product appears
on its own. The peroxide effect switches the mechanism to a radical chain — for HBr only.

### Chemistry · Haloalkanes & Haloarenes
**7 · SN1 vs SN2 — Mechanism, Stereochemistry and Rate Law**
Real 3D backside attack and **Walden inversion**; a planar carbocation for SN1 with a **live
racemisation tally**. Both barriers computed from your conditions, plus the rate-vs-[Nu⁻] graph that
is the actual experiment distinguishing the two mechanisms.

**8 · E1 vs E2 Elimination — Geometry, Saytzeff and Hofmann**
The stereo-electronic requirement as a **slider**: E2 refuses to proceed until the β-hydrogen is
anti-periplanar to the leaving group. Newman projection, full product distribution, and the switch
from Saytzeff to Hofmann when the base becomes bulky.

### Biology · Animal Kingdom  *(the flagship suite — nine labs)*
Built to NCERT Class XI Chapter 4. A shared taxonomic core holds all eleven phyla, the three
chordate subphyla and the seven vertebrate classes, with every character and every example genus
the syllabus names. All nine labs read from that one dataset, so nothing can drift out of step.

**A1 · The Classification Key** — six characters applied in any order; phyla that fail drop out
live. Carries the full structural comparison matrix *and* a second organ-systems matrix, an
elimination funnel, and an "identify a specimen" mode. The readout names the **best next
character** — the actual logic by which taxonomic keys are built.

**A2 · Body Symmetry** — takes each real body outline, reflects it about a test plane and
**measures** how well the halves agree. The number of peaks in the graph *is* the number of
planes of symmetry: 0 for a sponge, 1 for Planaria, 2 for a comb jelly, 5 for a starfish. A
variable-fold model animal lets the student set n and confirm the prediction.

**A3 · Germ Layers and the Body Cavity** — zygote → blastula → gastrula → mesoderm → cavity,
animated in cross-section. Diploblastic, acoelomate, pseudocoelomate and coelomate side by side,
plus schizocoely vs enterocoely and the full protostome/deuterostome contrast. Includes a
germ-layer derivative map.

**A4 · Sponge Canal Systems** — a real flow calculation. Water enters thousands of ostia slowly,
**almost stops in the flagellated chambers** so the collar cells can feed, then leaves the
osculum as a fast jet. Asconoid, syconoid and leuconoid compared at equal body size.

**A5 · Cnidaria: Nematocyst and Metagenesis** — discharge kinematics anchored to the measured
values: **18.6 m/s and about five million g**, the fastest known cellular process. Plus the
Obelia polyp↔medusa alternation.

**A6 · Water Vascular System** — starfish locomotion as genuine hydraulics. Squeeze an ampulla
and the tube foot extends by exactly the displaced volume over its cross-section. Metachronal
gait diagram, adhesion limits, and the force that prises open a bivalve.

**A7 · Vertebrate Heart, Two Chambers to Four** — blood is coloured by its computed **oxygen
saturation**, so mixing in a three-chambered heart is visible rather than asserted. A
supply-versus-demand chart shows why only fully divided hearts support homeothermy — and the
diving crocodile's pulmonary shunt is there too.

**A8 · Chordate Characters and the Vertebrate Tree** — a cladogram marking where each character
is gained, distinguishing **present for life** from **present only in the larva** — the exact
distinction examiners test. Includes the larva-vs-adult comparison for tunicates and amphibians.

**A9 · Specimen Identification Challenge** — a scored drill over every genus NCERT names, played
on the stage. Tracks streak, accuracy and a **per-taxon breakdown**, so the second graph names
exactly which groups to revise.

### Biology · Neural Control & Coordination
**9 · Nerve Impulse — the Hodgkin–Huxley Action Potential**
The full 1952 equations across a **100-compartment cable**, so the spike genuinely propagates and
conduction velocity is measured. Drawn on a real neuron — soma, dendrites, axon hillock, terminal
boutons — with membrane potential painted along the axon. The membrane patch is an actual
phospholipid bilayer with the Na⁺ and K⁺ channels embedded in it and m, h and n gating live.
TTX and TEA block the real channels. **Myelinating the axon is a change to the cable, not to the
picture**: the internodes lose their voltage-gated channels and most of their leak and
capacitance, so the spike genuinely jumps node to node — measured **3.6 → 8.3 m/s**.

**10 · The Synapse — Quantal Release, Summation and Drugs**
Drawn as a neuromuscular junction: axon knobs with mitochondria and a reserve vesicle pool,
Ca²⁺ channels in the active zone, vesicles that open a real omega-shaped fusion pore, and a
folded postsynaptic membrane whose nicotinic receptors sit on the curve of the end plate.
Release follows the real **fourth-power dependence on external Ca²⁺**. Temporal and spatial summation,
EPSP/IPSP arithmetic, and three drugs acting at three different points in the chain — curare,
botulinum and neostigmine.

### Biology · Body Fluids & Circulation
**11 · The Cardiac Cycle — Pressure, Volume, Valves and the ECG** *(rebuilt)*
A **whole closed circulation**, not a heart on its own: RA → RV → lungs → LA → LV → body arteries →
veins → back, with a time-varying elastance for every chamber (the left ventricle's relaxed wall
stiffens exponentially) and a compliance for every vessel bed. **All four valves** open and shut on
pressure alone, and blood volume is conserved to the last millilitre, checked on screen. Timing comes
from the ECG: a PR interval, a 35 ms electromechanical delay, and systole that shortens with heart
rate as QT does. The stage is a **live Wiggers diagram** (pressures, LV volume, ECG and a
phonocardiogram with S1 and S2 at the valve closures) beside the heart, with blood moving through
it at the computed flows. A ribbon above names the seven textbook phases, and the heart sounds
can be played aloud. Presets cover exercise, hypertension, heart failure, blood loss, aortic
stenosis and mitral regurgitation, each producing its real signs: a pressure gradient, murmurs, a
misleadingly high EF, and a raised atrial pressure. The PV loop is coloured by phase, and the
Frank–Starling curve is measured, not drawn, and bends over as it should.

**12 · Cardiac Conduction System & Heart Block**
Event-driven conduction from SA node through the internodal tracts, AV node, bundle of His, both
bundle branches and the Purkinje fibres — all drawn on the anatomical heart they drive, lighting up
as the impulse passes. Plus a **ladder diagram** and an ECG synthesised
from what actually conducted. First-degree, Wenckebach, Mobitz II and complete block — and the
beat-by-beat PR plot that diagnoses each one.

### What every experiment carries
**Stage** · **Control Deck** (live SI-unit parameters, click any value to type an exact number) ·
**Readout strip** · **Equation pane** with values substituted live · **one or two graphs** with
hover crosshair and tooltip · **Guided walkthrough** (predict-then-reveal) · **Check yourself**
quiz · **Lab notebook** for recording readings · **Why this is asked** exam framing.

### Lab environment
Ghost-overlay comparison on any graph · fullscreen stage · keyboard shortcuts
(space / R / L / ← →) · chapter-grouped navigation · adjustable simulation speed.

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
├── index.html           shell + the complete design system (all CSS)
├── lab-core.js          sim registry, console shell, control deck, multi-plot canvas
│                        library with hover inspection, walkthrough + quiz engines,
│                        lab notebook, RK4 integrator, 3D camera + projection
├── sims-physics.js      Lorentz force · Young's double slit
├── sims-physics2.js     cyclotron · diffraction & resolving power
├── sims-chemistry.js    hydrogen orbitals · SN1/SN2
├── sims-chemistry2.js   Bohr model & spectrum · E1/E2 elimination
├── sims-biology.js      action potential · cardiac cycle
├── sims-biology2.js     synapse · cardiac conduction & heart block
├── art-organic.js       organic structure library (`window.ORGART`) — skeletal formulae, rings,
│                        curly (electron-pushing) arrows, Newman projections, cyclohexane chairs,
│                        tetrahedral stereocentres, p-orbital lobes and reaction profiles
├── render.js            illustration renderer (`window.RX`) — lit gradients, ambient occlusion,
│                        rim light, tissue grain, cast shadows, light-aware contours. Every
│                        figure library draws through it, so one improvement lifts all of them.
├── art-zoo.js           zoological figure library (`window.ZOOART`) — cells, epithelia, body-wall
│                        layers, nematocysts, choanocytes, spicules, Hydra and sponge sections
├── mech.js              mechanism engine (`window.MECH`) — scenes in, an interpolated frame out;
│                        breaking and forming bonds, partial charges, timed curly arrows
├── steps.mjs            walks every scene of every mechanism and screenshots each
├── audit.mjs            control audit — static wiring check plus a live click-through of every
│                        control and preset on every lab; must print CLEAN before a release
├── art-bio.js           anatomical figure library (`window.BIOART`) — the vertebrate heart,
│                        the neuron, the phospholipid bilayer and the synapse. Every figure is
│                        drawn in a normalised box and scaled, so any lab places one at any size.
├── render3d.js          3D apparatus layer (`window.R3`) — a depth-sorted frame you push
│                        primitives into: spheres, cylinders, tubes, boxes, planes, arrows,
│                        coils, polylines and labels, plus `texPlane`, which paints an
│                        offscreen canvas onto any plane in the scene as a grid of affine
│                        triangles. Ground geometry declares itself with `F.GROUND`, because
│                        a single depth key cannot sort a large flat surface against the
│                        small objects standing on it.
└── sims-extend.js       depth pass — extra controls, second graphs and quizzes
                         bolted onto the earlier labs via `InsightLab.extend()`
```

**Nine physics benches are real 3D scenes.** Rolling bodies on an inclined bench, a vacuum chamber
with pole faces and an aimable injector, a cyclotron with extruded dees, an optical rail carrying a
double slit, and a focal plane painted with a true Airy image — all orbitable, all with apparatus
you can drag into shape. Three harnesses exist because the default camera hides things:
`sweep.mjs` renders one lab from a list of angles, `sweepall.mjs` walks several labs at their home
view plus two extremes, and `narrow.mjs` checks 430 px for overflow.

**Mechanisms animate, step by step.** `smartlab/mech.js` renders a reaction as a list of scenes and
interpolates between them: bonds genuinely break and form, charges fade in, fractional bond orders
read as delocalisation, and the curly arrows draw themselves before the geometry they explain starts
to move. Four labs run on it — electrophilic aromatic substitution, carbocation addition and
rearrangement, and curly-arrow insets on SN1/SN2 and E1/E2. Every scene is clickable, and
`smartlab/steps.mjs` screenshots each one so a broken intermediate cannot hide behind a good first frame.

**Every control is verified before every release.** `smartlab/audit.mjs` runs a static wiring check and then
a live click-through of every range, toggle, select option and preset across all 26 labs, asserting the
parameter actually moves. It must print `CLEAN` — it has already caught two genuinely dead controls.

**Ten rendering layers live in the engine**, so every lab gets them: an instrument ground with vignette and
measurement grid; a real threshold-and-blur **bloom** pass; **collision-aware labels** that nudge apart and
grow leader lines; perceptual colour ramps; frame-rate-independent **tweening**; lit sphere and shadow
materials; **hit targets** that advertise themselves under the cursor; a layout grid; scale-bar chrome; and a
quality tier that follows the measured frame cost.

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

**Phase 1.5 — done.** Engine v2 (multi-plot, hover inspection, typed numeric entry, ghost
comparison, fullscreen, lab notebook, quizzes, chapter navigation) and six more experiments,
taking every chapter to two.

**Phase 2.** Widen to new chapters — LCR resonance and phasors, the photoelectric effect,
rotational dynamics; chemical equilibrium, electrochemical cells, a VSEPR builder; DNA
replication and translation, nephron filtration, mitosis and meiosis.

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
