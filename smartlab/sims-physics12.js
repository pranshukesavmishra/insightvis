/* ============================================================
   PHYSICS (syllabus core, batch 4)
     21. Nuclei — decay counted on a Geiger counter, decay chains,
         binding energy from real masses, and a fissile sphere
         going critical
     22. Thermal properties of matter — calorimetry, expansion,
         conduction and radiation
   ============================================================ */
(function (L) {
  'use strict';
  const { clamp, TAU, E, Camera } = L;
  const PA = window.PHYSART, R3 = window.R3, RX = window.RX;

  /* =========================================================================
     21 · NUCLEI

     No curve on this stage is drawn from N₀e^(−λt). The source is a
     population of nuclei that decays by chance; a Geiger–Müller tube at a
     distance you set records what actually reaches it, through air and
     through whatever absorber you slide in, with its own dead time and the
     room's background. The half-life is then FITTED from the scaler's
     counts, exactly as a student does it — and it comes out wrong in the
     ways a real one does: dead time bends the log plot, background floors
     it, and an alpha source counted from 6 cm reads nothing at all.

     Decay chains are integrated (RK4) and also run atom by atom; the time
     of peak daughter activity and the equilibrium ratio are MEASURED from
     the run. Binding energies come from atomic mass excesses, and every
     Q-value is a sum of masses. The fissile sphere is a Monte Carlo of
     neutron histories — flight, scatter, capture, fission, leakage — and
     k is counted generation by generation; the critical radius is where
     the counted k crosses one.
     ========================================================================= */

  /* a small, seeded, fast RNG: every run is reproducible */
  function rng(seed) {
    let a = seed >>> 0;
    return () => {
      a = (a + 0x6D2B79F5) >>> 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }
  function gauss(R) { let u = 0; while (u === 0) u = R(); return Math.sqrt(-2 * Math.log(u)) * Math.cos(TAU * R()); }
  function poisson(R, m) {
    if (m <= 0) return 0;
    if (m > 60) return Math.max(0, Math.round(m + Math.sqrt(m) * gauss(R)));
    const Lm = Math.exp(-m); let k = 0, p = 1;
    do { k++; p *= R(); } while (p > Lm);
    return k - 1;
  }
  const LN2 = Math.LN2, NA = 6.02214076e23, MEV = 1.602176634e-13;
  const YR = 3.15576e7, DAY = 86400, HR = 3600, MIN = 60;
  function tfmt(s) {
    const a = Math.abs(s);
    if (a < 120) return s.toFixed(a < 10 ? 2 : 1) + ' s';
    if (a < 7200) return (s / MIN).toFixed(2) + ' min';
    if (a < 3 * DAY) return (s / HR).toFixed(2) + ' h';
    if (a < 2 * YR) return (s / DAY).toFixed(2) + ' d';
    return (s / YR).toFixed(1) + ' yr';
  }
  // the unit a timescale is best read in
  function tunit(T) {
    if (T < 300) return { u: 's', k: 1 };
    if (T < 5 * HR) return { u: 'min', k: MIN };
    if (T < 4 * DAY) return { u: 'h', k: HR };
    if (T < 3 * YR) return { u: 'd', k: DAY };
    return { u: 'yr', k: YR };
  }

  /* ---------------- sources, and what their radiation does on the way ---------------- */
  const ISO = {
    Ba137m: { name: 'Ba-137m', T: 2.552 * MIN, rad: [['g', 0.662, 0.851]], A: 137, note: 'eluted from a Cs-137 generator' },
    Rn220:  { name: 'Rn-220 (thoron)', T: 55.6, rad: [['a', 6.288, 1]], A: 220, note: 'the school thoron experiment' },
    Po210:  { name: 'Po-210', T: 138.376 * DAY, rad: [['a', 5.304, 1]], A: 210, note: 'pure alpha emitter' },
    I131:   { name: 'I-131', T: 8.0252 * DAY, rad: [['b', 0.606, 1], ['g', 0.364, 0.815]], A: 131, note: 'thyroid therapy' },
    P32:    { name: 'P-32', T: 14.268 * DAY, rad: [['b', 1.711, 1]], A: 32, note: 'hard beta, no gamma' },
    Tc99m:  { name: 'Tc-99m', T: 6.0067 * HR, rad: [['g', 0.1405, 0.89]], A: 99, note: 'the hospital imaging isotope' }
  };
  const ABS = {
    none:  { name: 'nothing', paper: 0, al: 0, pb: 0 },
    paper: { name: 'paper, 0.1 mm', paper: 0.008, al: 0, pb: 0 },
    al:    { name: 'aluminium, 3 mm', paper: 0, al: 0.81, pb: 0 },
    pb:    { name: 'lead, 2 cm', paper: 0, al: 0, pb: 22.7 }
  };
  const GM = { a: 1.4, tauUs: 200 };                // end-window radius (cm)
  const alphaRange = E => 0.318 * Math.pow(E, 1.5);   // Geiger's rule, cm of air
  // fraction of one kind of radiation that reaches and fires the tube
  function reach(kind, En, d, ab) {
    const A = ABS[ab];
    if (kind === 'a') {
      if (A.paper > 0 || A.al > 0 || A.pb > 0) return 0;         // a sheet of paper stops it
      const R = alphaRange(En);
      return 0.9 / (1 + Math.exp((d + 0.25 - R) / 0.12));         // range straggling over ~1 mm
    }
    if (kind === 'b') {
      const mu = 17 * Math.pow(En, -1.14);                         // cm²/g, the beta absorption rule
      const t = 0.00121 * d + A.paper + A.al + A.pb;               // g/cm² of air + absorber
      return 0.9 * Math.exp(-mu * t);
    }
    // gamma: a GM tube catches about 1% of the photons that cross it
    const muPb = En > 0.5 ? 1.25 : En > 0.25 ? 3.3 : 24;           // /cm
    const muAl = En > 0.5 ? 0.20 : En > 0.25 ? 0.27 : 0.40;
    return 0.01 * Math.exp(-muAl * A.al / 2.7 - muPb * A.pb / 11.35);
  }
  const geomEff = d => (1 - d / Math.hypot(d, GM.a)) / 2;         // solid angle of the window, Ω/4π

  /* The decay run. The source holds N₀ = A₀/λ nuclei. The scaler takes a
     count of fixed length every Δt; within each window the arrivals are a
     Poisson stream at the true rate (decays × reach + background), and a
     non-paralysable dead time is applied event by event: after each
     recorded pulse the tube is blind for τ. Then the half-life is fitted
     from the counts, background subtracted and (optionally) dead-time
     corrected, by weighted least squares on ln(rate). */
  function runDecay(p) {
    const I = ISO[p.iso], lam = LN2 / I.T, R = rng(1000 + Math.round(p.seed));
    const N0 = p.A0 * 1e3 / lam, tau = p.dead ? GM.tauUs * 1e-6 : 0, d = p.dcm, bg = p.bg;
    const G = geomEff(d);
    let eff = 0;
    I.rad.forEach(r => { eff += r[2] * reach(r[0], r[1], d, p.absb); });
    eff *= G;
    const nW = 40, tEnd = 5 * I.T, dt = tEnd / (nW - 1), tc = Math.min(p.tc, dt);   // a short-lived source is counted back to back
    const win = [];
    let N = N0;
    for (let k = 0; k < nW; k++) {
      const t = k * dt;
      if (k > 0) {                                    // the nuclei that decayed since the last window: binomial
        const q = 1 - Math.exp(-lam * dt), m = N * q;
        const dN = m > 1e6 ? m + Math.sqrt(m * (1 - q)) * gauss(R) : poisson(R, m);
        N = Math.max(0, N - dN);
      }
      const nTrue = lam * N * eff + bg;               // arrivals per second at the tube
      let tt = 0, c = 0;
      // non-paralysable: gaps are τ + an exponential wait
      if (nTrue > 0) {
        tt = -Math.log(1 - R()) / nTrue;
        while (tt < tc) { c++; tt += tau - Math.log(1 - R()) / nTrue; if (c > 5e6) break; }
      }
      win.push({ t, N, act: lam * N, n: nTrue, c, m: c / tc });
    }
    // the fit
    const fit = fitDecay(win, tc, bg, tau, p.corr);
    const u = tunit(I.T);
    return { I, lam, N0, tau, d, bg, G, eff, win, dt, tc, tEnd, fit, u,
             Ralpha: I.rad[0][0] === 'a' ? alphaRange(I.rad[0][1]) : null,
             Nat: t => N0 * Math.exp(-lam * t) };
  }
  function fitDecay(win, tc, bg, tau, corr) {
    let Sw = 0, Sx = 0, Sy = 0, Sxx = 0, Sxy = 0, used = 0;
    const pts = [];
    win.forEach(w => {
      let m = w.c / tc;
      if (corr && tau > 0) m = m / Math.max(1e-6, 1 - m * tau);
      const net = m - bg;
      if (w.c < 4 || net <= 0) { pts.push(null); return; }
      const y = Math.log(net), wt = Math.max(1, w.c) * Math.pow(net / m, 2);   // var(ln net) ≈ m/(net² tc)
      Sw += wt; Sx += wt * w.t; Sy += wt * y; Sxx += wt * w.t * w.t; Sxy += wt * w.t * y; used++;
      pts.push([w.t, y]);
    });
    if (used < 3) return { ok: false, pts, used };
    const D = Sw * Sxx - Sx * Sx, b = (Sw * Sxy - Sx * Sy) / D, a = (Sy - b * Sx) / Sw;
    const sb = Math.sqrt(Sw / D);
    const lam = -b;
    const T = LN2 / lam, sT = LN2 / (lam * lam) * sb;
    return { ok: lam > 0 && sT < 0.3 * T, lam, a, T, sT, pts, used };   // a fit through background noise is not a result
  }

  /* ---------------- decay chains: A → B → C, and activation ---------------- */
  const CHAIN = {
    MoTc: { name: 'Mo-99 → Tc-99m', a: 'Mo-99', b: 'Tc-99m', c: 'Tc-99', TA: 65.94 * HR, TB: 6.0067 * HR, NA0: 40e9 / (LN2 / (65.94 * HR)), tEnd: 120 * HR, kind: 'transient', MB: 99 },
    RaRn: { name: 'Ra-226 → Rn-222', a: 'Ra-226', b: 'Rn-222', c: 'Po-218 …', TA: 1600 * YR, TB: 3.8235 * DAY, NA0: NA / 226, tEnd: 30 * DAY, kind: 'secular', MB: 222 },
    TeI:  { name: 'Te-131 → I-131', a: 'Te-131', b: 'I-131', c: 'Xe-131', TA: 25.0 * MIN, TB: 8.0252 * DAY, NA0: 1e15, tEnd: 30 * DAY, kind: 'none', MB: 131 },
    NaAct:{ name: 'Na-23 + n → Na-24', a: 'neutrons', b: 'Na-24', c: 'Mg-24', TA: Infinity, TB: 14.997 * HR, NA0: 0, tEnd: 90 * HR, kind: 'activation', MB: 24 }
  };
  function runChain(p) {
    const C = CHAIN[p.chain], lA = isFinite(C.TA) ? LN2 / C.TA : 0, lB = LN2 / C.TB;
    const act = C.kind === 'activation', Rp = act ? p.Rprod * 1e9 : 0, tIrr = p.tirr * HR;
    const tEnd = C.tEnd, n = 6000, h0 = tEnd / n, sub = Math.max(1, Math.ceil(h0 * Math.max(lA, lB) / 0.2)), h = h0 / sub;
    const milk = C.kind === 'transient' && p.milk ? 24 * HR : 0;
    let NA_ = act ? 0 : C.NA0, NB = 0, NC = 0, t = 0, nextMilk = milk || Infinity, eluted = 0;
    const f = (a, b, tt) => [act ? 0 : -lA * a, (act ? (tt < tIrr ? Rp : 0) : lA * a) - lB * b];
    const out = [[0, NA_, NB, NC]];
    const milks = [];
    for (let i = 1; i <= n; i++) {
      for (let s = 0; s < sub; s++) {
        const k1 = f(NA_, NB, t), k2 = f(NA_ + h / 2 * k1[0], NB + h / 2 * k1[1], t + h / 2),
              k3 = f(NA_ + h / 2 * k2[0], NB + h / 2 * k2[1], t + h / 2), k4 = f(NA_ + h * k3[0], NB + h * k3[1], t + h);
        const dA = h / 6 * (k1[0] + 2 * k2[0] + 2 * k3[0] + k4[0]), dB = h / 6 * (k1[1] + 2 * k2[1] + 2 * k3[1] + k4[1]);
        NC += -dA - dB + (act && t < tIrr ? Rp * h : 0);
        NA_ += dA; NB += dB; t += h;
        if (t >= nextMilk) { milks.push([t, lB * NB]); eluted += NB; NC -= 0; NB = 0; nextMilk += milk; }
      }
      out.push([t, NA_, NB, NC]);
    }
    // the moment the daughter's activity peaks, read off the run (parabola through the top three)
    let iM = 1;
    for (let i = 1; i < out.length - 1; i++) if (out[i][2] > out[iM][2]) iM = i;
    let tMax = out[iM][0];
    if (iM > 0 && iM < out.length - 1) {
      const y0 = out[iM - 1][2], y1 = out[iM][2], y2 = out[iM + 1][2], den = y0 - 2 * y1 + y2;
      if (den < 0) tMax += 0.5 * (y0 - y2) / den * h0;
    }
    const last = out[out.length - 1];
    // atom by atom: 1600 atoms, each with its own two exponential lives
    const R = rng(77 + Math.round(p.seed)), atoms = [];
    for (let i = 0; i < 1600; i++) {
      const born = act ? R() * Math.min(tIrr, tEnd) : 0;
      if (act && born > tIrr) continue;
      let q; do { q = [2 * R() - 1, 2 * R() - 1, 2 * R() - 1]; } while (q[0] * q[0] + q[1] * q[1] + q[2] * q[2] > 1);
      atoms.push({ tA: act ? born : -Math.log(1 - R()) / lA, tB: -Math.log(1 - R()) / lB, born, pos: q });
    }
    return { C, lA, lB, act, Rp, tIrr, out, tMax, tMaxF: lA > 0 && lB !== lA ? Math.log(lB / lA) / (lB - lA) : NaN,
             ratioEnd: lA * last[1] > 0 ? (lB * last[2]) / (lA * last[1]) : NaN, last, atoms, milk, milks, eluted,
             sat: Rp, tEnd, u: tunit(Math.min(tEnd / 5, isFinite(C.TA) ? C.TA : tEnd)),
             at: tt => { const k = clamp(tt / tEnd * n, 0, n); const i = Math.floor(k), j = Math.min(n, i + 1), w = k - i;
                         return [0, 1, 2, 3].map(c => out[i][c] * (1 - w) + out[j][c] * w); } };
  }

  /* ---------------- masses and binding ----------------
     Atomic mass excesses Δ (MeV, AME2020). Binding energy is then
     B = Z·Δ(¹H) + N·Δ(n) − Δ(A,Z): no formula enters a measured point. */
  const DH = 7.28897, DN = 8.07132, U_MEV = 931.494;
  const NUC = [
    ['H-2', 1, 2, 13.1357], ['H-3', 1, 3, 14.9498], ['He-3', 2, 3, 14.9312], ['He-4', 2, 4, 2.42492],
    ['Li-6', 3, 6, 14.0869], ['Li-7', 3, 7, 14.9071], ['Be-9', 4, 9, 11.3484], ['B-10', 5, 10, 12.0506],
    ['B-11', 5, 11, 8.6677], ['C-12', 6, 12, 0], ['N-14', 7, 14, 2.86342], ['O-16', 8, 16, -4.73700],
    ['F-19', 9, 19, -1.48744], ['Ne-20', 10, 20, -7.04193], ['Mg-24', 12, 24, -13.9336], ['Si-28', 14, 28, -21.4928],
    ['S-32', 16, 32, -26.0157], ['Ca-40', 20, 40, -34.8463], ['Ti-48', 22, 48, -48.4917], ['Cr-52', 24, 52, -55.4182],
    ['Fe-56', 26, 56, -60.6071], ['Ni-62', 28, 62, -66.7462], ['Zn-64', 30, 64, -66.0036], ['Kr-84', 36, 84, -82.4393],
    ['Kr-92', 36, 92, -68.7690], ['Sr-88', 38, 88, -87.9217], ['Zr-90', 40, 90, -88.7732], ['Mo-98', 42, 98, -88.1125],
    ['Sn-120', 50, 120, -91.1051], ['Ba-138', 56, 138, -88.2618], ['Ba-141', 56, 141, -79.7260], ['Nd-142', 60, 142, -85.9555],
    ['Gd-158', 64, 158, -70.6966], ['W-184', 74, 184, -45.7074], ['Pt-195', 78, 195, -32.7970], ['Pb-206', 82, 206, -23.7855],
    ['Pb-208', 82, 208, -21.7485], ['Po-210', 84, 210, -15.9535], ['Rn-222', 86, 222, 16.3739], ['Ra-226', 88, 226, 23.6696],
    ['Th-232', 90, 232, 35.4483], ['Th-234', 90, 234, 40.6140], ['U-235', 92, 235, 40.9205], ['U-238', 92, 238, 47.3077],
    ['Pu-239', 94, 239, 48.5899]
  ].map(r => ({ id: r[0], Z: r[1], A: r[2], D: r[3], B: r[1] * DH + (r[2] - r[1]) * DN - r[3] }));
  NUC.forEach(n => { n.BA = n.B / n.A; });
  const NBY = {}; NUC.forEach(n => { NBY[n.id] = n; });
  NBY.n = { id: 'n', Z: 0, A: 1, D: DN, B: 0, BA: 0 };
  // the liquid-drop (semi-empirical) formula, term by term
  const SEMF = { av: 15.75, as: 17.8, ac: 0.711, aa: 23.7, ap: 11.18 };
  function semf(Z, A) {
    const N = A - Z, a3 = Math.cbrt(A);
    const t = { vol: SEMF.av * A, surf: -SEMF.as * a3 * a3, coul: -SEMF.ac * Z * (Z - 1) / a3,
                asym: -SEMF.aa * (N - Z) * (N - Z) / A,
                pair: (Z % 2 === 0 && N % 2 === 0 ? 1 : Z % 2 === 1 && N % 2 === 1 ? -1 : 0) * SEMF.ap / Math.sqrt(A) };
    t.B = t.vol + t.surf + t.coul + t.asym + t.pair;
    return t;
  }
  const valleyZ = A => A / (1.98 + 0.0155 * Math.pow(A, 2 / 3));
  // reactions: Q = Σ Δ(before) − Σ Δ(after), atomic masses so the electrons balance
  const RXN = {
    fission: { name: 'U-235 + n → Ba-141 + Kr-92 + 3n', lhs: ['U-235', 'n'], rhs: ['Ba-141', 'Kr-92', 'n', 'n', 'n'] },
    fusion:  { name: 'H-2 + H-3 → He-4 + n', lhs: ['H-2', 'H-3'], rhs: ['He-4', 'n'] },
    alpha:   { name: 'U-238 → Th-234 + α', lhs: ['U-238'], rhs: ['Th-234', 'He-4'] },
    alphaRa: { name: 'Ra-226 → Rn-222 + α', lhs: ['Ra-226'], rhs: ['Rn-222', 'He-4'] },
    alphaPo: { name: 'Po-210 → Pb-206 + α', lhs: ['Po-210'], rhs: ['Pb-206', 'He-4'] }
  };
  function reaction(key) {
    const X = RXN[key], sum = arr => arr.reduce((u, id) => u + NBY[id].D, 0), sB = arr => arr.reduce((u, id) => u + NBY[id].B, 0);
    const Q = sum(X.lhs) - sum(X.rhs), dB = sB(X.rhs) - sB(X.lhs);
    const out = { X, Q, dB, massDefect: Q / U_MEV };
    if (key.indexOf('alpha') === 0) {
      // the two-body split: equal and opposite momenta, non-relativistic
      const d = NBY[X.rhs[0]], a = NBY['He-4'];
      const md = d.A * U_MEV + d.D, ma = a.A * U_MEV + a.D;
      out.Ka = Q * md / (md + ma); out.Kd = Q * ma / (md + ma);
      out.va = Math.sqrt(2 * out.Ka / ma); out.vd = Math.sqrt(2 * out.Kd / md);   // in units of c
      out.pa = ma * out.va; out.pd = md * out.vd;
    }
    if (key === 'fission' || key === 'fusion') {
      const mfuel = X.lhs.filter(id => id !== 'n').reduce((u, id) => u + NBY[id].A, 0) * 1.66053907e-27;
      out.Jkg = Q * MEV / mfuel;
    }
    return out;
  }
  // nucleon positions: close-packed sites sorted by radius, first A kept
  const PACK = (() => {
    const s = [];
    for (let i = -6; i <= 6; i++) for (let j = -6; j <= 6; j++) for (let k = -6; k <= 6; k++)
      if ((i + j + k) % 2 === 0) s.push([i / Math.SQRT2, j / Math.SQRT2, k / Math.SQRT2]);
    s.sort((a, b) => Math.hypot(...a) - Math.hypot(...b));
    return s;
  })();
  function nucleusPts(Z, A, seed) {
    const R = rng(seed), pts = PACK.slice(0, A).map(q => q.slice());
    const c = pts.reduce((u, q) => [u[0] + q[0] / A, u[1] + q[1] / A, u[2] + q[2] / A], [0, 0, 0]);
    pts.forEach(q => { q[0] -= c[0]; q[1] -= c[1]; q[2] -= c[2]; });
    const idx = pts.map((_, i) => i);
    for (let i = idx.length - 1; i > 0; i--) { const j = Math.floor(R() * (i + 1)); [idx[i], idx[j]] = [idx[j], idx[i]]; }
    const prot = new Set(idx.slice(0, Z));
    return pts.map((q, i) => ({ x: q[0], y: q[1], z: q[2], p: prot.has(i) }));
  }

  /* ---------------- the fissile sphere ----------------
     One-group data: Sood, Forster & Parsons' analytical benchmark for U-235
     (LA-13511, case Ua: ν = 2.70, Σf = 0.06528, Σc = 0.013056, Σs = 0.248064
     cm⁻¹), whose exact bare critical radius is 7.428998 cm. Every Σ is scaled
     by 0.8499 so the model's critical radius lands on Godiva's 8.741 cm; a
     uniform scaling of Σ scales every length, so the benchmark still checks
     the code. U-238 is given illustrative fast one-group values that keep it
     sub-critical on its own, as it is. */
  const FIS = { nu: 2.70, n5: 0.04805, sf5: 0.06528 / 0.04805, sc5: 0.013056 / 0.04805, ss: 0.248064 / 0.04805,
                sf8: 0.05, sc8: 0.25, scale: 7.428998 / 8.741, rho: 18.75 };
  function xs(p) {
    const n = FIS.n5 * p.dens * FIS.scale, e = p.enr / 100;
    const Sf = n * (e * FIS.sf5 + (1 - e) * FIS.sf8), Sc = n * (e * FIS.sc5 + (1 - e) * FIS.sc8 + p.rods), Ss = n * FIS.ss;
    return { Sf, Sc, Ss, St: Sf + Sc + Ss, kinf: FIS.nu * Sf / (Sf + Sc) };
  }
  function isoDir(R) { const z = 2 * R() - 1, a = TAU * R(), s = Math.sqrt(1 - z * z); return [s * Math.cos(a), s * Math.sin(a), z]; }
  function critRun(p, Rcm, M, G, skip, seed, keep) {
    const X = xs(p), R = rng(seed), alb = p.refl ? 0.45 : 0;
    let src = [];
    for (let i = 0; i < M; i++) { let q; do { q = [2 * R() - 1, 2 * R() - 1, 2 * R() - 1]; } while (q[0] * q[0] + q[1] * q[1] + q[2] * q[2] > 1); src.push(q.map(v => v * Rcm)); }
    const ks = [], pop = [1], tracks = [], R2 = Rcm * Rcm;
    let fates = { fis: 0, cap: 0, leak: 0, refl: 0 };
    for (let g = 0; g < G; g++) {
      const bank = [], rec = keep && g === G - 1;
      for (let i = 0; i < src.length; i++) {
        let x = src[i][0], y = src[i][1], z = src[i][2], u = isoDir(R);
        const tr = rec && tracks.length < 36 ? [[x, y, z]] : null;
        for (let c = 0; c < 400; c++) {
          const s = -Math.log(1 - R()) / X.St;
          // distance to the surface along u
          const b = x * u[0] + y * u[1] + z * u[2], cc = x * x + y * y + z * z - R2, se = -b + Math.sqrt(Math.max(0, b * b - cc));
          if (s >= se) {
            x += u[0] * se; y += u[1] * se; z += u[2] * se;
            if (alb > 0 && R() < alb) {                      // the reflector sends it back in
              const nx = -x / Rcm, ny = -y / Rcm, nz = -z / Rcm; let v;
              do { v = isoDir(R); } while (v[0] * nx + v[1] * ny + v[2] * nz <= 0);
              u = v; x *= 0.99999; y *= 0.99999; z *= 0.99999;
              if (g >= skip) fates.refl++;
              if (tr) tr.push([x, y, z]);
              continue;
            }
            if (g >= skip) fates.leak++;
            if (tr) { tr.push([x, y, z]); tr.push([x + u[0] * Rcm * 0.35, y + u[1] * Rcm * 0.35, z + u[2] * Rcm * 0.35]); tr.fate = 'leak'; tracks.push(tr); }
            break;
          }
          x += u[0] * s; y += u[1] * s; z += u[2] * s;
          if (tr) tr.push([x, y, z]);
          const r = R() * X.St;
          if (r < X.Sf) {
            const nn = Math.floor(FIS.nu + R());
            for (let k = 0; k < nn; k++) bank.push([x, y, z]);
            if (g >= skip) fates.fis++;
            if (tr) { tr.fate = 'fis'; tracks.push(tr); }
            break;
          }
          if (r < X.Sf + X.Sc) { if (g >= skip) fates.cap++; if (tr) { tr.fate = 'cap'; tracks.push(tr); } break; }
          u = isoDir(R);
        }
      }
      const k = bank.length / src.length;
      ks.push(k); pop.push(pop[pop.length - 1] * k);
      if (!bank.length) { for (let g2 = g + 1; g2 < G; g2++) { ks.push(0); pop.push(0); } break; }
      src = [];
      for (let i = 0; i < M; i++) src.push(bank[Math.floor(R() * bank.length)]);
    }
    const act = ks.slice(skip);
    const k = act.reduce((u, v) => u + v, 0) / act.length;
    const sd = Math.sqrt(act.reduce((u, v) => u + (v - k) * (v - k), 0) / Math.max(1, act.length - 1) / act.length);
    const tot = fates.fis + fates.cap + fates.leak;
    return { k, sd, ks, pop, tracks, X, fates, leakF: tot ? fates.leak / tot : 0 };
  }
  const KCACHE = {};
  function kCurve(p) {
    const key = [p.enr, p.dens, p.rods, p.refl].join('|');
    if (KCACHE[key]) return KCACHE[key];
    const pts = [];
    [2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 14, 16, 19, 23, 28, 34, 42].forEach(r => pts.push([r, critRun(p, r, 600, 13, 4, 11 + r * 7, false).k]));
    /* the crossing. One-group diffusion says 1/k = a + b/(R + δ)², so fit that line to the
       counted points (δ = 2 cm, the extrapolation length), take its root, then bisect with
       bigger runs inside ±12% of it. Past the scan the fitted root is reported as an
       extrapolation, and flagged. */
    let Sx = 0, Sy = 0, Sxx = 0, Sxy = 0, nfit = 0;
    pts.forEach(q => { if (q[1] <= 0.05) return; const x = 1 / Math.pow(q[0] + 2, 2), y = 1 / q[1]; Sx += x; Sy += y; Sxx += x * x; Sxy += x * y; nfit++; });
    const bb = (nfit * Sxy - Sx * Sy) / (nfit * Sxx - Sx * Sx), aa = (Sy - bb * Sx) / nfit;
    let rc = aa < 1 && bb > 0 ? Math.sqrt(bb / (1 - aa)) - 2 : NaN, extrap = false;
    // a counted crossing inside the scan beats the fit
    for (let i = 1; i < pts.length; i++) if (pts[i - 1][1] < 1 && pts[i][1] >= 1) {
      rc = pts[i - 1][0] + (1 - pts[i - 1][1]) / (pts[i][1] - pts[i - 1][1]) * (pts[i][0] - pts[i - 1][0]); break;
    }
    if (isFinite(rc) && rc <= 42) {
      // refine: five bigger runs across ±10%, a straight line through them, its root
      let Qx = 0, Qy = 0, Qxx = 0, Qxy = 0;
      [0.9, 0.95, 1, 1.05, 1.1].forEach((f, i) => { const r = rc * f, k = critRun(p, r, 3000, 22, 6, 900 + i * 13, false).k; Qx += r; Qy += k; Qxx += r * r; Qxy += r * k; });
      const s1 = (5 * Qxy - Qx * Qy) / (5 * Qxx - Qx * Qx), s0 = (Qy - s1 * Qx) / 5;
      if (s1 > 0) rc = (1 - s0) / s1;
    } else if (isFinite(rc)) extrap = true;
    return (KCACHE[key] = { pts, rc, extrap, kinf: 1 / aa, mc: isFinite(rc) ? 4 / 3 * Math.PI * rc * rc * rc * FIS.rho * p.dens / 1000 : NaN });
  }
  function runCrit(p) {
    const run = critRun(p, p.rcm, 1800, 24, 6, 5 + Math.round(p.seed), true);
    return Object.assign(run, { curve: kCurve(p), R: p.rcm, mass: 4 / 3 * Math.PI * Math.pow(p.rcm, 3) * FIS.rho * p.dens / 1000 });
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

  /* ======================= the counting bench ======================= */
  const KD = 0.1;                                       // scene units per cm
  const RADCOL = { a: '#FF6B5A', b: '#6FB8FF', g: '#FFE27A' };
  function decayNow(S) {
    const Dc = S.Dc, tp = clamp(S.ts / 20, 0, 1) * Dc.tEnd, k = Math.min(Dc.win.length - 1, Math.floor(tp / Dc.dt));
    const w = Dc.win[k], within = clamp((tp - w.t) / Dc.tc, 0, 1);
    return { tp, k, w, shown: Math.round(w.c * within), counting: within < 1 };
  }
  function drawDecay(S, g) {
    const ctx = g.ctx, th = g.theme, p = S.p, W = g.w, H = g.h, cam = S.cam, Dc = S.Dc;
    const narrow = W < 660, B = window.BENCH;
    const F = R3.Frame(ctx, cam, { ambient: 0.32, floorZ: 0 });
    const m = (x, y, z) => [x * KD, y * KD, z * KD];
    const now = decayNow(S), zS = 5, d = p.dcm;
    B.table(F, m(-16, 0, 0)[0], m(34, 0, 0)[0], m(0, -14, 0)[1], m(0, 14, 0)[1], 0, { legs: false, tone: '#6E4A2C', seed: 31, thick: 0.06 });
    // the lead castle: bricks round the back and sides of the source
    const lead = '#5E646E';
    [[-7, 0, 2.5, 5, 20, 5], [-7, 0, 7.5, 5, 20, 5], [-2, -8.5, 2.5, 5, 3, 5], [-2, 8.5, 2.5, 5, 3, 5],
     [-2, -8.5, 7.5, 5, 3, 5], [-2, 8.5, 7.5, 5, 3, 5]].forEach(b => R3.box(F, m(b[0], b[1], b[2]), [b[3] * KD, b[4] * KD, b[5] * KD], lead, { shadow: false, ambient: 0.42 }));
    // the source: a planchet on a perspex stand
    R3.cylinder(F, m(0, 0, 0), m(0, 0, zS - 0.4), 0.9 * KD, '#9FB7C8', { segments: 16, shadow: false });
    R3.cylinder(F, m(0, 0, zS - 0.4), m(0, 0, zS), 1.3 * KD, '#C9CFD8', { segments: 22, shadow: false });
    R3.sphere(F, m(0, 0, zS + 0.05), 0.45 * KD, Dc.I.rad[0][0] === 'a' ? '#FF9A7A' : Dc.I.rad[0][0] === 'b' ? '#8FC8FF' : '#FFE9A0', { shadow: false, vivid: true });
    // the absorber, halfway, in a slotted holder
    if (p.absb !== 'none') {
      const A = ABS[p.absb], thick = p.absb === 'pb' ? 2 : p.absb === 'al' ? 0.3 : 0.08;
      const col = p.absb === 'pb' ? '#4A5059' : p.absb === 'al' ? '#C8CED8' : '#F2EFE6';
      R3.box(F, m(d / 2, 0, zS), [thick * KD, 7 * KD, 7 * KD], col, { shadow: false, ambient: 0.45 });
      R3.box(F, m(d / 2, 0, 0.6), [Math.max(1.2, thick + 0.8) * KD, 7.5 * KD, 1.2 * KD], '#2B3140', { shadow: false });
      R3.label(F, m(d / 2, 0, zS + 4.2), A.name, '#DCE3EE', { size: 9 });
    }
    // the Geiger–Müller tube, window facing the source
    const flash = now.counting && S._blip > 0;
    R3.cylinder(F, m(d, 0, zS), m(d + 0.4, 0, zS), 1.8 * KD, '#2A2F38', { segments: 26, shadow: false });
    R3.cylinder(F, m(d + 0.4, 0, zS), m(d + 12, 0, zS), 1.6 * KD, flash ? '#E8F0FF' : '#AEB7C4', { segments: 26, shadow: false });
    R3.cylinder(F, m(d + 12, 0, zS), m(d + 15, 0, zS), 1.0 * KD, '#2F3644', { segments: 18, shadow: false });
    F.push(m(d - 0.02, 0, zS), () => {                       // the mica window, dark and faintly iridescent
      const r = ringPts(cam, m(d - 0.02, 0, zS), 1.4 * KD, 30);
      if (!r) return;
      ctx.beginPath(); r.forEach((q, i) => i ? ctx.lineTo(q.x, q.y) : ctx.moveTo(q.x, q.y)); ctx.closePath();
      ctx.fillStyle = flash ? 'rgba(255,240,180,.9)' : 'rgba(40,30,55,.92)'; ctx.fill();
    }, -0.01);
    // stand and clamp
    R3.cylinder(F, m(d + 7, 0, 0), m(d + 7, 0, zS - 1.6), 0.5 * KD, '#8A93A3', { segments: 12, shadow: false });
    R3.box(F, m(d + 7, 0, 0.4), [6 * KD, 5 * KD, 0.8 * KD], '#3A4152', { shadow: false });
    // the cable to the scaler
    const cab = [];
    for (let i = 0; i <= 16; i++) { const t = i / 16; cab.push(m(d + 15 + t * (22 - d - 15), t * 8.5, zS - 3.5 * Math.sin(Math.PI * t) - t * 1.0)); }
    R3.tube(F, cab, 0.25 * KD, '#1E232D', { segments: 6 });
    // the scaler: count in the current window, and the rate
    const sc = [28, 9, 3.4];
    R3.box(F, m(sc[0], sc[1], sc[2]), [13 * KD, 7 * KD, 6.8 * KD], '#2B3344', { shadow: false });
    const tIn = now.counting ? clamp((now.tp - now.w.t) / Dc.tc, 0, 1) * Dc.tc : Dc.tc;
    B.meter(F, m(sc[0] - 0.6, sc[1] - 3.55, 4.3), [0, -1, 0], 9.6 * KD, 3.2 * KD, { title: 'COUNT · t = ' + tIn.toFixed(1) + ' s', value: String(now.shown), unit: '', colour: '#7CF0B0' });
    [[-4.5, '#FF5A5A'], [-2.5, '#5AD07A'], [2, '#C9D2DE'], [4.5, '#C9D2DE']].forEach(b => R3.cylinder(F, m(sc[0] + b[0], sc[1] - 3.5, 1.4), m(sc[0] + b[0], sc[1] - 4.1, 1.4), 0.45 * KD, b[1], { segments: 12, shadow: false }));
    R3.label(F, m(sc[0], sc[1], sc[2] + 4.6), 'scaler · ' + Dc.tc.toFixed(0) + ' s counts', '#C9D4EA', { size: 9 });
    // radiation leaving the source this frame: a few tracks, drawn to where each kind can go
    const rate = now.w.n, R = S._trk || (S._trk = rng(5));
    const nVis = now.counting ? Math.min(14, Math.max(rate > 0.2 ? 1 : 0, Math.round(Math.log10(1 + rate) * 3))) : 0;
    for (let i = 0; i < nVis; i++) {
      const r = Dc.I.rad[Math.floor(R() * Dc.I.rad.length)], kind = r[0];
      let u = isoDir(R);
      if (i < 3) { u = [1, (R() - 0.5) * 0.25, (R() - 0.5) * 0.25]; const l = Math.hypot(...u); u = u.map(v => v / l); }   // some toward the tube
      let len = kind === 'a' ? alphaRange(r[1]) : 26;
      // stopped by an absorber in the way?
      const toTube = u[0] > 0 && Math.abs(u[1] / u[0] * d) < 3.5 && Math.abs(u[2] / u[0] * d) < 3.5;
      if (toTube && p.absb !== 'none' && (kind === 'a' || (kind === 'b' && p.absb !== 'paper') || (kind === 'g' && p.absb === 'pb' && R() > 0.1))) len = Math.min(len, d / 2 / u[0]);
      if (toTube) len = Math.min(len, d / u[0]);
      const pts = [];
      const seg = kind === 'b' ? 10 : 2;
      for (let k = 0; k <= seg; k++) {
        const s = len * k / seg, wig = kind === 'b' && k > 0 && k < seg ? 0.5 : 0;
        pts.push(m(u[0] * s + (R() - 0.5) * wig, u[1] * s + (R() - 0.5) * wig, zS + u[2] * s + (R() - 0.5) * wig));
      }
      path3(F, pts, RADCOL[kind], { alpha: 0.85, width: kind === 'a' ? 3 : kind === 'b' ? 1.4 : 1.1, dash: kind === 'g' ? [5, 4] : null, chunk: seg, glow: 6 });
    }
    // the alpha range, as a faint shell, for an alpha source
    if (Dc.Ralpha) {
      const ring = [];
      for (let k = 0; k <= 40; k++) { const a = -Math.PI / 2 + k / 40 * Math.PI; ring.push(m(Dc.Ralpha * Math.cos(a), Dc.Ralpha * Math.sin(a), zS)); }
      path3(F, ring, '#FF8A7A', { alpha: 0.5, width: 1.2, dash: [3, 3], chunk: 4 });
      R3.label(F, m(Dc.Ralpha * 0.7, -Dc.Ralpha * 0.72, zS), 'α range in air ' + Dc.Ralpha.toFixed(1) + ' cm', '#FF9A8A', { size: 9 });
    }
    B.rule(F, m(0, -4.5, 0.02), [1, 0, 0], 0.20, { k: 10, width: 0.22 });
    F.render();
    // drag the tube along the bench
    const q = cam.project(m(d + 6, 0, zS + 1.8)), q2 = cam.project(m(d + 7, 0, zS + 1.8));
    if (q.ok && q2.ok) { S._axT = axis2(q, q2, 1); ringHandle(g, q, 'gm', '#7CF0B0'); }
    S._blip = (S._blip || 0) - 1;
    if (now.counting && Math.random() < 1 - Math.exp(-Math.min(now.w.m, 60) / 60)) S._blip = 2;
    const U = Dc.u;
    header(g, Dc.I.name + ' · ' + { a: 'alpha', b: 'beta', g: 'gamma' }[Dc.I.rad[0][0]] + (Dc.I.rad.length > 1 ? ' + gamma' : '') + ' · counted from ' + d.toFixed(1) + ' cm',
      't = ' + tfmt(now.tp) + ' · N = ' + now.w.N.toExponential(3) + ' nuclei · true activity ' + (now.w.act / 1e3).toFixed(2) + ' kBq · ' + Dc.I.note,
      'the scaler counts ' + Dc.tc.toFixed(0) + ' s every ' + tfmt(Dc.dt) + ' · GM dead time ' + (p.dead ? GM.tauUs + ' µs' : 'off') + ' · background ' + p.bg.toFixed(2) + ' /s', th.text);
    // an inset: the nuclei themselves, each dot N₀/400 of them
    const iw = narrow ? 92 : 128, ix = W - iw - 14, iy = 66, cs = iw / 20;
    ctx.fillStyle = g.alpha('#0B1020', .9); ctx.strokeStyle = g.alpha(th.line, 1);
    ctx.beginPath(); ctx.roundRect(ix - 6, iy - 16, iw + 12, iw + 24, 8); ctx.fill(); ctx.stroke();
    PA.lbl(ctx, ix, iy - 6, 'NUCLEI · 1 dot = N₀/400', th['text-3'], 'left', 8);
    const fr = now.w.N / Dc.N0, Rr = rng(9);
    for (let i = 0; i < 400; i++) {
      const alive = Rr() < fr;
      ctx.fillStyle = alive ? (Dc.I.rad[0][0] === 'a' ? '#FF8A6A' : Dc.I.rad[0][0] === 'b' ? '#6FB8FF' : '#FFD86A') : '#3A4252';
      ctx.beginPath(); ctx.arc(ix + (i % 20 + 0.5) * cs, iy + (Math.floor(i / 20) + 0.5) * cs, cs * 0.36, 0, TAU); ctx.fill();
    }
    const rows = narrow ? 4 : 6, bw = narrow ? W - 24 : 300, bh = 26 + rows * 15 + 10;
    const row = gPanel(g, 12, H - bh - 30, bw, bh, 'WHAT THE TUBE SEES');
    row(0, 'geometry Ω/4π · reaches and fires', (Dc.G * 100).toFixed(2) + '% · ' + (Dc.eff / Dc.G * 100).toPrecision(3) + '%');
    row(1, 'arrivals · recorded (this count)', now.w.n.toFixed(1) + ' · ' + now.w.m.toFixed(1) + ' /s', th.phys);
    row(2, 'half-life fitted from the counts', Dc.fit.ok ? (Dc.fit.T / U.k).toPrecision(4) + ' ± ' + (Dc.fit.sT / U.k).toPrecision(2) + ' ' + U.u : 'no signal above background', Dc.fit.ok ? th.ok : '#FF8FB0');
    row(3, 'true half-life', (Dc.I.T / U.k).toPrecision(4) + ' ' + U.u);
    if (!narrow) {
      row(4, 'counts lost to dead time', p.dead && now.w.n * Dc.tc > 400 ? ((1 - now.w.m / now.w.n) * 100).toFixed(1) + '%' : '—');
      row(5, 'mean life τ = T/ln 2', (Dc.I.T / LN2 / U.k).toPrecision(4) + ' ' + U.u);
    }
  }

  /* ======================= the chain ======================= */
  const CCOL = { A: '#F5B451', B: '#3DD6F5', C: '#6B7486', E: '#7CF0B0' };
  function drawChain(S, g) {
    const ctx = g.ctx, th = g.theme, p = S.p, W = g.w, H = g.h, cam = S.cam, Ch = S.Ch, C = Ch.C;
    const narrow = W < 660, B = window.BENCH;
    const F = R3.Frame(ctx, cam, { ambient: 0.32, floorZ: 0 });
    const tp = clamp(S.ts / 18, 0, 1) * Ch.tEnd, st = Ch.at(tp);
    B.table(F, -1.6, 1.6, -1.0, 1.0, 0, { legs: false, tone: '#5A4632', seed: 17, thick: 0.06 });
    const c0 = [0, 0, 0.62], Rb = 0.42;
    // the sample: a sealed glass ampoule, the atoms inside
    glassCyl(F, [0, 0, 0.12], Rb + 0.05, 1.0, { bias: 0.4 });
    R3.cylinder(F, [0, 0, 0.0], [0, 0, 0.12], Rb + 0.12, '#39414F', { segments: 28, shadow: false });
    const sA = sprite(CCOL.A), sB = sprite(CCOL.B), sC = sprite(CCOL.C), list = [];
    let milked = 0;
    if (Ch.milk) milked = Math.floor(tp / Ch.milk);
    Ch.atoms.forEach(a => {
      if (Ch.act && a.born > tp) return;
      const t1 = a.tA, t2 = a.tA + a.tB;
      let spr = sA;
      if (tp >= t2) spr = sC;
      else if (tp >= t1) {
        spr = sB;
        // milking: a daughter that existed at an elution has left in the eluate
        if (Ch.milk) { const firstMilk = Math.ceil(t1 / Ch.milk) * Ch.milk; if (firstMilk <= tp && firstMilk < t2 && firstMilk > 0) return; }
      }
      if (Ch.act && spr === sA) return;
      list.push([c0[0] + a.pos[0] * Rb, c0[1] + a.pos[1] * Rb, c0[2] + a.pos[2] * Rb * 1.1, 0.018, spr]);
    });
    ballCloud(F, list, c0, 0);
    // activation: neutrons streaming in from the reactor port while it is on
    if (Ch.act) {
      R3.box(F, [-1.25, 0, 0.62], [0.3, 0.7, 0.9], '#3A4152', { shadow: false });
      const on = tp < Ch.tIrr;
      F.push([-1.09, 0, 0.62], () => { const q = cam.project([-1.09, 0, 0.62]); if (!q.ok) return;
        const gr = ctx.createRadialGradient(q.x, q.y, 0, q.x, q.y, 40); gr.addColorStop(0, on ? 'rgba(120,200,255,.9)' : 'rgba(80,90,110,.4)'); gr.addColorStop(1, 'rgba(120,200,255,0)');
        ctx.fillStyle = gr; ctx.beginPath(); ctx.arc(q.x, q.y, 40, 0, TAU); ctx.fill(); }, -0.02);
      R3.label(F, [-1.25, 0, 1.2], on ? 'reactor port · beam ON' : 'beam off', on ? '#9FD8FF' : '#8893A8', { size: 9.5 });
      if (on) { const nb = [], ph = (S.ts * 0.9) % 1;
        for (let i = 0; i < 26; i++) { const f = (i / 26 + ph) % 1; nb.push([-1.08 + f * 0.9, Math.sin(i * 7.1) * 0.25, 0.62 + Math.cos(i * 3.3) * 0.25, 0.012, sprite('#BFE6FF', { glow: true })]); }
        ballCloud(F, nb, [-0.6, 0, 0.62], -0.01); }
    }
    // the eluate vial for the technetium cow
    if (Ch.milk) {
      liquidCyl(F, [0.95, 0, 0.06], 0.12, 0.08 + 0.05 * Math.min(4, milked), '#9FE8F8', { alpha: 0.6 });
      glassCyl(F, [0.95, 0, 0.06], 0.13, 0.45);
      R3.label(F, [0.95, 0, 0.62], milked + ' elution' + (milked === 1 ? '' : 's') + ' · Tc-99m out', '#9FE8F8', { size: 9 });
    }
    R3.label(F, [0, 0, 1.28], C.name, '#DCE3EE', { size: 11 });
    F.render();
    const u = Ch.u, AA = Ch.lA * st[1], AB = Ch.lB * st[2];
    header(g, C.name + ' · ' + { transient: 'transient equilibrium', secular: 'secular equilibrium', none: 'no equilibrium', activation: 'activation to saturation' }[C.kind],
      't = ' + tfmt(tp) + ' · T½ ' + (isFinite(C.TA) ? tfmt(C.TA) + ' → ' : '') + tfmt(C.TB) + ' · 1600 atoms drawn, each with its own two random lives',
      'dN_B/dt = ' + (Ch.act ? 'R' : 'λ_A N_A') + ' − λ_B N_B, integrated (RK4) · the key: ' + (Ch.act ? '' : 'amber ' + C.a + ' · ') + 'cyan ' + C.b + ' · grey ' + C.c, th.text);
    const rows = narrow ? 4 : 6, bw = narrow ? W - 24 : 300, bh = 26 + rows * 15 + 10;
    const row = gPanel(g, 12, H - bh - 30, bw, bh, 'ACTIVITIES, INTEGRATED');
    const bq = a => a >= 1e9 ? (a / 1e9).toPrecision(4) + ' GBq' : a >= 1e6 ? (a / 1e6).toPrecision(4) + ' MBq' : (a / 1e3).toPrecision(4) + ' kBq';
    if (Ch.act) {
      row(0, 'production rate R', bq(Ch.Rp).replace('Bq', '/s'));
      row(1, 'Na-24 activity now', bq(AB), th.phys);
      row(2, 'as a fraction of R', (AB / Ch.Rp * 100).toFixed(2) + '%', th.ok);
      row(3, '1 − e^(−λt_irr) at switch-off', ((1 - Math.exp(-Ch.lB * Ch.tIrr)) * 100).toFixed(2) + '%');
    } else {
      row(0, C.a + ' activity', bq(AA));
      row(1, C.b + ' activity', bq(AB), th.phys);
      row(2, 'ratio A_B/A_A', AA > 0 ? (AB / AA).toFixed(4) : 'parent gone', th.ok);
      row(3, 'daughter peak: run · formula', Ch.tMax < Ch.tEnd * 0.98 && C.kind !== 'secular' ? tfmt(Ch.tMax) + ' · ' + tfmt(Ch.tMaxF) : 'still rising at the end');
    }
    if (!narrow) {
      row(4, 'atoms of ' + C.b + ' now', st[2].toExponential(3));
      row(5, 'their mass', (st[2] * C.MB / NA * 1e6).toPrecision(4) + ' µg');
    }
  }

  /* ======================= nuclei, drawn nucleon by nucleon ======================= */
  const FM = 0.075;                                   // scene units per femtometre
  const PCOL = '#FF6464', NCOL = '#8EA6C6';
  function cluster(S, id, Z, A) {
    S._nc = S._nc || {};
    if (!S._nc[id]) S._nc[id] = nucleusPts(Z, A, 17 + A * 3 + Z);
    return S._nc[id];
  }
  // push one nucleus's nucleons into a ball list, centred at c, optionally stretched along x
  function pushNucleus(list, pts, c, stretch) {
    const a = 2.17 * FM, sx = 1 + (stretch || 0), sy = 1 / Math.sqrt(sx), sp = sprite(PCOL), sn = sprite(NCOL);
    pts.forEach(q => list.push([c[0] + q.x * a * sx, c[1] + q.y * a * sy, c[2] + q.z * a * sy, 0.95 * FM, q.p ? sp : sn]));
  }
  function drawBind(S, g) {
    const ctx = g.ctx, th = g.theme, p = S.p, W = g.w, H = g.h, cam = S.cam;
    const narrow = W < 660;
    const F = R3.Frame(ctx, cam, { ambient: 0.35, floorZ: null });
    const list = [], c0 = [0, 0, 0];
    const rows = narrow ? 4 : 7, bw = narrow ? W - 24 : 312, bh = 26 + rows * 15 + 10;
    if (p.bsub === 'curve') {
      const n = NBY[p.nuc], pts = cluster(S, n.id, n.Z, n.A), s = semf(n.Z, n.A);
      pushNucleus(list, pts, c0, 0);
      const spin = S.ts * 0.25;
      list.forEach(d => { const x = d[0], y = d[1]; d[0] = x * Math.cos(spin) - y * Math.sin(spin); d[1] = x * Math.sin(spin) + y * Math.cos(spin); });
      ballCloud(F, list, c0, 0);
      const Rn = 1.2 * Math.cbrt(n.A) * FM;
      R3.wireSphere(F, c0, Rn + 0.9 * FM, '#9FB4D6', { lat: 4, lon: 6, alpha: 0.12, limbAlpha: 0.35, limbWidth: 1 });
      R3.callout(F, [0, -Rn - 0.9 * FM, 0], 46, 30, 'R = 1.2 A^⅓ = ' + (1.2 * Math.cbrt(n.A)).toFixed(2) + ' fm', '#C9D4EA', { size: 9.5 });
      F.render();
      header(g, n.id + ' · ' + n.Z + ' protons, ' + (n.A - n.Z) + ' neutrons',
        'binding energy from the measured mass: B = Z·Δ(¹H) + N·Δ(n) − Δ = ' + n.B.toFixed(3) + ' MeV · ' + n.BA.toFixed(4) + ' MeV per nucleon',
        'the same nucleons at the same spacing: volume grows as A, so R ∝ A^⅓ and the density is the same in every nucleus', th.text);
      const row = gPanel(g, 12, H - bh - 30, bw, bh, 'LIQUID DROP, TERM BY TERM (MeV)');
      row(0, 'volume  +a_v A', s.vol.toFixed(1), '#7CF0B0');
      row(1, 'surface  −a_s A^⅔', s.surf.toFixed(1), '#FF8FB0');
      row(2, 'Coulomb  −a_c Z(Z−1)/A^⅓', s.coul.toFixed(1), '#FF8FB0');
      row(3, 'formula total · measured', s.B.toFixed(1) + ' · ' + n.B.toFixed(1), th.ok);
      if (!narrow) {
        row(4, 'asymmetry  −a_a (N−Z)²/A', s.asym.toFixed(1), '#FF8FB0');
        row(5, 'pairing', s.pair.toFixed(2));
        row(6, 'mass defect  B/c²', (n.B / U_MEV).toFixed(5) + ' u');
      }
      return;
    }
    const key = p.bsub === 'alpha' ? p.aiso : p.bsub, Rx = reaction(key), X = Rx.X;
    const ph = (S.ts % 9) / 9;
    if (p.bsub === 'fission') {
      const U = cluster(S, 'U-235', 92, 235), Ba = cluster(S, 'Ba-141', 56, 141), Kr = cluster(S, 'Kr-92', 36, 92);
      const sn = sprite(NCOL);
      if (ph < 0.2) {
        pushNucleus(list, U, c0, 0);
        list.push([-1.6 + ph / 0.2 * 1.1, 0, 0, 0.95 * FM, sn]);
      } else if (ph < 0.36) {
        const s = (ph - 0.2) / 0.16;
        pushNucleus(list, U, c0, 0.9 * s * s);
      } else {
        const s = (ph - 0.36) / 0.64, vBa = 1.25 * 92 / 233, vKr = 1.25 * 141 / 233;     // equal and opposite momenta
        pushNucleus(list, Ba, [-0.2 - vBa * s * 2.2, 0, 0], 0);
        pushNucleus(list, Kr, [0.2 + vKr * s * 2.2, 0, 0], 0);
        [[0.3, 1, 0.2], [-0.2, -1, 0.4], [0.1, 0.2, -1]].forEach(u => list.push([u[0] * s * 3, u[1] * s * 3, u[2] * s * 3, 0.95 * FM, sn]));
        if (s < 0.25) F.push(c0, () => { const q = cam.project(c0); if (!q.ok) return; const r = 30 + 200 * s;
          const gr = ctx.createRadialGradient(q.x, q.y, 0, q.x, q.y, r); gr.addColorStop(0, 'rgba(255,230,160,' + (0.8 * (1 - s / 0.25)).toFixed(2) + ')'); gr.addColorStop(1, 'rgba(255,160,60,0)');
          ctx.fillStyle = gr; ctx.beginPath(); ctx.arc(q.x, q.y, r, 0, TAU); ctx.fill(); }, 1);
        if (s > 0.3) { R3.label(F, [-0.2 - vBa * s * 2.2, 0, 0.62], 'Ba-141', '#FFB0B0', { size: 10 }); R3.label(F, [0.2 + vKr * s * 2.2, 0, 0.55], 'Kr-92', '#FFB0B0', { size: 10 }); }
      }
    } else if (p.bsub === 'fusion') {
      const Dn = cluster(S, 'H-2', 1, 2), Tn = cluster(S, 'H-3', 1, 3), He = cluster(S, 'He-4', 2, 4), sn = sprite(NCOL);
      if (ph < 0.4) { const s = ph / 0.4; pushNucleus(list, Dn, [-1.2 + s * 1.1, 0, 0], 0); pushNucleus(list, Tn, [1.2 - s * 1.1, 0, 0], 0); }
      else {
        const s = (ph - 0.4) / 0.6;
        pushNucleus(list, He, [-0.25 * s * 3.2, 0, 0], 0);                 // equal momenta: He-4 moves at 1/4 of the neutron's speed…
        list.push([s * 3.2, 0.05, 0, 0.95 * FM, sn]);                      // …and 4/5 of the energy goes with the neutron
        R3.label(F, [-0.25 * s * 3.2, 0, 0.35], 'He-4 · ' + (Rx.Q * 1 / 5.0).toFixed(2) + ' MeV', '#FFB0B0', { size: 10 });
        R3.label(F, [s * 3.2, 0, 0.3], 'n · ' + (Rx.Q * 4 / 5.0).toFixed(2) + ' MeV', '#BFD4F0', { size: 10 });
        if (s < 0.2) F.push(c0, () => { const q = cam.project(c0); if (!q.ok) return; const r = 20 + 160 * s;
          const gr = ctx.createRadialGradient(q.x, q.y, 0, q.x, q.y, r); gr.addColorStop(0, 'rgba(200,230,255,' + (0.9 * (1 - s / 0.2)).toFixed(2) + ')'); gr.addColorStop(1, 'rgba(120,180,255,0)');
          ctx.fillStyle = gr; ctx.beginPath(); ctx.arc(q.x, q.y, r, 0, TAU); ctx.fill(); }, 1);
      }
    } else {
      const par = NBY[X.lhs[0]], dau = NBY[X.rhs[0]];
      const P = cluster(S, par.id, par.Z, par.A), Dd = cluster(S, dau.id, dau.Z, dau.A), He = cluster(S, 'He-4', 2, 4);
      if (ph < 0.25) pushNucleus(list, P, c0, 0);
      else {
        const s = (ph - 0.25) / 0.75, xa = 0.55 + s * 2.6, xd = -s * 2.6 * Rx.vd / Rx.va;
        pushNucleus(list, Dd, [xd, 0, 0], 0);
        pushNucleus(list, He, [xa, 0, 0], 0);
        R3.label(F, [xa, 0, 0.3], 'α · ' + Rx.Ka.toFixed(3) + ' MeV', '#FFB0B0', { size: 10 });
        R3.label(F, [xd, 0, 0.72], dau.id + ' recoil · ' + (Rx.Kd * 1000).toFixed(1) + ' keV', '#C9D4EA', { size: 10 });
        R3.arrow(F, [xa + 0.2, 0, -0.35], [xa + 0.2 + 0.5, 0, -0.35], 0.012, '#FF8A7A', {});
        R3.arrow(F, [xd - 0.2, 0, -0.62], [xd - 0.2 - 0.5, 0, -0.62], 0.012, '#9FB4D6', {});
        R3.label(F, [xa + 0.45, 0, -0.5], 'p', '#FF8A7A', { size: 10 }); R3.label(F, [xd - 0.45, 0, -0.77], '−p', '#9FB4D6', { size: 10 });
      }
    }
    ballCloud(F, list, c0, 0);
    F.render();
    const mass = arr => arr.map(id => id === 'n' ? 'n' : id).join(' + ');
    header(g, X.name, 'Q = Σ Δ(before) − Σ Δ(after) = ' + Rx.Q.toFixed(3) + ' MeV · the mass that disappears: ' + (Rx.massDefect * 1000).toFixed(3) + ' mu',
      p.bsub === 'alpha' ? 'the two pieces fly apart with equal and opposite momentum, so the light one takes almost all the energy'
        : 'the same Q from binding energies: B(after) − B(before) = ' + Rx.dB.toFixed(3) + ' MeV', th.text);
    const row = gPanel(g, 12, H - bh - 30, bw, bh, 'MASSES IN, MASSES OUT');
    row(0, 'before', mass(X.lhs));
    row(1, 'after', mass(X.rhs));
    row(2, 'Q-value (from masses)', Rx.Q.toFixed(3) + ' MeV', th.phys);
    row(3, 'ΔB (from binding energies)', Rx.dB.toFixed(3) + ' MeV', th.ok);
    if (!narrow) {
      if (p.bsub === 'alpha') {
        row(4, 'α kinetic energy  Q(A−4)/A', Rx.Ka.toFixed(3) + ' MeV');
        row(5, 'daughter recoil', (Rx.Kd * 1000).toFixed(1) + ' keV');
        row(6, 'speed of the α', (Rx.va * 2.998e5).toFixed(0) + ' km/s');
      } else {
        row(4, 'energy per kg of fuel', (Rx.Jkg / 1e13).toFixed(2) + ' × 10¹³ J');
        row(5, 'tonnes of coal it replaces (29 MJ/kg)', (Rx.Jkg / 2.9e7 / 1000).toFixed(0) + ' t');
        row(6, 'fraction of mass turned to energy', (Rx.Jkg / 8.98755e16 * 100).toFixed(3) + '%');
      }
    }
  }

  /* ======================= the fissile sphere ======================= */
  const FATE = { fis: '#FFB347', cap: '#8A93A8', leak: '#5FD8FF' };
  function drawCrit(S, g) {
    const ctx = g.ctx, th = g.theme, p = S.p, W = g.w, H = g.h, cam = S.cam, Cr = S.Cr;
    const narrow = W < 660, B = window.BENCH;
    const F = R3.Frame(ctx, cam, { ambient: 0.35, floorZ: -1.6 });
    const ks = Math.min(0.1, 1.2 / Cr.R), Rs = Cr.R * ks, c0 = [0, 0, 0];
    // the metal: a translucent sphere, lit, with the cut-away tracks inside
    F.push(c0, () => {
      const q = cam.project(c0); if (!q.ok) return;
      const r = Rs * q.s;
      const gr = ctx.createRadialGradient(q.x - r * 0.35, q.y - r * 0.4, r * 0.05, q.x, q.y, r);
      gr.addColorStop(0, 'rgba(210,218,230,.55)'); gr.addColorStop(0.6, 'rgba(120,130,148,.28)'); gr.addColorStop(1, 'rgba(60,66,80,.45)');
      ctx.fillStyle = gr; ctx.beginPath(); ctx.arc(q.x, q.y, r, 0, TAU); ctx.fill();
      ctx.strokeStyle = 'rgba(220,228,240,.55)'; ctx.lineWidth = 1.2; ctx.stroke();
    }, 0.5 * Rs);
    R3.wireSphere(F, c0, Rs, '#B8C2D2', { lat: 6, lon: 8, alpha: 0.10, limbAlpha: 0.0 });
    if (p.refl) R3.wireSphere(F, c0, Rs * 1.28, '#7FE0C0', { lat: 5, lon: 8, alpha: 0.16, limbAlpha: 0.5, limbWidth: 1.4 });
    // this generation's histories, revealed as they fly
    const rev = (S.ts % 3) / 3;
    Cr.tracks.forEach((tr, i) => {
      const n = tr.length, kk = Math.max(2, Math.ceil(n * clamp(rev * 1.4 - i / Cr.tracks.length * 0.4, 0, 1)));
      const pts = tr.slice(0, kk).map(v => [v[0] * ks, v[1] * ks, v[2] * ks]);
      path3(F, pts, FATE[tr.fate] || '#DDE', { alpha: 0.85, width: 1.3, chunk: 3 });
      if (kk === n) {
        const e = pts[pts.length - 1];
        if (tr.fate === 'fis') R3.sphere(F, e, 0.035, '#FFB347', { shadow: false, vivid: true });
        else if (tr.fate === 'cap') R3.sphere(F, e, 0.02, '#8A93A8', { shadow: false });
      }
    });
    // scale: a ruler under it
    B.rule(F, [-Rs, -Rs - 0.15, -Rs - 0.05], [1, 0, 0], Math.min(0.5, Cr.R * 2 / 100), { k: ks * 100, width: 0.08 });
    R3.label(F, [0, 0, Rs + 0.22], 'U metal · ' + p.enr.toFixed(0) + '% U-235 · r = ' + Cr.R.toFixed(2) + ' cm · ' + Cr.mass.toFixed(1) + ' kg', '#DCE3EE', { size: 10 });
    F.render();
    const K = Cr.curve, st = Cr.k >= 1.005 ? 'SUPERCRITICAL' : Cr.k <= 0.995 ? 'subcritical' : 'critical';
    header(g, 'k = ' + Cr.k.toFixed(3) + ' ± ' + Cr.sd.toFixed(3) + ' · ' + st,
      'counted, not calculated: ' + (Cr.ks.length) + ' generations of 1800 neutron histories — flight, scatter, capture, fission (ν = 2.70), leakage',
      'orange: ends in fission · grey: captured · cyan: escapes' + (p.refl ? ' · green shell: reflector sends 45% back' : ''), Cr.k >= 1.005 ? '#FF8F6B' : th.text);
    const rows = narrow ? 4 : 7, bw = narrow ? W - 24 : 312, bh = 26 + rows * 15 + 10;
    const row = gPanel(g, 12, H - bh - 30, bw, bh, 'WHERE THE NEUTRONS GO');
    const tot = Cr.fates.fis + Cr.fates.cap + Cr.fates.leak;
    row(0, 'fission · capture · leak', (Cr.fates.fis / tot * 100).toFixed(1) + ' · ' + (Cr.fates.cap / tot * 100).toFixed(1) + ' · ' + (Cr.fates.leak / tot * 100).toFixed(1) + ' %');
    row(1, 'k∞ (no leakage) = νΣf/Σa', Cr.X.kinf.toFixed(3), th.phys);
    row(2, 'critical radius (counted)', isFinite(K.rc) ? K.rc.toFixed(2) + ' cm' + (K.extrap ? ' (extrapolated)' : '') : 'none: k∞ < 1 or beyond 42 cm', th.ok);
    row(3, 'critical mass', isFinite(K.mc) ? K.mc.toFixed(1) + ' kg' : '—');
    if (!narrow) {
      row(4, 'mean free path 1/Σt', (1 / Cr.X.St).toFixed(2) + ' cm');
      row(5, 'population after 80 generations', Cr.k > 0 ? '× ' + Math.pow(Cr.k, 80).toExponential(2) : '0');
      row(6, 'one generation (fast)', '≈ 10 ns → 80 in ≈ 1 µs');
    }
  }

  const DEC = S => S.p.mode === 'decay', CHN = S => S.p.mode === 'chain', BND = S => S.p.mode === 'bind',
        CRT = S => S.p.mode === 'crit', ALP = S => S.p.mode === 'bind' && S.p.bsub === 'alpha', CUR = S => S.p.mode === 'bind' && S.p.bsub === 'curve',
        ACT = S => S.p.mode === 'chain' && S.p.chain === 'NaAct', MOT = S => S.p.mode === 'chain' && S.p.chain === 'MoTc';

  L.register({
    id: 'nuclei', subject: 'physics',
    name: 'Nuclei — Decay, Chains, Binding Energy and Criticality',
    chapter: 'Nuclei',
    exams: ['JEE Main', 'JEE Advanced', 'NEET UG'],
    weight: 'Very high yield',
    is3D: true,
    stageHint: 'Drag to orbit · drag the ring on the Geiger tube to move it along the bench',
    lede: 'Four set-ups, and not one curve on them is drawn from a formula. A source of real nuclei <b>decays by chance</b>, ' +
      'and a Geiger–Müller tube records what reaches it through air and an absorber, with its own <b>dead time</b> and the room\'s ' +
      '<b>background</b>. The half-life is then <b>fitted from the counts</b>, and it comes out wrong in the ways a real one does. ' +
      'Decay chains are integrated and run atom by atom, so <b>equilibrium</b> is something you watch arrive. Every binding energy ' +
      'and Q-value is a <b>sum of measured masses</b>. A sphere of uranium is followed neutron by neutron until the counted ' +
      '<b>k</b> tells you whether it is critical.',

    params: { mode: 'decay', iso: 'Rn220', A0: 50, dcm: 3, absb: 'none', bg: 0.5, tc: 10, dead: true, corr: true, seed: 1,
              chain: 'MoTc', milk: false, Rprod: 1, tirr: 15,
              bsub: 'curve', nuc: 'Fe-56', aiso: 'alpha',
              rcm: 8.8, enr: 100, dens: 1, rods: 0, refl: false, run: true },

    presets: [
      { name: 'Thoron · a half-life in a minute', params: { mode: 'decay', iso: 'Rn220', A0: 50, dcm: 3, absb: 'none', bg: 0.5, tc: 10, dead: true, corr: true, seed: 1 } },
      { name: 'Thoron from 6 cm · the alphas never arrive', params: { mode: 'decay', iso: 'Rn220', A0: 50, dcm: 6, absb: 'none', bg: 0.5, tc: 10, dead: true, corr: true, seed: 1 } },
      { name: 'Ba-137m from a generator · gamma', params: { mode: 'decay', iso: 'Ba137m', A0: 200, dcm: 2, absb: 'none', bg: 0.5, tc: 10, dead: true, corr: true, seed: 1 } },
      { name: 'P-32 behind paper · beta gets through', params: { mode: 'decay', iso: 'P32', A0: 20, dcm: 4, absb: 'paper', bg: 0.5, tc: 10, dead: true, corr: true, seed: 1 } },
      { name: 'P-32 behind 3 mm aluminium · stopped', params: { mode: 'decay', iso: 'P32', A0: 20, dcm: 4, absb: 'al', bg: 0.5, tc: 10, dead: true, corr: true, seed: 1 } },
      { name: 'Tc-99m behind lead', params: { mode: 'decay', iso: 'Tc99m', A0: 300, dcm: 2, absb: 'pb', bg: 0.5, tc: 10, dead: true, corr: true, seed: 1 } },
      { name: 'Hot source · dead time bends the plot', params: { mode: 'decay', iso: 'P32', A0: 200, dcm: 3, absb: 'none', bg: 0.5, tc: 10, dead: true, corr: false, seed: 1 } },
      { name: 'Hot source · corrected for dead time', params: { mode: 'decay', iso: 'P32', A0: 200, dcm: 3, absb: 'none', bg: 0.5, tc: 10, dead: true, corr: true, seed: 1 } },
      { name: 'The technetium cow · transient equilibrium', params: { mode: 'chain', chain: 'MoTc', milk: false, seed: 1 } },
      { name: 'Milk the cow every 24 h', params: { mode: 'chain', chain: 'MoTc', milk: true, seed: 1 } },
      { name: 'Radium and radon · secular equilibrium', params: { mode: 'chain', chain: 'RaRn', milk: false, seed: 1 } },
      { name: 'Te-131 → I-131 · no equilibrium', params: { mode: 'chain', chain: 'TeI', milk: false, seed: 1 } },
      { name: 'Neutron activation · saturation', params: { mode: 'chain', chain: 'NaAct', Rprod: 1, tirr: 15, seed: 1 } },
      { name: 'Binding curve · iron-56', params: { mode: 'bind', bsub: 'curve', nuc: 'Fe-56' } },
      { name: 'Binding curve · uranium-238', params: { mode: 'bind', bsub: 'curve', nuc: 'U-238' } },
      { name: 'Fission of U-235', params: { mode: 'bind', bsub: 'fission' } },
      { name: 'D–T fusion', params: { mode: 'bind', bsub: 'fusion' } },
      { name: 'Alpha decay of U-238 · who takes the energy', params: { mode: 'bind', bsub: 'alpha', aiso: 'alpha' } },
      { name: 'A bare sphere at 8.8 cm · critical', params: { mode: 'crit', rcm: 8.8, enr: 100, dens: 1, rods: 0, refl: false, seed: 1 } },
      { name: 'Same metal at 7 cm · subcritical', params: { mode: 'crit', rcm: 7, enr: 100, dens: 1, rods: 0, refl: false, seed: 1 } },
      { name: '7 cm inside a reflector', params: { mode: 'crit', rcm: 7, enr: 100, dens: 1, rods: 0, refl: true, seed: 1 } },
      { name: 'Compressed ×2 · implosion', params: { mode: 'crit', rcm: 7, enr: 100, dens: 2, rods: 0, refl: false, seed: 1 } },
      { name: 'Control rods in', params: { mode: 'crit', rcm: 12, enr: 100, dens: 1, rods: 0.4, refl: false, seed: 1 } }
    ],

    controls: [
      { group: 'What is set up', items: [
        { key: 'mode', type: 'select', label: 'Experiment', restructure: true, rebuild: true, options: [
          { value: 'decay', label: 'Counting a source' }, { value: 'chain', label: 'Decay chains' },
          { value: 'bind', label: 'Binding energy and Q' }, { value: 'crit', label: 'A critical sphere' }] }
      ] },
      { group: 'The source and the counter', items: [
        { key: 'iso', type: 'select', label: 'Isotope', restructure: true, when: DEC, options: [
          { value: 'Rn220', label: 'Rn-220 (α, 55.6 s)' }, { value: 'Ba137m', label: 'Ba-137m (γ, 2.55 min)' }, { value: 'Tc99m', label: 'Tc-99m (γ, 6.01 h)' },
          { value: 'I131', label: 'I-131 (β + γ, 8.02 d)' }, { value: 'P32', label: 'P-32 (β, 14.3 d)' }, { value: 'Po210', label: 'Po-210 (α, 138 d)' }] },
        { key: 'A0', label: 'Starting activity', min: 1, max: 300, step: 1, unit: 'kBq', when: DEC, fmt: v => v.toFixed(0), restructure: true },
        { key: 'dcm', label: 'Source to tube window', min: 1, max: 15, step: 0.1, unit: 'cm', when: DEC, fmt: v => v.toFixed(1), restructure: true },
        { key: 'absb', type: 'select', label: 'Absorber between them', restructure: true, when: DEC, options: [
          { value: 'none', label: 'Nothing' }, { value: 'paper', label: 'Paper' }, { value: 'al', label: 'Aluminium 3 mm' }, { value: 'pb', label: 'Lead 2 cm' }] },
        { key: 'bg', label: 'Background count rate', min: 0, max: 5, step: 0.05, unit: '/s', when: DEC, fmt: v => v.toFixed(2), restructure: true },
        { key: 'tc', label: 'Scaler counting time', min: 1, max: 60, step: 1, unit: 's', when: DEC, fmt: v => v.toFixed(0), restructure: true },
        { key: 'dead', type: 'toggle', label: 'GM dead time (200 µs)', restructure: true, when: DEC },
        { key: 'corr', type: 'toggle', label: 'Correct the counts for dead time in the fit', restructure: true, when: DEC }
      ] },
      { group: 'The chain', items: [
        { key: 'chain', type: 'select', label: 'Parent → daughter', restructure: true, rebuild: true, when: CHN, options: [
          { value: 'MoTc', label: 'Mo-99 → Tc-99m' }, { value: 'RaRn', label: 'Ra-226 → Rn-222' }, { value: 'TeI', label: 'Te-131 → I-131' }, { value: 'NaAct', label: 'Neutron activation of Na-23' }] },
        { key: 'milk', type: 'toggle', label: 'Elute the Tc-99m every 24 h', restructure: true, when: MOT },
        { key: 'Rprod', label: 'Production rate R', min: 0.1, max: 10, step: 0.1, unit: '× 10⁹ /s', when: ACT, fmt: v => v.toFixed(1), restructure: true },
        { key: 'tirr', label: 'Time in the beam', min: 1, max: 80, step: 0.5, unit: 'h', when: ACT, fmt: v => v.toFixed(1), restructure: true }
      ] },
      { group: 'Nuclei and reactions', items: [
        { key: 'bsub', type: 'select', label: 'Show', restructure: true, rebuild: true, when: BND, options: [
          { value: 'curve', label: 'One nucleus on the curve' }, { value: 'fission', label: 'Fission' }, { value: 'fusion', label: 'Fusion' }, { value: 'alpha', label: 'Alpha decay' }] },
        { key: 'nuc', type: 'select', label: 'Nucleus', restructure: true, when: CUR, options: NUC.map(n => ({ value: n.id, label: n.id })) },
        { key: 'aiso', type: 'select', label: 'Alpha emitter', restructure: true, when: ALP, options: [
          { value: 'alpha', label: 'U-238' }, { value: 'alphaRa', label: 'Ra-226' }, { value: 'alphaPo', label: 'Po-210' }] }
      ] },
      { group: 'The sphere', items: [
        { key: 'rcm', label: 'Radius', min: 2, max: 40, step: 0.05, unit: 'cm', when: CRT, fmt: v => v.toFixed(2), restructure: true },
        { key: 'enr', label: 'Enrichment in U-235', min: 3, max: 100, step: 1, unit: '%', when: CRT, fmt: v => v.toFixed(0), restructure: true },
        { key: 'dens', label: 'Compression (density ×)', min: 0.5, max: 3, step: 0.05, unit: '×', when: CRT, fmt: v => v.toFixed(2), restructure: true },
        { key: 'rods', label: 'Control absorber per U atom', min: 0, max: 0.8, step: 0.01, unit: 'b', when: CRT, fmt: v => v.toFixed(2), restructure: true },
        { key: 'refl', type: 'toggle', label: 'Surround it with a reflector', restructure: true, when: CRT }
      ] },
      { group: 'Chance', items: [
        { key: 'seed', label: 'Run number (a new set of random events)', min: 1, max: 30, step: 1, unit: '', when: S => DEC(S) || CHN(S) || CRT(S), fmt: v => v.toFixed(0), restructure: true }
      ] },
      { group: 'Display', items: [
        { key: 'run', type: 'toggle', label: 'Let it run' }
      ] }
    ],

    setup(S) {
      const p = S.p;
      if (p.mode === 'decay') S.Dc = runDecay(p);
      else if (p.mode === 'chain') S.Ch = runChain(p);
      else if (p.mode === 'crit') S.Cr = runCrit(p);
      S.ts = 0; S.hold = 0;
      const views = {
        decay: { theta: -1.30, phi: 0.36, dist: 4.4, target: [1.05, 0, 0.35] },
        chain: { theta: -1.35, phi: 0.24, dist: 3.4, target: [0, 0, 0.6] },
        bind: { theta: -1.45, phi: 0.22, dist: 3.1, target: [0, 0, 0] },
        'bind-curve': { theta: -1.45, phi: 0.22, dist: 1.75, target: [0, 0, 0] },
        crit: { theta: -1.20, phi: 0.30, dist: 4.0, target: [0, 0, 0] }
      };
      const vk = p.mode === 'bind' && p.bsub === 'curve' ? 'bind-curve' : p.mode;
      if (!S.cam || S._view !== vk) { S.cam = Camera(views[vk]); S.cam.minDist = 0.8; S.cam.maxDist = 14; S._view = vk; S._narrowCam = false; }
    },

    step(S, dt) {
      const p = S.p;
      if (!p.run) return;
      if (S.hold > 0) { S.hold -= dt; if (S.hold <= 0) S.ts = 0; return; }
      const end = p.mode === 'decay' ? 20 : p.mode === 'chain' ? 18 : 1e9;
      S.ts += dt;
      if (S.ts >= end) { S.ts = end; S.hold = 3; }
    },

    drawStage(S, g) {
      if (g.w < 660 && !S._narrowCam) { S.cam.dist *= 1.3; S._narrowCam = true; }
      const md = S.p.mode;
      if (md === 'decay') drawDecay(S, g);
      else if (md === 'chain') drawChain(S, g);
      else if (md === 'bind') drawBind(S, g);
      else drawCrit(S, g);
    },

    onDrag(S, e) {
      const p = S.p, along = a => a ? (e.dx * a.ux + e.dy * a.uy) * a.per : 0;
      if (e.id === 'gm' && S._axT) { p.dcm = clamp(p.dcm + along(S._axT), 1, 15); this.setup(S); }
    },

    plots: [
      { title: S => ({ decay: 'The scaler\'s counts, window by window', chain: 'Activities against time (log scale): integrated lines, atom-by-atom dots',
                       bind: S.p.bsub === 'curve' ? 'Binding energy per nucleon — measured masses and the liquid drop' : 'Where the reaction sits on the binding curve',
                       crit: 'Neutrons per generation (log scale)' })[S.p.mode],
        draw(S, g) {
          const p = S.p, th = g.theme, cy = '#3DD6F5', gr = '#7CF0B0', am = '#F5B451', pk = '#FF8FB0';
          if (p.mode === 'decay') {
            const Dc = S.Dc, u = Dc.u, now = decayNow(S);
            const hi = Math.max(10, ...Dc.win.map(w => w.c + 2 * Math.sqrt(w.c + 1))) * 1.08;
            const P = g.Plot({ xmin: 0, xmax: Dc.tEnd / u.k, ymin: 0, ymax: hi, xlabel: 'time (' + u.u + ')', ylabel: 'counts in ' + Dc.tc.toFixed(0) + ' s', xfmt: v => v.toFixed(v < 10 ? 1 : 0), yfmt: v => v.toFixed(0) }).frame();
            const ideal = [];
            for (let i = 0; i <= 120; i++) { const t = Dc.tEnd * i / 120; ideal.push([t / u.k, (Dc.lam * Dc.Nat(t) * Dc.eff + Dc.bg) * Dc.tc]); }
            P.clip(() => {
              P.hline(Dc.bg * Dc.tc, g.alpha(th['text-3'], .8), [3, 3]);
              P.line(ideal, g.alpha(am, .8), 1.4, [5, 3]);
              Dc.win.forEach((w, i) => { if (i > now.k) return; const x = w.t / u.k, e = Math.sqrt(w.c);
                P.line([[x, Math.max(0, w.c - e)], [x, w.c + e]], g.alpha(cy, .6), 1); P.dot(x, w.c, 3, cy); });
              P.vline(now.tp / u.k, g.alpha(gr, .7), [3, 3]);
            });
            P.tag(Dc.tEnd / u.k * 0.98, ideal[0][1], p.dead ? 'no dead time (dashed)' : 'expected (dashed)', am, 'right', -8);
            P.tag(Dc.tEnd / u.k * 0.98, Dc.bg * Dc.tc, 'background', th['text-3'], 'right', -8);
            return;
          }
          if (p.mode === 'chain') {
            const Ch = S.Ch, u = Ch.u, tp = clamp(S.ts / 18, 0, 1) * Ch.tEnd, L10 = Math.log10;
            const la = [], lb = [];
            Ch.out.forEach((o, i) => { if (i % 20) return; const x = o[0] / u.k;
              if (!Ch.act && Ch.lA * o[1] > 0) la.push([x, L10(Ch.lA * o[1])]); if (Ch.lB * o[2] > 0) lb.push([x, L10(Ch.lB * o[2])]); });
            const all = la.concat(lb).map(q => q[1]), top = Math.ceil(Math.max(...all)) + 0.3, bot = Math.max(Math.min(...all), top - 7);
            const P = g.Plot({ xmin: 0, xmax: Ch.tEnd / u.k, ymin: bot, ymax: top, xlabel: 'time (' + u.u + ')', ylabel: 'log₁₀ activity (Bq)', xfmt: v => v.toFixed(0), yfmt: v => v.toFixed(1) }).frame();
            // the same run, atom by atom: 1600 atoms scaled up to the real population
            const dots = [], NA0 = Ch.act ? Ch.Rp * Math.min(Ch.tIrr, Ch.tEnd) : Ch.C.NA0, nA = Ch.atoms.length;
            for (let k = 1; k <= 24; k++) {
              const t = Ch.tEnd * k / 24; let a = 0, b = 0;
              Ch.atoms.forEach(at => { if (Ch.act && at.born > t) return; if (t < at.tA) a++; else if (t < at.tA + at.tB) {
                if (Ch.milk) { const fm = Math.ceil(at.tA / Ch.milk) * Ch.milk; if (fm <= t && fm < at.tA + at.tB && fm > 0) return; } b++; } });
              if (!Ch.act && a > 0) dots.push([t / u.k, L10(Ch.lA * a / nA * NA0), am]);
              if (b > 0) dots.push([t / u.k, L10(Ch.lB * b / nA * NA0), cy]);
            }
            P.clip(() => { if (la.length) P.line(la, am, 2.2); P.line(lb, cy, 2.2); dots.forEach(d => P.dot(d[0], d[1], 2.6, d[2])); P.vline(tp / u.k, g.alpha(gr, .7), [3, 3]);
              if (!isNaN(Ch.tMaxF) && Ch.tMaxF < Ch.tEnd) P.vline(Ch.tMaxF / u.k, g.alpha(pk, .7), [2, 3]); });
            if (la.length) P.tag(Ch.tEnd / u.k * 0.02, la[0][1], Ch.C.a, am, 'left', -8);
            P.tag(Ch.tEnd / u.k * 0.98, lb[lb.length - 1][1], Ch.C.b, cy, 'right', -8);
            return;
          }
          if (p.mode === 'bind') {
            const P = g.Plot({ xmin: 0, xmax: 250, ymin: 0, ymax: 9.4, xlabel: 'mass number A', ylabel: 'B/A (MeV)', xfmt: v => v.toFixed(0), yfmt: v => v.toFixed(0) }).frame();
            const curve = [];
            for (let A = 4; A <= 250; A++) { const Z = Math.round(valleyZ(A)); curve.push([A, semf(Z, A).B / A]); }
            P.clip(() => {
              P.line(curve, g.alpha(am, .85), 1.6, [5, 3]);
              NUC.forEach(n => P.dot(n.A, n.BA, 3, n.id === p.nuc && p.bsub === 'curve' ? pk : cy));
              if (p.bsub === 'fission') { P.line([[235, NBY['U-235'].BA], [141, NBY['Ba-141'].BA]], pk, 1.4, [3, 2]); P.line([[235, NBY['U-235'].BA], [92, NBY['Kr-92'].BA]], pk, 1.4, [3, 2]); }
              if (p.bsub === 'fusion') { P.line([[2, NBY['H-2'].BA], [4, NBY['He-4'].BA]], pk, 1.4, [3, 2]); P.line([[3, NBY['H-3'].BA], [4, NBY['He-4'].BA]], pk, 1.4, [3, 2]); }
            });
            P.tag(56, 8.9, 'Fe-56 / Ni-62: the summit', th['text-2'], 'center', -8);
            P.tag(245, 7.0, 'liquid drop (dashed)', am, 'right', 0);
            if (p.bsub === 'curve') { const n = NBY[p.nuc]; P.tag(n.A, n.BA, n.id + ' ' + n.BA.toFixed(3), pk, n.A > 150 ? 'right' : 'left', 12); }
            return;
          }
          const Cr = S.Cr, pts = Cr.pop.map((v, i) => [i, v > 0 ? Math.log10(v) : -3]);
          const top = Math.max(1, ...pts.map(q => q[1])) + 0.3, bot = Math.min(-1, ...pts.map(q => q[1])) - 0.3;
          const P = g.Plot({ xmin: 0, xmax: pts.length - 1, ymin: bot, ymax: top, xlabel: 'generation', ylabel: 'log₁₀ (neutrons ÷ start)', xfmt: v => v.toFixed(0), yfmt: v => v.toFixed(1) }).frame();
          P.clip(() => { P.hline(0, g.alpha(th['text-3'], .8), [3, 3]); P.line(pts.map(q => [q[0], q[0] * Math.log10(Math.max(1e-9, Cr.k))]), g.alpha(am, .8), 1.4, [5, 3]); P.line(pts, gr, 2.2); pts.forEach(q => P.dot(q[0], q[1], 2.5, gr)); });
          P.tag(pts.length - 1.2, (pts.length - 1) * Math.log10(Math.max(1e-9, Cr.k)), 'k^g, k = ' + Cr.k.toFixed(3), am, 'right', -8);
        } },
      { title: S => ({ decay: 'ln(net count rate) against time — the slope is −λ', chain: S.p.chain === 'NaAct' ? 'Growth to saturation: A/R against time' : 'The activity ratio A_B/A_A — where each chain settles',
                       bind: S.p.bsub === 'curve' ? 'The liquid drop\'s five terms across the table' : 'Energy ledger: binding before and after',
                       crit: 'k against radius — where it crosses one is the critical size' })[S.p.mode],
        draw(S, g) {
          const p = S.p, th = g.theme, cy = '#3DD6F5', gr = '#7CF0B0', am = '#F5B451', pk = '#FF8FB0';
          if (p.mode === 'decay') {
            const Dc = S.Dc, u = Dc.u, f = Dc.fit, pts = f.pts.filter(Boolean);
            if (!pts.length) { const P = g.Plot({ xmin: 0, xmax: Dc.tEnd / u.k, ymin: 0, ymax: 1, xlabel: 'time (' + u.u + ')', ylabel: 'ln rate' }).frame(); P.tag(Dc.tEnd / u.k / 2, 0.5, 'nothing above background to fit', pk, 'center', 0); return; }
            const ys = pts.map(q => q[1]), lo = Math.min(...ys) - 0.5, hi = Math.max(...ys) + 0.5;
            const P = g.Plot({ xmin: 0, xmax: Dc.tEnd / u.k, ymin: lo, ymax: hi, xlabel: 'time (' + u.u + ')', ylabel: 'ln(counts/s − background)', xfmt: v => v.toFixed(v < 10 ? 1 : 0), yfmt: v => v.toFixed(1) }).frame();
            P.clip(() => {
              const tr = [[0, Math.log(Dc.lam * Dc.N0 * Dc.eff)], [Dc.tEnd / u.k, Math.log(Dc.lam * Dc.N0 * Dc.eff) - Dc.lam * Dc.tEnd]];
              P.line(tr, g.alpha(am, .7), 1.2, [5, 3]);
              if (f.ok) P.line([[0, f.a], [Dc.tEnd / u.k, f.a - f.lam * Dc.tEnd]], gr, 2);
              pts.forEach(q => P.dot(q[0] / u.k, q[1], 3, cy));
            });
            if (f.ok) P.tag(Dc.tEnd / u.k * 0.97, hi - 0.35, 'fit: T½ = ' + (f.T / u.k).toPrecision(4) + ' ± ' + (f.sT / u.k).toPrecision(2) + ' ' + u.u, gr, 'right', 0);
            P.tag(Dc.tEnd / u.k * 0.97, hi - 0.85, 'true slope (dashed): T½ = ' + (Dc.I.T / u.k).toPrecision(4), am, 'right', 0);
            return;
          }
          if (p.mode === 'chain') {
            const Ch = S.Ch, u = Ch.u, tp = clamp(S.ts / 18, 0, 1) * Ch.tEnd;
            if (Ch.act) {
              const pts = Ch.out.filter((_, i) => i % 20 === 0).map(o => [o[0] / u.k, Ch.lB * o[2] / Ch.Rp]);
              const P = g.Plot({ xmin: 0, xmax: Ch.tEnd / u.k, ymin: 0, ymax: 1.1, xlabel: 'time (' + u.u + ')', ylabel: 'A / R', xfmt: v => v.toFixed(0), yfmt: v => v.toFixed(1) }).frame();
              P.clip(() => { P.hline(1, g.alpha(th['text-3'], .8), [3, 3]); P.line(pts, cy, 2.2); P.vline(Ch.tIrr / u.k, g.alpha(pk, .7), [3, 3]);
                [1, 2, 3].forEach(n => { const t = n * Ch.C.TB; if (t < Ch.tIrr) P.dot(t / u.k, 1 - Math.pow(2, -n), 4, am, th['ink-950']); }); P.vline(tp / u.k, g.alpha(gr, .7), [3, 3]); });
              P.tag(Ch.tEnd / u.k * 0.02, 1, 'saturation: A = R', th['text-3'], 'left', -8);
              P.tag(Ch.C.TB / u.k, 0.5, '½ after one half-life', am, 'left', 10);
              return;
            }
            const pts = [];
            Ch.out.forEach((o, i) => { if (i % 10 || o[1] <= 0 || i === 0) return; const r = (Ch.lB * o[2]) / (Ch.lA * o[1]); if (isFinite(r)) pts.push([o[0] / u.k, r]); });
            const lim = Ch.lB > Ch.lA ? Ch.lB / (Ch.lB - Ch.lA) : NaN, hi = Math.min(isFinite(lim) ? lim * 1.5 : 10, Math.max(1.4, ...pts.map(q => q[1])) * 1.08);
            const P = g.Plot({ xmin: 0, xmax: Ch.tEnd / u.k, ymin: 0, ymax: hi, xlabel: 'time (' + u.u + ')', ylabel: 'A_B / A_A', xfmt: v => v.toFixed(0), yfmt: v => v.toFixed(2) }).frame();
            P.clip(() => { if (isFinite(lim)) P.hline(lim, g.alpha(pk, .8), [4, 3]); P.hline(1, g.alpha(th['text-3'], .6), [2, 3]); P.line(pts, cy, 2.2); P.vline(tp / u.k, g.alpha(gr, .7), [3, 3]); });
            if (isFinite(lim)) P.tag(Ch.tEnd / u.k * 0.98, lim, 'λ_B/(λ_B − λ_A) = ' + lim.toFixed(4), pk, 'right', -8);
            else P.tag(Ch.tEnd / u.k * 0.5, hi * 0.8, 'the daughter outlives the parent: the ratio never settles', pk, 'center', 0);
            return;
          }
          if (p.mode === 'bind' && p.bsub === 'curve') {
            const tv = [], ts = [], tc = [], ta = [], tt = [];
            for (let A = 4; A <= 250; A += 2) { const s = semf(Math.round(valleyZ(A)), A); tv.push([A, s.vol / A]); ts.push([A, -s.surf / A]); tc.push([A, -s.coul / A]); ta.push([A, -s.asym / A]); tt.push([A, s.B / A]); }
            const P = g.Plot({ xmin: 0, xmax: 250, ymin: 0, ymax: 17, xlabel: 'mass number A (on the valley of stability)', ylabel: 'MeV per nucleon', xfmt: v => v.toFixed(0), yfmt: v => v.toFixed(0) }).frame();
            P.clip(() => { P.line(tv, gr, 1.6); P.line(ts, pk, 1.6); P.line(tc, am, 1.6); P.line(ta, '#B8A4FF', 1.6); P.line(tt, cy, 2.6); P.vline(NBY[p.nuc].A, g.alpha(th['text-2'], .6), [3, 3]); });
            P.tag(245, 15.75, 'volume +15.75', gr, 'right', -8); P.tag(8, ts[2][1], 'surface −', pk, 'left', -8);
            P.tag(245, tc[tc.length - 1][1], 'Coulomb −', am, 'right', -8); P.tag(245, ta[ta.length - 1][1], 'asymmetry −', '#B8A4FF', 'right', 10);
            P.tag(150, tt[73][1], 'B/A = what is left', cy, 'left', -10);
            return;
          }
          if (p.mode === 'bind') {
            const key = p.bsub === 'alpha' ? p.aiso : p.bsub, Rx = reaction(key), X = Rx.X;
            const Bb = X.lhs.reduce((u2, id) => u2 + NBY[id].B, 0), Ba = X.rhs.reduce((u2, id) => u2 + NBY[id].B, 0);
            // the axis starts just below the smaller total, so a 4 MeV step on 1800 MeV can be seen (it says so)
            const lo = Math.max(0, Math.min(Bb, Ba) - 1.5 * Rx.Q), hi = Math.max(Bb, Ba) + 0.8 * Rx.Q;
            const P = g.Plot({ xmin: 0, xmax: 3, ymin: lo, ymax: hi, xlabel: 'axis starts at ' + lo.toFixed(1) + ' MeV, not zero', ylabel: 'total binding energy (MeV)', xfmt: () => '', yfmt: v => v.toFixed(Rx.Q < 20 ? 1 : 0) }).frame();
            P.clip(() => { P.bar(0.8, Bb, 0.35, lo, g.alpha(cy, .75)); P.bar(2.2, Ba, 0.35, lo, g.alpha(gr, .75)); P.line([[0.8, Bb], [2.2, Bb]], pk, 1.2, [3, 3]); P.line([[2.2, Bb], [2.2, Ba]], pk, 2.4); });
            P.tag(0.8, Bb, 'before ' + Bb.toFixed(2), cy, 'center', -10); P.tag(2.2, Ba, 'after ' + Ba.toFixed(2), gr, 'center', -10);
            P.tag(2.62, (Ba + Bb) / 2, 'Q = ' + Rx.Q.toFixed(3) + ' MeV', pk, 'left', 0);
            return;
          }
          const K = S.Cr.curve;
          const P = g.Plot({ xmin: 0, xmax: 42, ymin: 0, ymax: Math.max(1.3, ...K.pts.map(q => q[1])) * 1.08, xlabel: 'radius (cm)', ylabel: 'k (counted)', xfmt: v => v.toFixed(0), yfmt: v => v.toFixed(1) }).frame();
          P.clip(() => { P.hline(1, g.alpha(pk, .8), [4, 3]); P.line(K.pts, cy, 2); K.pts.forEach(q => P.dot(q[0], q[1], 3, cy)); if (isFinite(K.rc) && !K.extrap) P.vline(K.rc, g.alpha(gr, .8), [3, 3]); P.dot(S.Cr.R, S.Cr.k, 5.5, am, th['ink-950']); });
          if (isFinite(K.rc) && !K.extrap) P.tag(K.rc, 0.15, 'r_c = ' + K.rc.toFixed(2) + ' cm · ' + K.mc.toFixed(1) + ' kg', gr, 'left', 0);
          P.tag(41, 1, 'k = 1', pk, 'right', -8);
        } }
    ],

    readouts(S) {
      const p = S.p;
      if (p.mode === 'decay') {
        const Dc = S.Dc, u = Dc.u, now = decayNow(S);
        return [
          { label: 'Counts this window', value: String(now.shown), unit: '', flag: 'accent', hint: '± ' + Math.sqrt(Math.max(1, now.w.c)).toFixed(0) + ' (√N)' },
          { label: 'Recorded rate', value: now.w.m.toFixed(1), unit: '/s' },
          { label: 'Fitted half-life', value: Dc.fit.ok ? (Dc.fit.T / u.k).toPrecision(4) : '—', unit: u.u, flag: Dc.fit.ok && Math.abs(Dc.fit.T / Dc.I.T - 1) < 0.05 ? 'ok' : 'warn' },
          { label: 'Decay constant λ', value: Dc.lam.toExponential(3), unit: '/s' },
          { label: 'Nuclei left', value: (now.w.N / Dc.N0 * 100).toFixed(2), unit: '%' },
          { label: 'Tube efficiency', value: (Dc.eff * 100).toPrecision(3), unit: '%', hint: 'geometry × reach' }
        ];
      }
      if (p.mode === 'chain') {
        const Ch = S.Ch, st = Ch.at(clamp(S.ts / 18, 0, 1) * Ch.tEnd);
        return [
          { label: 'Daughter activity', value: (Ch.lB * st[2]).toExponential(3), unit: 'Bq', flag: 'accent' },
          { label: 'Parent activity', value: Ch.act ? '—' : (Ch.lA * st[1]).toExponential(3), unit: 'Bq' },
          { label: 'Peak of daughter (run)', value: Ch.C.kind === 'transient' || Ch.C.kind === 'none' ? tfmt(Ch.tMax) : '—', unit: '' },
          { label: 'Formula ln(λB/λA)/(λB−λA)', value: isFinite(Ch.tMaxF) && Ch.C.kind !== 'secular' ? tfmt(Ch.tMaxF) : '—', unit: '' },
          { label: 'Ratio at the end', value: isFinite(Ch.ratioEnd) ? Ch.ratioEnd.toFixed(4) : '—', unit: '', hint: Ch.C.kind }
        ];
      }
      if (p.mode === 'bind') {
        if (p.bsub === 'curve') { const n = NBY[p.nuc], s = semf(n.Z, n.A);
          return [
            { label: 'Binding energy (masses)', value: n.B.toFixed(3), unit: 'MeV', flag: 'accent' },
            { label: 'Per nucleon', value: n.BA.toFixed(4), unit: 'MeV' },
            { label: 'Liquid-drop formula', value: s.B.toFixed(1), unit: 'MeV', hint: ((s.B / n.B - 1) * 100).toFixed(1) + '%' },
            { label: 'Radius 1.2A^⅓', value: (1.2 * Math.cbrt(n.A)).toFixed(2), unit: 'fm' },
            { label: 'Mass defect', value: (n.B / U_MEV).toFixed(5), unit: 'u' }
          ]; }
        const Rx = reaction(p.bsub === 'alpha' ? p.aiso : p.bsub);
        return [
          { label: 'Q-value', value: Rx.Q.toFixed(3), unit: 'MeV', flag: 'accent' },
          { label: 'Mass lost', value: (Rx.massDefect * 1000).toFixed(3), unit: 'mu' },
          { label: p.bsub === 'alpha' ? 'α kinetic energy' : 'Energy per kg', value: p.bsub === 'alpha' ? Rx.Ka.toFixed(3) : (Rx.Jkg / 1e13).toFixed(2), unit: p.bsub === 'alpha' ? 'MeV' : '× 10¹³ J' },
          { label: p.bsub === 'alpha' ? 'Recoil energy' : 'ΔB check', value: p.bsub === 'alpha' ? (Rx.Kd * 1000).toFixed(1) : Rx.dB.toFixed(3), unit: p.bsub === 'alpha' ? 'keV' : 'MeV' }
        ];
      }
      const Cr = S.Cr;
      return [
        { label: 'k (counted)', value: Cr.k.toFixed(3), unit: '± ' + Cr.sd.toFixed(3), flag: Cr.k >= 1.005 ? 'crit' : Cr.k > 0.995 ? 'warn' : 'accent' },
        { label: 'k∞ (infinite)', value: Cr.X.kinf.toFixed(3), unit: '' },
        { label: 'Leakage', value: (Cr.leakF * 100).toFixed(1), unit: '%' },
        { label: 'Mass', value: Cr.mass.toFixed(1), unit: 'kg' },
        { label: 'Critical radius', value: isFinite(Cr.curve.rc) ? Cr.curve.rc.toFixed(2) : '—', unit: 'cm' },
        { label: 'Critical mass', value: isFinite(Cr.curve.mc) ? Cr.curve.mc.toFixed(1) : '—', unit: 'kg' }
      ];
    },

    equation(S) {
      const p = S.p;
      if (p.mode === 'decay') return E.v('N') + ' ' + E.op('=') + ' ' + E.v('N') + '₀' + E.v('e') + '<sup>−λt</sup> · ln(' + E.v('R') + ' ' + E.op('−') + ' ' + E.v('B') + ') ' + E.op('=') + ' const ' + E.op('−') + ' λ' + E.v('t') + ' · measured ' + E.v('m') + ' ' + E.op('=') + ' ' + E.frac(E.v('n'), '1 + ' + E.v('n') + 'τ') +
        ' → fitted T½ ' + E.op('=') + ' ' + (S.Dc.fit.ok ? E.n(S.Dc.fit.T / S.Dc.u.k, S.Dc.u.u) : '—');
      if (p.mode === 'chain') return S.Ch.act ? E.frac(E.v('dN'), E.v('dt')) + ' ' + E.op('=') + ' ' + E.v('R') + ' ' + E.op('−') + ' λ' + E.v('N') + ' → ' + E.v('A') + ' ' + E.op('=') + ' ' + E.v('R') + '(1 ' + E.op('−') + ' ' + E.v('e') + '<sup>−λt</sup>)'
        : E.frac(E.v('dN') + E.sub('B'), E.v('dt')) + ' ' + E.op('=') + ' λ' + E.sub('A') + E.v('N') + E.sub('A') + ' ' + E.op('−') + ' λ' + E.sub('B') + E.v('N') + E.sub('B') + ' · ' + E.v('t') + E.sub('max') + ' ' + E.op('=') + ' ' + E.frac('ln(λ' + E.sub('B') + '/λ' + E.sub('A') + ')', 'λ' + E.sub('B') + ' ' + E.op('−') + ' λ' + E.sub('A'));
      if (p.mode === 'bind') return p.bsub === 'curve' ? E.v('B') + ' ' + E.op('=') + ' [' + E.v('Z') + E.v('m') + E.sub('H') + ' + ' + E.v('N') + E.v('m') + E.sub('n') + ' ' + E.op('−') + ' ' + E.v('M') + '(' + E.v('A') + ',' + E.v('Z') + ')]' + E.v('c') + '² ' + E.op('=') + ' ' + E.n(NBY[p.nuc].B, 'MeV')
        : E.v('Q') + ' ' + E.op('=') + ' [Σ' + E.v('M') + E.sub('before') + ' ' + E.op('−') + ' Σ' + E.v('M') + E.sub('after') + ']' + E.v('c') + '² ' + E.op('=') + ' ' + E.n(reaction(p.bsub === 'alpha' ? p.aiso : p.bsub).Q, 'MeV');
      return E.v('k') + ' ' + E.op('=') + ' ' + E.frac('neutrons in generation ' + E.v('g') + ' + 1', 'neutrons in generation ' + E.v('g')) + ' ' + E.op('=') + ' ' + E.n(S.Cr.k, '') + ' · ' + E.v('k') + '∞ ' + E.op('=') + ' ' + E.frac('νΣ' + E.sub('f'), 'Σ' + E.sub('a'));
    },

    eqNote: '<b>Every law here is measured, not assumed.</b> The half-life is a straight-line fit through counts that carry √N noise, ' +
      'a background floor and the counter\'s dead time; drop the dead-time correction on a hot source and the fitted half-life comes out ' +
      'far too long, because the tube misses more of the early counts. Chain equilibria are what the integration settles to. Q-values are ' +
      'mass differences, checked against binding-energy differences. And k is simply the ratio of one generation of neutrons to the last.',

    problems: [
      { source: 'NEET pattern · half-life from counts',
        q: 'A thoron (Rn-220) source is counted continuously in 7.1 s windows as it decays. The true half-life is 55.6 s. Predict what the straight-line fit of ln(net rate) against time will return, in s.',
        params: { mode: 'decay', iso: 'Rn220', A0: 50, dcm: 3, absb: 'none', bg: 0.5, tc: 10, dead: true, corr: true, seed: 1 },
        predict: { label: 'fitted half-life', unit: 's', tol: 0.02 },
        measure: S => S.Dc.fit.T,
        working: 'With background subtracted and the dead time corrected, ln(R − B) falls on a line of slope −λ, and T½ = ln 2/λ = <b>55.6 s</b>. ' +
          'The fit lands within its ±0.2 s error. The count in each window scatters by √N, so a single pair of readings can be well out, which is why the fit uses all forty.' },
      { source: 'JEE Main pattern · mean life',
        q: 'For the same thoron source, what is the mean life τ (the time for the activity to fall to 1/e of its value), in s?',
        params: { mode: 'decay', iso: 'Rn220', A0: 50, dcm: 3, absb: 'none', bg: 0.5, tc: 10, dead: true, corr: true, seed: 1 },
        predict: { label: 'mean life', unit: 's', tol: 0.02 },
        measure: S => 1 / S.Dc.fit.lam,
        working: 'τ = 1/λ = T½/ln 2 = 55.6/0.693 = <b>80.2 s</b>. The mean life is longer than the half-life. After one mean life, 37% remains, not 50%.' },
      { source: 'JEE Advanced pattern · counter dead time',
        q: 'Particles reach a GM tube at 8166 per second. The tube is blind for 200 µs after each count (non-paralysable). What count rate does the scaler record, per second?',
        params: { mode: 'decay', iso: 'P32', A0: 200, dcm: 3, absb: 'none', bg: 0.5, tc: 10, dead: true, corr: false, seed: 1 },
        predict: { label: 'recorded rate', unit: '/s', tol: 0.02 },
        measure: S => S.Dc.win[0].m,
        working: 'm = n/(1 + nτ) = 8166/(1 + 8166 × 2 × 10⁻⁴) = 8166/2.633 = <b>3101 /s</b>. The simulated tube, dead after each pulse, records 3101 /s in its first 10 s count. ' +
          'Uncorrected, the early counts are cut most, so the log plot is flattened and the fitted half-life comes out about 1.44 times too long.' },
      { source: 'JEE Advanced pattern · transient equilibrium',
        q: 'Mo-99 (T½ = 65.94 h) decays to Tc-99m (T½ = 6.01 h). Starting from pure Mo-99, when is the Tc-99m activity greatest, in hours?',
        params: { mode: 'chain', chain: 'MoTc', milk: false, seed: 1 },
        predict: { label: 'time of peak', unit: 'h', tol: 0.01 },
        measure: S => S.Ch.tMax / HR,
        working: 'The daughter peaks when dN_B/dt = 0, which gives t = ln(λ_B/λ_A)/(λ_B − λ_A) = ln(10.98)/(0.10488 h⁻¹) = <b>22.8 h</b>. ' +
          'That is why hospitals elute their generator once a day. The integration finds the peak at the same hour.' },
      { source: 'JEE Advanced pattern · secular equilibrium',
        q: 'One gram of Ra-226 (T½ = 1600 yr) is sealed in a capsule. After 30 days, how many micrograms of Rn-222 (T½ = 3.82 d) are in it?',
        params: { mode: 'chain', chain: 'RaRn', milk: false, seed: 1 },
        predict: { label: 'mass of radon', unit: 'µg', tol: 0.01 },
        measure: S => S.Ch.last[2] * 222 / NA * 1e6,
        working: 'At equilibrium λ_A N_A = λ_B N_B, so N_B = N_A × T_B/T_A = 2.665 × 10²¹ × 3.8235/(1600 × 365.25) = 1.744 × 10¹⁶ atoms = 6.43 µg. ' +
          'After 30 days (7.8 radon half-lives) it has reached 1 − 2⁻⁷·⁸ = 99.56% of that: <b>6.40 µg</b>.' },
      { source: 'JEE Advanced pattern · activation',
        q: 'Na-24 (T½ = 15.0 h) is produced at a steady 1.0 × 10⁹ nuclei per second. What is its activity after 15.0 h of irradiation, in GBq?',
        params: { mode: 'chain', chain: 'NaAct', Rprod: 1, tirr: 15, seed: 1 },
        predict: { label: 'activity', unit: 'GBq', tol: 0.01 },
        measure: S => S.Ch.lB * S.Ch.at(15 * HR)[2] / 1e9,
        working: 'dN/dt = R − λN gives A = λN = R(1 − e^(−λt)). One half-life of irradiation gives half the saturation activity: <b>0.500 GBq</b>. ' +
          'Irradiating for ten half-lives gets only to 99.9%. Saturation, A = R, is never quite reached.' },
      { source: 'JEE Main pattern · energy released in fission',
        q: 'U-235 + n → Ba-141 + Kr-92 + 3n. Using the atomic masses, find the energy released, in MeV.',
        params: { mode: 'bind', bsub: 'fission' },
        predict: { label: 'Q', unit: 'MeV', tol: 0.01 },
        measure: S => reaction('fission').Q,
        working: 'Q = [M(U-235) + m_n − M(Ba-141) − M(Kr-92) − 3m_n]c². In mass excesses: 40.921 + 8.071 − (−79.726) − (−68.769) − 3 × 8.071 = <b>173.3 MeV</b>. ' +
          'The usual "200 MeV" adds the later beta decays of the fragments.' },
      { source: 'JEE Main pattern · D–T fusion',
        q: 'Find the energy released in ²H + ³H → ⁴He + n, in MeV.',
        params: { mode: 'bind', bsub: 'fusion' },
        predict: { label: 'Q', unit: 'MeV', tol: 0.01 },
        measure: S => reaction('fusion').Q,
        working: 'Q = B(He-4) − B(H-2) − B(H-3) = 28.296 − 2.225 − 8.482 = <b>17.59 MeV</b>. Per kilogram that is 3.4 × 10¹⁴ J, four times fission. ' +
          'The neutron carries 4/5 of it (14.1 MeV), because the two share equal momentum.' },
      { source: 'JEE Advanced pattern · alpha decay energy sharing',
        q: 'U-238 at rest decays by alpha emission (Q = 4.270 MeV). What kinetic energy does the alpha particle carry, in MeV?',
        params: { mode: 'bind', bsub: 'alpha', aiso: 'alpha' },
        predict: { label: 'K_α', unit: 'MeV', tol: 0.005 },
        measure: S => reaction('alpha').Ka,
        working: 'Momentum conservation: p_α = p_Th, so K ∝ 1/m. K_α = Q × m_Th/(m_Th + m_α) ≈ Q(A − 4)/A = 4.270 × 234/238 = <b>4.198 MeV</b> (4.197 with the exact masses). ' +
          'The heavy daughter recoils with only 72 keV.' },
      { source: 'JEE Main pattern · binding energy per nucleon',
        q: 'Using M(⁴He) = 4.002603 u, m(¹H) = 1.007825 u, m_n = 1.008665 u, find the binding energy per nucleon of He-4, in MeV.',
        params: { mode: 'bind', bsub: 'curve', nuc: 'He-4' },
        predict: { label: 'B/A', unit: 'MeV', tol: 0.005 },
        measure: S => NBY['He-4'].BA,
        working: 'Δm = 2(1.007825) + 2(1.008665) − 4.002603 = 0.030377 u. B = 0.030377 × 931.494 = 28.30 MeV, and B/A = <b>7.07 MeV</b>. ' +
          'He-4 sits far above its neighbours on the curve, which is why alpha particles, not single nucleons, leave heavy nuclei.' },
      { source: 'JEE Advanced pattern · critical mass and density',
        q: 'A bare sphere of U-235 metal is compressed to twice its normal density. By what factor does its critical MASS fall?',
        params: { mode: 'crit', rcm: 7, enr: 100, dens: 2, rods: 0, refl: false, seed: 1 },
        predict: { label: 'factor', unit: '×', tol: 0.06 },
        measure: S => kCurve(Object.assign({}, S.p, { dens: 1 })).mc / kCurve(S.p).mc,
        working: 'Every cross-section per centimetre doubles, so every length scales as 1/ρ: the critical radius halves. The mass is ρ × (4/3)πr³ ∝ ρ × ρ⁻³ = ρ⁻². ' +
          'So the critical mass falls by <b>4</b>. This is how an implosion makes a sub-critical core critical. The counted run gives exactly 4: with the same random numbers, every neutron history in the dense sphere is the same history at half the scale.' }
    ],

    walkthrough: [
      { title: '1 · Count a source',
        body: 'Thoron, an alpha emitter, 3 cm from a Geiger tube. The scaler counts continuously, in 7.1 s windows.',
        ask: 'Two consecutive counts differ by 30. Is the source misbehaving?',
        reveal: '<b>No: counts scatter by √N.</b> A count of 900 is uncertain by ±30. That is why the half-life comes from a straight-line fit through all the points, not from two readings.',
        params: { mode: 'decay', iso: 'Rn220', A0: 50, dcm: 3, absb: 'none', bg: 0.5, tc: 10, dead: true, corr: true, seed: 1 } },
      { title: '2 · Move the tube back',
        body: 'Drag the tube to 6 cm.',
        ask: 'By the inverse-square law the rate should fall to a quarter. What does the scaler show?',
        reveal: '<b>Background only.</b> Alphas from thoron travel about 5 cm in air and then stop. The inverse-square law holds for gamma rays, not for particles with a range.',
        params: { mode: 'decay', iso: 'Rn220', A0: 50, dcm: 6, absb: 'none', bg: 0.5, tc: 10, dead: true, corr: true, seed: 1 } },
      { title: '3 · Paper, then aluminium',
        body: 'A beta source (P-32) behind a sheet of paper, then 3 mm of aluminium.',
        ask: 'Which one stops the betas?',
        reveal: '<b>The aluminium.</b> Paper takes about 7% of P-32\'s hard betas; 3 mm of aluminium lets through only about 1 in 1800. Alpha: paper. Beta: a few mm of aluminium. Gamma: cm of lead, and never completely.',
        params: { mode: 'decay', iso: 'P32', A0: 20, dcm: 4, absb: 'al', bg: 0.5, tc: 10, dead: true, corr: true, seed: 1 } },
      { title: '4 · A source that is too hot',
        body: 'A strong P-32 source close to the tube, with the dead-time correction switched off.',
        ask: 'The fitted half-life comes out 20.6 days. The real one is 14.3. What went wrong?',
        reveal: '<b>The dead time.</b> At 8000 arrivals per second the tube is blind 62% of the time, and it misses a larger share of the early counts than the late ones. The log plot is flattened. Correct with n = m/(1 − mτ) and the half-life returns.',
        params: { mode: 'decay', iso: 'P32', A0: 200, dcm: 3, absb: 'none', bg: 0.5, tc: 10, dead: true, corr: false, seed: 1 } },
      { title: '5 · The technetium cow',
        body: 'Mo-99 decays to Tc-99m. Watch the cyan atoms build up.',
        ask: 'Does the daughter\'s activity ever exceed the parent\'s?',
        reveal: '<b>Yes, by 10%.</b> In transient equilibrium A_B/A_A → λ_B/(λ_B − λ_A) = 1.100. Both then fall together with the PARENT\'s half-life.',
        params: { mode: 'chain', chain: 'MoTc', milk: false, seed: 1 } },
      { title: '6 · Radium and radon',
        body: 'A gram of radium, and the radon it makes.',
        ask: 'After a month, how does the radon activity compare with the radium activity?',
        reveal: '<b>Equal: that is secular equilibrium.</b> A long-lived parent makes daughter atoms as fast as they decay, so λ_A N_A = λ_B N_B. One gram of radium holds only 6.4 µg of radon, at 1 curie each.',
        params: { mode: 'chain', chain: 'RaRn', milk: false, seed: 1 } },
      { title: '7 · Where fusion and fission come from',
        body: 'The binding curve from measured masses, with the liquid drop dashed over it.',
        ask: 'Why do both splitting uranium and joining hydrogen release energy?',
        reveal: '<b>Both move toward the summit near iron.</b> Fragments of uranium sit about 0.8 MeV per nucleon higher than uranium. He-4 sits 5 MeV per nucleon above deuterium. Energy is released whenever nucleons end up more tightly bound.',
        params: { mode: 'bind', bsub: 'fission' } },
      { title: '8 · Alpha decay: who takes the energy',
        body: 'U-238 splits into Th-234 and an alpha particle.',
        ask: 'Q is 4.27 MeV. Does the alpha get half of it?',
        reveal: '<b>No: 98.3% of it.</b> Equal and opposite momenta mean K ∝ 1/m, so K_α = Q(A − 4)/A = 4.198 MeV and the thorium recoils with 72 keV.',
        params: { mode: 'bind', bsub: 'alpha', aiso: 'alpha' } },
      { title: '9 · Going critical',
        body: 'A bare sphere of U-235 at 7 cm. Then put a reflector round it, or compress it.',
        ask: 'Nothing about the uranium changes. Why does k rise?',
        reveal: '<b>Leakage falls.</b> k∞ is 2.25 in every case. What decides k is the fraction of neutrons that escape before causing a fission. A reflector sends some back; compression makes the sphere more mean free paths across.',
        params: { mode: 'crit', rcm: 7, enr: 100, dens: 1, rods: 0, refl: true, seed: 1 } }
    ],

    quiz: [
      { q: 'After two half-lives, the fraction of a radioactive sample remaining is:',
        options: ['1/4', '0', '1/2', '1/e²'], answer: 0,
        why: 'Each half-life halves what is left: ½ × ½ = ¼. It never reaches zero in a finite time, only in the statistical sense when the last nucleus goes.' },
      { q: 'The mean life of a nuclide compared with its half-life is:',
        options: ['Longer, by a factor 1/ln 2 = 1.44', 'Shorter', 'Equal', 'Twice as long'], answer: 0,
        why: 'τ = 1/λ and T½ = ln 2/λ, so τ = T½/0.693.' },
      { q: 'An alpha source 7 cm from a GM tube, in air, gives a count rate that is:',
        options: ['Only background', 'A quarter of that at 3.5 cm', 'Half of that at 3.5 cm', 'The same as at 3.5 cm'], answer: 0,
        why: 'Alphas have a range of a few cm in air (about 4–5 cm for 5–6 MeV). Beyond it, none arrive. Try it with the thoron source.' },
      { q: 'In secular equilibrium between a long-lived parent A and a short-lived daughter B:',
        options: ['The activities are equal', 'The numbers of atoms are equal', 'The daughter\'s activity is larger', 'The parent\'s activity is zero'], answer: 0,
        why: 'λ_A N_A = λ_B N_B. The numbers are in the ratio of the half-lives; the activities match.' },
      { q: 'A nucleus at rest emits an alpha particle. The alpha\'s kinetic energy compared with Q is:',
        options: ['Slightly less than Q', 'Exactly Q', 'Q/2', 'More than Q'], answer: 0,
        why: 'The daughter recoils with equal and opposite momentum and takes a share Q × 4/A. For U-238, 72 keV of 4.27 MeV.' },
      { q: 'Energy is released in both fission of uranium and fusion of hydrogen because:',
        options: ['The products have higher binding energy per nucleon', 'Mass is created', 'Neutrons are released', 'The products are lighter nuclei'], answer: 0,
        why: 'Both move toward the maximum of B/A near A ≈ 60. The mass that disappears is B(after) − B(before) divided by c².' },
      { q: 'The radius of a nucleus of mass number 216 compared with that of mass number 27 is:',
        options: ['2 times', '8 times', '3 times', '4 times'], answer: 0,
        why: 'R = R₀A^⅓: (216/27)^⅓ = 8^⅓ = 2. Nuclear density is the same in every nucleus.' },
      { q: 'A reactor is steady (k = 1). Pulling the control rods out slightly makes k = 1.001. With a generation time of 0.1 ms, the power in 1 s grows by about:',
        options: ['e¹⁰ ≈ 22 000 times — which is why delayed neutrons are essential', '0.1%', '1%', '10 times'], answer: 0,
        why: 'Power grows as k^(t/ℓ) = 1.001¹⁰⁰⁰⁰ ≈ e¹⁰. Real reactors are controllable only because 0.65% of neutrons are delayed by seconds.' }
    ],

    notes: '<b>Where this shows up in the paper.</b><ul>' +
      '<li><b>Decay law</b>: N = N₀e^(−λt), T½ = 0.693/λ, τ = 1/λ, activity A = λN; fraction left after n half-lives = 2⁻ⁿ.</li>' +
      '<li><b>Radiation</b>: α stopped by paper and a few cm of air; β by mm of aluminium; γ attenuated exponentially by lead. Counting statistics ±√N; dead time m = n/(1 + nτ).</li>' +
      '<li><b>Chains</b>: t_max = ln(λ_B/λ_A)/(λ_B − λ_A); transient equilibrium A_B/A_A = λ_B/(λ_B − λ_A); secular λ_A N_A = λ_B N_B; activation A = R(1 − e^(−λt)).</li>' +
      '<li><b>Mass and energy</b>: 1 u = 931.5 MeV/c²; B = Δm c²; Q from masses; K_α = Q(A − 4)/A; R = 1.2A^⅓ fm, constant density.</li>' +
      '<li><b>Fission and fusion</b>: about 200 MeV per fission, 17.6 MeV per D–T fusion; k = 1 critical; moderators slow neutrons; control rods absorb them.</li></ul>' +
      '<div class="pyq"><em>Trap to avoid</em> — "activity falls with the half-life of the daughter". In transient equilibrium both fall with the PARENT\'s half-life, and the daughter\'s activity is the larger.</div>' +
      '<div class="pyq"><em>Trap to avoid</em> — splitting Q equally in alpha decay. The alpha takes (A − 4)/A of it; the recoil is small but not zero.</div>'
  });

  /* =========================================================================
     22 · THERMAL PROPERTIES OF MATTER

     Four benches, each integrating the heat flow rather than quoting the
     answer:
     · A calorimeter. The ice (or steam, or hot metal) and the water are two
       bodies exchanging heat through their contact, each tracked by its
       ENTHALPY, so melting and condensing hold a body at 0 °C or 100 °C for
       exactly as long as the latent heat takes. Whether all the ice melts is
       found by running it, not by assuming.
     · Expansion: a bimetallic strip bent by Timoshenko's formula, a flask
       whose level first FALLS because the glass warms before the liquid, and
       two pendulum clocks integrated through a whole day.
     · Conduction along rods, solved implicitly node by node (the heat
       equation with lateral loss), from switch-on to steady state; ice melts
       at the cold end at the rate the heat current says.
     · Radiation: bodies cooling by εσT⁴ plus convection, and a black body's
       spectrum computed from Planck's law, its peak and its total power
       found numerically, its colour computed from the CIE eye.
     ========================================================================= */
  const SIG = 5.670374e-8, LF = 334e3, LV = 2.256e6, CW = 4186, CICE = 2100, CSTEAM = 2010;
  const MAT = {
    copper:    { name: 'copper',    K: 401, rho: 8960,  c: 385, a: 16.5e-6, E: 117e9, col: '#C9824A' },
    aluminium: { name: 'aluminium', K: 237, rho: 2700,  c: 900, a: 23.1e-6, E: 70e9,  col: '#C4CCD8' },
    brass:     { name: 'brass',     K: 109, rho: 8530,  c: 380, a: 19.0e-6, E: 100e9, col: '#D6B055' },
    iron:      { name: 'iron',      K: 80,  rho: 7870,  c: 450, a: 11.8e-6, E: 200e9, col: '#8A8F98' },
    steel:     { name: 'steel',     K: 50,  rho: 7850,  c: 490, a: 12.0e-6, E: 200e9, col: '#AAB4C0' },
    lead:      { name: 'lead',      K: 35,  rho: 11340, c: 128, a: 29.0e-6, E: 16e9,  col: '#6B7280' },
    invar:     { name: 'invar',     K: 10,  rho: 8050,  c: 515, a: 1.2e-6,  E: 141e9, col: '#9AA3B0' },
    glass:     { name: 'glass',     K: 1.0, rho: 2500,  c: 840, a: 9.0e-6,  E: 70e9,  col: '#BFE3F0' }
  };

  /* ---------------- calorimetry, by enthalpy ----------------
     h(T) per kg of H₂O, zero for ice at 0 °C: ice, then the melting step
     (L_f), water, the boiling step (L_v), steam. T(h) inverts it. */
  function hH2O(T) {
    if (T < 0) return CICE * T;
    if (T < 100) return LF + CW * T;
    return LF + CW * 100 + LV + CSTEAM * (T - 100);
  }
  function TH2O(h) {                                  // returns [T, liquid fraction or vapour fraction]
    if (h < 0) return [h / CICE, 0];
    if (h < LF) return [0, h / LF];
    const h1 = LF + CW * 100;
    if (h < h1) return [(h - LF) / CW, 1];
    if (h < h1 + LV) return [100, 1 + (h - h1) / LV];
    return [100 + (h - h1 - LV) / CSTEAM, 2];
  }
  // a lump of water (mass mw) plus a copper calorimeter (mc): total enthalpy → T, by bisection
  function lumpH(mw, mc, T) { return mw * hH2O(T) + mc * 385 * T; }
  function lumpT(mw, mc, H) {
    let a = -60, b = 140;
    for (let i = 0; i < 60; i++) { const m = (a + b) / 2; if (lumpH(mw, mc, m) < H) a = m; else b = m; }
    return (a + b) / 2;
  }
  /* equilibrium only (for the landscape plot): energy conserved, no time */
  function calEq(mw, Tw, mc, add, ma, Ta, cm) {
    const Htot = lumpH(mw, mc, Tw) + (add === 'metal' ? ma * cm * Ta : ma * hH2O(Ta));
    if (add === 'metal') {                            // water lump + metal: T with the water possibly phase-changing
      let a = -60, b = 140;
      for (let i = 0; i < 60; i++) { const m = (a + b) / 2; if (lumpH(mw, mc, m) + ma * cm * m < Htot) a = m; else b = m; }
      return (a + b) / 2;
    }
    return lumpT(mw + ma, mc, Htot);
  }
  // ice left at equilibrium: the whole H₂O sits at 0 °C with part of it still solid
  function calIceEq(mw, Tw, mc, ma, Ta) {
    const Htot = lumpH(mw, mc, Tw) + ma * hH2O(Ta), h = Htot / (mw + ma);
    return h > 0 && h < LF ? (mw + ma) * (1 - h / LF) : h <= 0 ? mw + ma : 0;
  }
  function runCal(p) {
    const mw = p.mw / 1000, mc = p.mcal / 1000, ma = p.madd / 1000, Tw0 = p.Tw, add = p.add;
    const Ta0 = add === 'ice' ? p.Tice : add === 'steam' ? 100.0001 : p.Tm;
    const cm = MAT[p.metal].c;
    let Hw = lumpH(mw, mc, Tw0);
    let Ha = add === 'metal' ? ma * cm * Ta0 : ma * hH2O(Ta0);          // steam's h already carries L_v
    const H0 = Hw + Ha, Gloss = p.lag ? 0 : 0.6, Troom = 25;
    const dt = 0.25, tEnd = 2400, out = [];
    let t = 0, Tw = Tw0, Ta = Ta0, frac = add === 'ice' ? 0 : 1, lost = 0;
    for (let i = 0; t <= tEnd; i++) {
      const mRem = add === 'ice' ? ma * (1 - clamp(frac, 0, 1)) : ma;      // solid ice still to melt sets the contact area
      const G = add === 'steam' ? (frac > 1 ? 12 : 3) : add === 'metal' ? 3.2 : 4.5 * Math.pow(Math.max(mRem, ma * 0.3) / 0.05, 2 / 3);
      const q = G * (Tw - Ta) * dt, ql = Gloss * (Troom - Tw) * dt;
      Hw += -q + ql; Ha += q; lost += ql;
      Tw = lumpT(mw, mc, Hw);
      if (add === 'metal') { Ta = Ha / (ma * cm); frac = 1; }
      else { const r = TH2O(Ha / ma); Ta = r[0]; frac = r[1]; }
      if (i % 8 === 0) out.push([t, Tw, Ta, frac]);
      t += dt;
    }
    const last = out[out.length - 1];
    const Tf = calEq(mw, Tw0, mc, add, ma, add === 'steam' ? 100 : Ta0, cm);
    const iceLeft = add === 'ice' && last[3] < 1 ? ma * (1 - clamp(last[3], 0, 1)) : 0, iceEq = add === 'ice' ? calIceEq(mw, Tw0, mc, ma, Ta0) : 0;
    // time to settle within 0.05 K of the end
    let tSet = tEnd;
    for (let i = out.length - 1; i > 0; i--) if (Math.abs(out[i][1] - last[1]) > 0.05 || Math.abs(out[i][2] - last[2]) > 0.05) { tSet = out[i][0]; break; }
    return { out, mw, mc, ma, add, Tw0, Ta0, cm, Tf: last[1], TfEq: Tf, iceLeft, iceEq, lost, H0, tEnd, tSet,
             at: tt => { const k = clamp(tt / tEnd * (out.length - 1), 0, out.length - 1), i = Math.floor(k), j = Math.min(out.length - 1, i + 1), w = k - i;
                         return out[i].map((v, c) => v * (1 - w) + out[j][c] * w); } };
  }

  /* ---------------- expansion ---------------- */
  // Timoshenko (1925): curvature of a bimetal strip heated by ΔT
  function bimetal(p) {
    const A = MAT[p.m1], B = MAT[p.m2], t1 = p.tb / 2000, t2 = p.tb / 2000, t = t1 + t2, m = t1 / t2, n = A.E / B.E;
    const k = 6 * (A.a - B.a) * p.dT * (1 + m) * (1 + m) / (t * (3 * (1 + m) * (1 + m) + (1 + m * n) * (m * m + 1 / (m * n))));
    const L = p.Lb / 100, th = k * L;                         // curvature (1/m), angle turned at the tip
    const tip = Math.abs(k) > 1e-9 ? (1 - Math.cos(th)) / k : 0;   // sideways deflection of the free end
    const simple = 1.5 * (A.a - B.a) * p.dT / t;              // the m = n = 1 textbook form
    return { A, B, k, R: 1 / k, L, th, tip, simple, t, gap: p.gap / 1000, open: tip > p.gap / 1000 };
  }
  // water density (Tilton & Taylor), and the other liquids
  const rhoW = T => 1000 * (1 - (T + 288.9414) / (508929.2 * (T + 68.12963)) * (T - 3.9863) * (T - 3.9863));
  const LIQX = {
    water:   { name: 'water', col: '#4DA8F0', V: T => rhoW(20) / rhoW(T) },
    mercury: { name: 'mercury', col: '#9AA3B0', V: T => 1 + 1.82e-4 * (T - 20) },
    ethanol: { name: 'ethanol', col: '#F2A0B8', V: T => 1 + 1.10e-3 * (T - 20) }
  };
  /* the flask in a bath: the glass (thin, fast) and the liquid (bulky, slow) each
     relax toward the bath temperature; the level in the neck is the difference
     of their volumes spread over the neck's cross-section */
  function runFlask(p) {
    const V0 = 50e-6, An = Math.PI * Math.pow(2.5e-3, 2), gG = 3 * (p.pyrex ? 3.3e-6 : 9.0e-6), Lq = LIQX[p.fliq];
    const T0 = p.T0f, Tb = p.Tb, tg = 2, tl = 90, out = [];
    const tEnd = 600;
    const lev = (Tg, Tl) => (V0 * Lq.V(Tl) / Lq.V(T0) - V0 * (1 + gG * (Tg - T0))) / An;
    let Tg = T0, Tl = T0, t = 0, minH = 0, tMin = 0, maxH = 0;
    const dt = 0.05;
    while (t <= tEnd) {
      const h = lev(Tg, Tl);
      if (h < minH) { minH = h; tMin = t; }
      if (h > maxH) maxH = h;
      if (Math.round(t / dt) % 20 === 0) out.push([t, h, Tg, Tl]);
      Tg += (Tb - Tg) / tg * dt; Tl += (Tb - Tl) / tl * dt; t += dt;
    }
    const hEnd = lev(Tb, Tb), dTb = Tb - T0;
    const gReal = (Lq.V(Tb) / Lq.V(T0) - 1) / (dTb || 1), gApp = hEnd * An / V0 / (dTb || 1);
    return { out, V0, An, gG, Lq, T0, Tb, tEnd, minH, tMin, maxH, hEnd, gReal, gApp,
             at: tt => { const k = clamp(tt / tEnd * (out.length - 1), 0, out.length - 1), i = Math.floor(k), j = Math.min(out.length - 1, i + 1), w = k - i;
                         return out[i].map((v, c) => v * (1 - w) + out[j][c] * w); } };
  }
  /* two pendulum clocks, both regulated at 20 °C, one at temperature T: each
     pendulum is integrated (the full sin θ equation, RK4) through one day of
     real time; the clock shows (swings counted) × (its calibrated half-period) */
  function runClock(p) {
    const g0 = 9.80665, L0 = g0 / (Math.PI * Math.PI);              // a seconds pendulum at 20 °C: T = 2 s
    const al = MAT[p.rod].a, L = L0 * (1 + al * (p.Tc - 20)), th0 = 3 * Math.PI / 180;
    const day = 86400;
    function swing(Lx) {
      // period by integrating one quarter swing precisely, then a day is day/period swings
      let th = th0, w = 0, t = 0; const h = 2e-4, f = (a) => -g0 / Lx * Math.sin(a);
      let prevTh = th;
      while (true) {
        const k1a = w, k1b = f(th), k2a = w + h / 2 * k1b, k2b = f(th + h / 2 * k1a), k3a = w + h / 2 * k2b, k3b = f(th + h / 2 * k2a), k4a = w + h * k3b, k4b = f(th + h * k3a);
        prevTh = th; th += h / 6 * (k1a + 2 * k2a + 2 * k3a + k4a); w += h / 6 * (k1b + 2 * k2b + 2 * k3b + k4b); t += h;
        if (th <= 0) return 4 * (t - h * th / (th - prevTh));     // interpolate the zero crossing
      }
    }
    const Tref = swing(L0), Ttest = swing(L);
    const shown = day / Ttest * Tref;                               // swings counted, each worth a reference period
    return { L0, L, Tref, Ttest, lost: day - shown, formula: 0.5 * al * (p.Tc - 20) * day, al, day };
  }

  /* ---------------- conduction along rods ----------------
     ρc ∂T/∂t = ∂/∂x(K ∂T/∂x) − β(T − T_room), implicit (backward Euler) on
     a node grid, solved by the Thomas algorithm; conductances between nodes
     are harmonic means, so a junction of two metals is exact. */
  function rodSolve(segs, Th, Tc, Tinit, beta, Troom, tEnd, nOut, fixedCold) {
    const N = 160, Ltot = segs.reduce((u, s) => u + s.L, 0), dx = Ltot / N;
    const K = [], C = [], xs = [];
    for (let i = 0; i <= N; i++) { const x = i * dx; xs.push(x); let acc = 0, s = segs[segs.length - 1]; for (const sg of segs) { if (x <= acc + sg.L + 1e-12) { s = sg; break; } acc += sg.L; } K.push(s.K); C.push(s.rho * s.c); }
    // each face takes the metal at its own midpoint, so a junction falls exactly on a node
    const segAt = x => { let acc = 0; for (const sg of segs) { if (x <= acc + sg.L + 1e-12) return sg; acc += sg.L; } return segs[segs.length - 1]; };
    const Kf = []; for (let i = 0; i < N; i++) Kf.push(segAt((i + 0.5) * dx).K);
    // a node on a junction holds half of each metal's heat capacity
    for (let i = 0; i <= N; i++) { const l = segAt(Math.max(0, (i - 0.5) * dx)), r = segAt(Math.min(Ltot, (i + 0.5) * dx)); C[i] = (l.rho * l.c + r.rho * r.c) / 2; }
    let T = xs.map(() => Tinit); T[0] = Th; if (fixedCold) T[N] = Tc;
    const dt = tEnd / 3000, snaps = [], flux = [];
    const a = new Float64Array(N + 1), b = new Float64Array(N + 1), c = new Float64Array(N + 1), d = new Float64Array(N + 1);
    for (let s = 0; s <= 3000; s++) {
      if (s % Math.round(3000 / nOut) === 0) {
        const qh = Kf[0] * (T[0] - T[1]) / dx, qc = fixedCold ? Kf[N - 1] * (T[N - 1] - T[N]) / dx : 0;
        snaps.push({ t: s * dt, T: T.slice() }); flux.push([s * dt, qh, qc]);
      }
      if (s === 3000) break;
      for (let i = 0; i <= N; i++) {
        if (i === 0 || (i === N && fixedCold)) { a[i] = 0; b[i] = 1; c[i] = 0; d[i] = i === 0 ? Th : Tc; continue; }
        const kl = Kf[i - 1] / (dx * dx), kr = i < N ? Kf[i] / (dx * dx) : 0, cap = C[i] / dt;
        if (i === N) { a[i] = -2 * kl; b[i] = cap + 2 * kl + beta; c[i] = 0; }         // insulated free end
        else { a[i] = -kl; b[i] = cap + kl + kr + beta; c[i] = -kr; }
        d[i] = cap * T[i] + beta * Troom;
      }
      for (let i = 1; i <= N; i++) { const w = a[i] / b[i - 1]; b[i] -= w * c[i - 1]; d[i] -= w * d[i - 1]; }
      T[N] = d[N] / b[N];
      for (let i = N - 1; i >= 0; i--) T[i] = (d[i] - c[i] * T[i + 1]) / b[i];
    }
    return { xs, snaps, flux, dx, Kf, N };
  }
  const RODA = Math.PI * 0.01 * 0.01;                 // rods of 2 cm diameter
  function runCond(p) {
    const A = MAT[p.r1], B = MAT[p.r2], L1 = p.L1 / 100, L2 = p.L2 / 100;
    const tEnd = p.csub === 'ingen' ? 2400 : 14400;
    if (p.csub === 'series') {
      const R = rodSolve([{ L: L1, K: A.K, rho: A.rho, c: A.c }, { L: L2, K: B.K, rho: B.rho, c: B.c }], 100, 0, 20, 0, 20, tEnd, 120, true);
      const last = R.snaps[R.snaps.length - 1], ij = Math.round(L1 / R.dx);
      const Tj = last.T[ij], H = R.flux[R.flux.length - 1][2] * RODA;
      const Rth = L1 / (A.K * RODA) + L2 / (B.K * RODA), Hf = 100 / Rth, Tjf = 100 - Hf * L1 / (A.K * RODA);
      return { kind: 'series', rods: [R], A, B, L1, L2, Tj, H, Hf, Tjf, melt: H / LF * 60e3, meltF: Hf / LF * 60e3, tEnd, ij };
    }
    if (p.csub === 'parallel') {
      const R1 = rodSolve([{ L: L1, K: A.K, rho: A.rho, c: A.c }], 100, 0, 20, 0, 20, tEnd, 120, true);
      const R2 = rodSolve([{ L: L1, K: B.K, rho: B.rho, c: B.c }], 100, 0, 20, 0, 20, tEnd, 120, true);
      const H = (R1.flux[R1.flux.length - 1][2] + R2.flux[R2.flux.length - 1][2]) * RODA, Hf = 100 * RODA * (A.K + B.K) / L1;
      return { kind: 'parallel', rods: [R1, R2], A, B, L1, H, Hf, melt: H / LF * 60e3, meltF: Hf / LF * 60e3, tEnd };
    }
    // Ingen-Hausz: three rods, same size, wax-coated, one end in boiling water, losing heat from their sides
    const h = 12, P = Math.PI * 0.005, Ar = Math.PI * 0.0025 * 0.0025, beta = h * P / Ar, Lr = 0.60, Twax = 55;
    const mats = [p.r1, p.r2, p.r3].map(k => MAT[k]);
    const rods = mats.map(M => rodSolve([{ L: Lr, K: M.K, rho: M.rho, c: M.c }], 100, 20, 20, beta, 20, tEnd, 120, false));
    const melted = (R, sn) => { for (let i = 1; i <= R.N; i++) if (sn.T[i] < Twax) return R.xs[i - 1] + (sn.T[i - 1] - Twax) / (sn.T[i - 1] - sn.T[i]) * R.dx; return R.xs[R.N]; };
    const lens = rods.map(R => melted(R, R.snaps[R.snaps.length - 1]));
    const mfin = mats.map(M => Math.sqrt(beta / M.K));
    const lensF = mfin.map(m => { // steady fin with insulated tip: T − 20 = 80 cosh(m(L−x))/cosh(mL) = 35
      let a = 0, b = Lr; for (let i = 0; i < 60; i++) { const x = (a + b) / 2, T = 20 + 80 * Math.cosh(m * (Lr - x)) / Math.cosh(m * Lr); if (T > Twax) a = x; else b = x; } return (a + b) / 2; });
    return { kind: 'ingen', rods, mats, lens, lensF, melted, Twax, beta, Lr, tEnd };
  }

  /* ---------------- radiation ---------------- */
  const HC = 6.62607015e-34 * 2.99792458e8, KB = 1.380649e-23;
  const planck = (lam, T) => 2 * HC * 2.99792458e8 / Math.pow(lam, 5) / (Math.exp(HC / (lam * KB * T)) - 1);   // W m⁻² sr⁻¹ m⁻¹
  // the CIE 1931 observer as the multi-lobe fit of Wyman, Sloan & Shirley (2013)
  const g3 = (x, m, s1, s2) => { const t = (x - m) / (x < m ? s1 : s2); return Math.exp(-0.5 * t * t); };
  const cieX = l => 1.056 * g3(l, 599.8, 37.9, 31.0) + 0.362 * g3(l, 442.0, 16.0, 26.7) - 0.065 * g3(l, 501.1, 20.4, 26.2);
  const cieY = l => 0.821 * g3(l, 568.8, 46.9, 40.5) + 0.286 * g3(l, 530.9, 16.3, 31.1);
  const cieZ = l => 1.217 * g3(l, 437.0, 11.8, 36.0) + 0.681 * g3(l, 459.0, 26.0, 13.8);
  function bbColour(T) {
    let X = 0, Y = 0, Z = 0;
    for (let l = 380; l <= 780; l += 5) { const B = planck(l * 1e-9, T); X += B * cieX(l); Y += B * cieY(l); Z += B * cieZ(l); }
    let r = 3.2406 * X - 1.5372 * Y - 0.4986 * Z, g = -0.9689 * X + 1.8758 * Y + 0.0415 * Z, b = 0.0557 * X - 0.2040 * Y + 1.0570 * Z;
    const mx = Math.max(r, g, b); r = Math.max(0, r / mx); g = Math.max(0, g / mx); b = Math.max(0, b / mx);
    const gam = v => v <= 0.0031308 ? 12.92 * v : 1.055 * Math.pow(v, 1 / 2.4) - 0.055;
    const h2 = v => ('0' + Math.round(clamp(gam(v), 0, 1) * 255).toString(16)).slice(-2);
    return '#' + h2(r) + h2(g) + h2(b);
  }
  function runSpec(p) {
    const T = p.Tbb, pts = [];
    // the spectrum on a log grid wide enough for any T here; peak and total found numerically
    let best = 0, iB = 0; const lams = [];
    for (let i = 0; i <= 1200; i++) { const lam = 50e-9 * Math.pow(2000, i / 1200); lams.push(lam); const B = planck(lam, T); pts.push(B); if (B > best) { best = B; iB = i; } }
    const y0 = pts[iB - 1], y1 = pts[iB], y2 = pts[iB + 1], x0 = Math.log(lams[iB - 1]), x1 = Math.log(lams[iB]), x2 = Math.log(lams[iB + 1]);
    const den = y0 - 2 * y1 + y2, xm = x1 + 0.5 * (y0 - y2) / den * (x1 - x0);
    const lmax = Math.exp(xm);
    let P = 0;                                                   // Simpson in ln λ: ∫B dλ = ∫B λ d(ln λ)
    const du = Math.log(2000) / 1200;
    for (let i = 0; i <= 1200; i++) P += (i === 0 || i === 1200 ? 1 : i % 2 ? 4 : 2) * pts[i] * lams[i];
    P *= du / 3 * Math.PI;                                       // × π sr: exitance
    let vis = 0; for (let i = 0; i < 1200; i++) if (lams[i] >= 380e-9 && lams[i] <= 750e-9) vis += pts[i] * lams[i] * du * Math.PI;
    return { T, lams, pts, lmax, b: lmax * T, P, sigma: P / Math.pow(T, 4), vis: vis / P, col: bbColour(T), peak: best };
  }
  function runCool(p) {
    // two identical copper spheres, one blackened (ε 0.95), one polished (ε 0.05), in a room at T_env
    const r = p.rs / 100, A = 4 * Math.PI * r * r, m = MAT.copper.rho * 4 / 3 * Math.PI * r * r * r, c = MAT.copper.c;
    const Te = p.Tenv + 273.15, h = p.conv ? 6 : 0, tEnd = 5400, out = [];
    let T1 = p.T0c + 273.15, T2 = T1;
    const rate = (T, e) => -(e * SIG * A * (Math.pow(T, 4) - Math.pow(Te, 4)) + h * A * (T - Te)) / (m * c);
    const dt = 1;
    for (let t = 0; t <= tEnd; t += dt) {
      if (t % 10 === 0) out.push([t, T1 - 273.15, T2 - 273.15]);
      const f = (T, e) => { const k1 = rate(T, e), k2 = rate(T + dt / 2 * k1, e), k3 = rate(T + dt / 2 * k2, e), k4 = rate(T + dt * k3, e); return T + dt / 6 * (k1 + 2 * k2 + 2 * k3 + k4); };
      T1 = f(T1, 0.95); T2 = f(T2, 0.05);
    }
    // measured cooling times between the classic marks, for the black sphere
    const cross = (col, v) => { for (let i = 1; i < out.length; i++) if (out[i - 1][col] > v && out[i][col] <= v) return out[i - 1][0] + (out[i - 1][col] - v) / (out[i - 1][col] - out[i][col]) * 10; return NaN; };
    const t80 = cross(1, 80), t70 = cross(1, 70), t60 = cross(1, 60), q80 = cross(2, 80), q70 = cross(2, 70), q60 = cross(2, 60);
    return { out, A, m, c, r, Te: p.Tenv, tEnd, t1: t70 - t80, t2: t60 - t70, t1p: q70 - q80, t2p: q60 - q70, cross,
             at: tt => { const k = clamp(tt / tEnd * (out.length - 1), 0, out.length - 1), i = Math.floor(k), j = Math.min(out.length - 1, i + 1), w = k - i;
                         return out[i].map((v, cc) => v * (1 - w) + out[j][cc] * w); } };
  }

  /* a heat colour map: ice blue → green → amber → red, for any range */
  const TSTOP = ['#2B4CFF', '#29C4F5', '#8FE36A', '#FFD34A', '#FF7A2B', '#E0283F'];
  function tcol(T, lo, hi) {
    const f = clamp((T - lo) / (hi - lo), 0, 1) * (TSTOP.length - 1), i = Math.min(TSTOP.length - 2, Math.floor(f));
    return RX.mix(TSTOP[i], TSTOP[i + 1], f - i);
  }
  const KT = 0.1;                                    // scene units per cm, for the thermal benches

  /* ======================= the calorimeter ======================= */
  function drawCal(S, g) {
    const ctx = g.ctx, th = g.theme, p = S.p, W = g.w, H = g.h, cam = S.cam, Ca = S.Ca;
    const narrow = W < 660, B = window.BENCH;
    const F = R3.Frame(ctx, cam, { ambient: 0.32, floorZ: 0 });
    const m = (x, y, z) => [x * KT, y * KT, z * KT];
    const tp = clamp(S.ts / 20, 0, 1) * Ca.tEnd, st = Ca.at(tp), Tw = st[1], Ta = st[2], fr = st[3];
    B.table(F, m(-26, 0, 0)[0], m(24, 0, 0)[0], m(0, -13, 0)[1], m(0, 13, 0)[1], 0, { legs: false, tone: '#6E4A2C', seed: 45, thick: 0.06 });
    // the jacket (felt-lined, open) and the copper cup inside it
    R3.cylinder(F, m(0, 0, 0), m(0, 0, 1.2), 7.6 * KT, '#3A3230', { segments: 34, shadow: false });
    glassCyl(F, m(0, 0, 1.2), 7.2 * KT, 11 * KT, { tint: 'rgba(120,110,100,.10)', bias: 0.3 });
    const hw = 4.2 + Ca.mw * 1000 / 200 * 2.4;       // water depth grows with the mass of water
    liquidCyl(F, m(0, 0, 1.6), 5.0 * KT, hw * KT, RX.mix('#4DA8F0', tcol(Tw, 0, 100), 0.25), { alpha: 0.55 });
    glassCyl(F, m(0, 0, 1.6), 5.15 * KT, 9 * KT, { tint: 'rgba(201,130,74,.22)', bias: -0.05 });
    const rim = [];
    for (let k = 0; k <= 36; k++) { const a = k / 36 * TAU; rim.push(m(5.15 * Math.cos(a), 5.15 * Math.sin(a), 10.6)); }
    path3(F, rim, '#D89A5E', { alpha: 0.95, width: 2.6, chunk: 4 });
    const zs = 1.6 + hw;
    // what was added
    if (Ca.add === 'ice') {
      const mRem = Ca.ma * (1 - clamp(fr, 0, 1));
      if (mRem > 1e-5) {
        const side = Math.cbrt(mRem / 3 / 917) * 100;                  // three cubes, cm
        [[-1.6, -1.2], [1.4, -0.4], [0.2, 1.8]].forEach((q, i) => R3.box(F, m(q[0], q[1], zs - side * 0.4 + 0.05 * i), [side * KT, side * KT, side * KT], '#DDF2FF', { shadow: false, ambient: 0.6, axes: [[Math.cos(i), Math.sin(i), 0], [-Math.sin(i), Math.cos(i), 0], [0, 0, 1]] }));
      }
    } else if (Ca.add === 'steam') {
      // the boiler on its tripod, and the delivery tube into the water
      const bx = -17;
      liquidCyl(F, m(bx, 0, 6), 3.4 * KT, 3 * KT, '#4DA8F0', { alpha: 0.5 });
      glassCyl(F, m(bx, 0, 6), 3.6 * KT, 7 * KT);
      [[-1, -1], [1, -1], [0, 1.2]].forEach(q => R3.cylinder(F, m(bx + q[0] * 2.8, q[1] * 2.6, 0), m(bx + q[0] * 2.5, q[1] * 2.3, 6), 0.18 * KT, '#6B7486', { segments: 8, shadow: false }));
      const flame = Math.sin(S.ts * 11) * 0.3;
      F.push(m(bx, 0, 3), () => { const q = cam.project(m(bx, 0, 3.4)); if (!q.ok) return; const r = 12 + flame * 4;
        const gr = ctx.createRadialGradient(q.x, q.y + 4, 0, q.x, q.y, r * 1.6); gr.addColorStop(0, 'rgba(160,210,255,.95)'); gr.addColorStop(0.5, 'rgba(90,130,255,.5)'); gr.addColorStop(1, 'rgba(60,90,255,0)');
        ctx.fillStyle = gr; ctx.beginPath(); ctx.ellipse(q.x, q.y, r * 0.6, r * 1.5, 0, 0, TAU); ctx.fill(); }, 0);
      const tube = [m(bx, 0, 13), m(bx, 0, 16), m(-6, 0, 16), m(-1.5, 0, 14), m(-1.5, 0, 3.2)];
      R3.tube(F, tube, 0.35 * KT, '#CFE3F2', { segments: 8 });
      if (fr > 1.001 || tp < Ca.tSet) {                                  // bubbles while steam still condenses
        const bl = [], sp = sprite('#EAF6FF', { glow: true });
        for (let i = 0; i < 14; i++) { const f = ((S.ts * 0.8 + i / 14) % 1); bl.push([m(-1.5, 0, 0)[0] + Math.sin(i * 2.3) * 0.08, Math.cos(i * 1.7) * 0.08, m(0, 0, 3.4 + f * (hw - 2))[2], 0.012 + 0.01 * (1 - f), sp]); }
        ballCloud(F, bl, m(-1.5, 0, 5), -0.01);
      }
      R3.label(F, m(bx, 0, 18), 'boiler · steam at 100 °C', '#DCE3EE', { size: 9 });
    } else {
      const M = MAT[p.metal], hb = Math.cbrt(Ca.ma / M.rho) * 100;          // a cylinder of the metal, h = d
      const z0 = 2.4;
      R3.cylinder(F, m(1.2, 0, z0), m(1.2, 0, z0 + hb), hb / 2 * KT, RX.mix(M.col, tcol(Ta, 0, 100), 0.3), { segments: 22, shadow: false });
      B.string(F, [m(1.2, 0, z0 + hb), m(1.2, 0, 16)], { r: 0.0025 });
      R3.label(F, m(1.2, 0, 16.6), Ca.ma * 1000 + ' g of ' + M.name, '#DCE3EE', { size: 9 });
    }
    // stirrer (bobbing), thermometer probe, lid
    const bob = Math.sin(S.ts * 3) * 1.2;
    R3.cylinder(F, m(2.8, 1.6, 2.5 + bob), m(2.8, 1.6, 14 + bob), 0.15 * KT, '#C8D0DC', { segments: 8, shadow: false });
    R3.cylinder(F, m(2.8, 1.6, 2.5 + bob), m(2.8, 1.6, 2.7 + bob), 1.6 * KT, '#B8C2D0', { segments: 16, shadow: false });
    R3.cylinder(F, m(-2.6, 2.2, 2.2), m(-2.6, 2.2, 15), 0.3 * KT, '#9AA6B8', { segments: 10, shadow: false });
    // the data logger: both temperatures
    const lg = [15, -2, 3.5];
    R3.box(F, m(lg[0], lg[1], lg[2]), [11 * KT, 6 * KT, 7 * KT], '#2B3344', { shadow: false });
    B.meter(F, m(lg[0], lg[1] - 3.7, 5.0), [0, -1, 0], 8.6 * KT, 2.4 * KT, { title: 'WATER', value: Tw.toFixed(2), unit: '°C', colour: '#7FD0FF' });
    B.meter(F, m(lg[0], lg[1] - 3.7, 2.2), [0, -1, 0], 8.6 * KT, 2.4 * KT, { title: Ca.add === 'ice' ? 'ICE' : Ca.add === 'steam' ? 'STEAM/CONDENSATE' : 'METAL', value: Ta.toFixed(2), unit: '°C', colour: '#F5B451' });
    const probe = [m(-2.6, 2.2, 15), m(-2.6, 2.2, 18), m(6, 3, 17), m(lg[0] - 5.5, lg[1] + 1, 6)];
    R3.tube(F, probe, 0.15 * KT, '#1E232D', { segments: 6 });
    F.render();
    const what = Ca.add === 'ice' ? (Ca.ma * 1000).toFixed(0) + ' g of ice at ' + Ca.Ta0.toFixed(1) + ' °C'
      : Ca.add === 'steam' ? (Ca.ma * 1000).toFixed(0) + ' g of steam at 100 °C' : (Ca.ma * 1000).toFixed(0) + ' g of ' + MAT[p.metal].name + ' at ' + Ca.Ta0.toFixed(0) + ' °C';
    const phase = Ca.add === 'ice' ? (fr < 1e-6 ? 'solid, warming' : fr < 1 ? 'melting at 0 °C · ' + ((1 - fr) * Ca.ma * 1000).toFixed(1) + ' g still solid' : 'all melted')
      : Ca.add === 'steam' ? (fr > 1.0001 ? 'condensing at 100 °C' : 'condensed, cooling') : '';
    header(g, what + ' into ' + (Ca.mw * 1000).toFixed(0) + ' g of water at ' + Ca.Tw0.toFixed(1) + ' °C',
      't = ' + tfmt(tp) + (phase ? ' · ' + phase : '') + ' · copper cup ' + (Ca.mc * 1000).toFixed(0) + ' g' + (p.lag ? ' · perfectly lagged' : ' · losing heat to a 25 °C room'),
      'each body tracked by its enthalpy: melting and condensing hold it at 0 °C or 100 °C until the latent heat is paid', th.text);
    const rows = narrow ? 4 : 6, bw = narrow ? W - 24 : 300, bh = 26 + rows * 15 + 10;
    const row = gPanel(g, 12, H - bh - 30, bw, bh, 'WHERE THE HEAT WENT');
    row(0, 'final temperature (integrated)', Ca.Tf.toFixed(2) + ' °C', th.phys);
    row(1, 'energy balance, no time', (Math.abs(Ca.TfEq) < 0.005 ? 0 : Ca.TfEq).toFixed(2) + ' °C', th.ok);
    row(2, Ca.add === 'ice' ? 'ice left at the end' : 'settled within 0.05 K after', Ca.add === 'ice' ? (Ca.iceLeft * 1000).toFixed(1) + ' g (balance: ' + (Ca.iceEq * 1000).toFixed(1) + ' g)' : tfmt(Ca.tSet));
    row(3, 'heat lost to the room', (Ca.lost / 1000).toFixed(2) + ' kJ');
    if (!narrow) {
      row(4, 'heat capacity: water + cup', (Ca.mw * CW + Ca.mc * 385).toFixed(0) + ' J/K');
      row(5, 'latent heats', 'L_f 334 kJ/kg · L_v 2256 kJ/kg');
    }
  }

  /* ======================= expansion ======================= */
  function drawExpand(S, g) {
    const ctx = g.ctx, th = g.theme, p = S.p, W = g.w, H = g.h, cam = S.cam;
    const narrow = W < 660, B = window.BENCH;
    const F = R3.Frame(ctx, cam, { ambient: 0.32, floorZ: 0 });
    const m = (x, y, z) => [x * KT, y * KT, z * KT];
    B.table(F, m(-20, 0, 0)[0], m(22, 0, 0)[0], m(0, -12, 0)[1], m(0, 12, 0)[1], 0, { legs: false, tone: '#6E4A2C', seed: 52, thick: 0.06 });
    const rows = narrow ? 4 : 6, bw = narrow ? W - 24 : 300, bh = 26 + rows * 15 + 10;
    if (p.esub === 'bimetal') {
      const Bm = S.Bm, ramp = clamp(S.ts / 4, 0, 1), k = Bm.k * ramp, L = Bm.L * 100, zc = 9;
      // clamp block on a pillar
      R3.box(F, m(-12, 0, zc / 2), [3 * KT, 3 * KT, zc * KT], '#3A4152', { shadow: false });
      R3.box(F, m(-10.5, 0, zc), [3 * KT, 3.2 * KT, 2.2 * KT], '#5A6478', { shadow: false });
      // the strip: two layers along an arc of curvature k (thickness drawn ×4)
      const n = 30, tk = Bm.t * 100 * 4, w = 1.6;
      const cen = s => { const kk = -k / 100;   // the larger-α layer (A, on top) goes to the outside: it bends DOWN, toward B
      if (Math.abs(kk) < 1e-9) return [s, 0]; return [Math.sin(kk * s) / kk, (1 - Math.cos(kk * s)) / kk]; };
      const nrm = s => { const kk = -k / 100; return [-Math.sin(kk * s), Math.cos(kk * s)]; };
      [[Bm.A, 0.5], [Bm.B, -0.5]].forEach(([M, side]) => {
        for (let i = 0; i < n; i++) {
          const s0 = L * i / n, s1 = L * (i + 1) / n, sm = (s0 + s1) / 2, c = cen(sm), nn = nrm(sm), off = side * tk / 2;
          const x = -9.5 + c[0] + nn[0] * off, z = zc + c[1] + nn[1] * off, ang = Math.atan2(nn[1], nn[0]) - Math.PI / 2;
          R3.box(F, m(x, 0, z), [(s1 - s0) * 1.02 * KT, w * KT, tk / 2 * KT], M.col, { shadow: false, ambient: 0.5,
            axes: [[Math.cos(ang), 0, Math.sin(ang)], [0, 1, 0], [-Math.sin(ang), 0, Math.cos(ang)]] });
        }
      });
      const tipC = cen(L), tipX = -9.5 + tipC[0], tipZ = zc + tipC[1];
      // the contact screw, on the side the strip bends toward when heated
      const sgn = Bm.k >= 0 ? -1 : 1, cz = zc + sgn * (Bm.gap * 100 + tk / 2 + 0.05);
      R3.cylinder(F, m(-9.5 + L - 0.3, 0, cz + sgn * 0.02), m(-9.5 + L - 0.3, 0, cz + sgn * 4), 0.35 * KT, '#D6B055', { segments: 12, shadow: false });
      R3.box(F, m(-9.5 + L - 0.3, 0, cz + sgn * 4.6), [1.6 * KT, 1.6 * KT, 1.2 * KT], '#3A4152', { shadow: false });
      const touching = sgn * (tipZ - zc) >= Bm.gap * 100 * 0.999 && ramp >= 1 && Bm.open;
      // the lamp in the alarm circuit
      R3.sphere(F, m(14, 0, 8), 1.4 * KT, touching ? '#FFE27A' : '#5A5E68', { shadow: false, vivid: touching });
      if (touching) F.push(m(14, 0, 8), () => { const q = cam.project(m(14, 0, 8)); if (!q.ok) return; const gr = ctx.createRadialGradient(q.x, q.y, 0, q.x, q.y, 60); gr.addColorStop(0, 'rgba(255,230,140,.6)'); gr.addColorStop(1, 'rgba(255,230,140,0)'); ctx.fillStyle = gr; ctx.beginPath(); ctx.arc(q.x, q.y, 60, 0, TAU); ctx.fill(); }, 1);
      R3.cylinder(F, m(14, 0, 0), m(14, 0, 6.6), 0.4 * KT, '#3A4152', { segments: 10, shadow: false });
      path3(F, [m(-10.5, 0, zc - 1.2), m(-10.5, 0, 0.3), m(14, 0, 0.3)], '#C85A3A', { alpha: 0.9, width: 1.6, chunk: 1 });
      path3(F, [m(-9.8 + L, 0, cz + sgn * 5), m(-9.8 + L, 0, 16), m(14, 0, 16), m(14, 0, 9.4)], '#C85A3A', { alpha: 0.9, width: 1.6, chunk: 1 });
      // heat: a flame under it, or frost
      if (p.dT > 0) F.push(m(-2, 0, 3), () => { const q = cam.project(m(-3, 0, 4.5)); if (!q.ok) return; const r = 10 + 10 * ramp * Math.min(1, p.dT / 200) + Math.sin(S.ts * 13) * 2;
        const gr = ctx.createRadialGradient(q.x, q.y + 6, 0, q.x, q.y, r * 1.7); gr.addColorStop(0, 'rgba(255,240,170,.95)'); gr.addColorStop(0.5, 'rgba(255,140,40,.6)'); gr.addColorStop(1, 'rgba(255,90,20,0)');
        ctx.fillStyle = gr; ctx.beginPath(); ctx.ellipse(q.x, q.y, r * 0.55, r * 1.6, 0, 0, TAU); ctx.fill(); }, 0);
      R3.cylinder(F, m(-3, 0, 0), m(-3, 0, 2.8), 0.9 * KT, '#6B7486', { segments: 14, shadow: false });
      R3.label(F, m(-9.5 + L * 0.45, 0, zc + 3.4), Bm.A.name + ' (top) · ' + Bm.B.name + ' (bottom) · thickness ×4', '#DCE3EE', { size: 9 });
      R3.callout(F, m(tipX, 0, tipZ), 40, -26, 'tip moves ' + (Bm.tip * 1000 * ramp).toFixed(2) + ' mm', '#7CF0B0', { size: 9.5 });
      F.render();
      header(g, 'A bimetallic strip: ' + Bm.A.name + ' on ' + Bm.B.name + ', ' + (p.dT >= 0 ? 'heated' : 'cooled') + ' by ' + Math.abs(p.dT).toFixed(0) + ' K',
        'Δα = ' + ((Bm.A.a - Bm.B.a) * 1e6).toFixed(1) + ' × 10⁻⁶ /K · ' + p.tb.toFixed(2) + ' mm thick · ' + p.Lb.toFixed(0) + ' cm long · curvature from Timoshenko\'s formula (both moduli)',
        'the metal that expands more ends up on the OUTSIDE of the curve · ' + (touching ? 'contact closed: the lamp is lit' : 'contact open (gap ' + p.gap.toFixed(1) + ' mm)'), th.text);
      const row = gPanel(g, 12, H - bh - 30, bw, bh, 'THE BEND');
      row(0, 'radius of curvature', Math.abs(Bm.R) > 1e3 ? '∞' : Math.abs(Bm.R * 100).toFixed(2) + ' cm', th.phys);
      row(1, 'tip deflection', (Bm.tip * 1000).toFixed(3) + ' mm', th.ok);
      row(2, 'textbook form 3ΔαΔT/2t', Math.abs(Bm.simple) > 1e-9 ? Math.abs(100 / Bm.simple).toFixed(2) + ' cm' : '∞');
      row(3, 'bends toward', Math.abs(Bm.k) < 1e-9 ? '—' : (Bm.k > 0 ? Bm.B.name : Bm.A.name) + ' side');
      if (!narrow) { row(4, 'angle turned at the tip', (Bm.th * 180 / Math.PI).toFixed(2) + '°'); row(5, 'ΔT to close the contact', Bm.tip > 0 ? (p.dT * Bm.gap / Bm.tip).toFixed(1) + ' K' : '—'); }
      return;
    }
    if (p.esub === 'flask') {
      const Fk = S.Fk, tp = clamp(S.ts / 18, 0, 1) * Fk.tEnd, st = Fk.at(tp), hmm = st[1] * 1000;
      // the bath
      const bc = tcol(p.Tb, 0, 100);
      liquidCyl(F, m(0, 0, 0.3), 9.5 * KT, 8 * KT, RX.mix('#4DA8F0', bc, 0.35), { alpha: 0.45 });
      glassCyl(F, m(0, 0, 0.3), 10 * KT, 11 * KT);
      // the flask: a bulb and a long graduated neck (drawn by hand as a sphere + tube)
      const Lq = Fk.Lq;
      F.push(m(0, 0, 5), () => {
        const q = cam.project(m(0, 0, 5)); if (!q.ok) return; const r = 4.6 * KT * q.s;
        const gr = ctx.createRadialGradient(q.x - r * 0.3, q.y - r * 0.35, r * 0.1, q.x, q.y, r);
        gr.addColorStop(0, RX.rgba(RX.mix(Lq.col, '#FFFFFF', 0.4), 0.8)); gr.addColorStop(1, RX.rgba(RX.mix(Lq.col, '#05080F', 0.3), 0.85));
        ctx.fillStyle = gr; ctx.beginPath(); ctx.arc(q.x, q.y, r, 0, TAU); ctx.fill();
        ctx.strokeStyle = 'rgba(220,240,255,.7)'; ctx.lineWidth = 1.2; ctx.stroke();
      }, -0.01);
      const neckZ0 = 9.4, lvl0 = 16, lvl = lvl0 + hmm / 10;
      liquidCyl(F, m(0, 0, neckZ0), 0.5 * KT, (lvl - neckZ0) * KT, Lq.col, { alpha: 0.85 });
      glassCyl(F, m(0, 0, neckZ0), 0.62 * KT, 16 * KT, { bias: -0.03 });
      path3(F, [m(-1.4, 0, lvl0), m(1.4, 0, lvl0)], '#FFD36B', { alpha: 0.9, width: 1.4, dash: [3, 2], chunk: 1 });
      R3.label(F, m(-1.6, 0, lvl0), 'start mark', '#FFD36B', { size: 9, align: 'right' });
      R3.callout(F, m(0.6, 0, lvl), 44, -10, (hmm >= 0 ? '+' : '') + hmm.toFixed(2) + ' mm', hmm < 0 ? '#FF8FB0' : '#7CF0B0', { size: 10 });
      F.render();
      // an inset: the neck magnified ×20 near the mark
      const iw = narrow ? 70 : 90, ih = 170, ix = W - iw - 18, iy = 70;
      ctx.fillStyle = g.alpha('#0B1020', .9); ctx.strokeStyle = g.alpha(th.line, 1); ctx.beginPath(); ctx.roundRect(ix - 8, iy - 18, iw + 16, ih + 30, 8); ctx.fill(); ctx.stroke();
      PA.lbl(ctx, ix, iy - 7, 'NECK ×20', th['text-3'], 'left', 8);
      const yMark = iy + ih * 0.55, pxmm = 12, yl = clamp(yMark - hmm * pxmm, iy, iy + ih);
      ctx.fillStyle = RX.rgba(Lq.col, 0.8); ctx.fillRect(ix + iw * 0.3, yl, iw * 0.4, iy + ih - yl);
      ctx.strokeStyle = 'rgba(220,240,255,.7)'; ctx.strokeRect(ix + iw * 0.3, iy, iw * 0.4, ih);
      ctx.strokeStyle = '#FFD36B'; ctx.setLineDash([3, 2]); ctx.beginPath(); ctx.moveTo(ix, yMark); ctx.lineTo(ix + iw, yMark); ctx.stroke(); ctx.setLineDash([]);
      for (let k = -6; k <= 6; k++) { const y = yMark - k * pxmm; if (y < iy || y > iy + ih) continue; ctx.strokeStyle = g.alpha(th['text-3'], .7); ctx.beginPath(); ctx.moveTo(ix + iw * 0.7, y); ctx.lineTo(ix + iw * (k % 5 ? 0.8 : 0.9), y); ctx.stroke(); }
      PA.lbl(ctx, ix + iw * 0.92, yMark - 5 * pxmm, '+5 mm', th['text-3'], 'left', 8);
      header(g, Lq.name + ' in a ' + (p.pyrex ? 'Pyrex' : 'soda-glass') + ' flask, dropped into a bath at ' + p.Tb.toFixed(0) + ' °C',
        't = ' + tfmt(tp) + ' · glass ' + st[2].toFixed(1) + ' °C · liquid ' + st[3].toFixed(1) + ' °C · 50 cm³ bulb, 5 mm neck',
        'the thin glass warms in seconds, the liquid in minutes: the level first FALLS, then rises', th.text);
      const row = gPanel(g, 12, H - bh - 30, bw, bh, 'REAL AND APPARENT');
      row(0, 'first dip of the level', (Fk.minH * 1000).toFixed(2) + ' mm at ' + tfmt(Fk.tMin), '#FF8FB0');
      row(1, 'final rise', (Fk.hEnd * 1000).toFixed(2) + ' mm', th.phys);
      row(2, 'γ real (the liquid)', (Fk.gReal * 1e6).toFixed(1) + ' × 10⁻⁶ /K');
      row(3, 'γ apparent (the neck reading)', (Fk.gApp * 1e6).toFixed(1) + ' × 10⁻⁶ /K', th.ok);
      if (!narrow) { row(4, 'γ of the glass 3α', (Fk.gG * 1e6).toFixed(1) + ' × 10⁻⁶ /K'); row(5, 'γ_real − γ_glass', ((Fk.gReal - Fk.gG) * 1e6).toFixed(1) + ' × 10⁻⁶ /K'); }
      return;
    }
    // two pendulum clocks
    const Ck = S.Ck, day = clamp(S.ts / 20, 0, 1) * Ck.day;
    [[-9, 20, 'reference · 20 °C', 1], [9, p.Tc, MAT[p.rod].name + ' rod · ' + p.Tc.toFixed(0) + ' °C', Ck.Tref / Ck.Ttest]].forEach(([x, T, lab, rate]) => {
      R3.box(F, m(x, 2, 12), [11 * KT, 3 * KT, 24 * KT], '#4A3222', { shadow: false });
      R3.cylinder(F, m(x, 0.4, 19), m(x, 0.1, 19), 4.2 * KT, '#F2EEE2', { segments: 36, shadow: false });
      const shown = day * rate, hr = (shown / 3600) % 12, mn = (shown / 60) % 60, sc = shown % 60;
      [[hr / 12, 2.2, 0.35, '#1E232D'], [mn / 60, 3.3, 0.22, '#1E232D'], [sc / 60, 3.6, 0.1, '#C8243B']].forEach(([f, len, wd, col]) => {
        const a = f * TAU; R3.cylinder(F, m(x, 0.05, 19), m(x + Math.sin(a) * len, 0.05, 19 + Math.cos(a) * len), wd * KT, col, { segments: 6, shadow: false, caps: false });
      });
      const sw = Math.sin(S.ts * Math.PI * 2 / 1.6) * 0.18, pl = 10.5;
      const bob = m(x + Math.sin(sw) * pl, -0.4, 15 - Math.cos(sw) * pl);
      R3.cylinder(F, m(x, -0.4, 15), bob, 0.12 * KT, MAT[p.rod].col, { segments: 6, shadow: false });
      R3.sphere(F, bob, 1.5 * KT, '#D6B055', { shadow: false });
      R3.label(F, m(x, 0, 25.2), lab, T > 20 ? '#FFB38A' : T < 20 ? '#9FD8FF' : '#DCE3EE', { size: 9.5 });
    });
    F.render();
    header(g, 'Two pendulum clocks, one day: the warm one ' + (Ck.lost >= 0 ? 'loses' : 'gains') + ' ' + Math.abs(Ck.lost).toFixed(2) + ' s',
      'each pendulum integrated (sin θ, RK4) · reference period ' + Ck.Tref.toFixed(6) + ' s · test ' + Ck.Ttest.toFixed(6) + ' s · rod α = ' + (Ck.al * 1e6).toFixed(1) + ' × 10⁻⁶ /K',
      'a longer rod swings slower: T ∝ √L, so the loss per day is ½αΔT × 86 400 s', th.text);
    const row = gPanel(g, 12, H - bh - 30, bw, bh, 'ONE DAY, COUNTED');
    row(0, 'time lost per day (counted)', Ck.lost.toFixed(3) + ' s', th.phys);
    row(1, '½ α ΔT × 86 400', Ck.formula.toFixed(3) + ' s', th.ok);
    row(2, 'rod length at 20 °C', (Ck.L0 * 100).toFixed(3) + ' cm');
    row(3, 'rod grows by', ((Ck.L - Ck.L0) * 1e6).toFixed(1) + ' µm');
    if (!narrow) { row(4, 'fractional change in period', ((Ck.Ttest / Ck.Tref - 1) * 1e6).toFixed(2) + ' ppm'); row(5, 'at 3° amplitude the period is', (Ck.Tref / 2).toFixed(5) + ' × 2 s'); }
  }

  /* ======================= conduction ======================= */
  function condNow(S) { const Cd = S.Cd, f = clamp(S.ts / 20, 0, 1), R = Cd.rods[0], k = Math.round(f * (R.snaps.length - 1)); return { k, t: R.snaps[k].t }; }
  // a rod drawn as short coloured cylinders, one per stretch of nodes, from a to b (scene points)
  function heatRod(F, a, b, r, T, lo, hi, wax, twax) {
    const n = 32, N = T.length - 1;
    for (let i = 0; i < n; i++) {
      const f0 = i / n, f1 = (i + 1) / n, Tm = T[Math.round((f0 + f1) / 2 * N)];
      const p0 = [a[0] + (b[0] - a[0]) * f0, a[1] + (b[1] - a[1]) * f0, a[2] + (b[2] - a[2]) * f0];
      const p1 = [a[0] + (b[0] - a[0]) * f1, a[1] + (b[1] - a[1]) * f1, a[2] + (b[2] - a[2]) * f1];
      R3.cylinder(F, p0, p1, r, tcol(Tm, lo, hi), { segments: 14, shadow: false, caps: i === 0 || i === n - 1, ambient: 0.5 });
      if (wax && Tm < twax) R3.cylinder(F, p0, p1, r * 1.45, '#EFE6CC', { segments: 12, shadow: false, caps: false, ambient: 0.55 });
    }
  }
  function drawCond(S, g) {
    const ctx = g.ctx, th = g.theme, p = S.p, W = g.w, H = g.h, cam = S.cam, Cd = S.Cd;
    const narrow = W < 660, B = window.BENCH;
    const F = R3.Frame(ctx, cam, { ambient: 0.32, floorZ: 0 });
    const m = (x, y, z) => [x * KT, y * KT, z * KT];
    const now = condNow(S), zr = 9;
    B.table(F, m(-40, 0, 0)[0], m(44, 0, 0)[0], m(0, -14, 0)[1], m(0, 14, 0)[1], 0, { legs: false, tone: '#6E4A2C', seed: 61, thick: 0.06 });
    const rows = narrow ? 4 : 6, bw = narrow ? W - 24 : 300, bh = 26 + rows * 15 + 10;
    if (Cd.kind === 'ingen') {
      // the hot-water trough and three wax-coated rods sticking out of it
      const Lr = Cd.Lr * 100, x0 = -24;
      liquidCyl(F, m(x0 - 6, 0, 1), 6 * KT, 12 * KT, '#E06A4A', { alpha: 0.35 });
      glassCyl(F, m(x0 - 6, 0, 1), 6.3 * KT, 14 * KT);
      R3.label(F, m(x0 - 6, 0, 16.5), 'boiling water · 100 °C', '#FFB38A', { size: 9.5 });
      Cd.rods.forEach((R, i) => {
        const y = (i - 1) * 6, sn = R.snaps[now.k];
        heatRod(F, m(x0, y, zr), m(x0 + Lr, y, zr), 0.25 * KT * 2.2, sn.T, 20, 100, true, Cd.Twax);
        const lm = Cd.melted(R, sn) * 100;
        R3.label(F, m(x0 + Lr + 3, y, zr), Cd.mats[i].name + ' · wax melted ' + lm.toFixed(1) + ' cm', tcol(60 + i * 10, 0, 100), { size: 9.5, align: 'left' });
        R3.cylinder(F, m(x0 + Lr * 0.6, y, 0), m(x0 + Lr * 0.6, y, zr - 0.6), 0.25 * KT, '#6B7486', { segments: 8, shadow: false });
      });
      B.rule(F, m(x0, -11, 0.05), [1, 0, 0], 0.6, { k: 10, width: 0.25 });
      F.render();
      header(g, 'Ingen-Hausz: three rods, one hot end, wax to show how far the heat gets',
        't = ' + tfmt(now.t) + ' · each rod 5 mm across, 60 cm long, losing heat from its sides (h = 12 W/m²K) · wax melts at 55 °C',
        'steady state: T − T₀ ∝ e^(−x√(hP/KA)), so the melted length goes as √K — NOT as the diffusivity', th.text);
      const row = gPanel(g, 12, H - bh - 30, bw, bh, 'MELTED LENGTHS');
      Cd.rods.forEach((R, i) => row(i, Cd.mats[i].name + ' (K = ' + Cd.mats[i].K + ')', (Cd.melted(R, R.snaps[now.k]) * 100).toFixed(2) + ' cm', i === 0 ? th.phys : undefined));
      if (!narrow) { const l0 = Cd.lens[0], l2 = Cd.lens[2]; row(3, 'l₁²/l₃² (steady)', (l0 * l0 / (l2 * l2)).toFixed(3), th.ok); row(4, 'K₁/K₃', (Cd.mats[0].K / Cd.mats[2].K).toFixed(3)); row(5, 'time to steady', '≈ ' + tfmt(Cd.tEnd * 0.6)); }
      return;
    }
    // steam chest, rods, ice box and the measuring cylinder under the drip
    const L1 = Cd.L1 * 100, L2 = Cd.kind === 'series' ? Cd.L2 * 100 : 0, Ltot = L1 + L2, xs = -Ltot / 2;
    R3.box(F, m(xs - 7, 0, 9), [12 * KT, 14 * KT, 18 * KT], '#8A93A3', { shadow: false });
    const puff = [], sp = sprite('#F2F6FF', { glow: true });
    for (let i = 0; i < 10; i++) { const f = (S.ts * 0.5 + i / 10) % 1; puff.push([m(xs - 7 + Math.sin(i * 3) * 2, Math.cos(i * 2) * 3, 18 + f * 8)[0], m(0, Math.cos(i * 2) * 3, 0)[1], m(0, 0, 18 + f * 8)[2], 0.08 + f * 0.1, sp]); }
    ballCloud(F, puff, m(xs - 7, 0, 22), -0.02);
    R3.label(F, m(xs - 7, 0, 29), 'steam chest · 100 °C', '#FFB38A', { size: 9.5 });
    R3.box(F, m(xs + Ltot + 7, 0, 9), [12 * KT, 14 * KT, 18 * KT], '#3A5C7A', { shadow: false });
    R3.label(F, m(xs + Ltot + 7, 0, 21), 'ice box · 0 °C', '#9FD8FF', { size: 9.5 });
    const melted = (Cd.H * now.t / LF) * 1000;                                  // grams, if the current had been steady
    let mMelt = 0; Cd.rods.forEach(R => { for (let i = 1; i <= now.k; i++) { const a = R.flux[i - 1], b = R.flux[i]; mMelt += (a[2] + b[2]) / 2 * (b[0] - a[0]) * RODA / LF * 1000; } });
    liquidCyl(F, m(xs + Ltot + 7, -10, 0.3), 2.5 * KT, (0.3 + mMelt / 40) * KT, '#7FC8F0', { alpha: 0.6 });
    glassCyl(F, m(xs + Ltot + 7, -10, 0.3), 2.7 * KT, 12 * KT);
    R3.label(F, m(xs + Ltot + 7, -10, 13.5), 'melt water ' + mMelt.toFixed(1) + ' g', '#9FD8FF', { size: 9 });
    void melted;
    if (Cd.kind === 'series') {
      const sn = Cd.rods[0].snaps[now.k];
      heatRod(F, m(xs, 0, zr), m(xs + Ltot, 0, zr), 1.0 * KT, sn.T, 0, 100, false);
      const Tj = sn.T[Cd.ij];
      R3.cylinder(F, m(xs + L1, 0, zr + 1), m(xs + L1, 0, zr + 9), 0.25 * KT, '#DCE8F4', { segments: 8, shadow: false });
      R3.callout(F, m(xs + L1, 0, zr + 9), 30, -16, 'junction ' + Tj.toFixed(2) + ' °C', '#FFD36B', { size: 10 });
      R3.label(F, m(xs + L1 / 2, 0, zr - 2.4), Cd.A.name + ' · ' + L1.toFixed(0) + ' cm', '#DCE3EE', { size: 9 });
      R3.label(F, m(xs + L1 + L2 / 2, 0, zr - 2.4), Cd.B.name + ' · ' + L2.toFixed(0) + ' cm', '#DCE3EE', { size: 9 });
    } else {
      Cd.rods.forEach((R, i) => { const y = i ? 3 : -3; heatRod(F, m(xs, y, zr), m(xs + Ltot, y, zr), 1.0 * KT, R.snaps[now.k].T, 0, 100, false);
        R3.label(F, m(xs + Ltot / 2, y, zr + 2.2), (i ? Cd.B : Cd.A).name, '#DCE3EE', { size: 9 }); });
    }
    F.render();
    const Hn = Cd.rods.reduce((u, R) => u + R.flux[now.k][2], 0) * RODA;
    header(g, (Cd.kind === 'series' ? Cd.A.name + ' then ' + Cd.B.name + ', end to end' : Cd.A.name + ' and ' + Cd.B.name + ', side by side') + ' · 100 °C → 0 °C',
      't = ' + tfmt(now.t) + ' · rods 2 cm across, lagged · heat reaching the ice now ' + Hn.toFixed(3) + ' W → melting ' + (Hn / LF * 60e3).toFixed(3) + ' g/min',
      'solved node by node from switch-on (implicit heat equation); at steady state H = ΔT / ΣR, R = L/KA', th.text);
    const row = gPanel(g, 12, H - bh - 30, bw, bh, 'STEADY STATE, COMPUTED');
    row(0, 'heat current (solved)', Cd.H.toFixed(4) + ' W', th.phys);
    row(1, Cd.kind === 'series' ? 'ΔT/(L₁/K₁A + L₂/K₂A)' : 'ΔT·A(K₁ + K₂)/L', Cd.Hf.toFixed(4) + ' W', th.ok);
    row(2, 'ice melted per minute', Cd.melt.toFixed(3) + ' g');
    row(3, Cd.kind === 'series' ? 'junction temperature' : 'equivalent K (parallel)', Cd.kind === 'series' ? Cd.Tj.toFixed(3) + ' °C (formula ' + Cd.Tjf.toFixed(3) + ')' : ((Cd.A.K + Cd.B.K) / 2).toFixed(1) + ' W/mK');
    if (!narrow) {
      if (Cd.kind === 'series') { row(4, 'equivalent K (series)', (Ltot / 100 / (Cd.L1 / Cd.A.K + Cd.L2 / Cd.B.K)).toFixed(1) + ' W/mK'); row(5, 'thermal resistance', (100 / Cd.Hf).toFixed(2) + ' K/W'); }
      else { row(4, 'thermal resistance', (100 / Cd.Hf).toFixed(2) + ' K/W'); row(5, 'the better conductor carries', (Cd.A.K / (Cd.A.K + Cd.B.K) * 100).toFixed(1) + '%'); }
    }
  }

  /* ======================= radiation ======================= */
  function drawRad(S, g) {
    const ctx = g.ctx, th = g.theme, p = S.p, W = g.w, H = g.h, cam = S.cam;
    const narrow = W < 660, B = window.BENCH;
    const rows = narrow ? 4 : 6, bw = narrow ? W - 24 : 300, bh = 26 + rows * 15 + 10;
    if (p.rsub === 'spectrum') {
      const Sp = S.Sp, F = R3.Frame(ctx, cam, { ambient: 0.3, floorZ: null }), c0 = [0, 0, 0];
      // the glowing body: its colour is the CIE-weighted Planck spectrum, its brightness grows as T⁴ (compressed)
      const glow = clamp(Math.log10(Sp.P) / 9, 0.05, 1);
      F.push(c0, () => {
        const q = cam.project(c0); if (!q.ok) return; const r = 0.55 * q.s;
        const gr = ctx.createRadialGradient(q.x, q.y, r * 0.2, q.x, q.y, r * 2.4);
        gr.addColorStop(0, RX.rgba(Sp.col, 0.7 * glow)); gr.addColorStop(1, RX.rgba(Sp.col, 0));
        ctx.fillStyle = gr; ctx.beginPath(); ctx.arc(q.x, q.y, r * 2.4, 0, TAU); ctx.fill();
        const g2 = ctx.createRadialGradient(q.x - r * 0.2, q.y - r * 0.2, 0, q.x, q.y, r);
        g2.addColorStop(0, RX.mix(Sp.col, '#FFFFFF', 0.45 * glow)); g2.addColorStop(0.8, Sp.col); g2.addColorStop(1, RX.mix(Sp.col, '#05080F', 0.4));
        ctx.fillStyle = g2; ctx.beginPath(); ctx.arc(q.x, q.y, r, 0, TAU); ctx.fill();
      }, 0);
      F.render();
      // a spectrometer strip: the visible band, each wavelength as bright as Planck says
      const sx = narrow ? 14 : W - 330, sy = narrow ? 70 : 80, sw = narrow ? W - 28 : 310, sh = 34;
      ctx.fillStyle = g.alpha('#0B1020', .9); ctx.strokeStyle = g.alpha(th.line, 1); ctx.beginPath(); ctx.roundRect(sx - 6, sy - 18, sw + 12, sh + 36, 8); ctx.fill(); ctx.stroke();
      PA.lbl(ctx, sx, sy - 8, 'THE VISIBLE BAND, AS BRIGHT AS PLANCK SAYS', th['text-3'], 'left', 8);
      // each wavelength's light through the eye's curves into linear sRGB; one scale for the whole band,
      // so the deep red and violet ends come out as dim as they look
      const band = [];
      let mx = 1e-30;
      for (let l = 380; l <= 750; l += 2) {
        const B = planck(l * 1e-9, Sp.T), X = B * cieX(l), Y = B * cieY(l), Z = B * cieZ(l);
        const rgb = [3.2406 * X - 1.5372 * Y - 0.4986 * Z, -0.9689 * X + 1.8758 * Y + 0.0415 * Z, 0.0557 * X - 0.2040 * Y + 1.0570 * Z].map(v => Math.max(0, v));
        band.push([l, rgb]); mx = Math.max(mx, ...rgb);
      }
      const gam = v => v <= 0.0031308 ? 12.92 * v : 1.055 * Math.pow(v, 1 / 2.4) - 0.055;
      band.forEach(([l, rgb]) => {
        ctx.fillStyle = 'rgb(' + rgb.map(v => Math.round(clamp(gam(v / mx), 0, 1) * 255)).join(',') + ')';
        ctx.fillRect(sx + (l - 380) / 370 * sw, sy, sw / 185 + 0.6, sh);
      });
      PA.lbl(ctx, sx, sy + sh + 9, '380 nm', th['text-3'], 'left', 8); PA.lbl(ctx, sx + sw, sy + sh + 9, '750 nm', th['text-3'], 'right', 8);
      header(g, 'A black body at ' + Sp.T.toFixed(0) + ' K', 'spectrum from Planck\'s law on 1200 wavelengths · peak found numerically · total power integrated (Simpson)',
        'its colour: the spectrum weighted by the eye\'s three responses (CIE 1931) and converted to sRGB', th.text);
      const row = gPanel(g, 12, H - bh - 30, bw, bh, 'MEASURED FROM THE SPECTRUM');
      row(0, 'peak wavelength λ_max', (Sp.lmax * 1e9).toFixed(1) + ' nm', th.phys);
      row(1, 'λ_max × T (Wien\'s b)', (Sp.b * 1e3).toFixed(4) + ' × 10⁻³ m·K', th.ok);
      row(2, 'total power per m²', Sp.P.toExponential(4) + ' W');
      row(3, 'P / T⁴ (Stefan\'s σ)', (Sp.sigma * 1e8).toFixed(4) + ' × 10⁻⁸', th.ok);
      if (!narrow) { row(4, 'fraction in the visible', (Sp.vis * 100).toFixed(2) + '%'); row(5, 'colour (sRGB)', Sp.col.toUpperCase(), Sp.col); }
      return;
    }
    const Co = S.Co, F = R3.Frame(ctx, cam, { ambient: 0.32, floorZ: 0 });
    const m = (x, y, z) => [x * KT, y * KT, z * KT], tp = clamp(S.ts / 20, 0, 1) * Co.tEnd, st = Co.at(tp);
    B.table(F, m(-20, 0, 0)[0], m(20, 0, 0)[0], m(0, -11, 0)[1], m(0, 11, 0)[1], 0, { legs: false, tone: '#6E4A2C', seed: 71, thick: 0.06 });
    // the enclosure: a double-walled box at room temperature (drawn as a frame)
    const bx = [[-16, 16], [-8, 8], [0.3, 22]];
    const E = [[0, 0, 0], [1, 0, 0], [1, 1, 0], [0, 1, 0]].map(q => [bx[0][q[0]], bx[1][q[1]]]);
    [0.3, 22].forEach(z => path3(F, E.concat([E[0]]).map(q => m(q[0], q[1], z)), '#8FA4CE', { alpha: 0.45, width: 1, chunk: 1 }));
    E.forEach(q => path3(F, [m(q[0], q[1], 0.3), m(q[0], q[1], 22)], '#8FA4CE', { alpha: 0.45, width: 1, chunk: 1 }));
    const r = Co.r * 100;
    [[-7, st[1], '#1B1D22', 'blackened, ε = 0.95'], [7, st[2], '#D89A5E', 'polished, ε = 0.05']].forEach(([x, T, col, lab]) => {
      B.string(F, [m(x, 0, 12 + r), m(x, 0, 22)], { r: 0.0025 });
      R3.sphere(F, m(x, 0, 12), r * KT, col, { shadow: false, rim: 0.7 });
      // an infrared glow, as a thermal camera would see it
      F.push(m(x, 0, 12), () => { const q = cam.project(m(x, 0, 12)); if (!q.ok) return; const rr = r * KT * q.s * 2.4;
        const gr = ctx.createRadialGradient(q.x, q.y, rr * 0.3, q.x, q.y, rr); gr.addColorStop(0, RX.rgba(tcol(T, 20, 100), 0.35)); gr.addColorStop(1, RX.rgba(tcol(T, 20, 100), 0));
        ctx.fillStyle = gr; ctx.beginPath(); ctx.arc(q.x, q.y, rr, 0, TAU); ctx.fill(); }, 0.01);
      R3.label(F, m(x, 0, 12 - r - 2), lab + ' · ' + T.toFixed(2) + ' °C', tcol(T, 20, 100), { size: 10, align: x < 0 ? 'right' : 'left', dx: x < 0 ? 30 : -30 });
    });
    F.render();
    header(g, 'Two copper spheres cooling in a room at ' + p.Tenv.toFixed(0) + ' °C',
      't = ' + tfmt(tp) + ' · radius ' + p.rs.toFixed(1) + ' cm · εσA(T⁴ − T₀⁴)' + (p.conv ? ' + convection hA(T − T₀), h = 6 W/m²K' : ' only (a vacuum enclosure)') + ' · RK4',
      'a good absorber is a good emitter: the black sphere cools faster from the same start', th.text);
    const row = gPanel(g, 12, H - bh - 30, bw, bh, 'COOLING TIMES, MEASURED (BLACK SPHERE)');
    row(0, '80 → 70 °C', isFinite(Co.t1) ? tfmt(Co.t1) : '—', th.phys);
    row(1, '70 → 60 °C', isFinite(Co.t2) ? tfmt(Co.t2) : '—', th.phys);
    row(2, 'Newton\'s average-T estimate of the 2nd', isFinite(Co.t1) ? tfmt(Co.t1 * (75 - p.Tenv) / (65 - p.Tenv)) : '—', th.ok);
    row(3, 'net radiated now (black)', (0.95 * SIG * Co.A * (Math.pow(st[1] + 273.15, 4) - Math.pow(p.Tenv + 273.15, 4))).toFixed(3) + ' W');
    if (!narrow) { row(4, 'mass · heat capacity', (Co.m * 1000).toFixed(0) + ' g · ' + (Co.m * Co.c).toFixed(1) + ' J/K'); row(5, 'polished sphere is behind by', (st[2] - st[1]).toFixed(2) + ' K'); }
  }

  const CAL = S => S.p.mode === 'calor', EXP = S => S.p.mode === 'expand', CND = S => S.p.mode === 'conduct', RAD = S => S.p.mode === 'radiate',
        BIM = S => EXP(S) && S.p.esub === 'bimetal', FLK = S => EXP(S) && S.p.esub === 'flask', CLK = S => EXP(S) && S.p.esub === 'clock',
        ICE = S => CAL(S) && S.p.add === 'ice', MTL = S => CAL(S) && S.p.add === 'metal',
        SER = S => CND(S) && S.p.csub === 'series', ING = S => CND(S) && S.p.csub === 'ingen',
        COO = S => RAD(S) && S.p.rsub === 'cool', SPC = S => RAD(S) && S.p.rsub === 'spectrum';
  const METALS = ['copper', 'aluminium', 'brass', 'iron', 'steel', 'lead', 'invar'].map(k => ({ value: k, label: MAT[k].name[0].toUpperCase() + MAT[k].name.slice(1) }));

  L.register({
    id: 'thermal', subject: 'physics',
    name: 'Heat — Calorimetry, Expansion, Conduction and Radiation',
    chapter: 'Thermal Properties of Matter',
    exams: ['JEE Main', 'JEE Advanced', 'NEET UG'],
    weight: 'Very high yield',
    is3D: true,
    stageHint: 'Drag to orbit · every temperature on the stage is integrated, not looked up',
    lede: 'Four benches that <b>integrate the heat flow</b> instead of quoting the answer. In the calorimeter each body is tracked by ' +
      'its <b>enthalpy</b>, so ice sits at 0 °C for exactly as long as its latent heat takes, and whether it <b>all melts</b> is found ' +
      'by running it. A bimetal strip bends by Timoshenko\'s formula and closes an alarm contact; a flask\'s level <b>falls before it ' +
      'rises</b>; two pendulum clocks are integrated through a whole day. Rods conduct from switch-on to steady state, node by node, ' +
      'and melt ice at the rate their heat current says. Two spheres cool by <b>εσT⁴</b>, and a black body\'s peak, power and even ' +
      'its <b>colour</b> are computed from Planck\'s law.',

    params: { mode: 'calor', add: 'ice', mw: 200, mcal: 100, madd: 100, Tw: 30, Tice: -10, Tm: 100, metal: 'aluminium', lag: true,
              esub: 'bimetal', m1: 'brass', m2: 'invar', tb: 1, Lb: 10, dT: 100, gap: 5, fliq: 'water', pyrex: false, T0f: 20, Tb: 80, rod: 'steel', Tc: 40,
              csub: 'series', r1: 'copper', r2: 'steel', r3: 'iron', L1: 20, L2: 20,
              rsub: 'cool', rs: 3, Tenv: 20, T0c: 90, conv: true, Tbb: 5778, run: true },

    presets: [
      { name: 'Ice into warm water · not all of it melts', params: { mode: 'calor', add: 'ice', mw: 200, mcal: 100, madd: 100, Tw: 30, Tice: -10, lag: true } },
      { name: 'A little ice · all of it melts', params: { mode: 'calor', add: 'ice', mw: 200, mcal: 100, madd: 30, Tw: 30, Tice: -10, lag: true } },
      { name: 'Steam into water', params: { mode: 'calor', add: 'steam', mw: 200, mcal: 100, madd: 10, Tw: 20, lag: true } },
      { name: 'Method of mixtures · hot aluminium', params: { mode: 'calor', add: 'metal', metal: 'aluminium', mw: 150, mcal: 100, madd: 200, Tw: 20, Tm: 100, lag: true } },
      { name: 'Unlagged · heat leaks to the room', params: { mode: 'calor', add: 'metal', metal: 'aluminium', mw: 150, mcal: 100, madd: 200, Tw: 20, Tm: 100, lag: false } },
      { name: 'Bimetal strip heated · brass on invar', params: { mode: 'expand', esub: 'bimetal', m1: 'brass', m2: 'invar', tb: 1, Lb: 10, dT: 100, gap: 5 } },
      { name: 'Bimetal cooled · it bends the other way', params: { mode: 'expand', esub: 'bimetal', m1: 'brass', m2: 'invar', tb: 1, Lb: 10, dT: -80, gap: 5 } },
      { name: 'Flask of water into a hot bath · the level dips first', params: { mode: 'expand', esub: 'flask', fliq: 'water', pyrex: false, T0f: 20, Tb: 80 } },
      { name: 'Mercury in Pyrex · a thermometer', params: { mode: 'expand', esub: 'flask', fliq: 'mercury', pyrex: true, T0f: 20, Tb: 80 } },
      { name: 'Water cooled from 10 °C to 0 °C · anomalous', params: { mode: 'expand', esub: 'flask', fliq: 'water', pyrex: true, T0f: 10, Tb: 0 } },
      { name: 'Pendulum clock with a steel rod at 40 °C', params: { mode: 'expand', esub: 'clock', rod: 'steel', Tc: 40 } },
      { name: 'An invar rod · nearly compensated', params: { mode: 'expand', esub: 'clock', rod: 'invar', Tc: 40 } },
      { name: 'Copper then steel, in series', params: { mode: 'conduct', csub: 'series', r1: 'copper', r2: 'steel', L1: 20, L2: 20 } },
      { name: 'Copper and steel, in parallel', params: { mode: 'conduct', csub: 'parallel', r1: 'copper', r2: 'steel', L1: 20, L2: 20 } },
      { name: 'Ingen-Hausz · copper, aluminium, iron', params: { mode: 'conduct', csub: 'ingen', r1: 'copper', r2: 'aluminium', r3: 'iron' } },
      { name: 'Black and polished spheres cooling', params: { mode: 'radiate', rsub: 'cool', rs: 3, Tenv: 20, T0c: 90, conv: true } },
      { name: 'In a vacuum · radiation only', params: { mode: 'radiate', rsub: 'cool', rs: 3, Tenv: 20, T0c: 90, conv: false } },
      { name: 'The Sun · 5778 K', params: { mode: 'radiate', rsub: 'spectrum', Tbb: 5778 } },
      { name: 'A tungsten filament · 2800 K', params: { mode: 'radiate', rsub: 'spectrum', Tbb: 2800 } },
      { name: 'A blue giant · 20 000 K', params: { mode: 'radiate', rsub: 'spectrum', Tbb: 20000 } }
    ],

    controls: [
      { group: 'What is set up', items: [
        { key: 'mode', type: 'select', label: 'Bench', restructure: true, rebuild: true, options: [
          { value: 'calor', label: 'Calorimeter' }, { value: 'expand', label: 'Thermal expansion' },
          { value: 'conduct', label: 'Conduction' }, { value: 'radiate', label: 'Radiation' }] }
      ] },
      { group: 'The calorimeter', items: [
        { key: 'add', type: 'select', label: 'Put in', restructure: true, rebuild: true, when: CAL, options: [
          { value: 'ice', label: 'Ice' }, { value: 'steam', label: 'Steam' }, { value: 'metal', label: 'A hot metal block' }] },
        { key: 'madd', label: 'Its mass', min: 5, max: 400, step: 1, unit: 'g', when: CAL, fmt: v => v.toFixed(0), restructure: true },
        { key: 'Tice', label: 'Ice temperature', min: -40, max: 0, step: 0.5, unit: '°C', when: ICE, fmt: v => v.toFixed(1), restructure: true },
        { key: 'metal', type: 'select', label: 'Metal', restructure: true, when: MTL, options: METALS },
        { key: 'Tm', label: 'Metal temperature', min: 40, max: 300, step: 1, unit: '°C', when: MTL, fmt: v => v.toFixed(0), restructure: true },
        { key: 'mw', label: 'Water in the cup', min: 50, max: 400, step: 1, unit: 'g', when: CAL, fmt: v => v.toFixed(0), restructure: true },
        { key: 'Tw', label: 'Water temperature', min: 1, max: 90, step: 0.5, unit: '°C', when: CAL, fmt: v => v.toFixed(1), restructure: true },
        { key: 'mcal', label: 'Copper cup', min: 0, max: 300, step: 1, unit: 'g', when: CAL, fmt: v => v.toFixed(0), restructure: true },
        { key: 'lag', type: 'toggle', label: 'Perfectly lagged (no loss to the room)', restructure: true, when: CAL }
      ] },
      { group: 'Expansion', items: [
        { key: 'esub', type: 'select', label: 'Apparatus', restructure: true, rebuild: true, when: EXP, options: [
          { value: 'bimetal', label: 'Bimetallic strip' }, { value: 'flask', label: 'Liquid in a flask' }, { value: 'clock', label: 'Pendulum clocks' }] },
        { key: 'm1', type: 'select', label: 'Top layer', restructure: true, when: BIM, options: METALS },
        { key: 'm2', type: 'select', label: 'Bottom layer', restructure: true, when: BIM, options: METALS },
        { key: 'dT', label: 'Temperature change ΔT', min: -150, max: 300, step: 1, unit: 'K', when: BIM, fmt: v => v.toFixed(0), restructure: true },
        { key: 'tb', label: 'Total thickness', min: 0.2, max: 3, step: 0.05, unit: 'mm', when: BIM, fmt: v => v.toFixed(2), restructure: true },
        { key: 'Lb', label: 'Length', min: 4, max: 20, step: 0.5, unit: 'cm', when: BIM, fmt: v => v.toFixed(1), restructure: true },
        { key: 'gap', label: 'Gap to the alarm contact', min: 0.5, max: 20, step: 0.1, unit: 'mm', when: BIM, fmt: v => v.toFixed(1), restructure: true },
        { key: 'fliq', type: 'select', label: 'Liquid', restructure: true, when: FLK, options: [
          { value: 'water', label: 'Water' }, { value: 'mercury', label: 'Mercury' }, { value: 'ethanol', label: 'Ethanol' }] },
        { key: 'T0f', label: 'Starting temperature', min: 0, max: 60, step: 0.5, unit: '°C', when: FLK, fmt: v => v.toFixed(1), restructure: true },
        { key: 'Tb', label: 'Bath temperature', min: 0, max: 95, step: 0.5, unit: '°C', when: FLK, fmt: v => v.toFixed(1), restructure: true },
        { key: 'pyrex', type: 'toggle', label: 'Pyrex glass (α = 3.3 × 10⁻⁶)', restructure: true, when: FLK },
        { key: 'rod', type: 'select', label: 'Pendulum rod', restructure: true, when: CLK, options: METALS },
        { key: 'Tc', label: 'Room temperature (regulated at 20 °C)', min: -10, max: 50, step: 0.5, unit: '°C', when: CLK, fmt: v => v.toFixed(1), restructure: true }
      ] },
      { group: 'The rods', items: [
        { key: 'csub', type: 'select', label: 'Arrangement', restructure: true, rebuild: true, when: CND, options: [
          { value: 'series', label: 'Two rods end to end' }, { value: 'parallel', label: 'Two rods side by side' }, { value: 'ingen', label: 'Ingen-Hausz (three rods)' }] },
        { key: 'r1', type: 'select', label: 'Rod 1', restructure: true, when: CND, options: METALS },
        { key: 'r2', type: 'select', label: 'Rod 2', restructure: true, when: CND, options: METALS },
        { key: 'r3', type: 'select', label: 'Rod 3', restructure: true, when: ING, options: METALS },
        { key: 'L1', label: 'Length of rod 1', min: 5, max: 40, step: 0.5, unit: 'cm', when: S => CND(S) && !ING(S), fmt: v => v.toFixed(1), restructure: true },
        { key: 'L2', label: 'Length of rod 2', min: 5, max: 40, step: 0.5, unit: 'cm', when: SER, fmt: v => v.toFixed(1), restructure: true }
      ] },
      { group: 'Radiation', items: [
        { key: 'rsub', type: 'select', label: 'Experiment', restructure: true, rebuild: true, when: RAD, options: [
          { value: 'cool', label: 'Cooling spheres' }, { value: 'spectrum', label: 'Black-body spectrum' }] },
        { key: 'T0c', label: 'Starting temperature', min: 40, max: 200, step: 1, unit: '°C', when: COO, fmt: v => v.toFixed(0), restructure: true },
        { key: 'Tenv', label: 'Room temperature', min: -10, max: 40, step: 0.5, unit: '°C', when: COO, fmt: v => v.toFixed(1), restructure: true },
        { key: 'rs', label: 'Sphere radius', min: 1, max: 8, step: 0.1, unit: 'cm', when: COO, fmt: v => v.toFixed(1), restructure: true },
        { key: 'conv', type: 'toggle', label: 'Air round them (convection)', restructure: true, when: COO },
        { key: 'Tbb', label: 'Temperature', min: 300, max: 20000, step: 10, unit: 'K', when: SPC, fmt: v => v.toFixed(0), restructure: true }
      ] },
      { group: 'Display', items: [
        { key: 'run', type: 'toggle', label: 'Let it run' }
      ] }
    ],

    setup(S) {
      const p = S.p;
      if (p.mode === 'calor') S.Ca = runCal(p);
      else if (p.mode === 'expand') { if (p.esub === 'bimetal') S.Bm = bimetal(p); else if (p.esub === 'flask') S.Fk = runFlask(p); else S.Ck = runClock(p); }
      else if (p.mode === 'conduct') S.Cd = runCond(p);
      else { if (p.rsub === 'spectrum') S.Sp = runSpec(p); else S.Co = runCool(p); }
      S.ts = 0; S.hold = 0;
      const views = {
        calor: { theta: -1.30, phi: 0.36, dist: 4.2, target: [0, 0, 0.75] },
        'expand-bimetal': { theta: -1.45, phi: 0.18, dist: 3.4, target: [0, 0, 0.8] },
        'expand-flask': { theta: -1.40, phi: 0.2, dist: 3.6, target: [0, 0, 1.1] },
        'expand-clock': { theta: -1.52, phi: 0.12, dist: 4.4, target: [0, 0, 1.3] },
        'conduct-series': { theta: -1.40, phi: 0.36, dist: 7.2, target: [0, 0, 0.8] },
        'conduct-parallel': { theta: -1.30, phi: 0.40, dist: 7.0, target: [0, 0, 0.8] },
        'conduct-ingen': { theta: -1.25, phi: 0.45, dist: 7.6, target: [0.1, 0, 0.7] },
        'radiate-cool': { theta: -1.45, phi: 0.2, dist: 4.2, target: [0, 0, 1.1] },
        'radiate-spectrum': { theta: -1.5, phi: 0.1, dist: 3.4, target: [0, 0, 0] }
      };
      const vk = p.mode === 'calor' ? 'calor' : p.mode + '-' + (p.mode === 'expand' ? p.esub : p.mode === 'conduct' ? p.csub : p.rsub);
      if (!S.cam || S._view !== vk) { S.cam = Camera(views[vk]); S.cam.minDist = 1.0; S.cam.maxDist = 16; S._view = vk; S._narrowCam = false; }
    },

    step(S, dt) {
      const p = S.p;
      if (!p.run) return;
      if (S.hold > 0) { S.hold -= dt; if (S.hold <= 0) S.ts = 0; return; }
      const end = p.mode === 'radiate' && p.rsub === 'spectrum' ? 1e9 : p.mode === 'expand' && p.esub === 'flask' ? 18 : p.mode === 'expand' && p.esub === 'bimetal' ? 1e9 : 20;
      S.ts += dt;
      if (S.ts >= end) { S.ts = end; S.hold = 3; }
    },

    drawStage(S, g) {
      if (g.w < 660 && !S._narrowCam) { S.cam.dist *= 1.3; S._narrowCam = true; }
      const md = S.p.mode;
      if (md === 'calor') drawCal(S, g);
      else if (md === 'expand') drawExpand(S, g);
      else if (md === 'conduct') drawCond(S, g);
      else drawRad(S, g);
    },

    plots: [
      { title: S => ({ calor: 'Both temperatures against time — the flat parts are latent heat', expand: { bimetal: 'Tip deflection against ΔT for this pair', flask: 'The level in the neck against time — it dips first', clock: 'Seconds lost in a day, accumulating' }[S.p.esub],
                       conduct: S.p.csub === 'ingen' ? 'Temperature along each rod, now' : 'Temperature along the rod, now — and at steady state', radiate: S.p.rsub === 'spectrum' ? 'Planck\'s spectrum — peak found numerically' : 'Both spheres cooling' })[S.p.mode],
        draw(S, g) {
          const p = S.p, th = g.theme, cy = '#3DD6F5', gr = '#7CF0B0', am = '#F5B451', pk = '#FF8FB0';
          if (p.mode === 'calor') {
            const Ca = S.Ca, tp = clamp(S.ts / 20, 0, 1) * Ca.tEnd;
            const w = Ca.out.map(o => [o[0] / 60, o[1]]), a = Ca.out.map(o => [o[0] / 60, o[2]]);
            const lo = Math.min(0, ...a.map(q => q[1]), ...w.map(q => q[1])) - 3, hi = Math.max(...a.map(q => q[1]), ...w.map(q => q[1])) + 5;
            const P = g.Plot({ xmin: 0, xmax: Ca.tEnd / 60, ymin: lo, ymax: hi, xlabel: 'time (min)', ylabel: '°C', xfmt: v => v.toFixed(0), yfmt: v => v.toFixed(0) }).frame();
            P.clip(() => { P.hline(0, g.alpha(th['text-3'], .7), [3, 3]); if (hi > 100) P.hline(100, g.alpha(th['text-3'], .7), [3, 3]); P.hline(Ca.TfEq, g.alpha(pk, .7), [5, 3]); P.line(w, cy, 2.2); P.line(a, am, 2.2); P.vline(tp / 60, g.alpha(gr, .7), [3, 3]); });
            P.tag(Ca.tEnd / 60 * 0.98, Ca.TfEq, 'energy balance ' + (Math.abs(Ca.TfEq) < 0.005 ? 0 : Ca.TfEq).toFixed(2) + ' °C', pk, 'right', -8);
            P.tag(Ca.tEnd / 60 * 0.3, w[Math.floor(w.length * 0.3)][1], 'water + cup', cy, 'left', -9);
            P.tag(Ca.tEnd / 60 * 0.02, a[2][1], Ca.add, am, 'left', 12);
            return;
          }
          if (p.mode === 'expand' && p.esub === 'bimetal') {
            const pts = [];
            for (let d = -150; d <= 300; d += 5) pts.push([d, bimetal(Object.assign({}, p, { dT: d })).tip * 1000]);
            const hi = Math.max(...pts.map(q => Math.abs(q[1]))) * 1.1 || 1;
            const P = g.Plot({ xmin: -150, xmax: 300, ymin: -hi, ymax: hi, xlabel: 'ΔT (K)', ylabel: 'tip deflection (mm, + = toward bottom layer)', xfmt: v => v.toFixed(0), yfmt: v => v.toFixed(0) }).frame();
            P.clip(() => { P.hline(0, g.alpha(th['text-3'], .7)); P.hline(p.gap, g.alpha(pk, .7), [4, 3]); P.line(pts, gr, 2.2); P.dot(p.dT, S.Bm.tip * 1000, 5.5, am, th['ink-950']); });
            P.tag(290, p.gap, 'alarm contact', pk, 'right', -8);
            return;
          }
          if (p.mode === 'expand' && p.esub === 'flask') {
            const Fk = S.Fk, tp = clamp(S.ts / 18, 0, 1) * Fk.tEnd, pts = Fk.out.map(o => [o[0], o[1] * 1000]);
            const lo = Math.min(...pts.map(q => q[1])), hi = Math.max(...pts.map(q => q[1]));
            const P = g.Plot({ xmin: 0, xmax: 60, ymin: lo - (hi - lo) * 0.08 - 0.2, ymax: hi + (hi - lo) * 0.08 + 0.2, xlabel: 'time (s) — first minute', ylabel: 'level change (mm)', xfmt: v => v.toFixed(0), yfmt: v => v.toFixed(1) }).frame();
            P.clip(() => { P.hline(0, g.alpha(th['text-3'], .7), [3, 3]); P.line(pts.filter(q => q[0] <= 60.5), cy, 2.2); P.vline(Math.min(60, tp), g.alpha(gr, .7), [3, 3]); P.dot(Fk.tMin, Fk.minH * 1000, 5, pk, th['ink-950']); });
            if (Fk.minH < -1e-5) P.tag(Fk.tMin, Fk.minH * 1000, 'dip ' + (Fk.minH * 1000).toFixed(2) + ' mm: the glass expanded first', pk, 'left', 12);
            return;
          }
          if (p.mode === 'expand') {
            const Ck = S.Ck, f = clamp(S.ts / 20, 0, 1), pts = [];
            for (let h = 0; h <= 24; h += 0.5) pts.push([h, Ck.lost * h / 24]);
            const hi = Math.max(1, Math.abs(Ck.lost)) * 1.15;
            const P = g.Plot({ xmin: 0, xmax: 24, ymin: Math.min(0, Ck.lost) * 1.15 - 0.1, ymax: Math.max(0, Ck.lost) * 1.15 + 0.1, xlabel: 'hours', ylabel: 'seconds behind the reference', xfmt: v => v.toFixed(0), yfmt: v => v.toFixed(1) }).frame();
            P.clip(() => { P.line(pts, am, 2.2); P.dot(f * 24, Ck.lost * f, 5, am, th['ink-950']); });
            P.tag(23.5, Ck.lost, Ck.lost.toFixed(2) + ' s by midnight', am, 'right', -10);
            void hi;
            return;
          }
          if (p.mode === 'conduct') {
            const Cd = S.Cd, now = condNow(S);
            const cols = [cy, am, pk];
            const P = g.Plot({ xmin: 0, xmax: Cd.rods[0].xs[Cd.rods[0].N] * 100, ymin: Cd.kind === 'ingen' ? 15 : -5, ymax: 105, xlabel: 'distance from the hot end (cm)', ylabel: '°C', xfmt: v => v.toFixed(0), yfmt: v => v.toFixed(0) }).frame();
            P.clip(() => {
              if (Cd.kind === 'ingen') P.hline(Cd.Twax, g.alpha(th['text-3'], .8), [3, 3]);
              Cd.rods.forEach((R, i) => {
                const fin = R.snaps[R.snaps.length - 1], nw = R.snaps[now.k];
                P.line(R.xs.map((x, j) => [x * 100, fin.T[j]]), g.alpha(cols[i], .5), 1.2, [5, 3]);
                P.line(R.xs.map((x, j) => [x * 100, nw.T[j]]), cols[i], 2.2);
              });
              if (Cd.kind === 'series') P.vline(Cd.L1 * 100, g.alpha(th['text-3'], .6), [2, 3]);
            });
            if (Cd.kind === 'ingen') { P.tag(1, Cd.Twax, 'wax melts at 55 °C', th['text-3'], 'left', -8); Cd.mats.forEach((M, i) => P.tag(Cd.lens[i] * 100, Cd.Twax, M.name, cols[i], 'left', 12 + i * 11)); }
            else P.tag(Cd.rods[0].xs[Cd.rods[0].N] * 100 * 0.98, 100, 'dashed: steady state', th['text-2'], 'right', 10);
            return;
          }
          if (p.rsub === 'spectrum') {
            const Sp = S.Sp, xs = Sp.lams.map((l, i) => [l * 1e9, Sp.pts[i] / Sp.peak]).filter(q => q[0] <= Math.max(3000, Sp.lmax * 1e9 * 5));
            const xmax = Math.max(1500, Math.min(20000, Sp.lmax * 1e9 * 5));
            const P = g.Plot({ xmin: 0, xmax, ymin: 0, ymax: 1.1, xlabel: 'wavelength (nm)', ylabel: 'B_λ ÷ peak', xfmt: v => v.toFixed(0), yfmt: v => v.toFixed(1) }).frame();
            P.clip(() => {
              for (let l = 380; l < 750; l += 5) { const c = bbColour(1e5); void c; }
              P.area([[380, 0], [380, 1.1], [750, 1.1], [750, 0]], 0, g.alpha('#B8A4FF', .10));
              P.area(xs.filter(q => q[0] <= xmax), 0, g.alpha(am, .18)); P.line(xs.filter(q => q[0] <= xmax), am, 2.2); P.vline(Sp.lmax * 1e9, g.alpha(pk, .8), [4, 3]);
            });
            P.tag(565, 1.04, 'visible', '#B8A4FF', 'center', 0);
            P.tag(Sp.lmax * 1e9, 1.0, 'λ_max = ' + (Sp.lmax * 1e9).toFixed(1) + ' nm', pk, 'left', -8);
            return;
          }
          const Co = S.Co, tp = clamp(S.ts / 20, 0, 1) * Co.tEnd;
          const a = Co.out.map(o => [o[0] / 60, o[1]]), b = Co.out.map(o => [o[0] / 60, o[2]]);
          const P = g.Plot({ xmin: 0, xmax: Co.tEnd / 60, ymin: p.Tenv - 3, ymax: p.T0c + 5, xlabel: 'time (min)', ylabel: '°C', xfmt: v => v.toFixed(0), yfmt: v => v.toFixed(0) }).frame();
          P.clip(() => { P.hline(p.Tenv, g.alpha(th['text-3'], .7), [3, 3]); [80, 70, 60].forEach(v => P.hline(v, g.alpha(pk, .35), [2, 3])); P.line(a, '#9AA3B8', 2.2); P.line(b, am, 2.2); P.vline(tp / 60, g.alpha(gr, .7), [3, 3]); });
          P.tag(Co.tEnd / 60 * 0.98, a[a.length - 1][1], 'black', '#9AA3B8', 'right', 10); P.tag(Co.tEnd / 60 * 0.98, b[b.length - 1][1], 'polished', am, 'right', -8);
        } },
      { title: S => ({ calor: 'Final temperature against how much is added — the 0 °C shelf', expand: { bimetal: 'Curvature per kelvin for every pair of metals', flask: 'Volume against temperature: water\'s minimum at 4 °C', clock: 'Loss per day against temperature, for each rod' }[S.p.esub],
                       conduct: S.p.csub === 'ingen' ? 'Melted length² against K — a straight line' : 'Heat current into the ice, from switch-on', radiate: S.p.rsub === 'spectrum' ? 'Power against temperature (log–log): slope 4' : 'Cooling rate against excess temperature' })[S.p.mode],
        draw(S, g) {
          const p = S.p, th = g.theme, cy = '#3DD6F5', gr = '#7CF0B0', am = '#F5B451', pk = '#FF8FB0';
          if (p.mode === 'calor') {
            const Ca = S.Ca, pts = [], mx = 400;
            for (let mg = 0; mg <= mx; mg += 4) pts.push([mg, calEq(Ca.mw, Ca.Tw0, Ca.mc, Ca.add, mg / 1000, Ca.add === 'steam' ? 100 : Ca.Ta0, Ca.cm)]);
            const lo = Math.min(...pts.map(q => q[1])) - 3, hi = Math.max(...pts.map(q => q[1])) + 3;
            const P = g.Plot({ xmin: 0, xmax: mx, ymin: lo, ymax: hi, xlabel: 'mass added (g)', ylabel: 'final °C (energy balance)', xfmt: v => v.toFixed(0), yfmt: v => v.toFixed(0) }).frame();
            P.clip(() => { P.hline(0, g.alpha(th['text-3'], .7), [3, 3]); P.line(pts, cy, 2.2); P.dot(Ca.ma * 1000, Ca.TfEq, 5.5, am, th['ink-950']); });
            if (Ca.add === 'ice') P.tag(mx * 0.98, 0, 'ice left over: stuck at 0 °C', th['text-2'], 'right', -8);
            return;
          }
          if (p.mode === 'expand' && p.esub === 'bimetal') {
            const pairs = [['brass', 'invar'], ['aluminium', 'invar'], ['brass', 'steel'], ['copper', 'iron'], ['aluminium', 'steel'], ['lead', 'invar']];
            const P = g.Plot({ xmin: 0, xmax: 30, ymin: 0, ymax: 0.05, xlabel: 'Δα (× 10⁻⁶ /K)', ylabel: 'curvature per K (1/m)', xfmt: v => v.toFixed(0), yfmt: v => v.toFixed(3) }).frame();
            P.clip(() => { P.line([[0, 0], [30, 1.5 * 30e-6 / (p.tb / 1000)]], g.alpha(th['text-2'], .7), 1.2, [5, 3]);
              pairs.forEach(pr => { const b = bimetal(Object.assign({}, p, { m1: pr[0], m2: pr[1], dT: 1 })); P.dot((MAT[pr[0]].a - MAT[pr[1]].a) * 1e6, b.k, pr[0] === p.m1 && pr[1] === p.m2 ? 6 : 4, pr[0] === p.m1 && pr[1] === p.m2 ? am : cy, th['ink-950']); }); });
            pairs.forEach(pr => { const b = bimetal(Object.assign({}, p, { m1: pr[0], m2: pr[1], dT: 1 })); P.tag((MAT[pr[0]].a - MAT[pr[1]].a) * 1e6, b.k, pr[0] + '/' + pr[1], th['text-3'], 'left', 10); });
            P.tag(29, 1.5 * 29e-6 / (p.tb / 1000), '3Δα/2t (equal layers)', th['text-2'], 'right', -8);
            return;
          }
          if (p.mode === 'expand' && p.esub === 'flask') {
            const w = [], hg = [], et = [];
            for (let T = 0; T <= 30; T += 0.25) { w.push([T, (LIQX.water.V(T) / LIQX.water.V(4) - 1) * 1e4]); }
            const P = g.Plot({ xmin: 0, xmax: 30, ymin: -0.2, ymax: 45, xlabel: '°C', ylabel: 'volume change from 4 °C (parts in 10⁴)', xfmt: v => v.toFixed(0), yfmt: v => v.toFixed(0) }).frame();
            P.clip(() => { P.line(w, cy, 2.4); P.vline(4, g.alpha(pk, .7), [3, 3]); P.dot(p.T0f, (LIQX.water.V(p.T0f) / LIQX.water.V(4) - 1) * 1e4, 4.5, gr, th['ink-950']); P.dot(p.Tb, (LIQX.water.V(Math.min(30, p.Tb)) / LIQX.water.V(4) - 1) * 1e4, 4.5, am, th['ink-950']); });
            P.tag(4, 1.5, 'densest at 3.98 °C', pk, 'left', -8);
            P.tag(29, (LIQX.water.V(29) / LIQX.water.V(4) - 1) * 1e4, 'water (Tilton & Taylor)', cy, 'right', -8);
            void hg; void et;
            return;
          }
          if (p.mode === 'expand') {
            const rods = ['steel', 'brass', 'aluminium', 'invar'], cols = [cy, am, pk, gr];
            const P = g.Plot({ xmin: -10, xmax: 50, ymin: -35, ymax: 35, xlabel: 'room temperature (°C)', ylabel: 's lost per day', xfmt: v => v.toFixed(0), yfmt: v => v.toFixed(0) }).frame();
            P.clip(() => { P.hline(0, g.alpha(th['text-3'], .7)); P.vline(20, g.alpha(th['text-3'], .5), [3, 3]);
              rods.forEach((r, i) => P.line([[-10, 0.5 * MAT[r].a * -30 * 86400], [50, 0.5 * MAT[r].a * 30 * 86400]], cols[i], r === p.rod ? 2.4 : 1.2));
              P.dot(p.Tc, S.Ck.lost, 5.5, '#FFFFFF', th['ink-950']); });
            rods.forEach((r, i) => P.tag(49, 0.5 * MAT[r].a * 30 * 86400, r, cols[i], 'right', -8));
            return;
          }
          if (p.mode === 'conduct' && p.csub === 'ingen') {
            const Cd = S.Cd, keys = Object.keys(MAT).filter(k => k !== 'glass'), cols = [cy, am, pk];
            const P = g.Plot({ xmin: 0, xmax: 420, ymin: 0, ymax: Math.max(...Cd.lens) * Math.max(...Cd.lens) * 1e4 * 1.25, xlabel: 'K (W/m·K)', ylabel: 'melted length² (cm²)', xfmt: v => v.toFixed(0), yfmt: v => v.toFixed(0) }).frame();
            const s = Cd.lens[0] * Cd.lens[0] * 1e4 / Cd.mats[0].K;
            P.clip(() => { P.line([[0, 0], [420, s * 420]], g.alpha(th['text-2'], .7), 1.2, [5, 3]); Cd.mats.forEach((M, i) => P.dot(M.K, Cd.lens[i] * Cd.lens[i] * 1e4, 6, cols[i], th['ink-950'])); });
            Cd.mats.forEach((M, i) => P.tag(M.K, Cd.lens[i] * Cd.lens[i] * 1e4, M.name + ' ' + (Cd.lens[i] * 100).toFixed(2) + ' cm', cols[i], 'left', 12));
            void keys;
            return;
          }
          if (p.mode === 'conduct') {
            const Cd = S.Cd, now = condNow(S), n = Cd.rods[0].flux.length, pts = [];
            for (let i = 0; i < n; i++) pts.push([Cd.rods[0].flux[i][0] / 60, Cd.rods.reduce((u, R) => u + R.flux[i][2], 0) * RODA]);
            const hi = Math.max(Cd.Hf, ...pts.map(q => q[1])) * 1.15;
            const P = g.Plot({ xmin: 0, xmax: Cd.tEnd / 60, ymin: 0, ymax: hi, xlabel: 'time (min)', ylabel: 'heat into the ice (W)', xfmt: v => v.toFixed(0), yfmt: v => v.toFixed(1) }).frame();
            P.clip(() => { P.hline(Cd.Hf, g.alpha(pk, .8), [4, 3]); P.line(pts, gr, 2.2); P.vline(now.t / 60, g.alpha(am, .7), [3, 3]); });
            P.tag(Cd.tEnd / 60 * 0.98, Cd.Hf, 'ΔT/ΣR = ' + Cd.Hf.toFixed(3) + ' W', pk, 'right', -8);
            return;
          }
          if (p.rsub === 'spectrum') {
            const P = g.Plot({ xmin: Math.log10(300), xmax: Math.log10(20000), ymin: 2, ymax: 10.5, xlabel: 'log₁₀ T (K)', ylabel: 'log₁₀ P (W/m²)', xfmt: v => v.toFixed(1), yfmt: v => v.toFixed(0) }).frame();
            const meas = [500, 1000, 2000, 4000, 8000, 16000].map(T => { const r = runSpec({ Tbb: T }); return [Math.log10(T), Math.log10(r.P)]; });
            P.clip(() => { P.line([[Math.log10(300), Math.log10(SIG * Math.pow(300, 4))], [Math.log10(20000), Math.log10(SIG * Math.pow(20000, 4))]], g.alpha(th['text-2'], .7), 1.2, [5, 3]); meas.forEach(q => P.dot(q[0], q[1], 4, cy)); P.dot(Math.log10(S.Sp.T), Math.log10(S.Sp.P), 6, am, th['ink-950']); });
            P.tag(Math.log10(600), 9.5, 'dots: integrated spectra · dashed: σT⁴, slope 4', th['text-2'], 'left', 0);
            return;
          }
          const Co = S.Co, pa = [], pb = [];
          for (let i = 1; i < Co.out.length; i++) { const o0 = Co.out[i - 1], o1 = Co.out[i], dt = o1[0] - o0[0];
            pa.push([(o0[1] + o1[1]) / 2 - p.Tenv, -(o1[1] - o0[1]) / dt * 60]); pb.push([(o0[2] + o1[2]) / 2 - p.Tenv, -(o1[2] - o0[2]) / dt * 60]); }
          const hi = Math.max(...pa.map(q => q[1])) * 1.1;
          const P = g.Plot({ xmin: 0, xmax: p.T0c - p.Tenv, ymin: 0, ymax: hi, xlabel: 'T − T_room (K)', ylabel: 'cooling rate (K/min)', xfmt: v => v.toFixed(0), yfmt: v => v.toFixed(1) }).frame();
          const sl = pb[pb.length - 1][1] / pb[pb.length - 1][0];
          P.clip(() => { P.line(pa, '#9AA3B8', 2.2); P.line(pb, am, 2.2); P.line([[0, 0], [p.T0c - p.Tenv, sl * (p.T0c - p.Tenv)]], g.alpha(th['text-2'], .6), 1.2, [5, 3]); });
          P.tag((p.T0c - p.Tenv) * 0.98, pa[0][1], 'black: curves up (T⁴)', '#9AA3B8', 'right', 10);
          P.tag((p.T0c - p.Tenv) * 0.98, sl * (p.T0c - p.Tenv), 'Newton: a straight line', th['text-2'], 'right', -8);
        } }
    ],

    readouts(S) {
      const p = S.p;
      if (p.mode === 'calor') {
        const Ca = S.Ca, st = Ca.at(clamp(S.ts / 20, 0, 1) * Ca.tEnd);
        return [
          { label: 'Water now', value: st[1].toFixed(2), unit: '°C', flag: 'accent' },
          { label: Ca.add === 'ice' ? 'Ice now' : Ca.add === 'steam' ? 'Steam now' : 'Metal now', value: st[2].toFixed(2), unit: '°C' },
          { label: 'Final (integrated)', value: Ca.Tf.toFixed(2), unit: '°C' },
          { label: 'Final (energy balance)', value: (Math.abs(Ca.TfEq) < 0.005 ? 0 : Ca.TfEq).toFixed(2), unit: '°C', flag: 'ok' },
          { label: Ca.add === 'ice' ? 'Ice left' : 'Settles after', value: Ca.add === 'ice' ? (Ca.iceLeft * 1000).toFixed(1) : (Ca.tSet / 60).toFixed(1), unit: Ca.add === 'ice' ? 'g' : 'min' }
        ];
      }
      if (p.mode === 'expand') {
        if (p.esub === 'bimetal') { const Bm = S.Bm; return [
          { label: 'Tip deflection', value: (Bm.tip * 1000).toFixed(3), unit: 'mm', flag: 'accent' },
          { label: 'Radius of curvature', value: Math.abs(Bm.R) > 1e3 ? '∞' : Math.abs(Bm.R * 100).toFixed(2), unit: 'cm' },
          { label: 'Δα', value: ((Bm.A.a - Bm.B.a) * 1e6).toFixed(1), unit: '× 10⁻⁶ /K' },
          { label: 'Contact', value: Bm.open ? 'closed' : 'open', unit: '', flag: Bm.open ? 'warn' : undefined } ]; }
        if (p.esub === 'flask') { const Fk = S.Fk; return [
          { label: 'First dip', value: (Fk.minH * 1000).toFixed(2), unit: 'mm', flag: 'warn' },
          { label: 'Final change', value: (Fk.hEnd * 1000).toFixed(2), unit: 'mm', flag: 'accent' },
          { label: 'γ apparent', value: (Fk.gApp * 1e6).toFixed(1), unit: '× 10⁻⁶ /K' },
          { label: 'γ real', value: (Fk.gReal * 1e6).toFixed(1), unit: '× 10⁻⁶ /K' } ]; }
        const Ck = S.Ck; return [
          { label: 'Lost per day (counted)', value: Ck.lost.toFixed(3), unit: 's', flag: 'accent' },
          { label: '½αΔT × 86 400', value: Ck.formula.toFixed(3), unit: 's' },
          { label: 'Period at ' + p.Tc.toFixed(0) + ' °C', value: Ck.Ttest.toFixed(6), unit: 's' },
          { label: 'Rod α', value: (Ck.al * 1e6).toFixed(1), unit: '× 10⁻⁶ /K' } ];
      }
      if (p.mode === 'conduct') {
        const Cd = S.Cd;
        if (Cd.kind === 'ingen') return Cd.mats.map((M, i) => ({ label: M.name + ' melted', value: (Cd.lens[i] * 100).toFixed(2), unit: 'cm', flag: i === 0 ? 'accent' : undefined }))
          .concat([{ label: 'l₁²/l₃²  vs  K₁/K₃', value: (Cd.lens[0] * Cd.lens[0] / (Cd.lens[2] * Cd.lens[2])).toFixed(2) + ' vs ' + (Cd.mats[0].K / Cd.mats[2].K).toFixed(2), unit: '' }]);
        return [
          { label: 'Heat current (steady)', value: Cd.H.toFixed(4), unit: 'W', flag: 'accent' },
          { label: 'Formula', value: Cd.Hf.toFixed(4), unit: 'W' },
          { label: 'Ice melted', value: Cd.melt.toFixed(3), unit: 'g/min' },
          { label: Cd.kind === 'series' ? 'Junction' : 'Rods', value: Cd.kind === 'series' ? Cd.Tj.toFixed(3) : '2', unit: Cd.kind === 'series' ? '°C' : '' }
        ];
      }
      if (p.rsub === 'spectrum') { const Sp = S.Sp; return [
        { label: 'λ_max (found)', value: (Sp.lmax * 1e9).toFixed(1), unit: 'nm', flag: 'accent' },
        { label: 'λ_max T', value: (Sp.b * 1e3).toFixed(4), unit: 'mm·K' },
        { label: 'Power (integrated)', value: Sp.P.toExponential(3), unit: 'W/m²' },
        { label: 'P/T⁴', value: (Sp.sigma * 1e8).toFixed(4), unit: '× 10⁻⁸' },
        { label: 'Visible fraction', value: (Sp.vis * 100).toFixed(1), unit: '%' } ]; }
      const Co = S.Co, st = Co.at(clamp(S.ts / 20, 0, 1) * Co.tEnd);
      return [
        { label: 'Black sphere', value: st[1].toFixed(2), unit: '°C', flag: 'accent' },
        { label: 'Polished sphere', value: st[2].toFixed(2), unit: '°C' },
        { label: '80→70 · 70→60 (black)', value: (Co.t1 / 60).toFixed(2) + ' · ' + (Co.t2 / 60).toFixed(2), unit: 'min' },
        { label: '80→70 · 70→60 (polished)', value: (Co.t1p / 60).toFixed(2) + ' · ' + (Co.t2p / 60).toFixed(2), unit: 'min' }
      ];
    },

    equation(S) {
      const p = S.p;
      if (p.mode === 'calor') return 'Σ ' + E.v('m') + 'Δ' + E.v('h') + ' ' + E.op('=') + ' 0 · ' + E.v('h') + ' ' + E.op('=') + ' ' + E.v('c') + E.v('T') + ' ' + E.op('+') + ' ' + E.v('L') + ' at each phase change → ' + E.v('T') + E.sub('f') + ' ' + E.op('=') + ' ' + E.n(S.Ca.TfEq, '°C');
      if (p.mode === 'expand') {
        if (p.esub === 'bimetal') return E.frac('1', E.v('R')) + ' ' + E.op('≈') + ' ' + E.frac('3(α₁ ' + E.op('−') + ' α₂)Δ' + E.v('T'), '2' + E.v('t')) + ' · ' + E.v('R') + ' ' + E.op('=') + ' ' + E.n(Math.abs(S.Bm.R * 100), 'cm');
        if (p.esub === 'flask') return 'γ' + E.sub('apparent') + ' ' + E.op('=') + ' γ' + E.sub('real') + ' ' + E.op('−') + ' 3α' + E.sub('glass') + ' ' + E.op('=') + ' ' + E.n(S.Fk.gApp * 1e6, '× 10⁻⁶ /K');
        return 'Δ' + E.v('t') + ' ' + E.op('=') + ' ½αΔ' + E.v('T') + ' × 86 400 s ' + E.op('=') + ' ' + E.n(S.Ck.lost, 's per day');
      }
      if (p.mode === 'conduct') return S.Cd.kind === 'ingen' ? E.v('l') + ' ∝ √' + E.v('K') + ' · ' + E.frac(E.v('l') + '₁²', E.v('l') + '₂²') + ' ' + E.op('=') + ' ' + E.frac(E.v('K') + '₁', E.v('K') + '₂')
        : E.v('H') + ' ' + E.op('=') + ' ' + E.frac('Δ' + E.v('T'), 'Σ ' + E.v('L') + '/' + E.v('KA')) + ' ' + E.op('=') + ' ' + E.n(S.Cd.H, 'W');
      if (p.rsub === 'spectrum') return 'λ' + E.sub('max') + E.v('T') + ' ' + E.op('=') + ' ' + E.v('b') + ' · ' + E.v('P') + ' ' + E.op('=') + ' σ' + E.v('T') + '⁴ ' + E.op('=') + ' ' + E.n(S.Sp.P, 'W/m²');
      return E.v('mc') + E.frac(E.v('dT'), E.v('dt')) + ' ' + E.op('=') + ' ' + E.op('−') + 'εσ' + E.v('A') + '(' + E.v('T') + '⁴ ' + E.op('−') + ' ' + E.v('T') + '₀⁴) ' + E.op('−') + ' ' + E.v('hA') + '(' + E.v('T') + ' ' + E.op('−') + ' ' + E.v('T') + '₀)';
    },

    eqNote: '<b>Each textbook result here is a limit.</b> "Heat lost = heat gained" is the calorimeter after it has settled, with nothing ' +
      'leaking out; unlag it and the balance fails by exactly what the room took. l ∝ √K in Ingen-Hausz holds for rods long compared with ' +
      '√(KA/hP); a short copper rod warms to its end and the ratio drifts. Newton\'s law of cooling is the small-ΔT limit of εσ(T⁴ − T₀⁴) + ' +
      'h(T − T₀): the black sphere\'s rate curve bends away from the straight line. Wien\'s b and Stefan\'s σ are what the spectrum gives ' +
      'when you look for its peak and add it up.',

    problems: [
      { source: 'JEE Main pattern · does all the ice melt?',
        q: '100 g of ice at −10 °C is put into 200 g of water at 30 °C in a 100 g copper calorimeter (c = 385 J/kg·K). How many grams of ice are left when it settles? (c_ice 2100, c_w 4186 J/kg·K, L_f 334 kJ/kg)',
        params: { mode: 'calor', add: 'ice', mw: 200, mcal: 100, madd: 100, Tw: 30, Tice: -10, lag: true },
        predict: { label: 'ice left', unit: 'g', tol: 0.01 },
        measure: S => S.Ca.iceLeft * 1000,
        working: 'Available from water and cup cooling to 0 °C: (0.2 × 4186 + 0.1 × 385) × 30 = 26 271 J. Needed to warm the ice to 0 °C: 2100 J, leaving 24 171 J to melt 24 171/334 000 = 72.4 g. ' +
          'So <b>27.6 g</b> stays frozen and everything sits at 0 °C. Assuming it all melts gives a final temperature below zero, which is impossible.' },
      { source: 'JEE Main pattern · steam into water',
        q: '10 g of steam at 100 °C is passed into 200 g of water at 20 °C in a 100 g copper calorimeter. Find the final temperature, in °C. (L_v = 2256 kJ/kg)',
        params: { mode: 'calor', add: 'steam', mw: 200, mcal: 100, madd: 10, Tw: 20, lag: true },
        predict: { label: 'final temperature', unit: '°C', tol: 0.01 },
        measure: S => S.Ca.Tf,
        working: '0.01[2 256 000 + 4186(100 − T)] = (0.2 × 4186 + 38.5)(T − 20). 22 560 + 41.86(100 − T) = 875.7(T − 20), so T = <b>48.2 °C</b>. ' +
          'Ten grams of steam warms 200 g of water by 28 K; most of it is the latent heat.' },
      { source: 'NEET pattern · method of mixtures',
        q: '200 g of aluminium (c = 900 J/kg·K) at 100 °C is dropped into 150 g of water at 20 °C in a 100 g copper calorimeter. Find the final temperature, in °C.',
        params: { mode: 'calor', add: 'metal', metal: 'aluminium', mw: 150, mcal: 100, madd: 200, Tw: 20, Tm: 100, lag: true },
        predict: { label: 'final temperature', unit: '°C', tol: 0.01 },
        measure: S => S.Ca.Tf,
        working: '0.2 × 900 × (100 − T) = (0.15 × 4186 + 0.1 × 385)(T − 20): 180(100 − T) = 666.4(T − 20), T = <b>37.0 °C</b>. ' +
          'Unlag the cup and the reading is lower: the room took some of it. That is why the method needs a cooling correction.' },
      { source: 'JEE Advanced pattern · bimetallic strip',
        q: 'A brass–invar strip (Δα = 17.8 × 10⁻⁶ /K), 1.0 mm thick with equal layers, is heated by 100 K. Using 1/R = 3ΔαΔT/2t, find its radius of curvature, in cm.',
        params: { mode: 'expand', esub: 'bimetal', m1: 'brass', m2: 'invar', tb: 1, Lb: 10, dT: 100, gap: 5 },
        predict: { label: 'R', unit: 'cm', tol: 0.012 },
        measure: S => Math.abs(S.Bm.R * 100),
        working: '1/R = 3 × 17.8 × 10⁻⁶ × 100/(2 × 10⁻³) = 2.67 /m, R = <b>37.5 cm</b>. With the two moduli included (Timoshenko) the lab gets 37.7 cm; the textbook form assumes equal stiffness. ' +
          'Brass, which expands more, ends up on the outside of the curve.' },
      { source: 'JEE Main pattern · pendulum clock',
        q: 'A clock with a steel pendulum rod (α = 1.2 × 10⁻⁵ /K) keeps correct time at 20 °C. How many seconds does it lose in a day at 40 °C?',
        params: { mode: 'expand', esub: 'clock', rod: 'steel', Tc: 40 },
        predict: { label: 'lost', unit: 's', tol: 0.01 },
        measure: S => S.Ck.lost,
        working: 'T ∝ √L, so ΔT_period/T = ½αΔθ. Loss per day = ½ × 1.2 × 10⁻⁵ × 20 × 86 400 = <b>10.37 s</b>. The two integrated pendulums differ by 10.366 s at midnight.' },
      { source: 'JEE Advanced pattern · apparent expansion',
        q: 'Water\'s mean real expansivity between 20 and 80 °C is 4.55 × 10⁻⁴ /K. In soda glass (α = 9 × 10⁻⁶ /K), what apparent expansivity does the neck of a flask show, in units of 10⁻⁴ /K?',
        params: { mode: 'expand', esub: 'flask', fliq: 'water', pyrex: false, T0f: 20, Tb: 80 },
        predict: { label: 'γ apparent', unit: '× 10⁻⁴ /K', tol: 0.01 },
        measure: S => S.Fk.gApp * 1e4,
        working: 'The bulb grows too, by 3α per kelvin: γ_app = γ_real − 3α_glass = 4.55 − 0.27 = <b>4.28 × 10⁻⁴ /K</b>. Early on the level falls instead, because the glass is heated before the water.' },
      { source: 'JEE Main pattern · rods in series',
        q: 'A copper rod and a steel rod, each 20 cm long and of the same cross-section, are joined end to end. The free copper end is at 100 °C, the free steel end at 0 °C. Find the junction temperature, in °C. (K: 401 and 50 W/m·K)',
        params: { mode: 'conduct', csub: 'series', r1: 'copper', r2: 'steel', L1: 20, L2: 20 },
        predict: { label: 'junction', unit: '°C', tol: 0.005 },
        measure: S => S.Cd.Tj,
        working: 'The same heat current crosses both: 401(100 − T)/0.2 = 50(T − 0)/0.2, so T = 40 100/451 = <b>88.9 °C</b>. Almost all the drop is across the steel, the poor conductor, like a large resistor in series.' },
      { source: 'JEE Main pattern · melting ice by conduction',
        q: 'For the same copper–steel rod, 2 cm in diameter, with the cold end in ice, how many grams of ice melt per minute?',
        params: { mode: 'conduct', csub: 'series', r1: 'copper', r2: 'steel', L1: 20, L2: 20 },
        predict: { label: 'melting rate', unit: 'g/min', tol: 0.01 },
        measure: S => S.Cd.melt,
        working: 'R = L₁/K₁A + L₂/K₂A = (0.2/401 + 0.2/50)/3.142 × 10⁻⁴ = 14.32 K/W; H = 100/14.32 = 6.98 W. In a minute: 419 J/334 J/g = <b>1.25 g</b>.' },
      { source: 'JEE Advanced pattern · Ingen-Hausz',
        q: 'Wax melts 17.1 cm along a copper rod (K = 401) in an Ingen-Hausz apparatus. How far does it melt along an identical iron rod (K = 80), in cm?',
        params: { mode: 'conduct', csub: 'ingen', r1: 'copper', r2: 'aluminium', r3: 'iron' },
        predict: { label: 'length', unit: 'cm', tol: 0.02 },
        measure: S => S.Cd.lens[2] * 100,
        working: 'At steady state l ∝ √K: l_Fe = 17.1 × √(80/401) = <b>7.6 cm</b>. The lab gets 7.55 cm; the small difference is because the copper rod is not quite "long" (its heat reaches a noticeable way toward the end).' },
      { source: 'JEE Main pattern · Wien\'s law',
        q: 'The Sun\'s surface is at 5778 K. At what wavelength does its spectrum peak, in nm? (b = 2.898 × 10⁻³ m·K)',
        params: { mode: 'radiate', rsub: 'spectrum', Tbb: 5778 },
        predict: { label: 'λ_max', unit: 'nm', tol: 0.005 },
        measure: S => S.Sp.lmax * 1e9,
        working: 'λ_max = b/T = 2.898 × 10⁻³/5778 = <b>501.5 nm</b>, blue-green, yet the Sun looks white: the curve is broad and covers the whole visible band.' },
      { source: 'JEE Main pattern · Stefan\'s law',
        q: 'A tungsten filament at 2800 K radiates as a black body. How much power does each square metre emit, in MW?',
        params: { mode: 'radiate', rsub: 'spectrum', Tbb: 2800 },
        predict: { label: 'power', unit: 'MW/m²', tol: 0.01 },
        measure: S => S.Sp.P / 1e6,
        working: 'P = σT⁴ = 5.67 × 10⁻⁸ × 2800⁴ = <b>3.49 MW/m²</b>. Only 5% of it is visible light: an incandescent lamp is mostly a heater.' },
      { source: 'JEE Main pattern · Newton\'s law of cooling',
        q: 'The polished sphere (room at 20 °C) cools from 80 °C to 70 °C in 16.44 min. Using Newton\'s law in its average-temperature form, how long will it take to cool from 70 °C to 60 °C, in min?',
        params: { mode: 'radiate', rsub: 'cool', rs: 3, Tenv: 20, T0c: 90, conv: true },
        predict: { label: 'time', unit: 'min', tol: 0.02 },
        measure: S => S.Co.t2p / 60,
        working: '10/16.44 = k(75 − 20) and 10/t = k(65 − 20), so t = 16.44 × 55/45 = <b>20.1 min</b>. The integrated sphere takes 20.18 min. For the BLACK sphere the same estimate misses by 3%: its loss is mostly εσT⁴, which is not linear in ΔT.' }
    ],

    walkthrough: [
      { title: '1 · Does all the ice melt?',
        body: '100 g of ice at −10 °C into 200 g of water at 30 °C. Watch both temperatures.',
        ask: 'The water falls to 0 °C and stops falling. Why?',
        reveal: '<b>It has run out of heat to give.</b> The water can supply 26 kJ before it reaches 0 °C; the ice needs 35.5 kJ to melt entirely. So 27.6 g stays frozen and the mixture sits on the 0 °C shelf, and a textbook-style balance that assumes all of it melts would give a negative answer.',
        params: { mode: 'calor', add: 'ice', mw: 200, mcal: 100, madd: 100, Tw: 30, Tice: -10, lag: true } },
      { title: '2 · A little steam goes a long way',
        body: '10 g of steam into 200 g of water at 20 °C.',
        ask: 'Which heats the water more: the steam condensing, or the condensed water cooling?',
        reveal: '<b>Condensing, by far:</b> 22.6 kJ from the latent heat against 2.2 kJ from cooling the condensate. That is why steam burns are worse than boiling-water burns.',
        params: { mode: 'calor', add: 'steam', mw: 200, mcal: 100, madd: 10, Tw: 20, lag: true } },
      { title: '3 · A bimetallic strip',
        body: 'Brass on invar, heated by 100 K. Then cool it.',
        ask: 'Which way does it bend?',
        reveal: '<b>Toward the invar.</b> Brass expands more, so it has to be on the longer, outside curve. Cooled, it bends the other way. Put a contact in its path and you have a thermostat or a fire alarm.',
        params: { mode: 'expand', esub: 'bimetal', m1: 'brass', m2: 'invar', tb: 1, Lb: 10, dT: 100, gap: 5 } },
      { title: '4 · A flask in a hot bath',
        body: 'Watch the neck in the first few seconds.',
        ask: 'Heating makes water expand. Why does the level go DOWN first?',
        reveal: '<b>The glass warms first.</b> The thin wall reaches the bath temperature in seconds and the bulb gets bigger; the water takes a minute or more. What the neck shows in the end is the apparent expansion, γ_real − 3α_glass.',
        params: { mode: 'expand', esub: 'flask', fliq: 'water', pyrex: false, T0f: 20, Tb: 80 } },
      { title: '5 · A clock on a hot day',
        body: 'Steel pendulum rod, room at 40 °C instead of 20 °C.',
        ask: 'Does the clock gain or lose?',
        reveal: '<b>It loses:</b> a longer rod swings more slowly, T ∝ √L. By ½αΔT × 86 400 = 10.4 s a day. Invar cuts that tenfold, which is why it exists.',
        params: { mode: 'expand', esub: 'clock', rod: 'steel', Tc: 40 } },
      { title: '6 · Rods in series',
        body: 'Copper then steel between steam and ice.',
        ask: 'Where does most of the temperature drop happen?',
        reveal: '<b>In the steel</b>, 89 of the 100 degrees. Thermal resistances in series add like electrical ones, and the same current flows through both. Watch it switch on: the copper settles fast, the steel takes an hour.',
        params: { mode: 'conduct', csub: 'series', r1: 'copper', r2: 'steel', L1: 20, L2: 20 } },
      { title: '7 · Ingen-Hausz',
        body: 'Three wax-coated rods of copper, aluminium and iron, one end in boiling water.',
        ask: 'Copper conducts 5 times better than iron. Does the wax melt 5 times further along it?',
        reveal: '<b>No, only √5 ≈ 2.3 times.</b> Heat leaks from the sides as it travels; at steady state T falls as e^(−x√(hP/KA)), so the melted length goes as √K. l² ∝ K is the result the experiment measures.',
        params: { mode: 'conduct', csub: 'ingen', r1: 'copper', r2: 'aluminium', r3: 'iron' } },
      { title: '8 · Black body',
        body: 'Slide the temperature from a red-hot 1000 K to 20 000 K.',
        ask: 'Is the Sun (5778 K), whose peak is at 502 nm in the green, a green star?',
        reveal: '<b>No: white.</b> The spectrum is broad; at 5778 K it spreads across the whole visible band almost evenly, and the eye adds it up to white. The colour swatch is computed that way, from the CIE curves.',
        params: { mode: 'radiate', rsub: 'spectrum', Tbb: 5778 } }
    ],

    quiz: [
      { q: 'Ice at 0 °C is added to water at 20 °C and not all of it melts. The final temperature is:',
        options: ['0 °C', 'Below 0 °C', 'Between 0 and 20 °C', '4 °C'], answer: 0,
        why: 'As long as ice and water are both present at equilibrium, the temperature is the melting point. Leftover ice is the signal.' },
      { q: 'A bimetallic strip of brass and steel is COOLED. It bends so that:',
        options: ['Brass is on the inside (concave) side', 'Brass is on the outside', 'It stays straight', 'It twists'], answer: 0,
        why: 'Brass contracts more, so it becomes the shorter, inner side. Heated, brass is on the outside.' },
      { q: 'When a flask of liquid is put into hot water, the liquid level in the neck first:',
        options: ['Falls, then rises', 'Rises steadily', 'Stays put, then rises', 'Rises, then falls'], answer: 0,
        why: 'The glass warms first and the bulb enlarges. Only later does the liquid catch up and overtake it.' },
      { q: 'Water is heated from 0 °C to 10 °C. Its volume:',
        options: ['Decreases until 4 °C, then increases', 'Increases throughout', 'Decreases throughout', 'Stays the same'], answer: 0,
        why: 'Water is densest near 4 °C. This is why lakes freeze from the top.' },
      { q: 'Two rods of equal size, K₁ = 2K₂, are joined in series between 100 °C and 0 °C (rod 1 on the hot side). The junction is at:',
        options: ['66.7 °C', '50 °C', '33.3 °C', '75 °C'], answer: 0,
        why: 'Equal currents: 2(100 − T) = T, so T = 66.7 °C. The better conductor has the smaller drop.' },
      { q: 'In the Ingen-Hausz experiment, lengths of wax melted are in the ratio 1 : 2. The conductivities are in the ratio:',
        options: ['1 : 4', '1 : 2', '1 : √2', '2 : 1'], answer: 0,
        why: 'l ∝ √K, so K ∝ l². At steady state; during warm-up, the diffusivity decides instead.' },
      { q: 'The absolute temperature of a black body is doubled. Its total emitted power becomes:',
        options: ['16 times', '4 times', '2 times', '8 times'], answer: 0,
        why: 'P = σAT⁴. Wien: its peak wavelength halves.' },
      { q: 'A pendulum clock with a metal rod, correct at 20 °C, is taken to a colder place. It will:',
        options: ['Gain time', 'Lose time', 'Keep time', 'Stop'], answer: 0,
        why: 'The rod shortens, the period shortens, the clock runs fast. ½α|ΔT| × 86 400 s per day.' }
    ],

    notes: '<b>Where this shows up in the paper.</b><ul>' +
      '<li><b>Calorimetry</b>: heat lost = heat gained, including latent heats; always check whether all the ice melts or all the steam condenses before writing the final temperature.</li>' +
      '<li><b>Expansion</b>: ΔL = LαΔT, β = 2α, γ = 3α; thermal stress YαΔT in a clamped rod; bimetal 1/R ≈ 3ΔαΔT/2t; clocks lose ½αΔT per unit time; apparent γ = γ_real − γ_vessel; water\'s anomaly at 4 °C.</li>' +
      '<li><b>Conduction</b>: H = KAΔT/L; resistances L/KA add in series, conductances add in parallel; ice melted = Ht/L_f; Ingen-Hausz l² ∝ K.</li>' +
      '<li><b>Radiation</b>: P = εσAT⁴, net εσA(T⁴ − T₀⁴); Wien λ_max T = 2.898 × 10⁻³ m·K; good absorbers are good emitters (Kirchhoff); Newton\'s law for small ΔT, used in average-temperature form.</li></ul>' +
      '<div class="pyq"><em>Trap to avoid</em> — writing the calorimetry balance with a final temperature below 0 °C (or above 100 °C). If the answer is impossible, the phase change did not complete: the final temperature is the transition temperature and some solid (or vapour) remains.</div>' +
      '<div class="pyq"><em>Trap to avoid</em> — "Ingen-Hausz lengths are proportional to K". They go as √K, because the rod loses heat from its sides as it goes.</div>'
  });
})(window.InsightLab);
