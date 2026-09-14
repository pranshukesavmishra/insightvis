/* ============================================================
   PHYSICS — 14. Kinetic theory: where Maxwell's curve comes from
   ============================================================ */
(function (L) {
  'use strict';
  const { clamp, TAU, fmt, E } = L;
  const PA = window.PHYSART, R3 = window.R3, RX = window.RX;
  const Camera = L.Camera;

  const KB = 1.380649e-23, NA = 6.02214076e23, R_GAS = KB * NA;

  const GASES = [
    { id: 'he',  name: 'Helium',   M: 4.003,  f: 3, d: 0.26, col: '#FFD36B' },
    { id: 'ne',  name: 'Neon',     M: 20.18,  f: 3, d: 0.30, col: '#FF9E6B' },
    { id: 'n2',  name: 'Nitrogen', M: 28.014, f: 5, d: 0.37, col: '#3DD6F5' },
    { id: 'o2',  name: 'Oxygen',   M: 31.998, f: 5, d: 0.35, col: '#7CE0A8' },
    { id: 'co2', name: 'Carbon dioxide', M: 44.01, f: 6, d: 0.45, col: '#B07CC6' },
    { id: 'xe',  name: 'Xenon',    M: 131.29, f: 3, d: 0.49, col: '#FF6B9D' }
  ];

  L.register({
    id: 'kinetic', subject: 'physics',
    name: 'Kinetic Theory — Where the Maxwell Curve Comes From',
    chapter: 'Kinetic Theory of Gases',
    exams: ['JEE Main', 'JEE Advanced', 'NEET UG'],
    weight: 'Very high yield',
    is3D: true,
    stageHint: 'Drag to orbit the box · every molecule collides for real, and the histogram is what they add up to',
    lede: 'The Maxwell–Boltzmann curve is normally handed to you as a formula to memorise. Here it is ' +
      '<b>not drawn at all</b>: a box of molecules is given random starting velocities, they collide ' +
      '<b>elastically with each other and with the walls</b>, and the histogram of their speeds is measured ' +
      'as the simulation runs. Within a few hundred collisions it settles onto the analytic curve — which ' +
      'nobody put there. The pressure is measured the same way, from the <b>momentum actually delivered to ' +
      'the walls</b>, and compared with nRT/V.',

    params: { gas: 'n2', T: 300, N: 220, Lnm: 14, dScale: 1.0, colourBySpeed: true, trails: false },

    presets: [
      { name: 'Nitrogen at room temperature', params: { gas: 'n2', T: 300, N: 220, Lnm: 14 } },
      { name: 'Heat it to 1200 K', params: { gas: 'n2', T: 1200 } },
      { name: 'Cool it to 80 K', params: { gas: 'n2', T: 80 } },
      { name: 'Helium — same T, far faster', params: { gas: 'he', T: 300 } },
      { name: 'Xenon — same T, far slower', params: { gas: 'xe', T: 300 } },
      { name: 'Compress the box', params: { Lnm: 9, N: 220 } },
      { name: 'Thin it out', params: { N: 60, Lnm: 18 } }
    ],

    controls: [
      { group: 'The gas', items: [
        { key: 'gas', type: 'select', label: 'Species', restructure: true,
          options: GASES.map(x => ({ value: x.id, label: x.name })) },
        { key: 'T', label: 'Temperature <i>T</i>', min: 40, max: 1500, step: 5, unit: 'K',
          fmt: v => v.toFixed(0), restructure: true },
        { key: 'N', label: 'Molecules <i>N</i>', min: 40, max: 400, step: 10, unit: '',
          fmt: v => v.toFixed(0), restructure: true },
        { key: 'Lnm', label: 'Box side <i>L</i>', min: 7, max: 22, step: 0.5, unit: 'nm',
          fmt: v => v.toFixed(1), restructure: true }
      ] },
      { group: 'Display', items: [
        { key: 'dScale', label: 'Drawn molecule size', min: 0.4, max: 2.5, step: 0.05, unit: '×',
          fmt: v => v.toFixed(2) },
        { key: 'colourBySpeed', type: 'toggle', label: 'Colour molecules by speed' },
        { key: 'trails', type: 'toggle', label: 'Show the path of one molecule' }
      ] }
    ],

    setup(S) {
      const p = S.p;
      const G = GASES.find(x => x.id === p.gas) || GASES[2];
      S.G = G;
      S.m = G.M * 1e-3 / NA;                       // mass of one molecule, kg
      S.L = p.Lnm * 1e-9;                          // box side, m
      S.V = Math.pow(S.L, 3);
      S.d = G.d * 1e-9;                            // collision diameter, m
      S.n = p.N / S.V;                             // number density
      S.nMol = p.N / NA;                           // moles

      // the three speeds the paper asks for, analytic
      S.vrmsTh = Math.sqrt(3 * KB * p.T / S.m);
      S.vmeanTh = Math.sqrt(8 * KB * p.T / (Math.PI * S.m));
      S.vmpTh = Math.sqrt(2 * KB * p.T / S.m);
      S.Pth = S.n * KB * p.T;                       // ideal-gas pressure
      S.mfpTh = 1 / (Math.SQRT2 * Math.PI * S.d * S.d * S.n);
      S.collRate = S.vmeanTh / S.mfpTh;             // collisions per second per molecule
      S.gamma = (G.f + 2) / G.f;
      S.Cv = G.f / 2 * R_GAS; S.Cp = S.Cv + R_GAS;

      if (!S.cam) {
        S.cam = Camera({ theta: -0.95, phi: 0.30, dist: 2.6, target: [0, 0, 0] });
        S.cam.minDist = 1.2; S.cam.maxDist = 8;
      }

      // (re)seed the population. Positions on a loose lattice so nothing
      // starts overlapping; velocities from a Maxwellian by the Box–Muller
      // transform, which is the honest way to start at temperature T.
      const sigma = Math.sqrt(KB * p.T / S.m);      // per-component standard deviation
      const gauss = () => {
        let u = 0, v = 0;
        while (u === 0) u = Math.random();
        while (v === 0) v = Math.random();
        return Math.sqrt(-2 * Math.log(u)) * Math.cos(TAU * v);
      };
      const side = Math.ceil(Math.cbrt(p.N));
      S.mol = [];
      for (let i = 0; i < p.N; i++) {
        const ix = i % side, iy = Math.floor(i / side) % side, iz = Math.floor(i / (side * side));
        S.mol.push({
          x: (ix + 0.5 + (Math.random() - 0.5) * 0.4) / side * S.L,
          y: (iy + 0.5 + (Math.random() - 0.5) * 0.4) / side * S.L,
          z: (iz + 0.5 + (Math.random() - 0.5) * 0.4) / side * S.L,
          vx: gauss() * sigma, vy: gauss() * sigma, vz: gauss() * sigma,
          sinceHit: 0, pathLen: 0, hits: 0
        });
      }
      // histogram of measured speeds, accumulated over the whole run
      S.bins = 44;
      S.vMaxHist = S.vmpTh * 3.4;
      S.hist = new Float64Array(S.bins);
      S.histN = 0;
      S.wallImpulse = 0; S.wallTime = 0; S.Pmeas = 0;
      S.mfpSum = 0; S.mfpCount = 0; S.mfpMeas = 0;
      S.collisions = 0; S.tSim = 0;
      S.trail = [];
      S.settled = 0;
      // seed the measured moments so the readouts are valid before the first
      // step — they are overwritten a frame later by the real measurement
      S.vrms = S.vrmsTh; S.vmean = S.vmeanTh; S.Tmeas = p.T;
    },

    step(S, dt) {
      const p = S.p;
      S.t = (S.t || 0) + dt;
      // Run in molecular time. One wall-crossing takes about a second of
      // wall-clock, so the motion is watchable at any temperature.
      const cross = S.L / Math.max(S.vrmsTh, 1);
      const sub = 6;
      const h = Math.min(dt, 0.05) * cross * 1.1 / sub;
      const N = S.mol.length, L2 = S.L, d = S.d;

      for (let it = 0; it < sub; it++) {
        S.tSim += h;
        // ---- drift, and the walls ----
        for (let i = 0; i < N; i++) {
          const q = S.mol[i];
          q.x += q.vx * h; q.y += q.vy * h; q.z += q.vz * h;
          q.pathLen += Math.hypot(q.vx, q.vy, q.vz) * h;
          // Pressure is MEASURED: every wall bounce reverses one momentum
          // component, and 2m|v| of impulse is delivered to that wall.
          if (q.x < 0)  { q.x = -q.x;             q.vx = -q.vx; S.wallImpulse += 2 * S.m * Math.abs(q.vx); }
          if (q.x > L2) { q.x = 2 * L2 - q.x;     q.vx = -q.vx; S.wallImpulse += 2 * S.m * Math.abs(q.vx); }
          if (q.y < 0)  { q.y = -q.y;             q.vy = -q.vy; S.wallImpulse += 2 * S.m * Math.abs(q.vy); }
          if (q.y > L2) { q.y = 2 * L2 - q.y;     q.vy = -q.vy; S.wallImpulse += 2 * S.m * Math.abs(q.vy); }
          if (q.z < 0)  { q.z = -q.z;             q.vz = -q.vz; S.wallImpulse += 2 * S.m * Math.abs(q.vz); }
          if (q.z > L2) { q.z = 2 * L2 - q.z;     q.vz = -q.vz; S.wallImpulse += 2 * S.m * Math.abs(q.vz); }
        }
        S.wallTime += h;

        // ---- molecule–molecule collisions, on a cell list ----
        // A uniform grid keeps this linear in N instead of quadratic, which is
        // what makes a few hundred molecules affordable at 60 fps.
        const cell = Math.max(d * 2, L2 / 12);
        const nc = Math.max(1, Math.floor(L2 / cell));
        const cs = L2 / nc;
        const head = new Int32Array(nc * nc * nc).fill(-1);
        const next = new Int32Array(N).fill(-1);
        const cid = (a, b, c) => (a * nc + b) * nc + c;
        for (let i = 0; i < N; i++) {
          const q = S.mol[i];
          const a = clamp(Math.floor(q.x / cs), 0, nc - 1);
          const b = clamp(Math.floor(q.y / cs), 0, nc - 1);
          const c = clamp(Math.floor(q.z / cs), 0, nc - 1);
          const k = cid(a, b, c);
          next[i] = head[k]; head[k] = i;
        }
        for (let a = 0; a < nc; a++) for (let b = 0; b < nc; b++) for (let c = 0; c < nc; c++) {
          for (let i = head[cid(a, b, c)]; i !== -1; i = next[i]) {
            for (let da = 0; da <= 1; da++) for (let db = (da ? -1 : 0); db <= 1; db++)
              for (let dc = (da || db ? -1 : 0); dc <= 1; dc++) {
                const a2 = a + da, b2 = b + db, c2 = c + dc;
                if (a2 >= nc || b2 < 0 || b2 >= nc || c2 < 0 || c2 >= nc) continue;
                const self = (da === 0 && db === 0 && dc === 0);
                for (let j = head[cid(a2, b2, c2)]; j !== -1; j = next[j]) {
                  // Within one cell each pair must be visited once, so skip
                  // j <= i. ACROSS cells the half-neighbour offsets already
                  // guarantee that, and applying the same test there silently
                  // drops about half the collisions — which showed up as a
                  // mean free path nearly twice too short.
                  if (self ? j <= i : j === i) continue;
                  const qi = S.mol[i], qj = S.mol[j];
                  const dx = qj.x - qi.x, dy = qj.y - qi.y, dz = qj.z - qi.z;
                  const r2 = dx * dx + dy * dy + dz * dz;
                  if (r2 > d * d || r2 < 1e-30) continue;
                  const r = Math.sqrt(r2);
                  const nx = dx / r, ny = dy / r, nz = dz / r;
                  const dvx = qj.vx - qi.vx, dvy = qj.vy - qi.vy, dvz = qj.vz - qi.vz;
                  const vn = dvx * nx + dvy * ny + dvz * nz;
                  if (vn > 0) continue;                 // already separating
                  // equal masses, perfectly elastic: exchange the normal component
                  qi.vx += vn * nx; qi.vy += vn * ny; qi.vz += vn * nz;
                  qj.vx -= vn * nx; qj.vy -= vn * ny; qj.vz -= vn * nz;
                  // push apart so they cannot stick
                  const ov = (d - r) / 2 + 1e-14;
                  qi.x -= nx * ov; qi.y -= ny * ov; qi.z -= nz * ov;
                  qj.x += nx * ov; qj.y += ny * ov; qj.z += nz * ov;
                  S.collisions++;
                  // mean free path is measured as the distance each molecule
                  // actually travelled between its own collisions
                  [qi, qj].forEach(q => {
                    if (q.hits > 0) { S.mfpSum += q.pathLen; S.mfpCount++; }
                    q.pathLen = 0; q.hits++;
                  });
                }
              }
          }
        }
      }

      // ---- the measurements ----
      if (S.wallTime > 0) {
        const area = 6 * S.L * S.L;
        S.Pmeas = S.wallImpulse / (S.wallTime * area);
      }
      if (S.mfpCount > 0) S.mfpMeas = S.mfpSum / S.mfpCount;

      // accumulate the speed histogram from the real population
      const dv = S.vMaxHist / S.bins;
      S.mol.forEach(q => {
        const v = Math.hypot(q.vx, q.vy, q.vz);
        const k = Math.floor(v / dv);
        if (k >= 0 && k < S.bins) S.hist[k] += 1;
      });
      S.histN += S.mol.length;

      // the moments, measured
      let s1 = 0, s2 = 0;
      S.mol.forEach(q => { const v = Math.hypot(q.vx, q.vy, q.vz); s1 += v; s2 += v * v; });
      S.vmean = s1 / S.mol.length;
      S.vrms = Math.sqrt(s2 / S.mol.length);
      S.Tmeas = S.m * s2 / S.mol.length / (3 * KB);
      S.settled = clamp(S.collisions / (S.mol.length * 8), 0, 1);

      if (p.trails && S.mol[0]) {
        S.trail.push([S.mol[0].x, S.mol[0].y, S.mol[0].z]);
        if (S.trail.length > 260) S.trail.shift();
      } else if (S.trail.length) S.trail.length = 0;
    },

    drawStage(S, g) {
      const ctx = g.ctx, th = g.theme, p = S.p, W = g.w, H = g.h;
      const cam = S.cam;
      const F = R3.Frame(ctx, cam, { ambient: 0.32, floorZ: null });
      const L2 = S.L;
      // work in box units so the camera never has to chase a nanometre
      const U = 1 / L2;
      const w2 = pt => [(pt[0] * U - 0.5), (pt[1] * U - 0.5), (pt[2] * U - 0.5)];

      /* ---------------- the container ---------------- */
      {
        const e = 0.5;
        const corners = [
          [-e, -e, -e], [e, -e, -e], [e, e, -e], [-e, e, -e],
          [-e, -e, e], [e, -e, e], [e, e, e], [-e, e, e]
        ];
        const edges = [[0,1],[1,2],[2,3],[3,0],[4,5],[5,6],[6,7],[7,4],[0,4],[1,5],[2,6],[3,7]];
        // the floor and the two far walls get a grid so depth is readable
        R3.plane(F, [-e, -e, -e], [2 * e, 0, 0], [0, 2 * e, 0], '#0E1626',
                 { grid: 8, gridColour: '#3E5280', gridAlpha: 0.20, edge: false });
        R3.plane(F, [-e, e, -e], [2 * e, 0, 0], [0, 0, 2 * e], '#0C1322',
                 { grid: 8, gridColour: '#3E5280', gridAlpha: 0.16, edge: false });
        R3.plane(F, [-e, -e, -e], [0, 2 * e, 0], [0, 0, 2 * e], '#0C1322',
                 { grid: 8, gridColour: '#3E5280', gridAlpha: 0.16, edge: false });
        edges.forEach(([a, b]) =>
          R3.polyline(F, [corners[a], corners[b]], '#9FB4DE', { alpha: 0.55, width: 1.4 }));
        R3.callout(F, [-e, -e, -e], -10, 18, 'L = ' + p.Lnm.toFixed(1) + ' nm', th['text-3']);
      }

      /* ---------------- the molecules ---------------- */
      {
        const rDraw = S.d * U * 0.5 * p.dScale;
        const vScale = Math.max(S.vmpTh * 2.6, 1);
        // A few hundred molecules cannot each afford the full lit-sphere
        // shader, so they get one gradient apiece — still round, still lit
        // from the same direction, a tenth of the cost.
        S.mol.forEach(q => {
          const v = Math.hypot(q.vx, q.vy, q.vz);
          const col = p.colourBySpeed
            ? RX.mix('#3A63C8', '#FF7A5E', clamp(v / vScale, 0, 1))
            : S.G.col;
          const wp = w2([q.x, q.y, q.z]);
          const pr = cam.project(wp);
          if (!pr.ok) return;
          const rp = rDraw * pr.s;
          if (rp < 0.35) return;
          F.push(wp, () => {
            const gg = ctx.createRadialGradient(pr.x - rp * .36, pr.y - rp * .40, rp * .06,
                                                pr.x, pr.y, rp);
            gg.addColorStop(0, RX.mix(col, '#ffffff', .68));
            gg.addColorStop(.52, col);
            gg.addColorStop(1, RX.mix(col, '#05080F', .58));
            ctx.fillStyle = gg;
            ctx.beginPath(); ctx.arc(pr.x, pr.y, rp, 0, TAU); ctx.fill();
          });
        });
        if (p.trails && S.trail.length > 2) {
          R3.polyline(F, S.trail.map(w2), '#FFD36B', { alpha: 0.85, width: 1.6 });
          const q = S.mol[0];
          R3.sphere(F, w2([q.x, q.y, q.z]), rDraw * 1.7, '#FFD36B', { shadow: false, rim: 0.9 });
        }
      }

      F.render();

      /* ---------------- the speed histogram, measured against theory ---------------- */
      {
        const bw = Math.min(W * 0.40, 350), bh = Math.min(H * 0.34, 156);
        const bx0 = W - bw - 14, by0 = H - bh - 34;
        ctx.fillStyle = g.alpha('#0B1020', .86);
        ctx.strokeStyle = g.alpha(th.line, 1); ctx.lineWidth = 1;
        ctx.beginPath(); ctx.roundRect(bx0, by0, bw, bh, 8); ctx.fill(); ctx.stroke();
        PA.lbl(ctx, bx0 + 10, by0 + 13, 'MEASURED SPEED DISTRIBUTION', th['text-3'], 'left', 8.5);

        const px0 = bx0 + 12, px1 = bx0 + bw - 12, py1 = by0 + bh - 24, py0 = by0 + 24;
        const dv = S.vMaxHist / S.bins;
        // the analytic Maxwell curve, for comparison only
        const fMB = v => 4 * Math.PI * Math.pow(S.m / (TAU * KB * p.T), 1.5) *
                         v * v * Math.exp(-S.m * v * v / (2 * KB * p.T));
        let peak = 0;
        for (let i = 0; i < S.bins; i++) peak = Math.max(peak, fMB((i + 0.5) * dv) * dv);
        let hPeak = 1e-9;
        for (let i = 0; i < S.bins; i++) hPeak = Math.max(hPeak, S.hist[i] / Math.max(S.histN, 1));
        const sc = Math.max(peak, hPeak);

        // the histogram, as bars
        for (let i = 0; i < S.bins; i++) {
          const frac = S.hist[i] / Math.max(S.histN, 1) / sc;
          const x0 = px0 + (px1 - px0) * i / S.bins;
          const x1 = px0 + (px1 - px0) * (i + 1) / S.bins;
          const hgt = clamp(frac, 0, 1) * (py1 - py0);
          const v = (i + 0.5) * dv;
          ctx.fillStyle = g.alpha(RX.mix('#3A63C8', '#FF7A5E',
            clamp(v / (S.vmpTh * 2.6), 0, 1)), .78);
          ctx.fillRect(x0, py1 - hgt, Math.max(1, x1 - x0 - 1), hgt);
        }
        // the curve nobody put there
        ctx.strokeStyle = '#FFD36B'; ctx.lineWidth = 2;
        ctx.beginPath();
        for (let i = 0; i <= 120; i++) {
          const v = S.vMaxHist * i / 120;
          const y = py1 - clamp(fMB(v) * dv / sc, 0, 1) * (py1 - py0);
          const x = px0 + (px1 - px0) * v / S.vMaxHist;
          i ? ctx.lineTo(x, y) : ctx.moveTo(x, y);
        }
        ctx.stroke();
        // the three speeds, marked where the paper asks for them
        [[S.vmpTh, 'v_mp', '#7CE0A8'], [S.vmeanTh, 'v̄', '#3DD6F5'], [S.vrmsTh, 'v_rms', '#FF6B9D']]
          .forEach(([v, nm, col], i) => {
            const x = px0 + (px1 - px0) * v / S.vMaxHist;
            if (x > px1) return;
            ctx.strokeStyle = g.alpha(col, .85); ctx.lineWidth = 1.2;
            ctx.save(); ctx.setLineDash([3, 3]);
            ctx.beginPath(); ctx.moveTo(x, py0); ctx.lineTo(x, py1); ctx.stroke(); ctx.restore();
            PA.lbl(ctx, x, py0 - 7 + i * 0, nm, col, 'center', 8.5);
          });
        PA.lbl(ctx, px0, py1 + 11, '0', th['text-3'], 'left', 8.5);
        PA.lbl(ctx, px1, py1 + 11, (S.vMaxHist).toFixed(0) + ' m/s', th['text-3'], 'right', 8.5);
        PA.lbl(ctx, (px0 + px1) / 2, py1 + 11,
               S.settled > 0.9 ? 'settled onto the Maxwell curve'
                               : 'still filling in — ' + S.collisions + ' collisions so far',
               S.settled > 0.9 ? th.ok : th.warn, 'center', 8.5);
      }

      /* ---------------- header ---------------- */
      ctx.textAlign = 'left'; ctx.textBaseline = 'top';
      ctx.font = '700 19px "IBM Plex Sans Condensed",sans-serif'; ctx.fillStyle = th.text;
      ctx.fillText(S.G.name + '  ·  ' + p.T + ' K  ·  ' + p.N + ' molecules', 14, 8);
      ctx.font = '500 10px "IBM Plex Mono",monospace'; ctx.fillStyle = th['text-3'];
      ctx.fillText('v_rms measured ' + S.vrms.toFixed(1) + ' m/s   ·   √(3kT/m) = ' +
        S.vrmsTh.toFixed(1) + ' m/s   ·   ' + S.collisions.toLocaleString() +
        ' collisions computed', 14, 31);
      const pErr = Math.abs(S.Pmeas - S.Pth) / Math.max(S.Pth, 1e-30) * 100;
      ctx.fillStyle = pErr < 8 ? th.ok : th.warn;
      ctx.fillText('pressure from wall impulses ' + fmt(S.Pmeas, 4) + ' Pa   ·   nkT = ' +
        fmt(S.Pth, 4) + ' Pa   ·   ' + pErr.toFixed(1) + '% apart', 14, 45);
    },

    plots: [
      { title: 'The three speeds against temperature — and why they never cross',
        legend: [{ c: '#7CE0A8', label: 'v_mp = √(2kT/m)' }, { c: '#3DD6F5', label: 'v̄ = √(8kT/πm)' },
                 { c: '#FF6B9D', label: 'v_rms = √(3kT/m)' }],
        draw(S, g) {
          const p = S.p;
          const Tmax = 1600;
          const vmax = Math.sqrt(3 * KB * Tmax / S.m) * 1.05;
          const P = g.Plot({
            xmin: 0, xmax: Tmax, ymin: 0, ymax: vmax,
            xlabel: 'temperature (K)', ylabel: 'speed (m/s)',
            xfmt: v => v.toFixed(0), yfmt: v => v.toFixed(0),
            pad: { l: 58, r: 16, t: 14, b: 34 }
          }).frame();
          P.clip(() => {
            const mk = k => {
              const c = [];
              for (let i = 0; i <= 90; i++) {
                const T = Tmax * i / 90;
                c.push([T, Math.sqrt(k * KB * T / S.m)]);
              }
              return c;
            };
            P.line(mk(2), '#7CE0A8', 2);
            P.line(mk(8 / Math.PI), '#3DD6F5', 2);
            P.line(mk(3), '#FF6B9D', 2.4);
            P.vline(p.T, g.alpha(g.theme.text, .85));
            P.dot(p.T, S.vrmsTh, 4.5, '#FF6B9D', true);
            P.dot(p.T, S.vrms, 3.6, '#ffffff', false);
          });
          P.tag(Tmax * 0.98, vmax * 0.30,
                'every one goes as √T — the ratios never change', g.theme['text-3'], 'right', 0);
        },
        hover(S, x) {
          const T = Math.max(x, 0);
          return [{ label: 'temperature', value: T.toFixed(0) + ' K' },
                  { label: 'v_mp', value: Math.sqrt(2 * KB * T / S.m).toFixed(1) + ' m/s', color: '#7CE0A8' },
                  { label: 'v̄', value: Math.sqrt(8 * KB * T / (Math.PI * S.m)).toFixed(1) + ' m/s', color: '#3DD6F5' },
                  { label: 'v_rms', value: Math.sqrt(3 * KB * T / S.m).toFixed(1) + ' m/s', color: '#FF6B9D' },
                  { label: 'ratio v_mp : v̄ : v_rms', value: '1 : 1.128 : 1.225' }];
        } },
      { title: 'The curve for every gas at this temperature — heavier means slower and taller',
        legend: GASES.map(x => ({ c: x.col, label: x.name })),
        draw(S, g) {
          const p = S.p;
          const mLight = GASES[0].M * 1e-3 / NA;
          const vmax = Math.sqrt(2 * KB * p.T / mLight) * 3.2;
          const fMB = (v, m) => 4 * Math.PI * Math.pow(m / (TAU * KB * p.T), 1.5) *
                                v * v * Math.exp(-m * v * v / (2 * KB * p.T));
          let peak = 0;
          GASES.forEach(x => {
            const m = x.M * 1e-3 / NA;
            const vmp = Math.sqrt(2 * KB * p.T / m);
            peak = Math.max(peak, fMB(vmp, m));
          });
          const P = g.Plot({
            xmin: 0, xmax: vmax, ymin: 0, ymax: peak * 1.10,
            xlabel: 'molecular speed (m/s)', ylabel: 'fraction per unit speed',
            xfmt: v => v.toFixed(0), yfmt: v => v.toExponential(0),
            pad: { l: 64, r: 16, t: 14, b: 34 }
          }).frame();
          P.clip(() => {
            GASES.forEach(x => {
              const m = x.M * 1e-3 / NA;
              const on = x.id === p.gas;
              const c = [];
              for (let i = 0; i <= 200; i++) {
                const v = vmax * i / 200;
                c.push([v, fMB(v, m)]);
              }
              P.line(c, on ? x.col : g.alpha(x.col, .35), on ? 2.6 : 1.2);
              if (on) {
                const vmp = Math.sqrt(2 * KB * p.T / m);
                P.dot(vmp, fMB(vmp, m), 4.5, x.col, true);
                P.tag(vmp, fMB(vmp, m), x.name, x.col, 'left', -9);
              }
            });
          });
          P.tag(vmax * 0.98, peak * 1.02,
                'the area under every curve is 1', g.theme['text-3'], 'right', 0);
        },
        hover(S, x) {
          const p = S.p, v = Math.max(x, 0);
          const rows = [{ label: 'speed', value: v.toFixed(0) + ' m/s' }];
          GASES.forEach(gx => {
            const m = gx.M * 1e-3 / NA;
            const f = 4 * Math.PI * Math.pow(m / (TAU * KB * p.T), 1.5) *
                      v * v * Math.exp(-m * v * v / (2 * KB * p.T));
            rows.push({ label: gx.name, value: f.toExponential(2), color: gx.col });
          });
          return rows;
        } }
    ],

    readouts(S) {
      const p = S.p;
      const pErr = Math.abs(S.Pmeas - S.Pth) / Math.max(S.Pth, 1e-30) * 100;
      return [
        { label: 'v_rms measured', value: S.vrms.toFixed(1), unit: 'm/s', flag: 'accent',
          hint: 'from the actual population' },
        { label: 'v_rms = √(3kT/m)', value: S.vrmsTh.toFixed(1), unit: 'm/s',
          hint: 'what theory says it should be' },
        { label: 'v̄ measured', value: S.vmean.toFixed(1), unit: 'm/s' },
        { label: 'v̄ = √(8kT/πm)', value: S.vmeanTh.toFixed(1), unit: 'm/s' },
        { label: 'v_mp = √(2kT/m)', value: S.vmpTh.toFixed(1), unit: 'm/s',
          hint: 'the peak of the curve' },
        { label: 'Temperature back from ½m⟨v²⟩', value: S.Tmeas ? S.Tmeas.toFixed(1) : '—',
          unit: 'K', flag: Math.abs(S.Tmeas - p.T) < p.T * 0.06 ? 'ok' : 'warn',
          hint: 'the definition of temperature, checked' },
        { label: 'Pressure from wall impulses', value: fmt(S.Pmeas, 4), unit: 'Pa',
          flag: 'accent', hint: 'momentum delivered ÷ area ÷ time' },
        { label: 'Pressure nkT', value: fmt(S.Pth, 4), unit: 'Pa',
          flag: pErr < 8 ? 'ok' : 'warn', hint: pErr.toFixed(1) + '% from the measurement' },
        { label: 'Number density n = N/V', value: fmt(S.n, 4), unit: 'm⁻³' },
        { label: 'Mean free path measured', value: S.mfpMeas ? fmt(S.mfpMeas, 3) : '—', unit: 'm',
          hint: S.mfpCount > 400 ? 'from ' + S.mfpCount.toLocaleString() + ' free flights'
                                 : 'only ' + S.mfpCount + ' flights yet — let it run' },
        { label: 'λ = 1/(√2 π d² n)', value: fmt(S.mfpTh, 3), unit: 'm',
          hint: 'collision diameter ' + S.G.d.toFixed(2) + ' nm' },
        { label: 'Box in mean free paths  L/λ', value: (S.L / S.mfpTh).toFixed(2), unit: '',
          flag: S.L / S.mfpTh < 3 ? 'warn' : '',
          hint: S.L / S.mfpTh < 3
            ? 'walls are as close as other molecules — the measured λ runs short of the ideal formula'
            : 'many free paths across the box, so the ideal formula applies' },
        { label: 'Collisions computed', value: S.collisions.toLocaleString(), unit: '' },
        { label: 'Degrees of freedom f', value: String(S.G.f), unit: '',
          hint: S.G.f === 3 ? 'monatomic' : S.G.f === 5 ? 'diatomic, rigid' : 'non-linear / vibrating' },
        { label: 'γ = C_p/C_v = (f+2)/f', value: S.gamma.toFixed(4), unit: '', flag: 'accent' },
        { label: 'C_v = (f/2)R', value: S.Cv.toFixed(3), unit: 'J/mol·K' },
        { label: 'Mean KE per molecule', value: fmt(1.5 * KB * p.T, 3), unit: 'J',
          hint: '(3/2)kT — the same for every gas at this T' }
      ];
    },

    equation(S) {
      const p = S.p;
      return E.v('PV') + ' ' + E.op('=') + ' ' + E.frac('1', '3') + E.v('Nm') +
        '⟨' + E.v('v') + '²⟩ ' + E.op('=') + ' ' + E.v('Nk') + E.sub('B') + E.v('T') +
        '&nbsp;&nbsp;⇒&nbsp;&nbsp;' + E.v('v') + E.sub('rms') + ' ' + E.op('=') +
        ' √(3' + E.v('k') + E.sub('B') + E.v('T') + '/' + E.v('m') + ') ' + E.op('=') +
        ' ' + E.n(S.vrmsTh, 'm/s') +
        '<br>' + E.v('f') + '(' + E.v('v') + ') ' + E.op('=') + ' 4π(' +
        E.frac(E.v('m'), '2π' + E.v('k') + E.sub('B') + E.v('T')) + ')' +
        '<sup>3/2</sup> ' + E.v('v') + '² ' + E.v('e') +
        '<sup>−' + E.v('mv') + '²/2' + E.v('k') + E.sub('B') + E.v('T') + '</sup>' +
        '&nbsp;&nbsp;measured: ' + E.n(S.vrms, 'm/s');
    },

    walkthrough: [
      { title: '1 · Nobody drew the curve',
        body: 'Watch the histogram at the bottom right fill in. The gold line is the Maxwell formula; the bars are the molecules in the box.',
        ask: 'The molecules were started with random velocities. Why do they settle onto that exact shape?',
        reveal: 'Because <b>elastic collisions redistribute energy</b> until the distribution stops changing, ' +
          'and there is only one distribution that is stable under collisions at a fixed total energy — ' +
          'Maxwell\'s. The shape is not a law imposed on the gas; it is what the gas ends up doing. Note the ' +
          'curve is <b>not symmetric</b>: there is no upper limit on speed but a hard floor at zero.',
        params: { gas: 'n2', T: 300, N: 220, Lnm: 14 } },
      { title: '2 · Heat it up',
        body: 'Take the temperature from 300 K to 1200 K and watch both the box and the histogram.',
        ask: 'The curve moves right. Why does it also get shorter?',
        reveal: 'Because the <b>area under it must stay exactly 1</b> — every molecule has some speed. ' +
          'Spreading the same total probability over a wider range of speeds forces the peak down. ' +
          'Quadrupling T only doubles every speed, since they all go as <b>√T</b>.',
        params: { gas: 'n2', T: 1200 } },
      { title: '3 · Change the gas instead',
        body: 'Put T back to 300 K and switch from nitrogen to helium, then to xenon.',
        ask: 'At the same temperature, which molecules are moving faster — and do they have more energy?',
        reveal: 'Helium is far faster and xenon far slower, because v_rms ∝ <b>1/√m</b>. But the average ' +
          'kinetic energy <b>(3/2)kT is identical</b> for all three — it depends only on temperature. ' +
          'Light molecules carry the same energy by moving quickly; heavy ones by moving slowly. ' +
          'This is the whole content of equipartition.',
        params: { gas: 'he', T: 300 } },
      { title: '4 · Where pressure comes from',
        body: 'Compare the two pressure figures in the header. One is measured from wall impulses; one is nkT.',
        ask: 'What is pressure, mechanically?',
        reveal: 'Momentum delivered per second per unit area. Each bounce reverses one component and hands ' +
          '<b>2m|v|</b> to the wall; adding those up over time and dividing by area gives the pressure ' +
          '<b>without assuming the gas law at all</b>. That the answer equals nkT is the derivation ' +
          'PV = ⅓Nm⟨v²⟩, done numerically.',
        params: { gas: 'n2', T: 300 } },
      { title: '5 · Squeeze it',
        body: 'Shrink the box from 14 nm to 9 nm at fixed N and T, and watch the pressure and the mean free path.',
        ask: 'Pressure rises. What happens to the speeds?',
        reveal: '<b>Nothing.</b> The histogram does not move, because the speed distribution depends only on ' +
          'T and m. Compressing at constant temperature packs more molecules into the same volume, so the ' +
          'walls are hit more often — P goes up as 1/V, which is Boyle\'s law — and the mean free path ' +
          'shortens as 1/n. Speed and frequency of collision are different things.',
        params: { Lnm: 9, N: 220, T: 300 } }
    ],

    problems: [
      { source: 'JEE Main pattern · kinetic theory',
        q: 'Oxygen gas is held at 300 K. Taking the molar mass of O₂ as 32.0 g/mol, calculate the root mean square speed of its molecules, in m/s.',
        params: { gas: 'o2', T: 300, N: 220, Lnm: 14 },
        predict: { label: 'v_rms', unit: 'm/s', tol: 0.02 },
        measure: S => S.vrmsTh,
        working: 'v_rms = √(3RT/M) with M in kg/mol: √(3 × 8.314 × 300 / 0.032) = √(233 800) ≈ ' +
          '<b>483 m/s</b>. Using 3kT/m per molecule gives the same number — R/N_A = k is the only ' +
          'difference between the two forms. The commonest slip here is leaving M in grams, which is ' +
          'out by a factor of √1000 ≈ 31.6.' },
      { source: 'NEET pattern · comparing gases',
        q: 'Helium (M = 4 g/mol) and xenon (M = 131.3 g/mol) are at the same temperature of 300 K. Find the root mean square speed of the helium atoms, in m/s.',
        params: { gas: 'he', T: 300 },
        predict: { label: 'v_rms of helium', unit: 'm/s', tol: 0.02 },
        measure: S => S.vrmsTh,
        working: '√(3 × 8.314 × 300 / 0.004) ≈ <b>1368 m/s</b>. Xenon at the same temperature manages only ' +
          '239 m/s — the ratio is √(131.3/4) = 5.7. The trap is to assume the faster gas has more energy: ' +
          'both have exactly (3/2)kT per molecule, because <b>temperature is defined by that energy</b>.' },
      { source: 'JEE Advanced pattern · degrees of freedom',
        q: 'A rigid diatomic gas has 5 degrees of freedom. Give the ratio of specific heats γ = C_p/C_v.',
        params: { gas: 'n2', T: 300 },
        predict: { label: 'γ', unit: '', tol: 0.01 },
        measure: S => S.gamma,
        working: 'C_v = (f/2)R and C_p = C_v + R, so γ = (f+2)/f = 7/5 = <b>1.40</b>. Monatomic gases give ' +
          '5/3 ≈ 1.67 and a non-linear or vibrating molecule gives 4/3 ≈ 1.33. Examiners like to state a ' +
          'measured γ and ask you to infer the atomicity — run the relation backwards: f = 2/(γ−1).' }
    ],

    quiz: [
      { q: 'At a given temperature, the ratio v_mp : v̄ : v_rms for an ideal gas is:',
        options: ['1 : 1.128 : 1.225', '1 : 1.225 : 1.128', '1 : 1 : 1', '1.225 : 1.128 : 1'], answer: 0,
        why: 'They are √2, √(8/π) and √3 times √(kT/m), giving 1.414 : 1.596 : 1.732, which normalises to 1 : 1.128 : 1.225. The most probable speed is always the smallest of the three and v_rms always the largest.' },
      { q: 'The temperature of an ideal gas is doubled. The root mean square speed of its molecules:',
        options: ['doubles', 'quadruples', 'increases by a factor of √2', 'is unchanged'], answer: 2,
        why: 'v_rms = √(3kT/m) goes as √T, so doubling T multiplies the speed by √2 ≈ 1.41. To double the speed you would need four times the absolute temperature.' },
      { q: 'Two gases, helium and oxygen, are at the same temperature. Which statement is true?',
        options: ['The oxygen molecules have more kinetic energy on average',
                  'The helium atoms have more kinetic energy on average',
                  'Both have the same average kinetic energy',
                  'The comparison needs the pressures'], answer: 2,
        why: 'Average translational kinetic energy is (3/2)kT for every ideal gas — it depends on temperature alone. The helium atoms move much faster only because they are lighter, which is precisely how they carry the same energy.' },
      { q: 'At constant temperature the volume of a gas is halved. The mean free path of its molecules:',
        options: ['is halved', 'doubles', 'is unchanged', 'is quartered'], answer: 0,
        why: 'λ = 1/(√2 π d² n) and halving the volume doubles the number density n, so λ halves. The molecular speeds do not change at all — only how far a molecule gets between collisions.' }
    ],

    notes: '<b>Where this shows up in the paper.</b>' +
      '<ul><li>v_rms = √(3RT/M) numericals, and the ratio questions when T or M is scaled.</li>' +
      '<li>γ = (f+2)/f, run both ways: atomicity → γ, and a measured γ → degrees of freedom.</li>' +
      '<li>Mean free path λ = 1/(√2 π d² n) and its dependence on P and T.</li>' +
      '<li>Average KE = (3/2)kT per molecule, independent of the gas — the most-asked single fact here.</li></ul>' +
      '<div class="pyq"><em>Trap to avoid</em>Molar mass must be in <b>kg/mol</b> in √(3RT/M). Leaving it in ' +
      'g/mol makes every answer too small by √1000 ≈ 31.6. And ⟨v⟩ is <b>not</b> zero even though ' +
      '⟨<b>v</b>⟩ as a vector is — the average <i>speed</i> and the average <i>velocity</i> are different ' +
      'quantities, and questions are written to catch exactly that confusion.</div>'
  });

})(window.InsightLab);
