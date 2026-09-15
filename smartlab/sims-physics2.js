/* ============================================================
   PHYSICS (depth) — 7. Cyclotron accelerator
                     8. Diffraction & resolving power
   ============================================================ */
(function (L) {
  'use strict';
  const { clamp, TAU, fmt, E } = L;
  const Camera = L.Camera;
  const PA = window.PHYSART, R3 = window.R3, RX = window.RX;

  const QE = 1.602176634e-19, MP = 1.67262192e-27, ME = 9.1093837e-31;
  const SPEC = {
    p:     { q: QE,     m: MP,          sym: 'p⁺',  name: 'Proton' },
    d:     { q: QE,     m: 2.0136 * MP, sym: 'd⁺',  name: 'Deuteron' },
    alpha: { q: 2 * QE, m: 4.0015 * MP, sym: 'α²⁺', name: 'Alpha' },
    e:     { q: -QE,    m: ME,          sym: 'e⁻',  name: 'Electron' }
  };

  /* =========================================================================
     7 · CYCLOTRON — the real device, integrated step by step
     E exists only in the dee gap and oscillates at the RF frequency, so
     the resonance condition is something you can break with a slider.
     ========================================================================= */
  L.register({
    id: 'cyclotron', subject: 'physics',
    name: 'The Cyclotron — Resonance and Maximum Energy',
    chapter: 'Moving Charges & Magnetism',
    exams: ['JEE Main', 'JEE Advanced', 'NEET UG'],
    weight: 'Very high yield',
    is3D: true,
    stageHint: 'Drag to orbit the machine · E exists only in the gap · detune the RF and watch the gain die',
    lede: 'A cyclotron is two hollow D-shaped electrodes in a magnetic field, with an alternating voltage ' +
      'across the gap between them. The trick that makes it work is that the <b>time for one semicircle does not ' +
      'depend on speed</b> — so a fixed RF frequency stays in step with the particle forever. ' +
      'This lab integrates the real motion: E acts only inside the gap, and you can <b>break the resonance ' +
      'condition</b> and watch the energy gain die.',

    params: { species: 'p', B: 0.5, V: 50, R: 0.50, detune: 1.0, gap: 2.0, trail: true },

    presets: [
      { name: 'Proton · 0.5 T · 50 kV', params: { species: 'p', B: 0.5, V: 50, R: 0.5, detune: 1 } },
      { name: 'Double the voltage', params: { species: 'p', B: 0.5, V: 100, R: 0.5, detune: 1 } },
      { name: 'Double the field', params: { species: 'p', B: 1.0, V: 50, R: 0.5, detune: 1 } },
      { name: 'Deuteron', params: { species: 'd', B: 0.5, V: 50, R: 0.5, detune: 1 } },
      { name: 'RF detuned 6%', params: { species: 'p', B: 0.5, V: 50, R: 0.5, detune: 1.06 } }
    ],

    controls: [
      { group: 'Machine', items: [
        { key: 'species', type: 'select', label: 'Particle', restructure: true, options: [
          { value: 'p', label: 'p⁺' }, { value: 'd', label: 'd⁺' },
          { value: 'alpha', label: 'α²⁺' }, { value: 'e', label: 'e⁻' }] },
        { key: 'B', label: 'Magnetic field <i>B</i>', min: 0.1, max: 2.0, step: 0.02, unit: 'T',
          fmt: v => v.toFixed(2), restructure: true },
        { key: 'R', label: 'Dee radius <i>R</i>', min: 0.15, max: 1.2, step: 0.01, unit: 'm',
          fmt: v => v.toFixed(2), restructure: true },
        { key: 'V', label: 'Gap voltage <i>V</i>', min: 5, max: 200, step: 1, unit: 'kV',
          fmt: v => v.toFixed(0), restructure: true },
        { key: 'gap', label: 'Gap width', min: 0.5, max: 6, step: 0.1, unit: 'cm', fmt: v => v.toFixed(1),
          restructure: true }
      ] },
      { group: 'Radio-frequency supply', items: [
        { key: 'detune', label: 'RF frequency  <i>f</i>/<i>f</i><sub>c</sub>', min: 0.90, max: 1.10,
          step: 0.002, unit: '×', fmt: v => v.toFixed(3), restructure: true }
      ] },
      { group: 'Display', items: [
        { key: 'trail', type: 'toggle', label: 'Show spiral trail' }
      ] }
    ],

    setup(S) {
      const p = S.p, sp = SPEC[p.species];
      S.sp = sp; S.q = sp.q; S.m = sp.m;
      S.wc = Math.abs(sp.q) * p.B / sp.m;              // cyclotron angular frequency
      S.fc = S.wc / TAU;
      S.wrf = S.wc * p.detune;
      S.Tc = TAU / S.wc;
      S.d = p.gap / 100;                                // gap width in metres
      S.KEmax = Math.pow(sp.q * p.B * p.R, 2) / (2 * sp.m) / QE / 1e6;   // MeV, ideal
      S.turnsIdeal = S.KEmax * 1e6 / (2 * (p.V * 1e3));

      if (!S.cam) {
        S.cam = Camera({ theta: -1.15, phi: 0.62, dist: 3.5, target: [0, 0, 0] });
        S.cam.minDist = 1.2; S.cam.maxDist = 14;
      }
      S.pos = [0, 0.004];
      S.vel = [0, 0];
      S.tp = 0; S.turns = 0; S.crossings = 0; S.KE = 0; S.r = 0;
      S.trail = []; S.ke = []; S.radii = [];
      S.exited = false; S.hold = 0; S.finalKE = 0; S.lastSign = 1;
    },

    step(S, dt) {
      const p = S.p;
      if (S.exited) {
        S.hold += dt;
        if (S.hold > 1.6) this.setup(S);
        return;
      }
      // wall-clock -> machine time: aim for the whole run to take ~8 s
      const target = Math.max(S.turnsIdeal, 1) * S.Tc / 8;
      let want = dt * target;
      const hMax = S.Tc / 300;
      let n = clamp(Math.ceil(want / hMax), 1, 900);
      const h = want / n;
      const qm = S.q / S.m, Ez = p.V * 1e3 / S.d;

      for (let i = 0; i < n; i++) {
        // Boris pusher in 2D (B along z), E only inside the gap and only along x
        const inGap = Math.abs(S.pos[0]) < S.d / 2;
        const Ex = inGap ? Ez * Math.cos(S.wrf * S.tp) : 0;
        const f = qm * h / 2;
        let vx = S.vel[0] + f * Ex, vy = S.vel[1];
        const tz = (S.q * p.B / S.m) * h / 2, s = 2 * tz / (1 + tz * tz);
        const px = vx + vy * tz, py = vy - vx * tz;
        vx = vx + py * s; vy = vy - px * s;
        vx += f * Ex;
        S.vel[0] = vx; S.vel[1] = vy;
        const oldSign = Math.sign(S.pos[0]) || 1;
        S.pos[0] += vx * h; S.pos[1] += vy * h;
        const newSign = Math.sign(S.pos[0]) || 1;
        if (newSign !== oldSign) { S.crossings++; S.turns = S.crossings / 2; }
        S.tp += h;

        const r = Math.hypot(S.pos[0], S.pos[1]);
        if (p.trail && i % Math.max(1, Math.floor(n / 14)) === 0) S.trail.push([S.pos[0], S.pos[1]]);
        if (r > p.R) {
          S.exited = true;
          S.finalKE = 0.5 * S.m * (vx * vx + vy * vy) / QE / 1e6;
          break;
        }
      }

      const v2 = S.vel[0] * S.vel[0] + S.vel[1] * S.vel[1];
      S.KE = 0.5 * S.m * v2 / QE / 1e6;
      S.r = Math.hypot(S.pos[0], S.pos[1]);
      while (S.trail.length > 14000) S.trail.shift();
      S.ke.push([S.turns, S.KE]);
      if (S.ke.length > 4000) S.ke.shift();
      const tn = Math.floor(S.turns);
      if (!S.radii.length || S.radii[S.radii.length - 1][0] < tn) S.radii.push([tn, S.r]);
    },

    drawStage(S, g) {
      const ctx = g.ctx, th = g.theme, p = S.p, W = g.w, H = g.h;
      const cam = S.cam;
      const F = R3.Frame(ctx, cam, { ambient: 0.30, floorZ: null });
      const ACC = th.phys, NORTH = '#FF5E6C', SOUTH = '#4D8CF5';
      const k = 1 / p.R;                              // display units per metre
      const dz = 0.09;                                // dee half-thickness
      const half = Math.max(S.d * k / 2, 0.012);      // half the gap, display units
      const polarity = Math.cos(S.wrf * S.tp);

      /* ---------------- the magnet ----------------
         The pole faces are what make the field; the upper one is drawn as an
         outline because a solid disc would sit between the camera and the
         beam it is there to bend. */
      /* Screen-space helpers. A 3D callout with a fixed offset reads well
         from one camera and collides from another, so anything that carries
         words asks the projection which way is "away" before it draws. */
      const O = cam.project([0, 0, 0]);
      const away = (pt) => {
        const q = cam.project(pt);
        return (q.ok && O.ok && q.x < O.x) ? -1 : 1;
      };
      const lowest = (rr, zz) => {
        let best = null;
        for (let i = 0; i < 48; i++) {
          const a = i / 48 * TAU;
          const q = cam.project([Math.cos(a) * rr, Math.sin(a) * rr, zz]);
          if (q.ok && (!best || q.y > best.y)) best = q;
        }
        return best;
      };
      const highest = (rr, zz) => {
        let best = null;
        for (let i = 0; i < 48; i++) {
          const a = i / 48 * TAU;
          const q = cam.project([Math.cos(a) * rr, Math.sin(a) * rr, zz]);
          if (q.ok && (!best || q.y < best.y)) best = q;
        }
        return best;
      };
      const POLE_Z = 0.30, POLE_R = 1.18;
      S._poleTags = [];

      [[1, NORTH, 'N'], [-1, SOUTH, 'S']].forEach(([sg, col, tag]) => {
        const zz = sg * POLE_Z, rr = POLE_R;
        const ring = (z, c, al, w) => {
          const pts = [];
          for (let i = 0; i <= 64; i++) {
            const a = i / 64 * TAU;
            pts.push([Math.cos(a) * rr, Math.sin(a) * rr, z]);
          }
          R3.polyline(F, pts, c, { alpha: al, width: w, bias: F.GROUND });
        };
        /* The solid pole is always the FAR one. Orbit under the machine and
           the roles swap, otherwise the plate you are looking through hides
           the beam it exists to bend. */
        const farSide = Math.sin(cam.phi) >= 0 ? -1 : 1;
        if (sg === farSide) {
          // the far pole is the bench the machine stands on: a dark steel
          // plate, not a slab of colour that would swamp the dees
          R3.cylinder(F, [0, 0, zz], [0, 0, zz - sg * 0.08], rr, '#26334C',
                      { segments: 48, shadow: false, ambient: 0.16, bias: F.GROUND });
          ring(zz, col, 0.55, 1.6);
        } else {
          ring(zz, col, 0.5, 1.8);
        }
        // the yoke: short posts joining the two poles round the outside
        for (let i = 0; i < 12; i++) {
          const a = i / 12 * TAU;
          R3.polyline(F, [[Math.cos(a) * rr, Math.sin(a) * rr, zz],
                          [Math.cos(a) * rr, Math.sin(a) * rr, zz - sg * 0.11]],
                      col, { alpha: 0.28, width: 1.2, bias: F.GROUND });
        }
        // B runs pole to pole, straight down through the dees
        if (sg > 0) {
          for (let i = 0; i < 6; i++) {
            const a = (i / 6 + 0.08) * TAU, rad = 1.06;
            R3.arrow(F, [Math.cos(a) * rad, Math.sin(a) * rad, POLE_Z - 0.02],
                        [Math.cos(a) * rad, Math.sin(a) * rad, -POLE_Z + 0.02],
                     0.005, RX.mix(SOUTH, '#8FB6FF', 0.45),
                     { head: 0.030, shadow: false, ambient: 0.9, bias: F.GROUND });
          }
        }
        // the label goes to whichever edge of this pole's ring is furthest
        // from the other one on screen, so N never lands under S
        S._poleTags.push({ sg: sg, col: col,
          text: tag + ' pole  ·  B = ' + p.B.toFixed(2) + ' T' });
      });

      /* ---------------- the two dees ----------------
         Each is a D-shaped box: a flat face top and bottom and a wall round
         the arc. They carry F.GROUND so the beam inside them stays visible —
         a single depth key cannot sort a big flat lid against a small
         particle underneath it. */
      [-1, 1].forEach(sgn => {
        const live = polarity * sgn;
        const col = live > 0 ? '#3A6FA8' : '#A8553A';
        const shade = 0.30 + 0.30 * Math.abs(live);
        const outline = [];
        const a0 = sgn > 0 ? -Math.PI / 2 : Math.PI / 2;
        for (let i = 0; i <= 44; i++) {
          const a = a0 + (i / 44) * Math.PI;
          outline.push([Math.cos(a) * 1.0 + sgn * half, Math.sin(a) * 1.0, 0]);
        }
        // close the D along the gap edge
        outline.push([sgn * half, -Math.sin(a0) * 1.0, 0]);

        [-1, 1].forEach(zs => {
          F.push([sgn * 0.5, 0, zs * dz], () => {
            const q = outline.map(o => cam.project([o[0], o[1], zs * dz]));
            if (q.some(x => !x.ok)) return;
            ctx.fillStyle = F.shade(col, [0, 0, zs], { ambient: shade });
            ctx.beginPath();
            q.forEach((x, i2) => i2 ? ctx.lineTo(x.x, x.y) : ctx.moveTo(x.x, x.y));
            ctx.closePath(); ctx.fill();
            ctx.strokeStyle = g.alpha('#9FB4DE', .45); ctx.lineWidth = 1.2; ctx.stroke();
          }, F.GROUND);
        });
        // the curved outer wall
        F.push([sgn * 0.9, 0, 0], () => {
          for (let i = 0; i < outline.length - 1; i++) {
            const a = outline[i], b = outline[i + 1];
            const q = [cam.project([a[0], a[1], dz]), cam.project([b[0], b[1], dz]),
                       cam.project([b[0], b[1], -dz]), cam.project([a[0], a[1], -dz])];
            if (q.some(x => !x.ok)) continue;
            const nx = a[0] - sgn * half, ny = a[1];
            const nl = Math.hypot(nx, ny) || 1;
            ctx.fillStyle = F.shade(col, [nx / nl, ny / nl, 0], { ambient: shade * 0.9 });
            ctx.beginPath();
            q.forEach((x, i2) => i2 ? ctx.lineTo(x.x, x.y) : ctx.moveTo(x.x, x.y));
            ctx.closePath(); ctx.fill();
          }
        }, F.GROUND);
        R3.label(F, [sgn * 0.62, 0, dz * 1.4], live > 0 ? '+' : '−',
                 live > 0 ? '#9FC8F0' : '#F0B49F', { size: 17, bias: F.GROUND });
      });

      /* ---------------- the accelerating gap ----------------
         E exists ONLY here, and only while the RF is on the right half of its
         cycle — which is the whole trick of the machine. */
      {
        const gl = Math.abs(polarity);
        F.push([0, 0, 0], () => {
          const q = [cam.project([-half, -1, dz]), cam.project([half, -1, dz]),
                     cam.project([half, 1, dz]), cam.project([-half, 1, dz])];
          if (q.some(x => !x.ok)) return;
          ctx.save(); ctx.globalCompositeOperation = 'lighter';
          ctx.fillStyle = g.alpha(th.warn, .06 + .20 * gl);
          ctx.beginPath();
          q.forEach((x, i) => i ? ctx.lineTo(x.x, x.y) : ctx.moveTo(x.x, x.y));
          ctx.closePath(); ctx.fill(); ctx.restore();
        }, 0);
        // the field direction in the gap, reversing with the RF
        for (let i = -2; i <= 2; i++) {
          if (gl < 0.12) break;
          const yy = i * 0.34;
          R3.arrow(F, [-half * Math.sign(polarity || 1) * 3, yy, 0],
                      [half * Math.sign(polarity || 1) * 3, yy, 0],
                   0.010, th.warn, { head: 0.045, shadow: false, ambient: 0.7,
                                     bias: F.GROUND * 0.5 });
        }
        const ge = [[0, -1.04, 0], [0, 1.04, 0]].map(v => ({ v: v, q: cam.project(v) }))
                     .filter(o => o.q.ok).sort((a, b) => b.q.y - a.q.y)[0];
        if (ge) R3.callout(F, ge.v, away(ge.v) * 34, 26,
                           'gap ' + p.gap.toFixed(1) + ' cm · E only here', th.warn);
      }

      /* ---------------- the source, the spiral and the beam ---------------- */
      R3.sphere(F, [0, 0, 0], 0.024, '#C9D4EA', { shadow: false, rim: 0.6, bias: F.GROUND });
      R3.callout(F, [0, 0, -0.02], away([-0.6, 0, 0]) * 104, 34, 'ion source', th['text-3']);

      if (p.trail && S.trail.length > 1) {
        R3.polyline(F, S.trail.map(t => [t[0] * k, t[1] * k, 0]), ACC,
                    { alpha: 0.75, width: 1.6 });
      }
      const at = [S.pos[0] * k, S.pos[1] * k, 0];
      const pr = cam.project(at);
      if (pr.ok) {
        F.push(at, () => {
          ctx.save(); ctx.globalCompositeOperation = 'lighter';
          const gg = ctx.createRadialGradient(pr.x, pr.y, 0, pr.x, pr.y, 16);
          gg.addColorStop(0, g.alpha(ACC, .95)); gg.addColorStop(1, g.alpha(ACC, 0));
          ctx.fillStyle = gg;
          ctx.beginPath(); ctx.arc(pr.x, pr.y, 16, 0, TAU); ctx.fill();
          ctx.restore();
        }, -1);
      }
      R3.sphere(F, at, 0.028, '#FFFFFF', { shadow: false, rim: 0.9 });

      /* ---------------- the extraction line ---------------- */
      {
        const ex = 1.0, ey = 0;
        R3.box(F, [1.14, -0.30, 0], [0.05, 0.30, 0.16], '#8FA3C0',
               { shadow: false, ambient: 0.45, bias: F.GROUND });
        R3.callout(F, [1.14, -0.30, 0], away([1.14, -0.30, 0]) * 26, 14, 'deflector', th['text-3']);
        R3.polyline(F, [[1.0, -0.08, 0], [1.60, -0.30, 0]], th.ok,
                    { alpha: S.exited ? 0.95 : 0.22, width: S.exited ? 2.6 : 1.4,
                      bias: F.GROUND });
        R3.callout(F, [1.60, -0.30, 0], away([1.60, -0.30, 0]) * 18, -22,
                   S.exited ? 'extracted at ' + S.finalKE.toFixed(2) + ' MeV'
                            : 'extraction at r = R',
                   S.exited ? th.ok : th['text-3']);
      }

      F.render();

      /* the pole labels, placed by screen position so N is always the one
         at the top of the picture whichever way the machine is turned */
      (S._poleTags || []).forEach(t => {
        const q = t.sg > 0 ? highest(POLE_R, POLE_Z) : lowest(POLE_R, -POLE_Z);
        if (!q) return;
        const dy = t.sg > 0 ? -16 : 18;
        ctx.save();
        ctx.strokeStyle = g.alpha(t.col, .45); ctx.lineWidth = 1;
        ctx.beginPath(); ctx.moveTo(q.x, q.y); ctx.lineTo(q.x, q.y + dy); ctx.stroke();
        ctx.restore();
        PA.lbl(ctx, q.x, q.y + dy + (t.sg > 0 ? -4 : 9), t.text, t.col, 'center', 9);
      });

      /* the dee radius is the machine's defining dimension — offer its rim
         as a grab point so the student sizes the machine by hand */
      {
        const rp = cam.project([1.0 + half, 0, 0]);
        if (rp.ok) {
          const on = g.dragging === 'rim';
          ctx.save();
          ctx.strokeStyle = g.alpha(on ? th.text : ACC, on ? .95 : .6);
          ctx.lineWidth = on ? 2.2 : 1.6;
          ctx.beginPath(); ctx.arc(rp.x, rp.y, 7, 0, TAU); ctx.stroke();
          ctx.beginPath(); ctx.moveTo(rp.x - 11, rp.y); ctx.lineTo(rp.x - 16, rp.y);
          ctx.moveTo(rp.x + 11, rp.y); ctx.lineTo(rp.x + 16, rp.y); ctx.stroke();
          ctx.restore();
          const sd = (O.ok && rp.x < O.x) ? -1 : 1;
          PA.lbl(ctx, rp.x + sd * 22, rp.y + 18,
                 'dee radius R = ' + (p.R * 100).toFixed(0) + ' cm · drag',
                 on ? th.text : g.alpha(th['text-3'], .9), sd > 0 ? 'left' : 'right', 9);
          g.handle(rp.x, rp.y, 16, 'rim');
        }
      }

      /* ---------------- the RF supply, drawn as an instrument ---------------- */
      {
        const bw = Math.min(W * 0.30, 262), bh = 74;
        const bx0 = W - bw - 14, by0 = H - bh - 30;
        ctx.fillStyle = g.alpha('#0B1020', .88);
        ctx.strokeStyle = g.alpha(th.line, 1); ctx.lineWidth = 1;
        ctx.beginPath(); ctx.roundRect(bx0, by0, bw, bh, 8); ctx.fill(); ctx.stroke();
        PA.lbl(ctx, bx0 + 10, by0 + 13, 'RADIO-FREQUENCY SUPPLY', th['text-3'], 'left', 8.5);
        const px0 = bx0 + 12, px1 = bx0 + bw - 12, pym = by0 + 44;
        ctx.strokeStyle = g.alpha(th['text-3'], .45); ctx.lineWidth = 1;
        ctx.beginPath(); ctx.moveTo(px0, pym); ctx.lineTo(px1, pym); ctx.stroke();
        ctx.strokeStyle = th.warn; ctx.lineWidth = 1.8;
        ctx.beginPath();
        for (let i = 0; i <= 90; i++) {
          const t = i / 90;
          const x = px0 + (px1 - px0) * t;
          const y = pym - Math.cos(S.wrf * S.tp - (1 - t) * 5.2) * 17;
          i ? ctx.lineTo(x, y) : ctx.moveTo(x, y);
        }
        ctx.stroke();
        ctx.fillStyle = th.warn;
        ctx.beginPath(); ctx.arc(px1, pym - polarity * 17, 3.4, 0, TAU); ctx.fill();
        PA.lbl(ctx, bx0 + 10, by0 + bh - 8,
               'f = ' + fmt(S.wrf / TAU, 4) + ' Hz   ·   ' +
               (Math.abs(p.detune - 1) < 0.004 ? 'locked to f_c' : 'detuned ' +
                ((p.detune - 1) * 100).toFixed(1) + '%'),
               Math.abs(p.detune - 1) < 0.004 ? th.ok : th.crit, 'left', 9);
      }

      /* ---------------- header ---------------- */
      ctx.textAlign = 'left'; ctx.textBaseline = 'top';
      ctx.font = '700 19px "IBM Plex Sans Condensed",sans-serif';
      ctx.fillStyle = S.exited ? th.ok : th.text;
      ctx.fillText(S.exited ? 'EXTRACTED at ' + S.finalKE.toFixed(2) + ' MeV'
                            : 'ACCELERATING — turn ' + S.turns.toFixed(1), 14, 8);
      ctx.font = '500 10px "IBM Plex Mono",monospace'; ctx.fillStyle = th['text-3'];
      ctx.fillText('KE = ' + S.KE.toFixed(3) + ' MeV   ·   r = ' + (S.r * 100).toFixed(1) +
        ' cm of ' + (p.R * 100).toFixed(0) + ' cm   ·   f_c = ' + fmt(S.fc, 4) + ' Hz', 14, 31);
      const res = Math.abs(p.detune - 1) < 0.004;
      ctx.fillStyle = res ? th.ok : th.crit;
      ctx.fillText(res
        ? 'RF locked to qB/2πm — every gap crossing adds energy'
        : 'RF detuned: the phase error accumulates and the gain will die', 14, 45);
    },

    /* the dee radius is the machine's defining dimension — drag its rim */
    onDrag(S, e) {
      if (e.id !== 'rim' || !S.cam) return;
      const perPx = S.cam.dist / Math.max(S.cam._k, 1);
      S.p.R = clamp(S.p.R + e.dx * perPx * S.p.R, 0.15, 1.2);
      this.setup(S);
    },
    plots: [
      { title: 'Energy gained per gap crossing',
        legend: [{ c: '#3DD6F5', label: 'kinetic energy (MeV)' }, { c: '#63729A', label: 'ideal ceiling' }],
        draw(S, g) {
          const P = g.Plot({
            xmin: 0, xmax: Math.max(S.turnsIdeal * 1.1, 6), ymin: 0, ymax: Math.max(S.KEmax * 1.15, 0.1),
            xlabel: 'revolutions', ylabel: 'KE (MeV)',
            xfmt: v => v.toFixed(0), yfmt: v => v.toFixed(1)
          }).frame();
          P.clip(() => {
            P.hline(S.KEmax, g.alpha(g.theme['text-3'], .95), [4, 3]);
            P.area(S.ke, 0, g.alpha(g.theme.phys, .13));
            P.line(S.ke, g.theme.phys, 2);
            if (S.ke.length) P.dot(S.turns, S.KE, 4, g.theme.text, g.theme['ink-950']);
          });
          P.tag(0, S.KEmax, 'KE_max = q²B²R²/2m = ' + S.KEmax.toFixed(2) + ' MeV', g.theme['text-2'], 'left', -9);
        },
        hover(S, x) {
          const n = Math.max(0, Math.round(x));
          return [{ label: 'revolution', value: String(n) },
                  { label: 'ideal KE', value: (2 * n * S.p.V / 1000).toFixed(2) + ' MeV', color: '#3DD6F5' },
                  { label: 'ideal r', value: (100 * Math.sqrt(2 * S.m * 2 * n * S.p.V * 1e3 * QE) /
                     (Math.abs(S.q) * S.p.B)).toFixed(1) + ' cm' }];
        } },
      { title: 'Orbit radius grows as √n — the turns crowd together',
        legend: [{ c: '#3DD6F5', label: 'measured radius' }, { c: '#63729A', label: 'r ∝ √n' }],
        draw(S, g) {
          const nMax = Math.max(S.turnsIdeal, 6);
          const ideal = [];
          for (let i = 0; i <= 120; i++) {
            const n = i / 120 * nMax;
            const ke = 2 * n * S.p.V * 1e3 * QE;
            ideal.push([n, 100 * Math.sqrt(2 * S.m * ke) / (Math.abs(S.q) * S.p.B)]);
          }
          const P = g.Plot({
            xmin: 0, xmax: nMax * 1.1, ymin: 0, ymax: S.p.R * 115,
            xlabel: 'revolutions', ylabel: 'radius (cm)',
            xfmt: v => v.toFixed(0), yfmt: v => v.toFixed(0)
          }).frame();
          P.clip(() => {
            P.hline(S.p.R * 100, g.alpha(g.theme['text-3'], .7), [2, 4]);
            P.line(ideal, g.alpha(g.theme['text-3'], .95), 1.5, [4, 3]);
            P.line(S.radii.map(r => [r[0], r[1] * 100]), g.theme.phys, 2);
          });
          P.tag(0, S.p.R * 100, 'dee radius', g.theme['text-3'], 'left', -8);
        } }
    ],

    readouts(S) {
      const p = S.p;
      const res = Math.abs(p.detune - 1) < 0.004;
      return [
        { label: 'Cyclotron freq f_c = qB/2πm', value: fmt(S.fc, 4), unit: 'Hz', flag: 'accent' },
        { label: 'RF frequency applied', value: fmt(S.wrf / TAU, 4), unit: 'Hz',
          flag: res ? 'ok' : 'crit', hint: res ? 'in resonance' : 'particle falls out of step' },
        { label: 'Max energy q²B²R²/2m', value: S.KEmax.toFixed(2), unit: 'MeV', flag: 'accent',
          hint: 'independent of V' },
        { label: 'Current KE', value: S.KE.toFixed(2), unit: 'MeV' },
        { label: 'Revolutions needed', value: S.turnsIdeal.toFixed(0), unit: '',
          hint: 'KE_max / 2qV' },
        { label: 'Period T = 2πm/qB', value: fmt(S.Tc, 3), unit: 's', hint: 'same at every radius' },
        { label: 'Exit speed', value: fmt(Math.sqrt(2 * S.KEmax * 1e6 * QE / S.m), 3), unit: 'm/s' },
        { label: 'v/c at exit', value: (Math.sqrt(2 * S.KEmax * 1e6 * QE / S.m) / 3e8).toFixed(3), unit: '',
          flag: Math.sqrt(2 * S.KEmax * 1e6 * QE / S.m) / 3e8 > 0.15 ? 'warn' : '',
          hint: Math.sqrt(2 * S.KEmax * 1e6 * QE / S.m) / 3e8 > 0.15 ? 'relativity would matter here' : 'non-relativistic' }
      ];
    },

    equation(S) {
      const p = S.p;
      return E.v('f') + E.sub('c') + ' ' + E.op('=') + ' ' + E.frac(E.v('qB'), '2π' + E.v('m')) +
        ' ' + E.op('=') + ' ' + E.n(S.fc, 'Hz') + E.op('·') + ' independent of ' + E.v('v') + ' and ' + E.v('r') +
        '<br>KE' + E.sub('max') + ' ' + E.op('=') + ' ' +
        E.frac(E.v('q') + '<sup>2</sup>' + E.v('B') + '<sup>2</sup>' + E.v('R') + '<sup>2</sup>', '2' + E.v('m')) +
        ' ' + E.op('=') + ' ' + E.frac(
          E.n(Math.abs(S.q), 'C') + '<sup>2</sup>·' + E.n(p.B, 'T') + '<sup>2</sup>·' + E.n(p.R, 'm') + '<sup>2</sup>',
          '2·' + E.n(S.m, 'kg')) + ' ' + E.op('=') + ' ' + E.n(S.KEmax.toFixed(2), 'MeV') +
        '<br>revolutions ' + E.op('=') + ' ' + E.frac('KE' + E.sub('max'), '2' + E.v('qV')) + ' ' + E.op('=') +
        ' ' + E.n(S.turnsIdeal.toFixed(0), '') + E.op('·') + ' each crossing adds ' + E.n(p.V, 'keV');
    },
    eqNote: '<b>Notice what is missing from KE<sub>max</sub>: the voltage.</b> Raising V does not raise the final ' +
      'energy at all — it just gets the particle there in fewer turns. Only B, R and the charge-to-mass ratio ' +
      'set the ceiling. This is the single most examined idea about the cyclotron.',

    problems: [
      { source: 'JEE Main pattern · the resonance condition',
        q: 'A cyclotron accelerates protons in a magnetic field of 0.500 T. At what frequency must the radio-frequency supply across the dees oscillate? Give the answer in MHz. (m_p = 1.673 × 10⁻²⁷ kg)',
        params: { species: 'p', B: 0.5, V: 50, R: 0.5, detune: 1 },
        predict: { label: 'RF frequency', unit: 'MHz', tol: 0.02 },
        measure: S => S.fc / 1e6,
        working: 'f_c = qB/2πm = (1.602×10⁻¹⁹ × 0.500)/(2π × 1.673×10⁻²⁷) = <b>7.62 MHz</b>. ' +
          'The dee radius, the gap voltage and the particle\'s current speed are all irrelevant — that is ' +
          'the whole content of the word <i>resonance</i> here. Slide the RF away from 1.000× and watch ' +
          'the energy curve flatten out and then fall.' },
      { source: 'JEE Main pattern · the energy ceiling',
        q: 'The same machine — B = 0.500 T, dee radius 0.500 m — is used to accelerate deuterons instead of protons. Find the maximum kinetic energy in MeV. (m_d = 2.014 m_p)',
        params: { species: 'd', B: 0.5, V: 50, R: 0.5, detune: 1 },
        predict: { label: 'KE_max', unit: 'MeV', tol: 0.03 },
        measure: S => S.KEmax,
        working: 'KE_max = q²B²R²/2m. The deuteron carries the same charge as a proton but is 2.014 times ' +
          'as heavy, so its ceiling is the proton\'s 2.99 MeV divided by 2.014 = <b>1.49 MeV</b>. ' +
          'The trap: many students double the mass and expect the energy to double because the particle is ' +
          '"bigger". Mass sits in the <i>denominator</i> — a heavier particle goes slower at the same radius, ' +
          'and KE = q²B²R²/2m falls.' },
      { source: 'JEE Advanced pattern · how many turns',
        q: 'Protons are accelerated in a cyclotron of dee radius 0.500 m at B = 0.500 T, with 100 kV across the gap. The particle crosses the gap twice per revolution. How many complete revolutions does it make before extraction?',
        params: { species: 'p', B: 0.5, V: 100, R: 0.5, detune: 1 },
        predict: { label: 'revolutions', unit: '', tol: 0.05 },
        measure: S => S.turnsIdeal,
        working: 'Each gap crossing adds qV = 100 keV, and there are two crossings per revolution, so each ' +
          'revolution adds 200 keV. n = KE_max/2qV = 2.99 MeV / 0.200 MeV = <b>15 revolutions</b>. ' +
          'Doubling V halves the number of turns but leaves KE_max untouched — the ceiling is set by ' +
          'B and R alone. Run it and count the loops in the spiral.' },
      { source: 'JEE Advanced pattern · alpha versus proton',
        q: 'An alpha particle (q = 2e, m = 4.00 m_p) replaces the proton in the same cyclotron. By what factor does the required RF frequency change?',
        params: { species: 'alpha', B: 0.5, V: 50, R: 0.5, detune: 1 },
        predict: { label: 'f_alpha / f_proton', unit: '×', tol: 0.03 },
        measure: S => (2 / 4.0015),
        working: 'f = qB/2πm depends only on q/m. For the alpha, q/m = 2e/4m_p = half the proton\'s, ' +
          'so f_α = <b>0.50 f_p</b> — about 3.81 MHz. The deuteron and the alpha, by contrast, share ' +
          'the same q/m to within a fraction of a percent, so <i>one machine tuned for deuterons will ' +
          'accelerate alphas with no retuning at all</i>. That coincidence is examined more often than ' +
          'the formula itself.' }
    ],

    walkthrough: [
      { title: '1 · Why one fixed frequency works forever',
        body: 'Watch the particle spiral outwards. Each loop is bigger than the last, and the particle is moving faster — yet every semicircle takes exactly the same time.',
        ask: 'Radius and speed are both growing. How can the time per revolution stay constant?',
        reveal: 'Because <b>T = 2πm/qB</b> contains no v and no r. Going faster makes the circle bigger in exactly the same proportion, so the two effects cancel. That is the whole principle: a single fixed RF frequency stays in step from the first turn to the last.',
        params: { species: 'p', B: 0.5, V: 50, R: 0.5, detune: 1 } },
      { title: '2 · Double the voltage',
        body: 'Push the gap voltage from 50 kV to 100 kV and watch both the energy graph and the final extracted energy.',
        ask: 'Does the particle come out with more energy?',
        reveal: '<b>No — exactly the same energy, in half the turns.</b> KE_max = q²B²R²/2m has no V in it. The particle leaves when its radius reaches R, and that radius fixes the momentum regardless of how it got there. Higher V just means a shorter, steeper staircase on the graph.',
        params: { species: 'p', B: 0.5, V: 100, R: 0.5, detune: 1 } },
      { title: '3 · Double the field',
        body: 'Put the voltage back and instead take B from 0.5 T to 1.0 T.',
        ask: 'KE_max goes as B². What else changed?',
        reveal: 'The final energy <b>quadruples</b>, and the required RF frequency <b>doubles</b> (f_c = qB/2πm). A real machine cannot simply crank B up: the magnet gets enormous and expensive, which is why the practical limit on a cyclotron is the size of its pole pieces.',
        params: { species: 'p', B: 1.0, V: 50, R: 0.5, detune: 1 } },
      { title: '4 · Break the resonance',
        body: 'Now detune the RF supply by a few percent from f_c and watch the energy graph.',
        ask: 'Why does a small frequency error stop the acceleration completely?',
        reveal: 'The phase error <b>accumulates</b>. After enough turns the particle arrives at the gap while the field is pointing the wrong way and gets <b>decelerated</b>. The energy curve flattens and then oscillates. This is why the RF must be locked precisely to qB/2πm.',
        params: { species: 'p', B: 0.5, V: 50, R: 0.5, detune: 1.06 } },
      { title: '5 · Change the particle',
        body: 'Switch from a proton to a deuteron (same charge, twice the mass) and then to an alpha particle.',
        ask: 'Which quantity decides both the frequency and the final energy?',
        reveal: 'The <b>charge-to-mass ratio q/m</b>. The deuteron needs half the RF frequency and comes out with half the energy. The alpha has q/m equal to the deuteron, so it needs the same frequency — a real design convenience, and a favourite comparison question.',
        params: { species: 'd', B: 0.5, V: 50, R: 0.5, detune: 1 } }
    ],

    quiz: [
      { q: 'A cyclotron accelerates protons to 6 MeV. Keeping everything else fixed, the gap voltage is doubled. The new maximum energy is:',
        options: ['12 MeV', '6 MeV', '3 MeV', '24 MeV'], answer: 1,
        why: 'KE_max = q²B²R²/2m contains no V. Doubling the voltage halves the number of revolutions but leaves the exit energy untouched.' },
      { q: 'The time period of revolution inside a cyclotron dee:',
        options: ['increases as the particle speeds up', 'decreases as the radius grows',
                  'is the same for every orbit', 'depends on the gap voltage'], answer: 2,
        why: 'T = 2πm/qB is independent of both v and r — the isochronism that makes a fixed RF frequency possible.' },
      { q: 'A cyclotron cannot usefully accelerate electrons because:',
        options: ['electrons are negatively charged',
                  'electrons become relativistic almost immediately, so their period changes',
                  'electrons are too light to be deflected',
                  'the magnetic force on an electron is zero'], answer: 1,
        why: 'With such a small rest mass, an electron reaches a significant fraction of c after very few turns. Its relativistic mass rises, the period grows, and it falls out of step with the fixed RF.' }
    ],

    notes: '<b>Where this shows up in the paper.</b>' +
      '<ul><li>Direct KE_max = q²B²R²/2m numericals, and the ratio questions when B, R, q or m is scaled.</li>' +
      '<li>"What is the required RF frequency" — f = qB/2πm, straight substitution.</li>' +
      '<li>Number of revolutions = KE_max/2qV, which needs both formulae together.</li>' +
      '<li>Why cyclotrons fail for electrons, and why synchrocyclotrons exist.</li></ul>' +
      '<div class="pyq"><em>Trap to avoid</em>Each <b>revolution</b> crosses the gap <b>twice</b>, so the energy gain ' +
      'per revolution is <b>2qV</b>, not qV. Dropping that factor of 2 is the most common slip in this topic.</div>'
  });

  /* =========================================================================
     8 · DIFFRACTION & RESOLVING POWER — the Rayleigh criterion
     ========================================================================= */
  // Bessel J1, Abramowitz & Stegun 9.4.4 / 9.4.6
  function J1(x) {
    const ax = Math.abs(x);
    if (ax < 3) {
      const y = (x / 3) * (x / 3);
      return x * (0.5 + y * (-0.56249985 + y * (0.21093573 + y * (-0.03954289 +
        y * (0.00443319 + y * (-0.00031761 + y * 0.00001109))))));
    }
    const z = 3 / ax;
    const f = 0.79788456 + z * (0.00000156 + z * (0.01659667 + z * (0.00017105 +
      z * (-0.00249511 + z * (0.00113653 + z * -0.00020033)))));
    const t = ax - 2.35619449 + z * (0.12499612 + z * (0.00005650 + z * (-0.00637879 +
      z * (0.00074348 + z * (0.00079824 + z * -0.00029166)))));
    const r = f / Math.sqrt(ax) * Math.cos(t);
    return x < 0 ? -r : r;
  }

  // single-source point-spread function at angle th (radians)
  function psf(S, th) {
    const x = Math.PI * S.D * Math.sin(th) / S.lam;
    if (Math.abs(x) < 1e-7) return 1;
    if (S.p.ap === 'circ') { const j = 2 * J1(x) / x; return j * j; }
    const s = Math.sin(x) / x;
    return s * s;
  }


  /* Rayleigh's 0.735 is derived for two EQUAL sources. For an unequal pair the
     honest question is whether the combined profile has two maxima at all, and
     how deep the valley is measured against the WEAKER of them — a faint
     companion can sit entirely inside the bright source's skirt while the
     nominal separation is still a full theta_min. This measures that directly
     off the summed profile rather than assuming the textbook case. */
  function dipTest(S, sepRad, n) {
    const p = S.p;
    n = n || 320;
    const lo = -sepRad * 1.15, hi = sepRad * 1.15;
    let pm = 0, pv = -1, ppv = -1;
    const maxima = [], minima = [];
    for (let i = 0; i <= n; i++) {
      const th = lo + (hi - lo) * i / n;
      const v = psf(S, th - sepRad / 2) + p.contrast * psf(S, th + sepRad / 2);
      if (i >= 2) {
        if (pv > ppv && pv >= v) maxima.push([pm, pv]);
        if (pv < ppv && pv <= v) minima.push([pm, pv]);
      }
      ppv = pv; pv = v; pm = th;
    }
    if (maxima.length < 2 || !minima.length) return { two: false, dip: 1 };
    maxima.sort((a, b) => b[1] - a[1]);
    const m1 = maxima[0], m2 = maxima[1];
    const a = Math.min(m1[0], m2[0]), b = Math.max(m1[0], m2[0]);
    let valley = Infinity;
    minima.forEach(q => { if (q[0] > a && q[0] < b) valley = Math.min(valley, q[1]); });
    if (!isFinite(valley)) return { two: false, dip: 1 };
    const weaker = Math.min(m1[1], m2[1]);
    return { two: true, dip: valley / weaker, valley: valley, weaker: weaker };
  }

  /* The Airy image is a 2D field, so it is rendered once into an offscreen
     canvas and painted onto the focal plane as a texture. Recomputing it only
     when something it depends on changes keeps the frame budget for the 3D. */
  function airyImage(S) {
    const p = S.p;
    const key = [p.lam, p.ap, p.D, p.sep, p.contrast, p.mode, p.na, S.range].join('|');
    if (S._imgKey === key && S._img) return S._img;
    const W = 200, H = 140;
    const cv = S._img && S._img.width === W ? S._img : document.createElement('canvas');
    cv.width = W; cv.height = H;
    const ctx = cv.getContext('2d');
    const im = ctx.createImageData(W, H);
    const dat = im.data;
    const half = S.range;                       // radians across half the frame
    const asp = H / W;
    const rgb = wl2rgbLocal(p.lam);
    for (let py = 0; py < H; py++) {
      const v = (py / (H - 1) - 0.5) * 2 * half * asp;
      for (let px = 0; px < W; px++) {
        const u = (px / (W - 1) - 0.5) * 2 * half;
        // two sources, separated along u
        const r1 = Math.hypot(u - S.sepRad / 2, v);
        const r2 = Math.hypot(u + S.sepRad / 2, v);
        let I;
        if (p.ap === 'slit') {
          // a slit diffracts in one direction only — the image is a streak
          I = psf(S, u - S.sepRad / 2) + p.contrast * psf(S, u + S.sepRad / 2);
        } else {
          I = psf(S, r1) + p.contrast * psf(S, r2);
        }
        const t = Math.pow(Math.min(I / (1 + p.contrast), 1), 0.42);
        const k = (py * W + px) * 4;
        dat[k] = 255 * Math.min(1, rgb[0] * t * 1.25);
        dat[k + 1] = 255 * Math.min(1, rgb[1] * t * 1.25);
        dat[k + 2] = 255 * Math.min(1, rgb[2] * t * 1.25);
        dat[k + 3] = 255;
      }
    }
    ctx.putImageData(im, 0, 0);
    S._img = cv; S._imgKey = key;
    return cv;
  }

  function wl2rgbLocal(w) {
    let r, g, b;
    if (w < 440) { r = -(w - 440) / 60; g = 0; b = 1; }
    else if (w < 490) { r = 0; g = (w - 440) / 50; b = 1; }
    else if (w < 510) { r = 0; g = 1; b = -(w - 510) / 20; }
    else if (w < 580) { r = (w - 510) / 70; g = 1; b = 0; }
    else if (w < 645) { r = 1; g = -(w - 645) / 65; b = 0; }
    else { r = 1; g = 0; b = 0; }
    let f = 1;
    if (w < 420) f = 0.35 + 0.65 * (w - 380) / 40;
    else if (w > 700) f = 0.35 + 0.65 * (780 - w) / 80;
    return [Math.max(0, Math.pow(r * f, 0.85)), Math.max(0, Math.pow(g * f, 0.85)),
            Math.max(0, Math.pow(b * f, 0.85))];
  }

  /* Real instruments, so the abstract mrad lands on something the student has
     actually looked through. Each carries the aperture, the working
     wavelength and the distance the resolving limit is quoted at. */
  const INSTR = {
    custom: { name: 'Custom bench', D: 3.0, lam: 550, dist: 1e3, distLabel: '1 km' },
    eye:    { name: 'Human eye (pupil 3 mm)', D: 3.0, lam: 550, dist: 25e-2, distLabel: '25 cm' },
    scope:  { name: 'Amateur telescope (100 mm)', D: 100, lam: 550, dist: 3.84e8, distLabel: 'the Moon' },
    hubble: { name: 'Hubble (2.4 m)', D: 2400, lam: 550, dist: 3.84e8, distLabel: 'the Moon' },
    eyeblue:{ name: 'Eye in blue light (pupil 3 mm)', D: 3.0, lam: 450, dist: 25e-2, distLabel: '25 cm' }
  };

  L.register({
    id: 'resolving', subject: 'physics',
    name: 'Diffraction & Resolving Power — the Rayleigh Criterion',
    chapter: 'Wave Optics',
    exams: ['JEE Main', 'JEE Advanced', 'NEET UG'],
    weight: 'Very high yield',
    is3D: true,
    stageHint: 'Drag to walk round the bench · drag a source to change Δθ · drag the aperture rim to change D · the focal plane shows the real Airy image',
    lede: 'Every lens, every telescope and your own eye has a hard limit: light bends round the edge of the ' +
      'aperture, so a point source never forms a point. This bench forms the <b>real Airy image</b> of two ' +
      'point sources on a focal-plane screen — computed from the Bessel function J₁, not a Gaussian ' +
      'stand-in — and tells you whether the pair is <b>resolved</b>. The aperture runs from a 0.5 mm pinhole ' +
      'to Hubble\'s 2.4 m mirror, and you can put your own eye, a telescope or the microscope formula ' +
      '0.61λ/NA against the same picture.',

    params: { lam: 550, ap: 'circ', logD: 0.4771, sep: 0.30, contrast: 1.0, showBoth: true,
              instr: 'custom', na: 0.65, rings: true },

    presets: [
      { name: 'Just resolved (Rayleigh)', params: { lam: 550, ap: 'circ', logD: 0.4771, sep: 0.2237, showBoth: true, instr: 'custom', contrast: 1 } },
      { name: 'Clearly resolved', params: { lam: 550, ap: 'circ', logD: 0.4771, sep: 0.55, showBoth: true, instr: 'custom', contrast: 1 } },
      { name: 'Unresolved blur', params: { lam: 550, ap: 'circ', logD: 0.4771, sep: 0.10, showBoth: true, instr: 'custom', contrast: 1 } },
      { name: 'Bigger aperture', params: { lam: 550, ap: 'circ', logD: 0.9031, sep: 0.30, showBoth: true, instr: 'custom', contrast: 1 } },
      { name: 'Rectangular slit', params: { lam: 550, ap: 'slit', logD: 0.4771, sep: 0.30, showBoth: true, instr: 'custom', contrast: 1 } },
      { name: 'Blue light 450 nm', params: { lam: 450, ap: 'circ', logD: 0.4771, sep: 0.30, instr: 'custom', contrast: 1 } },
      { name: 'Your own eye', params: { instr: 'eye', ap: 'circ', sep: 0.30, contrast: 1, showBoth: true } },
      { name: 'Hubble', params: { instr: 'hubble', ap: 'circ', sep: 0.0004, contrast: 1, showBoth: true } },
      { name: 'Unequal pair', params: { lam: 550, ap: 'circ', logD: 0.4771, sep: 0.2237, contrast: 0.25, showBoth: true, instr: 'custom' } }
    ],

    controls: [
      { group: 'Instrument', items: [
        { key: 'instr', type: 'select', label: 'Preset instrument', restructure: true, options: [
          { value: 'custom', label: 'Custom bench' },
          { value: 'eye', label: 'Human eye · 3 mm' },
          { value: 'eyeblue', label: 'Eye in blue light' },
          { value: 'scope', label: 'Telescope · 100 mm' },
          { value: 'hubble', label: 'Hubble · 2.4 m' }] }
      ] },
      { group: 'Light', items: [
        { key: 'lam', label: 'Wavelength <i>λ</i>', min: 380, max: 720, step: 1, unit: 'nm', fmt: v => v.toFixed(0) }
      ] },
      { group: 'Aperture', items: [
        { key: 'ap', type: 'select', label: 'Aperture shape', options: [
          { value: 'circ', label: 'Circular' }, { value: 'slit', label: 'Slit' }] },
        { key: 'logD', label: 'Aperture size <i>D</i>', min: -0.30, max: 3.40, step: 0.005, unit: 'mm',
          fmt: v => { const d = Math.pow(10, v); return d < 10 ? d.toFixed(2) : d < 100 ? d.toFixed(1) : d.toFixed(0); } }
      ] },
      { group: 'The two sources', items: [
        { key: 'sep', label: 'Angular separation <i>Δθ</i>', min: 0.002, max: 1.2, step: 0.002,
          unit: 'mrad', fmt: v => v.toFixed(3) },
        { key: 'contrast', label: 'Brightness of source 2', min: 0.15, max: 1, step: 0.01, unit: '×',
          fmt: v => v.toFixed(2) }
      ] },
      { group: 'Microscope instead', items: [
        { key: 'na', label: 'Numerical aperture <i>NA</i>', min: 0.10, max: 1.45, step: 0.01, unit: '',
          fmt: v => v.toFixed(2) }
      ] },
      { group: 'Display', items: [
        { key: 'showBoth', type: 'toggle', label: 'Show the two patterns separately' },
        { key: 'rings', type: 'toggle', label: 'Mark the first dark ring' }
      ] }
    ],

    setup(S) {
      const p = S.p;
      // a preset instrument writes the aperture and the wavelength once; move
      // either slider afterwards and the bench quietly becomes "custom" again
      if (p.instr && p.instr !== 'custom') {
        const I = INSTR[p.instr];
        if (I) {
          if (S._instr !== p.instr) {
            p.logD = Math.log10(I.D); p.lam = I.lam; S._instr = p.instr;
          } else if (Math.abs(Math.pow(10, p.logD) - I.D) > I.D * 1e-4 || p.lam !== I.lam) {
            p.instr = 'custom'; S._instr = 'custom';
          }
        }
      } else S._instr = 'custom';
      S.instr = INSTR[p.instr] || INSTR.custom;

      S.lam = p.lam * 1e-9;
      S.Dmm = Math.pow(10, p.logD);
      S.D = S.Dmm * 1e-3;
      S.thMin = (p.ap === 'circ' ? 1.22 : 1.0) * S.lam / S.D;   // radians
      S.sepRad = p.sep * 1e-3;
      S.range = Math.max(3.2 * S.thMin, 1.9 * S.sepRad);
      S.ratio = S.sepRad / S.thMin;
      // the Sparrow limit: where the central dip first appears at all
      S.sparrow = 0.947 / 1.22 * S.thMin;
      // microscope: the smallest separation a lens of this NA can resolve
      S.dMicro = 0.61 * S.lam / Math.max(p.na, 0.01);
      if (!S.cam) {
        S.cam = Camera({ theta: -2.55, phi: 0.28, dist: 4.25, target: [0.05, 0, -0.02] });
        S.cam.minDist = 2.0; S.cam.maxDist = 14;
      }
    },

    step(S, dt) { S.ph = (S.ph || 0) + dt; },

    drawStage(S, g) {
      const ctx = g.ctx, th = g.theme, p = S.p, W = g.w, H = g.h;
      const cam = S.cam, F = R3.Frame(ctx, cam, { ambient: 0.26, floorZ: null });
      /* DEPTH POLICY. Only the rail, its posts and the optical axis carry
         F.GROUND — they are what the components stand on. The stop, the lens
         and the screen sort on their OWN depth, so the stop occludes the
         screen when it is genuinely in front of it and not otherwise.
         Decoration attached to a component (a source's glow, the markers
         drawn on the screen face) gets an offset of a few hundredths: enough
         to sit on its parent, never enough to jump a nearer component. */
      const rgb = wl2rgbLocal(p.lam);
      const pure = 'rgb(' + Math.round(255 * rgb[0]) + ',' + Math.round(255 * rgb[1]) + ',' +
        Math.round(255 * rgb[2]) + ')';

      const XSRC = -2.05, XAP = -0.62, XLENS = 0.30, XSCR = 1.66;
      const SW = 1.06, SH = SW * 140 / 200;                  // focal-plane half sizes
      const apR = clamp(0.09 + 0.29 * (p.logD + 0.30) / 3.70, 0.09, 0.38);
      // the sources are drawn at an exaggerated separation, because the real
      // one is microradians; the ratio to the limit is what matters and it is
      // what the drawn gap is proportional to
      const sepDraw = clamp(S.ratio, 0, 3.2) * 0.30 + 0.09;
      const O = cam.project([0.1, 0, 0]);
      const away = (pt) => { const q = cam.project(pt); return (q.ok && O.ok && q.x < O.x) ? -1 : 1; };

      /* ---------------- rail and mounts ---------------- */
      {
        // the bench carries the stop, the lens and the screen; the sources are
        // at infinity and belong nowhere near it
        const x0 = XAP - 0.35, x1 = XSCR + 0.26;
        R3.box(F, [(x0 + x1) / 2, 0, -0.74], [x1 - x0, 0.26, 0.06], '#222C44',
               { shadow: false, ambient: 0.15, bias: F.GROUND });
        for (let i = 0; i <= 18; i++) {
          const xx = x0 + (x1 - x0) * i / 18, tall = i % 3 === 0;
          R3.polyline(F, [[xx, 0.13, -0.710], [xx, 0.13, -0.710 + (tall ? 0.028 : 0.015)]],
                      '#6E80A8', { alpha: tall ? 0.75 : 0.4, width: 1, bias: F.GROUND });
        }
        [XAP, XLENS, XSCR].forEach(xx => {
          R3.cylinder(F, [xx, 0, -0.710], [xx, 0, -0.52], 0.028, '#55658C',
                      { segments: 12, shadow: false, ambient: 0.28, bias: F.GROUND });
          R3.cylinder(F, [xx, 0, -0.710], [xx, 0, -0.676], 0.062, '#3B496B',
                      { segments: 16, shadow: false, ambient: 0.24, bias: F.GROUND });
        });
        // the optical axis
        R3.polyline(F, [[XSRC, 0, 0], [XSCR, 0, 0]], th['text-3'],
                    { alpha: .25, width: 1, bias: F.GROUND });
      }

      /* ---------------- the two point sources ---------------- */
      const srcY = [sepDraw / 2, -sepDraw / 2];
      srcY.forEach((yy, i) => {
        const br = i === 0 ? 1 : p.contrast;
        R3.sphere(F, [XSRC, yy, 0], 0.028, pure, { shadow: false, rim: 0.95 });
        const q = cam.project([XSRC, yy, 0]);
        if (q.ok) {
          F.push([XSRC, yy, 0], () => {
            ctx.save(); ctx.globalCompositeOperation = 'lighter';
            const gg = ctx.createRadialGradient(q.x, q.y, 0, q.x, q.y, 12);
            gg.addColorStop(0, g.alpha(pure, .45 * br)); gg.addColorStop(1, g.alpha(pure, 0));
            ctx.fillStyle = gg; ctx.beginPath(); ctx.arc(q.x, q.y, 12, 0, TAU); ctx.fill();
            ctx.restore();
          }, -0.03);
        }
        R3.label(F, [XSRC, yy, 0.13], i === 0 ? 'S₁' : 'S₂', th['text-2'], { size: 10 });
      });
      /* the sources always sit at the far left of the picture, so the leader
         goes right whatever the camera does — pointing left runs it off */
      R3.callout(F, [XSRC, 0, 0.46], 22, -22,
                 'two sources at infinity · Δθ = ' + p.sep.toFixed(3) + ' mrad',
                 th['text-3']);

      /* ---------------- the aperture stop ----------------
         Drawn as a real stop: an opaque plate with a hole in it, filled with
         the even-odd rule so the hole is genuinely a hole. */
      {
        const halfP = 0.58;
        F.push([XAP, 0, 0], () => {
          const outer = [[XAP, -halfP, halfP], [XAP, halfP, halfP],
                         [XAP, halfP, -halfP], [XAP, -halfP, -halfP]].map(v => cam.project(v));
          if (outer.some(q => !q.ok)) return;
          const hole = [];
          const nH = 60;
          for (let i = 0; i < nH; i++) {
            const a = i / nH * TAU;
            hole.push(p.ap === 'circ'
              ? cam.project([XAP, Math.cos(a) * apR, Math.sin(a) * apR])
              : cam.project([XAP, Math.cos(a) * apR,
                             Math.sin(a) >= 0 ? halfP * 0.93 : -halfP * 0.93]));
          }
          if (hole.some(q => !q.ok)) return;
          ctx.save();
          ctx.beginPath();
          outer.forEach((q, i) => i ? ctx.lineTo(q.x, q.y) : ctx.moveTo(q.x, q.y));
          ctx.closePath();
          ctx.moveTo(hole[0].x, hole[0].y);
          for (let i = 1; i < hole.length; i++) ctx.lineTo(hole[i].x, hole[i].y);
          ctx.closePath();
          ctx.fillStyle = F.shade('#3C4967', [-1, 0, 0], { ambient: 0.40 });
          ctx.fill('evenodd');
          ctx.strokeStyle = g.alpha(th.phys, .85); ctx.lineWidth = 1.6;
          ctx.beginPath();
          hole.forEach((q, i) => i ? ctx.lineTo(q.x, q.y) : ctx.moveTo(q.x, q.y));
          ctx.closePath(); ctx.stroke();
          ctx.strokeStyle = g.alpha('#8FA4CE', .5); ctx.lineWidth = 1.2;
          ctx.beginPath();
          outer.forEach((q, i) => i ? ctx.lineTo(q.x, q.y) : ctx.moveTo(q.x, q.y));
          ctx.closePath(); ctx.stroke();
          ctx.restore();
        }, 0);
        R3.callout(F, [XAP, 0, halfP], away([XAP, 0, 0]) * 22, -26,
                   (p.ap === 'circ' ? 'circular stop  D = ' : 'slit  a = ') +
                   (S.Dmm < 10 ? S.Dmm.toFixed(2) + ' mm' : S.Dmm < 1000 ? S.Dmm.toFixed(1) + ' mm'
                                                          : (S.Dmm / 1000).toFixed(2) + ' m'),
                   th.phys);
      }

      /* ---------------- the lens ---------------- */
      {
        const lr = 0.42;
        F.push([XLENS, 0, 0], () => {
          const pts = [];
          for (let i = 0; i <= 48; i++) {
            const a = i / 48 * TAU;
            pts.push(cam.project([XLENS + 0.035 * Math.cos(a) * 0, Math.cos(a) * lr, Math.sin(a) * lr]));
          }
          if (pts.some(q => !q.ok)) return;
          ctx.save();
          ctx.beginPath();
          pts.forEach((q, i) => i ? ctx.lineTo(q.x, q.y) : ctx.moveTo(q.x, q.y));
          ctx.closePath();
          ctx.fillStyle = g.alpha('#7FB8E8', .13); ctx.fill();
          ctx.strokeStyle = g.alpha('#9FD0F5', .55); ctx.lineWidth = 1.6; ctx.stroke();
          ctx.restore();
        }, 0);
        R3.callout(F, [XLENS, 0, lr], away([XLENS, 0, 0]) * 24, -22, 'objective lens', th['text-3']);
      }

      /* ---------------- the light cones ---------------- */
      srcY.forEach((yy, i) => {
        const br = i === 0 ? 1 : p.contrast;
        // a converging lens inverts, so S1 (world +y) images at world −y
        const imgY = (i === 0 ? -1 : 1) * SW * (S.sepRad / 2) / S.range;
        const n = p.ap === 'circ' ? 8 : 4;
        for (let k = 0; k < n; k++) {
          const a = k / n * TAU;
          const ey = Math.cos(a) * apR, ez = Math.sin(a) * apR;
          R3.polyline(F, [[XSRC, yy, 0], [XAP, ey, ez], [XSCR - 0.01, imgY, 0]], pure,
                      { alpha: 0.07 + 0.07 * br, width: 1 });
        }
      });

      /* ---------------- the focal plane, carrying the real Airy image ---------------- */
      {
        const img = airyImage(S);
        R3.texPlane(F, [XSCR, 0, 0], [0, -SW, 0], [0, 0, -SH], img, { grid: 7, bias: 0 });
        R3.box(F, [XSCR + 0.045, 0, 0], [0.05, 2 * SW + 0.10, 2 * SH + 0.10], '#2E3A57',
               { shadow: false, ambient: 0.20 });
        // the frame, the image centres and the Rayleigh ring
        F.push([XSCR, 0, 0], () => {
          const c4 = [[XSCR, -SW, SH], [XSCR, SW, SH], [XSCR, SW, -SH], [XSCR, -SW, -SH]]
            .map(v => cam.project(v));
          if (c4.every(q => q.ok)) {
            ctx.strokeStyle = g.alpha('#8FA4CE', .55); ctx.lineWidth = 1.4;
            ctx.beginPath();
            c4.forEach((q, i) => i ? ctx.lineTo(q.x, q.y) : ctx.moveTo(q.x, q.y));
            ctx.closePath(); ctx.stroke();
          }
          if (!p.rings) return;
          // the first dark ring of source 1, at theta_min — the Rayleigh test
          // is whether the other image centre falls on or outside it
          const yc = -SW * (S.sepRad / 2) / S.range;    // S1's image, inverted
          const rr = SW * S.thMin / S.range;
          /* A circular stop gives a ring; a slit gives a pair of straight
             fringes, so the marker has to change shape with the aperture. */
          ctx.setLineDash([4, 3]);
          ctx.strokeStyle = g.alpha(th.warn, .9); ctx.lineWidth = 1.3;
          if (p.ap === 'circ') {
            const ring = [];
            for (let i = 0; i <= 64; i++) {
              const a = i / 64 * TAU;
              ring.push(cam.project([XSCR - 0.006, yc + Math.cos(a) * rr, Math.sin(a) * rr]));
            }
            if (ring.every(q => q.ok)) {
              ctx.beginPath();
              ring.forEach((q, i) => i ? ctx.lineTo(q.x, q.y) : ctx.moveTo(q.x, q.y));
              ctx.closePath(); ctx.stroke();
            }
          } else {
            [-1, 1].forEach(sg => {
              const a = cam.project([XSCR - 0.006, yc + sg * rr, SH]);
              const b = cam.project([XSCR - 0.006, yc + sg * rr, -SH]);
              if (!a.ok || !b.ok) return;
              ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke();
            });
          }
          ctx.setLineDash([]);
          [[yc, th.text], [-yc, th.text]].forEach(([y0, c]) => {
            const q = cam.project([XSCR - 0.006, y0, 0]);
            if (!q.ok) return;
            ctx.strokeStyle = g.alpha(c, .8); ctx.lineWidth = 1;
            ctx.beginPath(); ctx.moveTo(q.x - 5, q.y); ctx.lineTo(q.x + 5, q.y);
            ctx.moveTo(q.x, q.y - 5); ctx.lineTo(q.x, q.y + 5); ctx.stroke();
          });
        }, -0.02);
        R3.label(F, [XSCR, 0, SH + 0.20], 'focal plane · the image as it really looks',
                 th['text-2'], { size: 9.5 });
        if (p.rings)
          R3.label(F, [XSCR, -SW * (S.sepRad / 2) / S.range - SW * S.thMin / S.range, -SH - 0.16],
                   p.ap === 'circ' ? 'first dark ring θ_min' : 'first zero θ_min',
                   th.warn, { size: 8.5, dy: 4 });
      }

      F.render();

      /* ---------------- handles ---------------- */
      const axis = (a, b, perUnit) => {
        const qa = cam.project(a), qb = cam.project(b);
        if (!qa.ok || !qb.ok) return null;
        const dx = qb.x - qa.x, dy = qb.y - qa.y, L = Math.hypot(dx, dy) || 1;
        return { ux: dx / L, uy: dy / L, perPx: perUnit / L };
      };
      S._axSep = axis([XSRC, 0, 0], [XSRC, 0.5, 0], 0.5);
      S._axAp = axis([XAP, 0, 0], [XAP, 0.5, 0], 0.5);
      {
        const q = cam.project([XSRC, sepDraw / 2, 0]);
        if (q.ok) {
          const on = g.dragging === 'sep';
          ctx.save();
          ctx.strokeStyle = on ? th.text : g.alpha(th.text, .6);
          ctx.lineWidth = on ? 2.2 : 1.5;
          ctx.beginPath(); ctx.arc(q.x, q.y, 11, 0, TAU); ctx.stroke();
          ctx.restore();
          PA.lbl(ctx, q.x - 17, q.y - 3, 'drag S₁ · Δθ',
                 on ? th.text : g.alpha(th['text-3'], .9), 'right', 9);
          g.handle(q.x, q.y, 15, 'sep');
        }
      }
      {
        const q = cam.project([XAP, apR, 0]);
        if (q.ok) {
          const on = g.dragging === 'apr';
          ctx.save();
          ctx.strokeStyle = on ? th.text : g.alpha(th.phys, .8);
          ctx.lineWidth = on ? 2.2 : 1.6;
          ctx.beginPath(); ctx.arc(q.x, q.y, 7, 0, TAU); ctx.stroke();
          ctx.restore();
          PA.lbl(ctx, q.x + 14, q.y - 13, 'drag the rim · D',
                 on ? th.text : g.alpha(th['text-3'], .9), 'left', 9);
          g.handle(q.x, q.y, 15, 'apr');
        }
      }

      /* ---------------- instrument panel 1 · the Rayleigh test ---------------- */
      const T = dipTest(S, S.sepRad);
      const dip = T.two ? T.dip : 1;
      // Rayleigh's own test is geometric; the honest one is whether the
      // profile actually shows two peaks with a deep enough valley
      const resolved = T.two && dip <= 0.735;
      {
        /* At phone width the two panels cannot sit side by side, so the
           second one stacks above the first instead of over it. */
        const narrow = W < 660;
        const bw = narrow ? Math.min(W - 24, 292) : Math.min(W * 0.34, 292);
        const bh = 118, bx = 12, by = H - bh - 26;
        S._panelTop = by;
        ctx.fillStyle = g.alpha('#0B1020', .90);
        ctx.strokeStyle = g.alpha(th.line, 1); ctx.lineWidth = 1;
        ctx.beginPath(); ctx.roundRect(bx, by, bw, bh, 8); ctx.fill(); ctx.stroke();
        PA.lbl(ctx, bx + 10, by + 13, 'THE RAYLEIGH TEST', th['text-3'], 'left', 8.5);
        const row = (i, k, v, c) => {
          PA.lbl(ctx, bx + 10, by + 30 + i * 15, k, th['text-3'], 'left', 9);
          PA.lbl(ctx, bx + bw - 10, by + 30 + i * 15, v, c || th['text-2'], 'right', 9.5);
        };
        row(0, 'separation  Δθ', p.sep.toFixed(3) + ' mrad');
        row(1, (p.ap === 'circ' ? 'limit  1.22 λ/D' : 'limit  λ/a'),
            (S.thMin * 1e3).toFixed(4) + ' mrad', th.phys);
        row(2, 'Δθ / θ_min', S.ratio.toFixed(2),
            S.ratio >= 1.35 ? th.ok : S.ratio >= 1 ? th.warn : th.crit);
        row(3, 'valley / weaker peak', T.two ? dip.toFixed(3) : 'no valley',
            T.two && dip <= 0.735 ? th.ok : th.crit);
        row(4, 'verdict', resolved ? 'RESOLVED'
                        : T.two ? 'two peaks, valley too shallow'
                                : 'ONE BLUR — a single maximum',
            resolved ? th.ok : T.two ? th.warn : th.crit);
        PA.lbl(ctx, bx + 10, by + bh - 8,
               'Sparrow limit ' + (S.sparrow * 1e3).toFixed(4) + ' mrad — the dip first appears',
               g.alpha(th['text-3'], .9), 'left', 8.5);
      }

      /* ---------------- instrument panel 2 · what this means in the world ---------------- */
      {
        const narrow = W < 660;
        const bw = narrow ? Math.min(W - 24, 232) : 214, bh = 100;
        const bx = narrow ? 12 : W - bw - 14;
        const by = narrow ? Math.max(58, (S._panelTop || (H - 144)) - bh - 8) : H - bh - 26;
        ctx.fillStyle = g.alpha('#0B1020', .90);
        ctx.strokeStyle = g.alpha(th.line, 1); ctx.lineWidth = 1;
        ctx.beginPath(); ctx.roundRect(bx, by, bw, bh, 8); ctx.fill(); ctx.stroke();
        PA.lbl(ctx, bx + 10, by + 13, 'WHAT IT CAN SEPARATE', th['text-3'], 'left', 8.5);
        const I = S.instr;
        PA.lbl(ctx, bx + 10, by + 30, I.name, th.text, 'left', 9.5);
        const at = (dist, tag) => {
          const s = S.thMin * dist;
          return (s < 1e-3 ? (s * 1e6).toFixed(1) + ' µm'
                : s < 1 ? (s * 1e3).toFixed(2) + ' mm'
                : s < 1e3 ? s.toFixed(2) + ' m' : (s / 1e3).toFixed(1) + ' km') + '  at ' + tag;
        };
        PA.lbl(ctx, bx + 10, by + 47, at(0.25, '25 cm'), th['text-2'], 'left', 9);
        PA.lbl(ctx, bx + 10, by + 62, at(1e3, '1 km'), th['text-2'], 'left', 9);
        PA.lbl(ctx, bx + 10, by + 77, at(3.844e8, 'the Moon'), th.phys, 'left', 9);
        PA.lbl(ctx, bx + bw - 10, by + 92,
               'microscope 0.61λ/NA = ' + (S.dMicro * 1e9).toFixed(0) + ' nm',
               g.alpha(th['text-3'], .95), 'right', 8.5);
      }

      /* ---------------- header ---------------- */
      ctx.textAlign = 'left'; ctx.textBaseline = 'top';
      ctx.font = '700 19px "IBM Plex Sans Condensed",sans-serif';
      ctx.fillStyle = resolved ? th.ok : th.crit;
      ctx.fillText((resolved ? 'RESOLVED' : 'NOT RESOLVED') + ' — Δθ is ' +
        S.ratio.toFixed(2) + ' × the limit' +
        (p.contrast < 0.99 ? ', but the pair is unequal' : ''), 14, 8);
      ctx.font = '500 10px "IBM Plex Mono",monospace'; ctx.fillStyle = th['text-3'];
      ctx.fillText('θ_min = ' + (p.ap === 'circ' ? '1.22 ' : '') + 'λ/' +
        (p.ap === 'circ' ? 'D' : 'a') + ' = ' + (S.thMin * 1e3).toFixed(4) + ' mrad   ·   λ = ' +
        p.lam + ' nm   ·   ' + (p.ap === 'circ' ? 'D' : 'a') + ' = ' +
        (S.Dmm < 10 ? S.Dmm.toFixed(2) + ' mm' : S.Dmm < 1000 ? S.Dmm.toFixed(1) + ' mm'
                                               : (S.Dmm / 1000).toFixed(2) + ' m'), 14, 31);
      ctx.fillStyle = th['text-3'];
      ctx.fillText('the focal-plane image is inverted by the lens, as a real one is', 14, 45);
    },

    /* Two grab points: how far apart the sources are, and how wide the
       aperture is. Both are drawn on compressed scales, so both carry a gain
       that stretches the gesture to a usable fraction of the stage. */
    onDrag(S, e) {
      const p = S.p;
      if (e.id === 'sep' && S._axSep) {
        const along = e.dx * S._axSep.ux + e.dy * S._axSep.uy;
        // the drawn gap is 0.05 + 0.17·(Δθ/θ_min), capped at a ratio of 3.2
        const dRatio = 2 * along * S._axSep.perPx / 0.30 * 0.22;
        p.sep = clamp(p.sep + dRatio * S.thMin * 1e3, 0.002, 1.2);
        this.setup(S);
      } else if (e.id === 'apr' && S._axAp) {
        const along = e.dx * S._axAp.ux + e.dy * S._axAp.uy;
        // apR = 0.10 + 0.34·(logD + 0.30)/3.70
        p.logD = clamp(p.logD + along * S._axAp.perPx / 0.34 * 3.70 * 0.10, -0.30, 3.40);
        p.instr = 'custom';
        this.setup(S);
      }
    },

    plots: [
      { title: 'Intensity across the image — the Rayleigh criterion in one picture',
        legend: [{ c: '#3DD6F5', label: 'combined (what you see)' },
                 { c: '#63729A', label: 'each source alone' }],
        draw(S, g) {
          const p = S.p, N = 460, comb = [], a = [], b = [];
          for (let i = 0; i <= N; i++) {
            const thv = ((i / N) - 0.5) * 2 * S.range;
            const i1 = psf(S, thv - S.sepRad / 2), i2 = p.contrast * psf(S, thv + S.sepRad / 2);
            const x = thv * 1e3;
            a.push([x, i1]); b.push([x, i2]); comb.push([x, i1 + i2]);
          }
          const P = g.Plot({
            xmin: -S.range * 1e3, xmax: S.range * 1e3, ymin: 0, ymax: (1 + p.contrast) * 1.12,
            xlabel: 'angle (mrad)', ylabel: 'intensity',
            xfmt: v => v.toFixed(2), yfmt: v => v.toFixed(1)
          }).frame();
          P.clip(() => {
            if (p.showBoth) {
              P.line(a, g.alpha(g.theme['text-3'], .95), 1.5, [4, 3]);
              P.line(b, g.alpha(g.theme['text-3'], .95), 1.5, [4, 3]);
            }
            P.area(comb, 0, g.alpha(g.theme.phys, .14));
            P.line(comb, g.theme.phys, 2.2);
            P.vline(-S.sepRad / 2 * 1e3, g.alpha(g.theme.text, .35), [2, 3]);
            P.vline(S.sepRad / 2 * 1e3, g.alpha(g.theme.text, .35), [2, 3]);
            P.vline((-S.sepRad / 2 + S.thMin) * 1e3, g.alpha(g.theme.warn, .8), [3, 3]);
          });
          P.tag((-S.sepRad / 2 + S.thMin) * 1e3, (1 + p.contrast) * 1.02,
            'first zero of source 1', g.theme.warn, 'left', 0);
        },
        hover(S, x) {
          const thv = x * 1e-3;
          const i1 = psf(S, thv - S.sepRad / 2), i2 = S.p.contrast * psf(S, thv + S.sepRad / 2);
          return [
            { label: 'angle', value: x.toFixed(3) + ' mrad' },
            { label: 'source 1', value: i1.toFixed(3), color: '#63729A' },
            { label: 'source 2', value: i2.toFixed(3), color: '#63729A' },
            { label: 'combined', value: (i1 + i2).toFixed(3), color: '#3DD6F5' }
          ];
        } },
      { title: 'How the dip deepens — Sparrow, Rayleigh, and plainly separate',
        legend: [{ c: '#3DD6F5', label: 'central dip I_centre / I_peak' },
                 { c: '#FFAE4C', label: 'Rayleigh value 0.735' }],
        draw(S, g) {
          const p = S.p, N = 110;
          // sweep the separation at fixed aperture and read the dip back out of
          // the summed profile; cached, because each point costs a scan
          const key = [p.lam, p.ap, p.logD, p.contrast].join('|');
          let pts = S._dipCurve;
          if (S._dipKey !== key || !pts) {
            pts = [];
            for (let i = 1; i <= N; i++) {
              const r = i / N * 2.6;                     // in units of theta_min
              const t = dipTest(S, r * S.thMin, 220);
              pts.push([r, t.two ? Math.min(t.dip, 1.25) : 1.25]);
            }
            S._dipCurve = pts; S._dipKey = key;
          }
          const P = g.Plot({
            xmin: 0, xmax: 2.6, ymin: 0, ymax: 1.25,
            xlabel: 'separation Δθ / θ_min', ylabel: 'I_centre / I_peak',
            xfmt: v => v.toFixed(1), yfmt: v => v.toFixed(1)
          }).frame();
          P.clip(() => {
            P.hline(1, g.alpha(g.theme['text-3'], .5), [2, 5]);
            P.hline(0.735, g.alpha(g.theme.warn, .9), [4, 3]);
            P.vline(1, g.alpha(g.theme.ok, .6), [3, 3]);
            P.vline(S.sparrow / S.thMin, g.alpha(g.theme.crit, .5), [2, 4]);
            P.area(pts, 0, g.alpha(g.theme.phys, .12));
            P.line(pts, g.theme.phys, 2.2);
            const tNow = dipTest(S, S.sepRad);
            P.dot(S.ratio, tNow.two ? Math.min(tNow.dip, 1.25) : 1.25,
                  4.5, g.theme.text, g.theme['ink-950']);
          });
          P.tag(1, 0.735, 'Rayleigh', g.theme.warn, 'left', -9);
          P.tag(S.sparrow / S.thMin, 1.0, 'Sparrow', g.theme.crit, 'right', -9);
        },
        hover(S, x) {
          const sep = clamp(x, 0, 2.6) * S.thMin;
          const t = dipTest(S, sep);
          return [{ label: 'Δθ / θ_min', value: x.toFixed(2) },
                  { label: 'Δθ', value: (sep * 1e3).toFixed(4) + ' mrad' },
                  { label: 'valley / weaker peak',
                    value: t.two ? t.dip.toFixed(3) : 'no valley', color: '#3DD6F5' },
                  { label: 'verdict', value: t.two && t.dip <= 0.735 ? 'resolved' : 'not resolved' }];
        } }
    ],

    readouts(S) {
      const p = S.p;
      const DT = dipTest(S, S.sepRad);
      return [
        { label: 'Limit θ_min', value: (S.thMin * 1e3).toFixed(4), unit: 'mrad', flag: 'accent',
          hint: p.ap === 'circ' ? '1.22 λ/D' : 'λ/a' },
        { label: 'Separation Δθ', value: p.sep.toFixed(3), unit: 'mrad' },
        { label: 'Δθ / θ_min', value: S.ratio.toFixed(2), unit: '',
          flag: DT.two && DT.dip <= 0.735 ? 'ok' : S.ratio >= 1 ? 'warn' : 'crit',
          hint: DT.two && DT.dip <= 0.735 ? 'resolved'
              : S.ratio >= 1 ? 'at the limit, but the pair is unequal' : 'below the limit' },
        { label: 'Resolving power 1/θ_min', value: fmt(1 / S.thMin, 3), unit: 'rad⁻¹' },
        { label: 'Valley / weaker peak', value: DT.two ? DT.dip.toFixed(3) : '—', unit: '',
          flag: DT.two && DT.dip <= 0.735 ? 'ok' : 'crit',
          hint: DT.two ? 'Rayleigh value ≈ 0.735' : 'the profile has one maximum' },
        { label: 'Sparrow limit', value: (S.sparrow * 1e3).toFixed(4), unit: 'mrad',
          hint: '0.947 λ/D — the dip first appears' },
        { label: 'Aperture', value: S.Dmm < 10 ? S.Dmm.toFixed(2) : S.Dmm < 1000 ? S.Dmm.toFixed(1)
                                   : (S.Dmm / 1000).toFixed(2),
          unit: S.Dmm < 1000 ? 'mm' : 'm', hint: S.instr.name },
        { label: 'At 1 km, resolves',
          value: S.thMin * 1000 < 1 ? (S.thMin * 1e6).toFixed(1) : (S.thMin * 1000).toFixed(3),
          unit: S.thMin * 1000 < 1 ? 'mm' : 'm', hint: 'smallest separation' },
        { label: 'On the Moon, resolves',
          value: S.thMin * 3.844e8 >= 1000 ? (S.thMin * 3.844e8 / 1000).toFixed(1)
                                           : (S.thMin * 3.844e8).toFixed(0),
          unit: S.thMin * 3.844e8 >= 1000 ? 'km' : 'm', hint: 'at 384 400 km' },
        { label: 'Microscope 0.61λ/NA', value: (S.dMicro * 1e9).toFixed(0), unit: 'nm',
          flag: 'accent', hint: 'NA = ' + p.na.toFixed(2) + ' — a length, not an angle' },
        { label: 'Aperture / λ', value: fmt(S.D / S.lam, 3), unit: '', hint: 'bigger ⇒ sharper' }
      ];
    },

    equation(S) {
      const p = S.p;
      const Dtxt = S.Dmm < 1000 ? S.Dmm.toFixed(2) + ' mm' : (S.Dmm / 1000).toFixed(2) + ' m';
      if (p.ap === 'circ') {
        return E.v('θ') + E.sub('min') + ' ' + E.op('=') + ' 1.22' + E.frac(E.v('λ'), E.v('D')) +
          ' ' + E.op('=') + ' 1.22' + E.frac(E.n(p.lam, 'nm'), Dtxt) + ' ' + E.op('=') +
          ' ' + E.n((S.thMin * 1e3).toFixed(4), 'mrad') +
          '<br>' + E.frac(E.v('I'), E.v('I') + '₀') + ' ' + E.op('=') + ' ' +
          '[' + E.frac('2' + E.v('J') + '₁(' + E.v('x') + ')', E.v('x')) + ']<sup>2</sup>' + E.op(',') +
          ' ' + E.v('x') + ' ' + E.op('=') + ' ' + E.frac('π' + E.v('D') + ' sin' + E.v('θ'), E.v('λ')) +
          '<br>resolved when ' + E.v('Δθ') + ' ' + E.op('≥') + ' ' + E.v('θ') + E.sub('min') + E.op(':') +
          ' ' + E.n(p.sep, 'mrad') + ' vs ' + E.n((S.thMin * 1e3).toFixed(4), 'mrad') +
          ' ' + E.op('→') + ' ' + (S.ratio >= 1 ? 'yes' : 'no') +
          '<br>microscope' + E.op(':') + ' ' + E.v('d') + E.sub('min') + ' ' + E.op('=') + ' ' +
          E.frac('0.61' + E.v('λ'), E.v('NA')) + ' ' + E.op('=') + ' ' +
          E.n((S.dMicro * 1e9).toFixed(0), 'nm');
      }
      return E.v('θ') + E.sub('min') + ' ' + E.op('=') + ' ' + E.frac(E.v('λ'), E.v('a')) +
        ' ' + E.op('=') + ' ' + E.frac(E.n(p.lam, 'nm'), Dtxt) + ' ' + E.op('=') +
        ' ' + E.n((S.thMin * 1e3).toFixed(4), 'mrad') +
        '<br>' + E.frac(E.v('I'), E.v('I') + '₀') + ' ' + E.op('=') + ' ' +
        E.frac('sin<sup>2</sup>' + E.v('x'), E.v('x') + '<sup>2</sup>') + E.op(',') +
        ' ' + E.v('x') + ' ' + E.op('=') + ' ' + E.frac('π' + E.v('a') + ' sin' + E.v('θ'), E.v('λ'));
    },

    eqNote: '<b>Where the 1.22 comes from.</b> For a slit the first dark fringe sits at sin θ = λ/a. A circular ' +
      'aperture has the same physics in two dimensions, and the first zero of the Bessel function J₁ lands at ' +
      '1.22 λ/D instead. Use 1.22 for lenses, telescopes, microscopes and the eye; drop it only for a rectangular slit.' +
      '<br><br><b>Rayleigh is a convention, not a law.</b> Nothing in physics happens at Δθ = 1.22 λ/D. The ' +
      'true threshold at which a dip appears at all is the <b>Sparrow limit</b>, 0.947 λ/D — about 22% closer ' +
      'in. Rayleigh is the value the exam wants, and the second graph shows exactly where the two sit on the ' +
      'same curve.',

    problems: [
      { source: 'JEE Main pattern · straight substitution',
        q: 'A telescope has an objective of diameter 100 mm and is used in light of wavelength 550 nm. Find its limit of resolution in microradians.',
        params: { instr: 'custom', lam: 550, ap: 'circ', logD: 2, sep: 0.30, contrast: 1 },
        predict: { label: 'θ_min', unit: 'µrad', tol: 0.02 },
        measure: S => S.thMin * 1e6,
        working: 'θ_min = 1.22 λ/D = 1.22 × 550×10⁻⁹ / 0.100 = <b>6.71 µrad</b>. ' +
          'Keep the 1.22: it is there because the aperture is a circle, and dropping it is the single ' +
          'commonest error in this topic.' },
      { source: 'NEET pattern · what it means on the ground',
        q: 'The same 100 mm telescope looks at the Moon, 3.844 × 10⁸ m away, in 550 nm light. What is the smallest separation on the lunar surface it can resolve, in kilometres?',
        params: { instr: 'custom', lam: 550, ap: 'circ', logD: 2, sep: 0.30, contrast: 1 },
        predict: { label: 'separation on the Moon', unit: 'km', tol: 0.03 },
        measure: S => S.thMin * 3.844e8 / 1000,
        working: 'Multiply the angle by the distance: s = θ_min × L = 6.71×10⁻⁶ × 3.844×10⁸ = ' +
          '2580 m ≈ <b>2.58 km</b>. A 100 mm telescope cannot separate two craters closer than about ' +
          'two and a half kilometres — which is why the big observatory mirrors exist.' },
      { source: 'JEE Advanced pattern · the eye',
        q: 'A human pupil is 3.0 mm across and the eye is most sensitive near 550 nm. Two dots are drawn on a page held 25 cm away. What is the smallest gap between them that the eye can still resolve, in millimetres?',
        params: { instr: 'eye', ap: 'circ', sep: 0.30, contrast: 1 },
        predict: { label: 'smallest gap at 25 cm', unit: 'mm', tol: 0.03 },
        measure: S => S.thMin * 0.25 * 1000,
        working: 'θ_min = 1.22 × 550×10⁻⁹ / 3.0×10⁻³ = 2.24×10⁻⁴ rad. At 25 cm: ' +
          's = 2.24×10⁻⁴ × 0.250 = 5.6×10⁻⁵ m = <b>0.056 mm</b>, about one twentieth of a millimetre. ' +
          'That is roughly the pixel pitch at which a phone screen stops looking pixelated at reading ' +
          'distance — the physics is the same calculation.' },
      { source: 'JEE Advanced pattern · slit versus circle',
        q: 'The circular stop of 3.00 mm is replaced by a rectangular slit of the same 3.00 mm width, with 550 nm light. By what factor does θ_min change?',
        params: { instr: 'custom', lam: 550, ap: 'slit', logD: 0.4771, sep: 0.30, contrast: 1 },
        predict: { label: 'θ_min(slit) / θ_min(circle)', unit: '×', tol: 0.03 },
        measure: S => 1 / 1.22,
        working: 'For a slit the first zero of sin x / x is at x = π, giving θ_min = λ/a exactly. ' +
          'For a circle the first zero of J₁ is at x = 3.832 = 1.22π, giving 1.22 λ/D. So the slit ' +
          'limit is <b>1/1.22 = 0.820</b> of the circular one — the slit resolves slightly better in ' +
          'the direction across its width, and not at all along its length. Switch the shape in the ' +
          'lab and watch the image become a streak rather than a disc.' },
      { source: 'JEE Advanced pattern · the microscope',
        q: 'An oil-immersion objective has a numerical aperture of 1.40 and is used with 550 nm light. Find the smallest separation it can resolve, in nanometres.',
        params: { instr: 'custom', lam: 550, ap: 'circ', logD: 0.4771, na: 1.40, sep: 0.30, contrast: 1 },
        predict: { label: 'd_min', unit: 'nm', tol: 0.03 },
        measure: S => S.dMicro * 1e9,
        working: 'd_min = 0.61 λ/NA = 0.61 × 550/1.40 = <b>240 nm</b>. Note what changed: a microscope ' +
          'resolves a <b>length</b>, not an angle, because the object sits at a fixed short distance. ' +
          'NA = n sin θ, so immersion oil (n ≈ 1.5) is what lets NA exceed 1 at all — and there is no ' +
          'way to push an optical microscope much below about 200 nm. That wall is why the electron ' +
          'microscope was invented.' }
    ],

    walkthrough: [
      { title: '1 · A point source is never a point',
        body: 'Turn the second source right down and look at the image on the focal plane. Instead of a dot you get a bright disc surrounded by faint rings.',
        ask: 'Why does one point source produce rings?',
        reveal: 'Because the aperture <b>diffracts</b> the light. This is the <b>Airy pattern</b>, and the central bright disc is the Airy disc. Its angular radius, out to the first dark ring, is 1.22 λ/D — that is the fundamental blur of the instrument, before any lens defect. The rings you can see on the screen are the real J₁ rings, not a painted decoration.',
        params: { instr: 'custom', lam: 550, ap: 'circ', logD: 0.4771, sep: 0.30, contrast: 0.15 } },
      { title: '2 · The Rayleigh criterion',
        body: 'Bring the second source back to full brightness and drag S₁ until the two discs just merge. The dashed orange circle is the first dark ring of source 1.',
        ask: 'What exactly is the condition for "just resolved"?',
        reveal: 'The <b>centre of one pattern falls on the first dark ring of the other</b> — the second cross lands exactly on the orange circle. That happens at Δθ = 1.22 λ/D, and it leaves a dip of about 74% between the peaks. Below that the dip fills in and the pair looks like a single blob.',
        params: { instr: 'custom', lam: 550, ap: 'circ', logD: 0.4771, sep: 0.2237, contrast: 1.0 } },
      { title: '3 · Bigger aperture, sharper image',
        body: 'Drag the aperture rim wider and watch both the focal-plane image and the θ_min readout.',
        ask: 'Why do astronomers keep building bigger telescopes?',
        reveal: 'Two reasons, and resolution is the one students forget. θ_min = 1.22 λ/D is <b>inversely</b> proportional to D, so doubling the mirror halves the smallest resolvable angle. Collecting more light is the other reason — but a small telescope cannot be fixed by simply exposing longer.',
        params: { instr: 'custom', lam: 550, ap: 'circ', logD: 0.9542, sep: 0.30, contrast: 1 } },
      { title: '4 · Shorter wavelength does the same job',
        body: 'Return the aperture to 3 mm and instead drag the wavelength from red down to violet.',
        ask: 'Which gives the finer detail — red light or blue light?',
        reveal: '<b>Blue.</b> θ_min ∝ λ, so shorter wavelengths resolve finer detail through the same aperture. This is exactly why electron microscopes exist: an electron\'s de Broglie wavelength is thousands of times smaller than visible light, so the resolution is thousands of times better.',
        params: { instr: 'custom', lam: 400, ap: 'circ', logD: 0.4771, sep: 0.30, contrast: 1 } },
      { title: '5 · Slit versus circular aperture',
        body: 'Switch the aperture shape and compare the θ_min readout at the same size — and look at what happens to the image.',
        ask: 'Where does the factor 1.22 go?',
        reveal: 'It disappears. A rectangular slit gives θ_min = λ/a exactly, because the first zero of the sinc function is at x = π. The 1.22 is purely a consequence of circular geometry — the first zero of J₁. Using the wrong one is a classic dropped mark. Notice too that the image is now a <b>streak</b>: a slit diffracts across its width and barely at all along its length.',
        params: { instr: 'custom', lam: 550, ap: 'slit', logD: 0.4771, sep: 0.30, contrast: 1 } },
      { title: '6 · Put your own eye on the bench',
        body: 'Choose the human eye from the instrument list: a 3 mm pupil at 550 nm.',
        ask: 'How fine a detail can you actually see on a page held at 25 cm?',
        reveal: 'θ_min = 1.22 × 550 nm / 3 mm = 224 µrad, and at 25 cm that is <b>0.056 mm</b> — about a twentieth of a millimetre. Everything finer than that on this page is, for you, a blur. The WHAT IT CAN SEPARATE panel does this arithmetic for whichever instrument is loaded.',
        params: { instr: 'eye', ap: 'circ', sep: 0.30, contrast: 1 } },
      { title: '7 · Unequal brightnesses',
        body: 'Set the pair exactly at the Rayleigh separation, then drop the second source to a quarter of the first.',
        ask: 'The separation has not changed. Why has the pair stopped looking resolved?',
        reveal: 'Rayleigh\'s 0.735 dip assumes two <b>equal</b> sources. A faint companion sits on the bright one\'s skirt, and the dip between them is shallow or absent even at the nominal limit. This is the real problem in astronomy — a faint planet beside a bright star is far harder than the formula suggests, which is why coronagraphs exist. The second graph shows the dip curve moving as you change the ratio.',
        params: { instr: 'custom', lam: 550, ap: 'circ', logD: 0.4771, sep: 0.2237, contrast: 0.25 } },
      { title: '8 · Rayleigh is a convention',
        body: 'Look at the second graph and find the two vertical markers.',
        ask: 'Is there a separation at which the pair physically stops being two?',
        reveal: 'Yes, but it is not Rayleigh\'s. The <b>Sparrow limit</b>, 0.947 λ/D, is where the dip between the peaks vanishes entirely — below that the sum has a single maximum and no amount of care can call it two. Rayleigh\'s 1.22 λ/D is a comfortable convention that leaves a visible 26% dip. The exam wants 1.22; knowing that it is a convention is what separates a good answer from a recited one.',
        params: { instr: 'custom', lam: 550, ap: 'circ', logD: 0.4771, sep: 0.1737, contrast: 1 } }
    ],

    quiz: [
      { q: 'The resolving power of a telescope is increased by:',
        options: ['using a longer wavelength', 'increasing the objective diameter',
                  'increasing the eyepiece magnification', 'increasing the focal length'], answer: 1,
        why: 'θ_min = 1.22 λ/D. Only the objective diameter D and the wavelength enter; magnification cannot recover detail the aperture never captured.' },
      { q: 'Two stars are just resolved by a telescope in green light. Switching to red light of longer wavelength, the pair will be:',
        options: ['still just resolved', 'better resolved', 'no longer resolved', 'resolved only at night'], answer: 2,
        why: 'θ_min grows with λ, so the limit worsens. A pair that was exactly at the limit falls below it.' },
      { q: 'For a circular aperture the factor 1.22 arises from:',
        options: ['the refractive index of air', 'the first zero of the Bessel function J₁',
                  'the Rayleigh scattering law', 'the focal ratio of the lens'], answer: 1,
        why: 'The circular-aperture diffraction integral produces J₁, whose first zero is at x ≈ 3.832 = 1.22π — hence 1.22 λ/D.' },
      { q: 'The limit of resolution of a compound microscope is written d_min = 0.61λ/NA. Compared with a telescope\'s θ_min, this quantity is:',
        options: ['also an angle', 'a length', 'a dimensionless ratio', 'an area'], answer: 1,
        why: 'The object sits at a fixed short working distance, so the useful figure is the smallest separation in the object plane — a length. Immersion oil raises NA = n sin θ above 1, and no optical microscope gets much below about 200 nm.' },
      { q: 'A faint companion star sits exactly at the Rayleigh separation from a bright one. Compared with two equally bright stars at the same separation, it is:',
        options: ['equally easy to resolve', 'easier to resolve', 'harder to resolve',
                  'impossible in principle'], answer: 2,
        why: 'Rayleigh\'s 0.735 dip is derived for two equal sources. A faint companion sits inside the bright star\'s Airy skirt, so the dip between them is shallower or absent. Drop the brightness of source 2 in the lab and watch the dip fill in without the separation changing at all.' }
    ],

    notes: '<b>Where this shows up in the paper.</b>' +
      '<ul><li>Direct substitution into θ_min = 1.22 λ/D for telescopes, microscopes and the eye.</li>' +
      '<li>"Smallest separation resolvable at distance L" — multiply θ_min by L.</li>' +
      '<li>Comparisons: which change improves resolution, and by how much.</li>' +
      '<li>The microscope form d_min = 0.61 λ/NA, and why immersion oil raises NA.</li>' +
      '<li>Why an electron microscope out-resolves an optical one — de Broglie wavelength.</li></ul>' +
      '<div class="pyq"><em>Trap to avoid</em>Resolving power and magnification are <b>not</b> the same thing. ' +
      'Magnifying a blurred image just gives a bigger blur — "empty magnification". Only a larger aperture or a ' +
      'shorter wavelength adds real detail.</div>' +
      '<div class="pyq"><em>Trap to avoid</em>Keep the 1.22 for a circle and drop it for a slit. The two ' +
      'formulae look almost identical and carry different physics: π is the first zero of sin x/x, ' +
      '3.832 = 1.22π is the first zero of J₁.</div>'
  });

})(window.InsightLab);
