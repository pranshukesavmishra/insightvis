/* ============================================================
   SOLVE — the shared numerics layer  (window.SOLVE)

   Sits beside render.js and render3d.js. Nothing here draws; it is
   the mathematics the labs are not allowed to fake. A lab that
   states a rule and then illustrates it is the thing this project
   exists to replace (memory §2.11 step 2), so every rule that can be
   computed is computed here and read back out.

   Contents
     lin      dense linear solve, Gaussian elimination + partial pivot
     Net      a resistive network solved by nodal analysis
     wave1d   the 1D wave equation, explicit, with real boundaries
     refract  Snell's law at an interface, in vectors
     hist     a histogram that accumulates, for counting experiments
   ============================================================ */
(function () {
  'use strict';

  /* ---------------- dense linear solve ----------------
     A x = b, in place, with partial pivoting. n is small in every use
     here (a circuit has tens of nodes, not thousands), so the O(n³)
     is free and the pivoting is what actually matters: a Wheatstone
     bridge at balance produces a genuinely singular-looking column
     and a naive elimination divides by ~1e-17. */
  function lin(A, b) {
    const n = b.length;
    // work on copies — the caller reuses its matrices between frames
    const M = A.map(r => r.slice()), x = b.slice();
    for (let k = 0; k < n; k++) {
      let piv = k, best = Math.abs(M[k][k]);
      for (let i = k + 1; i < n; i++) {
        const v = Math.abs(M[i][k]);
        if (v > best) { best = v; piv = i; }
      }
      if (best < 1e-14) return null;            // genuinely singular
      if (piv !== k) {
        const t = M[k]; M[k] = M[piv]; M[piv] = t;
        const tb = x[k]; x[k] = x[piv]; x[piv] = tb;
      }
      const d = M[k][k];
      for (let i = k + 1; i < n; i++) {
        const f = M[i][k] / d;
        if (!f) continue;
        for (let j = k; j < n; j++) M[i][j] -= f * M[k][j];
        x[i] -= f * x[k];
      }
    }
    for (let i = n - 1; i >= 0; i--) {
      let s = x[i];
      for (let j = i + 1; j < n; j++) s -= M[i][j] * x[j];
      x[i] = s / M[i][i];
    }
    return x;
  }

  /* ---------------- a resistive network ----------------
     Nodal analysis. Node 0 is ground and is eliminated, so the matrix
     is (n-1)x(n-1) and always non-singular for a connected network.

       G V = I        G[i][i] = sum of conductances at i
                      G[i][j] = -conductance between i and j
                      I[i]    = current injected into i

     An ideal voltage source is handled by MODIFIED nodal analysis:
     it adds one unknown (the current through it) and one equation
     (the potential difference it fixes). That is what lets a lab put
     a battery anywhere in the mesh instead of only across the ends.

       net = SOLVE.Net(nNodes)
       net.res(a, b, R)          a resistor
       net.bat(a, b, emf, r)     a cell, + terminal at b, internal r
       net.solve()               -> { V: [...], ok: true }
       net.I(a, b, R)            current a->b through that resistor  */
  function Net(nNodes) {
    const N = { n: nNodes, R: [], B: [] };

    N.res = function (a, b, R) {
      /* A real wire is not zero ohms in a solver, and the floor has to
         be generous: at 1e-9 the conductance is 1e9, the matrix loses
         conditioning and a Wheatstone null comes out at 1e-12 A instead
         of 1e-17. One microhm is a perfect conductor for any circuit a
         student will build here, and it keeps the null exact. */
      N.R.push({ a: a, b: b, R: Math.max(Math.abs(R), 1e-6) });
      return N;
    };
    // a cell of emf E with internal resistance r: the internal
    // resistance is a plain resistor, so only the ideal source needs
    // the extra unknown
    N.bat = function (a, b, emf, r) {
      N.B.push({ a: a, b: b, e: emf, r: r || 0 });
      return N;
    };

    N.solve = function () {
      const n = N.n, m = N.B.length;
      const sz = (n - 1) + m;                    // node 0 is ground
      const A = [], rhs = new Array(sz).fill(0);
      for (let i = 0; i < sz; i++) A.push(new Array(sz).fill(0));
      const ix = k => k - 1;                     // node index -> matrix row

      N.R.forEach(e => {
        const g = 1 / e.R;
        if (e.a) A[ix(e.a)][ix(e.a)] += g;
        if (e.b) A[ix(e.b)][ix(e.b)] += g;
        if (e.a && e.b) { A[ix(e.a)][ix(e.b)] -= g; A[ix(e.b)][ix(e.a)] -= g; }
      });
      // each battery: internal resistance as a resistor to a hidden
      // node would add a node, so instead fold it in as an emf in
      // series handled by the branch equation below
      N.B.forEach((s, k) => {
        const row = (n - 1) + k;
        // KCL: the branch current leaves a and enters b
        if (s.a) { A[ix(s.a)][row] += 1; A[row][ix(s.a)] += 1; }
        if (s.b) { A[ix(s.b)][row] -= 1; A[row][ix(s.b)] -= 1; }
        // branch: V(a) - V(b) + I*r = -emf   (+ terminal at b)
        A[row][row] = -s.r;   // V(a)-V(b)-I*r = -emf : the internal drop opposes
        rhs[row] = -s.e;
      });

      const x = lin(A, rhs);
      if (!x) return { ok: false, V: null, Ib: null };
      const V = new Array(n).fill(0);
      for (let k = 1; k < n; k++) V[k] = x[ix(k)];
      const Ib = [];
      for (let k = 0; k < m; k++) Ib.push(x[(n - 1) + k]);
      N.V = V; N.Ib = Ib;
      return { ok: true, V: V, Ib: Ib };
    };

    // current from a to b through a resistor of R ohms
    N.I = function (a, b, R) {
      if (!N.V) return 0;
      return (N.V[a] - N.V[b]) / Math.max(Math.abs(R), 1e-9);
    };
    return N;
  }

  /* ---------------- the 1D wave equation ----------------
     u_tt = c² u_xx, explicit second-order in time. Stable while the
     Courant number c·dt/dx <= 1; the stepper reports what it used so
     a lab can show the student the stability condition rather than
     hiding behind it.

     ends: 'fixed'  u = 0            (a clamped string, a closed pipe
                                      for DISPLACEMENT)
           'free'   du/dx = 0        (an open pipe end, a free ring)
     Each end is set independently, which is the whole of the
     open/closed organ-pipe question.                              */
  function wave1d(N, dx, c, ends) {
    const W = {
      n: N, dx: dx, c: c,
      u: new Float64Array(N), uPrev: new Float64Array(N), uNext: new Float64Array(N),
      ends: ends || ['fixed', 'fixed']
    };
    W.courant = dt => W.c * dt / W.dx;
    W.step = function (dt, drive) {
      const C = W.c * dt / W.dx, C2 = C * C;
      const u = W.u, up = W.uPrev, un = W.uNext;
      for (let i = 1; i < N - 1; i++)
        un[i] = 2 * u[i] - up[i] + C2 * (u[i + 1] - 2 * u[i] + u[i - 1]);
      /* Boundaries. A free end is du/dx = 0, and the obvious
         un[0] = un[1] places the antinode half a cell outside the
         grid — which shifts every pipe frequency by ~0.1% and would
         sit in the lab looking exactly like an end correction. Since
         this lab TEACHES the end correction as a real physical
         effect, the numerics must not fake one: reflect a ghost point
         instead (u[-1] = u[1]), which is second order and puts the
         frequencies on the analytic values. */
      if (W.ends[0] === 'free') un[0] = 2 * u[0] - up[0] + 2 * C2 * (u[1] - u[0]);
      else un[0] = 0;
      if (W.ends[1] === 'free') un[N - 1] = 2 * u[N - 1] - up[N - 1] + 2 * C2 * (u[N - 2] - u[N - 1]);
      else un[N - 1] = 0;
      if (drive) drive(un, dt);
      W.uPrev = u; W.u = un; W.uNext = up;
      return C;
    };
    W.reset = function () {
      W.u.fill(0); W.uPrev.fill(0); W.uNext.fill(0);
    };
    return W;
  }

  /* ---------------- Snell's law, in vectors ----------------
     d is the incoming unit direction, nrm the unit surface normal,
     n1/n2 the indices. Returns the refracted unit direction, or null
     when the ray is totally internally reflected — so TIR is an
     OUTPUT of the geometry and never a condition imposed by hand. */
  function refract(d, nrm, n1, n2) {
    let N0 = nrm.slice(), cosi = -(d[0] * N0[0] + d[1] * N0[1] + (d[2] || 0) * (N0[2] || 0));
    if (cosi < 0) { cosi = -cosi; N0 = [-N0[0], -N0[1], -(N0[2] || 0)]; }
    const eta = n1 / n2;
    const k = 1 - eta * eta * (1 - cosi * cosi);
    if (k < 0) return null;                        // total internal reflection
    const s = eta * cosi - Math.sqrt(k);
    return [eta * d[0] + s * N0[0], eta * d[1] + s * N0[1],
            eta * (d[2] || 0) + s * (N0[2] || 0)];
  }

  function reflect(d, nrm) {
    const dp = d[0] * nrm[0] + d[1] * nrm[1] + (d[2] || 0) * (nrm[2] || 0);
    return [d[0] - 2 * dp * nrm[0], d[1] - 2 * dp * nrm[1],
            (d[2] || 0) - 2 * dp * (nrm[2] || 0)];
  }

  /* ---------------- an accumulating histogram ----------------
     For counting experiments, where the distribution is the RESULT
     rather than the input: scattering into angle bins, decays per
     interval, speeds in a gas. */
  function hist(lo, hi, bins) {
    const H = { lo: lo, hi: hi, bins: bins, n: 0,
                count: new Float64Array(bins) };
    H.add = function (v, w) {
      const i = Math.floor((v - lo) / (hi - lo) * bins);
      if (i < 0 || i >= bins) return false;
      H.count[i] += (w == null ? 1 : w); H.n += (w == null ? 1 : w);
      return true;
    };
    H.reset = function () { H.count.fill(0); H.n = 0; };
    H.centre = i => lo + (i + 0.5) / bins * (hi - lo);
    H.max = function () { let m = 0; for (let i = 0; i < bins; i++) m = Math.max(m, H.count[i]); return m; };
    H.points = function (scale) {
      const k = scale == null ? 1 : scale, out = [];
      for (let i = 0; i < bins; i++) out.push([H.centre(i), H.count[i] * k]);
      return out;
    };
    return H;
  }

  window.SOLVE = { lin: lin, Net: Net, wave1d: wave1d, refract: refract,
                   reflect: reflect, hist: hist };
})();
