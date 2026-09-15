/* ============================================================
   PHYSICS — 9. Rolling, slipping and the moment of inertia
             10. Damped-driven resonance and coupled normal modes
   ============================================================ */
(function (L) {
  'use strict';
  const { clamp, TAU, fmt, E } = L;
  const PA = window.PHYSART, R3 = window.R3, RX = window.RX;
  const Camera = L.Camera;
  const G = 9.80665;

  /* =========================================================================
     9 · ROLLING MOTION — the friction test is run, not assumed

     Nothing here is told to roll. Each body is given the translational and
     rotational equations, and the friction needed for rolling is COMPUTED
     and compared against mu*N every step. If it cannot be supplied, the
     body slips, and the two equations decouple. That is the whole topic.
     ========================================================================= */
  const SHAPES = [
    { id: 'sphere', k: 2 / 5,  name: 'Solid sphere',    inertia: '⅖MR²',  ex: 'marble, ball bearing' },
    { id: 'disc',   k: 1 / 2,  name: 'Solid cylinder',  inertia: '½MR²',  ex: 'coin, solid wheel' },
    { id: 'shell',  k: 2 / 3,  name: 'Hollow sphere',   inertia: '⅔MR²',  ex: 'football, shell' },
    { id: 'ring',   k: 1,      name: 'Ring / hoop',     inertia: 'MR²',   ex: 'bangle, hollow pipe' }
  ];
  const COL = { sphere: '#3DD6F5', disc: '#FFAE4C', shell: '#7CE0A8', ring: '#FF6B9D' };

  L.register({
    id: 'rolling', subject: 'physics',
    name: 'Rolling, Slipping and the Moment of Inertia',
    chapter: 'System of Particles & Rotational Motion',
    exams: ['JEE Main', 'JEE Advanced', 'NEET UG'],
    weight: 'Very high yield',
    is3D: true,
    stageHint: 'Drag to orbit the bench · friction is not assumed, it is computed each step and tested against μN',
    lede: 'Four bodies are released together from the same height. They arrive in a fixed order that does ' +
      '<b>not depend on their mass or their radius</b> — only on how that mass is distributed. This lab does not ' +
      'draw the answer: it integrates <b>Ma = Mg sinθ − f</b> and <b>Iα = fR</b> for each body and checks at ' +
      'every step whether the friction rolling would need is actually available. Drop μ far enough and you can ' +
      'watch a body <b>slip</b>, its angular velocity fall out of step with its speed, and the race order change.',

    params: { shape: 'sphere', theta: 25, mu: 0.40, race: true, vectors: true, hRelease: 1.2 },

    presets: [
      { name: 'The classic race', params: { theta: 25, mu: 0.40, race: true } },
      { name: 'Ring alone', params: { shape: 'ring', race: false, theta: 25, mu: 0.40 } },
      { name: 'Slippery slope (μ = 0.05)', params: { theta: 25, mu: 0.05, race: true } },
      { name: 'Frictionless — nothing rotates', params: { theta: 25, mu: 0, race: true } },
      { name: 'Steep incline, sphere slips', params: { shape: 'sphere', theta: 55, mu: 0.14, race: false } }
    ],

    controls: [
      { group: 'Body', items: [
        { key: 'shape', type: 'select', label: 'Rolling body', restructure: true,
          options: SHAPES.map(s => ({ value: s.id, label: s.name })) },
        { key: 'race', type: 'toggle', label: 'Race all four together', restructure: true }
      ] },
      { group: 'Incline', items: [
        { key: 'theta', label: 'Incline angle <i>θ</i>', min: 5, max: 70, step: 0.5, unit: '°',
          fmt: v => v.toFixed(1), restructure: true },
        { key: 'mu', label: 'Coefficient of friction <i>μ</i>', min: 0, max: 1.0, step: 0.01, unit: '',
          fmt: v => v.toFixed(2), restructure: true },
        { key: 'hRelease', label: 'Release height <i>h</i>', min: 0.3, max: 2.5, step: 0.05, unit: 'm',
          fmt: v => v.toFixed(2), restructure: true }
      ] },
      { group: 'Display', items: [
        { key: 'vectors', type: 'toggle', label: 'Show force vectors' }
      ] }
    ],

    setup(S) {
      const p = S.p;
      const th = p.theta * Math.PI / 180;
      S.th = th;
      S.list = p.race ? SHAPES.slice() : SHAPES.filter(s => s.id === p.shape);
      S.len = p.hRelease / Math.max(Math.sin(th), 1e-3);       // slope length, metres
      // R cancels out of a, v and mu_min alike, so the drawn radius is chosen
      // for legibility rather than realism — and the lab says so out loud.
      S.R = Math.max(0.10, S.len * 0.075);
      S.M = 1.0;                                               // and 1 kg — so the student
                                                               // can see they cancel

      S.runs = S.list.map(sh => {
        // The friction required for pure rolling, from the two equations:
        //   Ma = Mg sinθ − f     and     (kMR²)(a/R) = fR   =>   f = k M a
        //   a = g sinθ/(1+k)  and  f_req = k Mg sinθ/(1+k)
        const aRoll = G * Math.sin(th) / (1 + sh.k);
        const fReq = sh.k * S.M * aRoll;
        const fMax = p.mu * S.M * G * Math.cos(th);
        const rolls = fReq <= fMax + 1e-12;
        const muMin = sh.k * Math.tan(th) / (1 + sh.k);
        return {
          sh: sh, s: 0, v: 0, w: 0, phi: 0, done: false, tFinish: 0,
          aRoll: aRoll, fReq: fReq, fMax: fMax, rolls: rolls, muMin: muMin,
          col: COL[sh.id]
        };
      });
      S.runout = S.len * 0.55;                 // flat run-out past the finish line
      // Frame the bench on the track that was actually built. A three-quarter
      // view, NOT side-on: the four bodies run in lanes across the bench, and
      // a side-on camera puts those lanes straight down the depth axis where
      // they hide behind one another.
      {
        const run = S.len * Math.cos(th), rise = S.len * Math.sin(th);
        const span = run + S.runout;
        const tgt = [(-run + S.runout) / 2, 0, rise * 0.34];
        if (!S.cam) {
          S.cam = Camera({ theta: -2.12, phi: 0.33, dist: span * 1.00, target: tgt });
          S.cam.minDist = 1.0; S.cam.maxDist = 20;
        } else {
          S.cam.target = tgt;
          S.cam.home.dist = span * 1.00;
          if (!S.camTouched) S.cam.dist = span * 1.00;
        }
      }
      S.tSim = 0; S.finished = 0; S.hold = 0;
      S.trace = S.runs.map(() => []);
    },

    step(S, dt) {
      const p = S.p, th = S.th;
      S.t = (S.t || 0) + dt;
      if (S.runs.every(r => r.done)) {
        S.hold += dt;
        if (S.hold > 2.2) this.setup(S);
        return;
      }
      // slow the whole event down so the order is watchable
      const scale = 0.42;
      const n = 8, h = dt * scale / n;
      for (let i = 0; i < n; i++) {
        S.tSim += h;
        S.runs.forEach((r, idx) => {
          if (r.done) return;
          const N = S.M * G * Math.cos(th);
          const fMax = p.mu * N;
          let f, a, alpha;
          if (r.fReq <= fMax + 1e-12) {
            // static friction can supply what rolling needs
            f = r.fReq;
            a = G * Math.sin(th) - f / S.M;
            alpha = f * S.R / (r.sh.k * S.M * S.R * S.R);
          } else {
            // it cannot: the surface slips and friction saturates at μN,
            // so the two equations stop being linked
            f = fMax;
            a = G * Math.sin(th) - f / S.M;
            alpha = f * S.R / (r.sh.k * S.M * S.R * S.R);
          }
          if (r.s < S.len) {
            r.v += a * h;
            r.w += alpha * h;
            // once slipping has spun it up to the rolling condition it locks in
            if (r.w * S.R > r.v) r.w = r.v / S.R;
            r.a = a; r.f = f; r.alpha = alpha;
            if (r.s + r.v * h >= S.len && !r.crossed) {
              r.crossed = true; r.tFinish = S.tSim; S.finished++; r.place = S.finished;
            }
          } else {
            // On the flat, a rolling body needs NO torque to keep going, so it
            // needs no friction: it carries on at constant speed. Letting it run
            // out is what stops the four piling up on the finish line — and it
            // is the same fact the notes make a point of.
            r.a = 0; r.f = 0; r.alpha = 0;
          }
          r.s += r.v * h; r.phi += r.w * h;
          if (r.s >= S.len + S.runout) { r.s = S.len + S.runout; r.done = true; }
        });
      }
      S.runs.forEach((r, idx) => {
        const tr = S.trace[idx];
        if (!tr.length || S.tSim - tr[tr.length - 1][0] > 0.012) tr.push([S.tSim, r.v]);
        if (tr.length > 900) tr.shift();
      });
    },

    drawStage(S, g) {
      const ctx = g.ctx, th = g.theme, p = S.p, W = g.w, H = g.h;
      const cam = S.cam;
      const F = R3.Frame(ctx, cam, { ambient: 0.28, floorZ: 0 });

      /* ---------------- the bench, in metres ----------------
         x runs down the slope's shadow, y across the bench, z up.
         The incline is a real wedge: a ramp face, two side walls and a
         base, so it has thickness and casts a shadow like a solid. */
      const th0 = S.th, run = S.len * Math.cos(th0), rise = S.len * Math.sin(th0);
      // Four bodies run abreast, so the bench must be wide enough that they
      // never intersect — but NOT so wide that it stops looking like a ramp.
      // The width is capped at 60% of the slope length: an incline that is
      // wider than it is long reads as a flat sheet with balls floating on it.
      const laneRaw = S.R * 2.25;
      const wantHalf = laneRaw * S.runs.length / 2 + S.R * 0.6;
      const halfW = Math.min(wantHalf, S.len * 0.36);
      const laneW = S.runs.length > 1
        ? Math.min(laneRaw, (halfW - S.R * 0.6) * 2 / S.runs.length) : 0;
      const runout = S.runout * Math.cos(0);

      // floor
      {
        const fz = -Math.max(0.06, S.len * 0.045);
        R3.plane(F, [-run - 0.45, -halfW - 0.55, fz], [run + runout + 1.2, 0, 0],
                 [0, 2 * halfW + 1.10, 0], '#18202F',
                 { grid: 12, gridColour: '#44577F', gridAlpha: 0.18, edge: false,
                   bias: F.GROUND * 1.2 });
      }

      // the ramp face itself
      const top = [-run, 0, rise], toe = [0, 0, 0];
      R3.plane(F, [-run, -halfW, rise], [run, 0, -rise], [0, 2 * halfW, 0], '#54658C',
               { grid: 10, gridColour: '#CBD9F5', gridAlpha: 0.22, bias: F.GROUND });
      // The two triangular side walls, which is what makes this a solid wedge
      // rather than a sheet. They run the FULL depth of the ramp — a thin skirt
      // on a two-metre-wide bench reads as paper.
      const base = -Math.max(0.06, S.len * 0.045);
      [-1, 1].forEach(sg => {
        const yy = sg * halfW;
        F.push([-run * 0.5, yy, rise * 0.4], () => {
          const q = [[-run, yy, rise], [0, yy, 0], [0, yy, base], [-run, yy, base]]
            .map(pt => cam.project(pt));
          if (q.some(x => !x.ok)) return;
          ctx.fillStyle = F.shade('#2A3552', [0, sg, 0], { ambient: 0.34 });
          ctx.beginPath();
          q.forEach((x, k) => k ? ctx.lineTo(x.x, x.y) : ctx.moveTo(x.x, x.y));
          ctx.closePath(); ctx.fill();
          ctx.strokeStyle = 'rgba(159,180,222,.40)'; ctx.lineWidth = 1.2; ctx.stroke();
        }, F.GROUND);
      });
      // the back face under the release gate, so the wedge is closed
      F.push([-run, 0, rise * 0.5], () => {
        const q = [[-run, -halfW, rise], [-run, halfW, rise], [-run, halfW, base], [-run, -halfW, base]]
          .map(pt => cam.project(pt));
        if (q.some(x => !x.ok)) return;
        ctx.fillStyle = F.shade('#232E48', [-1, 0, 0], { ambient: 0.30 });
        ctx.beginPath();
        q.forEach((x, k) => k ? ctx.lineTo(x.x, x.y) : ctx.moveTo(x.x, x.y));
        ctx.closePath(); ctx.fill();
        ctx.strokeStyle = 'rgba(159,180,222,.35)'; ctx.lineWidth = 1.2; ctx.stroke();
      }, F.GROUND);
      // the flat run-out the bodies roll onto
      R3.plane(F, [0, -halfW, 0], [runout + 0.6, 0, 0], [0, 2 * halfW, 0], '#46557A',
               { grid: 7, gridColour: '#CBD9F5', gridAlpha: 0.20, bias: F.GROUND });
      [-1, 1].forEach(sg => {
        const yy = sg * halfW;
        F.push([(runout + 0.6) / 2, yy, base / 2], () => {
          const q = [[0, yy, 0], [runout + 0.6, yy, 0], [runout + 0.6, yy, base], [0, yy, base]]
            .map(pt => cam.project(pt));
          if (q.some(x => !x.ok)) return;
          ctx.fillStyle = F.shade('#2A3552', [0, sg, 0], { ambient: 0.34 });
          ctx.beginPath();
          q.forEach((x, k) => k ? ctx.lineTo(x.x, x.y) : ctx.moveTo(x.x, x.y));
          ctx.closePath(); ctx.fill();
          ctx.strokeStyle = 'rgba(159,180,222,.40)'; ctx.lineWidth = 1.2; ctx.stroke();
        }, F.GROUND);
      });

      /* ---------------- the release gate and the height ----------------
         Both are HANDLES: the gate sets the release height and the toe sets
         the angle, so the student can build the experiment rather than only
         dial it in from the control deck. */
      R3.box(F, [-run - 0.05, 0, rise + 0.10], [0.06, 2 * halfW * 0.98, 0.20], '#8FA3C0',
             { shadow: false, bias: F.GROUND });
      R3.callout(F, [-run - 0.05, 0, rise + 0.14], -18, -16, 'release gate · drag', th['text-3']);
      {
        const qg = cam.project([-run - 0.05, 0, rise + 0.10]);
        if (qg.ok) g.handle(qg.x, qg.y, 18, 'gate');
        const qt = cam.project([0.10, 0, 0]);
        if (qt.ok) g.handle(qt.x, qt.y, 16, 'toe');
      }
      // the drop, marked as a height because the energy argument uses it
      {
        const hy = halfW + 0.12;
        R3.arrow(F, [-run, hy, rise], [-run, hy, 0], S.R * 0.07, '#FFD36B',
                 { head: S.R * 0.34, shadow: false });
        R3.arrow(F, [-run, hy, 0], [-run, hy, rise], S.R * 0.07, '#FFD36B',
                 { head: S.R * 0.34, shadow: false });
        R3.callout(F, [-run, hy, rise * 0.5], -18, 0,
                   'h = ' + p.hRelease.toFixed(2) + ' m', '#FFD36B');
      }

      // the angle, as an arc on the bench floor
      {
        const arcPts = [];
        for (let i = 0; i <= 18; i++) {
          const a = th0 * i / 18;
          arcPts.push([-0.55 * Math.cos(a), -halfW - 0.02, 0.55 * Math.sin(a)]);
        }
        R3.tube(F, arcPts, 0.012, '#3DD6F5', { round: false, shadow: false });
        R3.callout(F, [-0.62 * Math.cos(th0 / 2), -halfW - 0.02, 0.62 * Math.sin(th0 / 2)],
                   -20, -6, 'θ = ' + p.theta.toFixed(1) + '°', '#3DD6F5');
      }

      /* ---------------- the bodies ---------------- */
      const along = sMetres => {
        // position of the CONTACT POINT along the track
        if (sMetres <= S.len) {
          return { p: [-run + sMetres * Math.cos(th0), 0, rise - sMetres * Math.sin(th0)],
                   n: [Math.sin(th0), 0, Math.cos(th0)],
                   t: [Math.cos(th0), 0, -Math.sin(th0)], onSlope: true };
        }
        return { p: [(sMetres - S.len), 0, 0], n: [0, 0, 1], t: [1, 0, 0], onSlope: false };
      };

      const lanes = S.runs.length;
      S.runs.forEach((r, idx) => {
        const c = along(r.s);
        const lane = lanes > 1 ? (idx - (lanes - 1) / 2) * laneW : 0;
        const centre = [c.p[0] + c.n[0] * S.R, lane, c.p[2] + c.n[2] * S.R];
        // the rotation axis is across the bench
        const a = [centre[0], centre[1] - S.R * 0.45, centre[2]];
        const b = [centre[0], centre[1] + S.R * 0.45, centre[2]];
        const spherical = r.sh.id === 'sphere' || r.sh.id === 'shell';
        if (spherical) {
          R3.sphere(F, centre, S.R, r.col, { rim: 0.8, sub: 0.45 });
          // a painted meridian so the spin is visible on a sphere too
          const mer = [];
          for (let i = 0; i <= 30; i++) {
            const t = i / 30 * TAU;
            const ca = Math.cos(r.phi), sa = Math.sin(r.phi);
            const lx = Math.cos(t) * S.R * 0.99, lz = Math.sin(t) * S.R * 0.99;
            mer.push([centre[0] + lx * ca - lz * sa, lane, centre[2] + lx * sa + lz * ca]);
          }
          R3.tube(F, mer, S.R * 0.055, RX.mix(r.col, '#05080F', 0.45),
                  { round: false, shadow: false, bias: -S.R * 0.9 });
        } else {
          R3.cylinder(F, a, b, S.R, r.col, {
            segments: 30, spokes: 8, phase: r.phi,
            inner: r.sh.id === 'ring' ? S.R * 0.74 : 0,
            capColour: RX.mix(r.col, '#ffffff', 0.10)
          });
        }
        if (lanes > 1) {
          R3.callout(F, [centre[0], lane, centre[2] + S.R * 1.25], 0, -10 - idx * 11,
                     (r.place ? '#' + r.place + ' ' : '') + r.sh.name, r.col, { size: 9 });
        }
        if (!r.rolls) {
          R3.label(F, [centre[0], lane, centre[2] - S.R * 1.5], 'SLIPPING', th.crit, { size: 8.5 });
        }
      });

      /* ---------------- the force vectors, at the contact point ---------------- */
      if (p.vectors) {
        const r = S.runs.find(q => q.sh.id === p.shape) || S.runs[0];
        const idx = S.runs.indexOf(r);
        const lane = lanes > 1 ? (idx - (lanes - 1) / 2) * laneW : 0;
        const c = along(r.s);
        const foot = [c.p[0], lane, c.p[2]];
        const cen = [c.p[0] + c.n[0] * S.R, lane, c.p[2] + c.n[2] * S.R];
        const sc = S.R * 0.11;                       // metres per newton
        const ar = S.R * 0.085;
        R3.arrow(F, cen, [cen[0], lane, cen[2] - S.M * 9.80665 * sc], ar, '#FFD36B',
                 { label: 'Mg', head: S.R * 0.36 });
        const N = S.M * 9.80665 * (c.onSlope ? Math.cos(th0) : 1);
        R3.arrow(F, foot, [foot[0] + c.n[0] * N * sc, lane, foot[2] + c.n[2] * N * sc],
                 ar, '#8FA3C0', { label: 'N', head: S.R * 0.36 });
        if (r.f > 0.01) {
          R3.arrow(F, foot, [foot[0] - c.t[0] * r.f * sc, lane, foot[2] - c.t[2] * r.f * sc],
                   ar, r.rolls ? '#7CE0A8' : '#FB7185',
                   { label: 'f = ' + r.f.toFixed(2) + ' N', head: S.R * 0.36 });
        }
        // and the angular velocity, about the axis it actually turns on
        if (Math.abs(r.w) > 0.2) {
          // omega = (n x v)/R, which for motion down-slope with the axis across
          // the bench points along +y, not -y.
          R3.arrow(F, [cen[0], lane + S.R * 1.5, cen[2]], [cen[0], lane + S.R * 2.6, cen[2]],
                   ar * 0.8, '#B07CC6', { label: 'ω', head: S.R * 0.34 });
        }
      }

      F.render();

      /* ---------------- 2D overlays on top of the 3D scene ---------------- */
      const HDR = 58;
      {
        const r = S.runs.find(q => q.sh.id === p.shape) || S.runs[0];
        const KEt = 0.5 * S.M * r.v * r.v;
        const KEr = 0.5 * (r.sh.k * S.M * S.R * S.R) * r.w * r.w;
        const drop = Math.min(r.s, S.len) * Math.sin(S.th);
        const lost = Math.max(0, S.M * 9.80665 * drop - KEt - KEr);
        const tot = Math.max(KEt + KEr + lost, 1e-9);
        const bw = Math.min(W * 0.30, 250), bhh = 15;
        const bx0 = W - bw - 14, by0 = H - bhh - 44;
        let cur = bx0;
        [[KEt, '#3DD6F5'], [KEr, '#FFAE4C'], [lost, '#FB7185']].forEach(([val, col]) => {
          const wpx = bw * val / tot;
          if (wpx < 0.4) return;
          ctx.fillStyle = g.alpha(col, .85);
          ctx.fillRect(cur, by0, wpx, bhh);
          if (wpx > 42) PA.lbl(ctx, cur + wpx / 2, by0 + bhh / 2,
                               (100 * val / tot).toFixed(0) + '%', '#F2F6FF', 'center', 9);
          cur += wpx;
        });
        ctx.strokeStyle = g.alpha(th.line, 1); ctx.lineWidth = 1;
        ctx.strokeRect(bx0, by0, bw, bhh);
        PA.lbl(ctx, bx0, by0 - 8, 'where the potential energy went', th['text-3'], 'left', 9);
        PA.lbl(ctx, bx0, by0 + bhh + 10,
               'translation  ·  rotation  ·  heat', th['text-3'], 'left', 8.5);
      }

      const sel = S.runs.find(q => q.sh.id === p.shape) || S.runs[0];
      ctx.textAlign = 'left'; ctx.textBaseline = 'top';
      ctx.font = '700 19px "IBM Plex Sans Condensed",sans-serif'; ctx.fillStyle = th.text;
      ctx.fillText(sel.rolls ? 'ROLLING WITHOUT SLIPPING' : 'SLIPPING — v ≠ ωR', 14, 8);
      ctx.font = '500 10px "IBM Plex Mono",monospace';
      ctx.fillStyle = sel.rolls ? th.ok : th.crit;
      ctx.fillText(sel.rolls
        ? 'friction needed ' + sel.fReq.toFixed(2) + ' N  ≤  μN = ' + sel.fMax.toFixed(2) + ' N'
        : 'friction needed ' + sel.fReq.toFixed(2) + ' N  >  μN = ' + sel.fMax.toFixed(2) +
          ' N — the surface cannot supply it', 14, 31);
      ctx.fillStyle = th['text-3'];
      ctx.fillText('a = g sinθ/(1+k) = ' + sel.aRoll.toFixed(3) + ' m/s²   ·   ' +
        'k = I/MR² = ' + sel.sh.k.toFixed(3) + '   ·   μ_min = ' + sel.muMin.toFixed(3), 14, 44);

      if (S.runs.every(q => q.done) && S.runs.length > 1) {
        const order = S.runs.slice().sort((a, b) => a.tFinish - b.tFinish);
        PA.lbl(ctx, W - 14, 10, 'FINISH ORDER', th.text, 'right', 11, 'top');
        order.forEach((r, i) => {
          PA.lbl(ctx, W - 14, 26 + i * 12,
                 (i + 1) + '. ' + r.sh.name + '  (k = ' + r.sh.k.toFixed(2) + ')',
                 r.col, 'right', 9, 'top');
        });
      }
    },
    /* The bench is built by hand: drag the gate up and down to set the release
       height, drag near the toe to steepen or flatten the slope. Both write
       into S.p, so the control deck follows along. */
    onDrag(S, e) {
      const cam = S.cam;
      if (!cam || e.phase === 'end') { if (e.phase === 'end') this.setup(S); return; }
      // how many metres one screen pixel is worth at the target distance
      const perPx = cam.dist / Math.max(cam._k, 1);
      if (e.id === 'gate') {
        S.p.hRelease = clamp(S.p.hRelease - e.dy * perPx, 0.3, 2.5);
        this.setup(S);
      } else if (e.id === 'toe') {
        S.p.theta = clamp(S.p.theta - e.dy * perPx * 90, 5, 70);
        this.setup(S);
      }
    },

    plots: [
      { title: 'Speed down the slope — the order is set before anything moves',
        legend: SHAPES.map(s => ({ c: COL[s.id], label: s.name })),
        draw(S, g) {
          const tmax = Math.max(0.6, S.tSim * 1.05);
          const vmax = Math.max(0.5, Math.sqrt(2 * G * S.p.hRelease) * 1.05);
          const P = g.Plot({
            xmin: 0, xmax: tmax, ymin: 0, ymax: vmax,
            xlabel: 'time (s)', ylabel: 'speed v (m/s)',
            xfmt: v => v.toFixed(2), yfmt: v => v.toFixed(1)
          }).frame();
          P.clip(() => {
            // the frictionless slider, for comparison — it always wins
            const aF = G * Math.sin(S.th);
            const slide = [];
            for (let i = 0; i <= 60; i++) {
              const t = tmax * i / 60;
              const v = aF * t, s = 0.5 * aF * t * t;
              if (s > S.len) break;
              slide.push([t, v]);
            }
            P.line(slide, g.alpha(g.theme['text-3'], .8), 1.4, [4, 3]);
            S.trace.forEach((tr, i) => {
              if (tr.length > 1) P.line(tr, S.runs[i].col, 2.2);
            });
          });
          if (S.runs.length) P.tag(tmax * 0.02, Math.sqrt(2 * G * S.p.hRelease) * 0.97,
                                   'frictionless slider (no rotation)', g.theme['text-3'], 'left', 0);
        },
        hover(S, x) {
          const rows = [{ label: 'time', value: x.toFixed(3) + ' s' }];
          S.runs.forEach((r, i) => {
            const tr = S.trace[i];
            if (!tr || !tr.length) return;
            let best = tr[0];
            for (const q of tr) if (Math.abs(q[0] - x) < Math.abs(best[0] - x)) best = q;
            rows.push({ label: r.sh.name, value: best[1].toFixed(3) + ' m/s', color: r.col });
          });
          return rows;
        } },
      { title: 'Acceleration against how the mass is distributed — mass and radius are absent',
        legend: [{ c: '#3DD6F5', label: 'a = g sinθ/(1+k)' },
                 { c: '#FB7185', label: 'μ needed to roll' }],
        draw(S, g) {
          const aF = G * Math.sin(S.th);
          const P = g.Plot({
            xmin: 0, xmax: 1.15, ymin: 0, ymax: aF * 1.12,
            xlabel: 'k = I / MR²', ylabel: 'acceleration (m/s²)',
            xfmt: v => v.toFixed(2), yfmt: v => v.toFixed(1),
            pad: { l: 52, r: 74, t: 14, b: 34 }
          }).frame();
          P.clip(() => {
            const curve = [];
            for (let i = 0; i <= 80; i++) {
              const k = 1.15 * i / 80;
              curve.push([k, aF / (1 + k)]);
            }
            P.line(curve, '#3DD6F5', 2.2);
            // the μ required, on the same axis but scaled to fit
            const muC = [];
            for (let i = 0; i <= 80; i++) {
              const k = 1.15 * i / 80;
              muC.push([k, (k * Math.tan(S.th) / (1 + k)) * aF * 1.12]);
            }
            P.line(muC, '#FB7185', 1.6, [4, 3]);
            SHAPES.forEach(sh => {
              const on = sh.id === S.p.shape;
              P.dot(sh.k, aF / (1 + sh.k), on ? 5 : 3.4, COL[sh.id], on);
              P.tag(sh.k, aF / (1 + sh.k), sh.inertia, on ? g.theme.text : g.theme['text-3'],
                    'left', -10);
            });
            P.hline(aF, g.alpha(g.theme['text-3'], .7), [3, 3]);
          });
          P.tag(0.02, aF, 'a slider, k = 0', g.theme['text-3'], 'left', -8);
        },
        hover(S, x) {
          const k = clamp(x, 0, 1.15);
          const aF = G * Math.sin(S.th);
          return [{ label: 'k = I/MR²', value: k.toFixed(3) },
                  { label: 'acceleration', value: (aF / (1 + k)).toFixed(3) + ' m/s²', color: '#3DD6F5' },
                  { label: 'μ needed to roll', value: (k * Math.tan(S.th) / (1 + k)).toFixed(3),
                    color: '#FB7185' },
                  { label: 'fraction of KE in rotation', value: (100 * k / (1 + k)).toFixed(1) + '%' }];
        } }
    ],

    readouts(S) {
      const p = S.p;
      const sel = S.runs.find(q => q.sh.id === p.shape) || S.runs[0];
      const vEnd = Math.sqrt(2 * G * p.hRelease / (1 + sel.sh.k));
      return [
        { label: 'Body', value: sel.sh.name, hint: 'I = ' + sel.sh.inertia },
        { label: 'k = I/MR²', value: sel.sh.k.toFixed(4), flag: 'accent',
          hint: 'the only thing that matters' },
        { label: 'Acceleration a = g sinθ/(1+k)', value: sel.aRoll.toFixed(3), unit: 'm/s²' },
        { label: 'Speed at the bottom, if rolling', value: vEnd.toFixed(3), unit: 'm/s',
          flag: sel.rolls ? '' : 'warn',
          hint: sel.rolls ? '√(2gh/(1+k)) — no M, no R'
                          : 'it is slipping, so it will arrive FASTER than this' },
        { label: 'Friction needed', value: sel.fReq.toFixed(3), unit: 'N' },
        { label: 'Friction available μN', value: sel.fMax.toFixed(3), unit: 'N',
          flag: sel.rolls ? 'ok' : 'crit',
          hint: sel.rolls ? 'enough — it rolls' : 'not enough — it slips' },
        { label: 'Minimum μ for rolling', value: sel.muMin.toFixed(4), unit: '',
          flag: 'accent', hint: 'k tanθ/(1+k)' },
        { label: 'KE in rotation', value: (100 * sel.sh.k / (1 + sel.sh.k)).toFixed(1), unit: '%',
          hint: 'k/(1+k), independent of θ' },
        { label: 'Current v', value: sel.v.toFixed(3), unit: 'm/s' },
        { label: 'Current ωR', value: (sel.w * S.R).toFixed(3), unit: 'm/s',
          flag: Math.abs(sel.w * S.R - sel.v) < 1e-3 ? 'ok' : 'warn',
          hint: Math.abs(sel.w * S.R - sel.v) < 1e-3 ? 'v = ωR, rolling' : 'v ≠ ωR, slipping' }
      ];
    },

    equation(S) {
      const sel = S.runs.find(q => q.sh.id === S.p.shape) || S.runs[0];
      return E.v('Ma') + ' ' + E.op('=') + ' ' + E.v('Mg') + ' sinθ ' + E.op('−') + ' ' + E.v('f') +
        '&nbsp;&nbsp;&nbsp;' + E.v('I') + 'α ' + E.op('=') + ' ' + E.v('fR') +
        '&nbsp;&nbsp;⇒&nbsp;&nbsp;' +
        E.v('a') + ' ' + E.op('=') + ' ' + E.frac(E.v('g') + ' sinθ', '1 ' + E.op('+') + ' ' + E.v('k')) +
        ' ' + E.op('=') + ' ' + E.n(sel.aRoll, 'm/s²') +
        '<br>' + E.v('f') + E.sub('req') + ' ' + E.op('=') +
        ' ' + E.frac(E.v('k') + E.v('Mg') + ' sinθ', '1 ' + E.op('+') + ' ' + E.v('k')) +
        '&nbsp;&nbsp;rolls if&nbsp;&nbsp;μ ' + E.op('≥') + ' ' +
        E.frac(E.v('k') + ' tanθ', '1 ' + E.op('+') + ' ' + E.v('k')) +
        ' ' + E.op('=') + ' ' + E.n(sel.muMin, '');
    },

    walkthrough: [
      { title: '1 · The race nobody can rig',
        body: 'Four bodies, all 1 kg, all 10 cm in radius, released from the same height. Watch them finish.',
        ask: 'They have identical mass and identical radius. Why do they not arrive together?',
        reveal: 'Because <b>a = g sinθ/(1+k)</b>, and k = I/MR² differs: ⅖ for a solid sphere, 1 for a ring. ' +
          'The larger k is, the more of the released energy has to go into <b>spinning</b> rather than moving, ' +
          'so less is left for speed. Solid sphere → solid cylinder → hollow sphere → ring, always, ' +
          'and <b>mass and radius cancel out of the answer entirely</b>.',
        params: { theta: 25, mu: 0.40, race: true } },
      { title: '2 · Make them heavier. Make them bigger.',
        body: 'Nothing on this stage lets you change M or R — because it would change nothing. Look at the ' +
          'expression for the speed at the bottom instead: √(2gh/(1+k)).',
        ask: 'A hollow pipe and a solid cylinder of the same mass race. Does making the pipe thinner help it?',
        reveal: 'No. Thinning the pipe pushes its k <b>towards 1</b>, which makes it <b>worse</b>. ' +
          'The only route to winning is moving mass <b>towards the axis</b>. This is why the answer to ' +
          '"which reaches first" never needs a single number substituted.',
        params: { theta: 25, mu: 0.40, race: true } },
      { title: '3 · Take the friction away',
        body: 'Set μ to 0 and run it again.',
        ask: 'With no friction at all, which body wins?',
        reveal: 'They <b>dead-heat</b> — and they all beat every rolling body. With no friction there is no ' +
          'torque about the centre, so <b>nothing rotates</b>: the bodies slide down with the full ' +
          'a = g sinθ. All the potential energy becomes translation. Friction is what makes a rolling body slower, ' +
          'and because it does no work in pure rolling, it steals no energy — it just redirects it into spin.',
        params: { theta: 25, mu: 0, race: true } },
      { title: '4 · The threshold, found by squeezing μ',
        body: 'Put μ back to 0.40, then bring it down slowly and watch the header switch to SLIPPING.',
        ask: 'Which body gives up first, and why is a ring the fussiest?',
        reveal: 'The ring. Rolling requires μ ≥ <b>k tanθ/(1+k)</b>, which rises with k — a ring needs ' +
          '½ tanθ, a solid sphere only ²⁄₇ tanθ. The body that most wants to rotate is the one that most ' +
          'needs grip to do it.',
        params: { theta: 25, mu: 0.05, race: true } },
      { title: '5 · Steepen it until grip runs out',
        body: 'Take a single sphere, set μ to 0.14, and drive θ up past 40°.',
        ask: 'Why does a steep slope break rolling even though gravity is helping the rotation?',
        reveal: 'Because the required friction grows with <b>tanθ</b> while the available friction μMg cosθ ' +
          '<b>falls</b> as cosθ. The two cross, and past that angle the contact point slides: v ≠ ωR, ' +
          'kinetic friction does real work, and energy is genuinely lost as heat — visible in the red ' +
          'segment of the energy bar.',
        params: { shape: 'sphere', theta: 55, mu: 0.14, race: false } }
    ],

    problems: [
      { source: 'NEET pattern · rolling',
        q: 'A solid sphere rolls without slipping from rest down an incline, falling through a vertical height of 1.40 m. Find its speed at the bottom, in m/s. (g = 9.8 m/s²)',
        params: { shape: 'sphere', theta: 30, hRelease: 1.40, mu: 0.5, race: false },
        predict: { label: 'speed at the bottom', unit: 'm/s', tol: 0.02 },
        measure: S => Math.sqrt(2 * G * S.p.hRelease / (1 + 0.4)),
        working: 'Energy: mgh = ½mv² + ½Iω², and with I = ⅖mR² and ω = v/R this becomes ' +
          'mgh = ½mv²(1 + ⅖). So v = √(2gh/1.4) = √(2 × 9.8 × 1.40 / 1.4) = <b>4.43 m/s</b>. ' +
          'Neither the mass nor the radius appears, and neither does the angle of the incline — ' +
          'only the height fallen and the value of k.' },
      { source: 'JEE Main pattern · minimum friction',
        q: 'A solid cylinder (k = ½) is to roll without slipping down an incline of 30°. Find the minimum coefficient of static friction required.',
        params: { shape: 'disc', theta: 30, mu: 0.5, race: false },
        predict: { label: 'minimum μ', unit: '', tol: 0.03 },
        measure: S => {
          const sel = S.runs.find(q => q.sh.id === 'disc') || S.runs[0];
          return sel.muMin;
        },
        working: 'μ_min = k tanθ/(1+k) = (½ × tan30°)/(1 + ½) = (0.5 × 0.5774)/1.5 = <b>0.192</b>. ' +
          'A ring would need ½tan30° = 0.289 and a solid sphere only ²⁄₇tan30° = 0.165 — the body ' +
          'that most wants to rotate needs the most grip to do it.' },
      { source: 'JEE Advanced pattern · energy split',
        q: 'A ring rolls without slipping. What percentage of its total kinetic energy is rotational?',
        params: { shape: 'ring', theta: 25, mu: 0.6, race: false },
        predict: { label: 'rotational fraction', unit: '%', tol: 0.02 },
        measure: S => {
          const sel = S.runs.find(q => q.sh.id === 'ring') || S.runs[0];
          return 100 * sel.sh.k / (1 + sel.sh.k);
        },
        working: 'The split is k/(1+k). For a ring k = 1, so the answer is exactly <b>50%</b>. ' +
          'A solid sphere gives ²⁄₇ ≈ 28.6% and a solid cylinder ⅓. Note the fraction depends on ' +
          'nothing but k — not on the speed, the height, or the angle of the incline.' }
    ],

    quiz: [
      { q: 'A solid sphere, a solid cylinder and a ring of the same mass and radius are released from rest at the top of the same incline and roll without slipping. The order in which they reach the bottom is:',
        options: ['ring, cylinder, sphere', 'sphere, cylinder, ring',
                  'all together', 'cylinder, sphere, ring'], answer: 1,
        why: 'a = g sinθ/(1+k) and k is ⅖ < ½ < 1, so the smallest k accelerates hardest. Mass and radius cancel, so only the distribution matters.' },
      { q: 'For a body of k = I/MR² to roll without slipping down an incline of angle θ, the minimum coefficient of friction is:',
        options: ['tanθ', 'k tanθ', 'k tanθ/(1+k)', 'tanθ/(1+k)'], answer: 2,
        why: 'Rolling needs f = kMg sinθ/(1+k) and the surface can supply at most μMg cosθ. Setting them equal gives μ_min = k tanθ/(1+k).' },
      { q: 'A ring rolls without slipping. The fraction of its total kinetic energy that is rotational is:',
        options: ['1/2', '2/7', '1/3', '2/5'], answer: 0,
        why: 'The rotational fraction is k/(1+k). For a ring k = 1, giving exactly one half — and note this fraction does not depend on the speed or the incline angle at all.' },
      { q: 'A body rolls down an incline without slipping. The work done by friction is:',
        options: ['negative, equal to μMgcosθ × distance', 'zero',
                  'positive and equal to the rotational KE', 'equal to the loss in potential energy'], answer: 1,
        why: 'In pure rolling the contact point is instantaneously at rest, so the friction force acts through zero displacement and does no work. It supplies torque without dissipating energy — which is why mechanical energy is conserved in rolling but not in slipping.' }
    ],

    notes: '<b>Where this shows up in the paper.</b>' +
      '<ul><li>"Which reaches the bottom first" — pure k comparison, no arithmetic needed.</li>' +
      '<li>Minimum μ for rolling: μ ≥ k tanθ/(1+k). Appears almost every year in some form.</li>' +
      '<li>Energy split k/(1+k) — the ⅖ sphere gives ²⁄₇ rotational, the favourite numerical.</li>' +
      '<li>Rolling on a rough <i>horizontal</i> surface at constant velocity: friction is <b>zero</b>, ' +
      'not μN, because no torque is needed.</li></ul>' +
      '<div class="pyq"><em>Trap to avoid</em>Friction in <b>pure rolling</b> is <b>static</b> friction, and it ' +
      'takes whatever value the rolling condition requires — usually <b>far less than μN</b>. Writing f = μN ' +
      'for a rolling body is the single most common error in this chapter. μN is only the <b>ceiling</b>, ' +
      'and it is reached only when the body is on the verge of slipping.</div>'
  });
  /* =========================================================================
     10 · DAMPED–DRIVEN RESONANCE, and the normal modes of a coupled pair

     Two experiments on one bench because they are the same mathematics.
     The single oscillator is integrated as a real ODE (RK4) so the transient
     is a transient and the steady state is reached, not assumed; the coupled
     pair is solved by DIAGONALISING the stiffness matrix, so the normal-mode
     frequencies are eigenvalues rather than formulae copied onto the screen.
     ========================================================================= */

  /* Jacobi eigen-decomposition of a real symmetric 2x2/NxN matrix.
     Returns { val: [...], vec: [[...], ...] } with vec[i] the i-th column. */
  function jacobiEig(Ain, n) {
    const A = Ain.map(r => r.slice());
    const V = [];
    for (let i = 0; i < n; i++) { V.push(new Array(n).fill(0)); V[i][i] = 1; }
    for (let sweep = 0; sweep < 60; sweep++) {
      let off = 0;
      for (let i = 0; i < n; i++) for (let j = i + 1; j < n; j++) off += A[i][j] * A[i][j];
      if (off < 1e-24) break;
      for (let pq = 0; pq < n; pq++) for (let q = pq + 1; q < n; q++) {
        const p = pq;
        if (Math.abs(A[p][q]) < 1e-18) continue;
        const theta = (A[q][q] - A[p][p]) / (2 * A[p][q]);
        const t = Math.sign(theta || 1) / (Math.abs(theta) + Math.sqrt(theta * theta + 1));
        const c = 1 / Math.sqrt(t * t + 1), sN = t * c;
        for (let k = 0; k < n; k++) {
          const akp = A[k][p], akq = A[k][q];
          A[k][p] = c * akp - sN * akq; A[k][q] = sN * akp + c * akq;
        }
        for (let k = 0; k < n; k++) {
          const apk = A[p][k], aqk = A[q][k];
          A[p][k] = c * apk - sN * aqk; A[q][k] = sN * apk + c * aqk;
        }
        for (let k = 0; k < n; k++) {
          const vkp = V[k][p], vkq = V[k][q];
          V[k][p] = c * vkp - sN * vkq; V[k][q] = sN * vkp + c * vkq;
        }
      }
    }
    const val = [], vec = [];
    for (let i = 0; i < n; i++) { val.push(A[i][i]); vec.push(V.map(r => r[i])); }
    // ascending
    const idx = val.map((v, i) => i).sort((a, b) => val[a] - val[b]);
    return { val: idx.map(i => val[i]), vec: idx.map(i => vec[i]) };
  }

  L.register({
    id: 'resonance', subject: 'physics',
    name: 'Resonance, Damping and Normal Modes',
    chapter: 'Oscillations',
    exams: ['JEE Main', 'JEE Advanced', 'NEET UG'],
    weight: 'Very high yield',
    is3D: false,
    stageHint: 'Sweep the driving frequency through ω₀ — amplitude peaks and the phase flips through 90°',
    lede: 'A driven oscillator does not simply "vibrate more near resonance": it develops a definite ' +
      '<b>phase relationship</b> with whatever is driving it, and that phase passes through exactly ' +
      '<b>90°</b> at resonance no matter how heavily it is damped. This lab integrates the real equation ' +
      '<b>mẍ + bẋ + kx = F₀cos(ωt)</b>, so you watch a transient die away and a steady state establish itself. ' +
      'Switch to the coupled pair and the stiffness matrix is <b>diagonalised on the spot</b> — the two ' +
      'normal-mode frequencies you see are its eigenvalues, and the beats are those two modes going in and ' +
      'out of step.',

    params: { mode: 'driven', m: 1.0, k: 40, b: 1.6, F0: 1.0, wDrive: 6.3, kc: 4.0, start: 'beat', trace: true },

    presets: [
      { name: 'At resonance', params: { mode: 'driven', k: 40, m: 1, b: 1.6, wDrive: 6.32 } },
      { name: 'Light damping — a tall narrow peak', params: { mode: 'driven', b: 0.5, wDrive: 6.32 } },
      { name: 'Heavy damping — no peak at all', params: { mode: 'driven', b: 9.0, wDrive: 6.32 } },
      { name: 'Driven well below ω₀ (in phase)', params: { mode: 'driven', b: 1.6, wDrive: 2.0 } },
      { name: 'Driven well above ω₀ (out of phase)', params: { mode: 'driven', b: 1.6, wDrive: 14.0 } },
      { name: 'Coupled: in-phase mode', params: { mode: 'coupled', start: 'sym', kc: 4 } },
      { name: 'Coupled: out-of-phase mode', params: { mode: 'coupled', start: 'anti', kc: 4 } },
      { name: 'Coupled: beats', params: { mode: 'coupled', start: 'beat', kc: 1.2 } }
    ],

    controls: [
      { group: 'Experiment', items: [
        { key: 'mode', type: 'select', label: 'Bench', restructure: true, options: [
          { value: 'driven', label: 'Driven oscillator' },
          { value: 'coupled', label: 'Coupled pair' }] }
      ] },
      { group: 'Oscillator', items: [
        { key: 'm', label: 'Mass <i>m</i>', min: 0.2, max: 4, step: 0.05, unit: 'kg',
          fmt: v => v.toFixed(2), restructure: true },
        { key: 'k', label: 'Spring constant <i>k</i>', min: 5, max: 160, step: 1, unit: 'N/m',
          fmt: v => v.toFixed(0), restructure: true },
        { key: 'b', label: 'Damping <i>b</i>', min: 0, max: 14, step: 0.05, unit: 'N·s/m',
          fmt: v => v.toFixed(2), restructure: true }
      ] },
      { group: 'Drive', items: [
        { key: 'F0', label: 'Driving force <i>F</i><sub>0</sub>', min: 0.2, max: 8, step: 0.1, unit: 'N',
          fmt: v => v.toFixed(1), restructure: true, dynamic: true },
        { key: 'wDrive', label: 'Driving frequency <i>ω</i>', min: 0.4, max: 20, step: 0.02, unit: 'rad/s',
          fmt: v => v.toFixed(2), restructure: true, dynamic: true }
      ] },
      { group: 'Coupling', items: [
        { key: 'kc', label: 'Coupling spring <i>k</i><sub>c</sub>', min: 0, max: 30, step: 0.1, unit: 'N/m',
          fmt: v => v.toFixed(1), restructure: true, dynamic: true },
        { key: 'start', type: 'select', label: 'Released as', restructure: true, dynamic: true, options: [
          { value: 'sym',  label: 'Both together (in phase)' },
          { value: 'anti', label: 'Opposed (out of phase)' },
          { value: 'beat', label: 'One mass only → beats' }] }
      ] },
      { group: 'Display', items: [
        { key: 'trace', type: 'toggle', label: 'Overlay the driving force' }
      ] }
    ],

    setup(S) {
      const p = S.p;
      S.w0 = Math.sqrt(p.k / p.m);                      // natural angular frequency
      S.gamma = p.b / (2 * p.m);                        // damping per unit mass
      S.wd = S.w0 * S.w0 > S.gamma * S.gamma
        ? Math.sqrt(S.w0 * S.w0 - S.gamma * S.gamma) : 0;   // damped frequency
      S.bCrit = 2 * Math.sqrt(p.k * p.m);
      S.zeta = p.b / S.bCrit;                           // damping ratio
      S.Q = S.zeta > 1e-9 ? 1 / (2 * S.zeta) : Infinity;
      // the resonance peak of the AMPLITUDE sits below w0 when damped
      const disc = S.w0 * S.w0 - 2 * S.gamma * S.gamma;
      S.wRes = disc > 0 ? Math.sqrt(disc) : 0;

      // steady-state amplitude and phase lag at the current drive
      const amp = w => (p.F0 / p.m) /
        Math.sqrt(Math.pow(S.w0 * S.w0 - w * w, 2) + Math.pow(2 * S.gamma * w, 2));
      S.ampAt = amp;
      S.A = amp(p.wDrive);
      S.phase = Math.atan2(2 * S.gamma * p.wDrive, S.w0 * S.w0 - p.wDrive * p.wDrive);
      S.Amax = S.wRes > 0 ? amp(S.wRes) : amp(0);
      S.bandwidth = 2 * S.gamma;                        // FWHM in ω, light damping

      /* ---- the coupled pair, solved by diagonalisation ---- */
      // m x1'' = -k x1 - kc (x1 - x2);  m x2'' = -k x2 - kc (x2 - x1)
      // => x'' = -(1/m) K x  with K = [[k+kc, -kc], [-kc, k+kc]]
      const K = [[(p.k + p.kc) / p.m, -p.kc / p.m],
                 [-p.kc / p.m, (p.k + p.kc) / p.m]];
      const eig = jacobiEig(K, 2);
      S.eig = eig;
      S.wMode = eig.val.map(v => Math.sqrt(Math.max(v, 0)));   // [ω_sym, ω_anti]
      S.wBeat = Math.abs(S.wMode[1] - S.wMode[0]);
      S.tBeat = S.wBeat > 1e-9 ? TAU / S.wBeat : Infinity;

      // initial condition, expressed in the mode basis so the modes are visible
      const A0 = 0.06;
      if (p.start === 'sym')      S.x = [A0, A0];
      else if (p.start === 'anti') S.x = [A0, -A0];
      else                        S.x = [A0, 0];
      S.v = [0, 0];

      S.y = 0; S.yd = 0; S.tp = 0;
      S.hist = []; S.hist1 = []; S.hist2 = []; S.drive = [];
      S.settled = 0;
    },

    step(S, dt) {
      const p = S.p;
      S.t = (S.t || 0) + dt;
      const n = 24, h = Math.min(dt, 0.05) / n;
      for (let i = 0; i < n; i++) {
        S.tp += h;
        if (p.mode === 'driven') {
          // RK4 on  y'' = (F0 cos(wt) - b y' - k y)/m
          const acc = (y, yd, t) =>
            (p.F0 * Math.cos(p.wDrive * t) - p.b * yd - p.k * y) / p.m;
          const t0 = S.tp - h;
          const k1v = acc(S.y, S.yd, t0),                 k1x = S.yd;
          const k2v = acc(S.y + k1x * h / 2, S.yd + k1v * h / 2, t0 + h / 2), k2x = S.yd + k1v * h / 2;
          const k3v = acc(S.y + k2x * h / 2, S.yd + k2v * h / 2, t0 + h / 2), k3x = S.yd + k2v * h / 2;
          const k4v = acc(S.y + k3x * h, S.yd + k3v * h, t0 + h),             k4x = S.yd + k3v * h;
          S.y  += h / 6 * (k1x + 2 * k2x + 2 * k3x + k4x);
          S.yd += h / 6 * (k1v + 2 * k2v + 2 * k3v + k4v);
        } else {
          // the coupled pair, integrated directly — the eigen-solution is used
          // to LABEL what happens, never to fake it
          const a1 = (-p.k * S.x[0] - p.kc * (S.x[0] - S.x[1])) / p.m;
          const a2 = (-p.k * S.x[1] - p.kc * (S.x[1] - S.x[0])) / p.m;
          S.v[0] += a1 * h; S.v[1] += a2 * h;
          S.x[0] += S.v[0] * h; S.x[1] += S.v[1] * h;
        }
      }
      const push = (arr, pt) => { arr.push(pt); if (arr.length > 1400) arr.shift(); };
      if (p.mode === 'driven') {
        push(S.hist, [S.tp, S.y]);
        push(S.drive, [S.tp, p.F0 / p.k]);
        S.settled = Math.min(1, S.gamma * S.tp / 4);
      } else {
        push(S.hist1, [S.tp, S.x[0]]);
        push(S.hist2, [S.tp, S.x[1]]);
      }
    },

    drawStage(S, g) {
      const ctx = g.ctx, th = g.theme, p = S.p, W = g.w, H = g.h;
      const HDR = 66, FOOT = 26;
      const y0 = HDR, y1 = H - FOOT, CH = y1 - y0;
      const ACC = '#3DD6F5', DRV = '#FFD36B', M2 = '#FF6B9D';

      if (p.mode === 'driven') {
        /* ---------- one mass on a spring, shaken by a driver ---------- */
        const cx = W * 0.30;
        const ceil = y0 + 26;
        const rest = y0 + CH * 0.52;
        const pxPerM = Math.min(CH * 0.22 / Math.max(S.Amax, 0.02), 1400);
        const drivenY = ceil + Math.sin(p.wDrive * S.tp) * Math.min(24, CH * 0.05);
        const massY = rest + clamp(S.y * pxPerM, -CH * 0.34, CH * 0.34);
        const mw = Math.min(W * 0.10, 78), mh = Math.min(CH * 0.14, 46);

        // the shaker head that supplies F0cos(ωt)
        PA.surface(ctx, cx - W * 0.13, drivenY, cx + W * 0.13, drivenY, 16, '#3A4766');
        PA.lbl(ctx, cx + W * 0.14, drivenY, 'driver  F₀ = ' + p.F0.toFixed(1) + ' N', DRV, 'left', 9.5);

        PA.spring(ctx, cx, drivenY + 8, cx, massY - mh / 2, 9,
                  Math.min(20, mw * 0.26), '#8FA3C0', { wire: 3 });
        // a dashpot alongside, because b is a real element
        const dx2 = cx + mw * 0.85;
        PA.surface(ctx, dx2 - 16, drivenY + 8, dx2 + 16, drivenY + 8, 8, '#2C3550');
        const barrelH = Math.min(CH * 0.16, 54);
        PA.plate(ctx, dx2, drivenY + 8 + barrelH / 2, 22, barrelH, '#2E3A55', 0);
        PA.wire(ctx, [[dx2, drivenY + 8 + barrelH * 0.35], [dx2, massY - mh / 2]], '#8FA3C0', { r: 3 });
        PA.lbl(ctx, dx2 + 18, drivenY + 8 + barrelH / 2, 'b = ' + p.b.toFixed(2), '#8FA3C0', 'left', 9);

        // the mass — and it is a handle, so the student can pull it and let go
        PA.plate(ctx, cx, massY, mw, mh, '#4E86BE', 0);
        PA.lbl(ctx, cx, massY, p.m.toFixed(2) + ' kg', '#F2F6FF', 'center', 11);
        g.handle(cx, massY, Math.max(mw, mh) * 0.6, 'mass');
        S.pxPerM = pxPerM; S.restY = rest;
        if (g.dragging === 'mass') {
          PA.lbl(ctx, cx, massY + mh, 'let go to release', th.accent, 'center', 9);
        }

        // equilibrium line and the live amplitude
        ctx.save(); ctx.setLineDash([4, 4]);
        ctx.strokeStyle = g.alpha(th['text-3'], .5); ctx.lineWidth = 1;
        ctx.beginPath(); ctx.moveTo(cx - W * 0.20, rest); ctx.lineTo(cx + W * 0.22, rest); ctx.stroke();
        ctx.restore();
        PA.lbl(ctx, cx + W * 0.225, rest, 'equilibrium', th['text-3'], 'left', 9);
        // steady-state envelope
        const env = S.A * pxPerM;
        if (env > 3 && env < CH * 0.42) {
          ctx.strokeStyle = g.alpha(ACC, .45); ctx.lineWidth = 1.2;
          ctx.save(); ctx.setLineDash([2, 4]);
          [-1, 1].forEach(sg => {
            ctx.beginPath();
            ctx.moveTo(cx - mw * 1.30, rest + sg * env); ctx.lineTo(cx + mw * 1.0, rest + sg * env);
            ctx.stroke();
          });
          ctx.restore();
          PA.vector(ctx, cx - mw * 1.15, rest - env, cx - mw * 1.15, rest + env, ACC,
                    { width: 2, shadow: false });
          PA.vector(ctx, cx - mw * 1.15, rest + env, cx - mw * 1.15, rest - env, ACC,
                    { width: 2, shadow: false });
          PA.lbl(ctx, cx - mw * 1.25, rest, '2A = ' + (2 * S.A * 100).toFixed(2) + ' cm',
                 ACC, 'right', 9.5);
        }

        /* ---------- the phase dial: the part students never see ---------- */
        const dR = Math.min(W * 0.095, CH * 0.24);
        const dcx = W * 0.72, dcy = y0 + CH * 0.42;
        PA.phasorDial(ctx, dcx, dcy, dR, [
          { mag: 0.92, ang: -p.wDrive * S.tp, colour: DRV, label: 'F', width: 3.4, project: true },
          { mag: 0.92 * clamp(S.A / Math.max(S.Amax, 1e-9), 0.05, 1),
            ang: -p.wDrive * S.tp - S.phase, colour: ACC, label: 'x', width: 3.4, project: true }
        ]);
        // the angle between them IS the phase lag
        ctx.strokeStyle = g.alpha('#B07CC6', .9); ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(dcx, dcy, dR * 0.36, -p.wDrive * S.tp - S.phase, -p.wDrive * S.tp,
                S.phase < 0);
        ctx.stroke();
        PA.lbl(ctx, dcx, dcy + dR + 16,
               'phase lag φ = ' + (S.phase * 180 / Math.PI).toFixed(1) + '°', '#B07CC6', 'center', 10.5);
        PA.lbl(ctx, dcx, dcy + dR + 30,
               Math.abs(S.phase * 180 / Math.PI - 90) < 3 ? 'displacement lags force by a quarter cycle'
               : p.wDrive < S.w0 ? 'below ω₀ — nearly in phase with the force'
                                 : 'above ω₀ — nearly opposite to the force',
               th['text-3'], 'center', 9);

        /* ---------- the energy bookkeeping, live ---------- */
        {
          const KE = 0.5 * p.m * S.yd * S.yd, PE = 0.5 * p.k * S.y * S.y;
          const Pin = p.F0 * Math.cos(p.wDrive * S.tp) * S.yd;   // instantaneous
          const Pdis = p.b * S.yd * S.yd;                        // always ≥ 0
          const Pavg = 0.5 * p.b * Math.pow(p.wDrive * S.A, 2);
          const by0 = y1 - 62, bw = Math.min(W * 0.52, 430), bx0 = W * 0.5 - bw / 2;
          const tot = Math.max(KE + PE, 1e-12);
          ctx.fillStyle = g.alpha('#0B1020', .70);
          ctx.strokeStyle = g.alpha(th.line, 1); ctx.lineWidth = 1;
          ctx.beginPath(); ctx.roundRect(bx0, by0, bw, 52, 7); ctx.fill(); ctx.stroke();
          PA.lbl(ctx, bx0 + 10, by0 + 12, 'ENERGY IN THE OSCILLATOR', th['text-3'], 'left', 8.5);
          const ibx = bx0 + 10, ibw = bw - 20, ibh = 12;
          [[KE, '#3DD6F5'], [PE, '#FFAE4C']].forEach(([v, c], i) => {
            const wpx = ibw * v / tot;
            ctx.fillStyle = g.alpha(c, .85);
            ctx.fillRect(ibx + (i === 0 ? 0 : ibw * KE / tot), by0 + 19, wpx, ibh);
          });
          ctx.strokeStyle = g.alpha(th.line, 1);
          ctx.strokeRect(ibx, by0 + 19, ibw, ibh);
          PA.lbl(ctx, ibx, by0 + 44, 'kinetic', '#3DD6F5', 'left', 8.5);
          PA.lbl(ctx, ibx + ibw, by0 + 44, 'potential', '#FFAE4C', 'right', 8.5);
          PA.lbl(ctx, bx0 + bw / 2, by0 + 44,
                 'driver in ' + Pin.toFixed(2) + ' W   ·   damper out ' + Pdis.toFixed(2) +
                 ' W   ·   ⟨P⟩ = ' + Pavg.toFixed(2) + ' W',
                 S.settled > 0.9 ? th.ok : th['text-3'], 'center', 8.5);
        }

        /* ---------- header ---------- */
        const atRes = Math.abs(p.wDrive - S.wRes) / Math.max(S.w0, 1e-9) < 0.02;
        ctx.textAlign = 'left'; ctx.textBaseline = 'top';
        ctx.font = '700 19px "IBM Plex Sans Condensed",sans-serif';
        ctx.fillStyle = atRes ? th.ok : th.text;
        ctx.fillText(atRes ? 'AT RESONANCE' :
          p.wDrive < S.w0 ? 'DRIVEN BELOW ω₀' : 'DRIVEN ABOVE ω₀', 14, 8);
        ctx.font = '500 10px "IBM Plex Mono",monospace'; ctx.fillStyle = th['text-3'];
        ctx.fillText('ω₀ = √(k/m) = ' + S.w0.toFixed(3) + ' rad/s   ·   ω = ' +
          p.wDrive.toFixed(2) + ' rad/s   ·   ζ = ' + S.zeta.toFixed(3) +
          (S.zeta >= 1 ? '  (over-damped — no oscillation at all)' : '  Q = ' + S.Q.toFixed(1)), 14, 31);
        ctx.fillStyle = S.settled > 0.9 ? th.ok : th.warn;
        ctx.fillText(S.settled > 0.9 ? 'transient has died — this is the steady state'
                                     : 'transient still present — the natural motion has not died yet', 14, 44);
      } else {
        /* ---------- the coupled pair ---------- */
        const wallL = W * 0.10, wallR = W * 0.90;
        const yb = y0 + CH * 0.40;
        const restA = W * 0.36, restB = W * 0.64;
        const pxPerM = Math.min(CH * 0.14 / 0.07, (restB - restA) * 0.42 / 0.07);
        const xa = restA + S.x[0] * pxPerM, xb = restB + S.x[1] * pxPerM;
        const mw = Math.min(W * 0.075, 62), mh = Math.min(CH * 0.16, 54);

        PA.surface(ctx, wallL, yb - mh, wallL, yb + mh, 18, '#3A4766');
        PA.surface(ctx, wallR, yb - mh, wallR, yb + mh, -18, '#3A4766');
        PA.surface(ctx, wallL, yb + mh * 0.62, wallR, yb + mh * 0.62, 18, '#2C3550');

        PA.spring(ctx, wallL, yb, xa - mw / 2, yb, 8, mh * 0.26, '#8FA3C0', { wire: 2.6 });
        PA.spring(ctx, xa + mw / 2, yb, xb - mw / 2, yb, 7, mh * 0.22, '#B07CC6', { wire: 2.6 });
        PA.spring(ctx, xb + mw / 2, yb, wallR, yb, 8, mh * 0.26, '#8FA3C0', { wire: 2.6 });

        PA.plate(ctx, xa, yb, mw, mh, '#4E86BE', 0);
        PA.plate(ctx, xb, yb, mw, mh, '#C4517A', 0);
        PA.lbl(ctx, xa, yb, 'm₁', '#F2F6FF', 'center', 12);
        PA.lbl(ctx, xb, yb, 'm₂', '#F2F6FF', 'center', 12);
        PA.lbl(ctx, (restA + restB) / 2, yb - mh * 0.85,
               'k_c = ' + p.kc.toFixed(1) + ' N/m', '#B07CC6', 'center', 9.5);

        // displacement arrows, which is what makes a mode readable at a glance
        [[restA, xa, ACC], [restB, xb, M2]].forEach(([r0, x, c]) => {
          if (Math.abs(x - r0) > 2) PA.vector(ctx, r0, yb + mh * 0.95, x, yb + mh * 0.95, c,
                                              { width: 2.6, shadow: false });
          ctx.save(); ctx.setLineDash([3, 3]);
          ctx.strokeStyle = g.alpha(th['text-3'], .45); ctx.lineWidth = 1;
          ctx.beginPath(); ctx.moveTo(r0, yb - mh); ctx.lineTo(r0, yb + mh * 1.15); ctx.stroke();
          ctx.restore();
        });

        /* ---- the two normal modes, drawn as the eigenvectors they are ---- */
        const py0 = y0 + CH * 0.70;
        ['in-phase (symmetric)', 'out-of-phase (antisymmetric)'].forEach((nm, i) => {
          const bxp = W * (i === 0 ? 0.20 : 0.60), bw = W * 0.22;
          ctx.fillStyle = g.alpha('#0B1020', .68);
          ctx.strokeStyle = g.alpha(i === 0 ? ACC : M2, .45); ctx.lineWidth = 1;
          ctx.beginPath(); ctx.roundRect(bxp, py0, bw, CH * 0.26, 7); ctx.fill(); ctx.stroke();
          PA.lbl(ctx, bxp + 8, py0 + 12, 'MODE ' + (i + 1) + ' · ' + nm,
                 i === 0 ? ACC : M2, 'left', 9);
          PA.lbl(ctx, bxp + 8, py0 + 25,
                 i === 0 ? 'k_c is never stretched' : 'k_c is stretched by 2×',
                 th['text-3'], 'left', 8.5);
          PA.lbl(ctx, bxp + 8, py0 + 39,
                 'ω = ' + S.wMode[i].toFixed(3) + ' rad/s', th.text, 'left', 10);
          // the eigenvector itself, as two arrows
          const v = S.eig.vec[i];
          const sc = bw * 0.16 / Math.max(Math.abs(v[0]), Math.abs(v[1]), 1e-9);
          const ay = py0 + CH * 0.20;
          [0, 1].forEach(j => {
            const ox = bxp + bw * (j === 0 ? 0.32 : 0.70);
            PA.plate(ctx, ox, ay, 15, 15, j === 0 ? '#4E86BE' : '#C4517A', 0);
            PA.vector(ctx, ox, ay - 15, ox + v[j] * sc, ay - 15, j === 0 ? ACC : M2,
                      { width: 2.4, shadow: false });
          });

        });

        ctx.textAlign = 'left'; ctx.textBaseline = 'top';
        ctx.font = '700 19px "IBM Plex Sans Condensed",sans-serif'; ctx.fillStyle = th.text;
        ctx.fillText(p.start === 'beat' ? 'BEATS — energy passing between the masses'
                   : p.start === 'sym'  ? 'PURE MODE 1 — they move as one'
                                        : 'PURE MODE 2 — they move against each other', 14, 8);
        ctx.font = '500 10px "IBM Plex Mono",monospace'; ctx.fillStyle = th['text-3'];
        ctx.fillText('ω₁ = √(k/m) = ' + S.wMode[0].toFixed(3) + '   ·   ω₂ = √((k+2k_c)/m) = ' +
          S.wMode[1].toFixed(3) + ' rad/s   ·   both are eigenvalues of the stiffness matrix', 14, 31);
        ctx.fillStyle = p.start === 'beat' ? th.accent : th.ok;
        ctx.fillText(p.start === 'beat'
          ? 'beat period 2π/(ω₂−ω₁) = ' + (isFinite(S.tBeat) ? S.tBeat.toFixed(2) + ' s' : '∞')
          : 'a single mode — every part moves at one frequency and stays there', 14, 44);
      }
    },

    /* Pull the mass away from equilibrium and let go. Releasing sets the
       displacement and zeroes the velocity, which is exactly the initial
       condition the textbook problem starts from. */
    onDrag(S, e) {
      if (S.p.mode !== 'driven' || e.id !== 'mass' || !S.pxPerM) return;
      if (e.phase === 'start') S.wasPlaying = true;
      S.y = clamp((e.y - S.restY) / S.pxPerM, -0.6, 0.6);
      S.yd = 0;
      if (e.phase === 'end') S.settled = 0;      // a fresh transient to watch die
    },

    plots: [
      { title: 'The resonance curve — amplitude and phase against driving frequency',
        legend: [{ c: '#3DD6F5', label: 'amplitude A(ω)' }, { c: '#B07CC6', label: 'phase lag φ(ω)' }],
        draw(S, g) {
          const p = S.p;
          if (p.mode === 'coupled') {
            // the two branches of the coupled system instead
            const P = g.Plot({
              xmin: 0, xmax: 30, ymin: 0, ymax: Math.sqrt((p.k + 60) / p.m) * 1.05,
              xlabel: 'coupling k_c (N/m)', ylabel: 'normal-mode ω (rad/s)',
              xfmt: v => v.toFixed(0), yfmt: v => v.toFixed(1)
            }).frame();
            P.clip(() => {
              const s1 = [], s2 = [];
              for (let i = 0; i <= 90; i++) {
                const kc = 30 * i / 90;
                s1.push([kc, Math.sqrt(p.k / p.m)]);
                s2.push([kc, Math.sqrt((p.k + 2 * kc) / p.m)]);
              }
              P.line(s1, '#3DD6F5', 2.2);
              P.line(s2, '#FF6B9D', 2.2);
              P.vline(p.kc, g.alpha(g.theme.text, .8), [4, 3]);
              P.dot(p.kc, S.wMode[0], 4.5, '#3DD6F5', true);
              P.dot(p.kc, S.wMode[1], 4.5, '#FF6B9D', true);
            });
            P.tag(1, Math.sqrt(p.k / p.m), 'mode 1 — independent of k_c', '#3DD6F5', 'left', -9);
            P.tag(16, Math.sqrt((p.k + 32) / p.m), 'mode 2 — stiffened by 2k_c', '#FF6B9D', 'left', -9);
            return;
          }
          const wmax = Math.max(S.w0 * 2.6, p.wDrive * 1.15);
          const peak = Math.max(S.Amax, 1e-6);
          const P = g.Plot({
            xmin: 0, xmax: wmax, ymin: 0, ymax: peak * 1.12,
            xlabel: 'driving frequency ω (rad/s)', ylabel: 'steady-state amplitude (m)',
            xfmt: v => v.toFixed(1), yfmt: v => v.toExponential(1),
            pad: { l: 62, r: 16, t: 14, b: 34 }
          }).frame();
          P.clip(() => {
            // the family of curves at other dampings, so the peak's dependence
            // on b is visible rather than described
            [0.25, 0.5, 2, 4].forEach(f => {
              const gm = S.gamma * f;
              const c = [];
              for (let i = 0; i <= 180; i++) {
                const w = wmax * i / 180;
                c.push([w, (p.F0 / p.m) /
                  Math.sqrt(Math.pow(S.w0 * S.w0 - w * w, 2) + Math.pow(2 * gm * w, 2))]);
              }
              P.line(c, g.alpha(g.theme['text-3'], .35), 1);
            });
            const cur = [];
            for (let i = 0; i <= 260; i++) {
              const w = wmax * i / 260;
              cur.push([w, S.ampAt(w)]);
            }
            P.line(cur, '#3DD6F5', 2.4);
            // the phase, on the same frame, scaled to the box
            const ph = [];
            for (let i = 0; i <= 260; i++) {
              const w = wmax * i / 260;
              const f = Math.atan2(2 * S.gamma * w, S.w0 * S.w0 - w * w);
              ph.push([w, f / Math.PI * peak * 1.12]);
            }
            P.line(ph, '#B07CC6', 1.8, [5, 3]);
            // the half-power band
            if (S.zeta < 0.7) {
              const half = S.Amax / Math.SQRT2;
              P.hline(half, g.alpha(g.theme.warn, .7), [3, 3]);
              const w1 = Math.sqrt(Math.max(S.w0 * S.w0 - 2 * S.gamma * S.w0, 0));
              const w2 = Math.sqrt(S.w0 * S.w0 + 2 * S.gamma * S.w0);
              P.vline(w1, g.alpha(g.theme.warn, .5), [2, 3]);
              P.vline(w2, g.alpha(g.theme.warn, .5), [2, 3]);
            }
            P.vline(S.w0, g.alpha(g.theme['text-3'], .8), [4, 3]);
            P.vline(p.wDrive, g.alpha(g.theme.text, .9));
            P.dot(p.wDrive, S.A, 4.5, '#3DD6F5', true);
          });
          P.tag(S.w0, peak * 1.06, 'ω₀', g.theme['text-3'], 'left', 0);
          P.tag(wmax * 0.98, peak * 1.12 * 0.5, 'φ = 90°', '#B07CC6', 'right', -8);
        },
        hover(S, x) {
          const p = S.p;
          if (p.mode === 'coupled') {
            const kc = clamp(x, 0, 30);
            return [{ label: 'coupling k_c', value: kc.toFixed(2) + ' N/m' },
                    { label: 'mode 1  ω₁', value: Math.sqrt(p.k / p.m).toFixed(3) + ' rad/s', color: '#3DD6F5' },
                    { label: 'mode 2  ω₂', value: Math.sqrt((p.k + 2 * kc) / p.m).toFixed(3) + ' rad/s', color: '#FF6B9D' },
                    { label: 'beat period', value: (TAU / Math.max(1e-9,
                        Math.sqrt((p.k + 2 * kc) / p.m) - Math.sqrt(p.k / p.m))).toFixed(2) + ' s' }];
          }
          const w = Math.max(x, 0);
          const A = S.ampAt(w);
          const f = Math.atan2(2 * S.gamma * w, S.w0 * S.w0 - w * w);
          return [{ label: 'driving ω', value: w.toFixed(3) + ' rad/s' },
                  { label: 'amplitude', value: A.toExponential(3) + ' m', color: '#3DD6F5' },
                  { label: 'phase lag', value: (f * 180 / Math.PI).toFixed(1) + '°', color: '#B07CC6' },
                  { label: 'A / A_max', value: (A / Math.max(S.Amax, 1e-12)).toFixed(3) }];
        } },
      { title: 'The motion itself — transient, steady state and beats',
        legend: [{ c: '#3DD6F5', label: 'displacement' }, { c: '#FFD36B', label: 'driving force' }],
        draw(S, g) {
          const p = S.p;
          const t1 = Math.max(4, S.tp);
          const src = p.mode === 'driven' ? S.hist : S.hist1;
          if (!src.length) return;
          let amp = 0.02;
          src.forEach(q => { amp = Math.max(amp, Math.abs(q[1])); });
          if (p.mode === 'coupled') S.hist2.forEach(q => { amp = Math.max(amp, Math.abs(q[1])); });
          const P = g.Plot({
            xmin: Math.max(0, t1 - 12), xmax: t1, ymin: -amp * 1.15, ymax: amp * 1.15,
            xlabel: 'time (s)', ylabel: 'displacement (m)',
            xfmt: v => v.toFixed(1), yfmt: v => v.toFixed(3),
            pad: { l: 58, r: 16, t: 14, b: 34 }
          }).frame();
          P.clip(() => {
            if (p.mode === 'driven') {
              // the force, scaled onto the same box so the phase relationship shows
              if (p.trace) {
                const fpts = [];
                for (let i = 0; i <= 320; i++) {
                  const t = P.cfg.xmin + (P.cfg.xmax - P.cfg.xmin) * i / 320;
                  fpts.push([t, amp * 0.92 * Math.cos(p.wDrive * t)]);
                }
                P.line(fpts, g.alpha('#FFD36B', .75), 1.4, [4, 3]);
              }
              P.line(S.hist, '#3DD6F5', 2.2);
              // the steady-state envelope the transient is settling onto
              P.hline(S.A, g.alpha(g.theme.ok, .55), [3, 3]);
              P.hline(-S.A, g.alpha(g.theme.ok, .55), [3, 3]);
            } else {
              // the beat envelope, which is the two modes interfering
              if (p.trace && p.start === 'beat' && isFinite(S.tBeat)) {
                const env = [];
                for (let i = 0; i <= 300; i++) {
                  const t = P.cfg.xmin + (P.cfg.xmax - P.cfg.xmin) * i / 300;
                  env.push([t, 0.06 * Math.abs(Math.cos(S.wBeat * t / 2))]);
                }
                P.line(env, g.alpha(g.theme.warn, .55), 1.2, [3, 3]);
                P.line(env.map(q => [q[0], -q[1]]), g.alpha(g.theme.warn, .55), 1.2, [3, 3]);
              }
              P.line(S.hist1, '#3DD6F5', 2.0);
              P.line(S.hist2, '#FF6B9D', 2.0);
            }
            P.hline(0, g.alpha(g.theme['text-3'], .5));
          });
          if (p.mode === 'driven') P.tag(P.cfg.xmin, S.A, 'steady-state A', g.theme.ok, 'left', -8);
        },
        hover(S, x) {
          const p = S.p;
          const at = arr => {
            if (!arr || !arr.length) return 0;
            let best = arr[0];
            for (const q of arr) if (Math.abs(q[0] - x) < Math.abs(best[0] - x)) best = q;
            return best[1];
          };
          if (p.mode === 'driven') {
            return [{ label: 'time', value: x.toFixed(3) + ' s' },
                    { label: 'displacement', value: at(S.hist).toFixed(5) + ' m', color: '#3DD6F5' },
                    { label: 'driving force', value: (p.F0 * Math.cos(p.wDrive * x)).toFixed(3) + ' N',
                      color: '#FFD36B' }];
          }
          return [{ label: 'time', value: x.toFixed(3) + ' s' },
                  { label: 'mass 1', value: at(S.hist1).toFixed(5) + ' m', color: '#3DD6F5' },
                  { label: 'mass 2', value: at(S.hist2).toFixed(5) + ' m', color: '#FF6B9D' }];
        } }
    ],

    readouts(S) {
      const p = S.p;
      if (p.mode === 'coupled') {
        const E1 = 0.5 * p.m * S.v[0] * S.v[0] + 0.5 * p.k * S.x[0] * S.x[0];
        const E2 = 0.5 * p.m * S.v[1] * S.v[1] + 0.5 * p.k * S.x[1] * S.x[1];
        return [
          { label: 'Mode 1  ω₁ = √(k/m)', value: S.wMode[0].toFixed(4), unit: 'rad/s', flag: 'accent',
            hint: 'in phase — the coupling spring never stretches' },
          { label: 'Mode 2  ω₂ = √((k+2k_c)/m)', value: S.wMode[1].toFixed(4), unit: 'rad/s',
            flag: 'accent', hint: 'out of phase — coupling at full stretch' },
          { label: 'Eigenvector 1', value: '(' + S.eig.vec[0].map(v => v.toFixed(3)).join(', ') + ')',
            hint: 'both the same sign' },
          { label: 'Eigenvector 2', value: '(' + S.eig.vec[1].map(v => v.toFixed(3)).join(', ') + ')',
            hint: 'opposite signs' },
          { label: 'Beat angular frequency', value: S.wBeat.toFixed(4), unit: 'rad/s' },
          { label: 'Beat period 2π/Δω', value: isFinite(S.tBeat) ? S.tBeat.toFixed(3) : '∞', unit: 's',
            hint: 'time for the energy to cross and come back' },
          { label: 'Energy in mass 1', value: E1.toExponential(3), unit: 'J' },
          { label: 'Energy in mass 2', value: E2.toExponential(3), unit: 'J',
            flag: E2 > E1 ? 'accent' : '' },
          { label: 'Displacement x₁', value: S.x[0].toFixed(5), unit: 'm' },
          { label: 'Displacement x₂', value: S.x[1].toFixed(5), unit: 'm' }
        ];
      }
      const over = S.zeta >= 1;
      return [
        { label: 'Natural ω₀ = √(k/m)', value: S.w0.toFixed(4), unit: 'rad/s', flag: 'accent' },
        { label: 'Damped ω_d = √(ω₀²−γ²)', value: over ? '—' : S.wd.toFixed(4), unit: 'rad/s',
          hint: over ? 'over-damped: it does not oscillate' : 'slightly below ω₀' },
        { label: 'Amplitude resonance at', value: S.wRes > 0 ? S.wRes.toFixed(4) : '—', unit: 'rad/s',
          flag: 'accent', hint: '√(ω₀²−2γ²) — below ω₀, not at it' },
        { label: 'Damping ratio ζ = b/2√(km)', value: S.zeta.toFixed(4), unit: '',
          flag: over ? 'warn' : 'ok',
          hint: over ? 'over-damped' : S.zeta > 0.99 ? 'critically damped' : 'under-damped' },
        { label: 'Quality factor Q = 1/2ζ', value: isFinite(S.Q) ? S.Q.toFixed(2) : '∞', unit: '',
          hint: 'cycles to ring down · also ω₀/Δω' },
        { label: 'Steady-state amplitude', value: S.A.toExponential(3), unit: 'm' },
        { label: 'Peak amplitude possible', value: S.Amax.toExponential(3), unit: 'm' },
        { label: 'Phase lag φ', value: (S.phase * 180 / Math.PI).toFixed(2), unit: '°',
          flag: Math.abs(S.phase * 180 / Math.PI - 90) < 3 ? 'ok' : '',
          hint: 'exactly 90° at ω = ω₀, whatever the damping' },
        { label: 'Half-power bandwidth', value: (2 * S.gamma).toFixed(4), unit: 'rad/s',
          hint: 'Δω = ω₀/Q' },
        { label: 'Average power absorbed', value:
            (0.5 * p.b * Math.pow(p.wDrive * S.A, 2)).toExponential(3), unit: 'W',
          hint: 'peaks exactly at ω₀, unlike the amplitude' }
      ];
    },

    equation(S) {
      const p = S.p;
      if (p.mode === 'coupled') {
        return E.v('m') + E.v('ẍ') + ' ' + E.op('=') + ' ' + E.op('−') + E.v('K') + E.v('x') +
          ',&nbsp;&nbsp;' + E.v('K') + ' ' + E.op('=') +
          ' [[' + E.v('k') + E.op('+') + E.v('k') + E.sub('c') + ', ' + E.op('−') + E.v('k') + E.sub('c') +
          '], [' + E.op('−') + E.v('k') + E.sub('c') + ', ' + E.v('k') + E.op('+') + E.v('k') + E.sub('c') + ']]' +
          '<br>eigenvalues ⇒ ω' + E.sub('1') + ' ' + E.op('=') + ' ' + E.n(S.wMode[0], 'rad/s') +
          ',&nbsp;&nbsp;ω' + E.sub('2') + ' ' + E.op('=') + ' ' + E.n(S.wMode[1], 'rad/s');
      }
      return E.v('m') + E.v('ẍ') + ' ' + E.op('+') + ' ' + E.v('b') + E.v('ẋ') + ' ' + E.op('+') + ' ' +
        E.v('kx') + ' ' + E.op('=') + ' ' + E.v('F') + E.sub('0') + ' cos(ω' + E.v('t') + ')' +
        '<br>' + E.v('A') + '(ω) ' + E.op('=') + ' ' +
        E.frac(E.v('F') + E.sub('0') + '/' + E.v('m'),
               '√[(ω' + E.sub('0') + '² ' + E.op('−') + ' ω²)² ' + E.op('+') + ' (2γω)²]') +
        ' ' + E.op('=') + ' ' + E.n(S.A, 'm') +
        '&nbsp;&nbsp;&nbsp;tanφ ' + E.op('=') + ' ' +
        E.frac('2γω', 'ω' + E.sub('0') + '² ' + E.op('−') + ' ω²');
    },

    walkthrough: [
      { title: '1 · Watch a transient die',
        body: 'Start well away from resonance and watch the lower graph. The first few seconds look messy, then the motion settles into a clean sine.',
        ask: 'Two different frequencies are present at the start. Where does the second one go?',
        reveal: 'The general solution is <b>transient + steady state</b>. The transient oscillates at the ' +
          '<b>natural</b> frequency ω_d and decays as e<sup>−γt</sup>; the steady state oscillates at the ' +
          '<b>driving</b> frequency ω forever. Only the driven part survives, which is why the final motion ' +
          'has no memory of how it was started.',
        params: { mode: 'driven', wDrive: 2.0, b: 1.6 } },
      { title: '2 · Sweep up to resonance',
        body: 'Drag ω up towards ω₀ = √(k/m) and watch both the amplitude and the phase dial.',
        ask: 'The amplitude peak and the 90° phase point are not at exactly the same frequency. Which is which?',
        reveal: 'The <b>phase</b> passes through exactly 90° at ω = ω₀, always, for any damping. The ' +
          '<b>amplitude</b> peaks slightly lower, at √(ω₀²−2γ²). They coincide only in the limit of zero damping — ' +
          'and the <b>power</b> absorbed peaks at ω₀ exactly. Three "resonances", three different answers.',
        params: { mode: 'driven', wDrive: 6.32, b: 1.6 } },
      { title: '3 · Kill the peak with damping',
        body: 'Push b from 0.2 up through 9 and watch the curve in the top graph flatten.',
        ask: 'At what damping does the peak disappear entirely?',
        reveal: 'When √(ω₀²−2γ²) stops being real — that is, when <b>ζ > 1/√2 ≈ 0.707</b>. Past that there is ' +
          'no resonant peak at all: the amplitude just falls monotonically from its static value F₀/k. ' +
          'Car suspensions are deliberately damped near this value so a bump never excites a resonance.',
        params: { mode: 'driven', b: 9.0, wDrive: 6.32 } },
      { title: '4 · Two masses, one mathematics',
        body: 'Switch the bench to the coupled pair and release them moving together, then opposed.',
        ask: 'Why is the in-phase frequency completely independent of the coupling spring?',
        reveal: 'Because when both masses move together the coupling spring is <b>never stretched</b> — it ' +
          'carries no force, so it cannot affect the frequency: ω₁ = √(k/m). In the opposed mode it is ' +
          'stretched by twice the displacement, adding 2k_c to the effective stiffness: ω₂ = √((k+2k_c)/m). ' +
          'These are exactly the two eigenvalues of the stiffness matrix.',
        params: { mode: 'coupled', start: 'sym', kc: 4 } },
      { title: '5 · Beats are two modes, not one',
        body: 'Release just one mass and weaken the coupling to about 1. Watch the energy cross over and come back.',
        ask: 'Where does the slow beat frequency come from?',
        reveal: 'Displacing one mass excites <b>both</b> normal modes equally. They start in step, drift apart ' +
          'because ω₁ ≠ ω₂, and re-align after a time 2π/(ω₂−ω₁). When they are opposed, mass 1 is still ' +
          'and mass 2 has all the energy. <b>Weaker coupling ⇒ closer frequencies ⇒ slower beats</b> — which is ' +
          'why the beat period grows without limit as k_c → 0.',
        params: { mode: 'coupled', start: 'beat', kc: 1.2 } }
    ],

    problems: [
      { source: 'JEE Main pattern · SHM',
        q: 'A mass of 1.00 kg hangs on a spring of stiffness 40.0 N/m. Find the natural angular frequency ω₀, in rad/s.',
        params: { mode: 'driven', m: 1.0, k: 40, b: 1.6, wDrive: 6.32 },
        predict: { label: 'ω₀', unit: 'rad/s', tol: 0.02 },
        measure: S => S.w0,
        working: 'ω₀ = √(k/m) = √(40/1) = <b>6.32 rad/s</b>, which is f₀ = ω₀/2π ≈ 1.01 Hz. ' +
          'The commonest slip is to report the frequency in hertz when the question asked for the ' +
          'angular frequency, or the reverse — the factor of 2π between them is worth a mark every time.' },
      { source: 'JEE Advanced pattern · resonance',
        q: 'An oscillator of mass 1.00 kg and stiffness 40.0 N/m has damping b = 1.60 N·s/m and is driven by a force of peak value 1.00 N at its resonant frequency. Find the steady-state amplitude, in metres.',
        params: { mode: 'driven', m: 1.0, k: 40, b: 1.6, F0: 1.0, wDrive: 6.32 },
        predict: { label: 'amplitude', unit: 'm', tol: 0.04 },
        measure: S => S.A,
        working: 'At ω = ω₀ the two terms in the denominator collapse to just 2γω₀, so ' +
          'A = F₀/(bω₀) = 1.00/(1.60 × 6.32) = <b>0.0989 m</b>. Note what is <b>absent</b>: the spring ' +
          'constant. At resonance the amplitude is set entirely by the <b>damping</b>, which is why a ' +
          'question giving you F₀, k and b is testing this exact point.' },
      { source: 'JEE Advanced pattern · coupled modes',
        q: 'Two 1.00 kg masses, each tied to a wall by a spring of 40.0 N/m, are joined to each other by a spring of 4.00 N/m. Find the angular frequency of the out-of-phase normal mode, in rad/s.',
        params: { mode: 'coupled', m: 1.0, k: 40, kc: 4.0, start: 'anti' },
        predict: { label: 'ω of mode 2', unit: 'rad/s', tol: 0.02 },
        measure: S => S.wMode[1],
        working: 'Moving oppositely stretches the coupling spring by twice each displacement, so the ' +
          'effective stiffness is k + 2k_c: ω₂ = √((40 + 8)/1) = √48 = <b>6.93 rad/s</b>. ' +
          'The in-phase mode never stretches that spring at all and stays at √(40) = 6.32 rad/s.' }
    ],

    quiz: [
      { q: 'A lightly damped oscillator is driven at its natural frequency ω₀. The phase by which the displacement lags the driving force is:',
        options: ['0°', '45°', '90°', '180°'], answer: 2,
        why: 'tanφ = 2γω/(ω₀²−ω²). At ω = ω₀ the denominator is zero, so φ = 90° exactly — and this holds for every value of the damping, which is why phase is the reliable experimental marker for resonance.' },
      { q: 'For a damped driven oscillator, the amplitude resonance occurs at:',
        options: ['ω = ω₀', 'ω = √(ω₀² − γ²)', 'ω = √(ω₀² − 2γ²)', 'ω = ω₀ + γ'], answer: 2,
        why: 'Maximising A(ω) gives ω_res = √(ω₀²−2γ²), which is below both ω₀ and the damped free frequency ω_d = √(ω₀²−γ²). Note all three are different quantities and the paper does distinguish them.' },
      { q: 'Two identical masses m joined by a spring k_c, each also tied to a wall by a spring k. The frequency of the mode in which they move in phase is:',
        options: ['√(k/m)', '√((k+k_c)/m)', '√((k+2k_c)/m)', '√(k_c/m)'], answer: 0,
        why: 'Moving in phase leaves the coupling spring unstretched, so it exerts no force and cannot change the frequency. Only the out-of-phase mode feels it, at √((k+2k_c)/m).' },
      { q: 'An oscillator has Q = 20. Its half-power bandwidth Δω, relative to ω₀, is:',
        options: ['20 ω₀', 'ω₀/20', 'ω₀/40', '√20 ω₀'], answer: 1,
        why: 'Q = ω₀/Δω by definition, so Δω = ω₀/Q = ω₀/20. A high-Q system is a sharply selective one — the same relation that makes a radio tuner pick one station.' }
    ],

    notes: '<b>Where this shows up in the paper.</b>' +
      '<ul><li>Sharpness of resonance, Q and half-power bandwidth Δω = ω₀/Q.</li>' +
      '<li>Distinguishing ω₀, ω_d = √(ω₀²−γ²) and ω_res = √(ω₀²−2γ²) — the three are routinely confused.</li>' +
      '<li>Phase-lag limits: φ → 0 far below ω₀, exactly 90° at ω₀, → 180° far above.</li>' +
      '<li>Normal modes of two coupled masses, and the beat period 2π/(ω₂−ω₁).</li></ul>' +
      '<div class="pyq"><em>Trap to avoid</em>At resonance the amplitude is <b>not</b> infinite and not F₀/k — ' +
      'it is F₀/(bω₀), set entirely by the <b>damping</b>. A question that gives you F₀, k and b and asks for ' +
      'the resonant amplitude is testing exactly this: the spring constant does not appear in the answer.</div>'
  });

})(window.InsightLab);
