/* ============================================================
   PHYSICS (syllabus core, batch 5b — rotation, advanced)
     25. Rolling on curves, wedges and springs — the vertical loop,
         the ball in a bowl, a body on a free wedge, a rolling body
         on a spring
     26. Rotational impulse and connected bodies — τ = dL/dt measured,
         a ball striking a cube (tip or slide), the Atwood machine with
         a heavy pulley, a string wound on a rolling cylinder, a belt drive
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
     25 · ROLLING ON CURVES, WEDGES AND SPRINGS

     One contact model does all four benches. A body of mass m, radius r and
     I = k·mr² touches a surface; its centre moves along a path with speed v
     and it spins at ω. The friction F at the contact is an unknown: the
     value rolling would need is computed from the two equations of motion,
     and if |F| ≤ μN it is used; otherwise the contact slips and kinetic
     friction μN acts against the slip. N itself comes from the path's
     curvature, N = m(κv² + g cos ψ), so a ball in a loop can lose contact.
     ========================================================================= */
  const RBQ = { sphere: { name: 'solid sphere', k: 0.4 }, cylinder: { name: 'solid cylinder', k: 0.5 }, shell: { name: 'hollow sphere', k: 2 / 3 },
                ring: { name: 'ring', k: 1 }, block: { name: 'frictionless block (no spin)', k: 0 } };

  // tangential and angular accelerations at one contact. gt: gravity (and any other applied force)/m along the path.
  // extra: applied force components that also act at the CM do nothing to ω; the caller folds those into gt.
  // sample every iv seconds of a run with step dt, by step count (adding dt up drifts)
  const every = (t, dt, iv) => Math.round(t / dt) % Math.max(1, Math.round(iv / dt)) === 0;
  function contact(v, w, r, k, gt, N, mu, m) {
    if (k === 0) return { a: gt, al: 0, F: 0, slip: false };
    const u = v - w * r, Freq = -gt * k * m / (1 + k);
    if (Math.abs(u) < 1e-7 && Math.abs(Freq) <= mu * Math.max(0, N)) return { a: gt / (1 + k), al: gt / ((1 + k) * r), F: Freq, slip: false };
    const s = Math.abs(u) >= 1e-7 ? -Math.sign(u) : Math.sign(Freq), F = s * mu * Math.max(0, N);
    return { a: gt + F / m, al: -F * r / (k * m * r * r), F, slip: true };
  }

  /* ---- the path of the CENTRE for the loop bench: ramp, fillet, flat, loop, exit ---- */
  function loopPath(p) {
    const r = p.rbl, R = p.Rlp, rho = R - r, beta = p.beta * Math.PI / 180, rhoF = 0.45 - r, LC = 0.7, LE = 2.2;
    const drop = Math.max(0.02, p.hrel - rhoF * (1 - Math.cos(beta))), LA = drop / Math.sin(beta);
    const xB1 = -LC, CB = [xB1, r + rhoF], PB = [xB1 - rhoF * Math.sin(beta), r + rhoF * (1 - Math.cos(beta))];
    const PA = [PB[0] - LA * Math.cos(beta), PB[1] + LA * Math.sin(beta)], CD = [0, r + rho];
    const segs = [
      { L: LA, at: s => ({ x: PA[0] + s * Math.cos(beta), z: PA[1] - s * Math.sin(beta), psi: -beta, kap: 0 }) },
      { L: rhoF * beta, at: s => { const ps = -beta + s / rhoF; return { x: CB[0] + rhoF * Math.sin(ps), z: CB[1] - rhoF * Math.cos(ps), psi: ps, kap: 1 / rhoF }; } },
      { L: LC, at: s => ({ x: xB1 + s, z: r, psi: 0, kap: 0 }) },
      { L: TAU * rho, loop: true, at: s => { const ps = s / rho; return { x: CD[0] + rho * Math.sin(ps), z: CD[1] - rho * Math.cos(ps), psi: ps, kap: 1 / rho }; } },
      { L: LE, at: s => ({ x: s, z: r, psi: TAU, kap: 0 }) }
    ];
    let acc = 0; segs.forEach(sg => { sg.s0 = acc; acc += sg.L; });
    const at = s => { s = clamp(s, 0, acc); let i = segs.length - 1; while (i > 0 && s < segs[i].s0) i--; const q = segs[i].at(s - segs[i].s0); q.seg = i; return q; };
    return { r, R, rho, beta, rhoF, segs, len: acc, at, CD, PA, PB, CB, xB1, sLoop: segs[3].s0 };
  }

  function runLoop(p, quick) {
    const B = RBQ[p.lbody], k = B.k, m = p.mlp, P = loopPath(p), r = P.r, mu = p.mulp, I = k * m * r * r;
    let s = 0, v = 0, w = 0, t = 0, mode = 'c', fx = 0, fz = 0, fvx = 0, fvz = 0, heat = 0;
    let tDet = NaN, psiDet = NaN, madeIt = false, NTop = NaN, vTop = NaN, end = '', minN = Infinity, slipAny = false;
    const out = [], dt = quick ? 0.0008 : 0.0004, z0 = P.at(0).z;
    while (t < 9) {
      if (mode === 'c') {
        const q = P.at(s), N = m * (q.kap * v * v + G * Math.cos(q.psi)), gt = -G * Math.sin(q.psi);
        if (N < 0 && P.segs[q.seg].loop) {                  // leaves the track: now a projectile, spinning freely
          mode = 'f'; tDet = t; psiDet = q.psi; fx = q.x; fz = q.z; fvx = v * Math.cos(q.psi); fvz = v * Math.sin(q.psi); continue;
        }
        const c = contact(v, w, r, k, gt, N, mu, m);
        if (q.seg === 3) minN = Math.min(minN, N / (m * G));
        if (q.seg === 3 && Math.abs(q.psi - Math.PI) < 0.02 && !isFinite(NTop)) { NTop = N / (m * G); vTop = v; }
        if (c.slip) { slipAny = true; heat += Math.abs(c.F * (v - w * r)) * dt; }
        if (!quick && every(t, dt, 0.004))
          out.push([t, q.x, q.z, v, w, N / (m * G), c.F, c.slip, 'c', q.psi, s, heat]);
        // midpoint step: the accelerations are re-evaluated half a step on, so energy is kept to second order
        const sm = s + v * dt / 2, vm = v + c.a * dt / 2, wm = w + c.al * dt / 2, qm = P.at(sm);
        const Nm = m * (qm.kap * vm * vm + G * Math.cos(qm.psi)), cm = c.slip ? contact(vm, wm, r, k, -G * Math.sin(qm.psi), Nm, mu, m) : contact(vm, vm / r, r, k, -G * Math.sin(qm.psi), Nm, mu, m);
        const cc = cm.slip === c.slip ? cm : c;
        let v2 = v + cc.a * dt, w2 = w + cc.al * dt;
        if (c.slip && k > 0 && Math.sign(v2 - w2 * r) !== Math.sign(v - w * r) && Math.abs(v - w * r) > 1e-7) { const vr = (v2 + k * w2 * r) / (1 + k); v2 = vr; w2 = vr / r; }
        s += vm * dt; v = v2; w = w2;
        if (s >= P.sLoop + P.segs[3].L && !madeIt) madeIt = true;
        if (s >= P.len) { end = 'out'; break; }
        if (s <= 0 && v < 0) { s = 0; v = -v * 0; w = 0; }
      } else {
        fvz -= G * dt; fx += fvx * dt; fz += fvz * dt;
        if (!quick && every(t, dt, 0.004)) out.push([t, fx, fz, Math.hypot(fvx, fvz), w, 0, 0, false, 'f', 0, s, heat]);
        const d = Math.hypot(fx - P.CD[0], fz - P.CD[1]);
        if (d >= P.rho || fz <= r) { end = 'lands'; break; }
      }
      t += dt;
    }
    if (!end) end = 'time';
    const hMin = (5 + k) * P.rho / 2;
    return { B, k, m, r, R: P.R, P, out, tDet, psiDet, madeIt, NTop, vTop, hMin, end, minN, slipAny, heat, mu, I, z0,
             tEnd: out.length ? out[out.length - 1][0] : 0, h: p.hrel };
  }
  // the least release height that gets round, found by running the bench (bisection), not by the formula
  function loopHmin(p) {
    let lo = 0.5 * (p.Rlp - p.rbl), hi = 6 * (p.Rlp - p.rbl);
    for (let i = 0; i < 26; i++) { const mid = (lo + hi) / 2; if (runLoop(Object.assign({}, p, { hrel: mid }), true).madeIt) hi = mid; else lo = mid; }
    return (lo + hi) / 2;
  }

  /* ---- a ball in a bowl: the same contact, on one arc ---- */
  function runBowlQ(p, quick) {
    const B = RBQ[p.wbody], k = B.k, m = 1, r = p.rbw, rho = p.Rbw - r, mu = p.mubw;
    let ph = p.amp * Math.PI / 180, v = 0, w = 0, t = 0, heat = 0;
    const out = [], dt = quick ? 0.0008 : 0.0004, tMax = quick ? 12 : 10, turns = [];
    let prevV = 0;
    while (t < tMax) {
      const N = m * (v * v / rho + G * Math.cos(ph)), gt = -G * Math.sin(ph), c = contact(v, w, r, k, gt, N, mu, m);
      if (c.slip) heat += Math.abs(c.F * (v - w * r)) * dt;
      if (!quick && every(t, dt, 0.004)) out.push([t, ph, v, w, N / (m * G), c.F, c.slip, heat]);
      let v2 = v + c.a * dt, w2 = w + c.al * dt;
      if (c.slip && k > 0 && Math.sign(v2 - w2 * r) !== Math.sign(v - w * r) && Math.abs(v - w * r) > 1e-7) { const vr = (v2 + k * w2 * r) / (1 + k); v2 = vr; w2 = vr / r; }
      v = v2; w = w2; ph += v / rho * dt;
      if (prevV > 0 && v <= 0) turns.push(t);               // the far turning point, once per period
      prevV = v; t += dt;
    }
    let T = NaN; if (turns.length >= 2) T = (turns[turns.length - 1] - turns[0]) / (turns.length - 1);
    const T0 = TAU * Math.sqrt((1 + k) * rho / G);
    return { B, k, r, rho, R: p.Rbw, out, T, T0, Tslide: TAU * Math.sqrt(rho / G), heat, tEnd: tMax, mu };
  }

  /* ---- a body rolling down a wedge that is free to slide on a smooth floor ---- */
  function wedgeAcc(p, al) {
    const B = RBQ[p.gbody], k = B.k, m = p.mgb, M = p.fixW ? 1e9 : p.Mwg, a = al, c = Math.cos(a), s = Math.sin(a), mu = p.mugw;
    // unknowns [A, ar, N, f]: body x, body z, rotation (f = k m ar), wedge x
    let x = solve([[m, m * c, -s, c], [0, -m * s, -c, -s], [0, k * m, 0, -1], [M, 0, s, -c]], [0, -m * G, 0, 0]), rolls = k === 0 || x[3] <= mu * x[2] + 1e-12;
    if (!rolls) {                                              // slips: kinetic friction μN up the slope; the spin gets fN r/I
      const y = solve([[m, m * c, -s + c * mu], [0, -m * s, -c - s * mu], [M, 0, s - c * mu]], [0, -m * G, 0]);
      x = [y[0], y[1], y[2], mu * y[2]];
    }
    return { A: x[0], ar: x[1], N: x[2], f: x[3], rolls, k, m, M, alpha: k > 0 ? x[3] / (k * m) : 0 };   // alpha here is r·(angular accel)
  }
  function runWedge(p) {
    const al = p.wang * Math.PI / 180, W = wedgeAcc(p, al), Lw = p.Lwg, r = p.rgb, out = [];
    const tBot = Math.sqrt(2 * Lw / Math.max(1e-9, W.ar)), dt = 0.004;
    for (let t = 0; t <= tBot + 1e-9; t += dt) {
      const X = 0.5 * W.A * t * t, sr = 0.5 * W.ar * t * t, ang = 0.5 * W.alpha / r * t * t;
      const vx = W.A * t + W.ar * t * Math.cos(al), vz = -W.ar * t * Math.sin(al);
      out.push([t, X, sr, ang, W.A * t, W.ar * t, W.m * vx + W.M * W.A * t, vx, vz]);
    }
    { const t = tBot; out.push([t, 0.5 * W.A * t * t, Lw, 0.5 * W.alpha / r * t * t, W.A * t, W.ar * t, W.m * (W.A * t + W.ar * t * Math.cos(al)) + W.M * W.A * t, W.A * t + W.ar * t * Math.cos(al), -W.ar * t * Math.sin(al)]); }
    const last = out[out.length - 1], vW = last[4], vb = [last[7], last[8]], w = W.alpha / r * tBot;
    const KE = 0.5 * W.m * (vb[0] * vb[0] + vb[1] * vb[1]) + 0.5 * W.k * W.m * r * r * w * w + (p.fixW ? 0 : 0.5 * W.M * vW * vW);
    const PE = W.m * G * Lw * Math.sin(al), heat = W.rolls ? 0 : W.f * (0.5 * W.ar * tBot * tBot - r * 0.5 * (W.alpha / r) * tBot * tBot);
    return Object.assign({}, W, { al, Lw, r, out, tBot, KE, PE, heat, px: last[6] });
  }

  /* ---- a rolling body on a spring (attached at the axle or at the top), on a floor or an incline ---- */
  function runSpringQ(p, quick) {
    const B = RBQ[p.sbody], k = B.k, m = p.msp2, r = p.rsp2, ks = p.ksp2, mu = p.musp2, gam = p.incl * Math.PI / 180;
    const ha = p.attach === 'top' ? 2 * r : r, gx = -G * Math.sin(gam), N = m * G * Math.cos(gam), I = k * m * r * r;
    const xeq = m * gx * r * r / (ks * ha * ha);             // rolling equilibrium (the spring's natural length at x = 0)
    let x = xeq + p.A0, ph = x / r, v = 0, w = 0, t = 0, heat = 0, slipAny = false;
    const out = [], dt = 0.0004, tMax = quick ? 8 : 8, ups = [];
    let prev = x - xeq;
    while (t < tMax) {
      const Fs = -ks * (x + (ha - r) * ph);
      // applied force along x at the CM: Fs + m gx; the spring's extra torque when attached above the axle is
      // handled by writing the rolling-friction requirement for this case, then the same stick/slip test
      let a, al, F, slip;
      if (k === 0) { F = 0; a = (Fs + m * gx) / m; al = 0; slip = false; }
      else {
        const Freq = k / (1 + k) * (Fs * ((ha - r) / (k * r) - 1) - m * gx), u = v - w * r;
        if (Math.abs(u) < 1e-7 && Math.abs(Freq) <= mu * N) { F = Freq; slip = false; }
        else { const s = Math.abs(u) >= 1e-7 ? -Math.sign(u) : Math.sign(Freq); F = s * mu * N; slip = true; slipAny = true; heat += Math.abs(F * u) * dt; }
        a = (Fs + F + m * gx) / m; al = (Fs * (ha - r) - F * r) / I;
      }
      if (!quick && every(t, dt, 0.004))
        out.push([t, x, v, ph, w, F, slip, 0.5 * m * v * v, 0.5 * I * w * w, 0.5 * ks * Math.pow(x + (ha - r) * ph, 2), -m * gx * x, heat]);
      let v2 = v + a * dt, w2 = w + al * dt;
      if (slip && k > 0 && Math.sign(v2 - w2 * r) !== Math.sign(v - w * r) && Math.abs(v - w * r) > 1e-7) { const vr = (v2 + k * w2 * r) / (1 + k); v2 = vr; w2 = vr / r; }
      v = v2; w = w2; x += v * dt; ph += w * dt;
      const d = x - xeq; if (prev < 0 && d >= 0) ups.push(t); prev = d; t += dt;
    }
    let T = NaN; if (ups.length >= 2) T = (ups[ups.length - 1] - ups[0]) / (ups.length - 1);
    const Tf = TAU * Math.sqrt(m * (1 + k) / (ks * (ha / r) * (ha / r)));
    // the largest amplitude friction can hold without slipping (rolling SHM: the friction peaks at the turning points)
    // rolling friction at displacement d from equilibrium: F0 (the part that holds it at equilibrium) + F1·d
    const c1 = k > 0 ? (ha - r) / (k * r) - 1 : 0, F0 = k > 0 ? k / (1 + k) * (-ks * xeq * (ha / r) * c1 - m * gx) : 0, F1 = k > 0 ? Math.abs(k / (1 + k) * ks * (ha / r) * c1) : 0;
    const Amax = k === 0 ? Infinity : F1 < 1e-12 ? (Math.abs(F0) <= mu * N ? Infinity : 0) : Math.max(0, (mu * N - Math.abs(F0)) / F1);
    return { B, k, m, r, ks, ha, gam, xeq, F0, F1, out, T, Tf, Tbare: TAU * Math.sqrt(m / ks), heat, slipAny, Amax, tEnd: tMax, mu, N, I };
  }
  const B3 = window.BENCH;

  /* a ball (or cylinder, ring, block) at c, turned by angle a about the axis along y, radius r */
  function body25(F, kind, c, r, a, col) {
    if (kind === 'block') { R3.box(F, c, [r * 1.8, r * 1.6, r * 1.8], '#8A93A3', { shadow: false }); return; }
    if (kind === 'cylinder' || kind === 'ring') {
      R3.cylinder(F, [c[0], c[1] - r * 0.7, c[2]], [c[0], c[1] + r * 0.7, c[2]], r, kind === 'ring' ? '#D6DCE6' : '#C9824A',
                  { segments: 30, spokes: kind === 'ring' ? 0 : 4, phase: a, inner: kind === 'ring' ? r * 0.8 : 0, shadow: false });
      if (kind === 'ring') R3.sphere(F, [c[0] + r * 0.9 * Math.sin(a), c[1] - r * 0.72, c[2] + r * 0.9 * Math.cos(a)], r * 0.1, '#FF6B5A', { shadow: false, vivid: true });
      return;
    }
    R3.sphere(F, c, r, col || (kind === 'shell' ? '#7FC8A8' : '#3A5FA8'), { shadow: false, rim: 0.7 });
    // a painted great circle in the x–z plane, turned by the body's own angle (right-handed about +y: top goes to +x)
    const band = []; for (let k = 0; k <= 36; k++) { const t = k / 36 * TAU, d = [Math.cos(t), 0.0, Math.sin(t)]; const x = d[0] * Math.cos(a) + d[2] * Math.sin(a), z = -d[0] * Math.sin(a) + d[2] * Math.cos(a);
      band.push([c[0] + x * r * 1.01, c[1] - r * 0.02, c[2] + z * r * 1.01]); }
    path3(F, band, '#FFD36B', { alpha: 0.95, width: 2, chunk: 3 });
  }
  // a strip of track under a list of contact points (x, z) with the surface normal n, from y0 to y1, shaded as a solid ribbon
  function ribbon(F, pts, y0, y1, col, o) {
    o = o || {};
    for (let i = 0; i < pts.length - 1; i++) {
      const a = pts[i], b = pts[i + 1], ya = a[2] == null ? 0 : a[2], yb = b[2] == null ? 0 : b[2];
      const nx = -(b[1] - a[1]), nz = b[0] - a[0], nl = Math.hypot(nx, nz) || 1;
      const shade = F.shade(col, [nx / nl, 0, nz / nl], { ambient: 0.45 });
      flatPoly(F, [[a[0], ya + y0, a[1]], [b[0], yb + y0, b[1]], [b[0], yb + y1, b[1]], [a[0], ya + y1, a[1]]], shade, { bias: o.bias || 0 });
    }
    [y0, y1].forEach(yy => path3(F, pts.map(q => [q[0], (q[2] || 0) + yy, q[1]]), o.rail || '#C9D6EE', { alpha: 0.85, width: 1.6, chunk: 4 }));
  }

  /* ======================= 25.1 · the vertical loop ======================= */
  function drawLoop(S, g) {
    const ctx = g.ctx, th = g.theme, p = S.p, cam = S.cam, Lp = S.Lp, P = Lp.P;
    const F = R3.Frame(ctx, cam, { ambient: 0.36, floorZ: 0 });
    const tt = S.ts % (Lp.tEnd + 1.5), i = Math.min(Lp.out.length - 1, Math.round(tt / 0.004)), o = Lp.out[Math.max(0, i)];
    const hw = 0.09, lane = s => s < P.sLoop ? 0 : s < P.sLoop + P.segs[3].L ? -0.24 * (s - P.sLoop) / P.segs[3].L : -0.24;
    // the track, as the surface under the centre's path: contact = centre − r n̂ ; the loop drifts sideways so the exit clears the entry
    const pts = []; for (let s = 0; s <= P.len; s += 0.02) { const q = P.at(s); pts.push([q.x + P.r * Math.sin(q.psi), q.z - P.r * Math.cos(q.psi), lane(s)]); }
    R3.plane(F, [pts[0][0] - 0.3, -0.7, 0], [P.len * 0.95 + 0.6, 0, 0], [0, 1.2, 0], '#232B3A', { grid: 14, gridAlpha: 0.12, bias: F.GROUND });
    ribbon(F, pts, -hw, hw, '#5A6C94', { rail: '#DCE6F8' });
    // supports under the ramp and the loop
    [0.15, 0.45, 0.75].forEach(f => { const q = pts[Math.round(f * (Math.round(P.segs[0].L / 0.02)))] || pts[0]; if (q[1] > 0.05) R3.box(F, [q[0], q[2], q[1] / 2], [0.04, 0.04, q[1]], '#39414F', { shadow: false }); });
    R3.box(F, [0, -0.12, P.R], [0.05, 0.05, 2 * P.R], '#39414F', { shadow: false });
    // the ball; its spin angle is the integral of ω
    const ang = S.spin[Math.max(0, i)] || 0, lanNow = o[8] === 'c' ? lane(o[10]) : -0.12;
    const c = [o[1], lanNow, o[2]];
    body25(F, p.lbody, c, P.r, ang);
    // forces while on the track: N along n̂ (from the contact to the centre), mg down; the velocity
    if (o[8] === 'c') {
      const ps = o[9], nh = [-Math.sin(ps), 0, Math.cos(ps)], cp = V.add(c, V.mul(nh, -P.r)), sc = 0.16;
      if (o[5] > 0.01) R3.arrow(F, cp, V.add(cp, V.mul(nh, o[5] * sc)), 0.008, '#8FA3C0', { vivid: true });
      R3.arrow(F, c, V.add(c, [0, 0, -sc]), 0.008, '#7CF0B0', { vivid: true });
      const tv = [Math.cos(ps), 0, Math.sin(ps)]; R3.arrow(F, c, V.add(c, V.mul(tv, o[3] * 0.06)), 0.008, '#7FD0FF', {});
      R3.label(F, V.add(cp, V.mul(nh, o[5] * sc + 0.07)), 'N = ' + o[5].toFixed(2) + ' mg', '#AFC2E6', { size: 9.5 });
      if (o[7]) R3.label(F, V.add(c, [0, 0, -P.r - 0.07]), 'SLIPPING', '#FF8FB0', { size: 9 });
    }
    // after it leaves: the parabola it flies on
    if (isFinite(Lp.tDet)) {
      const fl = Lp.out.filter(q => q[8] === 'f').map(q => [q[1], -0.12, q[2]]);
      if (fl.length > 1) path3(F, fl, '#FF8A7A', { alpha: 0.8, width: 1.6, dash: [4, 3], chunk: 3 });
      const qd = P.at(P.sLoop + Lp.psiDet * P.rho);
      R3.label(F, [qd.x, -0.12, qd.z + 0.12], 'N = 0: leaves the track (' + (Lp.psiDet * 180 / Math.PI).toFixed(1) + '°)', '#FF8A7A', { size: 9.5 });
    }
    R3.label(F, [0, -0.12, 2 * P.R + 0.1], Lp.madeIt ? 'top: N = ' + (isFinite(Lp.NTop) ? Lp.NTop.toFixed(3) : '—') + ' mg' : 'top', '#DCE3EE', { size: 9.5 });
    const top0 = P.at(0); R3.arrow(F, [top0.x - 0.12, 0, P.r], [top0.x - 0.12, 0, top0.z], 0.006, '#FFD36B', {}); R3.label(F, [top0.x - 0.18, 0, (top0.z + P.r) / 2], 'h = ' + p.hrel.toFixed(3) + ' m', '#FFD36B', { size: 9.5, align: 'right' });
    F.render();
    header(g, 'A ' + Lp.B.name + ' from h = ' + p.hrel.toFixed(3) + ' m, loop R = ' + P.R.toFixed(2) + ' m · ' + (Lp.madeIt ? 'it gets round' : 'it falls off'),
      't = ' + o[0].toFixed(2) + ' s · ' + (o[8] === 'c' ? 'v = ' + o[3].toFixed(2) + ' m/s · N = ' + o[5].toFixed(3) + ' mg' + (o[7] ? ' · slipping' : ' · rolling') : 'in free flight — a projectile, still spinning'),
      'N = m(v²/ρ + g cos ψ) at every point · friction is found each step and tested against μN · ρ = R − r for the centre', th.text);
    panel(g, 'THE LEAST HEIGHT, TWO WAYS', [
      ['h needed, formula (5 + k)(R − r)/2', Lp.hMin.toFixed(4) + ' m', th.ok],
      ['h needed, found by running the bench', S.hBench.toFixed(4) + ' m', th.phys],
      ['your h', p.hrel.toFixed(4) + ' m', Lp.madeIt ? th.ok : '#FF8FB0'],
      ['N at the top', Lp.madeIt && isFinite(Lp.NTop) ? Lp.NTop.toFixed(3) + ' mg' : '—'],
      ['leaves the track at', isFinite(Lp.psiDet) ? (Lp.psiDet * 180 / Math.PI).toFixed(2) + '° from the bottom' : '—'],
      ['slips anywhere?', Lp.slipAny ? 'yes — heat ' + (Lp.heat * 1000).toFixed(2) + ' mJ' : 'no', Lp.slipAny ? '#FF8FB0' : th.ok]
    ]);
  }

  /* ======================= 25.2 · the ball in a bowl ======================= */
  function drawBowlQ(S, g) {
    const ctx = g.ctx, th = g.theme, p = S.p, cam = S.cam, Bq = S.Bq;
    const F = R3.Frame(ctx, cam, { ambient: 0.36, floorZ: 0 });
    const tt = S.ts % Bq.tEnd, i = Math.min(Bq.out.length - 1, Math.round(tt / 0.004)), o = Bq.out[i];
    const R = Bq.R, C = [0, 0, R];
    R3.plane(F, [-1.2, -0.9, 0], [2.4, 0, 0], [0, 1.8, 0], '#232B3A', { grid: 12, gridAlpha: 0.12, bias: F.GROUND });
    // the bowl: the far half as a shaded surface, the near half as a wire cage
    const nLat = 9, nLon = 24;
    for (let a = 0; a < nLat; a++) for (let b = 0; b < nLon; b++) {
      const t0 = Math.PI / 2 * a / nLat, t1 = Math.PI / 2 * (a + 1) / nLat, p0 = Math.PI * b / nLon, p1 = Math.PI * (b + 1) / nLon;
      const P = (t, ph) => [C[0] + R * Math.sin(t) * Math.cos(ph), C[1] + R * Math.sin(t) * Math.sin(ph), C[2] - R * Math.cos(t)];
      const q = [P(t0, p0), P(t1, p0), P(t1, p1), P(t0, p1)], mid = P((t0 + t1) / 2, (p0 + p1) / 2), nrm = V.norm(V.sub(C, mid));
      flatPoly(F, q, F.shade('#6E7FA6', nrm, { ambient: 0.5 }), { bias: 0.3 });
    }
    for (let a = 1; a <= 4; a++) { const t = Math.PI / 2 * a / 4, ring = []; for (let b = 0; b <= 40; b++) { const ph = Math.PI + Math.PI * b / 40; ring.push([C[0] + R * Math.sin(t) * Math.cos(ph), C[1] + R * Math.sin(t) * Math.sin(ph), C[2] - R * Math.cos(t)]); } path3(F, ring, '#C9D6EE', { alpha: 0.35, width: 1, chunk: 4 }); }
    const rim = []; for (let b = 0; b <= 64; b++) { const ph = TAU * b / 64; rim.push([R * Math.cos(ph), R * Math.sin(ph), R]); } path3(F, rim, '#DCE6F8', { alpha: 0.9, width: 2, chunk: 4 });
    // the ball
    const ph = o[1], rho = Bq.rho, c = [C[0] + rho * Math.sin(ph), 0, C[2] - rho * Math.cos(ph)];
    body25(F, p.wbody, c, Bq.r, S.spin[i] || 0);
    // the arc it swings through, and its turning points
    const arc = []; const A = p.amp * Math.PI / 180; for (let k = 0; k <= 40; k++) { const a = -A + 2 * A * k / 40; arc.push([C[0] + (R - 0.002) * Math.sin(a), 0, C[2] - (R - 0.002) * Math.cos(a)]); }
    path3(F, arc, '#FFD36B', { alpha: 0.5, width: 1.4, dash: [3, 3], chunk: 3 });
    const nh = [-Math.sin(ph), 0, Math.cos(ph)], cp = V.add(c, V.mul(nh, -Bq.r));
    R3.arrow(F, cp, V.add(cp, V.mul(nh, o[4] * 0.15)), 0.007, '#8FA3C0', { vivid: true });
    F.render();
    header(g, 'A ' + Bq.B.name + ' rocking in a bowl of radius ' + (R * 100).toFixed(0) + ' cm · released ' + p.amp.toFixed(0) + '° from the bottom · μ = ' + p.mubw.toFixed(2),
      't = ' + o[0].toFixed(2) + ' s · θ = ' + (o[1] * 180 / Math.PI).toFixed(2) + '° · ' + (o[6] ? 'SLIPPING' : 'rolling') + ' · N = ' + o[4].toFixed(3) + ' mg',
      'rolling: (1 + k) m(R − r)θ\'\' = −mg sin θ  →  T = 2π√((1 + k)(R − r)/g) — rolling makes it slower than a sliding bead', th.text);
    panel(g, 'THE PERIOD, TIMED', [
      ['period (timed from the motion)', isFinite(Bq.T) ? Bq.T.toFixed(4) + ' s' : '—', th.phys],
      ['2π√((1 + k)(R − r)/g), small swings', Bq.T0.toFixed(4) + ' s', th.ok],
      ['a frictionless bead would take', Bq.Tslide.toFixed(4) + ' s'],
      ['k = I/mr²', Bq.k.toFixed(3)],
      ['heat from slipping', (Bq.heat * 1000).toFixed(2) + ' mJ']
    ]);
  }

  /* ======================= 25.3 · a body on a free wedge ======================= */
  function drawWedge(S, g) {
    const ctx = g.ctx, th = g.theme, p = S.p, cam = S.cam, Wd = S.Wd;
    const F = R3.Frame(ctx, cam, { ambient: 0.36, floorZ: 0 });
    const tt = S.ts % (Wd.tBot + 1.5), i = Math.min(Wd.out.length - 1, Math.round(Math.min(tt, Wd.tBot) / 0.004)), o = Wd.out[i];
    const al = Wd.al, Ls = Wd.Lw + 0.35, H = Ls * Math.sin(al), Bx = Ls * Math.cos(al), X = o[1], hy = 0.3;
    R3.plane(F, [-2.4, -0.8, 0], [4.8, 0, 0], [0, 1.6, 0], '#232B3A', { grid: 16, gridAlpha: 0.14, bias: F.GROUND });
    for (let k = -12; k <= 12; k++) path3(F, [[k * 0.2, -0.8, 0.002], [k * 0.2, -0.72, 0.002]], '#8FA4CE', { alpha: 0.6, width: 1, chunk: 1 });
    // the wedge: a triangular prism, its vertical face at X
    const A0 = [X, -hy, 0], A1 = [X + Bx, -hy, 0], A2 = [X, -hy, H], B0 = [X, hy, 0], B1 = [X + Bx, hy, 0], B2 = [X, hy, H];
    const wc = '#4A5E88';
    flatPoly(F, [A0, A1, A2], F.shade(wc, [0, -1, 0], { ambient: 0.5 }));
    flatPoly(F, [B0, B2, B1], F.shade(wc, [0, 1, 0], { ambient: 0.5 }));
    flatPoly(F, [A1, B1, B2, A2], F.shade('#6A7FAE', [Math.sin(al), 0, Math.cos(al)], { ambient: 0.5 }));
    flatPoly(F, [A0, B0, B2, A2], F.shade(wc, [-1, 0, 0], { ambient: 0.5 }));
    [[A0, A1], [A1, A2], [A2, A0], [B0, B1], [B1, B2], [B2, B0], [A1, B1], [A2, B2]].forEach(e => path3(F, e, '#C9D6EE', { alpha: 0.6, width: 1.2, chunk: 1 }));
    // the body: its contact point runs down the slope from 0.1 m below the top
    const d = [Math.cos(al), 0, -Math.sin(al)], n = [Math.sin(al), 0, Math.cos(al)];
    const cpt = V.add(A2, V.mul(d, 0.1 + o[2])), cq = V.add([cpt[0], 0, cpt[2]], V.mul(n, Wd.r));
    body25(F, p.gbody, cq, Wd.r, o[3]);
    // forces on the body (N, f, mg), and the wedge's own acceleration
    const sc = 0.05;
    R3.arrow(F, cq, V.add(cq, [0, 0, -Wd.m * G * sc]), 0.008, '#7CF0B0', { vivid: true });
    const cp2 = [cpt[0], 0, cpt[2]];
    R3.arrow(F, cp2, V.add(cp2, V.mul(n, Wd.N * sc)), 0.008, '#8FA3C0', { vivid: true });
    if (Wd.f > 1e-6) R3.arrow(F, cp2, V.add(cp2, V.mul(d, -Wd.f * sc)), 0.008, Wd.rolls ? '#FFB347' : '#FF8FB0', { vivid: true });
    R3.label(F, V.add(cp2, V.mul(n, Wd.N * sc + 0.08)), 'N', '#AFC2E6', { size: 10 });
    R3.label(F, V.add(cq, [0.05, 0, -Wd.m * G * sc - 0.05]), 'mg', '#7CF0B0', { size: 10, align: 'left' });
    if (!p.fixW) { const wa = [X + Bx * 0.4, -hy - 0.05, 0.15]; R3.arrow(F, wa, V.add(wa, [Math.sign(Wd.A) * 0.35, 0, 0]), 0.012, '#FFD36B', { vivid: true }); R3.label(F, V.add(wa, [Math.sign(Wd.A) * 0.45, 0, 0.06]), 'A = ' + Math.abs(Wd.A).toFixed(3) + ' m/s²', '#FFD36B', { size: 10 }); }
    // the centre of mass of wedge + body: it moves only vertically (no horizontal external force)
    const xcm = (Wd.m * cq[0] + (p.fixW ? 0 : Wd.M) * (X + Bx / 3)) / (Wd.m + (p.fixW ? 0 : Wd.M));
    if (!p.fixW) { R3.sphere(F, [xcm, -hy - 0.12, 0.02], 0.025, '#FF6B5A', { shadow: false, vivid: true }); R3.label(F, [xcm, -hy - 0.12, -0.08], 'system CM (x fixed)', '#FF8A7A', { size: 9 }); }
    F.render();
    header(g, 'A ' + RBQ[p.gbody].name + ' (' + Wd.m.toFixed(1) + ' kg) on a ' + (p.fixW ? 'fixed' : Wd.M.toFixed(1) + ' kg wedge free to slide') + ' · ' + p.wang.toFixed(0) + '° · μ = ' + p.mugw.toFixed(2),
      't = ' + o[0].toFixed(2) + ' s · ' + (Wd.rolls ? 'rolling on the wedge' : 'SLIPPING on the wedge') + ' · wedge has moved ' + (X * 100).toFixed(1) + ' cm',
      'five unknowns (A, a_rel, α, N, f) from Newton for body and wedge, τ = Iα, and rolling — solved together; the floor is smooth', th.text);
    panel(g, 'SOLVED TOGETHER', [
      ['wedge acceleration A', Wd.A.toFixed(4) + ' m/s²', th.phys],
      ['body, relative to the wedge', Wd.ar.toFixed(4) + ' m/s²', th.phys],
      ['normal force N · friction f', Wd.N.toFixed(3) + ' · ' + Wd.f.toFixed(3) + ' N'],
      ['horizontal momentum (kept)', Wd.px.toExponential(1) + ' kg·m/s', th.ok],
      [Wd.rolls ? 'KE at the bottom · mgΔh' : 'KE + slip heat · mgΔh', (Wd.KE + Wd.heat).toFixed(4) + ' · ' + Wd.PE.toFixed(4) + ' J', th.ok],
      ['time to the bottom', Wd.tBot.toFixed(4) + ' s']
    ]);
  }

  /* ======================= 25.4 · a rolling body on a spring ======================= */
  function drawSpringQ(S, g) {
    const ctx = g.ctx, th = g.theme, p = S.p, cam = S.cam, Sg = S.Sg;
    const F = R3.Frame(ctx, cam, { ambient: 0.36, floorZ: null });
    const tt = S.ts % Sg.tEnd, i = Math.min(Sg.out.length - 1, Math.round(tt / 0.004)), o = Sg.out[i];
    const gm = Sg.gam, W = (x, z, y) => [x * Math.cos(gm) - z * Math.sin(gm), y || 0, x * Math.sin(gm) + z * Math.cos(gm)];
    const x0 = -0.75, ks = 1;                                     // the wall sits 0.75 m behind the natural position
    // the incline (or floor) and the wall
    const q = [W(x0 - 0.1, 0, -0.4), W(1.3, 0, -0.4), W(1.3, 0, 0.4), W(x0 - 0.1, 0, 0.4)];
    flatPoly(F, q, F.shade('#5A6C94', W(0, 1, 0), { ambient: 0.5 }), { bias: F.GROUND });
    for (let k = -8; k <= 12; k++) path3(F, [W(k * 0.1, 0.001, -0.4), W(k * 0.1, 0.001, -0.33)], '#DCE6F8', { alpha: 0.6, width: 1, chunk: 1 });
    R3.label(F, W(0, 0, -0.48), 'x = 0 (natural length)', '#8FA4CE', { size: 9 });
    R3.box(F, W(x0 - 0.05, 0.3), [0.1, 0.8, 0.6], '#39414F', { shadow: false, axes: [W(1, 0, 0), [0, 1, 0], W(0, 1, 0)] });
    if (gm > 0.01) { const base = [W(x0 - 0.1, 0, 0), W(1.3, 0, 0), [W(1.3, 0, 0)[0], 0, W(x0 - 0.1, 0, 0)[2]]]; path3(F, [base[0], base[2], base[1]], '#8FA4CE', { alpha: 0.5, width: 1, chunk: 1, dash: [4, 3] }); }
    // the body at x, the spring from the wall to the axle or to the top of the rim
    const r = Sg.r, x = o[1] * ks, c = W(x, r);
    body25(F, p.sbody, c, r, o[3]);
    const att = W(x, Sg.ha);
    B3.spring(F, W(x0, Sg.ha), att, 0.035, 12, { colour: '#D7DEEA' });
    R3.sphere(F, att, 0.018, '#FFD36B', { shadow: false, vivid: true });
    // friction at the contact
    if (Math.abs(o[5]) > 1e-4) { const cp = W(x, 0.004); R3.arrow(F, cp, V.add(cp, V.mul(W(1, 0, 0), o[5] * 0.12)), 0.008, o[6] ? '#FF8FB0' : '#FFB347', { vivid: true }); }
    R3.label(F, W(x, 2 * r + 0.18), 'x = ' + (o[1] * 100).toFixed(1) + ' cm', '#DCE3EE', { size: 9.5 });
    F.render();
    header(g, 'A ' + Sg.B.name + ' on a spring (k = ' + p.ksp2.toFixed(0) + ' N/m) attached at its ' + (p.attach === 'top' ? 'top' : 'axle') + (gm > 0.01 ? ', on a ' + p.incl.toFixed(0) + '° incline' : ', on a floor'),
      't = ' + o[0].toFixed(2) + ' s · ' + (o[6] ? 'SLIPPING' : 'rolling') + ' · friction ' + o[5].toFixed(3) + ' N (μN = ' + (Sg.mu * Sg.N).toFixed(3) + ' N)',
      p.attach === 'top' ? 'attached at the top the spring stretches 2x for a roll of x: T = 2π√(m(1 + k)/4k_s)' : 'energy ½m(1 + k)ẋ² + ½k_s x² → T = 2π√(m(1 + k)/k_s) — the incline only moves the centre', th.text);
    panel(g, 'THE PERIOD, TIMED', [
      ['period (timed)', isFinite(Sg.T) ? Sg.T.toFixed(4) + ' s' : '—', th.phys],
      ['from energy (rolling)', Sg.Tf.toFixed(4) + ' s', th.ok],
      ['the same mass sliding freely', Sg.Tbare.toFixed(4) + ' s'],
      ['equilibrium position', (Sg.xeq * 100).toFixed(2) + ' cm'],
      ['largest amplitude that still rolls', isFinite(Sg.Amax) ? (Sg.Amax * 100).toFixed(2) + ' cm' : 'any', p.A0 > Sg.Amax ? '#FF8FB0' : th.ok],
      ['heat from slipping', (Sg.heat * 1000).toFixed(2) + ' mJ']
    ]);
  }

  const LOOPM = S => S.p.mode === 'loop', BOWLM = S => S.p.mode === 'bowl', WEDGM = S => S.p.mode === 'wedge', SPRM = S => S.p.mode === 'spring';
  const bodyOpts = Object.keys(RBQ).map(k2 => ({ value: k2, label: RBQ[k2].name[0].toUpperCase() + RBQ[k2].name.slice(1) }));
  // the body's own spin angle, the running integral of ω over the recorded samples
  function spinOf(out, iW, dtS) { const a = []; let s = 0; out.forEach((q, j) => { if (j) s += (q[iW] || 0) * (q[0] - out[j - 1][0]); a.push(s); }); void dtS; return a; }

  L.register({
    id: 'rollcurve', subject: 'physics',
    name: 'Rolling on Curves, Wedges and Springs — the Loop, the Bowl, the Free Wedge, the Rolling Oscillator',
    chapter: 'System of Particles & Rotational Motion',
    exams: ['JEE Main', 'JEE Advanced'],
    weight: 'JEE Advanced favourite',
    is3D: true,
    stageHint: 'Drag to orbit · one contact model: friction is solved each step, tested against μN, and N comes from the curvature',
    lede: 'Rolling where the ground <b>curves or moves</b>. A ball released into a <b>vertical loop</b> needs h = (5 + k)(R − r)/2 — ' +
      'the bench finds that height by running, and shows where N reaches zero and the ball <b>falls off</b>. A ball rocking in a <b>bowl</b> ' +
      'is timed against 2π√((1 + k)(R − r)/g). A body rolls down a <b>wedge that slides back</b> on a smooth floor, with five unknowns solved ' +
      'together. A rolling body on a <b>spring</b> — at its axle or its top, on a floor or an incline — oscillates, and slips if pushed too far.',

    params: { mode: 'loop', lbody: 'sphere', mlp: 0.2, rbl: 0.05, Rlp: 0.5, beta: 40, hrel: 1.30, mulp: 0.6,
              wbody: 'sphere', rbw: 0.05, Rbw: 0.5, amp: 20, mubw: 0.6,
              gbody: 'cylinder', mgb: 1, Mwg: 2, fixW: false, mugw: 0.6, wang: 30, Lwg: 1, rgb: 0.1,
              sbody: 'cylinder', msp2: 1, rsp2: 0.1, ksp2: 20, musp2: 0.6, incl: 0, attach: 'axle', A0: 0.12, run: true },

    presets: [
      { name: 'Loop · a sphere just makes it', params: { mode: 'loop', lbody: 'sphere', hrel: 1.30, Rlp: 0.5, rbl: 0.05, mulp: 0.6 } },
      { name: 'Loop · too low: it falls off', params: { mode: 'loop', lbody: 'sphere', hrel: 1.0, Rlp: 0.5, rbl: 0.05, mulp: 0.6 } },
      { name: 'Loop · a ring needs more height', params: { mode: 'loop', lbody: 'ring', hrel: 1.30, Rlp: 0.5, rbl: 0.05, mulp: 0.6 } },
      { name: 'Loop · a frictionless block needs 2.5(R − r)', params: { mode: 'loop', lbody: 'block', hrel: 1.13, Rlp: 0.5, rbl: 0.05, mulp: 0.6 } },
      { name: 'Bowl · a sphere rocking', params: { mode: 'bowl', wbody: 'sphere', amp: 20, mubw: 0.6 } },
      { name: 'Bowl · wide swing, slippery: it skids', params: { mode: 'bowl', wbody: 'ring', amp: 70, mubw: 0.15 } },
      { name: 'Wedge · a cylinder on a free wedge', params: { mode: 'wedge', gbody: 'cylinder', mgb: 1, Mwg: 2, fixW: false, wang: 30, mugw: 0.6 } },
      { name: 'Wedge · a smooth block (no rolling)', params: { mode: 'wedge', gbody: 'block', mgb: 1, Mwg: 2, fixW: false, wang: 30 } },
      { name: 'Wedge · steep and slippery: it slips', params: { mode: 'wedge', gbody: 'ring', mgb: 1, Mwg: 1, fixW: false, wang: 55, mugw: 0.2 } },
      { name: 'Spring at the axle', params: { mode: 'spring', sbody: 'cylinder', attach: 'axle', incl: 0, ksp2: 20, A0: 0.12, musp2: 0.6 } },
      { name: 'Spring at the top: twice as fast', params: { mode: 'spring', sbody: 'cylinder', attach: 'top', incl: 0, ksp2: 20, A0: 0.12, musp2: 0.6 } },
      { name: 'On an incline: same period', params: { mode: 'spring', sbody: 'cylinder', attach: 'axle', incl: 20, ksp2: 20, A0: 0.12, musp2: 0.6 } },
      { name: 'Pulled too far on a slippery floor', params: { mode: 'spring', sbody: 'cylinder', attach: 'axle', incl: 0, ksp2: 20, A0: 0.3, musp2: 0.12 } }
    ],

    controls: [
      { group: 'Bench', items: [
        { key: 'mode', type: 'select', label: 'Experiment', restructure: true, rebuild: true, options: [
          { value: 'loop', label: 'The vertical loop' }, { value: 'bowl', label: 'A ball in a bowl' }, { value: 'wedge', label: 'On a free wedge' }, { value: 'spring', label: 'A rolling body on a spring' }] }
      ] },
      { group: 'The loop', items: [
        { key: 'lbody', type: 'select', label: 'Body', restructure: true, when: LOOPM, options: bodyOpts },
        { key: 'hrel', label: 'Release height h (centre drop)', min: 0.5, max: 2.4, step: 0.005, unit: 'm', when: LOOPM, fmt: v => v.toFixed(3), restructure: true },
        { key: 'Rlp', label: 'Loop radius R', min: 0.25, max: 0.6, step: 0.01, unit: 'm', when: LOOPM, fmt: v => v.toFixed(2), restructure: true },
        { key: 'rbl', label: 'Ball radius r', min: 0.01, max: 0.12, step: 0.005, unit: 'm', when: LOOPM, fmt: v => v.toFixed(3), restructure: true },
        { key: 'mulp', label: 'Friction μ', min: 0.05, max: 5, step: 0.05, unit: '', when: LOOPM, fmt: v => v.toFixed(2), restructure: true },
        { key: 'beta', label: 'Ramp angle', min: 20, max: 60, step: 1, unit: '°', when: LOOPM, fmt: v => v.toFixed(0), restructure: true }
      ] },
      { group: 'The bowl', items: [
        { key: 'wbody', type: 'select', label: 'Body', restructure: true, when: BOWLM, options: bodyOpts },
        { key: 'amp', label: 'Released at', min: 2, max: 85, step: 1, unit: '°', when: BOWLM, fmt: v => v.toFixed(0), restructure: true },
        { key: 'Rbw', label: 'Bowl radius R', min: 0.2, max: 1, step: 0.01, unit: 'm', when: BOWLM, fmt: v => v.toFixed(2), restructure: true },
        { key: 'rbw', label: 'Ball radius r', min: 0.01, max: 0.15, step: 0.005, unit: 'm', when: BOWLM, fmt: v => v.toFixed(3), restructure: true },
        { key: 'mubw', label: 'Friction μ', min: 0, max: 1, step: 0.01, unit: '', when: BOWLM, fmt: v => v.toFixed(2), restructure: true }
      ] },
      { group: 'The wedge', items: [
        { key: 'gbody', type: 'select', label: 'Body', restructure: true, when: WEDGM, options: bodyOpts },
        { key: 'wang', label: 'Wedge angle', min: 10, max: 70, step: 1, unit: '°', when: WEDGM, fmt: v => v.toFixed(0), restructure: true },
        { key: 'Mwg', label: 'Wedge mass M', min: 0.2, max: 10, step: 0.1, unit: 'kg', when: WEDGM, fmt: v => v.toFixed(1), restructure: true },
        { key: 'mgb', label: 'Body mass m', min: 0.2, max: 5, step: 0.1, unit: 'kg', when: WEDGM, fmt: v => v.toFixed(1), restructure: true },
        { key: 'mugw', label: 'Friction μ (body–wedge)', min: 0.02, max: 1, step: 0.01, unit: '', when: WEDGM, fmt: v => v.toFixed(2), restructure: true },
        { key: 'fixW', type: 'toggle', label: 'Clamp the wedge', when: WEDGM, restructure: true }
      ] },
      { group: 'The spring', items: [
        { key: 'sbody', type: 'select', label: 'Body', restructure: true, when: SPRM, options: bodyOpts },
        { key: 'attach', type: 'select', label: 'Spring attached at', restructure: true, when: SPRM, options: [{ value: 'axle', label: 'The axle' }, { value: 'top', label: 'The top of the rim' }] },
        { key: 'ksp2', label: 'Spring constant', min: 2, max: 100, step: 1, unit: 'N/m', when: SPRM, fmt: v => v.toFixed(0), restructure: true },
        { key: 'A0', label: 'Pulled out by', min: 0.01, max: 0.35, step: 0.005, unit: 'm', when: SPRM, fmt: v => v.toFixed(3), restructure: true },
        { key: 'incl', label: 'Incline', min: 0, max: 40, step: 1, unit: '°', when: SPRM, fmt: v => v.toFixed(0), restructure: true },
        { key: 'musp2', label: 'Friction μ', min: 0.02, max: 1, step: 0.01, unit: '', when: SPRM, fmt: v => v.toFixed(2), restructure: true },
        { key: 'msp2', label: 'Mass', min: 0.2, max: 5, step: 0.1, unit: 'kg', when: SPRM, fmt: v => v.toFixed(1), restructure: true }
      ] },
      { group: 'Display', items: [
        { key: 'run', type: 'toggle', label: 'Let it run' }
      ] }
    ],

    setup(S) {
      const p = S.p;
      if (p.mode === 'loop') { S.Lp = runLoop(p); S.spin = spinOf(S.Lp.out, 4); S.hBench = loopHmin(p); }
      else if (p.mode === 'bowl') {
        S.Bq = runBowlQ(p); S.spin = spinOf(S.Bq.out, 3);
        S.bowlCurve = [5, 15, 25, 35, 45, 55, 65, 75, 85].map(a => [a, runBowlQ(Object.assign({}, p, { amp: a }), true).T]);
      }
      else if (p.mode === 'wedge') S.Wd = runWedge(p);
      else { S.Sg = runSpringQ(p); }
      S.ts = 0;
      const views = {
        loop: { theta: -1.5, phi: 0.2, dist: 4.1, target: [-0.55, 0, 0.6] },
        bowl: { theta: -1.57, phi: 0.5, dist: 1.75, target: [0, 0, 0.25] },
        wedge: { theta: -1.4, phi: 0.3, dist: 3.4, target: [0.3, 0, 0.4] },
        spring: { theta: -1.4, phi: 0.3, dist: 2.1, target: [-0.1, 0, 0.2] }
      };
      if (!S.cam || S._view !== p.mode) { S.cam = Camera(views[p.mode]); S.cam.minDist = 0.8; S.cam.maxDist = 14; S._view = p.mode; S._narrowCam = false; }
    },

    step(S, dt) { if (S.p.run) S.ts += dt; },

    drawStage(S, g) {
      if (g.w < 660 && !S._narrowCam) { S.cam.dist *= 1.3; S._narrowCam = true; }
      const md = S.p.mode;
      if (md === 'loop') drawLoop(S, g); else if (md === 'bowl') drawBowlQ(S, g); else if (md === 'wedge') drawWedge(S, g); else drawSpringQ(S, g);
    },

    plots: [
      { title: S => ({ loop: 'Normal force and friction along the run', bowl: 'The angle against time — timed, and the small-swing formula', wedge: 'Accelerations against the wedge\'s mass', spring: 'Displacement from equilibrium against time' })[S.p.mode],
        draw(S, g) {
          const p = S.p, th = g.theme, cy = '#3DD6F5', gr = '#7CF0B0', am = '#F5B451', pk = '#FF8FB0';
          if (p.mode === 'loop') {
            const Lp = S.Lp, on = Lp.out.filter(q => q[8] === 'c'), tE = Lp.out.length ? Lp.out[Lp.out.length - 1][0] : 1;
            const hi = Math.max(2, ...on.map(q => q[5])) * 1.05;
            const P = g.Plot({ xmin: 0, xmax: tE, ymin: -0.3, ymax: hi, xlabel: 't (s)', ylabel: 'N ÷ mg  ·  |f| ÷ μN', xfmt: v => v.toFixed(1), yfmt: v => v.toFixed(1) }).frame();
            P.clip(() => { P.hline(0, g.alpha(th['text-3'], .7)); P.hline(1, g.alpha(am, .5), [2, 4]);
              P.line(on.map(q => [q[0], q[5]]), cy, 2.2); P.line(on.map(q => [q[0], Math.min(hi, q[5] > 1e-6 ? Math.abs(q[6]) / (Lp.mu * q[5] * Lp.m * G) : 0)]), am, 1.6, [5, 3]);
              on.forEach(q => { if (q[7]) P.dot(q[0], q[5], 1.8, pk); }); if (isFinite(Lp.tDet)) P.vline(Lp.tDet, g.alpha(pk, .8), [3, 3]); });
            P.tag(tE * 0.02, hi * 0.92, 'blue: N/mg · amber dashed: friction needed ÷ μN (above 1 it slips; pink dots = slipping)', th['text-2'], 'left', 0);
            if (isFinite(Lp.tDet)) P.tag(Lp.tDet, hi * 0.6, 'N = 0: leaves', pk, 'left', 0);
            return;
          }
          if (p.mode === 'bowl') {
            const Bq = S.Bq, A = p.amp, pts = Bq.out.map(q => [q[0], q[1] * 180 / Math.PI]), sm = []; for (let t = 0; t <= Bq.tEnd; t += 0.02) sm.push([t, A * Math.cos(TAU * t / Bq.T0)]);
            const P = g.Plot({ xmin: 0, xmax: Math.min(Bq.tEnd, 4 * Bq.T0), ymin: -A * 1.15, ymax: A * 1.15, xlabel: 't (s)', ylabel: 'θ (°)', xfmt: v => v.toFixed(1), yfmt: v => v.toFixed(0) }).frame();
            P.clip(() => { P.hline(0, g.alpha(th['text-3'], .6)); P.line(sm, g.alpha(am, .8), 1.4, [5, 3]); P.line(pts, cy, 2.2); Bq.out.forEach(q => { if (q[6]) P.dot(q[0], q[1] * 180 / Math.PI, 1.5, pk); }); P.vline(S.ts % Bq.tEnd, g.alpha(gr, .6), [3, 3]); });
            P.tag(Math.min(Bq.tEnd, 4 * Bq.T0) * 0.98, A * 1.05, 'blue: the run · amber: A cos(2πt/T₀) with the small-swing T₀', th['text-2'], 'right', 0);
            return;
          }
          if (p.mode === 'wedge') {
            const Wd = S.Wd, al = Wd.al, As = [], ar = []; for (let M = 0.2; M <= 10.001; M += 0.1) { const w = wedgeAcc(Object.assign({}, p, { Mwg: M, fixW: false }), al); As.push([M / Wd.m, -w.A]); ar.push([M / Wd.m, w.ar]); }
            const hi = Math.max(...ar.map(q => q[1]), ...As.map(q => q[1])) * 1.1;
            const P = g.Plot({ xmin: 0, xmax: 10 / Wd.m, ymin: 0, ymax: hi, xlabel: 'wedge mass ÷ body mass', ylabel: 'm/s²', xfmt: v => v.toFixed(1), yfmt: v => v.toFixed(1) }).frame();
            const fixed = G * Math.sin(al) / (1 + Wd.k);
            P.clip(() => { P.hline(fixed, g.alpha(th['text-3'], .7), [4, 3]); P.line(As, am, 2.2); P.line(ar, cy, 2.2); if (!p.fixW) { P.dot(Wd.M / Wd.m, -Wd.A, 5, am, th['ink-950']); P.dot(Wd.M / Wd.m, Wd.ar, 5, cy, th['ink-950']); } });
            P.tag(10 / Wd.m * 0.98, fixed, 'clamped wedge: g sin α/(1 + k)', th['text-3'], 'right', -8);
            P.tag(10 / Wd.m * 0.98, As[As.length - 1][1], 'wedge (backward)', am, 'right', -8); P.tag(0.3, ar[3][1], 'body, relative to the wedge', cy, 'left', -10);
            return;
          }
          const Sg = S.Sg, pts = Sg.out.map(q => [q[0], (q[1] - Sg.xeq) * 100]), A = Math.max(...pts.map(q => Math.abs(q[1]))) * 1.15 + 0.1, sm = [];
          for (let t = 0; t <= Sg.tEnd; t += 0.02) sm.push([t, p.A0 * 100 * Math.cos(TAU * t / Sg.Tf)]);
          const P = g.Plot({ xmin: 0, xmax: Sg.tEnd, ymin: -A, ymax: A, xlabel: 't (s)', ylabel: 'x − x_eq (cm)', xfmt: v => v.toFixed(1), yfmt: v => v.toFixed(0) }).frame();
          P.clip(() => { P.hline(0, g.alpha(th['text-3'], .6)); P.line(sm, g.alpha(am, .8), 1.4, [5, 3]); P.line(pts, cy, 2.2); Sg.out.forEach(q => { if (q[6]) P.dot(q[0], (q[1] - Sg.xeq) * 100, 1.5, pk); }); P.vline(S.ts % Sg.tEnd, g.alpha(gr, .6), [3, 3]); });
          P.tag(Sg.tEnd * 0.98, A * 0.9, 'blue: the run · amber: rolling SHM from energy' + (Sg.slipAny ? ' · pink: slipping' : ''), th['text-2'], 'right', 0);
        } },
      { title: S => ({ loop: 'The height needed, for each body (k = I/mr²)', bowl: 'Period against the release angle', wedge: 'Positions: wedge, body, and their centre of mass', spring: 'Where the energy is' })[S.p.mode],
        draw(S, g) {
          const p = S.p, th = g.theme, cy = '#3DD6F5', gr = '#7CF0B0', am = '#F5B451', pk = '#FF8FB0';
          if (p.mode === 'loop') {
            const rho = p.Rlp - p.rbl, pts = []; for (let k = 0; k <= 1.0001; k += 0.02) pts.push([k, (5 + k) * rho / 2]);
            const P = g.Plot({ xmin: 0, xmax: 1, ymin: 2 * rho, ymax: Math.max(3.2 * rho, p.hrel * 1.05), xlabel: 'k = I/mr²', ylabel: 'h needed (m)', xfmt: v => v.toFixed(1), yfmt: v => v.toFixed(2) }).frame();
            P.clip(() => { P.area(pts, 0, g.alpha(pk, .08)); P.line(pts, gr, 2.2); P.hline(p.hrel, g.alpha(cy, .9), [5, 3]);
              Object.keys(RBQ).forEach(key => { const k = RBQ[key].k; P.dot(k, (5 + k) * rho / 2, key === p.lbody ? 5.5 : 3.5, (5 + k) * rho / 2 <= p.hrel ? gr : pk, th['ink-950']); P.tag(k, (5 + k) * rho / 2, ({ sphere: 'sphere', cylinder: 'cylinder', shell: 'shell', ring: 'ring', block: 'block' })[key], th['text-3'], k > 0.8 ? 'right' : 'left', 12); });
              P.dot(RBQ[p.lbody].k, S.hBench, 3, am); });
            P.tag(0.02, p.hrel, 'your h — green dots make it, pink ones fall off', cy, 'left', -8);
            return;
          }
          if (p.mode === 'bowl') {
            const Bq = S.Bq, c = S.bowlCurve.filter(q => isFinite(q[1]));
            const hi = Math.max(Bq.T0, ...c.map(q => q[1])) * 1.12, lo = Math.min(Bq.Tslide, ...c.map(q => q[1])) * 0.9;
            const P = g.Plot({ xmin: 0, xmax: 90, ymin: lo, ymax: hi, xlabel: 'released at (°)', ylabel: 'period (s)', xfmt: v => v.toFixed(0), yfmt: v => v.toFixed(2) }).frame();
            P.clip(() => { P.hline(Bq.T0, g.alpha(gr, .8), [5, 3]); P.hline(Bq.Tslide, g.alpha(th['text-3'], .7), [2, 4]); P.line(c, cy, 2.2); c.forEach(q => P.dot(q[0], q[1], 3, cy)); if (isFinite(Bq.T)) P.dot(p.amp, Bq.T, 5.5, am, th['ink-950']); });
            P.tag(2, Bq.T0, 'small swings, rolling: 2π√((1+k)(R−r)/g)', gr, 'left', -8); P.tag(2, Bq.Tslide, 'a frictionless bead', th['text-3'], 'left', 12);
            return;
          }
          if (p.mode === 'wedge') {
            const Wd = S.Wd, al = Wd.al, Bx = (Wd.Lw + 0.35) * Math.cos(al), mW = p.fixW ? 0 : Wd.M;
            const xb = Wd.out.map(q => [q[0], q[1] + (0.1 + q[2]) * Math.cos(al) + Wd.r * Math.sin(al)]), xw = Wd.out.map(q => [q[0], q[1] + Bx / 3]);
            const xc = xb.map((q, j) => [q[0], (Wd.m * q[1] + mW * xw[j][1]) / (Wd.m + mW)]);
            const all = xb.concat(xw).map(q => q[1]), lo = Math.min(...all), hi = Math.max(...all), pad = (hi - lo) * 0.1 + 0.02;
            const P = g.Plot({ xmin: 0, xmax: Wd.tBot, ymin: lo - pad, ymax: hi + pad, xlabel: 't (s)', ylabel: 'x (m)', xfmt: v => v.toFixed(2), yfmt: v => v.toFixed(2) }).frame();
            P.clip(() => { P.line(xw, am, 2.2); P.line(xb, cy, 2.2); if (!p.fixW) P.line(xc, pk, 2, [6, 3]); });
            P.tag(Wd.tBot * 0.98, xb[xb.length - 1][1], 'body', cy, 'right', -8); P.tag(Wd.tBot * 0.98, xw[xw.length - 1][1], 'wedge (its CM)', am, 'right', 12);
            if (!p.fixW) P.tag(Wd.tBot * 0.5, xc[0][1], 'system CM: flat — no horizontal force on the pair', pk, 'center', -8);
            return;
          }
          const Sg = S.Sg, o = Sg.out, Ug0 = o[0][10];
          const T = o.map(q => [q[0], q[7]]), R = o.map(q => [q[0], q[8]]), U = o.map(q => [q[0], q[9] + q[10] - Ug0]), H = o.map(q => [q[0], q[11]]), Tot = o.map(q => [q[0], q[7] + q[8] + q[9] + q[10] - Ug0 + q[11]]);
          const hi = Math.max(...Tot.map(q => q[1]), ...U.map(q => q[1])) * 1.15, lo = Math.min(0, ...U.map(q => q[1]));
          const P = g.Plot({ xmin: 0, xmax: Sg.tEnd, ymin: lo, ymax: hi, xlabel: 't (s)', ylabel: 'J', xfmt: v => v.toFixed(1), yfmt: v => v.toFixed(2) }).frame();
          P.clip(() => { P.line(U, am, 1.8); P.line(T, cy, 1.8); P.line(R, gr, 1.8); P.line(H, pk, 1.8); P.line(Tot, th.text, 1.4, [5, 3]); });
          P.tag(Sg.tEnd * 0.98, hi * 0.92, 'amber: spring + gravity · blue: translation · green: rotation · pink: heat · dashed: the sum (kept)', th['text-2'], 'right', 0);
        } }
    ],

    readouts(S) {
      const p = S.p;
      if (p.mode === 'loop') { const Lp = S.Lp; return [{ label: 'h needed (formula)', value: Lp.hMin.toFixed(4), unit: 'm', flag: 'accent' }, { label: 'h needed (bench)', value: S.hBench.toFixed(4), unit: 'm' },
        { label: 'Makes it?', value: Lp.madeIt ? 'yes' : 'no', unit: '', flag: Lp.madeIt ? 'ok' : 'crit' }, { label: 'Leaves at', value: isFinite(Lp.psiDet) ? (Lp.psiDet * 180 / Math.PI).toFixed(2) : '—', unit: '°' }]; }
      if (p.mode === 'bowl') { const Bq = S.Bq; return [{ label: 'Period (timed)', value: isFinite(Bq.T) ? Bq.T.toFixed(4) : '—', unit: 's', flag: 'accent' }, { label: 'Small-swing formula', value: Bq.T0.toFixed(4), unit: 's' }, { label: 'Bead would take', value: Bq.Tslide.toFixed(4), unit: 's' }]; }
      if (p.mode === 'wedge') { const Wd = S.Wd; return [{ label: 'Wedge A', value: Wd.A.toFixed(4), unit: 'm/s²', flag: 'accent' }, { label: 'Body, relative', value: Wd.ar.toFixed(4), unit: 'm/s²' }, { label: 'Normal force', value: Wd.N.toFixed(3), unit: 'N' }, { label: 'Rolls?', value: Wd.rolls ? 'yes' : 'slips', unit: '', flag: Wd.rolls ? 'ok' : 'warn' }]; }
      const Sg = S.Sg; return [{ label: 'Period (timed)', value: isFinite(Sg.T) ? Sg.T.toFixed(4) : '—', unit: 's', flag: 'accent' }, { label: 'From energy', value: Sg.Tf.toFixed(4), unit: 's' }, { label: 'Equilibrium', value: (Sg.xeq * 100).toFixed(2), unit: 'cm' }, { label: 'Rolls throughout?', value: Sg.slipAny ? 'no — slips' : 'yes', unit: '', flag: Sg.slipAny ? 'warn' : 'ok' }];
    },

    equation(S) {
      const p = S.p;
      if (p.mode === 'loop') return E.v('h') + E.sub('min') + ' ' + E.op('=') + ' ' + E.frac('(5 ' + E.op('+') + ' ' + E.v('k') + ')(' + E.v('R') + ' ' + E.op('−') + ' ' + E.v('r') + ')', '2') + ' ' + E.op('=') + ' ' + E.n(S.Lp.hMin, 'm') + ' · top: ' + E.v('mg') + ' ' + E.op('+') + ' ' + E.v('N') + ' ' + E.op('=') + ' ' + E.v('mv') + '²/(' + E.v('R') + ' − ' + E.v('r') + ')';
      if (p.mode === 'bowl') return E.v('T') + ' ' + E.op('=') + ' 2π√' + E.frac('(1 ' + E.op('+') + ' ' + E.v('k') + ')(' + E.v('R') + ' ' + E.op('−') + ' ' + E.v('r') + ')', E.v('g')) + ' ' + E.op('=') + ' ' + E.n(S.Bq.T0, 's') + ' · sphere: 2π√(7(R − r)/5g)';
      if (p.mode === 'wedge') return 'body: ' + E.v('m') + '(' + E.v('A') + ' + ' + E.v('a') + ' cos α) = ' + E.v('N') + ' sin α − ' + E.v('f') + ' cos α · wedge: ' + E.v('MA') + ' = −' + E.v('N') + ' sin α + ' + E.v('f') + ' cos α · ' + E.v('f') + ' ' + E.op('=') + ' ' + E.v('kma');
      return E.v('T') + ' ' + E.op('=') + ' 2π√' + E.frac(E.v('m') + '(1 ' + E.op('+') + ' ' + E.v('k') + ')', E.v('k') + E.sub('s') + '(' + E.v('h') + E.sub('a') + '/' + E.v('r') + ')²') + ' ' + E.op('=') + ' ' + E.n(S.Sg.Tf, 's') + ' · axle: ' + E.v('h') + E.sub('a') + ' = ' + E.v('r') + ', top: 2' + E.v('r');
    },

    eqNote: '<b>One contact, four benches.</b> The friction at the contact is an unknown each step: the value rolling needs is computed from the ' +
      'translational and rotational equations, then tested against μN. The normal force comes from the path itself, N = m(κv² + g cos ψ), ' +
      'so on a loop it shrinks as the ball climbs. Near the top N is small, so the friction rolling needs can exceed μN there: the ball ' +
      'slips a little, loses energy, and needs slightly <b>more</b> than the textbook height unless the track is very rough.',

    problems: [
      { source: 'JEE Advanced pattern · the loop',
        q: 'A solid sphere of radius 5.0 cm rolls without slipping on a very rough track (μ = 5) into a vertical loop of radius 50 cm. What is the least height its centre must drop through, from release to the bottom, for it to get round, in m?',
        params: { mode: 'loop', lbody: 'sphere', rbl: 0.05, Rlp: 0.5, mulp: 5, hrel: 1.3 },
        predict: { label: 'h', unit: 'm', tol: 0.01 },
        measure: S => S.hBench,
        working: 'At the top N ≥ 0 needs v² ≥ g(R − r). Energy with rolling: mgh = ½mv²(1 + 2/5) + mg·2(R − r). So h = 2(R − r) + 0.7(R − r) = <b>2.7(R − r) = 1.215 m</b>. The bench finds it by bisection, releasing the ball again and again.' },
      { source: 'JEE Advanced pattern · falling off',
        q: 'The same sphere on the very rough track is released from h = 1.0 m. At what angle from the bottom of the loop does it leave the track, in degrees?',
        params: { mode: 'loop', lbody: 'sphere', rbl: 0.05, Rlp: 0.5, mulp: 5, hrel: 1.0 },
        predict: { label: 'angle', unit: '°', tol: 0.01 },
        measure: S => S.Lp.psiDet * 180 / Math.PI,
        working: 'N = 0 where v² = −gρ cos ψ (ρ = R − r = 0.45 m). Energy: 0.7v² = g(h − ρ + ρ cos ψ). Together: cos ψ = −(h − ρ)/(1.7ρ) = −0.719, so ψ = <b>136.0°</b>, past the side but short of the top.' },
      { source: 'JEE Main pattern · force at the top',
        q: 'Released from h = 1.30 m (very rough track), what is the normal force on the sphere at the top of the loop, as a multiple of mg?',
        params: { mode: 'loop', lbody: 'sphere', rbl: 0.05, Rlp: 0.5, mulp: 5, hrel: 1.3 },
        predict: { label: 'N/mg', unit: '', tol: 0.02 },
        measure: S => S.Lp.NTop,
        working: 'v² = 2g(h − 2ρ)/1.4 = 5.61 m²/s². N/mg = v²/(gρ) − 1 = 5.61/(9.81 × 0.45) − 1 = <b>0.270</b>.' },
      { source: 'JEE Advanced pattern · a ball in a bowl',
        q: 'A solid sphere of radius 5.0 cm rolls without slipping inside a hemispherical bowl of radius 50 cm. Released 5° from the bottom, what is its period, in s?',
        params: { mode: 'bowl', wbody: 'sphere', rbw: 0.05, Rbw: 0.5, amp: 5, mubw: 0.6 },
        predict: { label: 'T', unit: 's', tol: 0.01 },
        measure: S => S.Bq.T,
        working: 'The centre moves on a circle of radius R − r = 0.45 m; energy gives (7/5)m(R − r)θ\'\' = −mgθ. So T = 2π√(7 × 0.45/(5 × 9.81)) = <b>1.59 s</b>. A frictionless bead would take 1.35 s.' },
      { source: 'JEE Advanced pattern · the free wedge',
        q: 'A 1.0 kg solid cylinder rolls without slipping down the face of a 2.0 kg wedge of angle 30°, which rests on a smooth floor. What is the magnitude of the wedge\'s acceleration, in m/s²?',
        params: { mode: 'wedge', gbody: 'cylinder', mgb: 1, Mwg: 2, fixW: false, wang: 30, mugw: 0.6 },
        predict: { label: 'A', unit: 'm/s²', tol: 0.01 },
        measure: S => Math.abs(S.Wd.A),
        working: 'Unknowns A, a (relative), N, f with f = ½ma for a rolling cylinder. Solving the body\'s two equations, the wedge\'s horizontal equation and f = kma gives <b>A = 1.13 m/s²</b> backward, a = 3.92 m/s² down the face. Horizontal momentum stays zero throughout.' },
      { source: 'JEE Main pattern · a smooth block on a free wedge',
        q: 'A smooth 1.0 kg block slides down a 2.0 kg, 30° wedge on a smooth floor. What is the wedge\'s acceleration, in m/s²?',
        params: { mode: 'wedge', gbody: 'block', mgb: 1, Mwg: 2, fixW: false, wang: 30 },
        predict: { label: 'A', unit: 'm/s²', tol: 0.01 },
        measure: S => Math.abs(S.Wd.A),
        working: 'A = mg sin α cos α/(M + m sin²α) = 9.81 × 0.433/2.25 = <b>1.89 m/s²</b>. Rolling makes the wedge recoil less (1.13 m/s²), because part of the body\'s motion goes into spin.' },
      { source: 'JEE Advanced pattern · a rolling oscillator',
        q: 'A 1.0 kg solid cylinder rolls without slipping on a floor, its axle attached to a spring of constant 20 N/m. What is the period of its oscillation, in s?',
        params: { mode: 'spring', sbody: 'cylinder', attach: 'axle', incl: 0, ksp2: 20, msp2: 1, rsp2: 0.1, A0: 0.12, musp2: 0.6 },
        predict: { label: 'T', unit: 's', tol: 0.01 },
        measure: S => S.Sg.T,
        working: 'Energy: ½m(1 + ½)ẋ² + ½kx² is constant, so ω² = k/(1.5m) and T = 2π√(1.5 × 1/20) = <b>1.72 s</b>. That is √1.5 times slower than the same mass sliding freely.' },
      { source: 'JEE Advanced pattern · the spring at the top',
        q: 'The spring is instead attached to the top of the cylinder (by a thread wound over the rim). What is the period now, in s?',
        params: { mode: 'spring', sbody: 'cylinder', attach: 'top', incl: 0, ksp2: 20, msp2: 1, rsp2: 0.1, A0: 0.12, musp2: 0.6 },
        predict: { label: 'T', unit: 's', tol: 0.01 },
        measure: S => S.Sg.T,
        working: 'The top moves twice as far as the centre, so the spring stores ½k(2x)². ω² = 4k/(1.5m), T = 2π√(3m/8k) = <b>0.860 s</b>, half the period of the axle case.' }
    ],

    walkthrough: [
      { title: '1 · Why 2.7R and not 2.5R',
        body: 'A sphere rolls into a loop from just enough height.',
        ask: 'A sliding block needs h = 2.5R. Why does a rolling sphere need more?',
        reveal: '<b>Part of its energy is locked in spin.</b> At the top it needs the same speed, v² = gR, but its kinetic energy is ½mv²(1 + k). The extra 0.2R pays for the rotation.',
        params: { mode: 'loop', lbody: 'sphere', hrel: 1.30, Rlp: 0.5, rbl: 0.05, mulp: 0.6 } },
      { title: '2 · Where it falls off',
        body: 'The same sphere from 1.0 m.',
        ask: 'Does it fall straight down from the point where it loses contact?',
        reveal: '<b>No: it flies off along a parabola.</b> At N = 0 it still has speed along the track. It leaves at about 136°, then its path cuts inside the loop and it lands on the track.',
        params: { mode: 'loop', lbody: 'sphere', hrel: 1.0, Rlp: 0.5, rbl: 0.05, mulp: 0.6 } },
      { title: '3 · The ball in a bowl',
        body: 'A sphere rocking, and a frictionless bead in the same bowl.',
        ask: 'Which has the longer period?',
        reveal: '<b>The rolling sphere.</b> Its inertia is (1 + k)m but the restoring force is still mg sin θ, so T grows by √(1 + k). With no friction it can\'t roll and swings like the bead.',
        params: { mode: 'bowl', wbody: 'sphere', amp: 20, mubw: 0.6 } },
      { title: '4 · The wedge slides back',
        body: 'A cylinder rolls down a wedge that sits on a smooth floor.',
        ask: 'What stays fixed while everything moves?',
        reveal: '<b>The horizontal position of the pair\'s centre of mass.</b> No horizontal external force acts, so the wedge moves back exactly enough to keep it still (the red dot).',
        params: { mode: 'wedge', gbody: 'cylinder', mgb: 1, Mwg: 2, fixW: false, wang: 30, mugw: 0.6 } },
      { title: '5 · The spring at the top',
        body: 'The same cylinder and spring, attached at the axle and then at the top.',
        ask: 'By how much does moving the attachment change the period?',
        reveal: '<b>It halves it.</b> The top of a rolling body moves at 2v, so the spring stretches twice as much and stores four times the energy for the same x.',
        params: { mode: 'spring', sbody: 'cylinder', attach: 'top', incl: 0, ksp2: 20, A0: 0.12, musp2: 0.6 } },
      { title: '6 · Pulled too far',
        body: 'A large amplitude on a slippery floor.',
        ask: 'Where in the swing does it start to slip?',
        reveal: '<b>At the ends</b>, where the spring force (and the friction rolling needs) is greatest. It slides, loses energy to heat, and settles into a smaller swing it can roll through.',
        params: { mode: 'spring', sbody: 'cylinder', attach: 'axle', incl: 0, ksp2: 20, A0: 0.3, musp2: 0.12 } }
    ],

    quiz: [
      { q: 'A solid sphere (radius ≪ R) must roll round a loop of radius R. The least release height is:',
        options: ['2.7R', '2.5R', '2R', '3R'], answer: 0, why: 'h = 2R + (1 + 2/5)R/2 = 2.7R.' },
      { q: 'A ring rolling without slipping needs, compared with a solid sphere:',
        options: ['A greater height', 'A smaller height', 'The same height', 'No height — it rolls anyway'], answer: 0, why: 'k = 1 for a ring: h = 3R. More of its energy goes into spin.' },
      { q: 'A solid sphere of radius r rolls in a bowl of radius R. The period of small oscillations is:',
        options: ['2π√(7(R − r)/5g)', '2π√((R − r)/g)', '2π√(2(R − r)/5g)', '2π√(7R/5g)'], answer: 0, why: '(1 + 2/5) m(R − r)θ\'\' = −mgθ.' },
      { q: 'A body slides down a wedge resting on a smooth floor. The horizontal position of the centre of mass of body + wedge:',
        options: ['Stays fixed', 'Moves toward the body', 'Moves away from the body', 'Falls'], answer: 0, why: 'No horizontal external force, and the system starts at rest.' },
      { q: 'A disc on a spring attached at its axle rolls without slipping. Its period, compared with the same mass sliding, is:',
        options: ['√1.5 times longer', 'The same', 'Half', '1.5 times longer'], answer: 0, why: 'Effective mass m(1 + ½) = 1.5m.' },
      { q: 'The spring on a rolling disc is moved from its axle to its top. The period:',
        options: ['Halves', 'Doubles', 'Is unchanged', 'Falls by √2'], answer: 0, why: 'The top moves 2x: stiffness effectively ×4, period ÷2.' }
    ],

    notes: '<b>Where this shows up in the paper.</b><ul>' +
      '<li><b>Loops</b>: at the top mg + N = mv²/(R − r); energy includes ½Iω²; h = (5 + k)(R − r)/2; the ball leaves where N = 0, then moves as a projectile.</li>' +
      '<li><b>Bowls</b>: the centre moves on a circle of radius R − r; T = 2π√((1 + k)(R − r)/g).</li>' +
      '<li><b>Free wedges</b>: write Newton for body and wedge with N and f as unknowns; add the rolling condition; horizontal momentum is conserved.</li>' +
      '<li><b>Rolling oscillators</b>: the energy method gives the effective mass m(1 + k); attaching at the top multiplies the stiffness by 4; an incline only shifts the equilibrium.</li></ul>' +
      '<div class="pyq"><em>Trap to avoid</em> — using 2.5R for a rolling ball. That is the answer for a body with no rotational energy.</div>' +
      '<div class="pyq"><em>Trap to avoid</em> — taking R rather than R − r as the radius of the centre\'s path, for a ball that is not small.</div>'
  });

  /* =========================================================================
     26 · ROTATIONAL IMPULSE AND CONNECTED BODIES

     · τ = dL/dt, measured: a motor drives a flywheel against axle friction;
       the area under the net torque–time curve is compared with ΔL.
     · A ball strikes a cube on a rough floor. During the impact the floor's
       edge supplies an impulsive normal force and an impulsive friction; if
       the friction needed exceeds μ × (the normal impulse) the edge slides.
       Angular momentum about the edge (stick) or the full impulse equations
       (slip) give the motion just after; then the cube is integrated about
       its edge, with friction tested every step, until it topples, rocks
       back, or slides to rest.
     · An Atwood machine with a pulley that has mass (and axle friction), and
       a block on a table pulled over such a pulley.
     · A string wound on a cylinder rolling on a table, over a pulley to a
       hanging mass, pulled from the top or from the axle.
     · A belt drive: the belt grips while the tension difference it needs is
       below the capstan limit, then slips.
     ========================================================================= */

  /* ---- τ = dL/dt on a flywheel ---- */
  function motorTau(p, t) {
    const T = p.Tdr, a = p.tau0;
    if (p.prof === 'const') return t < T ? a : 0;
    if (p.prof === 'ramp') return t < T ? a * t / T : 0;
    if (p.prof === 'pulse') return t >= 0.5 && t < 0.5 + 0.15 * T ? a : 0;
    return t < T ? a * Math.sin(Math.PI * t / T) : 0;
  }
  function runTorque(p) {
    const I = 0.5 * p.Mfw * p.Rfw * p.Rfw, tf = p.tauF, out = [], dt = 0.001;
    let w = 0, t = 0, Lint = 0, Mint = 0, W = 0, tStop = NaN, prevNet = 0;
    while (t < 14) {
      const tm = motorTau(p, t);
      let fr; if (w > 1e-9) fr = -tf; else fr = -Math.min(tf, Math.max(0, tm));   // static friction when at rest
      const net = tm + fr;
      if (every(t, dt, 0.01)) out.push([t, tm, fr, net, w, I * w, Lint, 0.5 * I * w * w, W, Mint]);
      Lint += net * dt; prevNet = net;
      Mint += tm * dt; W += tm * w * dt;
      w += net / I * dt; if (w < 0) w = 0;
      t += dt;
      if (t > p.Tdr + 0.6 && w <= 1e-9 && isNaN(tStop)) { tStop = t; }
      if (isFinite(tStop) && t > tStop + 0.6) break;
    }
    // the area under the net-torque curve, by the trapezoid rule on the recorded samples — measured off the graph
    let ar = 0; out[0].push(0); for (let j = 1; j < out.length; j++) { ar += 0.5 * (out[j][3] + out[j - 1][3]) * (out[j][0] - out[j - 1][0]); out[j].push(ar); }
    const at = tt => out[Math.min(out.length - 1, Math.max(0, Math.round(tt / 0.01)))];
    const tDrive = p.prof === 'pulse' ? 0.5 + 0.15 * p.Tdr : p.Tdr, oD = at(tDrive);
    return { I, out, at, tEnd: out[out.length - 1][0], tStop, tDrive, wDrive: oD[4], LDrive: oD[5], areaDrive: oD[10], motorImp: oD[9], Wm: oD[8], KE: oD[7] };
  }

  /* ---- a ball strikes a cube: the impact ---- */
  function cubeImpact(p, u) {
    const a = p.acube, M = p.Mcu, m = p.mball, h = p.hhit * a, e = p.ecube, mu = p.mucu;
    const Ie = 2 / 3 * M * a * a, Icm = M * a * a / 6;
    // edge holds: angular momentum about the edge, and restitution at the struck point
    let J = (1 + e) * u / (1 / m + h * h / Ie), w = J * h / Ie, Jz = M * w * a / 2, Jx = M * w * a / 2 - J, vex = 0, stick = Math.abs(Jx) <= mu * Jz + 1e-12;
    if (!stick) {
      // the edge slides forward during the blow: friction impulse −μJz; unknowns J, ω, v_edge, Jz
      const sol = s => solve([[-1, M * a / 2, M, mu * s], [0, M * a / 2, 0, -1], [-(h - a / 2), Icm, 0, (a / 2) * (1 - mu * s)], [1 / m, h, 1, 0]], [0, 0, 0, (1 + e) * u]);
      let s = 1, x = sol(1); if (x[2] < 0) { s = -1; x = sol(-1); }
      J = x[0]; w = x[1]; vex = x[2]; Jz = x[3]; Jx = -mu * s * Jz;
    }
    if (w <= 1e-9) { J = (1 + e) * u / (1 / m + 1 / M); w = 0; vex = J / M; Jz = 0; Jx = 0; stick = false; }   // no tipping at all: it just slides
    return { J, w, vex, Jz, Jx, stick, uBall: u - J / m, Ie, Icm, h, a, M, m, e, mu, hSlip: 4 * a / (3 * (1 + mu)) };
  }
  function runCube(p, uOverride, quick) {
    const u = uOverride == null ? p.uball : uOverride, Im = cubeImpact(p, u), a = Im.a, M = Im.M, mu = Im.mu, Icm = Im.Icm, h2 = a / 2;
    let xe = 0, ve = Im.vex, th = 0, w = Im.w, t = 0, phase = w > 0 ? 'tip' : 'flat', outcome = '', thMax = 0, xFlat = 0, vFlat = w > 0 ? 0 : Im.vex;
    const out = [], dt = 0.0005;
    while (t < 5) {
      if (phase === 'tip') {
        // the cube turning about its front edge: unknowns (edge ẍ, θ̈, N, F); the edge holds or slides by the μN test
        const acc = (th, w, ve) => {
          const s = Math.sin(th), c = Math.cos(th), cx = -h2 * c + h2 * s, cz = h2 * c + h2 * s, dx = h2 * s + h2 * c, dz = -h2 * s + h2 * c, ex = h2 * c - h2 * s, ez = -h2 * c - h2 * s;
          const rows = [[M, M * dx, 0, -1], [0, M * dz, -1, 0], [0, Icm, -cx, cz]], rhs = [-M * ex * w * w, -M * G - M * ez * w * w, 0];
          let x, sliding = Math.abs(ve) > 1e-7;
          if (!sliding) { x = solve(rows.concat([[1, 0, 0, 0]]), rhs.concat([0])); if (Math.abs(x[3]) > mu * x[2]) { sliding = true; const sg = Math.sign(x[3]); x = solve(rows.concat([[0, 0, -mu * sg, 1]]), rhs.concat([0])); } }
          else x = solve(rows.concat([[0, 0, mu * Math.sign(ve), 1]]), rhs.concat([0]));
          return { x, sliding };
        };
        const A0 = acc(th, w, ve), x = A0.x, sliding = A0.sliding;
        if (!quick && every(t, dt, 0.004)) out.push([t, xe, th, w, x[2] / (M * G), x[3], 'tip', ve]);
        // midpoint step
        const Am = acc(th + w * dt / 2, w + x[1] * dt / 2, sliding ? ve + x[0] * dt / 2 : 0).x;
        const ve2 = ve + Am[0] * dt; ve = (sliding && Math.sign(ve2) !== Math.sign(ve) && Math.abs(ve) > 1e-7) ? 0 : (sliding ? ve2 : 0);
        th += (w + Am[1] * dt / 2) * dt; w += Am[1] * dt; xe += ve * dt; thMax = Math.max(thMax, th);
        if (x[2] < 0) { outcome = 'lifts off'; break; }
        if (th >= Math.PI / 2 || (quick && th > Math.PI / 4 + 1e-3 && w > 0)) { outcome = 'topples'; break; }   // past 45° still turning forward: it goes over
        if (quick && phase === 'tip' && w < 0 && th < Math.PI / 4) { outcome = 'rocks back'; break; }
        if (th <= 0 && w < 0) { phase = 'flat'; vFlat = ve + h2 * w; th = 0; w = 0; xFlat = xe - a; }
      } else {
        if (!quick && every(t, dt, 0.004)) out.push([t, xFlat + a, 0, 0, 1, vFlat > 1e-7 ? -mu * M * G : 0, 'flat', vFlat]);
        if (vFlat <= 1e-7) { outcome = outcome || (thMax > 1e-4 ? 'rocks back' : 'slides'); if (t > 0.5) break; }
        const v2 = vFlat - mu * G * dt; vFlat = Math.max(0, v2); xFlat += vFlat * dt;
        if (vFlat === 0 && !outcome) outcome = thMax > 1e-4 ? 'rocks back' : 'slides';
      }
      t += dt;
    }
    if (!outcome) outcome = phase === 'tip' ? 'still rocking' : 'slides';
    return { Im, out, outcome, thMax, tEnd: out.length ? out[out.length - 1][0] : t, u };
  }
  // the least speed that topples it: formula (edge holds) and the bench (bisection on the full run)
  function cubeUmin(p) {
    const a = p.acube, M = p.Mcu, m = p.mball, h = p.hhit * a, e = p.ecube, Ie = 2 / 3 * M * a * a;
    const wmin = Math.sqrt(2 * M * G * (a / Math.SQRT2 - a / 2) / Ie), form = wmin * (Ie / (m * h) + h) / (1 + e);
    // over the top = topples (or is thrown clear of the floor, at far higher speeds)
    let lo = 0.05 * form, hi = 1.6 * form, ok = false;
    for (let i = 0; i < 26; i++) { const mid = (lo + hi) / 2, oc = runCube(p, mid, true).outcome; if (oc === 'topples' || oc === 'lifts off') { hi = mid; ok = true; } else lo = mid; }
    return { form, bench: ok ? (lo + hi) / 2 : NaN, wmin };
  }

  /* ---- an Atwood machine, or a table, with a heavy pulley ---- */
  function atwoodAcc(p, Mp) {
    const I = 0.5 * Mp * p.Rp * p.Rp, meff = p.m1 + p.m2 + I / (p.Rp * p.Rp), tr = p.tauAx / p.Rp;
    if (p.asub === 'hang') {
      const drive = (p.m1 - p.m2) * G;
      const a = Math.abs(drive) <= tr ? 0 : (drive - Math.sign(drive) * tr) / meff;
      return { a, T1: p.m1 * (G - a), T2: p.m2 * (G + a), I, meff, drive };
    }
    const drive = p.m2 * G - p.mutab * p.m1 * G - tr;
    const a = drive <= 0 ? 0 : drive / meff;
    return { a, T1: p.m1 * a + (a > 0 ? p.mutab * p.m1 * G : 0), T2: p.m2 * (G - a), I, meff, drive };
  }
  function runAtwood(p) {
    const A = atwoodAcc(p, p.Mp), D = 0.8, out = [];
    const tEnd = A.a !== 0 ? Math.sqrt(2 * D / Math.abs(A.a)) : 2;
    for (let t = 0; t <= tEnd + 1e-9; t += 0.005) { const x = 0.5 * A.a * t * t, v = A.a * t; out.push([t, x, v, v / p.Rp]); }
    const v = A.a * tEnd, KEt = 0.5 * (p.m1 + p.m2) * v * v, KEr = 0.5 * A.I * (v / p.Rp) * (v / p.Rp);
    const dPE = p.asub === 'hang' ? (p.m1 - p.m2) * G * D * Math.sign(A.a || 1) : p.m2 * G * D, Wf = (p.asub === 'hang' ? 0 : p.mutab * p.m1 * G * D) + p.tauAx * D / p.Rp;
    return Object.assign({}, A, { out, tEnd, D, KEt, KEr, dPE: A.a !== 0 ? dPE : 0, Wf: A.a !== 0 ? Wf : 0, v });
  }

  /* ---- a string wound on a rolling cylinder, over a pulley to a hanging mass ---- */
  function woundAcc(p, hsOverride) {
    const B = RBQ[p.cbody], k = B.k, M = p.Mcyl, r = p.rcyl, m = p.mhang, mu = p.mucyl, I = k * M * r * r;
    const hs = hsOverride == null ? (p.wsub === 'top' ? 2 * r : r) : hsOverride, d = hs - r;
    // unknowns [a, α, T, F] — hanging mass, cylinder x, rotation about the CM, rolling
    let x = solve([[m, m * d, 1, 0], [M, 0, -1, -1], [0, I, -d, r], [1, -r, 0, 0]], [m * G, 0, 0, 0]), rolls = Math.abs(x[3]) <= mu * M * G;
    if (!rolls) { const sg = Math.sign(x[3]); const y = solve([[m, m * d, 1], [M, 0, -1], [0, I, -d]], [m * G, mu * M * G * sg, -mu * M * G * sg * r]); x = [y[0], y[1], y[2], mu * M * G * sg]; }
    return { a: x[0], alpha: x[1], T: x[2], F: x[3], rolls, aHang: x[0] + d * x[1], hs, k, B, M, r, m, mu, I, hZero: r * (1 + k) };
  }
  function runWound(p) {
    const W = woundAcc(p), out = [], D = 0.7;
    const tEnd = Math.sqrt(2 * D / Math.max(1e-9, W.aHang));
    for (let t = 0; t <= tEnd + 1e-9; t += 0.005) out.push([t, 0.5 * W.a * t * t, 0.5 * W.alpha * t * t, 0.5 * W.aHang * t * t, W.a * t, W.aHang * t]);
    const v = W.a * tEnd, w = W.alpha * tEnd, vh = W.aHang * tEnd;
    const KE = 0.5 * W.M * v * v + 0.5 * W.I * w * w + 0.5 * W.m * vh * vh, dPE = W.m * G * D, heat = W.rolls ? 0 : Math.abs(W.F) * Math.abs(0.5 * (W.a - W.r * W.alpha) * tEnd * tEnd);
    return Object.assign({}, W, { out, tEnd, D, KE, dPE, heat });
  }

  /* ---- a belt drive ---- */
  function runBelt(p) {
    const I1 = 0.5 * p.M1b * p.r1b * p.r1b, I2 = 0.5 * p.M2b * p.r2b * p.r2b, r1 = p.r1b, r2 = p.r2b, n = r1 / r2;
    const eMu = Math.exp(p.mubelt * Math.PI), dTmax = 2 * p.T0b * (eMu - 1) / (eMu + 1);
    let w1 = 0, w2 = 0, t = 0, grip = true, heat = 0, Wm = 0, WL = 0, tSlip0 = NaN;
    const out = [], dt = 0.0005, tl = w => p.tauLb * Math.tanh(w / 0.02);   // load friction (made smooth only within 0.02 rad/s of rest)
    while (t < 12) {
      const tm = t < p.Tdrb ? p.taum : 0;
      let a1, a2, dT;
      if (grip) {
        a1 = (tm - tl(w2) * n) / (I1 + I2 * n * n); a2 = a1 * n; dT = (tl(w2) + I2 * a2) / r2;
        if (Math.abs(dT) > dTmax) { grip = false; if (isNaN(tSlip0)) tSlip0 = t; }
      }
      if (!grip) {
        const sl = w1 * r1 - w2 * r2, sg = Math.abs(sl) > 1e-7 ? Math.sign(sl) : Math.sign(dT);
        dT = dTmax * sg; a1 = (tm - dT * r1) / I1; a2 = (dT * r2 - tl(w2)) / I2;
        heat += Math.abs(dT * sl) * dt;
      }
      if (every(t, dt, 0.01)) out.push([t, w1, w2, grip, dT, 0.5 * I1 * w1 * w1, 0.5 * I2 * w2 * w2, Wm, WL, heat, tm]);
      const s0 = w1 * r1 - w2 * r2;
      w1 += a1 * dt; w2 += a2 * dt; Wm += tm * w1 * dt; WL += tl(w2) * w2 * dt;
      if (!grip && Math.sign(w1 * r1 - w2 * r2) !== Math.sign(s0) && Math.abs(s0) > 1e-7) { const L = I1 * w1 + I2 * w2 * n; void L; const v = (I1 * w1 / r1 + I2 * w2 / r2 * 1) / (I1 / (r1 * r1) + I2 / (r2 * r2)); w1 = v / r1; w2 = v / r2; grip = true; }
      if (grip && Math.abs(w1 * r1 - w2 * r2) > 1e-6) { const v = (I1 * w1 / r1 + I2 * w2 / r2) / (I1 / (r1 * r1) + I2 / (r2 * r2)); w1 = v / r1; w2 = v / r2; }
      if (w1 < 0) w1 = 0; if (w2 < 0) w2 = 0;
      t += dt;
      if (t > p.Tdrb + 0.5 && w1 < 1e-4 && w2 < 1e-4) break;
    }
    const gripA1 = (p.taum - p.tauLb * n) / (I1 + I2 * n * n);
    // the largest motor torque the belt can pass on while gripping (from start, at rest, the load at full friction)
    const tauSlip = (dTmax * r2 - p.tauLb) * (I1 + I2 * n * n) / (I2 * n) + p.tauLb * n;
    return { I1, I2, r1, r2, n, dTmax, eMu, out, tEnd: out[out.length - 1][0], gripA1, tSlip0, tauSlip, heat, Wm, WL };
  }

  /* ======================= 26.1 · τ = dL/dt on a flywheel ======================= */
  function drawTorque(S, g) {
    const ctx = g.ctx, th = g.theme, p = S.p, cam = S.cam, Tq = S.Tq;
    const F = R3.Frame(ctx, cam, { ambient: 0.36, floorZ: 0 });
    const tt = S.ts % (Tq.tEnd + 1), i = Math.min(Tq.out.length - 1, Math.round(tt / 0.01)), o = Tq.out[i];
    B3.table(F, -0.9, 0.9, -0.45, 0.45, 0, { legs: false, tone: '#6E4A2C', seed: 31, thick: 0.04 });
    const Rw = 0.42 * p.Rfw / 0.3, zA = Rw + 0.12, ph = S.phi[i] || 0;
    // bearings and shaft (axis along x), the flywheel, the motor on the left
    [-0.25, 0.25].forEach(x => R3.box(F, [x, 0, zA / 2], [0.07, 0.12, zA], '#39414F', { shadow: false }));
    R3.cylinder(F, [-0.62, 0, zA], [0.45, 0, zA], 0.018, '#C8D0DC', { segments: 12, shadow: false });
    R3.cylinder(F, [-0.05, 0, zA], [0.05, 0, zA], Rw, '#8A93A8', { segments: 48, spokes: 6, phase: ph, shadow: false, capColour: '#A7B0C4' });
    R3.box(F, [-0.66, 0, zA], [0.2, 0.2, 0.2], '#2F6FB8', { shadow: false });
    R3.label(F, [-0.66, 0, zA + 0.17], 'motor', '#9FC0F0', { size: 9.5 });
    // brake pad pressing on the rim (the friction torque)
    R3.box(F, [0.0, 0, zA - Rw - 0.035], [0.14, 0.05, 0.05], '#7A3A2A', { shadow: false });
    R3.label(F, [0.12, 0, zA - Rw - 0.05], 'brake pad: τ_f = ' + p.tauF.toFixed(2) + ' N·m', '#F2A07A', { size: 9, align: 'left' });
    // L along the axis, length ∝ L
    const Lmax = Math.max(1e-6, ...Tq.out.map(q => q[5])), La = 0.05 + 0.5 * o[5] / Lmax;
    R3.arrow(F, [0.47, 0, zA], [0.47 + La, 0, zA], 0.014, '#7CF0B0', { vivid: true });
    R3.label(F, [0.52 + La, 0, zA + 0.06], 'L = Iω = ' + o[5].toFixed(3), '#7CF0B0', { size: 10, align: 'left' });
    // the two meters: torque sensor and tachometer
    B3.meter(F, [-0.45, -0.46, 0.2], [0, -1, 0], 0.26, 0.1, { title: 'MOTOR TORQUE', value: o[1].toFixed(3), unit: 'N·m', colour: '#FFD36B' });
    B3.meter(F, [0.35, -0.46, 0.2], [0, -1, 0], 0.26, 0.1, { title: 'SPEED', value: o[4].toFixed(2), unit: 'rad/s', colour: '#7FD0FF' });
    F.render();
    const lbl = { const: 'a steady torque', ramp: 'a torque ramping up', pulse: 'a short hard pulse', sine: 'a half-sine torque' }[p.prof];
    header(g, 'A ' + p.Mfw.toFixed(1) + ' kg flywheel (I = ' + Tq.I.toFixed(4) + ' kg·m²) spun up by ' + lbl + ', against a brake',
      't = ' + o[0].toFixed(2) + ' s · motor ' + o[1].toFixed(3) + ' N·m · friction ' + o[2].toFixed(3) + ' N·m · net ' + o[3].toFixed(3) + ' N·m',
      'the area under the net torque–time curve is the change in angular momentum: ∫τ dt = ΔL, whatever the shape of the torque', th.text);
    panel(g, 'THE ANGULAR IMPULSE, AND L', [
      ['area under τ_net (0 → now)', o[10].toFixed(4) + ' N·m·s', th.phys],
      ['L now = Iω', o[5].toFixed(4) + ' kg·m²/s', th.ok],
      ['motor\'s angular impulse (drive)', Tq.motorImp.toFixed(4) + ' N·m·s'],
      ['work by the motor · KE then', Tq.Wm.toFixed(3) + ' · ' + Tq.KE.toFixed(3) + ' J'],
      ['stops at', isFinite(Tq.tStop) ? Tq.tStop.toFixed(2) + ' s' : 'still turning'],
      ['L − area now', (o[5] - o[10]).toExponential(1)]
    ]);
  }

  /* ======================= 26.2 · a ball strikes a cube ======================= */
  function drawCube(S, g) {
    const ctx = g.ctx, th = g.theme, p = S.p, cam = S.cam, Cb = S.Cb, Im = Cb.Im;
    const F = R3.Frame(ctx, cam, { ambient: 0.36, floorZ: 0 });
    const ks = 0.6 / Im.a, a = Im.a * ks, tPre = 0.8, cyc = tPre + Cb.tEnd + 1.2, tt = S.ts % cyc, tA = tt - tPre;
    R3.plane(F, [-1.4, -0.7, 0], [2.8, 0, 0], [0, 1.4, 0], '#6E4A2C', { grid: 14, gridColour: '#3A2412', gridAlpha: 0.3, bias: F.GROUND });
    const o = tA <= 0 ? Cb.out[0] : Cb.out[Math.min(Cb.out.length - 1, Math.round(tA / 0.004))];
    // the cube: the front edge at xe (starting at x = a/2), turned by θ about it
    let edge, thc;
    if (o[6] === 'tip') { edge = [a / 2 + o[1] * ks, 0, 0]; thc = o[2]; }
    else { edge = [o[1] * ks + a / 2, 0, 0]; thc = 0; }
    const ex = [Math.cos(thc), 0, -Math.sin(thc)], ez = [Math.sin(thc), 0, Math.cos(thc)];
    const ctr = V.add(edge, V.add(V.mul(ex, -a / 2), V.mul(ez, a / 2)));
    R3.box(F, ctr, [a, a, a], '#3A6FB8', { shadow: true, axes: [ex, [0, 1, 0], ez] });
    // the CM's path about the edge, and the upright line through the edge (past it, it falls forward)
    const arc = []; for (let k = 0; k <= 30; k++) { const q = Math.PI / 2 * k / 30; arc.push(V.add(edge, [-a / 2 * Math.cos(q) + a / 2 * Math.sin(q), -a * 0.52, a / 2 * Math.cos(q) + a / 2 * Math.sin(q)])); }
    path3(F, arc, '#FFD36B', { alpha: 0.35, width: 1.2, dash: [3, 3], chunk: 3 });
    path3(F, [V.add(edge, [0, -a * 0.52, 0]), V.add(edge, [0, -a * 0.52, a * 0.85])], '#FF8FB0', { alpha: 0.5, width: 1.2, dash: [4, 3], chunk: 1 });
    R3.sphere(F, V.add(ctr, [0, -a * 0.52, 0]), 0.018, '#FF6B5A', { shadow: false, vivid: true });
    // the ball: in, then out at its rebound speed
    const hb = Im.h * ks, rb = 0.05, xFace = -a / 2 - rb;
    // after the blow the ball is a projectile: it leaves at its rebound speed and falls (drawn at 0.25× horizontally)
    const bx = tA <= 0 ? xFace + (tA / tPre) * 1.0 : xFace + Math.min(1.2, Cb.Im.uBall * tA * ks * 0.25) - (Cb.Im.uBall > 0 ? 0.06 : 0);
    const bz = tA <= 0 ? hb : Math.max(rb, hb - 0.5 * G * tA * tA * ks);
    R3.sphere(F, [Math.min(bx, xFace), 0, bz], rb, '#E0453A', { shadow: true, vivid: true });
    if (tA <= 0) R3.arrow(F, [bx - 0.3, 0, hb + 0.08], [bx - 0.05, 0, hb + 0.08], 0.008, '#FF8A7A', {});
    // just after the blow: the impulses
    if (tA > 0 && tA < 0.7) {
      const s = 0.05;
      R3.arrow(F, [-a / 2 - 0.25, 0, hb], [-a / 2 - 0.25 + Im.J * s * 2, 0, hb], 0.01, '#FFD36B', { vivid: true });
      R3.label(F, [-a / 2 - 0.25, 0, hb + 0.08], 'J = ' + Im.J.toFixed(3) + ' N·s', '#FFD36B', { size: 10 });
      if (Im.Jz > 0) { R3.arrow(F, [a / 2, 0, 0], [a / 2, 0, Im.Jz * s * 2], 0.009, '#8FA3C0', { vivid: true }); R3.arrow(F, [a / 2, 0, 0.01], [a / 2 + Im.Jx * s * 2, 0, 0.01], 0.009, Im.stick ? '#FFB347' : '#FF8FB0', { vivid: true });
        R3.label(F, [a / 2 + 0.05, 0, Im.Jz * s * 2 + 0.06], 'edge: ' + Im.Jz.toFixed(3) + ' up, ' + Math.abs(Im.Jx).toFixed(3) + ' back' + (Im.stick ? ' (holds)' : ' (= μ × up: slides)'), '#AFC2E6', { size: 9.5, align: 'left' }); }
    }
    F.render();
    const oc = { topples: 'it TOPPLES', 'rocks back': 'it rocks and falls back', slides: 'it just SLIDES', 'lifts off': 'it is thrown off the floor', 'still rocking': 'still rocking' }[Cb.outcome];
    header(g, 'A ' + (Im.m * 1000).toFixed(0) + ' g ball at ' + Cb.u.toFixed(2) + ' m/s strikes a ' + Im.M.toFixed(1) + ' kg, ' + (Im.a * 100).toFixed(0) + ' cm cube at ' + (p.hhit * 100).toFixed(0) + '% of its height · ' + oc,
      tA <= 0 ? 'the ball comes in…' : 't = ' + o[0].toFixed(2) + ' s after the blow · θ = ' + (o[2] * 180 / Math.PI).toFixed(1) + '° · ' + (o[6] === 'tip' ? (Math.abs(o[7]) > 1e-6 ? 'pivoting and sliding' : 'pivoting on its front edge') : 'flat, sliding'),
      'during the blow: angular momentum about the edge (if it holds) · after: the edge holds while |f| ≤ μN · it topples if the CM passes over the edge', th.text);
    panel(g, 'TIP OR SLIDE', [
      ['least speed to topple (formula, edge holds)', S.um.form.toFixed(3) + ' m/s', th.ok],
      ['least speed to topple (the bench)', isFinite(S.um.bench) ? S.um.bench.toFixed(3) + ' m/s' : '—', th.phys],
      ['ω just after the blow', Im.w.toFixed(3) + ' rad/s'],
      ['edge holds during the blow?', Im.stick ? 'yes: friction ' + (Math.abs(Im.Jx) / Math.max(1e-9, Im.Jz)).toFixed(3) + ' × normal' : 'no — it slides', Im.stick ? th.ok : '#FF8FB0'],
      ['lowest hit that pivots: 4a/3(1 + μ)', (Im.hSlip / Im.a).toFixed(3) + ' a'],
      ['highest the CM swung', (Cb.thMax * 180 / Math.PI).toFixed(1) + '° (45° to go over)']
    ]);
  }

  /* ======================= 26.3 · the Atwood machine with a heavy pulley ======================= */
  function drawAtwood(S, g) {
    const ctx = g.ctx, th = g.theme, p = S.p, cam = S.cam, At = S.At;
    const F = R3.Frame(ctx, cam, { ambient: 0.36, floorZ: 0 });
    const tt = S.ts % (At.tEnd + 1.2), i = Math.min(At.out.length - 1, Math.round(Math.min(tt, At.tEnd) / 0.005)), o = At.out[i];
    const ks = 0.6, Rp = Math.max(0.08, p.Rp * 1.3), x = o[1] * ks;          // 0.8 m of travel shown as 0.48
    const blk = (c, m, col, lab) => { const s = 0.07 + 0.04 * Math.cbrt(m); R3.box(F, c, [s, s, s], col, { shadow: true }); R3.label(F, V.add(c, [s / 2 + 0.03, 0, 0]), lab, '#DCE3EE', { size: 9.5, align: 'left' }); return s; };
    if (p.asub === 'hang') {
      const top = 1.55;
      R3.box(F, [0, 0, 0.02], [0.6, 0.3, 0.04], '#2C3445', { shadow: false });
      R3.cylinder(F, [0, 0.16, 0.04], [0, 0.16, top], 0.015, '#B8C2D0', { segments: 12, shadow: false });
      R3.cylinder(F, [0, 0.16, top], [0, 0, top], 0.012, '#B8C2D0', { segments: 10, shadow: false });
      B3.pulley(F, [0, 0, top], [0, 1, 0], Rp, { phase: -x / Rp, width: 0.05, spokes: 6, colour: '#C9A04A' });
      const z1 = 0.85 - x, z2 = 0.85 + x;
      B3.string(F, [[-Rp, 0, top], [-Rp, 0, z1 + 0.06]]); B3.string(F, [[Rp, 0, top], [Rp, 0, z2 + 0.06]]);
      const s1 = blk([-Rp, 0, z1], p.m1, '#B84A4A', 'm₁ = ' + p.m1.toFixed(1) + ' kg'), s2 = blk([Rp, 0, z2], p.m2, '#4A7AB8', 'm₂ = ' + p.m2.toFixed(1) + ' kg');
      void s1; void s2;
      R3.label(F, [-Rp - 0.08, 0, (top + z1) / 2], 'T₁ = ' + At.T1.toFixed(2) + ' N', '#FFB347', { size: 9.5, align: 'right' });
      R3.label(F, [Rp + 0.1, 0, z2 - 0.14], 'T₂ = ' + At.T2.toFixed(2) + ' N', '#FFB347', { size: 9.5, align: 'left' });
      R3.label(F, [0, 0, top + Rp + 0.14], 'pulley ' + p.Mp.toFixed(1) + ' kg: T₁ − T₂ turns it', '#F2C879', { size: 9.5 });
    } else {
      const tz = 0.8;
      B3.table(F, -0.9, 0.3, -0.3, 0.3, tz, { tone: '#8A5A32', seed: 17, legH: 0.6 });
      R3.cylinder(F, [0.3, 0, tz - 0.02], [0.3 + Rp, 0, tz + 0.0], 0.012, '#B8C2D0', { segments: 10, shadow: false });
      const pc = [0.3 + Rp * 0.2, 0, tz + Rp + 0.01];
      B3.pulley(F, pc, [0, 1, 0], Rp, { phase: -x / Rp, width: 0.05, spokes: 6, colour: '#C9A04A' });
      const bx = -0.62 + x, s1 = 0.07 + 0.04 * Math.cbrt(p.m1);
      blk([bx, 0, tz + s1 / 2], p.m1, '#B84A4A', 'm₁ on the table');
      B3.string(F, [[bx + s1 / 2, 0, pc[2] + Rp], [pc[0], 0, pc[2] + Rp]]);
      const zh = 0.6 - x; B3.string(F, [[pc[0] + Rp, 0, pc[2]], [pc[0] + Rp, 0, zh + 0.05]]);
      blk([pc[0] + Rp, 0, zh], p.m2, '#4A7AB8', 'm₂');
      R3.label(F, [(bx + pc[0]) / 2, 0, pc[2] + Rp + 0.07], 'T₁ = ' + At.T1.toFixed(2) + ' N', '#FFB347', { size: 9.5 });
      R3.label(F, [pc[0] + Rp + 0.07, 0, (pc[2] + zh) / 2], 'T₂ = ' + At.T2.toFixed(2) + ' N', '#FFB347', { size: 9.5, align: 'left' });
    }
    F.render();
    header(g, (p.asub === 'hang' ? 'An Atwood machine' : 'A block on a table (μ = ' + p.mutab.toFixed(2) + ')') + ' over a ' + p.Mp.toFixed(1) + ' kg pulley of radius ' + (p.Rp * 100).toFixed(0) + ' cm' + (p.tauAx > 0 ? ' · axle friction ' + p.tauAx.toFixed(2) + ' N·m' : ''),
      't = ' + o[0].toFixed(2) + ' s · a = ' + At.a.toFixed(4) + ' m/s² · v = ' + o[2].toFixed(3) + ' m/s · the pulley turns at ' + o[3].toFixed(2) + ' rad/s',
      'a massive pulley needs a torque to spin up, so the two tensions differ: (T₁ − T₂)R = Iα = (I/R)a', th.text);
    panel(g, 'THE TWO TENSIONS', [
      ['acceleration', At.a.toFixed(4) + ' m/s²', th.phys],
      ['T₁ · T₂', At.T1.toFixed(3) + ' · ' + At.T2.toFixed(3) + ' N'],
      [p.asub === 'hang' ? 'T₁ − T₂' : 'T₂ − T₁ (hanging side minus table side)', (p.asub === 'hang' ? At.T1 - At.T2 : At.T2 - At.T1).toFixed(4) + ' N', th.phys],
      ['I·a/R² (+ axle friction/R)', (At.I * At.a / (p.Rp * p.Rp) + (At.a !== 0 ? p.tauAx / p.Rp : 0)).toFixed(4) + ' N', th.ok],
      ['energy after 0.8 m: KE (trans + rot) + friction', (At.KEt + At.KEr + At.Wf).toFixed(4) + ' J'],
      ['potential energy released', At.dPE.toFixed(4) + ' J', th.ok]
    ]);
  }

  /* ======================= 26.4 · a string wound on a rolling cylinder ======================= */
  function drawWound(S, g) {
    const ctx = g.ctx, th = g.theme, p = S.p, cam = S.cam, Wn = S.Wn;
    const F = R3.Frame(ctx, cam, { ambient: 0.36, floorZ: 0 });
    const tt = S.ts % (Wn.tEnd + 1.2), i = Math.min(Wn.out.length - 1, Math.round(Math.min(tt, Wn.tEnd) / 0.005)), o = Wn.out[i];
    const tz = 0.8, r = Math.max(0.06, Wn.r * 1.2), cx = -0.75 + o[1] * 1.2, c = [cx, 0, tz + r];
    B3.table(F, -1.0, 0.35, -0.3, 0.3, tz, { tone: '#8A5A32', seed: 23, legH: 0.6 });
    body25(F, p.cbody, c, r, o[2]);
    const hs = p.wsub === 'top' ? 2 * r : r, sp = [cx, 0, tz + hs];
    const Rp = 0.05, pc = [0.35 + Rp * 0.2, 0, tz + hs - Rp];
    R3.cylinder(F, [0.35, 0, tz - 0.02], [pc[0], 0, pc[2]], 0.01, '#B8C2D0', { segments: 10, shadow: false });
    B3.pulley(F, pc, [0, 1, 0], Rp, { phase: -o[3] / Rp, width: 0.04, spokes: 5 });
    if (p.wsub === 'axle') { R3.box(F, [cx, -r * 0.8, tz + r], [0.02, 0.02, 0.02], '#C9D2DE', { shadow: false }); path3(F, [[cx, -r * 0.8, tz + r], [cx, 0, tz + r]], '#C9D2DE', { alpha: 0.9, width: 2, chunk: 1 }); }
    B3.string(F, [sp, [pc[0], 0, pc[2] + Rp]]);
    const zh = tz - 0.25 - o[3]; B3.string(F, [[pc[0] + Rp, 0, pc[2]], [pc[0] + Rp, 0, zh + 0.05]]);
    R3.box(F, [pc[0] + Rp, 0, zh], [0.08, 0.08, 0.08], '#4A7AB8', { shadow: true });
    R3.label(F, [pc[0] + Rp + 0.08, 0, zh], 'm = ' + Wn.m.toFixed(2) + ' kg', '#DCE3EE', { size: 9.5, align: 'left' });
    if (Math.abs(Wn.F) > 1e-4) { const cp = [cx, 0, tz + 0.004]; R3.arrow(F, cp, V.add(cp, [Math.sign(Wn.F) * (0.08 + 0.05 * Math.abs(Wn.F)), 0, 0]), 0.008, Wn.rolls ? '#FFB347' : '#FF8FB0', { vivid: true });
      R3.label(F, V.add(cp, [Math.sign(Wn.F) * 0.2, 0, -0.06]), 'friction ' + (Wn.F > 0 ? 'forward' : 'backward') + ' ' + Math.abs(Wn.F).toFixed(3) + ' N', '#FFB347', { size: 9.5 }); }
    R3.arrow(F, V.add(sp, [0.02, 0, 0]), V.add(sp, [0.2, 0, 0]), 0.008, '#7CF0B0', { vivid: true });
    R3.label(F, V.add(sp, [0.1, 0, 0.07]), 'T = ' + Wn.T.toFixed(3) + ' N', '#7CF0B0', { size: 9.5 });
    F.render();
    header(g, 'A ' + p.Mcyl.toFixed(1) + ' kg ' + Wn.B.name + ' pulled by a string from its ' + (p.wsub === 'top' ? 'TOP' : 'AXLE') + ' by a ' + (Wn.m * 1000).toFixed(0) + ' g hanging mass',
      't = ' + o[0].toFixed(2) + ' s · cylinder ' + o[4].toFixed(3) + ' m/s · hanging mass ' + o[5].toFixed(3) + ' m/s · ' + (Wn.rolls ? 'rolling' : 'SLIPPING'),
      p.wsub === 'top' ? 'the top of a rolling body moves at twice the centre: the hanging mass falls 2x for every x the cylinder rolls' : 'pulled at the axle: friction must point backward to spin it up', th.text);
    panel(g, 'SOLVED TOGETHER', [
      ['cylinder acceleration', Wn.a.toFixed(4) + ' m/s²', th.phys],
      ['hanging mass acceleration', Wn.aHang.toFixed(4) + ' m/s²', th.phys],
      ['tension', Wn.T.toFixed(4) + ' N'],
      ['friction needed · μMg', Wn.F.toFixed(4) + ' · ' + (Wn.mu * Wn.M * G).toFixed(3) + ' N', Wn.rolls ? th.ok : '#FF8FB0'],
      ['string height for zero friction: r(1 + k)', (Wn.hZero * 100).toFixed(2) + ' cm'],
      ['KE gained · mgh released', Wn.KE.toFixed(4) + ' · ' + Wn.dPE.toFixed(4) + ' J', Wn.rolls ? th.ok : null]
    ]);
  }

  /* ======================= 26.5 · a belt drive ======================= */
  function drawBelt(S, g) {
    const ctx = g.ctx, th = g.theme, p = S.p, cam = S.cam, Bt = S.Bt;
    const F = R3.Frame(ctx, cam, { ambient: 0.36, floorZ: 0 });
    const tt = S.ts % (Bt.tEnd + 1), i = Math.min(Bt.out.length - 1, Math.round(tt / 0.01)), o = Bt.out[i];
    const ks = 2.2, r1 = Bt.r1 * ks, r2 = Bt.r2 * ks, z0 = 0.55, C1 = [-0.45, 0, z0], C2 = [0.45, 0, z0], d = C2[0] - C1[0];
    R3.box(F, [0, 0.12, 0.3], [1.5, 0.04, 0.6], '#39414F', { shadow: false });
    R3.box(F, [0, 0, 0.02], [1.5, 0.4, 0.04], '#2C3445', { shadow: false });
    const ph1 = S.phi1[i] || 0, ph2 = S.phi2[i] || 0;
    B3.pulley(F, C1, [0, -1, 0], r1, { phase: ph1, width: 0.05, spokes: 5, colour: '#8FA3C0' });
    B3.pulley(F, C2, [0, -1, 0], r2, { phase: ph2, width: 0.05, spokes: 6, colour: '#C9A04A' });
    R3.box(F, [C1[0], 0.09, z0], [0.14, 0.1, 0.14], '#2F6FB8', { shadow: false });
    R3.label(F, [C1[0], 0, z0 + r1 + 0.1], 'motor pulley', '#9FC0F0', { size: 9.5 });
    R3.label(F, [C2[0], 0, z0 + r2 + 0.1], 'load pulley (brake ' + p.tauLb.toFixed(2) + ' N·m)', '#F2C879', { size: 9.5 });
    // the belt: two tangent spans and the wraps; the tight span (pulled by the driver) glows
    const sN = (r2 - r1) / d, cN = Math.sqrt(Math.max(0, 1 - sN * sN)), up = [-sN, 0, cN], dn = [-sN, 0, -cN];
    const U1 = V.add(C1, V.mul(up, r1)), U2 = V.add(C2, V.mul(up, r2)), D1 = V.add(C1, V.mul(dn, r1)), D2 = V.add(C2, V.mul(dn, r2));
    const wrap = (C, r, a0, a1) => { const pts = []; for (let k = 0; k <= 24; k++) { const a = a0 + (a1 - a0) * k / 24; pts.push([C[0] + r * Math.cos(a), -0.001, C[2] + r * Math.sin(a)]); } return pts; };
    const au = Math.atan2(up[2], up[0]), ad = Math.atan2(dn[2], dn[0]);
    const slip = !o[3], tightCol = slip ? '#FF8FB0' : '#FFD36B';
    B3.string(F, [U1, U2], { r: 0.008, colour: '#3A3F4A' }); B3.string(F, [D1, D2], { r: 0.008, colour: '#E0B040' });
    B3.string(F, wrap(C1, r1, au, ad + TAU * (ad < au ? 1 : 0) - TAU), { r: 0.008, colour: '#5A6070' });
    B3.string(F, wrap(C2, r2, ad, au), { r: 0.008, colour: '#5A6070' });
    path3(F, [D1, D2], tightCol, { alpha: 0.8, width: 2.4, chunk: 1 });
    R3.label(F, V.mul(V.add(D1, D2), 0.5), 'tight side · ΔT = ' + o[4].toFixed(2) + ' N', tightCol, { size: 9.5 });
    if (slip) R3.label(F, [0, 0, z0 + r2 + 0.26], 'THE BELT IS SLIPPING', '#FF8FB0', { size: 11 });
    B3.meter(F, [C1[0], -0.22, 0.14], [0, -1, 0], 0.24, 0.09, { title: 'MOTOR ω₁', value: o[1].toFixed(2), unit: 'rad/s', colour: '#7FD0FF' });
    B3.meter(F, [C2[0], -0.22, 0.14], [0, -1, 0], 0.24, 0.09, { title: 'LOAD ω₂', value: o[2].toFixed(2), unit: 'rad/s', colour: '#FFD36B' });
    F.render();
    header(g, 'A belt drive · r₁ = ' + (Bt.r1 * 100).toFixed(0) + ' cm drives r₂ = ' + (Bt.r2 * 100).toFixed(0) + ' cm · motor ' + p.taum.toFixed(2) + ' N·m for ' + p.Tdrb.toFixed(1) + ' s',
      't = ' + o[0].toFixed(2) + ' s · ' + (slip ? 'SLIPPING: the belt passes only the capstan limit ΔT_max' : 'gripping: ω₂/ω₁ = r₁/r₂ = ' + Bt.n.toFixed(3)),
      'gripping: I₁α₁ = τ − ΔT r₁ and I₂α₂ = ΔT r₂ − τ_load with r₁α₁ = r₂α₂ · slips when ΔT would exceed 2T₀(e^{μπ} − 1)/(e^{μπ} + 1)', th.text);
    panel(g, 'THE BELT', [
      ['motor α while gripping', Bt.gripA1.toFixed(4) + ' rad/s²', th.phys],
      ['(τ − τ_load r₁/r₂)/(I₁ + I₂ r₁²/r₂²)', Bt.gripA1.toFixed(4) + ' rad/s²', th.ok],
      ['largest ΔT the belt can carry', Bt.dTmax.toFixed(3) + ' N'],
      ['motor torque at which it would slip', Bt.tauSlip.toFixed(3) + ' N·m', p.taum > Bt.tauSlip ? '#FF8FB0' : th.ok],
      ['heat in the belt (slipping)', Bt.heat.toFixed(3) + ' J'],
      ['work by the motor', o[7].toFixed(3) + ' J']
    ]);
  }

  const TQM = S => S.p.mode === 'torque', CBM = S => S.p.mode === 'cube', ATM = S => S.p.mode === 'atwood', WNM = S => S.p.mode === 'wound', BTM = S => S.p.mode === 'belt';
  const rollOpts = ['sphere', 'cylinder', 'shell', 'ring'].map(k2 => ({ value: k2, label: RBQ[k2].name[0].toUpperCase() + RBQ[k2].name.slice(1) }));
  const cumAngle = (out, iW) => { const a = []; let s = 0; out.forEach((q, j) => { if (j) s += q[iW] * (q[0] - out[j - 1][0]); a.push(s); }); return a; };

  L.register({
    id: 'rotimpulse', subject: 'physics',
    name: 'Rotational Impulse and Connected Bodies — τ = dL/dt, a Struck Cube, the Heavy Pulley, the Wound Cylinder, the Belt',
    chapter: 'System of Particles & Rotational Motion',
    exams: ['JEE Main', 'JEE Advanced'],
    weight: 'JEE Advanced favourite',
    is3D: true,
    stageHint: 'Drag to orbit · torques, impulses and tensions are solved, then integrated — the meters read the run',
    lede: 'Where rotation meets <b>impulse</b> and <b>connected bodies</b>. A motor spins a flywheel against a brake, and the <b>area under the ' +
      'torque–time graph</b> is laid against ΔL. A ball strikes a <b>cube</b>: during the blow the floor\'s edge must hold with impulsive friction, ' +
      'or it slides; afterwards the cube <b>topples or rocks back</b>. An Atwood machine with a <b>massive pulley</b> has two different tensions. ' +
      'A string wound on a <b>rolling cylinder</b> pulls from the top — the hanging mass falls twice as fast. A <b>belt</b> grips until the capstan ' +
      'limit, then slips.',

    params: { mode: 'torque', Mfw: 4, Rfw: 0.3, prof: 'const', tau0: 2, Tdr: 3, tauF: 0.8,
              acube: 0.3, Mcu: 2, mball: 0.2, uball: 11, hhit: 1, ecube: 0, mucu: 0.6,
              asub: 'hang', m1: 3, m2: 2, Mp: 2, Rp: 0.1, tauAx: 0, mutab: 0.2,
              wsub: 'top', cbody: 'cylinder', Mcyl: 2, rcyl: 0.1, mhang: 0.5, mucyl: 0.5,
              r1b: 0.05, r2b: 0.15, M1b: 2, M2b: 8, taum: 0.3, Tdrb: 2, tauLb: 0.2, T0b: 20, mubelt: 0.3, run: true },

    presets: [
      { name: 'Flywheel · a steady torque against a brake', params: { mode: 'torque', prof: 'const', tau0: 2, Tdr: 3, tauF: 0.8 } },
      { name: 'Flywheel · a short hard pulse (angular impulse)', params: { mode: 'torque', prof: 'pulse', tau0: 12, Tdr: 3, tauF: 0.8 } },
      { name: 'Flywheel · a half-sine torque', params: { mode: 'torque', prof: 'sine', tau0: 3, Tdr: 3, tauF: 0.8 } },
      { name: 'Cube · struck at the top, fast enough: topples', params: { mode: 'cube', uball: 11, hhit: 1, mucu: 0.6, ecube: 0 } },
      { name: 'Cube · a little too slow: rocks back', params: { mode: 'cube', uball: 9.5, hhit: 1, mucu: 0.6, ecube: 0 } },
      { name: 'Cube · struck low on a slippery floor: slides', params: { mode: 'cube', uball: 11, hhit: 0.5, mucu: 0.3, ecube: 0 } },
      { name: 'Cube · a bouncy ball needs less speed', params: { mode: 'cube', uball: 8, hhit: 1, mucu: 0.6, ecube: 0.8 } },
      { name: 'Atwood · a heavy pulley', params: { mode: 'atwood', asub: 'hang', m1: 3, m2: 2, Mp: 2, Rp: 0.1, tauAx: 0 } },
      { name: 'Atwood · a light pulley (T₁ = T₂)', params: { mode: 'atwood', asub: 'hang', m1: 3, m2: 2, Mp: 0, Rp: 0.1, tauAx: 0 } },
      { name: 'Block on a table over a heavy pulley', params: { mode: 'atwood', asub: 'table', m1: 2, m2: 1, Mp: 2, Rp: 0.1, mutab: 0.2, tauAx: 0.02 } },
      { name: 'Wound cylinder · pulled from the top', params: { mode: 'wound', wsub: 'top', cbody: 'cylinder', Mcyl: 2, mhang: 0.5 } },
      { name: 'Wound cylinder · pulled at the axle', params: { mode: 'wound', wsub: 'axle', cbody: 'cylinder', Mcyl: 2, mhang: 0.5 } },
      { name: 'A ring pulled from the top: no friction needed', params: { mode: 'wound', wsub: 'top', cbody: 'ring', Mcyl: 2, mhang: 0.5 } },
      { name: 'Belt drive · gripping', params: { mode: 'belt', taum: 0.3, T0b: 20, mubelt: 0.3 } },
      { name: 'Belt drive · too much torque: it slips', params: { mode: 'belt', taum: 0.5, Tdrb: 1.5, T0b: 4, mubelt: 0.3 } }
    ],

    controls: [
      { group: 'Bench', items: [
        { key: 'mode', type: 'select', label: 'Experiment', restructure: true, rebuild: true, options: [
          { value: 'torque', label: 'τ = dL/dt: the flywheel' }, { value: 'cube', label: 'A ball strikes a cube' }, { value: 'atwood', label: 'The heavy pulley' },
          { value: 'wound', label: 'A string on a rolling cylinder' }, { value: 'belt', label: 'A belt drive' }] }
      ] },
      { group: 'The flywheel', items: [
        { key: 'prof', type: 'select', label: 'Motor torque', restructure: true, when: TQM, options: [{ value: 'const', label: 'Steady' }, { value: 'ramp', label: 'Ramping up' }, { value: 'pulse', label: 'A short pulse' }, { value: 'sine', label: 'Half a sine' }] },
        { key: 'tau0', label: 'Peak motor torque', min: 0.2, max: 20, step: 0.1, unit: 'N·m', when: TQM, fmt: v => v.toFixed(1), restructure: true },
        { key: 'Tdr', label: 'Drive time', min: 0.5, max: 6, step: 0.1, unit: 's', when: TQM, fmt: v => v.toFixed(1), restructure: true },
        { key: 'tauF', label: 'Brake (friction) torque', min: 0, max: 3, step: 0.05, unit: 'N·m', when: TQM, fmt: v => v.toFixed(2), restructure: true },
        { key: 'Mfw', label: 'Flywheel mass', min: 0.5, max: 20, step: 0.1, unit: 'kg', when: TQM, fmt: v => v.toFixed(1), restructure: true },
        { key: 'Rfw', label: 'Flywheel radius', min: 0.1, max: 0.4, step: 0.01, unit: 'm', when: TQM, fmt: v => v.toFixed(2), restructure: true }
      ] },
      { group: 'Ball and cube', items: [
        { key: 'uball', label: 'Ball speed', min: 0.5, max: 25, step: 0.05, unit: 'm/s', when: CBM, fmt: v => v.toFixed(2), restructure: true },
        { key: 'hhit', label: 'Strike height (× edge)', min: 0.3, max: 1, step: 0.01, unit: '', when: CBM, fmt: v => v.toFixed(2), restructure: true },
        { key: 'ecube', label: 'Restitution e', min: 0, max: 1, step: 0.05, unit: '', when: CBM, fmt: v => v.toFixed(2), restructure: true },
        { key: 'mucu', label: 'Floor friction μ', min: 0.05, max: 1.5, step: 0.01, unit: '', when: CBM, fmt: v => v.toFixed(2), restructure: true },
        { key: 'mball', label: 'Ball mass', min: 0.02, max: 2, step: 0.01, unit: 'kg', when: CBM, fmt: v => v.toFixed(2), restructure: true },
        { key: 'Mcu', label: 'Cube mass', min: 0.2, max: 10, step: 0.1, unit: 'kg', when: CBM, fmt: v => v.toFixed(1), restructure: true },
        { key: 'acube', label: 'Cube edge', min: 0.1, max: 0.6, step: 0.01, unit: 'm', when: CBM, fmt: v => v.toFixed(2), restructure: true }
      ] },
      { group: 'The pulley', items: [
        { key: 'asub', type: 'select', label: 'Arrangement', restructure: true, when: ATM, options: [{ value: 'hang', label: 'Two hanging masses' }, { value: 'table', label: 'A block on a table' }] },
        { key: 'Mp', label: 'Pulley mass (a disc)', min: 0, max: 8, step: 0.1, unit: 'kg', when: ATM, fmt: v => v.toFixed(1), restructure: true },
        { key: 'm1', label: 'm₁', min: 0.2, max: 8, step: 0.1, unit: 'kg', when: ATM, fmt: v => v.toFixed(1), restructure: true },
        { key: 'm2', label: 'm₂', min: 0.2, max: 8, step: 0.1, unit: 'kg', when: ATM, fmt: v => v.toFixed(1), restructure: true },
        { key: 'tauAx', label: 'Axle friction torque', min: 0, max: 0.5, step: 0.01, unit: 'N·m', when: ATM, fmt: v => v.toFixed(2), restructure: true },
        { key: 'mutab', label: 'Table friction μ', min: 0, max: 1, step: 0.01, unit: '', when: S => ATM(S) && S.p.asub === 'table', fmt: v => v.toFixed(2), restructure: true },
        { key: 'Rp', label: 'Pulley radius', min: 0.03, max: 0.3, step: 0.01, unit: 'm', when: ATM, fmt: v => v.toFixed(2), restructure: true }
      ] },
      { group: 'The wound cylinder', items: [
        { key: 'wsub', type: 'select', label: 'String leaves from', restructure: true, when: WNM, options: [{ value: 'top', label: 'The top' }, { value: 'axle', label: 'The axle' }] },
        { key: 'cbody', type: 'select', label: 'Body', restructure: true, when: WNM, options: rollOpts },
        { key: 'mhang', label: 'Hanging mass', min: 0.05, max: 5, step: 0.05, unit: 'kg', when: WNM, fmt: v => v.toFixed(2), restructure: true },
        { key: 'Mcyl', label: 'Cylinder mass', min: 0.2, max: 10, step: 0.1, unit: 'kg', when: WNM, fmt: v => v.toFixed(1), restructure: true },
        { key: 'mucyl', label: 'Table friction μ', min: 0.02, max: 1, step: 0.01, unit: '', when: WNM, fmt: v => v.toFixed(2), restructure: true }
      ] },
      { group: 'The belt', items: [
        { key: 'taum', label: 'Motor torque', min: 0.05, max: 4, step: 0.05, unit: 'N·m', when: BTM, fmt: v => v.toFixed(2), restructure: true },
        { key: 'Tdrb', label: 'Drive time', min: 0.5, max: 5, step: 0.1, unit: 's', when: BTM, fmt: v => v.toFixed(1), restructure: true },
        { key: 'tauLb', label: 'Load brake torque', min: 0, max: 2, step: 0.05, unit: 'N·m', when: BTM, fmt: v => v.toFixed(2), restructure: true },
        { key: 'T0b', label: 'Belt pre-tension', min: 1, max: 60, step: 0.5, unit: 'N', when: BTM, fmt: v => v.toFixed(1), restructure: true },
        { key: 'mubelt', label: 'Belt friction μ', min: 0.05, max: 1, step: 0.01, unit: '', when: BTM, fmt: v => v.toFixed(2), restructure: true },
        { key: 'r2b', label: 'Load pulley radius', min: 0.05, max: 0.25, step: 0.005, unit: 'm', when: BTM, fmt: v => v.toFixed(3), restructure: true },
        { key: 'M2b', label: 'Load pulley mass', min: 0.5, max: 20, step: 0.5, unit: 'kg', when: BTM, fmt: v => v.toFixed(1), restructure: true }
      ] },
      { group: 'Display', items: [
        { key: 'run', type: 'toggle', label: 'Let it run' }
      ] }
    ],

    setup(S) {
      const p = S.p;
      if (p.mode === 'torque') { S.Tq = runTorque(p); S.phi = cumAngle(S.Tq.out, 4); }
      else if (p.mode === 'cube') { S.Cb = runCube(p); S.um = cubeUmin(p); }
      else if (p.mode === 'atwood') S.At = runAtwood(p);
      else if (p.mode === 'wound') S.Wn = runWound(p);
      else { S.Bt = runBelt(p); S.phi1 = cumAngle(S.Bt.out, 1); S.phi2 = cumAngle(S.Bt.out, 2); }
      S.ts = 0;
      const views = {
        torque: { theta: -1.2, phi: 0.3, dist: 2.6, target: [0, 0, 0.35] },
        cube: { theta: -1.45, phi: 0.22, dist: 2.6, target: [0.1, 0, 0.35] },
        atwood: { theta: -1.45, phi: 0.18, dist: 3.1, target: [0, 0, 0.85] },
        wound: { theta: -1.35, phi: 0.25, dist: 2.8, target: [-0.2, 0, 0.75] },
        belt: { theta: -1.52, phi: 0.25, dist: 2.3, target: [0, 0, 0.45] }
      };
      if (!S.cam || S._view !== p.mode) { S.cam = Camera(views[p.mode]); S.cam.minDist = 0.8; S.cam.maxDist = 14; S._view = p.mode; S._narrowCam = false; }
    },

    step(S, dt) { if (S.p.run) S.ts += dt; },

    drawStage(S, g) {
      if (g.w < 660 && !S._narrowCam) { S.cam.dist *= 1.3; S._narrowCam = true; }
      const md = S.p.mode;
      if (md === 'torque') drawTorque(S, g); else if (md === 'cube') drawCube(S, g); else if (md === 'atwood') drawAtwood(S, g); else if (md === 'wound') drawWound(S, g); else drawBelt(S, g);
    },

    plots: [
      { title: S => ({ torque: 'Torque against time — the net area is the angular impulse', cube: 'The cube\'s tilt after the blow', atwood: 'Acceleration and tensions against the pulley\'s mass',
                       wound: 'Accelerations against the hanging mass', belt: 'Rim speeds of the two pulleys — equal while the belt grips' })[S.p.mode],
        draw(S, g) {
          const p = S.p, th = g.theme, cy = '#3DD6F5', gr = '#7CF0B0', am = '#F5B451', pk = '#FF8FB0';
          if (p.mode === 'torque') {
            const Tq = S.Tq, o = Tq.out, hi = Math.max(...o.map(q => q[1])) * 1.15 + 0.1, lo = Math.min(...o.map(q => q[3]), ...o.map(q => q[2])) * 1.2 - 0.1;
            const P = g.Plot({ xmin: 0, xmax: Tq.tEnd, ymin: lo, ymax: hi, xlabel: 't (s)', ylabel: 'N·m', xfmt: v => v.toFixed(1), yfmt: v => v.toFixed(1) }).frame();
            P.clip(() => { P.area(o.map(q => [q[0], q[3]]), 0, g.alpha(cy, .14)); P.hline(0, g.alpha(th['text-3'], .7)); P.line(o.map(q => [q[0], q[1]]), am, 2); P.line(o.map(q => [q[0], q[2]]), pk, 1.8); P.line(o.map(q => [q[0], q[3]]), cy, 2.2); P.vline(S.ts % (Tq.tEnd + 1), g.alpha(gr, .6), [3, 3]); });
            P.tag(Tq.tEnd * 0.98, hi * 0.9, 'amber: motor · pink: brake · blue: net (shaded area = ΔL)', th['text-2'], 'right', 0);
            return;
          }
          if (p.mode === 'cube') {
            const Cb = S.Cb, pts = Cb.out.map(q => [q[0], q[2] * 180 / Math.PI]);
            const P = g.Plot({ xmin: 0, xmax: Math.max(0.2, Cb.tEnd), ymin: 0, ymax: 95, xlabel: 't after the blow (s)', ylabel: 'θ (°)', xfmt: v => v.toFixed(2), yfmt: v => v.toFixed(0) }).frame();
            P.clip(() => { P.hline(45, g.alpha(pk, .8), [4, 3]); P.line(pts, cy, 2.4); Cb.out.forEach(q => { if (q[6] === 'tip' && Math.abs(q[7]) > 1e-6) P.dot(q[0], q[2] * 180 / Math.PI, 1.6, am); }); });
            P.tag(0.01, 45, '45°: the CM over the edge — past it, it falls forward', pk, 'left', -8);
            P.tag(Math.max(0.2, Cb.tEnd) * 0.98, 88, { topples: 'topples', 'rocks back': 'rocks back', slides: 'slides flat', 'lifts off': 'thrown clear', 'still rocking': '…' }[Cb.outcome] + (Cb.out.some(q => q[6] === 'tip' && Math.abs(q[7]) > 1e-6) ? ' · amber: the edge slides' : ''), th.text, 'right', 0);
            return;
          }
          if (p.mode === 'atwood') {
            const a = [], T1 = [], T2 = []; for (let M = 0; M <= 8.001; M += 0.1) { const r = atwoodAcc(p, M); a.push([M, r.a]); T1.push([M, r.T1]); T2.push([M, r.T2]); }
            const hi = Math.max(...T1.map(q => q[1]), ...T2.map(q => q[1])) * 1.1;
            const P = g.Plot({ xmin: 0, xmax: 8, ymin: 0, ymax: hi, xlabel: 'pulley mass (kg)', ylabel: 'N  ·  (a in m/s² × 5)', xfmt: v => v.toFixed(0), yfmt: v => v.toFixed(0) }).frame();
            P.clip(() => { P.line(T1, pk, 2.2); P.line(T2, am, 2.2); P.line(a.map(q => [q[0], Math.abs(q[1]) * 5]), cy, 2.2); P.vline(p.Mp, g.alpha(gr, .7), [3, 3]); });
            P.tag(7.9, T1[T1.length - 1][1], 'T₁', pk, 'right', -8); P.tag(7.9, T2[T2.length - 1][1], 'T₂', am, 'right', 12); P.tag(7.9, Math.abs(a[a.length - 1][1]) * 5, 'a × 5', cy, 'right', -8);
            return;
          }
          if (p.mode === 'wound') {
            const aC = [], aH = [], Mc = p.Mcyl; for (let r = 0.02; r <= 3.001; r += 0.02) { const w = woundAcc(Object.assign({}, p, { mhang: r * Mc })); aC.push([r, w.a]); aH.push([r, w.aHang]); }
            const P = g.Plot({ xmin: 0, xmax: 3, ymin: 0, ymax: Math.max(...aH.map(q => q[1])) * 1.1, xlabel: 'hanging mass ÷ cylinder mass', ylabel: 'm/s²', xfmt: v => v.toFixed(1), yfmt: v => v.toFixed(1) }).frame();
            P.clip(() => { P.line(aH, am, 2.2); P.line(aC, cy, 2.2); P.dot(p.mhang / Mc, S.Wn.aHang, 5, am, th['ink-950']); P.dot(p.mhang / Mc, S.Wn.a, 5, cy, th['ink-950']); });
            P.tag(2.95, aH[aH.length - 1][1], 'hanging mass', am, 'right', -8); P.tag(2.95, aC[aC.length - 1][1], 'cylinder\'s centre', cy, 'right', -8);
            return;
          }
          const Bt = S.Bt, o = Bt.out, v1 = o.map(q => [q[0], q[1] * Bt.r1]), v2 = o.map(q => [q[0], q[2] * Bt.r2]);
          const P = g.Plot({ xmin: 0, xmax: Bt.tEnd, ymin: 0, ymax: Math.max(...v1.map(q => q[1]), ...v2.map(q => q[1])) * 1.12 + 0.01, xlabel: 't (s)', ylabel: 'rim speed (m/s)', xfmt: v => v.toFixed(1), yfmt: v => v.toFixed(2) }).frame();
          P.clip(() => { o.forEach((q, j) => { if (!q[3] && j) { const x0 = P.X(o[j - 1][0]), x1 = P.X(q[0]); g.ctx.fillStyle = g.alpha(pk, .12); g.ctx.fillRect(x0, P.y1, x1 - x0 + 0.5, P.y0 - P.y1); } });
            P.line(v1, cy, 2.2); P.line(v2, am, 2.2, [6, 3]); P.vline(p.Tdrb, g.alpha(th['text-3'], .6), [2, 4]); });
          P.tag(Bt.tEnd * 0.98, Math.max(...v1.map(q => q[1])), 'blue: ω₁r₁ · amber dashed: ω₂r₂ · pink bands: slipping', th['text-2'], 'right', -8);
        } },
      { title: S => ({ torque: 'Angular momentum, and the running area under τ_net', cube: 'The least speed to topple, against where it is struck', atwood: 'Where the released energy goes',
                       wound: 'Friction needed against the height of the string', belt: 'Where the motor\'s work goes' })[S.p.mode],
        draw(S, g) {
          const p = S.p, th = g.theme, cy = '#3DD6F5', gr = '#7CF0B0', am = '#F5B451', pk = '#FF8FB0';
          if (p.mode === 'torque') {
            const o = S.Tq.out, hi = Math.max(...o.map(q => q[5]), ...o.map(q => q[10])) * 1.12 + 0.01;
            const P = g.Plot({ xmin: 0, xmax: S.Tq.tEnd, ymin: 0, ymax: hi, xlabel: 't (s)', ylabel: 'kg·m²/s  =  N·m·s', xfmt: v => v.toFixed(1), yfmt: v => v.toFixed(2) }).frame();
            P.clip(() => { P.line(o.map(q => [q[0], q[5]]), cy, 3); P.line(o.map(q => [q[0], q[10]]), am, 1.6, [6, 3]); });
            P.tag(S.Tq.tEnd * 0.98, hi * 0.92, 'blue: L = Iω (from the wheel) · amber dashed: ∫τ_net dt (from the graph above) — one line', th['text-2'], 'right', 0);
            return;
          }
          if (p.mode === 'cube') {
            const a = p.acube, M = p.Mcu, m = p.mball, e = p.ecube, Ie = 2 / 3 * M * a * a, wmin = S.um.wmin, pts = [];
            for (let h = 0.3; h <= 1.0001; h += 0.01) pts.push([h, wmin * (Ie / (m * h * a) + h * a) / (1 + e)]);
            const hs = 4 / (3 * (1 + p.mucu)), hi = Math.max(...pts.map(q => q[1]), p.uball) * 1.1;
            const P = g.Plot({ xmin: 0.3, xmax: 1, ymin: 0, ymax: hi, xlabel: 'strike height ÷ edge', ylabel: 'least speed (m/s)', xfmt: v => v.toFixed(1), yfmt: v => v.toFixed(0) }).frame();
            P.clip(() => { if (hs > 0.3) { g.ctx.fillStyle = g.alpha(pk, .1); g.ctx.fillRect(P.x0, P.y1, P.X(Math.min(1, hs)) - P.x0, P.y0 - P.y1); P.vline(Math.min(1, hs), g.alpha(pk, .8), [4, 3]); }
              P.line(pts, gr, 2.2); P.dot(p.hhit, p.uball, 6, S.Cb.outcome === 'topples' ? gr : pk, th['ink-950']); if (isFinite(S.um.bench)) P.dot(p.hhit, S.um.bench, 3.5, am); });
            if (hs > 0.3) P.tag(0.31, hi * 0.9, hs < 1 ? 'pink: the edge slides during the blow (h < 4a/3(1 + μ))' : 'the edge slides at every height for this μ', pk, 'left', 0);
            P.tag(0.99, pts[pts.length - 1][1], 'edge holds: angular momentum about it', gr, 'right', -10);
            return;
          }
          if (p.mode === 'atwood') {
            const At = S.At, o = At.out, pts = f => o.map(q => [q[0], f(q)]);
            const KEt = q => 0.5 * (p.m1 + p.m2) * q[2] * q[2], KEr = q => 0.5 * At.I * q[3] * q[3];
            const dPE = q => (p.asub === 'hang' ? (p.m1 - p.m2) * Math.sign(At.a || 1) : p.m2) * G * Math.abs(q[1]), Wf = q => ((p.asub === 'hang' ? 0 : p.mutab * p.m1 * G) + p.tauAx / p.Rp) * Math.abs(q[1]);
            const hi = Math.max(0.01, ...o.map(dPE)) * 1.12;
            const P = g.Plot({ xmin: 0, xmax: At.tEnd, ymin: 0, ymax: hi, xlabel: 't (s)', ylabel: 'J', xfmt: v => v.toFixed(2), yfmt: v => v.toFixed(1) }).frame();
            P.clip(() => { P.line(pts(dPE), th.text, 2.4); P.line(pts(KEt), cy, 2); P.line(pts(KEr), gr, 2); P.line(pts(Wf), pk, 2); P.line(pts(q => KEt(q) + KEr(q) + Wf(q)), am, 1.6, [6, 3]); });
            P.tag(At.tEnd * 0.02, hi * 0.92, 'white: PE released · blue: KE of the masses · green: KE of the pulley · pink: friction · amber dashed: the sum', th['text-2'], 'left', 0);
            return;
          }
          if (p.mode === 'wound') {
            const r = p.rcyl, pts = [], cap = p.mucyl * p.Mcyl * G; for (let h = 0; h <= 2 * r + 1e-9; h += r / 40) { const w = woundAcc(Object.assign({}, p, { mucyl: 1e6 }), h); pts.push([h / r, w.F]); }
            const hi = Math.max(cap, ...pts.map(q => Math.abs(q[1]))) * 1.15;
            const P = g.Plot({ xmin: 0, xmax: 2, ymin: -hi, ymax: hi, xlabel: 'string height above the table ÷ r', ylabel: 'friction needed (N, + forward)', xfmt: v => v.toFixed(1), yfmt: v => v.toFixed(2) }).frame();
            P.clip(() => { g.ctx.fillStyle = g.alpha(gr, .1); g.ctx.fillRect(P.x0, P.Y(cap), P.x1 - P.x0, P.Y(-cap) - P.Y(cap)); P.hline(0, g.alpha(th['text-3'], .7)); P.line(pts, pk, 2.2); P.vline(1 + RBQ[p.cbody].k, g.alpha(am, .8), [3, 3]); P.dot(p.wsub === 'top' ? 2 : 1, S.Wn.F, 5.5, am, th['ink-950']); });
            P.tag(1 + RBQ[p.cbody].k, hi * 0.85, 'no friction at r(1 + k)', am, 'right', 0); P.tag(0.02, cap, 'green band: what μMg can supply', gr, 'left', -8);
            return;
          }
          const o = S.Bt.out, hi = Math.max(0.01, ...o.map(q => q[7])) * 1.1;
          const P = g.Plot({ xmin: 0, xmax: S.Bt.tEnd, ymin: 0, ymax: hi, xlabel: 't (s)', ylabel: 'J', xfmt: v => v.toFixed(1), yfmt: v => v.toFixed(2) }).frame();
          P.clip(() => { P.line(o.map(q => [q[0], q[7]]), th.text, 2.4); P.line(o.map(q => [q[0], q[5]]), cy, 2); P.line(o.map(q => [q[0], q[6]]), am, 2); P.line(o.map(q => [q[0], q[8]]), gr, 2); P.line(o.map(q => [q[0], q[9]]), pk, 2); P.line(o.map(q => [q[0], q[5] + q[6] + q[8] + q[9]]), '#B08AE8', 1.4, [6, 3]); });
          P.tag(S.Bt.tEnd * 0.98, hi * 0.93, 'white: motor work · blue/amber: KE of the pulleys · green: brake · pink: belt slip heat · violet dashed: the sum', th['text-2'], 'right', 0);
        } }
    ],

    readouts(S) {
      const p = S.p;
      if (p.mode === 'torque') { const T = S.Tq; return [{ label: 'L after the drive', value: T.LDrive.toFixed(4), unit: 'kg·m²/s', flag: 'accent' }, { label: 'Area under τ_net', value: T.areaDrive.toFixed(4), unit: 'N·m·s' }, { label: 'I', value: T.I.toFixed(4), unit: 'kg·m²' }, { label: 'Stops at', value: isFinite(T.tStop) ? T.tStop.toFixed(2) : '—', unit: 's' }]; }
      if (p.mode === 'cube') { const C = S.Cb; return [{ label: 'Outcome', value: C.outcome, unit: '', flag: C.outcome === 'topples' ? 'ok' : 'warn' }, { label: 'Least speed (formula)', value: S.um.form.toFixed(3), unit: 'm/s' }, { label: 'Least speed (bench)', value: isFinite(S.um.bench) ? S.um.bench.toFixed(3) : '—', unit: 'm/s' }, { label: 'Edge holds?', value: C.Im.stick ? 'yes' : 'no', unit: '' }]; }
      if (p.mode === 'atwood') { const A = S.At; return [{ label: 'a', value: A.a.toFixed(4), unit: 'm/s²', flag: 'accent' }, { label: 'T₁', value: A.T1.toFixed(3), unit: 'N' }, { label: 'T₂', value: A.T2.toFixed(3), unit: 'N' }, { label: p.asub === 'hang' ? 'T₁ − T₂' : 'T₂ − T₁', value: (p.asub === 'hang' ? A.T1 - A.T2 : A.T2 - A.T1).toFixed(4), unit: 'N' }]; }
      if (p.mode === 'wound') { const W = S.Wn; return [{ label: 'Cylinder a', value: W.a.toFixed(4), unit: 'm/s²', flag: 'accent' }, { label: 'Hanging a', value: W.aHang.toFixed(4), unit: 'm/s²' }, { label: 'Friction', value: W.F.toFixed(4), unit: 'N' }, { label: 'Rolls?', value: W.rolls ? 'yes' : 'slips', unit: '', flag: W.rolls ? 'ok' : 'warn' }]; }
      const B = S.Bt; return [{ label: 'Motor α (gripping)', value: B.gripA1.toFixed(3), unit: 'rad/s²', flag: 'accent' }, { label: 'Gear ratio ω₂/ω₁', value: B.n.toFixed(3), unit: '' }, { label: 'Slips above', value: B.tauSlip.toFixed(3), unit: 'N·m' }, { label: 'Slip heat', value: B.heat.toFixed(3), unit: 'J' }];
    },

    equation(S) {
      const p = S.p;
      if (p.mode === 'torque') return E.v('τ') + E.sub('net') + ' ' + E.op('=') + ' ' + E.frac(E.v('dL'), E.v('dt')) + ' · ' + E.op('∫') + E.v('τ') + E.sub('net') + ' ' + E.v('dt') + ' ' + E.op('=') + ' Δ' + E.v('L') + ' ' + E.op('=') + ' ' + E.n(S.Tq.LDrive, 'kg·m²/s');
      if (p.mode === 'cube') return E.v('J') + E.v('h') + ' ' + E.op('=') + ' ' + E.v('I') + E.sub('edge') + 'ω, ' + E.v('I') + E.sub('edge') + ' ' + E.op('=') + ' ⅔' + E.v('Ma') + '² · topples if ½' + E.v('I') + E.sub('edge') + 'ω² ' + E.op('≥') + ' ' + E.v('Mg') + E.v('a') + '(√2 − 1)/2 · edge holds if ' + E.v('h') + ' ' + E.op('≥') + ' ' + E.frac('4' + E.v('a'), '3(1 + μ)');
      if (p.mode === 'atwood') return E.v('a') + ' ' + E.op('=') + ' ' + E.frac('(' + E.v('m') + '₁ ' + E.op('−') + ' ' + E.v('m') + '₂)' + E.v('g'), E.v('m') + '₁ + ' + E.v('m') + '₂ + ' + E.v('I') + '/' + E.v('R') + '²') + ' ' + E.op('=') + ' ' + E.n(S.At.a, 'm/s²') + ' · (' + E.v('T') + '₁ − ' + E.v('T') + '₂)' + E.v('R') + ' ' + E.op('=') + ' ' + E.v('Iα');
      if (p.mode === 'wound') return p.wsub === 'top' ? E.v('a') + E.sub('hang') + ' ' + E.op('=') + ' 2' + E.v('a') + ' · ' + E.v('a') + ' ' + E.op('=') + ' ' + E.frac('2' + E.v('mg'), '4' + E.v('m') + ' + (1 + ' + E.v('k') + ')' + E.v('M')) + ' ' + E.op('=') + ' ' + E.n(S.Wn.a, 'm/s²')
        : E.v('a') + ' ' + E.op('=') + ' ' + E.frac(E.v('mg'), E.v('m') + ' + (1 + ' + E.v('k') + ')' + E.v('M')) + ' ' + E.op('=') + ' ' + E.n(S.Wn.a, 'm/s²');
      return E.v('α') + '₁ ' + E.op('=') + ' ' + E.frac(E.v('τ') + ' ' + E.op('−') + ' ' + E.v('τ') + E.sub('L') + E.v('r') + '₁/' + E.v('r') + '₂', E.v('I') + '₁ + ' + E.v('I') + '₂(' + E.v('r') + '₁/' + E.v('r') + '₂)²') + ' ' + E.op('=') + ' ' + E.n(S.Bt.gripA1, 'rad/s²');
    },

    eqNote: '<b>Impulse is the time integral; torque is the rate.</b> Everything on these benches is either Newton\'s second law in its ' +
      'rotational form, τ = dL/dt, or its integral over a blow, ∫τ dt = ΔL. A massive pulley needs a net torque, so the string on either side ' +
      'carries a different tension. A struck body turns about whatever point the floor can hold — and the floor can hold only as much impulsive ' +
      'friction as μ times its impulsive normal force.',

    problems: [
      { source: 'JEE Main pattern · angular impulse',
        q: 'A flywheel (a 4.0 kg disc of radius 0.30 m) is driven from rest by a steady motor torque of 2.0 N·m for 3.0 s, against a constant friction torque of 0.80 N·m. What is its angular momentum when the motor stops, in kg·m²/s?',
        params: { mode: 'torque', Mfw: 4, Rfw: 0.3, prof: 'const', tau0: 2, Tdr: 3, tauF: 0.8 },
        predict: { label: 'L', unit: 'kg·m²/s', tol: 0.01 },
        measure: S => S.Tq.LDrive,
        working: 'ΔL = ∫τ_net dt = (2.0 − 0.80) × 3.0 = <b>3.6 kg·m²/s</b>. The moment of inertia (0.18 kg·m²) is not needed for L, only for ω = 20 rad/s.' },
      { source: 'JEE Main pattern · coasting to rest',
        q: 'After the motor stops, how long does the friction take to bring it to rest, in s?',
        params: { mode: 'torque', Mfw: 4, Rfw: 0.3, prof: 'const', tau0: 2, Tdr: 3, tauF: 0.8 },
        predict: { label: 'time', unit: 's', tol: 0.01 },
        measure: S => S.Tq.tStop - 3,
        working: 'The friction\'s angular impulse must remove L: 0.80 × t = 3.6, so t = <b>4.5 s</b>.' },
      { source: 'JEE Advanced pattern · toppling a cube',
        q: 'A 200 g ball moving horizontally strikes the top edge of the back face of a 2.0 kg cube of edge 30 cm standing on a rough floor. The impact is perfectly inelastic along the line of impact (e = 0), and the ball then drops away. What is the least speed that topples the cube, in m/s?',
        params: { mode: 'cube', acube: 0.3, Mcu: 2, mball: 0.2, uball: 11, hhit: 1, ecube: 0, mucu: 0.6 },
        predict: { label: 'speed', unit: 'm/s', tol: 0.01 },
        measure: S => S.um.bench,
        working: 'The front edge holds, so about it the blow gives Ja = I_edge ω with I_edge = ⅔Ma² = 0.12 kg·m². To tip over, ½I_edge ω² = Mg·a(√2 − 1)/2, so ω = 4.51 rad/s and J = 1.80 N·s. With e = 0 the struck point and the ball end with equal speed: ωa = u − J/m, so <b>u = 1.35 + 9.02 = 10.4 m/s</b>. The bench finds it by striking again and again.' },
      { source: 'JEE Advanced pattern · will the edge hold?',
        q: 'For the cube on a floor with μ = 0.60, what is the lowest strike height (as a fraction of the edge) for which the front edge does not slip during the blow?',
        params: { mode: 'cube', acube: 0.3, Mcu: 2, mball: 0.2, uball: 11, hhit: 1, ecube: 0, mucu: 0.6 },
        predict: { label: 'h/a', unit: '', tol: 0.01 },
        measure: S => { let lo = 0.3, hi = 1; for (let i = 0; i < 40; i++) { const m = (lo + hi) / 2; if (cubeImpact(Object.assign({}, S.p, { hhit: m }), 5).stick) hi = m; else lo = m; } return (lo + hi) / 2; },
        working: 'If the edge holds, ω = Jh/I_edge and the centre moves at ω(a/2, a/2), so the edge supplies Jz = Mωa/2 up and Jx = J(3h/4a − 1) back. Holding needs |Jx| ≤ μJz: h ≥ 4a/3(1 + μ) = <b>0.833a</b>.' },
      { source: 'JEE Main pattern · the heavy pulley',
        q: 'Masses of 3.0 kg and 2.0 kg hang over a pulley that is a 2.0 kg uniform disc of radius 10 cm. What is their acceleration, in m/s²?',
        params: { mode: 'atwood', asub: 'hang', m1: 3, m2: 2, Mp: 2, Rp: 0.1, tauAx: 0 },
        predict: { label: 'a', unit: 'm/s²', tol: 0.01 },
        measure: S => S.At.a,
        working: 'a = (m₁ − m₂)g/(m₁ + m₂ + I/R²) with I/R² = ½M = 1.0 kg: a = 9.81/6 = <b>1.64 m/s²</b>.' },
      { source: 'JEE Advanced pattern · the two tensions',
        q: 'In the same machine, what is T₁ − T₂, in N?',
        params: { mode: 'atwood', asub: 'hang', m1: 3, m2: 2, Mp: 2, Rp: 0.1, tauAx: 0 },
        predict: { label: 'T₁ − T₂', unit: 'N', tol: 0.01 },
        measure: S => S.At.T1 - S.At.T2,
        working: '(T₁ − T₂)R = Iα = (I/R)a, so T₁ − T₂ = ½Ma = 1.0 × 1.635 = <b>1.64 N</b>. With a light pulley the tensions would be equal.' },
      { source: 'JEE Advanced pattern · pulled from the top',
        q: 'A 2.0 kg solid cylinder rolls on a table, pulled by a string wound round it and leaving from its top, over a light pulley to a hanging 0.50 kg mass. What is the hanging mass\'s acceleration, in m/s²?',
        params: { mode: 'wound', wsub: 'top', cbody: 'cylinder', Mcyl: 2, rcyl: 0.1, mhang: 0.5, mucyl: 0.5 },
        predict: { label: 'a', unit: 'm/s²', tol: 0.01 },
        measure: S => S.Wn.aHang,
        working: 'For the cylinder, Ma = T + f and ½Ma = T − f (torques about the centre, with rolling). Adding: 1.5Ma = 2T. The string end moves at 2a, so m(2a) = mg − T. Hence a = 2mg/(4m + 1.5M) = 1.96 m/s² and the hanging mass falls at <b>3.92 m/s²</b>.' },
      { source: 'JEE Advanced pattern · where friction vanishes',
        q: 'At what height above the table (as a multiple of the radius) must a horizontal string pull a rolling solid cylinder so that no friction is needed?',
        params: { mode: 'wound', wsub: 'top', cbody: 'cylinder', Mcyl: 2, rcyl: 0.1, mhang: 0.5, mucyl: 0.5 },
        predict: { label: 'h/r', unit: '', tol: 0.01 },
        measure: S => { let lo = 0, hi = 2 * S.p.rcyl; const f = h => woundAcc(Object.assign({}, S.p, { mucyl: 1e6 }), h).F; for (let i = 0; i < 50; i++) { const m = (lo + hi) / 2; if (Math.sign(f(m)) === Math.sign(f(lo))) lo = m; else hi = m; } return (lo + hi) / 2 / S.p.rcyl; },
        working: 'With f = 0: Ma = T and Iα = T(h − r) with a = rα give kMr·a = T(h − r) = Ma(h − r), so h = r(1 + k) = <b>1.5r</b>, the centre of percussion measured from the contact point.' },
      { source: 'JEE Advanced pattern · a belt drive',
        q: 'A motor pulley (2.0 kg disc, r = 5.0 cm) drives a load pulley (8.0 kg disc, r = 15 cm) by a belt that does not slip. The motor torque is 0.30 N·m and the load has a friction torque of 0.20 N·m. What is the motor pulley\'s angular acceleration, in rad/s²?',
        params: { mode: 'belt', r1b: 0.05, r2b: 0.15, M1b: 2, M2b: 8, taum: 0.3, Tdrb: 2, tauLb: 0.2, T0b: 20, mubelt: 0.3 },
        predict: { label: 'α₁', unit: 'rad/s²', tol: 0.01 },
        measure: S => { const o = S.Bt.out, a = o.find(q => q[0] >= 0.5), b = o.find(q => q[0] >= 1.5); return (b[1] - a[1]) / (b[0] - a[0]); },
        working: 'Belt speed common: α₂ = α₁r₁/r₂. Eliminating the tension difference: α₁ = (τ − τ_load r₁/r₂)/(I₁ + I₂(r₁/r₂)²) = (0.30 − 0.0667)/(0.0025 + 0.010) = <b>18.7 rad/s²</b>.' }
    ],

    walkthrough: [
      { title: '1 · The area is the change in L',
        body: 'A flywheel driven by a short, hard pulse of torque.',
        ask: 'Does it matter how the torque is shaped in time?',
        reveal: '<b>Only the area counts.</b> A tall short pulse and a long gentle push with the same area under the τ–t curve give the same ΔL.',
        params: { mode: 'torque', prof: 'pulse', tau0: 12, Tdr: 3, tauF: 0.8 } },
      { title: '2 · The cube tips',
        body: 'A ball of clay strikes the top of a cube fast enough.',
        ask: 'What is conserved during the blow, and about which point?',
        reveal: '<b>Angular momentum about the front edge.</b> The edge\'s impulsive forces act there, so they have no moment about it. Gravity is not impulsive.',
        params: { mode: 'cube', uball: 11, hhit: 1, mucu: 0.6, ecube: 0 } },
      { title: '3 · Struck low, it slides',
        body: 'The same cube struck at mid-height on a slippery floor.',
        ask: 'Why doesn\'t it pivot?',
        reveal: '<b>The edge cannot hold.</b> Pivoting would need an impulsive friction J(1 − 3h/4a) backward, but the floor can give only μ times the impulsive normal. Below h = 4a/3(1 + μ), it slides.',
        params: { mode: 'cube', uball: 11, hhit: 0.5, mucu: 0.3, ecube: 0 } },
      { title: '4 · A pulley with mass',
        body: 'The Atwood machine with a heavy pulley, then a light one.',
        ask: 'When are the two tensions equal?',
        reveal: '<b>Only when the pulley is massless (and frictionless).</b> A pulley with inertia needs a net torque (T₁ − T₂)R = Iα to spin up with the string.',
        params: { mode: 'atwood', asub: 'hang', m1: 3, m2: 2, Mp: 2, Rp: 0.1, tauAx: 0 } },
      { title: '5 · Pulled from the top',
        body: 'A cylinder pulled by a string from its top, then a ring.',
        ask: 'Which way does friction act on each?',
        reveal: '<b>Forward on the cylinder; none at all on the ring.</b> Friction vanishes when the pull is at r(1 + k) above the table — the top, for a ring.',
        params: { mode: 'wound', wsub: 'top', cbody: 'ring', Mcyl: 2, mhang: 0.5 } },
      { title: '6 · A belt that slips',
        body: 'Too much motor torque for the belt\'s grip.',
        ask: 'What limits the torque a belt can carry?',
        reveal: '<b>The capstan limit.</b> The tight and slack tensions can differ by at most a factor e^{μθ}. Past that the belt slips, and energy goes into heat.',
        params: { mode: 'belt', taum: 0.5, Tdrb: 1.5, T0b: 4, mubelt: 0.3 } }
    ],

    quiz: [
      { q: 'The area under a torque–time graph gives:',
        options: ['The change in angular momentum', 'The work done', 'The angular velocity', 'The power'], answer: 0, why: 'τ = dL/dt, so ∫τ dt = ΔL.' },
      { q: 'A ball strikes a cube that pivots about its front edge. During the blow, which quantity is conserved?',
        options: ['Angular momentum about the front edge', 'Linear momentum', 'Kinetic energy', 'Angular momentum about the centre'], answer: 0, why: 'The edge forces have no moment about the edge; they do change linear momentum.' },
      { q: 'In an Atwood machine with a massive pulley, compared with a light pulley the acceleration is:',
        options: ['Smaller', 'Larger', 'The same', 'Zero'], answer: 0, why: 'The denominator gains I/R².' },
      { q: 'A cylinder on a table is pulled by a string from its top, over a pulley to a hanging mass. The hanging mass accelerates at:',
        options: ['Twice the cylinder\'s centre', 'The same as the centre', 'Half the centre', 'g'], answer: 0, why: 'The top of a rolling body moves at 2v.' },
      { q: 'A horizontal pull on a rolling solid cylinder needs no friction if applied at a height of:',
        options: ['1.5r', 'r', '2r', '0.5r'], answer: 0, why: 'h = r(1 + k), k = ½.' },
      { q: 'A belt drive connects r₁ = 5 cm to r₂ = 15 cm. While it grips, ω₂/ω₁ is:',
        options: ['1/3', '3', '1', '1/9'], answer: 0, why: 'Equal rim speeds: ω₁r₁ = ω₂r₂.' }
    ],

    notes: '<b>Where this shows up in the paper.</b><ul>' +
      '<li><b>Angular impulse</b>: ∫τ dt = ΔL; the area under τ–t; friction torque removes L at a steady rate.</li>' +
      '<li><b>Collisions with rotation</b>: take angular momentum about the point whose impulsive force is unknown (the pivot, the edge); check the pivot can hold (impulsive friction ≤ μ × impulsive normal).</li>' +
      '<li><b>Toppling after a blow</b>: ½I_edge ω² must lift the centre over the edge: Mg·(a/√2 − a/2) for a cube.</li>' +
      '<li><b>Massive pulleys</b>: tensions differ by Iα/R; a = Δm g/(Σm + I/R²).</li>' +
      '<li><b>Wound strings</b>: relate accelerations through the point where the string leaves; friction is an unknown and vanishes at h = r(1 + k).</li>' +
      '<li><b>Belts and gears</b>: equal rim speeds; reflect inertias through (r₁/r₂)².</li></ul>' +
      '<div class="pyq"><em>Trap to avoid</em> — taking T₁ = T₂ over a pulley that has mass.</div>' +
      '<div class="pyq"><em>Trap to avoid</em> — conserving kinetic energy in the blow. Only angular momentum about the pivot survives an inelastic impact.</div>'
  });
})(window.InsightLab);
