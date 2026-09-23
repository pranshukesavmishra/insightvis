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

  /* =========================================================================
     17 · CENTRE OF MASS AND COLLISIONS — momentum kept, energy audited

     One rule runs every arrangement on this bench: the total momentum of an
     isolated system cannot change, so the centre of mass moves at a constant
     velocity straight through the impact. Energy is a separate question, and
     the coefficient of restitution answers it. Nothing here is a canned
     outcome — the impulse along the line of centres is computed, applied, and
     the momentum and energy books are then balanced on screen so that the
     conserved quantity and the spent one can be told apart by eye.
     ========================================================================= */

  /* radius a sphere of this mass gets on the bench: equal density, so the
     bigger mass really does look bigger, by the cube root it deserves */
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

  L.register({
    id: 'collisions', subject: 'physics',
    name: 'Collisions and the Centre of Mass',
    chapter: 'System of Particles · Centre of Mass',
    exams: ['JEE Main', 'JEE Advanced', 'NEET UG'],
    weight: 'Very high yield',
    is3D: true,
    stageHint: 'Drag the ringed handle to change the speed · the glowing yellow marker is the centre of mass',
    lede: 'Every collision here is worked out, not played back. The lab finds the exact moment of ' +
      'contact, applies an equal and opposite impulse <b>along the line joining the centres</b>, and ' +
      'then checks both books. Momentum always balances, so the <b>centre of mass</b> (the glowing ' +
      'marker) moves straight through the impact at the same speed. Kinetic energy balances only when ' +
      '<i>e</i> = 1. The energy lost is exactly the energy of the motion <i>relative to</i> the centre of ' +
      'mass along that line. No other energy is available to lose, which is why a head-on crash of ' +
      'equal masses can use up all of it and a glancing one cannot.',

    params: { mode: 'head1d', m1: 2, m2: 4, u1: 6, u2: 0, e: 0.6, bImp: 0.5,
              mBul: 0.02, mBlk: 2, uBul: 300, Lstr: 1.0,
              mProj: 2, u0: 20, alpha: 45, fSplit: 0.5, Q: 200, beta: 180,
              showCOM: true, run: true },

    presets: [
      { name: 'Elastic · equal masses swap', params: { mode: 'head1d', m1: 2, m2: 2, u1: 5, u2: 0, e: 1 } },
      { name: 'Perfectly inelastic · they stick', params: { mode: 'head1d', m1: 2, m2: 2, u1: 5, u2: 0, e: 0 } },
      { name: 'Heavy hits light', params: { mode: 'head1d', m1: 10, m2: 1, u1: 4, u2: 0, e: 1 } },
      { name: 'Light hits heavy · rebounds', params: { mode: 'head1d', m1: 1, m2: 10, u1: 4, u2: 0, e: 1 } },
      { name: 'Head-on from both sides', params: { mode: 'head1d', m1: 3, m2: 2, u1: 4, u2: -3, e: 0.7 } },
      { name: 'Glancing · equal masses, 90°', params: { mode: 'oblique', m1: 2, m2: 2, u1: 5, u2: 0, e: 1, bImp: 0.5 } },
      { name: 'Glancing · inelastic', params: { mode: 'oblique', m1: 2, m2: 2, u1: 5, u2: 0, e: 0.5, bImp: 0.5 } },
      { name: 'Ballistic pendulum', params: { mode: 'ballistic', mBul: 0.01, mBlk: 1.99, uBul: 400, Lstr: 1 } },
      { name: 'Shell bursts · one piece drops', params: { mode: 'burst', mProj: 2, u0: 20, alpha: 45, fSplit: 0.5, Q: 200, beta: 180 } },
      { name: 'Shell bursts · unequal pieces', params: { mode: 'burst', mProj: 2, u0: 20, alpha: 45, fSplit: 0.3, Q: 500, beta: 60 } }
    ],

    controls: [
      { group: 'Arrangement', items: [
        { key: 'mode', type: 'select', label: 'What is set up', restructure: true, options: [
          { value: 'head1d', label: 'Head-on' }, { value: 'oblique', label: 'Glancing' },
          { value: 'ballistic', label: 'Ballistic' }, { value: 'burst', label: 'Explosion' }] }
      ] },
      { group: 'The two balls', items: [
        { key: 'm1', label: 'Mass <i>m</i>₁', min: 0.5, max: 20, step: 0.1, unit: 'kg',
          fmt: v => v.toFixed(1), restructure: true },
        { key: 'm2', label: 'Mass <i>m</i>₂', min: 0.5, max: 20, step: 0.1, unit: 'kg',
          fmt: v => v.toFixed(1), restructure: true },
        { key: 'u1', label: 'Velocity <i>u</i>₁', min: -10, max: 10, step: 0.1, unit: 'm/s',
          fmt: v => v.toFixed(1), restructure: true },
        { key: 'u2', label: 'Velocity <i>u</i>₂', min: -10, max: 10, step: 0.1, unit: 'm/s',
          fmt: v => v.toFixed(1), restructure: true }
      ] },
      { group: 'The impact', items: [
        { key: 'e', label: 'Restitution <i>e</i>', min: 0, max: 1, step: 0.01, unit: '',
          fmt: v => v.toFixed(2), restructure: true },
        { key: 'bImp', label: 'Offset <i>b</i> ÷ (<i>r</i>₁+<i>r</i>₂)', min: 0, max: 0.95, step: 0.01, unit: '',
          fmt: v => v.toFixed(2), restructure: true }
      ] },
      { group: 'Ballistic pendulum', items: [
        { key: 'mBul', label: 'Bullet mass', min: 0.002, max: 0.2, step: 0.001, unit: 'g',
          fmt: v => (v * 1000).toFixed(0), restructure: true },
        { key: 'mBlk', label: 'Block mass', min: 0.2, max: 10, step: 0.01, unit: 'kg',
          fmt: v => v.toFixed(2), restructure: true },
        { key: 'uBul', label: 'Bullet speed', min: 20, max: 1000, step: 1, unit: 'm/s',
          fmt: v => v.toFixed(0), restructure: true },
        { key: 'Lstr', label: 'String length', min: 0.3, max: 3, step: 0.01, unit: 'm',
          fmt: v => v.toFixed(2), restructure: true }
      ] },
      { group: 'Explosion in flight', items: [
        { key: 'mProj', label: 'Shell mass', min: 0.5, max: 20, step: 0.1, unit: 'kg',
          fmt: v => v.toFixed(1), restructure: true },
        { key: 'u0', label: 'Launch speed', min: 5, max: 60, step: 0.5, unit: 'm/s',
          fmt: v => v.toFixed(1), restructure: true },
        { key: 'alpha', label: 'Launch angle', min: 10, max: 80, step: 0.5, unit: '°',
          fmt: v => v.toFixed(1), restructure: true },
        { key: 'fSplit', label: 'Piece 1 share of mass', min: 0.05, max: 0.95, step: 0.01, unit: '',
          fmt: v => v.toFixed(2), restructure: true },
        { key: 'Q', label: 'Energy released <i>Q</i>', min: 0, max: 3000, step: 1, unit: 'J',
          fmt: v => v.toFixed(0), restructure: true },
        { key: 'beta', label: 'Split direction', min: -180, max: 180, step: 1, unit: '°',
          fmt: v => v.toFixed(0), restructure: true }
      ] },
      { group: 'Display', items: [
        { key: 'showCOM', type: 'toggle', label: 'Show the centre of mass' },
        { key: 'run', type: 'toggle', label: 'Let it run' }
      ] }
    ],

    setup(S) {
      const p = S.p;
      S.R = collide(S);
      const R = S.R;
      S.t2 = 0; S.flash = -1;
      if (p.mode === 'head1d' || p.mode === 'oblique') {
        /* Ball 2 starts just right of centre, ball 1 on the left. The contact
           instant is SOLVED: the gap along x closes at the relative speed,
           and touching means the x-separation equals √(d² − b²). */
        S.x20 = 0.28; S.x10 = -0.95;
        const gapX = Math.sqrt(Math.max(R.d * R.d - R.b * R.b, 0));
        const rel = R.U1[0] - R.U2[0];
        S.tc = rel > 1e-9 ? ((S.x20 - S.x10) - gapX) / rel : Infinity;
        if (isFinite(S.tc) && S.tc < 0) S.tc = 0;
        S.hx1 = S.x10 + R.U1[0] * (isFinite(S.tc) ? S.tc : 0);
        S.hx2 = S.x20 + R.U2[0] * (isFinite(S.tc) ? S.tc : 0);
        const fast = Math.max(Math.abs(p.u1), Math.abs(p.u2), R.sp1 || 0, R.sp2 || 0, 0.4);
        S.tEnd = (isFinite(S.tc) ? S.tc : 1.6 / fast) + clamp(1.5 / fast, 0.35, 3.0);
        S.slow = 0.30;                               // shown at 0.3× real time
      } else if (p.mode === 'ballistic') {
        S.th = 0; S.om = 0; S.tImp = 0.55;             // bullet flight is shown slowed
        const T0 = TAU * Math.sqrt(p.Lstr / G);
        S.tEnd = S.tImp + (R.overTop ? 3.2 : T0 * (1 + Math.pow(R.theta * Math.PI / 180, 2) / 16) * 1.02);
        S.slow = 1;
      } else {
        /* fit the whole flight on the bench: every landing point and the
           highest point any piece reaches */
        const zTop = (V) => R.zA + (V[1] > 0 ? V[1] * V[1] / (2 * G) : 0);
        const xs = [0, R.range, R.x1, R.x2];
        const xmin = Math.min.apply(null, xs), xmax = Math.max.apply(null, xs);
        const zmax = Math.max(R.zA, zTop(R.V1), zTop(R.V2), 1e-3);
        S.k = Math.min(2.7 / Math.max(xmax - xmin, 1e-3), 1.25 / zmax);
        S.xo = (xmin + xmax) / 2;
        S.tEnd = R.tA + R.tEnd + 0.6;
        S.slow = 0.9;
      }
      const view = p.mode === 'oblique' ? { theta: -1.52, phi: 0.80, dist: 2.75, target: [0, 0, -0.05] }
                 : p.mode === 'ballistic' ? { theta: -1.02, phi: 0.20, dist: 2.45, target: [-0.35, 0, 0.40] }
                 : p.mode === 'burst' ? { theta: -1.54, phi: 0.14, dist: 2.7, target: [0, 0, 0.30] }
                 : { theta: -1.50, phi: 0.40, dist: 2.3, target: [0, 0, 0.0] };
      if (!S.cam || S._viewMode !== p.mode) {
        S.cam = Camera(view);
        S.cam.minDist = 1.5; S.cam.maxDist = 12;
        S._viewMode = p.mode;
      }
      /* the flight is rescaled to the bench, so its height changes with the
         launch; keep the camera aimed at the middle of it */
      if (p.mode === 'burst') S.cam.target[2] = -0.03 + 0.5 * S.k * Math.max(R.zA, 0.2 / S.k) - 0.08;
    },

    step(S, dt) {
      const p = S.p, R = S.R;
      if (!p.run) return;
      const h = dt * S.slow;
      const was = S.t2;
      S.t2 += h;
      if (p.mode === 'ballistic' && S.t2 > S.tImp) {
        /* The swing is integrated, not assumed to be simple-harmonic: at 40°
           the small-angle period is already 3% short, and a bullet that sends
           the block over the top would break it outright. RK4 on
           θ'' = −(g/L) sin θ, from ω₀ = v/L at the instant of embedding. */
        if (was <= S.tImp) { S.th = 0; S.om = R.omega0; S.flash = S.t2; }
        let left = S.t2 - Math.max(was, S.tImp);
        const k = G / p.Lstr;
        const f = (th, om) => [om, -k * Math.sin(th)];
        while (left > 1e-9) {
          const hh = Math.min(left, 0.004);
          const a = f(S.th, S.om);
          const b = f(S.th + a[0] * hh / 2, S.om + a[1] * hh / 2);
          const c = f(S.th + b[0] * hh / 2, S.om + b[1] * hh / 2);
          const d = f(S.th + c[0] * hh, S.om + c[1] * hh);
          S.th += hh / 6 * (a[0] + 2 * b[0] + 2 * c[0] + d[0]);
          S.om += hh / 6 * (a[1] + 2 * b[1] + 2 * c[1] + d[1]);
          left -= hh;
        }
      }
      if ((p.mode === 'head1d' || p.mode === 'oblique') && isFinite(S.tc) && was < S.tc && S.t2 >= S.tc)
        S.flash = S.t2;
      if (p.mode === 'burst' && was < R.tA && S.t2 >= R.tA) S.flash = S.t2;
      if (S.t2 > S.tEnd) { S.t2 = 0; S.th = 0; S.om = 0; S.flash = -1; }
    },

    drawStage(S, g) {
      const ctx = g.ctx, th = g.theme, p = S.p, W = g.w, H = g.h, R = S.R;
      const cam = S.cam;
      const benchTop = -0.03;
      const F = R3.Frame(ctx, cam, { ambient: 0.26, floorZ: benchTop });
      const acc = th.phys;
      const col1 = '#F29A4A', col2 = '#4A9AF2', comCol = '#F5E663';
      const t = S.t2;
      const flashOn = S.flash >= 0 && t - S.flash < 0.18 && t >= S.flash;
      let flashAt = null, hdl = null;
      /* DEPTH POLICY (§14.6): the bench and the ground carry F.GROUND; balls,
         block and shell sort on true depth; arrows take a few hundredths. */

      const vArrow = (from, v, colour, tag, k) => {
        const L0 = Math.hypot(v[0], v[1]);
        if (L0 < 0.02) {
          R3.label(F, [from[0], from[1], from[2] + 0.07], tag + ' = 0', colour, { size: 9.5 });
          return;
        }
        const s = (k || 0.065);
        const to = [from[0] + v[0] * s, from[1] + v[1] * s, from[2]];
        R3.arrow(F, from, to, 0.010, colour, { head: 0.045, shadow: false, ambient: 0.85, bias: -0.04 });
        R3.label(F, [to[0] + (v[0] >= 0 ? 0.05 : -0.05), to[1], to[2] + 0.06],
                 tag + ' = ' + L0.toFixed(2) + ' m/s', colour, { size: 9.5 });
      };

      if (p.mode === 'head1d' || p.mode === 'oblique') {
        const obl = p.mode === 'oblique';
        const P = posAt(S, t);
        // the bench, and for the glancing case a grid so the angles read
        R3.box(F, [0, 0, benchTop - 0.035], [3.1, obl ? 1.9 : 0.62, 0.07], '#232C44',
               { shadow: false, ambient: 0.16, bias: F.GROUND });
        if (obl) {
          R3.plane(F, [-1.5, -0.9, benchTop + 0.0005], [3.0, 0, 0], [0, 1.8, 0], '#262F4A',
                   { grid: 15, gridAlpha: 0.14, bias: F.GROUND });
        } else {
          [-1, 1].forEach(sg => R3.box(F, [0, sg * 0.14, benchTop + 0.012], [3.0, 0.018, 0.024],
                                       '#56657F', { shadow: false, ambient: 0.3 }));
        }
        const z1 = benchTop + R.r1, z2 = benchTop + R.r2;
        const on = (q) => Math.abs(q[0]) < 1.55 && Math.abs(q[1]) < 0.95;
        // the paths so far, which is where a glancing collision shows its angle
        if (obl) {
          const tr = (x0, y0, U, hx, V, z, c) => {
            const pts = [[x0, y0, benchTop + 0.002]];
            if (P.hit) {
              pts.push([hx, y0, benchTop + 0.002]);
              const dt = t - S.tc;
              pts.push([hx + V[0] * dt, y0 + V[1] * dt, benchTop + 0.002]);
            } else pts.push([x0 + U[0] * t, y0, benchTop + 0.002]);
            R3.polyline(F, pts.map(q => [clamp(q[0], -1.5, 1.5), clamp(q[1], -0.9, 0.9), q[2]]),
                        c, { alpha: .75, width: 1.6, bias: -0.02 });
          };
          tr(S.x10, R.b, R.U1, S.hx1, R.V1, z1, col1);
          tr(S.x20, 0, R.U2, S.hx2, R.V2, z2, col2);
          if (P.hit) {
            // the line of centres at the instant of contact: the only line the impulse can act along
            R3.polyline(F, [[S.hx1 - R.n[0] * 0.25, R.b - R.n[1] * 0.25, benchTop + 0.004],
                            [S.hx2 + R.n[0] * 0.55, R.n[1] * 0.55, benchTop + 0.004]],
                        th.text, { alpha: .55, width: 1.2, dash: [5, 4], bias: -0.02 });
            R3.label(F, [S.hx2 + R.n[0] * 0.68, R.n[1] * 0.68, benchTop + 0.03],
                     'line of centres', th['text-2'], { size: 9 });
            if (R.ang != null)
              R3.label(F, [S.hx2 - 0.05, 0.02, benchTop + 0.30], 'paths ' + R.ang.toFixed(1) + '° apart',
                       '#F5E663', { size: 10.5 });
          }
        }
        if (on(P.P1)) R3.sphere(F, [P.P1[0], P.P1[1], z1], R.r1, col1, { label: 'm₁', shadowK: 0.5 });
        if (on(P.P2)) R3.sphere(F, [P.P2[0], P.P2[1], z2], R.r2, col2, { label: 'm₂', shadowK: 0.5 });
        if (flashOn) flashAt = [(S.hx1 * R.r2 + S.hx2 * R.r1) / R.d, R.b * R.r2 / R.d, (z1 + z2) / 2];
        // velocity arrows ride above the balls
        const V1 = P.hit ? R.V1 : R.U1, V2 = P.hit ? R.V2 : R.U2;
        if (on(P.P1)) vArrow([P.P1[0], P.P1[1], z1 + R.r1 + 0.06], V1, col1, P.hit ? 'v₁' : 'u₁');
        if (on(P.P2)) vArrow([P.P2[0], P.P2[1], z2 + R.r2 + 0.06 + (obl ? 0 : 0.10)], V2, col2,
                             P.hit ? 'v₂' : 'u₂');
        if (p.showCOM && on(P.C)) {
          /* the centre of mass: a lamp on a thin stalk, and the straight line
             it has drawn so far — straight because no external force acts */
          const cz = benchTop + 0.02;
          const C0 = [(R.m1 * S.x10 + R.m2 * S.x20) / R.M, R.m1 * R.b / R.M];
          R3.polyline(F, [[clamp(C0[0], -1.5, 1.5), C0[1], cz], [P.C[0], P.C[1], cz]], comCol,
                      { alpha: .85, width: 1.8, dash: [6, 4], bias: -0.02 });
          R3.sphere(F, [P.C[0], P.C[1], cz + 0.03], 0.028, comCol, { shadow: false, vivid: true });
          R3.label(F, [P.C[0], P.C[1] - (obl ? 0.14 : 0.24), cz + 0.02],
                   'CM · ' + Math.hypot(R.vcom[0], R.vcom[1]).toFixed(2) + ' m/s, never changes',
                   comCol, { size: 9 });
        }
        if (!R.willHit)
          R3.label(F, [0, 0, 0.42], 'they never meet — m₁ is not catching m₂', th.warn, { size: 11 });
        // the drag handle on ball 1
        const q1 = cam.project([P.P1[0], P.P1[1], z1]);
        if (q1.ok && on(P.P1)) {
          hdl = { x: q1.x, y: q1.y, r: Math.max(14, R.r1 * q1.s + 5), tip: null };
          const qa = cam.project([P.P1[0], P.P1[1], z1]), qb = cam.project([P.P1[0] + 1, P.P1[1], z1]);
          if (qa.ok && qb.ok) {
            const dx = qb.x - qa.x, dy = qb.y - qa.y, Lp = Math.hypot(dx, dy) || 1;
            S._axU = { ux: dx / Lp, uy: dy / Lp, perPx: 1 / Lp };
          }
        }
      }

      else if (p.mode === 'ballistic') {
        const Ld = 0.74, pz = 1.02;                  // drawn length, pivot height
        R3.box(F, [0, 0, benchTop - 0.035], [3.0, 0.9, 0.07], '#232C44',
               { shadow: false, ambient: 0.16, bias: F.GROUND });
        // the frame: two posts and a crossbar
        [-1, 1].forEach(sg => R3.cylinder(F, [0.05, sg * 0.30, benchTop], [0.05, sg * 0.30, pz],
                                          0.018, '#55658C', { segments: 12, shadow: false, ambient: 0.3 }));
        R3.cylinder(F, [0.05, -0.32, pz], [0.05, 0.32, pz], 0.02, '#6F80A6',
                    { segments: 12, shadow: false, ambient: 0.34 });
        const thn = t > S.tImp ? S.th : 0;
        const bs = 0.10 + 0.05 * Math.cbrt(p.mBlk);
        const sx = Math.sin(thn), cz = Math.cos(thn);
        const ctr = [0.05 + Ld * sx, 0, pz - Ld * cz];
        const axes = [[cz, 0, sx], [0, 1, 0], [-sx, 0, cz]];
        R3.box(F, ctr, [bs, bs * 1.4, bs], '#A8794A', { shadow: false, ambient: 0.40, axes: axes });
        // bifilar strings keep the block from twisting, as in the real apparatus
        [-1, 1].forEach(sg => {
          const top = [ctr[0] + axes[2][0] * bs / 2, sg * bs * 0.55, ctr[2] + axes[2][2] * bs / 2];
          R3.polyline(F, [[0.05, sg * 0.18, pz], top], '#D8E2F5', { alpha: .9, width: 1.4, bias: -0.02 });
        });
        R3.label(F, [ctr[0] + 0.02, 0, ctr[2] - bs / 2 - 0.13], 'M = ' + p.mBlk.toFixed(2) + ' kg',
                 '#F0E4D0', { size: 9.5 });
        // the arc it will reach, and the rise h
        const thM = Math.min(R.theta, 179) * Math.PI / 180;
        const arc = [];
        for (let i = 0; i <= 30; i++) {
          const a = thM * i / 30;
          arc.push([0.05 + Ld * Math.sin(a), 0, pz - Ld * Math.cos(a)]);
        }
        R3.polyline(F, arc, acc, { alpha: .6, width: 1.4, dash: [4, 4], bias: -0.02 });
        const hD = Ld * (1 - Math.cos(thM));
        if (hD > 0.01 && !R.overTop) {
          const xr = 0.05 + Ld * Math.sin(thM) + 0.16;
          R3.polyline(F, [[xr, 0, pz - Ld], [xr, 0, pz - Ld + hD]], th.ok,
                      { alpha: .9, width: 1.8, bias: -0.03 });
          [0, hD].forEach(z => R3.polyline(F, [[xr - 0.04, 0, pz - Ld + z], [xr + 0.04, 0, pz - Ld + z]],
                                           th.ok, { alpha: .9, width: 1.8, bias: -0.03 }));
          R3.label(F, [xr + 0.07, 0, pz - Ld + hD / 2], 'h = ' + (R.h * 100).toFixed(1) + ' cm',
                   th.ok, { size: 10, align: 'left' });
        }
        R3.label(F, [0.05, 0, pz + 0.12],
                 R.overTop ? 'goes right over the top' : 'swings to θ = ' + R.theta.toFixed(1) + '°',
                 R.overTop ? th.warn : acc, { size: 10 });
        // the bullet: in flight before impact, a dark mark on the face after
        const face = [ctr[0] - axes[0][0] * bs / 2, 0, ctr[2] - axes[0][2] * bs / 2];
        if (t < S.tImp) {
          const bx = -1.35 + (face[0] - 0.02 + 1.35) * (t / S.tImp);
          R3.cylinder(F, [bx - 0.07, 0, face[2]], [bx, 0, face[2]], 0.012, '#D8B06A',
                      { segments: 10, shadow: false, ambient: 0.5 });
          vArrow([bx - 0.03, 0, face[2] + 0.09], [p.uBul, 0], '#D8B06A', 'u', 0.35 / 400);
        } else {
          R3.sphere(F, face, 0.014, '#20242C', { shadow: false });
          const vNow = S.om * p.Lstr;
          if (Math.abs(vNow) > 0.02)
            vArrow([ctr[0], 0, ctr[2] + bs / 2 + 0.07], [vNow * Math.cos(thn), 0], acc, 'v', 0.12);
        }
        if (flashOn) flashAt = face;
        // the gun, so the bullet comes from somewhere and the handle is on something
        R3.cylinder(F, [-1.62, 0, face[2]], [-1.38, 0, face[2]], 0.022, '#6F80A6',
                    { segments: 14, shadow: false, ambient: 0.35 });
        R3.box(F, [-1.56, 0, face[2] - 0.07], [0.08, 0.05, 0.12], '#4A5878', { shadow: false, ambient: 0.3 });
        R3.label(F, [-1.50, 0, face[2] - 0.17],
                 'bullet m = ' + (p.mBul * 1000).toFixed(0) + ' g at ' + p.uBul.toFixed(0) + ' m/s',
                 '#D8B06A', { size: 9.5 });
        R3.label(F, [-1.50, 0, face[2] - 0.28], 'flight shown slowed; the swing is real time',
                 th['text-3'], { size: 8.5 });
        if (p.showCOM) {
          const bxNow = t < S.tImp ? -1.35 + (face[0] + 1.33) * (t / S.tImp) : face[0];
          const cx = (p.mBul * bxNow + p.mBlk * ctr[0]) / (p.mBul + p.mBlk);
          const czz = (p.mBul * face[2] + p.mBlk * ctr[2]) / (p.mBul + p.mBlk);
          R3.sphere(F, [cx, -0.02, czz], 0.024, comCol, { shadow: false, vivid: true });
        }
        // the handle is on the bullet's launch point: drag sideways for speed
        const qh = cam.project([-1.35, 0, face[2]]);
        if (qh.ok) {
          hdl = { x: qh.x, y: qh.y, r: 13, tip: 'drag for speed' };
          const qb = cam.project([-0.35, 0, face[2]]);
          if (qb.ok) {
            const dx = qb.x - qh.x, dy = qb.y - qh.y, Lp = Math.hypot(dx, dy) || 1;
            S._axU = { ux: dx / Lp, uy: dy / Lp, perPx: 1 / Lp };
          }
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

      // the drag handle, drawn over the scene so it can always be found
      if (hdl) {
        const onD = g.dragging === 'u1';
        ctx.save();
        ctx.strokeStyle = onD ? th.text : g.alpha(acc, .75); ctx.lineWidth = onD ? 2.2 : 1.6;
        ctx.beginPath(); ctx.arc(hdl.x, hdl.y, hdl.r, 0, TAU); ctx.stroke(); ctx.restore();
        if (hdl.tip) PA.lbl(ctx, hdl.x, hdl.y + hdl.r + 12, hdl.tip,
                            onD ? th.text : g.alpha(th['text-3'], .95), 'center', 9);
        g.handle(hdl.x, hdl.y, hdl.r + 3, 'u1');
      }

      // the moment of impact, as a brief starburst
      if (flashAt) {
        const q = cam.project(flashAt);
        if (q.ok) {
          const age = (t - S.flash) / 0.18;
          ctx.save();
          ctx.strokeStyle = g.alpha('#FFF4C2', 0.9 * (1 - age)); ctx.lineWidth = 2;
          for (let i = 0; i < 10; i++) {
            const an = i / 10 * TAU, r0 = 6 + age * 10, r1 = 14 + age * 22;
            ctx.beginPath(); ctx.moveTo(q.x + Math.cos(an) * r0, q.y + Math.sin(an) * r0);
            ctx.lineTo(q.x + Math.cos(an) * r1, q.y + Math.sin(an) * r1); ctx.stroke();
          }
          ctx.restore();
        }
      }

      /* ---------------- the two books ----------------
         Momentum and kinetic energy, before and after, side by side. One
         column always balances; the other balances only when e = 1. */
      const narrow = W < 660;
      S._panelTop = null;
      {
        const bw = narrow ? Math.min(W - 24, 300) : Math.min(W * 0.36, 300);
        const bh = 116, bx = 12, by = H - bh - 30;
        S._panelTop = by;
        ctx.fillStyle = g.alpha('#0B1020', .92);
        ctx.strokeStyle = g.alpha(th.line, 1); ctx.lineWidth = 1;
        ctx.beginPath(); ctx.roundRect(bx, by, bw, bh, 8); ctx.fill(); ctx.stroke();
        PA.lbl(ctx, bx + 10, by + 13, 'THE TWO BOOKS', th['text-3'], 'left', 8.5);
        PA.lbl(ctx, bx + bw * 0.60, by + 13, 'before', th['text-3'], 'right', 8.5);
        PA.lbl(ctx, bx + bw - 10, by + 13, 'after', th['text-3'], 'right', 8.5);
        const row = (i, k, a, b, c) => {
          PA.lbl(ctx, bx + 10, by + 31 + i * 15, k, th['text-3'], 'left', 9);
          PA.lbl(ctx, bx + bw * 0.60, by + 31 + i * 15, a, th['text-2'], 'right', 9.5);
          PA.lbl(ctx, bx + bw - 10, by + 31 + i * 15, b, c || th['text-2'], 'right', 9.5);
        };
        const same = Math.abs(R.p1 - R.p0) < 1e-6 * Math.max(1, Math.abs(R.p0));
        const pLab = p.mode === 'ballistic' ? 'momentum (at impact)' : p.mode === 'burst' ? 'horizontal momentum' : 'momentum Σmv';
        row(0, pLab, R.p0.toFixed(3), R.p1.toFixed(3), same ? th.ok : th.crit);
        row(1, 'kinetic energy (J)', R.K0.toFixed(p.mode === 'ballistic' ? 1 : 2),
            R.K1.toFixed(p.mode === 'ballistic' ? 2 : 2),
            Math.abs(R.K1 - R.K0) < 1e-6 * Math.max(1, R.K0) ? th.ok : th.warn);
        let dK = R.dK;
        if (Math.abs(dK) < 5e-10 * Math.max(1, R.K0)) dK = 0;
        row(2, p.mode === 'burst' ? 'energy added by the charge' : 'energy lost to heat, sound',
            '', dK.toFixed(2) + ' J', dK > 1e-6 ? th.warn : th.ok);
        let last;
        if (p.mode === 'head1d' || p.mode === 'oblique')
          last = ['e measured = separate ÷ approach', R.willHit ? (R.separate / R.approach).toFixed(3) : '—'];
        else if (p.mode === 'ballistic')
          last = ['share of KE that survives', (100 * R.kept).toFixed(2) + ' %'];
        else last = ['pieces land together?', R.together ? 'yes' : 'no'];
        row(3, last[0], '', last[1], acc);
        PA.lbl(ctx, bx + 10, by + bh - 10,
               same ? 'momentum balances to the last digit — it always will'
                    : 'momentum changed: an external force acted', same ? th.ok : th.crit, 'left', 8.5);
      }

      /* ---------------- the view from the centre of mass ----------------
         Step onto the CM and every collision looks the same: two momenta,
         equal and opposite, before and after. Only their size (set by e) and
         their direction (set by the line of centres) change. */
      if (p.showCOM) {
        const cf = comFrame(S);
        /* On a phone the two panels cannot both sit at the bottom without
           burying the bench, so this one goes to the top, short and wide,
           and the balls run in the gap between them. */
        const bw = narrow ? W - 24 : 214, bh = narrow ? 84 : 116;
        const bx = narrow ? 12 : W - bw - 14;
        const by = narrow ? 40 : H - bh - 30;
        ctx.fillStyle = g.alpha('#0B1020', .92);
        ctx.strokeStyle = g.alpha(th.line, 1); ctx.lineWidth = 1;
        ctx.beginPath(); ctx.roundRect(bx, by, bw, bh, 8); ctx.fill(); ctx.stroke();
        PA.lbl(ctx, bx + 10, by + 13, 'SEEN FROM THE CM', th['text-3'], 'left', 8.5);
        let mx = 1e-9;
        cf.pre.concat(cf.post).forEach(v => { mx = Math.max(mx, Math.hypot(v[0], v[1])); });
        const sc = Math.min(bw / 4 - 12, bh / 2 - 16) / mx;
        [['before', cf.pre, bx + bw * 0.27], ['after', cf.post, bx + bw * 0.73]].forEach(col => {
          const cx = col[2], cy = by + bh / 2 + 6;
          PA.lbl(ctx, cx, by + bh - 10, col[0], th['text-3'], 'center', 8.5);
          ctx.fillStyle = comCol;
          ctx.beginPath(); ctx.arc(cx, cy, 3.2, 0, TAU); ctx.fill();
          col[1].forEach((v, i) => {
            const L0 = Math.hypot(v[0], v[1]) * sc;
            if (L0 < 2) return;
            const x1 = cx + v[0] * sc, y1 = cy - v[1] * sc, an = Math.atan2(y1 - cy, x1 - cx);
            const c = i === 0 ? col1 : col2;
            ctx.strokeStyle = c; ctx.fillStyle = c; ctx.lineWidth = 2;
            ctx.beginPath(); ctx.moveTo(cx, cy); ctx.lineTo(x1, y1); ctx.stroke();
            ctx.beginPath(); ctx.moveTo(x1, y1);
            ctx.lineTo(x1 - 6 * Math.cos(an - 0.45), y1 - 6 * Math.sin(an - 0.45));
            ctx.lineTo(x1 - 6 * Math.cos(an + 0.45), y1 - 6 * Math.sin(an + 0.45));
            ctx.closePath(); ctx.fill();
          });
          const zero = col[1].every(v => Math.hypot(v[0], v[1]) * sc < 2);
          if (zero) PA.lbl(ctx, cx, cy - 14, 'both at rest', th['text-2'], 'center', 8.5);
        });
      }

      ctx.fillStyle = g.alpha(th['text-3'], .95);
      ctx.font = '10px "IBM Plex Mono",monospace'; ctx.textAlign = 'left';
      ctx.fillText(p.mode === 'ballistic'
        ? 'momentum for the impact, energy for the swing — never the other way round'
        : p.mode === 'burst'
        ? 'internal forces only: the centre of mass never learns the shell exploded'
        : 'm₁ = ' + p.m1.toFixed(1) + ' kg, m₂ = ' + p.m2.toFixed(1) + ' kg · e = ' + p.e.toFixed(2) +
          ' · shown at 0.3× speed', 14, 31);
    },

    onDrag(S, e) {
      if (e.id !== 'u1' || !S._axU) return;
      const along = e.dx * S._axU.ux + e.dy * S._axU.uy;
      const p = S.p;
      /* A fixed gain per screen pixel, not per metre of bench: the bench axis
         is foreshortened by the camera (§2.13), and a per-metre gain made a
         50 px drag worth 0.07 m/s. Here 50 px is about 1.25 m/s, 100 m/s of
         bullet or 5 m/s of launch speed — a full slider in one sweep. */
      if (p.mode === 'ballistic') p.uBul = clamp(p.uBul + along * 2.0, 20, 1000);
      else if (p.mode === 'burst') p.u0 = clamp(p.u0 + along * 0.10, 5, 60);
      else p.u1 = clamp(p.u1 + along * 0.025, -10, 10);
      this.setup(S);
    },

    plots: [
      { title: 'Sweep one knob and hold the rest — what the outcome depends on',
        legend: [{ c: '#F29A4A', label: 'ball / piece 1' }, { c: '#4A9AF2', label: 'ball / piece 2' },
                 { c: '#F5E663', label: 'centre of mass · or the total' }],
        draw(S, g) {
          const p = S.p, R = S.R, c1 = '#F29A4A', c2 = '#4A9AF2', cc = '#F5E663';
          if (p.mode === 'head1d') {
            /* final velocities against e: two straight lines that cross the CM
               velocity at e = 0, where the balls move together */
            const a = [], b = [];
            const M = p.m1 + p.m2;
            for (let i = 0; i <= 100; i++) {
              const e = i / 100;
              a.push([e, ((p.m1 - e * p.m2) * p.u1 + (1 + e) * p.m2 * p.u2) / M]);
              b.push([e, ((p.m2 - e * p.m1) * p.u2 + (1 + e) * p.m1 * p.u1) / M]);
            }
            const all = a.concat(b).map(q => q[1]).concat([R.vcom[0], 0]);
            let lo = Math.min.apply(null, all), hi = Math.max.apply(null, all);
            const pad = Math.max(0.5, (hi - lo) * 0.12); lo -= pad; hi += pad;
            const P = g.Plot({ xmin: 0, xmax: 1, ymin: lo, ymax: hi,
              xlabel: 'coefficient of restitution e', ylabel: 'velocity after (m/s)',
              xfmt: v => v.toFixed(1), yfmt: v => v.toFixed(1) }).frame();
            P.clip(() => {
              P.line([[0, R.vcom[0]], [1, R.vcom[0]]], g.alpha(cc, .9), 1.5, [5, 4]);
              P.line([[0, 0], [1, 0]], g.alpha(g.theme['text-3'], .5), 1);
              P.line(a, c1, 2.2); P.line(b, c2, 2.2);
              P.vline(p.e, g.alpha(g.theme.text, .5), [3, 3]);
              P.dot(p.e, R.V1[0], 4.5, c1, g.theme['ink-950']);
              P.dot(p.e, R.V2[0], 4.5, c2, g.theme['ink-950']);
            });
            P.tag(0.02, R.vcom[0], 'e = 0: they move off together at the CM speed', cc, 'left', -9);
            return;
          }
          if (p.mode === 'oblique') {
            /* deflection of each ball, and the angle between them, against the
               offset. With equal masses and e = 1 the total is 90° for EVERY
               offset — the flat line is the whole theorem. */
            const a = [], b = [], s = [];
            const M = p.m1 + p.m2, e = p.e;
            for (let i = 0; i <= 120; i++) {
              const f = 0.95 * i / 120, nx = Math.sqrt(1 - f * f), ny = -f;
              const u1n = p.u1 * nx, u2n = p.u2 * nx;
              const v1n = ((p.m1 - e * p.m2) * u1n + (1 + e) * p.m2 * u2n) / M;
              const v2n = ((p.m2 - e * p.m1) * u2n + (1 + e) * p.m1 * u1n) / M;
              const V1 = [p.u1 + (v1n - u1n) * nx, (v1n - u1n) * ny];
              const V2 = [p.u2 + (v2n - u2n) * nx, (v2n - u2n) * ny];
              const d1 = Math.abs(Math.atan2(V1[1], V1[0])) * 180 / Math.PI;
              const d2 = Math.abs(Math.atan2(V2[1], V2[0])) * 180 / Math.PI;
              const s1 = Math.hypot(V1[0], V1[1]), s2 = Math.hypot(V2[0], V2[1]);
              a.push([f, s1 > 1e-6 ? d1 : NaN]); b.push([f, d2]);
              s.push([f, (s1 > 1e-6 && s2 > 1e-6)
                ? Math.acos(clamp((V1[0] * V2[0] + V1[1] * V2[1]) / (s1 * s2), -1, 1)) * 180 / Math.PI : NaN]);
            }
            const P = g.Plot({ xmin: 0, xmax: 0.95, ymin: 0, ymax: 180,
              xlabel: 'offset b ÷ (r₁ + r₂)', ylabel: 'angle (°)',
              xfmt: v => v.toFixed(1), yfmt: v => v.toFixed(0) }).frame();
            const seg = (pts) => pts.filter(q => isFinite(q[1]));
            P.clip(() => {
              P.line([[0, 90], [0.95, 90]], g.alpha(g.theme['text-3'], .7), 1, [4, 3]);
              P.line(seg(a), c1, 2); P.line(seg(b), c2, 2); P.line(seg(s), cc, 2.4);
              P.vline(clamp(p.bImp, 0, 0.95), g.alpha(g.theme.text, .5), [3, 3]);
              if (R.ang != null) P.dot(clamp(p.bImp, 0, 0.95), R.ang, 4.5, cc, g.theme['ink-950']);
            });
            P.tag(0.02, 90, '90°', g.theme['text-3'], 'left', -8);
            return;
          }
          if (p.mode === 'ballistic') {
            const a = [];
            const M = p.mBul + p.mBlk;
            for (let i = 0; i <= 160; i++) {
              const u = 20 + 980 * i / 160, v = p.mBul * u / M, h = v * v / (2 * G);
              a.push([u, h > 2 * p.Lstr ? 180 : Math.acos(clamp(1 - h / p.Lstr, -1, 1)) * 180 / Math.PI]);
            }
            const P = g.Plot({ xmin: 20, xmax: 1000, ymin: 0, ymax: 180,
              xlabel: 'bullet speed (m/s)', ylabel: 'swing angle θ (°)',
              xfmt: v => v.toFixed(0), yfmt: v => v.toFixed(0) }).frame();
            P.clip(() => {
              P.line([[20, 90], [1000, 90]], g.alpha(g.theme['text-3'], .6), 1, [4, 3]);
              P.line(a, c2, 2.2);
              P.vline(p.uBul, g.alpha(g.theme.text, .5), [3, 3]);
              P.dot(p.uBul, R.overTop ? 180 : R.theta, 4.5, c2, g.theme['ink-950']);
            });
            P.tag(30, 90, 'string horizontal', g.theme['text-3'], 'left', -8);
            return;
          }
          /* burst: where each piece lands as the mass is shared differently */
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
          let lo = Math.min.apply(null, all), hi = Math.max.apply(null, all);
          const pad = Math.max(1, (hi - lo) * 0.08); lo -= pad; hi += pad;
          const P = g.Plot({ xmin: 0.05, xmax: 0.95, ymin: lo, ymax: hi,
            xlabel: 'piece 1 share of the mass', ylabel: 'landing distance (m)',
            xfmt: v => v.toFixed(1), yfmt: v => v.toFixed(0) }).frame();
          P.clip(() => {
            P.line([[0.05, R.range], [0.95, R.range]], g.alpha(g.theme['text-3'], .7), 1, [4, 3]);
            P.line(a, c1, 2); P.line(b, c2, 2); P.line(c, cc, 2.2);
            P.vline(p.fSplit, g.alpha(g.theme.text, .5), [3, 3]);
            P.dot(p.fSplit, R.x1, 4.5, c1, g.theme['ink-950']);
            P.dot(p.fSplit, R.x2, 4.5, c2, g.theme['ink-950']);
          });
          P.tag(0.06, R.range, 'range if it had not burst', g.theme['text-3'], 'left', -8);
        },
        hover(S, x) {
          const p = S.p;
          if (p.mode !== 'head1d') return null;
          const M = p.m1 + p.m2, e = clamp(x, 0, 1);
          const v1 = ((p.m1 - e * p.m2) * p.u1 + (1 + e) * p.m2 * p.u2) / M;
          const v2 = ((p.m2 - e * p.m1) * p.u2 + (1 + e) * p.m1 * p.u1) / M;
          const mu = p.m1 * p.m2 / M;
          return [{ label: 'e', value: e.toFixed(2) },
                  { label: 'v₁', value: v1.toFixed(3) + ' m/s', color: '#F29A4A' },
                  { label: 'v₂', value: v2.toFixed(3) + ' m/s', color: '#4A9AF2' },
                  { label: 'KE lost', value: (0.5 * mu * (1 - e * e) * Math.pow(p.u1 - p.u2, 2)).toFixed(2) + ' J' }];
        } },

      { title: 'Momentum through the event — traded between the parts, kept by the whole',
        legend: [{ c: '#F29A4A', label: 'part 1' }, { c: '#4A9AF2', label: 'part 2' },
                 { c: '#F5E663', label: 'total' }],
        draw(S, g) {
          const p = S.p, R = S.R, c1 = '#F29A4A', c2 = '#4A9AF2', cc = '#F5E663';
          const T = S.tEnd, n = 240;
          const A = [], B = [], C = [];
          if (p.mode === 'head1d' || p.mode === 'oblique') {
            for (let i = 0; i <= n; i++) {
              const t = T * i / n, hit = isFinite(S.tc) && t >= S.tc;
              const a = R.m1 * (hit ? R.V1 : R.U1)[0], b = R.m2 * (hit ? R.V2 : R.U2)[0];
              A.push([t, a]); B.push([t, b]); C.push([t, a + b]);
            }
          } else if (p.mode === 'ballistic') {
            /* After the impact the string and gravity are external forces, so
               the horizontal momentum is no longer conserved. Integrate the
               same pendulum the bench uses and show it. */
            let thh = 0, om = R.omega0;
            const k = G / p.Lstr, h = T / n, Mt = p.mBul + p.mBlk;
            for (let i = 0; i <= n; i++) {
              const t = T * i / n;
              if (t < S.tImp) { A.push([t, p.mBul * p.uBul]); B.push([t, 0]); C.push([t, p.mBul * p.uBul]); continue; }
              const px = Mt * p.Lstr * om * Math.cos(thh);
              C.push([t, px]); A.push([t, NaN]); B.push([t, NaN]);
              const f = (a, b) => [b, -k * Math.sin(a)];
              const s1 = f(thh, om), s2 = f(thh + s1[0] * h / 2, om + s1[1] * h / 2),
                    s3 = f(thh + s2[0] * h / 2, om + s2[1] * h / 2), s4 = f(thh + s3[0] * h, om + s3[1] * h);
              thh += h / 6 * (s1[0] + 2 * s2[0] + 2 * s3[0] + s4[0]);
              om += h / 6 * (s1[1] + 2 * s2[1] + 2 * s3[1] + s4[1]);
            }
          } else {
            for (let i = 0; i <= n; i++) {
              const t = T * i / n;
              if (t < R.tA) { A.push([t, NaN]); B.push([t, NaN]); C.push([t, R.m * R.vx]); continue; }
              const s = t - R.tA;
              // a landed piece stops: the ground has taken its momentum
              const a = s < R.t1 ? R.m1 * R.V1[0] : 0, b = s < R.t2f ? R.m2 * R.V2[0] : 0;
              A.push([t, a]); B.push([t, b]); C.push([t, a + b]);
            }
          }
          const vals = A.concat(B, C).map(q => q[1]).filter(isFinite).concat([0]);
          let lo = Math.min.apply(null, vals), hi = Math.max.apply(null, vals);
          const pad = Math.max(0.2, (hi - lo) * 0.12); lo -= pad; hi += pad;
          const P = g.Plot({ xmin: 0, xmax: T, ymin: lo, ymax: hi,
            xlabel: p.mode === 'head1d' || p.mode === 'oblique' ? 'time (s, real)' : 'time (s)',
            ylabel: 'horizontal momentum (kg·m/s)',
            xfmt: v => v.toFixed(2), yfmt: v => v.toFixed(1) }).frame();
          const seg = (pts) => {
            const out = []; let cur = [];
            pts.forEach(q => { if (isFinite(q[1])) cur.push(q); else if (cur.length) { out.push(cur); cur = []; } });
            if (cur.length) out.push(cur);
            return out;
          };
          P.clip(() => {
            P.line([[0, 0], [T, 0]], g.alpha(g.theme['text-3'], .45), 1);
            seg(A).forEach(s => P.line(s, c1, 1.8));
            seg(B).forEach(s => P.line(s, c2, 1.8));
            seg(C).forEach(s => P.line(s, cc, 2.6));
            P.vline(S.t2, g.alpha(g.theme.text, .5), [3, 3]);
          });
          const lab = p.mode === 'ballistic' ? 'kept through the impact, not through the swing'
                    : p.mode === 'burst' ? 'kept until a piece hits the ground'
                    : 'total: flat straight through the impact';
          P.tag(T * 0.02, C[0][1], lab, cc, 'left', -9);
        } }
    ],

    readouts(S) {
      const p = S.p, R = S.R;
      if (p.mode === 'ballistic') {
        return [
          { label: 'Speed just after impact', value: R.v.toFixed(3), unit: 'm/s', flag: 'accent',
            hint: 'mu/(m+M), from momentum' },
          { label: 'Rise of the block', value: (R.h * 100).toFixed(2), unit: 'cm', hint: 'v²/2g, from energy' },
          { label: 'Swing angle', value: R.overTop ? 'over the top' : R.theta.toFixed(2), unit: R.overTop ? '' : '°',
            flag: R.overTop ? 'warn' : 'accent' },
          { label: 'KE of the bullet', value: R.K0.toFixed(1), unit: 'J' },
          { label: 'KE after embedding', value: R.K1.toFixed(3), unit: 'J',
            hint: (100 * R.kept).toFixed(2) + '% survives' },
          { label: 'Lost in the block', value: R.dK.toFixed(1), unit: 'J', flag: 'warn',
            hint: 'heat, sound, torn wood' },
          { label: 'Bullet speed read from θ', value: R.overTop ? '—' : R.uFromAngle.toFixed(1), unit: 'm/s',
            flag: 'ok', hint: 'what the experiment measures' },
          { label: 'Wrong: energy all the way', value: Math.sqrt(2 * G * R.h * (p.mBul + p.mBlk) / p.mBul).toFixed(1),
            unit: 'm/s', flag: 'crit', hint: 'the trap: too low' }
        ];
      }
      if (p.mode === 'burst') {
        return [
          { label: 'Piece 1 lands at', value: R.x1.toFixed(2), unit: 'm', flag: 'accent' },
          { label: 'Piece 2 lands at', value: R.x2.toFixed(2), unit: 'm', flag: 'accent' },
          { label: 'Range with no burst', value: R.range.toFixed(2), unit: 'm', hint: 'u² sin 2α / g' },
          { label: 'Mass-weighted landing', value: R.xMean.toFixed(2), unit: 'm',
            flag: R.together ? 'ok' : 'warn',
            hint: R.together ? 'equals R: they land together' : 'not R: different flight times' },
          { label: 'Burst height', value: R.zA.toFixed(2), unit: 'm' },
          { label: 'Relative speed of the pieces', value: R.w.toFixed(2), unit: 'm/s', hint: '√(2Q/μ)' },
          { label: 'Piece 1 velocity', value: Math.hypot(R.V1[0], R.V1[1]).toFixed(2), unit: 'm/s',
            hint: Math.hypot(R.V1[0], R.V1[1]) < 0.01 ? 'at rest after the burst'
            : 'at ' + (Math.round(Math.atan2(R.V1[1], R.V1[0]) * 180 / Math.PI) + 0) + '°' },
          { label: 'Piece 2 velocity', value: Math.hypot(R.V2[0], R.V2[1]).toFixed(2), unit: 'm/s',
            hint: Math.hypot(R.V2[0], R.V2[1]) < 0.01 ? 'at rest after the burst'
            : 'at ' + (Math.round(Math.atan2(R.V2[1], R.V2[0]) * 180 / Math.PI) + 0) + '°' }
        ];
      }
      const out = [
        { label: 'v₁ after', value: R.V1[0].toFixed(3), unit: 'm/s', flag: 'accent',
          hint: p.mode === 'oblique' ? 'x-part · ' + R.sp1.toFixed(2) + ' m/s at ' + R.th1.toFixed(1) + '°' : 'sign = direction' },
        { label: 'v₂ after', value: R.V2[0].toFixed(3), unit: 'm/s', flag: 'accent',
          hint: p.mode === 'oblique' ? 'x-part · ' + R.sp2.toFixed(2) + ' m/s at ' + R.th2.toFixed(1) + '°' : 'sign = direction' },
        { label: 'Centre-of-mass velocity', value: R.vcom[0].toFixed(3), unit: 'm/s',
          hint: 'the same before and after' },
        { label: 'Total momentum', value: R.p0.toFixed(3), unit: 'kg·m/s', flag: 'ok',
          hint: 'after: ' + R.p1.toFixed(3) },
        { label: 'KE lost', value: R.dK.toFixed(3), unit: 'J', flag: R.dK > 1e-9 ? 'warn' : 'ok',
          hint: R.K0 > 0 ? (100 * R.dK / R.K0).toFixed(1) + '% of the total' : '' },
        { label: 'Most it could lose', value: R.Krel.toFixed(3), unit: 'J',
          hint: 'KE relative to the CM' },
        { label: 'Impulse on each ball', value: R.J.toFixed(3), unit: 'N·s', hint: '(1+e)μ × closing speed' },
        { label: 'Restitution, measured', value: R.willHit ? (R.separate / R.approach).toFixed(3) : '—', unit: '',
          hint: 'separating ÷ closing speed' }
      ];
      if (p.mode === 'oblique')
        out.push({ label: 'Angle between the paths', value: R.ang == null ? '—' : R.ang.toFixed(2), unit: '°',
          flag: 'accent', hint: 'equal m, e = 1 → 90°' });
      return out;
    },

    equation(S) {
      const p = S.p, R = S.R;
      if (p.mode === 'ballistic')
        return E.v('v') + ' ' + E.op('=') + ' ' + E.frac(E.v('m') + E.v('u'), E.v('m') + E.op('+') + E.v('M')) +
          ' ' + E.op('=') + ' ' + E.n(R.v, 'm/s') + E.op('·') + ' ' + E.v('h') + ' ' + E.op('=') + ' ' +
          E.frac(E.v('v') + '²', '2' + E.v('g')) + ' ' + E.op('=') + ' ' + E.n(R.h * 100, 'cm') +
          '<br>' + E.frac('KE after', 'KE before') + ' ' + E.op('=') + ' ' +
          E.frac(E.v('m'), E.v('m') + E.op('+') + E.v('M')) + ' ' + E.op('=') + ' ' + E.n(100 * R.kept, '%');
      if (p.mode === 'burst')
        return E.v('m') + E.v('v') + E.sub('top') + ' ' + E.op('=') + ' ' + E.v('m') + '₁' + E.v('v') + '₁ ' +
          E.op('+') + ' ' + E.v('m') + '₂' + E.v('v') + '₂' + E.op('·') + ' ' + E.v('Q') + ' ' + E.op('=') + ' ½' +
          E.v('μ') + E.v('w') + '² ' + E.op('=') + ' ' + E.n(p.Q, 'J') +
          '<br>' + E.v('x') + E.sub('cm') + ' ' + E.op('=') + ' ' +
          E.frac(E.v('m') + '₁' + E.v('x') + '₁' + E.op('+') + E.v('m') + '₂' + E.v('x') + '₂', E.v('m')) + ' ' +
          E.op('=') + ' ' + E.n(R.xMean, 'm') + (R.together ? ' = R' : ' ≠ R ' + E.op('(') + 'they land apart in time)');
      return E.v('v') + '₁ ' + E.op('=') + ' ' +
        E.frac('(' + E.v('m') + '₁' + E.op('−') + E.v('em') + '₂)' + E.v('u') + '₁' + E.op('+') + '(1' + E.op('+') +
          E.v('e') + ')' + E.v('m') + '₂' + E.v('u') + '₂', E.v('m') + '₁' + E.op('+') + E.v('m') + '₂') +
        ' ' + E.op('=') + ' ' + E.n(p.mode === 'oblique' ? R.V1[0] * R.n[0] + R.V1[1] * R.n[1] : R.V1[0], 'm/s') +
        (p.mode === 'oblique' ? ' along n; the part across n is untouched' : '') +
        '<br>' + E.v('v') + '₂ ' + E.op('−') + ' ' + E.v('v') + '₁ ' + E.op('=') + ' ' + E.v('e') + '(' +
        E.v('u') + '₁' + E.op('−') + E.v('u') + '₂)' + E.sub(p.mode === 'oblique' ? 'along n' : '') + E.op('·') +
        ' Δ' + E.v('K') + ' ' + E.op('=') + ' ½' + E.v('μ') + '(1' + E.op('−') + E.v('e') + '²)' +
        E.v('u') + E.sub('rel') + '² ' + E.op('=') + ' ' + E.n(R.dK, 'J');
    },

    eqNote: '<b>Momentum is always conserved in a collision; kinetic energy almost never is.</b> ' +
      'The coefficient of restitution says how much of the closing speed along the line of centres ' +
      'comes back as separating speed. The energy lost is ½μ(1 − e²)u<sub>rel</sub>², where μ = ' +
      'm₁m₂/(m₁+m₂) is the reduced mass. That expression holds the whole chapter: the loss is largest ' +
      'for a head-on hit (all of u<sub>rel</sub> lies along the line of centres), zero for e = 1, and ' +
      'can never exceed the KE seen from the centre of mass. That limit is why two cars that stick ' +
      'together still keep moving.',

    problems: [
      { source: 'JEE Main pattern · restitution in one dimension',
        q: 'A 2.00 kg ball moving at 6.00 m/s hits a 4.00 kg ball at rest, head-on, with e = 0.500. Find the speed of the 4.00 kg ball after the collision, in m/s.',
        params: { mode: 'head1d', m1: 2, m2: 4, u1: 6, u2: 0, e: 0.5 },
        predict: { label: 'v₂ after', unit: 'm/s', tol: 0.02 },
        measure: S => S.R.V2[0],
        working: 'Momentum: 2(6) = 2v₁ + 4v₂. Restitution: v₂ − v₁ = 0.5 × 6 = 3. Solve the pair: ' +
          '12 = 2(v₂ − 3) + 4v₂, so 6v₂ = 18 and <b>v₂ = 3.00 m/s</b>, with v₁ = 0. The first ball stops ' +
          'dead. That is a coincidence of these numbers (m₁ = e·m₂), not a rule, and it makes a good check: ' +
          'KE falls from 36 J to 18 J, so half is lost, which matches ½μ(1 − e²)u² = ½(4/3)(0.75)(36) = 18 J.' },
      { source: 'NEET pattern · energy lost when they stick',
        q: 'A 3.00 kg trolley at 4.00 m/s runs into a 1.00 kg trolley at rest and they couple together. How much kinetic energy is lost, in joules?',
        params: { mode: 'head1d', m1: 3, m2: 1, u1: 4, u2: 0, e: 0 },
        predict: { label: 'KE lost', unit: 'J', tol: 0.02 },
        measure: S => S.R.dK,
        working: 'They share the CM velocity: v = 3 × 4 / 4 = 3 m/s. KE goes from ½·3·16 = 24 J to ' +
          '½·4·9 = 18 J, so <b>6.00 J</b> is lost. The quick route is ½μu² with μ = 3·1/4 = 0.75 kg: ' +
          '½ × 0.75 × 16 = 6 J. Note that 18 J survives: a perfectly inelastic collision destroys only ' +
          'the energy of the motion <i>relative to</i> the CM, never the CM\'s own kinetic energy.' },
      { source: 'JEE Advanced pattern · the glancing elastic collision',
        q: 'A 2.00 kg ball at 5.00 m/s strikes an identical ball at rest, off-centre, with offset b = 0.5(r₁ + r₂). The collision is elastic. Find the angle between their paths afterwards, in degrees.',
        params: { mode: 'oblique', m1: 2, m2: 2, u1: 5, u2: 0, e: 1, bImp: 0.5 },
        predict: { label: 'angle between paths', unit: '°', tol: 0.01 },
        measure: S => S.R.ang,
        working: 'Momentum as vectors: u = v₁ + v₂ (the masses cancel). Energy: u² = v₁² + v₂². ' +
          'Square the first: u² = v₁² + v₂² + 2v₁·v₂. Comparing the two gives v₁·v₂ = 0, so the paths ' +
          'are <b>90.0°</b> apart. The offset does not matter; it only decides how the 90° is shared ' +
          '(here 30° and 60°). This is why snooker players can predict where the cue ball goes.' },
      { source: 'JEE Main pattern · the ballistic pendulum',
        q: 'A 10.0 g bullet at 400 m/s embeds itself in a 1.99 kg block hanging on a light string. How high does the block rise, in centimetres? Take g = 9.81 m/s².',
        params: { mode: 'ballistic', mBul: 0.01, mBlk: 1.99, uBul: 400, Lstr: 1 },
        predict: { label: 'rise h', unit: 'cm', tol: 0.02 },
        measure: S => S.R.h * 100,
        working: 'Two stages, two laws. The impact is fast, so momentum: v = 0.010 × 400 / 2.00 = 2.00 m/s. ' +
          'The swing is smooth, so energy: h = v²/2g = 4.00/19.62 = <b>20.4 cm</b>. Using energy for the ' +
          'whole thing gives ½(0.01)(400²)/(2.00 × 9.81) = 40.8 m, two hundred times too high. Only 0.5% of ' +
          'the bullet\'s energy survives the impact; the rest heats the block.' },
      { source: 'JEE Advanced pattern · the shell that bursts at the top',
        q: 'A 2.00 kg shell is fired at 20.0 m/s at 45°. At the top it bursts into two equal halves; one falls straight down from rest. How far from the gun does the other land, in metres? Take g = 9.81 m/s².',
        params: { mode: 'burst', mProj: 2, u0: 20, alpha: 45, fSplit: 0.5, Q: 200, beta: 180 },
        predict: { label: 'landing distance', unit: 'm', tol: 0.02 },
        measure: S => S.R.x2,
        working: 'The range is R = u² sin 90° / g = 40.8 m, and the burst is internal, so the CM still ' +
          'lands at R. Both halves leave the top moving horizontally, so they are in the air for the same ' +
          'time and land together. The one that drops lands at R/2, so the other must land at x where ' +
          '(R/2 + x)/2 = R, which gives x = 3R/2 = <b>61.2 m</b>. If the halves did <i>not</i> land ' +
          'together this shortcut would fail: once the first piece hits the ground, the ground is an ' +
          'external force.' }
    ],

    walkthrough: [
      { title: '1 · The centre of mass does not notice the collision',
        body: 'Two balls, 2 kg and 4 kg, head-on at e = 0.6. Watch the yellow marker between them.',
        ask: 'What happens to the centre of mass at the moment of impact?',
        reveal: '<b>Nothing.</b> It moves at the same velocity straight through the impact. The forces ' +
          'between the balls are internal: equal, opposite, and acting for the same time, so they cancel ' +
          'in the total. The second graph shows it directly: the two coloured momenta jump, and the yellow ' +
          'total does not move by a single digit.',
        params: { mode: 'head1d', m1: 2, m2: 4, u1: 6, u2: 0, e: 0.6 } },
      { title: '2 · Equal masses, elastic: they swap',
        body: 'Set equal masses and e = 1.',
        ask: 'After the impact, what is the first ball doing?',
        reveal: '<b>Standing still</b>, and the second ball leaves at exactly the first one\'s speed. The ' +
          'balls swap velocities, which is how a Newton\'s cradle works. The COM panel shows why: seen ' +
          'from the CM, each momentum simply reverses.',
        params: { mode: 'head1d', m1: 2, m2: 2, u1: 5, u2: 0, e: 1 } },
      { title: '3 · Light on heavy: it bounces back',
        body: 'Now a 1 kg ball hits a 10 kg ball at rest, elastically.',
        ask: 'Which way does the light ball go afterwards?',
        reveal: '<b>Backwards</b>, at nearly its original speed, while the heavy ball creeps forward. In ' +
          'the limit of an infinitely heavy target it rebounds at exactly −u, which is why a ball bouncing ' +
          'off a wall reverses. Reverse the roles (heavy hits light) and the light ball flies off at ' +
          'nearly <b>2u</b>, not u. That factor of two is a common exam question.',
        params: { mode: 'head1d', m1: 1, m2: 10, u1: 4, u2: 0, e: 1 } },
      { title: '4 · They stick: the most energy that can go',
        body: 'Set e = 0 and read the two books.',
        ask: 'Is all the kinetic energy lost when they stick?',
        reveal: '<b>No.</b> Only the energy of the motion relative to the CM can go. The CM still carries ' +
          '½Mv<sub>cm</sub>², and nothing internal can touch it. All the energy is lost only when the CM ' +
          'is at rest, as in two equal cars meeting head-on at equal speeds.',
        params: { mode: 'head1d', m1: 2, m2: 4, u1: 6, u2: 0, e: 0 } },
      { title: '5 · Glancing, equal masses: always 90°',
        body: 'Switch to the glancing collision, equal masses, e = 1, and move the offset.',
        ask: 'Does the angle between the two paths change as you change the offset?',
        reveal: '<b>No — it stays at 90° for any offset.</b> The first graph shows the yellow line flat at ' +
          '90° while the two deflections trade off. Lower e or change a mass and the line leaves 90°. ' +
          'The impulse acts only along the dashed line of centres, so ball 2 always leaves along that line.',
        params: { mode: 'oblique', m1: 2, m2: 2, u1: 5, u2: 0, e: 1, bImp: 0.5 } },
      { title: '6 · Ballistic pendulum: two laws, two stages',
        body: 'A 10 g bullet at 400 m/s into a 1.99 kg block.',
        ask: 'Can you get the bullet speed from the rise h using energy conservation alone?',
        reveal: '<b>No — the red readout shows what that gives.</b> Kinetic energy is not conserved in the ' +
          'embedding; only 0.5% survives. Use momentum across the impact and energy for the swing. The ' +
          'second graph shows the other half: once it swings, horizontal momentum is not conserved either, ' +
          'because the string pulls.',
        params: { mode: 'ballistic', mBul: 0.01, mBlk: 1.99, uBul: 400, Lstr: 1 } },
      { title: '7 · An explosion is a collision run backwards',
        body: 'The shell bursts at the top. Drag the split direction and the energy released.',
        ask: 'Does the centre of mass still follow the original parabola?',
        reveal: '<b>Yes, while both pieces are in the air.</b> The explosion is internal, so it cannot move ' +
          'the CM. Kinetic energy goes <i>up</i> by exactly Q, the mirror image of a collision. The moment ' +
          'one piece lands, the ground pushes on it, and the marker turns orange and leaves the parabola.',
        params: { mode: 'burst', mProj: 2, u0: 20, alpha: 45, fSplit: 0.3, Q: 500, beta: 60 } }
    ],

    quiz: [
      { q: 'In a perfectly inelastic collision between two bodies:',
        options: ['all the kinetic energy is lost', 'momentum is lost',
                  'the kinetic energy relative to the CM is lost', 'no energy is lost'], answer: 2,
        why: 'Internal forces cannot change the CM velocity, so ½Mv²ₘ always survives. Only the relative-motion energy ½μu²ᵣₑₗ can be dissipated.' },
      { q: 'A ball hits an identical ball at rest in an elastic, head-on collision. Afterwards:',
        options: ['both move at u/2', 'the first stops, the second moves at u',
                  'the first rebounds at u', 'both stop'], answer: 1,
        why: 'Equal masses with e = 1 exchange velocities. This is the Newton\'s cradle.' },
      { q: 'Two identical smooth balls collide elastically, one initially at rest, off-centre. The angle between their final paths is:',
        options: ['0°', '45°', '90°', 'depends on the offset'], answer: 2,
        why: 'Vector momentum gives u = v₁ + v₂; energy gives u² = v₁² + v₂². Together v₁·v₂ = 0, whatever the offset.' },
      { q: 'In a ballistic pendulum, the correct method is:',
        options: ['energy conservation throughout', 'momentum conservation throughout',
                  'momentum for the impact, energy for the swing', 'energy for the impact, momentum for the swing'], answer: 2,
        why: 'The embedding is inelastic, so KE is not conserved there. During the swing the string and gravity act, so momentum is not conserved there, but mechanical energy is.' },
      { q: 'A projectile explodes in mid-air into two pieces. Until either piece lands, its centre of mass:',
        options: ['stops', 'falls vertically', 'follows the original parabola', 'moves in a straight line'], answer: 2,
        why: 'The explosion forces are internal. Only gravity acts on the system, so the CM keeps the path of the unexploded shell.' }
    ],

    notes: '<b>Where this shows up in the paper.</b>' +
      '<ul><li>One-dimensional collisions: momentum plus Newton\'s restitution law, v₂ − v₁ = e(u₁ − u₂).</li>' +
      '<li>The special cases worth knowing without algebra: equal masses swap (e = 1), a heavy body ' +
      'barely changes speed, a light body rebounds, and a light target leaves at nearly 2u.</li>' +
      '<li>Energy lost: ΔK = ½μ(1 − e²)(u₁ − u₂)², with μ the reduced mass.</li>' +
      '<li>Oblique collisions of smooth spheres: the impulse acts along the line of centres only, and ' +
      'the tangential components are unchanged.</li>' +
      '<li>The ballistic pendulum, and bullet-in-block problems generally.</li>' +
      '<li>Explosions and recoil (guns, shells, a man walking on a boat): the CM stays fixed, or keeps ' +
      'its path, if no external force acts.</li></ul>' +
      '<div class="pyq"><em>Trap to avoid</em>Newton\'s restitution law uses the components ' +
      '<b>along the line of centres</b>, not the full speeds. In a glancing collision, applying ' +
      'e to the speeds gives a wrong answer that still looks reasonable.</div>' +
      '<div class="pyq"><em>Trap to avoid</em>"Momentum is conserved" means the momentum of the ' +
      '<b>whole isolated system</b>, over the <b>short time of the impact</b>. It does not hold for one ' +
      'ball by itself, for a pendulum that is swinging, or once a piece of a shell has hit the ground.</div>'
  });


})(window.InsightLab);
