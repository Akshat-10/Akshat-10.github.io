/* Akshat Gupta — portfolio interactions.
   Everything is progressive: the page is fully readable with no JavaScript,
   and with reduced motion the animated layer is skipped entirely. */
(function () {
  'use strict';

  var root = document.documentElement;
  var $ = function (sel, ctx) { return (ctx || document).querySelector(sel); };
  var $$ = function (sel, ctx) { return Array.prototype.slice.call((ctx || document).querySelectorAll(sel)); };

  var reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var finePointer = window.matchMedia('(hover: hover) and (pointer: fine)').matches;
  var hasGsap = typeof window.gsap !== 'undefined' && typeof window.ScrollTrigger !== 'undefined';
  var animated = hasGsap && !reduceMotion;
  var lenis = null;

  /* ---------- always on ---------- */

  function initClock() {
    var els = $$('[data-clock]');
    if (!els.length || typeof Intl === 'undefined') return;
    var fmt = new Intl.DateTimeFormat('en-GB', { hour: '2-digit', minute: '2-digit', hour12: false, timeZone: 'Asia/Kolkata' });
    var tick = function () {
      var now = fmt.format(new Date());
      els.forEach(function (el) { el.textContent = now; });
    };
    tick();
    setInterval(tick, 20000);
  }

  var toastTimer;
  function toast(message) {
    var el = $('.toast');
    if (!el) return;
    el.textContent = message;
    el.classList.add('is-on');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { el.classList.remove('is-on'); }, 2200);
  }

  function copyText(text) {
    if (navigator.clipboard && window.isSecureContext) return navigator.clipboard.writeText(text);
    return new Promise(function (resolve, reject) {
      var field = document.createElement('textarea');
      field.value = text;
      field.setAttribute('readonly', '');
      field.style.cssText = 'position:fixed;left:-9999px;top:0';
      document.body.appendChild(field);
      field.select();
      var ok = false;
      try { ok = document.execCommand('copy'); } catch (err) { ok = false; }
      document.body.removeChild(field);
      if (ok) resolve(); else reject(new Error('copy failed'));
    });
  }

  function initCopy() {
    $$('[data-copy]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        var value = btn.getAttribute('data-copy');
        copyText(value).then(
          function () { toast('Email copied to clipboard'); },
          function () { toast(value); }
        );
      });
    });
  }

  function initMenu() {
    var toggle = $('.nav__toggle');
    var menu = $('#menu');
    if (!toggle || !menu) return;
    var setOpen = function (open) {
      toggle.setAttribute('aria-expanded', String(open));
      toggle.setAttribute('aria-label', open ? 'Close menu' : 'Open menu');
      menu.classList.toggle('is-open', open);
      menu.setAttribute('aria-hidden', String(!open));
      root.classList.toggle('menu-open', open);
      if (lenis) { if (open) lenis.stop(); else lenis.start(); }
    };
    toggle.addEventListener('click', function () { setOpen(toggle.getAttribute('aria-expanded') !== 'true'); });
    $$('a', menu).forEach(function (link) { link.addEventListener('click', function () { setOpen(false); }); });
    document.addEventListener('keydown', function (event) { if (event.key === 'Escape') setOpen(false); });
    window.matchMedia('(min-width: 1024px)').addEventListener('change', function (event) { if (event.matches) setOpen(false); });
  }

  function initActiveLink() {
    if (!('IntersectionObserver' in window)) return;
    var links = $$('.nav__links a');
    var byId = {};
    links.forEach(function (link) { byId[link.getAttribute('href').slice(1)] = link; });
    var observer = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (!entry.isIntersecting) return;
        links.forEach(function (link) { link.classList.remove('is-active'); });
        var link = byId[entry.target.id];
        if (link) link.classList.add('is-active');
      });
    }, { rootMargin: '-45% 0px -50% 0px' });
    $$('main section[id]').forEach(function (section) { observer.observe(section); });
  }

  function initSpotlight() {
    if (!finePointer) return;
    $$('.spot').forEach(function (el) {
      el.addEventListener('pointermove', function (event) {
        var rect = el.getBoundingClientRect();
        el.style.setProperty('--mx', (event.clientX - rect.left) + 'px');
        el.style.setProperty('--my', (event.clientY - rect.top) + 'px');
      });
    });
  }

  // Floating dock (back to top + connect). It appears once the hero is scrolled past, and steps
  // aside when nothing has moved for IDLE_MS. Any pointer movement, scroll or key press brings it back.
  function initDock() {
    var dock = $('[data-dock]');
    if (!dock) return;
    var toggle = $('.dock__connect', dock);
    var menu = $('.dock__menu', dock);
    var ring = $('.dock__progress', dock);
    var IDLE_MS = 500;
    // Touch screens have no cursor to "move": after a scroll or tap the visitor still needs time to reach a button.
    var IDLE_TOUCH_MS = 2500;
    var touchOnly = window.matchMedia('(hover: none), (pointer: coarse)').matches;
    var idleFor = touchOnly ? Math.max(IDLE_MS, IDLE_TOUCH_MS) : IDLE_MS;
    var RING_LENGTH = 138.23;   // circumference of the r=22 progress circle
    var past = false, active = false, hovering = false, timer = 0, lastPoke = 0;

    function menuOpen() { return !!menu && menu.classList.contains('is-open'); }
    // Keyboard focus keeps the dock on screen; focus left behind by a mouse click must not.
    function keyboardFocused() {
      var el = document.activeElement;
      if (!el || !dock.contains(el)) return false;
      try { return el.matches(':focus-visible'); } catch (err) { return true; }
    }
    function render() {
      var keep = hovering || menuOpen() || keyboardFocused();
      dock.classList.toggle('is-away', !(past && (active || keep)));
    }
    function poke() {
      var now = Date.now();
      if (active && now - lastPoke < 200) return;   // pointermove fires constantly; five resets a second is plenty
      lastPoke = now;
      active = true;
      clearTimeout(timer);
      timer = setTimeout(function () { active = false; render(); }, idleFor);
      render();
    }
    function measure() {
      var y = window.pageYOffset;
      var max = document.documentElement.scrollHeight - window.innerHeight;
      past = y > window.innerHeight * 0.6;
      if (ring) ring.style.strokeDashoffset = (RING_LENGTH * (1 - (max > 0 ? Math.min(1, Math.max(0, y / max)) : 0))).toFixed(2);
    }
    function setMenu(open) {
      if (!menu || !toggle) return;
      menu.classList.toggle('is-open', open);
      toggle.setAttribute('aria-expanded', String(open));
      if (open) render(); else poke();
    }

    window.addEventListener('scroll', function () { measure(); poke(); }, { passive: true });
    window.addEventListener('resize', function () { measure(); render(); });
    window.addEventListener('pointermove', poke, { passive: true });
    window.addEventListener('pointerdown', poke, { passive: true });
    window.addEventListener('keydown', poke);
    dock.addEventListener('pointerenter', function () { hovering = true; render(); });
    dock.addEventListener('pointerleave', function () { hovering = false; poke(); });
    dock.addEventListener('focusin', render);
    dock.addEventListener('focusout', function () { setTimeout(render, 0); });

    if (toggle && menu) {
      toggle.addEventListener('click', function () { setMenu(!menuOpen()); });
      $$('a, button', menu).forEach(function (item) { item.addEventListener('click', function () { setMenu(false); }); });
      document.addEventListener('click', function (event) { if (menuOpen() && !dock.contains(event.target)) setMenu(false); });
      document.addEventListener('keydown', function (event) {
        if (event.key === 'Escape' && menuOpen()) { setMenu(false); toggle.focus(); }
      });
    }

    measure();
    render();
  }

  function initTicks() {
    $$('.mig__ticks i').forEach(function (el, index) { el.style.setProperty('--n', index); });
  }

  /* ---------- hero canvas: a dotted terrain that reacts to the pointer ---------- */

  function initField() {
    var canvas = $('.hero__canvas');
    var hero = $('.hero');
    if (!canvas || !hero || !canvas.getContext) return;
    var ctx = canvas.getContext('2d');
    var COLS = 92, ROWS = 34;
    var width = 0, height = 0, raf = 0, visible = true;
    var pointer = { x: -9999, y: -9999, tx: -9999, ty: -9999 };

    function resize() {
      var dpr = Math.min(window.devicePixelRatio || 1, 2);
      width = canvas.clientWidth;
      height = canvas.clientHeight;
      canvas.width = Math.round(width * dpr);
      canvas.height = Math.round(height * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    }

    function draw(time) {
      var t = time * 0.001;
      pointer.x += (pointer.tx - pointer.x) * 0.08;
      pointer.y += (pointer.ty - pointer.y) * 0.08;
      ctx.clearRect(0, 0, width, height);

      var horizon = height * 0.36;
      var depth = (height - horizon) * 1.08;
      var spacing = (width * 1.95) / COLS;
      var dim = width < 760 ? 0.5 : 1;        // keep the copy readable on phones
      var cx = width / 2;
      var radius = Math.max(140, width * 0.13);

      for (var r = 0; r < ROWS; r++) {
        var z = 1 + (ROWS - 1 - r) * 0.18;         // 1 = nearest row
        var scale = 1 / z;
        var baseY = horizon + depth * scale;
        var fade = Math.pow(scale, 0.75);
        for (var c = 0; c < COLS; c++) {
          var wave = Math.sin(c * 0.34 + t * 0.9 + r * 0.22) * 16 + Math.cos(r * 0.42 - t * 0.7 + c * 0.08) * 12;
          var x = cx + (c - (COLS - 1) / 2) * spacing * (0.5 + 0.5 * scale);
          var y = baseY + wave * scale;
          var dx = x - pointer.x, dy = y - pointer.y;
          var hit = Math.exp(-(dx * dx + dy * dy) / (radius * radius));
          y -= hit * 46 * scale;
          var size = 0.6 + 2.3 * scale + hit * 1.8;
          var alpha = Math.min(1, (0.16 + fade * 0.62) * dim + hit * 0.6);
          if (hit > 0.04) {
            ctx.fillStyle = 'rgba(255,' + Math.round(240 - hit * 150) + ',' + Math.round(234 - hit * 188) + ',' + alpha.toFixed(3) + ')';
          } else {
            ctx.fillStyle = 'rgba(243,240,234,' + alpha.toFixed(3) + ')';
          }
          ctx.fillRect(x - size / 2, y - size / 2, size, size);
        }
      }
    }

    function loop(time) {
      draw(time);
      raf = requestAnimationFrame(loop);
    }
    function start() { if (!raf && visible && !document.hidden) raf = requestAnimationFrame(loop); }
    function stop() { cancelAnimationFrame(raf); raf = 0; }

    resize();
    window.addEventListener('resize', function () { resize(); if (!animated) draw(0); });

    if (!animated) { draw(0); return; }

    hero.addEventListener('pointermove', function (event) {
      var rect = canvas.getBoundingClientRect();
      pointer.tx = event.clientX - rect.left;
      pointer.ty = event.clientY - rect.top;
    });
    hero.addEventListener('pointerleave', function () { pointer.tx = -9999; pointer.ty = -9999; });
    document.addEventListener('visibilitychange', function () { if (document.hidden) stop(); else start(); });
    if ('IntersectionObserver' in window) {
      new IntersectionObserver(function (entries) {
        visible = entries[0].isIntersecting;
        if (visible) start(); else stop();
      }).observe(hero);
    }
    start();
  }

  /* ---------- boot the static layer, then stop here if motion is off ---------- */

  initClock();
  initCopy();
  initMenu();
  initActiveLink();
  initSpotlight();
  initDock();
  initTicks();
  initField();

  if (!animated) {
    root.classList.add('is-loaded');
    return;
  }

  var gsap = window.gsap;
  var ScrollTrigger = window.ScrollTrigger;
  gsap.registerPlugin(ScrollTrigger);

  /* ---------- smooth scrolling ---------- */

  if (typeof window.Lenis === 'function') {
    lenis = new window.Lenis({ lerp: 0.1, smoothWheel: true });
    lenis.on('scroll', ScrollTrigger.update);
    gsap.ticker.add(function (time) { lenis.raf(time * 1000); });
    gsap.ticker.lagSmoothing(0);
  }

  $$('a[href^="#"]').forEach(function (link) {
    link.addEventListener('click', function (event) {
      var id = link.getAttribute('href');
      var target = id.length > 1 ? $(id) : null;
      if (!target || !lenis) return;
      event.preventDefault();
      lenis.scrollTo(target, { duration: 1.5 });
      history.replaceState(null, '', id);
    });
  });

  /* ---------- text splitting ---------- */

  function splitChars(el) {
    var text = el.textContent;
    el.textContent = '';
    return text.split('').map(function (ch) {
      var span = document.createElement('span');
      span.className = 'char';
      span.textContent = ch;
      el.appendChild(span);
      return span;
    });
  }

  // Wraps every word in a clipping mask so it can slide up, keeping inline markup (em, br) intact.
  function splitWords(el, wordClass, innerClass) {
    var inners = [];
    (function walk(node) {
      Array.prototype.slice.call(node.childNodes).forEach(function (child) {
        if (child.nodeType === 3) {
          var frag = document.createDocumentFragment();
          child.textContent.split(/(\s+)/).forEach(function (token) {
            if (!token) return;
            if (/^\s+$/.test(token)) { frag.appendChild(document.createTextNode(' ')); return; }
            var word = document.createElement('span');
            word.className = wordClass;
            if (innerClass) {
              var inner = document.createElement('span');
              inner.className = innerClass;
              inner.textContent = token;
              word.appendChild(inner);
              inners.push(inner);
            } else {
              word.textContent = token;
              inners.push(word);
            }
            frag.appendChild(word);
          });
          node.replaceChild(frag, child);
        } else if (child.nodeType === 1 && child.tagName !== 'BR') {
          walk(child);
        }
      });
    })(el);
    return inners;
  }

  /* ---------- preloader and hero entrance ---------- */

  var heroChars = [];
  $$('[data-chars]').forEach(function (el) { heroChars = heroChars.concat(splitChars(el)); });
  gsap.set(heroChars, { yPercent: 118 });
  gsap.set('[data-hero-fade]', { opacity: 0, y: 26 });
  gsap.set('[data-hero-badge]', { opacity: 0, scale: 0.2, rotate: -140 });
  gsap.set('.nav > *', { opacity: 0 });

  function heroIntro() {
    gsap.timeline({ defaults: { ease: 'expo.out' } })
      .to(heroChars, { yPercent: 0, duration: 1.3, stagger: 0.05 }, 0)
      .to('.nav > *', { opacity: 1, duration: 0.9, stagger: 0.08 }, 0.25)
      .to('[data-hero-fade]', { opacity: 1, y: 0, duration: 1.1, stagger: 0.12 }, 0.5)
      .to('[data-hero-badge]', { opacity: 1, scale: 1, rotate: 0, duration: 1.3, ease: 'back.out(1.5)' }, 0.65);
  }

  (function runPreloader() {
    var pre = $('.preloader');
    var countEl = $('[data-preload-count]');
    if (!pre || root.classList.contains('is-loaded')) { heroIntro(); return; }
    if (lenis) lenis.stop();
    if (!window.location.hash) window.scrollTo(0, 0);
    var counter = { value: 0 };
    gsap.timeline({
      onComplete: function () {
        root.classList.add('is-loaded');
        if (lenis) lenis.start();
      }
    })
      .to(counter, {
        value: 100, duration: 1.45, ease: 'power2.inOut',
        onUpdate: function () { if (countEl) countEl.textContent = Math.round(counter.value); }
      }, 0)
      .to('.preloader__bar i', { scaleX: 1, duration: 1.45, ease: 'power2.inOut' }, 0)
      .to('.preloader__row', { opacity: 0, y: -18, duration: 0.4, ease: 'power2.in', stagger: 0.05 }, 1.5)
      .to(pre, { yPercent: -100, duration: 0.95, ease: 'expo.inOut' }, 1.7)
      .add(heroIntro, 2.05);
  })();

  /* ---------- hero: typed line, scroll parallax ---------- */

  (function initTyped() {
    var el = $('[data-typed]');
    if (!el) return;
    var words;
    try { words = JSON.parse(el.getAttribute('data-typed')); } catch (err) { return; }
    if (!words || !words.length) return;
    var index = 0, pos = words[0].length, deleting = true;
    (function step() {
      var word = words[index];
      var delay = deleting ? 34 : 68;
      if (deleting) {
        pos -= 1;
        if (pos <= 0) { deleting = false; index = (index + 1) % words.length; delay = 260; }
      } else {
        pos += 1;
        if (pos >= word.length) { deleting = true; delay = 1900; }
      }
      el.textContent = words[index].slice(0, Math.max(pos, 0));
      setTimeout(step, delay);
    })();
  })();

  gsap.to('.hero__stage', { yPercent: -10, ease: 'none', scrollTrigger: { trigger: '.hero', start: 'top top', end: 'bottom top', scrub: true } });
  gsap.to('.hero__canvas', { opacity: 0.15, ease: 'none', scrollTrigger: { trigger: '.hero', start: 'top top', end: 'bottom top', scrub: true } });

  /* ---------- nav, progress bar, marquee velocity ---------- */

  var nav = $('#nav');
  var progressBar = $('.progress i');
  var marqueeGroups = $$('.marquee__group');
  var skewTo = marqueeGroups.length ? gsap.quickTo(marqueeGroups, 'skewX', { duration: 0.5, ease: 'power3.out' }) : null;

  ScrollTrigger.create({
    start: 0,
    end: 'max',
    onUpdate: function (self) {
      var y = self.scroll();
      if (progressBar) progressBar.style.transform = 'scaleX(' + self.progress.toFixed(4) + ')';
      if (nav) {
        nav.classList.toggle('is-scrolled', y > 80);
        var hide = y > 420 && self.direction === 1 && !root.classList.contains('menu-open');
        nav.classList.toggle('is-hidden', hide);
      }
      if (skewTo) skewTo(gsap.utils.clamp(-14, 14, self.getVelocity() / -260));
    }
  });

  /* ---------- reveals ---------- */

  $$('[data-split]').forEach(function (el) {
    var inners = splitWords(el, 'w', 'wi');
    gsap.set(inners, { yPercent: 112 });
    ScrollTrigger.create({
      trigger: el, start: 'top 88%', once: true,
      onEnter: function () { gsap.to(inners, { yPercent: 0, duration: 1.15, ease: 'expo.out', stagger: 0.06 }); }
    });
  });

  gsap.set('.reveal', { opacity: 0, y: 44 });
  ScrollTrigger.batch('.reveal', {
    start: 'top 90%', once: true,
    onEnter: function (els) {
      // After a long jump (anchor link, restored scroll) everything above the viewport enters at once.
      // Show those immediately so the stagger only queues what the visitor can actually see.
      var passed = [], inView = [];
      els.forEach(function (el) { (el.getBoundingClientRect().bottom < 0 ? passed : inView).push(el); });
      if (passed.length) gsap.set(passed, { opacity: 1, y: 0, clearProps: 'transform' });
      if (inView.length) gsap.to(inView, { opacity: 1, y: 0, duration: 1, ease: 'expo.out', stagger: 0.09, clearProps: 'transform' });
    }
  });

  // The About statement brightens word by word as it is read.
  $$('[data-fill]').forEach(function (el) {
    var words = splitWords(el, 'fw', null);
    gsap.set(words, { opacity: 0.14 });
    gsap.to(words, {
      opacity: 1, ease: 'none', stagger: 0.06,
      scrollTrigger: { trigger: el, start: 'top 82%', end: 'bottom 48%', scrub: true }
    });
  });

  $$('[data-count]').forEach(function (el) {
    var target = parseFloat(el.getAttribute('data-count'));
    var state = { value: 0 };
    el.textContent = '0';
    ScrollTrigger.create({
      trigger: el, start: 'top 92%', once: true,
      onEnter: function () {
        gsap.to(state, {
          value: target, duration: target > 50 ? 2.2 : 1.4, ease: 'power3.out',
          onUpdate: function () { el.textContent = Math.round(state.value); }
        });
      }
    });
  });

  function scramble(el) {
    var finalText = el.textContent;
    var glyphs = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789/#_';
    var frame = 0, total = 22;
    (function tick() {
      var out = '';
      for (var i = 0; i < finalText.length; i++) {
        var ch = finalText.charAt(i);
        if (ch === ' ' || i < (frame / total) * finalText.length) out += ch;
        else out += glyphs.charAt(Math.floor(Math.random() * glyphs.length));
      }
      el.textContent = out;
      frame += 1;
      if (frame <= total) setTimeout(tick, 32); else el.textContent = finalText;
    })();
  }
  $$('[data-scramble]').forEach(function (el) {
    ScrollTrigger.create({ trigger: el, start: 'top 92%', once: true, onEnter: function () { scramble(el); } });
  });

  /* ---------- work: stacked cards ---------- */

  var mm = gsap.matchMedia();
  mm.add('(min-width: 1024px) and (min-height: 620px)', function () {
    var wrap = $('.cases');
    var cases = $$('.case');
    if (!wrap || cases.length < 2) return undefined;

    // Sticky elements report their stuck position, so natural offsets are derived from the wrapper.
    var naturalTop = function (index) {
      var y = wrap.getBoundingClientRect().top + window.pageYOffset;
      var gap = parseFloat(getComputedStyle(wrap).rowGap) || 0;
      for (var k = 0; k < index; k++) y += cases[k].offsetHeight + gap;
      return y;
    };
    var stickyTop = function (el) { return parseFloat(getComputedStyle(el).top) || 0; };
    var measure = function () {
      cases.forEach(function (el) { el.style.setProperty('--h', el.offsetHeight + 'px'); });
    };
    measure();
    ScrollTrigger.addEventListener('refreshInit', measure);

    cases.forEach(function (el, i) {
      if (i === cases.length - 1) return;
      gsap.to($('.case__card', el), {
        scale: 0.93, '--shade': 0.6, ease: 'none',
        scrollTrigger: {
          start: function () { return naturalTop(i + 1) - window.innerHeight; },
          end: function () { return naturalTop(i + 1) - stickyTop(cases[i + 1]); },
          scrub: true, invalidateOnRefresh: true
        }
      });
    });

    return function () {
      ScrollTrigger.removeEventListener('refreshInit', measure);
      cases.forEach(function (el) { el.style.removeProperty('--h'); });
    };
  });

  /* ---------- section-specific motion ---------- */

  gsap.from('.idea', {
    scale: 0.9, ease: 'none',
    scrollTrigger: { trigger: '.idea', start: 'top bottom', end: 'top 35%', scrub: true }
  });

  if ($('.proc__line i')) {
    gsap.to('.proc__line i', {
      scaleX: 1, ease: 'none',
      scrollTrigger: { trigger: '.proc', start: 'top 78%', end: 'top 32%', scrub: true }
    });
  }

  if ($('.timeline__rail i')) {
    gsap.to('.timeline__rail i', {
      scaleY: 1, ease: 'none',
      scrollTrigger: { trigger: '.timeline', start: 'top 70%', end: 'bottom 62%', scrub: true }
    });
  }

  /* ---------- pointer extras (desktop only) ---------- */

  if (finePointer) {
    (function initCursor() {
      var cursor = $('.cursor');
      var label = $('.cursor__label');
      if (!cursor) return;
      var moveX = gsap.quickTo(cursor, 'x', { duration: 0.28, ease: 'power3.out' });
      var moveY = gsap.quickTo(cursor, 'y', { duration: 0.28, ease: 'power3.out' });
      window.addEventListener('pointermove', function (event) {
        moveX(event.clientX);
        moveY(event.clientY);
        cursor.classList.add('is-on');
      });
      document.addEventListener('pointerleave', function () { cursor.classList.remove('is-on'); });
      document.addEventListener('pointerover', function (event) {
        var target = event.target.closest ? event.target.closest('a, button, [data-cursor], .chips li') : null;
        var text = target ? target.getAttribute('data-cursor') : null;
        cursor.classList.toggle('is-hover', !!target && !text);
        cursor.classList.toggle('is-label', !!text);
        if (label) label.textContent = text || '';
      });
    })();

    $$('[data-magnetic]').forEach(function (el) {
      var toX = gsap.quickTo(el, 'x', { duration: 0.6, ease: 'elastic.out(1, 0.5)' });
      var toY = gsap.quickTo(el, 'y', { duration: 0.6, ease: 'elastic.out(1, 0.5)' });
      el.addEventListener('pointermove', function (event) {
        var rect = el.getBoundingClientRect();
        toX((event.clientX - rect.left - rect.width / 2) * 0.32);
        toY((event.clientY - rect.top - rect.height / 2) * 0.32);
      });
      el.addEventListener('pointerleave', function () { toX(0); toY(0); });
    });

    $$('[data-tilt]').forEach(function (el) {
      var rotX = gsap.quickTo(el, 'rotationX', { duration: 0.5, ease: 'power3.out' });
      var rotY = gsap.quickTo(el, 'rotationY', { duration: 0.5, ease: 'power3.out' });
      el.addEventListener('pointermove', function (event) {
        var rect = el.getBoundingClientRect();
        rotY(((event.clientX - rect.left) / rect.width - 0.5) * 12);
        rotX(((event.clientY - rect.top) / rect.height - 0.5) * -12);
      });
      el.addEventListener('pointerleave', function () { rotX(0); rotY(0); });
    });
  }

  /* ---------- keep measurements honest once fonts and images settle ---------- */

  if (document.fonts && document.fonts.ready) {
    document.fonts.ready.then(function () { ScrollTrigger.refresh(); });
    // The font stylesheet does not block the page, so fonts can arrive after the first layout.
    // Measure again whenever a batch of them finishes loading.
    if (document.fonts.addEventListener) {
      document.fonts.addEventListener('loadingdone', function () { ScrollTrigger.refresh(); });
    }
  }
  window.addEventListener('load', function () { ScrollTrigger.refresh(); });
})();
