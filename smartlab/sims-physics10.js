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
     16 · LAWS OF MOTION — the constraint equations, solved

     Nothing here is substituted into a remembered formula. Each arrangement
     is written as Newton's second law for every body plus the inextensible-
     string constraint, assembled as a linear system and solved. Friction is
     never assumed: the system is first solved on the assumption that it does
     NOT move, the friction that assumption demands is read out, and only if
     that exceeds mu_s N does the body get released to slide on mu_k N. That
     is the whole of the static-versus-kinetic question, done as a test rather
     than as a rule.
     ========================================================================= */

  const G = 9.81;

  function mechanics(S) {
    const p = S.p, g = G;
    const us = p.muS, uk = Math.min(p.muK, p.muS);
    const R = { mode: p.mode, g: g };

    if (p.mode === 'atwood') {
      /* Unknowns (a, T), with a positive when m1 descends:
           m1·a + T = m1·g
           m2·a − T = −m2·g                                     */
      const x = SV.lin([[p.m1, 1], [p.m2, -1]], [p.m1 * g, -p.m2 * g]);
      R.a = x[0]; R.T = x[1]; R.static = false; R.slipping = true;
      R.fNeed = 0; R.fMax = 0;
      R.bodies = [
        { tag: 'm₁', m: p.m1, W: p.m1 * g, T: R.T, N: 0, f: 0, a: R.a },
        { tag: 'm₂', m: p.m2, W: p.m2 * g, T: R.T, N: 0, f: 0, a: -R.a }
      ];
      return R;
    }

    if (p.mode === 'table' || p.mode === 'incline') {
      const th = p.mode === 'incline' ? p.theta * Math.PI / 180 : 0;
      const N = p.m1 * g * Math.cos(th);                 // normal on the slope block
      const drive = p.m2 * g - p.m1 * g * Math.sin(th);  // + means m2 descends
      /* STEP 1 — assume it does not move and ask what friction that needs. */
      const fNeed = drive;                                // magnitude and sign
      const fMax = us * N;
      R.N = N; R.fNeed = fNeed; R.fMax = fMax; R.drive = drive;
      if (Math.abs(fNeed) <= fMax + 1e-12) {
        /* STEP 2 — static friction can supply it, so nothing moves. */
        R.static = true; R.slipping = false;
        R.a = 0; R.T = p.m2 * g; R.f = fNeed;
      } else {
        /* STEP 3 — it cannot, so the block slides and friction becomes
           kinetic, opposing the motion that is actually happening. */
        const dir = Math.sign(drive);
        const fk = uk * N * dir;                          // opposes the motion
        /* Unknowns (a, T), a positive in the direction m2 descends:
             m2·a + T = m2·g
             m1·a − T = −m1·g·sinθ − fk                   */
        const x = SV.lin([[p.m2, 1], [p.m1, -1]],
                         [p.m2 * g, -p.m1 * g * Math.sin(th) - fk]);
        R.static = false; R.slipping = true;
        R.a = x[0]; R.T = x[1]; R.f = fk;
      }
      R.bodies = [
        { tag: 'm₁', m: p.m1, W: p.m1 * g, T: R.T, N: N, f: R.f, a: R.a,
          theta: th, comp: p.m1 * g * Math.sin(th) },
        { tag: 'm₂', m: p.m2, W: p.m2 * g, T: R.T, N: 0, f: 0, a: R.a }
      ];
      return R;
    }

    if (p.mode === 'contact') {
      /* Two blocks pushed along a rough surface by F applied to m1.
         Unknowns (a, Nc) where Nc is the contact force between them:
           m1·a + Nc = F − uk·m1·g
           m2·a − Nc = −uk·m2·g                            */
      const F = p.F;
      const fTot = us * (p.m1 + p.m2) * g;
      if (F <= fTot + 1e-12) {
        R.static = true; R.slipping = false; R.a = 0;
        R.Nc = p.m2 * 0 + Math.max(0, F - us * p.m1 * g * 0) * 0;
        /* At rest the contact force is whatever the rear block needs to not
           move, which with both at rest is simply zero net — so report the
           share of the applied force that reaches block 2. */
        R.Nc = 0;
        R.fNeed = F; R.fMax = fTot;
      } else {
        const x = SV.lin([[p.m1, 1], [p.m2, -1]],
                         [F - uk * p.m1 * g, -uk * p.m2 * g]);
        R.static = false; R.slipping = true;
        R.a = x[0]; R.Nc = x[1];
        R.fNeed = F; R.fMax = fTot;
      }
      R.T = R.Nc;
      R.bodies = [
        { tag: 'm₁', m: p.m1, W: p.m1 * g, T: -R.Nc, N: p.m1 * g,
          f: R.slipping ? uk * p.m1 * g : 0, a: R.a, push: F },
        { tag: 'm₂', m: p.m2, W: p.m2 * g, T: R.Nc, N: p.m2 * g,
          f: R.slipping ? uk * p.m2 * g : 0, a: R.a }
      ];
      return R;
    }

    /* banking — circular motion, so the unknown is a SPEED RANGE rather than
       an acceleration. Solve N and friction at the two limits of the cone. */
    const th = p.theta * Math.PI / 180, r = p.radius;
    const t = Math.tan(th);
    R.vIdeal = Math.sqrt(r * g * t);
    const num1 = t + us, den1 = 1 - us * t;
    const num2 = t - us, den2 = 1 + us * t;
    R.vMax = den1 > 1e-6 ? Math.sqrt(r * g * num1 / den1) : Infinity;
    R.vMin = num2 > 0 ? Math.sqrt(r * g * num2 / den2) : 0;
    R.v = p.speed;
    R.needed = p.m1 * p.speed * p.speed / r;
    R.safe = p.speed >= R.vMin - 1e-9 && p.speed <= R.vMax + 1e-9;
    R.slides = p.speed > R.vMax ? 'out' : p.speed < R.vMin ? 'in' : null;
    R.a = p.speed * p.speed / r;
    R.static = R.safe; R.slipping = !R.safe;
    /* the friction the tyres must actually supply along the slope at this
       speed, and what they can give — the same test as everywhere else */
    const Nb = p.m1 * (g * Math.cos(th) + (p.speed * p.speed / r) * Math.sin(th));
    R.fNeed = p.m1 * ((p.speed * p.speed / r) * Math.cos(th) - g * Math.sin(th));
    R.fMax = us * Nb;
    R.bodies = [{ tag: 'car', m: p.m1, W: p.m1 * g, T: 0, N: Nb,
                  f: R.fNeed, a: R.a, theta: th }];
    return R;
  }

  L.register({
    id: 'newton', subject: 'physics',
    name: 'Connected Bodies — Pulleys, Friction and Banking',
    chapter: 'Laws of Motion',
    exams: ['JEE Main', 'JEE Advanced', 'NEET UG'],
    weight: 'Very high yield',
    is3D: true,
    stageHint: 'Drag the hanging mass to change it · friction is tested every frame, never assumed',
    lede: 'The lab never decides in advance whether a block moves. It writes Newton\'s second law for ' +
      'every body together with the string constraint, solves the system, and then <b>tests the friction ' +
      'that answer demands against μ<sub>s</sub>N</b>. If static friction can supply it, nothing moves — ' +
      'and the friction force is whatever equilibrium needs, not μ<sub>s</sub>N. If it cannot, the block ' +
      'is released and slides on μ<sub>k</sub>N. Cross that threshold with a slider and you can watch the ' +
      'whole system break loose, which is the single most examined idea in the chapter.',

    params: { mode: 'incline', m1: 4, m2: 3, theta: 30, muS: 0.30, muK: 0.25,
              F: 20, radius: 80, speed: 15, showFBD: true, run: true },

    presets: [
      { name: 'Atwood machine', params: { mode: 'atwood', m1: 5, m2: 3 } },
      { name: 'Table · it holds', params: { mode: 'table', m1: 10, m2: 2, muS: 0.5, muK: 0.4, theta: 0 } },
      { name: 'Table · it breaks free', params: { mode: 'table', m1: 10, m2: 8, muS: 0.5, muK: 0.4, theta: 0 } },
      { name: 'Incline · frictionless', params: { mode: 'incline', m1: 4, m2: 3, theta: 30, muS: 0, muK: 0 } },
      { name: 'Incline · on the edge', params: { mode: 'incline', m1: 5, m2: 3, theta: 30, muS: 0.6, muK: 0.5 } },
      { name: 'Blocks in contact', params: { mode: 'contact', m1: 3, m2: 2, F: 20, muS: 0, muK: 0 } },
      { name: 'Contact with friction', params: { mode: 'contact', m1: 3, m2: 2, F: 30, muS: 0.2, muK: 0.18 } },
      { name: 'Banked curve', params: { mode: 'banking', m1: 1200, theta: 20, radius: 80, muS: 0.4, muK: 0.35, speed: 15 } },
      { name: 'Banked · too fast', params: { mode: 'banking', m1: 1200, theta: 20, radius: 80, muS: 0.4, muK: 0.35, speed: 30 } }
    ],

    controls: [
      { group: 'Arrangement', items: [
        { key: 'mode', type: 'select', label: 'What is set up', restructure: true, options: [
          { value: 'atwood', label: 'Atwood' }, { value: 'table', label: 'Table' },
          { value: 'incline', label: 'Incline' }, { value: 'contact', label: 'In contact' },
          { value: 'banking', label: 'Banking' }] }
      ] },
      { group: 'The masses', items: [
        { key: 'm1', label: 'Mass <i>m</i>₁', min: 0.5, max: 20, step: 0.1, unit: 'kg',
          fmt: v => v.toFixed(1), restructure: true },
        { key: 'm2', label: 'Mass <i>m</i>₂', min: 0.5, max: 20, step: 0.1, unit: 'kg',
          fmt: v => v.toFixed(1), restructure: true }
      ] },
      { group: 'The surface', items: [
        { key: 'theta', label: 'Angle <i>θ</i>', min: 0, max: 60, step: 0.5, unit: '°',
          fmt: v => v.toFixed(1), restructure: true },
        { key: 'muS', label: 'Static <i>μ</i><sub>s</sub>', min: 0, max: 1.2, step: 0.01, unit: '',
          fmt: v => v.toFixed(2), restructure: true },
        { key: 'muK', label: 'Kinetic <i>μ</i><sub>k</sub>', min: 0, max: 1.2, step: 0.01, unit: '',
          fmt: v => v.toFixed(2), restructure: true }
      ] },
      { group: 'Pushing force', items: [
        { key: 'F', label: 'Applied force <i>F</i>', min: 0, max: 120, step: 0.5, unit: 'N',
          fmt: v => v.toFixed(1), restructure: true }
      ] },
      { group: 'The banked curve', items: [
        { key: 'radius', label: 'Radius <i>r</i>', min: 10, max: 300, step: 1, unit: 'm',
          fmt: v => v.toFixed(0), restructure: true },
        { key: 'speed', label: 'Speed <i>v</i>', min: 1, max: 60, step: 0.5, unit: 'm/s',
          fmt: v => v.toFixed(1), restructure: true }
      ] },
      { group: 'Display', items: [
        { key: 'showFBD', type: 'toggle', label: 'Show the free-body diagram' },
        { key: 'run', type: 'toggle', label: 'Let it move' }
      ] }
    ],

    setup(S) {
      const p = S.p;
      if (p.muK > p.muS) p.muK = p.muS;              // kinetic never exceeds static
      S.R = mechanics(S);
      S.s = 0; S.v = 0;                              // displacement along the string
      /* Each arrangement needs its own viewpoint: a banked road only reads as
         banked from close to its own plane, while a pulley rig needs height. */
      const view = p.mode === 'banking' ? { theta: -1.30, phi: 0.11, dist: 3.0, target: [0, 0, 0.02] }
                 : p.mode === 'contact' ? { theta: -1.50, phi: 0.20, dist: 2.6, target: [0, 0, 0.02] }
                 : { theta: -1.50, phi: 0.20, dist: 2.75, target: [0.02, 0, 0.18] };
      if (!S.cam || S._viewMode !== p.mode) {
        S.cam = Camera(view);
        S.cam.minDist = 1.5; S.cam.maxDist = 12;
        S._viewMode = p.mode;
      }
      S.carPhase = S.carPhase || 0;
    },

    step(S, dt) {
      const p = S.p, R = S.R;
      S.t2 = (S.t2 || 0) + dt;
      if (p.mode === 'banking') { S.carPhase += dt * p.speed / Math.max(p.radius, 1); return; }
      if (!p.run || R.static) { S.v = 0; return; }
      /* The motion is the solved acceleration, integrated. Nothing is
         scripted: change mu and the same integrator either moves or does not. */
      S.v += R.a * dt;
      S.s += S.v * dt;
      const lim = p.mode === 'contact' ? 1.05 : 0.62;
      if (Math.abs(S.s) > lim) { S.s = 0; S.v = 0; }   // reset and run again
    },

    drawStage(S, g) {
      const ctx = g.ctx, th = g.theme, p = S.p, W = g.w, H = g.h, R = S.R;
      const cam = S.cam, F = R3.Frame(ctx, cam, { ambient: 0.26, floorZ: null });
      const acc = th.phys;
      /* DEPTH POLICY (§14.6): only the bench and the floor carry F.GROUND.
         Blocks, pulley and string sort on their own depth; vectors take a few
         hundredths so they sit on their own body. */
      const O = cam.project([0, 0, 0]);
      const away = (pt) => { const q = cam.project(pt); return (q.ok && O.ok && q.x < O.x) ? -1 : 1; };
      const blockCol = ['#C08A4A', '#4A8AC0'];

      /* a solid block with a label on it */
      const drawBlock = (c, size, colour, tag, massKg) => {
        R3.box(F, c, size, colour, { shadow: false, ambient: 0.40 });
        R3.label(F, [c[0], c[1], c[2] + size[2] / 2 + 0.055], tag + ' = ' + massKg.toFixed(1) + ' kg',
                 '#F0E4D0', { size: 9.5 });
      };

      if (p.mode === 'banking') {
        /* ---- a banked section of road, with the car on it ---- */
        const thr = p.theta * Math.PI / 180;
        const Rr = 1.05, wRoad = 0.78;
        const ring = (u, z0) => {
          const pts = [];
          for (let i = 0; i <= 72; i++) {
            const a = i / 72 * TAU;
            const rad = Rr + u * wRoad / 2;
            pts.push([Math.cos(a) * rad, Math.sin(a) * rad,
                      z0 + u * (wRoad / 2) * Math.tan(thr)]);
          }
          return pts;
        };
        const inner = ring(-1, 0), outer = ring(1, 0);
        F.push([0, 0, 0], () => {
          for (let i = 0; i < 72; i++) {
            const q = [inner[i], outer[i], outer[i + 1], inner[i + 1]].map(v => cam.project(v));
            if (q.some(x => !x.ok)) continue;
            const shade = 0.22 + 0.16 * (1 + Math.sin(i / 72 * TAU)) / 2;
            ctx.fillStyle = F.shade('#39435C', [0, 0, 1], { ambient: shade });
            ctx.beginPath();
            q.forEach((x, k) => k ? ctx.lineTo(x.x, x.y) : ctx.moveTo(x.x, x.y));
            ctx.closePath(); ctx.fill();
          }
        }, F.GROUND);
        R3.polyline(F, inner, '#8FA4CE', { alpha: .55, width: 1.4, bias: F.GROUND });
        R3.polyline(F, outer, '#8FA4CE', { alpha: .55, width: 1.4, bias: F.GROUND });
        // the car, riding the bank
        const a0 = S.carPhase;
        const cx = Math.cos(a0) * Rr, cy = Math.sin(a0) * Rr;
        const carCol = R.safe ? '#7CE0A8' : th.crit;
        /* the car rides the camber, so it is tilted with the road */
        const nrm = [-Math.cos(a0) * Math.sin(thr), -Math.sin(a0) * Math.sin(thr), Math.cos(thr)];
        const tang = [-Math.sin(a0), Math.cos(a0), 0];
        const side = [nrm[1] * tang[2] - nrm[2] * tang[1], nrm[2] * tang[0] - nrm[0] * tang[2],
                      nrm[0] * tang[1] - nrm[1] * tang[0]];
        R3.box(F, [cx + nrm[0] * 0.05, cy + nrm[1] * 0.05, nrm[2] * 0.05],
               [0.26, 0.14, 0.09], carCol,
               { shadow: false, ambient: 0.5, axes: [tang, side, nrm] });
        R3.callout(F, [cx, cy, 0.12], away([cx, cy, 0]) * 26, -24,
                   R.safe ? 'holds the curve at ' + p.speed.toFixed(1) + ' m/s'
                          : R.slides === 'out' ? 'SLIDES OUTWARD — too fast'
                                               : 'SLIDES INWARD — too slow', carCol);
        // the ideal-speed marker on the road
        R3.label(F, [0, 0, 0.16], 'r = ' + p.radius.toFixed(0) + ' m  ·  bank ' + p.theta.toFixed(1) + '°',
                 th['text-2'], { size: 10 });
        // the force triangle on a cross-section, drawn where the car is
        const nDir = [-Math.cos(a0) * Math.sin(thr), -Math.sin(a0) * Math.sin(thr), Math.cos(thr)];
        R3.arrow(F, [cx, cy, 0.09], [cx + nDir[0] * 0.42, cy + nDir[1] * 0.42, 0.09 + nDir[2] * 0.42],
                 0.012, '#5AA9FF', { head: 0.05, shadow: false, ambient: 0.8, bias: -0.04 });
        R3.arrow(F, [cx, cy, 0.09], [cx, cy, 0.09 - 0.34], 0.012, '#FFD36B',
                 { head: 0.05, shadow: false, ambient: 0.8, bias: -0.04 });
        R3.arrow(F, [cx, cy, 0.09], [cx * (1 - 0.30 / Rr), cy * (1 - 0.30 / Rr), 0.09], 0.012, th.crit,
                 { head: 0.05, shadow: false, ambient: 0.8, bias: -0.04 });
        R3.label(F, [cx + nDir[0] * 0.48, cy + nDir[1] * 0.48, 0.09 + nDir[2] * 0.48], 'N', '#5AA9FF', { size: 10 });
        R3.label(F, [cx, cy, 0.09 - 0.40], 'mg', '#FFD36B', { size: 10 });
        R3.label(F, [cx * (1 - 0.38 / Rr), cy * (1 - 0.38 / Rr), 0.12], 'mv²/r', th.crit, { size: 10 });
      }

      else if (p.mode === 'contact') {
        /* ---- two blocks in contact on a rough floor ---- */
        const x0 = -0.95 + S.s, yF = 0;
        R3.box(F, [0, 0, -0.10], [3.0, 0.62, 0.06], '#242E46',
               { shadow: false, ambient: 0.16, bias: F.GROUND });
        const s1 = 0.18 + p.m1 * 0.026, s2 = 0.18 + p.m2 * 0.026;
        const c1 = [x0, 0, -0.07 + s1 / 2], c2 = [x0 + s1 / 2 + s2 / 2, 0, -0.07 + s2 / 2];
        R3.box(F, c1, [s1, s1, s1], blockCol[0], { shadow: false, ambient: 0.40 });
        R3.box(F, c2, [s2, s2, s2], blockCol[1], { shadow: false, ambient: 0.40 });
        // stagger the two labels, or they land on each other
        R3.label(F, [c1[0], 0, c1[2] + s1 / 2 + 0.16], 'm₁ = ' + p.m1.toFixed(1) + ' kg',
                 '#F0E4D0', { size: 9.5 });
        R3.label(F, [c2[0], 0, c2[2] + s2 / 2 + 0.05], 'm₂ = ' + p.m2.toFixed(1) + ' kg',
                 '#DCE8F8', { size: 9.5 });
        // the applied force, pushing on the back of m1
        R3.arrow(F, [x0 - s1 / 2 - 0.34, 0, c1[2]], [x0 - s1 / 2 - 0.03, 0, c1[2]],
                 0.016, th.warn, { head: 0.06, shadow: false, ambient: 0.85, bias: -0.04 });
        R3.label(F, [x0 - s1 / 2 - 0.40, 0, c1[2] + 0.07], 'F = ' + p.F.toFixed(1) + ' N',
                 th.warn, { size: 10 });
        // the contact force pair at the interface
        const xi = x0 + s1 / 2;
        if (R.Nc > 0.01) {
          R3.arrow(F, [xi, 0.16, c1[2]], [xi + 0.24, 0.16, c1[2]], 0.010, '#7CE0A8',
                   { head: 0.045, shadow: false, ambient: 0.85, bias: -0.05 });
          R3.arrow(F, [xi, -0.16, c1[2]], [xi - 0.24, -0.16, c1[2]], 0.010, '#7CE0A8',
                   { head: 0.045, shadow: false, ambient: 0.85, bias: -0.05 });
          R3.label(F, [xi + 0.32, 0.16, c1[2] - 0.13], 'N₁₂ = ' + R.Nc.toFixed(2) + ' N',
                   '#7CE0A8', { size: 9.5 });
          R3.label(F, [xi - 0.32, -0.16, c1[2] - 0.13], 'equal and opposite', '#7CE0A8', { size: 9 });
        }
      }

      else {
        /* ---- one rig serves the Atwood machine, the table and the incline:
                a table is an incline of zero degrees, which is not a trick but
                the same free-body diagram with sin θ = 0. ---- */
        const atwood = p.mode === 'atwood';
        const thr = atwood ? 0 : p.theta * Math.PI / 180;
        const px = 0.52, pz = atwood ? 0.62 : 0.06 + Math.tan(thr) * 0;
        // the wedge (or table)
        if (!atwood) {
          const wide = 0.42;
          const len = 1.25, hh = Math.tan(thr) * len;
          F.push([-0.2, 0, 0], () => {
            const quad = (v) => {
              const q = v.map(x => cam.project(x));
              if (q.some(x => !x.ok)) return;
              ctx.fillStyle = F.shade('#2A3552', [0, 0, 1], { ambient: 0.30 });
              ctx.beginPath();
              q.forEach((x, k) => k ? ctx.lineTo(x.x, x.y) : ctx.moveTo(x.x, x.y));
              ctx.closePath(); ctx.fill();
              ctx.strokeStyle = g.alpha('#9FB4DE', .35); ctx.lineWidth = 1.1; ctx.stroke();
            };
            // the sloping top face
            quad([[px - len, -wide / 2, 0], [px, -wide / 2, hh],
                  [px, wide / 2, hh], [px - len, wide / 2, 0]]);
            // the two triangular sides and the back
            [-1, 1].forEach(sg => quad([[px - len, sg * wide / 2, 0], [px, sg * wide / 2, hh],
                                        [px, sg * wide / 2, -0.10], [px - len, sg * wide / 2, -0.10]]));
            quad([[px, -wide / 2, hh], [px, wide / 2, hh],
                  [px, wide / 2, -0.10], [px, -wide / 2, -0.10]]);
          }, F.GROUND);
          // the angle, marked at the toe where the slope meets the horizontal
          if (thr > 0.02) {
            const arc = [];
            for (let i = 0; i <= 16; i++) {
              const a = thr * i / 16;
              arc.push([px - len + Math.cos(a) * 0.34, -wide / 2 - 0.02, Math.sin(a) * 0.34]);
            }
            R3.polyline(F, arc, acc, { alpha: .9, width: 1.8, bias: -0.03 });
            R3.label(F, [px - len + Math.cos(thr / 2) * 0.42, -wide / 2 - 0.02, Math.sin(thr / 2) * 0.42],
                     'θ = ' + p.theta.toFixed(1) + '°', acc, { size: 10 });
          }
        }
        // the pulley, at the top of the slope (or high up, for an Atwood machine)
        const len = 1.25, hh = atwood ? 0 : Math.tan(thr) * len;
        const pulR = 0.10;
        const pz2 = atwood ? 0.72 : hh + 0.13;
        R3.cylinder(F, [px, -0.028, pz2], [px, 0.028, pz2], pulR, '#8FA3C0',
                    { segments: 26, shadow: false, ambient: 0.42 });
        R3.cylinder(F, [px, -0.032, pz2], [px, 0.032, pz2], pulR * 0.22, '#55658C',
                    { segments: 12, shadow: false, ambient: 0.32 });
        R3.cylinder(F, [px, 0, -0.10], [px, 0, pz2 - pulR * 0.3], 0.03, '#55658C',
                    { segments: 12, shadow: false, ambient: 0.28, bias: F.GROUND });

        /* Block 1 rides the slope, measured ALONG it from the top; block 2
           always hangs. The string is inextensible, so one displacement S.s
           moves both — that is the constraint, drawn. */
        const s1 = 0.15 + p.m1 * 0.014, s2 = 0.15 + p.m2 * 0.014;
        let c1, anchor1, axes1 = null;
        if (atwood) {
          c1 = [px - pulR, 0, pz2 - 0.34 - S.s];
          anchor1 = [px - pulR, 0, c1[2] + s1 / 2];
        } else {
          /* A block on a slope has to be ROTATED to the slope: an axis-aligned
             cube on an incline touches at one corner and reads as floating.
             e1 runs up the slope, e3 is the surface normal. */
          const e1 = [Math.cos(thr), 0, -Math.sin(thr)];      // down-slope
          const e3 = [Math.sin(thr), 0, Math.cos(thr)];       // outward normal
          axes1 = [e1, [0, 1, 0], e3];
          const along = clamp(0.56 + S.s, 0.20, len / Math.cos(thr) - 0.14);
          const sx = px - along * Math.cos(thr);
          const sz = hh - along * Math.sin(thr);
          c1 = [sx + e3[0] * s1 / 2, 0, sz + e3[2] * s1 / 2];
          anchor1 = [c1[0] - e1[0] * s1 / 2, 0, c1[2] - e1[2] * s1 / 2];
        }
        R3.box(F, c1, [s1, s1, s1], blockCol[0],
               { shadow: false, ambient: 0.40, axes: axes1 || undefined });
        R3.label(F, [c1[0], 0, c1[2] + s1 * 0.75], 'm₁ = ' + p.m1.toFixed(1) + ' kg',
                 '#F0E4D0', { size: 9.5 });
        const c2 = [px + pulR + 0.16, 0, pz2 - 0.40 + S.s];
        R3.box(F, c2, [s2, s2, s2], blockCol[1], { shadow: false, ambient: 0.40 });
        R3.label(F, [c2[0] + s2 / 2 + 0.24, 0, c2[2] + 0.06],
                 'm₂ = ' + p.m2.toFixed(1) + ' kg', '#DCE8F8', { size: 9.5 });

        // the string, over the pulley
        R3.polyline(F, [anchor1, [px - pulR, 0, pz2], [px + pulR, 0, pz2],
                        [px + pulR, 0, c2[2] + s2 / 2], [c2[0], 0, c2[2] + s2 / 2]],
                    '#D8E2F5', { alpha: .95, width: 2, bias: -0.04 });
        R3.label(F, [px, 0, pz2 + pulR + 0.09], 'T = ' + R.T.toFixed(2) + ' N', acc, { size: 10 });

        // which way it is actually going, if it is going
        if (!R.static && Math.abs(R.a) > 1e-6) {
          const dir = Math.sign(R.a);
          R3.arrow(F, [c2[0], 0, c2[2] - s2 / 2 - 0.05],
                      [c2[0], 0, c2[2] - s2 / 2 - 0.05 - dir * 0.22],
                   0.011, th.ok, { head: 0.05, shadow: false, ambient: 0.85, bias: -0.05 });
          R3.label(F, [c2[0], 0, c2[2] - s2 / 2 - 0.34],
                   'a = ' + Math.abs(R.a).toFixed(2) + ' m/s²', th.ok, { size: 9.5 });
        } else {
          R3.label(F, [c2[0], 0, c2[2] - s2 / 2 - 0.16], 'a = 0 — it holds', th.crit, { size: 9.5 });
        }

        // the drag handle lives on the hanging mass
        const q2 = cam.project([c2[0], 0, c2[2]]);
        if (q2.ok) {
          const on = g.dragging === 'm2';
          ctx.save();
          ctx.strokeStyle = on ? th.text : g.alpha(acc, .75);
          ctx.lineWidth = on ? 2.2 : 1.6;
          ctx.beginPath(); ctx.arc(q2.x, q2.y, 13, 0, TAU); ctx.stroke();
          ctx.restore();
          PA.lbl(ctx, q2.x + 26, q2.y - 16, 'drag m₂',
                 on ? th.text : g.alpha(th['text-3'], .95), 'left', 9);
          g.handle(q2.x, q2.y, 16, 'm2');
          const qa = cam.project([c2[0], 0, c2[2]]), qb = cam.project([c2[0], 0, c2[2] + 1]);
          if (qa.ok && qb.ok) {
            const dx = qb.x - qa.x, dy = qb.y - qa.y, Lp = Math.hypot(dx, dy) || 1;
            S._axM = { ux: dx / Lp, uy: dy / Lp, perPx: 1 / Lp };
          }
        }
      }

      F.render();

      /* ---------------- the free-body diagram ----------------
         Every arrow is drawn to the magnitude the solver returned, so the
         picture the exam asks you to draw is the picture the lab computed. */
      const narrow = W < 660;
      S._panelTop = null;
      if (p.showFBD) {
        const bw = narrow ? Math.min(W - 24, 348) : Math.min(W * 0.40, 348);
        const bh = 150, bx = 12, by = H - bh - 22;
        S._panelTop = by;
        ctx.fillStyle = g.alpha('#0B1020', .92);
        ctx.strokeStyle = g.alpha(th.line, 1); ctx.lineWidth = 1;
        ctx.beginPath(); ctx.roundRect(bx, by, bw, bh, 8); ctx.fill(); ctx.stroke();
        PA.lbl(ctx, bx + 10, by + 13, 'FREE-BODY DIAGRAM · drawn to scale', th['text-3'], 'left', 8.5);

        const bods = R.bodies.slice(0, 2);
        const cellW = bw / bods.length;
        const scale = (function () {
          let mx = 0;
          bods.forEach(b => { mx = Math.max(mx, b.W, Math.abs(b.T), b.N, Math.abs(b.f), b.push || 0); });
          /* 36 px, not 44: the longest arrow plus its label must clear the
             caption line at by + bh − 9, or the weight label lands on top of
             it at phone width. */
          return 36 / Math.max(mx, 1e-6);
        })();
        bods.forEach((b, i) => {
          const cx = bx + cellW * (i + 0.5), cy = by + bh * 0.49;
          ctx.fillStyle = g.alpha(blockCol[i], .85);
          ctx.beginPath(); ctx.roundRect(cx - 13, cy - 13, 26, 26, 4); ctx.fill();
          PA.lbl(ctx, cx, cy, b.tag, '#0B1020', 'center', 10);
          const arrow = (dx, dy, mag, colour, tag) => {
            if (mag < 0.01) return;
            const L = Math.max(10, mag * scale);
            const x1 = cx + dx * L, y1 = cy + dy * L;
            ctx.strokeStyle = colour; ctx.lineWidth = 1.8;
            ctx.beginPath(); ctx.moveTo(cx + dx * 14, cy + dy * 14); ctx.lineTo(x1, y1); ctx.stroke();
            const an = Math.atan2(dy, dx);
            ctx.beginPath(); ctx.moveTo(x1, y1);
            ctx.lineTo(x1 - 6 * Math.cos(an - 0.45), y1 - 6 * Math.sin(an - 0.45));
            ctx.lineTo(x1 - 6 * Math.cos(an + 0.45), y1 - 6 * Math.sin(an + 0.45));
            ctx.closePath(); ctx.fillStyle = colour; ctx.fill();
            PA.lbl(ctx, x1 + dx * 12, y1 + dy * 11, tag, colour, 'center', 8.5);
          };
          const thb = b.theta || 0;
          // weight always straight down
          arrow(0, 1, b.W, '#FFD36B', b.W.toFixed(1) + ' N');
          if (b.N > 0.01) {
            // normal, perpendicular to the surface
            arrow(Math.sin(thb), -Math.cos(thb), b.N, '#5AA9FF', 'N ' + b.N.toFixed(1));
          }
          if (Math.abs(b.T) > 0.01) {
            // tension along the string: up the slope for the block, up for the hanger
            const tx = i === 0 && !b.push ? Math.cos(thb) : 0;
            const ty = i === 0 && !b.push ? -Math.sin(thb) : -1;
            arrow(tx || (b.push ? 1 : 0), b.push ? 0 : ty, Math.abs(b.T),
                  '#7CE0A8', 'T ' + Math.abs(b.T).toFixed(1));
          }
          if (b.push) arrow(-1, 0, b.push, th.warn, 'F ' + b.push.toFixed(0));
          if (Math.abs(b.f) > 0.01) {
            const dir = -Math.sign(R.a || R.drive || 1);
            arrow(dir * Math.cos(thb), -dir * Math.sin(thb) * 0 + 0, Math.abs(b.f),
                  th.crit, 'f ' + Math.abs(b.f).toFixed(1));
          }
        });
        PA.lbl(ctx, bx + 10, by + bh - 9,
               p.mode === 'banking'
                 ? 'needs ' + Math.abs(R.fNeed).toFixed(0) + ' N of friction along the slope, of the ' +
                   R.fMax.toFixed(0) + ' N available'
                 : R.static
                 ? 'static: friction supplies ' + Math.abs(R.fNeed || 0).toFixed(1) +
                   ' N of the ' + (R.fMax || 0).toFixed(1) + ' N it could'
                 : 'sliding: friction is now μₖN = ' +
                   Math.abs(R.f != null ? R.f : (R.bodies[0].f || 0)).toFixed(1) + ' N, fixed',
               R.static ? th.ok : th.warn, 'left', 8.5);
      }

      /* ---------------- the verdict panel ---------------- */
      {
        const bw = narrow ? Math.min(W - 24, 268) : Math.min(W * 0.30, 268);
        const bh = 104;
        const bx = narrow ? 12 : W - bw - 14;
        const by = narrow ? Math.max(58, (S._panelTop == null ? H - 22 : S._panelTop) - bh - 8)
                          : H - bh - 22;
        ctx.fillStyle = g.alpha('#0B1020', .92);
        ctx.strokeStyle = g.alpha(th.line, 1); ctx.lineWidth = 1;
        ctx.beginPath(); ctx.roundRect(bx, by, bw, bh, 8); ctx.fill(); ctx.stroke();
        PA.lbl(ctx, bx + 10, by + 13, p.mode === 'banking' ? 'THE SPEED BAND' : 'THE FRICTION TEST',
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
          row(3, 'contact force N₁₂', R.Nc.toFixed(2) + ' N', th.ok);
          row(4, 'verdict', R.static ? 'NOTHING MOVES' : 'both accelerate together',
              R.static ? th.crit : th.ok);
        } else {
          row(0, 'friction needed to hold it', Math.abs(R.fNeed || 0).toFixed(2) + ' N');
          row(1, 'most static friction can give', (R.fMax || 0).toFixed(2) + ' N', acc);
          row(2, 'acceleration', R.a.toFixed(3) + ' m/s²', R.static ? th['text-2'] : acc);
          row(3, 'tension', R.T.toFixed(2) + ' N');
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
        ctx.fillText(R.static ? 'STATIC — nothing moves'
                              : 'a = ' + Math.abs(R.a).toFixed(3) + ' m/s²   ·   T = ' +
                                R.T.toFixed(2) + ' N', 14, 8);
      }
      ctx.font = '500 10px "IBM Plex Mono",monospace'; ctx.fillStyle = th['text-3'];
      ctx.fillText(p.mode === 'banking'
        ? 'r = ' + p.radius.toFixed(0) + ' m · bank ' + p.theta.toFixed(1) + '° · μₛ = ' +
          p.muS.toFixed(2) + ' — the band, not a single speed'
        : 'μₛ = ' + p.muS.toFixed(2) + ', μₖ = ' + p.muK.toFixed(2) +
          ' · friction is tested against μₛN every frame, never assumed', 14, 31);
    },

    onDrag(S, e) {
      if (e.id !== 'm2' || !S._axM) return;
      const along = e.dx * S._axM.ux + e.dy * S._axM.uy;
      // dragging the hanging mass DOWN makes it heavier
      S.p.m2 = clamp(S.p.m2 - along * S._axM.perPx * 16, 0.5, 20);
      this.setup(S);
    },

    plots: [
      { title: 'The friction test — what is needed against what is available',
        legend: [{ c: '#FB7185', label: 'friction needed' }, { c: '#4ADE80', label: 'μₛN available' }],
        draw(S, g) {
          const p = S.p;
          if (p.mode === 'banking') {
            /* the safe band against bank angle: two curves that open out from
               the frictionless single speed */
            const lo = [], hi = [], id = [];
            for (let i = 0; i <= 120; i++) {
              const a = 1 + 59 * i / 120, t = Math.tan(a * Math.PI / 180);
              id.push([a, Math.sqrt(p.radius * G * t)]);
              const n2 = t - p.muS, d2 = 1 + p.muS * t;
              lo.push([a, n2 > 0 ? Math.sqrt(p.radius * G * n2 / d2) : 0]);
              const n1 = t + p.muS, d1 = 1 - p.muS * t;
              hi.push([a, d1 > 0.02 ? Math.min(Math.sqrt(p.radius * G * n1 / d1), 90) : 90]);
            }
            const P = g.Plot({ xmin: 1, xmax: 60, ymin: 0, ymax: 60,
              xlabel: 'bank angle θ (°)', ylabel: 'speed (m/s)',
              xfmt: v => v.toFixed(0), yfmt: v => v.toFixed(0) }).frame();
            P.clip(() => {
              P.area(hi, 0, g.alpha(g.theme.ok, .10));
              P.area(lo, 0, g.alpha(g.theme['ink-950'], 1));
              P.line(hi, g.theme.ok, 1.8);
              P.line(lo, g.theme.crit, 1.8);
              P.line(id, g.alpha(g.theme['text-3'], .95), 1.5, [4, 3]);
              P.vline(p.theta, g.alpha(g.theme.text, .5), [3, 3]);
              P.dot(p.theta, p.speed, 4.5, S.R.safe ? g.theme.ok : g.theme.crit, g.theme['ink-950']);
            });
            P.tag(30, Math.sqrt(p.radius * G * Math.tan(30 * Math.PI / 180)),
                  'frictionless: one speed only', g.theme['text-3'], 'left', -9);
            return;
          }
          if (p.mode === 'contact') {
            const need = [], have = [];
            for (let i = 0; i <= 120; i++) {
              const Fv = 120 * i / 120;
              need.push([Fv, Fv]);
              have.push([Fv, p.muS * (p.m1 + p.m2) * G]);
            }
            const P = g.Plot({ xmin: 0, xmax: 120, ymin: 0, ymax: 120,
              xlabel: 'applied force F (N)', ylabel: 'force (N)',
              xfmt: v => v.toFixed(0), yfmt: v => v.toFixed(0) }).frame();
            P.clip(() => {
              P.line(have, g.theme.ok, 2);
              P.line(need, g.theme.crit, 2);
              P.vline(p.F, g.alpha(g.theme.text, .5), [3, 3]);
              P.dot(p.F, p.F, 4.5, g.theme.text, g.theme['ink-950']);
            });
            P.tag(p.muS * (p.m1 + p.m2) * G, p.muS * (p.m1 + p.m2) * G,
                  'breaks free here', g.theme.warn, 'left', -10);
            return;
          }
          /* sweep the hanging mass: friction needed rises with it, available
             does not — the crossing is where the system lets go */
          const thr = p.mode === 'incline' ? p.theta * Math.PI / 180 : 0;
          const N = p.m1 * G * Math.cos(thr), fMax = p.muS * N;
          const need = [], have = [];
          for (let i = 0; i <= 160; i++) {
            const m = 0.5 + 19.5 * i / 160;
            need.push([m, Math.abs(m * G - p.m1 * G * Math.sin(thr))]);
            have.push([m, fMax]);
          }
          const ymax = Math.max(fMax * 1.6, Math.max.apply(null, need.map(q => q[1])) * 1.05, 1);
          const P = g.Plot({ xmin: 0.5, xmax: 20, ymin: 0, ymax: ymax,
            xlabel: 'hanging mass m₂ (kg)', ylabel: 'friction force (N)',
            xfmt: v => v.toFixed(0), yfmt: v => v.toFixed(0) }).frame();
          P.clip(() => {
            P.area(have, 0, g.alpha(g.theme.ok, .10));
            P.line(have, g.theme.ok, 2);
            P.line(need, g.theme.crit, 2);
            P.vline(p.m2, g.alpha(g.theme.text, .5), [3, 3]);
            P.dot(p.m2, Math.abs(S.R.fNeed || 0), 4.5,
                  S.R.static ? g.theme.ok : g.theme.crit, g.theme['ink-950']);
          });
          // where they cross
          const mCross = (fMax + p.m1 * G * Math.sin(thr)) / G;
          if (mCross > 0.5 && mCross < 20)
            P.tag(mCross, fMax, 'lets go at m₂ = ' + mCross.toFixed(2) + ' kg',
                  g.theme.warn, 'left', -10);
        },
        hover(S, x) {
          const p = S.p;
          if (p.mode === 'banking' || p.mode === 'contact') return null;
          const thr = p.mode === 'incline' ? p.theta * Math.PI / 180 : 0;
          const need = Math.abs(x * G - p.m1 * G * Math.sin(thr));
          const fMax = p.muS * p.m1 * G * Math.cos(thr);
          return [{ label: 'm₂', value: x.toFixed(2) + ' kg' },
                  { label: 'needed', value: need.toFixed(2) + ' N', color: '#FB7185' },
                  { label: 'available', value: fMax.toFixed(2) + ' N', color: '#4ADE80' },
                  { label: 'state', value: need <= fMax ? 'holds' : 'slides' }];
        } },

      { title: 'Acceleration and tension across the threshold',
        legend: [{ c: '#3DD6F5', label: 'acceleration' }, { c: '#4ADE80', label: 'tension' }],
        draw(S, g) {
          const p = S.p;
          if (p.mode === 'banking') {
            /* the friction actually needed at each speed, against what the
               tyres can give */
            const need = [], have = [];
            const thr = p.theta * Math.PI / 180;
            for (let i = 0; i <= 160; i++) {
              const v = 60 * i / 160;
              const Nn = p.m1 * (G * Math.cos(thr) + v * v / p.radius * Math.sin(thr));
              const fn = p.m1 * (v * v / p.radius * Math.cos(thr) - G * Math.sin(thr));
              need.push([v, Math.abs(fn)]);
              have.push([v, p.muS * Nn]);
            }
            const P = g.Plot({ xmin: 0, xmax: 60, ymin: 0,
              ymax: Math.max.apply(null, have.map(q => q[1])) * 1.1,
              xlabel: 'speed (m/s)', ylabel: 'friction along the slope (N)',
              xfmt: v => v.toFixed(0), yfmt: v => (v / 1000).toFixed(1) + 'k' }).frame();
            P.clip(() => {
              P.area(have, 0, g.alpha(g.theme.ok, .10));
              P.line(have, g.theme.ok, 2);
              P.line(need, g.theme.crit, 2);
              P.vline(S.R.vIdeal, g.alpha(g.theme['text-3'], .8), [4, 3]);
              P.vline(p.speed, g.alpha(g.theme.text, .5), [3, 3]);
            });
            P.tag(S.R.vIdeal, 0, 'ideal speed — no friction needed at all',
                  g.theme['text-2'], 'left', -10);
            return;
          }
          if (p.mode === 'contact') {
            const as = [], ns = [];
            for (let i = 0; i <= 160; i++) {
              const Fv = 120 * i / 160;
              const fTot = p.muS * (p.m1 + p.m2) * G;
              if (Fv <= fTot) { as.push([Fv, 0]); ns.push([Fv, 0]); continue; }
              const a = (Fv - p.muK * (p.m1 + p.m2) * G) / (p.m1 + p.m2);
              as.push([Fv, a]); ns.push([Fv, p.m2 * a + p.muK * p.m2 * G]);
            }
            const mx = Math.max(Math.max.apply(null, as.map(q => q[1])),
                                Math.max.apply(null, ns.map(q => q[1]))) * 1.1 || 1;
            const P = g.Plot({ xmin: 0, xmax: 120, ymin: 0, ymax: mx,
              xlabel: 'applied force F (N)', ylabel: 'a (m/s²)  /  N₁₂ (N)',
              xfmt: v => v.toFixed(0), yfmt: v => v.toFixed(0) }).frame();
            P.clip(() => {
              P.line(ns, g.theme.ok, 2);
              P.line(as, g.theme.phys, 2.2);
              P.vline(p.F, g.alpha(g.theme.text, .5), [3, 3]);
            });
            P.tag(0, 0, 'flat until friction is beaten', g.theme['text-3'], 'left', -9);
            return;
          }
          const thr = p.mode === 'incline' ? p.theta * Math.PI / 180 : 0;
          const N = p.m1 * G * Math.cos(thr), fMax = p.muS * N;
          const as = [], Ts = [];
          for (let i = 0; i <= 200; i++) {
            const m = 0.5 + 19.5 * i / 200;
            const drive = m * G - p.m1 * G * Math.sin(thr);
            if (Math.abs(drive) <= fMax) { as.push([m, 0]); Ts.push([m, m * G]); continue; }
            const fk = p.muK * N * Math.sign(drive);
            const x = SV.lin([[m, 1], [p.m1, -1]],
                             [m * G, -p.m1 * G * Math.sin(thr) - fk]);
            as.push([m, x[0]]); Ts.push([m, x[1]]);
          }
          const mxT = Math.max.apply(null, Ts.map(q => q[1])) * 1.1 || 1;
          const P = g.Plot({ xmin: 0.5, xmax: 20, ymin: 0, ymax: mxT,
            xlabel: 'hanging mass m₂ (kg)', ylabel: 'tension (N)  ·  a scaled',
            xfmt: v => v.toFixed(0), yfmt: v => v.toFixed(0) }).frame();
          P.clip(() => {
            P.line(Ts, g.theme.ok, 2);
            P.line(as.map(q => [q[0], q[1] * mxT / 12]), g.theme.phys, 2.2);
            P.vline(p.m2, g.alpha(g.theme.text, .5), [3, 3]);
            P.dot(p.m2, S.R.T, 4.5, g.theme.text, g.theme['ink-950']);
          });
          P.tag(0.6, 0, 'a stays exactly zero while static', g.theme['text-3'], 'left', -9);
        },
        hover(S, x) {
          const p = S.p;
          if (p.mode !== 'atwood' && p.mode !== 'table' && p.mode !== 'incline') return null;
          const thr = p.mode === 'incline' ? p.theta * Math.PI / 180 : 0;
          const N = p.m1 * G * Math.cos(thr), fMax = p.muS * N;
          const drive = x * G - p.m1 * G * Math.sin(thr);
          if (Math.abs(drive) <= fMax)
            return [{ label: 'm₂', value: x.toFixed(2) + ' kg' },
                    { label: 'a', value: '0 — static', color: '#3DD6F5' },
                    { label: 'T', value: (x * G).toFixed(2) + ' N', color: '#4ADE80' }];
          const fk = p.muK * N * Math.sign(drive);
          const sol = SV.lin([[x, 1], [p.m1, -1]], [x * G, -p.m1 * G * Math.sin(thr) - fk]);
          return [{ label: 'm₂', value: x.toFixed(2) + ' kg' },
                  { label: 'a', value: sol[0].toFixed(3) + ' m/s²', color: '#3DD6F5' },
                  { label: 'T', value: sol[1].toFixed(2) + ' N', color: '#4ADE80' }];
        } }
    ],

    readouts(S) {
      const p = S.p, R = S.R;
      if (p.mode === 'banking') {
        return [
          { label: 'Ideal speed √(rg tanθ)', value: R.vIdeal.toFixed(2), unit: 'm/s', flag: 'accent',
            hint: 'no friction needed at all' },
          { label: 'Slowest safe speed', value: R.vMin.toFixed(2), unit: 'm/s',
            hint: R.vMin < 0.01 ? 'it can stand still' : 'below this it slides in' },
          { label: 'Fastest safe speed', value: isFinite(R.vMax) ? R.vMax.toFixed(2) : '∞', unit: 'm/s',
            flag: 'accent' },
          { label: 'Driving at', value: p.speed.toFixed(1), unit: 'm/s',
            flag: R.safe ? 'ok' : 'crit' },
          { label: 'Centripetal force needed', value: R.needed.toFixed(0), unit: 'N',
            hint: 'mv²/r' },
          { label: 'Centripetal acceleration', value: R.a.toFixed(2), unit: 'm/s²',
            hint: (R.a / G).toFixed(2) + ' g' },
          { label: 'Normal force', value: R.bodies[0].N.toFixed(0), unit: 'N',
            hint: 'bigger than mg on a bank' },
          { label: 'Bank for this speed alone', value: (Math.atan(p.speed * p.speed / (p.radius * G)) * 180 / Math.PI).toFixed(1),
            unit: '°', hint: 'θ = arctan(v²/rg)' }
        ];
      }
      const out = [
        { label: 'Acceleration a', value: Math.abs(R.a).toFixed(3), unit: 'm/s²', flag: 'accent',
          hint: R.static ? 'zero — it holds' : 'solved, not substituted' },
        { label: p.mode === 'contact' ? 'Contact force N₁₂' : 'Tension T',
          value: (p.mode === 'contact' ? R.Nc : R.T).toFixed(2), unit: 'N', flag: 'accent' },
        { label: 'Friction needed', value: Math.abs(R.fNeed || 0).toFixed(2), unit: 'N',
          hint: 'to hold it still' },
        { label: 'Friction available μₛN', value: (R.fMax || 0).toFixed(2), unit: 'N',
          flag: R.static ? 'ok' : 'crit' },
        { label: 'State', value: R.static ? 'static' : 'sliding', unit: '',
          flag: R.static ? 'ok' : 'warn',
          hint: R.static ? 'friction is NOT μₛN here' : 'friction is now μₖN' }
      ];
      if (p.mode !== 'contact') {
        out.push({ label: 'Normal force on m₁', value: (R.N || 0).toFixed(2), unit: 'N',
          hint: p.mode === 'incline' ? 'mg cos θ, not mg' : 'mg on the flat' });
        out.push({ label: 'Weight component down slope',
          value: (p.m1 * G * Math.sin(p.mode === 'incline' ? p.theta * Math.PI / 180 : 0)).toFixed(2),
          unit: 'N', hint: 'mg sin θ' });
        out.push({ label: 'm₂ lets go above', value: (((R.fMax || 0) +
          p.m1 * G * Math.sin(p.mode === 'incline' ? p.theta * Math.PI / 180 : 0)) / G).toFixed(2),
          unit: 'kg', hint: 'the threshold in the graph' });
      } else {
        out.push({ label: 'Shared acceleration', value: R.a.toFixed(3), unit: 'm/s²',
          hint: 'both blocks, always equal' });
        out.push({ label: 'If pushed from the other side',
          value: R.slipping ? (p.m1 * R.a + (R.slipping ? p.muK * p.m1 * G : 0)).toFixed(2) : '0.00',
          unit: 'N', flag: 'warn', hint: 'the contact force is NOT symmetric' });
      }
      return out;
    },

    equation(S) {
      const p = S.p, R = S.R;
      if (p.mode === 'banking')
        return E.v('v') + E.sub('ideal') + ' ' + E.op('=') + ' √(' + E.v('rg') + ' tan' + E.v('θ') + ') ' +
          E.op('=') + ' ' + E.n(R.vIdeal, 'm/s') +
          '<br>' + E.v('v') + E.sub('max') + ' ' + E.op('=') + ' √(' + E.v('rg') +
          E.frac('tan' + E.v('θ') + E.op('+') + E.v('μ'), '1' + E.op('−') + E.v('μ') + ' tan' + E.v('θ')) +
          ') ' + E.op('=') + ' ' + E.n(isFinite(R.vMax) ? R.vMax : 999, 'm/s') + E.op('·') +
          ' ' + E.v('v') + E.sub('min') + ' ' + E.op('=') + ' ' + E.n(R.vMin, 'm/s');
      if (p.mode === 'contact')
        return E.v('a') + ' ' + E.op('=') + ' ' + E.frac(E.v('F') + E.op('−') + E.v('μ') +
          '(' + E.v('m') + '₁' + E.op('+') + E.v('m') + '₂)' + E.v('g'),
          E.v('m') + '₁' + E.op('+') + E.v('m') + '₂') + ' ' + E.op('=') + ' ' + E.n(R.a, 'm/s²') +
          '<br>' + E.v('N') + '₁₂ ' + E.op('=') + ' ' + E.v('m') + '₂' + E.v('a') + ' ' + E.op('+') +
          ' ' + E.v('μm') + '₂' + E.v('g') + ' ' + E.op('=') + ' ' + E.n(R.Nc, 'N') + E.op('·') +
          ' push from the other side and it is NOT the same';
      const thr = p.mode === 'incline' ? p.theta * Math.PI / 180 : 0;
      let s = 'test: ' + E.v('f') + E.sub('needed') + ' ' + E.op('=') + ' ' +
        E.n(Math.abs(R.fNeed || 0), 'N') + ' vs ' + E.v('μ') + E.sub('s') + E.v('N') + ' ' +
        E.op('=') + ' ' + E.n(R.fMax || 0, 'N') + E.op('→') +
        (R.static ? ' it holds' : ' it lets go');
      s += '<br>' + E.v('a') + ' ' + E.op('=') + ' ';
      if (R.static) s += '0' + E.op(',') + ' and ' + E.v('f') + ' ' + E.op('=') + ' ' +
        E.n(Math.abs(R.fNeed || 0), 'N') + E.op(',') + ' NOT ' + E.v('μ') + E.sub('s') + E.v('N');
      else s += E.frac(E.v('m') + '₂' + E.v('g') + E.op('−') + E.v('m') + '₁' + E.v('g') + 'sin' +
        E.v('θ') + E.op('−') + E.v('μ') + E.sub('k') + E.v('m') + '₁' + E.v('g') + 'cos' + E.v('θ'),
        E.v('m') + '₁' + E.op('+') + E.v('m') + '₂') + ' ' + E.op('=') + ' ' + E.n(Math.abs(R.a), 'm/s²');
      s += '<br>' + E.v('T') + ' ' + E.op('=') + ' ' + E.n(R.T, 'N');
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
        params: { mode: 'atwood', m1: 5, m2: 3, muS: 0, muK: 0 },
        predict: { label: 'acceleration', unit: 'm/s²', tol: 0.02 },
        measure: S => Math.abs(S.R.a),
        working: 'a = (m₁ − m₂)g/(m₁ + m₂) = (5.00 − 3.00)(9.81)/8.00 = <b>2.45 m/s²</b>, and the ' +
          'tension is 2m₁m₂g/(m₁+m₂) = 36.8 N. Note that T lies <i>between</i> the two weights ' +
          '(29.4 N and 49.1 N) — it has to, because the lighter mass accelerates upward and the ' +
          'heavier one downward. A tension outside that range is an arithmetic slip you can catch ' +
          'without redoing the problem.' },
      { source: 'JEE Main pattern · does it move at all?',
        q: 'A 10.0 kg block rests on a horizontal table with μₛ = 0.500, connected over a pulley to a 2.00 kg hanging mass. Find the acceleration of the system in m/s².',
        params: { mode: 'table', m1: 10, m2: 2, muS: 0.5, muK: 0.4, theta: 0 },
        predict: { label: 'acceleration', unit: 'm/s²', tol: 0.05 },
        measure: S => Math.abs(S.R.a),
        working: '<b>Zero.</b> Test first: the pull is m₂g = 19.6 N, while static friction can supply ' +
          'up to μₛm₁g = 0.500 × 98.1 = 49.1 N. The pull loses, so nothing moves and the friction ' +
          'force is <b>19.6 N</b> — not 49.1 N. Plugging straight into a = (m₂g − μm₁g)/(m₁+m₂) gives ' +
          'a negative acceleration, which is the standard way this question is failed: a negative answer ' +
          'here means "it does not move", not "it moves backwards".' },
      { source: 'JEE Advanced pattern · once it breaks free',
        q: 'The same table and block, but now with a 8.00 kg hanging mass and μₖ = 0.400. Find the acceleration in m/s².',
        params: { mode: 'table', m1: 10, m2: 8, muS: 0.5, muK: 0.4, theta: 0 },
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
          'of that value, which the graph draws.' }
    ],

    walkthrough: [
      { title: '1 · Friction is not a number you look up',
        body: 'A 10 kg block on a table, μₛ = 0.5, with only 2 kg hanging. Look at the FRICTION TEST panel.',
        ask: 'How much friction is acting on the block right now?',
        reveal: '<b>19.6 N</b> — exactly the pull, not the 49.1 N that μₛN would give. Static friction is a ' +
          'reaction: it supplies whatever equilibrium needs, up to a ceiling. Writing f = μₛN when the ' +
          'block is not on the point of slipping is the commonest error in the chapter, and it gives a ' +
          'block that accelerates backwards.',
        params: { mode: 'table', m1: 10, m2: 2, muS: 0.5, muK: 0.4, theta: 0 } },
      { title: '2 · Drag the hanging mass until it lets go',
        body: 'Drag m₂ downward — it gets heavier — and watch the red line in the first graph climb toward the green one.',
        ask: 'What happens at the moment the two lines cross?',
        reveal: 'The block breaks free, and friction <b>drops</b> from its peak μₛN to the smaller μₖN. ' +
          'That is why a heavy box lurches the instant you get it moving and then feels easier to push. ' +
          'The threshold is m₂ = μₛm₁ = 5.0 kg here, marked on the graph.',
        params: { mode: 'table', m1: 10, m2: 5.2, muS: 0.5, muK: 0.4, theta: 0 } },
      { title: '3 · On a slope, N is not mg',
        body: 'Switch to the incline at 30° and look at the normal-force readout.',
        ask: 'Why is the normal force smaller than the weight?',
        reveal: 'Because only the component of weight <b>perpendicular to the surface</b> has to be ' +
          'balanced: N = mg cos θ. The other component, mg sin θ, runs down the slope and is what the ' +
          'string and friction have to fight. Using mg for N on a slope inflates the friction by 1/cos θ, ' +
          'which at 60° is a factor of two.',
        params: { mode: 'incline', m1: 5, m2: 3, theta: 30, muS: 0.6, muK: 0.5 } },
      { title: '4 · The tension is not the weight',
        body: 'Set the incline frictionless and watch the tension as the system accelerates.',
        ask: 'The hanging mass is 3 kg, so is the tension 29.4 N?',
        reveal: '<b>No.</b> If T equalled m₂g the hanging mass would have no net force and could not ' +
          'accelerate. T = m₂(g − a) whenever m₂ is descending, so the tension is always <i>less</i> ' +
          'than the weight of a falling mass and <i>more</i> than the weight of a rising one. T equals ' +
          'the weight only when a = 0.',
        params: { mode: 'incline', m1: 4, m2: 3, theta: 30, muS: 0, muK: 0 } },
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
        params: { mode: 'banking', m1: 400, theta: 20, radius: 80, muS: 0.4, muK: 0.35, speed: 16.9 } }
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
        why: 'v = √(rg tan θ). The mass cancels from the balance because weight, centripetal requirement and normal force all scale with it. A lorry and a motorbike have the same ideal speed.' }
    ],

    notes: '<b>Where this shows up in the paper.</b>' +
      '<ul><li>Pulley systems: the string constraint makes every connected body share |a|, and the ' +
      'tension is the same throughout a light string over a light pulley.</li>' +
      '<li>The static-versus-kinetic test, which must be done <b>before</b> computing anything.</li>' +
      '<li>Blocks in contact, where the contact force depends on which side you push.</li>' +
      '<li>Blocks on an incline: N = mg cos θ, driving component mg sin θ, and the angle of repose ' +
      'tan θ = μₛ at which a block just begins to slide.</li>' +
      '<li>Banked curves, the ideal speed √(rg tan θ), and the band that friction opens around it.</li>' +
      '<li>The accelerating wedge or lift, where the pseudo-force in the non-inertial frame is the ' +
      'quickest route.</li></ul>' +
      '<div class="pyq"><em>Trap to avoid</em>Static friction is <b>not</b> μ<sub>s</sub>N. That is its ' +
      'maximum, reached only at the point of slipping. Writing f = μ<sub>s</sub>N for a stationary block ' +
      'that is nowhere near slipping produces a negative acceleration, and a negative acceleration in ' +
      'this situation means the block does not move at all — not that it moves backwards.</div>' +
      '<div class="pyq"><em>Trap to avoid</em>The tension in the string of an Atwood machine is ' +
      '<b>not</b> the weight of either mass. If it were, that mass would have no net force and could ' +
      'not accelerate. T = m(g − a) for a descending mass and m(g + a) for a rising one.</div>'
  });

})(window.InsightLab);
