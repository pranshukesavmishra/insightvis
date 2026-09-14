/* ============================================================
   PHYSICS — 11. Electric field, potential and Gauss's law
   ============================================================ */
(function (L) {
  'use strict';
  const { clamp, TAU, fmt, E } = L;
  const PA = window.PHYSART, R3 = window.R3, RX = window.RX;
  const Camera = L.Camera;

  const KE = 8.9875517873681764e9;      // 1/4πε₀
  const EPS0 = 8.8541878128e-12;

  /* Arrangements are given in metres, charges in nanocoulombs. */
  const SETUPS = {
    single:  { name: 'Single point charge',  q: [[0, 0, 1]] },
    dipole:  { name: 'Dipole  (+q, −q)',     q: [[-1, 0, 1], [1, 0, -1]] },
    like:    { name: 'Two like charges',     q: [[-1, 0, 1], [1, 0, 1]] },
    unequal: { name: 'Unequal  (+4q, −q)',   q: [[-1, 0, 4], [1, 0, -1]] },
    quad:    { name: 'Linear quadrupole',    q: [[-1, 0, 1], [0, 0, -2], [1, 0, 1]] },
    square:  { name: 'Four charges on a square', q: [[-1, -1, 1], [1, -1, -1], [1, 1, 1], [-1, 1, -1]] }
  };

  /* A Fibonacci lattice on the unit sphere. Nearly uniform, deterministic,
     and it is what makes the flux integral converge in a few hundred points
     instead of a few hundred thousand. */
  function sphereLattice(n) {
    const pts = [], ga = Math.PI * (3 - Math.sqrt(5));
    for (let i = 0; i < n; i++) {
      const z = 1 - (2 * i + 1) / n;
      const r = Math.sqrt(Math.max(0, 1 - z * z));
      const th = ga * i;
      pts.push([Math.cos(th) * r, Math.sin(th) * r, z]);
    }
    return pts;
  }

  L.register({
    id: 'gauss', subject: 'physics',
    name: "Electric Field, Potential and Gauss's Law",
    chapter: 'Electric Charges & Fields',
    exams: ['JEE Main', 'JEE Advanced', 'NEET UG'],
    weight: 'Very high yield',
    is3D: true,
    stageHint: 'Drag a charge or the sphere · scroll to zoom · the flux is integrated over 600 points on it',
    lede: 'Gauss\'s law is usually met as a formula to be trusted. Here it is <b>measured</b>: the field of ' +
      'every charge is summed at six hundred points spread over a real sphere, <b>E·n̂ is integrated</b> over ' +
      'that surface, and the answer is put next to q<sub>enc</sub>/ε₀. Slide the sphere around and the ' +
      'number does not budge — until a charge crosses the boundary, when it jumps by exactly one quantum ' +
      'of q/ε₀. Deform it, move the charge around inside it, add charges outside it: nothing else matters.',

    params: { setup: 'dipole', qScale: 1, sep: 1.0, gx: 0, gy: 0, gR: 0.6,
              lines: true, equi: true, grid: false, samples: 600 },

    presets: [
      { name: 'Single charge', params: { setup: 'single', gx: 0, gy: 0, gR: 0.8 } },
      { name: 'Dipole', params: { setup: 'dipole', sep: 1.0, gx: -1, gy: 0, gR: 0.55 } },
      { name: 'Sphere around BOTH charges', params: { setup: 'dipole', gx: 0, gy: 0, gR: 1.9 } },
      { name: 'Sphere enclosing nothing', params: { setup: 'dipole', gx: 0, gy: 1.6, gR: 0.5 } },
      { name: 'Two like charges — the null point', params: { setup: 'like', sep: 1.0 } },
      { name: 'Unequal charges (+4q, −q)', params: { setup: 'unequal', sep: 1.0 } },
      { name: 'Linear quadrupole', params: { setup: 'quad', sep: 1.0 } }
    ],

    controls: [
      { group: 'Charge arrangement', items: [
        { key: 'setup', type: 'select', label: 'Configuration', restructure: true,
          options: Object.keys(SETUPS).map(k => ({ value: k, label: SETUPS[k].name })) },
        { key: 'qScale', label: 'Charge magnitude <i>q</i>', min: 0.2, max: 4, step: 0.05, unit: 'nC',
          fmt: v => v.toFixed(2), restructure: true },
        { key: 'sep', label: 'Separation <i>a</i>', min: 0.3, max: 2.0, step: 0.02, unit: 'm',
          fmt: v => v.toFixed(2), restructure: true }
      ] },
      { group: 'Gaussian surface', items: [
        { key: 'gR', label: 'Radius <i>R</i>', min: 0.15, max: 3.0, step: 0.02, unit: 'm',
          fmt: v => v.toFixed(2), restructure: true },
        { key: 'gx', label: 'Centre <i>x</i>', min: -2.5, max: 2.5, step: 0.02, unit: 'm',
          fmt: v => v.toFixed(2), restructure: true },
        { key: 'gy', label: 'Centre <i>y</i>', min: -2.0, max: 2.0, step: 0.02, unit: 'm',
          fmt: v => v.toFixed(2), restructure: true },
        { key: 'samples', label: 'Integration points', min: 60, max: 2000, step: 20, unit: '',
          fmt: v => v.toFixed(0), restructure: true }
      ] },
      { group: 'Display', items: [
        { key: 'lines', type: 'toggle', label: 'Field lines' },
        { key: 'equi', type: 'toggle', label: 'Equipotentials' },
        { key: 'grid', type: 'toggle', label: 'Field-vector grid' }
      ] }
    ],

    setup(S) {
      const p = S.p;
      const cfg = SETUPS[p.setup] || SETUPS.dipole;
      const sameCfg = S.cfg === cfg && S.Q && S.Q.length === cfg.q.length;
      S.cfg = cfg;
      if (!S.cam) {
        S.cam = Camera({ theta: -1.15, phi: 0.28, dist: 8.4, target: [0, 0, 0] });
        S.cam.minDist = 1.6; S.cam.maxDist = 22;
      }
      // Charges in metres / coulombs. Once the student has dragged them the
      // layout is THEIRS, so a restructure keeps the positions and only
      // refreshes the magnitudes — changing the configuration resets them.
      if (sameCfg && S.moved) {
        S.Q.forEach((c, i) => { c.q = cfg.q[i][2] * p.qScale * 1e-9; });
      } else {
        S.moved = false;
        S.Q = cfg.q.map(([x, y, w]) => ({
          x: x * p.sep, y: y * p.sep, q: w * p.qScale * 1e-9
        }));
      }
      S.qTot = S.Q.reduce((a, c) => a + c.q, 0);

      // field and potential at a point, summed over every charge
      S.Efield = (x, y, z) => {
        let ex = 0, ey = 0, ez = 0;
        for (const c of S.Q) {
          const dx = x - c.x, dy = y - c.y, dz = z || 0;
          const r2 = dx * dx + dy * dy + dz * dz;
          if (r2 < 1e-8) continue;
          const r = Math.sqrt(r2), k = KE * c.q / (r2 * r);
          ex += k * dx; ey += k * dy; ez += k * dz;
        }
        return [ex, ey, ez];
      };
      S.Vpot = (x, y, z) => {
        let v = 0;
        for (const c of S.Q) {
          const dx = x - c.x, dy = y - c.y, dz = z || 0;
          const r = Math.sqrt(dx * dx + dy * dy + dz * dz);
          if (r < 1e-4) continue;
          v += KE * c.q / r;
        }
        return v;
      };

      /* ---- the measurement: flux integrated over the sphere ---- */
      const n = Math.max(20, p.samples | 0);
      const lat = sphereLattice(n);
      const R = p.gR, area = 2 * TAU * R * R;      // 4πR²
      let flux = 0;
      for (const [nx, ny, nz] of lat) {
        const px = p.gx + nx * R, py = p.gy + ny * R, pz = nz * R;
        const [ex, ey, ez] = S.Efield(px, py, pz);
        flux += ex * nx + ey * ny + ez * nz;       // E·n̂
      }
      S.fluxNum = flux * area / n;                  // ∮E·dA
      S.lat = lat;
      // the dots drawn on the surface: fixed until something moves, so they
      // are computed here rather than 420 field evaluations per frame
      S.dots = [];
      const nShow = Math.min(n, 300);
      for (let i = 0; i < nShow; i++) {
        const nh = lat[Math.floor(i * n / nShow)];
        const px = p.gx + nh[0] * R, py = p.gy + nh[1] * R, pz = nh[2] * R;
        const [ex, ey, ez] = S.Efield(px, py, pz);
        S.dots.push({ p: [px, py, pz], d: ex * nh[0] + ey * nh[1] + ez * nh[2] });
      }

      // what Gauss says it should be
      S.qEnc = 0; S.nEnc = 0;
      S.Q.forEach(c => {
        const d = Math.hypot(c.x - p.gx, c.y - p.gy);
        if (d < R) { S.qEnc += c.q; S.nEnc++; }
      });
      S.fluxGauss = S.qEnc / EPS0;
      // When q_enc is zero a relative error is undefined, so the residual is
      // measured against the scale one charge would set — otherwise the panel
      // would report a meaningless 0% for a surface containing nothing.
      const scale = Math.max.apply(null, S.Q.map(c => Math.abs(c.q))) / EPS0 || 1;
      S.err = Math.abs(S.fluxNum - S.fluxGauss) / Math.max(Math.abs(S.fluxGauss), scale) * 100;

      /* ---- field lines, traced in 3D by integrating dr/ds = Ê ---- */
      this.retrace(S);

      S.t = 0;
    },

    /* Re-traced whenever the charges move. Seeds are spread over a small
       sphere round each charge by the same Fibonacci lattice the flux uses, so
       the lines leave evenly in three dimensions instead of in one plane. */
    retrace(S) {
      const p = S.p;
      S.lines = [];
      if (!p.lines) return;
      S.Q.forEach((c, ci) => {
        if (c.q === 0) return;
        const sgn = Math.sign(c.q);
        const n = clamp(Math.round(18 * Math.min(Math.abs(c.q) / 1e-9, 3)), 10, 42);
        const seeds = sphereLattice(n);
        seeds.forEach((d, si) => {
          let x = c.x + d[0] * 0.055, y = c.y + d[1] * 0.055, z = d[2] * 0.055;
          const path = [[x, y, z]];
          const hstep = 0.05;
          for (let k = 0; k < 340; k++) {
            const f = (xx, yy, zz) => {
              const [ex, ey, ez] = S.Efield(xx, yy, zz);
              const m = Math.hypot(ex, ey, ez) || 1e-30;
              return [sgn * ex / m, sgn * ey / m, sgn * ez / m];
            };
            const d1 = f(x, y, z);
            const d2 = f(x + d1[0] * hstep / 2, y + d1[1] * hstep / 2, z + d1[2] * hstep / 2);
            x += d2[0] * hstep; y += d2[1] * hstep; z += d2[2] * hstep;
            path.push([x, y, z]);
            if (Math.hypot(x, y, z) > 3.4) break;
            let hit = false;
            for (const o of S.Q) {
              if (Math.hypot(x - o.x, y - o.y, z) < 0.08 && Math.sign(o.q) === -sgn) hit = true;
            }
            if (hit) break;
          }
          if (path.length > 3) S.lines.push({ path: path, q: c.q, seed: (si * 0.37 + ci * 0.11) % 1 });
        });
      });
    },

    step(S, dt) { S.t = (S.t || 0) + dt; },

    drawStage(S, g) {
      const ctx = g.ctx, th = g.theme, p = S.p, W = g.w, H = g.h;
      const cam = S.cam;
      const F = R3.Frame(ctx, cam, { ambient: 0.30, floorZ: null });
      const POS = '#FF8A96', NEG = '#7FAEF5', SURF = '#7CE0A8';

      /* ---------------- the reference frame ----------------
         Three faint axes and a ground grid, because a field in empty space
         has nothing to give the eye a sense of depth. */
      {
        const ext = 3.2;
        R3.plane(F, [-ext, -ext, -1.9], [2 * ext, 0, 0], [0, 2 * ext, 0], '#0C1322',
                 { grid: 16, gridColour: '#33486F', gridAlpha: 0.16, edge: false });
      }

      /* ---------------- equipotentials, contoured on the z = 0 slice ----------------
         In three dimensions an equipotential is a SURFACE, and drawing a nest
         of them hides everything else. So the plane the charges lie in is
         contoured instead, and the contours are laid in 3D at z = 0 — they
         tilt with the camera, which is what shows they belong to a slice. */
      if (p.equi) {
        const NG = 76, ext = 2.6;
        const V = [];
        for (let j = 0; j <= NG; j++) {
          const row = [];
          const yy = -ext + 2 * ext * j / NG;
          for (let i = 0; i <= NG; i++) row.push(S.Vpot(-ext + 2 * ext * i / NG, yy, 0));
          V.push(row);
        }
        const levels = [];
        [1, 2, 4, 8, 16, 32].forEach(m => { levels.push(m * 3, -m * 3); });
        levels.forEach(lev => {
          const segs = [];
          for (let j = 0; j < NG; j++) for (let i = 0; i < NG; i++) {
            const gx0 = -ext + 2 * ext * i / NG, gx1 = -ext + 2 * ext * (i + 1) / NG;
            const gy0 = -ext + 2 * ext * j / NG, gy1 = -ext + 2 * ext * (j + 1) / NG;
            const v00 = V[j][i], v10 = V[j][i + 1], v01 = V[j + 1][i], v11 = V[j + 1][i + 1];
            const seg = [];
            const ed = (va, vb, xa, ya, xb, yb) => {
              if ((va - lev) * (vb - lev) >= 0) return;
              const t = (lev - va) / (vb - va);
              seg.push([xa + (xb - xa) * t, ya + (yb - ya) * t, 0]);
            };
            ed(v00, v10, gx0, gy0, gx1, gy0);
            ed(v10, v11, gx1, gy0, gx1, gy1);
            ed(v11, v01, gx1, gy1, gx0, gy1);
            ed(v01, v00, gx0, gy1, gx0, gy0);
            if (seg.length >= 2) segs.push([seg[0], seg[1]]);
          }
          segs.forEach(sg => R3.polyline(F, sg, lev > 0 ? POS : NEG,
                                         { alpha: 0.30, width: 1.2 }));
        });
      }

      /* ---------------- a lattice of field vectors in 3D ---------------- */
      if (p.grid) {
        const n = 5, ext = 1.9;
        for (let i = 0; i < n; i++) for (let j = 0; j < n; j++) for (let k = 0; k < n; k++) {
          const x = -ext + 2 * ext * (i + 0.5) / n;
          const y = -ext + 2 * ext * (j + 0.5) / n;
          const z = -ext + 2 * ext * (k + 0.5) / n;
          let tooClose = false;
          S.Q.forEach(c => { if (Math.hypot(x - c.x, y - c.y, z) < 0.30) tooClose = true; });
          if (tooClose) continue;
          const [ex, ey, ez] = S.Efield(x, y, z);
          const m = Math.hypot(ex, ey, ez);
          if (m < 1e-2) continue;
          const len = clamp(Math.log10(1 + m) * 0.055, 0.07, 0.30);
          R3.arrow(F, [x, y, z],
                   [x + ex / m * len, y + ey / m * len, z + ez / m * len],
                   0.012, '#3DD6F5', { head: 0.055, shadow: false, ambient: 0.55 });
        }
      }

      /* ---------------- field lines, traced in three dimensions ---------------- */
      if (p.lines) {
        S.lines.forEach(ln => {
          const pos = ln.q > 0;
          R3.polyline(F, ln.path, pos ? POS : NEG, { alpha: 0.55, width: 1.3 });
          // one arrowhead per line, drifting outward so direction animates
          const u = (S.t * 0.14 + ln.seed) % 1;
          const k = Math.floor(u * (ln.path.length - 2));
          const a = ln.path[k], b = ln.path[k + 1];
          if (a && b) {
            const qa = cam.project(a), qb = cam.project(b);
            if (qa.ok && qb.ok) {
              F.push(a, () => {
                const ang = Math.atan2(qb.y - qa.y, qb.x - qa.x);
                ctx.save();
                ctx.translate(qa.x, qa.y); ctx.rotate(ang);
                ctx.fillStyle = g.alpha(pos ? POS : NEG, .95);
                ctx.beginPath();
                ctx.moveTo(5, 0); ctx.lineTo(-3.2, 3.2); ctx.lineTo(-3.2, -3.2);
                ctx.closePath(); ctx.fill();
                ctx.restore();
              });
            }
          }
        });
      }

      /* ---------------- the Gaussian surface, as a real sphere ---------------- */
      {
        const c = [p.gx, p.gy, 0];
        R3.wireSphere(F, c, p.gR, SURF, { lat: 5, lon: 8, alpha: 0.22, limbAlpha: 0.85 });
        // the sample points the flux was actually integrated over, each one
        // coloured by the sign of E·n̂ there — red leaving, blue entering
        S.dots.forEach(dot => {
          const q = cam.project(dot.p);
          if (!q.ok) return;
          const col = dot.d >= 0 ? POS : NEG;
          F.push(dot.p, () => {
            ctx.fillStyle = g.alpha(col, clamp(Math.abs(dot.d) / 40, .16, .92));
            ctx.beginPath(); ctx.arc(q.x, q.y, 2.0, 0, TAU); ctx.fill();
          });
        });
        // a few outward normals, so "E·n̂" is a picture and not a symbol
        for (let i = 0; i < 10; i++) {
          const nHat = S.lat[Math.floor(i * S.lat.length / 10)];
          const base = [c[0] + nHat[0] * p.gR, c[1] + nHat[1] * p.gR, c[2] + nHat[2] * p.gR];
          const tip = [c[0] + nHat[0] * p.gR * 1.16, c[1] + nHat[1] * p.gR * 1.16,
                       c[2] + nHat[2] * p.gR * 1.16];
          R3.arrow(F, base, tip, p.gR * 0.016, SURF, { head: p.gR * 0.09, shadow: false });
        }
        g.handle(cam.project(c).x, cam.project(c).y, 16, 'sphere');
        R3.callout(F, [c[0], c[1], c[2] + p.gR], 0, -26,
                   'Gaussian sphere  R = ' + p.gR.toFixed(2) + ' m', SURF);
      }

      /* ---------------- the charges ---------------- */
      S.Q.forEach((c, i) => {
        const r = clamp(Math.abs(c.q) / 1e-9 * 0.020 + 0.055, 0.05, 0.14);
        const pos = c.q >= 0;
        // the glow first, behind the bead
        const q = cam.project([c.x, c.y, 0]);
        if (q.ok) {
          F.push([c.x, c.y, 0], () => {
            ctx.save(); ctx.globalCompositeOperation = 'lighter';
            const rr = r * q.s * 3.6;
            const gg = ctx.createRadialGradient(q.x, q.y, 0, q.x, q.y, rr);
            gg.addColorStop(0, g.alpha(pos ? POS : NEG, .30));
            gg.addColorStop(1, g.alpha(pos ? POS : NEG, 0));
            ctx.fillStyle = gg;
            ctx.beginPath(); ctx.arc(q.x, q.y, rr, 0, TAU); ctx.fill();
            ctx.restore();
          }, 1e5);
          g.handle(q.x, q.y, Math.max(12, r * q.s + 6), 'q' + i);
        }
        R3.sphere(F, [c.x, c.y, 0], r, pos ? POS : NEG, { shadow: false, rim: 0.85, sub: 0.5 });
        // the sign, cut into the bead
        F.push([c.x, c.y, 0], () => {
          if (!q.ok) return;
          const rp = r * q.s;
          ctx.strokeStyle = 'rgba(255,255,255,.95)';
          ctx.lineWidth = Math.max(1.6, rp * 0.24); ctx.lineCap = 'round';
          ctx.beginPath();
          ctx.moveTo(q.x - rp * 0.44, q.y); ctx.lineTo(q.x + rp * 0.44, q.y);
          if (pos) { ctx.moveTo(q.x, q.y - rp * 0.44); ctx.lineTo(q.x, q.y + rp * 0.44); }
          ctx.stroke();
        }, -r * 1.02);
        R3.callout(F, [c.x, c.y, 0], (c.x < 0 ? -1 : 1) * 30, 24,
                   (c.q * 1e9 >= 0 ? '+' : '') + (c.q * 1e9).toFixed(2) + ' nC',
                   pos ? POS : NEG);
      });

      F.render();

      /* ---------------- 2D instrument overlays ---------------- */
      {
        const bw = Math.min(W * 0.28, 246), bh = 92;
        const bx0 = W - bw - 12, by0 = H - bh - 30;
        ctx.fillStyle = g.alpha('#0B1020', .88);
        ctx.strokeStyle = g.alpha(SURF, .45); ctx.lineWidth = 1;
        ctx.beginPath(); ctx.roundRect(bx0, by0, bw, bh, 8); ctx.fill(); ctx.stroke();
        PA.lbl(ctx, bx0 + 10, by0 + 13, 'FLUX, MEASURED', SURF, 'left', 9);
        PA.lbl(ctx, bx0 + 10, by0 + 31, '∮E·dA = ' + fmt(S.fluxNum, 4) + ' N·m²/C',
               th.text, 'left', 10.5);
        PA.lbl(ctx, bx0 + 10, by0 + 48, 'q_enc/ε₀ = ' + fmt(S.fluxGauss, 4) + ' N·m²/C',
               SURF, 'left', 10.5);
        PA.lbl(ctx, bx0 + 10, by0 + 65,
               S.err < 2 ? 'agreement to ' + S.err.toFixed(2) + '% on ' + p.samples + ' points'
                         : 'sampling error ' + S.err.toFixed(1) + '% — add points',
               S.err < 2 ? th.ok : th.warn, 'left', 9);
        PA.lbl(ctx, bx0 + 10, by0 + 79,
               S.nEnc + ' of ' + S.Q.length + ' charges are inside the surface',
               th['text-3'], 'left', 8.5);
      }

      ctx.textAlign = 'left'; ctx.textBaseline = 'top';
      ctx.font = '700 19px "IBM Plex Sans Condensed",sans-serif'; ctx.fillStyle = th.text;
      ctx.fillText(S.cfg.name, 14, 8);
      ctx.font = '500 10px "IBM Plex Mono",monospace'; ctx.fillStyle = th['text-3'];
      ctx.fillText('total charge ' + (S.qTot * 1e9).toFixed(2) + ' nC   ·   enclosed ' +
        (S.qEnc * 1e9).toFixed(2) + ' nC   ·   drag a charge or the sphere', 14, 31);
      ctx.fillStyle = S.err < 2 ? th.ok : th.warn;
      ctx.fillText(S.err < 2
        ? 'the integral agrees with q_enc/ε₀ — and nothing outside the surface contributes'
        : 'too few integration points for this geometry', 14, 45);
    },

    /* the student positions the apparatus by hand: the charges and the
       Gaussian surface are both things you take hold of and move */
    onDrag(S, e) {
      const cam = S.cam;
      if (!cam) return;
      // move in the z = 0 plane, by projecting the cursor ray onto it
      const ray = (px, py) => {
        const k = cam._k, w = cam._w, h = cam._h;
        const cx = (px - w / 2) / k, cy = -(py - h / 2) / k;
        const d = [cam.f[0] + cam.r[0] * cx + cam.u[0] * cy,
                   cam.f[1] + cam.r[1] * cx + cam.u[1] * cy,
                   cam.f[2] + cam.r[2] * cx + cam.u[2] * cy];
        if (Math.abs(d[2]) < 1e-6) return null;
        const t = -cam.eye[2] / d[2];
        if (t < 0) return null;
        return [cam.eye[0] + d[0] * t, cam.eye[1] + d[1] * t];
      };
      const w = ray(e.x, e.y);
      if (!w) return;
      if (e.id === 'sphere') {
        S.p.gx = clamp(w[0], -2.5, 2.5);
        S.p.gy = clamp(w[1], -2.0, 2.0);
        this.setup(S);
      } else if (e.id.charAt(0) === 'q') {
        const i = +e.id.slice(1);
        if (S.Q[i]) {
          S.Q[i].x = clamp(w[0], -3, 3);
          S.Q[i].y = clamp(w[1], -2.4, 2.4);
          S.moved = true;
          if (e.phase === 'end') this.retrace(S);
        }
      }
    },
    plots: [
      { title: 'Along the axis — where E vanishes is NOT where V vanishes',
        legend: [{ c: '#3DD6F5', label: 'E_x (N/C)' }, { c: '#FFAE4C', label: 'V (V)' }],
        draw(S, g) {
          const p = S.p;
          const xr = Math.max(3, p.sep * 3);
          const pts = [], vts = [];
          let emax = 1e-9, vmax = 1e-9;
          for (let i = 0; i <= 400; i++) {
            const x = -xr + 2 * xr * i / 400;
            let near = false;
            S.Q.forEach(c => { if (Math.abs(x - c.x) < 0.06 && Math.abs(c.y) < 1e-6) near = true; });
            if (near) { pts.push(null); vts.push(null); continue; }
            const [ex] = S.Efield(x, 0, 0);
            const v = S.Vpot(x, 0, 0);
            pts.push([x, ex]); vts.push([x, v]);
            emax = Math.max(emax, Math.abs(ex)); vmax = Math.max(vmax, Math.abs(v));
          }
          emax = Math.min(emax, 4000); vmax = Math.min(vmax, 3000);
          const P = g.Plot({
            xmin: -xr, xmax: xr, ymin: -1.05, ymax: 1.05,
            xlabel: 'position along the axis (m)', ylabel: 'normalised',
            xfmt: v => v.toFixed(1), yfmt: v => v.toFixed(1),
            pad: { l: 50, r: 16, t: 14, b: 34 }
          }).frame();
          P.clip(() => {
            const seg = (arr, sc, col, w) => {
              let run = [];
              arr.forEach(q => {
                if (!q) { if (run.length > 1) P.line(run, col, w); run = []; return; }
                run.push([q[0], clamp(q[1] / sc, -1.05, 1.05)]);
              });
              if (run.length > 1) P.line(run, col, w);
            };
            seg(pts, emax, '#3DD6F5', 2.2);
            seg(vts, vmax, '#FFAE4C', 2.2);
            P.hline(0, g.alpha(g.theme['text-3'], .8));
            S.Q.forEach(c => { if (Math.abs(c.y) < 1e-6) P.vline(c.x,
              g.alpha(c.q > 0 ? '#FF8A96' : '#7FAEF5', .7), [3, 3]); });
            // mark every zero of E on the axis, which is the examinable point
            for (let i = 1; i < pts.length; i++) {
              const a = pts[i - 1], b = pts[i];
              if (!a || !b) continue;
              if (a[1] * b[1] < 0 && Math.abs(a[1]) < emax * 0.5) {
                const t = -a[1] / (b[1] - a[1]);
                P.dot(a[0] + (b[0] - a[0]) * t, 0, 4.5, '#3DD6F5', true);
              }
            }
            for (let i = 1; i < vts.length; i++) {
              const a = vts[i - 1], b = vts[i];
              if (!a || !b) continue;
              if (a[1] * b[1] < 0 && Math.abs(a[1]) < vmax * 0.5) {
                const t = -a[1] / (b[1] - a[1]);
                P.dot(a[0] + (b[0] - a[0]) * t, 0, 4.5, '#FFAE4C', true);
              }
            }
          });
          P.tag(-xr * 0.96, 0.92, 'E = 0  (blue dot)', '#3DD6F5', 'left', 0);
          P.tag(-xr * 0.96, 0.78, 'V = 0  (orange dot)', '#FFAE4C', 'left', 0);
        },
        hover(S, x) {
          const [ex, ey] = S.Efield(x, 0, 0);
          return [{ label: 'x', value: x.toFixed(3) + ' m' },
                  { label: 'E_x', value: fmt(ex, 4) + ' N/C', color: '#3DD6F5' },
                  { label: '|E|', value: fmt(Math.hypot(ex, ey), 4) + ' N/C' },
                  { label: 'V', value: fmt(S.Vpot(x, 0, 0), 4) + ' V', color: '#FFAE4C' }];
        } },
      { title: 'Flux against the radius of the sphere — a staircase, not a curve',
        legend: [{ c: '#7CE0A8', label: 'measured ∮E·dA' }, { c: '#63729A', label: 'q_enc/ε₀' }],
        draw(S, g) {
          const p = S.p;
          const rmax = 3.0;
          const meas = S.curveMeas, pred = S.curvePred, mx = S.curveMax;
          const P = g.Plot({
            xmin: 0, xmax: rmax, ymin: -mx * 1.15, ymax: mx * 1.15,
            xlabel: 'Gaussian radius R (m)', ylabel: 'flux (N·m²/C)',
            xfmt: v => v.toFixed(1), yfmt: v => fmt(v, 2),
            pad: { l: 64, r: 16, t: 14, b: 34 }
          }).frame();
          P.clip(() => {
            P.line(pred, g.alpha('#63729A', .95), 3);
            P.line(meas, '#7CE0A8', 1.8);
            P.hline(0, g.alpha(g.theme['text-3'], .6));
            P.vline(p.gR, g.alpha(g.theme.text, .85));
            P.dot(p.gR, S.fluxNum, 4.5, '#7CE0A8', true);
            S.Q.forEach(c => {
              const d = Math.hypot(c.x - p.gx, c.y - p.gy);
              if (d < rmax) P.vline(d, g.alpha(c.q > 0 ? '#FF8A96' : '#7FAEF5', .45), [2, 3]);
            });
          });
          P.tag(rmax * 0.98, mx * 1.02,
                'each step is one charge crossing the surface', g.theme['text-3'], 'right', 0);
        },
        hover(S, x) {
          const p = S.p;
          let qe = 0, n = 0;
          S.Q.forEach(c => { if (Math.hypot(c.x - p.gx, c.y - p.gy) < x) { qe += c.q; n++; } });
          return [{ label: 'radius R', value: x.toFixed(3) + ' m' },
                  { label: 'charges enclosed', value: String(n) },
                  { label: 'q_enc', value: (qe * 1e9).toFixed(3) + ' nC' },
                  { label: 'flux q_enc/ε₀', value: fmt(qe / EPS0, 4) + ' N·m²/C', color: '#7CE0A8' }];
        } }
    ],

    readouts(S) {
      const p = S.p;
      const area = 2 * TAU * p.gR * p.gR;
      return [
        { label: 'Measured flux ∮E·dA', value: fmt(S.fluxNum, 4), unit: 'N·m²/C', flag: 'accent' },
        { label: "Gauss's law q_enc/ε₀", value: fmt(S.fluxGauss, 4), unit: 'N·m²/C', flag: 'accent' },
        { label: 'Agreement', value: S.err.toFixed(3), unit: '%',
          flag: S.err < 2 ? 'ok' : 'warn',
          hint: S.err < 2 ? 'the integral reproduces the law' : 'increase the sample count' },
        { label: 'Charge enclosed', value: (S.qEnc * 1e9).toFixed(3), unit: 'nC',
          hint: S.nEnc + ' of ' + S.Q.length + ' charges' },
        { label: 'Charge outside', value: ((S.qTot - S.qEnc) * 1e9).toFixed(3), unit: 'nC',
          hint: 'contributes to E everywhere, to the flux not at all' },
        { label: 'Surface area 4πR²', value: area.toFixed(4), unit: 'm²' },
        { label: 'Integration points', value: String(p.samples), unit: '',
          hint: 'each one evaluates E from every charge' },
        { label: 'Mean |E| on the surface', value:
            fmt(Math.abs(S.fluxNum) / Math.max(area, 1e-12), 3), unit: 'N/C',
          hint: 'only equals E when the field is uniform over the surface' },
        { label: 'Dipole moment p = qa', value: S.Q.length === 2 && Math.abs(S.qTot) < 1e-18
            ? fmt(Math.abs(S.Q[0].q) * Math.hypot(S.Q[1].x - S.Q[0].x, S.Q[1].y - S.Q[0].y), 3)
            : '—', unit: 'C·m',
          hint: 'defined only when the total charge is zero' }
      ];
    },

    equation(S) {
      return '∮ ' + E.v('E') + '·d' + E.v('A') + ' ' + E.op('=') + ' ' +
        E.frac(E.v('q') + E.sub('enc'), 'ε' + E.sub('0')) +
        '&nbsp;&nbsp;⇒&nbsp;&nbsp;' + E.n(S.fluxGauss, 'N·m²/C') +
        '<br>measured by summing ' + E.v('E') + '·n̂ over ' + S.p.samples +
        ' points on the sphere: ' + E.n(S.fluxNum, 'N·m²/C') +
        '&nbsp;&nbsp;(' + E.n(S.err, '%') + ' apart)';
    },

    walkthrough: [
      { title: '1 · Move the surface, not the charge',
        body: 'Put the sphere round one charge of the dipole, then slide its centre about while keeping that charge inside.',
        ask: 'The field at every point of the surface is changing. Why does the flux not change at all?',
        reveal: 'Because flux counts <b>how many field lines cross the surface</b>, and every line that starts ' +
          'on the enclosed charge must get out exactly once. Moving the surface redistributes where they cross, ' +
          'but not how many. The measured integral in the panel stays pinned to q/ε₀ throughout.',
        params: { setup: 'dipole', gx: -1, gy: 0, gR: 0.55 } },
      { title: '2 · Swallow the second charge',
        body: 'Now grow R until the sphere contains both charges of the dipole.',
        ask: 'What happens to the flux, and what happens to the field on the surface?',
        reveal: 'The flux drops to <b>exactly zero</b> — the enclosed charge is +q−q = 0. But look at the ' +
          'sample dots: the field on the surface is emphatically <b>not</b> zero, it is red on one side and ' +
          'blue on the other. <b>Zero flux does not mean zero field.</b> Every line that leaves also returns.',
        params: { setup: 'dipole', gx: 0, gy: 0, gR: 1.9 } },
      { title: '3 · A surface with nothing in it',
        body: 'Lift the sphere off the axis so it encloses no charge at all.',
        ask: 'The charges are close by and the field through the surface is strong. Is the flux strong too?',
        reveal: 'Zero, to the precision of the integration. An external charge sends lines <b>in one side and ' +
          'out the other</b>, and the two contributions cancel identically. This is the single most useful ' +
          'fact in the chapter and the one most often doubted.',
        params: { setup: 'dipole', gx: 0, gy: 1.6, gR: 0.5 } },
      { title: '4 · The null point that is not a zero of potential',
        body: 'Switch to two like charges and read the lower-left graph carefully.',
        ask: 'Between two equal positive charges, E = 0 at the midpoint. What is V there?',
        reveal: 'V is at a <b>local minimum but is far from zero</b> — both charges contribute positive ' +
          'potential and potentials simply add as numbers. For a <b>dipole</b> the opposite happens: V = 0 on ' +
          'the perpendicular bisector while E there is at its strongest. <b>E = 0 and V = 0 are different ' +
          'conditions</b>, and questions are written specifically to catch students who merge them.',
        params: { setup: 'like', sep: 1.0 } },
      { title: '5 · Watch the integral converge',
        body: 'Drop the sample count to 60 and then raise it back to 2000, watching the agreement figure.',
        ask: 'Why does this need so few points to work?',
        reveal: 'The Fibonacci lattice spreads points almost perfectly evenly over the sphere, so the ' +
          'Monte-Carlo error falls quickly. With a few hundred points the numerical integral matches ' +
          'q<sub>enc</sub>/ε₀ to a fraction of a percent — which is as close to <b>experimental proof</b> of ' +
          "Gauss's law as arithmetic can get.",
        params: { setup: 'quad', samples: 2000 } }
    ],

    problems: [
      { source: 'NEET pattern · Gauss',
        q: 'A point charge of +1.00 nC sits at the centre of a spherical Gaussian surface of radius 0.80 m. Find the electric flux through the surface, in N·m²/C.',
        params: { setup: 'single', qScale: 1, gx: 0, gy: 0, gR: 0.8, samples: 900 },
        predict: { label: 'flux', unit: 'N·m²/C', tol: 0.03 },
        measure: S => S.fluxGauss,
        working: 'Φ = q/ε₀ = 1.00×10⁻⁹ / 8.854×10⁻¹² = <b>113 N·m²/C</b>. The radius is a red herring: ' +
          'it does not appear in the answer, and neither would the shape if the surface were a cube. ' +
          'Compare it with the measured integral in the panel — they agree to a fraction of a percent.' },
      { source: 'JEE Main pattern · dipole flux',
        q: 'A Gaussian sphere encloses BOTH charges of an electric dipole (+1 nC and −1 nC). Find the net flux through it, in N·m²/C.',
        params: { setup: 'dipole', sep: 1.0, gx: 0, gy: 0, gR: 1.9, samples: 900 },
        predict: { label: 'net flux', unit: 'N·m²/C', tol: 0.05 },
        measure: S => S.fluxGauss,
        working: 'q_enc = +q − q = 0, so the flux is <b>exactly zero</b>. Look at the sample dots on ' +
          'the sphere while you read that: the field is emphatically not zero, it is outward on one ' +
          'side and inward on the other. <b>Zero flux does not mean zero field</b> — every line that ' +
          'leaves also returns.' }
    ],

    quiz: [
      { q: 'A point charge q is placed at the centre of a cube of side a. The electric flux through one face is:',
        options: ['q/ε₀', 'q/6ε₀', 'q/4ε₀', 'qa²/ε₀'], answer: 1,
        why: 'Total flux is q/ε₀ regardless of the shape of the surface, and the six faces are equivalent by symmetry, so each carries one sixth. Note the side length never enters.' },
      { q: 'A charge q lies OUTSIDE a closed surface. The flux through that surface is:',
        options: ['q/ε₀', 'zero', 'depends on the distance', 'depends on the shape of the surface'], answer: 1,
        why: 'Every field line from an external charge that enters the surface must also leave it, so the inward and outward contributions cancel exactly. The field on the surface is not zero — only the net flux is.' },
      { q: 'The net flux through a Gaussian surface enclosing an electric dipole is zero. It follows that:',
        options: ['E = 0 everywhere on the surface', 'E = 0 at the centre',
                  'the enclosed charge is zero, but E need not be',
                  'the surface must be spherical'], answer: 2,
        why: "Gauss's law constrains only the integral of E over the surface, never E point by point. A dipole gives zero enclosed charge and therefore zero net flux, while the field on the surface is strong and varies from point to point." },
      { q: 'Two equal positive charges are separated by 2a. At the midpoint of the line joining them:',
        options: ['E = 0 and V = 0', 'E = 0 and V ≠ 0', 'E ≠ 0 and V = 0', 'both E and V are maximum'], answer: 1,
        why: 'The two field vectors are equal and opposite so E cancels, but potentials are scalars that simply add: V = 2kq/a, the largest value anywhere on the segment between them. This is the classic E-versus-V distinction.' }
    ],

    notes: '<b>Where this shows up in the paper.</b>' +
      '<ul><li>Flux through one face of a cube, or through a surface with the charge at a corner (q/8ε₀).</li>' +
      '<li>Locating the null point of two unlike charges — always on the far side of the smaller charge.</li>' +
      '<li>Field of a shell, a long wire and a plane sheet, all derived by choosing the Gaussian surface ' +
      'that matches the symmetry.</li>' +
      '<li>Dipole field on the axis (2kp/r³) and on the equator (kp/r³), and the factor of 2 between them.</li></ul>' +
      '<div class="pyq"><em>Trap to avoid</em>The step ∮E·dA = E × 4πR² is only legal when <b>E has the same ' +
      'magnitude everywhere on the surface and is everywhere normal to it</b>. That is a statement about ' +
      '<b>symmetry</b>, not about Gauss\'s law, and it fails the moment the charge is off-centre. ' +
      "Gauss's law itself always holds; the shortcut for extracting E from it does not.</div>"
  });

  /* =========================================================================
     12 · SERIES LCR — phasors, resonance and the power factor

     The circuit is INTEGRATED, not evaluated: L q̈ + R q̇ + q/C = V₀sin(ωt)
     is stepped with RK4, so switching on produces a real transient that
     decays at the circuit's own damped frequency before the steady state
     takes over. The phasor diagram alongside is the analytic solution the
     transient is converging to — and you can watch them meet.
     ========================================================================= */
  L.register({
    id: 'lcr', subject: 'physics',
    name: 'Series LCR — Phasors, Resonance and Power Factor',
    chapter: 'Alternating Current',
    exams: ['JEE Main', 'JEE Advanced', 'NEET UG'],
    weight: 'Very high yield',
    is3D: false,
    stageHint: 'The rotating phasors generate the waveform on the right — watch V_L and V_C cancel at resonance',
    lede: 'At resonance a series LCR circuit does something that looks impossible: the voltage measured across ' +
      'the inductor alone, and across the capacitor alone, can each be <b>many times larger than the supply ' +
      'voltage</b> — yet they sum to zero. This lab integrates the real circuit equation, so you see the ' +
      'switch-on transient die away into the steady state, and it draws the phasors that explain the result: ' +
      'V<sub>L</sub> and V<sub>C</sub> are <b>180° apart</b>, so they subtract as numbers while each stays ' +
      'large on its own.',

    params: { R: 40, Lh: 0.20, Cuf: 20, V0: 20, f: 80, showTransient: true, phasors: true },

    presets: [
      { name: 'At resonance', params: { R: 40, Lh: 0.20, Cuf: 20, f: 79.577 } },
      { name: 'Below resonance — capacitive', params: { f: 40 } },
      { name: 'Above resonance — inductive', params: { f: 160 } },
      { name: 'Low R — a sharp, high-Q circuit', params: { R: 8, f: 79.577 } },
      { name: 'High R — broad and lossy', params: { R: 200, f: 79.577 } },
      { name: 'Voltage magnification', params: { R: 5, Lh: 0.20, Cuf: 20, V0: 20, f: 79.577 } }
    ],

    controls: [
      { group: 'Components', items: [
        { key: 'R', label: 'Resistance <i>R</i>', min: 2, max: 400, step: 1, unit: 'Ω',
          fmt: v => v.toFixed(0), restructure: true },
        { key: 'Lh', label: 'Inductance <i>L</i>', min: 0.01, max: 1.0, step: 0.005, unit: 'H',
          fmt: v => v.toFixed(3), restructure: true },
        { key: 'Cuf', label: 'Capacitance <i>C</i>', min: 1, max: 200, step: 0.5, unit: 'µF',
          fmt: v => v.toFixed(1), restructure: true }
      ] },
      { group: 'Supply', items: [
        { key: 'V0', label: 'Peak voltage <i>V</i><sub>0</sub>', min: 2, max: 60, step: 0.5, unit: 'V',
          fmt: v => v.toFixed(1), restructure: true },
        { key: 'f', label: 'Frequency <i>f</i>', min: 5, max: 400, step: 0.5, unit: 'Hz',
          fmt: v => v.toFixed(1), restructure: true }
      ] },
      { group: 'Display', items: [
        { key: 'phasors', type: 'toggle', label: 'Phasor diagram' },
        { key: 'showTransient', type: 'toggle', label: 'Show the switch-on transient', restructure: true }
      ] }
    ],

    setup(S) {
      const p = S.p;
      S.L = p.Lh; S.C = p.Cuf * 1e-6; S.Rr = p.R;
      S.w = TAU * p.f;
      S.w0 = 1 / Math.sqrt(S.L * S.C);
      S.f0 = S.w0 / TAU;
      S.XL = S.w * S.L;
      S.XC = S.w > 1e-9 ? 1 / (S.w * S.C) : Infinity;
      S.Z = Math.sqrt(S.Rr * S.Rr + Math.pow(S.XL - S.XC, 2));
      S.I0 = p.V0 / S.Z;
      S.phi = Math.atan2(S.XL - S.XC, S.Rr);       // current LAGS voltage by phi
      S.pf = Math.cos(S.phi);
      S.Q = S.Rr > 1e-9 ? (1 / S.Rr) * Math.sqrt(S.L / S.C) : Infinity;
      S.band = S.Rr / S.L;                          // Δω = R/L
      S.I0res = p.V0 / S.Rr;
      S.VR = S.I0 * S.Rr; S.VL = S.I0 * S.XL; S.VC = S.I0 * S.XC;
      S.Pavg = 0.5 * p.V0 * S.I0 * S.pf;            // ½V₀I₀cosφ = V_rms I_rms cosφ
      S.Pwatt = 0.5 * p.V0 * S.I0 * Math.abs(Math.sin(S.phi));   // the wattless part

      // state for the integration: charge on the capacitor and the current.
      // With the transient switched off we start ON the steady-state solution
      //   i = I₀sin(ωt−φ),  q = −(I₀/ω)cos(ωt−φ)
      // so there is no homogeneous part to decay and the phasor answer is
      // correct from the first frame.
      if (S.p.showTransient) {
        S.q = 0; S.i = 0; S.settle = 0;
      } else {
        S.i = -S.I0 * Math.sin(S.phi);
        S.q = -(S.I0 / Math.max(S.w, 1e-9)) * Math.cos(S.phi);
        S.settle = 1;
      }
      S.tp = 0;
      S.trI = []; S.trV = [];
    },

    step(S, dt) {
      const p = S.p;
      S.t = (S.t || 0) + dt;
      // run in circuit time, slowed so a cycle is watchable at any frequency
      const cycles = 2.2;                               // cycles per wall-clock second
      const want = dt * cycles / Math.max(p.f, 1e-6);
      const n = 220, h = want / n;
      for (let k = 0; k < n; k++) {
        // L q'' + R q' + q/C = V0 sin(wt), integrated as a 2-vector with RK4
        const acc = (q, i, t) => (p.V0 * Math.sin(S.w * t) - S.Rr * i - q / S.C) / S.L;
        const t0 = S.tp;
        const a1 = acc(S.q, S.i, t0),                              b1 = S.i;
        const a2 = acc(S.q + b1 * h / 2, S.i + a1 * h / 2, t0 + h / 2), b2 = S.i + a1 * h / 2;
        const a3 = acc(S.q + b2 * h / 2, S.i + a2 * h / 2, t0 + h / 2), b3 = S.i + a2 * h / 2;
        const a4 = acc(S.q + b3 * h, S.i + a3 * h, t0 + h),             b4 = S.i + a3 * h;
        S.q += h / 6 * (b1 + 2 * b2 + 2 * b3 + b4);
        S.i += h / 6 * (a1 + 2 * a2 + 2 * a3 + a4);
        S.tp += h;
      }
      const T = 1 / Math.max(p.f, 1e-6);
      S.cyc = S.tp / T;
      if (p.showTransient) S.settle = clamp(S.Rr / (2 * S.L) * S.tp / 3, 0, 1);
      const push = (arr, v) => { arr.push([S.tp / T, v]); if (arr.length > 1600) arr.shift(); };
      push(S.trI, S.i);
      push(S.trV, p.V0 * Math.sin(S.w * S.tp));
    },

    drawStage(S, g) {
      const ctx = g.ctx, th = g.theme, p = S.p, W = g.w, H = g.h;
      const HDR = 62, FOOT = 26;
      const y0 = HDR, y1 = H - FOOT, CH = y1 - y0;
      const CR = '#FFD36B', CI = '#3DD6F5', CL = '#FF6B9D', CC = '#7CE0A8';

      /* ---------------- the circuit, as components ---------------- */
      const lx = W * 0.05, rx = W * 0.50, ty = y0 + CH * 0.14, byy = y0 + CH * 0.58;
      const midY = (ty + byy) / 2;
      const comp = (rx - lx) * 0.24;
      // R and L sit on the top rail, C and the source on the bottom one; each
      // component is centred in its own gap so no wire runs through a part
      const rX = lx + comp * 1.00, lX = lx + comp * 2.20;
      const cX = lx + comp * 2.20, sX = lx + comp * 0.70;

      PA.wire(ctx, [[lx, midY], [lx, ty], [rX - comp * 0.44, ty]], '#C9D4EA');
      PA.resistor(ctx, rX, ty, comp * 0.80, 18);
      PA.wire(ctx, [[rX + comp * 0.44, ty], [lX - comp * 0.46, ty]], '#C9D4EA');
      PA.inductor(ctx, lX, ty, comp * 0.86, 22, { turns: 7 });
      PA.wire(ctx, [[lX + comp * 0.46, ty], [rx, ty], [rx, midY]], '#C9D4EA');
      PA.wire(ctx, [[rx, midY], [rx, byy], [cX + comp * 0.34, byy]], '#C9D4EA');
      const qNorm = clamp(S.q / Math.max(S.C * p.V0 * 3, 1e-12), -1, 1);
      PA.capacitor(ctx, cX, byy, comp * 0.5, 30, { charge: qNorm });
      PA.wire(ctx, [[cX - comp * 0.34, byy], [sX + comp * 0.34, byy]], '#C9D4EA');
      const srcR = Math.min(comp * 0.32, 24);
      PA.acSource(ctx, sX, byy, srcR, S.w * S.tp, { colour: CR });
      PA.wire(ctx, [[sX - srcR, byy], [lx, byy], [lx, midY]], '#C9D4EA');

      PA.lbl(ctx, rX, ty - 17, 'R = ' + p.R.toFixed(0) + ' Ω', CR, 'center', 9.5);
      PA.lbl(ctx, lX, ty - 21, 'L = ' + p.Lh.toFixed(3) + ' H', CL, 'center', 9.5);
      PA.lbl(ctx, cX, byy + 25, 'C = ' + p.Cuf.toFixed(1) + ' µF', CC, 'center', 9.5);
      PA.lbl(ctx, sX, byy + srcR + 11,
             p.V0.toFixed(1) + ' V · ' + p.f.toFixed(1) + ' Hz', CR, 'center', 9.5);

      // the current, drawn as charge actually moving round the loop
      {
        const loop = [];
        const seg = (x0s, y0s, x1s, y1s) => {
          for (let i = 0; i < 14; i++) loop.push([x0s + (x1s - x0s) * i / 14,
                                                  y0s + (y1s - y0s) * i / 14]);
        };
        seg(lx, byy, lx, ty); seg(lx, ty, rx, ty); seg(rx, ty, rx, byy); seg(rx, byy, lx, byy);
        const iNorm = S.I0 > 1e-12 ? S.i / S.I0 : 0;
        const nDots = 30;
        for (let k = 0; k < nDots; k++) {
          const u = ((k / nDots) + S.tp * p.f * 0.9 * Math.sign(iNorm || 1)) % 1;
          const q = loop[Math.floor(clamp(u, 0, 0.999) * loop.length)];
          if (!q) continue;
          const a = clamp(Math.abs(iNorm), 0, 1);
          ctx.fillStyle = g.alpha(CI, .18 + .72 * a);
          ctx.beginPath(); ctx.arc(q[0], q[1], 2.0 + 1.6 * a, 0, TAU); ctx.fill();
        }
        PA.lbl(ctx, (lx + rx) / 2, ty + 22,
               'i = ' + S.i.toFixed(4) + ' A   ·   I₀ = ' + S.I0.toFixed(4) + ' A', CI, 'center', 9.5);
      }

      /* ---------------- voltmeters across each element ----------------
         Each bar is scaled to the largest reading in the circuit, which is the
         point: at high Q the supply bar is the SHORT one. */
      {
        const rows = [['supply V₀', p.V0, '#C9D4EA'], ['V_R = IR', S.VR, CR],
                      ['V_L = IX_L', S.VL, CL], ['V_C = IX_C', S.VC, CC]];
        const bh = 17, gap = 4;
        const bw = Math.min(W * 0.36, 300);
        const bx0 = lx;
        const by0 = Math.min(byy + srcR + 42, y1 - (bh + gap) * 4 - 14);
        const mxv = Math.max(p.V0, S.VL, S.VC, 1e-9);
        PA.lbl(ctx, bx0, by0 - 9, 'WHAT A VOLTMETER READS ACROSS EACH ELEMENT',
               th['text-3'], 'left', 8.5);
        rows.forEach((r, i) => {
          const yy = by0 + i * (bh + gap);
          ctx.fillStyle = g.alpha(r[2], .26);
          ctx.fillRect(bx0, yy, bw * r[1] / mxv, bh);
          ctx.strokeStyle = g.alpha(r[2], .65); ctx.lineWidth = 1;
          ctx.strokeRect(bx0, yy, bw, bh);
          PA.lbl(ctx, bx0 + 7, yy + bh / 2, r[0], r[2], 'left', 9);
          PA.lbl(ctx, bx0 + bw - 7, yy + bh / 2, r[1].toFixed(2) + ' V', '#F2F6FF', 'right', 9);
        });
        if (S.VL > p.V0 * 1.05) {
          PA.lbl(ctx, bx0 + bw + 10, by0 + (bh + gap) * 2 + bh / 2,
                 '×' + (S.VL / p.V0).toFixed(1) + ' the supply', th.warn, 'left', 9);
        }
      }

      /* ---------------- the phasor diagram ---------------- */
      if (p.phasors) {
        const dR = Math.min(W * 0.100, CH * 0.26);
        const dcx = W * 0.72, dcy = y0 + CH * 0.32;
        const wt = S.w * S.tp;
        const mx = Math.max(p.V0, S.VL, S.VC, 1e-9);
        // phasors rotate anticlockwise; screen y is inverted, so negate
        PA.phasorDial(ctx, dcx, dcy, dR, [
          { mag: p.V0 / mx, ang: -wt, colour: '#C9D4EA', label: 'V', width: 3.8,
            project: true, labelOff: 26 },
          { mag: S.VR / mx, ang: -(wt - S.phi), colour: CR, label: 'V_R', width: 3, labelOff: 12 },
          { mag: S.VL / mx, ang: -(wt - S.phi) - Math.PI / 2, colour: CL, label: 'V_L', width: 3 },
          { mag: S.VC / mx, ang: -(wt - S.phi) + Math.PI / 2, colour: CC, label: 'V_C', width: 3 }
        ]);
        PA.lbl(ctx, dcx, dcy + dR + 15,
               'φ = ' + (S.phi * 180 / Math.PI).toFixed(1) + '°   ·   cos φ = ' + S.pf.toFixed(3),
               '#B07CC6', 'center', 10.5);
        PA.lbl(ctx, dcx, dcy + dR + 29,
               Math.abs(S.phi) < 0.02 ? 'current in phase with the supply — resonance'
               : S.phi > 0 ? 'inductive: current LAGS the voltage'
                           : 'capacitive: current LEADS the voltage',
               th['text-3'], 'center', 9);

        /* ---- the impedance triangle, which is the same diagram divided by I ----
           The reactance leg points up when the circuit is inductive and down
           when it is capacitive, so the box has to accommodate both. */
        const Xnet = S.XL - S.XC;
        const boxW = Math.min(W * 0.20, 166), boxH = Math.min(CH * 0.24, 88);
        const tx = W - boxW - 34, boxTop = y1 - boxH - 8;
        const sc = Math.min(boxW / Math.max(S.Rr, 1e-9),
                            boxH / Math.max(Math.abs(Xnet), 1e-9)) * 0.92;
        const tyy = Xnet >= 0 ? boxTop + boxH : boxTop;
        const apexX = tx + S.Rr * sc, apexY = tyy - Xnet * sc;
        PA.vector(ctx, tx, tyy, apexX, tyy, CR, { width: 3, shadow: false });
        PA.vector(ctx, apexX, tyy, apexX, apexY, Xnet >= 0 ? CL : CC, { width: 3, shadow: false });
        PA.vector(ctx, tx, tyy, apexX, apexY, '#C9D4EA', { width: 3, shadow: false });
        PA.lbl(ctx, (tx + apexX) / 2, tyy + (Xnet >= 0 ? 11 : -11),
               'R = ' + S.Rr.toFixed(0) + ' Ω', CR, 'center', 9);
        PA.lbl(ctx, apexX + 7, (tyy + apexY) / 2,
               (Xnet >= 0 ? 'X_L − X_C = ' : 'X_C − X_L = ') + Math.abs(Xnet).toFixed(1) + ' Ω',
               Xnet >= 0 ? CL : CC, 'left', 9);
        PA.lbl(ctx, tx - 6, apexY, 'Z = ' + S.Z.toFixed(1) + ' Ω', '#C9D4EA', 'right', 9.5);
      }

      /* ---------------- header ---------------- */
      const res = Math.abs(p.f - S.f0) / Math.max(S.f0, 1e-9) < 0.005;
      ctx.textAlign = 'left'; ctx.textBaseline = 'top';
      ctx.font = '700 19px "IBM Plex Sans Condensed",sans-serif';
      ctx.fillStyle = res ? th.ok : th.text;
      ctx.fillText(res ? 'AT RESONANCE — Z = R, current is maximum'
                 : S.XL > S.XC ? 'INDUCTIVE — X_L > X_C, current lags'
                               : 'CAPACITIVE — X_C > X_L, current leads', 14, 8);
      ctx.font = '500 10px "IBM Plex Mono",monospace'; ctx.fillStyle = th['text-3'];
      ctx.fillText('f₀ = 1/2π√(LC) = ' + S.f0.toFixed(2) + ' Hz   ·   f = ' + p.f.toFixed(1) +
        ' Hz   ·   X_L = ' + S.XL.toFixed(1) + ' Ω   ·   X_C = ' + S.XC.toFixed(1) +
        ' Ω   ·   Z = ' + S.Z.toFixed(1) + ' Ω', 14, 31);
      ctx.fillStyle = S.settle > 0.9 ? th.ok : th.warn;
      ctx.fillText(!p.showTransient
        ? 'started on the steady-state solution — no transient to wait out'
        : S.settle > 0.9
        ? 'steady state — the switch-on transient has decayed'
        : 'switch-on transient still ringing at the circuit\'s own frequency', 14, 45);
    },

    plots: [
      { title: 'Current against frequency — the resonance curve and its half-power band',
        legend: [{ c: '#3DD6F5', label: 'I₀(f) at this R' }, { c: '#63729A', label: 'other R for comparison' }],
        draw(S, g) {
          const p = S.p;
          const fmax = Math.max(S.f0 * 3, p.f * 1.15);
          const Imax = p.V0 / Math.max(S.Rr, 1e-9);
          const P = g.Plot({
            xmin: 0, xmax: fmax, ymin: 0, ymax: Imax * 1.12,
            xlabel: 'frequency (Hz)', ylabel: 'peak current I₀ (A)',
            xfmt: v => v.toFixed(0), yfmt: v => v.toFixed(3),
            pad: { l: 60, r: 16, t: 14, b: 34 }
          }).frame();
          const curveFor = R => {
            const c = [];
            for (let i = 1; i <= 220; i++) {
              const f = fmax * i / 220, w = TAU * f;
              const Z = Math.sqrt(R * R + Math.pow(w * S.L - 1 / (w * S.C), 2));
              c.push([f, p.V0 / Z]);
            }
            return c;
          };
          P.clip(() => {
            [0.3, 0.6, 2, 4].forEach(k => P.line(curveFor(S.Rr * k),
              g.alpha(g.theme['text-3'], .32), 1));
            P.line(curveFor(S.Rr), '#3DD6F5', 2.4);
            P.hline(Imax / Math.SQRT2, g.alpha(g.theme.warn, .75), [4, 3]);
            // the half-power frequencies, from ω = ±R/2L + √((R/2L)²+ω₀²)
            const a = S.Rr / (2 * S.L);
            const w1 = -a + Math.sqrt(a * a + S.w0 * S.w0);
            const w2 = a + Math.sqrt(a * a + S.w0 * S.w0);
            P.vline(w1 / TAU, g.alpha(g.theme.warn, .55), [2, 3]);
            P.vline(w2 / TAU, g.alpha(g.theme.warn, .55), [2, 3]);
            P.vline(S.f0, g.alpha(g.theme['text-3'], .8), [4, 3]);
            P.vline(p.f, g.alpha(g.theme.text, .9));
            P.dot(p.f, S.I0, 4.5, '#3DD6F5', true);
          });
          P.tag(S.f0, Imax * 1.06, 'f₀', g.theme['text-3'], 'left', 0);
          P.tag(0, Imax / Math.SQRT2, 'I₀/√2 — half power', g.theme.warn, 'left', -8);
        },
        hover(S, x) {
          const p = S.p, w = TAU * Math.max(x, 1e-6);
          const XL = w * S.L, XC = 1 / (w * S.C);
          const Z = Math.sqrt(S.Rr * S.Rr + Math.pow(XL - XC, 2));
          const I = p.V0 / Z, ph = Math.atan2(XL - XC, S.Rr);
          return [{ label: 'frequency', value: x.toFixed(2) + ' Hz' },
                  { label: 'X_L', value: XL.toFixed(2) + ' Ω', color: '#FF6B9D' },
                  { label: 'X_C', value: XC.toFixed(2) + ' Ω', color: '#7CE0A8' },
                  { label: 'impedance Z', value: Z.toFixed(2) + ' Ω' },
                  { label: 'peak current', value: I.toFixed(4) + ' A', color: '#3DD6F5' },
                  { label: 'power factor', value: Math.cos(ph).toFixed(3) }];
        } },
      { title: 'Supply voltage and current in time — the phase difference, measured',
        legend: [{ c: '#FFD36B', label: 'supply voltage' }, { c: '#3DD6F5', label: 'current' }],
        draw(S, g) {
          const p = S.p;
          if (!S.trI.length) return;
          const c1 = S.cyc;
          const span = 4;
          const x0 = Math.max(0, c1 - span);
          let im = 1e-9;
          S.trI.forEach(q => { if (q[0] >= x0) im = Math.max(im, Math.abs(q[1])); });
          const P = g.Plot({
            xmin: x0, xmax: Math.max(c1, span), ymin: -1.1, ymax: 1.1,
            xlabel: 'cycles of the supply', ylabel: 'normalised',
            xfmt: v => v.toFixed(1), yfmt: v => v.toFixed(1),
            pad: { l: 52, r: 16, t: 14, b: 34 }
          }).frame();
          P.clip(() => {
            P.line(S.trV.map(q => [q[0], q[1] / Math.max(p.V0, 1e-9)]),
                   g.alpha('#FFD36B', .9), 2);
            P.line(S.trI.map(q => [q[0], q[1] / im]), '#3DD6F5', 2.2);
            P.hline(0, g.alpha(g.theme['text-3'], .6));
            // mark the lag between a voltage zero and the next current zero
            const lagCycles = S.phi / TAU;
            if (Math.abs(lagCycles) > 0.004 && c1 > 1) {
              const z = Math.floor(c1 - 1);
              P.vline(z, g.alpha('#FFD36B', .6), [3, 3]);
              P.vline(z + lagCycles, g.alpha('#3DD6F5', .6), [3, 3]);
            }
          });
          P.tag(x0, 1.02,
            Math.abs(S.phi) < 0.02 ? 'zeros coincide — in phase'
              : 'current zero is ' + Math.abs(S.phi * 180 / Math.PI).toFixed(0) + '° ' +
                (S.phi > 0 ? 'after' : 'before') + ' the voltage zero',
            g.theme['text-3'], 'left', 0);
        },
        hover(S, x) {
          const at = arr => {
            if (!arr.length) return 0;
            let b = arr[0];
            for (const q of arr) if (Math.abs(q[0] - x) < Math.abs(b[0] - x)) b = q;
            return b[1];
          };
          return [{ label: 'cycle', value: x.toFixed(3) },
                  { label: 'supply voltage', value: at(S.trV).toFixed(3) + ' V', color: '#FFD36B' },
                  { label: 'current', value: at(S.trI).toFixed(5) + ' A', color: '#3DD6F5' },
                  { label: 'instantaneous power', value:
                      (at(S.trV) * at(S.trI)).toFixed(4) + ' W' }];
        } }
    ],

    readouts(S) {
      const p = S.p;
      const Vrms = p.V0 / Math.SQRT2, Irms = S.I0 / Math.SQRT2;
      return [
        { label: 'Resonant frequency f₀ = 1/2π√(LC)', value: S.f0.toFixed(3), unit: 'Hz',
          flag: 'accent' },
        { label: 'Inductive reactance X_L = ωL', value: S.XL.toFixed(3), unit: 'Ω' },
        { label: 'Capacitive reactance X_C = 1/ωC', value: S.XC.toFixed(3), unit: 'Ω' },
        { label: 'Impedance Z', value: S.Z.toFixed(3), unit: 'Ω',
          flag: Math.abs(S.Z - S.Rr) / S.Rr < 0.01 ? 'ok' : '',
          hint: Math.abs(S.Z - S.Rr) / S.Rr < 0.01 ? 'Z = R — purely resistive' : '√(R²+(X_L−X_C)²)' },
        { label: 'Peak current I₀ = V₀/Z', value: S.I0.toFixed(5), unit: 'A' },
        { label: 'RMS current', value: Irms.toFixed(5), unit: 'A', hint: 'I₀/√2' },
        { label: 'Phase angle φ', value: (S.phi * 180 / Math.PI).toFixed(2), unit: '°',
          hint: S.phi > 0.01 ? 'current lags' : S.phi < -0.01 ? 'current leads' : 'in phase' },
        { label: 'Power factor cos φ', value: S.pf.toFixed(4), unit: '',
          flag: S.pf > 0.99 ? 'ok' : S.pf < 0.5 ? 'warn' : '' },
        { label: 'Average power V_rms I_rms cos φ', value: S.Pavg.toFixed(4), unit: 'W',
          hint: 'only R dissipates — L and C never do' },
        { label: 'Wattless current component', value: (Irms * Math.abs(Math.sin(S.phi))).toFixed(5),
          unit: 'A', hint: 'flows but carries no net energy' },
        { label: 'Quality factor Q = (1/R)√(L/C)', value: isFinite(S.Q) ? S.Q.toFixed(3) : '∞',
          unit: '', flag: 'accent' },
        { label: 'Bandwidth Δf = R/2πL', value: (S.band / TAU).toFixed(3), unit: 'Hz',
          hint: 'sharper resonance means smaller R' },
        { label: 'Voltage across L', value: S.VL.toFixed(3), unit: 'V',
          flag: S.VL > p.V0 ? 'warn' : '',
          hint: S.VL > p.V0 ? 'larger than the supply — and legitimately so' : '' },
        { label: 'Voltage across C', value: S.VC.toFixed(3), unit: 'V',
          flag: S.VC > p.V0 ? 'warn' : '' },
        { label: 'V_L + V_C (phasor sum)', value: Math.abs(S.VL - S.VC).toFixed(3), unit: 'V',
          hint: 'they are 180° apart, so they SUBTRACT' }
      ];
    },

    equation(S) {
      const p = S.p;
      return E.v('L') + E.frac('d²' + E.v('q'), 'd' + E.v('t') + '²') + ' ' + E.op('+') + ' ' +
        E.v('R') + E.frac('d' + E.v('q'), 'd' + E.v('t')) + ' ' + E.op('+') + ' ' +
        E.frac(E.v('q'), E.v('C')) + ' ' + E.op('=') + ' ' + E.v('V') + E.sub('0') +
        ' sin(ω' + E.v('t') + ')' +
        '<br>' + E.v('Z') + ' ' + E.op('=') + ' √[' + E.v('R') + '² ' + E.op('+') +
        ' (' + E.v('X') + E.sub('L') + ' ' + E.op('−') + ' ' + E.v('X') + E.sub('C') + ')²] ' +
        E.op('=') + ' ' + E.n(S.Z, 'Ω') +
        '&nbsp;&nbsp;&nbsp;tanφ ' + E.op('=') + ' ' +
        E.frac(E.v('X') + E.sub('L') + ' ' + E.op('−') + ' ' + E.v('X') + E.sub('C'), E.v('R')) +
        ' ' + E.op('⇒') + ' ' + E.n(S.phi * 180 / Math.PI, '°');
    },

    walkthrough: [
      { title: '1 · Switch it on and wait',
        body: 'Look at the lower graph in the first second after any change. The current is messy before it becomes a clean sine.',
        ask: 'Two frequencies are present at the start. What is the second one?',
        reveal: 'The circuit\'s <b>own</b> damped frequency, √(1/LC − R²/4L²). It is the transient solution ' +
          'of the homogeneous equation and it dies as e<sup>−Rt/2L</sup>. Everything the textbook says about ' +
          'LCR circuits — Z, φ, power factor — describes only what is left <b>after</b> it has gone.',
        params: { R: 40, Lh: 0.20, Cuf: 20, f: 79.577 } },
      { title: '2 · Tune to resonance',
        body: 'Set f to f₀ = 1/2π√(LC) and watch the phasor diagram.',
        ask: 'V_L and V_C are both large. Why is the total still just V_R?',
        reveal: 'Because they point in <b>exactly opposite directions</b>: the inductor voltage leads the ' +
          'current by 90°, the capacitor voltage lags it by 90°, so they are 180° apart and cancel as vectors. ' +
          'What is left is V_R alone, in phase with the current. Z collapses to R and the current is at its ' +
          'largest possible value V₀/R.',
        params: { R: 40, Lh: 0.20, Cuf: 20, f: 79.577 } },
      { title: '3 · Make the voltmeters lie',
        body: 'Drop R to 5 Ω, stay at resonance, and read the four voltage bars.',
        ask: 'A 20 V supply, and the capacitor reads over 200 V. Is energy being created?',
        reveal: 'No. Q = (1/R)√(L/C) is now about 20, and <b>V_L = V_C = Q × V₀</b>. The two large voltages ' +
          'are in antiphase and cancel at every instant, so Kirchhoff is perfectly satisfied. This ' +
          '<b>voltage magnification</b> is real, it is measurable, and it is how a radio tuner picks one ' +
          'station out of the air.',
        params: { R: 5, Lh: 0.20, Cuf: 20, V0: 20, f: 79.577 } },
      { title: '4 · Detune each way',
        body: 'Take f well below f₀, then well above, watching the phasor diagram and the impedance triangle.',
        ask: 'Which element dominates on each side?',
        reveal: 'Below f₀ the reactance X_C = 1/ωC is large, so the circuit is <b>capacitive</b> and the ' +
          'current <b>leads</b> the supply. Above f₀, X_L = ωL wins, the circuit is <b>inductive</b> and the ' +
          'current <b>lags</b>. At f₀ they are equal and φ passes through zero — the sign change is the ' +
          'cleanest experimental signature of resonance.',
        params: { f: 160 } },
      { title: '5 · Where the power actually goes',
        body: 'Compare the average power with V_rms × I_rms at a frequency well away from resonance.',
        ask: 'The product V_rms I_rms is large but the power is small. Where is the rest?',
        reveal: 'Nowhere — it is never delivered. Only <b>V_rms I_rms cos φ</b> is dissipated, and only in R. ' +
          'The inductor and capacitor take energy in for a quarter cycle and give all of it back in the next: ' +
          'their average power is <b>exactly zero</b>. The current component that does this is the ' +
          '<b>wattless current</b>, and at φ = 90° the entire current is wattless.',
        params: { R: 40, f: 40 } }
    ],

    problems: [
      { source: 'JEE Main pattern · resonance',
        q: 'A series LCR circuit has L = 0.200 H and C = 20.0 µF. Find its resonant frequency in hertz.',
        params: { R: 40, Lh: 0.20, Cuf: 20, V0: 20, f: 79.577 },
        predict: { label: 'resonant frequency', unit: 'Hz', tol: 0.02 },
        measure: S => S.f0,
        working: 'f₀ = 1/(2π√(LC)) = 1/(2π√(0.200 × 20.0×10⁻⁶)) = 1/(2π × 2.0×10⁻³) = ' +
          '<b>79.6 Hz</b>. Watch the microfarads: using 20 instead of 20×10⁻⁶ is out by a factor ' +
          'of 1000, and √1000 ≈ 31.6 in the answer.' },
      { source: 'JEE Advanced pattern · voltage magnification',
        q: 'A series LCR circuit with R = 5.00 Ω, L = 0.200 H and C = 20.0 µF is driven at resonance by a supply of peak voltage 20.0 V. Find the peak voltage across the inductor, in volts.',
        params: { R: 5, Lh: 0.20, Cuf: 20, V0: 20, f: 79.577 },
        predict: { label: 'peak V across L', unit: 'V', tol: 0.03 },
        measure: S => S.VL,
        working: 'At resonance Z = R, so I₀ = 20.0/5.00 = 4.00 A, and X_L = ωL = 2π(79.6)(0.200) = ' +
          '100 Ω. So V_L = I₀X_L = <b>400 V</b> — twenty times the supply. The magnification factor ' +
          'is exactly Q = (1/R)√(L/C) = 20. V_C is the same 400 V, in antiphase, so the two cancel ' +
          'and Kirchhoff is perfectly satisfied.' },
      { source: 'NEET pattern · power',
        q: 'In an AC circuit the rms voltage is 220 V, the rms current is 5.00 A and the phase angle between them is 60°. Find the average power consumed, in watts.',
        params: { R: 40, Lh: 0.20, Cuf: 20, f: 40 },
        predict: { label: 'average power', unit: 'W', tol: 0.02 },
        measure: () => 220 * 5.0 * Math.cos(Math.PI / 3),
        working: 'P = V_rms I_rms cos φ = 220 × 5.00 × cos60° = 220 × 5.00 × 0.500 = <b>550 W</b>. ' +
          'The apparent power V_rms I_rms is 1100 W; the other half is never delivered at all. ' +
          'The current component responsible is the <b>wattless</b> one, and at φ = 90° the whole ' +
          'current would be wattless.' }
    ],

    quiz: [
      { q: 'In a series LCR circuit at resonance, the impedance is:',
        options: ['zero', 'maximum', 'equal to R', 'equal to X_L + X_C'], answer: 2,
        why: 'At resonance X_L = X_C, so their difference vanishes and Z = √(R²+0) = R. This is the minimum possible impedance, which is why the current is maximum there.' },
      { q: 'A series LCR circuit has R = 5 Ω, and at resonance the voltage across the inductor is 250 V when the supply is 25 V. The Q factor is:',
        options: ['5', '10', '50', '0.1'], answer: 1,
        why: 'At resonance V_L = Q V_supply, so Q = 250/25 = 10. Equivalently Q = (1/R)√(L/C), and the voltage magnification across L and C is exactly Q.' },
      { q: 'The average power dissipated in a pure inductor carrying alternating current is:',
        options: ['I²_rms X_L', 'zero', 'V_rms I_rms', 'half of I²_rms X_L'], answer: 1,
        why: 'The current is 90° out of phase with the voltage, so cos φ = 0 and the average power is zero. Energy is stored in the magnetic field for a quarter cycle and returned in the next — none of it is dissipated.' },
      { q: 'In a series LCR circuit driven below its resonant frequency:',
        options: ['the current lags the voltage', 'the current leads the voltage',
                  'the current is in phase with the voltage', 'the current is zero'], answer: 1,
        why: 'Below f₀ the capacitive reactance 1/ωC exceeds ωL, so X_L − X_C is negative, φ is negative, and the current leads. Remember it as "CIVIL": in a Capacitor, I leads V; V leads I in an inductor L.' }
    ],

    notes: '<b>Where this shows up in the paper.</b>' +
      '<ul><li>Z, φ and cos φ by direct substitution — the commonest AC numerical there is.</li>' +
      '<li>Voltage magnification V_L = V_C = QV at resonance, and Q = (1/R)√(L/C).</li>' +
      '<li>Bandwidth Δω = R/L and the half-power points, which appear in Advanced.</li>' +
      '<li>Wattless current, and why average power in L and C is exactly zero.</li></ul>' +
      '<div class="pyq"><em>Trap to avoid</em>Voltages across the elements <b>do not add arithmetically</b>. ' +
      'V₀ = √(V_R² + (V_L − V_C)²), never V_R + V_L + V_C. A question that gives you V_R = 30 V, ' +
      'V_L = 80 V and V_C = 40 V wants 50 V, not 150 V — and at resonance the supply can be far ' +
      '<b>smaller</b> than the reading across a single element.</div>'
  });

})(window.InsightLab);
