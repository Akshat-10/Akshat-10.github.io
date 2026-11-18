/* Akshat Gupta — portfolio: 3D scenes and the animations that never stop.
   Self-contained (no libraries). Every loop pauses while its section is off screen,
   and reduced-motion visitors get the same content as a still frame. */
(function () {
  'use strict';

  var reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var $ = function (sel, ctx) { return (ctx || document).querySelector(sel); };
  var $$ = function (sel, ctx) { return Array.prototype.slice.call((ctx || document).querySelectorAll(sel)); };
  var clamp = function (v, lo, hi) { return Math.max(lo, Math.min(hi, v)); };

  // Reports whether an element is near the viewport, so its animation loop can sleep otherwise.
  function watch(el, onChange) {
    if (!('IntersectionObserver' in window)) { onChange(true); return; }
    new IntersectionObserver(function (entries) {
      onChange(entries[entries.length - 1].isIntersecting);
    }, { rootMargin: '160px 0px' }).observe(el);
  }

  /* ---------- pointer tilt: eases CSS variables toward the pointer position ---------- */

  var tilts = [];
  var tiltRaf = 0;
  function tiltLoop() {
    var busy = false;
    tilts.forEach(function (t) {
      t.cx += (t.tx - t.cx) * 0.09;
      t.cy += (t.ty - t.cy) * 0.09;
      if (Math.abs(t.tx - t.cx) > 0.002 || Math.abs(t.ty - t.cy) > 0.002) busy = true;
      t.apply(t.cx, t.cy);
    });
    tiltRaf = busy ? requestAnimationFrame(tiltLoop) : 0;
  }
  function addTilt(zone, apply) {
    var t = { tx: 0, ty: 0, cx: 0, cy: 0, apply: apply };
    tilts.push(t);
    var wake = function () { if (!tiltRaf) tiltRaf = requestAnimationFrame(tiltLoop); };
    zone.addEventListener('pointermove', function (event) {
      if (event.pointerType === 'touch') return;
      var rect = zone.getBoundingClientRect();
      t.tx = (event.clientX - rect.left) / rect.width - 0.5;
      t.ty = (event.clientY - rect.top) / rect.height - 0.5;
      wake();
    });
    zone.addEventListener('pointerleave', function () { t.tx = 0; t.ty = 0; wake(); });
  }

  function initTilt() {
    if (reduceMotion) return;
    var hero = $('.hero');
    var stage = $('.hero__stage');
    if (hero && stage) {
      addTilt(hero, function (x, y) {
        stage.style.setProperty('--try', (x * 10).toFixed(2));
        stage.style.setProperty('--trx', (y * -8).toFixed(2));
      });
    }
    $$('.case__card').forEach(function (card) {
      var viz = $('.viz', card);
      if (!viz) return;
      addTilt(card, function (x, y) {
        viz.style.setProperty('--pry', (x * 20).toFixed(2));
        viz.style.setProperty('--prx', (y * -15).toFixed(2));
      });
    });
  }

  // Each case illustration swings round to face the reader as its card rises into view.
  function initCaseScroll() {
    if (reduceMotion) return;
    var items = $$('.case').map(function (el, index) {
      return { card: $('.case__card', el), viz: $('.viz', el), sign: index % 2 === 0 ? -1 : 1 };
    }).filter(function (item) { return item.card && item.viz; });
    if (!items.length) return;
    var queued = false;
    function update() {
      queued = false;
      var vh = window.innerHeight;
      items.forEach(function (item) {
        var progress = clamp((vh - item.card.getBoundingClientRect().top) / (vh * 0.9), 0, 1);
        var eased = 1 - Math.pow(1 - progress, 3);
        item.viz.style.setProperty('--sry', ((1 - eased) * item.sign * 34).toFixed(2));
      });
    }
    function request() { if (!queued) { queued = true; requestAnimationFrame(update); } }
    window.addEventListener('scroll', request, { passive: true });
    window.addEventListener('resize', request);
    update();
  }

  /* ---------- running rows of stack pills ---------- */

  function initRows() {
    var wrap = $('[data-rows]');
    if (!wrap || reduceMotion) return;
    wrap.classList.add('is-ready');
    var speeds = [34, 27, 40]; // pixels per second, per row
    $$('.rows__row', wrap).forEach(function (row, index) {
      var track = $('.rows__track', row);
      var group = $('.rows__group', row);
      if (!track || !group) return;
      var originals = Array.prototype.slice.call(group.children);
      var guard = 0;
      while (group.scrollWidth < window.innerWidth * 1.2 && guard < 6) {
        originals.forEach(function (node) { group.appendChild(node.cloneNode(true)); });
        guard += 1;
      }
      track.style.animationDuration = Math.round(group.scrollWidth / speeds[index % speeds.length]) + 's';
      track.appendChild(group.cloneNode(true));
    });
  }

  /* ---------- quick-answers console ---------- */

  function initConsole() {
    var box = $('[data-ask]');
    if (!box) return;
    var log = $('.console__log', box);
    var chips = $$('.console__chip', box);
    if (!log || !chips.length) return;
    log.setAttribute('data-lenis-prevent', '');
    var busy = false;

    function add(kind, text) {
      var msg = document.createElement('p');
      msg.className = 'console__msg console__msg--' + kind;
      msg.textContent = text;
      log.appendChild(msg);
      log.scrollTop = log.scrollHeight;
      return msg;
    }

    chips.forEach(function (chip) {
      chip.addEventListener('click', function () {
        if (busy) return;
        var answer = chip.getAttribute('data-answer') || '';
        add('me', chip.textContent.replace(/\s+/g, ' ').trim());   // the markup may wrap the label across lines
        if (reduceMotion) { add('ai', answer); return; }

        // Screen readers get the whole answer at once; the visible copy is typed out.
        var msg = add('ai', '');
        var spoken = document.createElement('span');
        spoken.className = 'sr-only';
        spoken.textContent = answer;
        var typed = document.createElement('span');
        typed.setAttribute('aria-hidden', 'true');
        msg.appendChild(spoken);
        msg.appendChild(typed);
        msg.classList.add('is-typing');
        busy = true;
        chips.forEach(function (c) { c.disabled = true; });
        var pos = 0;
        (function type() {
          pos += 2;
          typed.textContent = answer.slice(0, pos);
          log.scrollTop = log.scrollHeight;
          if (pos < answer.length) { setTimeout(type, 16); return; }
          msg.classList.remove('is-typing');
          busy = false;
          chips.forEach(function (c) { c.disabled = false; });
          chip.focus({ preventScroll: true });
        })();
      });
    });
  }

  /* ---------- stack explorer: eight layers as 3D slabs, tabs and panels ---------- */

  function initLayers() {
    var root = $('[data-layers]');
    if (!root) return;
    var tabList = $('.layers__tabs', root);
    var tabs = $$('.layers__tab', root);
    var panels = $$('.layers__panel', root);
    var slabs = $$('.slab', root);
    if (!tabs.length || tabs.length !== panels.length) return;

    root.classList.add('is-ready');
    var DWELL = 4200;                       // matches the tab-fill animation in the stylesheet
    var current = -1, auto = !reduceMotion, timer = 0, onScreen = false;

    function select(index) {
      index = (index + tabs.length) % tabs.length;
      if (index === current) return;
      current = index;
      tabs.forEach(function (tab, i) {
        var on = i === index;
        tab.classList.toggle('is-active', on);
        tab.setAttribute('aria-selected', String(on));
        tab.tabIndex = on ? 0 : -1;
      });
      panels.forEach(function (panel, i) {
        panel.classList.toggle('is-active', i === index);
        panel.setAttribute('aria-hidden', String(i !== index));
      });
      // The chosen slab rises a little and everything above it rises more, opening a gap on both sides.
      slabs.forEach(function (slab, i) {
        slab.classList.toggle('is-active', i === index);
        slab.style.setProperty('--lift', i < index ? '38px' : (i === index ? '20px' : '0px'));
      });
      // On narrow screens the tabs are a scrolling strip: keep the active one in view without moving the page.
      if (tabList && tabList.scrollWidth > tabList.clientWidth + 4) {
        var tab = tabs[index];
        tabList.scrollTo({ left: tab.offsetLeft - (tabList.clientWidth - tab.offsetWidth) / 2, behavior: reduceMotion ? 'auto' : 'smooth' });
      }
    }
    function schedule() {
      clearTimeout(timer);
      var running = auto && onScreen && !document.hidden;
      root.classList.toggle('is-auto', running);
      if (running) timer = setTimeout(function () { select(current + 1); schedule(); }, DWELL);
    }
    // The tour is only an invitation: the first deliberate choice ends it for good.
    function choose(index) { auto = false; select(index); schedule(); }

    tabs.forEach(function (tab, i) {
      tab.addEventListener('click', function () { choose(i); });
      tab.addEventListener('keydown', function (event) {
        var next = null;
        if (event.key === 'ArrowDown' || event.key === 'ArrowRight') next = i + 1;
        else if (event.key === 'ArrowUp' || event.key === 'ArrowLeft') next = i - 1;
        else if (event.key === 'Home') next = 0;
        else if (event.key === 'End') next = tabs.length - 1;
        if (next === null) return;
        event.preventDefault();
        choose(next);
        tabs[current].focus();
      });
    });
    slabs.forEach(function (slab, i) { slab.addEventListener('click', function () { choose(i); }); });

    select(0);
    document.addEventListener('visibilitychange', schedule);
    watch(root, function (visible) { onScreen = visible; schedule(); });
  }

  /* ---------- module shelf: a ring of cards that keeps turning ---------- */

  function initRing() {
    var ring = $('[data-ring]');
    if (!ring || reduceMotion) return;
    var spin = $('.ring__spin', ring);
    var cards = $$('.mod', ring);
    var count = cards.length;
    if (!spin || count < 4) return;

    ring.classList.add('is-3d');
    var step = 360 / count;
    var AUTO = -0.075;          // degrees per frame at 60 fps
    var angle = 0, velocity = AUTO, dragging = false, hovering = false;
    var lastX = 0, lastTime = 0, lastScroll = window.pageYOffset, raf = 0, onScreen = false;
    var shown = [];

    function layout() {
      var width = cards[0].offsetWidth;
      var fit = width / 2 / Math.tan(Math.PI / count);          // radius at which neighbouring cards just touch
      var spread = window.innerWidth > 900 ? 1.28 : 1.04;       // open the ring up on wide screens
      ring.style.setProperty('--radius', Math.round(fit * spread + 20) + 'px');
    }
    function render() {
      spin.style.setProperty('--spin', angle.toFixed(3));
      for (var i = 0; i < count; i++) {
        var rel = ((i * step + angle) % 360 + 540) % 360 - 180;
        var facing = clamp(Math.cos(rel * Math.PI / 180), 0, 1).toFixed(2);
        if (facing !== shown[i]) { shown[i] = facing; cards[i].style.setProperty('--f', facing); }   // skip no-op style writes
      }
    }
    function frame(now) {
      var k = lastTime ? clamp((now - lastTime) / 16.67, 0, 3) : 1;
      lastTime = now;
      if (!dragging) {
        velocity += ((hovering ? 0 : AUTO) - velocity) * 0.045 * k;
        angle += velocity * k;
      }
      render();
      raf = requestAnimationFrame(frame);
    }
    function start() { if (!raf && onScreen && !document.hidden) { lastTime = 0; raf = requestAnimationFrame(frame); } }
    function stop() { cancelAnimationFrame(raf); raf = 0; }

    ring.addEventListener('pointerdown', function (event) {
      dragging = true;
      lastX = event.clientX;
      ring.classList.add('is-dragging');
      try { ring.setPointerCapture(event.pointerId); } catch (err) { /* older browsers */ }
    });
    ring.addEventListener('pointermove', function (event) {
      if (!dragging) return;
      var delta = (event.clientX - lastX) * 0.2;
      lastX = event.clientX;
      angle += delta;
      velocity = clamp(delta, -7, 7);
    });
    var release = function () { dragging = false; ring.classList.remove('is-dragging'); };
    ring.addEventListener('pointerup', release);
    ring.addEventListener('pointercancel', release);
    ring.addEventListener('pointerenter', function (event) { if (event.pointerType === 'mouse') hovering = true; });
    ring.addEventListener('pointerleave', function () { hovering = false; });

    // Scrolling the page gives the shelf a push in the same direction.
    window.addEventListener('scroll', function () {
      var y = window.pageYOffset;
      if (onScreen && !dragging) velocity = clamp(velocity + (y - lastScroll) * -0.018, -3.2, 3.2);
      lastScroll = y;
    }, { passive: true });

    window.addEventListener('resize', layout);
    document.addEventListener('visibilitychange', function () { if (document.hidden) stop(); else start(); });
    layout();
    render();
    watch(ring, function (visible) { onScreen = visible; if (visible) start(); else stop(); });
  }

  /* ---------- globe: real coastlines, client pins, arcs back to Jaipur ---------- */

  function initGlobe() {
    var canvas = $('[data-globe]');
    if (!canvas || !canvas.getContext) return;
    var ctx = canvas.getContext('2d');
    var DEG = Math.PI / 180;
    var TAU = Math.PI * 2;

    // One bit per point of an 11,000-point Fibonacci lattice: set when the point is on land.
    // Generated from Natural Earth 1:110m land polygons (public domain).
    var POINTS = 11000;
    var MASK = 'AAAAAAAJACEhIAWMhJAVEBICAkLAAJk6AAMgaMAMHJEjM3MEZozMtZh9FvfyZlvee6t/f+Vt7/2dv73+9v732tr9fzt/f+Wt/P2Vt/v2Vv7+31v5eytj9++tvJ2VkfJ3VkbOyUm5Oyk7Z+a0zJ2RlzN3UnbOyOmZOSE/Z+bU3JyQ23NzYn7Oze25OSm35+b0/Jyam3Nzcm5Ozem5OT035+bknJyam3Nzak5Oze25OTU35+b0nJyak3Nzam5Ozem4OTUn5+bU3JyakXFzek5OzKg5OTEnY2T0nJ6aUXEyYk7Nzag5OTWjYmTEnJ6YU3FyYkbNickZMTGnYsTEjJoQE3FyQk7NiYk5NSGnYsTEjJqSk3NySk7MiKkZMSGjZ8TUjJwQUTNySkbPiKkZPSGjZsSUjJ4QUzNqQkZNiCkZNSWn5sSUjJoQU3J6SkZNiSk5NSWnptSUnJISU3JqSk5JiSk5BSWmpJSUnJISU3JKSkbNKSk5BSWmpJSUnIJSUnJKSkRFKSk5BaWmoJSUmIJSUnBKSk1BKSk4JaWkoJQUjJJSUlBKSgVJKSkwNaWkgJQUGpJSUkRKSk0FqSkwJKSkgpQUCoJSUmBISg0BqSkwJKWkgJQUCgJSU2BISE0BKSk0BKSmgJAUCgJSU1AISE0BISkkBKSmgBAUAgJCU0gISAkBoSgkBKSmgBCUAgJCUVgISAkBoSgkBISAkBCUAgJCUUgISEEBISgkBISEoBCQAgpCUVgICAkFISAkFISEolCQEgJCQFkoCAkFoaAkFISAolAQkgpCQEkoCAEFIaAkFISAolCQkgoCQEkoKgEFIaAkFAWAglBQgAoCQEkqKgAFAaAgFASAglBUgAoCQEEqKAAFgagAFASAglBUgAoCUQEqKAAFgagAFQWgAlBUAAoCUQEqKABFoKgAFQWiIlBQAAoCUREqKgAFoKAIFRSiAlBUBAoIUQEqKAZFpKAIFRCCIlBQBAoIQREqKAYF5KAIFBCCAlJQDAqIQQEoIAYFpKAIFRCCAlBQjApIQREoIEYFpKAIFBCCAlBQCApIQQEoIAYFoKAAFBCCAlBACApIQQEoIAQFoKAAFBCCAlBACIpAQQEoIAQFoKAAFIGCAlBACIpAQREoIgUFoIAAFIWCAlBACApAQREoAgUFoIgAFIWCIlBUCopAEREoCgUFoIgAFIEiIlAUAopAEQEoCgVEoIgAFIEiIlAUAopAEREoAkVEoCgAFYEiInAUiohAEREqAkVEoCgAFYEiIlQEiohAURAqAkVEoCgUFYEiIFQEioBAURAqAkVAoAgUEYEiIFQEioBAETAiAkVAqAgUAYEiIFQEioBAETAiAkVAqAgUAYEiYEQEioBAESACAkVAiAgUAYEiYAQEioAAESACAgVACAgUAYECQAQECoAQESgCAgSACAgUAAECQAAECIAAACAAAgSAAAgQAAEAQAAECAABACAAAgCAAAgQAAIAQCAAAAABACAAAACAQAAAAAIAQAAAAAABAAAAAACAAAAAAAIAAAAEAAABAAAAAACAAAAAAAIAAAAABAABAAAABAIAAAAAAAIAAAAIAAAAAAAABAAAAAAAAAIAAAAIAAAAAAAABAAAABAAAAAAAAAIAAAAAAAABAAAABAAAAAAAAAIAAAAAAAABAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAIQAgIKQEhJaCkhJSMkhJSOkpKT+lpLT2lpbX0lJ7e83N+fs/P+3k/v+/39fy83t/3+3t/f////w==';
    var bits;
    try { bits = window.atob(MASK); } catch (err) { return; }

    function vec(lat, lon) {
      var c = Math.cos(lat);
      return [c * Math.sin(lon), Math.sin(lat), c * Math.cos(lon)];
    }

    var coords = [];
    var golden = Math.PI * (3 - Math.sqrt(5));
    for (var i = 0; i < POINTS; i++) {
      if (!(bits.charCodeAt(i >> 3) & (1 << (i & 7)))) continue;
      var v = vec(Math.asin(1 - 2 * (i + 0.5) / POINTS), (i * golden) % TAU - Math.PI);
      coords.push(v[0], v[1], v[2]);
    }
    var land = new Float32Array(coords);

    var LABELS = {
      IN: { text: 'Jaipur, India', dx: 13, dy: 4, align: 'left' },
      AE: { text: 'UAE', dx: 9, dy: -11, align: 'left' },
      SA: { text: 'Saudi Arabia', dx: -12, dy: 15, align: 'right' },
      ZA: { text: 'South Africa', dx: 13, dy: 4, align: 'left' },
      US: { text: 'United States', dx: 13, dy: 4, align: 'left' }
    };
    var rows = $$('[data-globe-list] .reach__row');
    var markers = rows.map(function (row) {
      var lat = parseFloat(row.getAttribute('data-lat')) * DEG;
      var lon = parseFloat(row.getAttribute('data-lon')) * DEG;
      var code = row.getAttribute('data-code');
      return { code: code, lat: lat, lon: lon, v: vec(lat, lon), row: row, label: LABELS[code] || { text: code, dx: 13, dy: 4, align: 'left' } };
    });
    if (!markers.length) return;
    var home = markers[0];

    function slerp(a, b, t) {
      var dot = clamp(a[0] * b[0] + a[1] * b[1] + a[2] * b[2], -1, 1);
      var omega = Math.acos(dot);
      if (omega < 1e-4) return a.slice();
      var s = Math.sin(omega);
      var ka = Math.sin((1 - t) * omega) / s, kb = Math.sin(t * omega) / s;
      return [a[0] * ka + b[0] * kb, a[1] * ka + b[1] * kb, a[2] * ka + b[2] * kb];
    }
    var SEG = 64;
    var arcs = markers.slice(1).map(function (m, index) {
      var omega = Math.acos(clamp(home.v[0] * m.v[0] + home.v[1] * m.v[1] + home.v[2] * m.v[2], -1, 1));
      var lift = 0.06 + 0.34 * (omega / Math.PI);
      var pts = [];
      for (var s = 0; s <= SEG; s++) {
        var t = s / SEG;
        var p = slerp(home.v, m.v, t);
        var height = 1 + lift * Math.sin(Math.PI * t);
        pts.push([p[0] * height, p[1] * height, p[2] * height]);
      }
      return { pts: pts, phase: index * 0.27, to: m };
    });

    var BASE_TILT = 0.34, AUTO = 0.0022;
    var yaw = -home.lon + 0.3, tilt = BASE_TILT, velocity = AUTO;
    var mode = 'auto', targetYaw = 0, targetTilt = 0, holdUntil = 0, active = home.code;
    var dragging = false, lastX = 0, lastY = 0, lastTime = 0, raf = 0, onScreen = false;
    var width = 0, height = 0, radius = 0, cx = 0, cy = 0;
    var cosYaw = 1, sinYaw = 0, cosTilt = 1, sinTilt = 0;
    var tmp = [0, 0, 0, 0];
    var SHADES = ['rgba(243,240,234,0.20)', 'rgba(243,240,234,0.36)', 'rgba(243,240,234,0.54)', 'rgba(243,240,234,0.74)', 'rgba(243,240,234,0.95)'];

    // Rotates a unit vector by the current yaw and tilt: [screen x, screen y, depth, squared distance from centre].
    function project(x0, y0, z0, out) {
      var x = x0 * cosYaw + z0 * sinYaw;
      var z = -x0 * sinYaw + z0 * cosYaw;
      var y = y0 * cosTilt - z * sinTilt;
      out[0] = cx + radius * x;
      out[1] = cy - radius * y;
      out[2] = y0 * sinTilt + z * cosTilt;
      out[3] = x * x + y * y;
      return out;
    }

    function resize() {
      var dpr = Math.min(window.devicePixelRatio || 1, 2);
      width = canvas.clientWidth;
      height = canvas.clientHeight;
      canvas.width = Math.round(width * dpr);
      canvas.height = Math.round(height * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      radius = Math.min(width, height) * 0.39;
      cx = width / 2;
      cy = height / 2;
    }

    function draw(now) {
      cosYaw = Math.cos(yaw); sinYaw = Math.sin(yaw);
      cosTilt = Math.cos(tilt); sinTilt = Math.sin(tilt);
      ctx.clearRect(0, 0, width, height);

      var halo = ctx.createRadialGradient(cx, cy, radius * 0.8, cx, cy, radius * 1.45);
      halo.addColorStop(0, 'rgba(255,91,46,0.22)');
      halo.addColorStop(0.45, 'rgba(124,77,255,0.09)');
      halo.addColorStop(1, 'rgba(7,7,8,0)');
      ctx.fillStyle = halo;
      ctx.beginPath(); ctx.arc(cx, cy, radius * 1.45, 0, TAU); ctx.fill();

      var body = ctx.createRadialGradient(cx - radius * 0.4, cy - radius * 0.45, radius * 0.05, cx, cy, radius);
      body.addColorStop(0, '#20202a');
      body.addColorStop(0.6, '#0f0f14');
      body.addColorStop(1, '#08080a');
      ctx.fillStyle = body;
      ctx.beginPath(); ctx.arc(cx, cy, radius, 0, TAU); ctx.fill();
      ctx.strokeStyle = 'rgba(255,255,255,0.16)';
      ctx.lineWidth = 1;
      ctx.stroke();

      var base = Math.max(1.1, radius / 185);
      var shade = -1;
      for (var p = 0; p < land.length; p += 3) {
        project(land[p], land[p + 1], land[p + 2], tmp);
        if (tmp[2] < 0) {
          if (shade !== 9) { ctx.fillStyle = 'rgba(243,240,234,0.07)'; shade = 9; }
          ctx.fillRect(tmp[0] - base * 0.4, tmp[1] - base * 0.4, base * 0.8, base * 0.8);
          continue;
        }
        var bucket = Math.min(4, Math.floor(tmp[2] * 5));
        if (bucket !== shade) { ctx.fillStyle = SHADES[bucket]; shade = bucket; }
        var size = base * (0.75 + 0.55 * tmp[2]);
        ctx.fillRect(tmp[0] - size / 2, tmp[1] - size / 2, size, size);
      }

      ctx.lineWidth = 1.3;
      ctx.lineCap = 'round';
      arcs.forEach(function (arc) {
        var lit = active === home.code || arc.to.code === active;
        ctx.strokeStyle = lit ? 'rgba(255,128,80,0.9)' : 'rgba(255,91,46,0.3)';
        ctx.beginPath();
        var pen = false;
        for (var s = 0; s <= SEG; s++) {
          var pt = arc.pts[s];
          project(pt[0], pt[1], pt[2], tmp);
          if (tmp[2] > 0 || tmp[3] > 1) {
            if (pen) ctx.lineTo(tmp[0], tmp[1]); else ctx.moveTo(tmp[0], tmp[1]);
            pen = true;
          } else {
            pen = false;
          }
        }
        ctx.stroke();

        var t = ((now * 0.00022 + arc.phase) % 1) * SEG;
        var i0 = Math.floor(t), frac = t - i0;
        var a = arc.pts[i0], b = arc.pts[Math.min(SEG, i0 + 1)];
        project(a[0] + (b[0] - a[0]) * frac, a[1] + (b[1] - a[1]) * frac, a[2] + (b[2] - a[2]) * frac, tmp);
        if (tmp[2] > 0 || tmp[3] > 1) {
          ctx.fillStyle = 'rgba(255,91,46,0.28)';
          ctx.beginPath(); ctx.arc(tmp[0], tmp[1], 7, 0, TAU); ctx.fill();
          ctx.fillStyle = '#ffe0c4';
          ctx.beginPath(); ctx.arc(tmp[0], tmp[1], 2.3, 0, TAU); ctx.fill();
        }
      });

      ctx.font = '500 11px "JetBrains Mono", ui-monospace, monospace';
      ctx.textBaseline = 'middle';
      markers.forEach(function (m) {
        project(m.v[0], m.v[1], m.v[2], tmp);
        if (tmp[2] <= 0.04) return;
        var x = tmp[0], y = tmp[1], on = m.code === active;
        var fade = clamp(tmp[2] * 2.2, 0, 1);
        var pulse = ((now * 0.001 + m.lon) % 1.7) / 1.7;

        ctx.strokeStyle = 'rgba(255,91,46,' + (0.75 * (1 - pulse) * fade).toFixed(3) + ')';
        ctx.lineWidth = 1.2;
        ctx.beginPath(); ctx.arc(x, y, 5 + pulse * (on ? 22 : 14), 0, TAU); ctx.stroke();
        ctx.fillStyle = 'rgba(255,91,46,' + fade.toFixed(3) + ')';
        ctx.beginPath(); ctx.arc(x, y, on ? 5.5 : 4, 0, TAU); ctx.fill();
        ctx.fillStyle = 'rgba(255,255,255,' + fade.toFixed(3) + ')';
        ctx.beginPath(); ctx.arc(x, y, 1.6, 0, TAU); ctx.fill();

        var text = m.label.text.toUpperCase();
        var tw = ctx.measureText(text).width;
        var tx = x + m.label.dx, ty = y + m.label.dy;
        var left = m.label.align === 'right' ? tx - tw : tx;
        ctx.fillStyle = 'rgba(7,7,8,' + (0.78 * fade).toFixed(3) + ')';
        ctx.fillRect(left - 5, ty - 9, tw + 10, 18);
        ctx.fillStyle = on ? 'rgba(255,255,255,' + fade.toFixed(3) + ')' : 'rgba(243,240,234,' + (0.66 * fade).toFixed(3) + ')';
        ctx.textAlign = 'left';
        ctx.fillText(text, left, ty + 0.5);
      });
    }

    function frame(now) {
      var k = lastTime ? clamp((now - lastTime) / 16.67, 0, 3) : 1;
      lastTime = now;
      if (!dragging) {
        if (mode === 'focus') {
          var delta = targetYaw - yaw;
          delta = Math.atan2(Math.sin(delta), Math.cos(delta));
          yaw += delta * 0.07 * k;
          tilt += (targetTilt - tilt) * 0.07 * k;
          if (now > holdUntil) { mode = 'auto'; velocity = 0; }
        } else {
          velocity += (AUTO - velocity) * 0.03 * k;
          yaw += velocity * k;
          tilt += (BASE_TILT - tilt) * 0.02 * k;
        }
      }
      draw(now);
      raf = requestAnimationFrame(frame);
    }
    function start() { if (!raf && onScreen && !document.hidden && !reduceMotion) { lastTime = 0; raf = requestAnimationFrame(frame); } }
    function stop() { cancelAnimationFrame(raf); raf = 0; }
    function still() { if (!raf) draw(performance.now()); }

    function focus(marker) {
      active = marker.code;
      rows.forEach(function (row) { row.classList.toggle('is-active', row === marker.row); });
      targetYaw = -marker.lon;
      targetTilt = clamp(marker.lat * 0.7, -0.55, 0.6);
      if (reduceMotion) { yaw = targetYaw; tilt = targetTilt; still(); return; }
      mode = 'focus';
      holdUntil = performance.now() + 6000;
    }
    markers.forEach(function (m) {
      m.row.addEventListener('click', function () { focus(m); });
      m.row.addEventListener('focus', function () { focus(m); });
      m.row.addEventListener('pointerenter', function (event) { if (event.pointerType === 'mouse') focus(m); });
    });

    canvas.addEventListener('pointerdown', function (event) {
      dragging = true;
      mode = 'auto';
      velocity = 0;
      lastX = event.clientX;
      lastY = event.clientY;
      canvas.classList.add('is-dragging');
      try { canvas.setPointerCapture(event.pointerId); } catch (err) { /* older browsers */ }
    });
    canvas.addEventListener('pointermove', function (event) {
      if (!dragging) return;
      var dx = event.clientX - lastX, dy = event.clientY - lastY;
      lastX = event.clientX;
      lastY = event.clientY;
      yaw += dx * 0.0062;
      tilt = clamp(tilt + dy * 0.004, -1, 1);
      velocity = clamp(dx * 0.0062, -0.08, 0.08);
      still();
    });
    var release = function () { dragging = false; canvas.classList.remove('is-dragging'); };
    canvas.addEventListener('pointerup', release);
    canvas.addEventListener('pointercancel', release);

    window.addEventListener('resize', function () { resize(); still(); });
    document.addEventListener('visibilitychange', function () { if (document.hidden) stop(); else start(); });
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(still);
    resize();
    draw(performance.now());
    watch(canvas, function (visible) { onScreen = visible; if (visible) { resize(); start(); still(); } else stop(); });
  }

  /* ---------- contact: a fragment shader drawing slow ember-coloured haze ---------- */

  function initSmoke() {
    var canvas = $('[data-smoke]');
    var section = $('.contact');
    if (!canvas || !section || reduceMotion || !canvas.getContext) return;
    var gl = null;
    try {
      gl = canvas.getContext('webgl', { antialias: false, alpha: false, depth: false, stencil: false, powerPreference: 'low-power' });
    } catch (err) { gl = null; }
    if (!gl) return;

    var VERT = 'attribute vec2 a_pos; void main() { gl_Position = vec4(a_pos, 0.0, 1.0); }';
    var FRAG = [
      '#ifdef GL_FRAGMENT_PRECISION_HIGH',
      'precision highp float;',
      '#else',
      'precision mediump float;',
      '#endif',
      'uniform vec2 u_res; uniform float u_time; uniform vec2 u_ptr;',
      'float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453123); }',
      'float noise(vec2 p) {',
      '  vec2 i = floor(p), f = fract(p);',
      '  vec2 u = f * f * (3.0 - 2.0 * f);',
      '  return mix(mix(hash(i), hash(i + vec2(1.0, 0.0)), u.x), mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), u.x), u.y);',
      '}',
      'float fbm(vec2 p) {',
      '  float v = 0.0, a = 0.5;',
      '  for (int i = 0; i < 5; i++) { v += a * noise(p); p = p * 2.02 + vec2(17.3, 9.1); a *= 0.5; }',
      '  return v;',
      '}',
      'void main() {',
      '  vec2 uv = gl_FragCoord.xy / u_res;',
      '  vec2 p = (gl_FragCoord.xy - 0.5 * u_res) / u_res.y * 1.7;',
      '  float t = u_time * 0.045;',
      // domain warping: noise fed back into itself reads as slowly folding smoke
      '  vec2 q = vec2(fbm(p + vec2(0.0, t)), fbm(p + vec2(5.2, 1.3) - t));',
      '  vec2 r = vec2(fbm(p + 3.0 * q + vec2(1.7, 9.2) + t * 1.4), fbm(p + 3.0 * q + vec2(8.3, 2.8) - t * 1.1));',
      '  r += (u_ptr - 0.5) * 0.35;',
      '  float smoke = smoothstep(0.25, 0.95, fbm(p + 3.2 * r));',
      '  float lift = smoothstep(1.05, 0.0, uv.y);',
      '  vec3 tint = mix(vec3(1.0, 0.357, 0.18), vec3(1.0, 0.176, 0.47), smoothstep(0.35, 0.9, q.y));',
      '  tint = mix(tint, vec3(0.486, 0.302, 1.0), smoothstep(0.55, 1.0, r.y) * 0.7);',
      '  vec3 col = vec3(0.027, 0.027, 0.031);',
      '  col += tint * smoke * smoke * (0.13 + 0.62 * lift);',
      '  col += vec3(0.9, 0.85, 0.8) * pow(smoke, 6.0) * 0.1;',
      '  col *= 1.0 - 0.3 * length(uv - 0.5);',
      '  gl_FragColor = vec4(col, 1.0);',
      '}'
    ].join('\n');

    function compile(type, source) {
      var shader = gl.createShader(type);
      gl.shaderSource(shader, source);
      gl.compileShader(shader);
      return gl.getShaderParameter(shader, gl.COMPILE_STATUS) ? shader : null;
    }
    var vs = compile(gl.VERTEX_SHADER, VERT);
    var fs = compile(gl.FRAGMENT_SHADER, FRAG);
    if (!vs || !fs) return;
    var program = gl.createProgram();
    gl.attachShader(program, vs);
    gl.attachShader(program, fs);
    gl.linkProgram(program);
    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) return;
    gl.useProgram(program);

    gl.bindBuffer(gl.ARRAY_BUFFER, gl.createBuffer());
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
    var loc = gl.getAttribLocation(program, 'a_pos');
    gl.enableVertexAttribArray(loc);
    gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);
    var uRes = gl.getUniformLocation(program, 'u_res');
    var uTime = gl.getUniformLocation(program, 'u_time');
    var uPtr = gl.getUniformLocation(program, 'u_ptr');

    var SCALE = 0.5;   // render at half resolution: the haze is soft, so nothing is lost
    var raf = 0, onScreen = false, lost = false;
    var ptr = { x: 0.5, y: 0.5, tx: 0.5, ty: 0.5 };

    function frame(now) {
      var w = Math.max(2, Math.round(canvas.clientWidth * SCALE));
      var h = Math.max(2, Math.round(canvas.clientHeight * SCALE));
      if (canvas.width !== w || canvas.height !== h) { canvas.width = w; canvas.height = h; gl.viewport(0, 0, w, h); }
      ptr.x += (ptr.tx - ptr.x) * 0.04;
      ptr.y += (ptr.ty - ptr.y) * 0.04;
      gl.uniform2f(uRes, w, h);
      gl.uniform1f(uTime, now * 0.001);
      gl.uniform2f(uPtr, ptr.x, ptr.y);
      gl.drawArrays(gl.TRIANGLES, 0, 3);
      canvas.classList.add('is-on');
      raf = requestAnimationFrame(frame);
    }
    function start() { if (!raf && onScreen && !lost && !document.hidden) raf = requestAnimationFrame(frame); }
    function stop() { cancelAnimationFrame(raf); raf = 0; }

    section.addEventListener('pointermove', function (event) {
      var rect = section.getBoundingClientRect();
      ptr.tx = (event.clientX - rect.left) / rect.width;
      ptr.ty = 1 - (event.clientY - rect.top) / rect.height;
    });
    canvas.addEventListener('webglcontextlost', function (event) {
      event.preventDefault();
      lost = true;
      stop();
      canvas.classList.remove('is-on');
    });
    document.addEventListener('visibilitychange', function () { if (document.hidden) stop(); else start(); });
    watch(section, function (visible) { onScreen = visible; if (visible) start(); else stop(); });
  }

  initTilt();
  initCaseScroll();
  initRows();
  initConsole();
  initLayers();
  initRing();
  initGlobe();
  initSmoke();
})();
