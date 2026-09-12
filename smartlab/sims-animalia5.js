/* ============================================================
   ANIMAL KINGDOM — 9. Specimen identification challenge
   A scored drill over every genus NCERT names, played on the
   stage itself. Tracks which taxa you keep getting wrong.
   ============================================================ */
(function (L, A, ART) {
  'use strict';
  const { clamp, TAU, fmt, E } = L;
  const { PHYLA, CLASSES, SPECIMENS } = A;

  const artFor = sp => {
    if (sp.rank === 'class') {
      return { cyclostomata: 'lamprey', chondrichthyes: 'shark', osteichthyes: 'bonyfish',
        amphibia: 'frog', reptilia: 'lizard', aves: 'bird', mammalia: 'mammal' }[sp.klass] || 'bonyfish';
    }
    const ph = PHYLA.find(p => p.id === sp.phylum);
    return ph ? ph.shape : 'vase';
  };

  function pool(mode) {
    if (mode === 'phylum') return SPECIMENS.filter(s => s.rank === 'phylum');
    if (mode === 'class') return SPECIMENS.filter(s => s.rank === 'class');
    return SPECIMENS;
  }
  function optionsFor(sp, n) {
    const correct = sp.rank === 'class' ? sp.klassName : sp.phylumName;
    const universe = sp.rank === 'class'
      ? CLASSES.map(c => c.name)
      : PHYLA.map(p => p.name);
    const others = universe.filter(x => x !== correct);
    for (let i = others.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      const t = others[i]; others[i] = others[j]; others[j] = t;
    }
    const opts = others.slice(0, Math.max(1, n - 1)).concat([correct]);
    for (let i = opts.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      const t = opts[i]; opts[i] = opts[j]; opts[j] = t;
    }
    return { opts, correct };
  }

  L.register({
    id: 'ak-challenge', subject: 'biology',
    name: 'Specimen Identification Challenge',
    chapter: 'Animal Kingdom',
    exams: ['NEET UG'],
    weight: 'Exam drill',
    is3D: false,
    autoplay: true,
    stageHint: 'Click an answer · the lab remembers which taxa you keep missing',
    lede: 'Every genus NCERT names for the animal kingdom, drawn at random, one at a time. ' +
      'Click the phylum or class it belongs to. ' +
      'The lab keeps your <b>streak, accuracy and a per-taxon breakdown</b>, so the second graph tells you exactly ' +
      'which groups to go back and revise — which is the part ordinary flashcards never do.',

    params: { mode: 'phylum', nOpts: 4, hints: true, speed: 1 },

    presets: [
      { name: 'Phyla only', params: { mode: 'phylum', nOpts: 4, hints: true } },
      { name: 'Vertebrate classes', params: { mode: 'class', nOpts: 4, hints: true } },
      { name: 'Everything, 6 options', params: { mode: 'all', nOpts: 6, hints: false } },
      { name: 'Hard — no hints', params: { mode: 'all', nOpts: 6, hints: false } }
    ],

    controls: [
      { group: 'Drill', items: [
        { key: 'mode', type: 'select', label: 'Question pool', restructure: true, options: [
          { value: 'phylum', label: 'Phyla' }, { value: 'class', label: 'Classes' },
          { value: 'all', label: 'Both' }] },
        { key: 'nOpts', type: 'select', label: 'Options per question', restructure: true, options: [
          { value: 3, label: '3' }, { value: 4, label: '4' }, { value: 6, label: '6' }] },
        { key: 'hints', type: 'toggle', label: 'Show the common name as a hint' },
        { key: 'speed', label: 'Pause after answering', min: 0.6, max: 4, step: 0.1, unit: 's',
          fmt: v => v.toFixed(1) }
      ] }
    ],

    setup(S) {
      if (!S.stats) { S.stats = {}; S.right = 0; S.total = 0; S.streak = 0; S.best = 0; S.history = []; }
      S.pool = pool(S.p.mode);
      nextQuestion(S);
    },

    step(S, dt) {
      S.t = (S.t || 0) + dt;
      if (S.picked != null) {
        S.hold = (S.hold || 0) + dt;
        if (S.hold > S.p.speed) nextQuestion(S);
      }
    },

    onPointer(S, x, y, down, type) {
      if (type !== 'pointerdown' || S.picked != null || !S.boxes) return;
      S.boxes.forEach((b, i) => {
        if (x >= b.x && x <= b.x + b.w && y >= b.y && y <= b.y + b.h) answer(S, i);
      });
    },

    drawStage(S, g) {
      const ctx = g.ctx, th = g.theme, p = S.p, W = g.w, H = g.h;
      const sp = S.sp;
      if (!sp) return;
      const answered = S.picked != null;
      const correctIdx = S.opts.indexOf(S.correct);

      /* ---------------- specimen ---------------- */
      const topH = H * 0.46;
      ART.draw(ctx, artFor(sp), W * 0.20, topH * 0.54, Math.min(W * 0.11, topH * 0.36),
        sp.hue, S.t, answered ? 1 : 0.92);

      ctx.textAlign = 'left'; ctx.textBaseline = 'top';
      ctx.font = '500 10px "IBM Plex Mono",monospace'; ctx.fillStyle = th['text-3'];
      ctx.fillText(sp.rank === 'class' ? 'WHICH CLASS DOES THIS BELONG TO?'
        : 'WHICH PHYLUM DOES THIS BELONG TO?', W * 0.36, topH * 0.24);
      ctx.font = '700 30px "IBM Plex Sans Condensed",sans-serif'; ctx.fillStyle = th.text;
      ctx.fillText(sp.genus, W * 0.36, topH * 0.36);
      if (p.hints && sp.common) {
        ctx.font = '400 13px "IBM Plex Sans",sans-serif'; ctx.fillStyle = th['text-2'];
        ctx.fillText(sp.common, W * 0.36, topH * 0.66);
      }

      /* ---------------- score panel ---------------- */
      const acc = S.total ? (S.right / S.total * 100) : 0;
      ctx.textAlign = 'right'; ctx.textBaseline = 'top';
      ctx.font = '700 24px "IBM Plex Sans Condensed",sans-serif';
      ctx.fillStyle = S.streak >= 5 ? th.ok : th.text;
      ctx.fillText(S.right + ' / ' + S.total, W - 14, 10);
      ctx.font = '500 10px "IBM Plex Mono",monospace'; ctx.fillStyle = th['text-3'];
      ctx.fillText(acc.toFixed(0) + '% accuracy', W - 14, 40);
      ctx.fillStyle = S.streak >= 3 ? th.ok : th['text-3'];
      ctx.fillText('streak ' + S.streak + '   best ' + S.best, W - 14, 54);

      /* ---------------- answer buttons ---------------- */
      const n = S.opts.length;
      const cols = n <= 3 ? 1 : 2;
      const rows = Math.ceil(n / cols);
      const bx0 = 16, by0 = topH + 6;
      const bw = (W - bx0 * 2 - (cols - 1) * 10) / cols;
      const bh = Math.min(46, (H - by0 - 34 - (rows - 1) * 8) / rows);
      S.boxes = [];
      S.opts.forEach((o, i) => {
        const c = i % cols, r = Math.floor(i / cols);
        const x = bx0 + c * (bw + 10), y = by0 + r * (bh + 8);
        S.boxes.push({ x, y, w: bw, h: bh });

        let fill = g.alpha(th['ink-750'], .9), stroke = g.alpha(th.line, 1), textCol = th['text-2'];
        if (answered) {
          if (i === correctIdx) { fill = g.alpha(th.ok, .20); stroke = th.ok; textCol = th.text; }
          else if (i === S.picked) { fill = g.alpha(th.crit, .18); stroke = th.crit; textCol = th.text; }
          else { fill = g.alpha(th['ink-800'], .7); textCol = g.alpha(th['text-3'], .7); }
        }
        ctx.fillStyle = fill; ctx.strokeStyle = stroke; ctx.lineWidth = answered ? 2 : 1;
        if (ctx.roundRect) { ctx.beginPath(); ctx.roundRect(x, y, bw, bh, 9); ctx.fill(); ctx.stroke(); }
        else { ctx.fillRect(x, y, bw, bh); ctx.strokeRect(x, y, bw, bh); }
        ctx.font = '600 13.5px "IBM Plex Sans",sans-serif';
        ctx.fillStyle = textCol; ctx.textAlign = 'left'; ctx.textBaseline = 'middle';
        ctx.fillText(o, x + 16, y + bh / 2);
        if (answered && i === correctIdx) {
          ctx.textAlign = 'right'; ctx.fillStyle = th.ok;
          ctx.font = '600 12px "IBM Plex Mono",monospace';
          ctx.fillText('✓', x + bw - 14, y + bh / 2);
        }
        if (answered && i === S.picked && i !== correctIdx) {
          ctx.textAlign = 'right'; ctx.fillStyle = th.crit;
          ctx.font = '600 12px "IBM Plex Mono",monospace';
          ctx.fillText('✗', x + bw - 14, y + bh / 2);
        }
      });

      /* ---------------- feedback line ---------------- */
      if (answered) {
        const ok = S.picked === correctIdx;
        ctx.textAlign = 'left'; ctx.textBaseline = 'bottom';
        ctx.font = '600 12px "IBM Plex Mono",monospace';
        ctx.fillStyle = ok ? th.ok : th.crit;
        ctx.fillText(ok ? '✓ Correct' : '✗ ' + sp.genus + ' belongs to ' + S.correct, 16, H - 16);
        // progress bar for the auto-advance
        const w = (W - 32) * clamp((S.hold || 0) / S.p.speed, 0, 1);
        ctx.fillStyle = g.alpha(th['text-3'], .35);
        ctx.fillRect(16, H - 10, W - 32, 2);
        ctx.fillStyle = g.alpha(th.bio, .9);
        ctx.fillRect(16, H - 10, w, 2);
      } else {
        ctx.textAlign = 'left'; ctx.textBaseline = 'bottom';
        ctx.font = '500 10px "IBM Plex Mono",monospace'; ctx.fillStyle = th['text-3'];
        ctx.fillText('click your answer', 16, H - 16);
      }
    },

    plots: [
      { title: 'Score over the session',
        legend: [{ c: '#4ADE80', label: 'running accuracy' }, { c: '#FB7185', label: 'a miss' }],
        draw(S, g) {
          const h = S.history || [];
          const P = g.Plot({
            xmin: 0, xmax: Math.max(12, h.length), ymin: 0, ymax: 105,
            xlabel: 'question', ylabel: 'running accuracy (%)',
            xfmt: v => v.toFixed(0), yfmt: v => v.toFixed(0)
          }).frame();
          P.clip(() => {
            P.hline(100, g.alpha(g.theme['text-3'], .4), [2, 5]);
            if (h.length) {
              P.area(h.map((q, i) => [i + 1, q.acc]), 0, g.alpha(g.theme.ok, .12));
              P.line(h.map((q, i) => [i + 1, q.acc]), g.theme.ok, 2.2);
              h.forEach((q, i) => { if (!q.ok) P.dot(i + 1, q.acc, 3.4, g.theme.crit); });
            }
          });
          if (!h.length) P.tag(1, 52, 'answer a few questions and the curve appears',
            g.theme['text-3'], 'left', 0);
        },
        hover(S, x) {
          const h = S.history || [];
          if (!h.length) return null;
          const i = clamp(Math.round(x) - 1, 0, h.length - 1);
          return [{ label: 'question', value: String(i + 1) },
                  { label: 'specimen', value: h[i].genus },
                  { label: 'result', value: h[i].ok ? 'correct' : 'missed', color: h[i].ok ? '#4ADE80' : '#FB7185' },
                  { label: 'running accuracy', value: h[i].acc.toFixed(0) + '%' }];
        } },
      { title: 'Where you are losing marks — accuracy by taxon',
        legend: [{ c: '#4ADE80', label: 'got it right' }, { c: '#FB7185', label: 'got it wrong' }],
        draw(S, g) {
          const keys = Object.keys(S.stats || {});
          if (!keys.length) {
            const P = g.Plot({ xmin: 0, xmax: 1, ymin: 0, ymax: 1, xticks: [], yticks: [] }).frame();
            P.tag(0.05, 0.5, 'attempt some questions and your weak taxa are listed here',
              g.theme['text-3'], 'left', 0);
            return;
          }
          keys.sort((a, b) => {
            const A2 = S.stats[a], B2 = S.stats[b];
            return (A2.right / A2.total) - (B2.right / B2.total);
          });
          const show = keys.slice(0, 12);
          const P = g.Plot({
            xmin: -0.5, xmax: show.length - 0.5, ymin: 0, ymax: 105,
            xticks: show.map((_, i) => i),
            xfmt: v => (show[Math.round(v)] || '').slice(0, 8),
            ylabel: 'accuracy (%)', yfmt: v => v.toFixed(0),
            pad: { l: 46, r: 14, t: 14, b: 38 }
          }).frame();
          P.clip(() => {
            show.forEach((k, i) => {
              const st = S.stats[k];
              const a = st.right / st.total * 100;
              P.bar(i, a, 0.3, 0, g.alpha(a >= 70 ? g.theme.ok : a >= 40 ? g.theme.warn : g.theme.crit, .9));
              P.tag(i, a, st.right + '/' + st.total, g.theme.text, 'left', -9);
            });
            P.hline(70, g.alpha(g.theme['text-3'], .8), [4, 3]);
          });
          P.tag(-0.4, 70, 'revise anything below this line', g.theme['text-2'], 'left', -9);
        },
        hover(S, x) {
          const keys = Object.keys(S.stats || {});
          if (!keys.length) return null;
          keys.sort((a, b) => (S.stats[a].right / S.stats[a].total) - (S.stats[b].right / S.stats[b].total));
          const k = keys[clamp(Math.round(x), 0, Math.min(keys.length, 12) - 1)];
          const st = S.stats[k];
          return [{ label: 'taxon', value: k },
                  { label: 'correct', value: String(st.right), color: '#4ADE80' },
                  { label: 'attempts', value: String(st.total) },
                  { label: 'accuracy', value: (st.right / st.total * 100).toFixed(0) + '%' }];
        } }
    ],

    readouts(S) {
      const acc = S.total ? S.right / S.total * 100 : 0;
      const keys = Object.keys(S.stats || {});
      let worst = null;
      keys.forEach(k => {
        const st = S.stats[k];
        if (st.total >= 2 && (!worst || st.right / st.total < S.stats[worst].right / S.stats[worst].total)) worst = k;
      });
      return [
        { label: 'Score', value: S.right + ' / ' + S.total, unit: '', flag: 'accent' },
        { label: 'Accuracy', value: acc.toFixed(0), unit: '%',
          flag: acc >= 80 ? 'ok' : acc >= 55 ? 'warn' : S.total ? 'crit' : '' },
        { label: 'Current streak', value: String(S.streak), unit: '',
          flag: S.streak >= 5 ? 'ok' : '' },
        { label: 'Best streak', value: String(S.best), unit: '' },
        { label: 'Specimen', value: S.sp ? S.sp.genus : '—', unit: '',
          hint: S.sp && S.sp.common ? S.sp.common : '' },
        { label: 'Pool size', value: String(S.pool ? S.pool.length : 0), unit: '', hint: 'genera in this drill' },
        { label: 'Weakest taxon', value: worst || '—', unit: '', flag: worst ? 'warn' : '',
          hint: worst ? (S.stats[worst].right + ' of ' + S.stats[worst].total + ' correct') : 'need a few more attempts' },
        { label: 'Taxa attempted', value: String(keys.length), unit: '' }
      ];
    },

    equation(S) {
      const acc = S.total ? S.right / S.total * 100 : 0;
      return 'accuracy ' + E.op('=') + ' ' + E.frac('correct', 'attempted') + ' ' + E.op('=') + ' ' +
        E.frac(E.n(S.right, ''), E.n(S.total, '')) + ' ' + E.op('=') + ' ' + E.n(acc.toFixed(0), '%') +
        E.op('·') + ' streak ' + E.op('=') + ' ' + E.n(S.streak, '') +
        '<br>pool ' + E.op('=') + ' ' + E.n(S.pool ? S.pool.length : 0, ' genera') +
        E.op(',') + ' options ' + E.op('=') + ' ' + E.n(S.p.nOpts, '') +
        E.op(',') + ' guessing alone would give ' + E.n((100 / S.p.nOpts).toFixed(0), '%');
    },
    eqNote: '<b>Compare your accuracy with the guessing line.</b> With four options, pure chance scores 25%. ' +
      'Anything near that means the genus list itself needs work — and the second graph names exactly which taxa.',

    walkthrough: [
      { title: '1 · Start with the phyla',
        body: 'The drill picks a genus at random from the ones NCERT actually names. Click the phylum you think it belongs to.',
        ask: 'Why are the example genera worth memorising rather than just the characters?',
        reveal: 'Because that is the form the question takes. NEET rarely asks "which phylum is triploblastic and pseudocoelomate" — it asks "<i>Ascaris</i> belongs to". The genus list is the examinable currency of this chapter.',
        params: { mode: 'phylum', nOpts: 4, hints: true } },
      { title: '2 · Drop the hint',
        body: 'Turn the common-name hint off and keep going.',
        ask: 'Does the common name make it easier than the exam will be?',
        reveal: 'Usually yes. "Sea urchin" gives away Echinodermata; <i>Echinus</i> on its own does not. Practise without the hint, because the paper gives you the <b>genus</b>.',
        params: { mode: 'phylum', nOpts: 4, hints: false } },
      { title: '3 · Move to the vertebrate classes',
        body: 'Switch the pool to classes. Now the question is which class within Chordata.',
        ask: 'Which two classes are most often confused?',
        reveal: '<b>Chondrichthyes and Osteichthyes.</b> Both are fishes; the separators are the cartilaginous versus bony skeleton, the ventral versus terminal mouth, gill slits versus operculum, and above all the <b>absence versus presence of an air bladder</b>.',
        params: { mode: 'class', nOpts: 4, hints: false } },
      { title: '4 · Read your own weak spots',
        body: 'After a dozen questions, look at the second graph.',
        ask: 'What should you do with that chart?',
        reveal: 'Take the bars below the 70% line and go back to the classification key lab with exactly those phyla in mind. Targeted revision of four weak taxa beats another full read of the chapter.',
        params: { mode: 'all', nOpts: 6, hints: false } }
    ],

    quiz: [
      { q: 'Limulus, the king crab, is a:',
        options: ['crustacean in Arthropoda', 'living fossil in Arthropoda',
                  'mollusc', 'echinoderm'], answer: 1,
        why: 'NCERT names Limulus specifically as a living fossil within Arthropoda.' },
      { q: 'Pinctada is economically important because it yields:',
        options: ['silk', 'lac', 'pearl', 'honey'], answer: 2,
        why: 'Pinctada is the pearl oyster, a mollusc. Bombyx gives silk, Laccifer gives lac and Apis gives honey.' },
      { q: 'Ornithorhynchus is remarkable among mammals because it is:',
        options: ['viviparous', 'oviparous', 'poikilothermous', 'without hair'], answer: 1,
        why: 'The platypus is an egg-laying mammal — the standard exception to mammalian viviparity.' },
      { q: 'Which of the following is NOT an echinoderm?',
        options: ['Asterias', 'Ophiura', 'Antedon', 'Aplysia'], answer: 3,
        why: 'Aplysia, the sea hare, is a mollusc. The other three are starfish, brittle star and sea lily.' }
    ],

    notes: '<b>How to use this drill.</b>' +
      '<ul><li>Do twenty questions on phyla, then read the weak-taxon chart before doing anything else.</li>' +
      '<li>Turn the hint off once you are above about 80% — the exam gives you the genus alone.</li>' +
      '<li>Switch to class mode for the chordates; that is where most marks are actually lost.</li>' +
      '<li>Every genus here is one NCERT names explicitly, so nothing in the pool is wasted effort.</li></ul>' +
      '<div class="pyq"><em>Trap to avoid</em>Similar-sounding names catch people out: <b>Pila</b> is a mollusc ' +
      'but <b>Physalia</b> is a cnidarian; <b>Echinus</b> is an echinoderm but <b>Ichthyophis</b> is an amphibian. ' +
      'Learn them in their groups, not as an alphabetical list.</div>'
  });

  function nextQuestion(S) {
    const list = S.pool && S.pool.length ? S.pool : SPECIMENS;
    S.sp = list[Math.floor(Math.random() * list.length)];
    const o = optionsFor(S.sp, S.p.nOpts);
    S.opts = o.opts; S.correct = o.correct;
    S.picked = null; S.hold = 0;
  }

  function answer(S, i) {
    S.picked = i; S.hold = 0;
    const ok = S.opts[i] === S.correct;
    S.total++;
    if (ok) { S.right++; S.streak++; S.best = Math.max(S.best, S.streak); }
    else S.streak = 0;
    const key = S.correct;
    if (!S.stats[key]) S.stats[key] = { right: 0, total: 0 };
    S.stats[key].total++;
    if (ok) S.stats[key].right++;
    S.history.push({ genus: S.sp.genus, ok, acc: S.right / S.total * 100 });
    if (S.history.length > 200) S.history.shift();
  }

})(window.InsightLab, window.ANIMALIA, window.ANIMALART);
