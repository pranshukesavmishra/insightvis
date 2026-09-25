/* ============================================================
   PHYSICS (syllabus core, batch 5 — rotation)
     23. Rigid-body dynamics — moment of inertia summed element by
         element, the hinge, the ladder, the struck rod, angular
         momentum, and the gyroscope
     24. Rolling and friction — the instantaneous axis, spin and
         slip, the spool and the yo-yo, the plank, toppling
   ============================================================ */
(function (L) {
  'use strict';
  const { clamp, TAU, E, Camera } = L;
  const PA = window.PHYSART, R3 = window.R3, RX = window.RX;
  const G = 9.81;
  function rng(seed) {
    let a = seed >>> 0;
    return () => { a = (a + 0x6D2B79F5) >>> 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
  }
  const TSTOP = ['#2B4CFF', '#29C4F5', '#8FE36A', '#FFD34A', '#FF7A2B', '#E0283F'];
  function tcol(T, lo, hi) {
    const f = clamp((T - lo) / (hi - lo), 0, 1) * (TSTOP.length - 1), i = Math.min(TSTOP.length - 2, Math.floor(f));
    return RX.mix(TSTOP[i], TSTOP[i + 1], f - i);
  }
  function tfmt(s) { const a = Math.abs(s); return a < 120 ? s.toFixed(a < 10 ? 2 : 1) + ' s' : (s / 60).toFixed(2) + ' min'; }
  // RK4 for a state vector
  function rk4(f, y, t, h) {
    const k1 = f(t, y), y2 = y.map((v, i) => v + h / 2 * k1[i]), k2 = f(t + h / 2, y2), y3 = y.map((v, i) => v + h / 2 * k2[i]),
          k3 = f(t + h / 2, y3), y4 = y.map((v, i) => v + h * k3[i]), k4 = f(t + h, y4);
    return y.map((v, i) => v + h / 6 * (k1[i] + 2 * k2[i] + 2 * k3[i] + k4[i]));
  }
  // solve a small dense linear system (Gaussian elimination with pivoting)
  function solve(A, b) {
    const n = b.length, M = A.map((r, i) => r.concat([b[i]]));
    for (let c = 0; c < n; c++) {
      let p = c; for (let r = c + 1; r < n; r++) if (Math.abs(M[r][c]) > Math.abs(M[p][c])) p = r;
      [M[c], M[p]] = [M[p], M[c]];
      for (let r = c + 1; r < n; r++) { const f = M[r][c] / M[c][c]; for (let k = c; k <= n; k++) M[r][k] -= f * M[c][k]; }
    }
    const x = new Array(n).fill(0);
    for (let r = n - 1; r >= 0; r--) { let s = M[r][n]; for (let k = r + 1; k < n; k++) s -= M[r][k] * x[k]; x[r] = s / M[r][r]; }
    return x;
  }

  /* =========================================================================
     23 · RIGID-BODY DYNAMICS

     · Moment of inertia is SUMMED: the body is built from thousands of equal
       mass elements and I = Σ m r⊥² is added up about whatever axis you set,
       through the centre or offset from it. The parallel- and perpendicular-
       axis theorems are then checks on numbers already on the screen. A
       falling weight on the axle spins it up, and I is measured back from
       the fall time, as in the lab.
     · A rod on a hinge, released: θ is integrated, and the hinge force is
       m·a_cm − m·g at every instant — mg/4 at release, 5mg/2 at the bottom.
     · A ladder between a frictionless wall and a floor with or without
       friction: Newton's laws for the rod are solved as a linear system each
       step, including the normal reactions, so the moment it leaves the wall
       is found, not assumed.
     · A rod struck by a ball, free on ice or hinged at one end: the impulse
       equations with restitution e, then the motion that follows. The point
       at rest (the instantaneous axis) and the centre of percussion are read
       off the result.
     · Angular momentum: a student pulling in dumbbells, a disc dropped on a
       spinning disc with friction between them, a bead sliding out along a
       free rotating rod.
     · A heavy symmetric top / gyroscope: the full Euler–Lagrange equations,
       so nutation and precession both appear, and the precession rate is
       measured against mgd/(I₃ω₃).
     ========================================================================= */

  /* ---- moment of inertia by summation ---- */
  const BODIES = {
    rod:    { name: 'thin rod', lam: false },
    plate:  { name: 'rectangular plate', lam: true },
    disc:   { name: 'disc (lamina)', lam: true },
    ring:   { name: 'ring', lam: true },
    sphere: { name: 'solid sphere', lam: false },
    shell:  { name: 'spherical shell', lam: false },
    cyl:    { name: 'solid cylinder', lam: false },
    cone:   { name: 'solid cone', lam: false },
    cube:   { name: 'solid cube', lam: false }
  };
  const PTS = {};
  function bodyPts(b) {
    if (PTS[b]) return PTS[b];
    const P = [];
    const GA = Math.PI * (3 - Math.sqrt(5));
    if (b === 'rod') for (let i = 0; i < 801; i++) P.push([-0.5 + i / 800, 0, 0]);
    else if (b === 'plate') for (let i = 0; i < 80; i++) for (let j = 0; j < 50; j++) P.push([(-0.5 + (i + 0.5) / 80) * 1.0, (-0.5 + (j + 0.5) / 50) * 0.6, 0]);
    else if (b === 'disc') for (let i = 0; i < 4000; i++) { const r = 0.5 * Math.sqrt((i + 0.5) / 4000), a = i * GA; P.push([r * Math.cos(a), r * Math.sin(a), 0]); }
    else if (b === 'ring') for (let i = 0; i < 720; i++) { const a = i / 720 * TAU; P.push([0.5 * Math.cos(a), 0.5 * Math.sin(a), 0]); }
    else if (b === 'shell') for (let i = 0; i < 4000; i++) { const z = 1 - 2 * (i + 0.5) / 4000, s = Math.sqrt(1 - z * z), a = i * GA; P.push([0.5 * s * Math.cos(a), 0.5 * s * Math.sin(a), 0.5 * z]); }
    else if (b === 'sphere' || b === 'cube' || b === 'cyl' || b === 'cone') {
      const n = 34;
      for (let i = 0; i < n; i++) for (let j = 0; j < n; j++) for (let k = 0; k < n; k++) {
        const x = -0.5 + (i + 0.5) / n, y = -0.5 + (j + 0.5) / n, z = -0.5 + (k + 0.5) / n;
        if (b === 'sphere' && x * x + y * y + z * z > 0.25) continue;
        if (b === 'cyl' && x * x + y * y > 0.25) continue;                                   // R = 0.5, h = 1
        if (b === 'cone') { const rz = 0.5 * (0.5 - z); if (x * x + y * y > rz * rz) continue; }   // base at z = −0.5, apex at +0.5
        P.push([x, y, z]);
      }
    }
    // shift to the centre of mass
    const c = P.reduce((u, q) => [u[0] + q[0] / P.length, u[1] + q[1] / P.length, u[2] + q[2] / P.length], [0, 0, 0]);
    P.forEach(q => { q[0] -= c[0]; q[1] -= c[1]; q[2] -= c[2]; });
    return (PTS[b] = P);
  }
  // the standard results, about principal axes through the CM, per unit M, for the unit-sized body
  function tensorF(b) {
    switch (b) {
      case 'rod': return [0, 1 / 12, 1 / 12];
      case 'plate': return [0.36 / 12, 1 / 12, 1.36 / 12];
      case 'disc': return [0.25 / 4, 0.25 / 4, 0.25 / 2];
      case 'ring': return [0.25 / 2, 0.25 / 2, 0.25];
      case 'sphere': return [0.4 * 0.25, 0.4 * 0.25, 0.4 * 0.25];
      case 'shell': return [2 / 3 * 0.25, 2 / 3 * 0.25, 2 / 3 * 0.25];
      case 'cyl': return [(3 * 0.25 + 1) / 12, (3 * 0.25 + 1) / 12, 0.25 / 2];
      case 'cone': return [3 / 80 * (4 * 0.25 + 1), 3 / 80 * (4 * 0.25 + 1), 0.3 * 0.25];
      case 'cube': return [1 / 6, 1 / 6, 1 / 6];
    }
  }
  const AXES = { x: [1, 0, 0], y: [0, 1, 0], z: [0, 0, 1], diag: [1, 1, 1], dxy: [1, 1, 0] };
  function runMoI(p) {
    const P = bodyPts(p.body), M = p.Mkg, s = p.size, u0 = AXES[p.ax], ul = Math.hypot(...u0), u = u0.map(v => v / ul);
    // the axis passes through the point offset d from the CM, along a direction perpendicular to u
    const perp = Math.abs(u[2]) < 0.9 ? [u[1], -u[0], 0] : [1, 0, 0], pl = Math.hypot(...perp), w = perp.map(v => v / pl), d = p.off;
    const A = w.map(v => v * d);
    const m = M / P.length;
    let I = 0, Icm = 0;
    P.forEach(q => {
      const r = [q[0] * s - A[0], q[1] * s - A[1], q[2] * s - A[2]], rc = [q[0] * s, q[1] * s, q[2] * s];
      const dp = r[0] * u[0] + r[1] * u[1] + r[2] * u[2], dc = rc[0] * u[0] + rc[1] * u[1] + rc[2] * u[2];
      I += m * (r[0] * r[0] + r[1] * r[1] + r[2] * r[2] - dp * dp);
      Icm += m * (rc[0] * rc[0] + rc[1] * rc[1] + rc[2] * rc[2] - dc * dc);
    });
    // the same sums about the three body axes, for the perpendicular-axis check
    const Iax = [0, 1, 2].map(k => P.reduce((acc, q) => acc + m * s * s * (q[0] * q[0] + q[1] * q[1] + q[2] * q[2] - q[k] * q[k]), 0));
    const T = tensorF(p.body), If = M * s * s * (T[0] * u[0] * u[0] + T[1] * u[1] * u[1] + T[2] * u[2] * u[2]);
    // the flywheel experiment: a mass on a string round an axle of radius r, falling h
    const mh = p.mhang, r = p.raxle / 100, h = 1.0, fr = p.fric;
    const acc = (mh * G * r - fr) / (I + mh * r * r) * r;
    let tFall = NaN, pts = [];
    if (acc > 0) {
      // integrate the fall (so friction and everything else enter the same way a stopwatch sees them)
      let y = [0, 0], t = 0; const dt = 0.002;
      while (y[0] < h && t < 60) { pts.push([t, y[0], y[1] / r]); y = rk4((tt, v) => [v[1], acc], y, t, dt); t += dt; }
      tFall = t - dt + (h - pts[pts.length - 1][1]) / Math.max(1e-9, y[1]) ;
    }
    const Imeas = isFinite(tFall) ? mh * r * r * (G * tFall * tFall / (2 * h) - 1) : NaN;
    // I summed at a sweep of offsets, for the parallel-axis plot
    const curve = [];
    for (let k = -5; k <= 5; k++) { const dd = k / 5 * s, Ak = w.map(v => v * dd); let Ik = 0;
      P.forEach(q => { const r = [q[0] * s - Ak[0], q[1] * s - Ak[1], q[2] * s - Ak[2]], dp = r[0] * u[0] + r[1] * u[1] + r[2] * u[2]; Ik += m * (r[0] * r[0] + r[1] * r[1] + r[2] * r[2] - dp * dp); });
      curve.push([dd, Ik]); }
    return { P, M, s, u, A, d, I, Icm, Iax, If, IfPar: If + M * d * d, curve, k: Math.sqrt(I / M), tFall, Imeas, acc, pts, h, mh, r, lam: BODIES[p.body].lam };
  }

  /* ---- a rod on a hinge ---- */
  function runHinge(p) {
    const Lr = p.Lrod, m = p.mrod, a = p.piv * Lr, mE = p.mend, dE = Lr / 2 + (Lr / 2 - a) * 0 + 0;   // pivot a from the CM (towards one end)
    // CM of rod + end mass (end mass at the far end, distance Lr/2 + a from the pivot)
    const Icm = m * Lr * Lr / 12, dEnd = Lr / 2 + a;
    const Ip = Icm + m * a * a + mE * dEnd * dEnd, Mt = m + mE, dcm = (m * a + mE * dEnd) / Mt;
    const th0 = p.th0 * Math.PI / 180;
    const f = (t, y) => [y[1], -Mt * G * dcm * Math.sin(y[0]) / Ip];
    let y = [th0, 0], t = 0; const dt = 0.001, out = [];
    let per = NaN, lastCross = null, crosses = 0, tEnd = 8;
    while (t < tEnd) {
      const th = y[0], w = y[1], al = f(t, y)[1];
      // the CM moves on a circle of radius dcm: a_radial = ω² dcm toward the pivot, a_tangential = α dcm
      // forces along the rod (toward the pivot, "R") and across it ("T"): N − Mg = M a
      const Nr = Mt * w * w * dcm + Mt * G * Math.cos(th), Nt = Mt * al * dcm + Mt * G * Math.sin(th);
      if (out.length === 0 || t - out[out.length - 1][0] >= 0.01) out.push([t, th, w, Nr, Nt, Math.hypot(Nr, Nt)]);
      const y2 = rk4(f, y, t, dt);
      if (y[1] > 0 && y2[1] <= 0) { const tc = t + dt * y[1] / (y[1] - y2[1]); if (lastCross !== null) { per = tc - lastCross; } lastCross = tc; crosses++; }
      y = y2; t += dt;
    }
    const o0 = out[0], iB = out.reduce((bi, q, i) => Math.abs(q[1]) < Math.abs(out[bi][1]) ? i : bi, 0);
    const TsmallF = TAU * Math.sqrt(Ip / (Mt * G * dcm));
    return { Lr, m, a, mE, Ip, Mt, dcm, out, per, TsmallF, Nrel: Math.hypot(o0[3], o0[4]), Nbot: out[iB][5], kg: Math.sqrt(Icm / m), tEnd,
             at: tt => out[Math.min(out.length - 1, Math.max(0, Math.round(tt / 0.01)))] };
  }

  /* ---- the ladder ---- */
  function runLadder(p) {
    const Ll = p.Llad, m = p.mlad, I = m * Ll * Ll / 12, mu = p.muf, h = Ll / 2, th0 = p.lth0 * Math.PI / 180;
    // static check first: can friction hold it? (frictionless wall) tan θ ≤ 2μ
    const holds = Math.tan(th0) <= 2 * mu;
    // state: x (CM), θ (from the wall), vx, ω ; phase 1 while N_wall > 0
    let x = h * Math.sin(th0), th = th0, vx = 0, w = 0, t = 0, onWall = true, tLeave = NaN, thLeave = NaN;
    const out = [], dt = 0.0005;
    const acc = (x, th, vx, w, wall) => {
      const s = Math.sin(th), c = Math.cos(th), vb = vx + h * c * w;      // bottom point moves at x_b' = x' + h cosθ θ'
      const sg = Math.abs(vb) > 1e-6 ? Math.sign(vb) : 1;
      if (wall) {
        // unknowns θ'', Nw, Nf ; x'' = h(cosθ θ'' − sinθ θ'²), y'' = h(−sinθ θ'' − cosθ θ'²)
        // m x'' = Nw − μNf·sg ; m y'' = Nf − mg ; I θ'' = −h cosθ Nw + h sinθ Nf − h cosθ(−μNf sg)·(−1)
        const A = [[m * h * c, -1, mu * sg], [-m * h * s, 0, -1], [I, h * c, -h * s + h * c * mu * sg]];
        const b = [m * h * s * w * w, m * h * c * w * w - m * G, 0];
        const r = solve(A, b);
        return { thdd: r[0], xdd: h * (c * r[0] - s * w * w), Nw: r[1], Nf: r[2] };
      }
      // off the wall: unknowns x'', θ'', Nf
      const A = [[m, 0, mu * sg], [0, -m * h * s, -1], [0, I, -h * s + h * c * mu * sg]];
      const b = [0, m * h * c * w * w - m * G, 0];
      const r = solve(A, b);
      return { thdd: r[1], xdd: r[0], Nw: 0, Nf: r[2] };
    };
    if (!holds) {
      while (t < 6 && th < Math.PI / 2) {
        const a = acc(x, th, vx, w, onWall);
        if (onWall && a.Nw < 0) { onWall = false; tLeave = t; thLeave = th; continue; }
        if (out.length === 0 || t - out[out.length - 1][0] >= 0.005) out.push([t, x, th, a.Nw, a.Nf, onWall]);
        // semi-implicit step (small dt)
        vx += (onWall ? a.xdd : a.xdd) * dt; w += a.thdd * dt; th += w * dt; x = onWall ? h * Math.sin(th) : x + vx * dt;
        if (onWall) vx = h * Math.cos(th) * w;
        t += dt;
      }
    }
    if (!out.length) out.push([0, x, th, 0, m * G, true]);
    const hTop0 = Ll * Math.cos(th0), hLeave = isFinite(thLeave) ? Ll * Math.cos(thLeave) : NaN;
    return { Ll, m, mu, th0, holds, out, tLeave, thLeave, hTop0, hLeave, ratio: hLeave / hTop0, tEnd: out[out.length - 1][0], h,
             muMin: Math.tan(th0) / 2, at: tt => out[Math.min(out.length - 1, Math.max(0, Math.round(tt / 0.005)))] };
  }

  /* ---- a rod struck by a ball ---- */
  function runStrike(p) {
    const M = p.Mr, Lr = p.Lstr, m = p.mb, u = p.ub, e = p.eres, hinged = p.hinged;
    const Icm = M * Lr * Lr / 12;
    const x = p.xs * Lr / 2;                                          // strike point, from the CM (−L/2 … L/2)
    let J, vcm, w, vb, Jh = 0;
    if (!hinged) {
      J = (1 + e) * u / (1 / m + 1 / M + x * x / Icm);
      vcm = J / M; w = J * x / Icm; vb = u - J / m;
    } else {
      const dh = x + Lr / 2, Ip = Icm + M * Lr * Lr / 4;             // hinge at the −L/2 end
      J = (1 + e) * u / (1 / m + dh * dh / Ip);
      w = J * dh / Ip; vcm = w * Lr / 2; vb = u - J / m;
      Jh = M * vcm - J;                                               // what the hinge had to supply
    }
    const iar = hinged ? -Lr / 2 : (Math.abs(w) > 1e-9 ? -vcm / w : Infinity);   // the point at rest, measured from the CM
    const KE0 = 0.5 * m * u * u, KE1 = 0.5 * m * vb * vb + 0.5 * M * vcm * vcm + 0.5 * (hinged ? Icm + M * Lr * Lr / 4 : Icm) * w * w - (hinged ? 0.5 * M * vcm * vcm : 0);
    const Lang = m * u * (hinged ? x + Lr / 2 : x);
    return { M, Lr, m, u, e, hinged, x, J, vcm, w, vb, Jh, iar, KE0, KE1, Icm, Lang, cop: 2 * Lr / 3 };
  }

  /* ---- angular momentum ---- */
  function runSpin(p) {
    const out = [], dt = 0.001;
    if (p.ssub === 'skater') {
      // a student on a turntable: body I₀, two dumbbells m each pulled from r₁ to r₂ over 1.5 s (starting at t = 1 s)
      const I0 = p.I0, mdb = p.mdb, r1 = p.rout, r2 = p.rin, L0 = (I0 + 2 * mdb * r1 * r1) * p.w0;
      const rOf = t => t < 1 ? r1 : t < 2.5 ? r1 + (r2 - r1) * (1 - Math.cos(Math.PI * (t - 1) / 1.5)) / 2 : r2;
      let ph = 0, W = 0;
      for (let t = 0; t <= 5; t += dt) {
        const r = rOf(t), I = I0 + 2 * mdb * r * r, w = L0 / I;
        // work done by the arms: pulling against the centrifugal tension m ω² r
        const dr = rOf(t + dt) - r; W += -2 * mdb * w * w * r * dr;
        if (Math.round(t / dt) % 10 === 0) out.push([t, w, r, 0.5 * I * w * w, ph, I * w, W]);
        ph += w * dt;
      }
      const a = out[0], b = out[out.length - 1];
      return { kind: 'skater', out, L0, w1: a[1], w2: b[1], K1: a[3], K2: b[3], W, I1: I0 + 2 * mdb * r1 * r1, I2: I0 + 2 * mdb * r2 * r2, tEnd: 5 };
    }
    if (p.ssub === 'discs') {
      // disc 2 dropped on disc 1 at t = 0.5 s; kinetic friction torque τ until they turn together
      const I1 = p.Id1, I2 = p.Id2, tau = p.tauf;
      let w1 = p.wd1, w2 = p.wd2, locked = false, tLock = NaN, heat = 0, a1 = 0, a2 = 0;
      for (let t = 0; t <= 6; t += dt) {
        if (Math.round(t / dt) % 10 === 0) out.push([t, w1, w2, 0.5 * I1 * w1 * w1 + 0.5 * I2 * w2 * w2, I1 * w1 + I2 * w2, heat, a1, a2]);
        a1 += w1 * dt; a2 += w2 * dt;
        if (t < 0.5 || locked) { if (locked) { w2 = w1; } continue; }
        const s = Math.sign(w1 - w2), dw1 = -s * tau / I1 * dt, dw2 = s * tau / I2 * dt;
        if (Math.sign(w1 + dw1 - (w2 + dw2)) !== s) { const wc = (I1 * w1 + I2 * w2) / (I1 + I2); heat += 0.5 * I1 * w1 * w1 + 0.5 * I2 * w2 * w2 - 0.5 * (I1 + I2) * wc * wc; w1 = w2 = wc; locked = true; tLock = t; continue; }
        heat += tau * Math.abs(w1 - w2) * dt;
        w1 += dw1; w2 += dw2;
      }
      const K0 = 0.5 * I1 * p.wd1 * p.wd1 + 0.5 * I2 * p.wd2 * p.wd2, wc = (I1 * p.wd1 + I2 * p.wd2) / (I1 + I2);
      return { kind: 'discs', out, I1, I2, wc, wcRun: out[out.length - 1][1], tLock, heat, K0, lossF: I1 * I2 * Math.pow(p.wd1 - p.wd2, 2) / (2 * (I1 + I2)), tEnd: 6 };
    }
    // a bead sliding out along a free, frictionless rotating rod (the rod pivoted at its centre, no torque)
    const Ir = p.Irod, mb = p.mbead, Lh = p.Lhalf, L0 = (Ir + mb * p.r0 * p.r0) * p.wr0;
    let y = [p.r0, 0, 0], t = 0, tExit = NaN, vExit = null;
    const f = (tt, v) => { const w = L0 / (Ir + mb * v[0] * v[0]); return [v[1], v[0] * w * w, w]; };
    while (t < 8) {
      const w = L0 / (Ir + mb * y[0] * y[0]);
      if (Math.round(t / dt) % 10 === 0) out.push([t, y[0], y[1], w, y[2], 0.5 * (Ir + mb * y[0] * y[0]) * w * w + 0.5 * mb * y[1] * y[1]]);
      const y2 = rk4(f, y, t, dt);
      if (y2[0] >= Lh) {                              // the exit, interpolated inside the step
        const fr = (Lh - y[0]) / (y2[0] - y[0]), vr = y[1] + fr * (y2[1] - y[1]);
        tExit = t + fr * dt; vExit = [vr, Lh * L0 / (Ir + mb * Lh * Lh)]; break;
      }
      y = y2; t += dt;
    }
    const wEnd = L0 / (Ir + mb * Lh * Lh), K0 = 0.5 * (Ir + mb * p.r0 * p.r0) * p.wr0 * p.wr0;
    const vrF = Math.sqrt(Math.max(0, 2 * (K0 - 0.5 * (Ir + mb * Lh * Lh) * wEnd * wEnd) / mb));
    return { kind: 'bead', out, L0, wEnd, tExit, vExit, vrF, K0, Lh, tEnd: isFinite(tExit) ? tExit + 1.5 : 8 };
  }

  /* ---- the heavy symmetric top / gyroscope ----
     Euler angles: θ tilt of the axle from vertical, φ precession, ψ spin.
     ω₃ = ψ' + φ' cos θ and p_φ = I₁φ' sin²θ + I₃ω₃ cos θ are conserved;
     I₁θ'' = I₁φ'² sin θ cos θ − I₃ω₃φ' sin θ + mgd sin θ. */
  function runTop(p) {
    const m = p.mtop, d = p.dtop, R = p.Rw, I3 = 0.5 * m * R * R, I1 = 0.25 * m * R * R + m * d * d;   // a disc wheel on an axle, pivot at distance d
    const w3 = p.spin * TAU, th0 = p.tilt * Math.PI / 180;
    const Om = m * G * d / (I3 * w3);                                  // slow-precession rate
    const phd0 = p.start === 'smooth' ? smoothPrec(I1, I3, w3, m * G * d, th0) : 0;
    const pphi = I1 * phd0 * Math.sin(th0) * Math.sin(th0) + I3 * w3 * Math.cos(th0);
    const phdot = th => (pphi - I3 * w3 * Math.cos(th)) / (I1 * Math.sin(th) * Math.sin(th));
    const f = (t, y) => { const th = y[0], pd = phdot(th); return [y[1], (I1 * pd * pd * Math.sin(th) * Math.cos(th) - I3 * w3 * pd * Math.sin(th) + m * G * d * Math.sin(th)) / I1, pd, w3 - pd * Math.cos(th)]; };
    let y = [th0, 0, 0, 0], t = 0; const dt = Math.min(0.0005, 0.02 / Math.max(1, w3)), out = [], tEnd = p.tEnd;
    let thMin = th0, thMax = th0;
    while (t <= tEnd) {
      if (out.length === 0 || t - out[out.length - 1][0] >= 0.004) out.push([t, y[0], y[2], y[3], phdot(y[0])]);
      y = rk4(f, y, t, dt); t += dt;
      thMin = Math.min(thMin, y[0]); thMax = Math.max(thMax, y[0]);
      if (y[0] < 0.01 || y[0] > Math.PI - 0.01) break;
    }
    const last = out[out.length - 1], Omeas = last[2] / last[0];
    return { m, d, R, I1, I3, w3, th0, Om, Omeas, out, tEnd: last[0], nut: (thMax - thMin) * 180 / Math.PI, L: I3 * w3, phd0,
             at: tt => out[Math.min(out.length - 1, Math.max(0, Math.round(tt / 0.004)))] };
  }
  // the exact steady-precession rate (the slow root of I₁cosθ φ'² − I₃ω₃ φ' + mgd = 0)
  function smoothPrec(I1, I3, w3, mgd, th) {
    const a = I1 * Math.cos(th), b = -I3 * w3, c = mgd;
    if (Math.abs(a) < 1e-12) return -c / b;
    const disc = b * b - 4 * a * c;
    return disc < 0 ? mgd / (I3 * w3) : (-b - Math.sqrt(disc)) / (2 * a);
  }
  /* ---------------- shared drawing helpers (as in batch 3) ---------------- */
  function gPanel(g, bx, by, bw, bh, title) {
    const ctx = g.ctx, th = g.theme;
    ctx.fillStyle = g.alpha('#0B1020', .90);
    ctx.strokeStyle = g.alpha(th.line, 1); ctx.lineWidth = 1;
    ctx.beginPath(); ctx.roundRect(bx, by, bw, bh, 8); ctx.fill(); ctx.stroke();
    PA.lbl(ctx, bx + 10, by + 13, title, th['text-3'], 'left', 8.5);
    return (i, k, v, c) => {
      PA.lbl(ctx, bx + 10, by + 30 + i * 15, k, th['text-3'], 'left', 9);
      PA.lbl(ctx, bx + bw - 10, by + 30 + i * 15, v, c || th['text-2'], 'right', 9.5);
    };
  }
  function header(g, big, l1, l2, col) {
    const ctx = g.ctx, th = g.theme;
    ctx.textAlign = 'left'; ctx.textBaseline = 'alphabetic';
    ctx.font = '700 17px "IBM Plex Sans",system-ui,sans-serif';
    ctx.lineWidth = 3; ctx.strokeStyle = 'rgba(5,8,15,.8)'; ctx.strokeText(big, 14, 24);
    ctx.fillStyle = col || th.text; ctx.fillText(big, 14, 24);
    ctx.font = '10px "IBM Plex Mono",monospace'; ctx.fillStyle = g.alpha(th['text-2'], .95);
    if (l1) ctx.fillText(l1, 14, 40);
    ctx.fillStyle = g.alpha(th['text-3'], .95);
    if (l2) ctx.fillText(l2, 14, 54);
  }
  /* a 3-D polyline cut into short pieces, each sorted on its own depth, so
     the far half of an orbit really does pass behind the planet */
  function path3(F, pts, colour, o) {
    o = o || {};
    const n = o.chunk || 6, ctx = F.ctx, cam = F.cam;
    for (let i = 0; i < pts.length - 1; i += n) {
      const seg = pts.slice(i, Math.min(pts.length, i + n + 1));
      const mid = seg[seg.length >> 1];
      const col = typeof colour === 'function' ? colour(i / pts.length) : colour;
      F.push(mid, () => {
        ctx.save();
        ctx.strokeStyle = RX.rgba(col, o.alpha == null ? 0.85 : o.alpha); ctx.lineWidth = o.width || 1.6;
        if (o.dash) ctx.setLineDash(o.dash);
        if (o.glow) { ctx.shadowColor = col; ctx.shadowBlur = o.glow; }
        ctx.beginPath();
        let first = true;
        seg.forEach(p => { const q = cam.project(p); if (!q.ok) { first = true; return; } first ? ctx.moveTo(q.x, q.y) : ctx.lineTo(q.x, q.y); first = false; });
        ctx.stroke(); ctx.restore();
      }, o.bias || 0);
    }
  }
  function flatPoly(F, pts, fill, o) {
    o = o || {};
    const ctx = F.ctx, cam = F.cam;
    const c = pts.reduce((u, p) => [u[0] + p[0] / pts.length, u[1] + p[1] / pts.length, u[2] + p[2] / pts.length], [0, 0, 0]);
    F.push(c, () => {
      const q = pts.map(p => cam.project(p));
      if (q.some(x => !x.ok)) return;
      ctx.fillStyle = fill; ctx.beginPath();
      q.forEach((x, i) => i ? ctx.lineTo(x.x, x.y) : ctx.moveTo(x.x, x.y));
      ctx.closePath(); ctx.fill();
    }, o.bias || 0);
  }
  function ringPts(cam, c, r, n) {
    const out = [];
    for (let i = 0; i < n; i++) {
      const a = i / n * TAU, q = cam.project([c[0] + r * Math.cos(a), c[1] + r * Math.sin(a), c[2]]);
      if (!q.ok) return null;
      out.push(q);
    }
    return out;
  }
  function hull2(P) {
    const p = P.slice().sort((a, b) => a.x - b.x || a.y - b.y);
    const cr = (o, a, b) => (a.x - o.x) * (b.y - o.y) - (a.y - o.y) * (b.x - o.x);
    const lo = [], up = [];
    p.forEach(q => { while (lo.length >= 2 && cr(lo[lo.length - 2], lo[lo.length - 1], q) <= 0) lo.pop(); lo.push(q); });
    for (let i = p.length - 1; i >= 0; i--) { const q = p[i]; while (up.length >= 2 && cr(up[up.length - 2], up[up.length - 1], q) <= 0) up.pop(); up.push(q); }
    up.pop(); lo.pop();
    return lo.concat(up);
  }
  const polyPath = (ctx, pts) => { ctx.beginPath(); pts.forEach((q, i) => i ? ctx.lineTo(q.x, q.y) : ctx.moveTo(q.x, q.y)); ctx.closePath(); };
  function glassCyl(F, base, r, h, o) {
    o = o || {};
    const ctx = F.ctx, cam = F.cam;
    F.push([base[0], base[1], base[2] + h / 2], () => {
      const b = ringPts(cam, base, r, 40), t = ringPts(cam, [base[0], base[1], base[2] + h], r, 40);
      if (!b || !t) return;
      const H = hull2(b.concat(t));
      let x0 = Infinity, x1 = -Infinity;
      H.forEach(q => { x0 = Math.min(x0, q.x); x1 = Math.max(x1, q.x); });
      ctx.save();
      polyPath(ctx, H);
      ctx.fillStyle = o.tint || 'rgba(185,222,245,.07)'; ctx.fill();
      ctx.clip();
      const gr = ctx.createLinearGradient(x0, 0, x1, 0);
      gr.addColorStop(0, 'rgba(255,255,255,0)'); gr.addColorStop(0.07, 'rgba(255,255,255,.28)'); gr.addColorStop(0.14, 'rgba(255,255,255,.04)');
      gr.addColorStop(0.80, 'rgba(255,255,255,.02)'); gr.addColorStop(0.90, 'rgba(255,255,255,.16)'); gr.addColorStop(0.96, 'rgba(255,255,255,0)');
      ctx.fillStyle = gr; ctx.fillRect(x0, Math.min(...H.map(q => q.y)), x1 - x0, 4000);
      ctx.restore();
      ctx.strokeStyle = 'rgba(215,238,255,.55)'; ctx.lineWidth = 1; polyPath(ctx, H); ctx.stroke();
      ctx.strokeStyle = 'rgba(235,248,255,.75)'; ctx.lineWidth = 1.2; polyPath(ctx, t); ctx.stroke();
      if (o.ticks) o.ticks(ctx);
    }, o.bias == null ? -0.04 : o.bias);
  }
  function liquidCyl(F, base, r, h, col, o) {
    o = o || {};
    if (h <= 1e-5) return;
    const ctx = F.ctx, cam = F.cam, a = o.alpha == null ? 0.55 : o.alpha;
    F.push([base[0], base[1], base[2] + h / 2], () => {
      const b = ringPts(cam, base, r, 40), t = ringPts(cam, [base[0], base[1], base[2] + h], r, 40);
      if (!b || !t) return;
      const H = hull2(b.concat(t));
      let y0 = Infinity, y1 = -Infinity;
      H.forEach(q => { y0 = Math.min(y0, q.y); y1 = Math.max(y1, q.y); });
      ctx.save();
      const gr = ctx.createLinearGradient(0, y0, 0, y1);
      gr.addColorStop(0, RX.rgba(RX.mix(col, '#FFFFFF', 0.15), a * 0.85)); gr.addColorStop(1, RX.rgba(RX.mix(col, '#05080F', 0.35), a));
      ctx.fillStyle = gr; polyPath(ctx, H); ctx.fill();
      // the free surface: lit, with a soft specular band
      ctx.fillStyle = RX.rgba(RX.mix(col, '#FFFFFF', o.metal ? 0.12 : 0.35), Math.min(1, a + 0.15)); polyPath(ctx, t); ctx.fill();
      ctx.strokeStyle = RX.rgba(RX.mix(col, '#FFFFFF', 0.6), 0.9); ctx.lineWidth = 1.1; polyPath(ctx, t); ctx.stroke();
      if (o.metal) {                      // mercury: a mirror, not a tint
        const cx = t.reduce((u, q) => u + q.x, 0) / t.length, cy = t.reduce((u, q) => u + q.y, 0) / t.length;
        const g2 = ctx.createRadialGradient(cx - 10, cy - 3, 1, cx, cy, 60);
        g2.addColorStop(0, 'rgba(255,255,255,.45)'); g2.addColorStop(1, 'rgba(255,255,255,0)');
        ctx.fillStyle = g2; polyPath(ctx, t); ctx.fill();
      }
      ctx.restore();
    }, o.bias == null ? -0.02 : o.bias);
  }
  function ringHandle(g, q, id, c, rad) {
    const ctx = g.ctx, th = g.theme, on = g.dragging === id;
    ctx.save(); ctx.strokeStyle = on ? th.text : g.alpha(c, .85); ctx.lineWidth = on ? 2.2 : 1.5; ctx.setLineDash(on ? [] : [3, 2]);
    ctx.beginPath(); ctx.arc(q.x, q.y, rad || 11, 0, TAU); ctx.stroke(); ctx.restore();
    g.handle(q.x, q.y, (rad || 11) + 3, id);
  }
  const axis2 = (a, b, per) => { const dx = b.x - a.x, dy = b.y - a.y, l = Math.hypot(dx, dy) || 1; return { ux: dx / l, uy: dy / l, per: per / l }; };
  /* one pre-shaded ball per colour: thousands of nucleons or atoms a frame, drawn as sprites */
  const SPR = {};
  function sprite(col, o) {
    o = o || {};
    const key = col + (o.metal ? 'm' : '') + (o.glow ? 'g' : '');
    if (SPR[key]) return SPR[key];
    const c = document.createElement('canvas'); c.width = c.height = 96;
    const x = c.getContext('2d');
    if (o.glow) {
      const gr = x.createRadialGradient(48, 48, 0, 48, 48, 48);
      gr.addColorStop(0, RX.rgba('#FFFFFF', 1)); gr.addColorStop(0.25, RX.rgba(col, 0.9)); gr.addColorStop(1, RX.rgba(col, 0));
      x.fillStyle = gr; x.fillRect(0, 0, 96, 96);
    } else RX.ball(x, 48, 48, 46, col, { rim: o.metal ? 0.9 : 0.6, sub: 0.35, vivid: !o.metal });
    return (SPR[key] = c);
  }
  /* draw a list of [x, y, z, r, sprite] balls as one depth-sorted item */
  function ballCloud(F, list, at, bias) {
    const cam = F.cam, ctx = F.ctx, ey = cam.eye;
    list.forEach(d => { d[5] = (d[0] - ey[0]) ** 2 + (d[1] - ey[1]) ** 2 + (d[2] - ey[2]) ** 2; });
    list.sort((u, v) => v[5] - u[5]);
    F.push(at, () => {
      list.forEach(d => {
        const q = cam.project([d[0], d[1], d[2]]); if (!q.ok) return;
        const rp = d[3] * q.s; if (rp < 0.25) return;
        ctx.drawImage(d[4], q.x - rp, q.y - rp, 2 * rp, 2 * rp);
      });
    }, bias || 0);
  }
  function glassBox(F, c, size, o) {
    o = o || {};
    const ctx = F.ctx, cam = F.cam, hx = size[0] / 2, hy = size[1] / 2, hz = size[2] / 2;
    const faces = [[[1, 0, 0], hx, [0, hy, 0], [0, 0, hz]], [[-1, 0, 0], hx, [0, hy, 0], [0, 0, hz]],
                   [[0, 1, 0], hy, [hx, 0, 0], [0, 0, hz]], [[0, -1, 0], hy, [hx, 0, 0], [0, 0, hz]],
                   [[0, 0, 1], hz, [hx, 0, 0], [0, hy, 0]], [[0, 0, -1], hz, [hx, 0, 0], [0, hy, 0]]];
    faces.forEach(([n, h, e1, e2], i) => {
      if (o.skip && o.skip.indexOf(i) >= 0) return;
      const fc = R3.add(c, R3.scale(n, h));
      const pts = [R3.add(R3.add(fc, e1), e2), R3.add(R3.sub(fc, e1), e2), R3.sub(R3.sub(fc, e1), e2), R3.sub(R3.add(fc, e1), e2)];
      F.push(fc, () => {
        const q = pts.map(p => cam.project(p)); if (q.some(x => !x.ok)) return;
        ctx.beginPath(); q.forEach((x, k) => k ? ctx.lineTo(x.x, x.y) : ctx.moveTo(x.x, x.y)); ctx.closePath();
        const facing = R3.dot(n, R3.sub(cam.eye, fc)) > 0;
        ctx.fillStyle = facing ? 'rgba(170,215,240,.10)' : 'rgba(170,215,240,.05)'; ctx.fill();
        ctx.strokeStyle = 'rgba(210,235,255,.55)'; ctx.lineWidth = 0.9; ctx.stroke();
        if (facing && o.glint) {             // a diagonal reflection streak on the near pane
          const a = q[0], b = q[2];
          const gr = ctx.createLinearGradient(a.x, a.y, b.x, b.y);
          gr.addColorStop(0.35, 'rgba(255,255,255,0)'); gr.addColorStop(0.45, 'rgba(255,255,255,.10)'); gr.addColorStop(0.55, 'rgba(255,255,255,0)');
          ctx.fillStyle = gr; ctx.fill();
        }
      }, o.bias || 0);
    });
  }
  function convexFill(ctx, cam, pts3, fill, stroke) {
    const q = pts3.map(p => cam.project(p)); if (q.some(x => !x.ok)) return null;
    const H = hull2(q);
    ctx.fillStyle = fill; polyPath(ctx, H); ctx.fill();
    if (stroke) { ctx.strokeStyle = stroke; ctx.lineWidth = 1; polyPath(ctx, H); ctx.stroke(); }
    return H;
  }

  /* ---------- small vector helpers ---------- */
  const V = {
    add: (a, b) => [a[0] + b[0], a[1] + b[1], a[2] + b[2]], sub: (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]],
    mul: (a, k) => [a[0] * k, a[1] * k, a[2] * k], dot: (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2],
    cross: (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]],
    norm: a => { const l = Math.hypot(a[0], a[1], a[2]) || 1; return [a[0] / l, a[1] / l, a[2] / l]; }
  };
  // Rodrigues: rotate v about unit axis u by angle a
  const rotv = (v, u, a) => { const c = Math.cos(a), s = Math.sin(a), k = V.dot(u, v) * (1 - c), x = V.cross(u, v); return [v[0] * c + x[0] * s + u[0] * k, v[1] * c + x[1] * s + u[1] * k, v[2] * c + x[2] * s + u[2] * k]; };
  function panel(g, title, rows) {
    const narrow = g.w < 660, n = narrow ? Math.min(4, rows.length) : rows.length, bw = narrow ? g.w - 24 : 312, bh = 26 + n * 15 + 10;
    const row = gPanel(g, 12, g.h - bh - 30, bw, bh, title);
    rows.slice(0, n).forEach((r, i) => row(i, r[0], r[1], r[2]));
  }

  /* ======================= 1 · moment of inertia ======================= */
  function drawMoI(S, g) {
    const ctx = g.ctx, th = g.theme, p = S.p, cam = S.cam, Mi = S.Mi;
    const F = R3.Frame(ctx, cam, { ambient: 0.34, floorZ: null });
    const ks = 1.3 / p.size, c0 = [0, 0, 0.2];
    const k = Math.min(Mi.pts.length - 1, Math.floor(clamp(S.ts / 12, 0, 1) * (Mi.pts.length - 1)));
    const cur = Mi.pts.length ? Mi.pts[Math.max(0, Math.floor((S.ts % 12) / 12 * (Mi.pts.length - 1)))] : [0, 0, 0];
    const phi = cur[2] || 0, drop = cur[1] || 0;
    const u = Mi.u, A = V.mul(Mi.A, ks);
    const X = q => V.add(c0, V.add(A, rotv(V.sub(V.mul(q, ks), A), u, phi)));   // a body point, spun about the axis
    const ex = rotv([1, 0, 0], u, phi), ey = rotv([0, 1, 0], u, phi), ez = rotv([0, 0, 1], u, phi);
    const s = p.size * ks, col = '#6FA8E8';
    const b = p.body;
    if (b === 'rod') R3.cylinder(F, X([-0.5 * p.size, 0, 0]), X([0.5 * p.size, 0, 0]), 0.03 * s, '#C9A04A', { segments: 14, shadow: false });
    else if (b === 'plate') R3.box(F, X([0, 0, 0]), [1.0 * s, 0.6 * s, 0.02 * s], col, { shadow: false, axes: [ex, ey, ez] });
    else if (b === 'disc') R3.cylinder(F, X([0, 0, -0.01 * p.size]), X([0, 0, 0.01 * p.size]), 0.5 * s, col, { segments: 48, shadow: false });
    else if (b === 'ring') { const pts = []; for (let i = 0; i <= 48; i++) { const a = i / 48 * TAU; pts.push(X([0.5 * p.size * Math.cos(a), 0.5 * p.size * Math.sin(a), 0])); } R3.tube(F, pts, 0.025 * s, '#D6B055', { segments: 10 }); }
    else if (b === 'sphere') R3.sphere(F, X([0, 0, 0]), 0.5 * s, col, { shadow: false });
    else if (b === 'shell') R3.wireSphere(F, X([0, 0, 0]), 0.5 * s, '#9FD8FF', { lat: 7, lon: 10, alpha: 0.35, limbAlpha: 0.8 });
    else if (b === 'cyl') R3.cylinder(F, X([0, 0, -0.5 * p.size]), X([0, 0, 0.5 * p.size]), 0.5 * s, col, { segments: 36, shadow: false });
    else if (b === 'cone') { const zc = Mi.P[0] ? 0 : 0; for (let i = 0; i < 14; i++) { const z0 = -0.5 + i / 14, z1 = z0 + 1 / 14, r = 0.5 * (0.5 - (z0 + z1) / 2) + 0.02; R3.cylinder(F, X([0, 0, (z0 - 0.25 + zc) * p.size]), X([0, 0, (z1 - 0.25 + zc) * p.size]), r * s, col, { segments: 28, shadow: false, caps: i === 0 }); } }
    else if (b === 'cube') R3.box(F, X([0, 0, 0]), [s, s, s], col, { shadow: false, axes: [ex, ey, ez] });
    // a sample of the mass elements actually summed
    if (p.dots) { const sp = sprite('#FFD36B'), list = [], step = Math.max(1, Math.floor(Mi.P.length / 500)); for (let i = 0; i < Mi.P.length; i += step) { const q = X(V.mul(Mi.P[i], p.size)); list.push([q[0], q[1], q[2], 0.012, sp]); } ballCloud(F, list, c0, -0.05); }
    // the axis, and the drum + string + hanging mass
    const a0 = V.add(c0, V.add(A, V.mul(u, -1.2))), a1 = V.add(c0, V.add(A, V.mul(u, 1.2)));
    R3.cylinder(F, a0, a1, 0.012, '#DDE3EE', { segments: 10, shadow: false });
    const drum = V.add(c0, V.add(A, V.mul(u, 1.0)));
    R3.cylinder(F, V.add(drum, V.mul(u, -0.04)), V.add(drum, V.mul(u, 0.04)), Math.max(0.03, Mi.r * ks * 3), '#8A93A3', { segments: 18, shadow: false });
    const side = V.norm(Math.abs(u[2]) > 0.9 ? [1, 0, 0] : V.cross(u, [0, 0, 1])), top = V.add(drum, V.mul(side, Math.max(0.03, Mi.r * ks * 3)));
    const hang = V.add(top, [0, 0, -0.35 - drop * 0.9]);
    path3(F, [top, hang], '#E8E2D0', { alpha: 0.9, width: 1.2, chunk: 1 });
    R3.box(F, V.add(hang, [0, 0, -0.05]), [0.08, 0.08, 0.1], '#C9A04A', { shadow: false });
    R3.label(F, V.add(a1, [0, 0, 0.1]), 'axis', '#DDE3EE', { size: 9.5 });
    R3.label(F, V.add(hang, [0.1, 0, -0.1]), (Mi.mh * 1000).toFixed(0) + ' g', '#F2C879', { size: 9, align: 'left' });
    F.render();
    header(g, BODIES[p.body].name + ' · ' + p.Mkg.toFixed(2) + ' kg · size ' + p.size.toFixed(2) + ' m · axis ' + ({ x: 'x', y: 'y', z: 'z', diag: 'along a body diagonal', dxy: 'along the plate diagonal' })[p.ax] + (Mi.d ? ', offset ' + Mi.d.toFixed(2) + ' m' : ' through the CM'),
      'I = Σ m r⊥² over ' + Mi.P.length + ' equal mass elements · then spun by a falling ' + (Mi.mh * 1000).toFixed(0) + ' g on a ' + (Mi.r * 200).toFixed(1) + ' cm axle',
      'parallel axes: I = I_cm + Md² · perpendicular axes (flat bodies only): I_z = I_x + I_y', th.text);
    panel(g, 'SUMMED, THEN MEASURED', [
      ['I summed about this axis', Mi.I.toExponential(4) + ' kg·m²', th.phys],
      ['formula (I_cm + Md²)', Mi.IfPar.toExponential(4) + ' kg·m²', th.ok],
      ['radius of gyration √(I/M)', (Mi.k * 100).toFixed(2) + ' cm'],
      ['I from the fall time', isFinite(Mi.Imeas) ? Mi.Imeas.toExponential(4) + ' (t = ' + Mi.tFall.toFixed(3) + ' s)' : 'friction wins: no fall'],
      [Mi.lam ? 'I_x + I_y vs I_z (summed)' : 'I_x · I_y · I_z (summed)', Mi.lam ? (Mi.Iax[0] + Mi.Iax[1]).toExponential(3) + ' vs ' + Mi.Iax[2].toExponential(3) : Mi.Iax.map(v => v.toExponential(2)).join(' · ')],
      ['acceleration of the weight', Mi.acc.toFixed(4) + ' m/s²']
    ]);
  }

  /* ======================= 2 · a rod on a hinge ======================= */
  function drawHinge(S, g) {
    const ctx = g.ctx, th = g.theme, p = S.p, cam = S.cam, Hn = S.Hn;
    const F = R3.Frame(ctx, cam, { ambient: 0.34, floorZ: null });
    const o = Hn.at(S.ts % Hn.tEnd), ang = o[1], ks = 1.4 / Hn.Lr, pv = [0, 0, 0.9];
    R3.box(F, [0, 0.12, 0.9], [0.3, 0.06, 0.5], '#5A6478', { shadow: false });
    R3.cylinder(F, [0, 0.1, 0.9], [0, -0.06, 0.9], 0.025, '#DDE3EE', { segments: 12, shadow: false });
    // the rod: the CM hangs at angle θ below the pivot, distance a; the rod runs along that line
    const dir = [Math.sin(ang), 0, -Math.cos(ang)], cm = V.add(pv, V.mul(dir, Hn.a * ks));
    const e1 = V.add(cm, V.mul(dir, -Hn.Lr / 2 * ks)), e2 = V.add(cm, V.mul(dir, Hn.Lr / 2 * ks));
    R3.box(F, cm, [0.05, 0.05, Hn.Lr * ks], '#C9A04A', { shadow: false, axes: [[Math.cos(ang), 0, Math.sin(ang)], [0, 1, 0], dir.map(v => -v)] });
    if (Hn.mE > 0) R3.sphere(F, e2, 0.07, '#8A93A3', { shadow: false });
    // forces: weight at the CM of the whole, and the hinge force
    const cmT = V.add(pv, V.mul(dir, Hn.dcm * ks));
    const Nr = o[3], Nt = o[4], sc = 0.35 / (Hn.Mt * G);
    // radial (toward pivot, i.e. −dir) and tangential (direction of decreasing θ … the force component Nt acts along +t̂ where t̂ = dθ direction)
    const tdir = [Math.cos(ang), 0, Math.sin(ang)];
    const Nvec = V.add(V.mul(dir, -Nr * sc), V.mul(tdir, Nt * sc));
    R3.arrow(F, pv, V.add(pv, Nvec), 0.012, '#FF8FB0', { vivid: true });
    R3.arrow(F, cmT, V.add(cmT, [0, 0, -0.35]), 0.012, '#7CF0B0', { vivid: true });
    R3.label(F, V.add(pv, V.mul(Nvec, 1.15)), 'hinge ' + (o[5] / (Hn.Mt * G)).toFixed(2) + ' Mg', '#FF8FB0', { size: 10 });
    R3.label(F, V.add(cmT, [0.12, 0, -0.35]), 'Mg', '#7CF0B0', { size: 10 });
    // the end's path
    const arc = []; for (let i = 0; i <= 40; i++) { const a = -Math.PI + i / 40 * TAU; arc.push(V.add(pv, V.mul([Math.sin(a), 0, -Math.cos(a)], (Hn.Lr / 2 + Hn.a) * ks))); }
    path3(F, arc, '#8FA4CE', { alpha: 0.25, width: 1, dash: [3, 3], chunk: 4 });
    void e1;
    F.render();
    header(g, 'A rod on a hinge · pivot ' + (Hn.a * 100).toFixed(1) + ' cm from its centre · released from ' + p.th0.toFixed(0) + '°',
      'I_p θ\'\' = −Mg·d sin θ integrated (RK4) · hinge force = M·a_cm − M·g, found at every instant · θ = ' + (ang * 180 / Math.PI).toFixed(1) + '°',
      'at release from horizontal (pivot at an end) the hinge carries only Mg/4; at the bottom it carries 5Mg/2', th.text);
    panel(g, 'THE HINGE FORCE, COMPUTED', [
      ['at release', (Hn.Nrel / (Hn.Mt * G)).toFixed(4) + ' Mg', th.phys],
      ['at the lowest point', (Hn.Nbot / (Hn.Mt * G)).toFixed(4) + ' Mg', th.phys],
      ['along the rod · across it (now)', (Nr / (Hn.Mt * G)).toFixed(3) + ' · ' + (Nt / (Hn.Mt * G)).toFixed(3) + ' Mg'],
      ['period (timed) · small-angle formula', isFinite(Hn.per) ? Hn.per.toFixed(4) + ' · ' + Hn.TsmallF.toFixed(4) + ' s' : '—'],
      ['I about the pivot', Hn.Ip.toFixed(4) + ' kg·m²'],
      ['radius of gyration of the rod', (Hn.kg * 100).toFixed(2) + ' cm']
    ]);
  }

  /* ======================= 3 · the ladder ======================= */
  function drawLadder(S, g) {
    const ctx = g.ctx, th = g.theme, p = S.p, cam = S.cam, Ld = S.Ld;
    const F = R3.Frame(ctx, cam, { ambient: 0.34, floorZ: 0 });
    const ks = 1.5 / Ld.Ll, o = Ld.at(S.ts % (Ld.tEnd + 1.5)), x = o[1], ang = o[2];
    R3.box(F, [-0.06, 0, 0.9], [0.12, 1.6, 1.8], '#8A8578', { shadow: false });
    R3.box(F, [0.8, 0, -0.03], [1.8, 1.6, 0.06], '#6E4A2C', { shadow: false, bias: F.GROUND });
    const bot = [(x + Ld.h * Math.sin(ang)) * ks, 0, 0], top = [(x - Ld.h * Math.sin(ang)) * ks, 0, 2 * Ld.h * Math.cos(ang) * ks];
    [-0.12, 0.12].forEach(yy => R3.cylinder(F, V.add(bot, [0, yy, 0.02]), V.add(top, [0, yy, 0.02]), 0.018, '#C9A04A', { segments: 10, shadow: false }));
    for (let i = 1; i < 10; i++) { const q = V.add(bot, V.mul(V.sub(top, bot), i / 10)); R3.cylinder(F, V.add(q, [0, -0.12, 0.02]), V.add(q, [0, 0.12, 0.02]), 0.01, '#B08A3A', { segments: 8, shadow: false }); }
    const cm = V.mul(V.add(bot, top), 0.5), sc = 0.4 / (Ld.m * G);
    R3.arrow(F, cm, V.add(cm, [0, 0, -0.4]), 0.012, '#7CF0B0', { vivid: true });
    if (o[5] && o[3] > 0) R3.arrow(F, top, V.add(top, [o[3] * sc + 0.02, 0, 0]), 0.012, '#FF8FB0', { vivid: true });
    R3.arrow(F, bot, V.add(bot, [0, 0, Math.max(0.02, o[4] * sc)]), 0.012, '#7FD0FF', { vivid: true });
    // the CM's path: a quarter circle about the corner while the top is on the wall
    const arc = []; for (let i = 0; i <= 30; i++) { const a = i / 30 * Math.PI / 2; arc.push([Ld.h * Math.sin(a) * ks, 0, Ld.h * Math.cos(a) * ks]); }
    path3(F, arc, '#FFD36B', { alpha: 0.35, width: 1, dash: [3, 3], chunk: 3 });
    if (isFinite(Ld.hLeave)) { path3(F, [[-0.02, -0.3, Ld.hLeave * ks], [-0.02, 0.3, Ld.hLeave * ks]], '#FF8FB0', { alpha: 0.9, width: 1.6, chunk: 1 }); R3.label(F, [-0.05, 0.4, Ld.hLeave * ks], 'leaves the wall here', '#FF8FB0', { size: 9.5, align: 'right' }); }
    R3.label(F, V.add(cm, [0.15, 0, 0]), o[5] ? 'on the wall' : 'off the wall', o[5] ? '#DCE3EE' : '#FF8FB0', { size: 9.5, align: 'left' });
    F.render();
    header(g, 'A ' + Ld.Ll.toFixed(1) + ' m ladder at ' + p.lth0.toFixed(0) + '° from a frictionless wall · floor μ = ' + p.muf.toFixed(2),
      Ld.holds ? 'tan θ ≤ 2μ: friction holds it — it stands' : 't = ' + o[0].toFixed(2) + ' s · Newton\'s laws for the rod solved as a 3 × 3 system each step (θ\'\', N_wall, N_floor)',
      'on the wall the CM moves on a circle about the corner; the wall force falls to zero at 2/3 of the starting height (no friction)', th.text);
    panel(g, 'WHEN IT LEAVES THE WALL', [
      ['static? needs μ ≥ tan θ/2', Ld.muMin.toFixed(3) + (Ld.holds ? ' — holds' : ' — slides'), Ld.holds ? th.ok : '#FF8FB0'],
      ['top height when it leaves', isFinite(Ld.hLeave) ? (Ld.hLeave).toFixed(4) + ' m' : '—', th.phys],
      ['÷ starting height', isFinite(Ld.ratio) ? Ld.ratio.toFixed(4) : '—', th.ok],
      ['time on the wall', isFinite(Ld.tLeave) ? Ld.tLeave.toFixed(3) + ' s' : '—'],
      ['wall force · floor force now', (o[3] / (Ld.m * G)).toFixed(3) + ' · ' + (o[4] / (Ld.m * G)).toFixed(3) + ' mg'],
      ['angle from the wall now', (ang * 180 / Math.PI).toFixed(2) + '°']
    ]);
  }

  /* ======================= 4 · the struck rod ======================= */
  function drawStrike(S, g) {
    const ctx = g.ctx, th = g.theme, p = S.p, cam = S.cam, St = S.St;
    const F = R3.Frame(ctx, cam, { ambient: 0.36, floorZ: 0 });
    const ks = 1.4 / St.Lr, tt = S.ts % 7, t0 = 1.0, tA = Math.max(0, tt - t0) * 0.3;   // after the hit, shown at 0.3× speed
    R3.plane(F, [-2.2, -1.8, 0], [5.2, 0, 0], [0, 3.6, 0], '#7FA8C4', { grid: 12, gridColour: '#FFFFFF', gridAlpha: 0.18, bias: F.GROUND });
    // rod along y, CM at the origin; the ball comes along +x at y = x_strike
    const cmx = St.vcm * tA * ks * (St.hinged ? 0 : 1), phi = St.w * tA;
    const piv = St.hinged ? [0, -St.Lr / 2 * ks, 0.03] : null;
    // an impulse along +x at y = x_s turns the rod clockwise seen from above: a point at y goes to (y sin φ, y cos φ)
    const rodPt = y => {
      if (St.hinged) { const r = (y + St.Lr / 2) * ks; return [r * Math.sin(phi), -St.Lr / 2 * ks + r * Math.cos(phi), 0.03]; }
      return [cmx + y * ks * Math.sin(phi), y * ks * Math.cos(phi), 0.03];
    };
    // ghost positions every 0.25 s after impact
    for (let k = 1; k <= 8 && k * 0.2 < tA; k++) { const tk = k * 0.2, ph = St.w * tk, cx = St.hinged ? 0 : St.vcm * tk * ks;
      const a = St.hinged ? [0, -St.Lr / 2 * ks, 0.03] : [cx - St.Lr / 2 * ks * Math.sin(ph), -St.Lr / 2 * ks * Math.cos(ph), 0.03];
      const b2 = St.hinged ? [St.Lr * ks * Math.sin(ph), -St.Lr / 2 * ks + St.Lr * ks * Math.cos(ph), 0.03] : [cx + St.Lr / 2 * ks * Math.sin(ph), St.Lr / 2 * ks * Math.cos(ph), 0.03];
      path3(F, [a, b2], '#C9A04A', { alpha: 0.18, width: 3, chunk: 1 }); }
    const r0 = rodPt(-St.Lr / 2), r1 = rodPt(St.Lr / 2);
    R3.cylinder(F, r0, r1, 0.035, '#C9A04A', { segments: 12, shadow: false });
    if (piv) R3.cylinder(F, [piv[0], piv[1], 0], [piv[0], piv[1], 0.12], 0.03, '#DDE3EE', { segments: 12, shadow: false });
    // the ball
    const yb = St.x * ks, xb = tt < t0 ? -1.3 + (tt / t0) * 1.3 - 0.06 : -0.06 + St.vb * tA * ks;
    R3.sphere(F, [xb, yb, 0.06], 0.06, '#FF6B5A', { shadow: false, vivid: true });
    // at impact: velocity arrows along the rod, and the point at rest
    if (tt >= t0 - 0.02) {
      for (let i = 0; i <= 8; i++) { const y = -St.Lr / 2 + St.Lr * i / 8, v = St.hinged ? St.w * (y + St.Lr / 2) : St.vcm + St.w * y; const base = rodPt(y);
        if (Math.abs(v) > 1e-3) R3.arrow(F, V.add(base, [0, 0, 0.08]), V.add(base, [v * 0.12, 0, 0.08]), 0.008, '#7FD0FF', {}); }
      if (isFinite(St.iar) && Math.abs(St.iar) < 3 * St.Lr) { const q = St.hinged ? piv : rodPt(St.iar); if (q) { R3.sphere(F, V.add(q, [0, 0, 0.08]), 0.03, '#FFD36B', { shadow: false, vivid: true }); R3.label(F, V.add(q, [0, 0, 0.22]), 'at rest', '#FFD36B', { size: 9.5 }); } }
    }
    F.render();
    header(g, 'A ' + (St.m * 1000).toFixed(0) + ' g ball at ' + St.u.toFixed(1) + ' m/s strikes a ' + St.M.toFixed(2) + ' kg rod ' + (St.hinged ? 'hinged at one end' : 'lying free on ice') + ' · e = ' + St.e.toFixed(2),
      'impulse equations with restitution: J = (1+e)u / (1/m + ' + (St.hinged ? 'd²/I_p' : '1/M + x²/I_cm') + ') · strike ' + (St.hinged ? (St.x + St.Lr / 2).toFixed(3) + ' m from the hinge' : St.x.toFixed(3) + ' m from the centre'),
      St.hinged ? 'strike at 2L/3 from the hinge (the centre of percussion) and the hinge feels no jolt at all' : 'the rod turns about a point at rest on the far side: (distance of strike) × (distance of that point) = k²', th.text);
    panel(g, 'THE IMPULSE, RESOLVED', [
      ['impulse on the rod', St.J.toFixed(4) + ' N·s', th.phys],
      ['CM speed · spin', St.vcm.toFixed(4) + ' m/s · ' + St.w.toFixed(4) + ' rad/s'],
      [St.hinged ? 'impulse from the hinge' : 'point at rest from the CM', St.hinged ? St.Jh.toFixed(4) + ' N·s' : (isFinite(St.iar) ? Math.abs(St.iar).toFixed(4) + ' m (far side)' : '∞'), St.hinged ? (Math.abs(St.Jh) < 1e-6 ? th.ok : '#FF8FB0') : th.ok],
      ['ball after', St.vb.toFixed(4) + ' m/s'],
      ['KE before → after', St.KE0.toFixed(3) + ' → ' + St.KE1.toFixed(3) + ' J'],
      ['angular momentum (about ' + (St.hinged ? 'hinge' : 'CM') + ')', St.Lang.toFixed(4) + ' kg·m²/s']
    ]);
  }

  /* ======================= 5 · angular momentum ======================= */
  function drawSpin(S, g) {
    const ctx = g.ctx, th = g.theme, p = S.p, cam = S.cam, Sp = S.Sp;
    const F = R3.Frame(ctx, cam, { ambient: 0.34, floorZ: 0 });
    const tt = S.ts % Sp.tEnd, i = Math.min(Sp.out.length - 1, Math.round(tt / 0.01)), o = Sp.out[i];
    R3.cylinder(F, [0, 0, 0], [0, 0, 0.05], 0.9, '#39414F', { segments: 40, shadow: false });
    if (Sp.kind === 'skater') {
      const ph = o[4], r = o[2], sc = 1.0;
      R3.cylinder(F, [0, 0, 0.05], [0, 0, 0.12], 0.7, '#5A6478', { segments: 40, shadow: false });
      for (let k = 0; k < 12; k++) { const a = ph + k / 12 * TAU; path3(F, [[0.2 * Math.cos(a), 0.2 * Math.sin(a), 0.125], [0.68 * Math.cos(a), 0.68 * Math.sin(a), 0.125]], '#8FA4CE', { alpha: 0.5, width: 1, chunk: 1 }); }
      R3.cylinder(F, [0, 0, 0.12], [0, 0, 0.5], 0.05, '#9AA6B8', { segments: 12, shadow: false });
      R3.cylinder(F, [0, 0, 0.5], [0, 0, 0.56], 0.22, '#3A4458', { segments: 24, shadow: false });
      R3.cylinder(F, [0, 0, 0.56], [0, 0, 1.15], 0.14, '#4A6FA8', { segments: 20, shadow: false });
      R3.sphere(F, [0, 0, 1.3], 0.11, '#E8C8A8', { shadow: false });
      [1, -1].forEach(sg => { const hand = [sg * r * sc * Math.cos(ph), sg * r * sc * Math.sin(ph), 1.02], sh = [sg * 0.14 * Math.cos(ph), sg * 0.14 * Math.sin(ph), 1.08];
        R3.cylinder(F, sh, hand, 0.035, '#4A6FA8', { segments: 10, shadow: false }); R3.sphere(F, hand, 0.08, '#2B2F38', { shadow: false }); });
      R3.arrow(F, [0, 0, 1.45], [0, 0, 1.45 + 0.12 * o[5] / Sp.L0 * 3], 0.02, '#7CF0B0', { vivid: true });
      R3.label(F, [0, 0, 1.95], 'L = ' + o[5].toFixed(3) + ' kg·m²/s (constant)', '#7CF0B0', { size: 10 });
      F.render();
      header(g, 'A student on a turntable pulls in two ' + p.mdb.toFixed(1) + ' kg dumbbells', 't = ' + tt.toFixed(2) + ' s · arms at ' + (r * 100).toFixed(0) + ' cm · ω = ' + o[1].toFixed(3) + ' rad/s · no external torque about the axis',
        'L = Iω is kept; the kinetic energy is not — the arms do work pulling the weights in against their tendency to fly out', th.text);
      panel(g, 'CONSERVED, AND NOT', [['ω arms out → in', Sp.w1.toFixed(4) + ' → ' + Sp.w2.toFixed(4) + ' rad/s', th.phys], ['I₁/I₂', (Sp.I1 / Sp.I2).toFixed(4), th.ok],
        ['kinetic energy out → in', Sp.K1.toFixed(3) + ' → ' + Sp.K2.toFixed(3) + ' J'], ['work done by the arms (integrated)', Sp.W.toFixed(3) + ' J', th.ok], ['L now', o[5].toFixed(4) + ' kg·m²/s'], ['I now', (o[5] / o[1]).toFixed(4) + ' kg·m²']]);
      return;
    }
    if (Sp.kind === 'discs') {
      const drop = clamp((tt - 0.3) / 0.2, 0, 1), z2 = 0.9 - 0.6 * drop;
      R3.cylinder(F, [0, 0, 0.05], [0, 0, 1.2], 0.03, '#DDE3EE', { segments: 10, shadow: false });
      R3.cylinder(F, [0, 0, 0.2], [0, 0, 0.3], 0.75, '#4A6FA8', { segments: 44, shadow: false });
      R3.cylinder(F, [0, 0, z2], [0, 0, z2 + 0.08], 0.55, '#C9824A', { segments: 44, shadow: false });
      [[o[6], 0.3, 0.72, '#FFD36B'], [o[7], z2 + 0.08, 0.52, '#FFFFFF']].forEach(([a, z, rr, c]) => { for (let k = 0; k < 3; k++) { const b = a + k * TAU / 3; path3(F, [[0.08 * Math.cos(b), 0.08 * Math.sin(b), z + 0.002], [rr * Math.cos(b), rr * Math.sin(b), z + 0.002]], c, { alpha: 0.9, width: 2, chunk: 1 }); } });
      R3.label(F, [0.8, 0, 0.25], 'disc 1 · ω₁ = ' + o[1].toFixed(2), '#9FC0F0', { size: 10, align: 'left' });
      R3.label(F, [0.6, 0, z2 + 0.1], 'disc 2 · ω₂ = ' + o[2].toFixed(2), '#F2B58A', { size: 10, align: 'left' });
      F.render();
      header(g, 'A disc dropped onto a spinning disc', 't = ' + tt.toFixed(2) + ' s · friction between them, torque ' + p.tauf.toFixed(2) + ' N·m, until they turn together',
        'angular momentum I₁ω₁ + I₂ω₂ is conserved; the kinetic energy lost, I₁I₂(ω₁ − ω₂)²/2(I₁ + I₂), goes into heat', th.text);
      panel(g, 'THE COLLISION OF SPINS', [['common ω (run) · (I₁ω₁ + I₂ω₂)/(I₁ + I₂)', Sp.wcRun.toFixed(4) + ' · ' + Sp.wc.toFixed(4), th.phys], ['heat made (integrated τ·Δω)', Sp.heat.toFixed(4) + ' J', th.phys],
        ['formula', Sp.lossF.toFixed(4) + ' J', th.ok], ['time to lock', isFinite(Sp.tLock) ? (Sp.tLock - 0.5).toFixed(3) + ' s' : '—'], ['L now', o[4].toFixed(4)], ['KE now', o[3].toFixed(3) + ' J']]);
      return;
    }
    // bead on a rotating rod
    const ang = o[4], r = o[1], ks = 1.6 / Sp.Lh * 0.5;
    R3.cylinder(F, [0, 0, 0.05], [0, 0, 0.5], 0.04, '#9AA6B8', { segments: 12, shadow: false });
    const d = [Math.cos(ang), Math.sin(ang), 0];
    R3.cylinder(F, V.add([0, 0, 0.5], V.mul(d, -Sp.Lh * ks)), V.add([0, 0, 0.5], V.mul(d, Sp.Lh * ks)), 0.018, '#C9A04A', { segments: 10, shadow: false });
    const bp = V.add([0, 0, 0.5], V.mul(d, r * ks));
    R3.sphere(F, bp, 0.05, '#FF6B5A', { shadow: false, vivid: true });
    const trail = Sp.out.filter((q, j) => j <= i && j % 3 === 0).map(q => [q[1] * ks * Math.cos(q[4]), q[1] * ks * Math.sin(q[4]), 0.5]);
    if (trail.length > 1) path3(F, trail, '#FF8A7A', { alpha: 0.6, width: 1.4, chunk: 4 });
    F.render();
    header(g, 'A bead slides out along a freely turning rod', 't = ' + tt.toFixed(3) + ' s · r = ' + (r * 100).toFixed(1) + ' cm · ω = ' + o[3].toFixed(3) + ' rad/s · no friction, no torque on the axle',
      'r\'\' = rω² with ω = L/(I_rod + mr²): the bead flings outward while the rod slows · the red trail is its path seen from above', th.text);
    panel(g, 'THE BEAD LEAVES THE END', [['ω when it leaves', Sp.wEnd.toFixed(4) + ' rad/s', th.phys], ['radial speed then (integrated)', Sp.vExit ? Sp.vExit[0].toFixed(4) + ' m/s' : '—', th.phys],
      ['radial speed from energy + L', Sp.vrF.toFixed(4) + ' m/s', th.ok], ['tangential speed then', Sp.vExit ? Sp.vExit[1].toFixed(4) + ' m/s' : '—'], ['time to reach the end', isFinite(Sp.tExit) ? Sp.tExit.toFixed(4) + ' s' : '—'], ['energy (kept)', o[5].toFixed(4) + ' J']]);
  }

  /* ======================= 6 · the gyroscope ======================= */
  function drawTop(S, g) {
    const ctx = g.ctx, th = g.theme, p = S.p, cam = S.cam, Tp = S.Tp;
    const F = R3.Frame(ctx, cam, { ambient: 0.34, floorZ: 0 });
    const o = Tp.at(S.ts % Tp.tEnd), tht = o[1], ph = o[2], ps = o[3];
    const B = window.BENCH, ks = 1.0 / Math.max(Tp.d, 0.05) * 0.6, piv = [0, 0, 0.9];
    R3.cylinder(F, [0, 0, 0], [0, 0, 0.05], 0.3, '#3A4152', { segments: 30, shadow: false });
    R3.cylinder(F, [0, 0, 0.05], [0, 0, 0.88], 0.025, '#8A93A3', { segments: 12, shadow: false });
    R3.sphere(F, piv, 0.03, '#DDE3EE', { shadow: false });
    const n = [Math.sin(tht) * Math.cos(ph), Math.sin(tht) * Math.sin(ph), Math.cos(tht)], c = V.add(piv, V.mul(n, Tp.d * ks));
    R3.cylinder(F, piv, V.add(c, V.mul(n, 0.08)), 0.012, '#DDE3EE', { segments: 10, shadow: false });
    B.pulley(F, c, n, Tp.R * ks, { phase: ps, spokes: 6, colour: '#C9A04A', width: Tp.R * ks * 0.3 });
    // trace of the axle end: precession with nutation loops
    const tr = []; for (let j = 0; j < Tp.out.length && Tp.out[j][0] <= o[0]; j += 2) { const q = Tp.out[j], nn = [Math.sin(q[1]) * Math.cos(q[2]), Math.sin(q[1]) * Math.sin(q[2]), Math.cos(q[1])]; tr.push(V.add(piv, V.mul(nn, Tp.d * ks + 0.08))); }
    if (tr.length > 1) path3(F, tr.slice(-900), '#FFD36B', { alpha: 0.75, width: 1.4, chunk: 6 });
    // L along the axle, gravity torque horizontal (r × mg), precession about the vertical
    R3.arrow(F, c, V.add(c, V.mul(n, 0.45)), 0.014, '#7CF0B0', { vivid: true });
    const tq = V.norm(V.cross(n, [0, 0, -1]));
    R3.arrow(F, c, V.add(c, V.mul(tq, 0.35)), 0.012, '#FF8FB0', { vivid: true });
    R3.label(F, V.add(c, V.mul(n, 0.55)), 'L', '#7CF0B0', { size: 11 });
    R3.label(F, V.add(c, V.mul(tq, 0.45)), 'τ = r × mg', '#FF8FB0', { size: 10 });
    F.render();
    header(g, 'A gyroscope · wheel ' + (Tp.m * 1000).toFixed(0) + ' g, radius ' + (Tp.R * 100).toFixed(1) + ' cm, spinning ' + p.spin.toFixed(0) + ' rev/s, ' + (Tp.d * 100).toFixed(1) + ' cm from the pivot',
      'the full heavy-top equations (Euler angles, RK4) · θ = ' + (tht * 180 / Math.PI).toFixed(2) + '° from vertical · ' + (p.start === 'smooth' ? 'launched at the exact steady precession' : 'released from rest: it dips and nods (nutation)'),
      'the torque of gravity is horizontal, so it turns L sideways instead of toppling the wheel: dL/dt = τ gives Ω = mgd/(I₃ω)', th.text);
    panel(g, 'PRECESSION, MEASURED', [['mean precession (measured)', Tp.Omeas.toFixed(5) + ' rad/s', th.phys], ['mgd/(I₃ω₃)', Tp.Om.toFixed(5) + ' rad/s', th.ok],
      ['exact steady root (this tilt)', Tp.phd0 ? Tp.phd0.toFixed(5) + ' rad/s' : smoothPrec(Tp.I1, Tp.I3, Tp.w3, Tp.m * G * Tp.d, Tp.th0).toFixed(5) + ' rad/s'],
      ['nutation (range of θ)', Tp.nut.toFixed(3) + '°'], ['spin angular momentum I₃ω₃', Tp.L.toFixed(4) + ' kg·m²/s'], ['one precession period', (TAU / Math.max(1e-9, Math.abs(Tp.Omeas))).toFixed(2) + ' s']]);
  }

  const MOI = S => S.p.mode === 'moi', HNG = S => S.p.mode === 'hinge', LAD = S => S.p.mode === 'ladder', STK = S => S.p.mode === 'strike',
        SPN = S => S.p.mode === 'spin', GYR = S => S.p.mode === 'gyro',
        SKT = S => SPN(S) && S.p.ssub === 'skater', DSC = S => SPN(S) && S.p.ssub === 'discs', BED = S => SPN(S) && S.p.ssub === 'bead';

  L.register({
    id: 'rigidbody', subject: 'physics',
    name: 'Rigid-Body Dynamics — Moment of Inertia, Torque and Angular Momentum',
    chapter: 'System of Particles & Rotational Motion',
    exams: ['JEE Main', 'JEE Advanced', 'NEET UG'],
    weight: 'Very high yield · JEE Advanced favourite',
    is3D: true,
    stageHint: 'Drag to orbit · every rotation here is integrated from τ = dL/dt, not animated',
    lede: 'Six benches for the part of mechanics JEE Advanced makes hardest. The <b>moment of inertia</b> is summed over thousands of ' +
      'mass elements about any axis you choose, then <b>measured back</b> with a falling weight. A hinged rod shows its <b>hinge force</b> ' +
      'at every instant. A ladder <b>leaves the wall</b> exactly when Newton\'s laws say it must. A rod struck on ice turns about a point ' +
      'at rest, and a hinged one strikes cleanly at its <b>centre of percussion</b>. Angular momentum is conserved while kinetic energy ' +
      'is not. A <b>gyroscope</b> precesses and nods under the full rigid-body equations.',

    params: { mode: 'moi', body: 'disc', Mkg: 2, size: 0.4, ax: 'z', off: 0, mhang: 0.2, raxle: 2, fric: 0, dots: true,
              Lrod: 1, mrod: 1, piv: 0.5, mend: 0, th0: 90,
              Llad: 4, mlad: 10, muf: 0, lth0: 20,
              Mr: 1, Lstr: 1, mb: 0.1, ub: 10, eres: 0, hinged: false, xs: 0.5,
              ssub: 'skater', I0: 2, mdb: 2, rout: 0.8, rin: 0.15, w0: 2, Id1: 0.2, Id2: 0.1, tauf: 0.5, wd1: 20, wd2: 0, Irod: 0.05, mbead: 0.1, Lhalf: 0.5, r0: 0.05, wr0: 10,
              mtop: 0.5, dtop: 0.1, Rw: 0.08, spin: 40, tilt: 90, start: 'drop', tEnd: 8, run: true },

    presets: [
      { name: 'Disc about its axis · spun by a falling weight', params: { mode: 'moi', body: 'disc', Mkg: 2, size: 0.4, ax: 'z', off: 0, mhang: 0.2, raxle: 2, fric: 0 } },
      { name: 'Rod about one end · ML²/3', params: { mode: 'moi', body: 'rod', Mkg: 1, size: 1, ax: 'y', off: 0.5, mhang: 0.2, raxle: 2, fric: 0 } },
      { name: 'Disc about a diameter · MR²/4', params: { mode: 'moi', body: 'disc', Mkg: 1, size: 1, ax: 'x', off: 0, mhang: 0.2, raxle: 2, fric: 0 } },
      { name: 'Cube about a body diagonal · still Ma²/6', params: { mode: 'moi', body: 'cube', Mkg: 1, size: 1, ax: 'diag', off: 0, mhang: 0.2, raxle: 2, fric: 0 } },
      { name: 'Solid cone about its axis · 3MR²/10', params: { mode: 'moi', body: 'cone', Mkg: 1, size: 1, ax: 'z', off: 0, mhang: 0.2, raxle: 2, fric: 0 } },
      { name: 'Ring about a tangent in its plane', params: { mode: 'moi', body: 'ring', Mkg: 1, size: 1, ax: 'x', off: 0.5, mhang: 0.2, raxle: 2, fric: 0 } },
      { name: 'Rod released from horizontal · hinge force', params: { mode: 'hinge', Lrod: 1, mrod: 1, piv: 0.5, mend: 0, th0: 90 } },
      { name: 'Rod pivoted at its radius of gyration · fastest swing', params: { mode: 'hinge', Lrod: 1, mrod: 1, piv: 0.2887, mend: 0, th0: 10 } },
      { name: 'Rod with a mass on its end', params: { mode: 'hinge', Lrod: 1, mrod: 1, piv: 0.5, mend: 1, th0: 90 } },
      { name: 'Ladder on a frictionless floor · leaves the wall', params: { mode: 'ladder', Llad: 4, mlad: 10, muf: 0, lth0: 20 } },
      { name: 'Ladder with μ = 0.3 · stands', params: { mode: 'ladder', Llad: 4, mlad: 10, muf: 0.3, lth0: 25 } },
      { name: 'Ladder with μ = 0.2 at 40° · slides', params: { mode: 'ladder', Llad: 4, mlad: 10, muf: 0.2, lth0: 40 } },
      { name: 'Rod on ice struck at its end', params: { mode: 'strike', Mr: 1, Lstr: 1, mb: 0.1, ub: 10, eres: 0, hinged: false, xs: 1 } },
      { name: 'Hinged rod struck at 2L/3 · no jolt', params: { mode: 'strike', Mr: 1, Lstr: 1, mb: 0.1, ub: 10, eres: 0, hinged: true, xs: 1 / 3 } },
      { name: 'Hinged rod struck at its end · the hinge kicks', params: { mode: 'strike', Mr: 1, Lstr: 1, mb: 0.1, ub: 10, eres: 0, hinged: true, xs: 1 } },
      { name: 'Student pulls in the dumbbells', params: { mode: 'spin', ssub: 'skater', I0: 2, mdb: 2, rout: 0.8, rin: 0.15, w0: 2 } },
      { name: 'Disc dropped on a spinning disc', params: { mode: 'spin', ssub: 'discs', Id1: 0.2, Id2: 0.1, tauf: 0.5, wd1: 20, wd2: 0 } },
      { name: 'Bead flung out along a rotating rod', params: { mode: 'spin', ssub: 'bead', Irod: 0.05, mbead: 0.1, Lhalf: 0.5, r0: 0.05, wr0: 10 } },
      { name: 'Gyroscope released horizontally · nutation', params: { mode: 'gyro', mtop: 0.5, dtop: 0.1, Rw: 0.08, spin: 40, tilt: 90, start: 'drop' } },
      { name: 'Gyroscope at the steady precession', params: { mode: 'gyro', mtop: 0.5, dtop: 0.1, Rw: 0.08, spin: 40, tilt: 60, start: 'smooth' } },
      { name: 'Slow spin · big nods', params: { mode: 'gyro', mtop: 0.5, dtop: 0.1, Rw: 0.08, spin: 12, tilt: 90, start: 'drop' } }
    ],

    controls: [
      { group: 'Bench', items: [
        { key: 'mode', type: 'select', label: 'Experiment', restructure: true, rebuild: true, options: [
          { value: 'moi', label: 'Moment of inertia' }, { value: 'hinge', label: 'Rod on a hinge' }, { value: 'ladder', label: 'Sliding ladder' },
          { value: 'strike', label: 'Struck rod' }, { value: 'spin', label: 'Angular momentum' }, { value: 'gyro', label: 'Gyroscope' }] }
      ] },
      { group: 'The body and its axis', items: [
        { key: 'body', type: 'select', label: 'Body', restructure: true, when: MOI, options: Object.keys(BODIES).map(k => ({ value: k, label: BODIES[k].name[0].toUpperCase() + BODIES[k].name.slice(1) })) },
        { key: 'ax', type: 'select', label: 'Axis direction', restructure: true, when: MOI, options: [
          { value: 'x', label: 'x' }, { value: 'y', label: 'y' }, { value: 'z', label: 'z (the symmetry axis)' }, { value: 'diag', label: 'Body diagonal (1,1,1)' }, { value: 'dxy', label: 'Face diagonal (1,1,0)' }] },
        { key: 'off', label: 'Axis offset from the CM', min: 0, max: 1, step: 0.01, unit: 'm', when: MOI, fmt: v => v.toFixed(2), restructure: true },
        { key: 'Mkg', label: 'Mass', min: 0.2, max: 10, step: 0.1, unit: 'kg', when: MOI, fmt: v => v.toFixed(1), restructure: true },
        { key: 'size', label: 'Size (length / diameter / side)', min: 0.1, max: 2, step: 0.01, unit: 'm', when: MOI, fmt: v => v.toFixed(2), restructure: true },
        { key: 'mhang', label: 'Falling weight', min: 0.01, max: 2, step: 0.01, unit: 'kg', when: MOI, fmt: v => v.toFixed(2), restructure: true },
        { key: 'raxle', label: 'Axle radius', min: 0.5, max: 10, step: 0.1, unit: 'cm', when: MOI, fmt: v => v.toFixed(1), restructure: true },
        { key: 'fric', label: 'Friction torque at the bearing', min: 0, max: 0.05, step: 0.0005, unit: 'N·m', when: MOI, fmt: v => v.toFixed(4), restructure: true },
        { key: 'dots', type: 'toggle', label: 'Show the mass elements', when: MOI }
      ] },
      { group: 'The hinged rod', items: [
        { key: 'piv', label: 'Pivot distance from the centre (× L)', min: 0.02, max: 0.5, step: 0.001, unit: '', when: HNG, fmt: v => v.toFixed(3), restructure: true },
        { key: 'th0', label: 'Released from', min: 2, max: 178, step: 1, unit: '°', when: HNG, fmt: v => v.toFixed(0), restructure: true },
        { key: 'mend', label: 'Extra mass at the free end', min: 0, max: 3, step: 0.05, unit: 'kg', when: HNG, fmt: v => v.toFixed(2), restructure: true },
        { key: 'Lrod', label: 'Rod length', min: 0.2, max: 2, step: 0.01, unit: 'm', when: HNG, fmt: v => v.toFixed(2), restructure: true },
        { key: 'mrod', label: 'Rod mass', min: 0.1, max: 5, step: 0.1, unit: 'kg', when: HNG, fmt: v => v.toFixed(1), restructure: true }
      ] },
      { group: 'The ladder', items: [
        { key: 'lth0', label: 'Starting angle from the wall', min: 3, max: 80, step: 0.5, unit: '°', when: LAD, fmt: v => v.toFixed(1), restructure: true },
        { key: 'muf', label: 'Floor friction μ (wall frictionless)', min: 0, max: 1, step: 0.01, unit: '', when: LAD, fmt: v => v.toFixed(2), restructure: true },
        { key: 'Llad', label: 'Length', min: 1, max: 8, step: 0.1, unit: 'm', when: LAD, fmt: v => v.toFixed(1), restructure: true },
        { key: 'mlad', label: 'Mass', min: 1, max: 40, step: 0.5, unit: 'kg', when: LAD, fmt: v => v.toFixed(1), restructure: true }
      ] },
      { group: 'Strike', items: [
        { key: 'hinged', type: 'toggle', label: 'Hinge the rod at one end', restructure: true, when: STK },
        { key: 'xs', label: 'Strike point (−1 = near end, +1 = far end)', min: -1, max: 1, step: 0.005, unit: '', when: STK, fmt: v => v.toFixed(3), restructure: true },
        { key: 'eres', label: 'Coefficient of restitution e', min: 0, max: 1, step: 0.01, unit: '', when: STK, fmt: v => v.toFixed(2), restructure: true },
        { key: 'mb', label: 'Ball mass', min: 0.01, max: 2, step: 0.01, unit: 'kg', when: STK, fmt: v => v.toFixed(2), restructure: true },
        { key: 'ub', label: 'Ball speed', min: 1, max: 30, step: 0.5, unit: 'm/s', when: STK, fmt: v => v.toFixed(1), restructure: true },
        { key: 'Mr', label: 'Rod mass', min: 0.1, max: 5, step: 0.1, unit: 'kg', when: STK, fmt: v => v.toFixed(1), restructure: true }
      ] },
      { group: 'Angular momentum', items: [
        { key: 'ssub', type: 'select', label: 'Experiment', restructure: true, rebuild: true, when: SPN, options: [
          { value: 'skater', label: 'Student with dumbbells' }, { value: 'discs', label: 'Disc dropped on a disc' }, { value: 'bead', label: 'Bead on a rotating rod' }] },
        { key: 'I0', label: 'Student + stool I₀', min: 0.5, max: 6, step: 0.05, unit: 'kg·m²', when: SKT, fmt: v => v.toFixed(2), restructure: true },
        { key: 'mdb', label: 'Each dumbbell', min: 0.5, max: 5, step: 0.1, unit: 'kg', when: SKT, fmt: v => v.toFixed(1), restructure: true },
        { key: 'rout', label: 'Arms out at', min: 0.4, max: 1, step: 0.01, unit: 'm', when: SKT, fmt: v => v.toFixed(2), restructure: true },
        { key: 'rin', label: 'Arms in at', min: 0.1, max: 0.4, step: 0.01, unit: 'm', when: SKT, fmt: v => v.toFixed(2), restructure: true },
        { key: 'w0', label: 'Starting ω', min: 0.5, max: 6, step: 0.05, unit: 'rad/s', when: SKT, fmt: v => v.toFixed(2), restructure: true },
        { key: 'Id1', label: 'Lower disc I₁', min: 0.02, max: 1, step: 0.01, unit: 'kg·m²', when: DSC, fmt: v => v.toFixed(2), restructure: true },
        { key: 'Id2', label: 'Upper disc I₂', min: 0.02, max: 1, step: 0.01, unit: 'kg·m²', when: DSC, fmt: v => v.toFixed(2), restructure: true },
        { key: 'wd1', label: 'Lower disc ω₁', min: -30, max: 30, step: 0.5, unit: 'rad/s', when: DSC, fmt: v => v.toFixed(1), restructure: true },
        { key: 'wd2', label: 'Upper disc ω₂', min: -30, max: 30, step: 0.5, unit: 'rad/s', when: DSC, fmt: v => v.toFixed(1), restructure: true },
        { key: 'tauf', label: 'Friction torque between them', min: 0.05, max: 3, step: 0.05, unit: 'N·m', when: DSC, fmt: v => v.toFixed(2), restructure: true },
        { key: 'Irod', label: 'Rod I (about its centre)', min: 0.005, max: 0.5, step: 0.005, unit: 'kg·m²', when: BED, fmt: v => v.toFixed(3), restructure: true },
        { key: 'mbead', label: 'Bead mass', min: 0.01, max: 1, step: 0.01, unit: 'kg', when: BED, fmt: v => v.toFixed(2), restructure: true },
        { key: 'wr0', label: 'Starting ω', min: 1, max: 30, step: 0.5, unit: 'rad/s', when: BED, fmt: v => v.toFixed(1), restructure: true },
        { key: 'r0', label: 'Bead starts at r', min: 0.01, max: 0.3, step: 0.005, unit: 'm', when: BED, fmt: v => v.toFixed(3), restructure: true },
        { key: 'Lhalf', label: 'Half-length of the rod', min: 0.2, max: 1, step: 0.01, unit: 'm', when: BED, fmt: v => v.toFixed(2), restructure: true }
      ] },
      { group: 'Gyroscope', items: [
        { key: 'spin', label: 'Wheel spin', min: 5, max: 100, step: 1, unit: 'rev/s', when: GYR, fmt: v => v.toFixed(0), restructure: true },
        { key: 'tilt', label: 'Axle tilt from vertical', min: 20, max: 160, step: 1, unit: '°', when: GYR, fmt: v => v.toFixed(0), restructure: true },
        { key: 'start', type: 'select', label: 'Launch', restructure: true, when: GYR, options: [{ value: 'drop', label: 'Released from rest (nutation)' }, { value: 'smooth', label: 'Given the steady precession' }] },
        { key: 'dtop', label: 'Wheel distance from pivot', min: 0.03, max: 0.25, step: 0.005, unit: 'm', when: GYR, fmt: v => v.toFixed(3), restructure: true },
        { key: 'mtop', label: 'Wheel mass', min: 0.1, max: 3, step: 0.05, unit: 'kg', when: GYR, fmt: v => v.toFixed(2), restructure: true },
        { key: 'Rw', label: 'Wheel radius', min: 0.03, max: 0.2, step: 0.005, unit: 'm', when: GYR, fmt: v => v.toFixed(3), restructure: true }
      ] },
      { group: 'Display', items: [
        { key: 'run', type: 'toggle', label: 'Let it run' }
      ] }
    ],

    setup(S) {
      const p = S.p;
      if (p.mode === 'moi') S.Mi = runMoI(p);
      else if (p.mode === 'hinge') S.Hn = runHinge(p);
      else if (p.mode === 'ladder') S.Ld = runLadder(p);
      else if (p.mode === 'strike') S.St = runStrike(p);
      else if (p.mode === 'spin') S.Sp = runSpin(p);
      else S.Tp = runTop(p);
      S.ts = 0;
      const views = {
        moi: { theta: -1.1, phi: 0.35, dist: 4.6, target: [0, 0, 0.2] },
        hinge: { theta: -1.57, phi: 0.12, dist: 4.4, target: [0, 0, 0.5] },
        ladder: { theta: -1.35, phi: 0.2, dist: 4.4, target: [0.6, 0, 0.8] },
        strike: { theta: -1.0, phi: 0.85, dist: 4.2, target: [0.2, 0, 0] },
        spin: { theta: -1.3, phi: 0.35, dist: 4.2, target: [0, 0, 0.6] },
        gyro: { theta: -1.2, phi: 0.35, dist: 3.4, target: [0, 0, 0.8] }
      };
      if (!S.cam || S._view !== p.mode) { S.cam = Camera(views[p.mode]); S.cam.minDist = 1; S.cam.maxDist = 14; S._view = p.mode; S._narrowCam = false; }
    },

    step(S, dt) { if (S.p.run) S.ts += dt; },

    drawStage(S, g) {
      if (g.w < 660 && !S._narrowCam) { S.cam.dist *= 1.3; S._narrowCam = true; }
      const md = S.p.mode;
      if (md === 'moi') drawMoI(S, g); else if (md === 'hinge') drawHinge(S, g); else if (md === 'ladder') drawLadder(S, g);
      else if (md === 'strike') drawStrike(S, g); else if (md === 'spin') drawSpin(S, g); else drawTop(S, g);
    },

    plots: [
      { title: S => ({ moi: 'I about parallel axes: summed dots on I_cm + Md²', hinge: 'Hinge force through the first swing', ladder: 'Wall and floor forces — the wall force reaches zero',
                       strike: 'Velocity of each point of the rod just after the hit', spin: { skater: 'ω and kinetic energy as the arms come in', discs: 'Both spins, locking together', bead: 'The bead\'s distance and the rod\'s ω' }[S.p.ssub],
                       gyro: 'Tilt of the axle against time: nutation' })[S.p.mode],
        draw(S, g) {
          const p = S.p, th = g.theme, cy = '#3DD6F5', gr = '#7CF0B0', am = '#F5B451', pk = '#FF8FB0';
          if (p.mode === 'moi') {
            const Mi = S.Mi, f = []; for (let d = -p.size; d <= p.size + 1e-9; d += p.size / 40) f.push([d, Mi.Icm + Mi.M * d * d]);
            const P = g.Plot({ xmin: -p.size, xmax: p.size, ymin: 0, ymax: Math.max(...f.map(q => q[1])) * 1.1, xlabel: 'axis offset d (m)', ylabel: 'I (kg·m²)', xfmt: v => v.toFixed(2), yfmt: v => v.toExponential(1) }).frame();
            P.clip(() => { P.line(f, am, 1.6, [5, 3]); Mi.curve.forEach(q => P.dot(q[0], q[1], 3.5, cy)); P.dot(Mi.d, Mi.I, 6, gr, th['ink-950']); });
            P.tag(0, Mi.Icm, 'I_cm: the least of all parallel axes', th['text-2'], 'center', -10);
            return;
          }
          if (p.mode === 'hinge') {
            const Hn = S.Hn, pts = Hn.out.filter(q => q[0] <= (isFinite(Hn.per) ? Hn.per / 2 : 3)), mg = Hn.Mt * G;
            const P = g.Plot({ xmin: 0, xmax: pts[pts.length - 1][0], ymin: -1, ymax: Math.max(3, ...pts.map(q => q[5] / mg)) * 1.08, xlabel: 't (s)', ylabel: 'force ÷ Mg', xfmt: v => v.toFixed(2), yfmt: v => v.toFixed(1) }).frame();
            P.clip(() => { P.hline(0, g.alpha(th['text-3'], .6)); P.line(pts.map(q => [q[0], q[3] / mg]), cy, 1.6); P.line(pts.map(q => [q[0], q[4] / mg]), am, 1.6); P.line(pts.map(q => [q[0], q[5] / mg]), pk, 2.4); });
            P.tag(0, pts[0][5] / mg, 'total ' + (pts[0][5] / mg).toFixed(2) + ' Mg at release', pk, 'left', -10);
            P.tag(pts[pts.length - 1][0], pts[pts.length - 1][3] / mg, 'along the rod', cy, 'right', -8);
            P.tag(pts[pts.length - 1][0] * 0.4, pts[Math.floor(pts.length * 0.4)][4] / mg, 'across it', am, 'left', 12);
            return;
          }
          if (p.mode === 'ladder') {
            const Ld = S.Ld, mg = Ld.m * G;
            const P = g.Plot({ xmin: 0, xmax: Math.max(0.5, Ld.tEnd), ymin: -0.1, ymax: 1.2, xlabel: 't (s)', ylabel: 'force ÷ mg', xfmt: v => v.toFixed(2), yfmt: v => v.toFixed(1) }).frame();
            P.clip(() => { P.line(Ld.out.map(q => [q[0], q[3] / mg]), pk, 2.2); P.line(Ld.out.map(q => [q[0], q[4] / mg]), cy, 2.2); if (isFinite(Ld.tLeave)) P.vline(Ld.tLeave, g.alpha(am, .8), [3, 3]); });
            P.tag(0.02, Ld.out[0][4] / mg, 'floor', cy, 'left', -8); P.tag(0.02, Ld.out[0][3] / mg, 'wall', pk, 'left', 12);
            if (isFinite(Ld.tLeave)) P.tag(Ld.tLeave, 1.1, 'off the wall', am, 'right', 0);
            return;
          }
          if (p.mode === 'strike') {
            const St = S.St, pts = []; for (let i = 0; i <= 40; i++) { const y = -St.Lr / 2 + St.Lr * i / 40; pts.push([y, St.hinged ? St.w * (y + St.Lr / 2) : St.vcm + St.w * y]); }
            const lo = Math.min(0, ...pts.map(q => q[1])), hi = Math.max(...pts.map(q => q[1]));
            const P = g.Plot({ xmin: -St.Lr / 2, xmax: St.Lr / 2, ymin: lo - 0.1 * (hi - lo) - 0.01, ymax: hi * 1.1 + 0.01, xlabel: 'position along the rod from its centre (m)', ylabel: 'velocity (m/s)', xfmt: v => v.toFixed(2), yfmt: v => v.toFixed(2) }).frame();
            P.clip(() => { P.hline(0, g.alpha(th['text-3'], .7)); P.line(pts, cy, 2.4); P.vline(St.x, g.alpha(pk, .8), [3, 3]); if (!St.hinged && Math.abs(St.iar) <= St.Lr / 2) P.dot(St.iar, 0, 5, am, th['ink-950']); });
            P.tag(St.x, hi, 'struck here', pk, 'left', 0);
            return;
          }
          if (p.mode === 'spin') {
            const Sp = S.Sp, tt = S.ts % Sp.tEnd;
            if (Sp.kind === 'skater') {
              const P = g.Plot({ xmin: 0, xmax: 5, ymin: 0, ymax: Math.max(Sp.w2, Sp.K2) * 1.15, xlabel: 't (s)', ylabel: 'ω (rad/s) · KE (J)', xfmt: v => v.toFixed(0), yfmt: v => v.toFixed(0) }).frame();
              P.clip(() => { P.line(Sp.out.map(q => [q[0], q[1]]), cy, 2.2); P.line(Sp.out.map(q => [q[0], q[3]]), am, 2.2); P.vline(tt, g.alpha(gr, .7), [3, 3]); });
              P.tag(4.9, Sp.w2, 'ω', cy, 'right', -8); P.tag(4.9, Sp.K2, 'KE', am, 'right', -8);
              return;
            }
            if (Sp.kind === 'discs') {
              const hi = Math.max(...Sp.out.map(q => Math.max(Math.abs(q[1]), Math.abs(q[2])))) * 1.1;
              const P = g.Plot({ xmin: 0, xmax: 6, ymin: -hi, ymax: hi, xlabel: 't (s)', ylabel: 'ω (rad/s)', xfmt: v => v.toFixed(0), yfmt: v => v.toFixed(0) }).frame();
              P.clip(() => { P.hline(Sp.wc, g.alpha(th['text-2'], .6), [4, 3]); P.line(Sp.out.map(q => [q[0], q[1]]), cy, 2.2); P.line(Sp.out.map(q => [q[0], q[2]]), am, 2.2); P.vline(tt, g.alpha(gr, .7), [3, 3]); });
              P.tag(5.9, Sp.wc, 'common ω', th['text-2'], 'right', -8);
              return;
            }
            const P = g.Plot({ xmin: 0, xmax: Sp.tEnd, ymin: 0, ymax: Math.max(p.wr0, 1) * 1.1, xlabel: 't (s)', ylabel: 'ω (rad/s) · r × 20 (m)', xfmt: v => v.toFixed(2), yfmt: v => v.toFixed(0) }).frame();
            P.clip(() => { P.line(Sp.out.map(q => [q[0], q[3]]), cy, 2.2); P.line(Sp.out.map(q => [q[0], q[1] * 20]), pk, 2.2); P.vline(tt, g.alpha(gr, .7), [3, 3]); });
            P.tag(Sp.tEnd * 0.02, p.wr0, 'ω of the rod', cy, 'left', -8);
            return;
          }
          const Tp = S.Tp, pts = Tp.out.filter((_, i) => i % 2 === 0).map(q => [q[0], q[1] * 180 / Math.PI]);
          const lo = Math.min(...pts.map(q => q[1])), hi = Math.max(...pts.map(q => q[1]));
          const P = g.Plot({ xmin: 0, xmax: Tp.tEnd, ymin: lo - 0.5 - (hi - lo) * 0.1, ymax: hi + 0.5 + (hi - lo) * 0.1, xlabel: 't (s)', ylabel: 'θ (°)', xfmt: v => v.toFixed(1), yfmt: v => v.toFixed(1) }).frame();
          P.clip(() => { P.line(pts, am, 1.8); P.vline(S.ts % Tp.tEnd, g.alpha(gr, .7), [3, 3]); });
          P.tag(Tp.tEnd * 0.98, hi, 'nutation: ' + Tp.nut.toFixed(2) + '°', am, 'right', -8);
        } },
      { title: S => ({ moi: 'The falling weight: distance against time', hinge: 'Period against pivot position (small swings)', ladder: 'The path of the centre of mass',
                       strike: S.p.hinged ? 'Impulse from the hinge against the strike point' : 'Where the point at rest lies, for each strike point',
                       spin: { skater: 'Angular momentum and moment of inertia', discs: 'Energy: kinetic, and heat made', bead: 'The bead\'s path, seen from above' }[S.p.ssub],
                       gyro: 'Precession angle against time — and Ωt' })[S.p.mode],
        draw(S, g) {
          const p = S.p, th = g.theme, cy = '#3DD6F5', gr = '#7CF0B0', am = '#F5B451', pk = '#FF8FB0';
          if (p.mode === 'moi') {
            const Mi = S.Mi;
            if (!Mi.pts.length) { const P = g.Plot({ xmin: 0, xmax: 1, ymin: 0, ymax: 1, xlabel: 't', ylabel: 'y' }).frame(); P.tag(0.5, 0.5, 'bearing friction exceeds the weight\'s torque', pk, 'center', 0); return; }
            const pts = Mi.pts.filter((_, i) => i % 10 === 0).map(q => [q[0], q[1]]);
            const P = g.Plot({ xmin: 0, xmax: Mi.tFall * 1.05, ymin: 0, ymax: Mi.h * 1.1, xlabel: 't (s)', ylabel: 'distance fallen (m)', xfmt: v => v.toFixed(1), yfmt: v => v.toFixed(2) }).frame();
            P.clip(() => { P.line(pts, cy, 2.4); P.hline(Mi.h, g.alpha(pk, .7), [3, 3]); P.vline(Mi.tFall, g.alpha(am, .7), [3, 3]); });
            P.tag(Mi.tFall, 0.1, 't = ' + Mi.tFall.toFixed(3) + ' s → I = mr²(gt²/2h − 1)', am, 'right', 0);
            return;
          }
          if (p.mode === 'hinge') {
            const Hn = S.Hn, Lr = Hn.Lr, pts = [];
            for (let a = 0.01; a <= 0.5; a += 0.005) { const Ip = Hn.m * Lr * Lr / 12 + Hn.m * a * a * Lr * Lr; pts.push([a, TAU * Math.sqrt(Ip / (Hn.m * G * a * Lr))]); }
            const P = g.Plot({ xmin: 0, xmax: 0.5, ymin: 0, ymax: Math.min(8, Math.max(...pts.map(q => q[1]))), xlabel: 'pivot distance from centre (× L)', ylabel: 'period (s)', xfmt: v => v.toFixed(2), yfmt: v => v.toFixed(1) }).frame();
            P.clip(() => { P.line(pts, cy, 2.2); P.vline(1 / Math.sqrt(12), g.alpha(am, .8), [3, 3]); if (Hn.mE === 0 && isFinite(Hn.per)) P.dot(p.piv, Hn.per, 5.5, pk, th['ink-950']); });
            P.tag(1 / Math.sqrt(12), 0.5, 'pivot at k = L/√12: fastest', am, 'left', 0);
            return;
          }
          if (p.mode === 'ladder') {
            const Ld = S.Ld, pts = Ld.out.map(q => [q[1], Ld.h * Math.cos(q[2])]), arc = [];
            for (let i = 0; i <= 40; i++) { const a = i / 40 * Math.PI / 2; arc.push([Ld.h * Math.sin(a), Ld.h * Math.cos(a)]); }
            const P = g.Plot({ xmin: 0, xmax: Ld.Ll * 0.75, ymin: 0, ymax: Ld.h * 1.1, xlabel: 'x of the CM (m)', ylabel: 'height of the CM (m)', xfmt: v => v.toFixed(1), yfmt: v => v.toFixed(1) }).frame();
            P.clip(() => { P.line(arc, g.alpha(th['text-3'], .7), 1.2, [4, 3]); P.line(pts, am, 2.4); });
            P.tag(Ld.h * 0.05, Ld.h * 1.02, 'dashed: a circle of radius L/2 about the corner', th['text-2'], 'left', 0);
            return;
          }
          if (p.mode === 'strike') {
            const St = S.St, pts = [];
            for (let x = -1; x <= 1.0001; x += 0.02) { const r = runStrike(Object.assign({}, p, { xs: x })); pts.push([(x + 1) / 2, St.hinged ? r.Jh : (Math.abs(r.iar) < 5 * St.Lr ? r.iar : NaN)]); }
            const vals = pts.map(q => q[1]).filter(isFinite), lo = Math.min(...vals), hi = Math.max(...vals);
            const P = g.Plot({ xmin: 0, xmax: 1, ymin: lo - 0.1 * (hi - lo), ymax: hi + 0.1 * (hi - lo), xlabel: St.hinged ? 'strike distance from the hinge (× L)' : 'strike position (0 = one end, 1 = other)', ylabel: St.hinged ? 'hinge impulse (N·s)' : 'point at rest, from CM (m)', xfmt: v => v.toFixed(2), yfmt: v => v.toFixed(2) }).frame();
            P.clip(() => { P.hline(0, g.alpha(th['text-3'], .7)); P.line(pts.filter(q => isFinite(q[1])), cy, 2.2); if (St.hinged) P.vline(2 / 3, g.alpha(am, .8), [3, 3]); P.dot((p.xs + 1) / 2, St.hinged ? St.Jh : St.iar, 5.5, pk, th['ink-950']); });
            if (St.hinged) P.tag(2 / 3, hi, 'zero at 2L/3: the centre of percussion', am, 'left', 0);
            return;
          }
          if (p.mode === 'spin') {
            const Sp = S.Sp;
            if (Sp.kind === 'skater') {
              const P = g.Plot({ xmin: 0, xmax: 5, ymin: 0, ymax: Math.max(Sp.L0, Sp.I1) * 1.2, xlabel: 't (s)', ylabel: 'L (kg·m²/s) · I (kg·m²)', xfmt: v => v.toFixed(0), yfmt: v => v.toFixed(1) }).frame();
              P.clip(() => { P.line(Sp.out.map(q => [q[0], q[5]]), gr, 2.4); P.line(Sp.out.map(q => [q[0], q[5] / q[1]]), pk, 2.2); });
              P.tag(4.9, Sp.L0, 'L: flat', gr, 'right', -8); P.tag(4.9, Sp.I2, 'I', pk, 'right', -8);
              return;
            }
            if (Sp.kind === 'discs') {
              const P = g.Plot({ xmin: 0, xmax: 6, ymin: 0, ymax: Sp.K0 * 1.1, xlabel: 't (s)', ylabel: 'J', xfmt: v => v.toFixed(0), yfmt: v => v.toFixed(0) }).frame();
              P.clip(() => { P.line(Sp.out.map(q => [q[0], q[3]]), am, 2.2); P.line(Sp.out.map(q => [q[0], q[5]]), pk, 2.2); P.line(Sp.out.map(q => [q[0], q[3] + q[5]]), g.alpha(th['text-2'], .7), 1.2, [4, 3]); });
              P.tag(5.9, Sp.out[Sp.out.length - 1][3], 'kinetic', am, 'right', -8); P.tag(5.9, Sp.heat, 'heat', pk, 'right', -8);
              return;
            }
            const pts = Sp.out.map(q => [q[1] * Math.cos(q[4]), q[1] * Math.sin(q[4])]), R = Sp.Lh * 1.1;
            const P = g.Plot({ xmin: -R, xmax: R, ymin: -R * 0.6, ymax: R * 0.6, xlabel: 'x (m)', ylabel: 'y (m)', xfmt: v => v.toFixed(1), yfmt: v => v.toFixed(1) }).frame();
            const circ = []; for (let i = 0; i <= 60; i++) { const a = i / 60 * TAU; circ.push([Sp.Lh * Math.cos(a), Sp.Lh * Math.sin(a)]); }
            P.clip(() => { P.line(circ, g.alpha(th['text-3'], .6), 1, [3, 3]); P.line(pts, pk, 2.2); });
            return;
          }
          const Tp = S.Tp, pts = Tp.out.filter((_, i) => i % 3 === 0).map(q => [q[0], q[2]]);
          const P = g.Plot({ xmin: 0, xmax: Tp.tEnd, ymin: Math.min(0, ...pts.map(q => q[1])), ymax: Math.max(0.1, ...pts.map(q => q[1])) * 1.1, xlabel: 't (s)', ylabel: 'φ (rad)', xfmt: v => v.toFixed(1), yfmt: v => v.toFixed(1) }).frame();
          P.clip(() => { P.line([[0, 0], [Tp.tEnd, Tp.Om * Tp.tEnd]], g.alpha(am, .8), 1.4, [5, 3]); P.line(pts, cy, 2.2); });
          P.tag(Tp.tEnd * 0.98, Tp.Om * Tp.tEnd, 'Ωt, Ω = mgd/I₃ω', am, 'right', -8);
        } }
    ],

    readouts(S) {
      const p = S.p;
      if (p.mode === 'moi') { const Mi = S.Mi; return [
        { label: 'I (summed)', value: Mi.I.toExponential(4), unit: 'kg·m²', flag: 'accent' }, { label: 'Formula', value: Mi.IfPar.toExponential(4), unit: 'kg·m²' },
        { label: 'k = √(I/M)', value: (Mi.k * 100).toFixed(2), unit: 'cm' }, { label: 'I from the fall', value: isFinite(Mi.Imeas) ? Mi.Imeas.toExponential(4) : '—', unit: 'kg·m²', flag: 'ok' },
        { label: 'Fall time (1 m)', value: isFinite(Mi.tFall) ? Mi.tFall.toFixed(3) : '—', unit: 's' } ]; }
      if (p.mode === 'hinge') { const Hn = S.Hn; return [
        { label: 'Hinge force at release', value: (Hn.Nrel / (Hn.Mt * G)).toFixed(3), unit: 'Mg', flag: 'accent' }, { label: 'At the bottom', value: (Hn.Nbot / (Hn.Mt * G)).toFixed(3), unit: 'Mg' },
        { label: 'Period (timed)', value: isFinite(Hn.per) ? Hn.per.toFixed(4) : '—', unit: 's' }, { label: 'I about the pivot', value: Hn.Ip.toFixed(4), unit: 'kg·m²' } ]; }
      if (p.mode === 'ladder') { const Ld = S.Ld; return [
        { label: 'Leaves the wall at', value: isFinite(Ld.ratio) ? Ld.ratio.toFixed(4) : (Ld.holds ? 'stands' : '—'), unit: isFinite(Ld.ratio) ? '× start height' : '', flag: 'accent' },
        { label: 'μ needed to stand', value: Ld.muMin.toFixed(3), unit: '' }, { label: 'Time on the wall', value: isFinite(Ld.tLeave) ? Ld.tLeave.toFixed(3) : '—', unit: 's' } ]; }
      if (p.mode === 'strike') { const St = S.St; return [
        { label: 'Impulse', value: St.J.toFixed(4), unit: 'N·s', flag: 'accent' }, { label: 'CM speed', value: St.vcm.toFixed(4), unit: 'm/s' }, { label: 'ω', value: St.w.toFixed(4), unit: 'rad/s' },
        { label: St.hinged ? 'Hinge impulse' : 'Point at rest', value: St.hinged ? St.Jh.toFixed(4) : (isFinite(St.iar) ? Math.abs(St.iar).toFixed(4) : '∞'), unit: St.hinged ? 'N·s' : 'm', flag: St.hinged && Math.abs(St.Jh) < 1e-6 ? 'ok' : undefined } ]; }
      if (p.mode === 'spin') { const Sp = S.Sp;
        if (Sp.kind === 'skater') return [{ label: 'ω out → in', value: Sp.w1.toFixed(3) + ' → ' + Sp.w2.toFixed(3), unit: 'rad/s', flag: 'accent' }, { label: 'KE gained', value: (Sp.K2 - Sp.K1).toFixed(3), unit: 'J' }, { label: 'Work by the arms', value: Sp.W.toFixed(3), unit: 'J', flag: 'ok' }];
        if (Sp.kind === 'discs') return [{ label: 'Common ω', value: Sp.wcRun.toFixed(4), unit: 'rad/s', flag: 'accent' }, { label: 'Heat made', value: Sp.heat.toFixed(4), unit: 'J' }, { label: 'Formula', value: Sp.lossF.toFixed(4), unit: 'J', flag: 'ok' }];
        return [{ label: 'ω at the end', value: Sp.wEnd.toFixed(4), unit: 'rad/s', flag: 'accent' }, { label: 'Radial speed out', value: Sp.vExit ? Sp.vExit[0].toFixed(4) : '—', unit: 'm/s' }, { label: 'Tangential speed', value: Sp.vExit ? Sp.vExit[1].toFixed(4) : '—', unit: 'm/s' }]; }
      const Tp = S.Tp; return [
        { label: 'Precession (measured)', value: Tp.Omeas.toFixed(5), unit: 'rad/s', flag: 'accent' }, { label: 'mgd/(I₃ω₃)', value: Tp.Om.toFixed(5), unit: 'rad/s' },
        { label: 'Nutation', value: Tp.nut.toFixed(3), unit: '°' }, { label: 'Spin L', value: Tp.L.toFixed(4), unit: 'kg·m²/s' } ];
    },

    equation(S) {
      const p = S.p;
      if (p.mode === 'moi') return E.v('I') + ' ' + E.op('=') + ' Σ' + E.v('m') + E.v('r') + '⊥² ' + E.op('=') + ' ' + E.v('I') + E.sub('cm') + ' ' + E.op('+') + ' ' + E.v('Md') + '² ' + E.op('=') + ' ' + E.n(S.Mi.I, 'kg·m²') + ' · ' + E.v('I') + ' ' + E.op('=') + ' ' + E.v('mr') + '²(' + E.frac(E.v('gt') + '²', '2' + E.v('h')) + ' ' + E.op('−') + ' 1)';
      if (p.mode === 'hinge') return E.v('I') + E.sub('p') + 'θ\'\' ' + E.op('=') + ' ' + E.op('−') + E.v('Mgd') + ' sin θ · ' + E.v('N') + ' ' + E.op('=') + ' ' + E.v('M') + E.v('a') + E.sub('cm') + ' ' + E.op('−') + ' ' + E.v('M') + E.v('g') + ' → ' + E.n(S.Hn.Nrel / (S.Hn.Mt * G), 'Mg') + ' at release';
      if (p.mode === 'ladder') return 'cos θ' + E.sub('leave') + ' ' + E.op('=') + ' ' + E.frac('2', '3') + ' cos θ₀ (no friction) · stands if tan θ ≤ 2μ';
      if (p.mode === 'strike') return E.v('J') + ' ' + E.op('=') + ' ' + E.frac('(1 + ' + E.v('e') + ')' + E.v('u'), '1/' + E.v('m') + ' + 1/' + E.v('M') + ' + ' + E.v('x') + '²/' + E.v('I') + E.sub('cm')) + ' · ' + E.v('x') + ' · ' + E.v('y') + E.sub('rest') + ' ' + E.op('=') + ' ' + E.v('k') + '² · centre of percussion at 2' + E.v('L') + '/3';
      if (p.mode === 'spin') return E.v('L') + ' ' + E.op('=') + ' ' + E.v('I') + 'ω ' + E.op('=') + ' const · ' + E.v('K') + ' ' + E.op('=') + ' ' + E.frac(E.v('L') + '²', '2' + E.v('I')) + ' is not';
      return 'Ω ' + E.op('=') + ' ' + E.frac('τ', E.v('L')) + ' ' + E.op('=') + ' ' + E.frac(E.v('mgd'), E.v('I') + '₃ω₃') + ' ' + E.op('=') + ' ' + E.n(S.Tp.Om, 'rad/s');
    },

    eqNote: '<b>Every number here comes out of an integration or a sum.</b> The moment of inertia is added up element by element, so the ' +
      'parallel- and perpendicular-axis theorems are checks, not inputs. Hinge and wall forces are solved from Newton\'s laws for the body at ' +
      'each step, which is how you catch the moment a contact is lost. Collisions use the impulse equations with restitution; the gyroscope ' +
      'uses the full Euler–Lagrange equations of a heavy symmetric top, so the textbook precession rate appears as the average of a motion ' +
      'that actually nods.',

    problems: [
      { source: 'JEE Main pattern · moment of inertia of a rod',
        q: 'A uniform rod of mass 1.0 kg and length 1.0 m. What is its moment of inertia about an axis through one end, perpendicular to it, in kg·m²?',
        params: { mode: 'moi', body: 'rod', Mkg: 1, size: 1, ax: 'y', off: 0.5, mhang: 0.2, raxle: 2, fric: 0 },
        predict: { label: 'I', unit: 'kg·m²', tol: 0.01 },
        measure: S => S.Mi.I,
        working: 'I_cm = ML²/12, and the parallel-axis theorem adds M(L/2)²: ML²/12 + ML²/4 = <b>ML²/3 = 0.333 kg·m²</b>. The sum over 801 elements gives 0.3335.' },
      { source: 'JEE Advanced pattern · a cube about its diagonal',
        q: 'A uniform solid cube of mass 1.0 kg and side 1.0 m. What is its moment of inertia about a body diagonal, in kg·m²?',
        params: { mode: 'moi', body: 'cube', Mkg: 1, size: 1, ax: 'diag', off: 0, mhang: 0.2, raxle: 2, fric: 0 },
        predict: { label: 'I', unit: 'kg·m²', tol: 0.01 },
        measure: S => S.Mi.I,
        working: 'A cube\'s inertia tensor about its centre is Ma²/6 times the unit matrix: the same for EVERY axis through the centre. So I = <b>Ma²/6 = 0.167 kg·m²</b>, as about a face axis.' },
      { source: 'JEE Main pattern · a flywheel experiment',
        q: 'A 2.0 kg disc of diameter 0.40 m turns on an axle of radius 2.0 cm. A 0.20 kg mass on a string wound round the axle falls from rest. How long does it take to fall 1.0 m, in s?',
        params: { mode: 'moi', body: 'disc', Mkg: 2, size: 0.4, ax: 'z', off: 0, mhang: 0.2, raxle: 2, fric: 0 },
        predict: { label: 'time', unit: 's', tol: 0.01 },
        measure: S => S.Mi.tFall,
        working: 'I = ½MR² = 0.040 kg·m². a = mgr²/(I + mr²) = 0.2 × 9.81 × 4 × 10⁻⁴/(0.040 + 8 × 10⁻⁵) = 0.0196 m/s². t = √(2h/a) = <b>10.1 s</b>. Invert it and a stopwatch measures I.' },
      { source: 'JEE Advanced pattern · the hinge at release',
        q: 'A uniform rod of mass m, hinged at one end, is released from rest horizontal. What is the force at the hinge just after release, as a multiple of mg?',
        params: { mode: 'hinge', Lrod: 1, mrod: 1, piv: 0.5, mend: 0, th0: 90 },
        predict: { label: 'hinge force', unit: '× mg', tol: 0.01 },
        measure: S => S.Hn.Nrel / (S.Hn.Mt * G),
        working: 'α = τ/I = (mgL/2)/(mL²/3) = 3g/2L, so the CM accelerates down at αL/2 = 3g/4. Then mg − N = m(3g/4) → N = <b>mg/4</b>. The hinge holds up only a quarter of the weight at that instant.' },
      { source: 'JEE Advanced pattern · the hinge at the bottom',
        q: 'The same rod swings down. What is the hinge force when it passes the vertical, as a multiple of mg?',
        params: { mode: 'hinge', Lrod: 1, mrod: 1, piv: 0.5, mend: 0, th0: 90 },
        predict: { label: 'hinge force', unit: '× mg', tol: 0.01 },
        measure: S => S.Hn.Nbot / (S.Hn.Mt * G),
        working: 'Energy: ½(mL²/3)ω² = mgL/2, so ω² = 3g/L. The CM (at L/2) needs a centripetal force mω²L/2 = 3mg/2. N = mg + 3mg/2 = <b>5mg/2</b>.' },
      { source: 'JEE Advanced pattern · a sliding ladder',
        q: 'A ladder slides down a frictionless wall on a frictionless floor, starting from rest. At what fraction of its starting height does its top leave the wall?',
        params: { mode: 'ladder', Llad: 4, mlad: 10, muf: 0, lth0: 20 },
        predict: { label: 'fraction', unit: '', tol: 0.01 },
        measure: S => S.Ld.ratio,
        working: 'While in contact the CM moves on a circle of radius L/2, and energy gives ω² = 3g(cos θ₀ − cos θ)/L. The wall force is m·ẍ_cm, which changes sign when cos θ = (2/3)cos θ₀: the top leaves at <b>2/3</b> of its starting height.' },
      { source: 'JEE Advanced pattern · centre of percussion',
        q: 'A uniform rod of length 1.00 m is hinged at one end. How far from the hinge must it be struck, perpendicularly, so that the hinge feels no impulse, in m?',
        params: { mode: 'strike', Mr: 1, Lstr: 1, mb: 0.1, ub: 10, eres: 0, hinged: true, xs: 1 / 3 },
        predict: { label: 'distance', unit: 'm', tol: 0.01 },
        measure: S => { let a = -0.99, b = 0.99; const f = x => runStrike(Object.assign({}, S.p, { xs: x })).Jh; for (let i = 0; i < 60; i++) { const m = (a + b) / 2; if (f(a) * f(m) <= 0) b = m; else a = m; } return ((a + b) / 2 + 1) / 2 * S.p.Lstr; },
        working: 'With no hinge impulse, J = Mv_cm and Jd = I_pω with v_cm = ωL/2: d = I_p/(ML/2) = (ML²/3)/(ML/2) = <b>2L/3 = 0.667 m</b>. That is the "sweet spot" of a bat.' },
      { source: 'JEE Main pattern · pulling in the arms',
        q: 'A student (I = 2.0 kg·m² with the stool) holds 2.0 kg dumbbells at 0.80 m, turning at 2.0 rad/s, then pulls them in to 0.15 m. What is the new ω, in rad/s?',
        params: { mode: 'spin', ssub: 'skater', I0: 2, mdb: 2, rout: 0.8, rin: 0.15, w0: 2 },
        predict: { label: 'ω', unit: 'rad/s', tol: 0.01 },
        measure: S => S.Sp.w2,
        working: 'I₁ = 2 + 2 × 2 × 0.64 = 4.56; I₂ = 2 + 2 × 2 × 0.0225 = 2.09. ω₂ = I₁ω₁/I₂ = <b>4.36 rad/s</b>. The kinetic energy rises from 9.12 to 19.9 J: the arms did 10.8 J of work.' },
      { source: 'JEE Advanced pattern · spins that lock together',
        q: 'A disc (I₂ = 0.10 kg·m², at rest) is dropped onto a disc (I₁ = 0.20 kg·m²) spinning at 20 rad/s on the same axle. How much kinetic energy is lost when they turn together, in J?',
        params: { mode: 'spin', ssub: 'discs', Id1: 0.2, Id2: 0.1, tauf: 0.5, wd1: 20, wd2: 0 },
        predict: { label: 'energy lost', unit: 'J', tol: 0.01 },
        measure: S => S.Sp.heat,
        working: 'ω = I₁ω₁/(I₁ + I₂) = 13.33 rad/s. Loss = I₁I₂ω₁²/2(I₁ + I₂) = 0.2 × 0.1 × 400/(2 × 0.3) = <b>13.3 J</b>, whatever the friction torque. Friction only decides how long it takes.' },
      { source: 'JEE Advanced pattern · a bead on a rotating rod',
        q: 'A rod (I = 0.050 kg·m² about its centre, half-length 0.50 m) spins freely at 10 rad/s with a 0.10 kg bead at r = 5 cm. The bead slides out without friction. What is its radial speed as it leaves the end, in m/s?',
        params: { mode: 'spin', ssub: 'bead', Irod: 0.05, mbead: 0.1, Lhalf: 0.5, r0: 0.05, wr0: 10 },
        predict: { label: 'radial speed', unit: 'm/s', tol: 0.01 },
        measure: S => S.Sp.vExit[0],
        working: 'L: (0.05 + 0.1 × 0.0025) × 10 = (0.05 + 0.1 × 0.25)ω → ω = 6.70 rad/s. Energy: ½ × 0.05025 × 100 = ½ × 0.075 × 6.70² + ½ × 0.1 v_r² → v_r = <b>4.07 m/s</b>.' },
      { source: 'JEE Advanced pattern · gyroscopic precession',
        q: 'A 0.50 kg wheel (a disc of radius 8.0 cm) spins at 40 rev/s with its axle horizontal, pivoted 10 cm from the wheel. What is its precession rate, in rad/s?',
        params: { mode: 'gyro', mtop: 0.5, dtop: 0.1, Rw: 0.08, spin: 40, tilt: 90, start: 'drop' },
        predict: { label: 'Ω', unit: 'rad/s', tol: 0.01 },
        measure: S => S.Tp.Omeas,
        working: 'L = I₃ω = ½ × 0.5 × 0.0064 × 251.3 = 0.402 kg·m²/s; τ = mgd = 0.491 N·m; Ω = τ/L = <b>1.22 rad/s</b>. The integrated wheel averages 1.216: it nods (nutates) about the steady path.' }
    ],

    walkthrough: [
      { title: '1 · I is a sum',
        body: 'A disc built from 4000 equal mass elements. Change the axis.',
        ask: 'About a diameter, is I half of what it is about the symmetry axis?',
        reveal: '<b>Yes: MR²/4 against MR²/2.</b> For any flat body I_z = I_x + I_y, and by symmetry I_x = I_y. The sum shows it directly.',
        params: { mode: 'moi', body: 'disc', Mkg: 1, size: 1, ax: 'x', off: 0, mhang: 0.2, raxle: 2, fric: 0 } },
      { title: '2 · A surprise in a cube',
        body: 'A solid cube, axis along a body diagonal.',
        ask: 'The diagonal passes closer to the far corners. Is I bigger or smaller than about a face axis?',
        reveal: '<b>Exactly the same, Ma²/6.</b> A cube is as symmetric as a sphere as far as rotation cares: its inertia tensor is a multiple of the unit matrix.',
        params: { mode: 'moi', body: 'cube', Mkg: 1, size: 1, ax: 'diag', off: 0, mhang: 0.2, raxle: 2, fric: 0 } },
      { title: '3 · The hinge lets go (almost)',
        body: 'A rod hinged at one end, released horizontal.',
        ask: 'How much of the rod\'s weight does the hinge hold at the first instant?',
        reveal: '<b>A quarter.</b> The CM starts falling at 3g/4, so the hinge supplies only mg/4. At the bottom it pulls with 5mg/2.',
        params: { mode: 'hinge', Lrod: 1, mrod: 1, piv: 0.5, mend: 0, th0: 90 } },
      { title: '4 · The ladder leaves the wall',
        body: 'A ladder on a frictionless floor and wall.',
        ask: 'Does the top stay on the wall all the way down?',
        reveal: '<b>No: it leaves at two-thirds of its starting height.</b> Until then the CM runs on a circle about the corner; the wall force is what keeps it there, and it falls to zero.',
        params: { mode: 'ladder', Llad: 4, mlad: 10, muf: 0, lth0: 20 } },
      { title: '5 · Strike a rod on ice',
        body: 'A ball hits a rod lying on ice, near one end.',
        ask: 'Which point of the rod is at rest just after the hit?',
        reveal: '<b>A point on the other side of the centre</b>, at k²/x from it (k² = L²/12). Strike at the end and it is at L/6 from the centre. Hinge the rod there, and it would feel no impulse.',
        params: { mode: 'strike', Mr: 1, Lstr: 1, mb: 0.1, ub: 10, eres: 0, hinged: false, xs: 1 } },
      { title: '6 · Pull in your arms',
        body: 'A student on a turntable pulls in two dumbbells.',
        ask: 'ω more than doubles. Where did the extra kinetic energy come from?',
        reveal: '<b>From the arms.</b> They pull the dumbbells inward against their tendency to fly out, doing 10.8 J of work, exactly the gain. L is conserved; K = L²/2I is not.',
        params: { mode: 'spin', ssub: 'skater', I0: 2, mdb: 2, rout: 0.8, rin: 0.15, w0: 2 } },
      { title: '7 · A gyroscope does not fall',
        body: 'A spinning wheel, axle horizontal, supported at one end only.',
        ask: 'Gravity pulls it down. Why does it swing round instead?',
        reveal: '<b>The torque of gravity is horizontal.</b> dL/dt = τ turns L sideways: the axle precesses at Ω = mgd/L. Released from rest, it first dips and nods (nutation) around that steady path.',
        params: { mode: 'gyro', mtop: 0.5, dtop: 0.1, Rw: 0.08, spin: 40, tilt: 90, start: 'drop' } }
    ],

    quiz: [
      { q: 'A uniform rod hinged at one end is released from horizontal. Its angular acceleration at that instant is:',
        options: ['3g/2L', 'g/L', '3g/L', 'g/2L'], answer: 0, why: 'τ = mgL/2, I = mL²/3.' },
      { q: 'The moment of inertia of a uniform cube about its body diagonal, compared with about an axis through its centre parallel to an edge, is:',
        options: ['Equal', 'Larger', 'Smaller', 'Twice'], answer: 0, why: 'The inertia tensor of a cube about its centre is isotropic: Ma²/6 about every axis through the centre.' },
      { q: 'A ladder slides on a frictionless floor and wall. It loses contact with the wall when its top is at:',
        options: ['2/3 of its initial height', 'Half its initial height', 'The floor', '1/3 of its initial height'], answer: 0, why: 'cos θ = (2/3)cos θ₀.' },
      { q: 'A rod hinged at one end is struck perpendicularly. The hinge feels no impulsive reaction if struck at:',
        options: ['2L/3 from the hinge', 'L/2', 'The free end', 'L/3 from the hinge'], answer: 0, why: 'The centre of percussion: d = I_p/(M·L/2) = 2L/3.' },
      { q: 'A skater pulls in her arms and her angular speed doubles. Her rotational kinetic energy:',
        options: ['Doubles', 'Stays the same', 'Halves', 'Quadruples'], answer: 0, why: 'K = L²/2I; I halves, so K doubles. The extra work is done by her muscles.' },
      { q: 'Two discs with the same axis, spins ω₁ and ω₂, are brought into contact and lock together. The energy lost depends on:',
        options: ['I₁I₂(ω₁ − ω₂)²/2(I₁ + I₂) — not on the friction', 'Only the friction coefficient', 'Nothing: energy is conserved', 'Only the time of contact'], answer: 0, why: 'Like a perfectly inelastic collision for spins. Friction decides only how long it takes.' },
      { q: 'A gyroscope\'s wheel is spun faster. Its precession rate:',
        options: ['Decreases', 'Increases', 'Stays the same', 'Becomes zero'], answer: 0, why: 'Ω = mgd/(I₃ω₃): more spin, slower precession.' },
      { q: 'A rod on frictionless ice is struck at one end. Immediately after, the point at rest is at a distance from the centre of:',
        options: ['L/6, on the other side', 'L/2', 'L/3, on the same side', 'Zero'], answer: 0, why: 'x·y = k² = L²/12 with x = L/2 gives y = L/6.' }
    ],

    notes: '<b>Where this shows up in the paper.</b><ul>' +
      '<li><b>Moment of inertia</b>: rod ML²/12 and ML²/3, ring MR², disc MR²/2 and MR²/4, sphere 2MR²/5, shell 2MR²/3, cone 3MR²/10, cube Ma²/6 about any axis through its centre; parallel and perpendicular axis theorems; radius of gyration.</li>' +
      '<li><b>Torque and hinges</b>: τ = Iα; hinge reactions from Newton\'s law for the CM; physical pendulum T = 2π√(I/mgd), shortest when d = k.</li>' +
      '<li><b>Contacts</b>: ladders (friction needed tan θ ≤ 2μ; leaves the wall at 2/3 height if frictionless); a rod falling or sliding.</li>' +
      '<li><b>Impulse</b>: J = Δp, Jx = ΔL; restitution along the line of impact; centre of percussion 2L/3; x·y = k² for conjugate points.</li>' +
      '<li><b>Angular momentum</b>: conserved when τ_ext = 0; K = L²/2I not conserved; coupled discs lose I₁I₂Δω²/2(I₁ + I₂); gyroscope Ω = mgd/Iω.</li></ul>' +
      '<div class="pyq"><em>Trap to avoid</em> — assuming the hinge force at release is mg. The rod is accelerating downward; the hinge supplies only mg/4.</div>' +
      '<div class="pyq"><em>Trap to avoid</em> — conserving kinetic energy when a spinning student pulls her arms in, or two discs lock. Only L is conserved.</div>'
  });

  /* =========================================================================
     24 · ROLLING AND FRICTION

     Rolling is never assumed. Each body carries its translational and its
     rotational equation, and friction is found from them: the static
     friction rolling would need is computed and compared with μN, and if it
     cannot be supplied the body slips, with kinetic friction opposing the
     slip. Everything the exam asks — the point at rest, the 8R cycloid, the
     5/7 of a bowling ball, which way a spool rolls, a cylinder on a pulled
     plank, whether a pushed block slides or tips — comes out of that.
     ========================================================================= */
  const RB = { sphere: { name: 'solid sphere', k: 0.4 }, cylinder: { name: 'solid cylinder', k: 0.5 }, shell: { name: 'hollow sphere', k: 2 / 3 }, ring: { name: 'ring', k: 1 } };

  /* ---- rolling kinematics: a wheel moving at v with spin ω (ratio Rω/v = ρ; ρ = 1 is rolling) ---- */
  function runWheel(p) {
    const R = p.Rw2, v = p.vw, w = p.rho * v / R, T = TAU / Math.max(1e-6, Math.abs(w));
    // trace a rim point and a mid-spoke point for one revolution, and add up the rim point's path
    const rim = [], mid = [], n = 2000;
    let len = 0, prev = null;
    for (let i = 0; i <= n; i++) {
      const t = T * i / n, a = w * t;
      const pr = [v * t - R * Math.sin(a), R - R * Math.cos(a)], pm = [v * t - R / 2 * Math.sin(a), R - R / 2 * Math.cos(a)];
      rim.push(pr); mid.push(pm);
      if (prev) len += Math.hypot(pr[0] - prev[0], pr[1] - prev[1]);
      prev = pr;
    }
    // speed of every rim point, by angle from the contact point
    const sp = []; for (let d = 0; d <= 360; d += 2) { const a = d * Math.PI / 180, vx = v - w * R * Math.cos(a), vy = w * R * Math.sin(a) * 0 + (w * R * Math.sin(a)) * 0; sp.push([d, Math.hypot(v - w * R * Math.cos(a), w * R * Math.sin(a))]); void vx; void vy; }
    // for the stage: one cycle is the time the axle takes to move 2πR (finite even when the wheel skids with ω = 0)
    const Tc = TAU * R / Math.max(1e-6, Math.abs(v)), rimD = [], midD = [];
    for (let i = 0; i <= 600; i++) { const t = Tc * i / 600, a = w * t; rimD.push([v * t - R * Math.sin(a), R - R * Math.cos(a)]); midD.push([v * t - R / 2 * Math.sin(a), R - R / 2 * Math.cos(a)]); }
    const skid = Math.abs(w) < 1e-6;                     // ω = 0: no turn to measure, no point at rest
    return { R, v, w, T, Tc, rimD, midD, rim: skid ? rimD : rim, mid: skid ? midD : mid, len: skid ? NaN : len, skid, sp, iar: v / Math.max(1e-9, w), top: v + w * R, bottom: v - w * R, dist: v * T };
  }

  /* ---- a ball launched with spin on a rough floor ---- */
  function runBowl(p) {
    const B = RB[p.rshape], k = B.k, R = p.Rb, m = p.mbl, mu = p.mub, I = k * m * R * R;
    let v = p.v0, W = p.spin0 * TAU, x = 0, ang = 0, t = 0, tRoll = NaN, xRoll = NaN, heat = 0;
    const dt = 0.0005, out = [], K0 = 0.5 * m * v * v + 0.5 * I * W * W;
    while (t < 8) {
      const u = v - R * W;                                 // the contact point's slip velocity
      if (out.length === 0 || t - out[out.length - 1][0] >= 0.01) out.push([t, x, v, R * W, ang, Math.abs(u) > 1e-6]);
      if (Math.abs(u) > 1e-6) {
        const f = -mu * m * G * Math.sign(u);
        const v2 = v + f / m * dt, W2 = W - R * f / I * dt;
        heat += mu * m * G * Math.abs(u) * dt;
        if (Math.sign(v2 - R * W2) !== Math.sign(u)) { const vr = (m * v * R + I * W) / (m * R + I / R); v = vr; W = vr / R; tRoll = t; xRoll = x; }
        else { v = v2; W = W2; }
      }
      x += v * dt; ang += W * dt; t += dt;
    }
    const vf = (p.v0 + k * R * p.spin0 * TAU) / (1 + k), K1 = 0.5 * m * v * v + 0.5 * I * W * W;
    return { B, k, R, m, mu, I, out, tRoll, xRoll, vRun: v, vf, K0, K1, heat, tForm: Math.abs(p.v0 - R * p.spin0 * TAU) / (mu * G * (1 + 1 / k)) };
  }

  /* ---- a spool pulled by its thread, and a yo-yo ---- */
  function spoolAcc(p, phi) {
    const m = p.msp, R = p.Rsp, r = p.rsp, k = p.ksp, F = p.Fsp, I = k * m * R * R, c = Math.cos(phi);
    const N = m * G - F * Math.sin(phi), fRoll = -F * (r / R + k * c) / (1 + k), a = F * (c - r / R) / (m * (1 + k));
    return { a, fRoll, N, holds: N > 0 && Math.abs(fRoll) <= p.musp * N, I };
  }
  function runSpool(p) {
    const m = p.msp, R = p.Rsp, r = p.rsp, k = p.ksp, F = p.Fsp, mu = p.musp, phi = p.phsp * Math.PI / 180, I = k * m * R * R;
    if (p.spsub === 'yoyo') {
      const ay = G / (1 + I / (m * r * r)), T = m * (G - ay), out = [];
      let y = 0, v = 0, t = 0; const dt = 0.002, Lstr = 1.0;
      while (t < 4 && y < Lstr) { if (Math.round(t / dt) % 5 === 0) out.push([t, y, v, v / r]); v += ay * dt; y += v * dt; t += dt; }
      return { kind: 'yoyo', ay, T, out, tEnd: t, I, m, r, R, Lstr, ratio: T / (m * G) };
    }
    const st = spoolAcc(p, phi), out = [];
    let x = 0, v = 0, W = 0, ang = 0, t = 0, slipping = !st.holds;
    const dt = 0.001, cphi = Math.cos(phi);
    while (t < 3) {
      let a, al;
      if (!slipping) { a = st.a; al = a / R; }
      else {
        const u = v - R * W, N = Math.max(0, st.N);
        // kinetic friction opposes the slip; if there is no slip yet, it opposes the slip the forces would cause
        let dir = Math.sign(u);
        if (Math.abs(u) < 1e-6) { const a0 = F * cphi / m, al0 = -F * r / I; dir = Math.sign(a0 - R * al0) || 1; }
        const f = -mu * N * dir;
        a = (F * cphi + f) / m; al = (-F * r - R * f) / I;
      }
      if (Math.round(t / dt) % 10 === 0) out.push([t, x, v, ang, slipping]);
      v += a * dt; W += al * dt; x += v * dt; ang += W * dt; t += dt;
    }
    return { kind: 'spool', st, out, slipping, phi, crit: Math.acos(Math.min(1, r / R)) * 180 / Math.PI, I, m, R, r, F, mu, tEnd: 3 };
  }

  /* ---- a cylinder on a plank that is pulled, on a frictionless floor ---- */
  function runPlank(p) {
    const M = p.Mpl, m = p.mcy, R = p.Rcy, k = RB[p.cshape].k, I = k * m * R * R, F = p.Fpl, mu = p.mupl;
    let A = F / (M + m * k / (1 + k)), a = A * k / (1 + k), f = m * a, rolls = f <= mu * m * G, al;
    if (!rolls) { f = mu * m * G; a = f / m; A = (F - f) / M; al = f * R / I; }
    else al = (A - a) / R;
    // integrate positions until the cylinder reaches the back of the plank
    const Lp = p.Lpl, out = []; let X = 0, V = 0, x = Lp * 0.75, v = 0, ang = 0, W = 0, t = 0, tOff = NaN; const dt = 0.002;
    while (t < 6) {
      if (Math.round(t / dt) % 5 === 0) out.push([t, X, x, ang, V, v]);
      V += A * dt; v += a * dt; W += al * dt; X += V * dt; x += v * dt; ang += W * dt; t += dt;
      if (x - X < 0) { tOff = t; break; }
    }
    const Fcrit = mu * m * G * (M + m * k / (1 + k)) * (1 + k) / (m * k);
    return { M, m, R, k, F, mu, A, a, f, rolls, al, out, Lp, tOff, Fcrit, tEnd: out[out.length - 1][0] };
  }

  /* ---- push a block: does it slide or tip? ---- */
  function runTopple(p) {
    const m = p.mbk, b = p.bbk, h = p.hbk, hF = p.hF * h, mu = p.mubk, rate = p.Frate;
    const Fs = mu * m * G, Ft = m * G * b / (2 * hF), first = Ft < Fs ? 'tips' : 'slides', Fth = Math.min(Fs, Ft);
    const Ie = m * (b * b + h * h) / 3, out = [];
    let t = 0, th = 0, w = 0, x = 0, v = 0, done = false, tEvent = Fth / rate;
    const dt = 0.001;
    while (t < tEvent + 4 && !done) {
      const F = Math.min(rate * t, Fth * 1.05);
      const xN = Math.min(b / 2, F * hF / (m * G));
      if (t < tEvent || first === 'slides') {
        if (first === 'slides' && t >= tEvent) { const acc = (F - mu * m * G) / m; v += acc * dt; x += v * dt; }
      } else {
        const tq = F * (b * Math.sin(th) + hF * Math.cos(th)) + m * G * (h / 2 * Math.sin(th) - b / 2 * Math.cos(th));
        w += tq / Ie * dt; th += w * dt;
        if (th >= Math.PI / 2) { th = Math.PI / 2; done = true; }
        if (th < 0) { th = 0; w = 0; }
      }
      if (Math.round(t / dt) % 10 === 0) out.push([t, F, xN, th, x, Math.min(F, Fs)]);
      t += dt;
    }
    return { m, b, h, hF, mu, Fs, Ft, first, Fth, tEvent, out, tEnd: out[out.length - 1][0], muCrit: b / (2 * hF) };
  }
  function runPlankAcc(p, F) {
    const M = p.Mpl, m = p.mcy, k = RB[p.cshape].k, mu = p.mupl;
    let A = F / (M + m * k / (1 + k)), a = A * k / (1 + k);
    if (m * a > mu * m * G) { a = mu * G; A = (F - mu * m * G) / M; }
    return { A, a };
  }

  /* a wheel: tyre, rim, spokes and hub, turned by angle a about the axis along y, centred at c (scene units), radius r */
  function wheel(F, c, r, a, o) {
    o = o || {};
    const ring = (rr, z0) => { const pts = []; for (let i = 0; i <= 56; i++) { const t = i / 56 * TAU; pts.push([c[0] + rr * Math.cos(t), c[1] + (z0 || 0), c[2] + rr * Math.sin(t)]); } return pts; };
    R3.tube(F, ring(r * 0.93), r * 0.07, o.tyre || '#23272F', { segments: 10, round: false });
    R3.tube(F, ring(r * 0.84), r * 0.025, '#AEB6C4', { segments: 8, round: false });
    for (let k = 0; k < (o.spokes || 8); k++) { const t = -a + k / (o.spokes || 8) * TAU; R3.cylinder(F, c, [c[0] + r * 0.84 * Math.cos(t), c[1], c[2] + r * 0.84 * Math.sin(t)], r * 0.018, '#C9D2DE', { segments: 6, shadow: false, caps: false }); }
    R3.cylinder(F, [c[0], c[1] - r * 0.12, c[2]], [c[0], c[1] + r * 0.12, c[2]], r * 0.1, '#5A6478', { segments: 16, shadow: false });
    const mk = [c[0] + r * 0.93 * Math.cos(-a - Math.PI / 2), c[1] - r * 0.08, c[2] + r * 0.93 * Math.sin(-a - Math.PI / 2)];
    R3.sphere(F, mk, r * 0.07, '#FF6B5A', { shadow: false, vivid: true });
    return mk;
  }

  /* ======================= 1 · the rolling wheel ======================= */
  function drawWheel(S, g) {
    const ctx = g.ctx, th = g.theme, p = S.p, cam = S.cam, Wh = S.Wh;
    const F = R3.Frame(ctx, cam, { ambient: 0.35, floorZ: 0 });
    const ks = 0.45 / Wh.R, Tc = Wh.Tc, tt = S.ts % (2 * Tc), xc = (Wh.v * tt - Wh.v * Tc) * ks, a = Wh.w * tt;
    R3.plane(F, [-3.3, -0.8, 0], [6.6, 0, 0], [0, 1.6, 0], '#3A3F4A', { grid: 12, gridAlpha: 0.12, bias: F.GROUND });
    const c = [xc, 0, Wh.R * ks];
    wheel(F, c, Wh.R * ks, a);
    // traces: the marked rim point and a mid-spoke point, from the start of this cycle
    const n = Math.min(Wh.rimD.length - 1, Math.round(((tt % Tc) / Tc) * (Wh.rimD.length - 1)));
    const off = -Wh.v * Tc * ks + (tt >= Tc ? Wh.v * Tc * ks : 0);
    path3(F, Wh.rimD.slice(0, n + 1).map(q => [off + q[0] * ks, -0.09, q[1] * ks]), '#FF8A7A', { alpha: 0.9, width: 1.8, chunk: 4 });
    path3(F, Wh.midD.slice(0, n + 1).map(q => [off + q[0] * ks, -0.09, q[1] * ks]), '#FFD36B', { alpha: 0.6, width: 1.2, chunk: 4 });
    // velocity of rim points: v_cm + ω × r ; the point at rest (the instantaneous axis)
    const iar = [c[0], 0.1, c[2] - (Wh.skid ? 0 : Wh.iar) * ks];
    for (let k = 0; k < 8; k++) {
      const t = k / 8 * TAU + Math.PI / 8, pr = [c[0] + Wh.R * ks * Math.cos(t), 0.1, c[2] + Wh.R * ks * Math.sin(t)];
      const vx = Wh.v + Wh.w * Wh.R * Math.sin(t), vz = -Wh.w * Wh.R * Math.cos(t), sc = 0.12;
      R3.arrow(F, pr, [pr[0] + vx * sc, 0.1, pr[2] + vz * sc], 0.008, '#7FD0FF', {});
      if (!Wh.skid) path3(F, [iar, pr], '#FFD36B', { alpha: 0.25, width: 1, dash: [3, 3], chunk: 1 });
    }
    if (!Wh.skid) R3.sphere(F, iar, 0.03, '#FFD36B', { shadow: false, vivid: true });
    R3.label(F, [iar[0], iar[1], Wh.skid ? -0.12 : iar[2] - 0.12], Wh.skid ? 'no point at rest: pure translation, every point at v' : Math.abs(p.rho - 1) < 1e-6 ? 'at rest: the contact point' : 'at rest (' + (Wh.iar * 100).toFixed(1) + ' cm below the axle)', '#FFD36B', { size: 9.5 });
    F.render();
    header(g, 'A wheel of radius ' + (Wh.R * 100).toFixed(0) + ' cm moving at ' + Wh.v.toFixed(2) + ' m/s' + (Math.abs(p.rho - 1) < 1e-6 ? ', rolling' : ', with Rω/v = ' + p.rho.toFixed(2) + (p.rho > 1 ? ' (wheelspin)' : ' (skidding)')),
      'velocity of each point = v_cm + ω × r · every arrow is perpendicular to the line from the point at rest: the wheel turns about it',
      'red: a point on the rim traces a cycloid, 8R long per turn · amber: a point halfway out', th.text);
    panel(g, 'THE POINT AT REST, AND THE PATHS', [['speed at the top', Wh.top.toFixed(3) + ' m/s', th.phys], ['speed at the contact point', Math.abs(Wh.bottom).toFixed(3) + ' m/s', Math.abs(Wh.bottom) < 1e-9 ? th.ok : '#FF8FB0'],
      ['rim path per turn (summed)', Wh.skid ? '— never turns' : Wh.len.toFixed(4) + ' m', th.phys], ['8R (when rolling)', (8 * Wh.R).toFixed(4) + ' m', th.ok], ['distance the axle moves per turn', Wh.skid ? '—' : Wh.dist.toFixed(4) + ' m'], ['point at rest below the axle', Wh.skid ? 'none' : (Wh.iar * 100).toFixed(2) + ' cm']]);
  }

  /* ======================= 2 · the bowling ball ======================= */
  function drawBowl(S, g) {
    const ctx = g.ctx, th = g.theme, p = S.p, cam = S.cam, Bw = S.Bw;
    const F = R3.Frame(ctx, cam, { ambient: 0.36, floorZ: 0 });
    const tEnd = Math.min(8, (isFinite(Bw.tRoll) ? Bw.tRoll : 4) + 2.5), tt = S.ts % tEnd, i = Math.min(Bw.out.length - 1, Math.round(tt / 0.01)), o = Bw.out[i];
    const ks = 1.0, x = o[1] * ks, r = Bw.R * ks;
    cam.target = [x + 0.5, 0, 0.1];
    // a lane window that travels with the ball; the boards and metre marks are fixed to the floor, so they stream past
    R3.plane(F, [x - 3, -0.5, 0], [7, 0, 0], [0, 1.0, 0], '#9A6A3C', { grid: 0, bias: F.GROUND });
    for (let k = -3; k <= 4; k++) { const xm = Math.floor(x) + k; if (xm < x - 3 || xm > x + 4) continue; path3(F, [[xm, -0.5, 0.002], [xm, 0.5, 0.002]], '#3A2412', { alpha: 0.55, width: 1.4, chunk: 1, bias: F.GROUND - 1 }); R3.label(F, [xm, -0.62, 0.01], xm + ' m', '#C9B08A', { size: 9 }); }
    for (let k = -4; k <= 4; k++) path3(F, [[x - 3, k * 0.12, 0.0015], [x + 4, k * 0.12, 0.0015]], '#6E4622', { alpha: 0.35, width: 1, chunk: 1, bias: F.GROUND - 1 });
    [-0.5, 0.5].forEach(yy => R3.box(F, [x + 0.5, yy + Math.sign(yy) * 0.06, 0.03], [7, 0.12, 0.06], '#3A3F4A', { shadow: false }));
    // skid marks where the ball slid
    const skid = []; Bw.out.forEach((q, j) => { if (q[5] && j <= i) skid.push([q[1], 0, 0.002]); });
    if (skid.length > 1) path3(F, skid, '#E8E2D0', { alpha: 0.55, width: 3, chunk: 6 });
    R3.sphere(F, [x, 0, r], r, Bw.k === 1 ? '#8A93A3' : '#3A5FA8', { shadow: true, rim: 0.7 });
    // a painted stripe, turned by the ball's own angle so the spin shows
    const stripe = []; for (let k = 0; k <= 40; k++) { const t = k / 40 * TAU, d = [Math.cos(-o[4]) * Math.cos(t) * 1.001, Math.sin(t) * 1.001, Math.sin(-o[4]) * Math.cos(t) * 1.001]; stripe.push([x + d[0] * r, d[1] * r, r + d[2] * r]); }
    path3(F, stripe, '#FFD36B', { alpha: 0.95, width: 2.2, chunk: 4 });
    R3.arrow(F, [x, 0, r * 2.4], [x + o[2] * 0.12, 0, r * 2.4], 0.008, '#7FD0FF', {});
    R3.arrow(F, [x, 0, r * 2.9], [x + o[3] * 0.12, 0, r * 2.9], 0.008, '#FF8FB0', {});
    R3.label(F, [x + Math.max(o[2], o[3]) * 0.12 + 0.1, 0, r * 2.65], 'v = ' + o[2].toFixed(2) + ' · Rω = ' + o[3].toFixed(2) + ' m/s', '#DCE3EE', { size: 10, align: 'left' });
    if (o[5]) R3.arrow(F, [x, 0, 0.004], [x - Math.sign(o[2] - o[3]) * 0.3, 0, 0.004], 0.01, '#FFB347', { vivid: true });
    F.render();
    header(g, 'A ' + Bw.B.name + ' launched at ' + p.v0.toFixed(1) + ' m/s with ' + (p.spin0 === 0 ? 'no spin' : Math.abs(p.spin0).toFixed(1) + ' rev/s of ' + (p.spin0 > 0 ? 'topspin' : 'backspin')) + ' · μ = ' + p.mub.toFixed(2),
      't = ' + o[0].toFixed(2) + ' s · ' + (o[5] ? 'SLIDING: kinetic friction μmg slows v and changes ω' : 'ROLLING: v = Rω, friction gone'),
      'angular momentum about the contact point is conserved while it slides (friction acts there): v_f = (v₀ + kRω₀)/(1 + k)', th.text);
    panel(g, 'SLIDING, THEN ROLLING', [['final speed (integrated)', Bw.vRun.toFixed(4) + ' m/s', th.phys], ['(v₀ + kRω₀)/(1 + k)', Bw.vf.toFixed(4) + ' m/s', th.ok],
      ['time spent sliding', isFinite(Bw.tRoll) ? Bw.tRoll.toFixed(4) + ' s (formula ' + Bw.tForm.toFixed(4) + ')' : '—'], ['distance sliding', isFinite(Bw.xRoll) ? Bw.xRoll.toFixed(3) + ' m' : '—'],
      ['energy turned to heat', Bw.heat.toFixed(3) + ' J (ΔKE ' + (Bw.K0 - Bw.K1).toFixed(3) + ')'], ['k = I/mR²', Bw.k.toFixed(3)]]);
  }

  /* ======================= 3 · the spool and the yo-yo ======================= */
  function drawSpool(S, g) {
    const ctx = g.ctx, th = g.theme, p = S.p, cam = S.cam, Sq = S.Sq;
    const F = R3.Frame(ctx, cam, { ambient: 0.35, floorZ: 0 });
    const ks = 0.6 / Sq.R;
    if (Sq.kind === 'yoyo') {
      const ks = 0.22 / Sq.R;
      const tt = S.ts % (Sq.tEnd + 1), i = Math.min(Sq.out.length - 1, Math.round(tt / 0.01)), o = Sq.out[i], top = 2.05, yk = 1.4 / Sq.Lstr;
      R3.box(F, [-0.45, 0, top / 2], [0.05, 0.05, top], '#4A5263', { shadow: true }); R3.box(F, [-0.45, 0, 0.02], [0.4, 0.4, 0.04], '#3A3F4A', { shadow: false });
      R3.box(F, [-0.1, 0, top + 0.03], [0.75, 0.08, 0.06], '#5A6478', { shadow: false });
      const cy = top - 0.05 - o[1] * yk, c = [0, 0, cy - Sq.r * ks];
      path3(F, [[Sq.r * ks, 0, top], [Sq.r * ks, 0, cy - Sq.r * ks]], '#E8E2D0', { alpha: 0.9, width: 1.4, chunk: 1 });
      const ang = o[1] / Sq.r;
      [[-0.06, '#C8243B'], [0.06, '#C8243B']].forEach(([dy, col]) => R3.cylinder(F, [c[0], dy - 0.03, c[2]], [c[0], dy + 0.03, c[2]], Sq.R * ks, col, { segments: 36, shadow: false }));
      R3.cylinder(F, [c[0], -0.03, c[2]], [c[0], 0.03, c[2]], Sq.r * ks, '#DDE3EE', { segments: 16, shadow: false });
      for (let k = 0; k < 4; k++) { const t = -ang + k * Math.PI / 2; path3(F, [[c[0], -0.092, c[2]], [c[0] + Sq.R * ks * 0.9 * Math.cos(t), -0.092, c[2] + Sq.R * ks * 0.9 * Math.sin(t)]], '#FFFFFF', { alpha: 0.8, width: 1.4, chunk: 1 }); }
      F.render();
      header(g, 'A yo-yo · hub radius ' + (Sq.r * 100).toFixed(1) + ' cm, rim ' + (Sq.R * 100).toFixed(1) + ' cm', 't = ' + o[0].toFixed(2) + ' s · falling ' + o[2].toFixed(3) + ' m/s, spinning ' + o[3].toFixed(1) + ' rad/s',
        'mg − T = ma and Tr = Iα with a = rα: a = g/(1 + I/mr²) — a thin hub makes a slow yo-yo', th.text);
      panel(g, 'THE STRING TAKES MOST OF THE WEIGHT', [['acceleration', Sq.ay.toFixed(4) + ' m/s²', th.phys], ['g/(1 + I/mr²)', (G / (1 + Sq.I / (Sq.m * Sq.r * Sq.r))).toFixed(4) + ' m/s²', th.ok], ['tension ÷ mg', Sq.ratio.toFixed(4)], ['I/mr²', (Sq.I / (Sq.m * Sq.r * Sq.r)).toFixed(2)]]);
      return;
    }
    const tt = S.ts % 3, i = Math.min(Sq.out.length - 1, Math.round(tt / 0.01)), o = Sq.out[i];
    const x = o[1] * ks, c = [x, 0, Sq.R * ks], ang = o[3];
    cam.target = [x + 0.4, 0, 0.5];
    R3.plane(F, [x - 3, -0.7, 0], [6.5, 0, 0], [0, 1.4, 0], '#3A3F4A', { grid: 0, bias: F.GROUND });
    for (let k = -7; k <= 7; k++) { const xm = Math.round(x / 0.5) * 0.5 + k * 0.5; if (xm < x - 3 || xm > x + 3.5) continue; path3(F, [[xm, -0.7, 0.002], [xm, 0.7, 0.002]], '#8FA4CE', { alpha: 0.25, width: 1, chunk: 1, bias: F.GROUND - 1 }); }
    R3.arrow(F, [0, -0.62, 0.004], [0, -0.45, 0.004], 0.008, '#FFD36B', {}); R3.label(F, [0, -0.7, 0.01], 'start', '#FFD36B', { size: 9 });
    [[-0.16, '#C9A04A'], [0.16, '#C9A04A']].forEach(([dy, col]) => R3.cylinder(F, [c[0], dy - 0.025, c[2]], [c[0], dy + 0.025, c[2]], Sq.R * ks, col, { segments: 40, shadow: false }));
    R3.cylinder(F, [c[0], -0.14, c[2]], [c[0], 0.14, c[2]], Sq.r * ks, '#E8E2D0', { segments: 20, shadow: false });
    for (let k = 0; k < 6; k++) { const t = -ang + k * Math.PI / 3; path3(F, [[c[0] + Sq.r * ks * 1.05 * Math.cos(t), -0.192, c[2] + Sq.r * ks * 1.05 * Math.sin(t)], [c[0] + Sq.R * ks * 0.92 * Math.cos(t), -0.192, c[2] + Sq.R * ks * 0.92 * Math.sin(t)]], '#5A3A18', { alpha: 0.9, width: 1.6, chunk: 1 }); }
    // the thread leaves the bottom of the hub along the pull direction
    const hb = [c[0], 0, c[2] - Sq.r * ks], dirF = [Math.cos(Sq.phi), 0, Math.sin(Sq.phi)], end = V.add(hb, V.mul(dirF, 1.1));
    path3(F, [hb, end], '#E8E2D0', { alpha: 0.95, width: 1.6, chunk: 1 });
    R3.arrow(F, end, V.add(end, V.mul(dirF, 0.35)), 0.012, '#7CF0B0', { vivid: true });
    R3.label(F, V.add(end, V.mul(dirF, 0.5)), 'F at ' + p.phsp.toFixed(0) + '°', '#7CF0B0', { size: 10 });
    const f = Sq.slipping ? null : Sq.st.fRoll;
    if (f !== null && Math.abs(f) > 1e-6) R3.arrow(F, [c[0], 0, 0.01], [c[0] + Math.sign(f) * 0.3, 0, 0.01], 0.01, '#FFB347', { vivid: true });
    F.render();
    const dir = Sq.st.a > 1e-9 ? 'rolls TOWARD the pull' : Sq.st.a < -1e-9 ? 'rolls AWAY from the pull' : 'does not roll at all';
    header(g, 'A spool pulled by its thread at ' + p.phsp.toFixed(0) + '° · hub ' + (Sq.r * 100).toFixed(1) + ' cm, rim ' + (Sq.R * 100).toFixed(1) + ' cm · it ' + (Sq.slipping ? 'SLIPS' : dir),
      'torque about the contact point: F(R cos φ − r) · so it turns forward if cos φ > r/R, backward if less · critical angle ' + Sq.crit.toFixed(1) + '°',
      Sq.slipping ? 'friction needed exceeds μN: it slides and spins at once' : 'friction needed ' + Math.abs(Sq.st.fRoll).toFixed(3) + ' N ≤ μN = ' + (p.musp * Sq.st.N).toFixed(3) + ' N: it rolls', th.text);
    panel(g, 'WHICH WAY, AND WHY', [['acceleration (rolling)', Sq.st.a.toFixed(4) + ' m/s²', th.phys], ['F(cos φ − r/R)/m(1 + k)', (p.Fsp * (Math.cos(Sq.phi) - Sq.r / Sq.R) / (Sq.m * (1 + p.ksp))).toFixed(4) + ' m/s²', th.ok],
      ['critical angle arccos(r/R)', Sq.crit.toFixed(2) + '°'], ['friction needed', Sq.st.fRoll.toFixed(4) + ' N'], ['normal force', Sq.st.N.toFixed(3) + ' N'], ['speed after 3 s', Sq.out[Sq.out.length - 1][2].toFixed(3) + ' m/s']]);
  }

  /* ======================= 4 · the plank ======================= */
  function drawPlank(S, g) {
    const ctx = g.ctx, th = g.theme, p = S.p, cam = S.cam, Pk = S.Pk;
    const F = R3.Frame(ctx, cam, { ambient: 0.35, floorZ: 0 });
    const tt = S.ts % (Pk.tEnd + 1), i = Math.min(Pk.out.length - 1, Math.round(tt / 0.01)), o = Pk.out[i];
    const ks = 1.6 / Pk.Lp, X = o[1] * ks, x = o[2] * ks, r = Pk.R * ks;
    cam.target = [X + 0.3, 0, 0.2];
    R3.plane(F, [X - 4, -0.8, 0], [8, 0, 0], [0, 1.6, 0], '#2E333D', { grid: 0, bias: F.GROUND });
    for (let k = -8; k <= 8; k++) { const xm = Math.round(X / 0.5) * 0.5 + k * 0.5; path3(F, [[xm, -0.8, 0.002], [xm, 0.8, 0.002]], '#8FA4CE', { alpha: 0.25, width: 1, chunk: 1, bias: F.GROUND - 1 }); }
    const th2 = 0.06;
    R3.box(F, [X + Pk.Lp * ks / 2, 0, th2 / 2], [Pk.Lp * ks, 0.5, th2], '#8A5A32', { shadow: false });
    wheel(F, [x, 0, th2 + r], r, o[3], { spokes: 6, tyre: '#4A6FA8' });
    R3.arrow(F, [X + Pk.Lp * ks + 0.02, 0, th2 / 2], [X + Pk.Lp * ks + 0.4, 0, th2 / 2], 0.012, '#7CF0B0', { vivid: true });
    R3.label(F, [X + Pk.Lp * ks + 0.5, 0, th2], 'F = ' + Pk.F.toFixed(1) + ' N', '#7CF0B0', { size: 10, align: 'left' });
    R3.arrow(F, [x, 0.3, th2 + 0.01], [x + 0.25, 0.3, th2 + 0.01], 0.009, '#FFB347', { vivid: true });
    R3.label(F, [x, 0.3, th2 + 0.15], 'friction on the cylinder: forward', '#FFB347', { size: 9 });
    F.render();
    header(g, 'A ' + RB[p.cshape].name + ' on a ' + Pk.M.toFixed(1) + ' kg plank · F = ' + Pk.F.toFixed(1) + ' N · smooth floor · μ = ' + Pk.mu.toFixed(2),
      't = ' + o[0].toFixed(2) + ' s · plank ' + o[4].toFixed(3) + ' m/s · cylinder ' + o[5].toFixed(3) + ' m/s (ground frame) · ' + (Pk.rolls ? 'rolling on the plank' : 'SLIPPING on the plank'),
      'the only force on the cylinder is friction, forward — yet relative to the plank it rolls BACKWARD and falls off the back', th.text);
    panel(g, 'SOLVED TOGETHER', [['plank acceleration A', Pk.A.toFixed(4) + ' m/s²', th.phys], ['cylinder acceleration a', Pk.a.toFixed(4) + ' m/s²', th.phys], ['a/A', (Pk.a / Pk.A).toFixed(4) + (Pk.rolls ? ' = k/(1 + k)' : ''), th.ok],
      ['friction needed · available', Pk.f.toFixed(3) + ' · ' + (Pk.mu * Pk.m * G).toFixed(3) + ' N'], ['F at which it starts to slip', Pk.Fcrit.toFixed(2) + ' N'], ['falls off the back after', isFinite(Pk.tOff) ? Pk.tOff.toFixed(3) + ' s' : '—']]);
  }

  /* ======================= 5 · slide or tip ======================= */
  function drawTopple(S, g) {
    const ctx = g.ctx, th = g.theme, p = S.p, cam = S.cam, Tb = S.Tb;
    const F = R3.Frame(ctx, cam, { ambient: 0.35, floorZ: 0 });
    const tt = S.ts % (Tb.tEnd + 1), i = Math.min(Tb.out.length - 1, Math.round(tt / 0.01)), o = Tb.out[i];
    const ks = 1.3 / Tb.h, b = Tb.b * ks, h = Tb.h * ks, hF = Tb.hF * ks, ang = o[3], xs = o[4] * ks;
    R3.plane(F, [-1.6, -0.8, 0], [3.4, 0, 0], [0, 1.6, 0], '#6E4A2C', { grid: 12, gridColour: '#3A2412', gridAlpha: 0.3, bias: F.GROUND });
    // the block pivots about its front-bottom edge (x = b/2) when it tips
    const edge = [xs + b / 2, 0, 0];
    const P = (lx, lz) => { const dx = lx - b / 2, c = Math.cos(ang), s = Math.sin(ang); return [edge[0] + dx * c + lz * s, 0, dx * -s + lz * c]; };
    const cen = P(0, h / 2), ex = [Math.cos(ang), 0, -Math.sin(ang)], ez = [Math.sin(ang), 0, Math.cos(ang)];
    R3.box(F, cen, [b, 0.45, h], '#4A6FA8', { shadow: false, axes: [ex, [0, 1, 0], ez] });
    const push = P(-b / 2, hF);
    R3.arrow(F, V.add(push, [-0.45, 0, 0]), push, 0.014, '#7CF0B0', { vivid: true });
    R3.label(F, V.add(push, [-0.6, 0, 0.08]), 'F = ' + o[1].toFixed(2) + ' N', '#7CF0B0', { size: 10 });
    if (ang < 1e-3) {
      const xN = xs + o[2] * ks;
      R3.arrow(F, [xN, 0, -0.001], [xN, 0, 0.45], 0.012, '#7FD0FF', { vivid: true });
      R3.label(F, [xN, 0, 0.55], 'N', '#7FD0FF', { size: 10 });
      if (o[5] > 1e-6) R3.arrow(F, [xs, -0.25, 0.005], [xs - 0.3 * o[5] / Tb.Fs, -0.25, 0.005], 0.01, '#FFB347', { vivid: true });
    }
    R3.arrow(F, cen, V.add(cen, [0, 0, -0.4]), 0.012, '#FF8FB0', { vivid: true });
    F.render();
    header(g, 'Push a block: it will ' + (Tb.first === 'tips' ? 'TIP' : 'SLIDE') + ' · ' + (Tb.b * 100).toFixed(0) + ' × ' + (Tb.h * 100).toFixed(0) + ' cm, pushed at ' + (Tb.hF * 100).toFixed(0) + ' cm, μ = ' + Tb.mu.toFixed(2),
      't = ' + o[0].toFixed(2) + ' s · the push grows steadily · the normal force (blue) moves forward to balance the push\'s turning effect',
      'it tips when N reaches the front edge: F·h_F = mg·b/2 · it slides when F = μmg · whichever comes first wins', th.text);
    panel(g, 'THE RACE BETWEEN TWO LIMITS', [['F to tip  mgb/2h_F', Tb.Ft.toFixed(3) + ' N', Tb.first === 'tips' ? th.phys : undefined], ['F to slide  μmg', Tb.Fs.toFixed(3) + ' N', Tb.first === 'slides' ? th.phys : undefined],
      ['it', Tb.first === 'tips' ? 'tips over' : 'slides', th.ok], ['μ above which it tips: b/2h_F', Tb.muCrit.toFixed(3)], ['normal force from the centre now', (o[2] * 100).toFixed(2) + ' cm'], ['tilt now', (ang * 180 / Math.PI).toFixed(1) + '°']]);
  }

  const WHL = S => S.p.mode === 'wheel', BWL = S => S.p.mode === 'bowl', SPL = S => S.p.mode === 'spool', PLK = S => S.p.mode === 'plank', TPL = S => S.p.mode === 'topple',
        SPQ = S => SPL(S) && S.p.spsub === 'spool';

  L.register({
    id: 'rollingadv', subject: 'physics',
    name: 'Rolling and Friction — the Point at Rest, Spin and Slip, Spools, Planks and Toppling',
    chapter: 'System of Particles & Rotational Motion',
    exams: ['JEE Main', 'JEE Advanced'],
    weight: 'JEE Advanced favourite',
    is3D: true,
    stageHint: 'Drag to orbit · friction is solved from the equations every step, never assumed',
    lede: 'Five benches where rolling is <b>earned</b>, not assumed. A wheel shows every point\'s velocity turning about the <b>point at ' +
      'rest</b>, and its rim traces a cycloid that is summed to <b>8R</b>. A bowling ball launched with spin <b>slides until it rolls</b>, at ' +
      'exactly 5/7 of its speed. A spool pulled by its thread rolls <b>toward or away</b> from you depending only on the angle. A cylinder on ' +
      'a pulled plank rolls <b>backward</b> relative to it. A pushed block <b>tips or slides</b>, whichever limit it reaches first.',

    params: { mode: 'wheel', Rw2: 0.3, vw: 2, rho: 1,
              rshape: 'sphere', Rb: 0.11, mbl: 7, mub: 0.2, v0: 8, spin0: 0,
              spsub: 'spool', msp: 1, Rsp: 0.1, rsp: 0.05, ksp: 0.5, Fsp: 2, musp: 0.5, phsp: 30,
              Mpl: 2, mcy: 1, Rcy: 0.1, cshape: 'cylinder', Fpl: 10, mupl: 0.5, Lpl: 1.5,
              mbk: 5, bbk: 0.4, hbk: 1, hF: 0.8, mubk: 0.5, Frate: 5, run: true },

    presets: [
      { name: 'Rolling wheel · the point at rest', params: { mode: 'wheel', Rw2: 0.3, vw: 2, rho: 1 } },
      { name: 'Wheel spinning too fast (wheelspin)', params: { mode: 'wheel', Rw2: 0.3, vw: 2, rho: 2 } },
      { name: 'Wheel skidding (brakes locked)', params: { mode: 'wheel', Rw2: 0.3, vw: 2, rho: 0 } },
      { name: 'Bowling ball, no spin · slides then rolls', params: { mode: 'bowl', rshape: 'sphere', Rb: 0.11, mbl: 7, mub: 0.2, v0: 8, spin0: 0 } },
      { name: 'Backspin · the ring comes back', params: { mode: 'bowl', rshape: 'ring', Rb: 0.1, mbl: 1, mub: 0.3, v0: 2, spin0: -10 } },
      { name: 'Topspin · it speeds up', params: { mode: 'bowl', rshape: 'sphere', Rb: 0.11, mbl: 7, mub: 0.2, v0: 3, spin0: 15 } },
      { name: 'Spool pulled low · rolls toward you', params: { mode: 'spool', spsub: 'spool', Fsp: 2, phsp: 20, rsp: 0.05, Rsp: 0.1, musp: 0.5 } },
      { name: 'Spool at the critical angle · stays put', params: { mode: 'spool', spsub: 'spool', Fsp: 2, phsp: 60, rsp: 0.05, Rsp: 0.1, musp: 0.5 } },
      { name: 'Spool pulled steeply · rolls away', params: { mode: 'spool', spsub: 'spool', Fsp: 2, phsp: 80, rsp: 0.05, Rsp: 0.1, musp: 0.5 } },
      { name: 'Yo-yo', params: { mode: 'spool', spsub: 'yoyo', msp: 0.1, Rsp: 0.03, rsp: 0.006, ksp: 0.5 } },
      { name: 'Cylinder on a pulled plank', params: { mode: 'plank', Mpl: 2, mcy: 1, Rcy: 0.1, cshape: 'cylinder', Fpl: 10, mupl: 0.5 } },
      { name: 'Pull too hard · it slips on the plank', params: { mode: 'plank', Mpl: 2, mcy: 1, Rcy: 0.1, cshape: 'cylinder', Fpl: 45, mupl: 0.5 } },
      { name: 'Tall block pushed high · it tips', params: { mode: 'topple', mbk: 5, bbk: 0.4, hbk: 1, hF: 0.8, mubk: 0.5, Frate: 5 } },
      { name: 'Pushed low on a slippery floor · it slides', params: { mode: 'topple', mbk: 5, bbk: 0.4, hbk: 1, hF: 0.2, mubk: 0.3, Frate: 5 } }
    ],

    controls: [
      { group: 'Bench', items: [
        { key: 'mode', type: 'select', label: 'Experiment', restructure: true, rebuild: true, options: [
          { value: 'wheel', label: 'The rolling wheel' }, { value: 'bowl', label: 'Launched with spin' }, { value: 'spool', label: 'Spool and yo-yo' },
          { value: 'plank', label: 'Cylinder on a plank' }, { value: 'topple', label: 'Slide or tip' }] }
      ] },
      { group: 'The wheel', items: [
        { key: 'rho', label: 'Rω / v (1 = rolling)', min: -1, max: 3, step: 0.01, unit: '', when: WHL, fmt: v => v.toFixed(2), restructure: true },
        { key: 'vw', label: 'Speed of the axle', min: 0.2, max: 5, step: 0.05, unit: 'm/s', when: WHL, fmt: v => v.toFixed(2), restructure: true },
        { key: 'Rw2', label: 'Radius', min: 0.1, max: 0.6, step: 0.01, unit: 'm', when: WHL, fmt: v => v.toFixed(2), restructure: true }
      ] },
      { group: 'The launch', items: [
        { key: 'rshape', type: 'select', label: 'Body', restructure: true, when: BWL, options: Object.keys(RB).map(k => ({ value: k, label: RB[k].name[0].toUpperCase() + RB[k].name.slice(1) })) },
        { key: 'v0', label: 'Launch speed', min: 0, max: 12, step: 0.1, unit: 'm/s', when: BWL, fmt: v => v.toFixed(1), restructure: true },
        { key: 'spin0', label: 'Spin (+ top, − back)', min: -30, max: 30, step: 0.5, unit: 'rev/s', when: BWL, fmt: v => v.toFixed(1), restructure: true },
        { key: 'mub', label: 'Kinetic friction μ', min: 0.02, max: 0.8, step: 0.01, unit: '', when: BWL, fmt: v => v.toFixed(2), restructure: true },
        { key: 'Rb', label: 'Radius', min: 0.03, max: 0.3, step: 0.005, unit: 'm', when: BWL, fmt: v => v.toFixed(3), restructure: true },
        { key: 'mbl', label: 'Mass', min: 0.1, max: 10, step: 0.1, unit: 'kg', when: BWL, fmt: v => v.toFixed(1), restructure: true }
      ] },
      { group: 'Spool and yo-yo', items: [
        { key: 'spsub', type: 'select', label: 'Toy', restructure: true, rebuild: true, when: SPL, options: [{ value: 'spool', label: 'Spool on the floor' }, { value: 'yoyo', label: 'Yo-yo' }] },
        { key: 'phsp', label: 'Angle of the pull', min: 0, max: 90, step: 0.5, unit: '°', when: SPQ, fmt: v => v.toFixed(1), restructure: true },
        { key: 'Fsp', label: 'Pull', min: 0.1, max: 12, step: 0.1, unit: 'N', when: SPQ, fmt: v => v.toFixed(1), restructure: true },
        { key: 'musp', label: 'Friction μ', min: 0.02, max: 1, step: 0.01, unit: '', when: SPQ, fmt: v => v.toFixed(2), restructure: true },
        { key: 'rsp', label: 'Hub radius r', min: 0.003, max: 0.09, step: 0.001, unit: 'm', when: SPL, fmt: v => v.toFixed(3), restructure: true },
        { key: 'Rsp', label: 'Rim radius R', min: 0.02, max: 0.2, step: 0.005, unit: 'm', when: SPL, fmt: v => v.toFixed(3), restructure: true },
        { key: 'ksp', label: 'I / mR²', min: 0.2, max: 1, step: 0.01, unit: '', when: SPL, fmt: v => v.toFixed(2), restructure: true },
        { key: 'msp', label: 'Mass', min: 0.05, max: 3, step: 0.05, unit: 'kg', when: SPL, fmt: v => v.toFixed(2), restructure: true }
      ] },
      { group: 'The plank', items: [
        { key: 'Fpl', label: 'Pull on the plank', min: 0, max: 80, step: 0.5, unit: 'N', when: PLK, fmt: v => v.toFixed(1), restructure: true },
        { key: 'cshape', type: 'select', label: 'Body on it', restructure: true, when: PLK, options: Object.keys(RB).map(k => ({ value: k, label: RB[k].name[0].toUpperCase() + RB[k].name.slice(1) })) },
        { key: 'mupl', label: 'Friction μ (plank–body)', min: 0.05, max: 1, step: 0.01, unit: '', when: PLK, fmt: v => v.toFixed(2), restructure: true },
        { key: 'Mpl', label: 'Plank mass', min: 0.5, max: 10, step: 0.1, unit: 'kg', when: PLK, fmt: v => v.toFixed(1), restructure: true },
        { key: 'mcy', label: 'Body mass', min: 0.2, max: 5, step: 0.1, unit: 'kg', when: PLK, fmt: v => v.toFixed(1), restructure: true }
      ] },
      { group: 'The block', items: [
        { key: 'hF', label: 'Push height (× block height)', min: 0.05, max: 1, step: 0.01, unit: '', when: TPL, fmt: v => v.toFixed(2), restructure: true },
        { key: 'mubk', label: 'Floor friction μ', min: 0.05, max: 1.2, step: 0.01, unit: '', when: TPL, fmt: v => v.toFixed(2), restructure: true },
        { key: 'bbk', label: 'Width', min: 0.1, max: 1.5, step: 0.01, unit: 'm', when: TPL, fmt: v => v.toFixed(2), restructure: true },
        { key: 'hbk', label: 'Height', min: 0.2, max: 2, step: 0.01, unit: 'm', when: TPL, fmt: v => v.toFixed(2), restructure: true },
        { key: 'mbk', label: 'Mass', min: 1, max: 30, step: 0.5, unit: 'kg', when: TPL, fmt: v => v.toFixed(1), restructure: true },
        { key: 'Frate', label: 'Push grows at', min: 1, max: 30, step: 0.5, unit: 'N/s', when: TPL, fmt: v => v.toFixed(1), restructure: true }
      ] },
      { group: 'Display', items: [
        { key: 'run', type: 'toggle', label: 'Let it run' }
      ] }
    ],

    setup(S) {
      const p = S.p;
      if (p.mode === 'wheel') S.Wh = runWheel(p);
      else if (p.mode === 'bowl') S.Bw = runBowl(p);
      else if (p.mode === 'spool') S.Sq = runSpool(p);
      else if (p.mode === 'plank') S.Pk = runPlank(p);
      else S.Tb = runTopple(p);
      S.ts = 0;
      const views = {
        wheel: { theta: -1.57, phi: 0.12, dist: 4.6, target: [0, 0, 0.45] },
        bowl: { theta: -1.3, phi: 0.3, dist: 3.2, target: [0, 0, 0.1] },
        spool: { theta: -1.45, phi: 0.2, dist: 4.0, target: [0.3, 0, 0.6] },
        yoyo: { theta: -1.57, phi: 0.1, dist: 3.6, target: [0, 0, 1.2] },
        plank: { theta: -1.4, phi: 0.3, dist: 4.2, target: [0, 0, 0.2] },
        topple: { theta: -1.5, phi: 0.2, dist: 4.2, target: [0, 0, 0.6] }
      };
      const vk = p.mode === 'spool' && p.spsub === 'yoyo' ? 'yoyo' : p.mode;
      if (!S.cam || S._view !== vk) { S.cam = Camera(views[vk]); S.cam.minDist = 1; S.cam.maxDist = 14; S._view = vk; S._narrowCam = false; }
    },

    step(S, dt) { if (S.p.run) S.ts += dt; },

    drawStage(S, g) {
      if (g.w < 660 && !S._narrowCam) { S.cam.dist *= 1.3; S._narrowCam = true; }
      const md = S.p.mode;
      if (md === 'wheel') drawWheel(S, g); else if (md === 'bowl') drawBowl(S, g); else if (md === 'spool') drawSpool(S, g); else if (md === 'plank') drawPlank(S, g); else drawTopple(S, g);
    },

    plots: [
      { title: S => ({ wheel: 'Speed of each rim point, by its angle from the contact point', bowl: 'v and Rω until they meet', spool: S.p.spsub === 'yoyo' ? 'Falling speed against time' : 'Acceleration against the angle of the pull',
                       plank: 'Speeds in the ground frame', topple: 'The push, the friction, and where the normal force acts' })[S.p.mode],
        draw(S, g) {
          const p = S.p, th = g.theme, cy = '#3DD6F5', gr = '#7CF0B0', am = '#F5B451', pk = '#FF8FB0';
          if (p.mode === 'wheel') {
            const Wh = S.Wh, hi = Math.max(...Wh.sp.map(q => q[1])) * 1.1;
            const P = g.Plot({ xmin: 0, xmax: 360, ymin: 0, ymax: hi, xlabel: 'angle from the contact point (°)', ylabel: 'speed (m/s)', xfmt: v => v.toFixed(0), yfmt: v => v.toFixed(1) }).frame();
            P.clip(() => { P.hline(Wh.v, g.alpha(th['text-3'], .7), [3, 3]); P.line(Wh.sp, cy, 2.4); });
            P.tag(180, Wh.top, 'top: ' + Wh.top.toFixed(2) + ' m/s', cy, 'center', -10);
            P.tag(355, Wh.v, 'axle', th['text-3'], 'right', -8);
            return;
          }
          if (p.mode === 'bowl') {
            const Bw = S.Bw, pts = Bw.out.filter(q => q[0] <= (isFinite(Bw.tRoll) ? Bw.tRoll * 2 + 0.5 : 4));
            const ys = pts.flatMap(q => [q[2], q[3]]), lo = Math.min(0, ...ys), hi = Math.max(...ys);
            const P = g.Plot({ xmin: 0, xmax: pts[pts.length - 1][0], ymin: lo - 0.1 * (hi - lo), ymax: hi * 1.1 + 0.1, xlabel: 't (s)', ylabel: 'm/s', xfmt: v => v.toFixed(1), yfmt: v => v.toFixed(1) }).frame();
            P.clip(() => { P.hline(0, g.alpha(th['text-3'], .6)); P.line(pts.map(q => [q[0], q[2]]), cy, 2.4); P.line(pts.map(q => [q[0], q[3]]), pk, 2.4); if (isFinite(Bw.tRoll)) P.vline(Bw.tRoll, g.alpha(am, .8), [3, 3]); });
            P.tag(pts[pts.length - 1][0], Bw.vRun, 'rolls at ' + Bw.vRun.toFixed(3), am, 'right', -8);
            P.tag(0.02, pts[0][2], 'v', cy, 'left', -8); P.tag(0.02, pts[0][3], 'Rω', pk, 'left', 12);
            return;
          }
          if (p.mode === 'spool') {
            const Sq = S.Sq;
            if (Sq.kind === 'yoyo') { const P = g.Plot({ xmin: 0, xmax: Sq.tEnd, ymin: 0, ymax: Sq.out[Sq.out.length - 1][2] * 1.2, xlabel: 't (s)', ylabel: 'm/s', xfmt: v => v.toFixed(1), yfmt: v => v.toFixed(2) }).frame();
              P.clip(() => { P.line(Sq.out.map(q => [q[0], q[2]]), cy, 2.4); P.line([[0, 0], [Sq.tEnd, G * Sq.tEnd]], g.alpha(th['text-3'], .6), 1.2, [4, 3]); });
              P.tag(Sq.tEnd * 0.3, G * Sq.tEnd * 0.3, 'free fall', th['text-3'], 'left', -8); return; }
            const pts = []; for (let d = 0; d <= 90; d += 1) { const s = spoolAcc(p, d * Math.PI / 180); pts.push([d, s.a, s.holds]); }
            const hi = Math.max(...pts.map(q => Math.abs(q[1]))) * 1.15;
            const P = g.Plot({ xmin: 0, xmax: 90, ymin: -hi, ymax: hi, xlabel: 'pull angle φ (°)', ylabel: 'acceleration if rolling (m/s²)', xfmt: v => v.toFixed(0), yfmt: v => v.toFixed(2) }).frame();
            P.clip(() => { P.hline(0, g.alpha(th['text-3'], .7)); P.line(pts.map(q => [q[0], q[1]]), cy, 2.2); pts.forEach(q => { if (!q[2]) P.dot(q[0], q[1], 2, pk); }); P.vline(Sq.crit, g.alpha(am, .8), [3, 3]); P.dot(p.phsp, Sq.st.a, 5.5, gr, th['ink-950']); });
            P.tag(Sq.crit, hi * 0.85, 'cos φ = r/R', am, 'left', 0); P.tag(2, -hi * 0.85, 'pink: friction cannot hold it — slips', pk, 'left', 0);
            return;
          }
          if (p.mode === 'plank') {
            const Pk = S.Pk, a = Pk.out.map(q => [q[0], q[4]]), b = Pk.out.map(q => [q[0], q[5]]);
            const P = g.Plot({ xmin: 0, xmax: Pk.tEnd, ymin: 0, ymax: Math.max(...a.map(q => q[1])) * 1.1 + 0.01, xlabel: 't (s)', ylabel: 'm/s', xfmt: v => v.toFixed(2), yfmt: v => v.toFixed(1) }).frame();
            P.clip(() => { P.line(a, am, 2.4); P.line(b, cy, 2.4); });
            P.tag(Pk.tEnd, a[a.length - 1][1], 'plank', am, 'right', -8); P.tag(Pk.tEnd, b[b.length - 1][1], 'cylinder', cy, 'right', -8);
            return;
          }
          const Tb = S.Tb, pts = Tb.out;
          const P = g.Plot({ xmin: 0, xmax: Tb.tEnd, ymin: 0, ymax: Math.max(Tb.Fs, Tb.Ft) * 1.15, xlabel: 't (s)', ylabel: 'N', xfmt: v => v.toFixed(1), yfmt: v => v.toFixed(0) }).frame();
          P.clip(() => { P.hline(Tb.Ft, g.alpha(pk, .8), [4, 3]); P.hline(Tb.Fs, g.alpha(am, .8), [4, 3]); P.line(pts.map(q => [q[0], q[1]]), gr, 2.4); P.line(pts.map(q => [q[0], q[2] / (Tb.b / 2) * Tb.Ft]), cy, 1.6); });
          P.tag(Tb.tEnd * 0.02, Tb.Ft, 'tips at ' + Tb.Ft.toFixed(1) + ' N', pk, 'left', -8); P.tag(Tb.tEnd * 0.02, Tb.Fs, 'slides at ' + Tb.Fs.toFixed(1) + ' N', am, 'left', -8);
          P.tag(Tb.tEnd * 0.98, Tb.Ft * 0.5, 'blue: normal force position (edge = top line)', cy, 'right', 0);
        } },
      { title: S => ({ wheel: 'The paths: cycloid (rim) and curtate cycloid (halfway out)', bowl: 'Final speed against the spin it was launched with', spool: S.p.spsub === 'yoyo' ? 'Acceleration against hub size' : 'Friction the spool needs, against μN',
                       plank: 'Accelerations against the pull — rolling, then slipping', topple: 'Tip or slide: the map of push height against μ' })[S.p.mode],
        draw(S, g) {
          const p = S.p, th = g.theme, cy = '#3DD6F5', gr = '#7CF0B0', am = '#F5B451', pk = '#FF8FB0';
          if (p.mode === 'wheel') {
            const Wh = S.Wh, xmax = Math.max(...Wh.rim.map(q => q[0])), xmin = Math.min(0, ...Wh.rim.map(q => q[0]));
            const P = g.Plot({ xmin, xmax, ymin: -Wh.R * 0.1, ymax: Wh.R * 2.4, xlabel: 'x (m)', ylabel: 'height (m)', xfmt: v => v.toFixed(1), yfmt: v => v.toFixed(2) }).frame();
            P.clip(() => { P.line(Wh.rim, pk, 2.2); P.line(Wh.mid, am, 1.6); });
            P.tag(xmax / 2, Wh.R * 2, Wh.skid ? 'no spin: every point slides straight' : 'rim: ' + Wh.len.toFixed(3) + ' m per turn', pk, 'center', -10);
            return;
          }
          if (p.mode === 'bowl') {
            const Bw = S.Bw, pts = []; for (let s = -30; s <= 30; s += 1) pts.push([s, (p.v0 + Bw.k * Bw.R * s * TAU) / (1 + Bw.k)]);
            const lo = Math.min(...pts.map(q => q[1])), hi = Math.max(...pts.map(q => q[1]));
            const P = g.Plot({ xmin: -30, xmax: 30, ymin: lo, ymax: hi, xlabel: 'launch spin (rev/s, + topspin)', ylabel: 'final speed (m/s)', xfmt: v => v.toFixed(0), yfmt: v => v.toFixed(1) }).frame();
            P.clip(() => { P.hline(0, g.alpha(th['text-3'], .7)); P.line(pts, cy, 2.2); P.dot(p.spin0, Bw.vRun, 5.5, gr, th['ink-950']); });
            P.tag(-29, 0, 'below zero: it comes back', pk, 'left', 10);
            return;
          }
          if (p.mode === 'spool') {
            const Sq = S.Sq;
            if (Sq.kind === 'yoyo') { const pts = []; for (let r = 0.002; r <= Sq.R; r += Sq.R / 60) pts.push([r * 100, G / (1 + p.ksp * Sq.R * Sq.R / (r * r))]);
              const P = g.Plot({ xmin: 0, xmax: Sq.R * 100, ymin: 0, ymax: G * 0.8, xlabel: 'hub radius (cm)', ylabel: 'a (m/s²)', xfmt: v => v.toFixed(1), yfmt: v => v.toFixed(1) }).frame();
              P.clip(() => { P.line(pts, cy, 2.2); P.dot(Sq.r * 100, Sq.ay, 5.5, gr, th['ink-950']); }); return; }
            const pts = [], cap = []; for (let d = 0; d <= 90; d += 1) { const s = spoolAcc(p, d * Math.PI / 180); pts.push([d, s.fRoll]); cap.push([d, p.musp * Math.max(0, s.N)]); }
            const hi = Math.max(...cap.map(q => q[1]), ...pts.map(q => Math.abs(q[1]))) * 1.1;
            const P = g.Plot({ xmin: 0, xmax: 90, ymin: -hi, ymax: hi, xlabel: 'pull angle φ (°)', ylabel: 'friction needed (N)', xfmt: v => v.toFixed(0), yfmt: v => v.toFixed(2) }).frame();
            P.clip(() => { P.area(cap, 0, g.alpha(gr, .10)); P.area(cap.map(q => [q[0], -q[1]]), 0, g.alpha(gr, .10)); P.line(pts, pk, 2.2); P.dot(p.phsp, Sq.st.fRoll, 5, am, th['ink-950']); });
            P.tag(88, hi * 0.8, 'green band: what μN can supply', gr, 'right', 0);
            return;
          }
          if (p.mode === 'plank') {
            const Pk = S.Pk, A = [], a = []; for (let F = 0; F <= 80; F += 1) { const r = runPlankAcc(p, F); A.push([F, r.A]); a.push([F, r.a]); }
            const P = g.Plot({ xmin: 0, xmax: 80, ymin: 0, ymax: Math.max(...A.map(q => q[1])) * 1.05, xlabel: 'pull F (N)', ylabel: 'acceleration (m/s²)', xfmt: v => v.toFixed(0), yfmt: v => v.toFixed(0) }).frame();
            P.clip(() => { P.line(A, am, 2.2); P.line(a, cy, 2.2); P.vline(Pk.Fcrit, g.alpha(pk, .8), [3, 3]); P.dot(Pk.F, Pk.A, 5, am, th['ink-950']); P.dot(Pk.F, Pk.a, 5, cy, th['ink-950']); });
            P.tag(Pk.Fcrit, 1, 'slipping begins', pk, 'left', 0); P.tag(78, a[a.length - 1][1], 'cylinder: capped at μg', cy, 'right', -8);
            return;
          }
          const Tb = S.Tb, P = g.Plot({ xmin: 0.05, xmax: 1, ymin: 0, ymax: 1.2, xlabel: 'push height ÷ block height', ylabel: 'μ', xfmt: v => v.toFixed(1), yfmt: v => v.toFixed(1) }).frame();
          const bd = []; for (let x = 0.05; x <= 1.0001; x += 0.01) bd.push([x, Math.min(1.2, Tb.b / (2 * x * Tb.h))]);
          P.clip(() => { P.area(bd, 0, g.alpha(am, .12)); P.area(bd.map(q => [q[0], 1.2]).concat(bd.slice().reverse()), 1.2, g.alpha(pk, .0)); P.line(bd, gr, 2.2); P.dot(p.hF, p.mubk, 6, Tb.first === 'tips' ? pk : am, th['ink-950']); });
          P.tag(0.95, 1.1, 'above: it tips', pk, 'right', 0); P.tag(0.95, 0.1, 'below: it slides', am, 'right', 0);
        } }
    ],

    readouts(S) {
      const p = S.p;
      if (p.mode === 'wheel') { const Wh = S.Wh; return [{ label: 'Top speed', value: Wh.top.toFixed(3), unit: 'm/s', flag: 'accent' }, { label: 'Contact point', value: Math.abs(Wh.bottom).toFixed(3), unit: 'm/s' },
        { label: 'Rim path per turn', value: Wh.skid ? '—' : Wh.len.toFixed(4), unit: Wh.skid ? '' : 'm' }, { label: '8R', value: (8 * Wh.R).toFixed(4), unit: 'm', flag: 'ok' }]; }
      if (p.mode === 'bowl') { const Bw = S.Bw; return [{ label: 'Final speed', value: Bw.vRun.toFixed(4), unit: 'm/s', flag: 'accent' }, { label: 'Formula', value: Bw.vf.toFixed(4), unit: 'm/s' },
        { label: 'Sliding time', value: isFinite(Bw.tRoll) ? Bw.tRoll.toFixed(4) : '—', unit: 's' }, { label: 'Heat', value: Bw.heat.toFixed(3), unit: 'J' }]; }
      if (p.mode === 'spool') { const Sq = S.Sq; if (Sq.kind === 'yoyo') return [{ label: 'a', value: Sq.ay.toFixed(4), unit: 'm/s²', flag: 'accent' }, { label: 'T ÷ mg', value: Sq.ratio.toFixed(4), unit: '' }];
        return [{ label: 'Acceleration', value: Sq.st.a.toFixed(4), unit: 'm/s²', flag: 'accent' }, { label: 'Critical angle', value: Sq.crit.toFixed(2), unit: '°' }, { label: 'Friction needed', value: Sq.st.fRoll.toFixed(4), unit: 'N' }, { label: 'Rolls?', value: Sq.slipping ? 'slips' : 'yes', unit: '' }]; }
      if (p.mode === 'plank') { const Pk = S.Pk; return [{ label: 'Plank A', value: Pk.A.toFixed(4), unit: 'm/s²', flag: 'accent' }, { label: 'Cylinder a', value: Pk.a.toFixed(4), unit: 'm/s²' }, { label: 'a/A', value: (Pk.a / Pk.A).toFixed(4), unit: '' }, { label: 'Slips above', value: Pk.Fcrit.toFixed(2), unit: 'N' }]; }
      const Tb = S.Tb; return [{ label: 'It', value: Tb.first, unit: '', flag: 'accent' }, { label: 'F to tip', value: Tb.Ft.toFixed(3), unit: 'N' }, { label: 'F to slide', value: Tb.Fs.toFixed(3), unit: 'N' }, { label: 'μ to tip', value: Tb.muCrit.toFixed(3), unit: '' }];
    },

    equation(S) {
      const p = S.p;
      if (p.mode === 'wheel') return E.v('v') + E.sub('P') + ' ' + E.op('=') + ' ' + E.v('v') + E.sub('cm') + ' ' + E.op('+') + ' ω × ' + E.v('r') + ' · rolling: ' + E.v('v') + E.sub('top') + ' ' + E.op('=') + ' 2' + E.v('v') + ', ' + E.v('v') + E.sub('contact') + ' ' + E.op('=') + ' 0 · rim path 8' + E.v('R');
      if (p.mode === 'bowl') return E.v('v') + E.sub('f') + ' ' + E.op('=') + ' ' + E.frac(E.v('v') + '₀ ' + E.op('+') + ' ' + E.v('k') + E.v('R') + 'ω₀', '1 ' + E.op('+') + ' ' + E.v('k')) + ' ' + E.op('=') + ' ' + E.n(S.Bw.vf, 'm/s') + ' · sphere: (5' + E.v('v') + '₀ + 2' + E.v('R') + 'ω₀)/7';
      if (p.mode === 'spool') return S.Sq.kind === 'yoyo' ? E.v('a') + ' ' + E.op('=') + ' ' + E.frac(E.v('g'), '1 ' + E.op('+') + ' ' + E.v('I') + '/' + E.v('mr') + '²') + ' ' + E.op('=') + ' ' + E.n(S.Sq.ay, 'm/s²')
        : E.v('a') + ' ' + E.op('=') + ' ' + E.frac(E.v('F') + '(cos φ ' + E.op('−') + ' ' + E.v('r') + '/' + E.v('R') + ')', E.v('m') + '(1 ' + E.op('+') + ' ' + E.v('k') + ')') + ' ' + E.op('=') + ' ' + E.n(S.Sq.st.a, 'm/s²');
      if (p.mode === 'plank') return E.v('A') + ' ' + E.op('=') + ' ' + E.frac(E.v('F'), E.v('M') + ' ' + E.op('+') + ' ' + E.v('mk') + '/(1 + ' + E.v('k') + ')') + ' · ' + E.v('a') + ' ' + E.op('=') + ' ' + E.frac(E.v('k'), '1 + ' + E.v('k')) + E.v('A') + ' (cylinder: ' + E.v('A') + '/3)';
      return 'tips if ' + E.frac(E.v('b'), '2' + E.v('h') + E.sub('F')) + ' ' + E.op('<') + ' μ · ' + E.v('F') + E.sub('tip') + ' ' + E.op('=') + ' ' + E.frac(E.v('mgb'), '2' + E.v('h') + E.sub('F')) + ' ' + E.op('=') + ' ' + E.n(S.Tb.Ft, 'N');
    },

    eqNote: '<b>Friction is an unknown, never an input.</b> For each body the translational and rotational equations are written with the ' +
      'friction force as one more unknown, solved with the rolling condition, and then checked against μN. When the check fails the body ' +
      'slips and kinetic friction takes over. That single rule gives the 5/7 of a bowling ball, the spool\'s critical angle, a cylinder ' +
      'rolling backward on a plank, and the moment a block tips instead of sliding.',

    problems: [
      { source: 'JEE Main pattern · a point on a rolling wheel',
        q: 'A wheel of radius 0.30 m rolls without slipping. How far does a point on its rim travel during one full turn, in m?',
        params: { mode: 'wheel', Rw2: 0.3, vw: 2, rho: 1 },
        predict: { label: 'path length', unit: 'm', tol: 0.005 },
        measure: S => S.Wh.len,
        working: 'The rim point traces a cycloid of arc length <b>8R = 2.40 m</b>, while the axle moves only 2πR = 1.88 m. At the top it moves at 2v; at the contact point it is momentarily at rest.' },
      { source: 'JEE Advanced pattern · a bowling ball',
        q: 'A solid sphere is launched along a floor at 8.0 m/s with no spin (μ = 0.20). What is its speed when it starts rolling without slipping, in m/s?',
        params: { mode: 'bowl', rshape: 'sphere', Rb: 0.11, mbl: 7, mub: 0.2, v0: 8, spin0: 0 },
        predict: { label: 'final speed', unit: 'm/s', tol: 0.01 },
        measure: S => S.Bw.vRun,
        working: 'Friction acts at the contact point, so angular momentum about any point on the floor is conserved: mv₀R = mvR + (2/5)mR²(v/R) → v = <b>5v₀/7 = 5.71 m/s</b>, whatever μ is.' },
      { source: 'JEE Advanced pattern · how long it slides',
        q: 'For the same ball, how long does it slide before rolling, in s?',
        params: { mode: 'bowl', rshape: 'sphere', Rb: 0.11, mbl: 7, mub: 0.2, v0: 8, spin0: 0 },
        predict: { label: 'time', unit: 's', tol: 0.01 },
        measure: S => S.Bw.tRoll,
        working: 'v falls at μg while ωR rises at (5/2)μg; they meet when v₀ − μgt = (5/2)μgt, so t = <b>2v₀/7μg = 1.17 s</b>.' },
      { source: 'JEE Advanced pattern · a spool',
        q: 'A spool (hub radius 5 cm, rim radius 10 cm) on a rough floor is pulled by a thread from the bottom of its hub. At what angle above the horizontal must the thread be pulled for the spool not to roll at all, in degrees?',
        params: { mode: 'spool', spsub: 'spool', Fsp: 2, phsp: 30, rsp: 0.05, Rsp: 0.1, musp: 0.5 },
        predict: { label: 'angle', unit: '°', tol: 0.01 },
        measure: S => { let a = 0, b = Math.PI / 2; for (let i = 0; i < 60; i++) { const m = (a + b) / 2; if (spoolAcc(S.p, m).a > 0) a = m; else b = m; } return (a + b) / 2 * 180 / Math.PI; },
        working: 'Take torques about the contact point: the thread\'s line of action passes through it when cos φ = r/R. Then there is no torque and no rolling: φ = arccos(0.5) = <b>60°</b>. Below that it rolls toward you, above it away.' },
      { source: 'JEE Main pattern · a yo-yo',
        q: 'A yo-yo is a uniform disc of radius 3.0 cm with a hub of radius 0.60 cm. What is its downward acceleration, in m/s²?',
        params: { mode: 'spool', spsub: 'yoyo', msp: 0.1, Rsp: 0.03, rsp: 0.006, ksp: 0.5 },
        predict: { label: 'a', unit: 'm/s²', tol: 0.01 },
        measure: S => S.Sq.ay,
        working: 'a = g/(1 + I/mr²) with I = ½mR²: I/mr² = ½ × (3/0.6)² = 12.5, so a = 9.81/13.5 = <b>0.727 m/s²</b>. The string carries 93% of the weight.' },
      { source: 'JEE Advanced pattern · cylinder on a plank',
        q: 'A 2.0 kg plank on a frictionless floor carries a 1.0 kg solid cylinder that rolls on it without slipping. The plank is pulled with 10 N. What is the cylinder\'s acceleration (ground frame), in m/s²?',
        params: { mode: 'plank', Mpl: 2, mcy: 1, Rcy: 0.1, cshape: 'cylinder', Fpl: 10, mupl: 0.5 },
        predict: { label: 'a', unit: 'm/s²', tol: 0.01 },
        measure: S => S.Pk.a,
        working: 'Friction f on the cylinder: f = ma, fR = ½mR²α, and the contact point moves with the plank: a + Rα = A. So a = A/3, f = mA/3, and 10 − mA/3 = 2A → A = 4.29 m/s², a = <b>1.43 m/s²</b>. Relative to the plank the cylinder moves backward.' },
      { source: 'JEE Main pattern · tip or slide',
        q: 'A 5.0 kg block 0.40 m wide and 1.0 m tall stands on a floor with μ = 0.50. It is pushed horizontally at a height of 0.80 m. What force makes it start to tip, in N?',
        params: { mode: 'topple', mbk: 5, bbk: 0.4, hbk: 1, hF: 0.8, mubk: 0.5, Frate: 5 },
        predict: { label: 'force', unit: 'N', tol: 0.01 },
        measure: S => S.Tb.Ft,
        working: 'About the front edge: F × 0.80 = mg × 0.20 → F = <b>12.3 N</b>, well below μmg = 24.5 N, so it tips before it slides. Push below h = b/2μ = 0.40 m and it slides first.' }
    ],

    walkthrough: [
      { title: '1 · Which point of a wheel is at rest?',
        body: 'A rolling wheel with velocity arrows on its rim.',
        ask: 'Which point moves fastest, and which not at all?',
        reveal: '<b>The top moves at 2v; the contact point is at rest.</b> Every arrow is perpendicular to the line from the contact point: at that instant the whole wheel rotates about it.',
        params: { mode: 'wheel', Rw2: 0.3, vw: 2, rho: 1 } },
      { title: '2 · A bowling ball finds its speed',
        body: 'Launched with no spin. It slides, leaving skid marks, then rolls.',
        ask: 'Does a rougher lane make the final speed smaller?',
        reveal: '<b>No: it is always 5v₀/7.</b> Friction acts at the contact point, so angular momentum about that point is conserved. A rougher lane only shortens the skid.',
        params: { mode: 'bowl', rshape: 'sphere', Rb: 0.11, mbl: 7, mub: 0.2, v0: 8, spin0: 0 } },
      { title: '3 · Backspin brings it back',
        body: 'A ring thrown forward with strong backspin.',
        ask: 'Can friction make it return?',
        reveal: '<b>Yes.</b> v_f = (v₀ − kRω₀)/(1 + k) goes negative when kRω₀ > v₀. For a ring (k = 1), any backspin with Rω₀ > v₀ brings it back.',
        params: { mode: 'bowl', rshape: 'ring', Rb: 0.1, mbl: 1, mub: 0.3, v0: 2, spin0: -10 } },
      { title: '4 · The obedient spool',
        body: 'Pull a spool by its thread at different angles.',
        ask: 'Which way does it roll?',
        reveal: '<b>Toward you when cos φ > r/R, away when it is less, not at all at the critical angle.</b> Take torques about the contact point: the thread\'s line either passes above it, below it, or through it.',
        params: { mode: 'spool', spsub: 'spool', Fsp: 2, phsp: 60, rsp: 0.05, Rsp: 0.1, musp: 0.5 } },
      { title: '5 · The cylinder that rolls backward',
        body: 'A plank pulled forward with a cylinder on top.',
        ask: 'The only horizontal force on the cylinder is friction, forward. How does it move relative to the plank?',
        reveal: '<b>Backward.</b> It accelerates forward at A/3 in the ground frame while the plank goes at A, so it rolls toward the back and eventually falls off.',
        params: { mode: 'plank', Mpl: 2, mcy: 1, Rcy: 0.1, cshape: 'cylinder', Fpl: 10, mupl: 0.5 } },
      { title: '6 · Slide or tip',
        body: 'A tall block pushed high up, the push growing steadily.',
        ask: 'What moves as the push grows, before anything happens?',
        reveal: '<b>The normal force.</b> It shifts forward to balance the push\'s turning effect. When it reaches the edge the block tips; if friction gives out first, it slides.',
        params: { mode: 'topple', mbk: 5, bbk: 0.4, hbk: 1, hF: 0.8, mubk: 0.5, Frate: 5 } }
    ],

    quiz: [
      { q: 'A disc rolls without slipping at speed v. The speed of a point on its rim level with the centre is:',
        options: ['√2 v', '2v', 'v', 'Zero'], answer: 0, why: 'v_cm horizontal plus ωR vertical, at right angles: √2 v.' },
      { q: 'A solid sphere slides without spin at v₀ on a rough floor. When it starts rolling its speed is:',
        options: ['5v₀/7', '2v₀/7', 'v₀', 'v₀/2'], answer: 0, why: 'Conservation of angular momentum about the contact point.' },
      { q: 'A spool is pulled horizontally by a thread from the bottom of its hub. It:',
        options: ['Rolls toward the pull', 'Rolls away from the pull', 'Does not move', 'Slides without rolling'], answer: 0, why: 'At φ = 0, cos φ = 1 > r/R, so it rolls toward the pull (and the thread winds up).' },
      { q: 'A cylinder rolls without slipping on a plank that accelerates at A on a frictionless floor. The cylinder\'s acceleration in the ground frame is:',
        options: ['A/3', 'A', '2A/3', 'Zero'], answer: 0, why: 'f = ma, fR = Iα, a + Rα = A with I = ½mR² gives a = A/3.' },
      { q: 'A rim point of a rolling wheel travels, in one revolution:',
        options: ['8R', '2πR', '4R', '4πR'], answer: 0, why: 'The arc length of one arch of a cycloid is 8R.' },
      { q: 'A block of width b and height h is pushed at the top. It tips before sliding if μ is:',
        options: ['Greater than b/2h', 'Less than b/2h', 'Greater than h/b', 'Zero'], answer: 0, why: 'F_tip = mgb/2h is below μmg when μ > b/2h.' }
    ],

    notes: '<b>Where this shows up in the paper.</b><ul>' +
      '<li><b>Rolling kinematics</b>: v_P = v_cm + ω × r; the contact point is the instantaneous axis; top 2v; cycloid length 8R.</li>' +
      '<li><b>Sliding to rolling</b>: angular momentum about the contact point is conserved; v_f = (v₀ + kRω₀)/(1 + k); time μg(1 + 1/k); backspin can reverse it.</li>' +
      '<li><b>Spools and yo-yos</b>: take torques about the contact point; critical cos φ = r/R; a_yo-yo = g/(1 + I/mr²).</li>' +
      '<li><b>Plank problems</b>: friction is an unknown; relate accelerations through the contact point; check f ≤ μN.</li>' +
      '<li><b>Toppling</b>: the normal force shifts; tip when it reaches the edge; compare F_tip with μmg.</li></ul>' +
      '<div class="pyq"><em>Trap to avoid</em> — assuming friction is μN for a rolling body. Static friction is whatever rolling requires, up to μN.</div>' +
      '<div class="pyq"><em>Trap to avoid</em> — taking torques about the centre of a spool and forgetting friction. About the contact point, friction drops out.</div>'
  });
})(window.InsightLab);
