// KayanOS guide — page behaviour for the home page and the chapter pages:
// scroll-spy contents, a step navigator that crosses chapter pages, Ctrl+K
// search over the whole guide, progress saved in this browser (shared by all
// pages and both languages), theme and language switches that keep your place,
// scroll reveals and the screenshot lightbox. Without JavaScript every page
// is still a plain readable page with working links.
(() => {
  const $ = (s, el = document) => el.querySelector(s);
  const $$ = (s, el = document) => [...el.querySelectorAll(s)];
  const root = document.documentElement;
  const helpDialog = $('#guide-help');
  const helpButton = $('[data-open-help]');
  let helpScroll = 0;
  const openHelp = () => {
    if (!helpDialog || helpDialog.open) return;
    helpScroll = window.scrollY;
    helpDialog.showModal();
  };
  helpButton?.addEventListener('click', openHelp);
  helpDialog?.addEventListener('click', event => {
    const box = helpDialog.getBoundingClientRect();
    if (event.target === helpDialog && (event.clientX < box.left || event.clientX > box.right || event.clientY < box.top || event.clientY > box.bottom)) helpDialog.close();
  });
  helpDialog?.addEventListener('close', () => {
    helpButton?.focus({ preventScroll: true });
    window.scrollTo({ top: helpScroll, behavior: 'instant' });
  });
  const showLinkedHelp = () => {
    if (location.hash !== '#guide-help') return;
    history.replaceState(null, '', location.pathname + location.search);
    openHelp();
  };
  window.addEventListener('hashchange', showLinkedHelp);
  showLinkedHelp();
  const data = JSON.parse($('#guide-data').textContent);
  const ui = data.ui;
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const all = data.steps; // every step of the guide, in order: {id, p (page), c (chapter), t, n}
  const index = new Map(all.map((s, i) => [s.id, i]));
  const pageOf = (id) => data.routes?.[id] ?? `${id.split('-')[0]}.html`;

  // Old single-page links (index.html#c2-s4) and links to another chapter's
  // step land on the right chapter page.
  const redirectMovedAnchor = () => {
    const wanted = decodeURIComponent(location.hash.slice(1));
    // Anchors of content that moved to a dedicated page.
    const moved = data.legacy?.[`${data.page}#${wanted}`];
    if (wanted && moved && !document.getElementById(wanted)) {
      location.replace(moved);
      return true;
    }
    if (wanted && !document.getElementById(wanted) && /^[cb]\d+/.test(wanted) && pageOf(wanted) !== data.page) {
      location.replace(`${pageOf(wanted)}#${wanted}`);
      return true;
    }
    return false;
  };
  window.addEventListener('hashchange', redirectMovedAnchor);
  if (redirectMovedAnchor()) return;

  // ---------------------------------------------------------------- storage
  const store = {
    get(k, d) { try { const v = localStorage.getItem(k); return v == null ? d : JSON.parse(v); } catch { return d; } },
    set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch { /* private mode */ } },
  };
  const KEY = data.store || 'kos-guide-progress'; // the main and Builder guides keep separate progress
  const state = store.get(KEY, { done: {}, checks: {}, last: null });
  const save = () => store.set(KEY, state);

  // ---------------------------------------------------------------- toast
  const toast = $('.toast');
  let toastT;
  const say = (msg) => { toast.textContent = msg; toast.classList.add('show'); clearTimeout(toastT); toastT = setTimeout(() => toast.classList.remove('show'), 1800); };

  // ---------------------------------------------------------------- theme
  const withTransition = (fn) => {
    if (!document.startViewTransition || reduce) { fn(); return; }
    const t = document.startViewTransition(fn);
    t.ready.catch(() => { /* skipped transition: the change still applies */ });
  };
  $('[data-theme-toggle]').addEventListener('click', () => {
    const next = root.dataset.theme === 'light' ? 'dark' : 'light';
    withTransition(() => { root.dataset.theme = next; });
    try { localStorage.setItem('kos-guide-theme', next); } catch { /* ignore */ }
  });

  // ---------------------------------------------------------------- short mode
  // Hides the explanations and keeps examples, pictures and steps. Saved per browser.
  const shortBtn = $('[data-short-toggle]');
  if (shortBtn) {
    const paint = () => shortBtn.setAttribute('aria-pressed', String(root.dataset.short === 'on'));
    paint();
    shortBtn.addEventListener('click', () => {
      const on = root.dataset.short !== 'on';
      if (on) root.dataset.short = 'on'; else delete root.dataset.short;
      try { localStorage.setItem('kos-guide-short', on ? 'on' : 'off'); } catch { /* ignore */ }
      paint();
      say(shortBtn.title + (on ? ' ✓' : ''));
    });
  }

  // ---------------------------------------------------------------- navigation
  const steps = $$('.step'); // the steps on this page
  let current = null;
  let lockUntil = 0; // scroll-spy pauses while go() scrolls to a chosen step

  // Scrolls to an id on this page, or opens the chapter page that holds it.
  const go = (id, { flash = true } = {}) => {
    const el = document.getElementById(id);
    if (!el) { location.href = id.includes('-') ? `${pageOf(id)}#${id}` : pageOf(id); return; }
    closeToc();
    history.replaceState(null, '', `#${id}`);
    const step = el.closest('.step');
    if (step) { setCurrent(step); lockUntil = performance.now() + (reduce ? 50 : 900); }
    el.scrollIntoView({ behavior: reduce ? 'auto' : 'smooth', block: 'start' });
    if (flash && step && !reduce) { step.classList.remove('flash'); void step.offsetWidth; step.classList.add('flash'); }
  };

  // In-page links scroll smoothly and keep the hash in sync; other pages load normally.
  document.addEventListener('click', (e) => {
    const a = e.target.closest('a[href^="#"]');
    if (!a || e.metaKey || e.ctrlKey || e.shiftKey) return;
    const id = a.getAttribute('href').slice(1);
    if (!id || !document.getElementById(id)) return;
    e.preventDefault();
    go(id);
  });

  // ---------------------------------------------------------------- progress
  const paint = () => {
    const doneCount = all.filter((s) => state.done[s.id]).length;
    for (const s of steps) {
      const on = !!state.done[s.id];
      s.classList.toggle('is-done', on);
      $('[data-done]', s).setAttribute('aria-pressed', String(on));
    }
    $$('[data-toc]').forEach((a) => a.classList.toggle('done', !!state.done[a.dataset.toc]));
    for (const c of data.chapters) {
      const own = all.filter((s) => s.c === c.id);
      const n = own.filter((s) => state.done[s.id]).length;
      const pct = own.length ? Math.round((n / own.length) * 100) : 0;
      $$(`[data-chapter-bar="${c.id}"]`).forEach((b) => { b.style.width = `${pct}%`; });
      $$(`[data-ring="${c.id}"] .ring-val`).forEach((r) => r.style.setProperty('--off', String(100 - pct)));
    }
    const pct = Math.round((doneCount / all.length) * 100);
    $$('[data-total-pct]').forEach((el) => { el.textContent = `${pct}%`; });
    $$('[data-total-count]').forEach((el) => { el.textContent = `${doneCount}/${all.length}`; });
    $$('[data-total-bar]').forEach((el) => { el.style.width = `${pct}%`; });
    document.body.classList.toggle('has-progress', doneCount > 0 || !!state.last);
    const cont = $('[data-continue]');
    if (cont && state.last && index.has(state.last)) cont.setAttribute('href', `${pageOf(state.last)}#${state.last}`);
  };

  document.addEventListener('click', (e) => {
    const btn = e.target.closest('[data-done]');
    if (!btn) return;
    const id = btn.dataset.done;
    if (state.done[id]) delete state.done[id]; else state.done[id] = 1;
    save(); paint();
    if (state.done[id]) {
      const ch = all[index.get(id)].c;
      if (all.filter((s) => s.c === ch).every((s) => state.done[s.id])) say(ui.chapterDone);
    }
  });

  $$('[data-check]').forEach((box) => {
    box.checked = !!state.checks[box.dataset.check];
    box.addEventListener('change', () => {
      if (box.checked) state.checks[box.dataset.check] = 1; else delete state.checks[box.dataset.check];
      save();
    });
  });

  const resetDialog = $('.reset-dialog');
  resetDialog.addEventListener('keydown', (event) => {
    if (event.key !== 'Tab') return;
    const buttons = $$('button', resetDialog);
    const first = buttons[0], last = buttons.at(-1);
    if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
    else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
  });
  $$('[data-reset]').forEach((b) => b.addEventListener('click', () => {
    resetDialog.returnValue = '';
    resetDialog.showModal();
  }));
  resetDialog.addEventListener('click', (event) => {
    const rect = resetDialog.getBoundingClientRect();
    if (event.target === resetDialog && (event.clientX < rect.left || event.clientX > rect.right || event.clientY < rect.top || event.clientY > rect.bottom)) {
      resetDialog.close('cancel');
    }
  });
  resetDialog.addEventListener('close', () => {
    if (resetDialog.returnValue !== 'reset') return;
    state.done = {}; state.checks = {}; state.last = null; save();
    $$('[data-check]').forEach((x) => { x.checked = false; });
    paint();
    const cont = $('[data-continue]');
    if (cont && all[0]) cont.href = `${pageOf(all[0].id)}#${all[0].id}`;
  });

  // ---------------------------------------------------------------- copy link
  document.addEventListener('click', async (e) => {
    const btn = e.target.closest('[data-copy]');
    if (!btn) return;
    const url = `${location.href.split('#')[0]}#${btn.dataset.copy}`;
    try { await navigator.clipboard.writeText(url); } catch { /* file:// or denied */ }
    history.replaceState(null, '', `#${btn.dataset.copy}`);
    say(ui.copied);
  });

  // ---------------------------------------------------------------- scroll spy + stepper
  const stepper = $('.stepper');
  const countEl = $('[data-step-count]');
  const titleEl = $('[data-step-title]');
  const prevBtn = $('[data-step-prev]');
  const nextBtn = $('[data-step-next]');

  const setCurrent = (step) => {
    if (step === current) return;
    current?.classList.remove('active');
    current = step;
    $$('.toc-secs a.active').forEach((a) => a.classList.remove('active'));
    if (!step) return;
    step.classList.add('active');
    const i = index.get(step.id);
    if (stepper) {
      countEl.textContent = `${i + 1}/${all.length}`;
      titleEl.textContent = all[i].t;
      prevBtn.disabled = i === 0;
      nextBtn.disabled = i === all.length - 1;
    }
    const link = $(`.toc [data-toc="${step.id}"]`);
    if (link) {
      link.classList.add('active');
      const toc = $('#toc');
      if (getComputedStyle(toc).position === 'sticky') {
        const r = link.getBoundingClientRect(), t = toc.getBoundingClientRect();
        if (r.top < t.top + 60 || r.bottom > t.bottom - 20) toc.scrollTo({ top: toc.scrollTop + (r.top - t.top) - t.height / 3, behavior: 'smooth' });
      }
    }
    state.last = step.id; save();
  };

  let ticking = false;
  const onScroll = () => {
    ticking = false;
    const max = document.documentElement.scrollHeight - innerHeight;
    $('.read-progress span').style.transform = `scaleX(${max > 0 ? Math.min(1, scrollY / max) : 0})`;
    if (!steps.length || performance.now() < lockUntil) return;
    const line = innerHeight * 0.32;
    let found = steps[0]; // before the first step, the navigator shows it
    for (const s of steps) {
      if (s.getBoundingClientRect().top <= line) found = s; else break;
    }
    // At the end of the page the last steps can't reach the reading line: the
    // last step becomes current, unless a later step was just chosen (go()).
    if (scrollY >= max - 4) {
      const chosen = current && index.get(current.id) > index.get(found.id);
      found = chosen ? current : steps[steps.length - 1];
    }
    setCurrent(found);
  };
  addEventListener('scroll', () => { if (!ticking) { ticking = true; requestAnimationFrame(onScroll); } }, { passive: true });
  addEventListener('resize', onScroll);

  // Previous / next step, moving to the neighbouring chapter page at the edges.
  const move = (d) => {
    if (!steps.length) { go(all[0].id); return; }
    const i = current ? index.get(current.id) : index.get(steps[0].id);
    const target = all[Math.max(0, Math.min(all.length - 1, i + d))];
    if (target && target.id !== current?.id) go(target.id);
  };
  if (stepper) {
    prevBtn.addEventListener('click', () => move(-1));
    nextBtn.addEventListener('click', () => move(1));
    requestAnimationFrame(() => stepper.classList.add('show'));
  }

  // ---------------------------------------------------------------- mobile contents drawer
  const openToc = () => {
    const toc = $('#toc');
    if (!toc) return;
    document.body.classList.add('toc-open');
    const active = $('#toc a.active');
    if (active) toc.scrollTop = active.offsetTop - toc.clientHeight / 2; // the drawer only, not the page
    setTimeout(() => (active || $('#toc a'))?.focus({ preventScroll: true }), 300);
  };
  function closeToc() { document.body.classList.remove('toc-open'); }
  $$('[data-open-toc]').forEach((b) => b.addEventListener('click', openToc));
  $$('[data-close-toc]').forEach((b) => b.addEventListener('click', closeToc));
  $('[data-open-toc-mobile]')?.addEventListener('click', () => {
    if (matchMedia('(max-width: 920px)').matches) openToc(); else openPalette();
  });

  // ---------------------------------------------------------------- search palette (whole guide)
  const pal = $('.palette');
  const input = $('input', pal);
  const list = $('.palette-list', pal);
  let results = [];
  let sel = 0;
  let lastFocus = null;
  const norm = (s) => s.toLowerCase()
    .replace(/[ً-ٰٟ]/g, '') // Arabic diacritics
    .replace(/[أإآ]/g, 'ا').replace(/ى/g, 'ي').replace(/ة/g, 'ه');
  const escH = (s) => s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const href = (x) => (x.p === data.page ? `#${x.id}` : x.id.includes('-') ? `${x.p}#${x.id}` : x.p);
  const mark = (text, q) => {
    if (!q) return escH(text);
    const i = norm(text).indexOf(q);
    if (i < 0) return escH(text);
    return `${escH(text.slice(0, i))}<mark>${escH(text.slice(i, i + q.length))}</mark>${escH(text.slice(i + q.length))}`;
  };
  const snippet = (text, q) => {
    const i = norm(text).indexOf(q);
    if (i < 0) return '';
    const s = Math.max(0, i - 40);
    return `${s ? '…' : ''}${mark(text.slice(s, i + q.length + 80), q)}…`;
  };
  const render = () => {
    const q = norm(input.value.trim());
    if (!q) results = data.search.filter((x) => !x.sub).map((x) => ({ x, html: '' }));
    else {
      results = data.search.map((x) => {
        const t = norm(x.t), c = norm(x.c), body = norm(x.x);
        let score = 0;
        if (t.includes(q)) score = t.startsWith(q) ? 100 : 80;
        else if (c.includes(q)) score = 30;
        else if (body.includes(q)) score = 20;
        return { x, score, html: score === 20 ? snippet(x.x, q) : '' };
      }).filter((r) => r.score > 0).sort((a, b) => b.score - a.score).slice(0, 40);
    }
    sel = 0;
    list.innerHTML = results.length ? results.map((r, i) => `<li class="${r.x.sub ? 'sub' : ''}${r.x.chapter ? ' chap' : ''}${i === sel ? ' sel' : ''}" role="option" aria-selected="${i === sel}"><a href="${href(r.x)}" data-id="${r.x.id}"><span class="p-no" dir="ltr">${escH(r.x.n || '')}</span><span class="p-txt"><span class="p-t">${mark(r.x.t, q)}</span>${r.html ? `<span class="p-x">${r.html}</span>` : r.x.c ? `<span class="p-c">${escH(r.x.c)}</span>` : ''}</span></a></li>`).join('')
      : `<li class="palette-empty">${escH(ui.noResults)}</li>`;
  };
  const highlight = () => {
    $$('li', list).forEach((li, i) => { li.classList.toggle('sel', i === sel); li.setAttribute('aria-selected', String(i === sel)); });
    $$('li', list)[sel]?.scrollIntoView({ block: 'nearest' });
  };
  function openPalette() {
    lastFocus = document.activeElement;
    pal.hidden = false; input.value = ''; render();
    requestAnimationFrame(() => input.focus());
  }
  const closePalette = () => { pal.hidden = true; lastFocus?.focus?.({ preventScroll: true }); };
  $$('[data-open-search]').forEach((b) => b.addEventListener('click', openPalette));
  input.addEventListener('input', render);
  input.addEventListener('keydown', (e) => {
    if (e.key === 'ArrowDown') { e.preventDefault(); sel = Math.min(results.length - 1, sel + 1); highlight(); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); sel = Math.max(0, sel - 1); highlight(); }
    else if (e.key === 'Enter') { e.preventDefault(); const r = results[sel]; if (r) { closePalette(); go(r.x.id); } }
  });
  pal.addEventListener('click', (e) => {
    if (e.target === pal) closePalette();
    const a = e.target.closest('a[data-id]');
    if (a && !e.ctrlKey && !e.metaKey) { e.preventDefault(); e.stopPropagation(); closePalette(); go(a.dataset.id); }
  });

  // ---------------------------------------------------------------- keyboard
  document.addEventListener('keydown', (e) => {
    if (resetDialog.open) return; // Keep guide shortcuts inactive while the modal is open.
    const typing = /INPUT|TEXTAREA|SELECT/.test(document.activeElement?.tagName);
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') { e.preventDefault(); pal.hidden ? openPalette() : closePalette(); return; }
    if (e.key === 'Escape') { if (!pal.hidden) closePalette(); closeLightbox(); closeToc(); return; }
    if (typing || !pal.hidden) return;
    if (e.key === '/') { e.preventDefault(); openPalette(); }
    else if (e.key === ']') move(1);
    else if (e.key === '[') move(-1);
  });

  // ---------------------------------------------------------------- language switch keeps your place
  $$('[data-lang-switch]').forEach((a) => a.addEventListener('click', () => {
    const id = current?.id || location.hash.slice(1);
    a.href = `../${a.dataset.langSwitch}/${data.page}${id ? `#${id}` : ''}`;
    try { localStorage.setItem('kos-guide-lang', a.dataset.langSwitch); } catch { /* ignore */ }
  }));

  // ---------------------------------------------------------------- lightbox
  const lb = $('.lightbox');
  const lbImg = $('img', lb);
  function closeLightbox() { if (!lb.hidden) lb.hidden = true; }
  document.addEventListener('click', (e) => {
    const z = e.target.closest('[data-zoom]');
    if (z) { const img = $('img', z); lbImg.src = img.currentSrc || img.src; lbImg.alt = img.alt; lb.hidden = false; lb.scrollTop = 0; $('.lightbox-close', lb).focus(); return; }
    if (!lb.hidden && e.target.closest('.lightbox')) closeLightbox();
  });

  // ---------------------------------------------------------------- hover glow on chapter cards
  $$('.path-card').forEach((c) => c.addEventListener('pointermove', (e) => {
    const r = c.getBoundingClientRect();
    c.style.setProperty('--mx', `${e.clientX - r.left}px`); c.style.setProperty('--my', `${e.clientY - r.top}px`);
  }));

  // ---------------------------------------------------------------- reveals
  // A deep link reveals everything up to its target before animations switch
  // on, so nothing above it is mid-transition when the page jumps there.
  const wanted = decodeURIComponent(location.hash.slice(1));
  const hashTarget = wanted ? document.getElementById(wanted) : null;
  if (hashTarget) {
    $$('.reveal, .reveal-step').forEach((el) => {
      if (el.compareDocumentPosition(hashTarget) & Node.DOCUMENT_POSITION_FOLLOWING || el.contains(hashTarget)) el.classList.add('in');
    });
  }
  if (!reduce && 'IntersectionObserver' in window) {
    root.classList.add('anim');
    const io = new IntersectionObserver((entries) => {
      for (const en of entries) if (en.isIntersecting) { en.target.classList.add('in'); io.unobserve(en.target); }
    }, { rootMargin: '0px 0px -8% 0px', threshold: 0.06 });
    $$('.reveal, .reveal-step, .diagram-card').forEach((el) => { if (!el.classList.contains('in')) io.observe(el); });
  }

  // ---------------------------------------------------------------- start
  paint();
  onScroll();
  if (hashTarget) {
    // Jump instantly, then again once web fonts have settled the layout.
    const land = () => {
      hashTarget.scrollIntoView({ block: 'start', behavior: 'instant' });
      const step = hashTarget.closest('.step');
      if (step) setCurrent(step);
      onScroll();
    };
    requestAnimationFrame(land);
    document.fonts?.ready.then(() => requestAnimationFrame(land));
  }
})();
