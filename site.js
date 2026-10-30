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
    return fetch('data/events.json?v=602ec596')
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
