/* ============================================================
   ANIMAL KINGDOM — 1. Classification key & character matrix
                    2. Body symmetry lab (computational)
   ============================================================ */
(function (L, A, ART) {
  'use strict';
  const { clamp, TAU, fmt, E } = L;
  const { PHYLA, CHARACTERS } = A;

  const val = (p, key) => p[key];
  const labelOf = (ch, v) => ch.labels[String(v)] || String(v);

  /* =========================================================================
     1 · THE CLASSIFICATION KEY — narrow eleven phyla to one
     ========================================================================= */
  function matches(p, q) {
    return CHARACTERS.every(ch => q[ch.key] === 'any' || String(val(p, ch.key)) === String(q[ch.key]));
  }

  L.register({
    id: 'ak-key', subject: 'biology',
    name: 'The Classification Key — Narrowing Eleven Phyla to One',
    chapter: 'Animal Kingdom',
    exams: ['NEET UG'],
    weight: 'Very high yield',
    is3D: false,
    stageHint: 'Set a character and phyla that fail it drop out — the exact logic of a dichotomous key',
    lede: 'Classification is not a list to memorise — it is a <b>decision procedure</b>. Six characters, applied in ' +
      'the right order, separate all eleven phyla of the animal kingdom from one another. ' +
      'Set any character below and every phylum that fails it drops out of the running. ' +
      'The matrix underneath is the full comparison table the chapter is really about.',

    params: { organisation: 'any', symmetry: 'any', layers: 'any', coelom: 'any',
              segmented: 'any', notochord: 'any', mode: 'explore', target: 0 },

    presets: [
      { name: 'Reset — all eleven', params: { organisation: 'any', symmetry: 'any', layers: 'any',
        coelom: 'any', segmented: 'any', notochord: 'any' } },
      { name: 'Diploblastic animals', params: { organisation: 'any', symmetry: 'any', layers: 'diploblastic',
        coelom: 'any', segmented: 'any', notochord: 'any' } },
      { name: 'True coelomates', params: { organisation: 'any', symmetry: 'any', layers: 'any',
        coelom: 'coelomate', segmented: 'any', notochord: 'any' } },
      { name: 'Segmented coelomates', params: { organisation: 'any', symmetry: 'any', layers: 'any',
        coelom: 'coelomate', segmented: 'true', notochord: 'any' } },
      { name: 'Down to Annelida', params: { organisation: 'organ-system', symmetry: 'bilateral',
        layers: 'triploblastic', coelom: 'coelomate', segmented: 'true', notochord: 'false' } },
      { name: 'Down to Echinodermata', params: { organisation: 'organ-system', symmetry: 'radial',
        layers: 'triploblastic', coelom: 'coelomate', segmented: 'any', notochord: 'any' } }
    ],

    controls: [
      { group: 'Mode', items: [
        { key: 'mode', type: 'select', label: 'Mode', restructure: true, options: [
          { value: 'explore', label: 'Explore' }, { value: 'identify', label: 'Identify a specimen' }] }
      ] },
      { group: 'Characters — set any, in any order', items: CHARACTERS.map(ch => ({
        key: ch.key, type: 'select', label: ch.label, restructure: true,
        options: [{ value: 'any', label: 'Any' }].concat(
          ch.values.map(v => ({ value: String(v), label: labelOf(ch, v) })))
      })) }
    ],

    setup(S) {
      const p = S.p;
      S.alive = PHYLA.filter(x => matches(x, p));
      S.set = CHARACTERS.filter(ch => p[ch.key] !== 'any').length;

      // elimination funnel — how many survive as characters are applied in order
      S.funnel = [];
      const acc = {};
      CHARACTERS.forEach(ch => { acc[ch.key] = 'any'; });
      S.funnel.push(['start', PHYLA.length]);
      CHARACTERS.forEach(ch => {
        acc[ch.key] = p[ch.key];
        S.funnel.push([ch.short, PHYLA.filter(x => matches(x, acc)).length]);
      });

      if (p.mode === 'identify') {
        if (S.targetIdx == null) S.targetIdx = Math.floor(Math.random() * PHYLA.length);
        S.target = PHYLA[clamp(S.targetIdx, 0, PHYLA.length - 1)];
        S.solved = S.alive.length === 1 && S.alive[0].id === S.target.id;
        S.wrong = S.alive.length === 1 && S.alive[0].id !== S.target.id;
      } else { S.target = null; S.solved = false; S.wrong = false; }
      S.t0 = 0;
    },

    step(S, dt) {
      S.t0 = (S.t0 || 0) + dt;
      if (S.p.mode === 'identify' && S.solved && !S.held) { S.held = 1; }
    },

    drawStage(S, g) {
      const ctx = g.ctx, th = g.theme, p = S.p, W = g.w, H = g.h;
      const alive = S.alive;
      const headH = p.mode === 'identify' ? 74 : 46;

      /* -------- header -------- */
      ctx.textAlign = 'left'; ctx.textBaseline = 'top';
      if (p.mode === 'identify' && S.target) {
        ctx.font = '500 10px "IBM Plex Mono",monospace'; ctx.fillStyle = th['text-3'];
        ctx.fillText('IDENTIFY THIS SPECIMEN', 14, 10);
        const ex = S.target.examples[0];
        ctx.font = '700 22px "IBM Plex Sans Condensed",sans-serif'; ctx.fillStyle = th.text;
        ctx.fillText(ex.g + (ex.n ? '  (' + ex.n + ')' : ''), 14, 26);
        ctx.font = '500 10.5px "IBM Plex Mono",monospace';
        ctx.fillStyle = S.solved ? th.ok : S.wrong ? th.crit : th['text-3'];
        ctx.fillText(S.solved ? '✓ CORRECT — you keyed it out to ' + S.target.name
          : S.wrong ? '✗ You narrowed to ' + alive[0].name + ' — that is not where this one belongs'
          : 'Set characters until exactly one phylum is left', 14, 54);
      } else {
        ctx.font = '700 19px "IBM Plex Sans Condensed",sans-serif'; ctx.fillStyle = th.text;
        ctx.fillText(alive.length + ' of ' + PHYLA.length + ' phyla still possible', 14, 10);
        ctx.font = '500 10px "IBM Plex Mono",monospace'; ctx.fillStyle = th['text-3'];
        ctx.fillText(S.set + ' of ' + CHARACTERS.length + ' characters fixed' +
          (alive.length === 1 ? '  ·  keyed out to ' + alive[0].name : ''), 14, 32);
      }

      /* -------- phylum cards -------- */
      const cols = W < 620 ? 3 : W < 900 ? 4 : 6;
      const rows = Math.ceil(PHYLA.length / cols);
      const padX = 14, padB = 30;
      const cw = (W - padX * 2) / cols;
      const chh = (H - headH - padB) / rows;
      const iconR = Math.min(cw * 0.28, chh * 0.30);

      PHYLA.forEach((ph, i) => {
        const cx = padX + (i % cols) * cw + cw / 2;
        const cy = headH + Math.floor(i / cols) * chh + chh / 2;
        const on = alive.indexOf(ph) >= 0;
        const isTarget = S.target && S.target.id === ph.id;

        if (on) {
          ctx.save();
          ctx.fillStyle = g.alpha(ph.hue, .09);
          ctx.strokeStyle = g.alpha(ph.hue, alive.length === 1 ? .95 : .45);
          ctx.lineWidth = alive.length === 1 ? 2 : 1;
          const rx = cx - cw / 2 + 4, ry = cy - chh / 2 + 3;
          if (ctx.roundRect) { ctx.beginPath(); ctx.roundRect(rx, ry, cw - 8, chh - 6, 9); ctx.fill(); ctx.stroke(); }
          else { ctx.fillRect(rx, ry, cw - 8, chh - 6); ctx.strokeRect(rx, ry, cw - 8, chh - 6); }
          ctx.restore();
        }
        ART.draw(ctx, ph.shape, cx, cy - chh * 0.12, iconR, ph.hue, S.t0, on ? 1 : 0.13);

        ctx.font = (on ? '600 ' : '400 ') + Math.max(9, Math.min(11.5, cw * 0.1)) + 'px "IBM Plex Sans",sans-serif';
        ctx.fillStyle = on ? th.text : g.alpha(th['text-3'], .45);
        ctx.textAlign = 'center'; ctx.textBaseline = 'bottom';
        ctx.fillText(ph.name, cx, cy + chh / 2 - 6);
        if (on && alive.length <= 3) {
          ctx.font = '9px "IBM Plex Mono",monospace';
          ctx.fillStyle = g.alpha(ph.hue, .95);
          ctx.fillText(ph.examples[0].g, cx, cy + chh / 2 - 18);
        }
        if (isTarget && (S.solved || S.wrong)) {
          ctx.strokeStyle = S.solved ? th.ok : th.warn; ctx.lineWidth = 2;
          ctx.beginPath(); ctx.arc(cx, cy - chh * 0.08, iconR * 1.5, 0, TAU); ctx.stroke();
        }
      });
    },

    plots: [
      { title: 'The comparison matrix — every phylum against every character',
        legend: [{ c: '#63729A', label: 'simpler state' }, { c: '#FF6B9D', label: 'more derived state' },
                 { c: '#E7EDFB', label: 'matches your filter' }],
        draw(S, g) {
          const P = g.Plot({
            xmin: -0.5, xmax: CHARACTERS.length - 0.5, ymin: -0.5, ymax: PHYLA.length - 0.5,
            xticks: CHARACTERS.map((_, i) => i),
            yticks: PHYLA.map((_, i) => i),
            xfmt: v => (CHARACTERS[Math.round(v)] || { short: '' }).short,
            yfmt: v => (PHYLA[Math.round(v)] || { name: '' }).name,
            pad: { l: 108, r: 14, t: 12, b: 32 }
          }).frame();
          const cw = (P.x1 - P.x0) / CHARACTERS.length;
          const chh = (P.y0 - P.y1) / PHYLA.length;
          P.clip(() => {
            PHYLA.forEach((ph, r) => {
              const on = S.alive.indexOf(ph) >= 0;
              CHARACTERS.forEach((ch, c) => {
                const idx = ch.values.map(String).indexOf(String(val(ph, ch.key)));
                const t = ch.values.length > 1 ? idx / (ch.values.length - 1) : 0;
                const x = P.X(c) - cw / 2 + 1, y = P.Y(r) - chh / 2 + 1;
                g.ctx.fillStyle = g.alpha(g.mix('#3A4766', '#FF6B9D', t), on ? 0.92 : 0.16);
                g.ctx.fillRect(x, y, cw - 2, chh - 2);
                const filtered = S.p[ch.key] !== 'any' && String(S.p[ch.key]) === String(val(ph, ch.key));
                if (filtered && on) {
                  g.ctx.strokeStyle = g.alpha('#E7EDFB', .9); g.ctx.lineWidth = 1.5;
                  g.ctx.strokeRect(x + .75, y + .75, cw - 3.5, chh - 3.5);
                }
              });
            });
          });
        },
        hover(S, x, y) {
          const c = clamp(Math.round(x), 0, CHARACTERS.length - 1);
          const r = clamp(Math.round(y), 0, PHYLA.length - 1);
          const ch = CHARACTERS[c], ph = PHYLA[r];
          return [{ label: 'phylum', value: ph.name, color: ph.hue },
                  { label: ch.short, value: labelOf(ch, val(ph, ch.key)) },
                  { label: 'example', value: ph.examples[0].g },
                  { label: 'status', value: S.alive.indexOf(ph) >= 0 ? 'still possible' : 'eliminated' }];
        } },
      { title: 'Elimination funnel — how fast each character cuts the field',
        legend: [{ c: '#FF6B9D', label: 'phyla still possible' }],
        draw(S, g) {
          const P = g.Plot({
            xmin: -0.5, xmax: S.funnel.length - 0.5, ymin: 0, ymax: PHYLA.length + 0.6,
            xticks: S.funnel.map((_, i) => i),
            xfmt: v => (S.funnel[Math.round(v)] || [''])[0],
            yfmt: v => v.toFixed(0),
            ylabel: 'phyla remaining', pad: { l: 46, r: 14, t: 14, b: 36 }
          }).frame();
          P.clip(() => {
            S.funnel.forEach((f, i) => {
              P.bar(i, f[1], 0.34, 0, g.alpha(g.theme.bio, i === 0 ? .35 : .88));
              P.tag(i, f[1], String(f[1]), g.theme.text, 'left', -9);
            });
            P.line(S.funnel.map((f, i) => [i, f[1]]), g.alpha(g.theme.text, .45), 1.5, [4, 3]);
          });
        },
        hover(S, x) {
          const i = clamp(Math.round(x), 0, S.funnel.length - 1);
          return [{ label: 'after', value: S.funnel[i][0] },
                  { label: 'remaining', value: String(S.funnel[i][1]), color: '#FF6B9D' },
                  { label: 'eliminated', value: String(PHYLA.length - S.funnel[i][1]) }];
        } }
    ],

    readouts(S) {
      const alive = S.alive;
      const out = [
        { label: 'Phyla still possible', value: String(alive.length), unit: '', flag: 'accent' },
        { label: 'Characters fixed', value: S.set + ' / ' + CHARACTERS.length, unit: '' }
      ];
      if (alive.length === 1) {
        const ph = alive[0];
        out.push({ label: 'Identified as', value: ph.name, unit: '', flag: 'ok' });
        out.push({ label: 'Common name', value: ph.common, unit: '' });
        out.push({ label: 'Examples', value: ph.examples.slice(0, 3).map(e => e.g).join(', '), unit: '' });
        out.push({ label: 'Diagnostic feature', value: ph.unique[0], unit: '' });
        out.push({ label: 'Circulatory system', value: ph.circulatory, unit: '' });
        out.push({ label: 'Excretion', value: ph.excretion, unit: '' });
        out.push({ label: 'Habitat', value: ph.habitat, unit: '' });
      } else if (alive.length === 0) {
        out.push({ label: 'Result', value: 'No phylum fits', unit: '', flag: 'crit',
          hint: 'that combination of characters does not exist in the animal kingdom' });
      } else {
        // name the single character that would split the survivors best
        let best = null, bestScore = 99;
        CHARACTERS.forEach(ch => {
          if (S.p[ch.key] !== 'any') return;
          const groups = {};
          alive.forEach(a => { groups[String(val(a, ch.key))] = (groups[String(val(a, ch.key))] || 0) + 1; });
          const sizes = Object.values(groups);
          if (sizes.length < 2) return;
          const worst = Math.max.apply(null, sizes);
          if (worst < bestScore) { bestScore = worst; best = ch; }
        });
        out.push({ label: 'Survivors', value: alive.slice(0, 4).map(a => a.name).join(', ') +
          (alive.length > 4 ? ' +' + (alive.length - 4) : ''), unit: '' });
        out.push({ label: 'Best next character', value: best ? best.short : '—', unit: '',
          flag: 'accent', hint: best ? 'would cut the field to at most ' + bestScore : 'these cannot be split further' });
      }
      return out;
    },

    equation(S) {
      const alive = S.alive;
      const set = CHARACTERS.filter(ch => S.p[ch.key] !== 'any');
      if (!set.length) return 'Set any character above and the field narrows. ' +
        E.op('·') + ' 11 phyla ' + E.op('×') + ' 6 characters ' + E.op('=') + ' the whole chapter in one table.';
      return set.map(ch => E.v(ch.short) + ' ' + E.op('=') + ' ' +
        E.n(labelOf(ch, S.p[ch.key]), '')).join(' ' + E.op('∧') + ' ') +
        ' ' + E.op('→') + ' ' + E.n(String(alive.length), alive.length === 1 ? ' phylum' : ' phyla') +
        (alive.length === 1 ? ' ' + E.op('=') + ' ' + E.n(alive[0].name, '') : '');
    },
    eqNote: '<b>Order matters for speed, not for the answer.</b> A good key applies the character that splits the ' +
      'field most evenly first. The "best next character" readout names it for you — that is exactly how a real ' +
      'taxonomic key is built.',

    walkthrough: [
      { title: '1 · Level of organisation comes first',
        body: 'Set the level of organisation to cellular and watch what survives.',
        ask: 'Only one phylum is left. Which, and why is that character so powerful here?',
        reveal: '<b>Porifera.</b> Sponges are the only animals at the cellular level — their cells are not organised into true tissues, so there is no nervous system, no muscle and no gut. Every other phylum has reached at least the tissue level.',
        params: { organisation: 'cellular', symmetry: 'any', layers: 'any', coelom: 'any', segmented: 'any', notochord: 'any' } },
      { title: '2 · Diploblastic versus triploblastic',
        body: 'Clear that and set germ layers to diploblastic instead.',
        ask: 'Two phyla survive. What do they share besides two germ layers?',
        reveal: '<b>Coelenterata and Ctenophora</b> — both are radially symmetrical, aquatic and at the tissue level. They have only ectoderm and endoderm, with a jelly-like mesoglea between. Everything above them is triploblastic, and it is the third layer (mesoderm) that makes muscles, a skeleton and a body cavity possible.',
        params: { organisation: 'any', symmetry: 'any', layers: 'diploblastic', coelom: 'any', segmented: 'any', notochord: 'any' } },
      { title: '3 · The three body-cavity grades',
        body: 'Step the body cavity through acoelomate, pseudocoelomate and coelomate.',
        ask: 'Which phylum is the pseudocoelomate one?',
        reveal: '<b>Aschelminthes (Nematoda).</b> Their body cavity is not lined by mesoderm on both sides, so it is a false coelom. Platyhelminthes are acoelomate — solid mesoderm, no cavity at all. Everything from Annelida upward has a true coelom.',
        params: { organisation: 'any', symmetry: 'any', layers: 'any', coelom: 'pseudocoelomate', segmented: 'any', notochord: 'any' } },
      { title: '4 · Segmentation splits the coelomates',
        body: 'Set coelomate, then add segmentation present.',
        ask: 'Three phyla survive. How would you separate them?',
        reveal: '<b>Annelida, Arthropoda and Chordata.</b> Notochord immediately removes Chordata from the other two. Annelida and Arthropoda are then separated by the exoskeleton and jointed appendages — and by closed versus open circulation.',
        params: { organisation: 'any', symmetry: 'any', layers: 'any', coelom: 'coelomate', segmented: 'true', notochord: 'any' } },
      { title: '5 · The radial coelomate',
        body: 'Now set symmetry to radial with a true coelom.',
        ask: 'An adult echinoderm is radial, yet it sits high in the key. What is going on?',
        reveal: '<b>Echinodermata.</b> The adults are radially symmetrical but the <b>larvae are bilaterally symmetrical</b> — so the radial form is secondary, acquired later in evolution. That single fact is why echinoderms are grouped with the advanced coelomates and not with the jellyfish.',
        params: { organisation: 'any', symmetry: 'radial', layers: 'triploblastic', coelom: 'coelomate', segmented: 'any', notochord: 'any' } },
      { title: '6 · Key out a specimen yourself',
        body: 'Switch to identify mode. A genus appears; use the characters to narrow the field to its phylum.',
        ask: 'What is the fastest general strategy?',
        reveal: 'Apply the character that <b>splits the survivors most evenly</b>, not the one you happen to know. The readout names it each time. Two or three well-chosen characters will key out almost any specimen from eleven phyla.',
        params: { mode: 'identify', organisation: 'any', symmetry: 'any', layers: 'any', coelom: 'any', segmented: 'any', notochord: 'any' } }
    ],

    quiz: [
      { q: 'Which phylum shows the cellular level of organisation?',
        options: ['Coelenterata', 'Porifera', 'Platyhelminthes', 'Ctenophora'], answer: 1,
        why: 'Sponges are the only animals whose cells are loosely arranged and not organised into true tissues.' },
      { q: 'Pseudocoelom is characteristic of:',
        options: ['Platyhelminthes', 'Annelida', 'Aschelminthes', 'Mollusca'], answer: 2,
        why: 'In roundworms the body cavity is not lined by mesoderm on both surfaces, so it is a false coelom.' },
      { q: 'Which of these is triploblastic but acoelomate?',
        options: ['Ascaris', 'Planaria', 'Pheretima', 'Asterias'], answer: 1,
        why: 'Planaria (Platyhelminthes) has three germ layers but no body cavity — the mesoderm fills the space solidly.' },
      { q: 'Adult echinoderms are radially symmetrical, but their larvae are:',
        options: ['asymmetrical', 'radially symmetrical', 'bilaterally symmetrical', 'biradially symmetrical'], answer: 2,
        why: 'The bilateral larva shows that radial symmetry in echinoderms is a secondary, later-acquired condition.' },
      { q: 'Metameric segmentation is first seen in:',
        options: ['Aschelminthes', 'Annelida', 'Arthropoda', 'Mollusca'], answer: 1,
        why: 'Annelida is the first phylum in which the body is genuinely divided into repeated segments, internally and externally.' }
    ],

    notes: '<b>Where this shows up in the paper.</b>' +
      '<ul><li>"Match the phylum with its character" and assertion–reason questions — the single most common Animal Kingdom format.</li>' +
      '<li>Identify the phylum from a named genus. The example genera in NCERT are the ones that appear.</li>' +
      '<li>Sequencing questions on increasing complexity: cellular → tissue → organ → organ-system.</li>' +
      '<li>Body cavity comparisons: acoelomate vs pseudocoelomate vs coelomate, with examples.</li></ul>' +
      '<div class="pyq"><em>Trap to avoid</em>Coelom is defined by its <b>lining</b>, not by whether a space exists. ' +
      'A pseudocoelomate does have a cavity — it simply is not lined by mesoderm on both sides. Saying "no body ' +
      'cavity" for Ascaris is wrong; that description belongs to Planaria.</div>'
  });

  /* =========================================================================
     2 · SYMMETRY LAB — the number of mirror planes, computed
     ========================================================================= */
  const FORMS = [
    { id: 'sponge', name: 'Sycon', taxon: 'Porifera', type: 'Asymmetrical', planes: 0, hue: '#E8A33D',
      art: 'vase',
      r: th => 1 + 0.26 * Math.sin(3 * th + 1) + 0.17 * Math.sin(5 * th + 2.2) + 0.10 * Math.sin(7 * th + 0.6) },
    { id: 'planaria', name: 'Planaria', taxon: 'Platyhelminthes', type: 'Bilateral', planes: 1, hue: '#E8685B',
      art: 'flatworm',
      r: th => 1 + 0.34 * Math.cos(th) - 0.15 * Math.cos(2 * th) + 0.05 * Math.cos(3 * th) },
    { id: 'ctenophore', name: 'Pleurobrachia', taxon: 'Ctenophora', type: 'Biradial', planes: 2, hue: '#8B7BE8',
      art: 'ctenophore',
      r: th => 1 + 0.24 * Math.cos(2 * th) + 0.07 * Math.cos(4 * th) },
    { id: 'aurelia', name: 'Aurelia', taxon: 'Coelenterata', type: 'Radial (tetramerous)', planes: 4, hue: '#5AA9FF',
      art: 'medusa',
      r: th => 1 + 0.17 * Math.cos(4 * th) },
    { id: 'asterias', name: 'Asterias', taxon: 'Echinodermata', type: 'Radial (pentamerous)', planes: 5, hue: '#E0913A',
      art: 'starfish',
      r: th => 0.52 + 0.50 * Math.pow(Math.abs(Math.cos(2.5 * th)), 0.55) },
    { id: 'sphere', name: 'Radiolarian', taxon: 'Protist (for contrast)', type: 'Spherical', planes: -1, hue: '#7FBF9B',
      art: 'vase', r: () => 1 },
    { id: 'custom', name: 'Model animal', taxon: 'built by you', type: 'set by the fold slider', planes: -2,
      hue: '#7CE0A8', art: 'medusa', r: th => 1 + 0.32 * Math.cos(5 * th) }
  ];

  // Mirror-symmetry score about a line at angle phi. 1 = perfect mirror.
  function symScore(form, phi) {
    let num = 0, den = 0;
    const N = 160;
    for (let i = 1; i < N; i++) {
      const d = i / N * Math.PI;
      const a = form.r(phi + d), b = form.r(phi - d);
      num += Math.abs(a - b); den += (a + b) / 2;
    }
    return den > 0 ? Math.max(0, 1 - num / den) : 0;
  }

  L.register({
    id: 'ak-symmetry', subject: 'biology',
    name: 'Body Symmetry — Counting the Planes',
    chapter: 'Animal Kingdom',
    exams: ['NEET UG'],
    weight: 'High yield',
    is3D: false,
    stageHint: 'The mirrored outline is drawn over the real one — where they part, symmetry fails',
    lede: 'Asymmetrical, radial, biradial, bilateral — these are not descriptive adjectives, they are a ' +
      '<b>count of mirror planes</b>. This lab takes the real body outline of each animal, reflects it about a ' +
      'test plane, and measures how well the two halves agree. Sweep the plane and the number of peaks in the ' +
      'graph <b>is</b> the number of planes of symmetry.',

    params: { form: 'asterias', phi: 0, mirror: true, allPlanes: true, spin: false, lobes: 5 },

    presets: FORMS.map(f => ({ name: f.name + ' — ' + f.type.split(' ')[0], params: { form: f.id, phi: 0 } })),

    controls: [
      { group: 'Specimen', items: [
        { key: 'form', type: 'select', label: 'Animal', restructure: true,
          options: FORMS.map(f => ({ value: f.id, label: f.name })) }
      ] },
      { group: 'Model animal', items: [
        { key: 'lobes', label: 'Fold number of the model', min: 1, max: 9, step: 1, unit: '-fold',
          fmt: v => v.toFixed(0), restructure: true,
          when: S => S.p.form === 'custom' }
      ] },
      { group: 'Test plane', items: [
        { key: 'phi', label: 'Plane angle <i>φ</i>', min: 0, max: 180, step: 0.5, unit: '°',
          fmt: v => v.toFixed(1) },
        { key: 'spin', type: 'toggle', label: 'Sweep the plane automatically' },
        { key: 'mirror', type: 'toggle', label: 'Show the mirrored outline' },
        { key: 'allPlanes', type: 'toggle', label: 'Show every plane of symmetry' }
      ] }
    ],

    setup(S) {
      const p = S.p;
      S.form = FORMS.find(f => f.id === p.form) || FORMS[0];
      if (S.form.id === 'custom') {
        const n = clamp(Math.round(p.lobes), 1, 9);
        S.form = Object.assign({}, S.form, {
          r: th => 1 + 0.32 * Math.cos(n * th),
          type: n === 1 ? 'Bilateral — one plane' : n === 2 ? 'Biradial — two planes' : n + '-fold radial',
          planes: n
        });
      }
      // scan for planes of symmetry
      const N = 720, curve = [];
      for (let i = 0; i <= N; i++) {
        const phi = i / N * Math.PI;
        curve.push([phi * 180 / Math.PI, symScore(S.form, phi)]);
      }
      S.curve = curve;
      const TH = 0.985;
      const found = [];
      for (let i = 1; i < N; i++) {
        if (curve[i][1] >= TH && curve[i][1] >= curve[i - 1][1] && curve[i][1] >= curve[i + 1][1]) {
          if (!found.length || Math.abs(curve[i][0] - found[found.length - 1]) > 4) found.push(curve[i][0]);
        }
      }
      // a perfect sphere is symmetric at every angle
      const allHigh = curve.every(c => c[1] >= TH);
      S.allHigh = allHigh;
      S.found = allHigh ? [] : found;
      S.nPlanes = allHigh ? Infinity : found.length;
      S.best = curve.reduce((b, c) => c[1] > b[1] ? c : b, curve[0]);
    },

    step(S, dt) {
      S.t = (S.t || 0) + dt;
      if (S.p.spin) S.p.phi = (S.p.phi + dt * 22) % 180;
    },

    drawStage(S, g) {
      const ctx = g.ctx, th = g.theme, p = S.p, W = g.w, H = g.h;
      const f = S.form;
      const cx = W * 0.42, cy = H * 0.52;
      const R = Math.min(W * 0.26, H * 0.36);
      const phi = p.phi * Math.PI / 180;
      const score = symScore(f, phi);

      const pt = (a, rr) => [cx + Math.cos(a) * rr * R, cy + Math.sin(a) * rr * R];

      /* --- real outline --- */
      ctx.beginPath();
      for (let i = 0; i <= 240; i++) {
        const a = i / 240 * TAU;
        const q = pt(a, f.r(a));
        i ? ctx.lineTo(q[0], q[1]) : ctx.moveTo(q[0], q[1]);
      }
      ctx.closePath();
      const grad = ctx.createRadialGradient(cx - R * .3, cy - R * .3, R * .1, cx, cy, R * 1.4);
      grad.addColorStop(0, g.mix(f.hue, '#ffffff', .45));
      grad.addColorStop(.6, f.hue);
      grad.addColorStop(1, g.mix(f.hue, '#05080F', .5));
      ctx.fillStyle = grad; ctx.fill();
      ctx.strokeStyle = g.alpha(f.hue, .95); ctx.lineWidth = 1.5; ctx.stroke();

      /* --- mirrored outline --- */
      if (p.mirror) {
        ctx.save();
        ctx.setLineDash([5, 4]); ctx.lineWidth = 2;
        ctx.strokeStyle = score > 0.985 ? th.ok : score > 0.9 ? th.warn : th.crit;
        ctx.beginPath();
        for (let i = 0; i <= 240; i++) {
          const a = i / 240 * TAU;
          // reflect the sampling angle about the plane at phi
          const q = pt(a, f.r(2 * phi - a));
          i ? ctx.lineTo(q[0], q[1]) : ctx.moveTo(q[0], q[1]);
        }
        ctx.closePath(); ctx.stroke(); ctx.restore();
      }

      /* --- every plane of symmetry --- */
      if (p.allPlanes) {
        ctx.save(); ctx.setLineDash([2, 5]); ctx.lineWidth = 1;
        ctx.strokeStyle = g.alpha(th.ok, .6);
        if (S.allHigh) {
          for (let k = 0; k < 12; k++) {
            const a = k / 12 * Math.PI;
            ctx.beginPath();
            ctx.moveTo(cx - Math.cos(a) * R * 1.55, cy - Math.sin(a) * R * 1.55);
            ctx.lineTo(cx + Math.cos(a) * R * 1.55, cy + Math.sin(a) * R * 1.55);
            ctx.stroke();
          }
        } else S.found.forEach(deg => {
          const a = deg * Math.PI / 180;
          ctx.beginPath();
          ctx.moveTo(cx - Math.cos(a) * R * 1.55, cy - Math.sin(a) * R * 1.55);
          ctx.lineTo(cx + Math.cos(a) * R * 1.55, cy + Math.sin(a) * R * 1.55);
          ctx.stroke();
        });
        ctx.restore();
      }

      /* --- the test plane --- */
      ctx.strokeStyle = g.alpha(th.text, .9); ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(cx - Math.cos(phi) * R * 1.7, cy - Math.sin(phi) * R * 1.7);
      ctx.lineTo(cx + Math.cos(phi) * R * 1.7, cy + Math.sin(phi) * R * 1.7);
      ctx.stroke();
      ctx.font = '500 10px "IBM Plex Mono",monospace';
      ctx.fillStyle = th.text; ctx.textAlign = 'center'; ctx.textBaseline = 'bottom';
      ctx.fillText('φ = ' + p.phi.toFixed(1) + '°',
        cx + Math.cos(phi) * R * 1.78, cy + Math.sin(phi) * R * 1.78);

      /* --- the real animal, for reference --- */
      ART.draw(ctx, f.art, W * 0.84, cy, Math.min(W * 0.12, H * 0.28), f.hue, S.t || 0, 0.95);
      ctx.font = '9.5px "IBM Plex Mono",monospace'; ctx.fillStyle = th['text-3'];
      ctx.textAlign = 'center'; ctx.textBaseline = 'top';
      ctx.fillText(f.name + ' · ' + f.taxon, W * 0.84, cy + Math.min(W * 0.12, H * 0.28) * 1.4);

      /* --- verdict --- */
      ctx.textAlign = 'left'; ctx.textBaseline = 'top';
      ctx.font = '700 19px "IBM Plex Sans Condensed",sans-serif';
      ctx.fillStyle = th.text;
      ctx.fillText(f.type, 14, 10);
      ctx.font = '500 10.5px "IBM Plex Mono",monospace';
      ctx.fillStyle = score > 0.985 ? th.ok : score > 0.9 ? th.warn : th.crit;
      ctx.fillText(score > 0.985 ? '✓ this plane divides the body into mirror halves'
        : score > 0.9 ? '~ nearly, but the halves do not match'
        : '✗ this plane does not give mirror halves', 14, 34);
      ctx.fillStyle = th['text-3'];
      ctx.fillText('match score ' + score.toFixed(3) +
        '   ·   planes of symmetry: ' + (S.nPlanes === Infinity ? 'infinite' : S.nPlanes), 14, 50);
    },

    plots: [
      { title: 'Symmetry score as the plane sweeps — count the peaks',
        legend: [{ c: '#FF6B9D', label: 'match score' }, { c: '#4ADE80', label: 'plane of symmetry' }],
        draw(S, g) {
          const P = g.Plot({
            xmin: 0, xmax: 180, ymin: 0, ymax: 1.08,
            xlabel: 'angle of the test plane φ (°)', ylabel: 'mirror match score',
            xticks: [0, 30, 60, 90, 120, 150, 180],
            xfmt: v => v.toFixed(0), yfmt: v => v.toFixed(1)
          }).frame();
          P.clip(() => {
            P.hline(0.985, g.alpha(g.theme.ok, .85), [4, 3]);
            P.area(S.curve, 0, g.alpha(g.theme.bio, .13));
            P.line(S.curve, g.theme.bio, 2);
            S.found.forEach(deg => P.dot(deg, 1, 4.5, g.theme.ok, g.theme['ink-950']));
            P.vline(S.p.phi, g.alpha(g.theme.text, .7), [3, 3]);
          });
          P.tag(2, 0.985, 'perfect-mirror threshold', g.theme.ok, 'left', -9);
          P.tag(178, 0.06, S.allHigh ? 'flat at 1 — infinitely many planes'
            : S.found.length + ' plane' + (S.found.length === 1 ? '' : 's') + ' of symmetry',
            g.theme['text-2'], 'right', 0);
        },
        hover(S, x) {
          const phi = clamp(x, 0, 180) * Math.PI / 180;
          const s = symScore(S.form, phi);
          return [{ label: 'plane angle', value: (x).toFixed(1) + '°' },
                  { label: 'match score', value: s.toFixed(4), color: '#FF6B9D' },
                  { label: 'verdict', value: s > 0.985 ? 'plane of symmetry' : 'not symmetric' }];
        } },
      { title: 'How the eleven phyla divide by symmetry',
        legend: [{ c: '#8B7BE8', label: 'asymmetrical' }, { c: '#5AA9FF', label: 'radial' },
                 { c: '#E8685B', label: 'bilateral' }],
        draw(S, g) {
          const types = ['asymmetrical', 'radial', 'bilateral'];
          const cols = { asymmetrical: '#8B7BE8', radial: '#5AA9FF', bilateral: '#E8685B' };
          const counts = types.map(t => PHYLA.filter(p => p.symmetry === t));
          const P = g.Plot({
            xmin: -0.5, xmax: 2.5, ymin: 0, ymax: 8.4,
            xticks: [0, 1, 2], xfmt: v => types[Math.round(v)] || '',
            ylabel: 'number of phyla', yfmt: v => v.toFixed(0),
            pad: { l: 46, r: 14, t: 14, b: 34 }
          }).frame();
          P.clip(() => {
            counts.forEach((list, i) => {
              P.bar(i, list.length, 0.3, 0, g.alpha(cols[types[i]], .9));
              P.tag(i, list.length, String(list.length), g.theme.text, 'left', -9);
              list.forEach((ph, k) => P.tag(i, list.length - 0.55 - k * 0.62, ph.name,
                g.theme['text-3'], 'left', 0));
            });
          });
        },
        hover(S, x) {
          const types = ['asymmetrical', 'radial', 'bilateral'];
          const t = types[clamp(Math.round(x), 0, 2)];
          const list = PHYLA.filter(p => p.symmetry === t);
          return [{ label: 'symmetry', value: t },
                  { label: 'phyla', value: String(list.length) },
                  { label: 'which', value: list.map(p => p.name).join(', ') }];
        } }
    ],

    readouts(S) {
      const f = S.form, phi = S.p.phi * Math.PI / 180;
      const score = symScore(f, phi);
      return [
        { label: 'Specimen', value: f.name, unit: '', flag: 'accent', hint: f.taxon },
        { label: 'Symmetry type', value: f.type, unit: '', flag: 'accent' },
        { label: 'Planes of symmetry', value: S.nPlanes === Infinity ? '∞' : String(S.nPlanes), unit: '' },
        { label: 'Score at this plane', value: score.toFixed(4), unit: '',
          flag: score > 0.985 ? 'ok' : score > 0.9 ? 'warn' : 'crit' },
        { label: 'Best plane found', value: S.best ? S.best[0].toFixed(1) + '°' : '—', unit: '' },
        { label: 'Planes at', value: S.allHigh ? 'every angle'
          : (S.found.length ? S.found.map(d => d.toFixed(0) + '°').join(', ') : 'none'), unit: '' },
        { label: 'Body plan meaning', value: f.planes === 1 ? 'Head and tail, left and right'
          : f.planes === 0 ? 'No repeating plan'
          : f.planes === -1 ? 'Every plane through the centre'
          : 'Parts arranged around a central axis', unit: '' }
      ];
    },

    equation(S) {
      const f = S.form, phi = S.p.phi * Math.PI / 180;
      return E.v('S') + '(' + E.v('φ') + ') ' + E.op('=') + ' 1 ' + E.op('−') + ' ' +
        E.frac('Σ |' + E.v('r') + '(' + E.v('φ') + '+' + E.v('δ') + ') ' + E.op('−') + ' ' +
          E.v('r') + '(' + E.v('φ') + '−' + E.v('δ') + ')|', 'Σ ' + E.v('r')) +
        '<br>at ' + E.v('φ') + ' ' + E.op('=') + ' ' + E.n(S.p.phi.toFixed(1), '°') + E.op(':') + ' ' +
        E.v('S') + ' ' + E.op('=') + ' ' + E.n(symScore(f, phi).toFixed(4), '') +
        E.op('·') + ' planes where ' + E.v('S') + ' ' + E.op('≈') + ' 1 ' + E.op('→') + ' ' +
        E.n(S.nPlanes === Infinity ? '∞' : String(S.nPlanes), '') +
        '<br>' + E.n(String(S.nPlanes === Infinity ? '∞' : S.nPlanes), ' planes') + ' ' + E.op('→') + ' ' +
        E.n(f.type, '');
    },
    eqNote: '<b>The definitions, stated as counts.</b> Asymmetrical = no plane. Bilateral = exactly one plane, ' +
      'which is what creates a front and back, a left and right, and therefore a head — <i>cephalisation</i>. ' +
      'Radial = many planes through one central axis. Biradial = exactly two.',

    walkthrough: [
      { title: '1 · No plane at all',
        body: 'Start with the sponge and sweep the test plane through the whole range.',
        ask: 'The score never reaches the threshold. What does that mean biologically?',
        reveal: '<b>Asymmetry.</b> A sponge has no repeating body plan, no front or back, no left or right. That is possible only because it is sessile and filters water from every direction — there is no "forward" for it to face.',
        params: { form: 'sponge', phi: 0, spin: true } },
      { title: '2 · Exactly one plane',
        body: 'Switch to Planaria. Sweep again and count the peaks.',
        ask: 'Bilateral symmetry has one plane. Why does that single plane matter so much in evolution?',
        reveal: 'One plane means the animal has a definite <b>anterior and posterior end</b>. Sense organs and nerve tissue concentrate at the leading end — <b>cephalisation</b>, the beginning of a head and brain. Every actively moving animal, from flatworms to us, is bilateral.',
        params: { form: 'planaria', phi: 0, spin: true } },
      { title: '3 · Exactly two — biradial',
        body: 'Now Pleurobrachia, a comb jelly.',
        ask: 'Two planes, not many. What is biradial symmetry?',
        reveal: 'The body is basically radial, but a pair of structures (here the two tentacles) reduces it to <b>two</b> planes of symmetry. It is an intermediate condition, and Ctenophora is the standard example.',
        params: { form: 'ctenophore', phi: 0, spin: true } },
      { title: '4 · Many planes — radial',
        body: 'Compare Aurelia (four-fold) with Asterias (five-fold).',
        ask: 'How many planes does a starfish have, and what is that condition called?',
        reveal: '<b>Five</b> — the graph shows exactly five peaks. This is <b>pentamerous radial symmetry</b>, the signature of adult echinoderms. Aurelia shows four planes: tetramerous radial symmetry.',
        params: { form: 'asterias', phi: 0, spin: true, allPlanes: true } },
      { title: '5 · Why radial suits a sessile life',
        body: 'Look at which animals turned out radial: sponges aside, they are cnidarians, ctenophores and echinoderms.',
        ask: 'What do radially symmetrical animals have in common ecologically?',
        reveal: 'They are <b>sessile, sedentary or drifting</b>. When food and danger can arrive from any direction, a body organised around a central axis treats every direction alike. Bilateral symmetry only pays off when an animal moves purposefully in one direction.',
        params: { form: 'aurelia', phi: 0, spin: true } }
    ],

    quiz: [
      { q: 'Pentamerous radial symmetry is characteristic of adult:',
        options: ['Coelenterata', 'Ctenophora', 'Echinodermata', 'Mollusca'], answer: 2,
        why: 'Adult echinoderms such as the starfish have five planes of symmetry arranged around a central axis.' },
      { q: 'Bilateral symmetry is directly associated with:',
        options: ['a sessile habit', 'cephalisation and directed movement',
                  'the absence of a coelom', 'radial cleavage'], answer: 1,
        why: 'A single plane creates a definite anterior end, where sense organs and nervous tissue concentrate — the origin of a head.' },
      { q: 'Which animal is asymmetrical?',
        options: ['Hydra', 'Sycon', 'Pleurobrachia', 'Asterias'], answer: 1,
        why: 'Sponges have no plane that divides the body into mirror halves — NCERT describes them as mostly asymmetrical.' },
      { q: 'Biradial symmetry, with exactly two planes, is shown by:',
        options: ['Ctenophora', 'Porifera', 'Annelida', 'Aves'], answer: 0,
        why: 'Comb jellies are essentially radial, but a pair of tentacles reduces the symmetry to two planes.' }
    ],

    notes: '<b>Where this shows up in the paper.</b>' +
      '<ul><li>Match symmetry type to phylum — a standard one-mark item.</li>' +
      '<li>The echinoderm twist: radial adult, bilateral larva. Asked almost every year in some form.</li>' +
      '<li>Linking bilateral symmetry to cephalisation and to an active mode of life.</li>' +
      '<li>Identifying biradial symmetry, which students often forget exists.</li></ul>' +
      '<div class="pyq"><em>Trap to avoid</em>Radial symmetry is <b>not</b> "symmetrical in every direction". ' +
      'It means the planes all pass through one central axis. A starfish cut anywhere other than through the ' +
      'centre gives two unequal pieces.</div>'
  });

})(window.InsightLab, window.ANIMALIA, window.ANIMALART);
