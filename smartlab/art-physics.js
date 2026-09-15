/* ============================================================
   PHYSART — the physics figure library.

   Every physics lab draws through this, for the same reason the
   biology labs draw through BIOART: a stroked line is not an
   apparatus. Rigid bodies are lit solids with surface markings so
   their rotation is visible, springs are wound coils with real
   pitch, circuit elements are components rather than symbols, and
   a vector is an arrow whose head scales with its shaft.

   Everything here sits on RX (render.js) for the lighting.
   ============================================================ */
(function () {
  'use strict';
  const TAU = Math.PI * 2;
  const RX = window.RX;
  const mix = RX.mix, rgba = RX.rgba, sat = RX.sat;
  const L = RX.LIGHT;

  const C = {
    steel:  '#8FA3C0',
    brass:  '#D9A441',
    copper: '#D2793F',
    glass:  '#BFE2F5',
    wire:   '#C9D4EA',
    charge_p: '#FF5E6C',
    charge_n: '#4D8CF5',
    field:  '#3DD6F5',
    energy: '#7CE0A8',
    hot:    '#FFB347'
  };

  /* ---------------- text with a halo, and leader lines ---------------- */
  function lbl(ctx, x, y, text, col, align, size, baseline) {
    ctx.font = '600 ' + Math.max(8.5, size || 9.5) + 'px "IBM Plex Mono",monospace';
    ctx.textAlign = align || 'left';
    ctx.textBaseline = baseline || 'middle';
    ctx.lineWidth = 3.2; ctx.strokeStyle = 'rgba(5,8,15,.88)'; ctx.lineJoin = 'round';
    ctx.strokeText(text, x, y);
    ctx.fillStyle = col || '#C9D4EA';
    ctx.fillText(text, x, y);
  }
  function leader(ctx, x0, y0, x1, y1, col) {
    ctx.strokeStyle = rgba(col || '#8FA4CE', .6); ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(x0, y0); ctx.lineTo(x1, y1); ctx.stroke();
    ctx.fillStyle = rgba(col || '#8FA4CE', .9);
    ctx.beginPath(); ctx.arc(x0, y0, 1.9, 0, TAU); ctx.fill();
  }

  /* =====================================================================
     VECTOR — the workhorse. A shaft whose head is proportional to it, so
     a short vector does not become all arrowhead and a long one does not
     end in a pinprick.
     ===================================================================== */
  function vector(ctx, x0, y0, x1, y1, colour, o) {
    o = o || {};
    const dx = x1 - x0, dy = y1 - y0;
    const len = Math.hypot(dx, dy);
    if (len < 0.8) return;
    const ang = Math.atan2(dy, dx);
    const w = o.width || Math.max(1.8, Math.min(len * 0.075, 4.5));
    const hl = Math.min(o.head || w * 3.4, len * 0.62);   // head length
    const hw = hl * 0.52;
    const base = o.vivid === false ? colour : sat(colour, 1.18);
    const bx = x1 - Math.cos(ang) * hl, by = y1 - Math.sin(ang) * hl;
    if (o.shadow !== false) {
      ctx.save();
      if (RX.canFilter) ctx.filter = 'blur(' + Math.max(1, w * 0.7).toFixed(1) + 'px)';
      ctx.strokeStyle = 'rgba(0,0,0,.45)'; ctx.lineWidth = w * 1.5; ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(x0 - L.x * w, y0 - L.y * w); ctx.lineTo(bx - L.x * w, by - L.y * w);
      ctx.stroke(); ctx.restore(); ctx.filter = 'none';
    }
    // shaft, lit from the top edge
    ctx.lineCap = 'butt';
    ctx.strokeStyle = mix(base, '#05080F', .40); ctx.lineWidth = w;
    ctx.beginPath(); ctx.moveTo(x0, y0); ctx.lineTo(bx, by); ctx.stroke();
    ctx.strokeStyle = mix(base, '#ffffff', .40); ctx.lineWidth = w * 0.38;
    ctx.beginPath();
    ctx.moveTo(x0 + L.x * w * .28, y0 + L.y * w * .28);
    ctx.lineTo(bx + L.x * w * .28, by + L.y * w * .28);
    ctx.stroke();
    // head
    const head = c => {
      c.beginPath();
      c.moveTo(x1, y1);
      c.lineTo(bx - Math.sin(ang) * -hw, by + Math.cos(ang) * -hw);
      c.lineTo(bx - Math.sin(ang) * hw, by + Math.cos(ang) * hw);
      c.closePath();
    };
    RX.volume(ctx, head, { fill: base, r: hl * 0.7, cx: (x1 + bx) / 2, cy: (y1 + by) / 2,
                           vivid: false, gloss: 0.3, contour: 0 });
    if (o.label) {
      const off = (o.labelSide || 1) * (w + 9);
      lbl(ctx, x1 - Math.sin(ang) * off + Math.cos(ang) * 6,
               y1 + Math.cos(ang) * off + Math.sin(ang) * 6,
               o.label, colour, 'center', o.labelSize || 9.5);
    }
  }

  /* =====================================================================
     RIGID BODY seen edge-on — a disc, ring, sphere or shell. The surface
     markings are what make the rotation visible; without them a rolling
     body and a sliding one look identical, which is exactly the confusion
     the lab exists to remove.
     ===================================================================== */
  const BODIES = {
    disc:    { k: 0.5,  name: 'Solid disc / cylinder', hollow: 0 },
    ring:    { k: 1.0,  name: 'Ring / hollow cylinder', hollow: 0.80 },
    sphere:  { k: 0.4,  name: 'Solid sphere',           hollow: 0 },
    shell:   { k: 2 / 3, name: 'Hollow sphere (shell)', hollow: 0.86 }
  };

  function body(ctx, x, y, r, kind, theta, colour, o) {
    o = o || {};
    const B = BODIES[kind] || BODIES.disc;
    const col = colour || C.steel;
    const spherical = kind === 'sphere' || kind === 'shell';

    // cast shadow on the ground, if the caller gave us one
    if (o.groundY != null) {
      const gap = Math.max(0, o.groundY - (y + r));
      const k = Math.max(0, 1 - gap / (r * 2));
      ctx.save();
      if (RX.canFilter) ctx.filter = 'blur(' + (r * 0.22).toFixed(1) + 'px)';
      ctx.fillStyle = 'rgba(0,0,0,' + (0.45 * k) + ')';
      ctx.beginPath();
      ctx.ellipse(x + r * 0.10, o.groundY + r * 0.06, r * (0.95 - 0.2 * (1 - k)), r * 0.16, 0, 0, TAU);
      ctx.fill(); ctx.restore(); ctx.filter = 'none';
    }

    RX.ball(ctx, x, y, r, col, { rim: spherical ? 0.8 : 0.5, sub: spherical ? 0.5 : 0.2 });

    ctx.save();
    ctx.beginPath(); ctx.arc(x, y, r * 0.995, 0, TAU); ctx.clip();
    ctx.translate(x, y); ctx.rotate(theta || 0);

    if (B.hollow) {
      // a hollow body is drawn hollow: the bore is dark, and its far wall
      // catches the light from inside
      const ri = r * B.hollow;
      const hg = ctx.createRadialGradient(-ri * L.x * .4, -ri * L.y * .4, ri * .05, 0, 0, ri);
      hg.addColorStop(0, '#05080F');
      hg.addColorStop(.74, '#080D18');
      hg.addColorStop(1, rgba(mix(col, '#ffffff', .30), .85));
      ctx.fillStyle = hg;
      ctx.beginPath(); ctx.arc(0, 0, ri, 0, TAU); ctx.fill();
      ctx.strokeStyle = rgba(mix(col, '#05080F', .70), .9);
      ctx.lineWidth = Math.max(1, r * 0.03);
      ctx.beginPath(); ctx.arc(0, 0, ri, 0, TAU); ctx.stroke();
    }

    // spokes / meridians — the rotation marker
    const n = spherical ? 6 : 8;
    ctx.strokeStyle = rgba(mix(col, '#05080F', .62), .75);
    ctx.lineWidth = Math.max(1, r * 0.035);
    for (let i = 0; i < n; i++) {
      const a = i / n * TAU;
      if (spherical) {
        // meridians of a sphere seen from the side: ellipses of varying width
        const sq = Math.cos(a);
        ctx.beginPath();
        ctx.ellipse(0, 0, Math.abs(r * 0.94 * sq), r * 0.94, 0, 0, TAU);
        ctx.stroke();
      } else {
        ctx.beginPath();
        ctx.moveTo(Math.cos(a) * r * (B.hollow || 0.06), Math.sin(a) * r * (B.hollow || 0.06));
        ctx.lineTo(Math.cos(a) * r * 0.96, Math.sin(a) * r * 0.96);
        ctx.stroke();
      }
    }
    // one bright reference mark, so a single revolution is countable
    ctx.fillStyle = '#FFD36B';
    ctx.beginPath();
    ctx.arc(r * (B.hollow ? (B.hollow + 1) / 2 : 0.66), 0, Math.max(1.6, r * 0.075), 0, TAU);
    ctx.fill();
    ctx.restore();

    // rim
    ctx.strokeStyle = rgba(mix(col, '#05080F', .72), .95);
    ctx.lineWidth = Math.max(1.2, r * 0.045);
    ctx.beginPath(); ctx.arc(x, y, r, 0, TAU); ctx.stroke();
    return { k: B.k, name: B.name };
  }

  /* =====================================================================
     SPRING — a real helix with the pitch you asked for, compressed and
     stretched by the caller. Drawn as a lit tube so the coils overlap
     correctly instead of reading as a zig-zag.
     ===================================================================== */
  function spring(ctx, x0, y0, x1, y1, coils, radius, colour, o) {
    o = o || {};
    const dx = x1 - x0, dy = y1 - y0, len = Math.hypot(dx, dy);
    if (len < 2) return;
    const ux = dx / len, uy = dy / len, nx = -uy, ny = ux;
    const lead = Math.min(o.lead == null ? len * 0.10 : o.lead, len * 0.3);
    const span = len - lead * 2;
    const n = Math.max(24, Math.round(coils * 14));
    const pts = [[x0, y0], [x0 + ux * lead, y0 + uy * lead]];
    for (let i = 0; i <= n; i++) {
      const t = i / n;
      const s = lead + t * span;
      const ph = t * coils * TAU;
      pts.push([x0 + ux * s + nx * Math.sin(ph) * radius,
                y0 + uy * s + ny * Math.sin(ph) * radius * 0.92]);
    }
    pts.push([x1 - ux * lead, y1 - uy * lead], [x1, y1]);
    RX.tube(ctx, pts, o.wire || Math.max(1.4, radius * 0.16), colour || C.steel,
            { shadow: o.shadow !== false });
  }

  /* =====================================================================
     GROUND / INCLINE — a hatched surface with a lit top edge. The hatching
     is the standard engineering convention and it tells the student
     instantly which side is solid.
     ===================================================================== */
  function surface(ctx, x0, y0, x1, y1, depth, colour, o) {
    o = o || {};
    const dx = x1 - x0, dy = y1 - y0, len = Math.hypot(dx, dy) || 1;
    const nx = dy / len, ny = -dx / len;        // into the solid
    const col = colour || '#3A4766';
    const path = c => {
      c.beginPath();
      c.moveTo(x0, y0); c.lineTo(x1, y1);
      c.lineTo(x1 - nx * depth, y1 - ny * depth);
      c.lineTo(x0 - nx * depth, y0 - ny * depth);
      c.closePath();
    };
    RX.volume(ctx, path, { fill: col, r: Math.abs(depth), cx: (x0 + x1) / 2 - nx * depth * 0.5,
                           cy: (y0 + y1) / 2 - ny * depth * 0.5,
                           stipple: 0.7, grain: '#161E33', gloss: 0.12, contour: 0 });
    ctx.save(); path(ctx); ctx.clip();
    ctx.strokeStyle = rgba('#8FA4CE', .28); ctx.lineWidth = 1;
    const step = Math.max(9, Math.abs(depth) * 0.55);
    const ext = Math.abs(depth) * 2;
    for (let s = -ext; s < len + ext; s += step) {
      ctx.beginPath();
      ctx.moveTo(x0 + dx / len * s, y0 + dy / len * s);
      ctx.lineTo(x0 + dx / len * (s + depth * 1.1) - nx * depth * 1.1,
                 y0 + dy / len * (s + depth * 1.1) - ny * depth * 1.1);
      ctx.stroke();
    }
    ctx.restore();
    // the contact surface itself catches the light
    ctx.strokeStyle = rgba('#C9D4EA', .55); ctx.lineWidth = 1.8;
    ctx.beginPath(); ctx.moveTo(x0, y0); ctx.lineTo(x1, y1); ctx.stroke();
  }

  /* =====================================================================
     CHARGE — a lit bead with its sign cut into it, and the glow that says
     how strong it is.
     ===================================================================== */
  function charge(ctx, x, y, r, q, o) {
    o = o || {};
    const pos = q >= 0;
    const col = pos ? C.charge_p : C.charge_n;
    if (o.glow !== false) {
      ctx.save(); ctx.globalCompositeOperation = 'lighter';
      const gg = ctx.createRadialGradient(x, y, 0, x, y, r * 3.4);
      gg.addColorStop(0, rgba(col, .30 * Math.min(1, Math.abs(q))));
      gg.addColorStop(1, rgba(col, 0));
      ctx.fillStyle = gg;
      ctx.beginPath(); ctx.arc(x, y, r * 3.4, 0, TAU); ctx.fill();
      ctx.restore();
    }
    RX.ball(ctx, x, y, r, col, { rim: 0.8, sub: 0.5 });
    ctx.strokeStyle = 'rgba(255,255,255,.95)';
    ctx.lineWidth = Math.max(1.6, r * 0.26); ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(x - r * 0.46, y); ctx.lineTo(x + r * 0.46, y);
    if (pos) { ctx.moveTo(x, y - r * 0.46); ctx.lineTo(x, y + r * 0.46); }
    ctx.stroke();
  }

  /* =====================================================================
     CIRCUIT ELEMENTS — components, not symbols. Each returns its two
     terminals so the caller can wire them without measuring by hand.
     ===================================================================== */
  function wire(ctx, pts, colour, o) {
    o = o || {};
    RX.tube(ctx, pts, o.r || 2.6, colour || C.wire, { vivid: false, shadow: o.shadow !== false });
  }

  function resistor(ctx, x, y, w, h, o) {
    o = o || {};
    const path = c => {
      c.beginPath();
      if (c.roundRect) c.roundRect(x - w / 2, y - h / 2, w, h, h * 0.22);
      else c.rect(x - w / 2, y - h / 2, w, h);
    };
    RX.volume(ctx, path, { fill: '#C6B394', r: h * 0.8, cx: x, cy: y,
                           gloss: 0.3, contour: Math.max(1, h * 0.06) });
    ctx.save(); path(ctx); ctx.clip();
    // colour bands
    const bands = o.bands || ['#5A3A22', '#111722', '#C03A3A', '#D9A441'];
    bands.forEach((bc, i) => {
      ctx.fillStyle = bc;
      ctx.fillRect(x - w * 0.30 + i * w * 0.17, y - h / 2, w * 0.075, h);
    });
    ctx.restore();
    return [[x - w / 2, y], [x + w / 2, y]];
  }

  /* A DC cell, drawn as an object rather than the two-bar symbol: a
     moulded body with the long (+) and short (−) plates standing out of
     it. Returns the two terminal points so a circuit can wire to them.
     `n` draws a battery of n cells in series.                        */
  function cell(ctx, x, y, w, h, o) {
    o = o || {};
    const n = o.n || 1, cw = w / n;
    for (let k = 0; k < n; k++) {
      const cx = x - w / 2 + cw * (k + 0.5);
      const bw = cw * 0.52, bh = h;
      const path = c => {
        c.beginPath();
        if (c.roundRect) c.roundRect(cx - bw / 2, y - bh / 2, bw, bh, bh * 0.16);
        else c.rect(cx - bw / 2, y - bh / 2, bw, bh);
      };
      RX.volume(ctx, path, { fill: o.fill || '#2E3A55', r: bh * 0.8, cx: cx, cy: y,
                             gloss: 0.34, contour: Math.max(1, bh * 0.05) });
      // the plates: long = +, short = −
      const px = cx + bw * 0.42;
      ctx.fillStyle = C.brass;
      ctx.fillRect(px - 1.4, y - bh * 0.60, 2.8, bh * 1.20);        // long, +
      ctx.fillStyle = rgba(C.steel, .95);
      ctx.fillRect(cx - bw * 0.42 - 1.4, y - bh * 0.28, 2.8, bh * 0.56);  // short, −
    }
    if (o.label !== false) {
      lbl(ctx, x - w / 2 - 7, y - h * 0.55, '−', rgba(C.steel, .95), 'center', 12);
      lbl(ctx, x + w / 2 + 7, y - h * 0.55, '+', C.brass, 'center', 12);
    }
    return [[x - w / 2 - cw * 0.06, y], [x + w / 2 + cw * 0.06, y]];
  }

  /* A moving-coil galvanometer. `frac` is the deflection as a fraction of
     full scale, signed — a centre-zero instrument, which is what a bridge
     null detector actually is. The needle is drawn from the real value, so
     a balanced bridge shows a needle that genuinely does not move.     */
  function galvo(ctx, cx, cy, R, frac, o) {
    o = o || {};
    const fg = ctx.createRadialGradient(cx, cy - R * 0.3, R * 0.05, cx, cy, R);
    fg.addColorStop(0, '#1C2740'); fg.addColorStop(1, '#0C1220');
    ctx.fillStyle = fg;
    ctx.beginPath(); ctx.arc(cx, cy, R, 0, TAU); ctx.fill();
    ctx.strokeStyle = rgba(C.steel, .55); ctx.lineWidth = 1.4;
    ctx.beginPath(); ctx.arc(cx, cy, R, 0, TAU); ctx.stroke();

    // the scale: centre zero, ticks either side
    const span = 1.05;                                   // radians either side of up
    ctx.strokeStyle = rgba('#8FA4CE', .55);
    for (let i = -5; i <= 5; i++) {
      const a = -Math.PI / 2 + (i / 5) * span, big = i === 0 || Math.abs(i) === 5;
      const r0 = R * (big ? 0.62 : 0.70), r1 = R * 0.80;
      ctx.lineWidth = big ? 1.5 : 1;
      ctx.beginPath();
      ctx.moveTo(cx + Math.cos(a) * r0, cy + Math.sin(a) * r0);
      ctx.lineTo(cx + Math.cos(a) * r1, cy + Math.sin(a) * r1);
      ctx.stroke();
    }
    lbl(ctx, cx, cy + R * 0.46, o.tag || 'G', rgba('#8FA4CE', .9), 'center', R * 0.30);

    // the needle
    const f = Math.max(-1, Math.min(1, frac || 0));
    const a = -Math.PI / 2 + f * span;
    const nulled = Math.abs(f) < 0.004;
    ctx.strokeStyle = nulled ? '#4ADE80' : '#FF6B6B';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(cx - Math.cos(a) * R * 0.14, cy - Math.sin(a) * R * 0.14);
    ctx.lineTo(cx + Math.cos(a) * R * 0.74, cy + Math.sin(a) * R * 0.74);
    ctx.stroke();
    ctx.fillStyle = rgba(C.brass, .95);
    ctx.beginPath(); ctx.arc(cx, cy, R * 0.09, 0, TAU); ctx.fill();
    if (nulled) {
      ctx.save(); ctx.globalCompositeOperation = 'lighter';
      const gg = ctx.createRadialGradient(cx, cy, 0, cx, cy, R * 1.25);
      gg.addColorStop(0, rgba('#4ADE80', .32)); gg.addColorStop(1, rgba('#4ADE80', 0));
      ctx.fillStyle = gg;
      ctx.beginPath(); ctx.arc(cx, cy, R * 1.25, 0, TAU); ctx.fill();
      ctx.restore();
    }
    return nulled;
  }

  function inductor(ctx, x, y, w, h, o) {
    o = o || {};
    // a coil wound on a core, seen from the side
    const n = o.turns || 7, r = h * 0.44;
    ctx.save();
    RX.tube(ctx, [[x - w / 2, y], [x + w / 2, y]], h * 0.16, '#3E4A63',
            { vivid: false });                                   // the core
    for (let i = 0; i < n; i++) {
      const cxx = x - w / 2 + (i + 0.5) / n * w;
      const pts = [];
      for (let k = 0; k <= 16; k++) {
        const a = -Math.PI * 0.12 + k / 16 * (Math.PI * 1.24);
        pts.push([cxx + Math.cos(a) * w / n * 0.42, y - Math.sin(a) * r]);
      }
      RX.tube(ctx, pts, Math.max(1.2, h * 0.075), C.copper, { vivid: false });
    }
    ctx.restore();
    return [[x - w / 2, y], [x + w / 2, y]];
  }

  function capacitor(ctx, x, y, w, h, o) {
    o = o || {};
    const gap = o.gap || w * 0.22, pw = Math.max(2.5, w * 0.10);
    [-1, 1].forEach(sg => {
      const px = x + sg * gap / 2;
      const path = c => {
        c.beginPath();
        if (c.roundRect) c.roundRect(px - pw / 2, y - h / 2, pw, h, pw * 0.3);
        else c.rect(px - pw / 2, y - h / 2, pw, h);
      };
      RX.volume(ctx, path, { fill: C.steel, r: h * 0.5, cx: px, cy: y,
                             gloss: 0.4, contour: 1 });
    });
    // the field between the plates, and the charge that made it
    if (o.charge) {
      const k = Math.max(-1, Math.min(1, o.charge));
      ctx.save(); ctx.globalCompositeOperation = 'lighter';
      const fg = ctx.createLinearGradient(x - gap / 2, y, x + gap / 2, y);
      const fc = k >= 0 ? C.charge_p : C.charge_n;
      fg.addColorStop(0, rgba(fc, 0));
      fg.addColorStop(.5, rgba(fc, .40 * Math.abs(k)));
      fg.addColorStop(1, rgba(fc, 0));
      ctx.fillStyle = fg;
      ctx.fillRect(x - gap / 2, y - h / 2, gap, h);
      ctx.restore();
    }
    return [[x - gap / 2 - pw, y], [x + gap / 2 + pw, y]];
  }

  function acSource(ctx, x, y, r, phase, o) {
    o = o || {};
    RX.ball(ctx, x, y, r, '#2E3A55', { rim: 0.7 });
    ctx.save();
    ctx.beginPath(); ctx.arc(x, y, r * 0.96, 0, TAU); ctx.clip();
    ctx.strokeStyle = o.colour || '#FFD36B';
    ctx.lineWidth = Math.max(1.6, r * 0.11); ctx.lineCap = 'round';
    ctx.beginPath();
    for (let i = 0; i <= 40; i++) {
      const t = i / 40;
      const px = x - r * 0.62 + t * r * 1.24;
      const py = y - Math.sin(t * TAU + (phase || 0)) * r * 0.40;
      i ? ctx.lineTo(px, py) : ctx.moveTo(px, py);
    }
    ctx.stroke();
    ctx.restore();
    ctx.strokeStyle = rgba('#8FA4CE', .8); ctx.lineWidth = 1.4;
    ctx.beginPath(); ctx.arc(x, y, r, 0, TAU); ctx.stroke();
    return [[x - r, y], [x + r, y]];
  }

  /* =====================================================================
     PHASOR DIAL — the rotating-vector picture, with the projection that
     generates the waveform drawn as a real dropped line.
     ===================================================================== */
  function phasorDial(ctx, cx, cy, R, arms, o) {
    o = o || {};
    // face — a flat instrument dial. The volume shader would make this read
    // as a sphere, which is exactly the wrong object.
    const fg = ctx.createRadialGradient(cx, cy, R * 0.05, cx, cy, R);
    fg.addColorStop(0, '#111a2b');
    fg.addColorStop(0.82, '#0C1322');
    fg.addColorStop(1, '#1B2740');
    ctx.fillStyle = fg;
    ctx.beginPath(); ctx.arc(cx, cy, R, 0, TAU); ctx.fill();
    ctx.strokeStyle = rgba('#63729A', .85); ctx.lineWidth = 1.6;
    ctx.beginPath(); ctx.arc(cx, cy, R, 0, TAU); ctx.stroke();
    ctx.strokeStyle = 'rgba(255,255,255,.10)'; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.arc(cx, cy, R - 2.5, 0, TAU); ctx.stroke();
    ctx.save();
    ctx.beginPath(); ctx.arc(cx, cy, R, 0, TAU); ctx.clip();
    ctx.strokeStyle = rgba('#63729A', .30); ctx.lineWidth = 1;
    for (let i = 0; i < 12; i++) {
      const a = i / 12 * TAU;
      ctx.beginPath();
      ctx.moveTo(cx + Math.cos(a) * R * 0.86, cy + Math.sin(a) * R * 0.86);
      ctx.lineTo(cx + Math.cos(a) * R * 0.97, cy + Math.sin(a) * R * 0.97);
      ctx.stroke();
    }
    ctx.strokeStyle = rgba('#63729A', .45); ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(cx - R, cy); ctx.lineTo(cx + R, cy); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(cx, cy - R); ctx.lineTo(cx, cy + R); ctx.stroke();
    ctx.restore();
    arms.forEach(a => {
      if (a.mag <= 0.001) return;
      const ex = cx + Math.cos(a.ang) * R * a.mag, ey = cy + Math.sin(a.ang) * R * a.mag;
      vector(ctx, cx, cy, ex, ey, a.colour, { width: a.width || 3, shadow: false });
      if (a.label) {
        // captions pushed out by different amounts, so two phasors that lie on
        // top of each other do not put their labels there too
        const off = a.labelOff == null ? 13 : a.labelOff;
        lbl(ctx, ex + Math.cos(a.ang) * off, ey + Math.sin(a.ang) * off,
            a.label, a.colour, 'center', 9);
      }
      if (a.project) {
        ctx.save(); ctx.setLineDash([3, 3]);
        ctx.strokeStyle = rgba(a.colour, .55); ctx.lineWidth = 1;
        ctx.beginPath(); ctx.moveTo(ex, ey); ctx.lineTo(ex, cy); ctx.stroke();
        ctx.restore();
      }
    });
  }

  /* =====================================================================
     PHOTO-CELL — an evacuated glass envelope with an emissive cathode and
     a collecting anode. The glass is drawn as glass: a bright rim, a dark
     interior and a specular streak.
     ===================================================================== */
  function photocell(ctx, x, y, w, h, o) {
    o = o || {};
    const path = c => {
      c.beginPath();
      if (c.roundRect) c.roundRect(x - w / 2, y - h / 2, w, h, Math.min(w, h) * 0.30);
      else c.rect(x - w / 2, y - h / 2, w, h);
    };
    // the vacuum inside
    ctx.save(); path(ctx);
    const vg = ctx.createRadialGradient(x - w * .2, y - h * .25, h * .05, x, y, Math.max(w, h) * .7);
    vg.addColorStop(0, '#0E1726'); vg.addColorStop(1, '#05080F');
    ctx.fillStyle = vg; ctx.fill(); ctx.restore();
    // the envelope
    ctx.save(); path(ctx);
    ctx.strokeStyle = rgba(C.glass, .55); ctx.lineWidth = Math.max(2, h * 0.018);
    ctx.stroke();
    ctx.strokeStyle = 'rgba(255,255,255,.30)'; ctx.lineWidth = Math.max(1, h * 0.010);
    ctx.stroke(); ctx.restore();
    // specular streak on the glass
    ctx.save(); path(ctx); ctx.clip();
    const sg = ctx.createLinearGradient(x - w * .5, y - h * .5, x - w * .1, y + h * .5);
    sg.addColorStop(0, 'rgba(255,255,255,.14)');
    sg.addColorStop(.5, 'rgba(255,255,255,.03)');
    sg.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = sg; ctx.fillRect(x - w / 2, y - h / 2, w, h);
    ctx.restore();
    return path;
  }

  /* an emissive plate: a metal surface that can be made to glow */
  function plate(ctx, x, y, w, h, colour, glow) {
    const path = c => {
      c.beginPath();
      if (c.roundRect) c.roundRect(x - w / 2, y - h / 2, w, h, Math.min(w, h) * 0.25);
      else c.rect(x - w / 2, y - h / 2, w, h);
    };
    if (glow > 0.01) {
      ctx.save(); ctx.globalCompositeOperation = 'lighter';
      const gg = ctx.createRadialGradient(x, y, 0, x, y, Math.max(w, h) * 1.1);
      gg.addColorStop(0, rgba(colour, .34 * glow));
      gg.addColorStop(1, rgba(colour, 0));
      ctx.fillStyle = gg;
      ctx.beginPath(); ctx.arc(x, y, Math.max(w, h) * 1.1, 0, TAU); ctx.fill();
      ctx.restore();
    }
    RX.volume(ctx, path, { fill: colour, r: Math.max(w, h) * 0.5, cx: x, cy: y,
                           gloss: 0.42, contour: Math.max(1, Math.min(w, h) * 0.06) });
    return path;
  }

  /* =====================================================================
     A BEAM OF LIGHT — a lit cone with a wavelength colour, so a change of
     frequency is visible before any number is read.
     ===================================================================== */
  function beam(ctx, x0, y0, x1, y1, width, colour, intensity) {
    const dx = x1 - x0, dy = y1 - y0, len = Math.hypot(dx, dy) || 1;
    const nx = -dy / len, ny = dx / len;
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    const lg = ctx.createLinearGradient(x0, y0, x1, y1);
    lg.addColorStop(0, rgba(colour, .10 + .40 * intensity));
    lg.addColorStop(1, rgba(colour, .04 + .22 * intensity));
    ctx.fillStyle = lg;
    ctx.beginPath();
    ctx.moveTo(x0 + nx * width * .35, y0 + ny * width * .35);
    ctx.lineTo(x1 + nx * width, y1 + ny * width);
    ctx.lineTo(x1 - nx * width, y1 - ny * width);
    ctx.lineTo(x0 - nx * width * .35, y0 - ny * width * .35);
    ctx.closePath(); ctx.fill();
    ctx.restore();
  }

  /* wavelength (nm) -> the colour the eye actually sees, so 400 nm is
     violet and 700 nm is deep red rather than an arbitrary ramp */
  function nmColour(nm) {
    let r = 0, g = 0, b = 0;
    if (nm < 380) { r = .35; g = 0; b = .55; }
    else if (nm < 440) { r = -(nm - 440) / 60; b = 1; }
    else if (nm < 490) { g = (nm - 440) / 50; b = 1; }
    else if (nm < 510) { g = 1; b = -(nm - 510) / 20; }
    else if (nm < 580) { r = (nm - 510) / 70; g = 1; }
    else if (nm < 645) { r = 1; g = -(nm - 645) / 65; }
    else if (nm <= 780) { r = 1; }
    else { r = .55; }
    let f = 1;
    if (nm > 700) f = .3 + .7 * (780 - nm) / 80;
    else if (nm < 420) f = .3 + .7 * (nm - 330) / 90;
    f = Math.max(.25, Math.min(1, f));
    const q = v => ('0' + Math.round(Math.max(0, Math.min(1, v * f)) * 255).toString(16)).slice(-2);
    return '#' + q(r) + q(g) + q(b);
  }

  window.PHYSART = {
    lbl, leader, vector, body, BODIES, spring, surface, charge,
    wire, resistor, cell, galvo, inductor, capacitor, acSource, phasorDial,
    photocell, plate, beam, nmColour, C, mix, rgba
  };
})();
