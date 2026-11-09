/* The language switch, shared by every page.
 *
 * English is the default because that is what the site leads in. A visitor's
 * choice is remembered, but only as a convenience: if storage is unavailable
 * -- a private window, blocked site data -- the page still works, it simply
 * opens in English each time.
 */
(function () {
  'use strict';

  var KEY = 'gubae.lang';

  function stored() {
    try { return localStorage.getItem(KEY); } catch (e) { return null; }
  }

  function remember(lang) {
    try { localStorage.setItem(KEY, lang); } catch (e) { /* nothing to do */ }
  }

  function apply(lang) {
    document.documentElement.lang = lang;
    document.dispatchEvent(new CustomEvent('gubae:lang', { detail: lang }));
  }

  // Amharic unless this reader has chosen otherwise.
  var LANGS = ['am', 'en'];
  var saved = stored();
  apply(LANGS.indexOf(saved) !== -1 ? saved : 'am');

  var picker = document.getElementById('lang-select');
  if (picker) {
    picker.value = document.documentElement.lang;
    picker.addEventListener('change', function () {
      remember(picker.value);
      apply(picker.value);
    });
  }
}());

/* A hairline at the top of the reading pages that fills as you go down.
 * Added here rather than in each page's markup so both get it from one place.
 */
(function () {
  'use strict';
  if (!document.querySelector('.reader')) return;

  var bar = document.createElement('div');
  bar.className = 'progress';
  document.body.appendChild(bar);

  var waiting = false;
  function draw() {
    var h = document.documentElement.scrollHeight - window.innerHeight;
    bar.style.width = (h > 0 ? Math.min(100, (window.scrollY / h) * 100) : 0) + '%';
    waiting = false;
  }
  window.addEventListener('scroll', function () {
    if (waiting) return;
    waiting = true;
    requestAnimationFrame(draw);
  }, { passive: true });
  window.addEventListener('resize', draw, { passive: true });
  draw();
}());

/* The gatherings, live from the published catalogue when it can be reached,
 * and from the copy shipped with the site when it cannot.
 *
 * gubaeEvents(callback) hands back a list already filtered to what has not
 * happened yet and sorted soonest first, plus where it came from.
 */
(function () {
  'use strict';

  var CDN = 'https://cdn.getgubae.com';

  function text(v) { return typeof v === 'string' ? v.trim() : ''; }
  function day(v) { return text(v).slice(0, 10); }

  function poster(row) {
    var one = row.banner || row.banner_url;
    if (!one && Array.isArray(row.banner_urls)) one = row.banner_urls[0];
    one = text(one);
    if (!one) return null;
    if (one.indexOf('http') === 0) return one;      // already on the CDN
    if (one.indexOf('images/') === 0) return one;   // already ours

    // "assets/images/events/e_mega_city.jpg" is a file inside the Android
    // app. The same picture ships here as WebP, named after the original.
    var file = one.split('/').pop().toLowerCase();
    if (!file) return null;
    return 'images/events/' + file.replace(/[^a-z0-9]+/g, '-') + '.webp';
  }

  function tidy(s) {
    return text(s).replace(/[_*=~]{3,}/g, '').replace(/\n{3,}/g, '\n\n').trim();
  }

  /* Accepts the published row shape or the shape of the bundled file. */
  function normalise(row) {
    if (!row || typeof row !== 'object') return null;
    if (row.is_deleted === true) return null;
    if (row.is_published === false) return null;

    var title = text(row.title);
    var date = day(row.date || row.event_date);
    if (!title || !date) return null;

    return {
      title: title,
      date: date,
      endDate: day(row.endDate || row.end_date) || null,
      location: text(row.location) || null,
      organizer: text(row.organizer) || null,
      speaker: text(row.speaker) || null,
      about: tidy(row.about || row.description),
      banner: poster(row),
      link: text(row.link) || null
    };
  }

  function rowsOf(payload) {
    if (Array.isArray(payload)) return payload;
    if (payload && Array.isArray(payload.rows)) return payload.rows;
    if (payload && Array.isArray(payload.events)) return payload.events;
    if (payload && Array.isArray(payload.data)) return payload.data;
    return [];
  }

  function upcoming(list) {
    var today = new Date().toISOString().slice(0, 10);
    return list
      .filter(function (e) { return (e.endDate || e.date) >= today; })
      .sort(function (a, b) { return a.date < b.date ? -1 : a.date > b.date ? 1 : 0; });
  }

  function fromCdn() {
    return fetch(CDN + '/manifest.json', { cache: 'no-cache' })
      .then(function (r) { if (!r.ok) throw new Error(r.status); return r.json(); })
      .then(function (m) {
        var table = m && m.tables && m.tables.events;
        if (!table || !table.path) throw new Error('no events table');
        return fetch(CDN + '/' + table.path);
      })
      .then(function (r) { if (!r.ok) throw new Error(r.status); return r.json(); })
      .then(function (payload) {
        var list = rowsOf(payload).map(normalise).filter(Boolean);
        if (!list.length) throw new Error('nothing usable');
        return { events: upcoming(list), source: 'cdn' };
      });
  }

  function fromFile() {
    return fetch('data/events.json?v=2735fcb7')
      .then(function (r) { return r.json(); })
      .then(function (d) {
        return {
          events: upcoming(rowsOf(d).map(normalise).filter(Boolean)),
          source: 'bundled'
        };
      })
      .catch(function () { return { events: [], source: 'none' }; });
  }

  window.gubaeEvents = function (done) {
    fromCdn().catch(fromFile).then(done);
  };
}());

