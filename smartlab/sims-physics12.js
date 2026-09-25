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
    return a < 1e6 * YR ? (s / YR).toFixed(1) + ' yr' : (s / YR).toExponential(3) + ' yr';
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

  /* =========================================================================
     NUCLEI · the JEE Advanced additions
     · Decay series on the N–Z chart: every step applied by its rule (α: Z−2,
       A−4; β⁻: Z+1), so the counts of α and β are READ from the walk.
     · Rutherford scattering: α trajectories integrated in the Coulomb field
       (RK4, adaptive). In units of the head-on closest approach d₀ = 2kZe²/K
       the orbit equation is universal, so θ(b) is integrated once and every
       energy and every target scales from it. A Monte Carlo beam then fills
       the detector's angle bins.
     · Moderation: neutrons from 2 MeV scattered elastically, isotropically in
       the centre-of-mass frame, collision by collision, until thermal.
     · Carbon dating with the counts a real counter would give, so the age
       comes with its error bar and the method runs out at ~50 000 years.
     · An endothermic reaction and its threshold, with momentum conserved.
     ========================================================================= */
  const SERIES = {
    U238: { name: 'Uranium series (4n + 2)', steps: [
      ['U-238', 92, 238, 'a', 4.468e9 * YR], ['Th-234', 90, 234, 'b', 24.10 * DAY], ['Pa-234m', 91, 234, 'b', 1.17 * MIN],
      ['U-234', 92, 234, 'a', 2.455e5 * YR], ['Th-230', 90, 230, 'a', 7.54e4 * YR], ['Ra-226', 88, 226, 'a', 1600 * YR],
      ['Rn-222', 86, 222, 'a', 3.8235 * DAY], ['Po-218', 84, 218, 'a', 3.098 * MIN], ['Pb-214', 82, 214, 'b', 26.8 * MIN],
      ['Bi-214', 83, 214, 'b', 19.9 * MIN], ['Po-214', 84, 214, 'a', 164.3e-6], ['Pb-210', 82, 210, 'b', 22.2 * YR],
      ['Bi-210', 83, 210, 'b', 5.012 * DAY], ['Po-210', 84, 210, 'a', 138.376 * DAY], ['Pb-206', 82, 206, 's', Infinity]] },
    Th232: { name: 'Thorium series (4n)', steps: [
      ['Th-232', 90, 232, 'a', 1.405e10 * YR], ['Ra-228', 88, 228, 'b', 5.75 * YR], ['Ac-228', 89, 228, 'b', 6.15 * HR],
      ['Th-228', 90, 228, 'a', 1.912 * YR], ['Ra-224', 88, 224, 'a', 3.632 * DAY], ['Rn-220', 86, 220, 'a', 55.6],
      ['Po-216', 84, 216, 'a', 0.145], ['Pb-212', 82, 212, 'b', 10.64 * HR], ['Bi-212', 83, 212, 'b', 60.55 * MIN],
      ['Po-212', 84, 212, 'a', 0.299e-6], ['Pb-208', 82, 208, 's', Infinity]] },
    U235: { name: 'Actinium series (4n + 3)', steps: [
      ['U-235', 92, 235, 'a', 7.04e8 * YR], ['Th-231', 90, 231, 'b', 25.52 * HR], ['Pa-231', 91, 231, 'a', 3.276e4 * YR],
      ['Ac-227', 89, 227, 'b', 21.77 * YR], ['Th-227', 90, 227, 'a', 18.68 * DAY], ['Ra-223', 88, 223, 'a', 11.43 * DAY],
      ['Rn-219', 86, 219, 'a', 3.96], ['Po-215', 84, 215, 'a', 1.781e-3], ['Pb-211', 82, 211, 'b', 36.1 * MIN],
      ['Bi-211', 83, 211, 'a', 2.14 * MIN], ['Tl-207', 81, 207, 'b', 4.77 * MIN], ['Pb-207', 82, 207, 's', Infinity]] }
  };
  function runSeries(p) {
    const Sr = SERIES[p.ser], st = Sr.steps;
    // walk the chain applying only the decay rules, and check every landing against the table
    let Z = st[0][1], A = st[0][2], na = 0, nb = 0, ok = true;
    for (let i = 0; i < st.length - 1; i++) {
      if (st[i][3] === 'a') { Z -= 2; A -= 4; na++; } else { Z += 1; nb++; }
      if (Z !== st[i + 1][1] || A !== st[i + 1][2]) ok = false;
    }
    const dA = st[0][2] - A, dZ = st[0][1] - Z;
    // secular equilibrium: every member's activity equals the parent's, so its number is ∝ its half-life
    const par = st[0], eq = st.map(s => ({ id: s[0], N: isFinite(s[4]) ? s[4] / par[4] : NaN, gPerT: isFinite(s[4]) ? s[4] / par[4] * s[2] / par[2] * 1e6 : NaN }));
    return { Sr, st, na, nb, dA, dZ, ok, rule: { na: dA / 4, nb: 2 * (dA / 4) - dZ }, eq };
  }

  /* ---- Rutherford ---- */
  // integrate one orbit in units of d₀ (head-on closest approach) and v₀: a = ½ r̂ / r²
  function rOrbit(b, keep) {
    // start far out, with the speed energy conservation gives there (½v² + ½/r = ½ at infinity)
    const r0 = 3000, x0 = -Math.sqrt(r0 * r0 - b * b);
    let x = x0, y = b, vx = Math.sqrt(1 - 1 / r0), vy = 0, rmin = 1e9;
    const pts = keep ? [[x, y]] : null;
    const acc = (x, y) => { const r2 = x * x + y * y, r = Math.sqrt(r2), k = 0.5 / (r2 * r); return [k * x, k * y]; };
    for (let i = 0; i < 200000; i++) {
      const r = Math.hypot(x, y); rmin = Math.min(rmin, r);
      const h = Math.min(2, 0.01 * r + 1e-4);
      const a1 = acc(x, y), x2 = x + h / 2 * vx, y2 = y + h / 2 * vy, u2 = vx + h / 2 * a1[0], w2 = vy + h / 2 * a1[1];
      const a2 = acc(x2, y2), x3 = x + h / 2 * u2, y3 = y + h / 2 * w2, u3 = vx + h / 2 * a2[0], w3 = vy + h / 2 * a2[1];
      const a3 = acc(x3, y3), x4 = x + h * u3, y4 = y + h * w3, u4 = vx + h * a3[0], w4 = vy + h * a3[1];
      const a4 = acc(x4, y4);
      x += h / 6 * (vx + 2 * u2 + 2 * u3 + u4); y += h / 6 * (vy + 2 * w2 + 2 * w3 + w4);
      vx += h / 6 * (a1[0] + 2 * a2[0] + 2 * a3[0] + a4[0]); vy += h / 6 * (a1[1] + 2 * a2[1] + 2 * a3[1] + a4[1]);
      if (keep && Math.hypot(x, y) < 90) pts.push([x, y]);
      if (r > r0 && x * vx + y * vy > 0) break;
    }
    return { th: Math.atan2(vy, vx), rmin, pts, v: Math.hypot(vx, vy) };
  }
  let RTAB = null;
  function rTable() {
    if (RTAB) return RTAB;
    const bs = [0];
    for (let i = 0; i <= 160; i++) bs.push(0.002 * Math.pow(12 / 0.002, i / 160));
    RTAB = bs.map(b => { const o = rOrbit(b, false); return [b, Math.abs(o.th), o.rmin]; });
    return RTAB;
  }
  const RTGT = { Au: { name: 'gold', Z: 79, A: 197 }, Ag: { name: 'silver', Z: 47, A: 108 }, Cu: { name: 'copper', Z: 29, A: 63 }, Al: { name: 'aluminium', Z: 13, A: 27 } };
  function runRuth(p) {
    const T = RTGT[p.tgt], d0 = 2 * 1.43996 * T.Z / p.Ka;                 // fm
    const tab = rTable(), R = rng(21 + Math.round(p.seed));
    const thOf = b => { if (b <= tab[1][0]) return Math.PI; if (b >= tab[tab.length - 1][0]) return tab[tab.length - 1][1];
      let lo = 1, hi = tab.length - 1; while (hi - lo > 1) { const mid = (lo + hi) >> 1; if (tab[mid][0] < b) lo = mid; else hi = mid; }
      const f = (b - tab[lo][0]) / (tab[hi][0] - tab[lo][0]); return tab[lo][1] + f * (tab[hi][1] - tab[lo][1]); };
    // a uniform beam over a disc wide enough to reach 10°
    const bmax = 0.5 / Math.tan(5 * Math.PI / 180), N = 300000, bins = new Array(17).fill(0);
    for (let i = 0; i < N; i++) { const b = bmax * Math.sqrt(R()), th = thOf(b) * 180 / Math.PI; const k = Math.floor((th - 10) / 10); if (k >= 0 && k < 17) bins[k]++; }
    // Rutherford's prediction for each bin: the beam fraction between b(θ₀) and b(θ₁) is (cot²θ₀/2 − cot²θ₁/2)/cot²5°
    const cot2 = t => Math.pow(1 / Math.tan(t * Math.PI / 360), 2);
    const perSr = bins.map((c, k) => { const a0 = 10 + 10 * k, a1 = a0 + 10, sr = TAU * (Math.cos(a0 * Math.PI / 180) - Math.cos(a1 * Math.PI / 180));
      return [a0 + 5, c / sr, c, N * (cot2(a0) - cot2(a1)) / cot2(10) / sr]; });
    const ruthF = th => 1 / Math.pow(Math.sin(th * Math.PI / 360), 4);
    const norm = 1;
    const rNuc = 1.2 * (Math.cbrt(T.A) + Math.cbrt(4));                     // touching radius, fm
    const shown = [0, 0.08, 0.2, 0.35, 0.5, 0.8, 1.2, 1.8, 2.8, 4.5, -0.08, -0.2, -0.35, -0.5, -0.8, -1.2, -1.8, -2.8, -4.5].map(b => ({ b, o: rOrbit(Math.abs(b), true), s: Math.sign(b) || 1 }));
    const head = tab[0];
    return { T, d0, K: p.Ka, tab, bins, perSr, norm, ruthF, rNuc, reaches: d0 < rNuc, shown, dmin: head[2] * d0, N, bmax,
             bOf: th => 0.5 * d0 / Math.tan(th * Math.PI / 360), thOf: b => thOf(b / d0) * 180 / Math.PI };
  }

  /* ---- moderation ---- */
  const MODER = {
    H: { name: 'hydrogen (as in water)', A: 1, lam: 0.7, col: '#6FB8FF' },
    D: { name: 'deuterium (heavy water)', A: 2, lam: 2.9, col: '#8FD0FF' },
    C: { name: 'carbon (graphite)', A: 12, lam: 2.6, col: '#5A6070' },
    Pb: { name: 'lead', A: 207, lam: 2.8, col: '#7C8594' }
  };
  function runModer(p) {
    const M = MODER[p.mod], A = M.A, al = Math.pow((A - 1) / (A + 1), 2), R = rng(31 + Math.round(p.seed));
    const E0 = 2e6, Et = 0.025, n = A > 100 ? 400 : 1500, counts = [], paths = [];
    let r2 = 0;
    for (let i = 0; i < n; i++) {
      let E = E0, c = 0, pos = [0, 0, 0], u = isoDir(R);
      const keep = i < 10, path = keep ? [{ p: pos.slice(), E }] : null;
      while (E > Et && c < 20000) {
        const s = -Math.log(1 - R()) * M.lam;
        pos = [pos[0] + u[0] * s, pos[1] + u[1] * s, pos[2] + u[2] * s];
        const mu = 2 * R() - 1;                                             // isotropic in the CM frame
        E = E * (A * A + 2 * A * mu + 1) / ((A + 1) * (A + 1));
        const cosL = (1 + A * mu) / Math.sqrt(A * A + 2 * A * mu + 1);       // the lab-frame turn
        u = turn(u, cosL, TAU * R());
        c++;
        if (keep) path.push({ p: pos.slice(), E });
      }
      counts.push(c); r2 += pos[0] * pos[0] + pos[1] * pos[1] + pos[2] * pos[2];
      if (keep) paths.push(path);
    }
    const mean = counts.reduce((u, v) => u + v, 0) / n;
    const xi = A === 1 ? 1 : 1 + al * Math.log(al) / (1 - al);
    return { M, A, al, xi, mean, formula: Math.log(E0 / Et) / xi, headOn: 4 * A / Math.pow(1 + A, 2), avgLoss: (1 - al) / 2,
             paths, rms: Math.sqrt(r2 / n), counts, E0, Et, n };
  }
  function turn(u, c, phi) {
    const s = Math.sqrt(Math.max(0, 1 - c * c));
    const a = Math.abs(u[2]) < 0.9 ? [0, 0, 1] : [1, 0, 0];
    let e1 = [u[1] * a[2] - u[2] * a[1], u[2] * a[0] - u[0] * a[2], u[0] * a[1] - u[1] * a[0]];
    const l = Math.hypot(...e1); e1 = e1.map(v => v / l);
    const e2 = [u[1] * e1[2] - u[2] * e1[1], u[2] * e1[0] - u[0] * e1[2], u[0] * e1[1] - u[1] * e1[0]];
    return [0, 1, 2].map(k => u[k] * c + s * (Math.cos(phi) * e1[k] + Math.sin(phi) * e2[k]));
  }

  /* ---- carbon dating ---- */
  const C14 = { T: 5730 * YR, A0: 0.255, eff: 0.95 };                      // living carbon: 0.255 Bq per gram (15.3 per minute)
  function runDating(p) {
    const R = rng(41 + Math.round(p.seed)), tc = p.tcnt * HR, lam = LN2 / C14.T;
    const A = C14.A0 * Math.exp(-lam * p.age * YR) * p.mC, bgr = p.bgc / 60;
    const C = poisson(R, (A * C14.eff + bgr) * tc), Cb = poisson(R, bgr * tc);
    const net = (C - Cb) / tc / C14.eff, sig = Math.sqrt(C + Cb) / tc / C14.eff;
    const Aliving = C14.A0 * p.mC;
    const ok = net > 2 * sig;
    const age = ok ? Math.log(Aliving / net) / lam / YR : NaN;
    const sAge = ok ? sig / net / lam / YR : NaN;
    const limit = Math.log(Aliving / Math.max(1e-12, 2 * Math.sqrt(2 * bgr * tc) / tc / C14.eff)) / lam / YR;   // where the signal sinks to 2σ of background
    const sigAt = a => { const Aa = C14.A0 * Math.exp(-lam * a * YR) * p.mC; const s = Math.sqrt((Aa * C14.eff + 2 * bgr) * tc) / tc / C14.eff; return s / Aa / lam / YR; };
    return { C, Cb, net, sig, age, sAge, ok, limit, A, Aliving, tc, sigAt, trueAge: p.age };
  }

  /* ---- an endothermic reaction ---- */
  NUC.push({ id: 'H-1', Z: 1, A: 1, D: DH, B: 0, BA: 0 }, { id: 'O-17', Z: 8, A: 17, D: -0.80876, B: 8 * DH + 9 * DN + 0.80876 });
  NUC.forEach(n => { n.BA = n.B / n.A; NBY[n.id] = n; });
  RXN.thresh = { name: '¹⁴N + α → ¹⁷O + p', lhs: ['N-14', 'He-4'], rhs: ['O-17', 'H-1'] };
  function threshold(p) {
    const Rx = reaction('thresh'), mA = 4 + NBY['He-4'].D / U_MEV, mN = 14 + NBY['N-14'].D / U_MEV;
    const Kth = -Rx.Q * (1 + mA / mN), Kcm = p.Kth * mN / (mN + mA), go = Kcm >= -Rx.Q;
    return { Rx, Q: Rx.Q, Kth, Kcm, go, spare: Kcm + Rx.Q, lostToCM: p.Kth - Kcm, mA, mN };
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
    if (p.bsub === 'thresh') {
      const Th = threshold(p), Nn = cluster(S, 'N-14', 7, 14), He = cluster(S, 'He-4', 2, 4), O = cluster(S, 'O-17', 8, 17), sp = sprite(PCOL);
      const ph = (S.ts % 7) / 7, vcm = Th.mA / (Th.mA + Th.mN);                  // the centre of mass drifts at m_α/(m_α+M) of the α's speed
      if (ph < 0.35) { const s = ph / 0.35; pushNucleus(list, Nn, [0.4 * vcm * s, 0, 0], 0); pushNucleus(list, He, [-1.6 + 1.9 * s, 0, 0], 0); }
      else if (!Th.go) {
        const s = (ph - 0.35) / 0.65;                                            // elastic: in the CM frame the α just turns round
        pushNucleus(list, Nn, [0.4 * vcm + 0.9 * vcm * 2 * s, 0, 0], 0); pushNucleus(list, He, [0.3 - 0.9 * (1 - 2 * vcm) * s, 0, 0], 0);
        R3.label(F, [0, 0, 0.6], 'not enough energy in the CM frame: it bounces', '#FF8FB0', { size: 10.5 });
      } else {
        const s = (ph - 0.35) / 0.65;
        pushNucleus(list, O, [0.4 * vcm + 0.9 * s * 0.8, -0.35 * s, 0], 0);
        list.push([0.4 * vcm + 2.2 * s, 0.9 * s, 0, 0.95 * FM, sp]);
        R3.label(F, [0.4 * vcm + 0.9 * s * 0.8, -0.35 * s, 0.4], 'O-17', '#FFB0B0', { size: 10 });
        R3.label(F, [0.4 * vcm + 2.2 * s, 0.9 * s, 0.2], 'p', '#FFB0B0', { size: 10 });
      }
      ballCloud(F, list, c0, 0);
      F.render();
      header(g, Th.Rx.X.name + ' · an α of ' + p.Kth.toFixed(2) + ' MeV',
        'Q = ' + Th.Q.toFixed(3) + ' MeV (from masses): the reaction must be GIVEN energy · but only the energy in the centre-of-mass frame can pay for it',
        'K_th = −Q(1 + m_α/M_N) = ' + Th.Kth.toFixed(3) + ' MeV — the rest is the kinetic energy the products must keep to conserve momentum', th.text);
      const row = gPanel(g, 12, H - bh - 30, bw, bh, 'THRESHOLD, FROM MASSES AND MOMENTUM');
      row(0, 'Q-value', Th.Q.toFixed(4) + ' MeV', '#FF8FB0');
      row(1, 'energy in the CM frame  K·M/(M + m)', Th.Kcm.toFixed(4) + ' MeV', th.phys);
      row(2, 'threshold K_th', Th.Kth.toFixed(4) + ' MeV', th.ok);
      row(3, 'does it happen?', Th.go ? 'yes · ' + Th.spare.toFixed(3) + ' MeV to spare' : 'no · short by ' + (-Th.spare).toFixed(3) + ' MeV');
      if (!narrow) { row(4, 'locked up in CM motion', Th.lostToCM.toFixed(4) + ' MeV'); row(5, 'masses m_α · M_N (u)', Th.mA.toFixed(5) + ' · ' + Th.mN.toFixed(5)); row(6, '|Q| alone is not enough', 'momentum must be conserved'); }
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

  /* ======================= the decay series: a skyline of half-lives on the N–Z chart ======================= */
  function drawSeries(S, g) {
    const ctx = g.ctx, th = g.theme, p = S.p, W = g.w, H = g.h, cam = S.cam, Se = S.Se, st = Se.st;
    const narrow = W < 660;
    const F = R3.Frame(ctx, cam, { ambient: 0.34, floorZ: 0 });
    const Ns = st.map(s => s[2] - s[1]), Zs = st.map(s => s[1]);
    const n0 = Math.min(...Ns) - 1, n1 = Math.max(...Ns) + 1, z0 = Math.min(...Zs) - 1, z1 = Math.max(...Zs) + 1;
    const sc = 0.16, cx = (n0 + n1) / 2, cz = (z0 + z1) / 2;
    const P = (N, Z, h) => [(N - cx) * sc, (Z - cz) * sc, h || 0];
    // the chart: a board with a cell for every (N, Z)
    R3.plane(F, P(n0 - 0.5, z0 - 0.5), [(n1 - n0 + 1) * sc, 0, 0], [0, (z1 - z0 + 1) * sc, 0], '#1C2333', { grid: 0, bias: F.GROUND });
    for (let N = n0; N <= n1 + 1; N++) path3(F, [P(N - 0.5, z0 - 0.5, 0.002), P(N - 0.5, z1 + 0.5, 0.002)], '#3A4660', { alpha: 0.5, width: 0.8, chunk: 1, bias: 0.5 });
    for (let Z = z0; Z <= z1 + 1; Z++) path3(F, [P(n0 - 0.5, Z - 0.5, 0.002), P(n1 + 0.5, Z - 0.5, 0.002)], '#3A4660', { alpha: 0.5, width: 0.8, chunk: 1, bias: 0.5 });
    const step = Math.min(st.length - 1, Math.floor(S.ts / 1.1));
    st.forEach((s, i) => {
      const N = s[2] - s[1], lg = isFinite(s[4]) ? Math.log10(s[4]) : 18, h = 0.03 + 0.032 * (lg + 7);
      const col = s[3] === 'a' ? '#FF7A5A' : s[3] === 'b' ? '#5AA8FF' : '#E8C25A';
      R3.box(F, P(N, s[1], h / 2), [sc * 0.8, sc * 0.8, h], i <= step ? col : RX.mix(col, '#1C2333', 0.55), { shadow: false, ambient: 0.5 });
      R3.label(F, P(N, s[1], h + 0.05), s[0], i === step ? '#FFFFFF' : '#AAB6CC', { size: i === step ? 10.5 : 8.5 });
      if (i < st.length - 1) {
        const q = st[i + 1], a = P(N, s[1], 0.05), b = P(q[2] - q[1], q[1], 0.05);
        const k = 0.28, a2 = [a[0] + (b[0] - a[0]) * k, a[1] + (b[1] - a[1]) * k, 0.05], b2 = [a[0] + (b[0] - a[0]) * (1 - k), a[1] + (b[1] - a[1]) * (1 - k), 0.05];
        if (i < step) R3.arrow(F, a2, b2, 0.008, s[3] === 'a' ? '#FF7A5A' : '#5AA8FF', { vivid: true });
      }
    });
    // axis labels
    R3.label(F, P(cx, z0 - 1.4), 'N (neutrons) →', '#8893A8', { size: 9.5 });
    R3.label(F, P(n0 - 1.6, cz), 'Z ↑', '#8893A8', { size: 9.5 });
    F.render();
    const cur = st[step];
    let na = 0, nb = 0; for (let i = 0; i < step; i++) { if (st[i][3] === 'a') na++; else nb++; }
    header(g, Se.Sr.name + ' · ' + st[0][0] + ' → ' + st[st.length - 1][0],
      'step ' + step + ': ' + cur[0] + (isFinite(cur[4]) ? ' · T½ ' + tfmt(cur[4]) + ' · decays by ' + (cur[3] === 'a' ? 'α' : 'β⁻') : ' · stable') + ' · so far ' + na + ' α and ' + nb + ' β⁻',
      'tile height = log of the half-life · α moves (N, Z) by (−2, −2), β⁻ by (−1, +1) · A changes only in α', th.text);
    const rows = narrow ? 4 : 6, bw = narrow ? W - 24 : 300, bh = 26 + rows * 15 + 10;
    const row = gPanel(g, 12, H - bh - 30, bw, bh, 'COUNTED ALONG THE WALK');
    row(0, 'α decays · β⁻ decays', Se.na + ' · ' + Se.nb, th.phys);
    row(1, 'from ΔA/4 · 2n_α − ΔZ', Se.rule.na + ' · ' + Se.rule.nb, th.ok);
    row(2, 'ΔA · ΔZ', Se.dA + ' · ' + Se.dZ);
    row(3, 'every landing matches the table', Se.ok ? 'yes' : 'NO');
    if (!narrow) {
      const e = Se.eq.find(x => x.id === 'Ra-226') || Se.eq[1];
      row(4, 'in equilibrium, ' + e.id + ' per tonne of ' + st[0][0], e.gPerT < 1e-3 ? (e.gPerT * 1e6).toPrecision(3) + ' µg' : e.gPerT.toPrecision(3) + ' g');
      row(5, 'the slowest step (sets the pace)', st[0][0] + ' · ' + tfmt(st[0][4]));
    }
  }

  /* ======================= Rutherford: foil, detector, and the orbits near one nucleus ======================= */
  function drawRuth(S, g) {
    const ctx = g.ctx, th = g.theme, p = S.p, W = g.w, H = g.h, cam = S.cam, Ru = S.Ru;
    const narrow = W < 660, B = window.BENCH;
    const F = R3.Frame(ctx, cam, { ambient: 0.32, floorZ: -0.5 });
    // the evacuated chamber (a ring), the lead-housed source and collimator, the foil, the microscope on its arm
    const ring = [];
    for (let k = 0; k <= 64; k++) { const a = k / 64 * TAU; ring.push([Math.cos(a) * 1.35, Math.sin(a) * 1.35, -0.3]); }
    path3(F, ring, '#8FA4CE', { alpha: 0.5, width: 1.4, chunk: 4 });
    R3.cylinder(F, [0, 0, -0.5], [0, 0, -0.32], 1.4, '#2A3142', { segments: 48, shadow: false });
    R3.box(F, [-1.05, 0, 0], [0.3, 0.3, 0.3], '#5E646E', { shadow: false });
    R3.cylinder(F, [-0.9, 0, 0], [-0.55, 0, 0], 0.05, '#7A828E', { segments: 16, shadow: false });
    R3.box(F, [0, 0, 0], [0.006, 0.34, 0.34], '#E8C25A', { shadow: false, ambient: 0.6 });
    R3.label(F, [0, 0, 0.26], RTGT[p.tgt].name + ' foil', '#E8C25A', { size: 9.5 });
    // the beam, and a few scattered α leaving at their computed angles
    path3(F, [[-0.55, 0, 0], [0, 0, 0]], '#FF8A7A', { alpha: 0.9, width: 2.2, chunk: 1, glow: 6 });
    const Rr = rng(Math.floor(S.ts * 6)), tab = Ru.tab;
    for (let i = 0; i < 10; i++) {
      const b = Ru.bmax * Math.sqrt(Rr()) * (i < 2 ? 0.08 : 1), tt = Ru.thOf(b * Ru.d0) * Math.PI / 180, ph = TAU * Rr();
      const d = [Math.cos(tt), Math.sin(tt) * Math.cos(ph), Math.sin(tt) * Math.sin(ph) * 0.6];
      path3(F, [[0, 0, 0], [d[0] * 1.3, d[1] * 1.3, d[2] * 1.3]], '#FF8A7A', { alpha: 0.45, width: 1.1, chunk: 1 });
    }
    void tab;
    // the microscope + ZnS screen at the detector angle
    const td = p.thdet * Math.PI / 180, dx = Math.cos(td) * 1.25, dy = Math.sin(td) * 1.25;
    R3.cylinder(F, [0, 0, -0.3], [dx * 0.98, dy * 0.98, -0.3], 0.02, '#8A93A3', { segments: 8, shadow: false });
    R3.cylinder(F, [dx, dy, -0.3], [dx, dy, 0.15], 0.03, '#8A93A3', { segments: 8, shadow: false });
    R3.cylinder(F, [dx * 0.96, dy * 0.96, 0.05], [dx * 1.18, dy * 1.18, 0.05], 0.07, '#39414F', { segments: 18, shadow: false });
    const k = Math.min(16, Math.floor((p.thdet - 10) / 10)), cnt = Ru.perSr[Math.max(0, k)];
    if (Rr() < Math.min(1, cnt[2] / 3000)) F.push([dx * 0.95, dy * 0.95, 0.05], () => { const q = cam.project([dx * 0.95, dy * 0.95, 0.05]); if (!q.ok) return;
      ctx.fillStyle = 'rgba(160,255,200,.95)'; ctx.beginPath(); ctx.arc(q.x, q.y, 3, 0, TAU); ctx.fill(); }, -0.05);
    R3.label(F, [dx * 1.2, dy * 1.2, 0.3], 'microscope at ' + p.thdet.toFixed(0) + '° · ' + cnt[2] + ' flashes', '#9FF0C0', { size: 9.5 });
    F.render();
    // inset: the actual computed orbits near one nucleus, to scale in fm
    const iw = narrow ? W - 28 : 300, ih = narrow ? 150 : 210, ix = W - iw - 14, iy = 64;
    ctx.fillStyle = g.alpha('#0B1020', .92); ctx.strokeStyle = g.alpha(th.line, 1); ctx.beginPath(); ctx.roundRect(ix - 6, iy - 16, iw + 12, ih + 22, 8); ctx.fill(); ctx.stroke();
    PA.lbl(ctx, ix, iy - 6, 'ORBITS NEAR ONE NUCLEUS · integrated · scale bar ' + (Ru.d0).toFixed(0) + ' fm = d₀', th['text-3'], 'left', 8);
    const span = 3.2, s = Math.min(iw / (2 * span), ih / (1.3 * span)), ox = ix + iw * 0.55, oy = iy + ih * 0.55;
    ctx.save(); ctx.beginPath(); ctx.rect(ix, iy, iw, ih); ctx.clip();
    Ru.shown.forEach(o => {
      ctx.strokeStyle = o.b === 0 ? 'rgba(255,220,120,.9)' : 'rgba(255,138,122,.75)'; ctx.lineWidth = 1.2; ctx.beginPath();
      o.o.pts.forEach((q, i) => { const X = ox + q[0] * s, Y = oy - o.s * q[1] * s; i ? ctx.lineTo(X, Y) : ctx.moveTo(X, Y); }); ctx.stroke();
    });
    ctx.fillStyle = '#E8C25A'; ctx.beginPath(); ctx.arc(ox, oy, Math.max(2.5, Ru.rNuc / Ru.d0 * s), 0, TAU); ctx.fill();
    ctx.setLineDash([3, 3]); ctx.strokeStyle = 'rgba(255,220,120,.6)'; ctx.beginPath(); ctx.arc(ox, oy, s, 0, TAU); ctx.stroke(); ctx.setLineDash([]);
    ctx.restore();
    ctx.strokeStyle = '#DCE3EE'; ctx.beginPath(); ctx.moveTo(ix + 8, iy + ih - 8); ctx.lineTo(ix + 8 + s, iy + ih - 8); ctx.stroke();
    header(g, 'Rutherford scattering · ' + p.Ka.toFixed(1) + ' MeV α on ' + RTGT[p.tgt].name + ' (Z = ' + Ru.T.Z + ')',
      'orbits integrated in the Coulomb field (RK4) · ' + (Ru.N / 1000).toFixed(0) + 'k α in a uniform beam, each deflected by its own impact parameter',
      Ru.reaches ? 'closest approach ' + Ru.dmin.toFixed(1) + ' fm is inside the nuclear surface (' + Ru.rNuc.toFixed(1) + ' fm): the strong force acts and Rutherford\'s formula fails' : 'closest approach ' + Ru.dmin.toFixed(1) + ' fm stays outside the nucleus (' + Ru.rNuc.toFixed(1) + ' fm): pure Coulomb', Ru.reaches ? '#FF8F6B' : th.text);
    const rows = narrow ? 4 : 6, bw = narrow ? W - 24 : 300, bh = 26 + rows * 15 + 10;
    const row = gPanel(g, 12, H - bh - 30, bw, bh, 'MEASURED FROM THE ORBITS');
    row(0, 'head-on closest approach (integrated)', Ru.dmin.toFixed(2) + ' fm', th.phys);
    row(1, 'd₀ = 2kZe²/K', Ru.d0.toFixed(2) + ' fm', th.ok);
    row(2, 'impact parameter for ' + p.thdet.toFixed(0) + '°', Ru.bOf(p.thdet).toFixed(2) + ' fm');
    row(3, 'beyond 90° (of those beyond 10°)', (Ru.bins.slice(8).reduce((u, v) => u + v, 0) / Ru.bins.reduce((u, v) => u + v, 0) * 100).toFixed(3) + '%');
    if (!narrow) { row(4, 'counts at ' + p.thdet.toFixed(0) + '° ÷ 1/sin⁴(θ/2) prediction', (cnt[1] / cnt[3]).toFixed(3)); row(5, 'nuclear radius (touching)', Ru.rNuc.toFixed(2) + ' fm'); }
  }

  /* ======================= slowing neutrons down ======================= */
  const ECOL = E => tcol(Math.log10(E), Math.log10(0.025), Math.log10(2e6));
  function drawModer(S, g) {
    const ctx = g.ctx, th = g.theme, p = S.p, W = g.w, H = g.h, cam = S.cam, Mo = S.Mo;
    const narrow = W < 660;
    const F = R3.Frame(ctx, cam, { ambient: 0.32, floorZ: null });
    const half = Math.max(5, Mo.rms * 1.15), ks = 1.1 / half;
    // the moderator block (edges and faint faces)
    const E8 = []; [-1, 1].forEach(a => [-1, 1].forEach(b => [-1, 1].forEach(c => E8.push([a * 1.1, b * 1.1, c * 1.1]))));
    [[0, 1], [2, 3], [4, 5], [6, 7], [0, 2], [1, 3], [4, 6], [5, 7], [0, 4], [1, 5], [2, 6], [3, 7]].forEach(e => path3(F, [E8[e[0]], E8[e[1]]], '#8FA4CE', { alpha: 0.35, width: 1, chunk: 1 }));
    glassBox(F, [0, 0, 0], [2.2, 2.2, 2.2], { skip: [4] });
    R3.sphere(F, [0, 0, 0], 0.05, '#FFD36B', { shadow: false, vivid: true });
    const rev = clamp((S.ts % 8) / 6, 0, 1);
    Mo.paths.forEach(path => {
      const n = path.length, kk = Math.max(2, Math.ceil(n * rev));
      for (let i = 1; i < kk; i++) {
        const a = path[i - 1], b = path[i];
        path3(F, [a.p.map(v => v * ks), b.p.map(v => v * ks)], ECOL(a.E), { alpha: 0.85, width: 1.4, chunk: 1 });
      }
      if (kk === n) R3.sphere(F, path[n - 1].p.map(v => v * ks), 0.025, '#6FB8FF', { shadow: false });
    });
    R3.label(F, [0, 0, 1.3], Mo.M.name + ' · block ' + (2 * half).toFixed(0) + ' cm across', '#DCE3EE', { size: 10 });
    F.render();
    header(g, 'Slowing neutrons from 2 MeV to 0.025 eV in ' + Mo.M.name,
      Mo.n + ' neutrons, every collision elastic and isotropic in the centre-of-mass frame · colour: energy, red fast → blue thermal · A = ' + Mo.A,
      'a head-on hit with mass A takes 4A/(1 + A)² of the energy — all of it when A = 1', th.text);
    const rows = narrow ? 4 : 6, bw = narrow ? W - 24 : 300, bh = 26 + rows * 15 + 10;
    const row = gPanel(g, 12, H - bh - 30, bw, bh, 'COLLISIONS, COUNTED');
    row(0, 'mean collisions to thermal', Mo.mean.toFixed(1), th.phys);
    row(1, 'ln(E₀/E)/ξ', Mo.formula.toFixed(1), th.ok);
    row(2, 'ξ (mean log energy loss)', Mo.xi.toFixed(4));
    row(3, 'head-on loss 4A/(1+A)²', (Mo.headOn * 100).toFixed(2) + '%');
    if (!narrow) { row(4, 'average loss per collision (1−α)/2', (Mo.avgLoss * 100).toFixed(2) + '%'); row(5, 'rms distance travelled', Mo.rms.toFixed(1) + ' cm'); }
  }

  /* ======================= carbon dating ======================= */
  function drawDating(S, g) {
    const ctx = g.ctx, th = g.theme, p = S.p, W = g.w, H = g.h, cam = S.cam, Dt = S.Dt;
    const narrow = W < 660, B = window.BENCH;
    const F = R3.Frame(ctx, cam, { ambient: 0.32, floorZ: 0 });
    const m = (x, y, z) => [x * 0.1, y * 0.1, z * 0.1];
    B.table(F, m(-18, 0, 0)[0], m(22, 0, 0)[0], m(0, -12, 0)[1], m(0, 12, 0)[1], 0, { legs: false, tone: '#6E4A2C', seed: 37, thick: 0.06 });
    // a low-background counter: a lead castle round a scintillation vial
    [[-3, -5, 3, 12, 2, 6], [-3, 5, 3, 12, 2, 6], [-9, 0, 3, 2, 12, 6], [3, 0, 3, 2, 12, 6], [-3, 0, 7, 14, 12, 2]].forEach(b => R3.box(F, m(b[0], b[1], b[2]), [b[3] * 0.1, b[4] * 0.1, b[5] * 0.1], '#5E646E', { shadow: false, ambient: 0.42 }));
    liquidCyl(F, m(-3, -5.9, 0.2), 1.2 * 0.1, 3 * 0.1, '#DDEAF5', { alpha: 0.5 });
    glassCyl(F, m(-3, -5.9, 0.2), 1.3 * 0.1, 4 * 0.1);
    // the sample: a piece of old wood
    R3.box(F, m(-14, -3, 1.2), [5 * 0.1, 2.4 * 0.1, 2.4 * 0.1], '#6B4A2E', { shadow: false, axes: [[0.9, 0.44, 0], [-0.44, 0.9, 0], [0, 0, 1]] });
    R3.label(F, m(-14, -3, 4), 'sample · ' + p.mC.toFixed(1) + ' g of carbon', '#DCE3EE', { size: 9 });
    const tNow = clamp(S.ts / 16, 0, 1), shownC = Math.round(Dt.C * tNow), shownB = Math.round(Dt.Cb * tNow);
    R3.box(F, m(14, 3, 3.4), [10 * 0.1, 7 * 0.1, 6.8 * 0.1], '#2B3344', { shadow: false });
    B.meter(F, m(14, -1.3, 4.8), [0, -1, 0], 8.4 * 0.1, 2.3 * 0.1, { title: 'SAMPLE', value: String(shownC), unit: '', colour: '#7CF0B0' });
    B.meter(F, m(14, -1.3, 2.2), [0, -1, 0], 8.4 * 0.1, 2.3 * 0.1, { title: 'BLANK', value: String(shownB), unit: '', colour: '#F5B451' });
    R3.label(F, m(14, 3, 7.6), 'counting ' + (tNow * p.tcnt).toFixed(1) + ' of ' + p.tcnt.toFixed(0) + ' h', '#C9D4EA', { size: 9 });
    F.render();
    header(g, 'Carbon dating · true age ' + p.age.toFixed(0) + ' years',
      'living carbon: 15.3 decays per minute per gram · the sample and a carbon-free blank are counted for ' + p.tcnt.toFixed(0) + ' h each · background ' + p.bgc.toFixed(1) + ' per min',
      'age = (T½/ln 2) ln(A_living/A_sample), with the ±√N of every count carried through', th.text);
    const rows = narrow ? 4 : 6, bw = narrow ? W - 24 : 300, bh = 26 + rows * 15 + 10;
    const row = gPanel(g, 12, H - bh - 30, bw, bh, 'THE DATE, FROM THE COUNTS');
    row(0, 'age found', Dt.ok ? Dt.age.toFixed(0) + ' ± ' + Dt.sAge.toFixed(0) + ' yr' : 'older than ~' + Dt.limit.toFixed(0) + ' yr', Dt.ok ? th.phys : '#FF8FB0');
    row(1, 'true age', p.age.toFixed(0) + ' yr', th.ok);
    row(2, 'sample activity (net)', (Dt.net * 60).toFixed(3) + ' ± ' + (Dt.sig * 60).toFixed(3) + ' /min');
    row(3, 'fraction of the living value', (Dt.net / Dt.Aliving * 100).toFixed(2) + '%');
    if (!narrow) { row(4, 'counts: sample · blank', Dt.C + ' · ' + Dt.Cb); row(5, 'limit of this measurement', '≈ ' + Dt.limit.toFixed(0) + ' yr'); }
  }

  const DEC = S => S.p.mode === 'decay', CHN = S => S.p.mode === 'chain', BND = S => S.p.mode === 'bind',
        CRT = S => S.p.mode === 'crit', ALP = S => S.p.mode === 'bind' && S.p.bsub === 'alpha', CUR = S => S.p.mode === 'bind' && S.p.bsub === 'curve',
        ACT = S => S.p.mode === 'chain' && S.p.chain === 'NaAct', MOT = S => S.p.mode === 'chain' && S.p.chain === 'MoTc',
        SRS = S => S.p.mode === 'series', RUT = S => S.p.mode === 'ruth', MOD = S => S.p.mode === 'moder', DAT = S => S.p.mode === 'dating',
        THR = S => S.p.mode === 'bind' && S.p.bsub === 'thresh';

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
              rcm: 8.8, enr: 100, dens: 1, rods: 0, refl: false, ser: 'U238', tgt: 'Au', Ka: 5, thdet: 60, mod: 'H', age: 17190, mC: 20, tcnt: 48, bgc: 1, Kth: 2, run: true },

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
      { name: 'Control rods in', params: { mode: 'crit', rcm: 12, enr: 100, dens: 1, rods: 0.4, refl: false, seed: 1 } },
      { name: 'Uranium series · count the α and β', params: { mode: 'series', ser: 'U238' } },
      { name: 'Thorium series', params: { mode: 'series', ser: 'Th232' } },
      { name: 'Actinium series (U-235)', params: { mode: 'series', ser: 'U235' } },
      { name: 'Rutherford · 5 MeV α on gold', params: { mode: 'ruth', tgt: 'Au', Ka: 5, thdet: 60, seed: 1 } },
      { name: 'Rutherford · back-scattering at 150°', params: { mode: 'ruth', tgt: 'Au', Ka: 5, thdet: 150, seed: 1 } },
      { name: '30 MeV α on aluminium · Rutherford fails', params: { mode: 'ruth', tgt: 'Al', Ka: 30, thdet: 60, seed: 1 } },
      { name: 'Moderator · hydrogen (water)', params: { mode: 'moder', mod: 'H', seed: 1 } },
      { name: 'Moderator · graphite', params: { mode: 'moder', mod: 'C', seed: 1 } },
      { name: 'Lead is no moderator', params: { mode: 'moder', mod: 'Pb', seed: 1 } },
      { name: 'Carbon dating · three half-lives old', params: { mode: 'dating', age: 17190, mC: 20, tcnt: 48, bgc: 1, seed: 1 } },
      { name: 'Too old to date · 60 000 years', params: { mode: 'dating', age: 60000, mC: 2, tcnt: 24, bgc: 1, seed: 1 } },
      { name: 'Threshold · 1.4 MeV α on N-14 (fails)', params: { mode: 'bind', bsub: 'thresh', Kth: 1.4 } },
      { name: 'Threshold · 2.0 MeV α on N-14', params: { mode: 'bind', bsub: 'thresh', Kth: 2 } }
    ],

    controls: [
      { group: 'What is set up', items: [
        { key: 'mode', type: 'select', label: 'Experiment', restructure: true, rebuild: true, options: [
          { value: 'decay', label: 'Counting a source' }, { value: 'chain', label: 'Decay chains' },
          { value: 'bind', label: 'Binding energy and Q' }, { value: 'crit', label: 'A critical sphere' },
          { value: 'series', label: 'Decay series (N–Z chart)' }, { value: 'ruth', label: 'Rutherford scattering' },
          { value: 'moder', label: 'Moderating neutrons' }, { value: 'dating', label: 'Carbon dating' }] }
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
          { value: 'curve', label: 'One nucleus on the curve' }, { value: 'fission', label: 'Fission' }, { value: 'fusion', label: 'Fusion' }, { value: 'alpha', label: 'Alpha decay' }, { value: 'thresh', label: 'An endothermic reaction' }] },
        { key: 'Kth', label: 'α kinetic energy', min: 0.5, max: 4, step: 0.01, unit: 'MeV', when: THR, fmt: v => v.toFixed(2), restructure: true },
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
      { group: 'Series, scattering, moderation, dating', items: [
        { key: 'ser', type: 'select', label: 'Series', restructure: true, when: SRS, options: [
          { value: 'U238', label: 'U-238 (4n + 2)' }, { value: 'Th232', label: 'Th-232 (4n)' }, { value: 'U235', label: 'U-235 (4n + 3)' }] },
        { key: 'tgt', type: 'select', label: 'Foil', restructure: true, when: RUT, options: [
          { value: 'Au', label: 'Gold (Z 79)' }, { value: 'Ag', label: 'Silver (Z 47)' }, { value: 'Cu', label: 'Copper (Z 29)' }, { value: 'Al', label: 'Aluminium (Z 13)' }] },
        { key: 'Ka', label: 'α kinetic energy', min: 1, max: 40, step: 0.1, unit: 'MeV', when: RUT, fmt: v => v.toFixed(1), restructure: true },
        { key: 'thdet', label: 'Microscope angle', min: 15, max: 175, step: 1, unit: '°', when: RUT, fmt: v => v.toFixed(0), restructure: true },
        { key: 'mod', type: 'select', label: 'Moderator', restructure: true, when: MOD, options: [
          { value: 'H', label: 'Hydrogen (A = 1)' }, { value: 'D', label: 'Deuterium (A = 2)' }, { value: 'C', label: 'Carbon (A = 12)' }, { value: 'Pb', label: 'Lead (A = 207)' }] },
        { key: 'age', label: 'True age of the sample', min: 0, max: 70000, step: 10, unit: 'yr', when: DAT, fmt: v => v.toFixed(0), restructure: true },
        { key: 'mC', label: 'Carbon in the sample', min: 0.2, max: 30, step: 0.1, unit: 'g', when: DAT, fmt: v => v.toFixed(1), restructure: true },
        { key: 'tcnt', label: 'Counting time', min: 1, max: 96, step: 1, unit: 'h', when: DAT, fmt: v => v.toFixed(0), restructure: true },
        { key: 'bgc', label: 'Background', min: 0, max: 10, step: 0.1, unit: '/min', when: DAT, fmt: v => v.toFixed(1), restructure: true }
      ] },
      { group: 'Chance', items: [
        { key: 'seed', label: 'Run number (a new set of random events)', min: 1, max: 30, step: 1, unit: '', when: S => DEC(S) || CHN(S) || CRT(S) || RUT(S) || MOD(S) || DAT(S), fmt: v => v.toFixed(0), restructure: true }
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
      else if (p.mode === 'series') S.Se = runSeries(p);
      else if (p.mode === 'ruth') S.Ru = runRuth(p);
      else if (p.mode === 'moder') S.Mo = runModer(p);
      else if (p.mode === 'dating') S.Dt = runDating(p);
      S.ts = 0; S.hold = 0;
      const views = {
        decay: { theta: -1.30, phi: 0.36, dist: 4.4, target: [1.05, 0, 0.35] },
        chain: { theta: -1.35, phi: 0.24, dist: 3.4, target: [0, 0, 0.6] },
        bind: { theta: -1.45, phi: 0.22, dist: 3.1, target: [0, 0, 0] },
        'bind-curve': { theta: -1.45, phi: 0.22, dist: 1.75, target: [0, 0, 0] },
        crit: { theta: -1.20, phi: 0.30, dist: 4.0, target: [0, 0, 0] },
        series: { theta: -1.57, phi: 0.72, dist: 4.4, target: [0, 0, 0.2] },
        ruth: { theta: -1.9, phi: 0.62, dist: 4.2, target: [0.1, 0, 0] },
        moder: { theta: -1.1, phi: 0.35, dist: 4.4, target: [0, 0, 0] },
        dating: { theta: -1.35, phi: 0.36, dist: 4.0, target: [0.0, 0, 0.35] }
      };
      const vk = p.mode === 'bind' && p.bsub === 'curve' ? 'bind-curve' : p.mode;
      if (!S.cam || S._view !== vk) { S.cam = Camera(views[vk]); S.cam.minDist = 0.8; S.cam.maxDist = 14; S._view = vk; S._narrowCam = false; }
    },

    step(S, dt) {
      const p = S.p;
      if (!p.run) return;
      if (S.hold > 0) { S.hold -= dt; if (S.hold <= 0) S.ts = 0; return; }
      const end = p.mode === 'decay' ? 20 : p.mode === 'chain' ? 18 : p.mode === 'series' ? S.Se.st.length * 1.1 + 1 : p.mode === 'dating' ? 16 : 1e9;
      S.ts += dt;
      if (S.ts >= end) { S.ts = end; S.hold = 3; }
    },

    drawStage(S, g) {
      if (g.w < 660 && !S._narrowCam) { S.cam.dist *= 1.3; S._narrowCam = true; }
      const md = S.p.mode;
      if (md === 'decay') drawDecay(S, g);
      else if (md === 'chain') drawChain(S, g);
      else if (md === 'bind') drawBind(S, g);
      else if (md === 'series') drawSeries(S, g);
      else if (md === 'ruth') drawRuth(S, g);
      else if (md === 'moder') drawModer(S, g);
      else if (md === 'dating') drawDating(S, g);
      else drawCrit(S, g);
    },

    onDrag(S, e) {
      const p = S.p, along = a => a ? (e.dx * a.ux + e.dy * a.uy) * a.per : 0;
      if (e.id === 'gm' && S._axT) { p.dcm = clamp(p.dcm + along(S._axT), 1, 15); this.setup(S); }
    },

    plots: [
      { title: S => ({ decay: 'The scaler\'s counts, window by window', chain: 'Activities against time (log scale): integrated lines, atom-by-atom dots',
                       bind: S.p.bsub === 'curve' ? 'Binding energy per nucleon — measured masses and the liquid drop' : 'Where the reaction sits on the binding curve',
                       crit: 'Neutrons per generation (log scale)', series: 'Half-life of every member (log scale)', ruth: 'Counts per steradian against angle (log scale)',
                       moder: 'Energy against collision number (log scale)', dating: 'Activity of a gram of carbon against age' })[S.p.mode],
        draw(S, g) {
          const p = S.p, th = g.theme, cy = '#3DD6F5', gr = '#7CF0B0', am = '#F5B451', pk = '#FF8FB0';
          if (p.mode === 'series') {
            const st = S.Se.st, P = g.Plot({ xmin: -0.5, xmax: st.length - 0.5, ymin: -8, ymax: 19, xlabel: 'step along the chain', ylabel: 'log₁₀ T½ (s)', xfmt: v => (st[Math.round(v)] || [''])[0], yfmt: v => v.toFixed(0) }).frame();
            P.clip(() => { st.forEach((s, i) => { if (!isFinite(s[4])) return; P.bar(i, Math.log10(s[4]), 0.35, -8, g.alpha(s[3] === 'a' ? '#FF7A5A' : '#5AA8FF', .8)); });
              [[0, 'second'], [Math.log10(DAY), 'day'], [Math.log10(YR), 'year'], [Math.log10(1e9 * YR), '10⁹ yr']].forEach(q => P.hline(q[0], g.alpha(th['text-3'], .5), [2, 3])); });
            [[0, 'a second'], [Math.log10(DAY), 'a day'], [Math.log10(YR), 'a year'], [Math.log10(1e9 * YR), '10⁹ years']].forEach(q => P.tag(st.length - 0.6, q[0], q[1], th['text-3'], 'right', -6));
            P.tag(0, 18, 'red: α · blue: β⁻', th['text-2'], 'left', 0);
            return;
          }
          if (p.mode === 'ruth') {
            const Ru = S.Ru, pts = Ru.perSr.filter(q => q[2] > 0);
            const ys = pts.map(q => Math.log10(q[1])), lo = Math.min(...ys) - 0.6, hi = Math.max(...ys) + 0.4;
            const P = g.Plot({ xmin: 0, xmax: 180, ymin: lo, ymax: hi, xlabel: 'scattering angle θ (°)', ylabel: 'log₁₀ counts per sr', xfmt: v => v.toFixed(0), yfmt: v => v.toFixed(0) }).frame();
            const f = []; for (let t = 12; t <= 178; t += 2) f.push([t, Math.log10(Ru.perSr[0][3] * Math.pow(Math.sin(15 * Math.PI / 360) / Math.sin(t * Math.PI / 360), 4))]);
            P.clip(() => { P.line(f, am, 1.6, [5, 3]); pts.forEach(q => { const e = 1 / Math.sqrt(q[2]) / Math.LN10; P.line([[q[0], Math.log10(q[1]) - e], [q[0], Math.log10(q[1]) + e]], g.alpha(cy, .7), 1); P.dot(q[0], Math.log10(q[1]), 3.5, cy); }); P.vline(p.thdet, g.alpha(gr, .7), [3, 3]); });
            P.tag(178, f[f.length - 1][1], '∝ 1/sin⁴(θ/2)', am, 'right', -10);
            return;
          }
          if (p.mode === 'moder') {
            const Mo = S.Mo, mx = Math.max(...Mo.paths.map(q => q.length)) + 2;
            const P = g.Plot({ xmin: 0, xmax: mx, ymin: -2, ymax: 7, xlabel: 'collision number', ylabel: 'log₁₀ E (eV)', xfmt: v => v.toFixed(0), yfmt: v => v.toFixed(0) }).frame();
            P.clip(() => { P.hline(Math.log10(0.025), g.alpha(pk, .7), [4, 3]);
              P.line([[0, Math.log10(2e6)], [mx, Math.log10(2e6) - Mo.xi * mx / Math.LN10]], g.alpha(am, .8), 1.4, [5, 3]);
              Mo.paths.forEach((path, j) => P.line(path.map((q, i) => [i, Math.log10(q.E)]), g.alpha([cy, gr, '#B8A4FF', pk, am, '#FFFFFF'][j % 6], .85), 1.4)); });
            P.tag(mx * 0.98, Math.log10(0.025), 'thermal, 0.025 eV', pk, 'right', -8);
            P.tag(mx * 0.5, Math.log10(2e6) - Mo.xi * mx * 0.5 / Math.LN10, 'average: ln E falls by ξ per collision', am, 'left', -10);
            return;
          }
          if (p.mode === 'dating') {
            const Dt = S.Dt, pts = []; for (let a = 0; a <= 70000; a += 500) pts.push([a / 1000, C14.A0 * 60 * Math.exp(-LN2 * a / 5730)]);
            const P = g.Plot({ xmin: 0, xmax: 70, ymin: 0, ymax: 16.5, xlabel: 'age (thousand years)', ylabel: 'decays per minute per gram', xfmt: v => v.toFixed(0), yfmt: v => v.toFixed(0) }).frame();
            P.clip(() => { P.line(pts, am, 2.2); [1, 2, 3, 4].forEach(n => P.dot(5.73 * n, 15.3 / Math.pow(2, n), 3.5, am));
              const a = Dt.net / p.mC * 60, e = Dt.sig / p.mC * 60;
              if (Dt.ok) { P.line([[Dt.age / 1000 - Dt.sAge / 1000, a], [Dt.age / 1000 + Dt.sAge / 1000, a]], gr, 2); P.line([[Dt.age / 1000, a - e], [Dt.age / 1000, a + e]], gr, 2); P.dot(Dt.age / 1000, a, 5, gr, th['ink-950']); }
              P.vline(p.age / 1000, g.alpha(th['text-2'], .6), [3, 3]); P.vline(Math.min(70, Dt.limit / 1000), g.alpha(pk, .7), [4, 3]); });
            P.tag(5.73, 7.65, 'one half-life: 5730 yr', am, 'left', -8);
            P.tag(Math.min(69, Dt.limit / 1000), 14, 'limit of this count', pk, 'right', 0);
            return;
          }
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
                       crit: 'k against radius — where it crosses one is the critical size', series: 'Mass of each member in equilibrium, per tonne of parent',
                       ruth: 'Impact parameter against angle: integrated orbits and (d₀/2)cot(θ/2)', moder: 'Collisions to thermalise against mass number', dating: 'How precisely an age can be measured, against age' })[S.p.mode],
        draw(S, g) {
          const p = S.p, th = g.theme, cy = '#3DD6F5', gr = '#7CF0B0', am = '#F5B451', pk = '#FF8FB0';
          if (p.mode === 'series') {
            const Se = S.Se, eq = Se.eq.filter(e => isFinite(e.gPerT) && e.gPerT > 0);
            const P = g.Plot({ xmin: -0.5, xmax: eq.length - 0.5, ymin: -16, ymax: 7, xlabel: 'member', ylabel: 'log₁₀ grams per tonne', xfmt: v => (eq[Math.round(v)] || { id: '' }).id, yfmt: v => v.toFixed(0) }).frame();
            P.clip(() => eq.forEach((e, i) => P.bar(i, Math.log10(e.gPerT), 0.35, -16, g.alpha(i ? cy : am, .8))));
            P.tag(eq.length - 0.6, 6, 'equal activities: N ∝ T½', th['text-2'], 'right', 0);
            return;
          }
          if (p.mode === 'ruth') {
            const Ru = S.Ru, f = [], pts = [];
            for (let t = 10; t <= 179; t += 1) f.push([t, Ru.bOf(t)]);
            Ru.tab.forEach(q => { const t = q[1] * 180 / Math.PI; if (t > 10 && t < 179) pts.push([t, q[0] * Ru.d0]); });
            const P = g.Plot({ xmin: 0, xmax: 180, ymin: 0, ymax: Ru.bOf(10) * 1.05, xlabel: 'θ (°)', ylabel: 'impact parameter b (fm)', xfmt: v => v.toFixed(0), yfmt: v => v.toFixed(0) }).frame();
            P.clip(() => { P.line(f, am, 1.6, [5, 3]); pts.forEach((q, i) => { if (i % 3 === 0) P.dot(q[0], q[1], 2.6, cy); }); P.dot(p.thdet, Ru.bOf(p.thdet), 5, gr, th['ink-950']); });
            P.tag(90, Ru.bOf(90), 'b = (d₀/2) cot(θ/2)', am, 'left', -10);
            return;
          }
          if (p.mode === 'moder') {
            const As = [1, 2, 4, 9, 12, 16, 56, 207], f = As.map(A => { const al = Math.pow((A - 1) / (A + 1), 2), xi = A === 1 ? 1 : 1 + al * Math.log(al) / (1 - al); return [Math.log10(A), Math.log10(Math.log(8e7) / xi)]; });
            const P = g.Plot({ xmin: 0, xmax: 2.4, ymin: 1, ymax: 3.5, xlabel: 'log₁₀ A', ylabel: 'log₁₀ collisions', xfmt: v => Math.pow(10, v).toFixed(0), yfmt: v => Math.pow(10, v).toFixed(0) }).frame();
            P.clip(() => { P.line(f, am, 1.6, [5, 3]); P.dot(Math.log10(S.Mo.A), Math.log10(S.Mo.mean), 6, gr, th['ink-950']); });
            [[1, 'H'], [2, 'D'], [12, 'C'], [207, 'Pb']].forEach(q => { const al = Math.pow((q[0] - 1) / (q[0] + 1), 2), xi = q[0] === 1 ? 1 : 1 + al * Math.log(al) / (1 - al); P.tag(Math.log10(q[0]), Math.log10(Math.log(8e7) / xi), q[1], th['text-2'], 'left', -8); });
            P.tag(2.35, 1.2, 'dashed: ln(E₀/E)/ξ · dot: counted', th['text-2'], 'right', 0);
            return;
          }
          if (p.mode === 'dating') {
            const Dt = S.Dt, pts = []; for (let a = 500; a <= 70000; a += 500) pts.push([a / 1000, Math.log10(Dt.sigAt(a))]);
            const P = g.Plot({ xmin: 0, xmax: 70, ymin: 0, ymax: 5, xlabel: 'age (thousand years)', ylabel: 'log₁₀ ± years', xfmt: v => v.toFixed(0), yfmt: v => Math.pow(10, v).toFixed(0) }).frame();
            P.clip(() => { P.line(pts, cy, 2.2); if (Dt.ok) P.dot(Dt.age / 1000, Math.log10(Dt.sAge), 5, gr, th['ink-950']); P.vline(Math.min(70, Dt.limit / 1000), g.alpha(pk, .7), [4, 3]); });
            P.tag(2, 4.6, p.mC.toFixed(1) + ' g counted ' + p.tcnt.toFixed(0) + ' h: the error explodes as the signal sinks into background', th['text-2'], 'left', 0);
            return;
          }
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
      if (p.mode === 'series') { const Se = S.Se; return [
        { label: 'α decays', value: String(Se.na), unit: '', flag: 'accent' }, { label: 'β⁻ decays', value: String(Se.nb), unit: '', flag: 'accent' },
        { label: 'ΔA / 4', value: String(Se.rule.na), unit: '' }, { label: '2n_α − ΔZ', value: String(Se.rule.nb), unit: '' },
        { label: 'End product', value: Se.st[Se.st.length - 1][0], unit: '' } ]; }
      if (p.mode === 'ruth') { const Ru = S.Ru, k = Math.min(16, Math.floor((p.thdet - 10) / 10)); return [
        { label: 'Closest approach', value: Ru.dmin.toFixed(2), unit: 'fm', flag: 'accent' }, { label: 'd₀ = 2kZe²/K', value: Ru.d0.toFixed(2), unit: 'fm' },
        { label: 'b at ' + p.thdet.toFixed(0) + '°', value: Ru.bOf(p.thdet).toFixed(2), unit: 'fm' }, { label: 'Counts in that bin', value: String(Ru.perSr[k].c || Ru.perSr[k][2]), unit: '' },
        { label: 'Measured ÷ Rutherford', value: (Ru.perSr[k][1] / Ru.perSr[k][3]).toFixed(3), unit: '', flag: Ru.reaches ? 'warn' : 'ok' } ]; }
      if (p.mode === 'moder') { const Mo = S.Mo; return [
        { label: 'Collisions (mean, counted)', value: Mo.mean.toFixed(1), unit: '', flag: 'accent' }, { label: 'ln(E₀/E)/ξ', value: Mo.formula.toFixed(1), unit: '' },
        { label: 'ξ', value: Mo.xi.toFixed(4), unit: '' }, { label: 'Head-on loss', value: (Mo.headOn * 100).toFixed(2), unit: '%' }, { label: 'rms distance', value: Mo.rms.toFixed(1), unit: 'cm' } ]; }
      if (p.mode === 'dating') { const Dt = S.Dt; return [
        { label: 'Age found', value: Dt.ok ? Dt.age.toFixed(0) : '> ' + Dt.limit.toFixed(0), unit: 'yr', flag: 'accent' }, { label: '±', value: Dt.ok ? Dt.sAge.toFixed(0) : '—', unit: 'yr' },
        { label: 'True age', value: p.age.toFixed(0), unit: 'yr' }, { label: 'Sample counts', value: String(Dt.C), unit: '' }, { label: 'Blank counts', value: String(Dt.Cb), unit: '' } ]; }
      if (p.mode === 'bind' && p.bsub === 'thresh') { const Th = threshold(p); return [
        { label: 'Q', value: Th.Q.toFixed(4), unit: 'MeV', flag: 'warn' }, { label: 'Threshold', value: Th.Kth.toFixed(4), unit: 'MeV', flag: 'accent' },
        { label: 'CM energy', value: Th.Kcm.toFixed(4), unit: 'MeV' }, { label: 'Happens?', value: Th.go ? 'yes' : 'no', unit: '' } ]; }
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
      if (p.mode === 'series') return E.v('n') + E.sub('α') + ' ' + E.op('=') + ' ' + E.frac('Δ' + E.v('A'), '4') + ' ' + E.op('=') + ' ' + S.Se.rule.na + ' · ' + E.v('n') + E.sub('β') + ' ' + E.op('=') + ' 2' + E.v('n') + E.sub('α') + ' ' + E.op('−') + ' Δ' + E.v('Z') + ' ' + E.op('=') + ' ' + S.Se.rule.nb;
      if (p.mode === 'ruth') return E.v('d') + '₀ ' + E.op('=') + ' ' + E.frac('2' + E.v('kZe') + '²', E.v('K')) + ' ' + E.op('=') + ' ' + E.n(S.Ru.d0, 'fm') + ' · ' + E.v('b') + ' ' + E.op('=') + ' ' + E.frac(E.v('d') + '₀', '2') + ' cot ' + E.frac('θ', '2') + ' · ' + E.v('N') + '(θ) ∝ ' + E.frac('1', 'sin⁴(θ/2)');
      if (p.mode === 'moder') return E.v('E') + '′ ' + E.op('=') + ' ' + E.v('E') + ' ' + E.frac(E.v('A') + '² + 2' + E.v('A') + 'cos φ + 1', '(' + E.v('A') + ' + 1)²') + ' · ' + E.v('n') + ' ' + E.op('≈') + ' ' + E.frac('ln(' + E.v('E') + '₀/' + E.v('E') + ')', 'ξ') + ' ' + E.op('=') + ' ' + E.n(S.Mo.formula, '');
      if (p.mode === 'dating') return E.v('t') + ' ' + E.op('=') + ' ' + E.frac(E.v('T') + '½', 'ln 2') + ' ln ' + E.frac(E.v('A') + E.sub('living'), E.v('A') + E.sub('sample')) + ' ' + E.op('=') + ' ' + (S.Dt.ok ? E.n(S.Dt.age, 'yr') : 'beyond the limit');
      if (p.mode === 'bind' && p.bsub === 'thresh') return E.v('K') + E.sub('th') + ' ' + E.op('=') + ' ' + E.op('−') + E.v('Q') + '(1 + ' + E.frac(E.v('m') + E.sub('α'), E.v('M') + E.sub('N')) + ') ' + E.op('=') + ' ' + E.n(threshold(p).Kth, 'MeV');
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
      ,{ source: 'JEE Main pattern · counting α and β',
        q: 'U-238 decays through a series to Pb-206. How many α particles are emitted along the way?',
        params: { mode: 'series', ser: 'U238' },
        predict: { label: 'number of α', unit: '', tol: 0.001 },
        measure: S => S.Se.na,
        working: 'Only α changes A, by 4 each: (238 − 206)/4 = <b>8</b>. Eight α lower Z by 16, but Z only falls from 92 to 82, so 6 β⁻ must raise it again: n_β = 2n_α − ΔZ = 16 − 10 = 6.' },
      { source: 'JEE Main pattern · closest approach',
        q: 'A 5.0 MeV α particle is fired head-on at a gold nucleus (Z = 79). How close does it get, in fm? (ke² = 1.44 MeV·fm)',
        params: { mode: 'ruth', tgt: 'Au', Ka: 5, thdet: 60, seed: 1 },
        predict: { label: 'closest approach', unit: 'fm', tol: 0.01 },
        measure: S => S.Ru.dmin,
        working: 'All the kinetic energy becomes Coulomb energy: K = k(2e)(79e)/d, so d = 2 × 79 × 1.44/5.0 = <b>45.5 fm</b>. The integrated head-on orbit turns round at 45.50 fm, far outside the gold nucleus (≈ 8.9 fm).' },
      { source: 'JEE Advanced pattern · Rutherford\'s angular law',
        q: 'In a Rutherford experiment, 1000 α per minute are counted at 60°. About how many per minute would the same detector (same solid angle) count at 120°?',
        params: { mode: 'ruth', tgt: 'Au', Ka: 5, thdet: 60, seed: 1 },
        predict: { label: 'count at 120°', unit: '/min', tol: 0.03 },
        measure: S => { const a = S.Ru.perSr[5], b = S.Ru.perSr[11]; return 1000 * (b[1] / b[3]) / (a[1] / a[3]) * Math.pow(Math.sin(Math.PI / 6) / Math.sin(Math.PI / 3), 4); },
        working: 'N ∝ 1/sin⁴(θ/2): N(120°)/N(60°) = sin⁴30°/sin⁴60° = (0.5/0.866)⁴ = 1/9. So about <b>111 per minute</b>. The Monte Carlo counts, scaled the same way, give that within their √N scatter.' },
      { source: 'JEE Advanced pattern · head-on elastic collision',
        q: 'A neutron makes a head-on elastic collision with a deuteron at rest. What fraction of its kinetic energy does it lose, in %?',
        params: { mode: 'moder', mod: 'D', seed: 1 },
        predict: { label: 'fraction lost', unit: '%', tol: 0.005 },
        measure: S => S.Mo.headOn * 100,
        working: 'For a head-on elastic hit on mass A (neutron mass 1): fraction transferred = 4A/(1 + A)² = 8/9 = <b>88.9%</b>. With hydrogen it is 100%, which is why water is such a good moderator; with lead only 1.9%.' },
      { source: 'NEET pattern · carbon dating',
        q: 'Wood from a tomb gives 1/8 of the C-14 activity of living wood. How old is it, in years? (T½ = 5730 yr)',
        params: { mode: 'dating', age: 17190, mC: 20, tcnt: 48, bgc: 1, seed: 1 },
        predict: { label: 'age', unit: 'yr', tol: 0.01 },
        measure: S => S.Dt.age,
        working: '1/8 = (1/2)³: three half-lives, <b>17 190 years</b>. The lab counts 20 g for 48 h and finds 17 214 ± 26 yr. Count less or date something older and the error grows until the sample is lost in the background.' },
      { source: 'JEE Advanced pattern · threshold energy',
        q: 'For ¹⁴N(α, p)¹⁷O, Q = −1.19 MeV. What is the minimum kinetic energy the α must have (N-14 at rest), in MeV?',
        params: { mode: 'bind', bsub: 'thresh', Kth: 2 },
        predict: { label: 'threshold', unit: 'MeV', tol: 0.01 },
        measure: S => threshold(S.p).Kth,
        working: 'Momentum must be conserved, so the products cannot be left at rest: only the centre-of-mass energy K·M/(M + m) is available. K_th = |Q|(1 + m_α/M_N) = 1.192 × (1 + 4/14) = <b>1.53 MeV</b>. An α of exactly 1.19 MeV bounces off.' }
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
        params: { mode: 'crit', rcm: 7, enr: 100, dens: 1, rods: 0, refl: true, seed: 1 } },
      { title: '10 · Walk down the uranium series',
        body: 'Each tile is a nuclide; its height is the log of its half-life. Watch the walk from U-238 to Pb-206.',
        ask: 'How many α and β⁻ does it take?',
        reveal: '<b>8 α and 6 β⁻.</b> Only α changes A, so n_α = ΔA/4 = 8. Those lower Z by 16, but Z falls only by 10, so six β⁻ must push it back up. The walk never leaves the valley of stability for long.',
        params: { mode: 'series', ser: 'U238' } },
      { title: '11 · Rutherford\'s gold foil',
        body: '5 MeV α on gold. The inset shows real orbits near one nucleus.',
        ask: 'Move the microscope from 60° to 150°. How does the count change?',
        reveal: '<b>It falls by about 1/sin⁴(θ/2): 45 times.</b> Yet some α come straight back, which a spread-out "plum pudding" atom could never do. Only a tiny, heavy, charged nucleus can.',
        params: { mode: 'ruth', tgt: 'Au', Ka: 5, thdet: 150, seed: 1 } },
      { title: '12 · When Rutherford fails',
        body: '30 MeV α on aluminium.',
        ask: 'Why does the formula stop working?',
        reveal: '<b>The α reaches the nucleus.</b> Its closest approach (3.6 fm) is inside the nuclear surface (4.8 fm), so the strong force joins in. Rutherford used exactly this to estimate the size of the nucleus.',
        params: { mode: 'ruth', tgt: 'Al', Ka: 30, thdet: 60, seed: 1 } },
      { title: '13 · Moderators',
        body: 'Neutrons from fission start at 2 MeV and must be slowed to 0.025 eV. Try hydrogen, then graphite, then lead.',
        ask: 'Why is lead useless, though it scatters neutrons well?',
        reveal: '<b>A light ball bouncing off a heavy one keeps its speed.</b> Each collision with lead takes only 1% on average, so it needs ~1900 collisions; hydrogen needs ~19. The best moderator has the mass of the neutron.',
        params: { mode: 'moder', mod: 'Pb', seed: 1 } },
      { title: '14 · The threshold of a reaction',
        body: 'An α hits N-14. Q is −1.19 MeV.',
        ask: 'An α of 1.4 MeV carries more than 1.19 MeV. Why does the reaction not happen?',
        reveal: '<b>Momentum.</b> The products must keep moving, so only the energy in the centre-of-mass frame, K × 14/18, is available: 1.09 MeV here. The threshold is 1.53 MeV.',
        params: { mode: 'bind', bsub: 'thresh', Kth: 1.4 } }
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
        why: 'Power grows as k^(t/ℓ) = 1.001¹⁰⁰⁰⁰ ≈ e¹⁰. Real reactors are controllable only because 0.65% of neutrons are delayed by seconds.' },
      { q: 'Th-232 decays to Pb-208. The numbers of α and β⁻ emitted are:',
        options: ['6 α and 4 β⁻', '4 α and 6 β⁻', '6 α and 6 β⁻', '8 α and 6 β⁻'], answer: 0,
        why: 'ΔA = 24 → 6 α (Z falls by 12); Z actually falls 90 → 82, by 8, so 4 β⁻ raised it back.' },
      { q: 'In Rutherford scattering, doubling the α kinetic energy changes the distance of closest approach by a factor:',
        options: ['1/2', '2', '1/4', '√2'], answer: 0,
        why: 'd = 2kZe²/K. And every impact parameter for a given angle halves too: the whole picture scales with d.' },
      { q: 'The best moderator for fast neutrons has nuclei whose mass is:',
        options: ['Close to the neutron\'s', 'Very large', 'Zero', 'Close to an α particle\'s'], answer: 0,
        why: 'Energy transfer in an elastic collision is greatest for equal masses: 4A/(1 + A)² = 1 at A = 1.' },
      { q: 'An endothermic reaction with Q = −2 MeV needs a projectile of mass m on a target of mass M = 4m. The threshold kinetic energy is:',
        options: ['2.5 MeV', '2 MeV', '8 MeV', '1.6 MeV'], answer: 0,
        why: 'K_th = |Q|(1 + m/M) = 2 × 1.25. The extra 0.5 MeV is the kinetic energy the centre of mass must keep.' },
      { q: 'Carbon dating cannot be used for samples older than about 50 000 years because:',
        options: ['The remaining C-14 activity is lost in the background count', 'C-14 stops decaying', 'Carbon becomes graphite', 'The half-life changes'], answer: 0,
        why: 'After ~9 half-lives the activity is 0.2% of living carbon; the counting error becomes larger than the signal.' }
    ],

    notes: '<b>Where this shows up in the paper.</b><ul>' +
      '<li><b>Decay law</b>: N = N₀e^(−λt), T½ = 0.693/λ, τ = 1/λ, activity A = λN; fraction left after n half-lives = 2⁻ⁿ.</li>' +
      '<li><b>Radiation</b>: α stopped by paper and a few cm of air; β by mm of aluminium; γ attenuated exponentially by lead. Counting statistics ±√N; dead time m = n/(1 + nτ).</li>' +
      '<li><b>Chains</b>: t_max = ln(λ_B/λ_A)/(λ_B − λ_A); transient equilibrium A_B/A_A = λ_B/(λ_B − λ_A); secular λ_A N_A = λ_B N_B; activation A = R(1 − e^(−λt)).</li>' +
      '<li><b>Mass and energy</b>: 1 u = 931.5 MeV/c²; B = Δm c²; Q from masses; K_α = Q(A − 4)/A; R = 1.2A^⅓ fm, constant density.</li>' +
      '<li><b>Fission and fusion</b>: about 200 MeV per fission, 17.6 MeV per D–T fusion; k = 1 critical; moderators slow neutrons; control rods absorb them.</li>' +
      '<li><b>Series and scattering</b>: n_α = ΔA/4, n_β = 2n_α − ΔZ; closest approach d = 2kZe²/K; b = (d/2)cot(θ/2); N ∝ 1/sin⁴(θ/2); head-on elastic transfer 4mM/(m + M)²; threshold K = −Q(1 + m/M).</li></ul>' +
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

  /* =========================================================================
     THERMAL · the JEE Advanced additions
     · A heating curve: ice at constant power, through melting, warming and
       boiling away. Enthalpy in, temperature out: the plateaus' lengths are
       the latent heats, the slopes are 1/mc.
     · A rod clamped between walls: free expansion, then stress once the gap
       closes.
     · Radial conduction through a spherical shell or a pipe wall, solved
       node by node: the temperature is NOT linear in r.
     · Ice growing on a lake: the Stefan problem solved by the enthalpy
       method — sensible heat, latent heat, conduction — and the thickness
       read off it. It grows as √t.
     · A planet's temperature: sunlight in, σT⁴ out, integrated to
       equilibrium, with or without a greenhouse layer.
     ========================================================================= */
  MAT.brick = { name: 'brick', K: 0.72, rho: 1920, c: 835, a: 5.5e-6, E: 14e9, col: '#B5563A' };
  MAT.cork = { name: 'cork', K: 0.045, rho: 240, c: 2000, a: 0, E: 0.02e9, col: '#C89B64' };

  function runHeat(p) {
    const m = p.madd / 1000, P = p.Pw, h0 = hH2O(p.Tice), hEnd = LF + CW * 100 + LV;
    const tEnd = m * (hEnd - h0) / P, n = 3000, out = [];
    for (let i = 0; i <= n; i++) {
      const t = tEnd * i / n, h = h0 + P * t / m, r = TH2O(h);
      out.push([t, r[0], r[1]]);
    }
    // the five stages, read off the run where the phase fraction changes
    // each stage boundary found by bisection on the run's own clock
    const st = t => TH2O(h0 + P * t / m).concat([t]);
    const find = f => { let a = 0, b = tEnd; for (let i = 0; i < 60; i++) { const c = (a + b) / 2; if (f(st(c))) b = c; else a = c; } return (a + b) / 2; };
    const t1 = find(o => o[1] > 1e-12), t2 = find(o => o[1] >= 1 && o[0] > 1e-9), t3 = find(o => o[1] > 1 + 1e-12);   // o = [T, phase fraction, t]
    const seg = [t1, t2 - t1, t3 - t2, tEnd - t3];
    return { out, m, P, tEnd, seg, t1, t2, t3, slopeIce: P / (m * CICE), slopeW: P / (m * CW),
             at: tt => { const k = clamp(tt / tEnd * n, 0, n), i = Math.floor(k), j = Math.min(n, i + 1), w = k - i; return out[i].map((v, c) => v * (1 - w) + out[j][c] * w); } };
  }

  function rodStress(p) {
    const M = MAT[p.srod], L = p.Ls, A = 1e-4, gap = p.gaps / 1000;
    const free = L * M.a * p.dTs, over = Math.max(0, free - gap), strain = over / L, sig = M.E * strain;
    return { M, L, A, gap, free, over, strain, sig, F: sig * A, u: 0.5 * sig * sig / M.E, dTclose: gap / (L * M.a) };
  }

  /* radial conduction: C ∂T/∂t = (1/g) ∂/∂r (g K ∂T/∂r), g = r² (sphere) or r (pipe), implicit */
  function runShell(p) {
    const M = MAT[p.shm], r1 = p.ra / 100, r2 = p.rb / 100, N = 120, dr = (r2 - r1) / N, sph = p.geo === 'sphere';
    const gf = r => sph ? r * r : r, D = M.K / (M.rho * M.c), tEnd = 2.5 * (r2 - r1) * (r2 - r1) / D;
    const r = []; for (let i = 0; i <= N; i++) r.push(r1 + i * dr);
    let T = r.map(() => 20); T[0] = 100; T[N] = 0;
    const steps = 2000, dt = tEnd / steps, snaps = [], cap = M.rho * M.c / dt;
    const a = new Float64Array(N + 1), b = new Float64Array(N + 1), c = new Float64Array(N + 1), d = new Float64Array(N + 1);
    const Hof = TT => (sph ? 4 * Math.PI : 2 * Math.PI) * gf(r1 + dr / 2) * M.K * (TT[0] - TT[1]) / dr;   // per metre of pipe
    for (let s = 0; s <= steps; s++) {
      if (s % 20 === 0) snaps.push({ t: s * dt, T: T.slice(), H: Hof(T) });
      if (s === steps) break;
      for (let i = 0; i <= N; i++) {
        if (i === 0 || i === N) { a[i] = 0; b[i] = 1; c[i] = 0; d[i] = i ? 0 : 100; continue; }
        const gl = gf(r[i] - dr / 2) / gf(r[i]), gr = gf(r[i] + dr / 2) / gf(r[i]), k = M.K / (dr * dr);
        a[i] = -k * gl; c[i] = -k * gr; b[i] = cap + k * (gl + gr); d[i] = cap * T[i];
      }
      for (let i = 1; i <= N; i++) { const w = a[i] / b[i - 1]; b[i] -= w * c[i - 1]; d[i] -= w * d[i - 1]; }
      T[N] = d[N] / b[N]; for (let i = N - 1; i >= 0; i--) T[i] = (d[i] - c[i] * T[i + 1]) / b[i];
    }
    const last = snaps[snaps.length - 1], iMid = Math.round(N / 2);
    const Hf = sph ? 4 * Math.PI * M.K * r1 * r2 * 100 / (r2 - r1) : 2 * Math.PI * M.K * 100 / Math.log(r2 / r1);
    const Tf = x => sph ? 100 * (1 / x - 1 / r2) / (1 / r1 - 1 / r2) : 100 * Math.log(r2 / x) / Math.log(r2 / r1);
    return { M, r1, r2, r, N, snaps, sph, tEnd, H: last.H, Hf, Tmid: last.T[iMid], TmidF: Tf(r[iMid]), Tf, rmid: r[iMid] };
  }

  /* ice on a lake: enthalpy per volume e (0 = ice at 0 °C, ρL = water at 0 °C) on a vertical grid */
  function runLake(p) {
    const rho = 917, K_i = 2.22, K_w = 0.56, ci = CICE, dz = 0.005, N = 180, days = p.days, tEnd = days * DAY;
    const e = new Float64Array(N + 1).fill(rho * LF);
    const Tof = v => v < 0 ? v / (rho * ci) : v <= rho * LF ? 0 : (v - rho * LF) / (rho * CW);
    const frac = v => v <= 0 ? 0 : v >= rho * LF ? 1 : v / (rho * LF);
    const dt = 0.35 * dz * dz * rho * ci / K_i, out = [];
    let t = 0, nextOut = 0;
    const T = new Float64Array(N + 1), Kf = new Float64Array(N);
    const thick = () => { let x = 0; for (let i = 0; i <= N; i++) x += (1 - frac(e[i])) * dz; return x - dz / 2; };
    while (t <= tEnd) {
      for (let i = 0; i <= N; i++) T[i] = Tof(e[i]);
      T[0] = p.Tair;                                             // the surface sits at the air temperature
      if (t >= nextOut) { out.push([t, thick(), Array.from(T.slice(0, 120))]); nextOut += tEnd / 400; }
      for (let i = 0; i < N; i++) { const f = (frac(e[i]) + frac(e[i + 1])) / 2; Kf[i] = f * K_w + (1 - f) * K_i; }
      for (let i = 1; i < N; i++) e[i] += dt / (dz * dz) * (Kf[i] * (T[i + 1] - T[i]) - Kf[i - 1] * (T[i] - T[i - 1]));
      e[0] = rho * ci * p.Tair;
      t += dt;
    }
    const xf = tt => Math.sqrt(2 * K_i * (-p.Tair) * tt / (rho * LF));
    const tAt = x => { for (let i = 1; i < out.length; i++) if (out[i][1] >= x) { const a = out[i - 1], b = out[i]; return a[0] + (x - a[1]) / (b[1] - a[1]) * (b[0] - a[0]); } return NaN; };
    return { out, tEnd, xf, tAt, rho, K_i, dz, days, Tair: p.Tair, xEnd: out[out.length - 1][1],
             at: tt => out[Math.min(out.length - 1, Math.round(tt / tEnd * (out.length - 1)))] };
  }

  /* a planet in sunlight */
  const PLAN = { mercury: { name: 'Mercury', d: 0.387, a: 0.088 }, venus: { name: 'Venus', d: 0.723, a: 0.76 }, earth: { name: 'Earth', d: 1.0, a: 0.306 },
                 mars: { name: 'Mars', d: 1.524, a: 0.25 }, jupiter: { name: 'Jupiter', d: 5.2, a: 0.503 } };
  function runPlanet(p) {
    const Tsun = 5772, Rsun = 6.957e8, AU = 1.495978707e11, d = p.dAU * AU;
    const S = SIG * Math.pow(Tsun, 4) * Math.pow(Rsun / d, 2), inp = (1 - p.alb) * S / 4;
    const C = 1e8, Ca = 1e7, dt = DAY / 2, tEnd = 12 * YR, out = [];
    let Ts = 3, Ta = 3;
    const f = (ts, ta) => p.gh ? [(inp + SIG * Math.pow(ta, 4) - SIG * Math.pow(ts, 4)) / C, (SIG * Math.pow(ts, 4) - 2 * SIG * Math.pow(ta, 4)) / Ca] : [(inp - SIG * Math.pow(ts, 4)) / C, 0];
    for (let t = 0, i = 0; t <= tEnd; t += dt, i++) {
      if (i % 20 === 0) out.push([t, Ts, Ta]);
      const k1 = f(Ts, Ta), k2 = f(Ts + dt / 2 * k1[0], Ta + dt / 2 * k1[1]), k3 = f(Ts + dt / 2 * k2[0], Ta + dt / 2 * k2[1]), k4 = f(Ts + dt * k3[0], Ta + dt * k3[1]);
      Ts += dt / 6 * (k1[0] + 2 * k2[0] + 2 * k3[0] + k4[0]); Ta += dt / 6 * (k1[1] + 2 * k2[1] + 2 * k3[1] + k4[1]);
    }
    const Te = Math.pow(inp / SIG, 0.25);
    return { S, inp, Te, TeF: Tsun * Math.sqrt(Rsun / (2 * d)) * Math.pow(1 - p.alb, 0.25), Ts, Ta, out, tEnd, gh: p.gh, Tsun, Rsun, d,
             at: tt => { const k = clamp(tt / tEnd * (out.length - 1), 0, out.length - 1), i = Math.floor(k), j = Math.min(out.length - 1, i + 1), w = k - i; return out[i].map((v, c) => v * (1 - w) + out[j][c] * w); } };
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

  /* ======================= the heating curve ======================= */
  function drawHeat(S, g) {
    const ctx = g.ctx, th = g.theme, p = S.p, W = g.w, H = g.h, cam = S.cam, Hc = S.Hc;
    const narrow = W < 660, B = window.BENCH;
    const F = R3.Frame(ctx, cam, { ambient: 0.32, floorZ: 0 });
    const m = (x, y, z) => [x * KT, y * KT, z * KT];
    const tp = clamp(S.ts / 20, 0, 1) * Hc.tEnd, st = Hc.at(tp), T = st[1], fr = st[2];
    B.table(F, m(-22, 0, 0)[0], m(22, 0, 0)[0], m(0, -13, 0)[1], m(0, 13, 0)[1], 0, { legs: false, tone: '#6E4A2C', seed: 47, thick: 0.06 });
    // the hot plate, its element glowing
    R3.box(F, m(0, 0, 1.5), [16 * KT, 16 * KT, 3 * KT], '#2B3140', { shadow: false });
    F.push(m(0, 0, 3.05), () => { const q = cam.project(m(0, 0, 3.05)); if (!q.ok) return; const r = 6 * KT * q.s;
      const gr = ctx.createRadialGradient(q.x, q.y, 0, q.x, q.y, r); gr.addColorStop(0, 'rgba(255,110,40,.85)'); gr.addColorStop(1, 'rgba(255,60,20,0)');
      ctx.fillStyle = gr; ctx.beginPath(); ctx.ellipse(q.x, q.y, r, r * 0.45, 0, 0, TAU); ctx.fill(); }, 0.2);
    // what is in the beaker: solid, liquid, and what has boiled away
    const solid = Hc.m * (1 - clamp(fr, 0, 1)), liquid = fr <= 1 ? Hc.m * clamp(fr, 0, 1) : Hc.m * (2 - clamp(fr, 1, 2));
    const hw = liquid * 1000 / 100 * 3.2;
    if (hw > 0.02) liquidCyl(F, m(0, 0, 3.2), 5.2 * KT, hw * KT, RX.mix('#4DA8F0', tcol(T, 0, 100), 0.3), { alpha: 0.55 });
    if (solid > 1e-5) {
      const side = Math.cbrt(solid / 3 / 917) * 100;
      [[-1.6, -1.2], [1.4, -0.4], [0.1, 1.8]].forEach((q, i) => R3.box(F, m(q[0], q[1], 3.2 + Math.max(side / 2, hw - side * 0.3)), [side * KT, side * KT, side * KT], '#DDF2FF', { shadow: false, ambient: 0.6, axes: [[Math.cos(i), Math.sin(i), 0], [-Math.sin(i), Math.cos(i), 0], [0, 0, 1]] }));
    }
    glassCyl(F, m(0, 0, 3.2), 5.4 * KT, 11 * KT);
    if (fr > 1 && fr < 2) {
      const bl = [], sp = sprite('#F2F8FF', { glow: true });
      for (let i = 0; i < 16; i++) { const f = (S.ts * 1.3 + i / 16) % 1; bl.push([Math.sin(i * 2.1) * 0.35, Math.cos(i * 1.3) * 0.35, m(0, 0, 3.4 + f * hw)[2], 0.02, sp]); }
      for (let i = 0; i < 10; i++) { const f = (S.ts * 0.4 + i / 10) % 1; bl.push([Math.sin(i * 3) * 0.3, Math.cos(i * 2) * 0.3, m(0, 0, 15 + f * 9)[2], 0.08 + f * 0.1, sp]); }
      ballCloud(F, bl, m(0, 0, 8), -0.01);
    }
    const lg = [15, -2, 3.5];
    R3.box(F, m(lg[0], lg[1], lg[2]), [11 * KT, 6 * KT, 7 * KT], '#2B3344', { shadow: false });
    B.meter(F, m(lg[0], lg[1] - 3.7, 5.0), [0, -1, 0], 8.6 * KT, 2.4 * KT, { title: 'PROBE', value: T.toFixed(2), unit: '°C', colour: '#7FD0FF' });
    B.meter(F, m(lg[0], lg[1] - 3.7, 2.2), [0, -1, 0], 8.6 * KT, 2.4 * KT, { title: 'ENERGY IN', value: (Hc.P * tp / 1000).toFixed(2), unit: 'kJ', colour: '#F5B451' });
    R3.cylinder(F, m(-2.6, 2.2, 3.6), m(-2.6, 2.2, 16), 0.3 * KT, '#9AA6B8', { segments: 10, shadow: false });
    F.render();
    const stage = fr <= 0 ? 'ice warming' : fr < 1 ? 'MELTING at 0 °C' : T < 100 ? 'water warming' : fr < 2 ? 'BOILING at 100 °C' : 'all boiled away';
    header(g, (Hc.m * 1000).toFixed(0) + ' g of ice at ' + p.Tice.toFixed(0) + ' °C on a ' + Hc.P.toFixed(0) + ' W heater',
      't = ' + tfmt(tp) + ' · ' + stage + ' · solid ' + (solid * 1000).toFixed(1) + ' g · liquid ' + (liquid * 1000).toFixed(1) + ' g',
      'constant power in: a slope is P/mc, a plateau lasts mL/P — the graph IS the specific and latent heats', th.text);
    const rows = narrow ? 4 : 6, bw = narrow ? W - 24 : 300, bh = 26 + rows * 15 + 10;
    const row = gPanel(g, 12, H - bh - 30, bw, bh, 'THE FOUR STAGES, TIMED');
    row(0, 'ice warming · melting', tfmt(Hc.seg[0]) + ' · ' + tfmt(Hc.seg[1]), th.phys);
    row(1, 'water warming · boiling', tfmt(Hc.seg[2]) + ' · ' + tfmt(Hc.seg[3]), th.phys);
    row(2, 'boiling ÷ melting = L_v/L_f', (Hc.seg[3] / Hc.seg[1]).toFixed(3), th.ok);
    row(3, 'slope ice ÷ slope water = c_w/c_ice', (Hc.slopeIce / Hc.slopeW).toFixed(3), th.ok);
    if (!narrow) { row(4, 'slope while warming water', (Hc.slopeW * 60).toFixed(2) + ' K/min'); row(5, 'total energy', (Hc.P * Hc.tEnd / 1000).toFixed(1) + ' kJ'); }
  }

  /* ======================= a rod clamped between walls ======================= */
  function drawStress(S, g) {
    const ctx = g.ctx, th = g.theme, p = S.p, W = g.w, H = g.h, cam = S.cam;
    const narrow = W < 660, B = window.BENCH;
    const F = R3.Frame(ctx, cam, { ambient: 0.32, floorZ: 0 });
    const ramp = clamp(S.ts / 6, 0, 1), dT = p.dTs * ramp, Rs = rodStress(Object.assign({}, p, { dTs: dT })), Rf = S.Rs;
    const L = 2.2, zr = 0.45;
    B.table(F, -1.6, 1.6, -0.5, 0.5, 0, { legs: false, tone: '#5A4632', seed: 29, thick: 0.06 });
    R3.box(F, [-1.3, 0, 0.35], [0.2, 0.5, 0.7], '#8A8578', { shadow: false });
    R3.box(F, [1.3, 0, 0.35], [0.2, 0.5, 0.7], '#8A8578', { shadow: false });
    // the rod: drawn to fill the span except the gap, which is exaggerated ×400 so it can be seen closing
    const gapNow = Math.max(0, Rs.gap - Rs.free), gx = Math.min(0.35, gapNow * 400);
    R3.cylinder(F, [-1.2, 0, zr], [1.2 - gx, 0, zr], 0.05, RX.mix(Rs.M.col, tcol(20 + dT, 0, 300), Math.min(0.6, dT / 300)), { segments: 20, shadow: false });
    if (dT > 0) F.push([0, 0, 0.1], () => { const q = cam.project([0, 0, 0.18]); if (!q.ok) return; for (let k = -3; k <= 3; k++) { const q2 = cam.project([k * 0.3, 0, 0.18]); if (!q2.ok) continue; const r = 10 + Math.sin(S.ts * 11 + k) * 2;
      const gr = ctx.createRadialGradient(q2.x, q2.y + 5, 0, q2.x, q2.y, r * 1.6); gr.addColorStop(0, 'rgba(160,210,255,.9)'); gr.addColorStop(1, 'rgba(60,90,255,0)'); ctx.fillStyle = gr; ctx.beginPath(); ctx.ellipse(q2.x, q2.y, r * 0.5, r * 1.4, 0, 0, TAU); ctx.fill(); } }, 0);
    if (Rs.sig > 0) {
      R3.arrow(F, [1.18, 0, zr + 0.18], [1.18 + 0.25, 0, zr + 0.18], 0.015, '#FF8FB0', { vivid: true });
      R3.arrow(F, [-1.18, 0, zr + 0.18], [-1.18 - 0.25, 0, zr + 0.18], 0.015, '#FF8FB0', { vivid: true });
      R3.label(F, [0, 0, zr + 0.35], 'pushing on each wall: ' + (Rs.F / 1000).toFixed(2) + ' kN', '#FF8FB0', { size: 10.5 });
    } else R3.label(F, [1.2 - gx / 2, 0, zr + 0.2], 'gap ' + (gapNow * 1000).toFixed(3) + ' mm (drawn ×400)', '#9FD8FF', { size: 9.5 });
    F.render();
    header(g, 'A ' + Rs.M.name + ' rod, ' + p.Ls.toFixed(2) + ' m, between rigid walls · heated by ' + dT.toFixed(0) + ' of ' + p.dTs.toFixed(0) + ' K',
      'cross-section 1 cm² · starting gap ' + p.gaps.toFixed(2) + ' mm · Y = ' + (Rs.M.E / 1e9).toFixed(0) + ' GPa · α = ' + (Rs.M.a * 1e6).toFixed(1) + ' × 10⁻⁶ /K',
      'free expansion LαΔT until the gap closes; after that the walls push back: σ = Y(LαΔT − gap)/L', th.text);
    const rows = narrow ? 4 : 6, bw = narrow ? W - 24 : 300, bh = 26 + rows * 15 + 10;
    const row = gPanel(g, 12, H - bh - 30, bw, bh, 'EXPANSION, THEN STRESS');
    row(0, 'free expansion LαΔT', (Rf.free * 1000).toFixed(3) + ' mm');
    row(1, 'ΔT that closes the gap', Rf.dTclose.toFixed(1) + ' K');
    row(2, 'thermal stress at the end', (Rf.sig / 1e6).toFixed(2) + ' MPa', th.phys);
    row(3, 'force on each wall', (Rf.F / 1000).toFixed(3) + ' kN', th.ok);
    if (!narrow) { row(4, 'with no gap it would be YαΔT', (Rf.M.E * Rf.M.a * p.dTs / 1e6).toFixed(2) + ' MPa'); row(5, 'elastic energy stored', (Rf.u * Rf.A * Rf.L).toFixed(3) + ' J'); }
  }

  /* an annulus of temperature bands, filled on a plane (u, v unit vectors at centre c) */
  function annulus(F, c, u, v, r1, r2, Tfn, half, bias) {
    const ctx = F.ctx, cam = F.cam, nb = 24, seg = 40;
    F.push(c, () => {
      for (let k = 0; k < nb; k++) {
        const ra = r1 + (r2 - r1) * k / nb, rb = r1 + (r2 - r1) * (k + 1) / nb, Tm = Tfn((ra + rb) / 2);
        const pts = [], a0 = half ? 0 : 0, a1 = half ? Math.PI : TAU;
        for (let i = 0; i <= seg; i++) { const a = a0 + (a1 - a0) * i / seg; pts.push([c[0] + (u[0] * Math.cos(a) + v[0] * Math.sin(a)) * rb, c[1] + (u[1] * Math.cos(a) + v[1] * Math.sin(a)) * rb, c[2] + (u[2] * Math.cos(a) + v[2] * Math.sin(a)) * rb]); }
        for (let i = seg; i >= 0; i--) { const a = a0 + (a1 - a0) * i / seg; pts.push([c[0] + (u[0] * Math.cos(a) + v[0] * Math.sin(a)) * ra, c[1] + (u[1] * Math.cos(a) + v[1] * Math.sin(a)) * ra, c[2] + (u[2] * Math.cos(a) + v[2] * Math.sin(a)) * ra]); }
        const q = pts.map(pp => cam.project(pp)); if (q.some(x => !x.ok)) continue;
        ctx.fillStyle = tcol(Tm, 0, 100); ctx.beginPath(); q.forEach((x, i) => i ? ctx.lineTo(x.x, x.y) : ctx.moveTo(x.x, x.y)); ctx.closePath(); ctx.fill();
      }
    }, bias || 0);
  }
  /* ======================= radial conduction ======================= */
  function drawShell(S, g) {
    const ctx = g.ctx, th = g.theme, p = S.p, W = g.w, H = g.h, cam = S.cam, Sh = S.Sh;
    const narrow = W < 660;
    const F = R3.Frame(ctx, cam, { ambient: 0.34, floorZ: null });
    const k = Math.floor(clamp(S.ts / 20, 0, 1) * (Sh.snaps.length - 1)), sn = Sh.snaps[k];
    const sc = 1.0 / Sh.r2, Tat = r => { const i = clamp(Math.round((r / sc - Sh.r1) / (Sh.r2 - Sh.r1) * Sh.N), 0, Sh.N); return sn.T[i]; };
    if (Sh.sph) {
      R3.wireSphere(F, [0, 0, 0], 1.0, '#C9A080', { lat: 6, lon: 10, alpha: 0.12, limbAlpha: 0.5, limbWidth: 1.2 });
      annulus(F, [0, 0, 0], [1, 0, 0], [0, 0, 1], Sh.r1 * sc, 1.0, Tat, false, -0.2);
      R3.sphere(F, [0, 0.02, 0], Sh.r1 * sc * 0.95, '#FF8A4A', { shadow: false, vivid: true });
      R3.label(F, [0, 0, 1.15], 'spherical shell, cut through its centre', '#DCE3EE', { size: 10 });
    } else {
      [-1.2, 1.2].forEach(x => { const ring = [], ring2 = []; for (let i = 0; i <= 48; i++) { const a = i / 48 * TAU; ring.push([x, Math.cos(a), Math.sin(a)]); ring2.push([x, Math.cos(a) * Sh.r1 * sc, Math.sin(a) * Sh.r1 * sc]); } path3(F, ring, '#C9A080', { alpha: 0.6, width: 1.2, chunk: 6 }); path3(F, ring2, '#FF8A4A', { alpha: 0.8, width: 1.2, chunk: 6 }); });
      [0, Math.PI / 2, Math.PI, 1.5 * Math.PI].forEach(a => path3(F, [[-1.2, Math.cos(a), Math.sin(a)], [1.2, Math.cos(a), Math.sin(a)]], '#C9A080', { alpha: 0.35, width: 1, chunk: 1 }));
      annulus(F, [1.2, 0, 0], [0, 1, 0], [0, 0, 1], Sh.r1 * sc, 1.0, Tat, false, -0.2);
      R3.label(F, [0, 0, 1.3], 'a thick pipe: steam inside, 0 °C outside', '#DCE3EE', { size: 10 });
    }
    F.render();
    header(g, (Sh.sph ? 'Heat through a spherical shell' : 'Heat through a pipe wall') + ' of ' + Sh.M.name + ' · 100 °C inside, 0 °C outside',
      'r₁ = ' + p.ra.toFixed(1) + ' cm, r₂ = ' + p.rb.toFixed(1) + ' cm · t = ' + tfmt(sn.t) + ' · solved node by node in r (implicit)',
      'the same heat crosses every shell, and the area grows with r, so the gradient must fall: T is not linear in r', th.text);
    const rows = narrow ? 4 : 6, bw = narrow ? W - 24 : 300, bh = 26 + rows * 15 + 10;
    const row = gPanel(g, 12, H - bh - 30, bw, bh, 'STEADY STATE, SOLVED');
    row(0, 'heat current' + (Sh.sph ? '' : ' per metre'), Sh.H.toFixed(3) + ' W', th.phys);
    row(1, Sh.sph ? '4πK r₁r₂ ΔT/(r₂ − r₁)' : '2πK ΔT/ln(r₂/r₁)', Sh.Hf.toFixed(3) + ' W', th.ok);
    row(2, 'temperature half-way through', Sh.Tmid.toFixed(2) + ' °C (not 50)');
    row(3, 'formula at r = ' + (Sh.rmid * 100).toFixed(1) + ' cm', Sh.TmidF.toFixed(2) + ' °C');
    if (!narrow) { row(4, 'thermal resistance', (100 / Sh.Hf).toFixed(4) + ' K/W'); row(5, 'time to settle', '≈ ' + tfmt(Sh.tEnd / 2)); }
  }

  /* ======================= ice on a lake ======================= */
  function drawLake(S, g) {
    const ctx = g.ctx, th = g.theme, p = S.p, W = g.w, H = g.h, cam = S.cam, Lk = S.Lk;
    const narrow = W < 660;
    const F = R3.Frame(ctx, cam, { ambient: 0.34, floorZ: null });
    const o = Lk.at(clamp(S.ts / 20, 0, 1) * Lk.tEnd), x = o[1], ks = 2.0;          // scene units per metre of depth
    const zT = 0.45, D = 1.0, w = 1.1;
    const box = (z0, z1, col, a, bias) => {
      const P8 = [[-w, -0.5, z0], [w, -0.5, z0], [-w, 0.5, z0], [w, 0.5, z0], [-w, -0.5, z1], [w, -0.5, z1], [-w, 0.5, z1], [w, 0.5, z1]];
      F.push([0, 0, (z0 + z1) / 2], () => { convexFill(ctx, cam, P8, RX.rgba(col, a), 'rgba(220,240,255,.25)'); }, bias);
    };
    box(zT - D, zT - x * ks, '#2F7FC8', 0.55, 0.02);
    // the ice: bands coloured by the computed temperature, top (air temperature) to bottom (0 °C)
    const n = Math.max(1, Math.round(x / Lk.dz));
    for (let i = 0; i < n; i++) {
      const z1 = zT - i * Lk.dz * ks, z0 = zT - Math.min(x, (i + 1) * Lk.dz) * ks, T = o[2][Math.min(o[2].length - 1, i)];
      flatPoly(F, [[-w, -0.501, z0], [w, -0.501, z0], [w, -0.501, z1], [-w, -0.501, z1]], RX.rgba(RX.mix('#EAF6FF', tcol(T, p.Tair, 5), 0.35), 0.95), { bias: -0.01 });
    }
    if (x > 0.001) box(zT - x * ks, zT, '#E6F3FF', 0.35, 0.01);
    R3.label(F, [w + 0.1, -0.5, zT + 0.1], 'air ' + p.Tair.toFixed(0) + ' °C', '#9FD8FF', { size: 10, align: 'left' });
    R3.callout(F, [w, -0.5, zT - x * ks / 2], 40, 0, 'ice ' + (x * 100).toFixed(2) + ' cm', '#EAF6FF', { size: 10 });
    R3.label(F, [w + 0.1, -0.5, zT - D + 0.1], 'water at 0 °C', '#8FC8FF', { size: 10, align: 'left' });
    const flakes = [], sp = sprite('#FFFFFF', { glow: true });
    for (let i = 0; i < 30; i++) { const f = (S.ts * 0.15 + i / 30) % 1; flakes.push([Math.sin(i * 7.3) * w, Math.cos(i * 3.1) * 0.5, zT + 0.8 - f * 0.8, 0.012, sp]); }
    ballCloud(F, flakes, [0, 0, zT + 0.4], -0.02);
    F.render();
    header(g, 'A lake freezing under air at ' + p.Tair.toFixed(0) + ' °C · day ' + (o[0] / DAY).toFixed(1) + ' of ' + p.days,
      'enthalpy method: every layer carries its sensible and latent heat · the surface at the air temperature, the water below at 0 °C',
      'heat leaves through the ice already formed, so the thicker it gets the slower it grows: x ∝ √t', th.text);
    const rows = narrow ? 4 : 6, bw = narrow ? W - 24 : 300, bh = 26 + rows * 15 + 10;
    const row = gPanel(g, 12, H - bh - 30, bw, bh, 'THICKNESS, COMPUTED');
    row(0, 'ice now', (x * 100).toFixed(2) + ' cm', th.phys);
    row(1, '√(2KΔT t/ρL) now', (Lk.xf(o[0]) * 100).toFixed(2) + ' cm', th.ok);
    row(2, 'time to 10 cm · to 20 cm', tfmt(Lk.tAt(0.1)) + ' · ' + tfmt(Lk.tAt(0.2)));
    row(3, 'ratio (doubling the thickness)', (Lk.tAt(0.2) / Lk.tAt(0.1)).toFixed(3) + ' (x² → 4)');
    if (!narrow) { row(4, 'heat leaving through the ice now', x > 0.005 ? (Lk.K_i * (-p.Tair) / x).toFixed(1) + ' W/m²' : '—'); row(5, 'after ' + p.days + ' days', (Lk.xEnd * 100).toFixed(1) + ' cm'); }
  }

  /* ======================= a planet in sunlight ======================= */
  function drawPlanet(S, g) {
    const ctx = g.ctx, th = g.theme, p = S.p, W = g.w, H = g.h, cam = S.cam, Pl = S.Pl;
    const narrow = W < 660;
    const F = R3.Frame(ctx, cam, { ambient: 0.3, floorZ: null });
    const st = Pl.at(clamp(S.ts / 20, 0, 1) * Pl.tEnd), Ts = st[1];
    const sun = [-1.6, 0, 0], px = -1.6 + 0.9 + 1.4 * Math.log(1 + p.dAU) / Math.log(6.2), pl = [px, 0, 0];
    F.push(sun, () => { const q = cam.project(sun); if (!q.ok) return; const r = 0.42 * q.s;
      const gr = ctx.createRadialGradient(q.x, q.y, r * 0.3, q.x, q.y, r * 2.6); gr.addColorStop(0, 'rgba(255,240,200,.8)'); gr.addColorStop(1, 'rgba(255,200,80,0)');
      ctx.fillStyle = gr; ctx.beginPath(); ctx.arc(q.x, q.y, r * 2.6, 0, TAU); ctx.fill();
      ctx.fillStyle = bbColour(5772); ctx.beginPath(); ctx.arc(q.x, q.y, r, 0, TAU); ctx.fill(); }, 0);
    for (let i = -3; i <= 3; i++) path3(F, [[sun[0] + 0.45, i * 0.05, 0], [px - 0.16, i * 0.03, 0]], '#FFE9A0', { alpha: 0.35, width: 1, chunk: 1, dash: [6, 5] });
    R3.sphere(F, pl, 0.14, tcol(Ts - 273.15, -150, 400), { shadow: false, rim: 0.8 });
    if (p.gh) R3.wireSphere(F, pl, 0.19, '#9FE0C0', { lat: 3, lon: 6, alpha: 0.2, limbAlpha: 0.6 });
    R3.label(F, [sun[0], 0, 0.62], 'the Sun · 5772 K', '#FFE9A0', { size: 10 });
    R3.label(F, [px, 0, 0.35], p.dAU.toFixed(2) + ' AU · ' + Ts.toFixed(1) + ' K (' + (Ts - 273.15).toFixed(1) + ' °C)', tcol(Ts - 273.15, -150, 400), { size: 10 });
    F.render();
    header(g, 'A planet at ' + p.dAU.toFixed(2) + ' AU, albedo ' + p.alb.toFixed(2) + (p.gh ? ', with a greenhouse layer' : ''),
      'sunlight in (1 − a)S πR², σT⁴ 4πR² out, integrated from 3 K (RK4, a 25 m ocean-deep heat store) · t = ' + (st[0] / YR).toFixed(2) + ' yr',
      'S = σT_sun⁴ (R_sun/d)², and T = T_sun √(R_sun/2d) (1 − a)^¼ — distance, not size, sets the temperature', th.text);
    const rows = narrow ? 4 : 6, bw = narrow ? W - 24 : 300, bh = 26 + rows * 15 + 10;
    const row = gPanel(g, 12, H - bh - 30, bw, bh, 'ENERGY BALANCE, INTEGRATED');
    row(0, 'sunlight at this distance (S)', Pl.S.toFixed(1) + ' W/m²', th.phys);
    row(1, 'equilibrium, integrated', Pl.Ts.toFixed(2) + ' K', th.phys);
    row(2, 'T_sun √(R/2d)(1 − a)^¼', Pl.TeF.toFixed(2) + ' K', th.ok);
    row(3, 'absorbed per m² of surface', Pl.inp.toFixed(1) + ' W/m²');
    if (!narrow) { row(4, p.gh ? 'the layer above radiates at' : 'no atmosphere', p.gh ? Pl.Ta.toFixed(1) + ' K' : '—'); row(5, 'surface ÷ bare equilibrium', (Pl.Ts / Pl.Te).toFixed(4) + (p.gh ? ' (2^¼ = 1.1892)' : '')); }
  }

  const CAL = S => S.p.mode === 'calor', EXP = S => S.p.mode === 'expand', CND = S => S.p.mode === 'conduct', RAD = S => S.p.mode === 'radiate',
        BIM = S => EXP(S) && S.p.esub === 'bimetal', FLK = S => EXP(S) && S.p.esub === 'flask', CLK = S => EXP(S) && S.p.esub === 'clock',
        ICE = S => CAL(S) && S.p.add === 'ice', MTL = S => CAL(S) && S.p.add === 'metal',
        SER = S => CND(S) && S.p.csub === 'series', ING = S => CND(S) && S.p.csub === 'ingen',
        COO = S => RAD(S) && S.p.rsub === 'cool', SPC = S => RAD(S) && S.p.rsub === 'spectrum',
        HTR = S => CAL(S) && S.p.add === 'heater', MIX = S => CAL(S) && S.p.add !== 'heater', STR = S => EXP(S) && S.p.esub === 'stress',
        SHL = S => CND(S) && S.p.csub === 'shell', LAK = S => CND(S) && S.p.csub === 'lake', PLN = S => RAD(S) && S.p.rsub === 'planet',
        ROD2 = S => CND(S) && (S.p.csub === 'series' || S.p.csub === 'parallel' || S.p.csub === 'ingen');
  const NEWT1 = S => { const p = S.p;
    if (p.mode === 'calor' && p.add === 'heater') return 'The heating curve: temperature against time at constant power';
    if (p.mode === 'expand' && p.esub === 'stress') return 'Stress in the rod against ΔT — nothing until the gap closes';
    if (p.mode === 'conduct' && p.csub === 'shell') return 'Temperature through the wall: solved, steady, and the linear guess';
    if (p.mode === 'conduct' && p.csub === 'lake') return 'Ice thickness against time — computed, and √(2KΔT t/ρL)';
    if (p.mode === 'radiate' && p.rsub === 'planet') return 'Surface temperature from a cold start to equilibrium';
    return null; };
  const NEWT2 = S => { const p = S.p;
    if (p.mode === 'calor' && p.add === 'heater') return 'Where the H₂O is: solid, liquid and boiled away';
    if (p.mode === 'expand' && p.esub === 'stress') return 'Stress per kelvin YαΔT for each metal, rod clamped with no gap';
    if (p.mode === 'conduct' && p.csub === 'shell') return 'Heat entering the inner surface, from switch-on';
    if (p.mode === 'conduct' && p.csub === 'lake') return 'Temperature down through the ice, now';
    if (p.mode === 'radiate' && p.rsub === 'planet') return 'Equilibrium temperature against distance — and the real planets';
    return null; };
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
              rsub: 'cool', rs: 3, Tenv: 20, T0c: 90, conv: true, Tbb: 5778,
              Pw: 500, srod: 'steel', Ls: 1, gaps: 0.5, dTs: 100, shm: 'brick', ra: 10, rb: 20, geo: 'sphere', Tair: -10, days: 10, dAU: 1, alb: 0.306, gh: false, run: true },

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
      { name: 'A blue giant · 20 000 K', params: { mode: 'radiate', rsub: 'spectrum', Tbb: 20000 } },
      { name: 'Heating curve · 100 g of ice, 500 W', params: { mode: 'calor', add: 'heater', madd: 100, Tice: -20, Pw: 500 } },
      { name: 'Rod between walls · the gap closes, then stress', params: { mode: 'expand', esub: 'stress', srod: 'steel', Ls: 1, gaps: 0.5, dTs: 100 } },
      { name: 'Rod between walls · no gap', params: { mode: 'expand', esub: 'stress', srod: 'aluminium', Ls: 1, gaps: 0, dTs: 50 } },
      { name: 'Spherical shell of brick', params: { mode: 'conduct', csub: 'shell', shm: 'brick', ra: 10, rb: 20, geo: 'sphere' } },
      { name: 'Lagged steam pipe (cylindrical)', params: { mode: 'conduct', csub: 'shell', shm: 'cork', ra: 5, rb: 15, geo: 'cyl' } },
      { name: 'Ice growing on a lake at −10 °C', params: { mode: 'conduct', csub: 'lake', Tair: -10, days: 10 } },
      { name: 'Earth without a greenhouse', params: { mode: 'radiate', rsub: 'planet', dAU: 1, alb: 0.306, gh: false } },
      { name: 'Earth with a greenhouse layer', params: { mode: 'radiate', rsub: 'planet', dAU: 1, alb: 0.306, gh: true } },
      { name: 'Mars', params: { mode: 'radiate', rsub: 'planet', dAU: 1.524, alb: 0.25, gh: false } }
    ],

    controls: [
      { group: 'What is set up', items: [
        { key: 'mode', type: 'select', label: 'Bench', restructure: true, rebuild: true, options: [
          { value: 'calor', label: 'Calorimeter' }, { value: 'expand', label: 'Thermal expansion' },
          { value: 'conduct', label: 'Conduction' }, { value: 'radiate', label: 'Radiation' }] }
      ] },
      { group: 'The calorimeter', items: [
        { key: 'add', type: 'select', label: 'Put in', restructure: true, rebuild: true, when: CAL, options: [
          { value: 'ice', label: 'Ice' }, { value: 'steam', label: 'Steam' }, { value: 'metal', label: 'A hot metal block' }, { value: 'heater', label: 'Ice on a heater (heating curve)' }] },
        { key: 'Pw', label: 'Heater power', min: 50, max: 2000, step: 10, unit: 'W', when: HTR, fmt: v => v.toFixed(0), restructure: true },
        { key: 'madd', label: 'Its mass', min: 5, max: 400, step: 1, unit: 'g', when: CAL, fmt: v => v.toFixed(0), restructure: true },
        { key: 'Tice', label: 'Ice temperature', min: -40, max: 0, step: 0.5, unit: '°C', when: S => ICE(S) || HTR(S), fmt: v => v.toFixed(1), restructure: true },
        { key: 'metal', type: 'select', label: 'Metal', restructure: true, when: MTL, options: METALS },
        { key: 'Tm', label: 'Metal temperature', min: 40, max: 300, step: 1, unit: '°C', when: MTL, fmt: v => v.toFixed(0), restructure: true },
        { key: 'mw', label: 'Water in the cup', min: 50, max: 400, step: 1, unit: 'g', when: MIX, fmt: v => v.toFixed(0), restructure: true },
        { key: 'Tw', label: 'Water temperature', min: 1, max: 90, step: 0.5, unit: '°C', when: MIX, fmt: v => v.toFixed(1), restructure: true },
        { key: 'mcal', label: 'Copper cup', min: 0, max: 300, step: 1, unit: 'g', when: MIX, fmt: v => v.toFixed(0), restructure: true },
        { key: 'lag', type: 'toggle', label: 'Perfectly lagged (no loss to the room)', restructure: true, when: MIX }
      ] },
      { group: 'Expansion', items: [
        { key: 'esub', type: 'select', label: 'Apparatus', restructure: true, rebuild: true, when: EXP, options: [
          { value: 'bimetal', label: 'Bimetallic strip' }, { value: 'flask', label: 'Liquid in a flask' }, { value: 'clock', label: 'Pendulum clocks' }, { value: 'stress', label: 'Rod clamped between walls' }] },
        { key: 'srod', type: 'select', label: 'Rod', restructure: true, when: STR, options: METALS },
        { key: 'Ls', label: 'Rod length', min: 0.2, max: 5, step: 0.05, unit: 'm', when: STR, fmt: v => v.toFixed(2), restructure: true },
        { key: 'gaps', label: 'Gap at one end', min: 0, max: 3, step: 0.01, unit: 'mm', when: STR, fmt: v => v.toFixed(2), restructure: true },
        { key: 'dTs', label: 'Temperature rise', min: 0, max: 300, step: 1, unit: 'K', when: STR, fmt: v => v.toFixed(0), restructure: true },
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
          { value: 'series', label: 'Two rods end to end' }, { value: 'parallel', label: 'Two rods side by side' }, { value: 'ingen', label: 'Ingen-Hausz (three rods)' },
          { value: 'shell', label: 'Radial: a shell or a pipe' }, { value: 'lake', label: 'Ice growing on a lake' }] },
        { key: 'geo', type: 'select', label: 'Shape', restructure: true, when: SHL, options: [{ value: 'sphere', label: 'Spherical shell' }, { value: 'cyl', label: 'Pipe (cylinder)' }] },
        { key: 'shm', type: 'select', label: 'Wall material', restructure: true, when: SHL, options: [{ value: 'brick', label: 'Brick' }, { value: 'cork', label: 'Cork' }, { value: 'glass', label: 'Glass' }, { value: 'steel', label: 'Steel' }] },
        { key: 'ra', label: 'Inner radius', min: 1, max: 30, step: 0.5, unit: 'cm', when: SHL, fmt: v => v.toFixed(1), restructure: true },
        { key: 'rb', label: 'Outer radius', min: 2, max: 40, step: 0.5, unit: 'cm', when: SHL, fmt: v => v.toFixed(1), restructure: true },
        { key: 'Tair', label: 'Air temperature', min: -40, max: -1, step: 0.5, unit: '°C', when: LAK, fmt: v => v.toFixed(1), restructure: true },
        { key: 'days', label: 'Days of frost', min: 2, max: 20, step: 1, unit: 'd', when: LAK, fmt: v => v.toFixed(0), restructure: true },
        { key: 'r1', type: 'select', label: 'Rod 1', restructure: true, when: ROD2, options: METALS },
        { key: 'r2', type: 'select', label: 'Rod 2', restructure: true, when: ROD2, options: METALS },
        { key: 'r3', type: 'select', label: 'Rod 3', restructure: true, when: ING, options: METALS },
        { key: 'L1', label: 'Length of rod 1', min: 5, max: 40, step: 0.5, unit: 'cm', when: S => CND(S) && (S.p.csub === 'series' || S.p.csub === 'parallel'), fmt: v => v.toFixed(1), restructure: true },
        { key: 'L2', label: 'Length of rod 2', min: 5, max: 40, step: 0.5, unit: 'cm', when: SER, fmt: v => v.toFixed(1), restructure: true }
      ] },
      { group: 'Radiation', items: [
        { key: 'rsub', type: 'select', label: 'Experiment', restructure: true, rebuild: true, when: RAD, options: [
          { value: 'cool', label: 'Cooling spheres' }, { value: 'spectrum', label: 'Black-body spectrum' }, { value: 'planet', label: 'A planet in sunlight' }] },
        { key: 'dAU', label: 'Distance from the Sun', min: 0.3, max: 6, step: 0.01, unit: 'AU', when: PLN, fmt: v => v.toFixed(2), restructure: true },
        { key: 'alb', label: 'Albedo (reflected fraction)', min: 0, max: 0.9, step: 0.005, unit: '', when: PLN, fmt: v => v.toFixed(3), restructure: true },
        { key: 'gh', type: 'toggle', label: 'A greenhouse layer (opaque to infrared)', restructure: true, when: PLN },
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
      if (p.mode === 'calor') { if (p.add === 'heater') S.Hc = runHeat(p); else S.Ca = runCal(p); }
      else if (p.mode === 'expand') { if (p.esub === 'bimetal') S.Bm = bimetal(p); else if (p.esub === 'flask') S.Fk = runFlask(p); else if (p.esub === 'stress') S.Rs = rodStress(p); else S.Ck = runClock(p); }
      else if (p.mode === 'conduct') { if (p.csub === 'shell') { if (p.rb <= p.ra + 0.5) p.rb = p.ra + 0.5; S.Sh = runShell(p); } else if (p.csub === 'lake') S.Lk = runLake(p); else S.Cd = runCond(p); }
      else { if (p.rsub === 'spectrum') S.Sp = runSpec(p); else if (p.rsub === 'planet') S.Pl = runPlanet(p); else S.Co = runCool(p); }
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
        'radiate-spectrum': { theta: -1.5, phi: 0.1, dist: 3.4, target: [0, 0, 0] },
        'expand-stress': { theta: -1.45, phi: 0.3, dist: 3.8, target: [0, 0, 0.3] },
        'conduct-shell': { theta: -1.25, phi: 0.3, dist: 3.6, target: [0, 0, 0] },
        'conduct-lake': { theta: -1.35, phi: 0.25, dist: 3.4, target: [0, 0, 0.05] },
        'radiate-planet': { theta: -1.57, phi: 0.35, dist: 3.8, target: [-0.3, 0, 0] }
      };
      const vk = p.mode === 'calor' ? 'calor' : p.mode + '-' + (p.mode === 'expand' ? p.esub : p.mode === 'conduct' ? p.csub : p.rsub);
      if (!S.cam || S._view !== vk) { S.cam = Camera(views[vk]); S.cam.minDist = 1.0; S.cam.maxDist = 16; S._view = vk; S._narrowCam = false; }
    },

    step(S, dt) {
      const p = S.p;
      if (!p.run) return;
      if (S.hold > 0) { S.hold -= dt; if (S.hold <= 0) S.ts = 0; return; }
      const end = p.mode === 'expand' && p.esub === 'stress' ? 1e9 : p.mode === 'radiate' && p.rsub === 'spectrum' ? 1e9 : p.mode === 'expand' && p.esub === 'flask' ? 18 : p.mode === 'expand' && p.esub === 'bimetal' ? 1e9 : 20;
      S.ts += dt;
      if (S.ts >= end) { S.ts = end; S.hold = 3; }
    },

    drawStage(S, g) {
      if (g.w < 660 && !S._narrowCam) { S.cam.dist *= 1.3; S._narrowCam = true; }
      const md = S.p.mode;
      const p = S.p;
      if (md === 'calor') { if (p.add === 'heater') drawHeat(S, g); else drawCal(S, g); }
      else if (md === 'expand') { if (p.esub === 'stress') drawStress(S, g); else drawExpand(S, g); }
      else if (md === 'conduct') { if (p.csub === 'shell') drawShell(S, g); else if (p.csub === 'lake') drawLake(S, g); else drawCond(S, g); }
      else { if (p.rsub === 'planet') drawPlanet(S, g); else drawRad(S, g); }
    },

    plots: [
      { title: S => NEWT1(S) || ({ calor: 'Both temperatures against time — the flat parts are latent heat', expand: { bimetal: 'Tip deflection against ΔT for this pair', flask: 'The level in the neck against time — it dips first', clock: 'Seconds lost in a day, accumulating' }[S.p.esub],
                       conduct: S.p.csub === 'ingen' ? 'Temperature along each rod, now' : 'Temperature along the rod, now — and at steady state', radiate: S.p.rsub === 'spectrum' ? 'Planck\'s spectrum — peak found numerically' : 'Both spheres cooling' })[S.p.mode],
        draw(S, g) {
          const p = S.p, th = g.theme, cy = '#3DD6F5', gr = '#7CF0B0', am = '#F5B451', pk = '#FF8FB0';
          if (p.mode === 'calor' && p.add === 'heater') {
            const Hc = S.Hc, tp = clamp(S.ts / 20, 0, 1) * Hc.tEnd, pts = Hc.out.filter((_, i) => i % 5 === 0).map(o => [o[0] / 60, o[1]]);
            const P = g.Plot({ xmin: 0, xmax: Hc.tEnd / 60, ymin: Math.min(-5, p.Tice - 5), ymax: 112, xlabel: 'time (min)', ylabel: '°C', xfmt: v => v.toFixed(0), yfmt: v => v.toFixed(0) }).frame();
            P.clip(() => { P.hline(0, g.alpha(th['text-3'], .6), [3, 3]); P.hline(100, g.alpha(th['text-3'], .6), [3, 3]); P.line(pts, am, 2.4); [Hc.t1, Hc.t2, Hc.t3].forEach(t => P.vline(t / 60, g.alpha(pk, .5), [2, 3])); P.vline(tp / 60, g.alpha(gr, .7), [3, 3]); });
            P.tag((Hc.t1 + Hc.t2) / 120, 0, 'melting ' + tfmt(Hc.seg[1]), cy, 'center', -8);
            P.tag((Hc.t3 + Hc.tEnd) / 120, 100, 'boiling ' + tfmt(Hc.seg[3]), cy, 'center', -8);
            return;
          }
          if (p.mode === 'expand' && p.esub === 'stress') {
            const pts = []; for (let d = 0; d <= 300; d += 2) pts.push([d, rodStress(Object.assign({}, p, { dTs: d })).sig / 1e6]);
            const hi = Math.max(10, ...pts.map(q => q[1])) * 1.1;
            const P = g.Plot({ xmin: 0, xmax: 300, ymin: 0, ymax: hi, xlabel: 'ΔT (K)', ylabel: 'stress (MPa)', xfmt: v => v.toFixed(0), yfmt: v => v.toFixed(0) }).frame();
            P.clip(() => { P.line(pts, pk, 2.2); P.vline(S.Rs.dTclose, g.alpha(cy, .7), [3, 3]); P.dot(p.dTs, S.Rs.sig / 1e6, 5.5, am, th['ink-950']); });
            P.tag(Math.min(290, S.Rs.dTclose), hi * 0.9, 'gap closes at ' + S.Rs.dTclose.toFixed(0) + ' K', cy, 'left', 0);
            return;
          }
          if (p.mode === 'conduct' && p.csub === 'shell') {
            const Sh = S.Sh, k = Math.floor(clamp(S.ts / 20, 0, 1) * (Sh.snaps.length - 1)), sn = Sh.snaps[k];
            const P = g.Plot({ xmin: Sh.r1 * 100, xmax: Sh.r2 * 100, ymin: -3, ymax: 105, xlabel: 'r (cm)', ylabel: '°C', xfmt: v => v.toFixed(0), yfmt: v => v.toFixed(0) }).frame();
            P.clip(() => { P.line([[Sh.r1 * 100, 100], [Sh.r2 * 100, 0]], g.alpha(th['text-3'], .7), 1.2, [4, 3]);
              P.line(Sh.r.map(r => [r * 100, Sh.Tf(r)]), g.alpha(am, .8), 1.4, [6, 3]); P.line(Sh.r.map((r, i) => [r * 100, sn.T[i]]), cy, 2.4); P.dot(Sh.rmid * 100, Sh.Tmid, 5, pk, th['ink-950']); });
            P.tag(Sh.r2 * 100, 50, 'a straight line would be wrong', th['text-3'], 'right', -8);
            P.tag(Sh.rmid * 100, Sh.Tmid, 'mid-wall ' + Sh.Tmid.toFixed(1) + ' °C', pk, 'left', 12);
            return;
          }
          if (p.mode === 'conduct' && p.csub === 'lake') {
            const Lk = S.Lk, tp = clamp(S.ts / 20, 0, 1) * Lk.tEnd, pts = Lk.out.map(o => [o[0] / DAY, o[1] * 100]), f = Lk.out.map(o => [o[0] / DAY, Lk.xf(o[0]) * 100]);
            const P = g.Plot({ xmin: 0, xmax: Lk.days, ymin: 0, ymax: Math.max(...f.map(q => q[1])) * 1.1, xlabel: 'days', ylabel: 'ice thickness (cm)', xfmt: v => v.toFixed(0), yfmt: v => v.toFixed(0) }).frame();
            P.clip(() => { P.line(f, g.alpha(am, .8), 1.4, [5, 3]); P.line(pts, cy, 2.4); P.vline(tp / DAY, g.alpha(gr, .7), [3, 3]); });
            P.tag(Lk.days * 0.98, f[f.length - 1][1], '√(2KΔT t/ρL)', am, 'right', -8);
            return;
          }
          if (p.mode === 'radiate' && p.rsub === 'planet') {
            const Pl = S.Pl, tp = clamp(S.ts / 20, 0, 1) * Pl.tEnd, a = Pl.out.map(o => [o[0] / YR, o[1]]), b = Pl.out.map(o => [o[0] / YR, o[2]]);
            const P = g.Plot({ xmin: 0, xmax: Pl.tEnd / YR, ymin: 0, ymax: Math.max(...a.map(q => q[1])) * 1.1, xlabel: 'years', ylabel: 'K', xfmt: v => v.toFixed(0), yfmt: v => v.toFixed(0) }).frame();
            P.clip(() => { P.hline(Pl.TeF, g.alpha(pk, .7), [4, 3]); if (p.gh) P.line(b, g.alpha(gr, .8), 1.4); P.line(a, am, 2.4); P.vline(tp / YR, g.alpha(gr, .7), [3, 3]); });
            P.tag(Pl.tEnd / YR * 0.98, Pl.TeF, 'bare equilibrium ' + Pl.TeF.toFixed(1) + ' K', pk, 'right', 10);
            return;
          }
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
      { title: S => NEWT2(S) || ({ calor: 'Final temperature against how much is added — the 0 °C shelf', expand: { bimetal: 'Curvature per kelvin for every pair of metals', flask: 'Volume against temperature: water\'s minimum at 4 °C', clock: 'Loss per day against temperature, for each rod' }[S.p.esub],
                       conduct: S.p.csub === 'ingen' ? 'Melted length² against K — a straight line' : 'Heat current into the ice, from switch-on', radiate: S.p.rsub === 'spectrum' ? 'Power against temperature (log–log): slope 4' : 'Cooling rate against excess temperature' })[S.p.mode],
        draw(S, g) {
          const p = S.p, th = g.theme, cy = '#3DD6F5', gr = '#7CF0B0', am = '#F5B451', pk = '#FF8FB0';
          if (p.mode === 'calor' && p.add === 'heater') {
            const Hc = S.Hc, s = [], l = [], v = [];
            Hc.out.forEach((o, i) => { if (i % 10) return; const fr = o[2], t = o[0] / 60; s.push([t, Hc.m * 1000 * (1 - clamp(fr, 0, 1))]); l.push([t, Hc.m * 1000 * (fr <= 1 ? clamp(fr, 0, 1) : 2 - clamp(fr, 1, 2))]); v.push([t, Hc.m * 1000 * clamp(fr - 1, 0, 1)]); });
            const P = g.Plot({ xmin: 0, xmax: Hc.tEnd / 60, ymin: 0, ymax: Hc.m * 1100, xlabel: 'time (min)', ylabel: 'grams', xfmt: v2 => v2.toFixed(0), yfmt: v2 => v2.toFixed(0) }).frame();
            P.clip(() => { P.line(s, '#DDF2FF', 2.2); P.line(l, cy, 2.2); P.line(v, pk, 2.2); });
            P.tag(Hc.t1 / 60, Hc.m * 1000, 'ice', '#DDF2FF', 'left', -8); P.tag(Hc.t2 / 60, Hc.m * 1000, 'water', cy, 'left', -8); P.tag(Hc.tEnd / 60 * 0.98, Hc.m * 1000, 'boiled away', pk, 'right', -8);
            return;
          }
          if (p.mode === 'expand' && p.esub === 'stress') {
            const ms = ['aluminium', 'brass', 'copper', 'steel', 'iron', 'invar'];
            const P = g.Plot({ xmin: -0.5, xmax: ms.length - 0.5, ymin: 0, ymax: 2.6, xlabel: '', ylabel: 'MPa per K (Yα)', xfmt: v2 => (ms[Math.round(v2)] || ''), yfmt: v2 => v2.toFixed(1) }).frame();
            P.clip(() => ms.forEach((k, i) => P.bar(i, MAT[k].E * MAT[k].a / 1e6, 0.35, 0, g.alpha(k === p.srod ? am : cy, .8))));
            return;
          }
          if (p.mode === 'conduct' && p.csub === 'shell') {
            const Sh = S.Sh, pts = Sh.snaps.map(q => [q.t / 60, q.H]), hi = Math.min(Math.max(...pts.map(q => q[1])), Sh.Hf * 4);
            const P = g.Plot({ xmin: 0, xmax: Sh.tEnd / 60, ymin: 0, ymax: hi * 1.1, xlabel: 'time (min)', ylabel: 'W' + (Sh.sph ? '' : ' per metre'), xfmt: v2 => v2.toFixed(0), yfmt: v2 => v2.toFixed(0) }).frame();
            P.clip(() => { P.hline(Sh.Hf, g.alpha(pk, .8), [4, 3]); P.line(pts, gr, 2.2); });
            P.tag(Sh.tEnd / 60 * 0.98, Sh.Hf, 'steady ' + Sh.Hf.toFixed(2) + ' W', pk, 'right', -8);
            return;
          }
          if (p.mode === 'conduct' && p.csub === 'lake') {
            const Lk = S.Lk, o = Lk.at(clamp(S.ts / 20, 0, 1) * Lk.tEnd), n = Math.min(o[2].length, Math.max(3, Math.round(o[1] / Lk.dz) + 6));
            const pts = []; for (let i = 0; i < n; i++) pts.push([i * Lk.dz * 100, o[2][i]]);
            const P = g.Plot({ xmin: 0, xmax: Math.max(3, n * Lk.dz * 100), ymin: p.Tair - 1, ymax: 2, xlabel: 'depth (cm)', ylabel: '°C', xfmt: v2 => v2.toFixed(0), yfmt: v2 => v2.toFixed(0) }).frame();
            P.clip(() => { P.hline(0, g.alpha(th['text-3'], .6), [3, 3]); P.line(pts, cy, 2.4); P.vline(o[1] * 100, g.alpha(pk, .7), [3, 3]); });
            P.tag(o[1] * 100, p.Tair * 0.5, 'bottom of the ice', pk, 'left', 0);
            return;
          }
          if (p.mode === 'radiate' && p.rsub === 'planet') {
            const pts = []; for (let d = 0.3; d <= 6; d += 0.05) pts.push([d, 5772 * Math.sqrt(6.957e8 / (2 * d * 1.495978707e11)) * Math.pow(1 - p.alb, 0.25)]);
            const real = [['Mercury', 0.387, 440], ['Venus', 0.723, 737], ['Earth', 1, 288], ['Mars', 1.524, 210], ['Jupiter', 5.2, 165]];
            const P = g.Plot({ xmin: 0, xmax: 6, ymin: 0, ymax: 760, xlabel: 'distance (AU)', ylabel: 'K', xfmt: v2 => v2.toFixed(0), yfmt: v2 => v2.toFixed(0) }).frame();
            P.clip(() => { P.line(pts, am, 2.2); real.forEach(r => P.dot(r[1], r[2], 4.5, cy)); P.dot(p.dAU, S.Pl.Ts, 6, pk, th['ink-950']); });
            real.forEach(r => P.tag(r[1], r[2], r[0], th['text-2'], 'left', -8));
            P.tag(5.9, pts[pts.length - 1][1], 'bare, albedo ' + p.alb.toFixed(2), am, 'right', -10);
            return;
          }
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
      if (p.mode === 'calor' && p.add === 'heater') { const Hc = S.Hc, st = Hc.at(clamp(S.ts / 20, 0, 1) * Hc.tEnd); return [
        { label: 'Temperature', value: st[1].toFixed(2), unit: '°C', flag: 'accent' }, { label: 'Melting took', value: Hc.seg[1].toFixed(1), unit: 's' },
        { label: 'Boiling took', value: Hc.seg[3].toFixed(1), unit: 's' }, { label: 'Ratio = L_v/L_f', value: (Hc.seg[3] / Hc.seg[1]).toFixed(3), unit: '', flag: 'ok' } ]; }
      if (p.mode === 'expand' && p.esub === 'stress') { const Rs = S.Rs; return [
        { label: 'Stress', value: (Rs.sig / 1e6).toFixed(2), unit: 'MPa', flag: 'accent' }, { label: 'Force on the walls', value: (Rs.F / 1000).toFixed(3), unit: 'kN' },
        { label: 'Free expansion', value: (Rs.free * 1000).toFixed(3), unit: 'mm' }, { label: 'Gap closes at', value: Rs.dTclose.toFixed(1), unit: 'K' } ]; }
      if (p.mode === 'conduct' && p.csub === 'shell') { const Sh = S.Sh; return [
        { label: 'Heat current', value: Sh.H.toFixed(3), unit: 'W', flag: 'accent' }, { label: 'Formula', value: Sh.Hf.toFixed(3), unit: 'W' },
        { label: 'Mid-wall temperature', value: Sh.Tmid.toFixed(2), unit: '°C', flag: 'warn' }, { label: 'Thermal resistance', value: (100 / Sh.Hf).toFixed(4), unit: 'K/W' } ]; }
      if (p.mode === 'conduct' && p.csub === 'lake') { const Lk = S.Lk, o = Lk.at(clamp(S.ts / 20, 0, 1) * Lk.tEnd); return [
        { label: 'Ice now', value: (o[1] * 100).toFixed(2), unit: 'cm', flag: 'accent' }, { label: '√(2KΔT t/ρL)', value: (Lk.xf(o[0]) * 100).toFixed(2), unit: 'cm' },
        { label: 'Time to 10 cm', value: (Lk.tAt(0.1) / 3600).toFixed(2), unit: 'h' }, { label: 't(20 cm)/t(10 cm)', value: (Lk.tAt(0.2) / Lk.tAt(0.1)).toFixed(3), unit: '' } ]; }
      if (p.mode === 'radiate' && p.rsub === 'planet') { const Pl = S.Pl; return [
        { label: 'Surface temperature', value: Pl.Ts.toFixed(2), unit: 'K', flag: 'accent' }, { label: 'Formula (bare)', value: Pl.TeF.toFixed(2), unit: 'K' },
        { label: 'Sunlight S', value: Pl.S.toFixed(1), unit: 'W/m²' }, { label: 'Absorbed per m²', value: Pl.inp.toFixed(1), unit: 'W/m²' } ]; }
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
      if (p.mode === 'calor' && p.add === 'heater') return E.frac(E.v('dT'), E.v('dt')) + ' ' + E.op('=') + ' ' + E.frac(E.v('P'), E.v('mc')) + ' · plateau ' + E.op('=') + ' ' + E.frac(E.v('mL'), E.v('P')) + ' · ' + E.frac(E.v('t') + E.sub('boil'), E.v('t') + E.sub('melt')) + ' ' + E.op('=') + ' ' + E.frac(E.v('L') + E.sub('v'), E.v('L') + E.sub('f')) + ' ' + E.op('=') + ' ' + E.n(S.Hc.seg[3] / S.Hc.seg[1], '');
      if (p.mode === 'expand' && p.esub === 'stress') return 'σ ' + E.op('=') + ' ' + E.v('Y') + E.frac(E.v('L') + 'αΔ' + E.v('T') + ' ' + E.op('−') + ' gap', E.v('L')) + ' ' + E.op('=') + ' ' + E.n(S.Rs.sig / 1e6, 'MPa');
      if (p.mode === 'conduct' && p.csub === 'shell') return S.Sh.sph ? E.v('H') + ' ' + E.op('=') + ' ' + E.frac('4π' + E.v('K') + E.v('r') + '₁' + E.v('r') + '₂Δ' + E.v('T'), E.v('r') + '₂ ' + E.op('−') + ' ' + E.v('r') + '₁') + ' ' + E.op('=') + ' ' + E.n(S.Sh.Hf, 'W')
        : E.v('H') + ' ' + E.op('=') + ' ' + E.frac('2π' + E.v('KL') + 'Δ' + E.v('T'), 'ln(' + E.v('r') + '₂/' + E.v('r') + '₁)') + ' ' + E.op('=') + ' ' + E.n(S.Sh.Hf, 'W per m');
      if (p.mode === 'conduct' && p.csub === 'lake') return 'ρ' + E.v('L') + ' ' + E.frac(E.v('dx'), E.v('dt')) + ' ' + E.op('=') + ' ' + E.frac(E.v('K') + 'Δ' + E.v('T'), E.v('x')) + ' → ' + E.v('x') + '² ' + E.op('=') + ' ' + E.frac('2' + E.v('K') + 'Δ' + E.v('T'), 'ρ' + E.v('L')) + ' ' + E.v('t');
      if (p.mode === 'radiate' && p.rsub === 'planet') return '(1 ' + E.op('−') + ' ' + E.v('a') + ')' + E.v('S') + 'π' + E.v('R') + '² ' + E.op('=') + ' σ' + E.v('T') + '⁴ 4π' + E.v('R') + '² → ' + E.v('T') + ' ' + E.op('=') + ' ' + E.n(S.Pl.TeF, 'K');
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
        working: '10/16.44 = k(75 − 20) and 10/t = k(65 − 20), so t = 16.44 × 55/45 = <b>20.1 min</b>. The integrated sphere takes 20.18 min. For the BLACK sphere the same estimate misses by 3%: its loss is mostly εσT⁴, which is not linear in ΔT.' },
      { source: 'JEE Main pattern · reading a heating curve',
        q: 'Ice is heated at constant power. The melting plateau lasts 66.8 s. How long does the boiling plateau last, in s? (L_f = 334 kJ/kg, L_v = 2256 kJ/kg)',
        params: { mode: 'calor', add: 'heater', madd: 100, Tice: -20, Pw: 500 },
        predict: { label: 'boiling time', unit: 's', tol: 0.01 },
        measure: S => S.Hc.seg[3],
        working: 'Same power, same mass, so plateau times are in the ratio of the latent heats: 66.8 × 2256/334 = <b>451 s</b>. The slopes tell the specific heats the same way: ice warms twice as fast as water.' },
      { source: 'JEE Main pattern · thermal stress',
        q: 'A 1.00 m steel rod (Y = 200 GPa, α = 1.2 × 10⁻⁵ /K) sits between rigid walls with a 0.50 mm gap. It is heated by 100 K. What stress develops, in MPa?',
        params: { mode: 'expand', esub: 'stress', srod: 'steel', Ls: 1, gaps: 0.5, dTs: 100 },
        predict: { label: 'stress', unit: 'MPa', tol: 0.01 },
        measure: S => S.Rs.sig / 1e6,
        working: 'Free expansion 1.00 × 1.2 × 10⁻⁵ × 100 = 1.2 mm; the first 0.5 mm is free. The walls compress the remaining 0.7 mm: σ = Y × 0.7/1000 = <b>140 MPa</b>. With no gap it would be YαΔT = 240 MPa.' },
      { source: 'JEE Advanced pattern · spherical shell',
        q: 'A spherical shell of inner radius 10 cm and outer radius 20 cm has its inside at 100 °C and outside at 0 °C. What is the steady temperature at r = 15 cm, in °C?',
        params: { mode: 'conduct', csub: 'shell', shm: 'brick', ra: 10, rb: 20, geo: 'sphere' },
        predict: { label: 'temperature', unit: '°C', tol: 0.01 },
        measure: S => S.Sh.Tmid,
        working: 'H = 4πKr²dT/dr is the same at every r, so T is linear in 1/r: T = 100(1/r − 1/20)/(1/10 − 1/20). At r = 15: 100 × (1/15 − 1/20)/(1/20) = <b>33.3 °C</b>, not 50: the inner layers, with less area, carry the steepest drop.' },
      { source: 'JEE Advanced pattern · ice on a lake',
        q: 'Ice on a pond grows under steady frost. It takes t hours to reach 10 cm. How long, as a multiple of t, does it take to reach 20 cm?',
        params: { mode: 'conduct', csub: 'lake', Tair: -10, days: 10 },
        predict: { label: 'multiple', unit: '× t', tol: 0.02 },
        measure: S => S.Lk.tAt(0.2) / S.Lk.tAt(0.1),
        working: 'Heat must leave through the ice already formed: ρL dx/dt = KΔT/x, so x² = 2KΔT t/ρL and t ∝ x². Twice as thick takes <b>4</b> times as long (so 3t more). The enthalpy run gives 3.95: the ice also has to be cooled below 0 °C, a small extra.' },
      { source: 'JEE Advanced pattern · temperature of a planet',
        q: 'The Sun (T = 5772 K, R = 6.96 × 10⁸ m) is 1.496 × 10¹¹ m away. Treating the Earth as a fast-spinning black body reflecting 30.6% of sunlight, what is its equilibrium temperature, in K?',
        params: { mode: 'radiate', rsub: 'planet', dAU: 1, alb: 0.306, gh: false },
        predict: { label: 'temperature', unit: 'K', tol: 0.01 },
        measure: S => S.Pl.Ts,
        working: 'Absorbed (1 − a)S πR² = emitted σT⁴ 4πR², with S = σT_sun⁴(R_sun/d)² = 1361 W/m². T = T_sun √(R_sun/2d)(1 − a)^¼ = <b>254 K</b>, 34 K below the real average: that is the greenhouse effect. The planet\'s own size cancels.' }
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
        params: { mode: 'radiate', rsub: 'spectrum', Tbb: 5778 } },
      { title: '9 · A heating curve',
        body: 'Ice on a 500 W heater, all the way to steam.',
        ask: 'Why is the boiling plateau almost seven times longer than the melting one?',
        reveal: '<b>L_v/L_f = 2256/334 = 6.75.</b> At constant power, time measures energy. The slopes measure 1/mc, so the ice line is twice as steep as the water line.',
        params: { mode: 'calor', add: 'heater', madd: 100, Tice: -20, Pw: 500 } },
      { title: '10 · Heat through a thick shell',
        body: 'A brick shell, 10 to 20 cm, hot inside.',
        ask: 'Half-way through the wall, is it 50 °C?',
        reveal: '<b>No: 33 °C.</b> The same heat must cross a smaller area near the inside, so the gradient is steepest there: T ∝ 1/r for a sphere, ln r for a pipe.',
        params: { mode: 'conduct', csub: 'shell', shm: 'brick', ra: 10, rb: 20, geo: 'sphere' } },
      { title: '11 · A lake freezing',
        body: 'Air at −10 °C over water at 0 °C.',
        ask: 'The first 10 cm take about 20 hours. How long for the next 10 cm?',
        reveal: '<b>About 60 hours more.</b> Thickness grows as √t because the heat has to escape through the ice already there. It is also why the water beneath stays liquid all winter.',
        params: { mode: 'conduct', csub: 'lake', Tair: -10, days: 10 } },
      { title: '12 · Why the Earth is not frozen',
        body: 'The Earth as a bare rock, then with a greenhouse layer.',
        ask: 'Without an atmosphere, what would the average temperature be?',
        reveal: '<b>254 K, −19 °C.</b> A layer that lets sunlight in but absorbs and re-radiates infrared lifts the surface by 2^¼, to 302 K. The real Earth, at 288 K, sits between.',
        params: { mode: 'radiate', rsub: 'planet', dAU: 1, alb: 0.306, gh: true } }
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
        why: 'The rod shortens, the period shortens, the clock runs fast. ½α|ΔT| × 86 400 s per day.' },
      { q: 'A rod fixed between rigid walls is heated by ΔT. The thermal stress depends on:',
        options: ['Y, α and ΔT but not the length', 'The length and the cross-section', 'Only α', 'The cross-section only'], answer: 0,
        why: 'σ = YαΔT: strain αΔT is independent of L. The FORCE is σA, so it depends on the cross-section.' },
      { q: 'Ice 5 cm thick formed in 10 h on a pond. Under the same conditions it will be 10 cm thick after about:',
        options: ['40 h', '20 h', '30 h', '80 h'], answer: 0,
        why: 't ∝ x²: doubling x takes four times as long.' },
      { q: 'The equilibrium temperature of a planet (a black body) varies with its distance d from the Sun as:',
        options: ['d^(−1/2)', 'd^(−2)', 'd^(−1)', 'd^(−1/4)'], answer: 0,
        why: 'Absorbed ∝ 1/d², emitted ∝ T⁴, so T⁴ ∝ 1/d² and T ∝ d^(−1/2). The planet\'s radius cancels.' },
      { q: 'Heat flows radially out through a spherical shell at steady state. The temperature gradient is:',
        options: ['Steepest at the inner surface', 'Uniform', 'Steepest at the outer surface', 'Zero in the middle'], answer: 0,
        why: 'H = 4πr²K dT/dr is constant, so dT/dr ∝ 1/r².' }
    ],

    notes: '<b>Where this shows up in the paper.</b><ul>' +
      '<li><b>Calorimetry</b>: heat lost = heat gained, including latent heats; always check whether all the ice melts or all the steam condenses before writing the final temperature.</li>' +
      '<li><b>Expansion</b>: ΔL = LαΔT, β = 2α, γ = 3α; thermal stress YαΔT in a clamped rod; bimetal 1/R ≈ 3ΔαΔT/2t; clocks lose ½αΔT per unit time; apparent γ = γ_real − γ_vessel; water\'s anomaly at 4 °C.</li>' +
      '<li><b>Conduction</b>: H = KAΔT/L; resistances L/KA add in series, conductances add in parallel; ice melted = Ht/L_f; Ingen-Hausz l² ∝ K.</li>' +
      '<li><b>More JEE Advanced</b>: heating curves (plateau ∝ L, slope ∝ 1/c); thermal stress YαΔT; radial conduction H = 4πKr₁r₂ΔT/(r₂ − r₁) and 2πKLΔT/ln(r₂/r₁); ice growth x² = 2KΔTt/ρL; planet temperature T = T_sun √(R/2d)(1 − a)^¼, solar constant σT⁴(R/d)².</li>' +
      '<li><b>Radiation</b>: P = εσAT⁴, net εσA(T⁴ − T₀⁴); Wien λ_max T = 2.898 × 10⁻³ m·K; good absorbers are good emitters (Kirchhoff); Newton\'s law for small ΔT, used in average-temperature form.</li></ul>' +
      '<div class="pyq"><em>Trap to avoid</em> — writing the calorimetry balance with a final temperature below 0 °C (or above 100 °C). If the answer is impossible, the phase change did not complete: the final temperature is the transition temperature and some solid (or vapour) remains.</div>' +
      '<div class="pyq"><em>Trap to avoid</em> — "Ingen-Hausz lengths are proportional to K". They go as √K, because the rod loses heat from its sides as it goes.</div>'
  });
})(window.InsightLab);
