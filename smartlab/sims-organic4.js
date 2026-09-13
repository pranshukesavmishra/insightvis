/* ============================================================
   ORGANIC CHEMISTRY — 5. Carbocation stability, rearrangement
   and Markovnikov addition
   The kinetic scheme is integrated numerically, so the product
   distribution is the answer the rate constants give, not a
   rule quoted in advance.
   ============================================================ */
(function (L, O) {
  'use strict';
  const { clamp, TAU, E } = L;
  const RG = 8.314462618e-3;                      // kJ/mol/K

  /* Alkenes. `a` and `b` are the two carbons of the double bond, each
     described by how many alkyl groups it already carries. Protonating
     one carbon puts the charge on the other. */
  const ALKENES = {
    propene:    { name: 'Propene  CH₃–CH=CH₂',            aSub: 1, bSub: 0, aLabel: 'CH₃', bLabel: 'H',
                  chain: ['CH₃', 'CH', 'CH₂'], shift: null },
    isobutene:  { name: '2-Methylpropene  (CH₃)₂C=CH₂',   aSub: 2, bSub: 0, aLabel: '(CH₃)₂', bLabel: 'H',
                  chain: ['CH₃', 'C(CH₃)', 'CH₂'], shift: null },
    butene1:    { name: '1-Butene  CH₃CH₂–CH=CH₂',        aSub: 1, bSub: 0, aLabel: 'C₂H₅', bLabel: 'H',
                  chain: ['C₂H₅', 'CH', 'CH₂'], shift: null },
    methylbut:  { name: '3-Methyl-1-butene',              aSub: 1, bSub: 0, aLabel: 'iPr', bLabel: 'H',
                  chain: ['iPr', 'CH', 'CH₂'], shift: { from: 2, to: 3, kind: 'hydride' } },
    tbutylethene:{ name: '3,3-Dimethyl-1-butene',         aSub: 1, bSub: 0, aLabel: 't-Bu', bLabel: 'H',
                  chain: ['t-Bu', 'CH', 'CH₂'], shift: { from: 2, to: 3, kind: 'methyl' } },
    styrene:    { name: 'Styrene  C₆H₅–CH=CH₂',           aSub: 1, bSub: 0, aLabel: 'Ph', bLabel: 'H',
                  chain: ['Ph', 'CH', 'CH₂'], shift: null, benzylic: true }
  };

  const HX = {
    HCl: { name: 'HCl', kAcid: 1.0,  x: 'Cl', peroxide: false },
    HBr: { name: 'HBr', kAcid: 1.8,  x: 'Br', peroxide: true },
    HI:  { name: 'HI',  kAcid: 3.2,  x: 'I',  peroxide: false }
  };

  /* Carbocation stabilisation, kJ/mol relative to a primary cation.
     These track the measured hydride-affinity ordering. */
  function cationStability(nAlkyl, benzylic, allylic) {
    let s = 0;
    s += [0, 0, 38, 62][clamp(nAlkyl, 0, 3)];       // methyl, 1°, 2°, 3°
    if (nAlkyl === 0) s -= 42;                       // methyl cation is worse than 1°
    if (benzylic) s += 72;                           // resonance into the ring
    if (allylic) s += 66;
    return s;
  }

  L.register({
    id: 'carbocation', subject: 'chemistry',
    name: 'Carbocations — Markovnikov, Hyperconjugation and Rearrangement',
    chapter: 'Hydrocarbons & Reaction Mechanisms',
    exams: ['JEE Advanced', 'JEE Main', 'NEET UG'],
    weight: 'Very high yield',
    is3D: false,
    stageHint: 'The mechanism runs live — watch which cation forms and whether it survives long enough to rearrange',
    lede: 'Markovnikov\'s rule is a consequence, not a premise. Protonating an alkene can give two different ' +
      'carbocations; the one that forms faster is the more stable one, and this lab computes both barriers from ' +
      '<b>hyperconjugation and inductive stabilisation</b>, then <b>integrates the kinetic scheme</b> to give the ' +
      'product distribution. Where a hydride or methyl shift can reach a better cation, that rearrangement is in ' +
      'the scheme too — which is how the "unexpected" product appears on its own.',

    params: {
      alkene: 'methylbut', hx: 'HBr', T: 298, peroxide: false,
      allowShift: true, showHyper: true, speed: 1
    },

    presets: [
      { name: 'Propene + HBr — plain Markovnikov', params: { alkene: 'propene', hx: 'HBr', peroxide: false, allowShift: true } },
      { name: 'Propene + HBr + peroxide — anti-Markovnikov', params: { alkene: 'propene', hx: 'HBr', peroxide: true } },
      { name: '3-Methyl-1-butene — hydride shift', params: { alkene: 'methylbut', hx: 'HCl', peroxide: false, allowShift: true } },
      { name: 'Same, rearrangement blocked', params: { alkene: 'methylbut', hx: 'HCl', peroxide: false, allowShift: false } },
      { name: '3,3-Dimethyl-1-butene — methyl shift', params: { alkene: 'tbutylethene', hx: 'HCl', allowShift: true } },
      { name: 'Isobutene — clean 3° cation', params: { alkene: 'isobutene', hx: 'HBr', peroxide: false } },
      { name: 'Styrene — benzylic cation', params: { alkene: 'styrene', hx: 'HBr', peroxide: false } },
      { name: 'Cold run (253 K) — selectivity rises', params: { alkene: 'propene', hx: 'HBr', T: 253, peroxide: false } }
    ],

    controls: [
      { group: 'The reaction', items: [
        { key: 'alkene', type: 'select', label: 'Alkene', restructure: true, rebuild: true,
          options: Object.keys(ALKENES).map(k => ({ value: k, label: ALKENES[k].name })) },
        { key: 'hx', type: 'select', label: 'Reagent', restructure: true,
          options: Object.keys(HX).map(k => ({ value: k, label: 'H' + HX[k].x })) },
        { key: 'peroxide', type: 'toggle', label: 'Peroxide present (radical pathway)', restructure: true },
        { key: 'T', label: 'Temperature <i>T</i>', min: 220, max: 420, step: 1, unit: 'K',
          fmt: v => v.toFixed(0), restructure: true }
      ] },
      { group: 'Mechanism', items: [
        { key: 'allowShift', type: 'toggle', label: 'Allow hydride / methyl shifts', restructure: true },
        { key: 'showHyper', type: 'toggle', label: 'Show the hyperconjugating C–H bonds' },
        { key: 'speed', label: 'Animation speed', min: 0.2, max: 3, step: 0.1, unit: '×', fmt: v => v.toFixed(1) }
      ] }
    ],

    setup(S) {
      const p = S.p;
      const alk = ALKENES[p.alkene] || ALKENES.propene, hx = HX[p.hx] || HX.HBr;
      S.alk = alk; S.hx = hx;

      /* Protonating the less-substituted carbon (b) puts the + on the
         more-substituted carbon (a) — the Markovnikov cation. The
         reverse gives the anti-Markovnikov cation. */
      const markAlkyl = alk.aSub + 1;               // gains a bond to the old b carbon
      const antiAlkyl = alk.bSub + 1;
      S.stabMark = cationStability(markAlkyl, alk.benzylic, false);
      S.stabAnti = cationStability(antiAlkyl, false, false);
      // number of C-H bonds able to hyperconjugate with the empty p orbital
      S.hyperMark = markAlkyl * 3;
      S.hyperAnti = antiAlkyl * 3;

      /* Hammond: a more stable cation is reached through a lower barrier.
         The transfer coefficient of about 0.75 is what makes the
         selectivity as large as it is observed to be. */
      const Ea0 = 88;                               // kJ/mol for a primary cation
      const beta = 0.75;
      S.EaMark = Ea0 - beta * S.stabMark;
      S.EaAnti = Ea0 - beta * S.stabAnti;

      const RT = RG * clamp(p.T, 1, 1000);
      const A = 1e11;
      S.kMark = A * Math.exp(-S.EaMark / RT) * hx.kAcid;
      S.kAnti = A * Math.exp(-S.EaAnti / RT) * hx.kAcid;

      /* Rearrangement: only worth it if it reaches a more stable cation.
         The shift barrier is low (about 25 kJ/mol) but it competes with
         capture of the halide, which is what makes the outcome a race. */
      S.shift = null;
      if (alk.shift && p.allowShift) {
        const toAlkyl = alk.shift.kind === 'hydride' ? markAlkyl + 1 : markAlkyl + 1;
        const stabTo = cationStability(clamp(toAlkyl, 0, 3), false, false);
        const gain = stabTo - S.stabMark;
        if (gain > 4) {
          S.shift = { kind: alk.shift.kind, gain: gain, stabTo: stabTo,
            Ea: Math.max(8, 27 - 0.35 * gain) };
          S.kShift = 1e12 * Math.exp(-S.shift.Ea / RT);
        }
      }
      // capture is bimolecular and the halide is dilute, so an intramolecular
      // 1,2-shift wins comfortably whenever it reaches a better cation
      S.kCapture = 8e7;

      /* Peroxide flips the regiochemistry, and only for HBr. The radical
         chain adds Br• first, giving the more stable carbon radical. */
      S.radical = p.peroxide && hx.peroxide;
      S.peroxideIgnored = p.peroxide && !hx.peroxide;

      // state vector for the integration
      S.C = { alkene: 1, catMark: 0, catAnti: 0, catShift: 0,
              pMark: 0, pAnti: 0, pShift: 0 };
      S.hist = [];
      S.t = 0; S.phase = 0;
      S.done = false;
    },

    step(S, dt) {
      const p = S.p;
      S.t += dt;
      const h = Math.min(dt, 0.05) * 0.55 * clamp(p.speed, 0.1, 4);
      const C = S.C;

      if (S.radical) {
        /* Radical chain: Br• adds to the terminal carbon, giving the more
           substituted (more stable) radical, so the H ends up where
           Markovnikov says the Br would have gone. No cation, so no
           rearrangement is possible. */
        const r = C.alkene * 2.2 * h;
        C.alkene -= r; C.pAnti += r;
      } else {
        const kt = S.kMark + S.kAnti;
        const scale = kt > 0 ? 2.6 / kt : 0;
        const rM = C.alkene * S.kMark * scale * h;
        const rA = C.alkene * S.kAnti * scale * h;
        C.alkene -= (rM + rA);
        C.catMark += rM; C.catAnti += rA;

        // the Markovnikov cation now races: rearrange, or get captured
        if (S.shift) {
          const tot = S.kShift + S.kCapture;
          const fShift = S.kShift / tot;
          const out = C.catMark * 3.4 * h;
          C.catMark -= out;
          C.catShift += out * fShift;
          C.pMark += out * (1 - fShift);
        } else {
          const out = C.catMark * 3.4 * h;
          C.catMark -= out; C.pMark += out;
        }
        const outS = C.catShift * 3.0 * h;
        C.catShift -= outS; C.pShift += outS;
        const outA = C.catAnti * 3.4 * h;
        C.catAnti -= outA; C.pAnti += outA;
      }

      Object.keys(C).forEach(k => { if (C[k] < 0) C[k] = 0; });
      S.hist.push([S.t, C.alkene, C.catMark + C.catShift + C.catAnti,
        C.pMark, C.pShift, C.pAnti]);
      if (S.hist.length > 2200) S.hist.shift();

      const made = C.pMark + C.pShift + C.pAnti || 1;
      S.yield = {
        mark: C.pMark / made * 100,
        shift: C.pShift / made * 100,
        anti: C.pAnti / made * 100
      };
      S.conv = (1 - C.alkene) * 100;
      S.done = C.alkene < 0.004;
      if (S.done && S.t > 1) {
        // restart the run so the mechanism keeps playing
        if (S.t > 1 && C.alkene < 0.0005) {
          S.C = { alkene: 1, catMark: 0, catAnti: 0, catShift: 0, pMark: 0, pAnti: 0, pShift: 0 };
          S.hist = []; S.t = 0;
        }
      }
    },

    drawStage(S, g) {
      const ctx = g.ctx, th = g.theme, p = S.p, W = g.w, H = g.h;
      const ground = th['ink-950'];
      const alk = S.alk, hx = S.hx;

      /* ---------------- the mechanism strip ---------------- */
      const cell = g.layout(3, 1, 22);
      const y0 = H * 0.33;
      const bw = Math.min(cell(0, 0).w - 18, 210);
      const xs = [0, 1, 2].map(i => cell(i, 0).cx);
      const phase = (S.t * 0.55) % 3;

      const stageBox = (x, title, sub, on) => {
        ctx.strokeStyle = on ? g.alpha(th.chem, .9) : g.alpha(th['line-soft'], 1);
        ctx.lineWidth = on ? 1.8 : 1;
        const bx = x - bw / 2, by = y0 - H * 0.20;
        if (ctx.roundRect) { ctx.beginPath(); ctx.roundRect(bx, by, bw, H * 0.44, 10); }
        else { ctx.beginPath(); ctx.rect(bx, by, bw, H * 0.44); }
        ctx.fillStyle = on ? g.alpha(th.chem, .05) : g.alpha(th['ink-900'], .5);
        ctx.fill(); ctx.stroke();
        ctx.font = '600 10px "IBM Plex Mono",monospace';
        ctx.fillStyle = on ? th.chem : th['text-3'];
        ctx.textAlign = 'center'; ctx.textBaseline = 'top';
        ctx.fillText(title, x, by + 9);
        if (sub) {
          ctx.font = '500 9px "IBM Plex Mono",monospace'; ctx.fillStyle = th['text-3'];
          ctx.fillText(sub, x, by + 23);
        }
      };

      /* --- step 1: the alkene and the proton --- */
      stageBox(xs[0], S.radical ? '1 · Br• adds first' : '1 · protonation', hx.name + ' attacks the π bond',
        phase < 1);
      const a1 = [xs[0] - 26, y0 + 10], b1 = [xs[0] + 26, y0 + 10];
      O.bond(ctx, a1[0], a1[1], b1[0], b1[1], { order: 2, colour: th['text-2'], width: 2.6 });
      // the substituted end
      O.bond(ctx, a1[0], a1[1], a1[0] - 30, a1[1] - 20, { colour: th['text-2'], width: 2.2, trim1: 16 });
      O.atom(ctx, a1[0] - 34, a1[1] - 23, alk.chain[0], { size: 12, ground: ground });
      O.bond(ctx, a1[0], a1[1], a1[0] - 24, a1[1] + 22, { colour: th['text-2'], width: 2.2, trim1: 9 });
      O.atom(ctx, a1[0] - 27, a1[1] + 25, 'H', { size: 11, ground: ground });
      // the CH2 end, where the proton lands
      [[-20, 26], [22, 22]].forEach(([ox, oy]) => {
        O.bond(ctx, b1[0], b1[1], b1[0] - ox + 30, b1[1] - oy, { colour: th['text-2'], width: 2.2, trim1: 9 });
        O.atom(ctx, b1[0] - ox + 30, b1[1] - oy, 'H', { size: 11, ground: ground });
      });
      ctx.font = '500 9px "IBM Plex Mono",monospace';
      ctx.fillStyle = g.alpha(th['text-3'], .95); ctx.textAlign = 'center'; ctx.textBaseline = 'top';
      ctx.fillText('π electrons attack H⁺', (a1[0] + b1[0]) / 2, y0 + 54);
      // the curly arrow from the π bond to the proton
      if (phase < 1) {
        const prog = clamp(phase * 1.6, 0, 1);
        const hx2 = b1[0] + 30, hy2 = y0 + 74;
        O.atom(ctx, hx2, hy2, S.radical ? 'Br•' : 'H⁺', {
          size: 12, ground: ground, colour: S.radical ? '#C98A4B' : '#FF6B6B'
        });
        O.curlyArrow(ctx, (a1[0] + b1[0]) / 2, y0 - 2, hx2, hy2 - 12,
          { colour: th.chem, bow: -0.34, progress: prog, half: S.radical });
      }

      /* --- step 2: the cation (or radical) --- */
      const stable = S.stabMark >= S.stabAnti;
      stageBox(xs[1], S.radical ? '2 · carbon radical' : '2 · carbocation',
        S.radical ? 'the more stable radical' :
        (S.shift ? 'then it rearranges' : ['methyl', '1°', '2°', '3°'][clamp(alk.aSub + 1, 0, 3)] +
          (alk.benzylic ? ' benzylic' : '')), phase >= 1 && phase < 2);

      const cx2 = xs[1], cy2 = y0 + 14;
      // the cationic carbon, with its empty p orbital
      O.pOrbital(ctx, cx2, cy2, 26, S.radical ? 0.45 : 0.9,
        { pos: S.radical ? '#C98A4B' : '#FF6B6B', neg: S.radical ? '#8C6A3B' : '#FB7185' });
      O.atom(ctx, cx2, cy2, 'C', { size: 14, ground: ground, charge: S.radical ? 0 : 1 });
      if (S.radical) {
        ctx.fillStyle = '#C98A4B';
        ctx.beginPath(); ctx.arc(cx2 + 13, cy2 - 12, 2.6, 0, TAU); ctx.fill();
      }
      // hyperconjugating C–H bonds, drawn overlapping the empty p orbital
      if (p.showHyper && !S.radical) {
        const n = clamp(S.hyperMark, 0, 9);
        const wob = 0.5 + 0.5 * Math.sin(S.t * 3);
        for (let i = 0; i < Math.min(n, 6); i++) {
          const a = Math.PI * 0.62 + (i / Math.max(1, Math.min(n, 6) - 1)) * Math.PI * 0.76;
          const hxp = cx2 + Math.cos(a) * 42, hyp = cy2 + Math.sin(a) * 30;
          O.bond(ctx, cx2, cy2, hxp, hyp, { colour: g.alpha(th['text-2'], .75), width: 1.8, trim0: 12, trim1: 7 });
          O.atom(ctx, hxp, hyp, 'H', { size: 9.5, ground: ground });
          // the overlap lobe that IS hyperconjugation
          ctx.strokeStyle = g.alpha('#4ADE80', .18 + .4 * wob);
          ctx.lineWidth = 1.4; ctx.setLineDash([3, 3]);
          ctx.beginPath();
          ctx.moveTo(cx2 + Math.cos(a) * 20, cy2 + Math.sin(a) * 15);
          ctx.quadraticCurveTo(cx2 + Math.cos(a) * 14, cy2 - 22, cx2, cy2 - 24);
          ctx.stroke(); ctx.setLineDash([]);
        }
        ctx.font = '500 9px "IBM Plex Mono",monospace';
        ctx.fillStyle = th.ok; ctx.textAlign = 'center'; ctx.textBaseline = 'top';
        ctx.fillText(S.hyperMark + ' α C–H bonds hyperconjugating', cx2, cy2 + 46);
      }

      /* --- step 3: the product(s) --- */
      stageBox(xs[2], '3 · product', S.shift ? 'two products compete' : 'halide captures the cation',
        phase >= 2);
      const px = xs[2], py = y0 + 6;
      const yv = S.yield || { mark: 0, shift: 0, anti: 0 };
      const bars = S.radical
        ? [['anti-Markovnikov', g.tween('ya', yv.anti, 0.2), '#5AA9FF']]
        : [['Markovnikov', g.tween('ym', yv.mark, 0.2), '#4ADE80'],
           ['rearranged', g.tween('ys', yv.shift, 0.2), '#FFAE4C'],
           ['anti-Markovnikov', g.tween('ya', yv.anti, 0.2), '#5AA9FF']];
      bars.forEach(([nm, v, col], i) => {
        const by = py - 18 + i * 34;
        ctx.font = '500 9px "IBM Plex Mono",monospace';
        ctx.fillStyle = th['text-3']; ctx.textAlign = 'left'; ctx.textBaseline = 'bottom';
        ctx.fillText(nm, px - bw / 2 + 14, by - 3);
        const w = bw - 28;
        ctx.fillStyle = g.alpha(th['ink-700'], 1);
        ctx.fillRect(px - bw / 2 + 14, by, w, 9);
        const grd = ctx.createLinearGradient(px - bw / 2 + 14, 0, px - bw / 2 + 14 + w, 0);
        grd.addColorStop(0, g.alpha(col, .5)); grd.addColorStop(1, g.alpha(col, .95));
        ctx.fillStyle = grd;
        ctx.fillRect(px - bw / 2 + 14, by, w * clamp(v / 100, 0, 1), 9);
        ctx.font = '600 10px "IBM Plex Mono",monospace';
        ctx.fillStyle = col; ctx.textAlign = 'right'; ctx.textBaseline = 'middle';
        ctx.fillText(v.toFixed(1) + '%', px + bw / 2 - 14, by + 4.5);
      });

      // arrows between the boxes
      [0, 1].forEach(i => {
        const x0 = xs[i] + bw / 2 + 4, x1 = xs[i + 1] - bw / 2 - 4;
        const on = phase >= i && phase < i + 1;
        ctx.strokeStyle = on ? th.chem : g.alpha(th['text-3'], .5);
        ctx.lineWidth = on ? 2.2 : 1.4;
        ctx.beginPath(); ctx.moveTo(x0, y0 + 14); ctx.lineTo(x1 - 8, y0 + 14); ctx.stroke();
        ctx.fillStyle = on ? th.chem : g.alpha(th['text-3'], .5);
        ctx.beginPath();
        ctx.moveTo(x1, y0 + 14); ctx.lineTo(x1 - 9, y0 + 9.5); ctx.lineTo(x1 - 9, y0 + 18.5);
        ctx.closePath(); ctx.fill();
      });

      /* ---------------- the energy profile ---------------- */
      const ex0 = 34, ex1 = W - 30, ey0 = H * 0.945, ey1 = H * 0.68;
      const pts = [
        { x: 0.00, e: 0, label: 'alkene + H' + hx.x },
        { x: 0.22, e: S.EaMark, label: '‡' },
        { x: 0.42, e: S.EaMark - 46, label: 'cation' }
      ];
      if (S.shift) {
        pts.push({ x: 0.58, e: S.EaMark - 46 + S.shift.Ea, label: '‡ shift' });
        pts.push({ x: 0.74, e: S.EaMark - 46 - S.shift.gain, label: 'better cation' });
      }
      pts.push({ x: 1.00, e: -58, label: 'product' });
      const allE = pts.map(q => q.e).concat([S.EaAnti]);
      const eLo = Math.min(...allE), eHi = Math.max(...allE);
      const map = O.profile(ctx, ex0, ey0, ex1, ey1, pts,
        { colour: th.chem, width: 2.6, eMin: eLo, eMax: eHi });
      // the losing pathway, dimmed
      const alt = [{ x: 0, e: 0 }, { x: 0.22, e: S.EaAnti }, { x: 0.42, e: S.EaAnti - 46 },
                   { x: 1.0, e: -58 }];
      ctx.save(); ctx.setLineDash([5, 4]);
      O.profile(ctx, ex0, ey0, ex1, ey1, alt,
        { colour: g.alpha(th['text-3'], .85), width: 1.8, eMin: eLo, eMax: eHi });
      ctx.restore();

      ctx.font = '500 9px "IBM Plex Mono",monospace';
      ctx.textAlign = 'center'; ctx.textBaseline = 'bottom';
      pts.forEach(q => {
        ctx.fillStyle = q.label.indexOf('‡') >= 0 ? th.crit : th['text-2'];
        ctx.textAlign = q.x < 0.06 ? 'left' : q.x > 0.94 ? 'right' : 'center';
        ctx.fillText(q.label, map.X(q.x), map.Y(q.e) - 7);
        g.sphere(map.X(q.x), map.Y(q.e), 4.2, q.label.indexOf('‡') >= 0 ? '#FB7185' : th.chem);
      });
      ctx.fillStyle = g.alpha(th['text-3'], .95); ctx.textAlign = 'left';
      ctx.fillText('anti-Markovnikov route — Ea ' + S.EaAnti.toFixed(0) + ' kJ/mol',
        map.X(0.24), map.Y(S.EaAnti) - 7);
      ctx.textAlign = 'right'; ctx.textBaseline = 'top';
      ctx.fillStyle = th['text-3'];
      ctx.fillText('reaction coordinate', ex1, ey0 + 5);

      /* ---------------- headline ---------------- */
      ctx.font = '700 17px "IBM Plex Sans Condensed",sans-serif';
      ctx.fillStyle = th.text; ctx.textAlign = 'left'; ctx.textBaseline = 'top';
      const major = S.radical ? 'anti-Markovnikov'
        : (S.yield && S.yield.shift > S.yield.mark) ? 'the REARRANGED product' : 'Markovnikov';
      ctx.fillText(alk.name + ' + ' + hx.name + (S.radical ? ' / ROOR' : '') + '  →  ' + major, 14, 10);
      ctx.font = '500 10px "IBM Plex Mono",monospace'; ctx.fillStyle = th['text-3'];
      ctx.fillText('ΔEa = ' + (S.EaAnti - S.EaMark).toFixed(1) + ' kJ/mol   ·   k(Mark)/k(anti) = ' +
        (S.kMark / Math.max(S.kAnti, 1e-30)).toExponential(1) + '   ·   ' + p.T.toFixed(0) + ' K' +
        (S.peroxideIgnored ? '   ·   peroxide has no effect on ' + hx.name : ''), 14, 32);
      if (S.peroxideIgnored) {
        ctx.fillStyle = th.warn; ctx.font = '600 10px "IBM Plex Mono",monospace';
        ctx.fillText('the peroxide effect works for HBr only', 14, 48);
      }
    },

    plots: [
      { title: 'Species concentrations as the reaction runs',
        legend: [{ c: '#63729A', label: 'alkene' }, { c: '#FB7185', label: 'cation' },
                 { c: '#4ADE80', label: 'Markovnikov' }, { c: '#FFAE4C', label: 'rearranged' },
                 { c: '#5AA9FF', label: 'anti-Markovnikov' }],
        draw(S, g) {
          if (!S.hist.length) return;
          const th = g.theme;
          const t1 = Math.max(2.2, S.hist[S.hist.length - 1][0]);
          const P = g.Plot({
            xmin: 0, xmax: t1, ymin: 0, ymax: 1.05,
            xlabel: 'time (arbitrary)', ylabel: 'mole fraction',
            xfmt: v => v.toFixed(1), yfmt: v => v.toFixed(2)
          }).frame();
          P.clip(() => {
            const col = ['#63729A', '#FB7185', '#4ADE80', '#FFAE4C', '#5AA9FF'];
            for (let k = 1; k <= 5; k++)
              P.line(S.hist.map(r => [r[0], r[k]]), col[k - 1], k === 1 ? 1.8 : 2.2);
          });
        },
        hover(S, x) {
          if (!S.hist.length) return null;
          const r = S.hist.reduce((b, q) => Math.abs(q[0] - x) < Math.abs(b[0] - x) ? q : b, S.hist[0]);
          return [{ label: 'time', value: r[0].toFixed(2) },
                  { label: 'alkene', value: r[1].toFixed(3), color: '#63729A' },
                  { label: 'cation', value: r[2].toFixed(4), color: '#FB7185' },
                  { label: 'Markovnikov', value: r[3].toFixed(3), color: '#4ADE80' },
                  { label: 'rearranged', value: r[4].toFixed(3), color: '#FFAE4C' },
                  { label: 'anti-Mark.', value: r[5].toFixed(3), color: '#5AA9FF' }];
        } },

      { title: 'Selectivity against temperature — why cold runs are cleaner',
        legend: [{ c: '#FFAE4C', label: 'k(Mark)/k(anti)' }, { c: '#63729A', label: 'this run' }],
        draw(S, g) {
          const th = g.theme;
          const dEa = S.EaAnti - S.EaMark;
          const pts = [];
          for (let T = 200; T <= 450; T += 2) pts.push([T, Math.log10(Math.exp(dEa / (RG * T)))]);
          const ys = pts.map(q => q[1]);
          const P = g.Plot({
            xmin: 200, xmax: 450, ymin: 0, ymax: Math.max(...ys) * 1.1 + 0.5,
            xlabel: 'temperature (K)', ylabel: 'log₁₀ (k Markovnikov / k anti)',
            xfmt: v => v.toFixed(0), yfmt: v => v.toFixed(0)
          }).frame();
          P.clip(() => {
            P.area(pts, 0, g.alpha(th.chem, .09));
            P.line(pts, th.chem, 2.2);
            P.vline(S.p.T, g.alpha(th.text, .55), [3, 3]);
            P.dot(S.p.T, Math.log10(Math.exp(dEa / (RG * S.p.T))), 4.4, th.warn, th['ink-950']);
          });
        },
        hover(S, x) {
          const dEa = S.EaAnti - S.EaMark;
          const T = clamp(x, 200, 450);
          const ratio = Math.exp(dEa / (RG * T));
          return [{ label: 'T', value: T.toFixed(0) + ' K' },
                  { label: 'ΔEa', value: dEa.toFixed(1) + ' kJ/mol' },
                  { label: 'k ratio', value: ratio.toExponential(2) },
                  { label: 'Markovnikov', value: (100 * ratio / (1 + ratio)).toFixed(3) + ' %' }];
        } }
    ],

    readouts(S) {
      const y = S.yield || { mark: 0, shift: 0, anti: 0 };
      return [
        { label: 'Markovnikov product', value: y.mark.toFixed(1), unit: '%',
          flag: y.mark > 50 ? 'ok' : null },
        { label: 'Rearranged product', value: y.shift.toFixed(1), unit: '%',
          flag: y.shift > 50 ? 'warn' : null,
          hint: S.shift ? S.shift.kind + ' shift, gains ' + S.shift.gain.toFixed(0) + ' kJ/mol' : 'no shift available' },
        { label: 'anti-Markovnikov', value: y.anti.toFixed(1), unit: '%',
          flag: y.anti > 50 ? 'accent' : null, hint: S.radical ? 'radical chain' : 'from the wrong cation' },
        { label: 'Cation stabilisation', value: S.stabMark.toFixed(0), unit: 'kJ/mol',
          hint: S.hyperMark + ' hyperconjugating C–H' },
        { label: 'Ea Markovnikov', value: S.EaMark.toFixed(1), unit: 'kJ/mol' },
        { label: 'Ea anti-Markovnikov', value: S.EaAnti.toFixed(1), unit: 'kJ/mol',
          hint: 'ΔEa = ' + (S.EaAnti - S.EaMark).toFixed(1) + ' kJ/mol' }
      ];
    },

    equation(S) {
      return E.v('E') + E.sub('a') + E.op('=') + E.n(88, 'kJ/mol', 3) + E.op('− 0.75 ×') +
        E.v('ΔH') + E.sub('stab') + '&nbsp;&nbsp;&nbsp;' +
        E.frac(E.v('k') + E.sub('M'), E.v('k') + E.sub('A')) + E.op('= exp(') +
        E.frac(E.v('ΔE') + E.sub('a'), E.v('RT')) + E.op(') =') +
        E.n(S.kMark / Math.max(S.kAnti, 1e-30), '', 3) + '<br>' +
        E.v('E') + E.sub('a') + '(M) ' + E.op('=') + E.n(S.EaMark, 'kJ/mol', 4) + E.op('   ') +
        E.v('E') + E.sub('a') + '(A) ' + E.op('=') + E.n(S.EaAnti, 'kJ/mol', 4);
    },
    eqNote: 'The 0.75 is a Hammond transfer coefficient: because the transition state for a strongly endothermic ' +
      'protonation resembles the cation, most of the cation\'s stabilisation is already felt at the transition ' +
      'state. That is why a difference of a few tens of kJ/mol in cation stability becomes a rate ratio of many ' +
      'powers of ten.',

    walkthrough: [
      { title: '1 · Two cations, one race',
        body: 'Load propene and HBr. Protonating C-1 gives a <b>secondary</b> cation; protonating C-2 gives a ' +
          '<b>primary</b> one. The energy profile shows both barriers.',
        ask: 'How much lower is the Markovnikov barrier, and what rate ratio does that give?',
        reveal: 'About 28 kJ/mol, which at 298 K is a factor of roughly 10⁵. Markovnikov is not a preference — ' +
          'it is a landslide.' },
      { title: '2 · Hyperconjugation, counted',
        body: 'Leave the hyperconjugation display on. The α C–H bonds overlapping the empty p orbital are drawn ' +
          'explicitly, and the readout counts them.',
        ask: 'Why is a 3° cation more stable than a 2°?',
        reveal: 'More alkyl groups mean more α C–H bonds able to donate into the empty p orbital, plus more ' +
          '+I induction. Nine hyperconjugating bonds beat six.' },
      { title: '3 · Styrene: resonance beats substitution',
        body: 'Switch to styrene. The cation formed is only secondary by substitution, yet it is very stable.',
        ask: 'What is doing the work?',
        reveal: 'The benzylic position delocalises the charge into the ring. Resonance is worth far more than ' +
          'another alkyl group — which is why benzylic and allylic cations outrank tertiary ones.' },
      { title: '4 · The rearrangement that catches everyone out',
        body: 'Load 3-methyl-1-butene with HCl. Markovnikov protonation gives a 2° cation — but a hydrogen on ' +
          'the neighbouring carbon can slide across to give a 3° one.',
        ask: 'Which product dominates?',
        reveal: 'The rearranged one. The hydride shift has a very low barrier and the gain is large, so the ' +
          'cation rearranges long before the chloride catches it. The "expected" product is the minor one.' },
      { title: '5 · Turn the shift off and compare',
        body: 'Toggle the rearrangement off and watch the bars swap over.',
        ask: 'What does that tell you about how to answer these questions?',
        reveal: 'Always ask whether the first-formed cation can reach a better one by moving a hydrogen or a ' +
          'methyl group from the adjacent carbon. If it can, it will.' },
      { title: '6 · A methyl group can migrate too',
        body: 'Load 3,3-dimethyl-1-butene. There is no hydrogen to shift on the neighbouring carbon — it is ' +
          'quaternary — so a whole <b>methyl group</b> migrates instead.',
        ask: 'Why is a methyl shift less common than a hydride shift?',
        reveal: 'It is sterically harder, so it happens only when no hydride shift is available. That is exactly ' +
          'the situation here.' },
      { title: '7 · Peroxides change the mechanism, not the rule',
        body: 'Go back to propene + HBr and switch peroxide on. The product flips to anti-Markovnikov.',
        ask: 'Does Markovnikov\'s rule break?',
        reveal: 'No. The mechanism changes to a radical chain in which <b>Br• adds first</b>, and the more stable ' +
          'radical still forms. The regiochemistry inverts because the order of addition inverts. Note that it ' +
          'works for HBr only — try HCl or HI and nothing happens.' },
      { title: '8 · Cold runs are cleaner',
        body: 'Drop T to 253 K and read the second graph.',
        ask: 'Why does selectivity improve?',
        reveal: 'The ratio goes as exp(ΔEa/RT). Lowering T raises the exponent, so the same energy gap buys ' +
          'far more selectivity — the reason preparative additions are run cold.' }
    ],

    quiz: [
      { q: 'Markovnikov\'s rule is a consequence of:',
        options: ['the more stable carbocation forming through the lower barrier',
                  'sterics only', 'the electronegativity of the halogen',
                  'the acid strength of HX'], answer: 0,
        why: 'The proton adds so as to give the more stable cation, and by Hammond that intermediate is reached faster.' },
      { q: 'Order of carbocation stability:',
        options: ['methyl > 1° > 2° > 3°', '3° > 2° > 1° > methyl',
                  '1° > 3° > 2° > methyl', 'all are equal'], answer: 1,
        why: 'More alkyl groups give more hyperconjugation and more +I donation into the empty p orbital.' },
      { q: 'Addition of HCl to 3-methyl-1-butene gives mainly 2-chloro-2-methylbutane because:',
        options: ['chloride attacks the primary carbon',
                  'the 2° cation rearranges by a hydride shift to a 3° cation',
                  'the alkene isomerises first', 'HCl adds anti-Markovnikov'], answer: 1,
        why: 'The 1,2-hydride shift converts the secondary cation into a tertiary one before capture.' },
      { q: 'The peroxide (Kharasch) effect is observed with:',
        options: ['HCl only', 'HBr only', 'HI only', 'all hydrogen halides'], answer: 1,
        why: 'Only for HBr are both propagation steps of the radical chain exothermic enough to sustain it.' },
      { q: 'A benzylic carbocation is unusually stable because:',
        options: ['it is tertiary', 'the charge is delocalised into the aromatic ring',
                  'it has no α hydrogens', 'benzene is unreactive'], answer: 1,
        why: 'Resonance spreads the positive charge over the ortho and para carbons, which beats extra alkyl substitution.' },
      { q: 'A methyl shift occurs in preference to a hydride shift when:',
        options: ['the temperature is high', 'the adjacent carbon has no hydrogen to donate',
                  'the halide is iodide', 'peroxides are present'], answer: 1,
        why: 'Hydride shifts are easier, so a methyl migrates only when no α hydrogen is available — as in 3,3-dimethyl-1-butene.' }
    ],

    notes:
      '<b>What this lab computes.</b> Cation stabilisation from substitution and resonance, barriers from a ' +
      'Hammond relation, rate constants from Arrhenius, and the product distribution by integrating the competing ' +
      'kinetic scheme step by step. The rearrangement is a genuine competition between the shift and halide capture.' +
      '<div class="pyq"><em>Exam pattern</em>Rearrangement questions are the classic trap: the paper asks for the ' +
      '"major product" of an addition whose obvious answer is the unrearranged one. Always check whether a 1,2-shift ' +
      'reaches a better cation.</div>' +
      '<ul><li><b>Stability:</b> benzylic ≈ allylic > 3° > 2° > 1° > methyl. Resonance outranks substitution.</li>' +
      '<li><b>Hyperconjugation</b> needs α C–H bonds aligned with the empty p orbital — count them.</li>' +
      '<li><b>1,2-hydride shift</b> whenever it reaches a more stable cation; <b>1,2-methyl shift</b> when no ' +
      'α hydrogen is available.</li>' +
      '<li><b>Peroxide effect:</b> HBr only, radical chain, Br• adds first, product is anti-Markovnikov.</li>' +
      '<li>Reactions that avoid free cations avoid rearrangement entirely — hydroboration–oxidation ' +
      '(anti-Markovnikov, syn) and oxymercuration–demercuration (Markovnikov, no rearrangement).</li></ul>'
  });

})(window.InsightLab, window.ORGART);
