/* ============================================================
   ORGANIC CHEMISTRY — 1. Hückel MO theory & aromaticity
                       2. Conformational analysis
   Both labs compute; neither recites a rule. The 4n+2 verdict
   falls out of a diagonalised Hückel matrix, and the
   conformer populations fall out of a Boltzmann distribution
   over a real torsional potential.
   ============================================================ */
(function (L, O) {
  'use strict';
  const { clamp, TAU, E, fixed } = L;
  const R_GAS = 8.314462618e-3;            // kJ/mol/K

  /* =====================================================================
     Jacobi eigen-decomposition of a real symmetric matrix.
     Returns { val: [...], vec: [[...]] } with vec[k] the k-th eigenvector,
     sorted by ascending eigenvalue. Hückel matrices are small (n <= 12),
     so accuracy matters far more than speed here.
     ===================================================================== */
  function jacobi(Ain) {
    const n = Ain.length;
    const A = Ain.map(r => r.slice());
    let V = [];
    for (let i = 0; i < n; i++) { V.push(new Array(n).fill(0)); V[i][i] = 1; }
    for (let sweep = 0; sweep < 100; sweep++) {
      let off = 0;
      for (let i = 0; i < n; i++) for (let j = i + 1; j < n; j++) off += A[i][j] * A[i][j];
      if (off < 1e-22) break;
      for (let p = 0; p < n; p++) for (let q = p + 1; q < n; q++) {
        if (Math.abs(A[p][q]) < 1e-18) continue;
        const theta = (A[q][q] - A[p][p]) / (2 * A[p][q]);
        const t = Math.sign(theta || 1) / (Math.abs(theta) + Math.sqrt(theta * theta + 1));
        const c = 1 / Math.sqrt(t * t + 1), s = t * c;
        for (let k = 0; k < n; k++) {
          const akp = A[k][p], akq = A[k][q];
          A[k][p] = c * akp - s * akq; A[k][q] = s * akp + c * akq;
        }
        for (let k = 0; k < n; k++) {
          const apk = A[p][k], aqk = A[q][k];
          A[p][k] = c * apk - s * aqk; A[q][k] = s * apk + c * aqk;
        }
        for (let k = 0; k < n; k++) {
          const vkp = V[k][p], vkq = V[k][q];
          V[k][p] = c * vkp - s * vkq; V[k][q] = s * vkp + c * vkq;
        }
      }
    }
    const idx = A.map((_, i) => i).sort((a, b) => A[a][a] - A[b][b]);
    return {
      val: idx.map(i => A[i][i]),
      vec: idx.map(i => V.map(row => row[i]))
    };
  }

  /* Hückel secular matrix in units of β, with α as the zero.
     A heteroatom X is entered the standard way: α_X = α + h·β on the
     diagonal, and k·β for the C–X resonance integral. */
  function huckel(n, cyclic, hetero, hVal, kVal) {
    const M = [];
    for (let i = 0; i < n; i++) M.push(new Array(n).fill(0));
    for (let i = 0; i < n - 1; i++) { M[i][i + 1] = 1; M[i + 1][i] = 1; }
    if (cyclic && n > 2) { M[0][n - 1] = 1; M[n - 1][0] = 1; }
    if (hetero) {
      M[0][0] = hVal;
      for (let j = 0; j < n; j++) if (M[0][j] && j !== 0) { M[0][j] = kVal; M[j][0] = kVal; }
    }
    // Hückel energies are E = α + xβ with β negative, so the most bonding
    // level is the LARGEST x. Diagonalising -M puts them in that order.
    const neg = M.map(r => r.map(v => -v));
    const e = jacobi(neg);
    return {
      x: e.val.map(v => -v),                  // descending-in-bonding order
      c: e.vec,
      M: M
    };
  }

  /* Fill the levels with nEl electrons, respecting degeneracy: a
     degenerate pair takes one electron each before pairing, which is
     exactly why cyclobutadiene is a triplet diradical. */
  function fill(x, nEl) {
    const occ = new Array(x.length).fill(0);
    const groups = [];
    for (let i = 0; i < x.length;) {
      let j = i; while (j + 1 < x.length && Math.abs(x[j + 1] - x[i]) < 1e-6) j++;
      groups.push([i, j]); i = j + 1;
    }
    let left = nEl;
    groups.forEach(([a, b]) => {
      const slots = (b - a + 1);
      const single = Math.min(left, slots); for (let i = 0; i < single; i++) occ[a + i] = 1;
      left -= single;
      const pair = Math.min(left, slots); for (let i = 0; i < pair; i++) occ[a + i] += 1;
      left -= pair;
    });
    return occ;
  }

  /* =====================================================================
     LAB 1 — HÜCKEL MO THEORY AND AROMATICITY
     ===================================================================== */
  const PRESET_SYS = {
    benzene:       { n: 6, cyclic: true,  q: 0, name: 'Benzene' },
    cyclobutadiene:{ n: 4, cyclic: true,  q: 0, name: 'Cyclobutadiene' },
    cyclopropenyl: { n: 3, cyclic: true,  q: 1, name: 'Cyclopropenyl cation' },
    cyclopentadienyl:{ n: 5, cyclic: true, q: -1, name: 'Cyclopentadienyl anion' },
    cycloheptatrienyl:{ n: 7, cyclic: true, q: 1, name: 'Tropylium cation' },
    cyclooctatetraene:{ n: 8, cyclic: true, q: 0, name: 'Cyclooctatetraene' },
    butadiene:     { n: 4, cyclic: false, q: 0, name: '1,3-Butadiene' },
    allyl:         { n: 3, cyclic: false, q: 1, name: 'Allyl cation' }
  };

  L.register({
    id: 'huckel', subject: 'chemistry',
    name: 'Hückel MO Theory — Where 4n + 2 Actually Comes From',
    chapter: 'Aromaticity & Molecular Orbitals',
    exams: ['JEE Advanced', 'JEE Main'],
    weight: 'Very high yield',
    is3D: false,
    stageHint: 'Click any level in the ladder to draw that molecular orbital on the ring',
    lede: 'Hückel\'s rule is not a rule to memorise — it is the arithmetic of a matrix. This lab builds the ' +
      'secular determinant for any π system you choose, <b>diagonalises it live</b>, fills the levels with ' +
      'electrons and reports the delocalisation energy. Aromatic, antiaromatic and non-aromatic fall out of ' +
      'the numbers. A <b>Frost circle</b> is drawn beside the computed ladder so you can see that the ' +
      'mnemonic and the eigenvalues are the same thing.',

    params: {
      system: 'benzene', n: 6, cyclic: true, charge: 0, mo: 0,
      hetero: false, hh: 0.5, kk: 0.8, frost: true, showCoef: true, planar: true
    },

    presets: [
      { name: 'Benzene — aromatic', params: { system: 'benzene', n: 6, cyclic: true, charge: 0, hetero: false, planar: true } },
      { name: 'Cyclobutadiene — antiaromatic', params: { system: 'cyclobutadiene', n: 4, cyclic: true, charge: 0, hetero: false, planar: true } },
      { name: 'Cyclopropenyl cation', params: { system: 'cyclopropenyl', n: 3, cyclic: true, charge: 1, hetero: false } },
      { name: 'Cyclopentadienyl anion', params: { system: 'cyclopentadienyl', n: 5, cyclic: true, charge: -1, hetero: false } },
      { name: 'Tropylium cation', params: { system: 'cycloheptatrienyl', n: 7, cyclic: true, charge: 1, hetero: false } },
      { name: 'COT — tub-shaped, not planar', params: { system: 'cyclooctatetraene', n: 8, cyclic: true, charge: 0, hetero: false, planar: false } },
      { name: '1,3-Butadiene — conjugation', params: { system: 'butadiene', n: 4, cyclic: false, charge: 0, hetero: false } },
      { name: 'Pyridine (N at position 1)', params: { system: 'benzene', n: 6, cyclic: true, charge: 0, hetero: true, hh: 0.5, kk: 1.0 } }
    ],

    controls: [
      { group: 'The π system', items: [
        { key: 'system', type: 'select', label: 'Ready-made system', restructure: true, rebuild: true,
          options: Object.keys(PRESET_SYS).map(k => ({ value: k, label: PRESET_SYS[k].name })),
          onChange(S) {
            const d = PRESET_SYS[S.p.system];
            if (d) { S.p.n = d.n; S.p.cyclic = d.cyclic; S.p.charge = d.q; }
          } },
        { key: 'n', label: 'Carbons in the π system <i>n</i>', min: 3, max: 12, step: 1,
          fmt: v => v.toFixed(0), restructure: true, rebuild: true },
        { key: 'cyclic', type: 'toggle', label: 'Close the ring (cyclic π system)', restructure: true },
        { key: 'charge', label: 'Charge on the system', min: -2, max: 2, step: 1,
          fmt: v => (v > 0 ? '+' : '') + v.toFixed(0), restructure: true, rebuild: true },
        { key: 'planar', type: 'toggle', label: 'Ring is planar (delocalisation possible)' }
      ] },
      { group: 'Heteroatom (Coulomb and resonance integrals)', items: [
        { key: 'hetero', type: 'toggle', label: 'Replace atom 1 with a heteroatom', restructure: true, rebuild: true },
        { key: 'hh', label: 'Coulomb parameter <i>h</i>  (α<sub>X</sub> = α + hβ)', min: -1, max: 2, step: 0.05,
          fmt: v => v.toFixed(2), restructure: true, when: S => S.p.hetero },
        { key: 'kk', label: 'Resonance parameter <i>k</i>  (β<sub>CX</sub> = kβ)', min: 0.2, max: 1.5, step: 0.05,
          fmt: v => v.toFixed(2), restructure: true, when: S => S.p.hetero }
      ] },
      { group: 'Display', items: [
        { key: 'mo', label: 'Molecular orbital drawn', min: 0, max: 11, step: 1,
          fmt: v => 'ψ' + (v + 1) },
        { key: 'frost', type: 'toggle', label: 'Show the Frost circle beside the ladder' },
        { key: 'showCoef', type: 'toggle', label: 'Print the MO coefficients' }
      ] }
    ],

    setup(S) {
      const p = S.p;
      p.n = clamp(Math.round(p.n), 3, 12);
      const H = huckel(p.n, p.cyclic, p.hetero, p.hh, p.kk);
      S.x = H.x; S.c = H.c; S.M = H.M;
      // one π electron per sp2 carbon, adjusted by charge; a heteroatom
      // such as the N of pyrrole contributes its lone pair instead
      S.nEl = clamp(p.n - p.charge + (p.hetero && p.hh > 1.2 ? 1 : 0), 0, 2 * p.n);
      S.occ = fill(S.x, S.nEl);
      S.Epi = S.x.reduce((a, xv, i) => a + S.occ[i] * xv, 0);          // in units of β
      // reference: the same electrons in isolated, non-interacting π bonds
      const nPairs = Math.floor(S.nEl / 2), odd = S.nEl % 2;
      S.Eref = nPairs * 2 * 1 + odd * 1;                                // each ethene level x = +1
      S.DE = p.cyclic && p.planar ? S.Epi - S.Eref : 0;
      S.homo = -1; S.lumo = -1;
      for (let i = 0; i < S.x.length; i++) { if (S.occ[i] > 0) S.homo = i; }
      for (let i = 0; i < S.x.length; i++) { if (S.occ[i] < 2) { S.lumo = i; break; } }
      S.gap = (S.homo >= 0 && S.lumo >= 0 && S.lumo !== S.homo) ? S.x[S.homo] - S.x[S.lumo] : 0;
      // degenerate, half-filled HOMO = antiaromatic signature
      const degHalf = S.homo >= 0 && S.occ[S.homo] === 1;
      const nPi = S.nEl;
      S.huckelN = (nPi - 2) / 4;
      S.isHuckel = p.cyclic && Math.abs(S.huckelN - Math.round(S.huckelN)) < 1e-9 && S.huckelN >= 0;
      S.antiN = p.cyclic && nPi > 0 && Math.abs(nPi / 4 - Math.round(nPi / 4)) < 1e-9;
      S.verdict = !p.cyclic ? 'Conjugated, not cyclic — non-aromatic'
        : !p.planar ? 'Non-planar — the p orbitals cannot overlap, so non-aromatic'
        : S.isHuckel && !degHalf ? 'AROMATIC'
        : (S.antiN || degHalf) ? 'ANTIAROMATIC'
        : 'Non-aromatic';
      p.mo = clamp(Math.round(p.mo), 0, p.n - 1);
      S.pick = p.mo;
      S.t = 0;
    },

    step(S, dt) { S.t += dt; },

    onPointer(S, x, y, down) {
      if (!down || !S.ladder) return;
      const hit = S.ladder.find(L2 => Math.abs(y - L2.y) < 9 && x > L2.x0 - 30 && x < L2.x1 + 30);
      if (hit) { S.p.mo = hit.i; S.pick = hit.i; }
    },

    drawStage(S, g) {
      const ctx = g.ctx, th = g.theme, p = S.p, W = g.w, H = g.h;
      const n = p.n;
      const molX = W * 0.26, ladX0 = W * 0.53;

      /* ---------------- the molecule with the chosen MO on it ---------------- */
      const r = Math.min(W * 0.15, H * 0.26);
      const cy = H * 0.46;
      const k = clamp(S.pick, 0, n - 1);
      const coef = S.c[k] || [];
      const pos = [];
      if (p.cyclic) {
        for (let i = 0; i < n; i++) {
          const a = -Math.PI / 2 + i / n * TAU;
          pos.push([molX + Math.cos(a) * r, cy + Math.sin(a) * r]);
        }
      } else {
        const span = r * 1.9;
        for (let i = 0; i < n; i++) {
          const u = n > 1 ? i / (n - 1) : 0.5;
          pos.push([molX - span + u * span * 2, cy + (i % 2 ? r * 0.18 : -r * 0.18)]);
        }
      }

      // skeleton first
      for (let i = 0; i < n - 1; i++)
        O.bond(ctx, pos[i][0], pos[i][1], pos[i + 1][0], pos[i + 1][1],
          { colour: g.alpha(th['text-2'], .75), width: 2.2 });
      if (p.cyclic && n > 2)
        O.bond(ctx, pos[n - 1][0], pos[n - 1][1], pos[0][0], pos[0][1],
          { colour: g.alpha(th['text-2'], .75), width: 2.2 });

      // p orbitals, one per centre, scaled and phased by the eigenvector
      const lobeR = Math.min(r * 0.72, 34);
      pos.forEach((q, i) => {
        const tilt = p.cyclic ? 0 : 0;
        O.pOrbital(ctx, q[0], q[1], lobeR, coef[i] || 0, { tilt: tilt });
        if (p.showCoef) {
          const off = p.cyclic ? r * 1.46 : 0;
          const a = -Math.PI / 2 + i / Math.max(1, n) * TAU;
          const lx = p.cyclic ? molX + Math.cos(a) * off : q[0];
          const ly = p.cyclic ? cy + Math.sin(a) * off : q[1] + lobeR * 1.6;
          g.label(lx, ly, (coef[i] >= 0 ? '+' : '') + (coef[i] || 0).toFixed(3), {
            size: 9, colour: g.mix(th['text-3'], coef[i] >= 0 ? '#FF6B6B' : '#5AA9FF', 0.35)
          });
        }
        if (p.hetero && i === 0)
          O.atom(ctx, q[0], q[1], 'X', { size: 12, ground: th['ink-950'], colour: '#5AA9FF' });
      });

      // nodal planes: count sign changes around the ring
      let nodes = 0;
      for (let i = 0; i < (p.cyclic ? n : n - 1); i++) {
        const a = coef[i] || 0, b = coef[(i + 1) % n] || 0;
        if (a * b < -1e-9) nodes++;
      }
      ctx.font = '600 11px "IBM Plex Mono",monospace';
      ctx.fillStyle = th.chem; ctx.textAlign = 'center'; ctx.textBaseline = 'top';
      ctx.fillText('ψ' + (k + 1) + '   ' + nodes + ' nodal plane' + (nodes === 1 ? '' : 's'), molX, cy + r * 1.75);
      ctx.font = '500 10px "IBM Plex Mono",monospace'; ctx.fillStyle = th['text-3'];
      ctx.fillText('E = α ' + (S.x[k] >= 0 ? '+ ' : '− ') + Math.abs(S.x[k]).toFixed(4) + ' β',
        molX, cy + r * 1.75 + 16);

      /* ---------------- energy ladder ---------------- */
      const lx0 = ladX0, lx1 = p.frost ? W * 0.74 : W - 30;
      const top = H * 0.14, bot = H * 0.86;
      const xs = S.x, xmax = Math.max(...xs.map(Math.abs), 1) * 1.15;
      const EY = xv => (top + bot) / 2 - xv / xmax * (bot - top) / 2;

      // the non-bonding line E = α
      ctx.strokeStyle = g.alpha(th['line-soft'], 1); ctx.lineWidth = 1;
      ctx.setLineDash([4, 4]);
      ctx.beginPath(); ctx.moveTo(lx0 - 16, EY(0)); ctx.lineTo(lx1 + 16, EY(0)); ctx.stroke();
      ctx.setLineDash([]);
      ctx.font = '9px "IBM Plex Mono",monospace'; ctx.fillStyle = th['text-3'];
      ctx.textAlign = 'left'; ctx.textBaseline = 'bottom';
      ctx.fillText('α  (non-bonding)', lx0 - 14, EY(0) - 4);

      S.ladder = [];
      // group degenerate levels so they sit side by side, like a real diagram
      const groups = [];
      for (let i = 0; i < n;) {
        let j = i; while (j + 1 < n && Math.abs(xs[j + 1] - xs[i]) < 1e-6) j++;
        groups.push([i, j]); i = j + 1;
      }
      groups.forEach(([a, b]) => {
        const m = b - a + 1;
        const wEach = (lx1 - lx0) / Math.max(2, m + 0.6);
        for (let i = a; i <= b; i++) {
          const y = EY(xs[i]);
          const cx0 = lx0 + (i - a) * wEach * 1.06 + (m === 1 ? (lx1 - lx0) * 0.16 : 0);
          const cx1 = cx0 + wEach * 0.82;
          const sel = i === k;
          const bonding = xs[i] > 1e-6, anti = xs[i] < -1e-6;
          ctx.strokeStyle = sel ? th.chem
            : bonding ? g.alpha('#7CE0A8', .95) : anti ? g.alpha('#FB7185', .9) : g.alpha(th['text-2'], .9);
          ctx.lineWidth = sel ? 3.4 : 2.2;
          ctx.beginPath(); ctx.moveTo(cx0, y); ctx.lineTo(cx1, y); ctx.stroke();
          if (sel) {
            ctx.strokeStyle = g.alpha(th.chem, .30); ctx.lineWidth = 9;
            ctx.beginPath(); ctx.moveTo(cx0, y); ctx.lineTo(cx1, y); ctx.stroke();
          }
          // electrons as up/down arrows in the level
          const ne = S.occ[i];
          for (let e2 = 0; e2 < ne; e2++) {
            const ex = (cx0 + cx1) / 2 + (ne === 2 ? (e2 ? 7 : -7) : 0);
            const dir = e2 === 0 ? -1 : 1;
            ctx.strokeStyle = th.text; ctx.lineWidth = 1.6;
            ctx.beginPath(); ctx.moveTo(ex, y - dir * 9); ctx.lineTo(ex, y + dir * 9); ctx.stroke();
            ctx.fillStyle = th.text;
            ctx.beginPath();
            ctx.moveTo(ex, y - dir * 10);
            ctx.lineTo(ex - 3.2, y - dir * 4.6);
            ctx.lineTo(ex + 3.2, y - dir * 4.6);
            ctx.closePath(); ctx.fill();
            g.sphere(ex, y + dir * 7, 2.4, th.text, { specular: false, rim: false });
          }
          ctx.font = '9px "IBM Plex Mono",monospace';
          ctx.fillStyle = sel ? th.chem : th['text-3'];
          ctx.textAlign = 'right'; ctx.textBaseline = 'middle';
          ctx.fillText((xs[i] >= 0 ? '+' : '−') + Math.abs(xs[i]).toFixed(3), lx0 - 20, y);
          S.ladder.push({ i: i, y: y, x0: cx0, x1: cx1 });
          g.hit((cx0 + cx1) / 2, y, (cx1 - cx0) / 2, 'mo' + i);
        }
      });
      // HOMO / LUMO tags
      if (S.homo >= 0) {
        const L2 = S.ladder.find(q => q.i === S.homo);
        if (L2) { ctx.fillStyle = th.ok; ctx.textAlign = 'left'; ctx.textBaseline = 'middle';
          ctx.font = '600 9.5px "IBM Plex Mono",monospace'; ctx.fillText('HOMO', L2.x1 + 8, L2.y); }
      }
      if (S.lumo >= 0 && S.lumo !== S.homo) {
        const L2 = S.ladder.find(q => q.i === S.lumo);
        if (L2) { ctx.fillStyle = th.warn; ctx.textAlign = 'left'; ctx.textBaseline = 'middle';
          ctx.font = '600 9.5px "IBM Plex Mono",monospace'; ctx.fillText('LUMO', L2.x1 + 8, L2.y); }
      }

      /* ---------------- Frost circle ---------------- */
      if (p.frost && p.cyclic && n >= 3) {
        const fx = W * 0.88, fr = Math.min(W * 0.10, (bot - top) / 2 * 0.92);
        const fy = EY(0);
        ctx.strokeStyle = g.alpha(th['text-3'], .8); ctx.lineWidth = 1.2;
        ctx.beginPath(); ctx.arc(fx, fy, fr, 0, TAU); ctx.stroke();
        ctx.setLineDash([3, 3]);
        ctx.beginPath(); ctx.moveTo(fx - fr * 1.1, fy); ctx.lineTo(fx + fr * 1.1, fy); ctx.stroke();
        ctx.setLineDash([]);
        // the polygon, one vertex down
        const vp = [];
        for (let i = 0; i < n; i++) {
          const a = Math.PI / 2 + i / n * TAU;           // vertex pointing down
          vp.push([fx + Math.cos(a) * fr, fy + Math.sin(a) * fr]);
        }
        ctx.strokeStyle = g.alpha(th.chem, .55); ctx.lineWidth = 1.6;
        ctx.beginPath();
        vp.forEach((q, i) => i ? ctx.lineTo(q[0], q[1]) : ctx.moveTo(q[0], q[1]));
        ctx.closePath(); ctx.stroke();
        // each vertex height IS an eigenvalue — draw the tie lines to prove it
        vp.forEach(q => {
          const xv = (fy - q[1]) / fr * 2;                // vertex height -> x in β
          ctx.fillStyle = th.chem;
          ctx.beginPath(); ctx.arc(q[0], q[1], 3, 0, TAU); ctx.fill();
          ctx.strokeStyle = g.alpha(th.chem, .13); ctx.lineWidth = 0.9;
          const ty = clamp(EY(xv), top - 6, bot + 6);
          ctx.beginPath(); ctx.moveTo(q[0], q[1]); ctx.lineTo(Math.max(lx1 + 18, fx - fr * 1.5), ty); ctx.stroke();
        });
        ctx.font = '9px "IBM Plex Mono",monospace'; ctx.fillStyle = th['text-3'];
        ctx.textAlign = 'center'; ctx.textBaseline = 'top';
        ctx.fillText('Frost circle', fx, fy + fr + 10);
        ctx.fillText('vertices = eigenvalues', fx, fy + fr + 23);
      }

      /* ---------------- verdict banner ---------------- */
      const arom = S.verdict === 'AROMATIC', anti = S.verdict === 'ANTIAROMATIC';
      ctx.font = '700 17px "IBM Plex Sans Condensed",sans-serif';
      ctx.fillStyle = arom ? th.ok : anti ? th.crit : th['text-2'];
      ctx.textAlign = 'left'; ctx.textBaseline = 'top';
      ctx.fillText(S.verdict, 14, 10);
      ctx.font = '500 10px "IBM Plex Mono",monospace'; ctx.fillStyle = th['text-3'];
      ctx.fillText(S.nEl + ' π electrons  ·  ' + (p.cyclic ? 'cyclic' : 'open chain') +
        '  ·  n = ' + (S.isHuckel ? S.huckelN.toFixed(0) + ' satisfies 4n+2' : 'no integer n gives 4n+2'),
        14, 32);
    },

    plots: [
      { title: 'Computed energy levels against ring size — the aromatic islands',
        legend: [{ c: '#7CE0A8', label: 'bonding' }, { c: '#FB7185', label: 'antibonding' },
                 { c: '#FFAE4C', label: 'this system' }],
        draw(S, g) {
          const th = g.theme;
          const P = g.Plot({
            xmin: 2.4, xmax: 12.6, ymin: -2.6, ymax: 2.6,
            xticks: [3, 4, 5, 6, 7, 8, 9, 10, 11, 12], yticks: [-2, -1, 0, 1, 2],
            xlabel: 'ring size', ylabel: 'E − α  (units of β)',
            xfmt: v => v.toFixed(0), yfmt: v => v.toFixed(0)
          }).frame();
          P.clip(() => {
            P.hline(0, g.alpha(th['text-3'], .5), [4, 4]);
            for (let m = 3; m <= 12; m++) {
              const H = huckel(m, true, false, 0, 1);
              H.x.forEach(xv => {
                const col = xv > 1e-6 ? '#7CE0A8' : xv < -1e-6 ? '#FB7185' : g.theme['text-2'];
                g.ctx.strokeStyle = g.alpha(col, m === S.p.n && S.p.cyclic ? 1 : .35);
                g.ctx.lineWidth = m === S.p.n && S.p.cyclic ? 3 : 2;
                g.ctx.beginPath();
                g.ctx.moveTo(P.X(m - 0.34), P.Y(xv)); g.ctx.lineTo(P.X(m + 0.34), P.Y(xv));
                g.ctx.stroke();
              });
            }
            if (S.p.cyclic) P.vline(S.p.n, g.alpha(th.chem, .28));
          });
        },
        hover(S, x) {
          const m = clamp(Math.round(x), 3, 12);
          const H = huckel(m, true, false, 0, 1);
          const occ = fill(H.x, m);
          const Epi = H.x.reduce((a, xv, i) => a + occ[i] * xv, 0);
          return [{ label: 'ring size', value: String(m) },
                  { label: 'levels', value: H.x.map(v => v.toFixed(2)).join(', ') },
                  { label: 'Eπ (neutral)', value: Epi.toFixed(3) + ' β' }];
        } },

      { title: 'Delocalisation energy per π electron — why benzene is the champion',
        legend: [{ c: '#FFAE4C', label: 'DE / electron (β)' }, { c: '#63729A', label: 'this system' }],
        draw(S, g) {
          const pts = [];
          for (let m = 3; m <= 12; m++) {
            const H = huckel(m, true, false, 0, 1);
            const nEl = m;                                    // neutral ring
            const occ = fill(H.x, nEl);
            const Epi = H.x.reduce((a, xv, i) => a + occ[i] * xv, 0);
            const Eref = Math.floor(nEl / 2) * 2 + (nEl % 2);
            pts.push([m, nEl ? (Epi - Eref) / nEl : 0]);
          }
          const ys = pts.map(q => q[1]);
          const P = g.Plot({
            xmin: 2.6, xmax: 12.4, ymin: Math.min(...ys) - 0.05, ymax: Math.max(...ys) + 0.05,
            xticks: [3, 4, 5, 6, 7, 8, 9, 10, 11, 12],
            xlabel: 'ring size (neutral)', ylabel: 'DE per π electron (β)',
            xfmt: v => v.toFixed(0), yfmt: v => v.toFixed(2)
          }).frame();
          P.clip(() => {
            P.hline(0, g.alpha(g.theme['text-3'], .5), [4, 4]);
            P.line(pts, g.theme.chem, 2);
            pts.forEach(q => P.dot(q[0], q[1], 3.4,
              q[1] > 0.01 ? '#7CE0A8' : q[1] < -0.01 ? '#FB7185' : g.theme['text-2'], g.theme['ink-950']));
            if (S.p.cyclic) P.vline(S.p.n, g.alpha(g.theme['text-3'], .6), [3, 3]);
          });
        },
        hover(S, x) {
          const m = clamp(Math.round(x), 3, 12);
          const H = huckel(m, true, false, 0, 1);
          const occ = fill(H.x, m);
          const Epi = H.x.reduce((a, xv, i) => a + occ[i] * xv, 0);
          const Eref = Math.floor(m / 2) * 2 + (m % 2);
          return [{ label: 'ring size', value: String(m) },
                  { label: 'π electrons', value: String(m) },
                  { label: 'DE', value: (Epi - Eref).toFixed(3) + ' β' },
                  { label: 'per electron', value: ((Epi - Eref) / m).toFixed(3) + ' β' }];
        } }
    ],

    readouts(S) {
      const p = S.p;
      return [
        { label: 'π electrons', value: String(S.nEl), unit: '', flag: 'accent' },
        { label: 'Eπ', value: S.Epi.toFixed(4), unit: 'β', hint: 'total π energy above nα' },
        { label: 'Delocalisation energy', value: S.DE.toFixed(4), unit: 'β',
          flag: S.DE > 0.01 ? 'ok' : S.DE < -0.01 ? 'crit' : null,
          hint: 'vs the same electrons in isolated π bonds' },
        { label: 'HOMO–LUMO gap', value: Math.abs(S.gap).toFixed(4), unit: 'β',
          hint: S.gap === 0 ? 'degenerate half-filled HOMO' : 'a large gap means a stable closed shell' },
        { label: '4n + 2 test', value: S.isHuckel ? 'n = ' + S.huckelN.toFixed(0) : 'fails', unit: '',
          flag: S.isHuckel ? 'ok' : 'warn' },
        { label: 'Verdict', value: S.verdict.length > 16 ? S.verdict.slice(0, 15) + '…' : S.verdict, unit: '',
          flag: S.verdict === 'AROMATIC' ? 'ok' : S.verdict === 'ANTIAROMATIC' ? 'crit' : null }
      ];
    },

    equation(S) {
      const k = clamp(S.pick, 0, S.p.n - 1);
      return E.v('E') + E.sub(String(k + 1)) + E.op('=') + E.v('α') + E.op(S.x[k] >= 0 ? '+' : '−') +
        E.n(Math.abs(S.x[k]), 'β', 4) + '&nbsp;&nbsp;&nbsp;' +
        E.op('|') + E.v('H') + E.op('−') + E.v('E') + E.v('S') + E.op('| = 0') + '&nbsp;&nbsp;&nbsp;' +
        E.v('DE') + E.op('=') + E.v('E') + E.sub('π') + E.op('−') + E.v('E') + E.sub('localised') +
        E.op('=') + E.n(S.DE, 'β', 4);
    },
    eqNote: 'The secular determinant is built with α on the diagonal and β between bonded neighbours, ' +
      'then diagonalised numerically. β is negative, so a <b>positive</b> coefficient means a bonding level. ' +
      'Delocalisation energy is measured against the same electrons placed in isolated ethene π bonds.',

    walkthrough: [
      { title: '1 · Benzene: six levels, one of each shape',
        body: 'Start on the benzene preset. The ladder shows one lowest level, then a <b>degenerate pair</b>, ' +
          'then another degenerate pair, then the highest antibonding level. Click each rung and watch the ' +
          'orbital drawn on the ring gain a nodal plane.',
        ask: 'How many nodal planes does the lowest MO have?',
        reveal: 'None. ψ₁ has every p orbital in phase, which is why it is the most bonding level of all.' },
      { title: '2 · Fill it and count',
        body: 'Six π electrons fill the three bonding levels completely. There is no partly filled level, ' +
          'the HOMO–LUMO gap is large, and the delocalisation energy is <b>+2 β</b>.',
        ask: 'Why does a closed shell matter so much here?',
        reveal: 'A closed shell means every bonding level is doubly occupied and nothing is left unpaired. ' +
          'That is the electronic definition of aromatic stability.' },
      { title: '3 · Cyclobutadiene: the same arithmetic, the opposite answer',
        body: 'Switch to cyclobutadiene. Four π electrons: two fill the bonding level, and the other two land ' +
          'in a <b>degenerate, non-bonding pair</b> — one each, unpaired, by Hund\'s rule.',
        ask: 'What is the delocalisation energy?',
        reveal: 'Exactly zero. Cyclising butadiene buys nothing, and the diradical is worse than two isolated ' +
          'double bonds. That is antiaromaticity, computed rather than asserted.' },
      { title: '4 · Charge changes everything',
        body: 'Cyclopropenyl <b>cation</b> has 2 π electrons in one bonding level — aromatic. ' +
          'Cyclopentadienyl <b>anion</b> has 6 — aromatic. Tropylium cation has 6 — aromatic. ' +
          'All three are the same ring skeleton with a different electron count.',
        ask: 'Why is the cyclopentadienyl cation not aromatic?',
        reveal: 'It has 4 π electrons, which lands in the degenerate half-filled pair — antiaromatic, and ' +
          'famously unstable.' },
      { title: '5 · Planarity is a precondition, not a detail',
        body: 'Load cyclooctatetraene and turn <b>planar</b> off. The eigenvalues do not change, but the ' +
          'verdict does: a tub-shaped ring cannot overlap its p orbitals all the way round.',
        ask: 'So is COT antiaromatic?',
        reveal: 'No. It escapes antiaromaticity by puckering into a tub, which localises the double bonds. ' +
          'It is simply non-aromatic — a classic JEE Advanced trap.' },
      { title: '6 · The Frost circle is the same mathematics',
        body: 'Inscribe the polygon in a circle of radius 2β with one vertex at the bottom. The tie lines ' +
          'show every vertex landing exactly on a computed eigenvalue.',
        ask: 'Why does the mnemonic work?',
        reveal: 'For a cyclic polyene the eigenvalues are exactly x = 2cos(2πk/n), which are the heights of ' +
          'the vertices of a regular n-gon inscribed in a circle of radius 2.' }
    ],

    quiz: [
      { q: 'The Hückel eigenvalues of a cyclic π system with n centres are:',
        options: ['x = 2 cos(2πk/n)', 'x = 2 sin(πk/n)', 'x = cos(πk/(n+1))', 'x = n − 2k'], answer: 0,
        why: 'For a ring, x = 2cos(2πk/n) with k = 0, ±1, ±2 … — exactly the vertex heights of the Frost circle.' },
      { q: 'Cyclobutadiene is antiaromatic mainly because:',
        options: ['it has 4n π electrons in a planar ring with a degenerate half-filled HOMO',
                  'it is not planar', 'it has no π electrons', 'its ring strain is very high'], answer: 0,
        why: 'Two electrons sit singly in a degenerate non-bonding pair, giving zero delocalisation energy and a diradical.' },
      { q: 'Which species is aromatic?',
        options: ['Cyclopentadienyl cation', 'Cycloheptatrienyl cation',
                  'Cycloheptatrienyl anion', 'Cyclopropenyl anion'], answer: 1,
        why: 'Tropylium has 6 π electrons in a planar 7-membered ring — 4n+2 with n = 1.' },
      { q: 'Cyclooctatetraene is NOT antiaromatic because:',
        options: ['it has 4n+2 electrons', 'it adopts a non-planar tub conformation',
                  'it has no double bonds', 'β is zero for eight-membered rings'], answer: 1,
        why: 'Puckering destroys the continuous p overlap, so the ring is simply non-aromatic.' },
      { q: 'For benzene the delocalisation energy computed by Hückel theory is:',
        options: ['0', '+2β', '−2β', '+6β'], answer: 1,
        why: 'Eπ = 8β against 6β for three isolated ethenes, so DE = 2β.' },
      { q: 'In a linear polyene the number of nodes in ψₖ is:',
        options: ['k − 1', 'k', 'n − k', '2k'], answer: 0,
        why: 'ψ₁ has no node and every higher MO adds exactly one, which the coefficients on the stage make visible.' }
    ],

    notes:
      '<b>What this lab computes.</b> The full secular determinant, diagonalised by Jacobi rotations. ' +
      'Every eigenvalue, coefficient, delocalisation energy and HOMO–LUMO gap on screen is the numeric ' +
      'answer for the system you have selected — nothing is looked up.' +
      '<div class="pyq"><em>Exam pattern</em>Aromaticity questions almost always test four things at once: ' +
      'is it cyclic, is it planar, is every atom conjugated, and does the π count fit 4n+2? ' +
      'Miss planarity and you will call COT antiaromatic.</div>' +
      '<ul><li><b>Aromatic:</b> cyclic, planar, fully conjugated, 4n+2 π electrons.</li>' +
      '<li><b>Antiaromatic:</b> the same but 4n π electrons — and it must be planar to suffer for it.</li>' +
      '<li><b>Non-aromatic:</b> fails cyclic, planar or conjugated.</li>' +
      '<li>Charged rings are examined constantly: C₃H₃⁺, C₅H₅⁻ and C₇H₇⁺ are all aromatic; ' +
      'C₃H₃⁻, C₅H₅⁺ and C₇H₇⁻ are all antiaromatic.</li>' +
      '<li>Heteroatoms enter as α + hβ. Pyridine\'s nitrogen keeps its lone pair in an sp² orbital in the ' +
      'ring plane, so it contributes <b>one</b> π electron; pyrrole\'s contributes <b>two</b>.</li></ul>'
  });

  /* =====================================================================
     LAB 2 — CONFORMATIONAL ANALYSIS
     Newman projections with a real torsional potential, and the
     cyclohexane ring flip driven by measured A-values.
     ===================================================================== */

  /* A-values: the free-energy preference for the equatorial position,
     kJ/mol. These are experimental numbers, not invented ones. */
  const AVAL = {
    H: 0, F: 1.0, Cl: 2.2, Br: 2.0, I: 1.9, OH: 3.9, OMe: 2.5, CN: 0.7,
    Me: 7.3, Et: 7.5, iPr: 9.2, tBu: 20.5, Ph: 12.1, COOH: 5.9
  };
  const GROUP_LABEL = {
    H: 'H', F: 'F', Cl: 'Cl', Br: 'Br', I: 'I', OH: 'OH', OMe: 'OMe', CN: 'CN',
    Me: 'CH₃', Et: 'C₂H₅', iPr: 'iPr', tBu: 't-Bu', Ph: 'Ph', COOH: 'COOH'
  };

  /* Torsional potential about a C–C bond, kJ/mol, as a function of the
     dihedral. Threefold term for the bond itself, plus a van der Waals
     term for each pair of substituents that is scaled by how close the
     two groups actually come. This reproduces the textbook butane curve:
     anti 0, gauche 3.8, eclipsed 16, syn-periplanar 19. */
  function torsion(phi, front, back, V3) {
    let E2 = 0;
    // threefold bond term — one maximum at each eclipsed arrangement
    E2 += (V3 / 2) * (1 + Math.cos(3 * phi));
    // pairwise steric term between every front and back substituent
    for (let i = 0; i < 3; i++) for (let j = 0; j < 3; j++) {
      const dphi = phi + (i - j) * (TAU / 3);
      // closeness rises sharply as the two eclipse each other
      const close = (1 + Math.cos(dphi)) / 2;                 // 1 eclipsed, 0 anti
      const sizeF = AVAL[front[i]] || 0, sizeB = AVAL[back[j]] || 0;
      if (sizeF < 1e-9 || sizeB < 1e-9) continue;
      const pair = Math.sqrt(sizeF * sizeB) * 0.155;
      E2 += pair * Math.pow(close, 3.0) * 4.2;                // strong only when eclipsed
      E2 += pair * Math.pow(close, 1.6) * 0.62;               // the gauche shoulder
    }
    return E2;
  }

  const MOLS = {
    ethane:  { name: 'Ethane', front: ['H', 'H', 'H'], back: ['H', 'H', 'H'], V3: 12.0 },
    propane: { name: 'Propane', front: ['Me', 'H', 'H'], back: ['H', 'H', 'H'], V3: 12.0 },
    butane:  { name: 'n-Butane', front: ['Me', 'H', 'H'], back: ['Me', 'H', 'H'], V3: 11.4 },
    dibromo: { name: '1,2-Dibromoethane', front: ['Br', 'H', 'H'], back: ['Br', 'H', 'H'], V3: 11.0 },
    diol:    { name: '1,2-Ethanediol', front: ['OH', 'H', 'H'], back: ['OH', 'H', 'H'], V3: 11.0 },
    ditbu:   { name: '2,2,3,3-Tetramethylbutane', front: ['Me', 'Me', 'Me'], back: ['Me', 'Me', 'Me'], V3: 11.4 }
  };

  L.register({
    id: 'conformers', subject: 'chemistry',
    name: 'Conformational Analysis — Newman Projections & the Ring Flip',
    chapter: 'Stereochemistry & Conformation',
    exams: ['JEE Advanced', 'JEE Main', 'NEET UG'],
    weight: 'High yield',
    is3D: false,
    stageHint: 'Drag anywhere on the stage to rotate the front carbon by hand',
    lede: 'Conformers are not drawings to memorise — they are minima on an energy curve. This lab builds the ' +
      '<b>torsional potential</b> about a C–C bond from a threefold bond term plus a van der Waals term for ' +
      'every pair of substituents, then reports the <b>Boltzmann populations</b> at your chosen temperature. ' +
      'Switch to cyclohexane and the same thermodynamics drives the <b>chair–chair ring flip</b>, with ' +
      'axial/equatorial preference taken from real A-values.',

    params: {
      view: 'newman', mol: 'butane', phi: 180, spin: false, T: 298,
      ring: 'Me', ring2: 'H', rel: '1,4-cis', flip: 0, autoflip: false, showPos: true
    },

    presets: [
      { name: 'Butane — anti (φ = 180°)', params: { view: 'newman', mol: 'butane', phi: 180, spin: false } },
      { name: 'Butane — gauche (φ = 60°)', params: { view: 'newman', mol: 'butane', phi: 60, spin: false } },
      { name: 'Butane — fully eclipsed (φ = 0°)', params: { view: 'newman', mol: 'butane', phi: 0, spin: false } },
      { name: 'Ethane — the pure 12 kJ barrier', params: { view: 'newman', mol: 'ethane', phi: 60, spin: false } },
      { name: 'Methylcyclohexane', params: { view: 'chair', ring: 'Me', ring2: 'H', autoflip: true } },
      { name: 't-Butylcyclohexane — locked', params: { view: 'chair', ring: 'tBu', ring2: 'H', autoflip: true } },
      { name: 'cis-1,4-dimethyl', params: { view: 'chair', ring: 'Me', ring2: 'Me', rel: '1,4-cis', autoflip: true } },
      { name: 'trans-1,4-dimethyl — both equatorial', params: { view: 'chair', ring: 'Me', ring2: 'Me', rel: '1,4-trans', autoflip: true } }
    ],

    controls: [
      { group: 'What to look at', items: [
        { key: 'view', type: 'select', label: 'View', restructure: true, rebuild: true, options: [
          { value: 'newman', label: 'Newman projection' }, { value: 'chair', label: 'Cyclohexane chair' }] }
      ] },
      { group: 'Open-chain rotation', when: S => S.p.view === 'newman', items: [
        { key: 'mol', type: 'select', label: 'Molecule', restructure: true, when: S => S.p.view === 'newman',
          options: Object.keys(MOLS).map(k => ({ value: k, label: MOLS[k].name })) },
        { key: 'phi', label: 'Dihedral angle <i>φ</i>', min: 0, max: 360, step: 1, unit: '°',
          fmt: v => v.toFixed(0), when: S => S.p.view === 'newman' },
        { key: 'spin', type: 'toggle', label: 'Rotate the bond continuously', when: S => S.p.view === 'newman' }
      ] },
      { group: 'Cyclohexane', when: S => S.p.view === 'chair', items: [
        { key: 'ring', type: 'select', label: 'Substituent at C-1', restructure: true, when: S => S.p.view === 'chair',
          options: ['H', 'F', 'Cl', 'Br', 'OH', 'Me', 'Et', 'iPr', 'tBu', 'Ph'].map(k => ({ value: k, label: GROUP_LABEL[k] })) },
        { key: 'ring2', type: 'select', label: 'Second substituent', restructure: true, when: S => S.p.view === 'chair',
          options: ['H', 'Cl', 'OH', 'Me', 'tBu'].map(k => ({ value: k, label: GROUP_LABEL[k] })) },
        { key: 'rel', type: 'select', label: 'Relative position', restructure: true,
          when: S => S.p.view === 'chair' && S.p.ring2 !== 'H',
          options: ['1,2-cis', '1,2-trans', '1,3-cis', '1,3-trans', '1,4-cis', '1,4-trans']
            .map(v => ({ value: v, label: v })) },
        { key: 'flip', label: 'Ring-flip coordinate', min: 0, max: 1, step: 0.01,
          fmt: v => v.toFixed(2), when: S => S.p.view === 'chair' },
        { key: 'autoflip', type: 'toggle', label: 'Animate the ring flip', when: S => S.p.view === 'chair' },
        { key: 'showPos', type: 'toggle', label: 'Mark every axial and equatorial position',
          when: S => S.p.view === 'chair' }
      ] },
      { group: 'Conditions', items: [
        { key: 'T', label: 'Temperature <i>T</i>', min: 100, max: 500, step: 1, unit: 'K', fmt: v => v.toFixed(0) }
      ] }
    ],

    setup(S) {
      const p = S.p;
      S.t = 0; S.drag = null;
      S.mol = MOLS[p.mol] || MOLS.butane;

      /* ---- open-chain torsional curve, sampled every degree ---- */
      S.curve = [];
      for (let d = 0; d <= 360; d++) {
        const e = torsion(d * Math.PI / 180, S.mol.front, S.mol.back, S.mol.V3);
        S.curve.push([d, e]);
      }
      const emin = Math.min(...S.curve.map(q => q[1]));
      S.curve = S.curve.map(q => [q[0], q[1] - emin]);
      S.barrier = Math.max(...S.curve.map(q => q[1]));
      // stationary points
      S.minima = []; S.maxima = [];
      const at = i => S.curve[((i % 360) + 360) % 360][1];
      for (let i = 0; i < 360; i++) {
        const a = at(i - 1), b = at(i), c = at(i + 1);       // wraps, so 0° is tested too
        const far = arr => !arr.length || Math.min(i - arr[arr.length - 1][0], 360 - (i - arr[0][0])) > 8;
        if (b <= a && b <= c && far(S.minima)) S.minima.push([i, b]);
        if (b >= a && b >= c && far(S.maxima)) S.maxima.push([i, b]);
      }
      // Boltzmann population of each minimum, from the partition function
      const RT = R_GAS * clamp(p.T, 1, 1000);
      const Z = S.curve.reduce((a, q) => a + Math.exp(-q[1] / RT), 0);
      S.pop = S.minima.map(([d, e]) => {
        // integrate the well around each minimum rather than taking a point
        let w = 0;
        for (let k = -55; k <= 55; k++) {
          const idx = ((d + k) % 360 + 360) % 360;
          w += Math.exp(-S.curve[idx][1] / RT);
        }
        return { deg: d, e: e, frac: w / Z };
      });
      const tot = S.pop.reduce((a, q) => a + q.frac, 0) || 1;
      S.pop.forEach(q => q.frac /= tot);

      /* ---- cyclohexane: which chair is favoured, and by how much ---- */
      const posOf = (rel) => {
        // In a chair, 1,2- and 1,4- cis put one group axial and one
        // equatorial; trans puts both the same. 1,3- is the reverse.
        const m = /1,(\d)-(cis|trans)/.exec(rel || '1,4-cis');
        const sep = m ? +m[1] : 4, isCis = m ? m[2] === 'cis' : true;
        const sameSideNeedsSame = (sep === 3);       // 1,3-cis is di-equatorial
        const same = isCis === sameSideNeedsSame;
        return { sep: sep, cis: isCis, bothSame: same };
      };
      const A1 = AVAL[p.ring] || 0, A2 = p.ring2 === 'H' ? 0 : (AVAL[p.ring2] || 0);
      const rel = posOf(p.rel);
      S.relInfo = rel;
      if (p.ring2 === 'H') {
        // chair A: substituent equatorial; chair B: axial
        S.gA = 0; S.gB = A1;
      } else if (rel.bothSame) {
        // both equatorial in one chair, both axial in the other
        S.gA = 0; S.gB = A1 + A2;
      } else {
        // one of each way round — the flip swaps which group pays
        S.gA = A2; S.gB = A1;
      }
      S.dG = S.gB - S.gA;                                   // kJ/mol, B relative to A
      const RT2 = R_GAS * clamp(p.T, 1, 1000);
      S.K = Math.exp(-S.dG / RT2);                          // [B]/[A]
      S.fracA = 1 / (1 + S.K); S.fracB = S.K / (1 + S.K);
      S.flipBarrier = 45.0;                                 // kJ/mol, cyclohexane
    },

    step(S, dt) {
      S.t += dt;
      const p = S.p;
      if (p.view === 'newman' && p.spin && !S.drag) {
        p.phi = (p.phi + dt * 46) % 360;
      }
      if (p.view === 'chair' && p.autoflip) {
        // dwell in each chair, move quickly through the transition state
        const cyc = (S.t * 0.30) % 2;
        const u = cyc < 1 ? cyc : 2 - cyc;
        p.flip = clamp(u < 0.34 ? 0 : u > 0.66 ? 1 : (u - 0.34) / 0.32, 0, 1);
      }
      S.Enow = p.view === 'newman'
        ? S.curve[Math.round(((p.phi % 360) + 360) % 360)][1]
        : S.gA + (S.gB - S.gA) * p.flip + S.flipBarrier * Math.sin(Math.PI * clamp(p.flip, 0, 1));
    },

    onPointer(S, x, y, down, type, stage) {
      if (S.p.view !== 'newman') return;
      if (down && type === 'down') { S.drag = { x: x, phi: S.p.phi }; return; }
      if (type === 'up' || !down) { S.drag = null; return; }
      if (S.drag) S.p.phi = (((S.drag.phi + (x - S.drag.x) * 0.9) % 360) + 360) % 360;
    },

    drawStage(S, g) {
      const ctx = g.ctx, th = g.theme, p = S.p, W = g.w, H = g.h;
      const ground = th['ink-950'];

      if (p.view === 'newman') {
        /* ---------------- Newman projection ---------------- */
        const cx = W * 0.25, cy = H * 0.52;
        const r = Math.min(W * 0.155, H * 0.29);
        const phi = ((p.phi % 360) + 360) % 360;

        // the two carbons named, so the projection is anchored to a structure
        ctx.font = '600 10px "IBM Plex Mono",monospace';
        ctx.fillStyle = th['text-3']; ctx.textAlign = 'center'; ctx.textBaseline = 'bottom';
        ctx.fillText('front carbon (C-2)', cx, cy - r * 2.02);
        ctx.textBaseline = 'top';
        ctx.fillText('rear carbon (C-3), seen through it', cx, cy + r * 2.02);

        O.newman(ctx, cx, cy, r, phi * Math.PI / 180, {
          front: S.mol.front.map(k => GROUP_LABEL[k] || k),
          back: S.mol.back.map(k => GROUP_LABEL[k] || k),
          frontColour: th.chem, backColour: g.alpha(th['text-2'], .95),
          frontLabel: th.text, backLabel: th['text-2'],
          ground: ground, rim: g.alpha(th['text-2'], .7), size: Math.max(10, r * 0.2)
        });

        // dihedral arc between the two reference substituents
        const a0 = -Math.PI / 2, a1 = phi * Math.PI / 180 - Math.PI / 2;
        ctx.strokeStyle = g.alpha(th.chem, .55); ctx.lineWidth = 1.6;
        ctx.beginPath(); ctx.arc(cx, cy, r * 0.58, a0, a1, false); ctx.stroke();
        ctx.font = '600 11px "IBM Plex Mono",monospace';
        ctx.fillStyle = th.chem; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
        const am = (a0 + a1) / 2;
        ctx.fillText('φ = ' + phi.toFixed(0) + '°', cx + Math.cos(am) * r * 0.34, cy + Math.sin(am) * r * 0.34);

        /* ---------------- the energy curve, live ---------------- */
        const gx0 = W * 0.50, gx1 = W - 26, gy0 = H * 0.80, gy1 = H * 0.20;
        const eMax = S.barrier * 1.12;
        const X = d => gx0 + d / 360 * (gx1 - gx0);
        const Y = e => gy0 - e / eMax * (gy0 - gy1);

        ctx.strokeStyle = g.alpha(th['line-soft'], 1); ctx.lineWidth = 1;
        ctx.beginPath();
        [0, 60, 120, 180, 240, 300, 360].forEach(d => { ctx.moveTo(X(d), gy1); ctx.lineTo(X(d), gy0); });
        ctx.stroke();
        ctx.strokeStyle = g.alpha(th.line, 1);
        ctx.beginPath(); ctx.moveTo(gx0, gy0); ctx.lineTo(gx1, gy0); ctx.stroke();
        ctx.font = '9px "IBM Plex Mono",monospace'; ctx.fillStyle = th['text-3'];
        ctx.textAlign = 'center'; ctx.textBaseline = 'top';
        [0, 60, 120, 180, 240, 300, 360].forEach(d => ctx.fillText(d + '°', X(d), gy0 + 6));
        ctx.textAlign = 'right'; ctx.textBaseline = 'middle';
        for (let e = 0; e <= eMax; e += 5) ctx.fillText(e.toFixed(0), gx0 - 6, Y(e));
        ctx.save(); ctx.translate(gx0 - 34, (gy0 + gy1) / 2); ctx.rotate(-Math.PI / 2);
        ctx.textAlign = 'center'; ctx.fillStyle = th['text-2'];
        ctx.fillText('strain energy (kJ/mol)', 0, 0); ctx.restore();

        // shade the filled area so the wells read as wells
        ctx.beginPath();
        ctx.moveTo(X(0), gy0);
        S.curve.forEach(q => ctx.lineTo(X(q[0]), Y(q[1])));
        ctx.lineTo(X(360), gy0); ctx.closePath();
        ctx.fillStyle = g.alpha(th.chem, .08); ctx.fill();
        ctx.strokeStyle = th.chem; ctx.lineWidth = 2.2; ctx.lineJoin = 'round';
        ctx.beginPath();
        S.curve.forEach((q, i) => i ? ctx.lineTo(X(q[0]), Y(q[1])) : ctx.moveTo(X(q[0]), Y(q[1])));
        ctx.stroke();

        // name every stationary point
        ctx.font = '500 9px "IBM Plex Mono",monospace';
        const tagAt = (d, e, text, col, above) => {
          ctx.fillStyle = col;
          ctx.beginPath(); ctx.arc(X(d), Y(e), 3.4, 0, TAU); ctx.fill();
          ctx.textAlign = d < 40 ? 'left' : d > 320 ? 'right' : 'center';
          ctx.textBaseline = 'bottom';
          const ox = d < 40 ? 5 : d > 320 ? -5 : 0;
          // both families label upward; minima sit on the baseline where the
          // axis ticks are, so they need the extra clearance
          ctx.fillText(text, X(d) + ox, Y(e) - (above ? 9 : 12));
        };
        S.minima.forEach(([d, e]) =>
          tagAt(d, e, (d > 150 && d < 210) ? 'anti' : 'gauche', th.ok, false));
        S.maxima.forEach(([d, e]) =>
          tagAt(d, e, (d < 30 || d > 330) ? 'syn-periplanar' : 'eclipsed', th.crit, true));

        // the marker for where the molecule currently is
        const ex = X(phi), ey = Y(S.Enow || 0);
        ctx.strokeStyle = g.alpha(th.text, .4); ctx.lineWidth = 1; ctx.setLineDash([3, 3]);
        ctx.beginPath(); ctx.moveTo(ex, gy0); ctx.lineTo(ex, ey); ctx.stroke(); ctx.setLineDash([]);
        ctx.save(); ctx.globalCompositeOperation = 'lighter';
        const rg = ctx.createRadialGradient(ex, ey, 0, ex, ey, 16);
        rg.addColorStop(0, g.alpha(th.text, .7)); rg.addColorStop(1, g.alpha(th.text, 0));
        ctx.fillStyle = rg; ctx.beginPath(); ctx.arc(ex, ey, 16, 0, TAU); ctx.fill();
        ctx.restore();
        ctx.fillStyle = th.text;
        ctx.beginPath(); ctx.arc(ex, ey, 5, 0, TAU); ctx.fill();

        /* headline */
        const nearest = S.minima.concat(S.maxima)
          .reduce((b, q) => Math.abs(((q[0] - phi + 540) % 360) - 180) > Math.abs(((b[0] - phi + 540) % 360) - 180) ? q : b,
            S.minima[0] || [180, 0]);
        const isMin = S.minima.indexOf(nearest) >= 0;
        ctx.font = '700 17px "IBM Plex Sans Condensed",sans-serif';
        ctx.fillStyle = th.text; ctx.textAlign = 'left'; ctx.textBaseline = 'top';
        ctx.fillText(S.mol.name + '  ·  ' + (S.Enow || 0).toFixed(2) + ' kJ/mol above the global minimum', 14, 10);
        ctx.font = '500 10px "IBM Plex Mono",monospace'; ctx.fillStyle = th['text-3'];
        ctx.fillText('rotational barrier ' + S.barrier.toFixed(1) + ' kJ/mol   ·   ' +
          S.pop.map(q => q.deg + '° ' + (q.frac * 100).toFixed(0) + '%').join('   ·   '), 14, 32);

      } else {
        /* ---------------- cyclohexane chair ---------------- */
        const cx = W * 0.30, cy = H * 0.46;
        const s = Math.min(W * 0.16, H * 0.30);
        const f = clamp(p.flip, 0, 1);

        // which positions carry substituents, and axial or equatorial in
        // each chair — this is what the flip actually exchanges
        const sep = S.relInfo.sep;
        const i1 = 0, i2 = sep === 2 ? 1 : sep === 3 ? 2 : 3;
        const chairA = !(f > 0.5);
        const pos1 = p.ring2 === 'H'
          ? (chairA ? 'equatorial' : 'axial')
          : (S.relInfo.bothSame ? (chairA ? 'equatorial' : 'axial') : (chairA ? 'axial' : 'equatorial'));
        const pos2 = S.relInfo.bothSame ? pos1 : (pos1 === 'axial' ? 'equatorial' : 'axial');

        const subs = [];
        if (p.ring !== 'H') subs.push({ i: i1, pos: pos1, label: GROUP_LABEL[p.ring], colour: th.chem });
        if (p.ring2 !== 'H') subs.push({ i: i2, pos: pos2, label: GROUP_LABEL[p.ring2], colour: '#7CE0A8' });

        O.chair(ctx, cx, cy, s, {
          flip: f, colour: th['text-2'], ground: ground,
          substituents: subs, showPositions: p.showPos, size: 12
        });

        ctx.font = '9px "IBM Plex Mono",monospace';
        ctx.fillStyle = g.alpha('#FFAE4C', .95); ctx.textAlign = 'left'; ctx.textBaseline = 'middle';
        if (p.showPos) {
          ctx.fillText('● axial', cx + s * 1.35, cy - s * 0.62);
          ctx.fillStyle = g.alpha('#5AA9FF', .95);
          ctx.fillText('● equatorial', cx + s * 1.35, cy - s * 0.62 + 14);
        }

        /* the two-well free-energy diagram for the flip */
        const gx0 = W * 0.56, gx1 = W - 26, gy0 = H * 0.78, gy1 = H * 0.16;
        const eMax = Math.max(S.gA, S.gB) + S.flipBarrier * 1.16;
        const X = u => gx0 + u * (gx1 - gx0);
        const Y = e => gy0 - e / eMax * (gy0 - gy1);
        const path = u => S.gA + (S.gB - S.gA) * u + S.flipBarrier * Math.sin(Math.PI * u);

        ctx.strokeStyle = g.alpha(th.line, 1); ctx.lineWidth = 1;
        ctx.beginPath(); ctx.moveTo(gx0, gy0); ctx.lineTo(gx1, gy0); ctx.stroke();
        ctx.beginPath();
        for (let i = 0; i <= 120; i++) { const u = i / 120; i ? ctx.lineTo(X(u), Y(path(u))) : ctx.moveTo(X(u), Y(path(u))); }
        ctx.strokeStyle = th.chem; ctx.lineWidth = 2.4; ctx.lineJoin = 'round'; ctx.stroke();

        // wells, barrier and the ΔG that decides the equilibrium
        ctx.font = '500 9.5px "IBM Plex Mono",monospace';
        ctx.textAlign = 'center'; ctx.textBaseline = 'top';
        ctx.fillStyle = S.gA <= S.gB ? th.ok : th['text-2'];
        ctx.fillText('chair A', X(0.02), Y(S.gA) + 10);
        ctx.fillText((S.fracA * 100).toFixed(1) + '%', X(0.02), Y(S.gA) + 23);
        ctx.fillStyle = S.gB < S.gA ? th.ok : th['text-2'];
        ctx.fillText('chair B', X(0.98), Y(S.gB) + 10);
        ctx.fillText((S.fracB * 100).toFixed(1) + '%', X(0.98), Y(S.gB) + 23);
        ctx.fillStyle = th.crit; ctx.textBaseline = 'bottom';
        ctx.fillText('half-chair / twist-boat  ‡', X(0.5), Y(path(0.5)) - 8);
        ctx.fillText('Ea ≈ ' + S.flipBarrier.toFixed(0) + ' kJ/mol', X(0.5), Y(path(0.5)) - 21);

        // the live marker
        const mx = X(f), my = Y(path(f));
        ctx.save(); ctx.globalCompositeOperation = 'lighter';
        const rg = ctx.createRadialGradient(mx, my, 0, mx, my, 17);
        rg.addColorStop(0, g.alpha(th.text, .7)); rg.addColorStop(1, g.alpha(th.text, 0));
        ctx.fillStyle = rg; ctx.beginPath(); ctx.arc(mx, my, 17, 0, TAU); ctx.fill();
        ctx.restore();
        ctx.fillStyle = th.text; ctx.beginPath(); ctx.arc(mx, my, 5, 0, TAU); ctx.fill();

        // ΔG bracket between the two wells
        if (Math.abs(S.dG) > 0.05) {
          const bx = X(0.14);
          ctx.strokeStyle = g.alpha(th.warn, .9); ctx.lineWidth = 1.4;
          ctx.setLineDash([3, 3]);
          ctx.beginPath(); ctx.moveTo(bx, Y(S.gA)); ctx.lineTo(bx, Y(S.gB)); ctx.stroke();
          ctx.setLineDash([]);
          ctx.fillStyle = th.warn; ctx.textAlign = 'left'; ctx.textBaseline = 'middle';
          ctx.fillText('ΔG° = ' + S.dG.toFixed(1) + ' kJ/mol', bx + 7, (Y(S.gA) + Y(S.gB)) / 2);
        }

        ctx.font = '700 17px "IBM Plex Sans Condensed",sans-serif';
        ctx.fillStyle = th.text; ctx.textAlign = 'left'; ctx.textBaseline = 'top';
        const nm = p.ring2 === 'H'
          ? GROUP_LABEL[p.ring] + 'cyclohexane'
          : p.rel + '-' + GROUP_LABEL[p.ring] + ',' + GROUP_LABEL[p.ring2] + '-cyclohexane';
        ctx.fillText(nm, 14, 10);
        ctx.font = '500 10px "IBM Plex Mono",monospace'; ctx.fillStyle = th['text-3'];
        ctx.fillText((S.fracA >= S.fracB ? (S.fracA * 100).toFixed(1) + '% sits in chair A'
                                         : (S.fracB * 100).toFixed(1) + '% sits in chair B') +
          '   ·   K = ' + S.K.toFixed(4) + '   ·   ' + p.T.toFixed(0) + ' K', 14, 32);
      }
    },

    plots: [
      { title(S) {
          return S.p.view === 'newman'
            ? 'Torsional potential and the Boltzmann population of each well'
            : 'Axial–equatorial preference: how A-value and temperature set the equilibrium';
        },
        legend: [{ c: '#FFAE4C', label: 'strain energy' }, { c: '#4ADE80', label: 'population' }],
        draw(S, g) {
          const th = g.theme;
          if (S.p.view === 'newman') {
            const P = g.Plot({
              xmin: 0, xmax: 360, ymin: 0, ymax: S.barrier * 1.14,
              xticks: [0, 60, 120, 180, 240, 300, 360],
              xlabel: 'dihedral φ (degrees)', ylabel: 'E (kJ/mol)',
              xfmt: v => v.toFixed(0), yfmt: v => v.toFixed(0)
            }).frame();
            P.clip(() => {
              P.area(S.curve, 0, g.alpha(th.chem, .10));
              P.line(S.curve, th.chem, 2.2);
              // Boltzmann weight, on its own normalised scale, as a filled curve
              const RT = R_GAS * clamp(S.p.T, 1, 1000);
              const wt = S.curve.map(q => [q[0], Math.exp(-q[1] / RT)]);
              const wmax = Math.max(...wt.map(q => q[1])) || 1;
              P.line(wt.map(q => [q[0], q[1] / wmax * S.barrier]), g.alpha(th.ok, .9), 1.8, [5, 3]);
              S.minima.forEach(([d, e]) => P.dot(d, e, 3.6, th.ok, th['ink-950']));
              S.maxima.forEach(([d, e]) => P.dot(d, e, 3.6, th.crit, th['ink-950']));
              P.vline(((S.p.phi % 360) + 360) % 360, g.alpha(th.text, .55), [3, 3]);
            });
            S.pop.forEach(q => P.tag(q.deg, S.barrier * 0.92, (q.frac * 100).toFixed(0) + '%', th.ok, 'center'));
          } else {
            // % equatorial against A-value, at three temperatures
            const P = g.Plot({
              xmin: 0, xmax: 22, ymin: 0, ymax: 100,
              xlabel: 'A-value (kJ/mol)', ylabel: '% in the favoured chair',
              xfmt: v => v.toFixed(0), yfmt: v => v.toFixed(0)
            }).frame();
            const Ts = [[200, .35], [298, 1], [400, .55]];
            P.clip(() => {
              Ts.forEach(([T, a]) => {
                const pts = [];
                for (let A = 0; A <= 22; A += 0.25) {
                  const K = Math.exp(-A / (R_GAS * T));
                  pts.push([A, 100 / (1 + K)]);
                }
                P.line(pts, g.alpha(T === 298 ? th.chem : th['text-2'], a), T === 298 ? 2.4 : 1.6,
                  T === 298 ? null : [4, 3]);
              });
              P.hline(50, g.alpha(th['text-3'], .5), [4, 4]);
              const A1 = Math.abs(S.dG);
              P.vline(A1, g.alpha(th.warn, .6), [3, 3]);
              P.dot(A1, Math.max(S.fracA, S.fracB) * 100, 4.4, th.warn, th['ink-950']);
            });
            Object.keys(AVAL).filter(k => AVAL[k] > 0.4).forEach(k => {
              P.tag(AVAL[k], 8, GROUP_LABEL[k], g.alpha(th['text-3'], .95), 'center');
              P.dot(AVAL[k], 4, 2.4, g.alpha(th['text-3'], .8));
            });
          }
        },
        hover(S, x) {
          if (S.p.view === 'newman') {
            const d = clamp(Math.round(x), 0, 360);
            const RT = R_GAS * clamp(S.p.T, 1, 1000);
            return [{ label: 'φ', value: d + '°' },
                    { label: 'E', value: S.curve[d][1].toFixed(2) + ' kJ/mol' },
                    { label: 'relative weight', value: Math.exp(-S.curve[d][1] / RT).toFixed(4) }];
          }
          const A = clamp(x, 0, 22);
          const K = Math.exp(-A / (R_GAS * S.p.T));
          return [{ label: 'A-value', value: A.toFixed(2) + ' kJ/mol' },
                  { label: 'favoured chair', value: (100 / (1 + K)).toFixed(2) + ' %' },
                  { label: 'K', value: K.toExponential(3) },
                  { label: 'at T', value: S.p.T.toFixed(0) + ' K' }];
        } }
    ],

    readouts(S) {
      const p = S.p;
      if (p.view === 'newman') {
        const anti = S.pop.find(q => q.deg > 150 && q.deg < 210);
        const gau = S.pop.filter(q => !(q.deg > 150 && q.deg < 210));
        return [
          { label: 'Current strain', value: (S.Enow || 0).toFixed(2), unit: 'kJ/mol', flag: 'accent' },
          { label: 'Rotational barrier', value: S.barrier.toFixed(2), unit: 'kJ/mol',
            hint: 'highest eclipsed arrangement' },
          { label: 'Anti population', value: anti ? (anti.frac * 100).toFixed(1) : '—', unit: '%',
            flag: 'ok', hint: 'φ = 180°' },
          { label: 'Gauche population', value: gau.length ? (gau.reduce((a, q) => a + q.frac, 0) * 100).toFixed(1) : '—',
            unit: '%', hint: 'both gauche wells together' },
          { label: 'Gauche penalty', value: gau.length && anti ? (gau[0].e - anti.e).toFixed(2) : '—', unit: 'kJ/mol',
            hint: 'one gauche interaction' },
          { label: 'Temperature', value: p.T.toFixed(0), unit: 'K' }
        ];
      }
      return [
        { label: 'ΔG° (B − A)', value: S.dG.toFixed(2), unit: 'kJ/mol', flag: 'accent' },
        { label: 'K = [B]/[A]', value: S.K < 0.001 ? S.K.toExponential(2) : S.K.toFixed(4), unit: '' },
        { label: 'Favoured chair', value: S.fracA >= S.fracB ? 'A' : 'B', unit: '',
          flag: 'ok', hint: S.fracA >= S.fracB ? 'C-1 group equatorial' : 'the flipped chair wins' },
        { label: 'Population', value: (Math.max(S.fracA, S.fracB) * 100).toFixed(2), unit: '%' },
        { label: 'A-value of C-1 group', value: (AVAL[p.ring] || 0).toFixed(1), unit: 'kJ/mol',
          hint: '1,3-diaxial cost when axial' },
        { label: 'Flip barrier', value: S.flipBarrier.toFixed(0), unit: 'kJ/mol',
          hint: 'about 10⁵ flips per second at 298 K' }
      ];
    },

    equation(S) {
      if (S.p.view === 'newman') {
        return E.v('E') + E.op('(') + E.v('φ') + E.op(') =') +
          E.frac(E.v('V') + E.sub('3'), '2') + E.op('(1 + cos 3') + E.v('φ') + E.op(') +') +
          E.op('Σ') + E.v('E') + E.sub('vdW') + E.op('   →   ') +
          E.v('E') + E.op('=') + E.n(S.Enow || 0, 'kJ/mol', 3);
      }
      return E.v('ΔG') + E.sup('°') + E.op('=') + E.n(S.dG, 'kJ/mol', 3) + E.op('   ') +
        E.v('K') + E.op('= exp(−') + E.v('ΔG') + E.sup('°') + E.op('/') + E.v('RT') + E.op(') =') +
        E.n(S.K, '', 4) + E.op('   ') + E.op('% favoured =') + E.n(Math.max(S.fracA, S.fracB) * 100, '%', 4);
    },
    eqNote: 'The torsional curve is a threefold bond term plus a pairwise van der Waals term for every ' +
      'front–back substituent pair, so the gauche shoulder and the eclipsed maxima both come out of the ' +
      'same expression. Populations are a Boltzmann distribution over the whole curve, not over three points.',

    walkthrough: [
      { title: '1 · Ethane has nothing but the bond term',
        body: 'Load ethane. Three identical minima, three identical maxima, a barrier of about ' +
          '<b>12 kJ/mol</b>. There are no big groups to bump, so the whole barrier is torsional strain.',
        ask: 'Where does that 12 kJ come from if the hydrogens barely touch?',
        reveal: 'Chiefly from the loss of favourable overlap between the filled C–H σ orbital and the ' +
          'empty σ* of the neighbouring bond — hyperconjugation is best in the staggered form.' },
      { title: '2 · Butane: four wells, two depths',
        body: 'Switch to n-butane and sweep φ. Now the two methyls interact. The <b>anti</b> well at 180° is ' +
          'the global minimum; the two <b>gauche</b> wells at 60° and 300° sit a few kJ higher.',
        ask: 'Read the gauche penalty off the readouts. What causes it?',
        reveal: 'About 3.8 kJ/mol, from the two methyl groups being forced 60° apart instead of 180° — a ' +
          'pure steric van der Waals cost.' },
      { title: '3 · The maxima are not all equal either',
        body: 'At φ = 0° the two methyls eclipse each other directly — the <b>syn-periplanar</b> maximum. ' +
          'At 120° and 240° a methyl eclipses only a hydrogen.',
        ask: 'Which is the higher barrier, and by how much?',
        reveal: 'The syn-periplanar one, by roughly 3 kJ/mol. The methyl–methyl eclipse costs more than a ' +
          'methyl–hydrogen eclipse.' },
      { title: '4 · Temperature redistributes, it does not reshape',
        body: 'Raise T to 500 K. The curve does not move — the <b>populations</b> do. The gauche wells fill up ' +
          'as RT becomes comparable to the gauche penalty.',
        ask: 'What happens to the anti : gauche ratio as T → ∞?',
        reveal: 'It tends to the statistical ratio 1 : 2, because there are two gauche wells and only one anti.' },
      { title: '5 · Now the ring: substituents prefer equatorial',
        body: 'Switch to the chair view with a methyl group. Chair A puts it equatorial and chair B axial. ' +
          'The A-value of methyl is <b>7.3 kJ/mol</b>, which is the cost of two 1,3-diaxial interactions.',
        ask: 'What fraction is equatorial at room temperature?',
        reveal: 'About 95%. The equilibrium constant is exp(−7.3/RT) ≈ 0.05.' },
      { title: '6 · t-Butyl locks the ring',
        body: 'Change the group to t-butyl. Its A-value is <b>20.5 kJ/mol</b>, so the axial chair is populated ' +
          'at roughly one part in four thousand.',
        ask: 'Why do problems say t-butyl "locks" the conformation?',
        reveal: 'Because that equilibrium is so lopsided that the ring is effectively frozen with t-butyl ' +
          'equatorial — which is exactly how it is used to fix the geometry in E2 and substitution questions.' },
      { title: '7 · cis and trans behave oppositely at 1,2/1,4 and 1,3',
        body: 'Compare cis- and trans-1,4-dimethyl. <b>trans-1,4</b> can put both methyls equatorial; ' +
          '<b>cis-1,4</b> is stuck with one axial in either chair, so flipping gains nothing.',
        ask: 'What about 1,3?',
        reveal: 'It reverses: <b>cis-1,3</b> is the one that can be di-equatorial, and trans-1,3 cannot. ' +
          'Count positions, do not memorise cis-equals-better.' }
    ],

    quiz: [
      { q: 'The rotational barrier in ethane is approximately:',
        options: ['3 kJ/mol', '12 kJ/mol', '25 kJ/mol', '46 kJ/mol'], answer: 1,
        why: 'About 12 kJ/mol (2.9 kcal/mol), essentially all torsional strain.' },
      { q: 'In n-butane the gauche conformer lies above the anti conformer by roughly:',
        options: ['0.9 kJ/mol', '3.8 kJ/mol', '11 kJ/mol', '19 kJ/mol'], answer: 1,
        why: 'One gauche methyl–methyl interaction costs about 3.8 kJ/mol (0.9 kcal/mol).' },
      { q: 'The A-value of a substituent measures:',
        options: ['its electronegativity', 'the free-energy preference for the equatorial position',
                  'the ring-flip barrier', 'its van der Waals radius'], answer: 1,
        why: 'A = −ΔG° for axial → equatorial, so a larger A-value means a stronger equatorial preference.' },
      { q: 'Which compound can place BOTH methyl groups equatorial?',
        options: ['cis-1,4-dimethylcyclohexane', 'trans-1,4-dimethylcyclohexane',
                  'trans-1,3-dimethylcyclohexane', 'cis-1,2-dimethylcyclohexane'], answer: 1,
        why: 'At 1,4 the trans isomer is the di-equatorial one; at 1,3 it is the cis isomer instead.' },
      { q: 'A t-butyl group effectively locks a cyclohexane ring because:',
        options: ['it raises the ring-flip barrier enormously',
                  'its A-value is so large that the axial chair is essentially unpopulated',
                  'it makes the ring planar', 'it forms a covalent bridge'], answer: 1,
        why: 'The barrier is unchanged — the equilibrium is what is lopsided, roughly 4000 : 1.' },
      { q: 'The transition state for the cyclohexane ring flip is:',
        options: ['the planar ring', 'the half-chair', 'the twist-boat', 'the other chair'], answer: 1,
        why: 'The half-chair is the highest point, about 45 kJ/mol; the twist-boat is a shallow intermediate on the way.' }
    ],

    notes:
      '<b>What this lab computes.</b> A real torsional potential, sampled every degree, with the populations ' +
      'obtained by Boltzmann-weighting the entire curve. The cyclohexane equilibrium uses measured A-values ' +
      'and the same ΔG° = −RT ln K that you use in equilibrium problems.' +
      '<div class="pyq"><em>Exam pattern</em>Conformation questions come in two flavours: read a Newman ' +
      'projection and rank stability, or decide which chair a disubstituted cyclohexane prefers. The second ' +
      'is where marks are lost — count the positions, do not assume cis is always better.</div>' +
      '<ul><li>Stability order for butane: <b>anti &gt; gauche &gt; eclipsed (Me/H) &gt; syn-periplanar</b>.</li>' +
      '<li>Axial substituents suffer <b>two</b> 1,3-diaxial interactions; that is the whole of the A-value.</li>' +
      '<li>1,2- and 1,4-: <b>trans</b> can be di-equatorial. 1,3-: <b>cis</b> can be di-equatorial.</li>' +
      '<li>The ring flip is fast (~10⁵ s⁻¹ at 298 K) — it changes axial to equatorial, but never cis to trans. ' +
      'Cis and trans are configurational isomers and require bond breaking.</li>' +
      '<li>E2 elimination in cyclohexanes needs the leaving group <b>axial</b>, which is why the locked ' +
      't-butyl systems appear in so many JEE Advanced questions.</li></ul>'
  });

})(window.InsightLab, window.ORGART);
