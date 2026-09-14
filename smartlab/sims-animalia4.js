/* ============================================================
   ANIMAL KINGDOM — 7. Vertebrate heart & circulation evolution
                    8. Chordate characters and the cladogram
   ============================================================ */
(function (L, A, ART) {
  'use strict';
  const { clamp, TAU, fmt, E } = L;
  const { CLASSES } = A;

  const OXY = '#FF5E6C', DEOXY = '#4D7FC4';

  /* =========================================================================
     7 · THE VERTEBRATE HEART — why four chambers made warm blood possible
     ========================================================================= */
  const HEARTS = [
    { id: 'fish', name: 'Fish', klass: 'Chondrichthyes / Osteichthyes', chambers: 2,
      circ: 'Single', mix: 0, art: 'bonyfish', hue: '#4E9CC0', thermo: 'Poikilothermous',
      gas: 'gills', note: 'Blood passes through the heart once per circuit. The gills take the pressure drop, ' +
        'so blood leaves them oxygenated but slow.', pressureAfter: 0.35, examples: 'Scoliodon, Labeo, Catla' },
    { id: 'amphibian', name: 'Amphibian', klass: 'Amphibia', chambers: 3,
      circ: 'Double (incomplete)', mix: 0.35, art: 'frog', hue: '#6FAE6F', thermo: 'Poikilothermous',
      gas: 'lungs + skin', note: 'Two atria empty into a single ventricle. A spiral valve limits the mixing, ' +
        'but it cannot prevent it.', pressureAfter: 1, examples: 'Rana, Bufo, Salamandra' },
    { id: 'reptile', name: 'Reptile', klass: 'Reptilia', chambers: 3,
      circ: 'Double (incomplete)', mix: 0.20, art: 'lizard', hue: '#9BA84E', thermo: 'Poikilothermous',
      gas: 'lungs', note: 'The ventricle is partly divided by a septum, so mixing is reduced but not abolished. ' +
        'The crocodile is the exception — it has a fully four-chambered heart.',
      pressureAfter: 1, examples: 'Naja, Calotes, Chelone' },
    { id: 'croc', name: 'Crocodile', klass: 'Reptilia (exception)', chambers: 4,
      circ: 'Double (complete)', mix: 0, art: 'lizard', hue: '#8C9B45', thermo: 'Poikilothermous',
      gas: 'lungs', note: 'A four-chambered heart in a poikilotherm — the exception NCERT names explicitly. ' +
        'It can still shunt blood past the lungs while diving.', pressureAfter: 1, examples: 'Crocodilus, Alligator' },
    { id: 'bird', name: 'Bird', klass: 'Aves', chambers: 4,
      circ: 'Double (complete)', mix: 0, art: 'bird', hue: '#E8B64C', thermo: 'Homeothermous',
      gas: 'lungs + air sacs', note: 'Complete separation plus air sacs that ventilate the lungs in one ' +
        'direction — the most efficient vertebrate respiratory system.', pressureAfter: 1,
      examples: 'Columba, Pavo, Struthio' },
    { id: 'mammal', name: 'Mammal', klass: 'Mammalia', chambers: 4,
      circ: 'Double (complete)', mix: 0, art: 'mammal', hue: '#C4785E', thermo: 'Homeothermous',
      gas: 'lungs', note: 'Complete separation of oxygenated and deoxygenated blood, with a high-pressure ' +
        'systemic circuit and a low-pressure pulmonary one.', pressureAfter: 1, examples: 'Homo, Elephas, Balaenoptera' }
  ];

  L.register({
    id: 'ak-heart', subject: 'biology',
    name: 'Vertebrate Heart — Two Chambers to Four',
    chapter: 'Animal Kingdom',
    exams: ['NEET UG'],
    weight: 'Very high yield',
    is3D: false,
    stageHint: 'Blood is coloured by its real oxygen saturation — watch the two streams blend in a three-chambered heart',
    lede: 'Counting heart chambers is a one-mark question. Understanding <b>why</b> the number matters is the ' +
      'whole of vertebrate physiology. This lab pushes blood round the circuit and tracks its <b>oxygen ' +
      'saturation</b> at every point, so you can see exactly how much a three-chambered heart loses to mixing — ' +
      'and why warm blood only became possible once the ventricle was fully divided.',

    params: { type: 'mammal', activity: 1, temp: 25, shunt: 0, particles: true },

    presets: HEARTS.map(h => ({ name: h.name, params: { type: h.id } })).concat([
      { name: 'Frog at rest, cold', params: { type: 'amphibian', activity: 0.4, temp: 10 } },
      { name: 'Bird in flight', params: { type: 'bird', activity: 3.2 } },
      { name: 'Diving crocodile (shunt open)', params: { type: 'croc', activity: 0.5, shunt: 0.7 } }
    ]),

    controls: [
      { group: 'Animal', items: [
        { key: 'type', type: 'select', label: 'Class', restructure: true,
          options: HEARTS.map(h => ({ value: h.id, label: h.name })) }
      ] },
      { group: 'State', items: [
        { key: 'activity', label: 'Activity level', min: 0.3, max: 3.5, step: 0.05, unit: '×rest',
          fmt: v => v.toFixed(2), restructure: true },
        { key: 'temp', label: 'Ambient temperature', min: 0, max: 40, step: 0.5, unit: '°C',
          fmt: v => v.toFixed(1), restructure: true },
        { key: 'shunt', label: 'Pulmonary shunt (diving)', min: 0, max: 1, step: 0.01, unit: '',
          fmt: v => (v * 100).toFixed(0) + '%', restructure: true }
      ] },
      { group: 'Display', items: [
        { key: 'particles', type: 'toggle', label: 'Show blood flow' }
      ] }
    ],

    setup(S) {
      const p = S.p;
      const h = HEARTS.find(x => x.id === p.type) || HEARTS[5];
      S.h = h;
      const SAT_OXY = 98, SAT_VEIN = 60;

      // extra mixing when a reptile shunts blood past the lungs
      const shunt = (h.id === 'reptile' || h.id === 'croc') ? p.shunt : 0;
      S.mix = clamp(h.mix + shunt * 0.55, 0, 1);
      S.satSystemic = h.chambers === 2 ? 95
        : SAT_OXY * (1 - S.mix) + ((SAT_OXY + SAT_VEIN) / 2) * S.mix;

      // metabolic demand: homeotherms pay a large constant cost; poikilotherms track temperature
      const q10 = Math.pow(2.3, (p.temp - 25) / 10);
      S.demand = (h.thermo === 'Homeothermous' ? 10 : 1.0 * q10) * p.activity;
      // supply: saturation × how briskly blood can be pushed round the systemic circuit
      S.supply = (S.satSystemic / 98) * h.pressureAfter * (h.chambers === 4 ? 12 : h.chambers === 3 ? 4.2 : 2.6)
        * clamp(p.activity, 0.3, 3.5) / 1.0;
      S.ok = S.supply >= S.demand;
      S.margin = S.supply / Math.max(S.demand, 1e-6);
      S.parts = S.parts && S.parts.length ? S.parts : Array.from({ length: 64 }, () => ({ u: Math.random() }));
    },

    step(S, dt) {
      S.t = (S.t || 0) + dt;
      const rate = 0.16 + 0.10 * S.p.activity;
      S.parts.forEach(q => { q.u = (q.u + dt * rate) % 1; });
    },

    drawStage(S, g) {
      const ctx = g.ctx, th = g.theme, p = S.p, W = g.w, H = g.h;
      const h = S.h;
      const Z = window.ZOOART, RXo = window.RX;
      // NOTE: g.mix() returns 'rgb(...)', which cannot be parsed by g.mix()
      // again. Anything that gets mixed a second time must stay hex, so the
      // blood colour ramp runs through RX.mix.
      const satCol = s => RXo.mix(DEOXY, OXY, clamp((s - 55) / 45, 0, 1));

      /* ---------------- plate frame ----------------
         The header band and the hint strip are reserved first, and every
         piece of anatomy is laid out inside what is left. Nothing may
         cross into either band. */
      const HDR = 64, FOOT = 34;
      const y0 = HDR, y1 = H - FOOT, CH = y1 - y0;
      const hx = W * 0.50, hy = y0 + CH * 0.46;
      const sc = Math.min(W * 0.150, CH * 0.33);
      const R = sc * 1.42;
      const gasX = W * 0.185, bodyX = W * 0.815;
      const organR = Math.min(W * 0.125, CH * 0.26);

      /* ---------------- gas-exchange organ ----------------
         Lungs are drawn as lobed lungs and gills as a stack of gill
         arches: which organ it is, is itself an examinable fact. */
      const gasIsGill = /gill/.test(h.gas);
      const lungCol = '#E88AA0', gillCol = '#E4667A';
      if (gasIsGill) {
        // Four holobranchs on a gill bar: a pale cartilaginous arch carrying
        // two rows of filaments, each filament red with the blood inside it.
        // Deoxygenated blood enters at the bottom, oxygenated leaves at the top.
        for (let a = 0; a < 4; a++) {
          const ax = gasX - organR * 0.60 + a * organR * 0.40;
          const arch = RXo.quadPts(ax, hy - organR * 0.88, ax - organR * 0.26, hy,
                                   ax, hy + organR * 0.88, 20);
          RXo.tube(ctx, arch, organR * 0.052, '#C4D2E8', { contour: 1 });
          ctx.lineCap = 'round';
          for (let f = 1; f < 20; f++) {
            const t = f / 20, pt = arch[f];
            const len = organR * 0.17 * Math.sin(Math.PI * t);
            if (len < 1.5) continue;
            // the filament carries blood that is loading oxygen as it rises
            ctx.strokeStyle = RXo.mix(DEOXY, OXY, clamp(1 - t * 1.15, 0, 1));
            ctx.lineWidth = Math.max(1.2, organR * 0.030);
            [-1, 1].forEach(sg => {
              ctx.beginPath();
              ctx.moveTo(pt[0], pt[1]);
              ctx.lineTo(pt[0] + sg * len, pt[1] - len * 0.26);
              ctx.stroke();
            });
          }
        }
        // afferent and efferent branchial vessels, which is what the circuit
        // actually connects to
        RXo.tube(ctx, [[gasX - organR * 0.72, hy + organR * 0.98],
                       [gasX + organR * 0.62, hy + organR * 0.98]],
                 organR * 0.055, DEOXY, { contour: 1 });
        RXo.tube(ctx, [[gasX - organR * 0.72, hy - organR * 0.98],
                       [gasX + organR * 0.62, hy - organR * 0.98]],
                 organR * 0.055, OXY, { contour: 1 });
        Z.lbl(ctx, gasX + organR * 0.68, hy + organR * 0.98, 'afferent', DEOXY, 'left', 8.5);
        Z.lbl(ctx, gasX + organR * 0.68, hy - organR * 0.98, 'efferent', OXY, 'left', 8.5);
      } else {
        // two lungs, each with lobes, and a trachea splitting into bronchi
        [-1, 1].forEach(sg => {
          const lx = gasX + sg * organR * 0.42;
          const path = c => {
            c.beginPath();
            c.moveTo(lx + sg * organR * 0.04, hy - organR * 0.92);
            c.bezierCurveTo(lx + sg * organR * 0.62, hy - organR * 0.62,
                            lx + sg * organR * 0.74, hy + organR * 0.34,
                            lx + sg * organR * 0.30, hy + organR * 0.90);
            c.bezierCurveTo(lx + sg * organR * 0.06, hy + organR * 1.02,
                            lx - sg * organR * 0.28, hy + organR * 0.60,
                            lx - sg * organR * 0.26, hy - organR * 0.10);
            c.bezierCurveTo(lx - sg * organR * 0.24, hy - organR * 0.58,
                            lx - sg * organR * 0.10, hy - organR * 0.88,
                            lx + sg * organR * 0.04, hy - organR * 0.92);
            c.closePath();
          };
          RXo.volume(ctx, path, {
            fill: lungCol, r: organR * 0.72, cx: lx + sg * organR * 0.16, cy: hy,
            stipple: 1.5, grain: '#8E3D52', shadow: 0.8, gloss: 0.20,
            contour: Math.max(1, organR * 0.030)
          });
          // lobar fissures
          ctx.save(); path(ctx); ctx.clip();
          ctx.strokeStyle = g.alpha('#7A2F42', .55); ctx.lineWidth = Math.max(1, organR * 0.022);
          [0.12, 0.52].forEach(fy => {
            ctx.beginPath();
            ctx.moveTo(lx - organR * 0.9, hy + organR * (fy - 0.18));
            ctx.quadraticCurveTo(lx, hy + organR * fy, lx + organR * 0.9, hy + organR * (fy + 0.22));
            ctx.stroke();
          });
          ctx.restore();
          // bronchial tree inside the lung
          ctx.save(); path(ctx); ctx.clip();
          const root = [lx - sg * organR * 0.22, hy - organR * 0.18];
          ctx.globalAlpha = 0.55;
          RXo.tube(ctx, RXo.quadPts(root[0], root[1], lx, hy - organR * 0.05,
                                    lx + sg * organR * 0.18, hy + organR * 0.22, 10),
                   organR * 0.030, '#C6D6EC', { vivid: false });
          ctx.strokeStyle = g.alpha('#C6D6EC', .40);
          ctx.lineWidth = Math.max(0.9, organR * 0.016); ctx.lineCap = 'round';
          for (let k = 0; k < 9; k++) {
            const t = 0.10 + k * 0.10;
            const bx = lx + sg * organR * (-0.20 + t * 0.55), by = hy + organR * (-0.20 + t * 0.62);
            const ln = organR * (0.30 - 0.014 * k);
            ctx.beginPath(); ctx.moveTo(bx, by);
            ctx.lineTo(bx + sg * ln, by - organR * 0.20 + k * organR * 0.055);
            ctx.stroke();
          }
          ctx.globalAlpha = 1;
          ctx.restore();
        });
        // trachea and the two main bronchi
        RXo.tube(ctx, [[gasX, hy - organR * 1.34], [gasX, hy - organR * 1.10]],
                 organR * 0.046, '#DCE7F6', { vivid: false, contour: 1 });
        [-1, 1].forEach(sg => RXo.tube(ctx,
          [[gasX, hy - organR * 1.12], [gasX + sg * organR * 0.34, hy - organR * 0.78]],
          organR * 0.034, '#DCE7F6', { vivid: false }));
        // the pulmonary artery branches to both lungs below, and the pulmonary
        // veins collect from both above — the circuit meets these, not the
        // middle of the lung, so the captions below stay clear
        RXo.tube(ctx, [[gasX - organR * 0.72, hy + organR * 0.98],
                       [gasX + organR * 0.62, hy + organR * 0.98]],
                 organR * 0.055, DEOXY, { contour: 1 });
        RXo.tube(ctx, [[gasX - organR * 0.72, hy - organR * 0.98],
                       [gasX + organR * 0.62, hy - organR * 0.98]],
                 organR * 0.055, OXY, { contour: 1 });
        [-1, 1].forEach(sg => {
          const lx2 = gasX + sg * organR * 0.42;
          RXo.tube(ctx, [[lx2, hy + organR * 0.98], [lx2 + sg * organR * 0.10, hy + organR * 0.74]],
                   organR * 0.034, DEOXY, { vivid: false });
          RXo.tube(ctx, [[lx2, hy - organR * 0.98], [lx2 + sg * organR * 0.10, hy - organR * 0.74]],
                   organR * 0.034, OXY, { vivid: false });
        });
      }
      Z.lbl(ctx, gasX, hy + organR * 1.16, h.gas.toUpperCase(), th.text, 'center', 10.5);
      Z.lbl(ctx, gasX, hy + organR * 1.16 + 13, 'blood loads O₂', th['text-3'], 'center', 9);

      /* ---------------- the tissues ----------------
         A capillary bed, not a labelled ellipse: an arteriole splits into
         a mesh of capillaries that reconverge on a venule, and the blood
         darkens across it because that is where the oxygen is spent. */
      {
        const path = c => {
          c.beginPath();
          c.ellipse(bodyX, hy, organR * 0.80, organR * 0.98, 0, 0, TAU);
        };
        RXo.volume(ctx, path, {
          fill: '#8E6F8C', r: organR * 0.86, cx: bodyX, cy: hy,
          stipple: 1.8, grain: '#3A2740', shadow: 0.8, gloss: 0.14,
          contour: Math.max(1, organR * 0.026)
        });
        ctx.save(); path(ctx); ctx.clip();
        // capillary mesh, coloured by how much oxygen is left along it
        for (let k = 0; k < 7; k++) {
          const yy = hy + organR * (-0.72 + k * 0.24);
          const pts = [];
          for (let i = 0; i <= 20; i++) {
            const t = i / 20;
            pts.push([bodyX - organR * 0.92 + t * organR * 1.84,
                      yy + Math.sin(t * Math.PI * 2.4 + k) * organR * 0.06]);
          }
          ctx.lineWidth = Math.max(1.6, organR * 0.048); ctx.lineCap = 'round';
          for (let i = 0; i < pts.length - 1; i++) {
            const t = i / (pts.length - 1);
            ctx.strokeStyle = RXo.mix(satCol(S.satSystemic), DEOXY, t);
            ctx.beginPath();
            ctx.moveTo(pts[i][0], pts[i][1]); ctx.lineTo(pts[i + 1][0], pts[i + 1][1]);
            ctx.stroke();
          }
        }
        ctx.restore();
        // arteriole in, venule out
        RXo.tube(ctx, [[bodyX - organR * 1.02, hy - organR * 0.30],
                       [bodyX - organR * 0.62, hy - organR * 0.12]],
                 organR * 0.055, satCol(S.satSystemic), { contour: 1 });
        RXo.tube(ctx, [[bodyX + organR * 0.62, hy + organR * 0.12],
                       [bodyX + organR * 1.02, hy + organR * 0.30]],
                 organR * 0.055, DEOXY, { contour: 1 });
      }
      Z.lbl(ctx, bodyX, hy + organR * 1.16, 'BODY TISSUES', th.text, 'center', 10.5);
      Z.lbl(ctx, bodyX, hy + organR * 1.16 + 13, 'capillary bed unloads O₂', th['text-3'], 'center', 9);

      /* ---------------- the heart ----------------
         Anterior view: the right heart is on the viewer's left, which puts
         it on the same side as the gas-exchange organ — so the pulmonary
         limb is short and the systemic limb runs to the body on the right. */
      const beat = 0.5 - 0.5 * Math.cos(S.t * 2 * Math.PI * 1.2);
      BIOART.heart(ctx, hx, hy, sc, {
        chambers: h.chambers,
        septum: h.id === 'reptile',
        sat: h.chambers === 2
          ? { ra: 60, rv: 60, la: 60, lv: 60 }
          : { ra: 60, rv: 60, la: 98, lv: S.satSystemic },
        contraction: beat * 0.8,
        mvOpen: beat < 0.45, tvOpen: beat < 0.45,
        avOpen: beat > 0.5, pvOpen: beat > 0.5,
        labels: true, leaders: false, vessels: false
      });
      if (h.id === 'reptile') {
        Z.leader(ctx, hx + sc * 0.02, hy + sc * 0.50, hx + sc * 0.86, hy + sc * 0.96, th.warn);
        Z.lbl(ctx, hx + sc * 0.90, hy + sc * 0.98, 'incomplete septum', th.warn, 'left', 9.5);
      }
      if (h.id === 'croc') {
        Z.leader(ctx, hx + sc * 0.04, hy + sc * 0.44, hx + sc * 0.86, hy + sc * 0.96, th.ok);
        Z.lbl(ctx, hx + sc * 0.90, hy + sc * 0.98, 'complete septum — the reptilian exception',
              th.ok, 'left', 9.5);
      }
      g.scaleBar(16, y1 - 8, sc * 1.0, '≈ 6 cm', th['text-3']);

      // where each circuit leaves and re-enters the heart
      const ANCH = h.chambers === 4
        ? { pOut: [hx - sc * 0.32, hy + sc * 0.70], pIn: [hx + sc * 0.38, hy - sc * 0.64],
            sOut: [hx + sc * 0.32, hy + sc * 0.68], sIn: [hx - sc * 0.42, hy - sc * 0.64] }
        : h.chambers === 3
        ? { pOut: [hx - sc * 0.22, hy + sc * 0.70], pIn: [hx + sc * 0.38, hy - sc * 0.64],
            sOut: [hx + sc * 0.22, hy + sc * 0.70], sIn: [hx - sc * 0.42, hy - sc * 0.64] }
        : { pOut: [hx + sc * 0.74, hy - sc * 0.76], pIn: null,
            sOut: null, sIn: [hx - sc * 0.62, hy + sc * 0.76] };

      /* ---------------- mixing ---------------- */
      if (S.mix > 0.01) {
        ctx.save(); ctx.globalCompositeOperation = 'lighter';
        const mg = ctx.createRadialGradient(hx, hy + sc * 0.28, 0, hx, hy + sc * 0.28, sc * 0.62);
        mg.addColorStop(0, g.alpha('#B07CC6', .35 * S.mix / 0.5)); mg.addColorStop(1, 'rgba(0,0,0,0)');
        ctx.fillStyle = mg;
        ctx.beginPath(); ctx.arc(hx, hy + sc * 0.28, sc * 0.62, 0, TAU); ctx.fill();
        ctx.restore();
      }

      /* ---------------- the circuits ----------------
         Both loops are kept strictly inside the plate frame: the top
         return runs below the header band and the bottom outflow above
         the hint strip. */
      const botY = Math.min(hy + R * 1.05, y1 - 52);
      // The outer return always runs above the inner one, and both must clear
      // the header band with enough room for their captions.
      const topY2 = Math.max(hy - R * 1.06, y0 + 42);
      const topY1 = topY2 + 26;
      // A fish runs ONE circuit and the direction matters: blood leaves the
      // heart through the VENTRAL aorta, enters the gills afferently at the
      // bottom, is collected efferently at the top into the DORSAL aorta,
      // and only then reaches the body. Running it the other way round is
      // the classic exam trap, so the plate has to get it right.
      const LOOPS = h.chambers === 2 ? [
        [ANCH.pOut, [ANCH.pOut[0], topY1], [gasX - organR * 1.02, topY1],
         [gasX - organR * 1.02, hy + organR * 0.98], [gasX - organR * 0.72, hy + organR * 0.98]],
        [[gasX + organR * 0.62, hy - organR * 0.98], [gasX + organR * 0.62, topY2],
         [bodyX - organR * 1.02, topY2], [bodyX - organR * 1.02, hy - organR * 0.30]],
        [[bodyX + organR * 1.02, hy + organR * 0.30], [bodyX + organR * 1.28, hy + organR * 0.30],
         [bodyX + organR * 1.28, botY], [ANCH.sIn[0], botY]],
        [[ANCH.sIn[0], botY], ANCH.sIn]
      ] : [
        [ANCH.pOut, [ANCH.pOut[0] - sc * 0.3, botY], [gasX - organR * 0.72, botY],
         [gasX - organR * 0.72, hy + organR * 0.98]],
        [[gasX + organR * 0.62, hy - organR * 0.98], [gasX + organR * 0.62, topY1],
         [ANCH.pIn[0], topY1], ANCH.pIn],
        [ANCH.sOut, [ANCH.sOut[0] + sc * 0.3, botY], [bodyX - organR * 1.02, botY],
         [bodyX - organR * 1.02, hy - organR * 0.30]],
        [[bodyX + organR * 1.02, hy + organR * 0.30], [bodyX + organR * 1.28, hy + organR * 0.30],
         [bodyX + organR * 1.28, topY2], [ANCH.sIn[0], topY2], ANCH.sIn]
      ];
      const along = (pts, t) => {
        let total = 0; const seg = [];
        for (let i = 1; i < pts.length; i++) {
          const d = Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]);
          seg.push(d); total += d;
        }
        let want = clamp(t, 0, 1) * total;
        for (let i = 0; i < seg.length; i++) {
          if (want <= seg[i] || i === seg.length - 1) {
            const f = seg[i] > 0 ? clamp(want / seg[i], 0, 1) : 0;
            return [pts[i][0] + (pts[i + 1][0] - pts[i][0]) * f,
                    pts[i][1] + (pts[i + 1][1] - pts[i][1]) * f];
          }
          want -= seg[i];
        }
        return pts[pts.length - 1];
      };
      const pathPt = u => {
        const k = clamp(Math.floor(u * 4), 0, 3);
        return along(LOOPS[k], (u * 4) - k);
      };
      const satAt = u => {
        if (h.chambers === 2) return u < 0.25 ? 60 : u < 0.5 ? 95 : 60;
        return u < 0.25 ? 60 : u < 0.5 ? 98 : u < 0.75 ? S.satSystemic : 60;
      };
      // Round the corners, then run each loop through the tube renderer —
      // a vessel is a tube, and a 2px polyline never read as one.
      const round = (pts, rad) => {
        const out = [pts[0]];
        for (let i = 1; i < pts.length - 1; i++) {
          const a = pts[i - 1], b = pts[i], c = pts[i + 1];
          const d1 = Math.hypot(b[0] - a[0], b[1] - a[1]) || 1;
          const d2 = Math.hypot(c[0] - b[0], c[1] - b[1]) || 1;
          const r = Math.min(rad, d1 * 0.45, d2 * 0.45);
          const p1 = [b[0] + (a[0] - b[0]) / d1 * r, b[1] + (a[1] - b[1]) / d1 * r];
          const p2 = [b[0] + (c[0] - b[0]) / d2 * r, b[1] + (c[1] - b[1]) / d2 * r];
          for (let k = 0; k <= 8; k++) {
            const t = k / 8, u = 1 - t;
            out.push([u * u * p1[0] + 2 * u * t * b[0] + t * t * p2[0],
                      u * u * p1[1] + 2 * u * t * b[1] + t * t * p2[1]]);
          }
        }
        out.push(pts[pts.length - 1]);
        return out;
      };
      const vesselR = Math.max(3.2, sc * 0.075);
      LOOPS.forEach((pts, i) => {
        // a fish oxygenates on ONE limb only — the dorsal aorta
        const oxygenated = h.chambers === 2 ? (i === 1) : (i === 1 || i === 2);
        RXo.tube(ctx, round(pts, vesselR * 3.4), vesselR,
                 oxygenated ? OXY : DEOXY, { contour: 1 });
      });
      // vessel names — the exam asks for these by name, so they are labelled
      const NAMES = h.chambers === 2
        ? [[0.10, 'ventral aorta', DEOXY], [0.40, 'dorsal aorta', OXY], [0.78, 'cardinal vein', DEOXY]]
        : [[0.12, 'pulmonary artery', DEOXY], [0.40, 'pulmonary vein', OXY],
           [0.60, 'aorta', OXY], [0.90, 'vena cava', DEOXY]];
      NAMES.forEach(([u, name, col]) => {
        const a = pathPt(u), b = pathPt(u + 0.02);
        const ang = Math.atan2(b[1] - a[1], b[0] - a[0]);
        const nx = -Math.sin(ang), ny = Math.cos(ang);
        const side = (a[1] < hy) ? -1 : 1;
        const off = vesselR + 15;
        const lx = a[0] + nx * off * side, ly = a[1] + ny * off * side;
        Z.leader(ctx, a[0], a[1], lx, ly, col);
        // the caption continues in the same direction the leader left in,
        // so it can never fall back onto the vessel it names
        const ty = ly + (ny * side >= 0 ? 9 : -9);
        Z.lbl(ctx, lx, ty, name, col,
              lx > W * 0.72 ? 'right' : lx < W * 0.28 ? 'left' : 'center', 9);
      });
      // direction arrows
      [[0.18, 0], [0.43, 1], [0.68, 2], [0.93, 3]].forEach(([u, i]) => {
        const a = pathPt(u), b = pathPt(u + 0.012);
        const ang = Math.atan2(b[1] - a[1], b[0] - a[0]);
        ctx.fillStyle = '#F3F7FF';
        ctx.beginPath();
        ctx.moveTo(b[0] + vesselR * 1.1 * Math.cos(ang), b[1] + vesselR * 1.1 * Math.sin(ang));
        ctx.lineTo(b[0] - vesselR * Math.cos(ang - 0.7), b[1] - vesselR * Math.sin(ang - 0.7));
        ctx.lineTo(b[0] - vesselR * Math.cos(ang + 0.7), b[1] - vesselR * Math.sin(ang + 0.7));
        ctx.closePath(); ctx.fill();
      });
      if (p.particles) {
        // Blood, not beads: the lit-sphere shader washes out at this radius,
        // so each cell is its saturation colour with a single key highlight.
        S.parts.forEach(q => {
          const pos = pathPt(q.u), rr = vesselR * 0.66;
          const c = satCol(satAt(q.u));
          const gg = ctx.createRadialGradient(pos[0] - rr * .38, pos[1] - rr * .42, rr * .05,
                                              pos[0], pos[1], rr);
          gg.addColorStop(0, RXo.mix(c, '#ffffff', .82));
          gg.addColorStop(.50, RXo.mix(c, '#ffffff', .18));
          gg.addColorStop(1, RXo.mix(c, '#3A0A14', .30));
          ctx.fillStyle = gg;
          ctx.beginPath(); ctx.arc(pos[0], pos[1], rr, 0, TAU); ctx.fill();
        });
      }

      /* ---------------- header + verdict ---------------- */
      // the animal itself rides in the header band, where no part of the
      // circuit can ever reach it
      const px0 = 14, pw = 52;
      ART.draw(ctx, h.art, px0 + pw * 0.5, 40, Math.min(pw * 0.21, 13), h.hue, S.t, 0.95);
      const tx = px0 + pw + 12;
      ctx.textAlign = 'left'; ctx.textBaseline = 'top';
      ctx.font = '700 19px "IBM Plex Sans Condensed",sans-serif'; ctx.fillStyle = th.text;
      ctx.fillText(h.chambers + '-chambered  ·  ' + h.circ + ' circulation', tx, 6);
      ctx.font = '500 10px "IBM Plex Mono",monospace'; ctx.fillStyle = th['text-3'];
      ctx.fillText(h.klass + '  ·  ' + h.examples, tx, 29);
      ctx.fillStyle = S.mix > 0.01 ? th.warn : th.ok;
      ctx.fillText(S.mix > 0.01
        ? (S.mix * 100).toFixed(0) + '% mixing → systemic blood only ' + S.satSystemic.toFixed(1) + '% saturated'
        : 'no mixing → systemic blood ' + S.satSystemic.toFixed(1) + '% saturated', tx, 44);

      ctx.textAlign = 'right'; ctx.textBaseline = 'top';
      ctx.font = '600 11px "IBM Plex Mono",monospace';
      ctx.fillStyle = S.ok ? th.ok : th.crit;
      ctx.fillText(S.ok ? 'O₂ supply meets demand' : 'O₂ supply CANNOT meet demand', W - 14, 8);
      ctx.font = '9.5px "IBM Plex Mono",monospace'; ctx.fillStyle = th['text-3'];
      ctx.fillText('supply / demand = ' + S.margin.toFixed(2), W - 14, 25);
      ctx.fillText(h.thermo, W - 14, 39);
    },
    plots: [
      { title: 'Systemic oxygen saturation across the vertebrate classes',
        legend: [{ c: '#FF5E6C', label: 'oxygen saturation reaching the tissues' }],
        draw(S, g) {
          const P = g.Plot({
            xmin: -0.5, xmax: HEARTS.length - 0.5, ymin: 50, ymax: 104,
            xticks: HEARTS.map((_, i) => i), xfmt: v => (HEARTS[Math.round(v)] || { name: '' }).name,
            ylabel: 'saturation (%)', yfmt: v => v.toFixed(0),
            pad: { l: 46, r: 14, t: 14, b: 34 }
          }).frame();
          P.clip(() => {
            HEARTS.forEach((h, i) => {
              const sat = h.chambers === 2 ? 95 : 98 * (1 - h.mix) + 79 * h.mix;
              const on = h.id === S.p.type;
              P.bar(i, sat, 0.3, 50, g.alpha(on ? '#FF5E6C' : '#8A5560', on ? .95 : .5));
              P.tag(i, sat, sat.toFixed(0) + '%', on ? g.theme.text : g.theme['text-3'], 'left', -9);
              P.tag(i, 53, h.chambers + '-ch', g.theme['text-3'], 'left', 0);
            });
            P.hline(98, g.alpha(g.theme.ok, .8), [4, 3]);
          });
          P.tag(0, 98, 'fully separated blood', g.theme.ok, 'left', -9);
        },
        hover(S, x) {
          const h = HEARTS[clamp(Math.round(x), 0, HEARTS.length - 1)];
          const sat = h.chambers === 2 ? 95 : 98 * (1 - h.mix) + 79 * h.mix;
          return [{ label: 'class', value: h.name },
                  { label: 'chambers', value: String(h.chambers) },
                  { label: 'mixing', value: (h.mix * 100).toFixed(0) + '%' },
                  { label: 'systemic saturation', value: sat.toFixed(1) + '%', color: '#FF5E6C' }];
        } },
      { title: 'Oxygen supply against metabolic demand — why endothermy needs four chambers',
        legend: [{ c: '#4ADE80', label: 'supply' }, { c: '#FB7185', label: 'demand' }],
        draw(S, g) {
          const p = S.p;
          const q10 = Math.pow(2.3, (p.temp - 25) / 10);
          const rows = HEARTS.map(h => {
            const mix = h.mix;
            const sat = h.chambers === 2 ? 95 : 98 * (1 - mix) + 79 * mix;
            const supply = (sat / 98) * h.pressureAfter *
              (h.chambers === 4 ? 12 : h.chambers === 3 ? 4.2 : 2.6) * clamp(p.activity, 0.3, 3.5);
            const demand = (h.thermo === 'Homeothermous' ? 10 : 1.0 * q10) * p.activity;
            return { h, supply, demand };
          });
          const mx = Math.max.apply(null, rows.map(r => Math.max(r.supply, r.demand))) * 1.15;
          const P = g.Plot({
            xmin: -0.5, xmax: HEARTS.length - 0.5, ymin: 0, ymax: mx,
            xticks: HEARTS.map((_, i) => i), xfmt: v => (HEARTS[Math.round(v)] || { name: '' }).name,
            ylabel: 'relative O₂ units', yfmt: v => v.toFixed(0),
            pad: { l: 46, r: 14, t: 14, b: 34 }
          }).frame();
          P.clip(() => {
            rows.forEach((r, i) => {
              P.bar(i - 0.16, r.supply, 0.14, 0, g.alpha(g.theme.ok, r.h.id === S.p.type ? .95 : .45));
              P.bar(i + 0.16, r.demand, 0.14, 0, g.alpha(g.theme.crit, r.h.id === S.p.type ? .95 : .45));
            });
          });
          P.tag(0, mx * 0.93, 'green ≥ red means the animal can sustain this state',
            g.theme['text-3'], 'left', 0);
        },
        hover(S, x) {
          const p = S.p, q10 = Math.pow(2.3, (p.temp - 25) / 10);
          const h = HEARTS[clamp(Math.round(x), 0, HEARTS.length - 1)];
          const sat = h.chambers === 2 ? 95 : 98 * (1 - h.mix) + 79 * h.mix;
          const supply = (sat / 98) * h.pressureAfter *
            (h.chambers === 4 ? 12 : h.chambers === 3 ? 4.2 : 2.6) * clamp(p.activity, 0.3, 3.5);
          const demand = (h.thermo === 'Homeothermous' ? 10 : 1.0 * q10) * p.activity;
          return [{ label: 'class', value: h.name },
                  { label: 'supply', value: supply.toFixed(2), color: '#4ADE80' },
                  { label: 'demand', value: demand.toFixed(2), color: '#FB7185' },
                  { label: 'verdict', value: supply >= demand ? 'sustainable' : 'not sustainable' }];
        } }
    ],

    readouts(S) {
      const h = S.h, p = S.p;
      return [
        { label: 'Chambers', value: String(h.chambers), unit: '', flag: 'accent' },
        { label: 'Circulation', value: h.circ, unit: '' },
        { label: 'Blood mixing', value: (S.mix * 100).toFixed(0), unit: '%',
          flag: S.mix > 0.3 ? 'crit' : S.mix > 0.01 ? 'warn' : 'ok' },
        { label: 'Systemic O₂ saturation', value: S.satSystemic.toFixed(1), unit: '%', flag: 'accent' },
        { label: 'Gas exchange', value: h.gas, unit: '' },
        { label: 'Thermoregulation', value: h.thermo, unit: '',
          flag: h.thermo === 'Homeothermous' ? 'ok' : '' },
        { label: 'Metabolic demand', value: S.demand.toFixed(2), unit: 'units',
          hint: h.thermo === 'Homeothermous' ? 'constant — must heat the body' : 'rises with temperature' },
        { label: 'O₂ supply capacity', value: S.supply.toFixed(2), unit: 'units' },
        { label: 'Supply / demand', value: S.margin.toFixed(2), unit: '×',
          flag: S.ok ? 'ok' : 'crit', hint: S.ok ? 'sustainable' : 'the animal must slow down' },
        { label: 'Examples', value: h.examples, unit: '' }
      ];
    },

    equation(S) {
      const h = S.h;
      return 'systemic saturation ' + E.op('=') + ' 98%' + E.op('×') + '(1 ' + E.op('−') + ' mixing) ' +
        E.op('+') + ' 79%' + E.op('×') + 'mixing' +
        '<br>' + E.op('=') + ' 98' + E.op('×') + E.n((1 - S.mix).toFixed(2), '') + E.op('+') +
        ' 79' + E.op('×') + E.n(S.mix.toFixed(2), '') + ' ' + E.op('=') + ' ' +
        E.n(S.satSystemic.toFixed(1), '%') +
        '<br>demand ' + E.op('=') + ' ' + (h.thermo === 'Homeothermous'
          ? E.n('10', ' (endothermic baseline)')
          : E.n('1', '') + E.op('×') + E.v('Q') + '₁₀<sup>(T−25)/10</sup>') +
        E.op('×') + ' activity ' + E.op('=') + ' ' + E.n(S.demand.toFixed(2), '') +
        E.op('·') + ' supply ' + E.op('=') + ' ' + E.n(S.supply.toFixed(2), '');
    },
    eqNote: '<b>The four-chambered heart is a precondition for warm blood, not a consequence of it.</b> ' +
      'Maintaining a constant body temperature costs roughly ten times the resting oxygen of an ectotherm of ' +
      'the same size. No heart that mixes its two blood streams can deliver that — which is why birds and ' +
      'mammals, the only homeotherms, are also the only classes with completely divided hearts.',

    walkthrough: [
      { title: '1 · One circuit, one pass',
        body: 'Start with a fish and follow a blood particle all the way round.',
        ask: 'How many times does blood pass through the heart in one complete circuit?',
        reveal: '<b>Once</b> — this is <b>single circulation</b>. Blood goes heart → gills → body → heart. The problem is that the gills are a capillary bed, so blood leaves them at low pressure and then has to supply the whole body with what is left.',
        params: { type: 'fish', activity: 1 } },
      { title: '2 · Two circuits, but one ventricle',
        body: 'Switch to an amphibian. Now there are two atria but still only one ventricle.',
        ask: 'What does the animal gain, and what does it lose?',
        reveal: 'It <b>gains</b> pressure — blood returns to the heart after the lungs and gets a second push before going to the body. It <b>loses</b> purity: oxygenated and deoxygenated blood meet in the single ventricle. A spiral valve limits the damage, but systemic saturation still drops to about 91%.',
        params: { type: 'amphibian', activity: 1 } },
      { title: '3 · The partial septum',
        body: 'Move to a reptile and compare the mixing readout with the amphibian.',
        ask: 'How does a reptile do better than a frog with the same number of chambers?',
        reveal: 'An <b>incomplete septum</b> partly divides the ventricle, so the two streams keep more of their identity. Mixing falls from about 35% to about 20%. NCERT also names the exception explicitly — the <b>crocodile has a four-chambered heart</b>.',
        params: { type: 'reptile', activity: 1 } },
      { title: '4 · Complete separation',
        body: 'Switch to a bird or a mammal.',
        ask: 'The septum is complete. What does that buy?',
        reveal: 'Systemic blood at <b>full 98% saturation</b>, plus two circuits at independent pressures — a high-pressure systemic circuit to reach the whole body and a low-pressure pulmonary circuit that will not damage the delicate lungs. One pump, two jobs, no compromise.',
        params: { type: 'bird', activity: 1 } },
      { title: '5 · Why it matters — try to make a frog warm-blooded',
        body: 'Look at the supply-versus-demand chart, then raise the activity level with an amphibian selected.',
        ask: 'Could a three-chambered animal sustain a constant body temperature?',
        reveal: '<b>No.</b> Endothermy costs roughly ten times an ectotherm\'s resting oxygen consumption. With mixed blood and a single ventricle, supply falls far short. That is the real answer to "why are only birds and mammals warm-blooded" — and it is a favourite assertion–reason question.',
        params: { type: 'amphibian', activity: 3.2, temp: 25 } },
      { title: '6 · The diving crocodile',
        body: 'Select the crocodile and open the pulmonary shunt.',
        ask: 'Why would an animal deliberately send blood past its own lungs?',
        reveal: 'Because underwater the lungs are useless. A diving crocodile <b>shunts blood away from the pulmonary circuit</b>, saving the work of pumping through lungs that cannot oxygenate anything. Watch mixing rise and saturation fall — a cost it accepts for the duration of the dive.',
        params: { type: 'croc', activity: 0.5, shunt: 0.7 } }
    ],

    quiz: [
      { q: 'A three-chambered heart with two atria and one ventricle is found in:',
        options: ['fishes', 'amphibians', 'birds', 'mammals'], answer: 1,
        why: 'Amphibians have two atria and a single ventricle, so some mixing of oxygenated and deoxygenated blood is unavoidable.' },
      { q: 'Which reptile has a four-chambered heart?',
        options: ['Naja', 'Chelone', 'Crocodilus', 'Calotes'], answer: 2,
        why: 'The crocodile is the standard NCERT exception — every other reptile has a three-chambered heart.' },
      { q: 'Single circulation, in which blood passes through the heart only once per circuit, occurs in:',
        options: ['fishes', 'amphibians', 'reptiles', 'birds'], answer: 0,
        why: 'In fishes blood flows heart → gills → body → heart, passing through the heart once.' },
      { q: 'Homeothermy in birds and mammals is possible mainly because they have:',
        options: ['scales', 'completely separated oxygenated and deoxygenated blood',
                  'a three-chambered heart', 'gills'], answer: 1,
        why: 'A fully divided four-chambered heart delivers fully saturated blood at high pressure, which is what a tenfold metabolic rate requires.' }
    ],

    notes: '<b>Where this shows up in the paper.</b>' +
      '<ul><li>Number of heart chambers per class — one of the most frequently asked single facts in the chapter.</li>' +
      '<li>The crocodile exception, asked almost every year in some form.</li>' +
      '<li>Single versus double circulation, and which classes show each.</li>' +
      '<li>Poikilothermous versus homeothermous, and which classes are which.</li></ul>' +
      '<div class="pyq"><em>Trap to avoid</em>Fishes have a <b>two-chambered</b> heart, not a "half" heart, and ' +
      'the blood in it is entirely <b>deoxygenated</b> — the heart pumps to the gills, not from them. Also note ' +
      'that lungfishes and amphibians are described as having double circulation even though it is incomplete.</div>'
  });

  /* =========================================================================
     8 · CHORDATE CHARACTERS AND THE CLADOGRAM
     ========================================================================= */
  const CHARS = [
    { id: 'notochord', label: 'Notochord' },
    { id: 'nerve', label: 'Dorsal hollow nerve cord' },
    { id: 'gill', label: 'Pharyngeal gill slits' },
    { id: 'tail', label: 'Post-anal tail' },
    { id: 'column', label: 'Vertebral column' },
    { id: 'jaws', label: 'Jaws' },
    { id: 'limbs', label: 'Two pairs of limbs' },
    { id: 'amnion', label: 'Amniotic egg' },
    { id: 'four', label: 'Four-chambered heart' },
    { id: 'endo', label: 'Homeothermy' }
  ];
  // 2 = present throughout life, 1 = present only in larva / embryo, 0 = absent
  const TAXA = [
    { id: 'hemi', name: 'Hemichordata', ex: 'Balanoglossus', hue: '#7FBF9B', depth: 0,
      c: { notochord: 0, nerve: 1, gill: 2, tail: 0, column: 0, jaws: 0, limbs: 0, amnion: 0, four: 0, endo: 0 },
      note: 'A stomochord, not a true notochord — which is why it was moved out of Chordata.' },
    { id: 'uro', name: 'Urochordata', ex: 'Ascidia, Salpa, Doliolum', hue: '#B07CC6', depth: 1,
      c: { notochord: 1, nerve: 1, gill: 2, tail: 1, column: 0, jaws: 0, limbs: 0, amnion: 0, four: 0, endo: 0 },
      note: 'Notochord only in the larval tail; the adult is sessile and degenerate — retrogressive metamorphosis.' },
    { id: 'ceph', name: 'Cephalochordata', ex: 'Branchiostoma', hue: '#8B9BE8', depth: 1,
      c: { notochord: 2, nerve: 2, gill: 2, tail: 2, column: 0, jaws: 0, limbs: 0, amnion: 0, four: 0, endo: 0 },
      note: 'Notochord runs head to tail and persists for life — the clearest chordate of all.' },
    { id: 'cyclo', name: 'Cyclostomata', ex: 'Petromyzon, Myxine', hue: '#7A8FB8', depth: 2,
      c: { notochord: 2, nerve: 2, gill: 2, tail: 2, column: 2, jaws: 0, limbs: 0, amnion: 0, four: 0, endo: 0 },
      note: 'Vertebral column present but cartilaginous; jawless, with a sucking circular mouth.' },
    { id: 'chond', name: 'Chondrichthyes', ex: 'Scoliodon, Pristis', hue: '#5E8CA8', depth: 3,
      c: { notochord: 2, nerve: 2, gill: 2, tail: 2, column: 2, jaws: 2, limbs: 0, amnion: 0, four: 0, endo: 0 },
      note: 'Notochord persists throughout life alongside a cartilaginous column. No air bladder.' },
    { id: 'osteo', name: 'Osteichthyes', ex: 'Labeo, Hippocampus', hue: '#4E9CC0', depth: 4,
      c: { notochord: 1, nerve: 2, gill: 2, tail: 2, column: 2, jaws: 2, limbs: 0, amnion: 0, four: 0, endo: 0 },
      note: 'Bony skeleton, operculum covering the gills, and an air bladder for buoyancy.' },
    { id: 'amph', name: 'Amphibia', ex: 'Rana, Bufo', hue: '#6FAE6F', depth: 5,
      c: { notochord: 1, nerve: 2, gill: 1, tail: 1, column: 2, jaws: 2, limbs: 2, amnion: 0, four: 0, endo: 0 },
      note: 'Gills in the larva, lungs and skin in the adult. Tied to water for reproduction.' },
    { id: 'rept', name: 'Reptilia', ex: 'Naja, Crocodilus', hue: '#9BA84E', depth: 6,
      c: { notochord: 1, nerve: 2, gill: 1, tail: 2, column: 2, jaws: 2, limbs: 2, amnion: 2, four: 0, endo: 0 },
      note: 'The amniotic egg frees reproduction from water. Crocodile has four heart chambers.' },
    { id: 'aves', name: 'Aves', ex: 'Columba, Pavo', hue: '#E8B64C', depth: 7,
      c: { notochord: 1, nerve: 2, gill: 1, tail: 2, column: 2, jaws: 2, limbs: 2, amnion: 2, four: 2, endo: 2 },
      note: 'Feathers, pneumatic bones, air sacs, four-chambered heart and homeothermy.' },
    { id: 'mamm', name: 'Mammalia', ex: 'Homo, Elephas', hue: '#C4785E', depth: 7,
      c: { notochord: 1, nerve: 2, gill: 1, tail: 1, column: 2, jaws: 2, limbs: 2, amnion: 2, four: 2, endo: 2 },
      note: 'Mammary glands and hair. Four-chambered heart and homeothermy evolved separately from birds.' }
  ];
  const NODES = [
    { at: 1, label: 'CHORDATA', gains: 'notochord · dorsal hollow nerve cord · gill slits · post-anal tail' },
    { at: 2, label: 'Vertebrata', gains: 'vertebral column, cranium' },
    { at: 3, label: 'Gnathostomata', gains: 'jaws, paired fins' },
    { at: 5, label: 'Tetrapoda', gains: 'two pairs of limbs' },
    { at: 6, label: 'Amniota', gains: 'amniotic egg' },
    { at: 7, label: '(convergent)', gains: 'four-chambered heart + homeothermy — evolved twice, independently' }
  ];

  L.register({
    id: 'ak-chordata', subject: 'biology',
    name: 'Chordate Characters and the Vertebrate Tree',
    chapter: 'Animal Kingdom',
    exams: ['NEET UG'],
    weight: 'Very high yield',
    is3D: false,
    stageHint: 'Pick a character and every branch that has it lights up — that is what a shared derived character means',
    lede: 'Four characters define Chordata: a <b>notochord</b>, a <b>dorsal hollow nerve cord</b>, ' +
      '<b>paired pharyngeal gill slits</b> and a <b>post-anal tail</b>. What makes the group hard to remember is ' +
      'that several of them are present only in the <b>larva</b> or the <b>embryo</b>. ' +
      'This tree marks where each character is gained, and distinguishes "present for life" from "present only ' +
      'in the larva" — exactly the distinction examiners test.',

    params: { taxon: 'mamm', highlight: 'notochord', stage: 'adult', showNodes: true },

    presets: [
      { name: 'The four chordate characters', params: { highlight: 'notochord', taxon: 'ceph' } },
      { name: 'Urochordate larva vs adult', params: { taxon: 'uro', highlight: 'notochord' } },
      { name: 'Where jaws appear', params: { highlight: 'jaws', taxon: 'chond' } },
      { name: 'The amniotic egg', params: { highlight: 'amnion', taxon: 'rept' } },
      { name: 'Warm blood, twice over', params: { highlight: 'endo', taxon: 'aves' } }
    ],

    controls: [
      { group: 'Tree', items: [
        { key: 'taxon', type: 'select', label: 'Taxon', restructure: true,
          options: TAXA.map(t => ({ value: t.id, label: t.name.slice(0, 9) })) },
        { key: 'showNodes', type: 'toggle', label: 'Show where each character is gained' }
      ] },
      { group: 'Character', items: [
        { key: 'highlight', type: 'select', label: 'Highlight character', restructure: true,
          options: CHARS.map(c => ({ value: c.id, label: c.label.split(' ')[0] })) }
      ] }
    ],

    setup(S) {
      S.taxon = TAXA.find(t => t.id === S.p.taxon) || TAXA[9];
      S.char = CHARS.find(c => c.id === S.p.highlight) || CHARS[0];
      S.withChar = TAXA.filter(t => t.c[S.char.id] > 0);
      S.forLife = TAXA.filter(t => t.c[S.char.id] === 2);
    },

    step(S, dt) { S.t = (S.t || 0) + dt; },

    drawStage(S, g) {
      const ctx = g.ctx, th = g.theme, p = S.p, W = g.w, H = g.h;
      const padL = 16, padR = W * 0.30, padT = 34, padB = 22;
      const maxDepth = 7;
      const X = d => padL + (d / maxDepth) * (W - padL - padR);
      const rowH = (H - padT - padB) / TAXA.length;
      const Y = i => padT + i * rowH + rowH / 2;

      /* ---- backbone and branches ---- */
      ctx.lineCap = 'round';
      TAXA.forEach((t, i) => {
        const has = t.c[S.char.id];
        const branchCol = has === 2 ? th.ok : has === 1 ? th.warn : g.alpha(th['text-3'], .55);
        // stem from its node depth back to the spine
        ctx.strokeStyle = g.alpha(th['line'], 1); ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(X(Math.max(0, t.depth - 1)), Y(i));
        ctx.lineTo(X(t.depth), Y(i));
        ctx.stroke();
        // vertical connector to the previous taxon at the same or lower depth
        if (i > 0) {
          ctx.beginPath();
          ctx.moveTo(X(Math.max(0, t.depth - 1)), Y(i));
          ctx.lineTo(X(Math.max(0, t.depth - 1)), Y(i - 1));
          ctx.stroke();
        }
        // the highlighted-character overlay
        ctx.strokeStyle = branchCol; ctx.lineWidth = has ? 3.4 : 1.2;
        ctx.beginPath();
        ctx.moveTo(X(t.depth), Y(i));
        ctx.lineTo(X(maxDepth) + 6, Y(i));
        ctx.stroke();
        if (has === 1) {
          ctx.save(); ctx.setLineDash([4, 4]); ctx.strokeStyle = th.warn; ctx.lineWidth = 3.4;
          ctx.beginPath(); ctx.moveTo(X(t.depth), Y(i)); ctx.lineTo(X(maxDepth) + 6, Y(i)); ctx.stroke();
          ctx.restore();
        }

        // tip label and art
        const sel = t.id === p.taxon;
        ART.draw(ctx, artFor(t.id), X(maxDepth) + 26, Y(i), Math.min(rowH * 0.40, 17), t.hue, S.t, sel ? 1 : .55);
        ctx.font = (sel ? '700 ' : '500 ') + '11.5px "IBM Plex Sans",sans-serif';
        ctx.fillStyle = sel ? th.text : th['text-2'];
        ctx.textAlign = 'left'; ctx.textBaseline = 'middle';
        ctx.fillText(t.name, X(maxDepth) + 48, Y(i) - 5);
        ctx.font = '9px "IBM Plex Mono",monospace'; ctx.fillStyle = th['text-3'];
        ctx.fillText(t.ex, X(maxDepth) + 48, Y(i) + 8);
        if (sel) {
          ctx.strokeStyle = g.alpha(t.hue, .9); ctx.lineWidth = 1.5;
          if (ctx.roundRect) { ctx.beginPath(); ctx.roundRect(X(maxDepth) + 8, Y(i) - rowH * .44, W - (X(maxDepth) + 14), rowH * .88, 7); ctx.stroke(); }
        }
      });

      /* ---- node labels ---- */
      if (p.showNodes) {
        NODES.forEach(n => {
          const x = X(Math.max(0, n.at - 1));
          const idxs = TAXA.map((t, i) => t.depth >= n.at ? i : -1).filter(i => i >= 0);
          if (!idxs.length) return;
          const y0 = Y(idxs[0]), y1 = Y(idxs[idxs.length - 1]);
          ctx.fillStyle = th.bio;
          ctx.beginPath(); ctx.arc(x, (y0 + y1) / 2, 4, 0, TAU); ctx.fill();
          ctx.save();
          ctx.translate(x - 5, (y0 + y1) / 2); ctx.rotate(-Math.PI / 2);
          ctx.font = '600 9.5px "IBM Plex Mono",monospace';
          ctx.fillStyle = n.label === 'CHORDATA' ? th.bio : th['text-2'];
          ctx.textAlign = 'center'; ctx.textBaseline = 'bottom';
          ctx.fillText(n.label, 0, 0);
          ctx.restore();
        });
      }

      /* ---- header ---- */
      ctx.textAlign = 'left'; ctx.textBaseline = 'top';
      ctx.font = '700 17px "IBM Plex Sans Condensed",sans-serif'; ctx.fillStyle = th.text;
      ctx.fillText(S.char.label, 14, 8);
      ctx.font = '500 9.5px "IBM Plex Mono",monospace';
      ctx.fillStyle = th.ok;
      ctx.fillText('━ throughout life', 180, 10);
      ctx.fillStyle = th.warn;
      ctx.fillText('╌ larva / embryo only', 300, 10);
      ctx.fillStyle = th['text-3'];
      ctx.fillText('─ absent', 440, 10);
    },

    plots: [
      { title: 'Character matrix — present for life, present only in the larva, or absent',
        legend: [{ c: '#4ADE80', label: 'throughout life' }, { c: '#FBBF24', label: 'larva / embryo only' },
                 { c: '#3A4766', label: 'absent' }],
        draw(S, g) {
          const P = g.Plot({
            xmin: -0.5, xmax: CHARS.length - 0.5, ymin: -0.5, ymax: TAXA.length - 0.5,
            xticks: CHARS.map((_, i) => i), yticks: TAXA.map((_, i) => i),
            xfmt: v => (CHARS[Math.round(v)] || { label: '' }).label.split(' ')[0],
            yfmt: v => (TAXA[Math.round(v)] || { name: '' }).name,
            pad: { l: 112, r: 14, t: 12, b: 34 }
          }).frame();
          const cw = (P.x1 - P.x0) / CHARS.length, chh = (P.y0 - P.y1) / TAXA.length;
          P.clip(() => {
            TAXA.forEach((t, r) => CHARS.forEach((c, k) => {
              const v = t.c[c.id];
              const col = v === 2 ? '#4ADE80' : v === 1 ? '#FBBF24' : '#3A4766';
              const x = P.X(k) - cw / 2 + 1, y = P.Y(r) - chh / 2 + 1;
              g.ctx.fillStyle = g.alpha(col, v ? .85 : .35);
              g.ctx.fillRect(x, y, cw - 2, chh - 2);
              if (c.id === S.p.highlight || t.id === S.p.taxon) {
                g.ctx.strokeStyle = g.alpha('#E7EDFB', c.id === S.p.highlight && t.id === S.p.taxon ? .95 : .4);
                g.ctx.lineWidth = 1.4;
                g.ctx.strokeRect(x + .7, y + .7, cw - 3.4, chh - 3.4);
              }
            }));
          });
        },
        hover(S, x, y) {
          const k = clamp(Math.round(x), 0, CHARS.length - 1);
          const r = clamp(Math.round(y), 0, TAXA.length - 1);
          const v = TAXA[r].c[CHARS[k].id];
          return [{ label: 'taxon', value: TAXA[r].name, color: TAXA[r].hue },
                  { label: 'character', value: CHARS[k].label },
                  { label: 'state', value: v === 2 ? 'present throughout life' : v === 1 ? 'larva / embryo only' : 'absent' },
                  { label: 'example', value: TAXA[r].ex }];
        } },
      { title: 'How many of these characters each group carries',
        legend: [{ c: '#4ADE80', label: 'for life' }, { c: '#FBBF24', label: 'larva only' }],
        draw(S, g) {
          const P = g.Plot({
            xmin: -0.5, xmax: TAXA.length - 0.5, ymin: 0, ymax: CHARS.length + 0.6,
            xticks: TAXA.map((_, i) => i), xfmt: v => (TAXA[Math.round(v)] || { name: '' }).name.slice(0, 7),
            ylabel: 'characters present', yfmt: v => v.toFixed(0),
            pad: { l: 46, r: 14, t: 14, b: 36 }
          }).frame();
          P.clip(() => {
            TAXA.forEach((t, i) => {
              const forLife = CHARS.filter(c => t.c[c.id] === 2).length;
              const larval = CHARS.filter(c => t.c[c.id] === 1).length;
              const on = t.id === S.p.taxon;
              P.bar(i, forLife, 0.3, 0, g.alpha('#4ADE80', on ? .95 : .45));
              g.ctx.save();
              const x0 = P.X(i - 0.3), x1 = P.X(i + 0.3);
              g.ctx.fillStyle = g.alpha('#FBBF24', on ? .9 : .4);
              g.ctx.fillRect(x0 + 1, P.Y(forLife + larval), x1 - x0 - 2, P.Y(forLife) - P.Y(forLife + larval));
              g.ctx.restore();
              P.tag(i, forLife + larval, String(forLife + larval), on ? g.theme.text : g.theme['text-3'], 'left', -9);
            });
          });
        },
        hover(S, x) {
          const t = TAXA[clamp(Math.round(x), 0, TAXA.length - 1)];
          return [{ label: 'taxon', value: t.name, color: t.hue },
                  { label: 'for life', value: String(CHARS.filter(c => t.c[c.id] === 2).length), color: '#4ADE80' },
                  { label: 'larva only', value: String(CHARS.filter(c => t.c[c.id] === 1).length), color: '#FBBF24' },
                  { label: 'note', value: t.note }];
        } }
    ],

    readouts(S) {
      const t = S.taxon, c = S.char;
      const st = t.c[c.id];
      return [
        { label: 'Taxon', value: t.name, unit: '', flag: 'accent', hint: t.ex },
        { label: c.label, value: st === 2 ? 'Throughout life' : st === 1 ? 'Larva / embryo only' : 'Absent',
          unit: '', flag: st === 2 ? 'ok' : st === 1 ? 'warn' : 'crit' },
        { label: 'Groups with it', value: String(S.withChar.length) + ' of ' + TAXA.length, unit: '' },
        { label: 'Of those, for life', value: String(S.forLife.length), unit: '' },
        { label: 'Notochord', value: state(t.c.notochord), unit: '' },
        { label: 'Dorsal nerve cord', value: state(t.c.nerve), unit: '' },
        { label: 'Gill slits', value: state(t.c.gill), unit: '' },
        { label: 'Post-anal tail', value: state(t.c.tail), unit: '' },
        { label: 'Chordate?', value: t.id === 'hemi' ? 'No — separate phylum' : 'Yes', unit: '',
          flag: t.id === 'hemi' ? 'crit' : 'ok' },
        { label: 'Key point', value: t.note, unit: '' }
      ];
    },

    equation(S) {
      const t = S.taxon;
      return 'Chordata ' + E.op('=') + ' notochord ' + E.op('∧') + ' dorsal hollow nerve cord ' +
        E.op('∧') + ' pharyngeal gill slits ' + E.op('∧') + ' post-anal tail' +
        '<br>' + E.n(t.name, '') + E.op(':') + ' notochord ' + E.op('=') + ' ' + E.n(state(t.c.notochord), '') +
        E.op(',') + ' nerve cord ' + E.op('=') + ' ' + E.n(state(t.c.nerve), '') +
        E.op(',') + ' gill slits ' + E.op('=') + ' ' + E.n(state(t.c.gill), '') +
        E.op(',') + ' tail ' + E.op('=') + ' ' + E.n(state(t.c.tail), '') +
        '<br>all vertebrates are chordates ' + E.op('·') + ' not all chordates are vertebrates';
    },
    eqNote: '<b>The sentence to carry into the exam:</b> "All vertebrates are chordates, but all chordates are ' +
      'not vertebrates." Urochordates and cephalochordates are chordates without a vertebral column — and ' +
      'hemichordates are not chordates at all, because a stomochord is not a notochord.',

    walkthrough: [
      { title: '1 · The four defining characters',
        body: 'Select Cephalochordata and step the highlighted character through notochord, nerve cord, gill slits and tail.',
        ask: 'Why is Branchiostoma the textbook chordate?',
        reveal: 'Because it shows <b>all four characters, throughout life</b> — every row is green. In vertebrates several of them are transient, which is exactly what makes the group confusing. Amphioxus is the uncluttered version.',
        params: { taxon: 'ceph', highlight: 'notochord' } },
      { title: '2 · The larva gives the game away',
        body: 'Switch to Urochordata and look at the notochord row.',
        ask: 'An adult sea squirt is a sessile bag. What makes it a chordate at all?',
        reveal: 'Its <b>larva</b>. The free-swimming tadpole larva has a notochord in its tail, a dorsal nerve cord and a post-anal tail; the adult loses them in <b>retrogressive metamorphosis</b>. Only the gill slits survive. Classification follows the larva, not the adult.',
        params: { taxon: 'uro', highlight: 'notochord' } },
      { title: '3 · Hemichordates were demoted',
        body: 'Select Hemichordata and check the notochord row.',
        ask: 'Why is Balanoglossus no longer placed inside Chordata?',
        reveal: 'Because what was taken for a notochord is a <b>stomochord</b> — an outgrowth of the gut, not a true notochord. NCERT now lists Hemichordata as a <b>separate phylum</b>, so a question asking for the "phylum with a stomochord" is testing exactly this.',
        params: { taxon: 'hemi', highlight: 'notochord' } },
      { title: '4 · Reading the tree',
        body: 'Turn on the node labels and highlight jaws, then limbs, then the amniotic egg.',
        ask: 'What does the position of a character on the tree tell you?',
        reveal: 'Where it was <b>gained</b>, and therefore which groups share it by inheritance. Jaws appear once, at Gnathostomata; limbs once, at Tetrapoda; the amniotic egg once, at Amniota — and that egg is what finally released vertebrates from breeding in water.',
        params: { highlight: 'amnion', taxon: 'rept', showNodes: true } },
      { title: '5 · The same answer twice',
        body: 'Now highlight homeothermy and the four-chambered heart.',
        ask: 'Birds and mammals share both. Did they inherit them from a common ancestor?',
        reveal: '<b>No — this is convergent evolution.</b> The two lineages separated long before either became warm-blooded, and each arrived at a fully divided heart independently. The crocodile\'s four-chambered heart is a <i>third</i> independent arrival.',
        params: { highlight: 'endo', taxon: 'aves', showNodes: true } }
    ],

    quiz: [
      { q: 'Which of these is NOT a fundamental chordate character?',
        options: ['Notochord', 'Dorsal hollow nerve cord', 'Pharyngeal gill slits', 'Ventral solid nerve cord'], answer: 3,
        why: 'A ventral solid nerve cord is the non-chordate condition, seen in annelids and arthropods. Chordates have a dorsal, hollow, single nerve cord.' },
      { q: 'In Urochordata the notochord is present:',
        options: ['throughout life', 'only in the larval tail', 'only in the adult', 'never'], answer: 1,
        why: 'The larva has a notochord in its tail; the sessile adult loses it in retrogressive metamorphosis.' },
      { q: 'Balanoglossus belongs to:',
        options: ['Urochordata', 'Cephalochordata', 'Hemichordata', 'Vertebrata'], answer: 2,
        why: 'Hemichordata is now a separate phylum — its stomochord is not a true notochord.' },
      { q: 'In which group is the notochord replaced by a vertebral column in the adult?',
        options: ['Urochordata', 'Cephalochordata', 'Vertebrata', 'Hemichordata'], answer: 2,
        why: 'Vertebrates have a notochord as embryos; it is replaced by a cartilaginous or bony vertebral column.' }
    ],

    notes: '<b>Where this shows up in the paper.</b>' +
      '<ul><li>The four chordate characters — asked directly, and as "which is not a chordate character".</li>' +
      '<li>Urochordata: notochord in the larval tail only, and retrogressive metamorphosis.</li>' +
      '<li>Hemichordata as a separate phylum with a stomochord.</li>' +
      '<li>"All vertebrates are chordates but all chordates are not vertebrates" — a standard assertion–reason pair.</li></ul>' +
      '<div class="pyq"><em>Trap to avoid</em>The nerve cord of a chordate is <b>dorsal, hollow and single</b>. ' +
      'In annelids and arthropods it is <b>ventral, solid and double</b>. Getting one adjective wrong loses the mark.</div>'
  });

  function state(v) { return v === 2 ? 'Throughout life' : v === 1 ? 'Larva / embryo only' : 'Absent'; }
  function artFor(id) {
    return { hemi: 'acornworm', uro: 'vase', ceph: 'bonyfish', cyclo: 'lamprey', chond: 'shark',
      osteo: 'bonyfish', amph: 'frog', rept: 'lizard', aves: 'bird', mamm: 'mammal' }[id] || 'bonyfish';
  }

})(window.InsightLab, window.ANIMALIA, window.ANIMALART);
