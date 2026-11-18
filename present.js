/*
 * Present: a hymn's words on a TV or a projector, one part at a time.
 *
 * The website's copy of Present in the app (lyrics_present_screen.dart),
 * asked for by the owner on 2026-11-18, and made to behave the same:
 *
 * - The slides: the hymn's names first, then the song in the order it is
 *   sung (a chorus written once comes back after every verse followed by
 *   another verse or by the end; two different choruses are shown as
 *   written), parts longer than six lines cut into even screens, and a
 *   dark screen at the end, so the wall goes quiet when the song does.
 * - The words as large as the screen allows, measured, so a long Amharic
 *   line wraps rather than shrinking to nothing.
 * - Three looks, dark (the default: a projector shows dark as no light at
 *   all), light, and Gubae, from a palette in the bar, kept on this device.
 * - The arrows, Page Up and Page Down (what a presentation clicker sends),
 *   Space and Enter; Escape leaves. A tap on the left third goes back, any
 *   other tap goes on, and a swipe goes either way.
 *
 * The words are read from the page itself, so the wall and the page agree.
 * The colours are the site's own, read from styles.css (its :root rule is
 * the light theme, :root[data-theme="dark"] the dark one); none is written
 * here. Every Amharic word below is the app's own, from app_am.arb.
 */
