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
        if (sg < 0) {
          // the lower pole is the bench the machine stands on: a dark steel
          // plate, not a slab of colour that would swamp the dees
          R3.cylinder(F, [0, 0, zz], [0, 0, zz - 0.08], rr, '#26334C',
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
        }, F.GROUND * 0.5);
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

  L.register({
    id: 'resolving', subject: 'physics',
    name: 'Diffraction & Resolving Power — the Rayleigh Criterion',
    chapter: 'Wave Optics',
    exams: ['JEE Main', 'JEE Advanced', 'NEET UG'],
    weight: 'High yield',
    is3D: false,
    stageHint: 'Two point sources seen through one aperture · drag the separation slider through the Rayleigh limit',
    lede: 'Every lens, every telescope and your own eye has a hard limit: light bends round the edge of the ' +
      'aperture, so a point source never forms a point. Two nearby sources blur into one. ' +
      'This lab computes the true <b>Airy pattern</b> (from the Bessel function J₁, not a Gaussian stand-in) ' +
      'for a circular aperture, sums two of them, and tells you whether the pair is <b>resolved</b> by the ' +
      'Rayleigh criterion.',

    params: { lam: 550, ap: 'circ', D: 3.0, sep: 0.30, contrast: 1.0, showBoth: true, instr: 'custom' },

    presets: [
      { name: 'Just resolved', params: { lam: 550, ap: 'circ', D: 3.0, sep: 0.2237 * 1, showBoth: true } },
      { name: 'Clearly resolved', params: { lam: 550, ap: 'circ', D: 3.0, sep: 0.55, showBoth: true } },
      { name: 'Unresolved blur', params: { lam: 550, ap: 'circ', D: 3.0, sep: 0.10, showBoth: true } },
      { name: 'Bigger aperture', params: { lam: 550, ap: 'circ', D: 8.0, sep: 0.30, showBoth: true } },
      { name: 'Rectangular slit', params: { lam: 550, ap: 'slit', D: 3.0, sep: 0.30, showBoth: true } },
      { name: 'Blue light 450 nm', params: { lam: 450, ap: 'circ', D: 3.0, sep: 0.30 } }
    ],

    controls: [
      { group: 'Light', items: [
        { key: 'lam', label: 'Wavelength <i>λ</i>', min: 380, max: 720, step: 1, unit: 'nm', fmt: v => v.toFixed(0) }
      ] },
      { group: 'Aperture', items: [
        { key: 'ap', type: 'select', label: 'Aperture shape', options: [
          { value: 'circ', label: 'Circular' }, { value: 'slit', label: 'Slit' }] },
        { key: 'D', label: 'Aperture size <i>D</i>', min: 0.5, max: 12, step: 0.05, unit: 'mm',
          fmt: v => v.toFixed(2) }
      ] },
      { group: 'The two sources', items: [
        { key: 'sep', label: 'Angular separation <i>Δθ</i>', min: 0.02, max: 1.2, step: 0.005,
          unit: 'mrad', fmt: v => v.toFixed(3) },
        { key: 'contrast', label: 'Brightness of source 2', min: 0.15, max: 1, step: 0.01, unit: '×',
          fmt: v => v.toFixed(2) }
      ] },
      { group: 'Display', items: [
        { key: 'showBoth', type: 'toggle', label: 'Show the two patterns separately' }
      ] }
    ],

    setup(S) {
      const p = S.p;
      S.lam = p.lam * 1e-9; S.D = p.D * 1e-3;
      S.thMin = (p.ap === 'circ' ? 1.22 : 1.0) * S.lam / S.D;   // radians
      S.sepRad = p.sep * 1e-3;
      S.range = Math.max(3.2 * S.thMin, 1.9 * S.sepRad);
      S.ratio = S.sepRad / S.thMin;
    },

    step(S, dt) { S.ph = (S.ph || 0) + dt; },

    drawStage(S, g) {
      const ctx = g.ctx, th = g.theme, p = S.p, W = g.w, H = g.h;
      const acc = th.phys;
      const halfW = W * 0.5;

      /* ---------- left: the two sources and the aperture ---------- */
      const sx = W * 0.13, cy = H * 0.44;
      const dsep = clamp(S.ratio, 0, 3) * 26 + 6;
      [[-1, 1], [1, p.contrast]].forEach(([sgn, br]) => {
        const y = cy + sgn * dsep / 2;
        ctx.save(); ctx.globalCompositeOperation = 'lighter';
        const rg = ctx.createRadialGradient(sx, y, 0, sx, y, 16);
        rg.addColorStop(0, g.alpha('#FFFFFF', .85 * br)); rg.addColorStop(1, 'rgba(255,255,255,0)');
        ctx.fillStyle = rg; ctx.beginPath(); ctx.arc(sx, y, 16, 0, TAU); ctx.fill();
        ctx.restore();
        ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(sx, y, 2.2, 0, TAU); ctx.fill();
      });
      ctx.font = '9.5px "IBM Plex Mono",monospace'; ctx.fillStyle = th['text-3'];
      ctx.textAlign = 'center'; ctx.textBaseline = 'bottom';
      ctx.fillText('two point sources', sx, cy - dsep / 2 - 20);

      // aperture
      const ax = W * 0.30;
      const apR = clamp(p.D * 3.4, 7, 40);
      ctx.fillStyle = th['ink-700'];
      ctx.fillRect(ax - 4, 18, 8, (cy - apR) - 18);
      ctx.fillRect(ax - 4, cy + apR, 8, (H * 0.82) - (cy + apR));
      ctx.strokeStyle = g.alpha(th.line, 1); ctx.lineWidth = 1;
      ctx.strokeRect(ax - 4.5, 17.5, 9, H * 0.82 - 17);
      if (p.ap === 'circ') {
        ctx.strokeStyle = g.alpha(acc, .8); ctx.lineWidth = 1.4;
        ctx.beginPath(); ctx.ellipse(ax, cy, 4.5, apR, 0, 0, TAU); ctx.stroke();
      }
      ctx.fillStyle = th['text-2']; ctx.textAlign = 'center'; ctx.textBaseline = 'top';
      ctx.fillText(p.ap === 'circ' ? 'D = ' + p.D.toFixed(2) + ' mm' : 'a = ' + p.D.toFixed(2) + ' mm',
        ax, H * 0.82 + 5);

      // rays
      ctx.save(); ctx.globalCompositeOperation = 'lighter';
      ctx.strokeStyle = g.alpha(acc, .22); ctx.lineWidth = 1;
      [[-1], [1]].forEach(([sgn]) => {
        const y = cy + sgn * dsep / 2;
        ctx.beginPath(); ctx.moveTo(sx, y); ctx.lineTo(ax, cy - apR * 0.8); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(sx, y); ctx.lineTo(ax, cy + apR * 0.8); ctx.stroke();
      });
      ctx.restore();

      /* ---------- right: the image, painted from the real PSF ---------- */
      const ix0 = W * 0.42, ix1 = W - 16;
      const iy0 = 24, iy1 = H * 0.80;
      const rows = Math.round(iy1 - iy0);
      for (let i = 0; i <= rows; i++) {
        const thv = ((i / rows) - 0.5) * 2 * S.range;
        const I = psf(S, thv - S.sepRad / 2) + p.contrast * psf(S, thv + S.sepRad / 2);
        const v = Math.pow(clamp(I / (1 + p.contrast), 0, 1), 0.55);
        ctx.fillStyle = 'rgb(' + Math.round(255 * v) + ',' + Math.round(250 * v) + ',' + Math.round(232 * v) + ')';
        ctx.fillRect(ix0, iy0 + i, ix1 - ix0, 1.2);
      }
      ctx.strokeStyle = g.alpha(th.line, 1); ctx.lineWidth = 1;
      ctx.strokeRect(ix0 + .5, iy0 + .5, ix1 - ix0, iy1 - iy0);
      ctx.fillStyle = th['text-2']; ctx.textAlign = 'center'; ctx.textBaseline = 'top';
      ctx.fillText('what the instrument actually records', (ix0 + ix1) / 2, iy1 + 5);

      /* ---------- verdict ---------- */
      const st = S.ratio >= 1.0 ? (S.ratio > 1.35 ? 'CLEARLY RESOLVED' : 'JUST RESOLVED') : 'NOT RESOLVED';
      const cc = S.ratio >= 1.35 ? th.ok : S.ratio >= 1.0 ? th.warn : th.crit;
      ctx.font = '700 15px "IBM Plex Sans Condensed",sans-serif';
      ctx.fillStyle = cc; ctx.textAlign = 'left'; ctx.textBaseline = 'top';
      ctx.fillText(st, 14, 12);
      ctx.font = '500 10px "IBM Plex Mono",monospace'; ctx.fillStyle = th['text-3'];
      ctx.fillText('Δθ / θ_min = ' + S.ratio.toFixed(2) +
        '   ·   θ_min = ' + (S.thMin * 1e3).toFixed(3) + ' mrad', 14, 32);
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
            // Rayleigh markers: the first zero of one pattern sits on the peak of the other
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
        } }
    ],

    readouts(S) {
      const p = S.p;
      const dipNeeded = 0.735;    // Rayleigh dip for two equal Airy patterns
      const centre = psf(S, S.sepRad / 2) * (1 + p.contrast);
      const peak = 1 + p.contrast * psf(S, S.sepRad);
      return [
        { label: 'Limit θ_min', value: (S.thMin * 1e3).toFixed(4), unit: 'mrad', flag: 'accent',
          hint: p.ap === 'circ' ? '1.22 λ/D' : 'λ/a' },
        { label: 'Separation Δθ', value: p.sep.toFixed(3), unit: 'mrad' },
        { label: 'Δθ / θ_min', value: S.ratio.toFixed(2), unit: '',
          flag: S.ratio >= 1.35 ? 'ok' : S.ratio >= 1 ? 'warn' : 'crit',
          hint: S.ratio >= 1 ? 'at or beyond the limit' : 'below the limit' },
        { label: 'Resolving power 1/θ_min', value: fmt(1 / S.thMin, 3), unit: 'rad⁻¹' },
        { label: 'Central dip', value: (centre / peak).toFixed(3), unit: '',
          hint: 'Rayleigh dip ≈ 0.735' },
        { label: 'Airy disc radius', value: (S.thMin * 1e3).toFixed(4), unit: 'mrad',
          hint: 'to the first dark ring' },
        { label: 'At 1 km, resolves', value: fmt(S.thMin * 1000, 3), unit: 'm',
          hint: 'smallest separation' },
        { label: 'Aperture / λ', value: fmt(S.D / S.lam, 3), unit: '',
          hint: 'bigger ⇒ sharper' }
      ];
    },

    equation(S) {
      const p = S.p;
      if (p.ap === 'circ') {
        return E.v('θ') + E.sub('min') + ' ' + E.op('=') + ' 1.22' + E.frac(E.v('λ'), E.v('D')) +
          ' ' + E.op('=') + ' 1.22' + E.frac(E.n(p.lam, 'nm'), E.n(p.D, 'mm')) + ' ' + E.op('=') +
          ' ' + E.n((S.thMin * 1e3).toFixed(4), 'mrad') +
          '<br>' + E.frac(E.v('I'), E.v('I') + '₀') + ' ' + E.op('=') + ' ' +
          '[' + E.frac('2' + E.v('J') + '₁(' + E.v('x') + ')', E.v('x')) + ']<sup>2</sup>' + E.op(',') +
          ' ' + E.v('x') + ' ' + E.op('=') + ' ' + E.frac('π' + E.v('D') + ' sin' + E.v('θ'), E.v('λ')) +
          '<br>resolved when ' + E.v('Δθ') + ' ' + E.op('≥') + ' ' + E.v('θ') + E.sub('min') + E.op(':') +
          ' ' + E.n(p.sep, 'mrad') + ' vs ' + E.n((S.thMin * 1e3).toFixed(4), 'mrad') +
          ' ' + E.op('→') + ' ' + (S.ratio >= 1 ? 'yes' : 'no');
      }
      return E.v('θ') + E.sub('min') + ' ' + E.op('=') + ' ' + E.frac(E.v('λ'), E.v('a')) +
        ' ' + E.op('=') + ' ' + E.frac(E.n(p.lam, 'nm'), E.n(p.D, 'mm')) + ' ' + E.op('=') +
        ' ' + E.n((S.thMin * 1e3).toFixed(4), 'mrad') +
        '<br>' + E.frac(E.v('I'), E.v('I') + '₀') + ' ' + E.op('=') + ' ' +
        E.frac('sin<sup>2</sup>' + E.v('x'), E.v('x') + '<sup>2</sup>') + E.op(',') +
        ' ' + E.v('x') + ' ' + E.op('=') + ' ' + E.frac('π' + E.v('a') + ' sin' + E.v('θ'), E.v('λ'));
    },
    eqNote: '<b>Where the 1.22 comes from.</b> For a slit the first dark fringe sits at sin θ = λ/a. A circular ' +
      'aperture has the same physics in two dimensions, and the first zero of the Bessel function J₁ lands at ' +
      '1.22 λ/D instead. Use 1.22 for lenses, telescopes, microscopes and the eye; drop it only for a rectangular slit.',

    walkthrough: [
      { title: '1 · A point source is never a point',
        body: 'Turn the second source right down and look at the image of a single star. Instead of a dot you get a bright disc surrounded by faint rings.',
        ask: 'Why does one point source produce rings?',
        reveal: 'Because the aperture <b>diffracts</b> the light. This is the <b>Airy pattern</b>, and the central bright disc is the Airy disc. Its angular radius, out to the first dark ring, is 1.22 λ/D — that is the fundamental blur of the instrument, before any lens defect.',
        params: { lam: 550, ap: 'circ', D: 3.0, sep: 0.30, contrast: 0.15 } },
      { title: '2 · The Rayleigh criterion',
        body: 'Bring the second source back to full brightness and slide the separation down until the two peaks just merge.',
        ask: 'What exactly is the condition for "just resolved"?',
        reveal: 'The <b>central maximum of one pattern falls on the first minimum of the other</b> — the orange dashed line lands on the other peak. That happens at Δθ = 1.22 λ/D, and it leaves a dip of about 74% between the peaks. Below that the dip fills in and the pair looks like a single blob.',
        params: { lam: 550, ap: 'circ', D: 3.0, sep: 0.2237, contrast: 1.0 } },
      { title: '3 · Bigger aperture, sharper image',
        body: 'Widen the aperture and watch both the image strip and the θ_min readout.',
        ask: 'Why do astronomers keep building bigger telescopes?',
        reveal: 'Two reasons, and resolution is the one students forget. θ_min = 1.22 λ/D is <b>inversely</b> proportional to D, so doubling the mirror halves the smallest resolvable angle. Collecting more light is the other reason — but a small telescope cannot be fixed by simply exposing longer.',
        params: { lam: 550, ap: 'circ', D: 9.0, sep: 0.30 } },
      { title: '4 · Shorter wavelength does the same job',
        body: 'Return the aperture to 3 mm and instead drag the wavelength from red down to violet.',
        ask: 'Which gives the finer detail — red light or blue light?',
        reveal: '<b>Blue.</b> θ_min ∝ λ, so shorter wavelengths resolve finer detail through the same aperture. This is exactly why electron microscopes exist: an electron\'s de Broglie wavelength is thousands of times smaller than visible light, so the resolution is thousands of times better.',
        params: { lam: 400, ap: 'circ', D: 3.0, sep: 0.30 } },
      { title: '5 · Slit versus circular aperture',
        body: 'Switch the aperture shape and compare the θ_min readout at the same size.',
        ask: 'Where does the factor 1.22 go?',
        reveal: 'It disappears. A rectangular slit gives θ_min = λ/a exactly, because the first zero of the sinc function is at x = π. The 1.22 is purely a consequence of circular geometry — the first zero of J₁. Using the wrong one is a classic dropped mark.',
        params: { lam: 550, ap: 'slit', D: 3.0, sep: 0.30 } }
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
        why: 'The circular-aperture diffraction integral produces J₁, whose first zero is at x ≈ 3.832 = 1.22π — hence 1.22 λ/D.' }
    ],

    notes: '<b>Where this shows up in the paper.</b>' +
      '<ul><li>Direct substitution into θ_min = 1.22 λ/D for telescopes, microscopes and the eye.</li>' +
      '<li>"Smallest separation resolvable at distance L" — multiply θ_min by L.</li>' +
      '<li>Comparisons: which change improves resolution, and by how much.</li>' +
      '<li>Why an electron microscope out-resolves an optical one — de Broglie wavelength.</li></ul>' +
      '<div class="pyq"><em>Trap to avoid</em>Resolving power and magnification are <b>not</b> the same thing. ' +
      'Magnifying a blurred image just gives a bigger blur — "empty magnification". Only a larger aperture or a ' +
      'shorter wavelength adds real detail.</div>'
  });

})(window.InsightLab);
