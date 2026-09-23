/* ============================================================
   PHYSICS (syllabus core, batch 2)
     16. Laws of motion: connected bodies, friction and banking
     17. Centre of mass and collisions
     18. Capacitance, dielectrics and energy
   ============================================================ */
(function (L) {
  'use strict';
  const { clamp, TAU, fmt, E, Camera } = L;
  const PA = window.PHYSART, R3 = window.R3, RX = window.RX, SV = window.SOLVE;

  /* =========================================================================
     16 · LAWS OF MOTION — a real bench, solved as constraint equations

     Every rig is Newton's second law for each body plus the constraints
     that tie them together (an inextensible string, a pulley that turns
     without slipping, a block that must stay on the face of a wedge),
     assembled as a linear system and handed to SOLVE.lin. Nothing is looked
     up. Friction is settled by a test before anything moves: solve as if
     static, read off the friction that would need, compare with μₛN, and
     only if it cannot be supplied release the bodies onto μₖN.

     The bench measures as well as computes: an ultrasonic motion sensor
     logs position against time with the millimetre noise a real one has,
     and the acceleration is recovered from its record by least squares —
     which is how the practical exam asks for it.
     ========================================================================= */

  const G = 9.81;

  /* the lift's journey: rest, accelerate, cruise, brake, rest — or the cable
     parts, the car falls freely, and the safety brake catches it */
  function liftProfile(p) {
    const A = p.liftA, segs = [];
    if (p.trip === 'cut') {
      segs.push([0.8, 0], [0.62, -G], [0.30, 2 * G * 0.62 / 0.30 / 2], [1.2, 0]);
    } else {
      const s = p.trip === 'down' ? -1 : 1;
      segs.push([0.6, 0], [1.2, s * A], [1.0, 0], [1.2, -s * A], [1.0, 0]);
    }
    // integrate once, exactly (piecewise-constant a)
    const out = [];
    let t = 0, v = 0, z = 0;
    segs.forEach(q => { out.push({ t0: t, dur: q[0], a: q[1], v0: v, z0: z });
                        z += v * q[0] + 0.5 * q[1] * q[0] * q[0]; v += q[1] * q[0]; t += q[0]; });
    return { segs: out, T: t, zEnd: z, zMin: Math.min(0, ...out.map(q => q.z0), z), zMax: Math.max(0, ...out.map(q => q.z0), z) };
  }
  function liftAt(L, t) {
    let q = L.segs[L.segs.length - 1];
    for (const s of L.segs) if (t < s.t0 + s.dur) { q = s; break; }
    const u = Math.min(Math.max(t - q.t0, 0), q.dur);
    return { a: q.a, v: q.v0 + q.a * u, z: q.z0 + q.v0 * u + 0.5 * q.a * u * u };
  }

  function mechanics(S) {
    const p = S.p, g = G;
    const us = p.muS, uk = Math.min(p.muK, p.muS);
    const R = { mode: p.mode, g: g };
    const Ip = 0.5 * p.mp;                                // I/r² of a uniform-disc pulley

    if (p.mode === 'atwood') {
      /* unknowns (a, T₁, T₂), a positive when m₁ descends:
           m₁a + T₁ = m₁g ;  m₂a − T₂ = −m₂g ;  (I/r²)a − T₁ + T₂ = 0      */
      const x = SV.lin([[p.m1, 1, 0], [p.m2, 0, -1], [Ip, -1, 1]], [p.m1 * g, -p.m2 * g, 0]);
      R.a = x[0]; R.T1 = x[1]; R.T2 = x[2]; R.T = R.T1;
      R.static = Math.abs(R.a) < 1e-12; R.fNeed = 0; R.fMax = 0;
      R.bodies = [
        { tag: 'm₁', m: p.m1, W: p.m1 * g, T: R.T1, N: 0, f: 0, a: R.a },
        { tag: 'm₂', m: p.m2, W: p.m2 * g, T: R.T2, N: 0, f: 0, a: -R.a }
      ];
      return R;
    }

    if (p.mode === 'table' || p.mode === 'incline') {
      const th = p.mode === 'incline' ? p.theta * Math.PI / 180 : 0;
      const N = p.m1 * g * Math.cos(th);
      const drive = p.m2 * g - p.m1 * g * Math.sin(th);
      const fMax = us * N;
      R.N = N; R.fNeed = drive; R.fMax = fMax; R.drive = drive; R.theta = th;
      if (Math.abs(drive) <= fMax + 1e-12) {
        /* static: nothing turns, so the pulley needs no torque and the two
           tensions are equal; friction is exactly what balance requires */
        R.static = true; R.a = 0; R.T1 = R.T2 = p.m2 * g; R.f = drive;
      } else {
        const fk = uk * N * Math.sign(drive);
        /* unknowns (a, T₁, T₂), a positive when m₂ descends:
             m₂a + T₂ = m₂g
             m₁a − T₁ = −m₁g sinθ − f_k
             (I/r²)a + T₁ − T₂ = 0                                        */
        const x = SV.lin([[p.m2, 0, 1], [p.m1, -1, 0], [Ip, 1, -1]],
                         [p.m2 * g, -p.m1 * g * Math.sin(th) - fk, 0]);
        R.static = false; R.a = x[0]; R.T1 = x[1]; R.T2 = x[2]; R.f = fk;
      }
      R.T = R.T1;
      R.bodies = [
        { tag: 'm₁', m: p.m1, W: p.m1 * g, T: R.T1, N: N, f: R.f, a: R.a, theta: th },
        { tag: 'm₂', m: p.m2, W: p.m2 * g, T: R.T2, N: 0, f: 0, a: R.a }
      ];
      return R;
    }

    if (p.mode === 'wedge') {
      /* A block m on the smooth face of a wedge M that is itself free to slide
         on a smooth floor. Unknowns (A, a_r, N): the wedge's acceleration
         (backwards), the block's acceleration down the face RELATIVE to the
         wedge, and the normal force. The constraint is that the block stays
         on the face; that is what couples the two.
           block, horizontal:  m(a_r cosθ − A) = N sinθ
           block, vertical:    −m a_r sinθ     = N cosθ − mg
           wedge, horizontal:  M A             = N sinθ                   */
      const th = p.theta * Math.PI / 180, m = p.m1, M = p.M, s = Math.sin(th), c = Math.cos(th);
      let A, ar, N;
      if (p.fixWedge) { A = 0; ar = g * s; N = m * g * c; }
      else {
        const x = SV.lin([[-m, m * c, -s], [0, -m * s, -c], [M, 0, -s]], [0, -m * g, 0]);
        A = x[0]; ar = x[1]; N = x[2];
      }
      R.A = A; R.ar = ar; R.N = N; R.theta = th;
      R.ax = ar * c - A; R.az = -ar * s;                 // the block, in the ground frame
      R.a = Math.hypot(R.ax, R.az);
      R.pathAngle = Math.atan2(-R.az, R.ax) * 180 / Math.PI;
      R.Nfloor = M * g + N * c;                          // what the floor pushes up on the wedge
      R.static = false; R.fNeed = 0; R.fMax = 0; R.T = 0;
      R.bodies = [
        { tag: 'm', m: m, W: m * g, T: 0, N: N, f: 0, a: R.a, theta: th },
        { tag: 'M', m: M, W: M * g, T: 0, N: R.Nfloor, f: 0, a: A, push: 0 }
      ];
      return R;
    }

    if (p.mode === 'lift') {
      const L = S.liftTrip || (S.liftTrip = liftProfile(p));
      const k = liftAt(L, S.tRun || 0);
      R.aLift = k.a; R.vLift = k.v;
      R.Nscale = p.m1 * (g + k.a);                       // what the scale pushes up with
      R.reading = R.Nscale / g;                          // what it shows, in kg
      R.Tcable = p.trip === 'cut' && (S.tRun || 0) > 0.8 ? 0 : (p.liftM + p.m1) * (g + k.a);
      R.a = k.a; R.static = false; R.fNeed = 0; R.fMax = 0; R.T = R.Tcable;
      R.bodies = [{ tag: 'm', m: p.m1, W: p.m1 * g, T: 0, N: R.Nscale, f: 0, a: k.a }];
      return R;
    }

    if (p.mode === 'contact') {
      /* two blocks pushed by F on m₁, each with its own friction */
      const F = p.F, fTot = us * (p.m1 + p.m2) * g;
      R.fNeed = F; R.fMax = fTot;
      if (F <= fTot + 1e-12) {
        /* Static, and genuinely indeterminate: how the static friction is
           shared between the two blocks is not fixed by Newton's laws, so
           the contact force can be anything from 0 up to the least of F and
           what block 2's friction can hold. The lab says so, not a number. */
        R.static = true; R.a = 0; R.Nc = null;
        R.NcMax = Math.min(F, us * p.m2 * g);
      } else {
        const x = SV.lin([[p.m1, 1], [p.m2, -1]], [F - uk * p.m1 * g, -uk * p.m2 * g]);
        R.static = false; R.a = x[0]; R.Nc = x[1];
      }
      R.T = R.Nc || 0;
      R.bodies = [
        { tag: 'm₁', m: p.m1, W: p.m1 * g, T: -(R.Nc || 0), N: p.m1 * g, f: R.static ? 0 : uk * p.m1 * g, a: R.a, push: F },
        { tag: 'm₂', m: p.m2, W: p.m2 * g, T: R.Nc || 0, N: p.m2 * g, f: R.static ? 0 : uk * p.m2 * g, a: R.a }
      ];
      return R;
    }

    /* banking — circular motion: the unknown is a band of speeds */
    const th = p.theta * Math.PI / 180, r = p.radius, t = Math.tan(th);
    R.vIdeal = Math.sqrt(r * g * t);
    const num1 = t + us, den1 = 1 - us * t, num2 = t - us, den2 = 1 + us * t;
    R.vMax = den1 > 1e-6 ? Math.sqrt(r * g * num1 / den1) : Infinity;
    R.vMin = num2 > 0 ? Math.sqrt(r * g * num2 / den2) : 0;
    R.needed = p.m1 * p.speed * p.speed / r;
    R.safe = p.speed >= R.vMin - 1e-9 && p.speed <= R.vMax + 1e-9;
    R.slides = p.speed > R.vMax ? 'out' : p.speed < R.vMin ? 'in' : null;
    R.a = p.speed * p.speed / r;
    R.static = R.safe;
    const Nb = p.m1 * (g * Math.cos(th) + R.a * Math.sin(th));
    R.fNeed = p.m1 * (R.a * Math.cos(th) - g * Math.sin(th));
    R.fMax = us * Nb;
    R.bodies = [{ tag: 'car', m: p.m1, W: p.m1 * g, T: 0, N: Nb, f: R.fNeed, a: R.a, theta: th }];
    return R;
  }

  /* least-squares slope of v against t: the acceleration a student would
     report from the sensor's record */
  function fitSlope(pts) {
    const n = pts.length;
    if (n < 3) return null;
    let sx = 0, sy = 0, sxx = 0, sxy = 0;
    pts.forEach(q => { sx += q[0]; sy += q[1]; sxx += q[0] * q[0]; sxy += q[0] * q[1]; });
    const d = n * sxx - sx * sx;
    return Math.abs(d) < 1e-12 ? null : { m: (n * sxy - sx * sy) / d, c: (sy * sxx - sx * sxy) / d };
  }

  /* how far each rig can run before something hits a stop */
  function travelOf(p, R) {
    if (p.mode === 'atwood') return 0.34;
    if (p.mode === 'table') return 0.52;
    if (p.mode === 'incline') return 0.42;
    if (p.mode === 'contact') return 0.62;
    if (p.mode === 'wedge') {
      const th = p.theta * Math.PI / 180, Lw = 0.62, Ls = Lw / Math.cos(th);
      return Math.max(0.05, Ls - 0.30);
    }
    return 0;
  }
  /* A sensor's reading is never perfectly clean. Each sample gets its own
     independent error of up to ±0.3 mm (repeatable, from a hash of the time),
     so it averages out over a run the way real sensor noise does — a smooth
     wobble would not, and would bias the fitted slope. Logged at 50 Hz. */
  const sensorNoise = t => {
    const h = Math.sin(Math.round(t * 50) * 12.9898 + 78.233) * 43758.5453;
    return 0.0003 * 2 * ((h - Math.floor(h)) - 0.5);
  };

  L.register({
    id: 'newton', subject: 'physics',
    name: 'Laws of Motion — Pulleys, Wedges, Lifts and Friction',
    chapter: 'Laws of Motion',
    exams: ['JEE Main', 'JEE Advanced', 'NEET UG'],
    weight: 'Very high yield',
    is3D: true,
    stageHint: 'Drag the hanging mass to change it · the motion sensor measures what the equations predict',
    lede: 'This is a working bench, not a diagram. Each rig — pulleys, a ramp, a wedge that slides away ' +
      'from under its block, a lift on a trip — is solved from Newton\'s second law for <b>every body</b> ' +
      'plus the <b>constraints</b> that join them: a string that cannot stretch, a pulley that turns ' +
      'without slipping, a block that must stay on the wedge. Friction is settled by a test before ' +
      'anything moves. Then the bench <b>measures</b> what happens: an ultrasonic motion sensor logs the ' +
      'position with real millimetre noise, the acceleration is fitted from its record, and a force ' +
      'sensor reads the tension. Theory and measurement sit side by side, as they do in the practical exam.',

    params: { mode: 'table', m1: 4, m2: 3, mp: 0, theta: 30, muS: 0.30, muK: 0.25,
              F: 20, M: 4, fixWedge: false, liftA: 2, liftM: 350, trip: 'up',
              radius: 80, speed: 15, showFBD: true, run: true },

    presets: [
      { name: 'Atwood machine', params: { mode: 'atwood', m1: 5, m2: 3, mp: 0 } },
      { name: 'Atwood · heavy pulley', params: { mode: 'atwood', m1: 5, m2: 3, mp: 2 } },
      { name: 'Table · it holds', params: { mode: 'table', m1: 10, m2: 2, muS: 0.5, muK: 0.4, mp: 0 } },
      { name: 'Table · it breaks free', params: { mode: 'table', m1: 10, m2: 8, muS: 0.5, muK: 0.4, mp: 0 } },
      { name: 'Incline · on the edge', params: { mode: 'incline', m1: 5, m2: 3, theta: 30, muS: 0.6, muK: 0.5, mp: 0 } },
      { name: 'Incline · slides down', params: { mode: 'incline', m1: 10, m2: 1, theta: 35, muS: 0.2, muK: 0.1, mp: 0 } },
      { name: 'Sliding wedge', params: { mode: 'wedge', m1: 1, M: 4, theta: 30, fixWedge: false } },
      { name: 'Light wedge recoils', params: { mode: 'wedge', m1: 2, M: 1, theta: 40, fixWedge: false } },
      { name: 'Lift going up', params: { mode: 'lift', m1: 60, liftA: 2, trip: 'up' } },
      { name: 'Lift cable cut', params: { mode: 'lift', m1: 60, liftA: 2, trip: 'cut' } },
      { name: 'Blocks in contact', params: { mode: 'contact', m1: 3, m2: 2, F: 20, muS: 0, muK: 0 } },
      { name: 'Banked curve', params: { mode: 'banking', m1: 1200, theta: 20, radius: 80, muS: 0.4, muK: 0.35, speed: 15 } }
    ],

    controls: [
      { group: 'Arrangement', items: [
        { key: 'mode', type: 'select', label: 'What is on the bench', restructure: true, options: [
          { value: 'atwood', label: 'Atwood' }, { value: 'table', label: 'Table' },
          { value: 'incline', label: 'Ramp' }, { value: 'wedge', label: 'Wedge' },
          { value: 'lift', label: 'Lift' }, { value: 'contact', label: 'Contact' },
          { value: 'banking', label: 'Banking' }] }
      ] },
      { group: 'The masses', items: [
        { key: 'm1', label: 'Mass <i>m</i>₁ (block, or person in the lift)', min: 0.5, max: 100, step: 0.1, unit: 'kg',
          fmt: v => v.toFixed(1), restructure: true },
        { key: 'm2', label: 'Mass <i>m</i>₂ (hanging)', min: 0.5, max: 20, step: 0.1, unit: 'kg',
          fmt: v => v.toFixed(1), restructure: true },
        { key: 'mp', label: 'Pulley mass (a uniform disc)', min: 0, max: 6, step: 0.1, unit: 'kg',
          fmt: v => v.toFixed(1), restructure: true }
      ] },
      { group: 'The surfaces', items: [
        { key: 'theta', label: 'Angle <i>θ</i>', min: 5, max: 60, step: 0.5, unit: '°', fmt: v => v.toFixed(1), restructure: true },
        { key: 'muS', label: 'Static <i>μ</i><sub>s</sub>', min: 0, max: 1.2, step: 0.01, unit: '', fmt: v => v.toFixed(2), restructure: true },
        { key: 'muK', label: 'Kinetic <i>μ</i><sub>k</sub>', min: 0, max: 1.2, step: 0.01, unit: '', fmt: v => v.toFixed(2), restructure: true }
      ] },
      { group: 'The wedge', items: [
        { key: 'M', label: 'Wedge mass <i>M</i>', min: 0.5, max: 20, step: 0.1, unit: 'kg', fmt: v => v.toFixed(1), restructure: true },
        { key: 'fixWedge', type: 'toggle', label: 'Clamp the wedge to the track', restructure: true }
      ] },
      { group: 'The lift', items: [
        { key: 'trip', type: 'select', label: 'The trip', restructure: true, options: [
          { value: 'up', label: 'Up' }, { value: 'down', label: 'Down' }, { value: 'cut', label: 'Cable cut' }] },
        { key: 'liftA', label: 'Acceleration', min: 0.2, max: 5, step: 0.1, unit: 'm/s²', fmt: v => v.toFixed(1), restructure: true },
        { key: 'liftM', label: 'Car mass', min: 100, max: 1000, step: 10, unit: 'kg', fmt: v => v.toFixed(0), restructure: true }
      ] },
      { group: 'Pushing force', items: [
        { key: 'F', label: 'Applied force <i>F</i>', min: 0, max: 120, step: 0.5, unit: 'N', fmt: v => v.toFixed(1), restructure: true }
      ] },
      { group: 'The banked curve', items: [
        { key: 'radius', label: 'Radius <i>r</i>', min: 10, max: 300, step: 1, unit: 'm', fmt: v => v.toFixed(0), restructure: true },
        { key: 'speed', label: 'Speed <i>v</i>', min: 1, max: 60, step: 0.5, unit: 'm/s', fmt: v => v.toFixed(1), restructure: true }
      ] },
      { group: 'Display', items: [
        { key: 'showFBD', type: 'toggle', label: 'Show the free-body diagram' },
        { key: 'run', type: 'toggle', label: 'Let it move' }
      ] }
    ],

    setup(S) {
      const p = S.p;
      if (p.muK > p.muS) p.muK = p.muS;
      S.tRun = 0; S.s = 0; S.v = 0; S.sW = 0; S.log = []; S.fit = null; S._lastLog = -1;
      S.liftTrip = p.mode === 'lift' ? liftProfile(p) : null;
      S.R = mechanics(S);
      S.travel = travelOf(p, S.R);
      const views = {
        atwood: { theta: -1.36, phi: 0.14, dist: 2.0, target: [0.08, 0, 0.62] },
        table: { theta: -1.30, phi: 0.24, dist: 2.1, target: [0.38, 0, -0.14] },
        incline: { theta: -1.38, phi: 0.20, dist: 2.2, target: [0.40, 0, 0.22] },
        wedge: { theta: -1.42, phi: 0.20, dist: 1.8, target: [-0.05, 0, 0.18] },
        lift: { theta: -1.30, phi: 0.12, dist: 3.6, target: [-0.20, 0, 1.25] },
        contact: { theta: -1.38, phi: 0.30, dist: 1.9, target: [0.1, 0, 0.04] },
        banking: { theta: -1.30, phi: 0.11, dist: 3.0, target: [0, 0, 0.02] }
      };
      if (!S.cam || S._viewMode !== p.mode) {
        S.cam = Camera(views[p.mode] || views.table);
        S.cam.minDist = 1.2; S.cam.maxDist = 14;
        S._viewMode = p.mode;
      }
      S.carPhase = S.carPhase || 0;
    },

    step(S, dt) {
      const p = S.p, R = S.R;
      if (p.mode === 'banking') { S.carPhase += dt * p.speed / Math.max(p.radius, 1); return; }
      if (!p.run) return;
      S.tRun += dt;
      if (p.mode === 'lift') {
        const L = S.liftTrip;
        if (S.tRun > L.T + 0.6) { S.tRun = 0; S.log = []; S._lastLog = -1; }
        S.R = mechanics(S);
        const k = liftAt(L, S.tRun);
        S.s = k.z; S.v = k.v;
        if (S.tRun - S._lastLog >= 1 / 30) {
          S._lastLog = S.tRun;
          S.log.push([S.tRun, k.z + sensorNoise(S.tRun), S.R.reading]);
        }
        return;
      }
      /* wait a moment, release, run until something reaches a stop, hold, repeat */
      const t0 = 0.35, tm = Math.max(0, S.tRun - t0);
      const a = p.mode === 'wedge' ? R.ar : R.a;
      let s = R.static ? 0 : 0.5 * a * tm * tm, v = R.static ? 0 : a * tm;
      const lim = S.travel;
      if (Math.abs(s) >= lim) {
        const tStop = Math.sqrt(2 * lim / Math.max(Math.abs(a), 1e-9));
        s = Math.sign(a) * lim; v = 0;
        if (tm > tStop + 1.1) { S.tRun = 0; S.log = []; S._lastLog = -1; S.fit = null; }
      } else if (R.static && S.tRun > 2.6) { S.tRun = 0; S.log = []; S._lastLog = -1; }
      S.s = s; S.v = v;
      if (p.mode === 'wedge') S.sW = R.ar ? s * R.A / R.ar : 0;   // the wedge moves back in step
      if (S.tRun - S._lastLog >= 1 / 50) {
        S._lastLog = S.tRun;
        // on the wedge rig the sensor sits at the end of the track and sees the wedge
        const track = p.mode === 'wedge' ? S.sW : s;
        S.log.push([S.tRun, track + sensorNoise(S.tRun)]);
        if (S.log.length > 400) S.log.shift();
        // velocities by central difference, then a straight-line fit while it moves
        const vs = [];
        for (let i = 1; i < S.log.length - 1; i++) {
          const q0 = S.log[i - 1], q1 = S.log[i + 1];
          vs.push([S.log[i][0], (q1[1] - q0[1]) / (q1[0] - q0[0])]);
        }
        S.vlog = vs;
        const moving = vs.filter(q => q[0] > t0 + 0.05 && Math.abs(q[1]) > 0.004 &&
          (Math.abs(a) < 1e-9 || q[0] < t0 + Math.sqrt(2 * lim / Math.abs(a)) - 0.04));
        S.fit = R.static ? null : fitSlope(moving);    // at rest there is nothing to fit, only noise
      }
    },

    drawStage(S, g) {
      const ctx = g.ctx, th = g.theme, p = S.p, W = g.w, H = g.h, R = S.R;
      const cam = S.cam, B = window.BENCH;
      const F = R3.Frame(ctx, cam, { ambient: 0.28, floorZ: p.mode === 'lift' ? 0 : null });
      const acc = th.phys;
      const s = S.s || 0;
      let hdl = null;
      const O = cam.project([0, 0, 0]);
      const away = (pt) => { const q = cam.project(pt); return (q.ok && O.ok && q.x < O.x) ? -1 : 1; };
      /* DEPTH POLICY (§14.6): table, floor and road carry F.GROUND. Apparatus
         sorts on true depth; strings and arrows take a few hundredths. */

      /* ---------- apparatus pieces ---------- */
      const blockTex = B.wood('#C99A62', 5);
      const woodBlock = (c, size, axes, tag, mkg) => {
        B.texBox(F, c, size, blockTex, { axes: axes || undefined, ambient: 0.45 });
        if (tag) R3.label(F, [c[0], c[1] - size[1] / 2 - 0.01, c[2] + size[2] / 2 + 0.05],
                          tag + ' = ' + mkg.toFixed(1) + ' kg', '#F6E7CE', { size: 9.5 });
      };
      /* a slotted-mass hanger: hook, rod, and brass discs whose stack grows with the mass */
      const massStack = (top, m, tag) => {
        const h = 0.05 + 0.02 * Math.pow(m, 0.75), n = Math.max(1, Math.min(12, Math.round(m)));
        const rD = 0.036 + 0.006 * Math.cbrt(m);
        R3.cylinder(F, top, [top[0], top[1], top[2] - 0.035], 0.003, '#C8D0DC', { segments: 6, shadow: false, caps: false });
        let z = top[2] - 0.035;
        for (let i = 0; i < n; i++) {
          const dz = h / n;
          R3.cylinder(F, [top[0], top[1], z], [top[0], top[1], z - dz * 0.92], rD,
                      i % 2 ? '#C9A04A' : '#B8903F', { segments: 22, shadow: false, ambient: 0.42 });
          z -= dz;
        }
        R3.cylinder(F, [top[0], top[1], z], [top[0], top[1], z - 0.008], rD * 1.05, '#8A6A2A',
                    { segments: 22, shadow: false, ambient: 0.4 });
        if (tag) R3.label(F, [top[0] + rD + 0.05, top[1], top[2] - h / 2], tag + ' = ' + m.toFixed(1) + ' kg',
                          '#F2D79A', { size: 9.5, align: 'left' });
        return z - 0.008;
      };
      /* an ultrasonic motion sensor: a dark box with a gold transducer */
      const motionSensor = (at, dir, target) => {
        const d = R3.norm(dir);
        const ax = [d, R3.norm(R3.cross([0, 0, 1], d).map(v => v || 0)), [0, 0, 1]];
        if (Math.abs(d[2]) > 0.9) { ax[1] = [0, 1, 0]; ax[2] = R3.norm(R3.cross(d, [0, 1, 0])); }
        R3.box(F, at, [0.06, 0.09, 0.07], '#23293A', { shadow: false, ambient: 0.4, axes: ax });
        R3.cylinder(F, R3.add(at, R3.scale(d, 0.03)), R3.add(at, R3.scale(d, 0.036)), 0.027, '#C9A04A',
                    { segments: 20, shadow: false, ambient: 0.55 });
        if (target) R3.polyline(F, [R3.add(at, R3.scale(d, 0.04)), target], '#7CF0B0',
                                { alpha: .35, width: 1, dash: [3, 4], bias: -0.02 });
      };
      /* a meter standing on the bench, facing the student */
      const standMeter = (x, y, z, title, value, unit, col) => {
        R3.box(F, [x, y + 0.02, (z - 0.06) / 2 + 0.0], [0.03, 0.03, Math.max(0.02, z - 0.06)], '#3A4458',
               { shadow: false, ambient: 0.35 });
        B.meter(F, [x, y, z + 0.03], [0, -1, 0], 0.30, 0.14, { title: title, value: value, unit: unit, colour: col || '#7CF0B0' });
      };
      const aSensor = () => S.fit ? Math.abs(S.fit.m).toFixed(2) : (R.static ? '0.00' : '— —');
      const rope = (pts) => B.string(F, pts, { r: 0.0035 });
      const arc = (c, r, a0, a1, n) => {
        const out = [];
        for (let i = 0; i <= n; i++) { const a = a0 + (a1 - a0) * i / n; out.push([c[0] + r * Math.cos(a), c[1], c[2] + r * Math.sin(a)]); }
        return out;
      };
      const handleAt = (pt, tip) => {
        const q = cam.project(pt);
        if (!q.ok) return;
        hdl = { x: q.x, y: q.y, r: 14, tip: tip };
        const qb = cam.project([pt[0], pt[1], pt[2] + 1]);
        if (qb.ok) { const dx = qb.x - q.x, dy = qb.y - q.y, Lp = Math.hypot(dx, dy) || 1; S._axM = { ux: dx / Lp, uy: dy / Lp, perPx: 1 / Lp }; }
      };

      if (p.mode === 'table' || p.mode === 'contact') {
        B.table(F, -1.05, 1.05, -0.42, 0.42, 0, { legH: 0.69 });
        B.rule(F, [-0.95, -0.35, 0], [1, 0, 0], 1.9, { width: 0.05 });
      }

      if (p.mode === 'table') {
        const k = clamp(Math.cbrt(p.m1 / 4), 0.7, 1.6);
        const bl = [0.16 * k, 0.10 * k, 0.08 * k];
        const xb = -0.45 + s, hookZ = bl[2] / 2, r = 0.045;
        const px = 1.05 + r * 1.2, pz = hookZ - r;
        woodBlock([xb, 0, bl[2] / 2], bl, null, 'm₁', p.m1);
        R3.sphere(F, [xb + bl[0] / 2 + 0.008, 0, hookZ], 0.007, '#D0D8E4', { shadow: false });
        // the pulley, clamped to the table edge
        R3.box(F, [1.05 + 0.01, 0, -0.03], [0.05, 0.05, 0.06], '#3A4458', { shadow: false, ambient: 0.35 });
        R3.box(F, [px - 0.01, 0.03, (pz - 0.03) / 2], [0.02, 0.01, Math.abs(pz + 0.03) + 0.02], '#3A4458', { shadow: false });
        B.pulley(F, [px, 0, pz], [0, 1, 0], r, { phase: -s / r, width: 0.03 });
        const zTop = pz - 0.16 - s;
        rope([[xb + bl[0] / 2 + 0.008, 0, hookZ], [px, 0, pz + r]].concat(arc([px, 0, pz], r, Math.PI / 2, 0, 8))
               .concat([[px + r, 0, zTop]]));
        massStack([px + r, 0, zTop], p.m2, 'm₂');
        handleAt([px + r, 0, zTop - 0.06], 'drag m₂');
        // stop at the pulley end, sensor at the other
        R3.box(F, [0.99, 0, 0.025], [0.03, 0.14, 0.05], '#1E1E22', { shadow: false, ambient: 0.3 });
        motionSensor([-0.97, 0, hookZ], [1, 0, 0], [xb - bl[0] / 2, 0, hookZ]);
        standMeter(-0.62, 0.36, 0.16, 'MOTION SENSOR a', aSensor(), 'm/s²');
        standMeter(-0.32, 0.36, 0.16, 'FORCE T₁ (block)', R.T1.toFixed(2), 'N', '#FFD36B');
        if (p.mp > 0) standMeter(-0.02, 0.36, 0.16, 'FORCE T₂ (hanger)', R.T2.toFixed(2), 'N', '#FFD36B');
      }

      else if (p.mode === 'incline') {
        B.table(F, -1.05, 1.05, -0.42, 0.42, 0, { legH: 0.69 });
        const thr = p.theta * Math.PI / 180, Lr = 1.2, tb = 0.03;
        const e1 = [Math.cos(thr), 0, Math.sin(thr)], e3 = [-Math.sin(thr), 0, Math.cos(thr)];
        const xTop = 0.95, H0 = [xTop - Lr * Math.cos(thr), 0, 0], T = [xTop, 0, Lr * Math.sin(thr)];
        const at = (u, h) => [H0[0] + e1[0] * u + e3[0] * h, 0, H0[2] + e1[2] * u + e3[2] * h];
        B.texBox(F, at(Lr / 2, -tb / 2), [Lr, 0.26, tb], B.wood('#9C6B3E', 3), { axes: [e1, [0, 1, 0], e3], ambient: 0.45 });
        B.rule(F, [H0[0] + e1[0] * 0.05, -0.115, H0[2] + e1[2] * 0.05], e1, 1.0, { up: e3, width: 0.04 });
        // hinge at the foot, a clamp stand propping the top
        R3.cylinder(F, [H0[0], -0.14, 0.01], [H0[0], 0.14, 0.01], 0.012, '#6B7890', { segments: 12, shadow: false });
        const rodTop = B.clampStand(F, [xTop - 0.10, 0.28, 0], Math.max(0.06, T[2] - 0.02));
        B.bossClamp(F, [rodTop[0], 0.26, T[2] - 0.05]);
        R3.cylinder(F, [rodTop[0], 0.26, T[2] - 0.05], [rodTop[0], 0.0, T[2] - 0.05], 0.008, '#B8C2D0', { segments: 10, shadow: false });
        // the angle, on a protractor arc at the foot
        const pa = [];
        for (let i = 0; i <= 20; i++) { const a = thr * i / 20; pa.push([H0[0] + 0.24 * Math.cos(a), -0.14, 0.004 + 0.24 * Math.sin(a)]); }
        R3.polyline(F, pa, acc, { alpha: .9, width: 1.8, bias: -0.02 });
        R3.label(F, [H0[0] + 0.33 * Math.cos(thr / 2), -0.15, 0.33 * Math.sin(thr / 2)], 'θ = ' + p.theta.toFixed(1) + '°', acc, { size: 10 });
        // the block on the ramp
        const k = clamp(Math.cbrt(p.m1 / 4), 0.7, 1.5), bl = [0.15 * k, 0.10 * k, 0.075 * k];
        const sb = clamp(Lr * 0.42 + s, bl[0] / 2 + 0.03, Lr - bl[0] / 2 - 0.08);
        woodBlock(at(sb, bl[2] / 2), bl, [e1, [0, 1, 0], e3], 'm₁', p.m1);
        const hook = at(sb + bl[0] / 2 + 0.008, bl[2] / 2);
        const r = 0.045, C = at(Lr + 0.05, bl[2] / 2 - r);
        R3.box(F, at(Lr + 0.025, -0.01), [0.07, 0.04, 0.03], '#3A4458', { axes: [e1, [0, 1, 0], e3], shadow: false });
        B.pulley(F, C, [0, 1, 0], r, { phase: -s / r, width: 0.03 });
        const aTan = Math.atan2(e3[2], e3[0]);
        const zTop = C[2] - 0.16 - s;
        rope([hook, [C[0] + e3[0] * r, 0, C[2] + e3[2] * r]].concat(arc(C, r, aTan, 0, 10)).concat([[C[0] + r, 0, zTop]]));
        massStack([C[0] + r, 0, zTop], p.m2, 'm₂');
        handleAt([C[0] + r, 0, zTop - 0.06], 'drag m₂');
        motionSensor(at(0.04, 0.045), e1, at(sb - bl[0] / 2, 0.045));
        standMeter(-0.70, 0.36, 0.16, 'MOTION SENSOR a', aSensor(), 'm/s²');
        standMeter(-0.40, 0.36, 0.16, 'FORCE T₁ (block)', R.T1.toFixed(2), 'N', '#FFD36B');
        standMeter(-0.10, 0.36, 0.16, R.static ? 'FRICTION (static)' : 'FRICTION μₖN', Math.abs(R.f || 0).toFixed(2), 'N', '#FF8B8B');
      }

      else if (p.mode === 'atwood') {
        B.table(F, -0.75, 0.75, -0.42, 0.42, 0, { legH: 0.69 });
        const r = 0.07, pz = 1.22;
        // the stand beside the machine, not behind a string; an arm reaches the axle
        const rodTop = B.clampStand(F, [0.30, 0.20, 0], 1.30);
        B.bossClamp(F, [rodTop[0], 0.20, pz]);
        R3.cylinder(F, [rodTop[0], 0.20, pz], [0, 0.05, pz], 0.009, '#B8C2D0', { segments: 10, shadow: false });
        B.pulley(F, [0, 0, pz], [0, 1, 0], r, { phase: s / r, width: 0.035, spokes: 6 });
        const z1 = 0.78 - s, z2 = 0.78 + s;
        rope([[-r, 0, z1]].concat(arc([0, 0, pz], r, Math.PI, 0, 16)).concat([[r, 0, z2]]));
        massStack([-r, 0, z1], p.m1, 'm₁');
        massStack([r, 0, z2], p.m2, 'm₂');
        handleAt([r, 0, z2 - 0.06], 'drag m₂');
        motionSensor([-r, 0, 0.04], [0, 0, 1], [-r, 0, z1 - 0.12]);
        standMeter(-0.48, 0.30, 0.16, 'MOTION SENSOR a', aSensor(), 'm/s²');
        standMeter(0.52, 0.30, 0.16, 'T₁ (m₁ side)', R.T1.toFixed(2), 'N', '#FFD36B');
        standMeter(0.52, 0.30, 0.36, 'T₂ (m₂ side)', R.T2.toFixed(2), 'N', '#FFD36B');
      }

      else if (p.mode === 'wedge') {
        B.table(F, -1.05, 1.05, -0.42, 0.42, 0, { legH: 0.69 });
        B.texBox(F, [0, 0, 0.01], [1.95, 0.30, 0.02], B.metal('#9AA6B8', 4), { ambient: 0.5, bias: -0.001 });
        const thr = p.theta * Math.PI / 180, Lw = 0.62, Hw = Lw * Math.tan(thr), wW = 0.24, zb = 0.045;
        const xw = -0.25 - (S.sW || 0);
        const P0 = [xw, 0, zb], P1 = [xw + Lw, 0, zb], P2 = [xw, 0, zb + Hw];
        const Y = (pt, y) => [pt[0], y, pt[2]];
        const wtex = B.wood('#A8743F', 9);
        const d = [Math.cos(thr), 0, -Math.sin(thr)], nrm = [Math.sin(thr), 0, Math.cos(thr)];
        // the wedge: slope face and back face textured, the triangular ends shaded
        F.push([xw + Lw * 0.45, 0, zb + Hw * 0.5 + 0.02], () => B.faceTex(ctx, cam, wtex, Y(P2, -wW / 2), Y(P1, -wW / 2), Y(P2, wW / 2), 2, B.shadeOverlay(F, nrm, 0.45)));
        F.push([xw, 0, zb + Hw / 2], () => B.faceTex(ctx, cam, wtex, Y(P0, -wW / 2), Y(P2, -wW / 2), Y(P0, wW / 2), 1, B.shadeOverlay(F, [-1, 0, 0], 0.45)));
        [-1, 1].forEach(sg => {
          const tri = [Y(P0, sg * wW / 2), Y(P1, sg * wW / 2), Y(P2, sg * wW / 2)];
          F.push([xw + Lw / 3, sg * wW / 2, zb + Hw / 3], () => {
            const q = tri.map(v => cam.project(v));
            if (q.some(x => !x.ok)) return;
            ctx.save();
            ctx.beginPath(); q.forEach((x, i) => i ? ctx.lineTo(x.x, x.y) : ctx.moveTo(x.x, x.y)); ctx.closePath();
            ctx.clip();
            const bb = { x0: Math.min(...q.map(v => v.x)), y0: Math.min(...q.map(v => v.y)), x1: Math.max(...q.map(v => v.x)), y1: Math.max(...q.map(v => v.y)) };
            ctx.drawImage(wtex, 0, 0, 256, 64, bb.x0, bb.y0, bb.x1 - bb.x0, bb.y1 - bb.y0);
            ctx.fillStyle = B.shadeOverlay(F, [0, sg, 0], 0.45); ctx.fill();
            ctx.restore();
          });
        });
        [[0.08, -1], [0.08, 1], [Lw - 0.08, -1], [Lw - 0.08, 1]].forEach(w =>
          R3.cylinder(F, [xw + w[0], w[1] * (wW / 2 + 0.005), 0.032], [xw + w[0], w[1] * (wW / 2 + 0.02), 0.032], 0.012, '#2A2E36',
                      { segments: 14, shadow: false, ambient: 0.4 }));
        if (p.fixWedge) R3.box(F, [xw - 0.03, 0, 0.05], [0.04, 0.2, 0.08], '#C9A04A', { shadow: false });
        // the block on the face
        const k = clamp(Math.cbrt(p.m1 / 2), 0.6, 1.5), bl = [0.10 * k, 0.09 * k, 0.07 * k];
        const sb = 0.06 + bl[0] / 2 + s;
        const cB = [P2[0] + d[0] * sb + nrm[0] * bl[2] / 2, 0, P2[2] + d[2] * sb + nrm[2] * bl[2] / 2];
        woodBlock(cB, bl, [d, [0, 1, 0], nrm], 'm', p.m1);
        // where the block really goes, in the ground frame — not along the face
        const c0 = [-0.25 + P2[0] - xw + d[0] * (0.06 + bl[0] / 2) + nrm[0] * bl[2] / 2, 0, zb + Hw + d[2] * (0.06 + bl[0] / 2) + nrm[2] * bl[2] / 2];
        const gd = R3.norm([R.ax, 0, R.az]);
        R3.polyline(F, [c0, [c0[0] + gd[0] * 0.8, 0, c0[2] + gd[2] * 0.8]], '#FFD36B', { alpha: .8, width: 1.6, dash: [5, 4], bias: -0.03 });
        R3.label(F, [c0[0] + gd[0] * 0.45 + 0.06, -0.14, c0[2] + gd[2] * 0.45], 'real path ' + R.pathAngle.toFixed(1) + '° below horizontal',
                 '#FFD36B', { size: 9.5, align: 'left' });
        motionSensor([-0.97, 0, 0.12], [1, 0, 0], [xw, 0, 0.12]);
        standMeter(-0.86, 0.34, 0.20, 'SENSOR: wedge A', aSensor(), 'm/s²');
        standMeter(0.62, 0.34, 0.20, 'NORMAL FORCE N', R.N.toFixed(2), 'N', '#FFD36B');
        standMeter(0.62, 0.34, 0.40, 'FLOOR ON WEDGE', R.Nfloor.toFixed(1), 'N', '#9AD0FF');
      }

      else if (p.mode === 'lift') {
        const L = S.liftTrip, span = Math.max(L.zMax - L.zMin, 1e-6);
        B.texBox(F, [0, 0, -0.03], [2.6, 1.8, 0.06], B.metal('#454B57', 8), { bias: F.GROUND, tiles: 3, ambient: 0.45 });
        [[-0.48, -0.42], [0.48, -0.42], [-0.48, 0.42], [0.48, 0.42]].forEach(q =>
          R3.box(F, [q[0], q[1], 1.4], [0.05, 0.05, 2.8], '#5A6478', { shadow: false, ambient: 0.35 }));
        R3.box(F, [0, 0.42, 2.82], [1.0, 0.06, 0.06], '#5A6478', { shadow: false });
        R3.box(F, [0, -0.42, 2.82], [1.0, 0.06, 0.06], '#5A6478', { shadow: false });
        const zc = 0.12 + (s - L.zMin) / span * 1.35;
        const drumPh = -s / 0.12;
        B.pulley(F, [0, 0, 2.95], [0, 1, 0], 0.12, { phase: drumPh, width: 0.1, spokes: 6, colour: '#8A96AA' });
        R3.box(F, [0, 0, 2.86], [0.3, 0.3, 0.04], '#2A3040', { shadow: false });
        // the car
        const cut = p.trip === 'cut' && S.tRun > 0.8;
        B.texBox(F, [0, 0, zc], [0.84, 0.74, 0.05], B.metal('#7E8898', 2), { ambient: 0.45 });
        B.texBox(F, [0, 0.35, zc + 0.5], [0.84, 0.03, 0.95], B.metal('#6A7486', 6), { ambient: 0.45 });
        [-0.41, 0.41].forEach(x => R3.box(F, [x, 0, zc + 0.5], [0.03, 0.74, 0.95], '#55607A', { shadow: false, ambient: 0.35 }));
        R3.box(F, [0, 0, zc + 0.98], [0.84, 0.74, 0.04], '#55607A', { shadow: false, ambient: 0.35 });
        if (!cut) B.string(F, [[0, 0, zc + 1.0], [0, 0, 2.95 - 0.12]], { r: 0.006, colour: '#B8C2D0' });
        else B.string(F, [[0, 0, zc + 1.0], [0, 0, zc + 1.25]], { r: 0.006, colour: '#B8C2D0' });
        // the bathroom scale, and what stands on it
        R3.box(F, [0, -0.05, zc + 0.045], [0.34, 0.3, 0.04], '#E6E9EF', { shadow: false, ambient: 0.5 });
        B.meter(F, [0, -0.205, zc + 0.055], [0, -1, 0], 0.16, 0.035, { title: '', value: R.reading.toFixed(1), unit: 'kg', colour: '#7CF0B0', depth: 0.02 });
        const k = clamp(Math.cbrt(p.m1 / 60), 0.5, 1.4), bl = [0.2 * k, 0.16 * k, 0.32 * k];
        woodBlock([0, -0.05, zc + 0.065 + bl[2] / 2], bl, null, 'm', p.m1);
        // acceleration arrow beside the car
        if (Math.abs(R.aLift) > 0.01) {
          const sg = Math.sign(R.aLift), len = clamp(Math.abs(R.aLift) / G, 0.15, 1) * 0.5;
          R3.arrow(F, [0.62, -0.2, zc + 0.5], [0.62, -0.2, zc + 0.5 + sg * len], 0.014, sg > 0 ? th.ok : th.crit,
                   { head: 0.06, shadow: false, ambient: 0.85, bias: -0.04 });
          R3.label(F, [0.72, -0.2, zc + 0.5 + sg * len / 2], 'a = ' + R.aLift.toFixed(2) + ' m/s²', sg > 0 ? th.ok : th.crit,
                   { size: 10, align: 'left' });
        }
        // a control-room panel beside the shaft, big enough to read
        R3.box(F, [-0.98, -0.30, 1.05], [0.62, 0.04, 1.0], '#1E2433', { shadow: false, ambient: 0.35 });
        B.meter(F, [-0.98, -0.33, 1.40], [0, -1, 0], 0.52, 0.24, { title: 'SCALE READS', value: R.reading.toFixed(1), unit: 'kg' });
        B.meter(F, [-0.98, -0.33, 1.10], [0, -1, 0], 0.52, 0.24, { title: 'CABLE TENSION', value: (R.Tcable / 1000).toFixed(2), unit: 'kN', colour: '#FFD36B' });
        B.meter(F, [-0.98, -0.33, 0.80], [0, -1, 0], 0.52, 0.24, { title: 'CAR SPEED', value: Math.abs(R.vLift).toFixed(2), unit: 'm/s', colour: '#9AD0FF' });
        if (cut && Math.abs(R.aLift + G) < 1e-6)
          R3.label(F, [0, -0.3, zc + 1.18], 'CABLE CUT — free fall: the scale reads zero', th.crit, { size: 11 });
      }

      else if (p.mode === 'contact') {
        const k1 = clamp(Math.cbrt(p.m1 / 3), 0.6, 1.6), k2 = clamp(Math.cbrt(p.m2 / 3), 0.6, 1.6);
        const b1 = [0.16 * k1, 0.12 * k1, 0.12 * k1], b2 = [0.16 * k2, 0.12 * k2, 0.12 * k2];
        const x1 = -0.40 + s, x2 = x1 + b1[0] / 2 + b2[0] / 2;
        woodBlock([x1, 0, b1[2] / 2], b1, null, 'm₁', p.m1);
        woodBlock([x2, 0, b2[2] / 2], b2, null, 'm₂', p.m2);
        // a hand-held force probe pushing on m1
        const pzz = Math.min(b1[2], 0.08) * 0.6, xp = x1 - b1[0] / 2;
        R3.cylinder(F, [xp - 0.30, 0, pzz], [xp - 0.06, 0, pzz], 0.022, '#2B3550', { segments: 16, shadow: false });
        R3.cylinder(F, [xp - 0.06, 0, pzz], [xp, 0, pzz], 0.006, '#D0D8E4', { segments: 8, shadow: false });
        B.meter(F, [xp - 0.18, -0.03, pzz + 0.06], [0, -1, 0], 0.16, 0.06, { title: 'F', value: p.F.toFixed(1), unit: 'N', colour: '#FFD36B', depth: 0.02 });
        handleAt([xp - 0.2, 0, pzz], 'drag to push harder');
        R3.box(F, [0.99, 0, 0.04], [0.03, 0.2, 0.08], '#1E1E22', { shadow: false });
        standMeter(-0.62, 0.36, 0.16, 'MOTION SENSOR a', aSensor(), 'm/s²');
        standMeter(-0.30, 0.36, 0.16, 'CONTACT FORCE', R.static ? 'indet.' : R.Nc.toFixed(2), R.static ? '' : 'N', '#9AD0FF');
        motionSensor([0.97, 0, 0.06], [-1, 0, 0], [x2 + b2[0] / 2, 0, 0.06]);
      }

      else if (p.mode === 'banking') {
        /* a banked ring of road: asphalt, a painted centre line, kerbs */
        const thr = p.theta * Math.PI / 180, Rr = 1.05, wRoad = 0.78, nSeg = 60;
        const pt = (a, u) => { const rad = Rr + u * wRoad / 2; return [Math.cos(a) * rad, Math.sin(a) * rad, u * (wRoad / 2) * Math.tan(thr)]; };
        const asphalt = B.metal('#3A3D44', 21);
        for (let i = 0; i < nSeg; i++) {
          const a0 = i / nSeg * TAU, a1 = (i + 1) / nSeg * TAU, am = (a0 + a1) / 2;
          const nrm = [-Math.cos(am) * Math.sin(thr), -Math.sin(am) * Math.sin(thr), Math.cos(thr)];
          F.push(pt(am, 0), () => B.faceTex(ctx, cam, asphalt, pt(a0, -1), pt(a1, -1), pt(a0, 1), 1, B.shadeOverlay(F, nrm, 0.5)), F.GROUND);
        }
        const ring = (u, z) => { const o = []; for (let i = 0; i <= 96; i++) { const q = pt(i / 96 * TAU, u); q[2] += z || 0; o.push(q); } return o; };
        R3.polyline(F, ring(-0.97, 0.002), '#E8E8E8', { alpha: .9, width: 1.6, bias: F.GROUND - 1 });
        R3.polyline(F, ring(0.97, 0.002), '#E8E8E8', { alpha: .9, width: 1.6, bias: F.GROUND - 1 });
        R3.polyline(F, ring(0, 0.002), '#F2C94C', { alpha: .9, width: 1.4, dash: [8, 8], bias: F.GROUND - 1 });
        for (let i = 0; i < 96; i++) {
          if (i % 2) continue;
          const a0 = i / 96 * TAU, a1 = (i + 1) / 96 * TAU;
          R3.polyline(F, [pt(a0, 1.05), pt(a1, 1.05)], '#E0453A', { alpha: 1, width: 3, bias: F.GROUND - 2 });
        }
        // the car, tilted with the camber: body, cabin, four wheels
        const a0 = S.carPhase, cx = Math.cos(a0) * Rr, cy = Math.sin(a0) * Rr;
        const nrm = [-Math.cos(a0) * Math.sin(thr), -Math.sin(a0) * Math.sin(thr), Math.cos(thr)];
        const tang = [-Math.sin(a0), Math.cos(a0), 0];
        const side = R3.cross(nrm, tang);
        const base = [cx, cy, 0];
        const up = (h) => R3.add(base, R3.scale(nrm, h));
        const carCol = R.safe ? '#3F8FE0' : '#E0453A';
        R3.box(F, up(0.06), [0.30, 0.15, 0.06], carCol, { shadow: false, ambient: 0.5, axes: [tang, side, nrm] });
        R3.box(F, R3.add(up(0.11), R3.scale(tang, -0.02)), [0.15, 0.13, 0.05], RX.mix(carCol, '#0B1020', 0.35), { shadow: false, ambient: 0.5, axes: [tang, side, nrm] });
        [[0.10, 1], [0.10, -1], [-0.10, 1], [-0.10, -1]].forEach(w => {
          const c = R3.add(R3.add(up(0.03), R3.scale(tang, w[0])), R3.scale(side, w[1] * 0.075));
          R3.cylinder(F, R3.add(c, R3.scale(side, -0.012)), R3.add(c, R3.scale(side, 0.012)), 0.028, '#1A1C22',
                      { segments: 14, shadow: false, ambient: 0.4, spokes: 4, phase: S.carPhase * 30 });
        });
        R3.callout(F, up(0.16), away([cx, cy, 0]) * 26, -24,
                   R.safe ? 'holds the curve at ' + p.speed.toFixed(1) + ' m/s'
                          : R.slides === 'out' ? 'SLIDES OUTWARD — too fast' : 'SLIDES INWARD — too slow',
                   R.safe ? th.ok : th.crit);
        R3.arrow(F, up(0.09), R3.add(up(0.09), R3.scale(nrm, 0.42)), 0.012, '#5AA9FF', { head: 0.05, shadow: false, ambient: 0.8, bias: -0.04 });
        R3.arrow(F, up(0.09), R3.add(up(0.09), [0, 0, -0.34]), 0.012, '#FFD36B', { head: 0.05, shadow: false, ambient: 0.8, bias: -0.04 });
        R3.arrow(F, up(0.09), R3.add(up(0.09), [-cx * 0.3 / Rr, -cy * 0.3 / Rr, 0]), 0.012, th.crit, { head: 0.05, shadow: false, ambient: 0.8, bias: -0.04 });
        R3.label(F, R3.add(up(0.09), R3.scale(nrm, 0.50)), 'N', '#5AA9FF', { size: 10 });
        R3.label(F, R3.add(up(0.09), [0, 0, -0.42]), 'mg', '#FFD36B', { size: 10 });
        R3.label(F, R3.add(up(0.09), [-cx * 0.4 / Rr, -cy * 0.4 / Rr, 0.02]), 'mv²/r', th.crit, { size: 10 });
        R3.label(F, [0, 0, 0.16], 'r = ' + p.radius.toFixed(0) + ' m  ·  bank ' + p.theta.toFixed(1) + '°', th['text-2'], { size: 10 });
      }

      F.render();

      if (hdl) {
        const on = g.dragging === 'm2';
        ctx.save();
        ctx.strokeStyle = on ? th.text : g.alpha(acc, .75); ctx.lineWidth = on ? 2.2 : 1.6;
        ctx.beginPath(); ctx.arc(hdl.x, hdl.y, hdl.r, 0, TAU); ctx.stroke(); ctx.restore();
        PA.lbl(ctx, hdl.x, hdl.y + hdl.r + 11, hdl.tip, on ? th.text : g.alpha(th['text-3'], .95), 'center', 9);
        g.handle(hdl.x, hdl.y, hdl.r + 3, 'm2');
      }
      /* ---------------- the free-body diagram ----------------
         Every arrow is drawn to the magnitude the solver returned, so the
         picture the exam asks you to draw is the picture the lab computed. */
      const narrow = W < 660;
      S._panelTop = null;
      if (p.showFBD) {
        const bw = narrow ? Math.min(W - 24, 348) : Math.min(W * 0.40, 348);
        const bh = narrow ? 138 : 172, bx = 12, by = H - bh - 22;
        S._panelTop = by;
        ctx.fillStyle = g.alpha('#0B1020', .92);
        ctx.strokeStyle = g.alpha(th.line, 1); ctx.lineWidth = 1;
        ctx.beginPath(); ctx.roundRect(bx, by, bw, bh, 8); ctx.fill(); ctx.stroke();
        PA.lbl(ctx, bx + 10, by + 13, 'FREE-BODY DIAGRAM · drawn to scale', th['text-3'], 'left', 8.5);

        /* The forces on each body, as screen directions (x right, y DOWN),
           written out rig by rig so every arrow points where the physics
           says: the normal perpendicular to the surface the body rests on,
           friction along that surface against the motion (or the tendency
           to move), tension along its own string. */
        const thb = R.theta || (p.theta * Math.PI / 180);
        const sn = Math.sin(thb), cs = Math.cos(thb);
        const FT = '#7CE0A8', FN = '#5AA9FF', FW = '#FFD36B', FF = th.crit, FP = th.warn;
        const bods = [];
        if (p.mode === 'table' || p.mode === 'incline') {
          const t = p.mode === 'table' ? 0 : thb, st = Math.sin(t), ct = Math.cos(t);
          const fd = -Math.sign(R.drive || 1);            // friction against the pull (static) or the motion (kinetic)
          bods.push({ tag: 'm₁', col: '#C99A62', f: [
            [0, 1, p.m1 * G, FW, 'mg'], [-st, -ct, R.N, FN, 'N'], [ct, -st, R.T1, FT, 'T₁'],
            [fd * ct, -fd * st, Math.abs(R.f || 0), FF, R.static ? 'fₛ' : 'fₖ']] });
          bods.push({ tag: 'm₂', col: '#C9A04A', f: [[0, 1, p.m2 * G, FW, 'm₂g'], [0, -1, R.T2, FT, 'T₂']] });
        } else if (p.mode === 'atwood') {
          bods.push({ tag: 'm₁', col: '#C9A04A', f: [[0, 1, p.m1 * G, FW, 'm₁g'], [0, -1, R.T1, FT, 'T₁']] });
          bods.push({ tag: 'm₂', col: '#C9A04A', f: [[0, 1, p.m2 * G, FW, 'm₂g'], [0, -1, R.T2, FT, 'T₂']] });
        } else if (p.mode === 'wedge') {
          // the face descends to the right; its outward normal points up and right
          bods.push({ tag: 'm', col: '#C99A62', f: [[0, 1, p.m1 * G, FW, 'mg'], [sn, -cs, R.N, FN, 'N']] });
          bods.push({ tag: 'M', col: '#A8743F', f: [[0, 1, p.M * G, FW, 'Mg'], [0, -1, R.Nfloor, FN, 'N_floor'],
                                                   [-sn, cs, R.N, FT, 'N (block)']] });
        } else if (p.mode === 'lift') {
          bods.push({ tag: 'm', col: '#C99A62', f: [[0, 1, p.m1 * G, FW, 'mg'], [0, -1, R.Nscale, FN, 'N (scale)']] });
        } else if (p.mode === 'contact') {
          const nc = R.static ? 0 : R.Nc, fk1 = R.static ? 0 : p.muK * p.m1 * G, fk2 = R.static ? 0 : p.muK * p.m2 * G;
          bods.push({ tag: 'm₁', col: '#C99A62', f: [[0, 1, p.m1 * G, FW, 'mg'], [0, -1, p.m1 * G, FN, 'N'],
                                                    [1, 0, p.F, FP, 'F'], [-1, 0, nc, FT, 'N₁₂'], [-1, 0.35, fk1, FF, 'f']] });
          bods.push({ tag: 'm₂', col: '#C99A62', f: [[0, 1, p.m2 * G, FW, 'mg'], [0, -1, p.m2 * G, FN, 'N'],
                                                    [1, 0, nc, FT, 'N₂₁'], [-1, 0.35, fk2, FF, 'f']] });
        } else {
          // banking, in cross-section: the road rises away from the centre (to the right)
          const fs = R.fNeed, fd = Math.sign(fs);
          bods.push({ tag: 'car', col: '#3F8FE0', f: [[0, 1, p.m1 * G, FW, 'mg'], [-sn, -cs, R.bodies[0].N, FN, 'N'],
                                                     [-fd * cs, fd * sn, Math.min(Math.abs(fs), R.fMax), FF, 'f']] });
        }
        const cellW = bw / bods.length;
        let mx = 1e-9;
        bods.forEach(b => b.f.forEach(q => { if (q[2] > mx) mx = q[2]; }));
        const scale = (narrow ? 34 : 46) / mx;
        bods.forEach((b, i) => {
          const cx = bx + cellW * (i + 0.5), cy = by + bh * 0.50;
          ctx.fillStyle = g.alpha(b.col, .9);
          ctx.beginPath(); ctx.roundRect(cx - 13, cy - 13, 26, 26, 4); ctx.fill();
          PA.lbl(ctx, cx, cy, b.tag, '#0B1020', 'center', 10);
          b.f.forEach(q => {
            const mag = q[2];
            if (!(mag > 0.01)) return;
            const n = Math.hypot(q[0], q[1]), dx = q[0] / n, dy = q[1] / n;
            const Lr = Math.max(10, mag * scale);
            const x1 = cx + dx * Lr, y1 = cy + dy * Lr;
            ctx.strokeStyle = q[3]; ctx.lineWidth = 1.8;
            ctx.beginPath(); ctx.moveTo(cx + dx * 14, cy + dy * 14); ctx.lineTo(x1, y1); ctx.stroke();
            const an = Math.atan2(dy, dx);
            ctx.beginPath(); ctx.moveTo(x1, y1);
            ctx.lineTo(x1 - 6 * Math.cos(an - 0.45), y1 - 6 * Math.sin(an - 0.45));
            ctx.lineTo(x1 - 6 * Math.cos(an + 0.45), y1 - 6 * Math.sin(an + 0.45));
            ctx.closePath(); ctx.fillStyle = q[3]; ctx.fill();
            // labels sit beyond the arrowhead; horizontal ones need more room than vertical ones
            PA.lbl(ctx, x1 + dx * (8 + 22 * Math.abs(dx)), y1 + dy * 10, q[4] + ' ' + mag.toFixed(1), q[3],
                   dx > 0.5 ? 'left' : dx < -0.5 ? 'right' : 'center', 8.5);
          });
        });
        PA.lbl(ctx, bx + 10, by + bh - 9,
               p.mode === 'banking'
                 ? 'needs ' + Math.abs(R.fNeed).toFixed(0) + ' N of friction along the slope, of the ' + R.fMax.toFixed(0) + ' N available'
               : p.mode === 'atwood' ? (p.mp > 0 ? 'a heavy pulley: T₁ − T₂ = (I/r²)a turns it' : 'light pulley: the tension is the same on both sides')
               : p.mode === 'wedge' ? 'the wedge is pushed back by the block: MA = N sinθ'
               : p.mode === 'lift' ? 'the scale shows N, not mg: N = m(g + a)'
               : p.mode === 'contact' ? (R.static ? 'static: how friction is shared is indeterminate' : 'N₁₂ and N₂₁: equal and opposite, a third-law pair')
               : R.static ? 'static: friction supplies ' + Math.abs(R.fNeed || 0).toFixed(1) + ' N of the ' + (R.fMax || 0).toFixed(1) + ' N it could'
               : 'sliding: friction is now μₖN = ' + Math.abs(R.f || 0).toFixed(1) + ' N, fixed',
               R.static ? th.ok : th.warn, 'left', 8.5);
      }

      /* ---------------- the verdict panel ----------------
         On a phone it shrinks to a two-line strip at the top of the stage,
         so the bench stays visible between it and the force diagram. */
      if (narrow) {
        const bw = W - 24, bh = 40, bx = 12, by = 44;
        ctx.fillStyle = g.alpha('#0B1020', .92);
        ctx.strokeStyle = g.alpha(th.line, 1); ctx.lineWidth = 1;
        ctx.beginPath(); ctx.roundRect(bx, by, bw, bh, 8); ctx.fill(); ctx.stroke();
        const aM = S.fit ? Math.abs(S.fit.m).toFixed(3) : (R.static ? '0.000' : '…');
        const l1 = p.mode === 'lift' ? 'scale ' + R.reading.toFixed(1) + ' kg  ·  a ' + R.aLift.toFixed(2) + ' m/s²'
          : p.mode === 'banking' ? 'safe band ' + R.vMin.toFixed(1) + ' – ' + (isFinite(R.vMax) ? R.vMax.toFixed(1) : '∞') + ' m/s'
          : p.mode === 'wedge' ? 'wedge A ' + R.A.toFixed(3) + '  ·  sensor ' + aM + ' m/s²'
          : 'a solved ' + Math.abs(R.a).toFixed(3) + '  ·  sensor ' + aM + ' m/s²';
        const l2 = p.mode === 'lift' ? 'N = m(g + a) = ' + R.Nscale.toFixed(0) + ' N'
          : p.mode === 'banking' ? (R.safe ? 'holds the curve' : 'slides ' + R.slides)
          : p.mode === 'wedge' ? 'N = ' + R.N.toFixed(2) + ' N  (less than mg cosθ)'
          : p.mode === 'atwood' ? 'T₁ ' + R.T1.toFixed(2) + ' N  ·  T₂ ' + R.T2.toFixed(2) + ' N'
          : p.mode === 'contact' ? (R.static ? 'nothing moves' : 'N₁₂ = ' + R.Nc.toFixed(2) + ' N')
          : (R.static ? 'HOLDS: friction ' + Math.abs(R.fNeed).toFixed(1) + ' of ' + R.fMax.toFixed(1) + ' N' : 'SLIDES: friction μₖN = ' + Math.abs(R.f || 0).toFixed(1) + ' N');
        PA.lbl(ctx, bx + 10, by + 13, l1, acc, 'left', 9);
        PA.lbl(ctx, bx + 10, by + 28, l2, R.static ? th.ok : th.warn, 'left', 9);
      } else {
        const bw = narrow ? Math.min(W - 24, 268) : Math.min(W * 0.30, 268);
        const bh = 104;
        const bx = narrow ? 12 : W - bw - 14;
        const by = narrow ? Math.max(58, (S._panelTop == null ? H - 22 : S._panelTop) - bh - 8)
                          : H - bh - 22;
        ctx.fillStyle = g.alpha('#0B1020', .92);
        ctx.strokeStyle = g.alpha(th.line, 1); ctx.lineWidth = 1;
        ctx.beginPath(); ctx.roundRect(bx, by, bw, bh, 8); ctx.fill(); ctx.stroke();
        PA.lbl(ctx, bx + 10, by + 13, p.mode === 'banking' ? 'THE SPEED BAND' : p.mode === 'atwood' ? 'THE TWO TENSIONS'
               : p.mode === 'wedge' ? 'THE WEDGE' : p.mode === 'lift' ? 'THE SCALE' : 'THE FRICTION TEST',
               th['text-3'], 'left', 8.5);
        const row = (i, k, v, c) => {
          PA.lbl(ctx, bx + 10, by + 30 + i * 15, k, th['text-3'], 'left', 9);
          PA.lbl(ctx, bx + bw - 10, by + 30 + i * 15, v, c || th['text-2'], 'right', 9.5);
        };
        if (p.mode === 'banking') {
          row(0, 'ideal speed  √(rg tanθ)', R.vIdeal.toFixed(2) + ' m/s', acc);
          row(1, 'slowest without sliding in', R.vMin.toFixed(2) + ' m/s');
          row(2, 'fastest without sliding out', isFinite(R.vMax) ? R.vMax.toFixed(2) + ' m/s' : 'no limit');
          row(3, 'driving at', p.speed.toFixed(1) + ' m/s');
          row(4, 'verdict', R.safe ? 'HOLDS THE CURVE'
                : R.slides === 'out' ? 'slides OUTWARD' : 'slides INWARD',
              R.safe ? th.ok : th.crit);
        } else if (p.mode === 'contact') {
          row(0, 'applied F', p.F.toFixed(1) + ' N');
          row(1, 'friction available μₛ(m₁+m₂)g', R.fMax.toFixed(1) + ' N');
          row(2, 'acceleration', R.a.toFixed(3) + ' m/s²', acc);
          row(3, 'contact force N₁₂', R.static ? '0 – ' + R.NcMax.toFixed(1) + ' N, indeterminate' : R.Nc.toFixed(2) + ' N', th.ok);
          row(4, 'verdict', R.static ? 'NOTHING MOVES' : 'both accelerate together', R.static ? th.crit : th.ok);
        } else if (p.mode === 'atwood') {
          row(0, 'acceleration (solved)', R.a.toFixed(3) + ' m/s²', acc);
          row(1, 'acceleration (motion sensor)', S.fit ? Math.abs(S.fit.m).toFixed(3) + ' m/s²' : 'measuring…', th.ok);
          row(2, 'T₁ on the heavy side', R.T1.toFixed(2) + ' N');
          row(3, 'T₂ on the light side', R.T2.toFixed(2) + ' N');
          row(4, 'T₁ − T₂ turns the pulley', (R.T1 - R.T2).toFixed(2) + ' N', p.mp > 0 ? th.warn : th['text-3']);
        } else if (p.mode === 'wedge') {
          row(0, 'wedge slides back at A', R.A.toFixed(3) + ' m/s²', acc);
          row(1, 'measured by the sensor', S.fit ? Math.abs(S.fit.m).toFixed(3) + ' m/s²' : 'measuring…', th.ok);
          row(2, 'block, relative to the wedge', R.ar.toFixed(3) + ' m/s²');
          row(3, 'block, as the floor sees it', R.a.toFixed(3) + ' m/s²');
          row(4, 'N (a fixed wedge would give mg cosθ)', R.N.toFixed(2) + ' vs ' + (p.m1 * G * Math.cos(R.theta)).toFixed(2) + ' N');
        } else if (p.mode === 'lift') {
          row(0, 'lift acceleration now', R.aLift.toFixed(2) + ' m/s²', acc);
          row(1, 'true weight mg', (p.m1 * G).toFixed(1) + ' N');
          row(2, 'scale pushes up, N = m(g + a)', R.Nscale.toFixed(1) + ' N', th.ok);
          row(3, 'so the scale shows', R.reading.toFixed(1) + ' kg', th.ok);
          row(4, 'feels', R.reading > p.m1 + 0.05 ? 'HEAVIER' : R.reading < p.m1 - 0.05 ? (R.reading < 0.05 ? 'WEIGHTLESS' : 'LIGHTER') : 'normal',
              R.reading > p.m1 + 0.05 ? th.warn : R.reading < p.m1 - 0.05 ? th.crit : th.ok);
        } else {
          row(0, 'friction needed to hold it', Math.abs(R.fNeed || 0).toFixed(2) + ' N');
          row(1, 'most static friction can give', (R.fMax || 0).toFixed(2) + ' N', acc);
          row(2, 'acceleration', R.a.toFixed(3) + ' m/s²', R.static ? th['text-2'] : acc);
          row(3, 'acceleration (motion sensor)', S.fit ? Math.abs(S.fit.m).toFixed(3) + ' m/s²' : (R.static ? '0 — at rest' : 'measuring…'), th.ok);
          row(4, 'verdict', R.static ? 'IT HOLDS — static' : 'IT SLIDES — kinetic',
              R.static ? th.ok : th.warn);
        }
      }

      /* ---------------- header ---------------- */
      ctx.textAlign = 'left'; ctx.textBaseline = 'top';
      ctx.font = '700 19px "IBM Plex Sans Condensed",sans-serif';
      if (p.mode === 'banking') {
        ctx.fillStyle = R.safe ? th.ok : th.crit;
        ctx.fillText(R.safe ? 'HOLDS at ' + p.speed.toFixed(1) + ' m/s'
                            : (R.slides === 'out' ? 'SLIDES OUT' : 'SLIDES IN') +
                              ' at ' + p.speed.toFixed(1) + ' m/s', 14, 8);
      } else {
        ctx.fillStyle = R.static ? th.ok : th.warn;
        ctx.fillText(p.mode === 'lift' ? 'scale reads ' + R.reading.toFixed(1) + ' kg   ·   a = ' + R.aLift.toFixed(2) + ' m/s²'
          : p.mode === 'wedge' ? 'wedge A = ' + R.A.toFixed(3) + ' m/s²   ·   block ' + R.a.toFixed(3) + ' m/s²'
          : p.mode === 'contact' ? (R.static ? 'STATIC — nothing moves' : 'a = ' + R.a.toFixed(3) + ' m/s²   ·   N₁₂ = ' + R.Nc.toFixed(2) + ' N')
          : R.static ? 'STATIC — nothing moves'
          : 'a = ' + Math.abs(R.a).toFixed(3) + ' m/s²   ·   T₁ = ' + R.T1.toFixed(2) + ' N' + (p.mp > 0 ? ', T₂ = ' + R.T2.toFixed(2) + ' N' : ''), 14, 8);
      }
      ctx.font = '500 10px "IBM Plex Mono",monospace'; ctx.fillStyle = th['text-3'];
      ctx.fillText(p.mode === 'banking'
        ? 'r = ' + p.radius.toFixed(0) + ' m · bank ' + p.theta.toFixed(1) + '° · μₛ = ' +
          p.muS.toFixed(2) + ' — the band, not a single speed'
        : p.mode === 'lift' ? 'lift car ' + p.liftM.toFixed(0) + ' kg · the shaft is drawn shortened; the trip is to scale in time'
        : p.mode === 'wedge' ? 'smooth face, smooth floor · ' + (p.fixWedge ? 'wedge clamped' : 'wedge free to slide')
        : p.mode === 'atwood' ? 'pulley ' + p.mp.toFixed(1) + ' kg, a uniform disc: I = ½Mr²'
        : 'μₛ = ' + p.muS.toFixed(2) + ', μₖ = ' + p.muK.toFixed(2) +
          ' · friction is tested against μₛN every frame, never assumed', 14, 31);
    },


    onDrag(S, e) {
      if (e.id !== 'm2' || !S._axM) return;
      const p = S.p;
      if (p.mode === 'contact') { p.F = clamp(p.F + e.dx * 0.25, 0, 120); this.setup(S); return; }
      const along = e.dx * S._axM.ux + e.dy * S._axM.uy;
      // dragging the hanging mass DOWN makes it heavier: a fixed gain per pixel (§2.13)
      p.m2 = clamp(p.m2 - along * 0.05, 0.5, 20);
      this.setup(S);
    },

    plots: [
      { title: 'What the answer depends on — sweep one quantity, hold the rest',
        legend: [{ c: '#FFB454', label: 'first quantity' }, { c: '#4ADE80', label: 'second quantity' },
                 { c: '#9AA8C0', label: 'reference' }],
        draw(S, g) {
          const p = S.p, R = S.R, c1 = '#FFB454', c2 = '#4ADE80', cr = '#9AA8C0', th = g.theme;
          const frame = (o) => g.Plot(Object.assign({ xfmt: v => v.toFixed(1), yfmt: v => v.toFixed(1) }, o)).frame();
          if (p.mode === 'atwood') {
            const t1 = [], t2 = [], aa = [];
            for (let i = 0; i <= 60; i++) {
              const mp = 6 * i / 60, Ip = 0.5 * mp;
              const x = SV.lin([[p.m1, 1, 0], [p.m2, 0, -1], [Ip, -1, 1]], [p.m1 * G, -p.m2 * G, 0]);
              t1.push([mp, x[1]]); t2.push([mp, x[2]]); aa.push([mp, x[0]]);
            }
            const all = t1.concat(t2).map(q => q[1]);
            const P = frame({ xmin: 0, xmax: 6, ymin: Math.min(...all) * 0.95, ymax: Math.max(...all) * 1.05,
              xlabel: 'pulley mass (kg)', ylabel: 'tension (N)' });
            P.clip(() => { P.line(t1, c1, 2.2); P.line(t2, c2, 2.2); P.vline(p.mp, g.alpha(th.text, .5), [3, 3]);
                           P.dot(p.mp, R.T1, 4.5, c1, th['ink-950']); P.dot(p.mp, R.T2, 4.5, c2, th['ink-950']); });
            P.tag(0.1, t1[0][1], 'equal only for a massless pulley', cr, 'left', -10);
            return;
          }
          if (p.mode === 'wedge') {
            const A = [], ab = [], ref = [], th0 = p.theta * Math.PI / 180, s = Math.sin(th0), c = Math.cos(th0);
            for (let i = 0; i <= 80; i++) {
              const r = 0.2 + 9.8 * i / 80, M = r * p.m1;
              const x = SV.lin([[-p.m1, p.m1 * c, -s], [0, -p.m1 * s, -c], [M, 0, -s]], [0, -p.m1 * G, 0]);
              A.push([r, x[0]]); ab.push([r, Math.hypot(x[1] * c - x[0], x[1] * s)]); ref.push([r, G * s]);
            }
            const P = frame({ xmin: 0.2, xmax: 10, ymin: 0, ymax: Math.max(...ab.map(q => q[1])) * 1.1,
              xlabel: 'wedge mass ÷ block mass (M/m)', ylabel: 'acceleration (m/s²)' });
            P.clip(() => { P.line(ref, cr, 1.4, [5, 4]); P.line(A, c1, 2.2); P.line(ab, c2, 2.2);
                           P.vline(p.M / p.m1, g.alpha(th.text, .5), [3, 3]); });
            P.tag(9.8, G * s, 'g sinθ: a clamped wedge', cr, 'right', -9);
            P.tag(0.4, A[2][1], 'wedge recoil A', c1, 'left', -9);
            return;
          }
          if (p.mode === 'lift') {
            const L = S.liftTrip, pts = [];
            for (let i = 0; i <= 300; i++) { const t = L.T * i / 300; pts.push([t, p.m1 * (G + liftAt(L, t).a) / G]); }
            const P = frame({ xmin: 0, xmax: L.T, ymin: 0, ymax: Math.max(p.m1 * 1.2, ...pts.map(q => q[1])) * 1.08,
              xlabel: 'time into the trip (s)', ylabel: 'scale reading (kg)', xfmt: v => v.toFixed(1), yfmt: v => v.toFixed(0) });
            P.clip(() => { P.line([[0, p.m1], [L.T, p.m1]], cr, 1.3, [5, 4]); P.line(pts, c1, 2.4);
                           P.vline(Math.min(S.tRun, L.T), g.alpha(th.text, .5), [3, 3]); });
            P.tag(0.05, p.m1, 'true mass', cr, 'left', -8);
            return;
          }
          if (p.mode === 'contact') {
            const as = [], ns = [], fT = p.muS * (p.m1 + p.m2) * G;
            for (let i = 0; i <= 120; i++) {
              const Fv = 120 * i / 120;
              if (Fv <= fT) { as.push([Fv, 0]); ns.push([Fv, NaN]); continue; }
              const a = (Fv - p.muK * (p.m1 + p.m2) * G) / (p.m1 + p.m2);
              as.push([Fv, a]); ns.push([Fv, p.m2 * a + p.muK * p.m2 * G]);
            }
            const mx = Math.max(1, ...ns.filter(q => isFinite(q[1])).map(q => q[1]), ...as.map(q => q[1])) * 1.1;
            const P = frame({ xmin: 0, xmax: 120, ymin: 0, ymax: mx, xlabel: 'applied force F (N)',
              ylabel: 'a (m/s²)  ·  N₁₂ (N)', xfmt: v => v.toFixed(0), yfmt: v => v.toFixed(0) });
            P.clip(() => { P.line(as, c1, 2.2); P.line(ns.filter(q => isFinite(q[1])), c2, 2.2);
                           P.vline(fT, cr, [4, 4]); P.vline(p.F, g.alpha(th.text, .5), [3, 3]); });
            P.tag(fT, mx * 0.9, 'friction beaten', cr, 'left', 0);
            return;
          }
          if (p.mode === 'banking') {
            const lo = [], hi = [], id = [];
            for (let i = 0; i <= 120; i++) {
              const a = 1 + 59 * i / 120, t = Math.tan(a * Math.PI / 180);
              id.push([a, Math.sqrt(p.radius * G * t)]);
              const n2 = t - p.muS, d2 = 1 + p.muS * t, n1 = t + p.muS, d1 = 1 - p.muS * t;
              lo.push([a, n2 > 0 ? Math.sqrt(p.radius * G * n2 / d2) : 0]);
              hi.push([a, d1 > 0.02 ? Math.min(Math.sqrt(p.radius * G * n1 / d1), 90) : 90]);
            }
            const P = frame({ xmin: 1, xmax: 60, ymin: 0, ymax: 60, xlabel: 'bank angle θ (°)', ylabel: 'speed (m/s)',
              xfmt: v => v.toFixed(0), yfmt: v => v.toFixed(0) });
            P.clip(() => { P.area(hi, 0, g.alpha(th.ok, .10)); P.area(lo, 0, g.alpha(th['ink-950'], 1));
                           P.line(hi, c2, 1.8); P.line(lo, c1, 1.8); P.line(id, cr, 1.5, [4, 3]);
                           P.dot(p.theta, p.speed, 4.5, R.safe ? th.ok : th.crit, th['ink-950']); });
            P.tag(30, Math.sqrt(p.radius * G * Math.tan(30 * Math.PI / 180)), 'frictionless: one speed only', cr, 'left', -9);
            return;
          }
          // table / ramp: sweep the hanging mass; friction needed against what is available
          const thr = p.mode === 'incline' ? p.theta * Math.PI / 180 : 0;
          const N = p.m1 * G * Math.cos(thr), fMax = p.muS * N, need = [];
          for (let i = 0; i <= 160; i++) { const m = 0.5 + 19.5 * i / 160; need.push([m, Math.abs(m * G - p.m1 * G * Math.sin(thr))]); }
          const ymax = Math.max(fMax * 1.6, Math.max(...need.map(q => q[1])) * 1.05, 1);
          const P = frame({ xmin: 0.5, xmax: 20, ymin: 0, ymax: ymax, xlabel: 'hanging mass m₂ (kg)',
            ylabel: 'friction force (N)', xfmt: v => v.toFixed(0), yfmt: v => v.toFixed(0) });
          P.clip(() => { P.line([[0.5, fMax], [20, fMax]], c2, 2.2); P.line(need, c1, 2.2);
                         P.vline(p.m2, g.alpha(th.text, .5), [3, 3]); });
          P.tag(0.7, fMax, 'most static friction can give: μₛN', c2, 'left', -9);
        } },

      { title: 'The motion sensor\'s record — the acceleration, measured',
        legend: [{ c: '#7CF0B0', label: 'sensor readings (v from Δs/Δt)' }, { c: '#FFB454', label: 'straight-line fit' },
                 { c: '#9AA8C0', label: 'what the equations predict' }],
        draw(S, g) {
          const p = S.p, R = S.R, th = g.theme;
          if (p.mode === 'banking') {
            const need = [], have = [], thr = p.theta * Math.PI / 180;
            for (let i = 0; i <= 160; i++) {
              const v = 60 * i / 160;
              const Nn = p.m1 * (G * Math.cos(thr) + v * v / p.radius * Math.sin(thr));
              need.push([v, Math.abs(p.m1 * (v * v / p.radius * Math.cos(thr) - G * Math.sin(thr)))]); have.push([v, p.muS * Nn]);
            }
            const P = g.Plot({ xmin: 0, xmax: 60, ymin: 0, ymax: Math.max(...have.map(q => q[1])) * 1.1,
              xlabel: 'speed (m/s)', ylabel: 'friction along the slope (N)', xfmt: v => v.toFixed(0), yfmt: v => (v / 1000).toFixed(1) + 'k' }).frame();
            P.clip(() => { P.area(have, 0, g.alpha(th.ok, .10)); P.line(have, '#4ADE80', 2); P.line(need, '#FFB454', 2);
                           P.vline(R.vIdeal, '#9AA8C0', [4, 3]); P.vline(p.speed, g.alpha(th.text, .5), [3, 3]); });
            P.tag(R.vIdeal, 0, 'ideal speed — no friction needed', '#9AA8C0', 'left', -10);
            return;
          }
          const vs = p.mode === 'lift'
            ? (S.log || []).slice(1, -1).map((q, i, arr) => { const a = S.log[i], b = S.log[i + 2]; return [q[0], (b[1] - a[1]) / (b[0] - a[0])]; })
            : (S.vlog || []);
          const tmax = p.mode === 'lift' ? S.liftTrip.T : Math.max(1.5, ...vs.map(q => q[0]), 0.35 + Math.sqrt(2 * S.travel / Math.max(Math.abs(p.mode === 'wedge' ? R.A : R.a) || 1e-6, 1e-6)) + 0.3);
          const vv = vs.map(q => Math.abs(q[1]));
          const vmax = Math.max(0.2, ...vv) * 1.15;
          const P = g.Plot({ xmin: 0, xmax: tmax, ymin: 0, ymax: vmax, xlabel: 'time (s)', ylabel: 'speed (m/s)',
            xfmt: v => v.toFixed(1), yfmt: v => v.toFixed(2) }).frame();
          P.clip(() => {
            // theory
            const th0 = 0.35, aTh = Math.abs(p.mode === 'wedge' ? R.A : R.a) || 0;
            if (p.mode === 'lift') {
              const tl = []; for (let i = 0; i <= 200; i++) { const t = S.liftTrip.T * i / 200; tl.push([t, Math.abs(liftAt(S.liftTrip, t).v)]); }
              P.line(tl, '#9AA8C0', 1.4, [5, 4]);
            } else if (!R.static) {
              const tStop = th0 + Math.sqrt(2 * S.travel / Math.max(aTh, 1e-9));
              P.line([[0, 0], [th0, 0], [tStop, aTh * (tStop - th0)]], '#9AA8C0', 1.4, [5, 4]);
            }
            vs.forEach(q => P.dot(q[0], Math.abs(q[1]), 2.2, '#7CF0B0'));
            if (S.fit && p.mode !== 'lift') {
              const f = S.fit, t0 = -f.c / (f.m || 1e-9), t1 = Math.min(tmax, t0 + vmax / Math.max(Math.abs(f.m), 1e-9));
              P.line([[t0, 0], [t1, Math.abs(f.m * t1 + f.c)]], '#FFB454', 2);
            }
          });
          if (S.fit && p.mode !== 'lift')
            P.tag(tmax * 0.04, vmax * 0.9, 'fitted slope ' + Math.abs(S.fit.m).toFixed(3) + ' m/s²  ·  predicted ' +
                  Math.abs(p.mode === 'wedge' ? R.A : R.a).toFixed(3), '#FFB454', 'left', 0);
          else if (R.static && p.mode !== 'lift') P.tag(tmax * 0.04, vmax * 0.5, 'nothing moves: the record stays flat', th.ok, 'left', 0);
        } }
    ],

    readouts(S) {
      const p = S.p, R = S.R;
      const meas = { label: 'Acceleration, motion sensor', value: S.fit ? Math.abs(S.fit.m).toFixed(3) : '—', unit: 'm/s²',
                     flag: 'ok', hint: 'fitted from the record' };
      if (p.mode === 'banking') return [
        { label: 'Ideal speed √(rg tanθ)', value: R.vIdeal.toFixed(2), unit: 'm/s', flag: 'accent', hint: 'no friction needed at all' },
        { label: 'Slowest safe speed', value: R.vMin.toFixed(2), unit: 'm/s', hint: R.vMin < 0.01 ? 'it can stand still' : 'below this it slides in' },
        { label: 'Fastest safe speed', value: isFinite(R.vMax) ? R.vMax.toFixed(2) : '∞', unit: 'm/s', flag: 'accent' },
        { label: 'Driving at', value: p.speed.toFixed(1), unit: 'm/s', flag: R.safe ? 'ok' : 'crit' },
        { label: 'Centripetal force needed', value: R.needed.toFixed(0), unit: 'N', hint: 'mv²/r' },
        { label: 'Normal force', value: R.bodies[0].N.toFixed(0), unit: 'N', hint: 'bigger than mg on a bank' }
      ];
      if (p.mode === 'lift') return [
        { label: 'Scale reading', value: R.reading.toFixed(1), unit: 'kg', flag: 'accent', hint: 'N/g, not your mass' },
        { label: 'Normal force N = m(g + a)', value: R.Nscale.toFixed(1), unit: 'N' },
        { label: 'True weight mg', value: (p.m1 * G).toFixed(1), unit: 'N' },
        { label: 'Lift acceleration', value: R.aLift.toFixed(2), unit: 'm/s²', flag: R.aLift > 0 ? 'ok' : R.aLift < 0 ? 'crit' : undefined },
        { label: 'Cable tension', value: (R.Tcable / 1000).toFixed(2), unit: 'kN', hint: '(M + m)(g + a)' },
        { label: 'Lift speed', value: Math.abs(R.vLift).toFixed(2), unit: 'm/s', hint: 'speed does not change the reading' }
      ];
      if (p.mode === 'wedge') return [
        { label: 'Wedge slides back at A', value: R.A.toFixed(3), unit: 'm/s²', flag: 'accent', hint: 'mg sinθ cosθ/(M + m sin²θ)' },
        meas,
        { label: 'Block relative to wedge', value: R.ar.toFixed(3), unit: 'm/s²', hint: 'down the face' },
        { label: 'Block as the floor sees it', value: R.a.toFixed(3), unit: 'm/s²', hint: R.pathAngle.toFixed(1) + '° below horizontal' },
        { label: 'Normal force N', value: R.N.toFixed(3), unit: 'N', hint: 'less than mg cosθ = ' + (p.m1 * G * Math.cos(R.theta)).toFixed(2) },
        { label: 'Floor pushes on wedge', value: R.Nfloor.toFixed(2), unit: 'N', hint: 'less than (M + m)g = ' + ((p.M + p.m1) * G).toFixed(2) },
        { label: 'Horizontal momentum', value: '0', unit: 'kg·m/s', flag: 'ok', hint: 'no horizontal outside force' }
      ];
      const out = [
        { label: 'Acceleration, solved', value: Math.abs(R.a).toFixed(3), unit: 'm/s²', flag: 'accent',
          hint: R.static ? 'zero — it holds' : 'from the constraint equations' },
        meas
      ];
      if (p.mode === 'contact') {
        out.push({ label: 'Contact force N₁₂', value: R.static ? 'indeterminate' : R.Nc.toFixed(2), unit: R.static ? '' : 'N',
                   flag: 'accent', hint: R.static ? '0 to ' + R.NcMax.toFixed(1) + ' N — friction shares it' : 'accelerates m₂ alone' });
        out.push({ label: 'Push from the other side', value: R.static ? '—' : (p.m1 * R.a + p.muK * p.m1 * G).toFixed(2),
                   unit: R.static ? '' : 'N', flag: 'warn', hint: 'the contact force is NOT symmetric' });
        return out;
      }
      out.push({ label: 'Tension T₁', value: R.T1.toFixed(2), unit: 'N', flag: 'accent' });
      if (p.mode === 'atwood' || p.mp > 0) out.push({ label: 'Tension T₂', value: R.T2.toFixed(2), unit: 'N',
        hint: p.mp > 0 ? 'differs: the pulley has mass' : 'same: light pulley' });
      if (p.mode !== 'atwood') {
        out.push({ label: 'Friction needed', value: Math.abs(R.fNeed || 0).toFixed(2), unit: 'N', hint: 'to hold it still' });
        out.push({ label: 'Friction available μₛN', value: (R.fMax || 0).toFixed(2), unit: 'N', flag: R.static ? 'ok' : 'crit' });
        out.push({ label: 'Normal force on m₁', value: (R.N || 0).toFixed(2), unit: 'N', hint: p.mode === 'incline' ? 'mg cos θ, not mg' : 'mg on the flat' });
      }
      return out;
    },

    equation(S) {
      const p = S.p, R = S.R;
      if (p.mode === 'banking')
        return E.v('v') + E.sub('ideal') + ' ' + E.op('=') + ' √(' + E.v('rg') + ' tan' + E.v('θ') + ') ' + E.op('=') + ' ' + E.n(R.vIdeal, 'm/s') +
          '<br>' + E.v('v') + E.sub('max') + ' ' + E.op('=') + ' √(' + E.v('rg') +
          E.frac('tan' + E.v('θ') + E.op('+') + E.v('μ'), '1' + E.op('−') + E.v('μ') + ' tan' + E.v('θ')) + ') ' + E.op('=') + ' ' +
          E.n(isFinite(R.vMax) ? R.vMax : 999, 'm/s');
      if (p.mode === 'lift')
        return E.v('N') + ' ' + E.op('−') + ' ' + E.v('mg') + ' ' + E.op('=') + ' ' + E.v('ma') + E.op('⇒') + ' ' + E.v('N') + ' ' +
          E.op('=') + ' ' + E.v('m') + '(' + E.v('g') + ' ' + E.op('+') + ' ' + E.v('a') + ') ' + E.op('=') + ' ' + E.n(R.Nscale, 'N') +
          '<br>reading ' + E.op('=') + ' ' + E.frac(E.v('N'), E.v('g')) + ' ' + E.op('=') + ' ' + E.n(R.reading, 'kg') +
          E.op('·') + ' free fall: ' + E.v('a') + ' ' + E.op('=') + ' −' + E.v('g') + ' ' + E.op('⇒') + ' ' + E.v('N') + ' ' + E.op('=') + ' 0';
      if (p.mode === 'wedge')
        return E.v('A') + ' ' + E.op('=') + ' ' + E.frac(E.v('mg') + ' sin' + E.v('θ') + ' cos' + E.v('θ'),
          E.v('M') + ' ' + E.op('+') + ' ' + E.v('m') + ' sin²' + E.v('θ')) + ' ' + E.op('=') + ' ' + E.n(R.A, 'm/s²') +
          '<br>' + E.v('a') + E.sub('rel') + ' ' + E.op('=') + ' ' + E.frac('(' + E.v('M') + E.op('+') + E.v('m') + ')' + E.v('g') + ' sin' + E.v('θ'),
          E.v('M') + ' ' + E.op('+') + ' ' + E.v('m') + ' sin²' + E.v('θ')) + ' ' + E.op('=') + ' ' + E.n(R.ar, 'm/s²') +
          E.op('·') + ' ' + E.v('N') + ' ' + E.op('=') + ' ' + E.n(R.N, 'N');
      if (p.mode === 'contact')
        return E.v('a') + ' ' + E.op('=') + ' ' + E.frac(E.v('F') + E.op('−') + E.v('μ') + '(' + E.v('m') + '₁' + E.op('+') + E.v('m') + '₂)' + E.v('g'),
          E.v('m') + '₁' + E.op('+') + E.v('m') + '₂') + ' ' + E.op('=') + ' ' + E.n(R.a, 'm/s²') +
          '<br>' + E.v('N') + '₁₂ ' + E.op('=') + ' ' + E.v('m') + '₂(' + E.v('a') + E.op('+') + E.v('μg') + ') ' + E.op('=') + ' ' +
          (R.static ? 'indeterminate while static' : E.n(R.Nc, 'N'));
      if (p.mode === 'atwood')
        return E.v('a') + ' ' + E.op('=') + ' ' + E.frac('(' + E.v('m') + '₁' + E.op('−') + E.v('m') + '₂)' + E.v('g'),
          E.v('m') + '₁' + E.op('+') + E.v('m') + '₂' + E.op('+') + ' ' + E.frac(E.v('I'), E.v('r') + '²')) + ' ' + E.op('=') + ' ' +
          E.n(R.a, 'm/s²') + '<br>' + E.v('T') + '₁ ' + E.op('=') + ' ' + E.v('m') + '₁(' + E.v('g') + E.op('−') + E.v('a') + ') ' +
          E.op('=') + ' ' + E.n(R.T1, 'N') + E.op('·') + ' ' + E.v('T') + '₂ ' + E.op('=') + ' ' + E.v('m') + '₂(' + E.v('g') + E.op('+') +
          E.v('a') + ') ' + E.op('=') + ' ' + E.n(R.T2, 'N');
      let s = 'test: ' + E.v('f') + E.sub('needed') + ' ' + E.op('=') + ' ' + E.n(Math.abs(R.fNeed || 0), 'N') + ' vs ' + E.v('μ') +
        E.sub('s') + E.v('N') + ' ' + E.op('=') + ' ' + E.n(R.fMax || 0, 'N') + E.op('→') + (R.static ? ' it holds' : ' it lets go');
      s += '<br>' + E.v('a') + ' ' + E.op('=') + ' ';
      if (R.static) s += '0' + E.op(',') + ' and ' + E.v('f') + ' ' + E.op('=') + ' ' + E.n(Math.abs(R.fNeed || 0), 'N') + E.op(',') + ' NOT ' + E.v('μ') + E.sub('s') + E.v('N');
      else s += E.frac(E.v('m') + '₂' + E.v('g') + E.op('−') + E.v('m') + '₁' + E.v('g') + 'sin' + E.v('θ') + E.op('−') + E.v('μ') + E.sub('k') +
        E.v('m') + '₁' + E.v('g') + 'cos' + E.v('θ'), E.v('m') + '₁' + E.op('+') + E.v('m') + '₂' + (p.mp > 0 ? E.op('+') + E.frac(E.v('I'), E.v('r') + '²') : '')) +
        ' ' + E.op('=') + ' ' + E.n(Math.abs(R.a), 'm/s²');
      return s;
    },
    eqNote: '<b>Static friction is not μ<sub>s</sub>N.</b> It is whatever value equilibrium demands, up ' +
      'to a ceiling of μ<sub>s</sub>N — and that ceiling is reached only at the instant of slipping. A ' +
      'block sitting on a table with a 2 N pull experiences 2 N of friction, not μ<sub>s</sub>N, however ' +
      'large μ<sub>s</sub> is. Watch the FRICTION TEST panel: while the system holds, the needed value ' +
      'tracks the pull; the moment it exceeds the ceiling the friction jumps <i>down</i> to μ<sub>k</sub>N ' +
      'and stays there. That jump is why a block lurches as it breaks free, and why μ<sub>k</sub> &lt; ' +
      'μ<sub>s</sub> matters.',

    problems: [
      { source: 'JEE Main pattern · the Atwood machine',
        q: 'Two masses of 5.00 kg and 3.00 kg hang from a light string over a frictionless pulley. Take g = 9.81 m/s². Find the acceleration of the system in m/s².',
        params: { mode: 'atwood', mp: 0, m1: 5, m2: 3, muS: 0, muK: 0 },
        predict: { label: 'acceleration', unit: 'm/s²', tol: 0.02 },
        measure: S => Math.abs(S.R.a),
        working: 'a = (m₁ − m₂)g/(m₁ + m₂) = (5.00 − 3.00)(9.81)/8.00 = <b>2.45 m/s²</b>, and the ' +
          'tension is 2m₁m₂g/(m₁+m₂) = 36.8 N. Note that T lies <i>between</i> the two weights ' +
          '(29.4 N and 49.1 N) — it has to, because the lighter mass accelerates upward and the ' +
          'heavier one downward. A tension outside that range is an arithmetic slip you can catch ' +
          'without redoing the problem.' },
      { source: 'JEE Main pattern · does it move at all?',
        q: 'A 10.0 kg block rests on a horizontal table with μₛ = 0.500, connected over a pulley to a 2.00 kg hanging mass. Find the acceleration of the system in m/s².',
        params: { mode: 'table', mp: 0, m1: 10, m2: 2, muS: 0.5, muK: 0.4, theta: 0 },
        predict: { label: 'acceleration', unit: 'm/s²', tol: 0.05 },
        measure: S => Math.abs(S.R.a),
        working: '<b>Zero.</b> Test first: the pull is m₂g = 19.6 N, while static friction can supply ' +
          'up to μₛm₁g = 0.500 × 98.1 = 49.1 N. The pull loses, so nothing moves and the friction ' +
          'force is <b>19.6 N</b> — not 49.1 N. Plugging straight into a = (m₂g − μm₁g)/(m₁+m₂) gives ' +
          'a negative acceleration, which is the standard way this question is failed: a negative answer ' +
          'here means "it does not move", not "it moves backwards".' },
      { source: 'JEE Advanced pattern · once it breaks free',
        q: 'The same table and block, but now with a 8.00 kg hanging mass and μₖ = 0.400. Find the acceleration in m/s².',
        params: { mode: 'table', mp: 0, m1: 10, m2: 8, muS: 0.5, muK: 0.4, theta: 0 },
        predict: { label: 'acceleration', unit: 'm/s²', tol: 0.02 },
        measure: S => Math.abs(S.R.a),
        working: 'Test: the pull is 78.5 N against a ceiling of 49.1 N, so it slides. Now — and only ' +
          'now — friction is kinetic: a = (m₂g − μₖm₁g)/(m₁+m₂) = (78.5 − 39.2)/18.0 = ' +
          '<b>2.18 m/s²</b>, with T = m₂(g − a) = 61.0 N. The order matters: test with μₛ, then ' +
          'compute with μₖ.' },
      { source: 'JEE Advanced pattern · the contact force',
        q: 'Blocks of 3.00 kg and 2.00 kg sit in contact on a frictionless floor. A force of 20.0 N pushes on the 3.00 kg block. Find the contact force between them, in newtons.',
        params: { mode: 'contact', m1: 3, m2: 2, F: 20, muS: 0, muK: 0 },
        predict: { label: 'contact force N₁₂', unit: 'N', tol: 0.02 },
        measure: S => S.R.Nc,
        working: 'Both accelerate together at a = F/(m₁+m₂) = 20.0/5.00 = 4.00 m/s². The contact ' +
          'force is whatever pushes the <i>second</i> block: N₁₂ = m₂a = 2.00 × 4.00 = <b>8.00 N</b>. ' +
          'Push the same 20 N on the 2 kg block instead and the contact force becomes m₁a = ' +
          '<b>12.0 N</b> — the same pair of blocks, the same total force, a different internal force. ' +
          'The contact force is not a property of the pair; it is whatever the block behind it needs.' },
      { source: 'NEET pattern · the banked curve',
        q: 'A curve of radius 80.0 m is banked at 20.0°. At what speed can a car take it with no friction at all, in m/s? Take g = 9.81 m/s².',
        params: { mode: 'banking', m1: 1200, theta: 20, radius: 80, muS: 0.4, muK: 0.35, speed: 16.9 },
        predict: { label: 'ideal speed', unit: 'm/s', tol: 0.02 },
        measure: S => S.R.vIdeal,
        working: 'With no friction the only horizontal force is the inward component of N: ' +
          'N sin θ = mv²/r and N cos θ = mg. Divide: tan θ = v²/rg, so ' +
          'v = √(rg tan θ) = √(80.0 × 9.81 × 0.364) = <b>16.9 m/s</b>. The mass cancels — a lorry and ' +
          'a motorbike have the same ideal speed. With friction this becomes a <i>band</i> either side ' +
          'of that value, which the graph draws.' },
      { source: 'JEE Advanced pattern · a pulley with mass',
        q: 'Masses of 5.00 kg and 3.00 kg hang over a pulley that is a uniform disc of mass 2.00 kg. The string does not slip. Find the acceleration in m/s² (g = 9.81 m/s²).',
        params: { mode: 'atwood', m1: 5, m2: 3, mp: 2, muS: 0, muK: 0 },
        predict: { label: 'acceleration', unit: 'm/s²', tol: 0.02 },
        measure: S => Math.abs(S.R.a),
        working: 'The pulley needs a net torque to spin up, so the tensions differ: (T₁ − T₂)r = Iα with I = ½Mr² and ' +
          'α = a/r gives T₁ − T₂ = ½Ma. Adding the three equations: a = (m₁ − m₂)g/(m₁ + m₂ + ½M) = 2(9.81)/9.00 = ' +
          '<b>2.18 m/s²</b>. Then T₁ = m₁(g − a) = 38.2 N and T₂ = m₂(g + a) = 36.0 N. The pulley\'s mass enters as ' +
          'half its mass, because a disc keeps half its mass at small radius.' },
      { source: 'JEE Advanced pattern · the wedge that moves',
        q: 'A 1.00 kg block slides down the smooth 30° face of a 4.00 kg wedge that rests on a smooth floor. Find the acceleration of the wedge, in m/s².',
        params: { mode: 'wedge', m1: 1, M: 4, theta: 30, fixWedge: false },
        predict: { label: 'wedge acceleration', unit: 'm/s²', tol: 0.02 },
        measure: S => S.R.A,
        working: 'Three unknowns, three equations: the block\'s two components and the wedge\'s horizontal equation, ' +
          'with the block constrained to stay on the face. They give A = mg sinθ cosθ/(M + m sin²θ) = ' +
          '(9.81)(0.5)(0.866)/(4 + 0.25) = <b>1.00 m/s²</b>. The block\'s real path is steeper than the face (the ' +
          'dashed line), N is less than mg cosθ, and total horizontal momentum stays zero throughout.' },
      { source: 'NEET pattern · the lift',
        q: 'A 60.0 kg person stands on a bathroom scale in a lift that accelerates upward at 2.00 m/s². What does the scale read, in kg? (g = 9.81 m/s²)',
        params: { mode: 'lift', m1: 60, liftA: 2, trip: 'up' },
        predict: { label: 'scale reading', unit: 'kg', tol: 0.02 },
        measure: S => 60 * (9.81 + 2) / 9.81,
        working: 'The scale measures the normal force, not the mass. N − mg = ma, so N = m(g + a) = 60 × 11.81 = 708.6 N, ' +
          'and the scale, calibrated in kg, shows N/g = <b>72.2 kg</b>. Moving at steady speed it reads 60.0 kg; ' +
          'braking on the way up it reads less; in free fall it reads zero.' }
    ],

    walkthrough: [
      { title: '1 · Friction is not a number you look up',
        body: 'A 10 kg block on a table, μₛ = 0.5, with only 2 kg hanging. Look at the FRICTION TEST panel.',
        ask: 'How much friction is acting on the block right now?',
        reveal: '<b>19.6 N</b> — exactly the pull, not the 49.1 N that μₛN would give. Static friction is a ' +
          'reaction: it supplies whatever equilibrium needs, up to a ceiling. Writing f = μₛN when the ' +
          'block is not on the point of slipping is the commonest error in the chapter, and it gives a ' +
          'block that accelerates backwards.',
        params: { mode: 'table', mp: 0, m1: 10, m2: 2, muS: 0.5, muK: 0.4, theta: 0 } },
      { title: '2 · Drag the hanging mass until it lets go',
        body: 'Drag m₂ downward — it gets heavier — and watch the red line in the first graph climb toward the green one.',
        ask: 'What happens at the moment the two lines cross?',
        reveal: 'The block breaks free, and friction <b>drops</b> from its peak μₛN to the smaller μₖN. ' +
          'That is why a heavy box lurches the instant you get it moving and then feels easier to push. ' +
          'The threshold is m₂ = μₛm₁ = 5.0 kg here, marked on the graph.',
        params: { mode: 'table', mp: 0, m1: 10, m2: 5.2, muS: 0.5, muK: 0.4, theta: 0 } },
      { title: '3 · On a slope, N is not mg',
        body: 'Switch to the incline at 30° and look at the normal-force readout.',
        ask: 'Why is the normal force smaller than the weight?',
        reveal: 'Because only the component of weight <b>perpendicular to the surface</b> has to be ' +
          'balanced: N = mg cos θ. The other component, mg sin θ, runs down the slope and is what the ' +
          'string and friction have to fight. Using mg for N on a slope inflates the friction by 1/cos θ, ' +
          'which at 60° is a factor of two.',
        params: { mode: 'incline', mp: 0, m1: 5, m2: 3, theta: 30, muS: 0.6, muK: 0.5 } },
      { title: '4 · The tension is not the weight',
        body: 'Set the incline frictionless and watch the tension as the system accelerates.',
        ask: 'The hanging mass is 3 kg, so is the tension 29.4 N?',
        reveal: '<b>No.</b> If T equalled m₂g the hanging mass would have no net force and could not ' +
          'accelerate. T = m₂(g − a) whenever m₂ is descending, so the tension is always <i>less</i> ' +
          'than the weight of a falling mass and <i>more</i> than the weight of a rising one. T equals ' +
          'the weight only when a = 0.',
        params: { mode: 'incline', mp: 0, m1: 4, m2: 3, theta: 30, muS: 0, muK: 0 } },
      { title: '5 · The contact force is not symmetric',
        body: 'Switch to blocks in contact: 3 kg and 2 kg, 20 N applied to the 3 kg block.',
        ask: 'Swap which block you push. Does the contact force between them stay the same?',
        reveal: '<b>No — 8 N one way, 12 N the other.</b> The contact force is whatever is needed to ' +
          'accelerate everything <i>in front of</i> the interface. Push the light block and the contact ' +
          'force has to accelerate the heavy one, so it is larger. Same blocks, same total force, ' +
          'different internal force — the classic two-mark trap.',
        params: { mode: 'contact', m1: 3, m2: 2, F: 20, muS: 0, muK: 0 } },
      { title: '6 · A banked curve has a speed band, not a speed',
        body: 'Switch to the banked curve and drag the speed up and down.',
        ask: 'With friction available, is there one correct speed or a range?',
        reveal: 'A <b>range</b>. The frictionless ideal √(rg tan θ) is the one speed needing no friction ' +
          'at all; either side of it friction makes up the difference, up to μₛN. The first graph shows ' +
          'the band opening out around the dashed ideal curve as the bank steepens. Too fast and the car ' +
          'slides outward, too slow and it slides down the bank.',
        params: { mode: 'banking', m1: 1200, theta: 20, radius: 80, muS: 0.4, muK: 0.35, speed: 16.9 } },
      { title: '7 · Why the mass never appears',
        body: 'Change the car mass and watch the ideal speed and the safe band.',
        ask: 'A loaded lorry and a motorbike take the same curve. Do they have different safe speeds?',
        reveal: '<b>Identical.</b> Every term in the balance carries a factor of m — the weight, the ' +
          'centripetal requirement and the friction (through N) — so it cancels. The same is true of a ' +
          'block sliding down a slope: the angle at which it starts to slide depends on μ and nothing ' +
          'else. If a mass survives to the end of one of these answers, look for the error.',
        params: { mode: 'banking', m1: 400, theta: 20, radius: 80, muS: 0.4, muK: 0.35, speed: 16.9 } },
      { title: '8 · A pulley with mass',
        body: 'Load "Atwood · heavy pulley" and read the two tension meters.',
        ask: 'Why are T₁ and T₂ different now?',
        reveal: 'A heavy pulley needs a <b>net torque</b> to spin faster, and only a difference in tension can supply it: ' +
          '(T₁ − T₂)r = Iα. With a light pulley the difference goes to zero, which is the only reason the textbook can ' +
          'use one T for the whole string. The first graph shows the two tensions splitting apart as the pulley gets heavier.',
        params: { mode: 'atwood', m1: 5, m2: 3, mp: 2 } },
      { title: '9 · The wedge runs away',
        body: 'Load "Sliding wedge". The wedge sits on a smooth track, so the block pushes it backwards.',
        ask: 'Does the block slide down along the face of the wedge, as seen from the floor?',
        reveal: '<b>No — its real path (dashed) is steeper than the face</b>, because the face moves away underneath it. ' +
          'The normal force is less than mg cosθ, and the floor pushes up on the wedge with less than (M + m)g, because ' +
          'the block is accelerating downwards. Clamp the wedge and every one of those differences disappears.',
        params: { mode: 'wedge', m1: 1, M: 4, theta: 30, fixWedge: false } },
      { title: '10 · Weight in a lift',
        body: 'Load "Lift going up" and watch the scale through the whole trip.',
        ask: 'When does the scale read more than the true mass, and when less?',
        reveal: 'More while accelerating <b>upward</b> (starting up, or braking on the way down); less while accelerating ' +
          'downward; exactly right at steady speed, however fast. The scale reads N, and N = m(g + a). Cut the cable ' +
          'and a = −g, so N = 0: the reading drops to zero. That is weightlessness.',
        params: { mode: 'lift', m1: 60, liftA: 2, trip: 'up' } }
    ],

    quiz: [
      { q: 'A block on a table is pulled with a force smaller than μₛN. The friction acting on it is:',
        options: ['μₛN', 'equal to the applied force', 'μₖN', 'zero'], answer: 1,
        why: 'Static friction is a reaction force: it takes whatever value equilibrium requires, up to a maximum of μₛN. It equals μₛN only at the instant of slipping.' },
      { q: 'In an Atwood machine with unequal masses, the tension in the string is:',
        options: ['equal to the heavier weight', 'between the two weights',
                  'equal to the lighter weight', 'equal to their sum'], answer: 1,
        why: 'The heavy mass accelerates down so T < m₁g; the light one accelerates up so T > m₂g. A tension outside that range signals an arithmetic error before you check anything else.' },
      { q: 'A block on a slope of angle θ has normal force:',
        options: ['mg', 'mg cos θ', 'mg sin θ', 'mg tan θ'], answer: 1,
        why: 'Only the component of weight perpendicular to the surface is balanced by N. The parallel component mg sin θ is unbalanced and drives the motion.' },
      { q: 'Two blocks of 3 kg and 2 kg in contact are pushed by 20 N applied to the 3 kg block, on a frictionless floor. The contact force is:',
        options: ['20 N', '8 N', '12 N', '10 N'], answer: 1,
        why: 'a = 20/5 = 4 m/s², and the contact force must accelerate the 2 kg block alone: 2 × 4 = 8 N. Push the other block instead and it becomes 12 N.' },
      { q: 'A car rounds a frictionless banked curve. The correct speed depends on:',
        options: ['the mass of the car', 'the radius and the bank angle only',
                  'the tyre width', 'the mass and the radius'], answer: 1,
        why: 'v = √(rg tan θ). The mass cancels from the balance because weight, centripetal requirement and normal force all scale with it. A lorry and a motorbike have the same ideal speed.' },
      { q: 'Two masses hang over a pulley that has mass. The tensions on the two sides are:',
        options: ['always equal', 'different, with the larger on the side of the descending mass', 'zero', 'different, with the larger on the rising side'], answer: 1,
        why: 'The pulley needs a net torque to accelerate its rotation, (T₁ − T₂)r = Iα, so the side that pulls it round (the descending mass) has the larger tension.' },
      { q: 'A person on a scale in a lift that moves upward at constant speed reads:',
        options: ['more than their weight', 'less than their weight', 'exactly their weight', 'zero'], answer: 2,
        why: 'Constant velocity means a = 0, so N = mg. Only acceleration changes the reading, never speed.' },
      { q: 'A block slides down a smooth wedge that is free to move on a smooth floor. The normal force between them is:',
        options: ['mg cos θ', 'more than mg cos θ', 'less than mg cos θ', 'zero'], answer: 2,
        why: 'The wedge accelerates away from the block, so the block presses on it less than it would on a fixed wedge: N = Mmg cosθ/(M + m sin²θ).' }
    ],

    notes: '<b>Where this shows up in the paper.</b>' +
      '<ul><li>Pulley systems: the string constraint makes every connected body share |a|, and the ' +
      'tension is the same throughout a light string over a light pulley.</li>' +
      '<li>The static-versus-kinetic test, which must be done <b>before</b> computing anything.</li>' +
      '<li>Blocks in contact, where the contact force depends on which side you push.</li>' +
      '<li>Blocks on an incline: N = mg cos θ, driving component mg sin θ, and the angle of repose ' +
      'tan θ = μₛ at which a block just begins to slide.</li>' +
      '<li>Banked curves, the ideal speed √(rg tan θ), and the band that friction opens around it.</li>' +
      '<li>Pulleys with mass: the tensions differ by (I/r²)a, and the pulley\'s mass enters as ½M for a disc.</li>' +
      '<li>The movable wedge: three equations and one constraint; horizontal momentum is conserved.</li>' +
      '<li>Apparent weight in a lift: N = m(g + a), zero in free fall; or the pseudo-force −ma in the lift\'s frame.</li></ul>' +
      '<div class="pyq"><em>Trap to avoid</em>Static friction is <b>not</b> μ<sub>s</sub>N. That is its ' +
      'maximum, reached only at the point of slipping. Writing f = μ<sub>s</sub>N for a stationary block ' +
      'that is nowhere near slipping produces a negative acceleration, and a negative acceleration in ' +
      'this situation means the block does not move at all — not that it moves backwards.</div>' +
      '<div class="pyq"><em>Trap to avoid</em>The tension in the string of an Atwood machine is ' +
      '<b>not</b> the weight of either mass. If it were, that mass would have no net force and could ' +
      'not accelerate. T = m(g − a) for a descending mass and m(g + a) for a rising one.</div>'
  });


  /* =========================================================================
     17 · COLLISIONS — an air track, real bumpers, real timing

     A collision here is not an instant. Each glider carries a spring bumper,
     and while the bumpers are pressed together they push with a spring-
     and-damper force, F = kδ + cδ̇ (never pulling). The whole contact is
     integrated with RK4 in steps of a tenth of a millisecond, so the force
     rises, peaks and falls over a few hundredths of a second — and the
     impulse is the area under that curve. The damping is calibrated so the
     coefficient of restitution you set is the one the bumpers produce; the
     lab then measures e from the velocities afterwards and shows both.

     Velocities are not read from the model, either: photogates time a 10 cm
     flag on each glider through the beam, v = L/Δt, exactly as in the
     school practical, and the momentum book is kept from those readings.
     ========================================================================= */

  const FLAG = 0.10;                         // flag length on each glider, m
  const KB = 1800;                           // bumper stiffness, N/m

  /* damping ratio that gives restitution e for a linear spring-damper whose
     force may not go negative — found by bisection on a short simulation,
     because the no-pull rule changes the textbook ζ(e) relation */
  function bounceE(zeta, mu) {
    const k = KB, c = 2 * zeta * Math.sqrt(k * mu), h = 2e-5;
    let d = 0, dd = 1;                        // compression and its rate (closing speed 1 m/s)
    for (let i = 0; i < 400000; i++) {
      const F = Math.max(0, k * d + c * dd);
      const acc = -F / mu;
      d += dd * h; dd += acc * h;
      if (d <= 0 && i > 5) return Math.max(0, -dd);
      /* the damper can cancel the spring before the bumper is fully out: the
         force would have to pull, it cannot, so the gliders simply part here,
         moving apart at the speed they have now */
      if (F === 0 && dd < 0) return -dd;
    }
    return 0;
  }
  const ZCACHE = {};
  function zetaFor(e, mu) {
    if (e >= 0.999) return 0;
    const key = e.toFixed(3) + '|' + mu.toFixed(4);
    if (ZCACHE[key] != null) return ZCACHE[key];
    let lo = 0, hi = 3;
    for (let it = 0; it < 40; it++) { const mid = (lo + hi) / 2; if (bounceE(mid, mu) > e) lo = mid; else hi = mid; }
    return (ZCACHE[key] = (lo + hi) / 2);
  }

  /* the whole 1D experiment, run once and stored: positions, velocities,
     the contact force, and every photogate transit */
  function runTrack(p) {
    const m1 = p.m1, m2 = p.m2, mu = m1 * m2 / (m1 + m2);
    const L1 = 0.16, L2 = 0.16, bump = 0.02;              // glider bodies and bumper length
    const sticky = p.mode === 'track' && p.e < 0.01;
    const c = p.mode === 'track' ? 2 * zetaFor(Math.max(p.e, 0.01), mu) * Math.sqrt(KB * mu) : 0;
    const gates = [-0.40, 0.52];
    let x1 = p.mode === 'recoil' ? -0.10 - L1 / 2 : -0.78, x2 = p.mode === 'recoil' ? -0.10 + L2 / 2 : 0.12;
    let v1 = p.mode === 'recoil' ? 0 : p.u1, v2 = p.mode === 'recoil' ? 0 : p.u2;
    const out = { t: [], x1: [], x2: [], v1: [], v2: [], F: [], transits: [], L1: L1, L2: L2, gates: gates,
                  stuck: false, tRelease: 0.6 };
    const h = 1e-4, T = 7;
    let joined = false, t = 0, released = false;
    const block = gates.map(() => [null, null]);           // per gate, per glider: entry time
    const rest = L1 / 2 + L2 / 2 + (p.mode === 'recoil' ? 0 : 2 * bump);
    // recoil: a spring of stiffness ks compressed so it stores Es joules
    const ks = 900, xc = p.mode === 'recoil' ? Math.sqrt(2 * p.Es / ks) : 0;
    const force = (x1, x2, v1, v2) => {
      const gap = (x2 - x1) - rest;
      if (p.mode === 'recoil') {
        if (!released) return 0;
        const comp = xc - gap;                              // spring pushes while still compressed
        return comp > 0 ? ks * comp : 0;
      }
      if (gap >= 0) return 0;
      const d = -gap, dd = v1 - v2;
      return Math.max(0, KB * d + c * dd);
    };
    const deriv = (s) => { const F = force(s[0], s[1], s[2], s[3]); return [s[2], s[3], -F / m1, F / m2]; };
    let s = [x1, x2, v1, v2], k = 0, J = 0, Fprev = 0;
    const contact = [];
    while (t < T) {
      if (p.mode === 'recoil' && !released && t >= out.tRelease) released = true;
      if (joined) {
        const vc = (m1 * s[2] + m2 * s[3]) / (m1 + m2);
        s[2] = s[3] = vc; s[0] += vc * h; s[1] += vc * h;
      } else {
        const a = deriv(s), b = deriv(s.map((v, i) => v + a[i] * h / 2)),
              cc = deriv(s.map((v, i) => v + b[i] * h / 2)), d = deriv(s.map((v, i) => v + cc[i] * h));
        s = s.map((v, i) => v + h / 6 * (a[i] + 2 * b[i] + 2 * cc[i] + d[i]));
        // velcro: once the bumpers have stopped closing, they hold together
        if (sticky && (s[1] - s[0]) - rest < 0 && s[2] - s[3] <= 0) { joined = true; out.stuck = true; }
      }
      t += h;
      const F = joined ? 0 : force(s[0], s[1], s[2], s[3]);
      // the impulse, integrated at full resolution (trapezium rule on every step)
      J += 0.5 * (F + Fprev) * h;
      if (F > 0 || Fprev > 0) contact.push([t, F]);
      Fprev = F;
      // photogates: a flag of length FLAG centred on each glider
      gates.forEach((gx, gi) => {
        [s[0], s[1]].forEach((xc2, j) => {
          const inside = Math.abs(xc2 - gx) < FLAG / 2;
          if (inside && block[gi][j] == null) block[gi][j] = t;
          if (!inside && block[gi][j] != null) {
            const dt = t - block[gi][j];
            out.transits.push({ gate: gi, glider: j, t0: block[gi][j], dt: dt, v: FLAG / dt * Math.sign(j ? s[3] : s[2]) });
            block[gi][j] = null;
          }
        });
      });
      if (k % 20 === 0) {
        out.t.push(t); out.x1.push(s[0]); out.x2.push(s[1]); out.v1.push(s[2]); out.v2.push(s[3]); out.F.push(F);
      }
      k++;
      if (Math.min(s[0], s[1]) < -0.97 || Math.max(s[0], s[1]) > 0.97) break;
    }
    out.T = t;
    out.contact = contact; out.impulse = J;
    out.tc0 = contact.length ? contact[0][0] : null;
    out.tc1 = contact.length ? contact[contact.length - 1][0] : null;
    out.Fpk = contact.reduce((a, q) => Math.max(a, q[1]), 0);
    out.u1 = out.v1[0]; out.u2 = out.v2[0];
    out.w1 = out.v1[out.v1.length - 1]; out.w2 = out.v2[out.v2.length - 1];
    return out;
  }

  /* the ideal (instantaneous) answer, for comparison */
  function ideal1D(m1, m2, u1, u2, e) {
    const M = m1 + m2;
    return [((m1 - e * m2) * u1 + (1 + e) * m2 * u2) / M, ((m2 - e * m1) * u2 + (1 + e) * m1 * u1) / M];
  }

  /* ---- the air table: two pucks, a glancing hit, recorded by strobe ----
     Same soft contact as the track, acting only along the line of centres
     (the pucks are smooth), integrated in 2D. A strobe flash every 0.1 s
     records where each puck was, as the classic multiflash photograph does. */
  function runTable(p) {
    const m1 = p.m1, m2 = p.m2, mu = m1 * m2 / (m1 + m2);
    const r1 = 0.035 + 0.02 * Math.cbrt(m1), r2 = 0.035 + 0.02 * Math.cbrt(m2);
    const d0 = r1 + r2, b = clamp(p.bImp, 0, 0.95) * d0;
    const c = 2 * zetaFor(Math.max(p.e, 0.01), mu) * Math.sqrt(KB * mu);
    let s = [-0.72, b, 0.10, 0, p.u1, 0, 0, 0];          // x1 y1 x2 y2 vx1 vy1 vx2 vy2
    const force = (s) => {
      const dx = s[2] - s[0], dy = s[3] - s[1], dist = Math.hypot(dx, dy), gap = dist - d0;
      if (gap >= 0) return [0, 0, 0];
      const nx = dx / dist, ny = dy / dist;
      const closing = (s[4] - s[6]) * nx + (s[5] - s[7]) * ny;
      const F = Math.max(0, KB * (-gap) + c * closing);
      return [F * nx, F * ny, F];
    };
    const deriv = (s) => { const f = force(s); return [s[4], s[5], s[6], s[7], -f[0] / m1, -f[1] / m1, f[0] / m2, f[1] / m2]; };
    const out = { r1: r1, r2: r2, b: b, t: [], P: [], strobe: [], F: [] };
    const h = 1e-4;
    let t = 0, k = 0, nextFlash = 0;
    while (t < 6) {
      const a = deriv(s), bb = deriv(s.map((v, i) => v + a[i] * h / 2)),
            cc = deriv(s.map((v, i) => v + bb[i] * h / 2)), d = deriv(s.map((v, i) => v + cc[i] * h));
      s = s.map((v, i) => v + h / 6 * (a[i] + 2 * bb[i] + 2 * cc[i] + d[i]));
      t += h;
      if (k % 20 === 0) { out.t.push(t); out.P.push(s.slice()); out.F.push(force(s)[2]); }
      if (t >= nextFlash) { out.strobe.push(s.slice(0, 4)); nextFlash += 0.1; }
      k++;
      if (Math.abs(s[0]) > 0.86 || Math.abs(s[2]) > 0.86 || Math.abs(s[1]) > 0.56 || Math.abs(s[3]) > 0.56) break;
    }
    out.T = t;
    const f = out.P[out.P.length - 1];
    out.V1 = [f[4], f[5]]; out.V2 = [f[6], f[7]];
    const s1 = Math.hypot(f[4], f[5]), s2 = Math.hypot(f[6], f[7]);
    out.ang = s1 > 1e-4 && s2 > 1e-4 ? Math.acos(clamp((f[4] * f[6] + f[5] * f[7]) / (s1 * s2), -1, 1)) * 180 / Math.PI : null;
    out.th1 = Math.atan2(f[5], f[4]) * 180 / Math.PI; out.th2 = Math.atan2(f[7], f[6]) * 180 / Math.PI;
    out.px = m1 * f[4] + m2 * f[6]; out.py = m1 * f[5] + m2 * f[7];
    out.K0 = 0.5 * m1 * p.u1 * p.u1; out.K1 = 0.5 * m1 * s1 * s1 + 0.5 * m2 * s2 * s2;
    return out;
  }

  /* ---- the Blackwood ballistic pendulum: a spring gun fires a steel ball
     into a catcher on a light rod; a pawl on the pendulum rides a toothed
     arc and locks at the highest point, so the height can be read after ---- */
  function runBallistic(p) {
    const m = p.mBul, M = p.mBlk, L = p.Lstr, g = 9.81;
    const v = m * p.uBul / (m + M);
    let th = 0, om = v / L, t = 0;
    const out = { v: v, th: [], t: [], thMax: 0 };
    const h = 5e-4;
    while (t < 3) {
      const f = (a, b) => [b, -(g / L) * Math.sin(a)];
      const k1 = f(th, om), k2 = f(th + k1[0] * h / 2, om + k1[1] * h / 2), k3 = f(th + k2[0] * h / 2, om + k2[1] * h / 2),
            k4 = f(th + k3[0] * h, om + k3[1] * h);
      const thN = th + h / 6 * (k1[0] + 2 * k2[0] + 2 * k3[0] + k4[0]), omN = om + h / 6 * (k1[1] + 2 * k2[1] + 2 * k3[1] + k4[1]);
      t += h;
      if (omN <= 0) { out.thMax = th; out.tMax = t; break; }       // the pawl catches it here
      th = thN; om = omN;
      out.t.push(t); out.th.push(th);
      if (th > Math.PI * 0.98) { out.over = true; out.thMax = th; out.tMax = t; break; }
    }
    out.h = L * (1 - Math.cos(out.thMax));
    return out;
  }

  function ballR(m) { return 0.11 * Math.cbrt(Math.max(m, 0.05) / 2); }

  function collide(S) {
    const p = S.p, g = G;
    const R = { mode: p.mode };

    if (p.mode === 'head1d' || p.mode === 'oblique') {
      const m1 = p.m1, m2 = p.m2, M = m1 + m2, mu = m1 * m2 / M;
      const e = clamp(p.e, 0, 1);
      R.m1 = m1; R.m2 = m2; R.M = M; R.mu = mu; R.e = e;
      R.r1 = ballR(m1); R.r2 = ballR(m2);
      const d = R.r1 + R.r2;
      /* Ball 2 runs along the axis; ball 1 is offset by the impact parameter.
         For a head-on collision that offset is zero, which is not a special
         case but the same algebra with b = 0. */
      const b = p.mode === 'oblique' ? clamp(p.bImp, -0.95, 0.95) * d : 0;
      const nx = Math.sqrt(Math.max(d * d - b * b, 1e-12)) / d, ny = -b / d;
      R.b = b; R.d = d; R.n = [nx, ny];
      const U1 = [p.u1, 0], U2 = [p.u2, 0];
      /* Only the component along the line of centres is touched: a smooth
         sphere has no way to change the tangential component, because the
         contact force is normal to both surfaces. */
      const u1n = U1[0] * nx + U1[1] * ny, u2n = U2[0] * nx + U2[1] * ny;
      const v1n = ((m1 - e * m2) * u1n + (1 + e) * m2 * u2n) / M;
      const v2n = ((m2 - e * m1) * u2n + (1 + e) * m1 * u1n) / M;
      const V1 = [U1[0] + (v1n - u1n) * nx, U1[1] + (v1n - u1n) * ny];
      const V2 = [U2[0] + (v2n - u2n) * nx, U2[1] + (v2n - u2n) * ny];
      R.U1 = U1; R.U2 = U2; R.V1 = V1; R.V2 = V2;
      R.vcom = [(m1 * U1[0] + m2 * U2[0]) / M, (m1 * U1[1] + m2 * U2[1]) / M];
      R.approach = u1n - u2n;                       // closing speed along n
      R.separate = v2n - v1n;                       // and the separating speed
      R.willHit = R.approach > 1e-9;
      /* The impulse each ball receives: equal and opposite, always. */
      R.J = (1 + e) * mu * R.approach;
      R.p0 = m1 * U1[0] + m2 * U2[0];
      R.p1 = m1 * V1[0] + m2 * V2[0];
      R.py0 = m1 * U1[1] + m2 * U2[1];
      R.py1 = m1 * V1[1] + m2 * V2[1];
      R.K0 = 0.5 * m1 * (U1[0] * U1[0] + U1[1] * U1[1]) + 0.5 * m2 * (U2[0] * U2[0] + U2[1] * U2[1]);
      R.K1 = 0.5 * m1 * (V1[0] * V1[0] + V1[1] * V1[1]) + 0.5 * m2 * (V2[0] * V2[0] + V2[1] * V2[1]);
      /* The energy that can be lost is exactly the kinetic energy of the
         relative motion along n: nothing else is available to lose. */
      R.dK = 0.5 * mu * (1 - e * e) * R.approach * R.approach;
      R.Kcom = 0.5 * M * (R.vcom[0] * R.vcom[0] + R.vcom[1] * R.vcom[1]);
      R.Krel = R.K0 - R.Kcom;
      const s1 = Math.hypot(V1[0], V1[1]), s2 = Math.hypot(V2[0], V2[1]);
      R.sp1 = s1; R.sp2 = s2;
      R.ang = (s1 > 1e-6 && s2 > 1e-6)
        ? Math.acos(clamp((V1[0] * V2[0] + V1[1] * V2[1]) / (s1 * s2), -1, 1)) * 180 / Math.PI
        : null;
      R.th1 = Math.atan2(V1[1], V1[0]) * 180 / Math.PI;
      R.th2 = Math.atan2(V2[1], V2[0]) * 180 / Math.PI;
      return R;
    }

    if (p.mode === 'ballistic') {
      /* A ballistic pendulum is two problems bolted together, and the whole
         trick is knowing where one ends: momentum for the embedding (fast,
         violent, energy lost), energy for the swing (slow, smooth, energy
         kept). Use energy for the first and you are out by a factor of
         (M+m)/m, which for a bullet is a factor of a few hundred. */
      const mB = p.mBul, Mb = p.mBlk, L = p.Lstr;
      const v = mB * p.uBul / (mB + Mb);
      const h = v * v / (2 * g);
      const cosT = 1 - h / L;
      R.mB = mB; R.Mb = Mb; R.L = L; R.v = v; R.h = h;
      R.overTop = h > 2 * L;
      R.theta = Math.acos(clamp(cosT, -1, 1)) * 180 / Math.PI;
      R.omega0 = v / L;
      R.K0 = 0.5 * mB * p.uBul * p.uBul;
      R.K1 = 0.5 * (mB + Mb) * v * v;
      R.dK = R.K0 - R.K1;
      R.kept = R.K1 / Math.max(R.K0, 1e-12);        // = m/(M+m), exactly
      R.p0 = mB * p.uBul; R.p1 = (mB + Mb) * v;
      /* run the measurement backwards, which is what the experiment is for */
      R.uFromAngle = (1 + Mb / mB) * Math.sqrt(2 * g * L * (1 - Math.cos(R.theta * Math.PI / 180)));
      return R;
    }

    /* ---- burst: a projectile that explodes in flight ---- */
    {
      const m = p.mProj, f = clamp(p.fSplit, 0.05, 0.95);
      const m1f = f * m, m2f = (1 - f) * m, muf = m1f * m2f / m;
      const a = p.alpha * Math.PI / 180;
      const vx = p.u0 * Math.cos(a), vy0 = p.u0 * Math.sin(a);
      const tA = vy0 / g, xA = vx * tA, zA = vy0 * vy0 / (2 * g);
      const w = Math.sqrt(2 * p.Q / muf);
      const bt = p.beta * Math.PI / 180;
      const wv = [w * Math.cos(bt), w * Math.sin(bt)];
      /* v1 = vcom + (m2/m)w and v2 = vcom − (m1/m)w satisfy both books at
         once: the momenta add back to m·vcom, and the relative velocity is w. */
      const V1 = [vx + (m2f / m) * wv[0], (m2f / m) * wv[1]];
      const V2 = [vx - (m1f / m) * wv[0], -(m1f / m) * wv[1]];
      const fall = (vz) => (vz + Math.sqrt(vz * vz + 2 * g * zA)) / g;
      const t1 = fall(V1[1]), t2 = fall(V2[1]);
      R.m = m; R.m1 = m1f; R.m2 = m2f; R.mu = muf; R.w = w;
      R.vx = vx; R.vy0 = vy0; R.tA = tA; R.xA = xA; R.zA = zA;
      R.V1 = V1; R.V2 = V2; R.t1 = t1; R.t2f = t2;
      R.x1 = xA + V1[0] * t1; R.x2 = xA + V2[0] * t2;
      R.range = p.u0 * p.u0 * Math.sin(2 * a) / g;
      R.xMean = (m1f * R.x1 + m2f * R.x2) / m;
      R.together = Math.abs(V1[1] - V2[1]) < 1e-9;  // same flight time?
      R.K0 = 0.5 * m * vx * vx;
      R.K1 = 0.5 * m1f * (V1[0] * V1[0] + V1[1] * V1[1]) +
             0.5 * m2f * (V2[0] * V2[0] + V2[1] * V2[1]);
      R.dK = R.K1 - R.K0;                            // energy ADDED, this time
      R.p0 = m * vx; R.p1 = m1f * V1[0] + m2f * V2[0];
      R.tEnd = Math.max(t1, t2);
      return R;
    }
  }

  /* Where everything is at simulated time t. The collision instant is solved
     for, not stepped up to, so the impulse lands exactly on contact however
     coarse the frame rate is. */
  function posAt(S, t) {
    const p = S.p, R = S.R;
    if (p.mode === 'head1d' || p.mode === 'oblique') {
      const tc = S.tc;
      const hit = isFinite(tc) && t >= tc;
      const b = R.b;
      const x10 = S.x10, x20 = S.x20;
      const P1 = hit ? [S.hx1 + R.V1[0] * (t - tc), b + R.V1[1] * (t - tc)]
                     : [x10 + R.U1[0] * t, b];
      const P2 = hit ? [S.hx2 + R.V2[0] * (t - tc), R.V2[1] * (t - tc)]
                     : [x20 + R.U2[0] * t, 0];
      const M = R.M;
      const C = [(R.m1 * P1[0] + R.m2 * P2[0]) / M, (R.m1 * P1[1] + R.m2 * P2[1]) / M];
      return { P1: P1, P2: P2, C: C, hit: hit };
    }
    if (p.mode === 'ballistic') return null;
    const g = G, R2 = S.R;
    if (t < R2.tA) {
      return { one: [R2.vx * t, R2.vy0 * t - 0.5 * g * t * t], burst: false };
    }
    const s = t - R2.tA;
    const fly = (V, tt) => [R2.xA + V[0] * tt, R2.zA + V[1] * tt - 0.5 * g * tt * tt];
    const s1 = Math.min(s, R2.t1), s2 = Math.min(s, R2.t2f);
    const A = fly(R2.V1, s1), B = fly(R2.V2, s2);
    const C = [(R2.m1 * A[0] + R2.m2 * B[0]) / R2.m, (R2.m1 * A[1] + R2.m2 * B[1]) / R2.m];
    return { A: A, B: B, C: C, burst: true, down1: s >= R2.t1, down2: s >= R2.t2f };
  }

  /* the COM-frame momenta, before and after: always equal and opposite */
  function comFrame(S) {
    const p = S.p, R = S.R;
    if (p.mode === 'head1d' || p.mode === 'oblique') {
      const c = R.vcom;
      const rel = (m, V) => [m * (V[0] - c[0]), m * (V[1] - c[1])];
      return { pre: [rel(R.m1, R.U1), rel(R.m2, R.U2)], post: [rel(R.m1, R.V1), rel(R.m2, R.V2)],
               tags: ['m₁', 'm₂'] };
    }
    if (p.mode === 'ballistic') {
      const v = R.v;
      return { pre: [[R.mB * (p.uBul - v), 0], [R.Mb * (0 - v), 0]], post: [[0, 0], [0, 0]],
               tags: ['bullet', 'block'] };
    }
    const vx = R.vx;
    return { pre: [[0, 0], [0, 0]],
             post: [[R.m1 * (R.V1[0] - vx), R.m1 * R.V1[1]], [R.m2 * (R.V2[0] - vx), R.m2 * R.V2[1]]],
             tags: ['piece 1', 'piece 2'] };
  }


  /* the air-track surface: brushed aluminium drilled with rows of air holes */
  let TRACK_TEX = null;
  function trackTex() {
    if (TRACK_TEX || typeof document === 'undefined') return TRACK_TEX;
    const base = window.BENCH.metal('#B7C2D2', 17), c = document.createElement('canvas');
    c.width = base.width * 2; c.height = base.height;
    const x = c.getContext('2d');
    x.drawImage(base, 0, 0); x.drawImage(base, base.width, 0);
    x.fillStyle = 'rgba(20,24,32,.75)';
    for (let i = 0; i < 64; i++) for (let j = 0; j < 2; j++) {
      x.beginPath(); x.arc(8 + i * (c.width - 16) / 63, c.height * (0.35 + j * 0.3), 2.2, 0, TAU); x.fill();
    }
    return (TRACK_TEX = c);
  }

  L.register({
    id: 'collisions', subject: 'physics',
    name: 'Collisions — Air Track, Photogates and the Centre of Mass',
    chapter: 'System of Particles · Centre of Mass',
    exams: ['JEE Main', 'JEE Advanced', 'NEET UG'],
    weight: 'Very high yield',
    is3D: true,
    stageHint: 'Drag the ringed handle to change the speed · the glowing marker is the centre of mass',
    lede: 'Gliders float on an <b>air track</b>, so there is no friction to argue about. Each carries a ' +
      '<b>spring bumper</b>, and the collision is not an instant: the bumpers squeeze and spring back over ' +
      'about 30 ms, and the lab integrates that force step by step. The <b>impulse</b> is the area under ' +
      'the force–time curve, and it equals the change in momentum. <b>Photogates</b> time a 10 cm flag ' +
      'through their beams, v = L/Δt, as in the practical, and the momentum book is kept from those ' +
      'readings. The same bench fires two gliders apart with a spring (an explosion run backwards), ' +
      'fires a ball into a ballistic pendulum, and records a glancing collision on an air table by strobe.',

    params: { mode: 'track', m1: 0.4, m2: 0.4, u1: 0.6, u2: 0, e: 1, bImp: 0.5, Es: 0.3,
              mBul: 0.066, mBlk: 0.25, uBul: 5, Lstr: 0.30,
              mProj: 2, u0: 20, alpha: 45, fSplit: 0.5, Q: 200, beta: 180,
              showCOM: true, run: true },

    presets: [
      { name: 'Elastic · equal gliders swap', params: { mode: 'track', m1: 0.4, m2: 0.4, u1: 0.6, u2: 0, e: 1 } },
      { name: 'Bouncy · e = 0.5', params: { mode: 'track', m1: 0.4, m2: 0.4, u1: 0.6, u2: 0, e: 0.5 } },
      { name: 'Velcro · they stick', params: { mode: 'track', m1: 0.4, m2: 0.4, u1: 0.6, u2: 0, e: 0 } },
      { name: 'Light hits heavy', params: { mode: 'track', m1: 0.2, m2: 0.8, u1: 0.7, u2: 0, e: 1 } },
      { name: 'Head-on, both moving', params: { mode: 'track', m1: 0.5, m2: 0.5, u1: 0.6, u2: -0.4, e: 0.7 } },
      { name: 'Spring recoil (explosion)', params: { mode: 'recoil', m1: 0.4, m2: 0.8, Es: 0.3 } },
      { name: 'Air table · 90° split', params: { mode: 'airtable', m1: 0.2, m2: 0.2, u1: 0.5, e: 1, bImp: 0.5 } },
      { name: 'Air table · inelastic', params: { mode: 'airtable', m1: 0.2, m2: 0.2, u1: 0.5, e: 0.5, bImp: 0.5 } },
      { name: 'Ballistic pendulum', params: { mode: 'ballistic', mBul: 0.066, mBlk: 0.25, uBul: 5, Lstr: 0.3 } },
      { name: 'Shell bursts · one piece drops', params: { mode: 'burst', mProj: 2, u0: 20, alpha: 45, fSplit: 0.5, Q: 200, beta: 180 } }
    ],

    controls: [
      { group: 'Arrangement', items: [
        { key: 'mode', type: 'select', label: 'What is on the bench', restructure: true, options: [
          { value: 'track', label: 'Air track' }, { value: 'recoil', label: 'Recoil' },
          { value: 'airtable', label: 'Air table' }, { value: 'ballistic', label: 'Ballistic' },
          { value: 'burst', label: 'Explosion' }] }
      ] },
      { group: 'The gliders', items: [
        { key: 'm1', label: 'Mass <i>m</i>₁', min: 0.1, max: 2, step: 0.01, unit: 'kg', fmt: v => v.toFixed(2), restructure: true },
        { key: 'm2', label: 'Mass <i>m</i>₂', min: 0.1, max: 2, step: 0.01, unit: 'kg', fmt: v => v.toFixed(2), restructure: true },
        { key: 'u1', label: 'Velocity <i>u</i>₁', min: -1.2, max: 1.2, step: 0.01, unit: 'm/s', fmt: v => v.toFixed(2), restructure: true },
        { key: 'u2', label: 'Velocity <i>u</i>₂', min: -1.2, max: 1.2, step: 0.01, unit: 'm/s', fmt: v => v.toFixed(2), restructure: true }
      ] },
      { group: 'The bumpers', items: [
        { key: 'e', label: 'Restitution <i>e</i> (0 = velcro)', min: 0, max: 1, step: 0.01, unit: '', fmt: v => v.toFixed(2), restructure: true },
        { key: 'bImp', label: 'Air table offset <i>b</i> ÷ (<i>r</i>₁+<i>r</i>₂)', min: 0, max: 0.9, step: 0.01, unit: '', fmt: v => v.toFixed(2), restructure: true },
        { key: 'Es', label: 'Recoil spring energy', min: 0.02, max: 1.5, step: 0.01, unit: 'J', fmt: v => v.toFixed(2), restructure: true }
      ] },
      { group: 'Ballistic pendulum', items: [
        { key: 'mBul', label: 'Steel ball', min: 0.01, max: 0.2, step: 0.001, unit: 'g', fmt: v => (v * 1000).toFixed(0), restructure: true },
        { key: 'mBlk', label: 'Catcher', min: 0.05, max: 1.5, step: 0.005, unit: 'kg', fmt: v => v.toFixed(3), restructure: true },
        { key: 'uBul', label: 'Launch speed', min: 1, max: 10, step: 0.05, unit: 'm/s', fmt: v => v.toFixed(2), restructure: true },
        { key: 'Lstr', label: 'Arm length', min: 0.15, max: 0.5, step: 0.01, unit: 'm', fmt: v => v.toFixed(2), restructure: true }
      ] },
      { group: 'Explosion in flight', items: [
        { key: 'mProj', label: 'Shell mass', min: 0.5, max: 20, step: 0.1, unit: 'kg', fmt: v => v.toFixed(1), restructure: true },
        { key: 'u0', label: 'Launch speed', min: 5, max: 60, step: 0.5, unit: 'm/s', fmt: v => v.toFixed(1), restructure: true },
        { key: 'alpha', label: 'Launch angle', min: 10, max: 80, step: 0.5, unit: '°', fmt: v => v.toFixed(1), restructure: true },
        { key: 'fSplit', label: 'Piece 1 share of mass', min: 0.05, max: 0.95, step: 0.01, unit: '', fmt: v => v.toFixed(2), restructure: true },
        { key: 'Q', label: 'Energy released <i>Q</i>', min: 0, max: 3000, step: 1, unit: 'J', fmt: v => v.toFixed(0), restructure: true },
        { key: 'beta', label: 'Split direction', min: -180, max: 180, step: 1, unit: '°', fmt: v => v.toFixed(0), restructure: true }
      ] },
      { group: 'Display', items: [
        { key: 'showCOM', type: 'toggle', label: 'Show the centre of mass' },
        { key: 'run', type: 'toggle', label: 'Let it run' }
      ] }
    ],

    setup(S) {
      const p = S.p;
      S.t2 = 0; S.flash = -1; S.slow = 1;
      if (p.mode === 'track' || p.mode === 'recoil') {
        const r = runTrack(p);
        S.run = r; S.tEnd = r.T + 0.8;
        const m1 = p.m1, m2 = p.m2;
        // the book, from the photogate readings: first transit of each glider, and the last
        const tr = r.transits;
        const first = j => tr.find(q => q.glider === j), last = j => { const a = tr.filter(q => q.glider === j); return a[a.length - 1]; };
        const ok = (q, t) => q && (t == null || q.t0 > t);
        const tc = r.tc1 != null ? r.tc1 : (p.mode === 'recoil' ? r.tRelease : Infinity);
        const g1 = first(0), g2 = first(1), h1 = last(0), h2 = last(1);
        S.R = {
          m1: m1, m2: m2, u1: r.u1, u2: r.u2, w1: r.w1, w2: r.w2,
          gU1: ok(g1) && g1.t0 < tc ? g1.v : (p.mode === 'recoil' ? 0 : null), gU2: ok(g2) && g2.t0 < tc ? g2.v : (Math.abs(r.u2) < 1e-9 ? 0 : null),
          gW1: ok(h1, tc) ? h1.v : (Math.abs(r.w1) < 0.005 ? 0 : null), gW2: ok(h2, tc) ? h2.v : null,
          J: r.impulse, tcon: r.tc1 != null ? r.tc1 - r.tc0 : 0, Fpk: r.Fpk, stuck: r.stuck
        };
        const R = S.R;
        R.p0 = m1 * r.u1 + m2 * r.u2; R.p1 = m1 * r.w1 + m2 * r.w2;
        R.K0 = 0.5 * m1 * r.u1 * r.u1 + 0.5 * m2 * r.u2 * r.u2;
        R.K1 = 0.5 * m1 * r.w1 * r.w1 + 0.5 * m2 * r.w2 * r.w2;
        R.dK = p.mode === 'recoil' ? R.K1 - R.K0 : R.K0 - R.K1;
        /* round away integrator residue (≈1e-7 J) so an elastic collision
           reads 0, not −0.0000; likewise velocities that are really zero */
        const fz = v => (Math.abs(v) < 5e-5 ? 0 : v);
        R.dK = Math.abs(R.dK) < 1e-5 * Math.max(R.K0, 1e-9) + 1e-7 ? 0 : R.dK;
        R.w1 = fz(R.w1); R.w2 = fz(R.w2); R.u1 = fz(R.u1); R.u2 = fz(R.u2);
        ['gU1', 'gU2', 'gW1', 'gW2'].forEach(k => { if (R[k] != null) R[k] = fz(R[k]); });
        R.eMeas = Math.abs(r.u1 - r.u2) > 1e-6 ? (r.w2 - r.w1) / (r.u1 - r.u2) : null;
        R.vcom = (m1 * r.u1 + m2 * r.u2) / (m1 + m2);
        R.ideal = ideal1D(m1, m2, r.u1, r.u2, p.e);
      } else if (p.mode === 'airtable') {
        const r = runTable(p);
        S.run = r; S.tEnd = r.T + 0.8;
        S.R = { m1: p.m1, m2: p.m2, ang: r.ang, px: r.px, py: r.py, p0: p.m1 * p.u1, p1: r.px, K0: r.K0, K1: r.K1,
                dK: r.K0 - r.K1, V1: r.V1, V2: r.V2, th1: r.th1, th2: r.th2 };
      } else if (p.mode === 'ballistic') {
        S.R = collide(S); S.bal = runBallistic(p);
        S.tFly = 0.45; S.tEnd = S.tFly + (S.bal.tMax || 1) + 1.6;
      } else {
        S.R = collide(S);
        const R = S.R;
        const zTop = (V) => R.zA + (V[1] > 0 ? V[1] * V[1] / (2 * G) : 0);
        const xs = [0, R.range, R.x1, R.x2];
        const xmin = Math.min(...xs), xmax = Math.max(...xs);
        const zmax = Math.max(R.zA, zTop(R.V1), zTop(R.V2), 1e-3);
        S.k = Math.min(2.7 / Math.max(xmax - xmin, 1e-3), 1.25 / zmax);
        S.xo = (xmin + xmax) / 2;
        S.tEnd = R.tA + R.tEnd + 0.6; S.slow = 0.9;
      }
      const views = {
        track: { theta: -1.42, phi: 0.26, dist: 1.55, target: [-0.02, 0, 0.12] },
        recoil: { theta: -1.42, phi: 0.26, dist: 1.5, target: [-0.05, 0, 0.12] },
        airtable: { theta: -1.54, phi: 0.98, dist: 1.55, target: [-0.05, 0, 0.66] },
        ballistic: { theta: -1.30, phi: 0.18, dist: 1.6, target: [-0.1, 0, 0.26] },
        burst: { theta: -1.54, phi: 0.14, dist: 2.7, target: [0, 0, 0.30] }
      };
      if (!S.cam || S._viewMode !== p.mode) {
        S.cam = Camera(views[p.mode]); S.cam.minDist = 1.0; S.cam.maxDist = 12; S._viewMode = p.mode;
      }
      if (p.mode === 'burst') S.cam.target[2] = -0.03 + 0.5 * S.k * Math.max(S.R.zA, 0.2 / S.k) - 0.08;
    },

    step(S, dt) {
      const p = S.p;
      if (!p.run) return;
      const was = S.t2;
      S.t2 += dt * S.slow;
      if ((p.mode === 'track' || p.mode === 'recoil') && S.run.tc0 != null && was < S.run.tc0 && S.t2 >= S.run.tc0) S.flash = S.t2;
      if (p.mode === 'recoil' && was < S.run.tRelease && S.t2 >= S.run.tRelease) S.flash = S.t2;
      if (p.mode === 'ballistic' && was < S.tFly && S.t2 >= S.tFly) S.flash = S.t2;
      if (p.mode === 'burst' && was < S.R.tA && S.t2 >= S.R.tA) S.flash = S.t2;
      if (S.t2 > S.tEnd) { S.t2 = 0; S.flash = -1; }
    },

    drawStage(S, g) {
      const ctx = g.ctx, th = g.theme, p = S.p, W = g.w, H = g.h, R = S.R;
      const cam = S.cam, B = window.BENCH, acc = th.phys;
      const benchTop = -0.03;
      const F = R3.Frame(ctx, cam, { ambient: 0.28, floorZ: null });
      const col1 = '#F29A4A', col2 = '#4A9AF2', comCol = '#F5E663';
      const t = S.t2;
      const flashOn = S.flash >= 0 && t - S.flash < 0.18 && t >= S.flash;
      let flashAt = null, hdl = null;
      const idx = (arr) => Math.min(arr.length - 1, Math.max(0, Math.round(t / 0.002)));
      const vArrow = (from, v, colour, tag, k) => {
        const L0 = Math.hypot(v[0], v[1]);
        if (L0 < 0.005) return;
        const s = k || 0.25;
        const to = [from[0] + v[0] * s, from[1] + v[1] * s, from[2]];
        R3.arrow(F, from, to, 0.006, colour, { head: 0.03, shadow: false, ambient: 0.85, bias: -0.04 });
        R3.label(F, [to[0] + (v[0] >= 0 ? 0.04 : -0.04), to[1], to[2] + 0.04], tag + ' = ' + L0.toFixed(2) + ' m/s', colour, { size: 9.5 });
      };

      if (p.mode === 'track' || p.mode === 'recoil') {
        const r = S.run, i = idx(r.t), zT = 0.135;
        B.table(F, -1.15, 1.15, -0.42, 0.42, 0, { legH: 0.69 });
        // the track on its two stands, with the blower hose at the left end
        [-0.72, 0.72].forEach(x => R3.box(F, [x, 0, 0.05], [0.08, 0.16, 0.10], '#3A4458', { shadow: false, ambient: 0.35 }));
        B.texBox(F, [0, 0, zT - 0.035], [2.0, 0.09, 0.07], trackTex() || B.metal('#B7C2D2', 17), { ambient: 0.5 });
        [-1.0, 1.0].forEach(x => R3.box(F, [x, 0, zT + 0.01], [0.02, 0.1, 0.06], '#1E2230', { shadow: false }));
        R3.tube(F, [[-1.0, 0, zT - 0.03], [-1.08, 0, zT - 0.05], [-1.1, 0.2, 0.02]], 0.018, '#2A2F3A', { segments: 10 });
        R3.box(F, [-1.05, 0.30, 0.07], [0.16, 0.14, 0.14], '#4A5570', { shadow: false, ambient: 0.35 });
        B.rule(F, [-0.95, -0.075, zT - 0.066], [1, 0, 0], 1.9, { width: 0.035 });
        // photogates, each with its beam, blocked when a flag is in it
        const x1 = r.x1[i], x2 = r.x2[i];
        r.gates.forEach((gx, gi) => {
          const blocked = Math.abs(x1 - gx) < FLAG / 2 || Math.abs(x2 - gx) < FLAG / 2;
          B.photogate(F, [gx, 0, zT + 0.005], [0, 1, 0], 0.20, { blocked: blocked, height: 0.20, beamZ: 0.105 });
          R3.label(F, [gx, 0.14, zT + 0.24], 'gate ' + 'AB'[gi], '#FF8B8B', { size: 9 });
        });
        // the gliders: an anodised body, a flag on top, and a bumper or velcro on the facing ends
        const glider = (x, colour, tag, m, face) => {
          const zc = zT + 0.018 + 0.025;
          R3.box(F, [x, 0, zc], [r.L1, 0.11, 0.05], colour, { shadow: false, ambient: 0.45 });
          R3.box(F, [x, 0, zc + 0.065], [FLAG, 0.004, 0.08], '#15181F', { shadow: false, ambient: 0.35 });
          const nDisc = Math.max(0, Math.min(6, Math.round((m - 0.2) / 0.1)));
          for (let k = 0; k < nDisc; k++)
            [-1, 1].forEach(sd => R3.cylinder(F, [x, sd * 0.07, zc - 0.01 + k * 0.012], [x, sd * (0.07 + 0.004), zc - 0.01 + k * 0.012],
                                             0.018, '#B8903F', { segments: 14, shadow: false, caps: true }));
          R3.label(F, [x, -0.07, zc + 0.14], tag + ' = ' + m.toFixed(2) + ' kg', colour, { size: 9.5 });
          return zc;
        };
        const zc = glider(x1, col1, 'm₁', p.m1, 1);
        glider(x2, col2, 'm₂', p.m2, -1);
        const gapNow = (x2 - x1) - (r.L1 / 2 + r.L2 / 2);
        if (p.mode === 'track') {
          if (p.e < 0.01) {
            // velcro pads
            R3.box(F, [x1 + r.L1 / 2 + 0.006, 0, zc], [0.012, 0.08, 0.04], '#2D3A28', { shadow: false });
            R3.box(F, [x2 - r.L2 / 2 - 0.006, 0, zc], [0.012, 0.08, 0.04], '#2D3A28', { shadow: false });
          } else {
            // spring bumpers, compressed by exactly the overlap the physics computed
            const half = Math.max(0.004, Math.min(0.02, gapNow / 2));
            B.spring(F, [x1 + r.L1 / 2, 0, zc], [x1 + r.L1 / 2 + half, 0, zc], 0.012, 5, { wire: 0.0022 });
            B.spring(F, [x2 - r.L2 / 2 - half, 0, zc], [x2 - r.L2 / 2, 0, zc], 0.012, 5, { wire: 0.0022 });
          }
        } else {
          // recoil: one spring between them, held compressed by a thread until it is burned
          const released = t >= r.tRelease;
          const len = Math.max(0.01, gapNow);
          if (!released || len < 0.2) B.spring(F, [x1 + r.L1 / 2, 0, zc], [x1 + r.L1 / 2 + Math.min(len, 0.2), 0, zc], 0.014, 7, { wire: 0.0025 });
          if (!released) R3.polyline(F, [[x1, 0.056, zc + 0.02], [x2, 0.056, zc + 0.02]], '#FF5A5A', { alpha: .95, width: 1.6, bias: -0.02 });
          if (flashOn) flashAt = [(x1 + x2) / 2, 0.06, zc + 0.02];
          R3.label(F, [(x1 + x2) / 2, 0.1, zc + 0.2], released ? 'thread burned — spring released' : 'thread holds the spring compressed',
                   released ? th.warn : th['text-2'], { size: 9.5 });
        }
        if (flashOn && p.mode === 'track') flashAt = [(x1 + x2) / 2, 0, zc];
        const V1 = r.v1[i], V2 = r.v2[i];
        vArrow([x1, 0, zc + 0.17], [V1, 0], col1, 'v₁');
        vArrow([x2, 0, zc + 0.23], [V2, 0], col2, 'v₂');
        if (p.showCOM) {
          const xc = (p.m1 * x1 + p.m2 * x2) / (p.m1 + p.m2), x0c = (p.m1 * r.x1[0] + p.m2 * r.x2[0]) / (p.m1 + p.m2);
          R3.polyline(F, [[x0c, 0, zT + 0.30], [xc, 0, zT + 0.30]], comCol, { alpha: .85, width: 1.6, dash: [6, 4], bias: -0.02 });
          R3.sphere(F, [xc, 0, zT + 0.30], 0.014, comCol, { shadow: false, vivid: true });
          R3.label(F, [xc, 0, zT + 0.35], 'CM ' + R.vcom.toFixed(3) + ' m/s', comCol, { size: 9 });
        }
        // the timer box: the last transit at each gate
        const lastAt = (gi) => { const a = r.transits.filter(q => q.gate === gi && q.t0 + q.dt <= t); return a[a.length - 1]; };
        [0, 1].forEach(gi => {
          const q = lastAt(gi);
          B.meter(F, [r.gates[gi], 0.30, 0.16], [0, -1, 0], 0.28, 0.13,
                  { title: 'GATE ' + 'AB'[gi] + (q ? ' · glider ' + (q.glider + 1) : ''), value: q ? q.dt.toFixed(4) : '—.————', unit: 's',
                    colour: q ? (q.glider ? '#9AD0FF' : '#FFC08A') : '#7CF0B0' });
          R3.box(F, [r.gates[gi], 0.32, 0.05], [0.03, 0.03, 0.1], '#3A4458', { shadow: false });
        });
        const qh = cam.project([x1, 0, zc]);
        if (qh.ok && p.mode === 'track') {
          hdl = { x: qh.x, y: qh.y, r: 14, tip: 'drag for u₁' };
          const qb = cam.project([x1 + 1, 0, zc]);
          if (qb.ok) { const dx = qb.x - qh.x, dy = qb.y - qh.y, Lp = Math.hypot(dx, dy) || 1; S._axU = { ux: dx / Lp, uy: dy / Lp }; }
        }
      }

      else if (p.mode === 'airtable') {
        const r = S.run, i = idx(r.t), P = r.P[i], zT = 0.72;
        // a glass-topped air table on a frame
        R3.box(F, [0, 0, zT - 0.05], [1.9, 1.3, 0.08], '#2B3448', { shadow: false, ambient: 0.3, bias: F.GROUND });
        [[-0.85, -0.55], [0.85, -0.55], [-0.85, 0.55], [0.85, 0.55]].forEach(q =>
          R3.box(F, [q[0], q[1], (zT - 0.09) / 2], [0.06, 0.06, zT - 0.09], '#3A4458', { shadow: false, ambient: 0.3, bias: F.GROUND }));
        R3.plane(F, [-0.9, -0.6, zT - 0.008], [1.8, 0, 0], [0, 1.2, 0], '#2E4A66', { grid: 18, gridAlpha: 0.18, bias: F.GROUND });
        // the strobe record so far: faint rings where each puck was at each flash
        const flashes = r.strobe.filter((q, k) => k * 0.1 <= t);
        F.push([0, 0, zT], () => {
          ctx.save();
          flashes.forEach(q => {
            [[q[0], q[1], r.r1, col1], [q[2], q[3], r.r2, col2]].forEach(d => {
              ctx.strokeStyle = g.alpha(d[3], 0.5); ctx.lineWidth = 1.2;
              ctx.beginPath();
              for (let k = 0; k <= 24; k++) {
                const a = k / 24 * TAU, qq = cam.project([d[0] + Math.cos(a) * d[2], d[1] + Math.sin(a) * d[2], zT]);
                k ? ctx.lineTo(qq.x, qq.y) : ctx.moveTo(qq.x, qq.y);
              }
              ctx.stroke();
              const c = cam.project([d[0], d[1], zT]);
              ctx.fillStyle = g.alpha(d[3], 0.8); ctx.beginPath(); ctx.arc(c.x, c.y, 1.8, 0, TAU); ctx.fill();
            });
          });
          ctx.restore();
        }, -0.01);
        // the pucks
        R3.cylinder(F, [P[0], P[1], zT], [P[0], P[1], zT + 0.022], r.r1, col1, { segments: 30, shadow: false, ambient: 0.45 });
        R3.cylinder(F, [P[2], P[3], zT], [P[2], P[3], zT + 0.022], r.r2, col2, { segments: 30, shadow: false, ambient: 0.45 });
        R3.label(F, [P[0], P[1], zT + 0.07], 'm₁', col1, { size: 10 });
        R3.label(F, [P[2], P[3], zT + 0.07], 'm₂', col2, { size: 10 });
        const fAt = r.F.findIndex(v => v > 0);
        if (fAt >= 0 && i >= fAt) {
          const q = r.P[fAt], nx = q[2] - q[0], ny = q[3] - q[1], nl = Math.hypot(nx, ny);
          R3.polyline(F, [[q[0] - nx / nl * 0.1, q[1] - ny / nl * 0.1, zT + 0.002], [q[2] + nx / nl * 0.4, q[3] + ny / nl * 0.4, zT + 0.002]],
                      th.text, { alpha: .5, width: 1.1, dash: [5, 4], bias: -0.02 });
          if (flashOn || (r.t[i] - r.t[fAt] < 0.12 && r.t[i] >= r.t[fAt])) flashAt = [(q[0] + q[2]) / 2, (q[1] + q[3]) / 2, zT + 0.02];
          if (R.ang != null && i > fAt + 30)
            R3.label(F, [q[2] + 0.05, q[3] + 0.12, zT + 0.05], 'paths ' + R.ang.toFixed(1) + '° apart', comCol, { size: 10.5 });
        }
        if (p.showCOM) {
          const cx = (p.m1 * P[0] + p.m2 * P[2]) / (p.m1 + p.m2), cy = (p.m1 * P[1] + p.m2 * P[3]) / (p.m1 + p.m2);
          const c0 = r.P[0], x0 = (p.m1 * c0[0] + p.m2 * c0[2]) / (p.m1 + p.m2), y0 = (p.m1 * c0[1] + p.m2 * c0[3]) / (p.m1 + p.m2);
          R3.polyline(F, [[x0, y0, zT + 0.004], [cx, cy, zT + 0.004]], comCol, { alpha: .85, width: 1.6, dash: [6, 4], bias: -0.02 });
          R3.sphere(F, [cx, cy, zT + 0.02], 0.013, comCol, { shadow: false, vivid: true });
        }
        R3.label(F, [-0.35, 0.64, zT + 0.02], 'strobe: one flash every 0.1 s', th['text-2'], { size: 9.5 });
      }

      else if (p.mode === 'ballistic') {
        const bl = S.bal, L = p.Lstr, pivH = 0.52;
        B.table(F, -0.9, 0.9, -0.4, 0.4, 0, { legH: 0.69 });
        B.texBox(F, [0, 0, 0.012], [1.3, 0.3, 0.024], B.wood('#6E4A2A', 13), { ambient: 0.45 });
        const zGun = pivH - L;
        // the post and the pivot
        R3.box(F, [0, 0.10, pivH / 2 + 0.012], [0.04, 0.04, pivH], '#3A4458', { shadow: false, ambient: 0.35 });
        R3.cylinder(F, [0, 0.10, pivH], [0, -0.02, pivH], 0.007, '#D0D8E4', { segments: 10, shadow: false });
        // the ratchet: a toothed arc the pawl rides along
        const rr = L * 0.82, teeth = [];
        for (let k = 0; k <= 60; k++) {
          const a = k / 60 * 1.3, rad = rr + (k % 2 ? 0.008 : 0);
          teeth.push([Math.sin(a) * rad, 0.05, pivH - Math.cos(a) * rad]);
        }
        R3.polyline(F, teeth, '#B8C2D0', { alpha: .95, width: 2, bias: -0.01 });
        const scaleArc = [];
        for (let k = 0; k <= 30; k++) { const a = k / 30 * 1.3; scaleArc.push([Math.sin(a) * (rr - 0.02), 0.05, pivH - Math.cos(a) * (rr - 0.02)]); }
        R3.polyline(F, scaleArc, '#6B7890', { alpha: .8, width: 1, bias: -0.01 });
        // the pendulum's angle now: at rest, swinging, or held by the pawl
        let thn = 0;
        const ts = t - S.tFly;
        if (ts > 0) {
          if (ts >= (bl.tMax || 0)) thn = bl.thMax;
          else { const k = Math.min(bl.th.length - 1, Math.floor(ts / 5e-4)); thn = bl.th[k] || 0; }
        }
        const tip = [Math.sin(thn) * L, 0, pivH - Math.cos(thn) * L];
        R3.cylinder(F, [0, 0, pivH], tip, 0.005, '#C8D0DC', { segments: 8, shadow: false });
        const cAx = [[Math.cos(thn), 0, Math.sin(thn)], [0, 1, 0], [-Math.sin(thn), 0, Math.cos(thn)]];
        const cs = 0.06 + 0.03 * Math.cbrt(p.mBlk / 0.25);
        B.texBox(F, tip, [cs, cs * 0.9, cs * 0.9], B.metal('#8A94A8', 5), { axes: cAx, ambient: 0.45 });
        // the pawl on the arm, at the ratchet's radius
        R3.sphere(F, [Math.sin(thn) * rr, 0.05, pivH - Math.cos(thn) * rr], 0.009, '#FFD36B', { shadow: false });
        if (ts >= (bl.tMax || 0) && ts > 0)
          R3.label(F, [Math.sin(bl.thMax) * rr + 0.1, 0.05, pivH - Math.cos(bl.thMax) * rr + 0.04],
                   'pawl locks at θ = ' + (bl.thMax * 180 / Math.PI).toFixed(1) + '°  ·  h = ' + (bl.h * 100).toFixed(2) + ' cm', comCol, { size: 10, align: 'left' });
        // the spring gun and the steel ball
        const gx0 = -0.62, gx1 = -0.40;
        R3.box(F, [(gx0 + gx1) / 2, 0, zGun - 0.05], [0.26, 0.08, 0.05], '#3A4458', { shadow: false });
        R3.cylinder(F, [gx0, 0, zGun], [gx1, 0, zGun], 0.02, '#8A96AA', { segments: 16, shadow: false, ambient: 0.45, inner: 0.013 });
        const face = -cs / 2;
        if (t < S.tFly) {
          const bx = gx1 + (face - gx1) * Math.max(0, t / S.tFly);
          R3.sphere(F, [bx, 0, zGun], 0.013, '#D8DEE8', { shadow: false });
        }
        if (flashOn) flashAt = [face, 0, zGun];
        R3.label(F, [gx0, -0.08, zGun + 0.1], 'spring gun · ' + p.uBul.toFixed(2) + ' m/s', th['text-2'], { size: 9.5, align: 'left' });
        R3.label(F, [0.02, -0.1, pivH + 0.06], 'catcher ' + (p.mBlk * 1000).toFixed(0) + ' g on a ' + (L * 100).toFixed(0) + ' cm arm',
                 th['text-2'], { size: 9.5 });
        const qh = cam.project([gx0, 0, zGun]);
        if (qh.ok) {
          hdl = { x: qh.x, y: qh.y, r: 13, tip: 'drag for speed' };
          const qb = cam.project([gx0 + 1, 0, zGun]);
          if (qb.ok) { const dx = qb.x - qh.x, dy = qb.y - qh.y, Lp = Math.hypot(dx, dy) || 1; S._axU = { ux: dx / Lp, uy: dy / Lp }; }
        }
      }

      else {
        /* ---- the shell that bursts at the top of its flight ---- */
        const k = S.k, xo = S.xo;
        const X = (x, z) => [(x - xo) * k, 0, benchTop + z * k];
        R3.box(F, [0, 0, benchTop - 0.035], [3.2, 0.7, 0.07], '#253049',
               { shadow: false, ambient: 0.16, bias: F.GROUND });
        R3.plane(F, [-1.6, -0.35, benchTop + 0.0005], [3.2, 0, 0], [0, 0.7, 0], '#27324C',
                 { grid: 16, gridAlpha: 0.12, bias: F.GROUND });
        // the launcher
        const a = p.alpha * Math.PI / 180, o0 = X(0, 0);
        R3.cylinder(F, [o0[0], 0, o0[2]], [o0[0] + 0.16 * Math.cos(a), 0, o0[2] + 0.16 * Math.sin(a)],
                    0.028, '#6F80A6', { segments: 14, shadow: false, ambient: 0.35 });
        // the unexploded parabola, all the way down: the CM keeps to it
        const par = [];
        const T = 2 * R.tA;
        for (let i = 0; i <= 60; i++) {
          const tt = T * i / 60;
          par.push(X(R.vx * tt, R.vy0 * tt - 0.5 * G * tt * tt));
        }
        R3.polyline(F, par, comCol, { alpha: .45, width: 1.3, dash: [5, 5], bias: -0.02 });
        const P = posAt(S, t);
        const trail = (V, tf, tNow) => {
          const pts = [];
          for (let i = 0; i <= 30; i++) {
            const tt = Math.min(tNow, tf) * i / 30;
            pts.push(X(R.xA + V[0] * tt, R.zA + V[1] * tt - 0.5 * G * tt * tt));
          }
          return pts;
        };
        const up = [];
        const tUp = Math.min(t, R.tA);
        for (let i = 0; i <= 30; i++) {
          const tt = tUp * i / 30;
          up.push(X(R.vx * tt, R.vy0 * tt - 0.5 * G * tt * tt));
        }
        R3.polyline(F, up, '#C9D4EA', { alpha: .8, width: 1.6, bias: -0.02 });
        const rS = 0.05 * Math.cbrt(p.mProj / 2) + 0.02;
        const r1 = rS * Math.cbrt(p.fSplit), r2 = rS * Math.cbrt(1 - p.fSplit);
        if (!P.burst) {
          R3.sphere(F, X(P.one[0], P.one[1]), rS, '#B8C4DC', { shadowK: 0.4 });
          vArrow(X(P.one[0], P.one[1] + 0.9 / k), [R.vx, R.vy0 - G * t], '#C9D4EA', 'v', 0.35 / Math.max(p.u0, 1));
        } else {
          const s = t - R.tA;
          R3.polyline(F, trail(R.V1, R.t1, s), col1, { alpha: .85, width: 1.8, bias: -0.02 });
          R3.polyline(F, trail(R.V2, R.t2f, s), col2, { alpha: .85, width: 1.8, bias: -0.02 });
          R3.sphere(F, X(P.A[0], P.A[1]), r1, col1, { shadowK: 0.4 });
          R3.sphere(F, X(P.B[0], P.B[1]), r2, col2, { shadowK: 0.4 });
          if (p.showCOM) {
            const both = !P.down1 && !P.down2;
            R3.sphere(F, X(P.C[0], P.C[1]), 0.022, both ? comCol : th.warn, { shadow: false, vivid: true });
            R3.label(F, X(P.C[0], P.C[1] + 0.13 / k),
                     both ? 'CM still on the parabola' : 'a piece has landed — the ground pushes now',
                     both ? comCol : th.warn, { size: 9 });
          }
        }
        if (flashOn) flashAt = X(R.xA, R.zA);
        // the landing marks
        const mark = (x, c, tag, dz) => {
          const q = X(x, 0);
          R3.cylinder(F, [q[0], 0, benchTop], [q[0], 0, benchTop + 0.004], 0.03, c,
                      { segments: 16, shadow: false, ambient: 0.8 });
          R3.label(F, [q[0], 0, benchTop + 0.07 + (dz || 0)], tag, c, { size: 9 });
        };
        mark(R.range, comCol, 'R = ' + R.range.toFixed(1) + ' m', 0);
        mark(R.x1, col1, '1: ' + R.x1.toFixed(1) + ' m', 0.09);
        mark(R.x2, col2, '2: ' + R.x2.toFixed(1) + ' m', 0.18);
        const qh = cam.project(X(0, 0));
        if (qh.ok) {
          hdl = { x: qh.x, y: qh.y, r: 13, tip: 'drag to launch faster' };
          const qb = cam.project([X(0, 0)[0] + 1, 0, benchTop]);
          if (qb.ok) {
            const dx = qb.x - qh.x, dy = qb.y - qh.y, Lp = Math.hypot(dx, dy) || 1;
            S._axU = { ux: dx / Lp, uy: dy / Lp, perPx: 1 / Lp };
          }
        }
      }

      F.render();

      if (hdl) {
        const onD = g.dragging === 'u1';
        ctx.save();
        ctx.strokeStyle = onD ? th.text : g.alpha(acc, .75); ctx.lineWidth = onD ? 2.2 : 1.6;
        ctx.beginPath(); ctx.arc(hdl.x, hdl.y, hdl.r, 0, TAU); ctx.stroke(); ctx.restore();
        PA.lbl(ctx, hdl.x, hdl.y + hdl.r + 11, hdl.tip, onD ? th.text : g.alpha(th['text-3'], .95), 'center', 9);
        g.handle(hdl.x, hdl.y, hdl.r + 3, 'u1');
      }
      if (flashAt) {
        const q = cam.project(flashAt);
        if (q.ok) {
          const age = (t - S.flash) / 0.18;
          ctx.save();
          ctx.strokeStyle = g.alpha('#FFF4C2', 0.9 * (1 - Math.max(0, age))); ctx.lineWidth = 2;
          for (let i2 = 0; i2 < 10; i2++) {
            const an = i2 / 10 * TAU, r0 = 6 + age * 10, r1 = 14 + age * 22;
            ctx.beginPath(); ctx.moveTo(q.x + Math.cos(an) * r0, q.y + Math.sin(an) * r0);
            ctx.lineTo(q.x + Math.cos(an) * r1, q.y + Math.sin(an) * r1); ctx.stroke();
          }
          ctx.restore();
        }
      }

      /* ---------------- instrument panels ---------------- */
      const narrow = W < 660;
      const panel = (bx, by, bw, bh, title) => {
        ctx.fillStyle = g.alpha('#0B1020', .92);
        ctx.strokeStyle = g.alpha(th.line, 1); ctx.lineWidth = 1;
        ctx.beginPath(); ctx.roundRect(bx, by, bw, bh, 8); ctx.fill(); ctx.stroke();
        PA.lbl(ctx, bx + 10, by + 13, title, th['text-3'], 'left', 8.5);
      };
      const f3 = v => v == null ? '—' : v.toFixed(3);
      {
        const bw = narrow ? W - 24 : Math.min(W * 0.38, 318), bh = 116, bx = 12, by = H - bh - 30;
        panel(bx, by, bw, bh, p.mode === 'track' || p.mode === 'recoil' ? 'BOOKS · from gates' : 'THE TWO BOOKS');
        PA.lbl(ctx, bx + bw * 0.62, by + 13, 'before', th['text-3'], 'right', 8.5);
        PA.lbl(ctx, bx + bw - 10, by + 13, 'after', th['text-3'], 'right', 8.5);
        const row = (i, k, a, b, c) => {
          PA.lbl(ctx, bx + 10, by + 31 + i * 15, k, th['text-3'], 'left', 9);
          PA.lbl(ctx, bx + bw * 0.62, by + 31 + i * 15, a, th['text-2'], 'right', 9.5);
          PA.lbl(ctx, bx + bw - 10, by + 31 + i * 15, b, c || th['text-2'], 'right', 9.5);
        };
        if (p.mode === 'track' || p.mode === 'recoil') {
          const pg0 = R.gU1 != null && R.gU2 != null ? p.m1 * R.gU1 + p.m2 * R.gU2 : null;
          const pg1 = R.gW1 != null && R.gW2 != null ? p.m1 * R.gW1 + p.m2 * R.gW2 : null;
          const done = t > (S.run.tc1 != null ? S.run.tc1 : S.run.tRelease) + 0.9;
          row(0, 'Σmv, kg·m/s (gates)', f3(pg0), done ? f3(pg1) : 'timing…', done && pg0 != null && pg1 != null && Math.abs(pg1 - pg0) < 0.01 ? th.ok : th['text-2']);
          row(1, 'kinetic energy, J', R.K0.toFixed(4), done ? R.K1.toFixed(4) : '…');
          row(2, p.mode === 'recoil' ? 'energy from the spring' : 'lost in the bumpers', '', done ? R.dK.toFixed(4) + ' J' : '…', th.warn);
          row(3, p.mode === 'recoil' ? 'impulse each way ∫F dt' : 'impulse on m₂ = ∫F dt', '', R.J.toFixed(4) + ' N·s', acc);
          PA.lbl(ctx, bx + 10, by + bh - 10, p.mode === 'recoil' ? 'total momentum: zero before, zero after' :
                 'e from the gates = ' + (R.gW1 != null && R.gW2 != null && R.gU1 != null && R.gU2 != null && Math.abs(R.gU1 - R.gU2) > 1e-6 ? ((R.gW2 - R.gW1) / (R.gU1 - R.gU2)).toFixed(3) : '—'),
                 th.ok, 'left', 8.5);
        } else if (p.mode === 'airtable') {
          row(0, 'x-momentum Σmvₓ', R.p0.toFixed(4), R.px.toFixed(4), Math.abs(R.px - R.p0) < 1e-3 ? th.ok : th.crit);
          row(1, 'y-momentum Σmvᵧ', '0.0000', Math.abs(R.py) < 5e-5 ? '0.0000' : R.py.toFixed(4), th.ok);
          row(2, 'kinetic energy, J', R.K0.toFixed(4), R.K1.toFixed(4));
          row(3, 'angle between paths', '', R.ang == null ? '—' : R.ang.toFixed(2) + '°', comCol);
          PA.lbl(ctx, bx + 10, by + bh - 10, 'momentum is a vector: both components balance', th.ok, 'left', 8.5);
        } else {
          row(0, p.mode === 'ballistic' ? 'momentum, at impact' : 'horizontal momentum', R.p0.toFixed(3), R.p1.toFixed(3), th.ok);
          row(1, 'kinetic energy, J', R.K0.toFixed(3), R.K1.toFixed(3));
          row(2, p.mode === 'burst' ? 'added by the charge' : 'lost in the catcher', '', Math.abs(R.dK).toFixed(3) + ' J', th.warn);
          row(3, p.mode === 'ballistic' ? 'share of KE that survives' : 'pieces land together?', '',
              p.mode === 'ballistic' ? (100 * R.kept).toFixed(1) + ' %' : (R.together ? 'yes' : 'no'), acc);
          PA.lbl(ctx, bx + 10, by + bh - 10, 'momentum balances across the event — energy need not', th.ok, 'left', 8.5);
        }
        S._leftTop = by;
      }
      if (!narrow || p.mode === 'track' || p.mode === 'recoil') {
        const bw = narrow ? W - 24 : 250, bh = narrow ? 78 : 116;
        const bx = narrow ? 12 : W - bw - 14, by = narrow ? 40 : H - bh - 30;
        if (p.mode === 'track' || p.mode === 'recoil') {
          panel(bx, by, bw, bh, 'PHOTOGATE TIMER · flag 10.0 cm');
          const done = S.run.transits.filter(q => q.t0 + q.dt <= t);
          done.slice(-(narrow ? 3 : 5)).forEach((q, k) => {
            PA.lbl(ctx, bx + 10, by + 30 + k * 15, 'gate ' + 'AB'[q.gate] + ' · glider ' + (q.glider + 1), q.glider ? '#9AD0FF' : '#FFC08A', 'left', 9);
            PA.lbl(ctx, bx + bw - 10, by + 30 + k * 15, q.dt.toFixed(4) + ' s → ' + Math.abs(q.v).toFixed(3) + ' m/s', th['text-2'], 'right', 9);
          });
          if (!done.length) PA.lbl(ctx, bx + 10, by + 30, 'waiting for a flag…', th['text-3'], 'left', 9);
        } else if (p.showCOM) {
          panel(bx, by, bw, bh, 'SEEN FROM THE CM');
          let pre, post;
          if (p.mode === 'airtable') {
            const vc = p.m1 * p.u1 / (p.m1 + p.m2);
            pre = [[p.m1 * (p.u1 - vc), 0], [-p.m2 * vc, 0]];
            post = [[p.m1 * (R.V1[0] - vc), p.m1 * R.V1[1]], [p.m2 * (R.V2[0] - vc), p.m2 * R.V2[1]]];
          } else { const cf = comFrame(S); pre = cf.pre; post = cf.post; }
          let mx = 1e-9;
          pre.concat(post).forEach(v => { mx = Math.max(mx, Math.hypot(v[0], v[1])); });
          const sc = (bw / 4 - 12) / mx;
          [['before', pre, bx + bw * 0.27], ['after', post, bx + bw * 0.73]].forEach(cc => {
            const cx = cc[2], cy = by + bh / 2 + 6;
            PA.lbl(ctx, cx, by + bh - 10, cc[0], th['text-3'], 'center', 8.5);
            ctx.fillStyle = comCol; ctx.beginPath(); ctx.arc(cx, cy, 3.2, 0, TAU); ctx.fill();
            cc[1].forEach((v, k) => {
              if (Math.hypot(v[0], v[1]) * sc < 2) return;
              const x1 = cx + v[0] * sc, y1 = cy - v[1] * sc, an = Math.atan2(y1 - cy, x1 - cx), c = k ? col2 : col1;
              ctx.strokeStyle = c; ctx.fillStyle = c; ctx.lineWidth = 2;
              ctx.beginPath(); ctx.moveTo(cx, cy); ctx.lineTo(x1, y1); ctx.stroke();
              ctx.beginPath(); ctx.moveTo(x1, y1);
              ctx.lineTo(x1 - 6 * Math.cos(an - 0.45), y1 - 6 * Math.sin(an - 0.45));
              ctx.lineTo(x1 - 6 * Math.cos(an + 0.45), y1 - 6 * Math.sin(an + 0.45)); ctx.closePath(); ctx.fill();
            });
            if (cc[1].every(v => Math.hypot(v[0], v[1]) * sc < 2)) PA.lbl(ctx, cx, cy - 14, 'both at rest', th['text-2'], 'center', 8.5);
          });
        }
      }

      ctx.fillStyle = g.alpha(th['text-3'], .95);
      ctx.font = '10px "IBM Plex Mono",monospace'; ctx.textAlign = 'left';
      ctx.fillText(p.mode === 'track' ? 'm₁ ' + p.m1.toFixed(2) + ' kg, m₂ ' + p.m2.toFixed(2) + ' kg · e = ' + p.e.toFixed(2) +
                   ' · contact lasts ' + (R.tcon * 1000).toFixed(1) + ' ms, peak force ' + R.Fpk.toFixed(1) + ' N'
        : p.mode === 'recoil' ? 'spring stores ' + p.Es.toFixed(2) + ' J · burn the thread and it all becomes kinetic energy'
        : p.mode === 'airtable' ? 'smooth pucks on an air cushion · e = ' + p.e.toFixed(2)
        : p.mode === 'ballistic' ? 'momentum for the catch, energy for the swing — never the other way round'
        : 'internal forces only: the centre of mass never learns the shell exploded', 14, 20);
    },

    onDrag(S, e) {
      if (e.id !== 'u1' || !S._axU) return;
      const along = e.dx * S._axU.ux + e.dy * S._axU.uy, p = S.p;
      if (p.mode === 'ballistic') p.uBul = clamp(p.uBul + along * 0.03, 1, 10);
      else if (p.mode === 'burst') p.u0 = clamp(p.u0 + along * 0.10, 5, 60);
      else p.u1 = clamp(p.u1 + along * 0.004, -1.2, 1.2);
      this.setup(S);
    },

    plots: [
      { title: 'The collision, in slow motion — force against time',
        legend: [{ c: '#FFB454', label: 'force between them' }, { c: '#4ADE80', label: 'swept quantity' },
                 { c: '#9AA8C0', label: 'reference' }],
        draw(S, g) {
          const p = S.p, R = S.R, th = g.theme, c1 = '#FFB454', c2 = '#4ADE80', cr = '#9AA8C0';
          if (p.mode === 'track' || p.mode === 'recoil') {
            const ct = S.run.contact;
            if (!ct.length) {
              const P = g.Plot({ xmin: 0, xmax: 1, ymin: 0, ymax: 1, xlabel: 'time (ms)', ylabel: 'force (N)' }).frame();
              P.tag(0.05, 0.5, 'they never touch — m₁ does not catch m₂', th.warn, 'left', 0);
              return;
            }
            const t0 = ct[0][0], pts = ct.map(q => [(q[0] - t0) * 1000, q[1]]);
            const xmax = pts[pts.length - 1][0] * 1.08 || 1, ymax = Math.max(...pts.map(q => q[1])) * 1.15 || 1;
            const P = g.Plot({ xmin: 0, xmax: xmax, ymin: 0, ymax: ymax, xlabel: 'time into the contact (ms)',
              ylabel: 'force (N)', xfmt: v => v.toFixed(0), yfmt: v => v.toFixed(0) }).frame();
            P.clip(() => { P.area(pts, 0, g.alpha(c1, .22)); P.line(pts, c1, 2.4); });
            P.tag(xmax * 0.5, ymax * 0.93, 'area = impulse = ' + R.J.toFixed(4) + ' N·s', c1, 'center', 0);
            if (p.mode === 'track') P.tag(xmax * 0.5, ymax * 0.80, 'Δp of m₂ = ' + (p.m2 * (R.w2 - R.u2)).toFixed(4) + ' N·s', c2, 'center', 0);
            return;
          }
          if (p.mode === 'airtable') {
            const pts = [], ref = [];
            const e = p.e, M = p.m1 + p.m2;
            for (let i = 0; i <= 90; i++) {
              const f = 0.9 * i / 90, nx = Math.sqrt(1 - f * f), ny = -f;
              const u1n = p.u1 * nx;
              const v1n = ((p.m1 - e * p.m2) * u1n) / M, v2n = ((1 + e) * p.m1 * u1n) / M;
              const V1 = [p.u1 + (v1n - u1n) * nx, (v1n - u1n) * ny], V2 = [v2n * nx, v2n * ny];
              const s1 = Math.hypot(V1[0], V1[1]), s2 = Math.hypot(V2[0], V2[1]);
              if (s1 > 1e-6 && s2 > 1e-6) pts.push([f, Math.acos(clamp((V1[0] * V2[0] + V1[1] * V2[1]) / (s1 * s2), -1, 1)) * 180 / Math.PI]);
              ref.push([f, 90]);
            }
            const P = g.Plot({ xmin: 0, xmax: 0.9, ymin: 0, ymax: 180, xlabel: 'offset b ÷ (r₁ + r₂)', ylabel: 'angle between paths (°)',
              xfmt: v => v.toFixed(1), yfmt: v => v.toFixed(0) }).frame();
            P.clip(() => { P.line(ref, cr, 1.2, [4, 3]); P.line(pts, c2, 2.2);
                           if (R.ang != null) P.dot(p.bImp, R.ang, 5, c1, th['ink-950']); });
            P.tag(0.02, 90, 'instant-collision theory (line) · the dot is the integrated collision', cr, 'left', -9);
            return;
          }
          if (p.mode === 'ballistic') {
            const a = [];
            for (let i = 0; i <= 160; i++) {
              const u = 1 + 9 * i / 160, v = p.mBul * u / (p.mBul + p.mBlk), h = v * v / (2 * G);
              a.push([u, h > 2 * p.Lstr ? 180 : Math.acos(clamp(1 - h / p.Lstr, -1, 1)) * 180 / Math.PI]);
            }
            const P = g.Plot({ xmin: 1, xmax: 10, ymin: 0, ymax: 180, xlabel: 'launch speed (m/s)', ylabel: 'angle the pawl locks at (°)',
              xfmt: v => v.toFixed(0), yfmt: v => v.toFixed(0) }).frame();
            P.clip(() => { P.line([[1, 90], [10, 90]], cr, 1, [4, 3]); P.line(a, c2, 2.2);
                           P.dot(p.uBul, S.bal.thMax * 180 / Math.PI, 5, c1, th['ink-950']); });
            return;
          }
          const a = [], b = [], c = [];
          const al = p.alpha * Math.PI / 180, vx = p.u0 * Math.cos(al), vy = p.u0 * Math.sin(al);
          const tA = vy / G, xA = vx * tA, zA = vy * vy / (2 * G), bt = p.beta * Math.PI / 180;
          for (let i = 0; i <= 120; i++) {
            const f = 0.05 + 0.90 * i / 120, m1 = f * p.mProj, m2 = (1 - f) * p.mProj;
            const w = Math.sqrt(2 * p.Q / (m1 * m2 / p.mProj));
            const V1 = [vx + (m2 / p.mProj) * w * Math.cos(bt), (m2 / p.mProj) * w * Math.sin(bt)];
            const V2 = [vx - (m1 / p.mProj) * w * Math.cos(bt), -(m1 / p.mProj) * w * Math.sin(bt)];
            const fl = (vz) => (vz + Math.sqrt(vz * vz + 2 * G * zA)) / G;
            const x1 = xA + V1[0] * fl(V1[1]), x2 = xA + V2[0] * fl(V2[1]);
            a.push([f, x1]); b.push([f, x2]); c.push([f, f * x1 + (1 - f) * x2]);
          }
          const all = a.concat(b, c).map(q => q[1]).concat([0, R.range]);
          let lo = Math.min(...all), hi = Math.max(...all);
          const pad = Math.max(1, (hi - lo) * 0.08); lo -= pad; hi += pad;
          const P = g.Plot({ xmin: 0.05, xmax: 0.95, ymin: lo, ymax: hi, xlabel: 'piece 1 share of the mass', ylabel: 'landing distance (m)',
            xfmt: v => v.toFixed(1), yfmt: v => v.toFixed(0) }).frame();
          P.clip(() => { P.line([[0.05, R.range], [0.95, R.range]], cr, 1, [4, 3]); P.line(a, c1, 2); P.line(b, c2, 2);
                         P.vline(p.fSplit, g.alpha(th.text, .5), [3, 3]); });
          P.tag(0.06, R.range, 'range if it had not burst', cr, 'left', -8);
        } },

      { title: 'Momentum through the event — traded between the parts, kept by the whole',
        legend: [{ c: '#F29A4A', label: 'body 1' }, { c: '#4A9AF2', label: 'body 2' }, { c: '#F5E663', label: 'total' }],
        draw(S, g) {
          const p = S.p, R = S.R, th = g.theme;
          const A = [], Bq = [], C = [];
          let T = S.tEnd;
          if (p.mode === 'track' || p.mode === 'recoil' || p.mode === 'airtable') {
            const r = S.run;
            for (let i = 0; i < r.t.length; i += 3) {
              const a = p.mode === 'airtable' ? p.m1 * r.P[i][4] : p.m1 * r.v1[i];
              const b = p.mode === 'airtable' ? p.m2 * r.P[i][6] : p.m2 * r.v2[i];
              A.push([r.t[i], a]); Bq.push([r.t[i], b]); C.push([r.t[i], a + b]);
            }
            T = r.t[r.t.length - 1];
          } else if (p.mode === 'ballistic') {
            const bl = S.bal, Mt = p.mBul + p.mBlk;
            A.push([0, R.p0], [S.tFly, R.p0]); C.push([0, R.p0], [S.tFly, R.p0]); Bq.push([0, 0], [S.tFly, 0]);
            for (let i = 1; i < bl.th.length; i += 20) {
              const om = (bl.th[i] - bl.th[i - 1]) / 5e-4;
              C.push([S.tFly + bl.t[i], Mt * p.Lstr * om * Math.cos(bl.th[i])]);
            }
            C.push([S.tFly + (bl.tMax || 0), 0], [T, 0]);
          } else {
            const n = 200;
            for (let i = 0; i <= n; i++) {
              const t = T * i / n;
              if (t < R.tA) { C.push([t, R.m * R.vx]); continue; }
              const s = t - R.tA, a = s < R.t1 ? R.m1 * R.V1[0] : 0, b = s < R.t2f ? R.m2 * R.V2[0] : 0;
              A.push([t, a]); Bq.push([t, b]); C.push([t, a + b]);
            }
          }
          const vals = A.concat(Bq, C).map(q => q[1]).concat([0]);
          let lo = Math.min(...vals), hi = Math.max(...vals);
          const pad = Math.max(0.02, (hi - lo) * 0.12); lo -= pad; hi += pad;
          const P = g.Plot({ xmin: 0, xmax: T, ymin: lo, ymax: hi, xlabel: 'time (s)', ylabel: 'momentum (kg·m/s)',
            xfmt: v => v.toFixed(2), yfmt: v => v.toFixed(2) }).frame();
          P.clip(() => {
            P.line([[0, 0], [T, 0]], g.alpha(th['text-3'], .45), 1);
            if (A.length > 1) P.line(A, '#F29A4A', 1.8);
            if (Bq.length > 1) P.line(Bq, '#4A9AF2', 1.8);
            P.line(C, '#F5E663', 2.6);
            P.vline(S.t2, g.alpha(th.text, .5), [3, 3]);
          });
          P.tag(T * 0.02, C[0][1], p.mode === 'ballistic' ? 'kept through the catch, not through the swing'
                : p.mode === 'burst' ? 'kept until a piece lands' : 'total: flat straight through the collision', '#F5E663', 'left', -9);
        } }
    ],

    readouts(S) {
      const p = S.p, R = S.R;
      if (p.mode === 'track' || p.mode === 'recoil') {
        const out = [
          { label: 'v₁ after (gate)', value: R.gW1 == null ? '—' : R.gW1.toFixed(3), unit: 'm/s', flag: 'accent', hint: 'model ' + R.w1.toFixed(3) },
          { label: 'v₂ after (gate)', value: R.gW2 == null ? '—' : R.gW2.toFixed(3), unit: 'm/s', flag: 'accent', hint: 'model ' + R.w2.toFixed(3) },
          { label: 'Impulse ∫F dt', value: R.J.toFixed(4), unit: 'N·s', hint: 'area under the force curve' },
          { label: 'Contact time', value: (R.tcon * 1000).toFixed(1), unit: 'ms', hint: 'peak force ' + R.Fpk.toFixed(1) + ' N' },
          { label: 'Total momentum', value: R.p0.toFixed(4), unit: 'kg·m/s', flag: 'ok', hint: 'after: ' + R.p1.toFixed(4) },
          { label: p.mode === 'recoil' ? 'KE given by the spring' : 'KE lost', value: R.dK.toFixed(4), unit: 'J', flag: 'warn' }
        ];
        if (p.mode === 'track') {
          out.push({ label: 'Restitution, measured', value: R.eMeas == null ? '—' : R.eMeas.toFixed(3), unit: '', hint: 'set to ' + p.e.toFixed(2) });
          out.push({ label: 'Ideal-collision answer', value: R.ideal[0].toFixed(3) + ', ' + R.ideal[1].toFixed(3), unit: 'm/s', hint: 'instantaneous theory' });
        }
        return out;
      }
      if (p.mode === 'airtable') return [
        { label: 'Angle between the paths', value: R.ang == null ? '—' : R.ang.toFixed(2), unit: '°', flag: 'accent', hint: 'equal m, e = 1 → 90°' },
        { label: 'Puck 1 leaves at', value: R.th1.toFixed(1), unit: '°', hint: Math.hypot(R.V1[0], R.V1[1]).toFixed(3) + ' m/s' },
        { label: 'Puck 2 leaves at', value: R.th2.toFixed(1), unit: '°', hint: Math.hypot(R.V2[0], R.V2[1]).toFixed(3) + ' m/s' },
        { label: 'x-momentum', value: R.px.toFixed(4), unit: 'kg·m/s', flag: 'ok', hint: 'before: ' + R.p0.toFixed(4) },
        { label: 'y-momentum', value: Math.abs(R.py) < 5e-5 ? '0.0000' : R.py.toFixed(4), unit: 'kg·m/s', flag: 'ok', hint: 'before: 0' },
        { label: 'KE kept', value: (100 * R.K1 / R.K0).toFixed(1), unit: '%' }
      ];
      if (p.mode === 'ballistic') return [
        { label: 'Speed just after the catch', value: R.v.toFixed(3), unit: 'm/s', flag: 'accent', hint: 'mu/(m + M)' },
        { label: 'Rise, where the pawl locks', value: (S.bal.h * 100).toFixed(2), unit: 'cm', hint: 'v²/2g' },
        { label: 'Angle held by the ratchet', value: (S.bal.thMax * 180 / Math.PI).toFixed(1), unit: '°', flag: 'accent' },
        { label: 'KE kept', value: (100 * R.kept).toFixed(1), unit: '%', hint: 'm/(m + M)' },
        { label: 'Launch speed from the rise', value: ((1 + p.mBlk / p.mBul) * Math.sqrt(2 * G * S.bal.h)).toFixed(3), unit: 'm/s', flag: 'ok' },
        { label: 'Wrong: energy all the way', value: Math.sqrt(2 * G * S.bal.h * (p.mBul + p.mBlk) / p.mBul).toFixed(3), unit: 'm/s', flag: 'crit' }
      ];
      return [
        { label: 'Piece 1 lands at', value: R.x1.toFixed(2), unit: 'm', flag: 'accent' },
        { label: 'Piece 2 lands at', value: R.x2.toFixed(2), unit: 'm', flag: 'accent' },
        { label: 'Range with no burst', value: R.range.toFixed(2), unit: 'm' },
        { label: 'Mass-weighted landing', value: R.xMean.toFixed(2), unit: 'm', flag: R.together ? 'ok' : 'warn',
          hint: R.together ? 'equals R: they land together' : 'not R: different flight times' }
      ];
    },

    equation(S) {
      const p = S.p, R = S.R;
      if (p.mode === 'track')
        return E.v('J') + ' ' + E.op('=') + ' ∫' + E.v('F') + ' d' + E.v('t') + ' ' + E.op('=') + ' ' + E.n(R.J, 'N·s') + ' ' +
          E.op('=') + ' Δ' + E.v('p') + '₂' + E.op('·') + ' ' + E.v('m') + '₁' + E.v('u') + '₁ ' + E.op('+') + ' ' + E.v('m') + '₂' +
          E.v('u') + '₂ ' + E.op('=') + ' ' + E.v('m') + '₁' + E.v('v') + '₁ ' + E.op('+') + ' ' + E.v('m') + '₂' + E.v('v') + '₂' +
          '<br>' + E.v('e') + ' ' + E.op('=') + ' ' + E.frac(E.v('v') + '₂' + E.op('−') + E.v('v') + '₁', E.v('u') + '₁' + E.op('−') + E.v('u') + '₂') +
          ' ' + E.op('=') + ' ' + E.n(R.eMeas == null ? 0 : R.eMeas, '') + E.op('·') + ' Δ' + E.v('K') + ' ' + E.op('=') + ' ½' + E.v('μ') +
          '(1' + E.op('−') + E.v('e') + '²)' + E.v('u') + E.sub('rel') + '² ' + E.op('=') + ' ' + E.n(R.dK, 'J');
      if (p.mode === 'recoil')
        return '0 ' + E.op('=') + ' ' + E.v('m') + '₁' + E.v('v') + '₁ ' + E.op('+') + ' ' + E.v('m') + '₂' + E.v('v') + '₂' + E.op('·') + ' ' +
          E.v('E') + E.sub('spring') + ' ' + E.op('=') + ' ½' + E.v('m') + '₁' + E.v('v') + '₁² ' + E.op('+') + ' ½' + E.v('m') + '₂' + E.v('v') + '₂²' +
          '<br>' + E.v('v') + '₂ ' + E.op('=') + ' √' + E.frac('2' + E.v('E') + E.v('m') + '₁', E.v('m') + '₂(' + E.v('m') + '₁' + E.op('+') + E.v('m') + '₂)') +
          ' ' + E.op('=') + ' ' + E.n(R.w2, 'm/s');
      if (p.mode === 'airtable')
        return E.v('m') + '₁' + E.v('u') + ' ' + E.op('=') + ' ' + E.v('m') + '₁' + E.v('v') + '₁ ' + E.op('+') + ' ' + E.v('m') + '₂' + E.v('v') + '₂ (vectors)' +
          '<br>equal masses, ' + E.v('e') + ' ' + E.op('=') + ' 1 ' + E.op('⇒') + ' ' + E.v('v') + '₁' + E.op('·') + E.v('v') + '₂ ' + E.op('=') + ' 0 ' +
          E.op('⇒') + ' 90° apart ' + E.op('·') + ' measured: ' + E.n(R.ang == null ? 0 : R.ang, '°');
      if (p.mode === 'ballistic')
        return E.v('v') + ' ' + E.op('=') + ' ' + E.frac(E.v('m') + E.v('u'), E.v('m') + E.op('+') + E.v('M')) + ' ' + E.op('=') + ' ' + E.n(R.v, 'm/s') +
          E.op('·') + ' ' + E.v('h') + ' ' + E.op('=') + ' ' + E.frac(E.v('v') + '²', '2' + E.v('g')) + ' ' + E.op('=') + ' ' + E.n(S.bal.h * 100, 'cm');
      return E.v('m') + E.v('v') + E.sub('top') + ' ' + E.op('=') + ' ' + E.v('m') + '₁' + E.v('v') + '₁ ' + E.op('+') + ' ' + E.v('m') + '₂' + E.v('v') + '₂' +
        '<br>' + E.v('x') + E.sub('cm') + ' ' + E.op('=') + ' ' + E.n(R.xMean, 'm') + (R.together ? ' = R' : ' ≠ R');
    },

    eqNote: '<b>Momentum is kept in every collision; kinetic energy almost never is.</b> The bumpers show why. ' +
      'While they are squeezed, each glider pushes the other with the same force for the same time, so the ' +
      'impulses are equal and opposite and the total momentum cannot change. Whether the energy comes back ' +
      'depends on the bumper. A perfect spring returns it all (e = 1). A damped one turns some into heat. ' +
      'Velcro keeps the gliders together, and loses the most that can be lost: the kinetic energy of the ' +
      'motion relative to the centre of mass, ½μu²ᵣₑₗ.',

    problems: [
      { source: 'NEET pattern · equal gliders, elastic',
        q: 'A 0.40 kg glider moving at 0.60 m/s hits an identical glider at rest on an air track. The bumpers are perfectly elastic. What is the speed of the second glider afterwards, in m/s?',
        params: { mode: 'track', m1: 0.4, m2: 0.4, u1: 0.6, u2: 0, e: 1 },
        predict: { label: 'v₂', unit: 'm/s', tol: 0.02 },
        measure: S => S.R.w2,
        working: 'Equal masses with e = 1 swap velocities: the first glider stops and the second leaves at ' +
          '<b>0.600 m/s</b>. Gate B confirms it: the 10.0 cm flag takes 0.167 s to pass, and 0.100/0.1667 = 0.600 m/s.' },
      { source: 'JEE Main pattern · restitution',
        q: 'The same two 0.40 kg gliders, 0.60 m/s onto one at rest, but now the bumpers have e = 0.50. Find the speed of the struck glider afterwards, in m/s.',
        params: { mode: 'track', m1: 0.4, m2: 0.4, u1: 0.6, u2: 0, e: 0.5 },
        predict: { label: 'v₂', unit: 'm/s', tol: 0.02 },
        measure: S => S.R.w2,
        working: 'Momentum: 0.4(0.6) = 0.4v₁ + 0.4v₂. Restitution: v₂ − v₁ = 0.5 × 0.6. Adding: 2v₂ = 0.9, so ' +
          '<b>v₂ = 0.450 m/s</b> and v₁ = 0.150 m/s. The damped bumper turns 0.0270 J into heat, a quarter of the energy.' },
      { source: 'NEET pattern · velcro',
        q: 'A 0.40 kg glider at 0.60 m/s hits an identical glider at rest, and velcro pads make them stick. How much kinetic energy is lost, in joules?',
        params: { mode: 'track', m1: 0.4, m2: 0.4, u1: 0.6, u2: 0, e: 0 },
        predict: { label: 'KE lost', unit: 'J', tol: 0.03 },
        measure: S => S.R.dK,
        working: 'They move off together at 0.30 m/s. KE goes from ½(0.4)(0.36) = 0.0720 J to ½(0.8)(0.09) = 0.0360 J: ' +
          '<b>0.0360 J</b> lost, exactly half. That is ½μu² with μ = 0.20 kg — all the energy of the relative motion.' },
      { source: 'JEE Main pattern · recoil',
        q: 'Gliders of 0.40 kg and 0.80 kg are held against a compressed spring storing 0.30 J. The thread is burned. How fast does the 0.80 kg glider move off, in m/s?',
        params: { mode: 'recoil', m1: 0.4, m2: 0.8, Es: 0.3 },
        predict: { label: 'speed of the heavier glider', unit: 'm/s', tol: 0.02 },
        measure: S => Math.abs(S.R.w2),
        working: 'Momentum stays zero: 0.4v₁ = 0.8v₂, so v₁ = 2v₂. Energy: ½(0.4)(2v₂)² + ½(0.8)v₂² = 0.30, so ' +
          '1.2v₂² = 0.30 and <b>v₂ = 0.500 m/s</b> (the light one goes at 1.00 m/s). The lighter body takes two thirds ' +
          'of the energy: kinetic energy is shared in inverse proportion to mass.' },
      { source: 'JEE Advanced pattern · glancing, equal masses',
        q: 'On the air table a 0.20 kg puck at 0.50 m/s strikes an identical puck at rest, off-centre, elastically. What is the angle between their paths afterwards, in degrees?',
        params: { mode: 'airtable', m1: 0.2, m2: 0.2, u1: 0.5, e: 1, bImp: 0.5 },
        predict: { label: 'angle between paths', unit: '°', tol: 0.01 },
        measure: S => S.R.ang,
        working: 'Momentum as vectors, u = v₁ + v₂; energy, u² = v₁² + v₂². Together v₁·v₂ = 0: <b>90.0°</b>. The lab ' +
          'does not assume it: it integrates the contact force and the strobe record comes out square.' },
      { source: 'JEE Main pattern · the ballistic pendulum',
        q: 'A 66 g steel ball leaves the spring gun at 5.00 m/s and is caught by a 250 g catcher on a light arm. How high does the catcher rise, in cm? (g = 9.81 m/s²)',
        params: { mode: 'ballistic', mBul: 0.066, mBlk: 0.25, uBul: 5, Lstr: 0.3 },
        predict: { label: 'rise h', unit: 'cm', tol: 0.02 },
        measure: S => S.bal.h * 100,
        working: 'Catch (momentum): v = 0.066 × 5.00/0.316 = 1.044 m/s. Swing (energy): h = v²/2g = 1.091/19.62 = ' +
          '<b>5.56 cm</b>. Only 21% of the ball\'s energy survives the catch, so using energy for the whole thing would ' +
          'put the answer at 26.6 cm — five times too high.' },
      { source: 'JEE Advanced pattern · the shell that bursts at the top',
        q: 'A 2.00 kg shell is fired at 20.0 m/s at 45°. At the top it bursts into two equal halves; one falls straight down from rest. How far from the gun does the other land, in metres? (g = 9.81 m/s²)',
        params: { mode: 'burst', mProj: 2, u0: 20, alpha: 45, fSplit: 0.5, Q: 200, beta: 180 },
        predict: { label: 'landing distance', unit: 'm', tol: 0.02 },
        measure: S => S.R.x2,
        working: 'R = u² sin 90°/g = 40.8 m, and the burst is internal, so the CM still lands at R. Both halves leave ' +
          'the top horizontally, so they land together; one lands at R/2, so the other lands at 3R/2 = <b>61.2 m</b>.' }
    ],

    walkthrough: [
      { title: '1 · A collision takes time',
        body: 'Run the elastic preset and look at the first graph: the force between the gliders during the collision.',
        ask: 'How long does the collision last, and what is the area under the curve?',
        reveal: 'About <b>30 ms</b>, rising to a peak and falling away as the bumpers squeeze and spring back. The ' +
          'area is the <b>impulse</b>, and it equals the change in momentum of each glider. The other glider feels ' +
          'the same force pointing the other way for the same time, so the two changes cancel.',
        params: { mode: 'track', m1: 0.4, m2: 0.4, u1: 0.6, u2: 0, e: 1 } },
      { title: '2 · Measuring speed with a photogate',
        body: 'Watch the photogate timer as each glider passes through a beam.',
        ask: 'Gate B reads 0.1667 s. What speed is that?',
        reveal: 'The flag is 10.0 cm long, so v = 0.100/0.1667 = <b>0.600 m/s</b>. A photogate measures a time, not ' +
          'a speed. The shorter the flag, the closer this average comes to the instantaneous speed.',
        params: { mode: 'track', m1: 0.4, m2: 0.4, u1: 0.6, u2: 0, e: 1 } },
      { title: '3 · Restitution lives in the bumper',
        body: 'Lower e to 0.5, then to 0 (velcro).',
        ask: 'Does the total momentum change? Does the energy?',
        reveal: '<b>Momentum: never.</b> Energy: yes. The damped bumper turns part of the relative motion into heat, ' +
          'and velcro keeps the gliders together, losing exactly half here. The centre of mass keeps its speed ' +
          'in every case.',
        params: { mode: 'track', m1: 0.4, m2: 0.4, u1: 0.6, u2: 0, e: 0.5 } },
      { title: '4 · An explosion is a collision run backwards',
        body: 'Load the spring recoil: two gliders held against a compressed spring, then the thread is burned.',
        ask: 'Which glider moves faster, and which gets more of the energy?',
        reveal: 'The <b>lighter</b> one, on both counts. Momenta are equal and opposite, so speed goes as 1/m, and ' +
          'kinetic energy p²/2m also goes as 1/m. A gun and its bullet share the energy of the charge in the same way.',
        params: { mode: 'recoil', m1: 0.4, m2: 0.8, Es: 0.3 } },
      { title: '5 · Glancing, equal masses: 90°',
        body: 'Switch to the air table. The strobe records a flash every 0.1 s.',
        ask: 'Change the offset. Does the 90° survive?',
        reveal: '<b>Yes, for any offset</b>, as long as the masses are equal and the collision is elastic. Lower e ' +
          'and the angle closes. The pucks are smooth, so the force acts only along the line of centres; puck 2 ' +
          'always leaves along that line.',
        params: { mode: 'airtable', m1: 0.2, m2: 0.2, u1: 0.5, e: 1, bImp: 0.5 } },
      { title: '6 · The ballistic pendulum',
        body: 'The spring gun fires into the catcher. The pawl rides the toothed arc and locks at the top of the swing.',
        ask: 'Can you get the launch speed from the height using energy conservation alone?',
        reveal: '<b>No.</b> The catch is perfectly inelastic, and only m/(m + M) of the ball\'s energy survives it. Use ' +
          'momentum for the catch and energy for the swing. The red readout shows what energy alone would give.',
        params: { mode: 'ballistic', mBul: 0.066, mBlk: 0.25, uBul: 5, Lstr: 0.3 } },
      { title: '7 · A shell that bursts in flight',
        body: 'The shell bursts at the top of its flight.',
        ask: 'Does the centre of mass keep to the original parabola?',
        reveal: '<b>Yes, while both pieces are in the air.</b> The burst is internal. Once a piece lands, the ground ' +
          'pushes on it, and the CM leaves the parabola.',
        params: { mode: 'burst', mProj: 2, u0: 20, alpha: 45, fSplit: 0.3, Q: 500, beta: 60 } }
    ],

    quiz: [
      { q: 'The area under a force–time graph for a collision equals:',
        options: ['the work done', 'the change in kinetic energy', 'the impulse, equal to the change in momentum', 'the average force'], answer: 2,
        why: 'J = ∫F dt = Δp. Work is the area under force against distance, not time.' },
      { q: 'A softer bumper makes the same collision last longer. The impulse is:',
        options: ['larger', 'smaller', 'the same, with a lower peak force', 'zero'], answer: 2,
        why: 'The momentum change is fixed by the velocities, so the impulse is fixed; spreading it over a longer time lowers the peak force. This is why airbags and crumple zones work.' },
      { q: 'In a perfectly inelastic collision between two bodies:',
        options: ['all the kinetic energy is lost', 'momentum is lost', 'the kinetic energy relative to the CM is lost', 'no energy is lost'], answer: 2,
        why: 'The CM velocity cannot change, so ½Mv²ₘ always survives. Only ½μu²ᵣₑₗ can be dissipated.' },
      { q: 'Two gliders at rest are pushed apart by a spring. The lighter one:',
        options: ['moves slower and gets less energy', 'moves faster and gets more energy', 'moves faster but gets less energy', 'moves at the same speed'], answer: 1,
        why: 'Equal and opposite momenta give v ∝ 1/m, and KE = p²/2m also goes as 1/m.' },
      { q: 'A photogate records a 5.0 cm flag blocking the beam for 0.040 s. The speed is:',
        options: ['0.20 m/s', '1.25 m/s', '2.0 m/s', '12.5 m/s'], answer: 1,
        why: 'v = L/Δt = 0.050/0.040 = 1.25 m/s.' },
      { q: 'Two identical smooth balls collide elastically, one at rest, off-centre. The angle between their final paths is:',
        options: ['0°', '45°', '90°', 'depends on the offset'], answer: 2,
        why: 'u = v₁ + v₂ and u² = v₁² + v₂² together give v₁·v₂ = 0.' }
    ],

    notes: '<b>Where this shows up in the paper.</b>' +
      '<ul><li>One-dimensional collisions: momentum plus v₂ − v₁ = e(u₁ − u₂).</li>' +
      '<li>Impulse as the area under F–t, and why a longer contact time lowers the peak force.</li>' +
      '<li>Energy lost: ½μ(1 − e²)u²ᵣₑₗ, with μ the reduced mass.</li>' +
      '<li>Recoil and explosions: momenta equal and opposite, kinetic energy shared as 1/m.</li>' +
      '<li>Oblique collisions of smooth spheres: impulse along the line of centres only.</li>' +
      '<li>The ballistic pendulum, and the centre of mass of an exploding projectile.</li></ul>' +
      '<div class="pyq"><em>Trap to avoid</em>"Momentum is conserved" applies to the whole isolated system over ' +
      'the short time of the impact. It does not hold for one body alone, for a pendulum while it swings, or ' +
      'once a piece of a shell has hit the ground.</div>'
  });

  /* =========================================================================
     18 · CAPACITANCE, DIELECTRICS AND ENERGY — the field solved, not drawn

     The capacitor's cross-section is solved as it really is: Laplace's
     equation ∇·(ε∇φ) = 0 on a grid, with the plates held at ±V/2, the slab's
     permittivity painted into the cells it occupies, and the field allowed to
     bulge out past the edges. The capacitance is then read from the stored
     energy, C = 2U/V², and the force on the slab from how that energy
     changes as the slab moves: F = ½V² dC/dx.

     That last step is the point. The textbook field between ideal plates is
     perpendicular to the slab and cannot pull it anywhere; the force comes
     entirely from the fringing field at the edge, which the ideal model
     throws away. The grid keeps it, so the pull is computed from the thing
     that actually does the pulling — and it comes out equal to the ideal
     answer, which is the beautiful part.
     ========================================================================= */

  const EPS0 = 8.854e-12;
  const PLATE_L = 0.10, PLATE_W = 0.10;            // 10 cm × 10 cm plates

  /* The grid. Plates run x ∈ [0, L] at z = ±d/2, both on grid nodes. The gap
     always gets eight cells whatever d is, and the margin is wide enough for
     the fringe field to die away before it reaches the earthed boundary. */
  function capGrid(dm) {
    const L = PLATE_L, nL = 64, hx = L / nL;
    const mX = Math.ceil(Math.max(2.2 * dm, 0.2 * L) / hx);
    const hz = dm / 8, mZ = Math.ceil(Math.max(2.2 * dm, 0.2 * L) / hz);
    const nx = nL + 2 * mX + 1, nz = 8 + 2 * mZ + 1;
    return { L: L, d: dm, hx: hx, hz: hz, nx: nx, nz: nz, i0: mX, i1: mX + nL,
             jBot: mZ, jTop: mZ + 8, x0: -mX * hx, z0: -(mZ + 4) * hz };
  }

  /* Relative permittivity of every CELL for a slab whose right-hand face is
     at s (it enters from the left and is as long as the plates), of
     thickness t, resting on the lower plate. A cell cut by a slab face gets
     the area-weighted mix, so the capacitance moves smoothly with s instead
     of in steps of one cell. */
  function capEps(Gd, s, t, K, cfg, K2) {
    /* The dielectric, as rectangles in the section: a slab as long as the
       plates sliding in from the left; two dielectrics side by side, each
       filling half the plate; or two layers stacked across the gap. */
    const L = Gd.L, zb = -Gd.d / 2, zt = Gd.d / 2, rects = [];
    if (cfg === 'side') { rects.push([0, L / 2, zb, zt, K], [L / 2, L, zb, zt, K2]); }
    else if (cfg === 'stack') { rects.push([0, L, zb, zb + t, K], [0, L, zb + t, zt, K2]); }
    else rects.push([s - L, s, zb, zb + t, K]);
    const cw = Gd.nx - 1, ch = Gd.nz - 1, e = new Float64Array(cw * ch);
    for (let j = 0; j < ch; j++) {
      const za = Gd.z0 + j * Gd.hz, zc = za + Gd.hz;
      for (let i = 0; i < cw; i++) {
        const xa = Gd.x0 + i * Gd.hx, xc = xa + Gd.hx;
        let v = 1;
        // area-weighted mixing: a cell cut by a face gets the right share of each side
        for (const r of rects) {
          const fx = Math.max(0, Math.min(xc, r[1]) - Math.max(xa, r[0])) / Gd.hx;
          const fz = Math.max(0, Math.min(zc, r[3]) - Math.max(za, r[2])) / Gd.hz;
          v += (r[4] - 1) * fx * fz;
        }
        e[j * cw + i] = v;
      }
    }
    return e;
  }

  /* Successive over-relaxation on the finite-volume form of ∇·(ε∇φ) = 0.
     Each node's four couplings use the permittivity of the two cells that
     share that edge, which is what makes the normal D continuous across the
     slab's face without any special treatment. Warm-started from the last
     solution, a small move of the slab converges in a few dozen sweeps. */
  function capSolve(Gd, eps, phi, tol) {
    const nx = Gd.nx, nz = Gd.nz, cw = nx - 1;
    const rx = Gd.hz / Gd.hx, rz = Gd.hx / Gd.hz;
    if (!phi) {
      phi = new Float64Array(nx * nz);
      for (let j = 0; j < nz; j++) for (let i = 0; i < nx; i++) {
        const z = Gd.z0 + j * Gd.hz;
        phi[j * nx + i] = Math.abs(z) <= Gd.d / 2 && i >= Gd.i0 && i <= Gd.i1 ? z / Gd.d : 0;
      }
    }
    const fixed = (i, j) => (j === Gd.jTop || j === Gd.jBot) && i >= Gd.i0 && i <= Gd.i1;
    for (let i = Gd.i0; i <= Gd.i1; i++) { phi[Gd.jTop * nx + i] = 0.5; phi[Gd.jBot * nx + i] = -0.5; }
    // pre-compute the five weights of every interior node once
    const W = new Float64Array(nx * nz * 4);
    for (let j = 1; j < nz - 1; j++) for (let i = 1; i < nx - 1; i++) {
      const c = (ii, jj) => eps[jj * cw + ii];
      const k = (j * nx + i) * 4;
      W[k] = rx * (c(i, j) + c(i, j - 1)) / 2;          // east
      W[k + 1] = rx * (c(i - 1, j) + c(i - 1, j - 1)) / 2;  // west
      W[k + 2] = rz * (c(i, j) + c(i - 1, j)) / 2;          // north
      W[k + 3] = rz * (c(i, j - 1) + c(i - 1, j - 1)) / 2;  // south
    }
    const om = 1.92;
    let it = 0, dmax = 1;
    while (dmax > tol && it < 4000) {
      dmax = 0;
      for (let j = 1; j < nz - 1; j++) {
        for (let i = 1; i < nx - 1; i++) {
          if (fixed(i, j)) continue;
          const n = j * nx + i, k = n * 4;
          const sw = W[k] + W[k + 1] + W[k + 2] + W[k + 3];
          const tgt = (W[k] * phi[n + 1] + W[k + 1] * phi[n - 1] +
                       W[k + 2] * phi[n + nx] + W[k + 3] * phi[n - nx]) / sw;
          const dd = tgt - phi[n];
          phi[n] += om * dd;
          if (Math.abs(dd) > dmax) dmax = Math.abs(dd);
        }
      }
      it++;
    }
    return { phi: phi, it: it };
  }

  /* Energy per unit depth for ΔV = 1, as a pure number: c = Σ εᵣ|∇φ|² A.
     Then C = ε₀·W·c. For ideal plates with nothing between them c = L/d. */
  function capEnergy(Gd, eps, phi) {
    const nx = Gd.nx, cw = nx - 1, hx = Gd.hx, hz = Gd.hz;
    let c = 0;
    for (let j = 0; j < Gd.nz - 1; j++) for (let i = 0; i < cw; i++) {
      const a = phi[j * nx + i], b = phi[j * nx + i + 1];
      const e = phi[(j + 1) * nx + i], f = phi[(j + 1) * nx + i + 1];
      const Ex = ((b + f) - (a + e)) / (2 * hx), Ez = ((e + f) - (a + b)) / (2 * hz);
      c += eps[j * cw + i] * (Ex * Ex + Ez * Ez) * hx * hz;
    }
    return c;
  }

  /* The ideal-plate answer, for comparison: the slab region is a series
     stack (air gap d − t, dielectric t), in parallel with the empty part. */
  function capIdeal(dm, s, t, K, cfg, K2) {
    const L = PLATE_L;
    if (cfg === 'side') return EPS0 * PLATE_W * (L / 2) * (K + K2) / dm;          // two capacitors in parallel
    if (cfg === 'stack') return EPS0 * PLATE_W * L / (t / K + (dm - t) / K2);     // two in series
    // the length of slab actually between the plates: its span [s − L, s] against [0, L]
    const sIn = Math.max(0, Math.min(s, L) - Math.max(s - L, 0));
    return EPS0 * PLATE_W * ((L - sIn) / dm + sIn / (dm - t + t / K));
  }
  function capIdealSlope(dm, s, t, K, cfg) {
    if (cfg === 'side' || cfg === 'stack') return 0;
    const k = EPS0 * PLATE_W * (1 / (dm - t + t / K) - 1 / dm);
    return s > 0 && s < PLATE_L ? k : s > PLATE_L && s < 2 * PLATE_L ? -k : 0;
  }

  /* Everything the slab bench needs, rebuilt when anything changes. The
     C(s) curve is solved once per (d, t, K) at 25 slab positions and cached;
     the field at the current position is solved warm from the last one. */
  function capState(S) {
    const p = S.p, dm = p.dmm / 1000, cfg = p.cfg || 'slide', L = PLATE_L;
    const K = p.metal && cfg === 'slide' ? 1000 : p.K, K2 = p.K2;          // a metal slab: K → 1000 is a conductor to 0.1%
    const t = (cfg === 'side' ? 1 : p.tFrac) * dm;
    const key = [dm, t, K, cfg, K2].join('|');
    if (S._capKey !== key) {
      S._capKey = key;
      const Gd = capGrid(dm);
      const ss = [], cs = [];
      let ph = null;
      if (cfg === 'slide') {
        for (let k = -4; k <= 20; k++) {
          const s = k / 16 * L, e = capEps(Gd, s, t, K, cfg, K2);
          ph = capSolve(Gd, e, ph, 1e-7).phi;
          ss.push(s); cs.push(capEnergy(Gd, e, ph));
        }
      } else {
        // nothing slides: the empty capacitor sets the charge a disconnected battery left
        const e0 = capEps(Gd, -2 * L, t, 1, 'slide', 1);
        ph = capSolve(Gd, e0, null, 1e-7).phi;
        const c0 = capEnergy(Gd, e0, ph);
        ss.push(-L, L); cs.push(c0, c0);
      }
      S.Gd = Gd; S.capS = ss; S.capC = cs; S._phiCur = ph.slice(); S._sCur = null;
    }
    const Gd = S.Gd, s = cfg === 'slide' ? p.xIn * L : L;
    if (S._sCur !== s || S._cfgCur !== key) {
      S._cfgCur = key;
      const e = capEps(Gd, s, t, K, cfg, K2);
      S._phiCur = capSolve(Gd, e, S._phiCur, 1e-7).phi;
      S._epsCur = e; S._sCur = s;
      S.cNow = capEnergy(Gd, e, S._phiCur);
      capFieldArt(S);
    }
    const W = EPS0 * PLATE_W;
    /* dc/ds by central differences on the cached curve, interpolated */
    const ss = S.capS, cs = S.capC, n = ss.length;
    const slope = (k) => k <= 0 ? (cs[1] - cs[0]) / (ss[1] - ss[0])
                       : k >= n - 1 ? (cs[n - 1] - cs[n - 2]) / (ss[n - 1] - ss[n - 2])
                       : (cs[k + 1] - cs[k - 1]) / (ss[k + 1] - ss[k - 1]);
    const dcAt = (x) => {
      const u = clamp((x - ss[0]) / (ss[1] - ss[0]), 0, n - 1);
      const k = Math.min(Math.floor(u), n - 2), f = u - k;
      return slope(k) * (1 - f) + slope(k + 1) * f;
    };
    const R = { dm: dm, t: t, K: K, K2: K2, cfg: cfg, s: s, W: W };
    R.C = W * S.cNow;                                // with fringing
    R.Cid = capIdeal(dm, s, t, K, cfg, K2);          // ideal plates
    R.C0 = W * cs[0];                                // slab well outside
    R.C0id = EPS0 * PLATE_W * L / dm;
    R.fringe = R.C / R.Cid - 1;
    /* Disconnected means: charged to V with the slab well away, then the
       battery removed. From then on Q is what is fixed, and V is not. */
    R.Q0 = R.C0 * p.V;
    R.V = p.battery ? p.V : R.Q0 / R.C;
    R.Q = R.C * R.V;
    R.U = 0.5 * R.C * R.V * R.V;
    R.dcds = cfg === 'slide' ? W * dcAt(s) : 0;
    R.F = 0.5 * R.V * R.V * R.dcds;                  // + means pulled in
    R.Vid = p.battery ? p.V : (R.C0id * p.V) / R.Cid;
    R.Qid = R.Cid * R.Vid;
    R.Uid = 0.5 * R.Cid * R.Vid * R.Vid;
    R.Fid = 0.5 * R.Vid * R.Vid * capIdealSlope(dm, s, t, K, cfg);
    R.Eair = R.Vid / (dm - t + t / K);               // air gap above the slab (ideal)
    R.Ediel = R.Eair / K;
    R.Eempty = R.Vid / dm;
    R.sigma = EPS0 * R.Eair;                         // free charge density over the slab
    R.sigmaB = R.sigma * (1 - 1 / K);                // bound charge on the slab's faces
    if (cfg === 'side') {
      /* side by side: the same V across both halves, so the same E in both;
         the charge density differs by the ratio of the K values */
      R.E1 = R.E2 = R.Vid / dm;
      R.sig1 = K * EPS0 * R.E1; R.sig2 = K2 * EPS0 * R.E2;
      R.C1 = EPS0 * PLATE_W * (L / 2) * K / dm; R.C2 = EPS0 * PLATE_W * (L / 2) * K2 / dm;
      R.Q1 = R.C1 * R.Vid; R.Q2 = R.C2 * R.Vid;
    } else if (cfg === 'stack') {
      /* stacked: the same charge on both layers, so the same D; E jumps at
         the interface by K2/K, and the voltage divides in proportion */
      R.sig1 = R.sig2 = R.Qid / (PLATE_W * L);
      R.E1 = R.sig1 / (K * EPS0); R.E2 = R.sig2 / (K2 * EPS0);
      R.V1 = R.E1 * t; R.V2 = R.E2 * (dm - t);
      R.C1 = EPS0 * PLATE_W * L * K / t; R.C2 = EPS0 * PLATE_W * L * K2 / (dm - t);
    }
    R.dcdsFn = dcAt;
    return R;
  }

  /* The pictures drawn from the solved field: a heat map of |E| over the
     section, field lines traced from the charge on the upper plate, and
     where that charge actually sits. */
  function capFieldArt(S) {
    const Gd = S.Gd, phi = S._phiCur, eps = S._epsCur;
    const nx = Gd.nx, nz = Gd.nz, cw = nx - 1, ch = nz - 1, hx = Gd.hx, hz = Gd.hz;
    const Ex = new Float64Array(nx * nz), Ez = new Float64Array(nx * nz);
    for (let j = 1; j < nz - 1; j++) for (let i = 1; i < nx - 1; i++) {
      const n = j * nx + i;
      Ex[n] = -(phi[n + 1] - phi[n - 1]) / (2 * hx);
      Ez[n] = -(phi[n + nx] - phi[n - nx]) / (2 * hz);
    }
    // heat map of |E| per cell, relative to the empty-gap field 1/d
    if (typeof document !== 'undefined') {
      const cv = S._heat || (S._heat = document.createElement('canvas'));
      cv.width = cw; cv.height = ch;
      const cx = cv.getContext('2d'), img = cx.createImageData(cw, ch), E0 = 1 / Gd.d;
      for (let j = 0; j < ch; j++) for (let i = 0; i < cw; i++) {
        const a = phi[j * nx + i], b = phi[j * nx + i + 1];
        const e = phi[(j + 1) * nx + i], f = phi[(j + 1) * nx + i + 1];
        const ex = ((b + f) - (a + e)) / (2 * hx), ez = ((e + f) - (a + b)) / (2 * hz);
        const v = Math.min(1.6, Math.hypot(ex, ez) / E0);
        const k = ((ch - 1 - j) * cw + i) * 4;
        const w = Math.max(0, v - 1) / 0.6;
        img.data[k] = Math.round(30 + 60 * Math.min(1, v) + 150 * w);
        img.data[k + 1] = Math.round(70 + 150 * Math.min(1, v) + 30 * w);
        img.data[k + 2] = Math.round(140 + 110 * Math.min(1, v));
        img.data[k + 3] = Math.round(255 * Math.min(0.90, Math.pow(v, 0.6) * 0.80));
      }
      cx.putImageData(img, 0, 0);
    }
    const fAt = (x, z) => {
      const u = (x - Gd.x0) / hx, w = (z - Gd.z0) / hz;
      if (u < 1 || w < 1 || u > nx - 2 || w > nz - 2) return null;
      const i = Math.floor(u), j = Math.floor(w), a = u - i, b = w - j;
      const n = j * nx + i;
      const bl = (A) => A[n] * (1 - a) * (1 - b) + A[n + 1] * a * (1 - b) +
                        A[n + nx] * (1 - a) * b + A[n + nx + 1] * a * b;
      return [bl(Ex), bl(Ez)];
    };
    // surface charge on both faces of a plate: D just outside each face
    const charge = (jPl, sgn) => {
      const out = [];
      for (let i = Gd.i0; i <= Gd.i1; i++) {
        const iL = Math.max(i - 1, 0), iR = Math.min(i, cw - 1);
        const eUp = (eps[jPl * cw + iL] + eps[jPl * cw + iR]) / 2;
        const eDn = (eps[(jPl - 1) * cw + iL] + eps[(jPl - 1) * cw + iR]) / 2;
        const up = eUp * (phi[jPl * nx + i] - phi[(jPl + 1) * nx + i]) / hz * sgn;
        const dn = eDn * (phi[jPl * nx + i] - phi[(jPl - 1) * nx + i]) / hz * sgn;
        const wgt = (i === Gd.i0 || i === Gd.i1) ? 0.5 : 1;
        out.push({ x: Gd.x0 + i * hx, up: Math.max(0, up) * wgt, dn: Math.max(0, dn) * wgt });
      }
      return out;
    };
    /* place n marks so that each carries the same share of the charge: they
       crowd where σ is high, which is over the slab and at the edges */
    const quant = (list, n, inner) => {
      const seq = [];
      list.forEach(q => seq.push({ x: q.x, side: inner, w: inner < 0 ? q.dn : q.up }));
      list.slice().reverse().forEach(q => seq.push({ x: q.x, side: -inner, w: inner < 0 ? q.up : q.dn }));
      const tot = seq.reduce((a, q) => a + q.w, 0) || 1;
      const out = [];
      let acc = 0, k = 0;
      for (const q of seq) {
        acc += q.w;
        while (k < n && (k + 0.5) / n * tot <= acc) { out.push({ x: q.x, side: q.side }); k++; }
      }
      return out;
    };
    const zt = Gd.d / 2, zb = -Gd.d / 2;
    S.capPlus = quant(charge(Gd.jTop, 1), 24, -1);
    S.capMinus = quant(charge(Gd.jBot, -1), 24, 1);
    const lines = [];
    const step = Math.min(hx, hz) * 0.7;
    S.capPlus.forEach(sd => {
      let x = sd.x, z = zt + sd.side * hz * 0.3;
      const pts = [[x, zt]];
      for (let n = 0; n < 4000; n++) {
        const e1 = fAt(x, z); if (!e1) break;
        const m1 = Math.hypot(e1[0], e1[1]) || 1;
        const e2 = fAt(x + e1[0] / m1 * step / 2, z + e1[1] / m1 * step / 2); if (!e2) break;
        const m2 = Math.hypot(e2[0], e2[1]) || 1;
        const xn = x + e2[0] / m2 * step, zn = z + e2[1] / m2 * step;
        if (xn >= 0 && xn <= PLATE_L && ((z > zb && zn <= zb) || (z < zb && zn >= zb))) {
          pts.push([xn, zb]); break;
        }
        x = xn; z = zn;
        if (n % 2 === 0) pts.push([x, z]);
      }
      lines.push(pts);
    });
    S.capLines = lines;
  }

  /* ---- the circuits: charging, sharing, and networks ----
     RC charging and charge sharing are integrated (RK4 on dq/dt), with the
     heat in the resistor accumulated as ∫i²R dt alongside. Nothing about the
     famous "half the energy is always lost" result is assumed: it falls out
     of the integral, for any R, which is exactly what makes it strange. */
  function rk4q(f, q, h) {
    const a = f(q), b = f(q + a * h / 2), c = f(q + b * h / 2), d = f(q + c * h);
    return q + h / 6 * (a + 2 * b + 2 * c + d);
  }

  function rcRun(p) {
    const R = p.Rk * 1e3, C = p.C1uf * 1e-6, V = p.V, tau = R * C;
    const N = 800, T = 10 * tau, h = T / N;
    const out = { tau: tau, T: T, t: [], q: [], i: [], U: [], Wb: [], H: [], R: R, C: C, V: V };
    let q = 0, Wb = 0, H = 0;
    for (let k = 0; k <= N; k++) {
      const t = k * h, charging = t < 5 * tau;
      const i = charging ? (V - q / C) / R : -(q / C) / R;
      out.t.push(t); out.q.push(q); out.i.push(i);
      out.U.push(q * q / (2 * C)); out.Wb.push(Wb); out.H.push(H);
      if (k === N) break;
      const f = charging ? (qq => (V - qq / C) / R) : (qq => -(qq / C) / R);
      const q2 = rk4q(f, q, h);
      /* heat and battery work over the step, by Simpson on the current */
      const im = f((q + q2) / 2), i2 = f(q2);
      H += R * h / 6 * (i * i + 4 * im * im + i2 * i2);
      if (charging) Wb += V * (q2 - q);
      q = q2;
    }
    out.Q = C * V; out.I0 = V / R;
    return out;
  }

  function shareRun(p) {
    const R = p.Rk * 1e3, C1 = p.C1uf * 1e-6, C2 = p.C2uf * 1e-6;
    const Cs = C1 * C2 / (C1 + C2), tau = R * Cs;
    const pre = 0.8 * tau, N = 800, T = pre + 6 * tau, h = T / N;
    const out = { tau: tau, T: T, pre: pre, t: [], V1: [], V2: [], U: [], H: [], i: [] };
    let q1 = C1 * p.V, q2 = C2 * p.V2, H = 0;
    const Qt = q1 + q2;
    for (let k = 0; k <= N; k++) {
      const t = k * h, on = t >= pre;
      const i = on ? (q1 / C1 - q2 / C2) / R : 0;
      out.t.push(t); out.V1.push(q1 / C1); out.V2.push(q2 / C2); out.i.push(i);
      out.U.push(q1 * q1 / (2 * C1) + q2 * q2 / (2 * C2)); out.H.push(H);
      if (k === N) break;
      if (!on) continue;
      /* q2 = Qt − q1: charge is conserved exactly, by construction */
      const f = qq => -((qq / C1 - (Qt - qq) / C2) / R);
      const n1 = rk4q(f, q1, h);
      const ia = -f(q1), im = -f((q1 + n1) / 2), ib = -f(n1);
      H += R * h / 6 * (ia * ia + 4 * im * im + ib * ib);
      q1 = n1; q2 = Qt - q1;
    }
    out.Vf = Qt / (C1 + C2);
    out.U0 = out.U[0];
    out.Uf = 0.5 * (C1 + C2) * out.Vf * out.Vf;
    out.lossTheory = 0.5 * Cs * Math.pow(p.V - p.V2, 2);
    out.Qt = Qt; out.Cs = Cs;
    return out;
  }

  /* A capacitor network in steady state is a nodal problem: with every node
     starting uncharged, the charge on each isolated node sums to zero, which
     is Kirchhoff's current law with C in place of 1/R. So SOLVE.Net does it
     as it stands, with conductances C (in μF). */
  function capNetwork(p) {
    const C = [p.C1uf, p.C2uf, p.C3uf];
    let edges, nN;
    if (p.topo === 'series') { nN = 4; edges = [[1, 2, 0], [2, 3, 1], [3, 0, 2]]; }
    else if (p.topo === 'parallel') { nN = 2; edges = [[1, 0, 0], [1, 0, 1], [1, 0, 2]]; }
    else { nN = 3; edges = [[1, 2, 0], [2, 0, 1], [2, 0, 2]]; }  // C1 then (C2 ∥ C3)
    const N = SV.Net(nN);
    edges.forEach(e => N.res(e[0], e[1], 1 / C[e[2]]));
    N.bat(0, 1, p.V, 0);
    const sol = N.solve();
    const V = sol.V || new Array(nN).fill(0);
    const caps = edges.map(e => {
      const dv = V[e[0]] - V[e[1]], c = C[e[2]] * 1e-6;
      return { k: e[2], C: c, V: dv, Q: c * dv, U: 0.5 * c * dv * dv };
    });
    const Qin = caps.filter((c, i) => edges[i][0] === 1).reduce((a, c) => a + c.Q, 0);
    const out = { caps: caps, Ceq: Qin / p.V, Qin: Qin, V: V };
    out.U = caps.reduce((a, c) => a + c.U, 0);
    return out;
  }

  /* one closed form per topology, used for the sweep in the graph and to
     check the nodal answer */
  function ceqClosed(topo, C1, C2, C3) {
    if (topo === 'series') return 1 / (1 / C1 + 1 / C2 + 1 / C3);
    if (topo === 'parallel') return C1 + C2 + C3;
    return 1 / (1 / C1 + 1 / (C2 + C3));
  }


  /* a white breadboard: rows of contact holes and red/blue power rails */
  let BB_TEX = null;
  function breadboardTex() {
    if (BB_TEX || typeof document === 'undefined') return BB_TEX;
    const c = document.createElement('canvas'); c.width = 1024; c.height = 600;
    const x = c.getContext('2d');
    x.fillStyle = '#ECEAE2'; x.fillRect(0, 0, 1024, 600);
    x.fillStyle = 'rgba(0,0,0,.05)'; x.fillRect(0, 292, 1024, 16);
    [[30, '#D23A3A'], [48, '#2F62C8'], [552, '#D23A3A'], [570, '#2F62C8']].forEach(q => {
      x.strokeStyle = q[1]; x.lineWidth = 2; x.beginPath(); x.moveTo(20, q[0]); x.lineTo(1004, q[0]); x.stroke();
    });
    x.fillStyle = '#3B3B3B';
    for (let i = 0; i < 60; i++) {
      const u = 30 + i * 16.3;
      [38, 562].forEach(y => { x.fillRect(u, y - 3, 5, 5); x.fillRect(u, y + 9, 5, 5); });
      for (let j = 0; j < 5; j++) { x.fillRect(u, 90 + j * 38, 5, 5); x.fillRect(u, 330 + j * 38, 5, 5); }
    }
    return (BB_TEX = c);
  }
  L.register({
    id: 'capacitance', subject: 'physics',
    name: 'Capacitors — Dielectrics, Energy and the Pull on a Slab',
    chapter: 'Electrostatic Potential and Capacitance',
    exams: ['JEE Main', 'JEE Advanced', 'NEET UG'],
    weight: 'Very high yield',
    is3D: true,
    stageHint: 'Slab: drag it in and out, the glowing sheet is the solved field · circuits run by themselves',
    lede: 'The field in this capacitor is not drawn from a formula. It is <b>solved</b>: Laplace\'s ' +
      'equation on a grid across the plates, with the slab\'s permittivity painted into the cells it ' +
      'fills. So the field bulges out past the edges, as a real one does. The capacitance is read from ' +
      'the stored energy, and the <b>force on the slab</b> from how that energy changes as it moves. ' +
      'Between ideal plates the field is perpendicular to the slab and cannot pull it at all; the pull ' +
      'comes from the fringe at the edge. The grid keeps that fringe, and still gets the textbook ' +
      'answer exactly. Then switch the battery off, and every energy answer changes direction.',

    params: { mode: 'slab', cfg: 'slide', dmm: 15, K: 4, K2: 2, metal: false, tFrac: 1, xIn: 0.5, V: 200, battery: true,
              Rk: 100, C1uf: 100, C2uf: 50, C3uf: 6, V2: 0, topo: 'mixed',
              showLines: true, run: true },

    presets: [
      { name: 'Slab half in · battery on', params: { mode: 'slab', cfg: 'slide', metal: false, dmm: 15, K: 4, tFrac: 1, xIn: 0.5, V: 200, battery: true } },
      { name: 'Slab half in · battery off', params: { mode: 'slab', cfg: 'slide', metal: false, dmm: 15, K: 4, tFrac: 1, xIn: 0.5, V: 200, battery: false } },
      { name: 'Thin slab, t = d/2', params: { mode: 'slab', cfg: 'slide', metal: false, dmm: 15, K: 5, tFrac: 0.5, xIn: 1, V: 200, battery: true } },
      { name: 'Slab just reaching the edge', params: { mode: 'slab', cfg: 'slide', metal: false, dmm: 15, K: 4, tFrac: 1, xIn: 0, V: 200, battery: true } },
      { name: 'Metal-like slab, K = 10', params: { mode: 'slab', cfg: 'slide', metal: false, dmm: 15, K: 10, tFrac: 0.6, xIn: 1, V: 200, battery: true } },
      { name: 'Two dielectrics side by side', params: { mode: 'slab', cfg: 'side', dmm: 15, K: 4, K2: 2, V: 200, battery: true } },
      { name: 'Two layers stacked', params: { mode: 'slab', cfg: 'stack', dmm: 15, K: 4, K2: 2, tFrac: 0.5, V: 200, battery: true } },
      { name: 'Metal slab, half the gap', params: { mode: 'slab', cfg: 'slide', metal: true, dmm: 15, tFrac: 0.5, xIn: 1, V: 200, battery: true } },
      { name: 'Charging through R', params: { mode: 'rc', Rk: 100, C1uf: 100, V: 12 } },
      { name: 'Same C, 10× the resistance', params: { mode: 'rc', Rk: 1000, C1uf: 100, V: 12 } },
      { name: 'Sharing charge', params: { mode: 'share', C1uf: 100, C2uf: 50, V: 12, V2: 0, Rk: 100 } },
      { name: 'Opposite charges meet', params: { mode: 'share', C1uf: 100, C2uf: 100, V: 12, V2: -12, Rk: 100 } },
      { name: 'Network · C₁ then C₂ ∥ C₃', params: { mode: 'network', topo: 'mixed', C1uf: 2, C2uf: 3, C3uf: 6, V: 12 } },
      { name: 'Network · all in series', params: { mode: 'network', topo: 'series', C1uf: 2, C2uf: 3, C3uf: 6, V: 12 } }
    ],

    controls: [
      { group: 'Arrangement', items: [
        { key: 'mode', type: 'select', label: 'What is set up', restructure: true, options: [
          { value: 'slab', label: 'Dielectric slab' }, { value: 'rc', label: 'Charging (RC)' },
          { value: 'share', label: 'Sharing charge' }, { value: 'network', label: 'Network' }] }
      ] },
      { group: 'The parallel plates', items: [
        { key: 'cfg', type: 'select', label: 'Dielectric arrangement', restructure: true, options: [
          { value: 'slide', label: 'Slab slides in' }, { value: 'side', label: 'Side by side' }, { value: 'stack', label: 'Stacked' }] },
        { key: 'dmm', label: 'Plate gap <i>d</i>', min: 5, max: 20, step: 0.5, unit: 'mm',
          fmt: v => v.toFixed(1), restructure: true },
        { key: 'K', label: 'Dielectric constant <i>K</i>', min: 1, max: 10, step: 0.1, unit: '',
          fmt: v => v.toFixed(1), restructure: true },
        { key: 'K2', label: 'Second dielectric <i>K</i>₂', min: 1, max: 10, step: 0.1, unit: '',
          fmt: v => v.toFixed(1), restructure: true },
        { key: 'metal', type: 'toggle', label: 'Make the slab metal', restructure: true },
        { key: 'tFrac', label: 'Slab thickness <i>t</i> ÷ <i>d</i>', min: 0.1, max: 1, step: 0.01, unit: '',
          fmt: v => v.toFixed(2), restructure: true },
        { key: 'xIn', label: 'How far the slab is in', min: -0.25, max: 1.25, step: 0.005, unit: '× L',
          fmt: v => v.toFixed(3), restructure: true },
        { key: 'battery', type: 'toggle', label: 'Battery stays connected', restructure: true }
      ] },
      { group: 'Supply', items: [
        { key: 'V', label: 'Battery <i>V</i> (or <i>V</i>₁)', min: -500, max: 500, step: 1, unit: 'V',
          fmt: v => v.toFixed(0), restructure: true }
      ] },
      { group: 'The circuit', items: [
        { key: 'Rk', label: 'Resistance <i>R</i>', min: 1, max: 1000, step: 1, unit: 'kΩ',
          fmt: v => v.toFixed(0), restructure: true },
        { key: 'C1uf', label: '<i>C</i>₁', min: 1, max: 500, step: 1, unit: 'μF',
          fmt: v => v.toFixed(0), restructure: true },
        { key: 'C2uf', label: '<i>C</i>₂', min: 1, max: 500, step: 1, unit: 'μF',
          fmt: v => v.toFixed(0), restructure: true },
        { key: 'C3uf', label: '<i>C</i>₃', min: 1, max: 500, step: 1, unit: 'μF',
          fmt: v => v.toFixed(0), restructure: true },
        { key: 'V2', label: 'Start voltage on <i>C</i>₂', min: -500, max: 500, step: 1, unit: 'V',
          fmt: v => v.toFixed(0), restructure: true },
        { key: 'topo', type: 'select', label: 'Network', restructure: true, options: [
          { value: 'series', label: 'Series' }, { value: 'parallel', label: 'Parallel' },
          { value: 'mixed', label: 'C₁ + (C₂∥C₃)' }] }
      ] },
      { group: 'Display', items: [
        { key: 'showLines', type: 'toggle', label: 'Show field lines and charges' },
        { key: 'run', type: 'toggle', label: 'Let it run' }
      ] }
    ],

    setup(S) {
      const p = S.p;
      S.t2 = S.t2 || 0;
      if (p.mode === 'slab') {
        if (p.dmm < 5) p.dmm = 5;
        S.R = capState(S);
      } else if (p.mode === 'rc') {
        S.R = rcRun(p);
        S.slow = S.R.T / 12;                           // the full cycle in 12 s
      } else if (p.mode === 'share') {
        S.R = shareRun(p);
        S.slow = S.R.T / 9;
      } else {
        S.R = capNetwork(p);
        S.slow = 1;
      }
      if (S._lastMode !== p.mode) { S.t2 = 0; S._lastMode = p.mode; }
      const view = p.mode === 'slab' ? { theta: -1.18, phi: 0.36, dist: 2.35, target: [0.42, 0, 0.0] }
                 : { theta: -1.50, phi: 0.78, dist: 2.55, target: [0, 0, 0.0] };
      const vk = p.mode === 'slab' ? 'slab' : 'circuit';
      if (!S.cam || S._viewMode !== vk) {
        S.cam = Camera(view);
        S.cam.minDist = 1.2; S.cam.maxDist = 12;
        S._viewMode = vk;
      }
    },

    step(S, dt) {
      const p = S.p;
      if (!p.run || p.mode === 'slab' || p.mode === 'network') return;
      S.t2 += dt * S.slow;
      if (S.t2 > S.R.T) S.t2 = 0;
    },

    drawStage(S, g) {
      const ctx = g.ctx, th = g.theme, p = S.p, W = g.w, H = g.h, R = S.R;
      const cam = S.cam, acc = th.phys;
      const F = R3.Frame(ctx, cam, { ambient: 0.26, floorZ: p.mode === 'slab' ? null : 0 });
      const plus = '#FF6B6B', minus = '#5AA9FF', copper = '#D9A05B';
      let hdl = null;
      /* DEPTH POLICY (§14.6): the board carries F.GROUND. The section sheet
         and its field lines are decoration on the capacitor, so they take a
         few hundredths; plates, slab and components sort on true depth. */

      if (p.mode === 'slab') {
        if (W < 660 && !S._narrowCam) { cam.dist *= 1.35; S._narrowCam = true; }
        const k = 10, Gd = S.Gd, L = PLATE_L;
        const dm = R.dm, t = R.t, s = R.s, pt = 0.018;
        const zT = dm / 2 * k, zB = -dm / 2 * k;
        const yF = -PLATE_W / 2 * k;
        const B = window.BENCH, cfg = R.cfg;
        /* a wooden base, and clear acrylic posts that hold each plate by its
           back corners: insulating, so nothing leaks the charge away */
        const zBase = zB - pt - 0.30;
        B.texBox(F, [0.55, 0.05, zBase], [2.1, 1.25, 0.04], B.wood('#7A5230', 29), { bias: F.GROUND, tiles: 3, ambient: 0.5 });
        [[0.04, 0.56], [0.96, 0.56]].forEach(q => {
          R3.box(F, [q[0], q[1], (zBase + zT + pt) / 2], [0.04, 0.04, zT + pt - zBase], '#A9D8EE', { shadow: false, ambient: 0.65 });
          R3.box(F, [q[0], 0.53, zT + pt / 2], [0.04, 0.06, pt], '#A9D8EE', { shadow: false, ambient: 0.65 });
          R3.box(F, [q[0], 0.53, zB - pt / 2], [0.04, 0.06, pt], '#A9D8EE', { shadow: false, ambient: 0.65 });
        });
        const alu = B.metal('#C4CCD8', 23);
        const matCol = (K, metal) => metal ? '#AEB6C2' : K < 2.5 ? '#E6D08A' : K < 6 ? '#8FD0E0' : '#D9A441';
        const matName = (K, metal) => metal ? 'metal' : K < 2.5 ? 'paraffin/paper' : K < 6 ? 'glass' : 'mica/ceramic';
        /* The plates and the slab are cut at the same x-boundaries: the edges
           of the plates and the ends of the slab. R3.box sorts each face by
           its own centre, so a slab piece and the plate piece above it must
           share a centre, or a large face of one sorts past the other and the
           slab is painted over the plate that covers it (seen from behind). */
        const cuts = (cfg === 'side' ? [0, L / 2, L] : cfg === 'stack' ? [0, L] : [s - L, 0, L, s])
          .filter((v, i, a) => a.indexOf(v) === i).sort((a, b) => a - b);
        for (let i = 0; i < cuts.length - 1; i++) {
          const a = cuts[i], b = cuts[i + 1], mid = (a + b) / 2, w = b - a;
          if (w < 1e-6) continue;
          if (a >= 0 - 1e-9 && b <= L + 1e-9) {
            B.texBox(F, [mid * k, 0, zT + pt / 2], [w * k, PLATE_W * k, pt], alu, { ambient: 0.5 });
            B.texBox(F, [mid * k, 0, zB - pt / 2], [w * k, PLATE_W * k, pt], alu, { ambient: 0.5 });
          }
          if (cfg === 'slide' && a >= s - L - 1e-9 && b <= s + 1e-9) {
            if (p.metal) B.texBox(F, [mid * k, 0, zB + t * k / 2], [w * k, PLATE_W * k * 0.97, t * k], alu, { ambient: 0.5 });
            else R3.box(F, [mid * k, 0, zB + t * k / 2], [w * k, PLATE_W * k * 0.97, t * k], matCol(p.K), { shadow: false, ambient: 0.5 });
          }
          if (cfg === 'side') R3.box(F, [mid * k, 0, 0], [w * k, PLATE_W * k * 0.97, dm * k], matCol(mid < L / 2 ? p.K : p.K2), { shadow: false, ambient: 0.5 });
        }
        if (cfg === 'stack') {
          R3.box(F, [L / 2 * k, 0, zB + t * k / 2], [L * k, PLATE_W * k * 0.97, t * k], matCol(p.K), { shadow: false, ambient: 0.5 });
          R3.box(F, [L / 2 * k, 0, zB + t * k + (dm - t) * k / 2], [L * k, PLATE_W * k * 0.97, (dm - t) * k], matCol(p.K2), { shadow: false, ambient: 0.5 });
        }
        const labAt = (x, z, txt, c) => R3.label(F, [x, yF - 0.03, z], txt, c, { size: 10 });
        if (cfg === 'slide') labAt((s - L) * k + 0.62, zB - pt - 0.07, (p.metal ? 'metal slab' : 'slab K = ' + p.K.toFixed(1) + ' · ' + matName(p.K)), '#F2C879');
        else if (cfg === 'side') { labAt(L / 4 * k, zB - pt - 0.07, 'K₁ = ' + p.K.toFixed(1), '#F2C879'); labAt(3 * L / 4 * k, zB - pt - 0.07, 'K₂ = ' + p.K2.toFixed(1), '#9AD0FF'); }
        else { labAt(-0.12, zB + t * k / 2, 'K₁ = ' + p.K.toFixed(1), '#F2C879'); labAt(-0.12, zB + t * k + (dm - t) * k / 2 + 0.03, 'K₂ = ' + p.K2.toFixed(1), '#9AD0FF'); }
        // the solved field, on the front section
        if (S._heat && Gd) {
          const xw = (Gd.nx - 1) * Gd.hx, zh = (Gd.nz - 1) * Gd.hz;
          /* The sheet is cut into vertical strips at the same x-boundaries as
             the plates and dielectrics. Each strip then sorts against the box
             face directly behind it (§14.6): drawn as one sheet it was sorted
             by its centre, and a dielectric further along x — nearer the
             camera — painted straight over it. */
          const zc2 = (Gd.z0 + zh / 2) * k, img = S._heat;
          const xs = [Gd.x0, Gd.x0 + xw].concat(cuts.filter(v => v > Gd.x0 && v < Gd.x0 + xw)).sort((u, v) => u - v);
          let nearest = null, nearD = Infinity;
          for (let q = 0; q < xs.length - 1; q++) {
            const xa = xs[q], xb = xs[q + 1];
            if (xb - xa < 1e-6) continue;
            const anchor = [(xa + xb) / 2 * k, yF - 0.006, zc2];
            const dd = F.depth(anchor);
            if (dd < nearD) { nearD = dd; nearest = anchor; }
            const u0 = (xa - Gd.x0) / xw * img.width, u1 = (xb - Gd.x0) / xw * img.width;
            const P0 = [xa * k, yF - 0.006, (Gd.z0 + zh) * k], P1 = [xb * k, yF - 0.006, (Gd.z0 + zh) * k], P3 = [xa * k, yF - 0.006, Gd.z0 * k];
            F.push(anchor, () => {
              const qa = cam.project(P0), qb = cam.project(P1), qd = cam.project(P3);
              if (!qa.ok || !qb.ok || !qd.ok) return;
              const qc = { x: qb.x + qd.x - qa.x, y: qb.y + qd.y - qa.y };
              const sw = u1 - u0, sh = img.height;
              ctx.save();
              ctx.beginPath(); ctx.moveTo(qa.x, qa.y); ctx.lineTo(qb.x, qb.y); ctx.lineTo(qc.x, qc.y); ctx.lineTo(qd.x, qd.y); ctx.closePath(); ctx.clip();
              ctx.globalAlpha = 0.95;
              ctx.transform((qb.x - qa.x) / sw, (qb.y - qa.y) / sw, (qd.x - qa.x) / sh, (qd.y - qa.y) / sh, qa.x, qa.y);
              ctx.drawImage(img, u0, 0, sw, sh, 0, 0, sw, sh);
              ctx.restore();
            }, -0.02);
          }
          const secC = nearest || [(Gd.x0 + xw / 2) * k, yF - 0.006, zc2];
          /* Field lines and charge marks belong to the section, so they are
             drawn in ONE item sorted with it: seen from behind, the plates
             then hide them, instead of the marks floating in front the way
             free labels do. */
          if (p.showLines && S.capLines) {
            F.push(secC, () => {
              const yl = yF - 0.012;
              ctx.save();
              ctx.strokeStyle = g.alpha('#F4F8FF', .75); ctx.lineWidth = 1.1;
              S.capLines.forEach(l => {
                ctx.beginPath(); let pen = false;
                l.forEach(q => {
                  const r = cam.project([q[0] * k, yl, q[1] * k]);
                  if (!r.ok) { pen = false; return; }
                  if (!pen) { ctx.moveTo(r.x, r.y); pen = true; } else ctx.lineTo(r.x, r.y);
                });
                ctx.stroke();
              });
              ctx.font = '700 11px "IBM Plex Mono",monospace';
              ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
              const mark = (at, txt, col, size) => {
                const r = cam.project(at); if (!r.ok) return;
                if (size) ctx.font = '700 ' + size + 'px "IBM Plex Mono",monospace';
                ctx.lineWidth = 3; ctx.strokeStyle = 'rgba(5,8,15,.85)';
                ctx.strokeText(txt, r.x, r.y); ctx.fillStyle = col; ctx.fillText(txt, r.x, r.y);
              };
              S.capPlus.forEach(q => mark([q.x * k, yl, q.side < 0 ? zT + 0.006 : zT + pt + 0.022], '+', plus));
              S.capMinus.forEach(q => mark([q.x * k, yl, q.side > 0 ? zB - 0.006 : zB - pt - 0.022], '−', minus));
              /* bound charge on the slab's faces, only where the slab is
                 between the plates: it cancels part of the free charge's
                 field inside the dielectric */
              const x0 = Math.max(0, s - L), x1 = Math.min(L, s);
              if (cfg === 'slide' && !p.metal && x1 > x0 && p.K > 1.05) {
                const nb = Math.max(1, Math.round(16 * (x1 - x0) / L * (1 - 1 / p.K)));
                for (let i = 0; i < nb; i++) {
                  const xx = (x0 + (i + 0.5) / nb * (x1 - x0)) * k;
                  mark([xx, yl, zB + t * k - 0.010], '−', RX.mix(minus, '#FFFFFF', .35), 8.5);
                  mark([xx, yl, zB + 0.010], '+', RX.mix(plus, '#FFFFFF', .35), 8.5);
                }
              }
              ctx.restore();
            }, -0.021);
          }
        }
        /* the supply, the switch in its lead, and the meters that tell the
           story: the voltmeter across the plates, the charge meter in the lead */
        const sx = L * k + 0.55;
        R3.box(F, [sx, 0.15, zBase + 0.16], [0.36, 0.30, 0.28], '#2A3040', { shadow: false, ambient: 0.4 });
        B.meter(F, [sx, -0.005, zBase + 0.22], [0, -1, 0], 0.26, 0.10, { title: 'SUPPLY', value: p.V.toFixed(0), unit: 'V', colour: '#FFD36B', depth: 0.01 });
        R3.cylinder(F, [sx + 0.10, -0.001, zBase + 0.08], [sx + 0.10, -0.03, zBase + 0.08], 0.025, '#1A1C22', { segments: 18, shadow: false });
        const plugR = [sx - 0.06, -0.005, zBase + 0.08], plugK = [sx + 0.0, -0.005, zBase + 0.08];
        R3.sphere(F, plugR, 0.014, '#E03A3A', { shadow: false }); R3.sphere(F, plugK, 0.014, '#2A2A2A', { shadow: false });
        const swAt = [L * k + 0.22, -0.2, zT + pt / 2 + 0.12];
        const lead = (pts, col) => B.string(F, pts, { r: 0.0055, colour: col });
        lead([plugR, [sx - 0.1, -0.2, zBase + 0.2], [swAt[0] + 0.05, swAt[1], swAt[2]]], '#E03A3A');
        if (p.battery) lead([[swAt[0] - 0.05, swAt[1], swAt[2]], [L * k, -0.1, zT + pt / 2]], '#E03A3A');
        else lead([[swAt[0] - 0.14, swAt[1], swAt[2] - 0.02], [L * k, -0.1, zT + pt / 2]], '#E03A3A');
        R3.box(F, [swAt[0], swAt[1], swAt[2] - 0.02], [0.12, 0.05, 0.02], '#30343E', { shadow: false });
        R3.cylinder(F, [swAt[0] + 0.05, swAt[1], swAt[2]], p.battery ? [swAt[0] - 0.05, swAt[1], swAt[2]] : [swAt[0] - 0.02, swAt[1], swAt[2] + 0.09],
                    0.005, '#E8EEF8', { segments: 8, shadow: false });
        R3.label(F, [swAt[0], swAt[1], swAt[2] + 0.13], p.battery ? 'switch closed' : 'switch open · Q now fixed', p.battery ? th.ok : th.warn, { size: 9.5 });
        lead([plugK, [sx - 0.02, -0.25, zBase + 0.1], [L * k, -0.1, zB - pt / 2]], '#2A2A2A');
        // voltmeter across the plates, and a charge meter
        // the meters stand on a raised panel behind the plates, where the student can see them
        const mX = 0.15, mY = 0.72, mZ = zT + 0.26;
        R3.box(F, [mX + 0.2, mY + 0.03, (zBase + mZ + 0.12) / 2], [0.80, 0.04, mZ + 0.12 - zBase], '#232A3A', { shadow: false, ambient: 0.35 });
        B.meter(F, [mX, mY, mZ], [0, -1, 0], 0.34, 0.15, { title: 'VOLTMETER · plates', value: R.Vid.toFixed(1), unit: 'V', colour: p.battery ? '#7CF0B0' : '#FFD36B' });
        B.meter(F, [mX + 0.40, mY, mZ], [0, -1, 0], 0.34, 0.15, { title: 'CHARGE METER', value: (R.Qid * 1e9).toFixed(3), unit: 'nC', colour: '#9AD0FF' });
        lead([[mX - 0.1, mY - 0.02, mZ - 0.1], [0.05, 0.45, zT + pt / 2]], '#E03A3A');
        lead([[mX + 0.0, mY - 0.02, mZ - 0.12], [0.05, 0.45, zB - pt / 2]], '#2A2A2A');
        // the force on the slab, as an arrow on the part that sticks out
        const Fref = Math.max(Math.abs(R.F), 1e-18);
        if (cfg !== 'slide') {
          // nothing slides in these arrangements
        } else if (Math.abs(R.F) > 1e-12) {
          const dir = Math.sign(R.F);
          const gx = Math.max((s - L) * k - 0.22, -1.25);
          R3.cylinder(F, [gx, yF + 0.25, zB + t * k / 2], [gx + 0.18, yF + 0.25, zB + t * k / 2], 0.02, '#D8DEE8', { segments: 14, shadow: false });
          B.string(F, [[gx + 0.18, yF + 0.25, zB + t * k / 2], [(s - L) * k, yF + 0.25, zB + t * k / 2]], { r: 0.003 });
          B.meter(F, [gx + 0.09, yF + 0.2, zB + t * k / 2 + 0.07], [0, -1, 0], 0.18, 0.07,
                  { title: 'FORCE GAUGE', value: (R.F * 1e6).toFixed(2), unit: 'μN', colour: '#7CF0B0', depth: 0.02 });
          const ax = Math.max((s - L) * k + 0.10, -1.05), az = zB + t * k + 0.10;
          R3.arrow(F, [ax, yF - 0.03, az], [ax + dir * 0.30, yF - 0.03, az], 0.012, th.ok,
                   { head: 0.05, shadow: false, ambient: 0.85, bias: -0.04 });
          R3.label(F, [ax + dir * 0.15, yF - 0.03, az + 0.13],
                   'F = ' + (R.F * 1e6).toFixed(2) + ' μN · ' + (dir > 0 ? 'pulled in' : 'pushed out'),
                   th.ok, { size: 10 });
          void Fref;
        } else {
          R3.label(F, [(s - L) * k + 0.25, yF - 0.03, zB + t * k + 0.12], 'no pull here', th['text-3'], { size: 9.5 });
        }
        // the drag handle sits on the slab's outer end
        const hp = [Math.max((s - L) * k + 0.03, -1.2), yF, zB + t * k / 2];
        const qh = cam.project(hp);
        if (qh.ok && cfg === 'slide') {
          hdl = { x: qh.x, y: qh.y, r: 13, tip: 'drag the slab' };
          const qb = cam.project([hp[0] + 1, hp[1], hp[2]]);
          if (qb.ok) {
            const dx = qb.x - qh.x, dy = qb.y - qh.y, Lp = Math.hypot(dx, dy) || 1;
            S._axS = { ux: dx / Lp, uy: dy / Lp };
          }
        }
      }

      else {
        /* ---- a breadboard with real components on it ---- */
        const zc = 0.07, B = window.BENCH;
        B.texBox(F, [0, 0, -0.03], [2.7, 1.55, 0.06], breadboardTex() || B.metal('#E8E6DE', 3),
                 { bias: F.GROUND, tiles: 3, ambient: 0.55 });
        const P3 = (q) => [q[0], q[1], zc];
        let wireN = 0;
        const wireCols = ['#E03A3A', '#2A2A2A', '#F2C94C', '#3A7BE0', '#3FB950'];
        const wire = (pts) => { B.string(F, pts.map(P3), { r: 0.009, colour: wireCols[(wireN++) % wireCols.length] }); };
        /* an electrolytic capacitor: a sleeved can with a polarity stripe and a
           vented top, standing between two legs; the top glows with charge */
        const cap = (c, axis, frac, tag, sub) => {
          const ex = axis === 'x', o = ex ? [0.09, 0, 0] : [0, 0.09, 0];
          const fa = clamp(frac, -1, 1), h = 0.20, r = 0.07;
          R3.cylinder(F, [c[0], c[1], 0], [c[0], c[1], h], r, '#26458F', { segments: 26, shadow: false, ambient: 0.45 });
          R3.cylinder(F, [c[0], c[1], h], [c[0], c[1], h + 0.006], r * 0.96, '#C9D0DA', { segments: 26, shadow: false, ambient: 0.55 });
          const st = ex ? [0, -1, 0] : [-1, 0, 0];
          R3.box(F, [c[0] + st[0] * r * 0.97, c[1] + st[1] * r * 0.97, h / 2], ex ? [0.03, 0.006, h * 0.95] : [0.006, 0.03, h * 0.95],
                 '#C9D0DA', { shadow: false, ambient: 0.5 });
          R3.polyline(F, [[c[0] - r * 0.5, c[1], h + 0.008], [c[0] + r * 0.5, c[1], h + 0.008]], '#6B7380', { alpha: 1, width: 1.4 });
          R3.polyline(F, [[c[0], c[1] - r * 0.5, h + 0.008], [c[0], c[1] + r * 0.5, h + 0.008]], '#6B7380', { alpha: 1, width: 1.4 });
          if (Math.abs(fa) > 0.01)
            R3.cylinder(F, [c[0], c[1], h + 0.007], [c[0], c[1], h + 0.010], r * 0.85 * Math.sqrt(Math.abs(fa)),
                        fa >= 0 ? '#3DD6F5' : '#FF6B9D', { segments: 22, shadow: false, ambient: 0.95 });
          [-1, 1].forEach(sg => R3.cylinder(F, [c[0] + sg * o[0] * 0.35, c[1] + sg * o[1] * 0.35, 0.004],
                                            [c[0] + sg * o[0], c[1] + sg * o[1], zc], 0.004, '#C8D0DC', { segments: 6, shadow: false }));
          R3.label(F, [c[0], c[1], h + 0.09], tag, '#E6ECF8', { size: 10 });
          if (sub) R3.label(F, [c[0], c[1], h + 0.18], sub, acc, { size: 9.5 });
        };
        /* the resistor's bands are its actual value, in the standard code */
        const bandCols = ['#111111', '#8B4513', '#E02020', '#FF8C00', '#F2D21B', '#20A040', '#2050E0', '#8A2BE2', '#808080', '#F4F4F4'];
        const bandsFor = (ohms) => {
          let m = Math.floor(Math.log10(Math.max(ohms, 1))) - 1, two = Math.round(ohms / Math.pow(10, m));
          if (two >= 100) { two = Math.round(two / 10); m += 1; }
          return [bandCols[Math.floor(two / 10)], bandCols[two % 10], bandCols[clamp(m, 0, 9)], '#D4A017'];
        };
        const res = (a, b, tag, ohms) => {
          R3.cylinder(F, P3(a), P3(b), 0.034, '#D8C29A', { segments: 16, shadow: false, ambient: 0.5 });
          bandsFor(ohms || p.Rk * 1000).forEach((c, i) => {
            const f0 = [0.18, 0.32, 0.46, 0.74][i], f1 = f0 + 0.07;
            R3.cylinder(F, [a[0] + (b[0] - a[0]) * f0, a[1] + (b[1] - a[1]) * f0, zc], [a[0] + (b[0] - a[0]) * f1, a[1] + (b[1] - a[1]) * f1, zc],
                        0.036, c, { segments: 16, shadow: false, ambient: 0.45 });
          });
          R3.label(F, [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2, zc + 0.11], tag, '#E6ECF8', { size: 10 });
        };
        /* two AA cells in a black holder, + terminal towards b */
        const bat = (a, b, tag) => {
          const mid = [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2], ex = Math.abs(b[0] - a[0]) > Math.abs(b[1] - a[1]);
          const len = Math.hypot(b[0] - a[0], b[1] - a[1]);
          R3.box(F, [mid[0], mid[1], 0.035], ex ? [len, 0.16, 0.05] : [0.16, len, 0.05], '#1B1D22', { shadow: false, ambient: 0.35 });
          [-1, 1].forEach(sg => {
            const off = ex ? [0, sg * 0.04] : [sg * 0.04, 0];
            R3.cylinder(F, [a[0] + off[0], a[1] + off[1], 0.075], [b[0] + off[0], b[1] + off[1], 0.075], 0.035, '#2E8B57',
                        { segments: 18, shadow: false, ambient: 0.45 });
          });
          R3.label(F, [mid[0] - (ex ? 0 : 0.18), mid[1], zc + 0.12], tag, acc, { size: 10 });
          R3.label(F, [b[0], b[1], zc + 0.08], '+', plus, { size: 11 });
        };
        /* a handheld multimeter lying on the board, probes to the part it measures */
        const dmm = (at, title, value, unit, probeTo) => {
          R3.box(F, [at[0], at[1], 0.02], [0.30, 0.20, 0.04], '#D8B53A', { shadow: false, ambient: 0.45 });
          B.meter(F, [at[0], at[1] - 0.02, 0.043], [0, -0.35, 0.94], 0.24, 0.10, { title: title, value: value, unit: unit, colour: '#7CF0B0', body: '#D8B53A', depth: 0.004 });
          if (probeTo) {
            B.string(F, [[at[0] - 0.08, at[1] + 0.1, 0.04], [probeTo[0] - 0.03, probeTo[1] - 0.12, 0.10], [probeTo[0] - 0.03, probeTo[1], zc]], { r: 0.005, colour: '#E03A3A' });
            B.string(F, [[at[0] + 0.08, at[1] + 0.1, 0.04], [probeTo[0] + 0.03, probeTo[1] - 0.12, 0.10], [probeTo[0] + 0.03, probeTo[1], zc]], { r: 0.005, colour: '#2A2A2A' });
          }
        };
        const lever = (pv, to) => {
          R3.box(F, [pv[0], pv[1], 0.03], [0.06, 0.05, 0.04], '#30343E', { shadow: false });
          R3.cylinder(F, P3(pv), [to[0], to[1], zc + (to[2] || 0) + 0.02], 0.006, '#E8EEF8', { segments: 8, shadow: false });
        };
        /* moving charge: dots along a path, displaced by the charge that has
           actually passed — so they stop exactly when the current does */
        const flow = (pts, moved, col) => {
          const seg = [], cum = [0];
          for (let i = 1; i < pts.length; i++) {
            const l = Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]);
            seg.push(l); cum.push(cum[i - 1] + l);
          }
          const tot = cum[cum.length - 1], sp = 0.16;
          let off = ((moved % sp) + sp) % sp;
          for (let d = off; d < tot; d += sp) {
            let i = 0; while (i < seg.length - 1 && cum[i + 1] < d) i++;
            const f = (d - cum[i]) / (seg[i] || 1);
            R3.sphere(F, [pts[i][0] + (pts[i + 1][0] - pts[i][0]) * f, pts[i][1] + (pts[i + 1][1] - pts[i][1]) * f, zc + 0.012],
                      0.012, col, { shadow: false, vivid: true });
          }
        };
        const at = (arr) => {
          const T = S.R.t, u = clamp(S.t2 / (S.R.T / (T.length - 1)), 0, T.length - 1);
          const i = Math.min(Math.floor(u), T.length - 2), f = u - i;
          return arr[i] * (1 - f) + arr[i + 1] * f;
        };

        if (p.mode === 'rc') {
          const charging = S.t2 < 5 * R.tau;
          const q = at(R.q), i = at(R.i), Vc = q / R.C;
          bat([-1.0, -0.2], [-1.0, 0.2], 'V = ' + p.V.toFixed(0) + ' V');
          wire([[-1.0, 0.2], [-1.0, 0.45], [-0.80, 0.45]]);
          wire([[-1.0, -0.2], [-1.0, -0.45], [0.95, -0.45], [0.95, -0.10]]);
          wire([[-0.70, -0.45], [-0.70, 0.25]]);
          wire([[-0.55, 0.45], [-0.30, 0.45]]);
          res([-0.30, 0.45], [0.30, 0.45], 'R = ' + p.Rk.toFixed(0) + ' kΩ');
          wire([[0.30, 0.45], [0.95, 0.45], [0.95, 0.10]]);
          cap([0.95, 0], 'y', Vc / Math.max(Math.abs(p.V), 1e-9), 'C = ' + p.C1uf.toFixed(0) + ' μF',
              Vc.toFixed(2) + ' V');
          lever([-0.55, 0.45], charging ? [-0.80, 0.45, 0] : [-0.70, 0.25, 0]);
          R3.label(F, [-0.64, 0.58, zc], charging ? 'charging' : 'discharging', charging ? th.ok : th.warn, { size: 10 });
          const moved = q / Math.max(R.Q, 1e-30) * 1.2;
          if (charging) flow([[-1.0, 0.2], [-1.0, 0.45], [-0.55, 0.45], [0.95, 0.45], [0.95, 0.12]], moved, '#FFE08A');
          else flow([[0.95, 0.12], [0.95, 0.45], [-0.55, 0.45], [-0.70, 0.25], [-0.70, -0.45], [0.95, -0.45], [0.95, -0.12]],
                    -moved, '#FFE08A');
          dmm([0.55, -0.60], 'V across C', Vc.toFixed(2), 'V', [0.95, -0.1]);
          dmm([-0.25, -0.60], 'CURRENT', (i * 1e6).toFixed(1), 'μA', null);
          R3.label(F, [0, -0.40, zc], 'τ = RC = ' + R.tau.toFixed(2) + ' s',
                   th['text-2'], { size: 10 });
        }

        else if (p.mode === 'share') {
          const on = S.t2 >= R.pre;
          const V1 = at(R.V1), V2 = at(R.V2), Vm = Math.max(Math.abs(p.V), Math.abs(p.V2), 1e-9);
          cap([-0.85, 0], 'y', V1 / Vm, 'C₁ = ' + p.C1uf.toFixed(0) + ' μF', V1.toFixed(2) + ' V');
          cap([0.85, 0], 'y', V2 / Vm, 'C₂ = ' + p.C2uf.toFixed(0) + ' μF', V2.toFixed(2) + ' V');
          wire([[-0.85, 0.10], [-0.85, 0.45], [-0.50, 0.45]]);
          wire([[-0.25, 0.45], [0.05, 0.45]]);
          res([0.05, 0.45], [0.55, 0.45], 'R = ' + p.Rk.toFixed(0) + ' kΩ');
          wire([[0.55, 0.45], [0.85, 0.45], [0.85, 0.10]]);
          wire([[-0.85, -0.10], [-0.85, -0.45], [0.85, -0.45], [0.85, -0.10]]);
          lever([-0.50, 0.45], on ? [-0.25, 0.45, 0] : [-0.32, 0.45, 0.16]);
          R3.label(F, [-0.38, 0.62, zc], on ? 'switch closed' : 'switch open', on ? th.ok : th.warn, { size: 10 });
          const C1 = p.C1uf * 1e-6;
          const moved = on ? (p.V - V1) * C1 / Math.max(Math.abs(R.Qt), C1 * Vm) * 1.6 : 0;
          if (on) flow([[-0.85, 0.12], [-0.85, 0.45], [0.85, 0.45], [0.85, 0.12]], moved, '#FFE08A');
          dmm([-0.55, -0.60], 'V₁', V1.toFixed(2), 'V', [-0.85, -0.1]);
          dmm([0.55, -0.60], 'V₂', V2.toFixed(2), 'V', [0.85, -0.1]);
        }

        else {
          const cs = R.caps, Vb = p.V, lab = (c) => (c.Q * 1e6).toFixed(1) + ' μC · ' + c.V.toFixed(2) + ' V';
          const fr = (c) => c.V / Math.max(Math.abs(Vb), 1e-9);
          bat([-1.05, -0.2], [-1.05, 0.2], 'V = ' + Vb.toFixed(0) + ' V');
          wire([[-1.05, 0.2], [-1.05, 0.45]]);
          wire([[-1.05, -0.2], [-1.05, -0.45]]);
          if (p.topo === 'series') {
            wire([[-1.05, 0.45], [-0.55, 0.45]]);
            cap([-0.45, 0.45], 'x', fr(cs[0]), 'C₁ ' + p.C1uf + ' μF', lab(cs[0]));
            wire([[-0.35, 0.45], [0.10, 0.45]]);
            cap([0.20, 0.45], 'x', fr(cs[1]), 'C₂ ' + p.C2uf + ' μF', lab(cs[1]));
            wire([[0.30, 0.45], [0.95, 0.45], [0.95, 0.10]]);
            cap([0.95, 0], 'y', fr(cs[2]), 'C₃ ' + p.C3uf + ' μF', lab(cs[2]));
            wire([[0.95, -0.10], [0.95, -0.45], [-1.05, -0.45]]);
          } else if (p.topo === 'parallel') {
            wire([[-1.05, 0.45], [0.95, 0.45]]);
            wire([[-1.05, -0.45], [0.95, -0.45]]);
            [[-0.35, 0], [0.30, 1], [0.95, 2]].forEach(b => {
              wire([[b[0], 0.45], [b[0], 0.10]]); wire([[b[0], -0.10], [b[0], -0.45]]);
              const c = cs[b[1]];
              cap([b[0], 0], 'y', fr(c), 'C' + '₁₂₃'[b[1]] + ' ' + [p.C1uf, p.C2uf, p.C3uf][b[1]] + ' μF', lab(c));
            });
          } else {
            wire([[-1.05, 0.45], [-0.45, 0.45]]);
            cap([-0.35, 0.45], 'x', fr(cs[0]), 'C₁ ' + p.C1uf + ' μF', lab(cs[0]));
            wire([[-0.25, 0.45], [0.95, 0.45]]);
            wire([[-1.05, -0.45], [0.95, -0.45]]);
            [[0.30, 1], [0.95, 2]].forEach(b => {
              wire([[b[0], 0.45], [b[0], 0.10]]); wire([[b[0], -0.10], [b[0], -0.45]]);
              const c = cs[b[1]];
              cap([b[0], 0], 'y', fr(c), 'C' + '₁₂₃'[b[1]] + ' ' + [p.C1uf, p.C2uf, p.C3uf][b[1]] + ' μF', lab(c));
            });
          }
          dmm([0.1, -0.64], 'CAPACITANCE METER', (R.Ceq * 1e6).toFixed(3), 'μF', null);
          R3.label(F, [0, -0.40, zc], 'C_eq = ' + (R.Ceq * 1e6).toFixed(3) + ' μF · battery delivers ' +
                   (R.Qin * 1e6).toFixed(2) + ' μC', acc, { size: 10.5 });
        }
      }

      F.render();

      if (hdl) {
        const onD = g.dragging === 'slab';
        ctx.save();
        ctx.strokeStyle = onD ? th.text : g.alpha(acc, .75); ctx.lineWidth = onD ? 2.2 : 1.6;
        ctx.beginPath(); ctx.arc(hdl.x, hdl.y, hdl.r, 0, TAU); ctx.stroke(); ctx.restore();
        // below the ring: the force label sits above it
        PA.lbl(ctx, hdl.x, hdl.y + hdl.r + 12, hdl.tip, onD ? th.text : g.alpha(th['text-3'], .95), 'center', 9);
        g.handle(hdl.x, hdl.y, hdl.r + 3, 'slab');
      }

      /* ---------------- instrument panels ---------------- */
      const narrow = W < 660;
      const panel = (bx, by, bw, bh, title) => {
        ctx.fillStyle = g.alpha('#0B1020', .92);
        ctx.strokeStyle = g.alpha(th.line, 1); ctx.lineWidth = 1;
        ctx.beginPath(); ctx.roundRect(bx, by, bw, bh, 8); ctx.fill(); ctx.stroke();
        PA.lbl(ctx, bx + 10, by + 13, title, th['text-3'], 'left', 8.5);
        return (i, kk, v, c) => {
          PA.lbl(ctx, bx + 10, by + 30 + i * 15, kk, th['text-3'], 'left', 9);
          PA.lbl(ctx, bx + bw - 10, by + 30 + i * 15, v, c || th['text-2'], 'right', 9.5);
        };
      };
      const eng = (x, u) => {
        const a = Math.abs(x);
        const pre = a >= 1e6 ? ['M', 1e-6] : a >= 1e3 ? ['k', 1e-3] : a >= 1 ? ['', 1] : a >= 1e-3 ? ['m', 1e3] : a >= 1e-6 ? ['μ', 1e6] : a >= 1e-9 ? ['n', 1e9] : ['p', 1e12];
        return (x * pre[1]).toPrecision(4) + ' ' + pre[0] + u;
      };
      let leftTop = null;
      {
        const rows = p.mode === 'slab' ? (narrow ? 4 : 7) : 5;
        const bw = narrow ? W - 24 : Math.min(W * 0.36, 300), bh = 26 + rows * 15 + 14;
        const bx = 12, by = H - bh - 30;
        leftTop = by;
        if (p.mode === 'slab' && R.cfg !== 'slide') {
          const row = panel(bx, by, bw, bh, R.cfg === 'side' ? 'TWO CAPACITORS IN PARALLEL' : 'TWO CAPACITORS IN SERIES');
          row(0, 'C, solved with fringing', eng(R.C, 'F'), acc);
          row(1, 'C, ideal plates', eng(R.Cid, 'F'));
          if (R.cfg === 'side') {
            row(2, 'C₁ + C₂', eng(R.C1, 'F') + ' + ' + eng(R.C2, 'F'));
            row(3, 'charge Q₁ · Q₂', eng(R.Q1, 'C') + ' · ' + eng(R.Q2, 'C'));
            if (!narrow) { row(4, 'E in each half (the same)', eng(R.E1, 'V/m')); row(5, 'σ₁ ÷ σ₂', (R.sig1 / R.sig2).toFixed(3)); row(6, 'reason', 'same V across both halves', th.ok); }
          } else {
            row(2, '1/C = 1/C₁ + 1/C₂', eng(R.C1, 'F') + ', ' + eng(R.C2, 'F'));
            row(3, 'V₁ · V₂', R.V1.toFixed(2) + ' V · ' + R.V2.toFixed(2) + ' V');
            if (!narrow) { row(4, 'E₁ · E₂', eng(R.E1, 'V/m') + ' · ' + eng(R.E2, 'V/m')); row(5, 'E₁ ÷ E₂ = K₂ ÷ K₁', (R.E1 / R.E2).toFixed(3)); row(6, 'reason', 'same Q (and D) through both', th.ok); }
          }
        } else if (p.mode === 'slab') {
          const row = panel(bx, by, bw, bh, 'THE PULL ON THE SLAB · grid vs ideal plates');
          if (narrow) {
            // on a phone: only the comparison that is the point of the panel
            row(0, 'C, grid · ideal', eng(R.C, 'F') + ' · ' + eng(R.Cid, 'F'), acc);
            row(1, 'V across the plates', R.V.toFixed(2) + ' V', p.battery ? th['text-2'] : th.warn);
            row(2, 'force, grid −dU/dx', eng(R.F, 'N'), th.ok);
            row(3, 'force, ideal formula', eng(R.Fid, 'N'));
          } else {
          row(0, 'C with fringing (grid)', eng(R.C, 'F'), acc);
          row(1, 'C, ideal plates', eng(R.Cid, 'F'));
          row(2, 'fringing adds', (100 * R.fringe).toFixed(1) + ' %');
          row(3, 'V across the plates', R.V.toFixed(2) + ' V', p.battery ? th['text-2'] : th.warn);
          row(4, 'stored energy U', eng(R.U, 'J'));
          row(5, 'force, from −dU/dx on the grid', eng(R.F, 'N'), th.ok);
          row(6, 'force, ideal-plate formula', eng(R.Fid, 'N'));
          }
        } else if (p.mode === 'rc') {
          const k = (arr) => {
            const T = R.t, u = clamp(S.t2 / (R.T / (T.length - 1)), 0, T.length - 1);
            const i = Math.min(Math.floor(u), T.length - 2), f = u - i;
            return arr[i] * (1 - f) + arr[i + 1] * f;
          };
          const row = panel(bx, by, bw, bh, 'WHERE THE ENERGY WENT');
          row(0, 'battery has supplied', eng(k(R.Wb), 'J'));
          row(1, 'stored in C  ½q²/C', eng(k(R.U), 'J'), acc);
          row(2, 'heat in R  ∫i²R dt', eng(k(R.H), 'J'), th.warn);
          row(3, 'heat ÷ stored, charging', S.t2 < 5 * R.tau && k(R.U) > 0 ? (k(R.H) / k(R.U)).toFixed(3) : '—');
          row(4, 'time', (S.t2 / R.tau).toFixed(2) + ' τ');
        } else if (p.mode === 'share') {
          const k = (arr) => {
            const T = R.t, u = clamp(S.t2 / (R.T / (T.length - 1)), 0, T.length - 1);
            const i = Math.min(Math.floor(u), T.length - 2), f = u - i;
            return arr[i] * (1 - f) + arr[i + 1] * f;
          };
          const row = panel(bx, by, bw, bh, 'CHARGE KEPT, ENERGY NOT');
          row(0, 'total charge Q₁ + Q₂', eng(R.Qt, 'C'), th.ok);
          row(1, 'stored energy now', eng(k(R.U), 'J'), acc);
          row(2, 'heat in R so far', eng(k(R.H), 'J'), th.warn);
          row(3, 'final loss, ½·C₁C₂/(C₁+C₂)·ΔV²', eng(R.lossTheory, 'J'));
          row(4, 'common voltage at the end', R.Vf.toFixed(3) + ' V');
        } else {
          const row = panel(bx, by, bw, bh, 'EACH CAPACITOR');
          R.caps.forEach((c, i) => row(i, 'C' + '₁₂₃'[c.k] + ':  Q = ' + (c.Q * 1e6).toFixed(2) + ' μC',
                                       'V = ' + c.V.toFixed(3) + ' V', acc));
          row(3, 'total energy ½C_eq V²', eng(R.U, 'J'));
          row(4, 'check: ½C_eq V² =', eng(0.5 * R.Ceq * p.V * p.V, 'J'), th.ok);
        }
      }
      /* the energy account for a small push of the slab — the battery-on
         versus battery-off question, answered with this capacitor's numbers */
      if (p.mode === 'slab' && !narrow && R.cfg === 'slide') {
        const dC = R.dcds * 1e-3;                       // per mm of insertion
        const V = R.V;
        const bw = narrow ? W - 24 : 236, bh = 26 + 4 * 15 + 12;
        const bx = narrow ? 12 : W - bw - 14;
        const by = narrow ? 40 : H - bh - 30;
        const row = panel(bx, by, bw, bh, 'SLIDE IT IN 1 mm MORE');
        if (p.battery) {
          row(0, 'battery does  V² dC', eng(V * V * dC, 'J'));
          row(1, 'field energy rises  ½V² dC', eng(0.5 * V * V * dC, 'J'), acc);
          row(2, 'work done on the slab', eng(0.5 * V * V * dC, 'J'), th.ok);
          row(3, 'so U goes', 'UP · the battery pays twice', th.warn);
        } else {
          row(0, 'battery does', '0 — it is gone');
          row(1, 'field energy changes', '−' + eng(0.5 * V * V * dC, 'J'), acc);
          row(2, 'work done on the slab', eng(0.5 * V * V * dC, 'J'), th.ok);
          row(3, 'so U goes', 'DOWN · the field pays', th.warn);
        }
        void leftTop;
      }

      ctx.fillStyle = g.alpha(th['text-3'], .95);
      ctx.font = '10px "IBM Plex Mono",monospace'; ctx.textAlign = 'left';
      ctx.fillText(p.mode === 'slab'
        ? 'plates 10 × 10 cm, d = ' + p.dmm.toFixed(1) + ' mm · the front section is solved, ∇·(ε∇φ) = 0'
        : p.mode === 'rc' ? 'charge 5τ, then discharge 5τ · the moving dots are the charge that has passed'
        : p.mode === 'share' ? 'charge is conserved exactly; the energy lost does not depend on R'
        : 'solved as a nodal network with C in place of 1/R', 14, 31);
    },

    onDrag(S, e) {
      if (e.id !== 'slab' || !S._axS) return;
      const along = e.dx * S._axS.ux + e.dy * S._axS.uy;
      S.p.xIn = clamp(S.p.xIn + along * 0.004, -0.25, 1.25);
      this.setup(S);
    },

    plots: [
      { title: 'The answer across the whole range — computed against the textbook',
        legend: [{ c: '#3DD6F5', label: 'computed here' }, { c: '#9AA8C0', label: 'ideal / textbook' },
                 { c: '#F5B451', label: 'second quantity' }],
        draw(S, g) {
          const p = S.p, R = S.R, cy = '#3DD6F5', gr = '#9AA8C0', am = '#F5B451';
          if (p.mode === 'slab' && R.cfg !== 'slide') {
            /* the capacitance as the second dielectric changes: parallel adds,
               series takes the reciprocal sum — the grid value sits on top */
            const pts = [];
            for (let k2 = 1; k2 <= 10.001; k2 += 0.1) pts.push([k2, capIdeal(R.dm, R.s, R.t, p.K, R.cfg, k2) * 1e12]);
            const hi = Math.max(...pts.map(q => q[1]), R.C * 1e12) * 1.12;
            const P = g.Plot({ xmin: 1, xmax: 10, ymin: 0, ymax: hi, xlabel: 'second dielectric K₂',
              ylabel: 'capacitance (pF)', xfmt: v => v.toFixed(0), yfmt: v => v.toFixed(0) }).frame();
            P.clip(() => { P.line(pts, gr, 2, [5, 4]); P.dot(p.K2, R.Cid * 1e12, 4.5, gr, g.theme['ink-950']);
                           P.dot(p.K2, R.C * 1e12, 5.5, cy, g.theme['ink-950']); });
            P.tag(1.2, hi * 0.9, R.cfg === 'side' ? 'side by side: C₁ + C₂ — grows without limit' : 'stacked: 1/C = 1/C₁ + 1/C₂ — capped by the first layer',
                  gr, 'left', 0);
            P.tag(p.K2, R.C * 1e12, 'solved (with fringe)', cy, 'left', -10);
            return;
          }
          if (p.mode === 'slab') {
            /* F(s) from the grid's C(s), against the ideal step: the grid
               pulls before the slab arrives and lets go gradually — the
               fringe at work — but inside it lands exactly on the formula */
            const W0 = EPS0 * PLATE_W, ss = S.capS, cs = S.capC, L = PLATE_L;
            const Cat = (x) => {
              const u = clamp((x - ss[0]) / (ss[1] - ss[0]), 0, ss.length - 1);
              const k = Math.min(Math.floor(u), ss.length - 2), f = u - k;
              return W0 * (cs[k] * (1 - f) + cs[k + 1] * f);
            };
            const grid = [], ideal = [];
            for (let i = 0; i <= 150; i++) {
              const x = -0.25 + 1.5 * i / 150, s = x * L;
              const V = p.battery ? p.V : R.Q0 / Cat(s);
              grid.push([x, 0.5 * V * V * W0 * R.dcdsFn(s) * 1e6]);
              const Vi = p.battery ? p.V : R.C0id * p.V / capIdeal(R.dm, s, R.t, p.K);
              ideal.push([x, 0.5 * Vi * Vi * capIdealSlope(R.dm, s, R.t, p.K) * 1e6]);
            }
            const vals = grid.concat(ideal).map(q => q[1]);
            const hi = Math.max.apply(null, vals) * 1.15 || 1, lo = Math.min(0, Math.min.apply(null, vals) * 1.15);
            const P = g.Plot({ xmin: -0.25, xmax: 1.25, ymin: lo, ymax: hi,
              xlabel: 'slab position (fraction of plate length)', ylabel: 'force on slab (μN)',
              xfmt: v => v.toFixed(2), yfmt: v => v.toFixed(1) }).frame();
            P.clip(() => {
              P.line([[-0.25, 0], [1.25, 0]], g.alpha(g.theme['text-3'], .5), 1);
              [0, 1].forEach(x => P.vline(x, g.alpha(g.theme['text-3'], .35), [2, 3]));
              P.line(ideal, gr, 1.6, [5, 4]);
              P.line(grid, cy, 2.4);
              P.vline(p.xIn, g.alpha(g.theme.text, .5), [3, 3]);
              P.dot(p.xIn, R.F * 1e6, 4.5, cy, g.theme['ink-950']);
            });
            P.tag(-0.24, grid[0][1], 'already pulling', cy, 'left', -10);
            return;
          }
          if (p.mode === 'rc') {
            const qs = [], is = [], T = R.t, tau = R.tau;
            for (let k = 0; k < T.length; k += 4) {
              qs.push([T[k] / tau, R.q[k] / R.Q]);
              is.push([T[k] / tau, R.i[k] / R.I0]);
            }
            const P = g.Plot({ xmin: 0, xmax: 10, ymin: -1.05, ymax: 1.05,
              xlabel: 'time (units of τ = RC)', ylabel: 'q ÷ CV  ·  i ÷ (V/R)',
              xfmt: v => v.toFixed(0), yfmt: v => v.toFixed(1) }).frame();
            P.clip(() => {
              P.line([[0, 0], [10, 0]], g.alpha(g.theme['text-3'], .5), 1);
              P.line([[0, 0.632], [1, 0.632], [1, 0]], gr, 1.2, [4, 3]);
              P.line(qs, cy, 2.4); P.line(is, am, 2);
              P.vline(S.t2 / tau, g.alpha(g.theme.text, .5), [3, 3]);
            });
            P.tag(1, 0.632, '63% at t = τ', gr, 'left', -8);
            return;
          }
          if (p.mode === 'share') {
            const a = [], b = [], T = R.t, tau = R.tau;
            for (let k = 0; k < T.length; k += 4) { a.push([T[k] / tau, R.V1[k]]); b.push([T[k] / tau, R.V2[k]]); }
            const lo = Math.min(p.V, p.V2, R.Vf) - 1, hi = Math.max(p.V, p.V2, R.Vf) + 1;
            const P = g.Plot({ xmin: 0, xmax: R.T / tau, ymin: lo, ymax: hi,
              xlabel: 'time (units of τ = R·C₁C₂/(C₁+C₂))', ylabel: 'voltage (V)',
              xfmt: v => v.toFixed(1), yfmt: v => v.toFixed(0) }).frame();
            P.clip(() => {
              P.line([[0, R.Vf], [R.T / tau, R.Vf]], gr, 1.3, [5, 4]);
              P.line(a, cy, 2.4); P.line(b, am, 2.2);
              P.vline(S.t2 / tau, g.alpha(g.theme.text, .5), [3, 3]);
            });
            P.tag(R.T / tau * 0.5, R.Vf, 'common V = (C₁V₁ + C₂V₂)/(C₁ + C₂)', gr, 'left', -8);
            return;
          }
          const pts = [], clo = [];
          for (let i = 0; i <= 150; i++) {
            const c3 = 1 + 499 * Math.pow(i / 150, 2);
            pts.push([c3, capNetwork(Object.assign({}, p, { C3uf: c3 })).Ceq * 1e6]);
            clo.push([c3, ceqClosed(p.topo, p.C1uf, p.C2uf, c3)]);
          }
          const hi = Math.max.apply(null, pts.map(q => q[1])) * 1.1;
          const P = g.Plot({ xmin: 1, xmax: 500, ymin: 0, ymax: hi,
            xlabel: 'C₃ (μF)', ylabel: 'C_eq (μF)', xfmt: v => v.toFixed(0), yfmt: v => v.toFixed(1) }).frame();
          P.clip(() => {
            P.line(clo, gr, 4, [2, 0]);
            P.line(pts, cy, 2);
            P.vline(p.C3uf, g.alpha(g.theme.text, .5), [3, 3]);
            P.dot(p.C3uf, R.Ceq * 1e6, 4.5, cy, g.theme['ink-950']);
          });
          P.tag(500, pts[pts.length - 1][1], p.topo === 'parallel' ? 'grows without limit'
                : 'capped by the others', gr, 'right', -9);
        },
        hover(S, x) {
          const p = S.p;
          if (p.mode !== 'network') return null;
          const n = capNetwork(Object.assign({}, p, { C3uf: x }));
          return [{ label: 'C₃', value: x.toFixed(1) + ' μF' },
                  { label: 'C_eq', value: (n.Ceq * 1e6).toFixed(3) + ' μF', color: '#3DD6F5' }];
        } },

      { title: 'Where the energy goes',
        legend: [{ c: '#3DD6F5', label: 'stored in the field' }, { c: '#F5B451', label: 'heat · or battery off' },
                 { c: '#4ADE80', label: 'battery work · or the total' }],
        draw(S, g) {
          const p = S.p, R = S.R, cy = '#3DD6F5', am = '#F5B451', gn = '#4ADE80';
          if (p.mode === 'slab' && R.cfg !== 'slide') {
            /* read the solved field straight off the grid */
            const Gd = S.Gd, ph = S._phiCur, nx = Gd.nx;
            const col = (x) => Math.round((x - Gd.x0) / Gd.hx);
            if (R.cfg === 'stack') {
              const i0 = col(PLATE_L / 2), pts = [];
              for (let j2 = Gd.jBot; j2 < Gd.jTop; j2++) {
                const E = (ph[(j2 + 1) * nx + i0] - ph[j2 * nx + i0]) / Gd.hz * R.V;
                pts.push([(Gd.z0 + (j2 + 0.5) * Gd.hz + Gd.d / 2) * 1000, E / 1000]);
              }
              const hi = Math.max(...pts.map(q => q[1])) * 1.2;
              const P = g.Plot({ xmin: 0, xmax: Gd.d * 1000, ymin: 0, ymax: hi, xlabel: 'height above the lower plate (mm)',
                ylabel: 'E in the gap (kV/m)', xfmt: v => v.toFixed(1), yfmt: v => v.toFixed(0) }).frame();
              P.clip(() => { P.area(pts, 0, g.alpha(cy, .15)); P.line(pts, cy, 2.4);
                             P.vline(R.t * 1000, g.alpha(g.theme.text, .5), [3, 3]); });
              P.tag(R.t * 500, R.E1 / 1000, 'K₁: E = ' + (R.E1 / 1000).toFixed(1) + ' kV/m', am, 'center', -12);
              P.tag((R.t + (R.dm - R.t) / 2) * 1000, R.E2 / 1000, 'K₂: E = ' + (R.E2 / 1000).toFixed(1) + ' kV/m', gn, 'center', -12);
              P.tag(0.3, hi * 0.92, 'E jumps at the boundary; D = Kε₀E does not', g.theme['text-2'], 'left', 0);
            } else {
              const pts = [];
              for (let i2 = Gd.i0; i2 <= Gd.i1; i2++) {
                const eps = S._epsCur[(Gd.jTop - 1) * (nx - 1) + Math.min(i2, nx - 2)];
                const sig = eps * 8.854e-12 * (ph[Gd.jTop * nx + i2] - ph[(Gd.jTop - 1) * nx + i2]) / Gd.hz * R.V;
                pts.push([(Gd.x0 + i2 * Gd.hx) * 100, sig * 1e6]);
              }
              const hi = Math.max(...pts.map(q => q[1])) * 1.2;
              const P = g.Plot({ xmin: 0, xmax: PLATE_L * 100, ymin: 0, ymax: hi, xlabel: 'along the plate (cm)',
                ylabel: 'charge density σ (μC/m²)', xfmt: v => v.toFixed(0), yfmt: v => v.toFixed(2) }).frame();
              P.clip(() => { P.area(pts, 0, g.alpha(cy, .15)); P.line(pts, cy, 2.4); P.vline(PLATE_L * 50, g.alpha(g.theme.text, .5), [3, 3]); });
              P.tag(2.5, R.sig1 * 1e6, 'K₁ half', am, 'left', -10);
              P.tag(7.5, R.sig2 * 1e6, 'K₂ half', gn, 'left', -10);
              P.tag(0.5, hi * 0.92, 'same V, same E — the charge crowds onto the higher K', g.theme['text-2'], 'left', 0);
            }
            return;
          }
          if (p.mode === 'slab') {
            /* the same slab, the same motion: with the battery on, U rises as
               C/C₀; with it off, U falls as C₀/C. Opposite, from one C(s). */
            const ss = S.capS, cs = S.capC, on = [], off = [];
            for (let k = 0; k < ss.length; k++) {
              on.push([ss[k] / PLATE_L, cs[k] / cs[0]]);
              off.push([ss[k] / PLATE_L, cs[0] / cs[k]]);
            }
            const hi = Math.max.apply(null, on.map(q => q[1])) * 1.08;
            const P = g.Plot({ xmin: -0.25, xmax: 1.25, ymin: 0, ymax: hi,
              xlabel: 'slab position (fraction of plate length)', ylabel: 'U ÷ U before the slab',
              xfmt: v => v.toFixed(2), yfmt: v => v.toFixed(1) }).frame();
            P.clip(() => {
              P.line([[-0.25, 1], [1.25, 1]], g.alpha(g.theme['text-3'], .5), 1, [3, 3]);
              P.line(on, p.battery ? gn : g.alpha(gn, .45), p.battery ? 2.6 : 1.4);
              P.line(off, p.battery ? g.alpha(am, .45) : am, p.battery ? 1.4 : 2.6);
              P.vline(p.xIn, g.alpha(g.theme.text, .5), [3, 3]);
              P.dot(p.xIn, p.battery ? R.C / R.C0 : R.C0 / R.C, 4.5, p.battery ? gn : am, g.theme['ink-950']);
            });
            P.tag(1.0, on[20][1], 'battery on: U rises', gn, 'right', -9);
            P.tag(1.0, off[20][1], 'battery off: U falls', am, 'right', 12);
            return;
          }
          if (p.mode === 'rc' || p.mode === 'share') {
            const T = R.t, tau = R.tau, U = [], Hh = [], Wt = [];
            for (let k = 0; k < T.length; k += 4) {
              U.push([T[k] / tau, R.U[k] * 1e3]); Hh.push([T[k] / tau, R.H[k] * 1e3]);
              Wt.push([T[k] / tau, (p.mode === 'rc' ? R.Wb[k] : R.U[k] + R.H[k]) * 1e3]);
            }
            const hi = Math.max.apply(null, Wt.concat(U, Hh).map(q => q[1])) * 1.12 || 1;
            const P = g.Plot({ xmin: 0, xmax: T[T.length - 1] / tau, ymin: 0, ymax: hi,
              xlabel: 'time (units of τ)', ylabel: 'energy (mJ)',
              xfmt: v => v.toFixed(0), yfmt: v => v.toFixed(2) }).frame();
            P.clip(() => {
              P.line(Wt, gn, 2); P.line(U, cy, 2.4); P.line(Hh, am, 2.2);
              P.vline(S.t2 / tau, g.alpha(g.theme.text, .5), [3, 3]);
            });
            if (p.mode === 'rc') P.tag(5, 0.5 * R.C * R.V * R.V * 1e3, 'heat = stored = ½CV², for ANY R', am, 'right', -9);
            else P.tag(R.T / tau * 0.98, R.H[R.H.length - 1] * 1e3, 'lost: independent of R', am, 'right', -9);
            return;
          }
          const lines = [[], [], []];
          for (let i = 0; i <= 120; i++) {
            const c3 = 1 + 499 * Math.pow(i / 120, 2);
            const n = capNetwork(Object.assign({}, p, { C3uf: c3 }));
            n.caps.forEach(c => lines[c.k].push([c3, c.U * 1e6]));
          }
          const hi = Math.max.apply(null, lines.flat().map(q => q[1])) * 1.1 || 1;
          const P = g.Plot({ xmin: 1, xmax: 500, ymin: 0, ymax: hi,
            xlabel: 'C₃ (μF)', ylabel: 'energy in each (μJ)', xfmt: v => v.toFixed(0), yfmt: v => v.toFixed(0) }).frame();
          P.clip(() => {
            P.line(lines[0], cy, 2.2); P.line(lines[1], am, 2); P.line(lines[2], gn, 2);
            P.vline(p.C3uf, g.alpha(g.theme.text, .5), [3, 3]);
          });
          P.tag(2, lines[0][0][1], 'C₁', cy, 'left', -8);
        } }
    ],

    readouts(S) {
      const p = S.p, R = S.R;
      const eng = (x, u) => {
        const a = Math.abs(x);
        const pre = a >= 1e6 ? ['M', 1e-6] : a >= 1e3 ? ['k', 1e-3] : a >= 1 ? ['', 1] : a >= 1e-3 ? ['m', 1e3] : a >= 1e-6 ? ['μ', 1e6] : a >= 1e-9 ? ['n', 1e9] : ['p', 1e12];
        return { v: (x * pre[1]).toPrecision(4), u: pre[0] + u };
      };
      const ro = (label, x, u, extra) => { const e = eng(x, u); return Object.assign({ label: label, value: e.v, unit: e.u }, extra || {}); };
      if (p.mode === 'slab' && R.cfg === 'side') return [
        ro('Capacitance (ideal)', R.Cid, 'F', { flag: 'accent', hint: 'C₁ + C₂: two in parallel' }),
        ro('Capacitance (solved)', R.C, 'F', { hint: '+' + (100 * R.fringe).toFixed(1) + '% from the edges' }),
        ro('C₁ (K₁ half)', R.C1, 'F'), ro('C₂ (K₂ half)', R.C2, 'F'),
        ro('Charge on the K₁ half', R.Q1, 'C'), ro('Charge on the K₂ half', R.Q2, 'C', { hint: 'ratio K₂/K₁' }),
        ro('E in both halves', R.E1, 'V/m', { hint: 'the same: same V, same d' })
      ];
      if (p.mode === 'slab' && R.cfg === 'stack') return [
        ro('Capacitance (ideal)', R.Cid, 'F', { flag: 'accent', hint: 'series: 1/C = 1/C₁ + 1/C₂' }),
        ro('Capacitance (solved)', R.C, 'F', { hint: '+' + (100 * R.fringe).toFixed(1) + '% from the edges' }),
        { label: 'Voltage across layer 1', value: R.V1.toFixed(2), unit: 'V', hint: 'K₁ = ' + p.K.toFixed(1) },
        { label: 'Voltage across layer 2', value: R.V2.toFixed(2), unit: 'V', hint: 'K₂ = ' + p.K2.toFixed(1) },
        ro('E in layer 1', R.E1, 'V/m'), ro('E in layer 2', R.E2, 'V/m', { hint: 'E₁/E₂ = K₂/K₁' }),
        ro('Charge (the same on both)', R.Qid, 'C')
      ];
      if (p.mode === 'slab') return [
        ro('Capacitance (ideal plates)', R.Cid, 'F', { flag: 'accent', hint: 'the exam answer' }),
        ro('Capacitance (solved, with fringe)', R.C, 'F', { hint: '+' + (100 * R.fringe).toFixed(1) + '% from the edges' }),
        { label: 'Voltage across the plates', value: R.Vid.toFixed(2), unit: 'V', flag: p.battery ? undefined : 'warn',
          hint: p.battery ? 'held by the battery' : 'falls as C rises: V = Q/C' },
        ro('Charge on the plates', R.Qid, 'C', { hint: p.battery ? 'rises as the slab goes in' : 'fixed' }),
        ro('Stored energy', R.Uid, 'J', { hint: p.battery ? '½CV²' : 'Q²/2C' }),
        ro('Force on the slab (grid)', R.F, 'N', { flag: 'ok', hint: R.F >= 0 ? 'pulled in' : 'pushed back' }),
        ro('E in the air gap', R.Eair, 'V/m', { hint: 'over the slab' }),
        ro('E inside the dielectric', R.Ediel, 'V/m', { hint: 'E_air ÷ K' }),
        ro('Bound charge density', R.sigmaB, 'C/m²', { hint: 'σ(1 − 1/K)' })
      ];
      if (p.mode === 'rc') {
        const u = clamp(S.t2 / (R.T / (R.t.length - 1)), 0, R.t.length - 1), i0 = Math.floor(u);
        return [
          { label: 'Time constant τ = RC', value: R.tau.toFixed(3), unit: 's', flag: 'accent' },
          ro('Final charge CV', R.Q, 'C'),
          ro('Charge now', R.q[i0], 'C', { hint: (100 * R.q[i0] / R.Q).toFixed(1) + '% of CV' }),
          ro('Current now', R.i[i0], 'A', { hint: 'starts at V/R' }),
          ro('Energy stored at full charge', 0.5 * R.C * R.V * R.V, 'J', { hint: '½CV²' }),
          ro('Heat in R, charging', R.H[400], 'J', { flag: 'warn', hint: 'integrated, not assumed' }),
          ro('Battery work, charging', R.Wb[400], 'J', { hint: 'QV = CV²' }),
          { label: 'Time to reach 99%', value: (R.tau * Math.log(100)).toFixed(3), unit: 's', hint: '4.6 τ' }
        ];
      }
      if (p.mode === 'share') return [
        { label: 'Common final voltage', value: R.Vf.toFixed(3), unit: 'V', flag: 'accent',
          hint: '(C₁V₁ + C₂V₂)/(C₁ + C₂)' },
        ro('Total charge (kept)', R.Qt, 'C', { flag: 'ok' }),
        ro('Energy before', R.U0, 'J'),
        ro('Energy after', R.Uf, 'J'),
        ro('Heat, integrated ∫i²R dt', R.H[R.H.length - 1], 'J', { flag: 'warn' }),
        ro('Heat, formula', R.lossTheory, 'J', { hint: '½ C₁C₂/(C₁+C₂) ΔV²' }),
        { label: 'Time constant', value: R.tau.toFixed(3), unit: 's', hint: 'R × C₁C₂/(C₁+C₂)' }
      ];
      return [
        { label: 'Equivalent capacitance', value: (R.Ceq * 1e6).toFixed(4), unit: 'μF', flag: 'accent' },
        ro('Charge from the battery', R.Qin, 'C'),
        ro('Total energy stored', R.U, 'J', { hint: '½ C_eq V²' })
      ].concat(R.caps.map(c => ({ label: 'C' + '₁₂₃'[c.k] + ' has', value: (c.Q * 1e6).toFixed(3),
        unit: 'μC', hint: c.V.toFixed(3) + ' V across it' })));
    },

    equation(S) {
      const p = S.p, R = S.R;
      if (p.mode === 'slab' && R.cfg === 'side')
        return E.v('C') + ' ' + E.op('=') + ' ' + E.frac(E.v('ε') + '₀(' + E.v('A') + '/2)', E.v('d')) + '(' + E.v('K') + '₁ ' + E.op('+') + ' ' +
          E.v('K') + '₂) ' + E.op('=') + ' ' + E.n(R.Cid * 1e12, 'pF') + ' (two in parallel)';
      if (p.mode === 'slab' && R.cfg === 'stack')
        return E.v('C') + ' ' + E.op('=') + ' ' + E.frac(E.v('ε') + '₀' + E.v('A'), E.frac(E.v('t'), E.v('K') + '₁') + ' ' + E.op('+') + ' ' +
          E.frac(E.v('d') + E.op('−') + E.v('t'), E.v('K') + '₂')) + ' ' + E.op('=') + ' ' + E.n(R.Cid * 1e12, 'pF') + ' (two in series)' +
          '<br>' + E.v('V') + '₁ : ' + E.v('V') + '₂ ' + E.op('=') + ' ' + E.n(R.V1, 'V') + ' : ' + E.n(R.V2, 'V');
      if (p.mode === 'slab')
        return E.v('C') + ' ' + E.op('=') + ' ' + E.frac(E.v('ε') + '₀' + E.v('A'), E.v('d') + E.op('−') + E.v('t') +
          E.op('+') + E.frac(E.v('t'), E.v('K'))) + ' (under the slab) ' + E.op('·') + ' ' +
          E.v('F') + ' ' + E.op('=') + ' ½' + E.v('V') + '² ' + E.frac('d' + E.v('C'), 'd' + E.v('x')) + ' ' +
          E.op('=') + ' ' + E.n(R.F * 1e6, 'μN') +
          '<br>battery ' + (p.battery ? 'on: ' + E.v('V') + ' fixed, ' + E.v('U') + ' ' + E.op('=') + ' ½' + E.v('CV') + '² rises'
                                      : 'off: ' + E.v('Q') + ' fixed, ' + E.v('U') + ' ' + E.op('=') + ' ' +
                                        E.frac(E.v('Q') + '²', '2' + E.v('C')) + ' falls') +
          ' ' + E.op('·') + ' ' + E.v('U') + ' ' + E.op('=') + ' ' + E.n(R.Uid * 1e6, 'μJ');
      if (p.mode === 'rc')
        return E.v('q') + ' ' + E.op('=') + ' ' + E.v('CV') + '(1 ' + E.op('−') + ' ' + E.v('e') + '<sup>−t/RC</sup>) ' +
          E.op('·') + ' τ ' + E.op('=') + ' ' + E.n(R.tau, 's') +
          '<br>' + E.v('W') + E.sub('battery') + ' ' + E.op('=') + ' ' + E.v('CV') + '² ' + E.op('=') + ' ' +
          E.v('U') + E.sub('C') + ' ' + E.op('+') + ' ' + E.v('H') + E.sub('R') + ' ' + E.op('=') + ' ½' + E.v('CV') +
          '² ' + E.op('+') + ' ½' + E.v('CV') + '²';
      if (p.mode === 'share')
        return E.v('V') + E.sub('common') + ' ' + E.op('=') + ' ' + E.frac(E.v('C') + '₁' + E.v('V') + '₁' + E.op('+') +
          E.v('C') + '₂' + E.v('V') + '₂', E.v('C') + '₁' + E.op('+') + E.v('C') + '₂') + ' ' + E.op('=') + ' ' +
          E.n(R.Vf, 'V') + '<br>Δ' + E.v('U') + ' ' + E.op('=') + ' ½' +
          E.frac(E.v('C') + '₁' + E.v('C') + '₂', E.v('C') + '₁' + E.op('+') + E.v('C') + '₂') + '(' + E.v('V') + '₁' +
          E.op('−') + E.v('V') + '₂)² ' + E.op('=') + ' ' + E.n(R.lossTheory * 1e3, 'mJ');
      return (p.topo === 'series' ? E.frac('1', E.v('C') + E.sub('eq')) + ' ' + E.op('=') + ' Σ ' + E.frac('1', E.v('C') + E.sub('i'))
            : p.topo === 'parallel' ? E.v('C') + E.sub('eq') + ' ' + E.op('=') + ' Σ ' + E.v('C') + E.sub('i')
            : E.frac('1', E.v('C') + E.sub('eq')) + ' ' + E.op('=') + ' ' + E.frac('1', E.v('C') + '₁') + ' ' + E.op('+') + ' ' +
              E.frac('1', E.v('C') + '₂' + E.op('+') + E.v('C') + '₃')) +
        ' ' + E.op('=') + ' ' + E.n(R.Ceq * 1e6, 'μF');
    },

    eqNote: '<b>Two questions decide every capacitor problem: what is held fixed, and where the energy goes.</b> ' +
      'With the battery connected, V is fixed. Inserting a dielectric raises C, so Q and U both rise, and ' +
      'the battery supplies twice what the field gains: half is stored, and half is the work done ' +
      'pulling the slab in. With the battery removed, Q is fixed. Raising C now lowers V and ' +
      '<b>lowers</b> U, and the field itself pays for pulling the slab in. The slab is attracted in both ' +
      'cases; only the energy account changes sign. Charging through a resistor loses exactly half the ' +
      'battery\'s work as heat whatever R is, and connecting two capacitors loses energy whatever the ' +
      'wire. Both are the capacitor version of a perfectly inelastic collision.',

    problems: [
      { source: 'NEET pattern · a slab that fills the gap',
        q: 'Square plates of side 10.0 cm are 10.0 mm apart. A slab of dielectric constant 4.00 fills the gap completely. Ignoring edge effects, find the capacitance in pF. (ε₀ = 8.854 × 10⁻¹² F/m)',
        params: { mode: 'slab', cfg: 'slide', metal: false, dmm: 10, K: 4, tFrac: 1, xIn: 1, V: 200, battery: true },
        predict: { label: 'capacitance', unit: 'pF', tol: 0.02 },
        measure: S => S.R.Cid * 1e12,
        working: 'C = Kε₀A/d = 4.00 × 8.854 × 10⁻¹² × 0.0100 / 0.0100 = <b>35.4 pF</b>. The grid, which keeps the ' +
          'fringe, gives a few per cent more: at a gap-to-side ratio of 1 : 10 the edges are not negligible, and ' +
          'every real capacitor measures a little higher than this formula.' },
      { source: 'JEE Main pattern · a slab thinner than the gap',
        q: 'The same plates, 10.0 mm apart, with a slab of K = 5.00 and thickness 5.00 mm lying flat inside. Find the capacitance in pF, ignoring edge effects.',
        params: { mode: 'slab', cfg: 'slide', metal: false, dmm: 10, K: 5, tFrac: 0.5, xIn: 1, V: 200, battery: true },
        predict: { label: 'capacitance', unit: 'pF', tol: 0.02 },
        measure: S => S.R.Cid * 1e12,
        working: 'The slab and the remaining air are in series: C = ε₀A/(d − t + t/K) = 8.854 × 10⁻¹³ / ' +
          '(0.00500 + 0.00100) = <b>14.8 pF</b>. The shortcut: a slab of thickness t behaves like an air gap ' +
          'of t/K, so it "removes" t(1 − 1/K) = 4 mm of the gap. A metal slab (K → ∞) removes all of t.' },
      { source: 'JEE Main pattern · two dielectrics side by side',
        q: 'Square plates of side 10.0 cm, 10.0 mm apart. The left half of the gap is filled with K₁ = 4.00, the right half with K₂ = 2.00. Find the capacitance in pF, ignoring edge effects.',
        params: { mode: 'slab', cfg: 'side', metal: false, dmm: 10, K: 4, K2: 2, V: 200, battery: true },
        predict: { label: 'capacitance', unit: 'pF', tol: 0.02 },
        measure: S => S.R.Cid * 1e12,
        working: 'Each half is its own capacitor across the same plates, so they are in <b>parallel</b>: ' +
          'C = ε₀(A/2)(K₁ + K₂)/d = 8.854 × 10⁻¹² × 0.00500 × 6.00/0.0100 = <b>26.6 pF</b>. Same V and same E in both ' +
          'halves; the K₁ half holds twice the charge.' },
      { source: 'JEE Main pattern · two layers stacked',
        q: 'The same plates, 10.0 mm apart, with a 5.00 mm layer of K₁ = 4.00 on the lower plate and a 5.00 mm layer of K₂ = 2.00 above it. Find the capacitance in pF.',
        params: { mode: 'slab', cfg: 'stack', metal: false, dmm: 10, K: 4, K2: 2, tFrac: 0.5, V: 200, battery: true },
        predict: { label: 'capacitance', unit: 'pF', tol: 0.02 },
        measure: S => S.R.Cid * 1e12,
        working: 'The layers are in <b>series</b>: the same charge passes through both. C = ε₀A/(t₁/K₁ + t₂/K₂) = ' +
          '8.854 × 10⁻¹⁴/(0.00125 + 0.00250) = <b>23.6 pF</b>. The K₂ layer takes two thirds of the voltage, because E ' +
          'is larger where K is smaller.' },
      { source: 'JEE Advanced pattern · battery removed first',
        q: 'The empty capacitor is charged to 200 V, and then the battery is disconnected. A slab of K = 4.00 that fills the gap is then pushed fully in. What is the new potential difference, in volts?',
        params: { mode: 'slab', cfg: 'slide', metal: false, dmm: 10, K: 4, tFrac: 1, xIn: 1, V: 200, battery: false },
        predict: { label: 'new voltage', unit: 'V', tol: 0.02 },
        measure: S => S.R.Vid,
        working: 'With the battery gone, Q cannot change. C rises by K, so V = Q/C falls by K: ' +
          '<b>50.0 V</b>. The energy Q²/2C falls by the same factor of 4: the field did work pulling the slab ' +
          'in. Had the battery stayed on, V would stay 200 V, Q and U would both rise fourfold, and the battery ' +
          'would have paid for it.' },
      { source: 'JEE Main pattern · the heat in the resistor',
        q: 'A 100 μF capacitor is charged from a 12.0 V battery through a 100 kΩ resistor. How much heat is produced in the resistor during the full charge, in mJ?',
        params: { mode: 'rc', Rk: 100, C1uf: 100, V: 12 },
        predict: { label: 'heat', unit: 'mJ', tol: 0.02 },
        measure: S => S.R.H[400] * 1e3,
        working: 'The battery moves Q = CV through V, so it does QV = CV² = 14.4 mJ of work. The capacitor ends ' +
          'up with ½CV² = 7.2 mJ. The rest, <b>7.20 mJ</b>, is heat. R does not appear: a smaller R gives a ' +
          'bigger current for a shorter time, and ∫i²R dt comes out the same. The lab integrates it ' +
          'numerically and gets 7.20 mJ for any R you choose.' },
      { source: 'JEE Advanced pattern · charge sharing',
        q: 'A 100 μF capacitor charged to 12.0 V is connected through a resistor to an uncharged 50.0 μF capacitor. How much energy is dissipated, in mJ?',
        params: { mode: 'share', C1uf: 100, C2uf: 50, V: 12, V2: 0, Rk: 100 },
        predict: { label: 'energy lost', unit: 'mJ', tol: 0.02 },
        measure: S => S.R.H[S.R.H.length - 1] * 1e3,
        working: 'Charge is shared, not lost: 1.20 mC spreads over 150 μF to give 8.00 V. Energy goes from ' +
          '7.20 mJ to ½ × 150 μF × 64 = 4.80 mJ, so <b>2.40 mJ</b> is dissipated. The quick route is ' +
          '½ · C₁C₂/(C₁+C₂) · ΔV² = ½ × 33.3 μF × 144. That expression has the same shape as the energy lost ' +
          'when two bodies stick together, ½μΔu², and for the same reason.' }
    ],

    walkthrough: [
      { title: '1 · The field is solved, not drawn',
        body: 'Look at the glowing section on the front of the capacitor. That is |E| from Laplace\'s equation.',
        ask: 'Where is the field strongest, and where is it weakest?',
        reveal: 'It is uniform in the empty part of the gap and <b>weaker inside the slab</b> by a factor of K. The ' +
          'slab\'s bound charges oppose the field. It is also strong at the plate edges and bulges ' +
          'outside, which is the fringe that the ideal formula ignores. The + and − marks are spaced so each ' +
          'carries the same charge, so they crowd over the slab, where σ is highest.',
        params: { mode: 'slab', cfg: 'slide', metal: false, dmm: 15, K: 4, tFrac: 1, xIn: 0.5, V: 200, battery: true } },
      { title: '2 · Why a slab is pulled in at all',
        body: 'Between ideal plates the field is vertical and the slab\'s face is vertical. Move the slab to just outside the plates.',
        ask: 'Is it pulled even before it enters?',
        reveal: '<b>Yes.</b> The first graph shows the grid force starting before position 0. The fringe ' +
          'field reaches out past the edge and polarises the slab, and the non-uniform field pulls the dipoles ' +
          'in. The ideal model can only get the force from energy (F = ½V² dC/dx), which is why it is taught ' +
          'that way. Inside, the grid lands exactly on that formula.',
        params: { mode: 'slab', cfg: 'slide', metal: false, dmm: 10, K: 4, tFrac: 1, xIn: -0.05, V: 200, battery: true } },
      { title: '3 · Battery on: the battery pays twice',
        body: 'Battery connected. Read the right-hand panel as the slab goes in.',
        ask: 'If the battery does work W, how much ends up stored in the field?',
        reveal: '<b>Half.</b> The battery pushes dQ = V dC through V, doing V² dC of work. The field gains ' +
          '½V² dC. The other half is mechanical work, the pull on the slab. If you hold the slab back so it ' +
          'moves slowly, that energy goes into your hand.',
        params: { mode: 'slab', cfg: 'slide', metal: false, dmm: 10, K: 4, tFrac: 1, xIn: 0.5, V: 200, battery: true } },
      { title: '4 · Battery off: everything reverses except the pull',
        body: 'Now switch the battery off and slide the slab in again.',
        ask: 'Does the stored energy go up or down this time? Is the slab still attracted?',
        reveal: 'U goes <b>down</b>: U = Q²/2C with Q fixed. The slab is <b>still pulled in</b>, and the field ' +
          'pays for it out of its own energy. The second graph shows both cases from the same C(x): one ' +
          'curve rises and the other falls. This battery-on versus battery-off question appears on nearly ' +
          'every paper.',
        params: { mode: 'slab', cfg: 'slide', metal: false, dmm: 10, K: 4, tFrac: 1, xIn: 0.5, V: 200, battery: false } },
      { title: '5 · Half the energy is always lost',
        body: 'Charge a capacitor through R, then use the preset with 10× the resistance.',
        ask: 'Does the larger resistance waste more energy, or less?',
        reveal: '<b>Neither — exactly the same.</b> The heat is ½CV² for any R. A large R makes a small ' +
          'current that lasts longer, a small R a large one that is over quickly, and ∫i²R dt comes to the ' +
          'same total. Only charging in many small voltage steps, rather than all at once, avoids the loss.',
        params: { mode: 'rc', Rk: 100, C1uf: 100, V: 12 } },
      { title: '6 · Sharing charge is an inelastic collision',
        body: 'Connect a charged 100 μF capacitor to an empty 50 μF one.',
        ask: 'Charge is conserved. Is energy?',
        reveal: '<b>No, and the loss does not depend on the wire.</b> ΔU = ½·C₁C₂/(C₁+C₂)·(V₁ − V₂)². ' +
          'Compare the energy lost when two bodies collide and stick, ½·m₁m₂/(m₁+m₂)·(u₁ − u₂)². Charge ' +
          'plays the part of momentum and C the part of mass, and both equalise a shared quantity (V or ' +
          'velocity) at a fixed energy cost.',
        params: { mode: 'share', C1uf: 100, C2uf: 50, V: 12, V2: 0, Rk: 100 } }
    ],

    quiz: [
      { q: 'A capacitor stays connected to a battery while a dielectric slab is inserted. The stored energy:',
        options: ['decreases', 'increases', 'stays the same', 'becomes zero'], answer: 1,
        why: 'V is fixed, C rises by K, so U = ½CV² rises by K. The battery supplies twice that increase; the other half is work on the slab.' },
      { q: 'A charged capacitor is isolated, then a dielectric slab is inserted. The stored energy:',
        options: ['increases by K', 'decreases by K', 'stays the same', 'increases by K²'], answer: 1,
        why: 'Q is fixed, so U = Q²/2C falls as C rises. The field does the work of pulling the slab in.' },
      { q: 'A capacitor is charged fully through a resistor R from a battery of emf V. The heat produced in R is:',
        options: ['CV²', '½CV²', 'zero if R is small', 'depends on R'], answer: 1,
        why: 'The battery does QV = CV² of work; ½CV² is stored, so ½CV² is dissipated — independent of R.' },
      { q: 'A slab of thickness t and constant K is placed between plates a distance d apart. The capacitance is:',
        options: ['ε₀A/(d − t)', 'Kε₀A/d', 'ε₀A/(d − t + t/K)', 'ε₀A/(d + t/K)'], answer: 2,
        why: 'The air (d − t) and the slab (t) are in series; the slab behaves like air of thickness t/K.' },
      { q: 'Capacitors of 2, 3 and 6 μF are connected in series across 12 V. The charge on each is:',
        options: ['12 μC', '24 μC', '72 μC', '132 μC'], answer: 0,
        why: 'In series every capacitor carries the same charge. C_eq = 1 μF, so Q = C_eq·V = 12 μC on each.' }
    ],

    notes: '<b>Where this shows up in the paper.</b>' +
      '<ul><li>Parallel plates with a dielectric: fully filling (C = Kε₀A/d), partly thick ' +
      '(ε₀A/(d − t + t/K)), and partly inserted along the length (two capacitors in parallel).</li>' +
      '<li>Battery connected versus disconnected: which of V, Q, E, U change, and in which direction.</li>' +
      '<li>The force on a dielectric slab, F = ½V² dC/dx, and why it is always attractive.</li>' +
      '<li>Series and parallel networks, and the charge on each capacitor.</li>' +
      '<li>RC charging and discharging: q = CV(1 − e<sup>−t/RC</sup>), τ = RC, and the energy split.</li>' +
      '<li>Connecting charged capacitors: common voltage and energy lost, including capacitors connected ' +
      'with opposite polarities.</li></ul>' +
      '<div class="pyq"><em>Trap to avoid</em>Before anything else, decide what is <b>fixed</b>. Battery on: ' +
      'V is fixed. Battery off: Q is fixed. The same slab gives opposite answers for U, and opposite ' +
      'answers for E in the air gap, depending on this one fact.</div>' +
      '<div class="pyq"><em>Trap to avoid</em>The energy lost in charging or in charge sharing does ' +
      '<b>not</b> depend on the resistance. A problem that gives R and asks for the heat is usually ' +
      'testing whether you notice that R is not needed.</div>'
  });


})(window.InsightLab);