/* Light or dark.
 *
 * Until somebody presses the switch there is no data-theme attribute at all,
 * and the stylesheet follows whatever the device is set to -- so a phone
 * that turns dark in the evening takes the site with it. Pressing the switch
 * fixes a choice, and from then on it is the reader's, not the device's.
 *
 * A snippet in each page's <head> applies the remembered choice before the
 * first paint. This block only has to handle the pressing.
 */
(function () {
  'use strict';

  var KEY = 'gubae.theme';
  var root = document.documentElement;
  var media = window.matchMedia('(prefers-color-scheme: dark)');

  function showing() {
    var set = root.getAttribute('data-theme');
    if (set === 'light' || set === 'dark') return set;
    return media.matches ? 'dark' : 'light';
  }

  function paint() {
    var meta = document.querySelector('meta[name="theme-color"]');
    if (meta) meta.setAttribute('content',
      showing() === 'dark' ? '#0b0817' : '#fbfaff');
  }

  var button = document.getElementById('theme-toggle');
  if (button) {
    button.addEventListener('click', function () {
      var next = showing() === 'dark' ? 'light' : 'dark';
      root.setAttribute('data-theme', next);
      try { localStorage.setItem(KEY, next); } catch (e) { /* nothing to do */ }
      paint();
    });
  }

  // While no choice has been made, keep in step with the device.
  if (media.addEventListener) media.addEventListener('change', paint);
  paint();
}());

/* The phone menu.
 *
 * On a phone the header is one row now -- the mark, the badge and this
 * button -- and the light/dark switch and the language picker live behind
 * it. Nothing is duplicated: the very same two controls serve both widths,
 * so a choice made in the menu is the choice the wide header shows.
 */
(function () {
  'use strict';
  var button = document.getElementById('nav-menu');
  var sheet = document.getElementById('nav-sheet');
  if (!button || !sheet) return;

  function shut() {
    sheet.removeAttribute('data-open');
    button.setAttribute('aria-expanded', 'false');
  }

  button.addEventListener('click', function (e) {
    e.stopPropagation();
    if (sheet.hasAttribute('data-open')) { shut(); return; }
    sheet.setAttribute('data-open', '');
    button.setAttribute('aria-expanded', 'true');
  });

  /* A tap anywhere else puts it away -- but not a tap inside it, or the
   * language picker would shut the menu before it could be used. */
  document.addEventListener('click', function (e) {
    if (!sheet.contains(e.target)) shut();
  });
  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape') shut();
  });
  /* Widening past the breakpoint would otherwise leave it open and stranded. */
  window.addEventListener('resize', shut, { passive: true });
}());

/* How tall the header is, for the reading bar that sticks underneath it.
 * On a phone the header runs to two rows, so 76px is not a safe guess.
 */
(function () {
  'use strict';
  var head = document.querySelector('.site-head');
  if (!head) return;

  function measure() {
    document.documentElement.style.setProperty(
      '--head-h', head.getBoundingClientRect().height + 'px');
  }
  measure();
  window.addEventListener('resize', measure, { passive: true });
  if (window.ResizeObserver) new ResizeObserver(measure).observe(head);
  document.addEventListener('gubae:lang', measure);
}());