(function () {
  'use strict';

  var opener = document.querySelector('[data-present]');
  var sheet = document.querySelector('.song-words');
  if (!opener || !sheet) return;

  var KEY = 'gubae.presentLook';
  var LOOKS = ['dark', 'light', 'gubae'];
  var MAX_LINES = 6;

  // readerPresent, closeLabel, bibleSettingsTheme, themeDark, themeLight and
  // appTitle in the app. It has no words of its own for previous and next,
  // so those stay English, as the page's own A- and A+ do.
  var WORDS = {
    en: {present: 'Present', close: 'Close', colour: 'Page colour',
         dark: 'Dark', light: 'Light', gubae: 'Gubae'},
    am: {present: 'ሙሉ ስክሪን', close: 'ዝጋ', colour: 'የገጽ ቀለም',
         dark: 'ጨለማ', light: 'ብሩህ', gubae: 'ጉባኤ'}
  };

  function say(key) {
    return WORDS[document.documentElement.lang === 'en' ? 'en' : 'am'][key];
  }

  // ---------------------------------------------------------- the slides

  function parts() {
    var out = [];
    Array.prototype.forEach.call(sheet.querySelectorAll('p'), function (p) {
      var lines = (p.textContent || '').split('\n')
        .map(function (line) { return line.replace(/\s+$/, ''); })
        .filter(function (line) { return line.trim() !== ''; });
      if (lines.length) {
        out.push({text: lines.join('\n'), chorus: p.classList.contains('chorus')});
      }
    });
    return out;
  }

  function sungOrder(list) {
    var choruses = list.filter(function (part) { return part.chorus; });
    if (!choruses.length) return list;
    var one = choruses[0].text.trim();
    if (choruses.some(function (c) { return c.text.trim() !== one; })) return list;
    var out = [];
    list.forEach(function (part, i) {
      out.push(part);
      if (part.chorus) return;
      var next = list[i + 1];
      if (!next || !next.chorus) out.push(choruses[0]);
    });
    return out;
  }

  function splitForScreen(text) {
    var lines = text.split('\n');
    if (lines.length <= MAX_LINES) return [text];
    var size = Math.ceil(lines.length / Math.ceil(lines.length / MAX_LINES));
    var out = [];
    for (var i = 0; i < lines.length; i += size) {
      out.push(lines.slice(i, i + size).join('\n'));
    }
    return out;
  }

  function slides() {
    var list = [{kind: 'title', text: opener.getAttribute('data-title') || '',
                 sub: opener.getAttribute('data-sub') || ''}];
    sungOrder(parts()).forEach(function (part) {
      splitForScreen(part.text).forEach(function (screen) {
        list.push({kind: 'words', text: screen});
      });
    });
    list.push({kind: 'end'});
    return list;
  }

  // --------------------------------------------------------- the colours

  function palettes() {
    var want = ['--bg', '--ink', '--brand', '--brand-ink'];
    var found = {light: {}, dark: {}};
    Array.prototype.forEach.call(document.styleSheets, function (css) {
      var rules;
      try { rules = css.cssRules; } catch (e) { return; }   // the fonts, from Google
      Array.prototype.forEach.call(rules || [], function (rule) {
        var theme = rule.selectorText === ':root' ? 'light'
          : rule.selectorText === ':root[data-theme="dark"]' ? 'dark' : '';
        if (!theme) return;
        want.forEach(function (name) {
          var value = rule.style.getPropertyValue(name).trim();
          if (value) found[theme][name] = value;
        });
      });
    });
    // Were styles.css ever to keep its colours elsewhere, the page's own
    // stand in, rather than no colour at all.
    var page = getComputedStyle(document.documentElement);
    ['light', 'dark'].forEach(function (theme) {
      want.forEach(function (name) {
        if (!found[theme][name]) found[theme][name] = page.getPropertyValue(name).trim();
      });
    });
    var light = found.light, dark = found.dark;
    return {
      dark: {bg: dark['--bg'], ink: dark['--ink'], accent: dark['--brand']},
      light: {bg: light['--bg'], ink: light['--ink'], accent: light['--brand']},
      // White on the brand's indigo, with the gold for the progress line,
      // which in indigo would vanish into the screen.
      gubae: {bg: light['--brand'], ink: light['--brand-ink'], accent: dark['--brand']}
    };
  }

  function savedLook() {
    var look = null;
    try { look = localStorage.getItem(KEY); } catch (e) { /* a private window */ }
    return LOOKS.indexOf(look) >= 0 ? look : 'dark';
  }

  function keepLook(look) {
    try { localStorage.setItem(KEY, look); } catch (e) { /* nothing to do */ }
  }

  // ---------------------------------------------------------- the screen

  var CSS = [
    '.pz{position:fixed;inset:0;z-index:1000;display:flex;flex-direction:column;',
    'background:var(--pz-bg);color:var(--pz-ink);font-family:var(--ui);outline:none;',
    '-webkit-user-select:none;user-select:none;touch-action:none;overflow:hidden}',
    '.pz-stage{flex:1;min-height:0;display:flex;align-items:center;justify-content:center;',
    'padding:24px clamp(16px,5vw,56px) 8px;cursor:pointer}',
    '.pz-slide{width:100%;max-height:100%;display:flex;flex-direction:column;',
    'align-items:center;justify-content:center;gap:12px;text-align:center}',
    '.pz-in{animation:pz-in .2s ease}',
    '@keyframes pz-in{from{opacity:0}to{opacity:1}}',
    '.pz-slide p{margin:0;width:100%;white-space:pre-line;overflow-wrap:break-word;line-height:1.35}',
    '.pz-words{font-weight:700}',
    '.pz-title{font-weight:800}',
    '.pz-sub{font-weight:400;opacity:.75}',
    '.pz-bar{display:flex;align-items:center;gap:2px;',
    'padding:0 8px calc(3px + env(safe-area-inset-bottom,0px))}',
    '.pz-bar button{flex:none;display:inline-flex;align-items:center;justify-content:center;',
    'width:44px;height:44px;padding:0;border:0;border-radius:50%;background:none;',
    'color:inherit;opacity:.5;cursor:pointer}',
    '.pz-bar button:hover,.pz-bar button:focus-visible,.pz-bar button[aria-pressed="true"]{opacity:1}',
    '.pz-bar button:focus-visible{outline:2px solid var(--pz-accent);outline-offset:-4px}',
    '.pz-bar button:disabled{opacity:.18;cursor:default}',
    '.pz-bar svg{width:24px;height:24px}',
    '.pz-looks{display:flex}',
    '.pz-swatch span{display:grid;place-items:center;width:24px;height:24px;border-radius:50%;',
    'box-shadow:0 0 0 1.5px currentColor}',
    '.pz-swatch[aria-pressed="true"] span{box-shadow:0 0 0 2.5px currentColor}',
    '.pz-swatch i{width:8px;height:8px;border-radius:50%}',
    '.pz-gap{flex:1}',
    '.pz-count{opacity:.5;font-size:.85rem;font-variant-numeric:tabular-nums;padding:0 2px}',
    '.pz-progress{position:absolute;left:0;bottom:0;height:3px;width:0;',
    'background:var(--pz-accent);opacity:.6;transition:width .2s ease}',
    '.pz-idle,.pz-idle *{cursor:none!important}',
    '@media (prefers-reduced-motion:reduce){.pz-in{animation:none}.pz-progress{transition:none}}'
  ].join('');

  var ICONS = {
    close: '<path d="M6 6l12 12M18 6L6 18"/>',
    colour: '<circle cx="12" cy="12" r="8.5"/><path d="M12 3.5a8.5 8.5 0 0 1 0 17z" fill="currentColor"/>',
    back: '<path d="M15 5l-7 7 7 7"/>',
    next: '<path d="M9 5l7 7-7 7"/>'
  };

  function button(name, label, toggle) {
    return '<button type="button" data-do="' + name + '" aria-label="' + label +
      '" title="' + label + '"' + (toggle ? ' aria-pressed="false"' : '') + '>' +
      '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" ' +
      'stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' +
      ICONS[name] + '</svg></button>';
  }

  var now = null;   // the presentation on the screen, or none

  function open() {
    if (now) return;
    if (!document.getElementById('pz-style')) {
      var style = document.createElement('style');
      style.id = 'pz-style';
      style.textContent = CSS;
      document.head.appendChild(style);
    }
    var root = document.createElement('div');
    root.className = 'pz';
    root.tabIndex = -1;
    root.setAttribute('role', 'dialog');
    root.setAttribute('aria-modal', 'true');
    root.setAttribute('aria-label', say('present'));
    root.innerHTML =
      '<div class="pz-stage"><div class="pz-slide" aria-live="polite"></div></div>' +
      '<div class="pz-bar">' +
      button('close', say('close')) +
      button('colour', say('colour'), true) +
      '<div class="pz-looks" hidden></div>' +
      '<span class="pz-gap"></span>' +
      button('back', 'Previous') +
      '<span class="pz-count"></span>' +
      button('next', 'Next') +
      '</div><div class="pz-progress"></div>';

    now = {root: root, slides: slides(), index: 0, pal: palettes(), look: savedLook(),
           overflow: document.documentElement.style.overflow, inert: [],
           pushed: false, wasFull: false, lock: null, idle: 0, frame: 0, down: null};

    root.querySelector('.pz-looks').innerHTML = LOOKS.map(function (look) {
      var c = now.pal[look];
      return '<button type="button" class="pz-swatch" data-look="' + look +
        '" aria-pressed="false" aria-label="' + say(look) + '" title="' + say(look) + '">' +
        '<span style="background:' + c.bg + '"><i style="background:' + c.ink + '"></i></span></button>';
    }).join('');

    document.body.appendChild(root);
    // Everything behind it is out of reach of Tab and of a screen reader.
    Array.prototype.forEach.call(document.body.children, function (el) {
      if (el !== root && !el.inert) { el.inert = true; now.inert.push(el); }
    });
    document.documentElement.style.overflow = 'hidden';
    paint(now.look);

    // Back, on a phone, leaves the screen, as it does in the app.
    try { history.pushState({gubaePresent: true}, ''); now.pushed = true; } catch (e) { /* none */ }

    var stage = root.querySelector('.pz-stage');
    stage.addEventListener('pointerdown', onDown);
    stage.addEventListener('pointerup', onUp);
    stage.addEventListener('pointercancel', function () { if (now) now.down = null; });
    root.querySelector('.pz-bar').addEventListener('click', onBar);
    root.addEventListener('mousemove', stir);
    document.addEventListener('keydown', onKey, true);
    window.addEventListener('popstate', onPop);
    window.addEventListener('resize', fitSoon);
    document.addEventListener('fullscreenchange', onFull);
    document.addEventListener('webkitfullscreenchange', onFull);
    document.addEventListener('visibilitychange', wake);

    full();
    wake();
    stir();
    render();
    root.focus();
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(fitSoon);
  }

  function close() {
    if (!now) return;
    var was = now;
    now = null;
    document.removeEventListener('keydown', onKey, true);
    window.removeEventListener('popstate', onPop);
    window.removeEventListener('resize', fitSoon);
    document.removeEventListener('fullscreenchange', onFull);
    document.removeEventListener('webkitfullscreenchange', onFull);
    document.removeEventListener('visibilitychange', wake);
    clearTimeout(was.idle);
    if (was.frame) cancelAnimationFrame(was.frame);
    if (was.lock) was.lock.release().catch(function () { /* already gone */ });
    if (fullElement() === was.root) {
      var leave = document.exitFullscreen || document.webkitExitFullscreen;
      try {
        var done = leave.call(document);
        if (done && done.catch) done.catch(function () { /* already out */ });
      } catch (e) { /* already out */ }
    }
    was.inert.forEach(function (el) { el.inert = false; });
    was.root.remove();
    document.documentElement.style.overflow = was.overflow;
    if (was.pushed && history.state && history.state.gubaePresent) history.back();
    opener.focus();
  }

  function paint(look) {
    var c = now.pal[look];
    now.look = look;
    now.root.style.setProperty('--pz-bg', c.bg);
    now.root.style.setProperty('--pz-ink', c.ink);
    now.root.style.setProperty('--pz-accent', c.accent);
    Array.prototype.forEach.call(now.root.querySelectorAll('[data-look]'), function (b) {
      b.setAttribute('aria-pressed', String(b.getAttribute('data-look') === look));
    });
  }

  function showLooks(on) {
    now.root.querySelector('.pz-looks').hidden = !on;
    now.root.querySelector('[data-do="colour"]').setAttribute('aria-pressed', String(on));
  }

  function go(step) {
    var to = Math.max(0, Math.min(now.slides.length - 1, now.index + step));
    if (to === now.index) return;
    now.index = to;
    showLooks(false);
    render();
  }

  function render() {
    var s = now.slides[now.index];
    var slide = now.root.querySelector('.pz-slide');
    slide.textContent = '';
    if (s.kind === 'title') {
      line(slide, 'pz-title', s.text);
      if (s.sub) line(slide, 'pz-sub', s.sub);
    } else if (s.kind === 'words') {
      line(slide, 'pz-words', s.text);
    }
    slide.classList.remove('pz-in');
    void slide.offsetWidth;              // so the fade starts again
    slide.classList.add('pz-in');
    fit();
    var count = now.slides.length;
    now.root.querySelector('.pz-count').textContent = (now.index + 1) + ' / ' + count;
    now.root.querySelector('[data-do="back"]').disabled = now.index === 0;
    now.root.querySelector('[data-do="next"]').disabled = now.index === count - 1;
    now.root.querySelector('.pz-progress').style.width = ((now.index + 1) / count * 100) + '%';
  }

  function line(parent, kind, text) {
    var p = document.createElement('p');
    p.className = kind;
    p.textContent = text;
    parent.appendChild(p);
  }

  // The app's fitFontSize: the largest size from 14 to max at which the
  // text, wrapped to the width, is no taller than the room it has.
  function size(el, width, height, max) {
    function fits(px) {
      el.style.fontSize = px + 'px';
      return el.scrollHeight <= height && el.scrollWidth <= width;
    }
    var low = 14, high = max;
    if (fits(high) || !fits(low)) return;
    for (var i = 0; i < 12; i++) {
      var middle = (low + high) / 2;
      if (fits(middle)) low = middle; else high = middle;
    }
    el.style.fontSize = low + 'px';
  }

  function fit() {
    if (!now) return;
    var stage = now.root.querySelector('.pz-stage');
    var cs = getComputedStyle(stage);
    var width = stage.clientWidth - parseFloat(cs.paddingLeft) - parseFloat(cs.paddingRight);
    var height = stage.clientHeight - parseFloat(cs.paddingTop) - parseFloat(cs.paddingBottom);
    var words = now.root.querySelector('.pz-words');
    var title = now.root.querySelector('.pz-title');
    var sub = now.root.querySelector('.pz-sub');
    if (words) size(words, width, height, 120);
    if (title) size(title, width, sub ? height * 0.6 : height, 72);
    if (sub) size(sub, width, height * 0.25, 32);
  }

  function fitSoon() {
    if (!now || now.frame) return;
    now.frame = requestAnimationFrame(function () {
      if (!now) return;
      now.frame = 0;
      fit();
    });
  }

  // ------------------------------------------------------ hands and keys

  function onKey(e) {
    if (!now || e.altKey || e.ctrlKey || e.metaKey) return;
    var k = e.key;
    var onButton = e.target && e.target.closest && e.target.closest('.pz-bar button');
    var step = 0;
    if (k === 'ArrowRight' || k === 'ArrowDown' || k === 'PageDown' ||
        ((k === ' ' || k === 'Spacebar' || k === 'Enter') && !onButton)) {
      step = 1;
    } else if (k === 'ArrowLeft' || k === 'ArrowUp' || k === 'PageUp') {
      step = -1;
    } else if (k === 'Escape' || k === 'Esc') {
      e.preventDefault();
      e.stopPropagation();
      close();
      return;
    } else {
      return;
    }
    e.preventDefault();
    e.stopPropagation();
    go(step);
  }

  function onDown(e) {
    if (e.button !== 0) return;
    now.down = {x: e.clientX, y: e.clientY};
  }

  function onUp(e) {
    var d = now && now.down;
    if (!d) return;
    now.down = null;
    var dx = e.clientX - d.x, dy = e.clientY - d.y;
    if (Math.abs(dx) > 40 && Math.abs(dx) > Math.abs(dy)) {
      go(dx < 0 ? 1 : -1);               // a swipe to the left goes on
    } else if (Math.abs(dx) < 12 && Math.abs(dy) < 12) {
      go(e.clientX < window.innerWidth * 0.3 ? -1 : 1);
    }
  }

  function onBar(e) {
    var b = e.target.closest('button');
    if (!b || b.disabled || !now) return;
    var what = b.getAttribute('data-do');
    if (what === 'close') {
      close();
    } else if (what === 'colour') {
      showLooks(now.root.querySelector('.pz-looks').hidden);
    } else if (what === 'back') {
      go(-1);
    } else if (what === 'next') {
      go(1);
    } else if (b.hasAttribute('data-look')) {
      var look = b.getAttribute('data-look');
      paint(look);
      keepLook(look);
      showLooks(false);
    }
  }

  function onPop() {
    if (!now) return;
    now.pushed = false;
    close();
  }

  // The mouse pointer goes after a moment's stillness, off the wall.
  function stir() {
    if (!now) return;
    now.root.classList.remove('pz-idle');
    clearTimeout(now.idle);
    now.idle = setTimeout(function () { if (now) now.root.classList.add('pz-idle'); }, 2500);
  }

  // ------------------------------------------- full screen, screen awake

  function fullElement() {
    return document.fullscreenElement || document.webkitFullscreenElement || null;
  }

  // Asked for, never required: an iPhone will not give a page the whole
  // screen, and the page is covered all the same.
  function full() {
    var ask = now.root.requestFullscreen || now.root.webkitRequestFullscreen;
    if (!ask) return;
    try {
      var asked = ask.call(now.root);
      if (asked && asked.catch) asked.catch(function () { /* covered all the same */ });
    } catch (e) { /* covered all the same */ }
  }

  function onFull() {
    if (!now) return;
    if (fullElement() === now.root) {
      now.wasFull = true;
    } else if (now.wasFull) {
      // Escape in full screen belongs to the browser, and means leave. A
      // phone that only went to another app keeps its place instead.
      setTimeout(function () {
        if (now && !document.hidden && !fullElement()) close();
      }, 150);
    }
    fitSoon();
  }

  function wake() {
    if (!now || now.lock || !navigator.wakeLock || document.visibilityState !== 'visible') return;
    navigator.wakeLock.request('screen').then(function (lock) {
      if (!now) { lock.release(); return; }
      now.lock = lock;
      lock.addEventListener('release', function () {
        if (now && now.lock === lock) now.lock = null;
      });
    }).catch(function () { /* not allowed here: the screen may sleep */ });
  }

  // ------------------------------------------------------------- start

  // As in the app, only a hymn with words to show offers to show them.
  if (!parts().length) return;
  opener.addEventListener('click', open);
  var holder = opener.closest('[hidden]');
  if (holder) holder.hidden = false;
})();
