/* Searching, on any page that lists hymns.
 *
 * The search used to live on lyrics.html, which was also the only way in to
 * the singers and the albums. Now /lyrics/ is the way in and lyrics.html is
 * only a signpost for old links -- so the search comes with it, onto every
 * list page, rather than being left behind on a page nobody lands on.
 *
 * One file for all of them: fetched once, and instant on every page after.
 *
 * The page works without it. If this never loads there is still a list to
 * read and links to follow; only the box stops responding.
 */
(function () {
  'use strict';

  var box = document.getElementById('search');
  var main = document.querySelector('main.reader');
  var out = document.getElementById('search-results');
  if (!box || !main || !out) return;

  /* What a search hides: everything the page put in its column except the
   * heading, which says where you are, and the results box itself. Worked
   * out from what is here rather than from a wrapper the generator has to
   * remember to add, so no page can be built unsearchable by accident. */
  var body = [];
  var wrap = out.parentNode;
  for (var c = 0; c < wrap.children.length; c++) {
    var el = wrap.children[c];
    if (el !== out && !el.classList.contains('page-head')) body.push(el);
  }
  function showBody(on) {
    for (var i = 0; i < body.length; i++) body[i].hidden = !on;
  }

  var BASE = main.getAttribute('data-up') || '';
  var SHOWN = 300;
  var index = null;

  function isAm() { return document.documentElement.lang === 'am'; }
  function say(en, am) { return isAm() ? am : en; }
  function tidy(t) { return (t || '').replace(/\s+/g, ' ').trim(); }

  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"]/g, function (c) {
      return c === '&' ? '&amp;' : c === '<' ? '&lt;' : c === '>' ? '&gt;' : '&quot;';
    });
  }

  /* Whichever language is being read on top, the other underneath, and a
   * name written only one way shows one line rather than the same words
   * twice. */
  function mainOf(am, en) {
    am = tidy(am); en = tidy(en);
    return isAm() ? (am || en) : (en || am);
  }
  function altOf(am, en) {
    var other = isAm() ? tidy(en) : tidy(am);
    if (!other || other.toLowerCase() === mainOf(am, en).toLowerCase()) return '';
    return other;
  }

  function row(href, kicker, am, en) {
    var alt = altOf(am, en);
    return '<a class="results-row" href="' + href + '">' +
      (kicker ? '<span class="ref">' + kicker + '</span>' : '') +
      '<span class="row-name">' + esc(mainOf(am, en)) + '</span>' +
      (alt ? '<span class="row-alt">' + esc(alt) + '</span>' : '') +
      '</a>';
  }

  function restore() {
    showBody(true);
    out.hidden = true;
    out.innerHTML = '';
  }

  function run(term) {
    term = tidy(term);
    if (!index) return;
    if (term.length < 2) { restore(); return; }

    var q = term.toLowerCase();
    var html = '';
    var found = 0;

    index.artists.forEach(function (a) {
      if (found >= SHOWN || !a.slug) return;
      if ((a.name + ' ' + (a.nameEn || '')).toLowerCase().indexOf(q) === -1) return;
      html += row(BASE + 'lyrics/' + a.slug + '/',
                  say('Singer', 'ዘማሪ') + ' &middot; ' + a.count +
                  say(' lyrics', ' መዝሙሮች'), a.name, a.nameEn);
      found++;
    });

    index.albums.forEach(function (al) {
      if (found >= SHOWN || !al.slug) return;
      if ((al.name + ' ' + (al.nameEn || '')).toLowerCase().indexOf(q) === -1) return;
      var a = index.artists[al.a] || {};
      html += row(BASE + 'albums/' + al.slug + '/',
                  esc(mainOf(a.name, a.nameEn)) + ' &middot; ' + al.count +
                  say(' lyrics', ' መዝሙሮች'), al.name, al.nameEn);
      found++;
    });

    index.songs.forEach(function (s) {
      if (found >= SHOWN || !s.sl) return;
      if ((s.t + ' ' + (s.tEn || '')).toLowerCase().indexOf(q) === -1) return;
      var a = index.artists[s.a] || {};
      if (!a.slug) return;
      html += row(BASE + 'lyrics/' + a.slug + '/' + s.sl + '/',
                  esc(mainOf(a.name, a.nameEn)), s.t, s.tEn);
      found++;
    });

    showBody(false);
    out.hidden = false;
    out.innerHTML = html || '<p class="empty">' +
      say('Nothing matches “' + esc(term) + '”.',
          '“' + esc(term) + '” የሚል የለም።') + '</p>';
  }

  function placeholder() {
    box.placeholder = say('Search a song, album or singer',
                          'መዝሙር፣ አልበም ወይም ዘማሪ ይፈልጉ');
  }

  var typing = null;
  box.addEventListener('input', function () {
    clearTimeout(typing);
    if (tidy(box.value).length < 2) { restore(); return; }
    typing = setTimeout(function () {
      if (index) { run(box.value); return; }
      // Nothing is fetched until somebody actually searches, so a reader who
      // only ever follows links never pays for the index at all.
      fetch(BASE + 'data/songs/index.json')
        .then(function (r) { if (!r.ok) throw new Error(r.status); return r.json(); })
        .then(function (d) { index = d; run(box.value); })
        .catch(function () {
          showBody(false);
          out.hidden = false;
          out.innerHTML = '<p class="empty">' +
            say('Search did not load. Please try again.',
                'ፍለጋው አልተጫነም። እንደገና ይሞክሩ።') + '</p>';
        });
    }, 180);
  });

  document.addEventListener('gubae:lang', function () {
    placeholder();
    if (tidy(box.value).length >= 2 && index) run(box.value);
  });

  placeholder();
}());