/* A- and A+, wherever a page puts them.
 *
 * The hymn pages are written out as plain HTML with no script of their own,
 * and the size of the words is the one thing a reader adjusts while reading.
 * One handler here serves all 2,426 of them, and the chosen size is the same
 * one the Bible reader and the app remember, so it carries across.
 *
 * Nothing happens on a page with no such buttons, which is most of them.
 */
(function () {
  'use strict';
  var seg = document.querySelector('[data-size]');
  if (!seg) return;

  var size = 1.14;
  try {
    var saved = parseFloat(localStorage.getItem('gubae.size'));
    if (saved) size = saved;
  } catch (e) { /* no storage; the default is a fine size */ }

  function set(next) {
    size = Math.min(1.9, Math.max(0.92, next));
    document.documentElement.style.setProperty('--read-size', size + 'rem');
    try { localStorage.setItem('gubae.size', size); } catch (e) {}
  }
  set(size);

  document.addEventListener('click', function (e) {
    var b = e.target.closest('[data-size]');
    if (b) set(size + 0.1 * +b.getAttribute('data-size'));
  });
}());


/* The install banner, at the foot of a phone screen.
 *
 * Most people who read a hymn here are on a phone, and the app is the thing
 * that actually serves them: it holds the Bible and the words offline, where
 * this site needs a connection every time. So the invitation belongs in front
 * of them rather than in the footer they never reach.
 *
 * **It must never be in the way.** It is only built on a narrow screen, it is
 * dismissible, and while it is up the page carries enough bottom padding that
 * it cannot cover the last line of a hymn or the footer. The dismissal lives
 * in sessionStorage, not localStorage, deliberately: "not now" means this
 * visit, and somebody who comes back next week is asked once more.
 *
 * Built here rather than written into 4,133 pages: it is a control, not
 * content, and one file is one place to change it.
 */
(function () {
  'use strict';

  var PLAY = 'https://play.google.com/store/apps/details?id=com.gubae.app';
  var KEY = 'gubae.appbanner.dismissed';

  // A phone, and only a phone. Checked once: a reader who rotates a tablet
  // past the breakpoint is not worth a resize listener, and the CSS keeps
  // the banner hidden anyway.
  if (!window.matchMedia || !window.matchMedia('(max-width: 768px)').matches) return;

  try {
    if (sessionStorage.getItem(KEY) === '1') return;
  } catch (e) { /* private window: show it, which is the kinder failure */ }

  function text(en, am) {
    return '<span data-lang="en">' + en + '</span>' +
           '<span data-lang="am">' + am + '</span>';
  }

  var bar = document.createElement('div');
  bar.className = 'app-banner';
  bar.setAttribute('role', 'complementary');
  bar.setAttribute('aria-label', 'Gubae app');
  bar.innerHTML =
    '<img class="app-banner-icon" src="/images/app-icon.webp" width="36" height="36" alt="">' +
    '<p class="app-banner-text">' +
      text('Gubae App &mdash; Offline Bible &amp; Mezmurs',
           'ጉባኤ አፕ — ያለ ኢንተርኔት በስልክዎ ይያዙ') +
    '</p>' +
    '<a class="app-banner-cta" href="' + PLAY + '" rel="noopener">' +
      text('Install', 'ጫን') +
    '</a>' +
    '<button type="button" class="app-banner-close" aria-label="Close">' +
      '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" ' +
      'stroke-linecap="round" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18"/></svg>' +
    '</button>';

  bar.querySelector('.app-banner-close').addEventListener('click', function () {
    try { sessionStorage.setItem(KEY, '1'); } catch (e) { /* nothing to do */ }
    bar.remove();
    document.documentElement.removeAttribute('data-app-banner');
  });

  document.body.appendChild(bar);
  // The attribute is what the stylesheet uses to make room. Set only when
  // the banner is really there, so a dismissed one leaves no gap behind.
  document.documentElement.setAttribute('data-app-banner', 'on');
}());

/* Every journey to the Play store, counted.
 *
 * One listener on the document rather than one per badge: the badges are in
 * the header, the footer, the hymn rails and the banner above, and a new one
 * added tomorrow is counted without anybody remembering to wire it.
 *
 * Does nothing at all until a measurement id is configured; see
 * build_analytics.py.
 */
(function () {
  'use strict';

  document.addEventListener('click', function (e) {
    var link = e.target.closest && e.target.closest('a[href*="play.google.com"]');
    if (!link) return;
    if (typeof window.gtag !== 'function') return;
    window.gtag('event', 'click_play_store', {
      event_category: 'app_download',
      link_url: link.href
    });
  }, true);
}());
