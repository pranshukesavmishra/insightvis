/* ============================================================
   ORGANIC CHEMISTRY — 3. Electrophilic aromatic substitution
   Directing effects computed from Hammett σ⁺ constants and a
   reaction-specific ρ, so the ortho : meta : para distribution
   and the rate relative to benzene are both calculated, not
   recited.
   ============================================================ */
(function (L, O) {
  'use strict';
  const { clamp, TAU, E } = L;

  /* Substituent constants. sp/sm are the σ⁺ values used for
     electrophilic reactions; `so` is the ortho value, which differs
     because of the steric and field effects of being next door.
     `bulk` is a steric factor that suppresses ortho attack. */
  const SUBS = [
    { id: 'NMe2', label: 'N(CH₃)₂', sp: -1.70, sm: -0.16, bulk: 0.55, cls: 'Strong +M', lone: true },
    { id: 'NH2',  label: 'NH₂',     sp: -1.30, sm: -0.16, bulk: 0.75, cls: 'Strong +M', lone: true },
    { id: 'OH',   label: 'OH',      sp: -0.92, sm: 0.12,  bulk: 0.85, cls: 'Strong +M', lone: true },
    { id: 'OMe',  label: 'OCH₃',    sp: -0.78, sm: 0.05,  bulk: 0.70, cls: 'Strong +M', lone: true },
    { id: 'NHAc', label: 'NHCOCH₃', sp: -0.60, sm: 0.21,  bulk: 0.45, cls: 'Moderate +M', lone: true },
    { id: 'Me',   label: 'CH₃',     sp: -0.31, sm: -0.07, bulk: 0.80, cls: 'Weak +I / hyperconjugation' },
    { id: 'tBu',  label: 'C(CH₃)₃', sp: -0.26, sm: -0.10, bulk: 0.12, cls: 'Weak +I, very bulky' },
    { id: 'Ph',   label: 'C₆H₅',    sp: -0.18, sm: 0.11,  bulk: 0.50, cls: 'Weak +M' },
    { id: 'H',    label: 'H',       sp: 0,     sm: 0,     bulk: 1.00, cls: 'Reference' },
    { id: 'F',    label: 'F',       sp: -0.07, sm: 0.35,  bulk: 0.95, cls: 'Deactivating, o/p-directing', lone: true },
    { id: 'Cl',   label: 'Cl',      sp: 0.11,  sm: 0.40,  bulk: 0.85, cls: 'Deactivating, o/p-directing', lone: true },
    { id: 'Br',   label: 'Br',      sp: 0.15,  sm: 0.41,  bulk: 0.80, cls: 'Deactivating, o/p-directing', lone: true },
    { id: 'I',    label: 'I',       sp: 0.14,  sm: 0.36,  bulk: 0.70, cls: 'Deactivating, o/p-directing', lone: true },
    { id: 'COOH', label: 'COOH',    sp: 0.42,  sm: 0.32,  bulk: 0.60, cls: 'Deactivating, m-directing' },
    { id: 'CHO',  label: 'CHO',     sp: 0.73,  sm: 0.35,  bulk: 0.65, cls: 'Deactivating, m-directing' },
    { id: 'CN',   label: 'CN',      sp: 0.66,  sm: 0.56,  bulk: 0.85, cls: 'Deactivating, m-directing' },
    { id: 'SO3H', label: 'SO₃H',    sp: 0.70,  sm: 0.55,  bulk: 0.40, cls: 'Deactivating, m-directing' },
    { id: 'NO2',  label: 'NO₂',     sp: 0.79,  sm: 0.71,  bulk: 0.70, cls: 'Strong −M, m-directing' },
    { id: 'NMe3', label: 'N⁺(CH₃)₃', sp: 0.41, sm: 0.88,  bulk: 0.30, cls: 'Strong −I, m-directing' }
  ];
  const byId = id => SUBS.find(s => s.id === id) || SUBS[8];

  /* Electrophiles, each with its Hammett ρ⁺ and its own bulk. A more
     selective electrophile has a more negative ρ. */
  const ELECS = [
    { id: 'NO2', label: 'Nitration  NO₂⁺', rho: -6.2, bulk: 0.55, eq: 'HNO₃ / H₂SO₄', prod: 'NO₂' },
    { id: 'Br',  label: 'Bromination  Br⁺', rho: -12.1, bulk: 0.50, eq: 'Br₂ / FeBr₃', prod: 'Br' },
    { id: 'Cl',  label: 'Chlorination  Cl⁺', rho: -10.0, bulk: 0.60, eq: 'Cl₂ / AlCl₃', prod: 'Cl' },
    { id: 'SO3', label: 'Sulphonation  SO₃', rho: -4.5, bulk: 0.32, eq: 'fuming H₂SO₄', prod: 'SO₃H' },
    { id: 'FCa', label: 'Friedel–Crafts acylation', rho: -9.1, bulk: 0.30, eq: 'RCOCl / AlCl₃', prod: 'COR' },
    { id: 'FCalk', label: 'Friedel–Crafts alkylation', rho: -2.4, bulk: 0.42, eq: 'RCl / AlCl₃', prod: 'R' }
  ];
  const elecById = id => ELECS.find(e => e.id === id) || ELECS[0];

  /* =====================================================================
     The mechanism, declared as scenes. Ring carbons are numbered from the
     substituted one; `k` is the carbon the electrophile attacks.
     ===================================================================== */
  function ringPos(i) {
    const a = -Math.PI / 2 + i / 6 * TAU;
    return { x: Math.cos(a), y: Math.sin(a) };
  }
  function easMech(subLabel, eLabel, k, canDonate, lone) {
    const C = {};
    for (let i = 0; i < 6; i++) { const q = ringPos(i); C['c' + i] = { x: q.x, y: q.y, label: '' }; }
    const out = (i, f) => { const q = ringPos(i); return { x: q.x * f, y: q.y * f }; };

    const aromaticBonds = [];
    for (let i = 0; i < 6; i++)
      aromaticBonds.push({ a: 'c' + i, b: 'c' + ((i + 1) % 6), order: i % 2 === 0 ? 2 : 1, toward: [0, 0] });

    // the pentadienyl cation: the five carbons that are not sp3 share the
    // charge, so every bond between them is drawn at order 1.5
    const areniumBonds = [];
    for (let i = 0; i < 6; i++) {
      const a = i, b = (i + 1) % 6;
      const touchesSp3 = (a === k || b === k);
      areniumBonds.push({ a: 'c' + a, b: 'c' + b, order: touchesSp3 ? 1 : 1.5, toward: [0, 0] });
    }

    const subAt = out(0, 1.85);
    const eOut = out(k, 2.55), eOn = out(k, 1.72);
    const hPerp = (() => {
      const q = ringPos(k);
      return { x: q.x * 1.55 - q.y * 0.72, y: q.y * 1.55 + q.x * 0.72 };
    })();
    const baseFar = { x: hPerp.x * 1.85, y: hPerp.y * 1.85 };

    const sub = extra => Object.assign({
      x: subAt.x, y: subAt.y, label: subLabel, colour: '#FFAE4C', lone: lone ? [-Math.PI / 2] : null
    }, extra || {});

    const S0 = {
      name: '1 · attack',
      caption: 'The π cloud attacks the electrophile',
      sub: 'the ring gives up its aromaticity — the slow, rate-determining step',
      atoms: Object.assign({}, C, {
        sub: sub(),
        E: { x: eOut.x, y: eOut.y, label: eLabel, colour: '#FF6B6B', charge: 1, hot: 1 }
      }),
      bonds: aromaticBonds.concat([{ a: 'c0', b: 'sub', order: 1 }]),
      arrows: [
        { from: { bond: 'c' + k + '|c' + ((k + 1) % 6) }, to: { atom: 'E' }, bow: 0.30,
          label: '2e⁻' }
      ]
    };

    const S1 = {
      name: '2 · arenium',
      caption: 'The arenium (Wheland) ion',
      sub: 'four π electrons over five carbons — the charge is shared, and δ+ marks where',
      atoms: Object.assign({}, C, {
        sub: sub({ charge: canDonate ? 0.4 : 0 }),
        E: { x: eOn.x, y: eOn.y, label: eLabel, colour: '#FF6B6B', hot: 0.6 },
        H: { x: hPerp.x, y: hPerp.y, label: 'H', colour: '#C9D4EA' },
        B: { x: baseFar.x, y: baseFar.y, label: 'B⁻', colour: '#5AA9FF', charge: -1, alpha: 1 }
      }),
      bonds: areniumBonds.concat([
        { a: 'c0', b: 'sub', order: canDonate ? 1.5 : 1 },
        { a: 'c' + k, b: 'E', order: 1, style: 'wedge' },
        { a: 'c' + k, b: 'H', order: 1, style: 'dash' }
      ]),
      arrows: [
        { from: { bond: 'c' + k + '|H' }, to: { bond: 'c' + k + '|c' + ((k + 5) % 6) }, bow: -0.40,
          label: 'rearomatise' },
        { from: { atom: 'B' }, to: { atom: 'H', dx: 0.10, dy: 0.10 }, bow: 0.34, colour: '#5AA9FF' }
      ]
    };
    // partial charges on the three carbons that actually carry them
    [(k + 1) % 6, (k + 3) % 6, (k + 5) % 6].forEach(i => {
      S1.atoms['c' + i] = Object.assign({}, C['c' + i], { charge: 0.33, hot: 0.5 });
    });

    const S2 = {
      name: '3 · product',
      caption: 'Aromaticity restored',
      sub: 'the base removes the proton — fast, and never rate-determining',
      atoms: Object.assign({}, C, {
        sub: sub(),
        E: { x: eOn.x, y: eOn.y, label: eLabel, colour: '#4ADE80' },
        H: { x: baseFar.x * 1.15, y: baseFar.y * 1.15, label: 'H–B', colour: '#5AA9FF' }
      }),
      bonds: aromaticBonds.concat([
        { a: 'c0', b: 'sub', order: 1 },
        { a: 'c' + k, b: 'E', order: 1 }
      ]),
      arrows: []
    };
    return [S0, S1, S2];
  }


  L.register({
    id: 'eas', subject: 'chemistry',
    name: 'Electrophilic Aromatic Substitution — Directing Effects from First Principles',
    chapter: 'Aromatic Compounds',
    exams: ['JEE Advanced', 'JEE Main', 'NEET UG'],
    weight: 'Very high yield',
    is3D: false,
    stageHint: 'Click any ring position to inspect the arenium ion formed by attack there',
    lede: 'Ortho–para and meta directing is usually taught as a list. It is really a <b>rate calculation</b>. ' +
      'This lab takes the Hammett σ⁺ constant of the substituent and the ρ of the electrophile, computes a ' +
      '<b>partial rate factor</b> for every position on the ring, and turns those into an isomer distribution ' +
      'and a rate relative to benzene. The <b>arenium ion</b> for the position you select is drawn with its ' +
      'three resonance contributors, so you can see exactly where the positive charge goes.',

    params: {
      sub: 'OMe', elec: 'NO2', T: 298, attack: 4, steric: true,
      showArenium: true, mechPlay: true, mechStep: 0, mechSpeed: 1
    },

    presets: [
      { name: 'Anisole + nitration', params: { sub: 'OMe', elec: 'NO2', attack: 4 } },
      { name: 'Toluene + bromination', params: { sub: 'Me', elec: 'Br', attack: 4 } },
      { name: 'Nitrobenzene + nitration', params: { sub: 'NO2', elec: 'NO2', attack: 3 } },
      { name: 'Chlorobenzene — deactivated but o/p', params: { sub: 'Cl', elec: 'NO2', attack: 4 } },
      { name: 't-Butylbenzene — sterics take over', params: { sub: 'tBu', elec: 'Br', attack: 4 } },
      { name: 'Benzaldehyde + bromination', params: { sub: 'CHO', elec: 'Br', attack: 3 } },
      { name: 'Anilinium ion — the protonation trap', params: { sub: 'NMe3', elec: 'NO2', attack: 3 } },
      { name: 'Benzene reference', params: { sub: 'H', elec: 'NO2', attack: 4 } }
    ],

    controls: [
      { group: 'The substrate', items: [
        { key: 'sub', type: 'select', label: 'Substituent already on the ring', restructure: true,
          options: SUBS.map(s => ({ value: s.id, label: s.label })) }
      ] },
      { group: 'The electrophile', items: [
        { key: 'elec', type: 'select', label: 'Reaction', restructure: true,
          options: ELECS.map(e => ({ value: e.id, label: e.label })) },
        { key: 'T', label: 'Temperature <i>T</i>', min: 253, max: 450, step: 1, unit: 'K',
          fmt: v => v.toFixed(0), restructure: true },
        { key: 'steric', type: 'toggle', label: 'Include the steric penalty at ortho', restructure: true }
      ] },
      { group: 'Mechanism', items: [
        { key: 'attack', type: 'select', label: 'Position attacked', restructure: true, options: [
          { value: 2, label: 'ortho (C-2)' }, { value: 3, label: 'meta (C-3)' }, { value: 4, label: 'para (C-4)' }] },
        { key: 'showArenium', type: 'toggle', label: 'Run the mechanism animation' },
        { key: 'mechPlay', type: 'toggle', label: 'Play', when: S => S.p.showArenium },
        { key: 'mechStep', label: 'Step', min: 0, max: 2, step: 1,
          fmt: v => ['1 · attack', '2 · arenium', '3 · product'][Math.round(v)] || '1',
          when: S => S.p.showArenium && !S.p.mechPlay,
          onChange(S) { if (S.mech) { S.mech.i = Math.round(S.p.mechStep); S.mech.u = 0; } } },
        { key: 'mechSpeed', label: 'Animation speed', min: 0.3, max: 2.5, step: 0.1, unit: '×',
          fmt: v => v.toFixed(1), when: S => S.p.showArenium && S.p.mechPlay }
      ] }
    ],

    setup(S) {
      const p = S.p;
      const sub = byId(p.sub), el = elecById(p.elec);
      S.sub = sub; S.el = el;

      /* Partial rate factor for each position: log f = ρ σ⁺.
         There are two equivalent ortho positions and two meta, one para,
         which is why the statistical factors below are 2, 2 and 1. */
      const sigma = { o: sub.sp * 0.92 + sub.sm * 0.08, m: sub.sm, p: sub.sp };
      // ortho feels the substituent through both resonance and field, and
      // the classic correction is that it behaves mostly like para
      const f = {
        o: Math.pow(10, el.rho * sigma.o),
        m: Math.pow(10, el.rho * sigma.m),
        p: Math.pow(10, el.rho * sigma.p)
      };
      // steric suppression of ortho attack: the product of how bulky the
      // existing group is and how bulky the incoming electrophile is
      S.sterFac = p.steric ? clamp(sub.bulk * (0.35 + 0.65 * el.bulk) * 1.35, 0.02, 1) : 1;
      const fo = f.o * S.sterFac;
      S.f = { o: fo, m: f.m, p: f.p };

      const wo = 2 * fo, wm = 2 * f.m, wp = 1 * f.p;
      const tot = wo + wm + wp || 1;
      S.dist = { o: wo / tot * 100, m: wm / tot * 100, p: wp / tot * 100 };
      // rate relative to benzene: benzene has six equivalent positions
      S.krel = (wo + wm + wp) / 6;
      S.activating = S.krel > 1;

      // free energies implied by those rate factors, for the profile
      const RT = 8.314462618e-3 * clamp(p.T, 1, 1000);
      S.dG = {
        o: -RT * Math.log(Math.max(fo, 1e-30)),
        m: -RT * Math.log(Math.max(f.m, 1e-30)),
        p: -RT * Math.log(Math.max(f.p, 1e-30))
      };
      S.major = S.dist.p >= S.dist.o && S.dist.p >= S.dist.m ? 'para'
              : S.dist.o >= S.dist.m ? 'ortho' : 'meta';
      S.directs = (S.dist.o + S.dist.p) > S.dist.m ? 'ortho / para' : 'meta';
      S.t = 0;
      const kIdx = p.attack === 2 ? 1 : p.attack === 3 ? 2 : 3;
      S.steps = easMech(sub.label, el.prod, kIdx, !!sub.lone && p.attack !== 3, !!sub.lone);
      S.mech = MECH.makeState(S.steps.length);
      S.mech.i = clamp(Math.round(p.mechStep), 0, S.steps.length - 1);
      S.mech.playing = !!p.mechPlay;
    },

    step(S, dt) {
      S.t += dt;
      if (!S.mech) return;
      S.mech.playing = !!S.p.mechPlay;
      if (S.mech.playing) {
        MECH.advance(S.mech, dt * clamp(S.p.mechSpeed, 0.1, 4), { travel: 2.2, dwell: 1.2 });
        S.p.mechStep = S.mech.i;
      } else {
        S.mech.i = clamp(Math.round(S.p.mechStep), 0, S.steps.length - 1);
        S.mech.u = 0;
      }
    },

    onPointer(S, x, y, down) {
      if (!down) return;
      if (S.transport) {
        const hit = S.transport.find(q => Math.hypot(x - q.x, y - q.y) < 14);
        if (hit) { S.p.mechPlay = false; S.p.mechStep = hit.i; S.mech.i = hit.i; S.mech.u = 0; return; }
      }
      if (!S.ringPts) return;
      let best = -1, bd = 1e9;
      S.ringPts.forEach((q, i) => {
        const d = Math.hypot(x - q[0], y - q[1]);
        if (d < bd) { bd = d; best = i; }
      });
      if (bd < 34 && best > 0) {
        const pos = best === 1 || best === 5 ? 2 : best === 2 || best === 4 ? 3 : 4;
        if (S.p.attack !== pos) { S.p.attack = pos; this.setup ? null : null; }
      }
    },

    drawStage(S, g) {
      const ctx = g.ctx, th = g.theme, p = S.p, W = g.w, H = g.h;
      const ground = th['ink-950'];
      const sub = S.sub, el = S.el;

      /* ---------------- the substrate ring with position heat ---------------- */
      const cx = W * 0.18, cy = H * 0.42;
      const r = Math.min(W * 0.095, H * 0.20);
      const pts = O.ring(ctx, cx, cy, r, 6, {
        aromatic: true, colour: g.alpha(th['text-2'], .9), width: 2.2,
        aromaticColour: g.alpha(th.chem, .5)
      });
      S.ringPts = pts;

      // position 0 carries the substituent; 1/5 ortho, 2/4 meta, 3 para
      const kind = ['ipso', 'o', 'm', 'p', 'm', 'o'];
      const fmax = Math.max(S.f.o, S.f.m, S.f.p, 1e-30);
      pts.forEach((q, i) => {
        if (i === 0) return;
        const k = kind[i];
        const fv = S.f[k] || 0;
        const heat = clamp(Math.log10(fv / fmax) / 4 + 1, 0, 1);     // 4 decades of range
        const sel = (p.attack === 2 && (i === 1 || i === 5)) ||
                    (p.attack === 3 && (i === 2 || i === 4)) ||
                    (p.attack === 4 && i === 3);
        ctx.save(); ctx.globalCompositeOperation = 'lighter';
        const rg = ctx.createRadialGradient(q[0], q[1], 0, q[0], q[1], r * 0.46);
        const col = heat > 0.55 ? '#4ADE80' : heat > 0.25 ? '#FFAE4C' : '#FB7185';
        rg.addColorStop(0, g.alpha(col, .10 + .62 * heat));
        rg.addColorStop(1, g.alpha(col, 0));
        ctx.fillStyle = rg;
        ctx.beginPath(); ctx.arc(q[0], q[1], r * 0.46, 0, TAU); ctx.fill();
        ctx.restore();
        if (sel) {
          ctx.strokeStyle = th.chem; ctx.lineWidth = 2;
          ctx.beginPath(); ctx.arc(q[0], q[1], r * 0.27, 0, TAU); ctx.stroke();
        }
        g.hit(q[0], q[1], r * 0.30, 'pos' + i);
        ctx.font = '600 9px "IBM Plex Mono",monospace';
        ctx.fillStyle = sel ? th.chem : th['text-3'];
        ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
        const lx = cx + (q[0] - cx) * 1.42, ly = cy + (q[1] - cy) * 1.42;
        g.label(lx, ly, k, { size: 9, weight: 600, colour: sel ? th.chem : th['text-3'] });
        g.label(lx, ly + 12,
          fv >= 1000 ? fv.toExponential(1) : fv >= 0.01 ? fv.toFixed(2) : fv.toExponential(1),
          { size: 8.5, colour: g.alpha(th['text-3'], .95) });
      });
      // the substituent itself
      if (sub.id !== 'H') {
        const q = pts[0];
        const ex = cx + (q[0] - cx) * 1.62, ey = cy + (q[1] - cy) * 1.62;
        O.bond(ctx, q[0], q[1], ex, ey, { colour: th.chem, width: 2.2, trim1: 12 });
        O.atom(ctx, ex, ey, sub.label, { size: 13, ground: ground, colour: th.chem });
        if (sub.lone) O.lonePairs(ctx, ex, ey - 13, 7, [-Math.PI / 2], th.chem);
      }
      ctx.font = '500 9.5px "IBM Plex Mono",monospace';
      ctx.fillStyle = th['text-3']; ctx.textAlign = 'center'; ctx.textBaseline = 'top';
      ctx.fillText('partial rate factors', cx, cy + r * 2.15);
      ctx.fillText('(per position, vs one C–H of benzene)', cx, cy + r * 2.15 + 13);

      /* ---------------- the mechanism, animated ---------------- */
      if (p.showArenium && S.steps) {
        const mx = W * 0.53, my = H * 0.40;
        const ms = Math.min(W * 0.082, H * 0.145);
        const fr = MECH.frame(S.steps, S.mech.i, S.mech.u, S.mech.a);

        MECH.draw(ctx, fr, { x: mx, y: my, s: ms }, {
          ground: ground, colour: g.alpha(th['text-2'], .95),
          arrow: th.chem, forming: '#4ADE80', breaking: '#FB7185', delocal: '#8FA4CE',
          width: 2.5
        });

        // caption block above the figure
        ctx.font = '600 12px "IBM Plex Mono",monospace';
        ctx.fillStyle = th.chem; ctx.textAlign = 'center'; ctx.textBaseline = 'top';
        ctx.fillText(fr.caption, mx, H * 0.075);
        ctx.font = '500 9.5px "IBM Plex Mono",monospace'; ctx.fillStyle = th['text-3'];
        ctx.fillText(fr.sub, mx, H * 0.075 + 17);

        // the step transport, which is also clickable
        const tx0 = mx - ms * 2.0, tx1 = mx + ms * 2.0;
        S.transport = MECH.transport(ctx, tx0, tx1, H * 0.80, S.steps, S.mech, th, g.alpha);
        S.transport.forEach(q => g.hit(q.x, q.y, 12, 'step' + q.i));

        // the one thing the mechanism cannot show on its own: whether the
        // donor can reach the charge from where the electrophile landed
        if (S.mech.i === 1) {
          const can = !!sub.lone && p.attack !== 3;
          ctx.font = '600 10px "IBM Plex Sans",sans-serif';
          ctx.fillStyle = can ? th.ok : th.crit;
          ctx.textAlign = 'center'; ctx.textBaseline = 'top';
          ctx.fillText(can
            ? 'the charge reaches the carbon bearing ' + sub.label + ' — its lone pair can quench it'
            : (sub.lone ? 'meta attack keeps the charge away from ' + sub.label
                        : 'no lone pair on ' + sub.label + ' to donate'),
            mx, H * 0.705);
        }
      }

      /* ---------------- isomer distribution bars ---------------- */
      const bx0 = W * 0.795, bx1 = W - 20;
      const by0 = H * 0.74, by1 = H * 0.22;
      ctx.strokeStyle = g.alpha(th.line, 1); ctx.lineWidth = 1;
      ctx.beginPath(); ctx.moveTo(bx0 - 6, by0); ctx.lineTo(bx1, by0); ctx.stroke();
      const rows = [['ortho', g.tween('bo', S.dist.o, 0.22), '#FFAE4C'],
                    ['meta', g.tween('bm', S.dist.m, 0.22), '#5AA9FF'],
                    ['para', g.tween('bp', S.dist.p, 0.22), '#4ADE80']];
      const bw = (bx1 - bx0) / 3.4;
      rows.forEach(([nm, v, col], i) => {
        const x = bx0 + i * bw * 1.14;
        const h = (v / 100) * (by0 - by1);
        const grd = ctx.createLinearGradient(0, by0, 0, by0 - h);
        grd.addColorStop(0, g.alpha(col, .28)); grd.addColorStop(1, g.alpha(col, .92));
        ctx.fillStyle = grd;
        ctx.fillRect(x, by0 - h, bw * 0.86, h);
        ctx.strokeStyle = g.alpha(col, .95); ctx.lineWidth = 1.2;
        ctx.strokeRect(x + .5, by0 - h + .5, bw * 0.86, h);
        ctx.font = '600 11px "IBM Plex Mono",monospace';
        ctx.fillStyle = col; ctx.textAlign = 'center'; ctx.textBaseline = 'bottom';
        ctx.fillText(v.toFixed(1) + '%', x + bw * 0.43, by0 - h - 5);
        ctx.font = '9.5px "IBM Plex Mono",monospace'; ctx.fillStyle = th['text-3'];
        ctx.textBaseline = 'top';
        ctx.fillText(nm, x + bw * 0.43, by0 + 6);
      });
      ctx.font = '500 9.5px "IBM Plex Mono",monospace';
      ctx.fillStyle = th['text-2']; ctx.textAlign = 'center'; ctx.textBaseline = 'bottom';
      ctx.fillText('isomer distribution', (bx0 + bx1) / 2, by1 - 8);

      /* ---------------- headline ---------------- */
      ctx.font = '700 17px "IBM Plex Sans Condensed",sans-serif';
      ctx.fillStyle = S.activating ? th.ok : th.crit;
      ctx.textAlign = 'left'; ctx.textBaseline = 'top';
      ctx.fillText((sub.id === 'H' ? 'Benzene' : sub.label + '–C₆H₅') + '  ·  ' +
        (S.activating ? 'ACTIVATED' : 'DEACTIVATED') + '  ·  ' + S.directs + ' directing', 14, 10);
      ctx.font = '500 10px "IBM Plex Mono",monospace'; ctx.fillStyle = th['text-3'];
      ctx.fillText(el.eq + '   ·   ρ⁺ = ' + el.rho.toFixed(1) + '   ·   σ⁺p = ' + sub.sp.toFixed(2) +
        ', σ⁺m = ' + sub.sm.toFixed(2) + '   ·   ' + sub.cls, 14, 32);
    },

    plots: [
      { title: 'Hammett plot — log(k/k₀) against σ⁺ for this electrophile',
        legend: [{ c: '#FFAE4C', label: 'ρ⁺ line' }, { c: '#4ADE80', label: 'activators' },
                 { c: '#FB7185', label: 'deactivators' }],
        draw(S, g) {
          const th = g.theme, rho = S.el.rho;
          const xs = SUBS.map(s => s.sp);
          const xmin = Math.min(...xs) - 0.2, xmax = Math.max(...xs) + 0.2;
          const ys = [rho * xmin, rho * xmax];
          const P = g.Plot({
            xmin: xmin, xmax: xmax, ymin: Math.min(...ys) - 0.5, ymax: Math.max(...ys) + 0.5,
            xlabel: 'σ⁺ (para)', ylabel: 'log (k / k₀)',
            xfmt: v => v.toFixed(1), yfmt: v => v.toFixed(0)
          }).frame();
          P.clip(() => {
            P.hline(0, g.alpha(th['text-3'], .5), [4, 4]);
            P.vline(0, g.alpha(th['text-3'], .5), [4, 4]);
            P.line([[xmin, rho * xmin], [xmax, rho * xmax]], th.chem, 2.2);
            SUBS.forEach(s => {
              const y = rho * s.sp;
              P.dot(s.sp, y, s.id === S.p.sub ? 5.2 : 3.2,
                y > 0 ? '#4ADE80' : y < 0 ? '#FB7185' : th['text-2'],
                s.id === S.p.sub ? th.chem : th['ink-950']);
              if (s.id === S.p.sub || Math.abs(s.sp) > 0.55)
                P.tag(s.sp, y, s.label, s.id === S.p.sub ? th.chem : g.alpha(th['text-3'], .95),
                  s.sp > 0 ? 'right' : 'left', -9);
            });
          });
        },
        hover(S, x) {
          const near = SUBS.reduce((b, s) => Math.abs(s.sp - x) < Math.abs(b.sp - x) ? s : b, SUBS[0]);
          const lg = S.el.rho * near.sp;
          return [{ label: 'substituent', value: near.label },
                  { label: 'σ⁺p', value: near.sp.toFixed(2) },
                  { label: 'log(k/k₀)', value: lg.toFixed(2) },
                  { label: 'k / k₀', value: Math.pow(10, lg).toExponential(2) },
                  { label: 'class', value: near.cls }];
        } },

      { title: 'Every substituent ranked — activation and the ortho : meta : para split',
        legend: [{ c: '#FFAE4C', label: 'ortho' }, { c: '#5AA9FF', label: 'meta' }, { c: '#4ADE80', label: 'para' }],
        draw(S, g) {
          const th = g.theme, ctx = g.ctx, el = S.el;
          const data = SUBS.map(s => {
            const so = s.sp * 0.92 + s.sm * 0.08;
            const st = S.p.steric ? clamp(s.bulk * (0.35 + 0.65 * el.bulk) * 1.35, 0.02, 1) : 1;
            const fo = Math.pow(10, el.rho * so) * st;
            const fm = Math.pow(10, el.rho * s.sm), fp = Math.pow(10, el.rho * s.sp);
            const tot = 2 * fo + 2 * fm + fp || 1;
            return { s: s, o: 2 * fo / tot * 100, m: 2 * fm / tot * 100, p: fp / tot * 100 };
          });
          const P = g.Plot({
            xmin: -0.5, xmax: SUBS.length - 0.5, ymin: 0, ymax: 100,
            xticks: SUBS.map((_, i) => i), yticks: [0, 25, 50, 75, 100],
            xfmt: v => (SUBS[Math.round(v)] || { label: '' }).label,
            ylabel: '% of product', yfmt: v => v.toFixed(0),
            pad: { l: 46, r: 14, t: 12, b: 40 }
          }).frame();
          P.clip(() => {
            data.forEach((d, i) => {
              const on = d.s.id === S.p.sub;
              let base = 0;
              [['o', '#FFAE4C'], ['m', '#5AA9FF'], ['p', '#4ADE80']].forEach(([k, col]) => {
                const v = d[k];
                const xa = P.X(i - 0.38), xb = P.X(i + 0.38);
                ctx.fillStyle = g.alpha(col, on ? .95 : .42);
                ctx.fillRect(xa, P.Y(base + v), xb - xa, P.Y(base) - P.Y(base + v));
                base += v;
              });
              if (on) {
                ctx.strokeStyle = th.chem; ctx.lineWidth = 1.6;
                ctx.strokeRect(P.X(i - 0.38), P.Y(100), P.X(i + 0.38) - P.X(i - 0.38), P.Y(0) - P.Y(100));
              }
            });
          });
        },
        hover(S, x) {
          const i = clamp(Math.round(x), 0, SUBS.length - 1);
          const s = SUBS[i], el = S.el;
          const so = s.sp * 0.92 + s.sm * 0.08;
          const st = S.p.steric ? clamp(s.bulk * (0.35 + 0.65 * el.bulk) * 1.35, 0.02, 1) : 1;
          const fo = Math.pow(10, el.rho * so) * st;
          const fm = Math.pow(10, el.rho * s.sm), fp = Math.pow(10, el.rho * s.sp);
          const tot = 2 * fo + 2 * fm + fp || 1;
          return [{ label: 'substituent', value: s.label },
                  { label: 'ortho', value: (2 * fo / tot * 100).toFixed(1) + ' %', color: '#FFAE4C' },
                  { label: 'meta', value: (2 * fm / tot * 100).toFixed(1) + ' %', color: '#5AA9FF' },
                  { label: 'para', value: (fp / tot * 100).toFixed(1) + ' %', color: '#4ADE80' },
                  { label: 'k/k₀', value: (tot / 6).toExponential(2) }];
        } }
    ],

    readouts(S) {
      return [
        { label: 'Rate vs benzene', value: S.krel >= 1000 || S.krel < 0.01 ? S.krel.toExponential(2) : S.krel.toFixed(3),
          unit: '', flag: S.activating ? 'ok' : 'crit',
          hint: S.activating ? 'activating' : 'deactivating' },
        { label: 'Major product', value: S.major, unit: '', flag: 'accent' },
        { label: 'ortho', value: S.dist.o.toFixed(1), unit: '%' },
        { label: 'meta', value: S.dist.m.toFixed(1), unit: '%' },
        { label: 'para', value: S.dist.p.toFixed(1), unit: '%' },
        { label: 'Steric factor at ortho', value: S.sterFac.toFixed(2), unit: '',
          hint: S.sterFac < 0.4 ? 'ortho is badly crowded' : 'ortho is accessible' }
      ];
    },

    equation(S) {
      return 'log ' + E.frac(E.v('k'), E.v('k') + E.sub('0')) + E.op('=') + E.v('ρ') + E.sup('+') +
        E.v('σ') + E.sup('+') + '&nbsp;&nbsp;&nbsp;' +
        E.v('f') + E.sub('p') + E.op('=') + E.n(S.f.p, '', 3) + '&nbsp;&nbsp;' +
        E.v('f') + E.sub('o') + E.op('=') + E.n(S.f.o, '', 3) + '&nbsp;&nbsp;' +
        E.v('f') + E.sub('m') + E.op('=') + E.n(S.f.m, '', 3) + '&nbsp;&nbsp;&nbsp;' +
        E.frac(E.v('k'), E.v('k') + E.sub('0')) + E.op('=') +
        E.frac('2' + E.v('f') + E.sub('o') + ' + 2' + E.v('f') + E.sub('m') + ' + ' + E.v('f') + E.sub('p'), '6') +
        E.op('=') + E.n(S.krel, '', 3);
    },
    eqNote: 'ρ⁺ measures how much the electrophile cares about electron density — bromination (ρ⁺ ≈ −12) is far ' +
      'more selective than Friedel–Crafts alkylation (ρ⁺ ≈ −2.4), which is exactly why alkylation gives messy ' +
      'mixtures. σ⁺ measures how much the substituent supplies or withdraws. The product of the two is the answer.',

    walkthrough: [
      { title: '1 · Benzene is the zero of the scale',
        body: 'Load the benzene preset. Every position has a partial rate factor of exactly 1 and the rate ' +
          'relative to benzene is 1. This is the reference everything else is measured against.',
        ask: 'Why are there six equivalent positions?',
        reveal: 'All six C–H bonds are identical, so k/k₀ = (2f_o + 2f_m + f_p)/6 = 1 when every f is 1.' },
      { title: '2 · Anisole: the lone pair does the work',
        body: 'Switch to OCH₃. σ⁺p = −0.78, so with ρ⁺ = −6.2 the para partial rate factor is about <b>10⁴·⁸</b>. ' +
          'Watch the para position glow green.',
        ask: 'Look at the arenium ion and cycle the contributors. Which one is special?',
        reveal: 'The contributor that puts the positive charge on the carbon bearing OCH₃ — the oxygen lone pair ' +
          'closes onto it, giving a fourth structure where <b>every atom has an octet</b>. That extra ' +
          'stabilisation is available only for ortho and para attack.' },
      { title: '3 · Meta attack cannot use the lone pair',
        body: 'Set the attacked position to meta and cycle the contributors again.',
        ask: 'Does the charge ever land on the substituted carbon?',
        reveal: 'No. For meta attack the charge appears at positions 2, 4 and 6 relative to the sp³ carbon, ' +
          'never at position 1. The donor is a bystander, so meta is not accelerated.' },
      { title: '4 · Nitrobenzene inverts everything',
        body: 'Choose NO₂. Now σ⁺ is large and positive, so every f drops below 1 — the ring is <b>deactivated</b>. ' +
          'But meta is deactivated least, because σ⁺m (0.71) is only slightly smaller than σ⁺p (0.79).',
        ask: 'So why is NO₂ called meta-directing if it slows meta down too?',
        reveal: 'Directing is about the <b>ratio</b>, not the absolute rate. Meta is a thousand times less bad ' +
          'than para, so meta is what you get — even though the whole reaction is 10⁵ times slower than benzene.' },
      { title: '5 · Halogens are the classic exception',
        body: 'Pick Cl. σ⁺m = 0.40 but σ⁺p = only 0.11. The ring is deactivated overall, yet ortho and para still win.',
        ask: 'How can one group both deactivate and direct ortho/para?',
        reveal: 'Two opposing effects. The strong <b>−I</b> withdrawal slows every position down; the weak <b>+M</b> ' +
          'donation from the lone pair selectively rescues ortho and para. Induction sets the rate, resonance ' +
          'sets the position.' },
      { title: '6 · Sterics decide ortho versus para',
        body: 'Load t-butylbenzene with bromination and toggle the steric penalty off and on.',
        ask: 'What happens to the ortho fraction?',
        reveal: 'It collapses. Electronically ortho and para are comparable; it is the bulk of t-butyl and of ' +
          'the incoming Br⁺ that pushes the product almost entirely to para.' },
      { title: '7 · Aniline in acid is a trap',
        body: 'Compare NH₂ with N⁺(CH₃)₃. The free amine is one of the strongest activators known; ' +
          'the ammonium ion is a strong <b>meta</b> director.',
        ask: 'Why does nitrating aniline give a lot of meta product?',
        reveal: 'The nitrating mixture protonates the nitrogen. The lone pair is gone, and what is left is a ' +
          'positively charged, powerfully −I group — so the ring behaves like the anilinium ion, not like aniline.' }
    ],

    quiz: [
      { q: 'A substituent is ortho/para directing when it:',
        options: ['withdraws electron density inductively',
                  'can stabilise positive charge at the ortho and para carbons of the arenium ion',
                  'is bulky', 'has a high molecular mass'], answer: 1,
        why: 'Only ortho and para attack put the charge on the substituted carbon, where a donor can quench it.' },
      { q: 'Chlorobenzene is nitrated slower than benzene but gives mainly o- and p-nitrochlorobenzene because:',
        options: ['−I deactivates the ring while +M selectively stabilises o/p attack',
                  '+I activates and −M directs', 'Cl is a strong activator',
                  'the chlorine migrates during the reaction'], answer: 0,
        why: 'Induction controls the overall rate; resonance controls the position. This is the classic split.' },
      { q: 'Which gives the highest proportion of the para isomer on bromination?',
        options: ['Toluene', 't-Butylbenzene', 'Anisole', 'Biphenyl'], answer: 1,
        why: 'The t-butyl group is far too bulky to allow ortho attack, so the product is overwhelmingly para.' },
      { q: 'Nitration of aniline gives a substantial amount of the meta product because:',
        options: ['the NH₂ group is meta directing',
                  'the amine is protonated to −NH₃⁺, which is strongly meta directing',
                  'nitration always gives meta', 'aniline does not react'], answer: 1,
        why: 'In the strongly acidic nitrating mixture the nitrogen is protonated, removing the lone pair entirely.' },
      { q: 'A more negative Hammett ρ⁺ for an electrophile means:',
        options: ['the reaction is faster', 'the electrophile is more selective between positions',
                  'the ring is more nucleophilic', 'the temperature is higher'], answer: 1,
        why: 'ρ⁺ is the slope: a steep slope means small differences in σ⁺ produce large differences in rate.' },
      { q: 'Friedel–Crafts alkylation is a poor synthetic method mainly because:',
        options: ['it needs very high temperatures',
                  'ρ⁺ is small, so the product is activated and reacts again — and the cation rearranges',
                  'AlCl₃ is expensive', 'benzene is unreactive'], answer: 1,
        why: 'The alkyl product is more activated than the starting material, so polyalkylation follows; ' +
          'and primary carbocations rearrange before they ever reach the ring.' }
    ],

    notes:
      '<b>What this lab computes.</b> Partial rate factors from log f = ρ⁺σ⁺, the isomer distribution from those ' +
      'factors with the correct statistical weights (2 ortho, 2 meta, 1 para), and the overall rate relative to ' +
      'benzene. Every number on the stage is calculated for the pair you selected.' +
      '<div class="pyq"><em>Exam pattern</em>The two things examined hardest are the halogens (deactivating yet ' +
      'o/p directing) and aniline under acidic conditions. Both are about separating the <b>rate</b> question ' +
      'from the <b>position</b> question.</div>' +
      '<ul><li><b>Activating, o/p:</b> −NH₂, −NHR, −OH, −OR, −NHCOR, −R, −Ar.</li>' +
      '<li><b>Deactivating, o/p:</b> −F, −Cl, −Br, −I. Induction beats resonance on rate; resonance still wins on position.</li>' +
      '<li><b>Deactivating, meta:</b> −NO₂, −CN, −SO₃H, −CHO, −COR, −COOH, −COOR, −N⁺R₃, −CF₃.</li>' +
      '<li>Ortho is statistically favoured two-to-one over para but <b>sterically</b> penalised, which is why ' +
      'the o : p ratio falls as either group gets bulkier.</li>' +
      '<li>Friedel–Crafts fails completely on strongly deactivated rings (nitrobenzene) and on anilines, ' +
      'where the Lewis acid binds the nitrogen.</li></ul>'
  });

})(window.InsightLab, window.ORGART);
