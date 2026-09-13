/* ============================================================
   CHEMISTRY (depth) —  9. Bohr model & the hydrogen spectrum
                       10. E1 vs E2 elimination
   ============================================================ */
(function (L) {
  'use strict';
  const { clamp, TAU, fmt, E, Camera } = L;

  const RY = 13.605693, HC = 1239.841984;        // eV, eV·nm
  const RINF = 1.0973731568e7;                   // m⁻¹
  const SERIES = [
    { nf: 1, name: 'Lyman',    region: 'ultraviolet', c: '#8B7BE8' },
    { nf: 2, name: 'Balmer',   region: 'visible',     c: '#FFAE4C' },
    { nf: 3, name: 'Paschen',  region: 'infrared',    c: '#E8685B' },
    { nf: 4, name: 'Brackett', region: 'far infrared', c: '#C2604E' },
    { nf: 5, name: 'Pfund',    region: 'far infrared', c: '#9C5445' }
  ];
  const ION = { 1: 'H', 2: 'He⁺', 3: 'Li²⁺', 4: 'Be³⁺' };

  function wl2rgb(w) {
    let r, g, b;
    if (w < 440) { r = -(w - 440) / 60; g = 0; b = 1; }
    else if (w < 490) { r = 0; g = (w - 440) / 50; b = 1; }
    else if (w < 510) { r = 0; g = 1; b = -(w - 510) / 20; }
    else if (w < 580) { r = (w - 510) / 70; g = 1; b = 0; }
    else if (w < 645) { r = 1; g = -(w - 645) / 65; b = 0; }
    else { r = 1; g = 0; b = 0; }
    let f = 1;
    if (w < 420) f = 0.32 + 0.68 * (w - 380) / 40;
    else if (w > 700) f = 0.32 + 0.68 * (780 - w) / 80;
    const G = 0.85;
    return [Math.max(0, Math.pow(r * f, G)), Math.max(0, Math.pow(g * f, G)), Math.max(0, Math.pow(b * f, G))];
  }
  const rgbStr = (a, al) => 'rgba(' + Math.round(255 * a[0]) + ',' + Math.round(255 * a[1]) +
    ',' + Math.round(255 * a[2]) + ',' + (al == null ? 1 : al) + ')';

  /* =========================================================================
     9 · BOHR MODEL & THE HYDROGEN SPECTRUM
     ========================================================================= */
  L.register({
    id: 'bohr', subject: 'chemistry',
    name: 'Bohr Model & the Hydrogen Spectrum',
    chapter: 'Structure of Atom',
    exams: ['JEE Main', 'JEE Advanced', 'NEET UG'],
    weight: 'Very high yield',
    is3D: false,
    stageHint: 'Pick a transition and watch the photon carry away exactly the energy difference',
    lede: 'Bohr\'s model fails for every atom except one-electron systems — but for those it is <b>exact</b>, ' +
      'and it explains the single most famous fingerprint in chemistry: the line spectrum of hydrogen. ' +
      'This lab computes every wavelength from <b>1/λ = RZ²(1/n<sub>f</sub>² − 1/n<sub>i</sub>²)</b>, paints the ' +
      'Balmer lines in their true colours, and lets you switch to He⁺ and Li²⁺ to see the Z² scaling.',

    params: { Z: 1, ni: 3, nf: 2, mode: 'emission', showAll: true, anim: true },

    presets: [
      { name: 'Hα — the red line', params: { Z: 1, ni: 3, nf: 2, mode: 'emission' } },
      { name: 'Hβ — blue-green', params: { Z: 1, ni: 4, nf: 2, mode: 'emission' } },
      { name: 'Lyman-α (UV)', params: { Z: 1, ni: 2, nf: 1, mode: 'emission' } },
      { name: 'Paschen (IR)', params: { Z: 1, ni: 4, nf: 3, mode: 'emission' } },
      { name: 'Series limit n→∞', params: { Z: 1, ni: 20, nf: 2, mode: 'emission' } },
      { name: 'He⁺ — Z = 2', params: { Z: 2, ni: 4, nf: 2, mode: 'emission' } },
      { name: 'Absorption', params: { Z: 1, ni: 3, nf: 2, mode: 'absorption' } }
    ],

    controls: [
      { group: 'Species', items: [
        { key: 'Z', type: 'select', label: 'Hydrogen-like ion', restructure: true, options: [
          { value: 1, label: 'H' }, { value: 2, label: 'He⁺' },
          { value: 3, label: 'Li²⁺' }, { value: 4, label: 'Be³⁺' }] }
      ] },
      { group: 'Transition', items: [
        { key: 'nf', label: 'Lower level <i>n</i><sub>f</sub>', min: 1, max: 5, step: 1, unit: '',
          fmt: v => v.toFixed(0), restructure: true },
        { key: 'ni', label: 'Upper level <i>n</i><sub>i</sub>', min: 2, max: 20, step: 1, unit: '',
          fmt: v => v.toFixed(0), restructure: true },
        { key: 'mode', type: 'select', label: 'Process', restructure: true, options: [
          { value: 'emission', label: 'Emission' }, { value: 'absorption', label: 'Absorption' }] }
      ] },
      { group: 'Display', items: [
        { key: 'showAll', type: 'toggle', label: 'Show all series on the ladder' },
        { key: 'anim', type: 'toggle', label: 'Animate the photon' }
      ] }
    ],

    setup(S) {
      const p = S.p;
      p.Z = clamp(p.Z | 0, 1, 4);
      p.nf = clamp(p.nf | 0, 1, 5);
      p.ni = clamp(p.ni | 0, p.nf + 1, 20);
      const Z2 = p.Z * p.Z;
      S.Ei = -RY * Z2 / (p.ni * p.ni);
      S.Ef = -RY * Z2 / (p.nf * p.nf);
      S.dE = S.Ei - S.Ef;                       // positive for emission
      S.lam = HC / Math.abs(S.dE);              // nm
      S.wn = 1e7 / S.lam;                       // cm⁻¹
      S.nu = 2.99792458e17 / S.lam;             // Hz
      S.rgb = wl2rgb(clamp(S.lam, 380, 780));
      S.visible = S.lam >= 380 && S.lam <= 750;
      S.series = SERIES.find(s => s.nf === p.nf) || SERIES[0];
      S.rn = 0.0529 * p.ni * p.ni / p.Z;         // nm
      S.vn = 2.18e6 * p.Z / p.ni;                // m/s
      S.limit = HC / (RY * Z2 / (p.nf * p.nf));  // series-limit wavelength
      S.lines = 0;
      // number of distinct lines when an electron in level ni cascades down
      S.lines = p.ni * (p.ni - 1) / 2;
      S.ph = 0;
    },

    step(S, dt) { S.ph = (S.ph + dt * 0.55) % 1; },

    drawStage(S, g) {
      const ctx = g.ctx, th = g.theme, p = S.p, W = g.w, H = g.h;
      const emis = p.mode === 'emission';
      const specH = 62;
      const padT = 18, padB = specH + 26;
      const x0 = 54, x1 = W * 0.52;

      /* ---------- energy ladder ---------- */
      const NMAX = 7;
      const Emin = -RY * p.Z * p.Z;             // n = 1
      const yOf = Ev => {
        // compress with a sqrt-like map so low levels stay separated
        const t = Math.sqrt(clamp((Ev - Emin) / (0 - Emin), 0, 1));
        return (H - padB) - t * ((H - padB) - padT);
      };

      ctx.font = '9.5px "IBM Plex Mono",monospace';
      for (let n = 1; n <= NMAX; n++) {
        const Ev = -RY * p.Z * p.Z / (n * n);
        const y = yOf(Ev);
        const active = n === p.ni || n === p.nf;
        ctx.strokeStyle = active ? g.alpha(th.chem, .95) : g.alpha(th['line'], 1);
        ctx.lineWidth = active ? 2 : 1;
        ctx.beginPath(); ctx.moveTo(x0, y); ctx.lineTo(x1, y); ctx.stroke();
        ctx.fillStyle = active ? th.text : th['text-3'];
        ctx.textAlign = 'right'; ctx.textBaseline = 'middle';
        ctx.fillText('n=' + n, x0 - 6, y);
        ctx.textAlign = 'left';
        ctx.fillText(Ev.toFixed(2) + ' eV', x1 + 6, y);
      }
      // ionisation limit
      const yInf = yOf(0);
      ctx.save(); ctx.setLineDash([4, 4]);
      ctx.strokeStyle = g.alpha(th['text-3'], .9); ctx.lineWidth = 1;
      ctx.beginPath(); ctx.moveTo(x0, yInf); ctx.lineTo(x1, yInf); ctx.stroke(); ctx.restore();
      ctx.fillStyle = th['text-3']; ctx.textAlign = 'right'; ctx.textBaseline = 'bottom';
      ctx.fillText('n = ∞   (0 eV, ionised)', x1, yInf - 3);

      /* ---------- all series (faint) ---------- */
      if (p.showAll) {
        SERIES.forEach((s, si) => {
          if (s.nf > NMAX) return;
          const yf = yOf(-RY * p.Z * p.Z / (s.nf * s.nf));
          for (let ni = s.nf + 1; ni <= NMAX; ni++) {
            const yi = yOf(-RY * p.Z * p.Z / (ni * ni));
            const xx = x0 + 22 + si * 26 + (ni - s.nf) * 5;
            ctx.strokeStyle = g.alpha(s.c, .3);
            ctx.lineWidth = 1;
            ctx.beginPath(); ctx.moveTo(xx, yi); ctx.lineTo(xx, yf); ctx.stroke();
          }
        });
      }

      /* ---------- the chosen transition ---------- */
      const yi = yOf(S.Ei), yf = yOf(S.Ef);
      const tx = x1 - 40;
      const col = S.visible ? rgbStr(S.rgb) : (S.lam < 380 ? '#9B8BFF' : '#E8685B');
      ctx.strokeStyle = col; ctx.lineWidth = 2.4;
      ctx.beginPath();
      ctx.moveTo(tx, emis ? yi : yf); ctx.lineTo(tx, emis ? yf : yi); ctx.stroke();
      const ay = emis ? yf : yi, dir = emis ? 1 : -1;
      ctx.fillStyle = col;
      ctx.beginPath();
      ctx.moveTo(tx, ay); ctx.lineTo(tx - 5, ay - dir * 9); ctx.lineTo(tx + 5, ay - dir * 9);
      ctx.closePath(); ctx.fill();
      ctx.font = '600 10px "IBM Plex Mono",monospace';
      ctx.textAlign = 'right'; ctx.textBaseline = 'middle';
      ctx.fillText(Math.abs(S.dE).toFixed(3) + ' eV', tx - 8, (yi + yf) / 2);

      /* ---------- the atom, right side ---------- */
      const ax = W * 0.78, ay2 = (H - padB) * 0.5 + 6;
      const maxR = Math.min(W * 0.19, (H - padB) * 0.40);
      ctx.save();
      for (let n = 1; n <= Math.min(p.ni, 6); n++) {
        const r = maxR * (n * n) / (Math.min(p.ni, 6) * Math.min(p.ni, 6));
        const on = n === p.ni || n === p.nf;
        ctx.strokeStyle = on ? g.alpha(th.chem, .8) : g.alpha(th['line'], .9);
        ctx.setLineDash(on ? [] : [3, 4]);
        ctx.lineWidth = on ? 1.6 : 1;
        ctx.beginPath(); ctx.arc(ax, ay2, r, 0, TAU); ctx.stroke();
      }
      ctx.restore();
      // nucleus
      ctx.save(); ctx.globalCompositeOperation = 'lighter';
      const ng = ctx.createRadialGradient(ax, ay2, 0, ax, ay2, 14);
      ng.addColorStop(0, g.alpha('#FFFFFF', .9)); ng.addColorStop(1, 'rgba(255,255,255,0)');
      ctx.fillStyle = ng; ctx.beginPath(); ctx.arc(ax, ay2, 14, 0, TAU); ctx.fill();
      ctx.restore();
      ctx.font = '600 10px "IBM Plex Mono",monospace';
      ctx.fillStyle = th.text; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText('+' + p.Z, ax, ay2);

      // electron hopping between the two orbits
      const nHi = Math.min(p.ni, 6), nLo = p.nf;
      const rHi = maxR * (nHi * nHi) / (nHi * nHi), rLo = maxR * (nLo * nLo) / (nHi * nHi);
      const t = p.anim ? S.ph : 0;
      const hop = emis ? clamp((t - 0.25) / 0.35, 0, 1) : 1 - clamp((t - 0.25) / 0.35, 0, 1);
      const rNow = rHi + (rLo - rHi) * hop;
      const ang = S.ph * TAU * 2;
      const ex = ax + rNow * Math.cos(ang), ey = ay2 + rNow * Math.sin(ang);
      ctx.save(); ctx.globalCompositeOperation = 'lighter';
      const eg = ctx.createRadialGradient(ex, ey, 0, ex, ey, 11);
      eg.addColorStop(0, g.alpha(th.chem, .95)); eg.addColorStop(1, g.alpha(th.chem, 0));
      ctx.fillStyle = eg; ctx.beginPath(); ctx.arc(ex, ey, 11, 0, TAU); ctx.fill();
      ctx.restore();
      ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(ex, ey, 3, 0, TAU); ctx.fill();

      // photon wave-packet leaving (emission) or arriving (absorption)
      if (p.anim) {
        const pt = emis ? clamp((S.ph - 0.55) / 0.4, 0, 1) : clamp((0.45 - S.ph) / 0.4, 0, 1);
        if (pt > 0 && pt < 1) {
          const px = ax + (emis ? 1 : -1) * 0 + (emis ? pt : 1 - pt) * 0;
          const travel = (emis ? pt : (1 - pt)) * (W * 0.17);
          const sx = ax + rLo + 8 + travel;
          ctx.save(); ctx.globalCompositeOperation = 'lighter';
          ctx.strokeStyle = col; ctx.lineWidth = 1.8;
          ctx.beginPath();
          for (let i = 0; i <= 40; i++) {
            const u = i / 40;
            const xx = sx + u * 34;
            const yy = ay2 - Math.sin(u * TAU * 3 + S.ph * TAU * 6) * 6 * Math.sin(Math.PI * u);
            i ? ctx.lineTo(xx, yy) : ctx.moveTo(xx, yy);
          }
          ctx.stroke(); ctx.restore();
        }
      }

      /* ---------- visible spectrum strip ---------- */
      const sy = H - specH, sx0 = 14, sx1 = W - 14;
      for (let i = 0; i <= sx1 - sx0; i++) {
        const w = 380 + (i / (sx1 - sx0)) * (750 - 380);
        ctx.fillStyle = rgbStr(wl2rgb(w), .85);
        ctx.fillRect(sx0 + i, sy, 1.2, 26);
      }
      ctx.strokeStyle = g.alpha(th.line, 1); ctx.lineWidth = 1;
      ctx.strokeRect(sx0 + .5, sy + .5, sx1 - sx0, 26);
      // Balmer lines of the current ion, drawn where they really fall
      for (let ni = 3; ni <= 12; ni++) {
        const dE = RY * p.Z * p.Z * (1 / 4 - 1 / (ni * ni));
        const lam = HC / dE;
        if (lam < 380 || lam > 750) continue;
        const xx = sx0 + (lam - 380) / (750 - 380) * (sx1 - sx0);
        ctx.strokeStyle = 'rgba(0,0,0,.85)'; ctx.lineWidth = 2;
        ctx.beginPath(); ctx.moveTo(xx, sy); ctx.lineTo(xx, sy + 26); ctx.stroke();
      }
      if (S.visible) {
        const xx = sx0 + (S.lam - 380) / (750 - 380) * (sx1 - sx0);
        ctx.strokeStyle = '#fff'; ctx.lineWidth = 1.6;
        ctx.beginPath(); ctx.moveTo(xx, sy - 6); ctx.lineTo(xx, sy + 32); ctx.stroke();
        ctx.font = '600 10px "IBM Plex Mono",monospace';
        ctx.fillStyle = th.text; ctx.textAlign = 'center'; ctx.textBaseline = 'top';
        ctx.fillText(S.lam.toFixed(1) + ' nm', xx, sy + 34);
      }
      ctx.font = '9px "IBM Plex Mono",monospace'; ctx.fillStyle = th['text-3'];
      ctx.textAlign = 'left'; ctx.textBaseline = 'bottom';
      ctx.fillText('visible window 380–750 nm · black lines are the real Balmer lines of ' + ION[p.Z], sx0, sy - 4);
      ctx.textAlign = 'right';
      ctx.fillText(S.visible ? '' : (S.lam < 380 ? 'this photon is ULTRAVIOLET — off the left edge'
        : 'this photon is INFRARED — off the right edge'), sx1, sy - 4);

      /* ---------- headline ---------- */
      ctx.font = '700 19px "IBM Plex Sans Condensed",sans-serif';
      ctx.fillStyle = th.text; ctx.textAlign = 'left'; ctx.textBaseline = 'top';
      ctx.fillText(ION[p.Z] + '  ·  ' + p.ni + ' → ' + p.nf + '  ·  ' + S.series.name, 14, 8);
      ctx.font = '500 10px "IBM Plex Mono",monospace'; ctx.fillStyle = th['text-3'];
      ctx.fillText((emis ? 'emission — photon released' : 'absorption — photon consumed') +
        '   ·   ' + S.series.region, 14, 32);
    },

    plots: [
      { title: 'Line spectrum in wavenumbers — every series at once',
        legend: SERIES.slice(0, 3).map(s => ({ c: s.c, label: s.name + ' (n→' + s.nf + ')' })),
        draw(S, g) {
          const p = S.p, Z2 = p.Z * p.Z;
          const P = g.Plot({
            xmin: 0, xmax: RINF * Z2 / 100 * 1.05, ymin: 0, ymax: 1.18,
            xlabel: 'wavenumber 1/λ (cm⁻¹)', ylabel: 'relative intensity',
            xfmt: v => (v / 1000).toFixed(0) + 'k', yfmt: v => v.toFixed(1)
          }).frame();
          P.clip(() => {
            SERIES.forEach(s => {
              for (let ni = s.nf + 1; ni <= 24; ni++) {
                const wn = RINF * Z2 * (1 / (s.nf * s.nf) - 1 / (ni * ni)) / 100;
                const h = 1 / Math.pow(ni - s.nf, 0.75);
                const isNow = s.nf === p.nf && ni === p.ni;
                P.line([[wn, 0], [wn, h]], isNow ? g.theme.text : g.alpha(s.c, .85), isNow ? 2.5 : 1.4);
              }
              const lim = RINF * Z2 / (s.nf * s.nf) / 100;
              P.line([[lim, 0], [lim, 1.05]], g.alpha(s.c, .45), 1, [2, 3]);
            });
            // visible window
            const v1 = 1e7 / 750 / 1, v2 = 1e7 / 380 / 1;
            P.area([[v1, 1.14], [v2, 1.14]], 1.08, g.alpha(g.theme.warn, .18));
          });
          P.tag(1e7 / 750, 1.11, 'visible', g.theme.warn, 'left', 0);
          P.tag(S.wn, 1.05, p.ni + '→' + p.nf + '  ' + S.lam.toFixed(1) + ' nm', g.theme.text, 'left', 0);
        },
        hover(S, x) {
          const p = S.p, Z2 = p.Z * p.Z;
          let best = null, bd = 1e9;
          SERIES.forEach(s => {
            for (let ni = s.nf + 1; ni <= 24; ni++) {
              const wn = RINF * Z2 * (1 / (s.nf * s.nf) - 1 / (ni * ni)) / 100;
              if (Math.abs(wn - x) < bd) { bd = Math.abs(wn - x); best = { s, ni, wn }; }
            }
          });
          if (!best) return null;
          return [
            { label: 'line', value: best.ni + ' → ' + best.s.nf, color: best.s.c },
            { label: 'series', value: best.s.name },
            { label: 'wavenumber', value: fmt(best.wn, 4) + ' cm⁻¹' },
            { label: 'wavelength', value: (1e7 / best.wn).toFixed(1) + ' nm' }
          ];
        } },
      { title: 'The Rydberg check — 1/λ against (1/n_f² − 1/n_i²) must be a straight line',
        legend: [{ c: '#FFAE4C', label: 'computed lines' }, { c: '#63729A', label: 'slope = RZ²' }],
        draw(S, g) {
          const p = S.p, Z2 = p.Z * p.Z, R = RINF / 100;
          const pts = [];
          SERIES.forEach(s => {
            for (let ni = s.nf + 1; ni <= 14; ni++) {
              const f = 1 / (s.nf * s.nf) - 1 / (ni * ni);
              pts.push([f, R * Z2 * f, s.c]);
            }
          });
          const P = g.Plot({
            xmin: 0, xmax: 1.05, ymin: 0, ymax: R * Z2 * 1.1,
            xlabel: '1/n_f² − 1/n_i²', ylabel: '1/λ (cm⁻¹)',
            xfmt: v => v.toFixed(2), yfmt: v => (v / 1000).toFixed(0) + 'k'
          }).frame();
          P.clip(() => {
            P.line([[0, 0], [1.05, R * Z2 * 1.05]], g.alpha(g.theme['text-3'], .95), 1.5, [5, 4]);
            pts.forEach(q => P.dot(q[0], q[1], 3, g.alpha(q[2], .95)));
            const f = 1 / (p.nf * p.nf) - 1 / (p.ni * p.ni);
            P.dot(f, R * Z2 * f, 5, g.theme.text, g.theme['ink-950']);
          });
          P.tag(0.5, R * Z2 * 0.5, 'slope R·Z² = ' + fmt(R * Z2, 4) + ' cm⁻¹', g.theme['text-2'], 'left', -10);
        } }
    ],

    readouts(S) {
      const p = S.p, emis = p.mode === 'emission';
      return [
        { label: 'Photon energy ΔE', value: Math.abs(S.dE).toFixed(3), unit: 'eV', flag: 'accent' },
        { label: 'Wavelength λ', value: S.lam.toFixed(2), unit: 'nm', flag: 'accent',
          hint: S.visible ? 'visible' : S.lam < 380 ? 'ultraviolet' : 'infrared' },
        { label: 'Wavenumber 1/λ', value: fmt(S.wn, 5), unit: 'cm⁻¹' },
        { label: 'Frequency ν', value: fmt(S.nu, 4), unit: 'Hz' },
        { label: 'Series', value: S.series.name, unit: '', hint: 'n → ' + p.nf },
        { label: 'Series limit', value: S.limit.toFixed(1), unit: 'nm', hint: 'n = ∞ → ' + p.nf },
        { label: 'E' + p.ni + ' → E' + p.nf, value: S.Ei.toFixed(2) + ' → ' + S.Ef.toFixed(2), unit: 'eV' },
        { label: 'Orbit radius r' + p.ni, value: S.rn.toFixed(4), unit: 'nm', hint: 'n²a₀/Z' },
        { label: 'Electron speed v' + p.ni, value: fmt(S.vn, 3), unit: 'm/s', hint: '2.18×10⁶ Z/n' },
        { label: 'Ionisation from n=1', value: (RY * p.Z * p.Z).toFixed(2), unit: 'eV', flag: 'accent' },
        { label: 'Lines from n=' + p.ni, value: String(S.lines), unit: '', hint: 'n(n−1)/2 on full cascade' },
        { label: 'Process', value: emis ? 'Emission' : 'Absorption', unit: '',
          flag: emis ? 'ok' : 'warn', hint: emis ? 'atom loses ΔE' : 'atom gains ΔE' }
      ];
    },

    equation(S) {
      const p = S.p;
      return E.frac('1', E.v('λ')) + ' ' + E.op('=') + ' ' + E.v('R') + E.v('Z') + '<sup>2</sup>' +
        '(' + E.frac('1', E.v('n') + '<sub>f</sub><sup>2</sup>') + E.op('−') +
        E.frac('1', E.v('n') + '<sub>i</sub><sup>2</sup>') + ')' +
        ' ' + E.op('=') + ' ' + E.n(fmt(RINF / 100, 4), 'cm⁻¹') + E.op('×') + E.n(p.Z * p.Z, '') +
        E.op('×') + '(' + E.frac('1', E.n(p.nf, '') + '<sup>2</sup>') + E.op('−') +
        E.frac('1', E.n(p.ni, '') + '<sup>2</sup>') + ')' + ' ' + E.op('=') + ' ' + E.n(fmt(S.wn, 5), 'cm⁻¹') +
        '<br>' + E.v('E') + '<sub>n</sub> ' + E.op('=') + ' ' + E.op('−') +
        E.frac('13.6' + E.v('Z') + '<sup>2</sup>', E.v('n') + '<sup>2</sup>') + ' eV' + E.op('·') +
        ' ΔE ' + E.op('=') + ' ' + E.n(S.Ei.toFixed(3), 'eV') + E.op('−') + '(' + E.n(S.Ef.toFixed(3), 'eV') + ')' +
        ' ' + E.op('=') + ' ' + E.n(Math.abs(S.dE).toFixed(3), 'eV') +
        '<br>' + E.v('λ') + ' ' + E.op('=') + ' ' + E.frac(E.v('hc'), 'ΔE') + ' ' + E.op('=') + ' ' +
        E.frac('1240 eV·nm', E.n(Math.abs(S.dE).toFixed(3), 'eV')) + ' ' + E.op('=') + ' ' +
        E.n(S.lam.toFixed(2), 'nm');
    },
    eqNote: '<b>Memorise hc = 1240 eV·nm.</b> It turns any energy in electron-volts into a wavelength in ' +
      'nanometres in one step, and it appears in the photoelectric effect, de Broglie problems and every ' +
      'spectrum question. The Z² is the other half: He⁺ needs four times the energy of H for the same transition.',

    walkthrough: [
      { title: '1 · Why hydrogen glows red',
        body: 'The 3 → 2 transition is the first line of the Balmer series. Look at where the white marker lands on the visible strip.',
        ask: 'Why is exactly this wavelength emitted, and nothing in between?',
        reveal: 'Because the energy levels are <b>quantised</b>. The electron can only sit at E = −13.6/n², so the only photon energies available are the differences between those levels. 656 nm is E₃ − E₂ and nothing else — which is why a hydrogen lamp gives sharp lines, not a rainbow.',
        params: { Z: 1, ni: 3, nf: 2, mode: 'emission' } },
      { title: '2 · Only one series is visible',
        body: 'Switch the lower level to n_f = 1 (Lyman) and then to n_f = 3 (Paschen), watching the wavelength readout.',
        ask: 'Why can you only ever see the Balmer series with your eyes?',
        reveal: 'Lyman transitions all land on n = 1, the biggest energy gaps, so their photons are <b>ultraviolet</b>. Paschen and beyond have small gaps, so they are <b>infrared</b>. Only Balmer (n → 2) happens to place its first few lines inside 380–750 nm.',
        params: { Z: 1, ni: 2, nf: 1, mode: 'emission' } },
      { title: '3 · The series limit',
        body: 'Push n_i up towards 20 while keeping n_f = 2. Watch the lines on the spectrum plot bunch together.',
        ask: 'What does the shortest wavelength of a series correspond to?',
        reveal: 'The <b>series limit</b>, where n_i → ∞. Since 1/n_i² → 0, the wavenumber approaches RZ²/n_f². Beyond that the electron is free and the spectrum becomes <b>continuous</b> — that is the ionisation edge.',
        params: { Z: 1, ni: 20, nf: 2, mode: 'emission' } },
      { title: '4 · The Z² scaling',
        body: 'Set the transition back to 3 → 2 and switch the species from H to He⁺, then Li²⁺.',
        ask: 'By what factor does the photon energy change from H to He⁺?',
        reveal: '<b>Four times</b> — energy goes as Z². The 3 → 2 line of He⁺ is therefore at one quarter the wavelength of Hα, and it has moved out of the visible into the ultraviolet. Bohr\'s model is exact for these one-electron ions, which is exactly why they are the ones examiners use.',
        params: { Z: 2, ni: 3, nf: 2, mode: 'emission' } },
      { title: '5 · Emission and absorption are the same arithmetic',
        body: 'Flip the process to absorption and watch the arrow on the ladder reverse.',
        ask: 'A cool gas of hydrogen in front of a white-light source produces dark lines. Where are they?',
        reveal: '<b>At exactly the same wavelengths as the emission lines.</b> The gas absorbs precisely the photons it would otherwise emit. This is how the composition of stars is read — Fraunhofer\'s dark lines in the solar spectrum are this effect.',
        params: { Z: 1, ni: 3, nf: 2, mode: 'absorption' } }
    ],

    quiz: [
      { q: 'An electron in a hydrogen atom drops from n = 4 to n = 2. The emitted radiation lies in the:',
        options: ['ultraviolet region', 'visible region', 'infrared region', 'microwave region'], answer: 1,
        why: 'n → 2 is the Balmer series, and the first few Balmer lines lie in the visible. The 4 → 2 line is Hβ at about 486 nm, blue-green.' },
      { q: 'The ionisation energy of He⁺ compared with that of H is:',
        options: ['the same', 'twice as large', 'four times as large', 'half as large'], answer: 2,
        why: 'E depends on Z². For He⁺, Z = 2, so the energy scale is 4× that of hydrogen: 54.4 eV instead of 13.6 eV.' },
      { q: 'An electron excited to n = 5 returns to the ground state. The maximum number of distinct spectral lines is:',
        options: ['4', '5', '10', '15'], answer: 2,
        why: 'n(n−1)/2 = 5×4/2 = 10. Every downward pair of levels is a possible transition, and a large sample of atoms will show all of them.' }
    ],

    notes: '<b>Where this shows up in the paper.</b>' +
      '<ul><li>Rydberg substitution for λ, and the reverse — identify the transition from a given wavelength.</li>' +
      '<li>Number of spectral lines n(n−1)/2 — nearly free marks, appears most years.</li>' +
      '<li>Z² scaling for He⁺ and Li²⁺, including ionisation energy comparisons.</li>' +
      '<li>Radius r ∝ n²/Z and velocity v ∝ Z/n ratio questions.</li></ul>' +
      '<div class="pyq"><em>Trap to avoid</em>Bohr\'s model works <b>only</b> for one-electron species — H, He⁺, ' +
      'Li²⁺, Be³⁺. Applying E = −13.6Z²/n² to neutral helium or lithium is wrong, because electron–electron ' +
      'repulsion and shielding are not in the model at all.</div>'
  });

  /* =========================================================================
     10 · E1 vs E2 ELIMINATION — anti-periplanar geometry, Saytzeff vs Hofmann
     ========================================================================= */
  const SUBS = [
    { k: 0, name: '1°', label: '1° (1-bromobutane)', cat: 0, ster: 0, bH: 2 },
    { k: 1, name: '2°', label: '2° (2-bromobutane)', cat: 1, ster: 1, bH: 5 },
    { k: 2, name: '3°', label: '3° (2-bromo-2-methylbutane)', cat: 2, ster: 2, bH: 8 }
  ];

  /* =====================================================================
     Electron-flow inset for elimination. Three arrows in one concerted
     step for E2; two separate steps for E1.
     ===================================================================== */
  function elimMech(isE2, baseLabel, lgLabel) {
    const skel = {
      ca: { x: -0.62, y: 0, label: 'C' },
      cb: { x: 0.62, y: 0, label: 'C' },
      h: { x: -1.10, y: -0.92, label: 'H' },
      lg: { x: 1.10, y: 0.92, label: lgLabel, colour: '#FFAE4C' }
    };
    const S0 = {
      name: 'anti',
      caption: isE2 ? 'E2 — one step, three arrows' : 'E1 step 1 — the leaving group departs',
      sub: isE2 ? 'the β-H and the leaving group must be anti-periplanar, 180° apart'
                : 'slow and unimolecular — the base plays no part yet',
      atoms: Object.assign({}, skel, isE2 ? {
        h: { x: -1.10, y: -0.92, label: 'H', hot: 1 },
        lg: { x: 1.10, y: 0.92, label: lgLabel, colour: '#FFAE4C', hot: 1 },
        b: { x: -1.95, y: -1.55, label: baseLabel, colour: '#5AA9FF', charge: -1, lone: [0.6] }
      } : { lg: { x: 1.10, y: 0.92, label: lgLabel, colour: '#FFAE4C', hot: 1 } }),
      bonds: [
        { a: 'ca', b: 'cb', order: 1 },
        { a: 'ca', b: 'h', order: 1 },
        { a: 'cb', b: 'lg', order: 1 }
      ],
      arrows: isE2 ? [
        { from: { atom: 'b', dx: 0.34, dy: 0.28 }, to: { atom: 'h', dx: -0.24, dy: -0.20 },
          bow: 0.30, colour: '#5AA9FF', label: '1' },
        { from: { bond: 'ca|h' }, to: { bond: 'ca|cb' }, bow: -0.42, label: '2' },
        { from: { bond: 'cb|lg' }, to: { atom: 'lg', dx: 0.30, dy: 0.26 }, bow: 0.34,
          colour: '#FFAE4C', label: '3' }
      ] : [
        { from: { bond: 'cb|lg' }, to: { atom: 'lg', dx: 0.30, dy: 0.26 }, bow: 0.34, colour: '#FFAE4C' }
      ]
    };
    if (isE2) {
      return [S0, {
        name: 'alkene',
        caption: 'The alkene, in one concerted step',
        sub: 'rate = k[substrate][base] — both appear, because both act at once',
        atoms: {
          ca: { x: -0.55, y: 0, label: 'C' }, cb: { x: 0.55, y: 0, label: 'C' },
          h: { x: -1.85, y: -1.62, label: 'H–' + baseLabel.replace('⁻', ''), colour: '#5AA9FF' },
          lg: { x: 1.72, y: 1.45, label: lgLabel + '⁻', colour: '#8FA4CE', charge: -1 }
        },
        bonds: [{ a: 'ca', b: 'cb', order: 2 }],
        arrows: []
      }];
    }
    return [S0, {
      name: 'cation',
      caption: 'E1 step 2 — the base takes a β-hydrogen',
      sub: 'fast, and the base decides which alkene you get',
      atoms: Object.assign({}, skel, {
        cb: { x: 0.62, y: 0, label: 'C', charge: 1, hot: 1 },
        lg: { x: 1.85, y: 1.45, label: lgLabel + '⁻', colour: '#8FA4CE', charge: -1 },
        b: { x: -1.95, y: -1.55, label: baseLabel, colour: '#5AA9FF', charge: -1, lone: [0.6] }
      }),
      bonds: [
        { a: 'ca', b: 'cb', order: 1 }, { a: 'ca', b: 'h', order: 1 }
      ],
      arrows: [
        { from: { atom: 'b', dx: 0.34, dy: 0.28 }, to: { atom: 'h', dx: -0.24, dy: -0.20 },
          bow: 0.30, colour: '#5AA9FF' },
        { from: { bond: 'ca|h' }, to: { bond: 'ca|cb' }, bow: -0.42 }
      ]
    }, {
      name: 'alkene',
      caption: 'The alkene',
      sub: 'rate = k[substrate] only — the base is absent from the rate law',
      atoms: {
        ca: { x: -0.55, y: 0, label: 'C' }, cb: { x: 0.55, y: 0, label: 'C' },
        h: { x: -1.95, y: -1.62, label: 'H–' + baseLabel.replace('⁻', ''), colour: '#5AA9FF' },
        lg: { x: 1.85, y: 1.45, label: lgLabel + '⁻', colour: '#8FA4CE', charge: -1 }
      },
      bonds: [{ a: 'ca', b: 'cb', order: 2 }],
      arrows: []
    }];
  }

  L.register({
    id: 'elimination', subject: 'chemistry',
    name: 'E1 vs E2 Elimination — Geometry, Saytzeff and Hofmann',
    chapter: 'Haloalkanes & Haloarenes',
    exams: ['JEE Main', 'JEE Advanced', 'NEET UG'],
    weight: 'Very high yield',
    is3D: true,
    stageHint: 'Rotate the dihedral — E2 only fires when the β-hydrogen is anti-periplanar to the leaving group',
    lede: 'Substitution and elimination are always competing for the same substrate. Which wins — and which ' +
      'alkene you get — is decided by the base, its <b>bulk</b>, the solvent and the temperature. ' +
      'The stereo-electronic requirement is the part students skip: <b>E2 needs the β-H and the leaving group ' +
      'anti-periplanar</b>, 180° apart. Here that is a slider, and the reaction refuses to proceed until you satisfy it.',

    params: { sub: 1, base: 1, bulk: 0, solvent: 'protic', temp: 330, dihedral: 180, conc: 0.6,
              showNewman: true, arrows: true },

    presets: [
      { name: 'E2 · strong small base', params: { sub: 1, base: 2, bulk: 0, solvent: 'aprotic', temp: 340, dihedral: 180 } },
      { name: 'Hofmann · bulky t-BuOK', params: { sub: 1, base: 2, bulk: 1, solvent: 'aprotic', temp: 340, dihedral: 180 } },
      { name: 'E1 · 3°, weak base, hot', params: { sub: 2, base: 0, bulk: 0, solvent: 'protic', temp: 355, dihedral: 180 } },
      { name: 'SN2 wins · 1°, cold', params: { sub: 0, base: 1, bulk: 0, solvent: 'aprotic', temp: 290, dihedral: 180 } },
      { name: 'Wrong geometry (60°)', params: { sub: 1, base: 2, bulk: 0, solvent: 'aprotic', temp: 340, dihedral: 60 } }
    ],

    controls: [
      { group: 'Substrate', items: [
        { key: 'sub', type: 'select', label: 'Alkyl halide', restructure: true, options: [
          { value: 0, label: '1°' }, { value: 1, label: '2°' }, { value: 2, label: '3°' }] },
        { key: 'dihedral', label: 'H—C—C—Br dihedral <i>φ</i>', min: 0, max: 360, step: 1, unit: '°',
          fmt: v => v.toFixed(0) }
      ] },
      { group: 'Base / nucleophile', items: [
        { key: 'base', type: 'select', label: 'Base strength', restructure: true, options: [
          { value: 0, label: 'Weak' }, { value: 1, label: 'Moderate' }, { value: 2, label: 'Strong' }] },
        { key: 'bulk', type: 'select', label: 'Base size', restructure: true, options: [
          { value: 0, label: 'Small (EtO⁻)' }, { value: 1, label: 'Bulky (t-BuO⁻)' }] },
        { key: 'conc', label: 'Base concentration', min: 0.05, max: 2, step: 0.05, unit: 'M',
          fmt: v => v.toFixed(2), restructure: true }
      ] },
      { group: 'Conditions', items: [
        { key: 'solvent', type: 'select', label: 'Solvent', restructure: true, options: [
          { value: 'protic', label: 'Polar protic' }, { value: 'aprotic', label: 'Polar aprotic' }] },
        { key: 'temp', label: 'Temperature <i>T</i>', min: 273, max: 373, step: 1, unit: 'K',
          fmt: v => v.toFixed(0), restructure: true }
      ] },
      { group: 'Display', items: [
        { key: 'showNewman', type: 'toggle', label: 'Show Newman projection' },
        { key: 'arrows', type: 'toggle', label: 'Show the curly-arrow mechanism' }
      ] }
    ],

    setup(S) {
      const p = S.p;
      const sb = SUBS[clamp(p.sub | 0, 0, 2)];
      S.sb = sb;
      const RT = 8.314e-3 * p.temp;

      // Free-energy barriers (kJ/mol) — trend-accurate teaching model.
      // Elimination is entropically favoured, so raising T helps it far more than substitution.
      const dS = 0.055;                                  // kJ/mol/K advantage for elimination
      let Ea_E2 = 78 - 13 * p.base + 3 * sb.ster + (p.solvent === 'aprotic' ? -6 : 6) - dS * (p.temp - 298);
      let Ea_SN2 = 60 + 19 * sb.ster - 11 * p.base + (p.solvent === 'aprotic' ? -9 : 8) + 9 * p.bulk;
      let Ea_E1 = 150 - 26 * sb.cat + (p.solvent === 'protic' ? -16 : 10) - dS * (p.temp - 298);
      let Ea_SN1 = 150 - 26 * sb.cat + (p.solvent === 'protic' ? -16 : 10);

      S.Ea = { E2: Ea_E2, SN2: Ea_SN2, E1: Ea_E1, SN1: Ea_SN1 };

      // anti-periplanar gate: E2 rate ∝ cos²(φ/2) style overlap, peaked at 180° (and 0° syn, much worse)
      const phi = p.dihedral * Math.PI / 180;
      S.anti = Math.pow(Math.max(0, -Math.cos(phi)), 2);       // 1 at 180°, 0 at 90°, 0 at 0°
      S.syn = Math.pow(Math.max(0, Math.cos(phi)), 2) * 0.08;  // syn-periplanar is possible but poor
      S.overlap = S.anti + S.syn;

      const k = (ea, bimol) => Math.exp(-ea / RT) * (bimol ? p.conc : 1);
      const kE2 = k(Ea_E2, true) * S.overlap;
      const kSN2 = k(Ea_SN2, true);
      const kE1 = k(Ea_E1, false);
      const kSN1 = k(Ea_SN1, false);
      const tot = kE2 + kSN2 + kE1 + kSN1 || 1;

      // Saytzeff vs Hofmann split within the elimination products
      const hof = p.bulk ? 0.72 + 0.1 * sb.ster : 0.19;
      S.frac = {
        E2say: kE2 / tot * (1 - hof), E2hof: kE2 / tot * hof,
        SN2: kSN2 / tot,
        E1say: kE1 / tot * 0.81, E1hof: kE1 / tot * 0.19,
        SN1: kSN1 / tot
      };
      S.elim = S.frac.E2say + S.frac.E2hof + S.frac.E1say + S.frac.E1hof;
      S.subst = S.frac.SN2 + S.frac.SN1;
      S.route = kE2 > Math.max(kSN2, kE1, kSN1) ? 'E2'
        : kSN2 > Math.max(kE1, kSN1) ? 'SN2' : kE1 > kSN1 ? 'E1' : 'SN1';
      S.major = (S.frac.E2hof + S.frac.E1hof) > (S.frac.E2say + S.frac.E1say) ? 'Hofmann' : 'Saytzeff';

      S.u = 0;
      if (!S.cam) { S.cam = Camera({ theta: -0.4, phi: 0.16, dist: 6.4 }); S.cam.minDist = 3; S.cam.maxDist = 16; }
      S.cam.target = [0, 0, 0];
    },

    step(S, dt) {
      const gate = S.overlap > 0.35 || S.route === 'E1' || S.route === 'SN1';
      S.u += dt * (gate ? 0.26 : 0.02);
      if (S.u > 1) S.u = 0;
      S.gate = gate;
    },

    drawStage(S, g) {
      const ctx = g.ctx, th = g.theme, p = S.p, cam = S.cam, W = g.w, H = g.h;
      const phi = p.dihedral * Math.PI / 180;
      const u = S.u, BOND = 1.5;

      /* ---------- 3D ball and stick ---------- */
      const fired = S.gate && u > 0.45;
      const prog = clamp((u - 0.45) / 0.5, 0, 1);

      // Cα at (0,0,+0.75), Cβ at (0,0,-0.75); Br on Cα, H on Cβ
      const zA = 0.75, zB = -0.75;
      const tetR = 1.0;
      const atoms = [];
      atoms.push({ p: [0, 0, zA], r: 0.5, c: '#5C6B86', t: 'Cα' });
      atoms.push({ p: [0, 0, zB], r: 0.5, c: '#5C6B86', t: 'Cβ' });
      // leaving group on Cα, fixed at azimuth 0
      const brR = tetR * (1 + prog * 2.4);
      atoms.push({ p: [brR * 0.94, 0, zA + 0.34 + prog * 1.1], r: 0.6, c: '#C0603A', t: 'Br⁻', lg: true });
      // two spectators on Cα
      [120, 240].forEach((a, i) => {
        const ar = a * Math.PI / 180;
        atoms.push({ p: [tetR * 0.94 * Math.cos(ar), tetR * 0.94 * Math.sin(ar), zA + 0.34],
          r: i < S.sb.ster ? 0.5 : 0.33, c: i < S.sb.ster ? '#788AA8' : '#DCE4F2',
          t: i < S.sb.ster ? 'CH₃' : 'H' });
      });
      // β-hydrogen at the chosen dihedral, plus two spectators
      [0, 120, 240].forEach((off, i) => {
        const ar = phi + off * Math.PI / 180;
        const isH = i === 0;
        const pull = isH ? prog : 0;
        atoms.push({
          p: [tetR * 0.94 * Math.cos(ar) * (1 + pull * 1.8),
              tetR * 0.94 * Math.sin(ar) * (1 + pull * 1.8),
              zB - 0.34 - pull * 0.9],
          r: isH ? 0.36 : 0.33, c: isH ? '#7CE0A8' : '#DCE4F2', t: isH ? 'Hβ' : 'H', bh: isH
        });
      });
      // base
      const bAng = phi;
      const bd = 4.2 - prog * 2.2;
      atoms.push({ p: [bd * Math.cos(bAng), bd * Math.sin(bAng), zB - 1.2],
        r: p.bulk ? 0.72 : 0.5, c: '#5AA9FF', t: p.bulk ? 't-BuO⁻' : 'EtO⁻', base: true });

      const bonds = [[atoms[0], atoms[1], 1 + prog]];
      bonds.push([atoms[0], atoms[2], 1 - clamp(prog * 1.3, 0, 1)]);
      bonds.push([atoms[0], atoms[3], 1]); bonds.push([atoms[0], atoms[4], 1]);
      bonds.push([atoms[1], atoms[5], 1 - clamp(prog * 1.3, 0, 1)]);
      bonds.push([atoms[1], atoms[6], 1]); bonds.push([atoms[1], atoms[7], 1]);

      const items = [];
      bonds.forEach(b => {
        const A = cam.project(b[0].p), B = cam.project(b[1].p);
        if (!A.ok || !B.ok) return;
        items.push({ z: (A.z + B.z) / 2 + 0.3, draw: () => {
          ctx.save(); ctx.lineCap = 'round';
          const w = b[2];
          ctx.strokeStyle = g.alpha(th['text-2'], 0.25 + 0.5 * clamp(w, 0, 1));
          ctx.lineWidth = 2 + 4 * clamp(w, 0, 1);
          if (w < 0.9) ctx.setLineDash([5, 5]);
          ctx.beginPath(); ctx.moveTo(A.x, A.y); ctx.lineTo(B.x, B.y); ctx.stroke();
          if (w > 1.35) {   // the forming π bond
            ctx.setLineDash([]); ctx.lineWidth = 2;
            ctx.strokeStyle = g.alpha(th.chem, .9);
            const nx = -(B.y - A.y), ny = (B.x - A.x), nl = Math.hypot(nx, ny) || 1;
            ctx.beginPath();
            ctx.moveTo(A.x + nx / nl * 5, A.y + ny / nl * 5);
            ctx.lineTo(B.x + nx / nl * 5, B.y + ny / nl * 5);
            ctx.stroke();
          }
          ctx.restore();
        } });
      });
      atoms.forEach(a => {
        const P = cam.project(a.p);
        if (!P.ok) return;
        items.push({ z: P.z, draw: () => {
          const rr = Math.max(4, a.r * P.s * 0.0125);
          const rg = ctx.createRadialGradient(P.x - rr * .35, P.y - rr * .4, rr * .1, P.x, P.y, rr);
          rg.addColorStop(0, g.mix(a.c, '#ffffff', 0.55));
          rg.addColorStop(0.55, a.c);
          rg.addColorStop(1, g.mix(a.c, '#000000', 0.5));
          ctx.fillStyle = rg; ctx.beginPath(); ctx.arc(P.x, P.y, rr, 0, TAU); ctx.fill();
          ctx.strokeStyle = g.alpha('#000000', .35); ctx.lineWidth = 1; ctx.stroke();
          ctx.font = '600 9.5px "IBM Plex Mono",monospace';
          ctx.fillStyle = a.bh ? '#7CE0A8' : a.base ? '#5AA9FF' : th.text;
          ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
          ctx.fillText(a.t, P.x, P.y - rr - 8);
        } });
      });
      items.sort((x, y) => y.z - x.z).forEach(i => i.draw());

      /* ---------- Newman projection ---------- */
      if (p.showNewman) {
        const nx = W - 96, ny = 96, nr = 54;
        ctx.save();
        ctx.fillStyle = g.alpha(th['ink-950'], .82);
        ctx.beginPath(); ctx.arc(nx, ny, nr + 14, 0, TAU); ctx.fill();
        // back atom circle
        ctx.strokeStyle = g.alpha(th['text-2'], .85); ctx.lineWidth = 1.6;
        ctx.beginPath(); ctx.arc(nx, ny, nr, 0, TAU); ctx.stroke();
        // front bonds (from centre)
        const front = [[0, 'Br', '#C0603A'], [120, S.sb.ster > 0 ? 'CH₃' : 'H', '#DCE4F2'],
                       [240, S.sb.ster > 1 ? 'CH₃' : 'H', '#DCE4F2']];
        front.forEach(([a, lab, c]) => {
          const ar = (a - 90) * Math.PI / 180;
          const ex = nx + nr * Math.cos(ar), ey = ny + nr * Math.sin(ar);
          ctx.strokeStyle = g.alpha(th.text, .9); ctx.lineWidth = 2;
          ctx.beginPath(); ctx.moveTo(nx, ny); ctx.lineTo(ex, ey); ctx.stroke();
          ctx.fillStyle = c; ctx.font = '600 9.5px "IBM Plex Mono",monospace';
          ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
          ctx.fillText(lab, nx + (nr + 13) * Math.cos(ar), ny + (nr + 13) * Math.sin(ar));
        });
        // back bonds (from rim), rotated by the dihedral
        const back = [[0, 'Hβ', '#7CE0A8'], [120, 'H', '#DCE4F2'], [240, 'H', '#DCE4F2']];
        back.forEach(([a, lab, c]) => {
          const ar = (a + p.dihedral - 90) * Math.PI / 180;
          const sxp = nx + nr * Math.cos(ar), syp = ny + nr * Math.sin(ar);
          const ex = nx + (nr + 12) * Math.cos(ar), ey = ny + (nr + 12) * Math.sin(ar);
          ctx.strokeStyle = g.alpha(th['text-2'], .8); ctx.lineWidth = 2;
          ctx.beginPath(); ctx.moveTo(sxp, syp); ctx.lineTo(ex, ey); ctx.stroke();
          ctx.fillStyle = c; ctx.font = '600 9.5px "IBM Plex Mono",monospace';
          ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
          ctx.fillText(lab, nx + (nr + 24) * Math.cos(ar), ny + (nr + 24) * Math.sin(ar));
        });
        ctx.font = '9px "IBM Plex Mono",monospace';
        ctx.fillStyle = th['text-3']; ctx.textAlign = 'center'; ctx.textBaseline = 'top';
        ctx.fillText('Newman · φ = ' + p.dihedral.toFixed(0) + '°', nx, ny + nr + 30);
        ctx.restore();
      }

      /* ---------- geometry verdict ---------- */
      const antiOK = S.anti > 0.6;
      ctx.font = '700 15px "IBM Plex Sans Condensed",sans-serif';
      ctx.fillStyle = th.text; ctx.textAlign = 'left'; ctx.textBaseline = 'top';
      ctx.fillText(S.route + '  ·  ' + S.sb.label, 14, 12);
      ctx.font = '500 10.5px "IBM Plex Mono",monospace';
      ctx.fillStyle = antiOK ? th.ok : S.anti > 0.2 ? th.warn : th.crit;
      ctx.fillText(antiOK ? '✓ ANTI-PERIPLANAR — β-H is 180° from Br, orbitals aligned'
        : S.anti > 0.2 ? '~ partially aligned — E2 is slowed'
        : '✗ NOT anti-periplanar — E2 is blocked at this dihedral', 14, 34);
      ctx.fillStyle = th['text-3'];
      ctx.fillText('orbital overlap factor = ' + S.overlap.toFixed(3) +
        '   ·   major alkene: ' + S.major, 14, 50);

      /* ---------------- curly-arrow inset ----------------
         The 3D stage shows the geometry moving; this shows why it moves.
         An exam answer has to reproduce these arrows, not the animation. */
      if (p.arrows) {
        if (!S.aSteps || S.aWas !== S.route) {
          S.aSteps = elimMech(S.route === 'E2' || S.route === 'SN2', 'B⁻', 'Br');
          S.aMech = MECH.makeState(S.aSteps.length);
          S.aWas = S.route;
        }
        MECH.advance(S.aMech, g.dt || 0.016, { travel: 2.0, dwell: 1.35 });
        const iw = Math.min(g.w * 0.31, 268), ih = Math.min(g.h * 0.36, 196);
        const ix = 14, iy = g.h - ih - 30;
        ctx.save();
        ctx.fillStyle = g.alpha(th['ink-900'], .86);
        if (ctx.roundRect) { ctx.beginPath(); ctx.roundRect(ix, iy, iw, ih, 10); }
        else { ctx.beginPath(); ctx.rect(ix, iy, iw, ih); }
        ctx.fill();
        ctx.strokeStyle = g.alpha(th['line-soft'], 1); ctx.lineWidth = 1; ctx.stroke();
        const afr = MECH.frame(S.aSteps, S.aMech.i, S.aMech.u, S.aMech.a);
        MECH.draw(ctx, afr, { x: ix + iw * 0.50, y: iy + ih * 0.58, s: Math.min(iw, ih) * 0.215 }, {
          ground: th['ink-900'], colour: g.alpha(th['text-2'], .95),
          arrow: th.chem, forming: '#4ADE80', breaking: '#FB7185', width: 2.2
        });
        ctx.font = '600 9.5px "IBM Plex Mono",monospace';
        ctx.fillStyle = th.chem; ctx.textAlign = 'center'; ctx.textBaseline = 'top';
        ctx.fillText(afr.caption, ix + iw / 2, iy + 9);
        ctx.font = '500 8.5px "IBM Plex Mono",monospace'; ctx.fillStyle = th['text-3'];
        // the caption must fit the inset, so trim it rather than let it spill
        let sub2 = afr.sub;
        while (sub2.length > 8 && ctx.measureText(sub2).width > iw - 16) sub2 = sub2.slice(0, -2);
        if (sub2 !== afr.sub) sub2 = sub2.replace(/[ ,–—-]+$/, '') + '…';
        ctx.fillText(sub2, ix + iw / 2, iy + 22);
        ctx.restore();
      }

    },

    plots: [
      { title: 'Product distribution under these exact conditions',
        legend: [{ c: '#FFAE4C', label: 'elimination' }, { c: '#5AA9FF', label: 'substitution' }],
        draw(S, g) {
          const f = S.frac;
          const rows = [
            ['E2 Saytzeff', f.E2say, '#FFAE4C'], ['E2 Hofmann', f.E2hof, '#FFCE8C'],
            ['E1 Saytzeff', f.E1say, '#E0913A'], ['E1 Hofmann', f.E1hof, '#C98A2E'],
            ['SN2', f.SN2, '#5AA9FF'], ['SN1', f.SN1, '#7FC0FF']
          ];
          const P = g.Plot({
            xmin: -0.5, xmax: rows.length - 0.5, ymin: 0, ymax: 1.06,
            xlabel: '', ylabel: 'fraction of product',
            xticks: rows.map((_, i) => i),
            xfmt: v => (rows[Math.round(v)] || ['', 0])[0],
            yfmt: v => (v * 100).toFixed(0) + '%',
            pad: { l: 50, r: 16, t: 16, b: 38 }
          }).frame();
          P.clip(() => {
            rows.forEach((r, i) => {
              P.bar(i, r[1], 0.36, 0, g.alpha(r[2], .9));
              if (r[1] > 0.015) P.tag(i, r[1], (r[1] * 100).toFixed(0) + '%', g.theme.text, 'left', -9);
            });
          });
        },
        hover(S, x) {
          const f = S.frac;
          const rows = [['E2 Saytzeff', f.E2say], ['E2 Hofmann', f.E2hof], ['E1 Saytzeff', f.E1say],
                        ['E1 Hofmann', f.E1hof], ['SN2', f.SN2], ['SN1', f.SN1]];
          const i = clamp(Math.round(x), 0, rows.length - 1);
          return [{ label: rows[i][0], value: (rows[i][1] * 100).toFixed(1) + '%', color: '#FFAE4C' },
                  { label: 'total elimination', value: (S.elim * 100).toFixed(1) + '%' },
                  { label: 'total substitution', value: (S.subst * 100).toFixed(1) + '%' }];
        } },
      { title: 'How the E2 rate depends on the dihedral angle',
        legend: [{ c: '#FFAE4C', label: 'orbital overlap factor' }, { c: '#E7EDFB', label: 'your setting' }],
        draw(S, g) {
          const pts = [];
          for (let a = 0; a <= 360; a += 2) {
            const r = a * Math.PI / 180;
            pts.push([a, Math.pow(Math.max(0, -Math.cos(r)), 2) +
                         Math.pow(Math.max(0, Math.cos(r)), 2) * 0.08]);
          }
          const P = g.Plot({
            xmin: 0, xmax: 360, ymin: 0, ymax: 1.12,
            xlabel: 'dihedral φ (°)', ylabel: 'overlap',
            xticks: [0, 60, 120, 180, 240, 300, 360],
            xfmt: v => v.toFixed(0), yfmt: v => v.toFixed(1)
          }).frame();
          P.clip(() => {
            P.area(pts, 0, g.alpha(g.theme.chem, .14));
            P.line(pts, g.theme.chem, 2);
            P.vline(S.p.dihedral, g.alpha(g.theme.text, .8), [3, 3]);
            P.dot(S.p.dihedral, S.overlap, 4.5, g.theme.text, g.theme['ink-950']);
          });
          P.tag(180, 1.0, 'anti-periplanar', g.theme.ok, 'left', -9);
          P.tag(0, 0.08, 'syn (poor)', g.theme['text-3'], 'left', -9);
          P.tag(90, 0, 'orthogonal — no overlap', g.theme.crit, 'left', -9);
        } }
    ],

    readouts(S) {
      const p = S.p;
      return [
        { label: 'Dominant pathway', value: S.route, unit: '', flag: 'accent' },
        { label: 'Elimination total', value: (S.elim * 100).toFixed(1), unit: '%',
          flag: S.elim > S.subst ? 'ok' : '' },
        { label: 'Substitution total', value: (S.subst * 100).toFixed(1), unit: '%',
          flag: S.subst > S.elim ? 'ok' : '' },
        { label: 'Major alkene', value: S.major, unit: '',
          hint: S.major === 'Hofmann' ? 'less substituted — bulky base' : 'more substituted — more stable' },
        { label: 'Overlap factor', value: S.overlap.toFixed(3), unit: '',
          flag: S.anti > 0.6 ? 'ok' : S.anti > 0.2 ? 'warn' : 'crit', hint: 'needs φ ≈ 180°' },
        { label: 'Ea (E2)', value: S.Ea.E2.toFixed(0), unit: 'kJ/mol' },
        { label: 'Ea (SN2)', value: S.Ea.SN2.toFixed(0), unit: 'kJ/mol' },
        { label: 'Ea (E1 step 1)', value: S.Ea.E1.toFixed(0), unit: 'kJ/mol' },
        { label: 'E2 rate law', value: 'k[RX][B⁻]', unit: '', hint: 'second order' },
        { label: 'E1 rate law', value: 'k[RX]', unit: '', hint: 'first order' },
        { label: 'Temperature', value: p.temp.toFixed(0), unit: 'K',
          hint: 'heat favours elimination (ΔS > 0)' },
        { label: 'β-hydrogens available', value: String(S.sb.bH), unit: '' }
      ];
    },

    equation(S) {
      const p = S.p;
      return 'rate' + E.sub('E2') + ' ' + E.op('=') + ' ' + E.v('k') + '[RX][B<sup>−</sup>]' + E.op('×') +
        ' overlap(' + E.v('φ') + ') ' + E.op('=') + ' ' + E.v('k') + E.op('·') + E.n(p.conc, 'M') +
        E.op('·') + E.n(S.overlap.toFixed(3), '') +
        '<br>overlap ' + E.op('∝') + ' cos<sup>2</sup>' + E.v('φ') + ' with ' + E.v('φ') + ' ' + E.op('=') +
        ' 180° required' + E.op('·') + ' here ' + E.v('φ') + ' ' + E.op('=') + ' ' + E.n(p.dihedral, '°') +
        ' ' + E.op('→') + ' ' + E.n(S.overlap.toFixed(3), '') +
        '<br>ΔG<sup>‡</sup>(E2) ' + E.op('=') + ' ' + E.n(S.Ea.E2.toFixed(0), 'kJ/mol') + E.op(',') +
        ' ΔG<sup>‡</sup>(SN2) ' + E.op('=') + ' ' + E.n(S.Ea.SN2.toFixed(0), 'kJ/mol') + E.op('·') +
        ' elimination ' + E.op('=') + ' ' + E.n((S.elim * 100).toFixed(0), '%');
    },
    eqNote: '<b>Two gates, not one.</b> Energetics decides whether elimination beats substitution; ' +
      '<i>geometry</i> decides whether E2 can happen at all. A substrate that cannot reach a 180° H—C—C—LG ' +
      'dihedral — a rigid ring, for instance — simply will not do E2, no matter how strong the base.',

    walkthrough: [
      { title: '1 · The geometric requirement',
        body: 'Set a strong small base on a secondary halide and sweep the dihedral slider from 180° down to 90°.',
        ask: 'Why does the reaction stall at 90°?',
        reveal: 'E2 is <b>concerted</b>: the C—H bond breaks and the π bond forms in the same step. That needs the C—H σ orbital and the C—Br σ* orbital to be <b>parallel</b>, which happens at φ = 180° (anti-periplanar). At 90° they are orthogonal, overlap is zero, and there is no pathway at all.',
        params: { sub: 1, base: 2, bulk: 0, solvent: 'aprotic', temp: 340, dihedral: 90 } },
      { title: '2 · Saytzeff — the more substituted alkene',
        body: 'Put the dihedral back to 180° with a small ethoxide base and look at the product bars.',
        ask: 'When two different alkenes can form, which one dominates and why?',
        reveal: 'The <b>more substituted</b> one — Saytzeff\'s rule. More alkyl groups on the double bond means more hyperconjugation and a more stable alkene, and the transition state leading to it is lower in energy.',
        params: { sub: 1, base: 2, bulk: 0, solvent: 'aprotic', temp: 340, dihedral: 180 } },
      { title: '3 · Hofmann — switch to a bulky base',
        body: 'Change the base from ethoxide to potassium tert-butoxide and watch the two elimination bars swap.',
        ask: 'Why does a bulky base give the <i>less</i> substituted alkene?',
        reveal: '<b>Steric access.</b> The bulky base cannot reach the crowded internal β-hydrogen, so it removes the more exposed terminal one instead. Product stability loses to reagent accessibility — this is the <b>Hofmann</b> product, and "bulky base ⇒ Hofmann" is a guaranteed exam line.',
        params: { sub: 1, base: 2, bulk: 1, solvent: 'aprotic', temp: 340, dihedral: 180 } },
      { title: '4 · Heat favours elimination',
        body: 'Take the temperature slider from 290 K up to 370 K and watch the elimination vs substitution totals.',
        ask: 'Why does raising the temperature push the balance towards elimination?',
        reveal: 'Elimination makes <b>three molecules from two</b> (alkene + base-H + halide), so its entropy change is much more positive. Since ΔG = ΔH − TΔS, raising T lowers the elimination barrier more than the substitution one. "Alcoholic KOH and heat gives the alkene; aqueous KOH cold gives the alcohol" is exactly this effect.',
        params: { sub: 1, base: 2, bulk: 0, solvent: 'aprotic', temp: 370, dihedral: 180 } },
      { title: '5 · E1 — when the base is weak and the cation is stable',
        body: 'Switch to a tertiary substrate with a weak base in a polar protic solvent.',
        ask: 'What is the rate-determining step now, and what happens to the rate law?',
        reveal: 'Ionisation to the <b>carbocation</b> is rate-determining, exactly as in SN1 — so rate = k[RX] and the base concentration drops out entirely. E1 and SN1 share that first step, which is why they always appear together as a mixture of alkene and substitution product.',
        params: { sub: 2, base: 0, bulk: 0, solvent: 'protic', temp: 355, dihedral: 180 } }
    ],

    quiz: [
      { q: '2-bromo-2-methylbutane with hot alcoholic KOH gives mainly:',
        options: ['2-methylbut-1-ene (Hofmann)', '2-methylbut-2-ene (Saytzeff)',
                  '2-methylbutan-2-ol', 'no reaction'], answer: 1,
        why: 'Hot alcoholic KOH with a tertiary halide is classic elimination, and ethoxide is a small base, so Saytzeff applies: the more substituted 2-methylbut-2-ene dominates.' },
      { q: 'The E2 reaction requires the β-hydrogen and the leaving group to be:',
        options: ['syn-periplanar (0°)', 'gauche (60°)', 'anti-periplanar (180°)', 'orthogonal (90°)'], answer: 2,
        why: 'Anti-periplanar alignment puts the C—H σ orbital parallel to the C—LG σ*, which is what allows the concerted, single-step mechanism.' },
      { q: 'Changing from ethoxide to tert-butoxide, keeping everything else fixed, mainly:',
        options: ['switches the major product from Saytzeff to Hofmann',
                  'changes E2 into E1', 'stops the reaction entirely',
                  'switches elimination into substitution'], answer: 0,
        why: 'A bulky base cannot reach the internal β-hydrogen, so it abstracts the accessible terminal one and gives the less substituted (Hofmann) alkene.' }
    ],

    notes: '<b>Where this shows up in the paper.</b>' +
      '<ul><li>"Predict the major product" for a halide with alcoholic KOH, hot vs cold, small vs bulky base.</li>' +
      '<li>Saytzeff vs Hofmann selection — the single most common elimination question.</li>' +
      '<li>Stereospecificity: anti-periplanar geometry fixing which alkene geometry (E or Z) results.</li>' +
      '<li>Distinguishing E1 from E2 by order of reaction and by rearrangement products.</li></ul>' +
      '<div class="pyq"><em>Trap to avoid</em>Aqueous KOH and <b>alcoholic</b> KOH give different products from the ' +
      'same halide — substitution (alcohol) and elimination (alkene) respectively. The solvent word in the question ' +
      'is doing real work; it is not decoration.</div>'
  });

})(window.InsightLab);
