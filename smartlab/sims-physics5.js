/* ============================================================
   PHYSICS — 13. The photoelectric effect and matter waves
   ============================================================ */
(function (L) {
  'use strict';
  const { clamp, TAU, fmt, E } = L;
  const PA = window.PHYSART;

  const H = 6.62607015e-34, C = 2.99792458e8, QE = 1.602176634e-19, ME = 9.1093837015e-31;
  const HC_EVNM = H * C / QE * 1e9;                  // 1239.84 eV·nm

  const METALS = [
    { id: 'cs', name: 'Caesium',   phi: 2.14, col: '#FFD36B' },
    { id: 'k',  name: 'Potassium', phi: 2.30, col: '#C9B0FF' },
    { id: 'na', name: 'Sodium',    phi: 2.75, col: '#FFAE4C' },
    { id: 'ca', name: 'Calcium',   phi: 2.87, col: '#7CE0A8' },
    { id: 'zn', name: 'Zinc',      phi: 4.30, col: '#8FA3C0' },
    { id: 'cu', name: 'Copper',    phi: 4.65, col: '#D2793F' },
    { id: 'ag', name: 'Silver',    phi: 4.73, col: '#DCE7F6' },
    { id: 'pt', name: 'Platinum',  phi: 5.65, col: '#B9C6DE' }
  ];

  L.register({
    id: 'photoelectric', subject: 'physics',
    name: 'The Photoelectric Effect and Matter Waves',
    chapter: 'Dual Nature of Radiation & Matter',
    exams: ['JEE Main', 'JEE Advanced', 'NEET UG'],
    weight: 'Very high yield',
    is3D: false,
    stageHint: 'Dim the light to almost nothing — the electrons still come out, just fewer of them',
    lede: 'Three experimental facts killed the wave theory of light, and every one of them is reproducible on ' +
      'this bench. Below a <b>threshold frequency</b> no electrons appear at all, however bright the lamp. ' +
      'Above it they appear <b>instantly</b>, and their maximum energy depends on the <b>colour</b> and not at ' +
      'all on the brightness. Turning the intensity down reduces <b>how many</b> come out and never <b>how ' +
      'fast</b>. Plot the stopping potential against frequency and the slope of that straight line is ' +
      '<b>h/e</b> — Planck\'s constant, measured with a voltmeter.',

    params: { metal: 'na', lam: 400, intensity: 1.0, V: 0, showDeBroglie: true },

    presets: [
      { name: 'Sodium, violet light', params: { metal: 'na', lam: 400, V: 0, intensity: 1 } },
      { name: 'Below threshold — nothing happens', params: { metal: 'na', lam: 600, intensity: 1 } },
      { name: 'Below threshold, lamp at maximum', params: { metal: 'na', lam: 600, intensity: 3 } },
      { name: 'Retarding voltage at cut-off', params: { metal: 'na', lam: 400, V: -0.35 } },
      { name: 'Caesium — works in visible light', params: { metal: 'cs', lam: 550, V: 0 } },
      { name: 'Platinum — needs the ultraviolet', params: { metal: 'pt', lam: 200, V: 0 } },
      { name: 'Half the intensity, same colour', params: { metal: 'na', lam: 400, intensity: 0.5 } }
    ],

    controls: [
      { group: 'Cathode', items: [
        { key: 'metal', type: 'select', label: 'Emitting metal', restructure: true,
          options: METALS.map(m => ({ value: m.id, label: m.name + '  (φ = ' + m.phi + ' eV)' })) }
      ] },
      { group: 'Incident light', items: [
        { key: 'lam', label: 'Wavelength <i>λ</i>', min: 120, max: 750, step: 1, unit: 'nm',
          fmt: v => v.toFixed(0), restructure: true },
        { key: 'intensity', label: 'Intensity', min: 0.05, max: 3, step: 0.05, unit: '×',
          fmt: v => v.toFixed(2), restructure: true }
      ] },
      { group: 'Collector', items: [
        { key: 'V', label: 'Anode potential <i>V</i>', min: -3, max: 3, step: 0.01, unit: 'V',
          fmt: v => v.toFixed(2), restructure: true }
      ] },
      { group: 'Display', items: [
        { key: 'showDeBroglie', type: 'toggle', label: 'Show the electron matter wave' }
      ] }
    ],

    setup(S) {
      const p = S.p;
      const m = METALS.find(x => x.id === p.metal) || METALS[2];
      S.m = m;
      S.Ephot = HC_EVNM / p.lam;                      // photon energy, eV
      S.nu = C / (p.lam * 1e-9);                      // Hz
      S.lam0 = HC_EVNM / m.phi;                       // threshold wavelength, nm
      S.nu0 = m.phi * QE / H;                         // threshold frequency, Hz
      S.emits = S.Ephot > m.phi;
      S.KEmax = Math.max(0, S.Ephot - m.phi);         // eV
      S.V0 = S.KEmax;                                 // stopping potential, volts
      S.vmax = Math.sqrt(2 * S.KEmax * QE / ME);      // m/s
      S.pmax = ME * S.vmax;
      S.lamDB = S.pmax > 0 ? H / S.pmax * 1e9 : Infinity;   // de Broglie, nm

      // Saturation current: proportional to the photon ARRIVAL RATE, so for a
      // fixed power the count goes up as the wavelength does. This is why the
      // graph family is labelled by intensity and not by photon number.
      S.Isat = S.emits ? p.intensity * 10 * (p.lam / 400) : 0;

      // Emitted electrons carry a spread of energies from 0 up to KEmax — only
      // those from the very surface leave with the maximum. A retarding
      // potential rejects everything below eV, which is what shapes the I–V
      // curve near cut-off rather than a hard step.
      S.current = V => {
        if (!S.emits) return 0;
        if (V >= 0) return S.Isat;                    // accelerating: all collected
        const frac = clamp(1 - (-V) / S.KEmax, 0, 1);
        return S.Isat * frac * frac;                  // triangular energy spread
      };
      S.I = S.current(p.V);
      S.cutoff = p.V <= -S.V0 + 1e-9;

      // the animated electrons
      S.e = S.e || [];
      const want = S.emits ? Math.round(clamp(S.Isat * 2.4, 3, 46)) : 0;
      while (S.e.length > want) S.e.pop();
      while (S.e.length < want) S.e.push({ u: Math.random(), ke: Math.random(), y: Math.random(), dead: 0 });
      S.t = S.t || 0;
      S.photons = S.photons || [];
      const wantP = Math.round(clamp(p.intensity * 14, 3, 40));
      while (S.photons.length > wantP) S.photons.pop();
      while (S.photons.length < wantP) S.photons.push({ u: Math.random(), y: Math.random() });
    },

    step(S, dt) {
      const p = S.p;
      S.t += dt;
      S.photons.forEach(q => {
        q.u += dt * 0.55;
        if (q.u > 1) { q.u -= 1; q.y = Math.random(); }
      });
      S.e.forEach(q => {
        // an electron launched with energy ke*KEmax must climb a barrier of -V
        const need = p.V < 0 ? -p.V / Math.max(S.KEmax, 1e-9) : 0;
        const makesIt = q.ke >= need;
        const speed = 0.35 + 0.75 * Math.sqrt(Math.max(q.ke - need, 0.02));
        if (makesIt) {
          q.u += dt * speed;
          if (q.u > 1) { q.u = 0; q.ke = Math.random(); q.y = Math.random(); }
        } else {
          // turned back by the retarding field: out, slow, stop, return
          q.u += dt * speed * Math.cos(Math.min(q.u / Math.max(q.ke / Math.max(need, 1e-9), .08), 1) * Math.PI);
          if (q.u <= 0) { q.u = 0; q.ke = Math.random(); q.y = Math.random(); }
          if (q.u > 0.92) q.u = 0.92;
        }
      });
    },

    drawStage(S, g) {
      const ctx = g.ctx, th = g.theme, p = S.p, W = g.w, H2 = g.h;
      const HDR = 62, FOOT = 26;
      const y0 = HDR, y1 = H2 - FOOT, CH = y1 - y0;
      const lightCol = PA.nmColour(p.lam);

      /* ---------------- the photo-cell ---------------- */
      const tubeW = Math.min(W * 0.46, 430), tubeH = Math.min(CH * 0.50, 190);
      const tcx = W * 0.36, tcy = y0 + CH * 0.30;
      PA.photocell(ctx, tcx, tcy, tubeW, tubeH);

      const catX = tcx - tubeW * 0.30, anX = tcx + tubeW * 0.32;
      const plateH = tubeH * 0.62;

      // the lamp and its beam, entering through the window onto the cathode
      const lampX = Math.max(46, tcx - tubeW * 0.64), lampY = tcy - tubeH * 0.40;
      PA.beam(ctx, lampX, lampY, catX, tcy, plateH * 0.30, lightCol, clamp(p.intensity / 3, .12, 1));
      PA.plate(ctx, lampX, lampY, 26, 18, '#2E3A55', 0);
      PA.lbl(ctx, lampX, lampY - 15, p.lam + ' nm', lightCol, 'center', 10);
      PA.lbl(ctx, lampX, lampY + 16, S.Ephot.toFixed(2) + ' eV', th['text-3'], 'center', 8.5);
      PA.lbl(ctx, lampX, lampY + 27, 'per photon', th['text-3'], 'center', 8.5);

      // photons in flight, each one drawn as a quantum and not as a wave train
      S.photons.forEach(q => {
        const px = lampX + (catX - lampX) * q.u;
        const py = lampY + (tcy - lampY) * q.u + (q.y - 0.5) * plateH * 0.30 * q.u;
        ctx.save(); ctx.globalCompositeOperation = 'lighter';
        const gg = ctx.createRadialGradient(px, py, 0, px, py, 7);
        gg.addColorStop(0, PA.rgba(lightCol, .95));
        gg.addColorStop(1, PA.rgba(lightCol, 0));
        ctx.fillStyle = gg;
        ctx.beginPath(); ctx.arc(px, py, 7, 0, TAU); ctx.fill();
        ctx.restore();
      });

      // cathode — glows when it is actually emitting
      PA.plate(ctx, catX, tcy, 13, plateH, S.m.col, S.emits ? clamp(p.intensity / 2, .2, 1) : 0);
      PA.lbl(ctx, catX, tcy + plateH / 2 + 13, 'CATHODE · ' + S.m.name, S.m.col, 'center', 9.5);
      PA.lbl(ctx, catX, tcy + plateH / 2 + 25, 'φ = ' + S.m.phi.toFixed(2) + ' eV',
             th['text-3'], 'center', 9);
      // anode
      PA.plate(ctx, anX, tcy, 13, plateH * 0.82, '#8FA3C0', 0);
      PA.lbl(ctx, anX, tcy + plateH / 2 + 13, 'ANODE', '#C9D4EA', 'center', 9.5);
      PA.lbl(ctx, anX, tcy + plateH / 2 + 25, (p.V >= 0 ? '+' : '') + p.V.toFixed(2) + ' V',
             p.V < 0 ? th.crit : th.ok, 'center', 9);

      // the retarding field between the plates, when there is one
      if (p.V < -0.001) {
        const n = 5;
        for (let i = 0; i < n; i++) {
          const yy = tcy - plateH * 0.34 + i * plateH * 0.17;
          PA.vector(ctx, anX - 22, yy, catX + 22, yy, th.crit,
                    { width: 1.6, shadow: false });
        }
        PA.lbl(ctx, (catX + anX) / 2, tcy - plateH * 0.50,
               'retarding field pushes electrons back', th.crit, 'center', 9);
      }

      /* ---- the photoelectrons ---- */
      if (S.emits) {
        S.e.forEach(q => {
          const ex = catX + 10 + (anX - catX - 20) * q.u;
          const ey = tcy + (q.y - 0.5) * plateH * 0.80;
          const ke = q.ke * S.KEmax;
          const hot = q.ke > 0.8;
          PA.rgba && 0;
          const col = hot ? '#FFE9A8' : '#3DD6F5';
          ctx.save(); ctx.globalCompositeOperation = 'lighter';
          const gg = ctx.createRadialGradient(ex, ey, 0, ex, ey, 9);
          gg.addColorStop(0, PA.rgba(col, .8)); gg.addColorStop(1, PA.rgba(col, 0));
          ctx.fillStyle = gg; ctx.beginPath(); ctx.arc(ex, ey, 9, 0, TAU); ctx.fill();
          ctx.restore();
          ctx.fillStyle = col;
          ctx.beginPath(); ctx.arc(ex, ey, 2.6, 0, TAU); ctx.fill();
          // the matter wave the electron is also
          if (p.showDeBroglie && q.ke > 0.15) {
            // a faster electron has a SHORTER de Broglie wavelength, so the
            // packet visibly tightens as ke rises
            const wl = 16 + 26 * (1 - Math.sqrt(q.ke));
            ctx.strokeStyle = PA.rgba(col, .34); ctx.lineWidth = 1.1;
            ctx.beginPath();
            for (let k = -20; k <= 20; k++) {
              const wx = ex + k;
              const wy = ey + Math.sin((k / wl) * TAU + S.t * 5) * 3.4 *
                Math.exp(-(k * k) / 190);
              k === -20 ? ctx.moveTo(wx, wy) : ctx.lineTo(wx, wy);
            }
            ctx.stroke();
          }
        });
      } else {
        PA.lbl(ctx, (catX + anX) / 2, tcy,
               'NO EMISSION', th.crit, 'center', 15);
        PA.lbl(ctx, (catX + anX) / 2, tcy + 18,
               'hν = ' + S.Ephot.toFixed(2) + ' eV  <  φ = ' + S.m.phi.toFixed(2) + ' eV',
               th.crit, 'center', 10);
        PA.lbl(ctx, (catX + anX) / 2, tcy + 34,
               'brightness cannot help: one electron absorbs one photon',
               th['text-3'], 'center', 9);
      }

      /* ---- the external circuit: a battery and a microammeter ---- */
      {
        const cy2 = tcy + tubeH * 0.62;
        PA.wire(ctx, [[catX, tcy + plateH / 2 + 34], [catX, cy2], [tcx - 40, cy2]], '#C9D4EA');
        PA.wire(ctx, [[tcx + 40, cy2], [anX, cy2], [anX, tcy + plateH / 2 + 34]], '#C9D4EA');
        // the meter
        const mr = 20;
        PA.plate(ctx, tcx, cy2, 78, 30, '#1B2740', 0);
        PA.lbl(ctx, tcx, cy2 - 6, S.I.toFixed(2) + ' µA', S.I > 0.01 ? '#3DD6F5' : th['text-3'],
               'center', 12);
        PA.lbl(ctx, tcx, cy2 + 9, 'photocurrent', th['text-3'], 'center', 8);
      }

      /* ---------------- the energy ledger ---------------- */
      {
        const bw = Math.min(W * 0.30, 264), bh = 118;
        const bx0 = W - bw - 14, by0 = y0 + 4;
        ctx.fillStyle = g.alpha('#0B1020', .86);
        ctx.strokeStyle = g.alpha(th.line, 1); ctx.lineWidth = 1;
        ctx.beginPath(); ctx.roundRect(bx0, by0, bw, bh, 8); ctx.fill(); ctx.stroke();
        PA.lbl(ctx, bx0 + 10, by0 + 13, 'WHERE THE PHOTON ENERGY GOES', th['text-3'], 'left', 8.5);
        const iw = bw - 20, ix = bx0 + 10, iy = by0 + 26, ih = 20;
        const scale = Math.max(S.Ephot, S.m.phi) * 1.05;
        // the work function first, then whatever is left as kinetic energy
        ctx.fillStyle = g.alpha('#FB7185', .75);
        ctx.fillRect(ix, iy, iw * Math.min(S.m.phi, S.Ephot) / scale, ih);
        if (S.KEmax > 0) {
          ctx.fillStyle = g.alpha('#3DD6F5', .85);
          ctx.fillRect(ix + iw * S.m.phi / scale, iy, iw * S.KEmax / scale, ih);
        }
        ctx.strokeStyle = g.alpha(th.line, 1);
        ctx.strokeRect(ix, iy, iw * S.Ephot / scale, ih);
        // the work function marker stays put whatever the colour of the light
        const wx = ix + iw * S.m.phi / scale;
        ctx.strokeStyle = g.alpha('#FB7185', .95); ctx.lineWidth = 1.6;
        ctx.beginPath(); ctx.moveTo(wx, iy - 4); ctx.lineTo(wx, iy + ih + 4); ctx.stroke();
        PA.lbl(ctx, ix, iy + ih + 14, 'φ = ' + S.m.phi.toFixed(2) + ' eV', '#FB7185', 'left', 9);
        PA.lbl(ctx, ix + iw, iy + ih + 14,
               'KE_max = ' + S.KEmax.toFixed(3) + ' eV', '#3DD6F5', 'right', 9);
        PA.lbl(ctx, ix, iy + ih + 30, 'hν = ' + S.Ephot.toFixed(3) + ' eV', th.text, 'left', 9.5);
        PA.lbl(ctx, ix + iw, iy + ih + 30,
               'V₀ = ' + S.V0.toFixed(3) + ' V', S.emits ? th.ok : th.crit, 'right', 9.5);
        PA.lbl(ctx, ix, iy + ih + 46,
               S.emits ? 'λ = ' + p.lam + ' nm < λ₀ = ' + S.lam0.toFixed(0) + ' nm'
                       : 'λ = ' + p.lam + ' nm > λ₀ = ' + S.lam0.toFixed(0) + ' nm — too long',
               S.emits ? th.ok : th.crit, 'left', 9);
      }

      /* ---------------- the matter-wave readout ---------------- */
      if (p.showDeBroglie && S.emits) {
        const bw = Math.min(W * 0.30, 264), bh = 52;
        const bx0 = W - bw - 14, by0 = y0 + 130;
        ctx.fillStyle = g.alpha('#0B1020', .86);
        ctx.strokeStyle = g.alpha('#B07CC6', .45); ctx.lineWidth = 1;
        ctx.beginPath(); ctx.roundRect(bx0, by0, bw, bh, 8); ctx.fill(); ctx.stroke();
        PA.lbl(ctx, bx0 + 10, by0 + 13, 'THE ELECTRON IS ALSO A WAVE', '#B07CC6', 'left', 8.5);
        PA.lbl(ctx, bx0 + 10, by0 + 29, 'v_max = ' + fmt(S.vmax, 4) + ' m/s   ·   λ_dB = ' +
               S.lamDB.toFixed(3) + ' nm', th.text, 'left', 9.5);
        PA.lbl(ctx, bx0 + 10, by0 + 43,
               'h/p, and ' + (p.lam / S.lamDB).toFixed(0) + '× shorter than the light that made it',
               '#B07CC6', 'left', 8.5);
      }

      /* ---------------- the energy-level picture of the surface ----------------
         The same event drawn in energy rather than in space: an electron at the
         top of the filled band absorbs hν, pays φ to escape, and keeps the rest. */
      {
        const pw = Math.min(W * 0.42, 360), ph = Math.min(CH * 0.30, 118);
        const px0 = 18, py0 = y1 - ph - 4;
        ctx.fillStyle = g.alpha('#0B1020', .78);
        ctx.strokeStyle = g.alpha(th.line, 1); ctx.lineWidth = 1;
        ctx.beginPath(); ctx.roundRect(px0, py0, pw, ph, 8); ctx.fill(); ctx.stroke();
        PA.lbl(ctx, px0 + 10, py0 + 12, 'THE SAME EVENT, IN ENERGY', th['text-3'], 'left', 8.5);

        const eMax = Math.max(S.Ephot, S.m.phi) * 1.18;
        const baseY = py0 + ph - 16, topY = py0 + 24;
        const EY = ev => baseY - (ev / eMax) * (baseY - topY);
        const mx0 = px0 + 72, mx1 = px0 + pw * 0.46;

        // the filled band, below the Fermi level
        ctx.fillStyle = g.alpha(S.m.col, .22);
        ctx.fillRect(mx0, EY(0), mx1 - mx0, baseY - EY(0) + 0);
        ctx.fillStyle = g.alpha(S.m.col, .30);
        ctx.fillRect(mx0, EY(0), mx1 - mx0, 3);
        PA.lbl(ctx, mx0 - 5, EY(0), 'Fermi level', S.m.col, 'right', 8.5);
        for (let i = 0; i < 7; i++) {
          ctx.strokeStyle = g.alpha(S.m.col, .30); ctx.lineWidth = 1;
          const yy = EY(0) + 5 + i * (baseY - EY(0) - 6) / 7;
          ctx.beginPath(); ctx.moveTo(mx0 + 4, yy); ctx.lineTo(mx1 - 4, yy); ctx.stroke();
        }
        // the vacuum level, one work function above it
        ctx.strokeStyle = g.alpha('#FB7185', .95); ctx.lineWidth = 1.6;
        ctx.save(); ctx.setLineDash([5, 4]);
        ctx.beginPath(); ctx.moveTo(mx0, EY(S.m.phi)); ctx.lineTo(px0 + pw - 14, EY(S.m.phi));
        ctx.stroke(); ctx.restore();
        PA.lbl(ctx, mx0 - 5, EY(S.m.phi), 'vacuum', '#FB7185', 'right', 8.5);

        // the photon delivering hv, and what is left afterwards
        const ax = mx1 + 34;
        PA.vector(ctx, ax, EY(0), ax, EY(S.Ephot), lightCol, { width: 3, shadow: false });
        PA.lbl(ctx, ax + 8, (EY(0) + EY(S.Ephot)) / 2, 'hν = ' + S.Ephot.toFixed(2) + ' eV',
               lightCol, 'left', 9);
        const bx1 = px0 + pw - 60;
        PA.vector(ctx, bx1, EY(0), bx1, EY(Math.min(S.m.phi, S.Ephot)), '#FB7185',
                  { width: 3, shadow: false });
        PA.lbl(ctx, bx1 - 7, (EY(0) + EY(S.m.phi)) / 2, 'φ', '#FB7185', 'right', 9.5);
        if (S.KEmax > 0) {
          PA.vector(ctx, bx1, EY(S.m.phi), bx1, EY(S.Ephot), '#3DD6F5',
                    { width: 3, shadow: false });
          PA.lbl(ctx, bx1 + 7, (EY(S.m.phi) + EY(S.Ephot)) / 2,
                 'KE = ' + S.KEmax.toFixed(2) + ' eV', '#3DD6F5', 'left', 9);
          PA.lbl(ctx, px0 + pw - 12, py0 + 12, 'electron escapes', th.ok, 'right', 8.5);
        } else {
          PA.lbl(ctx, px0 + pw - 12, py0 + 12, 'falls short of the vacuum level',
                 th.crit, 'right', 8.5);
        }
      }

      /* ---------------- header ---------------- */
      ctx.textAlign = 'left'; ctx.textBaseline = 'top';
      ctx.font = '700 19px "IBM Plex Sans Condensed",sans-serif';
      ctx.fillStyle = S.emits ? (S.cutoff ? th.warn : th.ok) : th.crit;
      ctx.fillText(!S.emits ? 'BELOW THRESHOLD — no photoelectrons at any intensity'
                 : S.cutoff ? 'AT CUT-OFF — the retarding potential stops even the fastest'
                            : 'EMITTING — photocurrent ' + S.I.toFixed(2) + ' µA', 14, 8);
      ctx.font = '500 10px "IBM Plex Mono",monospace'; ctx.fillStyle = th['text-3'];
      ctx.fillText('hν = ' + S.Ephot.toFixed(3) + ' eV   ·   φ = ' + S.m.phi.toFixed(2) +
        ' eV   ·   KE_max = hν − φ = ' + S.KEmax.toFixed(3) + ' eV   ·   V₀ = ' +
        S.V0.toFixed(3) + ' V', 14, 31);
      ctx.fillStyle = th['text-3'];
      ctx.fillText('threshold λ₀ = hc/φ = ' + S.lam0.toFixed(1) + ' nm   ·   ν₀ = ' +
        fmt(S.nu0, 4) + ' Hz   ·   intensity sets the CURRENT, never the ENERGY', 14, 45);
    },

    plots: [
      { title: 'The I–V characteristic — intensity moves the plateau, colour moves the cut-off',
        legend: [{ c: '#3DD6F5', label: 'this setting' }, { c: '#63729A', label: 'other intensities' }],
        draw(S, g) {
          const p = S.p;
          const Imax = Math.max(S.Isat, 1) * 3.2;
          const P = g.Plot({
            xmin: -3, xmax: 3, ymin: 0, ymax: Imax,
            xlabel: 'anode potential V (volts)', ylabel: 'photocurrent (µA)',
            xfmt: v => v.toFixed(1), yfmt: v => v.toFixed(0),
            pad: { l: 54, r: 16, t: 14, b: 34 }
          }).frame();
          const curve = (Isat, V0) => {
            const c = [];
            for (let i = 0; i <= 200; i++) {
              const V = -3 + 6 * i / 200;
              let I;
              if (V >= 0) I = Isat;
              else { const f = clamp(1 - (-V) / Math.max(V0, 1e-9), 0, 1); I = Isat * f * f; }
              c.push([V, I]);
            }
            return c;
          };
          P.clip(() => {
            if (S.emits) {
              // the same colour at other brightnesses: SAME cut-off, different plateau
              [0.4, 0.7, 1.5, 2.2].forEach(k =>
                P.line(curve(S.Isat * k, S.V0), g.alpha(g.theme['text-3'], .38), 1.2));
              P.line(curve(S.Isat, S.V0), '#3DD6F5', 2.4);
              P.vline(-S.V0, g.alpha(g.theme.warn, .9), [4, 3]);
              P.dot(-S.V0, 0, 4.5, g.theme.warn, true);
              P.tag(-S.V0, Imax * 0.08, 'V₀ = ' + S.V0.toFixed(2) + ' V',
                    g.theme.warn, 'left', 0);
              P.hline(S.Isat, g.alpha(g.theme.ok, .5), [3, 3]);
              P.tag(2.9, S.Isat, 'saturation ∝ intensity', g.theme.ok, 'right', -8);
            } else {
              P.tag(0, Imax * 0.5, 'no current at any voltage — hν < φ', g.theme.crit, 'center', 0);
            }
            P.vline(0, g.alpha(g.theme['text-3'], .6));
            P.dot(p.V, S.I, 4.5, '#3DD6F5', true);
          });
        },
        hover(S, x) {
          return [{ label: 'anode potential', value: x.toFixed(3) + ' V' },
                  { label: 'photocurrent', value: S.current(x).toFixed(3) + ' µA', color: '#3DD6F5' },
                  { label: 'stopping potential', value: S.V0.toFixed(3) + ' V', color: '#FFAE4C' },
                  { label: 'saturation current', value: S.Isat.toFixed(3) + ' µA' }];
        } },
      { title: "Stopping potential against frequency — the slope is Planck's constant over e",
        legend: [{ c: '#FFAE4C', label: 'this metal' }, { c: '#63729A', label: 'every other metal' }],
        draw(S, g) {
          const p = S.p;
          const numax = C / (120e-9);
          const P = g.Plot({
            xmin: 0, xmax: numax / 1e15, ymin: -6, ymax: HC_EVNM / 120 - 1,
            xlabel: 'frequency ν (×10¹⁵ Hz)', ylabel: 'stopping potential V₀ (V)',
            xfmt: v => v.toFixed(1), yfmt: v => v.toFixed(1),
            pad: { l: 54, r: 16, t: 14, b: 34 }
          }).frame();
          P.clip(() => {
            // every metal gives a line of the SAME slope, displaced by its phi
            METALS.forEach(m => {
              const on = m.id === p.metal;
              const nu0 = m.phi * QE / H;
              const line = [[nu0 / 1e15, 0], [numax / 1e15, H * numax / QE - m.phi]];
              P.line(line, on ? '#FFAE4C' : g.alpha(m.col, .30), on ? 2.6 : 1.2);
              if (on) {
                P.dot(nu0 / 1e15, 0, 4.5, '#FFAE4C', true);
                P.tag(nu0 / 1e15, 0, m.name + ' ν₀', '#FFAE4C', 'left', -9);
              }
            });
            P.hline(0, g.alpha(g.theme['text-3'], .7));
            if (S.emits) {
              P.vline(S.nu / 1e15, g.alpha(g.theme.text, .85));
              P.dot(S.nu / 1e15, S.V0, 5, '#3DD6F5', true);
            }
          });
          P.tag(numax / 1e15 * 0.97, HC_EVNM / 120 - 2,
                'slope = h/e = 4.136×10⁻¹⁵ V·s  —  the same for every metal',
                g.theme['text-3'], 'right', 0);
        },
        hover(S, x) {
          const nu = x * 1e15;
          const m = S.m;
          const V0 = Math.max(0, H * nu / QE - m.phi);
          return [{ label: 'frequency', value: fmt(nu, 4) + ' Hz' },
                  { label: 'photon energy', value: (H * nu / QE).toFixed(3) + ' eV' },
                  { label: 'work function', value: m.phi.toFixed(2) + ' eV', color: '#FB7185' },
                  { label: 'stopping potential', value: V0.toFixed(3) + ' V', color: '#FFAE4C' },
                  { label: 'emission?', value: H * nu / QE > m.phi ? 'yes' : 'no',
                    color: H * nu / QE > m.phi ? '#7CE0A8' : '#FB7185' }];
        } }
    ],

    readouts(S) {
      const p = S.p;
      return [
        { label: 'Photon energy hν = hc/λ', value: S.Ephot.toFixed(4), unit: 'eV', flag: 'accent',
          hint: 'hc = 1239.84 eV·nm' },
        { label: 'Work function φ', value: S.m.phi.toFixed(2), unit: 'eV',
          hint: S.m.name },
        { label: 'Threshold wavelength λ₀ = hc/φ', value: S.lam0.toFixed(2), unit: 'nm',
          flag: S.emits ? 'ok' : 'crit',
          hint: S.emits ? 'λ is shorter — emission' : 'λ is longer — no emission' },
        { label: 'Threshold frequency ν₀', value: fmt(S.nu0, 4), unit: 'Hz' },
        { label: 'Maximum kinetic energy', value: S.KEmax.toFixed(4), unit: 'eV',
          flag: 'accent', hint: 'hν − φ · independent of intensity' },
        { label: 'Stopping potential V₀', value: S.V0.toFixed(4), unit: 'V',
          hint: 'eV₀ = KE_max' },
        { label: 'Maximum electron speed', value: fmt(S.vmax, 4), unit: 'm/s',
          hint: 'v/c = ' + (S.vmax / C).toFixed(4) },
        { label: 'Saturation current', value: S.Isat.toFixed(3), unit: 'µA',
          hint: 'proportional to intensity only' },
        { label: 'Current now', value: S.I.toFixed(3), unit: 'µA',
          flag: S.I < 1e-6 ? 'crit' : '' },
        { label: 'de Broglie λ = h/p', value: isFinite(S.lamDB) ? S.lamDB.toFixed(4) : '—',
          unit: 'nm', flag: 'accent',
          hint: isFinite(S.lamDB) ? (p.lam / S.lamDB).toFixed(0) + '× shorter than the light' : '' },
        { label: 'Photon momentum h/λ', value: fmt(H / (p.lam * 1e-9), 3), unit: 'kg·m/s' },
        { label: 'Electron momentum', value: S.pmax > 0 ? fmt(S.pmax, 3) : '—', unit: 'kg·m/s' }
      ];
    },

    equation(S) {
      return E.v('h') + 'ν ' + E.op('=') + ' φ ' + E.op('+') + ' KE' + E.sub('max') +
        '&nbsp;&nbsp;⇒&nbsp;&nbsp;' + E.v('e') + E.v('V') + E.sub('0') + ' ' + E.op('=') + ' ' +
        E.v('h') + 'ν ' + E.op('−') + ' φ ' + E.op('=') + ' ' + E.n(S.KEmax, 'eV') +
        '<br>' + E.v('V') + E.sub('0') + ' ' + E.op('=') + ' ' +
        E.frac(E.v('h'), E.v('e')) + 'ν ' + E.op('−') + ' ' + E.frac('φ', E.v('e')) +
        '&nbsp;&nbsp;(a straight line of slope ' + E.v('h') + '/' + E.v('e') + ')' +
        '&nbsp;&nbsp;&nbsp;λ' + E.sub('dB') + ' ' + E.op('=') + ' ' +
        E.frac(E.v('h'), E.v('p')) + ' ' + E.op('=') + ' ' +
        (isFinite(S.lamDB) ? E.n(S.lamDB, 'nm') : '—');
    },

    walkthrough: [
      { title: '1 · Turn the lamp right down',
        body: 'Sodium under 400 nm light. Drop the intensity to 0.05 and watch the meter and the electrons.',
        ask: 'Fewer electrons come out. Do they come out more slowly?',
        reveal: 'No. The current falls in exact proportion to the intensity, but <b>KE_max does not move at ' +
          'all</b> and neither does the stopping potential. A wave theory predicts the opposite: a dimmer wave ' +
          'should deliver energy more slowly and give feebler electrons. It does not happen.',
        params: { metal: 'na', lam: 400, intensity: 0.05, V: 0 } },
      { title: '2 · Make the light redder instead',
        body: 'Restore the intensity and slide λ from 400 nm out past 450 nm.',
        ask: 'What happens at exactly 451 nm for sodium?',
        reveal: 'Everything stops. λ₀ = hc/φ = 1239.84/2.75 = <b>451 nm</b>, and beyond it not one electron ' +
          'is emitted. The threshold is a property of the <b>metal</b>, and no amount of light of the wrong ' +
          'colour will cross it.',
        params: { metal: 'na', lam: 600, intensity: 1 } },
      { title: '3 · Now make it as bright as it goes',
        body: 'Stay at 600 nm and push the intensity to its maximum.',
        ask: 'A brighter lamp delivers far more energy per second. Why does nothing happen?',
        reveal: 'Because <b>one electron absorbs one photon</b>. Brightness sends more photons, not bigger ' +
          'ones, and every one of them is still too small to pay the work function. This single fact is what ' +
          'makes light particulate — a wave would let an electron simply accumulate energy until it had enough.',
        params: { metal: 'na', lam: 600, intensity: 3 } },
      { title: '4 · Measure Planck\'s constant',
        body: 'Go back above threshold and look at the right-hand graph — stopping potential against frequency.',
        ask: 'Every metal gives a different line. What do all the lines have in common?',
        reveal: 'Their <b>slope</b>. V₀ = (h/e)ν − φ/e, so the gradient is h/e = 4.136×10⁻¹⁵ V·s for every ' +
          'metal in existence; only the intercept changes. Millikan measured exactly this line to get h, and ' +
          'it remains one of the cleanest determinations of a fundamental constant ever made.',
        params: { metal: 'cs', lam: 400, V: 0 } },
      { title: '5 · Stop the fastest electron',
        body: 'Make the anode negative and bring V down until the meter reads zero.',
        ask: 'What is special about the voltage at which the current finally vanishes?',
        reveal: 'It is <b>−V₀</b>, and eV₀ is exactly the maximum kinetic energy. Note the current does not ' +
          'switch off suddenly: the electrons emerge with a <b>spread</b> of energies, so the slow ones are ' +
          'turned back first and the curve tails off. Only the very fastest survive to the last volt.',
        params: { metal: 'na', lam: 400, V: -0.35 } }
    ],

    problems: [
      { source: 'NEET pattern · Einstein equation',
        q: 'Light of wavelength 400 nm falls on sodium, whose work function is 2.75 eV. Find the maximum kinetic energy of the photoelectrons, in eV.',
        params: { metal: 'na', lam: 400, intensity: 1, V: 0 },
        predict: { label: 'KE_max', unit: 'eV', tol: 0.03 },
        measure: S => S.KEmax,
        working: 'hν = 1240/400 = 3.10 eV, so KE_max = 3.10 − 2.75 = <b>0.35 eV</b>. ' +
          'Using hc = 1240 eV·nm turns this into mental arithmetic and is worth memorising; ' +
          'the stopping potential is then 0.35 V, numerically equal because the charge is one e.' },
      { source: 'JEE Main pattern · threshold',
        q: 'A metal has a work function of 4.73 eV. Find its threshold wavelength, in nanometres.',
        params: { metal: 'ag', lam: 250, intensity: 1 },
        predict: { label: 'threshold wavelength', unit: 'nm', tol: 0.02 },
        measure: S => S.lam0,
        working: 'λ₀ = hc/φ = 1240/4.73 = <b>262 nm</b> — in the ultraviolet, which is why silver ' +
          'shows no photoelectric effect in visible light at all. Longer wavelength means lower ' +
          'photon energy, so light beyond λ₀ produces nothing however bright it is.' },
      { source: 'JEE Advanced pattern · de Broglie',
        q: 'Photoelectrons emerge from a metal with a maximum kinetic energy of 0.350 eV. Find the de Broglie wavelength of the fastest of them, in nanometres.',
        params: { metal: 'na', lam: 400, intensity: 1 },
        predict: { label: 'de Broglie wavelength', unit: 'nm', tol: 0.04 },
        measure: S => S.lamDB,
        working: 'λ = h/p with p = √(2mKE). KE = 0.350 × 1.602×10⁻¹⁹ = 5.61×10⁻²⁰ J, so ' +
          'p = √(2 × 9.11×10⁻³¹ × 5.61×10⁻²⁰) = 3.20×10⁻²⁵ kg·m/s and λ = 6.626×10⁻³⁴/3.20×10⁻²⁵ = ' +
          '<b>2.07 nm</b>. The shortcut λ(nm) = 1.226/√(V) with V in volts gives the same answer ' +
          'and is far quicker under exam conditions.' }
    ],

    quiz: [
      { q: 'The intensity of light falling on a photosensitive metal is doubled, the frequency unchanged. Which quantity doubles?',
        options: ['the maximum kinetic energy of the photoelectrons', 'the stopping potential',
                  'the saturation photocurrent', 'the threshold frequency'], answer: 2,
        why: 'Intensity controls the number of photons per second and therefore the number of electrons per second — the saturation current. KE_max, V₀ and ν₀ all depend on frequency and the metal, never on brightness.' },
      { q: 'The work function of a metal is 2.5 eV. Light of wavelength 400 nm is incident on it. The stopping potential is approximately:',
        options: ['0.60 V', '1.60 V', '3.10 V', 'no emission occurs'], answer: 0,
        why: 'hν = 1239.84/400 = 3.10 eV, so KE_max = 3.10 − 2.50 = 0.60 eV and V₀ = 0.60 V. Using hc = 1240 eV·nm turns this into mental arithmetic.' },
      { q: 'A graph of stopping potential against frequency is plotted for two different metals. The two lines are:',
        options: ['parallel, with different intercepts', 'of different slopes through the origin',
                  'identical', 'perpendicular'], answer: 0,
        why: 'V₀ = (h/e)ν − φ/e. The slope h/e is a universal constant so the lines are parallel; only the intercept −φ/e, and hence the threshold frequency, differs between metals.' },
      { q: 'An electron and a photon have the same wavelength. Which has the greater momentum?',
        options: ['the photon', 'the electron', 'they are equal', 'it depends on the wavelength'], answer: 2,
        why: 'p = h/λ holds for both, so equal wavelength means equal momentum. Their energies are wildly different — E = pc for the photon but E = p²/2m for the electron — which is the distinction the question is really probing.' }
    ],

    notes: '<b>Where this shows up in the paper.</b>' +
      '<ul><li>KE_max = hc/λ − φ numericals, almost always with hc = 1240 eV·nm.</li>' +
      '<li>Slope of the V₀–ν graph is h/e; intercept on the ν axis is ν₀ = φ/h.</li>' +
      '<li>What intensity changes and what it does not — asked in some form every year.</li>' +
      '<li>de Broglie wavelength of the emitted electron, λ = h/√(2mKE), often as a follow-on part.</li></ul>' +
      '<div class="pyq"><em>Trap to avoid</em>The stopping potential depends on the <b>frequency and the ' +
      'metal</b> and on nothing else. Changing the <b>distance</b> of the lamp, or its power, changes only the ' +
      'current. And KE_max is a <b>maximum</b>, not the energy every electron has — which is why the I–V curve ' +
      'approaches cut-off gradually instead of dropping off a cliff.</div>'
  });

})(window.InsightLab);
