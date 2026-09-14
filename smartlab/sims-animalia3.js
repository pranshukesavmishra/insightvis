/* ============================================================
   ANIMAL KINGDOM — 5. Cnidaria: nematocyst & metagenesis
                    6. Echinoderm water vascular system
   ============================================================ */
(function (L, A, ART) {
  'use strict';
  const { clamp, TAU, fmt, E } = L;

  /* =========================================================================
     5 · CNIDARIA — the fastest cell in the animal kingdom, and two body forms
     Discharge kinematics are anchored to the measured values for
     Hydra stenotele nematocysts: ~18.6 m/s and ~5.4 million g.
     ========================================================================= */
  const CYCLE = [
    { u: 0.00, name: 'Polyp colony', note: 'Obelia colony — feeding hydranths and reproductive gonangia' },
    { u: 0.20, name: 'Medusa buds', note: 'The gonangium buds off tiny medusae asexually' },
    { u: 0.40, name: 'Free medusa', note: 'The medusa swims away — the sexual form' },
    { u: 0.58, name: 'Gametes', note: 'Medusae shed eggs and sperm into the water' },
    { u: 0.74, name: 'Zygote', note: 'External fertilisation' },
    { u: 0.86, name: 'Planula larva', note: 'A ciliated free-swimming larva' },
    { u: 0.95, name: 'Settles', note: 'The planula settles and grows into a new polyp colony' }
  ];

  L.register({
    id: 'ak-cnidaria', subject: 'biology',
    name: 'Cnidaria — Nematocyst Discharge and Metagenesis',
    chapter: 'Animal Kingdom',
    exams: ['NEET UG'],
    weight: 'Very high yield',
    is3D: false,
    stageHint: 'The discharge is shown 100 million times slower than life — it really takes under a microsecond',
    lede: 'Cnidarians are defined by a single cell type: the <b>cnidoblast</b>, holding a <b>nematocyst</b> that ' +
      'fires in under a microsecond at an acceleration of roughly <b>five million g</b> — the fastest movement ' +
      'known in any animal cell. The other half of the phylum\'s story is <b>metagenesis</b>: a sessile asexual ' +
      'polyp alternating with a free-swimming sexual medusa. Both are modelled here.',

    params: { mode: 'nematocyst', pressure: 150, calcium: true, temp: 20, fireRate: 0.55, cycle: 0 },

    presets: [
      { name: 'Normal discharge', params: { mode: 'nematocyst', pressure: 150, calcium: true, temp: 20 } },
      { name: 'Low osmotic pressure', params: { mode: 'nematocyst', pressure: 45, calcium: true } },
      { name: 'No Ca²⁺ — misfire', params: { mode: 'nematocyst', pressure: 150, calcium: false } },
      { name: 'Obelia life cycle', params: { mode: 'lifecycle', cycle: 0 } }
    ],

    controls: [
      { group: 'What to show', items: [
        { key: 'mode', type: 'select', label: 'Focus', restructure: true, options: [
          { value: 'nematocyst', label: 'Nematocyst' }, { value: 'lifecycle', label: 'Metagenesis' }] }
      ] },
      { group: 'Nematocyst', items: [
        { key: 'pressure', label: 'Capsule osmotic pressure', min: 10, max: 200, step: 1, unit: 'atm',
          fmt: v => v.toFixed(0), restructure: true },
        { key: 'calcium', type: 'toggle', label: 'Ca²⁺ present (needed to fire)' },
        { key: 'temp', label: 'Water temperature', min: 2, max: 32, step: 0.5, unit: '°C',
          fmt: v => v.toFixed(1), restructure: true },
        { key: 'fireRate', label: 'Replay speed', min: 0.1, max: 1.5, step: 0.05, unit: '×',
          fmt: v => v.toFixed(2) }
      ] },
      { group: 'Life cycle', items: [
        { key: 'cycle', label: 'Position in the cycle', min: 0, max: 1, step: 0.005, unit: '',
          fmt: v => (v * 100).toFixed(0) + '%' }
      ] }
    ],

    setup(S) {
      const p = S.p;
      // measured anchor: 18.6 m/s at 150 atm, peak acceleration ~5.4 million g
      S.vMax = 18.6 * Math.sqrt(p.pressure / 150) * (0.7 + 0.3 * clamp(p.temp / 20, 0.2, 1.6));
      S.tau = 350e-9;                                     // s — rise time
      S.aPeak = S.vMax / S.tau;                           // m/s²
      S.gPeak = S.aPeak / 9.81;
      // integrate v(t) = vMax (t/tau) e^(1 - t/tau) to get thread length
      const N = 400, tEnd = 6 * S.tau;
      let len = 0; S.kin = [];
      for (let i = 0; i <= N; i++) {
        const t = i / N * tEnd;
        const v = S.vMax * (t / S.tau) * Math.exp(1 - t / S.tau);
        if (i) len += v * (tEnd / N);
        S.kin.push([t * 1e9, len * 1e6, v]);              // ns, µm, m/s
      }
      S.threadLen = len * 1e6;                            // µm
      S.tDischarge = tEnd * 1e9;                          // ns
      S.energy = 0.5 * 1e-12 * S.vMax * S.vMax;           // J, for a ~1 ng thread
      S.fires = p.calcium;
      S.ph = 0;
    },

    step(S, dt) {
      S.t = (S.t || 0) + dt;
      S.ph = (S.ph + dt * S.p.fireRate) % 1;
      if (S.p.mode === 'lifecycle') S.p.cycle = (S.p.cycle + dt * 0.06) % 1;
      let idx = 0;
      CYCLE.forEach((c, i) => { if (S.p.cycle >= c.u) idx = i; });
      S.cycIdx = idx;
    },

    drawStage(S, g) {
      const ctx = g.ctx, th = g.theme, p = S.p, W = g.w, H = g.h;
      if (p.mode === 'lifecycle') return drawCycle(S, g);
      const Z = window.ZOOART;

      /* ---------------- left: Hydra, drawn as a longitudinal section ------- */
      const hx = W * 0.20, hTop = H * 0.30, hLen = H * 0.46;
      const hy = Z.hydra(ctx, hx, hTop, hLen, {
        width: Math.min(W * 0.062, hLen * 0.26), t: S.t, tentacles: 6
      });

      // name the parts a NEET paper asks for
      const nameIt = (x0, y0, x1, y1, text, col) => {
        Z.leader(ctx, x0, y0, x1, y1, col);
        Z.lbl(ctx, x1 + (x1 > x0 ? 5 : -5), y1, text, col || th['text-2'],
          x1 > x0 ? 'left' : 'right', 9);
      };
      const midY = (hy.colTop + hy.colBot) / 2;
      nameIt(hx, hTop + 2, hx + hy.w * 2.0, hTop - H * 0.09, 'mouth — the ONLY opening', '#9FD8FF');
      nameIt(hx, midY - H * 0.04, hx + hy.w * 2.3, midY - H * 0.11, 'gastrovascular cavity', '#E0A54C');
      nameIt(hx + hy.rAt(midY) - hy.wall * 0.2, midY,
             hx + hy.w * 2.3, midY - H * 0.045, 'epidermis · ectoderm', '#5A8FD8');
      nameIt(hx + hy.rAt(midY) - hy.wall * 0.75, midY + H * 0.06,
             hx + hy.w * 2.3, midY + H * 0.02, 'gastrodermis · endoderm', '#E0A54C');
      nameIt(hx + hy.rAt(midY) - hy.wall * 0.48, midY + H * 0.12,
             hx + hy.w * 2.3, midY + H * 0.085, 'mesoglea · NOT a germ layer', '#9FB6D8');
      if (hy.tips.length) {
        const tp = hy.tips[1];
        nameIt(tp[0], tp[1], hx + hy.w * 2.3, hTop - H * 0.16,
          'tentacle · cnidoblast battery', '#9FD8FF');
      }
      Z.lbl(ctx, hx, hTop + hLen + 16, 'HYDRA · longitudinal section', th['text-2'], 'center', 9.5);
      Z.lbl(ctx, hx, hTop + hLen + 29, 'diploblastic · radial symmetry · tissue grade',
        th['text-3'], 'center', 8.5);

      /* ---------------- prey drifting onto the tentacles ---------------- */
      const preyU = clamp(S.ph / 0.35, 0, 1);
      const tip = hy.tips[1] || [hx, hTop];
      const px = tip[0] + 120 - preyU * 104, py = tip[1] - 26;
      if (S.ph < 0.78) {
        const dim = S.fires && S.ph > 0.42;
        ctx.fillStyle = g.alpha('#E8B64C', dim ? .40 : .95);
        ctx.beginPath(); ctx.ellipse(px, py, 8, 5.4, 0.4, 0, TAU); ctx.fill();
        ctx.strokeStyle = g.alpha('#E8B64C', dim ? .3 : .85); ctx.lineWidth = 1;
        for (let i = 0; i < 3; i++) {
          ctx.beginPath(); ctx.moveTo(px + 5, py);
          ctx.lineTo(px + 13, py - 5 + i * 5); ctx.stroke();
        }
        Z.lbl(ctx, px, py - 12, 'prey', th['text-3'], 'center', 9, 'bottom');
      }

      /* ---------------- right: the cnidocyte at cellular magnification ---- */
      const cx = W * 0.71, cy = H * 0.50;
      const R = Math.min(W * 0.125, H * 0.255);

      // the magnification callout
      ctx.save();
      ctx.strokeStyle = g.alpha(th['text-3'], .45); ctx.lineWidth = 1;
      ctx.setLineDash([4, 4]);
      ctx.beginPath();
      ctx.moveTo(tip[0] + 6, tip[1] + 4); ctx.lineTo(cx - R * 1.25, cy - R * 0.55);
      ctx.moveTo(tip[0] + 6, tip[1] + 14); ctx.lineTo(cx - R * 1.25, cy + R * 0.95);
      ctx.stroke();
      ctx.restore();

      // the cnidoblast itself — a real cell holding the organelle
      RX.volume(ctx, c => c.ellipse(cx, cy + R * 0.12, R * 0.86, R * 1.10, 0, 0, TAU), {
        fill: '#2F6AA8', r: R * 1.10, cx: cx, cy: cy + R * 0.12, squash: 0.78,
        stipple: 1.1, grain: '#12294A', shadow: 0.8, gloss: 0.30,
        contour: 1.6, contourColour: 'rgba(12,26,48,.95)'
      });
      // organelles — a cell that fires a harpoon needs the machinery to build it
      RX.volume(ctx, c => {
        c.ellipse(cx - R * 0.52, cy - R * 0.34, R * 0.17, R * 0.10, -0.5, 0, TAU);
      }, { fill: '#E2866A', r: R * 0.17, cx: cx - R * 0.52, cy: cy - R * 0.34,
           gloss: 0.5, contour: 1 });
      ctx.strokeStyle = 'rgba(110,50,36,.85)'; ctx.lineWidth = 1;
      for (let q = -1; q <= 1; q++) {
        ctx.beginPath();
        ctx.moveTo(cx - R * 0.60, cy - R * 0.34 + q * R * 0.045);
        ctx.lineTo(cx - R * 0.44, cy - R * 0.34 + q * R * 0.045);
        ctx.stroke();
      }
      // Golgi stack, which assembles the capsule
      ctx.strokeStyle = 'rgba(140,200,255,.7)'; ctx.lineWidth = 1.6;
      for (let q = 0; q < 4; q++) {
        ctx.beginPath();
        ctx.arc(cx + R * 0.50, cy + R * 0.60, R * (0.12 + q * 0.055),
          Math.PI * 1.08, Math.PI * 1.82);
        ctx.stroke();
      }
      RX.ball(ctx, cx - R * 0.46, cy + R * 0.66, R * 0.19, '#7A4FD0',
        { gloss: 0.55, shadow: true });

      const fireU = S.fires ? clamp((S.ph - 0.35) / 0.24, 0, 1) : 0;
      const cap = Z.nematocyst(ctx, cx, cy - R * 0.12, R * 0.62, fireU, { wall: '#7FA8D8' });

      // labels, placed around the organelle
      const L = [
        [cx + cap.capsuleW * 0.52, cy - R * 1.06, cx + R * 1.02, cy - R * 1.22, 'cnidocil — the trigger', '#9FD8FF'],
        [cx - cap.capsuleW * 0.34, cy - R * 0.78, cx - R * 1.02, cy - R * 0.98, 'operculum (lid)', '#BFE3FF'],
        [cx - cap.capsuleW * 0.55, cy - R * 0.10, cx - R * 1.18, cy - R * 0.24,
         fireU > 0.02 ? 'thread everting, inside out' : 'coiled thread · ' + p.pressure + ' atm', '#E6F0FF'],
        [cx + cap.capsuleW * 0.62, cy + R * 0.18, cx + R * 1.02, cy + R * 0.20, 'capsule wall', '#7FA8D8'],
        [cx - R * 0.46, cy + R * 0.66, cx - R * 1.18, cy + R * 0.84, 'nucleus', '#9A8FD0'],
        [cx - R * 0.52, cy - R * 0.34, cx - R * 1.14, cy - R * 0.56, 'mitochondrion', '#E2866A'],
        [cx + R * 0.50, cy + R * 0.60, cx + R * 1.00, cy + R * 0.74, 'Golgi · builds it', '#8CC8FF'],
        [cx + R * 0.30, cy + R * 0.92, cx + R * 1.02, cy + R * 1.06, 'cnidoblast (cnidocyte)', '#C9D4EA']
      ];
      L.forEach(([x0, y0, x1, y1, t2, c2]) => {
        Z.leader(ctx, x0, y0, x1, y1, c2);
        Z.lbl(ctx, x1 + (x1 > x0 ? 5 : -5), y1, t2, c2, x1 > x0 ? 'left' : 'right', 9);
      });
      if (fireU > 0.02) {
        Z.lbl(ctx, cx, cy - R * 1.05 - R * 3.0 * fireU - 12,
          'stylets pierce first', th.warn, 'center', 9, 'bottom');
      }

      // the scale bar — this really is a few micrometres across
      g.scaleBar(cx - R * 0.9, cy + R * 1.55, R * 0.72, '≈ 10 µm', th['text-3']);

      /* ---------------- headline ---------------- */
      ctx.textAlign = 'left'; ctx.textBaseline = 'top';
      ctx.font = '700 19px "IBM Plex Sans Condensed",sans-serif'; ctx.fillStyle = th.text;
      ctx.fillText(S.fires ? S.vMax.toFixed(1) + ' m/s  ·  ' + fmt(S.gPeak, 3) + ' g'
        : 'MISFIRE — no discharge', 14, 10);
      ctx.font = '500 10px "IBM Plex Mono",monospace';
      ctx.fillStyle = S.fires ? th['text-3'] : th.crit;
      ctx.fillText(S.fires
        ? 'whole discharge in ' + S.tDischarge.toFixed(0) + ' ns  ·  thread ' + S.threadLen.toFixed(1) + ' µm'
        : 'Ca²⁺ is required for the capsule to discharge', 14, 32);
      const phase = S.ph < 0.30 ? 'Prey approaching — cnidocil untouched'
        : S.ph < 0.36 ? 'CNIDOCIL TOUCHED — trigger'
        : S.ph < 0.58 ? 'Operculum flips, thread everts at ' + S.vMax.toFixed(1) + ' m/s'
        : S.ph < 0.80 ? 'Barbs anchor, toxin injected' : 'Prey paralysed — tentacles carry it to the mouth';
      ctx.fillStyle = th.bio; ctx.fillText(phase, 14, 48);
    },

    plots: [
      { title: 'Discharge kinematics — the whole event in under a microsecond',
        legend: [{ c: '#5AA9FF', label: 'thread length (µm)' }, { c: '#FBBF24', label: 'velocity (m/s)' }],
        draw(S, g) {
          const P = g.Plot({
            xmin: 0, xmax: S.tDischarge, ymin: 0, ymax: Math.max(S.threadLen, S.vMax) * 1.12,
            xlabel: 'time after trigger (ns)', ylabel: 'µm  /  m s⁻¹',
            xfmt: v => v.toFixed(0), yfmt: v => v.toFixed(0)
          }).frame();
          P.clip(() => {
            P.area(S.kin.map(k => [k[0], k[1]]), 0, g.alpha('#5AA9FF', .13));
            P.line(S.kin.map(k => [k[0], k[1]]), '#5AA9FF', 2.4);
            P.line(S.kin.map(k => [k[0], k[2]]), '#FBBF24', 2);
            const now = clamp((S.ph - 0.35) / 0.22, 0, 1) * S.tDischarge;
            if (S.fires && S.ph > 0.35 && S.ph < 0.57) P.vline(now, g.alpha(g.theme.text, .6), [3, 3]);
          });
          P.tag(S.tau * 1e9, S.vMax, 'peak ' + S.vMax.toFixed(1) + ' m/s', '#FBBF24', 'left', -10);
          P.tag(S.tDischarge, S.threadLen, S.threadLen.toFixed(1) + ' µm', '#5AA9FF', 'right', -10);
        },
        hover(S, x) {
          const i = clamp(Math.round(x / S.tDischarge * (S.kin.length - 1)), 0, S.kin.length - 1);
          const k = S.kin[i];
          return [{ label: 'time', value: k[0].toFixed(0) + ' ns' },
                  { label: 'thread out', value: k[1].toFixed(2) + ' µm', color: '#5AA9FF' },
                  { label: 'velocity', value: k[2].toFixed(1) + ' m/s', color: '#FBBF24' }];
        } },
      { title: 'How the discharge scales with capsule pressure',
        legend: [{ c: '#5AA9FF', label: 'peak velocity' }, { c: '#FB7185', label: 'peak acceleration (millions of g)' }],
        draw(S, g) {
          const vs = [], as = [];
          for (let i = 0; i <= 60; i++) {
            const pr = 10 + i / 60 * 190;
            const v = 18.6 * Math.sqrt(pr / 150) * (0.7 + 0.3 * clamp(S.p.temp / 20, 0.2, 1.6));
            vs.push([pr, v]); as.push([pr, v / 350e-9 / 9.81 / 1e6]);
          }
          const P = g.Plot({
            xmin: 10, xmax: 200, ymin: 0, ymax: Math.max(25, S.vMax * 1.2),
            xlabel: 'capsule osmotic pressure (atm)', ylabel: 'm s⁻¹  /  10⁶ g',
            xfmt: v => v.toFixed(0), yfmt: v => v.toFixed(0)
          }).frame();
          P.clip(() => {
            P.line(vs, '#5AA9FF', 2.4);
            P.line(as, '#FB7185', 2, [5, 3]);
            P.vline(S.p.pressure, g.alpha(g.theme.text, .55), [3, 3]);
            P.dot(S.p.pressure, S.vMax, 4.5, '#5AA9FF', g.theme['ink-950']);
            P.dot(S.p.pressure, S.gPeak / 1e6, 4.5, '#FB7185', g.theme['ink-950']);
          });
          P.tag(150, 18.6, 'measured: 18.6 m/s at 150 atm', g.theme['text-2'], 'right', -10);
        },
        hover(S, x) {
          const pr = clamp(x, 10, 200);
          const v = 18.6 * Math.sqrt(pr / 150) * (0.7 + 0.3 * clamp(S.p.temp / 20, 0.2, 1.6));
          return [{ label: 'pressure', value: pr.toFixed(0) + ' atm' },
                  { label: 'peak velocity', value: v.toFixed(1) + ' m/s', color: '#5AA9FF' },
                  { label: 'peak acceleration', value: fmt(v / 350e-9 / 9.81, 3) + ' g', color: '#FB7185' }];
        } }
    ],

    readouts(S) {
      const p = S.p;
      if (p.mode === 'lifecycle') {
        const c = CYCLE[S.cycIdx || 0];
        return [
          { label: 'Stage', value: c.name, unit: '', flag: 'accent', hint: c.note },
          { label: 'Body form', value: S.cycIdx <= 1 || S.cycIdx >= 6 ? 'Polyp' : S.cycIdx <= 3 ? 'Medusa' : 'Larva', unit: '' },
          { label: 'Reproduction', value: S.cycIdx <= 1 ? 'Asexual (budding)' : S.cycIdx <= 4 ? 'Sexual' : 'Development', unit: '' },
          { label: 'Polyp', value: 'Sessile, cylindrical', unit: '', hint: 'Hydra, Adamsia, corals' },
          { label: 'Medusa', value: 'Free-swimming, umbrella', unit: '', hint: 'Aurelia, the jellyfish' },
          { label: 'The alternation', value: 'Metagenesis', unit: '', flag: 'accent',
            hint: 'polyp produces medusae asexually; medusae produce polyps sexually' },
          { label: 'Classic example', value: 'Obelia', unit: '', hint: 'shows both forms in one life cycle' }
        ];
      }
      return [
        { label: 'Peak velocity', value: S.vMax.toFixed(1), unit: 'm/s', flag: 'accent' },
        { label: 'Peak acceleration', value: fmt(S.gPeak, 3), unit: 'g', flag: 'crit',
          hint: 'the fastest cellular process known' },
        { label: 'Discharge time', value: S.tDischarge.toFixed(0), unit: 'ns' },
        { label: 'Thread everted', value: S.threadLen.toFixed(1), unit: 'µm' },
        { label: 'Capsule pressure', value: p.pressure.toFixed(0), unit: 'atm',
          hint: '≈ ' + (p.pressure * 0.101).toFixed(1) + ' MPa' },
        { label: 'Discharge possible', value: S.fires ? 'Yes' : 'No', unit: '',
          flag: S.fires ? 'ok' : 'crit', hint: S.fires ? 'Ca²⁺ present' : 'Ca²⁺ absent' },
        { label: 'Cell type', value: 'Cnidoblast', unit: '', hint: 'also called a cnidocyte' },
        { label: 'Functions', value: 'Anchorage, defence, prey capture', unit: '' },
        { label: 'Single use', value: 'Yes — discarded after firing', unit: '',
          hint: 'a new cnidoblast must be made' }
      ];
    },

    equation(S) {
      const p = S.p;
      if (p.mode === 'lifecycle') {
        return 'polyp ' + E.op('→') + '<sub>asexual budding</sub> medusa ' + E.op('→') +
          '<sub>gametes</sub> zygote ' + E.op('→') + ' planula ' + E.op('→') + ' polyp' +
          '<br>this alternation of an asexual polyp with a sexual medusa ' + E.op('=') + ' ' +
          E.n('METAGENESIS', '') + E.op('·') + ' classic example ' + E.op('=') + ' ' + E.n('Obelia', '');
      }
      return E.v('v') + '(' + E.v('t') + ') ' + E.op('=') + ' ' + E.v('v') + '<sub>max</sub>' +
        E.frac(E.v('t'), E.v('τ')) + E.v('e') + '<sup>1−t/τ</sup>' + E.op(',') + ' ' +
        E.v('τ') + ' ' + E.op('=') + ' ' + E.n('350', 'ns') +
        '<br>' + E.v('a') + '<sub>peak</sub> ' + E.op('=') + ' ' + E.frac(E.v('v') + '<sub>max</sub>', E.v('τ')) +
        ' ' + E.op('=') + ' ' + E.frac(E.n(S.vMax.toFixed(1), 'm/s'), E.n('350', 'ns')) + ' ' + E.op('=') +
        ' ' + E.n(fmt(S.aPeak, 3), 'm/s²') + ' ' + E.op('=') + ' ' + E.n(fmt(S.gPeak, 3), 'g') +
        '<br>' + E.v('v') + '<sub>max</sub> ' + E.op('∝') + ' √' + E.v('P') + E.op(':') +
        ' at ' + E.n(p.pressure, 'atm') + ' ' + E.op('→') + ' ' + E.n(S.vMax.toFixed(1), 'm/s');
    },
    eqNote: '<b>Put five million g in perspective.</b> A fighter pilot blacks out near 9 g. A bullet leaving a ' +
      'rifle experiences roughly 30,000 g. The nematocyst thread experiences over a hundred times that — which ' +
      'is only possible because the moving mass is a few picograms and the whole event is over in under a microsecond.',

    walkthrough: [
      { title: '1 · One cell defines the whole phylum',
        body: 'Watch the tentacle beads. Each is a cnidoblast holding a loaded capsule.',
        ask: 'What three jobs do nematocysts do?',
        reveal: '<b>Anchorage, defence and capturing prey.</b> NCERT lists exactly those three. The presence of cnidoblasts is the defining character of the phylum — which is why the alternative name Cnidaria is built on the word for them.',
        params: { mode: 'nematocyst', pressure: 150, calcium: true } },
      { title: '2 · The trigger',
        body: 'Follow the prey in. The moment it brushes the cnidocil, the operculum flips.',
        ask: 'Is the discharge a nervous reflex?',
        reveal: '<b>No.</b> It is an independent effector — the cnidoblast fires on its own mechanical and chemical stimulation, without needing the nerve net. The nerve net coordinates the tentacles afterwards, not the discharge itself.',
        params: { mode: 'nematocyst', pressure: 150, calcium: true } },
      { title: '3 · Why it is so violent',
        body: 'Read the peak velocity and acceleration, then drop the capsule pressure and watch both fall.',
        ask: 'Where does the energy come from — muscle?',
        reveal: 'There is no muscle. The capsule is held at very high <b>osmotic pressure</b>; when the operculum opens, water rushes in and the thread turns inside out explosively. It is a pre-loaded osmotic spring, and it is single-use — the cell is discarded after firing.',
        params: { mode: 'nematocyst', pressure: 45, calcium: true } },
      { title: '4 · Calcium is required',
        body: 'Switch calcium off.',
        ask: 'What happens, and why does it matter experimentally?',
        reveal: 'The capsule will not discharge. Calcium is needed for the priming and discharge step, which is how researchers can handle live cnidarians in calcium-free sea water without being stung.',
        params: { mode: 'nematocyst', pressure: 150, calcium: false } },
      { title: '5 · Two body forms, one animal',
        body: 'Switch to metagenesis and let the cycle run.',
        ask: 'Which form reproduces sexually, and which asexually?',
        reveal: 'The <b>sessile polyp reproduces asexually by budding</b> and produces medusae. The <b>free-swimming medusa reproduces sexually</b> and produces polyps. That alternation is called <b>metagenesis</b>, and <b>Obelia</b> is the standard example. Hydra has only the polyp form; Aurelia is dominantly medusoid.',
        params: { mode: 'lifecycle', cycle: 0 } }
    ],

    quiz: [
      { q: 'Cnidoblasts are used for:',
        options: ['locomotion only', 'anchorage, defence and capture of prey',
                  'respiration', 'excretion'], answer: 1,
        why: 'NCERT lists exactly these three functions for the cnidoblasts that give the phylum its alternative name.' },
      { q: 'The alternation of a sessile asexual polyp with a free-swimming sexual medusa is called:',
        options: ['metamorphosis', 'metagenesis', 'parthenogenesis', 'metamerism'], answer: 1,
        why: 'Metagenesis is alternation of generations in cnidarians; Obelia is the classic example.' },
      { q: 'Which cnidarian exists only as a polyp?',
        options: ['Aurelia', 'Obelia', 'Hydra', 'Physalia'], answer: 2,
        why: 'Hydra has no medusa stage at all. Aurelia is dominantly medusoid and Obelia shows both forms.' },
      { q: 'The cavity of a cnidarian, with a single opening, is the:',
        options: ['coelom', 'pseudocoelom', 'gastrovascular cavity', 'spongocoel'], answer: 2,
        why: 'The coelenteron or gastrovascular cavity opens by the hypostome, which serves as both mouth and anus.' }
    ],

    notes: '<b>Where this shows up in the paper.</b>' +
      '<ul><li>Cnidoblast functions and the meaning of the name Cnidaria — a reliable one-marker.</li>' +
      '<li>Metagenesis, with Obelia as the example and Hydra/Aurelia as the contrasts.</li>' +
      '<li>Diploblastic organisation, tissue level, and the gastrovascular cavity with a single opening.</li>' +
      '<li>Coral reefs: Meandrina and the skeleton of calcium carbonate.</li></ul>' +
      '<div class="pyq"><em>Trap to avoid</em>Corals are <b>polyps</b>, not medusae, and the "coral" you see is ' +
      'the calcium carbonate skeleton they secrete — not the animal. Physalia is not a single jellyfish either; ' +
      'it is a <b>colony</b> of polymorphic individuals.</div>'
  });

  function drawCycle(S, g) {
    const ctx = g.ctx, th = g.theme, W = g.w, H = g.h;
    const cx = W * 0.42, cy = H * 0.52, R = Math.min(W * 0.22, H * 0.36);
    const hue = '#5AA9FF';
    // cycle ring
    ctx.strokeStyle = g.alpha(th['line-soft'], 1); ctx.lineWidth = 3;
    ctx.beginPath(); ctx.arc(cx, cy, R, 0, TAU); ctx.stroke();
    ctx.strokeStyle = g.alpha(hue, .9);
    ctx.beginPath(); ctx.arc(cx, cy, R, -Math.PI / 2, -Math.PI / 2 + S.p.cycle * TAU); ctx.stroke();

    CYCLE.forEach((c, i) => {
      const a = -Math.PI / 2 + c.u * TAU;
      const x = cx + Math.cos(a) * R, y = cy + Math.sin(a) * R;
      const on = i === S.cycIdx;
      ctx.fillStyle = on ? hue : g.alpha(th['text-3'], .7);
      ctx.beginPath(); ctx.arc(x, y, on ? 7 : 4, 0, TAU); ctx.fill();
      ctx.font = (on ? '600 ' : '400 ') + '9.5px "IBM Plex Mono",monospace';
      ctx.fillStyle = on ? th.text : th['text-3'];
      const out = 20;
      ctx.textAlign = Math.cos(a) > 0.2 ? 'left' : Math.cos(a) < -0.2 ? 'right' : 'center';
      ctx.textBaseline = Math.sin(a) > 0.3 ? 'top' : Math.sin(a) < -0.3 ? 'bottom' : 'middle';
      ctx.fillText(c.name, x + Math.cos(a) * out, y + Math.sin(a) * out);
    });

    // centre: the current form
    const idx = S.cycIdx;
    const form = idx <= 1 || idx >= 6 ? 'polyp' : idx <= 3 ? 'medusa' : 'larva';
    if (form === 'medusa') ART.draw(ctx, 'medusa', cx, cy, R * 0.42, hue, S.t || 0, 1);
    else if (form === 'polyp') {
      ctx.fillStyle = g.mix(hue, '#05080F', .3);
      ctx.beginPath();
      ctx.moveTo(cx - R * .1, cy + R * .34);
      ctx.lineTo(cx - R * .12, cy - R * .16); ctx.lineTo(cx + R * .12, cy - R * .16);
      ctx.lineTo(cx + R * .1, cy + R * .34); ctx.closePath(); ctx.fill();
      ctx.strokeStyle = g.alpha(hue, .9); ctx.lineWidth = 2.4;
      for (let i = 0; i < 5; i++) {
        const a = -Math.PI / 2 + (i - 2) * 0.42;
        ctx.beginPath(); ctx.moveTo(cx, cy - R * .16);
        ctx.lineTo(cx + Math.cos(a) * R * .3, cy - R * .16 + Math.sin(a) * R * .3);
        ctx.stroke();
      }
    } else {
      ctx.fillStyle = g.mix(hue, '#ffffff', .3);
      ctx.beginPath(); ctx.ellipse(cx, cy, R * .2, R * .12, 0, 0, TAU); ctx.fill();
      ctx.strokeStyle = g.alpha(hue, .7); ctx.lineWidth = 1;
      for (let i = 0; i < 18; i++) {
        const a = i / 18 * TAU;
        ctx.beginPath();
        ctx.moveTo(cx + Math.cos(a) * R * .2, cy + Math.sin(a) * R * .12);
        ctx.lineTo(cx + Math.cos(a) * R * .27, cy + Math.sin(a) * R * .17);
        ctx.stroke();
      }
    }

    ctx.textAlign = 'left'; ctx.textBaseline = 'top';
    ctx.font = '700 19px "IBM Plex Sans Condensed",sans-serif'; ctx.fillStyle = th.text;
    ctx.fillText('Metagenesis in Obelia', 14, 10);
    ctx.font = '500 10px "IBM Plex Mono",monospace'; ctx.fillStyle = th['text-3'];
    ctx.fillText(CYCLE[idx].note, 14, 32);

    // polyp vs medusa comparison
    const bx = W * 0.74, by = H * 0.24;
    [['', 'POLYP', 'MEDUSA'],
     ['Habit', 'Sessile', 'Free-swimming'],
     ['Shape', 'Cylindrical', 'Umbrella-like'],
     ['Reproduction', 'Asexual, by budding', 'Sexual, by gametes'],
     ['Example', 'Hydra, Adamsia', 'Aurelia']].forEach((row, i) => {
      ctx.font = (i === 0 ? '600 ' : '400 ') + '9.5px "IBM Plex Mono",monospace';
      ctx.textAlign = 'left'; ctx.textBaseline = 'top';
      ctx.fillStyle = i === 0 ? th['text-2'] : th['text-3'];
      ctx.fillText(row[0], bx, by + i * 22);
      ctx.fillStyle = i === 0 ? hue : (form === 'polyp' ? th.text : th['text-2']);
      ctx.fillText(row[1], bx + 76, by + i * 22);
      ctx.fillStyle = i === 0 ? hue : (form === 'medusa' ? th.text : th['text-2']);
      ctx.fillText(row[2], bx + 168, by + i * 22);
    });
  }

  /* =========================================================================
     6 · ECHINODERM WATER VASCULAR SYSTEM — hydraulic locomotion
     ========================================================================= */
  L.register({
    id: 'ak-wvs', subject: 'biology',
    name: 'Water Vascular System — How a Starfish Walks',
    chapter: 'Animal Kingdom',
    exams: ['NEET UG'],
    weight: 'High yield',
    is3D: false,
    stageHint: 'Tube feet move in a metachronal wave — no muscle pulls the animal along, water does',
    lede: 'An echinoderm has no legs and no muscles pulling on a skeleton. It walks on <b>hundreds of water-filled ' +
      'tube feet</b>, each extended by squeezing a tiny muscular bulb called an ampulla. ' +
      'This lab runs the hydraulics for real: squeeze an ampulla and the tube foot lengthens by exactly the ' +
      'volume displaced, divided by its cross-section.',

    params: { contract: 0.55, feetPerArm: 28, freq: 0.5, lag: 0.18, rFoot: 0.25, substrate: 'rough', showCanals: true },

    presets: [
      { name: 'Asterias walking', params: { contract: 0.55, feetPerArm: 28, freq: 0.5, lag: 0.18, substrate: 'rough' } },
      { name: 'Full extension', params: { contract: 0.95, feetPerArm: 28, freq: 0.35 } },
      { name: 'Prising open a bivalve', params: { contract: 0.85, feetPerArm: 46, freq: 0.12, substrate: 'smooth' } },
      { name: 'Poorly coordinated', params: { contract: 0.55, feetPerArm: 28, freq: 0.5, lag: 0.0 } }
    ],

    controls: [
      { group: 'Ampulla', items: [
        { key: 'contract', label: 'Ampulla contraction', min: 0.05, max: 1, step: 0.01, unit: '',
          fmt: v => (v * 100).toFixed(0) + '%', restructure: true },
        { key: 'rFoot', label: 'Tube foot radius', min: 0.10, max: 0.60, step: 0.01, unit: 'mm',
          fmt: v => v.toFixed(2), restructure: true }
      ] },
      { group: 'Coordination', items: [
        { key: 'feetPerArm', label: 'Tube feet per arm', min: 6, max: 60, step: 1, unit: '',
          fmt: v => v.toFixed(0), restructure: true },
        { key: 'freq', label: 'Step frequency', min: 0.05, max: 1.2, step: 0.01, unit: 'Hz',
          fmt: v => v.toFixed(2), restructure: true },
        { key: 'lag', label: 'Phase lag along the arm', min: 0, max: 0.5, step: 0.01, unit: '',
          fmt: v => v.toFixed(2) }
      ] },
      { group: 'Environment', items: [
        { key: 'substrate', type: 'select', label: 'Substrate', restructure: true, options: [
          { value: 'rough', label: 'Rough rock' }, { value: 'smooth', label: 'Smooth shell' }] },
        { key: 'showCanals', type: 'toggle', label: 'Show the canal system' }
      ] }
    ],

    setup(S) {
      const p = S.p;
      S.rF = p.rFoot * 1e-3;                       // m
      S.Afoot = Math.PI * S.rF * S.rF;             // m²
      S.Vamp = 2.0e-9;                             // m³ — 2 mm³ ampulla
      S.dV = p.contract * S.Vamp;
      S.ext = S.dV / S.Afoot;                      // m
      S.press = 12e3 * p.contract;                 // Pa, muscular ampulla pressure
      S.Ffoot = S.press * S.Afoot;                 // N from hydraulic pressure
      S.adhesion = p.substrate === 'rough' ? 0.085 : 0.030;   // N, limit per foot
      S.Feff = Math.min(S.Ffoot, S.adhesion);
      S.nFeet = p.feetPerArm * 5;
      S.stanceFrac = 0.5;
      S.nStance = Math.round(S.nFeet * S.stanceFrac);
      S.Ftotal = S.nStance * S.Feff;
      S.speed = S.ext * p.freq * S.stanceFrac;     // m/s
      S.wvsVol = S.nFeet * (S.Vamp + S.Afoot * S.ext) * 1e9;  // mm³
    },

    step(S, dt) { S.t = (S.t || 0) + dt; },

    drawStage(S, g) {
      const ctx = g.ctx, th = g.theme, p = S.p, W = g.w, H = g.h;
      const Z = window.ZOOART, RXo = window.RX;
      const SKIN = '#E0913A', CANAL = '#8FD2FF', WATER = '#3E86C4';

      /* ---------------- plate frame ---------------- */
      const HDR = 56, FOOT = 28;
      const y0 = HDR, y1 = H - FOOT, CH = y1 - y0;
      const cx = W * 0.30, cy = y0 + CH * 0.50;
      const R = Math.min(W * 0.215, CH * 0.46);

      /* ---------------- the animal, from the aboral surface ----------------
         A real asteroid outline: a central disc with five tapering arms, an
         ossicle-plated skin carrying spines and papulae, not a flower. */
      const ARM0 = -Math.PI / 2;                 // the axis of arm 0
      const armR = a => R * (0.30 + 0.70 *
        Math.pow(Math.abs(Math.cos(2.5 * (a - ARM0))), 2.1));
      const bodyPath = c => {
        c.beginPath();
        for (let i = 0; i <= 260; i++) {
          const a = i / 260 * TAU - Math.PI / 2;
          const r = armR(a);
          const x = cx + Math.cos(a) * r, y = cy + Math.sin(a) * r;
          i ? c.lineTo(x, y) : c.moveTo(x, y);
        }
        c.closePath();
      };
      RXo.volume(ctx, bodyPath, {
        fill: SKIN, r: R * 0.72, cx: cx, cy: cy,
        stipple: 1.4, grain: '#6E3E14', shadow: 0.9, gloss: 0.22,
        contour: Math.max(1.2, R * 0.014)
      });
      ctx.save(); bodyPath(ctx); ctx.clip();
      // the raised ambulacral ridge running out along each arm
      for (let k = 0; k < 5; k++) {
        const a = -Math.PI / 2 + k / 5 * TAU;
        const ridge = [];
        for (let q = 0; q <= 12; q++) {
          const rr = R * (0.17 + q / 12 * 0.75);
          ridge.push([cx + Math.cos(a) * rr, cy + Math.sin(a) * rr]);
        }
        RXo.tube(ctx, ridge, u => R * (0.085 - 0.055 * u),
                 RXo.mix(SKIN, '#FFD9A0', 0.30), { vivid: false });
      }
      // calcareous ossicles and the spines they carry
      for (let k = 0; k < 5; k++) {
        const a = -Math.PI / 2 + k / 5 * TAU;
        const nx = -Math.sin(a), ny = Math.cos(a);
        for (let q = 1; q <= 11; q++) {
          const rr = R * (0.14 + q / 11 * 0.76);
          const spread = R * 0.20 * (1 - q / 13);
          for (let sgi = -2; sgi <= 2; sgi++) {
            if (Math.abs(sgi) === 1 && q % 2) continue;
            const px = cx + Math.cos(a) * rr + nx * sgi * spread * 0.55;
            const py = cy + Math.sin(a) * rr + ny * sgi * spread * 0.55;
            const rad = R * 0.028 * (1 - q / 16);
            if (rad < 1) continue;
            RXo.ball(ctx, px, py, rad,
                     RXo.mix(SKIN, '#FFE7C4', Math.abs(sgi) === 2 ? 0.42 : 0.18), { rim: 0 });
          }
        }
      }
      // papulae — the thin-walled skin gills that do the gas exchange
      for (let i = 0; i < 70; i++) {
        const a = RXo.hash2(i * 3.1, 5) * TAU;
        const rr = Math.sqrt(RXo.hash2(i * 7.7, 11)) * R * 0.92;
        const px = cx + Math.cos(a) * rr, py = cy + Math.sin(a) * rr;
        ctx.fillStyle = RXo.rgba('#C86A3A', 0.20 + RXo.hash2(i * 5.3, 3) * 0.25);
        ctx.beginPath(); ctx.arc(px, py, R * 0.012, 0, TAU); ctx.fill();
      }
      ctx.restore();

      /* ---------------- tube feet in a metachronal wave ---------------- */
      const nPer = Math.min(p.feetPerArm, 30);
      for (let k = 0; k < 5; k++) {
        const a = -Math.PI / 2 + k / 5 * TAU;
        const nx = -Math.sin(a), ny = Math.cos(a);
        for (let j = 1; j <= nPer; j++) {
          const f = j / (nPer + 1);
          const rr = R * (0.18 + f * 0.66);
          const phase = (S.t * p.freq - f * p.lag * 4) % 1;
          const stance = phase < S.stanceFrac;
          const e = stance ? 1 : 0.25 + 0.5 * Math.abs(Math.sin(phase * Math.PI));
          const len = R * 0.10 * e * (0.4 + p.contract * 0.6);
          [-1, 1].forEach(sg => {
            const bx = cx + Math.cos(a) * rr + nx * sg * R * 0.035;
            const by = cy + Math.sin(a) * rr + ny * sg * R * 0.035;
            const ex = bx + nx * sg * len, ey = by + ny * sg * len;
            const rad = Math.max(0.9, R * 0.011);
              ctx.save();
            ctx.globalAlpha = stance ? 0.95 : 0.45;
            RXo.tube(ctx, [[bx, by], [ex, ey]], rad,
                     stance ? CANAL : '#6E7E9E', { vivid: stance });
            ctx.restore();
            if (stance) RXo.ball(ctx, ex, ey, rad * 1.6, '#E6F4FF', { rim: 0 });
          });
        }
      }
      /* ---------------- the water vascular system ---------------- */
      const ma = -Math.PI / 2 + 0.63;
      if (p.showCanals) {
        // ring canal round the mouth
        const ringPts = [];
        for (let i = 0; i <= 48; i++) {
          const a = i / 48 * TAU;
          ringPts.push([cx + Math.cos(a) * R * 0.16, cy + Math.sin(a) * R * 0.16]);
        }
        RXo.tube(ctx, ringPts, R * 0.026, CANAL, { contour: 1 });
        // five radial canals
        for (let k = 0; k < 5; k++) {
          const a = -Math.PI / 2 + k / 5 * TAU;
          const rad = [];
          for (let q = 0; q <= 10; q++) {
            const rr = R * (0.16 + q / 10 * 0.70);
            rad.push([cx + Math.cos(a) * rr, cy + Math.sin(a) * rr]);
          }
          RXo.tube(ctx, rad, u => R * (0.026 - 0.012 * u), CANAL, { contour: 1 });
        }
        // Tiedemann's bodies on the ring canal — NCERT names them
        for (let k = 0; k < 5; k++) {
          const a = -Math.PI / 2 + (k + 0.5) / 5 * TAU;
          RXo.ball(ctx, cx + Math.cos(a) * R * 0.16, cy + Math.sin(a) * R * 0.16,
                   R * 0.030, '#BEE6FF', { rim: 0.4 });
        }
        // madreporite and the stone canal that hangs from it
        RXo.tube(ctx, [[cx + Math.cos(ma) * R * 0.40, cy + Math.sin(ma) * R * 0.40],
                       [cx + Math.cos(ma) * R * 0.16, cy + Math.sin(ma) * R * 0.16]],
                 R * 0.024, '#D8EEFF', { contour: 1 });
        const mx = cx + Math.cos(ma) * R * 0.42, my = cy + Math.sin(ma) * R * 0.42;
        RXo.ball(ctx, mx, my, R * 0.055, '#E6F4FF', { rim: 0.6 });
        ctx.save();
        ctx.beginPath(); ctx.arc(mx, my, R * 0.055, 0, TAU); ctx.clip();
        ctx.strokeStyle = RXo.rgba('#5E86A8', .8); ctx.lineWidth = Math.max(0.7, R * 0.007);
        for (let i = -4; i <= 4; i++) {              // the sieve grooves
          ctx.beginPath();
          ctx.moveTo(mx - R * 0.06, my + i * R * 0.013);
          ctx.lineTo(mx + R * 0.06, my + i * R * 0.013 + R * 0.012);
          ctx.stroke();
        }
        ctx.restore();
        Z.leader(ctx, mx, my, cx - R * 1.02, cy - R * 0.74, '#BEE6FF');
        Z.lbl(ctx, cx - R * 1.04, cy - R * 0.76, 'madreporite', '#BEE6FF', 'right', 9.5);
        Z.leader(ctx, cx + R * 0.16, cy, cx - R * 1.02, cy - R * 0.48, '#BEE6FF');
        Z.lbl(ctx, cx - R * 1.04, cy - R * 0.50, 'ring canal', '#BEE6FF', 'right', 9.5);
        Z.leader(ctx, cx + Math.cos(-Math.PI / 2 + 0.4 * TAU) * R * 0.60,
                      cy + Math.sin(-Math.PI / 2 + 0.4 * TAU) * R * 0.60,
                      cx - R * 1.02, cy - R * 0.22, '#BEE6FF');
        Z.lbl(ctx, cx - R * 1.04, cy - R * 0.24, 'radial canal', '#BEE6FF', 'right', 9.5);
      }

      g.scaleBar(cx - R, y1 - 2, R * 0.6, '≈ 3 cm', th['text-3']);
      Z.lbl(ctx, cx, y0 + 4, 'ABORAL SURFACE  ·  Asterias', th['text-3'], 'center', 9.5, 'top');

      /* ---------------- one foot, magnified ---------------- */
      const ax = W * 0.735, AR = Math.min(W * 0.135, CH * 0.34);
      const ay = y0 + CH * 0.40;
      ctx.strokeStyle = g.alpha(th['text-3'], .45); ctx.lineWidth = 1;
      ctx.save(); ctx.setLineDash([3, 3]);
      ctx.beginPath();
      ctx.moveTo(cx + R * 0.62, cy - R * 0.34); ctx.lineTo(ax - AR * 1.05, ay - AR * 0.80);
      ctx.stroke(); ctx.restore();
      Z.lbl(ctx, ax, y0 + 4, '×12  ONE TUBE FOOT', th['text-3'], 'center', 9.5, 'top');

      const squeeze = p.contract;
      // lateral canal and its one-way valve
      RXo.tube(ctx, [[ax - AR * 1.00, ay - AR * 0.55], [ax - AR * 0.22, ay - AR * 0.55]],
               AR * 0.055, CANAL, { contour: 1 });
      ctx.fillStyle = th.crit;
      ctx.beginPath();
      ctx.moveTo(ax - AR * 0.26, ay - AR * 0.72); ctx.lineTo(ax - AR * 0.26, ay - AR * 0.38);
      ctx.lineTo(ax - AR * 0.10, ay - AR * 0.55); ctx.closePath(); ctx.fill();
      Z.leader(ctx, ax - AR * 0.70, ay - AR * 0.55, ax - AR * 0.80, ay - AR * 0.95, CANAL);
      Z.lbl(ctx, ax - AR * 0.82, ay - AR * 1.02, 'lateral canal', CANAL, 'right', 9.5);
      Z.leader(ctx, ax - AR * 0.18, ay - AR * 0.55, ax + AR * 0.02, ay - AR * 0.95, th.crit);
      Z.lbl(ctx, ax + AR * 0.04, ay - AR * 1.02, 'valve (one-way)', th.crit, 'left', 9.5);

      // ampulla — a muscular bulb that flattens as it contracts
      const aw = AR * (0.36 - 0.15 * squeeze), ah = AR * (0.28 - 0.11 * squeeze);
      const ampY = ay - AR * 0.26;
      const amp = c => { c.beginPath(); c.ellipse(ax, ampY, aw, ah, 0, 0, TAU); };
      RXo.volume(ctx, amp, { fill: WATER, r: aw, cx: ax, cy: ampY,
                             shadow: 0.7, gloss: 0.34, contour: Math.max(1.2, AR * 0.022) });
      ctx.save(); amp(ctx); ctx.clip();
      // circular muscle fibres in the ampulla wall — what does the squeezing
      ctx.strokeStyle = RXo.rgba('#BEE6FF', .35); ctx.lineWidth = Math.max(0.8, AR * 0.016);
      for (let i = -3; i <= 3; i++) {
        ctx.beginPath();
        ctx.ellipse(ax, ampY, aw * (0.30 + Math.abs(i) * 0.22), ah * 0.94, i * 0.22, 0, TAU);
        ctx.stroke();
      }
      ctx.restore();
      if (squeeze > 0.2) {
        ctx.lineWidth = 2;
        [-1, 1].forEach(sg => {
          ctx.strokeStyle = g.alpha(th.warn, .9);
          ctx.beginPath();
          ctx.moveTo(ax + sg * (aw + AR * 0.22), ampY);
          ctx.lineTo(ax + sg * (aw + AR * 0.07), ampY);
          ctx.stroke();
          ctx.fillStyle = g.alpha(th.warn, .9);
          ctx.beginPath();
          ctx.moveTo(ax + sg * (aw + AR * 0.04), ampY);
          ctx.lineTo(ax + sg * (aw + AR * 0.14), ampY - AR * 0.06);
          ctx.lineTo(ax + sg * (aw + AR * 0.14), ampY + AR * 0.06);
          ctx.closePath(); ctx.fill();
        });
      }
      Z.leader(ctx, ax + aw * 0.7, ampY, ax + aw + AR * 0.30, ampY - AR * 0.16, CANAL);
      Z.lbl(ctx, ax + aw + AR * 0.32, ampY - AR * 0.18, 'ampulla', CANAL, 'left', 9.5);

      // the podium, extended by exactly the volume the ampulla displaced
      const podLen = AR * (0.30 + 0.85 * squeeze);
      const podW = Math.max(2, AR * 0.10 * (p.rFoot / 0.25));
      const podTop = ay - AR * 0.04;
      RXo.tube(ctx, [[ax, podTop], [ax, podTop + podLen]], podW, WATER,
               { contour: Math.max(1.2, AR * 0.020) });
      // the sucker, seen as a disc pressed on the substrate
      const suckY = podTop + podLen;
      RXo.volume(ctx, c => { c.beginPath(); c.ellipse(ax, suckY, podW * 1.9, podW * 0.8, 0, 0, TAU); },
                 { fill: '#BEE6FF', r: podW * 1.6, cx: ax, cy: suckY,
                   gloss: 0.4, contour: Math.max(1, AR * 0.016) });
      Z.leader(ctx, ax + podW, podTop + podLen * 0.45, ax + podW + AR * 0.26, podTop + podLen * 0.45, CANAL);
      Z.lbl(ctx, ax + podW + AR * 0.28, podTop + podLen * 0.45, 'podium', CANAL, 'left', 9.5);
      Z.leader(ctx, ax - podW * 1.8, suckY, ax - podW - AR * 0.26, suckY - AR * 0.12, '#E6F4FF');
      Z.lbl(ctx, ax - podW - AR * 0.28, suckY - AR * 0.12, 'sucker', '#E6F4FF', 'right', 9.5);

      // the substrate the animal is walking on
      const subY = suckY + podW * 0.9;
      ctx.fillStyle = g.alpha('#2A3550', .9);
      ctx.fillRect(ax - AR * 1.0, subY, AR * 2.0, Math.max(4, AR * 0.07));
      ctx.strokeStyle = g.alpha(th['text-3'], .8); ctx.lineWidth = 1.5;
      ctx.beginPath(); ctx.moveTo(ax - AR * 1.0, subY); ctx.lineTo(ax + AR * 1.0, subY); ctx.stroke();

      Z.lbl(ctx, ax, subY + AR * 0.22, 'extends ' + (S.ext * 1000).toFixed(1) + ' mm',
            th.bio, 'center', 11);

      /* ---------------- header ---------------- */
      ctx.textAlign = 'left'; ctx.textBaseline = 'top';
      ctx.font = '700 19px "IBM Plex Sans Condensed",sans-serif'; ctx.fillStyle = th.text;
      ctx.fillText((S.speed * 6000).toFixed(1) + ' cm/min  ·  ' + S.nStance + ' feet gripping', 14, 8);
      ctx.font = '500 10px "IBM Plex Mono",monospace'; ctx.fillStyle = th['text-3'];
      ctx.fillText('madreporite → stone canal → ring canal → radial canal → lateral canal → ampulla → tube foot',
        14, 31);
    },
    plots: [
      { title: 'Volume in, length out — the whole mechanism in one straight line',
        legend: [{ c: '#E0913A', label: 'extension at this foot radius' },
                 { c: '#63729A', label: 'a wider foot extends less' }],
        draw(S, g) {
          const mk = rf => {
            const Af = Math.PI * Math.pow(rf * 1e-3, 2), out = [];
            for (let i = 0; i <= 60; i++) {
              const c = i / 60;
              out.push([c * 100, (c * S.Vamp / Af) * 1000]);
            }
            return out;
          };
          const cur = mk(S.p.rFoot), wide = mk(Math.min(0.6, S.p.rFoot * 1.8));
          const P = g.Plot({
            xmin: 0, xmax: 100, ymin: 0, ymax: Math.max(cur[60][1], 4) * 1.12,
            xlabel: 'ampulla contraction (%)', ylabel: 'tube foot extension (mm)',
            xfmt: v => v.toFixed(0), yfmt: v => v.toFixed(0)
          }).frame();
          P.clip(() => {
            P.line(wide, g.alpha(g.theme['text-3'], .95), 1.6, [5, 3]);
            P.area(cur, 0, g.alpha('#E0913A', .13));
            P.line(cur, '#E0913A', 2.4);
            P.vline(S.p.contract * 100, g.alpha(g.theme.text, .55), [3, 3]);
            P.dot(S.p.contract * 100, S.ext * 1000, 4.5, g.theme.text, g.theme['ink-950']);
          });
          P.tag(4, cur[60][1] * 0.92, 'extension = ΔV / A', g.theme['text-2'], 'left', 0);
        },
        hover(S, x) {
          const c = clamp(x, 0, 100) / 100;
          const ext = c * S.Vamp / S.Afoot * 1000;
          return [{ label: 'contraction', value: (c * 100).toFixed(0) + '%' },
                  { label: 'volume moved', value: (c * S.Vamp * 1e9).toFixed(2) + ' mm³' },
                  { label: 'extension', value: ext.toFixed(2) + ' mm', color: '#E0913A' }];
        } },
      { title: 'Gait diagram — the metachronal wave running down one arm',
        legend: [{ c: '#9FD8FF', label: 'gripping (stance)' }, { c: '#3A4766', label: 'lifted (swing)' }],
        draw(S, g) {
          const n = Math.min(S.p.feetPerArm, 22);
          const P = g.Plot({
            xmin: 0, xmax: 3, ymin: -0.5, ymax: n - 0.5,
            xlabel: 'time (s)', ylabel: 'tube foot along the arm',
            xfmt: v => v.toFixed(1), yfmt: v => v.toFixed(0),
            pad: { l: 46, r: 14, t: 14, b: 32 }
          }).frame();
          const ctx = g.ctx;
          P.clip(() => {
            for (let j = 0; j < n; j++) {
              const f = (j + 1) / (n + 1);
              for (let i = 0; i < 150; i++) {
                const t = i / 150 * 3;
                const phase = ((S.t + t) * S.p.freq - f * S.p.lag * 4) % 1;
                const stance = ((phase % 1) + 1) % 1 < S.stanceFrac;
                ctx.fillStyle = stance ? g.alpha('#9FD8FF', .9) : g.alpha('#3A4766', .55);
                ctx.fillRect(P.X(t), P.Y(j) - (P.y0 - P.y1) / n * 0.34,
                  (P.x1 - P.x0) / 150 + 1, (P.y0 - P.y1) / n * 0.68);
              }
            }
          });
          P.tag(0.1, n - 1.2, S.p.lag > 0.02 ? 'the diagonal stripe is the wave'
            : 'zero lag — every foot moves together, no wave', g.theme.text, 'left', 0);
        } }
    ],

    readouts(S) {
      const p = S.p;
      return [
        { label: 'Tube foot extension', value: (S.ext * 1000).toFixed(2), unit: 'mm', flag: 'accent' },
        { label: 'Volume displaced', value: (S.dV * 1e9).toFixed(2), unit: 'mm³' },
        { label: 'Ampulla pressure', value: (S.press / 1000).toFixed(1), unit: 'kPa' },
        { label: 'Hydraulic force / foot', value: (S.Ffoot * 1000).toFixed(1), unit: 'mN' },
        { label: 'Adhesion limit', value: (S.adhesion * 1000).toFixed(0), unit: 'mN',
          flag: S.Ffoot > S.adhesion ? 'warn' : 'ok',
          hint: S.Ffoot > S.adhesion ? 'foot slips before the muscle gives out' : 'grip is not the limit' },
        { label: 'Tube feet total', value: String(S.nFeet), unit: '' },
        { label: 'Gripping now', value: String(S.nStance), unit: '', hint: '≈ half at any moment' },
        { label: 'Total pulling force', value: (S.Ftotal).toFixed(2), unit: 'N', flag: 'accent',
          hint: 'enough to prise open a bivalve' },
        { label: 'Walking speed', value: (S.speed * 6000).toFixed(1), unit: 'cm/min' },
        { label: 'Water in the system', value: S.wvsVol.toFixed(0), unit: 'mm³' },
        { label: 'Excretory system', value: 'Absent', unit: '', flag: 'warn',
          hint: 'echinoderms have none at all' },
        { label: 'Larval symmetry', value: 'Bilateral', unit: '', hint: 'adults are radial' }
      ];
    },

    equation(S) {
      return 'extension ' + E.op('=') + ' ' + E.frac('ΔV', E.v('A') + '<sub>foot</sub>') + ' ' + E.op('=') +
        ' ' + E.frac(E.n((S.dV * 1e9).toFixed(2), 'mm³'), E.n((S.Afoot * 1e6).toFixed(3), 'mm²')) +
        ' ' + E.op('=') + ' ' + E.n((S.ext * 1000).toFixed(2), 'mm') +
        '<br>' + E.v('F') + '<sub>foot</sub> ' + E.op('=') + ' ' + E.v('P') + E.v('A') + ' ' + E.op('=') +
        ' ' + E.n((S.press / 1000).toFixed(1), 'kPa') + E.op('×') + E.n((S.Afoot * 1e6).toFixed(3), 'mm²') +
        ' ' + E.op('=') + ' ' + E.n((S.Ffoot * 1000).toFixed(1), 'mN') +
        '<br>total ' + E.op('=') + ' ' + E.n(S.nStance, ' feet') + E.op('×') +
        E.n((S.Feff * 1000).toFixed(1), 'mN') + ' ' + E.op('=') + ' ' + E.n(S.Ftotal.toFixed(2), 'N') +
        E.op('·') + ' speed ' + E.op('=') + ' extension ' + E.op('×') + ' frequency ' + E.op('=') +
        ' ' + E.n((S.speed * 6000).toFixed(1), 'cm/min');
    },
    eqNote: '<b>A hydraulic skeleton, not a muscular one.</b> The ampulla muscle does not pull the animal — it ' +
      'only squeezes water into the podium. Because water is incompressible, every cubic millimetre displaced ' +
      'appears as length. A narrower foot therefore extends further from the same squeeze, which is why tube ' +
      'feet are so fine.',

    walkthrough: [
      { title: '1 · Where the water comes in',
        body: 'Look at the canal system on the aboral surface.',
        ask: 'Through which structure does sea water enter the system?',
        reveal: 'The <b>madreporite</b> — a perforated sieve plate. From there water passes down the <b>stone canal</b> to the <b>ring canal</b>, then out along five <b>radial canals</b>, one per arm, and finally through lateral canals to the ampullae and tube feet. That sequence is worth memorising in order.',
        params: { showCanals: true, contract: 0.55 } },
      { title: '2 · Squeeze the bulb, extend the foot',
        body: 'Drag the ampulla contraction slider and watch the magnified tube foot.',
        ask: 'What makes the foot get longer?',
        reveal: 'Water, not muscle. The ampulla contracts, a one-way <b>valve</b> stops the water escaping back into the lateral canal, so it has nowhere to go but into the podium. Extension is simply the displaced volume divided by the foot\'s cross-sectional area.',
        params: { contract: 0.95 } },
      { title: '3 · Why tube feet are so thin',
        body: 'Increase the tube foot radius and watch the extension collapse.',
        ask: 'The same volume of water is moved. Why does a fatter foot extend so much less?',
        reveal: 'Because area goes as the <b>square</b> of the radius. Double the radius and the same volume gives only a quarter of the extension. Fine tube feet trade force for reach — and the animal compensates for the small force per foot by using hundreds of them.',
        params: { rFoot: 0.5, contract: 0.55 } },
      { title: '4 · The wave',
        body: 'Look at the gait diagram, then set the phase lag to zero.',
        ask: 'Why must the tube feet move out of step with one another?',
        reveal: 'If every foot lifted at once the animal would simply let go and stop. A <b>metachronal wave</b> keeps roughly half the feet gripping at all times while the rest swing forward. The diagonal stripe on the gait chart is that wave; at zero lag it disappears and so does the locomotion.',
        params: { lag: 0.0, freq: 0.5 } },
      { title: '5 · Prising open a bivalve',
        body: 'Load the bivalve preset: many feet, strong contraction, very slow cycle.',
        ask: 'Each foot pulls only a few tens of millinewtons. How does a starfish open a mussel?',
        reveal: '<b>By adding them up, and by waiting.</b> Hundreds of feet pulling together give several newtons, and the starfish sustains it for hours. The mussel\'s adductor muscle fatigues first, the shell gapes a fraction of a millimetre, and the starfish everts its stomach through the gap.',
        params: { contract: 0.85, feetPerArm: 55, freq: 0.1, substrate: 'smooth' } }
    ],

    quiz: [
      { q: 'Water enters the water vascular system of a starfish through the:',
        options: ['osculum', 'madreporite', 'ring canal', 'ampulla'], answer: 1,
        why: 'The madreporite is the perforated sieve plate on the aboral surface; the stone canal leads from it to the ring canal.' },
      { q: 'The water vascular system of echinoderms is used for:',
        options: ['excretion only', 'locomotion, capture of food and respiration',
                  'reproduction', 'circulation of blood only'], answer: 1,
        why: 'NCERT lists exactly these three functions — locomotion, capture and transport of food, and respiration.' },
      { q: 'Echinoderms are unusual among advanced coelomates because they lack:',
        options: ['a coelom', 'a nervous system', 'an excretory system', 'a digestive system'], answer: 2,
        why: 'Echinoderms have no excretory system at all; nitrogenous waste diffuses out through the tube feet and papulae.' },
      { q: 'The coelom of echinoderms is:',
        options: ['schizocoelous', 'enterocoelous', 'a pseudocoelom', 'absent'], answer: 1,
        why: 'Echinoderms are deuterostomes: the coelom forms from pouches budded off the embryonic gut.' }
    ],

    notes: '<b>Where this shows up in the paper.</b>' +
      '<ul><li>Naming the parts of the water vascular system in order — a classic sequencing question.</li>' +
      '<li>Its three functions: locomotion, capture and transport of food, respiration.</li>' +
      '<li>The absent excretory system, and the calcareous endoskeleton of ossicles.</li>' +
      '<li>Radial adult but bilateral larva, and enterocoelous coelom formation.</li></ul>' +
      '<div class="pyq"><em>Trap to avoid</em>Tube feet are <b>not</b> muscular legs. The muscle only squeezes ' +
      'the ampulla; the foot is extended <b>hydraulically</b> by water pressure and retracted by muscles in its ' +
      'own wall. This is why the system is called a water <i>vascular</i> system.</div>'
  });

})(window.InsightLab, window.ANIMALIA, window.ANIMALART);
