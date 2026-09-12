/* ============================================================
   ANIMAL KINGDOM — upgrade pass 3
   More experimental control and a third analysis graph on the
   labs that were thin.
   ============================================================ */
(function (L, A) {
  'use strict';
  const { clamp } = L;

  /* ---------------- germ-layer derivatives ---------------- */
  const DERIV = [
    { layer: 'Ectoderm', col: '#5AA9FF', organs: ['Epidermis', 'Hair and nails', 'Brain', 'Spinal cord',
      'Nerves', 'Retina', 'Tooth enamel', 'Lining of mouth and anus'] },
    { layer: 'Mesoderm', col: '#E8685B', organs: ['Muscles', 'Bone and cartilage', 'Dermis', 'Blood',
      'Heart', 'Blood vessels', 'Kidneys', 'Gonads', 'Peritoneum'] },
    { layer: 'Endoderm', col: '#E8B64C', organs: ['Lining of the gut', 'Liver', 'Pancreas',
      'Lining of the lungs', 'Thyroid', 'Lining of the bladder'] }
  ];

  L.extend('ak-coelom', {
    params: { layer: 'all' },
    addControlGroups: [{
      group: 'Germ layer derivatives', items: [
        { key: 'layer', type: 'select', label: 'Highlight layer', restructure: true, options: [
          { value: 'all', label: 'All' }, { value: 'Ectoderm', label: 'Ecto' },
          { value: 'Mesoderm', label: 'Meso' }, { value: 'Endoderm', label: 'Endo' }] }
      ]
    }],
    addPlots: [{
      title: 'Which germ layer makes which organ — the derivatives asked about most often',
      legend: DERIV.map(d => ({ c: d.col, label: d.layer })),
      draw(S, g) {
        const ctx = g.ctx;
        const maxN = Math.max.apply(null, DERIV.map(d => d.organs.length));
        const P = g.Plot({
          xmin: -0.5, xmax: 2.5, ymin: -0.6, ymax: maxN - 0.2,
          xticks: [0, 1, 2], xfmt: v => (DERIV[Math.round(v)] || { layer: '' }).layer,
          yticks: [], pad: { l: 22, r: 14, t: 14, b: 34 }
        }).frame();
        P.clip(() => {
          DERIV.forEach((d, i) => {
            const on = S.p.layer === 'all' || S.p.layer === d.layer;
            d.organs.forEach((o, k) => {
              const y = maxN - 1 - k;
              ctx.fillStyle = g.alpha(d.col, on ? .22 : .06);
              const w = (P.x1 - P.x0) / 3 * 0.86, h = (P.y0 - P.y1) / maxN * 0.72;
              ctx.fillRect(P.X(i) - w / 2, P.Y(y) - h / 2, w, h);
              ctx.font = (on ? '600 ' : '400 ') + '9.5px "IBM Plex Sans",sans-serif';
              ctx.fillStyle = on ? g.theme.text : g.alpha(g.theme['text-3'], .5);
              ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
              ctx.fillText(o, P.X(i), P.Y(y));
            });
          });
        });
      },
      hover(S, x, y) {
        const i = clamp(Math.round(x), 0, 2);
        const d = DERIV[i];
        const maxN = Math.max.apply(null, DERIV.map(q => q.organs.length));
        const k = clamp(Math.round(maxN - 1 - y), 0, d.organs.length - 1);
        return [{ label: 'germ layer', value: d.layer, color: d.col },
                { label: 'derivative', value: d.organs[k] },
                { label: 'total from this layer', value: String(d.organs.length) }];
      }
    }],
    addReadouts(S) {
      const d = DERIV.find(x => x.layer === S.p.layer);
      return d ? [{ label: d.layer + ' forms', value: d.organs.slice(0, 4).join(', '), unit: '',
        flag: 'accent', hint: d.organs.slice(4).join(', ') }] : [];
    }
  });

  /* ---------------- larva versus adult in the chordates ---------------- */
  const LIFE = [
    { id: 'uro-l', name: 'Urochordate larva', hue: '#B07CC6',
      c: { notochord: 1, nerve: 1, gill: 1, tail: 1 }, note: 'Free-swimming tadpole — a complete chordate' },
    { id: 'uro-a', name: 'Urochordate adult', hue: '#8A5FA0',
      c: { notochord: 0, nerve: 0, gill: 1, tail: 0 }, note: 'Sessile; retrogressive metamorphosis' },
    { id: 'amp-l', name: 'Amphibian larva', hue: '#6FAE6F',
      c: { notochord: 1, nerve: 1, gill: 1, tail: 1 }, note: 'Tadpole — gills and tail present' },
    { id: 'amp-a', name: 'Amphibian adult', hue: '#4F8C4F',
      c: { notochord: 0, nerve: 1, gill: 0, tail: 0 }, note: 'Lungs and limbs; tail and gills lost' },
    { id: 'ceph', name: 'Cephalochordate', hue: '#8B9BE8',
      c: { notochord: 1, nerve: 1, gill: 1, tail: 1 }, note: 'All four kept for life' }
  ];
  const FOUR = [['notochord', 'Notochord'], ['nerve', 'Nerve cord'], ['gill', 'Gill slits'], ['tail', 'Post-anal tail']];

  L.extend('ak-chordata', {
    addPlots: [{
      title: 'Larva against adult — where the chordate characters are lost',
      legend: [{ c: '#4ADE80', label: 'present' }, { c: '#3A4766', label: 'lost / absent' }],
      draw(S, g) {
        const ctx = g.ctx;
        const P = g.Plot({
          xmin: -0.5, xmax: FOUR.length - 0.5, ymin: -0.5, ymax: LIFE.length - 0.5,
          xticks: FOUR.map((_, i) => i), yticks: LIFE.map((_, i) => i),
          xfmt: v => (FOUR[Math.round(v)] || ['', ''])[1],
          yfmt: v => (LIFE[Math.round(v)] || { name: '' }).name,
          pad: { l: 128, r: 14, t: 12, b: 34 }
        }).frame();
        const cw = (P.x1 - P.x0) / FOUR.length, chh = (P.y0 - P.y1) / LIFE.length;
        P.clip(() => {
          LIFE.forEach((t, r) => FOUR.forEach((c, k) => {
            const on = t.c[c[0]] === 1;
            const x = P.X(k) - cw / 2 + 1, y = P.Y(r) - chh / 2 + 1;
            ctx.fillStyle = g.alpha(on ? '#4ADE80' : '#3A4766', on ? .85 : .4);
            ctx.fillRect(x, y, cw - 2, chh - 2);
            ctx.font = '600 11px "IBM Plex Mono",monospace';
            ctx.fillStyle = on ? '#0B111E' : g.alpha(g.theme['text-3'], .85);
            ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
            ctx.fillText(on ? '✓' : '—', P.X(k), P.Y(r));
          }));
        });
      },
      hover(S, x, y) {
        const k = clamp(Math.round(x), 0, FOUR.length - 1);
        const r = clamp(Math.round(y), 0, LIFE.length - 1);
        return [{ label: 'stage', value: LIFE[r].name, color: LIFE[r].hue },
                { label: FOUR[k][1], value: LIFE[r].c[FOUR[k][0]] ? 'present' : 'absent' },
                { label: 'note', value: LIFE[r].note }];
      }
    }]
  });

  /* ---------------- symmetry: what the fold number predicts ---------------- */
  L.extend('ak-symmetry', {
    addReadouts(S) {
      if (S.p.form !== 'custom') return [];
      const n = clamp(Math.round(S.p.lobes), 1, 9);
      return [{ label: 'Predicted planes', value: String(n), unit: '', flag: 'accent',
        hint: 'an n-fold radial body has exactly n planes' },
        { label: 'Matches the scan', value: S.nPlanes === n ? 'Yes' : 'No', unit: '',
          flag: S.nPlanes === n ? 'ok' : 'warn' }];
    }
  });

  /* ---------------- canal system: what many oscula cost ---------------- */
  L.extend('ak-canal', {
    addReadouts(S) {
      return [{ label: 'Oscula', value: String(S.p.oscula || 1), unit: '',
        hint: (S.p.oscula || 1) > 1 ? 'more exits ⇒ slower, gentler jet' : 'a single high-speed chimney' }];
    }
  });
})(window.InsightLab, window.ANIMALIA);
