/* ============================================================
   PHYSICS (syllabus core, batch 3)
     19. Gravitation — orbits, the inside of the Earth, a binary star
         and the Cavendish balance
     20. Mechanical properties of fluids
   ============================================================ */
(function (L) {
  'use strict';
  const { clamp, TAU, E, Camera } = L;
  const PA = window.PHYSART, R3 = window.R3, RX = window.RX;

  /* =========================================================================
     19 · GRAVITATION

     Nothing on this stage is drawn from a conic-section formula. Every path
     is Newton's law of gravitation integrated step by step (RK4, a few
     hundred steps per orbit), and the exam results are read OFF the run:
     the period by timing one revolution, the semi-major axis from the
     measured nearest and furthest points, Kepler's equal areas by summing
     the triangles the radius vector actually sweeps.

     The planets are ray-traced: each pixel of the disc is a ray intersected
     with the sphere, the hit point turned into latitude and longitude on a
     procedurally generated surface, and lit by the Sun. So the terminator,
     the ocean glint and a geostationary satellite hanging over one spot are
     all real consequences of the geometry, not paint.
     ========================================================================= */

  const GRAV = 6.674e-11;
  const PLANETS = {
    earth:   { name: 'Earth',   GM: 3.986004e14, R: 6.371e6, day: 86164, atm: true,
               sats: [['ISS', 6.778e6, 5557], ['GPS', 2.6560e7, 43082], ['GEO', 4.2164e7, 86164], ['Moon', 3.844e8, 2.3606e6]] },
    moon:    { name: 'Moon',    GM: 4.9048e12, R: 1.7374e6, day: 2.3606e6,
               sats: [['Apollo CSM', 1.8474e6, 7102], ['LRO', 1.7874e6, 6760]] },
    mars:    { name: 'Mars',    GM: 4.2828e13, R: 3.3895e6, day: 88643,
               sats: [['Phobos', 9.376e6, 27554], ['Deimos', 2.3463e7, 109075]] },
    jupiter: { name: 'Jupiter', GM: 1.26687e17, R: 6.9911e7, day: 35730,
               sats: [['Io', 4.217e8, 152854], ['Europa', 6.71e8, 306822], ['Ganymede', 1.0704e9, 618153], ['Callisto', 1.8827e9, 1441931]] }
  };
  const SUN = R3.norm([0.78, -0.46, 0.42]);

  /* ---------------- 3-D value noise, for the planet surfaces ---------------- */
  function hash3(x, y, z, s) {
    let h = (x * 374761393 + y * 668265263 + z * 2147483647 + s * 1274126177) | 0;
    h = (h ^ (h >>> 13)) * 1274126177 | 0;
    return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
  }
  function vnoise(x, y, z, s) {
    const xi = Math.floor(x), yi = Math.floor(y), zi = Math.floor(z);
    const fx = x - xi, fy = y - yi, fz = z - zi;
    const u = fx * fx * (3 - 2 * fx), v = fy * fy * (3 - 2 * fy), w = fz * fz * (3 - 2 * fz);
    const L1 = (a, b, t) => a + (b - a) * t;
    const c = (i, j, k) => hash3(xi + i, yi + j, zi + k, s);
    return L1(L1(L1(c(0, 0, 0), c(1, 0, 0), u), L1(c(0, 1, 0), c(1, 1, 0), u), v),
              L1(L1(c(0, 0, 1), c(1, 0, 1), u), L1(c(0, 1, 1), c(1, 1, 1), u), v), w);
  }
  function fbm(x, y, z, s, oct) {
    let a = 0.5, f = 1, t = 0, n = 0;
    for (let i = 0; i < (oct || 5); i++) { t += a * vnoise(x * f, y * f, z * f, s + i * 17); n += a; a *= 0.5; f *= 2.03; }
    return t / n;
  }

  /* An equirectangular surface: rgb per texel, plus a specular mask (water)
     and a night-light mask. Built once per body and cached. */
  const TEX = {};
  function planetTex(id) {
    if (TEX[id]) return TEX[id];
    const TW = 1024, TH = 512, rgb = new Uint8ClampedArray(TW * TH * 3), spec = new Uint8Array(TW * TH),
          lite = new Uint8Array(TW * TH), cloud = new Uint8Array(TW * TH);
    const put = (i, c) => { rgb[i * 3] = c[0]; rgb[i * 3 + 1] = c[1]; rgb[i * 3 + 2] = c[2]; };
    const lerp = (a, b, t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
    for (let j = 0; j < TH; j++) {
      const lat = (0.5 - (j + 0.5) / TH) * Math.PI, cl = Math.cos(lat), sl = Math.sin(lat);
      for (let i = 0; i < TW; i++) {
        const lon = ((i + 0.5) / TW) * TAU - Math.PI;
        const x = cl * Math.cos(lon), y = cl * Math.sin(lon), z = sl, k = j * TW + i;
        if (id === 'earth') {
          const h = fbm(x * 1.9 + 3, y * 1.9, z * 1.9, 11, 6) + 0.10 * fbm(x * 7, y * 7, z * 7, 5, 3);
          const wet = fbm(x * 3 + 9, y * 3, z * 3, 41, 4);
          // polar ice fades in over a ragged band instead of starting at a hard latitude
          const iceF = clamp((Math.abs(lat) - 1.22 - 0.16 * (fbm(x * 6, y * 6, z * 6, 3, 4) - 0.5)) / 0.07, 0, 1);
          const land = h > 0.555;
          let c;
          if (land) {
            const e = clamp((h - 0.555) / 0.16, 0, 1), dry = clamp((0.62 - wet) * 3 + (1 - Math.abs(Math.abs(lat) - 0.42) * 3.2) * 0.35, 0, 1);
            const green = lerp([52, 104, 44], [98, 128, 60], e), desert = lerp([188, 156, 98], [160, 120, 78], e);
            c = lerp(green, desert, dry);
            if (e > 0.7) c = lerp(c, [120, 104, 92], (e - 0.7) * 2.4);
            if (Math.abs(lat) > 0.95) c = lerp(c, [90, 110, 96], 0.5);
            lite[k] = (hash3(i, j, 7, 3) > 0.93 && Math.abs(lat) < 1.0 && dry < 0.8) ? 255 : 0;
          } else {
            const d = clamp((0.555 - h) / 0.12, 0, 1);
            c = lerp([34, 104, 150], [9, 34, 78], d);
            if (d < 0.08) c = lerp([70, 150, 170], c, d / 0.08);      // shallow shelf along the coast
            spec[k] = 255;
          }
          if (iceF > 0) { c = lerp(c, lerp([214, 226, 238], [246, 249, 253], wet), iceF); if (iceF > 0.5) spec[k] = 0; }
          put(k, c);
          const cv = fbm(x * 3.2 + 1, y * 3.2 + 5, z * 5.5, 91, 5);
          cloud[k] = clamp((cv - 0.52) * 5.2, 0, 1) * 235;
        } else if (id === 'moon') {
          const mare = fbm(x * 1.6 + 2, y * 1.6, z * 1.6, 23, 4), fine = fbm(x * 9, y * 9, z * 9, 29, 3);
          let v = 150 + (fine - 0.5) * 60;
          if (mare < 0.44) v -= 58 * clamp((0.44 - mare) * 9, 0, 1);
          put(k, [v, v * 0.98, v * 0.95]);
        } else if (id === 'mars') {
          const alb = fbm(x * 2.2 + 4, y * 2.2, z * 2.2, 57, 5), fine = fbm(x * 8, y * 8, z * 8, 61, 3);
          let c = lerp([196, 102, 58], [150, 70, 42], clamp((0.5 - alb) * 3, 0, 1));
          c = lerp(c, [210, 150, 110], clamp((fine - 0.6) * 2, 0, 1) * 0.5);
          if (Math.abs(lat) > 1.30 + 0.08 * (fine - 0.5)) c = [236, 232, 226];
          put(k, c);
        } else {                                  // Jupiter: zonal bands, sheared by turbulence
          const tur = fbm(x * 4 + 1, y * 4, z * 1.5, 71, 5);
          const b = Math.sin((lat + (tur - 0.5) * 0.10) * 16) * 0.5 + 0.5;
          let c = lerp([214, 190, 160], [168, 112, 78], b * b);
          c = lerp(c, [236, 224, 206], clamp((tur - 0.6) * 2.5, 0, 1) * 0.6);
          const dl = (lat + 0.39) / 0.07, dn = (((lon - 1.2) + Math.PI) % TAU - Math.PI) / 0.20;
          const spot = dl * dl + dn * dn;
          if (spot < 1) c = lerp([196, 86, 58], c, spot * spot);
          put(k, c);
        }
      }
    }
    // craters on the Moon: rims catch the light, floors sit dark
    if (id === 'moon') {
      for (let n = 0; n < 900; n++) {
        const ci = hash3(n, 1, 2, 9) * TW, cj = TH * (0.08 + 0.84 * hash3(n, 3, 4, 9));
        const cr = 2.5 + Math.pow(hash3(n, 5, 6, 9), 3) * 26;
        const sx = 1 / Math.max(0.2, Math.cos((0.5 - cj / TH) * Math.PI));
        for (let dj = -cr - 2; dj <= cr + 2; dj++) for (let di = -(cr + 2) * sx; di <= (cr + 2) * sx; di++) {
          const jj = Math.round(cj + dj); if (jj < 0 || jj >= TH) continue;
          const ii = ((Math.round(ci + di) % TW) + TW) % TW, d = Math.hypot(di / sx, dj) / cr;
          if (d > 1.25) continue;
          const kk = (jj * TW + ii) * 3, f = d < 0.85 ? -22 : d < 1.08 ? 30 : 8;
          rgb[kk] = rgb[kk] + f; rgb[kk + 1] = rgb[kk + 1] + f; rgb[kk + 2] = rgb[kk + 2] + f;
        }
      }
    }
    return (TEX[id] = { TW, TH, rgb, spec, lite, cloud });
  }

  /* ---------------- the ray-traced planet ----------------
     C: centre (world), Rw: radius (world). spin: rotation about z (rad).
     o.cut: remove the half y < 0 and show the section face (the interior
     coloured by o.layer(r/R) → rgb). Returns a canvas and its CSS-pixel box,
     or null if off screen. */
  let RT = null;
  function traceBody(cam, W, H, C, Rw, id, spin, o) {
    o = o || {};
    const q = cam.project(C);
    if (!q.ok) return null;
    const rp = Rw * q.s * 1.12 + 2;
    const x0 = Math.max(0, Math.floor(q.x - rp)), x1 = Math.min(W, Math.ceil(q.x + rp));
    const y0 = Math.max(0, Math.floor(q.y - rp)), y1 = Math.min(H, Math.ceil(q.y + rp));
    if (x1 <= x0 || y1 <= y0) return null;
    const bw = x1 - x0, bh = y1 - y0;
    const dpr = Math.min(2, (typeof window !== 'undefined' && window.devicePixelRatio) || 1);
    const res = Math.min(dpr, Math.sqrt(170000 / (bw * bh)));
    const nx = Math.max(1, Math.round(bw * res)), ny = Math.max(1, Math.round(bh * res));
    if (!RT) { RT = document.createElement('canvas'); RT.ctx = RT.getContext('2d'); }
    if (RT.width !== nx || RT.height !== ny) { RT.width = nx; RT.height = ny; RT.img = null; }
    if (!RT.img) RT.img = RT.ctx.createImageData(nx, ny);
    const img = RT.img, px = img.data;
    const T = planetTex(id), TW = T.TW, TH = T.TH;
    const e = cam.eye, f = cam.f, r = cam.r, u = cam.u, K = cam._k, w2 = cam._w / 2, h2 = cam._h / 2;
    const ox = e[0] - C[0], oy = e[1] - C[1], oz = e[2] - C[2];
    const cc = ox * ox + oy * oy + oz * oz - Rw * Rw;
    const cs = Math.cos(-spin), sn = Math.sin(-spin), cs2 = Math.cos(-spin * 0.93), sn2 = Math.sin(-spin * 0.93);
    const pixW = 1 / (K * res);                           // world size of a pixel, per unit depth
    const Lx = SUN[0], Ly = SUN[1], Lz = SUN[2];
    const amb = o.ambient == null ? 0.06 : o.ambient, earth = id === 'earth';
    for (let j = 0; j < ny; j++) {
      const sy = y0 + (j + 0.5) / res, vy = (h2 - sy) / K;
      for (let i = 0; i < nx; i++) {
        const sx = x0 + (i + 0.5) / res, vx = (sx - w2) / K;
        let dx = f[0] + vx * r[0] + vy * u[0], dy = f[1] + vx * r[1] + vy * u[1], dz = f[2] + vx * r[2] + vy * u[2];
        const dl = Math.hypot(dx, dy, dz); dx /= dl; dy /= dl; dz /= dl;
        const b = ox * dx + oy * dy + oz * dz, disc = b * b - cc;
        const k4 = (j * nx + i) * 4;
        // closest approach of the ray to the centre, for a soft limb
        const tca = -b, D2 = Math.max(0, (ox * ox + oy * oy + oz * oz) - tca * tca), D = Math.sqrt(D2);
        const edgeW = pixW * tca * 1.2;
        let a = clamp((Rw - D) / edgeW + 0.5, 0, 1);
        if (a <= 0) { px[k4 + 3] = 0; continue; }
        let t = disc > 0 ? -b - Math.sqrt(disc) : tca;
        let hx = ox + t * dx, hy = oy + t * dy, hz = oz + t * dz;
        let nxw, nyw, nzw, R_, G_, B_, face = false;
        if (o.cut && hy < 0) {
          // the ray met the removed half: find the section face y = 0 instead
          const tf = -oy / dy;
          const fx = ox + tf * dx, fz = oz + tf * dz, rr = Math.hypot(fx, fz);
          if (!(tf > 0) || rr > Rw) {
            // it may still hit the far (kept) hemisphere
            const t2 = disc > 0 ? -b + Math.sqrt(disc) : -1;
            const hy2 = oy + t2 * dy;
            if (t2 > 0 && hy2 >= 0) {
              // looking through the open cut at the inside of the far shell: the section face hides it,
              // so this only happens outside the face disc — treat as the far surface's inside, dark
              px[k4] = 10; px[k4 + 1] = 12; px[k4 + 2] = 18; px[k4 + 3] = 255 * a; continue;
            }
            px[k4 + 3] = 0; continue;
          }
          face = true;
          hx = fx; hy = 0; hz = fz;
          const c = o.layer(rr / Rw, fx / Rw, fz / Rw);
          nxw = 0; nyw = -1; nzw = 0;
          const l = Math.max(0, -Ly) * 0.55 + 0.55;
          R_ = c[0] * l; G_ = c[1] * l; B_ = c[2] * l;
          a = 1;
        }
        if (!face) {
          nxw = hx / Rw; nyw = hy / Rw; nzw = hz / Rw;
          // body frame: undo the spin about z
          const bx = nxw * cs - nyw * sn, by = nxw * sn + nyw * cs;
          const lat = Math.asin(clamp(nzw, -1, 1)), lon = Math.atan2(by, bx);
          // bilinear: at a globe this size nearest-texel sampling shows as stair-stepped coasts
          const fu = (lon + Math.PI) / TAU * TW - 0.5, fv = clamp((0.5 - lat / Math.PI) * TH - 0.5, 0, TH - 1.001);
          const i0 = Math.floor(fu), j0 = Math.floor(fv), au = fu - i0, av = fv - j0;
          const ia = ((i0 % TW) + TW) % TW, ib = (ia + 1) % TW, jb = Math.min(TH - 1, j0 + 1);
          const k00 = (j0 * TW + ia) * 3, k10 = (j0 * TW + ib) * 3, k01 = (jb * TW + ia) * 3, k11 = (jb * TW + ib) * 3;
          const w00 = (1 - au) * (1 - av), w10 = au * (1 - av), w01 = (1 - au) * av, w11 = au * av, rg = T.rgb;
          R_ = rg[k00] * w00 + rg[k10] * w10 + rg[k01] * w01 + rg[k11] * w11;
          G_ = rg[k00 + 1] * w00 + rg[k10 + 1] * w10 + rg[k01 + 1] * w01 + rg[k11 + 1] * w11;
          B_ = rg[k00 + 2] * w00 + rg[k10 + 2] * w10 + rg[k01 + 2] * w01 + rg[k11 + 2] * w11;
          const tj = Math.round(fv), tk = tj * TW + ((Math.round(fu) % TW) + TW) % TW;
          const ndl = nxw * Lx + nyw * Ly + nzw * Lz;
          let dif = Math.max(0, ndl);
          // a soft terminator: the atmosphere scatters a little past 90°
          dif = earth ? clamp(ndl * 1.15 + 0.06, 0, 1) : Math.pow(dif, 0.9);
          let cl = 0;
          if (earth) {
            const bx2 = nxw * cs2 - nyw * sn2, by2 = nxw * sn2 + nyw * cs2;
            const ci = Math.min(TW - 1, Math.floor((Math.atan2(by2, bx2) + Math.PI) / TAU * TW));
            cl = T.cloud[tj * TW + ci] / 255;
          }
          const k = amb + (1 - amb) * dif;
          R_ = (R_ * (1 - cl) + 245 * cl) * k; G_ = (G_ * (1 - cl) + 248 * cl) * k; B_ = (B_ * (1 - cl) + 252 * cl) * k;
          // sun glint on water
          if (T.spec[tk] && dif > 0) {
            const hxv = Lx - dx, hyv = Ly - dy, hzv = Lz - dz, hl = Math.hypot(hxv, hyv, hzv);
            const sp = Math.pow(Math.max(0, (nxw * hxv + nyw * hyv + nzw * hzv) / hl), 140) * (1 - cl) * dif;
            R_ += 150 * sp; G_ += 155 * sp; B_ += 140 * sp;
          }
          // city lights on the night side
          if (earth && T.lite[tk] && ndl < -0.08) { const n = Math.min(1, (-ndl - 0.08) * 4) * (1 - cl); R_ += 230 * n; G_ += 170 * n; B_ += 80 * n; }
          // limb darkening and a thin blue rim of air
          const mu = Math.max(0, -(nxw * dx + nyw * dy + nzw * dz));
          if (earth) { const rim = Math.pow(1 - mu, 3) * (0.25 + 0.75 * Math.max(0, ndl + 0.2)); R_ += 60 * rim; G_ += 120 * rim; B_ += 255 * rim; }
          else { const ld = 0.65 + 0.35 * Math.pow(mu, 0.5); R_ *= ld; G_ *= ld; B_ *= ld; }
        }
        px[k4] = R_; px[k4 + 1] = G_; px[k4 + 2] = B_; px[k4 + 3] = 255 * a;
      }
    }
    RT.ctx.putImageData(img, 0, 0);
    return { canvas: RT, x: x0, y: y0, w: bw, h: bh, cx: q.x, cy: q.y, rp: Rw * q.s };
  }

  /* a star field fixed to the sky: it turns as the camera orbits, so it
     reads as distant space rather than a wallpaper */
  const STARS = (() => {
    const s = [];
    for (let i = 0; i < 700; i++) {
      const z = hash3(i, 1, 1, 77) * 2 - 1, a = hash3(i, 2, 2, 77) * TAU, c = Math.sqrt(1 - z * z);
      s.push([c * Math.cos(a), c * Math.sin(a), z, Math.pow(hash3(i, 3, 3, 77), 3), hash3(i, 4, 4, 77)]);
    }
    return s;
  })();
  function drawSky(ctx, cam, W, H) {
    const gr = ctx.createRadialGradient(W * 0.55, H * 0.45, 0, W * 0.55, H * 0.45, Math.max(W, H) * 0.8);
    gr.addColorStop(0, '#0B1328'); gr.addColorStop(1, '#03050B');
    ctx.fillStyle = gr; ctx.fillRect(0, 0, W, H);
    const f = cam.f, r = cam.r, u = cam.u, K = cam._k;
    STARS.forEach(s => {
      const cz = s[0] * f[0] + s[1] * f[1] + s[2] * f[2];
      if (cz < 0.05) return;
      const x = W / 2 + (s[0] * r[0] + s[1] * r[1] + s[2] * r[2]) / cz * K;
      const y = H / 2 - (s[0] * u[0] + s[1] * u[1] + s[2] * u[2]) / cz * K;
      if (x < 0 || x > W || y < 0 || y > H) return;
      const m = s[3];
      ctx.fillStyle = s[4] < 0.2 ? 'rgba(255,214,170,' + (0.25 + m * 0.75) + ')' : s[4] > 0.85 ? 'rgba(170,200,255,' + (0.25 + m * 0.75) + ')'
                    : 'rgba(235,240,255,' + (0.2 + m * 0.8) + ')';
      ctx.fillRect(x, y, 0.8 + m * 1.6, 0.8 + m * 1.6);
    });
  }

  /* ---------------- the orbit, integrated ----------------
     State in SI in the planet's equatorial plane. RK4 with a step of
     1/360 of the LOCAL circular period, so the step shrinks near the planet
     where the motion is fast. Air drag (Earth only) uses a piecewise-
     exponential thermosphere, scaled by an exaggeration factor so a month
     of decay fits in a minute; the factor is on the screen, not hidden. */
  function airDensity(hm) {
    const T = [[0, 1.225, 7.25e3], [1.0e5, 5.6e-7, 5.9e3], [1.5e5, 2.1e-9, 2.2e4], [2.0e5, 2.5e-10, 3.7e4],
               [3.0e5, 1.9e-11, 5.3e4], [4.0e5, 2.8e-12, 5.9e4], [5.0e5, 5.2e-13, 6.3e4], [7.0e5, 3.1e-14, 8.8e4], [1.0e6, 3.0e-15, 1.2e5]];
    if (hm < 0) hm = 0;
    let k = T.length - 1;
    for (let i = 0; i < T.length - 1; i++) if (hm < T[i + 1][0]) { k = i; break; }
    return T[k][1] * Math.exp(-(hm - T[k][0]) / T[k][2]);
  }

  /* st, when given, is a state [x, y, vx, vy] to start from — the moment
     just after an engine burn — instead of the launch pad */
  function runOrbit(p, st) {
    const P = PLANETS[p.body] || PLANETS.earth;
    const GM = P.GM, R = P.R;
    let h0 = Math.pow(10, p.logH) * 1e3, r0 = R + h0;
    let vc = Math.sqrt(GM / r0), ve = Math.sqrt(2) * vc, v0 = p.vr * vc;
    let gm = p.gam * Math.PI / 180;
    const drag = !!(p.drag && P.atm);
    const beta = drag ? 0.01 * Math.pow(10, p.dragX) : 0;          // Cd·A/m = 0.01 m²/kg, × the exaggeration
    // launch at (r0, 0), velocity turned γ up from the local horizontal (+y)
    let s = [r0, 0, v0 * Math.sin(gm), v0 * Math.cos(gm)];
    if (st) {
      s = st.slice();
      r0 = Math.hypot(s[0], s[1]); h0 = r0 - R; vc = Math.sqrt(GM / r0); ve = Math.SQRT2 * vc; v0 = Math.hypot(s[2], s[3]);
      gm = Math.asin(clamp((s[0] * s[2] + s[1] * s[3]) / (r0 * v0 || 1), -1, 1));   // flight-path angle
    }
    const eps0 = v0 * v0 / 2 - GM / r0;
    const bound = eps0 < 0;
    const a0 = bound ? -GM / (2 * eps0) : Infinity;
    const Tk = bound ? TAU * Math.sqrt(a0 * a0 * a0 / GM) : 0;
    const acc = (x, y, vx, vy) => {
      const r2 = x * x + y * y, r = Math.sqrt(r2), g = -GM / (r2 * r);
      let ax = g * x, ay = g * y;
      if (beta) {
        const rho = airDensity(r - R), v = Math.hypot(vx, vy), k = -0.5 * rho * v * beta;
        ax += k * vx; ay += k * vy;
      }
      return [ax, ay];
    };
    const f = (st) => { const a = acc(st[0], st[1], st[2], st[3]); return [st[2], st[3], a[0], a[1]]; };
    const pts = [[0, s[0], s[1], s[2], s[3]]];
    let t = 0, th = 0, prevAng = Math.atan2(s[1], s[0]), T = 0, end = 'run', rmin = r0, rmax = r0;
    const Tloc0 = TAU * Math.sqrt(r0 * r0 * r0 / GM);
    const tStop = drag ? 40 * Tloc0 : bound ? Tk * 1.02 + 60 : 4.5 * Tloc0;
    const rEsc = Math.max(6 * r0, 3 * R);
    let n = 0, dragOrbits = 0, rStart = r0;
    while (t < tStop && n < 400000) {
      const r = Math.hypot(s[0], s[1]);
      let hs = TAU * Math.sqrt(r * r * r / GM) / 360;
      if (beta) {                                 // never step past the drag's own time scale
        const v = Math.hypot(s[2], s[3]), ad = 0.5 * airDensity(r - R) * v * v * beta;
        hs = Math.min(hs, 0.02 * v / Math.max(ad, 1e-12));
      }
      const k1 = f(s), s2 = s.map((v, i) => v + k1[i] * hs / 2), k2 = f(s2),
            s3 = s.map((v, i) => v + k2[i] * hs / 2), k3 = f(s3), s4 = s.map((v, i) => v + k3[i] * hs), k4 = f(s4);
      const ns = s.map((v, i) => v + hs / 6 * (k1[i] + 2 * k2[i] + 2 * k3[i] + k4[i]));
      const rn = Math.hypot(ns[0], ns[1]);
      // unwrapped angle, to time one revolution
      let ang = Math.atan2(ns[1], ns[0]); let da = ang - prevAng;
      if (da > Math.PI) da -= TAU; if (da < -Math.PI) da += TAU;
      const thN = th + da;
      // 120 km is the re-entry interface: below it the plunge is aerodynamics, not orbital decay
      if (beta && rn < R + 1.2e5) { s = ns; t += hs; th = thN; pts.push([t, s[0], s[1], s[2], s[3]]); end = 'reentry'; break; }
      if (rn < R) {                              // it has hit the ground: find where, by bisection on the step
        let lo = 0, hi = hs;
        for (let it = 0; it < 40; it++) {
          const mid = (lo + hi) / 2;
          const m1 = f(s), m2 = f(s.map((v, i) => v + m1[i] * mid / 2)), m3 = f(s.map((v, i) => v + m2[i] * mid / 2)),
                m4 = f(s.map((v, i) => v + m3[i] * mid));
          const ms = s.map((v, i) => v + mid / 6 * (m1[i] + 2 * m2[i] + 2 * m3[i] + m4[i]));
          if (Math.hypot(ms[0], ms[1]) < R) hi = mid; else lo = mid;
        }
        const m1 = f(s), m2 = f(s.map((v, i) => v + m1[i] * lo / 2)), m3 = f(s.map((v, i) => v + m2[i] * lo / 2)), m4 = f(s.map((v, i) => v + m3[i] * lo));
        s = s.map((v, i) => v + lo / 6 * (m1[i] + 2 * m2[i] + 2 * m3[i] + m4[i]));
        t += lo;
        let a2 = Math.atan2(s[1], s[0]) - prevAng; if (a2 > Math.PI) a2 -= TAU; if (a2 < -Math.PI) a2 += TAU;
        th += a2;
        pts.push([t, s[0], s[1], s[2], s[3]]);
        end = 'crash'; break;
      }
      if (!T && th < TAU && thN >= TAU && !drag) {
        const fr = (TAU - th) / (thN - th);           // interpolate the crossing
        T = t + fr * hs;
      }
      if (drag && Math.floor(thN / TAU) > Math.floor(th / TAU)) dragOrbits++;
      s = ns; t += hs; th = thN; prevAng = ang; n++;
      rmin = Math.min(rmin, rn); rmax = Math.max(rmax, rn);
      pts.push([t, s[0], s[1], s[2], s[3]]);
      if (!bound && rn > rEsc) { end = 'escape'; break; }
      if (bound && !drag && T && t > T + hs) { end = 'closed'; break; }
    }
    // for a decaying orbit, the paradox is read where the spiral is still slow:
    // the first moment the altitude has fallen 60 % of the way to 120 km
    let iMid = pts.length - 1;
    if (drag) {
      const hMid = h0 - 0.6 * (h0 - 1.2e5);
      for (let i = 0; i < pts.length; i++) if (Math.hypot(pts[i][1], pts[i][2]) - R < hMid) { iMid = i; break; }
    }
    // refine the extremes on the stored samples with a parabola through each turning triple
    const rr = pts.map(q => Math.hypot(q[1], q[2]));
    let rMin = Infinity, rMax = 0;
    const lim = end === 'closed' ? pts.length : pts.length;
    for (let i = 1; i < lim - 1; i++) {
      const a = rr[i - 1], b = rr[i], c = rr[i + 1];
      if ((b <= a && b <= c) || (b >= a && b >= c)) {
        const den = a - 2 * b + c, off = den ? 0.5 * (a - c) / den : 0;
        const v = b - 0.25 * (a - c) * off;
        if (b <= a && b <= c) rMin = Math.min(rMin, v); else rMax = Math.max(rMax, v);
      }
    }
    rMin = Math.min(rMin, rr[0], rr[rr.length - 1]);
    if (!rMax) rMax = Math.max.apply(null, rr);
    rMax = Math.max(rMax, rr[0]);
    // one launch is always a turning point when γ = 0 — the parabola cannot see it from one side
    if (Math.abs(gm) < 1e-6) { if (v0 < vc) rMax = Math.max(rMax, r0); else rMin = Math.min(rMin, r0); }
    const aM = bound ? (rMin + rMax) / 2 : NaN;
    const eM = bound ? (rMax - rMin) / (rMax + rMin) : NaN;
    // specific energy and angular momentum, start and end — the conservation check
    const en = q => (q[3] * q[3] + q[4] * q[4]) / 2 - GM / Math.hypot(q[1], q[2]);
    const hm = q => q[1] * q[4] - q[2] * q[3];
    const pl = pts[pts.length - 1];
    // Kepler II: sweep areas in equal times, by summing the triangles actually swept
    const Tsw = bound && !drag ? (T || Tk) : Math.min(t, (drag ? Tloc0 : t));
    const NS = 12, dtS = Tsw / NS, areas = [];
    if (end !== 'crash' || t > 0) {
      let k = 0, A = 0, tb = dtS;
      for (let i = 1; i < pts.length && k < NS; i++) {
        const q0 = pts[i - 1], q1 = pts[i];
        if (q1[0] <= tb) { A += 0.5 * (q0[1] * q1[2] - q0[2] * q1[1]); continue; }
        // split the step at the boundary (linear in time is enough at 360 steps a turn)
        const fr = (tb - q0[0]) / (q1[0] - q0[0]);
        const mx = q0[1] + (q1[1] - q0[1]) * fr, my = q0[2] + (q1[2] - q0[2]) * fr;
        A += 0.5 * (q0[1] * my - q0[2] * mx);
        areas.push({ A: A, t0: tb - dtS, t1: tb });
        A = 0.5 * (mx * q1[2] - my * q1[1]); k++; tb += dtS;
        while (q1[0] > tb && k < NS) { areas.push({ A: 0, t0: tb - dtS, t1: tb }); k++; tb += dtS; }
      }
      if (k < NS && end === 'closed') areas.push({ A: A, t0: tb - dtS, t1: tb });
    }
    let aDev = 0;
    if (areas.length > 2) {
      const full = areas.filter(x => x.A > 0), mean = full.reduce((u, x) => u + x.A, 0) / full.length;
      full.forEach(x => { aDev = Math.max(aDev, Math.abs(x.A / mean - 1)); });
    }
    // Newton's cannon: how far round the ground it went before landing
    const rangeKm = end === 'crash' ? Math.abs(th) * R / 1e3 : 0;
    return {
      P, GM, R, h0, r0, v0, vc, ve, gm, drag, beta, bound, eps0, a0, Tk,
      pts, rr, T: T || 0, end, tEnd: pl[0], rMin, rMax, aM, eM,
      E0: en(pts[0]), E1: en(pl), H0: hm(pts[0]), H1: hm(pl),
      areas, aDev, rangeKm, dragOrbits, Tloc0, th, iMid,
      vPeri: bound ? Math.sqrt(GM * (2 / rMin - 1 / aM)) : NaN,
      vApo: bound ? Math.sqrt(GM * (2 / rMax - 1 / aM)) : NaN
    };
  }
  /* sample the stored run at time t (linear between RK4 steps) */
  function orbitAt(O, t) {
    const P = O.pts;
    let lo = 0, hi = P.length - 1;
    if (t <= P[0][0]) return P[0];
    if (t >= P[hi][0]) return P[hi];
    while (hi - lo > 1) { const m = (lo + hi) >> 1; if (P[m][0] <= t) lo = m; else hi = m; }
    const a = P[lo], b = P[hi], f = (t - a[0]) / (b[0] - a[0]);
    return [t, a[1] + (b[1] - a[1]) * f, a[2] + (b[2] - a[2]) * f, a[3] + (b[3] - a[3]) * f, a[4] + (b[4] - a[4]) * f];
  }

  /* ---------------- a binary star, both bodies integrated ----------------
     Masses in solar masses, separation in AU. Launched from apastron with
     the relative speed that gives the chosen eccentricity; each star then
     carries its own momentum about the fixed centre of mass. */
  const MSUN = 1.989e30, AU = 1.496e11, YR = 3.156e7;
  function runBinary(p) {
    const m1 = p.M1 * MSUN, m2 = p.M2 * MSUN, M = m1 + m2, GMt = GRAV * M;
    const a = p.aAU * AU, e = p.ecc, rA = a * (1 + e);
    const vrel = Math.sqrt(GMt * (1 - e) / (a * (1 + e)));
    // positions and velocities about the centre of mass
    const f1 = m2 / M, f2 = m1 / M;
    let s = [-f1 * rA, 0, 0, -f1 * vrel, f2 * rA, 0, 0, f2 * vrel];
    const der = (st) => {
      const dx = st[4] - st[0], dy = st[5] - st[1], r2 = dx * dx + dy * dy, r3 = r2 * Math.sqrt(r2);
      return [st[2], st[3], GRAV * m2 * dx / r3, GRAV * m2 * dy / r3, st[6], st[7], -GRAV * m1 * dx / r3, -GRAV * m1 * dy / r3];
    };
    const Tk = TAU * Math.sqrt(a * a * a / GMt);
    const pts = [[0].concat(s)];
    let t = 0, th = 0, prev = Math.atan2(s[5] - s[1], s[4] - s[0]), T = 0;
    while (t < 2.05 * Tk) {
      const dx = s[4] - s[0], dy = s[5] - s[1], r = Math.hypot(dx, dy);
      const hs = TAU * Math.sqrt(r * r * r / GMt) / 500;
      const k1 = der(s), k2 = der(s.map((v, i) => v + k1[i] * hs / 2)), k3 = der(s.map((v, i) => v + k2[i] * hs / 2)),
            k4 = der(s.map((v, i) => v + k3[i] * hs));
      s = s.map((v, i) => v + hs / 6 * (k1[i] + 2 * k2[i] + 2 * k3[i] + k4[i]));
      t += hs;
      const ang = Math.atan2(s[5] - s[1], s[4] - s[0]); let da = ang - prev;
      if (da > Math.PI) da -= TAU; if (da < -Math.PI) da += TAU;
      if (!T && th < TAU && th + da >= TAU) T = t - hs + hs * (TAU - th) / da;
      th += da; prev = ang;
      pts.push([t].concat(s));
    }
    // the centre of mass, checked rather than assumed
    let comDrift = 0;
    pts.forEach(q => { comDrift = Math.max(comDrift, Math.hypot(m1 * q[1] + m2 * q[5], m1 * q[2] + m2 * q[6]) / M); });
    let r1max = 0, r2max = 0, v1max = 0, v2max = 0;
    pts.forEach(q => { r1max = Math.max(r1max, Math.hypot(q[1], q[2])); r2max = Math.max(r2max, Math.hypot(q[5], q[6]));
                       v1max = Math.max(v1max, Math.hypot(q[3], q[4])); v2max = Math.max(v2max, Math.hypot(q[7], q[8])); });
    return { m1, m2, M, a, e, T, Tk, pts, comDrift, r1max, r2max, v1max, v2max, f1, f2 };
  }
  function binAt(B, t) {
    const P = B.pts, tt = ((t % B.T) + B.T) % B.T;
    let lo = 0, hi = P.length - 1;
    while (hi - lo > 1) { const m = (lo + hi) >> 1; if (P[m][0] <= tt) lo = m; else hi = m; }
    const a = P[lo], b = P[hi], f = (tt - a[0]) / (b[0] - a[0]);
    return a.map((v, i) => v + (b[i] - v) * f);
  }

  /* ---------------- inside the Earth: PREM ----------------
     The Preliminary Reference Earth Model's density polynomials (Dziewonski
     & Anderson 1981), x = r / 6371 km, ρ in g/cm³. The enclosed mass is
     integrated shell by shell, so g(r) = G m(r)/r² comes out of the model —
     including the surprise that g RISES on the way down to the core. */
  const RE = 6.371e6, ME = 5.972e24;
  const PREM = [
    [1221.5, x => 13.0885 - 8.8381 * x * x, 'inner core', [255, 214, 120]],
    [3480.0, x => 12.5815 - 1.2638 * x - 3.6426 * x * x - 5.5281 * x * x * x, 'outer core (liquid)', [245, 150, 60]],
    [5701.0, x => 7.9565 - 6.4761 * x + 5.5283 * x * x - 3.0807 * x * x * x, 'lower mantle', [196, 88, 52]],
    [5771.0, x => 5.3197 - 1.4836 * x, 'transition zone', [170, 78, 50]],
    [5971.0, x => 11.2494 - 8.0298 * x, 'transition zone', [170, 78, 50]],
    [6151.0, x => 7.1089 - 3.8045 * x, 'upper mantle', [150, 72, 50]],
    [6346.6, x => 2.6910 + 0.6924 * x, 'upper mantle', [150, 72, 50]],
    [6356.0, () => 2.900, 'crust', [120, 110, 100]],
    [6371.0, () => 2.600, 'crust', [120, 110, 100]]
  ];
  function premRho(r) {
    const km = r / 1e3, x = km / 6371;
    for (let i = 0; i < PREM.length; i++) if (km <= PREM[i][0]) return PREM[i][1](x) * 1000;
    return 0;
  }
  const GTAB = (() => {
    // m(r) by Simpson on a fine grid, then g = G m / r², tabulated every 10 km
    const N = 6371, dr = 1e3;
    const m = new Float64Array(N + 1), g = new Float64Array(N + 1);
    for (let i = 1; i <= N; i++) {
      const ra = (i - 1) * dr, rb = i * dr, rm = (ra + rb) / 2;
      const s = 4 * Math.PI * (ra * ra * premRho(ra + 1e-6) + 4 * rm * rm * premRho(rm) + rb * rb * premRho(rb - 1e-6)) / 6 * dr;
      m[i] = m[i - 1] + s;
    }
    for (let i = 1; i <= N; i++) g[i] = GRAV * m[i] / Math.pow(i * dr, 2);
    return { m, g, M: m[N] };
  })();
  function gInside(r, model) {
    if (r >= RE) return GRAV * (model === 'prem' ? GTAB.M : ME) / (r * r);
    if (model !== 'prem') return GRAV * ME * r / (RE * RE * RE);
    const x = r / 1e3, i = Math.floor(x), f = x - i;
    if (i >= 6371) return GTAB.g[6371];
    const g0 = i === 0 ? 0 : GTAB.g[i], g1 = GTAB.g[i + 1];
    return g0 + (g1 - g0) * f;
  }
  /* a ball dropped into a straight frictionless tunnel whose closest point
     to the centre is d: integrate s̈ = −g(r)·s/r along it for one period */
  function runTunnel(p) {
    const d = p.dkm * 1e3, half = Math.sqrt(Math.max(0, RE * RE - d * d));
    const model = p.model;
    let s = half * 0.9999, v = 0, t = 0, T = 0, tHalf = 0, vmax = 0;
    const acc = x => { const r = Math.hypot(x, d); return -gInside(r, model) * x / r; };
    const pts = [[0, s, 0]];
    const h = 2.0;
    let prevV = 0;
    while (t < 12000) {
      const k1v = acc(s), k1x = v;
      const k2v = acc(s + k1x * h / 2), k2x = v + k1v * h / 2;
      const k3v = acc(s + k2x * h / 2), k3x = v + k2v * h / 2;
      const k4v = acc(s + k3x * h), k4x = v + k3v * h;
      const ns = s + h / 6 * (k1x + 2 * k2x + 2 * k3x + k4x), nv = v + h / 6 * (k1v + 2 * k2v + 2 * k3v + k4v);
      // turning point on the far side = half a period; back home = one period
      if (prevV < 0 && nv >= 0 && !tHalf) tHalf = t + h * (-prevV) / (nv - prevV);
      if (tHalf && prevV > 0 && nv <= 0 && !T) T = t + h * prevV / (prevV - nv);
      s = ns; v = nv; t += h; prevV = nv;
      vmax = Math.max(vmax, Math.abs(v));
      if (pts.length < 30000) pts.push([t, s, v]);
      if (T) break;
    }
    return { d, half, T, tHalf, vmax, pts, model };
  }
  function tunnelAt(Tn, t) {
    const P = Tn.pts, tt = Tn.T ? ((t % Tn.T) + Tn.T) % Tn.T : t;
    let lo = 0, hi = P.length - 1;
    while (hi - lo > 1) { const m = (lo + hi) >> 1; if (P[m][0] <= tt) lo = m; else hi = m; }
    const a = P[lo], b = P[hi], f = clamp((tt - a[0]) / (b[0] - a[0]), 0, 1);
    return [tt, a[1] + (b[1] - a[1]) * f, a[2] + (b[2] - a[2]) * f];
  }
  /* the one-way transit time for a tunnel at offset d, for the landscape plot */
  const TRANSIT = {};
  function transitCurve(model) {
    if (TRANSIT[model]) return TRANSIT[model];
    const out = [];
    for (let dk = 0; dk <= 6000; dk += 250) out.push([dk, runTunnel({ dkm: dk, model: model }).tHalf / 60]);
    return (TRANSIT[model] = out);
  }

  /* ---------------- the Cavendish torsion balance ----------------
     Two small lead spheres on a light rod (half-length d) hang from a fibre
     of torsion constant κ. Two large spheres sit on a swivel: position I
     puts each beside a small sphere on one side, position II on the other.
     The torque is summed over ALL FOUR pairs — each small sphere is also
     pulled, the wrong way, by the large sphere on the far side — and the
     rod obeys  I θ̈ = τ(θ) − κθ − cθ̇ . The laser spot on a scale L away
     moves by L·tan 2θ. The lab then does what the student does: finds the
     turning points of the spot, the period from them, the rest point from
     three successive turning points, and G from the textbook formula. */
  const RHO_PB = 11340;
  function cavGeom(p) {
    const m = p.mg / 1000, M = p.MB, d = 0.050, b = p.bmm / 1000;
    const rs = Math.cbrt(3 * m / (4 * Math.PI * RHO_PB)), RB = Math.cbrt(3 * M / (4 * Math.PI * RHO_PB));
    const I = 2 * m * d * d;
    const T0 = p.T0min * 60, kappa = I * Math.pow(TAU / T0, 2);
    const c = 2 * p.zeta * Math.sqrt(kappa * I);
    return { m, M, d, b, rs, RB, I, T0, kappa, c, Lm: p.Lm };
  }
  const SWV = { I: 1, II: -1 };
  function swivelAngle(Gm, pos) {
    return pos === 'away' ? Math.PI / 2 : SWV[pos] * Math.atan2(Gm.b, Gm.d);
  }
  function bigPos(Gm, psi) {
    // the large spheres ride a swivel at radius √(d² + b²): position I puts
    // each one b from a small sphere on one side, position II on the other,
    // and 'away' (90°) leaves the rod in a symmetric field with no torque
    const rho = Math.hypot(Gm.d, Gm.b);
    return [[rho * Math.cos(psi), rho * Math.sin(psi), 0], [-rho * Math.cos(psi), -rho * Math.sin(psi), 0]];
  }
  function cavTorque(Gm, th, psi) {
    const bp = bigPos(Gm, psi);
    const c = Math.cos(th), s = Math.sin(th);
    const sm = [[Gm.d * c, Gm.d * s, 0], [-Gm.d * c, -Gm.d * s, 0]];
    let tz = 0;
    sm.forEach(q => bp.forEach(B => {
      const dx = B[0] - q[0], dy = B[1] - q[1], r = Math.hypot(dx, dy), F = GRAV * Gm.M * Gm.m / (r * r * r);
      tz += q[0] * F * dy - q[1] * F * dx;
    }));
    return tz;
  }
  function cavStep(Gm, st, h, psi) {
    const f = (th, w) => [w, (cavTorque(Gm, th, psi) - Gm.kappa * th - Gm.c * w) / Gm.I];
    const [th, w] = st;
    const k1 = f(th, w), k2 = f(th + k1[0] * h / 2, w + k1[1] * h / 2), k3 = f(th + k2[0] * h / 2, w + k2[1] * h / 2), k4 = f(th + k3[0] * h, w + k3[1] * h);
    return [th + h / 6 * (k1[0] + 2 * k2[0] + 2 * k3[0] + k4[0]), w + h / 6 * (k1[1] + 2 * k2[1] + 2 * k3[1] + k4[1])];
  }
  /* the rest angle for the spheres at ψ: τ(θ) = κθ, by fixed-point iteration
     (it converges because the gravitational torque gradient is far below κ) */
  function cavRest(Gm, psi) {
    let t = 0;
    for (let i = 0; i < 60; i++) t = cavTorque(Gm, t, psi) / Gm.kappa;
    return t;
  }
  const spotOf = (Gm, th) => Gm.Lm * Math.tan(2 * th);
  /* from a spot record, the rest point. Three successive turning points of
     an exponentially decaying swing, S1, S2, S3, satisfy
     (S3 − S∞)/(S2 − S∞) = (S2 − S∞)/(S1 − S∞), so
         S∞ = (S1·S3 − S2²) / (S1 + S3 − 2·S2)
     exactly, however heavy the damping. The period is the time from S1 to S3. */
  function restPoint(tp) {
    if (tp.length < 3) return null;
    const n = tp.length, a = tp[n - 3], b = tp[n - 2], c = tp[n - 1];
    const den = a[1] + c[1] - 2 * b[1];
    const S = Math.abs(den) > 1e-12 ? (a[1] * c[1] - b[1] * b[1]) / den : (a[1] + 2 * b[1] + c[1]) / 4;
    /* the same three points give the damping: each half-swing shrinks by
       e^(−λ), and ζ = λ/√(π² + λ²). The measured period is the DAMPED one,
       T_d = T₀/√(1 − ζ²), and the formula for G needs T₀. */
    const rr = Math.abs((c[1] - S) / (b[1] - S)), lam = rr > 0 && rr < 1 ? -Math.log(rr) : 0;
    return { S: S, T: (c[0] - a[0]), zeta: lam / Math.sqrt(Math.PI * Math.PI + lam * lam) };
  }
  /* the whole protocol, offline: settle in I, swing to II, settle —
     exactly what a student does over an afternoon */
  function cavProtocol(p) {
    const Gm = cavGeom(p);
    const h = Gm.T0 / 400;
    let st = [0, 0];
    // start at rest in the I equilibrium's neighbourhood, having been released from zero
    const rec = [], tpI = [], tpII = [];
    let t = 0, prevW = 0;
    const phase = (pos, dur, tp) => {
      const tEnd = t + dur;
      while (t < tEnd) {
        const ns = cavStep(Gm, st, h, pos);
        if (prevW !== 0 && Math.sign(ns[1]) !== Math.sign(prevW)) {
          const f = prevW / (prevW - ns[1]);
          const thTp = st[0] + (ns[0] - st[0]) * f;
          tp.push([t + f * h, spotOf(Gm, thTp)]);
        }
        prevW = ns[1]; st = ns; t += h;
        rec.push([t, spotOf(Gm, st[0]), pos]);
      }
    };
    phase(swivelAngle(Gm, 'I'), 4 * Gm.T0, tpI);
    prevW = 0;
    phase(swivelAngle(Gm, 'II'), 4 * Gm.T0, tpII);
    const rI = restPoint(tpI), rII = restPoint(tpII);
    const dS = rI && rII ? rI.S - rII.S : 0, Tm = rII ? rII.T : Gm.T0;
    const Gnaive = Math.PI * Math.PI * Gm.b * Gm.b * Gm.d * dS / (Gm.M * Tm * Tm * Gm.Lm);
    const beta = Math.pow(Gm.b, 3) / Math.pow(Gm.b * Gm.b + 4 * Gm.d * Gm.d, 1.5);
    const zm = rII ? rII.zeta : 0;
    return { Gm, rec, tpI, tpII, rI, rII, dS, Tm, Gnaive, beta, zm, Gcorr: Gnaive / ((1 - beta) * (1 - zm * zm)) };
  }

  /* ---------------- shared drawing helpers ---------------- */
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
  const km = (m, dp) => (m / 1e3).toLocaleString('en-US', { maximumFractionDigits: dp == null ? 0 : dp, minimumFractionDigits: dp == null ? 0 : dp });
  function tfmt(s) {
    const a = Math.abs(s);
    if (a < 120) return s.toFixed(1) + ' s';
    if (a < 7200) return (s / 60).toFixed(2) + ' min';
    if (a < 172800) return (s / 3600).toFixed(3) + ' h';
    if (a < 3.156e7 * 2) return (s / 86400).toFixed(3) + ' d';
    return (s / 3.156e7).toFixed(3) + ' yr';
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
  /* a satellite: a gold-foil bus, two solar wings and an antenna dish */
  function satellite(F, at, tang, sz, planeN) {
    const t = R3.norm(tang);
    let z = planeN ? R3.norm(planeN) : [0, 0, 1];
    if (Math.abs(R3.dot(z, t)) > 0.98) z = [1, 0, 0];
    const nrm = R3.norm(R3.cross(z, t));
    const ax = [t, nrm, z];
    R3.box(F, at, [sz, sz * 0.8, sz * 0.8], '#D6B055', { shadow: false, ambient: 0.45, axes: ax });
    [1, -1].forEach(sg => {
      R3.box(F, R3.add(at, R3.scale(z, sg * sz * 0.95)), [sz * 0.12, sz * 0.12, sz * 0.5], '#9AA6B8', { shadow: false, axes: ax });
      R3.box(F, R3.add(at, R3.scale(z, sg * sz * 1.9)), [sz * 0.9, sz * 0.06, sz * 1.6], '#27488E', { shadow: false, ambient: 0.5, axes: ax });
    });
    R3.cylinder(F, R3.add(at, R3.scale(nrm, -sz * 0.4)), R3.add(at, R3.scale(nrm, -sz * 0.62)), sz * 0.34, '#E6ECF4',
                { segments: 16, shadow: false, ambient: 0.5 });
  }

  /* ======================= the orbit bench ======================= */
  function drawOrbit(S, g) {
    const ctx = g.ctx, th = g.theme, p = S.p, W = g.w, H = g.h, O = S.O, cam = S.cam;
    const narrow = W < 660;
    drawSky(ctx, cam, W, H);
    const F = R3.Frame(ctx, cam, { ambient: 0.3, floorZ: null });
    const R = O.R;
    let rDisp = O.end === 'closed' ? O.rMax : O.end === 'escape' ? Math.max.apply(null, O.rr) * 0.8
              : O.end === 'crash' ? Math.max(O.r0, O.rMax) : O.r0;
    rDisp = Math.max(rDisp, R * 1.08);
    // on a mission the frame holds still: it covers the target orbit and everything already flown
    const M = S.M, burnt = M && M.burns.length > 0;
    if (M) {
      if (M.plan) rDisp = Math.max(rDisp, M.plan.r2 * 1.03);
      if (M.tgt) rDisp = Math.max(rDisp, M.tgt.rT * 1.08);
      M.ghosts.forEach(gp => gp.forEach(q => { rDisp = Math.max(rDisp, Math.min(Math.hypot(q[0], q[1]), 8 * R)); }));
    }
    const k = 1.0 / rDisp;
    S._k = k;
    const Rw = R * k;
    /* is a world point hidden behind the planet? (the segment from the eye
       to it passes through the sphere) — labels and markers ask this, so
       nothing floats in front of the globe that is really behind it */
    const hidden = (pt) => {
      const e = cam.eye, d = R3.sub(pt, e), a = R3.dot(d, d), b = 2 * R3.dot(e, d), c = R3.dot(e, e) - Rw * Rw * 0.995;
      const disc = b * b - 4 * a * c;
      if (disc <= 0) return false;
      const t1 = (-b - Math.sqrt(disc)) / (2 * a);
      return t1 > 0 && t1 < 1;
    };
    const now = orbitAt(O, S.ts);
    /* the orbit plane is tipped by the inclination about the line through the
       launch point (the x axis): the dynamics are planar, only the frame turns */
    const ci = Math.cos((p.incO || 0) * Math.PI / 180), si = Math.sin((p.incO || 0) * Math.PI / 180);
    const cw = Math.cos((p.argP || 0) * Math.PI / 180), sw = Math.sin((p.argP || 0) * Math.PI / 180);
    // first turn within the plane by the argument of perigee ω, then tip the plane by i
    const rot = (v) => { const x = v[0] * cw - v[1] * sw, y = v[0] * sw + v[1] * cw; return [x, y * ci - v[2] * si, y * si + v[2] * ci]; };
    const planeN = rot([0, 0, 1]);
    const clk = S.clock || S.ts;
    const spin = p.spin ? TAU * clk / O.P.day : 0;
    const bodyId = p.body;
    // the planet, ray-traced, with its air glowing at the limb
    const tr = traceBody(cam, W, H, [0, 0, 0], Rw, bodyId, spin);
    F.push([0, 0, 0], () => {
      if (!tr) return;
      if (bodyId === 'earth' || bodyId === 'jupiter') {
        const hc = bodyId === 'earth' ? '90,160,255' : '230,200,160';
        const gr = ctx.createRadialGradient(tr.cx, tr.cy, tr.rp * 0.96, tr.cx, tr.cy, tr.rp * 1.12);
        gr.addColorStop(0, 'rgba(' + hc + ',0.0)'); gr.addColorStop(0.25, 'rgba(' + hc + ',0.38)'); gr.addColorStop(1, 'rgba(' + hc + ',0)');
        ctx.fillStyle = gr; ctx.beginPath(); ctx.arc(tr.cx, tr.cy, tr.rp * 1.12, 0, TAU); ctx.fill();
      }
      ctx.drawImage(tr.canvas, tr.x, tr.y, tr.w, tr.h);
    });
    // the equatorial plane, faintly, so the orbit has a floor to read against
    const W3 = (x, y) => R3.scale(rot([x, y, 0]), k);
    // the whole path
    const dec = Math.max(1, Math.floor(O.pts.length / 500));
    const path = [];
    for (let i = 0; i < O.pts.length; i += dec) path.push(W3(O.pts[i][1], O.pts[i][2]));
    path.push(W3(O.pts[O.pts.length - 1][1], O.pts[O.pts.length - 1][2]));
    const pathCol = O.drag ? (u) => RX.mix('#3DD6F5', '#FF6B6B', u) : O.end === 'escape' ? '#F5B451' : O.end === 'crash' ? '#FF8A6B' : '#3DD6F5';
    path3(F, path, pathCol, { alpha: 0.55, width: 1.3 });
    // Kepler's equal areas: the sectors swept in equal times, from the planet outward
    if (p.sectors && O.areas.length && !O.drag) {
      const cur = O.areas.findIndex(a => S.ts >= a.t0 && S.ts < a.t1);
      O.areas.forEach((a, i) => {
        if (!(a.A > 0)) return;
        const outer = [];
        const nS = 18;
        for (let j = 0; j <= nS; j++) { const q = orbitAt(O, a.t0 + (a.t1 - a.t0) * j / nS); outer.push(q); }
        const col = i === cur ? (i % 2 ? 'rgba(160,140,255,.40)' : 'rgba(61,214,245,.40)') : (i % 2 ? 'rgba(160,140,255,.15)' : 'rgba(61,214,245,.15)');
        for (let j = 0; j < nS; j += 3) {
          const piece = outer.slice(j, j + 4), poly = [];
          piece.forEach(q => poly.push(W3(q[1], q[2])));
          for (let m = piece.length - 1; m >= 0; m--) {
            const q = piece[m], rq = Math.hypot(q[1], q[2]);
            poly.push(W3(q[1] / rq * R * 1.004, q[2] / rq * R * 1.004));
          }
          flatPoly(F, poly, col);
        }
        const q0 = outer[0], r0q = Math.hypot(q0[1], q0[2]);
        path3(F, [W3(q0[1] / r0q * R, q0[2] / r0q * R), W3(q0[1], q0[2])], '#8FA4CE', { alpha: 0.45, width: 1, chunk: 2 });
      });
    }
    // the bright trail just behind the satellite
    const trail = [];
    const tBack = O.end === 'closed' ? O.T * 0.12 : O.Tloc0 * 0.12;
    for (let j = 0; j <= 24; j++) {
      let tt = S.ts - tBack * (1 - j / 24);
      if (O.end === 'closed') tt = ((tt % O.T) + O.T) % O.T; else if (tt < 0) continue;
      const q = orbitAt(O, tt); trail.push(W3(q[1], q[2]));
    }
    if (trail.length > 1) path3(F, trail, '#E8FBFF', { alpha: 0.95, width: 2.2, glow: 8, chunk: 4 });
    // launch site: altitude marker from the ground up to the launch point
    const r0k = O.r0 * k, L0 = W3(O.r0, 0);
    if (!burnt) path3(F, [W3(R, 0), L0], '#F5B451', { alpha: 0.8, width: 1.2, dash: [4, 3], chunk: 1 });
    if (!burnt) R3.sphere(F, L0, 0.012, '#F5B451', { shadow: false });
    // the mission: what was flown before each burn, the burns themselves, the target
    if (M) {
      M.ghosts.forEach((gp, gi) => path3(F, gp.map(q => W3(q[0], q[1])), '#8FA4CE', { alpha: 0.18 + 0.1 * gi / Math.max(1, M.ghosts.length), width: 1, chunk: 6 }));
      M.burns.forEach((b, bi) => {
        const bp = W3(b.x, b.y);
        F.push(bp, () => { const q = cam.project(bp); if (!q.ok) return;
          const gr = ctx.createRadialGradient(q.x, q.y, 0, q.x, q.y, 10); gr.addColorStop(0, 'rgba(255,230,160,.95)'); gr.addColorStop(1, 'rgba(255,120,40,0)');
          ctx.fillStyle = gr; ctx.beginPath(); ctx.arc(q.x, q.y, 10, 0, TAU); ctx.fill(); }, -0.02);
        if (!hidden(bp)) R3.label(F, bp, 'burn ' + (bi + 1) + ' · ' + (b.dv >= 0 ? '+' : '') + (b.dv / 1e3).toFixed(3) + ' km/s ' + b.dir, '#FFC870', { size: 9, dy: 14 + (bi % 2) * 11 });
      });
      if (M.plan) {
        const ring = []; for (let i = 0; i <= 120; i++) { const a = i / 120 * TAU; ring.push(W3(M.plan.r2 * Math.cos(a), M.plan.r2 * Math.sin(a))); }
        path3(F, ring, '#7CF0B0', { alpha: 0.55, width: 1.2, dash: [5, 4], chunk: 4 });
        R3.label(F, W3(-M.plan.r2 * 0.7, M.plan.r2 * 0.72), 'target orbit ' + km(M.plan.r2 - R) + ' km', '#7CF0B0', { size: 9 });
      }
      if (M.tgt) {
        const ta = M.tgt.th0 + M.tgt.n * S.clock, tp = W3(M.tgt.rT * Math.cos(ta), M.tgt.rT * Math.sin(ta));
        satellite(F, tp, rot([-Math.sin(ta), Math.cos(ta), 0]), 0.026, planeN);
        R3.sphere(F, tp, 0.012, M.docked ? '#7CF0B0' : '#FF9A5A', { shadow: false });
        if (!hidden(tp)) R3.label(F, tp, M.docked ? 'DOCKED' : 'target', M.docked ? '#7CF0B0' : '#FFB070', { size: 9.5, dy: 18 });
      }
    }
    if (!burnt && !hidden(L0)) R3.label(F, L0, 'launch · h = ' + km(O.h0) + ' km', '#F5B451', { size: 9.5, dy: 16 });
    // apsides
    if (O.end === 'closed' && O.eM > 0.004) {
      let iMin = 0, iMax = 0;
      O.rr.forEach((r, i) => { if (r < O.rr[iMin]) iMin = i; if (r > O.rr[iMax]) iMax = i; });
      const pp = O.pts[iMin], pa = O.pts[iMax];
      R3.sphere(F, W3(pp[1], pp[2]), 0.01, '#7CF0B0', { shadow: false });
      R3.sphere(F, W3(pa[1], pa[2]), 0.01, '#FF8FB0', { shadow: false });
      if (!hidden(W3(pp[1], pp[2]))) R3.label(F, W3(pp[1], pp[2]), 'perigee ' + km(O.rMin - R) + ' km · ' + (O.vPeri / 1e3).toFixed(2) + ' km/s', '#7CF0B0', { size: 9, dy: -13 });
      if (!hidden(W3(pa[1], pa[2]))) R3.label(F, W3(pa[1], pa[2]), 'apogee ' + km(O.rMax - R) + ' km · ' + (O.vApo / 1e3).toFixed(2) + ' km/s', '#FF8FB0', { size: 9, dy: -13 });
      path3(F, [W3(pp[1], pp[2]), W3(pa[1], pa[2])], '#8FA4CE', { alpha: 0.35, width: 1, dash: [2, 4], chunk: 1 });
    }
    // the ground station directly under the launch longitude, carried round by the spin
    if (p.spin) {
      const gs = [Rw * Math.cos(spin), Rw * Math.sin(spin), 0];
      const gsVis = !hidden(R3.scale(gs, 1.02));
      if (gsVis) R3.sphere(F, R3.scale(gs, 1.01), 0.011, '#FF5A7A', { shadow: false });
      const sub = R3.scale(R3.norm(W3(now[1], now[2])), Rw * 1.002);
      path3(F, [W3(now[1], now[2]), sub], '#FF5A7A', { alpha: 0.5, width: 1, dash: [3, 3], chunk: 1 });
      /* the ground track: where the satellite has been overhead, on the Earth
         as it turns — a point in space, taken into the Earth's frame at the
         moment it was flown over, then carried round to now */
      if (!O.drag) {
        const wE = TAU / O.P.day, n = 360, runs = [[]];
        let span = Math.min(clk, (O.end === 'closed' ? O.T : O.Tloc0) * 3);
        if (S.M && S.M.burns.length) span = Math.min(span, S.ts);          // only since the last burn
        for (let j = 0; j <= n; j++) {
          const tt = clk - span * (1 - j / n);
          let ts2 = O.end === 'closed' ? ((tt - (clk - S.ts)) % O.T + O.T) % O.T : tt - (clk - S.ts);
          if (ts2 < 0) continue;
          const q = orbitAt(O, ts2), w = R3.norm(W3(q[1], q[2]));
          const a = wE * (clk - tt), c = Math.cos(a), s = Math.sin(a);
          const e = R3.scale([w[0] * c - w[1] * s, w[0] * s + w[1] * c, w[2]], Rw * 1.004);
          if (R3.dot(e, cam.eye) > Rw * Rw * 1.02) runs[runs.length - 1].push(e); else if (runs[runs.length - 1].length) runs.push([]);
        }
        runs.forEach(rn2 => { if (rn2.length > 1) path3(F, rn2, '#FFD36B', { alpha: 0.85, width: 1.6, chunk: 4, bias: -0.01 }); });
      }
      if (gsVis) R3.label(F, R3.scale(gs, 1.0), 'ground station', '#FF9AB0', { size: 8.5, dy: 12 });
    }
    // the satellite, and the two vectors that decide everything
    const ps = W3(now[1], now[2]), rn = Math.hypot(now[1], now[2]), vn = Math.hypot(now[3], now[4]);
    const sz = 0.034;
    const satHidden = hidden(ps);
    // is it in the planet's shadow? (behind the planet, as seen from the Sun)
    const pw = rot([now[1], now[2], 0]), along = R3.dot(pw, SUN);
    const eclipsed = along < 0 && Math.hypot(pw[0] - SUN[0] * along, pw[1] - SUN[1] * along, pw[2] - SUN[2] * along) < R;
    if (!satHidden && (O.end !== 'crash' || S.ts < O.tEnd)) F.push(ps, () => {
      const q = cam.project(ps); if (!q.ok) return;
      const gr = ctx.createRadialGradient(q.x, q.y, 0, q.x, q.y, 16);
      gr.addColorStop(0, eclipsed ? 'rgba(120,140,190,.45)' : 'rgba(255,245,210,.7)'); gr.addColorStop(1, 'rgba(255,245,210,0)');
      ctx.fillStyle = gr; ctx.beginPath(); ctx.arc(q.x, q.y, 16, 0, TAU); ctx.fill();
    }, 0.02);
    if (O.end !== 'crash' || S.ts < O.tEnd) satellite(F, ps, rot([now[3], now[4], 0]), sz, planeN);
    if (eclipsed && !satHidden) R3.label(F, ps, 'in the shadow · eclipse', '#8FA4CE', { size: 9, dy: 22 });
    if (p.arrows && !satHidden) {
      const vdir = R3.norm(rot([now[3], now[4], 0]));
      R3.arrow(F, ps, R3.add(ps, R3.scale(vdir, 0.26 * vn / O.vc)), 0.006, '#7CF0B0', { label: 'v ' + (vn / 1e3).toFixed(2) + ' km/s', labelSize: 9 });
      const gl = clamp(0.22 * Math.pow(O.r0 / rn, 2), 0.04, 0.5);
      R3.arrow(F, ps, R3.add(ps, R3.scale(R3.norm(rot([-now[1], -now[2], 0])), gl)), 0.006, '#F5B451', { label: 'g ' + (O.GM / (rn * rn)).toFixed(2), labelSize: 9 });
    }
    if (O.end === 'crash' && S.ts >= O.tEnd - 1) {
      const lp = O.pts[O.pts.length - 1];
      const ip = W3(lp[1], lp[2]);
      F.push(ip, () => {
        const q = cam.project(ip); if (!q.ok) return;
        const gr = ctx.createRadialGradient(q.x, q.y, 0, q.x, q.y, 18);
        gr.addColorStop(0, 'rgba(255,220,150,.95)'); gr.addColorStop(0.4, 'rgba(255,110,60,.6)'); gr.addColorStop(1, 'rgba(255,60,40,0)');
        ctx.fillStyle = gr; ctx.beginPath(); ctx.arc(q.x, q.y, 18, 0, TAU); ctx.fill();
      }, -0.05);
      R3.label(F, ip, 'lands ' + km(O.rangeKm * 1e3) + ' km downrange', '#FF8A6B', { size: 9.5, dy: -16 });
    }
    // velocity-tip and launch-point handles (drag to launch differently)
    const lq = cam.project(L0);
    const tipDir = rot([Math.sin(O.gm), Math.cos(O.gm), 0]);
    const tipW = R3.add(L0, R3.scale(tipDir, 0.26 * O.v0 / O.vc));
    F.render();

    const tq = cam.project(tipW);
    const qx = cam.project(R3.add(L0, rot([0.1, 0, 0]))), qy = cam.project(R3.add(L0, rot([0, 0.1, 0])));
    if (lq.ok && tq.ok && qx.ok && qy.ok && !burnt) {
      const ax = (a, b) => { const dx = b.x - a.x, dy = b.y - a.y, l = Math.hypot(dx, dy) || 1; return { ux: dx / l, uy: dy / l }; };
      S._axR = ax(lq, qx); S._axT = ax(lq, qy);
      const ring = (q, id, c) => {
        const on = g.dragging === id;
        ctx.save(); ctx.strokeStyle = on ? th.text : g.alpha(c, .85); ctx.lineWidth = on ? 2.2 : 1.5;
        ctx.setLineDash(on ? [] : [3, 2]);
        ctx.beginPath(); ctx.arc(q.x, q.y, 11, 0, TAU); ctx.stroke(); ctx.restore();
        g.handle(q.x, q.y, 14, id);
      };
      if (S.ts < O.T * 0.02 || !p.run || g.dragging) ring(tq, 'vel', '#7CF0B0');
      else ring(tq, 'vel', '#4F7F6A');
      ring(lq, 'alt', '#F5B451');
    }

    /* ---------------- header and instrument panels ---------------- */
    const kind = O.end === 'crash' ? (O.bound ? 'Falls back — the ellipse cuts the ground' : 'Hits the ground')
      : O.end === 'reentry' ? 'Orbit decays — re-entry after ' + O.dragOrbits + ' orbits'
      : O.end === 'escape' ? (Math.abs(O.eps0) < 1e-3 * O.GM / O.r0 ? 'Parabolic escape' : 'Hyperbolic escape')
      : O.eM < 0.003 ? 'Circular orbit' : 'Bound ellipse · e = ' + O.eM.toFixed(3);
    const colK = O.end === 'crash' || O.end === 'reentry' ? th.crit : O.end === 'escape' ? th.warn : th.ok;
    header(g, kind,
      O.P.name + ' · launch ' + (O.v0 / 1e3).toFixed(3) + ' km/s = ' + p.vr.toFixed(3) + ' v_c at ' + p.gam.toFixed(0) + '° · v_c ' +
        (O.vc / 1e3).toFixed(3) + ' · v_esc ' + (O.ve / 1e3).toFixed(3) + ' km/s',
      O.drag ? 'air drag ×' + Math.pow(10, p.dragX).toFixed(0) + ' (Cd·A/m = 0.01 m²/kg) so decay fits in a minute'
             : 'RK4, 360 steps per local period · t = ' + tfmt(clk) + ' · inclination ' + (p.incO || 0).toFixed(1) + '°' + (p.spin ? ' · planet turning, ground track in gold' : ''), colK);
    const rows = narrow ? 4 : 7, bw = narrow ? W - 24 : 268, bh = 26 + rows * 15 + 10;
    const row = gPanel(g, 12, H - bh - 30, bw, bh, 'MEASURED FROM THE RUN');
    if (O.end === 'closed') {
      row(0, 'period, timed', tfmt(O.T), th.phys);
      row(1, 'Kepler 2π√(a³/GM)', tfmt(O.Tk));
      row(2, 'a = (r_min + r_max)/2', km(O.aM) + ' km');
      row(3, 'equal areas (12 sectors)', 'within ' + (O.aDev * 100).toExponential(1) + ' %', th.ok);
      if (!narrow) {
        row(4, 'energy per kg, E = −GM/2a', (O.E0 / 1e6).toFixed(3) + ' MJ/kg');
        row(5, 'E drift over the orbit', (Math.abs(O.E1 / O.E0 - 1)).toExponential(1));
        row(6, 'L = r × v drift', (Math.abs(O.H1 / O.H0 - 1)).toExponential(1));
      }
    } else if (O.end === 'escape') {
      const vinf = Math.sqrt(Math.max(0, 2 * O.eps0));
      row(0, 'energy per kg', (O.eps0 / 1e6).toFixed(3) + ' MJ/kg', O.eps0 >= 0 ? th.warn : th.ok);
      row(1, 'speed left at infinity', (vinf / 1e3).toFixed(3) + ' km/s', th.phys);
      row(2, '√(v² − v_esc²)', (Math.sqrt(Math.max(0, O.v0 * O.v0 - O.ve * O.ve)) / 1e3).toFixed(3) + ' km/s');
      row(3, 'closest approach', km(O.rMin - R) + ' km');
      if (!narrow) {
        row(4, 'L = r × v drift', (Math.abs(O.H1 / O.H0 - 1)).toExponential(1));
        row(5, 'launch angle matters?', 'no — only the speed', th.ok);
        row(6, 'E drift', (Math.abs(O.E1 / O.E0 - 1)).toExponential(1));
      }
    } else if (O.end === 'reentry') {
      const mq = O.pts[O.iMid], vm = Math.hypot(mq[3], mq[4]), rm = Math.hypot(mq[1], mq[2]);
      const Em = vm * vm / 2 - O.GM / rm;
      row(0, 'orbits before re-entry (120 km)', String(O.dragOrbits), th.crit);
      row(1, 'speed: ' + km(O.h0) + ' → ' + km(rm - R) + ' km', (O.v0 / 1e3).toFixed(3) + ' → ' + (vm / 1e3).toFixed(3) + ' km/s', th.warn);
      row(2, 'energy per kg lost to drag', ((O.E0 - Em) / 1e6).toFixed(3) + ' MJ/kg');
      row(3, 'KE gained', ((vm * vm - O.v0 * O.v0) / 2e6).toFixed(3) + ' MJ/kg', th.warn);
      if (!narrow) {
        row(4, 'PE lost', ((O.GM / rm - O.GM / O.r0) / 1e6).toFixed(3) + ' MJ/kg');
        row(5, 'PE lost ÷ KE gained', ((O.GM / rm - O.GM / O.r0) / ((vm * vm - O.v0 * O.v0) / 2)).toFixed(3) + '  (2 for a circle)');
        row(6, 'drag slows it, and it', 'SPEEDS UP', th.warn);
      }
    } else {
      if (O.v0 < 1) {
        const lp = O.pts[O.pts.length - 1], vImp = Math.hypot(lp[3], lp[4]), h = O.h0;
        row(0, 'fall time', tfmt(O.tEnd), th.phys);
        row(1, 'speed at the ground (integrated)', (vImp / 1e3).toFixed(3) + ' km/s', th.ok);
        row(2, '√(2GMh / R(R + h))', (Math.sqrt(2 * O.GM * h / (R * (R + h))) / 1e3).toFixed(3) + ' km/s');
        row(3, '√(2gh) — constant g, wrong', (Math.sqrt(2 * O.GM / (R * R) * h) / 1e3).toFixed(3) + ' km/s', th.crit);
      } else {
      row(0, 'downrange distance', km(O.rangeKm * 1e3) + ' km', th.crit);
      row(1, 'flight time', tfmt(O.tEnd));
      row(2, O.bound ? 'ellipse it was on: a' : 'energy per kg', O.bound ? km(O.a0) + ' km' : (O.eps0 / 1e6).toFixed(2) + ' MJ/kg');
      row(3, 'perigee of that ellipse', O.bound ? km(O.a0 * (1 - Math.sqrt(Math.max(0, 1 - Math.pow(O.H0, 2) / (O.GM * O.a0)))) - R) + ' km' : '—', th.crit);
      if (!narrow) {
        row(4, 'needed for orbit here', (O.vc / 1e3).toFixed(3) + ' km/s');
        row(5, 'it had', (O.v0 / 1e3).toFixed(3) + ' km/s');
        row(6, 'angle to horizontal', p.gam.toFixed(0) + '°');
      }
      }
    }
    /* the engine: a real button on the stage, and the mission's own panel */
    const bw3 = narrow ? 150 : 214, bh3 = 40, bx3 = W - bw3 - 14, by3 = H - bh3 - 30;
    const on = g.dragging === 'burn';
    ctx.save();
    const bg = ctx.createLinearGradient(0, by3, 0, by3 + bh3);
    bg.addColorStop(0, on ? '#FFB050' : '#E0701E'); bg.addColorStop(1, on ? '#E06010' : '#8A3A0E');
    ctx.fillStyle = bg; ctx.strokeStyle = '#FFD7A0'; ctx.lineWidth = 1.2;
    ctx.beginPath(); ctx.roundRect(bx3, by3, bw3, bh3, 9); ctx.fill(); ctx.stroke();
    PA.lbl(ctx, bx3 + bw3 / 2, by3 + 15, 'FIRE ENGINE', '#FFF4E0', 'center', 11);
    PA.lbl(ctx, bx3 + bw3 / 2, by3 + 30, (p.dv >= 0 ? '+' : '') + (p.dv / 1e3).toFixed(3) + ' km/s · ' +
           { pro: 'prograde', retro: 'retrograde', out: 'radial out', in: 'radial in' }[p.bdir], '#FFE6C0', 'center', 9);
    ctx.restore();
    g.handle(bx3 + bw3 / 2, by3 + bh3 / 2, bw3 / 2, 'burn');
    if (M && (M.plan || M.tgt) && !narrow) {
      const rows2 = 5, bw2 = 272, bh2 = 26 + rows2 * 15 + 10, bx2 = W - bw2 - 14, by2 = by3 - bh2 - 8;
      const row2 = gPanel(g, bx2, by2, bw2, bh2, M.plan ? 'HOHMANN TRANSFER · PLAN vs FLOWN' : 'RENDEZVOUS');
      const qn = orbitAt(O, S.ts), rn = Math.hypot(qn[1], qn[2]);
      if (M.plan) {
        row2(0, 'Δv₁ at perigee (planned)', (M.plan.dv1 / 1e3).toFixed(3) + ' km/s');
        row2(1, 'Δv₂ at apogee (planned)', (M.plan.dv2 / 1e3).toFixed(3) + ' km/s');
        row2(2, 'coast half an ellipse', tfmt(M.plan.tT));
        row2(3, 'burns fired · Δv used', M.burns.length + ' · ' + (M.dvUsed / 1e3).toFixed(3) + ' km/s', th.phys);
        row2(4, 'now: height · e', km(rn - R) + ' km · ' + (O.end === 'closed' ? O.eM.toFixed(4) : '—'), O.end === 'closed' && O.eM < 0.002 && M.burns.length >= 2 ? th.ok : undefined);
      } else {
        const gap = wrapPi(M.tgt.th0 + M.tgt.n * S.clock - Math.atan2(qn[2], qn[1]));
        row2(0, 'target ahead by', (gap * 180 / Math.PI).toFixed(2) + '° · ' + km(Math.abs(gap) * M.tgt.rT) + ' km', th.phys);
        row2(1, 'height: you · target', km(rn - R) + ' · ' + km(M.tgt.rT - R) + ' km');
        row2(2, 'period: you · target', (O.end === 'closed' ? tfmt(O.T) : '—') + ' · ' + tfmt(TAU / M.tgt.n));
        row2(3, 'Δv used', (M.dvUsed / 1e3).toFixed(3) + ' km/s');
        row2(4, 'status', M.docked ? 'DOCKED' : gap > 0 ? 'behind: drop lower to catch up' : 'ahead: climb to wait', M.docked ? th.ok : th.warn);
      }
    }
  }

  /* ======================= the binary star ======================= */
  function starCol(m) { return m < 0.5 ? '#FF9A5A' : m < 0.9 ? '#FFC36B' : m < 1.4 ? '#FFF0C0' : m < 3 ? '#E2ECFF' : '#A9C6FF'; }
  function drawBinary(S, g) {
    const ctx = g.ctx, th = g.theme, p = S.p, W = g.w, H = g.h, B = S.B, cam = S.cam;
    const narrow = W < 660;
    drawSky(ctx, cam, W, H);
    const F = R3.Frame(ctx, cam, { ambient: 0.35, floorZ: null });
    const k = 1.15 / Math.max(B.r1max, B.r2max);
    const W3 = (x, y) => [x * k, y * k, 0];
    const tt = S.ts % B.T, q = binAt(B, tt);
    // one period of each star's path
    const o1 = [], o2 = [];
    for (let i = 0; i <= 240; i++) { const s = binAt(B, B.T * i / 240); o1.push(W3(s[1], s[2])); o2.push(W3(s[5], s[6])); }
    path3(F, o1, starCol(p.M1), { alpha: 0.55, width: 1.3 });
    path3(F, o2, starCol(p.M2), { alpha: 0.55, width: 1.3 });
    // the centre of mass, and the line through both stars that always passes through it
    const s1 = W3(q[1], q[2]), s2 = W3(q[5], q[6]);
    path3(F, [s1, s2], '#8FA4CE', { alpha: 0.5, width: 1, dash: [3, 4], chunk: 1 });
    [[0.05, 0, 0], [-0.05, 0, 0], [0, 0.05, 0], [0, -0.05, 0]].forEach(d => path3(F, [[0, 0, 0], d], '#FFFFFF', { alpha: 0.9, width: 1.4, chunk: 1 }));
    R3.label(F, [0, 0, 0], 'centre of mass', '#C9D4EA', { size: 9, dy: 14 });
    // the stars: a hot core, a glow that fills its own disc and spills over
    const star = (c, m, lbl) => {
      const rw = clamp(0.045 * Math.pow(m, 0.55), 0.018, 0.13), col = starCol(m);
      F.push(c, () => {
        const pq = cam.project(c); if (!pq.ok) return;
        const rp = rw * pq.s;
        const gr = ctx.createRadialGradient(pq.x, pq.y, rp * 0.3, pq.x, pq.y, rp * 3.2);
        gr.addColorStop(0, RX.rgba(col, 0.55)); gr.addColorStop(1, RX.rgba(col, 0));
        ctx.fillStyle = gr; ctx.beginPath(); ctx.arc(pq.x, pq.y, rp * 3.2, 0, TAU); ctx.fill();
        const g2 = ctx.createRadialGradient(pq.x - rp * 0.25, pq.y - rp * 0.25, 0, pq.x, pq.y, rp);
        g2.addColorStop(0, '#FFFFFF'); g2.addColorStop(0.55, RX.mix(col, '#FFFFFF', 0.35)); g2.addColorStop(1, RX.mix(col, '#7A3A10', 0.25));
        ctx.fillStyle = g2; ctx.beginPath(); ctx.arc(pq.x, pq.y, rp, 0, TAU); ctx.fill();
      });
      R3.label(F, c, lbl, col, { size: 9.5, dy: 22 });
    };
    star(s1, p.M1, 'M₁ = ' + p.M1.toFixed(2) + ' M☉');
    star(s2, p.M2, 'M₂ = ' + p.M2.toFixed(2) + ' M☉');
    if (p.arrows) {
      const v1 = Math.hypot(q[3], q[4]), v2 = Math.hypot(q[7], q[8]), vm = Math.max(B.v1max, B.v2max);
      R3.arrow(F, s1, R3.add(s1, R3.scale(R3.norm([q[3], q[4], 0]), 0.35 * v1 / vm)), 0.006, '#7CF0B0', { label: (v1 / 1e3).toFixed(1) + ' km/s', labelSize: 9 });
      R3.arrow(F, s2, R3.add(s2, R3.scale(R3.norm([q[7], q[8], 0]), 0.35 * v2 / vm)), 0.006, '#7CF0B0', { label: (v2 / 1e3).toFixed(1) + ' km/s', labelSize: 9 });
    }
    // the line of sight to the observer, tilted by the inclination
    const ii = p.incl * Math.PI / 180, od = [Math.sin(ii), 0, Math.cos(ii)];
    R3.arrow(F, R3.scale(od, 0.95), R3.scale(od, 1.45), 0.007, '#FFD36B', { label: 'to the telescope · i = ' + p.incl.toFixed(0) + '°', labelSize: 9 });
    F.render();
    header(g, 'Two stars, one centre of mass',
      'T timed ' + tfmt(B.T) + ' · Kepler 2π√(a³/G(M₁+M₂)) = ' + tfmt(B.Tk),
      'a = ' + p.aAU.toFixed(2) + ' AU · e = ' + p.ecc.toFixed(2) + ' · both stars integrated, the centre of mass is not assumed', th.text);
    const rows = narrow ? 4 : 6, bw = narrow ? W - 24 : 262, bh = 26 + rows * 15 + 10;
    const row = gPanel(g, 12, H - bh - 30, bw, bh, 'EACH STAR ABOUT THE CENTRE OF MASS');
    row(0, 'orbit size r₁ : r₂', (B.r1max / B.r2max).toFixed(4), th.phys);
    row(1, 'mass ratio M₂ : M₁', (p.M2 / p.M1).toFixed(4));
    row(2, 'top speed v₁ : v₂', (B.v1max / 1e3).toFixed(2) + ' : ' + (B.v2max / 1e3).toFixed(2) + ' km/s');
    row(3, 'same period for both', tfmt(B.T), th.ok);
    if (!narrow) {
      row(4, 'centre of mass wander', (B.comDrift / AU).toExponential(1) + ' AU');
      row(5, 'reduced mass μ', (B.m1 * B.m2 / B.M / MSUN).toFixed(4) + ' M☉');
    }
  }

  /* ======================= inside the Earth ======================= */
  const PREM_BOUNDS = [1221.5, 3480, 5701, 6346.6].map(x => x / 6371);
  function layerColour(model) {
    return (rr, fx, fz) => {
      const grain = (u, v) => 0.92 + 0.16 * vnoise(u * 38, v * 38, 0.5, 13) + 0.06 * vnoise(u * 140, v * 140, 1.5, 17);
      if (model !== 'prem') {
        const k = (0.74 + 0.26 * rr) * grain(fx, fz);
        return [182 * k, 118 * k, 76 * k];
      }
      const kmv = rr * 6371;
      let c = PREM[PREM.length - 1][3], rho = 2.6;
      for (let i = 0; i < PREM.length; i++) if (kmv <= PREM[i][0]) { c = PREM[i][3]; rho = PREM[i][1](rr); break; }
      let k = (0.62 + 0.38 * clamp((rho - 2.6) / 10.5, 0, 1)) * grain(fx, fz);
      for (const b of PREM_BOUNDS) if (Math.abs(rr - b) < 0.0045) k *= 0.45;
      return [c[0] * k, c[1] * k, c[2] * k];
    };
  }
  function drawInside(S, g) {
    const ctx = g.ctx, th = g.theme, p = S.p, W = g.w, H = g.h, Tn = S.Tn, cam = S.cam;
    const narrow = W < 660;
    drawSky(ctx, cam, W, H);
    const F = R3.Frame(ctx, cam, { ambient: 0.3, floorZ: null });
    const tr = traceBody(cam, W, H, [0, 0, 0], 1, 'earth', 0.35, { cut: true, layer: layerColour(p.model), ambient: 0.12 });
    /* The section face carries everything that happens inside, so the
       planet is painted first and the face's contents over it. From behind
       (eye on +y) the face is hidden, and so is what is drawn on it. */
    F.push([0, 0, 0], () => { if (tr) ctx.drawImage(tr.canvas, tr.x, tr.y, tr.w, tr.h); }, 3);
    const front = cam.eye[1] < 0;
    const g0 = gInside(RE, p.model);
    const dR = Tn.d / RE, hR = Tn.half / RE;
    // the spin axis through the poles
    path3(F, [[0, 0, -1.28], [0, 0, 1.28]], '#C9D4EA', { alpha: 0.7, width: 1.2, dash: [6, 4], chunk: 1 });
    R3.label(F, [0, 0, 1.33], 'N · spin axis', '#C9D4EA', { size: 9 });
    if (front) {
      // layer names, on the face
      if (p.model === 'prem') {
        [['inner core', 0.10, 12.8], ['outer core · liquid', 0.37, 11.0], ['lower mantle', 0.72, 4.9], ['upper mantle', 0.935, 3.6]].forEach((L0) => {
          const a = -1.95, rr = L0[1];
          R3.label(F, [rr * Math.cos(a), -0.01, rr * Math.sin(a)], L0[0] + ' · ' + L0[2].toFixed(1) + ' g/cm³', '#FFE6C8', { size: 8.5 });
        });
      } else R3.label(F, [-0.5, -0.01, -0.62], 'uniform · ρ = 5.51 g/cm³ everywhere', '#FFE6C8', { size: 9 });
      // the tunnel: a straight bore at offset d from the centre
      const bore = 0.03;
      flatPoly(F, [[-hR, -0.004, dR - bore], [hR, -0.004, dR - bore], [hR, -0.004, dR + bore], [-hR, -0.004, dR + bore]], 'rgba(6,8,14,.92)', { bias: -0.02 });
      path3(F, [[-hR, -0.005, dR - bore], [hR, -0.005, dR - bore]], '#8FA4CE', { alpha: 0.7, width: 1, chunk: 1, bias: -0.021 });
      path3(F, [[-hR, -0.005, dR + bore], [hR, -0.005, dR + bore]], '#8FA4CE', { alpha: 0.7, width: 1, chunk: 1, bias: -0.021 });
      if (dR > 0.02) {
        path3(F, [[0, -0.006, 0], [0, -0.006, dR]], '#F5B451', { alpha: 0.7, width: 1, dash: [3, 3], chunk: 1, bias: -0.02 });
        R3.label(F, [-0.02, -0.01, dR / 2], 'd = ' + km(Tn.d) + ' km', '#F5B451', { size: 9, align: 'right', dx: -4 });
      }
      // the ball, where the integration has it now
      const now = tunnelAt(Tn, S.ts), s = now[1] / RE;
      const bp = [s, -0.03, dR];
      R3.sphere(F, bp, 0.035, '#E8EEF8', { shadow: false });
      const r = Math.hypot(now[1], Tn.d), gr = gInside(r, p.model);
      if (p.arrows && r > 1) {
        const gl = 0.30 * gr / g0, ux = -now[1] / r, uz = -Tn.d / r;
        R3.arrow(F, bp, [bp[0] + ux * gl, bp[1], bp[2] + uz * gl], 0.007, '#F5B451', { label: 'g ' + gr.toFixed(2), labelSize: 9, bias: -0.03 });
        const ga = gr * Math.abs(now[1]) / r;
        if (ga / g0 > 0.03) R3.arrow(F, [bp[0], bp[1] - 0.004, bp[2]], [bp[0] + Math.sign(-now[1]) * 0.30 * ga / g0, bp[1] - 0.004, bp[2]], 0.007, '#7CF0B0',
                                     { label: 'along ' + ga.toFixed(2), labelSize: 9, bias: -0.04 });
      }
      // the depth/height probe, on the upper-left radius
      const pa = -0.62, pr = p.probe;
      const pp = [pr * Math.cos(pa), -0.012, pr * Math.sin(pa)];
      path3(F, [[0, -0.008, 0], pp], '#9AD0FF', { alpha: 0.6, width: 1, dash: [2, 3], chunk: 1, bias: -0.02 });
      R3.sphere(F, pp, 0.022, '#5AA9FF', { shadow: false });
      const gp = gInside(pr * RE, p.model);
      R3.arrow(F, pp, [pp[0] - Math.cos(pa) * 0.28 * gp / g0, pp[1], pp[2] - Math.sin(pa) * 0.28 * gp / g0], 0.006, '#9AD0FF', { bias: -0.03 });
      R3.callout(F, pp, 30, 22, (pr < 1 ? 'depth ' + km((1 - pr) * RE) + ' km' : pr > 1 ? 'height ' + km((pr - 1) * RE) + ' km' : 'surface') +
                 ' · g = ' + gp.toFixed(3), '#9AD0FF', { size: 9.5 });
    }
    // the plumb line at latitude λ on the left-hand rim, in the spinning frame
    const lam = p.lat * Math.PI / 180, om = TAU / (p.dayH * 3600);
    const sp = [-Math.cos(lam), -0.012, -Math.sin(lam)];          // southern hemisphere, clear of the tunnel
    const ac = om * om * RE * Math.cos(lam);
    const ge = [g0 * Math.cos(lam) - ac, 0, g0 * Math.sin(lam)], gel = Math.hypot(ge[0], ge[2]);
    const aS = 0.30 / g0;
    if (front) {
    R3.sphere(F, sp, 0.014, '#FF8FB0', { shadow: false });
    R3.arrow(F, sp, [sp[0] + Math.cos(lam) * 0.30, sp[1], sp[2] + Math.sin(lam) * 0.30], 0.006, '#F5B451', { bias: -0.03 });
    if (ac * aS > 0.01) R3.arrow(F, sp, [sp[0] - ac * aS, sp[1], sp[2]], 0.006, '#FF5AD2', { label: 'ω²R cos λ', labelSize: 9, bias: -0.03 });
    if (gel * aS > 0.01) R3.arrow(F, [sp[0], sp[1] - 0.004, sp[2]], [sp[0] + ge[0] * aS, sp[1] - 0.004, sp[2] + ge[2] * aS], 0.007, '#FFFFFF',
                                   { label: 'g_eff ' + gel.toFixed(3), labelSize: 9, bias: -0.04 });
    R3.callout(F, sp, -28, 24, 'latitude ' + p.lat.toFixed(0) + '°S · day ' + p.dayH.toFixed(2) + ' h', '#FF8FB0', { size: 9.5 });
    }
    F.render();

    // handles: the tunnel's right-hand mouth (up and down), the probe (in and out)
    if (front) {
      const tq = cam.project([hR, -0.03, dR]), t2 = cam.project([hR, -0.03, dR + 0.1]);
      const pq = cam.project([p.probe * Math.cos(-0.62), -0.012, p.probe * Math.sin(-0.62)]),
            p2 = cam.project([(p.probe + 0.1) * Math.cos(-0.62), -0.012, (p.probe + 0.1) * Math.sin(-0.62)]);
      const ax = (a, b) => { const dx = b.x - a.x, dy = b.y - a.y, l = Math.hypot(dx, dy) || 1; return { ux: dx / l, uy: dy / l, per: 0.1 / l }; };
      const ring = (q, id, c) => {
        const on = g.dragging === id;
        ctx.save(); ctx.strokeStyle = on ? th.text : g.alpha(c, .85); ctx.lineWidth = on ? 2.2 : 1.5; ctx.setLineDash(on ? [] : [3, 2]);
        ctx.beginPath(); ctx.arc(q.x, q.y, 11, 0, TAU); ctx.stroke(); ctx.restore();
        g.handle(q.x, q.y, 14, id);
      };
      if (tq.ok && t2.ok) { S._axD = ax(tq, t2); ring(tq, 'tun', '#F5B451'); }
      if (pq.ok && p2.ok) { S._axP = ax(pq, p2); ring(pq, 'prb', '#5AA9FF'); }
    } else {
      ctx.fillStyle = g.alpha(th['text-3'], .95); ctx.font = '10px "IBM Plex Mono",monospace'; ctx.textAlign = 'center';
      ctx.fillText('the section face is on the other side · press ⌖ View to come back to it', W / 2, H - 44);
    }
    header(g, p.model === 'prem' ? 'Real Earth (PREM): g rises on the way down' : 'Uniform Earth: g falls linearly with depth',
      'tunnel at d = ' + km(Tn.d) + ' km · one way ' + tfmt(Tn.tHalf) + ' · round trip ' + tfmt(Tn.T) + ' · top speed ' + (Tn.vmax / 1e3).toFixed(2) + ' km/s',
      'g(r) = G m(r)/r², m(r) summed shell by shell · s̈ = −g(r)·s/r integrated along the bore', th.text);
    const rows = narrow ? 4 : 7, bw = narrow ? W - 24 : 276, bh = 26 + rows * 15 + 10;
    const row = gPanel(g, 12, H - bh - 30, bw, bh, 'THE PROBE AND THE PLUMB LINE');
    const pr = p.probe, gp = gInside(pr * RE, p.model);
    row(0, 'g at the probe (' + p.model + ')', gp.toFixed(3) + ' m/s²', th.phys);
    if (pr <= 1) row(1, 'textbook g(1 − d/R)', (g0 * pr).toFixed(3) + ' m/s²');
    else row(1, 'textbook g(1 − 2h/R)', (g0 * (1 - 2 * (pr - 1))).toFixed(3) + (pr - 1 > 0.1 ? ' ✗ h not ≪ R' : ''), pr - 1 > 0.1 ? th.warn : undefined);
    row(2, pr <= 1 ? 'exact for uniform, g·r/R' : 'exact, g(R/r)²', (pr <= 1 ? g0 * pr : g0 / (pr * pr)).toFixed(3) + ' m/s²');
    row(3, 'g_eff at the plumb line', gel.toFixed(4) + ' m/s²', gel < 0.3 ? th.crit : undefined);
    if (!narrow) {
      const dev = Math.atan2(ac * Math.sin(lam), g0 - ac * Math.cos(lam)) * 180 / Math.PI;
      row(4, 'plumb tilt from vertical', (dev * 60).toFixed(2) + ' arc-min');
      row(5, 'day for weightless equator', tfmt(TAU * Math.sqrt(RE / g0)), th.warn);
      row(6, 'ball: same T at every d?', p.model === 'prem' ? 'no — not uniform' : 'yes — SHM, 84.4 min', p.model === 'prem' ? th.warn : th.ok);
    }
  }

  /* ======================= the Cavendish bench ======================= */
  const KS = 4;                                   // scene units per metre
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
  function drawCav(S, g) {
    const ctx = g.ctx, th = g.theme, p = S.p, W = g.w, H = g.h, cam = S.cam, cv = S.cv, Gm = cv.Gm;
    const narrow = W < 660;
    const F = R3.Frame(ctx, cam, { ambient: 0.32, floorZ: null });   // contact shadows drawn by hand: blurred ones cost a frame
    const B = window.BENCH, m3 = (x, y, z) => [x * KS, y * KS, z * KS];
    const zT = -0.075;
    B.table(F, -0.24 * KS, 0.24 * KS, -0.26 * KS, 0.14 * KS, zT * KS, { legs: false, tone: '#6E4A2C', seed: 19, thick: 0.10 });
    // the swivel: a post from the table, a hub, a bar, the two large lead spheres
    const psi = cv.psi, rho = Math.hypot(Gm.d, Gm.b), zA = -Gm.RB - 0.006;
    const lead = '#6F7784';
    R3.cylinder(F, m3(0, 0, zT), m3(0, 0, zA - 0.004), 0.008 * KS, '#9AA6B8', { segments: 16, shadow: false, ambient: 0.45 });
    R3.cylinder(F, m3(0, 0, zA - 0.007), m3(0, 0, zA + 0.004), 0.016 * KS, '#3A4458', { segments: 20, shadow: false });
    const ca = Math.cos(psi), sa = Math.sin(psi);
    R3.box(F, m3(0, 0, zA), [(2 * rho + 0.03) * KS, 0.014 * KS, 0.008 * KS], '#B8C2D0',
           { shadow: false, ambient: 0.45, axes: [[ca, sa, 0], [-sa, ca, 0], [0, 0, 1]] });
    const bp = bigPos(Gm, psi);
    bp.forEach(q => {
      R3.cylinder(F, m3(q[0], q[1], zA), m3(q[0], q[1], -Gm.RB * 0.8), 0.004 * KS, '#9AA6B8', { segments: 10, shadow: false });
      R3.sphere(F, m3(q[0], q[1], 0), Gm.RB * KS, lead, { shadow: false });
      const sp = m3(q[0] + 0.01, q[1] + 0.01, zT + 0.0005);
      F.push(sp, () => {
        const c0 = cam.project(sp), c1 = cam.project(m3(q[0] + 0.01 + Gm.RB, q[1] + 0.01, zT)), c2 = cam.project(m3(q[0] + 0.01, q[1] + 0.01 + Gm.RB, zT));
        if (!c0.ok || !c1.ok || !c2.ok) return;
        const rx = Math.hypot(c1.x - c0.x, c1.y - c0.y), ry = Math.hypot(c2.x - c0.x, c2.y - c0.y);
        const gr = ctx.createRadialGradient(c0.x, c0.y, 0, c0.x, c0.y, Math.max(rx, ry));
        gr.addColorStop(0, 'rgba(0,0,0,.38)'); gr.addColorStop(1, 'rgba(0,0,0,0)');
        ctx.fillStyle = gr; ctx.beginPath(); ctx.ellipse(c0.x, c0.y, Math.max(rx, ry), Math.min(rx, ry), 0, 0, TAU); ctx.fill();
      }, F.GROUND - 1);
    });
    // the housing: aluminium top and bottom, glass windows front and back
    const cx = 0.075, cy = 0.013, cz = 0.022;
    const alu = B.metal('#B9C3D0', 31);
    B.texBox(F, m3(0, 0, cz + 0.003), [2 * cx * KS, 2 * cy * KS, 0.006 * KS], alu, { ambient: 0.5 });
    B.texBox(F, m3(0, 0, -cz - 0.003), [2 * cx * KS, 2 * cy * KS, 0.006 * KS], alu, { ambient: 0.5 });
    [1, -1].forEach(sx => B.texBox(F, m3(sx * (cx + 0.003), 0, 0), [0.006 * KS, 2 * cy * KS, 2 * cz * KS], alu, { ambient: 0.5 }));
    glassBox(F, m3(0, 0, 0), [2 * cx * KS, 2 * cy * KS, 2 * cz * KS], { skip: [0, 1, 4, 5], glint: true });
    // pillar behind, holding the housing and the fibre tube
    R3.box(F, m3(0, 0.030, (zT + 0.22) / 2), [0.02 * KS, 0.012 * KS, (0.22 - zT) * KS], '#2F3A52', { shadow: false });
    R3.box(F, m3(0, 0.021, cz + 0.003), [0.03 * KS, 0.006 * KS, 0.012 * KS], '#2F3A52', { shadow: false });
    // the fibre and its glass tube, with the torsion head at the top
    R3.cylinder(F, m3(0, 0, cz + 0.006), m3(0, 0, 0.19), 0.0055 * KS, '#9FD4EE', { segments: 14, shadow: false, ambient: 0.7, caps: false });
    path3(F, [m3(0, 0, 0.19), m3(0, 0, 0.004)], '#F4F7FF', { alpha: 0.9, width: 0.8, chunk: 1 });
    R3.cylinder(F, m3(0, 0, 0.19), m3(0, 0, 0.212), 0.012 * KS, '#3A4458', { segments: 18, shadow: false });
    R3.cylinder(F, m3(0, 0, 0.212), m3(0, 0, 0.222), 0.016 * KS, '#C9A04A', { segments: 18, shadow: false });
    // the rod, the small spheres, the mirror — turned by θ (the real angle)
    const tA = cv.st[0], c = Math.cos(tA), s = Math.sin(tA);
    R3.cylinder(F, m3(-Gm.d * c, -Gm.d * s, 0), m3(Gm.d * c, Gm.d * s, 0), 0.0012 * KS, '#D0D8E4', { segments: 8, shadow: false });
    [1, -1].forEach(sg => R3.sphere(F, m3(sg * Gm.d * c, sg * Gm.d * s, 0), Gm.rs * KS, lead, { shadow: false }));
    const nM = [s, -c, 0];
    R3.box(F, m3(0, 0, 0.0), [0.014 * KS, 0.0012 * KS, 0.012 * KS], '#E8F2FF',
           { shadow: false, ambient: 0.8, axes: [[c, s, 0], [-s, c, 0], [0, 0, 1]] });
    // the laser, and its beam folded by the mirror: the lever of light
    const Lz = 0.0, Lp = [0.022, -0.20, Lz];
    R3.cylinder(F, m3(Lp[0], Lp[1] - 0.05, Lz), m3(Lp[0], Lp[1], Lz), 0.009 * KS, '#1E2533', { segments: 16, shadow: false });
    R3.cylinder(F, m3(Lp[0], Lp[1], Lz), m3(Lp[0], Lp[1] + 0.006, Lz), 0.006 * KS, '#C9A04A', { segments: 12, shadow: false });
    R3.box(F, m3(Lp[0], Lp[1] - 0.025, (zT + Lz - 0.009) / 2), [0.008 * KS, 0.008 * KS, (Lz - 0.009 - zT) * KS], '#2F3A52', { shadow: false });
    const mir = [0, -0.0008, 0];
    const uin = R3.norm(R3.sub(mir, [Lp[0], Lp[1] + 0.006, Lz]));
    const dd = R3.dot(uin, nM), uout = R3.sub(uin, R3.scale(nM, 2 * dd));
    const out = R3.add(mir, R3.scale(uout, 0.30));
    const beam = (a, b) => F.push(R3.scale(R3.add(a, b), KS / 2), () => {
      const qa = cam.project(m3(a[0], a[1], a[2])), qb = cam.project(m3(b[0], b[1], b[2])); if (!qa.ok || !qb.ok) return;
      // a glow built from wide faint strokes: canvas shadowBlur is slow on software renderers
      ctx.save(); ctx.lineCap = 'round';
      [[7, 'rgba(255,40,40,.10)'], [3.5, 'rgba(255,50,50,.25)'], [1.3, 'rgba(255,120,120,.95)']].forEach(([w, c]) => {
        ctx.strokeStyle = c; ctx.lineWidth = w; ctx.beginPath(); ctx.moveTo(qa.x, qa.y); ctx.lineTo(qb.x, qb.y); ctx.stroke(); });
      ctx.restore();
    }, -0.03);
    beam([Lp[0], Lp[1] + 0.006, Lz], mir); beam(mir, out);
    R3.callout(F, m3(out[0], out[1], out[2]), -40, 18, 'to the scale · L = ' + p.Lm.toFixed(2) + ' m (not to scale)', '#FF9A9A', { size: 9.5 });
    R3.callout(F, m3(bp[0][0], bp[0][1], Gm.RB), 26, -26, 'M = ' + p.MB.toFixed(2) + ' kg lead', '#C9D4EA', { size: 9.5 });
    R3.callout(F, m3(Gm.d * c, Gm.d * s, Gm.rs), -24, -48, 'm = ' + p.mg.toFixed(0) + ' g on a ' + (2 * Gm.d * 100).toFixed(0) + ' cm rod', '#C9D4EA', { size: 9.5 });
    R3.callout(F, m3(0, 0, 0.13), 26, -10, 'fibre · κ = ' + (Gm.kappa * 1e9).toFixed(2) + ' nN·m/rad', '#C9D4EA', { size: 9.5 });
    F.render();

    // the swivel handle: drag a large sphere to swing it to the other side
    const hq = cam.project(m3(bp[0][0], bp[0][1], 0));
    if (hq.ok) {
      const on = g.dragging === 'swv';
      ctx.save(); ctx.strokeStyle = on ? th.text : g.alpha('#F5B451', .85); ctx.lineWidth = on ? 2.2 : 1.5; ctx.setLineDash(on ? [] : [3, 2]);
      ctx.beginPath(); ctx.arc(hq.x, hq.y, Gm.RB * KS * hq.s + 6, 0, TAU); ctx.stroke(); ctx.restore();
      g.handle(hq.x, hq.y, Gm.RB * KS * hq.s + 8, 'swv');
    }

    /* the scale, 5 m away, as the student sees it: a lit rule, the spot, and
       where the spot has been over the last few minutes */
    const spot = spotOf(Gm, cv.st[0]) * 100;
    const sw = narrow ? W - 24 : Math.min(400, W * 0.42), sh = 74, sx = narrow ? 12 : W - sw - 14, sy = narrow ? 64 : H - 74 - 30;
    ctx.save();
    ctx.fillStyle = g.alpha('#0B1020', .92); ctx.strokeStyle = g.alpha(th.line, 1);
    ctx.beginPath(); ctx.roundRect(sx, sy, sw, sh, 8); ctx.fill(); ctx.stroke();
    PA.lbl(ctx, sx + 10, sy + 12, 'THE SCALE · ' + p.Lm.toFixed(2) + ' m FROM THE MIRROR', th['text-3'], 'left', 8.5);
    PA.lbl(ctx, sx + sw - 10, sy + 12, 'spot ' + (spot >= 0 ? '+' : '') + spot.toFixed(2) + ' cm', '#FF8080', 'right', 10);
    const rx0 = sx + 10, rx1 = sx + sw - 10, ry = sy + 22, rh = 30, span = 30;
    const X = v => rx0 + (v + span) / (2 * span) * (rx1 - rx0);
    const rg = ctx.createLinearGradient(0, ry, 0, ry + rh);
    rg.addColorStop(0, '#EADCAE'); rg.addColorStop(1, '#C9B47C');
    ctx.fillStyle = rg; ctx.fillRect(rx0, ry, rx1 - rx0, rh);
    ctx.strokeStyle = '#1B1B1B'; ctx.fillStyle = '#1B1B1B'; ctx.font = '600 8px "IBM Plex Mono",monospace'; ctx.textAlign = 'center';
    for (let v = -span; v <= span; v++) {
      const x = X(v), L0 = v % 10 === 0 ? 14 : v % 5 === 0 ? 10 : 5;
      ctx.lineWidth = v % 10 === 0 ? 1.2 : 0.6; ctx.beginPath(); ctx.moveTo(x, ry); ctx.lineTo(x, ry + L0); ctx.stroke();
      if (v % 10 === 0 && Math.abs(v) < span) ctx.fillText(String(v), x, ry + 24);
    }
    // rest points found so far
    [['I', '#7CF0B0'], ['II', '#FF8FB0']].forEach(([k, col]) => {
      const r = cv.rest[k]; if (!r) return;
      const x = X(r.S * 100);
      ctx.strokeStyle = col; ctx.lineWidth = 1.4; ctx.setLineDash([3, 2]);
      ctx.beginPath(); ctx.moveTo(x, ry - 3); ctx.lineTo(x, ry + rh + 3); ctx.stroke(); ctx.setLineDash([]);
      PA.lbl(ctx, x, ry + rh + 10, k, col, 'center', 9);
    });
    // the spot's recent history, fading
    const hist = cv.rec.slice(-160);
    hist.forEach((q, i) => {
      const x = X(clamp(q[1] * 100, -span, span));
      ctx.fillStyle = 'rgba(255,70,70,' + (0.04 + 0.3 * i / hist.length) + ')';
      ctx.fillRect(x - 1, ry + rh - 8, 2, 6);
    });
    const xs = X(clamp(spot, -span, span));
    const gg = ctx.createRadialGradient(xs, ry + rh / 2, 0, xs, ry + rh / 2, 12);
    gg.addColorStop(0, 'rgba(255,240,240,1)'); gg.addColorStop(0.25, 'rgba(255,60,60,.95)'); gg.addColorStop(1, 'rgba(255,0,0,0)');
    ctx.fillStyle = gg; ctx.beginPath(); ctx.arc(xs, ry + rh / 2, 12, 0, TAU); ctx.fill();
    ctx.restore();

    const posName = { I: 'position I', II: 'position II', away: 'swung away' }[p.pos];
    const moving = Math.abs(cv.psi - swivelAngle(Gm, p.pos)) > 1e-3;
    if (!narrow) header(g, moving ? 'Swinging the large spheres…' : 'Large spheres in ' + posName,
      'rod turned θ = ' + (tA * 1e3).toFixed(3) + ' mrad (' + (tA * 180 / Math.PI).toFixed(3) + '°) — far too small to see; the spot moves 2θL',
      't = ' + tfmt(cv.t) + ' · T₀ = ' + p.T0min.toFixed(1) + ' min · four sphere pairs summed, far pair included', th.text);
    const rows = narrow ? 4 : 7, bw = narrow ? W - 24 : 292, bh = 26 + rows * 15 + 10;
    const row = gPanel(g, 12, H - bh - 30, bw, bh, 'YOUR MEASUREMENT, FROM THE SPOT');
    const rI = cv.rest.I, rII = cv.rest.II;
    row(0, 'rest point I · II', (rI ? (rI.S * 100).toFixed(2) : '—') + ' · ' + (rII ? (rII.S * 100).toFixed(2) : '—') + ' cm');
    row(1, 'period from turning points', cv.Tlast ? tfmt(cv.Tlast) : 'waiting for 3 turns');
    if (rI && rII) {
      const dS = rI.S - rII.S, Tm = (rI.T + rII.T) / 2;
      const Gn = Math.PI * Math.PI * Gm.b * Gm.b * Gm.d * dS / (Gm.M * Tm * Tm * Gm.Lm);
      const beta = Math.pow(Gm.b, 3) / Math.pow(Gm.b * Gm.b + 4 * Gm.d * Gm.d, 1.5);
      row(2, 'ΔS = S_I − S_II', (dS * 100).toFixed(2) + ' cm', th.phys);
      row(3, 'G = π²b²dΔS / MT²L', (Gn * 1e11).toFixed(3) + ' × 10⁻¹¹', th.warn);
      const zm = (rI.zeta + rII.zeta) / 2;
      if (!narrow) {
        row(4, 'far spheres β · damping ζ', beta.toFixed(4) + ' · ' + zm.toFixed(3));
        row(5, 'G ÷ (1 − β)(1 − ζ²)', (Gn / ((1 - beta) * (1 - zm * zm)) * 1e11).toFixed(3) + ' × 10⁻¹¹', th.ok);
        row(6, 'accepted value', '6.674 × 10⁻¹¹');
      }
    } else {
      row(2, 'next step', !rI ? 'let it settle in I' : 'drag a big sphere to II', th.warn);
      row(3, 'turning points logged', String(cv.tp.length));
      if (!narrow) {
        row(4, 'rest point', '(S₁S₃ − S₂²)/(S₁+S₃−2S₂)');
        row(5, 'G needs', 'both rest points and T');
        row(6, 'or run preset', '"Full measurement"');
      }
    }
  }

  /* =========================================================================
     MISSION CONTROL — engine burns on a live orbit

     A burn is an instantaneous Δv added to the satellite's velocity at the
     moment the student fires it. The integrator is then restarted from that
     state, so the new orbit is whatever Newton says it is, not a formula.
     Two missions are scripted on top: a Hohmann transfer (the autopilot
     fires at the start and again exactly at apogee, found by bisection on
     the radial velocity), and a rendezvous with a target satellite ahead on
     the same orbit, where the obvious move — speed up — is the wrong one.
     ========================================================================= */
  const rdotOf = q => (q[1] * q[3] + q[2] * q[4]) / Math.hypot(q[1], q[2]);
  function missionReset(S) {
    const p = S.p, O = S.O;
    S.clock = 0;
    S.M = { ghosts: [], burns: [], dvUsed: 0, hist: [], docked: false };
    if (p.mission === 'hohmann') {
      const r1 = O.r0, r2 = O.R + Math.pow(10, p.logH2) * 1e3, GM = O.GM, at = (r1 + r2) / 2;
      S.M.plan = { r1, r2, dv1: Math.sqrt(GM / r1) * (Math.sqrt(2 * r2 / (r1 + r2)) - 1),
                   dv2: Math.sqrt(GM / r2) * (1 - Math.sqrt(2 * r1 / (r1 + r2))), tT: Math.PI * Math.sqrt(at * at * at / GM) };
    }
    if (p.mission === 'rendezvous') {
      const rT = O.r0;
      S.M.tgt = { rT, n: Math.sqrt(O.GM / (rT * rT * rT)), th0: p.lead * Math.PI / 180 };
    }
  }
  function fireBurn(S, dv, dir) {
    const O = S.O, q = orbitAt(O, S.ts);
    if (O.end === 'crash' && S.ts >= O.tEnd - 1) return;
    const r = Math.hypot(q[1], q[2]), v = Math.hypot(q[3], q[4]);
    const tv = [q[3] / v, q[4] / v], rv = [q[1] / r, q[2] / r];
    const u = dir === 'pro' ? tv : dir === 'retro' ? [-tv[0], -tv[1]] : dir === 'out' ? rv : [-rv[0], -rv[1]];
    const st = [q[1], q[2], q[3] + u[0] * dv, q[4] + u[1] * dv];
    // what was flown so far stays on the screen, dimmed
    const path = [];
    const tEnd = O.end === 'closed' ? O.T : Math.min(O.tEnd, S.ts);
    const n = 160;
    for (let i = 0; i <= n; i++) { const w = orbitAt(O, tEnd * i / n); path.push([w[1], w[2]]); }
    S.M.ghosts.push(path);
    if (S.M.ghosts.length > 5) S.M.ghosts.shift();
    S.M.burns.push({ x: q[1], y: q[2], dv, dir, clock: S.clock, u });
    S.M.dvUsed += Math.abs(dv);
    S.O = runOrbit(S.p, st);
    S.ts = 0; S.hold = 0;
  }
  /* the autopilot and the bookkeeping, run from step() after the clock moves */
  function missionStep(S, tsOld) {
    const p = S.p, M = S.M, O = S.O;
    if (!M) return;
    const q = orbitAt(O, S.ts);
    if (M.hist.length === 0 || S.clock - M.hist[M.hist.length - 1][0] > (O.Tloc0 / 120)) {
      const gap = M.tgt ? wrapPi(M.tgt.th0 + M.tgt.n * S.clock - Math.atan2(q[2], q[1])) : 0;
      M.hist.push([S.clock, Math.hypot(q[1], q[2]) - O.R, Math.hypot(q[3], q[4]), gap]);
      if (M.hist.length > 4000) M.hist.shift();
    }
    if (p.mission === 'hohmann' && p.autoB) {
      if (M.burns.length === 0 && S.clock > O.Tloc0 * 0.02) fireBurn(S, M.plan.dv1, 'pro');
      else if (M.burns.length === 1) {
        // apogee: the radial velocity changes sign from + to − somewhere in (tsOld, ts]
        const a = orbitAt(O, tsOld), b = orbitAt(O, S.ts);
        if (rdotOf(a) > 0 && rdotOf(b) <= 0 && S.ts > tsOld) {
          let lo = tsOld, hi = S.ts;
          for (let i = 0; i < 40; i++) { const mid = (lo + hi) / 2; if (rdotOf(orbitAt(O, mid)) > 0) lo = mid; else hi = mid; }
          S.clock -= S.ts - hi; S.ts = hi;
          fireBurn(S, M.plan.dv2, 'pro');
        }
      }
    }
    if (M.tgt && !M.docked) {
      const th = Math.atan2(q[2], q[1]), gap = wrapPi(M.tgt.th0 + M.tgt.n * S.clock - th);
      const dr = Math.abs(Math.hypot(q[1], q[2]) - M.tgt.rT);
      const vrel = Math.hypot(q[3] + Math.sin(th + gap) * M.tgt.n * M.tgt.rT, q[4] - Math.cos(th + gap) * M.tgt.n * M.tgt.rT);
      if (Math.abs(gap) * M.tgt.rT < 25e3 && dr < 25e3 && vrel < 60) M.docked = true;
    }
  }
  const wrapPi = a => { a = (a + Math.PI) % TAU; if (a < 0) a += TAU; return a - Math.PI; };

  /* =========================================================================
     THE FIELD AND THE POTENTIAL — two bodies, one landscape

     V(x, y) = −GM₁/r₁ − GM₂/r₂ (the interior of a uniform sphere, or the
     flat floor of a hollow shell, where the point is inside a body) drawn
     as a surface whose depth is a compressed potential: log(1 + |V|/V₀).
     A probe fired from the first body is integrated in the real field of
     both, with the bodies held fixed, as the textbook problem assumes. The
     neutral point is found by bisection on the axis, and the least launch
     speed that reaches the second body comes from the potential there.
     ========================================================================= */
  const MOON_RHO = 3344, EARTH_RHO = 5514;
  function fieldSetup(p) {
    const M1 = ME, R1 = RE, q = Math.pow(10, p.flogq), M2 = q * M1;
    const R2 = R1 * Math.cbrt(q * EARTH_RHO / MOON_RHO), d = p.fdR * R1;
    const G1 = GRAV * M1, G2 = GRAV * M2, shell = !!p.fshell;
    const V = (x, y) => {
      const r1 = Math.hypot(x, y), r2 = Math.hypot(x - d, y);
      const v1 = r1 >= R1 ? -G1 / r1 : shell ? -G1 / R1 : -G1 * (3 * R1 * R1 - r1 * r1) / (2 * R1 * R1 * R1);
      const v2 = r2 >= R2 ? -G2 / r2 : -G2 * (3 * R2 * R2 - r2 * r2) / (2 * R2 * R2 * R2);
      return v1 + v2;
    };
    const gAt = (x, y) => {
      const r1 = Math.hypot(x, y), r2 = Math.hypot(x - d, y);
      const k1 = r1 >= R1 ? G1 / (r1 * r1 * r1) : shell ? 0 : G1 / (R1 * R1 * R1);
      const k2 = r2 >= R2 ? G2 / (r2 * r2 * r2) : G2 / (R2 * R2 * R2);
      return [-k1 * x - k2 * (x - d), -k1 * y - k2 * y];
    };
    // the neutral point on the axis, between the bodies: g = 0
    let lo = R1 * 1.0001, hi = d - R2 * 1.0001;
    for (let i = 0; i < 80; i++) { const mid = (lo + hi) / 2; if (gAt(mid, 0)[0] < 0) lo = mid; else hi = mid; }
    const xN = (lo + hi) / 2, VN = V(xN, 0);
    const Vs = V(R1, 0);                                   // on the first body's surface, facing the second
    const vMin = Math.sqrt(2 * (VN - Vs));                 // just enough to crest the neutral point
    const vEsc = Math.sqrt(-2 * V(-R1, 0));                // escape from the far side, to infinity
    // the probe: launched from the surface at angle fang from the axis
    const ang = p.fang * Math.PI / 180, v0 = p.fv * 1e3;
    let s = [R1 * Math.cos(ang), R1 * Math.sin(ang), v0 * Math.cos(ang), v0 * Math.sin(ang)];
    const der = st => { const a = gAt(st[0], st[1]); return [st[2], st[3], a[0], a[1]]; };
    const pts = [[0].concat(s)];
    let t = 0, end = 'run', rMax = 0;
    while (t < 30 * 86400 && pts.length < 60000) {
      const r1 = Math.hypot(s[0], s[1]), r2 = Math.hypot(s[0] - d, s[1]);
      const hs = Math.max(0.5, 0.004 * Math.min(r1 * Math.sqrt(r1 / G1), r2 * Math.sqrt(r2 / G2)));
      const k1 = der(s), k2 = der(s.map((v, i) => v + k1[i] * hs / 2)), k3 = der(s.map((v, i) => v + k2[i] * hs / 2)), k4 = der(s.map((v, i) => v + k3[i] * hs));
      s = s.map((v, i) => v + hs / 6 * (k1[i] + 2 * k2[i] + 2 * k3[i] + k4[i]));
      t += hs;
      pts.push([t].concat(s));
      const n1 = Math.hypot(s[0], s[1]), n2 = Math.hypot(s[0] - d, s[1]);
      rMax = Math.max(rMax, n1);
      if (n2 <= R2) { end = 'moon'; break; }
      if (n1 <= R1 && t > 60) { end = 'back'; break; }
      if (n1 > 2.2 * d && n2 > 1.5 * d) { end = 'escape'; break; }
    }
    const E0 = 0.5 * v0 * v0 + V(s0x(ang, R1), s0y(ang, R1));
    return { M1, M2, R1, R2, d, q, G1, G2, shell, V, gAt, xN, VN, Vs, vMin, vEsc, pts, end, tEnd: t, E0, rMax, V0: G1 / d };
  }
  const s0x = (a, R) => R * Math.cos(a), s0y = (a, R) => R * Math.sin(a);
  function fieldAt(Fd, t) {
    const P = Fd.pts;
    if (t >= P[P.length - 1][0]) return P[P.length - 1];
    let lo = 0, hi = P.length - 1;
    while (hi - lo > 1) { const m = (lo + hi) >> 1; if (P[m][0] <= t) lo = m; else hi = m; }
    const f = (t - P[lo][0]) / (P[hi][0] - P[lo][0]);
    return P[lo].map((v, i) => v + (P[hi][i] - v) * f);
  }

  function drawField(S, g) {
    const ctx = g.ctx, th = g.theme, p = S.p, W = g.w, H = g.h, Fd = S.Fd, cam = S.cam;
    const narrow = W < 660;
    drawSky(ctx, cam, W, H);
    const F = R3.Frame(ctx, cam, { ambient: 0.32, floorZ: null });
    const K = 2.3 / Fd.d, V0 = Fd.V0;
    const zOf = (V) => -0.24 * Math.log(1 + Math.abs(V) / V0);
    const X0 = -0.35 * Fd.d, X1 = 1.30 * Fd.d, Y1 = 0.55 * Fd.d;
    const cx = (X0 + X1) / 2;
    const w3 = (x, y, z) => [(x - cx) * K, y * K, z];
    // the potential surface, quad by quad so the bodies and the probe sort into it;
    // smooth shading, and equipotentials traced by marching squares inside each cell
    const NX = 92, NY = 54, LV = 0.055;
    const key = [p.flogq, p.fdR, p.fshell].join('|');
    if (!S._mesh || S._meshKey !== key) {
      const Z = [];
      for (let j = 0; j <= NY; j++) { Z.push([]); for (let i = 0; i <= NX; i++) {
        const x = X0 + (X1 - X0) * i / NX, y = -Y1 + 2 * Y1 * j / NY;
        Z[j].push(zOf(Fd.V(x, y)));
      } }
      const segs = [];
      for (let j = 0; j < NY; j++) { segs.push([]); for (let i = 0; i < NX; i++) {
        const c = [[i, j, Z[j][i]], [i + 1, j, Z[j][i + 1]], [i + 1, j + 1, Z[j + 1][i + 1]], [i, j + 1, Z[j + 1][i]]];
        const lo = Math.min(c[0][2], c[1][2], c[2][2], c[3][2]), hi = Math.max(c[0][2], c[1][2], c[2][2], c[3][2]);
        const out = [];
        for (let L = Math.ceil(-hi / LV) ; L * LV <= -lo; L++) {
          const z = -L * LV, pts = [];
          for (let e = 0; e < 4; e++) {
            const A = c[e], B = c[(e + 1) % 4];
            if ((A[2] - z) * (B[2] - z) < 0) { const f = (z - A[2]) / (B[2] - A[2]); pts.push([A[0] + (B[0] - A[0]) * f, A[1] + (B[1] - A[1]) * f, z]); }
          }
          if (pts.length >= 2) out.push([pts[0], pts[1], L % 5 === 0]);
          if (pts.length === 4) out.push([pts[2], pts[3], L % 5 === 0]);
        }
        segs[j].push(out);
      } }
      S._mesh = Z; S._segs = segs; S._meshKey = key;
    }
    const Z = S._mesh, SG = S._segs;
    const gx = i => X0 + (X1 - X0) * i / NX, gy = j => -Y1 + 2 * Y1 * j / NY;
    const P = (i, j) => w3(gx(i), gy(j), Z[j][i]);
    for (let j = 0; j < NY; j++) for (let i = 0; i < NX; i++) {
      const a = P(i, j), b = P(i + 1, j), c = P(i + 1, j + 1), d = P(i, j + 1);
      let n = R3.norm(R3.cross(R3.sub(b, a), R3.sub(d, a))); if (n[2] < 0) n = R3.scale(n, -1);
      const zm = (a[2] + b[2] + c[2] + d[2]) / 4;
      const base = RX.mix('#3E8BE0', '#07142C', clamp(-zm / 1.15, 0, 1));
      const col = F.shade(base, n, { spec: false, ambient: 0.42 });
      const cl = SG[j][i].map(sg => [w3(gx(sg[0][0]), gy(sg[0][1]), sg[0][2] + 0.003), w3(gx(sg[1][0]), gy(sg[1][1]), sg[1][2] + 0.003), sg[2]]);
      const ctr = [(a[0] + c[0]) / 2, (a[1] + c[1]) / 2, zm];
      F.push(ctr, () => {
        const q = [a, b, c, d].map(v => cam.project(v)); if (q.some(x => !x.ok)) return;
        ctx.fillStyle = col; ctx.strokeStyle = col; ctx.lineWidth = 0.8;
        ctx.beginPath(); q.forEach((x, k) => k ? ctx.lineTo(x.x, x.y) : ctx.moveTo(x.x, x.y)); ctx.closePath(); ctx.fill(); ctx.stroke();
        if (cl.length) {
          cl.forEach(sg => {
            const u = cam.project(sg[0]), v = cam.project(sg[1]); if (!u.ok || !v.ok) return;
            ctx.strokeStyle = sg[2] ? 'rgba(170,215,255,.85)' : 'rgba(150,200,255,.38)'; ctx.lineWidth = sg[2] ? 1.2 : 0.7;
            ctx.beginPath(); ctx.moveTo(u.x, u.y); ctx.lineTo(v.x, v.y); ctx.stroke();
          });
        }
      });
    }
    // the two bodies, sitting at the bottom of their wells
    const b1 = w3(0, 0, zOf(Fd.V(0, 0)) + 0.06), b2 = w3(Fd.d, 0, zOf(Fd.V(Fd.d, 0)) + 0.035);
    if (Fd.shell) R3.wireSphere(F, b1, 0.07, '#9AD0FF', { lat: 4, lon: 8, alpha: 0.6 });
    else R3.sphere(F, b1, 0.07, '#3F7FD0', { shadow: false });
    R3.sphere(F, b2, 0.035, '#C9CCD4', { shadow: false });
    R3.label(F, b1, Fd.shell ? 'hollow shell, mass M' : 'Earth', '#9AD0FF', { size: 9.5, dy: -18 });
    R3.label(F, b2, 'mass ' + (Fd.q < 0.1 ? '1/' + (1 / Fd.q).toFixed(1) : Fd.q.toFixed(2)) + ' M', '#DDE2EA', { size: 9.5, dy: -14 });
    // the neutral point: the saddle between the wells
    const nP = w3(Fd.xN, 0, zOf(Fd.VN) + 0.01);
    R3.sphere(F, nP, 0.018, '#FFD36B', { shadow: false });
    R3.callout(F, nP, 22, -34, 'neutral point · g = 0 · ' + (Fd.xN / Fd.d).toFixed(3) + ' d', '#FFD36B', { size: 9.5 });
    // the probe's path, riding on the surface, and the probe now
    const tr = [];
    const dec = Math.max(1, Math.floor(Fd.pts.length / 400));
    const tNow = S.ts;
    for (let i = 0; i < Fd.pts.length; i += dec) {
      const q = Fd.pts[i];
      if (q[0] > tNow) break;
      tr.push(w3(q[1], q[2], zOf(Fd.V(q[1], q[2])) + 0.012));
    }
    const qn = fieldAt(Fd, tNow);
    const pn = w3(qn[1], qn[2], zOf(Fd.V(qn[1], qn[2])) + 0.02);
    tr.push(pn);
    if (tr.length > 1) path3(F, tr, '#FF8FB0', { alpha: 0.95, width: 2, chunk: 3, bias: -0.02 });
    R3.sphere(F, pn, 0.018, '#FF5A7A', { shadow: false });
    F.render();

    const outcome = { moon: 'Reaches the second body', back: 'Falls back — it never crests the saddle', escape: 'Escapes both', run: 'Still climbing' }[Fd.end];
    header(g, outcome,
      'launch ' + p.fv.toFixed(2) + ' km/s at ' + p.fang.toFixed(0) + '° · least speed to reach it ' + (Fd.vMin / 1e3).toFixed(3) + ' km/s · escape ' + (Fd.vEsc / 1e3).toFixed(3) + ' km/s',
      'surface depth = −log(1 + |V|/V₀): the probe is integrated in the real field of both bodies', Fd.end === 'moon' ? th.ok : Fd.end === 'back' ? th.crit : th.warn);
    const rows = narrow ? 4 : 6, bw = narrow ? W - 24 : 280, bh = 26 + rows * 15 + 10;
    const row = gPanel(g, 12, H - bh - 30, bw, bh, 'READ OFF THE LANDSCAPE');
    row(0, 'neutral point from body 1', km(Fd.xN) + ' km = ' + (Fd.xN / Fd.d).toFixed(4) + ' d', th.phys);
    row(1, 'd / (1 + √(M₂/M₁))', (1 / (1 + Math.sqrt(Fd.q))).toFixed(4) + ' d');
    row(2, 'V at the surface · at N', (Fd.Vs / 1e6).toFixed(2) + ' · ' + (Fd.VN / 1e6).toFixed(2) + ' MJ/kg');
    row(3, 'least launch speed √(2ΔV)', (Fd.vMin / 1e3).toFixed(3) + ' km/s', th.ok);
    if (!narrow) {
      row(4, 'escape speed (both bodies)', (Fd.vEsc / 1e3).toFixed(3) + ' km/s');
      row(5, Fd.shell ? 'inside the shell' : 'probe energy ½v² + V', Fd.shell ? 'g = 0, V flat' : (Fd.E0 / 1e6).toFixed(3) + ' MJ/kg');
    }
  }

  /* =========================================================================
     THE SOLAR SYSTEM — Kepler's laws from the real planets

     Each body's orbit round the Sun is integrated (RK4, the step shrinking
     near perihelion so Halley's comet at e = 0.967 is resolved), starting
     from perihelion, then set into space by its real inclination, node and
     argument of perihelion (J2000 elements). Its period is timed, its
     semi-major axis read from the nearest and furthest points reached, and
     T² ∝ a³ is plotted from those measurements, not from a table. Planet
     sizes are enlarged so they can be seen; distances are true.
     ========================================================================= */
  const GMSUN = 1.32712440018e20;
  const BODIES = [
    // id, name, a (AU), e, i, Ω, ϖ (long. of perihelion), L (mean longitude at J2000), colour, drawn radius
    ['mercury', 'Mercury', 0.38710, 0.20563, 7.005, 48.33, 77.46, 252.25, '#A8A39A', 0.012],
    ['venus', 'Venus', 0.72333, 0.00677, 3.395, 76.68, 131.53, 181.98, '#E8CF9A', 0.018],
    ['earth', 'Earth', 1.00000, 0.01671, 0.000, 0.0, 102.94, 100.46, '#4F8FE0', 0.019],
    ['mars', 'Mars', 1.52368, 0.09340, 1.850, 49.56, 336.04, 355.45, '#D0643A', 0.015],
    ['jupiter', 'Jupiter', 5.20260, 0.04849, 1.303, 100.46, 14.33, 34.40, '#D9B38C', 0.045],
    ['saturn', 'Saturn', 9.55491, 0.05551, 2.489, 113.66, 93.06, 49.94, '#E3CD95', 0.040],
    ['uranus', 'Uranus', 19.2184, 0.04630, 0.773, 74.01, 173.01, 313.23, '#9FE0E8', 0.030],
    ['neptune', 'Neptune', 30.1104, 0.00899, 1.770, 131.78, 48.12, 304.88, '#4F72E0', 0.030],
    ['pluto', 'Pluto', 39.482, 0.2488, 17.14, 110.30, 224.07, 238.93, '#C9B8A6', 0.011],
    ['halley', 'Halley\'s comet', 17.834, 0.96714, 162.26, 58.42, 169.75, 169.75 + 360 * 13.9 / 75.3, '#CFE8FF', 0.010]
  ];
  let SOLAR = null;
  function runSolar() {
    if (SOLAR) return SOLAR;
    SOLAR = BODIES.map(b => {
      const [id, name, aAU, e, iD, OmD, wbD, LD, col, rad] = b;
      const a = aAU * AU, rp = a * (1 - e), vp = Math.sqrt(GMSUN * (1 + e) / rp);
      let s = [rp, 0, 0, vp];
      const der = st => { const r = Math.hypot(st[0], st[1]), k = -GMSUN / (r * r * r); return [st[2], st[3], k * st[0], k * st[1]]; };
      const pts = [[0, s[0], s[1], s[2], s[3]]];
      let t = 0, th = 0, prev = 0, T = 0;
      const Tk = TAU * Math.sqrt(a * a * a / GMSUN);
      while (t < Tk * 1.05) {
        const r = Math.hypot(s[0], s[1]), hs = TAU * Math.sqrt(r * r * r / GMSUN) / 700;
        const k1 = der(s), k2 = der(s.map((v, j) => v + k1[j] * hs / 2)), k3 = der(s.map((v, j) => v + k2[j] * hs / 2)), k4 = der(s.map((v, j) => v + k3[j] * hs));
        const ns = s.map((v, j) => v + hs / 6 * (k1[j] + 2 * k2[j] + 2 * k3[j] + k4[j]));
        const ang = Math.atan2(ns[1], ns[0]); let da = ang - prev; if (da > Math.PI) da -= TAU; if (da < -Math.PI) da += TAU;
        if (!T && th < TAU && th + da >= TAU) { T = t + hs * (TAU - th) / da; }
        s = ns; t += hs; th += da; prev = ang;
        pts.push([t, s[0], s[1], s[2], s[3]]);
        if (T && t > T) break;
      }
      let rMin = Infinity, rMax = 0, vMax = 0, vMin = Infinity;
      pts.forEach(q => { const r = Math.hypot(q[1], q[2]), v = Math.hypot(q[3], q[4]); rMin = Math.min(rMin, r); rMax = Math.max(rMax, r); vMax = Math.max(vMax, v); vMin = Math.min(vMin, v); });
      // into space: R_z(Ω) R_x(i) R_z(ω), ω = ϖ − Ω
      const O = OmD * Math.PI / 180, I = iD * Math.PI / 180, w = (wbD - OmD) * Math.PI / 180;
      const cO = Math.cos(O), sO = Math.sin(O), cI = Math.cos(I), sI = Math.sin(I), cw = Math.cos(w), sw = Math.sin(w);
      const place = (x, y) => {
        const x1 = x * cw - y * sw, y1 = x * sw + y * cw;               // in the plane, from the node
        const y2 = y1 * cI, z2 = y1 * sI;                                // tipped
        return [x1 * cO - y2 * sO, x1 * sO + y2 * cO, z2];
      };
      // where it is at J2000: its mean anomaly from the mean longitude
      const M0 = ((LD - wbD) % 360 + 360) % 360 * Math.PI / 180;
      return { id, name, aAU, e, iD, col, rad, pts, T: T || Tk, Tk, rMin, rMax, vMax, vMin, place, t0: M0 / TAU * (T || Tk),
               aM: (rMin + rMax) / 2 / AU, eM: (rMax - rMin) / (rMax + rMin) };
    });
    return SOLAR;
  }
  function solarAt(B, tSec) {
    const P = B.pts, tt = ((tSec + B.t0) % B.T + B.T) % B.T;
    let lo = 0, hi = P.length - 1;
    while (hi - lo > 1) { const m = (lo + hi) >> 1; if (P[m][0] <= tt) lo = m; else hi = m; }
    const f = (tt - P[lo][0]) / (P[hi][0] - P[lo][0]);
    return P[lo].map((v, k) => v + (P[hi][k] - v) * f);
  }

  function drawSolar(S, g) {
    const ctx = g.ctx, th = g.theme, p = S.p, W = g.w, H = g.h, cam = S.cam;
    const narrow = W < 660;
    drawSky(ctx, cam, W, H);
    const F = R3.Frame(ctx, cam, { ambient: 0.3, floorZ: null });
    const B = runSolar(), zoom = Math.pow(10, p.zoomAU), K = 1.6 / (zoom * AU);
    const tSec = S.yrs * YR;
    const fb = B.find(b => b.id === p.focus) || B[2];
    // the ecliptic, faintly, with rings every AU (or every 10 AU when zoomed out)
    const step = zoom > 12 ? 10 : zoom > 4 ? 2 : 0.5;
    for (let rA = step; rA <= zoom * 1.3; rA += step) {
      const ring = []; for (let j = 0; j <= 96; j++) { const a = j / 96 * TAU; ring.push([rA * AU * K * Math.cos(a), rA * AU * K * Math.sin(a), 0]); }
      path3(F, ring, '#8FA4CE', { alpha: 0.10, width: 1, chunk: 8, bias: 0.05 });
      R3.label(F, [rA * AU * K, 0, 0], rA + ' AU', '#63729A', { size: 8.5, dy: 9 });
    }
    // the Sun: a hot core inside a wide corona
    F.push([0, 0, 0], () => {
      const q = cam.project([0, 0, 0]); if (!q.ok) return;
      const rs = 0.05 * q.s;
      const gr = ctx.createRadialGradient(q.x, q.y, 0, q.x, q.y, rs * 5);
      gr.addColorStop(0, 'rgba(255,250,220,1)'); gr.addColorStop(0.18, 'rgba(255,215,120,.95)'); gr.addColorStop(0.4, 'rgba(255,150,50,.35)'); gr.addColorStop(1, 'rgba(255,120,30,0)');
      ctx.fillStyle = gr; ctx.beginPath(); ctx.arc(q.x, q.y, rs * 5, 0, TAU); ctx.fill();
    });
    if (zoom < 8) R3.label(F, [0, 0, 0], 'Sun', '#FFD36B', { size: 9.5, dy: 22 });
    B.forEach(b => {
      if (b.aAU * (1 - b.e) > zoom * 1.6 && b !== fb) return;
      const W3 = (x, y) => R3.scale(b.place(x, y), K);
      const dec = Math.max(1, Math.floor(b.pts.length / 360)), path = [];
      for (let i = 0; i < b.pts.length; i += dec) path.push(W3(b.pts[i][1], b.pts[i][2]));
      path.push(path[0]);
      const isF = b === fb;
      path3(F, path, b.col, { alpha: isF ? 0.85 : 0.35, width: isF ? 1.8 : 1, chunk: 8 });
      const q = solarAt(b, tSec), pos = W3(q[1], q[2]);
      // the planet, lit from the Sun's side (so it shows its phase from here)
      F.push(pos, () => {
        const c = cam.project(pos), sq = cam.project([0, 0, 0]); if (!c.ok) return;
        const rp = Math.max(2.2, b.rad * c.s);
        let dx = sq.ok ? sq.x - c.x : 0, dy = sq.ok ? sq.y - c.y : 0; const dl = Math.hypot(dx, dy) || 1; dx /= dl; dy /= dl;
        if (b.id === 'saturn') { ctx.strokeStyle = 'rgba(230,210,160,.7)'; ctx.lineWidth = Math.max(1, rp * 0.35); ctx.beginPath(); ctx.ellipse(c.x, c.y, rp * 2.1, rp * 0.7, -0.35, 0, TAU); ctx.stroke(); }
        if (b.id === 'halley') {             // the tail points away from the Sun and grows as it closes in
          const r = Math.hypot(q[1], q[2]) / AU, L = Math.min(90, 40 / Math.max(0.3, r));
          const gr = ctx.createLinearGradient(c.x, c.y, c.x - dx * L, c.y - dy * L);
          gr.addColorStop(0, 'rgba(210,235,255,.8)'); gr.addColorStop(1, 'rgba(210,235,255,0)');
          ctx.strokeStyle = gr; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(c.x, c.y); ctx.lineTo(c.x - dx * L, c.y - dy * L); ctx.stroke();
        }
        const gr = ctx.createRadialGradient(c.x + dx * rp * 0.45, c.y + dy * rp * 0.45, rp * 0.1, c.x, c.y, rp);
        gr.addColorStop(0, RX.mix(b.col, '#FFFFFF', 0.45)); gr.addColorStop(0.6, b.col); gr.addColorStop(1, RX.mix(b.col, '#05080F', 0.75));
        ctx.fillStyle = gr; ctx.beginPath(); ctx.arc(c.x, c.y, rp, 0, TAU); ctx.fill();
        if (isF) { ctx.strokeStyle = 'rgba(255,255,255,.8)'; ctx.lineWidth = 1.2; ctx.beginPath(); ctx.arc(c.x, c.y, rp + 5, 0, TAU); ctx.stroke(); }
      });
      // name it only if it stands clear of the Sun on the screen: zoomed out, the inner planets crowd together
      const cs = cam.project(pos), c0 = cam.project([0, 0, 0]);
      if (isF || (cs.ok && c0.ok && Math.hypot(cs.x - c0.x, cs.y - c0.y) > 34)) R3.label(F, pos, b.name, isF ? '#FFFFFF' : RX.mix(b.col, '#FFFFFF', 0.3), { size: isF ? 10 : 9, dy: -14 });
      if (isF) {
        // perihelion and aphelion, and the line of apsides through the Sun
        const peri = W3(b.pts[0][1], b.pts[0][2]);
        let iA = 0; b.pts.forEach((z, i) => { if (Math.hypot(z[1], z[2]) > Math.hypot(b.pts[iA][1], b.pts[iA][2])) iA = i; });
        const apo = W3(b.pts[iA][1], b.pts[iA][2]);
        path3(F, [peri, apo], '#8FA4CE', { alpha: 0.45, width: 1, dash: [3, 4], chunk: 1 });
        R3.sphere(F, peri, 0.008, '#7CF0B0', { shadow: false }); R3.sphere(F, apo, 0.008, '#FF8FB0', { shadow: false });
        // the apsis labels only when the orbit is big enough on screen to hold them apart
        const qp = cam.project(peri), qa = cam.project(apo);
        if (qp.ok && qa.ok && Math.hypot(qp.x - qa.x, qp.y - qa.y) > 120) {
          R3.label(F, peri, 'perihelion · ' + (b.vMax / 1e3).toFixed(1) + ' km/s', '#7CF0B0', { size: 9, dy: 14 });
          R3.label(F, apo, 'aphelion · ' + (b.vMin / 1e3).toFixed(1) + ' km/s', '#FF8FB0', { size: 9, dy: 14 });
        }
        // equal areas in equal times: eight sectors, the current one bright
        if (p.sectors) {
          const n = 8, cur = Math.floor((((tSec + b.t0) % b.T + b.T) % b.T) / b.T * n);
          for (let k = 0; k < n; k++) {
            const poly = [[0, 0, 0]];
            for (let j = 0; j <= 12; j++) { const z = solarAt(b, (k + j / 12) / n * b.T - b.t0); poly.push(W3(z[1], z[2])); }
            flatPoly(F, poly, k === cur ? RX.rgba(b.col, 0.35) : RX.rgba(b.col, k % 2 ? 0.08 : 0.14));
          }
        }
        // the speed vector
        const vdir = R3.norm(R3.sub(W3(q[1] + q[3], q[2] + q[4]), pos));
        R3.arrow(F, pos, R3.add(pos, R3.scale(vdir, 0.12 + 0.25 * Math.hypot(q[3], q[4]) / b.vMax)), 0.005, '#7CF0B0',
                 { label: (Math.hypot(q[3], q[4]) / 1e3).toFixed(1) + ' km/s', labelSize: 9 });
      }
    });
    F.render();
    const yr = 2000 + S.yrs;
    header(g, fb.name + ' · T = ' + (fb.T / YR).toFixed(fb.T / YR < 2 ? 3 : 2) + ' yr, timed',
      'year ' + yr.toFixed(2) + ' · ' + p.yps.toFixed(2) + ' years per second · distances true, planets enlarged to be seen',
      'each orbit integrated from perihelion, placed by its real i, Ω and ω (J2000)', th.text);
    const rows = narrow ? 4 : 7, bw = narrow ? W - 24 : 272, bh = 26 + rows * 15 + 10;
    const row = gPanel(g, 12, H - bh - 30, bw, bh, fb.name.toUpperCase() + ', MEASURED');
    const qf = solarAt(fb, tSec), rf = Math.hypot(qf[1], qf[2]), vf = Math.hypot(qf[3], qf[4]);
    row(0, 'a = (r_min + r_max)/2', fb.aM.toFixed(4) + ' AU', th.phys);
    row(1, 'period timed · a^1.5', (fb.T / YR).toFixed(4) + ' · ' + Math.pow(fb.aM, 1.5).toFixed(4) + ' yr', th.ok);
    row(2, 'eccentricity', fb.eM.toFixed(4));
    row(3, 'now: distance · speed', (rf / AU).toFixed(3) + ' AU · ' + (vf / 1e3).toFixed(2) + ' km/s');
    if (!narrow) {
      row(4, 'v_perihelion ÷ v_aphelion', (fb.vMax / fb.vMin).toFixed(3));
      row(5, 'r_aphelion ÷ r_perihelion', (fb.rMax / fb.rMin).toFixed(3), th.ok);
      row(6, 'inclination to the ecliptic', fb.iD.toFixed(2) + '°' + (fb.iD > 90 ? ' (retrograde)' : ''));
    }
  }

  /* =========================================================================
     THE FIELD OF A SHAPE — superposition, done by brute force

     Every shape is built from thousands of point masses (a ring from 720, a
     shell from 3000 on a Fibonacci lattice, a solid sphere from forty nested
     shells weighted by 3r²dr, a disc as a sunflower of equal areas), and the
     field and potential are summed over all of them. Nothing is assumed: the
     zero inside a shell, the uniform field inside an off-centre cavity and
     the maximum on a ring's axis at R/√2 come out of the sums. G = M = R = 1,
     so fields read in GM/R² and potentials in GM/R. A tiny softening (0.02 R)
     keeps a probe that lands next to one of the points from seeing a spike.
     ========================================================================= */
  function fib(n, r, o, w) {
    const out = [], ga = Math.PI * (3 - Math.sqrt(5));
    for (let i = 0; i < n; i++) {
      const z = 1 - 2 * (i + 0.5) / n, rr = Math.sqrt(1 - z * z), a = i * ga;
      out.push([o[0] + r * rr * Math.cos(a), o[1] + r * rr * Math.sin(a), o[2] + r * z, w]);
    }
    return out;
  }
  function shapePoints(p) {
    const sh = p.shape;
    if (sh === 'ring') { const n = 720, o = []; for (let i = 0; i < n; i++) { const a = i / n * TAU; o.push([Math.cos(a), Math.sin(a), 0, 1 / n]); } return o; }
    if (sh === 'shell') return fib(3000, 1, [0, 0, 0], 1 / 3000);
    if (sh === 'disc') {
      const n = 3000, o = [], ga = Math.PI * (3 - Math.sqrt(5));
      for (let i = 0; i < n; i++) { const r = Math.sqrt((i + 0.5) / n), a = i * ga; o.push([r * Math.cos(a), r * Math.sin(a), 0, 1 / n]); }
      return o;
    }
    if (sh === 'poly') {
      const n = p.npoly, o = [];
      for (let i = 0; i < n; i++) { const a = i / n * TAU + Math.PI / n; o.push([Math.cos(a), Math.sin(a), 0, 1 / n]); }
      return o;
    }
    // solid sphere (M = 1 for the WHOLE sphere), optionally with a cavity hollowed out
    const NS = 40, o = [];
    for (let k = 0; k < NS; k++) {
      const r = (k + 0.5) / NS, dm = 3 * r * r / NS, n = Math.max(8, Math.round(5200 * r * r / NS * 3));
      fib(n, r, [0, 0, 0], dm / n).forEach(q => {
        if (sh === 'cavity' && Math.hypot(q[0] - p.cd, q[1], q[2]) < p.cr) return;
        o.push(q);
      });
    }
    return o;
  }
  function sumAt(P, x, y, z) {
    let gx = 0, gy = 0, gz = 0, V = 0;
    const e2 = 0.02 * 0.02;
    for (let i = 0; i < P.length; i++) {
      const q = P[i], dx = q[0] - x, dy = q[1] - y, dz = q[2] - z, r2 = dx * dx + dy * dy + dz * dz + e2, r = Math.sqrt(r2), k = q[3] / (r2 * r);
      gx += k * dx; gy += k * dy; gz += k * dz; V -= q[3] / r;
    }
    return [gx, gy, gz, V];
  }
  /* the textbook answer along the probe axis, for comparison */
  function shapeFormula(p, s) {
    const sh = p.shape, a = Math.abs(s), sg = s < 0 ? -1 : 1;
    if (sh === 'ring' || sh === 'poly') { const d = Math.pow(1 + s * s, 1.5); return { g: -s / d, V: -1 / Math.sqrt(1 + s * s) }; }
    if (sh === 'disc') return { g: -2 * sg * (1 - a / Math.sqrt(a * a + 1)), V: -2 * (Math.sqrt(a * a + 1) - a) };
    if (sh === 'shell') return a < 1 ? { g: 0, V: -1 } : { g: -sg / (a * a), V: -1 / a };
    const whole = a < 1 ? { g: -s, V: -(3 - a * a) / 2 } : { g: -sg / (a * a), V: -1 / a };
    if (sh === 'sphere') return whole;
    // cavity = whole sphere − a small sphere of mass c³ at x = d
    const m = Math.pow(p.cr, 3), u = s - p.cd, b = Math.abs(u), c = p.cr;
    const small = b < c ? { g: -m * u / (c * c * c), V: -m * (3 * c * c - b * b) / (2 * c * c * c) } : { g: -m * Math.sign(u) / (b * b), V: -m / b };
    return { g: whole.g - small.g, V: whole.V - small.V };
  }
  /* the probe runs up the axis for flat shapes, along x through the centres otherwise */
  const axisOf = sh => (sh === 'ring' || sh === 'disc' || sh === 'poly') ? 2 : 0;
  function runShape(p) {
    const P = shapePoints(p), ax = axisOf(p.shape);
    const pos = s => ax === 2 ? [0, 0, s] : [s, 0, 0];
    const line = [];
    for (let s = -3; s <= 3.0001; s += 0.02) {
      if (p.shape === 'disc' && Math.abs(s) < 0.03) continue;
      if ((p.shape === 'shell' || p.shape === 'sphere' || p.shape === 'cavity') && Math.abs(Math.abs(s) - 1) < 0.03) continue;
      const q = sumAt(P, ...pos(s)); line.push([s, q[ax], q[3]]);
    }
    // the arrow field, in the vertical plane through the axis (x–z)
    const grid = [];
    for (let i = -6; i <= 6; i++) for (let j = -4; j <= 4; j++) {
      const x = i * 0.4, z = j * 0.4, q = sumAt(P, x, 0, z);
      grid.push([x, z, q[0], q[2], Math.hypot(q[0], q[1], q[2])]);
    }
    if (p.shape === 'cavity') {             // and a close grid inside the cavity itself
      for (let i = -2; i <= 2; i++) for (let j = -2; j <= 2; j++) {
        const x = p.cd + i * p.cr * 0.33, z = j * p.cr * 0.33;
        if (Math.hypot(x - p.cd, z) > p.cr * 0.8) continue;
        const q = sumAt(P, x, 0, z); grid.push([x, z, q[0], q[2], Math.hypot(q[0], q[1], q[2]), 1]);
      }
    }
    const pr = p.pr, qp = sumAt(P, ...pos(pr)), fp = shapeFormula(p, pr);
    // the system's own potential energy, for a few point masses
    let Usys = 0;
    if (p.shape === 'poly') for (let i = 0; i < P.length; i++) for (let j = i + 1; j < P.length; j++)
      Usys -= P[i][3] * P[j][3] / Math.hypot(P[i][0] - P[j][0], P[i][1] - P[j][1]);
    // where the axial field is strongest (for the ring)
    let smax = 0, gmax = 0;
    let im = -1;
    line.forEach((l, i) => { if (l[0] > 0 && Math.abs(l[1]) > gmax) { gmax = Math.abs(l[1]); smax = l[0]; im = i; } });
    // refine the peak between samples with a parabola through its neighbours
    if (im > 0 && im < line.length - 1) {
      const a = Math.abs(line[im - 1][1]), b = Math.abs(line[im][1]), c = Math.abs(line[im + 1][1]), den = a - 2 * b + c;
      if (den < 0) { const off = 0.5 * (a - c) / den; smax = line[im][0] + off * (line[im + 1][0] - line[im][0]); gmax = b - 0.25 * (a - c) * off; }
    }
    const mass = P.reduce((u, q) => u + q[3], 0);
    return { P, ax, line, grid, qp, fp, Usys, smax, gmax, mass, n: P.length };
  }

  function drawShape(S, g) {
    const ctx = g.ctx, th = g.theme, p = S.p, W = g.w, H = g.h, cam = S.cam, Sh = S.Sh;
    const narrow = W < 660;
    drawSky(ctx, cam, W, H);
    const F = R3.Frame(ctx, cam, { ambient: 0.35, floorZ: null });
    const K = 0.55, w = (x, y, z) => [x * K, y * K, z * K];
    // the body itself
    const sh = p.shape;
    if (sh === 'ring') {
      const pts = []; for (let i = 0; i <= 96; i++) { const a = i / 96 * TAU; pts.push(w(Math.cos(a), Math.sin(a), 0)); }
      R3.tube(F, pts, 0.018, '#C9A04A', { segments: 8 });
    } else if (sh === 'disc') {
      const pts = []; for (let i = 0; i < 64; i++) { const a = i / 64 * TAU; pts.push(w(Math.cos(a), Math.sin(a), 0)); }
      flatPoly(F, pts, 'rgba(201,160,74,.45)');
      path3(F, pts.concat([pts[0]]), '#E8C878', { alpha: 0.9, width: 1.5, chunk: 8 });
    } else if (sh === 'poly') {
      Sh.P.forEach(q => R3.sphere(F, w(q[0], q[1], q[2]), 0.06, '#C9A04A', { shadow: false }));
      const loop = Sh.P.map(q => w(q[0], q[1], q[2])); loop.push(loop[0]);
      path3(F, loop, '#8FA4CE', { alpha: 0.4, width: 1, dash: [3, 3], chunk: 1 });
    } else {
      R3.wireSphere(F, [0, 0, 0], K, sh === 'shell' ? '#E8C878' : '#C9A04A', { lat: 6, lon: 10, alpha: sh === 'shell' ? 0.55 : 0.3 });
      if (sh !== 'shell') F.push([0, 0, 0], () => {
        const c = cam.project([0, 0, 0]); if (!c.ok) return;
        const rp = K * c.s, gr = ctx.createRadialGradient(c.x - rp * 0.3, c.y - rp * 0.3, rp * 0.1, c.x, c.y, rp);
        gr.addColorStop(0, 'rgba(230,190,120,.30)'); gr.addColorStop(1, 'rgba(150,100,50,.18)');
        ctx.fillStyle = gr; ctx.beginPath(); ctx.arc(c.x, c.y, rp, 0, TAU); ctx.fill();
      }, 0.3);
      if (sh === 'cavity') {
        R3.wireSphere(F, w(p.cd, 0, 0), p.cr * K, '#7FD0FF', { lat: 4, lon: 8, alpha: 0.7 });
        R3.label(F, w(p.cd, 0, p.cr + 0.12), 'cavity', '#7FD0FF', { size: 9.5 });
      }
    }
    // the field, as arrows in the vertical plane through the axis
    const gRef = sh === 'poly' || sh === 'ring' ? 0.4 : 1;
    Sh.grid.forEach(q => {
      const m = q[4]; if (m < 1e-4) return;
      const L = clamp(0.20 * Math.sqrt(m / gRef), 0.03, 0.22) * (q[5] ? 0.8 : 1);
      const at = w(q[0], 0, q[1]), d = R3.norm([q[2], 0, q[3]]);
      const col = q[5] ? '#7FD0FF' : RX.mix('#3E6FB8', '#FFD36B', clamp(Math.sqrt(m / gRef), 0, 1));
      R3.arrow(F, R3.add(at, R3.scale(d, -L / 2)), R3.add(at, R3.scale(d, L / 2)), 0.006, col, { bias: -0.01 });
    });
    // the probe on its axis, and the pull the sum gives it
    const ax = Sh.ax, pp = ax === 2 ? w(0, 0, p.pr) : w(p.pr, 0, 0);
    path3(F, ax === 2 ? [w(0, 0, -3), w(0, 0, 3)] : [w(-3, 0, 0), w(3, 0, 0)], '#8FA4CE', { alpha: 0.35, width: 1, dash: [5, 4], chunk: 1 });
    R3.sphere(F, pp, 0.035, '#FF5A7A', { shadow: false });
    const gq = [Sh.qp[0], Sh.qp[2]], gm = Math.hypot(Sh.qp[0], Sh.qp[1], Sh.qp[2]);
    if (gm > 1e-3) R3.arrow(F, pp, R3.add(pp, R3.scale(R3.norm([gq[0], 0, gq[1]]), clamp(0.35 * Math.sqrt(gm / gRef), 0.05, 0.45))), 0.009, '#FF5A7A', { label: 'g ' + gm.toFixed(3), labelSize: 9.5 });
    else R3.label(F, pp, 'g = ' + gm.toExponential(1) + ' — the pulls cancel', '#FF8FB0', { size: 9.5, dy: -16 });
    F.render();
    const hp = cam.project(pp), hp2 = cam.project(ax === 2 ? w(0, 0, p.pr + 0.5) : w(p.pr + 0.5, 0, 0));
    if (hp.ok && hp2.ok) { S._axS = axis2(hp, hp2, 0.5); ringHandle(g, hp, 'prb2', '#FF5A7A'); }
    const names = { ring: 'A ring', shell: 'A thin spherical shell', sphere: 'A uniform solid sphere', cavity: 'A sphere with a cavity', disc: 'A uniform disc', poly: p.npoly + ' equal masses on a circle' };
    header(g, names[sh] + ' · ' + Sh.n.toLocaleString('en-US') + ' point masses, summed',
      'probe at ' + p.pr.toFixed(2) + ' R · g (sum) ' + (Sh.qp[ax]).toFixed(4) + ' · formula ' + Sh.fp.g.toFixed(4) + '  (GM/R²) · V (sum) ' + Sh.qp[3].toFixed(4) + ' · formula ' + Sh.fp.V.toFixed(4) + ' (GM/R)',
      'g = Σ Gm r̂/r², V = −Σ Gm/r over every point · nothing assumed: the shell theorem is what the sum returns', th.text);
    const rows = narrow ? 3 : 5, bw = narrow ? W - 24 : 290, bh = 26 + rows * 15 + 10;
    const row = gPanel(g, 12, H - bh - 30, bw, bh, 'WHAT THE SUM SAYS');
    if (sh === 'ring') { row(0, 'strongest on the axis at', Sh.smax.toFixed(3) + ' R', th.phys); row(1, 'R/√2', (1 / Math.SQRT2).toFixed(3) + ' R', th.ok); row(2, 'g there · 2/(3√3)', Sh.gmax.toFixed(4) + ' · ' + (2 / (3 * Math.sqrt(3))).toFixed(4)); }
    else if (sh === 'shell') { const c = sumAt(Sh.P, 0.3, 0.2, -0.1); row(0, 'g inside (at an odd point)', Math.hypot(c[0], c[1], c[2]).toExponential(2), th.ok); row(1, 'V inside', c[3].toFixed(4) + ' = −GM/R', th.phys); row(2, 'outside: as if all at the centre', 'GM/r²'); }
    else if (sh === 'cavity') { const c = sumAt(Sh.P, p.cd, 0, 0), c2 = sumAt(Sh.P, p.cd + p.cr * 0.5, 0, p.cr * 0.4); row(0, 'g at the cavity centre', Math.hypot(c[0], c[1], c[2]).toFixed(4), th.phys); row(1, 'g elsewhere in the cavity', Math.hypot(c2[0], c2[1], c2[2]).toFixed(4), th.ok); row(2, '(4/3)πGρ·d = GMd/R³', p.cd.toFixed(4)); }
    else if (sh === 'sphere') { row(0, 'inside: g ∝ r', 'GMr/R³', th.phys); row(1, 'V at the centre', sumAt(Sh.P, 0, 0, 0)[3].toFixed(4) + ' = −3GM/2R', th.ok); row(2, 'mass summed', Sh.mass.toFixed(4) + ' M'); }
    else if (sh === 'disc') { row(0, 'g on the axis at z = R', (-sumAt(Sh.P, 0, 0, 1)[2]).toFixed(4), th.phys); row(1, '2(1 − 1/√2)', (2 * (1 - 1 / Math.SQRT2)).toFixed(4), th.ok); row(2, 'just above the centre', '→ 2πGσ = 2GM/R²'); }
    else { const c = sumAt(Sh.P, 0, 0, 0); row(0, 'g at the centre', Math.hypot(c[0], c[1], c[2]).toExponential(2), th.ok); row(1, 'V at the centre', c[3].toFixed(4) + ' = −GM/R', th.phys); row(2, 'system PE ÷ (Gm²/a)', (Sh.Usys / (Math.pow(1 / p.npoly, 2) / (2 * Math.sin(Math.PI / p.npoly)))).toFixed(4)); }
    if (!narrow) { row(3, 'probe: g sum · formula', Sh.qp[ax].toFixed(4) + ' · ' + Sh.fp.g.toFixed(4)); row(4, 'probe: V sum · formula', Sh.qp[3].toFixed(4) + ' · ' + Sh.fp.V.toFixed(4)); }
  }

  /* the live torsion balance: integrated every frame, so moving the large
     spheres mid-swing is answered by the rod exactly as a real one would */
  function cavLive(S, dt) {
    const p = S.p, cv = S.cv, Gm = cv.Gm;
    const total = dt * Gm.T0 / 8, hMax = Gm.T0 / 400;
    const n = Math.max(1, Math.ceil(total / hMax)), h = total / n;
    const target = swivelAngle(Gm, p.pos);
    for (let i = 0; i < n; i++) {
      // the swivel takes about half a minute to swing, as it does by hand
      const dpsi = target - cv.psi, step = 0.05 * h;
      cv.psi = Math.abs(dpsi) <= step ? target : cv.psi + Math.sign(dpsi) * step;
      const settled = cv.psi === target;
      if (settled && cv.pos !== p.pos) { cv.pos = p.pos; cv.tp = []; cv.prevW = 0; }
      const ns = cavStep(Gm, cv.st, h, cv.psi);
      if (settled && cv.prevW !== 0 && Math.sign(ns[1]) !== Math.sign(cv.prevW)) {
        const f = cv.prevW / (cv.prevW - ns[1]);
        cv.tp.push([cv.t + f * h, spotOf(Gm, cv.st[0] + (ns[0] - cv.st[0]) * f)]);
        const rp = restPoint(cv.tp);
        if (rp) { cv.Tlast = rp.T; if (cv.pos !== 'away') cv.rest[cv.pos] = rp; }
      }
      cv.prevW = ns[1]; cv.st = ns; cv.t += h;
      if (cv.t >= cv.nextRec) {
        cv.rec.push([cv.t, spotOf(Gm, cv.st[0]), cv.pos, settled]);
        cv.nextRec = cv.t + Gm.T0 / 150;
        while (cv.rec.length && cv.rec[0][0] < cv.t - 9 * Gm.T0) cv.rec.shift();
      }
    }
    // the automatic protocol: once four turning points are in, swing across
    if (p.auto && cv.pos === p.pos && cv.pos !== 'away' && cv.tp.length >= 4) p.pos = cv.pos === 'I' ? 'II' : 'I';
  }

  /* the rest deflection against separation, for the inverse-square plot */
  const CAVB = {};
  function cavCurve(p) {
    const key = [p.MB, p.mg, p.T0min, p.Lm].join('|');
    if (CAVB[key]) return CAVB[key];
    const out = [], near = [];
    const g0 = cavGeom(Object.assign({}, p, { bmm: 50 }));
    const bMin = (g0.rs + g0.RB) * 1000 + 4;
    for (let lb = Math.log10(bMin); lb <= Math.log10(400); lb += 0.02) {
      const bmm = Math.pow(10, lb), Gm = cavGeom(Object.assign({}, p, { bmm: bmm }));
      const t = cavRest(Gm, swivelAngle(Gm, 'I'));
      out.push([lb, Math.log10(Math.abs(spotOf(Gm, t)) * 100)]);
      const tn = 2 * Gm.d * GRAV * Gm.M * Gm.m / (Gm.b * Gm.b) / Gm.kappa;
      near.push([lb, Math.log10(spotOf(Gm, tn) * 100)]);
    }
    return (CAVB[key] = { out, near, bMin });
  }

  const SHP = S => S.p.mode === 'shapes', CAVI = S => S.p.mode === 'shapes' && S.p.shape === 'cavity', POLY = S => S.p.mode === 'shapes' && S.p.shape === 'poly';
  const SOL = S => S.p.mode === 'solar', FLD = S => S.p.mode === 'field', HOH = S => S.p.mode === 'orbit' && S.p.mission === 'hohmann',
        RDV = S => S.p.mode === 'orbit' && S.p.mission === 'rendezvous';
  const ORB = S => S.p.mode === 'orbit', BIN = S => S.p.mode === 'binary', INS = S => S.p.mode === 'inside', CAV = S => S.p.mode === 'cavendish';
  const LG = Math.log10;

  L.register({
    id: 'gravitation', subject: 'physics',
    name: 'Gravitation — Orbits, the Inside of the Earth and Weighing G',
    chapter: 'Gravitation',
    exams: ['JEE Main', 'JEE Advanced', 'NEET UG'],
    weight: 'Very high yield',
    is3D: true, ground: false,
    stageHint: 'Drag to orbit · rings: launch speed/angle and height · tunnel and probe · drag a lead sphere across',
    lede: 'Launch satellites in true 3D, over the poles or on a Molniya loop, and watch their <b>ground track</b> sweep the turning Earth. Fire the engine for a Hohmann transfer, or run the <b>whole solar system</b> from real orbital elements. Nothing here is drawn from a formula for an ellipse. The satellite is <b>launched and then integrated</b> under ' +
      'F = GMm/r², step by step, and every exam result is <b>read off the run</b>: the period with a stopwatch, the semi-major ' +
      'axis from the nearest and furthest points actually reached, Kepler\'s equal areas by adding up the triangles the radius ' +
      'swept. Turn on air drag and watch the satellite <b>speed up</b> as it loses energy. Go inside a cut-away Earth built from ' +
      'the real seismic density model, where g <b>rises</b> on the way down to the core. Then do what Cavendish did: hang two ' +
      'lead balls from a fibre, swing two big ones beside them, and <b>weigh G</b> from the wander of a laser spot.',

    params: { mode: 'orbit', incO: 0, argP: 0, mission: 'free', body: 'earth', logH: LG(408), vr: 1, gam: 0, spin: true, drag: false, dragX: 2,
              M1: 2, M2: 1, aAU: 1, ecc: 0.3, incl: 70,
              model: 'uniform', dkm: 0, probe: 0.5, lat: 30, dayH: 24,
              pos: 'I', from: 'away', MB: 1.5, mg: 15, bmm: 46.5, T0min: 10, zeta: 0.08, Lm: 5, auto: false,
              incO: 0, argP: 0, mission: 'free', dv: 500, bdir: 'pro', logH2: LG(35786), autoB: false, lead: 10,
              shape: 'ring', pr: 0.7, cd: 0.5, cr: 0.4, npoly: 4,
              focus: 'earth', zoomAU: LG(2), yps: 0.3,
              flogq: LG(1 / 81.3), fdR: 60.3, fshell: false, fv: 11.1, fang: 0,
              sectors: true, arrows: true, run: true },

    presets: [
      { name: 'ISS · circular at 408 km', params: { mode: 'orbit', incO: 0, argP: 0, mission: 'free', body: 'earth', logH: LG(408), vr: 1, gam: 0, drag: false, spin: true, sectors: true } },
      { name: 'Geostationary · hangs over one spot', params: { mode: 'orbit', incO: 0, argP: 0, mission: 'free', body: 'earth', logH: LG(35786), vr: 1, gam: 0, drag: false, spin: true, sectors: false } },
      { name: 'Newton\'s cannon · 0.8 v_c', params: { mode: 'orbit', incO: 0, argP: 0, mission: 'free', body: 'earth', logH: LG(200), vr: 0.8, gam: 0, drag: false, spin: false, sectors: false } },
      { name: '20 % faster · an ellipse', params: { mode: 'orbit', incO: 0, argP: 0, mission: 'free', body: 'earth', logH: LG(400), vr: 1.2, gam: 0, drag: false, spin: false, sectors: true } },
      { name: 'Same speed, aimed 20° up', params: { mode: 'orbit', incO: 0, argP: 0, mission: 'free', body: 'earth', logH: LG(400), vr: 1, gam: 20, drag: false, spin: false, sectors: false } },
      { name: 'Escape · exactly √2 v_c', params: { mode: 'orbit', incO: 0, argP: 0, mission: 'free', body: 'earth', logH: LG(400), vr: Math.SQRT2, gam: 0, drag: false, spin: false, sectors: true } },
      { name: 'Air drag · the satellite paradox', params: { mode: 'orbit', incO: 0, argP: 0, mission: 'free', body: 'earth', logH: LG(300), vr: 1, gam: 0, drag: true, dragX: 2, spin: false, sectors: false } },
      { name: 'Io around Jupiter', params: { mode: 'orbit', incO: 0, argP: 0, mission: 'free', body: 'jupiter', logH: LG(421700 - 69911), vr: 1, gam: 0, drag: false, spin: true, sectors: true } },
      { name: 'Polar orbit · the Earth turns beneath it', params: { mode: 'orbit', incO: 90, argP: 0, mission: 'free', body: 'earth', logH: LG(800), vr: 1, gam: 0, drag: false, spin: true, sectors: false } },
      { name: 'Molniya · 63.4°, 12 h, hangs over the north', params: { mode: 'orbit', incO: 63.4, argP: 270, mission: 'free', body: 'earth', logH: LG(600), vr: 1.3180, gam: 0, drag: false, spin: true, sectors: true } },
      { name: 'Hohmann · LEO to geostationary (autopilot)', params: { mode: 'orbit', incO: 0, argP: 0, mission: 'hohmann', body: 'earth', logH: LG(300), vr: 1, gam: 0, drag: false, spin: false, sectors: false, logH2: LG(35786), autoB: true, dv: 2400, bdir: 'pro' } },
      { name: 'Rendezvous · the target is 10° ahead', params: { mode: 'orbit', incO: 0, argP: 0, mission: 'rendezvous', body: 'earth', logH: LG(400), vr: 1, gam: 0, drag: false, spin: false, sectors: false, lead: 10, autoB: false, dv: 40, bdir: 'retro' } },
      { name: 'Solar system · the inner planets', params: { mode: 'solar', focus: 'earth', zoomAU: LG(2), yps: 0.3, sectors: true } },
      { name: 'Solar system · all of it', params: { mode: 'solar', focus: 'jupiter', zoomAU: LG(34), yps: 8, sectors: true } },
      { name: 'Halley\'s comet · 76 years in a minute', params: { mode: 'solar', focus: 'halley', zoomAU: LG(22), yps: 5, sectors: true } },
      { name: 'Ring · where is g strongest on its axis?', params: { mode: 'shapes', shape: 'ring', pr: 0.707 } },
      { name: 'Shell · nothing inside', params: { mode: 'shapes', shape: 'shell', pr: 0.45 } },
      { name: 'Sphere with a cavity · a uniform field', params: { mode: 'shapes', shape: 'cavity', cd: 0.5, cr: 0.4, pr: 0.5 } },
      { name: 'Four masses on a square', params: { mode: 'shapes', shape: 'poly', npoly: 4, pr: 0.6 } },
      { name: 'Dropped from h = R · not √(2gh)', params: { mode: 'orbit', incO: 0, argP: 0, mission: 'free', body: 'earth', logH: LG(6371), vr: 0, gam: 0, drag: false, spin: false, sectors: false } },
      { name: 'Earth and Moon · the neutral point', params: { mode: 'field', flogq: LG(1 / 81.3), fdR: 60.3, fshell: false, fv: 11.0, fang: 0 } },
      { name: 'Just enough to reach the Moon', params: { mode: 'field', flogq: LG(1 / 81.3), fdR: 60.3, fshell: false, fv: 11.09, fang: 0 } },
      { name: 'Inside a hollow shell', params: { mode: 'field', flogq: LG(0.3), fdR: 8, fshell: true, fv: 9, fang: 25 } },
      { name: 'Binary · 2 M☉ and 1 M☉', params: { mode: 'binary', M1: 2, M2: 1, aAU: 1, ecc: 0.3, incl: 70 } },
      { name: 'Sun and Jupiter · the wobble', params: { mode: 'binary', M1: 1, M2: 0.000955, aAU: 5.2, ecc: 0.049, incl: 90 } },
      { name: 'Twin stars, eccentric', params: { mode: 'binary', M1: 1, M2: 1, aAU: 0.5, ecc: 0.7, incl: 60 } },
      { name: 'Tunnel off-centre · uniform Earth', params: { mode: 'inside', model: 'uniform', dkm: 3000, probe: 0.5, lat: 30, dayH: 24 } },
      { name: 'Real Earth (PREM) · through the centre', params: { mode: 'inside', model: 'prem', dkm: 0, probe: 0.547, lat: 30, dayH: 24 } },
      { name: 'Spin it until the equator floats', params: { mode: 'inside', model: 'uniform', dkm: 0, probe: 1, lat: 0, dayH: 1.45 } },
      { name: 'Cavendish · from rest into position I', params: { mode: 'cavendish', from: 'away', pos: 'I', auto: false, MB: 1.5, mg: 15, bmm: 46.5, T0min: 10, zeta: 0.08, Lm: 5 } },
      { name: 'Settled in I · now swing to II', params: { mode: 'cavendish', from: 'I', pos: 'II', auto: false, MB: 1.5, mg: 15, bmm: 46.5, T0min: 10, zeta: 0.08, Lm: 5 } },
      { name: 'Full measurement · automatic', params: { mode: 'cavendish', from: 'away', pos: 'I', auto: true, MB: 1.5, mg: 15, bmm: 46.5, T0min: 10, zeta: 0.12, Lm: 5 } }
    ],

    controls: [
      { group: 'What is set up', items: [
        { key: 'mode', type: 'select', label: 'Experiment', restructure: true, rebuild: true, options: [
          { value: 'orbit', label: 'Launch a satellite' }, { value: 'solar', label: 'Solar system' }, { value: 'field', label: 'Field & potential' }, { value: 'shapes', label: 'Field of a shape' }, { value: 'binary', label: 'Binary star' },
          { value: 'inside', label: 'Inside the Earth' }, { value: 'cavendish', label: 'Cavendish balance' }] }
      ] },
      { group: 'Launch', items: [
        { key: 'body', type: 'select', label: 'Planet', restructure: true, when: ORB, options: [
          { value: 'earth', label: 'Earth' }, { value: 'moon', label: 'Moon' }, { value: 'mars', label: 'Mars' }, { value: 'jupiter', label: 'Jupiter' }] },
        { key: 'logH', label: 'Launch altitude <i>h</i>', min: 2, max: 5.7, step: 0.001, unit: 'km', when: ORB,
          fmt: v => { const h = Math.pow(10, v); return h < 1e4 ? h.toFixed(0) : h.toExponential(3); }, restructure: true },
        { key: 'vr', label: 'Launch speed ÷ circular speed', min: 0, max: 1.8, step: 0.001, unit: '× v_c', when: ORB,
          fmt: v => v.toFixed(3), restructure: true },
        { key: 'gam', label: 'Angle above the horizontal', min: -60, max: 60, step: 0.5, unit: '°', when: ORB,
          fmt: v => v.toFixed(1), restructure: true },
        { key: 'incO', label: 'Orbit inclination <i>i</i>', min: 0, max: 180, step: 0.5, unit: '°', when: ORB, fmt: v => v.toFixed(1) },
        { key: 'argP', label: 'Launch point round the orbit ω', min: 0, max: 360, step: 1, unit: '°', when: ORB, fmt: v => v.toFixed(0) },
        { key: 'spin', type: 'toggle', label: 'Planet turns · draw the ground track', when: ORB },
        { key: 'drag', type: 'toggle', label: 'Air drag (Earth\'s thermosphere)', restructure: true, when: ORB },
        { key: 'dragX', label: 'Drag exaggeration', min: 0, max: 3, step: 0.05, unit: '×', when: ORB,
          fmt: v => Math.pow(10, v).toFixed(0), restructure: true }
      ] },
      { group: 'Engine burn', items: [
        { key: 'mission', type: 'select', label: 'Mission', restructure: true, rebuild: true, when: ORB, options: [
          { value: 'free', label: 'Free flight' }, { value: 'hohmann', label: 'Hohmann transfer' }, { value: 'rendezvous', label: 'Rendezvous' }] },
        { key: 'dv', label: 'Burn size Δv', min: 0, max: 4000, step: 1, unit: 'm/s', when: ORB, fmt: v => v.toFixed(0) },
        { key: 'bdir', type: 'select', label: 'Burn direction', when: ORB, options: [
          { value: 'pro', label: 'Prograde' }, { value: 'retro', label: 'Retrograde' }, { value: 'out', label: 'Radial out' }, { value: 'in', label: 'Radial in' }] },
        { key: 'logH2', label: 'Target orbit height', min: 2.3, max: 5.0, step: 0.001, unit: 'km', when: HOH,
          fmt: v => Math.pow(10, v).toFixed(0), restructure: true },
        { key: 'autoB', type: 'toggle', label: 'Autopilot fires both burns', restructure: true, when: HOH },
        { key: 'lead', label: 'Target starts ahead by', min: -60, max: 60, step: 0.5, unit: '°', when: RDV, fmt: v => v.toFixed(1), restructure: true }
      ] },
      { group: 'The shape', items: [
        { key: 'shape', type: 'select', label: 'Mass distribution', restructure: true, rebuild: true, when: SHP, options: [
          { value: 'ring', label: 'Ring' }, { value: 'disc', label: 'Disc' }, { value: 'shell', label: 'Shell' }, { value: 'sphere', label: 'Solid sphere' },
          { value: 'cavity', label: 'Sphere with a cavity' }, { value: 'poly', label: 'Point masses' }] },
        { key: 'pr', label: 'Probe position along the axis', min: -3, max: 3, step: 0.005, unit: 'R', when: SHP, fmt: v => v.toFixed(3), restructure: true },
        { key: 'cd', label: 'Cavity centre from the centre <i>d</i>', min: 0, max: 0.55, step: 0.005, unit: 'R', when: CAVI, fmt: v => v.toFixed(3), restructure: true },
        { key: 'cr', label: 'Cavity radius', min: 0.1, max: 0.45, step: 0.005, unit: 'R', when: CAVI, fmt: v => v.toFixed(3), restructure: true },
        { key: 'npoly', label: 'Number of masses', min: 2, max: 8, step: 1, unit: '', when: POLY, fmt: v => v.toFixed(0), restructure: true }
      ] },
      { group: 'The solar system', items: [
        { key: 'focus', type: 'select', label: 'Follow', when: SOL, options: [
          { value: 'mercury', label: 'Mercury' }, { value: 'venus', label: 'Venus' }, { value: 'earth', label: 'Earth' }, { value: 'mars', label: 'Mars' },
          { value: 'jupiter', label: 'Jupiter' }, { value: 'saturn', label: 'Saturn' }, { value: 'uranus', label: 'Uranus' }, { value: 'neptune', label: 'Neptune' },
          { value: 'pluto', label: 'Pluto' }, { value: 'halley', label: 'Halley' }] },
        { key: 'zoomAU', label: 'Show out to', min: 0.2, max: 1.7, step: 0.005, unit: 'AU', when: SOL, fmt: v => Math.pow(10, v).toFixed(Math.pow(10, v) < 10 ? 1 : 0) },
        { key: 'yps', label: 'Time rate', min: 0.02, max: 12, step: 0.01, unit: 'yr/s', when: SOL, fmt: v => v.toFixed(2) }
      ] },
      { group: 'Two bodies', items: [
        { key: 'flogq', label: 'Second mass ÷ first', min: -3, max: 0, step: 0.001, unit: '', when: FLD,
          fmt: v => { const q = Math.pow(10, v); return q < 0.1 ? '1/' + (1 / q).toFixed(1) : q.toFixed(3); }, restructure: true },
        { key: 'fdR', label: 'Separation, in radii of the first', min: 6, max: 80, step: 0.1, unit: 'R', when: FLD, fmt: v => v.toFixed(1), restructure: true },
        { key: 'fshell', type: 'toggle', label: 'First body is a hollow shell', restructure: true, when: FLD },
        { key: 'fv', label: 'Probe launch speed', min: 3, max: 14, step: 0.005, unit: 'km/s', when: FLD, fmt: v => v.toFixed(3), restructure: true },
        { key: 'fang', label: 'Launch direction from the axis', min: -90, max: 90, step: 0.5, unit: '°', when: FLD, fmt: v => v.toFixed(1), restructure: true }
      ] },
      { group: 'The two stars', items: [
        { key: 'M1', label: '<i>M</i>₁', min: 0.1, max: 10, step: 0.01, unit: 'M☉', when: BIN, fmt: v => v.toFixed(2), restructure: true },
        { key: 'M2', label: '<i>M</i>₂', min: 0.0005, max: 10, step: 0.0005, unit: 'M☉', when: BIN, fmt: v => v < 0.1 ? v.toFixed(4) : v.toFixed(2), restructure: true },
        { key: 'aAU', label: 'Separation (semi-major axis) <i>a</i>', min: 0.1, max: 10, step: 0.01, unit: 'AU', when: BIN, fmt: v => v.toFixed(2), restructure: true },
        { key: 'ecc', label: 'Eccentricity <i>e</i>', min: 0, max: 0.85, step: 0.01, unit: '', when: BIN, fmt: v => v.toFixed(2), restructure: true },
        { key: 'incl', label: 'Inclination to our line of sight', min: 0, max: 90, step: 1, unit: '°', when: BIN, fmt: v => v.toFixed(0) }
      ] },
      { group: 'Inside the Earth', items: [
        { key: 'model', type: 'select', label: 'Density inside', restructure: true, when: INS, options: [
          { value: 'uniform', label: 'Uniform (textbook)' }, { value: 'prem', label: 'Real Earth (PREM)' }] },
        { key: 'dkm', label: 'Tunnel offset from the centre <i>d</i>', min: 0, max: 6000, step: 10, unit: 'km', when: INS,
          fmt: v => v.toFixed(0), restructure: true },
        { key: 'probe', label: 'Probe at <i>r</i> ÷ <i>R</i>', min: 0, max: 3, step: 0.001, unit: '', when: INS, fmt: v => v.toFixed(3) },
        { key: 'lat', label: 'Latitude of the plumb line λ', min: 0, max: 90, step: 1, unit: '°', when: INS, fmt: v => v.toFixed(0) },
        { key: 'dayH', label: 'Length of the day', min: 1.2, max: 48, step: 0.01, unit: 'h', when: INS, fmt: v => v.toFixed(2) }
      ] },
      { group: 'Torsion balance', items: [
        { key: 'pos', type: 'select', label: 'Large spheres', when: CAV, options: [
          { value: 'away', label: 'Swung away' }, { value: 'I', label: 'Position I' }, { value: 'II', label: 'Position II' }] },
        { key: 'auto', type: 'toggle', label: 'Swing them automatically', when: CAV },
        { key: 'MB', label: 'Large sphere mass <i>M</i>', min: 0.5, max: 10, step: 0.05, unit: 'kg', when: CAV, fmt: v => v.toFixed(2), restructure: true },
        { key: 'mg', label: 'Small sphere mass <i>m</i>', min: 5, max: 50, step: 0.5, unit: 'g', when: CAV, fmt: v => v.toFixed(1), restructure: true },
        { key: 'bmm', label: 'Centre separation <i>b</i>', min: 40, max: 150, step: 0.5, unit: 'mm', when: CAV, fmt: v => v.toFixed(1), restructure: true },
        { key: 'T0min', label: 'Free period of the fibre <i>T</i>₀', min: 2, max: 20, step: 0.1, unit: 'min', when: CAV, fmt: v => v.toFixed(1), restructure: true },
        { key: 'zeta', label: 'Air damping ζ', min: 0.02, max: 0.5, step: 0.01, unit: '', when: CAV, fmt: v => v.toFixed(2), restructure: true },
        { key: 'Lm', label: 'Mirror to scale <i>L</i>', min: 1, max: 10, step: 0.05, unit: 'm', when: CAV, fmt: v => v.toFixed(2), restructure: true }
      ] },
      { group: 'Display', items: [
        { key: 'sectors', type: 'toggle', label: 'Shade equal-time sectors (Kepler II)', when: ORB },
        { key: 'arrows', type: 'toggle', label: 'Show the vectors' },
        { key: 'run', type: 'toggle', label: 'Let it run' }
      ] }
    ],

    setup(S) {
      const p = S.p;
      if (p.mode === 'orbit') { S.O = runOrbit(p); S.ts = 0; S.hold = 0; missionReset(S); }
      else if (p.mode === 'field') { S.Fd = fieldSetup(p); S.ts = 0; S.hold = 0; }
      else if (p.mode === 'solar') { runSolar(); S.yrs = S.yrs || 0; }
      else if (p.mode === 'shapes') {
        if (p.cd + p.cr > 0.95) p.cr = Math.max(0.1, 0.95 - p.cd);        // the cavity must stay inside the sphere
        p.npoly = Math.round(p.npoly);
        const key = [p.shape, p.cd, p.cr, p.npoly].join('|');
        if (!S.Sh || S._shKey !== key) { S.Sh = runShape(p); S._shKey = key; }
        else { const ax = S.Sh.ax, pos = ax === 2 ? [0, 0, p.pr] : [p.pr, 0, 0]; S.Sh.qp = sumAt(S.Sh.P, pos[0], pos[1], pos[2]); S.Sh.fp = shapeFormula(p, p.pr); }
      }
      else if (p.mode === 'binary') { S.B = runBinary(p); S.ts = 0; }
      else if (p.mode === 'inside') { S.Tn = runTunnel(p); S.ts = 0; }
      else {
        const g0 = cavGeom(p), bMin = (g0.rs + g0.RB) * 1000 + 4;
        if (p.bmm < bMin) p.bmm = Math.ceil(bMin * 2) / 2;       // the spheres cannot overlap the glass
        if (p.auto && p.pos === 'away') p.pos = 'I';
        const Gm = cavGeom(p), psi0 = swivelAngle(Gm, p.from);
        S.cv = { Gm, st: [p.from === 'away' ? 0 : cavRest(Gm, psi0), 0], psi: psi0, pos: p.from, t: 0, rec: [], tp: [], rest: {},
                 prevW: 0, Tlast: 0, nextRec: 0 };
        const key = [p.MB, p.mg, p.bmm, p.T0min, p.zeta, p.Lm].join('|');
        if (S._protoKey !== key) { S.proto = cavProtocol(p); S._protoKey = key; }
      }
      const views = {
        orbit: { theta: -1.18, phi: 0.80, dist: 3.35, target: [0, 0, 0] },
        field: { theta: -1.30, phi: 0.86, dist: 3.0, target: [0, 0, -0.30] },
        solar: { theta: -1.35, phi: 0.62, dist: 3.3, target: [0, 0, 0] },
        shapes: { theta: -1.40, phi: 0.30, dist: 3.4, target: [0, 0, 0] },
        binary: { theta: -1.30, phi: 0.78, dist: 3.1, target: [0, 0, 0] },
        inside: { theta: -0.98, phi: 0.30, dist: 3.5, target: [0, 0, 0.02] },
        cavendish: { theta: -1.92, phi: 0.34, dist: 2.35, target: [0, -0.20, 0.16] }
      };
      if (!S.cam || S._view !== p.mode) {
        S.cam = Camera(views[p.mode]); S.cam.minDist = 1.2; S.cam.maxDist = 14; S._view = p.mode; S._narrowCam = false;
      }
    },

    step(S, dt) {
      const p = S.p;
      if (!p.run) return;
      if (p.mode === 'orbit') {
        const O = S.O;
        if (S.hold > 0) { S.hold -= dt; if (S.hold <= 0) S.ts = 0; return; }
        const rate = O.drag ? O.Tloc0 / 3.5 : (O.end === 'closed' ? O.T : O.Tloc0) / 9;
        const tsOld = S.ts;
        S.ts += dt * rate; S.clock = (S.clock || 0) + dt * rate;
        const wrapped = O.end === 'closed' && S.ts >= O.T;
        if (O.end === 'closed') S.ts %= O.T;
        else if (S.ts >= O.tEnd) { S.ts = O.tEnd; S.hold = 2.2; }
        missionStep(S, wrapped ? 0 : tsOld);
      } else if (p.mode === 'solar') { S.yrs += dt * p.yps;
      } else if (p.mode === 'field') {
        if (S.hold > 0) { S.hold -= dt; if (S.hold <= 0) S.ts = 0; return; }
        S.ts += dt * S.Fd.tEnd / 10;
        if (S.ts >= S.Fd.tEnd) { S.ts = S.Fd.tEnd; S.hold = 2.5; }
      } else if (p.mode === 'binary') S.ts += dt * S.B.T / 8;
      else if (p.mode === 'inside') S.ts += dt * S.Tn.T / 10;
      else if (p.mode === 'cavendish') cavLive(S, dt);
    },

    drawStage(S, g) {
      if (g.w < 660 && !S._narrowCam) { S.cam.dist *= 1.3; S._narrowCam = true; }
      const m = S.p.mode;
      if (m === 'orbit') drawOrbit(S, g);
      else if (m === 'field') drawField(S, g);
      else if (m === 'solar') drawSolar(S, g);
      else if (m === 'shapes') drawShape(S, g);
      else if (m === 'binary') drawBinary(S, g);
      else if (m === 'inside') drawInside(S, g);
      else drawCav(S, g);
    },

    onDrag(S, e) {
      const p = S.p, along = a => a ? e.dx * a.ux + e.dy * a.uy : 0;
      if (e.id === 'burn') { if (e.phase === 'start') fireBurn(S, p.dv, p.bdir); return; }
      if (e.id === 'prb2' && S._axS) { p.pr = clamp(p.pr + (e.dx * S._axS.ux + e.dy * S._axS.uy) * S._axS.per, -3, 3); this.setup(S); return; }
      if (e.id === 'vel' && S._axT) {
        p.vr = clamp(p.vr + along(S._axT) * 0.004, 0, 1.8);
        p.gam = clamp(p.gam + along(S._axR) * 0.35, -60, 60);
        this.setup(S);
      } else if (e.id === 'alt' && S._axR) {
        p.logH = clamp(p.logH + along(S._axR) * 0.006, 2, 5.7);
        this.setup(S);
      } else if (e.id === 'tun' && S._axD) {
        p.dkm = clamp(p.dkm + along(S._axD) * S._axD.per * 6371, 0, 6000);
        this.setup(S);
      } else if (e.id === 'prb' && S._axP) {
        p.probe = clamp(p.probe + along(S._axP) * S._axP.per, 0, 3);
      } else if (e.id === 'swv') {
        if (e.phase === 'start') S._swAcc = 0;
        S._swAcc = (S._swAcc || 0) + Math.abs(e.dx) + Math.abs(e.dy);
        if (e.phase === 'end' && S._swAcc > 12) { p.pos = p.pos === 'I' ? 'II' : 'I'; p.auto = false; }
      }
    },

    plots: [
      { title: S => ({ orbit: S.p.mission === 'hohmann' ? 'The mission — height against time, burns marked' : S.p.mission === 'rendezvous' ? 'The gap to the target against time' : S.p.drag ? 'Energy per kg along the run — kinetic, potential, total' : 'Effective potential — where the orbit may go, and where it turns',
                       field: 'Potential along the line of centres — and the probe\'s energy',
                       solar: 'Kepler\'s third law, measured — every planet on one line',
                       shapes: 'g along the axis — the sum over every point, against the formula',
                       binary: 'What a telescope records — each star\'s radial velocity',
                       inside: 'g from the centre out to 3R — uniform against the real Earth',
                       cavendish: 'The laser spot against time — your record' })[S.p.mode],
        draw(S, g) {
          const p = S.p, th = g.theme, cy = '#3DD6F5', gr = '#7CF0B0', am = '#F5B451', pk = '#FF8FB0', wh = '#E8EEF8';
          if (p.mode === 'orbit' && p.mission !== 'free') {
            const M = S.M, Hs = M.hist;
            if (Hs.length < 2) return;
            const rdv = p.mission === 'rendezvous';
            const xs = Hs.map(q => q[0] / 3600), ys = Hs.map(q => rdv ? q[3] * 180 / Math.PI : q[1] / 1e3);
            const lo = Math.min(...ys, 0), hi = Math.max(...ys, rdv ? 1 : 100) * 1.1;
            const P = g.Plot({ xmin: 0, xmax: Math.max(xs[xs.length - 1], 0.1), ymin: rdv ? Math.min(lo * 1.1, -1) : 0, ymax: hi,
              xlabel: 'mission time (h)', ylabel: rdv ? 'target ahead by (°)' : 'height (km)', xfmt: v => v.toFixed(1), yfmt: v => v.toFixed(0) }).frame();
            P.clip(() => {
              if (rdv) P.hline(0, g.alpha(gr, .8), [4, 3]);
              else if (M.plan) P.hline((M.plan.r2 - S.O.R) / 1e3, g.alpha(gr, .8), [4, 3]);
              P.line(xs.map((x, i) => [x, ys[i]]), cy, 2);
              M.burns.forEach(b => P.vline(b.clock / 3600, g.alpha(am, .8), [3, 3]));
            });
            M.burns.forEach((b, i) => P.tag(b.clock / 3600, hi * 0.9, 'burn ' + (i + 1), am, 'left', 0));
            P.tag(xs[0], rdv ? 0 : (M.plan ? (M.plan.r2 - S.O.R) / 1e3 : 0), rdv ? 'caught up' : 'target orbit', gr, 'left', -8);
            return;
          }
          if (p.mode === 'shapes') {
            const Sh = S.Sh, L = Sh.line.map(l => [l[0], l[1]]), fl = [];
            for (let s = -3; s <= 3.0001; s += 0.01) fl.push([s, shapeFormula(p, s).g]);
            const m = Math.max(0.2, ...fl.map(q => Math.abs(q[1])).filter(v => isFinite(v))) * 1.15;
            const P = g.Plot({ xmin: -3, xmax: 3, ymin: -m, ymax: m, xlabel: 'position along the axis (R)', ylabel: 'g along the axis (GM/R²)', xfmt: v => v.toFixed(1), yfmt: v => v.toFixed(2) }).frame();
            P.clip(() => {
              P.line([[-3, 0], [3, 0]], g.alpha(th['text-3'], .6), 1);
              P.line(fl, g.alpha(am, .9), 1.6, [5, 3]);
              L.forEach((q, i) => { if (i % 3 === 0) P.dot(q[0], q[1], 2.2, cy); });
              P.vline(p.pr, g.alpha(pk, .7), [3, 3]);
              P.dot(p.pr, S.Sh.qp[S.Sh.ax], 5, pk, th['ink-950']);
            });
            P.tag(-2.9, m * 0.9, 'dots: the brute-force sum · dashes: the textbook formula', th['text-2'], 'left', 0);
            if (p.shape === 'ring' || p.shape === 'poly') P.tag(Sh.smax, -Sh.gmax, 'peak at ' + Sh.smax.toFixed(2) + ' R', pk, 'left', 12);
            return;
          }
          if (p.mode === 'solar') {
            const B = runSolar();
            const P = g.Plot({ xmin: -0.6, xmax: 1.8, ymin: -1, ymax: 2.8, xlabel: 'semi-major axis a (AU, log)', ylabel: 'period T (yr, log)',
              xfmt: v => { const x = Math.pow(10, v); return x < 1 ? x.toFixed(1) : x.toFixed(0); }, yfmt: v => { const y = Math.pow(10, v); return y < 1 ? y.toFixed(1) : y.toFixed(0); } }).frame();
            P.clip(() => {
              P.line([[-0.6, -0.9], [1.8, 2.7]], g.alpha(th['text-2'], .7), 1.4, [5, 4]);
              B.forEach(b => P.dot(LG(b.aM), LG(b.T / YR), b.id === p.focus ? 6 : 4, b.col, th['ink-950']));
            });
            B.forEach(b => P.tag(LG(b.aM), LG(b.T / YR), b.name, b.id === p.focus ? '#FFFFFF' : RX.mix(b.col, '#FFFFFF', 0.2), 'left', b.id === 'halley' ? 12 : -9));
            P.tag(-0.55, 2.55, 'slope 3/2: T² ∝ a³ — from the timed runs', th['text-2'], 'left', 0);
            return;
          }
          if (p.mode === 'field') {
            const Fd = S.Fd, d = Fd.d, pts = [];
            for (let i = 0; i <= 400; i++) { const x = -0.3 * d + 1.6 * d * i / 400; pts.push([x / d, Fd.V(x, 0) / 1e6]); }
            const lo = Math.max(-80, Math.min(...pts.map(q => q[1]))), Ep = Fd.E0 / 1e6;
            const P = g.Plot({ xmin: -0.3, xmax: 1.3, ymin: lo * 1.05, ymax: Math.max(2, Ep + 5), xlabel: 'along the line of centres (÷ d)', ylabel: 'V (MJ/kg)',
              xfmt: v => v.toFixed(1), yfmt: v => v.toFixed(0) }).frame();
            P.clip(() => {
              P.line([[-0.3, 0], [1.3, 0]], g.alpha(th['text-3'], .6), 1);
              P.line(pts, cy, 2.2);
              P.hline(Ep, g.alpha(pk, .9), [5, 3]);
              P.vline(Fd.xN / d, g.alpha(am, .7), [3, 3]);
              P.dot(Fd.xN / d, Fd.VN / 1e6, 5, am, th['ink-950']);
            });
            P.tag(Fd.xN / d, Fd.VN / 1e6, 'neutral point: the top of the hill', am, 'left', -10);
            P.tag(1.28, Ep, 'probe energy ½v² + V', pk, 'right', -8);
            return;
          }
          if (p.mode === 'orbit' && !S.O.drag) {
            /* the effective potential U(r) = −GM/r + h²/2r² per kg: the orbit
               lives where the energy line lies above it, and turns where they cross */
            const O = S.O, h = Math.abs(O.H0), E0 = O.E0 / 1e6, R = O.R;
            const r1 = Math.max(R * 0.6, O.rMin * 0.55), r2 = O.end === 'closed' ? O.rMax * 1.6 : Math.max(O.r0 * 6, O.rMin * 4);
            const U = r => (-O.GM / r + h * h / (2 * r * r)) / 1e6;
            const pts = [];
            for (let i = 0; i <= 300; i++) { const r = r1 + (r2 - r1) * i / 300; pts.push([r / R, U(r)]); }
            const umin = Math.min(...pts.map(q => q[1])), top = Math.max(E0 + Math.abs(umin) * 0.6, umin * 0.1, 1);
            const q = orbitAt(O, S.ts), rn = Math.hypot(q[1], q[2]);
            const P = g.Plot({ xmin: r1 / R, xmax: r2 / R, ymin: umin * 1.25, ymax: top, xlabel: 'r ÷ R (planet radii)', ylabel: 'MJ per kg',
              xfmt: v => v.toFixed(1), yfmt: v => v.toFixed(0) }).frame();
            P.clip(() => {
              P.line([[r1 / R, 0], [r2 / R, 0]], g.alpha(th['text-3'], .6), 1);
              const allowed = pts.filter(z => z[1] <= E0);
              allowed.forEach((z, i) => { if (i % 3 === 0) P.line([[z[0], z[1]], [z[0], E0]], g.alpha(gr, .22), 1); });
              P.line(pts.map(z => [z[0], -O.GM / (z[0] * R) / 1e6]), g.alpha(pk, .55), 1.2, [4, 3]);
              P.line(pts, cy, 2.2);
              P.hline(E0, g.alpha(am, .9), [6, 3]);
              P.vline(1, g.alpha(th['text-3'], .5), [2, 3]);
              if (O.end === 'closed') { P.dot(O.rMin / R, E0, 4, gr, th['ink-950']); P.dot(O.rMax / R, E0, 4, pk, th['ink-950']); }
              P.dot(rn / R, E0, 5.5, '#FFFFFF', th['ink-950']);
              P.dot(rn / R, U(rn), 3.5, cy, th['ink-950']);
            });
            P.tag(r2 / R * 0.98, E0, 'energy E = ½v² − GM/r', am, 'right', -8);
            P.tag(r2 / R * 0.98, U(r2), 'U_eff = −GM/r + L²/2r²', cy, 'right', 12);
            P.tag(r1 / R + (r2 - r1) / R * 0.02, umin * 1.15, 'the gap above the curve is the radial KE', th['text-3'], 'left', 0);
            return;
          }
          if (p.mode === 'orbit') {
            const O = S.O, closed = O.end === 'closed';
            const tx = closed ? (t => t / O.T) : O.drag ? (t => t / O.Tloc0) : (t => t / 60);
            const dec = Math.max(1, Math.floor(O.pts.length / 400));
            const ke = [], pe = [], en = [];
            /* with drag, the story is in the CHANGES — plotted from the launch
               values, KE climbs while PE falls twice as fast */
            const k0 = O.drag ? O.v0 * O.v0 / 2e6 : 0, u0 = O.drag ? -O.GM / O.r0 / 1e6 : 0;
            for (let i = 0; i < O.pts.length; i += dec) {
              const q = O.pts[i], k = (q[3] * q[3] + q[4] * q[4]) / 2e6 - k0, u = -O.GM / Math.hypot(q[1], q[2]) / 1e6 - u0;
              ke.push([tx(q[0]), k]); pe.push([tx(q[0]), u]); en.push([tx(q[0]), k + u]);
            }
            const all = ke.concat(pe).map(q => q[1]);
            const hi = Math.max.apply(null, all), lo = Math.min.apply(null, all), pad = (hi - lo) * 0.12;
            const xmax = closed ? 1 : tx(O.tEnd);
            const P = g.Plot({ xmin: 0, xmax: xmax, ymin: lo - pad, ymax: hi + pad,
              xlabel: closed ? 'time ÷ period' : O.drag ? 'time (orbits)' : 'time (min)', ylabel: O.drag ? 'change since launch (MJ/kg)' : 'energy (MJ/kg)',
              xfmt: v => closed ? v.toFixed(2) : v.toFixed(0), yfmt: v => v.toFixed(0) }).frame();
            P.clip(() => {
              P.line([[0, 0], [xmax, 0]], g.alpha(th['text-3'], .5), 1);
              P.line(ke, gr, 2); P.line(pe, pk, 2); P.line(en, wh, 2.2);
              P.vline(tx(S.ts), g.alpha(cy, .8), [3, 3]);
            });
            if (O.drag) {
              const j = Math.floor(ke.length * 0.7);
              P.tag(ke[j][0], ke[j][1], 'ΔKE — rises', gr, 'right', -10);
              P.tag(pe[j][0], pe[j][1], 'ΔPE — falls twice as fast', pk, 'right', 12);
              P.tag(en[j][0], en[j][1], 'ΔE — lost to drag', wh, 'right', 12);
            } else {
              P.tag(xmax * 0.02, ke[0][1], 'kinetic ½v²', gr, 'left', -9);
              P.tag(xmax * 0.02, pe[0][1], 'potential −GM/r', pk, 'left', 10);
              P.tag(xmax * 0.60, en[en.length >> 1][1], 'total — flat', wh, 'left', -9);
            }
            return;
          }
          if (p.mode === 'binary') {
            const B = S.B, ii = p.incl * Math.PI / 180, si = Math.sin(ii);
            const r1 = [], r2 = [];
            for (let i = 0; i <= 300; i++) {
              const t = 2 * B.T * i / 300, q = binAt(B, t);
              r1.push([t / B.T, q[3] * si / 1e3]); r2.push([t / B.T, q[7] * si / 1e3]);
            }
            const m = Math.max(1e-3, ...r1.concat(r2).map(q => Math.abs(q[1]))) * 1.15;
            const P = g.Plot({ xmin: 0, xmax: 2, ymin: -m, ymax: m, xlabel: 'time ÷ period', ylabel: 'radial velocity (km/s)',
              xfmt: v => v.toFixed(1), yfmt: v => v.toFixed(m < 1 ? 3 : 0) }).frame();
            P.clip(() => {
              P.line([[0, 0], [2, 0]], g.alpha(th['text-3'], .5), 1);
              P.line(r1, starCol(p.M1), 2.2); P.line(r2, starCol(p.M2), 2.2);
              P.vline((S.ts % B.T) / B.T, g.alpha(cy, .8), [3, 3]);
            });
            const K1 = Math.max(...r1.map(q => Math.abs(q[1]))), K2 = Math.max(...r2.map(q => Math.abs(q[1])));
            P.tag(0.04, m * 0.88, 'K₁ : K₂ = ' + (K1 / K2).toFixed(4) + ' = M₂ : M₁', th['text-2'], 'left', 0);
            return;
          }
          if (p.mode === 'inside') {
            const g0 = gInside(RE, 'uniform');
            const uni = [], prem = [], hApp = [];
            for (let x = 0; x <= 3.0001; x += 0.01) {
              uni.push([x, gInside(Math.max(1, x * RE), 'uniform')]); prem.push([x, gInside(Math.max(1, x * RE), 'prem')]);
              if (x >= 1 && x <= 1.5) hApp.push([x, g0 * (1 - 2 * (x - 1))]);
            }
            const P = g.Plot({ xmin: 0, xmax: 3, ymin: 0, ymax: 11.5, xlabel: 'r ÷ R', ylabel: 'g (m/s²)',
              xfmt: v => v.toFixed(1), yfmt: v => v.toFixed(0) }).frame();
            P.clip(() => {
              P.vline(1, g.alpha(th['text-3'], .6), [2, 3]);
              P.line(hApp, am, 1.4, [5, 4]);
              P.line(uni, cy, 2.2); P.line(prem, pk, 2.2);
              P.vline(3480 / 6371, g.alpha(pk, .35), [2, 3]);
              P.dot(p.probe, gInside(p.probe * RE, p.model), 5, p.model === 'prem' ? pk : cy, th['ink-950']);
            });
            P.tag(0.08, 3.2, 'uniform: g ∝ r', cy, 'left', 0);
            P.tag(0.56, 10.9, 'PREM: peaks at the core', pk, 'left', 0);
            P.tag(1.55, 10.2, 'g(1 − 2h/R) — only for h ≪ R', am, 'left', 0);
            P.tag(1.9, 2.4, 'outside: GM/r²', th['text-2'], 'left', 0);
            return;
          }
          const cv = S.cv, Gm = cv.Gm, rec = cv.rec;
          const t0 = rec.length ? rec[0][0] : 0, t1 = Math.max(cv.t, t0 + Gm.T0 * 2);
          const ys = rec.map(q => q[1] * 100);
          const m = Math.max(4, ...ys.map(Math.abs)) * 1.2;
          const P = g.Plot({ xmin: t0 / 60, xmax: t1 / 60, ymin: -m, ymax: m, xlabel: 'time (min)', ylabel: 'spot (cm)',
            xfmt: v => v.toFixed(0), yfmt: v => v.toFixed(0) }).frame();
          P.clip(() => {
            P.line([[t0 / 60, 0], [t1 / 60, 0]], g.alpha(th['text-3'], .5), 1);
            let seg = [], last = null;
            const flush = () => { if (seg.length > 1) P.line(seg, last === 'I' ? gr : last === 'II' ? pk : '#9AA8C0', 2); };
            rec.forEach(q => { if (q[2] !== last) { flush(); seg = seg.length ? [seg[seg.length - 1]] : []; last = q[2]; } seg.push([q[0] / 60, q[1] * 100]); });
            flush();
            cv.tp.forEach(q => P.dot(q[0] / 60, q[1] * 100, 3.5, am, th['ink-950']));
            [['I', gr], ['II', pk]].forEach(([k, c]) => { const r = cv.rest[k]; if (r) P.hline(r.S * 100, g.alpha(c, .8), [4, 3]); });
          });
          if (cv.rest.I) P.tag(t0 / 60, cv.rest.I.S * 100, 'rest point I', gr, 'left', -9);
          if (cv.rest.II) P.tag(t0 / 60, cv.rest.II.S * 100, 'rest point II', pk, 'left', 10);
        },
        hover(S, x) {
          const p = S.p;
          if (p.mode === 'orbit') {
            const O = S.O, t = O.end === 'closed' ? x * O.T : O.drag ? x * O.Tloc0 : x * 60, q = orbitAt(O, t);
            const r = Math.hypot(q[1], q[2]), v = Math.hypot(q[3], q[4]);
            return [{ label: 't', value: tfmt(t) }, { label: 'altitude', value: km(r - O.R) + ' km' },
                    { label: 'speed', value: (v / 1e3).toFixed(3) + ' km/s', color: '#7CF0B0' },
                    { label: 'E per kg', value: ((v * v / 2 - O.GM / r) / 1e6).toFixed(4) + ' MJ/kg' }];
          }
          if (p.mode === 'inside') return [{ label: 'r/R', value: x.toFixed(3) },
            { label: 'g uniform', value: gInside(Math.max(1, x * RE), 'uniform').toFixed(3), color: '#3DD6F5' },
            { label: 'g PREM', value: gInside(Math.max(1, x * RE), 'prem').toFixed(3), color: '#FF8FB0' }];
          return null;
        } },
      { title: S => ({ orbit: 'Kepler\'s third law — every moon and satellite, and yours',
                       field: 'Where g vanishes, for every mass ratio',
                       solar: 'Speed round the orbit — fastest at perihelion',
                       shapes: 'Potential along the axis — summed and from the formula',
                       binary: 'Kepler III for a pair — the period fixes the total mass',
                       inside: 'Tunnel transit time against its offset from the centre',
                       cavendish: 'The inverse square, read from the balance' })[S.p.mode],
        draw(S, g) {
          const p = S.p, th = g.theme, cy = '#3DD6F5', pk = '#FF8FB0', am = '#F5B451';
          if (p.mode === 'orbit') {
            const O = S.O, Pl = O.P;
            const aMax = Math.max(...Pl.sats.map(s => s[1]), O.end === 'closed' ? O.aM : 0) * 2;
            const xmin = LG(Pl.R / 1e3) - 0.05, xmax = LG(aMax / 1e3);
            const Tof = (GM, a) => TAU * Math.sqrt(a * a * a / GM) / 3600;
            const ymin = LG(Tof(Pl.GM, Pl.R)) - 0.3, ymax = LG(Tof(Pl.GM, aMax)) + 0.3;
            const P = g.Plot({ xmin, xmax, ymin, ymax, xlabel: 'semi-major axis a (km, log)', ylabel: 'period T (h, log)',
              xfmt: v => Math.pow(10, v) >= 1e5 ? Math.pow(10, v).toExponential(0) : Math.pow(10, v).toFixed(0),
              yfmt: v => { const h = Math.pow(10, v); return h < 1 ? h.toFixed(2) : h < 100 ? h.toFixed(1) : h.toFixed(0); } }).frame();
            P.clip(() => {
              Object.keys(PLANETS).forEach(id => {
                const Q = PLANETS[id], pts = [];
                for (let x = xmin; x <= xmax + 1e-9; x += (xmax - xmin) / 60) pts.push([x, LG(Tof(Q.GM, Math.pow(10, x) * 1e3))]);
                P.line(pts, id === p.body ? cy : g.alpha(th['text-3'], .45), id === p.body ? 2 : 1, id === p.body ? null : [4, 4]);
              });
              Pl.sats.forEach(s => P.dot(LG(s[1] / 1e3), LG(s[2] / 3600), 3.5, am, th['ink-950']));
              if (O.end === 'closed') P.dot(LG(O.aM / 1e3), LG(O.T / 3600), 5.5, '#7CF0B0', th['ink-950']);
            });
            Pl.sats.forEach(s => P.tag(LG(s[1] / 1e3), LG(s[2] / 3600), s[0], am, 'left', -10));
            if (O.end === 'closed') P.tag(LG(O.aM / 1e3), LG(O.T / 3600), 'your orbit, timed', '#7CF0B0', 'left', 12);
            P.tag(xmin + 0.05, ymax - 0.15, 'slope 3/2 for every planet · the height is set by GM', th['text-2'], 'left', 0);
            return;
          }
          if (p.mode === 'shapes') {
            const Sh = S.Sh, fl = [];
            for (let s = -3; s <= 3.0001; s += 0.01) fl.push([s, shapeFormula(p, s).V]);
            const lo = Math.min(...fl.map(q => q[1]), ...Sh.line.map(l => l[2])) * 1.1;
            const P = g.Plot({ xmin: -3, xmax: 3, ymin: lo, ymax: 0, xlabel: 'position along the axis (R)', ylabel: 'V (GM/R)', xfmt: v => v.toFixed(1), yfmt: v => v.toFixed(2) }).frame();
            P.clip(() => {
              P.line(fl, g.alpha(am, .9), 1.6, [5, 3]);
              Sh.line.forEach((q, i) => { if (i % 3 === 0) P.dot(q[0], q[2], 2.2, cy); });
              P.dot(p.pr, S.Sh.qp[3], 5, pk, th['ink-950']);
            });
            P.tag(-2.9, lo * 0.08, 'g = −dV/dx: where V is flat, g is zero', th['text-2'], 'left', 0);
            return;
          }
          if (p.mode === 'solar') {
            const b = runSolar().find(x => x.id === p.focus), sp = [], gr = '#7CF0B0', pk = '#FF8FB0';
            const n = 300;
            for (let i = 0; i <= n; i++) { const z = b.pts[Math.min(b.pts.length - 1, Math.round(i / n * (b.pts.length - 1)))]; sp.push([z[0] / b.T, Math.hypot(z[3], z[4]) / 1e3]); }
            const tt = (((S.yrs * YR + b.t0) % b.T) + b.T) % b.T, qn = solarAt(b, S.yrs * YR);
            const P = g.Plot({ xmin: 0, xmax: 1, ymin: 0, ymax: b.vMax / 1e3 * 1.15, xlabel: 'time since perihelion ÷ period', ylabel: 'speed (km/s)', xfmt: v => v.toFixed(1), yfmt: v => v.toFixed(0) }).frame();
            P.clip(() => { P.line(sp, b.col, 2.2); P.dot(tt / b.T, Math.hypot(qn[3], qn[4]) / 1e3, 5.5, '#FFFFFF', th['ink-950']); });
            P.tag(0.02, b.vMax / 1e3, 'perihelion ' + (b.vMax / 1e3).toFixed(1), gr, 'left', -8);
            P.tag(0.5, b.vMin / 1e3, 'aphelion ' + (b.vMin / 1e3).toFixed(1), pk, 'center', -8);
            return;
          }
          if (p.mode === 'field') {
            const pts = [];
            for (let lq = -3; lq <= 0.0001; lq += 0.02) pts.push([lq, 1 / (1 + Math.sqrt(Math.pow(10, lq)))]);
            const P = g.Plot({ xmin: -3, xmax: 0, ymin: 0.45, ymax: 1.0, xlabel: 'M₂ ÷ M₁ (log)', ylabel: 'neutral point ÷ d',
              xfmt: v => Math.pow(10, v) < 0.1 ? '1/' + (1 / Math.pow(10, v)).toFixed(0) : Math.pow(10, v).toFixed(1), yfmt: v => v.toFixed(2) }).frame();
            P.clip(() => { P.line(pts, cy, 2.2); P.dot(p.flogq, S.Fd.xN / S.Fd.d, 5.5, '#7CF0B0', th['ink-950']); });
            P.tag(LG(1 / 81.3), 0.9, 'Earth–Moon: 0.90 d', am, 'left', -10);
            P.tag(-0.05, 0.5, 'equal masses: halfway', th['text-2'], 'right', -8);
            return;
          }
          if (p.mode === 'binary') {
            const B = S.B, xmin = -1, xmax = 1.2, ymin = -2.2, ymax = 2.2;
            const P = g.Plot({ xmin, xmax, ymin, ymax, xlabel: 'a (AU, log)', ylabel: 'T (yr, log)',
              xfmt: v => Math.pow(10, v).toFixed(v < 0 ? 1 : 0), yfmt: v => { const y = Math.pow(10, v); return y < 1 ? y.toFixed(2) : y.toFixed(0); } }).frame();
            P.clip(() => {
              [0.5, 1, 3, 10, 20].forEach(Mt => {
                const pts = [[xmin, 1.5 * xmin - 0.5 * LG(Mt)], [xmax, 1.5 * xmax - 0.5 * LG(Mt)]];
                P.line(pts, g.alpha(th['text-3'], .5), 1, [4, 4]);
              });
              const Mt = p.M1 + p.M2;
              P.line([[xmin, 1.5 * xmin - 0.5 * LG(Mt)], [xmax, 1.5 * xmax - 0.5 * LG(Mt)]], cy, 2);
              P.dot(LG(p.aAU), LG(B.T / YR), 5.5, '#7CF0B0', th['ink-950']);
            });
            [0.5, 1, 3, 10, 20].forEach(Mt => P.tag(xmax - 0.02, 1.5 * (xmax - 0.02) - 0.5 * LG(Mt), Mt + ' M☉', th['text-3'], 'right', 0));
            P.tag(LG(p.aAU), LG(B.T / YR), 'this pair, timed', '#7CF0B0', 'left', 12);
            return;
          }
          if (p.mode === 'inside') {
            const u = transitCurve('uniform'), pr = transitCurve('prem');
            const P = g.Plot({ xmin: 0, xmax: 6000, ymin: 30, ymax: 46, xlabel: 'tunnel offset d (km)', ylabel: 'one way (min)',
              xfmt: v => v.toFixed(0), yfmt: v => v.toFixed(0) }).frame();
            P.clip(() => {
              P.line(u, cy, 2.2); P.line(pr, pk, 2.2);
              P.dot(p.dkm, S.Tn.tHalf / 60, 5.5, p.model === 'prem' ? pk : cy, th['ink-950']);
            });
            P.tag(300, 43.3, 'uniform: 42.2 min for EVERY chord', cy, 'left', 0);
            P.tag(300, 36.8, 'real Earth: faster through the core', pk, 'left', 0);
            return;
          }
          const C = cavCurve(p), Gm = S.cv.Gm;
          const ys = C.out.concat(C.near).map(q => q[1]);
          const P = g.Plot({ xmin: LG(C.bMin), xmax: LG(400), ymin: Math.min(...ys) - 0.1, ymax: Math.max(...ys) + 0.15,
            xlabel: 'separation b (mm, log)', ylabel: 'rest shift (cm, log)',
            xfmt: v => Math.pow(10, v).toFixed(0), yfmt: v => { const y = Math.pow(10, v); return y < 1 ? y.toFixed(2) : y.toFixed(1); } }).frame();
          P.clip(() => {
            P.line(C.near, g.alpha(th['text-2'], .8), 1.4, [5, 4]);
            P.line(C.out, am, 2.2);
            const t = cavRest(Gm, swivelAngle(Gm, 'I'));
            P.dot(LG(Gm.b * 1000), LG(Math.abs(spotOf(Gm, t)) * 100), 5.5, '#7CF0B0', th['ink-950']);
          });
          P.tag(LG(C.bMin) + 0.05, Math.max(...ys) + 0.02, 'slope −2: the inverse square', th['text-2'], 'left', 0);
          P.tag(LG(120), C.out[Math.floor(C.out.length * 0.6)][1] - 0.2, 'all four pairs: the far spheres bend it', am, 'left', 0);
        } }
    ],

    readouts(S) {
      const p = S.p;
      if (p.mode === 'orbit') {
        const O = S.O, out = [
          { label: 'Launch speed', value: (O.v0 / 1e3).toFixed(3), unit: 'km/s', flag: 'accent' },
          { label: 'Circular speed √(GM/r)', value: (O.vc / 1e3).toFixed(3), unit: 'km/s' },
          { label: 'Escape speed √(2GM/r)', value: (O.ve / 1e3).toFixed(3), unit: 'km/s', hint: 'any direction' },
          { label: 'Energy per kg ½v² − GM/r', value: (O.eps0 / 1e6).toFixed(3), unit: 'MJ/kg', flag: O.eps0 < 0 ? 'ok' : 'warn', hint: O.eps0 < 0 ? 'bound' : 'unbound' }];
        if (O.end === 'closed') out.push(
          { label: 'Period, timed', value: (O.T / 60).toFixed(2), unit: 'min', flag: 'accent' },
          { label: 'Semi-major axis, measured', value: km(O.aM), unit: 'km', hint: 'depends only on the energy' },
          { label: 'Eccentricity (r_max − r_min)/(r_max + r_min)', value: O.eM.toFixed(4), unit: '' },
          { label: 'Perigee · apogee altitude', value: km(O.rMin - O.R) + ' · ' + km(O.rMax - O.R), unit: 'km' },
          { label: 'Sweep rate ½|r × v|', value: (O.H0 / 2 / 1e9).toFixed(4), unit: 'km²/s', hint: 'constant: Kepler II' });
        else out.push({ label: 'Outcome', value: O.end === 'escape' ? 'escapes' : O.end === 'reentry' ? 're-entry' : 'hits ground', unit: '',
                        flag: O.end === 'escape' ? 'warn' : 'crit' },
                      { label: 'Time to that', value: tfmt(O.tEnd), unit: '' });
        return out;
      }
      if (p.mode === 'shapes') {
        const Sh = S.Sh;
        return [
          { label: 'g at the probe (sum)', value: Sh.qp[Sh.ax].toFixed(4), unit: 'GM/R²', flag: 'accent', hint: 'component along the axis' },
          { label: 'g at the probe (formula)', value: Sh.fp.g.toFixed(4), unit: 'GM/R²' },
          { label: 'V at the probe (sum)', value: Sh.qp[3].toFixed(4), unit: 'GM/R' },
          { label: 'V at the probe (formula)', value: Sh.fp.V.toFixed(4), unit: 'GM/R' },
          { label: 'Point masses summed', value: Sh.n.toLocaleString('en-US'), unit: '', hint: 'mass ' + Sh.mass.toFixed(3) + ' M' }
        ];
      }
      if (p.mode === 'solar') {
        const b = runSolar().find(x => x.id === p.focus);
        return [
          { label: 'Period, timed', value: (b.T / YR).toFixed(4), unit: 'yr', flag: 'accent' },
          { label: 'a^1.5 (a in AU)', value: Math.pow(b.aM, 1.5).toFixed(4), unit: 'yr', hint: 'Kepler III in years and AU' },
          { label: 'Semi-major axis', value: b.aM.toFixed(4), unit: 'AU' },
          { label: 'Eccentricity', value: b.eM.toFixed(4), unit: '' },
          { label: 'v_peri ÷ v_aph', value: (b.vMax / b.vMin).toFixed(3), unit: '', hint: '= r_aph ÷ r_peri: Kepler II' },
          { label: 'Inclination', value: b.iD.toFixed(2), unit: '°' }
        ];
      }
      if (p.mode === 'field') {
        const Fd = S.Fd;
        return [
          { label: 'Neutral point from body 1', value: (Fd.xN / Fd.d).toFixed(4), unit: '× d', flag: 'accent', hint: km(Fd.xN) + ' km' },
          { label: 'V at the neutral point', value: (Fd.VN / 1e6).toFixed(3), unit: 'MJ/kg' },
          { label: 'V on the launch surface', value: (Fd.Vs / 1e6).toFixed(3), unit: 'MJ/kg' },
          { label: 'Least speed to reach body 2', value: (Fd.vMin / 1e3).toFixed(3), unit: 'km/s', flag: 'ok' },
          { label: 'Escape speed', value: (Fd.vEsc / 1e3).toFixed(3), unit: 'km/s' },
          { label: 'Probe', value: { moon: 'arrives', back: 'falls back', escape: 'escapes', run: '—' }[Fd.end], unit: '',
            flag: Fd.end === 'moon' ? 'ok' : Fd.end === 'back' ? 'crit' : 'warn', hint: 'after ' + tfmt(Fd.tEnd) }
        ];
      }
      if (p.mode === 'binary') {
        const B = S.B;
        return [
          { label: 'Period, timed', value: tfmt(B.T), unit: '', flag: 'accent' },
          { label: 'Kepler 2π√(a³/G(M₁+M₂))', value: tfmt(B.Tk), unit: '' },
          { label: 'M₁ from the centre of mass', value: (B.f1 * p.aAU).toFixed(4), unit: 'AU', hint: 'a·M₂/(M₁+M₂)' },
          { label: 'M₂ from the centre of mass', value: (B.f2 * p.aAU).toFixed(4), unit: 'AU', hint: 'a·M₁/(M₁+M₂)' },
          { label: 'Top speed M₁ · M₂', value: (B.v1max / 1e3).toFixed(2) + ' · ' + (B.v2max / 1e3).toFixed(2), unit: 'km/s' },
          { label: 'Reduced mass μ = M₁M₂/(M₁+M₂)', value: (B.m1 * B.m2 / B.M / MSUN).toFixed(4), unit: 'M☉' }
        ];
      }
      if (p.mode === 'inside') {
        const Tn = S.Tn, g0 = gInside(RE, p.model);
        return [
          { label: 'One way through the tunnel', value: (Tn.tHalf / 60).toFixed(2), unit: 'min', flag: 'accent' },
          { label: 'Uniform-Earth π√(R/g)', value: (Math.PI * Math.sqrt(RE / gInside(RE, 'uniform')) / 60).toFixed(2), unit: 'min', hint: 'independent of d' },
          { label: 'Top speed (at mid-tunnel)', value: (Tn.vmax / 1e3).toFixed(3), unit: 'km/s' },
          { label: 'g at the probe', value: gInside(p.probe * RE, p.model).toFixed(3), unit: 'm/s²' },
          { label: 'g at the surface', value: g0.toFixed(3), unit: 'm/s²' },
          { label: 'Peak g (and where)', value: p.model === 'prem' ? '10.69 at 3480 km' : g0.toFixed(2) + ' at the surface', unit: '' },
          { label: 'Centrifugal ω²R at the equator', value: (Math.pow(TAU / (p.dayH * 3600), 2) * RE).toFixed(4), unit: 'm/s²',
            flag: Math.pow(TAU / (p.dayH * 3600), 2) * RE > g0 ? 'crit' : undefined }
        ];
      }
      const cv = S.cv, Gm = cv.Gm, pr = S.proto;
      return [
        { label: 'Torsion constant κ = I(2π/T₀)²', value: (Gm.kappa * 1e9).toFixed(3), unit: 'nN·m/rad' },
        { label: 'Pull on each small sphere GMm/b²', value: (GRAV * Gm.M * Gm.m / (Gm.b * Gm.b) * 1e9).toFixed(3), unit: 'nN', hint: 'about a tenth of a microgram-weight' },
        { label: 'Rod angle now', value: (cv.st[0] * 1e3).toFixed(3), unit: 'mrad', flag: 'accent' },
        { label: 'Spot now, L·tan 2θ', value: (spotOf(Gm, cv.st[0]) * 100).toFixed(2), unit: 'cm' },
        { label: 'Full protocol: ΔS', value: (pr.dS * 100).toFixed(2), unit: 'cm' },
        { label: 'Full protocol: G (textbook formula)', value: (pr.Gnaive * 1e11).toFixed(3), unit: '× 10⁻¹¹', flag: 'warn', hint: 'low — the far spheres' },
        { label: 'Full protocol: G ÷ (1 − β)(1 − ζ²)', value: (pr.Gcorr * 1e11).toFixed(3), unit: '× 10⁻¹¹', flag: 'ok', hint: 'accepted 6.674' }
      ];
    },

    equation(S) {
      const p = S.p;
      if (p.mode === 'orbit') {
        const O = S.O;
        return E.v('T') + ' ' + E.op('=') + ' 2π' + '√(' + E.v('a') + '³/' + E.v('GM') + ') ' + E.op('=') + ' ' +
          (O.end === 'closed' ? E.n(O.Tk / 60, 'min') + ' · timed ' + E.n(O.T / 60, 'min') : 'no closed orbit') +
          '<br>' + E.v('E') + ' ' + E.op('=') + ' ½' + E.v('v') + '² ' + E.op('−') + ' ' + E.frac(E.v('GM'), E.v('r')) + ' ' + E.op('=') + ' ' +
          E.op('−') + E.frac(E.v('GM'), '2' + E.v('a')) + ' ' + E.op('=') + ' ' + E.n(O.eps0 / 1e6, 'MJ/kg') +
          ' → ' + (O.eps0 < 0 ? 'bound' : 'escapes');
      }
      if (p.mode === 'shapes') {
        const f = { ring: E.v('g') + ' ' + E.op('=') + ' ' + E.frac(E.v('GMx'), '(' + E.v('R') + '² ' + E.op('+') + ' ' + E.v('x') + '²)^{3/2}') + ' · max at ' + E.v('x') + ' ' + E.op('=') + ' ' + E.v('R') + '/√2',
          disc: E.v('g') + ' ' + E.op('=') + ' ' + E.frac('2' + E.v('GM'), E.v('R') + '²') + '(1 ' + E.op('−') + ' ' + E.frac(E.v('x'), '√(' + E.v('x') + '² ' + E.op('+') + ' ' + E.v('R') + '²)') + ')',
          shell: E.v('g') + ' ' + E.op('=') + ' 0 inside, ' + E.frac(E.v('GM'), E.v('r') + '²') + ' outside · ' + E.v('V') + ' ' + E.op('=') + ' ' + E.op('−') + E.frac(E.v('GM'), E.v('R')) + ' inside',
          sphere: E.v('g') + ' ' + E.op('=') + ' ' + E.frac(E.v('GMr'), E.v('R') + '³') + ' inside · ' + E.v('V') + ' ' + E.op('=') + ' ' + E.op('−') + E.frac(E.v('GM') + '(3' + E.v('R') + '² ' + E.op('−') + ' ' + E.v('r') + '²)', '2' + E.v('R') + '³'),
          cavity: E.v('g') + E.sub('cavity') + ' ' + E.op('=') + ' ' + E.frac('4', '3') + 'π' + E.v('G') + 'ρ ' + E.v('d') + ' — the same everywhere inside, pointing along d',
          poly: E.v('g') + ' ' + E.op('=') + ' 0 at the centre · ' + E.v('U') + ' ' + E.op('=') + ' ' + E.op('−') + 'Σ' + E.frac(E.v('Gm') + '²', E.v('r') + E.sub('ij')) + ' over pairs' }[p.shape];
        return f + '<br>at the probe: sum ' + E.n(S.Sh.qp[S.Sh.ax], 'GM/R²') + ' · formula ' + E.n(S.Sh.fp.g, 'GM/R²');
      }
      if (p.mode === 'solar') {
        const b = runSolar().find(x => x.id === p.focus);
        return E.frac(E.v('T') + '²', E.v('a') + '³') + ' ' + E.op('=') + ' ' + E.frac('4π²', E.v('GM') + '☉') + ' → ' + E.v('T') + E.sub('yr') + ' ' + E.op('=') + ' ' + E.v('a') + E.sub('AU') + '^1.5 ' + E.op('=') + ' ' + E.n(Math.pow(b.aM, 1.5), 'yr') +
          ' · timed ' + E.n(b.T / YR, 'yr') + '<br>' + E.frac(E.v('v') + E.sub('p'), E.v('v') + E.sub('a')) + ' ' + E.op('=') + ' ' + E.frac('1 ' + E.op('+') + ' ' + E.v('e'), '1 ' + E.op('−') + ' ' + E.v('e')) + ' ' + E.op('=') + ' ' + E.n((1 + b.eM) / (1 - b.eM), '');
      }
      if (p.mode === 'field') {
        const Fd = S.Fd;
        return E.v('g') + ' ' + E.op('=') + ' 0 where ' + E.frac(E.v('GM') + '₁', E.v('x') + '²') + ' ' + E.op('=') + ' ' + E.frac(E.v('GM') + '₂', '(' + E.v('d') + E.op('−') + E.v('x') + ')²') +
          ' → ' + E.v('x') + ' ' + E.op('=') + ' ' + E.frac(E.v('d'), '1 ' + E.op('+') + ' √(' + E.v('M') + '₂/' + E.v('M') + '₁)') + ' ' + E.op('=') + ' ' + E.n(Fd.xN / Fd.d, '× d') +
          '<br>' + E.v('v') + E.sub('min') + ' ' + E.op('=') + ' √(2(' + E.v('V') + E.sub('N') + ' ' + E.op('−') + ' ' + E.v('V') + E.sub('surface') + ')) ' + E.op('=') + ' ' + E.n(Fd.vMin / 1e3, 'km/s');
      }
      if (p.mode === 'binary') {
        const B = S.B;
        return E.v('T') + ' ' + E.op('=') + ' 2π√(' + E.frac(E.v('a') + '³', E.v('G') + '(' + E.v('M') + '₁' + E.op('+') + E.v('M') + '₂)') + ') ' +
          E.op('=') + ' ' + E.n(B.Tk / YR, 'yr') + '<br>' + E.v('r') + '₁ ' + E.op(':') + ' ' + E.v('r') + '₂ ' + E.op('=') + ' ' +
          E.v('M') + '₂ ' + E.op(':') + ' ' + E.v('M') + '₁ ' + E.op('=') + ' ' + E.n(p.M2 / p.M1, '');
      }
      if (p.mode === 'inside') {
        return E.v('g') + '(' + E.v('r') + ') ' + E.op('=') + ' ' + E.frac(E.v('G') + E.v('m') + '(' + E.v('r') + ')', E.v('r') + '²') +
          ' · uniform: ' + E.v('g') + E.sub('s') + E.frac(E.v('r'), E.v('R')) + '<br>' + E.v('s̈') + ' ' + E.op('=') + ' ' + E.op('−') +
          E.frac(E.v('g'), E.v('R')) + E.v('s') + ' → ' + E.v('T') + ' ' + E.op('=') + ' 2π√(' + E.v('R') + '/' + E.v('g') + ') ' + E.op('=') + ' ' +
          E.n(TAU * Math.sqrt(RE / gInside(RE, 'uniform')) / 60, 'min') + ' for any chord';
      }
      const Gm = S.cv.Gm, pr = S.proto;
      return E.v('G') + ' ' + E.op('=') + ' ' + E.frac('π²' + E.v('b') + '²' + E.v('d') + ' Δ' + E.v('S'), E.v('M') + E.v('T') + '²' + E.v('L')) + ' ' +
        E.op('=') + ' ' + E.frac('π² (' + (Gm.b * 1000).toFixed(1) + ' mm)² (' + (Gm.d * 1000).toFixed(0) + ' mm) (' + (pr.dS * 100).toFixed(2) + ' cm)',
          '(' + Gm.M.toFixed(2) + ' kg)(' + pr.Tm.toFixed(0) + ' s)²(' + Gm.Lm.toFixed(2) + ' m)') + ' ' + E.op('=') + ' ' + E.n(pr.Gnaive * 1e11, '× 10⁻¹¹');
    },

    eqNote: '<b>Two quantities decide an orbit, and they are not the ones students reach for.</b> The <b>energy</b> sets the ' +
      'size: E = −GM/2a, so every launch at the same speed from the same height has the same a and the same period, whatever ' +
      'direction it was aimed. The <b>angular momentum</b> sets the shape. That is why escape speed does not depend on direction. ' +
      'Inside the Earth, g ∝ r holds only if the density is uniform. The real Earth is four times denser at the centre than ' +
      'at the crust, and g rises to 10.7 m/s² at the core boundary. On the balance, the textbook formula keeps only the near ' +
      'pair of spheres. The far pair pulls the other way and costs about 7.5%. The period you time is also the damped one, ' +
      'slightly longer than the fibre\'s own. Both corrections come from your own record: β from the geometry, ζ from how fast the ' +
      'swings shrink. With both applied, the balance returns G to within a few tenths of a per cent.',

    problems: [
      { source: 'JEE Main pattern · field on the axis of a ring',
        q: 'A ring of mass M and radius R. At what distance from its centre, along the axis, is the gravitational field strongest? Answer in units of R.',
        params: { mode: 'shapes', shape: 'ring', pr: 0.707 },
        predict: { label: 'distance', unit: 'R', tol: 0.02 },
        measure: S => S.Sh.smax,
        working: 'g = GMx/(R² + x²)^{3/2}. Setting dg/dx = 0 gives (R² + x²) = 3x², so x = R/√2 = <b>0.707 R</b>, where g = 2GM/3√3R². The lab sums 720 point masses along the axis and finds the same peak.' },
      { source: 'JEE Advanced pattern · a cavity in a sphere',
        q: 'A uniform sphere of mass M (before hollowing) and radius R has a spherical cavity whose centre is R/2 from the sphere\'s centre. Find the field at the centre of the cavity, in units of GM/R².',
        params: { mode: 'shapes', shape: 'cavity', cd: 0.5, cr: 0.4, pr: 0.5 },
        predict: { label: 'field', unit: 'GM/R²', tol: 0.03 },
        measure: S => { const c = sumAt(S.Sh.P, S.p.cd, 0, 0); return Math.hypot(c[0], c[1], c[2]); },
        working: 'Superpose the full sphere (field −(4/3)πGρ r at any inside point r) and a sphere of negative mass filling the cavity (field +(4/3)πGρ (r − d)). Their sum is −(4/3)πGρ d: the same at every point of the cavity. With ρ = 3M/4πR³ it is GMd/R³ = <b>0.5 GM/R²</b>. The sum over about 8000 points gives it everywhere in the cavity to within a few per cent.' },
      { source: 'JEE Main pattern · a system of four masses',
        q: 'Four equal masses m sit at the corners of a square of side a. What is the gravitational potential energy of the system, in units of Gm²/a?',
        params: { mode: 'shapes', shape: 'poly', npoly: 4, pr: 0.6 },
        predict: { label: 'U', unit: 'Gm²/a', tol: 0.01 },
        measure: S => S.Sh.Usys / (Math.pow(1 / S.p.npoly, 2) / (2 * Math.sin(Math.PI / S.p.npoly))),
        working: 'Six pairs: four sides of length a and two diagonals of a√2. U = −Gm²(4/a + 2/(a√2)) = −(4 + √2) Gm²/a = <b>−5.41 Gm²/a</b>. The work needed to pull them apart to infinity is +5.41 Gm²/a. The field at the centre is zero, but the potential there is not.' },
      { source: 'JEE Main pattern · a fall from a great height',
        q: 'A body is released from rest at a height equal to the Earth\'s radius (6371 km). With what speed does it hit the ground, in km/s? (Ignore air.)',
        params: { mode: 'orbit', incO: 0, argP: 0, mission: 'free', body: 'earth', logH: LG(6371), vr: 0, gam: 0, drag: false, spin: false, sectors: false },
        predict: { label: 'speed', unit: 'km/s', tol: 0.01 },
        measure: S => { const q = S.O.pts[S.O.pts.length - 1]; return Math.hypot(q[3], q[4]) / 1e3; },
        working: 'Energy, not √(2gh): ½v² = GM/R − GM/2R, so v = √(GM/R) = <b>7.91 km/s</b>. √(2gh) would give 11.2 km/s, because it pretends g stays at 9.8 m/s² all the way up. The integration shows g weakening with height.' },
      { source: 'NEET pattern · Kepler\'s third law',
        q: 'Mars orbits the Sun with semi-major axis 1.524 AU. Find its period in years.',
        params: { mode: 'solar', focus: 'mars', zoomAU: LG(2), yps: 0.3, sectors: true },
        predict: { label: 'period', unit: 'yr', tol: 0.01 },
        measure: S => runSolar().find(b => b.id === 'mars').T / YR,
        working: 'In years and AU, T² = a³ for anything orbiting the Sun: T = 1.524^1.5 = <b>1.881 yr</b>. The lab integrates Mars round one full turn and times it; ' +
          'the plot puts all ten bodies on one line of slope 3/2.' },
      { source: 'JEE Advanced pattern · a comet at both ends',
        q: 'Halley\'s comet has eccentricity 0.967. How many times faster is it at perihelion than at aphelion?',
        params: { mode: 'solar', focus: 'halley', zoomAU: LG(22), yps: 5, sectors: true },
        predict: { label: 'ratio', unit: '×', tol: 0.02 },
        measure: S => { const b = runSolar().find(x => x.id === 'halley'); return b.vMax / b.vMin; },
        working: 'Angular momentum is conserved and at the two ends the velocity is perpendicular to r, so v_p r_p = v_a r_a: v_p/v_a = r_a/r_p = (1 + e)/(1 − e) = 1.967/0.033 = <b>about 60</b>. ' +
          'It crosses the inner solar system in months and spends decades crawling beyond Neptune.' },
      { source: 'JEE Advanced pattern · Hohmann transfer',
        q: 'A satellite in a circular orbit 300 km up fires its engine once to reach geostationary height (35 786 km) at the far side. How long is the coast between the two burns, in hours?',
        params: { mode: 'orbit', incO: 0, argP: 0, mission: 'hohmann', body: 'earth', logH: LG(300), vr: 1, gam: 0, drag: false, spin: false, sectors: false, logH2: LG(35786), autoB: true, dv: 2400, bdir: 'pro' },
        predict: { label: 'coast time', unit: 'h', tol: 0.01 },
        measure: S => S.M.burns.length ? S.O.T / 2 / 3600 : NaN,
        working: 'The transfer ellipse touches both orbits, so a = (6671 + 42 157)/2 = 24 414 km. The coast is half its period: ' +
          'π√(a³/GM) = π√((2.4414 × 10⁷)³ / 3.986 × 10¹⁴) = <b>5.27 h</b>. The burns are Δv₁ = 2.43 km/s and Δv₂ = 1.47 km/s. The autopilot ' +
          'fires them, and the second lands it in an orbit with e = 0.0001.' },
      { source: 'JEE Main pattern · the neutral point',
        q: 'The Moon has 1/81 of the Earth\'s mass and is 60 Earth radii away. How far from the Earth\'s centre is the gravitational field zero, in Earth radii?',
        params: { mode: 'field', flogq: LG(1 / 81), fdR: 60, fshell: false, fv: 11.0, fang: 0 },
        predict: { label: 'distance', unit: 'R', tol: 0.01 },
        measure: S => S.Fd.xN / RE,
        working: 'GM/x² = G(M/81)/(60R − x)², so 60R − x = x/9 and x = <b>54.0 R</b>: nine-tenths of the way. On the landscape it is the saddle, the top of the hill between the two wells.' },
      { source: 'JEE Advanced pattern · the least speed to reach the Moon',
        q: 'Ignoring the Moon\'s motion and the Earth\'s spin, what is the least speed, launched from the Earth\'s surface toward the Moon, that gets a probe there? (M_moon = M/81.3, d = 60.3 R)',
        params: { mode: 'field', flogq: LG(1 / 81.3), fdR: 60.3, fshell: false, fv: 11.09, fang: 0 },
        predict: { label: 'least speed', unit: 'km/s', tol: 0.005 },
        measure: S => S.Fd.vMin / 1e3,
        working: 'It needs only to crest the neutral point; after that the Moon pulls it in. ½v² = V_N − V_surface = (−1.281) − (−62.583) = 61.30 MJ/kg, so ' +
          'v = <b>11.07 km/s</b>, just under the 11.19 km/s escape speed. Launch at 11.05 and it falls back; at 11.09 it arrives. Try it.' },
      { source: 'NEET pattern · a low circular orbit',
        q: 'The International Space Station orbits 408 km above the Earth. Taking GM = 3.986 × 10¹⁴ m³/s² and R = 6371 km, find its period in minutes.',
        params: { mode: 'orbit', incO: 0, argP: 0, mission: 'free', body: 'earth', logH: LG(408), vr: 1, gam: 0, drag: false, spin: true, sectors: true },
        predict: { label: 'period', unit: 'min', tol: 0.01 },
        measure: S => S.O.T / 60,
        working: 'r = 6371 + 408 = 6779 km. T = 2π√(r³/GM) = 2π√((6.779 × 10⁶)³ / 3.986 × 10¹⁴) = 5555 s = <b>92.6 min</b>. ' +
          'The lab times it by watching the radius vector come round a full 2π. It agrees to six figures.' },
      { source: 'JEE Advanced pattern · launched too fast for a circle',
        q: 'A satellite is launched horizontally 400 km above the Earth at 1.20 times the circular speed there (9.207 km/s). How high does it rise, in km above the surface?',
        params: { mode: 'orbit', incO: 0, argP: 0, mission: 'free', body: 'earth', logH: LG(400), vr: 1.2, gam: 0, drag: false, spin: false, sectors: true },
        predict: { label: 'apogee height', unit: 'km', tol: 0.01 },
        measure: S => (S.O.rMax - S.O.R) / 1e3,
        working: 'Conserve angular momentum, r₁v₁ = r₂v₂, and energy, ½v₁² − GM/r₁ = ½v₂² − GM/r₂. Eliminating v₂ gives ' +
          'r₂ = r₁ · k² / (2 − k²) with k = v₁/v_c = 1.20. So r₂ = 6771 × 1.44 / 0.56 = 17 411 km from the centre, and the height ' +
          'is <b>11 040 km</b>. The launch point becomes the perigee.' },
      { source: 'JEE Advanced pattern · the right speed, the wrong direction',
        q: 'At 400 km the satellite is given exactly the circular speed, but aimed 20° above the horizontal. How far from the Earth\'s centre is the nearest point of its new orbit, in km? Does it survive?',
        params: { mode: 'orbit', incO: 0, argP: 0, mission: 'free', body: 'earth', logH: LG(400), vr: 1, gam: 20, drag: false, spin: false, sectors: false },
        predict: { label: 'perigee distance', unit: 'km', tol: 0.01 },
        measure: S => { const O = S.O; return O.a0 * (1 - Math.sqrt(Math.max(0, 1 - O.H0 * O.H0 / (O.GM * O.a0)))) / 1e3; },
        working: 'The speed and height are unchanged, so the energy and a are unchanged: a = 6771 km. The angular momentum falls by ' +
          'cos 20°, and e = √(1 − cos²20°) = sin 20° = 0.342. So r_min = a(1 − e) = 6771 × 0.658 = <b>4455 km</b>, which is ' +
          '1916 km <b>inside</b> the Earth. It comes down, which the run shows.' },
      { source: 'JEE Main pattern · beyond escape',
        q: 'From 400 km up, a probe is launched at 1.5 times the circular speed there (11.509 km/s). With what speed does it leave the Earth\'s influence, in km/s?',
        params: { mode: 'orbit', incO: 0, argP: 0, mission: 'free', body: 'earth', logH: LG(400), vr: 1.5, gam: 0, drag: false, spin: false, sectors: true },
        predict: { label: 'speed at infinity', unit: 'km/s', tol: 0.01 },
        measure: S => { const O = S.O, q = O.pts[O.pts.length - 1], r = Math.hypot(q[1], q[2]), v2 = q[3] * q[3] + q[4] * q[4];
                         return Math.sqrt(Math.max(0, v2 - 2 * O.GM / r)) / 1e3; },
        working: '½v∞² = ½v² − GM/r, so v∞ = √(v² − v_esc²). With v_esc = √2 × 7.673 = 10.851 km/s, v∞ = √(11.509² − 10.851²) ' +
          '= <b>3.836 km/s</b>. The lab reads the speed at the end of the run, when the probe is six launch radii out, and ' +
          'subtracts the escape speed there. It is not given the answer.' },
      { source: 'NEET pattern · geostationary orbit',
        q: 'A geostationary satellite sits 35 786 km above the equator. Find its orbital speed in km/s.',
        params: { mode: 'orbit', incO: 0, argP: 0, mission: 'free', body: 'earth', logH: LG(35786), vr: 1, gam: 0, drag: false, spin: true, sectors: false },
        predict: { label: 'speed', unit: 'km/s', tol: 0.01 },
        measure: S => Math.hypot(S.O.pts[S.O.pts.length >> 1][3], S.O.pts[S.O.pts.length >> 1][4]) / 1e3,
        working: 'v = √(GM/r) = √(3.986 × 10¹⁴ / 4.2157 × 10⁷) = <b>3.075 km/s</b>. Its period, timed by the lab, is 23 h 56 min: ' +
          'one sidereal day. Turn on the planet\'s spin and the red ground station stays under it.' },
      { source: 'JEE Main pattern · a binary star',
        q: 'Two stars of 2.0 and 1.0 solar masses orbit their common centre of mass with separation 1.00 AU. Find the period in years.',
        params: { mode: 'binary', M1: 2, M2: 1, aAU: 1, ecc: 0.3, incl: 70 },
        predict: { label: 'period', unit: 'yr', tol: 0.01 },
        measure: S => S.B.T / YR,
        working: 'For the Sun and Earth, 1 AU gives 1 year with M = 1 M☉. Here T = 2π√(a³/G(M₁+M₂)) = 1 yr × √(1/3) = ' +
          '<b>0.577 yr</b>. The total mass enters, not either star alone. The heavier star moves in an orbit half the size of the lighter one\'s, and both have the same period.' },
      { source: 'JEE Main pattern · a tunnel that is not through the centre',
        q: 'A straight smooth tunnel is dug through a uniform Earth, passing 3000 km from its centre. A ball is dropped in at one end. How long does it take to reach the other end, in minutes?',
        params: { mode: 'inside', model: 'uniform', dkm: 3000, probe: 0.5, lat: 30, dayH: 24 },
        predict: { label: 'one-way time', unit: 'min', tol: 0.01 },
        measure: S => S.Tn.tHalf / 60,
        working: 'Along the tunnel, the component of g is (g/R)·r·(s/r) = (g/R)s, so the motion is SHM with ω = √(g/R), whatever ' +
          'the offset. Half a period is π√(R/g) = π√(6.371 × 10⁶ / 9.82) = <b>42.2 min</b>. Only the top speed depends on d. ' +
          'Switch to the real Earth and the same trip is faster.' },
      { source: 'NEET pattern · g below the surface',
        q: 'Taking the Earth as uniform with g = 9.82 m/s² at the surface and R = 6371 km, find g at a depth of 1600 km.',
        params: { mode: 'inside', model: 'uniform', dkm: 0, probe: 4771 / 6371, lat: 30, dayH: 24 },
        predict: { label: 'g', unit: 'm/s²', tol: 0.01 },
        measure: S => gInside(S.p.probe * RE, S.p.model),
        working: 'g(d) = g(1 − d/R) = 9.82 × (1 − 1600/6371) = <b>7.35 m/s²</b>. Switch the model to PREM and the probe reads ' +
          '10.3 m/s² at the same depth: g is larger down there, not smaller.' },
      { source: 'JEE Advanced pattern · the Cavendish experiment',
        q: 'M = 1.50 kg, b = 46.5 mm, rod half-length d = 50 mm, period 10.0 min, mirror to scale 5.00 m. Using the textbook formula (near spheres only), predict how far the spot moves between positions I and II, in cm.',
        params: { mode: 'cavendish', from: 'away', pos: 'I', auto: false, MB: 1.5, mg: 15, bmm: 46.5, T0min: 10, zeta: 0.08, Lm: 5 },
        predict: { label: 'ΔS', unit: 'cm', tol: 0.07 },
        measure: S => S.proto.dS * 100,
        working: 'ΔS = GMT²L/(π²b²d) = 6.674 × 10⁻¹¹ × 1.5 × 600² × 5 / (π² × 0.0465² × 0.050) = <b>16.9 cm</b>. The balance ' +
          'shows about 15.9 cm. The far pair of spheres pulls back by β = 7.5%. Their field gradient also softens the fibre and ' +
          'lengthens T to about 608 s. Both effects are real, which is why the lab measures G low until corrected.' }
    ],

    walkthrough: [
      { title: '1 · A circle is a very particular launch',
        body: 'ISS, 408 km, launched horizontally at exactly √(GM/r). Watch the shaded sectors. Each is swept in the same time.',
        ask: 'Are the sectors the same shape? Are they the same area?',
        reveal: '<b>Same shape and same area</b>, because the speed never changes on a circle. The next step is where Kepler\'s second law actually says something.',
        params: { mode: 'orbit', incO: 0, argP: 0, mission: 'free', body: 'earth', logH: LG(408), vr: 1, gam: 0, drag: false, spin: true, sectors: true } },
      { title: '2 · Launch 20 % faster',
        body: 'Same height, 1.2 v_c. Now the sectors near perigee are short and fat, and the ones near apogee are long and thin.',
        ask: 'The radius is three times longer at apogee. How much slower is the satellite there?',
        reveal: '<b>Three times slower.</b> Equal areas means r × v⊥ is constant: that is angular momentum. The panel shows all twelve areas equal to better than one part in a million.',
        params: { mode: 'orbit', incO: 0, argP: 0, mission: 'free', body: 'earth', logH: LG(400), vr: 1.2, gam: 0, drag: false, spin: false, sectors: true } },
      { title: '3 · Same speed, aimed upward',
        body: 'Back to exactly v_c, but tilted 20° up. Nothing else changes.',
        ask: 'Is the new orbit bigger or smaller than the circle?',
        reveal: '<b>Neither.</b> The energy is the same, so the semi-major axis is the same, 6771 km. But it is now an ellipse with e = sin 20°, and its perigee is inside the Earth. Same a, same period, and it crashes.',
        params: { mode: 'orbit', incO: 0, argP: 0, mission: 'free', body: 'earth', logH: LG(400), vr: 1, gam: 20, drag: false, spin: false, sectors: false } },
      { title: '4 · Exactly √2 times faster',
        body: 'The energy per kilogram is now zero. Try other angles with the green ring.',
        ask: 'Does aiming it straight up make escape easier?',
        reveal: '<b>No.</b> Escape is a statement about energy, ½v² ≥ GM/r, and energy has no direction. Every angle escapes unless the path hits the ground first.',
        params: { mode: 'orbit', incO: 0, argP: 0, mission: 'free', body: 'earth', logH: LG(400), vr: Math.SQRT2, gam: 0, drag: false, spin: false, sectors: true } },
      { title: '5 · Friction that speeds you up',
        body: 'Low orbit through the thin top of the atmosphere. Read the energy plot.',
        ask: 'Drag removes energy. Does the satellite slow down?',
        reveal: '<b>It speeds up.</b> For a near-circular orbit KE = −E. When drag removes 1 J, the satellite drops lower, gains 1 J of kinetic energy and loses 2 J of potential. The drag force does negative work; gravity does twice as much positive work.',
        params: { mode: 'orbit', incO: 0, argP: 0, mission: 'free', body: 'earth', logH: LG(300), vr: 1, gam: 0, drag: true, dragX: 2, spin: false, sectors: false } },
      { title: '6 · Fire the engine yourself',
        body: 'A circular orbit at 400 km. Set Δv to 500 m/s prograde and press FIRE ENGINE on the stage.',
        ask: 'You pushed forward. Where does the satellite go higher: straight ahead, or on the far side of the planet?',
        reveal: '<b>On the far side.</b> A burn changes the orbit everywhere except where you are: the burn point becomes the perigee, and the apogee rises half an orbit away. That is why every transfer is done in two burns.',
        params: { mode: 'orbit', incO: 0, argP: 0, mission: 'free', body: 'earth', logH: LG(400), vr: 1, gam: 0, drag: false, spin: false, sectors: false, dv: 500, bdir: 'pro' } },
      { title: '7 · Catch the satellite ahead',
        body: 'A target is 10° ahead on your orbit. You want to catch it.',
        ask: 'Do you speed up (prograde) or slow down (retrograde)?',
        reveal: '<b>Slow down.</b> A retrograde burn drops you to a lower, faster orbit (T ∝ r^1.5), and you gain on the target every lap. Fire prograde and you climb, slow, and fall further behind. That is the orbital-mechanics paradox, and the gap plot shows it happening.',
        params: { mode: 'orbit', incO: 0, argP: 0, mission: 'rendezvous', body: 'earth', logH: LG(400), vr: 1, gam: 0, drag: false, spin: false, sectors: false, lead: 10, dv: 40, bdir: 'retro' } },
      { title: '8 · The hill between two wells',
        body: 'Earth and Moon as a potential landscape. The probe is launched straight at the Moon.',
        ask: 'Does the probe need enough energy to escape the Earth completely?',
        reveal: '<b>No: only to reach the neutral point</b>, the saddle nine-tenths of the way. That takes 11.07 km/s against the 11.19 km/s needed for full escape. Watch the probe fall back at 11.05.',
        params: { mode: 'field', flogq: LG(1 / 81.3), fdR: 60.3, fshell: false, fv: 11.05, fang: 0 } },
      { title: '9 · Two stars, one centre',
        body: 'A 2 M☉ star and a 1 M☉ star. Both orbit the white cross.',
        ask: 'Which star moves faster?',
        reveal: '<b>The lighter one</b>, twice as fast, in an orbit twice as big: M₁r₁ = M₂r₂. The radial-velocity plot is how astronomers weigh stars, and how they found planets round other suns.',
        params: { mode: 'binary', M1: 2, M2: 1, aAU: 1, ecc: 0.3, incl: 70 } },
      { title: '10 · Down a tunnel',
        body: 'A ball dropped into a tunnel 3000 km off-centre, uniform Earth. Then drag the tunnel up and down.',
        ask: 'Does a shorter tunnel take less time?',
        reveal: '<b>No, it takes exactly the same time:</b> 42.2 minutes for every chord. The force along the tunnel is proportional to the distance from its midpoint, and the constant is g/R whatever the chord. Switch to PREM and the answer changes, because the real Earth is not uniform.',
        params: { mode: 'inside', model: 'uniform', dkm: 3000, probe: 0.5, lat: 30, dayH: 24 } },
      { title: '11 · Weigh G with a laser spot',
        body: 'Big lead spheres swing into position I. The rod turns less than half a degree, and the spot on the scale 5 m away moves several centimetres.',
        ask: 'Why does the spot move 2θL and not θL?',
        reveal: '<b>A mirror doubles the angle.</b> Turning the mirror by θ turns the reflected ray by 2θ. Let it settle, drag a big sphere to position II, and the panel works out G from your own record.',
        params: { mode: 'cavendish', from: 'away', pos: 'I', auto: false, MB: 1.5, mg: 15, bmm: 46.5, T0min: 10, zeta: 0.08, Lm: 5 } },
      { title: '12 · Tip the orbit over the poles',
        body: 'A polar orbit at 800 km with the planet turning. The gold line is the ground track: the ground directly beneath the satellite.',
        ask: 'The satellite\'s orbit is fixed in space. Why does each pass cross the equator further west?',
        reveal: '<b>The Earth turns under it</b>, 25° in the 100 minutes one orbit takes. So a polar satellite sees the whole planet strip by strip, which is why weather and mapping satellites fly polar. A geostationary one sees only one face.',
        params: { mode: 'orbit', incO: 90, argP: 0, mission: 'free', body: 'earth', logH: LG(800), vr: 1, gam: 0, drag: false, spin: true, sectors: false } },
      { title: '13 · Read the orbit off the effective potential',
        body: 'An ellipse launched 20% fast. The right-hand plot shows U_eff = −GM/r + L²/2r² and the energy line.',
        ask: 'Where on the plot are the perigee and apogee?',
        reveal: '<b>Where the energy line crosses the curve.</b> There all the kinetic energy is sideways, and the radial speed is zero. The hatched gap between them is the radial kinetic energy. Raise E above zero and the right-hand crossing disappears: it escapes.',
        params: { mode: 'orbit', incO: 0, argP: 0, mission: 'free', body: 'earth', logH: LG(400), vr: 1.2, gam: 0, drag: false, spin: false, sectors: true } },
      { title: '14 · The whole solar system on one line',
        body: 'All ten bodies are integrated round the Sun from their real orbital elements. Open the left-hand plot.',
        ask: 'Mercury takes 88 days, Neptune 165 years. What single rule do they share?',
        reveal: '<b>T² ∝ a³.</b> In years and AU it is simply T = a^1.5, and every measured dot, Halley\'s comet included, sits on the line of slope 3/2. The constant depends only on the Sun\'s mass.',
        params: { mode: 'solar', focus: 'earth', zoomAU: LG(34), yps: 8, sectors: true } },
      { title: '15 · A comet that crawls and races',
        body: 'Follow Halley\'s comet. Watch the speed plot and the equal-area sectors.',
        ask: 'How much faster is it at perihelion than at aphelion?',
        reveal: '<b>About 60 times</b>: (1 + e)/(1 − e) with e = 0.967. The long thin sectors near aphelion and the short fat ones near the Sun enclose equal areas. The tail always points away from the Sun, and it grows as the comet closes in.',
        params: { mode: 'solar', focus: 'halley', zoomAU: LG(22), yps: 5, sectors: true } },
      { title: '16 · Add up the pulls of a shell',
        body: 'A thin shell as 3000 point masses. The probe is inside it.',
        ask: 'The near side is much closer. Why doesn\'t it win?',
        reveal: '<b>Because there is more mass on the far side.</b> The cone of shell on the far side is larger by exactly the square of the distance, and the pull falls off by that same square. The sum returns g ≈ 10⁻³ anywhere inside, which is zero to the accuracy of the sum. The potential is not zero: it is flat, −GM/R.',
        params: { mode: 'shapes', shape: 'shell', pr: 0.45 } },
      { title: '17 · A hole in a planet',
        body: 'A uniform sphere with a cavity hollowed out at d = R/2. Look at the blue arrows inside the cavity.',
        ask: 'Which way does the field point inside the cavity, and how does it change from place to place?',
        reveal: '<b>All the same: parallel to the line of centres, with magnitude GMd/R³.</b> It is the field of the full sphere minus the field of the missing piece, and the r-dependence cancels. That is the JEE Advanced result, read off the arrows.',
        params: { mode: 'shapes', shape: 'cavity', cd: 0.5, cr: 0.4, pr: 0.5 } },
    ],

    quiz: [
      { q: 'The gravitational field inside a spherical cavity cut anywhere in a uniform solid sphere is:',
        options: ['Uniform, parallel to the line of centres', 'Zero', 'Strongest at the cavity\'s centre', 'Directed toward the cavity\'s centre'], answer: 0,
        why: 'Superposition: the full sphere gives −(4/3)πGρ r, the missing sphere gives +(4/3)πGρ(r − d). Their sum, −(4/3)πGρ d, does not depend on r. Look at the parallel blue arrows in the cavity.' },
      { q: 'On the axis of a ring, the field is greatest at a distance:',
        options: ['R/√2', 'R', '0 (the centre)', 'R√2'], answer: 0,
        why: 'At the centre the pulls cancel; far away they fall off as 1/x². dg/dx = 0 at x = R/√2.' },
      { q: 'A planet is 4 times as far from the Sun as the Earth (on average). Its year is:',
        options: ['8 Earth years', '4 Earth years', '16 Earth years', '2 Earth years'], answer: 0,
        why: 'T² ∝ a³: T = 4^1.5 = 8 years. Check it against Jupiter at 5.2 AU (11.9 yr) on the measured plot.' },
      { q: 'You are 10° behind a target in the same circular orbit. To catch it up you should first:',
        options: ['Fire retrograde, to drop into a lower, faster orbit', 'Fire prograde, to go faster', 'Fire radially inward', 'Wait: you will meet it'], answer: 0,
        why: 'Going faster along the track raises the orbit and lengthens the period, so you fall behind. Lower orbits are faster (v = √(GM/r), T ∝ r^1.5). Run the rendezvous preset both ways.' },
      { q: 'The Moon is 1/81 of the Earth\'s mass. The point where the net gravitational field is zero lies at what fraction of the Earth–Moon distance from the Earth?',
        options: ['9/10', '81/82', '1/2', '80/81'], answer: 0,
        why: 'x/(d − x) = √81 = 9, so x = 0.9d. The square root appears because the field falls as 1/r².' },
      { q: 'Two satellites are launched from the same height at the same speed, one horizontally and one 30° upward, and neither hits the ground. Their periods are:',
        options: ['Equal', 'Longer for the one aimed upward', 'Shorter for the one aimed upward', 'It depends on the mass'], answer: 0,
        why: 'Same speed and height means the same energy, so the same a (E = −GM/2a) and the same T. Only the eccentricity differs. Try it with the green ring.' },
      { q: 'A satellite in a circular orbit loses energy to air drag. Its speed:',
        options: ['Increases', 'Decreases', 'Stays the same', 'Drops to zero'], answer: 0,
        why: 'KE = −E for a circular orbit. Lower E means higher KE: it spirals in and speeds up. The energy plot in the drag preset shows KE climbing while E falls.' },
      { q: 'A smooth tunnel along a chord of a uniform Earth, not through the centre. The time for a ball to cross is:',
        options: ['42 min, the same as through the centre', 'Less, because the tunnel is shorter', 'More, because g along the tunnel is weaker', 'Zero if the tunnel is short enough'], answer: 0,
        why: 'The restoring acceleration along the chord is (g/R) × distance from the chord\'s midpoint: SHM with the same ω = √(g/R). The shorter distance exactly offsets the weaker force.' },
      { q: 'In the real (non-uniform) Earth, going down from the surface, g:',
        options: ['First increases, peaking near the core boundary', 'Decreases linearly', 'Stays constant', 'Increases all the way to the centre'], answer: 0,
        why: 'The dense core dominates m(r). Losing the light crust and mantle overhead lowers m(r) more slowly than r² falls, so g rises to about 10.7 m/s² at 2900 km depth, then falls to zero at the centre.' },
      { q: 'For a binary star with M₁ = 2M₂, the ratio of the speeds v₁ : v₂ is:',
        options: ['1 : 2', '2 : 1', '1 : 1', '1 : 4'], answer: 0,
        why: 'Both stars share the centre of mass and the period, so their speeds go as their orbit radii, which go inversely with mass: r₁ : r₂ = M₂ : M₁ = 1 : 2.' },
      { q: 'In the Cavendish balance, why is the rod\'s rotation read with a light beam instead of a pointer?',
        options: ['The angle is a fraction of a degree; a beam on a distant scale magnifies it by 2L', 'A pointer would be attracted by the spheres', 'Light is faster', 'The fibre is transparent'], answer: 0,
        why: 'θ is about 8 milliradians. A mirror turns the reflected ray by 2θ, so a scale L = 5 m away moves by about 2θL ≈ 8 cm. That is an optical lever.' }
    ],

    notes: '<b>Where this shows up in the paper.</b><ul>' +
      '<li><b>Orbital speed, period and energy</b>: v = √(GM/r), T² ∝ r³, E = −GMm/2r, KE = −E, PE = 2E. Usually two-step numericals (NEET, JEE Main).</li>' +
      '<li><b>Escape speed</b>: √2 × orbital speed at the same r, independent of direction and of the mass launched.</li>' +
      '<li><b>Elliptical orbits</b>: conserve L (r₁v₁ = r₂v₂ at the apsides) and E together. These are the JEE Advanced favourites.</li>' +
      '<li><b>g with height, depth, latitude and spin</b>: g(1 − 2h/R), g(1 − d/R), g − ω²R cos²λ.</li>' +
      '<li><b>Tunnel through the Earth</b>: SHM, 84.4 min for a full oscillation, for any chord of a uniform Earth.</li>' +
      '<li><b>Binary stars and reduced mass</b>: T = 2π√(a³/G(M₁+M₂)); r ∝ 1/M about the centre of mass.</li></ul>' +
      '<div class="pyq"><em>Trap to avoid</em> — g(1 − 2h/R) is only the first term of a series. At h = R/2 it gives 0 while the truth is g/2.25. The plot shows the dashed approximation leaving the true curve. When h is not small, use g(R/(R+h))².</div>' +
      '<div class="pyq"><em>Trap to avoid</em> — "The satellite needs less speed to escape if launched vertically." It does not. Escape depends only on ½v² ≥ GM/r. Direction decides whether it hits the ground on the way, not whether it has enough energy.</div>'
  });

  /* =========================================================================
     20 · MECHANICAL PROPERTIES OF FLUIDS

     Five pieces of apparatus, each computing what it shows:
       · a tank draining through an orifice: the level integrated from
         continuity and Torricelli, each jet a projectile;
       · a venturimeter: Bernoulli marched along the pipe with the real
         friction (laminar 64/Re or Blasius) and the diffuser's loss, read
         on five manometer tubes;
       · a falling-ball viscometer: the ball integrated under weight,
         upthrust, added mass and the full sphere drag curve Cd(Re), with
         the wall correction, and timed between two light gates;
       · Archimedes on a spring balance, with the beaker standing on a
         scale, the liquid level solved as the block goes in;
       · capillary rise in three tubes, integrated with inertia and viscous
         loss (so a wide tube overshoots and rings, a narrow one creeps).
     ========================================================================= */
  const GF = 9.81;
  const LIQ = {
    water:    { name: 'water',       rho: 998,   eta: T => interpLog([[0, 1.792e-3], [10, 1.307e-3], [20, 1.002e-3], [30, 0.798e-3], [40, 0.653e-3], [50, 0.547e-3]], T), col: '#4DA8F0', sig: 0.0728, theta: 0, pv: 2339 },
    glycerine:{ name: 'glycerine',   rho: 1261,  eta: T => interpLog([[0, 12.07], [10, 3.95], [20, 1.41], [30, 0.612], [40, 0.284], [50, 0.142]], T), col: '#E8B04A', sig: 0.0634, theta: 0, pv: 0.01 },
    castor:   { name: 'castor oil',  rho: 961,   eta: T => interpLog([[0, 5.30], [10, 2.42], [20, 0.986], [30, 0.451], [40, 0.231], [50, 0.125]], T), col: '#D8C25A', sig: 0.039, theta: 0, pv: 0.01 },
    oil:      { name: 'light oil',   rho: 870,   eta: () => 0.065, col: '#C9A43A', sig: 0.030, theta: 0, pv: 100 },
    brine:    { name: 'brine',       rho: 1200,  eta: () => 1.6e-3, col: '#6FC0E8', sig: 0.080, theta: 0, pv: 2000 },
    kerosene: { name: 'kerosene',    rho: 800,   eta: () => 1.64e-3, col: '#D6E4A0', sig: 0.026, theta: 0, pv: 700 },
    mercury:  { name: 'mercury',     rho: 13534, eta: () => 1.53e-3, col: '#7E8898', sig: 0.485, theta: 140, pv: 0.2 },
    ethanol:  { name: 'ethanol',     rho: 789,   eta: () => 1.2e-3, col: '#9FD8F0', sig: 0.0223, theta: 0, pv: 5950 },
    soapy:    { name: 'soapy water', rho: 1000,  eta: () => 1.0e-3, col: '#8FD0E8', sig: 0.030, theta: 0, pv: 2339 }
  };
  const SOLID = {
    steel:     { name: 'steel',     rho: 7850,  col: '#C9D2DE' },
    glass:     { name: 'glass',     rho: 2500,  col: '#A9E0D8' },
    lead:      { name: 'lead',      rho: 11340, col: '#7C8594' },
    nylon:     { name: 'nylon',     rho: 1140,  col: '#F2EEDD' },
    aluminium: { name: 'aluminium', rho: 2700,  col: '#C4CCD8' },
    iron:      { name: 'iron',      rho: 7870,  col: '#8A8F98' },
    wood:      { name: 'pine wood', rho: 500,   col: '#C8955A' },
    ice:       { name: 'ice',       rho: 917,   col: '#DDF2FF' },
    wax:       { name: 'paraffin wax', rho: 900, col: '#F4E9C8' }
  };
  function interpLog(tab, T) {
    if (T <= tab[0][0]) return tab[0][1];
    for (let i = 0; i < tab.length - 1; i++) if (T <= tab[i + 1][0]) {
      const f = (T - tab[i][0]) / (tab[i + 1][0] - tab[i][0]);
      return Math.exp(Math.log(tab[i][1]) * (1 - f) + Math.log(tab[i + 1][1]) * f);
    }
    return tab[tab.length - 1][1];
  }

  /* ---------------- 1 · the draining tank ---------------- */
  function runTank(p) {
    const A = Math.PI * Math.pow(p.Dt / 200, 2), a = Math.PI * Math.pow(p.dmm / 2000, 2);
    const Cd = p.real ? 0.61 : 1, Cv = p.real ? 0.97 : 1;
    const H0 = p.H0 / 100;
    const y1 = clamp(p.y1, 1, p.H0 - 1) / 100;
    const holes = [y1];
    if (p.two && Math.abs(H0 - 2 * y1) > 0.01) holes.push(H0 - y1);   // the mirror hole: the same range
    const flow = H => holes.reduce((q, y) => q + (H > y ? Cd * a * Math.sqrt(2 * GF * (H - y)) : 0), 0);
    const pts = [[0, H0]];
    let H = H0, t = 0, tDrain = 0;
    const h = 0.05, yLow = Math.min.apply(null, holes);
    while (t < 1800) {
      if (p.hold) { t += h; if (t > 60) break; pts.push([t, H]); continue; }
      const k1 = -flow(H) / A, k2 = -flow(H + k1 * h / 2) / A, k3 = -flow(H + k2 * h / 2) / A, k4 = -flow(H + k3 * h) / A;
      const Hn = H + h / 6 * (k1 + 2 * k2 + 2 * k3 + k4);
      if (Hn - yLow < 1e-3) {
        /* the last millimetre, exactly: with only the lowest hole running,
           √(H − y) falls linearly, so the time left is (A/Cd·a)√(2(H − y)/g) */
        tDrain = t + h + A / (Cd * a) * Math.sqrt(2 * Math.max(0, Hn - yLow) / GF);
        pts.push([t + h, Hn]); pts.push([tDrain, yLow]); break;
      }
      H = Hn; t += h;
      if (pts.length < 40000) pts.push([t, H]);
    }
    const jet = (Hn, y) => {
      if (Hn <= y) return null;
      const v = Cv * Math.sqrt(2 * GF * (Hn - y));
      return { v, R: v * Math.sqrt(2 * y / GF), tFall: Math.sqrt(2 * y / GF) };
    };
    const tFormula = A / (Cd * a) * Math.sqrt(2 * (H0 - y1) / GF);
    return { A, a, Cd, Cv, H0, holes, pts, tDrain, tFormula, jet, rT: p.Dt / 200, Q0: flow(H0) };
  }
  function levelAt(Tk, t) {
    const P = Tk.pts;
    if (t >= P[P.length - 1][0]) return P[P.length - 1][1];
    let lo = 0, hi = P.length - 1;
    while (hi - lo > 1) { const m = (lo + hi) >> 1; if (P[m][0] <= t) lo = m; else hi = m; }
    const f = (t - P[lo][0]) / (P[hi][0] - P[lo][0]);
    return P[lo][1] + (P[hi][1] - P[lo][1]) * f;
  }

  /* ---------------- 2 · the venturimeter ---------------- */
  const VX = [0, 0.30, 0.36, 0.42, 0.60, 0.85];          // inlet, cone start, throat start, throat end, diffuser end, exit (m)
  const VSTATIONS = [0.15, 0.33, 0.39, 0.51, 0.72];
  function ventD(x, D1, D2) {
    if (x < VX[1]) return D1;
    if (x < VX[2]) return D1 + (D2 - D1) * (x - VX[1]) / (VX[2] - VX[1]);
    if (x < VX[3]) return D2;
    if (x < VX[4]) return D2 + (D1 - D2) * (x - VX[3]) / (VX[4] - VX[3]);
    return D1;
  }
  function fricF(Re) {
    const lam = 64 / Math.max(Re, 1e-9), tur = 0.3164 * Math.pow(Math.max(Re, 1), -0.25);
    if (Re < 2300) return lam;
    if (Re > 4000) return tur;
    const f = (Re - 2300) / 1700;
    return lam * (1 - f) + tur * f;
  }
  function runVenturi(p) {
    const F = LIQ[p.vfluid], rho = F.rho, eta = F.eta(20);
    const D1 = 0.025, D2 = D1 * p.beta, Q = p.Qlpm / 60000;
    const A = D => Math.PI * D * D / 4;
    const N = 400, dx = VX[5] / N;
    const xs = [], ps = [], vs = [];
    // the valve downstream holds the exit at a back-pressure head; at zero the
    // exit is open to the air and the throat drops below atmospheric
    let pp = rho * GF * p.hback / 100;
    const loss = !!p.loss;
    const A2 = A(D2), A3 = A(D1), Kd = 0.25 * Math.pow(1 - A2 / A3, 2);   // a gradual diffuser keeps ~a quarter of the sudden-expansion loss
    const vThroat = Q / A2;
    for (let i = N; i >= 0; i--) {
      const x = i * dx, D = ventD(x, D1, D2), v = Q / A(D);
      if (i < N) {
        const vPrev = vs[0];
        pp += 0.5 * rho * (vPrev * vPrev - v * v);
        if (loss) {
          const Re = rho * v * D / eta;
          pp += fricF(Re) * rho * v * v / (2 * D) * dx;
          if (x >= VX[3] && x < VX[4]) pp += Kd * 0.5 * rho * vThroat * vThroat * dx / (VX[4] - VX[3]);
        }
      }
      xs.unshift(x); ps.unshift(pp); vs.unshift(v);
    }
    const at = x => { const i = clamp(Math.round(x / dx), 0, N); return { p: ps[i], v: vs[i], D: ventD(x, D1, D2) }; };
    const st = VSTATIONS.map(x => { const s = at(x); return { x, p: s.p, v: s.v, D: s.D, h: s.p / (rho * GF) }; });
    const dh = st[0].h - st[2].h;
    const beta4 = Math.pow(p.beta, 4);
    const Qv = A2 * Math.sqrt(Math.max(0, 2 * GF * dh / (1 - beta4)));
    const Re1 = rho * (Q / A(D1)) * D1 / eta, Re2 = rho * vThroat * D2 / eta;
    const pAbsThroat = 101325 + st[2].p;
    // the ideal formula OVER-reads Q when friction adds to Δh, so Cd = Q_true / Q_formula < 1
    const pIdeal0 = ps[0], hb = rho * GF * p.hback / 100;
    return { F, rho, eta, D1, D2, Q, xs, ps, vs, st, dh, Qv, Cd: Qv > 0 ? Q / Qv : 1, Re1, Re2, laminar: Re1 < 2300,
             cav: pAbsThroat < F.pv, pAbsThroat, v1: Q / A(D1), v2: vThroat, lossHead: (pIdeal0 - hb) / (rho * GF), hb };
  }

  /* ---------------- 3 · the falling ball ---------------- */
  function sphereCd(Re) {
    if (Re < 1e-9) return 1e12;
    return 24 / Re * (1 + 0.15 * Math.pow(Re, 0.687)) + 0.42 / (1 + 42500 * Math.pow(Re, -1.16));
  }
  const TUBE_D = 0.050, COLUMN = 0.55, GATE1 = 0.10, GATE2 = 0.40;
  function runBall(p) {
    const Lq = LIQ[p.bfluid], Sd = SOLID[p.ball];
    const rho = Lq.rho, eta = Lq.eta(p.TC), rs = Sd.rho, r = p.rmm / 1000;
    const V = 4 / 3 * Math.PI * r * r * r, m = rs * V, madd = 0.5 * rho * V;
    const lam = 2 * r / TUBE_D;
    const kw = p.wall ? Math.max(0.05, 1 - 2.104 * lam + 2.09 * Math.pow(lam, 3) - 0.95 * Math.pow(lam, 5)) : 1;
    const Wn = (rs - rho) * V * GF;                       // weight less upthrust
    const drag = v => { const Re = rho * Math.abs(v) * 2 * r / eta; return 0.5 * rho * v * Math.abs(v) * Math.PI * r * r * sphereCd(Re) / kw; };
    // Stokes and the true terminal speed, by bisection on the full drag law
    const vStokes = 2 * r * r * (rs - rho) * GF / (9 * eta) * kw;
    let lo = 0, hi = Math.max(1e-6, vStokes * 2, 20);
    if (Wn > 0) { for (let i = 0; i < 200; i++) { const mid = (lo + hi) / 2; if (drag(mid) < Wn) lo = mid; else hi = mid; } }
    const vT = Wn > 0 ? (lo + hi) / 2 : 0;
    const ReT = rho * vT * 2 * r / eta;
    // integrate with the drag linearised about the current speed (stable at any step)
    const pts = [[0, 0, 0]];
    let t = 0, z = 0, v = 0, t1 = 0, t2 = 0, h = 1e-5;
    const tau = (m + madd) / (6 * Math.PI * eta * r / kw);
    const hMax = Math.max(2e-4, Math.min(0.02, tau * 0.2));
    let nextRec = 0;
    while (z < COLUMN - r && t < 900 && Wn > 0) {
      const c = Math.abs(v) > 1e-12 ? drag(v) / v : 6 * Math.PI * eta * r / kw;
      const vn = (v + h * Wn / (m + madd)) / (1 + h * c / (m + madd));
      const zn = z + h * (v + vn) / 2;
      if (!t1 && zn >= GATE1) t1 = t + h * (GATE1 - z) / (zn - z);
      if (!t2 && zn >= GATE2) t2 = t + h * (GATE2 - z) / (zn - z);
      z = zn; v = vn; t += h;
      h = Math.min(hMax, h * 1.08);
      if (t >= nextRec) { pts.push([t, z, v]); nextRec = t + Math.max(0.002, (tau > 1 ? 0.05 : 0.01)); }
    }
    pts.push([t, z, v]);
    const vMeas = t2 > t1 && t1 > 0 ? (GATE2 - GATE1) / (t2 - t1) : 0;
    const etaMeas = vMeas > 0 ? 2 * r * r * (rs - rho) * GF / (9 * vMeas) : NaN;
    const x99 = (() => { for (const q of pts) if (q[2] >= 0.99 * vT) return q[1]; return NaN; })();
    return { Lq, Sd, rho, eta, rs, r, m, madd, kw, lam, vStokes, vT, ReT, pts, t1, t2, vMeas, etaMeas, tEnd: t, x99, Wn,
             floats: Wn <= 0 };
  }
  function ballAt(B, t) {
    const P = B.pts;
    if (t >= P[P.length - 1][0]) return P[P.length - 1];
    let lo = 0, hi = P.length - 1;
    while (hi - lo > 1) { const m = (lo + hi) >> 1; if (P[m][0] <= t) lo = m; else hi = m; }
    const f = (t - P[lo][0]) / (P[hi][0] - P[lo][0]);
    return [t, P[lo][1] + (P[hi][1] - P[lo][1]) * f, P[lo][2] + (P[hi][2] - P[lo][2]) * f];
  }
  /* the terminal speed for any radius, for the v–r² landscape (cached) */
  const VTC = {};
  function vtCurve(p) {
    const key = [p.bfluid, p.ball, p.TC, p.wall].join('|');
    if (VTC[key]) return VTC[key];
    const out = [], st = [];
    for (let rm = 0.25; rm <= 8.0001; rm += 0.125) {
      const B = runBallQuick(p, rm);
      out.push([rm * rm, B.vT * 100]); st.push([rm * rm, B.vStokes * 100]);
    }
    return (VTC[key] = { out, st });
  }
  function runBallQuick(p, rmm) {
    const Lq = LIQ[p.bfluid], Sd = SOLID[p.ball], rho = Lq.rho, eta = Lq.eta(p.TC), rs = Sd.rho, r = rmm / 1000;
    const V = 4 / 3 * Math.PI * r * r * r, lam = 2 * r / TUBE_D;
    const kw = p.wall ? Math.max(0.05, 1 - 2.104 * lam + 2.09 * Math.pow(lam, 3) - 0.95 * Math.pow(lam, 5)) : 1;
    const Wn = (rs - rho) * V * GF;
    const drag = v => { const Re = rho * v * 2 * r / eta; return 0.5 * rho * v * v * Math.PI * r * r * sphereCd(Re) / kw; };
    let lo = 0, hi = 50;
    for (let i = 0; i < 120; i++) { const mid = (lo + hi) / 2; if (drag(mid) < Wn) lo = mid; else hi = mid; }
    return { vT: Wn > 0 ? lo : 0, vStokes: 2 * r * r * (rs - rho) * GF / (9 * eta) * kw };
  }

  /* ---------------- 4 · Archimedes on a spring balance ---------------- */
  const BK = { a: 0.05, D: 0.10, H: 0.16, mB: 0.150, liqH: 0.08, zTop: 0.20 };   // block side, beaker, liquid depth
  function buoyState(p, lower) {
    const L = LIQ[p.liq], S = SOLID[p.block];
    const a = BK.a, Ab = Math.PI * BK.D * BK.D / 4, Vl = Ab * BK.liqH, a2 = a * a;
    const m = S.rho * a * a * a, W = m * GF;
    let zb = BK.zTop - lower;                         // block bottom above the beaker floor, if the string is taut
    const levelFor = (zb) => {
      let Hl = Vl / Ab;
      if (Hl <= zb) return Hl;
      Hl = (Vl - a2 * zb) / (Ab - a2);
      if (Hl <= zb + a) return Hl;
      return (Vl + a2 * a) / Ab;
    };
    let resting = false;
    if (zb <= 0) { zb = 0; resting = true; }
    let Hl = levelFor(zb), sub = clamp(Hl - zb, 0, a), B = L.rho * a2 * sub * GF;
    let floating = false;
    if (B >= W && !resting) {
      // the string goes slack: the block floats at the depth where B = W
      const s = m / (L.rho * a2);
      if (s < a) {
        floating = true;
        Hl = (Vl + a2 * s) / Ab; zb = Hl - s; sub = s; B = W;
      }
    }
    const T = resting || floating ? 0 : Math.max(0, W - B);
    const N = resting ? Math.max(0, W - B) : 0;
    const mLiq = L.rho * Vl;
    const scaleN = (BK.mB + mLiq) * GF + (resting || floating ? W : B);
    return { L, S, a, m, W, zb, Hl, sub, B, T, N, resting, floating, scaleN, mLiq, Ab, Vl, frac: sub / a };
  }
  /* cut the string: integrate the block, with its added mass, a little damping
     and the floor, while the level moves with it */
  function runRelease(p) {
    const st0 = buoyState(p, p.lower / 100);
    const L = st0.L, a = BK.a, a2 = a * a, m = st0.m, Ab = st0.Ab, Vl = st0.Vl;
    const madd = 0.3 * L.rho * a2 * a;                // heave added mass of a cube, roughly
    const kH = L.rho * GF * a2 * (1 - a2 / Ab);        // restoring stiffness, with the level rise
    const c = 2 * 0.08 * Math.sqrt(kH * (m + madd));
    let zb = st0.zb, v = 0, t = 0;
    const pts = [[0, zb]];
    const levelFor = (zb) => {
      let Hl = Vl / Ab; if (Hl <= zb) return Hl;
      Hl = (Vl - a2 * zb) / (Ab - a2); if (Hl <= zb + a) return Hl;
      return (Vl + a2 * a) / Ab;
    };
    const h = 0.002;
    let cross = [], prevS = null;
    const zeq = st0.m / (L.rho * a2) < a ? null : null; void zeq;
    while (t < 12) {
      const Hl = levelFor(zb), sub = clamp(Hl - zb, 0, a);
      const F = L.rho * a2 * sub * GF - m * GF - c * v * (sub > 0 ? 1 : 0.05);
      let acc = F / (m + madd * sub / a);
      v += acc * h; zb += v * h; t += h;
      if (zb < 0) { zb = 0; v = 0; }
      pts.push([t, zb]);
      const s = Math.sign(v);
      if (prevS !== null && s !== prevS && s !== 0) cross.push(t);
      if (s !== 0) prevS = s;
    }
    // period from successive turning points (two per cycle)
    let Tm = 0;
    if (cross.length >= 3) Tm = (cross[cross.length - 1] - cross[0]) / ((cross.length - 1) / 2);
    const floats = st0.S.rho < L.rho;
    const sEq = m / (L.rho * a2);
    const Ttext = 2 * Math.PI * Math.sqrt(sEq / GF);
    return { pts, Tm, floats, Ttext, madd, sEq };
  }

  /* ---------------- 5 · capillary rise, with inertia ---------------- */
  function runCap(p) {
    const L = LIQ[p.cliq];
    const theta = (p.waxed && p.cliq !== 'mercury' ? 105 : L.theta) * Math.PI / 180;
    const eta = L.eta(20), rho = L.rho, sig = L.sig;
    const radii = [p.rmm, 2 * p.rmm, 4 * p.rmm].map(x => x / 1000);
    const Lmax = p.Lcm / 100;
    /* run long enough for the slowest tube to settle: the viscous creep has
       time scale 8ηh/(ρgr²), and five of them bring it within 1 % */
    const tEnd = clamp(Math.max(...radii.map(r => 6 * 8 * eta * Math.min(Lmax, Math.abs(2 * sig * Math.cos(theta) / (rho * GF * r))) / (rho * GF * r * r))), 6, 90);
    const tubes = radii.map(r => {
      const hJ = 2 * sig * Math.cos(theta) / (rho * GF * r);
      const dlt = 1.2 * r;
      let hh = 0, u = 0, t = 0;
      const pts = [[0, 0]];
      const dtS = Math.min(2e-4, r * 0.5);
      let capped = false;
      let nextRec = 0;
      while (t < tEnd) {
        const drive = 2 * sig * Math.cos(theta) / r - rho * GF * hh - 8 * eta * Math.abs(hh) * u / (r * r);
        const du = (drive / rho - u * u * Math.sign(hh || 1)) / (Math.abs(hh) + dlt);
        u += du * dtS; hh += u * dtS; t += dtS;
        if (hh >= Lmax) { hh = Lmax; u = 0; capped = true; }
        if (t >= nextRec) { pts.push([t, hh]); nextRec = t + tEnd / 2000; }
      }
      // with the tube too short, the meniscus flattens until the pull just holds the column
      const cosNew = capped ? rho * GF * r * Lmax / (2 * sig) : Math.cos(theta);
      return { r, hJ, pts, capped, h: hh, thetaEff: Math.acos(clamp(cosNew, -1, 1)) };
    });
    return { L, theta, tubes, Lmax, rho, sig, tEnd };
  }
  function capAt(tb, t) {
    const P = tb.pts;
    if (t >= P[P.length - 1][0]) return P[P.length - 1][1];
    let lo = 0, hi = P.length - 1;
    while (hi - lo > 1) { const m = (lo + hi) >> 1; if (P[m][0] <= t) lo = m; else hi = m; }
    const f = (t - P[lo][0]) / Math.max(1e-12, P[hi][0] - P[lo][0]);
    return P[lo][1] + (P[hi][1] - P[lo][1]) * f;
  }

  /* ---------------- glassware and liquid, drawn as volumes ----------------
     A vertical cylinder projects to a convex shape: the hull of its two rim
     ellipses. Glass is that hull filled almost clear, with a bright streak
     near each silhouette edge where a real tube catches the light. Liquid is
     the hull up to its surface, filled with a graded tint, and a lit surface
     ellipse on top. Contents are drawn BEFORE the liquid in the same depth
     band, so they show through it tinted — which is what sitting in a liquid
     looks like. */
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

  /* ======================= 1 · the tank ======================= */
  function drawTank(S, g) {
    const ctx = g.ctx, th = g.theme, p = S.p, W = g.w, H = g.h, Tk = S.Tk, cam = S.cam;
    const narrow = W < 660, K = 2.2, B = window.BENCH;
    const F = R3.Frame(ctx, cam, { ambient: 0.3, floorZ: 0 });
    const m = (x, y, z) => [x * K, y * K, z * K];
    B.table(F, -0.62 * K, 0.75 * K, -0.30 * K, 0.30 * K, 0, { legs: false, tone: '#7A5230', seed: 23, thick: 0.08 });
    const X0 = -0.40, rT = Tk.rT, Ht = Tk.H0 + 0.06;
    const lvl = levelAt(Tk, S.ts);
    // the collecting tray and a metre rule along it, so a range can be read
    B.texBox(F, m(0.22, 0, 0.006), [0.90 * K, 0.20 * K, 0.012 * K], B.metal('#8C98AA', 41), { ambient: 0.5 });
    B.rule(F, m(X0 + rT, -0.115, 0.001), [1, 0, 0], 1.0, { k: K, width: 0.05 * K });
    // the tank: a clear cylinder on a dark base, filled to the level
    R3.cylinder(F, m(X0, 0, 0), m(X0, 0, 0.012), (rT + 0.012) * K, '#2A3142', { segments: 40, shadow: false });
    const lc = LIQ.water.col;
    liquidCyl(F, m(X0, 0, 0.012), rT * K, (lvl - 0.012 < 0 ? 0 : lvl - 0.012) * K, lc, { alpha: 0.5 });
    glassCyl(F, m(X0, 0, 0.012), (rT + 0.004) * K, (Ht - 0.012) * K, {
      ticks: (c) => {           // graduations on the glass: every cm, labelled every 10 cm
        for (let cm = 0; cm <= Math.floor(Ht * 100); cm++) {
          const q0 = cam.project(m(X0 - (rT + 0.004) * 0.35, -(rT + 0.004) * 0.94, cm / 100)), q1 = cam.project(m(X0 - (rT + 0.004) * 0.15, -(rT + 0.004) * 0.99, cm / 100));
          if (!q0.ok || !q1.ok) continue;
          c.strokeStyle = 'rgba(235,245,255,' + (cm % 10 ? 0.35 : 0.8) + ')'; c.lineWidth = cm % 10 ? 0.7 : 1.1;
          c.beginPath(); c.moveTo(q0.x, q0.y); c.lineTo(cm % 5 ? (q0.x + q1.x) / 2 : q1.x, cm % 5 ? (q0.y + q1.y) / 2 : q1.y); c.stroke();
          if (cm % 10 === 0 && cm) { c.fillStyle = 'rgba(235,245,255,.8)'; c.font = '600 8px "IBM Plex Mono",monospace'; c.textAlign = 'right'; c.fillText(String(cm), q0.x - 3, q0.y + 3); }
        }
      } });
    // constant head: a tap above keeps the level where it is
    if (p.hold) {
      R3.cylinder(F, m(X0 - rT * 0.3, 0, Ht + 0.14), m(X0 - rT * 0.3, 0, Ht + 0.08), 0.008 * K, '#B8C2D0', { segments: 12, shadow: false });
      R3.cylinder(F, m(X0 - rT * 0.3 - 0.12, 0, Ht + 0.14), m(X0 - rT * 0.3, 0, Ht + 0.14), 0.008 * K, '#B8C2D0', { segments: 12, shadow: false });
      path3(F, [m(X0 - rT * 0.3, 0, Ht + 0.08), m(X0 - rT * 0.3, 0, lvl)], lc, { alpha: 0.75, width: 3.5, chunk: 1 });
    }
    // nozzles and jets
    const cols = ['#7FD0FF', '#B8A4FF'];
    const tnow = g.now / 1000;
    Tk.holes.forEach((y, i) => {
      const hx = X0 + rT;
      R3.cylinder(F, m(hx - 0.004, 0, y), m(hx + 0.010, 0, y), (p.dmm / 2000 + 0.002) * K, '#C9A04A', { segments: 14, shadow: false });
      const J = Tk.jet(lvl, y);
      if (!J) return;
      const pts = [];
      for (let k = 0; k <= 30; k++) { const s = J.tFall * k / 30; pts.push(m(hx + 0.010 + J.v * s, 0, y - 0.5 * GF * s * s)); }
      const wJ = Math.max(2.5, (p.dmm / 1000) * (p.real ? 0.79 : 1) * K * 320);
      path3(F, pts, cols[i], { alpha: 0.55, width: wJ, chunk: 3 });
      path3(F, pts, '#FFFFFF', { alpha: 0.55, width: Math.max(0.8, wJ * 0.25), chunk: 3, bias: -0.001 });
      // droplets riding the jet in real time, and a splash where it lands
      for (let k = 0; k < 8; k++) {
        const u = ((tnow * 1.3 + k / 8) % 1), s = J.tFall * u;
        const pt = m(hx + 0.010 + J.v * s, 0, y - 0.5 * GF * s * s);
        F.push(pt, () => { const q = cam.project(pt); if (!q.ok) return; ctx.fillStyle = 'rgba(230,245,255,.85)'; ctx.beginPath(); ctx.arc(q.x, q.y, 1.4, 0, TAU); ctx.fill(); }, -0.01);
      }
      const land = m(hx + 0.010 + J.R, 0, 0.013);
      F.push(land, () => {
        const q = cam.project(land); if (!q.ok) return;
        for (let k = 0; k < 3; k++) {
          const ph = (tnow * 1.6 + k / 3) % 1;
          ctx.strokeStyle = 'rgba(190,230,255,' + (0.6 * (1 - ph)).toFixed(3) + ')'; ctx.lineWidth = 1;
          ctx.beginPath(); ctx.ellipse(q.x, q.y, 4 + ph * 18, 1.5 + ph * 5, 0, 0, TAU); ctx.stroke();
        }
      }, -0.01);
      R3.callout(F, land, i ? 30 : -10, i ? 26 : 36, 'R = ' + (J.R * 100).toFixed(1) + ' cm', cols[i], { size: 9.5 });
      R3.callout(F, m(hx, 0, y), 26, i ? -30 : -14, 'v = ' + J.v.toFixed(2) + ' m/s at ' + ((lvl - y) * 100).toFixed(1) + ' cm depth', cols[i], { size: 9 });
    });
    F.render();

    // handles: the lower hole (up/down) and the starting level
    const hq = cam.project(m(X0 + rT, 0, Tk.holes[0])), hq2 = cam.project(m(X0 + rT, 0, Tk.holes[0] + 0.1));
    // the starting level: a mark on the glass, draggable at any time (it restarts the run)
    const sq = cam.project(m(X0 - rT * 0.5, -rT * 0.87, Tk.H0)), sq2 = cam.project(m(X0 - rT * 0.5, -rT * 0.87, Tk.H0 + 0.1));
    if (hq.ok && hq2.ok) { S._axH = axis2(hq, hq2, 0.1); ringHandle(g, hq, 'hole', '#7FD0FF'); }
    if (sq.ok && sq2.ok) {
      S._axL = axis2(sq, sq2, 0.1); ringHandle(g, sq, 'lvl', '#F5B451', 9);
      PA.lbl(ctx, sq.x - 14, sq.y, 'start ' + (Tk.H0 * 100).toFixed(1) + ' cm', '#F5B451', 'right', 9);
    }

    header(g, p.hold ? 'Constant head · the jets hold still' : 'Draining · level ' + (lvl * 100).toFixed(1) + ' cm',
      'hole ⌀ ' + p.dmm.toFixed(1) + ' mm in a ⌀ ' + p.Dt.toFixed(0) + ' cm tank · ' + (p.real ? 'real sharp-edged orifice: Cc 0.63, Cv 0.97' : 'ideal orifice') +
        ' · t = ' + tfmt(S.ts),
      'level from A dH/dt = −Cd·a√(2g(H − y)), each jet a projectile from its hole', th.text);
    const rows = narrow ? 4 : 6, bw = narrow ? W - 24 : 272, bh = 26 + rows * 15 + 10;
    const row = gPanel(g, 12, H - bh - 30, bw, bh, 'READ FROM THE BENCH');
    const J0 = Tk.jet(lvl, Tk.holes[0]);
    row(0, 'range of the lower jet', J0 ? (J0.R * 100).toFixed(2) + ' cm' : 'stopped', th.phys);
    row(1, '2√(h·y)  (Cv = 1)', J0 ? (2 * Math.sqrt((lvl - Tk.holes[0]) * Tk.holes[0]) * 100).toFixed(2) + ' cm' : '—');
    row(2, 'time to drain to the hole', p.hold ? 'never — held' : tfmt(Tk.tDrain));
    row(3, '(A/Cd·a)√(2h₀/g)', p.hold ? '—' : tfmt(Tk.tFormula), th.ok);
    if (!narrow) {
      row(4, 'best hole for this level', 'y = H/2 = ' + (lvl * 50).toFixed(1) + ' cm');
      row(5, 'flow now, Q = Cd·a·v', (Tk.holes.reduce((q, y) => { const J = Tk.jet(lvl, y); return q + (J ? Tk.Cd / Tk.Cv * Tk.a * J.v : 0); }, 0) * 6e4).toFixed(3) + ' L/min');
    }
  }

  /* ======================= 2 · the venturimeter ======================= */
  const BOARD = {};
  function boardTex(wpx) {
    wpx = wpx || 900;
    if (BOARD[wpx]) return BOARD[wpx];
    const c = document.createElement('canvas'); c.width = wpx; c.height = 500;
    const x = c.getContext('2d');
    // a matt grey-blue board, not a white card: it must sit in a dark room
    const gr = x.createLinearGradient(0, 0, 0, 500); gr.addColorStop(0, '#2A3346'); gr.addColorStop(1, '#1C2333');
    x.fillStyle = gr; x.fillRect(0, 0, wpx, 500);
    for (let cm = 0; cm <= 50; cm++) {
      const y = 500 - cm * 10;
      x.strokeStyle = cm % 10 ? 'rgba(200,215,240,.14)' : cm % 5 ? '' : 'rgba(200,215,240,.45)'; x.lineWidth = cm % 10 ? 1 : 2;
      if (cm % 5 === 0 && cm % 10) x.strokeStyle = 'rgba(200,215,240,.26)';
      x.beginPath(); x.moveTo(0, y); x.lineTo(wpx, y); x.stroke();
      if (cm % 10 === 0) { x.fillStyle = 'rgba(220,230,250,.85)'; x.font = '600 20px "IBM Plex Mono",monospace'; x.fillText(cm + ' cm', 8, y - 4); }
    }
    return (BOARD[wpx] = c);
  }
  function drawVenturi(S, g) {
    const ctx = g.ctx, th = g.theme, p = S.p, W = g.w, H = g.h, V = S.V, cam = S.cam;
    const narrow = W < 660, K = 2.4, B = window.BENCH;
    const F = R3.Frame(ctx, cam, { ambient: 0.3, floorZ: 0 });
    const X0 = -0.425, Z = 0.20;                         // pipe starts at X0 (m), axis height
    const m = (x, y, z) => [(x + X0) * K, y * K, z * K];
    B.table(F, -0.62 * K, 0.62 * K, -0.22 * K, 0.20 * K, 0, { legs: false, tone: '#6E4A2C', seed: 29, thick: 0.08 });
    // the graduated backboard behind the tubes, zero at the pipe axis
    R3.texPlane(F, m(0.425, 0.05, Z + 0.25), [0.45 * K, 0, 0], [0, 0, -0.25 * K], boardTex(), { grid: 4, bias: 0.05 });
    // pipe supports
    [0.08, 0.77].forEach(x => R3.box(F, m(x, 0, Z / 2), [0.02 * K, 0.03 * K, Z * K], '#3A4458', { shadow: false }));
    // the pipe: a glass wall and the liquid inside, as outlines swept along x
    const lc = V.F.col;
    const samples = [];
    for (let i = 0; i <= 90; i++) samples.push(VX[5] * i / 90);
    const outline = (rOf, fill, stroke, bias, alpha) => {
      const mid = m(0.425, 0, Z);
      F.push(mid, () => {
        const A0 = cam.project(m(0, 0, Z)), A1 = cam.project(m(VX[5], 0, Z));
        if (!A0.ok || !A1.ok) return;
        const ax = { x: A1.x - A0.x, y: A1.y - A0.y }, al = Math.hypot(ax.x, ax.y) || 1, nx = -ax.y / al, ny = ax.x / al;
        const top = [], bot = [];
        for (const x of samples) {
          const r = rOf(x);
          let hi = null, lo = null, dH = -Infinity, dL = Infinity;
          for (let k = 0; k < 16; k++) {
            const a = k / 16 * TAU, q = cam.project(m(x, r * Math.cos(a), Z + r * Math.sin(a)));
            if (!q.ok) continue;
            const d = (q.x - A0.x) * nx + (q.y - A0.y) * ny;
            if (d > dH) { dH = d; hi = q; } if (d < dL) { dL = d; lo = q; }
          }
          if (hi) top.push(hi); if (lo) bot.push(lo);
        }
        const poly = top.concat(bot.reverse());
        ctx.save();
        if (fill) { ctx.fillStyle = fill; polyPath(ctx, poly); ctx.fill(); }
        if (stroke) { ctx.strokeStyle = stroke; ctx.lineWidth = 1; polyPath(ctx, poly); ctx.stroke(); }
        ctx.restore();
      }, bias);
    };
    outline(x => ventD(x, V.D1, V.D2) / 2, RX.rgba(lc, 0.55), null, -0.01);
    // dye tracers: plug flow if turbulent, a parabola across the pipe if laminar
    if (!S.dye) {
      S.dye = [];
      for (let i = 0; i < 150; i++) S.dye.push({ x: Math.random() * VX[5], f: Math.sqrt(Math.random()) * 0.92, a: Math.random() * TAU });
    }
    const dyeItems = [];
    S.dye.forEach(d => {
      const R0 = ventD(d.x, V.D1, V.D2) / 2, rr = d.f * R0;
      dyeItems.push(m(d.x, rr * Math.cos(d.a), Z + rr * Math.sin(d.a)));
    });
    F.push(m(0.425, 0, Z), () => {
      ctx.fillStyle = 'rgba(255,255,255,.85)';
      dyeItems.forEach(pt => { const q = cam.project(pt); if (q.ok) { ctx.beginPath(); ctx.arc(q.x, q.y, 1.3, 0, TAU); ctx.fill(); } });
    }, -0.012);
    outline(x => ventD(x, V.D1, V.D2) / 2 + 0.003, 'rgba(190,225,245,.10)', 'rgba(215,238,255,.6)', -0.03);
    // flanges at the ends, the flow meter at the inlet and the valve at the outlet
    [0, VX[5]].forEach(x => R3.cylinder(F, m(x - 0.006, 0, Z), m(x + 0.006, 0, Z), (V.D1 / 2 + 0.012) * K, '#8C98AA', { segments: 22, shadow: false }));
    B.meter(F, m(-0.02, -0.06, Z + 0.12), [0, -1, 0], 0.26, 0.12, { title: 'FLOW', value: p.Qlpm.toFixed(1), unit: 'L/min', colour: '#7CF0B0' });
    R3.cylinder(F, m(VX[5] + 0.03, 0, Z), m(VX[5] + 0.03, 0, Z + 0.07), 0.006 * K, '#9AA6B8', { segments: 10, shadow: false });
    R3.cylinder(F, m(VX[5] + 0.03, -0.02, Z + 0.07), m(VX[5] + 0.03, 0.02, Z + 0.07), 0.03 * K, '#C0392B', { segments: 20, shadow: false, inner: 0.024 * K });
    // manometer tubes: the liquid column stands at the pressure head of its tap
    const tubeTop = Z + 0.48;
    V.st.forEach((s, i) => {
      const rTop = ventD(s.x, V.D1, V.D2) / 2;
      const zBase = Z + rTop, zCol = Z + s.h;
      const tubeR = 0.0045;
      // the tube
      path3(F, [m(s.x, 0, zBase), m(s.x, 0, tubeTop)], '#DCEBFA', { alpha: 0.35, width: 6, chunk: 1, bias: -0.02 });
      if (s.h > rTop) {
        path3(F, [m(s.x, 0, zBase), m(s.x, 0, Math.min(tubeTop, zCol))], lc, { alpha: 0.9, width: 4, chunk: 1, bias: -0.021 });
        R3.label(F, m(s.x, 0, Math.min(tubeTop, zCol)), zCol > tubeTop ? '↑ ' + (s.h * 100).toFixed(0) + ' cm' : (s.h * 100).toFixed(1), zCol > tubeTop ? '#FFB36B' : '#E8F4FF', { size: 9, dy: -9 - i % 2 * 11 });
      } else {
        // below the top of the pipe: the tap is at suction and draws air in
        for (let k = 0; k < 5; k++) {
          const ph = ((g.now / 1000) * 0.9 + k / 5) % 1, pt = m(s.x, 0, zBase + 0.05 * (1 - ph));
          F.push(pt, () => { const q = cam.project(pt); if (!q.ok) return; ctx.strokeStyle = 'rgba(255,255,255,.8)'; ctx.lineWidth = 1; ctx.beginPath(); ctx.arc(q.x, q.y, 2.2, 0, TAU); ctx.stroke(); }, -0.03);
        }
        R3.label(F, m(s.x, 0, zBase + 0.06), 'sucks air', '#FF8A6B', { size: 9, dy: -8 });
      }
      void tubeR;
    });
    // the hydraulic grade line through the column tops, and the energy line above it
    const hgl = V.st.map(s => m(s.x, 0.004, Z + s.h)), egl = V.st.map(s => m(s.x, 0.004, Z + s.h + s.v * s.v / (2 * GF)));
    const onBoard = V.st.every(s => Z + s.h + s.v * s.v / (2 * GF) < tubeTop + 0.02);
    if (onBoard) {
    path3(F, hgl, '#7CF0B0', { alpha: 0.8, width: 1.2, dash: [4, 3], chunk: 1, bias: -0.025 });
    path3(F, egl, '#F5B451', { alpha: 0.9, width: 1.4, dash: [6, 3], chunk: 1, bias: -0.025 });
    R3.label(F, egl[egl.length - 1], 'energy line  p/ρg + v²/2g', '#F5B451', { size: 9, align: 'left', dx: 8 });
    R3.label(F, hgl[hgl.length - 1], 'pressure line  p/ρg', '#7CF0B0', { size: 9, align: 'left', dx: 8, dy: 10 });
    }
    if (V.cav) {
      const tz = m(0.39, 0, Z);
      F.push(tz, () => {
        const q = cam.project(tz); if (!q.ok) return;
        for (let k = 0; k < 14; k++) { ctx.strokeStyle = 'rgba(255,255,255,.9)'; ctx.beginPath(); ctx.arc(q.x - 20 + (k * 37 % 40), q.y - 5 + (k * 13 % 10), 1.5 + (k % 3), 0, TAU); ctx.stroke(); }
      }, -0.03);
      R3.label(F, tz, 'CAVITATION — the water boils cold', '#FF6B6B', { size: 10, dy: 26 });
    }
    F.render();
    // the dye moves at the local speed; a laminar flow shears it across the pipe
    const dt = Math.min(0.05, g.dt || 0.016) * (p.run ? 0.35 : 0);
    S.dye.forEach(d => {
      const Dx = ventD(d.x, V.D1, V.D2), vm = V.Q / (Math.PI * Dx * Dx / 4);
      const u = V.laminar ? 2 * vm * (1 - d.f * d.f) : vm * 1.22 * Math.pow(Math.max(0.02, 1 - d.f), 1 / 7);
      d.x += u * dt; if (d.x > VX[5]) d.x -= VX[5];
    });
    header(g, V.cav ? 'Cavitation at the throat' : V.st.some(s => s.h < ventD(s.x, V.D1, V.D2) / 2) ? 'The throat is below atmospheric — it sucks' : 'Faster in the throat, lower in pressure',
      V.F.name + ' · Q = ' + p.Qlpm.toFixed(1) + ' L/min · v ' + V.v1.toFixed(2) + ' → ' + V.v2.toFixed(2) + ' m/s · Re ' + V.Re1.toFixed(0) + ' (' + (V.laminar ? 'laminar' : 'turbulent') + ')',
      p.loss ? 'Bernoulli marched along the pipe with friction f(Re) and the diffuser loss' : 'ideal: Bernoulli alone — no friction anywhere', th.text);
    const rows = narrow ? 4 : 6, bw = narrow ? W - 24 : 280, bh = 26 + rows * 15 + 10;
    const row = gPanel(g, 12, H - bh - 30, bw, bh, 'THE VENTURI READING');
    row(0, 'Δh, inlet − throat', (V.dh * 100).toFixed(2) + ' cm', th.phys);
    row(1, 'Q from Δh, A₂√(2gΔh/(1 − β⁴))', (V.Qv * 6e4).toFixed(3) + ' L/min');
    row(2, 'Q really flowing', p.Qlpm.toFixed(3) + ' L/min');
    row(3, 'discharge coefficient Cd', V.Cd.toFixed(4), V.Cd < 0.9 ? th.warn : th.ok);
    if (!narrow) {
      row(4, 'head lost, inlet to exit', (V.lossHead * 100).toFixed(2) + ' cm');
      row(5, 'throat, absolute', V.cav ? 'boils at ' + (V.F.pv / 1000).toFixed(2) + ' kPa' : (V.pAbsThroat / 1000).toFixed(1) + ' kPa', V.cav ? th.crit : undefined);
    }
  }

  /* ======================= 3 · the falling-ball viscometer ======================= */
  function drawBall(S, g) {
    const ctx = g.ctx, th = g.theme, p = S.p, W = g.w, H = g.h, Bl = S.Bl, cam = S.cam;
    const narrow = W < 660, K = 3.0, B = window.BENCH;
    const F = R3.Frame(ctx, cam, { ambient: 0.3, floorZ: 0 });
    const m = (x, y, z) => [x * K, y * K, z * K];
    B.table(F, -0.30 * K, 0.30 * K, -0.18 * K, 0.18 * K, 0, { legs: false, tone: '#6E4A2C', seed: 31, thick: 0.08 });
    const z0 = 0.02, zS = z0 + COLUMN + 0.01;             // tube floor and the liquid surface
    R3.cylinder(F, m(0, 0, 0), m(0, 0, z0), 0.05 * K, '#2A3142', { segments: 36, shadow: false });
    const now = ballAt(Bl, S.ts);
    const depth = now[1];
    // the ball, drawn at least 2.5 mm so it can be followed; the inset shows it true
    const rDraw = Math.max(Bl.r, 0.0025);
    const bz = zS - depth - Bl.r;
    R3.sphere(F, m(0, 0, bz), rDraw * K, Bl.Sd.col, { shadow: false });
    // its trail, in the liquid
    const tr = [];
    for (let k = 0; k <= 20; k++) { const q = ballAt(Bl, Math.max(0, S.ts - k * 0.04 * Math.max(1, Bl.tEnd / 20))); tr.push(m(0, 0, zS - q[1] - Bl.r)); }
    path3(F, tr, '#FFFFFF', { alpha: 0.25, width: 1, chunk: 4, bias: 0.001 });
    liquidCyl(F, m(0, 0, z0), TUBE_D / 2 * K, (zS - z0) * K, Bl.Lq.col, { alpha: 0.42 });
    glassCyl(F, m(0, 0, z0), (TUBE_D / 2 + 0.004) * K, (COLUMN + 0.06) * K);
    // the light gates: a U-frame round the tube with a beam across
    [GATE1, GATE2].forEach((gd, i) => {
      const gz = zS - gd, hit = (i === 0 ? Bl.t1 : Bl.t2) > 0 && S.ts >= (i === 0 ? Bl.t1 : Bl.t2) && S.ts < (i === 0 ? Bl.t1 : Bl.t2) + 0.25 * Math.max(0.2, Bl.tEnd / 30);
      R3.box(F, m(0, -0.045, gz), [0.012 * K, 0.012 * K, 0.03 * K], '#2F3A52', { shadow: false });
      R3.box(F, m(0, 0.045, gz), [0.012 * K, 0.012 * K, 0.03 * K], '#2F3A52', { shadow: false });
      R3.box(F, m(0.05, 0, gz), [0.012 * K, 0.10 * K, 0.012 * K], '#2F3A52', { shadow: false });
      path3(F, [m(0, -0.04, gz), m(0, 0.04, gz)], hit ? '#FF2020' : '#FF6060', { alpha: hit ? 1 : 0.8, width: hit ? 2.5 : 1.3, glow: hit ? 10 : 4, chunk: 1, bias: -0.05 });
      R3.label(F, m(-0.03, -0.05, gz), 'gate ' + (i + 1) + ' · ' + (gd * 100).toFixed(0) + ' cm down', '#FF9A9A', { size: 9, align: 'right', dx: -6 });
    });
    // a rule beside the tube, zero at the surface
    B.rule(F, m(-0.075, -0.02, zS), [0, 0, -1], 0.55, { k: K, width: 0.035 * K, up: [0, -1, 0] });
    // the timer on a stand behind
    const tA = Bl.t1 && S.ts >= Bl.t1 ? (Math.min(S.ts, Bl.t2 || S.ts) - Bl.t1) : 0;
    B.meter(F, m(0.16, 0.06, 0.34), [-0.4, -1, 0], 0.30, 0.14, { title: 'GATE 1 → 2', value: tA.toFixed(3), unit: 's', colour: '#FF8080' });
    R3.box(F, m(0.16, 0.08, 0.17), [0.015 * K, 0.015 * K, 0.34 * K], '#2F3A52', { shadow: false });
    F.render();

    // the inset: the ball true to size, the flow round it, and the three forces
    const ix = narrow ? 12 : W - 214, iy = 70, iw = 200, ih = 200;
    ctx.save();
    ctx.fillStyle = g.alpha('#0B1020', .92); ctx.strokeStyle = g.alpha(th.line, 1);
    ctx.beginPath(); ctx.roundRect(ix, iy, iw, ih, 8); ctx.fill(); ctx.stroke();
    PA.lbl(ctx, ix + 10, iy + 13, 'THE BALL · Re = ' + (Bl.ReT < 0.1 ? Bl.ReT.toExponential(1) : Bl.ReT.toFixed(Bl.ReT < 10 ? 2 : 0)), th['text-3'], 'left', 8.5);
    const cx = ix + iw / 2, cy = iy + ih / 2 + 8, a = 34;
    ctx.beginPath(); ctx.rect(ix + 2, iy + 22, iw - 4, ih - 26); ctx.clip();
    ctx.fillStyle = RX.rgba(Bl.Lq.col, 0.18); ctx.fillRect(ix, iy, iw, ih);
    // Stokes streamlines in the ball's frame: ψ = ½U sin²θ (r² − 3ar/2 + a³/2r)
    if (Bl.ReT < 5) {
      ctx.strokeStyle = 'rgba(220,240,255,.45)'; ctx.lineWidth = 0.9;
      [-3, -2, -1.2, -0.6, -0.25, 0.25, 0.6, 1.2, 2, 3].forEach(k => {
        const psi = k * a * a * 0.5;
        ctx.beginPath(); let first = true;
        for (let yy = -95; yy <= 95; yy += 2) {
          // solve for x at this height where ψ(x, y) = psi (x > 0 side, mirrored), by bisection on ρ = |x|
          let lo = 0, hi = 120, ok = false;
          const f = (xx) => { const r = Math.hypot(xx, yy); if (r < a) return -1e9; const s2 = (xx * xx) / (r * r); return 0.5 * s2 * (r * r - 1.5 * a * r + a * a * a / (2 * r)) - Math.abs(psi); };
          if (f(hi) > 0) { for (let it = 0; it < 30; it++) { const mid = (lo + hi) / 2; if (f(mid) > 0) hi = mid; else lo = mid; } ok = true; }
          if (!ok) { first = true; continue; }
          const xx = Math.sign(k) * hi;
          first ? ctx.moveTo(cx + xx, cy + yy) : ctx.lineTo(cx + xx, cy + yy); first = false;
        }
        ctx.stroke();
      });
    } else {
      // a wake: separated flow behind the ball
      for (let k = 0; k < 16; k++) {
        const ph = ((g.now / 1000) * 0.7 + k / 16) % 1;
        ctx.strokeStyle = 'rgba(220,240,255,' + (0.5 * (1 - ph)).toFixed(3) + ')';
        ctx.beginPath(); ctx.arc(cx + (k % 2 ? 1 : -1) * (10 + ph * 10), cy - a - 6 - ph * 60, 4 + ph * 8, 0, TAU); ctx.stroke();
      }
    }
    const bg = ctx.createRadialGradient(cx - 10, cy - 10, 2, cx, cy, a);
    bg.addColorStop(0, '#FFFFFF'); bg.addColorStop(0.4, Bl.Sd.col); bg.addColorStop(1, RX.mix(Bl.Sd.col, '#05080F', 0.6));
    ctx.fillStyle = bg; ctx.beginPath(); ctx.arc(cx, cy, a, 0, TAU); ctx.fill();
    const Wt = Bl.m * GF, Bu = Bl.rho * (4 / 3) * Math.PI * Math.pow(Bl.r, 3) * GF, v = now[2];
    const Fd = Math.max(0, Wt - Bu - (Bl.m + Bl.madd) * 0);  // at the current speed, from the drag law
    const drag = v > 0 ? 0.5 * Bl.rho * v * v * Math.PI * Bl.r * Bl.r * sphereCd(Bl.rho * v * 2 * Bl.r / Bl.eta) / Bl.kw : 0;
    const sc = 70 / Wt;
    const arr = (x0, y0, dy, col, lab) => { if (Math.abs(dy) < 2) return;
      ctx.strokeStyle = col; ctx.lineWidth = 2.2; ctx.beginPath(); ctx.moveTo(x0, y0); ctx.lineTo(x0, y0 + dy); ctx.stroke();
      ctx.fillStyle = col; ctx.beginPath(); ctx.moveTo(x0, y0 + dy); ctx.lineTo(x0 - 5, y0 + dy - Math.sign(dy) * 8); ctx.lineTo(x0 + 5, y0 + dy - Math.sign(dy) * 8); ctx.fill();
      const side = x0 < cx ? -1 : x0 > cx ? 1 : 1;
      PA.lbl(ctx, x0 + side * (a * 0.35 + 8), y0 + dy * 0.9, lab, col, side < 0 ? 'right' : 'left', 9); };
    arr(cx, cy + a, Wt * sc * 0.6, '#F5B451', 'weight');
    arr(cx - 20, cy - a, -Bu * sc, '#7FD0FF', 'upthrust');
    arr(cx + 20, cy - a, -drag * sc, '#7CF0B0', 'drag');
    void Fd;
    ctx.restore();
    PA.lbl(ctx, ix + 10, iy + ih - 10, 'r = ' + p.rmm.toFixed(2) + ' mm · v = ' + (v * 100).toFixed(3) + ' cm/s', th['text-2'], 'left', 9);

    header(g, Bl.floats ? 'The ball floats — it is lighter than the liquid' : Bl.ReT < 0.2 ? 'Creeping flow · Stokes holds' : Bl.ReT < 2 ? 'Re near 1 · Stokes starts to fail' : 'Re ≫ 1 · Stokes\' law does not apply',
      Bl.Sd.name + ' ball ⌀ ' + (2 * p.rmm).toFixed(1) + ' mm in ' + Bl.Lq.name + ' at ' + p.TC.toFixed(0) + ' °C · η = ' + Bl.eta.toPrecision(3) + ' Pa·s · tube ⌀ 50 mm',
      'weight − upthrust − drag, with Cd(Re) and the added mass · ' + (p.wall ? 'wall correction ON' : 'no wall'), Bl.ReT < 0.2 ? th.ok : th.warn);
    const rows = narrow ? 4 : 7, bw = narrow ? W - 24 : 286, bh = 26 + rows * 15 + 10;
    const row = gPanel(g, 12, H - bh - 30, bw, bh, 'FROM THE TWO GATES');
    const done = Bl.t2 > 0 && S.ts >= Bl.t2;
    row(0, 'time between the gates', done ? (Bl.t2 - Bl.t1).toFixed(3) + ' s' : 'falling…', th.phys);
    row(1, 'v = 30.0 cm ÷ t', done ? (Bl.vMeas * 100).toFixed(4) + ' cm/s' : '—');
    row(2, 'η = 2r²(ρ − σ)g / 9v', done ? Bl.etaMeas.toPrecision(4) + ' Pa·s' : '—', th.warn);
    row(3, 'true η of the liquid', Bl.eta.toPrecision(4) + ' Pa·s');
    if (!narrow) {
      row(4, 'η × wall factor ' + Bl.kw.toFixed(3), done ? (Bl.etaMeas * Bl.kw).toPrecision(4) + ' Pa·s' : '—', th.ok);
      row(5, 'terminal by 99 % after', isFinite(Bl.x99) ? (Bl.x99 * 1000).toFixed(Bl.x99 < 0.01 ? 2 : 0) + ' mm of fall' : 'not within the tube', Bl.x99 > GATE1 ? th.crit : undefined);
      row(6, 'Reynolds number 2rvρ/η', Bl.ReT.toPrecision(3), Bl.ReT < 0.2 ? th.ok : th.warn);
    }
  }

  /* ======================= 4 · Archimedes on a spring balance ======================= */
  function drawBuoy(S, g) {
    const ctx = g.ctx, th = g.theme, p = S.p, W = g.w, H = g.h, cam = S.cam;
    const narrow = W < 660, K = 6, B = window.BENCH;
    const F = R3.Frame(ctx, cam, { ambient: 0.3, floorZ: 0 });
    const m = (x, y, z) => [x * K, y * K, z * K];
    B.table(F, -0.20 * K, 0.20 * K, -0.12 * K, 0.14 * K, 0, { legs: false, tone: '#7A5230', seed: 37, thick: 0.05 });
    // released? then the block moves on its own; otherwise it hangs where the hook puts it
    let st = S.bs, zb = st.zb;
    if (p.cut && S.rel) {
      const P = S.rel.pts, i = Math.min(P.length - 1, Math.floor(S.ts / 0.002));
      zb = P[i][1];
      const Ab = st.Ab, a2 = BK.a * BK.a, Vl = st.Vl;
      let Hl = Vl / Ab; if (Hl > zb) { Hl = (Vl - a2 * zb) / (Ab - a2); if (Hl > zb + BK.a) Hl = (Vl + a2 * BK.a) / Ab; }
      st = Object.assign({}, st, { zb, Hl, sub: clamp(Hl - zb, 0, BK.a), T: 0 });
    }
    const zF = 0.045;                                       // the beaker floor, on top of the scale
    // the digital scale
    B.texBox(F, m(0, 0, 0.018), [0.16 * K, 0.14 * K, 0.036 * K], B.metal('#2B3242', 43), { ambient: 0.45 });
    R3.box(F, m(0, 0, 0.038), [0.13 * K, 0.12 * K, 0.004 * K], '#9AA6B8', { shadow: false });
    const scaleG = (p.cut ? (BK.mB + st.mLiq) * 1000 + st.m * 1000 : st.scaleN / GF * 1000);
    B.meter(F, m(0, -0.071, 0.018), [0, -1, 0], 0.09, 0.028, { title: 'SCALE', value: scaleG.toFixed(1), unit: 'g', colour: '#7CF0B0', depth: 0.004 });
    // the block (drawn before the liquid so it shows through it)
    const a = BK.a, bc = m(0, 0, zF + zb + a / 2);
    const Sd = st.S;
    if (p.block === 'wood') B.texBox(F, bc, [a * K, a * K, a * K], B.wood('#B98A52', 47), { ambient: 0.45 });
    else if (p.block === 'aluminium' || p.block === 'iron') B.texBox(F, bc, [a * K, a * K, a * K], B.metal(Sd.col, 49), { ambient: 0.45 });
    else R3.box(F, bc, [a * K, a * K, a * K], Sd.col, { shadow: false, ambient: 0.55 });
    // the liquid and the beaker, with its millilitre graduations
    liquidCyl(F, m(0, 0, zF), BK.D / 2 * K, st.Hl * K, st.L.col, { alpha: p.liq === 'mercury' ? 0.92 : 0.45, metal: p.liq === 'mercury' });
    glassCyl(F, m(0, 0, zF - 0.004), (BK.D / 2 + 0.003) * K, (BK.H + 0.004) * K, {
      ticks: (c) => {
        const Ab = Math.PI * BK.D * BK.D / 4;
        for (let ml = 100; ml <= 1200; ml += 50) {
          const hz = ml * 1e-6 / Ab; if (hz > BK.H - 0.005) break;
          const q0 = cam.project(m(-(BK.D / 2 + 0.003) * 0.42, -(BK.D / 2 + 0.003) * 0.9, zF + hz)), q1 = cam.project(m(-(BK.D / 2 + 0.003) * 0.12, -(BK.D / 2 + 0.003) * 0.99, zF + hz));
          if (!q0.ok || !q1.ok) continue;
          c.strokeStyle = 'rgba(240,248,255,' + (ml % 100 ? 0.4 : 0.85) + ')'; c.lineWidth = 1;
          c.beginPath(); c.moveTo(q0.x, q0.y); c.lineTo(ml % 100 ? (q0.x + q1.x) / 2 : q1.x, ml % 100 ? (q0.y + q1.y) / 2 : q1.y); c.stroke();
          if (ml % 200 === 0) { c.fillStyle = 'rgba(240,248,255,.85)'; c.font = '600 8px "IBM Plex Mono",monospace'; c.textAlign = 'right'; c.fillText(ml + ' mL', q0.x - 3, q0.y + 3); }
        }
      } });
    // stand, boss and the spring balance
    const rodX = -0.13, zTopB = 0.52;
    R3.box(F, m(rodX + 0.02, 0.06, 0.006), [0.12 * K, 0.10 * K, 0.012 * K], '#2C3445', { shadow: false });
    R3.cylinder(F, m(rodX, 0.06, 0.012), m(rodX, 0.06, zTopB + 0.04), 0.006 * K, '#B8C2D0', { segments: 14, shadow: false });
    R3.box(F, m(rodX / 2, 0.03, zTopB + 0.02), [Math.abs(rodX) * K, 0.012 * K, 0.012 * K], '#9AA6B8', { shadow: false });
    B.bossClamp(F, m(rodX, 0.06, zTopB + 0.02));
    const kS = 10 / 0.08;                                   // 10 N stretches it 8 cm
    const Tn = p.cut ? 0 : st.T;
    const ext = Tn / kS;
    const top = zTopB, bodyL = 0.13, zPtr = top - 0.012 - ext - 0.02;
    glassCyl(F, m(0, 0, top - bodyL), 0.014 * K, bodyL * K, { tint: 'rgba(200,225,245,.12)', bias: -0.01,
      ticks: (c) => {
        for (let n = 0; n <= 10; n++) {
          const zz = top - 0.012 - 0.02 - n * 0.008;
          const q0 = cam.project(m(0.004, -0.0145, zz)), q1 = cam.project(m(0.010, -0.013, zz));
          if (!q0.ok || !q1.ok) continue;
          c.strokeStyle = 'rgba(255,240,200,.85)'; c.lineWidth = n % 5 ? 0.8 : 1.4;
          c.beginPath(); c.moveTo(q0.x, q0.y); c.lineTo(q1.x, q1.y); c.stroke();
          if (n % 2 === 0) { c.fillStyle = 'rgba(255,240,200,.9)'; c.font = '600 7.5px "IBM Plex Mono",monospace'; c.textAlign = 'left'; c.fillText(String(n), q1.x + 3, q1.y + 3); }
        }
      } });
    R3.cylinder(F, m(0, 0, top), m(0, 0, top + 0.008), 0.016 * K, '#C9A04A', { segments: 18, shadow: false });
    B.spring(F, m(0, 0, top - 0.004), m(0, 0, zPtr + 0.002), 0.008 * K, 14, { colour: '#D8DEE8' });
    R3.cylinder(F, m(0, 0, zPtr - 0.002), m(0, 0, zPtr + 0.002), 0.0125 * K, '#FF6B6B', { segments: 16, shadow: false });
    R3.cylinder(F, m(0, 0, zPtr), m(0, 0, top - bodyL - 0.012), 0.0018 * K, '#C9D2DE', { segments: 8, shadow: false });
    const hookZ = top - bodyL - 0.014;
    if (!p.cut && !st.floating && !st.resting) B.string(F, [m(0, 0, hookZ), m(0, 0, zF + zb + a)], { r: 0.0012 * K });
    else if (!p.cut) B.string(F, [m(0, 0, hookZ), m(0.01, 0, (hookZ + zF + zb + a) / 2), m(0, 0, zF + zb + a)], { r: 0.0012 * K });
    R3.callout(F, m(0.015, 0, zPtr), 34, -6, (Tn).toFixed(3) + ' N', '#FF9A9A', { size: 10.5 });
    R3.callout(F, bc, 60, -34, Sd.name + ' · ' + Sd.rho + ' kg/m³', '#C9D4EA', { size: 9.5 });
    R3.callout(F, m(BK.D / 2, 0, zF + st.Hl), 36, 14, st.L.name + ' · ' + st.L.rho + ' kg/m³', '#9AD0FF', { size: 9.5 });
    F.render();

    const hq = cam.project(m(0, 0, hookZ)), hq2 = cam.project(m(0, 0, hookZ - 0.05));
    if (hq.ok && hq2.ok && !p.cut) { S._axB = axis2(hq, hq2, 0.05); ringHandle(g, hq, 'hook', '#F5B451'); }

    const state = p.cut ? (st.S.rho < st.L.rho ? 'Released · it bobs, then floats' : 'Released · it sinks to the bottom')
      : st.floating ? 'It floats — the string has gone slack' : st.resting ? 'Resting on the bottom' : st.sub > 0 ? 'Partly or fully under · the balance reads less' : 'Hanging in air';
    header(g, state,
      'block 5 cm cube, W = ' + st.W.toFixed(3) + ' N · beaker ⌀ 10 cm · level ' + (st.Hl * 100).toFixed(2) + ' cm (was ' + (BK.liqH * 100).toFixed(1) + ')',
      'the level is solved as the block goes in: A_beaker·H = V_liquid + V_under', th.text);
    const rows = narrow ? 4 : 7, bw = narrow ? W - 24 : 280, bh = 26 + rows * 15 + 10;
    const row = gPanel(g, 12, H - bh - 30, bw, bh, 'THE TWO READINGS');
    row(0, 'spring balance', (p.cut ? 0 : st.T).toFixed(3) + ' N', th.phys);
    row(1, 'upthrust ρ·V_under·g', st.B.toFixed(3) + ' N');
    row(2, 'weight lost = upthrust?', (st.W - (p.cut ? 0 : st.T)).toFixed(3) + ' N', th.ok);
    row(3, 'scale gained', ((scaleG / 1000 - BK.mB - st.mLiq) * GF).toFixed(3) + ' N', th.ok);
    if (!narrow) {
      row(4, 'fraction under the surface', (st.sub / BK.a * 100).toFixed(1) + ' %');
      row(5, 'ρ_block / ρ_liquid', (st.S.rho / st.L.rho).toFixed(3), st.S.rho < st.L.rho ? th.ok : th.warn);
      if (p.cut && S.rel && S.rel.floats) row(6, 'bob period · textbook 2π√(h/g)', (S.rel.Tm ? S.rel.Tm.toFixed(3) : '—') + ' · ' + S.rel.Ttext.toFixed(3) + ' s');
      else row(6, 'liquid level rose by', ((st.Hl - BK.liqH) * 1000).toFixed(2) + ' mm');
    }
  }

  /* ======================= 5 · capillaries ======================= */
  function drawCap(S, g) {
    const ctx = g.ctx, th = g.theme, p = S.p, W = g.w, H = g.h, C = S.C, cam = S.cam;
    const narrow = W < 660, K = 8, B = window.BENCH;
    const F = R3.Frame(ctx, cam, { ambient: 0.3, floorZ: 0 });
    const m = (x, y, z) => [x * K, y * K, z * K];
    B.table(F, -0.14 * K, 0.14 * K, -0.10 * K, 0.10 * K, 0, { legs: false, tone: '#6E4A2C', seed: 53, thick: 0.03 });
    const zL = 0.03, lc = C.L.col, hg = p.cliq === 'mercury';
    // the trough (a wide glass dish)
    liquidCyl(F, m(0, 0, 0.004), 0.075 * K, (zL - 0.004) * K, lc, { alpha: hg ? 0.92 : 0.45, metal: hg, bias: -0.015 });
    glassCyl(F, m(0, 0, 0.002), 0.078 * K, 0.045 * K, { bias: -0.02 });
    // three capillaries, drawn wider than life so the column can be seen
    const xs = [-0.035, 0, 0.035];
    const tnow = S.ts;
    const tops = [];
    C.tubes.forEach((tb, i) => {
      const h = capAt(tb, tnow), x = xs[i];
      const rV = 0.0016 + i * 0.0012;                     // visual radius
      const zBot = zL - 0.012, zTop = zL + C.Lmax;
      // the column inside: up to zL + h (below the outside level if depressed)
      const zCol = zL + h;
      if (zCol > zBot) liquidCyl(F, m(x, 0, zBot), rV * K, (zCol - zBot) * K, lc, { alpha: hg ? 0.95 : 0.7, metal: hg, bias: -0.016 });
      glassCyl(F, m(x, 0, zBot), (rV + 0.0008) * K, (zTop - zBot) * K, { bias: -0.03 });
      tops.push([x, zCol, rV, tb]);
      R3.label(F, m(x, 0, zTop + 0.006 + i * 0.009), 'r = ' + (tb.r * 1000).toFixed(2) + ' mm', '#C9D4EA', { size: 9 });
      R3.callout(F, m(x + rV, -rV, zCol), i === 2 ? 30 : -30, -10, (h * 100).toFixed(2) + ' cm', '#7CF0B0', { size: 9.5 });
    });
    // the clamp bar holding them, and a rule behind, zero at the outside surface
    R3.box(F, m(0, 0.006, zL + C.Lmax - 0.01), [0.11 * K, 0.006 * K, 0.008 * K], '#3A4458', { shadow: false });
    B.rule(F, m(0.055, 0.01, zL), [0, 0, 1], 0.16, { k: K, width: 0.02 * K, up: [0, -1, 0], flip: true });
    F.render();

    // the magnified meniscus of the narrowest tube, with the forces that hold the column
    const tb = C.tubes[0];
    const ix = narrow ? 12 : W - 214, iy = 70, iw = 200, ih = 190;
    ctx.save();
    ctx.fillStyle = g.alpha('#0B1020', .92); ctx.strokeStyle = g.alpha(th.line, 1);
    ctx.beginPath(); ctx.roundRect(ix, iy, iw, ih, 8); ctx.fill(); ctx.stroke();
    PA.lbl(ctx, ix + 10, iy + 13, 'MENISCUS · r = ' + (tb.r * 1000).toFixed(2) + ' mm (magnified)', th['text-3'], 'left', 8.5);
    const cx = ix + iw / 2, wR = 60, yM = iy + 90;
    const thE = tb.capped ? tb.thetaEff : C.theta;
    // tube walls
    ctx.fillStyle = 'rgba(190,225,245,.25)'; ctx.fillRect(cx - wR - 10, iy + 26, 10, ih - 32); ctx.fillRect(cx + wR, iy + 26, 10, ih - 32);
    // liquid with a curved surface: a circular cap meeting the wall at θ
    // a circular cap meeting the wall at θ: its depth keeps the sign of cos θ (a hollow for wetting, a dome for mercury)
    const cth = Math.cos(thE), sag = Math.abs(cth) < 0.03 ? 0 : wR * (1 - Math.sin(thE)) / cth;
    ctx.fillStyle = RX.rgba(lc, hg ? 0.95 : 0.6);
    ctx.beginPath(); ctx.moveTo(cx - wR, iy + ih - 6);
    ctx.lineTo(cx - wR, yM);
    ctx.quadraticCurveTo(cx, yM + 2 * sag * (Math.cos(thE) >= 0 ? 1 : 1), cx + wR, yM);
    ctx.lineTo(cx + wR, iy + ih - 6); ctx.closePath(); ctx.fill();
    // contact angle and the surface tension pulling along the surface at the wall
    const ang = Math.PI / 2 - thE;                           // direction of T at the right wall, measured from vertical
    const tx = -Math.sin(thE), ty = -Math.cos(thE);           // unit vector along the surface, into the liquid side at the right wall
    void ang;
    const arrow = (x0, y0, dx, dy, col, lab) => {
      ctx.strokeStyle = col; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(x0, y0); ctx.lineTo(x0 + dx, y0 + dy); ctx.stroke();
      const l = Math.hypot(dx, dy) || 1, ux = dx / l, uy = dy / l;
      ctx.fillStyle = col; ctx.beginPath(); ctx.moveTo(x0 + dx, y0 + dy); ctx.lineTo(x0 + dx - ux * 7 - uy * 4, y0 + dy - uy * 7 + ux * 4); ctx.lineTo(x0 + dx - ux * 7 + uy * 4, y0 + dy - uy * 7 - ux * 4); ctx.fill();
      if (lab) PA.lbl(ctx, x0 + dx + (dx < 0 ? -4 : 4), y0 + dy - 4, lab, col, dx < 0 ? 'right' : 'left', 9);
    };
    // on the liquid, the wall pulls up along the wall's tangent at angle θ: T cos θ up
    arrow(cx + wR, yM, 0, -40 * Math.cos(thE), '#7CF0B0', '');
    PA.lbl(ctx, cx, iy + 36, '↑ T cos θ at the wall, all round', '#7CF0B0', 'center', 9);
    arrow(cx - wR, yM, 0, -40 * Math.cos(thE), '#7CF0B0', '');
    arrow(cx, yM + 30, 0, 40, '#F5B451', 'weight of column');
    void tx; void ty;
    // the angle between the wall (going down into the liquid) and the surface
    ctx.strokeStyle = '#FFD36B'; ctx.lineWidth = 1.2;
    ctx.beginPath(); ctx.arc(cx + wR, yM, 16, Math.PI / 2, Math.PI / 2 + thE); ctx.stroke();
    PA.lbl(ctx, cx + wR - 20, yM + 24, 'θ = ' + (thE * 180 / Math.PI).toFixed(0) + '°', '#FFD36B', 'right', 10);
    ctx.restore();
    PA.lbl(ctx, ix + iw / 2, iy + ih + 12, tb.capped ? 'too short: θ grows till the pull = the weight' : '2πrT cos θ = πr²hρg', tb.capped ? th.warn : th['text-2'], 'center', 9);

    const Lq = C.L;
    header(g, C.theta > Math.PI / 2 ? 'The liquid is pushed DOWN — it does not wet the glass' : C.tubes.some(t => t.capped) ? 'The narrow tube is too short — and it does NOT overflow' : 'Narrower tube, higher column',
      Lq.name + ' · T = ' + (Lq.sig * 1000).toFixed(1) + ' mN/m · ρ = ' + Lq.rho + ' kg/m³ · contact angle ' + (C.theta * 180 / Math.PI).toFixed(0) + '° · tubes ' + (C.Lmax * 100).toFixed(1) + ' cm above the surface',
      'ρ d/dt[(h + δ)ḣ] = 2T cos θ/r − ρgh − 8ηhḣ/r²  — rise with inertia and viscous loss', th.text);
    const rows = narrow ? 3 : 5, bw = narrow ? W - 24 : 280, bh = 26 + rows * 15 + 10;
    const row = gPanel(g, 12, H - bh - 30, bw, bh, 'JURIN\'S LAW, TUBE BY TUBE');
    C.tubes.forEach((t, i) => {
      if (narrow && i > 2) return;
      row(i, 'r = ' + (t.r * 1000).toFixed(2) + ' mm: h · 2Tcosθ/ρgr', (capAt(t, S.ts) * 100).toFixed(2) + ' · ' + (t.hJ * 100).toFixed(2) + ' cm', t.capped ? th.warn : th.phys);
    });
    if (!narrow) {
      row(3, 'h × r (same for all three)', (C.tubes[2].hJ * C.tubes[2].r * 1e6).toFixed(2) + ' mm²');
      row(4, 'height × radius = 2T cos θ/ρg', 'so h ∝ 1/r', th.ok);
    }
  }

  /* =========================================================================
     FLUIDS IN MOVING FRAMES, BUBBLES, AND THE U-TUBE

     · An accelerating tank: the free surface is an isobar, so in steady
       state it tilts to tan θ = a/g. It does not get there at once: the
       first sloshing mode of a rectangular tank, ω² = (πg/L) tanh(πh/L),
       is driven by the step in acceleration and overshoots. A pendulum
       hanging in the air of the cart swings back; a helium balloon leans
       FORWARD. All three are integrated.
     · A rotating vessel: the surface is the paraboloid z = z₀ + ω²r²/2g,
       with z₀ set by conserving the volume — including the case where the
       centre runs dry. The liquid spins up over the Ekman time h/√(νω).
     · Two soap bubbles joined through a valve: each cap's excess pressure
       4T/R is worked out from its real geometry on the tube mouth, and the
       air flows (Poiseuille) from the higher pressure to the lower. The
       small bubble empties into the big one, until it is a cap with the
       big one's curvature.
     · A U-tube with a second, lighter liquid poured into one arm: the levels
       from pressure balance at the interface, and the column's oscillation
       T = 2π√(m/2ρ_w gA) integrated with its damping.
     ========================================================================= */
  const TK = { L: 0.40, W: 0.14, H: 0.26, h0: 0.10 };
  function runAccel(p) {
    const a = p.acc, L = TK.L, h = TK.h0;
    const om = Math.sqrt(Math.PI * GF / L * Math.tanh(Math.PI * h / L)), z = 0.04;
    const sEq = a / GF;
    // pendulum (length 0.12 m) and balloon (a string 0.14 m) in the cart's frame
    const lp = 0.12, lb = 0.14;
    let s = 0, sv = 0, ph = 0, pv = 0, bs = 0, bv = 0, t = 0;
    const pts = [[0, 0, 0, 0]];
    const h1 = 0.002;
    while (t < 10) {
      const sa = -2 * z * om * sv - om * om * (s - sEq);
      // pendulum: φ̈ = −(g sin φ + a cos φ)/l — back-swing for a > 0
      const pa = -(GF * Math.sin(ph) + a * Math.cos(ph)) / lp - 0.6 * pv;
      // helium balloon: buoyancy beats weight, so the effective g points UP and it leans forward
      const ba = -(GF * Math.sin(bs) - a * Math.cos(bs)) / lb - 1.8 * bv;
      sv += sa * h1; s += sv * h1; pv += pa * h1; ph += pv * h1; bv += ba * h1; bs += bv * h1; t += h1;
      if (Math.round(t / h1) % 10 === 0) pts.push([t, s, ph, bs]);
    }
    const rise = sEq * L / 2;
    let sMax = 0; pts.forEach(q => { sMax = Math.max(sMax, Math.abs(q[1])); });
    return { a, om, T: TAU / om, sEq, thEq: Math.atan(sEq), pts, rise, spill: h + sMax * L / 2 > TK.H, sMax };
  }
  function accelAt(A, t) {
    const P = A.pts, i = clamp(Math.floor(t / 0.02), 0, P.length - 2), f = clamp((t - P[i][0]) / (P[i + 1][0] - P[i][0]), 0, 1);
    return P[i].map((v, k) => v + (P[i + 1][k] - v) * f);
  }
  const RV = { R: 0.08, h0: 0.12, H: 0.30 };
  function rotSurface(w) {
    const R = RV.R, h0 = RV.h0, k = w * w / (2 * GF);
    const z0 = h0 - k * R * R / 2;
    if (z0 >= 0) return { z0, r0: 0, z: r => z0 + k * r * r, rim: z0 + k * R * R, dry: false };
    const r02 = R * R - 2 * R * Math.sqrt(GF * h0) / w;       // the dry spot: volume still πR²h₀
    return { z0: 0, r0: Math.sqrt(Math.max(0, r02)), z: r => Math.max(0, k * (r * r - r02)), rim: k * (R * R - r02), dry: true };
  }
  function runRotate(p) {
    const w = p.omg, nu = 1.0e-6;
    const tauReal = w > 0 ? RV.h0 / Math.sqrt(nu * w) : 0;       // Ekman spin-up
    const final = rotSurface(w);
    const wDry = 2 * Math.sqrt(GF * RV.h0) / RV.R;                 // the centre just touches the bottom
    const wSpill = Math.sqrt(4 * GF * (RV.H - RV.h0)) / RV.R;       // the rim reaches the top (before the centre dries)
    return { w, tauReal, tau: Math.min(4, tauReal / 10), final, wDry, wSpill, spill: final.rim > RV.H };
  }

  /* ---------------- bubbles ---------------- */
  const BUB = { a: 0.005, rt: 0.0015, Lt: 0.12, eta: 1.8e-5 };
  const capV = (hc) => Math.PI * hc * (3 * BUB.a * BUB.a + hc * hc) / 6;
  const capR = (hc) => (BUB.a * BUB.a + hc * hc) / (2 * hc);
  const capH = (R) => R + Math.sqrt(Math.max(0, R * R - BUB.a * BUB.a));      // the bubble branch (more than a hemisphere)
  function runBubbles(p) {
    const T = p.sig, cond = Math.PI * Math.pow(BUB.rt, 4) / (8 * BUB.eta * BUB.Lt);
    let h1 = capH(p.r1 / 100), h2 = capH(p.r2 / 100), t = 0;
    const dp = (h) => 4 * T / capR(h);
    const pts = [[0, h1, h2]];
    const Vt = capV(h1) + capV(h2);
    if (p.open) {
      const dt = 0.002;
      while (t < 40) {
        const Q = (dp(h1) - dp(h2)) * cond;           // from 1 to 2
        h1 -= Q / (Math.PI * (BUB.a * BUB.a + h1 * h1) / 2) * dt;
        h2 += Q / (Math.PI * (BUB.a * BUB.a + h2 * h2) / 2) * dt;
        h1 = Math.max(1e-5, h1); h2 = Math.max(1e-5, h2); t += dt;
        if (Math.round(t / dt) % 10 === 0) pts.push([t, h1, h2]);
        if (Math.abs(Q) < 1e-11 && t > 1) break;
      }
    }
    return { T, pts, tEnd: t, Vt, dp, dV: capV(h1) + capV(h2) - Vt, p10: dp(pts[0][1]), p20: dp(pts[0][2]) };
  }
  function bubAt(Bb, t) {
    const P = Bb.pts;
    if (t >= P[P.length - 1][0]) return P[P.length - 1];
    const i = clamp(Math.floor(t / 0.02), 0, P.length - 2), f = clamp((t - P[i][0]) / (P[i + 1][0] - P[i][0]), 0, 1);
    return P[i].map((v, k) => v + (P[i + 1][k] - v) * f);
  }

  /* ---------------- the U-tube ---------------- */
  const UT = { r: 0.008, xs: 0.07, zb: 0.06, top: 0.46, Lw: 0.50 };
  function runUtube(p) {
    const L2 = LIQ[p.liq2] || LIQ.oil, rw = LIQ.water.rho, ro = p.liq2 === 'none' ? 0 : L2.rho;
    const ho = p.liq2 === 'none' ? 0 : p.hoil / 100;
    const bend = Math.PI * UT.xs;                        // the semicircular bend, centre line
    const C = UT.Lw - bend + 2 * UT.zb;                  // z_L + z_i, water length conserved
    const D = ro * ho / rw;                              // z_L − z_i
    const zL = (C + D) / 2, zi = (C - D) / 2, zR = zi + ho;
    const m = rw * UT.Lw + ro * ho, k = 2 * rw * GF;
    const w0 = Math.sqrt(k / m), T = TAU / w0;
    const pts = [];
    if (p.slosh) {
      let x = 0.04, v = 0, t = 0, z = 0.035;
      for (let i = 0; i <= 8000; i++) { if (i % 5 === 0) pts.push([t, x]); const a = -w0 * w0 * x - 2 * z * w0 * v; v += a * 0.001; x += v * 0.001; t += 0.001; }
    }
    // period from the zero crossings of the integrated motion
    let Tm = 0;
    if (pts.length) { const zc = []; for (let i = 1; i < pts.length; i++) if (pts[i - 1][1] > 0 && pts[i][1] <= 0) zc.push(pts[i][0]); if (zc.length > 1) Tm = (zc[zc.length - 1] - zc[0]) / (zc.length - 1); }
    return { L2, rw, ro, ho, zL, zi, zR, T, Tm, pts, diff: zR - zL };
  }
  function utAt(U, t) {
    if (!U.pts.length) return 0;
    const i = clamp(Math.floor(t / 0.005), 0, U.pts.length - 1);
    return U.pts[i][1];
  }

  /* ======================= drawing ======================= */
  function convexFill(ctx, cam, pts3, fill, stroke) {
    const q = pts3.map(p => cam.project(p)); if (q.some(x => !x.ok)) return null;
    const H = hull2(q);
    ctx.fillStyle = fill; polyPath(ctx, H); ctx.fill();
    if (stroke) { ctx.strokeStyle = stroke; ctx.lineWidth = 1; polyPath(ctx, H); ctx.stroke(); }
    return H;
  }
  function drawFrame(S, g) {
    const ctx = g.ctx, th = g.theme, p = S.p, W = g.w, H = g.h, cam = S.cam;
    const narrow = W < 660, K = 4.2, B = window.BENCH;
    const F = R3.Frame(ctx, cam, { ambient: 0.3, floorZ: null });
    const m = (x, y, z) => [x * K, y * K, z * K];
    const wc = LIQ.water.col;
    if (p.fsub === 'accel') {
      const A = S.Ac, st = accelAt(A, S.ts), s = st[1];
      // the floor streams backwards under the cart, faster as it speeds up
      const v = A.a * Math.min(S.ts, 10), shift = ((0.5 * A.a * S.ts * S.ts) % 0.2 + 0.2) % 0.2;
      B.texBox(F, m(0, 0, -0.07), [1.3 * K, 0.5 * K, 0.02 * K], B.metal('#39414F', 61), { bias: F.GROUND, tiles: 3 });
      for (let k = -4; k <= 4; k++) {
        const x = k * 0.2 - shift + 0.1;
        path3(F, [m(x, -0.25, -0.059), m(x, 0.25, -0.059)], '#8FA4CE', { alpha: 0.35, width: 1.2, chunk: 1, bias: F.GROUND - 1 });
      }
      // the cart: a deck on four wheels
      B.texBox(F, m(0, 0, -0.025), [0.52 * K, 0.22 * K, 0.03 * K], B.wood('#7A5230', 71), { ambient: 0.5 });
      [[-0.2, -0.1], [0.2, -0.1], [-0.2, 0.1], [0.2, 0.1]].forEach(q => R3.cylinder(F, m(q[0], q[1] - 0.012, -0.045), m(q[0], q[1] + 0.012, -0.045), 0.022 * K, '#1E2533',
        { segments: 16, shadow: false, spokes: 4, phase: -(0.5 * A.a * S.ts * S.ts) / 0.022 }));
      // the tank and its liquid, the surface tilted by s
      const L = TK.L, Wd = TK.W, zS = (x) => clamp(TK.h0 - s * x, 0, TK.H);
      const xL = -L / 2, xR = L / 2;
      const liq = [m(xL, -Wd / 2, 0), m(xR, -Wd / 2, 0), m(xL, Wd / 2, 0), m(xR, Wd / 2, 0),
                   m(xL, -Wd / 2, zS(xL)), m(xR, -Wd / 2, zS(xR)), m(xL, Wd / 2, zS(xL)), m(xR, Wd / 2, zS(xR))];
      F.push(m(0, 0, TK.h0 / 2), () => {
        const Hh = convexFill(ctx, cam, liq, RX.rgba(wc, 0.5), null);
        const top = [liq[4], liq[5], liq[7], liq[6]].map(q => cam.project(q));
        if (Hh && top.every(q => q.ok)) { ctx.fillStyle = RX.rgba(RX.mix(wc, '#FFFFFF', 0.35), 0.7); polyPath(ctx, top); ctx.fill();
          ctx.strokeStyle = 'rgba(220,240,255,.8)'; ctx.lineWidth = 1; polyPath(ctx, top); ctx.stroke(); }
      }, -0.02);
      glassBox(F, m(0, 0, TK.H / 2), [L * K, Wd * K, TK.H * K], { glint: true, skip: [4] });
      // a pendulum hanging from a gantry over the back, and a balloon tied to the front
      const gp = m(-0.24, 0, 0.30);
      R3.box(F, m(-0.24, 0.09, 0.15), [0.012 * K, 0.012 * K, 0.30 * K], '#3A4458', { shadow: false });
      R3.box(F, m(-0.24, 0.045, 0.30), [0.012 * K, 0.10 * K, 0.012 * K], '#3A4458', { shadow: false });
      const pb = [gp[0] + Math.sin(st[2]) * 0.12 * K, 0, gp[2] - Math.cos(st[2]) * 0.12 * K];
      path3(F, [gp, pb], '#DDE2EA', { alpha: 0.9, width: 1.2, chunk: 1 });
      R3.sphere(F, pb, 0.016 * K, '#C9A04A', { shadow: false });
      const bb0 = m(0.24, 0.0, 0.0), bb = [bb0[0] + Math.sin(st[3]) * 0.14 * K, 0, bb0[2] + Math.cos(st[3]) * 0.14 * K];
      path3(F, [bb0, bb], '#DDE2EA', { alpha: 0.9, width: 1, chunk: 1 });
      R3.sphere(F, bb, 0.032 * K, '#FF4D6D', { shadow: false });
      R3.label(F, pb, 'pendulum ' + (-st[2] * 180 / Math.PI).toFixed(1) + '° back', '#E8C878', { size: 9, dy: 16 });
      R3.label(F, bb, 'helium balloon ' + (st[3] * 180 / Math.PI).toFixed(1) + '° forward', '#FF9AB0', { size: 9, dy: -22 });
      R3.arrow(F, m(0.30, 0, 0.20), m(0.30 + Math.sign(A.a || 1) * 0.12, 0, 0.20), 0.008, '#7CF0B0', { label: 'a = ' + A.a.toFixed(1) + ' m/s²', labelSize: 9 });
      R3.callout(F, m(xL, -Wd / 2, zS(xL)), -30, 16, 'rear ' + (zS(xL) * 100).toFixed(1) + ' cm', '#9AD0FF', { size: 9 });
      R3.callout(F, m(xR, -Wd / 2, zS(xR)), 30, -14, 'front ' + (zS(xR) * 100).toFixed(1) + ' cm', '#9AD0FF', { size: 9 });
      F.render();
      void v;
      const thNow = Math.atan(s) * 180 / Math.PI;
      header(g, A.spill ? 'It slops over the back wall' : 'The surface tilts to tan θ = a/g — after overshooting',
        'a = ' + A.a.toFixed(2) + ' m/s² · steady tilt ' + (A.thEq * 180 / Math.PI).toFixed(2) + '° · now ' + thNow.toFixed(2) + '° · slosh period ' + A.T.toFixed(3) + ' s',
        'first sloshing mode ω² = (πg/L) tanh(πh/L), driven by the step in a; pendulum and balloon integrated in the cart frame', A.spill ? th.crit : th.text);
      const rows = narrow ? 4 : 6, bw = narrow ? W - 24 : 276, bh = 26 + rows * 15 + 10;
      const row = gPanel(g, 12, H - bh - 30, bw, bh, 'IN THE ACCELERATING CART');
      row(0, 'surface tilt now · steady', thNow.toFixed(2) + '° · ' + (A.thEq * 180 / Math.PI).toFixed(2) + '°', th.phys);
      row(1, 'pressure at the bottom, rear', (LIQ.water.rho * GF * zS(xL)).toFixed(0) + ' Pa');
      row(2, 'pressure at the bottom, front', (LIQ.water.rho * GF * zS(xR)).toFixed(0) + ' Pa');
      row(3, 'difference ÷ length = ρa', ((LIQ.water.rho * GF * (zS(xL) - zS(xR))) / L).toFixed(0) + ' Pa/m', th.ok);
      if (!narrow) {
        row(4, 'largest tilt (overshoot)', (Math.atan(A.sMax) * 180 / Math.PI).toFixed(1) + '°', th.warn);
        row(5, 'the balloon leans', A.a >= 0 ? 'FORWARD' : 'backward', th.warn);
      }
      return;
    }
    // ---------------- rotating vessel ----------------
    const Rt = S.Rt, wf = Rt.w * (1 - Math.exp(-S.ts / Math.max(0.05, Rt.tau))), sf = rotSurface(wf);
    const R = RV.R, ang = S.spin || 0;
    B.table(F, -0.25 * K, 0.25 * K, -0.2 * K, 0.2 * K, -0.03 * K, { legs: false, tone: '#6E4A2C', seed: 73, thick: 0.03 });
    R3.cylinder(F, m(0, 0, -0.03), m(0, 0, -0.012), 0.12 * K, '#2A3142', { segments: 40, shadow: false });
    R3.cylinder(F, m(0, 0, -0.012), m(0, 0, 0), 0.105 * K, '#8C98AA', { segments: 40, shadow: false, spokes: 6, phase: ang });
    // the liquid: the side hull up to the rim height, then the paraboloid as rings of quads
    F.push(m(0, 0, RV.h0 / 2), () => {
      const bot = ringPts(cam, m(0, 0, 0), R * K, 40), rim = ringPts(cam, m(0, 0, sf.rim), R * K, 40);
      if (!bot || !rim) return;
      const Hh = hull2(bot.concat(rim));
      const gr = ctx.createLinearGradient(0, Math.min(...Hh.map(q => q.y)), 0, Math.max(...Hh.map(q => q.y)));
      gr.addColorStop(0, RX.rgba(RX.mix(wc, '#FFFFFF', 0.15), 0.42)); gr.addColorStop(1, RX.rgba(RX.mix(wc, '#05080F', 0.35), 0.55));
      ctx.fillStyle = gr; polyPath(ctx, Hh); ctx.fill();
      // the free surface, far rings first
      const NR = 12, NA = 36, quads = [];
      for (let i = 0; i < NR; i++) for (let j = 0; j < NA; j++) {
        const r0 = Math.max(sf.r0, R * i / NR), r1 = Math.max(sf.r0, R * (i + 1) / NR), a0 = j / NA * TAU + ang, a1 = (j + 1) / NA * TAU + ang;
        if (r1 <= r0) continue;
        const pt = (r, a) => m(r * Math.cos(a), r * Math.sin(a), sf.z(r));
        const c = [pt(r0, a0), pt(r1, a0), pt(r1, a1), pt(r0, a1)];
        const ctr = pt((r0 + r1) / 2, (a0 + a1) / 2);
        quads.push({ c, d: F.depth(ctr), stripe: j % 6 === 0 });
      }
      quads.sort((u, v) => v.d - u.d);
      quads.forEach(qd => {
        const q = qd.c.map(v => cam.project(v)); if (q.some(x => !x.ok)) return;
        ctx.fillStyle = RX.rgba(RX.mix(wc, '#FFFFFF', qd.stripe ? 0.55 : 0.3), qd.stripe ? 0.75 : 0.5);
        polyPath(ctx, q); ctx.fill();
      });
    }, -0.02);
    glassCyl(F, m(0, 0, 0), (R + 0.003) * K, RV.H * K);
    R3.arrow(F, m(0, 0, RV.H + 0.02), m(0, 0, RV.H + 0.09), 0.008, '#7CF0B0', { label: 'ω = ' + wf.toFixed(2) + ' rad/s', labelSize: 9 });
    R3.callout(F, m(0, -0.001, sf.z(0)), -50, 20, sf.dry ? 'dry spot r = ' + (sf.r0 * 100).toFixed(1) + ' cm' : 'centre ' + (sf.z(0) * 100).toFixed(2) + ' cm', '#9AD0FF', { size: 9.5 });
    R3.callout(F, m(R, 0, sf.rim), 40, -10, 'rim ' + (sf.rim * 100).toFixed(2) + ' cm', '#9AD0FF', { size: 9.5 });
    F.render();
    header(g, Rt.spill ? 'It spills over the rim' : sf.dry ? 'The centre has run dry' : 'A paraboloid: z = z₀ + ω²r²/2g',
      'ω = ' + Rt.w.toFixed(2) + ' rad/s (' + (Rt.w * 60 / TAU).toFixed(0) + ' rpm) · the liquid has reached ' + wf.toFixed(2) + ' · spin-up time h/√(νω) = ' + Rt.tauReal.toFixed(0) + ' s, shown 10× faster',
      'volume conserved: πR²h₀ = ∫2πr z(r) dr · the surface is the isobar of g and the centrifugal ω²r', Rt.spill || sf.dry ? th.warn : th.text);
    const rows = narrow ? 4 : 6, bw = narrow ? W - 24 : 276, bh = 26 + rows * 15 + 10;
    const row = gPanel(g, 12, H - bh - 30, bw, bh, 'THE SPINNING SURFACE');
    row(0, 'wall rise · centre dip', ((sf.rim - RV.h0) * 100).toFixed(2) + ' · ' + ((RV.h0 - sf.z(0)) * 100).toFixed(2) + ' cm', th.phys);
    row(1, 'ω²R²/4g (each, if not dry)', (wf * wf * R * R / (4 * GF) * 100).toFixed(2) + ' cm');
    row(2, 'bottom p: centre · edge', (LIQ.water.rho * GF * sf.z(0)).toFixed(0) + ' · ' + (LIQ.water.rho * GF * sf.rim).toFixed(0) + ' Pa');
    row(3, 'ω that dries the centre', Rt.wDry.toFixed(2) + ' rad/s', th.warn);
    if (!narrow) {
      row(4, 'ω that reaches the rim', Rt.wSpill.toFixed(2) + ' rad/s');
      row(5, 'surface slope at the wall', (Math.atan(wf * wf * R / GF) * 180 / Math.PI).toFixed(1) + '°');
    }
  }

  function drawBubbles(S, g) {
    const ctx = g.ctx, th = g.theme, p = S.p, W = g.w, H = g.h, cam = S.cam, Bb = S.Bb;
    const narrow = W < 660, K = 7, B = window.BENCH;
    const F = R3.Frame(ctx, cam, { ambient: 0.3, floorZ: null });
    const m = (x, y, z) => [x * K, y * K, z * K];
    B.table(F, -0.22 * K, 0.22 * K, -0.12 * K, 0.12 * K, 0, { legs: false, tone: '#6E4A2C', seed: 79, thick: 0.03 });
    const now = bubAt(Bb, S.ts), hs = [now[1], now[2]], xs = [-0.11, 0.11], zM = 0.10;
    // the T-piece: two stems and a horizontal tube with a valve between
    [[-0.11, 0], [0.11, 0]].forEach(q => {
      R3.box(F, m(q[0], 0.03, zM / 2), [0.01 * K, 0.01 * K, zM * K], '#3A4458', { shadow: false });
    });
    glassCyl(F, m(-0.11, 0, zM - 0.05), 0.0055 * K, 0.05 * K, { bias: -0.01 });
    glassCyl(F, m(0.11, 0, zM - 0.05), 0.0055 * K, 0.05 * K, { bias: -0.01 });
    path3(F, [m(-0.11, 0, zM - 0.05), m(0.11, 0, zM - 0.05)], '#DCEBFA', { alpha: 0.4, width: 7, chunk: 1 });
    R3.cylinder(F, m(0, -0.012, zM - 0.05), m(0, 0.012, zM - 0.05), 0.01 * K, '#C0392B', { segments: 16, shadow: false });
    const va = p.open ? Math.PI / 2 : 0;
    R3.box(F, m(0, -0.014, zM - 0.05), [0.05 * K * Math.cos(va) + 0.006 * K, 0.006 * K, 0.05 * K * Math.sin(va) + 0.006 * K], '#E05040', { shadow: false });
    R3.label(F, m(0, -0.02, zM - 0.075), p.open ? 'valve OPEN' : 'valve shut', p.open ? '#7CF0B0' : '#FF8A6B', { size: 9.5 });
    // the bubbles: a spherical cap on each mouth, with thin-film colours
    hs.forEach((hc, i) => {
      const Rc = capR(hc), cz = zM + hc - Rc, c = m(xs[i], 0, cz);
      F.push(m(xs[i], 0, zM + hc / 2), () => {
        const q0 = cam.project(c); if (!q0.ok) return;
        // silhouette: sample the cap surface (the part above the mouth plane), hull it
        const pts = [];
        const cmin = (zM - cz) / Rc;                          // cos of the polar angle at the mouth
        for (let u = 0; u <= 14; u++) {
          const ct = 1 - (1 - cmin) * u / 14, st = Math.sqrt(Math.max(0, 1 - ct * ct));
          for (let k = 0; k < 24; k++) { const a = k / 24 * TAU; pts.push(cam.project(m(xs[i] + Rc * st * Math.cos(a), Rc * st * Math.sin(a), cz + Rc * ct))); }
        }
        if (pts.some(q => !q.ok)) return;
        const Hh = hull2(pts);
        const rp = Rc * K * q0.s;
        ctx.save(); polyPath(ctx, Hh); ctx.clip();
        const gr = ctx.createRadialGradient(q0.x - rp * 0.2, q0.y - rp * 0.25, rp * 0.05, q0.x, q0.y, rp * 1.02);
        gr.addColorStop(0, 'rgba(255,255,255,.10)'); gr.addColorStop(0.55, 'rgba(200,230,255,.05)');
        gr.addColorStop(0.78, 'rgba(255,120,220,.22)'); gr.addColorStop(0.86, 'rgba(120,255,200,.25)'); gr.addColorStop(0.93, 'rgba(255,220,110,.32)'); gr.addColorStop(1, 'rgba(140,170,255,.45)');
        ctx.fillStyle = gr; ctx.fillRect(q0.x - rp * 1.2, q0.y - rp * 1.2, rp * 2.4, rp * 2.4);
        const sp = ctx.createRadialGradient(q0.x - rp * 0.4, q0.y - rp * 0.45, 0, q0.x - rp * 0.4, q0.y - rp * 0.45, rp * 0.28);
        sp.addColorStop(0, 'rgba(255,255,255,.85)'); sp.addColorStop(1, 'rgba(255,255,255,0)');
        ctx.fillStyle = sp; ctx.fillRect(q0.x - rp, q0.y - rp, rp, rp);
        ctx.restore();
        ctx.strokeStyle = 'rgba(220,235,255,.55)'; ctx.lineWidth = 1; polyPath(ctx, Hh); ctx.stroke();
      }, -0.02);
      R3.callout(F, m(xs[i], 0, zM + hc), i ? 40 : -40, -20, 'R = ' + (Rc * 100).toFixed(2) + ' cm · Δp = ' + (4 * Bb.T / Rc).toFixed(2) + ' Pa', i ? '#B8A4FF' : '#7FD0FF', { size: 9.5 });
    });
    F.render();
    const p1 = 4 * Bb.T / capR(hs[0]), p2 = 4 * Bb.T / capR(hs[1]);
    const flowTo = p1 > p2 ? 'left → right' : 'right → left';
    header(g, !p.open ? 'Valve shut · which way will the air go?' : Math.abs(p1 - p2) < 0.01 ? 'Settled: the small one is a cap of the big one\'s curvature' : 'The SMALL bubble empties into the big one',
      'T = ' + (Bb.T * 1000).toFixed(0) + ' mN/m · excess pressure 4T/R (two surfaces) · air flows ' + (p.open ? flowTo : '— valve shut'),
      'each cap solved on a 1 cm mouth: R = (a² + h²)/2h · the flow through the tube is Poiseuille, Q = πr⁴Δp/8ηL', th.text);
    const rows = narrow ? 3 : 5, bw = narrow ? W - 24 : 272, bh = 26 + rows * 15 + 10;
    const row = gPanel(g, 12, H - bh - 30, bw, bh, 'PRESSURE INSIDE EACH BUBBLE');
    row(0, 'left: 4T/R', p1.toFixed(3) + ' Pa above air', '#7FD0FF');
    row(1, 'right: 4T/R', p2.toFixed(3) + ' Pa above air', '#B8A4FF');
    row(2, 'difference drives the air', Math.abs(p1 - p2).toFixed(3) + ' Pa', th.phys);
    if (!narrow) {
      row(3, 'total air (conserved)', ((capV(hs[0]) + capV(hs[1])) * 1e6).toFixed(3) + ' cm³', th.ok);
      row(4, 'smaller R, higher pressure', 'it loses', th.warn);
    }
  }

  function drawUtube(S, g) {
    const ctx = g.ctx, th = g.theme, p = S.p, W = g.w, H = g.h, cam = S.cam, U = S.U;
    const narrow = W < 660, K = 4.5, B = window.BENCH;
    const F = R3.Frame(ctx, cam, { ambient: 0.3, floorZ: null });
    const m = (x, y, z) => [x * K, y * K, z * K];
    B.table(F, -0.2 * K, 0.2 * K, -0.12 * K, 0.12 * K, 0, { legs: false, tone: '#7A5230', seed: 83, thick: 0.03 });
    R3.texPlane(F, m(0, 0.03, 0.25), [0.16 * K, 0, 0], [0, 0, -0.25 * K], boardTex(300), { grid: 4, bias: 0.05 });
    const x = utAt(U, S.ts), zL = U.zL + x, zi = U.zi - x, zR = U.zR - x;
    const wc = LIQ.water.col, oc = U.L2.col;
    // the bend: a semicircle of glass, full of water
    const bend = [];
    for (let k = 0; k <= 24; k++) { const a = Math.PI + k / 24 * Math.PI; bend.push(m(UT.xs * Math.cos(a), 0, UT.zb + UT.xs * Math.sin(a))); }
    const wpx = Math.max(4, UT.r * 2 * K * 110);
    path3(F, bend, wc, { alpha: 0.75, width: wpx * 0.8, chunk: 3, bias: 0.01 });
    path3(F, bend, '#DCEBFA', { alpha: 0.25, width: wpx, chunk: 3, bias: -0.01 });
    liquidCyl(F, m(-UT.xs, 0, UT.zb), UT.r * K, (zL - UT.zb) * K, wc, { alpha: 0.6 });
    liquidCyl(F, m(UT.xs, 0, UT.zb), UT.r * K, (zi - UT.zb) * K, wc, { alpha: 0.6 });
    if (U.ho > 0) liquidCyl(F, m(UT.xs, 0, zi), UT.r * K, U.ho * K, oc, { alpha: 0.75, bias: -0.021 });
    glassCyl(F, m(-UT.xs, 0, UT.zb), (UT.r + 0.002) * K, (UT.top - UT.zb) * K);
    glassCyl(F, m(UT.xs, 0, UT.zb), (UT.r + 0.002) * K, (UT.top - UT.zb) * K);
    R3.callout(F, m(-UT.xs - UT.r, 0, zL), -34, -8, 'water ' + (zL * 100).toFixed(2) + ' cm', '#9AD0FF', { size: 9.5 });
    if (U.ho > 0) {
      R3.callout(F, m(UT.xs + UT.r, 0, zR), 34, -8, U.L2.name + ' top ' + (zR * 100).toFixed(2) + ' cm', '#F2C879', { size: 9.5 });
      R3.callout(F, m(UT.xs + UT.r, 0, zi), 34, 12, 'interface ' + (zi * 100).toFixed(2) + ' cm', '#C9D4EA', { size: 9.5 });
      path3(F, [m(-UT.xs, -0.012, zi), m(UT.xs, -0.012, zi)], '#FFD36B', { alpha: 0.7, width: 1, dash: [4, 3], chunk: 1, bias: -0.05 });
      R3.label(F, m(0, -0.012, zi), 'same pressure on this level', '#FFD36B', { size: 9, dy: -8 });
    }
    F.render();
    header(g, p.slosh ? 'Released: the column oscillates' : U.ho > 0 ? 'The lighter liquid stands higher' : 'Water alone: the levels match',
      U.ho > 0 ? U.L2.name + ' ' + (U.ho * 100).toFixed(1) + ' cm (ρ ' + U.ro + ') on water · level difference ' + (U.diff * 100).toFixed(2) + ' cm' : 'tube ⌀ 16 mm · water column 50 cm long',
      'pressure balance at the interface: ρ_w g h_w = ρ₂ g h₂ · oscillation T = 2π√(m/2ρ_w gA)', th.text);
    const rows = narrow ? 4 : 5, bw = narrow ? W - 24 : 272, bh = 26 + rows * 15 + 10;
    const row = gPanel(g, 12, H - bh - 30, bw, bh, 'THE TWO ARMS');
    row(0, 'water above the interface level', ((U.zL - U.zi) * 100).toFixed(2) + ' cm', th.phys);
    row(1, 'ρ₂h₂/ρ_w', (U.ro * U.ho / U.rw * 100).toFixed(2) + ' cm', th.ok);
    row(2, 'top of arm 2 − top of arm 1', (U.diff * 100).toFixed(2) + ' cm');
    row(3, 'period: integrated · formula', (U.Tm ? U.Tm.toFixed(3) : '—') + ' · ' + U.T.toFixed(3) + ' s');
    if (!narrow) row(4, 'water alone would give', (TAU * Math.sqrt(UT.Lw / (2 * GF))).toFixed(3) + ' s = 2π√(L/2g)');
  }
  /* =========================================================================
     PASCAL, WALLS AND DROPS — three JEE staples, each computed, not quoted

     · The hydraulic lift. p = F₁/A₁ reaches the big piston, but the two
       pistons do not stay level: pushing the small one down x raises the big
       one xA₁/A₂, so the oil the effort holds up grows by x(1 + A₁/A₂). The
       effort is worked out at every point of the stroke, its work integrated,
       and checked against the load's gain plus the oil's.
     · The force on a wall. The wetted face is cut into 800 strips; each
       strip's pressure (with an oil layer on top, if there is one) times its
       area is summed, and so is its moment about the bottom edge. Tilt the
       wall and the horizontal part does not change; the vertical part is the
       weight of the water standing on it.
     · Merging drops. n = k³ drops of radius r are absorbed one by one into
       the central one, nearest first. The surface area is summed at every
       instant, so the energy set free and the temperature rise are what the
       area actually lost.
     ========================================================================= */
  const OILH = { rho: 870, col: '#D9A93A' };
  const LF = { xs: -0.22, xb: 0.14, zTop: 0.40, z0: 0.25 };          // the two cylinders, in metres
  function runLift(p) {
    const A1 = Math.PI * Math.pow(p.d1 / 200, 2), A2 = Math.PI * Math.pow(p.d2 / 200, 2), r = A1 / A2;
    const M = p.Mkg, rho = OILH.rho, X = p.xs / 100;
    const F1 = x => A1 * (M * GF / A2 + rho * GF * x * (1 + r));   // big piston stands x(1 + r) above the small one
    let W = 0; const N = 600;
    for (let i = 0; i < N; i++) { const a = X * i / N, b = X * (i + 1) / N; W += (F1(a) + F1(b)) / 2 * (b - a); }
    const y = X * r, Eload = M * GF * y, Eoil = rho * GF * A1 * X * (X + y) / 2;
    const pts = [];
    for (let x = 0; x <= 0.300001; x += 0.005) pts.push([x * 100, F1(x)]);
    return { A1, A2, r, M, X, y, F1, F0: F1(0), Fx: F1(X), W, Eload, Eoil, pts, MA: A2 / A1,
             p0: M * GF / A2, strokes: 0.10 / (0.30 * r) };
  }
  function runDam(p) {
    const hw = p.dH / 100, ho = p.doil / 100, H = hw + ho, al = p.dang * Math.PI / 180, w = p.dw / 100;
    const rw = LIQ.water.rho, ro = OILH.rho, sa = Math.sin(al);
    const pr = d => d <= ho ? ro * GF * d : ro * GF * ho + rw * GF * (d - ho);
    const Ls = H / sa, N = 800, ds = Ls / N;
    let F = 0, Mb = 0;
    for (let i = 0; i < N; i++) { const s = (i + 0.5) * ds, d = H - s * sa, f = pr(d) * w * ds; F += f; Mb += f * s; }
    const sCp = Mb / F, zCp = sCp * sa;
    const Fform = w / sa * (ro * GF * ho * ho / 2 + ro * GF * ho * hw + rw * GF * hw * hw / 2);
    const Fx = F * sa, Fz = F * Math.cos(al);
    return { hw, ho, H, al, w, pr, Ls, F, Fx, Fz, Mb, sCp, zCp, Fform, pBase: pr(H),
             Fvert: w * (ro * GF * ho * ho / 2 + ro * GF * ho * hw + rw * GF * hw * hw / 2) };
  }
  const CSP = { water: 4186, mercury: 140, soapy: 4186 };
  function runDrops(p) {
    const k = Math.round(p.nk), n = k * k * k, r = p.rdr / 1000, Lq = LIQ[p.dliq], T = Lq.sig, c = CSP[p.dliq];
    const pos = [];
    for (let i = 0; i < k; i++) for (let j = 0; j < k; j++) for (let l = 0; l < k; l++)
      pos.push([(i - (k - 1) / 2) * 3, (j - (k - 1) / 2) * 3, (l - (k - 1) / 2) * 3]);   // in units of r
    pos.sort((a, b) => Math.hypot(...a) - Math.hypot(...b));
    const a1 = 4 * Math.PI * r * r;
    const area = m => (n - 1 - m) * a1 + 4 * Math.PI * Math.pow(r * Math.cbrt(m + 1), 2);   // m drops absorbed into the centre one
    const A0 = n * a1, R = r * Math.cbrt(n), E = T * (A0 - area(n - 1));
    const mass = Lq.rho * n * 4 / 3 * Math.PI * r * r * r, dT = E / (mass * c);
    const tE = 6;
    return { k, n, r, T, c, Lq, pos, area, A0, R, E, dT, tE, mass,
             Eform: 4 * Math.PI * R * R * T * (Math.cbrt(n) - 1), dTform: 3 * T / (Lq.rho * c) * (1 / r - 1 / R) };
  }
  const SPR = {};
  function dropSprite(col, metal) {
    const key = col + metal;
    if (SPR[key]) return SPR[key];
    const c = document.createElement('canvas'); c.width = c.height = 128;
    RX.ball(c.getContext('2d'), 64, 64, 62, col, { rim: metal ? 0.9 : 0.6, sub: 0.35, vivid: !metal });
    return (SPR[key] = c);
  }
  const dropsAbsorbed = (D, t) => Math.max(0, Math.min(D.n - 1, Math.floor((D.n - 1) * clamp(t / D.tE, 0, 1))));

  function drawLift(S, g) {
    const ctx = g.ctx, th = g.theme, p = S.p, W = g.w, H = g.h, cam = S.cam, Lt = S.Lt;
    const narrow = W < 660, K = 4, B = window.BENCH;
    const F = R3.Frame(ctx, cam, { ambient: 0.3, floorZ: null });
    const m = (x, y, z) => [x * K, y * K, z * K];
    B.table(F, -0.40 * K, 0.36 * K, -0.2 * K, 0.2 * K, -0.03 * K, { legs: false, tone: '#6E4A2C', seed: 41, thick: 0.05 });
    const xNow = Lt.X * clamp(S.ts / 3, 0, 1), yNow = xNow * Lt.r;
    const r1 = p.d1 / 200, r2 = p.d2 / 200, zs = LF.z0 - xNow, zb = LF.z0 + yNow, oc = OILH.col;
    // the oil: two columns joined by a pipe along the bench
    const pipe = [m(LF.xs, 0, 0.02), m(LF.xb, 0, 0.02)];
    path3(F, pipe, oc, { alpha: 0.85, width: 9, chunk: 1, bias: 0.02 });
    path3(F, pipe, '#DCEBFA', { alpha: 0.2, width: 12, chunk: 1, bias: 0.01 });
    liquidCyl(F, m(LF.xs, 0, 0.0), r1 * K, zs * K, oc, { alpha: 0.75 });
    liquidCyl(F, m(LF.xb, 0, 0.0), r2 * K, zb * K, oc, { alpha: 0.6 });
    glassCyl(F, m(LF.xs, 0, 0), (r1 + 0.003) * K, LF.zTop * K);
    glassCyl(F, m(LF.xb, 0, 0), (r2 + 0.003) * K, LF.zTop * K);
    // pistons: steel discs riding on the oil, a rod and a push-pad on the small one
    R3.cylinder(F, m(LF.xs, 0, zs), m(LF.xs, 0, zs + 0.02), r1 * K, '#B8C2D0', { segments: 18, shadow: false });
    R3.cylinder(F, m(LF.xs, 0, zs + 0.02), m(LF.xs, 0, zs + 0.24), 0.004 * K, '#9AA6B8', { segments: 10, shadow: false, caps: false });
    R3.cylinder(F, m(LF.xs, 0, zs + 0.24), m(LF.xs, 0, zs + 0.255), 0.03 * K, '#2A3242', { segments: 18, shadow: false });
    R3.cylinder(F, m(LF.xb, 0, zb), m(LF.xb, 0, zb + 0.025), r2 * K, '#B8C2D0', { segments: 30, shadow: false });
    // the load: a steel block, its size growing gently with the mass
    const bs = 0.10 + 0.05 * Math.cbrt(Lt.M / 1000);
    R3.box(F, m(LF.xb, 0, zb + 0.025 + bs / 2), [bs * K, bs * K, bs * K], '#5C6A80', { shadow: false });
    R3.label(F, m(LF.xb, 0, zb + 0.025 + bs / 2), Lt.M.toFixed(0) + ' kg', '#F2F6FF', { size: 11 });
    // forces
    const Fnow = Lt.F1(xNow), aTop = m(LF.xs, 0, zs + 0.40), aBot = m(LF.xs, 0, zs + 0.265);
    R3.arrow(F, aTop, aBot, 0.006 * K, '#7CF0B0', { vivid: true });
    R3.label(F, aTop, 'F₁ = ' + Fnow.toFixed(2) + ' N', '#7CF0B0', { size: 10, dy: -10 });
    const lTop = m(LF.xb + bs / 2 + 0.05, 0, zb + 0.025 + bs), lBot = m(LF.xb + bs / 2 + 0.05, 0, zb + 0.025);
    R3.arrow(F, lTop, lBot, 0.006 * K, '#FF8FB0', { vivid: true });
    R3.label(F, lTop, 'Mg = ' + (Lt.M * GF).toFixed(0) + ' N', '#FF8FB0', { size: 10, dy: -10 });
    // the pressure is one number along any level in the oil
    const pS = Fnow / Lt.A1;
    R3.callout(F, m(LF.xs, 0, zs), -40, 6, 'p under it ' + (pS / 1000).toFixed(2) + ' kPa', '#F2C879', { size: 9.5 });
    R3.callout(F, m(LF.xb + r2, 0, zb), 40, 10, 'p under it ' + (Lt.p0 / 1000).toFixed(2) + ' kPa', '#F2C879', { size: 9.5 });
    path3(F, [m(LF.xs, -0.012, zs), m(LF.xb, -0.012, zs)], '#FFD36B', { alpha: 0.6, width: 1, dash: [4, 3], chunk: 1, bias: -0.05 });
    R3.label(F, m((LF.xs + LF.xb) / 2, -0.012, zs), 'big piston ' + ((zb - zs) * 1000).toFixed(1) + ' mm higher', '#FFD36B', { size: 9, dy: -8 });
    F.render();
    // drag the push-pad to set the stroke
    const q = cam.project(m(LF.xs, 0, zs + 0.255)), q2 = cam.project(m(LF.xs, 0, zs + 0.155));
    if (q.ok && q2.ok) { S._axP = axis2(q, q2, 0.1); ringHandle(g, q, 'pst', '#7CF0B0'); }
    header(g, 'Pascal: a small push holds up a car',
      'pistons ⌀ ' + p.d1.toFixed(1) + ' cm and ⌀ ' + p.d2.toFixed(1) + ' cm · area ratio ' + Lt.MA.toFixed(1) + ' · stroke ' + (xNow * 100).toFixed(1) + ' of ' + p.xs.toFixed(1) + ' cm',
      'F₁ = A₁(Mg/A₂ + ρg·x(1 + A₁/A₂)) — the head of oil grows as you push', th.text);
    const rows = narrow ? 4 : 6, bw = narrow ? W - 24 : 290, bh = 26 + rows * 15 + 10;
    const row = gPanel(g, 12, H - bh - 30, bw, bh, 'THE STROKE, INTEGRATED');
    row(0, 'effort at the start, Mg·A₁/A₂', Lt.F0.toFixed(3) + ' N', th.phys);
    row(1, 'effort at the end of the stroke', Lt.Fx.toFixed(3) + ' N');
    row(2, 'load rises', (Lt.y * 1000).toFixed(3) + ' mm');
    row(3, 'work in: ∫F₁dx', Lt.W.toFixed(4) + ' J', th.ok);
    if (!narrow) {
      row(4, 'load Mgy + oil lifted', Lt.Eload.toFixed(4) + ' + ' + Lt.Eoil.toFixed(4) + ' J');
      row(5, '30 cm strokes to lift it 10 cm', Lt.strokes.toFixed(1));
    }
  }

  const DT = { xL: -0.45, top: 1.0, Wd: 0.5 };
  function drawDam(S, g) {
    const ctx = g.ctx, th = g.theme, p = S.p, W = g.w, H = g.h, cam = S.cam, D = S.Dm;
    const narrow = W < 660, K = 2.4, B = window.BENCH;
    const F = R3.Frame(ctx, cam, { ambient: 0.3, floorZ: null });
    const m = (x, y, z) => [x * K, y * K, z * K];
    const ca = Math.cos(D.al), sa = Math.sin(D.al), wy = D.w / 2, xw = 0;
    const xAt = z => xw + z * ca / sa;                          // the wall's face at height z
    B.table(F, (DT.xL - 0.12) * K, (xAt(DT.top) + 0.30) * K, -(wy + 0.12) * K, (wy + 0.12) * K, -0.02 * K, { legs: false, tone: '#5A4632', seed: 57, thick: 0.05 });
    // water, and oil on top: prisms between the back wall and the tilted face
    const prism = (z0, z1, col, a, bias) => {
      const P8 = [m(DT.xL, -wy, z0), m(xAt(z0), -wy, z0), m(DT.xL, wy, z0), m(xAt(z0), wy, z0),
                  m(DT.xL, -wy, z1), m(xAt(z1), -wy, z1), m(DT.xL, wy, z1), m(xAt(z1), wy, z1)];
      F.push(m((DT.xL + xAt((z0 + z1) / 2)) / 2, 0, (z0 + z1) / 2), () => {
        const Hh = convexFill(ctx, cam, P8, RX.rgba(col, a), null);
        const top = [P8[4], P8[5], P8[7], P8[6]].map(q => cam.project(q));
        if (Hh && top.every(q => q.ok)) { ctx.fillStyle = RX.rgba(RX.mix(col, '#FFFFFF', 0.3), a + 0.1); polyPath(ctx, top); ctx.fill();
          ctx.strokeStyle = RX.rgba(RX.mix(col, '#FFFFFF', 0.6), 0.8); ctx.lineWidth = 1; polyPath(ctx, top); ctx.stroke(); }
      }, bias);
    };
    prism(0, D.hw, LIQ.water.col, 0.42, -0.02);
    if (D.ho > 0) prism(D.hw, D.H, OILH.col, 0.5, -0.03);
    // glass sides and the back wall
    [[-wy], [wy]].forEach(([y]) => {
      const pts = [m(DT.xL, y, 0), m(xw, y, 0), m(xAt(DT.top), y, DT.top), m(DT.xL, y, DT.top)];
      flatPoly(F, pts, 'rgba(170,215,240,.07)', { bias: -0.05 });
      path3(F, pts.concat([pts[0]]), '#D2EBFF', { alpha: 0.45, width: 1, chunk: 1, bias: -0.05 });
    });
    flatPoly(F, [m(DT.xL, -wy, 0), m(DT.xL, wy, 0), m(DT.xL, wy, DT.top), m(DT.xL, -wy, DT.top)], 'rgba(170,215,240,.07)', { bias: -0.05 });
    // the wall itself: a concrete slab along the slant
    const th2 = 0.06, n = [sa, 0, -ca], t = [ca, 0, sa], Lw = DT.top / sa;
    const wc = [xw + t[0] * Lw / 2 + n[0] * th2 / 2, 0, t[2] * Lw / 2 + n[2] * th2 / 2];
    R3.box(F, m(...wc), [th2 * K, (D.w + 0.02) * K, Lw * K], '#8E8A80', { shadow: false, axes: [n, [0, 1, 0], t] });
    // pressure on the face: one arrow per strip, length ∝ p, pointing into the wall
    const pMax = Math.max(1, D.pBase), NA = 11;
    for (let i = 0; i < NA; i++) {
      const s = (i + 0.5) / NA * D.Ls, z = s * sa, pr = D.pr(D.H - z), len = 0.28 * pr / pMax;
      if (len < 0.006) continue;
      const P = [xw + s * ca, -wy - 0.01, z], Q = [P[0] - n[0] * len, P[1], P[2] - n[2] * len];
      R3.arrow(F, m(...Q), m(...P), 0.0045 * K, z > D.hw ? '#F2C879' : '#7FD0FF', { vivid: true });
    }
    // the resultant, at the centre of pressure
    const Pc = [xw + D.sCp * ca, -wy - 0.01, D.zCp], Lr = 0.34, Qc = [Pc[0] - n[0] * Lr, Pc[1], Pc[2] - n[2] * Lr];
    R3.arrow(F, m(...Qc), m(...Pc), 0.011 * K, '#FF8FB0', { vivid: true });
    R3.label(F, m(...Qc), 'F = ' + D.F.toFixed(1) + ' N', '#FF8FB0', { size: 11, dy: -12 });
    R3.callout(F, m(xw + D.sCp * ca, wy, D.zCp), 44, 10, 'centre of pressure ' + (D.zCp * 100).toFixed(2) + ' cm up', '#FFB8CC', { size: 9.5 });
    if (D.ho > 0) R3.callout(F, m(DT.xL, -wy, D.hw), -40, 0, 'oil on water at ' + (D.hw * 100).toFixed(0) + ' cm', '#F2C879', { size: 9.5 });
    F.render();
    const q = cam.project(m(DT.xL + 0.08, -wy, D.H)), q2 = cam.project(m(DT.xL + 0.08, -wy, D.H + 0.1));
    if (q.ok && q2.ok && D.ho === 0) { S._axD = axis2(q, q2, 0.1); ringHandle(g, q, 'dlv', '#7FD0FF', 9); }
    header(g, 'The force on a wall: pressure summed strip by strip',
      (D.ho > 0 ? 'oil ' + p.doil.toFixed(0) + ' cm on ' : '') + 'water ' + p.dH.toFixed(0) + ' cm · wall ' + p.dw.toFixed(0) + ' cm wide, at ' + p.dang.toFixed(0) + '° · 800 strips',
      'F = ∫p w ds · horizontal part = ρgwH²/2 whatever the tilt · it acts H/3 above the base', th.text);
    const rows = narrow ? 4 : 6, bw = narrow ? W - 24 : 292, bh = 26 + rows * 15 + 10;
    const row = gPanel(g, 12, H - bh - 30, bw, bh, 'WHAT THE STRIPS ADD UP TO');
    row(0, 'force on the face, summed', D.F.toFixed(2) + ' N', th.phys);
    row(1, 'formula', D.Fform.toFixed(2) + ' N', th.ok);
    row(2, 'horizontal · vertical part', D.Fx.toFixed(1) + ' · ' + D.Fz.toFixed(1) + ' N');
    row(3, 'centre of pressure above the base', (D.zCp * 100).toFixed(2) + ' cm');
    if (!narrow) {
      row(4, 'moment about the bottom edge', D.Mb.toFixed(2) + ' N·m');
      row(5, 'pressure at the base', (D.pBase / 1000).toFixed(3) + ' kPa');
    }
  }

  function drawDrops(S, g) {
    const ctx = g.ctx, th = g.theme, p = S.p, W = g.w, H = g.h, cam = S.cam, D = S.Dr;
    const narrow = W < 660;
    const F = R3.Frame(ctx, cam, { ambient: 0.35, floorZ: null });
    const B = window.BENCH, sp = 1.6 / Math.max(1, (D.k - 1) * 3), zc = 1.2;    // scene units per r
    B.table(F, -1.3, 1.3, -0.9, 0.9, 0, { legs: false, tone: '#3E4656', seed: 5, thick: 0.05 });
    const mNow = dropsAbsorbed(D, S.ts), col = D.Lq.col, metal = p.dliq === 'mercury';
    const tStep = D.tE / Math.max(1, D.n - 1), fly = Math.min(0.6, 40 * tStep);
    // a thousand lit balls a frame: each is one pre-shaded sprite, depth-sorted by hand
    const spr = dropSprite(col, metal), Rm = sp * Math.cbrt(mNow + 1), list = [[0, 0, zc, Rm]];
    for (let i = mNow + 1; i < D.n; i++) {
      const ti = i * tStep, f = clamp((S.ts - (ti - fly)) / fly, 0, 1), e = f * f, q = D.pos[i];
      list.push([q[0] * sp * (1 - e), q[1] * sp * (1 - e), zc + q[2] * sp * (1 - e), sp]);
    }
    const ey = cam.eye;
    list.forEach(d => { d[4] = (d[0] - ey[0]) ** 2 + (d[1] - ey[1]) ** 2 + (d[2] - ey[2]) ** 2; });
    list.sort((u, v) => v[4] - u[4]);
    F.push([0, 0, zc], () => {
      list.forEach(d => {
        const q = cam.project([d[0], d[1], d[2]]); if (!q.ok) return;
        const rp = d[3] * q.s; if (rp < 0.3) return;
        ctx.drawImage(spr, q.x - rp, q.y - rp, 2 * rp, 2 * rp);
      });
    }, 0);
    const E = D.T * (D.A0 - D.area(mNow));
    R3.label(F, [0, 0, zc + Rm], (mNow + 1) + ' merged', '#F2F6FF', { size: 10, dy: -12 });
    F.render();
    header(g, 'Drops merge: surface energy becomes heat',
      D.n + ' drops of ' + D.Lq.name + ', r = ' + p.rdr.toFixed(2) + ' mm → one of R = ' + (D.R * 1000).toFixed(2) + ' mm · T = ' + (D.T * 1000).toFixed(1) + ' mN/m',
      'E = T·ΔA = 4πR²T(n^⅓ − 1) · ΔT = (3T/ρc)(1/r − 1/R)', th.text);
    const rows = narrow ? 4 : 6, bw = narrow ? W - 24 : 292, bh = 26 + rows * 15 + 10;
    const row = gPanel(g, 12, H - bh - 30, bw, bh, 'SURFACE AREA, SUMMED OVER EVERY DROP');
    row(0, 'area now · at the start', (D.area(mNow) * 1e4).toFixed(3) + ' · ' + (D.A0 * 1e4).toFixed(3) + ' cm²');
    row(1, 'energy set free so far', (E * 1e3).toFixed(4) + ' mJ', th.phys);
    row(2, 'when all have merged · formula', (D.E * 1e3).toFixed(4) + ' · ' + (D.Eform * 1e3).toFixed(4) + ' mJ', th.ok);
    row(3, 'temperature rise (no loss)', (D.dT * 1e3).toPrecision(4) + ' mK');
    if (!narrow) {
      row(4, 'mass of liquid', (D.mass * 1e3).toFixed(3) + ' g');
      row(5, 'to split it back: work needed', (D.E * 1e3).toFixed(4) + ' mJ');
    }
  }

  /* the venturi's Cd against Reynolds number, for every flow and both liquids */
  const CDC = {};
  function cdCurve(p) {
    const key = p.beta + '|' + p.hback;
    if (CDC[key]) return CDC[key];
    const out = {};
    ['water', 'oil'].forEach(fl => {
      const pts = [];
      for (let lq = Math.log10(0.5); lq <= Math.log10(60); lq += 0.05) {
        const V = runVenturi(Object.assign({}, p, { vfluid: fl, Qlpm: Math.pow(10, lq), loss: true }));
        pts.push([Math.log10(V.Re1), V.Cd]);
      }
      out[fl] = pts;
    });
    return (CDC[key] = out);
  }

  const TNK = S => S.p.mode === 'tank', VEN = S => S.p.mode === 'venturi', BAL = S => S.p.mode === 'ball',
        BUO = S => S.p.mode === 'buoy', CAP = S => S.p.mode === 'cap',
        FRM = S => S.p.mode === 'frame', ACC = S => S.p.mode === 'frame' && S.p.fsub === 'accel', ROT = S => S.p.mode === 'frame' && S.p.fsub === 'rotate',
        BBL = S => S.p.mode === 'bubbles', UTB = S => S.p.mode === 'utube',
        PSC = S => S.p.mode === 'pascal', LFT = S => S.p.mode === 'pascal' && S.p.psub === 'lift', DAM = S => S.p.mode === 'pascal' && S.p.psub === 'dam',
        DRP = S => S.p.mode === 'drops';

  L.register({
    id: 'fluids', subject: 'physics',
    name: 'Fluids — Pressure, Flow, Viscosity and Surface Tension',
    chapter: 'Mechanical Properties of Fluids',
    exams: ['JEE Main', 'JEE Advanced', 'NEET UG'],
    weight: 'Very high yield',
    is3D: true,
    stageHint: 'Drag to orbit · drag the rings: the hole and the level, the hook on the spring balance, the pump handle, the water level',
    lede: 'Every piece of fluid apparatus here <b>computes</b> what it shows. The tank <b>drains</b>: its level is integrated ' +
      'from continuity and Torricelli, and each jet flies as a projectile to where it lands on the rule. The venturimeter ' +
      'marches Bernoulli along the pipe with <b>real friction</b>, so its discharge coefficient comes out below one, and a narrow ' +
      'enough throat will <b>boil cold water</b>. The ball in the viscometer is timed between two light gates, so you can watch ' +
      'Stokes\' law <b>fail</b> as it speeds up. The spring balance and the scale show both halves of Archimedes at once. ' +
      'The capillaries rise with their own inertia, and a tube that is too short <b>does not overflow</b>. ' +
      'The hydraulic lift integrates the effort over the whole stroke, the wall sums its pressure over 800 strips, ' +
      'and a thousand drops merge one by one while their surface area is added up.',

    params: { mode: 'tank', H0: 50, y1: 12.5, dmm: 5, Dt: 15, real: false, two: false, hold: false,
              vfluid: 'water', Qlpm: 12, beta: 0.5, loss: true, hback: 25,
              bfluid: 'glycerine', ball: 'steel', rmm: 1, TC: 20, wall: true,
              block: 'aluminium', liq: 'water', lower: 12, cut: false,
              cliq: 'water', waxed: false, crmm: 0.1, Lcm: 16,
              fsub: 'accel', acc: 3, omg: 12, r1: 2, r2: 4, sig: 0.025, open: false, liq2: 'oil', hoil: 10, slosh: false,
              psub: 'lift', d1: 2, d2: 20, Mkg: 1000, xs: 20, dH: 60, doil: 0, dw: 50, dang: 90, nk: 10, rdr: 1, dliq: 'water', run: true },

    presets: [
      { name: 'Torricelli · one hole, 50 cm of water', params: { mode: 'tank', H0: 50, y1: 12.5, dmm: 5, Dt: 15, real: false, two: false, hold: false } },
      { name: 'Two holes, one range', params: { mode: 'tank', H0: 50, y1: 12.5, dmm: 5, Dt: 15, real: false, two: true, hold: false } },
      { name: 'The best hole · halfway down', params: { mode: 'tank', H0: 50, y1: 25, dmm: 5, Dt: 15, real: false, two: false, hold: true } },
      { name: 'Real orifice · vena contracta', params: { mode: 'tank', H0: 50, y1: 12.5, dmm: 5, Dt: 15, real: true, two: false, hold: false } },
      { name: 'Venturimeter · water, 12 L/min', params: { mode: 'venturi', vfluid: 'water', Qlpm: 12, beta: 0.5, loss: true, hback: 25 } },
      { name: 'Open exit · the throat sucks air', params: { mode: 'venturi', vfluid: 'water', Qlpm: 12, beta: 0.5, loss: true, hback: 0 } },
      { name: 'Narrow throat, fast · cavitation', params: { mode: 'venturi', vfluid: 'water', Qlpm: 34, beta: 0.25, loss: true, hback: 5 } },
      { name: 'Light oil · laminar, Cd falls', params: { mode: 'venturi', vfluid: 'oil', Qlpm: 12, beta: 0.5, loss: true, hback: 25 } },
      { name: 'Viscometer · steel ⌀ 2 mm in glycerine', params: { mode: 'ball', bfluid: 'glycerine', ball: 'steel', rmm: 1, TC: 20, wall: true } },
      { name: 'Big ball · Stokes fails', params: { mode: 'ball', bfluid: 'glycerine', ball: 'steel', rmm: 5, TC: 20, wall: true } },
      { name: 'Steel in water · Re ≫ 1', params: { mode: 'ball', bfluid: 'water', ball: 'steel', rmm: 1, TC: 20, wall: true } },
      { name: 'Aluminium into water', params: { mode: 'buoy', block: 'aluminium', liq: 'water', lower: 18, cut: false } },
      { name: 'Wood floats · string goes slack', params: { mode: 'buoy', block: 'wood', liq: 'water', lower: 16, cut: false } },
      { name: 'Iron floats on mercury', params: { mode: 'buoy', block: 'iron', liq: 'mercury', lower: 16, cut: false } },
      { name: 'Accelerating cart · the surface tilts', params: { mode: 'frame', fsub: 'accel', acc: 3 } },
      { name: 'Spinning vessel · a paraboloid', params: { mode: 'frame', fsub: 'rotate', omg: 12 } },
      { name: 'Spin until the centre runs dry', params: { mode: 'frame', fsub: 'rotate', omg: 29 } },
      { name: 'Two bubbles · open the valve', params: { mode: 'bubbles', r1: 2, r2: 4, sig: 0.025, open: true } },
      { name: 'U-tube · oil on water', params: { mode: 'utube', liq2: 'oil', hoil: 10, slosh: false } },
      { name: 'U-tube · tip it and let go', params: { mode: 'utube', liq2: 'none', hoil: 10, slosh: true } },
      { name: 'Capillaries · water in clean glass', params: { mode: 'cap', cliq: 'water', waxed: false, crmm: 0.1, Lcm: 16 } },
      { name: 'Tube too short · no fountain', params: { mode: 'cap', cliq: 'water', waxed: false, crmm: 0.1, Lcm: 10 } },
      { name: 'Mercury is pushed down', params: { mode: 'cap', cliq: 'mercury', waxed: false, crmm: 0.25, Lcm: 16 } },
      { name: 'Hydraulic lift · 1000 kg on ⌀ 20 cm', params: { mode: 'pascal', psub: 'lift', d1: 2, d2: 20, Mkg: 1000, xs: 20 } },
      { name: 'Lift · a narrower pump, a longer job', params: { mode: 'pascal', psub: 'lift', d1: 1, d2: 30, Mkg: 1500, xs: 30 } },
      { name: 'Force on a wall · 60 cm of water', params: { mode: 'pascal', psub: 'dam', dH: 60, doil: 0, dw: 50, dang: 90 } },
      { name: 'Wall tilted to 60°', params: { mode: 'pascal', psub: 'dam', dH: 60, doil: 0, dw: 50, dang: 60 } },
      { name: 'Oil on water against a wall', params: { mode: 'pascal', psub: 'dam', dH: 40, doil: 20, dw: 50, dang: 90 } },
      { name: '1000 water drops merge', params: { mode: 'drops', nk: 10, rdr: 1, dliq: 'water' } },
      { name: 'Mercury drops · more heat per gram', params: { mode: 'drops', nk: 10, rdr: 1, dliq: 'mercury' } }
    ],

    controls: [
      { group: 'What is set up', items: [
        { key: 'mode', type: 'select', label: 'Apparatus', restructure: true, rebuild: true, options: [
          { value: 'tank', label: 'Draining tank' }, { value: 'venturi', label: 'Venturimeter' }, { value: 'ball', label: 'Falling ball' },
          { value: 'buoy', label: 'Archimedes' }, { value: 'cap', label: 'Capillaries' }, { value: 'frame', label: 'Moving frames' },
          { value: 'bubbles', label: 'Soap bubbles' }, { value: 'utube', label: 'U-tube' },
          { value: 'pascal', label: 'Pascal and walls' }, { value: 'drops', label: 'Merging drops' }] }
      ] },
      { group: 'Tank and orifice', items: [
        { key: 'H0', label: 'Starting water level <i>H</i>', min: 10, max: 70, step: 0.5, unit: 'cm', when: TNK, fmt: v => v.toFixed(1), restructure: true },
        { key: 'y1', label: 'Hole height above the bench <i>y</i>', min: 1, max: 69, step: 0.5, unit: 'cm', when: TNK, fmt: v => v.toFixed(1), restructure: true },
        { key: 'dmm', label: 'Hole diameter', min: 2, max: 12, step: 0.1, unit: 'mm', when: TNK, fmt: v => v.toFixed(1), restructure: true },
        { key: 'Dt', label: 'Tank diameter', min: 8, max: 30, step: 0.5, unit: 'cm', when: TNK, fmt: v => v.toFixed(1), restructure: true },
        { key: 'two', type: 'toggle', label: 'Second hole, at H − y', restructure: true, when: TNK },
        { key: 'real', type: 'toggle', label: 'Real sharp-edged orifice', restructure: true, when: TNK },
        { key: 'hold', type: 'toggle', label: 'Hold the level (constant head)', restructure: true, when: TNK }
      ] },
      { group: 'The pipe', items: [
        { key: 'vfluid', type: 'select', label: 'Liquid', restructure: true, when: VEN, options: [
          { value: 'water', label: 'Water' }, { value: 'oil', label: 'Light oil' }] },
        { key: 'Qlpm', label: 'Flow rate <i>Q</i>', min: 0.5, max: 60, step: 0.1, unit: 'L/min', when: VEN, fmt: v => v.toFixed(1), restructure: true },
        { key: 'beta', label: 'Throat ÷ pipe diameter β', min: 0.25, max: 0.9, step: 0.01, unit: '', when: VEN, fmt: v => v.toFixed(2), restructure: true },
        { key: 'hback', label: 'Back-pressure at the valve', min: 0, max: 40, step: 0.5, unit: 'cm', when: VEN, fmt: v => v.toFixed(1), restructure: true },
        { key: 'loss', type: 'toggle', label: 'Friction and diffuser loss', restructure: true, when: VEN }
      ] },
      { group: 'The viscometer', items: [
        { key: 'bfluid', type: 'select', label: 'Liquid', restructure: true, when: BAL, options: [
          { value: 'glycerine', label: 'Glycerine' }, { value: 'castor', label: 'Castor oil' }, { value: 'water', label: 'Water' }] },
        { key: 'ball', type: 'select', label: 'Ball', restructure: true, when: BAL, options: [
          { value: 'steel', label: 'Steel' }, { value: 'glass', label: 'Glass' }, { value: 'lead', label: 'Lead' }, { value: 'nylon', label: 'Nylon' }] },
        { key: 'rmm', label: 'Ball radius <i>r</i>', min: 0.25, max: 8, step: 0.05, unit: 'mm', when: BAL, fmt: v => v.toFixed(2), restructure: true },
        { key: 'TC', label: 'Temperature', min: 5, max: 45, step: 0.5, unit: '°C', when: BAL, fmt: v => v.toFixed(1), restructure: true },
        { key: 'wall', type: 'toggle', label: 'The tube wall slows the ball (⌀ 50 mm)', restructure: true, when: BAL }
      ] },
      { group: 'Spring balance and beaker', items: [
        { key: 'block', type: 'select', label: 'Block (5 cm cube)', restructure: true, when: BUO, options: [
          { value: 'aluminium', label: 'Aluminium' }, { value: 'iron', label: 'Iron' }, { value: 'wood', label: 'Pine' },
          { value: 'ice', label: 'Ice' }, { value: 'wax', label: 'Wax' }] },
        { key: 'liq', type: 'select', label: 'Liquid in the beaker', restructure: true, when: BUO, options: [
          { value: 'water', label: 'Water' }, { value: 'brine', label: 'Brine' }, { value: 'kerosene', label: 'Kerosene' }, { value: 'mercury', label: 'Mercury' }] },
        { key: 'lower', label: 'Lower the hook by', min: 0, max: 22, step: 0.05, unit: 'cm', when: BUO, fmt: v => v.toFixed(2), restructure: true },
        { key: 'cut', type: 'toggle', label: 'Cut the string', restructure: true, when: BUO }
      ] },
      { group: 'Capillary tubes', items: [
        { key: 'cliq', type: 'select', label: 'Liquid', restructure: true, when: CAP, options: [
          { value: 'water', label: 'Water' }, { value: 'ethanol', label: 'Ethanol' }, { value: 'soapy', label: 'Soapy water' }, { value: 'mercury', label: 'Mercury' }] },
        { key: 'crmm', label: 'Narrowest radius <i>r</i> (others 2r, 4r)', min: 0.05, max: 0.6, step: 0.005, unit: 'mm', when: CAP, fmt: v => v.toFixed(3), restructure: true },
        { key: 'Lcm', label: 'Tube length above the surface', min: 2, max: 16, step: 0.1, unit: 'cm', when: CAP, fmt: v => v.toFixed(1), restructure: true },
        { key: 'waxed', type: 'toggle', label: 'Wax-coated tubes (θ = 105°)', restructure: true, when: CAP }
      ] },
      { group: 'The moving vessel', items: [
        { key: 'fsub', type: 'select', label: 'Motion', restructure: true, rebuild: true, when: FRM, options: [
          { value: 'accel', label: 'Accelerating cart' }, { value: 'rotate', label: 'Spinning vessel' }] },
        { key: 'acc', label: 'Acceleration <i>a</i>', min: -6, max: 6, step: 0.05, unit: 'm/s²', when: ACC, fmt: v => v.toFixed(2), restructure: true },
        { key: 'omg', label: 'Spin rate ω', min: 0, max: 32, step: 0.1, unit: 'rad/s', when: ROT, fmt: v => v.toFixed(1), restructure: true }
      ] },
      { group: 'Two soap bubbles', items: [
        { key: 'r1', label: 'Left bubble radius', min: 1, max: 6, step: 0.05, unit: 'cm', when: BBL, fmt: v => v.toFixed(2), restructure: true },
        { key: 'r2', label: 'Right bubble radius', min: 1, max: 6, step: 0.05, unit: 'cm', when: BBL, fmt: v => v.toFixed(2), restructure: true },
        { key: 'sig', label: 'Surface tension <i>T</i>', min: 0.015, max: 0.073, step: 0.001, unit: 'N/m', when: BBL, fmt: v => v.toFixed(3), restructure: true },
        { key: 'open', type: 'toggle', label: 'Open the valve', restructure: true, when: BBL }
      ] },
      { group: 'The U-tube', items: [
        { key: 'liq2', type: 'select', label: 'Poured into the right arm', restructure: true, when: UTB, options: [
          { value: 'none', label: 'Nothing' }, { value: 'oil', label: 'Light oil' }, { value: 'kerosene', label: 'Kerosene' }, { value: 'ethanol', label: 'Ethanol' }] },
        { key: 'hoil', label: 'Its column length', min: 0, max: 20, step: 0.1, unit: 'cm', when: UTB, fmt: v => v.toFixed(1), restructure: true },
        { key: 'slosh', type: 'toggle', label: 'Tip it 4 cm and let go', restructure: true, when: UTB }
      ] },
      { group: 'Pascal and walls', items: [
        { key: 'psub', type: 'select', label: 'Apparatus', restructure: true, rebuild: true, when: PSC, options: [
          { value: 'lift', label: 'Hydraulic lift' }, { value: 'dam', label: 'Force on a wall' }] },
        { key: 'd1', label: 'Small piston diameter', min: 1, max: 5, step: 0.1, unit: 'cm', when: LFT, fmt: v => v.toFixed(1), restructure: true },
        { key: 'd2', label: 'Large piston diameter', min: 10, max: 30, step: 0.5, unit: 'cm', when: LFT, fmt: v => v.toFixed(1), restructure: true },
        { key: 'Mkg', label: 'Load <i>M</i>', min: 100, max: 3000, step: 10, unit: 'kg', when: LFT, fmt: v => v.toFixed(0), restructure: true },
        { key: 'xs', label: 'Stroke of the small piston', min: 0, max: 30, step: 0.5, unit: 'cm', when: LFT, fmt: v => v.toFixed(1), restructure: true },
        { key: 'dH', label: 'Water depth', min: 5, max: 80, step: 0.5, unit: 'cm', when: DAM, fmt: v => v.toFixed(1), restructure: true },
        { key: 'doil', label: 'Oil layer on top (ρ 870)', min: 0, max: 30, step: 0.5, unit: 'cm', when: DAM, fmt: v => v.toFixed(1), restructure: true },
        { key: 'dw', label: 'Wall width <i>w</i>', min: 20, max: 100, step: 1, unit: 'cm', when: DAM, fmt: v => v.toFixed(0), restructure: true },
        { key: 'dang', label: 'Wall angle to the floor', min: 45, max: 90, step: 1, unit: '°', when: DAM, fmt: v => v.toFixed(0), restructure: true }
      ] },
      { group: 'Merging drops', items: [
        { key: 'nk', label: 'Drops per side <i>k</i> (n = k³)', min: 2, max: 10, step: 1, unit: '', when: DRP, fmt: v => v.toFixed(0) + ' → ' + Math.pow(Math.round(v), 3), restructure: true },
        { key: 'rdr', label: 'Drop radius <i>r</i>', min: 0.1, max: 3, step: 0.05, unit: 'mm', when: DRP, fmt: v => v.toFixed(2), restructure: true },
        { key: 'dliq', type: 'select', label: 'Liquid', restructure: true, when: DRP, options: [
          { value: 'water', label: 'Water' }, { value: 'mercury', label: 'Mercury' }, { value: 'soapy', label: 'Soapy water' }] }
      ] },
      { group: 'Display', items: [
        { key: 'run', type: 'toggle', label: 'Let it run' }
      ] }
    ],

    setup(S) {
      const p = S.p;
      if (p.mode === 'tank') { if (p.y1 > p.H0 - 1) p.y1 = p.H0 - 1; S.Tk = runTank(p); }
      else if (p.mode === 'venturi') { S.V = runVenturi(p); }
      else if (p.mode === 'ball') { S.Bl = runBall(p); }
      else if (p.mode === 'buoy') { S.bs = buoyState(p, p.lower / 100); S.rel = p.cut ? runRelease(p) : null; }
      else if (p.mode === 'frame') { if (p.fsub === 'accel') S.Ac = runAccel(p); else { S.Rt = runRotate(p); S.spin = S.spin || 0; } }
      else if (p.mode === 'bubbles') { S.Bb = runBubbles(p); }
      else if (p.mode === 'utube') { S.U = runUtube(p); }
      else if (p.mode === 'pascal') { if (p.dH + p.doil > 100) p.doil = 100 - p.dH; if (p.psub === 'lift') S.Lt = runLift(p); else S.Dm = runDam(p); }
      else if (p.mode === 'drops') { S.Dr = runDrops(p); }
      else { S.C = runCap(Object.assign({}, p, { rmm: p.crmm })); }
      S.ts = 0; S.hold = 0;
      const views = {
        tank: { theta: -1.38, phi: 0.24, dist: 2.75, target: [0.02, 0, 0.55] },
        venturi: { theta: -1.40, phi: 0.18, dist: 3.0, target: [0, 0, 0.90] },
        ball: { theta: -1.30, phi: 0.16, dist: 3.1, target: [0.05, 0, 0.95] },
        buoy: { theta: -1.30, phi: 0.20, dist: 4.9, target: [0.05, 0, 1.40] },
        cap: { theta: -1.48, phi: 0.20, dist: 2.55, target: [0.03, 0, 0.66] },
        frame: { theta: -1.30, phi: 0.30, dist: 3.3, target: [0, 0, 0.55] },
        bubbles: { theta: -1.45, phi: 0.22, dist: 2.7, target: [0, 0, 0.85] },
        utube: { theta: -1.50, phi: 0.12, dist: 3.4, target: [0, 0, 1.15] },
        'pascal-lift': { theta: -1.38, phi: 0.20, dist: 4.4, target: [-0.1, 0, 1.05] },
        'pascal-dam': { theta: -1.22, phi: 0.22, dist: 5.4, target: [0.1, 0, 1.0] },
        drops: { theta: -1.30, phi: 0.25, dist: 4.4, target: [0, 0, 1.15] }
      };
      const vk = p.mode === 'pascal' ? 'pascal-' + p.psub : p.mode;
      if (!S.cam || S._view !== vk) { S.cam = Camera(views[vk]); S.cam.minDist = 1.0; S.cam.maxDist = 12; S._view = vk; S._narrowCam = false; }
    },

    step(S, dt) {
      const p = S.p;
      if (!p.run) return;
      if (S.hold > 0) { S.hold -= dt; if (S.hold <= 0) S.ts = 0; return; }
      let end = 0, rate = 1;
      if (p.mode === 'tank') { end = p.hold ? 1e9 : S.Tk.tDrain; rate = p.hold ? 1 : Math.max(1, S.Tk.tDrain / 24); }
      else if (p.mode === 'ball') { end = S.Bl.tEnd; rate = Math.max(1, S.Bl.tEnd / 12); if (S.Bl.tEnd < 3) rate = S.Bl.tEnd / 4; }
      else if (p.mode === 'buoy') { end = p.cut ? 6 : 1e9; rate = 0.5; }
      else if (p.mode === 'cap') { end = S.C.tEnd; rate = S.C.tEnd / 15; }
      else if (p.mode === 'frame') {
        if (p.fsub === 'accel') { end = 10; rate = 1; }
        else { const wf = S.Rt.w * (1 - Math.exp(-S.ts / Math.max(0.05, S.Rt.tau))); S.spin = (S.spin + wf * dt * 0.25) % TAU; end = 1e9; rate = 1; }
      }
      else if (p.mode === 'bubbles') { end = p.open ? S.Bb.tEnd : 1e9; rate = p.open ? Math.max(0.2, S.Bb.tEnd / 12) : 1; }
      else if (p.mode === 'utube') { end = p.slosh ? 8 : 1e9; rate = p.slosh ? 0.7 : 1; }
      else if (p.mode === 'pascal') { end = p.psub === 'lift' ? 3 : 1e9; rate = 1; }
      else if (p.mode === 'drops') { end = S.Dr.tE; rate = 1; }
      else { end = 1e9; rate = 1; }
      S.ts += dt * rate;
      if (S.ts >= end) { S.ts = end; S.hold = 2.5; }
    },

    drawStage(S, g) {
      if (g.w < 660 && !S._narrowCam) { S.cam.dist *= 1.3; S._narrowCam = true; }
      const md = S.p.mode;
      if (md === 'tank') drawTank(S, g);
      else if (md === 'venturi') drawVenturi(S, g);
      else if (md === 'ball') drawBall(S, g);
      else if (md === 'buoy') drawBuoy(S, g);
      else if (md === 'frame') drawFrame(S, g);
      else if (md === 'bubbles') drawBubbles(S, g);
      else if (md === 'utube') drawUtube(S, g);
      else if (md === 'pascal') { if (S.p.psub === 'lift') drawLift(S, g); else drawDam(S, g); }
      else if (md === 'drops') drawDrops(S, g);
      else drawCap(S, g);
    },

    onDrag(S, e) {
      const p = S.p, along = a => a ? (e.dx * a.ux + e.dy * a.uy) * a.per : 0;
      if (e.id === 'hole' && S._axH) { p.y1 = clamp(p.y1 + along(S._axH) * 100, 1, p.H0 - 1); this.setup(S); }
      else if (e.id === 'lvl' && S._axL) { p.H0 = clamp(p.H0 + along(S._axL) * 100, Math.max(10, p.y1 + 1), 70); this.setup(S); }
      else if (e.id === 'hook' && S._axB) { p.lower = clamp(p.lower + along(S._axB) * 100, 0, 22); this.setup(S); }
      else if (e.id === 'pst' && S._axP) { p.xs = clamp(p.xs + along(S._axP) * 100, 0, 30); this.setup(S); S.ts = 3; }
      else if (e.id === 'dlv' && S._axD) { p.dH = clamp(p.dH + along(S._axD) * 100, 5, 80); this.setup(S); }
    },

    plots: [
      { title: S => ({ frame: S.p.fsub === 'accel' ? 'Tilt of the surface, the pendulum and the balloon' : 'The surface profile — now, and when fully spun up',
                       bubbles: 'Each bubble\'s radius as the air moves', utube: S.p.slosh ? 'The column\'s swing against time' : 'Pressure down each arm',
                       tank: 'Level and range as the tank drains', venturi: 'Pressure head along the pipe — and the energy line above it',
                       ball: 'The ball\'s speed as it falls', buoy: 'Both readings as the block is lowered',
                       cap: 'Each column\'s height against time',
                       pascal: S.p.psub === 'lift' ? 'The effort through the stroke' : 'Pressure up the wall',
                       drops: 'Energy set free as the drops merge' })[S.p.mode],
        draw(S, g) {
          const p = S.p, th = g.theme, cy = '#3DD6F5', gr = '#7CF0B0', am = '#F5B451', pk = '#FF8FB0', vi = '#B8A4FF';
          if (p.mode === 'pascal' && p.psub === 'lift') {
            const Lt = S.Lt, lo = Lt.F0, hi = Lt.F1(0.30), pad = Math.max((hi - lo) * 0.25, lo * 0.002), xn = Lt.X * clamp(S.ts / 3, 0, 1);
            const P = g.Plot({ xmin: 0, xmax: 30, ymin: lo - pad, ymax: hi + pad, xlabel: 'stroke x (cm)', ylabel: 'effort F₁ (N)', xfmt: v => v.toFixed(0), yfmt: v => v.toFixed(2) }).frame();
            P.clip(() => { P.hline(lo, g.alpha(th['text-2'], .7), [4, 3]); P.line(Lt.pts, gr, 2.2); P.dot(xn * 100, Lt.F1(xn), 5.5, gr, th['ink-950']); });
            P.tag(0.5, lo, 'Mg·A₁/A₂ alone', th['text-2'], 'left', 12);
            P.tag(29.5, hi, '+ ρg·x(1 + A₁/A₂)·A₁', gr, 'right', -8);
            return;
          }
          if (p.mode === 'pascal') {
            const D = S.Dm, pts = [];
            for (let z = 0; z <= D.H + 1e-9; z += D.H / 200) pts.push([D.pr(D.H - z) / 1000, z * 100]);
            const P = g.Plot({ xmin: 0, xmax: D.pBase / 1000 * 1.15, ymin: 0, ymax: D.H * 100 * 1.1, xlabel: 'gauge pressure (kPa)', ylabel: 'height above the base (cm)', xfmt: v => v.toFixed(1), yfmt: v => v.toFixed(0) }).frame();
            P.clip(() => { P.area(pts.map(q => [q[0], q[1]]), 0, g.alpha(cy, .15)); P.line(pts, cy, 2.2); P.hline(D.zCp * 100, g.alpha(pk, .8), [4, 3]); if (D.ho > 0) P.hline(D.hw * 100, g.alpha(am, .7), [3, 3]); });
            P.tag(D.pBase / 1000 * 1.12, D.zCp * 100, 'centre of pressure', pk, 'right', -8);
            if (D.ho > 0) P.tag(D.pBase / 1000 * 1.12, D.hw * 100, 'oil–water interface: the slope changes', am, 'right', -8);
            return;
          }
          if (p.mode === 'drops') {
            const D = S.Dr, pts = [], step = Math.max(1, Math.floor((D.n - 1) / 200));
            for (let k = 0; k <= D.n - 1; k += step) pts.push([k + 1, D.T * (D.A0 - D.area(k)) * 1e3]);
            pts.push([D.n, D.E * 1e3]);
            const mNow = dropsAbsorbed(D, S.ts);
            const P = g.Plot({ xmin: 1, xmax: D.n, ymin: 0, ymax: D.E * 1e3 * 1.12, xlabel: 'drops in the big one', ylabel: 'energy set free (mJ)', xfmt: v => v.toFixed(0), yfmt: v => v.toPrecision(2) }).frame();
            P.clip(() => { P.line(pts, am, 2.2); P.hline(D.Eform * 1e3, g.alpha(th['text-2'], .7), [4, 3]); P.dot(mNow + 1, D.T * (D.A0 - D.area(mNow)) * 1e3, 5.5, am, th['ink-950']); });
            P.tag(D.n * 0.02, D.Eform * 1e3, '4πR²T(n^⅓ − 1)', th['text-2'], 'left', -8);
            return;
          }
          if (p.mode === 'frame' && p.fsub === 'accel') {
            const A = S.Ac, D = 180 / Math.PI;
            const s1 = A.pts.map(q => [q[0], Math.atan(q[1]) * D]), s2 = A.pts.map(q => [q[0], -q[2] * D]), s3 = A.pts.map(q => [q[0], q[3] * D]);
            const hi = Math.max(5, ...s1.concat(s2, s3).map(q => Math.abs(q[1]))) * 1.1;
            const P = g.Plot({ xmin: 0, xmax: 10, ymin: -hi * 0.2, ymax: hi, xlabel: 'time (s)', ylabel: 'angle (°)', xfmt: v => v.toFixed(0), yfmt: v => v.toFixed(0) }).frame();
            P.clip(() => { P.hline(A.thEq * D, g.alpha(th['text-2'], .7), [4, 3]); P.line(s2, am, 1.4); P.line(s3, pk, 1.4); P.line(s1, cy, 2.2); P.vline(S.ts, g.alpha(gr, .7), [3, 3]); });
            P.tag(9.8, A.thEq * D, 'tan θ = a/g', th['text-2'], 'right', -8);
            P.tag(0.3, hi * 0.92, 'surface', cy, 'left', 0); P.tag(2.0, hi * 0.92, 'pendulum (back)', am, 'left', 0); P.tag(5.0, hi * 0.92, 'balloon (forward)', pk, 'left', 0);
            return;
          }
          if (p.mode === 'frame') {
            const Rt = S.Rt, wf = Rt.w * (1 - Math.exp(-S.ts / Math.max(0.05, Rt.tau))), s0 = rotSurface(wf), s1 = rotSurface(Rt.w);
            const a0 = [], a1 = [];
            for (let r = -RV.R; r <= RV.R + 1e-9; r += RV.R / 60) { a0.push([r * 100, s0.z(Math.abs(r)) * 100]); a1.push([r * 100, s1.z(Math.abs(r)) * 100]); }
            const P = g.Plot({ xmin: -RV.R * 100, xmax: RV.R * 100, ymin: 0, ymax: RV.H * 100, xlabel: 'r (cm)', ylabel: 'surface height (cm)', xfmt: v => v.toFixed(0), yfmt: v => v.toFixed(0) }).frame();
            P.clip(() => { P.hline(RV.h0 * 100, g.alpha(th['text-3'], .7), [3, 3]); P.area(a0, 0, g.alpha(cy, .15)); P.line(a1, am, 1.4, [5, 3]); P.line(a0, cy, 2.2); });
            P.tag(-RV.R * 100 + 0.3, RV.h0 * 100, 'still: h₀', th['text-3'], 'left', -8);
            P.tag(RV.R * 100 - 0.3, s1.rim * 100, 'fully spun up', am, 'right', -8);
            return;
          }
          if (p.mode === 'bubbles') {
            const Bb = S.Bb, tE = Math.max(1, Bb.tEnd);
            const r1 = Bb.pts.map(q => [q[0], capR(q[1]) * 100]), r2 = Bb.pts.map(q => [q[0], capR(q[2]) * 100]);
            const hi = Math.max(...r1.concat(r2).map(q => q[1])) * 1.1;
            const P = g.Plot({ xmin: 0, xmax: tE, ymin: 0, ymax: Math.min(hi, 15), xlabel: 'time (s)', ylabel: 'radius of curvature (cm)', xfmt: v => v.toFixed(0), yfmt: v => v.toFixed(1) }).frame();
            P.clip(() => { P.hline(BUB.a * 100, g.alpha(th['text-3'], .7), [3, 3]); P.line(r1, cy, 2.2); P.line(r2, vi, 2.2); P.vline(S.ts, g.alpha(gr, .7), [3, 3]); });
            P.tag(tE * 0.02, BUB.a * 100, 'hemisphere on the mouth: the smallest R', th['text-3'], 'left', -8);
            return;
          }
          if (p.mode === 'utube') {
            const U = S.U;
            if (p.slosh) {
              const pts = U.pts.map(q => [q[0], q[1] * 100]);
              const P = g.Plot({ xmin: 0, xmax: 8, ymin: -5, ymax: 5, xlabel: 'time (s)', ylabel: 'displacement (cm)', xfmt: v => v.toFixed(0), yfmt: v => v.toFixed(0) }).frame();
              P.clip(() => { P.line([[0, 0], [8, 0]], g.alpha(th['text-3'], .6), 1); P.line(pts, cy, 2.2); P.vline(S.ts, g.alpha(gr, .7), [3, 3]); });
              P.tag(7.8, 4.3, 'T = ' + (U.Tm || U.T).toFixed(3) + ' s', cy, 'right', 0);
              return;
            }
            const zs = [], L = [], Rr = [];
            for (let z = UT.zb; z <= Math.max(U.zL, U.zR) + 1e-9; z += 0.002) {
              L.push([Math.max(0, U.zL - z) * U.rw * GF, z * 100]);
              const pr = z >= U.zi ? Math.max(0, U.zR - z) * U.ro * GF : U.ho * U.ro * GF + (U.zi - z) * U.rw * GF;
              Rr.push([pr, z * 100]); void zs;
            }
            const pm = Math.max(...L.concat(Rr).map(q => q[0])) * 1.1;
            const P = g.Plot({ xmin: 0, xmax: pm, ymin: UT.zb * 100, ymax: UT.top * 100, xlabel: 'gauge pressure (Pa)', ylabel: 'height (cm)', xfmt: v => v.toFixed(0), yfmt: v => v.toFixed(0) }).frame();
            P.clip(() => { P.line(L, cy, 2.2); P.line(Rr, am, 2.2, [5, 3]); if (U.ho > 0) P.hline(U.zi * 100, g.alpha(gr, .7), [3, 3]); });
            P.tag(pm * 0.05, U.zL * 100, 'left arm (water)', cy, 'left', -8);
            P.tag(pm * 0.05, U.zR * 100, 'right arm', am, 'left', -8);
            if (U.ho > 0) P.tag(pm * 0.95, U.zi * 100, 'equal below here', gr, 'right', -8);
            return;
          }
          if (p.mode === 'tank') {
            const Tk = S.Tk, tE = p.hold ? 60 : Tk.tDrain * 1.02;
            const lv = [], rg = [];
            const n = 160;
            for (let i = 0; i <= n; i++) {
              const t = tE * i / n, L0 = levelAt(Tk, t);
              lv.push([t, L0 * 100]);
              const J = Tk.jet(L0, Tk.holes[0]); rg.push([t, J ? J.R * 100 : 0]);
            }
            const ymax = Math.max(Tk.H0 * 100, ...rg.map(q => q[1])) * 1.1;
            const P = g.Plot({ xmin: 0, xmax: tE, ymin: 0, ymax, xlabel: 'time (s)', ylabel: 'cm', xfmt: v => v.toFixed(0), yfmt: v => v.toFixed(0) }).frame();
            P.clip(() => {
              P.line(lv, cy, 2.2); P.line(rg, gr, 2.2);
              P.hline(Tk.holes[0] * 100, g.alpha(th['text-3'], .6), [3, 3]);
              P.vline(S.ts, g.alpha(am, .8), [3, 3]);
              if (!p.hold) P.dot(Tk.tDrain, Tk.holes[0] * 100, 4.5, am, th['ink-950']);
            });
            P.tag(tE * 0.03, lv[2][1], 'water level', cy, 'left', -9);
            P.tag(tE * 0.03, rg[2][1], 'range of the lower jet', gr, 'left', -9);
            if (!p.hold) P.tag(Tk.tDrain, Tk.holes[0] * 100, 'down to the hole: ' + Tk.tDrain.toFixed(1) + ' s', am, 'right', -10);
            return;
          }
          if (p.mode === 'venturi') {
            const V = S.V, xs = V.xs, hs = V.ps.map(v => v / (V.rho * GF) * 100), es = V.ps.map((v, i) => (v / (V.rho * GF) + V.vs[i] * V.vs[i] / (2 * GF)) * 100);
            const pts = xs.map((x, i) => [x * 100, hs[i]]), ept = xs.map((x, i) => [x * 100, es[i]]);
            const lo = Math.min(0, ...hs) - 3, hi = Math.max(...es) * 1.1 + 2;
            const P = g.Plot({ xmin: 0, xmax: 85, ymin: lo, ymax: hi, xlabel: 'along the pipe (cm)', ylabel: 'head (cm of liquid)', xfmt: v => v.toFixed(0), yfmt: v => v.toFixed(0) }).frame();
            P.clip(() => {
              [VX[1], VX[2], VX[3], VX[4]].forEach(x => P.vline(x * 100, g.alpha(th['text-3'], .35), [2, 3]));
              P.line([[0, 0], [85, 0]], g.alpha(th['text-3'], .6), 1);
              P.line(ept, am, 1.8, [6, 3]); P.line(pts, gr, 2.2);
              V.st.forEach(s => P.dot(s.x * 100, s.h * 100, 4, cy, th['ink-950']));
            });
            P.tag(2, es[5] + 2, 'energy line: falls only by friction', am, 'left', -6);
            P.tag(VX[2] * 100 + 1, V.st[2].h * 100, 'throat', cy, 'left', 12);
            P.tag(60, 0, 'atmospheric', th['text-3'], 'left', 9);
            return;
          }
          if (p.mode === 'ball') {
            const Bl = S.Bl, pts = Bl.pts.map(q => [q[0], q[2] * 100]);
            const tE = Bl.tEnd, vm = Math.max(Bl.vT, Bl.vStokes > 2 * Bl.vT ? Bl.vT : Bl.vStokes) * 100 * 1.2;
            const P = g.Plot({ xmin: 0, xmax: tE, ymin: 0, ymax: vm || 1, xlabel: 'time (s)', ylabel: 'speed (cm/s)',
              xfmt: v => tE < 2 ? v.toFixed(2) : v.toFixed(0), yfmt: v => v < 1 ? v.toFixed(2) : v.toFixed(1) }).frame();
            P.clip(() => {
              P.hline(Bl.vT * 100, g.alpha(gr, .8), [4, 3]);
              if (Bl.vStokes * 100 < vm) P.hline(Bl.vStokes * 100, g.alpha(am, .8), [2, 3]);
              if (Bl.t1) P.vline(Bl.t1, g.alpha(pk, .7), [3, 3]);
              if (Bl.t2) P.vline(Bl.t2, g.alpha(pk, .7), [3, 3]);
              P.line(pts, cy, 2.2);
              const q = ballAt(Bl, S.ts); P.dot(q[0], q[2] * 100, 4.5, cy, th['ink-950']);
            });
            P.tag(tE * 0.55, Bl.vT * 100, 'terminal, full drag law', gr, 'left', -9);
            if (Bl.vStokes * 100 < vm) P.tag(tE * 0.55, Bl.vStokes * 100, 'Stokes 2r²(ρ − σ)g/9η', am, 'left', 11);
            else P.tag(tE * 0.3, vm * 0.9, 'Stokes predicts ' + (Bl.vStokes * 100).toFixed(1) + ' cm/s — off the chart', am, 'left', 0);
            if (Bl.t1) P.tag(Bl.t1, vm * 0.12, 'gate 1', pk, 'left', 0);
            if (Bl.t2) P.tag(Bl.t2, vm * 0.12, 'gate 2', pk, 'left', 0);
            return;
          }
          if (p.mode === 'buoy') {
            const sp = [], sc = [], bb = [];
            let base = null;
            for (let l = 0; l <= 22.0001; l += 0.2) {
              const s = buoyState(p, l / 100);
              if (base === null) base = s.scaleN;
              sp.push([l, s.T]); sc.push([l, s.scaleN - base]); bb.push([l, s.B]);
            }
            const s0 = S.bs, W0 = s0.W;
            const P = g.Plot({ xmin: 0, xmax: 22, ymin: 0, ymax: W0 * 1.15, xlabel: 'hook lowered (cm)', ylabel: 'force (N)', xfmt: v => v.toFixed(0), yfmt: v => v.toFixed(1) }).frame();
            P.clip(() => {
              P.line(sp, am, 2.2); P.line(sc, cy, 2.2); P.line(bb, gr, 1.4, [4, 3]);
              P.hline(W0, g.alpha(th['text-3'], .6), [3, 3]);
              P.vline(p.lower, g.alpha(pk, .7), [3, 3]);
              P.dot(p.lower, s0.T, 4.5, am, th['ink-950']); P.dot(p.lower, s0.scaleN - base, 4.5, cy, th['ink-950']);
            });
            P.tag(0.5, W0, 'weight in air', th['text-3'], 'left', -8);
            P.tag(0.5, sp[0][1], 'spring balance', am, 'left', 12);
            P.tag(21.5, sc[sc.length - 1][1], 'scale gains', cy, 'right', -9);
            return;
          }
          const C = S.C, tE = C.tEnd;
          const cols = [cy, gr, am];
          const ys = [].concat(...C.tubes.map(t => t.pts.map(q => q[1] * 100)));
          const lo = Math.min(0, ...ys) * 1.15, hi = Math.max(0.5, ...ys) * 1.15;
          const P = g.Plot({ xmin: 0, xmax: tE, ymin: lo, ymax: hi, xlabel: 'time (s)', ylabel: 'height above the surface (cm)', xfmt: v => v.toFixed(0), yfmt: v => v.toFixed(1) }).frame();
          P.clip(() => {
            P.line([[0, 0], [tE, 0]], g.alpha(th['text-3'], .6), 1);
            C.tubes.forEach((t, i) => { P.hline(t.hJ * 100, g.alpha(cols[i], .45), [3, 3]); P.line(t.pts.map(q => [q[0], q[1] * 100]), cols[i], 2); });
            P.vline(S.ts, g.alpha(pk, .7), [3, 3]);
            if (C.Lmax * 100 < hi) P.hline(C.Lmax * 100, g.alpha(pk, .8), [6, 3]);
          });
          C.tubes.forEach((t, i) => P.tag(tE * 0.98, capAt(t, tE) * 100, 'r = ' + (t.r * 1000).toFixed(2) + ' mm', cols[i], 'right', -9));
          if (C.Lmax * 100 < hi) P.tag(tE * 0.02, C.Lmax * 100, 'top of the tube', pk, 'left', -8);
        } },
      { title: S => ({ frame: S.p.fsub === 'accel' ? 'Steady tilt against acceleration' : 'Rise at the wall and dip at the centre, for every ω',
                       bubbles: 'Excess pressure against size — why the small one loses', utube: 'Level difference against the column poured',
                       tank: 'Range against hole height — for this level', venturi: 'Discharge coefficient against Reynolds number',
                       ball: 'Terminal speed against r² — Stokes\' straight line, and the truth', buoy: 'How much floats under, for every block in every liquid',
                       cap: 'Jurin\'s law — height against 1/r for four liquids',
                       pascal: S.p.psub === 'lift' ? 'Work in against energy out, through the stroke' : 'Force against depth — and its horizontal part',
                       drops: 'Temperature rise against drop size, three liquids' })[S.p.mode],
        draw(S, g) {
          const p = S.p, th = g.theme, cy = '#3DD6F5', gr = '#7CF0B0', am = '#F5B451';
          if (p.mode === 'pascal' && p.psub === 'lift') {
            const Lt = S.Lt, win = [[0, 0]], eo = [[0, 0]], el = [[0, 0]];
            for (let i = 1; i < Lt.pts.length; i++) {
              const a0 = Lt.pts[i - 1], a1 = Lt.pts[i], dx = (a1[0] - a0[0]) / 100, x = a1[0] / 100, y = x * Lt.r;
              win.push([a1[0], win[i - 1][1] + (a0[1] + a1[1]) / 2 * dx]);
              el.push([a1[0], Lt.M * GF * y]); eo.push([a1[0], Lt.M * GF * y + OILH.rho * GF * Lt.A1 * x * (x + y) / 2]);
            }
            const hi = win[win.length - 1][1] * 1.1;
            const P = g.Plot({ xmin: 0, xmax: 30, ymin: 0, ymax: hi, xlabel: 'stroke x (cm)', ylabel: 'energy (J)', xfmt: v => v.toFixed(0), yfmt: v => v.toFixed(1) }).frame();
            P.clip(() => { P.line(el, '#FF8FB0', 1.4, [4, 3]); P.line(win, gr, 3.2); P.line(eo, am, 1.6, [2, 2]); P.vline(p.xs, g.alpha(th['text-2'], .6), [3, 3]); });
            P.tag(1, hi * 0.92, '∫F₁dx (green) = Mgy + oil lifted (amber)', th['text-2'], 'left', 0);
            P.tag(29, el[el.length - 1][1], 'Mgy alone', '#FF8FB0', 'right', 12);
            return;
          }
          if (p.mode === 'pascal') {
            const D = S.Dm, rho = LIQ.water.rho, f = [], fx = [];
            for (let h = 0; h <= 1.0001; h += 0.01) { f.push([h * 100, rho * GF * D.w * h * h / 2 / Math.sin(D.al)]); fx.push([h * 100, rho * GF * D.w * h * h / 2]); }
            const P = g.Plot({ xmin: 0, xmax: 100, ymin: 0, ymax: f[f.length - 1][1] * 1.05, xlabel: 'depth H (cm), water only', ylabel: 'force (N)', xfmt: v => v.toFixed(0), yfmt: v => v.toFixed(0) }).frame();
            P.clip(() => { P.line(fx, g.alpha(th['text-2'], .8), 1.4, [4, 3]); P.line(f, cy, 2.2); P.dot(D.H * 100, D.F, 5.5, '#FF8FB0', th['ink-950']); P.dot(D.H * 100, D.Fx, 4.5, am, th['ink-950']); });
            P.tag(4, f[f.length - 1][1] * 0.95, 'F on the face ∝ H² (pink dot: this set-up)', cy, 'left', 0);
            P.tag(98, fx[fx.length - 1][1], 'horizontal part ρgwH²/2', th['text-2'], 'right', 12);
            return;
          }
          if (p.mode === 'drops') {
            const D = S.Dr, f = 1 - 1 / Math.cbrt(D.n), cs = { water: cy, mercury: '#C9D2DE', soapy: gr };
            const curve = l => { const q = []; for (let r = 0.1; r <= 3.0001; r += 0.02) q.push([r, 3 * LIQ[l].sig / (LIQ[l].rho * CSP[l]) * f / (r / 1000) * 1e3]); return q; };
            const all = ['water', 'mercury', 'soapy'].map(curve), hi = Math.max(...all.map(c => c[0][1])) * 1.05;
            const P = g.Plot({ xmin: 0.1, xmax: 3, ymin: 0, ymax: hi, xlabel: 'drop radius r (mm)', ylabel: 'ΔT (mK)', xfmt: v => v.toFixed(1), yfmt: v => v.toFixed(1) }).frame();
            P.clip(() => { ['water', 'mercury', 'soapy'].forEach((l, i) => P.line(all[i], l === p.dliq ? cs[l] : g.alpha(cs[l], .5), l === p.dliq ? 2.4 : 1.2)); P.dot(p.rdr, D.dT * 1e3, 5.5, am, th['ink-950']); });
            P.tag(2.9, hi * 0.9, 'n = ' + D.n + ' · ΔT ∝ 1/r', th['text-2'], 'right', 0);
            P.tag(0.5, all[1][20][1], 'mercury: small c', '#C9D2DE', 'left', -8);
            return;
          }
          if (p.mode === 'frame' && p.fsub === 'accel') {
            const pts = []; for (let a = -6; a <= 6.0001; a += 0.1) pts.push([a, Math.atan(a / GF) * 180 / Math.PI]);
            const P = g.Plot({ xmin: -6, xmax: 6, ymin: -35, ymax: 35, xlabel: 'a (m/s²)', ylabel: 'steady tilt (°)', xfmt: v => v.toFixed(0), yfmt: v => v.toFixed(0) }).frame();
            P.clip(() => { P.line(pts, cy, 2.2); P.dot(p.acc, S.Ac.thEq * 180 / Math.PI, 5.5, '#7CF0B0', th['ink-950']); });
            P.tag(-5.8, 30, 'θ = arctan(a/g): independent of the liquid', th['text-2'], 'left', 0);
            return;
          }
          if (p.mode === 'frame') {
            const rise = [], dip = [];
            for (let w = 0; w <= 32.0001; w += 0.25) { const s = rotSurface(w); rise.push([w, (s.rim - RV.h0) * 100]); dip.push([w, (RV.h0 - s.z(0)) * 100]); }
            const P = g.Plot({ xmin: 0, xmax: 32, ymin: 0, ymax: 25, xlabel: 'ω (rad/s)', ylabel: 'cm', xfmt: v => v.toFixed(0), yfmt: v => v.toFixed(0) }).frame();
            P.clip(() => { P.line(rise, am, 2.2); P.line(dip, cy, 2.2); P.vline(S.Rt.wDry, g.alpha('#FF8FB0', .7), [3, 3]); P.dot(p.omg, (S.Rt.final.rim - RV.h0) * 100, 5, am, th['ink-950']); });
            P.tag(1, 23, 'equal rise and dip (ω²R²/4g) until the centre dries', th['text-2'], 'left', 0);
            P.tag(S.Rt.wDry, 2, 'dry at ' + S.Rt.wDry.toFixed(1), '#FF8FB0', 'right', 0);
            return;
          }
          if (p.mode === 'bubbles') {
            const Bb = S.Bb, pts = [];
            for (let h = 0.0006; h <= 0.13; h *= 1.04) pts.push([capV(h) * 1e6, 4 * Bb.T / capR(h)]);
            const now = bubAt(Bb, S.ts);
            const P = g.Plot({ xmin: 0, xmax: 700, ymin: 0, ymax: 4 * Bb.T / BUB.a * 1.12, xlabel: 'bubble volume (cm³)', ylabel: 'excess pressure 4T/R (Pa)', xfmt: v => v.toFixed(0), yfmt: v => v.toFixed(0) }).frame();
            P.clip(() => { P.line(pts, gr, 2.2); P.dot(capV(now[1]) * 1e6, 4 * Bb.T / capR(now[1]), 5.5, '#7FD0FF', th['ink-950']); P.dot(capV(now[2]) * 1e6, 4 * Bb.T / capR(now[2]), 5.5, '#B8A4FF', th['ink-950']); });
            P.tag(capV(BUB.a) * 1e6, 4 * Bb.T / BUB.a, 'the peak: a hemisphere', th['text-2'], 'left', -8);
            P.tag(650, 4 * Bb.T / 0.06, 'bigger → lower pressure', th['text-3'], 'right', -8);
            return;
          }
          if (p.mode === 'utube') {
            const P = g.Plot({ xmin: 0, xmax: 20, ymin: 0, ymax: 5, xlabel: 'column poured (cm)', ylabel: 'level difference (cm)', xfmt: v => v.toFixed(0), yfmt: v => v.toFixed(1) }).frame();
            P.clip(() => { ['oil', 'kerosene', 'ethanol'].forEach(l => { const r = LIQ[l].rho / LIQ.water.rho; P.line([[0, 0], [20, 20 * (1 - r)]], l === p.liq2 ? cy : g.alpha(th['text-3'], .6), l === p.liq2 ? 2.2 : 1, l === p.liq2 ? null : [4, 3]); });
              if (p.liq2 !== 'none') P.dot(p.hoil, S.U.diff * 100, 5.5, '#7CF0B0', th['ink-950']); });
            ['oil', 'kerosene', 'ethanol'].forEach(l => { const r = LIQ[l].rho / LIQ.water.rho; P.tag(19.5, 19.5 * (1 - r), LIQ[l].name, l === p.liq2 ? cy : th['text-3'], 'right', -8); });
            return;
          }
          if (p.mode === 'tank') {
            const Tk = S.Tk, Hh = levelAt(Tk, S.ts), ideal = [], real = [];
            for (let y = 0; y <= Hh + 1e-9; y += Hh / 80) {
              ideal.push([y * 100, 2 * Math.sqrt(Math.max(0, y * (Hh - y))) * 100]);
              real.push([y * 100, 0.97 * 2 * Math.sqrt(Math.max(0, y * (Hh - y))) * 100]);
            }
            const P = g.Plot({ xmin: 0, xmax: Tk.H0 * 100, ymin: 0, ymax: Tk.H0 * 110, xlabel: 'hole height y (cm)', ylabel: 'range (cm)', xfmt: v => v.toFixed(0), yfmt: v => v.toFixed(0) }).frame();
            P.clip(() => {
              P.line(ideal, cy, 2.2); if (p.real) P.line(real, am, 1.6, [4, 3]);
              P.vline(Hh * 50, g.alpha(gr, .6), [3, 3]);
              Tk.holes.forEach(y => { const J = Tk.jet(Hh, y); if (J) P.dot(y * 100, J.R * 100, 5, '#7CF0B0', th['ink-950']); });
            });
            P.tag(Hh * 50, Hh * 100 * 1.02, 'best: y = H/2, R = H', gr, 'center', -8);
            P.tag(2, Tk.H0 * 100, 'holes at y and H − y throw equally far', th['text-2'], 'left', 0);
            return;
          }
          if (p.mode === 'venturi') {
            const C = cdCurve(p), V = S.V;
            const P = g.Plot({ xmin: 1, xmax: 5, ymin: 0.3, ymax: 1.05, xlabel: 'Reynolds number in the pipe (log)', ylabel: 'Cd', xfmt: v => Math.pow(10, v).toExponential(0), yfmt: v => v.toFixed(2) }).frame();
            P.clip(() => {
              P.hline(1, g.alpha(th['text-3'], .6), [3, 3]);
              P.line(C.water, cy, 2.2); P.line(C.oil, am, 2.2);
              P.vline(Math.log10(2300), g.alpha(th['text-3'], .5), [2, 3]);
              P.dot(Math.log10(V.Re1), V.Cd, 5.5, '#7CF0B0', th['ink-950']);
            });
            P.tag(Math.log10(2300), 0.36, 'laminar ← → turbulent', th['text-3'], 'center', 0);
            P.tag(4.9, C.water[C.water.length - 1][1], 'water', cy, 'right', -9);
            P.tag(C.oil[Math.floor(C.oil.length * 0.4)][0], C.oil[Math.floor(C.oil.length * 0.4)][1], 'light oil', am, 'left', 12);
            return;
          }
          if (p.mode === 'ball') {
            const C = vtCurve(p), Bl = S.Bl;
            const hi = Math.max(...C.out.map(q => q[1])) * 1.25;
            const P = g.Plot({ xmin: 0, xmax: 64, ymin: 0, ymax: hi, xlabel: 'r² (mm²)', ylabel: 'terminal speed (cm/s)', xfmt: v => v.toFixed(0), yfmt: v => v < 1 ? v.toFixed(2) : v.toFixed(1) }).frame();
            P.clip(() => { P.line(C.st, am, 1.6, [5, 4]); P.line(C.out, cy, 2.2); P.dot(p.rmm * p.rmm, Bl.vT * 100, 5.5, '#7CF0B0', th['ink-950']); });
            P.tag(2, hi * 0.92, 'Stokes: a straight line through the origin', am, 'left', 0);
            P.tag(64, C.out[C.out.length - 1][1], 'the real curve bends as Re grows', cy, 'right', 12);
            return;
          }
          if (p.mode === 'buoy') {
            const P = g.Plot({ xmin: 0, xmax: 1.6, ymin: 0, ymax: 1.1, xlabel: 'ρ_block ÷ ρ_liquid', ylabel: 'fraction under the surface', xfmt: v => v.toFixed(1), yfmt: v => v.toFixed(1) }).frame();
            P.clip(() => {
              P.line([[0, 0], [1, 1], [1.6, 1]], g.alpha(cy, .8), 2);
              ['aluminium', 'iron', 'wood', 'ice', 'wax'].forEach(b => ['water', 'brine', 'kerosene', 'mercury'].forEach(l => {
                const r = SOLID[b].rho / LIQ[l].rho;
                if (r <= 1.6) P.dot(r, Math.min(1, r), 3, g.alpha(th['text-2'], .6));
              }));
              const r0 = S.bs.S.rho / S.bs.L.rho;
              if (r0 <= 1.6) P.dot(r0, Math.min(1, r0), 6, '#7CF0B0', th['ink-950']);
            });
            P.tag(0.05, 0.95, 'floating: fraction under = ρ_block/ρ_liquid', th['text-2'], 'left', 0);
            P.tag(1.55, 1, 'sinks', am, 'right', -9);
            return;
          }
          const C = S.C;
          const P = g.Plot({ xmin: 0, xmax: 25, ymin: -8, ymax: 40, xlabel: '1/r (per mm)', ylabel: 'rise h (cm)', xfmt: v => v.toFixed(0), yfmt: v => v.toFixed(0) }).frame();
          P.clip(() => {
            P.line([[0, 0], [25, 0]], g.alpha(th['text-3'], .6), 1);
            ['water', 'ethanol', 'soapy', 'mercury'].forEach(l => {
              const Lq = LIQ[l], th0 = (p.waxed && l !== 'mercury' ? 105 : Lq.theta) * Math.PI / 180;
              const k = 2 * Lq.sig * Math.cos(th0) / (Lq.rho * GF) * 1e3 * 100;     // h in cm for 1/r in mm⁻¹
              P.line([[0, 0], [25, 25 * k]], l === p.cliq ? cy : g.alpha(th['text-3'], .6), l === p.cliq ? 2.2 : 1, l === p.cliq ? null : [4, 3]);
            });
            C.tubes.forEach(t => P.dot(1 / (t.r * 1000), capAt(t, C.tEnd) * 100, 5, t.capped ? am : '#7CF0B0', th['ink-950']));
          });
          [['water', 17], ['soapy', 23], ['ethanol', 12], ['mercury', 8]].forEach(([l, xe]) => {
            const Lq = LIQ[l], th0 = (p.waxed && l !== 'mercury' ? 105 : Lq.theta) * Math.PI / 180;
            const k = 2 * Lq.sig * Math.cos(th0) / (Lq.rho * GF) * 1e5;
            P.tag(xe, k * xe, Lq.name, l === p.cliq ? cy : th['text-3'], 'right', l === 'ethanol' ? 12 : -8);
          });
        } }
    ],

    readouts(S) {
      const p = S.p;
      if (p.mode === 'pascal' && p.psub === 'lift') {
        const Lt = S.Lt;
        return [
          { label: 'Effort to start, Mg·A₁/A₂', value: Lt.F0.toFixed(2), unit: 'N', flag: 'accent' },
          { label: 'Mechanical advantage A₂/A₁', value: Lt.MA.toFixed(1), unit: '×' },
          { label: 'Pressure under the load Mg/A₂', value: (Lt.p0 / 1000).toFixed(2), unit: 'kPa' },
          { label: 'Load rises', value: (Lt.y * 1000).toFixed(3), unit: 'mm', hint: 'x·A₁/A₂' },
          { label: 'Work in ∫F₁dx', value: Lt.W.toFixed(4), unit: 'J', hint: 'integrated' },
          { label: 'Mgy + oil raised', value: (Lt.Eload + Lt.Eoil).toFixed(4), unit: 'J', flag: 'ok' }
        ];
      }
      if (p.mode === 'pascal') {
        const D = S.Dm;
        return [
          { label: 'Force on the wall (800 strips)', value: D.F.toFixed(2), unit: 'N', flag: 'accent' },
          { label: 'Formula', value: D.Fform.toFixed(2), unit: 'N' },
          { label: 'Horizontal part', value: D.Fx.toFixed(2), unit: 'N', hint: 'same at any tilt' },
          { label: 'Vertical part', value: D.Fz.toFixed(2), unit: 'N', hint: 'weight of liquid on the face' },
          { label: 'Centre of pressure', value: (D.zCp * 100).toFixed(2), unit: 'cm up', hint: D.ho > 0 ? 'not H/3 with two layers' : 'H/3' },
          { label: 'Moment about the base', value: D.Mb.toFixed(2), unit: 'N·m' }
        ];
      }
      if (p.mode === 'drops') {
        const D = S.Dr, mNow = dropsAbsorbed(D, S.ts);
        return [
          { label: 'Drops n', value: String(D.n), unit: '' },
          { label: 'Big drop radius R = n^⅓ r', value: (D.R * 1000).toFixed(3), unit: 'mm' },
          { label: 'Energy set free so far', value: (D.T * (D.A0 - D.area(mNow)) * 1e3).toFixed(4), unit: 'mJ' },
          { label: 'Total, when merged', value: (D.E * 1e3).toFixed(4), unit: 'mJ', flag: 'accent' },
          { label: 'Temperature rise', value: (D.dT * 1e3).toPrecision(4), unit: 'mK', hint: '(3T/ρc)(1/r − 1/R)' },
          { label: 'Area lost', value: ((1 - 1 / Math.cbrt(D.n)) * 100).toFixed(1), unit: '%', hint: '1 − n^(−⅓)' }
        ];
      }
      if (p.mode === 'frame' && p.fsub === 'accel') {
        const A = S.Ac;
        return [
          { label: 'Steady tilt arctan(a/g)', value: (A.thEq * 180 / Math.PI).toFixed(2), unit: '°', flag: 'accent' },
          { label: 'Rise at the rear aL/2g', value: (A.rise * 100).toFixed(2), unit: 'cm' },
          { label: 'Slosh period', value: A.T.toFixed(3), unit: 's', hint: 'ω² = (πg/L)tanh(πh/L)' },
          { label: 'Largest tilt in the slosh', value: (Math.atan(A.sMax) * 180 / Math.PI).toFixed(2), unit: '°', flag: A.spill ? 'crit' : 'warn', hint: A.spill ? 'spills' : '≈ twice the steady tilt' },
          { label: 'Pressure gradient along the tank', value: (LIQ.water.rho * A.a).toFixed(0), unit: 'Pa/m', hint: 'ρa' }
        ];
      }
      if (p.mode === 'frame') {
        const Rt = S.Rt, s1 = Rt.final;
        return [
          { label: 'Rise at the wall (spun up)', value: ((s1.rim - RV.h0) * 100).toFixed(2), unit: 'cm', flag: 'accent' },
          { label: 'Centre height', value: (s1.z(0) * 100).toFixed(2), unit: 'cm', flag: s1.dry ? 'crit' : undefined, hint: s1.dry ? 'dry spot' : '' },
          { label: 'ω²R²/4g', value: (Rt.w * Rt.w * RV.R * RV.R / (4 * GF) * 100).toFixed(2), unit: 'cm' },
          { label: 'ω to dry the centre 2√(gh₀)/R', value: Rt.wDry.toFixed(2), unit: 'rad/s' },
          { label: 'Spin-up time h/√(νω)', value: Rt.tauReal.toFixed(0), unit: 's' }
        ];
      }
      if (p.mode === 'bubbles') {
        const Bb = S.Bb, fin = Bb.pts[Bb.pts.length - 1];
        return [
          { label: 'Left 4T/R at the start', value: Bb.p10.toFixed(3), unit: 'Pa' },
          { label: 'Right 4T/R at the start', value: Bb.p20.toFixed(3), unit: 'Pa' },
          { label: 'Difference', value: (Bb.p10 - Bb.p20).toFixed(3), unit: 'Pa', flag: 'accent' },
          { label: 'Final radius left · right', value: (capR(fin[1]) * 100).toFixed(2) + ' · ' + (capR(fin[2]) * 100).toFixed(2), unit: 'cm', hint: p.open ? 'equal curvature' : 'valve shut' },
          { label: 'Air volume change', value: (Bb.dV * 1e6).toExponential(1), unit: 'cm³', hint: 'conserved' }
        ];
      }
      if (p.mode === 'utube') {
        const U = S.U;
        return [
          { label: 'Level difference', value: (U.diff * 100).toFixed(2), unit: 'cm', flag: 'accent', hint: 'h₂(1 − ρ₂/ρ_w)' },
          { label: 'Water column balancing it', value: ((U.zL - U.zi) * 100).toFixed(2), unit: 'cm' },
          { label: 'Oscillation period (formula)', value: U.T.toFixed(3), unit: 's' },
          { label: 'Oscillation period (integrated)', value: U.Tm ? U.Tm.toFixed(3) : '—', unit: 's' }
        ];
      }
      if (p.mode === 'tank') {
        const Tk = S.Tk, J = Tk.jet(Tk.H0, Tk.holes[0]);
        return [
          { label: 'Efflux speed √(2gh)', value: J ? J.v.toFixed(3) : '0', unit: 'm/s', flag: 'accent', hint: 'as if dropped from the surface' },
          { label: 'Range at the start', value: J ? (J.R * 100).toFixed(2) : '0', unit: 'cm' },
          { label: 'Range formula 2√(h·y)', value: (2 * Math.sqrt((Tk.H0 - Tk.holes[0]) * Tk.holes[0]) * 100 * Tk.Cv).toFixed(2), unit: 'cm' },
          { label: 'Starting flow Q = Cd·a·√(2gh)', value: (Tk.Q0 * 6e4).toFixed(3), unit: 'L/min' },
          { label: 'Time to drain to the hole', value: p.hold ? '∞' : Tk.tDrain.toFixed(1), unit: 's', flag: 'accent' },
          { label: 'Tank ÷ hole area A/a', value: (Tk.A / Tk.a).toFixed(0), unit: '' }
        ];
      }
      if (p.mode === 'venturi') {
        const V = S.V;
        return [
          { label: 'Speed in the pipe · throat', value: V.v1.toFixed(3) + ' · ' + V.v2.toFixed(3), unit: 'm/s', hint: 'A₁v₁ = A₂v₂' },
          { label: 'Manometer drop Δh', value: (V.dh * 100).toFixed(2), unit: 'cm', flag: 'accent' },
          { label: 'Q from the reading', value: (V.Qv * 6e4).toFixed(3), unit: 'L/min' },
          { label: 'Discharge coefficient', value: V.Cd.toFixed(4), unit: '', flag: V.Cd < 0.9 ? 'warn' : 'ok' },
          { label: 'Reynolds number ρvD/η', value: V.Re1.toFixed(0), unit: '', hint: V.laminar ? 'laminar' : 'turbulent' },
          { label: 'Throat pressure (absolute)', value: V.cav ? (V.F.pv / 1000).toFixed(2) : (V.pAbsThroat / 1000).toFixed(2), unit: 'kPa', flag: V.cav ? 'crit' : undefined,
            hint: V.cav ? 'Bernoulli asks for ' + (V.pAbsThroat / 1000).toFixed(0) + ' kPa: impossible, it boils' : '' }
        ];
      }
      if (p.mode === 'ball') {
        const Bl = S.Bl;
        return [
          { label: 'Terminal speed (full drag law)', value: (Bl.vT * 100).toPrecision(4), unit: 'cm/s', flag: 'accent' },
          { label: 'Stokes 2r²(ρ − σ)g/9η', value: (Bl.vStokes * 100).toPrecision(4), unit: 'cm/s', hint: p.wall ? 'with wall factor' : '' },
          { label: 'Timed between the gates', value: Bl.vMeas ? (Bl.vMeas * 100).toPrecision(4) : '—', unit: 'cm/s' },
          { label: 'η from the timing', value: isFinite(Bl.etaMeas) ? Bl.etaMeas.toPrecision(4) : '—', unit: 'Pa·s', flag: 'warn' },
          { label: 'η of the liquid', value: Bl.eta.toPrecision(4), unit: 'Pa·s' },
          { label: 'Reynolds number', value: Bl.ReT.toPrecision(3), unit: '', flag: Bl.ReT < 0.2 ? 'ok' : 'warn', hint: Bl.ReT < 0.2 ? 'Stokes valid' : 'Stokes invalid' }
        ];
      }
      if (p.mode === 'buoy') {
        const s = S.bs;
        return [
          { label: 'Weight in air', value: s.W.toFixed(3), unit: 'N' },
          { label: 'Spring balance', value: (p.cut ? 0 : s.T).toFixed(3), unit: 'N', flag: 'accent' },
          { label: 'Upthrust ρ V_under g', value: s.B.toFixed(3), unit: 'N' },
          { label: 'Scale reading', value: (s.scaleN / GF * 1000).toFixed(1), unit: 'g', hint: 'rises by the upthrust' },
          { label: 'Volume under the surface', value: (s.sub * BK.a * BK.a * 1e6).toFixed(1), unit: 'cm³' },
          { label: 'Fraction under', value: (s.sub / BK.a * 100).toFixed(1), unit: '%' }
        ];
      }
      const C = S.C;
      return C.tubes.map((t, i) => ({ label: 'Tube ' + (i + 1) + ' (r = ' + (t.r * 1000).toFixed(2) + ' mm)', value: (capAt(t, S.ts) * 100).toFixed(2), unit: 'cm',
        flag: i === 0 ? 'accent' : undefined, hint: t.capped ? 'capped · θ → ' + (t.thetaEff * 180 / Math.PI).toFixed(0) + '°' : 'Jurin ' + (t.hJ * 100).toFixed(2) + ' cm' }))
        .concat([{ label: 'Surface tension T', value: (C.sig * 1000).toFixed(1), unit: 'mN/m' },
                 { label: 'Contact angle θ', value: (C.theta * 180 / Math.PI).toFixed(0), unit: '°', hint: C.theta > Math.PI / 2 ? 'does not wet' : 'wets the glass' }]);
    },

    equation(S) {
      const p = S.p;
      if (p.mode === 'pascal' && p.psub === 'lift') return E.v('F') + '₁ ' + E.op('=') + ' ' + E.frac(E.v('A') + '₁', E.v('A') + '₂') + E.v('Mg') + ' ' + E.op('=') + ' ' + E.n(S.Lt.F0, 'N') +
        ' · ' + E.v('W') + ' ' + E.op('=') + ' ∫' + E.v('F') + '₁' + E.v('dx') + ' ' + E.op('=') + ' ' + E.v('Mgy') + ' ' + E.op('+') + ' oil ' + E.op('=') + ' ' + E.n(S.Lt.W, 'J');
      if (p.mode === 'pascal') return E.v('F') + ' ' + E.op('=') + ' ∫' + E.v('p') + E.v('w') + ' ' + E.v('ds') + ' ' + E.op('=') + ' ' + E.frac('ρ' + E.v('gw') + E.v('H') + '²', '2 sin α') + ' ' + E.op('=') + ' ' + E.n(S.Dm.F, 'N') +
        ' · ' + E.v('h') + E.sub('cp') + ' ' + E.op('=') + ' ' + E.n(S.Dm.zCp * 100, 'cm');
      if (p.mode === 'drops') return E.v('R') + ' ' + E.op('=') + ' ' + E.v('n') + '<sup>1/3</sup>' + E.v('r') + ' · ' + E.v('E') + ' ' + E.op('=') + ' 4π' + E.v('R') + '²' + E.v('T') + '(' + E.v('n') + '<sup>1/3</sup> ' + E.op('−') + ' 1) ' + E.op('=') + ' ' + E.n(S.Dr.E * 1e3, 'mJ') +
        ' · Δ' + E.v('T') + ' ' + E.op('=') + ' ' + E.frac('3' + E.v('T'), 'ρ' + E.v('c')) + '(' + E.frac('1', E.v('r')) + ' ' + E.op('−') + ' ' + E.frac('1', E.v('R')) + ')';
      if (p.mode === 'frame' && p.fsub === 'accel') return 'tan θ ' + E.op('=') + ' ' + E.frac(E.v('a'), E.v('g')) + ' ' + E.op('=') + ' ' + E.n(S.Ac.a / GF, '') + ' → θ ' + E.op('=') + ' ' + E.n(S.Ac.thEq * 180 / Math.PI, '°') +
        '<br>' + E.v('p') + '(' + E.v('x') + ', ' + E.v('z') + ') ' + E.op('=') + ' ρ(' + E.v('g') + E.v('h') + ' ' + E.op('−') + ' ' + E.v('g') + E.v('z') + ' ' + E.op('−') + ' ' + E.v('a') + E.v('x') + '): its isobars are the tilted surface';
      if (p.mode === 'frame') return E.v('z') + '(' + E.v('r') + ') ' + E.op('=') + ' ' + E.v('z') + '₀ ' + E.op('+') + ' ' + E.frac('ω²' + E.v('r') + '²', '2' + E.v('g')) + ' · rise ' + E.op('=') + ' dip ' + E.op('=') + ' ' + E.frac('ω²' + E.v('R') + '²', '4' + E.v('g')) + ' ' + E.op('=') + ' ' + E.n(S.Rt.w * S.Rt.w * RV.R * RV.R / (4 * GF) * 100, 'cm');
      if (p.mode === 'bubbles') return 'Δ' + E.v('p') + ' ' + E.op('=') + ' ' + E.frac('4' + E.v('T'), E.v('R')) + ' · ' + E.v('p') + '₁ ' + E.op('−') + ' ' + E.v('p') + '₂ ' + E.op('=') + ' 4' + E.v('T') + '(' + E.frac('1', E.v('r') + '₁') + ' ' + E.op('−') + ' ' + E.frac('1', E.v('r') + '₂') + ') ' + E.op('=') + ' ' + E.n(S.Bb.p10 - S.Bb.p20, 'Pa');
      if (p.mode === 'utube') return 'ρ' + E.sub('w') + E.v('g') + E.v('h') + E.sub('w') + ' ' + E.op('=') + ' ρ₂' + E.v('g') + E.v('h') + '₂ · ' + E.v('T') + ' ' + E.op('=') + ' 2π√(' + E.frac(E.v('m'), '2ρ' + E.sub('w') + E.v('gA')) + ') ' + E.op('=') + ' ' + E.n(S.U.T, 's');
      if (p.mode === 'tank') {
        const Tk = S.Tk, J = Tk.jet(Tk.H0, Tk.holes[0]);
        return E.v('v') + ' ' + E.op('=') + ' √(2' + E.v('gh') + ') ' + E.op('=') + ' ' + E.n(J ? J.v : 0, 'm/s') + ' · ' +
          E.v('R') + ' ' + E.op('=') + ' 2√(' + E.v('h') + E.v('y') + ') ' + E.op('=') + ' ' + E.n(J ? J.R * 100 : 0, 'cm') +
          '<br>' + E.v('t') + ' ' + E.op('=') + ' ' + E.frac(E.v('A'), E.v('C') + E.sub('d') + E.v('a')) + '√(' + E.frac('2' + E.v('h') + '₀', E.v('g')) + ') ' + E.op('=') + ' ' + E.n(Tk.tFormula, 's');
      }
      if (p.mode === 'venturi') {
        const V = S.V;
        return E.v('p') + '₁ ' + E.op('+') + ' ½ρ' + E.v('v') + '₁² ' + E.op('=') + ' ' + E.v('p') + '₂ ' + E.op('+') + ' ½ρ' + E.v('v') + '₂² ' + (p.loss ? E.op('+') + ' losses' : '') +
          '<br>' + E.v('Q') + ' ' + E.op('=') + ' ' + E.v('A') + '₂√(' + E.frac('2' + E.v('g') + 'Δ' + E.v('h'), '1 ' + E.op('−') + ' β⁴') + ') ' + E.op('=') + ' ' + E.n(V.Qv * 6e4, 'L/min') +
          ' · true ' + E.n(p.Qlpm, 'L/min');
      }
      if (p.mode === 'ball') {
        const Bl = S.Bl;
        return E.v('v') + E.sub('t') + ' ' + E.op('=') + ' ' + E.frac('2' + E.v('r') + '²(ρ ' + E.op('−') + ' σ)' + E.v('g'), '9η') + ' ' + E.op('=') + ' ' + E.n(Bl.vStokes * 100, 'cm/s') +
          ' · measured ' + E.n(Bl.vMeas * 100, 'cm/s') + '<br>Re ' + E.op('=') + ' ' + E.frac('2' + E.v('r') + E.v('v') + 'σ', 'η') + ' ' + E.op('=') + ' ' + E.n(Bl.ReT, '') +
          (Bl.ReT < 0.2 ? ' → Stokes holds' : ' → Stokes fails');
      }
      if (p.mode === 'buoy') {
        const s = S.bs;
        return E.v('T') + ' ' + E.op('=') + ' ' + E.v('W') + ' ' + E.op('−') + ' ρ' + E.v('V') + E.sub('under') + E.v('g') + ' ' + E.op('=') + ' ' + E.n(s.W, 'N') + ' ' + E.op('−') + ' ' + E.n(s.B, 'N') +
          '<br>scale ' + E.op('=') + ' beaker ' + E.op('+') + ' liquid ' + E.op('+') + ' ' + E.n(s.B, 'N') + ' (the reaction to the upthrust)';
      }
      const C = S.C, t = C.tubes[0];
      return E.v('h') + ' ' + E.op('=') + ' ' + E.frac('2' + E.v('T') + ' cos θ', 'ρ' + E.v('g') + E.v('r')) + ' ' + E.op('=') + ' ' + E.n(t.hJ * 100, 'cm') + ' for r = ' + (t.r * 1000).toFixed(2) + ' mm';
    },

    eqNote: '<b>Every formula here is a limit.</b> Torricelli is Bernoulli with a wide tank and no loss; the real orifice ' +
      'squeezes the jet to 63% of the hole and slows it to 97%. The venturi formula assumes no friction, so the real Δh ' +
      'reads too high and Cd comes out below one, far below in a laminar oil. Stokes\' law is the drag at Re → 0; at Re = 1 it ' +
      'is already 15% out, and a steel ball in water is outside it by a factor of twenty. Jurin\'s law assumes the tube is ' +
      'long enough. When it is not, the height stays put and the contact angle gives way. Each one is right exactly where its ' +
      'assumption holds, and the apparatus shows where that ends.',

    problems: [
      { source: 'JEE Advanced pattern · liquid in an accelerating vehicle',
        q: 'A tank of water sits on a cart that accelerates at 3.00 m/s². At what angle to the horizontal does the free surface settle, in degrees?',
        params: { mode: 'frame', fsub: 'accel', acc: 3 },
        predict: { label: 'tilt', unit: '°', tol: 0.01 },
        measure: S => S.Ac.thEq * 180 / Math.PI,
        working: 'In the cart\'s frame each fluid element feels g down and a backwards; the surface is perpendicular to their sum. tan θ = a/g = 3.00/9.81, θ = <b>17.0°</b>. ' +
          'It overshoots first: the step in a sets the first sloshing mode ringing, and the surface swings to about twice that tilt.' },
      { source: 'JEE Advanced pattern · a spinning vessel',
        q: 'A cylinder of radius 8.0 cm holds water 12 cm deep and spins at 12.0 rad/s. How far does the water rise at the wall, in cm?',
        params: { mode: 'frame', fsub: 'rotate', omg: 12 },
        predict: { label: 'rise', unit: 'cm', tol: 0.01 },
        measure: S => (S.Rt.final.rim - RV.h0) * 100,
        working: 'The surface is z = z₀ + ω²r²/2g. Keeping the volume fixed puts z₀ at h₀ − ω²R²/4g, so the wall rises and the centre dips by the same amount: ' +
          'ω²R²/4g = 144 × 0.0064 / 39.24 = <b>2.35 cm</b>. Above 2√(gh₀)/R = 27.1 rad/s the centre runs dry.' },
      { source: 'NEET pattern · excess pressure in bubbles',
        q: 'Two soap bubbles (T = 0.025 N/m) of radii 2.0 cm and 4.0 cm. How much higher is the pressure in the small one, in Pa?',
        params: { mode: 'bubbles', r1: 2, r2: 4, sig: 0.025, open: false },
        predict: { label: 'difference', unit: 'Pa', tol: 0.01 },
        measure: S => S.Bb.p10 - S.Bb.p20,
        working: 'A bubble has two surfaces, so Δp = 4T/R. 4 × 0.025 × (1/0.02 − 1/0.04) = <b>2.50 Pa</b>. Open the valve and the air runs from the small bubble into the big one, not the other way round.' },
      { source: 'JEE Main pattern · two liquids in a U-tube',
        q: 'Water fills a U-tube. 10.0 cm of oil (ρ = 870 kg/m³) is poured into one arm. By how much does the oil surface stand above the water surface in the other arm, in cm?',
        params: { mode: 'utube', liq2: 'oil', hoil: 10, slosh: false },
        predict: { label: 'difference', unit: 'cm', tol: 0.01 },
        measure: S => S.U.diff * 100,
        working: 'At the level of the oil–water interface the pressure is the same in both arms: 998 × h_w = 870 × 10.0, so h_w = 8.72 cm of water. ' +
          'The oil column is 10.0 cm, so it stands <b>1.28 cm</b> higher.' },
      { source: 'JEE Main pattern · oscillating liquid column',
        q: 'A U-tube holds a 50.0 cm column of water. It is tipped and released. Find the period of oscillation, in s.',
        params: { mode: 'utube', liq2: 'none', hoil: 10, slosh: true },
        predict: { label: 'period', unit: 's', tol: 0.01 },
        measure: S => S.U.Tm,
        working: 'Displace the column by x: the levels differ by 2x, a restoring force 2ρgAx on a mass ρAL. SHM with T = 2π√(L/2g) = 2π√(0.500/19.62) = <b>1.003 s</b>. The lab integrates it (with a little damping) and times the zero crossings.' },
      { source: 'JEE Main pattern · Torricelli and the range',
        q: 'A tank holds water to 50.0 cm. A small hole 12.5 cm above the floor squirts water horizontally. How far from the tank does it land, in cm?',
        params: { mode: 'tank', H0: 50, y1: 12.5, dmm: 5, Dt: 15, real: false, two: false, hold: false },
        predict: { label: 'range', unit: 'cm', tol: 0.01 },
        measure: S => S.Tk.jet(S.Tk.H0, S.Tk.holes[0]).R * 100,
        working: 'v = √(2g × 0.375) and the fall time is √(2 × 0.125/g), so R = 2√(h·y) = 2√(0.375 × 0.125) = <b>43.3 cm</b>. ' +
          'g cancels, so the range is the same on the Moon. A hole at 37.5 cm (= H − y) throws exactly as far.' },
      { source: 'JEE Advanced pattern · time to drain',
        q: 'A tank of diameter 15.0 cm holds water 37.5 cm above a hole of diameter 5.00 mm. How long until the level reaches the hole, in s?',
        params: { mode: 'tank', H0: 50, y1: 12.5, dmm: 5, Dt: 15, real: false, two: false, hold: false },
        predict: { label: 'time', unit: 's', tol: 0.01 },
        measure: S => S.Tk.tDrain,
        working: 'A dh/dt = −a√(2gh). Separating, 2√h runs down linearly, and t = (A/a)√(2h₀/g) = (150/5)² × √(2 × 0.375/9.81) = 900 × 0.2765 = ' +
          '<b>249 s</b>. The lab integrates the level step by step and lands on the same second. Half the height does NOT take half the time.' },
      { source: 'NEET pattern · venturimeter',
        q: 'Water flows through a pipe of diameter 25 mm with a throat of 12.5 mm. The manometers differ by 12.69 cm. Ignoring losses, find the flow rate in L/min.',
        params: { mode: 'venturi', vfluid: 'water', Qlpm: 12, beta: 0.5, loss: false, hback: 25 },
        predict: { label: 'Q', unit: 'L/min', tol: 0.01 },
        measure: S => S.V.Qv * 6e4,
        working: 'A₂ = π(0.0125)²/4 = 1.227 × 10⁻⁴ m². v₂ = √(2gΔh/(1 − β⁴)) = √(2 × 9.81 × 0.1269 / (1 − 1/16)) = 1.630 m/s. ' +
          'Q = A₂v₂ = 2.00 × 10⁻⁴ m³/s = <b>12.0 L/min</b>. Turn friction on and the same reading overestimates the flow by about 5%.' },
      { source: 'NEET pattern · terminal velocity',
        q: 'A steel ball (ρ = 7850 kg/m³) of radius 1.00 mm falls through glycerine (σ = 1261 kg/m³, η = 1.41 Pa·s). Find its terminal speed in cm/s, ignoring the walls.',
        params: { mode: 'ball', bfluid: 'glycerine', ball: 'steel', rmm: 1, TC: 20, wall: false },
        predict: { label: 'terminal speed', unit: 'cm/s', tol: 0.02 },
        measure: S => S.Bl.vMeas * 100,
        working: 'v = 2r²(ρ − σ)g / 9η = 2 × 10⁻⁶ × 6589 × 9.81 / (9 × 1.41) = 1.019 × 10⁻² m/s = <b>1.02 cm/s</b>. ' +
          'The gates time 1.01 cm/s. At Re = 0.02 the drag is already about 1% above Stokes. That is the first sign of the inertia that wrecks the formula at larger Re.' },
      { source: 'JEE Main pattern · a block weighed in water',
        q: 'An aluminium cube of side 5.00 cm (ρ = 2700 kg/m³) hangs from a spring balance, fully under water. What does the balance read, in N?',
        params: { mode: 'buoy', block: 'aluminium', liq: 'water', lower: 18, cut: false },
        predict: { label: 'reading', unit: 'N', tol: 0.01 },
        measure: S => S.bs.T,
        working: 'W = 2700 × 1.25 × 10⁻⁴ × 9.81 = 3.311 N. Upthrust = 998 × 1.25 × 10⁻⁴ × 9.81 = 1.224 N. The balance reads <b>2.087 N</b>. ' +
          'The scale under the beaker goes UP by the same 1.224 N: the water pushes up on the block, so the block pushes down on the water.' },
      { source: 'JEE Advanced pattern · iron on mercury',
        q: 'An iron cube (ρ = 7870 kg/m³) is placed in mercury (ρ = 13 534 kg/m³). What percentage of its volume is below the surface?',
        params: { mode: 'buoy', block: 'iron', liq: 'mercury', lower: 16, cut: false },
        predict: { label: 'fraction under', unit: '%', tol: 0.01 },
        measure: S => S.bs.sub / BK.a * 100,
        working: 'Floating means upthrust = weight: ρ_Hg V_under g = ρ_Fe V g, so V_under/V = 7870/13 534 = <b>58.2%</b>. ' +
          'Iron floats on mercury. The spring balance reads zero once it floats, because the string has gone slack.' },
      { source: 'NEET pattern · capillary rise',
        q: 'Water (T = 0.0728 N/m, contact angle 0°) rises in a clean glass capillary of radius 0.250 mm. How high, in cm?',
        params: { mode: 'cap', cliq: 'water', waxed: false, crmm: 0.25, Lcm: 16 },
        predict: { label: 'rise', unit: 'cm', tol: 0.01 },
        measure: S => S.C.tubes[0].h * 100,
        working: 'h = 2T cos θ / ρgr = 2 × 0.0728 / (998 × 9.81 × 2.5 × 10⁻⁴) = <b>5.95 cm</b>. The column in the lab gets there by ' +
          'integrating its own motion: the 1 mm tube overshoots and rings, the narrow one creeps up without overshooting.' },
      { source: 'JEE Advanced pattern · a tube that is too short',
        q: 'Water would rise 14.87 cm in a 0.100 mm capillary, but only 10.0 cm of tube stands above the surface. What contact angle does the water make at the top, in degrees?',
        params: { mode: 'cap', cliq: 'water', waxed: false, crmm: 0.1, Lcm: 10 },
        predict: { label: 'contact angle', unit: '°', tol: 0.02 },
        measure: S => S.C.tubes[0].thetaEff * 180 / Math.PI,
        working: 'The column cannot rise further, so the meniscus flattens until 2πrT cos θ\' holds exactly the 10 cm column: ' +
          'cos θ\' = 10.0/14.87 = 0.672, θ\' = <b>47.7°</b>. There is no fountain. A capillary is not a perpetual-motion machine.' },
      { source: 'JEE Main pattern · hydraulic lift',
        q: 'A hydraulic lift has pistons of diameter 2.0 cm and 20 cm. What force on the small piston holds a 1000 kg load at the same level, in N?',
        params: { mode: 'pascal', psub: 'lift', d1: 2, d2: 20, Mkg: 1000, xs: 20 },
        predict: { label: 'force', unit: 'N', tol: 0.01 },
        measure: S => S.Lt.F0,
        working: 'The pressure is the same at the same level: F₁/A₁ = Mg/A₂, so F₁ = Mg(d₁/d₂)² = 9810 × (2/20)² = <b>98.1 N</b>. ' +
          'Areas go as the diameter squared: a tenfold diameter gives a hundredfold force.' },
      { source: 'JEE Advanced pattern · work through a hydraulic lift',
        q: 'The same lift (2.0 cm and 20 cm pistons, oil ρ = 870 kg/m³, 1000 kg load, both pistons level at the start). The small piston is pushed down 20.0 cm. How much work does the effort do, in J?',
        params: { mode: 'pascal', psub: 'lift', d1: 2, d2: 20, Mkg: 1000, xs: 20 },
        predict: { label: 'work', unit: 'J', tol: 0.005 },
        measure: S => S.Lt.W,
        working: 'The load rises y = x·A₁/A₂ = 2.00 mm, so Mgy = 19.62 J. But the big piston now stands x(1 + A₁/A₂) = 20.2 cm above the small one, so the effort also holds up that head of oil: ' +
          'F₁(x) = A₁(Mg/A₂ + ρgx(1 + A₁/A₂)). Integrating, W = Mgy + ρgA₁x²(1 + A₁/A₂)/2 = 19.62 + 0.054 = <b>19.67 J</b>. ' +
          'Force is multiplied, work is not: the effort moves a hundred times further.' },
      { source: 'JEE Main pattern · force on a vertical wall',
        q: 'A tank holds water 60 cm deep against a vertical wall 50 cm wide. Find the total force of the water on the wall, in N.',
        params: { mode: 'pascal', psub: 'dam', dH: 60, doil: 0, dw: 50, dang: 90 },
        predict: { label: 'force', unit: 'N', tol: 0.01 },
        measure: S => S.Dm.F,
        working: 'The pressure grows linearly with depth, so the average is half the pressure at the bottom: F = ρgH/2 × wH = 998 × 9.81 × 0.36 × 0.5 / 2 = <b>881 N</b>. ' +
          'The lab sums 800 strips and agrees to the newton. The force acts H/3 = 20 cm above the base, not halfway up.' },
      { source: 'JEE Advanced pattern · moment on a wall',
        q: 'For the same wall (water 60 cm deep, 50 cm wide), find the moment of the water force about the bottom edge, in N·m.',
        params: { mode: 'pascal', psub: 'dam', dH: 60, doil: 0, dw: 50, dang: 90 },
        predict: { label: 'moment', unit: 'N·m', tol: 0.01 },
        measure: S => S.Dm.Mb,
        working: '∫ρg(H − z)w·z dz from 0 to H = ρgwH³/6 = 998 × 9.81 × 0.5 × 0.216 / 6 = <b>176 N·m</b>, which is F × H/3. ' +
          'It grows as H³: that is why dams are wedges, thick at the bottom.' },
      { source: 'JEE Advanced pattern · two liquids on a wall',
        q: 'A wall 50 cm wide holds back 40 cm of water with 20 cm of oil (ρ = 870 kg/m³) floating on it. Find the total force on the wall, in N.',
        params: { mode: 'pascal', psub: 'dam', dH: 40, doil: 20, dw: 50, dang: 90 },
        predict: { label: 'force', unit: 'N', tol: 0.01 },
        measure: S => S.Dm.F,
        working: 'Split the face. The oil part: ρ_o g h_o²w/2 = 85.3 N. The water part sits under the whole oil layer: (ρ_o g h_o + ρ_w g h_w/2) × h_w w = (1707 + 1958) × 0.2 = 733 N. ' +
          'Total <b>818 N</b>. Leaving out the oil\'s pressure on the water part is the usual mistake.' },
      { source: 'JEE Advanced pattern · an inclined wall',
        q: 'The same 60 cm of water rests on a wall 50 cm wide inclined at 60° to the floor. Find the total (normal) force on the wall, in N.',
        params: { mode: 'pascal', psub: 'dam', dH: 60, doil: 0, dw: 50, dang: 60 },
        predict: { label: 'force', unit: 'N', tol: 0.01 },
        measure: S => S.Dm.F,
        working: 'The wetted length is H/sin 60°, and the average pressure is still ρgH/2: F = ρgwH²/(2 sin 60°) = 881.1/0.866 = <b>1017 N</b>. ' +
          'Its horizontal part is still 881 N; the extra is vertical, the weight of the water standing on the slope.' },
      { source: 'JEE Main pattern · merging drops',
        q: 'A thousand water drops (T = 0.0728 N/m) of radius 1.00 mm merge into one. How much surface energy is released, in mJ?',
        params: { mode: 'drops', nk: 10, rdr: 1, dliq: 'water' },
        predict: { label: 'energy', unit: 'mJ', tol: 0.01 },
        measure: S => S.Dr.E * 1e3,
        working: 'Volume is kept: R = n^⅓ r = 10 mm. Area before 1000 × 4π(1 mm)² = 125.7 cm², after 4π(10 mm)² = 12.57 cm². ' +
          'E = TΔA = 0.0728 × 1.131 × 10⁻² = <b>0.823 mJ</b> = 4πR²T(n^⅓ − 1).' },
      { source: 'JEE Advanced pattern · heating by coalescence',
        q: 'A thousand mercury drops (T = 0.485 N/m, ρ = 13 534 kg/m³, c = 140 J/kg·K) of radius 1.00 mm merge. If all the energy stays in the mercury, what is the temperature rise, in mK?',
        params: { mode: 'drops', nk: 10, rdr: 1, dliq: 'mercury' },
        predict: { label: 'ΔT', unit: 'mK', tol: 0.01 },
        measure: S => S.Dr.dT * 1e3,
        working: 'ΔT = E/(mc) = 4πT(nr² − R²)/((4/3)πR³ρc) = (3T/ρc)(1/r − 1/R) = 3 × 0.485/(13 534 × 140) × (1000 − 100) = <b>0.691 mK</b>. ' +
          'Water gets only 0.047 mK: its surface tension is lower and its specific heat thirty times bigger.' }
    ],

    walkthrough: [
      { title: '1 · A hole in a tank',
        body: 'One hole, 12.5 cm up, water 50 cm deep. Watch the jet land on the rule and shorten as the level drops.',
        ask: 'The water falls from 37.5 cm above the hole. How fast does it come out?',
        reveal: '<b>√(2gh) = 2.71 m/s</b>, exactly as fast as a stone dropped 37.5 cm. That is Bernoulli between the surface and the jet: pressure energy at the hole turns into speed.',
        params: { mode: 'tank', H0: 50, y1: 12.5, dmm: 5, Dt: 15, real: false, two: false, hold: false } },
      { title: '2 · Two holes, one landing spot',
        body: 'A second hole at H − y = 37.5 cm.',
        ask: 'One jet is faster, the other falls further. Where does each land?',
        reveal: '<b>On the same spot.</b> R = 2√(h·y) is symmetric in h and y. Drag the hole to y = H/2 and the range is greatest, equal to H itself.',
        params: { mode: 'tank', H0: 50, y1: 12.5, dmm: 5, Dt: 15, real: false, two: true, hold: false } },
      { title: '3 · The throat of a venturi',
        body: 'Water at 12 L/min through a 2 : 1 constriction. Read the tubes.',
        ask: 'Where is the pressure lowest, and why?',
        reveal: '<b>At the throat.</b> Continuity makes it four times faster there, and Bernoulli pays for the kinetic energy out of pressure. The dashed energy line stays almost level. It falls only by friction.',
        params: { mode: 'venturi', vfluid: 'water', Qlpm: 12, beta: 0.5, loss: true, hback: 25 } },
      { title: '4 · Open the exit',
        body: 'Remove the back-pressure: the pipe discharges straight to air.',
        ask: 'Can a manometer read below the pipe?',
        reveal: '<b>No. It reverses and sucks air in.</b> The throat is below atmospheric pressure. That is how a scent sprayer, a Bunsen burner and a car carburettor all work.',
        params: { mode: 'venturi', vfluid: 'water', Qlpm: 12, beta: 0.5, loss: true, hback: 0 } },
      { title: '5 · The falling ball',
        body: 'A 2 mm steel ball in glycerine. It reaches terminal speed within a fraction of a millimetre.',
        ask: 'Double the radius. What happens to the terminal speed?',
        reveal: '<b>Four times faster in Stokes\' law (v ∝ r²).</b> The measured speed agrees only while Re stays well below 1. The v–r² plot shows the straight line bending away as the ball grows.',
        params: { mode: 'ball', bfluid: 'glycerine', ball: 'steel', rmm: 1, TC: 20, wall: true } },
      { title: '6 · Weigh it in water',
        body: 'Lower the aluminium block into water and read both instruments.',
        ask: 'The spring balance loses 1.22 N. Where does that force go?',
        reveal: '<b>Into the scale.</b> The water pushes up on the block with 1.22 N, and the block pushes down on the water with 1.22 N. The scale under the beaker rises by exactly that. Newton\'s third law is inside Archimedes\' principle.',
        params: { mode: 'buoy', block: 'aluminium', liq: 'water', lower: 18, cut: false } },
      { title: '7 · Capillaries',
        body: 'Three clean glass tubes, radii r, 2r, 4r, in water.',
        ask: 'The narrowest tube is only 10 cm tall, but the water wants to reach 14.9 cm. Does it spill over the top?',
        reveal: '<b>No.</b> It reaches the top and stops, and the meniscus flattens so the surface tension holds exactly the weight of the column. No fountain, no perpetual motion.',
        params: { mode: 'cap', cliq: 'water', waxed: false, crmm: 0.1, Lcm: 10 } },
      { title: '8 · The surface in a moving cart',
        body: 'The cart accelerates at 3 m/s². Watch the water, the pendulum and the red helium balloon.',
        ask: 'The pendulum swings back. Which way does the balloon lean?',
        reveal: '<b>Forward.</b> In the accelerating frame the air itself is pushed back, so the pressure is higher at the back. The balloon, lighter than the air, is pushed the other way. The water surface settles perpendicular to g − a, but it overshoots on the way.',
        params: { mode: 'frame', fsub: 'accel', acc: 3 } },
      { title: '9 · Spin the vessel',
        body: 'Spin it at 12 rad/s. Then push ω up.',
        ask: 'How fast must it spin for the bottom to show at the centre?',
        reveal: '<b>ω = 2√(gh₀)/R = 27.1 rad/s.</b> The rise at the wall and the dip at the centre are equal, ω²R²/4g each, until the centre runs dry. After that the dry spot grows.',
        params: { mode: 'frame', fsub: 'rotate', omg: 12 } },
      { title: '10 · Two bubbles',
        body: 'A 2 cm and a 4 cm bubble on the two ends of a tube. Open the valve.',
        ask: 'Do the bubbles become equal?',
        reveal: '<b>No: the small one empties into the big one.</b> Its pressure 4T/R is higher, so air leaves it and it gets smaller still, and its pressure rises further. It stops only as a flat cap with the big bubble\'s curvature. The right-hand plot shows why: pressure peaks at a hemisphere.',
        params: { mode: 'bubbles', r1: 2, r2: 4, sig: 0.025, open: true } },
      { title: '11 · The hydraulic lift',
        body: 'A 1000 kg load on a 20 cm piston, a 2 cm piston to push. Drag the pump handle down.',
        ask: 'The pressure is the same everywhere in the oil. Does the effort stay exactly Mg/100 through the stroke?',
        reveal: '<b>No: it creeps up.</b> The big piston rises while the small one sinks, so the effort also holds a growing head of oil, ρgx(1 + A₁/A₂). The work in equals Mgy plus the oil raised. Force is multiplied, work never is.',
        params: { mode: 'pascal', psub: 'lift', d1: 2, d2: 20, Mkg: 1000, xs: 20 } },
      { title: '12 · Push on a wall',
        body: '60 cm of water against a vertical wall. Then tilt the wall to 60°.',
        ask: 'Tilting the wall makes the total force bigger. Does the horizontal push on it change?',
        reveal: '<b>No.</b> The horizontal part is ρgwH²/2 at any tilt: it only depends on the depth. The extra force is vertical, the weight of the water sitting on the slope. The resultant always acts H/3 above the base.',
        params: { mode: 'pascal', psub: 'dam', dH: 60, doil: 0, dw: 50, dang: 60 } },
      { title: '13 · A thousand drops become one',
        body: 'Watch the drops join the central one, nearest first, while the surface area is added up.',
        ask: 'The volume is fixed. What fraction of the surface disappears?',
        reveal: '<b>90%.</b> The area goes from n·4πr² to 4π(n^⅓r)², a factor n^⅓ = 10 smaller. That energy, T times the lost area, becomes heat. Splitting a drop into a spray costs exactly the same energy.',
        params: { mode: 'drops', nk: 10, rdr: 1, dliq: 'water' } },
    ],

    quiz: [
      { q: 'A helium balloon on a string is inside a car that accelerates forward. The balloon:',
        options: ['Leans forward', 'Leans backward', 'Stays vertical', 'Rises straight up the string'], answer: 0,
        why: 'In the car\'s frame the air behaves as if gravity points down-and-back, so its pressure grows toward the back. Buoyancy pushes up that gradient: forward. The pendulum, denser than air, swings back.' },
      { q: 'Two soap bubbles of different sizes are connected. Air flows:',
        options: ['From the smaller to the larger', 'From the larger to the smaller', 'Until they are equal', 'Not at all'], answer: 0,
        why: 'Excess pressure 4T/R is larger in the smaller bubble, so it pushes air into the larger one. It is unstable: the small one keeps shrinking.' },
      { q: 'A cylinder of water spins at ω. The rise of the surface at the wall compared with the fall at the centre (before the centre dries) is:',
        options: ['Equal', 'Twice as large', 'Half as large', 'Zero: only the centre moves'], answer: 0,
        why: 'Conserving volume under a paraboloid puts z₀ at h₀ − ω²R²/4g, so both are ω²R²/4g.' },
      { q: 'Two holes in the side of a tank of water depth H, at heights y and H − y above the floor. Their jets land:',
        options: ['At the same distance', 'The upper one further', 'The lower one further', 'It depends on g'], answer: 0,
        why: 'R = 2√(h·y) with h = H − y. Swapping y and H − y leaves the product unchanged. Try the "two holes" preset.' },
      { q: 'The time for a tank to drain from height H to H/2 through a small hole, compared with from H/2 to 0, is:',
        options: ['Shorter', 'Equal', 'Longer', 'Twice as long'], answer: 0,
        why: 't ∝ √h. The first half of the height takes (1 − 1/√2) ≈ 29% of the total time, and the second half takes 71%. The flow slows as the head falls.' },
      { q: 'In a real venturimeter, the flow worked out from Δh using Bernoulli is:',
        options: ['A little more than the real flow', 'Exactly the real flow', 'A little less than the real flow', 'Unrelated'], answer: 0,
        why: 'Friction adds to the pressure drop between the taps, so Δh is too large and Q from the ideal formula is too big. Cd = Q_real/Q_formula ≈ 0.95–0.98.' },
      { q: 'A ball falls in a viscous liquid. If its radius is doubled, the terminal velocity (Stokes regime):',
        options: ['Becomes four times', 'Doubles', 'Halves', 'Stays the same'], answer: 0,
        why: 'Weight minus upthrust grows as r³, drag as r·v, so v ∝ r². This holds only while Re ≪ 1. A large enough ball leaves the regime.' },
      { q: 'A beaker of water on a scale reads 800 g. A block hung from a spring balance is lowered into the water without touching the bottom, and experiences 1.2 N of upthrust. The scale reads about:',
        options: ['922 g', '800 g', '678 g', 'It depends on the block\'s weight'], answer: 0,
        why: 'The water pushes the block up with 1.2 N, so the block pushes the water down with 1.2 N ≈ 122 g-weight. The block\'s own weight is carried by the spring, not the scale.' },
      { q: 'A capillary tube shorter than the rise height is dipped in water. The water:',
        options: ['Rises to the top and stops, with a flatter meniscus', 'Overflows as a fountain', 'Does not rise at all', 'Rises and falls forever'], answer: 0,
        why: 'The meniscus adjusts its contact angle until 2πrT cos θ\' equals the weight of the shorter column. Energy cannot be extracted from surface tension this way.' },
      { q: 'In a hydraulic lift the small piston moves down 10 cm. If the area ratio is 1 : 50, the load rises:',
        options: ['2 mm', '10 cm', '5 m', '0.2 mm'], answer: 0,
        why: 'The oil is incompressible, so A₁x₁ = A₂x₂ and x₂ = 10 cm/50 = 2 mm. The force is 50 times bigger, the distance 50 times smaller: the work is the same.' },
      { q: 'Water of depth H presses on a vertical wall. The resultant force acts at a height above the base of:',
        options: ['H/3', 'H/2', '2H/3', 'H/4'], answer: 0,
        why: 'The pressure grows linearly with depth: a triangle of load with its centroid a third of the way up from the base. The dam plot shows the triangle.' },
      { q: 'n identical drops merge into one. The energy released is proportional to:',
        options: ['n − n^(2/3)', 'n − 1', 'n^(1/3) − 1 only, independent of r', 'n²'], answer: 0,
        why: 'E = 4πr²T(n − n^(2/3)) = 4πR²T(n^⅓ − 1). The first form counts areas; the second uses the big drop.' }
    ],

    notes: '<b>Where this shows up in the paper.</b><ul>' +
      '<li><b>Torricelli</b>: v = √(2gh), range 2√(h(H − h)), maximum at h = H/2; draining time t = (A/a)√(2H/g).</li>' +
      '<li><b>Bernoulli and continuity</b>: venturimeter, aerofoil lift, the atomiser, and "which tube is higher" questions.</li>' +
      '<li><b>Viscosity</b>: Stokes\' law 6πηrv, terminal velocity ∝ r², Poiseuille flow, Reynolds number and the laminar–turbulent boundary.</li>' +
      '<li><b>Buoyancy</b>: apparent weight, fraction submerged = ρ_body/ρ_liquid, reading changes on a scale under the vessel.</li>' +
      '<li><b>Surface tension</b>: Jurin\'s law h = 2T cos θ/ρgr, excess pressure 2T/r, mercury depression, insufficient-length tubes.</li>' +
      '<li><b>Pascal and walls</b>: hydraulic lift F₁/A₁ = F₂/A₂ with equal work; force on a wall ρgwH²/2 acting at H/3; moment ρgwH³/6; layered liquids; inclined faces.</li>' +
      '<li><b>Drops</b>: merging releases 4πR²T(n^⅓ − 1), ΔT = (3T/ρc)(1/r − 1/R); splitting costs the same.</li></ul>' +
      '<div class="pyq"><em>Trap to avoid</em> — "the balance under the beaker reads the same, because the block is held by the string." It does not. It rises by exactly the upthrust. Newton\'s third law is part of every Archimedes problem.</div>' +
      '<div class="pyq"><em>Trap to avoid</em> — using Stokes\' law without checking Re. A steel ball in water falls about twenty times slower than Stokes predicts. The formula belongs to small, slow balls in thick liquids.</div>'
  });
})(window.InsightLab);
