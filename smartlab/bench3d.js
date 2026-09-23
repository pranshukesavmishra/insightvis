/* ============================================================
   BENCH — laboratory apparatus, built on R3.

   R3 draws lit primitives. This layer turns them into the things a
   student actually meets on a physics bench: a wooden table, clamp
   stands, pulleys with a rim and spokes, graduated rules, digital
   meters that show a live reading, photogates with a beam, springs.
   Surfaces carry procedural textures (wood grain, brushed metal)
   mapped onto the faces and then lit, so a block reads as a wooden
   block rather than a coloured cube.

   Every piece is submitted to the caller's R3 frame, so it depth-sorts
   with everything else. Z is up.
   ============================================================ */
(function () {
  'use strict';
  const R3 = window.R3, RX = window.RX;
  const TAU = Math.PI * 2;
  const { add, sub, scale, norm, cross, dot, perp } = R3;

  /* ---------------- procedural textures, cached ---------------- */
  const cache = {};
  function rng(seed) {
    let s = seed >>> 0 || 1;
    return () => { s ^= s << 13; s ^= s >>> 17; s ^= s << 5; return ((s >>> 0) % 100000) / 100000; };
  }
  function canvas(w, h) {
    const c = document.createElement('canvas'); c.width = w; c.height = h; return c;
  }
  /* wood: long grain lines with slow waviness and a few darker streaks */
  function wood(tone, seed) {
    const key = 'w' + tone + seed;
    if (cache[key]) return cache[key];
    const c = canvas(512, 128), x = c.getContext('2d'), r = rng(seed || 7);
    x.fillStyle = tone; x.fillRect(0, 0, 512, 128);
    for (let i = 0; i < 90; i++) {
      const y0 = r() * 128, amp = 1 + r() * 4, fr = 0.004 + r() * 0.01, ph = r() * TAU;
      const dark = r() < 0.5;
      x.strokeStyle = RX.rgba(dark ? '#2A160A' : '#FFE2B8', 0.05 + r() * 0.10);
      x.lineWidth = 0.6 + r() * 1.6;
      x.beginPath();
      for (let u = 0; u <= 512; u += 8) {
        const y = y0 + Math.sin(u * fr + ph) * amp + Math.sin(u * fr * 3.1 + ph) * amp * 0.3;
        u ? x.lineTo(u, y) : x.moveTo(u, y);
      }
      x.stroke();
    }
    // a couple of knots
    for (let k = 0; k < 2; k++) {
      const kx = 60 + r() * 390, ky = 20 + r() * 88;
      for (let j = 6; j > 0; j--) {
        x.strokeStyle = RX.rgba('#2A160A', 0.08 + j * 0.02);
        x.beginPath(); x.ellipse(kx, ky, j * 5, j * 1.8, 0, 0, TAU); x.stroke();
      }
    }
    return (cache[key] = c);
  }
  /* brushed metal: fine horizontal streaks over a base tone */
  function metal(tone, seed) {
    const key = 'm' + tone + seed;
    if (cache[key]) return cache[key];
    const c = canvas(256, 128), x = c.getContext('2d'), r = rng(seed || 3);
    x.fillStyle = tone; x.fillRect(0, 0, 256, 128);
    for (let i = 0; i < 260; i++) {
      x.strokeStyle = RX.rgba(r() < 0.5 ? '#FFFFFF' : '#000000', 0.03 + r() * 0.05);
      x.lineWidth = 0.5 + r();
      const y = r() * 128, x0 = r() * 256;
      x.beginPath(); x.moveTo(x0, y); x.lineTo(x0 + 30 + r() * 140, y + (r() - 0.5)); x.stroke();
    }
    return (cache[key] = c);
  }
  /* a metre rule face: cm ticks, 5 cm and 10 cm marks, numbers every 10 cm */
  function ruleTex(cm, from) {
    const key = 'r' + cm + '|' + from;
    if (cache[key]) return cache[key];
    const px = 12, W = Math.round(cm * px), H = 64;
    const c = canvas(W, H), x = c.getContext('2d');
    const gr = x.createLinearGradient(0, 0, 0, H);
    gr.addColorStop(0, '#E8D9A8'); gr.addColorStop(1, '#CDB980');
    x.fillStyle = gr; x.fillRect(0, 0, W, H);
    x.strokeStyle = '#1B1B1B'; x.fillStyle = '#1B1B1B';
    for (let i = 0; i <= cm * 10; i++) {
      const u = i / 10 * px, len = i % 100 === 0 ? 28 : i % 50 === 0 ? 20 : i % 10 === 0 ? 14 : 6;
      x.lineWidth = i % 10 === 0 ? 1.4 : 0.7;
      x.beginPath(); x.moveTo(u, 0); x.lineTo(u, len); x.stroke();
      if (i % 100 === 0 && i > 0 && i < cm * 10) {
        x.font = 'bold 15px "IBM Plex Mono",monospace'; x.textAlign = 'center'; x.textBaseline = 'top';
        x.fillText(String((from || 0) + i / 10), u, 32);
      }
    }
    return (cache[key] = c);
  }

  /* map an image onto a projected parallelogram face (affine; the faces
     here are small enough on screen that perspective error is invisible),
     subdividing large faces so it stays true */
  function faceTex(ctx, cam, img, P0, P1, P3, n, shade, alpha) {
    // n tiles each way, or [along P0→P1, along P0→P3]: a long thin face needs cutting only along its length
    const nu = Array.isArray(n) ? n[0] : (n || 1), nv = Array.isArray(n) ? n[1] : (n || 1);
    const E1 = sub(P1, P0), E2 = sub(P3, P0);
    /* One affine map per tile cannot follow a perspective quad: its fourth
       corner misses, and from a steep angle that shows as dark wedges. Each
       tile is therefore drawn as two triangles, each mapped exactly (an
       affine map is exact on a triangle), with the clip grown a hair so
       neighbours overlap instead of leaving a hairline between them. */
    const tri = (s, d) => {
      const [sx0, sy0, sx1, sy1, sx2, sy2] = s;
      let [x0, y0, x1, y1, x2, y2] = d;
      const gx = (x0 + x1 + x2) / 3, gy = (y0 + y1 + y2) / 3;
      const gr = (x, y) => { const dx = x - gx, dy = y - gy, l = Math.hypot(dx, dy) || 1; return [x + dx / l * 0.9, y + dy / l * 0.9]; };
      const A = gr(x0, y0), B = gr(x1, y1), C = gr(x2, y2);
      const den = sx0 * (sy2 - sy1) - sx1 * sy2 + sx2 * sy1 + (sx1 - sx2) * sy0;
      if (!den) return;
      ctx.save();
      ctx.beginPath(); ctx.moveTo(A[0], A[1]); ctx.lineTo(B[0], B[1]); ctx.lineTo(C[0], C[1]); ctx.closePath(); ctx.clip();
      ctx.transform(
        -(sy0 * (x2 - x1) - sy1 * x2 + sy2 * x1 + (sy1 - sy2) * x0) / den,
         (sy1 * y2 + sy0 * (y1 - y2) - sy2 * y1 + (sy2 - sy1) * y0) / den,
         (sx0 * (x2 - x1) - sx1 * x2 + sx2 * x1 + (sx1 - sx2) * x0) / den,
        -(sx1 * y2 + sx0 * (y1 - y2) - sx2 * y1 + (sx2 - sx1) * y0) / den,
         (sx0 * (sy2 * x1 - sy1 * x2) + sy0 * (sx1 * x2 - sx2 * x1) + (sx2 * sy1 - sx1 * sy2) * x0) / den,
         (sx0 * (sy2 * y1 - sy1 * y2) + sy0 * (sx1 * y2 - sx2 * y1) + (sx2 * sy1 - sx1 * sy2) * y0) / den);
      // only the part of the texture under this triangle, padded a little
      const ux0 = Math.max(0, Math.floor(Math.min(sx0, sx1, sx2)) - 2), vy0 = Math.max(0, Math.floor(Math.min(sy0, sy1, sy2)) - 2);
      const ux1 = Math.min(img.width, Math.ceil(Math.max(sx0, sx1, sx2)) + 2), vy1 = Math.min(img.height, Math.ceil(Math.max(sy0, sy1, sy2)) + 2);
      if (ux1 > ux0 && vy1 > vy0) ctx.drawImage(img, ux0, vy0, ux1 - ux0, vy1 - vy0, ux0, vy0, ux1 - ux0, vy1 - vy0);
      ctx.restore();
    };
    const W = img.width, H = img.height;
    for (let j = 0; j < nv; j++) for (let i = 0; i < nu; i++) {
      const a = add(P0, add(scale(E1, i / nu), scale(E2, j / nv)));
      const b = add(a, scale(E1, 1 / nu)), d = add(a, scale(E2, 1 / nv)), cc = add(b, scale(E2, 1 / nv));
      const qa = cam.project(a), qb = cam.project(b), qd = cam.project(d), qc = cam.project(cc);
      if (!qa.ok || !qb.ok || !qd.ok || !qc.ok) continue;
      const u0 = i / nu * W, u1 = (i + 1) / nu * W, v0 = j / nv * H, v1 = (j + 1) / nv * H;
      ctx.save();
      if (alpha != null) ctx.globalAlpha = alpha;
      tri([u0, v0, u1, v0, u1, v1], [qa.x, qa.y, qb.x, qb.y, qc.x, qc.y]);
      tri([u0, v0, u1, v1, u0, v1], [qa.x, qa.y, qc.x, qc.y, qd.x, qd.y]);
      ctx.restore();
    }
    // the lighting goes on once over the whole face: per tile it doubles up along the shared edges
    if (shade) {
      const c0 = cam.project(P0), c1 = cam.project(P1), c3 = cam.project(P3), c2 = cam.project(add(P1, E2));
      if (c0.ok && c1.ok && c2.ok && c3.ok) {
        ctx.save(); ctx.fillStyle = shade;
        ctx.beginPath(); ctx.moveTo(c0.x, c0.y); ctx.lineTo(c1.x, c1.y); ctx.lineTo(c2.x, c2.y); ctx.lineTo(c3.x, c3.y); ctx.closePath(); ctx.fill();
        ctx.restore();
      }
    }
  }
  /* the darkening a face of normal n receives, as an overlay colour */
  function shadeOverlay(F, n, amb) {
    const l = Math.max(0, dot(n, R3.LIGHT));
    const k = amb + (1 - amb) * Math.pow(l, 0.85);
    const d = Math.max(0, 1 - k);
    if (l > 0.85) return 'rgba(255,255,255,' + ((l - 0.85) * 0.9).toFixed(3) + ')';
    return 'rgba(5,8,15,' + (d * 0.92).toFixed(3) + ')';
  }

  /* a box whose faces carry a texture. tex may be one image or
     { top, side, end } images. Faces are sorted individually, like R3.box. */
  function texBox(F, centre, size, tex, o) {
    o = o || {};
    const ctx = F.ctx, cam = F.cam;
    const ax = o.axes || [[1, 0, 0], [0, 1, 0], [0, 0, 1]];
    const half = [scale(ax[0], size[0] / 2), scale(ax[1], size[1] / 2), scale(ax[2], size[2] / 2)];
    const amb = o.ambient == null ? 0.42 : o.ambient;
    const pick = (axis) => typeof tex === 'object' && !tex.getContext && !tex.width
      ? (axis === 2 ? tex.top : axis === 1 ? tex.side : tex.end) || tex.top : tex;
    [[0, 1], [0, -1], [1, 1], [1, -1], [2, 1], [2, -1]].forEach(([axis, sgn]) => {
      if (o.skipBottom && axis === 2 && sgn < 0) return;
      const n = scale(ax[axis], sgn);
      const c = add(centre, scale(half[axis], sgn));
      // long axis of the face first, so grain runs along the long edge
      let e1 = half[(axis + 1) % 3], e2 = half[(axis + 2) % 3];
      if (Math.hypot(e2[0], e2[1], e2[2]) > Math.hypot(e1[0], e1[1], e1[2])) { const t = e1; e1 = e2; e2 = t; }
      const P0 = sub(sub(c, e1), e2), P1 = add(sub(c, e2), e1), P3 = add(sub(c, e1), e2);
      const img = pick(axis), sh = shadeOverlay(F, n, amb);
      const long = Math.max(size[0], size[1], size[2]);
      // tiles per edge from that edge's own length, capped by o.tiles
      const l1 = 2 * Math.hypot(e1[0], e1[1], e1[2]), l2 = 2 * Math.hypot(e2[0], e2[1], e2[2]), cap = o.tiles || (long > 1.2 ? 3 : 1);
      const nt = [Math.max(1, Math.min(cap, Math.ceil(l1 / 0.8))), Math.max(1, Math.min(cap, Math.ceil(l2 / 0.8)))];
      F.push(c, () => {
        faceTex(ctx, cam, img, P0, P1, P3, nt, sh);
        if (o.edges !== false) {
          const q = [P0, P1, add(P1, sub(P3, P0)), P3].map(p => cam.project(p));
          if (q.every(x => x.ok)) {
            ctx.strokeStyle = 'rgba(5,8,15,.55)'; ctx.lineWidth = 0.8;
            ctx.beginPath(); q.forEach((x, k) => k ? ctx.lineTo(x.x, x.y) : ctx.moveTo(x.x, x.y));
            ctx.closePath(); ctx.stroke();
          }
        }
      }, o.bias);
    });
  }

  /* ---------------- the bench itself ---------------- */
  function table(F, x0, x1, y0, y1, topZ, o) {
    o = o || {};
    const th = o.thick || 0.06;
    texBox(F, [(x0 + x1) / 2, (y0 + y1) / 2, topZ - th / 2], [x1 - x0, y1 - y0, th],
           wood(o.tone || '#8A5A32', o.seed || 11), { bias: F.GROUND, tiles: 4, ambient: 0.5 });
    if (o.legs !== false) {
      const lz = topZ - th, lh = o.legH || 0.55, inset = 0.08;
      [[x0 + inset, y0 + inset], [x1 - inset, y0 + inset], [x0 + inset, y1 - inset], [x1 - inset, y1 - inset]]
        .forEach(q => R3.box(F, [q[0], q[1], lz - lh / 2], [0.06, 0.06, lh], '#5A3A20',
                             { shadow: false, ambient: 0.3, bias: F.GROUND }));
    }
  }

  /* ---------------- stands, clamps, rods ---------------- */
  function clampStand(F, base, height, o) {
    o = o || {};
    const steel = o.rod || '#B8C2D0';
    R3.box(F, [base[0], base[1], base[2] + 0.012], [0.26, 0.16, 0.024], '#2C3445', { shadow: false, ambient: 0.35 });
    R3.cylinder(F, [base[0] - 0.06, base[1], base[2] + 0.02], [base[0] - 0.06, base[1], base[2] + height], 0.011, steel,
                { segments: 14, shadow: false, ambient: 0.45 });
    return [base[0] - 0.06, base[1], base[2] + height];
  }
  function bossClamp(F, at, o) {
    R3.box(F, at, [0.05, 0.05, 0.045], (o && o.colour) || '#3A4458', { shadow: false, ambient: 0.4 });
    R3.cylinder(F, [at[0], at[1] - 0.025, at[2]], [at[0], at[1] - 0.05, at[2]], 0.009, '#C9A04A',
                { segments: 10, shadow: false, ambient: 0.5 });
  }

  /* ---------------- a pulley: grooved rim, flanges, spokes, hub, axle ----------------
     axis is the axle direction; phase turns the spokes so rotation shows. */
  function pulley(F, centre, axisIn, r, o) {
    o = o || {};
    const axis = norm(axisIn), w = o.width || r * 0.34;
    const A = add(centre, scale(axis, -w / 2)), B = add(centre, scale(axis, w / 2));
    const rim = o.colour || '#A7B3C6';
    // flanges either side of the groove, a little bigger than the groove floor
    R3.cylinder(F, A, add(A, scale(axis, w * 0.22)), r * 1.08, rim,
                { segments: 36, inner: r * 0.72, shadow: false, ambient: 0.45, spokes: 0 });
    R3.cylinder(F, add(B, scale(axis, -w * 0.22)), B, r * 1.08, rim,
                { segments: 36, inner: r * 0.72, shadow: false, ambient: 0.45 });
    // groove floor
    R3.cylinder(F, add(A, scale(axis, w * 0.22)), add(B, scale(axis, -w * 0.22)), r, RX.mix(rim, '#05080F', 0.25),
                { segments: 36, inner: r * 0.74, caps: false, shadow: false, ambient: 0.35 });
    // spokes and hub, turning with phase
    const u = perp(axis), v = cross(axis, u), ph = o.phase || 0;
    for (let k = 0; k < (o.spokes || 5); k++) {
      const a = ph + k / (o.spokes || 5) * TAU;
      const d = add(scale(u, Math.cos(a)), scale(v, Math.sin(a)));
      R3.cylinder(F, add(centre, scale(d, r * 0.16)), add(centre, scale(d, r * 0.74)), r * 0.055,
                  RX.mix(rim, '#05080F', 0.15), { segments: 8, caps: false, shadow: false, ambient: 0.4 });
    }
    R3.cylinder(F, add(centre, scale(axis, -w * 0.45)), add(centre, scale(axis, w * 0.45)), r * 0.18, '#6B7890',
                { segments: 18, shadow: false, ambient: 0.4, spokes: 0 });
    // the axle, and a reference mark so one turn can be counted
    R3.cylinder(F, add(centre, scale(axis, -w * 0.9)), add(centre, scale(axis, w * 0.9)), r * 0.06, '#D0D8E4',
                { segments: 10, shadow: false, ambient: 0.5 });
    const mk = add(add(centre, scale(axis, w / 2 + 0.002)), scale(add(scale(u, Math.cos(ph)), scale(v, Math.sin(ph))), r * 0.9));
    R3.sphere(F, mk, r * 0.07, '#FFD36B', { shadow: false });
  }

  /* ---------------- a graduated metre rule lying along dir ---------------- */
  function rule(F, start, dir, lengthM, o) {
    o = o || {};
    const k = o.k || 1;                            // scene units per metre
    const d = norm(dir), up = o.up || [0, 0, 1], side = scale(norm(cross(up, d)), o.flip ? -1 : 1);
    const L = lengthM * k, w = o.width || 0.05, t = 0.008;
    const cm = Math.round(lengthM * 100);
    const img = ruleTex(cm, o.from || 0);
    const c = add(add(start, scale(d, L / 2)), scale(up, t / 2));
    const P0 = add(add(start, scale(side, -w / 2)), scale(up, t)), P1 = add(P0, scale(d, L)), P3 = add(P0, scale(side, w));
    F.push(c, () => faceTex(F.ctx, F.cam, img, P0, P1, P3, Math.max(1, Math.round(cm / 25)),
                            shadeOverlay(F, up, 0.55)), o.bias == null ? -0.01 : o.bias);
  }

  /* ---------------- a digital meter with a live reading ----------------
     at: centre of the display; facing: outward normal of the face;
     the body is drawn behind it, the LCD is a texture regenerated from
     the value each frame. */
  function lcdTex(title, value, unit, colour) {
    const c = canvas(240, 110), x = c.getContext('2d');
    x.fillStyle = '#0A1410'; x.fillRect(0, 0, 240, 110);
    const gr = x.createLinearGradient(0, 0, 0, 110);
    gr.addColorStop(0, 'rgba(255,255,255,.06)'); gr.addColorStop(1, 'rgba(0,0,0,.2)');
    x.fillStyle = gr; x.fillRect(0, 0, 240, 110);
    x.fillStyle = RX.rgba(colour, 0.75); x.font = '600 17px "IBM Plex Mono",monospace';
    x.textAlign = 'left'; x.textBaseline = 'top'; x.fillText(title, 12, 8);
    x.shadowColor = colour; x.shadowBlur = 10;
    x.fillStyle = colour; x.font = '700 44px "IBM Plex Mono",monospace'; x.textAlign = 'right';
    x.fillText(value, 228 - (unit ? 44 : 0), 40);
    x.shadowBlur = 0;
    if (unit) { x.font = '600 18px "IBM Plex Mono",monospace'; x.fillText(unit, 228, 64); }
    return c;
  }
  function meter(F, at, facing, w, h, o) {
    o = o || {};
    const n = norm(facing), up = o.up || [0, 0, 1];
    const right = norm(cross(up, n)), upv = norm(cross(n, right));
    const depth = o.depth || 0.05;
    // the case
    R3.box(F, add(at, scale(n, -depth / 2 - 0.003)), [w + 0.03, h + 0.03, depth].map((v, i) => v),
           o.body || '#252C3A', { shadow: false, ambient: 0.4, axes: [right, upv, n] });
    const img = lcdTex(o.title || '', o.value == null ? '' : String(o.value), o.unit || '', o.colour || '#7CF0B0');
    const P0 = add(add(at, scale(right, -w / 2)), scale(upv, h / 2));
    const P1 = add(P0, scale(right, w)), P3 = add(P0, scale(upv, -h));
    F.push(add(at, scale(n, 0.002)), () => faceTex(F.ctx, F.cam, img, P0, P1, P3, 1, null), -0.02);
  }

  /* ---------------- a photogate: a U-frame with a beam across ---------------- */
  function photogate(F, at, beamDir, gap, o) {
    o = o || {};
    const d = norm(beamDir), up = [0, 0, 1], along = norm(cross(up, d));
    const hgt = o.height || 0.16, arm = 0.03;
    const A = add(at, scale(d, -gap / 2)), B = add(at, scale(d, gap / 2));
    [A, B].forEach(p => R3.box(F, add(p, [0, 0, hgt / 2]), [0.03, 0.03, hgt], o.colour || '#2F3A52',
                               { shadow: false, ambient: 0.4, axes: [d, along, up] }));
    R3.box(F, add(at, [0, 0, -0.01]), [gap + 0.06, 0.04, 0.02], o.colour || '#2F3A52',
           { shadow: false, ambient: 0.4, axes: [d, along, up] });
    const z = o.beamZ == null ? hgt * 0.62 : o.beamZ;
    R3.sphere(F, add(A, [0, 0, z]), 0.008, o.blocked ? '#FF3B3B' : '#FF7A7A', { shadow: false, vivid: true });
    if (!o.blocked)
      R3.polyline(F, [add(A, [0, 0, z]), add(B, [0, 0, z])], '#FF4B4B', { alpha: .85, width: 1.6, bias: -0.02 });
    void arm;
  }

  /* ---------------- a helical spring between two points ---------------- */
  function spring(F, a, b, radius, turns, o) {
    o = o || {};
    const ax = sub(b, a), L = Math.hypot(ax[0], ax[1], ax[2]);
    if (L < 1e-6) return;
    R3.coil(F, scale(add(a, b), 0.5), ax, radius, L, turns, o.wire || radius * 0.12, o.colour || '#C8D2E0',
            { bias: o.bias });
  }

  /* a taut string: a thin dark-cored tube reads better than a line */
  function string(F, pts, o) {
    o = o || {};
    R3.tube(F, pts, o.r || 0.004, o.colour || '#E8E2D0', { segments: 6, round: false, bias: o.bias });
  }

  window.BENCH = { wood, metal, ruleTex, faceTex, texBox, table, clampStand, bossClamp, pulley, rule,
                   meter, lcdTex, photogate, spring, string, shadeOverlay };
})();
