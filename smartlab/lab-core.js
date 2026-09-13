/* ============================================================
   INSIGHT SMART LAB — core framework  (v2)
   Shell, sim registry, numerics, 3D projection, plotting,
   hover inspection, data logging, self-check quizzes.
   No external dependencies.
   ============================================================ */
window.InsightLab = (function () {
  'use strict';

  /* ---------------- numerics ---------------- */
  const clamp = (v, a, b) => v < a ? a : v > b ? b : v;
  const lerp = (a, b, t) => a + (b - a) * t;
  const TAU = Math.PI * 2;

  function rk4(y, t, dt, f) {
    const n = y.length;
    const k1 = new Float64Array(n), k2 = new Float64Array(n),
          k3 = new Float64Array(n), k4 = new Float64Array(n), tmp = new Float64Array(n);
    f(t, y, k1);
    for (let i = 0; i < n; i++) tmp[i] = y[i] + dt / 2 * k1[i];
    f(t + dt / 2, tmp, k2);
    for (let i = 0; i < n; i++) tmp[i] = y[i] + dt / 2 * k2[i];
    f(t + dt / 2, tmp, k3);
    for (let i = 0; i < n; i++) tmp[i] = y[i] + dt * k3[i];
    f(t + dt, tmp, k4);
    for (let i = 0; i < n; i++) y[i] += dt / 6 * (k1[i] + 2 * k2[i] + 2 * k3[i] + k4[i]);
    return y;
  }

  /* ---------------- formatting ---------------- */
  const SUP = { '-': '−', '0': '⁰', '1': '¹', '2': '²', '3': '³',
    '4': '⁴', '5': '⁵', '6': '⁶', '7': '⁷', '8': '⁸', '9': '⁹' };
  const supStr = s => String(s).split('').map(c => SUP[c] || c).join('');

  function fmt(v, sig) {
    sig = sig || 3;
    if (!isFinite(v)) return '—';
    if (v === 0) return '0';
    const a = Math.abs(v);
    if (a >= 1e5 || a < 1e-3) {
      const e = Math.floor(Math.log10(a));
      return (v / Math.pow(10, e)).toFixed(sig - 1) + '×10' + supStr(e);
    }
    return v.toFixed(Math.min(Math.max(0, sig - 1 - Math.floor(Math.log10(a))), 4));
  }
  const fixed = (v, d) => (isFinite(v) ? v.toFixed(d) : '—');

  /* ---------------- equation markup ---------------- */
  const E = {
    n: (v, unit, sig) => '<span class="num">' + (typeof v === 'string' ? v : fmt(v, sig)) + '</span>' +
      (unit ? '<span class="unit">' + unit + '</span>' : ''),
    v: s => '<i>' + s + '</i>',
    op: s => '<span class="op">' + s + '</span>',
    frac: (a, b) => '<span class="frac"><span>' + a + '</span><span>' + b + '</span></span>',
    sub: s => '<sub>' + s + '</sub>',
    sup: s => '<sup>' + s + '</sup>'
  };

  /* ---------------- theme ---------------- */
  const theme = {};
  function readTheme() {
    const cs = getComputedStyle(document.documentElement);
    ['text', 'text-2', 'text-3', 'accent', 'line', 'line-soft', 'ink-950', 'ink-900',
     'ink-850', 'ink-800', 'ink-750', 'ink-700', 'phys', 'chem', 'bio', 'ok', 'warn', 'crit'].forEach(k => {
      theme[k] = cs.getPropertyValue('--' + k).trim();
    });
  }
  function alpha(hex, a) {
    hex = (hex || '#141D2E').trim();
    if (hex[0] !== '#') return hex;
    if (hex.length === 4) hex = '#' + hex[1] + hex[1] + hex[2] + hex[2] + hex[3] + hex[3];
    const n = parseInt(hex.slice(1), 16);
    return 'rgba(' + (n >> 16 & 255) + ',' + (n >> 8 & 255) + ',' + (n & 255) + ',' + a + ')';
  }
  function mix(h1, h2, t) {
    const p = h => { let x = h.trim(); if (x.length === 4) x = '#' + x[1] + x[1] + x[2] + x[2] + x[3] + x[3];
      const n = parseInt(x.slice(1), 16); return [n >> 16 & 255, n >> 8 & 255, n & 255]; };
    const a = p(h1), b = p(h2);
    return 'rgb(' + Math.round(lerp(a[0], b[0], t)) + ',' + Math.round(lerp(a[1], b[1], t)) +
      ',' + Math.round(lerp(a[2], b[2], t)) + ')';
  }

  /* ---------------- 3D camera (Z-up) ---------------- */
  function Camera(opts) {
    const c = Object.assign({ theta: -0.9, phi: 0.42, dist: 3.2, target: [0, 0, 0], fov: 1.0 }, opts);
    c.home = { theta: c.theta, phi: c.phi, dist: c.dist };
    c.setViewport = function (w, h) { c._w = w; c._h = h; c._k = Math.min(w, h) / (2 * Math.tan(c.fov / 2)); };
    c.update = function () {
      const cp = Math.cos(c.phi), sp = Math.sin(c.phi);
      const ct = Math.cos(c.theta), st = Math.sin(c.theta);
      const d = [cp * ct, cp * st, sp];
      c.eye = [c.target[0] + c.dist * d[0], c.target[1] + c.dist * d[1], c.target[2] + c.dist * d[2]];
      const f = [-d[0], -d[1], -d[2]];
      let rx = f[1], ry = -f[0], rz = 0;
      const rl = Math.hypot(rx, ry, rz) || 1;
      rx /= rl; ry /= rl; rz /= rl;
      const ux = ry * f[2] - rz * f[1], uy = rz * f[0] - rx * f[2], uz = rx * f[1] - ry * f[0];
      c.f = f; c.r = [rx, ry, rz]; c.u = [ux, uy, uz];
      return c;
    };
    c.project = function (p) {
      const vx = p[0] - c.eye[0], vy = p[1] - c.eye[1], vz = p[2] - c.eye[2];
      const cz = vx * c.f[0] + vy * c.f[1] + vz * c.f[2];
      if (cz < 0.02) return { ok: false, x: 0, y: 0, z: cz, s: 0 };
      const cx = vx * c.r[0] + vy * c.r[1] + vz * c.r[2];
      const cy = vx * c.u[0] + vy * c.u[1] + vz * c.u[2];
      return { ok: true, x: c._w / 2 + cx / cz * c._k, y: c._h / 2 - cy / cz * c._k, z: cz, s: c._k / cz };
    };
    c.reset = function () { c.theta = c.home.theta; c.phi = c.home.phi; c.dist = c.home.dist; };
    return c;
  }

  /* ---------------- plotting ---------------- */
  function niceTicks(min, max, count) {
    count = count || 5;
    const span = max - min;
    if (!(span > 0)) return [min];
    const mag = Math.pow(10, Math.floor(Math.log10(span / count)));
    const norm = (span / count) / mag;
    const step = (norm < 1.5 ? 1 : norm < 3 ? 2 : norm < 7 ? 5 : 10) * mag;
    const out = [];
    for (let v = Math.ceil(min / step) * step; v <= max + step * 1e-6; v += step)
      out.push(Math.abs(v) < step * 1e-6 ? 0 : v);
    return out;
  }

  function Plot(ctx, w, h, cfg) {
    const pad = Object.assign({ l: 50, r: 16, t: 14, b: 30 }, cfg.pad);
    const P = { ctx, w, h, cfg, pad, x0: pad.l, x1: w - pad.r, y0: h - pad.b, y1: pad.t };
    P.X = v => P.x0 + (v - cfg.xmin) / (cfg.xmax - cfg.xmin) * (P.x1 - P.x0);
    P.Y = v => P.y0 + (v - cfg.ymin) / (cfg.ymax - cfg.ymin) * (P.y1 - P.y0);
    P.invX = px => cfg.xmin + (px - P.x0) / (P.x1 - P.x0) * (cfg.xmax - cfg.xmin);
    P.invY = py => cfg.ymin + (py - P.y0) / (P.y1 - P.y0) * (cfg.ymax - cfg.ymin);
    P.inside = (px, py) => px >= P.x0 && px <= P.x1 && py <= P.y0 && py >= P.y1;

    P.frame = function () {
      ctx.clearRect(0, 0, w, h);
      const xt = cfg.xticks || niceTicks(cfg.xmin, cfg.xmax, 6);
      const yt = cfg.yticks || niceTicks(cfg.ymin, cfg.ymax, 4);
      ctx.lineWidth = 1;
      ctx.strokeStyle = alpha(theme['line-soft'], 0.85);
      ctx.beginPath();
      xt.forEach(v => { const x = Math.round(P.X(v)) + 0.5; ctx.moveTo(x, P.y1); ctx.lineTo(x, P.y0); });
      yt.forEach(v => { const y = Math.round(P.Y(v)) + 0.5; ctx.moveTo(P.x0, y); ctx.lineTo(P.x1, y); });
      ctx.stroke();
      ctx.strokeStyle = alpha(theme.line, 1);
      ctx.beginPath();
      ctx.moveTo(P.x0 + .5, P.y1); ctx.lineTo(P.x0 + .5, P.y0 + .5); ctx.lineTo(P.x1, P.y0 + .5);
      ctx.stroke();
      ctx.fillStyle = theme['text-3'];
      ctx.font = '10px "IBM Plex Mono",monospace';
      ctx.textAlign = 'center'; ctx.textBaseline = 'top';
      const fx = cfg.xfmt || (v => fmt(v, 3));
      xt.forEach(v => { if (v >= cfg.xmin - 1e-9 && v <= cfg.xmax + 1e-9) ctx.fillText(fx(v), P.X(v), P.y0 + 6); });
      ctx.textAlign = 'right'; ctx.textBaseline = 'middle';
      const fy = cfg.yfmt || (v => fmt(v, 3));
      yt.forEach(v => { if (v >= cfg.ymin - 1e-9 && v <= cfg.ymax + 1e-9) ctx.fillText(fy(v), P.x0 - 7, P.Y(v)); });
      ctx.fillStyle = theme['text-2'];
      if (cfg.xlabel) { ctx.textAlign = 'right'; ctx.textBaseline = 'bottom'; ctx.fillText(cfg.xlabel, P.x1, h - 2); }
      if (cfg.ylabel) {
        ctx.save(); ctx.translate(11, P.y1 + 2); ctx.rotate(-Math.PI / 2);
        ctx.textAlign = 'right'; ctx.textBaseline = 'top'; ctx.fillText(cfg.ylabel, 0, 0); ctx.restore();
      }
      return P;
    };
    P.clip = function (fn) {
      ctx.save(); ctx.beginPath();
      ctx.rect(P.x0, P.y1, P.x1 - P.x0, P.y0 - P.y1); ctx.clip();
      fn(); ctx.restore();
    };
    P.line = function (pts, color, width, dash) {
      if (!pts || pts.length < 2) return;
      ctx.save();
      ctx.lineWidth = width || 2; ctx.strokeStyle = color;
      ctx.lineJoin = 'round'; ctx.lineCap = 'round';
      if (dash) ctx.setLineDash(dash);
      ctx.beginPath();
      for (let i = 0; i < pts.length; i++) {
        const x = P.X(pts[i][0]), y = P.Y(pts[i][1]);
        i ? ctx.lineTo(x, y) : ctx.moveTo(x, y);
      }
      ctx.stroke(); ctx.restore();
    };
    P.area = function (pts, base, color) {
      if (!pts || pts.length < 2) return;
      ctx.save(); ctx.fillStyle = color; ctx.beginPath();
      ctx.moveTo(P.X(pts[0][0]), P.Y(base));
      for (let i = 0; i < pts.length; i++) ctx.lineTo(P.X(pts[i][0]), P.Y(pts[i][1]));
      ctx.lineTo(P.X(pts[pts.length - 1][0]), P.Y(base));
      ctx.closePath(); ctx.fill(); ctx.restore();
    };
    P.bar = function (x, y, halfW, base, color) {
      ctx.save(); ctx.fillStyle = color;
      const xa = P.X(x - halfW), xb = P.X(x + halfW), yb = P.Y(base), yy = P.Y(y);
      ctx.fillRect(xa + 1, Math.min(yy, yb), Math.max(1, xb - xa - 2), Math.abs(yb - yy));
      ctx.restore();
    };
    P.dot = function (x, y, r, color, ring) {
      ctx.save();
      if (ring) { ctx.fillStyle = ring; ctx.beginPath(); ctx.arc(P.X(x), P.Y(y), r + 2, 0, TAU); ctx.fill(); }
      ctx.fillStyle = color; ctx.beginPath(); ctx.arc(P.X(x), P.Y(y), r, 0, TAU); ctx.fill(); ctx.restore();
    };
    P.vline = function (v, color, dash) {
      ctx.save(); ctx.strokeStyle = color; ctx.lineWidth = 1.5;
      if (dash) ctx.setLineDash(dash);
      ctx.beginPath(); ctx.moveTo(P.X(v), P.y1); ctx.lineTo(P.X(v), P.y0); ctx.stroke(); ctx.restore();
    };
    P.hline = function (v, color, dash) {
      ctx.save(); ctx.strokeStyle = color; ctx.lineWidth = 1.5;
      if (dash) ctx.setLineDash(dash);
      ctx.beginPath(); ctx.moveTo(P.x0, P.Y(v)); ctx.lineTo(P.x1, P.Y(v)); ctx.stroke(); ctx.restore();
    };
    P.tag = function (x, y, text, color, align, dy) {
      ctx.save();
      ctx.font = '500 10px "IBM Plex Mono",monospace';
      ctx.fillStyle = color; ctx.textAlign = align || 'left'; ctx.textBaseline = 'middle';
      ctx.fillText(text, P.X(x) + (align === 'right' ? -5 : 5), P.Y(y) + (dy || 0));
      ctx.restore();
    };
    return P;
  }

  /* =====================================================================
     STAGE GRAPHICS TOOLKIT
     Ten layers of rendering quality, applied by the engine so that every
     simulation gets them without touching its own drawing code:
       1  instrument ground — vignette and a recessive measurement grid
       2  bloom — a real threshold-and-blur pass over emissive content
       3  label kit — haloed labels that nudge apart instead of colliding
       4  colour ramps — perceptual sequential and diverging scales
       5  tweening — parameter changes ease instead of snapping
       6  materials — spheres, shadows and glass with consistent lighting
       7  hit targets — interactive elements advertise themselves on hover
       8  layout grid — stages place panels without magic numbers
       9  scale chrome — units, scale bars and a corner HUD
      10  quality tiers — everything degrades gracefully on slow hardware
     ===================================================================== */

  const FX = {
    quality: 1,            // 1 full, 0.5 reduced, 0 minimal — set by the frame timer
    frameCost: 0,
    bloomCanvas: null
  };

  /* ---- 4 · colour ramps ------------------------------------------------
     Sampled from perceptually even scales so that equal steps in the data
     look like equal steps on screen. */
  const RAMPS = {
    heat:     ['#0B1120', '#2A2F6B', '#6B3A8F', '#B8437A', '#F0714C', '#FFC24B', '#FFF6C8'],
    ice:      ['#06101F', '#123A5E', '#1E6F92', '#35A8B0', '#7FD8C4', '#D6F5EC'],
    diverge:  ['#3D6FB4', '#7FA8D8', '#C9D4EA', '#F2E3C0', '#E8955C', '#D6453F'],
    phosphor: ['#04121A', '#0A3A4A', '#12707F', '#3DD6F5', '#A8F0FF'],
    amber:    ['#170D04', '#4A2A08', '#8F5410', '#D98A1E', '#FFC24B', '#FFE9B0'],
    eosin:    ['#1A0710', '#4E1430', '#8E2551', '#D94A7C', '#FF9BC0', '#FFE0EC']
  };
  function ramp(name, t) {
    const c = RAMPS[name] || RAMPS.heat;
    const u = Math.max(0, Math.min(1, t)) * (c.length - 1);
    const i = Math.min(c.length - 2, Math.floor(u));
    return mix(c[i], c[i + 1], u - i);
  }

  /* ---- 5 · tweening ----------------------------------------------------
     Exponential easing toward a target, frame-rate independent. State is
     kept on the sim's own state object so a reset clears it. */
  function tween(S, key, target, tau, dt) {
    S._tw = S._tw || {};
    if (S._tw[key] === undefined || !isFinite(S._tw[key])) { S._tw[key] = target; return target; }
    const k = 1 - Math.exp(-(dt || 0.016) / Math.max(0.016, tau || 0.18));
    S._tw[key] += (target - S._tw[key]) * k;
    if (Math.abs(target - S._tw[key]) < 1e-6) S._tw[key] = target;
    return S._tw[key];
  }

  /* ---- 1 · instrument ground ------------------------------------------- */
  function drawGround(ctx, w, h) {
    // a faint measurement grid, recessive enough never to compete with data
    const step = Math.max(38, Math.min(w, h) / 14);
    ctx.save();
    ctx.strokeStyle = alpha(theme['line-soft'], 0.30);
    ctx.lineWidth = 1;
    ctx.beginPath();
    for (let x = step; x < w; x += step) { ctx.moveTo(Math.round(x) + .5, 0); ctx.lineTo(Math.round(x) + .5, h); }
    for (let y = step; y < h; y += step) { ctx.moveTo(0, Math.round(y) + .5); ctx.lineTo(w, Math.round(y) + .5); }
    ctx.stroke();
    // vignette: pulls the eye to the centre and hides the panel edge
    const vg = ctx.createRadialGradient(w / 2, h * 0.46, Math.min(w, h) * 0.22,
      w / 2, h * 0.46, Math.max(w, h) * 0.78);
    vg.addColorStop(0, 'rgba(0,0,0,0)');
    vg.addColorStop(1, 'rgba(0,0,0,0.55)');
    ctx.fillStyle = vg;
    ctx.fillRect(0, 0, w, h);
    ctx.restore();
  }

  /* ---- 2 · bloom -------------------------------------------------------
     Threshold the bright pixels, blur them and add the result back. This
     is what makes fields, orbitals and traces read as emissive rather
     than as flat coloured lines. */
  function bloom(ctx, w, h, strength) {
    if (FX.quality < 0.75 || !strength) return;
    let bc = FX.bloomCanvas;
    if (!bc) { bc = FX.bloomCanvas = document.createElement('canvas'); }
    const scale = 0.4;
    const bw = Math.max(2, Math.round(w * scale)), bh = Math.max(2, Math.round(h * scale));
    if (bc.width !== bw || bc.height !== bh) { bc.width = bw; bc.height = bh; }
    const bx = bc.getContext('2d');
    bx.clearRect(0, 0, bw, bh);
    bx.drawImage(ctx.canvas, 0, 0, bw, bh);
    // keep only what is already bright — 'lighter' on itself squares the
    // channel values, which is a cheap and stable threshold
    bx.globalCompositeOperation = 'multiply';
    bx.drawImage(bc, 0, 0);
    bx.globalCompositeOperation = 'source-over';
    ctx.save();
    if (typeof ctx.filter === 'string') ctx.filter = 'blur(' + (7 * scale * 2).toFixed(1) + 'px)';
    ctx.globalCompositeOperation = 'lighter';
    ctx.globalAlpha = strength;
    ctx.drawImage(bc, 0, 0, w, h);
    ctx.restore();
    ctx.filter = 'none';
    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = 'source-over';
  }

  /* ---- 3 · label kit ---------------------------------------------------
     Every label is registered in a per-frame list. A new label that would
     overlap one already placed is nudged along its preferred axis until it
     clears, and a leader line is drawn back to the anchor if it moved far. */
  function LabelKit(ctx) {
    const placed = [];
    const K = {};
    K.reset = () => { placed.length = 0; };
    K.measure = (text, size, weight) => {
      ctx.font = (weight || 500) + ' ' + size + 'px "IBM Plex Mono",monospace';
      return ctx.measureText(text).width;
    };
    K.place = function (x, y, text, o) {
      o = o || {};
      const size = o.size || 10, weight = o.weight || 500;
      const w = K.measure(text, size, weight);
      const halfW = w / 2 + 3, halfH = size * 0.62 + 2;
      const align = o.align || 'center';
      const ox = align === 'left' ? halfW - 3 : align === 'right' ? -(halfW - 3) : 0;
      let cx = x + ox, cy = y;
      const dirX = o.push === 'x' ? 1 : 0, dirY = o.push === 'x' ? 0 : 1;
      let moved = 0;
      for (let k = 0; k < 26; k++) {
        const hit = placed.some(p =>
          Math.abs(p.cx - cx) < (p.hw + halfW) && Math.abs(p.cy - cy) < (p.hh + halfH));
        if (!hit) break;
        const step = (k % 2 ? -1 : 1) * Math.ceil((k + 1) / 2) * (size * 1.22);
        cx = x + ox + dirX * step;
        cy = y + dirY * step;
        moved = Math.abs(step);
      }
      placed.push({ cx: cx, cy: cy, hw: halfW, hh: halfH });
      if (moved > size * 1.4 && o.leader !== false) {
        ctx.save();
        ctx.strokeStyle = alpha(o.colour || theme['text-3'], .38);
        ctx.lineWidth = 1;
        ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(cx - ox, cy); ctx.stroke();
        ctx.restore();
      }
      ctx.save();
      ctx.font = weight + ' ' + size + 'px "IBM Plex Mono",monospace';
      ctx.textAlign = align; ctx.textBaseline = 'middle';
      if (o.halo !== false) {
        ctx.lineWidth = o.haloWidth || 3.2;
        ctx.strokeStyle = o.haloColour || 'rgba(5,8,15,.88)';
        ctx.lineJoin = 'round';
        ctx.strokeText(text, cx - ox, cy);
      }
      ctx.fillStyle = o.colour || theme.text;
      ctx.fillText(text, cx - ox, cy);
      ctx.restore();
      return { x: cx - ox, y: cy, w: w, moved: moved };
    };
    return K;
  }

  /* ---- 6 · materials --------------------------------------------------- */
  function sphere(ctx, x, y, r, colour, o) {
    o = o || {};
    const lx = x - r * 0.34, ly = y - r * 0.36;
    const gr = ctx.createRadialGradient(lx, ly, r * 0.06, x, y, r);
    gr.addColorStop(0, mix(colour, '#ffffff', o.gloss == null ? 0.55 : o.gloss));
    gr.addColorStop(0.55, colour);
    gr.addColorStop(1, mix(colour, '#05080F', 0.55));
    ctx.fillStyle = gr;
    ctx.beginPath(); ctx.arc(x, y, r, 0, TAU); ctx.fill();
    if (o.rim !== false) {
      ctx.strokeStyle = alpha(mix(colour, '#ffffff', .4), .35);
      ctx.lineWidth = Math.max(0.8, r * 0.06);
      ctx.beginPath(); ctx.arc(x, y, r * 0.97, Math.PI * 0.15, Math.PI * 0.85); ctx.stroke();
    }
    if (o.specular !== false && r > 3) {
      ctx.fillStyle = 'rgba(255,255,255,.38)';
      ctx.beginPath(); ctx.ellipse(lx, ly, r * 0.22, r * 0.15, -0.6, 0, TAU); ctx.fill();
    }
  }
  function shadow(ctx, blur, colour, fn) {
    ctx.save();
    ctx.shadowBlur = blur; ctx.shadowColor = colour || 'rgba(0,0,0,.55)';
    ctx.shadowOffsetY = Math.max(1, blur * 0.22);
    fn();
    ctx.restore();
  }

  /* ---- 8 · layout grid ------------------------------------------------- */
  function layout(w, h, cols, rows, pad) {
    const p = pad == null ? 14 : pad;
    const cw = (w - p * 2) / cols, ch = (h - p * 2) / rows;
    return function (c0, r0, cSpan, rSpan) {
      const x = p + c0 * cw, y = p + r0 * ch;
      const ww = cw * (cSpan || 1), hh = ch * (rSpan || 1);
      return { x: x, y: y, w: ww, h: hh, cx: x + ww / 2, cy: y + hh / 2,
               x1: x + ww, y1: y + hh, r: Math.min(ww, hh) / 2 };
    };
  }

  /* ---- 9 · scale chrome ------------------------------------------------ */
  function scaleBar(ctx, x, y, px, label, colour) {
    const col = colour || theme['text-3'];
    ctx.save();
    ctx.strokeStyle = alpha(col, .9); ctx.lineWidth = 1.4; ctx.lineCap = 'butt';
    ctx.beginPath();
    ctx.moveTo(x, y - 4); ctx.lineTo(x, y + 4);
    ctx.moveTo(x, y); ctx.lineTo(x + px, y);
    ctx.moveTo(x + px, y - 4); ctx.lineTo(x + px, y + 4);
    ctx.stroke();
    ctx.font = '500 9px "IBM Plex Mono",monospace';
    ctx.fillStyle = col; ctx.textAlign = 'center'; ctx.textBaseline = 'bottom';
    ctx.fillText(label, x + px / 2, y - 6);
    ctx.restore();
  }

  /* ---------------- canvas surface ---------------- */
  function Surface(el, opts) {
    const cv = document.createElement('canvas');
    el.appendChild(cv);
    const ctx = cv.getContext('2d');
    const S = { el, cv, ctx, w: 0, h: 0, dpr: 1 };
    S.resize = function () {
      const r = el.getBoundingClientRect();
      if (r.width < 2 || r.height < 2) return false;
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      const w = Math.round(r.width), h = Math.round(r.height);
      if (w === S.w && h === S.h && dpr === S.dpr) return false;
      S.w = w; S.h = h; S.dpr = dpr;
      cv.width = Math.round(w * dpr); cv.height = Math.round(h * dpr);
      return true;
    };
    S.begin = function () { ctx.setTransform(S.dpr, 0, 0, S.dpr, 0, 0); };
    S.pointer = null;
    cv.addEventListener('pointermove', e => {
      const r = cv.getBoundingClientRect();
      S.pointer = { x: e.clientX - r.left, y: e.clientY - r.top };
    });
    cv.addEventListener('pointerleave', () => { S.pointer = null; });
    if (opts && opts.orbit) {
      let drag = null;
      cv.addEventListener('pointerdown', e => {
        drag = { x: e.clientX, y: e.clientY };
        try { cv.setPointerCapture(e.pointerId); } catch (_) {}
      });
      cv.addEventListener('pointermove', e => {
        if (!drag) return;
        const cam = opts.cam();
        if (cam) {
          cam.theta -= (e.clientX - drag.x) * 0.007;
          cam.phi = clamp(cam.phi + (e.clientY - drag.y) * 0.007, -1.45, 1.45);
        }
        drag.x = e.clientX; drag.y = e.clientY;
      });
      const end = e => { drag = null; try { cv.releasePointerCapture(e.pointerId); } catch (_) {} };
      cv.addEventListener('pointerup', end);
      cv.addEventListener('pointercancel', end);
      cv.addEventListener('wheel', e => {
        const cam = opts.cam(); if (!cam) return;
        e.preventDefault();
        cam.dist = clamp(cam.dist * Math.exp(e.deltaY * 0.0012), cam.minDist || 0.6, cam.maxDist || 40);
      }, { passive: false });
    }
    if (opts && opts.onPointer) {
      const send = e => {
        const r = cv.getBoundingClientRect();
        opts.onPointer(e.clientX - r.left, e.clientY - r.top, e.buttons > 0, e.type);
      };
      cv.addEventListener('pointerdown', e => {
        try { cv.setPointerCapture(e.pointerId); } catch (_) {}
        send(e);
      });
      cv.addEventListener('pointermove', send);
      cv.addEventListener('pointerup', e => { try { cv.releasePointerCapture(e.pointerId); } catch (_) {} send(e); });
    }
    return S;
  }

  /* ---------------- registry ---------------- */
  const sims = [];
  const SUBJECTS = [
    { id: 'physics', label: 'Physics', color: 'phys' },
    { id: 'chemistry', label: 'Chemistry', color: 'chem' },
    { id: 'biology', label: 'Biology', color: 'bio' }
  ];
  function register(def) {
    (window.__REG || (window.__REG = [])).push(def);
    // normalise the single-plot shorthand into the plots array
    if (!def.plots && def.drawPlot) {
      def.plots = [{ title: def.plotTitle, legend: def.legend, draw: def.drawPlot, hover: def.hoverPlot }];
    }
    sims.push(def);
  }

  // Deepen an already-registered simulation without rewriting its module.
  function extend(id, patch) {
    const d = sims.find(s => s.id === id);
    if (!d) { console.warn('extend: no sim', id); return; }
    if (patch.params) Object.assign(d.params, patch.params);
    if (patch.addControlGroups) d.controls = (d.controls || []).concat(patch.addControlGroups);
    if (patch.addPresets) d.presets = (d.presets || []).concat(patch.addPresets);
    if (patch.addPlots) d.plots = (d.plots || []).concat(patch.addPlots);
    if (patch.hover0 && d.plots && d.plots[0]) d.plots[0].hover = patch.hover0;
    if (patch.quiz) d.quiz = patch.quiz;
    if (patch.addReadouts) {
      const oldR = d.readouts;
      d.readouts = function (S) { return (oldR ? oldR.call(d, S) : []).concat(patch.addReadouts(S)); };
    }
    if (patch.wrapSetup) {
      const old = d.setup;
      d.setup = function (S) { if (old) old.call(d, S); patch.wrapSetup(S); };
    }
    if (patch.wrapStep) {
      const old = d.step;
      d.step = function (S, dt) { if (old) old.call(d, S, dt); patch.wrapStep(S, dt); };
    }
  }

  /* ---------------- runtime ---------------- */
  const R = {
    def: null, S: null, playing: true, speed: 1, raf: 0, lastT: 0,
    stage: null, plots: [], nodes: {}, wtIndex: 0, wtShown: false, uiTimer: 0,
    log: [], quizIndex: 0, quizPick: null
  };

  const el = (tag, cls, html) => {
    const n = document.createElement(tag);
    if (cls) n.className = cls;
    if (html != null) n.innerHTML = html;
    return n;
  };

  function panel(title, right) {
    const p = el('div', 'panel');
    const head = el('div', 'panel-head');
    head.appendChild(el('span', 'eyebrow', title));
    head.appendChild(el('span', 'spacer'));
    if (right) head.appendChild(right);
    p.appendChild(head);
    const body = el('div', 'panel-body');
    p.appendChild(body);
    p.body = body; p.head = head;
    return p;
  }
  function miniBtn(label, fn, cls) {
    const b = el('button', 'mbtn' + (cls ? ' ' + cls : ''), label);
    b.addEventListener('click', fn);
    return b;
  }

  /* ---------------- rail: subject → chapter → experiment ---------------- */
  function buildRail() {
    const rail = document.getElementById('rail');
    rail.innerHTML = '';
    SUBJECTS.forEach(sub => {
      const list = sims.filter(s => s.subject === sub.id);
      if (!list.length) return;
      const g = el('div', 'rail-group');
      const head = el('div', 'rail-head');
      const dot = el('span', 'rail-dot');
      dot.style.background = 'var(--' + sub.color + ')';
      dot.style.boxShadow = '0 0 8px var(--' + sub.color + ')';
      head.appendChild(dot);
      head.appendChild(el('span', 'rail-title', sub.label));
      head.appendChild(el('span', 'rail-count', String(list.length)));
      g.appendChild(head);

      const chapters = [];
      list.forEach(s => { if (chapters.indexOf(s.chapter) < 0) chapters.push(s.chapter); });
      chapters.forEach(ch => {
        const cg = el('div', 'rail-chapter');
        cg.appendChild(el('div', 'rail-chapter-name', ch));
        list.filter(s => s.chapter === ch).forEach(s => {
          const b = el('button', 'navbtn');
          b.style.setProperty('--nav', 'var(--' + sub.color + ')');
          b.innerHTML = '<strong>' + s.name + '</strong>' +
            (s.weight ? '<em>' + s.weight + '</em>' : '');
          b.addEventListener('click', () => mount(s.id));
          b.dataset.sim = s.id;
          cg.appendChild(b);
        });
        g.appendChild(cg);
      });
      rail.appendChild(g);
    });
  }

  /* ---------------- controls ---------------- */
  function buildControls(host) {
    const def = R.def, S = R.S;
    host.innerHTML = '';
    if (def.presets && def.presets.length) {
      const grp = el('div', 'ctlgroup');
      grp.appendChild(el('div', 'ctlgroup-name', 'Preset scenarios'));
      const pr = el('div', 'presets');
      def.presets.forEach(p => {
        pr.appendChild(miniBtn(p.name, () => {
          Object.assign(S.p, p.params);
          if (def.setup) def.setup(S);
          buildControls(host); syncUI();
        }, 'preset'));
      });
      grp.appendChild(pr);
      host.appendChild(grp);
    }
    (def.controls || []).forEach(group => {
      const g = el('div', 'ctlgroup');
      if (group.group) g.appendChild(el('div', 'ctlgroup-name', group.group));
      group.items.forEach(it => {
        if (it.when && !it.when(S)) return;
        g.appendChild(buildControl(it, host));
      });
      host.appendChild(g);
    });
  }

  function buildControl(it, host) {
    const S = R.S, def = R.def;
    const wrap = el('div', 'ctl');
    wrap.dataset.key = it.key;
    const apply = restructure => {
      if (it.onChange) it.onChange(S);
      if (it.restructure || restructure) { if (def.setup) def.setup(S); }
      if (it.rebuild) buildControls(host);
      syncUI();
    };

    if (it.type === 'select') {
      wrap.appendChild(el('div', 'ctl-top', '<span class="ctl-label">' + it.label + '</span>'));
      const seg = el('div', 'seg' + (it.options.length > 3 ? ' seg-wrap' : ''));
      it.options.forEach(o => {
        const b = el('button', null, o.label);
        b.setAttribute('aria-pressed', String(S.p[it.key] === o.value));
        b.addEventListener('click', () => {
          S.p[it.key] = o.value;
          seg.querySelectorAll('button').forEach((x, i) =>
            x.setAttribute('aria-pressed', String(it.options[i].value === o.value)));
          apply(true);
        });
        seg.appendChild(b);
      });
      wrap.appendChild(seg);
      return wrap;
    }

    if (it.type === 'toggle') {
      const lab = el('label', 'switch');
      const inp = document.createElement('input');
      inp.type = 'checkbox'; inp.checked = !!S.p[it.key]; inp.id = 'c_' + it.key;
      const track = el('span', 'switch-track');
      lab.appendChild(inp); lab.appendChild(track);
      lab.appendChild(el('span', 'switch-label', it.label));
      inp.addEventListener('change', () => { S.p[it.key] = inp.checked; apply(false); });
      wrap.appendChild(lab);
      return wrap;
    }

    /* range with click-to-type numeric entry */
    const top = el('div', 'ctl-top');
    top.appendChild(el('span', 'ctl-label', it.label));
    const valBtn = el('button', 'ctl-val');
    valBtn.title = 'Click to type an exact value';
    top.appendChild(valBtn);
    const inp = document.createElement('input');
    inp.type = 'range'; inp.id = 'c_' + it.key;
    inp.min = it.min; inp.max = it.max;
    inp.step = it.step != null ? it.step : (it.max - it.min) / 200;
    inp.value = S.p[it.key];

    const show = () => {
      const v = +inp.value;
      valBtn.innerHTML = (it.fmt ? it.fmt(v) : fmt(v, 3)) + (it.unit ? '<small>' + it.unit + '</small>' : '');
      inp.style.setProperty('--fill', ((v - it.min) / (it.max - it.min) * 100) + '%');
    };
    inp.addEventListener('input', () => { S.p[it.key] = +inp.value; show(); apply(false); });

    valBtn.addEventListener('click', () => {
      const num = document.createElement('input');
      num.type = 'number'; num.className = 'ctl-num';
      num.value = S.p[it.key]; num.min = it.min; num.max = it.max; num.step = inp.step;
      valBtn.replaceWith(num); num.focus(); num.select();
      const commit = () => {
        const v = clamp(parseFloat(num.value), it.min, it.max);
        if (isFinite(v)) { S.p[it.key] = v; inp.value = v; }
        num.replaceWith(valBtn); show(); apply(true);
      };
      num.addEventListener('blur', commit);
      num.addEventListener('keydown', e => {
        if (e.key === 'Enter') { e.preventDefault(); commit(); }
        if (e.key === 'Escape') { num.replaceWith(valBtn); show(); }
      });
    });

    show();
    wrap.appendChild(top); wrap.appendChild(inp);
    return wrap;
  }

  /* ---------------- readouts / equation ---------------- */
  function renderReadouts() {
    const host = R.nodes.readouts, def = R.def, S = R.S;
    if (!host || !def.readouts) return;
    const data = def.readouts(S);
    R.lastReadouts = data;
    if (host.childElementCount !== data.length) {
      host.innerHTML = '';
      data.forEach(() => {
        const c = el('div', 'ro');
        c.appendChild(el('div', 'ro-label'));
        c.appendChild(el('div', 'ro-val'));
        c.appendChild(el('div', 'ro-hint'));
        host.appendChild(c);
      });
    }
    data.forEach((d, i) => {
      const c = host.children[i];
      c.dataset.flag = d.flag || '';
      c.children[0].textContent = d.label;
      c.children[1].innerHTML = d.value + (d.unit ? '<small>' + d.unit + '</small>' : '');
      c.children[2].textContent = d.hint || '';
      c.children[2].style.display = d.hint ? '' : 'none';
    });
  }
  function renderEquation() {
    const host = R.nodes.eq, def = R.def, S = R.S;
    if (host && def.equation) host.innerHTML = def.equation(S);
  }
  function syncUI() { renderReadouts(); renderEquation(); refreshTitles(); }

  // a plot may declare title as a function of state, so it can say what it is
  // currently showing; those nodes are re-read whenever the UI syncs
  function refreshTitles() {
    (R.liveTitles || []).forEach(t => {
      const v = t.fn(R.S);
      if (t.node.textContent !== v) t.node.textContent = v;
    });
  }

  /* ---------------- walkthrough ---------------- */
  function renderWalkthrough() {
    const host = R.nodes.wt, def = R.def;
    const steps = def.walkthrough || [];
    if (!host || !steps.length) return;
    const i = clamp(R.wtIndex, 0, steps.length - 1);
    const st = steps[i];
    host.innerHTML = '';
    const bar = el('div', 'wt-progress');
    steps.forEach((_, k) => { const s = el('span'); if (k <= i) s.className = 'done'; bar.appendChild(s); });
    host.appendChild(bar);
    const body = el('div', 'wt-step');
    body.appendChild(el('h4', null, st.title));
    body.appendChild(el('p', null, st.body));
    if (st.ask) {
      body.appendChild(el('div', 'wt-ask', '<b>Predict first</b>' + st.ask));
      if (R.wtShown) body.appendChild(el('div', 'wt-reveal', st.reveal));
      else body.appendChild(miniBtn('Reveal answer', () => { R.wtShown = true; renderWalkthrough(); }, 'wide'));
    }
    host.appendChild(body);
    const nav = el('div', 'wt-nav');
    const prev = miniBtn('← Back', () => goStep(i - 1));
    prev.disabled = i === 0; prev.style.opacity = i === 0 ? .4 : 1;
    nav.appendChild(prev);
    nav.appendChild(miniBtn(i === steps.length - 1 ? 'Restart' : 'Next →',
      () => goStep(i === steps.length - 1 ? 0 : i + 1), 'primary'));
    nav.appendChild(el('span', 'wt-count', (i + 1) + ' / ' + steps.length));
    host.appendChild(nav);
  }
  function goStep(i) {
    const def = R.def, S = R.S, steps = def.walkthrough || [];
    R.wtIndex = clamp(i, 0, steps.length - 1);
    R.wtShown = false;
    const st = steps[R.wtIndex];
    if (st && st.params) {
      Object.assign(S.p, st.params);
      if (def.setup) def.setup(S);
      buildControls(R.nodes.controls);
    }
    renderWalkthrough(); syncUI();
  }

  /* ---------------- self-check quiz ---------------- */
  function renderQuiz() {
    const host = R.nodes.quiz, def = R.def;
    const qs = def.quiz || [];
    if (!host || !qs.length) return;
    const i = clamp(R.quizIndex, 0, qs.length - 1);
    const q = qs[i];
    host.innerHTML = '';
    host.appendChild(el('div', 'quiz-q', q.q));
    const opts = el('div', 'quiz-opts');
    q.options.forEach((o, k) => {
      const b = el('button', 'quiz-opt', o);
      if (R.quizPick != null) {
        if (k === q.answer) b.dataset.state = 'right';
        else if (k === R.quizPick) b.dataset.state = 'wrong';
        b.disabled = true;
      } else {
        b.addEventListener('click', () => { R.quizPick = k; renderQuiz(); });
      }
      opts.appendChild(b);
    });
    host.appendChild(opts);
    if (R.quizPick != null) {
      host.appendChild(el('div', 'quiz-why',
        (R.quizPick === q.answer ? '<b>Correct.</b> ' : '<b>Not quite.</b> ') + q.why));
    }
    const nav = el('div', 'wt-nav');
    nav.appendChild(miniBtn(i === qs.length - 1 ? 'Restart' : 'Next question', () => {
      R.quizIndex = i === qs.length - 1 ? 0 : i + 1; R.quizPick = null; renderQuiz();
    }, 'primary'));
    nav.appendChild(el('span', 'wt-count', (i + 1) + ' / ' + qs.length));
    host.appendChild(nav);
  }

  /* ---------------- lab notebook ---------------- */
  function renderLog() {
    const host = R.nodes.log;
    if (!host) return;
    host.innerHTML = '';
    if (!R.log.length) {
      host.appendChild(el('div', 'log-empty',
        'Set up a condition, then press Record to capture every readout as a row. ' +
        'Build a table the way you would in a real practical.'));
      return;
    }
    const cols = R.log[0].cols;
    const tbl = el('table', 'logtable');
    const thead = el('thead');
    const hr = el('tr');
    hr.appendChild(el('th', null, '#'));
    cols.forEach(c => hr.appendChild(el('th', null, c)));
    thead.appendChild(hr); tbl.appendChild(thead);
    const tb = el('tbody');
    R.log.slice().reverse().forEach((row, i) => {
      const tr = el('tr');
      tr.appendChild(el('td', 'logn', String(R.log.length - i)));
      row.vals.forEach(v => tr.appendChild(el('td', null, v)));
      tb.appendChild(tr);
    });
    tbl.appendChild(tb);
    const scroll = el('div', 'logscroll');
    scroll.appendChild(tbl);
    host.appendChild(scroll);
  }
  function recordRow() {
    const data = R.lastReadouts || [];
    if (!data.length) return;
    R.log.push({
      cols: data.map(d => d.label.replace(/\s*[=·].*$/, '')),
      vals: data.map(d => d.value + (d.unit ? ' ' + d.unit : ''))
    });
    if (R.log.length > 40) R.log.shift();
    renderLog();
  }

  /* ---------------- mount ---------------- */
  function mount(id) {
    const def = sims.find(s => s.id === id) || sims[0];
    cancelAnimationFrame(R.raf);
    R.def = def;
    R.S = { p: Object.assign({}, def.params), t: 0, cam: null };
    R.playing = def.autoplay !== false;
    R.speed = 1;
    R.wtIndex = 0; R.wtShown = false;
    R.liveTitles = [];
    window.__S = R.S;
    R.quizIndex = 0; R.quizPick = null;
    R.log = [];
    R.plots = [];

    document.documentElement.setAttribute('data-subject', def.subject);
    readTheme();
    document.querySelectorAll('.navbtn').forEach(b =>
      b.setAttribute('aria-current', String(b.dataset.sim === def.id)));

    const tags = document.getElementById('examTags');
    tags.innerHTML = '';
    ['JEE Main', 'JEE Advanced', 'NEET UG'].forEach(x =>
      tags.appendChild(el('span', 'tag' + (def.exams.indexOf(x) >= 0 ? ' on' : ''), x)));

    const main = document.getElementById('main');
    main.innerHTML = '';

    /* exposition */
    const expo = el('div', 'expo');
    const et = el('div', 'expo-tags');
    et.appendChild(el('span', 'tag', def.chapter));
    (def.exams || []).forEach(x => et.appendChild(el('span', 'tag', x)));
    if (def.weight) et.appendChild(el('span', 'tag', def.weight));
    expo.appendChild(et);
    expo.appendChild(el('h1', null, def.name));
    expo.appendChild(el('div', 'expo-lede', def.lede));
    main.appendChild(expo);

    const con = el('div', 'console');
    const left = el('div', 'col'), right = el('div', 'col');
    con.appendChild(left); con.appendChild(right);
    main.appendChild(con);

    /* stage */
    const sp = el('div', 'panel stagepanel');
    sp.dataset.d3 = def.is3D ? '1' : '0';
    const stageBox = el('div', 'stage');
    sp.appendChild(stageBox);
    if (def.stageHint) stageBox.appendChild(el('div', 'stage-hint', def.stageHint));

    const tp = el('div', 'transport');
    const playBtn = miniBtn('❚❚ Pause', () => {
      R.playing = !R.playing;
      playBtn.innerHTML = R.playing ? '❚❚ Pause' : '▶ Play';
    }, 'primary');
    R.nodes.playBtn = playBtn;
    tp.appendChild(playBtn);
    tp.appendChild(miniBtn('↺ Reset', () => {
      R.S.t = 0; if (def.setup) def.setup(R.S); syncUI();
    }));
    if (def.is3D) tp.appendChild(miniBtn('⌖ View', () => { if (R.S.cam) R.S.cam.reset(); }));
    tp.appendChild(miniBtn('⛶ Full', () => {
      if (document.fullscreenElement) document.exitFullscreen();
      else sp.requestFullscreen && sp.requestFullscreen();
    }));
    const sw = el('div', 'speed');
    const si = document.createElement('input');
    si.type = 'range'; si.min = 0.1; si.max = 3; si.step = 0.05; si.value = 1; si.id = 'speedCtl';
    si.setAttribute('aria-label', 'Simulation speed');
    si.style.setProperty('--fill', '31%');
    const sl = el('span', null, '1.00×');
    si.addEventListener('input', () => {
      R.speed = +si.value; sl.textContent = (+si.value).toFixed(2) + '×';
      si.style.setProperty('--fill', ((+si.value - 0.1) / 2.9 * 100) + '%');
    });
    sw.appendChild(el('span', null, 'Speed')); sw.appendChild(si); sw.appendChild(sl);
    tp.appendChild(sw);
    sp.appendChild(tp);

    const ro = el('div', 'readouts');
    sp.appendChild(ro);
    R.nodes.readouts = ro;
    left.appendChild(sp);

    /* equation */
    if (def.equation) {
      const ep = panel('Governing relation · live values');
      const eqw = el('div', 'eqwrap');
      const eq = el('div', 'eq');
      eqw.appendChild(eq);
      if (def.eqNote) eqw.appendChild(el('div', 'eq-note', def.eqNote));
      ep.body.appendChild(eqw);
      R.nodes.eq = eq;
      left.appendChild(ep);
    }

    /* plots */
    (def.plots || []).forEach((pdef, idx) => {
      const tools = el('div', 'ptools');
      const titleFn = typeof pdef.title === 'function' ? pdef.title : null;
      const pp = panel((titleFn ? titleFn(R.S) : pdef.title) || 'Graph', tools);
      if (titleFn) (R.liveTitles || (R.liveTitles = [])).push({ node: pp.head.firstChild, fn: titleFn });
      const pbox = el('div', 'plot');
      pp.body.appendChild(pbox);
      if (pdef.legend) {
        const lg = el('div', 'legend');
        pdef.legend.forEach(l => {
          const s = el('span', 'lg');
          const i = el('i'); i.style.background = l.c;
          s.appendChild(i); s.appendChild(document.createTextNode(l.label));
          lg.appendChild(s);
        });
        pp.body.appendChild(lg);
      }
      left.appendChild(pp);

      const tip = el('div', 'tooltip');
      tip.hidden = true;
      pbox.appendChild(tip);

      const entry = { surf: null, ghost: null, tip, hoverPx: null, lastP: null, def: pdef };
      entry.surf = Surface(pbox, {});
      entry.surf.cv.addEventListener('pointermove', e => {
        const r = entry.surf.cv.getBoundingClientRect();
        entry.hoverPx = { x: e.clientX - r.left, y: e.clientY - r.top };
      });
      entry.surf.cv.addEventListener('pointerleave', () => { entry.hoverPx = null; tip.hidden = true; });

      tools.appendChild(miniBtn('Ghost', () => {
        const c = document.createElement('canvas');
        c.width = entry.surf.cv.width; c.height = entry.surf.cv.height;
        c.getContext('2d').drawImage(entry.surf.cv, 0, 0);
        entry.ghost = c;
      }, 'tiny'));
      tools.appendChild(miniBtn('Clear', () => { entry.ghost = null; }, 'tiny'));
      R.plots.push(entry);
    });

    /* controls */
    const cp = panel('Control deck');
    R.nodes.controls = cp.body;
    right.appendChild(cp);
    buildControls(cp.body);

    /* walkthrough */
    if (def.walkthrough && def.walkthrough.length) {
      const wp = panel('Guided walkthrough');
      R.nodes.wt = wp.body; right.appendChild(wp);
      renderWalkthrough();
    } else R.nodes.wt = null;

    /* quiz */
    if (def.quiz && def.quiz.length) {
      const qp = panel('Check yourself');
      R.nodes.quiz = qp.body; right.appendChild(qp);
      renderQuiz();
    } else R.nodes.quiz = null;

    /* lab notebook */
    const lgTools = el('div', 'ptools');
    const lp = panel('Lab notebook', lgTools);
    lgTools.appendChild(miniBtn('Record', recordRow, 'tiny primary'));
    lgTools.appendChild(miniBtn('Clear', () => { R.log = []; renderLog(); }, 'tiny'));
    R.nodes.log = lp.body;
    right.appendChild(lp);
    renderLog();

    /* notes */
    if (def.notes) {
      const np = panel('Why this is asked');
      np.body.appendChild(el('div', 'notes', def.notes));
      right.appendChild(np);
    }

    R.stage = Surface(stageBox, {
      orbit: !!def.is3D,
      cam: () => R.S.cam,
      onPointer: def.onPointer ? (x, y, down, type) => def.onPointer(R.S, x, y, down, type, R.stage) : null
    });
    if (def.setup) def.setup(R.S);
    syncUI();
    window.scrollTo(0, 0);
    R.lastT = performance.now();
    R.raf = requestAnimationFrame(loop);
  }

  /* ---------------- main loop ---------------- */
  function loop(now) {
    R.raf = requestAnimationFrame(loop);
    const def = R.def, S = R.S;
    if (!def) return;
    let dt = clamp((now - R.lastT) / 1000, 0, 0.05);
    R.lastT = now;

    if (R.playing && def.step) { def.step(S, dt * R.speed); S.t += dt * R.speed; }

    R.stage.resize();
    R.stage.begin();
    if (R.stage.w > 1) {
      const ctx = R.stage.ctx, w = R.stage.w, h = R.stage.h;
      if (!R.labelKit || R.labelCtx !== ctx) { R.labelKit = LabelKit(ctx); R.labelCtx = ctx; }
      R.labelKit.reset();
      R.hits = [];
      const g = {
        ctx: ctx, w: w, h: h, theme, alpha, mix, now: now / 1000, dt: dt,
        // layer 4 — perceptual colour ramps
        ramp: ramp,
        // layer 5 — eased parameter changes
        tween: (key, target, tau) => tween(S, key, target, tau, dt),
        // layer 3 — collision-aware labels
        label: (x, y, text, o) => R.labelKit.place(x, y, text, o),
        // layer 6 — lit materials
        sphere: (x, y, r, colour, o) => sphere(ctx, x, y, r, colour, o),
        shadow: (blur, colour, fn) => shadow(ctx, blur, colour, fn),
        // layer 8 — layout without magic numbers
        layout: (cols, rows, pad) => layout(w, h, cols, rows, pad),
        // layer 9 — scale chrome
        scaleBar: (x, y, px, lab, col) => scaleBar(ctx, x, y, px, lab, col),
        // layer 7 — interactive elements advertise themselves
        hit: (x, y, r, id) => { R.hits.push({ x: x, y: y, r: r, id: id }); },
        pointer: R.stage.pointer || null,
        quality: FX.quality
      };
      ctx.clearRect(0, 0, w, h);
      // layer 1 — instrument ground, painted under everything
      if (def.ground !== false) drawGround(ctx, w, h);
      if (S.cam) { S.cam.setViewport(w, h); S.cam.update(); }
      def.drawStage(S, g);
      // layer 7 — focus ring on whatever the pointer is nearest
      const pt = R.stage.pointer;
      if (pt && R.hits.length) {
        let best = null, bd = 1e9;
        R.hits.forEach(q => { const d = Math.hypot(pt.x - q.x, pt.y - q.y); if (d < bd) { bd = d; best = q; } });
        if (best && bd < best.r * 1.9) {
          ctx.save();
          ctx.strokeStyle = alpha(theme.accent, .75); ctx.lineWidth = 1.6;
          ctx.setLineDash([4, 3]);
          ctx.beginPath(); ctx.arc(best.x, best.y, best.r + 4 + Math.sin(now / 260) * 1.6, 0, TAU);
          ctx.stroke(); ctx.restore();
          R.stage.el.style.cursor = 'pointer';
        } else if (!def.is3D) R.stage.el.style.cursor = 'default';
      }
      // layer 2 — bloom over the finished frame
      bloom(ctx, w, h, def.bloom === false ? 0 : (def.bloom || 0.30));
    }
    // layer 10 — quality tier follows the measured frame cost
    FX.frameCost = FX.frameCost * 0.9 + (performance.now() - now) * 0.1;
    FX.quality = FX.frameCost > 22 ? 0.5 : FX.frameCost > 13 ? 0.75 : 1;

    R.plots.forEach((pp, i) => {
      pp.surf.resize(); pp.surf.begin();
      if (pp.surf.w < 2) return;
      const ctx = pp.surf.ctx, w = pp.surf.w, h = pp.surf.h;
      const g = {
        ctx, w, h, theme, alpha, mix,
        Plot: cfg => { const P = Plot(ctx, w, h, cfg); pp.lastP = P; return P; }
      };
      pp.def.draw(S, g);
      if (pp.ghost) {
        ctx.save();
        ctx.globalAlpha = 0.34;
        ctx.globalCompositeOperation = 'destination-over';
        ctx.drawImage(pp.ghost, 0, 0, w, h);
        ctx.restore();
      }
      drawHover(pp, S);
    });

    if (now - R.uiTimer > 70) { R.uiTimer = now; syncUI(); }
  }

  function drawHover(pp, S) {
    const P = pp.lastP, px = pp.hoverPx;
    if (!P || !px) { pp.tip.hidden = true; return; }
    if (!P.inside(px.x, px.y)) { pp.tip.hidden = true; return; }
    const ctx = pp.surf.ctx;
    ctx.save();
    ctx.strokeStyle = alpha(theme.text, .32); ctx.lineWidth = 1;
    ctx.setLineDash([3, 3]);
    ctx.beginPath();
    ctx.moveTo(px.x, P.y1); ctx.lineTo(px.x, P.y0);
    ctx.moveTo(P.x0, px.y); ctx.lineTo(P.x1, px.y);
    ctx.stroke(); ctx.restore();

    const dx = P.invX(px.x), dy = P.invY(px.y);
    let rows = pp.def.hover ? pp.def.hover(S, dx, dy) : null;
    if (!rows) rows = [
      { label: P.cfg.xlabel || 'x', value: fmt(dx, 4) },
      { label: P.cfg.ylabel || 'y', value: fmt(dy, 4) }
    ];
    pp.tip.innerHTML = rows.map(r =>
      '<span class="tr"><i style="background:' + (r.color || 'transparent') + '"></i>' +
      '<b>' + r.label + '</b><u>' + r.value + '</u></span>').join('');
    pp.tip.hidden = false;
    const right = px.x > pp.surf.w * 0.55;
    pp.tip.style.left = right ? 'auto' : (px.x + 14) + 'px';
    pp.tip.style.right = right ? (pp.surf.w - px.x + 14) + 'px' : 'auto';
    pp.tip.style.top = Math.max(6, Math.min(px.y - 10, pp.surf.h - 70)) + 'px';
  }

  /* ---------------- keyboard ---------------- */
  function keys(e) {
    const t = e.target;
    if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA')) return;
    if (e.key === ' ') {
      e.preventDefault();
      R.playing = !R.playing;
      if (R.nodes.playBtn) R.nodes.playBtn.innerHTML = R.playing ? '❚❚ Pause' : '▶ Play';
    } else if (e.key === 'r' || e.key === 'R') {
      R.S.t = 0; if (R.def.setup) R.def.setup(R.S); syncUI();
    } else if (e.key === 'ArrowRight' && R.nodes.wt) { goStep(R.wtIndex + 1); }
    else if (e.key === 'ArrowLeft' && R.nodes.wt) { goStep(R.wtIndex - 1); }
    else if (e.key === 'l' || e.key === 'L') { recordRow(); }
  }

  /* ---------------- boot ---------------- */
  function boot() {
    readTheme();
    buildRail();
    mount(sims[0].id);
    document.addEventListener('keydown', keys);
    window.addEventListener('resize', () => {
      R.stage && R.stage.resize();
      R.plots.forEach(p => p.surf.resize());
    });
  }

  return {
    register, extend, boot, rk4, clamp, lerp, TAU, fmt, fixed, sup: supStr, E,
    Camera, Plot, niceTicks, alpha, mix, theme
  };
})();
