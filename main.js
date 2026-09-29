/* ==========================================================================
   SEPNO — Seguridad y Protección del Norte
   main.js · JavaScript nativo (sin dependencias obligatorias)

   Opcional: Lenis (CDN) aporta el scroll suave con inercia. Si no carga,
   el sitio funciona igual con el scroll nativo.

   Módulos:
     1. Utilidades y estado          8. Hero: canvas, HUD, rotador, tilt
     2. Loader (spinner de carga)    9. Cursor · Magnetismo · Spotlight
     3. Scroll suave + funciones    10. Servicios (tabs)
     4. Header y menú móvil         11. Modelo (scroll-telling)
     5. Navegación por anclas       12. Carruseles horizontales
     6. Reveal y texto por palabras 13. Lightbox de infografías
     7. Contadores                  14. Formulario → WhatsApp
                                    15. Mapa · Marquee · Extras · Init
   ========================================================================== */
'use strict';

(() => {
  /* Avisa al salvavidas del <head> que el script sí arrancó */
  window.__sepnoReady = true;

  /* ------------------------------------------------------------------------
     1. UTILIDADES Y ESTADO
     ------------------------------------------------------------------------ */
  const $ = (sel, ctx = document) => ctx.querySelector(sel);
  const $$ = (sel, ctx = document) => Array.from(ctx.querySelectorAll(sel));
  const clamp = (v, a, b) => Math.min(Math.max(v, a), b);
  const lerp = (a, b, t) => a + (b - a) * t;
  const easeOutCubic = (t) => 1 - Math.pow(1 - t, 3);
  const easeOutExpo = (t) => (t === 1 ? 1 : 1 - Math.pow(2, -10 * t));

  const root = document.documentElement;
  const mqReduce = window.matchMedia('(prefers-reduced-motion: reduce)');
  const mqFine = window.matchMedia('(hover: hover) and (pointer: fine)');
  const mqDesktopNav = window.matchMedia('(min-width: 1100px)');
  const mqPinned = window.matchMedia('(min-width: 1024px) and (min-height: 700px) and (prefers-reduced-motion: no-preference)');
  const reduced = () => mqReduce.matches;

  const state = {
    lenis: null,
    menuOpen: false,
    heroVisible: true,
    scrollFns: [],
    resizeFns: []
  };

  /** Ejecuta un módulo sin que un error tumbe al resto del sitio */
  const safe = (fn, name) => {
    try { fn(); } catch (err) { console.error('[SEPNO] Error en módulo:', name || fn.name, err); }
  };

  const lockScroll = () => { root.classList.add('is-locked'); if (state.lenis) state.lenis.stop(); };
  const unlockScroll = () => { root.classList.remove('is-locked'); if (state.lenis && !state.menuOpen) state.lenis.start(); };


  /* ------------------------------------------------------------------------
     2. LOADER · Spinner de carga
        Progreso simulado + carga real (fuentes, emblema, window.load).
        Al terminar: las cortinas se abren y arranca la entrada del hero.
     ------------------------------------------------------------------------ */
  function initLoader() {
    const el = $('#loader');
    if (!el) { revealSite(); return; }

    const bar = $('#loaderBar');
    const pct = $('#loaderPct');
    const status = $('#loaderStatus');
    const stages = [
      [0, 'Iniciando protocolos'],
      [22, 'Verificando perímetro'],
      [48, 'Sincronizando cobertura Hidalgo · Coahuila'],
      [72, 'Activando monitoreo 24/7'],
      [96, 'Sistema operativo']
    ];
    const minTime = reduced() ? 450 : 2700;
    const t0 = performance.now();
    let progress = 0;
    let loaded = document.readyState === 'complete';
    let assetsReady = false;
    let finished = false;
    let lastStage = -1;

    if (!loaded) window.addEventListener('load', () => { loaded = true; }, { once: true });

    const emblem = new Image();
    emblem.src = 'imagenes/logo-sepno.webp';
    Promise.all([
      document.fonts && document.fonts.ready ? document.fonts.ready : Promise.resolve(),
      emblem.decode ? emblem.decode().catch(() => {}) : Promise.resolve()
    ]).then(() => { assetsReady = true; }, () => { assetsReady = true; });

    function render(p) {
      const v = Math.round(p);
      if (bar) bar.style.width = p.toFixed(1) + '%';
      if (pct) pct.textContent = String(v);
      let s = 0;
      stages.forEach((st, i) => { if (v >= st[0]) s = i; });
      if (s !== lastStage && status) { lastStage = s; status.textContent = stages[s][1]; }
    }

    function finish() {
      if (finished) return;
      finished = true;
      render(100);
      el.classList.add('is-done');
      setTimeout(revealSite, reduced() ? 60 : 520);
      setTimeout(() => el.remove(), reduced() ? 300 : 1900);
    }

    function tick(now) {
      if (finished) return;
      const elapsed = now - t0;
      let target = easeOutCubic(clamp(elapsed / minTime, 0, 1)) * 92;
      if (loaded && assetsReady && elapsed >= minTime) target = 100;
      progress = lerp(progress, target, 0.09);
      if (target === 100 && progress > 99.3) progress = 100;
      render(progress);
      if (progress >= 100) { finish(); return; }
      requestAnimationFrame(tick);
    }

    requestAnimationFrame(tick);
    setTimeout(finish, 7500); // salvavidas: nunca dejar al usuario esperando
  }

  /** Quita el bloqueo, activa animaciones de entrada y arranca el hero */
  let siteRevealed = false;
  function revealSite() {
    if (siteRevealed) return;
    siteRevealed = true;
    root.classList.remove('is-loading');
    root.classList.add('is-ready');
    const loader = $('#loader');
    if (loader) { loader.classList.add('is-done'); setTimeout(() => loader.remove(), 1900); }
    if (state.lenis) state.lenis.start();
    safe(startHero, 'startHero');
    // Ir a la sección indicada en la URL (si la hay)
    if (location.hash && location.hash.length > 1) {
      let target = null;
      try { target = $(decodeURIComponent(location.hash)); } catch (err) { target = null; }
      if (target) setTimeout(() => scrollToTarget(target, true), 200);
    }
    // Pista visual del botón de WhatsApp
    const wa = $('#waFloat');
    if (wa && !reduced()) {
      setTimeout(() => wa.classList.add('is-hinted'), 3500);
      setTimeout(() => wa.classList.remove('is-hinted'), 9000);
    }
  }
  // Red de seguridad global
  setTimeout(() => { if (!siteRevealed) revealSite(); }, 9500);


  /* ------------------------------------------------------------------------
     3. SCROLL SUAVE (Lenis, opcional) + FUNCIONES LIGADAS AL SCROLL
     ------------------------------------------------------------------------ */
  function initSmoothScroll() {
    if (reduced() || typeof window.Lenis !== 'function') return;
    const lenis = new window.Lenis({
      lerp: 0.085,           // inercia: menor = más lento y suave
      wheelMultiplier: 0.92,
      smoothWheel: true,
      syncTouch: false
    });
    state.lenis = lenis;
    lenis.stop(); // se libera cuando termina el loader
    const raf = (time) => { lenis.raf(time); requestAnimationFrame(raf); };
    requestAnimationFrame(raf);
  }

  function scrollToTarget(target, instant = false) {
    if (target === null || target === undefined) return;
    if (typeof target === 'number') {
      if (state.lenis) state.lenis.scrollTo(target, { duration: instant ? 0.01 : 1.6, immediate: instant });
      else window.scrollTo({ top: target, behavior: instant || reduced() ? 'auto' : 'smooth' });
      return;
    }
    if (state.lenis) {
      state.lenis.scrollTo(target, { offset: 0, duration: instant ? 0.01 : 1.6, easing: (t) => 1 - Math.pow(1 - t, 4), immediate: instant });
    } else {
      const top = target.getBoundingClientRect().top + window.scrollY;
      window.scrollTo({ top, behavior: instant || reduced() ? 'auto' : 'smooth' });
    }
  }

  function initScrollFns() {
    const bar = $('#scrollBar');
    const header = $('#header');
    const hud = $('#hud');
    const copy = $('.hero__copy');
    let lastY = window.scrollY;

    const run = () => {
      const y = window.scrollY;
      const vh = window.innerHeight;

      // Barra de progreso de lectura
      if (bar) {
        const max = root.scrollHeight - vh;
        bar.style.transform = `scaleX(${max > 0 ? clamp(y / max, 0, 1) : 0})`;
      }

      // Header: cristal al bajar; se oculta al bajar rápido y reaparece al subir
      if (header) {
        header.classList.toggle('is-scrolled', y > 24);
        if (!state.menuOpen) {
          if (y > 500 && y > lastY + 6) header.classList.add('is-hidden');
          else if (y < lastY - 6 || y < 500) header.classList.remove('is-hidden');
        }
      }
      lastY = y;

      // Hero: parallax de profundidad al salir (solo escritorio; en móvil se deja el flujo natural)
      if (y < vh * 1.3 && !reduced() && window.innerWidth >= 960) {
        const k = clamp(y / vh, 0, 1.2);
        if (hud) hud.style.transform = `translate3d(0, ${(y * 0.16).toFixed(1)}px, 0) scale(${(1 - k * 0.05).toFixed(3)})`;
        if (copy) copy.style.opacity = String(clamp(1 - k * 0.5, 0, 1));
      } else if (hud && hud.style.transform) {
        hud.style.transform = '';
        if (copy) copy.style.opacity = '';
      }

      state.scrollFns.forEach((fn) => fn(y));
    };

    let ticking = false;
    const onScroll = () => {
      if (ticking) return;
      ticking = true;
      requestAnimationFrame(() => { ticking = false; run(); });
    };
    window.addEventListener('scroll', onScroll, { passive: true });
    run();

    let rt;
    window.addEventListener('resize', () => {
      clearTimeout(rt);
      rt = setTimeout(() => { state.resizeFns.forEach((fn) => fn()); run(); }, 160);
    }, { passive: true });
  }


  /* ------------------------------------------------------------------------
     4. HEADER Y MENÚ MÓVIL
     ------------------------------------------------------------------------ */
  function initMenu() {
    const burger = $('#burger');
    const nav = $('#nav');
    if (!burger || !nav) return;

    const setOpen = (open) => {
      state.menuOpen = open;
      nav.classList.toggle('is-open', open);
      burger.setAttribute('aria-expanded', String(open));
      burger.setAttribute('aria-label', open ? 'Cerrar menú' : 'Abrir menú');
      root.classList.toggle('menu-open', open);
      root.classList.toggle('is-locked', open);
      if (state.lenis) { open ? state.lenis.stop() : state.lenis.start(); }
      if (open) $('#header').classList.remove('is-hidden');
    };

    burger.addEventListener('click', () => setOpen(!state.menuOpen));
    $$('a', nav).forEach((a) => a.addEventListener('click', () => { if (state.menuOpen) setOpen(false); }));
    document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && state.menuOpen) { setOpen(false); burger.focus(); } });
    mqDesktopNav.addEventListener('change', (e) => { if (e.matches && state.menuOpen) setOpen(false); });
  }


  /* ------------------------------------------------------------------------
     5. NAVEGACIÓN POR ANCLAS + ENLACE ACTIVO
     ------------------------------------------------------------------------ */
  function initAnchors() {
    document.addEventListener('click', (e) => {
      const a = e.target.closest && e.target.closest('a[href^="#"]');
      if (!a) return;
      const id = a.getAttribute('href');
      if (!id || id === '#') return;
      const target = $(id);
      if (!target) return;
      e.preventDefault();
      if (a.dataset.openTab) selectServiceTab(a.dataset.openTab);
      scrollToTarget(id === '#inicio' ? 0 : target);
      if (history.pushState) history.pushState(null, '', id);
    });

    // Enlace activo según la sección en pantalla
    const links = $$('[data-nav]');
    const map = new Map(links.map((l) => [l.getAttribute('href').slice(1), l]));
    if (!('IntersectionObserver' in window)) return;
    const io = new IntersectionObserver((entries) => {
      entries.forEach((en) => {
        if (!en.isIntersecting) return;
        links.forEach((l) => l.classList.remove('is-active'));
        const l = map.get(en.target.id);
        if (l) l.classList.add('is-active');
      });
    }, { rootMargin: '-45% 0px -50% 0px' });
    $$('main section[id]').forEach((s) => io.observe(s));
  }


  /* ------------------------------------------------------------------------
     6. REVEAL AL SCROLL + TEXTO POR PALABRAS
     ------------------------------------------------------------------------ */
  function splitWords(el) {
    let i = 0;
    const label = el.textContent.trim().replace(/\s+/g, ' ');
    const walk = (node) => {
      Array.from(node.childNodes).forEach((child) => {
        if (child.nodeType === 3) {
          const frag = document.createDocumentFragment();
          child.textContent.split(/(\s+)/).forEach((part) => {
            if (!part) return;
            if (/^\s+$/.test(part)) { frag.appendChild(document.createTextNode(' ')); return; }
            const w = document.createElement('span');
            const inner = document.createElement('span');
            w.className = 'w';
            inner.className = 'w__in';
            inner.style.setProperty('--wi', String(i++));
            inner.textContent = part;
            w.setAttribute('aria-hidden', 'true');
            w.appendChild(inner);
            frag.appendChild(w);
          });
          child.replaceWith(frag);
        } else if (child.nodeType === 1) {
          walk(child);
        }
      });
    };
    walk(el);
    el.setAttribute('aria-label', label);
  }

  function initReveal() {
    const splits = $$('[data-split]');
    splits.forEach(splitWords);

    // Escalonado automático para listas
    $$('[data-stagger]').forEach((box) => {
      $$(':scope > [data-reveal]', box).forEach((child, i) => child.style.setProperty('--d', (i * 0.07).toFixed(2) + 's'));
    });

    const items = $$('[data-reveal]').concat(splits);
    if (!('IntersectionObserver' in window) || reduced()) {
      items.forEach((el) => el.classList.add('is-in'));
      return;
    }
    const io = new IntersectionObserver((entries) => {
      entries.forEach((en) => {
        if (en.isIntersecting) { en.target.classList.add('is-in'); io.unobserve(en.target); }
      });
    }, { threshold: 0.12, rootMargin: '0px 0px -6% 0px' });
    items.forEach((el) => io.observe(el));
  }


  /* ------------------------------------------------------------------------
     7. CONTADORES ANIMADOS
     ------------------------------------------------------------------------ */
  function initCounters() {
    $$('[data-count]').forEach((el) => { el.dataset.final = el.dataset.count; el.textContent = '0'; });
  }
  function armCounters() {
    const els = $$('[data-count]');
    const animate = (el) => {
      const target = parseFloat(el.dataset.final || el.dataset.count) || 0;
      if (reduced()) { el.textContent = target.toLocaleString('es-MX'); return; }
      const dur = 2200;
      const t0 = performance.now();
      const step = (now) => {
        const p = clamp((now - t0) / dur, 0, 1);
        el.textContent = Math.round(easeOutExpo(p) * target).toLocaleString('es-MX');
        if (p < 1) requestAnimationFrame(step);
      };
      requestAnimationFrame(step);
    };
    if (!('IntersectionObserver' in window)) { els.forEach(animate); return; }
    const io = new IntersectionObserver((entries) => {
      entries.forEach((en) => { if (en.isIntersecting) { animate(en.target); io.unobserve(en.target); } });
    }, { threshold: 0.6 });
    els.forEach((el) => io.observe(el));
  }


  /* ------------------------------------------------------------------------
     8. HERO: entrada, canvas de partículas, HUD, rotador de palabras, tilt
     ------------------------------------------------------------------------ */
  function startHero() {
    safe(initHeroCanvas, 'canvas');
    safe(initRotator, 'rotator');
    safe(initHudTilt, 'tilt');
    setTimeout(armCounters, 900);
  }

  /* Red de partículas conectadas con paquetes de datos y reacción al cursor */
  function initHeroCanvas() {
    const canvas = $('#heroCanvas');
    if (!canvas) return;
    const hero = canvas.parentElement;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let W = 0, H = 0, dpr = 1, parts = [], packets = [];
    let raf = 0, running = false;
    const mouse = { x: -9999, y: -9999 };
    const COLORS = ['147,175,255', '200,210,235', '255,191,61', '93,134,255'];

    function build() {
      const n = clamp(Math.round((W * H) / 15500), 26, 100);
      parts = Array.from({ length: n }, () => ({
        x: Math.random() * W, y: Math.random() * H,
        vx: (Math.random() - 0.5) * 0.36, vy: (Math.random() - 0.5) * 0.36,
        r: Math.random() * 1.6 + 0.6, c: COLORS[(Math.random() * COLORS.length) | 0], p: Math.random() * 6.28
      }));
    }

    function resize() {
      const r = hero.getBoundingClientRect();
      dpr = Math.min(window.devicePixelRatio || 1, 2);
      W = Math.max(1, Math.round(r.width));
      H = Math.max(1, Math.round(r.height));
      canvas.width = W * dpr;
      canvas.height = H * dpr;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      build();
      if (!running) draw(performance.now(), true);
    }

    function draw(t, once) {
      if (!once && running) raf = requestAnimationFrame(draw);
      ctx.clearRect(0, 0, W, H);
      const link = W < 700 ? 105 : 150;

      for (let i = 0; i < parts.length; i++) {
        const p = parts[i];
        if (!once) {
          // interacción con el cursor: atracción suave
          const mdx = mouse.x - p.x, mdy = mouse.y - p.y;
          const md = Math.hypot(mdx, mdy);
          if (md < 190 && md > 1) { p.vx += (mdx / md) * 0.010; p.vy += (mdy / md) * 0.010; }
          p.vx = clamp(p.vx * 0.995, -0.7, 0.7);
          p.vy = clamp(p.vy * 0.995, -0.7, 0.7);
          p.x += p.vx; p.y += p.vy;
          if (p.x < -10) p.x = W + 10; else if (p.x > W + 10) p.x = -10;
          if (p.y < -10) p.y = H + 10; else if (p.y > H + 10) p.y = -10;
        }
        const a = 0.55 + 0.3 * Math.sin(t * 0.002 + p.p);
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.r, 0, 6.2832);
        ctx.fillStyle = `rgba(${p.c},${a.toFixed(2)})`;
        ctx.fill();

        for (let j = i + 1; j < parts.length; j++) {
          const q = parts[j];
          const dx = p.x - q.x, dy = p.y - q.y;
          const d = Math.hypot(dx, dy);
          if (d < link) {
            ctx.strokeStyle = `rgba(143,169,255,${((1 - d / link) * 0.3).toFixed(3)})`;
            ctx.lineWidth = 0.7;
            ctx.beginPath(); ctx.moveTo(p.x, p.y); ctx.lineTo(q.x, q.y); ctx.stroke();
            // paquetes de datos viajando por los enlaces
            if (!once && packets.length < 14 && Math.random() < 0.0009) packets.push({ a: p, b: q, t: 0 });
          }
        }

        const cd = Math.hypot(mouse.x - p.x, mouse.y - p.y);
        if (cd < 170) {
          ctx.strokeStyle = `rgba(255,191,61,${((1 - cd / 170) * 0.5).toFixed(3)})`;
          ctx.lineWidth = 0.8;
          ctx.beginPath(); ctx.moveTo(p.x, p.y); ctx.lineTo(mouse.x, mouse.y); ctx.stroke();
        }
      }

      for (let k = packets.length - 1; k >= 0; k--) {
        const pk = packets[k];
        pk.t += 0.018;
        if (pk.t >= 1) { packets.splice(k, 1); continue; }
        const x = lerp(pk.a.x, pk.b.x, pk.t), y = lerp(pk.a.y, pk.b.y, pk.t);
        const g = ctx.createRadialGradient(x, y, 0, x, y, 9);
        g.addColorStop(0, 'rgba(255,214,122,.95)');
        g.addColorStop(1, 'rgba(255,191,61,0)');
        ctx.fillStyle = g;
        ctx.beginPath(); ctx.arc(x, y, 9, 0, 6.2832); ctx.fill();
      }
    }

    const start = () => { if (running || reduced()) return; running = true; raf = requestAnimationFrame(draw); };
    const stop = () => { running = false; cancelAnimationFrame(raf); };

    hero.addEventListener('pointermove', (e) => {
      const r = canvas.getBoundingClientRect();
      mouse.x = e.clientX - r.left; mouse.y = e.clientY - r.top;
    }, { passive: true });
    hero.addEventListener('pointerleave', () => { mouse.x = -9999; mouse.y = -9999; });

    resize();
    state.resizeFns.push(resize);

    if ('IntersectionObserver' in window) {
      new IntersectionObserver((entries) => {
        state.heroVisible = entries[0].isIntersecting;
        state.heroVisible ? start() : stop();
      }, { threshold: 0 }).observe(hero);
    } else { start(); }
    document.addEventListener('visibilitychange', () => { document.hidden ? stop() : (state.heroVisible && start()); });
  }

  /* Palabras que se "decodifican" (efecto scramble) */
  function initRotator() {
    const el = $('#rotator');
    if (!el || reduced()) return;
    const words = (el.dataset.words || '').split('|').filter(Boolean);
    if (words.length < 2) return;
    el.style.setProperty('--rot-w', Math.max(...words.map((w) => w.length)) + 'ch');
    const glyphs = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789#%&/<>+=';
    let idx = 0, frame = 0, queue = [], raf = 0;

    function update() {
      let out = '', done = 0;
      queue.forEach((q) => {
        if (frame >= q.end) { done++; out += q.to; }
        else if (frame >= q.start) {
          if (!q.ch || Math.random() < 0.3) q.ch = glyphs[(Math.random() * glyphs.length) | 0];
          out += `<span class="dim">${q.ch}</span>`;
        } else { out += q.from; }
      });
      el.innerHTML = out;
      if (done < queue.length) { frame++; raf = requestAnimationFrame(update); }
    }
    function scramble(to) {
      const from = el.textContent;
      const len = Math.max(from.length, to.length);
      queue = Array.from({ length: len }, (_, i) => {
        const start = (Math.random() * 12) | 0;
        return { from: from[i] || '', to: to[i] || '', start, end: start + 8 + ((Math.random() * 14) | 0), ch: '' };
      });
      frame = 0;
      cancelAnimationFrame(raf);
      update();
    }
    setTimeout(() => setInterval(() => { idx = (idx + 1) % words.length; scramble(words[idx]); }, 3400), 1500);
  }

  /* Marcas de graduación del HUD (anillo con ticks) */
  function buildHudTicks() {
    const g = $('#hudTicks');
    if (!g) return;
    let out = '';
    for (let i = 0; i < 120; i++) {
      const a = (i * 3 * Math.PI) / 180;
      const major = i % 10 === 0;
      const r1 = major ? 248 : 257, r2 = major ? 272 : 266;
      const c = Math.cos(a), s = Math.sin(a);
      out += `<line class="tick${major ? ' tick--major' : ''}" x1="${(300 + c * r1).toFixed(2)}" y1="${(300 + s * r1).toFixed(2)}" x2="${(300 + c * r2).toFixed(2)}" y2="${(300 + s * r2).toFixed(2)}"/>`;
    }
    g.innerHTML = out;
  }

  /* Inclinación 3D del emblema siguiendo el cursor */
  function initHudTilt() {
    const hero = $('#inicio');
    const tilt = $('#hudTilt');
    if (!hero || !tilt || reduced() || !mqFine.matches) return;
    let tx = 0, ty = 0, cx = 0, cy = 0;
    hero.addEventListener('pointermove', (e) => {
      const r = hero.getBoundingClientRect();
      tx = (e.clientX - r.left) / r.width - 0.5;
      ty = (e.clientY - r.top) / r.height - 0.5;
    }, { passive: true });
    hero.addEventListener('pointerleave', () => { tx = 0; ty = 0; });
    (function loop() {
      requestAnimationFrame(loop);
      if (!state.heroVisible) return;
      cx = lerp(cx, tx, 0.07);
      cy = lerp(cy, ty, 0.07);
      tilt.style.transform = `perspective(1000px) rotateY(${(cx * 18).toFixed(2)}deg) rotateX(${(-cy * 14).toFixed(2)}deg) translate3d(${(cx * 12).toFixed(1)}px, ${(cy * 9).toFixed(1)}px, 0)`;
    })();
  }


  /* ------------------------------------------------------------------------
     9. CURSOR PERSONALIZADO · BOTONES MAGNÉTICOS · SPOTLIGHT DE TARJETAS
     ------------------------------------------------------------------------ */
  function initCursor() {
    if (!mqFine.matches || reduced()) return;
    const el = document.createElement('div');
    el.className = 'cursor';
    el.setAttribute('aria-hidden', 'true');
    el.innerHTML = '<span class="cursor__dot"></span><span class="cursor__ring"></span>';
    document.body.appendChild(el);
    const dot = el.firstChild, ring = el.lastChild;
    let x = -100, y = -100, rx = -100, ry = -100;

    window.addEventListener('pointermove', (e) => {
      x = e.clientX; y = e.clientY;
      el.classList.add('is-on');
      const t = e.target.closest ? e.target : null;
      const hov = t && t.closest('a, button, summary, [role="tab"], label.choice, input, [data-lightbox]');
      el.classList.toggle('is-hover', !!hov);
      el.classList.toggle('is-drag', !hov && !!(t && t.closest('.hscroll__track')));
    }, { passive: true });
    document.addEventListener('pointerleave', () => el.classList.remove('is-on'));
    window.addEventListener('pointerdown', () => el.classList.add('is-down'));
    window.addEventListener('pointerup', () => el.classList.remove('is-down'));

    (function loop() {
      requestAnimationFrame(loop);
      rx = lerp(rx, x, 0.16); ry = lerp(ry, y, 0.16);
      dot.style.transform = `translate3d(${x}px, ${y}px, 0)`;
      ring.style.transform = `translate3d(${rx}px, ${ry}px, 0)`;
    })();
  }

  function initMagnetic() {
    if (!mqFine.matches || reduced()) return;
    $$('[data-magnetic]').forEach((el) => {
      el.addEventListener('pointermove', (e) => {
        const r = el.getBoundingClientRect();
        const x = e.clientX - (r.left + r.width / 2);
        const y = e.clientY - (r.top + r.height / 2);
        el.style.transform = `translate(${(x * 0.2).toFixed(1)}px, ${(y * 0.3).toFixed(1)}px)`;
      });
      el.addEventListener('pointerleave', () => { el.style.transform = ''; });
    });
  }

  function initSpotlight() {
    if (!mqFine.matches) return;
    $$('[data-spotlight]').forEach((el) => {
      el.addEventListener('pointermove', (e) => {
        const r = el.getBoundingClientRect();
        el.style.setProperty('--mx', (e.clientX - r.left).toFixed(0) + 'px');
        el.style.setProperty('--my', (e.clientY - r.top).toFixed(0) + 'px');
      }, { passive: true });
    });
  }


  /* ------------------------------------------------------------------------
     10. SERVICIOS · Tabs accesibles (flechas, Home/End)
     ------------------------------------------------------------------------ */
  let selectServiceTab = () => {};

  function initTabs() {
    const wrap = $('[data-tabs]');
    if (!wrap) return;
    const list = $('.svc__tabs', wrap);
    const tabs = $$('[role="tab"]', wrap);
    const panels = $$('[role="tabpanel"]', wrap);

    function select(tab, focus) {
      tabs.forEach((t) => {
        const on = t === tab;
        t.classList.toggle('is-active', on);
        t.setAttribute('aria-selected', String(on));
        t.tabIndex = on ? 0 : -1;
      });
      panels.forEach((p) => p.classList.toggle('is-active', p.id === tab.getAttribute('aria-controls')));
      if (focus) tab.focus();
      // En móvil las pestañas se desplazan horizontalmente: centrar la activa
      if (list && list.scrollWidth > list.clientWidth + 4) {
        list.scrollTo({ left: tab.offsetLeft - (list.clientWidth - tab.offsetWidth) / 2, behavior: reduced() ? 'auto' : 'smooth' });
      }
    }

    tabs.forEach((t, i) => {
      t.addEventListener('click', () => select(t));
      t.addEventListener('keydown', (e) => {
        const keys = { ArrowRight: 1, ArrowDown: 1, ArrowLeft: -1, ArrowUp: -1 };
        if (e.key in keys) { e.preventDefault(); select(tabs[(i + keys[e.key] + tabs.length) % tabs.length], true); }
        else if (e.key === 'Home') { e.preventDefault(); select(tabs[0], true); }
        else if (e.key === 'End') { e.preventDefault(); select(tabs[tabs.length - 1], true); }
      });
    });

    selectServiceTab = (id) => { const t = document.getElementById(id); if (t) select(t); };
  }


  /* ------------------------------------------------------------------------
     11. MODELO · Scroll-telling (sticky) — progreso 0→1 con el scroll
     ------------------------------------------------------------------------ */
  function initModel() {
    const track = $('#modelTrack');
    if (!track) return;
    const steps = $$('.model__step', track);
    const rail = $$('.model__rail li', track);
    const rings = $$('.mv', track);
    const num = $('#modelNum');
    let current = -1;

    function setActive(i) {
      if (i === current) return;
      current = i;
      steps.forEach((s, k) => s.classList.toggle('is-active', k === i));
      rail.forEach((r, k) => { r.classList.toggle('is-active', k === i); r.classList.toggle('is-done', k < i); });
      rings.forEach((r, k) => r.classList.toggle('is-lit', k <= i));
      if (num) num.textContent = String(i + 1).padStart(2, '0');
    }

    function update() {
      if (!mqPinned.matches) { track.style.removeProperty('--p'); setActive(0); return; }
      const r = track.getBoundingClientRect();
      const total = track.offsetHeight - window.innerHeight;
      if (total <= 0) return;
      const p = clamp(-r.top / total, 0, 1);
      track.style.setProperty('--p', p.toFixed(4));
      setActive(Math.min(steps.length - 1, Math.floor(p * steps.length)));
    }

    state.scrollFns.push(update);
    state.resizeFns.push(update);
    mqPinned.addEventListener('change', () => { current = -1; update(); });
    update();
  }


  /* ------------------------------------------------------------------------
     12. CARRUSELES HORIZONTALES (proyectos e infografías)
         scroll-snap nativo + arrastre con mouse + botones + barra de progreso
     ------------------------------------------------------------------------ */
  function initHScroll() {
    $$('[data-hscroll]').forEach((wrap) => {
      const track = $('.hscroll__track', wrap);
      const barFill = $('.hscroll__bar span', wrap);
      const section = wrap.closest('section') || document;
      const prev = $('[data-hprev]', section);
      const next = $('[data-hnext]', section);
      if (!track) return;

      const update = () => {
        const max = track.scrollWidth - track.clientWidth;
        const vis = track.clientWidth / track.scrollWidth;
        const p = max > 0 ? track.scrollLeft / max : 1;
        if (barFill) barFill.style.setProperty('--prog', clamp(vis + p * (1 - vis), 0, 1).toFixed(3));
        if (prev) prev.disabled = track.scrollLeft < 4;
        if (next) next.disabled = track.scrollLeft >= max - 4;
      };
      track.addEventListener('scroll', update, { passive: true });
      state.resizeFns.push(update);
      update();

      const step = () => {
        const first = track.firstElementChild;
        return first ? first.getBoundingClientRect().width + 16 : 320;
      };
      if (prev) prev.addEventListener('click', () => track.scrollBy({ left: -step(), behavior: 'smooth' }));
      if (next) next.addEventListener('click', () => track.scrollBy({ left: step(), behavior: 'smooth' }));

      // Arrastrar con el mouse
      if (mqFine.matches) {
        let down = false, sx = 0, sl = 0, moved = 0, lastDrag = 0;
        track.addEventListener('pointerdown', (e) => {
          if (e.pointerType !== 'mouse' || e.button !== 0) return;
          down = true; moved = 0; sx = e.clientX; sl = track.scrollLeft;
        });
        window.addEventListener('pointermove', (e) => {
          if (!down) return;
          const dx = e.clientX - sx;
          moved = Math.max(moved, Math.abs(dx));
          if (moved > 5) track.classList.add('is-dragging');
          track.scrollLeft = sl - dx;
        });
        window.addEventListener('pointerup', () => {
          if (!down) return;
          down = false;
          track.classList.remove('is-dragging');
          if (moved > 5) lastDrag = performance.now();
        });
        // Evita abrir el lightbox si el usuario solo arrastró
        track.addEventListener('click', (e) => {
          if (performance.now() - lastDrag < 150) { e.preventDefault(); e.stopPropagation(); }
        }, true);
      }
    });
  }


  /* ------------------------------------------------------------------------
     13. LIGHTBOX · Infografías (<dialog> nativo)
     ------------------------------------------------------------------------ */
  function initLightbox() {
    const dlg = $('#lightbox');
    const items = $$('[data-lightbox]');
    if (!dlg || !items.length) return;
    const img = $('#lbImg');
    const cap = $('#lbCap');
    let idx = 0;
    let lastFocus = null;

    function show(i) {
      idx = (i + items.length) % items.length;
      const b = items[idx];
      const thumb = $('img', b);
      img.style.animation = 'none';
      void img.offsetWidth; // reinicia la animación de entrada
      img.style.animation = '';
      img.src = b.dataset.full;
      img.alt = thumb ? thumb.alt : b.dataset.title;
      cap.textContent = b.dataset.title || '';
      // Precarga de la siguiente
      const n = new Image();
      n.src = items[(idx + 1) % items.length].dataset.full;
    }
    function open(i) {
      lastFocus = document.activeElement;
      show(i);
      if (typeof dlg.showModal === 'function') dlg.showModal(); else dlg.setAttribute('open', '');
      lockScroll();
    }
    function close() {
      if (typeof dlg.close === 'function') dlg.close(); else dlg.removeAttribute('open');
      afterClose();
    }
    function afterClose() {
      unlockScroll();
      if (lastFocus && lastFocus.focus) lastFocus.focus();
    }

    items.forEach((b, i) => b.addEventListener('click', () => open(i)));
    $('[data-lb-close]', dlg).addEventListener('click', close);
    $('[data-lb-prev]', dlg).addEventListener('click', () => show(idx - 1));
    $('[data-lb-next]', dlg).addEventListener('click', () => show(idx + 1));
    dlg.addEventListener('click', (e) => { if (e.target === dlg) close(); });
    dlg.addEventListener('cancel', () => setTimeout(afterClose, 0)); // Esc
    dlg.addEventListener('keydown', (e) => {
      if (e.key === 'ArrowLeft') show(idx - 1);
      else if (e.key === 'ArrowRight') show(idx + 1);
    });
  }


  /* ------------------------------------------------------------------------
     14. FORMULARIO MULTI-PASO → WHATSAPP
     ------------------------------------------------------------------------ */
  function initForm() {
    const form = $('#evalForm');
    if (!form) return;
    const steps = $$('.fstep', form);
    const items = $$('.stepper__item', form);
    const fill = $('#stepperFill');
    const prev = $('#btnPrev');
    const next = $('#btnNext');
    const send = $('#btnSend');
    const done = $('#evalDone');
    const doneLink = $('#doneLink');
    const doneReset = $('#doneReset');
    const WA_NUMBER = '527751911045';
    let cur = 0;

    function render(focusFirst) {
      steps.forEach((s, i) => s.classList.toggle('is-active', i === cur));
      items.forEach((it, i) => {
        it.classList.toggle('is-active', i === cur);
        it.classList.toggle('is-done', i < cur);
        $('span', it).textContent = i < cur ? '✓' : String(i + 1);
      });
      if (fill) fill.style.width = (cur / (steps.length - 1)) * 100 + '%';
      prev.hidden = cur === 0;
      next.hidden = cur === steps.length - 1;
      send.hidden = cur !== steps.length - 1;
      if (focusFirst) {
        const f = $('input:not([type="radio"])', steps[cur]);
        if (f) setTimeout(() => f.focus({ preventScroll: true }), 350);
      }
    }

    function validate(i) {
      let ok = true;
      $$('input[required]', steps[i]).forEach((inp) => {
        const field = inp.closest('.field');
        const err = $('.field__err', field);
        const v = inp.value.trim();
        let msg = '';
        if (!v) msg = 'Este campo es obligatorio.';
        else if (inp.type === 'tel' && v.replace(/\D/g, '').length < 10) msg = 'Ingresa un teléfono de 10 dígitos.';
        else if (inp.type === 'number' && (isNaN(Number(v)) || Number(v) < 0)) msg = 'Ingresa un número válido.';
        field.classList.toggle('has-error', !!msg);
        if (err) err.textContent = msg;
        inp.setAttribute('aria-invalid', msg ? 'true' : 'false');
        if (msg) ok = false;
      });
      if (!ok) { const bad = $('.has-error input', steps[i]); if (bad) bad.focus(); }
      return ok;
    }

    function buildUrl() {
      const d = new FormData(form);
      const get = (k) => String(d.get(k) || '').trim();
      const lines = ['Hola, visité el sitio web de SEPNO y deseo agendar una *evaluación de riesgos*.', ''];
      const add = (label, value) => { if (value) lines.push(`*${label}:* ${value}`); };
      add('Empresa o fraccionamiento', get('empresa'));
      add('Ubicación del inmueble', get('ubicacion'));
      add('Tipo de inmueble', get('tipo'));
      add('Cuenta con seguridad privada', get('seguridad'));
      add('Incidentes recientes', get('incidentes'));
      add('Accesos del inmueble', get('accesos'));
      add('Cámaras de seguridad', get('camaras'));
      add('Objetivo del estudio', get('objetivo'));
      add('Teléfono o WhatsApp', get('telefono'));
      return `https://wa.me/${WA_NUMBER}?text=${encodeURIComponent(lines.join('\n'))}`;
    }

    next.addEventListener('click', () => { if (validate(cur)) { cur++; render(true); } });
    prev.addEventListener('click', () => { cur = Math.max(0, cur - 1); render(true); });

    // Limpia errores al escribir
    form.addEventListener('input', (e) => {
      const field = e.target.closest && e.target.closest('.field');
      if (field && field.classList.contains('has-error')) {
        field.classList.remove('has-error');
        const err = $('.field__err', field);
        if (err) err.textContent = '';
      }
    });

    // Enter avanza de paso en lugar de enviar antes de tiempo
    form.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && e.target.tagName === 'INPUT' && e.target.type !== 'radio' && cur < steps.length - 1) {
        e.preventDefault();
        next.click();
      }
    });

    form.addEventListener('submit', (e) => {
      e.preventDefault();
      if (!validate(cur)) return;
      const url = buildUrl();
      const w = window.open(url, '_blank');
      if (w) w.opener = null; else window.location.href = url;
      if (doneLink) doneLink.href = url;
      if (done) done.hidden = false;
    });

    if (doneReset) {
      doneReset.addEventListener('click', () => {
        form.reset();
        cur = 0;
        done.hidden = true;
        render(true);
      });
    }

    render(false);
  }


  /* ------------------------------------------------------------------------
     15. MAPA (carga diferida) · MARQUEE · EXTRAS · INIT
     ------------------------------------------------------------------------ */
  function initMap() {
    const wrap = $('[data-loc]');
    const frame = $('#mapFrame');
    if (!wrap || !frame) return;
    const tabs = $$('.loc__tab', wrap);
    const cards = [$('#addr-saltillo'), $('#addr-tulancingo')];
    let current = 0;
    let armed = false;

    function select(i, focus) {
      current = i;
      tabs.forEach((t, k) => {
        t.classList.toggle('is-active', k === i);
        t.setAttribute('aria-selected', String(k === i));
        t.tabIndex = k === i ? 0 : -1;
      });
      cards.forEach((c, k) => { if (c) c.classList.toggle('is-active', k === i); });
      if (armed) frame.src = tabs[i].dataset.map;
      if (focus) tabs[i].focus();
    }
    tabs.forEach((t, i) => {
      t.addEventListener('click', () => select(i));
      t.addEventListener('keydown', (e) => {
        if (e.key === 'ArrowRight' || e.key === 'ArrowDown') { e.preventDefault(); select((i + 1) % tabs.length, true); }
        if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') { e.preventDefault(); select((i - 1 + tabs.length) % tabs.length, true); }
      });
    });

    const arm = () => { if (armed) return; armed = true; frame.src = tabs[current].dataset.map; };
    if ('IntersectionObserver' in window) {
      const io = new IntersectionObserver((entries) => {
        if (entries[0].isIntersecting) { arm(); io.disconnect(); }
      }, { rootMargin: '400px 0px' });
      io.observe(wrap);
    } else { arm(); }
  }

  /* Duplica cada grupo del marquee para un bucle infinito sin cortes */
  function initMarquee() {
    $$('[data-marquee]').forEach((m) => {
      const g = $('.marquee__group', m);
      if (!g) return;
      const clone = g.cloneNode(true);
      clone.setAttribute('aria-hidden', 'true');
      m.appendChild(clone);
    });
  }

  function initExtras() {
    const y = $('#year');
    if (y) y.textContent = String(new Date().getFullYear());
    buildHudTicks();
    // Enlace "Abrir en pestaña" del mapa sin JS ya está en el HTML
  }


  /* ------------------------------------------------------------------------
     INIT
     ------------------------------------------------------------------------ */
  safe(initExtras, 'extras');
  safe(initMarquee, 'marquee');
  safe(initCounters, 'counters');
  safe(initReveal, 'reveal');
  safe(initSmoothScroll, 'smooth');
  safe(initScrollFns, 'scroll');
  safe(initMenu, 'menu');
  safe(initAnchors, 'anchors');
  safe(initTabs, 'tabs');
  safe(initModel, 'model');
  safe(initHScroll, 'hscroll');
  safe(initLightbox, 'lightbox');
  safe(initForm, 'form');
  safe(initMap, 'map');
  safe(initSpotlight, 'spotlight');
  safe(initMagnetic, 'magnetic');
  safe(initCursor, 'cursor');
  safe(initLoader, 'loader');
})();
