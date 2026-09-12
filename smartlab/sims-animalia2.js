/* ============================================================
   ANIMAL KINGDOM — 3. Germ layers & the body cavity
                    4. Sponge canal systems (flow simulation)
   ============================================================ */
(function (L, A, ART) {
  'use strict';
  const { clamp, TAU, fmt, E } = L;
  const { PHYLA } = A;

  const ECTO = '#5AA9FF', MESO = '#E8685B', ENDO = '#E8B64C', CAVITY = '#0B111E';

  /* =========================================================================
     3 · GERM LAYERS AND THE BODY CAVITY
     ========================================================================= */
  const PLANS = [
    { id: 'diplo', name: 'Diploblastic', layers: 2, cavity: 'none',
      lining: 'Mesoglea only — a non-cellular jelly, not a germ layer',
      phyla: ['Coelenterata', 'Ctenophora'], example: 'Hydra, Aurelia, Pleurobrachia' },
    { id: 'acoelo', name: 'Acoelomate', layers: 3, cavity: 'none',
      lining: 'Mesoderm fills the space solidly — there is no cavity at all',
      phyla: ['Platyhelminthes'], example: 'Planaria, Taenia, Fasciola' },
    { id: 'pseudo', name: 'Pseudocoelomate', layers: 3, cavity: 'false coelom',
      lining: 'Cavity is NOT lined by mesoderm on both sides — mesoderm lies only under the ectoderm',
      phyla: ['Aschelminthes'], example: 'Ascaris, Wuchereria, Ancylostoma' },
    { id: 'coelo', name: 'Coelomate', layers: 3, cavity: 'true coelom',
      lining: 'Cavity is completely lined by mesoderm (peritoneum) on both surfaces',
      phyla: ['Annelida', 'Arthropoda', 'Mollusca', 'Echinodermata', 'Hemichordata', 'Chordata'],
      example: 'Pheretima, Apis, Pila, Asterias, Balanoglossus, Columba' }
  ];
  const STAGES = [
    { u: 0.00, name: 'Zygote', note: 'A single fertilised cell' },
    { u: 0.16, name: 'Morula', note: 'Solid ball of cells after repeated cleavage' },
    { u: 0.34, name: 'Blastula', note: 'Hollow ball — the cavity is the blastocoel' },
    { u: 0.54, name: 'Gastrula', note: 'Invagination forms the archenteron and the blastopore' },
    { u: 0.74, name: 'Mesoderm', note: 'The third germ layer appears between the other two' },
    { u: 0.90, name: 'Body cavity', note: 'The adult body plan is established' }
  ];

  L.register({
    id: 'ak-coelom', subject: 'biology',
    name: 'Germ Layers and the Body Cavity',
    chapter: 'Animal Kingdom',
    exams: ['NEET UG'],
    weight: 'Very high yield',
    is3D: false,
    stageHint: 'Drag the development slider — the adult body plan is decided in these few steps',
    lede: 'Two questions decide where an animal sits in the kingdom: <b>how many germ layers</b> does the embryo ' +
      'make, and <b>what happens to the space</b> between the gut and the body wall? ' +
      'This lab runs the cross-section from zygote to adult body plan, and shows why a pseudocoelom is a ' +
      'genuinely different thing from a true coelom rather than just a smaller one.',

    params: { plan: 'coelo', origin: 'schizo', stage: 1.0, auto: false, labels: true },

    presets: PLANS.map(pl => ({ name: pl.name, params: { plan: pl.id, stage: 1.0 } })).concat([
      { name: 'Schizocoely (protostome)', params: { plan: 'coelo', origin: 'schizo', stage: 1.0 } },
      { name: 'Enterocoely (deuterostome)', params: { plan: 'coelo', origin: 'entero', stage: 1.0 } }
    ]),

    controls: [
      { group: 'Body plan', items: [
        { key: 'plan', type: 'select', label: 'Grade', restructure: true,
          options: PLANS.map(pl => ({ value: pl.id, label: pl.name.replace('blastic', '.').replace('coelomate', 'coel.') })) },
        { key: 'origin', type: 'select', label: 'Origin of the coelom', restructure: true,
          options: [{ value: 'schizo', label: 'Schizocoelous' }, { value: 'entero', label: 'Enterocoelous' }] }
      ] },
      { group: 'Development', items: [
        { key: 'stage', label: 'Developmental progress', min: 0, max: 1, step: 0.005, unit: '',
          fmt: v => (v * 100).toFixed(0) + '%' },
        { key: 'auto', type: 'toggle', label: 'Run development automatically' },
        { key: 'labels', type: 'toggle', label: 'Show labels' }
      ] }
    ],

    setup(S) {
      S.plan = PLANS.find(p => p.id === S.p.plan) || PLANS[3];
      S.stageIdx = 0;
      S.dir = 1;
    },

    step(S, dt) {
      S.t = (S.t || 0) + dt;
      if (S.p.auto) {
        S.p.stage += dt * 0.16 * S.dir;
        if (S.p.stage > 1) { S.p.stage = 1; S.dir = -1; }
        if (S.p.stage < 0) { S.p.stage = 0; S.dir = 1; }
      }
      const u = S.p.stage;
      let idx = 0;
      STAGES.forEach((st, i) => { if (u >= st.u) idx = i; });
      S.stageIdx = idx;
    },

    drawStage(S, g) {
      const ctx = g.ctx, th = g.theme, p = S.p, W = g.w, H = g.h;
      const u = p.stage, plan = S.plan;
      const cx = W * 0.40, cy = H * 0.54;
      const R = Math.min(W * 0.20, H * 0.34);
      const tri = plan.layers === 3;

      const ring = (r0, r1, col, a) => {
        ctx.beginPath();
        ctx.arc(cx, cy, r1, 0, TAU);
        ctx.arc(cx, cy, r0, 0, TAU, true);
        ctx.fillStyle = g.alpha(col, a == null ? 1 : a);
        ctx.fill('evenodd');
      };

      /* ---------- stage 0–0.16 : zygote & cleavage ---------- */
      if (u < 0.16) {
        const n = u < 0.05 ? 1 : u < 0.10 ? 2 : u < 0.14 ? 4 : 8;
        for (let i = 0; i < n; i++) {
          const a = i / n * TAU + S.t * 0.2;
          const rr = n === 1 ? 0 : R * 0.42;
          const cr = R * (n === 1 ? 0.78 : 0.42 / Math.sqrt(n) * 1.6);
          const x = cx + Math.cos(a) * rr, y = cy + Math.sin(a) * rr;
          const gr = ctx.createRadialGradient(x - cr * .3, y - cr * .3, cr * .1, x, y, cr);
          gr.addColorStop(0, g.mix(ECTO, '#ffffff', .5)); gr.addColorStop(1, g.mix(ECTO, '#05080F', .35));
          ctx.fillStyle = gr; ctx.beginPath(); ctx.arc(x, y, cr, 0, TAU); ctx.fill();
          ctx.strokeStyle = g.alpha('#05080F', .4); ctx.lineWidth = 1; ctx.stroke();
        }
      }
      /* ---------- 0.16–0.34 : morula → blastula ---------- */
      else if (u < 0.54) {
        const t = clamp((u - 0.16) / 0.38, 0, 1);
        const inner = R * 0.62 * t;
        ring(inner, R * 0.92, ECTO);
        if (t > 0.1) {
          ctx.fillStyle = CAVITY; ctx.beginPath(); ctx.arc(cx, cy, inner, 0, TAU); ctx.fill();
          if (p.labels && t > 0.4) label(ctx, th, cx, cy, 'blastocoel', th['text-2']);
        }
        // cell boundaries on the rim
        ctx.strokeStyle = g.alpha('#05080F', .3); ctx.lineWidth = 1;
        for (let i = 0; i < 26; i++) {
          const a = i / 26 * TAU;
          ctx.beginPath();
          ctx.moveTo(cx + Math.cos(a) * inner, cy + Math.sin(a) * inner);
          ctx.lineTo(cx + Math.cos(a) * R * 0.92, cy + Math.sin(a) * R * 0.92);
          ctx.stroke();
        }
      }
      /* ---------- 0.54 onwards : gastrula, mesoderm, cavity ---------- */
      else {
        const gt = clamp((u - 0.54) / 0.20, 0, 1);          // invagination
        const mt = clamp((u - 0.74) / 0.16, 0, 1);          // mesoderm
        const ct = clamp((u - 0.88) / 0.12, 0, 1);          // cavity

        // outer ectoderm
        ring(R * 0.80, R * 0.95, ECTO);
        // blastocoel space
        ctx.fillStyle = CAVITY; ctx.beginPath(); ctx.arc(cx, cy, R * 0.80, 0, TAU); ctx.fill();

        // endoderm — invaginating archenteron, shown as an inner tube
        const gutR = R * (0.46 - 0.16 * gt) + R * 0.16;
        const depth = gt;
        ctx.save();
        ctx.beginPath(); ctx.arc(cx, cy, R * 0.80, 0, TAU); ctx.clip();
        ctx.fillStyle = ENDO;
        if (depth < 1) {
          // a pouch pushing in from the vegetal pole
          ctx.beginPath();
          ctx.moveTo(cx - R * 0.42, cy + R * 0.78);
          ctx.quadraticCurveTo(cx, cy + R * (0.78 - 1.5 * depth), cx + R * 0.42, cy + R * 0.78);
          ctx.lineTo(cx + R * 0.52, cy + R * 0.9);
          ctx.lineTo(cx - R * 0.52, cy + R * 0.9);
          ctx.closePath(); ctx.fill();
        } else {
          ring(gutR * 0.62, gutR * 0.80, ENDO);
          ctx.fillStyle = CAVITY;
          ctx.beginPath(); ctx.arc(cx, cy, gutR * 0.62, 0, TAU); ctx.fill();
        }
        ctx.restore();

        if (gt >= 1) {
          ring(gutR * 0.62, gutR * 0.80, ENDO);
          ctx.fillStyle = CAVITY;
          ctx.beginPath(); ctx.arc(cx, cy, gutR * 0.62, 0, TAU); ctx.fill();
        }

        /* --- the third layer and the cavity --- */
        if (!tri) {
          // diploblastic: mesoglea between the two layers
          ring(gutR * 0.80, R * 0.80, '#7A6E8C', 0.35 * Math.max(gt, 0));
          if (p.labels && gt > 0.6) label(ctx, th, cx, cy - R * 0.62, 'mesoglea', '#B9AFC9');
        } else if (mt > 0) {
          if (plan.id === 'acoelo') {
            ring(gutR * 0.80, R * 0.80, MESO, mt);
            if (p.labels && mt > 0.6) label(ctx, th, cx, cy - R * 0.62, 'solid mesoderm — no cavity', MESO);
          } else if (plan.id === 'pseudo') {
            // mesoderm only beneath the ectoderm; the cavity has no inner lining
            ring(R * 0.66, R * 0.80, MESO, mt);
            if (ct > 0 && p.labels)
              label(ctx, th, cx, cy - R * 0.52, 'pseudocoelom — unlined', th['text-2']);
          } else {
            // coelomate: mesoderm on BOTH surfaces, cavity between
            if (p.origin === 'entero' && mt < 1) {
              // enterocoely — pouches budding off the archenteron
              ctx.fillStyle = g.alpha(MESO, .95);
              [-1, 1].forEach(sg => {
                ctx.beginPath();
                ctx.ellipse(cx + sg * gutR * 0.95, cy, gutR * 0.26 * mt, gutR * 0.4 * mt, 0, 0, TAU);
                ctx.fill();
              });
              if (p.labels) label(ctx, th, cx, cy - R * 0.62, 'enterocoely — pouches from the gut', MESO);
            } else if (p.origin === 'schizo' && mt < 1) {
              // schizocoely — a solid mass that splits
              ring(gutR * 0.80, R * 0.80, MESO, 1);
              ctx.strokeStyle = g.alpha(CAVITY, mt); ctx.lineWidth = R * 0.06 * mt;
              ctx.beginPath(); ctx.arc(cx, cy, (gutR * 0.80 + R * 0.80) / 2, 0, TAU); ctx.stroke();
              if (p.labels) label(ctx, th, cx, cy - R * 0.62, 'schizocoely — the mass splits', MESO);
            } else {
              const mid = (gutR * 0.80 + R * 0.80) / 2;
              ring(gutR * 0.80, mid - R * 0.07 * ct, MESO);     // visceral peritoneum
              ring(mid + R * 0.07 * ct, R * 0.80, MESO);        // parietal peritoneum
              if (p.labels && ct > 0.5) {
                label(ctx, th, cx, cy - mid, 'true coelom', th.text);
                label(ctx, th, cx + mid * 0.72, cy + mid * 0.72, 'peritoneum', MESO);
              }
            }
          }
        }

        if (p.labels && gt > 0.5) {
          label(ctx, th, cx, cy + R * 1.12, 'blastopore', ENDO);
          label(ctx, th, cx - R * 1.18, cy - R * 0.5, 'ectoderm', ECTO);
          if (gt >= 1) label(ctx, th, cx, cy, 'archenteron', ENDO);
        }
      }

      /* ---------- developmental timeline ---------- */
      const tx0 = 14, tx1 = W - 14, ty = H - 26;
      ctx.strokeStyle = g.alpha(th['line-soft'], 1); ctx.lineWidth = 2;
      ctx.beginPath(); ctx.moveTo(tx0, ty); ctx.lineTo(tx1, ty); ctx.stroke();
      ctx.strokeStyle = g.alpha(th.bio, .9);
      ctx.beginPath(); ctx.moveTo(tx0, ty); ctx.lineTo(tx0 + u * (tx1 - tx0), ty); ctx.stroke();
      STAGES.forEach((st, i) => {
        const x = tx0 + st.u * (tx1 - tx0);
        const on = i <= S.stageIdx;
        ctx.fillStyle = on ? th.bio : g.alpha(th['text-3'], .6);
        ctx.beginPath(); ctx.arc(x, ty, on ? 4 : 3, 0, TAU); ctx.fill();
        ctx.font = (on ? '600 ' : '400 ') + '9px "IBM Plex Mono",monospace';
        ctx.fillStyle = on ? th.text : th['text-3'];
        ctx.textAlign = i === STAGES.length - 1 ? 'right' : 'left'; ctx.textBaseline = 'bottom';
        ctx.fillText(st.name, i === STAGES.length - 1 ? tx1 : x, ty - 8);
      });

      /* ---------- header ---------- */
      ctx.textAlign = 'left'; ctx.textBaseline = 'top';
      ctx.font = '700 19px "IBM Plex Sans Condensed",sans-serif'; ctx.fillStyle = th.text;
      ctx.fillText(plan.name, 14, 10);
      ctx.font = '500 10.5px "IBM Plex Mono",monospace'; ctx.fillStyle = th['text-3'];
      ctx.fillText(STAGES[S.stageIdx].name + ' — ' + STAGES[S.stageIdx].note, 14, 32);

      /* ---------- germ-layer key ---------- */
      const kx = W - 150, ky = 14;
      [['Ectoderm', ECTO, 'skin, nervous system'],
       ['Mesoderm', MESO, 'muscle, skeleton, blood'],
       ['Endoderm', ENDO, 'gut lining, liver, lungs']].forEach((row, i) => {
        if (!tri && i === 1) return;
        ctx.fillStyle = row[1];
        ctx.fillRect(kx, ky + i * 26, 10, 10);
        ctx.font = '600 10px "IBM Plex Mono",monospace'; ctx.fillStyle = th.text;
        ctx.textAlign = 'left'; ctx.textBaseline = 'top';
        ctx.fillText(row[0], kx + 15, ky + i * 26);
        ctx.font = '9px "IBM Plex Mono",monospace'; ctx.fillStyle = th['text-3'];
        ctx.fillText(row[2], kx + 15, ky + i * 26 + 12);
      });
    },

    plots: [
      { title: 'How the eleven phyla divide by body cavity',
        legend: [{ c: '#63729A', label: 'no cavity' }, { c: '#E8B64C', label: 'pseudocoelom' },
                 { c: '#4ADE80', label: 'true coelom' }],
        draw(S, g) {
          const types = ['none', 'acoelomate', 'pseudocoelomate', 'coelomate'];
          const cols = { none: '#63729A', acoelomate: '#8B7BE8', pseudocoelomate: '#E8B64C', coelomate: '#4ADE80' };
          const groups = types.map(t => PHYLA.filter(p => p.coelom === t));
          const P = g.Plot({
            xmin: -0.5, xmax: 3.5, ymin: 0, ymax: 7.6,
            xticks: [0, 1, 2, 3], xfmt: v => (types[Math.round(v)] || '').replace('coelomate', 'coel.'),
            ylabel: 'number of phyla', yfmt: v => v.toFixed(0),
            pad: { l: 46, r: 14, t: 14, b: 34 }
          }).frame();
          P.clip(() => {
            groups.forEach((list, i) => {
              P.bar(i, list.length, 0.3, 0, g.alpha(cols[types[i]], .9));
              P.tag(i, list.length, String(list.length), g.theme.text, 'left', -9);
              list.forEach((ph, k) => P.tag(i, list.length - 0.5 - k * 0.55, ph.name, g.theme['text-3'], 'left', 0));
            });
          });
        },
        hover(S, x) {
          const types = ['none', 'acoelomate', 'pseudocoelomate', 'coelomate'];
          const t = types[clamp(Math.round(x), 0, 3)];
          const list = PHYLA.filter(p => p.coelom === t);
          return [{ label: 'cavity', value: t }, { label: 'phyla', value: String(list.length) },
                  { label: 'which', value: list.map(p => p.name).join(', ') || '—' }];
        } },
      { title: 'Protostome and deuterostome — two routes to a coelom',
        legend: [{ c: '#E8685B', label: 'protostome (schizocoely)' },
                 { c: '#5AA9FF', label: 'deuterostome (enterocoely)' }],
        draw(S, g) {
          const rows = [
            ['Blastopore becomes', 'the mouth', 'the anus'],
            ['Coelom forms by', 'splitting mesoderm', 'gut pouches'],
            ['Cleavage', 'spiral, determinate', 'radial, indeterminate'],
            ['Examples', 'Annelida, Arthropoda, Mollusca', 'Echinodermata, Hemichordata, Chordata']
          ];
          const P = g.Plot({
            xmin: 0, xmax: 1, ymin: -0.5, ymax: rows.length - 0.5,
            xticks: [], yticks: rows.map((_, i) => i),
            yfmt: v => (rows[Math.round(v)] || [''])[0],
            pad: { l: 122, r: 14, t: 26, b: 14 }
          }).frame();
          const ctx = g.ctx;
          const isSchizo = S.p.origin === 'schizo' && S.p.plan === 'coelo';
          const isEntero = S.p.origin === 'entero' && S.p.plan === 'coelo';
          ctx.font = '600 10px "IBM Plex Mono",monospace';
          ctx.textAlign = 'center'; ctx.textBaseline = 'bottom';
          ctx.fillStyle = isSchizo ? '#E8685B' : g.alpha('#E8685B', .6);
          ctx.fillText('PROTOSTOME', P.X(0.27), P.y1 - 6);
          ctx.fillStyle = isEntero ? '#5AA9FF' : g.alpha('#5AA9FF', .6);
          ctx.fillText('DEUTEROSTOME', P.X(0.74), P.y1 - 6);
          P.clip(() => {
            rows.forEach((r, i) => {
              [[0.27, r[1], '#E8685B', isSchizo], [0.74, r[2], '#5AA9FF', isEntero]].forEach(([x, txt, c, on]) => {
                const w = (P.x1 - P.x0) * 0.44, h = (P.y0 - P.y1) / rows.length - 6;
                ctx.fillStyle = g.alpha(c, on ? .2 : .07);
                ctx.fillRect(P.X(x) - w / 2, P.Y(i) - h / 2, w, h);
                ctx.font = (on ? '600 ' : '400 ') + '10px "IBM Plex Sans",sans-serif';
                ctx.fillStyle = on ? g.theme.text : g.theme['text-2'];
                ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
                wrapText(ctx, txt, P.X(x), P.Y(i), w - 10, 12);
              });
            });
          });
        } }
    ],

    readouts(S) {
      const plan = S.plan, st = STAGES[S.stageIdx];
      return [
        { label: 'Grade', value: plan.name, unit: '', flag: 'accent' },
        { label: 'Germ layers', value: String(plan.layers), unit: '',
          hint: plan.layers === 2 ? 'ectoderm + endoderm' : 'ectoderm + mesoderm + endoderm' },
        { label: 'Body cavity', value: plan.cavity === 'none' ? 'Absent' : plan.cavity, unit: '',
          flag: plan.cavity === 'true coelom' ? 'ok' : plan.cavity === 'false coelom' ? 'warn' : '' },
        { label: 'Lining', value: plan.lining, unit: '' },
        { label: 'Phyla', value: plan.phyla.join(', '), unit: '' },
        { label: 'Examples', value: plan.example, unit: '' },
        { label: 'Current stage', value: st.name, unit: '', hint: st.note },
        { label: 'Coelom origin', value: plan.id === 'coelo'
          ? (S.p.origin === 'schizo' ? 'Schizocoelous' : 'Enterocoelous') : '—', unit: '',
          hint: plan.id === 'coelo' ? (S.p.origin === 'schizo' ? 'protostomes' : 'deuterostomes') : '' }
      ];
    },

    equation(S) {
      const plan = S.plan;
      return 'ectoderm ' + E.op('+') + ' endoderm' +
        (plan.layers === 3 ? ' ' + E.op('+') + ' mesoderm' : ' (mesoglea between)') +
        ' ' + E.op('→') + ' ' + E.n(plan.layers, ' germ layers') +
        '<br>cavity lined by mesoderm on <b>both</b> sides ' + E.op('→') + ' true coelom' +
        E.op('·') + ' on one side only ' + E.op('→') + ' pseudocoelom' +
        E.op('·') + ' not at all ' + E.op('→') + ' acoelomate' +
        '<br>' + E.n(plan.name, '') + ' ' + E.op('→') + ' ' + E.n(plan.phyla.length, ' phylum/phyla') +
        E.op(':') + ' ' + E.n(plan.phyla.join(', '), '');
    },
    eqNote: '<b>Mesoderm is the turning point of animal evolution.</b> It is the layer that makes real muscle, ' +
      'a skeleton, blood and a body cavity possible. Everything below it in complexity — sponges, cnidarians, ' +
      'comb jellies — is limited to a thin, diffusion-dependent body because it never evolved a third layer.',

    walkthrough: [
      { title: '1 · From one cell to a hollow ball',
        body: 'Run development from the start and stop at the blastula.',
        ask: 'What is the cavity inside a blastula called, and is it the coelom?',
        reveal: 'It is the <b>blastocoel</b>, and it is <b>not</b> the coelom. The blastocoel is a temporary embryonic space. In pseudocoelomates it persists as the body cavity, which is exactly why that cavity has no mesodermal lining.',
        params: { plan: 'coelo', stage: 0.4, auto: false } },
      { title: '2 · Gastrulation makes the gut',
        body: 'Advance to the gastrula and watch the pouch push inwards.',
        ask: 'What becomes of the opening left by the invagination?',
        reveal: 'That opening is the <b>blastopore</b>. In protostomes it becomes the <b>mouth</b>; in deuterostomes it becomes the <b>anus</b>. The word protostome literally means "first mouth". This single embryonic detail splits the coelomates into two great lineages.',
        params: { plan: 'coelo', stage: 0.62 } },
      { title: '3 · Two layers only',
        body: 'Switch to the diploblastic plan.',
        ask: 'Cnidarians have a jelly layer between ectoderm and endoderm. Does that count as mesoderm?',
        reveal: '<b>No.</b> The <b>mesoglea</b> is a non-cellular jelly, not a germ layer. Because there is no true mesoderm, cnidarians have no true muscle tissue, no blood and no body cavity — and every cell must stay within diffusion distance of water.',
        params: { plan: 'diplo', stage: 1.0 } },
      { title: '4 · Solid, unlined, or fully lined',
        body: 'Step through acoelomate, pseudocoelomate and coelomate and watch the region between gut and body wall.',
        ask: 'What exactly distinguishes a pseudocoelom from a true coelom?',
        reveal: 'The <b>lining</b>, not the size. In a pseudocoelomate the mesoderm lies only beneath the ectoderm, so the cavity touches unlined gut on its inner surface. In a coelomate the mesoderm wraps both surfaces as <b>peritoneum</b>, which is what lets organs be suspended, cushioned and moved independently of the body wall.',
        params: { plan: 'pseudo', stage: 1.0 } },
      { title: '5 · Two ways to make a coelom',
        body: 'With the coelomate plan selected, switch the origin between schizocoelous and enterocoelous.',
        ask: 'Which phyla use each route?',
        reveal: '<b>Schizocoely</b> — a solid block of mesoderm splits. Protostomes: Annelida, Arthropoda, Mollusca. <b>Enterocoely</b> — pouches bud off the archenteron. Deuterostomes: Echinodermata, Hemichordata, Chordata. The second chart lays out the full contrast.',
        params: { plan: 'coelo', origin: 'entero', stage: 0.82 } }
    ],

    quiz: [
      { q: 'The body cavity of Ascaris is described as a pseudocoelom because it is:',
        options: ['very small', 'filled with fluid', 'not lined by mesoderm on both sides', 'formed from the archenteron'], answer: 2,
        why: 'A true coelom must be lined by mesoderm on both surfaces. In roundworms the mesoderm lies only beneath the ectoderm.' },
      { q: 'The mesoglea of a jellyfish is:',
        options: ['a third germ layer', 'a non-cellular jelly between two germ layers',
                  'the body cavity', 'the gastrovascular cavity'], answer: 1,
        why: 'Mesoglea is acellular jelly. Cnidarians remain diploblastic — they have no true mesoderm.' },
      { q: 'In protostomes, the blastopore develops into the:',
        options: ['anus', 'mouth', 'coelom', 'notochord'], answer: 1,
        why: 'Protostome means "first mouth" — the blastopore becomes the mouth, and the anus forms later.' },
      { q: 'Enterocoelous coelom formation occurs in:',
        options: ['Annelida', 'Arthropoda', 'Mollusca', 'Echinodermata'], answer: 3,
        why: 'Deuterostomes — echinoderms, hemichordates and chordates — form the coelom from pouches of the embryonic gut.' },
      { q: 'Which germ layer gives rise to muscles, blood and the skeleton?',
        options: ['Ectoderm', 'Mesoderm', 'Endoderm', 'Mesoglea'], answer: 1,
        why: 'Mesoderm forms muscle, skeleton, blood, kidney and the lining of the coelom.' }
    ],

    notes: '<b>Where this shows up in the paper.</b>' +
      '<ul><li>Acoelomate / pseudocoelomate / coelomate with examples — appears in almost every year\'s paper.</li>' +
      '<li>Diploblastic vs triploblastic, and what mesoglea actually is.</li>' +
      '<li>Protostome vs deuterostome: blastopore fate, cleavage type, coelom origin.</li>' +
      '<li>Germ layer derivatives — which layer makes which organ.</li></ul>' +
      '<div class="pyq"><em>Trap to avoid</em>The blastocoel is <b>not</b> the coelom. It is an embryonic ' +
      'cavity present in every animal that makes a blastula, including acoelomates — where it is later obliterated ' +
      'by mesoderm.</div>'
  });

  function label(ctx, th, x, y, text, col) {
    ctx.font = '600 9.5px "IBM Plex Mono",monospace';
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.lineWidth = 3; ctx.strokeStyle = 'rgba(5,8,15,.8)';
    ctx.strokeText(text, x, y);
    ctx.fillStyle = col; ctx.fillText(text, x, y);
  }
  function wrapText(ctx, text, x, y, maxW, lh) {
    const words = String(text).split(' ');
    const lines = []; let cur = '';
    words.forEach(w => {
      const t = cur ? cur + ' ' + w : w;
      if (ctx.measureText(t).width > maxW && cur) { lines.push(cur); cur = w; } else cur = t;
    });
    if (cur) lines.push(cur);
    lines.forEach((ln, i) => ctx.fillText(ln, x, y + (i - (lines.length - 1) / 2) * lh));
  }

  /* =========================================================================
     4 · SPONGE CANAL SYSTEMS — a real flow calculation
     Baseline figures are the classic Leuconia numbers: water enters
     81,000 incurrent canals at ~0.1 cm/s, slows almost to a stop in the
     flagellated chambers so food can be caught, then leaves the single
     osculum at ~8.5 cm/s.
     ========================================================================= */
  const CANAL = [
    { id: 'ascon', name: 'Asconoid', shape: 'Simple vase, choanocytes line the spongocoel',
      chambers: 1, choanoDensity: 2.2e4, example: 'Leucosolenia', eff: 1 },
    { id: 'sycon', name: 'Syconoid', shape: 'Body wall folded into radial canals',
      chambers: 2.2e3, choanoDensity: 2.8e5, example: 'Sycon (Scypha)', eff: 2 },
    { id: 'leucon', name: 'Leuconoid', shape: 'Many small flagellated chambers in a mesh of canals',
      chambers: 2.25e6, choanoDensity: 4.3e6, example: 'Spongilla, Euspongia', eff: 3 }
  ];

  L.register({
    id: 'ak-canal', subject: 'biology',
    name: 'Sponge Canal Systems — Following the Water',
    chapter: 'Animal Kingdom',
    exams: ['NEET UG'],
    weight: 'High yield',
    is3D: false,
    stageHint: 'Watch the particles: they crawl through the chambers and then fire out of the osculum',
    lede: 'A sponge has no mouth, no gut, no muscles and no nerves. It feeds by <b>pumping water through itself</b> — ' +
      'and the whole of its body architecture is a solution to one fluid-mechanics problem. ' +
      'Water must move <b>slowly</b> past the collar cells so food can be caught, yet leave <b>fast</b> enough that ' +
      'waste is carried clear. This lab computes the velocity at every stage from continuity, Q = A·v.',

    params: { type: 'leucon', size: 5, beat: 20, rOstia: 25, rOsc: 1.0, oscula: 1, particles: true },

    presets: [
      { name: 'Leuconia (textbook figures)', params: { type: 'leucon', size: 5, beat: 20, rOstia: 25, rOsc: 1.0 } },
      { name: 'Asconoid — simplest', params: { type: 'ascon', size: 5, beat: 20, rOstia: 25, rOsc: 1.0 } },
      { name: 'Syconoid — folded wall', params: { type: 'sycon', size: 5, beat: 20, rOstia: 25, rOsc: 1.0 } },
      { name: 'Narrow osculum', params: { type: 'leucon', size: 5, beat: 20, rOstia: 25, rOsc: 0.45 } },
      { name: 'Cold water — slow flagella', params: { type: 'leucon', size: 5, beat: 7, rOstia: 25, rOsc: 1.0 } }
    ],

    controls: [
      { group: 'Sponge', items: [
        { key: 'type', type: 'select', label: 'Canal system', restructure: true,
          options: CANAL.map(c => ({ value: c.id, label: c.name.replace('oid', '') })) },
        { key: 'size', label: 'Body length', min: 1, max: 15, step: 0.5, unit: 'cm',
          fmt: v => v.toFixed(1), restructure: true }
      ] },
      { group: 'Plumbing', items: [
        { key: 'rOstia', label: 'Ostium radius', min: 8, max: 60, step: 1, unit: 'µm',
          fmt: v => v.toFixed(0), restructure: true },
        { key: 'rOsc', label: 'Osculum radius', min: 0.2, max: 3, step: 0.05, unit: 'mm',
          fmt: v => v.toFixed(2), restructure: true },
        { key: 'oscula', label: 'Number of oscula', min: 1, max: 12, step: 1, unit: '',
          fmt: v => v.toFixed(0), restructure: true }
      ] },
      { group: 'Choanocytes', items: [
        { key: 'beat', label: 'Flagellar beat frequency', min: 2, max: 40, step: 0.5, unit: 'Hz',
          fmt: v => v.toFixed(1), restructure: true },
        { key: 'particles', type: 'toggle', label: 'Show water particles' }
      ] }
    ],

    setup(S) {
      const p = S.p;
      const c = CANAL.find(x => x.id === p.type) || CANAL[2];
      S.canal = c;
      const scale = Math.pow(p.size / 5, 3);
      S.volume = 0.15 * Math.pow(p.size, 3);                        // cm³
      S.nChoano = c.choanoDensity * S.volume;
      S.nChambers = Math.max(1, Math.round(c.chambers * scale));
      const qCell = 3.3e-9 * (p.beat / 20);                          // cm³/s per choanocyte
      S.Q = S.nChoano * qCell;                                       // cm³/s

      S.nOstia = Math.round(3240 * Math.pow(p.size, 2));
      const rIn = p.rOstia * 1e-4;                                   // cm
      S.Ain = S.nOstia * Math.PI * rIn * rIn;
      const rCh = 10e-4;
      S.Ach = S.nChambers * Math.PI * rCh * rCh * 40;                // chamber lumen cross-section
      S.Aosc = Math.max(1, p.oscula) * Math.PI * Math.pow(p.rOsc * 0.1, 2);

      S.vIn = S.Q / S.Ain;
      S.vCh = S.Q / S.Ach;
      S.vOsc = S.Q / S.Aosc;
      S.perDay = S.Q * 86400;                                        // cm³ per day
      S.bodyVol = S.perDay / S.volume;
      S.turnover = S.volume / S.Q;                                   // seconds to filter own volume

      S.parts = [];
      for (let i = 0; i < 90; i++) S.parts.push({ u: Math.random(), lane: Math.random(), j: Math.random() });
    },

    step(S, dt) {
      S.t = (S.t || 0) + dt;
      if (!S.p.particles) return;
      // speed along the path follows the real velocity profile, normalised
      S.parts.forEach(q => {
        const v = pathSpeed(S, q.u);
        q.u += dt * v * 0.32;
        if (q.u > 1) { q.u = 0; q.lane = Math.random(); q.j = Math.random(); }
      });
    },

    drawStage(S, g) {
      const ctx = g.ctx, th = g.theme, p = S.p, W = g.w, H = g.h;
      const c = S.canal;
      const cx = W * 0.40, cyTop = H * 0.16, cyBot = H * 0.86;
      const bodyH = cyBot - cyTop;
      const bodyW = Math.min(W * 0.24, bodyH * 0.55);
      const hue = '#E8A33D';

      /* ---------- sponge body cross-section ---------- */
      const wallOuter = x => bodyW * (0.72 + 0.18 * Math.sin(x * 2.2));
      ctx.beginPath();
      ctx.moveTo(cx - bodyW * 0.55, cyBot);
      ctx.bezierCurveTo(cx - bodyW * 1.0, cyBot - bodyH * .35, cx - bodyW * .92, cyTop + bodyH * .2, cx - bodyW * .6, cyTop);
      ctx.lineTo(cx + bodyW * .6, cyTop);
      ctx.bezierCurveTo(cx + bodyW * .92, cyTop + bodyH * .2, cx + bodyW * 1.0, cyBot - bodyH * .35, cx + bodyW * 0.55, cyBot);
      ctx.closePath();
      const grd = ctx.createLinearGradient(cx - bodyW, 0, cx + bodyW, 0);
      grd.addColorStop(0, g.mix(hue, '#05080F', .55));
      grd.addColorStop(.45, g.mix(hue, '#05080F', .2));
      grd.addColorStop(1, g.mix(hue, '#05080F', .6));
      ctx.fillStyle = grd; ctx.fill();
      ctx.strokeStyle = g.alpha(hue, .85); ctx.lineWidth = 1.5; ctx.stroke();

      // spongocoel
      const scW = bodyW * (c.id === 'ascon' ? 0.46 : c.id === 'sycon' ? 0.34 : 0.22);
      ctx.fillStyle = '#05080F';
      ctx.beginPath();
      ctx.moveTo(cx - scW, cyBot - bodyH * .06);
      ctx.lineTo(cx - scW * .85, cyTop + 2);
      ctx.lineTo(cx + scW * .85, cyTop + 2);
      ctx.lineTo(cx + scW, cyBot - bodyH * .06);
      ctx.closePath(); ctx.fill();

      /* ---------- choanocyte architecture per canal type ---------- */
      ctx.save();
      if (c.id === 'ascon') {
        // choanocytes line the spongocoel itself
        ctx.strokeStyle = g.alpha('#FFD98A', .85); ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.moveTo(cx - scW * .9, cyBot - bodyH * .08); ctx.lineTo(cx - scW * .82, cyTop + 6);
        ctx.moveTo(cx + scW * .9, cyBot - bodyH * .08); ctx.lineTo(cx + scW * .82, cyTop + 6);
        ctx.stroke();
      } else if (c.id === 'sycon') {
        // radial canals, choanocyte-lined
        for (let i = 0; i < 9; i++) {
          const y = cyTop + bodyH * (0.12 + i * 0.085);
          [-1, 1].forEach(sg => {
            ctx.strokeStyle = g.alpha('#FFD98A', .8); ctx.lineWidth = 4;
            ctx.beginPath();
            ctx.moveTo(cx + sg * scW * .95, y);
            ctx.lineTo(cx + sg * bodyW * .74, y + bodyH * .02);
            ctx.stroke();
          });
        }
      } else {
        // leuconoid — a mesh of small flagellated chambers
        for (let i = 0; i < 46; i++) {
          const a = (i * 2.399) % 1, b = ((i * 7) % 13) / 13;
          const sg = i % 2 ? 1 : -1;
          const x = cx + sg * (scW + 6 + b * (bodyW * .72 - scW));
          const y = cyTop + bodyH * (0.08 + a * 0.82);
          ctx.fillStyle = g.alpha('#FFD98A', .5 + .3 * Math.abs(Math.sin(S.t * 3 + i)));
          ctx.beginPath(); ctx.arc(x, y, bodyW * .055, 0, TAU); ctx.fill();
        }
      }
      ctx.restore();

      // ostia on the outer wall
      ctx.fillStyle = g.alpha('#9FD8FF', .8);
      for (let i = 0; i < 22; i++) {
        const t = i / 21;
        const y = cyTop + bodyH * (0.06 + t * 0.86);
        const sg = i % 2 ? 1 : -1;
        ctx.beginPath();
        ctx.arc(cx + sg * bodyW * (0.78 + 0.1 * Math.sin(t * 3)), y, 2.2, 0, TAU);
        ctx.fill();
      }

      // osculum
      const oscR = clamp(p.rOsc * bodyW * 0.5, 4, scW * 1.1);
      ctx.fillStyle = '#05080F';
      ctx.beginPath(); ctx.ellipse(cx, cyTop, oscR, oscR * .38, 0, 0, TAU); ctx.fill();
      ctx.strokeStyle = g.alpha(hue, .95); ctx.lineWidth = 2; ctx.stroke();

      /* ---------- water particles ---------- */
      if (p.particles) {
        S.parts.forEach(q => {
          const pos = pathPoint(S, q, cx, cyTop, cyBot, bodyW, scW, oscR);
          const v = pathSpeed(S, q.u);
          ctx.fillStyle = g.alpha('#9FD8FF', clamp(0.25 + v * 0.5, .25, .95));
          ctx.beginPath(); ctx.arc(pos[0], pos[1], q.u > 0.86 ? 2.6 : 2.0, 0, TAU); ctx.fill();
          if (q.u > 0.86) {                       // motion streak in the fast jet
            ctx.strokeStyle = g.alpha('#9FD8FF', .5); ctx.lineWidth = 1.4;
            ctx.beginPath(); ctx.moveTo(pos[0], pos[1]); ctx.lineTo(pos[0], pos[1] + 9); ctx.stroke();
          }
        });
      }

      /* ---------- velocity call-outs ---------- */
      const call = (x, y, txt, sub, col) => {
        ctx.font = '600 11px "IBM Plex Mono",monospace';
        ctx.fillStyle = col; ctx.textAlign = 'left'; ctx.textBaseline = 'middle';
        ctx.fillText(txt, x, y);
        ctx.font = '9px "IBM Plex Mono",monospace'; ctx.fillStyle = th['text-3'];
        ctx.fillText(sub, x, y + 12);
      };
      ctx.strokeStyle = g.alpha(th['text-3'], .5); ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(cx + bodyW * .9, cyBot - bodyH * .18); ctx.lineTo(W * 0.70, cyBot - bodyH * .18);
      ctx.moveTo(cx + scW + 8, cyTop + bodyH * .45); ctx.lineTo(W * 0.70, cyTop + bodyH * .45);
      ctx.moveTo(cx + oscR, cyTop); ctx.lineTo(W * 0.70, cyTop + 6);
      ctx.stroke();
      call(W * 0.71, cyBot - bodyH * .18, S.vIn.toFixed(3) + ' cm/s', 'through ' +
        fmt(S.nOstia, 3) + ' ostia', '#9FD8FF');
      call(W * 0.71, cyTop + bodyH * .45, S.vCh.toFixed(4) + ' cm/s',
        'in the flagellated chambers — slowest', th.ok);
      call(W * 0.71, cyTop + 6, S.vOsc.toFixed(2) + ' cm/s', 'out of the osculum — fastest', th.warn);

      /* ---------- header ---------- */
      ctx.textAlign = 'left'; ctx.textBaseline = 'top';
      ctx.font = '700 19px "IBM Plex Sans Condensed",sans-serif'; ctx.fillStyle = th.text;
      ctx.fillText(c.name + '  ·  ' + c.example, 14, 10);
      ctx.font = '500 10px "IBM Plex Mono",monospace'; ctx.fillStyle = th['text-3'];
      ctx.fillText(c.shape, 14, 32);
      ctx.fillStyle = th.bio;
      ctx.fillText('filters its own volume every ' + S.turnover.toFixed(1) + ' s  ·  ' +
        fmt(S.bodyVol, 3) + ' body volumes per day', 14, 48);
    },

    plots: [
      { title: 'Velocity along the water path — slow where it feeds, fast where it exhausts',
        legend: [{ c: '#E8A33D', label: 'water velocity (log scale)' }],
        draw(S, g) {
          const stations = [
            ['ostia', S.vIn], ['incurrent canal', S.vIn * 0.6],
            ['chambers', S.vCh], ['excurrent canal', S.vCh * 6],
            ['spongocoel', S.vOsc * 0.25], ['osculum', S.vOsc]
          ];
          const lg = v => Math.log10(Math.max(v, 1e-5));
          const ys = stations.map(s => lg(s[1]));
          const P = g.Plot({
            xmin: -0.4, xmax: stations.length - 0.6, ymin: Math.min.apply(null, ys) - 0.6,
            ymax: Math.max.apply(null, ys) + 0.5,
            xticks: stations.map((_, i) => i), xfmt: v => (stations[Math.round(v)] || [''])[0],
            ylabel: 'velocity (cm/s)', yfmt: v => Math.pow(10, v) >= 1 ? Math.pow(10, v).toFixed(0)
              : Math.pow(10, v).toFixed(Math.min(4, Math.max(1, Math.ceil(-v)))),
            pad: { l: 54, r: 14, t: 14, b: 38 }
          }).frame();
          P.clip(() => {
            const pts = stations.map((s, i) => [i, lg(s[1])]);
            P.area(pts, P.cfg.ymin, g.alpha(g.theme.chem, .12));
            P.line(pts, '#E8A33D', 2.4);
            pts.forEach((q, i) => P.dot(q[0], q[1], 4,
              i === 2 ? g.theme.ok : i === 5 ? g.theme.warn : '#E8A33D', g.theme['ink-950']));
            P.dot(2, lg(S.vCh), 5, g.theme.ok, g.theme['ink-950']);
          });
          P.tag(2, lg(S.vCh), 'slowest — food capture', g.theme.ok, 'left', -10);
          P.tag(5, lg(S.vOsc), 'fastest — waste carried clear', g.theme.warn, 'right', -10);
        },
        hover(S, x) {
          const stations = [['ostia', S.vIn], ['incurrent canal', S.vIn * 0.6], ['chambers', S.vCh],
            ['excurrent canal', S.vCh * 6], ['spongocoel', S.vOsc * 0.25], ['osculum', S.vOsc]];
          const i = clamp(Math.round(x), 0, stations.length - 1);
          return [{ label: 'station', value: stations[i][0] },
                  { label: 'velocity', value: stations[i][1].toFixed(4) + ' cm/s', color: '#E8A33D' },
                  { label: 'vs ostia', value: (stations[i][1] / S.vIn).toFixed(2) + '×' }];
        } },
      { title: 'The three canal systems compared at the same body size',
        legend: [{ c: '#E8A33D', label: 'body volumes filtered per day' }],
        draw(S, g) {
          const vol = 0.15 * Math.pow(S.p.size, 3);
          const vals = CANAL.map(c => {
            const Q = c.choanoDensity * vol * 3.3e-9 * (S.p.beat / 20);
            return Q * 86400 / vol;
          });
          const lg = v => Math.log10(Math.max(v, 1));
          const P = g.Plot({
            xmin: -0.5, xmax: 2.5, ymin: 0, ymax: Math.max.apply(null, vals.map(lg)) + 0.5,
            xticks: [0, 1, 2], xfmt: v => (CANAL[Math.round(v)] || { name: '' }).name,
            ylabel: 'body volumes / day', yfmt: v => fmt(Math.pow(10, v), 2),
            pad: { l: 56, r: 14, t: 14, b: 34 }
          }).frame();
          P.clip(() => {
            vals.forEach((v, i) => {
              const on = CANAL[i].id === S.p.type;
              P.bar(i, lg(v), 0.3, 0, g.alpha('#E8A33D', on ? .95 : .35));
              P.tag(i, lg(v), fmt(v, 3), on ? g.theme.text : g.theme['text-3'], 'left', -9);
            });
          });
          P.tag(0, 0.2, 'more chambers ⇒ more choanocytes ⇒ more water moved',
            g.theme['text-3'], 'left', 0);
        },
        hover(S, x) {
          const i = clamp(Math.round(x), 0, 2);
          const c = CANAL[i];
          const vol = 0.15 * Math.pow(S.p.size, 3);
          const Q = c.choanoDensity * vol * 3.3e-9 * (S.p.beat / 20);
          return [{ label: 'system', value: c.name },
                  { label: 'example', value: c.example },
                  { label: 'flow', value: Q.toFixed(4) + ' cm³/s', color: '#E8A33D' },
                  { label: 'body volumes/day', value: fmt(Q * 86400 / vol, 3) }];
        } }
    ],

    readouts(S) {
      const c = S.canal;
      return [
        { label: 'Canal system', value: c.name, unit: '', flag: 'accent', hint: c.example },
        { label: 'Flow rate Q', value: S.Q.toFixed(4), unit: 'cm³/s', flag: 'accent' },
        { label: 'Filtered per day', value: fmt(S.perDay / 1000, 3), unit: 'L' },
        { label: 'Body volumes / day', value: fmt(S.bodyVol, 3), unit: '' },
        { label: 'Own volume every', value: S.turnover.toFixed(1), unit: 's' },
        { label: 'Choanocytes', value: fmt(S.nChoano, 3), unit: '' },
        { label: 'Flagellated chambers', value: fmt(S.nChambers, 3), unit: '' },
        { label: 'Ostia', value: fmt(S.nOstia, 3), unit: '' },
        { label: 'v at ostia', value: S.vIn.toFixed(3), unit: 'cm/s' },
        { label: 'v in chambers', value: S.vCh.toFixed(4), unit: 'cm/s', flag: 'ok',
          hint: 'slow enough to trap food' },
        { label: 'v at osculum', value: S.vOsc.toFixed(2), unit: 'cm/s', flag: 'warn',
          hint: (S.vOsc / S.vIn).toFixed(0) + '× the inlet speed' },
        { label: 'Total ostia area', value: S.Ain.toFixed(3), unit: 'cm²',
          hint: (S.Ain / S.Aosc).toFixed(1) + '× the osculum area' }
      ];
    },

    equation(S) {
      return E.v('Q') + ' ' + E.op('=') + ' ' + E.v('A') + E.v('v') + ' ' + E.op('→') + ' ' +
        E.v('v') + ' ' + E.op('=') + ' ' + E.frac(E.v('Q'), E.v('A')) + E.op('·') +
        ' the same water, so a smaller opening means faster flow' +
        '<br>' + E.v('Q') + ' ' + E.op('=') + ' ' + E.n(fmt(S.nChoano, 3), ' choanocytes') + E.op('×') +
        E.n('3.3×10⁻⁹', ' cm³/s each') + E.op('×') + E.frac(E.n(S.p.beat, 'Hz'), '20 Hz') +
        ' ' + E.op('=') + ' ' + E.n(S.Q.toFixed(4), 'cm³/s') +
        '<br>' + E.v('v') + '<sub>osculum</sub> ' + E.op('/') + ' ' + E.v('v') + '<sub>ostia</sub> ' +
        E.op('=') + ' ' + E.v('A') + '<sub>ostia</sub> ' + E.op('/') + ' ' + E.v('A') + '<sub>osculum</sub> ' +
        E.op('=') + ' ' + E.n((S.Ain / S.Aosc).toFixed(1), '×');
    },
    eqNote: '<b>One equation explains the whole body plan.</b> Thousands of tiny ostia give a huge total inlet ' +
      'area, so water creeps in. The flagellated chambers give an even larger area, so it almost stops — which is ' +
      'exactly what the collar cells need to filter it. A single narrow osculum then forces it out in a jet, ' +
      'carrying waste far enough away that the sponge does not re-filter its own output.',

    walkthrough: [
      { title: '1 · Water enters through thousands of pores',
        body: 'Follow a particle from the outside wall inwards.',
        ask: 'Why does water enter so slowly despite the sponge pumping hard?',
        reveal: 'Because it enters through an enormous number of very small pores. Thousands of <b>ostia</b> add up to a total area far larger than the osculum, and Q = Av means a big area gives a small velocity.',
        params: { type: 'leucon', size: 5, beat: 20, rOstia: 25, rOsc: 1.0 } },
      { title: '2 · The slowest point is where it feeds',
        body: 'Watch the particles in the flagellated chambers and check the velocity graph.',
        ask: 'Why must the water be slowest exactly there?',
        reveal: 'The <b>choanocytes</b> — collar cells — trap food particles on their collar of microvilli. That only works if water lingers. The chambers present the largest total cross-section of the whole system, so the flow nearly stops. This is the single functional reason sponges are built this way.',
        params: { type: 'leucon', size: 5, beat: 20 } },
      { title: '3 · Out through one narrow chimney',
        body: 'Now look at the osculum and the exit velocity.',
        ask: 'Why is a single narrow osculum better than many small exits?',
        reveal: 'A narrow exit gives a <b>fast jet</b>. Filtered water is thrown well clear of the sponge, so it does not simply re-enter through the ostia. Narrow the osculum with the slider and watch the exit speed climb — the same volume forced through a smaller hole.',
        params: { type: 'leucon', rOsc: 0.4 } },
      { title: '4 · Why fold the body wall',
        body: 'Step through asconoid, syconoid and leuconoid at the same body size.',
        ask: 'What does increasing the complexity of the canal system actually buy the sponge?',
        reveal: '<b>Surface area for choanocytes.</b> An asconoid lines only the spongocoel. A syconoid folds the wall into radial canals. A leuconoid packs in millions of tiny chambers. Same body volume, vastly more collar cells, vastly more water filtered — the second chart shows the jump.',
        params: { type: 'ascon', size: 5 } },
      { title: '5 · Size and temperature',
        body: 'Increase the body length, then drop the flagellar beat frequency as if the water were cold.',
        ask: 'Which change hurts the sponge more?',
        reveal: 'Cooling. Choanocyte output scales roughly with beat frequency, so a sponge in cold water pumps proportionally less. Growth increases absolute flow, but the number of body volumes filtered per day stays roughly constant — which is why sponges grow by adding more chambers rather than by getting simply bigger.',
        params: { type: 'leucon', size: 5, beat: 6 } }
    ],

    quiz: [
      { q: 'The collar cells that drive water flow in a sponge are called:',
        options: ['pinacocytes', 'choanocytes', 'archaeocytes', 'porocytes'], answer: 1,
        why: 'Choanocytes line the internal chambers; their flagella create the current and their collars trap food.' },
      { q: 'Water leaves the sponge through the:',
        options: ['ostia', 'osculum', 'spongocoel', 'radial canal'], answer: 1,
        why: 'Water enters by many ostia and leaves by the single large osculum at the top.' },
      { q: 'Digestion in sponges is:',
        options: ['extracellular only', 'intracellular only', 'both', 'absent'], answer: 1,
        why: 'Sponges have no gut. Food particles are engulfed by individual cells, so digestion is entirely intracellular.' },
      { q: 'The leuconoid canal system is more efficient than the asconoid because it has:',
        options: ['a larger osculum', 'many more flagellated chambers',
                  'a true body cavity', 'muscular walls'], answer: 1,
        why: 'Folding the body wall into millions of small chambers multiplies the choanocyte surface area, and therefore the volume of water that can be filtered.' }
    ],

    notes: '<b>Where this shows up in the paper.</b>' +
      '<ul><li>Naming the parts of the water transport system and the direction of flow — a standard diagram question.</li>' +
      '<li>Choanocytes, spongocoel, ostia, osculum and spicules — definitions and functions.</li>' +
      '<li>Intracellular digestion, and the absence of any organ system, as evidence for the cellular grade.</li>' +
      '<li>Hermaphroditism, internal fertilisation and indirect development in sponges.</li></ul>' +
      '<div class="pyq"><em>Trap to avoid</em>Sponges are <b>not</b> plants and not colonies of protists — they ' +
      'are true multicellular animals. But because they lack tissues, a sponge pushed through a fine mesh can ' +
      'reassemble itself from separated cells, which no tissue-grade animal can do.</div>'
  });

  /* --- water path: 0 = outside wall, 1 = clear of the osculum --- */
  function pathSpeed(S, u) {
    // normalised speed profile matching the computed velocities
    const vIn = S.vIn, vCh = S.vCh, vOsc = S.vOsc;
    const ref = Math.max(vOsc, 1e-6);
    if (u < 0.28) return clamp(vIn / ref * 8, 0.05, 3);
    if (u < 0.58) return clamp(vCh / ref * 8, 0.03, 3);
    if (u < 0.82) return clamp(vCh * 6 / ref * 8, 0.05, 3);
    return clamp(1.4 + vOsc / ref, 0.2, 4);
  }
  function pathPoint(S, q, cx, cyTop, cyBot, bodyW, scW, oscR) {
    const u = q.u, sg = q.j > 0.5 ? 1 : -1;
    const bodyH = cyBot - cyTop;
    const entryY = cyTop + bodyH * (0.12 + q.lane * 0.78);
    if (u < 0.28) {                       // through the wall
      const t = u / 0.28;
      return [cx + sg * (bodyW * 0.88 - t * (bodyW * 0.88 - scW - 10)), entryY];
    }
    if (u < 0.58) {                       // dwelling in the chambers
      const t = (u - 0.28) / 0.30;
      return [cx + sg * (scW + 10 - t * 6), entryY + Math.sin(t * 6 + q.j * 6) * 5];
    }
    if (u < 0.82) {                       // into the spongocoel and upward
      const t = (u - 0.58) / 0.24;
      const y = entryY - t * (entryY - (cyTop + bodyH * 0.1));
      return [cx + sg * (scW + 4) * (1 - t) + sg * scW * 0.4 * t, y];
    }
    const t = (u - 0.82) / 0.18;          // out of the osculum
    const y = (cyTop + bodyH * 0.1) - t * (bodyH * 0.1 + 26);
    return [cx + sg * scW * 0.4 * (1 - t * 0.7), y];
  }

})(window.InsightLab, window.ANIMALIA, window.ANIMALART);
