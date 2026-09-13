/* ============================================================
   ANIMAL KINGDOM — upgrade pass 1
   Exam depth: a second comparison matrix covering the organ
   systems, extra quiz coverage, and NCERT cross-checks.
   ============================================================ */
(function (L, A) {
  'use strict';
  const { clamp } = L;
  const { PHYLA, CHARACTERS } = A;

  /* Ordinal grading of each organ system, so the matrix reads as a
     progression rather than as unrelated labels. */
  const SYSTEMS = [
    { key: 'digestion', short: 'Digestion', grade: p =>
        /intracellular$/i.test(p.digestion) ? 0 : /incomplete|absent/i.test(p.digestion) ? 1 : 2,
      names: ['Intracellular', 'Incomplete gut', 'Complete gut'] },
    { key: 'circulatory', short: 'Circulation', grade: p =>
        /absent/i.test(p.circulatory) ? 0 : /open/i.test(p.circulatory) ? 1 : 2,
      names: ['Absent', 'Open', 'Closed'] },
    { key: 'respiration', short: 'Respiration', grade: p =>
        /body surface/i.test(p.respiration) ? 0 : /gill|tube feet/i.test(p.respiration) ? 1 : 2,
      names: ['Body surface', 'Gills', 'Lungs / tracheae'] },
    { key: 'excretion', short: 'Excretion', grade: p =>
        /no excretory|absent/i.test(p.excretion) ? 0
          : /body surface/i.test(p.excretion) ? 1
          : /flame/i.test(p.excretion) ? 2
          : /tube|gland/i.test(p.excretion) ? 3 : 4,
      names: ['None at all', 'Body surface', 'Flame cells', 'Tubes / glands', 'Nephridia, kidney, Malpighian'] },
    { key: 'nervous', short: 'Nervous', grade: p =>
        /absent/i.test(p.nervous) ? 0 : /net/i.test(p.nervous) ? 1 : /ladder/i.test(p.nervous) ? 2 : 3,
      names: ['Absent', 'Nerve net', 'Ladder-like', 'Brain + cords'] },
    { key: 'sexes', short: 'Sexes', grade: p =>
        /hermaphrodite|monoecious/i.test(p.sexes) ? 0 : /dioecious|separate/i.test(p.sexes) ? 2 : 1,
      names: ['Hermaphrodite', 'Both occur', 'Dioecious'] }
  ];

  /* the structural characters, expressed in the same column shape as SYSTEMS
     so one matrix renderer can draw either view */
  const STRUCT = CHARACTERS.map(ch => ({
    key: ch.key, short: ch.short,
    names: ch.values.map(v => ch.labels[String(v)]),
    grade: ph => Math.max(0, ch.values.findIndex(v => String(v) === String(ph[ch.key])))
  }));

  L.extend('ak-key', {
    params: { matrixView: 'characters' },
    addControlGroups: [{
      group: 'Comparison table', items: [
        { key: 'matrixView', type: 'select', label: 'Matrix shows', restructure: true, options: [
          { value: 'characters', label: 'Structure' }, { value: 'systems', label: 'Organ systems' }] }
      ]
    }],
    addPlots: [{
      title(S) {
        return S.p.matrixView === 'systems'
          ? 'Organ systems across the phyla — the second half of the comparison table'
          : 'Structural characters across the phyla — the half the key filters on';
      },
      legend: [{ c: '#3A4766', label: 'absent / simplest' }, { c: '#4ADE80', label: 'most advanced' },
               { c: '#E7EDFB', label: 'still possible' }],
      draw(S, g) {
        const ctx = g.ctx;
        const COLS = S.p.matrixView === 'systems' ? SYSTEMS : STRUCT;
        const P = g.Plot({
          xmin: -0.5, xmax: COLS.length - 0.5, ymin: -0.5, ymax: PHYLA.length - 0.5,
          xticks: COLS.map((_, i) => i), yticks: PHYLA.map((_, i) => i),
          xfmt: v => (COLS[Math.round(v)] || { short: '' }).short,
          yfmt: v => (PHYLA[Math.round(v)] || { name: '' }).name,
          pad: { l: 108, r: 14, t: 12, b: 32 }
        }).frame();
        const cw = (P.x1 - P.x0) / COLS.length, chh = (P.y0 - P.y1) / PHYLA.length;
        P.clip(() => {
          PHYLA.forEach((ph, r) => {
            const alive = S.alive.indexOf(ph) >= 0;
            COLS.forEach((sy, c) => {
              const v = sy.grade(ph), max = sy.names.length - 1;
              const t = max > 0 ? v / max : 0;
              const x = P.X(c) - cw / 2 + 1, y = P.Y(r) - chh / 2 + 1;
              ctx.fillStyle = g.alpha(g.mix('#3A4766', '#4ADE80', t), alive ? 0.9 : 0.16);
              ctx.fillRect(x, y, cw - 2, chh - 2);
              if (alive && S.alive.length <= 3) {
                ctx.strokeStyle = g.alpha('#E7EDFB', .85); ctx.lineWidth = 1.4;
                ctx.strokeRect(x + .7, y + .7, cw - 3.4, chh - 3.4);
              }
            });
          });
        });
      },
      hover(S, x, y) {
        const COLS = S.p.matrixView === 'systems' ? SYSTEMS : STRUCT;
        const c = clamp(Math.round(x), 0, COLS.length - 1);
        const r = clamp(Math.round(y), 0, PHYLA.length - 1);
        const sy = COLS[c], ph = PHYLA[r];
        return [{ label: 'phylum', value: ph.name, color: ph.hue },
                { label: sy.short, value: String(ph[sy.key]) },
                { label: 'grade', value: sy.names[sy.grade(ph)] },
                { label: 'habitat', value: ph.habitat }];
      }
    }],
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
        why: 'Annelida is the first phylum in which the body is genuinely divided into repeated segments.' },
      { q: 'The first phylum to show a complete digestive tract with both mouth and anus is:',
        options: ['Coelenterata', 'Platyhelminthes', 'Aschelminthes', 'Annelida'], answer: 2,
        why: 'Roundworms have a complete alimentary canal with a muscular pharynx. Cnidarians and flatworms have only one opening.' },
      { q: 'Open circulatory systems are found in:',
        options: ['Annelida and Chordata', 'Arthropoda and Mollusca',
                  'Platyhelminthes and Porifera', 'Echinodermata only'], answer: 1,
        why: 'Arthropods and molluscs bathe their organs in haemolymph. Annelids and chordates have closed systems.' },
      { q: 'Excretion by Malpighian tubules occurs in:',
        options: ['Annelida', 'Arthropoda', 'Mollusca', 'Echinodermata'], answer: 1,
        why: 'Malpighian tubules are the arthropod excretory organ. Annelids use nephridia, molluscs use kidneys, and echinoderms have no excretory system.' },
      { q: 'Which phylum is exclusively marine AND has no excretory system?',
        options: ['Ctenophora', 'Echinodermata', 'Hemichordata', 'Mollusca'], answer: 1,
        why: 'Echinoderms are exclusively marine and are the classic example of an advanced phylum with no excretory organs at all.' },
      { q: 'The largest and the second largest phyla of the animal kingdom are respectively:',
        options: ['Chordata and Arthropoda', 'Arthropoda and Mollusca',
                  'Mollusca and Chordata', 'Arthropoda and Chordata'], answer: 1,
        why: 'Arthropoda is the largest phylum and Mollusca the second largest — both are named as such in NCERT.' }
    ]
  });

  /* Extra exam-grade questions for the symmetry and coelom labs */
  L.extend('ak-symmetry', {
    quiz: [
      { q: 'Pentamerous radial symmetry is characteristic of adult:',
        options: ['Coelenterata', 'Ctenophora', 'Echinodermata', 'Mollusca'], answer: 2,
        why: 'Adult echinoderms such as the starfish have five planes of symmetry around a central axis.' },
      { q: 'Bilateral symmetry is directly associated with:',
        options: ['a sessile habit', 'cephalisation and directed movement',
                  'the absence of a coelom', 'radial cleavage'], answer: 1,
        why: 'A single plane creates a definite anterior end, where sense organs and nervous tissue concentrate.' },
      { q: 'Which animal is asymmetrical?',
        options: ['Hydra', 'Sycon', 'Pleurobrachia', 'Asterias'], answer: 1,
        why: 'Sponges have no plane that divides the body into mirror halves.' },
      { q: 'Biradial symmetry, with exactly two planes, is shown by:',
        options: ['Ctenophora', 'Porifera', 'Annelida', 'Aves'], answer: 0,
        why: 'Comb jellies are essentially radial, but a pair of tentacles reduces the symmetry to two planes.' },
      { q: 'An animal that can be divided into two identical halves by any plane passing through the central axis shows:',
        options: ['bilateral symmetry', 'radial symmetry', 'biradial symmetry', 'asymmetry'], answer: 1,
        why: 'That is the definition of radial symmetry — every plane must pass through the central axis.' },
      { q: 'Which pairing is correct?',
        options: ['Hydra — bilateral', 'Aurelia — asymmetrical',
                  'Asterias — radial as an adult', 'Ascaris — radial'], answer: 2,
        why: 'Asterias is radially symmetrical as an adult, though its larva is bilateral.' }
    ]
  });

  L.extend('ak-coelom', {
    quiz: [
      { q: 'The body cavity of Ascaris is a pseudocoelom because it is:',
        options: ['very small', 'filled with fluid', 'not lined by mesoderm on both sides',
                  'formed from the archenteron'], answer: 2,
        why: 'A true coelom must be lined by mesoderm on both surfaces.' },
      { q: 'The mesoglea of a jellyfish is:',
        options: ['a third germ layer', 'a non-cellular jelly between two germ layers',
                  'the body cavity', 'the gastrovascular cavity'], answer: 1,
        why: 'Mesoglea is acellular jelly, so cnidarians remain diploblastic.' },
      { q: 'In protostomes, the blastopore develops into the:',
        options: ['anus', 'mouth', 'coelom', 'notochord'], answer: 1,
        why: 'Protostome means "first mouth".' },
      { q: 'Enterocoelous coelom formation occurs in:',
        options: ['Annelida', 'Arthropoda', 'Mollusca', 'Echinodermata'], answer: 3,
        why: 'Deuterostomes form the coelom from pouches of the embryonic gut.' },
      { q: 'Which germ layer gives rise to muscles, blood and the skeleton?',
        options: ['Ectoderm', 'Mesoderm', 'Endoderm', 'Mesoglea'], answer: 1,
        why: 'Mesoderm forms muscle, skeleton, blood, kidney and the coelomic lining.' },
      { q: 'Acoelomate, pseudocoelomate and coelomate are respectively represented by:',
        options: ['Ascaris, Planaria, Pheretima', 'Planaria, Ascaris, Pheretima',
                  'Pheretima, Planaria, Ascaris', 'Planaria, Pheretima, Ascaris'], answer: 1,
        why: 'Planaria has no cavity, Ascaris has an unlined one, and the earthworm has a true coelom.' },
      { q: 'The ectoderm gives rise to:',
        options: ['the lining of the gut', 'muscles and blood',
                  'the epidermis and the nervous system', 'the coelomic lining'], answer: 2,
        why: 'Ectoderm forms the outer covering and the entire nervous system.' }
    ]
  });
})(window.InsightLab, window.ANIMALIA);
