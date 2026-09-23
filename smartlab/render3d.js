/* ============================================================
   R3 — the 3D apparatus layer.

   The engine has had a working camera since v2 and not one lab
   used it, so every physics bench was a lit diagram rather than
   an object you can walk round. This is the counterpart of
   render.js: a depth-sorted set of primitives that turn the
   camera into real equipment.

   Everything is submitted to a frame buffer, sorted back to
   front by camera depth, and drawn in one pass — so a coil can
   pass in front of a magnet and behind a bracket without the
   caller thinking about order.

   Convention: Z is up, matching lab-core's Camera.
   ============================================================ */
(function () {
  'use strict';
  const TAU = Math.PI * 2;
  const RX = window.RX;
  const mix = RX.mix, rgba = RX.rgba, sat = RX.sat;

  /* the light, in world space, up and over the viewer's left shoulder */
  const LIGHT = norm([-0.45, -0.55, 0.70]);

  function norm(v) { const l = Math.hypot(v[0], v[1], v[2]) || 1; return [v[0] / l, v[1] / l, v[2] / l]; }
  function sub(a, b) { return [a[0] - b[0], a[1] - b[1], a[2] - b[2]]; }
  function add(a, b) { return [a[0] + b[0], a[1] + b[1], a[2] + b[2]]; }
  function scale(a, k) { return [a[0] * k, a[1] * k, a[2] * k]; }
  function dot(a, b) { return a[0] * b[0] + a[1] * b[1] + a[2] * b[2]; }
  function cross(a, b) {
    return [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
  }
  /* any unit vector perpendicular to n, chosen so it never degenerates */
  function perp(n) {
    const a = Math.abs(n[2]) < 0.9 ? [0, 0, 1] : [1, 0, 0];
    return norm(cross(n, a));
  }

  /* =====================================================================
     THE FRAME — open one per drawStage, submit primitives, then render.
     ===================================================================== */
  function Frame(ctx, cam, o) {
    o = o || {};
    const items = [];
    const F = {
      ctx: ctx, cam: cam,
      ambient: o.ambient == null ? 0.26 : o.ambient,
      floorZ: o.floorZ == null ? null : o.floorZ,
      items: items
    };

    F.project = p => cam.project(p);
    /* depth of a world point, used as the sort key */
    const depth = p => {
      const v = sub(p, cam.eye);
      return v[0] * cam.f[0] + v[1] * cam.f[1] + v[2] * cam.f[2];
    };
    F.depth = depth;
    F.push = (at, draw, bias) => {
      items.push({ z: depth(at) + (bias || 0), draw: draw });
    };

    /* A large flat quad cannot be depth-sorted against small objects resting
       ON it from a single key: the painter's algorithm draws the whole quad
       either wholly in front of or wholly behind each object, so a near wall
       paints straight over the bodies standing on the far side of it.
       Ground geometry therefore declares itself, and is pushed behind
       everything that is not ground. GROUND is much larger than any scene
       depth, so the ordering WITHIN the bench is preserved. */
    F.GROUND = 1e4;
    F.SKY = -1e4;

    /* the lit colour of a surface whose outward normal is n */
    F.shade = (colour, n, o2) => {
      o2 = o2 || {};
      const base = o2.vivid === false ? colour : sat(colour, 1.18);
      const l = Math.max(0, dot(n, LIGHT));
      const amb = o2.ambient == null ? F.ambient : o2.ambient;
      const k = amb + (1 - amb) * Math.pow(l, 0.85);
      // a cool bounce from below keeps shadow sides from going dead black
      const up = Math.max(0, -n[2]) * 0.18;
      let c = mix(mix(base, '#05080F', 1 - Math.min(1, k)), '#2E4A72', up);
      if (l > 0.82 && o2.spec !== false) c = mix(c, '#ffffff', (l - 0.82) * 1.9);
      return c;
    };

    /* a soft contact shadow on the floor plane */
    F.shadow = (centre, radius, strength) => {
      if (F.floorZ == null) return;
      const gap = Math.max(0, centre[2] - F.floorZ);
      const k = Math.max(0, 1 - gap / (radius * 6)) * (strength == null ? 1 : strength);
      if (k < 0.02) return;
      const at = [centre[0] + gap * 0.3, centre[1] + gap * 0.3, F.floorZ + 1e-4];
      F.push(at, () => {
        const pts = [];
        for (let i = 0; i < 24; i++) {
          const a = i / 24 * TAU;
          const q = cam.project([at[0] + Math.cos(a) * radius * (1 + gap * 0.5),
                                 at[1] + Math.sin(a) * radius * (1 + gap * 0.5), F.floorZ]);
          if (!q.ok) return;
          pts.push(q);
        }
        ctx.save();
        if (RX.canFilter) ctx.filter = 'blur(' + Math.max(2, 5 + gap * 12).toFixed(1) + 'px)';
        ctx.fillStyle = 'rgba(0,0,0,' + (0.45 * k).toFixed(3) + ')';
        ctx.beginPath();
        pts.forEach((q, i) => i ? ctx.lineTo(q.x, q.y) : ctx.moveTo(q.x, q.y));
        ctx.closePath(); ctx.fill();
        ctx.restore(); ctx.filter = 'none';
      }, -1e6);       // always behind the object that cast it
    };

    F.render = () => {
      items.sort((a, b) => b.z - a.z);         // far to near
      items.forEach(it => it.draw());
      items.length = 0;
    };
    return F;
  }

  /* =====================================================================
     SPHERE — a real ball, sized by its projected radius so it shrinks
     correctly with distance.
     ===================================================================== */
  function sphere(F, c, r, colour, o) {
    o = o || {};
    const q = F.cam.project(c);
    if (!q.ok) return;
    const rp = r * q.s;
    if (rp < 0.4) return;
    if (o.shadow !== false) F.shadow(c, r, o.shadowK);
    F.push(c, () => {
      RX.ball(F.ctx, q.x, q.y, rp, colour, {
        rim: o.rim == null ? 0.7 : o.rim,
        sub: o.sub == null ? 0.35 : o.sub,
        vivid: o.vivid
      });
      if (o.label && rp > 7) {
        F.ctx.font = '600 ' + Math.min(13, rp * 0.75) + 'px "IBM Plex Mono",monospace';
        F.ctx.textAlign = 'center'; F.ctx.textBaseline = 'middle';
        F.ctx.lineWidth = 3; F.ctx.strokeStyle = 'rgba(5,8,15,.85)';
        F.ctx.strokeText(o.label, q.x, q.y);
        F.ctx.fillStyle = o.labelColour || '#F2F6FF';
        F.ctx.fillText(o.label, q.x, q.y);
      }
    }, o.bias);
  }

  /* =====================================================================
     CYLINDER / DISC — the workhorse for rolling bodies, coils, magnets,
     pistons and pipes. Built as a strip of quads round the axis plus the
     two end caps, each quad lit by its own normal, so the body genuinely
     turns as the camera moves.
     ===================================================================== */
  function cylinder(F, a, b, r, colour, o) {
    o = o || {};
    const ctx = F.ctx, cam = F.cam;
    const axis = norm(sub(b, a));
    const u = perp(axis), v = cross(axis, u);
    const n = o.segments || 26;
    const rIn = o.inner || 0;                       // >0 makes it a tube
    const mid = scale(add(a, b), 0.5);
    if (o.shadow !== false) F.shadow(mid, r, o.shadowK);

    // the curved wall, one quad per segment, each submitted separately so
    // the far half sorts behind whatever is inside the cylinder
    for (let i = 0; i < n; i++) {
      const a0 = i / n * TAU, a1 = (i + 1) / n * TAU;
      const nm0 = add(scale(u, Math.cos(a0)), scale(v, Math.sin(a0)));
      const nm1 = add(scale(u, Math.cos(a1)), scale(v, Math.sin(a1)));
      const nMid = norm(add(nm0, nm1));
      const p0 = add(a, scale(nm0, r)), p1 = add(a, scale(nm1, r));
      const p2 = add(b, scale(nm1, r)), p3 = add(b, scale(nm0, r));
      const centre = scale(add(add(p0, p1), add(p2, p3)), 0.25);
      const col = F.shade(colour, nMid, o);
      F.push(centre, () => {
        const q = [p0, p1, p2, p3].map(p => cam.project(p));
        if (q.some(x => !x.ok)) return;
        ctx.fillStyle = col;
        ctx.beginPath();
        q.forEach((x, k) => k ? ctx.lineTo(x.x, x.y) : ctx.moveTo(x.x, x.y));
        ctx.closePath(); ctx.fill();
        // hairline of the same colour kills the seams between quads
        ctx.strokeStyle = col; ctx.lineWidth = 0.7; ctx.stroke();
      }, o.bias);
    }
    // end caps, drawn as filled rings so a hollow body reads as hollow
    [[a, scale(axis, -1)], [b, axis]].forEach(([p, nrm], side) => {
      if (o.caps === false) return;
      const col = F.shade(o.capColour || colour, nrm, o);
      F.push(p, () => {
        const outer = [], inner = [];
        for (let i = 0; i <= n; i++) {
          const ang = i / n * TAU;
          const d = add(scale(u, Math.cos(ang)), scale(v, Math.sin(ang)));
          const qo = cam.project(add(p, scale(d, r)));
          if (!qo.ok) return;
          outer.push(qo);
          if (rIn > 0) {
            const qi = cam.project(add(p, scale(d, rIn)));
            if (!qi.ok) return;
            inner.push(qi);
          }
        }
        ctx.fillStyle = col;
        ctx.beginPath();
        outer.forEach((x, k) => k ? ctx.lineTo(x.x, x.y) : ctx.moveTo(x.x, x.y));
        if (rIn > 0) {
          ctx.closePath();
          for (let i = inner.length - 1; i >= 0; i--) {
            const x = inner[i];
            i === inner.length - 1 ? ctx.moveTo(x.x, x.y) : ctx.lineTo(x.x, x.y);
          }
        }
        ctx.closePath();
        ctx.fill(rIn > 0 ? 'evenodd' : 'nonzero');
        ctx.strokeStyle = rgba(mix(colour, '#05080F', 0.65), 0.9);
        ctx.lineWidth = 1; ctx.stroke();
        // the face markings that make rotation visible — without them a
        // rolling body and a sliding one look identical
        if (o.spokes) {
          ctx.save();
          ctx.strokeStyle = rgba(mix(colour, '#05080F', 0.55), 0.8);
          ctx.lineWidth = Math.max(1, r * F.cam.project(p).s * 0.05);
          for (let k = 0; k < o.spokes; k++) {
            const ang = k / o.spokes * TAU + (o.phase || 0) * (side === 1 ? 1 : -1);
            const d = add(scale(u, Math.cos(ang)), scale(v, Math.sin(ang)));
            const q0 = cam.project(add(p, scale(d, Math.max(rIn, r * 0.08))));
            const q1 = cam.project(add(p, scale(d, r * 0.96)));
            if (!q0.ok || !q1.ok) continue;
            ctx.beginPath(); ctx.moveTo(q0.x, q0.y); ctx.lineTo(q1.x, q1.y); ctx.stroke();
          }
          // one bright reference mark, so a single revolution is countable.
          // The two caps are mirror images, so the near one must count the
          // phase backwards or the mark appears to run the wrong way.
          const ang = (o.phase || 0) * (side === 1 ? 1 : -1);
          const d = add(scale(u, Math.cos(ang)), scale(v, Math.sin(ang)));
          const qm = cam.project(add(p, scale(d, rIn > 0 ? (rIn + r) / 2 : r * 0.66)));
          if (qm.ok) {
            ctx.fillStyle = '#FFD36B';
            ctx.beginPath();
            ctx.arc(qm.x, qm.y, Math.max(2, r * qm.s * 0.10), 0, TAU); ctx.fill();
          }
          ctx.restore();
        }
      }, o.bias);
    });
  }

  /* =====================================================================
     TUBE along a 3D polyline — wires, field lines, trajectories, coils.
     Each span is its own short cylinder, so it sorts correctly against
     everything it threads through.
     ===================================================================== */
  function tube(F, pts, r, colour, o) {
    o = o || {};
    const rAt = typeof r === 'function' ? r : () => r;
    for (let i = 0; i < pts.length - 1; i++) {
      const t = i / Math.max(1, pts.length - 2);
      cylinder(F, pts[i], pts[i + 1], rAt(t), colour,
               { segments: o.segments || 8, caps: false, shadow: false,
                 vivid: o.vivid, ambient: o.ambient, bias: o.bias });
    }
    if (o.round !== false) {
      for (let i = 0; i < pts.length; i += Math.max(1, Math.round(pts.length / 40))) {
        sphere(F, pts[i], rAt(i / Math.max(1, pts.length - 1)) * 0.99, colour,
               { shadow: false, rim: 0, sub: 0, vivid: o.vivid, bias: o.bias });
      }
    }
  }

  /* =====================================================================
     BOX — brackets, blocks, magnets, plates. Six lit faces, each sorted.
     ===================================================================== */
  function box(F, centre, size, colour, o) {
    o = o || {};
    const ctx = F.ctx, cam = F.cam;
    const [sx, sy, sz] = size;
    const ax = o.axes || [[1, 0, 0], [0, 1, 0], [0, 0, 1]];
    const half = [scale(ax[0], sx / 2), scale(ax[1], sy / 2), scale(ax[2], sz / 2)];
    if (o.shadow !== false) F.shadow(centre, Math.max(sx, sy) * 0.55, o.shadowK);
    const faces = [
      [0, 1], [0, -1], [1, 1], [1, -1], [2, 1], [2, -1]
    ];
    faces.forEach(([axis, sgn]) => {
      const n = scale(ax[axis], sgn);
      const c = add(centre, scale(half[axis], sgn));
      const e1 = half[(axis + 1) % 3], e2 = half[(axis + 2) % 3];
      const corners = [
        add(add(c, e1), e2), add(sub(c, e1), e2), sub(sub(c, e1), e2), sub(add(c, e1), e2)
      ];
      const col = F.shade(colour, n, o);
      F.push(c, () => {
        const q = corners.map(p => cam.project(p));
        if (q.some(x => !x.ok)) return;
        ctx.fillStyle = col;
        ctx.beginPath();
        q.forEach((x, k) => k ? ctx.lineTo(x.x, x.y) : ctx.moveTo(x.x, x.y));
        ctx.closePath(); ctx.fill();
        if (o.edges !== false) {
          ctx.strokeStyle = rgba(mix(colour, '#05080F', 0.6), 0.75);
          ctx.lineWidth = 1; ctx.stroke();
        }
        if (o.faceLabel && axis === (o.labelAxis == null ? 2 : o.labelAxis) && sgn > 0) {
          const qc = cam.project(c);
          ctx.font = '700 ' + Math.max(9, Math.min(18, sx * qc.s * 0.3)) +
            'px "IBM Plex Mono",monospace';
          ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
          ctx.lineWidth = 3; ctx.strokeStyle = 'rgba(5,8,15,.8)';
          ctx.strokeText(o.faceLabel, qc.x, qc.y);
          ctx.fillStyle = '#F2F6FF'; ctx.fillText(o.faceLabel, qc.x, qc.y);
        }
      }, o.bias);
    });
  }

  /* =====================================================================
     PLANE — a floor, a wall, an incline. Drawn with a grid so the eye can
     read depth off it, which is what sells the third dimension.
     ===================================================================== */
  function plane(F, origin, e1, e2, colour, o) {
    o = o || {};
    const ctx = F.ctx, cam = F.cam;
    const n = norm(cross(e1, e2));
    const col = F.shade(colour, n, { ambient: 0.4 });
    const c = add(origin, scale(add(e1, e2), 0.5));
    F.push(c, () => {
      const corners = [origin, add(origin, e1), add(add(origin, e1), e2), add(origin, e2)];
      const q = corners.map(p => cam.project(p));
      if (q.some(x => !x.ok)) return;
      ctx.save();
      ctx.beginPath();
      q.forEach((x, k) => k ? ctx.lineTo(x.x, x.y) : ctx.moveTo(x.x, x.y));
      ctx.closePath();
      ctx.fillStyle = col; ctx.fill();
      ctx.clip();
      const gx = o.grid == null ? 10 : o.grid;
      if (gx) {
        ctx.strokeStyle = rgba(o.gridColour || '#8FA4CE', o.gridAlpha == null ? 0.22 : o.gridAlpha);
        ctx.lineWidth = 1;
        for (let i = 0; i <= gx; i++) {
          const t = i / gx;
          const p0 = cam.project(add(origin, scale(e1, t)));
          const p1 = cam.project(add(add(origin, scale(e1, t)), e2));
          const p2 = cam.project(add(origin, scale(e2, t)));
          const p3 = cam.project(add(add(origin, scale(e2, t)), e1));
          if (p0.ok && p1.ok) { ctx.beginPath(); ctx.moveTo(p0.x, p0.y); ctx.lineTo(p1.x, p1.y); ctx.stroke(); }
          if (p2.ok && p3.ok) { ctx.beginPath(); ctx.moveTo(p2.x, p2.y); ctx.lineTo(p3.x, p3.y); ctx.stroke(); }
        }
      }
      ctx.restore();
      if (o.edge !== false) {
        ctx.strokeStyle = rgba(mix(colour, '#ffffff', 0.35), 0.5);
        ctx.lineWidth = 1.4;
        ctx.beginPath();
        q.forEach((x, k) => k ? ctx.lineTo(x.x, x.y) : ctx.moveTo(x.x, x.y));
        ctx.closePath(); ctx.stroke();
      }
    }, o.bias);
  }

  /* =====================================================================
     ARROW — a 3D vector: a shaft cylinder and a cone head, both lit.
     ===================================================================== */
  function arrow(F, from, to, r, colour, o) {
    o = o || {};
    const ctx = F.ctx, cam = F.cam;
    const d = sub(to, from), len = Math.hypot(d[0], d[1], d[2]);
    if (len < 1e-9) return;
    const axis = scale(d, 1 / len);
    const hl = Math.min(o.head || r * 3.6, len * 0.55);
    const neck = add(from, scale(axis, len - hl));
    cylinder(F, from, neck, r, colour,
             { segments: 12, caps: false, shadow: false, vivid: o.vivid, bias: o.bias });
    // the cone
    const u = perp(axis), v = cross(axis, u);
    const n = 14, hw = hl * 0.42;
    for (let i = 0; i < n; i++) {
      const a0 = i / n * TAU, a1 = (i + 1) / n * TAU;
      const d0 = add(scale(u, Math.cos(a0)), scale(v, Math.sin(a0)));
      const d1 = add(scale(u, Math.cos(a1)), scale(v, Math.sin(a1)));
      const p0 = add(neck, scale(d0, hw)), p1 = add(neck, scale(d1, hw));
      const nMid = norm(add(norm(add(d0, d1)), scale(axis, 0.55)));
      const centre = scale(add(add(p0, p1), to), 1 / 3);
      const col = F.shade(colour, nMid, o);
      F.push(centre, () => {
        const q = [p0, p1, to].map(p => cam.project(p));
        if (q.some(x => !x.ok)) return;
        ctx.fillStyle = col;
        ctx.beginPath();
        q.forEach((x, k) => k ? ctx.lineTo(x.x, x.y) : ctx.moveTo(x.x, x.y));
        ctx.closePath(); ctx.fill();
        ctx.strokeStyle = col; ctx.lineWidth = 0.7; ctx.stroke();
      }, o.bias);
    }
    if (o.label) {
      F.push(to, () => {
        const q = cam.project(to);
        if (!q.ok) return;
        ctx.font = '600 ' + (o.labelSize || 10) + 'px "IBM Plex Mono",monospace';
        ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
        ctx.lineWidth = 3.2; ctx.strokeStyle = 'rgba(5,8,15,.88)';
        ctx.strokeText(o.label, q.x, q.y - 12);
        ctx.fillStyle = colour; ctx.fillText(o.label, q.x, q.y - 12);
      }, (o.bias || 0) - 1e5);
    }
  }

  /* =====================================================================
     HELIX / COIL — a solenoid drawn as wire, which is what it is.
     ===================================================================== */
  function coil(F, centre, axisIn, radius, length, turns, wireR, colour, o) {
    o = o || {};
    const axis = norm(axisIn);
    const u = perp(axis), v = cross(axis, u);
    const n = Math.max(24, Math.round(turns * 20));
    const pts = [];
    for (let i = 0; i <= n; i++) {
      const t = i / n;
      const ang = t * turns * TAU + (o.phase || 0);
      const along = scale(axis, (t - 0.5) * length);
      const rad = add(scale(u, Math.cos(ang) * radius), scale(v, Math.sin(ang) * radius));
      pts.push(add(add(centre, along), rad));
    }
    tube(F, pts, wireR, colour, { segments: 6, round: false, vivid: o.vivid, bias: o.bias });
    return pts;
  }

  /* =====================================================================
     POLYLINE — a stroked 3D path, submitted as ONE item at its mean depth.
     Field lines, orbits and wireframes need thousands of points, and giving
     every span its own lit cylinder would cost more than the rest of the
     frame put together. Depth shows instead as width and alpha.
     ===================================================================== */
  function polyline(F, pts, colour, o) {
    o = o || {};
    if (!pts || pts.length < 2) return;
    const cam = F.cam, ctx = F.ctx;
    let mz = 0, n = 0;
    const proj = pts.map(p => { const q = cam.project(p); if (q.ok) { mz += q.z; n++; } return q; });
    if (!n) return;
    const at = pts[Math.floor(pts.length / 2)];
    F.push(at, () => {
      ctx.save();
      ctx.lineJoin = 'round'; ctx.lineCap = 'round';
      ctx.strokeStyle = rgba(colour, o.alpha == null ? 0.7 : o.alpha);
      ctx.lineWidth = o.width || 1.4;
      if (o.dash) ctx.setLineDash(o.dash);
      ctx.beginPath();
      let pen = false;
      for (let i = 0; i < proj.length; i++) {
        const q = proj[i];
        if (!q.ok) { pen = false; continue; }
        if (!pen) { ctx.moveTo(q.x, q.y); pen = true; } else ctx.lineTo(q.x, q.y);
      }
      ctx.stroke();
      ctx.restore();
    }, o.bias);
    return proj;
  }

  /* a wireframe sphere: latitude and longitude rings, drawn as polylines */
  function wireSphere(F, c, r, colour, o) {
    o = o || {};
    const lat = o.lat == null ? 5 : o.lat, lon = o.lon == null ? 8 : o.lon, seg = 40;
    for (let i = 1; i < lat; i++) {
      const ph = -Math.PI / 2 + Math.PI * i / lat;
      const rr = r * Math.cos(ph), zz = r * Math.sin(ph);
      const ring = [];
      for (let k = 0; k <= seg; k++) {
        const a = k / seg * TAU;
        ring.push([c[0] + Math.cos(a) * rr, c[1] + Math.sin(a) * rr, c[2] + zz]);
      }
      polyline(F, ring, colour, { alpha: o.alpha == null ? 0.30 : o.alpha, width: o.width || 1 });
    }
    for (let i = 0; i < lon; i++) {
      const a = i / lon * Math.PI;
      const ring = [];
      for (let k = 0; k <= seg; k++) {
        const t = k / seg * TAU;
        ring.push([c[0] + Math.cos(a) * Math.cos(t) * r,
                   c[1] + Math.sin(a) * Math.cos(t) * r,
                   c[2] + Math.sin(t) * r]);
      }
      polyline(F, ring, colour, { alpha: o.alpha == null ? 0.30 : o.alpha, width: o.width || 1 });
    }
    // the silhouette: the great circle square-on to the camera, which is what
    // actually makes it read as a sphere rather than a cage
    if (o.limb !== false) {
      const d = norm(sub(c, cam0(F).eye));
      const u = perp(d), v = cross(d, u);
      const ring = [];
      for (let k = 0; k <= 64; k++) {
        const t = k / 64 * TAU;
        ring.push(add(c, add(scale(u, Math.cos(t) * r), scale(v, Math.sin(t) * r))));
      }
      polyline(F, ring, colour, { alpha: o.limbAlpha == null ? 0.95 : o.limbAlpha,
                                  width: o.limbWidth || 2 });
    }
  }
  function cam0(F) { return F.cam; }

  /* =====================================================================
     TEXT pinned to a world point — a label that stays with its object.
     ===================================================================== */
  function label(F, at, text, colour, o) {
    o = o || {};
    if (window.__LABELS === false && !o.keep) return;   // the global Labels switch
    F.push(at, () => {
      const q = F.cam.project(at);
      if (!q.ok) return;
      const ctx = F.ctx;
      ctx.font = '600 ' + (o.size || 9.5) + 'px "IBM Plex Mono",monospace';
      ctx.textAlign = o.align || 'center';
      ctx.textBaseline = o.baseline || 'middle';
      ctx.lineWidth = 3.2; ctx.strokeStyle = 'rgba(5,8,15,.88)'; ctx.lineJoin = 'round';
      ctx.strokeText(text, q.x + (o.dx || 0), q.y + (o.dy || 0));
      ctx.fillStyle = colour || '#C9D4EA';
      ctx.fillText(text, q.x + (o.dx || 0), q.y + (o.dy || 0));
    }, (o.bias || 0) - 1e5);      // labels ride in front of their object
  }

  /* a leader from a world point out to a screen-space caption */
  function callout(F, at, dx, dy, text, colour, o) {
    o = o || {};
    if (window.__LABELS === false && !o.keep) return;
    F.push(at, () => {
      const q = F.cam.project(at);
      if (!q.ok) return;
      const ctx = F.ctx;
      ctx.strokeStyle = rgba(colour || '#8FA4CE', .6); ctx.lineWidth = 1;
      ctx.beginPath(); ctx.moveTo(q.x, q.y); ctx.lineTo(q.x + dx, q.y + dy); ctx.stroke();
      ctx.fillStyle = rgba(colour || '#8FA4CE', .9);
      ctx.beginPath(); ctx.arc(q.x, q.y, 1.9, 0, TAU); ctx.fill();
      ctx.font = '600 ' + (o.size || 9.5) + 'px "IBM Plex Mono",monospace';
      ctx.textAlign = dx < 0 ? 'right' : 'left';
      ctx.textBaseline = 'middle';
      ctx.lineWidth = 3.2; ctx.strokeStyle = 'rgba(5,8,15,.88)'; ctx.lineJoin = 'round';
      ctx.strokeText(text, q.x + dx + (dx < 0 ? -4 : 4), q.y + dy);
      ctx.fillStyle = colour || '#C9D4EA';
      ctx.fillText(text, q.x + dx + (dx < 0 ? -4 : 4), q.y + dy);
    }, (o.bias || 0) - 1e5);
  }

  /* ---------------- textured plane ----------------
     Paints an offscreen canvas onto a planar quad in the scene. A single
     affine transform cannot represent a perspective projection, so the quad
     is cut into an N x N grid and each cell drawn as two affine triangles;
     by N = 6 the residual is well under a pixel. Cells are expanded a hair
     about their own centroid so the clip edges overlap and no seam shows.

     centre is the middle of the plane, e1 and e2 its half-axis vectors: the
     image's +u runs along e1 and +v along e2 (v downward, like a canvas).  */
  function triTex(ctx, img, s, d) {
    const [sx0, sy0, sx1, sy1, sx2, sy2] = s;
    let [x0, y0, x1, y1, x2, y2] = d;
    // expand by half a pixel about the centroid so neighbours overlap
    const gx = (x0 + x1 + x2) / 3, gy = (y0 + y1 + y2) / 3, k = 1.012;
    x0 = gx + (x0 - gx) * k; y0 = gy + (y0 - gy) * k;
    x1 = gx + (x1 - gx) * k; y1 = gy + (y1 - gy) * k;
    x2 = gx + (x2 - gx) * k; y2 = gy + (y2 - gy) * k;
    const den = sx0 * (sy2 - sy1) - sx1 * sy2 + sx2 * sy1 + (sx1 - sx2) * sy0;
    if (!den) return;
    ctx.save();
    ctx.beginPath();
    ctx.moveTo(x0, y0); ctx.lineTo(x1, y1); ctx.lineTo(x2, y2); ctx.closePath();
    ctx.clip();
    ctx.transform(
      -(sy0 * (x2 - x1) - sy1 * x2 + sy2 * x1 + (sy1 - sy2) * x0) / den,
       (sy1 * y2 + sy0 * (y1 - y2) - sy2 * y1 + (sy2 - sy1) * y0) / den,
       (sx0 * (x2 - x1) - sx1 * x2 + sx2 * x1 + (sx1 - sx2) * x0) / den,
      -(sx1 * y2 + sx0 * (y1 - y2) - sx2 * y1 + (sx2 - sx1) * y0) / den,
       (sx0 * (sy2 * x1 - sy1 * x2) + sy0 * (sx1 * x2 - sx2 * x1) + (sx2 * sy1 - sx1 * sy2) * x0) / den,
       (sx0 * (sy2 * y1 - sy1 * y2) + sy0 * (sx1 * y2 - sx2 * y1) + (sx2 * sy1 - sx1 * sy2) * y0) / den);
    ctx.drawImage(img, 0, 0);
    ctx.restore();
  }

  function texPlane(F, centre, e1, e2, img, o) {
    o = o || {};
    const ctx = F.ctx, cam = F.cam, N = o.grid || 6;
    const iw = img.width, ih = img.height;
    F.push(centre, () => {
      const P = [];
      for (let j = 0; j <= N; j++) {
        P.push([]);
        for (let i = 0; i <= N; i++) {
          const u = i / N * 2 - 1, v = j / N * 2 - 1;
          P[j].push(cam.project([
            centre[0] + e1[0] * u + e2[0] * v,
            centre[1] + e1[1] * u + e2[1] * v,
            centre[2] + e1[2] * u + e2[2] * v]));
        }
      }
      if (o.alpha != null) { ctx.save(); ctx.globalAlpha = o.alpha; }
      for (let j = 0; j < N; j++) {
        for (let i = 0; i < N; i++) {
          const a = P[j][i], b = P[j][i + 1], c = P[j + 1][i + 1], d = P[j + 1][i];
          if (!a.ok || !b.ok || !c.ok || !d.ok) continue;
          const u0 = i / N * iw, u1 = (i + 1) / N * iw;
          const v0 = j / N * ih, v1 = (j + 1) / N * ih;
          triTex(ctx, img, [u0, v0, u1, v0, u1, v1], [a.x, a.y, b.x, b.y, c.x, c.y]);
          triTex(ctx, img, [u0, v0, u1, v1, u0, v1], [a.x, a.y, c.x, c.y, d.x, d.y]);
        }
      }
      if (o.alpha != null) ctx.restore();
    }, o.bias);
  }

  window.R3 = {
    Frame, sphere, cylinder, tube, box, plane, texPlane, arrow, coil, label, callout,
    polyline, wireSphere,
    norm, sub, add, scale, dot, cross, perp, LIGHT
  };
})();
