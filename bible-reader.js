/* The reader's furniture, on a chapter that is already on the page.
 *
 * Every chapter of the Bible is now a page of its own, written out with its
 * verses in the HTML -- which is what a reader sees first and what a search
 * engine can read at all. This adds the parts that only matter once you are
 * there and that nobody needs in order to read: the passage picker down the
 * left, and the edition, the text size and the search down the right.
 *
 * It is one file for all 1,189 chapters, so a reader fetches it once and
 * every chapter after that is instant.
 *
 * The page works without it. If this never loads, the chapter is still
 * there, Previous and Next still work, and the breadcrumbs still lead out.
 */
(function () {
  'use strict';

  var root = document.querySelector('main.reader.bible');
  if (!root) return;

  var BASE = '../../../';
  var order = +root.getAttribute('data-book');
  var chapter = +root.getAttribute('data-chapter');

  var passageEl = document.getElementById('passage');
  var toolsEl = document.getElementById('tools');
  var bodyEl = document.getElementById('chapter');
  var subEl = document.getElementById('chapter-sub');
  var resultsEl = document.getElementById('results');
  if (!passageEl || !toolsEl || !bodyEl) return;

  var index = null;      // the 66 books
  var book = null;       // this book's text, fetched only if it is needed
  var version = 'am';
  var picked = order;    // whose chapters the column is listing
  var testament = 'ot';

  function isAm() { return document.documentElement.lang === 'am'; }
  function say(en, am) { return isAm() ? am : en; }
  function store(k, v) { try { localStorage.setItem(k, v); } catch (e) {} }
  function recall(k) { try { return localStorage.getItem(k); } catch (e) { return null; } }

  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"]/g, function (c) {
      return c === '&' ? '&amp;' : c === '<' ? '&lt;' : c === '>' ? '&gt;' : '&quot;';
    });
  }

  function bookOf(n) {
    for (var i = 0; i < index.books.length; i++) {
      if (index.books[i].order === n) return index.books[i];
    }
    return null;
  }

  /* ------------------------------------------------- choosing a passage */

  function drawPassage() {
    var here = bookOf(order);
    passageEl.innerHTML =
      '<button class="side-toggle" type="button" id="passage-toggle" ' +
      'aria-expanded="false" aria-controls="passage-panel">' +
      '<span class="side-toggle-label">' + say('Choose a passage', 'ክፍል ይምረጡ') + '</span>' +
      '<span class="side-toggle-now">' +
      (here ? esc(isAm() ? here.am : here.en) + ' ' + chapter : '') + '</span></button>' +
      '<div class="side-panel" id="passage-panel">' +
      '<div class="testament" role="group" aria-label="Testament">' +
      '<button type="button" data-t="ot" aria-pressed="' + (testament === 'ot') + '">' +
      say('Old Testament', 'ብሉይ ኪዳን') + '</button>' +
      '<button type="button" data-t="nt" aria-pressed="' + (testament === 'nt') + '">' +
      say('New Testament', 'አዲስ ኪዳን') + '</button></div>' +
      '<div class="passage-panes"><div class="book-list" id="book-list"></div>' +
      '<div class="chapter-col"><h3>' + say('Chapter', 'ምዕራፍ') + '</h3>' +
      '<div class="chapter-nums" id="chapter-nums"></div></div></div></div>';
    passageEl.hidden = false;
    drawBooks();
  }

  function drawBooks() {
    var list = document.getElementById('book-list');
    var html = '';
    index.books.forEach(function (b) {
      if (b.testament !== testament) return;
      html += '<button class="book" type="button" data-order="' + b.order + '"' +
        (b.order === picked ? ' aria-current="true"' : '') + '>' +
        '<span class="bar" aria-hidden="true"></span>' +
        '<span class="book-name">' + esc(isAm() ? b.am : b.en) +
        '<small>' + esc(isAm() ? b.en : b.am) + '</small></span></button>';
    });
    list.innerHTML = html;
    drawChapters();
    var at = list.querySelector('.book[aria-current]');
    if (at) list.scrollTop = Math.max(0, at.offsetTop - 60);
  }

  /* A chapter is a link, not a button: it goes to a page of its own, and a
   * reader must be able to open it in a new tab like any other link. */
  function drawChapters() {
    var col = document.getElementById('chapter-nums');
    var b = bookOf(picked);
    if (!b) { col.innerHTML = ''; return; }
    var here = picked === order;
    var html = '';
    for (var i = 1; i <= b.chapters; i++) {
      html += '<a href="' + BASE + 'bible/' + b.slug + '/' + i + '/"' +
        (here && i === chapter ? ' aria-current="true"' : '') + '>' + i + '</a>';
    }
    col.innerHTML = html;
    var at = col.querySelector('[aria-current]');
    col.scrollTop = at ? Math.max(0, at.offsetTop - 60) : 0;
  }

  passageEl.addEventListener('click', function (e) {
    var t = e.target.closest('[data-t]');
    if (t) {
      testament = t.getAttribute('data-t');
      var here = bookOf(order);
      picked = (here && here.testament === testament) ? order
        : (function () {
            for (var i = 0; i < index.books.length; i++) {
              if (index.books[i].testament === testament) return index.books[i].order;
            }
            return picked;
          }());
      drawPassage();
      document.querySelector('.bible-passage').classList.add('open');
      document.getElementById('passage-toggle').setAttribute('aria-expanded', 'true');
      return;
    }
    var b = e.target.closest('button[data-order]');
    if (b) { picked = +b.getAttribute('data-order'); drawBooks(); return; }
    var tog = e.target.closest('#passage-toggle');
    if (tog) {
      var open = passageEl.classList.toggle('open');
      tog.setAttribute('aria-expanded', String(open));
    }
  });

  /* -------------------------------------------------------- the tools */

  /* On a wide screen the tools are simply a column. On a phone they fold
   * behind a button, because the edition, the size and the search are things
   * a reader reaches for occasionally and the chapter is what they came for.
   * The same button and panel the picker uses, so it reads as a pair. */
  function drawTools() {
    toolsEl.innerHTML =
      '<button class="side-toggle" type="button" id="tools-toggle" ' +
      'aria-expanded="false" aria-controls="tools-panel">' +
      '<span class="side-toggle-label">' + say('Reading', 'ንባብ') + '</span>' +
      '<span class="side-toggle-now">' + say('Edition, size, search',
                                             'ቅጂ፣ መጠን፣ ፍለጋ') + '</span></button>' +
      '<div class="side-panel" id="tools-panel">' +
      '<div class="tool"><h2>' + say('Edition', 'ቅጂ') + '</h2>' +
      '<span class="seg" role="group" aria-label="Version">' +
      '<button type="button" data-v="am" aria-pressed="' + (version === 'am') + '">አማርኛ</button>' +
      '<button type="button" data-v="en" aria-pressed="' + (version === 'en') + '">English</button>' +
      '</span></div>' +
      '<div class="tool"><h2>' + say('Text size', 'የጽሑፍ መጠን') + '</h2>' +
      '<span class="seg" role="group" aria-label="Text size">' +
      '<button type="button" data-size="-1" aria-label="Smaller text">A&minus;</button>' +
      '<button type="button" data-size="1" aria-label="Larger text">A+</button>' +
      '</span></div>' +
      '<div class="tool tool-search"><h2>' + say('Search this book', 'በዚህ መጽሐፍ ይፈልጉ') + '</h2>' +
      '<input id="search" type="search" autocomplete="off" placeholder="' +
      say('Search this book', 'በዚህ መጽሐፍ ውስጥ ይፈልጉ') + '" aria-label="' +
      say('Search this book', 'በዚህ መጽሐፍ ውስጥ ይፈልጉ') + '"></div>' +
      '<div class="tool"><h2>' + say('All of it', 'ሁሉም') + '</h2>' +
      '<p class="all-link"><a href="' + BASE + 'bible/">' +
      say('All 66 books &rarr;', '66ቱም መጻሕፍት &rarr;') + '</a></p></div>' +
      '</div>';
    toolsEl.hidden = false;
    wireSearch();
  }

  toolsEl.addEventListener('click', function (e) {
    var tog = e.target.closest('#tools-toggle');
    if (!tog) return;
    var open = toolsEl.classList.toggle('open');
    tog.setAttribute('aria-expanded', String(open));
  });

  /* ---------------------------------------------- the text of this book
   *
   * The Amharic is already on the page, so nothing is fetched until the
   * reader asks for the English or searches -- which most never do. */
  function fetchBook() {
    if (book) return Promise.resolve(book);
    var file = BASE + 'data/bible/' + (order < 10 ? '0' + order : order) + '.json';
    return fetch(file).then(function (r) {
      if (!r.ok) throw new Error(r.status);
      return r.json();
    }).then(function (d) { book = d; return d; });
  }

  function chapterOf(n) {
    for (var i = 0; i < book.chapters.length; i++) {
      if (book.chapters[i].n === n) return book.chapters[i];
    }
    return null;
  }

  function draw() {
    var ch = chapterOf(chapter);
    var verses = ch ? (ch[version] || []) : [];
    var b = bookOf(order);
    if (!verses.length) {
      // The two editions divide some chapters differently; say so rather
      // than leave the reader looking at nothing.
      subEl.textContent = say('This chapter is not in this version.',
                              'ይህ ምዕራፍ በዚህ ቅጂ ውስጥ የለም።');
      bodyEl.innerHTML = '';
      return;
    }
    var html = '';
    for (var i = 0; i < verses.length; i++) {
      html += '<p id="v' + verses[i][0] + '"><span class="vnum">' + verses[i][0] +
        '</span>' + esc(verses[i][1]) + '</p>';
    }
    bodyEl.innerHTML = html;
    bodyEl.lang = version;
    subEl.textContent = (b ? (isAm() ? b.en : b.am) + ' ' + chapter + ' · ' : '') +
      (version === 'am' ? 'የ1954 አማርኛ' : 'World English Bible') +
      ' · ' + verses.length + say(' verses', ' ቁጥሮች');
  }

  toolsEl.addEventListener('click', function (e) {
    var v = e.target.closest('[data-v]');
    if (v) {
      version = v.getAttribute('data-v');
      store('gubae.version', version);
      toolsEl.querySelectorAll('[data-v]').forEach(function (btn) {
        btn.setAttribute('aria-pressed', String(btn.getAttribute('data-v') === version));
      });
      var term = (document.getElementById('search') || {}).value || '';
      fetchBook().then(function () {
        if (term.trim().length > 1) runSearch(term); else draw();
      }).catch(failed);
      return;
    }
    var s = e.target.closest('[data-size]');
    if (s) setSize(size + 0.1 * +s.getAttribute('data-size'));
  });

  function failed() {
    subEl.textContent = say('That did not load. Please try again.',
                            'አልተጫነም። እንደገና ይሞክሩ።');
  }

  var size = parseFloat(recall('gubae.size')) || 1.14;
  function setSize(next) {
    size = Math.min(1.9, Math.max(0.92, next));
    document.documentElement.style.setProperty('--read-size', size + 'rem');
    store('gubae.size', size);
  }
  setSize(size);

  /* ------------------------------------------------------- searching */

  function closeSearch() {
    resultsEl.hidden = true;
    resultsEl.innerHTML = '';
    bodyEl.hidden = false;
  }

  function runSearch(term) {
    term = term.trim();
    if (!book || term.length < 2) { closeSearch(); return; }
    var needle = term.toLowerCase();
    var b = bookOf(order);
    var label = b ? (isAm() ? b.am : b.en) : '';
    var found = [];
    for (var i = 0; i < book.chapters.length && found.length < 60; i++) {
      var ch = book.chapters[i];
      var verses = ch[version] || [];
      for (var j = 0; j < verses.length && found.length < 60; j++) {
        if (verses[j][1].toLowerCase().indexOf(needle) !== -1) {
          found.push({ chapter: ch.n, verse: verses[j][0], text: verses[j][1] });
        }
      }
    }
    bodyEl.hidden = true;
    resultsEl.hidden = false;
    if (!found.length) {
      resultsEl.innerHTML = '<p class="empty">' +
        esc(term) + say(' is not in ' + label + '.', ' በ' + label + ' ውስጥ የለም።') + '</p>';
      return;
    }
    var html = '<p class="chapter-sub">' + found.length +
      say(' matches in ' + label, ' ውጤት በ' + label + ' ውስጥ') + '</p>';
    found.forEach(function (f) {
      var at = f.text.toLowerCase().indexOf(needle);
      html += '<a href="' + BASE + 'bible/' + b.slug + '/' + f.chapter + '/#v' + f.verse + '">' +
        '<span class="ref">' + esc(label) + ' ' + f.chapter + ':' + f.verse + '</span>' +
        esc(f.text.slice(0, at)) + '<mark>' + esc(f.text.slice(at, at + term.length)) +
        '</mark>' + esc(f.text.slice(at + term.length)) + '</a>';
    });
    resultsEl.innerHTML = html;
  }

  var typing = null;
  function wireSearch() {
    var el = document.getElementById('search');
    if (!el) return;
    el.addEventListener('input', function () {
      clearTimeout(typing);
      typing = setTimeout(function () {
        if (el.value.trim().length < 2) { closeSearch(); return; }
        fetchBook().then(function () { runSearch(el.value); }).catch(failed);
      }, 200);
    });
  }

  /* ---------------------------------------------------------- start up */

  document.addEventListener('gubae:lang', function () {
    if (!index) return;
    drawPassage();
    drawTools();
    if (book) draw();
  });

  fetch(BASE + 'data/bible/index.json')
    .then(function (r) { if (!r.ok) throw new Error(r.status); return r.json(); })
    .then(function (d) {
      index = d;
      var here = bookOf(order);
      testament = here ? here.testament : 'ot';
      drawPassage();
      drawTools();
      // A reader who last chose English gets English, without being made to
      // ask for it again on every chapter.
      if (recall('gubae.version') === 'en') {
        version = 'en';
        toolsEl.querySelectorAll('[data-v]').forEach(function (btn) {
          btn.setAttribute('aria-pressed', String(btn.getAttribute('data-v') === 'en'));
        });
        fetchBook().then(draw).catch(failed);
      }
      // A verse in the address, from a search result or a shared link.
      var m = /^#v(\d+)$/.exec(location.hash);
      if (m) {
        var t = document.getElementById('v' + m[1]);
        if (t) { t.classList.add('hit'); t.scrollIntoView({ block: 'center' }); }
      }
    })
    .catch(function () { /* the chapter is on the page; the chrome is not vital */ });
}());
