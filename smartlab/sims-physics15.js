/* ============================================================
   PHYSICS (syllabus core, batch 5c)
     27. Kinematics — linked x–t, v–t, a–t graphs; projectiles with air
         drag and on inclines; the river crossing; closest approach
     28. Semiconductors — bands and doping; the p–n junction and its
         I–V curve; rectifiers with a smoothing capacitor; the Zener
         regulator; logic gates and their timing diagrams
   ============================================================ */
(function (L) {
  'use strict';
  const { clamp, TAU, E, Camera } = L;
  const PA = window.PHYSART, R3 = window.R3, RX = window.RX;
  const G = 9.81;
  function rng(seed) {
    let a = seed >>> 0;
    return () => { a = (a + 0x6D2B79F5) >>> 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
  }
  const TSTOP = ['#2B4CFF', '#29C4F5', '#8FE36A', '#FFD34A', '#FF7A2B', '#E0283F'];
  function tcol(T, lo, hi) {
    const f = clamp((T - lo) / (hi - lo), 0, 1) * (TSTOP.length - 1), i = Math.min(TSTOP.length - 2, Math.floor(f));
    return RX.mix(TSTOP[i], TSTOP[i + 1], f - i);
  }
  function tfmt(s) { const a = Math.abs(s); return a < 120 ? s.toFixed(a < 10 ? 2 : 1) + ' s' : (s / 60).toFixed(2) + ' min'; }
  // RK4 for a state vector
  function rk4(f, y, t, h) {
    const k1 = f(t, y), y2 = y.map((v, i) => v + h / 2 * k1[i]), k2 = f(t + h / 2, y2), y3 = y.map((v, i) => v + h / 2 * k2[i]),
          k3 = f(t + h / 2, y3), y4 = y.map((v, i) => v + h * k3[i]), k4 = f(t + h, y4);
    return y.map((v, i) => v + h / 6 * (k1[i] + 2 * k2[i] + 2 * k3[i] + k4[i]));
  }
  // solve a small dense linear system (Gaussian elimination with pivoting)
  function solve(A, b) {
    const n = b.length, M = A.map((r, i) => r.concat([b[i]]));
    for (let c = 0; c < n; c++) {
      let p = c; for (let r = c + 1; r < n; r++) if (Math.abs(M[r][c]) > Math.abs(M[p][c])) p = r;
      [M[c], M[p]] = [M[p], M[c]];
      for (let r = c + 1; r < n; r++) { const f = M[r][c] / M[c][c]; for (let k = c; k <= n; k++) M[r][k] -= f * M[c][k]; }
    }
    const x = new Array(n).fill(0);
    for (let r = n - 1; r >= 0; r--) { let s = M[r][n]; for (let k = r + 1; k < n; k++) s -= M[r][k] * x[k]; x[r] = s / M[r][r]; }
    return x;
  }

  /* =========================================================================
     23 · RIGID-BODY DYNAMICS


  /* ---------- small vector helpers ---------- */
  const V = {
    add: (a, b) => [a[0] + b[0], a[1] + b[1], a[2] + b[2]], sub: (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]],
    mul: (a, k) => [a[0] * k, a[1] * k, a[2] * k], dot: (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2],
    cross: (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]],
    norm: a => { const l = Math.hypot(a[0], a[1], a[2]) || 1; return [a[0] / l, a[1] / l, a[2] / l]; }
  };
  // Rodrigues: rotate v about unit axis u by angle a
  const rotv = (v, u, a) => { const c = Math.cos(a), s = Math.sin(a), k = V.dot(u, v) * (1 - c), x = V.cross(u, v); return [v[0] * c + x[0] * s + u[0] * k, v[1] * c + x[1] * s + u[1] * k, v[2] * c + x[2] * s + u[2] * k]; };
  function panel(g, title, rows) {
    const narrow = g.w < 660, n = narrow ? Math.min(4, rows.length) : rows.length, bw = narrow ? g.w - 24 : 312, bh = 26 + n * 15 + 10;
    const row = gPanel(g, 12, g.h - bh - 30, bw, bh, title);
    rows.slice(0, n).forEach((r, i) => row(i, r[0], r[1], r[2]));
  }

  /* a wheel: tyre, rim, spokes and hub, turned by angle a about the axis along y, centred at c (scene units), radius r */
  function wheel(F, c, r, a, o) {
    o = o || {};
    const ring = (rr, z0) => { const pts = []; for (let i = 0; i <= 56; i++) { const t = i / 56 * TAU; pts.push([c[0] + rr * Math.cos(t), c[1] + (z0 || 0), c[2] + rr * Math.sin(t)]); } return pts; };
    R3.tube(F, ring(r * 0.93), r * 0.07, o.tyre || '#23272F', { segments: 10, round: false });
    R3.tube(F, ring(r * 0.84), r * 0.025, '#AEB6C4', { segments: 8, round: false });
    for (let k = 0; k < (o.spokes || 8); k++) { const t = -a + k / (o.spokes || 8) * TAU; R3.cylinder(F, c, [c[0] + r * 0.84 * Math.cos(t), c[1], c[2] + r * 0.84 * Math.sin(t)], r * 0.018, '#C9D2DE', { segments: 6, shadow: false, caps: false }); }
    R3.cylinder(F, [c[0], c[1] - r * 0.12, c[2]], [c[0], c[1] + r * 0.12, c[2]], r * 0.1, '#5A6478', { segments: 16, shadow: false });
    const mk = [c[0] + r * 0.93 * Math.cos(-a - Math.PI / 2), c[1] - r * 0.08, c[2] + r * 0.93 * Math.sin(-a - Math.PI / 2)];
    R3.sphere(F, mk, r * 0.07, '#FF6B5A', { shadow: false, vivid: true });
    return mk;
  }
  const B3 = window.BENCH;
  /* ---------------- shared drawing helpers (as in batch 3) ---------------- */
  function gPanel(g, bx, by, bw, bh, title) {
    const ctx = g.ctx, th = g.theme;
    ctx.fillStyle = g.alpha('#0B1020', .90);
    ctx.strokeStyle = g.alpha(th.line, 1); ctx.lineWidth = 1;
    ctx.beginPath(); ctx.roundRect(bx, by, bw, bh, 8); ctx.fill(); ctx.stroke();
    PA.lbl(ctx, bx + 10, by + 13, title, th['text-3'], 'left', 8.5);
    return (i, k, v, c) => {
      PA.lbl(ctx, bx + 10, by + 30 + i * 15, k, th['text-3'], 'left', 9);
      PA.lbl(ctx, bx + bw - 10, by + 30 + i * 15, v, c || th['text-2'], 'right', 9.5);
    };
  }
  function header(g, big, l1, l2, col) {
    const ctx = g.ctx, th = g.theme;
    ctx.textAlign = 'left'; ctx.textBaseline = 'alphabetic';
    ctx.font = '700 17px "IBM Plex Sans",system-ui,sans-serif';
    ctx.lineWidth = 3; ctx.strokeStyle = 'rgba(5,8,15,.8)'; ctx.strokeText(big, 14, 24);
    ctx.fillStyle = col || th.text; ctx.fillText(big, 14, 24);
    ctx.font = '10px "IBM Plex Mono",monospace'; ctx.fillStyle = g.alpha(th['text-2'], .95);
    if (l1) ctx.fillText(l1, 14, 40);
    ctx.fillStyle = g.alpha(th['text-3'], .95);
    if (l2) ctx.fillText(l2, 14, 54);
  }
  /* a 3-D polyline cut into short pieces, each sorted on its own depth, so
     the far half of an orbit really does pass behind the planet */
  function path3(F, pts, colour, o) {
    o = o || {};
    const n = o.chunk || 6, ctx = F.ctx, cam = F.cam;
    for (let i = 0; i < pts.length - 1; i += n) {
      const seg = pts.slice(i, Math.min(pts.length, i + n + 1));
      const mid = seg[seg.length >> 1];
      const col = typeof colour === 'function' ? colour(i / pts.length) : colour;
      F.push(mid, () => {
        ctx.save();
        ctx.strokeStyle = RX.rgba(col, o.alpha == null ? 0.85 : o.alpha); ctx.lineWidth = o.width || 1.6;
        if (o.dash) ctx.setLineDash(o.dash);
        if (o.glow) { ctx.shadowColor = col; ctx.shadowBlur = o.glow; }
        ctx.beginPath();
        let first = true;
        seg.forEach(p => { const q = cam.project(p); if (!q.ok) { first = true; return; } first ? ctx.moveTo(q.x, q.y) : ctx.lineTo(q.x, q.y); first = false; });
        ctx.stroke(); ctx.restore();
      }, o.bias || 0);
    }
  }
  function flatPoly(F, pts, fill, o) {
    o = o || {};
    const ctx = F.ctx, cam = F.cam;
    const c = pts.reduce((u, p) => [u[0] + p[0] / pts.length, u[1] + p[1] / pts.length, u[2] + p[2] / pts.length], [0, 0, 0]);
    F.push(c, () => {
      const q = pts.map(p => cam.project(p));
      if (q.some(x => !x.ok)) return;
      ctx.fillStyle = fill; ctx.beginPath();
      q.forEach((x, i) => i ? ctx.lineTo(x.x, x.y) : ctx.moveTo(x.x, x.y));
      ctx.closePath(); ctx.fill();
    }, o.bias || 0);
  }
  function ringPts(cam, c, r, n) {
    const out = [];
    for (let i = 0; i < n; i++) {
      const a = i / n * TAU, q = cam.project([c[0] + r * Math.cos(a), c[1] + r * Math.sin(a), c[2]]);
      if (!q.ok) return null;
      out.push(q);
    }
    return out;
  }
  function hull2(P) {
    const p = P.slice().sort((a, b) => a.x - b.x || a.y - b.y);
    const cr = (o, a, b) => (a.x - o.x) * (b.y - o.y) - (a.y - o.y) * (b.x - o.x);
    const lo = [], up = [];
    p.forEach(q => { while (lo.length >= 2 && cr(lo[lo.length - 2], lo[lo.length - 1], q) <= 0) lo.pop(); lo.push(q); });
    for (let i = p.length - 1; i >= 0; i--) { const q = p[i]; while (up.length >= 2 && cr(up[up.length - 2], up[up.length - 1], q) <= 0) up.pop(); up.push(q); }
    up.pop(); lo.pop();
    return lo.concat(up);
  }
  const polyPath = (ctx, pts) => { ctx.beginPath(); pts.forEach((q, i) => i ? ctx.lineTo(q.x, q.y) : ctx.moveTo(q.x, q.y)); ctx.closePath(); };
  function glassCyl(F, base, r, h, o) {
    o = o || {};
    const ctx = F.ctx, cam = F.cam;
    F.push([base[0], base[1], base[2] + h / 2], () => {
      const b = ringPts(cam, base, r, 40), t = ringPts(cam, [base[0], base[1], base[2] + h], r, 40);
      if (!b || !t) return;
      const H = hull2(b.concat(t));
      let x0 = Infinity, x1 = -Infinity;
      H.forEach(q => { x0 = Math.min(x0, q.x); x1 = Math.max(x1, q.x); });
      ctx.save();
      polyPath(ctx, H);
      ctx.fillStyle = o.tint || 'rgba(185,222,245,.07)'; ctx.fill();
      ctx.clip();
      const gr = ctx.createLinearGradient(x0, 0, x1, 0);
      gr.addColorStop(0, 'rgba(255,255,255,0)'); gr.addColorStop(0.07, 'rgba(255,255,255,.28)'); gr.addColorStop(0.14, 'rgba(255,255,255,.04)');
      gr.addColorStop(0.80, 'rgba(255,255,255,.02)'); gr.addColorStop(0.90, 'rgba(255,255,255,.16)'); gr.addColorStop(0.96, 'rgba(255,255,255,0)');
      ctx.fillStyle = gr; ctx.fillRect(x0, Math.min(...H.map(q => q.y)), x1 - x0, 4000);
      ctx.restore();
      ctx.strokeStyle = 'rgba(215,238,255,.55)'; ctx.lineWidth = 1; polyPath(ctx, H); ctx.stroke();
      ctx.strokeStyle = 'rgba(235,248,255,.75)'; ctx.lineWidth = 1.2; polyPath(ctx, t); ctx.stroke();
      if (o.ticks) o.ticks(ctx);
    }, o.bias == null ? -0.04 : o.bias);
  }
  function liquidCyl(F, base, r, h, col, o) {
    o = o || {};
    if (h <= 1e-5) return;
    const ctx = F.ctx, cam = F.cam, a = o.alpha == null ? 0.55 : o.alpha;
    F.push([base[0], base[1], base[2] + h / 2], () => {
      const b = ringPts(cam, base, r, 40), t = ringPts(cam, [base[0], base[1], base[2] + h], r, 40);
      if (!b || !t) return;
      const H = hull2(b.concat(t));
      let y0 = Infinity, y1 = -Infinity;
      H.forEach(q => { y0 = Math.min(y0, q.y); y1 = Math.max(y1, q.y); });
      ctx.save();
      const gr = ctx.createLinearGradient(0, y0, 0, y1);
      gr.addColorStop(0, RX.rgba(RX.mix(col, '#FFFFFF', 0.15), a * 0.85)); gr.addColorStop(1, RX.rgba(RX.mix(col, '#05080F', 0.35), a));
      ctx.fillStyle = gr; polyPath(ctx, H); ctx.fill();
      // the free surface: lit, with a soft specular band
      ctx.fillStyle = RX.rgba(RX.mix(col, '#FFFFFF', o.metal ? 0.12 : 0.35), Math.min(1, a + 0.15)); polyPath(ctx, t); ctx.fill();
      ctx.strokeStyle = RX.rgba(RX.mix(col, '#FFFFFF', 0.6), 0.9); ctx.lineWidth = 1.1; polyPath(ctx, t); ctx.stroke();
      if (o.metal) {                      // mercury: a mirror, not a tint
        const cx = t.reduce((u, q) => u + q.x, 0) / t.length, cy = t.reduce((u, q) => u + q.y, 0) / t.length;
        const g2 = ctx.createRadialGradient(cx - 10, cy - 3, 1, cx, cy, 60);
        g2.addColorStop(0, 'rgba(255,255,255,.45)'); g2.addColorStop(1, 'rgba(255,255,255,0)');
        ctx.fillStyle = g2; polyPath(ctx, t); ctx.fill();
      }
      ctx.restore();
    }, o.bias == null ? -0.02 : o.bias);
  }
  function ringHandle(g, q, id, c, rad) {
    const ctx = g.ctx, th = g.theme, on = g.dragging === id;
    ctx.save(); ctx.strokeStyle = on ? th.text : g.alpha(c, .85); ctx.lineWidth = on ? 2.2 : 1.5; ctx.setLineDash(on ? [] : [3, 2]);
    ctx.beginPath(); ctx.arc(q.x, q.y, rad || 11, 0, TAU); ctx.stroke(); ctx.restore();
    g.handle(q.x, q.y, (rad || 11) + 3, id);
  }
  const axis2 = (a, b, per) => { const dx = b.x - a.x, dy = b.y - a.y, l = Math.hypot(dx, dy) || 1; return { ux: dx / l, uy: dy / l, per: per / l }; };
  /* one pre-shaded ball per colour: thousands of nucleons or atoms a frame, drawn as sprites */
  const SPR = {};
  function sprite(col, o) {
    o = o || {};
    const key = col + (o.metal ? 'm' : '') + (o.glow ? 'g' : '');
    if (SPR[key]) return SPR[key];
    const c = document.createElement('canvas'); c.width = c.height = 96;
    const x = c.getContext('2d');
    if (o.glow) {
      const gr = x.createRadialGradient(48, 48, 0, 48, 48, 48);
      gr.addColorStop(0, RX.rgba('#FFFFFF', 1)); gr.addColorStop(0.25, RX.rgba(col, 0.9)); gr.addColorStop(1, RX.rgba(col, 0));
      x.fillStyle = gr; x.fillRect(0, 0, 96, 96);
    } else RX.ball(x, 48, 48, 46, col, { rim: o.metal ? 0.9 : 0.6, sub: 0.35, vivid: !o.metal });
    return (SPR[key] = c);
  }
  /* draw a list of [x, y, z, r, sprite] balls as one depth-sorted item */
  function ballCloud(F, list, at, bias) {
    const cam = F.cam, ctx = F.ctx, ey = cam.eye;
    list.forEach(d => { d[5] = (d[0] - ey[0]) ** 2 + (d[1] - ey[1]) ** 2 + (d[2] - ey[2]) ** 2; });
    list.sort((u, v) => v[5] - u[5]);
    F.push(at, () => {
      list.forEach(d => {
        const q = cam.project([d[0], d[1], d[2]]); if (!q.ok) return;
        const rp = d[3] * q.s; if (rp < 0.25) return;
        ctx.drawImage(d[4], q.x - rp, q.y - rp, 2 * rp, 2 * rp);
      });
    }, bias || 0);
  }
  function glassBox(F, c, size, o) {
    o = o || {};
    const ctx = F.ctx, cam = F.cam, hx = size[0] / 2, hy = size[1] / 2, hz = size[2] / 2;
    const faces = [[[1, 0, 0], hx, [0, hy, 0], [0, 0, hz]], [[-1, 0, 0], hx, [0, hy, 0], [0, 0, hz]],
                   [[0, 1, 0], hy, [hx, 0, 0], [0, 0, hz]], [[0, -1, 0], hy, [hx, 0, 0], [0, 0, hz]],
                   [[0, 0, 1], hz, [hx, 0, 0], [0, hy, 0]], [[0, 0, -1], hz, [hx, 0, 0], [0, hy, 0]]];
    faces.forEach(([n, h, e1, e2], i) => {
      if (o.skip && o.skip.indexOf(i) >= 0) return;
      const fc = R3.add(c, R3.scale(n, h));
      const pts = [R3.add(R3.add(fc, e1), e2), R3.add(R3.sub(fc, e1), e2), R3.sub(R3.sub(fc, e1), e2), R3.sub(R3.add(fc, e1), e2)];
      F.push(fc, () => {
        const q = pts.map(p => cam.project(p)); if (q.some(x => !x.ok)) return;
        ctx.beginPath(); q.forEach((x, k) => k ? ctx.lineTo(x.x, x.y) : ctx.moveTo(x.x, x.y)); ctx.closePath();
        const facing = R3.dot(n, R3.sub(cam.eye, fc)) > 0;
        ctx.fillStyle = facing ? 'rgba(170,215,240,.10)' : 'rgba(170,215,240,.05)'; ctx.fill();
        ctx.strokeStyle = 'rgba(210,235,255,.55)'; ctx.lineWidth = 0.9; ctx.stroke();
        if (facing && o.glint) {             // a diagonal reflection streak on the near pane
          const a = q[0], b = q[2];
          const gr = ctx.createLinearGradient(a.x, a.y, b.x, b.y);
          gr.addColorStop(0.35, 'rgba(255,255,255,0)'); gr.addColorStop(0.45, 'rgba(255,255,255,.10)'); gr.addColorStop(0.55, 'rgba(255,255,255,0)');
          ctx.fillStyle = gr; ctx.fill();
        }
      }, o.bias || 0);
    });
  }
  function convexFill(ctx, cam, pts3, fill, stroke) {
    const q = pts3.map(p => cam.project(p)); if (q.some(x => !x.ok)) return null;
    const H = hull2(q);
    ctx.fillStyle = fill; polyPath(ctx, H); ctx.fill();
    if (stroke) { ctx.strokeStyle = stroke; ctx.lineWidth = 1; polyPath(ctx, H); ctx.stroke(); }
    return H;
  }

  /* =========================================================================
     27 · KINEMATICS

     · Straight-line motion from an acceleration profile: x and v are integrated
       (RK4), and the three graphs are the same run, so the slope of x–t is v,
       the slope of v–t is a, and the area under v–t is the displacement
       (signed) while the distance adds |v|. A dropped ball that bounces with
       restitution e gives the classic saw-tooth.
     · Projectiles in vacuum or with linear/quadratic air drag, from a height
       or onto an incline; the landing is found by interpolating inside the
       step where the path crosses the ground, and the best angle is searched.
     · The river crossing, uniform or with the flow fastest mid-stream.
     · Two ships: the closest approach from the relative velocity.
     ========================================================================= */
  const every5 = (t, dt, iv) => Math.round(t / dt) % Math.max(1, Math.round(iv / dt)) === 0;

  /* ---- 1D motion ---- */
  function accel1(p, t, x, v) {
    if (p.prof === 'const') return p.a0g;
    if (p.prof === 'brake') return t < p.t1g ? p.a0g : (v > 1e-9 ? -p.a2g : 0);
    if (p.prof === 'sine') return p.a0g * Math.cos(TAU * t / p.Tsg);
    return -G;                                             // drop
  }
  function runGraphs(p) {
    const dt = 0.001, out = [], tEnd = p.tEg;
    let t = 0, x = p.prof === 'drop' ? p.hdrop : 0, v = p.prof === 'drop' ? 0 : p.v0g, dist = 0, bounces = 0, tRest = NaN, turns = [], sgn = Math.sign(v);
    while (t <= tEnd + 1e-9) {
      const a = p.prof === 'drop' && isFinite(tRest) ? 0 : p.prof === 'brake' && t >= p.t1g && v <= 1e-9 ? 0 : accel1(p, t, x, v);
      if (every5(t, dt, 0.01)) out.push([t, x, v, a, dist]);
      const f = (tt, y) => [y[1], accel1(p, tt, y[0], y[1])];
      let y = rk4(f, [x, v], t, dt);
      if (p.prof === 'brake' && t >= p.t1g && y[1] < 0) y[1] = 0;
      if (p.prof === 'drop' && y[0] <= 0) {                // the bounce, found inside the step
        const fr = x / Math.max(1e-12, x - y[0]), vHit = v - G * fr * dt;
        y = [0, -p.ebn * vHit]; if (Math.abs(vHit) > 0.1) bounces++;
        if (Math.abs(vHit) < 0.004) { y = [0, 0]; if (isNaN(tRest)) tRest = t + fr * dt; }
      }
      if (p.prof === 'drop' && isFinite(tRest)) y = [0, 0];
      if (p.prof !== 'drop' && Math.abs(y[1]) > 1e-9) { const s2 = Math.sign(y[1]); if (sgn && s2 !== sgn) turns.push(t + dt * Math.abs(v) / Math.max(1e-12, Math.abs(y[1] - v))); sgn = s2; }
      dist += Math.abs(y[0] - x); x = y[0]; v = y[1]; t += dt;
    }
    const last = out[out.length - 1], x0 = out[0][1];
    return { out, tEnd, disp: last[1] - x0, dist: last[4], turns, bounces, tRest, x0 };
  }

  /* ---- projectiles ---- */
  function runProj(p, angOverride, quick) {
    const th = (angOverride == null ? p.ang : angOverride) * Math.PI / 180, al = p.slope * Math.PI / 180, k = p.drag === 'none' ? 0 : p.kd;
    const ta = Math.tan(al), ground = x => x * ta;
    const f = (t, s) => { const sp = Math.hypot(s[2], s[3]); let ax = 0, ay = -G;
      if (p.drag === 'lin') { ax -= k * s[2]; ay -= k * s[3]; } else if (p.drag === 'quad') { ax -= k * sp * s[2]; ay -= k * sp * s[3]; }
      return [s[2], s[3], ax, ay]; };
    let s = [0, p.h0, p.up * Math.cos(th), p.up * Math.sin(th)], t = 0, yMax = s[1], tTop = 0;
    const dt = quick ? 0.002 : 0.001, out = [];
    while (t < 60) {
      if (!quick && every5(t, dt, 0.01)) out.push([t, s[0], s[1], s[2], s[3]]);
      const s2 = rk4(f, s, t, dt);
      if (s2[1] > yMax) { yMax = s2[1]; tTop = t + dt; }
      if (t > 1e-6 && s2[1] - ground(s2[0]) <= 0 && s[1] - ground(s[0]) > 0) {
        const g0 = s[1] - ground(s[0]), g1 = s2[1] - ground(s2[0]), fr = g0 / (g0 - g1);
        s = s.map((v, i) => v + fr * (s2[i] - v)); t += fr * dt;
        if (!quick) out.push([t, s[0], s[1], s[2], s[3]]);
        break;
      }
      s = s2; t += dt;
    }
    const R = Math.hypot(s[0], s[1] - 0) / 1, Rx = s[0], Ralong = s[0] / Math.cos(al);
    return { out, T: t, Rx, Ralong, yMax, tTop, vLand: [s[2], s[3]], th, al, R };
  }
  function projVac(p) {                                    // closed forms, launch on the ground (h0 = 0)
    const th = p.ang * Math.PI / 180, al = p.slope * Math.PI / 180, u = p.up;
    const T = 2 * u * Math.sin(th - al) / (G * Math.cos(al)), Ral = 2 * u * u * Math.sin(th - al) * Math.cos(th) / (G * Math.cos(al) * Math.cos(al));
    return { T, Ral, H: u * u * Math.sin(th) ** 2 / (2 * G), Rmax: u * u / (G * (1 + Math.sin(al))), thBest: 45 + p.slope / 2 };
  }
  function bestAngle(p) {                                  // golden-section search on the run's range along the ground
    let a = Math.max(p.slope + 0.5, 1), b = 89.5; const phi = (Math.sqrt(5) - 1) / 2, R = x => runProj(p, x, true).Ralong;
    let c = b - phi * (b - a), d = a + phi * (b - a), fc = R(c), fd = R(d);
    for (let i = 0; i < 40; i++) { if (fc > fd) { b = d; d = c; fd = fc; c = b - phi * (b - a); fc = R(c); } else { a = c; c = d; fc = fd; d = a + phi * (b - a); fd = R(d); } }
    return { ang: (a + b) / 2, R: R((a + b) / 2) };
  }

  /* ---- the river ---- */
  function flowAt(p, y) { return p.profile === 'uniform' ? p.vr : p.vr * 4 * (y / p.dw) * (1 - y / p.dw) * 1.5; }   // parabolic: same mean flow
  function runRiver(p, headOverride, quick) {
    const ph = (headOverride == null ? p.head : headOverride) * Math.PI / 180, vb = p.vb, d = p.dw;
    const vy = vb * Math.cos(ph);
    if (vy <= 1e-9) return { never: true, T: Infinity, drift: Infinity, out: [] };
    let x = 0, y = 0, t = 0; const dt = quick ? d / vy / 400 : d / vy / 2000, out = [];
    while (y < d) {
      if (!quick && (out.length === 0 || Math.round(t / dt) % 5 === 0)) out.push([t, x, y]);
      const f = (tt, s) => [flowAt(p, s[1]) - vb * Math.sin(ph), vy];
      const s2 = rk4(f, [x, y], t, dt);
      if (s2[1] >= d) { const fr = (d - y) / (s2[1] - y); x += fr * (s2[0] - x); t += fr * dt; y = d; break; }
      x = s2[0]; y = s2[1]; t += dt;
    }
    if (!quick) out.push([t, x, d]);
    return { T: t, drift: x, out, ph, vy };
  }

  /* ---- two ships ---- */
  function runShips(p) {
    const va = [p.vA * Math.sin(p.hA * Math.PI / 180), p.vA * Math.cos(p.hA * Math.PI / 180)];   // heading from north, clockwise
    const vB = [p.vB * Math.sin(p.hB * Math.PI / 180), p.vB * Math.cos(p.hB * Math.PI / 180)];
    const r0 = [p.xB, p.yB], vr = [vB[0] - va[0], vB[1] - va[1]], v2 = vr[0] * vr[0] + vr[1] * vr[1];
    const tStar = v2 > 1e-12 ? Math.max(0, -(r0[0] * vr[0] + r0[1] * vr[1]) / v2) : 0;
    const dMinF = Math.hypot(r0[0] + vr[0] * tStar, r0[1] + vr[1] * tStar);
    const tEnd = tStar > 0.5 ? 2 * tStar : Math.max(10, 2 * Math.hypot(r0[0], r0[1]) / Math.max(1, Math.sqrt(v2))), out = []; let dMin = Infinity, tMin = 0;
    for (let i = 0; i <= 2000; i++) { const t = tEnd * i / 2000, A = [va[0] * t, va[1] * t], B = [r0[0] + vB[0] * t, r0[1] + vB[1] * t], dd = Math.hypot(B[0] - A[0], B[1] - A[1]);
      out.push([t, A[0], A[1], B[0], B[1], dd]); if (dd < dMin) { dMin = dd; tMin = t; } }
    // refine the sampled minimum with a few golden steps on the actual separation
    let a = Math.max(0, tMin - tEnd / 2000), b = Math.min(tEnd, tMin + tEnd / 2000); const sep = t => Math.hypot(r0[0] + vr[0] * t, r0[1] + vr[1] * t);
    for (let i = 0; i < 60; i++) { const m1 = a + (b - a) / 3, m2 = b - (b - a) / 3; if (sep(m1) < sep(m2)) b = m2; else a = m1; }
    return { va, vB, vr, r0, tStar, dMinF, dMin: sep((a + b) / 2), tMin: (a + b) / 2, out, tEnd };
  }

  /* a boat or ship: a hull pointing along heading d (unit, in the x–y plane) at c */
  function hull(F, c, d, len, wid, col, deck) {
    const s = [-d[1], d[0], 0], dd = [d[0], d[1], 0];
    R3.box(F, V.add(c, [0, 0, 0.02]), [len, wid, 0.04], col, { shadow: false, axes: [dd, s, [0, 0, 1]] });
    const bow = V.add(c, V.mul(dd, len / 2 + len * 0.18));
    flatPoly(F, [V.add(V.add(c, V.mul(dd, len / 2)), V.mul(s, wid / 2)).map((v, i) => i === 2 ? 0.042 : v), [bow[0], bow[1], 0.042], V.add(V.add(c, V.mul(dd, len / 2)), V.mul(s, -wid / 2)).map((v, i) => i === 2 ? 0.042 : v)], col, { bias: -0.01 });
    R3.box(F, V.add(c, V.add(V.mul(dd, -len * 0.12), [0, 0, 0.06])), [len * 0.35, wid * 0.7, 0.05], deck || '#DCE3EE', { shadow: false, axes: [dd, s, [0, 0, 1]] });
  }

  /* ======================= 27.1 · straight-line motion and its graphs ======================= */
  function drawGraphs(S, g) {
    const ctx = g.ctx, th = g.theme, p = S.p, cam = S.cam, Gr = S.Gr;
    const F = R3.Frame(ctx, cam, { ambient: 0.36, floorZ: 0 });
    const tt = S.ts % (Gr.tEnd + 1), i = Math.min(Gr.out.length - 1, Math.round(Math.min(tt, Gr.tEnd) / 0.01)), o = Gr.out[i];
    if (p.prof === 'drop') {
      const ks = 1.6 / Math.max(0.5, p.hdrop);
      R3.box(F, [0, 0, -0.02], [1.4, 0.8, 0.04], '#39414F', { shadow: false });
      B3.rule(F, [-0.18, 0.05, 0], [0, 0, 1], p.hdrop, { k: ks, up: [0, -1, 0] });
      const trail = Gr.out.filter((q, j) => j <= i && j % 3 === 0).map(q => [0.12 + q[0] * 0.02, 0, q[1] * ks + 0.05]);
      if (trail.length > 1) path3(F, trail, '#FF8A7A', { alpha: 0.35, width: 1.2, chunk: 4 });
      R3.sphere(F, [0, 0, o[1] * ks + 0.05], 0.05, '#E0453A', { shadow: true, vivid: true });
      if (Math.abs(o[2]) > 0.05) R3.arrow(F, [0.12, 0, o[1] * ks + 0.05], [0.12, 0, o[1] * ks + 0.05 + o[2] * 0.06], 0.009, '#7FD0FF', { vivid: true });
      R3.label(F, [0.2, 0, o[1] * ks + 0.12], 'v = ' + o[2].toFixed(2) + ' m/s', '#7FD0FF', { size: 10, align: 'left' });
    } else {
      const xs = Gr.out.map(q => q[1]), lo = Math.min(...xs), hi = Math.max(...xs), ks = 3.4 / Math.max(1, hi - lo), x0 = -1.7 - lo * ks;
      R3.box(F, [0, 0, -0.03], [4.2, 0.6, 0.06], '#3A3F4A', { shadow: false });
      for (let m = Math.ceil(lo); m <= hi; m += Math.max(1, Math.round((hi - lo) / 10))) { const X = x0 + m * ks; path3(F, [[X, -0.3, 0.002], [X, -0.22, 0.002]], '#DCE6F8', { alpha: 0.8, width: 1.2, chunk: 1 }); R3.label(F, [X, -0.38, 0.01], m + ' m', '#8FA4CE', { size: 9 }); }
      path3(F, [[-2.1, 0, 0.002], [2.1, 0, 0.002]], '#E8D060', { alpha: 0.5, width: 1.5, dash: [8, 6], chunk: 1 });
      const X = x0 + o[1] * ks, dir = o[2] >= 0 ? 1 : -1;
      R3.box(F, [X, 0, 0.09], [0.34, 0.18, 0.1], '#3A6FB8', { shadow: true });
      R3.box(F, [X - 0.03 * dir, 0, 0.17], [0.18, 0.16, 0.07], '#2A4F88', { shadow: false });
      [[-0.1, -0.1], [0.1, -0.1], [-0.1, 0.1], [0.1, 0.1]].forEach(q => R3.cylinder(F, [X + q[0], q[1] - 0.015, 0.04], [X + q[0], q[1] + 0.015, 0.04], 0.04, '#1E222A', { segments: 12, shadow: false }));
      if (Math.abs(o[2]) > 1e-3) R3.arrow(F, [X, 0, 0.3], [X + o[2] * 0.08, 0, 0.3], 0.01, '#7FD0FF', { vivid: true });
      if (Math.abs(o[3]) > 1e-3) R3.arrow(F, [X, 0, 0.42], [X + o[3] * 0.12, 0, 0.42], 0.01, '#F5B451', { vivid: true });
      R3.label(F, [X, 0, 0.55], 'v = ' + o[2].toFixed(2) + ' m/s · a = ' + o[3].toFixed(2) + ' m/s²', '#DCE3EE', { size: 10 });
    }
    F.render();
    const nm = { const: 'constant acceleration', brake: 'speed up, then brake to rest', sine: 'an acceleration that swings back and forth', drop: 'a ball dropped, bouncing with e = ' + p.ebn.toFixed(2) }[p.prof];
    header(g, 'Straight-line motion: ' + nm, 't = ' + o[0].toFixed(2) + ' s · x = ' + o[1].toFixed(3) + ' m · v = ' + o[2].toFixed(3) + ' m/s · a = ' + o[3].toFixed(3) + ' m/s²',
      'slope of x–t = v · slope of v–t = a · area under v–t = displacement (signed); distance adds the areas without sign', th.text);
    panel(g, 'DISPLACEMENT AND DISTANCE', [
      ['displacement (end − start)', Gr.disp.toFixed(4) + ' m', th.phys],
      ['distance travelled', Gr.dist.toFixed(4) + ' m', th.phys],
      [p.prof === 'drop' ? 'comes to rest at' : 'turns round at', p.prof === 'drop' ? (isFinite(Gr.tRest) ? Gr.tRest.toFixed(3) + ' s (' + Gr.bounces + ' bounces)' : '—') : (Gr.turns.length ? Gr.turns.map(q => q.toFixed(3)).join(', ') + ' s' : 'never')],
      ['distance so far', o[4].toFixed(3) + ' m']
    ]);
  }

  /* ======================= 27.2 · projectiles ======================= */
  function drawProj(S, g) {
    const ctx = g.ctx, th = g.theme, p = S.p, cam = S.cam, Pj = S.Pj;
    const F = R3.Frame(ctx, cam, { ambient: 0.36, floorZ: null });
    const tt = S.ts % (Pj.T + 1.2), i = Math.min(Pj.out.length - 1, Math.round(Math.min(tt, Pj.T) / 0.01)), o = Pj.out[i];
    const ext = Math.max(Pj.Rx, S.vac.Rx || 0, Pj.yMax * 1.6, 2), ks = 3.4 / ext, al = Pj.al, X = x => -1.6 + x * ks;
    // the ground (or the incline) as a slab, with metre marks along it
    const gl = ext * 1.15, e1 = [Math.cos(al), 0, Math.sin(al)];
    const g0 = [X(-0.1 * ext), -0.5, -0.1 * ext * Math.tan(al) * ks], g1 = [X(gl), -0.5, gl * Math.tan(al) * ks];
    flatPoly(F, [g0, g1, [g1[0], 0.5, g1[2]], [g0[0], 0.5, g0[2]]], F.shade('#4E6A3A', [-Math.sin(al), 0, Math.cos(al)], { ambient: 0.55 }), { bias: F.GROUND });
    const step = ext > 60 ? 10 : ext > 20 ? 5 : ext > 8 ? 2 : 1;
    for (let m = 0; m <= gl; m += step) { const P = [X(m), -0.5, m * Math.tan(al) * ks]; path3(F, [P, V.add(P, [0, 0.08, 0])], '#DCE6F8', { alpha: 0.7, width: 1, chunk: 1 }); R3.label(F, V.add(P, [0, -0.08, -0.04]), m + ' m', '#AFC2A0', { size: 8.5 }); }
    // the launcher
    const base = [X(0), 0, p.h0 * ks];
    if (p.h0 > 0) R3.box(F, [X(0) - 0.1, 0, p.h0 * ks / 2], [0.25, 0.25, p.h0 * ks], '#5A6478', { shadow: false });
    R3.cylinder(F, base, V.add(base, [0.22 * Math.cos(Pj.th), 0, 0.22 * Math.sin(Pj.th)]), 0.03, '#39414F', { segments: 14, shadow: false });
    // the vacuum path (ghost) and the path so far
    if (p.drag !== 'none' && S.vac) path3(F, S.vac.out.filter((q, j) => j % 3 === 0).map(q => [X(q[1]), 0, q[2] * ks]), '#DCE3EE', { alpha: 0.3, width: 1.2, dash: [4, 4], chunk: 4 });
    const tr = Pj.out.filter((q, j) => j <= i && j % 2 === 0).map(q => [X(q[1]), 0, q[2] * ks]);
    if (tr.length > 1) path3(F, tr, '#FF8A7A', { alpha: 0.9, width: 2, chunk: 4 });
    const c = [X(o[1]), 0, o[2] * ks];
    R3.sphere(F, c, 0.05, '#E0453A', { shadow: false, vivid: true });
    const sv = 0.04;
    R3.arrow(F, c, V.add(c, [o[3] * sv, 0, 0]), 0.008, '#7FD0FF', { vivid: true });
    R3.arrow(F, c, V.add(c, [0, 0, o[4] * sv]), 0.008, '#7CF0B0', { vivid: true });
    R3.label(F, V.add(c, [o[3] * sv + 0.06, 0, 0]), 'vx ' + o[3].toFixed(1), '#7FD0FF', { size: 9, align: 'left' });
    R3.label(F, V.add(c, [0.04, 0, o[4] * sv + (o[4] > 0 ? 0.05 : -0.05)]), 'vy ' + o[4].toFixed(1), '#7CF0B0', { size: 9, align: 'left' });
    const top = Pj.out.reduce((b, q) => q[2] > b[2] ? q : b, Pj.out[0]);
    R3.label(F, [X(top[1]), 0, top[2] * ks + 0.12], 'H = ' + Pj.yMax.toFixed(2) + ' m', '#FFD36B', { size: 9.5 });
    const land = Pj.out[Pj.out.length - 1]; R3.sphere(F, [X(land[1]), 0, land[2] * ks], 0.025, '#FFD36B', { shadow: false, vivid: true });
    R3.label(F, [X(land[1]), 0, land[2] * ks + 0.14], 'lands: ' + (al ? Pj.Ralong.toFixed(2) + ' m up the slope' : 'R = ' + Pj.Rx.toFixed(2) + ' m'), '#FFD36B', { size: 9.5 });
    F.render();
    const dn = { none: 'in vacuum', lin: 'with linear drag (k = ' + p.kd.toFixed(3) + ' /s)', quad: 'with quadratic drag (k = ' + p.kd.toFixed(4) + ' /m)' }[p.drag];
    header(g, 'A projectile at ' + p.up.toFixed(1) + ' m/s, ' + p.ang.toFixed(1) + '° ' + dn + (p.slope ? ' · onto a ' + p.slope.toFixed(0) + '° slope' : '') + (p.h0 ? ' · from ' + p.h0.toFixed(1) + ' m up' : ''),
      't = ' + o[0].toFixed(2) + ' s · x = ' + o[1].toFixed(2) + ' m, y = ' + o[2].toFixed(2) + ' m · speed ' + Math.hypot(o[3], o[4]).toFixed(2) + ' m/s',
      'RK4 with the drag force; the landing is interpolated inside the step · in vacuum vx never changes and vy falls at g', th.text);
    const V0 = S.pv;
    panel(g, 'THE FLIGHT', [
      ['range (the run)', (al ? Pj.Ralong : Pj.Rx).toFixed(4) + ' m', th.phys],
      ['range in vacuum (formula)', p.h0 === 0 ? V0.Ral.toFixed(4) + ' m' : '—', th.ok],
      ['time of flight · formula', Pj.T.toFixed(4) + ' · ' + (p.h0 === 0 ? V0.T.toFixed(4) : '—') + ' s'],
      ['greatest height', Pj.yMax.toFixed(4) + ' m'],
      [p.h0 === 0 && p.drag === 'none' ? 'best angle (searched) · 45° + α/2' : 'best angle (searched) · 45° + α/2 would say', S.best.ang.toFixed(2) + '° · ' + V0.thBest.toFixed(1) + '°' + (p.h0 === 0 && p.drag === 'none' ? '' : ' (not valid here)'), p.h0 === 0 && p.drag === 'none' ? th.ok : null],
      ['range at the best angle', S.best.R.toFixed(3) + ' m']
    ]);
  }

  /* ======================= 27.3 · the river ======================= */
  function drawRiver(S, g) {
    const ctx = g.ctx, th = g.theme, p = S.p, cam = S.cam, Rv = S.Rv;
    const F = R3.Frame(ctx, cam, { ambient: 0.4, floorZ: null });
    const ext = Math.max(p.dw, Math.abs(isFinite(Rv.drift) ? Rv.drift : 0) + p.dw * 0.3), ks = 2.6 / ext, W = p.dw * ks, y0 = -W / 2;
    const xl = -1.6, xr = 1.9;
    flatPoly(F, [[xl, y0, 0], [xr, y0, 0], [xr, y0 + W, 0], [xl, y0 + W, 0]], '#1F4E7A', { bias: F.GROUND });
    [[y0 - 0.25, y0], [y0 + W, y0 + W + 0.25]].forEach(([a, b]) => R3.box(F, [(xl + xr) / 2, (a + b) / 2, 0.02], [xr - xl, b - a, 0.06], '#3E6B33', { shadow: false }));
    // the flow: streaks drifting downstream at the local speed; arrows show the profile
    const tt = S.ts;
    for (let k = 1; k < 9; k++) { const yy = k / 9 * p.dw, u = flowAt(p, yy), Y = y0 + yy * ks;
      for (let j = 0; j < 5; j++) { const xx = xl + ((j * 0.8 + u * ks * tt * 0.5) % (xr - xl)); path3(F, [[xx, Y, 0.004], [Math.min(xr, xx + 0.12 + u * 0.03), Y, 0.004]], '#9FD8FF', { alpha: 0.5, width: 1.2, chunk: 1 }); }
      R3.arrow(F, [xl + 0.05, Y, 0.01], [xl + 0.05 + u * 0.08, Y, 0.01], 0.006, '#9FD8FF', {}); }
    // the boat along its path
    const T = Rv.T, tb = isFinite(T) ? (S.ts % (T + 1.5)) : 0, out = Rv.out;
    const i = out.length ? Math.min(out.length - 1, out.findIndex(q => q[0] >= Math.min(tb, T)) >>> 0) : 0;
    const q = out[Math.min(out.length - 1, Math.max(0, i))] || [0, 0, 0], c = [q[1] * ks - 1.0, y0 + q[2] * ks, 0];
    const hd = [-Math.sin(Rv.ph), Math.cos(Rv.ph)];
    hull(F, c, hd, 0.2, 0.08, '#C9824A');
    const tr = out.filter((r, j) => j <= i && j % 3 === 0).map(r => [r[1] * ks - 1.0, y0 + r[2] * ks, 0.006]);
    if (tr.length > 1) path3(F, tr, '#FFE2B8', { alpha: 0.85, width: 1.8, chunk: 4 });
    // velocities at the boat: relative to water, the flow there, the resultant
    const u = flowAt(p, q[2]), sc = 0.07, vb = [-p.vb * Math.sin(Rv.ph), p.vb * Math.cos(Rv.ph)], vres = [vb[0] + u, vb[1]], z = 0.08;
    R3.arrow(F, V.add(c, [0, 0, z]), V.add(c, [vb[0] * sc, vb[1] * sc, z]), 0.008, '#F5B451', { vivid: true });
    R3.arrow(F, V.add(c, [vb[0] * sc, vb[1] * sc, z]), V.add(c, [vres[0] * sc, vres[1] * sc, z]), 0.008, '#9FD8FF', { vivid: true });
    R3.arrow(F, V.add(c, [0, 0, z + 0.01]), V.add(c, [vres[0] * sc, vres[1] * sc, z + 0.01]), 0.009, '#7CF0B0', { vivid: true });
    R3.label(F, V.add(c, [vres[0] * sc + 0.06, vres[1] * sc, z]), 'ground velocity', '#7CF0B0', { size: 9, align: 'left' });
    // start, the point straight across, and where it lands
    R3.sphere(F, [-1.0, y0, 0.02], 0.02, '#FFFFFF', { shadow: false });
    R3.sphere(F, [-1.0, y0 + W, 0.02], 0.025, '#FFD36B', { shadow: false, vivid: true }); R3.label(F, [-1.0, y0 + W + 0.1, 0.03], Math.abs(Rv.drift) <= 0.03 * p.dw ? 'lands straight across' : 'straight across', '#FFD36B', { size: 9 });
    if (isFinite(Rv.drift) && Math.abs(Rv.drift) > 0.03 * p.dw) { R3.sphere(F, [Rv.drift * ks - 1.0, y0 + W, 0.02], 0.025, '#FF8FB0', { shadow: false, vivid: true }); R3.label(F, [Rv.drift * ks - 1.0, y0 + W + 0.18, 0.03], 'lands ' + Rv.drift.toFixed(1) + ' m ' + (Rv.drift >= 0 ? 'downstream' : 'upstream'), '#FF8FB0', { size: 9 }); }
    R3.label(F, [xr - 0.1, y0 - 0.12, 0.05], 'flow →', '#9FD8FF', { size: 10, align: 'right' });
    F.render();
    header(g, 'River ' + p.dw.toFixed(0) + ' m · boat ' + p.vb.toFixed(1) + ' m/s · flow ' + p.vr.toFixed(1) + ' m/s' + (p.profile === 'uniform' ? '' : ' (mean)') + ' · heading ' + p.head.toFixed(1) + '° upstream',
      isFinite(T) ? 't = ' + Math.min(tb, T).toFixed(1) + ' s of ' + T.toFixed(2) + ' s' : 'heading too far upstream: it never gets across',
      'amber: the boat relative to the water · blue: the water · green: the sum, relative to the ground', th.text);
    panel(g, 'TIME AND DRIFT', [
      ['time to cross', isFinite(T) ? T.toFixed(3) + ' s' : '—', th.phys],
      ['drift downstream', isFinite(Rv.drift) ? (Math.abs(Rv.drift) < 5e-4 ? 0 : Rv.drift).toFixed(3) + ' m' : '—', th.phys],
      ['quickest: head straight across', (p.dw / p.vb).toFixed(3) + ' s', th.ok],
      [p.vb > p.vr ? 'no drift: head sin⁻¹(v_r/v_b) up' : 'least drift: head sin⁻¹(v_b/v_r) up', (Math.asin(Math.min(1, p.vb > p.vr ? p.vr / p.vb : p.vb / p.vr)) * 180 / Math.PI).toFixed(2) + '°', th.ok],
      ['least drift (searched)', S.minDrift.drift.toFixed(3) + ' m at ' + S.minDrift.head.toFixed(2) + '°']
    ]);
  }

  /* ======================= 27.4 · two ships ======================= */
  function drawShips(S, g) {
    const ctx = g.ctx, th = g.theme, p = S.p, cam = S.cam, Sh = S.Sh;
    const F = R3.Frame(ctx, cam, { ambient: 0.4, floorZ: null });
    const all = Sh.out.flatMap(q => [q[1], q[2], q[3], q[4]]), ext = Math.max(...all.map(Math.abs), 10), ks = 1.7 / ext;
    flatPoly(F, [[-2.2, -2.2, 0], [2.2, -2.2, 0], [2.2, 2.2, 0], [-2.2, 2.2, 0]], '#173F63', { bias: F.GROUND });
    for (let k = -4; k <= 4; k++) { path3(F, [[k * 0.5, -2.2, 0.002], [k * 0.5, 2.2, 0.002]], '#2F6090', { alpha: 0.5, width: 1, chunk: 1 }); path3(F, [[-2.2, k * 0.5, 0.002], [2.2, k * 0.5, 0.002]], '#2F6090', { alpha: 0.5, width: 1, chunk: 1 }); }
    R3.label(F, [0, 2.1, 0.02], 'N ↑', '#9FD8FF', { size: 10 });
    const tt = S.ts % (Sh.tEnd + 1), i = Math.min(Sh.out.length - 1, Math.round(Math.min(tt, Sh.tEnd) / Sh.tEnd * 2000)), o = Sh.out[i];
    const A = [o[1] * ks, o[2] * ks, 0], B = [o[3] * ks, o[4] * ks, 0];
    const wake = k => Sh.out.filter((q, j) => j <= i && j % 20 === 0).map(q => [q[k] * ks, q[k + 1] * ks, 0.004]);
    [[1, '#F5B451'], [3, '#FF8FB0']].forEach(([k, c]) => { const w = wake(k); if (w.length > 1) path3(F, w, c, { alpha: 0.6, width: 1.6, chunk: 4 }); });
    const nA = V.norm([Sh.va[0], Sh.va[1], 0]), nB = V.norm([Sh.vB[0], Sh.vB[1], 0]);
    hull(F, A, [nA[0], nA[1]], 0.22, 0.08, '#E0A040'); hull(F, B, [nB[0], nB[1]], 0.22, 0.08, '#E06080');
    R3.label(F, V.add(A, [0, 0, 0.16]), 'A', '#F5B451', { size: 11 }); R3.label(F, V.add(B, [0, 0, 0.16]), 'B', '#FF8FB0', { size: 11 });
    path3(F, [V.add(A, [0, 0, 0.05]), V.add(B, [0, 0, 0.05])], '#DCE3EE', { alpha: 0.7, width: 1.2, dash: [4, 3], chunk: 1 });
    R3.label(F, V.add(V.mul(V.add(A, B), 0.5), [0, 0, 0.1]), o[5].toFixed(1) + ' m', '#DCE3EE', { size: 10 });
    // where they are at the closest moment
    const Am = [Sh.va[0] * Sh.tMin * ks, Sh.va[1] * Sh.tMin * ks, 0.01], Bm = [(Sh.r0[0] + Sh.vB[0] * Sh.tMin) * ks, (Sh.r0[1] + Sh.vB[1] * Sh.tMin) * ks, 0.01];
    path3(F, [Am, Bm], '#7CF0B0', { alpha: 0.9, width: 2, chunk: 1 });
    R3.label(F, V.add(V.mul(V.add(Am, Bm), 0.5), [0, 0, 0.12]), 'closest: ' + Sh.dMin.toFixed(2) + ' m', '#7CF0B0', { size: 10 });
    F.render();
    header(g, 'Two ships · A: ' + p.vA.toFixed(1) + ' m/s at ' + p.hA.toFixed(0) + '° · B: ' + p.vB.toFixed(1) + ' m/s at ' + p.hB.toFixed(0) + '°, from (' + p.xB.toFixed(0) + ', ' + p.yB.toFixed(0) + ') m',
      't = ' + o[0].toFixed(2) + ' s · separation ' + o[5].toFixed(2) + ' m',
      'seen from A, B moves in a straight line with v_B − v_A: the closest approach is the perpendicular from A to that line', th.text);
    panel(g, 'CLOSEST APPROACH', [
      ['least separation (the run)', Sh.dMin.toFixed(4) + ' m', th.phys],
      ['|r₀ × v_rel| / |v_rel|', Sh.dMinF.toFixed(4) + ' m', th.ok],
      ['when (the run) · −r₀·v_rel/|v_rel|²', Sh.tMin.toFixed(3) + ' · ' + Sh.tStar.toFixed(3) + ' s'],
      ['relative velocity of B', '(' + Sh.vr[0].toFixed(2) + ', ' + Sh.vr[1].toFixed(2) + ') m/s, ' + Math.hypot(Sh.vr[0], Sh.vr[1]).toFixed(2) + ' m/s']
    ]);
  }

  const GRM = S => S.p.mode === 'graphs', PJM = S => S.p.mode === 'proj', RVM = S => S.p.mode === 'river', SHM = S => S.p.mode === 'ships';
  function leastDrift(p) {
    const f = h => { const r = runRiver(p, h, true); return r.never ? Infinity : Math.abs(r.drift); };
    let best = 0, bv = Infinity; for (let h = -89; h <= 89; h += 0.5) { const v = f(h); if (v < bv) { bv = v; best = h; } }
    let a = best - 0.5, b = best + 0.5; for (let i = 0; i < 50; i++) { const m1 = a + (b - a) / 3, m2 = b - (b - a) / 3; if (f(m1) < f(m2)) b = m2; else a = m1; }
    const h = (a + b) / 2; return { head: h, drift: runRiver(p, h, true).drift };
  }

  L.register({
    id: 'kinematics', subject: 'physics',
    name: 'Kinematics — Motion Graphs, Projectiles with Drag and on Slopes, the River, Closest Approach',
    chapter: 'Motion in a Straight Line & in a Plane',
    exams: ['JEE Main', 'JEE Advanced', 'NEET UG'],
    weight: 'Very high yield',
    is3D: true,
    stageHint: 'Drag to orbit · every path here is integrated (RK4), then checked against the formula',
    lede: 'Kinematics as the exam asks it. A car and a bouncing ball drive <b>linked x–t, v–t and a–t graphs</b> — slopes and areas read off ' +
      'the same run, with <b>displacement and distance</b> kept apart. Projectiles fly <b>in vacuum or through air</b>, from a height or onto a ' +
      '<b>slope</b>, and the best angle is searched for, not quoted. A boat crosses a <b>river</b> (uniform, or fastest mid-stream). Two ships ' +
      'close in, and the <b>closest approach</b> comes from the relative velocity.',

    params: { mode: 'graphs', prof: 'const', v0g: 8, a0g: -2, t1g: 5, a2g: 4, Tsg: 4, hdrop: 5, ebn: 0.5, tEg: 6,
              up: 20, ang: 30, h0: 0, drag: 'none', kd: 0.01, slope: 0,
              dw: 100, vb: 5, vr: 3, head: 0, profile: 'uniform',
              vA: 10, hA: 0, vB: 10, hB: 270, xB: 100, yB: 0, run: true },

    presets: [
      { name: 'Thrown forward, braking: it turns round', params: { mode: 'graphs', prof: 'const', v0g: 8, a0g: -2, tEg: 6 } },
      { name: 'Speed up, then brake to rest', params: { mode: 'graphs', prof: 'brake', v0g: 0, a0g: 2, t1g: 5, a2g: 4, tEg: 10 } },
      { name: 'An acceleration that swings', params: { mode: 'graphs', prof: 'sine', v0g: 0, a0g: 2, Tsg: 4, tEg: 8 } },
      { name: 'A dropped ball bouncing (e = 0.5)', params: { mode: 'graphs', prof: 'drop', hdrop: 5, ebn: 0.5, tEg: 4 } },
      { name: 'Projectile · 20 m/s at 30°', params: { mode: 'proj', up: 20, ang: 30, h0: 0, drag: 'none', slope: 0 } },
      { name: 'Projectile · from a 20 m cliff', params: { mode: 'proj', up: 15, ang: 30, h0: 20, drag: 'none', slope: 0 } },
      { name: 'Up a 30° slope: best at 60°', params: { mode: 'proj', up: 20, ang: 60, h0: 0, drag: 'none', slope: 30 } },
      { name: 'Air drag: shorter, and best below 45°', params: { mode: 'proj', up: 30, ang: 45, h0: 0, drag: 'quad', kd: 0.01, slope: 0 } },
      { name: 'River · head straight across (quickest)', params: { mode: 'river', dw: 100, vb: 5, vr: 3, head: 0, profile: 'uniform' } },
      { name: 'River · head upstream: no drift', params: { mode: 'river', dw: 100, vb: 5, vr: 3, head: 36.87, profile: 'uniform' } },
      { name: 'River faster than the boat: least drift', params: { mode: 'river', dw: 100, vb: 3, vr: 5, head: 36.87, profile: 'uniform' } },
      { name: 'River fastest mid-stream', params: { mode: 'river', dw: 100, vb: 5, vr: 3, head: 0, profile: 'parab' } },
      { name: 'Two ships at right angles', params: { mode: 'ships', vA: 10, hA: 0, vB: 10, hB: 270, xB: 100, yB: 0 } },
      { name: 'Overtaking at an angle', params: { mode: 'ships', vA: 8, hA: 30, vB: 12, hB: 10, xB: -60, yB: -80 } }
    ],

    controls: [
      { group: 'Bench', items: [
        { key: 'mode', type: 'select', label: 'Experiment', restructure: true, rebuild: true, options: [
          { value: 'graphs', label: 'Motion graphs' }, { value: 'proj', label: 'Projectiles' }, { value: 'river', label: 'The river crossing' }, { value: 'ships', label: 'Two ships: closest approach' }] }
      ] },
      { group: 'Straight-line motion', items: [
        { key: 'prof', type: 'select', label: 'The motion', restructure: true, when: GRM, options: [{ value: 'const', label: 'Constant acceleration' }, { value: 'brake', label: 'Speed up, then brake' }, { value: 'sine', label: 'Swinging acceleration' }, { value: 'drop', label: 'A bouncing ball' }] },
        { key: 'v0g', label: 'Initial velocity', min: -10, max: 15, step: 0.1, unit: 'm/s', when: S => GRM(S) && S.p.prof !== 'drop', fmt: v => v.toFixed(1), restructure: true },
        { key: 'a0g', label: 'Acceleration', min: -5, max: 5, step: 0.1, unit: 'm/s²', when: S => GRM(S) && S.p.prof !== 'drop', fmt: v => v.toFixed(1), restructure: true },
        { key: 't1g', label: 'Brakes at', min: 1, max: 8, step: 0.1, unit: 's', when: S => GRM(S) && S.p.prof === 'brake', fmt: v => v.toFixed(1), restructure: true },
        { key: 'a2g', label: 'Braking', min: 0.5, max: 10, step: 0.1, unit: 'm/s²', when: S => GRM(S) && S.p.prof === 'brake', fmt: v => v.toFixed(1), restructure: true },
        { key: 'Tsg', label: 'Swing period', min: 1, max: 10, step: 0.1, unit: 's', when: S => GRM(S) && S.p.prof === 'sine', fmt: v => v.toFixed(1), restructure: true },
        { key: 'hdrop', label: 'Drop height', min: 0.5, max: 20, step: 0.1, unit: 'm', when: S => GRM(S) && S.p.prof === 'drop', fmt: v => v.toFixed(1), restructure: true },
        { key: 'ebn', label: 'Restitution e', min: 0, max: 0.95, step: 0.01, unit: '', when: S => GRM(S) && S.p.prof === 'drop', fmt: v => v.toFixed(2), restructure: true },
        { key: 'tEg', label: 'Watch for', min: 1, max: 20, step: 0.5, unit: 's', when: GRM, fmt: v => v.toFixed(1), restructure: true }
      ] },
      { group: 'The projectile', items: [
        { key: 'up', label: 'Launch speed', min: 1, max: 60, step: 0.5, unit: 'm/s', when: PJM, fmt: v => v.toFixed(1), restructure: true },
        { key: 'ang', label: 'Launch angle', min: -30, max: 89, step: 0.5, unit: '°', when: PJM, fmt: v => v.toFixed(1), restructure: true },
        { key: 'h0', label: 'Launch height', min: 0, max: 50, step: 0.5, unit: 'm', when: PJM, fmt: v => v.toFixed(1), restructure: true },
        { key: 'slope', label: 'Ground slope α', min: -30, max: 45, step: 1, unit: '°', when: PJM, fmt: v => v.toFixed(0), restructure: true },
        { key: 'drag', type: 'select', label: 'Air', restructure: true, when: PJM, options: [{ value: 'none', label: 'Vacuum' }, { value: 'lin', label: 'Linear drag (−kv)' }, { value: 'quad', label: 'Quadratic drag (−k|v|v)' }] },
        { key: 'kd', label: 'Drag constant k', min: 0.001, max: 0.3, step: 0.001, unit: '', when: S => PJM(S) && S.p.drag !== 'none', fmt: v => v.toFixed(3), restructure: true }
      ] },
      { group: 'The river', items: [
        { key: 'head', label: 'Heading (upstream of straight across)', min: -80, max: 85, step: 0.1, unit: '°', when: RVM, fmt: v => v.toFixed(1), restructure: true },
        { key: 'vb', label: 'Boat speed in water', min: 0.5, max: 10, step: 0.1, unit: 'm/s', when: RVM, fmt: v => v.toFixed(1), restructure: true },
        { key: 'vr', label: 'River speed (mean)', min: 0, max: 10, step: 0.1, unit: 'm/s', when: RVM, fmt: v => v.toFixed(1), restructure: true },
        { key: 'dw', label: 'Width', min: 20, max: 400, step: 5, unit: 'm', when: RVM, fmt: v => v.toFixed(0), restructure: true },
        { key: 'profile', type: 'select', label: 'Flow across the river', restructure: true, when: RVM, options: [{ value: 'uniform', label: 'Uniform' }, { value: 'parab', label: 'Fastest mid-stream' }] }
      ] },
      { group: 'The ships', items: [
        { key: 'vA', label: 'Speed of A', min: 0, max: 20, step: 0.1, unit: 'm/s', when: SHM, fmt: v => v.toFixed(1), restructure: true },
        { key: 'hA', label: 'Heading of A (from north)', min: 0, max: 359, step: 1, unit: '°', when: SHM, fmt: v => v.toFixed(0), restructure: true },
        { key: 'vB', label: 'Speed of B', min: 0, max: 20, step: 0.1, unit: 'm/s', when: SHM, fmt: v => v.toFixed(1), restructure: true },
        { key: 'hB', label: 'Heading of B (from north)', min: 0, max: 359, step: 1, unit: '°', when: SHM, fmt: v => v.toFixed(0), restructure: true },
        { key: 'xB', label: 'B starts east of A by', min: -200, max: 200, step: 1, unit: 'm', when: SHM, fmt: v => v.toFixed(0), restructure: true },
        { key: 'yB', label: 'B starts north of A by', min: -200, max: 200, step: 1, unit: 'm', when: SHM, fmt: v => v.toFixed(0), restructure: true }
      ] },
      { group: 'Display', items: [
        { key: 'run', type: 'toggle', label: 'Let it run' }
      ] }
    ],

    setup(S) {
      const p = S.p;
      if (p.mode === 'graphs') S.Gr = runGraphs(p);
      else if (p.mode === 'proj') { S.Pj = runProj(p); S.vac = p.drag === 'none' ? S.Pj : runProj(Object.assign({}, p, { drag: 'none' })); S.pv = projVac(p); S.best = bestAngle(p);
        S.rangeCurve = []; for (let a = Math.max(p.slope + 1, 2); a <= 88; a += 3) S.rangeCurve.push([a, runProj(p, a, true).Ralong, runProj(Object.assign({}, p, { drag: 'none' }), a, true).Ralong]); }
      else if (p.mode === 'river') { S.Rv = runRiver(p); S.minDrift = leastDrift(p);
        S.riverCurve = []; for (let h = -80; h <= 85; h += 1) { const r = runRiver(p, h, true); if (!r.never) S.riverCurve.push([h, r.T, r.drift]); } }
      else S.Sh = runShips(p);
      S.ts = 0;
      const views = {
        graphs: p.prof === 'drop' ? { theta: -1.5, phi: 0.15, dist: 3, target: [0, 0, 0.8] } : { theta: -1.4, phi: 0.35, dist: 3.1, target: [0, 0, 0.15] },
        proj: { theta: -1.57, phi: 0.12, dist: 4.3, target: [0.1, 0, 0.8] },
        river: { theta: -1.57, phi: 1.0, dist: 4.2, target: [0.1, 0, 0] },
        ships: { theta: -1.57, phi: 1.15, dist: 3.4, target: [0, 0, 0] }
      };
      const vk = p.mode + (p.mode === 'graphs' && p.prof === 'drop' ? 'd' : '');
      if (!S.cam || S._view !== vk) { S.cam = Camera(views[p.mode]); S.cam.minDist = 0.8; S.cam.maxDist = 14; S._view = vk; S._narrowCam = false; }
    },

    step(S, dt) { if (S.p.run) S.ts += dt; },

    drawStage(S, g) {
      if (g.w < 660 && !S._narrowCam) { S.cam.dist *= 1.3; S._narrowCam = true; }
      const md = S.p.mode;
      if (md === 'graphs') drawGraphs(S, g); else if (md === 'proj') drawProj(S, g); else if (md === 'river') drawRiver(S, g); else drawShips(S, g);
    },

    plots: [
      { title: S => ({ graphs: S.p.prof === 'drop' ? 'Height against time' : 'Position against time — the slope is the velocity', proj: 'The path (the run, and the same launch in vacuum)', river: 'The path seen from above', ships: 'Separation against time' })[S.p.mode],
        draw(S, g) {
          const p = S.p, th = g.theme, cy = '#3DD6F5', gr = '#7CF0B0', am = '#F5B451', pk = '#FF8FB0';
          if (p.mode === 'graphs') {
            const Gr = S.Gr, o = Gr.out, xs = o.map(q => q[1]), lo = Math.min(...xs), hi = Math.max(...xs), pad = (hi - lo) * 0.1 + 0.1;
            const P = g.Plot({ xmin: 0, xmax: Gr.tEnd, ymin: lo - pad, ymax: hi + pad, xlabel: 't (s)', ylabel: p.prof === 'drop' ? 'height (m)' : 'x (m)', xfmt: v => v.toFixed(1), yfmt: v => v.toFixed(1) }).frame();
            const tt = Math.min(S.ts % (Gr.tEnd + 1), Gr.tEnd), q = o[Math.min(o.length - 1, Math.round(tt / 0.01))];
            P.clip(() => { P.line(o.map(r => [r[0], r[1]]), cy, 2.4); const w = Gr.tEnd * 0.12; P.line([[q[0] - w, q[1] - q[2] * w], [q[0] + w, q[1] + q[2] * w]], am, 1.8); P.dot(q[0], q[1], 5, am, th['ink-950']); Gr.turns.forEach(t => P.vline(t, g.alpha(pk, .7), [3, 3])); });
            P.tag(Gr.tEnd * 0.98, hi + pad * 0.5, 'amber: the tangent now — its slope is v = ' + q[2].toFixed(2) + ' m/s', am, 'right', 0);
            return;
          }
          if (p.mode === 'proj') {
            const Pj = S.Pj, run = Pj.out.map(q => [q[1], q[2]]), vac = S.vac.out.map(q => [q[1], q[2]]), xm = Math.max(...run.map(q => q[0]), ...vac.map(q => q[0])) * 1.05 + 0.1;
            const ymx = Math.max(...run.map(q => q[1]), ...vac.map(q => q[1])) * 1.15 + 0.1, ymn = Math.min(0, ...run.map(q => q[1]), ...vac.map(q => q[1]));
            const P = g.Plot({ xmin: 0, xmax: xm, ymin: ymn, ymax: ymx, xlabel: 'x (m)', ylabel: 'y (m)', xfmt: v => v.toFixed(0), yfmt: v => v.toFixed(0) }).frame();
            P.clip(() => { P.line([[0, 0], [xm, xm * Math.tan(Pj.al)]], g.alpha(gr, .7), 1.4); if (p.drag !== 'none') P.line(vac, g.alpha(th.text, .5), 1.4, [5, 3]); P.line(run, pk, 2.4); });
            P.tag(xm * 0.98, ymx * 0.92, p.drag !== 'none' ? 'pink: through air · dashed: the same launch in vacuum' : 'green: the ground', th['text-2'], 'right', 0);
            return;
          }
          if (p.mode === 'river') {
            const Rv = S.Rv, pts = Rv.out.map(q => [q[1], q[2]]), xmx = Math.max(10, ...pts.map(q => Math.abs(q[0]))) * 1.15;
            const P = g.Plot({ xmin: -xmx, xmax: xmx, ymin: 0, ymax: p.dw * 1.05, xlabel: 'downstream (m)', ylabel: 'across (m)', xfmt: v => v.toFixed(0), yfmt: v => v.toFixed(0) }).frame();
            P.clip(() => { P.vline(0, g.alpha(th['text-3'], .7), [3, 3]); P.hline(p.dw, g.alpha(gr, .7)); P.line(pts, am, 2.4); });
            P.tag(0, p.dw, 'the far bank', gr, 'left', -8);
            return;
          }
          const Sh = S.Sh, P = g.Plot({ xmin: 0, xmax: Sh.tEnd, ymin: 0, ymax: Math.max(...Sh.out.map(q => q[5])) * 1.1, xlabel: 't (s)', ylabel: 'separation (m)', xfmt: v => v.toFixed(0), yfmt: v => v.toFixed(0) }).frame();
          P.clip(() => { P.line(Sh.out.map(q => [q[0], q[5]]), cy, 2.4); P.dot(Sh.tMin, Sh.dMin, 5.5, gr, th['ink-950']); P.vline(S.ts % (Sh.tEnd + 1), g.alpha(am, .6), [3, 3]); });
          P.tag(Sh.tMin, Sh.dMin, 'least: ' + Sh.dMin.toFixed(2) + ' m at ' + Sh.tMin.toFixed(2) + ' s', gr, 'left', 14);
        } },
      { title: S => ({ graphs: 'Velocity (and acceleration) against time — the area is the displacement', proj: 'Range against launch angle', river: 'Crossing time and drift against the heading', ships: 'B seen from A: a straight line past A' })[S.p.mode],
        draw(S, g) {
          const p = S.p, th = g.theme, cy = '#3DD6F5', gr = '#7CF0B0', am = '#F5B451', pk = '#FF8FB0';
          if (p.mode === 'graphs') {
            const Gr = S.Gr, o = Gr.out, vs = o.map(q => q[2]).concat(o.map(q => q[3])), lo = Math.min(0, ...vs), hi = Math.max(0.1, ...vs), pad = (hi - lo) * 0.1;
            const P = g.Plot({ xmin: 0, xmax: Gr.tEnd, ymin: lo - pad, ymax: hi + pad, xlabel: 't (s)', ylabel: 'v (m/s) · a (m/s²)', xfmt: v => v.toFixed(1), yfmt: v => v.toFixed(1) }).frame();
            P.clip(() => { P.area(o.map(q => [q[0], Math.max(0, q[2])]), 0, g.alpha(cy, .16)); P.area(o.map(q => [q[0], Math.min(0, q[2])]), 0, g.alpha(pk, .18));
              P.hline(0, g.alpha(th['text-3'], .7)); P.line(o.map(q => [q[0], q[3]]), am, 1.6, [5, 3]); P.line(o.map(q => [q[0], q[2]]), cy, 2.4); P.vline(Math.min(S.ts % (Gr.tEnd + 1), Gr.tEnd), g.alpha(gr, .6), [3, 3]); });
            P.tag(Gr.tEnd * 0.98, hi + pad * 0.3, 'blue: v · amber dashed: a · shaded above − below = displacement ' + Gr.disp.toFixed(2) + ' m', th['text-2'], 'right', 0);
            return;
          }
          if (p.mode === 'proj') {
            const c = S.rangeCurve, hi = Math.max(...c.map(q => Math.max(q[1], q[2]))) * 1.12;
            const P = g.Plot({ xmin: Math.min(...c.map(q => q[0])), xmax: 90, ymin: 0, ymax: hi, xlabel: 'launch angle (°)', ylabel: 'range along the ground (m)', xfmt: v => v.toFixed(0), yfmt: v => v.toFixed(0) }).frame();
            P.clip(() => { if (p.drag !== 'none') P.line(c.map(q => [q[0], q[2]]), g.alpha(th.text, .5), 1.4, [5, 3]); P.line(c.map(q => [q[0], q[1]]), cy, 2.4); P.vline(S.best.ang, g.alpha(gr, .8), [3, 3]); P.dot(p.ang, S.Pj.Ralong, 5.5, am, th['ink-950']); });
            P.tag(S.best.ang, hi * 0.95, 'best: ' + S.best.ang.toFixed(1) + '°', gr, 'left', 0);
            if (p.drag !== 'none') P.tag(88, c[c.length - 1][2], 'dashed: vacuum', th['text-3'], 'right', -8);
            return;
          }
          if (p.mode === 'river') {
            const c = S.riverCurve, Tm = Math.min(Math.max(...c.map(q => q[1])), 5 * p.dw / p.vb), dm = Math.max(...c.map(q => Math.abs(q[2])).filter(isFinite));
            const lim = Math.max(Tm, 1), P = g.Plot({ xmin: -80, xmax: 85, ymin: -lim, ymax: lim, xlabel: 'heading, upstream of straight across (°)', ylabel: 'time (s) · drift (m, scaled)', xfmt: v => v.toFixed(0), yfmt: v => v.toFixed(0) }).frame();
            const sc = lim / Math.max(1e-9, Math.min(dm, 5 * p.dw));
            P.clip(() => { P.hline(0, g.alpha(th['text-3'], .7)); P.line(c.map(q => [q[0], Math.min(lim, q[1])]), am, 2.2); P.line(c.map(q => [q[0], Math.max(-lim, Math.min(lim, q[2] * sc))]), cy, 2.2); P.vline(p.head, g.alpha(gr, .8), [3, 3]); P.vline(S.minDrift.head, g.alpha(pk, .8), [2, 4]); });
            P.tag(-78, lim * 0.9, 'amber: crossing time · blue: drift (× ' + sc.toFixed(2) + ') · pink: least drift', th['text-2'], 'left', 0);
            return;
          }
          const Sh = S.Sh, rel = Sh.out.map(q => [q[3] - q[1], q[4] - q[2]]), ext = Math.max(...rel.map(q => Math.max(Math.abs(q[0]), Math.abs(q[1])))) * 1.1;
          const asp = Math.max(0.2, (g.h - 44) / Math.max(1, g.w - 66));
          const P = g.Plot({ xmin: -ext / asp, xmax: ext / asp, ymin: -ext, ymax: ext, xlabel: 'east of A (m)', ylabel: 'north of A (m)', xfmt: v => v.toFixed(0), yfmt: v => v.toFixed(0) }).frame();
          const foot = [Sh.r0[0] + Sh.vr[0] * Sh.tMin, Sh.r0[1] + Sh.vr[1] * Sh.tMin];
          P.clip(() => { P.line(rel, pk, 2.2); P.line([[0, 0], foot], gr, 2); P.dot(0, 0, 5, am, th['ink-950']); P.dot(Sh.r0[0], Sh.r0[1], 4, pk); });
          P.tag(0, 0, 'A', am, 'left', 12); P.tag(foot[0], foot[1], 'd_min = ' + Sh.dMin.toFixed(1) + ' m', gr, 'left', -8);
        } }
    ],

    readouts(S) {
      const p = S.p;
      if (p.mode === 'graphs') { const Gr = S.Gr; return [{ label: 'Displacement', value: Gr.disp.toFixed(3), unit: 'm', flag: 'accent' }, { label: 'Distance', value: Gr.dist.toFixed(3), unit: 'm' }, { label: p.prof === 'drop' ? 'At rest at' : 'Turns at', value: p.prof === 'drop' ? (isFinite(Gr.tRest) ? Gr.tRest.toFixed(3) : '—') : (Gr.turns.length ? Gr.turns[0].toFixed(3) : '—'), unit: 's' }]; }
      if (p.mode === 'proj') { const Pj = S.Pj; return [{ label: 'Range', value: (Pj.al ? Pj.Ralong : Pj.Rx).toFixed(3), unit: 'm', flag: 'accent' }, { label: 'Time of flight', value: Pj.T.toFixed(3), unit: 's' }, { label: 'Greatest height', value: Pj.yMax.toFixed(3), unit: 'm' }, { label: 'Best angle', value: S.best.ang.toFixed(2), unit: '°' }]; }
      if (p.mode === 'river') { const Rv = S.Rv; return [{ label: 'Time to cross', value: isFinite(Rv.T) ? Rv.T.toFixed(3) : '—', unit: 's', flag: 'accent' }, { label: 'Drift', value: isFinite(Rv.drift) ? (Math.abs(Rv.drift) < 5e-4 ? 0 : Rv.drift).toFixed(3) : '—', unit: 'm' }, { label: 'Least drift', value: S.minDrift.drift.toFixed(3), unit: 'm' }]; }
      const Sh = S.Sh; return [{ label: 'Closest approach', value: Sh.dMin.toFixed(3), unit: 'm', flag: 'accent' }, { label: 'At', value: Sh.tMin.toFixed(3), unit: 's' }, { label: 'Relative speed', value: Math.hypot(Sh.vr[0], Sh.vr[1]).toFixed(3), unit: 'm/s' }];
    },

    equation(S) {
      const p = S.p;
      if (p.mode === 'graphs') return E.v('v') + ' ' + E.op('=') + ' ' + E.frac(E.v('dx'), E.v('dt')) + ' · ' + E.v('a') + ' ' + E.op('=') + ' ' + E.frac(E.v('dv'), E.v('dt')) + ' · Δ' + E.v('x') + ' ' + E.op('=') + ' ' + E.op('∫') + E.v('v dt') + ' · distance ' + E.op('=') + ' ' + E.op('∫') + '|' + E.v('v') + '|' + E.v('dt');
      if (p.mode === 'proj') return E.v('R') + ' ' + E.op('=') + ' ' + E.frac(E.v('u') + '² sin 2θ', E.v('g')) + ' · on a slope α: ' + E.v('R') + E.sub('max') + ' ' + E.op('=') + ' ' + E.frac(E.v('u') + '²', E.v('g') + '(1 + sin α)') + ' at θ ' + E.op('=') + ' 45° + α/2';
      if (p.mode === 'river') return E.v('T') + ' ' + E.op('=') + ' ' + E.frac(E.v('d'), E.v('v') + E.sub('b') + ' cos φ') + ' · drift ' + E.op('=') + ' (' + E.v('v') + E.sub('r') + ' − ' + E.v('v') + E.sub('b') + ' sin φ)' + E.v('T');
      return E.v('d') + E.sub('min') + ' ' + E.op('=') + ' ' + E.frac('|' + E.v('r') + '₀ × ' + E.v('v') + E.sub('rel') + '|', '|' + E.v('v') + E.sub('rel') + '|') + ' · ' + E.v('t') + '* ' + E.op('=') + ' ' + E.frac('−' + E.v('r') + '₀·' + E.v('v') + E.sub('rel'), '|' + E.v('v') + E.sub('rel') + '|²');
    },

    eqNote: '<b>Integrate, then compare.</b> Every path is integrated step by step, so the formulas are checks, not inputs. Slopes and areas of ' +
      'the graphs come from the same run; a projectile\'s landing is found where its path crosses the ground; the best angle is searched ' +
      'for — and with air drag it is no longer 45°. Relative motion is just subtraction of velocities: in a river, or between two ships.',

    problems: [
      { source: 'JEE Main pattern · distance and displacement',
        q: 'A body starts at 8.0 m/s and has a constant acceleration of −2.0 m/s². What distance does it travel in the first 6.0 s, in m?',
        params: { mode: 'graphs', prof: 'const', v0g: 8, a0g: -2, tEg: 6 },
        predict: { label: 'distance', unit: 'm', tol: 0.005 },
        measure: S => S.Gr.dist,
        working: 'It stops at t = 4 s after 16 m, then comes back 4 m in the last 2 s. Displacement 12 m, but distance <b>20 m</b>.' },
      { source: 'JEE Advanced pattern · a bouncing ball',
        q: 'A ball is dropped from 5.0 m onto a floor with e = 0.50. What total distance does it travel before it comes to rest, in m?',
        params: { mode: 'graphs', prof: 'drop', hdrop: 5, ebn: 0.5, tEg: 4 },
        predict: { label: 'distance', unit: 'm', tol: 0.005 },
        measure: S => S.Gr.dist,
        working: 'Each rebound reaches e² of the height before: d = h + 2he²(1 + e² + …) = h(1 + e²)/(1 − e²) = 5 × 1.25/0.75 = <b>8.33 m</b>.' },
      { source: 'JEE Main pattern · range',
        q: 'A ball is projected at 20 m/s at 30° above the horizontal from level ground. What is its range, in m?',
        params: { mode: 'proj', up: 20, ang: 30, h0: 0, drag: 'none', slope: 0 },
        predict: { label: 'R', unit: 'm', tol: 0.005 },
        measure: S => S.Pj.Rx,
        working: 'R = u² sin 2θ/g = 400 × 0.866/9.81 = <b>35.3 m</b>.' },
      { source: 'JEE Main pattern · off a cliff',
        q: 'A stone is thrown at 15 m/s at 30° above the horizontal from the top of a 20 m cliff. How far from the foot of the cliff does it land, in m?',
        params: { mode: 'proj', up: 15, ang: 30, h0: 20, drag: 'none', slope: 0 },
        predict: { label: 'x', unit: 'm', tol: 0.005 },
        measure: S => S.Pj.Rx,
        working: 'y = 20 + 7.5t − 4.905t² = 0 gives t = 2.92 s; x = 15 cos 30° × t = <b>38.0 m</b>.' },
      { source: 'JEE Advanced pattern · up a slope',
        q: 'A ball is projected at 20 m/s from the foot of a 30° slope, up the slope. At what angle above the horizontal is the range along the slope greatest, in degrees?',
        params: { mode: 'proj', up: 20, ang: 60, h0: 0, drag: 'none', slope: 30 },
        predict: { label: 'angle', unit: '°', tol: 0.005 },
        measure: S => S.best.ang,
        working: 'Range along the slope: R = 2u² sin(θ − α) cos θ/(g cos²α), greatest when 2θ − α = 90°: θ = 45° + α/2 = <b>60°</b>, giving R = u²/g(1 + sin α) = 27.2 m.' },
      { source: 'JEE Main pattern · no drift',
        q: 'A boat that moves at 5.0 m/s in still water must cross a 100 m river flowing at 3.0 m/s and land directly opposite. How long does the crossing take, in s?',
        params: { mode: 'river', dw: 100, vb: 5, vr: 3, head: 36.87, profile: 'uniform' },
        predict: { label: 'T', unit: 's', tol: 0.005 },
        measure: S => S.Rv.T,
        working: 'Head upstream at sin φ = 3/5 so the drift cancels; the speed across is 5 cos φ = 4 m/s, and T = 100/4 = <b>25 s</b>.' },
      { source: 'JEE Advanced pattern · a river faster than the boat',
        q: 'The boat now moves at 3.0 m/s in water and the river flows at 5.0 m/s (width 100 m). What is the least possible drift downstream, in m?',
        params: { mode: 'river', dw: 100, vb: 3, vr: 5, head: 36.87, profile: 'uniform' },
        predict: { label: 'drift', unit: 'm', tol: 0.005 },
        measure: S => S.minDrift.drift,
        working: 'It cannot cancel the flow. The resultant makes the steepest angle with the bank when the boat heads at sin φ = v_b/v_r = 3/5 upstream: drift = d√(v_r² − v_b²)/v_b = 100 × 4/3 = <b>133 m</b>.' },
      { source: 'JEE Main pattern · closest approach',
        q: 'Ship A sails north at 10 m/s. Ship B, 100 m due east of A, sails west at 10 m/s. What is the least distance between them, in m?',
        params: { mode: 'ships', vA: 10, hA: 0, vB: 10, hB: 270, xB: 100, yB: 0 },
        predict: { label: 'd', unit: 'm', tol: 0.005 },
        measure: S => S.Sh.dMin,
        working: 'Relative to A, B moves at (−10, −10) m/s, a line at 45° through (100, 0). The perpendicular from A is 100 sin 45° = <b>70.7 m</b>, reached after 5.0 s.' }
    ],

    walkthrough: [
      { title: '1 · Displacement is not distance',
        body: 'A body thrown forward against a steady deceleration.',
        ask: 'After it turns round, which keeps growing: displacement or distance?',
        reveal: '<b>Distance.</b> Displacement is the signed area under v–t, so the part below the axis subtracts. Distance adds it.',
        params: { mode: 'graphs', prof: 'const', v0g: 8, a0g: -2, tEg: 6 } },
      { title: '2 · The saw-tooth of a bouncing ball',
        body: 'A ball dropped onto a floor with e = 0.5.',
        ask: 'What does the v–t graph look like at each bounce?',
        reveal: '<b>A vertical jump from −v to +ev.</b> Between bounces the line has the same slope, −g. The bounces come ever faster, and the total time is finite.',
        params: { mode: 'graphs', prof: 'drop', hdrop: 5, ebn: 0.5, tEg: 4 } },
      { title: '3 · The best angle on a slope',
        body: 'A projectile fired up a 30° slope.',
        ask: 'Is 45° still best?',
        reveal: '<b>No: 45° + α/2 = 60°.</b> The best direction bisects the angle between the slope and the vertical.',
        params: { mode: 'proj', up: 20, ang: 60, h0: 0, drag: 'none', slope: 30 } },
      { title: '4 · Air changes everything',
        body: 'The same launch with quadratic drag.',
        ask: 'Is the path still symmetric?',
        reveal: '<b>No.</b> It rises more steeply than it falls, lands short, and its best angle drops below 45°.',
        params: { mode: 'proj', up: 30, ang: 45, h0: 0, drag: 'quad', kd: 0.01, slope: 0 } },
      { title: '5 · Quickest or shortest',
        body: 'A boat crossing a river.',
        ask: 'Which heading gets it across fastest, and which lands it opposite?',
        reveal: '<b>Straight across is fastest</b> (T = d/v_b), but it drifts. <b>Heading upstream at sin⁻¹(v_r/v_b)</b> cancels the drift and takes longer.',
        params: { mode: 'river', dw: 100, vb: 5, vr: 3, head: 0, profile: 'uniform' } },
      { title: '6 · Closest approach',
        body: 'Two ships on crossing courses.',
        ask: 'How do you find the least distance without calculus?',
        reveal: '<b>Sit on A.</b> Then B moves in a straight line with v_B − v_A, and the least distance is the perpendicular from A to that line.',
        params: { mode: 'ships', vA: 10, hA: 0, vB: 10, hB: 270, xB: 100, yB: 0 } }
    ],

    quiz: [
      { q: 'The area under a velocity–time graph gives:',
        options: ['The displacement', 'The distance', 'The acceleration', 'The average speed'], answer: 0, why: 'Signed area; the distance is the area of |v|.' },
      { q: 'For a projectile on level ground in vacuum, the range is greatest at:',
        options: ['45°', '30°', '60°', 'It depends on u'], answer: 0, why: 'sin 2θ is greatest at 90°.' },
      { q: 'Up a slope of angle α, the range along the slope is greatest at a launch angle (from the horizontal) of:',
        options: ['45° + α/2', '45° − α/2', '45°', '90° − α'], answer: 0, why: 'It bisects the angle between the slope and the vertical.' },
      { q: 'With air drag, the angle for greatest range on level ground is:',
        options: ['Less than 45°', 'More than 45°', 'Exactly 45°', '90°'], answer: 0, why: 'Drag punishes long flight times; lower, faster paths win.' },
      { q: 'To cross a river in the least time, the boat should head:',
        options: ['Straight across', 'Upstream so it lands opposite', 'Downstream at 45°', 'Along the flow'], answer: 0, why: 'Only the across component of the boat\'s own velocity matters for time.' },
      { q: 'Two bodies move with constant velocities. Their least separation is found from:',
        options: ['Their relative velocity and initial separation', 'Their speeds only', 'Their accelerations', 'Their masses'], answer: 0, why: 'd_min = |r₀ × v_rel|/|v_rel|.' }
    ],

    notes: '<b>Where this shows up in the paper.</b><ul>' +
      '<li><b>Graphs</b>: slope of x–t is v, slope of v–t is a, area under v–t is displacement; distance is the area of |v|.</li>' +
      '<li><b>Bouncing</b>: heights fall as e², times as e; total distance h(1 + e²)/(1 − e²), total time √(2h/g)(1 + e)/(1 − e).</li>' +
      '<li><b>Projectiles</b>: R = u² sin 2θ/g, H = u² sin²θ/2g, T = 2u sin θ/g; on a slope use axes along and across the slope; R_max = u²/g(1 ± sin α).</li>' +
      '<li><b>River</b>: time from the across component; drift from the along component; zero drift needs v_b > v_r.</li>' +
      '<li><b>Relative motion</b>: subtract velocities; closest approach is a perpendicular in the relative frame.</li></ul>' +
      '<div class="pyq"><em>Trap to avoid</em> — reading a turning point off an x–t graph as the moment the acceleration is zero. It is where v = 0.</div>'
  });

  /* =========================================================================
     28 · SEMICONDUCTORS

     · Carriers: n_i(T) = √(NcNv)·exp(−Eg/2kT) with Nc, Nv ∝ T^{3/2}; with donors
       N_D (fully ionised) the majority density solves n = N_D + n_i²/n, and
       n·p = n_i² holds at every doping — the mass-action law is shown, not told.
       The Fermi level follows: E_F − E_i = kT ln(n/n_i).
     · The p–n junction: Shockley current I = I_s(e^{V/ηV_T} − 1) with a series
       resistance, solved for V_d by Newton's method; breakdown at −V_Z. The
       depletion width W = √(2ε(V_bi − V)(1/N_A + 1/N_D)/q) and the field in it.
     · Rectifiers: a sine source through a real diode (the Shockley equation,
       solved every step) into a load with a smoothing capacitor, half-wave or
       bridge; the ripple is measured off the waveform and compared with I/fC.
     · The Zener regulator: series resistor, Zener, load; the Zener current is
       solved from the circuit; regulation fails when it falls to zero.
     · Logic gates: a truth table from a transistor-level switch model, and
       a timing diagram for the chosen gate driven by two input trains.
     ========================================================================= */
  const kB = 8.617e-5;                                   // eV/K
  const SEMI = { Si: { Eg0: 1.17, a: 4.73e-4, b: 636, Nc: 2.86e19, Nv: 3.10e19, eps: 11.7 }, Ge: { Eg0: 0.744, a: 4.77e-4, b: 235, Nc: 1.04e19, Nv: 6.0e18, eps: 16 } };
  function carriers(p, Tover) {
    const M = SEMI[p.mat], T = Tover || p.Tk, Eg = M.Eg0 - M.a * T * T / (T + M.b), f = Math.pow(T / 300, 1.5);
    const ni = Math.sqrt(M.Nc * f * M.Nv * f) * Math.exp(-Eg / (2 * kB * T));
    const Nd = p.dop === 'n' ? p.Ndop : 0, Na = p.dop === 'p' ? p.Ndop : 0, net = (Nd - Na) / 2;
    // charge neutrality with n·p = n_i²: the majority density is the large root (no cancellation), the minority follows
    const maj = Math.abs(net) + Math.sqrt(net * net + ni * ni);
    const n = net >= 0 ? maj : ni * ni / maj, pp = net >= 0 ? ni * ni / maj : maj;
    return { T, Eg, ni, n, p: pp, Ef: kB * T * Math.log(n / ni), Nd, Na, M };
  }

  /* the diode: I(V) with series resistance, solved for the junction voltage */
  function diodeI(p, Vd) { const Vt = kB * p.Tj, eta = p.eta; if (Vd < -p.VZ) return -p.Is * 1 - (-Vd - p.VZ) / p.rZ; return p.Is * (Math.exp(Vd / (eta * Vt)) - 1); }
  function diodeAt(p, Vapp) {                               // V_app = V_d + I·R_s ; Newton on V_d
    const Vt = kB * p.Tj, eta = p.eta; let Vd = Math.min(Vapp, 0.7);
    for (let i = 0; i < 80; i++) {
      const I = diodeI(p, Vd), dI = Vd < -p.VZ ? 1 / p.rZ : p.Is / (eta * Vt) * Math.exp(Vd / (eta * Vt));
      const f = Vd + I * p.Rs - Vapp, df = 1 + dI * p.Rs, step = f / df;
      Vd -= Math.max(-0.1, Math.min(0.1, step)); if (Math.abs(step) < 1e-12) break;
    }
    return { Vd, I: diodeI(p, Vd) };
  }
  function runJunction(p) {
    const q = 1.602e-19, eps0 = 8.854e-14, M = SEMI[p.mat], Vt = kB * p.Tj;
    const ni = carriers({ mat: p.mat, Tk: p.Tj, dop: 'i', Ndop: 0 }).ni;
    const Vbi = Vt * Math.log(p.NA * p.ND / (ni * ni)), eps = M.eps * eps0;
    const W = V => Math.sqrt(Math.max(0, 2 * eps * (Vbi - V) * (1 / p.NA + 1 / p.ND) / q));     // cm
    const iv = []; for (let V = -Math.min(p.VZ * 1.3, 15); V <= 1.2; V += 0.005) { const r = diodeAt(p, V); iv.push([V, r.I, r.Vd]); }
    const op = diodeAt(p, p.Vapp), Vop = Math.min(op.Vd, Vbi - 0.02), Wv = W(Vop), xn = Wv * p.NA / (p.NA + p.ND), xp = Wv * p.ND / (p.NA + p.ND);
    const Emax = q * p.ND * xn / eps;                        // V/cm
    // the knee: the voltage where I reaches 1 mA
    let knee = NaN; for (const q2 of iv) if (q2[0] > 0 && q2[1] >= 1e-3) { knee = q2[0]; break; }
    // dynamic resistance at the operating point, from the curve
    const d = 1e-4, rd = d * 2 / (diodeAt(p, p.Vapp + d).I - diodeAt(p, p.Vapp - d).I);
    return { Vbi, W: Wv, W0: W(0), xn, xp, Emax, iv, op, knee, rd, ni, Vt };
  }

  /* the rectifier: source → diode(s) → load R ∥ C, integrated in time */
  function runRect(p, quick) {
    const w = TAU * p.fq, Vm = p.Vpk, R = p.RL, C = p.Cf * 1e-6, bridge = p.rect === 'bridge', nd = bridge ? 2 : 1;
    const dp = { Is: 1e-14, eta: 1, Tj: 300, Rs: 0.5, VZ: 1e9, rZ: 1 };
    const cyc = quick ? 12 : 8, dt = 1 / (p.fq * (quick ? 800 : 2000)), out = [];
    let vo = 0, t = 0;
    const iD = (vs, vo) => { const drive = (bridge ? Math.abs(vs) : vs) - vo; if (drive <= 0) return 0; return diodeAt(dp, drive / nd).I; };
    while (t < cyc / p.fq) {
      const vs = Vm * Math.sin(w * t), i = iD(vs, vo);
      if (Math.round(t / dt) % 4 === 0) out.push([t, vs, vo, i]);
      // implicit-enough midpoint on the load node: C dvo/dt = i − vo/R
      const f = v => (iD(vs, v) - v / R) / Math.max(C, 1e-12);
      if (C > 1e-9) { const k1 = f(vo), k2 = f(vo + k1 * dt / 2); vo = Math.max(0, vo + k2 * dt); }
      else { let lo = 0, hi = Math.max(0, bridge ? Math.abs(vs) : vs); for (let j = 0; j < 40; j++) { const m = (lo + hi) / 2; if (iD(vs, m) - m / R > 0) lo = m; else hi = m; } vo = (lo + hi) / 2; }
      t += dt;
    }
    // measure the last full cycle
    const last = out.length ? out.filter(q => q[0] >= (cyc - 1) / p.fq) : [];
    const vmax = last.length ? Math.max(...last.map(q => q[2])) : 0, vmin = last.length ? Math.min(...last.map(q => q[2])) : 0, vavg = last.length ? last.reduce((s, q) => s + q[2], 0) / last.length : 0;
    const Vdrop = nd * 0.7, fr = bridge ? 2 * p.fq : p.fq, rippleF = C > 1e-9 ? (Vm - Vdrop) / (R * fr * C) : NaN;
    const iPk = last.length ? Math.max(...last.map(q => q[3])) : 0;
    return { out, vmax, vmin, vavg, ripple: vmax - vmin, rippleF, fr, iPk, Vdrop, tEnd: cyc / p.fq, last };
  }

  /* the Zener regulator: Vin → Rs → (Zener ∥ R_L) */
  function zenerSolve(p, Vin, RL) {
    // node voltage V: (Vin − V)/Rs = Iz(V) + V/RL ; Zener conducts in reverse above Vz with r_z
    const Iz = V => V > p.Vz ? (V - p.Vz) / p.rz : 0;
    let lo = 0, hi = Vin; for (let i = 0; i < 60; i++) { const m = (lo + hi) / 2; if ((Vin - m) / p.Rser - Iz(m) - m / RL > 0) lo = m; else hi = m; }
    const V = (lo + hi) / 2; return { V, Iz: Iz(V), IL: V / RL, Is: (Vin - V) / p.Rser, Pz: Iz(V) * V };
  }
  function runZener(p) {
    const op = zenerSolve(p, p.Vin, p.RLz), sweep = [];
    for (let v = 0; v <= 2 * p.Vz + 10; v += 0.1) { const r = zenerSolve(p, v, p.RLz); sweep.push([v, r.V, r.Iz * 1000, r.IL * 1000]); }
    const loadSweep = []; for (let R = 50; R <= 5000; R *= 1.05) { const r = zenerSolve(p, p.Vin, R); loadSweep.push([R, r.V, r.Iz * 1000]); }
    // the least load resistance that keeps it regulating: Iz = 0 exactly at V = Vz
    const RLmin = p.Vz / ((p.Vin - p.Vz) / p.Rser), VinMin = p.Vz * (1 + p.Rser / p.RLz);
    return { op, sweep, loadSweep, RLmin, VinMin, regulating: op.Iz > 0 };
  }

  /* logic gates: a timing diagram from two input trains */
  const GATES = { AND: (a, b) => a & b, OR: (a, b) => a | b, NAND: (a, b) => 1 - (a & b), NOR: (a, b) => 1 - (a | b), XOR: (a, b) => a ^ b, XNOR: (a, b) => 1 - (a ^ b), NOT: a => 1 - a };
  function runGates(p) {
    const f = GATES[p.gate], one = p.gate === 'NOT';
    const A = t => Math.floor(t / p.pA) % 2, Bf = t => Math.floor((t + p.phB) / p.pB) % 2;
    const out = []; for (let t = 0; t <= 16; t += 0.02) { const a = A(t), b = Bf(t); out.push([t, a, b, one ? f(a) : f(a, b)]); }
    const table = one ? [[0, 0, f(0)], [1, 0, f(1)]] : [[0, 0, f(0, 0)], [0, 1, f(0, 1)], [1, 0, f(1, 0)], [1, 1, f(1, 1)]];
    // the NAND-only build: count gates needed (universal gate)
    const nandCount = { NOT: 1, AND: 2, OR: 3, NOR: 4, NAND: 1, XOR: 4, XNOR: 5 }[p.gate];
    const highFrac = out.filter(q => q[3]).length / out.length;
    return { out, table, one, nandCount, highFrac };
  }

  /* ---------- board-level parts, drawn flat on a circuit board (x–y plane, z up) ---------- */
  function board(F, x0, x1, y0, y1) {
    R3.box(F, [(x0 + x1) / 2, (y0 + y1) / 2, -0.02], [x1 - x0, y1 - y0, 0.04], '#1E5A3A', { shadow: false, bias: F.GROUND });
    for (let x = x0 + 0.1; x < x1; x += 0.1) for (let y = y0 + 0.1; y < y1; y += 0.1) R3.sphere(F, [x, y, 0.001], 0.006, '#2E7A52', { shadow: false });
  }
  function wire(F, pts, col, glow) { path3(F, pts.map(q => [q[0], q[1], 0.012]), col || '#D6B46A', { alpha: 0.95, width: 2.4, chunk: 1, glow: glow || 0 }); }
  function resistor(F, a, b, lab, col) {
    const m = V.mul(V.add(a, b), 0.5), d = V.norm(V.sub(b, a)), L = Math.hypot(b[0] - a[0], b[1] - a[1]);
    wire(F, [a, V.add(m, V.mul(d, -0.09))]); wire(F, [V.add(m, V.mul(d, 0.09)), b]);
    R3.cylinder(F, V.add(V.add(m, V.mul(d, -0.09)), [0, 0, 0.035]), V.add(V.add(m, V.mul(d, 0.09)), [0, 0, 0.035]), 0.03, col || '#D8B98A', { segments: 14, shadow: false });
    ['#7A4A20', '#1A1A1A', '#C83030'].forEach((c, k) => { const q = V.add(V.add(m, V.mul(d, -0.05 + k * 0.04)), [0, 0, 0.035]); R3.cylinder(F, V.add(q, V.mul(d, -0.006)), V.add(q, V.mul(d, 0.006)), 0.031, c, { segments: 14, shadow: false }); });
    if (lab) R3.label(F, V.add(m, [0, 0.09, 0.07]), lab, '#DCE3EE', { size: 9 }); void L;
  }
  function diodePart(F, a, b, on, lab, zener) {       // anode a → cathode b; the band marks the cathode
    const m = V.mul(V.add(a, b), 0.5), d = V.norm(V.sub(b, a));
    wire(F, [a, V.add(m, V.mul(d, -0.07))]); wire(F, [V.add(m, V.mul(d, 0.07)), b]);
    R3.cylinder(F, V.add(V.add(m, V.mul(d, -0.07)), [0, 0, 0.03]), V.add(V.add(m, V.mul(d, 0.07)), [0, 0, 0.03]), 0.026, zener ? '#C87A2A' : '#1A1C22', { segments: 14, shadow: false });
    const bd = V.add(V.add(m, V.mul(d, 0.045)), [0, 0, 0.03]);
    R3.cylinder(F, V.add(bd, V.mul(d, -0.008)), V.add(bd, V.mul(d, 0.008)), 0.027, '#DCE3EE', { segments: 14, shadow: false });
    if (on) R3.sphere(F, V.add(m, [0, 0, 0.07]), 0.018, '#FFD36B', { shadow: false, vivid: true });
    if (lab) R3.label(F, V.add(m, [0, -0.08, 0.07]), lab, on ? '#FFD36B' : '#8FA4CE', { size: 9 });
  }
  function capPart(F, c, lab) {
    R3.cylinder(F, [c[0], c[1], 0], [c[0], c[1], 0.16], 0.06, '#2F5FA8', { segments: 20, shadow: false, capColour: '#B8C2D6' });
    path3(F, [[c[0] - 0.045, c[1] - 0.04, 0.02], [c[0] - 0.045, c[1] - 0.04, 0.15]], '#DCE3EE', { alpha: 0.8, width: 2, chunk: 1 });
    if (lab) R3.label(F, [c[0], c[1] - 0.14, 0.2], lab, '#DCE3EE', { size: 9 });
  }
  function scope(g, x, y, w, h, series, opt) {         // a small oscilloscope drawn in screen space
    const ctx = g.ctx; ctx.save();
    ctx.fillStyle = 'rgba(6,14,10,.92)'; ctx.strokeStyle = '#2E5A44'; ctx.lineWidth = 1; ctx.fillRect(x, y, w, h); ctx.strokeRect(x + .5, y + .5, w, h);
    ctx.strokeStyle = 'rgba(80,160,110,.25)'; for (let k = 1; k < 8; k++) { ctx.beginPath(); ctx.moveTo(x + w * k / 8, y); ctx.lineTo(x + w * k / 8, y + h); ctx.stroke(); } for (let k = 1; k < 4; k++) { ctx.beginPath(); ctx.moveTo(x, y + h * k / 4); ctx.lineTo(x + w, y + h * k / 4); ctx.stroke(); }
    const { t0, t1, lo, hi } = opt;
    series.forEach(([pts, col]) => { ctx.strokeStyle = col; ctx.lineWidth = 1.8; ctx.beginPath(); let first = true;
      pts.forEach(q => { if (q[0] < t0 || q[0] > t1) return; const px = x + (q[0] - t0) / (t1 - t0) * w, py = y + h - (q[1] - lo) / (hi - lo) * h; if (first) { ctx.moveTo(px, py); first = false; } else ctx.lineTo(px, py); }); ctx.stroke(); });
    if (opt.title) { ctx.fillStyle = '#9FE0B8'; ctx.font = '10px "IBM Plex Mono",monospace'; ctx.textAlign = 'left'; ctx.fillText(opt.title, x + 6, y + 13); }
    ctx.restore();
  }

  /* ======================= 28.1 · bands and carriers ======================= */
  function drawBands(S, g) {
    const ctx = g.ctx, th = g.theme, p = S.p, cam = S.cam, Cr = S.Cr;
    const F = R3.Frame(ctx, cam, { ambient: 0.4, floorZ: null });
    // a crystal slab: a lattice of atoms (Si/Ge), a few dopant atoms, and mobile carriers drifting in a field
    const N = 7, sp = 0.26, rnd = rng(7), L = (N - 1) * sp, list = [];
    const sAt = sprite('#8A93A8'), sDop = sprite(p.dop === 'n' ? '#FF8A5A' : '#8A7AFF'), sE = sprite('#3DD6F5', { glow: true }), sH = sprite('#FF8FB0');
    const bonds = [];
    for (let i = 0; i < N; i++) for (let j = 0; j < N; j++) for (let k = 0; k < 3; k++) {
      const pos = [(i - (N - 1) / 2) * sp, (j - (N - 1) / 2) * sp, k * sp + 0.1], isDop = p.dop !== 'i' && ((i * 7 + j * 3 + k * 5) % 9 === 0);
      list.push([pos[0], pos[1], pos[2], isDop ? 0.045 : 0.035, isDop ? sDop : sAt]);
      if (k === 0) { if (i < N - 1) bonds.push([pos, V.add(pos, [sp, 0, 0])]); if (j < N - 1) bonds.push([pos, V.add(pos, [0, sp, 0])]); }
    }
    for (let k = 0; k < 3; k++) bonds.forEach(b => path3(F, b.map(q => V.add(q, [0, 0, k * sp])), '#5A6478', { alpha: 0.35, width: 1, chunk: 1 }));
    // carriers: numbers scaled logarithmically to their densities, drifting (electrons against E, holes with it)
    const nE = Math.round(clamp(4 * Math.log10(Cr.n / 1e8), 0, 40)), nH = Math.round(clamp(4 * Math.log10(Cr.p / 1e8), 0, 40));
    const wrap = x => ((x % L) + L) % L - L / 2;
    for (let k = 0; k < nE; k++) { const x0 = rnd() * L, y = (rnd() - 0.5) * L, z = rnd() * 2 * sp + 0.1; list.push([wrap(x0 - 0.25 * S.ts), y, z, 0.024, sE]); }
    for (let k = 0; k < nH; k++) { const x0 = rnd() * L, y = (rnd() - 0.5) * L, z = rnd() * 2 * sp + 0.1; list.push([wrap(x0 + 0.12 * S.ts), y, z, 0.024, sH]); }
    ballCloud(F, list, [0, 0, 0.35], 0);
    R3.arrow(F, [-L / 2, -L / 2 - 0.2, 0.3], [L / 2, -L / 2 - 0.2, 0.3], 0.01, '#FFD36B', { vivid: true }); R3.label(F, [0, -L / 2 - 0.3, 0.38], 'applied field E →', '#FFD36B', { size: 9.5 });
    F.render();
    // the band diagram, drawn in screen space on the right
    const bx = g.w - 250, by = 90, bw = 230, bh = 250; ctx.save();
    ctx.fillStyle = 'rgba(8,12,22,.9)'; ctx.strokeStyle = th.line; ctx.fillRect(bx, by, bw, bh); ctx.strokeRect(bx + .5, by + .5, bw, bh);
    const Ev = by + bh - 50, Ec = by + 50, Y = e => Ev - (e / Cr.Eg) * (Ev - Ec);
    ctx.fillStyle = 'rgba(61,214,245,.22)'; ctx.fillRect(bx + 20, by + 18, bw - 40, Ec - by - 18); ctx.fillStyle = 'rgba(255,143,176,.22)'; ctx.fillRect(bx + 20, Ev, bw - 40, by + bh - 18 - Ev);
    ctx.strokeStyle = '#3DD6F5'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(bx + 20, Ec); ctx.lineTo(bx + bw - 20, Ec); ctx.stroke();
    ctx.strokeStyle = '#FF8FB0'; ctx.beginPath(); ctx.moveTo(bx + 20, Ev); ctx.lineTo(bx + bw - 20, Ev); ctx.stroke();
    const Ei = Y(Cr.Eg / 2), Ef = Y(Cr.Eg / 2 + Cr.Ef);
    ctx.setLineDash([4, 3]); ctx.strokeStyle = '#8FA4CE'; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(bx + 20, Ei); ctx.lineTo(bx + bw - 20, Ei); ctx.stroke();
    ctx.strokeStyle = '#FFD36B'; ctx.lineWidth = 1.8; ctx.beginPath(); ctx.moveTo(bx + 20, Ef); ctx.lineTo(bx + bw - 20, Ef); ctx.stroke(); ctx.setLineDash([]);
    if (p.dop !== 'i') { const Ed = p.dop === 'n' ? Y(Cr.Eg - 0.045) : Y(0.045); ctx.strokeStyle = p.dop === 'n' ? '#FF8A5A' : '#8A7AFF'; for (let x = bx + 30; x < bx + bw - 30; x += 14) { ctx.beginPath(); ctx.moveTo(x, Ed); ctx.lineTo(x + 7, Ed); ctx.stroke(); } }
    ctx.font = '10px "IBM Plex Mono",monospace'; ctx.textAlign = 'left';
    ctx.fillStyle = '#3DD6F5'; ctx.fillText('conduction band E_c', bx + 24, Ec - 6); ctx.fillStyle = '#FF8FB0'; ctx.fillText('valence band E_v', bx + 24, Ev + 14);
    ctx.fillStyle = '#8FA4CE'; ctx.fillText('E_i', bx + bw - 44, Ei - 4); ctx.fillStyle = '#FFD36B'; ctx.fillText('E_F', bx + bw - 44, Ef + (Ef > Ei ? 12 : -4));
    ctx.fillStyle = '#DCE3EE'; ctx.fillText('E_g = ' + Cr.Eg.toFixed(3) + ' eV', bx + 60, (Ec + Ev) / 2 + 30);
    ctx.fillText('band diagram', bx + 8, by + 12); ctx.restore();
    header(g, p.mat + ' at ' + p.Tk.toFixed(0) + ' K · ' + (p.dop === 'i' ? 'intrinsic' : (p.dop === 'n' ? 'n-type, N_D = ' : 'p-type, N_A = ') + p.Ndop.toExponential(1) + ' cm⁻³'),
      'n = ' + Cr.n.toExponential(3) + ' · p = ' + Cr.p.toExponential(3) + ' cm⁻³ · blue dots: electrons (drift against E) · pink rings: holes (drift with E)',
      'n_i = √(N_c N_v) e^(−E_g/2kT) · charge neutrality n + N_A = p + N_D with n·p = n_i² gives both densities', th.text);
    panel(g, 'THE MASS-ACTION LAW', [
      ['n_i', Cr.ni.toExponential(4) + ' cm⁻³', th.phys], ['n · p', (Cr.n * Cr.p).toExponential(4), th.phys], ['n_i²', (Cr.ni * Cr.ni).toExponential(4), th.ok],
      ['majority ÷ minority', (Math.max(Cr.n, Cr.p) / Math.min(Cr.n, Cr.p)).toExponential(2)], ['E_F − E_i', (Cr.Ef * 1000).toFixed(1) + ' meV'], ['band gap at this T', Cr.Eg.toFixed(4) + ' eV']
    ]);
  }

  /* ======================= 28.2 · the p–n junction ======================= */
  function drawJunction(S, g) {
    const ctx = g.ctx, th = g.theme, p = S.p, cam = S.cam, J = S.J;
    const F = R3.Frame(ctx, cam, { ambient: 0.4, floorZ: null });
    const L = 2.4, Hh = 0.5, D = 0.5, Wd = clamp(J.W * 1e4 * 0.9, 0.04, 1.6), xn = Wd * J.xn / J.W, xp = Wd * J.xp / J.W;
    // p side (left) and n side (right), the depletion layer between
    R3.box(F, [(-L / 2 - xp) / 2, 0, 0], [L / 2 - xp, D, Hh], '#6A4AB8', { shadow: false });
    R3.box(F, [(xn + L / 2) / 2, 0, 0], [L / 2 - xn, D, Hh], '#B8603A', { shadow: false });
    R3.box(F, [(xn - xp) / 2, 0, 0], [xn + xp, D, Hh], '#39414F', { shadow: false });
    R3.label(F, [-L / 2 + 0.25, 0, Hh / 2 + 0.1], 'p', '#B8A0FF', { size: 14 }); R3.label(F, [L / 2 - 0.25, 0, Hh / 2 + 0.1], 'n', '#FFB08A', { size: 14 });
    R3.label(F, [(xn - xp) / 2, 0, Hh / 2 + 0.1], 'depletion ' + (J.W * 1e4).toFixed(3) + ' µm', '#DCE3EE', { size: 9.5 });
    // fixed ions in the depletion layer, mobile carriers outside
    const rnd = rng(3);
    for (let k = 0; k < 18; k++) { R3.label(F, [-xp * rnd(), (rnd() - 0.5) * D * 0.8, (rnd() - 0.5) * Hh * 0.8 + 0.0], '−', '#B8A0FF', { size: 11 }); R3.label(F, [xn * rnd(), (rnd() - 0.5) * D * 0.8, (rnd() - 0.5) * Hh * 0.8], '+', '#FFB08A', { size: 11 }); }
    const flow = J.op.I > 1e-6 ? Math.min(1, Math.log10(J.op.I / 1e-6) / 5) : 0;
    // holes live on the p side, electrons on the n side; under forward bias they stream across (speed ∝ log current)
    for (let k = 0; k < 16; k++) {
      const y = (rnd() - 0.5) * D * 0.9, z = (rnd() - 0.5) * Hh * 0.9, u = rnd(), v2 = rnd();
      const xh = flow > 0.02 ? -L / 2 + ((u + flow * S.ts * 0.3) % 1) * L : -L / 2 + u * (L / 2 - xp - 0.03);
      const xe = flow > 0.02 ? L / 2 - ((v2 + flow * S.ts * 0.3) % 1) * L : xn + 0.03 + v2 * (L / 2 - xn - 0.03);
      R3.wireSphere(F, [xh, y, z], 0.02, '#FF8FB0', { lat: 3, lon: 5, alpha: 0.9, limbAlpha: 1 });
      R3.sphere(F, [xe, -y, -z], 0.02, '#3DD6F5', { shadow: false, vivid: true });
    }
    // the internal field inside the depletion layer, from n to p
    R3.arrow(F, [xn, -D / 2 - 0.05, 0], [-xp, -D / 2 - 0.05, 0], 0.01, '#FFD36B', { vivid: true });
    R3.label(F, [(xn - xp) / 2, -D / 2 - 0.1, -0.12], 'E_max = ' + (J.Emax / 1e3).toFixed(1) + ' kV/cm', '#FFD36B', { size: 9.5 });
    // the battery and the ammeter
    wire(F, [[-L / 2, 0, 0], [-L / 2 - 0.2, 0, 0], [-L / 2 - 0.2, 0, -0.7], [L / 2 + 0.2, 0, -0.7], [L / 2 + 0.2, 0, 0], [L / 2, 0, 0]].map(q => [q[0], q[1], q[2] - 0.012]));
    R3.box(F, [0, 0, -0.7], [0.3, 0.14, 0.14], '#2C3445', { shadow: false }); R3.label(F, [0, 0, -0.55], 'V = ' + p.Vapp.toFixed(3) + ' V', p.Vapp >= 0 ? '#7CF0B0' : '#FF8FB0', { size: 10 });
    F.render();
    const bias = p.Vapp > 0.05 ? 'forward bias' : p.Vapp < -0.05 ? (p.Vapp <= -p.VZ ? 'REVERSE BREAKDOWN' : 'reverse bias') : 'no bias';
    header(g, 'A ' + p.mat + ' p–n junction · N_A = ' + p.NA.toExponential(0) + ', N_D = ' + p.ND.toExponential(0) + ' cm⁻³ · ' + bias,
      'applied ' + p.Vapp.toFixed(3) + ' V · across the junction ' + J.op.Vd.toFixed(3) + ' V · I = ' + (Math.abs(J.op.I) < 1e-3 ? (J.op.I * 1e6).toFixed(3) + ' µA' : (J.op.I * 1000).toFixed(3) + ' mA'),
      'forward bias narrows the depletion layer and carriers flood across; reverse bias widens it and only a tiny saturation current leaks', th.text);
    panel(g, 'THE JUNCTION', [
      ['built-in potential V_bi', J.Vbi.toFixed(4) + ' V', th.phys], ['depletion width now · at V = 0', (J.W * 1e4).toFixed(4) + ' · ' + (J.W0 * 1e4).toFixed(4) + ' µm'],
      ['it reaches 1 mA at', isFinite(J.knee) ? J.knee.toFixed(3) + ' V' : '—', th.ok], ['dynamic resistance dV/dI here', J.rd < 1e6 ? J.rd.toFixed(2) + ' Ω' : (J.rd / 1e6).toExponential(2) + ' MΩ'],
      ['current', (J.op.I * 1000).toExponential(3) + ' mA'], ['thermal voltage kT/q', (J.Vt * 1000).toFixed(2) + ' mV']
    ]);
  }

  /* ======================= 28.3 · the rectifier ======================= */
  function drawRect(S, g) {
    const ctx = g.ctx, th = g.theme, p = S.p, cam = S.cam, Rc = S.Rc;
    const F = R3.Frame(ctx, cam, { ambient: 0.42, floorZ: null });
    board(F, -1.3, 1.3, -0.7, 0.7);
    const per = 1 / p.fq, tt = Rc.tEnd - per * 2 + ((S.ts * 0.25) % (per * 2)), i = Math.max(0, Rc.out.findIndex(q => q[0] >= tt)), o = Rc.out[i] || Rc.out[Rc.out.length - 1];
    const pos = o[1] > 0;
    // the transformer secondary on the left
    R3.box(F, [-1.05, 0, 0.12], [0.3, 0.4, 0.24], '#5A6478', { shadow: false }); R3.label(F, [-1.05, 0, 0.34], '~ ' + p.Vpk.toFixed(0) + ' V peak, ' + p.fq.toFixed(0) + ' Hz', '#DCE3EE', { size: 9 });
    const A = [-0.9, 0.3, 0], Bn = [-0.9, -0.3, 0], out = [0.35, 0.3, 0], gnd = [0.35, -0.3, 0];
    if (p.rect === 'half') {
      diodePart(F, A, [-0.2, 0.3, 0], pos && o[3] > 1e-4, 'D');
      wire(F, [[-0.2, 0.3, 0], out]); wire(F, [Bn, gnd]);
    } else {
      // the bridge: four diodes in a diamond
      const T = [-0.45, 0.45, 0], Bo = [-0.45, -0.45, 0], Le = [-0.7, 0, 0], Ri = [-0.2, 0, 0];
      wire(F, [A, [-0.9, 0.45, 0], T]); wire(F, [Bn, [-0.9, -0.45, 0], Bo]);
      diodePart(F, T, Ri, pos && o[3] > 1e-4, 'D1'); diodePart(F, Bo, Ri, !pos && o[3] > 1e-4, 'D2');
      diodePart(F, Le, T, !pos && o[3] > 1e-4, 'D3'); diodePart(F, Le, Bo, pos && o[3] > 1e-4, 'D4');
      wire(F, [Ri, [0.1, 0, 0], [0.1, 0.3, 0], out]); wire(F, [Le, [-0.7, -0.6, 0], [0.35, -0.6, 0], gnd]);
    }
    if (p.Cf > 0) { capPart(F, [0.55, 0, 0], 'C = ' + p.Cf.toFixed(0) + ' µF'); wire(F, [out, [0.55, 0.3, 0], [0.55, 0.06, 0]]); wire(F, [[0.55, -0.06, 0], [0.55, -0.3, 0], gnd]); }
    resistor(F, [1.05, 0.3, 0], [1.05, -0.3, 0]); R3.label(F, [1.05, -0.4, 0.06], 'R_L = ' + p.RL.toFixed(0) + ' Ω', '#DCE3EE', { size: 9 }); wire(F, [out, [1.05, 0.3, 0]]); wire(F, [gnd, [1.05, -0.3, 0]]);
    F.render();
    const pts = Rc.out.filter(q => q[0] >= Rc.tEnd - per * 3);
    scope(g, g.w - 290, 84, 270, 110, [[pts.map(q => [q[0], q[1]]), '#8FA4CE'], [pts.map(q => [q[0], q[2]]), '#7CF0B0']], { t0: Rc.tEnd - per * 3, t1: Rc.tEnd, lo: -p.Vpk * 1.1, hi: p.Vpk * 1.1, title: 'input (grey) · output (green)' });
    header(g, (p.rect === 'half' ? 'A half-wave' : 'A full-wave bridge') + ' rectifier · ' + p.Vpk.toFixed(0) + ' V peak at ' + p.fq.toFixed(0) + ' Hz · load ' + p.RL.toFixed(0) + ' Ω' + (p.Cf > 0 ? ', ' + p.Cf.toFixed(0) + ' µF across it' : ''),
      'the diodes are real (Shockley, ~0.7 V each), solved every step · glowing: the diode(s) conducting now',
      p.Cf > 0 ? 'the capacitor charges near each peak and feeds the load in between: ripple ≈ V_peak/(f_ripple R C)' : 'with no capacitor the output follows the input only while a diode conducts', th.text);
    panel(g, 'THE OUTPUT', [
      ['peak output', Rc.vmax.toFixed(3) + ' V', th.phys], ['ripple (peak to peak, measured)', Rc.ripple.toFixed(4) + ' V', th.phys],
      ['V_peak/(f_ripple R C) (approx.)', p.Cf > 0 ? (Rc.vmax / (Rc.fr * p.RL * p.Cf * 1e-6)).toFixed(4) + ' V' : '—', th.ok],
      ['ripple frequency', Rc.fr.toFixed(0) + ' Hz'], ['mean output', Rc.vavg.toFixed(3) + ' V'], ['peak diode current', (Rc.iPk * 1000).toFixed(1) + ' mA']
    ]);
  }

  /* ======================= 28.4 · the Zener regulator ======================= */
  function drawZener(S, g) {
    const ctx = g.ctx, th = g.theme, p = S.p, cam = S.cam, Zn = S.Zn, o = Zn.op;
    const F = R3.Frame(ctx, cam, { ambient: 0.42, floorZ: null });
    board(F, -1.2, 1.2, -0.6, 0.6);
    R3.box(F, [-0.95, 0, 0.1], [0.24, 0.36, 0.2], '#2C3445', { shadow: false }); R3.label(F, [-0.95, 0, 0.3], 'V_in = ' + p.Vin.toFixed(2) + ' V', '#DCE3EE', { size: 9.5 });
    const top = [-0.8, 0.35, 0], bot = [-0.8, -0.35, 0], nd = [0.05, 0.35, 0];
    resistor(F, top, nd, 'R_s = ' + p.Rser.toFixed(0) + ' Ω');
    diodePart(F, [0.05, -0.35, 0], [0.05, 0.35, 0], o.Iz > 1e-5, 'Zener ' + p.Vz.toFixed(1) + ' V', true);
    wire(F, [nd, [0.7, 0.35, 0]]); resistor(F, [0.7, 0.35, 0], [0.7, -0.35, 0], 'R_L = ' + p.RLz.toFixed(0) + ' Ω'); wire(F, [bot, [0.7, -0.35, 0]]);
    B3.meter(F, [0.35, -0.62, 0.12], [0, -1, 0], 0.26, 0.1, { title: 'V_OUT', value: o.V.toFixed(3), unit: 'V', colour: o.Iz > 0 ? '#7CF0B0' : '#FF8FB0' });
    B3.meter(F, [-0.3, -0.62, 0.12], [0, -1, 0], 0.26, 0.1, { title: 'I_ZENER', value: (o.Iz * 1000).toFixed(2), unit: 'mA', colour: '#FFD36B' });
    F.render();
    header(g, 'A Zener regulator · ' + p.Vz.toFixed(1) + ' V Zener, R_s = ' + p.Rser.toFixed(0) + ' Ω, load ' + p.RLz.toFixed(0) + ' Ω · ' + (Zn.regulating ? 'REGULATING' : 'NOT regulating'),
      'I_s = ' + (o.Is * 1000).toFixed(2) + ' mA splits into I_Z = ' + (o.Iz * 1000).toFixed(2) + ' mA and I_L = ' + (o.IL * 1000).toFixed(2) + ' mA · Zener dissipates ' + (o.Pz * 1000).toFixed(1) + ' mW',
      'in breakdown the Zener holds its voltage by taking whatever current the load does not; when I_Z reaches zero it lets go', th.text);
    panel(g, 'HOLDING THE VOLTAGE', [
      ['output', o.V.toFixed(4) + ' V', th.phys], ['Zener current', (o.Iz * 1000).toFixed(3) + ' mA', o.Iz > 0 ? th.ok : '#FF8FB0'],
      ['least input that regulates', Zn.VinMin.toFixed(3) + ' V'], ['least load that regulates', Zn.RLmin.toFixed(1) + ' Ω'],
      ['series current (V_in − V)/R_s', (o.Is * 1000).toFixed(3) + ' mA']
    ]);
  }

  /* ======================= 28.5 · logic gates ======================= */
  function drawGates(S, g) {
    const ctx = g.ctx, th = g.theme, p = S.p, cam = S.cam, Gt = S.Gt;
    const F = R3.Frame(ctx, cam, { ambient: 0.42, floorZ: null });
    board(F, -1.2, 1.2, -0.6, 0.6);
    const tt = (S.ts * 0.8) % 16, o = Gt.out[Math.min(Gt.out.length - 1, Math.round(tt / 0.02))], on = v => v ? '#7CF0B0' : '#39414F';
    // the chip
    R3.box(F, [0, 0, 0.06], [0.7, 0.45, 0.12], '#1A1C22', { shadow: false });
    for (let k = 0; k < 7; k++) [-1, 1].forEach(sg => R3.box(F, [-0.3 + k * 0.1, sg * 0.25, 0.03], [0.03, 0.06, 0.02], '#C8D0DC', { shadow: false }));
    R3.label(F, [0, 0, 0.15], p.gate + ' gate', '#DCE3EE', { size: 12 });
    // switches for A and B, LEDs on the inputs and the output
    const led = (c, v, lab) => { R3.sphere(F, c, 0.05, v ? '#7CF0B0' : '#2A3040', { shadow: false, vivid: !!v }); R3.label(F, V.add(c, [0, 0, 0.1]), lab + ' = ' + v, v ? '#7CF0B0' : '#8FA4CE', { size: 10 }); };
    led([-0.9, 0.25, 0.05], o[1], 'A'); if (!Gt.one) led([-0.9, -0.25, 0.05], o[2], 'B');
    wire(F, [[-0.85, 0.25, 0], [-0.35, 0.25, 0]], on(o[1])); if (!Gt.one) wire(F, [[-0.85, -0.25, 0], [-0.35, -0.25, 0]], on(o[2]));
    wire(F, [[0.35, 0, 0], [0.85, 0, 0]], on(o[3])); led([0.9, 0, 0.05], o[3], 'Y');
    F.render();
    // the truth table, drawn in screen space
    const tx = g.w - 210, ty = 90; ctx.save(); ctx.fillStyle = 'rgba(8,12,22,.9)'; ctx.strokeStyle = th.line; const rows = Gt.table.length + 1, rh = 20;
    ctx.fillRect(tx, ty, 190, rows * rh + 10); ctx.strokeRect(tx + .5, ty + .5, 190, rows * rh + 10);
    ctx.font = '11px "IBM Plex Mono",monospace'; ctx.textAlign = 'center';
    const cols = Gt.one ? ['A', 'Y'] : ['A', 'B', 'Y'], cw = 190 / cols.length;
    cols.forEach((c, k) => { ctx.fillStyle = '#8FA4CE'; ctx.fillText(c, tx + cw * (k + 0.5), ty + 16); });
    Gt.table.forEach((r, j) => { const cur = r[0] === o[1] && (Gt.one || r[1] === o[2]); if (cur) { ctx.fillStyle = 'rgba(124,240,176,.15)'; ctx.fillRect(tx + 2, ty + (j + 1) * rh + 3, 186, rh); }
      const vals = Gt.one ? [r[0], r[2]] : r; vals.forEach((v, k) => { ctx.fillStyle = k === vals.length - 1 ? (v ? '#7CF0B0' : '#FF8FB0') : '#DCE3EE'; ctx.fillText(String(v), tx + cw * (k + 0.5), ty + (j + 1) * rh + 17); }); });
    ctx.restore();
    const bool = { AND: 'Y = A·B', OR: 'Y = A + B', NAND: 'Y = (A·B)̅', NOR: 'Y = (A + B)̅', XOR: 'Y = A ⊕ B', XNOR: 'Y = (A ⊕ B)̅', NOT: 'Y = A̅' }[p.gate];
    header(g, 'The ' + p.gate + ' gate · ' + bool, 'inputs driven by two square waves (periods ' + p.pA.toFixed(1) + ' and ' + p.pB.toFixed(1) + ' s) · the highlighted row of the truth table is the state now',
      'NAND and NOR are universal: any gate can be built from them — this one takes ' + Gt.nandCount + ' NAND gate' + (Gt.nandCount > 1 ? 's' : ''), th.text);
    panel(g, 'THE GATE', [['output high for', (Gt.highFrac * 100).toFixed(1) + '% of the time', th.phys], ['NAND gates to build it', String(Gt.nandCount)], ['state now', 'A = ' + o[1] + (Gt.one ? '' : ', B = ' + o[2]) + ' → Y = ' + o[3], o[3] ? th.ok : null]]);
  }

  const BNM = S => S.p.mode === 'bands', JNM = S => S.p.mode === 'junction', RCM = S => S.p.mode === 'rect', ZNM = S => S.p.mode === 'zener', GTM = S => S.p.mode === 'gates';

  L.register({
    id: 'semicond', subject: 'physics',
    name: 'Semiconductors — Bands and Doping, the p–n Junction, Rectifiers, the Zener Regulator, Logic Gates',
    chapter: 'Semiconductor Electronics',
    exams: ['JEE Main', 'NEET UG', 'JEE Advanced'],
    weight: 'Every paper · scoring chapter',
    is3D: true,
    stageHint: 'Drag to orbit · carrier densities, diode currents and waveforms are computed, not drawn to look right',
    lede: 'The chapter as a working bench. A crystal of <b>Si or Ge</b> at any temperature, intrinsic or doped: n and p come from charge ' +
      'neutrality and their product is always <b>n_i²</b>, with the Fermi level moving on the band diagram. A <b>p–n junction</b> under bias: the ' +
      'depletion layer breathes, and the current follows the Shockley equation into breakdown. Real diodes <b>rectify</b> a sine wave, half-wave ' +
      'or bridge, with a capacitor that turns it into <b>ripple</b>. A <b>Zener</b> holds a voltage until its current runs out. And the ' +
      '<b>logic gates</b>, with truth tables and timing diagrams.',

    params: { mode: 'bands', mat: 'Si', Tk: 300, dop: 'n', dE: 16,
              Tj: 300, aE: 17, nE: 16, Is: 1e-14, eta: 1, Rs: 1, VZ: 6, rZ: 5, Vapp: 0.7,
              rect: 'bridge', Vpk: 12, fq: 50, RL: 1000, Cf: 470,
              Vin: 12, Vz: 5.6, rz: 2, Rser: 220, RLz: 1000,
              gate: 'XOR', pA: 2, pB: 4, phB: 0, run: true },

    presets: [
      { name: 'Intrinsic silicon at 300 K', params: { mode: 'bands', mat: 'Si', Tk: 300, dop: 'i' } },
      { name: 'n-type silicon (10¹⁶ donors)', params: { mode: 'bands', mat: 'Si', Tk: 300, dop: 'n', dE: 16 } },
      { name: 'p-type germanium', params: { mode: 'bands', mat: 'Ge', Tk: 300, dop: 'p', dE: 15 } },
      { name: 'Hot doped silicon: turns intrinsic', params: { mode: 'bands', mat: 'Si', Tk: 650, dop: 'n', dE: 15 } },
      { name: 'Junction · forward bias', params: { mode: 'junction', Vapp: 0.7 } },
      { name: 'Junction · reverse bias', params: { mode: 'junction', Vapp: -3 } },
      { name: 'Junction · Zener breakdown', params: { mode: 'junction', Vapp: -6.5 } },
      { name: 'Half-wave rectifier, no capacitor', params: { mode: 'rect', rect: 'half', Cf: 0 } },
      { name: 'Bridge rectifier, no capacitor', params: { mode: 'rect', rect: 'bridge', Cf: 0 } },
      { name: 'Bridge with a 470 µF capacitor', params: { mode: 'rect', rect: 'bridge', Cf: 470 } },
      { name: 'Zener regulator holding 5.6 V', params: { mode: 'zener', Vin: 12, RLz: 1000 } },
      { name: 'Zener: load too heavy, it lets go', params: { mode: 'zener', Vin: 12, RLz: 150 } },
      { name: 'XOR gate timing', params: { mode: 'gates', gate: 'XOR' } },
      { name: 'NAND: the universal gate', params: { mode: 'gates', gate: 'NAND' } }
    ],

    controls: [
      { group: 'Bench', items: [
        { key: 'mode', type: 'select', label: 'Experiment', restructure: true, rebuild: true, options: [
          { value: 'bands', label: 'Bands and doping' }, { value: 'junction', label: 'The p–n junction' }, { value: 'rect', label: 'The rectifier' },
          { value: 'zener', label: 'The Zener regulator' }, { value: 'gates', label: 'Logic gates' }] }
      ] },
      { group: 'The crystal', items: [
        { key: 'mat', type: 'select', label: 'Material', restructure: true, when: S => BNM(S) || JNM(S), options: [{ value: 'Si', label: 'Silicon' }, { value: 'Ge', label: 'Germanium' }] },
        { key: 'dop', type: 'select', label: 'Doping', restructure: true, when: BNM, options: [{ value: 'i', label: 'Intrinsic' }, { value: 'n', label: 'n-type (pentavalent donors)' }, { value: 'p', label: 'p-type (trivalent acceptors)' }] },
        { key: 'dE', label: 'Dopant density (10^x cm⁻³)', min: 13, max: 19, step: 0.1, unit: '', when: S => BNM(S) && S.p.dop !== 'i', fmt: v => '10^' + v.toFixed(1), restructure: true },
        { key: 'Tk', label: 'Temperature', min: 100, max: 800, step: 5, unit: 'K', when: BNM, fmt: v => v.toFixed(0), restructure: true }
      ] },
      { group: 'The junction', items: [
        { key: 'Vapp', label: 'Applied voltage', min: -8, max: 1, step: 0.005, unit: 'V', when: JNM, fmt: v => v.toFixed(3), restructure: true },
        { key: 'aE', label: 'Acceptors, p side (10^x cm⁻³)', min: 14, max: 19, step: 0.1, unit: '', when: JNM, fmt: v => '10^' + v.toFixed(1), restructure: true },
        { key: 'nE', label: 'Donors, n side (10^x cm⁻³)', min: 14, max: 19, step: 0.1, unit: '', when: JNM, fmt: v => '10^' + v.toFixed(1), restructure: true },
        { key: 'Tj', label: 'Temperature', min: 250, max: 400, step: 1, unit: 'K', when: JNM, fmt: v => v.toFixed(0), restructure: true },
        { key: 'VZ', label: 'Breakdown voltage', min: 2, max: 7.5, step: 0.1, unit: 'V', when: JNM, fmt: v => v.toFixed(1), restructure: true },
        { key: 'Rs', label: 'Series resistance', min: 0.1, max: 50, step: 0.1, unit: 'Ω', when: JNM, fmt: v => v.toFixed(1), restructure: true }
      ] },
      { group: 'The rectifier', items: [
        { key: 'rect', type: 'select', label: 'Circuit', restructure: true, when: RCM, options: [{ value: 'half', label: 'Half-wave (one diode)' }, { value: 'bridge', label: 'Full-wave bridge (four)' }] },
        { key: 'Cf', label: 'Smoothing capacitor', min: 0, max: 2200, step: 10, unit: 'µF', when: RCM, fmt: v => v.toFixed(0), restructure: true },
        { key: 'RL', label: 'Load', min: 50, max: 10000, step: 10, unit: 'Ω', when: RCM, fmt: v => v.toFixed(0), restructure: true },
        { key: 'Vpk', label: 'Peak input', min: 2, max: 30, step: 0.5, unit: 'V', when: RCM, fmt: v => v.toFixed(1), restructure: true },
        { key: 'fq', label: 'Frequency', min: 10, max: 200, step: 1, unit: 'Hz', when: RCM, fmt: v => v.toFixed(0), restructure: true }
      ] },
      { group: 'The Zener', items: [
        { key: 'Vin', label: 'Input voltage', min: 0, max: 25, step: 0.1, unit: 'V', when: ZNM, fmt: v => v.toFixed(1), restructure: true },
        { key: 'RLz', label: 'Load', min: 50, max: 5000, step: 5, unit: 'Ω', when: ZNM, fmt: v => v.toFixed(0), restructure: true },
        { key: 'Rser', label: 'Series resistor', min: 20, max: 2000, step: 5, unit: 'Ω', when: ZNM, fmt: v => v.toFixed(0), restructure: true },
        { key: 'Vz', label: 'Zener voltage', min: 2, max: 15, step: 0.1, unit: 'V', when: ZNM, fmt: v => v.toFixed(1), restructure: true }
      ] },
      { group: 'The gate', items: [
        { key: 'gate', type: 'select', label: 'Gate', restructure: true, when: GTM, options: ['AND', 'OR', 'NOT', 'NAND', 'NOR', 'XOR', 'XNOR'].map(v => ({ value: v, label: v })) },
        { key: 'pA', label: 'Input A half-period', min: 0.5, max: 4, step: 0.1, unit: 's', when: GTM, fmt: v => v.toFixed(1), restructure: true },
        { key: 'pB', label: 'Input B half-period', min: 0.5, max: 4, step: 0.1, unit: 's', when: S => GTM(S) && S.p.gate !== 'NOT', fmt: v => v.toFixed(1), restructure: true },
        { key: 'phB', label: 'B delayed by', min: 0, max: 4, step: 0.1, unit: 's', when: S => GTM(S) && S.p.gate !== 'NOT', fmt: v => v.toFixed(1), restructure: true }
      ] },
      { group: 'Display', items: [
        { key: 'run', type: 'toggle', label: 'Let it run' }
      ] }
    ],

    setup(S) {
      const p = S.p;
      p.Ndop = Math.pow(10, p.dE); p.NA = Math.pow(10, p.aE); p.ND = Math.pow(10, p.nE);
      if (p.mode === 'bands') { S.Cr = carriers(p); S.Tcurve = []; for (let T = 100; T <= 800; T += 10) { const c = carriers(p, T); S.Tcurve.push([T, c.n, c.p, c.ni]); } }
      else if (p.mode === 'junction') S.J = runJunction(p);
      else if (p.mode === 'rect') { S.Rc = runRect(p); S.Ccurve = []; for (const C of [0, 50, 100, 220, 470, 1000, 2200]) { const r = runRect(Object.assign({}, p, { Cf: C }), true); S.Ccurve.push([C, r.ripple, r.vavg]); } }
      else if (p.mode === 'zener') S.Zn = runZener(p);
      else S.Gt = runGates(p);
      S.ts = 0;
      const views = {
        bands: { theta: -1.1, phi: 0.45, dist: 3.6, target: [-0.35, 0, 0.3] },
        junction: { theta: -1.45, phi: 0.35, dist: 3.4, target: [0, 0, -0.1] },
        rect: { theta: -1.57, phi: 0.95, dist: 3.3, target: [0.3, 0.25, 0] },
        zener: { theta: -1.57, phi: 0.9, dist: 2.7, target: [-0.1, -0.05, 0] },
        gates: { theta: -1.57, phi: 0.8, dist: 2.6, target: [-0.2, 0, 0] }
      };
      if (!S.cam || S._view !== p.mode) { S.cam = Camera(views[p.mode]); S.cam.minDist = 0.8; S.cam.maxDist = 14; S._view = p.mode; S._narrowCam = false; }
    },

    step(S, dt) { if (S.p.run) S.ts += dt; },

    drawStage(S, g) {
      if (g.w < 660 && !S._narrowCam) { S.cam.dist *= 1.3; S._narrowCam = true; }
      const md = S.p.mode;
      if (md === 'bands') drawBands(S, g); else if (md === 'junction') drawJunction(S, g); else if (md === 'rect') drawRect(S, g); else if (md === 'zener') drawZener(S, g); else drawGates(S, g);
    },

    plots: [
      { title: S => ({ bands: 'Carrier densities against temperature (log scale)', junction: 'The I–V curve (current on a symmetric log scale)', rect: 'Input and output voltage', zener: 'Output and Zener current against the input voltage', gates: 'Timing diagram' })[S.p.mode],
        draw(S, g) {
          const p = S.p, th = g.theme, cy = '#3DD6F5', gr = '#7CF0B0', am = '#F5B451', pk = '#FF8FB0';
          if (p.mode === 'bands') {
            const c = S.Tcurve, lg = v => Math.log10(Math.max(v, 1)), all = c.flatMap(q => [lg(q[1]), lg(q[2]), lg(q[3])]);
            const P = g.Plot({ xmin: 100, xmax: 800, ymin: Math.max(0, Math.min(...all)), ymax: Math.max(...all) + 0.5, xlabel: 'T (K)', ylabel: 'log₁₀ (density, cm⁻³)', xfmt: v => v.toFixed(0), yfmt: v => v.toFixed(0) }).frame();
            P.clip(() => { P.line(c.map(q => [q[0], lg(q[3])]), g.alpha(th.text, .6), 1.4, [5, 3]); P.line(c.map(q => [q[0], lg(q[1])]), cy, 2.2); P.line(c.map(q => [q[0], lg(q[2])]), pk, 2.2); P.vline(p.Tk, g.alpha(gr, .7), [3, 3]); if (p.dop !== 'i') P.hline(lg(p.Ndop), g.alpha(am, .6), [2, 4]); });
            P.tag(110, lg(c[c.length - 1][3]), 'blue: electrons · pink: holes · dashed: n_i' + (p.dop !== 'i' ? ' · amber: dopant density' : ''), th['text-2'], 'left', -8);
            return;
          }
          if (p.mode === 'junction') {
            const J = S.J, sl = I => Math.sign(I) * Math.log10(1 + Math.abs(I) / 1e-12);
            const pts = J.iv.map(q => [q[0], sl(q[1])]), lo = Math.min(...pts.map(q => q[1])), hi = Math.max(...pts.map(q => q[1]));
            const P = g.Plot({ xmin: J.iv[0][0], xmax: 1.2, ymin: lo - 0.5, ymax: hi + 0.5, xlabel: 'applied V (volts)', ylabel: 'current (sym-log)', xfmt: v => v.toFixed(1), yfmt: v => { const a = Math.abs(v); if (a < 0.5) return '0'; const I = Math.pow(10, a - 12), s2 = v < 0 ? '−' : ''; return s2 + (I >= 1e-3 ? (I * 1e3).toPrecision(2) + ' mA' : I >= 1e-6 ? (I * 1e6).toPrecision(2) + ' µA' : I >= 1e-9 ? (I * 1e9).toPrecision(2) + ' nA' : (I * 1e12).toPrecision(2) + ' pA'); }, pad: { l: 62 } }).frame();
            P.clip(() => { P.hline(0, g.alpha(th['text-3'], .7)); P.vline(0, g.alpha(th['text-3'], .7)); P.line(pts, cy, 2.4); P.vline(-p.VZ, g.alpha(pk, .7), [3, 3]); P.dot(p.Vapp, sl(J.op.I), 5.5, am, th['ink-950']); });
            P.tag(-p.VZ, hi * 0.6, 'breakdown −V_Z', pk, 'left', 0); P.tag(0.02, lo * 0.5, 'reverse: only −I_s leaks', th['text-3'], 'left', 0);
            return;
          }
          if (p.mode === 'rect') {
            const Rc = S.Rc, per = 1 / p.fq, pts = Rc.out.filter(q => q[0] >= Rc.tEnd - 4 * per);
            const P = g.Plot({ xmin: (Rc.tEnd - 4 * per) * 1000, xmax: Rc.tEnd * 1000, ymin: -p.Vpk * 1.1, ymax: p.Vpk * 1.1, xlabel: 't (ms)', ylabel: 'V', xfmt: v => v.toFixed(0), yfmt: v => v.toFixed(0) }).frame();
            P.clip(() => { P.hline(0, g.alpha(th['text-3'], .7)); P.line(pts.map(q => [q[0] * 1000, q[1]]), g.alpha(th.text, .5), 1.6); P.line(pts.map(q => [q[0] * 1000, q[2]]), gr, 2.4); });
            P.tag(Rc.tEnd * 1000, Rc.vmax, 'output: ripple ' + Rc.ripple.toFixed(3) + ' V', gr, 'right', -8);
            return;
          }
          if (p.mode === 'zener') {
            const Zn = S.Zn, sw = Zn.sweep, hi = Math.max(...sw.map(q => q[1])) * 1.15, hiI = Math.max(1, ...sw.map(q => q[2]));
            const P = g.Plot({ xmin: 0, xmax: sw[sw.length - 1][0], ymin: 0, ymax: hi, xlabel: 'input voltage (V)', ylabel: 'V_out (V) · I_Z (mA, scaled)', xfmt: v => v.toFixed(0), yfmt: v => v.toFixed(0) }).frame();
            P.clip(() => { P.line(sw.map(q => [q[0], q[1]]), cy, 2.4); P.line(sw.map(q => [q[0], q[2] / hiI * hi * 0.9]), am, 1.8, [5, 3]); P.vline(Zn.VinMin, g.alpha(pk, .8), [3, 3]); P.dot(p.Vin, Zn.op.V, 5.5, gr, th['ink-950']); });
            P.tag(Zn.VinMin, hi * 0.95, 'regulates above ' + Zn.VinMin.toFixed(2) + ' V', pk, 'left', 0); P.tag(sw[sw.length - 1][0] * 0.98, hi * 0.5, 'amber dashed: I_Z', am, 'right', 0);
            return;
          }
          const Gt = S.Gt, o = Gt.out, rows = Gt.one ? [['A', 1], ['Y', 3]] : [['A', 1], ['B', 2], ['Y', 3]], n = rows.length;
          const P = g.Plot({ xmin: 0, xmax: 16, ymin: 0, ymax: n * 1.5, xlabel: 't (s)', ylabel: '', xfmt: v => v.toFixed(0), yfmt: () => '' }).frame();
          P.clip(() => { rows.forEach(([lab, k], j) => { const base = (n - 1 - j) * 1.5 + 0.2; P.line(o.map(q => [q[0], base + q[k]]), k === 3 ? gr : cy, 2.2); }); P.vline((S.ts * 0.8) % 16, g.alpha(am, .7), [3, 3]); });
          rows.forEach(([lab], j) => P.tag(0.1, (n - 1 - j) * 1.5 + 1.25, lab, lab === 'Y' ? gr : cy, 'left', 0));
        } },
      { title: S => ({ bands: 'Where the Fermi level sits, against doping', junction: 'Depletion width against the applied voltage', rect: 'Ripple and mean output against the capacitor', zener: 'Output against the load resistance', gates: 'Building it from NAND gates' })[S.p.mode],
        draw(S, g) {
          const p = S.p, th = g.theme, cy = '#3DD6F5', gr = '#7CF0B0', am = '#F5B451', pk = '#FF8FB0';
          if (p.mode === 'bands') {
            const pts = []; for (let e = 13; e <= 19.001; e += 0.1) { const Nd = Math.pow(10, e); const cn = carriers(Object.assign({}, p, { dop: 'n', Ndop: Nd })), cp = carriers(Object.assign({}, p, { dop: 'p', Ndop: Nd })); pts.push([e, cn.Ef, cp.Ef, cn.Eg]); }
            const Eg = S.Cr.Eg, P = g.Plot({ xmin: 13, xmax: 19, ymin: -Eg / 2, ymax: Eg / 2, xlabel: 'log₁₀ dopant density (cm⁻³)', ylabel: 'E_F − E_i (eV)', xfmt: v => v.toFixed(0), yfmt: v => v.toFixed(2) }).frame();
            P.clip(() => { P.hline(0, g.alpha(th['text-3'], .7)); P.hline(Eg / 2, g.alpha(cy, .6), [3, 3]); P.hline(-Eg / 2, g.alpha(pk, .6), [3, 3]); P.line(pts.map(q => [q[0], q[1]]), cy, 2.2); P.line(pts.map(q => [q[0], q[2]]), pk, 2.2); if (p.dop !== 'i') P.dot(Math.log10(p.Ndop), S.Cr.Ef, 5.5, am, th['ink-950']); });
            P.tag(13.1, Eg / 2, 'E_c', cy, 'left', 10); P.tag(13.1, -Eg / 2, 'E_v', pk, 'left', -6); P.tag(18.9, pts[pts.length - 1][1], 'n-type', cy, 'right', 12); P.tag(18.9, pts[pts.length - 1][2], 'p-type', pk, 'right', -8);
            return;
          }
          if (p.mode === 'junction') {
            const J = S.J, eps = SEMI[p.mat].eps * 8.854e-14, q = 1.602e-19, pts = []; for (let V = -8; V < J.Vbi - 0.02; V += 0.02) pts.push([V, Math.sqrt(2 * eps * (J.Vbi - V) * (1 / p.NA + 1 / p.ND) / q) * 1e4]);
            const P = g.Plot({ xmin: -8, xmax: J.Vbi, ymin: 0, ymax: Math.max(...pts.map(r => r[1])) * 1.1, xlabel: 'applied V (volts)', ylabel: 'depletion width (µm)', xfmt: v => v.toFixed(1), yfmt: v => v.toFixed(2) }).frame();
            P.clip(() => { P.line(pts, am, 2.4); P.vline(0, g.alpha(th['text-3'], .7), [3, 3]); P.dot(Math.min(p.Vapp, J.Vbi - 0.02), J.W * 1e4, 5.5, gr, th['ink-950']); });
            P.tag(-7.9, pts[0][1], 'W ∝ √(V_bi − V)', am, 'left', 12);
            return;
          }
          if (p.mode === 'rect') {
            const c = S.Ccurve, hi = Math.max(...c.map(q => Math.max(q[1], q[2]))) * 1.1;
            const P = g.Plot({ xmin: 0, xmax: 2200, ymin: 0, ymax: hi, xlabel: 'capacitor (µF)', ylabel: 'V', xfmt: v => v.toFixed(0), yfmt: v => v.toFixed(1) }).frame();
            P.clip(() => { P.line(c.map(q => [q[0], q[1]]), pk, 2.2); P.line(c.map(q => [q[0], q[2]]), gr, 2.2); c.forEach(q => { P.dot(q[0], q[1], 3, pk); P.dot(q[0], q[2], 3, gr); }); P.vline(p.Cf, g.alpha(am, .8), [3, 3]); });
            P.tag(2150, c[c.length - 1][2], 'mean output', gr, 'right', -8); P.tag(2150, c[c.length - 1][1], 'ripple (p–p)', pk, 'right', -8);
            return;
          }
          if (p.mode === 'zener') {
            const Zn = S.Zn, ls = Zn.loadSweep, hi = Math.max(...ls.map(q => q[1])) * 1.15;
            const P = g.Plot({ xmin: Math.log10(50), xmax: Math.log10(5000), ymin: 0, ymax: hi, xlabel: 'load resistance (log scale, Ω)', ylabel: 'V_out (V)', xfmt: v => Math.pow(10, v).toFixed(0), yfmt: v => v.toFixed(1) }).frame();
            P.clip(() => { P.line(ls.map(q => [Math.log10(q[0]), q[1]]), cy, 2.4); P.vline(Math.log10(Zn.RLmin), g.alpha(pk, .8), [3, 3]); P.dot(Math.log10(p.RLz), Zn.op.V, 5.5, gr, th['ink-950']); });
            P.tag(Math.log10(Zn.RLmin), hi * 0.3, 'below ' + Zn.RLmin.toFixed(0) + ' Ω it cannot hold', pk, 'left', 0);
            return;
          }
          // the NAND-only construction, drawn as a little schematic of NAND symbols
          const ctx = g.ctx, n = S.Gt.nandCount, w = g.w, h = g.h; ctx.save(); ctx.clearRect(0, 0, w, h);
          const bw = Math.min(90, (w - 40) / Math.max(1, n) - 14), y = h / 2;
          for (let k = 0; k < n; k++) { const x = 20 + k * (bw + 14);
            ctx.strokeStyle = '#7CF0B0'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(x, y - 26); ctx.lineTo(x + bw * 0.5, y - 26); ctx.arc(x + bw * 0.5, y, 26, -Math.PI / 2, Math.PI / 2); ctx.lineTo(x, y + 26); ctx.closePath(); ctx.stroke();
            ctx.beginPath(); ctx.arc(x + bw * 0.5 + 31, y, 5, 0, TAU); ctx.stroke(); ctx.fillStyle = '#DCE3EE'; ctx.font = '10px "IBM Plex Mono",monospace'; ctx.textAlign = 'center'; ctx.fillText('NAND', x + bw * 0.35, y + 4); }
          ctx.fillStyle = th['text-2']; ctx.textAlign = 'left'; ctx.font = '11px "IBM Plex Sans",sans-serif';
          ctx.fillText(p.gate + ' needs ' + n + ' NAND gate' + (n > 1 ? 's' : '') + ({ NOT: ' — join both inputs', AND: ' — NAND then NOT', OR: ' — NOT each input, then NAND', NOR: ' — OR, then NOT', NAND: '', XOR: ' — the classic four-gate build', XNOR: ' — XOR, then NOT' })[p.gate], 20, 22);
          ctx.restore();
        } }
    ],

    readouts(S) {
      const p = S.p;
      if (p.mode === 'bands') { const C = S.Cr; return [{ label: 'n', value: C.n.toExponential(3), unit: 'cm⁻³', flag: 'accent' }, { label: 'p', value: C.p.toExponential(3), unit: 'cm⁻³' }, { label: 'n_i', value: C.ni.toExponential(3), unit: 'cm⁻³' }, { label: 'E_F − E_i', value: (C.Ef * 1000).toFixed(1), unit: 'meV' }]; }
      if (p.mode === 'junction') { const J = S.J; return [{ label: 'Current', value: (J.op.I * 1000).toExponential(3), unit: 'mA', flag: 'accent' }, { label: 'V_bi', value: J.Vbi.toFixed(4), unit: 'V' }, { label: 'Depletion width', value: (J.W * 1e4).toFixed(4), unit: 'µm' }, { label: 'Knee (1 mA)', value: isFinite(J.knee) ? J.knee.toFixed(3) : '—', unit: 'V' }]; }
      if (p.mode === 'rect') { const R = S.Rc; return [{ label: 'Peak output', value: R.vmax.toFixed(3), unit: 'V', flag: 'accent' }, { label: 'Ripple', value: R.ripple.toFixed(4), unit: 'V' }, { label: 'Ripple frequency', value: R.fr.toFixed(0), unit: 'Hz' }, { label: 'Mean output', value: R.vavg.toFixed(3), unit: 'V' }]; }
      if (p.mode === 'zener') { const Z = S.Zn; return [{ label: 'V_out', value: Z.op.V.toFixed(4), unit: 'V', flag: 'accent' }, { label: 'I_Z', value: (Z.op.Iz * 1000).toFixed(3), unit: 'mA' }, { label: 'I_L', value: (Z.op.IL * 1000).toFixed(3), unit: 'mA' }, { label: 'Regulating?', value: Z.regulating ? 'yes' : 'no', unit: '', flag: Z.regulating ? 'ok' : 'crit' }]; }
      const G2 = S.Gt; return [{ label: 'Gate', value: p.gate, unit: '', flag: 'accent' }, { label: 'NAND gates to build', value: String(G2.nandCount), unit: '' }, { label: 'Output high', value: (G2.highFrac * 100).toFixed(1), unit: '%' }];
    },

    equation(S) {
      const p = S.p;
      if (p.mode === 'bands') return E.v('n') + E.v('p') + ' ' + E.op('=') + ' ' + E.v('n') + E.sub('i') + '² · ' + E.v('n') + E.sub('i') + ' ' + E.op('∝') + ' ' + E.v('T') + '^{3/2} e^(−' + E.v('E') + E.sub('g') + '/2' + E.v('kT') + ') · n-type: ' + E.v('n') + ' ≈ ' + E.v('N') + E.sub('D') + ', ' + E.v('p') + ' ≈ ' + E.v('n') + E.sub('i') + '²/' + E.v('N') + E.sub('D');
      if (p.mode === 'junction') return E.v('I') + ' ' + E.op('=') + ' ' + E.v('I') + E.sub('s') + '(e^(' + E.v('V') + '/η' + E.v('V') + E.sub('T') + ') − 1) · ' + E.v('V') + E.sub('bi') + ' ' + E.op('=') + ' ' + E.v('V') + E.sub('T') + ' ln(' + E.v('N') + E.sub('A') + E.v('N') + E.sub('D') + '/' + E.v('n') + E.sub('i') + '²) · ' + E.v('W') + ' ' + E.op('∝') + ' √(' + E.v('V') + E.sub('bi') + ' − ' + E.v('V') + ')';
      if (p.mode === 'rect') return E.v('V') + E.sub('ripple') + ' ≈ ' + E.frac(E.v('V') + E.sub('peak'), E.v('f') + E.sub('r') + E.v('RC')) + ' · ' + E.v('f') + E.sub('r') + ' ' + E.op('=') + ' ' + E.v('f') + ' (half-wave), 2' + E.v('f') + ' (full-wave)';
      if (p.mode === 'zener') return E.v('I') + E.sub('s') + ' ' + E.op('=') + ' ' + E.frac(E.v('V') + E.sub('in') + ' − ' + E.v('V') + E.sub('Z'), E.v('R') + E.sub('s')) + ' ' + E.op('=') + ' ' + E.v('I') + E.sub('Z') + ' + ' + E.v('I') + E.sub('L') + ' · regulates while ' + E.v('I') + E.sub('Z') + ' ' + E.op('>') + ' 0';
      return { AND: 'Y = A·B', OR: 'Y = A + B', NAND: 'Y = ¬(A·B)', NOR: 'Y = ¬(A + B)', XOR: 'Y = A·¬B + ¬A·B', XNOR: 'Y = A·B + ¬A·¬B', NOT: 'Y = ¬A' }[p.gate];
    },

    eqNote: '<b>Densities, not pictures.</b> The carrier densities come from the band gap and charge neutrality, so the product n·p = n_i² is a ' +
      'result you can check at any doping and temperature. The diode is the Shockley equation with a series resistance, solved for the junction ' +
      'voltage at every point of the curve and at every instant of a rectifier\'s cycle — which is why the output sits about 0.7 V (or 1.4 V ' +
      'through a bridge) below the peak, and why the ripple depends on the capacitor, the load and the frequency.',

    problems: [
      { source: 'JEE Main pattern · mass-action law',
        q: 'Silicon at 300 K has n_i ≈ 1.07 × 10¹⁰ cm⁻³ (in this model). It is doped with 10¹⁶ donors per cm³. What is the hole density, in cm⁻³ (enter the number ÷ 10⁴)?',
        params: { mode: 'bands', mat: 'Si', Tk: 300, dop: 'n', dE: 16 },
        predict: { label: 'p ÷ 10⁴', unit: '', tol: 0.01 },
        measure: S => S.Cr.p / 1e4,
        working: 'n ≈ N_D = 10¹⁶, and n·p = n_i², so p = (1.066 × 10¹⁰)²/10¹⁶ ≈ <b>1.14 × 10⁴ cm⁻³</b>. Doping raises one carrier a million-fold and suppresses the other by the same factor.' },
      { source: 'JEE Main pattern · the built-in potential',
        q: 'A silicon junction has N_A = 10¹⁷ and N_D = 10¹⁶ cm⁻³ at 300 K. What is its built-in potential, in V?',
        params: { mode: 'junction', mat: 'Si', Tj: 300, aE: 17, nE: 16, Vapp: 0 },
        predict: { label: 'V_bi', unit: 'V', tol: 0.01 },
        measure: S => S.J.Vbi,
        working: 'V_bi = (kT/q) ln(N_A N_D/n_i²) = 0.02585 × ln(10³³/1.14 × 10²⁰) ≈ <b>0.77 V</b>.' },
      { source: 'JEE Main pattern · ripple frequency',
        q: 'A full-wave bridge rectifier is fed from 50 Hz mains. What is the frequency of the ripple on its output, in Hz?',
        params: { mode: 'rect', rect: 'bridge', Vpk: 12, fq: 50, RL: 1000, Cf: 470 },
        predict: { label: 'f', unit: 'Hz', tol: 0.001 },
        measure: S => { const o = S.Rc.out, last = o.filter(q => q[0] >= S.Rc.tEnd - 3 / S.p.fq); let peaks = []; for (let i = 1; i < last.length - 1; i++) if (last[i][2] > last[i - 1][2] && last[i][2] >= last[i + 1][2] && last[i][2] > S.Rc.vmax - 0.05) peaks.push(last[i][0]); return peaks.length > 1 ? (peaks.length - 1) / (peaks[peaks.length - 1] - peaks[0]) : NaN; },
        working: 'Both halves of each cycle are used, so the output peaks twice per cycle: <b>100 Hz</b>. A half-wave rectifier ripples at 50 Hz.' },
      { source: 'JEE Main pattern · the bridge drop',
        q: 'A bridge rectifier (silicon diodes) is fed 12 V peak and drives 1 kΩ with a large capacitor. About how many volts is the peak output below the input peak (the run, in V)?',
        params: { mode: 'rect', rect: 'bridge', Vpk: 12, fq: 50, RL: 1000, Cf: 470 },
        predict: { label: 'drop', unit: 'V', tol: 0.05 },
        measure: S => S.p.Vpk - S.Rc.vmax,
        working: 'Two diodes conduct in series in a bridge, each dropping about 0.7–0.8 V at the charging-current peak: the output peaks <b>≈ 1.6 V</b> below the input. A half-wave circuit loses only one drop.' },
      { source: 'JEE Main pattern · Zener current',
        q: 'A 5.6 V Zener regulator has a 220 Ω series resistor, a 12 V input and a 1.0 kΩ load. What current flows through the Zener, in mA?',
        params: { mode: 'zener', Vin: 12, Vz: 5.6, rz: 2, Rser: 220, RLz: 1000 },
        predict: { label: 'I_Z', unit: 'mA', tol: 0.03 },
        measure: S => S.Zn.op.Iz * 1000,
        working: 'I_s = (12 − 5.6)/220 = 29.1 mA; I_L = 5.6/1000 = 5.6 mA; I_Z = 29.1 − 5.6 ≈ <b>23.5 mA</b> (the bench, with the Zener\'s 2 Ω slope, gives 23.2 mA).' },
      { source: 'JEE Main pattern · the least load',
        q: 'For the same regulator, what is the least load resistance for which the output still holds at 5.6 V, in Ω?',
        params: { mode: 'zener', Vin: 12, Vz: 5.6, rz: 2, Rser: 220, RLz: 1000 },
        predict: { label: 'R_L', unit: 'Ω', tol: 0.01 },
        measure: S => { let lo = 20, hi = 2000; for (let i = 0; i < 60; i++) { const m = (lo + hi) / 2; if (zenerSolve(S.p, S.p.Vin, m).Iz > 0) hi = m; else lo = m; } return (lo + hi) / 2; },
        working: 'At the edge I_Z = 0, so the whole series current (29.1 mA) flows in the load at 5.6 V: R_L = 5.6/0.0291 = <b>192.5 Ω</b>.' }
    ],

    walkthrough: [
      { title: '1 · Doping swaps the balance',
        body: 'Pure silicon, then n-type.',
        ask: 'If donors raise the electrons a million times, what happens to the holes?',
        reveal: '<b>They fall a million times.</b> n·p = n_i² stays fixed at a given temperature; extra electrons recombine with holes.',
        params: { mode: 'bands', mat: 'Si', Tk: 300, dop: 'n', dE: 16 } },
      { title: '2 · Heat undoes doping',
        body: 'Doped silicon heated to 650 K.',
        ask: 'Why do the electron and hole curves meet at high temperature?',
        reveal: '<b>n_i grows exponentially and swamps the dopants.</b> Once n_i ≫ N_D the material behaves as intrinsic — why electronics fail when hot.',
        params: { mode: 'bands', mat: 'Si', Tk: 650, dop: 'n', dE: 15 } },
      { title: '3 · The junction under bias',
        body: 'The same junction forward-biased, then reverse-biased.',
        ask: 'What happens to the depletion layer?',
        reveal: '<b>It narrows in forward bias and widens in reverse.</b> W ∝ √(V_bi − V): forward bias lowers the barrier, and carriers flood across.',
        params: { mode: 'junction', Vapp: -3 } },
      { title: '4 · From AC to DC',
        body: 'A bridge rectifier, then a capacitor added.',
        ask: 'What does the capacitor do between the peaks?',
        reveal: '<b>It feeds the load.</b> The diodes conduct only in short bursts near each peak to top it up; the output sags slightly in between — the ripple.',
        params: { mode: 'rect', rect: 'bridge', Cf: 470 } },
      { title: '5 · When a Zener lets go',
        body: 'A Zener regulator with a very heavy load.',
        ask: 'Why does the output collapse?',
        reveal: '<b>The load takes all the series current.</b> With no current left for the Zener it leaves breakdown and the output falls to the plain voltage divider.',
        params: { mode: 'zener', Vin: 12, RLz: 150 } }
    ],

    quiz: [
      { q: 'In an n-type semiconductor, n·p equals:',
        options: ['n_i²', 'N_D²', 'n_i', 'Zero'], answer: 0, why: 'The mass-action law holds at every doping.' },
      { q: 'Doping silicon with phosphorus (group 15) makes it:',
        options: ['n-type', 'p-type', 'Intrinsic', 'An insulator'], answer: 0, why: 'The fifth valence electron is donated.' },
      { q: 'Under reverse bias, the depletion layer:',
        options: ['Widens', 'Narrows', 'Disappears', 'Is unchanged'], answer: 0, why: 'W ∝ √(V_bi − V), and V is negative.' },
      { q: 'The ripple frequency of a full-wave rectifier on 50 Hz mains is:',
        options: ['100 Hz', '50 Hz', '25 Hz', '200 Hz'], answer: 0, why: 'Two output peaks per input cycle.' },
      { q: 'A Zener regulator stops regulating when:',
        options: ['The Zener current falls to zero', 'The load current falls to zero', 'The input exceeds V_Z', 'The series resistor is small'], answer: 0, why: 'Without current the Zener leaves breakdown.' },
      { q: 'The gate whose output is 1 only when its inputs differ is:',
        options: ['XOR', 'OR', 'NAND', 'XNOR'], answer: 0, why: 'Exclusive OR.' }
    ],

    notes: '<b>Where this shows up in the paper.</b><ul>' +
      '<li><b>Carriers</b>: n·p = n_i²; n_i rises steeply with T; in extrinsic material the majority equals the dopant density.</li>' +
      '<li><b>Junction</b>: barrier ~0.7 V (Si), ~0.3 V (Ge); depletion widens in reverse bias; I = I_s(e^{V/ηV_T} − 1).</li>' +
      '<li><b>Rectifiers</b>: half-wave average V_m/π, full-wave 2V_m/π; ripple frequency f or 2f; ripple ≈ V/(f_r RC).</li>' +
      '<li><b>Zener</b>: I_s = I_Z + I_L; regulation needs I_Z &gt; 0; P_Z = V_Z I_Z.</li>' +
      '<li><b>Gates</b>: truth tables; NAND and NOR are universal; XOR = A·B̄ + Ā·B.</li></ul>' +
      '<div class="pyq"><em>Trap to avoid</em> — forgetting the diode drops: a bridge loses two of them, not one.</div>'
  });
})(window.InsightLab);
