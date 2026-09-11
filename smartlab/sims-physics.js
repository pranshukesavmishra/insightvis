/* ============================================================
   PHYSICS — 1. Lorentz force   2. Young's double slit
   ============================================================ */
(function (L) {
  'use strict';
  const { clamp, TAU, fmt, E, Camera } = L;

  /* ---- shared 3D drawing helpers ---- */
  function seg3(ctx, cam, a, b, color, width) {
    const A = cam.project(a), B = cam.project(b);
    if (!A.ok || !B.ok) return;
    ctx.strokeStyle = color; ctx.lineWidth = width || 1;
    ctx.beginPath(); ctx.moveTo(A.x, A.y); ctx.lineTo(B.x, B.y); ctx.stroke();
  }
  function arrow3(ctx, cam, a, b, color, width, head) {
    const A = cam.project(a), B = cam.project(b);
    if (!A.ok || !B.ok) return;
    ctx.strokeStyle = color; ctx.fillStyle = color; ctx.lineWidth = width || 1.5;
    ctx.beginPath(); ctx.moveTo(A.x, A.y); ctx.lineTo(B.x, B.y); ctx.stroke();
    const ang = Math.atan2(B.y - A.y, B.x - A.x), hs = head || 6;
    ctx.beginPath();
    ctx.moveTo(B.x, B.y);
    ctx.lineTo(B.x - hs * Math.cos(ang - 0.42), B.y - hs * Math.sin(ang - 0.42));
    ctx.lineTo(B.x - hs * Math.cos(ang + 0.42), B.y - hs * Math.sin(ang + 0.42));
    ctx.closePath(); ctx.fill();
  }
  function label3(ctx, cam, p, text, color, font) {
    const P = cam.project(p); if (!P.ok) return;
    ctx.font = font || '500 11px "IBM Plex Mono",monospace';
    ctx.fillStyle = color; ctx.textAlign = 'left'; ctx.textBaseline = 'middle';
    ctx.fillText(text, P.x + 6, P.y);
  }

  /* =========================================================================
     1 · LORENTZ FORCE — charged particle in crossed E and B fields
     Integrated with the Boris pusher, which conserves |v| exactly under a
     pure magnetic field — so the readout itself proves B does no work.
     ========================================================================= */
  const QE = 1.602176634e-19, MP = 1.67262192e-27, ME = 9.1093837e-31;
  const SPECIES = {
    p:     { q:  QE,     m: MP,          name: 'Proton',   sym: 'p⁺' },
    e:     { q: -QE,     m: ME,          name: 'Electron', sym: 'e⁻' },
    alpha: { q:  2 * QE, m: 4.0015 * MP, name: 'Alpha',    sym: 'α²⁺' }
  };

  L.register({
    id: 'lorentz', subject: 'physics',
    name: 'Charged Particle in Crossed E and B Fields',
    chapter: 'Moving Charges & Magnetism',
    exams: ['JEE Main', 'JEE Advanced', 'NEET UG'],
    weight: 'High yield',
    is3D: true,
    stageHint: 'Drag to orbit · scroll to zoom · ⌖ resets view',
    lede: 'A charge moving through a magnetic field feels a force perpendicular to both its velocity and the field. ' +
      'That single fact produces circles, helices, the cyclotron, the velocity selector and the mass spectrometer. ' +
      'This lab integrates <b>F⃗ = q(E⃗ + v⃗ × B⃗)</b> with a Boris pusher, so the speed readout is not approximated — ' +
      'watch it stay <b>exactly</b> constant while the direction changes.',

    params: { species: 'p', v0: 1.2e6, pitchDeg: 90, B: 0.12, Ey: 0, showB: true, showVec: true, trail: true },

    presets: [
      { name: 'Cyclotron (v ⊥ B)', params: { species: 'p', pitchDeg: 90, Ey: 0, B: 0.12, v0: 1.2e6 } },
      { name: 'Helix (v at 55°)', params: { species: 'p', pitchDeg: 55, Ey: 0, B: 0.12, v0: 1.2e6 } },
      { name: 'Velocity selector', params: { species: 'p', pitchDeg: 90, B: 0.12, v0: 1.2e6, Ey: 1.2e6 * 0.12 } },
      { name: 'Electron (same B)', params: { species: 'e', pitchDeg: 90, Ey: 0, B: 0.12, v0: 1.2e6 } }
    ],

    controls: [
      { group: 'Particle', items: [
        { key: 'species', type: 'select', label: 'Species', options: [
          { value: 'p', label: 'p⁺' }, { value: 'e', label: 'e⁻' }, { value: 'alpha', label: 'α²⁺' }] },
        { key: 'v0', label: 'Initial speed <i>v</i>₀', min: 2e5, max: 6e6, step: 1e4, unit: 'm/s',
          fmt: v => fmt(v, 3) },
        { key: 'pitchDeg', label: 'Pitch angle <i>θ</i> (v to B)', min: 0, max: 90, step: 1, unit: '°',
          fmt: v => v.toFixed(0) }
      ] },
      { group: 'Fields', items: [
        { key: 'B', label: 'Magnetic field <i>B</i><sub>z</sub>', min: 0.02, max: 0.5, step: 0.005, unit: 'T',
          fmt: v => v.toFixed(3) },
        { key: 'Ey', label: 'Electric field <i>E</i><sub>y</sub>', min: 0, max: 6e5, step: 2e3, unit: 'V/m',
          fmt: v => fmt(v, 3) }
      ] },
      { group: 'Display', items: [
        { key: 'showB', type: 'toggle', label: 'Show B field lattice' },
        { key: 'showVec', type: 'toggle', label: 'Show v and F vectors' },
        { key: 'trail', type: 'toggle', label: 'Show trajectory trail' }
      ] }
    ],

    setup(S) {
      const p = S.p, sp = SPECIES[p.species];
      S.q = sp.q; S.m = sp.m; S.sp = sp;
      const th = p.pitchDeg * Math.PI / 180;
      S.vperp0 = p.v0 * Math.sin(th);
      S.vpar0 = p.v0 * Math.cos(th);
      S.rc = S.vperp0 * S.m / (Math.abs(S.q) * p.B);
      S.Tc = TAU * S.m / (Math.abs(S.q) * p.B);
      S.pitchLen = S.vpar0 * S.Tc;
      S.Lscale = Math.max(S.rc, 0.5 * S.pitchLen, 1e-9);

      S.pos = [0, 0, 0];
      S.vel = [S.vperp0, 0, S.vpar0];
      S.tp = 0;
      S.trail = [];
      S.hist = [];
      if (!S.cam) { S.cam = Camera({ theta: -1.05, phi: 0.34, dist: 4.6 }); S.cam.minDist = 1.2; S.cam.maxDist = 22; }
      S.cam.target = [0, 0, 0];
    },

    step(S, dt) {
      const p = S.p;
      // Map wall-clock to physical time: ~2.2 cyclotron periods per second.
      const rate = 2.2 * S.Tc;
      let want = dt * rate;
      const hMax = S.Tc / 140;
      let n = Math.ceil(want / hMax);
      n = clamp(n, 1, 400);
      const h = want / n;
      const qm = S.q / S.m, Bz = p.B, Ey = p.Ey;

      for (let i = 0; i < n; i++) {
        // Boris pusher
        const f = qm * h / 2;
        let vx = S.vel[0], vy = S.vel[1] + f * Ey, vz = S.vel[2];
        const tz = f * Bz, s = 2 * tz / (1 + tz * tz);
        // v' = v- + v- × t   (t along z)
        const px = vx + vy * tz, py = vy - vx * tz;
        // v+ = v- + v' × s
        vx = vx + py * s; vy = vy - px * s;
        vy += f * Ey;
        S.vel[0] = vx; S.vel[1] = vy; S.vel[2] = vz;
        S.pos[0] += vx * h; S.pos[1] += vy * h; S.pos[2] += vz * h;
        S.tp += h;
      }

      const k = 1 / S.Lscale;
      S.trail.push([S.pos[0] * k, S.pos[1] * k, S.pos[2] * k, S.tp]);
      const keep = 2.05 * S.Tc;
      while (S.trail.length > 2 && S.trail[0][3] < S.tp - keep) S.trail.shift();
      if (S.trail.length > 3000) S.trail.shift();

      const spd = Math.hypot(S.vel[0], S.vel[1], S.vel[2]);
      S.speed = spd;
      S.hist.push([S.tp / S.Tc, spd, S.vel[2]]);
      while (S.hist.length > 2 && S.hist[0][0] < S.tp / S.Tc - 3) S.hist.shift();

      // keep the particle framed as it drifts
      let cx = 0, cy = 0, cz = 0;
      for (const t of S.trail) { cx += t[0]; cy += t[1]; cz += t[2]; }
      const nT = S.trail.length || 1;
      S.cam.target[0] += ((cx / nT) - S.cam.target[0]) * 0.05;
      S.cam.target[1] += ((cy / nT) - S.cam.target[1]) * 0.05;
      S.cam.target[2] += ((cz / nT) - S.cam.target[2]) * 0.05;
    },

    drawStage(S, g) {
      const ctx = g.ctx, cam = S.cam, th = g.theme, p = S.p;
      const acc = th.accent, k = 1 / S.Lscale;

      // ---- B field lattice (recessive) ----
      if (p.showB) {
        ctx.save();
        const t0 = S.cam.target;
        for (let i = -1; i <= 1; i++) for (let j = -1; j <= 1; j++) {
          const x = t0[0] + i * 1.3, y = t0[1] + j * 1.3;
          arrow3(ctx, cam, [x, y, t0[2] - 0.95], [x, y, t0[2] + 0.95],
            g.alpha(th['text-3'], 0.42), 1, 6);
        }
        ctx.restore();
        label3(ctx, cam, [S.cam.target[0] + 1.3, S.cam.target[1] + 1.3, S.cam.target[2] + 1.05],
          'B = ' + p.B.toFixed(3) + ' T  (+z)', g.alpha(th['text-2'], .95));
      }

      // ---- E field (if present) ----
      if (p.Ey > 0) {
        const t0 = S.cam.target;
        for (let i = -1; i <= 1; i++) {
          arrow3(ctx, cam, [t0[0] + i * 1.0, t0[1] - 1.5, t0[2]], [t0[0] + i * 1.0, t0[1] - 0.7, t0[2]],
            g.alpha(th.warn, 0.62), 1.4, 5.5);
        }
        label3(ctx, cam, [t0[0] + 1.0, t0[1] - 0.7, t0[2]],
          'E = ' + fmt(p.Ey, 3) + ' V/m  (+y)', g.alpha(th.warn, .95));
      }

      // ---- guiding-centre circle (theoretical radius) ----
      if (S.rc > 1e-12) {
        const gx = (S.pos[0] + S.m * S.vel[1] / (S.q * p.B)) * k;
        const gy = (S.pos[1] - S.m * S.vel[0] / (S.q * p.B)) * k;
        const gz = S.pos[2] * k, R = S.rc * k;
        ctx.save(); ctx.setLineDash([4, 4]); ctx.lineWidth = 1;
        ctx.strokeStyle = g.alpha(th['text-3'], 0.8);
        ctx.beginPath();
        for (let i = 0; i <= 72; i++) {
          const a = i / 72 * TAU;
          const P = cam.project([gx + R * Math.cos(a), gy + R * Math.sin(a), gz]);
          if (!P.ok) continue;
          i ? ctx.lineTo(P.x, P.y) : ctx.moveTo(P.x, P.y);
        }
        ctx.stroke(); ctx.restore();
      }

      // ---- trajectory trail (additive phosphor) ----
      if (p.trail && S.trail.length > 1) {
        ctx.save();
        ctx.globalCompositeOperation = 'lighter';
        ctx.lineCap = 'round'; ctx.lineJoin = 'round';
        for (let pass = 0; pass < 2; pass++) {
          ctx.lineWidth = pass === 0 ? 6 : 1.8;
          const a0 = pass === 0 ? 0.055 : 0.95;
          for (let i = 1; i < S.trail.length; i++) {
            const A = cam.project(S.trail[i - 1]), B = cam.project(S.trail[i]);
            if (!A.ok || !B.ok) continue;
            const f = i / S.trail.length;
            ctx.strokeStyle = g.alpha(acc, a0 * (0.15 + 0.85 * f * f));
            ctx.beginPath(); ctx.moveTo(A.x, A.y); ctx.lineTo(B.x, B.y); ctx.stroke();
          }
        }
        ctx.restore();
      }

      // ---- particle + vectors ----
      const pp = [S.pos[0] * k, S.pos[1] * k, S.pos[2] * k];
      if (p.showVec) {
        const vs = 0.85 / Math.max(S.p.v0, 1);
        arrow3(ctx, cam, pp, [pp[0] + S.vel[0] * vs, pp[1] + S.vel[1] * vs, pp[2] + S.vel[2] * vs],
          th.ok, 2, 7);
        // F = q(E + v × B), B along z
        const Fx = S.q * (S.vel[1] * p.B), Fy = S.q * (p.Ey - S.vel[0] * p.B);
        const Fm = Math.hypot(Fx, Fy) || 1, fs = 0.62 / Fm;
        arrow3(ctx, cam, pp, [pp[0] + Fx * fs, pp[1] + Fy * fs, pp[2]], th.crit, 2, 7);
      }
      const PP = cam.project(pp);
      if (PP.ok) {
        ctx.save(); ctx.globalCompositeOperation = 'lighter';
        const rg = ctx.createRadialGradient(PP.x, PP.y, 0, PP.x, PP.y, 22);
        rg.addColorStop(0, g.alpha(acc, .95)); rg.addColorStop(.35, g.alpha(acc, .35));
        rg.addColorStop(1, g.alpha(acc, 0));
        ctx.fillStyle = rg; ctx.beginPath(); ctx.arc(PP.x, PP.y, 22, 0, TAU); ctx.fill();
        ctx.restore();
        ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(PP.x, PP.y, 4, 0, TAU); ctx.fill();
        ctx.font = '600 11px "IBM Plex Mono",monospace'; ctx.fillStyle = th.text;
        ctx.textAlign = 'left'; ctx.textBaseline = 'bottom';
        ctx.fillText(S.sp.sym, PP.x + 9, PP.y - 7);
      }

      if (p.showVec) {
        ctx.font = '500 10px "IBM Plex Mono",monospace'; ctx.textBaseline = 'top'; ctx.textAlign = 'left';
        ctx.fillStyle = th.ok; ctx.fillText('▬ v  (velocity)', 12, 12);
        ctx.fillStyle = th.crit; ctx.fillText('▬ F  (Lorentz force)', 12, 26);
      }
      ctx.font = '500 10px "IBM Plex Mono",monospace'; ctx.textAlign = 'right'; ctx.textBaseline = 'top';
      ctx.fillStyle = th['text-3'];
      ctx.fillText('scene unit = ' + fmt(S.Lscale, 3) + ' m', g.w - 12, 12);
    },

    plotTitle: 'Speed components vs time — does the magnetic force do work?',
    legend: [{ c: '#3DD6F5', label: '|v| total speed' }, { c: '#4ADE80', label: 'v∥ along B' }],
    drawPlot(S, g) {
      if (!S.hist.length) return;
      const vmax = S.p.v0 * 1.35;
      const t1 = Math.max(3, S.tp / S.Tc);
      const P = g.Plot({
        xmin: Math.max(0, t1 - 3), xmax: Math.max(3, t1), ymin: 0, ymax: vmax / 1e6,
        xlabel: 't / T_c', ylabel: '10⁶ m/s',
        xfmt: v => v.toFixed(1), yfmt: v => v.toFixed(1)
      }).frame();
      P.clip(() => {
        P.line(S.hist.map(h => [h[0], h[1] / 1e6]), g.theme.phys, 2);
        P.line(S.hist.map(h => [h[0], h[2] / 1e6]), g.theme.ok, 2);
      });
      P.hline(S.p.v0 / 1e6, g.alpha(g.theme['text-3'], .8), [3, 3]);
      P.tag(P.cfg.xmin, S.p.v0 / 1e6, 'v₀ = ' + (S.p.v0 / 1e6).toFixed(2), g.theme['text-3'], 'left', -8);
    },

    readouts(S) {
      const p = S.p, sel = p.Ey > 0 ? p.Ey / p.B : 0;
      const ke = 0.5 * S.m * (S.speed || p.v0) * (S.speed || p.v0) / QE;
      const out = [
        { label: 'Radius  r = mv⊥/|q|B', value: fmt(S.rc * 1000, 3), unit: 'mm', flag: 'accent' },
        { label: 'Period  T = 2πm/|q|B', value: fmt(S.Tc, 3), unit: 's' },
        { label: 'Cyclotron freq.', value: fmt(1 / S.Tc, 3), unit: 'Hz', hint: 'independent of v' },
        { label: 'Helix pitch  v∥T', value: fmt(S.pitchLen * 1000, 3), unit: 'mm' },
        { label: 'Live speed |v|', value: fmt(S.speed || p.v0, 4), unit: 'm/s',
          flag: p.Ey > 0 ? 'warn' : 'ok', hint: p.Ey > 0 ? 'E does work — changes' : 'constant: B does no work' },
        { label: 'Kinetic energy', value: fmt(ke, 3), unit: 'eV' }
      ];
      if (p.Ey > 0) {
        const match = Math.abs(sel - p.v0) / p.v0 < 0.02;
        out.push({ label: 'Selector  v = E/B', value: fmt(sel, 3), unit: 'm/s',
          flag: match ? 'ok' : 'warn', hint: match ? 'matched — goes straight' : 'v₀ ≠ E/B → deflects' });
      }
      return out;
    },

    equation(S) {
      const p = S.p;
      return '<span class="eq-line">' + E.v('F') + '⃗ ' + E.op('=') + ' ' + E.v('q') +
        '( ' + E.v('E') + '⃗ ' + E.op('+') + ' ' + E.v('v') + '⃗ ' + E.op('×') + ' ' + E.v('B') + '⃗ )</span><br>' +
        E.v('r') + ' ' + E.op('=') + ' ' + E.frac(E.v('m') + E.v('v') + '<sub>⊥</sub>', '|' + E.v('q') + '|' + E.v('B')) +
        ' ' + E.op('=') + ' ' + E.frac(
          E.n(S.m, 'kg') + '·' + E.n(S.vperp0, 'm/s'),
          E.n(Math.abs(S.q), 'C') + '·' + E.n(p.B, 'T')) +
        ' ' + E.op('=') + ' ' + E.n(S.rc * 1000, 'mm') +
        '<br>' + E.v('T') + ' ' + E.op('=') + ' ' + E.frac('2π' + E.v('m'), '|' + E.v('q') + '|' + E.v('B')) +
        ' ' + E.op('=') + ' ' + E.n(S.Tc, 's') +
        ' ' + E.op('·') + ' ' + E.v('v') + '<sub>⊥</sub> ' + E.op('=') + ' ' + E.v('v') + '₀ sin' + E.v('θ') +
        ' ' + E.op('=') + ' ' + E.n(S.vperp0, 'm/s');
    },
    eqNote: '<b>Read the period formula carefully.</b> <i>T</i> contains no <i>v</i>. Speed the particle up and it ' +
      'traces a bigger circle in exactly the same time — which is the entire principle the cyclotron is built on.',

    walkthrough: [
      { title: '1 · A force that never does work',
        body: 'Start with a magnetic field only, and velocity perpendicular to it. The force is always at right angles to the velocity, so it bends the path into a circle without ever speeding the particle up.',
        ask: 'The particle accelerates the whole time. Does its kinetic energy increase?',
        reveal: '<b>No.</b> Work = F⃗·d⃗s, and F⃗ ⊥ v⃗ at every instant, so the dot product is zero. Watch the |v| trace on the graph — it is a flat line. Only the <i>direction</i> of velocity changes.',
        params: { pitchDeg: 90, Ey: 0, B: 0.12, v0: 1.2e6, species: 'p' } },
      { title: '2 · Tilt the velocity and you get a helix',
        body: 'Now give the velocity a component along B. The perpendicular part still circles; the parallel part is completely untouched by the magnetic force, so it drifts steadily along the field.',
        ask: 'Which quantity fixes how far the helix advances per turn?',
        reveal: 'The <b>pitch = v∥ · T</b>. Since v∥ = v₀cos θ and T is fixed by m, q and B, tilting the velocity changes the pitch but never the period.',
        params: { pitchDeg: 55, Ey: 0, B: 0.12 } },
      { title: '3 · The radius–field relationship',
        body: 'Push the B slider up and down and watch both the circle and the period readout.',
        ask: 'If you double B, what happens to r, to T, and to the cyclotron frequency?',
        reveal: '<b>r halves, T halves, f doubles.</b> Both r = mv⊥/qB and T = 2πm/qB carry B in the denominator. This is the standard JEE one-liner — and the reason a cyclotron needs a fixed RF frequency.',
        params: { pitchDeg: 90, B: 0.3 } },
      { title: '4 · Same field, different particle',
        body: 'Switch to an electron at the same speed and field. The proton is about 1836 times heavier.',
        ask: 'Which two things change, and in which direction?',
        reveal: 'The electron\'s <b>radius and period both shrink by ~1836×</b> (both ∝ m), and it circles the <b>opposite way</b> because q is negative. This mass dependence is exactly what a mass spectrometer measures.',
        params: { species: 'e', pitchDeg: 90, Ey: 0, B: 0.12 } },
      { title: '5 · Crossed fields — the velocity selector',
        body: 'Add an electric field perpendicular to B. Now there are two competing forces: qE pushing one way and qvB pushing the other.',
        ask: 'Only one particular speed passes through undeflected. What is it?',
        reveal: '<b>v = E/B.</b> Setting qE = qvB gives a speed that is independent of charge and mass — so the selector filters purely on velocity. The preset sets E = v₀B exactly; nudge v₀ away and watch the straight line curve.',
        params: { species: 'p', pitchDeg: 90, B: 0.12, v0: 1.2e6, Ey: 1.2e6 * 0.12 } }
    ],

    notes: '<b>Where this shows up in the paper.</b>' +
      '<ul><li>Ratio questions on r, T and f when B, v, q or m is doubled — nearly free marks once the two formulae are secure.</li>' +
      '<li>Velocity selector and mass spectrometer numericals: combine v = E/B with r = mv/qB to get m/q.</li>' +
      '<li>Helical motion problems asking for pitch — students who forget that v∥ is untouched by B lose these.</li>' +
      '<li>Conceptual statements about magnetic force and work — the flat |v| trace above is the proof.</li></ul>' +
      '<div class="pyq"><em>Trap to avoid</em>The cyclotron period is independent of speed, but a <i>relativistic</i> ' +
      'particle gains mass and falls out of step — the reason synchrocyclotrons exist. JEE Advanced has probed this idea qualitatively.</div>'
  });

  /* =========================================================================
     2 · YOUNG'S DOUBLE SLIT — interference + single-slit envelope
     ========================================================================= */
  function wl2rgb(w) {
    let r, g, b;
    if (w < 440) { r = -(w - 440) / 60; g = 0; b = 1; }
    else if (w < 490) { r = 0; g = (w - 440) / 50; b = 1; }
    else if (w < 510) { r = 0; g = 1; b = -(w - 510) / 20; }
    else if (w < 580) { r = (w - 510) / 70; g = 1; b = 0; }
    else if (w < 645) { r = 1; g = -(w - 645) / 65; b = 0; }
    else { r = 1; g = 0; b = 0; }
    let f = 1;
    if (w < 420) f = 0.35 + 0.65 * (w - 380) / 40;
    else if (w > 700) f = 0.35 + 0.65 * (780 - w) / 80;
    const G = 0.85;
    return [Math.max(0, Math.pow(r * f, G)), Math.max(0, Math.pow(g * f, G)), Math.max(0, Math.pow(b * f, G))];
  }

  // I/I0 at screen position y (metres). Small-angle: sinθ ≈ y/D.
  function ydseI(S, y) {
    const p = S.p, sth = y / Math.sqrt(y * y + p.D * p.D);
    const bq = Math.PI * S.a * sth / S.lam;
    const env = Math.abs(bq) < 1e-9 ? 1 : Math.pow(Math.sin(bq) / bq, 2);
    if (p.mode === 'single') return { I: env, env: env, fringe: 1 };
    const dq = Math.PI * S.d * sth / S.lam;
    const fr = Math.pow(Math.cos(dq), 2);
    return { I: env * fr, env: env, fringe: fr };
  }

  L.register({
    id: 'ydse', subject: 'physics',
    name: "Young's Double Slit — Path Difference to Fringe",
    chapter: 'Wave Optics',
    exams: ['JEE Main', 'JEE Advanced', 'NEET UG'],
    weight: 'High yield',
    is3D: false,
    stageHint: 'The marker P sweeps the screen · every quantity is computed from the real intensity formula',
    lede: 'Two coherent slits, one screen, and a single controlling quantity: the <b>path difference Δ = d sin θ</b>. ' +
      'This lab draws the geometry, counts Δ in whole wavelengths as the point P sweeps the screen, and paints the ' +
      'resulting pattern in the true colour of the chosen wavelength — including the <b>single-slit envelope</b> ' +
      'that kills certain orders outright.',

    params: { lam: 589, d: 0.25, a: 0.08, D: 1.2, mode: 'double', envelope: true, sweep: true, yP: 0 },

    presets: [
      { name: 'Sodium lamp 589 nm', params: { lam: 589, d: 0.25, a: 0.08, D: 1.2, mode: 'double' } },
      { name: 'He–Ne laser 633 nm', params: { lam: 633, d: 0.25, a: 0.08, D: 1.5, mode: 'double' } },
      { name: 'Violet 420 nm', params: { lam: 420, d: 0.25, a: 0.08, D: 1.2, mode: 'double' } },
      { name: 'Missing orders (d = 3a)', params: { lam: 589, d: 0.24, a: 0.08, D: 1.2, mode: 'double', envelope: true } },
      { name: 'Single slit only', params: { mode: 'single', a: 0.08, D: 1.2, lam: 589 } }
    ],

    controls: [
      { group: 'Source', items: [
        { key: 'lam', label: 'Wavelength <i>λ</i>', min: 380, max: 720, step: 1, unit: 'nm', fmt: v => v.toFixed(0) }
      ] },
      { group: 'Apparatus', items: [
        { key: 'mode', type: 'select', label: 'Aperture', options: [
          { value: 'double', label: 'Double slit' }, { value: 'single', label: 'Single slit' }] },
        { key: 'd', label: 'Slit separation <i>d</i>', min: 0.06, max: 0.8, step: 0.005, unit: 'mm', fmt: v => v.toFixed(3) },
        { key: 'a', label: 'Slit width <i>a</i>', min: 0.02, max: 0.30, step: 0.002, unit: 'mm', fmt: v => v.toFixed(3) },
        { key: 'D', label: 'Screen distance <i>D</i>', min: 0.4, max: 3.0, step: 0.02, unit: 'm', fmt: v => v.toFixed(2) }
      ] },
      { group: 'Display', items: [
        { key: 'envelope', type: 'toggle', label: 'Show diffraction envelope' },
        { key: 'sweep', type: 'toggle', label: 'Sweep the point P' }
      ] }
    ],

    setup(S) {
      const p = S.p;
      if (p.a >= p.d) p.a = Math.max(0.02, p.d * 0.4);
      S.lam = p.lam * 1e-9; S.d = p.d * 1e-3; S.a = p.a * 1e-3;
      S.beta = S.lam * p.D / S.d;                 // fringe width (m)
      S.env1 = S.lam * p.D / S.a;                 // first envelope minimum (m)
      S.yRange = p.mode === 'single'
        ? Math.max(2.6 * S.env1, 4e-3)
        : Math.max(5 * S.beta, 1.5 * S.env1);
      S.rgb = wl2rgb(p.lam);
      S.phase = S.phase || 0;
    },

    step(S, dt) {
      if (S.p.sweep) {
        S.phase += dt * 0.28;
        S.p.yP = Math.sin(S.phase * TAU) * S.yRange * 0.82;
      }
    },

    drawStage(S, g) {
      const ctx = g.ctx, th = g.theme, p = S.p, W = g.w, H = g.h;
      const rgb = S.rgb;
      const col = (i, a) => 'rgba(' + Math.round(255 * rgb[0] * i) + ',' + Math.round(255 * rgb[1] * i) +
        ',' + Math.round(255 * rgb[2] * i) + ',' + (a == null ? 1 : a) + ')';
      const pure = 'rgb(' + Math.round(255 * rgb[0]) + ',' + Math.round(255 * rgb[1]) + ',' + Math.round(255 * rgb[2]) + ')';

      const padT = 26, padB = 34;
      const cy = (padT + (H - padB)) / 2;
      const xSrc = W * 0.07, xSlit = W * 0.26, xScr = W * 0.84, wScr = Math.max(16, W * 0.055);
      const halfH = (H - padT - padB) / 2;

      // ---- screen fringe pattern (true colour, true intensity) ----
      const yTop = cy - halfH, yBot = cy + halfH;
      for (let py = 0; py <= yBot - yTop; py++) {
        const yy = (py / (yBot - yTop) - 0.5) * 2 * S.yRange;
        const I = ydseI(S, yy).I;
        ctx.fillStyle = col(Math.pow(I, 0.75));
        ctx.fillRect(xScr, yTop + py, wScr, 1.2);
      }
      ctx.strokeStyle = g.alpha(th.line, 1); ctx.lineWidth = 1;
      ctx.strokeRect(xScr + .5, yTop + .5, wScr, yBot - yTop);

      // screen ruler
      ctx.font = '9px "IBM Plex Mono",monospace'; ctx.fillStyle = th['text-3'];
      ctx.textAlign = 'left'; ctx.textBaseline = 'middle';
      const tickStep = S.yRange > 6e-3 ? 2e-3 : 1e-3;
      for (let t = -Math.floor(S.yRange / tickStep) * tickStep; t <= S.yRange; t += tickStep) {
        const yy = cy + (t / S.yRange) * halfH;
        ctx.strokeStyle = g.alpha(th['text-3'], .55);
        ctx.beginPath(); ctx.moveTo(xScr + wScr, yy); ctx.lineTo(xScr + wScr + 4, yy); ctx.stroke();
        if (Math.abs(t) < 1e-9 || Math.abs(t / tickStep) % 2 < 0.01)
          ctx.fillText((t * 1000).toFixed(0), xScr + wScr + 7, yy);
      }
      ctx.textAlign = 'center'; ctx.textBaseline = 'top';
      ctx.fillStyle = th['text-2'];
      ctx.fillText('screen (mm)', xScr + wScr / 2, yBot + 8);

      // ---- optical axis with a scale break ----
      ctx.save(); ctx.setLineDash([5, 5]); ctx.strokeStyle = g.alpha(th['text-3'], .55); ctx.lineWidth = 1;
      ctx.beginPath(); ctx.moveTo(xSrc, cy); ctx.lineTo(xScr, cy); ctx.stroke(); ctx.restore();
      const xb = (xSlit + xScr) / 2;
      ctx.strokeStyle = th['ink-950']; ctx.lineWidth = 7;
      ctx.beginPath(); ctx.moveTo(xb - 5, cy); ctx.lineTo(xb + 5, cy); ctx.stroke();
      ctx.strokeStyle = g.alpha(th['text-3'], .9); ctx.lineWidth = 1.4;
      ctx.beginPath();
      ctx.moveTo(xb - 6, cy + 6); ctx.lineTo(xb - 1, cy - 6);
      ctx.moveTo(xb + 1, cy + 6); ctx.lineTo(xb + 6, cy - 6);
      ctx.stroke();
      ctx.font = '9px "IBM Plex Mono",monospace'; ctx.fillStyle = th['text-3'];
      ctx.textAlign = 'center'; ctx.textBaseline = 'top';
      ctx.fillText('D = ' + p.D.toFixed(2) + ' m  (not to scale)', xb, cy + 10);

      // ---- source ----
      ctx.save(); ctx.globalCompositeOperation = 'lighter';
      const rg = ctx.createRadialGradient(xSrc, cy, 0, xSrc, cy, 26);
      rg.addColorStop(0, col(1, .85)); rg.addColorStop(1, col(1, 0));
      ctx.fillStyle = rg; ctx.beginPath(); ctx.arc(xSrc, cy, 26, 0, TAU); ctx.fill();
      ctx.restore();
      ctx.fillStyle = pure; ctx.beginPath(); ctx.arc(xSrc, cy, 4, 0, TAU); ctx.fill();
      ctx.font = '500 10px "IBM Plex Mono",monospace'; ctx.fillStyle = th['text-2'];
      ctx.textAlign = 'center'; ctx.textBaseline = 'bottom';
      ctx.fillText(p.lam.toFixed(0) + ' nm', xSrc, cy - 16);

      // ---- barrier + slits (separation drawn magnified) ----
      const sGap = Math.min(halfH * 0.55, 46);
      const y1 = p.mode === 'single' ? cy : cy - sGap / 2;
      const y2 = p.mode === 'single' ? cy : cy + sGap / 2;
      const slitH = Math.max(4, sGap * (p.a / p.d) * 0.9);
      ctx.fillStyle = th['ink-700'];
      ctx.fillRect(xSlit - 4, yTop - 6, 8, (y1 - slitH / 2) - (yTop - 6));
      if (p.mode === 'double') ctx.fillRect(xSlit - 4, y1 + slitH / 2, 8, (y2 - slitH / 2) - (y1 + slitH / 2));
      ctx.fillRect(xSlit - 4, y2 + slitH / 2, 8, (yBot + 6) - (y2 + slitH / 2));
      ctx.strokeStyle = g.alpha(th.line, 1); ctx.lineWidth = 1;
      ctx.strokeRect(xSlit - 4.5, yTop - 6.5, 9, (yBot + 6) - (yTop - 6) + 1);

      // slit separation annotation
      if (p.mode === 'double') {
        ctx.strokeStyle = g.alpha(th['text-2'], .85); ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(xSlit - 22, y1); ctx.lineTo(xSlit - 10, y1);
        ctx.moveTo(xSlit - 22, y2); ctx.lineTo(xSlit - 10, y2);
        ctx.moveTo(xSlit - 16, y1); ctx.lineTo(xSlit - 16, y2);
        ctx.stroke();
        ctx.save(); ctx.translate(xSlit - 22, (y1 + y2) / 2); ctx.rotate(-Math.PI / 2);
        ctx.font = '500 10px "IBM Plex Mono",monospace'; ctx.fillStyle = th['text-2'];
        ctx.textAlign = 'center'; ctx.textBaseline = 'bottom';
        ctx.fillText('d = ' + p.d.toFixed(3) + ' mm', 0, 0); ctx.restore();
      }

      // ---- point P and the two rays ----
      const yPs = cy + (p.yP / S.yRange) * halfH;
      const res = ydseI(S, p.yP);
      const sth = p.yP / Math.sqrt(p.yP * p.yP + p.D * p.D);
      const delta = p.mode === 'double' ? S.d * sth : S.a * sth;
      const nLam = delta / S.lam;

      ctx.save();
      ctx.lineWidth = 1.6;
      ctx.globalCompositeOperation = 'lighter';
      [[y1, 0], [y2, 1]].forEach(([ys], idx) => {
        if (p.mode === 'single' && idx === 1) return;
        ctx.strokeStyle = col(0.85, 0.55);
        ctx.beginPath(); ctx.moveTo(xSlit + 4, ys); ctx.lineTo(xScr, yPs); ctx.stroke();
      });
      ctx.restore();

      // slit glow
      [[y1], [y2]].forEach(([ys], idx) => {
        if (p.mode === 'single' && idx === 1) return;
        ctx.save(); ctx.globalCompositeOperation = 'lighter';
        const gg = ctx.createRadialGradient(xSlit, ys, 0, xSlit, ys, 13);
        gg.addColorStop(0, col(1, .9)); gg.addColorStop(1, col(1, 0));
        ctx.fillStyle = gg; ctx.beginPath(); ctx.arc(xSlit, ys, 13, 0, TAU); ctx.fill(); ctx.restore();
      });
      if (p.mode === 'double') {
        ctx.font = '500 9px "IBM Plex Mono",monospace'; ctx.fillStyle = th['text-3'];
        ctx.textAlign = 'right'; ctx.textBaseline = 'middle';
        ctx.fillText('S₁', xSlit - 26, y1); ctx.fillText('S₂', xSlit - 26, y2);
      }

      // P marker
      ctx.strokeStyle = th.text; ctx.lineWidth = 1.5;
      ctx.beginPath(); ctx.arc(xScr, yPs, 5, 0, TAU); ctx.stroke();
      ctx.font = '600 10px "IBM Plex Mono",monospace'; ctx.fillStyle = th.text;
      ctx.textAlign = 'right'; ctx.textBaseline = 'bottom';
      ctx.fillText('P  y = ' + (p.yP * 1000).toFixed(2) + ' mm', xScr - 9, yPs - 5);

      // ---- path-difference meter ----
      const mx = 14, my = H - 46, mw = Math.min(290, W * 0.42);
      ctx.font = '500 10px "IBM Plex Mono",monospace';
      ctx.textAlign = 'left'; ctx.textBaseline = 'bottom';
      ctx.fillStyle = th['text-2'];
      const dLabel = p.mode === 'double' ? 'Δ = d sin θ = ' : 'Δ = a sin θ = ';
      ctx.fillText(dLabel + fmt(delta * 1e9, 3) + ' nm  =  ' + nLam.toFixed(2) + ' λ', mx, my - 12);

      const frac = Math.abs(nLam) % 1;
      const bright = p.mode === 'double' ? (frac < 0.12 || frac > 0.88) : false;
      const dark = p.mode === 'double' ? Math.abs(frac - 0.5) < 0.12 : false;
      // λ ruler
      const cells = 6;
      for (let i = 0; i < cells; i++) {
        const x = mx + i * (mw / cells);
        ctx.fillStyle = g.alpha(th['text-3'], i % 2 ? .12 : .28);
        ctx.fillRect(x, my - 8, mw / cells - 1.5, 7);
      }
      const fill = clamp(Math.abs(nLam) / cells, 0, 1);
      ctx.fillStyle = col(1, .92);
      ctx.fillRect(mx, my - 8, mw * fill, 7);
      ctx.fillStyle = th['text-3']; ctx.font = '9px "IBM Plex Mono",monospace';
      ctx.textBaseline = 'top';
      for (let i = 0; i <= cells; i++) ctx.fillText(i + 'λ', mx + i * (mw / cells) - 3, my + 2);

      // verdict chip
      const vx = mx + mw + 14;
      if (p.mode === 'double') {
        const label = bright ? 'CONSTRUCTIVE → bright' : dark ? 'DESTRUCTIVE → dark' : 'partial';
        const cc = bright ? th.ok : dark ? th.crit : th['text-3'];
        ctx.fillStyle = g.alpha(cc, .16);
        const tw = ctx.measureText(label).width + 18;
        ctx.fillRect(vx, my - 12, tw, 15);
        ctx.fillStyle = cc; ctx.font = '500 10px "IBM Plex Mono",monospace';
        ctx.textBaseline = 'middle'; ctx.fillText(label, vx + 9, my - 4.5);
      }

      // intensity readout at P
      ctx.textAlign = 'right'; ctx.textBaseline = 'top'; ctx.font = '500 10px "IBM Plex Mono",monospace';
      ctx.fillStyle = th['text-2'];
      ctx.fillText('I/I₀ at P = ' + res.I.toFixed(3), W - 12, 12);
      if (p.mode === 'double' && p.envelope) {
        ctx.fillStyle = th['text-3'];
        ctx.fillText('envelope = ' + res.env.toFixed(3), W - 12, 26);
      }
    },

    plotTitle: 'Intensity along the screen',
    legend: [{ c: '#3DD6F5', label: 'I / I₀ (observed)' }, { c: '#63729A', label: 'single-slit envelope' }],
    drawPlot(S, g) {
      const p = S.p, N = 420;
      const pts = [], env = [];
      for (let i = 0; i <= N; i++) {
        const y = (i / N - 0.5) * 2 * S.yRange;
        const r = ydseI(S, y);
        pts.push([y * 1000, r.I]); env.push([y * 1000, r.env]);
      }
      const P = g.Plot({
        xmin: -S.yRange * 1000, xmax: S.yRange * 1000, ymin: 0, ymax: 1.08,
        xlabel: 'y on screen (mm)', ylabel: 'I / I₀',
        xfmt: v => v.toFixed(1), yfmt: v => v.toFixed(1)
      }).frame();
      P.clip(() => {
        if (p.envelope && p.mode === 'double') {
          P.area(env, 0, g.alpha(g.theme['text-3'], .14));
          P.line(env, g.alpha(g.theme['text-3'], .95), 1.5, [4, 3]);
        }
        P.area(pts, 0, g.alpha(g.theme.phys, .16));
        P.line(pts, g.theme.phys, 2);
        P.vline(p.yP * 1000, g.alpha(g.theme.text, .55), [3, 3]);
        P.dot(p.yP * 1000, ydseI(S, p.yP).I, 4, g.theme.text, g.theme['ink-950']);
      });
      if (p.mode === 'double') {
        P.tag(S.beta * 1000, 1.0, 'β = ' + (S.beta * 1000).toFixed(2) + ' mm', g.theme['text-2'], 'left', 0);
      }
    },

    readouts(S) {
      const p = S.p;
      const ratio = p.d / p.a;
      const miss = Math.abs(ratio - Math.round(ratio)) < 0.04 && Math.round(ratio) >= 2;
      const out = [
        { label: 'Fringe width β = λD/d', value: (S.beta * 1000).toFixed(3), unit: 'mm', flag: 'accent' },
        { label: 'Angular width λ/d', value: fmt(S.lam / S.d * 1000, 3), unit: 'mrad' },
        { label: '1st envelope min λD/a', value: (S.env1 * 1000).toFixed(2), unit: 'mm' },
        { label: 'Fringes in central max', value: (2 * ratio).toFixed(1), unit: '', hint: '= 2d/a' },
        { label: 'Order at P', value: (S.d * (p.yP / Math.sqrt(p.yP * p.yP + p.D * p.D)) / S.lam).toFixed(2),
          unit: 'λ', flag: 'accent' }
      ];
      out.push(miss
        ? { label: 'Missing orders', value: '±' + Math.round(ratio) + ', ±' + 2 * Math.round(ratio),
            unit: '', flag: 'crit', hint: 'd/a = ' + ratio.toFixed(2) + ' is a whole number' }
        : { label: 'Missing orders', value: 'none', unit: '', hint: 'd/a = ' + ratio.toFixed(2) + ' not integral' });
      return out;
    },

    equation(S) {
      const p = S.p;
      if (p.mode === 'single') {
        return E.frac(E.v('I'), E.v('I') + '₀') + ' ' + E.op('=') + ' ' +
          E.frac('sin<sup>2</sup>' + E.v('β'), E.v('β') + '<sup>2</sup>') + E.op(',') + ' ' +
          E.v('β') + ' ' + E.op('=') + ' ' + E.frac('π' + E.v('a') + ' sin' + E.v('θ'), E.v('λ')) +
          '<br>minima at ' + E.v('a') + ' sin' + E.v('θ') + ' ' + E.op('=') + ' ' + E.v('n') + E.v('λ') +
          E.op('→') + ' first min at ' + E.v('y') + ' ' + E.op('=') + ' ' +
          E.frac(E.v('λ') + E.v('D'), E.v('a')) + ' ' + E.op('=') + ' ' + E.n(S.env1 * 1000, 'mm');
      }
      return E.v('Δ') + ' ' + E.op('=') + ' ' + E.v('d') + ' sin' + E.v('θ') + ' ' + E.op('≈') + ' ' +
        E.frac(E.v('d') + E.v('y'), E.v('D')) + E.op('·') + ' bright when ' + E.v('Δ') + ' ' + E.op('=') + ' ' +
        E.v('n') + E.v('λ') +
        '<br>' + E.v('β') + ' ' + E.op('=') + ' ' + E.frac(E.v('λ') + E.v('D'), E.v('d')) + ' ' + E.op('=') + ' ' +
        E.frac(E.n(p.lam, 'nm') + '·' + E.n(p.D, 'm'), E.n(p.d, 'mm')) + ' ' + E.op('=') + ' ' +
        E.n(S.beta * 1000, 'mm') +
        '<br>' + E.frac(E.v('I'), E.v('I') + '₀') + ' ' + E.op('=') + ' 4cos<sup>2</sup>' +
        '(' + E.frac('π' + E.v('d') + ' sin' + E.v('θ'), E.v('λ')) + ')' + E.op('·') +
        E.frac('sin<sup>2</sup>' + E.v('β'), E.v('β') + '<sup>2</sup>');
    },
    eqNote: '<b>The envelope is the part students forget.</b> The cos² term alone predicts equally bright fringes ' +
      'forever. The real pattern is that cos² multiplied by the single-slit sinc² — which is why outer fringes fade, ' +
      'and why an order vanishes completely whenever <i>d</i>/<i>a</i> is a whole number.',

    walkthrough: [
      { title: '1 · Everything follows from Δ',
        body: 'Watch the marker P sweep the screen and keep your eye on the λ-ruler at the bottom. It counts the path difference in whole wavelengths.',
        ask: 'What has to be true about Δ for P to sit on a bright fringe?',
        reveal: '<b>Δ must be a whole number of wavelengths</b> (Δ = nλ), so the two waves arrive in phase. Half-integer values (Δ = (n+½)λ) put them exactly out of step and you get darkness. The chip beside the ruler confirms it live.',
        params: { lam: 589, d: 0.25, a: 0.08, D: 1.2, mode: 'double', sweep: true } },
      { title: '2 · Change the colour',
        body: 'Drag λ from violet to red and watch the fringes on the screen and the β readout.',
        ask: 'Red light has a longer wavelength. Do the fringes get wider or narrower?',
        reveal: '<b>Wider.</b> β = λD/d is directly proportional to λ. Violet packs fringes closest together — which is why a white-light source shows violet nearest the centre of each order and red furthest out.',
        params: { lam: 680, d: 0.25, a: 0.08, D: 1.2, mode: 'double' } },
      { title: '3 · Move the slits apart',
        body: 'Now hold λ fixed and increase d.',
        ask: 'Bringing the slits further apart — does the pattern spread out or crowd together?',
        reveal: '<b>It crowds together.</b> d is in the denominator of β = λD/d. This catches people out because "bigger separation" intuitively sounds like "bigger pattern". The geometry says otherwise: a larger d reaches the same path difference at a smaller angle.',
        params: { lam: 589, d: 0.55, a: 0.08, D: 1.2, mode: 'double' } },
      { title: '4 · The single slit alone',
        body: 'Switch the aperture to a single slit. The cos² interference term disappears and only the diffraction envelope is left.',
        ask: 'Where is the first minimum of a single-slit pattern?',
        reveal: 'At <b>a sin θ = λ</b>, i.e. y = λD/a. Note the central maximum is <b>twice</b> as wide as the others, and far brighter — a standard one-mark distinction between interference and diffraction.',
        params: { mode: 'single', a: 0.08, D: 1.2, lam: 589 } },
      { title: '5 · Missing orders',
        body: 'Back to two slits, with d set to exactly three times a. Look carefully at the fringe pattern and the graph.',
        ask: 'Some bright fringes have vanished. Which ones, and why?',
        reveal: 'Orders <b>n = ±3, ±6, …</b> are missing. Where d/a = 3, the interference maximum for n = 3 falls exactly on a zero of the diffraction envelope, and anything multiplied by zero is zero. In general the missing orders are n = m·(d/a).',
        params: { lam: 589, d: 0.24, a: 0.08, D: 1.2, mode: 'double', envelope: true } }
    ],

    notes: '<b>Where this shows up in the paper.</b>' +
      '<ul><li>Direct β = λD/d substitution — guaranteed marks, both exams.</li>' +
      '<li>"Apparatus is immersed in water" — λ becomes λ/μ, so every fringe narrows by μ. Set λ lower here to see it.</li>' +
      '<li>Missing-order questions, which need both formulae held at once.</li>' +
      '<li>Distinguishing interference from diffraction: equal vs unequal fringe brightness, and the double-width central maximum.</li></ul>' +
      '<div class="pyq"><em>Trap to avoid</em>Intensity, not amplitude, is what you see. Two coherent sources of intensity ' +
      'I₀ each give <b>4I₀</b> at a maximum, not 2I₀ — amplitudes add, and intensity goes as amplitude squared.</div>'
  });

})(window.InsightLab);
