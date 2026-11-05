/* Compteur de vues : « 👁 N » sous chaque couverture de l'étagère et près du titre de chaque BD,
   avec la mention « 🔥 la plus lue de la semaine ». Ne garde aucune donnée personnelle.
   Pour ne pas compter vos propres visites sur un appareil : ouvrez n'importe quelle page avec ?nocount=1
   (et ?nocount=0 pour recompter). */
(function () {
  'use strict';
  var NO_KEY = 'mesbd-no-count';
  var ALIAS = { ardeche: 'ardeche-2026' };
  function norm(s) { s = String(s || '').toLowerCase().replace(/-solo$/, ''); return ALIAS[s] || s; }
  function fmt(n) {
    n = Number(n) || 0;
    if (n < 1000) return String(n);
    var k = (n / 1000).toFixed(n < 10000 ? 1 : 0).replace('.', ',').replace(/,0$/, '');
    return k + ' k';
  }
  try {
    if (/[?&]nocount=1(&|$)/.test(location.search)) localStorage.setItem(NO_KEY, '1');
    if (/[?&]nocount=0(&|$)/.test(location.search)) localStorage.removeItem(NO_KEY);
  } catch (e) {}
  var excluded = false;
  try { excluded = localStorage.getItem(NO_KEY) === '1'; } catch (e) {}

  var seg = location.pathname.split('/').filter(Boolean)[0] || '';
  if (/\.html?$/i.test(seg)) seg = '';
  var slug = norm(seg), isShelf = slug === '';

  var css = document.createElement('style');
  css.textContent =
    '.book__cover{position:relative}' +
    '.vues-badge{position:absolute;left:6px;bottom:6px;padding:2px 9px;border-radius:12px;background:rgba(20,17,14,.84);color:#f2ead9;font:600 .72rem/1.5 Karla,system-ui,sans-serif;pointer-events:none;box-shadow:0 1px 4px rgba(0,0,0,.4)}' +
    '.vues-top{position:absolute;top:12px;right:-38px;width:136px;transform:rotate(40deg);text-align:center;background:#c62828;color:#fff;font:700 .6rem/1.25 Karla,system-ui,sans-serif;padding:3px 0;letter-spacing:.02em;pointer-events:none;box-shadow:0 2px 5px rgba(0,0,0,.45)}' +
    '#views-chip{display:inline-block;margin-left:12px;font:500 .78rem Karla,system-ui,sans-serif;opacity:.85;white-space:nowrap;vertical-align:middle}' +
    '#views-chip .vt{font-weight:700;color:#c62828;opacity:1}' +
    '@media (max-width:560px){#views-chip .vw{display:none}#views-chip .vt .vl{display:none}}';
  document.head.appendChild(css);

  function getStats() {
    if (typeof fetch !== 'function') return Promise.resolve(null);
    return fetch('/api/stats').then(function (r) { return r.ok ? r.json() : null; }).then(function (d) { return d && d.ok ? d : null; }).catch(function () { return null; });
  }

  function renderShelf(st) {
    Array.prototype.forEach.call(document.querySelectorAll('a.book'), function (a) {
      var m = (a.getAttribute('href') || '').match(/^\/?([^/]+)\/?$/);
      if (!m) return;
      var s = norm(m[1]), cover = a.querySelector('.book__cover');
      if (!cover || cover.querySelector('.vues-badge')) return;
      var n = st.total[s] || 0;
      var b = document.createElement('span'); b.className = 'vues-badge'; b.textContent = '👁 ' + fmt(n);
      b.setAttribute('aria-hidden', 'true'); cover.appendChild(b);
      var sr = a.querySelector('.sr-only');
      var info = n + (n > 1 ? ' vues' : ' vue') + (st.top === s ? ', la plus lue de la semaine' : '');
      if (sr) sr.textContent += ' (' + info + ')';
      if (st.top === s) {
        var t = document.createElement('span'); t.className = 'vues-top'; t.innerHTML = '🔥 La plus lue<br>de la semaine';
        t.setAttribute('aria-hidden', 'true'); cover.appendChild(t);
      }
    });
  }

  function renderChip(st) {
    var title = document.querySelector('.topbar__title');
    if (!title || document.getElementById('views-chip')) return;
    var n = st.total[slug] || 0;
    var c = document.createElement('span'); c.id = 'views-chip';
    c.title = n + (n > 1 ? ' vues' : ' vue');
    c.innerHTML = '👁 ' + fmt(n) + '<span class="vw"> ' + (n > 1 ? 'vues' : 'vue') + '</span>' +
      (st.top === slug ? ' <span class="vt">· 🔥 <span class="vl">la plus lue de la semaine</span></span>' : '');
    title.appendChild(c);
  }

  function countView() {
    if (excluded || navigator.webdriver || typeof fetch !== 'function') return Promise.resolve();
    var k = 'mesbd-vue-' + slug, already = false;
    try { already = sessionStorage.getItem(k) === '1'; sessionStorage.setItem(k, '1'); } catch (e) {}
    if (already) return Promise.resolve();
    return fetch('/api/vue', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ slug: seg }), keepalive: true })
      .catch(function () {});
  }

  function run() {
    if (isShelf) { getStats().then(function (st) { if (st) renderShelf(st); }); return; }
    countView().then(getStats).then(function (st) { if (st) renderChip(st); });
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', run); else run();
})();
