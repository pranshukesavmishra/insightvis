/* ============================================================
   CHEMISTRY — 3. Hydrogen orbitals   4. SN1 vs SN2
   ============================================================ */
(function (L) {
  'use strict';
  const { clamp, TAU, fmt, E, Camera } = L;

  /* =========================================================================
     3 · ATOMIC ORBITALS — sampled from the real hydrogen wavefunctions
     The cloud is not an artist's impression: points are drawn from
     |ψ|² by inverse-CDF sampling of r²R(r)² and rejection on |Y|².
     ========================================================================= */

  // Radial functions R_nl(r), r in Bohr radii.
  const RADIAL = {
    '10': r => 2 * Math.exp(-r),
    '20': r => (1 / (2 * Math.SQRT2)) * (2 - r) * Math.exp(-r / 2),
    '21': r => (1 / (2 * Math.sqrt(6))) * r * Math.exp(-r / 2),
    '30': r => (2 / (81 * Math.sqrt(3))) * (27 - 18 * r + 2 * r * r) * Math.exp(-r / 3),
    '31': r => (4 / (81 * Math.sqrt(6))) * (6 * r - r * r) * Math.exp(-r / 3),
    '32': r => (4 / (81 * Math.sqrt(30))) * r * r * Math.exp(-r / 3)
  };

  // Real angular parts Y(θ,φ) — signed, so the phase lobes are physical.
  const ANG = {
    '0_0': { name: 's', f: () => 1, max: 1 },
    '1_0': { name: 'p_z', f: (ct, st, cp, sp) => ct, max: 1 },
    '1_1': { name: 'p_x', f: (ct, st, cp, sp) => st * cp, max: 1 },
    '1_2': { name: 'p_y', f: (ct, st, cp, sp) => st * sp, max: 1 },
    '2_0': { name: 'd_z²', f: (ct) => (3 * ct * ct - 1) / 2, max: 1 },
    '2_1': { name: 'd_xz', f: (ct, st, cp) => st * ct * cp * 1.732, max: 0.866 },
    '2_2': { name: 'd_yz', f: (ct, st, cp, sp) => st * ct * sp * 1.732, max: 0.866 },
    '2_3': { name: 'd_x²−y²', f: (ct, st, cp, sp) => st * st * (cp * cp - sp * sp) * 0.866, max: 0.866 },
    '2_4': { name: 'd_xy', f: (ct, st, cp, sp) => st * st * (2 * cp * sp) * 0.866, max: 0.866 }
  };

  const ORIENT = [
    ['s'], ['p_z', 'p_x', 'p_y'], ['d_z²', 'd_xz', 'd_yz', 'd_x²−y²', 'd_xy']
  ];

  L.register({
    id: 'orbitals', subject: 'chemistry',
    name: 'Hydrogen Atomic Orbitals — Shape, Phase and Nodes',
    chapter: 'Structure of Atom',
    exams: ['JEE Main', 'JEE Advanced', 'NEET UG'],
    weight: 'High yield',
    is3D: true,
    stageHint: 'Drag to orbit · scroll to zoom · each dot is one sample from |ψ|²',
    lede: 'An orbital is not an orbit and not a shell — it is a probability distribution. ' +
      'Every dot here is a genuine random sample drawn from <b>|ψ<sub>n,l,m</sub>|²</b> using the exact hydrogen ' +
      'radial functions, so the shapes, the phase lobes and above all the <b>nodes</b> are real, not decorative. ' +
      'Node counting is one of the most reliably examined ideas in atomic structure.',

    params: { n: 2, l: 1, mi: 0, density: 12000, cutaway: false, phase: true, nodes: true },

    presets: [
      { name: '1s', params: { n: 1, l: 0, mi: 0 } },
      { name: '2s (radial node)', params: { n: 2, l: 0, mi: 0 } },
      { name: '2p_z', params: { n: 2, l: 1, mi: 0 } },
      { name: '3s', params: { n: 3, l: 0, mi: 0 } },
      { name: '3p_z', params: { n: 3, l: 1, mi: 0 } },
      { name: '3d_z²', params: { n: 3, l: 2, mi: 0 } },
      { name: '3d_xy', params: { n: 3, l: 2, mi: 4 } }
    ],

    controls: [
      { group: 'Quantum numbers', items: [
        { key: 'n', type: 'select', label: 'Principal <i>n</i>', restructure: true,
          options: [{ value: 1, label: 'n = 1' }, { value: 2, label: 'n = 2' }, { value: 3, label: 'n = 3' }] },
        { key: 'l', type: 'select', label: 'Azimuthal <i>l</i> (subshell)', restructure: true,
          options: [{ value: 0, label: 's  (l=0)' }, { value: 1, label: 'p  (l=1)' }, { value: 2, label: 'd  (l=2)' }] },
        { key: 'mi', type: 'select', label: 'Orientation', restructure: true,
          options: [{ value: 0, label: '1st' }, { value: 1, label: '2nd' }, { value: 2, label: '3rd' },
                    { value: 3, label: '4th' }, { value: 4, label: '5th' }] }
      ] },
      { group: 'Rendering', items: [
        { key: 'density', label: 'Sample count', min: 3000, max: 26000, step: 500, unit: 'pts',
          fmt: v => (v / 1000).toFixed(1) + 'k', restructure: true },
        { key: 'cutaway', type: 'toggle', label: 'Cut away front half' },
        { key: 'phase', type: 'toggle', label: 'Colour by phase sign of ψ' },
        { key: 'nodes', type: 'toggle', label: 'Show radial nodal shells' }
      ] }
    ],

    setup(S) {
      const p = S.p;
      p.n = clamp(p.n | 0, 1, 3);
      p.l = clamp(p.l | 0, 0, p.n - 1);
      p.mi = clamp(p.mi | 0, 0, ORIENT[p.l].length - 1);

      const R = RADIAL[p.n + '' + p.l];
      const ang = ANG[p.l + '_' + p.mi];
      S.R = R; S.ang = ang;
      S.label = p.n + ORIENT[p.l][p.mi];
      S.rmax = 3.2 * p.n * p.n + 5;

      // radial probability P(r) = r² R(r)² and its CDF
      const NR = 900, g = [], cdf = [];
      let acc = 0, pmax = 0, rmp = 0;
      for (let i = 0; i < NR; i++) {
        const r = (i + 0.5) / NR * S.rmax;
        const Rv = R(r);
        const P = r * r * Rv * Rv;
        g.push([r, P, Rv]);
        if (P > pmax) { pmax = P; rmp = r; }
        acc += P; cdf.push(acc);
      }
      for (let i = 0; i < NR; i++) cdf[i] /= acc;
      S.grid = g; S.cdf = cdf; S.pmax = pmax; S.rmp = rmp;
      let i95 = NR - 1;
      for (let i = 0; i < NR; i++) if (cdf[i] >= 0.95) { i95 = i; break; }
      S.r95 = g[i95][0];

      // radial nodes = zeros of R(r) for r > 0
      S.nodeR = [];
      for (let i = 1; i < NR; i++) {
        if (g[i - 1][2] === 0) continue;
        if (g[i][2] * g[i - 1][2] < 0) S.nodeR.push((g[i][0] + g[i - 1][0]) / 2);
      }

      // ---- sample the cloud ----
      const N = p.density | 0, pts = new Float32Array(N * 4);
      const amax = ang.max;
      let k = 0, guard = 0;
      while (k < N && guard < N * 80) {
        guard++;
        // r by inverse CDF
        const u = Math.random();
        let lo = 0, hi = NR - 1;
        while (lo < hi) { const mid = (lo + hi) >> 1; if (cdf[mid] < u) lo = mid + 1; else hi = mid; }
        const r = g[lo][0];
        // direction by rejection on |Y|²
        const ct = 2 * Math.random() - 1, st = Math.sqrt(1 - ct * ct);
        const ph = Math.random() * TAU, cp = Math.cos(ph), sp = Math.sin(ph);
        const Y = ang.f(ct, st, cp, sp);
        if (Math.random() > (Y * Y) / (amax * amax)) continue;
        pts[k * 4] = r * st * cp; pts[k * 4 + 1] = r * st * sp; pts[k * 4 + 2] = r * ct;
        pts[k * 4 + 3] = (Y * g[lo][2]) >= 0 ? 1 : -1;
        k++;
      }
      S.pts = pts; S.nPts = k;

      const D = { 1: 3.4, 2: 3.6, 3: 3.8 }[p.n];
      if (!S.cam) { S.cam = Camera({ theta: -0.95, phi: 0.3, dist: D }); S.cam.minDist = 1.2; S.cam.maxDist = 14; }
      S.cam.home.dist = D;
      S.spin = S.spin || 0;
    },

    step(S, dt) { S.spin += dt * 0.16; },

    drawStage(S, g) {
      const ctx = g.ctx, th = g.theme, p = S.p, cam = S.cam;
      cam.theta += 0.0009;   // slow ambient rotation keeps 3D structure readable
      cam.update();

      const k = 1.45 / S.r95;                 // world -> scene units, framed on 95% of |ψ|²
      const posC = th.chem, negC = '#5AA9FF';
      const pts = S.pts, N = S.nPts;

      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      const base = clamp(2600 / N, 0.035, 0.5);
      for (let i = 0; i < N; i++) {
        const x = pts[i * 4] * k, y = pts[i * 4 + 1] * k, z = pts[i * 4 + 2] * k;
        if (p.cutaway) {
          // hide the hemisphere between viewer and nucleus
          const d = x * (cam.eye[0]) + y * (cam.eye[1]) + z * (cam.eye[2]);
          if (d > 0) continue;
        }
        const P = cam.project([x, y, z]);
        if (!P.ok) continue;
        const s = clamp(P.s * 0.0075, 0.7, 2.6);
        ctx.fillStyle = (p.phase && pts[i * 4 + 3] < 0)
          ? g.alpha(negC, base) : g.alpha(posC, base);
        ctx.fillRect(P.x - s / 2, P.y - s / 2, s, s);
      }
      ctx.restore();

      // nucleus
      const NP = cam.project([0, 0, 0]);
      if (NP.ok) {
        ctx.save(); ctx.globalCompositeOperation = 'lighter';
        const rg = ctx.createRadialGradient(NP.x, NP.y, 0, NP.x, NP.y, 13);
        rg.addColorStop(0, 'rgba(255,255,255,.9)'); rg.addColorStop(1, 'rgba(255,255,255,0)');
        ctx.fillStyle = rg; ctx.beginPath(); ctx.arc(NP.x, NP.y, 13, 0, TAU); ctx.fill();
        ctx.restore();
      }

      // radial nodal shells
      if (p.nodes && S.nodeR.length) {
        ctx.save(); ctx.setLineDash([3, 4]); ctx.lineWidth = 1;
        S.nodeR.forEach(rn => {
          ctx.strokeStyle = g.alpha(th.text, 0.34);
          ctx.beginPath();
          for (let i = 0; i <= 90; i++) {
            const a = i / 90 * TAU;
            // great circle in the plane facing the camera
            const px = rn * k * (cam.r[0] * Math.cos(a) + cam.u[0] * Math.sin(a));
            const py = rn * k * (cam.r[1] * Math.cos(a) + cam.u[1] * Math.sin(a));
            const pz = rn * k * (cam.r[2] * Math.cos(a) + cam.u[2] * Math.sin(a));
            const P = cam.project([px, py, pz]);
            if (!P.ok) continue;
            i ? ctx.lineTo(P.x, P.y) : ctx.moveTo(P.x, P.y);
          }
          ctx.closePath(); ctx.stroke();
        });
        ctx.restore();
      }

      // axis triad
      const ax = [[1, 0, 0, 'x'], [0, 1, 0, 'y'], [0, 0, 1, 'z']];
      ctx.lineWidth = 1;
      ax.forEach(a => {
        const A = cam.project([0, 0, 0]), B = cam.project([a[0] * 1.75, a[1] * 1.75, a[2] * 1.75]);
        if (!A.ok || !B.ok) return;
        ctx.strokeStyle = g.alpha(th['text-3'], .55);
        ctx.beginPath(); ctx.moveTo(A.x, A.y); ctx.lineTo(B.x, B.y); ctx.stroke();
        ctx.font = '10px "IBM Plex Mono",monospace'; ctx.fillStyle = g.alpha(th['text-3'], .9);
        ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
        ctx.fillText(a[3], B.x, B.y);
      });

      // label block
      ctx.font = '700 26px "IBM Plex Sans Condensed",sans-serif';
      ctx.fillStyle = th.text; ctx.textAlign = 'left'; ctx.textBaseline = 'top';
      ctx.fillText(S.label, 14, 12);
      ctx.font = '500 10px "IBM Plex Mono",monospace';
      ctx.fillStyle = th['text-3'];
      ctx.fillText('n=' + p.n + '  l=' + p.l + '  ' + S.nPts.toLocaleString() + ' samples of |ψ|²', 14, 44);
      if (p.phase) {
        ctx.fillStyle = posC; ctx.fillText('■ ψ > 0', 14, 60);
        ctx.fillStyle = negC; ctx.fillText('■ ψ < 0', 74, 60);
      }
    },

    plotTitle: 'Radial probability distribution  4πr²|R(r)|²  —  the nodes are the zeros',
    legend: [{ c: '#FFAE4C', label: '4πr²|R|² (probability per unit r)' },
             { c: '#E7EDFB', label: 'radial node' }],
    drawPlot(S, g) {
      const p = S.p;
      const pts = S.grid.map(a => [a[0], a[1] / S.pmax]);
      const P = g.Plot({
        xmin: 0, xmax: S.rmax, ymin: 0, ymax: 1.1,
        xlabel: 'r  (Bohr radii a₀)', ylabel: 'P(r) normalised',
        xfmt: v => v.toFixed(0), yfmt: v => v.toFixed(1)
      }).frame();
      P.clip(() => {
        P.area(pts, 0, g.alpha(g.theme.chem, .17));
        P.line(pts, g.theme.chem, 2);
        S.nodeR.forEach(rn => P.vline(rn, g.alpha(g.theme.text, .7), [3, 3]));
        P.dot(S.rmp, 1, 4, g.theme.chem, g.theme['ink-950']);
      });
      P.tag(S.rmp, 1, 'most probable r = ' + S.rmp.toFixed(2) + ' a₀', g.theme['text-2'], 'left', -9);
      S.nodeR.forEach((rn, i) => P.tag(rn, 0.55 - i * 0.14, 'node ' + rn.toFixed(2) + ' a₀', g.theme['text-3'], 'left', 0));
    },

    readouts(S) {
      const p = S.p;
      const En = -13.6 / (p.n * p.n);
      const rmean = p.n * p.n * (1 + 0.5 * (1 - p.l * (p.l + 1) / (p.n * p.n)));
      return [
        { label: 'Orbital', value: S.label, unit: '', flag: 'accent' },
        { label: 'Energy  E = −13.6/n²', value: En.toFixed(2), unit: 'eV',
          hint: 'in H, depends on n only' },
        { label: 'Radial nodes  n−l−1', value: String(p.n - p.l - 1), unit: '', flag: 'accent' },
        { label: 'Angular nodes  l', value: String(p.l), unit: '', hint: 'nodal planes / cones' },
        { label: 'Total nodes  n−1', value: String(p.n - 1), unit: '' },
        { label: 'Most probable r', value: S.rmp.toFixed(2), unit: 'a₀' },
        { label: 'Mean radius ⟨r⟩', value: rmean.toFixed(2), unit: 'a₀' },
        { label: 'Max electrons', value: String(2 * (2 * p.l + 1)), unit: '', hint: 'in this subshell' }
      ];
    },

    equation(S) {
      const p = S.p;
      return E.v('ψ') + E.sub(E.v('n,l,m')) + '(' + E.v('r') + ',' + E.v('θ') + ',' + E.v('φ') + ') ' +
        E.op('=') + ' ' + E.v('R') + E.sub(E.v('n,l')) + '(' + E.v('r') + ')' + E.op('·') +
        E.v('Y') + E.sub(E.v('l,m')) + '(' + E.v('θ') + ',' + E.v('φ') + ')' +
        '<br>' + E.v('E') + E.sub(E.v('n')) + ' ' + E.op('=') + ' ' +
        E.op('−') + E.frac('13.6 eV', E.v('n') + '<sup>2</sup>') + ' ' + E.op('=') +
        ' ' + E.op('−') + E.frac('13.6', E.n(p.n, '') + '<sup>2</sup>') + ' ' + E.op('=') +
        ' ' + E.n((-13.6 / (p.n * p.n)).toFixed(2), 'eV') +
        '<br>radial nodes ' + E.op('=') + ' ' + E.v('n') + E.op('−') + E.v('l') + E.op('−') + '1 ' +
        E.op('=') + ' ' + E.n(p.n, '') + E.op('−') + E.n(p.l, '') + E.op('−') + '1 ' + E.op('=') +
        ' ' + E.n(p.n - p.l - 1, '') + E.op('·') + ' total nodes ' + E.op('=') + ' ' +
        E.v('n') + E.op('−') + '1 ' + E.op('=') + ' ' + E.n(p.n - 1, '');
    },
    eqNote: '<b>The counting rule is the whole game.</b> Radial nodes are spherical shells where R(r) = 0 — dashed ' +
      'circles on the stage, dashed lines on the graph. Angular nodes are planes or cones where Y = 0 — the gaps ' +
      'between phase lobes. They always add to <i>n</i> − 1.',

    walkthrough: [
      { title: '1 · 1s — the simplest case',
        body: 'A single, spherically symmetric cloud, densest at the nucleus and fading outwards. n = 1, l = 0.',
        ask: 'How many nodes does a 1s orbital have?',
        reveal: '<b>Zero.</b> Total nodes = n − 1 = 0. The probability decays smoothly outward but never hits zero except at infinity. Note the graph peaks at exactly <b>1 a₀</b> — the Bohr radius falls out of the maths.',
        params: { n: 1, l: 0, mi: 0, cutaway: false } },
      { title: '2 · 2s — a shell of zero probability',
        body: 'Same spherical symmetry, but now look at the graph: there are two humps with a gap between them. Turn on the cutaway to see the hollow shell inside the cloud.',
        ask: 'Can the electron ever be found exactly at that gap?',
        reveal: '<b>No.</b> At the radial node, ψ = 0, so |ψ|² = 0 — the probability is exactly zero there. Students ask how the electron crosses it; the honest answer is that an electron is not a particle travelling along a path, it is this distribution.',
        params: { n: 2, l: 0, mi: 0, cutaway: true, nodes: true } },
      { title: '3 · 2p — lobes and phase',
        body: 'Now l = 1. The cloud is no longer spherical: it is two lobes along an axis, separated by a nodal plane through the nucleus.',
        ask: 'The two lobes are coloured differently. What does that mean physically?',
        reveal: 'They are the <b>opposite signs of ψ</b>, not opposite charges. The sign has no effect on the probability |ψ|², but it decides everything in bonding — same-sign overlap gives a bonding MO, opposite-sign gives antibonding.',
        params: { n: 2, l: 1, mi: 0, cutaway: false, phase: true } },
      { title: '4 · 3s, 3p, 3d — one rule for all',
        body: 'Step through the three subshells of n = 3 and keep an eye on the node readouts.',
        ask: 'How do the radial and angular nodes trade off within a shell?',
        reveal: 'Total nodes stay fixed at <b>n − 1 = 2</b>. 3s has 2 radial + 0 angular, 3p has 1 + 1, 3d has 0 + 2. As l rises, radial structure is traded for angular structure.',
        params: { n: 3, l: 2, mi: 0, cutaway: false } },
      { title: '5 · The odd one out',
        body: 'Four of the five d orbitals are four-lobed cloverleaves. Compare d_xy with d_z².',
        ask: 'Why does d_z² look completely different?',
        reveal: 'It is a legitimate combination of the two remaining m states, giving two lobes along z plus a <b>doughnut in the xy plane</b>. Its angular nodes are two <b>cones</b> rather than two planes — still l = 2 angular nodes, just a different geometry. This shape is what crystal field theory splits.',
        params: { n: 3, l: 2, mi: 0 } }
    ],

    notes: '<b>Where this shows up in the paper.</b>' +
      '<ul><li>"Number of radial/angular/total nodes in X orbital" — a near-guaranteed single mark once n−l−1 is secure.</li>' +
      '<li>Comparing orbital energies: in hydrogen only n matters, but in multi-electron atoms the (n+l) rule takes over.</li>' +
      '<li>Sketching or identifying orbital shapes and their nodal planes.</li>' +
      '<li>Phase signs feeding into MO diagrams and into why d_z² behaves differently in octahedral fields.</li></ul>' +
      '<div class="pyq"><em>Trap to avoid</em>The nucleus itself is <b>not</b> a radial node for a p orbital. ' +
      'A node is a surface where ψ = 0; the origin is a single point, and for p orbitals the nodal ' +
      'feature through it is a <i>plane</i> — that counts as angular, not radial.</div>'
  });

  /* =========================================================================
     4 · NUCLEOPHILIC SUBSTITUTION — SN2 inversion vs SN1 racemisation
     ========================================================================= */

  const SUBSTRATE = [
    { key: 0, name: 'Methyl',    label: 'CH₃—Br', me: 0, steric: 0, cation: 0 },
    { key: 1, name: 'Primary',   label: '1° R—Br', me: 1, steric: 1, cation: 1 },
    { key: 2, name: 'Secondary', label: '2° R—Br', me: 2, steric: 2, cation: 2 },
    { key: 3, name: 'Tertiary',  label: '3° R—Br', me: 3, steric: 3, cation: 3 }
  ];
  const R_GAS = 8.314e-3; // kJ/mol/K

  function smoothPath(nodes, x) {
    for (let i = 1; i < nodes.length; i++) {
      if (x <= nodes[i][0]) {
        const a = nodes[i - 1], b = nodes[i];
        const t = (x - a[0]) / (b[0] - a[0] || 1);
        const s = (1 - Math.cos(Math.PI * clamp(t, 0, 1))) / 2;
        return a[1] + (b[1] - a[1]) * s;
      }
    }
    return nodes[nodes.length - 1][1];
  }

  /* =====================================================================
     Electron-flow inset. The 3D stage shows the geometry moving; this
     shows WHY it moves — the curly arrows, which is the part an exam
     answer has to reproduce.
     ===================================================================== */
  function snMech(isSN2, nuLabel, lgLabel) {
    const C = { x: 0, y: 0 }, LG = { x: 1.15, y: 0 }, NU = { x: -1.45, y: 0 };
    const r1 = { x: -0.42, y: -0.98 }, r2 = { x: -0.42, y: 0.98 }, r3 = { x: 0.30, y: 0 };
    const skel = {
      c: { x: C.x, y: C.y, label: 'C' },
      r1: { x: r1.x, y: r1.y, label: 'R' },
      r2: { x: r2.x, y: r2.y, label: 'R' }
    };
    const skelBonds = [{ a: 'c', b: 'r1', order: 1 }, { a: 'c', b: 'r2', order: 1 }];

    if (isSN2) {
      return [
        { name: 'TS', caption: 'One step, two arrows, at the same time',
          sub: 'the nucleophile attacks from directly behind the leaving group',
          atoms: Object.assign({}, skel, {
            lg: { x: LG.x, y: LG.y, label: lgLabel, colour: '#FFAE4C', hot: 1 },
            nu: { x: NU.x, y: NU.y, label: nuLabel, colour: '#4ADE80', charge: -1, hot: 1,
                  lone: [0] }
          }),
          bonds: skelBonds.concat([{ a: 'c', b: 'lg', order: 1 }]),
          arrows: [
            { from: { atom: 'nu', dx: 0.34 }, to: { atom: 'c', dx: -0.34 }, bow: 0.34, colour: '#4ADE80' },
            { from: { bond: 'c|lg' }, to: { atom: 'lg', dx: 0.30 }, bow: 0.34, colour: '#FFAE4C' }
          ] },
        { name: 'product', caption: 'Inversion of configuration',
          sub: 'the three groups have flipped through — Walden inversion',
          atoms: Object.assign({}, skel, {
            r1: { x: -r1.x * 0.6 + 0.18, y: r1.y, label: 'R' },
            r2: { x: -r2.x * 0.6 + 0.18, y: r2.y, label: 'R' },
            lg: { x: LG.x + 0.85, y: LG.y, label: lgLabel + '⁻', colour: '#8FA4CE', charge: -1 },
            nu: { x: -0.95, y: 0, label: nuLabel, colour: '#4ADE80' }
          }),
          bonds: skelBonds.concat([{ a: 'c', b: 'nu', order: 1 }]),
          arrows: [] }
      ];
    }
    return [
      { name: 'ionise', caption: 'Step 1 — the leaving group goes on its own',
        sub: 'slow, and the only step in the rate law',
        atoms: Object.assign({}, skel, {
          lg: { x: LG.x, y: LG.y, label: lgLabel, colour: '#FFAE4C', hot: 1 },
          r3: { x: r3.x, y: r3.y, label: '' }
        }),
        bonds: skelBonds.concat([{ a: 'c', b: 'lg', order: 1 }]),
        arrows: [{ from: { bond: 'c|lg' }, to: { atom: 'lg', dx: 0.32 }, bow: 0.36, colour: '#FFAE4C' }] },
      { name: 'cation', caption: 'Step 2 — a planar carbocation',
        sub: 'sp², and the nucleophile can reach either face',
        atoms: Object.assign({}, skel, {
          c: { x: C.x, y: C.y, label: 'C', charge: 1, hot: 1 },
          lg: { x: LG.x + 0.95, y: LG.y, label: lgLabel + '⁻', colour: '#8FA4CE', charge: -1 },
          nu: { x: NU.x, y: -0.30, label: nuLabel, colour: '#4ADE80', charge: -1, lone: [0] }
        }),
        bonds: skelBonds,
        arrows: [{ from: { atom: 'nu', dx: 0.34 }, to: { atom: 'c', dx: -0.32, dy: -0.10 },
                   bow: 0.34, colour: '#4ADE80' }] },
      { name: 'racemic', caption: 'Attack from both faces',
        sub: 'so the product is racemised, not inverted',
        atoms: Object.assign({}, skel, {
          lg: { x: LG.x + 1.15, y: LG.y, label: lgLabel + '⁻', colour: '#8FA4CE', charge: -1 },
          nu: { x: -0.95, y: 0, label: nuLabel, colour: '#4ADE80' }
        }),
        bonds: skelBonds.concat([{ a: 'c', b: 'nu', order: 1 }]),
        arrows: [] }
    ];
  }

  L.register({
    id: 'substitution', subject: 'chemistry',
    name: 'SN1 vs SN2 — Mechanism, Stereochemistry and Rate Law',
    chapter: 'Haloalkanes & Haloarenes',
    exams: ['JEE Main', 'JEE Advanced', 'NEET UG'],
    weight: 'Very high yield',
    is3D: true,
    stageHint: 'Drag to orbit · watch the three substituents flip through the planar transition state',
    lede: 'Two mechanisms, two rate laws, two stereochemical outcomes — and the examiner will ask you to pick ' +
      'between them from the substrate, the nucleophile and the solvent. This lab animates the real 3D geometry ' +
      '(<b>backside attack and Walden inversion</b> for SN2, a <b>planar carbocation</b> for SN1), computes both ' +
      'activation barriers from the conditions you set, and tallies the product stereochemistry as it forms.',

    params: { sub: 2, mech: 'auto', nu: 1, solvent: 'protic', conc: 0.5, T: 298, labels: true,
              arrows: true },

    presets: [
      { name: 'CH₃Br + strong Nu (textbook SN2)', params: { sub: 0, nu: 2, solvent: 'aprotic', conc: 1.0, mech: 'auto' } },
      { name: '3° halide, polar protic (SN1)', params: { sub: 3, nu: 0, solvent: 'protic', conc: 0.2, mech: 'auto' } },
      { name: '2° borderline', params: { sub: 2, nu: 1, solvent: 'protic', conc: 0.5, mech: 'auto' } },
      { name: 'Force SN2 on 3° (watch it fail)', params: { sub: 3, nu: 2, solvent: 'aprotic', mech: 'sn2' } }
    ],

    controls: [
      { group: 'Substrate', items: [
        { key: 'sub', type: 'select', label: 'Alkyl halide', restructure: true, options: [
          { value: 0, label: 'CH₃' }, { value: 1, label: '1°' }, { value: 2, label: '2°' }, { value: 3, label: '3°' }] }
      ] },
      { group: 'Conditions', items: [
        { key: 'nu', type: 'select', label: 'Nucleophile', options: [
          { value: 0, label: 'Weak' }, { value: 1, label: 'Moderate' }, { value: 2, label: 'Strong' }] },
        { key: 'solvent', type: 'select', label: 'Solvent', options: [
          { value: 'protic', label: 'Polar protic' }, { value: 'aprotic', label: 'Polar aprotic' }] },
        { key: 'conc', label: 'Nucleophile conc. [Nu⁻]', min: 0.05, max: 2, step: 0.05, unit: 'M',
          fmt: v => v.toFixed(2) },
        { key: 'T', label: 'Temperature <i>T</i>', min: 273, max: 353, step: 1, unit: 'K', fmt: v => v.toFixed(0) }
      ] },
      { group: 'Display', items: [
        { key: 'mech', type: 'select', label: 'Mechanism shown', restructure: true, options: [
          { value: 'auto', label: 'Auto (faster one)' }, { value: 'sn2', label: 'Force SN2' }, { value: 'sn1', label: 'Force SN1' }] },
        { key: 'labels', type: 'toggle', label: 'Show atom labels' },
        { key: 'arrows', type: 'toggle', label: 'Show the curly-arrow mechanism' }
      ] }
    ],

    setup(S) {
      const p = S.p;
      const sb = SUBSTRATE[clamp(p.sub | 0, 0, 3)];
      S.sb = sb;

      // Activation barriers (kJ/mol) — trend-accurate teaching model.
      let Ea2 = 58 + 19 * sb.steric - 11 * p.nu + (p.solvent === 'aprotic' ? -9 : 8);
      let Ea1 = 152 - 26 * sb.cation + (p.solvent === 'protic' ? -16 : 10);
      S.Ea2 = Ea2; S.Ea1 = Ea1;
      S.Ea1b = 22;                                   // 2nd step of SN1 — fast
      S.Erxn = -32;

      const RT = R_GAS * p.T;
      S.k2 = Math.exp(-Ea2 / RT) * p.conc;           // bimolecular: [Nu] enters the rate
      S.k1 = Math.exp(-Ea1 / RT);                    // unimolecular: [Nu] does not
      S.fSN2 = S.k2 / (S.k1 + S.k2 || 1);
      S.winner = S.fSN2 >= 0.5 ? 'sn2' : 'sn1';
      S.active = p.mech === 'auto' ? S.winner : p.mech;

      S.u = 0;
      S.face = 1;
      if (S.tally === undefined || S.lastActive !== S.active) { S.tally = { ret: 0, inv: 0 }; }
      S.lastActive = S.active;
      if (!S.cam) { S.cam = Camera({ theta: -0.55, phi: 0.22, dist: 5.4 }); S.cam.minDist = 2.6; S.cam.maxDist = 18; }
      S.cam.target = [0, 0, 0];
    },

    step(S, dt) {
      const prev = S.u;
      S.u += dt * 0.2;
      if (S.u >= 1) {
        S.u = 0;
        if (S.active === 'sn1') {
          S.tally[S.face > 0 ? 'ret' : 'inv']++;
          S.face = Math.random() < 0.5 ? 1 : -1;
        } else S.tally.inv++;
      }
      // SN1 chooses its attack face as the carbocation forms
      if (S.active === 'sn1' && prev < 0.58 && S.u >= 0.58) { /* face already chosen */ }
    },

    drawStage(S, g) {
      const ctx = g.ctx, th = g.theme, p = S.p, cam = S.cam, u = S.u, sb = S.sb;
      const BOND = 1.55;

      /* --- geometry for the current frame --- */
      let subZ, subR, lgZ, nuZ, lgOn = true, nuBonded = false, planar = false;
      if (S.active === 'sn2') {
        subZ = -BOND / 3 + (2 * BOND / 3) * u;
        lgZ = BOND + Math.pow(u, 1.7) * 3.0;
        nuZ = -(3.6 - 2.0 * u);
        planar = Math.abs(u - 0.5) < 0.06;
      } else {
        // SN1: ionise (0–0.5) → planar cation (0.5–0.62) → attack (0.62–1)
        const a = clamp(u / 0.5, 0, 1), b = clamp((u - 0.62) / 0.38, 0, 1);
        subZ = -BOND / 3 + (BOND / 3) * a;
        lgZ = BOND + Math.pow(a, 1.6) * 3.2;
        nuZ = S.face * (3.9 - 2.3 * b);
        // after attack the substituents pyramidalise away from the nucleophile
        subZ = subZ - S.face * (BOND / 3) * b;
        planar = u > 0.45 && u < 0.66;
        nuBonded = b > 0.75;
      }
      subR = Math.sqrt(Math.max(BOND * BOND - subZ * subZ, 0.04));

      /* --- build the atom list --- */
      const atoms = [];
      atoms.push({ p: [0, 0, 0], r: 0.52, c: '#5C6B86', t: 'C' });
      for (let i = 0; i < 3; i++) {
        const a = i * TAU / 3 + 0.3;
        const isMe = i < sb.me;
        atoms.push({
          p: [subR * Math.cos(a), subR * Math.sin(a), subZ],
          r: isMe ? 0.52 : 0.34,
          c: isMe ? '#788AA8' : '#DCE4F2',
          t: isMe ? 'CH₃' : 'H', bond: true
        });
      }
      atoms.push({ p: [0, 0, lgZ], r: 0.62, c: '#C0603A', t: 'Br', lg: true });
      atoms.push({ p: [0, 0, nuZ], r: 0.50, c: '#E05A5A', t: 'OH⁻', nu: true });

      /* --- bonds --- */
      const bonds = [];
      for (let i = 1; i <= 3; i++) bonds.push([atoms[0], atoms[i], 1, false]);
      const lgStretch = clamp((lgZ - BOND) / 1.4, 0, 1);
      if (lgStretch < 1) bonds.push([atoms[0], atoms[4], 1 - lgStretch, lgStretch > 0.05]);
      const nuDist = Math.abs(nuZ);
      if (nuDist < 3.0) bonds.push([atoms[0], atoms[5], clamp((3.0 - nuDist) / 1.5, 0, 1), nuDist > BOND * 1.15]);

      /* --- draw bonds then atoms, painter-sorted --- */
      const items = [];
      bonds.forEach(b => {
        const A = cam.project(b[0].p), B = cam.project(b[1].p);
        if (!A.ok || !B.ok) return;
        items.push({ z: (A.z + B.z) / 2 + 0.3, draw: () => {
          ctx.save();
          ctx.lineCap = 'round';
          ctx.strokeStyle = g.alpha(th['text-2'], 0.30 + 0.55 * b[2]);
          ctx.lineWidth = 2 + 5 * b[2];
          if (b[3]) ctx.setLineDash([5, 5]);
          ctx.beginPath(); ctx.moveTo(A.x, A.y); ctx.lineTo(B.x, B.y); ctx.stroke();
          ctx.restore();
        } });
      });
      atoms.forEach(a => {
        const P = cam.project(a.p);
        if (!P.ok) return;
        items.push({ z: P.z, draw: () => {
          const rr = Math.max(4, a.r * P.s * 0.0125);
          const rg = ctx.createRadialGradient(P.x - rr * .35, P.y - rr * .4, rr * .1, P.x, P.y, rr);
          rg.addColorStop(0, g.mix(a.c, '#ffffff', 0.55));
          rg.addColorStop(0.55, a.c);
          rg.addColorStop(1, g.mix(a.c, '#000000', 0.5));
          ctx.fillStyle = rg;
          ctx.beginPath(); ctx.arc(P.x, P.y, rr, 0, TAU); ctx.fill();
          ctx.strokeStyle = g.alpha('#000000', .35); ctx.lineWidth = 1; ctx.stroke();
          if (p.labels) {
            ctx.font = '600 10px "IBM Plex Mono",monospace';
            ctx.fillStyle = th.text; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
            ctx.fillText(a.t, P.x, P.y - rr - 8);
          }
        } });
      });
      items.sort((x, y) => y.z - x.z).forEach(i => i.draw());

      /* --- the planar transition state / carbocation callout --- */
      if (planar) {
        const C = cam.project([0, 0, 0]);
        if (C.ok) {
          ctx.save(); ctx.globalCompositeOperation = 'lighter';
          const rg = ctx.createRadialGradient(C.x, C.y, 0, C.x, C.y, 60);
          rg.addColorStop(0, g.alpha(th.chem, .22)); rg.addColorStop(1, g.alpha(th.chem, 0));
          ctx.fillStyle = rg; ctx.beginPath(); ctx.arc(C.x, C.y, 60, 0, TAU); ctx.fill();
          ctx.restore();
        }
      }

      /* --- stage caption --- */
      const isS2 = S.active === 'sn2';
      const phase = isS2
        ? (u < 0.38 ? 'Nucleophile approaches from the backside (180° to the C—Br bond)'
          : u < 0.62 ? 'TRANSITION STATE — 5 groups on carbon, trigonal bipyramidal'
          : 'Bromide leaves · configuration has inverted')
        : (u < 0.45 ? 'Step 1 (slow, rate-determining): C—Br ionises'
          : u < 0.66 ? 'PLANAR CARBOCATION — sp², open to attack from either face'
          : 'Step 2 (fast): nucleophile attacks the ' + (S.face > 0 ? 'top' : 'bottom') + ' face');

      ctx.font = '700 15px "IBM Plex Sans Condensed",sans-serif';
      ctx.fillStyle = th.text; ctx.textAlign = 'left'; ctx.textBaseline = 'top';
      ctx.fillText((isS2 ? 'SN2' : 'SN1') + '  ·  ' + sb.label, 14, 12);
      ctx.font = '500 10.5px "IBM Plex Mono",monospace';
      ctx.fillStyle = planar ? th.chem : th['text-2'];
      ctx.fillText(phase, 14, 34);

      if (p.mech !== 'auto' && S.winner !== S.active) {
        ctx.fillStyle = th.crit;
        ctx.fillText('⚠ forced — under these conditions ' + (S.winner === 'sn2' ? 'SN2' : 'SN1') +
          ' is ' + fmt(Math.max(S.k1, S.k2) / Math.max(Math.min(S.k1, S.k2), 1e-300), 2) + '× faster', 14, 50);
      }


      /* ---------------- curly-arrow inset ----------------
         The 3D stage shows the geometry moving; this shows why it moves.
         An exam answer has to reproduce these arrows, not the animation. */
      if (p.arrows) {
        if (!S.aSteps || S.aWas !== S.active) {
          S.aSteps = snMech(isS2, (['H₂O', 'CH₃OH', 'OH⁻'][clamp(p.nu | 0, 0, 2)]), 'Br');
          S.aMech = MECH.makeState(S.aSteps.length);
          S.aWas = S.active;
        }
        MECH.advance(S.aMech, g.dt || 0.016, { travel: 2.0, dwell: 1.35 });
        const iw = Math.min(g.w * 0.31, 268), ih = Math.min(g.h * 0.36, 196);
        const ix = 14, iy = g.h - ih - 30;
        ctx.save();
        ctx.fillStyle = g.alpha(th['ink-900'], .86);
        if (ctx.roundRect) { ctx.beginPath(); ctx.roundRect(ix, iy, iw, ih, 10); }
        else { ctx.beginPath(); ctx.rect(ix, iy, iw, ih); }
        ctx.fill();
        ctx.strokeStyle = g.alpha(th['line-soft'], 1); ctx.lineWidth = 1; ctx.stroke();
        const afr = MECH.frame(S.aSteps, S.aMech.i, S.aMech.u, S.aMech.a);
        MECH.draw(ctx, afr, { x: ix + iw * 0.50, y: iy + ih * 0.58, s: Math.min(iw, ih) * 0.215 }, {
          ground: th['ink-900'], colour: g.alpha(th['text-2'], .95),
          arrow: th.chem, forming: '#4ADE80', breaking: '#FB7185', width: 2.2
        });
        ctx.font = '600 9.5px "IBM Plex Mono",monospace';
        ctx.fillStyle = th.chem; ctx.textAlign = 'center'; ctx.textBaseline = 'top';
        ctx.fillText(afr.caption, ix + iw / 2, iy + 9);
        ctx.font = '500 8.5px "IBM Plex Mono",monospace'; ctx.fillStyle = th['text-3'];
        // the caption must fit the inset, so trim it rather than let it spill
        let sub2 = afr.sub;
        while (sub2.length > 8 && ctx.measureText(sub2).width > iw - 16) sub2 = sub2.slice(0, -2);
        if (sub2 !== afr.sub) sub2 = sub2.replace(/[ ,–—-]+$/, '') + '…';
        ctx.fillText(sub2, ix + iw / 2, iy + 22);
        ctx.restore();
      }

      /* --- stereochemistry tally --- */
      const tot = S.tally.ret + S.tally.inv;
      if (tot > 0) {
        const bx = g.w - 14, by = g.h - 14;
        ctx.textAlign = 'right'; ctx.textBaseline = 'bottom';
        ctx.font = '500 10px "IBM Plex Mono",monospace';
        ctx.fillStyle = th['text-3'];
        ctx.fillText('products formed: ' + tot, bx, by - 26);
        const pi = S.tally.inv / tot;
        const w = 150, h = 9, x0 = bx - w, y0 = by - 20;
        ctx.fillStyle = g.alpha(th.chem, .85); ctx.fillRect(x0, y0, w * pi, h);
        ctx.fillStyle = g.alpha(th['text-3'], .5); ctx.fillRect(x0 + w * pi + 1.5, y0, w * (1 - pi) - 1.5, h);
        ctx.fillStyle = th['text-2']; ctx.textAlign = 'right'; ctx.textBaseline = 'top';
        ctx.fillText('inverted ' + (pi * 100).toFixed(0) + '%  ·  retained ' + ((1 - pi) * 100).toFixed(0) + '%',
          bx, y0 + h + 3);
      }
    },

    plotTitle: 'Reaction-coordinate energy profile (barriers computed from your conditions)',
    legend: [{ c: '#FFAE4C', label: 'active pathway' }, { c: '#63729A', label: 'alternative pathway' }],
    drawPlot(S, g) {
      const nodes2 = [[0, 0], [0.5, S.Ea2], [1, S.Erxn]];
      const nodes1 = [[0, 0], [0.3, S.Ea1], [0.52, S.Ea1 - 46], [0.74, S.Ea1 - 46 + S.Ea1b], [1, S.Erxn]];
      const top = Math.max(S.Ea1, S.Ea2) * 1.18;
      const P = g.Plot({
        xmin: 0, xmax: 1, ymin: Math.min(S.Erxn * 1.6, -50), ymax: top,
        xlabel: 'reaction coordinate', ylabel: 'G (kJ mol⁻¹)',
        xticks: [0, 0.25, 0.5, 0.75, 1], xfmt: v => v.toFixed(2), yfmt: v => v.toFixed(0)
      }).frame();

      const build = nodes => {
        const a = [];
        for (let i = 0; i <= 220; i++) { const x = i / 220; a.push([x, smoothPath(nodes, x)]); }
        return a;
      };
      const c2 = build(nodes2), c1 = build(nodes1);
      const isS2 = S.active === 'sn2';

      P.clip(() => {
        P.hline(0, g.alpha(g.theme['text-3'], .5), [2, 4]);
        P.line(isS2 ? c1 : c2, g.alpha(g.theme['text-3'], .95), 1.5, [5, 4]);
        const act = isS2 ? c2 : c1;
        P.area(act, P.cfg.ymin, g.alpha(g.theme.chem, .12));
        P.line(act, g.theme.chem, 2.5);
        const y = smoothPath(isS2 ? nodes2 : nodes1, S.u);
        P.dot(S.u, y, 4.5, g.theme.text, g.theme['ink-950']);
      });
      P.tag(isS2 ? 0.5 : 0.3, isS2 ? S.Ea2 : S.Ea1,
        'Ea = ' + (isS2 ? S.Ea2 : S.Ea1).toFixed(0) + ' kJ/mol', g.theme.chem, 'left', -10);
      if (!isS2) P.tag(0.52, S.Ea1 - 46, 'carbocation intermediate', g.theme['text-2'], 'left', 10);
      P.tag(1, S.Erxn, 'products', g.theme['text-3'], 'right', -9);
    },

    readouts(S) {
      const p = S.p, isS2 = S.active === 'sn2';
      const ratio = S.k2 / (S.k1 || 1e-300);
      const tot = S.tally.ret + S.tally.inv;
      return [
        { label: 'Dominant mechanism', value: S.winner === 'sn2' ? 'SN2' : 'SN1', unit: '',
          flag: 'accent', hint: (S.fSN2 * 100).toFixed(1) + '% of product via SN2' },
        { label: 'Rate law', value: isS2 ? 'k[RX][Nu]' : 'k[RX]', unit: '',
          hint: isS2 ? 'second order' : 'first order — [Nu] absent' },
        { label: 'Ea (SN2)', value: S.Ea2.toFixed(0), unit: 'kJ/mol', flag: isS2 ? 'accent' : '' },
        { label: 'Ea (SN1, step 1)', value: S.Ea1.toFixed(0), unit: 'kJ/mol', flag: !isS2 ? 'accent' : '' },
        { label: 'k(SN2)/k(SN1)', value: fmt(ratio, 3), unit: '',
          hint: ratio > 1 ? 'SN2 favoured' : 'SN1 favoured' },
        { label: 'Stereochemistry', value: isS2 ? 'Inversion' : 'Racemisation', unit: '',
          flag: isS2 ? 'ok' : 'warn', hint: isS2 ? 'Walden, 100% inverted' : 'planar cation → ~50:50' },
        { label: 'Products counted', value: String(tot), unit: '',
          hint: tot ? (S.tally.inv / tot * 100).toFixed(0) + '% inverted so far' : 'running…' },
        { label: 'Carbocation stability', value: ['—', '1°', '2°', '3°'][S.sb.cation] || '—', unit: '',
          hint: S.sb.cation >= 2 ? 'stabilised → SN1 viable' : 'too unstable for SN1' }
      ];
    },

    equation(S) {
      const p = S.p, isS2 = S.active === 'sn2';
      const RT = R_GAS * p.T;
      if (isS2) {
        return 'rate ' + E.op('=') + ' ' + E.v('k') + '[RX][Nu<sup>−</sup>] ' + E.op('=') +
          ' ' + E.v('k') + E.op('·') + '[RX]' + E.op('·') + E.n(p.conc, 'M') +
          '<br>' + E.v('k') + ' ' + E.op('∝') + ' e<sup>−' + E.v('E') + '<sub>a</sub>/' + E.v('RT') + '</sup>' +
          E.op(',') + ' ' + E.v('E') + '<sub>a</sub> ' + E.op('=') + ' ' + E.n(S.Ea2.toFixed(0), 'kJ/mol') +
          E.op(',') + ' ' + E.v('RT') + ' ' + E.op('=') + ' ' + E.n(RT.toFixed(2), 'kJ/mol') +
          '<br>' + E.op('→') + ' double [Nu<sup>−</sup>] and the rate <b>doubles</b>';
      }
      return 'rate ' + E.op('=') + ' ' + E.v('k') + '[RX] ' + E.op('·') + ' independent of [Nu<sup>−</sup>]' +
        '<br>' + E.v('k') + ' ' + E.op('∝') + ' e<sup>−' + E.v('E') + '<sub>a</sub>/' + E.v('RT') + '</sup>' +
        E.op(',') + ' ' + E.v('E') + '<sub>a</sub>(step 1) ' + E.op('=') + ' ' + E.n(S.Ea1.toFixed(0), 'kJ/mol') +
        '<br>' + E.op('→') + ' double [Nu<sup>−</sup>] and the rate <b>does not change</b>';
    },
    eqNote: '<b>The rate law is the experiment that tells the two apart.</b> Change the [Nu⁻] slider and watch the ' +
      'SN2 rate track it while the SN1 rate sits still — that is precisely how the mechanisms were originally assigned.',

    walkthrough: [
      { title: '1 · SN2 — one step, backside attack',
        body: 'Methyl bromide with a strong nucleophile. Watch the nucleophile come in at 180° to the leaving bond, and the three hydrogens sweep through a flat arrangement like an umbrella in a gale.',
        ask: 'Why must the nucleophile attack from the opposite side of the C—Br bond?',
        reveal: 'It has to reach the <b>σ* antibonding orbital</b> of C—Br, whose large lobe points away from bromine. Coming in from the front would run straight into the bromine\'s lone pairs. This geometric requirement is what forces the <b>inversion</b>.',
        params: { sub: 0, nu: 2, solvent: 'aprotic', conc: 1.0, mech: 'sn2' } },
      { title: '2 · Why a tertiary halide refuses',
        body: 'Keep the mechanism forced to SN2 and switch the substrate to tertiary. Three bulky methyl groups now surround the carbon, and the barrier readout jumps.',
        ask: 'What physically blocks the SN2 route here?',
        reveal: '<b>Steric hindrance at the transition state.</b> The TS crowds five groups around one carbon; with three methyls already there, the nucleophile simply cannot get in. Ea climbs steeply and the rate collapses — the sim warns you it is forcing a losing pathway.',
        params: { sub: 3, nu: 2, solvent: 'aprotic', mech: 'sn2' } },
      { title: '3 · SN1 — two steps through a flat cation',
        body: 'Release the mechanism to auto with a tertiary substrate in a polar protic solvent. Now the bromide leaves first, all by itself.',
        ask: 'The intermediate carbocation is sp² and planar. What does that predict about the product?',
        reveal: '<b>Racemisation.</b> A flat cation can be attacked from either face with equal ease, so you get roughly a 50:50 mixture of both configurations. Let it run and watch the tally bar settle near 50%. In practice a slight excess of inversion is seen, because the departing bromide partly shields one face.',
        params: { sub: 3, nu: 0, solvent: 'protic', conc: 0.2, mech: 'auto' } },
      { title: '4 · The rate law test',
        body: 'This is the decisive experiment. Watch the rate-law readout while you drag the [Nu⁻] slider across its full range.',
        ask: 'Doubling the nucleophile concentration doubles the rate of which mechanism?',
        reveal: '<b>SN2 only.</b> Its slow step involves both partners, so rate = k[RX][Nu]. The SN1 slow step is the ionisation of RX alone, so the nucleophile never appears in the rate law — you can flood the flask with it and the rate will not budge.',
        params: { sub: 2, nu: 1, solvent: 'protic', conc: 1.6, mech: 'auto' } },
      { title: '5 · The solvent decides borderline cases',
        body: 'A secondary halide can go either way. Flip the solvent between polar protic and polar aprotic and watch both barriers and the dominant-mechanism readout move.',
        ask: 'Which solvent favours which mechanism, and why?',
        reveal: '<b>Polar protic favours SN1</b> — hydrogen bonding solvates and stabilises the developing carbocation and the leaving anion. <b>Polar aprotic favours SN2</b> — it dissolves the salt but leaves the anion "naked" and highly reactive, since there are no O—H or N—H hydrogens to cage it.',
        params: { sub: 2, nu: 2, solvent: 'aprotic', conc: 1.0, mech: 'auto' } }
    ],

    notes: '<b>Where this shows up in the paper.</b>' +
      '<ul><li>"Predict the mechanism and product" from substrate + nucleophile + solvent — the single most common haloalkane question.</li>' +
      '<li>Stereochemistry: optically pure substrate → inverted product (SN2) or racemic mixture (SN1).</li>' +
      '<li>Kinetics questions using the order of reaction to identify the mechanism.</li>' +
      '<li>Reactivity orders — SN2: CH₃ &gt; 1° &gt; 2° &gt; 3°, and SN1 exactly reversed.</li></ul>' +
      '<div class="pyq"><em>Trap to avoid</em>Allylic and benzylic halides break the simple trend — they are fast by ' +
      '<b>both</b> routes, because resonance stabilises the carbocation (helping SN1) while the π system also ' +
      'stabilises the SN2 transition state.</div>'
  });

})(window.InsightLab);
