/* ============================================================
   ORGANIC CHEMISTRY — 4. Optical activity, CIP and the polarimeter
   Real optics: the plane of polarisation is rotated by
   α = [α]·l·c, and the analyser obeys Malus's law. R/S is
   assigned by an actual CIP comparison of the four branches,
   not from a lookup table.
   ============================================================ */
(function (L, O) {
  'use strict';
  const { clamp, TAU, E } = L;

  /* Each substituent carries the CIP exploration data the rules need:
     `z` is the atomic number of the first atom, and `set` is the
     duplicated-atom set at the first sphere, compared in descending
     order exactly as the rules require. */
  const GRP = {
    H:     { label: 'H',     z: 1,  set: [],           name: 'hydrogen' },
    CH3:   { label: 'CH₃',   z: 6,  set: [1, 1, 1],    name: 'methyl' },
    C2H5:  { label: 'C₂H₅',  z: 6,  set: [6, 1, 1],    name: 'ethyl' },
    iPr:   { label: 'CH(CH₃)₂', z: 6, set: [6, 6, 1],  name: 'isopropyl' },
    tBu:   { label: 'C(CH₃)₃', z: 6, set: [6, 6, 6],   name: 'tert-butyl' },
    CHO:   { label: 'CHO',   z: 6,  set: [8, 8, 1],    name: 'aldehyde' },
    COOH:  { label: 'COOH',  z: 6,  set: [8, 8, 8],    name: 'carboxyl' },
    CN:    { label: 'C≡N',   z: 6,  set: [7, 7, 7],    name: 'nitrile' },
    Ph:    { label: 'C₆H₅',  z: 6,  set: [6, 6, 6],    name: 'phenyl', tie: 1 },
    CH2OH: { label: 'CH₂OH', z: 6,  set: [8, 1, 1],    name: 'hydroxymethyl' },
    NH2:   { label: 'NH₂',   z: 7,  set: [1, 1],       name: 'amino' },
    OH:    { label: 'OH',    z: 8,  set: [1],          name: 'hydroxyl' },
    OMe:   { label: 'OCH₃',  z: 8,  set: [6],          name: 'methoxy' },
    F:     { label: 'F',     z: 9,  set: [],           name: 'fluoro' },
    Cl:    { label: 'Cl',    z: 17, set: [],           name: 'chloro' },
    Br:    { label: 'Br',    z: 35, set: [],           name: 'bromo' },
    I:     { label: 'I',     z: 53, set: [],           name: 'iodo' }
  };
  const GKEYS = Object.keys(GRP);

  /* CIP comparison: atomic number first, then the duplicated set in
     descending order, then a small tie-break for aromatic branches. */
  function cipCompare(a, b) {
    const A = GRP[a], B = GRP[b];
    if (A.z !== B.z) return B.z - A.z;                    // higher Z wins
    const sa = A.set.slice().sort((x, y) => y - x);
    const sb = B.set.slice().sort((x, y) => y - x);
    for (let i = 0; i < Math.max(sa.length, sb.length); i++) {
      const x = sa[i] || 0, y = sb[i] || 0;
      if (x !== y) return y - x;
    }
    return (B.tie || 0) - (A.tie || 0);
  }
  /* Rank the four groups 1 (highest) to 4 (lowest). */
  function cipRank(groups) {
    const order = groups.map((gk, i) => ({ gk: gk, i: i }))
      .sort((p, q) => cipCompare(p.gk, q.gk));
    const rank = new Array(4);
    order.forEach((o, k) => { rank[o.i] = k + 1; });
    return rank;
  }

  /* Geometry: positions 0 and 1 are in the plane, 2 is on a wedge
     (toward the viewer) and 3 on a dash (away). Read 1 → 2 → 3 with the
     lowest priority pointing away and the sense gives R or S. If the
     lowest priority is NOT on the dash, the sense must be inverted once
     for every swap needed to put it there — which is what this does. */
  function assignRS(rank, mirror) {
    const angles = [-Math.PI * 0.82, -Math.PI * 0.18, Math.PI * 0.30, Math.PI * 0.70];
    const idxOf = r => rank.indexOf(r);
    const lowIdx = idxOf(4);
    // signed area of the triangle 1→2→3 as drawn on the page
    const p1 = idxOf(1), p2 = idxOf(2), p3 = idxOf(3);
    const A = angles[p1], B = angles[p2], C = angles[p3];
    const pt = a => [Math.cos(a) * (mirror ? -1 : 1), Math.sin(a)];
    const [ax, ay] = pt(A), [bx, by] = pt(B), [cx, cy] = pt(C);
    const cross = (bx - ax) * (cy - ay) - (by - ay) * (cx - ax);
    // canvas y runs downward, so a positive cross product is clockwise
    let clockwise = cross > 0;
    // correction: the reading is only valid with #4 pointing away (dash, index 3)
    if (lowIdx !== 3) {
      // one swap puts it there; every swap inverts the sense
      clockwise = !clockwise;
      // a group on the wedge (index 2) is pointing straight at you, so the
      // apparent rotation is already reversed — that is the same one flip
    }
    return { config: clockwise ? 'R' : 'S', clockwise: clockwise, lowIdx: lowIdx };
  }

  const COMPOUNDS = {
    glyceraldehyde: { name: 'Glyceraldehyde', groups: ['CHO', 'CH2OH', 'OH', 'H'], rot: 8.7, M: 90.08 },
    lactic:         { name: 'Lactic acid',    groups: ['COOH', 'CH3', 'OH', 'H'], rot: 3.8, M: 90.08 },
    bromobutane:    { name: '2-Bromobutane',  groups: ['Br', 'C2H5', 'CH3', 'H'], rot: 23.1, M: 137.02 },
    alanine:        { name: 'Alanine',        groups: ['COOH', 'NH2', 'CH3', 'H'], rot: 14.5, M: 89.09 },
    butanol:        { name: '2-Butanol',      groups: ['OH', 'C2H5', 'CH3', 'H'], rot: 13.5, M: 74.12 },
    phenylethanol:  { name: '1-Phenylethanol', groups: ['OH', 'Ph', 'CH3', 'H'], rot: 42.5, M: 122.17 },
    camphor:        { name: 'Camphor',        groups: ['COOH', 'Ph', 'CH3', 'H'], rot: 44.3, M: 152.23 }
  };

  L.register({
    id: 'chirality', subject: 'chemistry',
    name: 'Chirality, CIP and the Polarimeter',
    chapter: 'Stereochemistry',
    exams: ['JEE Advanced', 'JEE Main', 'NEET UG'],
    weight: 'Very high yield',
    is3D: false,
    stageHint: 'Drag the analyser dial on the right to find the angle of extinction',
    lede: 'Two ideas are examined together and confused constantly. <b>R/S</b> is a labelling convention derived ' +
      'from atomic numbers; <b>(+)/(−)</b> is a measured physical rotation. This lab does both properly: it runs ' +
      'a real Cahn–Ingold–Prelog comparison over the four branches to assign the descriptor, and it runs a ' +
      'working <b>polarimeter</b> in which the plane of polarisation is rotated by α = [α]·l·c and the analyser ' +
      'obeys Malus\'s law. Change the enantiomeric excess and watch the needle move.',

    params: {
      compound: 'bromobutane', g0: 'Br', g1: 'C2H5', g2: 'CH3', g3: 'H',
      mirror: false, ee: 100, conc: 1.0, path: 1.0, lambda: 589, analyser: 0, autoScan: true
    },

    presets: [
      { name: '(R)-2-bromobutane, pure', params: { compound: 'bromobutane', mirror: false, ee: 100, conc: 1, path: 1 } },
      { name: '(S)-2-bromobutane, pure', params: { compound: 'bromobutane', mirror: true, ee: 100, conc: 1, path: 1 } },
      { name: 'Racemic mixture — zero rotation', params: { compound: 'bromobutane', ee: 0, conc: 1, path: 1 } },
      { name: '60% ee — a scalemic mixture', params: { compound: 'bromobutane', ee: 60, conc: 1, path: 1 } },
      { name: 'Glyceraldehyde (the reference)', params: { compound: 'glyceraldehyde', mirror: false, ee: 100 } },
      { name: 'Lactic acid', params: { compound: 'lactic', mirror: false, ee: 100 } },
      { name: '1-Phenylethanol — large rotation', params: { compound: 'phenylethanol', ee: 100, conc: 1, path: 2 } },
      { name: 'Dilute and short tube', params: { compound: 'bromobutane', ee: 100, conc: 0.2, path: 0.5 } }
    ],

    controls: [
      { group: 'The stereocentre', items: [
        { key: 'compound', type: 'select', label: 'Compound', restructure: true, rebuild: true,
          options: Object.keys(COMPOUNDS).map(k => ({ value: k, label: COMPOUNDS[k].name })),
          onChange(S) {
            const c = COMPOUNDS[S.p.compound];
            if (c) { S.p.g0 = c.groups[0]; S.p.g1 = c.groups[1]; S.p.g2 = c.groups[2]; S.p.g3 = c.groups[3]; }
          } },
        { key: 'g0', type: 'select', label: 'Group A (upper left, in plane)', restructure: true,
          options: GKEYS.map(k => ({ value: k, label: GRP[k].label })) },
        { key: 'g1', type: 'select', label: 'Group B (upper right, in plane)', restructure: true,
          options: GKEYS.map(k => ({ value: k, label: GRP[k].label })) },
        { key: 'g2', type: 'select', label: 'Group C (wedge, toward you)', restructure: true,
          options: GKEYS.map(k => ({ value: k, label: GRP[k].label })) },
        { key: 'g3', type: 'select', label: 'Group D (dash, away from you)', restructure: true,
          options: GKEYS.map(k => ({ value: k, label: GRP[k].label })) },
        { key: 'mirror', type: 'toggle', label: 'Reflect in a mirror (make the enantiomer)', restructure: true }
      ] },
      { group: 'Polarimeter', items: [
        { key: 'ee', label: 'Enantiomeric excess', min: -100, max: 100, step: 1, unit: '%',
          fmt: v => v.toFixed(0), restructure: true },
        { key: 'conc', label: 'Concentration <i>c</i>', min: 0.05, max: 3, step: 0.05, unit: 'g/mL',
          fmt: v => v.toFixed(2), restructure: true },
        { key: 'path', label: 'Tube length <i>l</i>', min: 0.5, max: 4, step: 0.1, unit: 'dm',
          fmt: v => v.toFixed(1), restructure: true },
        { key: 'lambda', label: 'Wavelength <i>λ</i>', min: 400, max: 700, step: 1, unit: 'nm',
          fmt: v => v.toFixed(0), restructure: true },
        { key: 'analyser', label: 'Analyser angle', min: -180, max: 180, step: 0.5, unit: '°',
          fmt: v => v.toFixed(1) },
        { key: 'autoScan', type: 'toggle', label: 'Sweep the analyser automatically' }
      ] }
    ],

    setup(S) {
      const p = S.p;
      const groups = [p.g0, p.g1, p.g2, p.g3];
      S.groups = groups;
      S.rank = cipRank(groups);
      S.chiral = new Set(groups).size === 4;
      const rs = assignRS(S.rank, p.mirror);
      S.config = S.chiral ? rs.config : '—';
      S.clockwise = rs.clockwise; S.lowIdx = rs.lowIdx;

      const c = COMPOUNDS[p.compound] || COMPOUNDS.bromobutane;
      S.cmp = c;
      /* Specific rotation has a real wavelength dependence. A one-term
         Drude equation, [α] = k/(λ² − λ0²), reproduces the rise toward
         the blue that every polarimetry experiment shows. */
      const lam = clamp(p.lambda, 380, 800) / 1000;      // µm
      const lam0 = 0.150;
      const kD = c.rot * ((0.589 * 0.589) - lam0 * lam0);
      S.specific = kD / (lam * lam - lam0 * lam0);
      S.specific *= (p.mirror ? -1 : 1);
      // enantiomeric excess scales the rotation linearly
      S.alpha = S.chiral ? S.specific * p.path * p.conc * (p.ee / 100) : 0;
      S.alphaWrapped = ((S.alpha % 360) + 540) % 360 - 180;
      // composition implied by the ee
      const major = (100 + Math.abs(p.ee)) / 2, minor = (100 - Math.abs(p.ee)) / 2;
      S.majorPc = major; S.minorPc = minor;
      S.t = 0;
    },

    step(S, dt) {
      S.t += dt;
      if (S.p.autoScan) S.p.analyser = ((S.p.analyser + dt * 34 + 180) % 360) - 180;
      const rel = (S.p.analyser - S.alphaWrapped) * Math.PI / 180;
      S.I = Math.cos(rel) * Math.cos(rel);                // Malus's law
    },

    onPointer(S, x, y, down) {
      if (!down || !S.dial) return;
      const dx = x - S.dial.x, dy = y - S.dial.y;
      if (Math.hypot(dx, dy) > S.dial.r * 1.5) return;
      S.p.autoScan = false;
      S.p.analyser = Math.atan2(dy, dx) * 180 / Math.PI;
    },

    drawStage(S, g) {
      const ctx = g.ctx, th = g.theme, p = S.p, W = g.w, H = g.h;
      const ground = th['ink-950'];

      /* ---------------- the stereocentre with CIP priorities ---------------- */
      const sx = W * 0.17, sy = H * 0.42;
      const ss = Math.min(W * 0.085, H * 0.19);
      const groups = S.groups.map((k, i) => ({
        label: GRP[k].label,
        priority: S.chiral ? S.rank[i] : null,
        colour: S.chiral && S.rank[i] === 4 ? g.alpha(th['text-3'], .95) : O.elemColour(GRP[k].label[0])
      }));
      O.tetrahedral(ctx, sx, sy, ss, groups, {
        mirror: p.mirror, priorities: S.chiral, ground: ground, size: 13
      });

      // the 1→2→3 arc that gives the descriptor
      if (S.chiral) {
        const ang = [-Math.PI * 0.82, -Math.PI * 0.18, Math.PI * 0.30, Math.PI * 0.70];
        const idxOf = r => S.rank.indexOf(r);
        const mm = p.mirror ? -1 : 1;
        const pAt = i => [sx + Math.cos(mm === 1 ? ang[i] : Math.PI - ang[i]) * ss * 0.66,
                          sy + Math.sin(mm === 1 ? ang[i] : Math.PI - ang[i]) * ss * 0.66];
        const A = pAt(idxOf(1)), B = pAt(idxOf(2)), C = pAt(idxOf(3));
        ctx.strokeStyle = g.alpha(th.chem, .85); ctx.lineWidth = 2;
        ctx.lineCap = 'round'; ctx.lineJoin = 'round';
        const arcR = ss * 0.66;
        const angOf = q => Math.atan2(q[1] - sy, q[0] - sx);
        let aA = angOf(A), aB = angOf(B), aC = angOf(C);
        const step = (from, to) => {
          let d = to - from;
          while (d > Math.PI) d -= TAU;
          while (d < -Math.PI) d += TAU;
          return d;
        };
        ctx.beginPath();
        const d1 = step(aA, aB), d2 = step(aB, aC);
        for (let k = 0; k <= 40; k++) {
          const u = k / 40;
          const a2 = u < 0.5 ? aA + d1 * (u * 2) : aB + d2 * ((u - 0.5) * 2);
          const px = sx + Math.cos(a2) * arcR, py = sy + Math.sin(a2) * arcR;
          k ? ctx.lineTo(px, py) : ctx.moveTo(px, py);
        }
        ctx.stroke();
        const ang2 = Math.atan2(C[0] - sx, -(C[1] - sy)) * 0 + Math.atan2(C[1] - sy, C[0] - sx) + (d2 > 0 ? Math.PI / 2 : -Math.PI / 2);
        ctx.fillStyle = th.chem;
        ctx.beginPath();
        ctx.moveTo(C[0], C[1]);
        ctx.lineTo(C[0] - 9 * Math.cos(ang2 - 0.42), C[1] - 9 * Math.sin(ang2 - 0.42));
        ctx.lineTo(C[0] - 9 * Math.cos(ang2 + 0.42), C[1] - 9 * Math.sin(ang2 + 0.42));
        ctx.closePath(); ctx.fill();
      }

      ctx.font = '700 26px "IBM Plex Sans Condensed",sans-serif';
      ctx.fillStyle = S.chiral ? (S.config === 'R' ? '#4ADE80' : '#5AA9FF') : th['text-3'];
      ctx.textAlign = 'center'; ctx.textBaseline = 'top';
      ctx.fillText(S.chiral ? '(' + S.config + ')' : 'achiral', sx, sy + ss * 1.95);
      ctx.font = '500 9.5px "IBM Plex Mono",monospace'; ctx.fillStyle = th['text-3'];
      ctx.fillText(S.chiral
        ? (S.clockwise ? 'clockwise 1→2→3' : 'anticlockwise 1→2→3')
        : 'two identical groups — not a stereocentre', sx, sy + ss * 1.95 + 30);
      if (S.chiral && S.lowIdx !== 3) {
        ctx.fillStyle = th.warn;
        ctx.fillText('lowest priority is not pointing away — sense inverted once', sx, sy + ss * 1.95 + 44);
      }

      /* ---------------- the polarimeter ---------------- */
      const tx0 = W * 0.34, tx1 = W * 0.73;
      const ty = H * 0.36, tr = Math.min(H * 0.13, 62);

      // source and the polariser
      ctx.font = '500 9.5px "IBM Plex Mono",monospace';
      ctx.fillStyle = th['text-3']; ctx.textAlign = 'center'; ctx.textBaseline = 'bottom';
      ctx.fillText('source ' + p.lambda.toFixed(0) + ' nm', tx0 - 26, ty - tr - 12);
      const srcCol = waveColour(p.lambda);
      ctx.save(); ctx.globalCompositeOperation = 'lighter';
      const sg = ctx.createRadialGradient(tx0 - 26, ty, 0, tx0 - 26, ty, tr * 0.7);
      sg.addColorStop(0, O.rgba(srcCol, .75)); sg.addColorStop(1, O.rgba(srcCol, 0));
      ctx.fillStyle = sg; ctx.beginPath(); ctx.arc(tx0 - 26, ty, tr * 0.7, 0, TAU); ctx.fill();
      ctx.restore();

      // the sample tube
      const tubeGrad = ctx.createLinearGradient(0, ty - tr, 0, ty + tr);
      tubeGrad.addColorStop(0, g.alpha(th['ink-700'], .95));
      tubeGrad.addColorStop(.5, g.alpha(th['ink-800'], .7));
      tubeGrad.addColorStop(1, g.alpha(th['ink-850'], .95));
      ctx.fillStyle = tubeGrad;
      ctx.fillRect(tx0, ty - tr, tx1 - tx0, tr * 2);
      ctx.strokeStyle = g.alpha(th.line, 1); ctx.lineWidth = 1.4;
      ctx.strokeRect(tx0 + .5, ty - tr + .5, tx1 - tx0, tr * 2);
      // end caps
      [tx0, tx1].forEach(x => {
        ctx.fillStyle = g.alpha(th['ink-700'], 1);
        ctx.beginPath(); ctx.ellipse(x, ty, 7, tr, 0, 0, TAU); ctx.fill();
        ctx.strokeStyle = g.alpha(th.line, 1); ctx.lineWidth = 1; ctx.stroke();
      });

      /* The polarisation plane, drawn as a genuinely twisted ribbon: at
         each slice the plane has been rotated by α·(fraction of the tube
         travelled), and the two edges are traced as continuous curves so
         the twist is visible rather than implied. */
      const N = 132;
      const top = [], bot = [];
      for (let i = 0; i < N; i++) {
        const u = i / (N - 1);
        const x = tx0 + u * (tx1 - tx0);
        const rot = S.alpha * u * Math.PI / 180;
        const amp = tr * 0.80 * Math.cos(rot);
        const skew = tr * 0.18 * Math.sin(rot);        // the edge swinging out of the page
        top.push([x + skew, ty - amp, rot]);
        bot.push([x - skew, ty + amp, rot]);
      }
      // the ribbon surface
      const ribbon = ctx.createLinearGradient(tx0, 0, tx1, 0);
      ribbon.addColorStop(0, O.rgba(srcCol, .22));
      ribbon.addColorStop(1, O.rgba(srcCol, .10));
      ctx.fillStyle = ribbon;
      ctx.beginPath();
      top.forEach((q, i) => i ? ctx.lineTo(q[0], q[1]) : ctx.moveTo(q[0], q[1]));
      for (let i = bot.length - 1; i >= 0; i--) ctx.lineTo(bot[i][0], bot[i][1]);
      ctx.closePath(); ctx.fill();
      // the rungs of the field vector
      ctx.lineWidth = 1.3;
      for (let i = 0; i < N; i += 3) {
        const q = top[i], r2 = bot[i];
        const face = Math.abs(Math.cos(q[2]));
        ctx.strokeStyle = O.rgba(srcCol, .18 + .62 * face);
        ctx.beginPath(); ctx.moveTo(q[0], q[1]); ctx.lineTo(r2[0], r2[1]); ctx.stroke();
      }
      // the two edges, bright, so the helix reads
      [top, bot].forEach(edge => {
        ctx.strokeStyle = O.rgba(srcCol, .95); ctx.lineWidth = 2;
        ctx.lineJoin = 'round';
        ctx.beginPath();
        edge.forEach((q, i) => i ? ctx.lineTo(q[0], q[1]) : ctx.moveTo(q[0], q[1]));
        ctx.stroke();
      });
      // entry and exit planes, marked so the rotation can be read off
      [[0, 'in'], [N - 1, 'out']].forEach(([i, nm]) => {
        const q = top[i], r2 = bot[i];
        ctx.strokeStyle = nm === 'in' ? g.alpha(th['text-2'], .9) : th.chem;
        ctx.lineWidth = 2.6;
        ctx.beginPath(); ctx.moveTo(q[0], q[1]); ctx.lineTo(r2[0], r2[1]); ctx.stroke();
        g.label(q[0], q[1] - 12, nm, { size: 9, colour: nm === 'in' ? th['text-3'] : th.chem });
      });

      // the axis of the beam
      ctx.strokeStyle = g.alpha(th['text-3'], .45); ctx.lineWidth = 1;
      ctx.setLineDash([4, 4]);
      ctx.beginPath(); ctx.moveTo(tx0 - 44, ty); ctx.lineTo(tx1 + 30, ty); ctx.stroke();
      ctx.setLineDash([]);

      ctx.font = '500 9.5px "IBM Plex Mono",monospace';
      ctx.fillStyle = th['text-3']; ctx.textAlign = 'center'; ctx.textBaseline = 'top';
      ctx.fillText('sample tube  l = ' + p.path.toFixed(1) + ' dm  ·  c = ' + p.conc.toFixed(2) + ' g/mL',
        (tx0 + tx1) / 2, ty + tr + 12);
      ctx.fillText('plane rotates ' + S.alpha.toFixed(2) + '° over the tube', (tx0 + tx1) / 2, ty + tr + 26);

      /* ---------------- analyser dial ---------------- */
      const dx = W * 0.86, dy = H * 0.40, dr = Math.min(W * 0.085, H * 0.20);
      S.dial = { x: dx, y: dy, r: dr };
      g.hit(dx, dy, dr, 'dial');
      ctx.fillStyle = g.alpha(th['ink-900'], 1);
      ctx.beginPath(); ctx.arc(dx, dy, dr, 0, TAU); ctx.fill();
      ctx.strokeStyle = g.alpha(th.line, 1); ctx.lineWidth = 1.4; ctx.stroke();
      for (let a = 0; a < 360; a += 10) {
        const rad = a * Math.PI / 180, maj = a % 30 === 0;
        ctx.strokeStyle = g.alpha(th['text-3'], maj ? .9 : .4);
        ctx.lineWidth = maj ? 1.4 : 1;
        ctx.beginPath();
        ctx.moveTo(dx + Math.cos(rad) * dr, dy + Math.sin(rad) * dr);
        ctx.lineTo(dx + Math.cos(rad) * dr * (maj ? .86 : .92), dy + Math.sin(rad) * dr * (maj ? .86 : .92));
        ctx.stroke();
      }
      // the plane leaving the tube — where extinction actually occurs
      const aRad = S.alphaWrapped * Math.PI / 180;
      ctx.strokeStyle = O.rgba(srcCol, .85); ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(dx - Math.cos(aRad) * dr * .9, dy - Math.sin(aRad) * dr * .9);
      ctx.lineTo(dx + Math.cos(aRad) * dr * .9, dy + Math.sin(aRad) * dr * .9);
      ctx.stroke();
      // the analyser itself
      const anRad = p.analyser * Math.PI / 180;
      ctx.strokeStyle = th.text; ctx.lineWidth = 2;
      ctx.setLineDash([6, 4]);
      ctx.beginPath();
      ctx.moveTo(dx - Math.cos(anRad) * dr, dy - Math.sin(anRad) * dr);
      ctx.lineTo(dx + Math.cos(anRad) * dr, dy + Math.sin(anRad) * dr);
      ctx.stroke(); ctx.setLineDash([]);
      ctx.fillStyle = th.text;
      ctx.beginPath(); ctx.arc(dx + Math.cos(anRad) * dr, dy + Math.sin(anRad) * dr, 5, 0, TAU); ctx.fill();

      // the transmitted-intensity field at the centre of the dial
      ctx.save(); ctx.globalCompositeOperation = 'lighter';
      const ig = ctx.createRadialGradient(dx, dy, 0, dx, dy, dr * 0.62);
      ig.addColorStop(0, O.rgba(srcCol, 0.06 + 0.85 * (S.I || 0)));
      ig.addColorStop(1, O.rgba(srcCol, 0));
      ctx.fillStyle = ig; ctx.beginPath(); ctx.arc(dx, dy, dr * 0.62, 0, TAU); ctx.fill();
      ctx.restore();

      ctx.font = '600 11px "IBM Plex Mono",monospace';
      ctx.fillStyle = th.text; ctx.textAlign = 'center'; ctx.textBaseline = 'top';
      ctx.fillText('analyser ' + p.analyser.toFixed(1) + '°', dx, dy + dr + 12);
      ctx.font = '500 9.5px "IBM Plex Mono",monospace'; ctx.fillStyle = th['text-3'];
      ctx.fillText('I / I₀ = ' + (S.I || 0).toFixed(3), dx, dy + dr + 27);
      const near = Math.abs(((p.analyser - S.alphaWrapped - 90 + 540) % 180) - 90) < 1.5;
      if (near) {
        ctx.fillStyle = th.ok; ctx.font = '600 10px "IBM Plex Mono",monospace';
        ctx.fillText('EXTINCTION — read α here', dx, dy + dr + 41);
      }

      /* ---------------- composition bar ---------------- */
      const cbx0 = W * 0.34, cbx1 = W * 0.73, cby = H * 0.76;
      const hh = 16;
      ctx.fillStyle = g.alpha('#4ADE80', .75);
      ctx.fillRect(cbx0, cby, (cbx1 - cbx0) * S.majorPc / 100, hh);
      ctx.fillStyle = g.alpha('#5AA9FF', .75);
      ctx.fillRect(cbx0 + (cbx1 - cbx0) * S.majorPc / 100, cby, (cbx1 - cbx0) * S.minorPc / 100, hh);
      ctx.strokeStyle = g.alpha(th.line, 1); ctx.lineWidth = 1;
      ctx.strokeRect(cbx0 + .5, cby + .5, cbx1 - cbx0, hh);
      ctx.font = '500 9.5px "IBM Plex Mono",monospace';
      ctx.fillStyle = th['text-2']; ctx.textAlign = 'left'; ctx.textBaseline = 'bottom';
      ctx.fillText('mixture composition', cbx0, cby - 5);
      ctx.textAlign = 'left'; ctx.textBaseline = 'top';
      ctx.fillStyle = '#4ADE80';
      ctx.fillText(S.majorPc.toFixed(1) + '% ' + (p.ee >= 0 ? (S.config === 'R' ? 'R' : 'S') : (S.config === 'R' ? 'S' : 'R')),
        cbx0, cby + hh + 5);
      ctx.textAlign = 'right'; ctx.fillStyle = '#5AA9FF';
      ctx.fillText(S.minorPc.toFixed(1) + '% enantiomer', cbx1, cby + hh + 5);

      /* ---------------- headline ---------------- */
      ctx.font = '700 17px "IBM Plex Sans Condensed",sans-serif';
      ctx.fillStyle = th.text; ctx.textAlign = 'left'; ctx.textBaseline = 'top';
      const sign = S.alpha > 0.001 ? '(+) dextrorotatory' : S.alpha < -0.001 ? '(−) laevorotatory' : 'optically inactive';
      ctx.fillText(S.cmp.name + '  ·  ' + (S.chiral ? '(' + S.config + ')' : 'achiral') + '  ·  ' + sign, 14, 10);
      ctx.font = '500 10px "IBM Plex Mono",monospace'; ctx.fillStyle = th['text-3'];
      ctx.fillText('observed α = ' + S.alpha.toFixed(3) + '°   ·   [α] = ' + S.specific.toFixed(2) +
        '°·mL/(g·dm)   ·   ee = ' + p.ee.toFixed(0) + '%', 14, 32);
    },

    plots: [
      { title: 'Malus\'s law — what the detector sees as the analyser turns',
        legend: [{ c: '#FFAE4C', label: 'I / I₀' }, { c: '#4ADE80', label: 'extinction' },
                 { c: '#63729A', label: 'analyser now' }],
        draw(S, g) {
          const th = g.theme;
          const pts = [];
          for (let a = -180; a <= 180; a += 1) {
            const rel = (a - S.alphaWrapped) * Math.PI / 180;
            pts.push([a, Math.cos(rel) * Math.cos(rel)]);
          }
          const P = g.Plot({
            xmin: -180, xmax: 180, ymin: 0, ymax: 1.06,
            xticks: [-180, -90, 0, 90, 180], yticks: [0, 0.25, 0.5, 0.75, 1],
            xlabel: 'analyser angle (degrees)', ylabel: 'I / I₀',
            xfmt: v => v.toFixed(0), yfmt: v => v.toFixed(2)
          }).frame();
          P.clip(() => {
            P.area(pts, 0, g.alpha(th.chem, .10));
            P.line(pts, th.chem, 2.2);
            // extinction angles: 90° from the plane
            [S.alphaWrapped + 90, S.alphaWrapped - 90].forEach(a => {
              const aw = ((a + 540) % 360) - 180;
              if (aw >= -180 && aw <= 180) P.vline(aw, g.alpha(th.ok, .8), [4, 3]);
            });
            P.vline(S.alphaWrapped, g.alpha(th.warn, .55), [2, 4]);
            P.vline(S.p.analyser, g.alpha(th.text, .6));
            P.dot(S.p.analyser, S.I || 0, 4.4, th.text, th['ink-950']);
          });
          P.tag(S.alphaWrapped, 1.0, 'plane', th.warn, 'left', 0);
        },
        hover(S, x) {
          const rel = (x - S.alphaWrapped) * Math.PI / 180;
          return [{ label: 'analyser', value: x.toFixed(1) + '°' },
                  { label: 'I / I₀', value: (Math.cos(rel) * Math.cos(rel)).toFixed(4) },
                  { label: 'plane at', value: S.alphaWrapped.toFixed(2) + '°' }];
        } },

      { title: 'Observed rotation is exactly linear in enantiomeric excess',
        legend: [{ c: '#FFAE4C', label: 'α vs ee' }, { c: '#63729A', label: 'this mixture' }],
        draw(S, g) {
          const th = g.theme;
          const full = S.specific * S.p.path * S.p.conc;
          const pts = [[-100, -full], [100, full]];
          const lim = Math.max(Math.abs(full), 0.01) * 1.12;
          const P = g.Plot({
            xmin: -105, xmax: 105, ymin: -lim, ymax: lim,
            xticks: [-100, -50, 0, 50, 100],
            xlabel: 'enantiomeric excess (%)', ylabel: 'observed α (degrees)',
            xfmt: v => v.toFixed(0), yfmt: v => v.toFixed(1)
          }).frame();
          P.clip(() => {
            P.hline(0, g.alpha(th['text-3'], .5), [4, 4]);
            P.vline(0, g.alpha(th['text-3'], .5), [4, 4]);
            P.line(pts, th.chem, 2.4);
            P.dot(S.p.ee, S.alpha, 5, th.warn, th['ink-950']);
            P.tag(0, lim * 0.12, 'racemic: α = 0', g.alpha(th['text-2'], .95), 'left', 0);
          });
        },
        hover(S, x) {
          const full = S.specific * S.p.path * S.p.conc;
          const ee = clamp(x, -100, 100);
          return [{ label: 'ee', value: ee.toFixed(1) + ' %' },
                  { label: 'α observed', value: (full * ee / 100).toFixed(3) + '°' },
                  { label: 'major enantiomer', value: ((100 + Math.abs(ee)) / 2).toFixed(1) + ' %' },
                  { label: 'optical purity', value: Math.abs(ee).toFixed(1) + ' %' }];
        } }
    ],

    readouts(S) {
      const p = S.p;
      return [
        { label: 'Configuration', value: S.chiral ? S.config : 'achiral', unit: '',
          flag: S.chiral ? 'accent' : null, hint: 'CIP descriptor, computed' },
        { label: 'Observed rotation α', value: S.alpha.toFixed(3), unit: '°',
          flag: S.alpha > 0.001 ? 'ok' : S.alpha < -0.001 ? 'warn' : null,
          hint: S.alpha > 0 ? 'dextrorotatory (+)' : S.alpha < 0 ? 'laevorotatory (−)' : 'no net rotation' },
        { label: 'Specific rotation [α]', value: S.specific.toFixed(2), unit: '°mL/g·dm',
          hint: 'at ' + p.lambda.toFixed(0) + ' nm' },
        { label: 'Enantiomeric excess', value: Math.abs(p.ee).toFixed(0), unit: '%' },
        { label: 'Major : minor', value: S.majorPc.toFixed(1) + ' : ' + S.minorPc.toFixed(1), unit: '' },
        { label: 'Transmitted I / I₀', value: (S.I || 0).toFixed(3), unit: '',
          hint: 'Malus: I = I₀cos²(θ − α)' }
      ];
    },

    equation(S) {
      return E.v('α') + E.op('=') + '[' + E.v('α') + ']' + E.op('·') + E.v('l') + E.op('·') + E.v('c') +
        E.op('·') + E.frac('ee', '100') + E.op('=') +
        E.n(S.specific, '', 3) + E.op('×') + E.n(S.p.path, 'dm', 2) + E.op('×') + E.n(S.p.conc, 'g/mL', 2) +
        E.op('×') + E.n(S.p.ee / 100, '', 3) + E.op('=') + E.n(S.alpha, '°', 4) +
        '<br>' + E.v('I') + E.op('=') + E.v('I') + E.sub('0') + ' cos' + E.sup('2') +
        E.op('(') + E.v('θ') + E.op('−') + E.v('α') + E.op(') =') + E.n(S.I || 0, '', 3) + E.v('I') + E.sub('0');
    },
    eqNote: 'Specific rotation is a material constant quoted at a stated wavelength and temperature — the ' +
      'D line of sodium, 589 nm, by convention. Its wavelength dependence here follows a one-term Drude ' +
      'equation, which is why the rotation grows sharply toward the blue.',

    walkthrough: [
      { title: '1 · Four different groups, or nothing happens',
        body: 'Set any two groups to the same thing. The priorities collapse, the descriptor disappears and ' +
          'the rotation goes to zero. A carbon needs <b>four different</b> substituents to be a stereocentre.',
        ask: 'Is every molecule with a stereocentre chiral?',
        reveal: 'No — a meso compound has stereocentres but also an internal mirror plane, so it is achiral overall.' },
      { title: '2 · How the descriptor is actually assigned',
        body: 'Rank by atomic number at the first point of difference. Put the lowest priority away from you, ' +
          'then read 1 → 2 → 3: clockwise is <b>R</b>, anticlockwise is <b>S</b>.',
        ask: 'What if the lowest priority is on the wedge instead?',
        reveal: 'Read the sense as drawn and then <b>invert it once</b>. The stage warns you when this applies.' },
      { title: '3 · R/S and (+)/(−) are unrelated',
        body: 'Look at the headline: it reports both. Change compound and watch them vary independently.',
        ask: 'Can an (R) compound be laevorotatory?',
        reveal: 'Yes, routinely. R/S comes from atomic numbers; (+)/(−) is a measurement. (R)-glyceraldehyde ' +
          'happens to be (+), but that is a coincidence of history, not a rule.' },
      { title: '4 · The polarimeter, honestly',
        body: 'Turn off the automatic sweep and drag the analyser dial. The detector brightness follows ' +
          '<b>Malus\'s law</b>, and the reading is taken where the field goes dark.',
        ask: 'Why is extinction used rather than maximum brightness?',
        reveal: 'The eye judges darkness far more precisely than brightness, and cos² is steepest at the null.' },
      { title: '5 · Concentration and path length are just multipliers',
        body: 'Halve the concentration, then double the tube. The observed α tracks the product <b>l·c</b> exactly.',
        ask: 'What stays constant?',
        reveal: '[α] — the specific rotation. It is the property of the substance; α is the property of your sample.' },
      { title: '6 · Enantiomeric excess is linear',
        body: 'Slide ee from +100 down to 0 and on to −100. The second graph is a straight line through the origin.',
        ask: 'At ee = 0, why is the rotation exactly zero?',
        reveal: 'A racemic mixture has equal amounts of two enantiomers whose rotations are equal and opposite, ' +
          'so they cancel exactly.' },
      { title: '7 · Colour changes the answer',
        body: 'Drag the wavelength from 589 nm toward 400 nm.',
        ask: 'What happens and why?',
        reveal: 'The rotation rises steeply — optical rotatory dispersion. It is why every literature [α] value ' +
          'carries a subscript D for the sodium line.' }
    ],

    quiz: [
      { q: 'A carbon is a stereocentre when it carries:',
        options: ['four different groups', 'at least one double bond',
                  'a hydrogen and a halogen', 'three identical groups'], answer: 0,
        why: 'Four different substituents make the mirror image non-superimposable.' },
      { q: 'In assigning R/S, if the lowest priority group points toward the viewer you must:',
        options: ['reverse the sense you read', 'read it as normal',
                  'always call it R', 'rotate until it is in the plane'], answer: 0,
        why: 'Reading with #4 toward you gives the opposite of the correct sense, so invert once.' },
      { q: 'An equimolar mixture of two enantiomers:',
        options: ['rotates light twice as much', 'is optically inactive',
                  'is called a meso compound', 'has ee = 100%'], answer: 1,
        why: 'The two rotations are equal and opposite, so a racemic mixture shows zero net rotation.' },
      { q: 'Specific rotation [α] depends on all of the following EXCEPT:',
        options: ['temperature', 'wavelength', 'solvent', 'the length of the tube'], answer: 3,
        why: 'Tube length and concentration are divided out in the definition; they affect α, not [α].' },
      { q: 'A sample of a compound with [α] = +40 shows α = +20 in a 1 dm tube at 1 g/mL. Its ee is:',
        options: ['20%', '40%', '50%', '80%'], answer: 2,
        why: 'Observed 20 against a pure value of 40 gives optical purity 50%, and ee equals optical purity.' },
      { q: 'R/S and (+)/(−) are related how?',
        options: ['R is always (+)', 'S is always (−)',
                  'there is no general relationship', 'they are the same thing'], answer: 2,
        why: 'One is a naming convention from atomic numbers; the other is an experimental measurement.' }
    ],

    notes:
      '<b>What this lab computes.</b> The CIP ranking is a real comparison of atomic numbers and duplicated-atom ' +
      'sets, the descriptor comes from the signed area of the 1→2→3 triangle with the lowest-priority correction ' +
      'applied, and the polarimeter runs α = [α]·l·c with Malus\'s law at the analyser.' +
      '<div class="pyq"><em>Exam pattern</em>The single most common error is assuming R corresponds to (+). ' +
      'The second is forgetting to invert when the lowest priority is on the wedge. Both are tested every year.</div>' +
      '<ul><li><b>Enantiomers</b>: non-superimposable mirror images. Identical in every scalar property except ' +
      'the sign of optical rotation and their behaviour toward other chiral things.</li>' +
      '<li><b>Diastereomers</b>: stereoisomers that are not mirror images. Different melting points, ' +
      'solubilities and rotations — which is how resolution works.</li>' +
      '<li><b>Meso</b>: stereocentres present but an internal mirror plane makes the molecule achiral.</li>' +
      '<li>A molecule with <i>n</i> stereocentres has at most 2ⁿ stereoisomers — fewer when meso forms exist.</li>' +
      '<li>ee = |%R − %S|, and optical purity = |α observed| / |α pure| × 100. For an ideal solution they are equal.</li></ul>'
  });

  /* Approximate visible-spectrum colour for the source lamp. */
  function waveColour(nm) {
    const n = clamp(nm, 380, 700);
    if (n < 440) return '#7A5AE8';
    if (n < 490) return '#4A8CE8';
    if (n < 510) return '#3DD6C0';
    if (n < 580) return '#9BE05A';
    if (n < 645) return '#FFAE4C';
    return '#FF6B6B';
  }

})(window.InsightLab, window.ORGART);
