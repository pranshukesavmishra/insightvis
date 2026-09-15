/* ============================================================
   PHYSICS — 1. Lorentz force   2. Young's double slit
   ============================================================ */
(function (L) {
  'use strict';
  const { clamp, TAU, fmt, E, Camera } = L;
  const PA = window.PHYSART, R3 = window.R3, RX = window.RX;

  /* ---- shared 3D drawing helpers ---- */
  function seg3(ctx, cam, a, b, color, width) {
    const A = cam.project(a), B = cam.project(b);
    if (!A.ok || !B.ok) return;
    ctx.strokeStyle = color; ctx.lineWidth = width || 1;
    ctx.beginPath(); ctx.moveTo(A.x, A.y); ctx.lineTo(B.x, B.y); ctx.stroke();
  }
  function arrow3(ctx, cam, a, b, color, width, head) {
    const A = cam.project(a), B = cam.project(b);
    if (!A.ok || !B.ok) return;
    ctx.strokeStyle = color; ctx.fillStyle = color; ctx.lineWidth = width || 1.5;
    ctx.beginPath(); ctx.moveTo(A.x, A.y); ctx.lineTo(B.x, B.y); ctx.stroke();
    const ang = Math.atan2(B.y - A.y, B.x - A.x), hs = head || 6;
    ctx.beginPath();
    ctx.moveTo(B.x, B.y);
    ctx.lineTo(B.x - hs * Math.cos(ang - 0.42), B.y - hs * Math.sin(ang - 0.42));
    ctx.lineTo(B.x - hs * Math.cos(ang + 0.42), B.y - hs * Math.sin(ang + 0.42));
    ctx.closePath(); ctx.fill();
  }
  function label3(ctx, cam, p, text, color, font) {
    const P = cam.project(p); if (!P.ok) return;
    ctx.font = font || '500 11px "IBM Plex Mono",monospace';
    ctx.fillStyle = color; ctx.textAlign = 'left'; ctx.textBaseline = 'middle';
    ctx.fillText(text, P.x + 6, P.y);
  }

  /* =========================================================================
     1 · THE LORENTZ FORCE BENCH — one chamber, five classic experiments

     Every one of them is the SAME equation, F = q(E + v x B), integrated with
     a Boris pusher. The pusher conserves |v| exactly under a pure magnetic
     field, which is why the speed readout is itself the proof that B does no
     work — it is not rounded to look constant, it IS constant.
     ========================================================================= */
  const QE = 1.602176634e-19, MP = 1.67262192e-27, ME = 9.1093837e-31;
  const U = 1.66053907e-27;                       // atomic mass unit
  const SPECIES = {
    p:     { q:  QE,     m: MP,          name: 'Proton',   sym: 'p⁺',  col: '#3DD6F5' },
    e:     { q: -QE,     m: ME,          name: 'Electron', sym: 'e⁻',  col: '#7CE0A8' },
    alpha: { q:  2 * QE, m: 4.0015 * MP, name: 'Alpha',    sym: 'α²⁺', col: '#FFAE4C' },
    d:     { q:  QE,     m: 2.0136 * MP, name: 'Deuteron', sym: 'd⁺',  col: '#B07CC6' }
  };
  /* the isotopes a real mass spectrometer is asked to separate */
  const ISOTOPES = [
    { name: '¹²C⁺',  m: 12.000 * U, q: QE, col: '#3DD6F5' },
    { name: '¹³C⁺',  m: 13.003 * U, q: QE, col: '#FFAE4C' },
    { name: '¹⁴C⁺',  m: 14.003 * U, q: QE, col: '#FF6B9D' }
  ];

  const MODES = [
    { id: 'helix',    name: 'Helix / circle' },
    { id: 'selector', name: 'Velocity selector' },
    { id: 'spectro',  name: 'Mass spectrometer' },
    { id: 'cycloid',  name: 'Released from rest' },
    { id: 'parallel', name: 'E parallel to B' }
  ];

  L.register({
    id: 'lorentz', subject: 'physics',
    name: 'The Lorentz Force Bench — Five Experiments, One Equation',
    chapter: 'Moving Charges & Magnetism',
    exams: ['JEE Main', 'JEE Advanced', 'NEET UG'],
    weight: 'Very high yield',
    is3D: true,
    stageHint: 'Drag to orbit the chamber · drag the injector to aim it · every path is F = q(E + v×B) integrated',
    lede: 'A circle, a helix, a velocity selector, a mass spectrometer and a cycloid are not five topics — ' +
      'they are <b>one equation under five sets of initial conditions</b>. This bench runs all of them in the ' +
      'same vacuum chamber with the same integrator, so you can watch the geometry change while the physics ' +
      'does not. The magnetic force does no work, and the speed readout proves it: the Boris pusher conserves ' +
      '|v| <b>exactly</b> under a pure B, so any change you see there came from E.',

    params: { mode: 'helix', species: 'p', v0: 1.2e6, pitchDeg: 90, B: 0.12, Ey: 0,
              showB: true, showVec: true, trail: true, chamber: true },

    presets: [
      { name: 'Circle — v perpendicular to B', params: { mode: 'helix', species: 'p', pitchDeg: 90, B: 0.12, v0: 1.2e6 } },
      { name: 'Helix — v at 55°', params: { mode: 'helix', species: 'p', pitchDeg: 55, B: 0.12, v0: 1.2e6 } },
      { name: 'Velocity selector', params: { mode: 'selector', species: 'p', B: 0.12, v0: 1.2e6, Ey: 1.44e5 } },
      { name: 'Mass spectrometer — carbon isotopes', params: { mode: 'spectro', B: 0.12, Ey: 1.52e4 } },
      { name: 'Released from rest — the cycloid', params: { mode: 'cycloid', species: 'p', B: 0.12, Ey: 6e4 } },
      { name: 'E parallel to B — accelerating helix', params: { mode: 'parallel', species: 'p', pitchDeg: 70, B: 0.12, Ey: 4e4 } },
      { name: 'Electron in the same field', params: { mode: 'helix', species: 'e', pitchDeg: 90, B: 0.12, v0: 1.2e6 } }
    ],

    controls: [
      { group: 'Experiment', items: [
        { key: 'mode', type: 'select', label: 'Configuration', restructure: true,
          options: MODES.map(m => ({ value: m.id, label: m.name })) }
      ] },
      { group: 'Particle', items: [
        { key: 'species', type: 'select', label: 'Species', restructure: true, options: [
          { value: 'p', label: 'p⁺' }, { value: 'e', label: 'e⁻' },
          { value: 'alpha', label: 'α²⁺' }, { value: 'd', label: 'd⁺' }] },
        { key: 'v0', label: 'Injection speed <i>v</i>₀', min: 1e5, max: 6e6, step: 1e4, unit: 'm/s',
          fmt: v => fmt(v, 3), restructure: true },
        { key: 'pitchDeg', label: 'Pitch angle <i>θ</i> (v to B)', min: 0, max: 90, step: 1, unit: '°',
          fmt: v => v.toFixed(0), restructure: true }
      ] },
      { group: 'Fields', items: [
        { key: 'B', label: 'Magnetic field <i>B</i><sub>z</sub>', min: 0.02, max: 0.5, step: 0.005, unit: 'T',
          fmt: v => v.toFixed(3), restructure: true },
        { key: 'Ey', label: 'Electric field <i>E</i>', min: 0, max: 6e5, step: 2e3, unit: 'V/m',
          fmt: v => fmt(v, 3), restructure: true }
      ] },
      { group: 'Display', items: [
        { key: 'chamber', type: 'toggle', label: 'Show the apparatus' },
        { key: 'showB', type: 'toggle', label: 'Show the field lattice' },
        { key: 'showVec', type: 'toggle', label: 'Show v and F vectors' },
        { key: 'trail', type: 'toggle', label: 'Show the trail' }
      ] }
    ],

    setup(S) {
      const p = S.p;
      const sp = SPECIES[p.species] || SPECIES.p;
      S.sp = sp; S.mode = p.mode;
      S.q = sp.q; S.m = sp.m;

      // the reference orbit, from the control values
      const th = p.pitchDeg * Math.PI / 180;
      S.vperp0 = p.v0 * Math.sin(th);
      S.vpar0 = p.v0 * Math.cos(th);
      S.rc = S.vperp0 * S.m / (Math.abs(S.q) * p.B);
      S.Tc = TAU * S.m / (Math.abs(S.q) * p.B);
      S.fc = 1 / S.Tc;
      S.pitchLen = S.vpar0 * S.Tc;
      // A selector with no electric field is not a selector — every particle
      // simply circles. If the student has zeroed E, the bench supplies the
      // field that matches the injection speed rather than showing nothing.
      if ((p.mode === 'selector' || p.mode === 'spectro') && p.Ey <= 0) {
        p.Ey = p.mode === 'selector'
          ? p.v0 * p.B
          : Math.sqrt(2 * QE * 1000 / (12 * U)) * p.B;
      }
      S.vSel = p.B > 0 ? p.Ey / p.B : 0;            // the speed a selector passes
      S.vDrift = p.B > 0 ? p.Ey / p.B : 0;          // |E x B|/B², same magnitude
      S.matched = p.Ey > 0 && Math.abs(S.vSel - p.v0) / Math.max(p.v0, 1) < 0.02;

      /* ---- the beam: one particle, or several when the experiment needs it ---- */
      const mk = (q, m, vel, col, name, start) => ({
        q: q, m: m, pos: (start || [0, 0, 0]).slice(), vel: vel.slice(), col: col, name: name,
        trail: [], alive: true, landed: null, entered: false,
        r: m * Math.hypot(vel[0], vel[1], vel[2]) / (Math.abs(q) * p.B)
      });

      if (p.mode === 'selector') {
        // three speeds through the same crossed fields: only one goes straight
        const vm = S.vSel > 0 ? S.vSel : p.v0;
        S.parts = [
          mk(sp.q, sp.m, [vm * 0.65, 0, 0], '#FF6B9D', '0.65 E/B'),
          mk(sp.q, sp.m, [vm, 0, 0], '#7CE0A8', 'v = E/B'),
          mk(sp.q, sp.m, [vm * 1.35, 0, 0], '#FFAE4C', '1.35 E/B')
        ];
      } else if (p.mode === 'spectro') {
        // A real spectrometer runs its ions slowly — a carbon ion at 10⁶ m/s
        // would need a three-metre radius. The selector speed is used, and if
        // no E has been set the bench falls back to a 1 kV accelerating stage.
        const vm = S.vSel > 0 ? S.vSel : Math.sqrt(2 * QE * 1000 / (12 * U));
        S.specV = vm;
        S.parts = ISOTOPES.map(iso =>
          mk(iso.q, iso.m, [vm, 0, 0], iso.col, iso.name, [-1, 0, 0]));
      } else if (p.mode === 'cycloid') {
        S.parts = [mk(sp.q, sp.m, [0, 0, 0], sp.col, 'from rest')];
      } else if (p.mode === 'parallel') {
        S.parts = [mk(sp.q, sp.m, [S.vperp0, 0, S.vpar0], sp.col, sp.sym)];
      } else {
        S.parts = [mk(sp.q, sp.m, [S.vperp0, 0, S.vpar0], sp.col, sp.sym)];
      }

      /* ---- the field, as a function of position ----
         The spectrometer needs E only in its selector stage, which is what
         makes it a two-stage instrument rather than one formula. */
      S.field = (pos) => {
        if (p.mode === 'spectro') {
          // stage 1 (x < 0) selects the speed; stage 2 (x >= 0) bends it
          return pos[0] < 0 ? [0, p.Ey, 0, 0, 0, p.B] : [0, 0, 0, 0, 0, p.B];
        }
        if (p.mode === 'parallel') return [0, 0, p.Ey, 0, 0, p.B];   // E along B
        if (p.mode === 'helix') return [0, 0, 0, 0, 0, p.B];
        return [0, p.Ey, 0, 0, 0, p.B];
      };

      // the natural length of the experiment, used to size the chamber
      const rSel = S.m * (S.vSel || p.v0) / (Math.abs(S.q) * p.B);
      if (p.mode === 'spectro') {
        // size the instrument from the heaviest ion it has to separate
        S.rIso = ISOTOPES.map(iso => iso.m * S.specV / (iso.q * p.B));
        S.rMax = Math.max.apply(null, S.rIso);
        S.selLen = S.rMax * 0.85;
        S.parts.forEach(q => { q.pos[0] = -S.selLen; });
      } else {
        S.selLen = rSel * 1.6;
      }
      S.Lscale = p.mode === 'spectro'
        ? Math.max(S.rMax * 1.65, 1e-9)
        : p.mode === 'selector'
        ? Math.max(rSel * 2.2, 1e-9)
        : p.mode === 'cycloid'
        ? Math.max(S.m * S.vDrift / (Math.abs(S.q) * p.B) * 3.2, 1e-9)
        : Math.max(S.rc, 0.55 * S.pitchLen, 1e-9);

      S.tp = 0; S.hist = []; S.speed = p.v0; S.done = false; S.hold = 0;
      // The chamber is sized to whatever experiment is inside it, and the
      // camera is framed on the chamber — a fixed distance left the
      // spectrometer sitting in a room three times too big for it.
      S.CH = p.mode === 'spectro' ? 0.95 : p.mode === 'selector' ? 1.15 : 1.5;
      S.plateY = S.CH * 0.42;                       // half the plate separation
      const dist = S.CH * 2.9;
      // The selector and the spectrometer do all their work in the z = 0
      // plane, so they are framed from above where the plates are edge-on and
      // the deflection is the whole picture. A helix needs the oblique view.
      const flat = p.mode === 'selector' || p.mode === 'spectro' || p.mode === 'cycloid';
      const view = flat ? { theta: -1.30, phi: 1.02 } : { theta: -1.05, phi: 0.30 };
      if (!S.cam) {
        S.cam = Camera({ theta: view.theta, phi: view.phi, dist: dist });
        S.cam.minDist = 0.6; S.cam.maxDist = 26;
      } else {
        S.cam.home.dist = dist;
        S.cam.home.theta = view.theta; S.cam.home.phi = view.phi;
        S.cam.dist = dist;
        if (S.viewMode !== p.mode) { S.cam.theta = view.theta; S.cam.phi = view.phi; }
      }
      S.viewMode = p.mode;
      S.cam.target = [0, 0, 0];
    },

    step(S, dt) {
      const p = S.p;
      S.t = (S.t || 0) + dt;
      if (S.done) {
        S.hold += dt;
        if (S.hold > 2.0) this.setup(S);
        return;
      }
      const rate = 2.2 * S.Tc;                     // about 2 cyclotron turns a second
      const want = dt * rate;
      const hMax = S.Tc / 160;
      const n = clamp(Math.ceil(want / hMax), 1, 500);
      const h = want / n;
      const k = 1 / S.Lscale;
      // In the selector the walls are the plates themselves, so a beam that is
      // not travelling at E/B is absorbed rather than flying on for ever.
      const bound = p.mode === 'selector' ? S.plateY
                  : p.mode === 'spectro' ? 3.2 : 1e9;

      for (let i = 0; i < n; i++) {
        S.parts.forEach(q => {
          if (!q.alive) return;
          const [Ex, Ey, Ez, Bx, By, Bz] = S.field(q.pos);
          const qm = q.q / q.m, f = qm * h / 2;
          // Boris: half electric kick, full magnetic rotation, half electric kick
          let vx = q.vel[0] + f * Ex, vy = q.vel[1] + f * Ey, vz = q.vel[2] + f * Ez;
          const tz = f * Bz, s2 = 2 * tz / (1 + tz * tz);
          const px = vx + vy * tz, py = vy - vx * tz;
          vx = vx + py * s2; vy = vy - px * s2;
          vx += f * Ex; vy += f * Ey; vz += f * Ez;
          q.vel[0] = vx; q.vel[1] = vy; q.vel[2] = vz;
          q.pos[0] += vx * h; q.pos[1] += vy * h; q.pos[2] += vz * h;
          // A real instrument has walls, and hitting one is a result. In the
          // spectrometer the wall IS the detector: the ion curves through a
          // half circle and comes back to x = 0 at y = -2r, which is the
          // measurement the machine exists to make.
          if (p.mode === 'spectro') {
            if (q.pos[0] > 0) q.entered = true;
            if (q.entered && q.pos[0] <= 0) {
              q.alive = false;
              q.landed = [0, q.pos[1], q.pos[2]];
            }
          } else if (Math.abs(q.pos[1] * k) > bound ||
                     Math.abs(q.pos[0] * k) > (p.mode === 'selector' ? S.CH * 1.05 : bound)) {
            q.alive = false;
            q.landed = [q.pos[0], q.pos[1], q.pos[2]];
          }
        });
        S.tp += h;
      }

      S.parts.forEach(q => {
        q.trail.push([q.pos[0] * k, q.pos[1] * k, q.pos[2] * k, S.tp]);
        const keep = p.mode === 'helix' || p.mode === 'parallel' ? 2.2 * S.Tc : 9 * S.Tc;
        while (q.trail.length > 2 && q.trail[0][3] < S.tp - keep) q.trail.shift();
        if (q.trail.length > 2600) q.trail.shift();
      });

      const lead = S.parts[0];
      S.speed = Math.hypot(lead.vel[0], lead.vel[1], lead.vel[2]);
      S.hist.push([S.tp / S.Tc, S.speed, lead.vel[2],
                   Math.hypot(lead.vel[0], lead.vel[1])]);
      while (S.hist.length > 2 && S.hist[0][0] < S.tp / S.Tc - 3.2) S.hist.shift();
      if (S.parts.every(q => !q.alive)) S.done = true;

      // follow the beam when it drifts out of the chamber's middle
      if (p.mode === 'helix' || p.mode === 'parallel' || p.mode === 'cycloid') {
        let cx = 0, cy = 0, cz = 0, nT = 0;
        S.parts.forEach(q => q.trail.forEach(t => { cx += t[0]; cy += t[1]; cz += t[2]; nT++; }));
        if (nT) {
          S.cam.target[0] += ((cx / nT) - S.cam.target[0]) * 0.05;
          S.cam.target[1] += ((cy / nT) - S.cam.target[1]) * 0.05;
          S.cam.target[2] += ((cz / nT) - S.cam.target[2]) * 0.05;
        }
      }
    },

    drawStage(S, g) {
      const ctx = g.ctx, cam = S.cam, th = g.theme, p = S.p;
      const F = R3.Frame(ctx, cam, { ambient: 0.30, floorZ: null });
      const k = 1 / S.Lscale;
      const NORTH = '#FF5E6C', SOUTH = '#4D8CF5', EF = '#FFD36B', BF = '#8FA4CE';

      /* ---------------- the vacuum chamber ----------------
         Real apparatus, pushed behind the beam: a single depth key cannot
         sort a large flat panel against a small particle in front of it. */
      const CH = S.CH;
      if (p.chamber) {
        // the pole faces that produce B, above and below
        // Seen from above, a solid pole face sits squarely between the camera
        // and the beam, so in the flat experiments the poles are drawn as
        // outlines — the information without the occlusion.
        const flatView = p.mode === 'selector' || p.mode === 'spectro' || p.mode === 'cycloid';
        /* Whichever pole is on the camera's side of the mid-plane is the one
           that would hide the beam, and that is a question about where the
           camera is, not about which mode is running. Outline that one and
           leave the far pole solid, and the chamber stays readable from every
           angle the orbit can reach. */
        const nearSign = Math.sin(S.cam.phi) >= 0 ? 1 : -1;
        [[1, NORTH, 'N'], [-1, SOUTH, 'S']].forEach(([sg, col, tag]) => {
          const zz = sg * CH * 0.95, rr = CH * 0.50;
          if (flatView || sg === nearSign) {
            const ring = [];
            for (let i = 0; i <= 48; i++) {
              const a = i / 48 * TAU;
              ring.push([Math.cos(a) * rr, Math.sin(a) * rr, zz]);
            }
            R3.polyline(F, ring, col, { alpha: 0.45, width: 1.6, bias: F.GROUND });
            for (let i = 0; i < 10; i++) {
              const a = i / 10 * TAU;
              R3.polyline(F, [[Math.cos(a) * rr, Math.sin(a) * rr, zz],
                              [Math.cos(a) * rr * 0.82, Math.sin(a) * rr * 0.82, zz]],
                          col, { alpha: 0.25, width: 1, bias: F.GROUND });
            }
          } else {
            R3.cylinder(F, [0, 0, sg * CH * 0.90], [0, 0, sg * CH * 1.00], rr, col,
                        { segments: 26, shadow: false, ambient: 0.38, bias: F.GROUND });
          }
          R3.callout(F, [sg * rr * 0.72, rr * 0.72, zz], sg > 0 ? 20 : -20,
                     sg > 0 ? -12 : 12, tag + ' pole', col);
        });
        // the deflecting plates that produce E, when there is one
        if (p.Ey > 0 && p.mode !== 'parallel') {
          const plateX = p.mode === 'spectro' ? [-S.selLen * k * 1.05, 0] : [-CH, CH];
          // a capacitor, not a billboard: the plates are close enough together
          // to read as a gap, and the beams that miss the slit end ON them
          [[1, '+'], [-1, '−']].forEach(([sg, sign]) => {
            R3.box(F, [(plateX[0] + plateX[1]) / 2, sg * S.plateY, 0],
                   [plateX[1] - plateX[0], CH * 0.030, CH * 0.30],
                   sg > 0 ? '#C4517A' : '#3E6E9E',
                   { shadow: false, ambient: 0.42, bias: F.GROUND });
            R3.label(F, [(plateX[0] + plateX[1]) / 2, sg * S.plateY * 1.22, 0],
                     sign, sg > 0 ? '#FFB3C6' : '#9FC8F0', { size: 14, bias: F.GROUND });
          });
          // the field between them, as arrows from + to −
          for (let i = 0; i < 4; i++) {
            const xx = plateX[0] + (plateX[1] - plateX[0]) * (i + 0.5) / 4;
            R3.arrow(F, [xx, S.plateY * 0.88, 0], [xx, -S.plateY * 0.88, 0],
                     CH * 0.006, EF, { head: CH * 0.04, shadow: false, ambient: 0.6,
                                       bias: F.GROUND });
          }
          R3.callout(F, [(plateX[0] + plateX[1]) / 2, -S.plateY, -CH * 0.28], -14, 18,
                     'E = ' + fmt(p.Ey, 3) + ' V/m', EF);
        }
        // the injector the beam comes out of
        R3.cylinder(F, [-CH * 1.12, 0, 0], [-CH * 0.94, 0, 0], CH * 0.10, '#6E7E9E',
                    { segments: 18, shadow: false, ambient: 0.40, bias: F.GROUND });
        R3.callout(F, [-CH * 1.10, 0, 0], -14, -16, 'injector', th['text-3']);
        // the slit a selector passes its beam through, or the detector strip
        if (p.mode === 'selector') {
          [[1], [-1]].forEach(([sg]) => {
            R3.box(F, [CH * 0.96, sg * CH * 0.20, 0], [CH * 0.05, CH * 0.28, CH * 0.9],
                   '#8FA3C0', { shadow: false, ambient: 0.45, bias: F.GROUND });
          });
          R3.callout(F, [CH * 0.96, 0, 0], 18, -18, 'slit — only v = E/B gets through', '#7CE0A8');
        }
        if (p.mode === 'spectro') {
          // the detector stands in the entry plane, because a half circle
          // brings every ion back to x = 0 at y = -2r
          const yLo = -2 * S.rMax * k * 1.12;
          R3.box(F, [0, yLo / 2, 0], [CH * 0.035, Math.abs(yLo), CH * 0.14],
                 '#7A8AA8', { shadow: false, ambient: 0.50, bias: F.GROUND });
          R3.callout(F, [0, yLo, 0], -10, 20, 'detector plate', th['text-2']);
          // the tick marks the instrument is calibrated against
          S.rIso.forEach((r, i) => {
            const yy = -2 * r * k;
            R3.polyline(F, [[0, yy, -CH * 0.12], [0, yy, CH * 0.12]], ISOTOPES[i].col,
                        { alpha: 0.9, width: 2.2, bias: F.GROUND });
            R3.callout(F, [0, yy, 0], -22, 0,
                       ISOTOPES[i].name + '  ' + (2 * r * 1000).toFixed(0) + ' mm',
                       ISOTOPES[i].col, { size: 8.5 });
          });
          R3.label(F, [-S.selLen * k * 0.5, CH * 0.30, 0], 'stage 1 · selects the speed',
                   '#7CE0A8', { size: 8.5, bias: F.GROUND });
          R3.label(F, [S.rMax * k * 0.75, -S.rMax * k * 0.35, 0], 'stage 2 · pure B bends it',
                   BF, { size: 8.5, bias: F.GROUND });
        }
        // the chamber outline
        const c = CH;
        const corners = [[-c,-c,-c],[c,-c,-c],[c,c,-c],[-c,c,-c],[-c,-c,c],[c,-c,c],[c,c,c],[-c,c,c]];
        [[0,1],[1,2],[2,3],[3,0],[4,5],[5,6],[6,7],[7,4],[0,4],[1,5],[2,6],[3,7]].forEach(([a,b]) =>
          R3.polyline(F, [corners[a], corners[b]], '#4E6392',
                      { alpha: 0.28, width: 1, bias: F.GROUND }));
      }

      /* ---------------- the field lattice ---------------- */
      if (p.showB) {
        for (let i = -1; i <= 1; i++) for (let j = -1; j <= 1; j++) {
          if (i === 0 && j === 0) continue;
          R3.arrow(F, [i * CH * 1.18, j * CH * 1.18, -CH * 0.78],
                        [i * CH * 1.18, j * CH * 1.18, CH * 0.78],
                   CH * 0.007, BF, { head: CH * 0.045, shadow: false, ambient: 0.6,
                                     bias: F.GROUND });
        }
        R3.label(F, [CH * 1.18, CH * 1.18, CH * 0.92],
                 'B = ' + p.B.toFixed(3) + ' T  (+z)', BF, { size: 9.5, bias: F.GROUND });
      }

      /* ---------------- the beams ---------------- */
      S.parts.forEach(q => {
        if (p.trail && q.trail.length > 2) {
          R3.polyline(F, q.trail.map(t => [t[0], t[1], t[2]]), q.col,
                      { alpha: 0.85, width: 2.2 });
        }
        const at = [q.pos[0] * k, q.pos[1] * k, q.pos[2] * k];
        const pr = cam.project(at);
        if (pr.ok) {
          F.push(at, () => {
            ctx.save(); ctx.globalCompositeOperation = 'lighter';
            const rr = 11;
            const gg = ctx.createRadialGradient(pr.x, pr.y, 0, pr.x, pr.y, rr);
            gg.addColorStop(0, g.alpha(q.col, .85)); gg.addColorStop(1, g.alpha(q.col, 0));
            ctx.fillStyle = gg;
            ctx.beginPath(); ctx.arc(pr.x, pr.y, rr, 0, TAU); ctx.fill();
            ctx.restore();
          }, -1);
        }
        R3.sphere(F, at, CH * 0.045, q.col, { shadow: false, rim: 0.9 });
        if (S.parts.length > 1) R3.callout(F, at, 16, -12, q.name, q.col, { size: 9 });
        if (q.landed) {
          R3.label(F, [q.landed[0] * k, q.landed[1] * k, q.landed[2] * k],
                   '●', q.col, { size: 13 });
        }
      });

      /* ---------------- v and F on the leading particle ---------------- */
      if (p.showVec) {
        const q = S.parts[0];
        const at = [q.pos[0] * k, q.pos[1] * k, q.pos[2] * k];
        const sp = Math.hypot(q.vel[0], q.vel[1], q.vel[2]) || 1;
        const vs = CH * 0.42 / sp;
        R3.arrow(F, at, [at[0] + q.vel[0] * vs, at[1] + q.vel[1] * vs, at[2] + q.vel[2] * vs],
                 CH * 0.012, '#F2F6FF', { head: CH * 0.07, shadow: false, label: 'v' });
        const [Ex, Ey, Ez, , , Bz] = S.field(q.pos);
        const Fx = q.q * (Ex + q.vel[1] * Bz);
        const Fy = q.q * (Ey - q.vel[0] * Bz);
        const Fz = q.q * Ez;
        const fm = Math.hypot(Fx, Fy, Fz) || 1;
        const fs2 = CH * 0.34 / fm;
        R3.arrow(F, at, [at[0] + Fx * fs2, at[1] + Fy * fs2, at[2] + Fz * fs2],
                 CH * 0.012, '#FF6B9D', { head: CH * 0.07, shadow: false, label: 'F' });
      }

      // the injector is a handle: drag it to aim the beam
      {
        const gp = cam.project([-CH * 1.03, 0, 0]);
        if (gp.ok) g.handle(gp.x, gp.y, 18, 'aim');
      }

      F.render();

      /* ---------------- header ---------------- */
      const md = MODES.find(m => m.id === p.mode) || MODES[0];
      ctx.textAlign = 'left'; ctx.textBaseline = 'top';
      ctx.font = '700 19px "IBM Plex Sans Condensed",sans-serif';
      ctx.fillStyle = p.mode === 'selector' && S.matched ? th.ok : th.text;
      ctx.fillText(md.name.toUpperCase() +
        (p.mode === 'helix' ? (p.pitchDeg > 89 ? ' — a closed circle' : ' — pitch ' + fmt(S.pitchLen * 1000, 3) + ' mm') : ''), 14, 8);
      ctx.font = '500 10px "IBM Plex Mono",monospace'; ctx.fillStyle = th['text-3'];
      ctx.fillText('r = mv⊥/|q|B = ' + fmt(S.rc * 1000, 3) + ' mm   ·   T = 2πm/|q|B = ' +
        fmt(S.Tc, 3) + ' s   ·   f_c = ' + fmt(S.fc, 3) + ' Hz', 14, 31);
      // In the spectrometer E acts only in stage 1, so once an ion is in the
      // analysing field its speed is constant — saying otherwise would be a lie.
      const inStage2 = p.mode === 'spectro' && S.parts[0] && S.parts[0].pos[0] > 0;
      const noWork = p.Ey === 0 || p.mode === 'helix' || inStage2;
      ctx.fillStyle = noWork ? th.ok : th.warn;
      ctx.fillText(inStage2
        ? 'in stage 2 there is no E, so |v| = ' + fmt(S.speed, 5) +
          ' m/s holds and the radius reads the mass'
        : noWork
        ? '|v| = ' + fmt(S.speed, 5) + ' m/s — constant to the last digit, because B does no work'
        : p.mode === 'cycloid'
          ? 'drift v = E/B = ' + fmt(S.vDrift, 3) + ' m/s — the same for ANY charge and ANY mass'
          : 'E is doing work, so |v| = ' + fmt(S.speed, 4) + ' m/s is changing', 14, 45);
    },

    /* the injector is aimed by hand: drag it up and down to set the pitch angle */
    onDrag(S, e) {
      if (e.id !== 'aim') return;
      if (S.p.mode === 'cycloid') return;            // released from rest — nothing to aim
      S.p.pitchDeg = clamp(S.p.pitchDeg - e.dy * 0.4, 0, 90);
      this.setup(S);
    },

    plots: [
      { title: 'Speed and its components — does the magnetic force do work?',
        legend: [{ c: '#3DD6F5', label: '|v| total speed' }, { c: '#7CE0A8', label: 'v∥ along B' },
                 { c: '#FFAE4C', label: 'v⊥ across B' }],
        draw(S, g) {
          if (!S.hist.length) return;
          const p = S.p;
          let vmax = p.v0 * 1.35;
          S.hist.forEach(h => { vmax = Math.max(vmax, h[1] * 1.15); });
          const t1 = Math.max(3, S.tp / S.Tc);
          const P = g.Plot({
            xmin: Math.max(0, t1 - 3), xmax: Math.max(3, t1), ymin: 0, ymax: vmax / 1e6,
            xlabel: 't / T_c', ylabel: 'speed (10⁶ m/s)',
            xfmt: v => v.toFixed(1), yfmt: v => v.toFixed(2),
            pad: { l: 56, r: 16, t: 14, b: 34 }
          }).frame();
          P.clip(() => {
            P.line(S.hist.map(h => [h[0], h[3] / 1e6]), '#FFAE4C', 1.8);
            P.line(S.hist.map(h => [h[0], h[2] / 1e6]), '#7CE0A8', 1.8);
            P.line(S.hist.map(h => [h[0], h[1] / 1e6]), '#3DD6F5', 2.6);
            P.hline(p.v0 / 1e6, g.alpha(g.theme['text-3'], .8), [3, 3]);
          });
          P.tag(P.cfg.xmin, p.v0 / 1e6, 'v₀', g.theme['text-3'], 'left', -8);
          P.tag(P.cfg.xmax, vmax / 1e6 * 0.94,
                (p.Ey === 0 || p.mode === 'helix')
                  ? 'flat |v| — B changes direction only' : 'E is adding energy',
                (p.Ey === 0 || p.mode === 'helix') ? g.theme.ok : g.theme.warn, 'right', 0);
        },
        hover(S, x) {
          if (!S.hist.length) return null;
          let b = S.hist[0];
          for (const h of S.hist) if (Math.abs(h[0] - x) < Math.abs(b[0] - x)) b = h;
          return [{ label: 't / T_c', value: b[0].toFixed(3) },
                  { label: '|v|', value: fmt(b[1], 5) + ' m/s', color: '#3DD6F5' },
                  { label: 'v∥ (along B)', value: fmt(b[2], 4) + ' m/s', color: '#7CE0A8' },
                  { label: 'v⊥ (across B)', value: fmt(b[3], 4) + ' m/s', color: '#FFAE4C' },
                  { label: 'KE', value: fmt(0.5 * S.m * b[1] * b[1] / QE, 4) + ' eV' }];
        } },
      { title: 'Radius against momentum — one straight line per charge state',
        legend: [{ c: '#3DD6F5', label: 'q = +e' }, { c: '#FFAE4C', label: 'q = +2e' }],
        draw(S, g) {
          const p = S.p;
          const pmax = 6e6 * 4.0 * MP;                  // the heaviest fast case on the bench
          const rmax = pmax / (QE * p.B) * 1000;
          const P = g.Plot({
            xmin: 0, xmax: pmax / 1e-21, ymin: 0, ymax: rmax * 1.05,
            xlabel: 'momentum p = mv  (10⁻²¹ kg·m/s)', ylabel: 'radius r = p/qB  (mm)',
            xfmt: v => v.toFixed(0), yfmt: v => v.toFixed(0),
            pad: { l: 60, r: 16, t: 14, b: 34 }
          }).frame();
          P.clip(() => {
            [[1, '#3DD6F5'], [2, '#FFAE4C']].forEach(([z, col]) => {
              P.line([[0, 0], [pmax / 1e-21, pmax / (z * QE * p.B) * 1000]], col, 2.2);
            });
            // where each particle on the bench actually sits
            S.parts.forEach(q => {
              const mom = q.m * Math.hypot(q.vel[0], q.vel[1], q.vel[2]);
              P.dot(mom / 1e-21, mom / (Math.abs(q.q) * p.B) * 1000, 4.6, q.col, true);
            });
            if (p.mode === 'spectro') {
              ISOTOPES.forEach(iso => {
                const mom = iso.m * (S.vSel || p.v0);
                P.tag(mom / 1e-21, mom / (iso.q * p.B) * 1000, iso.name, iso.col, 'left', -9);
              });
            }
          });
          P.tag(pmax / 1e-21 * 0.98, rmax * 0.30,
                'same B — so radius reads momentum directly', g.theme['text-3'], 'right', 0);
        },
        hover(S, x) {
          const p = S.p, mom = x * 1e-21;
          return [{ label: 'momentum', value: fmt(mom, 4) + ' kg·m/s' },
                  { label: 'r for q = +e', value: (mom / (QE * p.B) * 1000).toFixed(3) + ' mm', color: '#3DD6F5' },
                  { label: 'r for q = +2e', value: (mom / (2 * QE * p.B) * 1000).toFixed(3) + ' mm', color: '#FFAE4C' },
                  { label: 'B in use', value: p.B.toFixed(3) + ' T' }];
        } }
    ],

    readouts(S) {
      const p = S.p;
      const ke = 0.5 * S.m * (S.speed || p.v0) * (S.speed || p.v0) / QE;
      const out = [
        { label: 'Radius r = mv⊥/|q|B', value: fmt(S.rc * 1000, 4), unit: 'mm', flag: 'accent' },
        { label: 'Period T = 2πm/|q|B', value: fmt(S.Tc, 4), unit: 's',
          hint: 'independent of v and of r' },
        { label: 'Cyclotron frequency', value: fmt(S.fc, 4), unit: 'Hz' },
        { label: 'Helix pitch v∥T', value: fmt(S.pitchLen * 1000, 4), unit: 'mm',
          hint: p.pitchDeg > 89 ? 'zero — the orbit closes' : 'B never touches v∥' },
        { label: 'Live speed |v|', value: fmt(S.speed || p.v0, 6), unit: 'm/s',
          flag: (p.Ey > 0 && p.mode !== 'helix') ? 'warn' : 'ok',
          hint: (p.Ey > 0 && p.mode !== 'helix') ? 'E does work, so this moves'
                                                 : 'constant — B does no work' },
        { label: 'Kinetic energy', value: fmt(ke, 4), unit: 'eV' },
        { label: 'q/m', value: fmt(S.q / S.m, 4), unit: 'C/kg',
          hint: 'the only particle property the motion knows about' }
      ];
      if (p.Ey > 0) {
        out.push({ label: 'Selector speed E/B', value: fmt(S.vSel, 4), unit: 'm/s',
          flag: S.matched ? 'ok' : '',
          hint: S.matched ? 'matched — the beam goes straight' : 'v₀ ≠ E/B, so the beam bends' });
        out.push({ label: 'E×B drift speed', value: fmt(S.vDrift, 4), unit: 'm/s',
          flag: 'accent', hint: 'independent of charge AND of mass' });
      }
      if (p.mode === 'spectro') {
        out.push({ label: 'Ion speed entering stage 2', value: fmt(S.specV, 4), unit: 'm/s',
          hint: S.vSel > 0 ? 'set by the selector, E/B' : 'from a 1 kV accelerating stage' });
        ISOTOPES.forEach(iso => {
          const r = iso.m * S.specV / (iso.q * p.B);
          out.push({ label: iso.name + ' lands at 2r', value: (2 * r * 1000).toFixed(3), unit: 'mm',
                     hint: 'm = qBr/v — the measurement the instrument makes' });
        });
        const r12 = ISOTOPES[0].m * S.specV / (QE * p.B);
        const r13 = ISOTOPES[1].m * S.specV / (QE * p.B);
        out.push({ label: 'Separation of ¹²C and ¹³C', value: (2 * (r13 - r12) * 1000).toFixed(3),
                   unit: 'mm', flag: 'accent', hint: 'what the detector has to resolve' });
      }
      const beta = (S.speed || p.v0) / 2.998e8;
      out.push({ label: 'v/c', value: beta.toFixed(4), unit: '',
        flag: beta > 0.1 ? 'warn' : 'ok',
        hint: beta > 0.1 ? 'relativistic — the real period would lengthen' : 'non-relativistic, T is safe' });
      return out;
    },

    equation(S) {
      const p = S.p;
      return E.v('F') + '⃗ ' + E.op('=') + ' ' + E.v('q') + '(' + E.v('E') + '⃗ ' + E.op('+') +
        ' ' + E.v('v') + '⃗ ' + E.op('×') + ' ' + E.v('B') + '⃗)' +
        '&nbsp;&nbsp;&nbsp;' + E.v('r') + ' ' + E.op('=') + ' ' +
        E.frac(E.v('mv') + '<sub>⊥</sub>', '|' + E.v('q') + '|' + E.v('B')) + ' ' + E.op('=') +
        ' ' + E.n(S.rc * 1000, 'mm') +
        '<br>' + E.v('T') + ' ' + E.op('=') + ' ' + E.frac('2π' + E.v('m'), '|' + E.v('q') + '|' + E.v('B')) +
        ' — no ' + E.v('v') + ', no ' + E.v('r') +
        (p.Ey > 0 ? '&nbsp;&nbsp;&nbsp;' + E.v('v') + E.sub('drift') + ' ' + E.op('=') + ' ' +
          E.frac('|' + E.v('E') + '⃗ ' + E.op('×') + ' ' + E.v('B') + '⃗|', E.v('B') + '²') +
          ' ' + E.op('=') + ' ' + E.n(S.vDrift, 'm/s') : '');
    },

    walkthrough: [
      { title: '1 · The speed that will not change',
        body: 'Run the plain circle and watch the blue |v| trace in the first graph.',
        ask: 'The direction is changing constantly. Why is the speed not?',
        reveal: 'Because the magnetic force is always <b>perpendicular to v</b>, and a force perpendicular ' +
          'to the motion does <b>no work</b>. The trace is flat to five decimal places, and that is not a ' +
          'rounding artefact — the Boris pusher conserves |v| exactly under a pure B, so this is the ' +
          'integrator demonstrating the theorem rather than illustrating it.',
        params: { mode: 'helix', species: 'p', pitchDeg: 90, B: 0.12, Ey: 0 } },
      { title: '2 · Tilt the injector',
        body: 'Drag the injector, or take the pitch angle down from 90° to about 55°.',
        ask: 'The circle becomes a helix. Which component of v did the field change?',
        reveal: '<b>Neither.</b> v⊥ still goes round in a circle of the same radius and v∥ is completely ' +
          'untouched, because v × B has no component along B. The helix is just those two motions happening ' +
          'at once, and the pitch is v∥T — the distance the particle drifts in exactly one turn.',
        params: { mode: 'helix', species: 'p', pitchDeg: 55, B: 0.12, Ey: 0 } },
      { title: '3 · The selector picks one speed',
        body: 'Switch to the velocity selector. Three particles enter with different speeds.',
        ask: 'Only one goes straight through the slit. Why exactly that one?',
        reveal: 'The electric force qE is the same for all three, but the magnetic force qvB grows with ' +
          'speed. They balance only when <b>v = E/B</b>. Slower particles are pushed one way by the ' +
          'unopposed electric force, faster ones the other way by the magnetic force. Note the selected ' +
          'speed depends on <b>neither the charge nor the mass</b> — it is a pure speed filter.',
        params: { mode: 'selector', species: 'p', B: 0.12, v0: 1.2e6 } },
      { title: '4 · Now weigh them',
        body: 'Switch to the mass spectrometer. The same selector feeds a region of pure B.',
        ask: 'All three isotopes enter at the same speed. Why do they land in different places?',
        reveal: 'Because r = mv/qB, and with v and q now fixed the radius reads the <b>mass</b> directly. ' +
          'They land at 2r from the entry point, so the detector position is a mass measurement: ' +
          'm = qBr/v. This two-stage design — select the speed, then bend — is what makes the ' +
          'instrument work, and it is why the selector has to come first.',
        params: { mode: 'spectro', B: 0.12, v0: 1.2e6 } },
      { title: '5 · Let it go from rest',
        body: 'Switch to "released from rest" and watch the looping path.',
        ask: 'It starts at rest with a force on it. Why does it not simply accelerate along E?',
        reveal: 'It tries to — and the moment it moves, the magnetic force bends it. The result is a ' +
          '<b>cycloid</b>: the path of a point on a rolling wheel. Averaged over a loop the particle drifts ' +
          'sideways at exactly <b>E/B</b>, and that drift velocity contains <b>neither q nor m</b>. ' +
          'Every charged particle in the chamber, of any mass and either sign, drifts at the same rate — ' +
          'which is why it is called the E×B drift and not the proton drift.',
        params: { mode: 'cycloid', species: 'p', B: 0.12, Ey: 6e4 } }
    ],

    problems: [
      { source: 'JEE Main pattern · circular motion in B',
        q: 'A proton moves perpendicular to a magnetic field of 0.120 T at 1.20 × 10⁶ m/s. Find the radius of its circular path, in millimetres. (m_p = 1.673 × 10⁻²⁷ kg)',
        params: { mode: 'helix', species: 'p', pitchDeg: 90, B: 0.12, v0: 1.2e6, Ey: 0 },
        predict: { label: 'radius', unit: 'mm', tol: 0.02 },
        measure: S => S.rc * 1000,
        working: 'r = mv/qB = (1.673×10⁻²⁷ × 1.20×10⁶)/(1.602×10⁻¹⁹ × 0.120) = <b>104 mm</b>. ' +
          'Note what does NOT appear: the period. A common slip is to compute T first and then try to ' +
          'reach r through it — r needs the speed, T does not.' },
      { source: 'NEET pattern · velocity selector',
        q: 'A velocity selector uses a magnetic field of 0.120 T and an electric field of 1.44 × 10⁵ V/m. Find the speed it selects, in m/s.',
        params: { mode: 'selector', species: 'p', B: 0.12, Ey: 1.44e5 },
        predict: { label: 'selected speed', unit: 'm/s', tol: 0.02 },
        measure: S => S.vSel,
        working: 'qE = qvB gives v = E/B = 1.44×10⁵/0.120 = <b>1.20 × 10⁶ m/s</b>. The charge cancels ' +
          'completely, so the same selector passes protons, electrons and alpha particles alike, provided ' +
          'they travel at that one speed. It filters on <b>speed</b>, never on mass or charge.' },
      { source: 'JEE Advanced pattern · the period',
        q: 'A proton and an alpha particle enter the same magnetic field with the same speed. The proton takes time T to complete one revolution. How many T does the alpha particle take?',
        params: { mode: 'helix', species: 'alpha', pitchDeg: 90, B: 0.12, v0: 1.2e6 },
        predict: { label: 'period ratio T_alpha / T_proton', unit: '×', tol: 0.03 },
        measure: S => (4.0015 * MP / (2 * QE)) / (MP / QE),
        working: 'T = 2πm/qB, so the ratio is (m_α/m_p)(q_p/q_α) = 4 × (1/2) = <b>2.0</b>. ' +
          'The alpha is four times as heavy but carries twice the charge, so the two effects do not ' +
          'cancel — they leave a factor of two. The speed is irrelevant, which is the whole point of the ' +
          'formula and the reason the cyclotron works at all.' }
    ],

    quiz: [
      { q: 'A charged particle moves in a circle in a uniform magnetic field. The work done by the magnetic force in one complete revolution is:',
        options: ['qvB × 2πr', 'zero', 'depends on the radius', 'equal to the kinetic energy'], answer: 1,
        why: 'The magnetic force is perpendicular to the velocity at every instant, so F·dl = 0 everywhere along the path. It changes direction, never speed — which is why |v| in the graph above is flat to the last digit.' },
      { q: 'The time period of a charged particle in a uniform magnetic field is independent of:',
        options: ['its mass', 'its charge', 'the field strength', 'its speed and its radius'], answer: 3,
        why: 'T = 2πm/qB contains m, q and B but neither v nor r. A faster particle traces a proportionally bigger circle in the same time, which is exactly the isochronism the cyclotron depends on.' },
      { q: 'In a velocity selector with crossed E and B, the speed that passes undeviated is:',
        options: ['E/B', 'B/E', 'EB', '√(E/B)'], answer: 0,
        why: 'Balancing qE against qvB gives v = E/B. The charge cancels, so the selector filters purely on speed — it cannot distinguish a proton from an electron travelling at the same rate.' },
      { q: 'A particle is released from rest in crossed uniform E and B fields. Its average drift velocity is:',
        options: ['zero, since it starts at rest', 'E/B, independent of charge and mass',
                  'qE/mB', 'proportional to √(q/m)'], answer: 1,
        why: 'The path is a cycloid whose average is the E×B drift, of magnitude E/B. Neither the charge nor the mass appears, so every particle in the region drifts together — the loops differ in size, the drift does not.' }
    ],

    notes: '<b>Where this shows up in the paper.</b>' +
      '<ul><li>Ratio questions on r, T and f when B, v, q or m is scaled — nearly free marks once both formulae are secure.</li>' +
      '<li>Velocity selector combined with a spectrometer: v = E/B feeding r = mv/qB to give m/q.</li>' +
      '<li>Helical pitch problems, which turn entirely on v∥ being untouched by B.</li>' +
      '<li>Conceptual statements about the magnetic force and work — the flat |v| trace is the proof.</li></ul>' +
      '<div class="pyq"><em>Trap to avoid</em>The period is independent of speed <b>only while the particle ' +
      'is non-relativistic</b>. Watch the v/c readout: past about 0.1 the real mass grows, T lengthens, and a ' +
      'fixed-frequency machine falls out of step. That is exactly why the synchrocyclotron exists, and ' +
      'JEE Advanced has probed the idea qualitatively.</div>'
  });

  /* =========================================================================
     2 · YOUNG'S DOUBLE SLIT — interference + single-slit envelope
     ========================================================================= */
  /* Vacuum wavelength -> linear-light RGB, used both for the monochromatic
     stage and as the basis function for the white-light sum. */
  function wl2rgb(w) {
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
    const G = 0.85;
    return [Math.max(0, Math.pow(r * f, G)), Math.max(0, Math.pow(g * f, G)), Math.max(0, Math.pow(b * f, G))];
  }

  /* ---- the interference integral, written once and used everywhere ----
     Everything is referred to the wavelength INSIDE the medium, because that
     is the wavelength the geometry actually sees. Three separate effects can
     move a fringe, and the exam asks about all three:
       · the geometric path difference   d sinθ
       · a thin plate over one slit      (μ − n) t
       · unequal slit intensities        (kills the contrast, not the position)
     sinθ is computed exactly from y and D — no small-angle shortcut — so the
     lab stays honest when the student drags D down to 40 cm.               */
  function ydseAt(S, y, lamVac) {
    const p = S.p;
    const lv = lamVac == null ? S.lam : lamVac;
    const lm = lv / p.nMed;                       // wavelength in the medium
    const sth = y / Math.sqrt(y * y + p.D * p.D);
    const bq = Math.PI * S.a * sth / lm;
    const env = Math.abs(bq) < 1e-9 ? 1 : Math.pow(Math.sin(bq) / bq, 2);
    if (p.mode === 'single') return { I: env, env: env, fringe: 1, delta: 0 };
    // half the phase difference: geometry minus the plate's extra optical path
    const dq = Math.PI * (S.d * sth / lm - S.pathX / lv);
    const r = S.ratio;                            // I2 / I1
    const num = 1 + r + 2 * Math.sqrt(r) * Math.cos(2 * dq);
    const fr = num / Math.pow(1 + Math.sqrt(r), 2);
    return { I: env * fr, env: env, fringe: fr, delta: 2 * dq };
  }

  /* White light is the same integral summed over the visible band. The result
     is a colour, not a number — which is exactly why the white-light fringe
     pattern looks the way it does. */
  const WHITE_LAMS = [];
  for (let w = 400; w <= 700; w += 10) WHITE_LAMS.push(w);
  function ydseRGB(S, y) {
    if (!S.p.white) {
      const I = Math.pow(ydseAt(S, y).I, 0.75);
      return [S.rgb[0] * I, S.rgb[1] * I, S.rgb[2] * I];
    }
    let R = 0, G = 0, B = 0, n = 0;
    for (let k = 0; k < WHITE_LAMS.length; k++) {
      const w = WHITE_LAMS[k], c = wl2rgb(w);
      const I = ydseAt(S, y, w * 1e-9).I;
      R += c[0] * I; G += c[1] * I; B += c[2] * I;
      n += (c[0] + c[1] + c[2]) / 3;
    }
    const k = 1 / Math.max(n, 1e-9);
    return [Math.pow(R * k, 0.75), Math.pow(G * k, 0.75), Math.pow(B * k, 0.75)];
  }
  /* =========================================================================
     YOUNG'S DOUBLE SLIT — a real optical bench
     The rail, the lamp, the collimator, the slit plate and the screen are all
     solid objects you can walk around. The pattern painted on the screen is
     the intensity integral evaluated column by column, in the true colour of
     the light, and every quantity in the panels is read back out of it.
     ========================================================================= */
  L.register({
    id: 'ydse', subject: 'physics',
    name: "Young's Double Slit — Path Difference to Fringe",
    chapter: 'Wave Optics',
    exams: ['JEE Main', 'JEE Advanced', 'NEET UG'],
    weight: 'Very high yield',
    is3D: true,
    stageHint: 'Drag to walk round the bench · drag the screen along the rail · drag P across the pattern · drag a slit to change d',
    lede: 'Two coherent slits, one screen, and a single controlling quantity: the <b>path difference Δ = d sin θ</b>. ' +
      'The bench is real: the pattern on the screen is the intensity integral evaluated column by column in the true ' +
      'colour of the light. Beyond the textbook case you can <b>cover one slit with a thin plate</b> and watch the ' +
      'whole pattern march sideways, <b>immerse the apparatus</b> so λ becomes λ/μ, <b>unbalance the two slits</b> ' +
      'until the dark fringes stop being dark, and switch to <b>white light</b> to see why only the central fringe is white.',

    params: { lam: 589, d: 0.25, a: 0.08, D: 1.2, mode: 'double', envelope: true, sweep: true,
              yP: 0, nMed: 1.0, plate: false, t: 3.6, mu: 1.50, ratio: 1.0, white: false },

    presets: [
      { name: 'Sodium lamp 589 nm', params: { lam: 589, d: 0.25, a: 0.08, D: 1.2, mode: 'double', nMed: 1, plate: false, ratio: 1, white: false } },
      { name: 'He–Ne laser 633 nm', params: { lam: 633, d: 0.25, a: 0.08, D: 1.5, mode: 'double', nMed: 1, plate: false, ratio: 1, white: false } },
      { name: 'Missing orders (d = 3a)', params: { lam: 589, d: 0.24, a: 0.08, D: 1.2, mode: 'double', envelope: true, nMed: 1, plate: false, ratio: 1, white: false } },
      { name: 'Mica over one slit', params: { lam: 600, d: 0.25, a: 0.08, D: 1.2, mode: 'double', plate: true, t: 3.6, mu: 1.5, nMed: 1, ratio: 1, white: false } },
      { name: 'Immersed in water', params: { lam: 589, d: 0.25, a: 0.08, D: 1.2, mode: 'double', nMed: 1.33, plate: false, ratio: 1, white: false } },
      { name: 'White light', params: { white: true, lam: 550, d: 0.25, a: 0.10, D: 1.2, mode: 'double', nMed: 1, plate: false, ratio: 1 } },
      { name: 'One slit half-blocked', params: { lam: 589, d: 0.25, a: 0.08, D: 1.2, mode: 'double', ratio: 0.25, nMed: 1, plate: false, white: false } },
      { name: 'Single slit only', params: { mode: 'single', a: 0.08, D: 1.2, lam: 589, nMed: 1, plate: false, ratio: 1, white: false } }
    ],

    controls: [
      { group: 'Source', items: [
        { key: 'lam', label: 'Wavelength <i>λ</i>', min: 380, max: 720, step: 1, unit: 'nm', fmt: v => v.toFixed(0) },
        { key: 'white', type: 'toggle', label: 'White light instead' }
      ] },
      { group: 'Apparatus', items: [
        { key: 'mode', type: 'select', label: 'Aperture', options: [
          { value: 'double', label: 'Double slit' }, { value: 'single', label: 'Single slit' }] },
        { key: 'd', label: 'Slit separation <i>d</i>', min: 0.06, max: 0.8, step: 0.005, unit: 'mm', fmt: v => v.toFixed(3) },
        { key: 'a', label: 'Slit width <i>a</i>', min: 0.02, max: 0.30, step: 0.002, unit: 'mm', fmt: v => v.toFixed(3) },
        { key: 'D', label: 'Screen distance <i>D</i>', min: 0.4, max: 3.0, step: 0.02, unit: 'm', fmt: v => v.toFixed(2) },
        { key: 'ratio', label: 'Slit intensity ratio <i>I</i>₂/<i>I</i>₁', min: 0.02, max: 1.0, step: 0.01,
          unit: '', fmt: v => v.toFixed(2) }
      ] },
      { group: 'Thin plate over slit 1', items: [
        { key: 'plate', type: 'toggle', label: 'Insert the plate' },
        { key: 't', label: 'Thickness <i>t</i>', min: 0.2, max: 12, step: 0.1, unit: 'µm', fmt: v => v.toFixed(1) },
        { key: 'mu', label: 'Refractive index <i>μ</i>', min: 1.2, max: 2.4, step: 0.01, unit: '', fmt: v => v.toFixed(2) }
      ] },
      { group: 'Medium', items: [
        { key: 'nMed', label: 'Index of the medium <i>n</i>', min: 1.0, max: 1.8, step: 0.005, unit: '',
          fmt: v => v.toFixed(3) }
      ] },
      { group: 'Display', items: [
        { key: 'envelope', type: 'toggle', label: 'Show diffraction envelope' },
        { key: 'sweep', type: 'toggle', label: 'Sweep the point P' }
      ] }
    ],

    setup(S) {
      const p = S.p;
      if (p.a >= p.d) p.a = Math.max(0.02, p.d * 0.4);
      S.lam = p.lam * 1e-9;                         // vacuum wavelength
      S.lamM = S.lam / p.nMed;                      // wavelength in the medium
      S.d = p.d * 1e-3; S.a = p.a * 1e-3;
      S.ratio = clamp(p.ratio, 0.02, 1);
      // a plate of index μ, thickness t, replacing t of the medium
      S.pathX = p.plate && p.mode === 'double' ? (p.mu - p.nMed) * p.t * 1e-6 : 0;
      S.shift = S.pathX * p.D / (p.nMed * S.d);     // how far the pattern moves (m)
      S.nShift = S.pathX / S.lam;                   // ... in whole fringes
      S.beta = S.lamM * p.D / S.d;                  // fringe width (m)
      S.env1 = S.lamM * p.D / S.a;                  // first envelope minimum (m)
      const base = p.mode === 'single'
        ? Math.max(2.6 * S.env1, 4e-3)
        : Math.max(5 * S.beta, 1.5 * S.env1);
      S.yRange = base + Math.abs(S.shift);
      S.rgb = p.white ? [1, 1, 1] : wl2rgb(p.lam);
      S.vis = 2 * Math.sqrt(S.ratio) / (1 + S.ratio);   // fringe visibility
      S.XS = 1.30 + 0.90 * clamp((p.D - 0.4) / 2.6, 0, 1);
      S.dDraw = 0.07 + 0.27 * clamp((p.d - 0.06) / 0.74, 0, 1);
      S.aDraw = Math.min(0.022 + 0.078 * clamp((p.a - 0.02) / 0.28, 0, 1), S.dDraw * 0.62);
      S.phase = S.phase || 0;
      if (!S.cam) {
        S.cam = Camera({ theta: -2.08, phi: 0.32, dist: 3.95, target: [0.30, 0, -0.10] });
        S.cam.minDist = 2.0; S.cam.maxDist = 14;
      }
    },

    step(S, dt) {
      if (S.p.sweep) {
        S.phase += dt * 0.22;
        S.p.yP = Math.sin(S.phase * TAU) * S.yRange * 0.84;
      }
      S.p.yP = clamp(S.p.yP, -S.yRange, S.yRange);
    },

    drawStage(S, g) {
      const ctx = g.ctx, th = g.theme, p = S.p, W = g.w, H = g.h;
      const cam = S.cam, F = R3.Frame(ctx, cam, { ambient: 0.26, floorZ: null });
      /* DEPTH POLICY for this bench. Only the rail and its posts carry
         F.GROUND, because they are the one surface other things stand on.
         Every component — lamp, collimator, slit plate, screen — sorts on its
         OWN depth, so orbiting the bench past the screen does not leave the
         slit plate painted on top of it. Anything that decorates a component
         (a glow, a slit's light, the screen's own ruler) gets an offset of a
         few hundredths at most: enough to sit on its parent, never enough to
         jump in front of a component that is genuinely nearer. Only text
         keeps the large negative bias R3.label applies for it. */
      const rgb = S.rgb;
      const col = (i, a) => 'rgba(' + Math.round(255 * clamp(rgb[0] * i, 0, 1)) + ',' +
        Math.round(255 * clamp(rgb[1] * i, 0, 1)) + ',' + Math.round(255 * clamp(rgb[2] * i, 0, 1)) +
        ',' + (a == null ? 1 : a) + ')';
      const pure = col(1);

      const XS = S.XS, SY = 0.98, SZ = 0.60;        // screen half-width, half-height
      const XSLIT = 0, XCOL = -0.92, XSRC = -1.62;  // slit plate, collimator, lamp
      const dD = S.dDraw, aD = S.aDraw, PLZ = 0.55; // plate half-height
      const yOf = (yMetres) => yMetres / S.yRange * SY;
      const s1y = p.mode === 'single' ? 0 : dD / 2, s2y = p.mode === 'single' ? 0 : -dD / 2;

      const O = cam.project([0.4, 0, 0]);
      const away = (pt) => { const q = cam.project(pt); return (q.ok && O.ok && q.x < O.x) ? -1 : 1; };

      /* ---------------- the optical rail and its posts ---------------- */
      {
        const x0 = XSRC - 0.28, x1 = XS + 0.30;
        R3.box(F, [(x0 + x1) / 2, 0, -0.80], [x1 - x0, 0.34, 0.075], '#222C44',
               { shadow: false, ambient: 0.15, bias: F.GROUND });
        // the graduated edge — an optical rail always carries one
        for (let i = 0; i <= 26; i++) {
          const xx = x0 + (x1 - x0) * i / 26, tall = i % 5 === 0;
          R3.polyline(F, [[xx, 0.17, -0.7625], [xx, 0.17, -0.7625 + (tall ? 0.030 : 0.017)]],
                      '#6E80A8', { alpha: tall ? 0.8 : 0.45, width: 1, bias: F.GROUND });
        }
        [[XSRC, 0.30], [XCOL, 0.30], [XSLIT, 0.30], [XS, 0.30]].forEach(([xx, r]) => {
          R3.cylinder(F, [xx, 0, -0.7625], [xx, 0, -PLZ - 0.02], 0.034, '#55658C',
                      { segments: 14, shadow: false, ambient: 0.30, bias: F.GROUND });
          R3.cylinder(F, [xx, 0, -0.7625], [xx, 0, -0.720], 0.075, '#3B496B',
                      { segments: 18, shadow: false, ambient: 0.26, bias: F.GROUND });
        });
      }

      /* ---------------- the lamp ---------------- */
      {
        R3.box(F, [XSRC - 0.13, 0, 0], [0.30, 0.38, 0.40], '#333F5C',
               { shadow: false, ambient: 0.30 });
        R3.cylinder(F, [XSRC + 0.02, 0, 0], [XSRC + 0.07, 0, 0], 0.075, '#20293F',
                    { segments: 20, shadow: false, ambient: 0.24 });
        R3.sphere(F, [XSRC + 0.075, 0, 0], 0.036, pure, { shadow: false, rim: 0.95 });
        const q = cam.project([XSRC + 0.075, 0, 0]);
        if (q.ok) F.push([XSRC + 0.075, 0, 0], () => {
          ctx.save(); ctx.globalCompositeOperation = 'lighter';
          const gg = ctx.createRadialGradient(q.x, q.y, 0, q.x, q.y, 22);
          gg.addColorStop(0, col(1, .48)); gg.addColorStop(1, col(1, 0));
          ctx.fillStyle = gg; ctx.beginPath(); ctx.arc(q.x, q.y, 22, 0, TAU); ctx.fill();
          ctx.restore();
        }, -0.03);
        R3.callout(F, [XSRC - 0.13, 0, 0.21], away([XSRC, 0, 0]) * 30, -22,
                   p.white ? 'white-light source' : 'source  λ = ' + p.lam + ' nm',
                   p.white ? '#E8EEF9' : pure);
      }

      /* ---------------- the collimating slit ----------------
         The textbook always draws it and never explains it: without this one
         narrow slit the two slits downstream are not coherent and there is no
         pattern at all. */
      {
        const panel = (y0, y1) => R3.box(F, [XCOL, (y0 + y1) / 2, 0],
          [0.022, Math.abs(y1 - y0), 2 * PLZ], '#46557C', { shadow: false, ambient: 0.34 });
        panel(0.019, 0.52); panel(-0.52, -0.019);
        R3.box(F, [XCOL, 0.545, 0], [0.030, 0.06, 2 * PLZ + 0.05], '#33405E', { shadow: false, ambient: 0.28 });
        R3.box(F, [XCOL, -0.545, 0], [0.030, 0.06, 2 * PLZ + 0.05], '#33405E', { shadow: false, ambient: 0.28 });
        R3.callout(F, [XCOL, 0, PLZ + 0.02], away([XCOL, 0, 0]) * 30, -34,
                   'collimating slit · makes S₁ and S₂ coherent', th['text-3']);
      }

      /* ---------------- the slit plate ----------------
         The plate and the light coming through it are ONE item. They have to
         be: the plate is a large flat face and the slits are small marks on
         it, which is exactly the case a single depth key cannot sort (memory
         §2.12). Drawing them together — the face filled even-odd so the slits
         are genuinely holes, then the light painted into those holes — makes
         the pair atomic, so the plate still sorts correctly against the
         screen and the collimator while never painting over its own slits. */
      {
        const cP = '#4E5E88', HALF = 0.58;
        const slitY = p.mode === 'single' ? [[0, 1]]
                                          : [[s1y, 1], [s2y, S.ratio]];
        F.push([XSLIT, 0, 0], () => {
          const face = [[XSLIT, -HALF, PLZ], [XSLIT, HALF, PLZ],
                        [XSLIT, HALF, -PLZ], [XSLIT, -HALF, -PLZ]].map(v => cam.project(v));
          if (face.some(q => !q.ok)) return;
          // each slit as a rectangular hole
          const holes = slitY.map(([yy]) =>
            [[XSLIT, yy - aD / 2, PLZ], [XSLIT, yy + aD / 2, PLZ],
             [XSLIT, yy + aD / 2, -PLZ], [XSLIT, yy - aD / 2, -PLZ]].map(v => cam.project(v)));
          if (holes.some(h => h.some(q => !q.ok))) return;
          ctx.save();
          ctx.beginPath();
          face.forEach((q, i) => i ? ctx.lineTo(q.x, q.y) : ctx.moveTo(q.x, q.y));
          ctx.closePath();
          holes.forEach(h => {
            ctx.moveTo(h[0].x, h[0].y);
            for (let i = 1; i < h.length; i++) ctx.lineTo(h[i].x, h[i].y);
            ctx.closePath();
          });
          ctx.fillStyle = F.shade(cP, [-1, 0, 0], { ambient: 0.36 });
          ctx.fill('evenodd');
          ctx.strokeStyle = g.alpha('#9FB4DE', .40); ctx.lineWidth = 1.1;
          ctx.beginPath();
          face.forEach((q, i) => i ? ctx.lineTo(q.x, q.y) : ctx.moveTo(q.x, q.y));
          ctx.closePath(); ctx.stroke();
          // the light the slits pass, painted into the holes
          ctx.globalCompositeOperation = 'lighter';
          holes.forEach((h, i) => {
            ctx.fillStyle = col(0.85 * slitY[i][1], .88);
            ctx.beginPath();
            h.forEach((q, k) => k ? ctx.lineTo(q.x, q.y) : ctx.moveTo(q.x, q.y));
            ctx.closePath(); ctx.fill();
          });
          ctx.restore();
        }, 0);

        // the frame, so the plate reads as a mounted component
        R3.box(F, [XSLIT, HALF + 0.025, 0], [0.034, 0.05, 2 * PLZ + 0.06], '#364263',
               { shadow: false, ambient: 0.28 });
        R3.box(F, [XSLIT, -HALF - 0.025, 0], [0.034, 0.05, 2 * PLZ + 0.06], '#364263',
               { shadow: false, ambient: 0.28 });
        R3.box(F, [XSLIT, 0, PLZ + 0.025], [0.034, 2 * HALF + 0.10, 0.05], '#364263',
               { shadow: false, ambient: 0.28 });
        R3.box(F, [XSLIT, 0, -PLZ - 0.025], [0.034, 2 * HALF + 0.10, 0.05], '#364263',
               { shadow: false, ambient: 0.28 });

        slitY.forEach(([yy, strength], i) => {
          R3.label(F, [XSLIT, yy, PLZ + 0.10],
                   p.mode === 'single' ? 'S' : (i === 0 ? 'S₁' : 'S₂'),
                   col(0.55 + 0.45 * strength),
                   { size: 11, dx: p.mode === 'single' ? 0 : (i === 0 ? -11 : 11) });
        });

        // the thin plate, sitting over S1
        if (S.pathX !== 0) {
          R3.box(F, [XSLIT - 0.085, s1y, 0], [0.05, Math.max(dD * 0.9, 0.14), 2 * PLZ * 0.8],
                 '#8FE6D2', { shadow: false, ambient: 0.62 });
          R3.callout(F, [XSLIT - 0.085, s1y, PLZ * 0.8], away([0, 0.4, 0]) * 30, -30,
                     'plate  μ = ' + p.mu.toFixed(2) + ' · t = ' + p.t.toFixed(1) + ' µm', '#8FE6D2');
        }
      }

      /* ---------------- the beams leaving the slits ----------------
         Faint cones, so the student can see that each slit floods the whole
         screen — the overlap region is where interference lives. */
      {
        const slits = p.mode === 'single' ? [[0, 1]] : [[s1y, 1], [s2y, S.ratio]];
        slits.forEach(([yy, strength]) => {
          for (let i = -3; i <= 3; i++) {
            const yEnd = i / 3 * SY * 0.96;
            R3.polyline(F, [[XSLIT + 0.02, yy, 0], [XS - 0.02, yEnd, 0]], pure,
                        { alpha: 0.05 + 0.05 * strength, width: 1 });
          }
        });
      }

      /* ---------------- the screen, painted with the real pattern ---------------- */
      const yPd = yOf(p.yP);
      {
        const N = 236;
        F.push([XS, 0, 0], () => {
          let prevT = cam.project([XS, -SY, SZ]), prevB = cam.project([XS, -SY, -SZ]);
          for (let i = 1; i <= N; i++) {
            const yw = (i / N * 2 - 1) * SY;
            const T = cam.project([XS, yw, SZ]), B = cam.project([XS, yw, -SZ]);
            if (prevT.ok && prevB.ok && T.ok && B.ok) {
              const yr = ((i - 0.5) / N * 2 - 1) * S.yRange;
              const c = ydseRGB(S, yr);
              ctx.fillStyle = 'rgb(' + Math.round(255 * clamp(c[0], 0, 1)) + ',' +
                Math.round(255 * clamp(c[1], 0, 1)) + ',' + Math.round(255 * clamp(c[2], 0, 1)) + ')';
              ctx.beginPath();
              ctx.moveTo(prevT.x, prevT.y); ctx.lineTo(T.x, T.y);
              ctx.lineTo(B.x, B.y); ctx.lineTo(prevB.x, prevB.y);
              ctx.closePath(); ctx.fill();
            }
            prevT = T; prevB = B;
          }
          // the frame round the screen
          const c4 = [[XS, -SY, SZ], [XS, SY, SZ], [XS, SY, -SZ], [XS, -SY, -SZ]].map(v => cam.project(v));
          if (c4.every(q => q.ok)) {
            ctx.strokeStyle = g.alpha('#8FA4CE', .55); ctx.lineWidth = 1.4;
            ctx.beginPath();
            c4.forEach((q, i) => i ? ctx.lineTo(q.x, q.y) : ctx.moveTo(q.x, q.y));
            ctx.closePath(); ctx.stroke();
          }
        }, 0);
        // the screen's own mount
        R3.box(F, [XS + 0.045, 0, 0], [0.05, 2 * SY + 0.10, 2 * SZ + 0.10], '#2E3A57',
               { shadow: false, ambient: 0.20 });

        // a millimetre scale along the bottom edge
        const step = S.yRange * 1000 > 24 ? 5 : S.yRange * 1000 > 10 ? 2 : 1;
        for (let t = -Math.floor(S.yRange * 1000 / step) * step; t <= S.yRange * 1000 + 1e-6; t += step) {
          const yw = yOf(t / 1000);
          R3.polyline(F, [[XS, yw, SZ], [XS, yw, SZ + 0.055]], '#8FA4CE',
                      { alpha: .7, width: 1, bias: -0.02 });
          if (Math.abs(t / step) % 4 < 0.01)
            R3.label(F, [XS, yw, SZ + 0.115], t.toFixed(0), th['text-3'], { size: 8.5 });
        }
        R3.label(F, [XS, 0, SZ + 0.26], 'screen · y in mm', th['text-2'], { size: 9.5 });
      }

      /* ---------------- the two rays that meet at P ---------------- */
      {
        const P3 = [XS - 0.004, yPd, 0];
        const slits = p.mode === 'single' ? [[0, 1]] : [[s1y, 1], [s2y, S.ratio]];
        slits.forEach(([yy, strength]) => {
          R3.polyline(F, [[XSLIT + 0.02, yy, 0], P3], pure,
                      { alpha: 0.30 + 0.45 * strength, width: 1.8, bias: -0.05 });
        });
        // the little right-angled triangle at the slits whose short side is Δ
        if (p.mode === 'double') {
          const sth = p.yP / Math.sqrt(p.yP * p.yP + p.D * p.D);
          const ux = p.D / Math.sqrt(p.yP * p.yP + p.D * p.D);   // along the ray
          // foot of the perpendicular dropped from S2 onto the S1 ray
          const fx = XSLIT + 0.02 + (dD * sth) * ux, fy = s2y + (dD * sth) * sth;
          R3.polyline(F, [[XSLIT + 0.02, s1y, 0], [XSLIT + 0.02, s2y, 0]], th.warn,
                      { alpha: .85, width: 2, bias: -0.06 });
          R3.polyline(F, [[XSLIT + 0.02, s1y, 0], [fx, fy, 0]], th.warn,
                      { alpha: .9, width: 2.4, bias: -0.06 });
        }
        // the marker itself
        const q = cam.project(P3);
        if (q.ok) {
          const on = g.dragging === 'pmark';
          F.push(P3, () => {
            ctx.save();
            ctx.strokeStyle = on ? th.text : g.alpha(th.text, .85);
            ctx.lineWidth = on ? 2.4 : 1.7;
            ctx.beginPath(); ctx.arc(q.x, q.y, 8, 0, TAU); ctx.stroke();
            ctx.beginPath(); ctx.moveTo(q.x - 13, q.y); ctx.lineTo(q.x - 5, q.y);
            ctx.moveTo(q.x + 5, q.y); ctx.lineTo(q.x + 13, q.y); ctx.stroke();
            ctx.restore();
          }, -1e5 - 10);
          g.handle(q.x, q.y, 15, 'pmark');
          R3.label(F, P3, 'P', th.text, { size: 11, dy: -18 });
        }
      }

      F.render();

      /* ---------------- screen-space handles ----------------
         Two more grab points: the screen slides along the rail (that is D),
         and the upper slit slides across the plate (that is d).            */
      const axis = (a, b, metresPerUnit) => {
        const qa = cam.project(a), qb = cam.project(b);
        if (!qa.ok || !qb.ok) return null;
        const dx = qb.x - qa.x, dy = qb.y - qa.y, L = Math.hypot(dx, dy) || 1;
        return { ux: dx / L, uy: dy / L, perPx: metresPerUnit / L };
      };
      S._axY = axis([XS, -SY, 0], [XS, SY, 0], 2 * S.yRange);
      // the drawn separation is a compressed map of the real d, so the handle
      // is measured in DRAWN units and the map inverted in onDrag
      S._axD = axis([XSLIT, 0, 0], [XSLIT, 0.5, 0], 0.5);
      S._axX = axis([XSRC, 0, -0.80], [XS, 0, -0.80], XS - XSRC);
      {
        const qs = cam.project([XS, 0, -0.80]);
        if (qs.ok) {
          const on = g.dragging === 'scrn';
          ctx.save();
          ctx.strokeStyle = on ? th.text : g.alpha(th.phys, .75);
          ctx.lineWidth = on ? 2.2 : 1.6;
          ctx.beginPath(); ctx.arc(qs.x, qs.y, 7, 0, TAU); ctx.stroke();
          ctx.beginPath(); ctx.moveTo(qs.x - 16, qs.y); ctx.lineTo(qs.x - 10, qs.y);
          ctx.moveTo(qs.x + 10, qs.y); ctx.lineTo(qs.x + 16, qs.y); ctx.stroke();
          ctx.restore();
          PA.lbl(ctx, qs.x, qs.y + 19, 'D = ' + p.D.toFixed(2) + ' m · drag the screen along the rail',
                 on ? th.text : g.alpha(th['text-3'], .9), 'center', 9);
          g.handle(qs.x, qs.y, 16, 'scrn');
        }
      }
      if (p.mode === 'double') {
        const qd = cam.project([XSLIT, dD / 2, PLZ + 0.16]);
        if (qd.ok) {
          const on = g.dragging === 'slit';
          ctx.save();
          ctx.strokeStyle = on ? th.text : g.alpha(th.warn, .8);
          ctx.lineWidth = on ? 2.2 : 1.6;
          ctx.beginPath(); ctx.arc(qd.x, qd.y, 6.5, 0, TAU); ctx.stroke();
          ctx.restore();
          PA.lbl(ctx, qd.x, qd.y - 12, 'd = ' + p.d.toFixed(3) + ' mm · drag',
                 on ? th.text : g.alpha(th['text-3'], .9), 'center', 9);
          g.handle(qd.x, qd.y, 15, 'slit');
        }
      }

      /* ---------------- instrument panel 1 · the path-difference audit ----------------
         This is the whole examinable chain in five rows: the geometry gives a
         length, the wavelength turns it into a count, the plate shifts the
         count, and the fractional part of the count decides what you see. */
      const sth = p.yP / Math.sqrt(p.yP * p.yP + p.D * p.D);
      const nGeo = S.d * sth / S.lamM;
      const nPlate = S.pathX / S.lam;
      const nNet = nGeo - nPlate;
      const res = ydseAt(S, p.yP);
      {
        const narrow = W < 660;
        const bw = narrow ? Math.min(W - 24, 288) : Math.min(W * 0.34, 288);
        const bh = p.mode === 'double' ? 116 : 74;
        const bx = 12, by = H - bh - 26;
        S._panelTop = by;
        ctx.fillStyle = g.alpha('#0B1020', .90);
        ctx.strokeStyle = g.alpha(th.line, 1); ctx.lineWidth = 1;
        ctx.beginPath(); ctx.roundRect(bx, by, bw, bh, 8); ctx.fill(); ctx.stroke();
        PA.lbl(ctx, bx + 10, by + 13, 'PATH DIFFERENCE AT P', th['text-3'], 'left', 8.5);
        const row = (i, k, v, c) => {
          PA.lbl(ctx, bx + 10, by + 30 + i * 15, k, th['text-3'], 'left', 9);
          PA.lbl(ctx, bx + bw - 10, by + 30 + i * 15, v, c || th['text-2'], 'right', 9.5);
        };
        if (p.mode === 'double') {
          row(0, 'geometry   d sin θ', (S.d * sth * 1e9).toFixed(0) + ' nm');
          row(1, p.white ? '÷ λ (at 550 nm)' : '÷ λ in the medium', nGeo.toFixed(3) + ' λ', th.phys);
          row(2, 'thin plate  (μ−n)t/λ', (nPlate === 0 ? '—' : '−' + nPlate.toFixed(3) + ' λ'),
              nPlate === 0 ? th['text-3'] : '#8FE6D2');
          const frac = Math.abs(nNet - Math.round(nNet));
          const bright = frac < 0.25, dark = Math.abs(frac - 0.5) < 0.25;
          row(3, 'net order  Δ/λ', nNet.toFixed(3) + ' λ', th.text);
          row(4, 'so P is', bright ? 'BRIGHT · near order ' + Math.round(nNet)
                                   : dark ? 'DARK · half-integer' : 'part-way between',
              bright ? th.ok : dark ? th.crit : th['text-2']);
        } else {
          row(0, 'a sin θ ÷ λ', (S.a * sth / S.lamM).toFixed(3) + ' λ', th.phys);
          row(1, 'I / I₀', res.I.toFixed(4), th.text);
        }
      }

      /* ---------------- instrument panel 2 · the phasor sum ----------------
         Amplitudes add, intensities do not. Two equal phasors at δ = 0 give a
         resultant of 2A and therefore 4I₀, which is the single most-missed
         mark in the chapter. */
      if (p.mode === 'double') {
        const narrow = W < 660;
        const bw = narrow ? Math.min(W - 24, 200) : 174, bh = 136;
        const bx = narrow ? 12 : W - bw - 14;
        const by = narrow ? Math.max(58, (S._panelTop || (H - 142)) - bh - 8) : H - bh - 26;
        ctx.fillStyle = g.alpha('#0B1020', .90);
        ctx.strokeStyle = g.alpha(th.line, 1); ctx.lineWidth = 1;
        ctx.beginPath(); ctx.roundRect(bx, by, bw, bh, 8); ctx.fill(); ctx.stroke();
        PA.lbl(ctx, bx + 10, by + 13, 'PHASORS AT P', th['text-3'], 'left', 8.5);
        const cx = bx + bw / 2 - 18, cy = by + bh / 2 + 2, R = 34;
        const a1 = 1, a2 = Math.sqrt(S.ratio), del = res.delta;
        const e1 = [cx + R * a1, cy];
        const e2 = [e1[0] + R * a2 * Math.cos(-del), e1[1] + R * a2 * Math.sin(-del)];
        ctx.save();
        ctx.strokeStyle = g.alpha(th['text-3'], .22); ctx.lineWidth = 1;
        ctx.beginPath(); ctx.arc(cx, cy, R * (a1 + a2), 0, TAU); ctx.stroke();
        // the angle between the two phasors IS the phase difference
        ctx.strokeStyle = g.alpha(th.warn, .7); ctx.lineWidth = 1.4;
        ctx.beginPath();
        ctx.arc(e1[0], e1[1], 15, 0, -del, del > 0);
        ctx.stroke();
        const ray = (x0, y0, x1, y1, c, w) => {
          ctx.strokeStyle = c; ctx.lineWidth = w;
          ctx.beginPath(); ctx.moveTo(x0, y0); ctx.lineTo(x1, y1); ctx.stroke();
          const an = Math.atan2(y1 - y0, x1 - x0);
          ctx.beginPath(); ctx.moveTo(x1, y1);
          ctx.lineTo(x1 - 6 * Math.cos(an - 0.4), y1 - 6 * Math.sin(an - 0.4));
          ctx.lineTo(x1 - 6 * Math.cos(an + 0.4), y1 - 6 * Math.sin(an + 0.4));
          ctx.closePath(); ctx.fillStyle = c; ctx.fill();
        };
        ray(cx, cy, e1[0], e1[1], g.alpha(pure, .95), 2.2);
        ray(e1[0], e1[1], e2[0], e2[1], g.alpha(pure, .60), 2.2);
        ray(cx, cy, e2[0], e2[1], th.text, 2.6);
        ctx.restore();
        const amp = Math.hypot(e2[0] - cx, e2[1] - cy) / R;
        PA.lbl(ctx, bx + 10, by + bh - 24,
               'δ = ' + (del / Math.PI).toFixed(2) + 'π', th['text-2'], 'left', 9);
        PA.lbl(ctx, bx + bw - 10, by + bh - 24,
               'A = ' + amp.toFixed(2) + ' A₁', th.text, 'right', 9);
        PA.lbl(ctx, bx + 10, by + bh - 10,
               'V = ' + S.vis.toFixed(3), S.vis > 0.98 ? th.ok : th.warn, 'left', 9);
        PA.lbl(ctx, bx + bw - 10, by + bh - 10,
               'I/I₀ = ' + res.I.toFixed(3), th.phys, 'right', 9);
      }

      /* ---------------- header ---------------- */
      ctx.textAlign = 'left'; ctx.textBaseline = 'top';
      ctx.font = '700 19px "IBM Plex Sans Condensed",sans-serif';
      ctx.fillStyle = th.text;
      ctx.fillText(p.mode === 'single' ? 'SINGLE SLIT — diffraction only'
        : p.white ? 'WHITE LIGHT — only the central fringe is white'
        : 'β = ' + (S.beta * 1000).toFixed(3) + ' mm', 14, 8);
      ctx.font = '500 10px "IBM Plex Mono",monospace'; ctx.fillStyle = th['text-3'];
      ctx.fillText('λ = ' + p.lam + ' nm' +
        (p.nMed > 1.0005 ? '  ·  λ/n = ' + (S.lamM * 1e9).toFixed(1) + ' nm in the medium' : '') +
        '   ·   d = ' + p.d.toFixed(3) + ' mm   ·   a = ' + p.a.toFixed(3) + ' mm   ·   D = ' +
        p.D.toFixed(2) + ' m', 14, 31);
      if (S.pathX !== 0) {
        ctx.fillStyle = '#8FE6D2';
        ctx.fillText('plate over S₁ shifts the whole pattern by ' + S.nShift.toFixed(2) +
          ' fringes = ' + (S.shift * 1000).toFixed(2) + ' mm toward S₁', 14, 45);
      } else if (S.ratio < 0.99) {
        ctx.fillStyle = th.warn;
        ctx.fillText('slits unequal: the minima no longer reach zero — visibility ' +
          S.vis.toFixed(3), 14, 45);
      } else if (p.nMed > 1.0005) {
        ctx.fillStyle = th.phys;
        ctx.fillText('immersed: λ → λ/n, so every fringe narrows by the factor n = ' +
          p.nMed.toFixed(3), 14, 45);
      }
    },

    /* The three things worth grabbing: where P sits, how far the screen is,
       and how far apart the slits are. */
    onDrag(S, e) {
      const p = S.p;
      if (e.id === 'pmark' && S._axY) {
        p.sweep = false;
        const along = e.dx * S._axY.ux + e.dy * S._axY.uy;
        p.yP = clamp(p.yP + along * S._axY.perPx, -S.yRange, S.yRange);
      } else if (e.id === 'scrn' && S._axX) {
        /* The screen slides along the rail; XS = 1.30 + 0.90·(D−0.4)/2.6.
           The drawn rail is deliberately compressed — D ranges over 2.6 m in
           0.90 display units, about 100 px — so a 1:1 pixel map would send the
           screen from one end to the other in a flick. GAIN stretches the
           gesture to roughly a third of the stage for the full range. */
        const GAIN = 0.30;
        const along = e.dx * S._axX.ux + e.dy * S._axX.uy;
        p.D = clamp(p.D + along * S._axX.perPx * (2.6 / 0.90) * GAIN, 0.4, 3.0);
        this.setup(S);
      } else if (e.id === 'slit' && S._axD) {
        // dDraw = 0.07 + 0.27·(d−0.06)/0.74, and the handle rides at dDraw/2
        const along = e.dx * S._axD.ux + e.dy * S._axD.uy;
        const dDrawNew = S.dDraw + 2 * along * S._axD.perPx * 0.06;   // same reason: dDraw spans only 0.27 units
        p.d = clamp(0.06 + 0.74 * (dDrawNew - 0.07) / 0.27, 0.06, 0.8);
        if (p.a >= p.d) p.a = Math.max(0.02, p.d * 0.4);
        this.setup(S);
      }
    },

    plots: [
      { title: 'Intensity along the screen',
        legend: [{ c: '#3DD6F5', label: 'I / I₀ (observed)' }, { c: '#63729A', label: 'single-slit envelope' }],
        draw(S, g) {
          const p = S.p, N = 460;
          const pts = [], env = [];
          for (let i = 0; i <= N; i++) {
            const y = (i / N - 0.5) * 2 * S.yRange;
            const r = ydseAt(S, y);
            pts.push([y * 1000, r.I]); env.push([y * 1000, r.env]);
          }
          const P = g.Plot({
            xmin: -S.yRange * 1000, xmax: S.yRange * 1000, ymin: 0, ymax: 1.08,
            xlabel: 'y on screen (mm)', ylabel: 'I / I₀',
            xfmt: v => v.toFixed(1), yfmt: v => v.toFixed(1)
          }).frame();
          P.clip(() => {
            if (p.envelope && p.mode === 'double') {
              P.area(env, 0, g.alpha(g.theme['text-3'], .14));
              P.line(env, g.alpha(g.theme['text-3'], .95), 1.5, [4, 3]);
            }
            P.area(pts, 0, g.alpha(g.theme.phys, .16));
            P.line(pts, g.theme.phys, 2);
            if (S.shift !== 0) P.vline(S.shift * 1000, g.alpha('#8FE6D2', .85), [5, 3]);
            P.vline(p.yP * 1000, g.alpha(g.theme.text, .55), [3, 3]);
            P.dot(p.yP * 1000, ydseAt(S, p.yP).I, 4, g.theme.text, g.theme['ink-950']);
          });
          if (p.mode === 'double')
            P.tag(S.shift * 1000 + S.beta * 1000, 1.0,
                  'β = ' + (S.beta * 1000).toFixed(2) + ' mm', g.theme['text-2'], 'left', 0);
          if (S.shift !== 0)
            P.tag(S.shift * 1000, 0.55, 'centre moved ' + S.nShift.toFixed(2) + ' fringes',
                  '#8FE6D2', 'left', 0);
        },
        hover(S, x) {
          const y = x / 1000, r = ydseAt(S, y);
          return [{ label: 'y', value: x.toFixed(2) + ' mm' },
                  { label: 'I / I₀', value: r.I.toFixed(4), color: '#3DD6F5' },
                  { label: 'Δ / λ', value: (S.d * (y / Math.hypot(y, S.p.D)) / S.lamM - S.pathX / S.lam).toFixed(3) }];
        } },
      { title: 'Order number Δ/λ — the fringes are where this hits a whole number',
        legend: [{ c: '#3DD6F5', label: 'Δ/λ across the screen' }, { c: '#FFAE4C', label: 'whole orders' }],
        draw(S, g) {
          const p = S.p, N = 320, ord = [];
          for (let i = 0; i <= N; i++) {
            const y = (i / N - 0.5) * 2 * S.yRange;
            ord.push([y * 1000, S.d * (y / Math.hypot(y, p.D)) / S.lamM - S.pathX / S.lam]);
          }
          const nMax = Math.max(Math.abs(ord[0][1]), Math.abs(ord[N][1])) * 1.1 + 0.5;
          const nMin = Math.min(ord[0][1], ord[N][1]) * 1.1 - 0.5;
          const P = g.Plot({
            xmin: -S.yRange * 1000, xmax: S.yRange * 1000,
            ymin: Math.min(nMin, -nMax), ymax: nMax,
            xlabel: 'y on screen (mm)', ylabel: 'Δ / λ',
            xfmt: v => v.toFixed(1), yfmt: v => v.toFixed(0)
          }).frame();
          P.clip(() => {
            for (let n = Math.ceil(Math.min(nMin, -nMax)); n <= nMax; n++)
              P.hline(n, g.alpha(g.theme.warn, n === 0 ? .8 : .28), n === 0 ? null : [3, 4]);
            P.line(ord, g.theme.phys, 2.2);
            P.vline(p.yP * 1000, g.alpha(g.theme.text, .5), [3, 3]);
          });
          P.tag(-S.yRange * 1000, 0, S.pathX !== 0
            ? 'Δ/λ = 0 has moved off the axis — that is the plate'
            : 'Δ/λ = 0 at the centre', g.theme['text-2'], 'left', -8);
        } }
    ],

    readouts(S) {
      const p = S.p;
      const ratio = p.d / p.a;
      const miss = Math.abs(ratio - Math.round(ratio)) < 0.04 && Math.round(ratio) >= 2;
      const sth = p.yP / Math.sqrt(p.yP * p.yP + p.D * p.D);
      const two = p.mode === 'double';
      const out = [];
      if (two) out.push({ label: 'Fringe width β = λD/d', value: (S.beta * 1000).toFixed(3), unit: 'mm',
        flag: 'accent', hint: p.nMed > 1.0005 ? 'λ is λ_vac/n here' : '' });
      if (two) out.push({ label: 'Angular width λ/d', value: fmt(S.lamM / S.d * 1000, 3), unit: 'mrad' });
      out.push({ label: '1st diffraction min λD/a', value: (S.env1 * 1000).toFixed(2), unit: 'mm',
        flag: two ? '' : 'accent',
        hint: two ? 'edge of the central envelope' : 'central max is twice this wide' });
      if (two) out.push({ label: 'Fringes in central max', value: (2 * ratio).toFixed(1), unit: '', hint: '= 2d/a' });
      out.push({ label: two ? 'Order at P  Δ/λ' : 'a sinθ/λ at P',
        value: (two ? (S.d * sth / S.lamM - S.pathX / S.lam) : (S.a * sth / S.lamM)).toFixed(2),
        unit: 'λ', flag: 'accent' });
      out.push({ label: 'Intensity at P', value: ydseAt(S, p.yP).I.toFixed(4), unit: 'I₀' });
      if (two) out.push(miss
        ? { label: 'Missing orders', value: '±' + Math.round(ratio) + ', ±' + 2 * Math.round(ratio),
            unit: '', flag: 'crit', hint: 'd/a = ' + ratio.toFixed(2) + ' is a whole number' }
        : { label: 'Missing orders', value: 'none', unit: '', hint: 'd/a = ' + ratio.toFixed(2) + ' not integral' });
      if (two) out.push({ label: 'Fringe visibility', value: S.vis.toFixed(3), unit: '',
        flag: S.vis > 0.98 ? 'ok' : 'warn',
        hint: S.vis > 0.98 ? 'minima reach zero' : 'I_min/I_max = ' +
          (Math.pow(1 - Math.sqrt(S.ratio), 2) / Math.pow(1 + Math.sqrt(S.ratio), 2)).toFixed(3) });
      if (S.pathX !== 0 && two)
        out.push({ label: 'Plate shift (μ−n)tD/nd', value: (S.shift * 1000).toFixed(2), unit: 'mm',
          flag: 'accent', hint: S.nShift.toFixed(2) + ' whole fringes' });
      if (p.nMed > 1.0005)
        out.push({ label: 'λ inside the medium', value: (S.lamM * 1e9).toFixed(1), unit: 'nm',
          hint: 'β narrows by n = ' + p.nMed.toFixed(3) });
      return out;
    },

    equation(S) {
      const p = S.p;
      if (p.mode === 'single') {
        return E.frac(E.v('I'), E.v('I') + '₀') + ' ' + E.op('=') + ' ' +
          E.frac('sin<sup>2</sup>' + E.v('β'), E.v('β') + '<sup>2</sup>') + E.op(',') + ' ' +
          E.v('β') + ' ' + E.op('=') + ' ' + E.frac('π' + E.v('a') + ' sin' + E.v('θ'), E.v('λ')) +
          '<br>minima at ' + E.v('a') + ' sin' + E.v('θ') + ' ' + E.op('=') + ' ' + E.v('mλ') +
          E.op('·') + ' first at ' + E.n(S.env1 * 1000, 'mm');
      }
      let s = 'Δ ' + E.op('=') + ' ' + E.v('d') + ' sin' + E.v('θ');
      if (S.pathX !== 0) s += ' ' + E.op('−') + ' (' + E.v('μ') + E.op('−') + E.v('n') + ')' + E.v('t');
      s += E.op(',') + ' β ' + E.op('=') + ' ' + E.frac(E.v('λD'), E.v('nd')) + ' ' + E.op('=') + ' ' +
        E.n(S.beta * 1000, 'mm');
      s += '<br>' + E.frac(E.v('I'), E.v('I') + '₀') + ' ' + E.op('=') +
        ' (sinc<sup>2</sup>' + E.v('β') + ')·' +
        E.frac(E.v('I') + '₁' + E.op('+') + E.v('I') + '₂' + E.op('+') + '2√(' + E.v('I') + '₁' + E.v('I') + '₂)cos δ',
               '(√' + E.v('I') + '₁' + E.op('+') + '√' + E.v('I') + '₂)<sup>2</sup>');
      return s;
    },

    eqNote: '<b>Two independent things are multiplied together.</b> The cos² term counts the slits and the ' +
      'sinc² term counts the width of each one. Wherever a cos² maximum lands on a sinc² zero, the fringe ' +
      'is <b>missing</b> — that is the whole of the missing-order question. And note what sets the fringe ' +
      '<i>positions</i> versus what sets the <i>contrast</i>: unequal slits leave every fringe exactly where ' +
      'it was and merely stop the dark ones being dark.' +
      '<br><br><b>One honest discrepancy.</b> This lab integrates the exact expression, with sin θ = ' +
      'y/√(y²+D²) and the envelope included, so the measured peaks sit a few per cent <i>inside</i> ' +
      'nβ — the falling envelope drags each maximum toward the centre. β = λD/d is the small-angle, ' +
      'flat-envelope limit, and it is what the exam wants; the difference is what a real bench shows.',

    problems: [
      { source: 'JEE Main pattern · the basic substitution',
        q: 'In a Young\'s experiment the two slits are 0.300 mm apart and the screen is 1.50 m away. Light of wavelength 600 nm is used. Find the fringe width in millimetres.',
        params: { lam: 600, d: 0.30, a: 0.08, D: 1.5, mode: 'double', nMed: 1, plate: false, ratio: 1, white: false },
        predict: { label: 'fringe width β', unit: 'mm', tol: 0.02 },
        measure: S => S.beta * 1000,
        working: 'β = λD/d = (600×10⁻⁹ × 1.50)/(0.300×10⁻³) = <b>3.00 mm</b>. ' +
          'Keep every length in metres until the final line — mixing mm and m in the middle is ' +
          'where this one-mark question is lost.' },
      { source: 'JEE Advanced pattern · missing orders',
        q: 'The slit separation is exactly three times the slit width. Which is the lowest-order bright fringe that is missing from the pattern?',
        params: { lam: 589, d: 0.24, a: 0.08, D: 1.2, mode: 'double', envelope: true, nMed: 1, plate: false, ratio: 1, white: false },
        predict: { label: 'lowest missing order n', unit: '', tol: 0.05 },
        measure: S => S.p.d / S.p.a,
        working: 'Interference maxima sit at d sin θ = nλ; diffraction zeros sit at a sin θ = mλ. ' +
          'Both are satisfied together when n/d = m/a, i.e. n = m(d/a) = 3m. The lowest is ' +
          '<b>n = 3</b>, then 6, 9, … Look at the graph: the third fringe either side of the centre ' +
          'is not dim, it is <i>absent</i>, because the envelope there is exactly zero.' },
      { source: 'JEE Advanced pattern · a thin plate over one slit',
        q: 'A plate of refractive index 1.50 and thickness 3.60 µm is placed over one slit. Light of wavelength 600 nm is used. Through how many whole fringes does the pattern shift?',
        params: { lam: 600, d: 0.25, a: 0.08, D: 1.2, mode: 'double', plate: true, t: 3.6, mu: 1.5, nMed: 1, ratio: 1, white: false },
        predict: { label: 'shift', unit: 'fringes', tol: 0.03 },
        measure: S => S.nShift,
        working: 'The plate replaces 3.60 µm of air with glass, adding an optical path of ' +
          '(μ − 1)t = 0.500 × 3.60 µm = 1.80 µm. Divide by λ: 1.80×10⁻⁶ / 600×10⁻⁹ = <b>3.00 fringes</b>. ' +
          'The pattern moves <b>toward the covered slit</b>, because that arm now needs less geometric ' +
          'path to stay in step. Note that β itself does not change at all — the whole pattern ' +
          'translates rigidly, which the Δ/λ graph shows as a shifted intercept.' },
      { source: 'NEET pattern · immersion',
        q: 'The entire apparatus (λ = 589 nm, d = 0.250 mm, D = 1.20 m) is immersed in water of refractive index 1.33. Find the new fringe width in millimetres.',
        params: { lam: 589, d: 0.25, a: 0.08, D: 1.2, mode: 'double', nMed: 1.33, plate: false, ratio: 1, white: false },
        predict: { label: 'fringe width in water', unit: 'mm', tol: 0.02 },
        measure: S => S.beta * 1000,
        working: 'In the water the wavelength is λ/n = 589/1.33 = 443 nm, so β = λD/(nd) = ' +
          '2.827 mm / 1.33 = <b>2.126 mm</b>. The fringes narrow by exactly the refractive index. ' +
          'The frequency of the light is unchanged — only the wavelength shrinks, and it is the ' +
          'wavelength that the path difference is measured against.' },
      { source: 'JEE Advanced pattern · unequal slits',
        q: 'One slit is partly covered so that it transmits only a quarter of the intensity of the other. Find the ratio I_min/I_max in the resulting pattern.',
        params: { lam: 589, d: 0.25, a: 0.08, D: 1.2, mode: 'double', ratio: 0.25, nMed: 1, plate: false, white: false },
        predict: { label: 'I_min / I_max', unit: '', tol: 0.05 },
        measure: S => Math.pow(1 - Math.sqrt(S.ratio), 2) / Math.pow(1 + Math.sqrt(S.ratio), 2),
        working: 'Amplitudes go as √I, so A₁ : A₂ = 1 : 0.5. At a maximum A = 1.5, at a minimum ' +
          'A = 0.5, and intensity is A²: I_min/I_max = (0.5/1.5)² = <b>1/9 ≈ 0.111</b>. ' +
          'The fringes stay exactly where they were — only the contrast falls. The trap is to take ' +
          'the ratio of intensities (1:4) straight into the answer instead of going through the ' +
          'amplitudes first.' }
    ],

    walkthrough: [
      { title: '1 · What P actually measures',
        body: 'P sweeps the screen. Watch the PATH DIFFERENCE panel: the geometry gives a length in nanometres, and dividing by λ turns it into a count of whole wavelengths.',
        ask: 'What has to be true of that count for P to sit on a bright fringe?',
        reveal: 'It must be a <b>whole number</b>. Δ = nλ is constructive; Δ = (n + ½)λ is destructive. Everything else in this chapter is a consequence of that one line.',
        params: { lam: 589, d: 0.25, a: 0.08, D: 1.2, mode: 'double', sweep: true, nMed: 1, plate: false, ratio: 1, white: false } },
      { title: '2 · Change the colour',
        body: 'Drag λ from violet to red and watch the pattern on the screen and the β readout.',
        ask: 'Red light has a longer wavelength. Do the fringes get wider or narrower?',
        reveal: '<b>Wider.</b> β = λD/d is directly proportional to λ. Violet packs fringes closest together — which is why a white-light source shows violet nearest the centre of each order and red furthest out.',
        params: { lam: 680, d: 0.25, a: 0.08, D: 1.2, mode: 'double', nMed: 1, plate: false, ratio: 1, white: false } },
      { title: '3 · Move the slits apart',
        body: 'Hold λ fixed and drag the slit handle to increase d.',
        ask: 'Bringing the slits further apart — does the pattern spread out or crowd together?',
        reveal: '<b>It crowds together.</b> d is in the denominator of β = λD/d. This catches people out because "bigger separation" intuitively sounds like "bigger pattern". The geometry says otherwise: a larger d reaches the same path difference at a smaller angle.',
        params: { lam: 589, d: 0.55, a: 0.08, D: 1.2, mode: 'double', nMed: 1, plate: false, ratio: 1, white: false } },
      { title: '4 · Missing orders',
        body: 'Two slits, with d set to exactly three times a. Look at the pattern on the screen and at both graphs.',
        ask: 'Some bright fringes have vanished. Which ones, and why?',
        reveal: 'Orders <b>n = ±3, ±6, …</b> are missing. Where d/a = 3, the interference maximum for n = 3 falls exactly on a zero of the diffraction envelope, and anything multiplied by zero is zero. In general the missing orders are n = m·(d/a).',
        params: { lam: 589, d: 0.24, a: 0.08, D: 1.2, mode: 'double', envelope: true, nMed: 1, plate: false, ratio: 1, white: false } },
      { title: '5 · Put a plate over one slit',
        body: 'Insert the mica plate. Watch the pattern march sideways on the screen and the Δ/λ line lift off the axis.',
        ask: 'The plate adds optical path to one arm. Which way does the pattern move — toward the covered slit or away from it?',
        reveal: '<b>Toward the covered slit.</b> The centre of the pattern is where the two optical paths are equal. Adding (μ − 1)t to one arm means the geometry has to give that much back, which happens on the covered side. The shift is (μ − 1)tD/d, and crucially <b>β is unchanged</b> — the pattern translates, it does not stretch.',
        params: { lam: 600, d: 0.25, a: 0.08, D: 1.2, mode: 'double', plate: true, t: 3.6, mu: 1.5, nMed: 1, ratio: 1, white: false } },
      { title: '6 · Unbalance the slits',
        body: 'Now take the plate out and drop the intensity ratio to a quarter.',
        ask: 'The fringes have faded but have not moved. Why does an unequal pair change the contrast and not the spacing?',
        reveal: 'Spacing is set by <b>phase</b>, contrast by <b>amplitude</b>. δ = 2πd sinθ/λ does not contain the amplitudes at all, so every maximum stays exactly where it was. But the minima now sit at (A₁ − A₂)² instead of zero, so I_min/I_max = (1−√r)²/(1+√r)². Watch the two phasors in the corner: the shorter one can no longer cancel the longer one.',
        params: { lam: 589, d: 0.25, a: 0.08, D: 1.2, mode: 'double', ratio: 0.25, nMed: 1, plate: false, white: false } },
      { title: '7 · Immerse the whole bench',
        body: 'Raise the index of the medium to 1.33 — the apparatus is now under water.',
        ask: 'Which of λ, f and β change?',
        reveal: 'The <b>frequency is fixed by the source</b> and cannot change. The wave slows down, so λ becomes λ/n, and β = λD/nd narrows by exactly n. A standard trap asks for the colour seen under water: it does not change, because colour follows frequency.',
        params: { lam: 589, d: 0.25, a: 0.08, D: 1.2, mode: 'double', nMed: 1.33, plate: false, ratio: 1, white: false } },
      { title: '8 · White light',
        body: 'Switch the source to white. The screen now shows the sum over the whole visible band.',
        ask: 'Why is only the central fringe white, and why do the higher orders wash out?',
        reveal: 'At the centre Δ = 0 for <b>every</b> wavelength at once, so all of them are bright together and the fringe is white. Away from the centre each colour has its own β = λD/d, so red spreads furthest and violet least — the orders separate into little spectra, then overlap, and by about the fourth order the overlap is complete and the screen goes uniformly pale.',
        params: { white: true, lam: 550, d: 0.25, a: 0.10, D: 1.2, mode: 'double', nMed: 1, plate: false, ratio: 1 } },
      { title: '9 · The single slit alone',
        body: 'Switch the aperture to a single slit. The cos² interference term disappears and only the diffraction envelope is left.',
        ask: 'Where is the first minimum of a single-slit pattern?',
        reveal: 'At <b>a sin θ = λ</b>, i.e. y = λD/a. Note the central maximum is <b>twice</b> as wide as the others, and far brighter — a standard one-mark distinction between interference and diffraction.',
        params: { mode: 'single', a: 0.08, D: 1.2, lam: 589, nMed: 1, plate: false, ratio: 1, white: false } }
    ],

    quiz: [
      { q: 'Two coherent sources each of intensity I₀ interfere. The intensity at a point of constructive interference is:',
        options: ['2I₀', '4I₀', 'I₀', '√2 I₀'], answer: 1,
        why: 'Amplitudes add, not intensities. A = A₁ + A₂ = 2A₁, and I ∝ A², so I = 4I₀. Energy is not created — the extra light at the maxima is exactly what is missing from the minima.' },
      { q: 'A thin transparent plate of refractive index μ and thickness t is placed over one slit. The fringe width β:',
        options: ['increases', 'decreases', 'is unchanged', 'becomes zero'], answer: 2,
        why: 'β = λD/d contains none of μ, t. The plate adds a constant optical path to one arm, which translates the whole pattern by (μ−1)tD/d without stretching it. Insert the plate in the lab and watch β in the readouts stay put while the centre moves.' },
      { q: 'The whole apparatus is immersed in a liquid of refractive index 1.5. The fringe width:',
        options: ['is 1.5 times larger', 'is 1.5 times smaller', 'is unchanged', 'depends on the slit width'], answer: 1,
        why: 'The wavelength in the medium is λ/n, so β = λD/nd. The fringes crowd together by exactly the factor n. The frequency — and therefore the colour — is unchanged.' },
      { q: 'In a double-slit pattern with d = 4a, which orders are missing?',
        options: ['±2, ±4, ±6 …', '±4, ±8, ±12 …', 'none', '±1, ±2, ±3 …'], answer: 1,
        why: 'Missing orders are n = m(d/a) = 4m. Set d = 4a in the lab and look at the fourth fringe either side of the centre: the interference maximum lands exactly on a zero of the envelope.' },
      { q: 'One slit is covered so it passes a ninth of the intensity of the other. The ratio I_min/I_max is:',
        options: ['1/9', '1/4', '1/81', '0'], answer: 1,
        why: 'Work in amplitudes: A₁ : A₂ = 3 : 1. Max amplitude 4, min amplitude 2, and I ∝ A², so I_min/I_max = (2/4)² = 1/4. Going straight from the intensity ratio to the answer gives 1/9, which is the trap.' }
    ],

    notes: '<b>Where this shows up in the paper.</b>' +
      '<ul><li>Direct β = λD/d substitution — guaranteed marks, both exams.</li>' +
      '<li>"A thin plate is introduced over one slit" — shift = (μ−1)tD/d, and the number of fringes ' +
      'crossed is (μ−1)t/λ. β never changes. Very frequent in JEE Advanced.</li>' +
      '<li>"Apparatus is immersed in water" — λ becomes λ/μ, so every fringe narrows by μ.</li>' +
      '<li>Missing-order questions, which need both formulae held at once.</li>' +
      '<li>Unequal slits: I_min/I_max = (1−√r)²/(1+√r)², where r is the intensity ratio.</li>' +
      '<li>Distinguishing interference from diffraction: equal vs unequal fringe brightness, and the ' +
      'double-width central maximum.</li></ul>' +
      '<div class="pyq"><em>Trap to avoid</em>Intensity, not amplitude, is what you see. Two coherent sources of intensity ' +
      'I₀ each give <b>4I₀</b> at a maximum, not 2I₀ — amplitudes add, and intensity goes as amplitude squared.</div>' +
      '<div class="pyq"><em>Trap to avoid</em>The plate shift moves the pattern; it never changes the fringe width. ' +
      'Unequal slits change the contrast; they never move a fringe. Keep the two effects apart and the ' +
      'whole family of questions collapses to two lines of algebra.</div>'
  });

})(window.InsightLab);
