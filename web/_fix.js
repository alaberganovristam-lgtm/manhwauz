/**
 * _fix.js — ManhwaUZ client-side fixes
 * Cloudflare Pages versiyasi
 */

// ── Cloudflare konfiguratsiyasi ─────────────────────────────
// Bu yerlarni o'zingizning URL laringiz bilan almashtiring:
window.MU_API = 'https://manhwauz-api.ahmedzaripov43.workers.dev';
window.MU_CDN = 'https://pub-62fa3924c0d244a9b53387e7235cb0cb.r2.dev';

// Cover rasmlarni R2 dan yuklash
document.addEventListener('DOMContentLoaded', function() {
  document.querySelectorAll('img[src^="/public/"], img[src^="/uploads/"]').forEach(function(img) {
    var src = img.getAttribute('src');
    if (src && window.MU_CDN) {
      img.setAttribute('src', window.MU_CDN + src);
    }
  });
});

(function () {
  'use strict';

  /* ══════════════════════════════════════════════
     OPACITY FIX
  ══════════════════════════════════════════════ */
  document.documentElement.style.opacity = '1';
  document.body.style.opacity = '1';

  /* ══════════════════════════════════════════════
     MOBILE-FIRST STYLES — injected globally
  ══════════════════════════════════════════════ */
  (function injectMobileStyles() {
    if (document.getElementById('mu-mobile-styles')) return;
    var s = document.createElement('style');
    s.id = 'mu-mobile-styles';
    s.textContent =
      // Mobile: hide desktop-only auth controls (they live in the drawer)
      '@media(max-width:900px){' +
        '.user-menu-skeleton{display:none!important}' +
      '}' +
      // Mobile: bigger tap targets, no scaling jitter
      '@media(max-width:900px){' +
        'button,a{-webkit-tap-highlight-color:rgba(145,63,226,.2)}' +
        '.asura-mobile-button{min-width:44px;min-height:44px}' +
      '}' +
      // Smooth scrolling everywhere
      'html{scroll-behavior:smooth}' +
      // Better mobile reader experience
      '@media(max-width:768px){' +
        '.rk-wrap,.bm-wrap{padding:1rem .75rem 3rem!important}' +
        '.rk-title,.bm-title{font-size:1.35rem!important;margin-bottom:1rem!important}' +
        '.rk-tab{padding:.4rem .9rem!important;font-size:.78rem!important}' +
        '.rk-cover{width:2.75rem!important;height:3.75rem!important}' +
        '.rk-row{padding:.55rem .65rem!important;gap:.65rem!important}' +
        '.rk-name{font-size:.875rem!important}' +
        '.rk-meta{font-size:.7rem!important}' +
        '.rk-val{font-size:.95rem!important}' +
      '}' +
      // Drawer button styles
      '.mu-drawer-btn{display:flex;align-items:center;gap:.625rem;color:#fff;font-size:.95rem;' +
        'font-weight:500;padding:.75rem .875rem;border-radius:.625rem;text-decoration:none;' +
        'transition:background .15s;background:transparent;border:none;width:100%;text-align:left;cursor:pointer}' +
      '.mu-drawer-btn:hover,.mu-drawer-btn:active{background:rgba(255,255,255,.07)}' +
      '.mu-drawer-btn svg{flex-shrink:0;opacity:.65}';
    document.head.appendChild(s);
  })();

  /* ══════════════════════════════════════════════
     LINK FIXER
  ══════════════════════════════════════════════ */
  function fixLinks() {
    document.querySelectorAll('a[href]').forEach(function (a) {
      var h = a.getAttribute('href') || '';

      if (/browse[a-f0-9]{4}\.html/.test(h))
        h = h.replace(/(?:\.\.\/)?browse[a-f0-9]{4}\.html/, '/browse');

      if (/(?:comics\/)?[a-z0-9-]+-[a-f0-9]{8}\.html/.test(h))
        h = h.replace(/(?:\.\.\/)?(?:comics\/)?([a-z0-9-]+)-[a-f0-9]{8}\.html/, '/comics/$1');

      if (h === '../index.html' || h === 'index.html') h = '/';

      if (/asurascans\.com\/browse/.test(h))
        h = h.replace(/https?:\/\/asurascans\.com\/browse/, '/browse');

      var cm = h.match(/asurascans\.com\/comics\/([a-z0-9-]+?)(?:-[a-f0-9]{8})?(?:\/|$|\?)/);
      if (cm) h = '/comics/' + cm[1];

      a.setAttribute('href', h);
    });
  }

  /* ══════════════════════════════════════════════
     SEARCH BAR — Enter key + icon click
  ══════════════════════════════════════════════ */
  function wireSearch(input) {
    if (!input || input._fixSearch) return;
    input._fixSearch = true;

    function doSearch() {
      var v = input.value.trim();
      if (!v) { input.focus(); return; }
      // On browse page with live filtering, just filter — don't redirect
      if (isBrowsePage() && input.placeholder.indexOf('series') !== -1) {
        _browseState.search = v.toLowerCase();
        _browseState.page = 1;
        if (_browseComics) renderBrowse(_browseComics);
      } else {
        location.href = '/browse?search=' + encodeURIComponent(v);
      }
    }

    input.addEventListener('keydown', function (e) {
      if (e.key === 'Enter') doSearch();
    });

    var label = input.closest('label');
    if (label) {
      label.style.cursor = 'text';
      var icon = label.querySelector('svg');
      if (icon) {
        icon.style.cursor = 'pointer';
        icon.addEventListener('click', doSearch);
      }
    }
  }

  /* ══════════════════════════════════════════════
     SEARCH DROPDOWN — live autocomplete
     Shows a results panel as the user types,
     matching the original site's search overlay.
  ══════════════════════════════════════════════ */
  function wireSearchDropdown(input) {
    if (!input || input._fixDropdown) return;
    input._fixDropdown = true;

    /* Ensure comics cache is loaded */
    function withComics(cb) {
      if (_browseComics) { cb(_browseComics); return; }
      fetch('/api/comics.json')
        .then(function (r) { return r.json(); })
        .then(function (d) { _browseComics = d; cb(d); })
        .catch(function () { cb([]); });
    }

    /* Build the dropdown panel */
    var panel = document.createElement('div');
    panel.id = '_mu-search-panel';
    panel.style.cssText = [
      'position:absolute', 'top:calc(100% + .375rem)', 'left:0', 'right:0',
      'z-index:9990', 'background:#1C1924',
      'border:1px solid rgba(255,255,255,.1)', 'border-radius:.875rem',
      'overflow:hidden', 'box-shadow:0 16px 48px rgba(0,0,0,.65)',
      'display:none', 'min-width:320px'
    ].join(';');

    /* Attach to the nearest relative-positioned ancestor */
    var anchor = input.closest('.relative') || input.closest('label') || input.parentElement;
    anchor.style.position = 'relative';
    anchor.appendChild(panel);

    /* Header: "Series (N)" tab */
    var header = document.createElement('div');
    header.style.cssText = 'display:flex;align-items:center;gap:.5rem;padding:.625rem .875rem .375rem;border-bottom:1px solid rgba(255,255,255,.07)';
    var tabSeries = document.createElement('span');
    tabSeries.style.cssText = 'display:inline-flex;align-items:center;padding:.3rem .75rem;border-radius:.375rem;background:#913FE2;color:#fff;font-size:.8125rem;font-weight:600';
    tabSeries.id = '_mu-tab-series';
    header.appendChild(tabSeries);
    panel.appendChild(header);

    /* Results list */
    var list = document.createElement('div');
    list.id = '_mu-search-list';
    list.style.cssText = 'max-height:320px;overflow-y:auto';
    panel.appendChild(list);

    /* Footer: see all */
    var footer = document.createElement('a');
    footer.style.cssText = [
      'display:block', 'text-align:center', 'padding:.65rem',
      'color:#913FE2', 'font-size:.8125rem', 'font-weight:600',
      'text-decoration:none', 'border-top:1px solid rgba(255,255,255,.07)',
      'transition:background .12s'
    ].join(';');
    footer.textContent = 'See all results';
    footer.onmouseover = function () { this.style.background = 'rgba(145,63,226,.1)'; };
    footer.onmouseout  = function () { this.style.background = ''; };
    panel.appendChild(footer);

    var lastQuery = '';

    function renderDropdown(query) {
      query = (query || '').trim();
      if (!query) { panel.style.display = 'none'; return; }
      if (query === lastQuery && panel.style.display !== 'none') return;
      lastQuery = query;

      withComics(function (data) {
        var q = query.toLowerCase();
        var matches = data.filter(function (c) {
          return (c.title || '').toLowerCase().indexOf(q) !== -1;
        }).slice(0, 7);

        tabSeries.textContent = 'Series (' + matches.length + ')';
        footer.href = '/browse?search=' + encodeURIComponent(query);

        list.innerHTML = matches.length === 0
          ? '<div style="padding:1.25rem;text-align:center;color:rgba(255,255,255,.35);font-size:.875rem">No results found</div>'
          : matches.map(function (c) {
              var type = (c.type || 'Manhwa');
              return '<a href="/comics/' + c.slug + '" style="display:flex;align-items:center;gap:.75rem;padding:.6rem .875rem;text-decoration:none;transition:background .12s" ' +
                'onmouseover="this.style.background=\'rgba(255,255,255,.05)\'" onmouseout="this.style.background=\'\'">' +
                '<img src="' + (c.cover || '') + '" alt="" style="width:2.5rem;height:3.25rem;object-fit:cover;border-radius:.375rem;flex-shrink:0;background:#1D1B22" ' +
                  'onerror="this.style.background=\'#1D1B22\'">' +
                '<div style="min-width:0;flex:1">' +
                  '<div style="color:#fff;font-size:.875rem;font-weight:500;overflow:hidden;white-space:nowrap;text-overflow:ellipsis">' + (c.title || '') + '</div>' +
                  '<div style="color:rgba(255,255,255,.4);font-size:.75rem;margin-top:.15rem">' + type + '</div>' +
                '</div></a>';
            }).join('');

        panel.style.display = 'block';
      });
    }

    function closePanel() {
      panel.style.display = 'none';
      lastQuery = '';
    }

    input.addEventListener('input',  function () { renderDropdown(this.value); });
    input.addEventListener('focus',  function () { if (this.value.trim()) renderDropdown(this.value); });
    input.addEventListener('keydown', function (e) {
      if (e.key === 'Escape') { closePanel(); this.blur(); }
      if (e.key === 'Enter')  { closePanel(); }
    });

    document.addEventListener('click', function (e) {
      if (!panel.contains(e.target) && e.target !== input) closePanel();
    });
  }

  /* ══════════════════════════════════════════════
     RESOURCES DROPDOWN
     NOTE: The inline <script type="module"> in the
     HTML already handles click toggling. We only
     inject the CSS safety-net here — no duplicate
     click handler.
  ══════════════════════════════════════════════ */
  function fixResourcesDropdown() {
    if (document.getElementById('_fix-res-style')) return;
    var st = document.createElement('style');
    st.id = '_fix-res-style';
    st.textContent =
      '#resources-menu.touch-open{visibility:visible!important;opacity:1!important;pointer-events:auto!important}' +
      '#resources-chevron.touch-open{transform:rotate(180deg)}';
    document.head.appendChild(st);
  }

  /* ══════════════════════════════════════════════
     MOBILE NAV DRAWER
     MobileNav.js is missing from the mirror, so we
     build a simple slide-in drawer ourselves.
  ══════════════════════════════════════════════ */
  function fixMobileNav() {
    var menuBtn = document.querySelector('button[aria-label="Navigation menu"]') ||
                  document.querySelector('.asura-mobile-button button') ||
                  document.querySelector('.asura-mobile-button');
    if (!menuBtn || menuBtn._fixNav) return;
    menuBtn._fixNav = true;

    var overlay = document.createElement('div');
    overlay.id = 'mu-drawer-overlay';
    overlay.style.cssText = 'display:none;position:fixed;inset:0;z-index:9000;background:rgba(0,0,0,.6);backdrop-filter:blur(4px);-webkit-backdrop-filter:blur(4px)';

    var drawer = document.createElement('aside');
    drawer.id = 'mu-mobile-drawer';
    drawer.style.cssText = [
      'position:fixed', 'top:0', 'right:0', 'height:100%',
      'width:300px', 'max-width:88vw', 'background:#1C1924',
      'border-left:1px solid rgba(255,255,255,.08)', 'z-index:9001',
      'padding:1rem .9rem', 'display:flex', 'flex-direction:column',
      'gap:.4rem', 'overflow-y:auto', 'overscroll-behavior:contain',
      'transform:translateX(100%)', 'transition:transform .25s cubic-bezier(.4,0,.2,1)',
      'box-shadow:-8px 0 24px rgba(0,0,0,.4)'
    ].join(';');

    // === Header row: brand + close ===
    var head = document.createElement('div');
    head.style.cssText = 'display:flex;align-items:center;justify-content:space-between;margin-bottom:.5rem;padding:.25rem 0';
    head.innerHTML = '<span style="display:inline-flex;align-items:center;gap:.55rem">' +
      '<span style="width:34px;height:34px;border-radius:50%;background:#fff;display:inline-flex;align-items:center;justify-content:center;font-weight:900;font-size:.8rem;color:#913FE2;letter-spacing:-.5px">MU</span>' +
      '<span style="font-size:.95rem;font-weight:700;color:#fff">Manhwa UZ</span></span>';
    var closeBtn = document.createElement('button');
    closeBtn.setAttribute('aria-label', 'Yopish');
    closeBtn.style.cssText = 'color:rgba(255,255,255,.55);padding:.5rem;cursor:pointer;background:none;border:none;border-radius:.5rem;line-height:0';
    closeBtn.innerHTML = '<svg width="20" height="20" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12"/></svg>';
    head.appendChild(closeBtn);

    // === Auth section (populated by syncAuth) ===
    var authBox = document.createElement('div');
    authBox.id = 'mu-drawer-auth';
    authBox.style.cssText = 'background:rgba(145,63,226,.08);border:1px solid rgba(145,63,226,.18);border-radius:.75rem;padding:.85rem;margin-bottom:.5rem';

    // === Nav links ===
    function navLink(href, label, icon) {
      var a = document.createElement('a');
      a.href = href;
      a.className = 'mu-drawer-btn';
      a.innerHTML = icon + '<span>' + label + '</span>';
      return a;
    }
    var ic = {
      home:  '<svg width="18" height="18" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M3 12l9-9 9 9M5 10v10a1 1 0 001 1h3v-6h6v6h3a1 1 0 001-1V10"/></svg>',
      grid:  '<svg width="18" height="18" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M4 6h6v6H4zM14 6h6v6h-6zM4 16h6v4H4zM14 16h6v4h-6z"/></svg>',
      bm:    '<svg width="18" height="18" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M17 21l-5-3-5 3V5a2 2 0 012-2h6a2 2 0 012 2z"/></svg>',
      rank:  '<svg width="18" height="18" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M3 17l4-4 4 4 7-7M14 7h7v7"/></svg>',
      logout:'<svg width="18" height="18" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1"/></svg>'
    };

    var navWrap = document.createElement('nav');
    navWrap.style.cssText = 'display:flex;flex-direction:column;gap:.15rem';
    navWrap.appendChild(navLink('/', 'Bosh sahifa', ic.home));
    navWrap.appendChild(navLink('/browse', 'Barchasi', ic.grid));
    navWrap.appendChild(navLink('/bookmarks', 'Saqlanganlar', ic.bm));
    navWrap.appendChild(navLink('/ranking', 'Reyting', ic.rank));

    drawer.appendChild(head);
    drawer.appendChild(authBox);
    drawer.appendChild(navWrap);
    overlay.appendChild(drawer);
    document.body.appendChild(overlay);

    // Sync auth state into drawer
    window.muSyncDrawerAuth = function (user) {
      authBox.innerHTML = '';
      if (user) {
        var initials = (user.name || 'U').slice(0, 2).toUpperCase();
        var top = document.createElement('div');
        top.style.cssText = 'display:flex;align-items:center;gap:.65rem';
        top.innerHTML =
          '<div style="width:2.5rem;height:2.5rem;border-radius:50%;background:linear-gradient(135deg,#913FE2,#7B2FD1);display:inline-flex;align-items:center;justify-content:center;font-weight:700;font-size:.85rem;color:#fff;flex-shrink:0">' + initials + '</div>' +
          '<div style="min-width:0;flex:1"><div style="font-weight:600;font-size:.9rem;color:#fff;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">' + (user.name || '') + '</div>' +
          '<div style="font-size:.75rem;color:rgba(255,255,255,.5);overflow:hidden;text-overflow:ellipsis;white-space:nowrap">' + (user.email || '') + '</div></div>';
        authBox.appendChild(top);

        var logoutBtn = document.createElement('button');
        logoutBtn.className = 'mu-drawer-btn';
        logoutBtn.type = 'button';
        logoutBtn.style.marginTop = '.6rem';
        logoutBtn.innerHTML = ic.logout + '<span>Chiqish</span>';
        logoutBtn.addEventListener('click', function () {
          fetch('/api/auth/logout', { credentials: 'same-origin' })
            .then(function () { location.reload(); });
        });
        authBox.appendChild(logoutBtn);
      } else {
        authBox.innerHTML =
          '<div style="font-size:.85rem;color:rgba(255,255,255,.65);margin-bottom:.65rem">Manhwa UZ ga kirish — saqlash va izoh qoldirish uchun</div>' +
          '<div style="display:flex;gap:.5rem">' +
            '<a href="/login" style="flex:1;display:inline-flex;align-items:center;justify-content:center;padding:.55rem;border-radius:.5rem;font-size:.85rem;font-weight:600;color:#fff;background:rgba(255,255,255,.08);border:1px solid rgba(255,255,255,.15);text-decoration:none">Kirish</a>' +
            '<a href="/register" style="flex:1;display:inline-flex;align-items:center;justify-content:center;padding:.55rem;border-radius:.5rem;font-size:.85rem;font-weight:600;color:#fff;background:#913FE2;text-decoration:none">Ro\'yxat</a>' +
          '</div>';
      }
    };
    window.muSyncDrawerAuth(null);

    function openMenu() {
      overlay.style.display = 'block';
      requestAnimationFrame(function () {
        requestAnimationFrame(function () { drawer.style.transform = 'translateX(0)'; });
      });
      document.body.style.overflow = 'hidden';
    }
    function closeMenu() {
      drawer.style.transform = 'translateX(100%)';
      setTimeout(function () { overlay.style.display = 'none'; }, 260);
      document.body.style.overflow = '';
    }

    menuBtn.addEventListener('click', function (e) { e.stopPropagation(); e.preventDefault(); openMenu(); });
    closeBtn.addEventListener('click', closeMenu);
    overlay.addEventListener('click', function (e) { if (e.target === overlay) closeMenu(); });
    document.addEventListener('keydown', function (e) { if (e.key === 'Escape') closeMenu(); });
  }

  /* ══════════════════════════════════════════════
     BROWSE PAGE — full JS implementation
  ══════════════════════════════════════════════ */
  var _browseComics = null;   // cached comic list
  var _browseState  = {
    search: '', genres: [], status: 'all',
    type: 'all', sort: 'latest', minChapters: 0, creator: 'all',
    page: 1, perPage: 20
  };
  var _browseActive = false;

  function isBrowsePage() {
    return !!document.getElementById('series-grid');
  }

  function getParams() {
    var p = new URLSearchParams(location.search);
    _browseState.search      = (p.get('search')  || '').toLowerCase().trim();
    _browseState.status      = (p.get('status')  || 'all').toLowerCase();
    _browseState.type        = (p.get('type')    || 'all').toLowerCase();
    _browseState.sort        = (p.get('sort')    || 'latest').toLowerCase();
    _browseState.minChapters = parseInt(p.get('minChapters') || '0', 10) || 0;
    _browseState.creator     = (p.get('creator') || 'all').toLowerCase();
    _browseState.page        = Math.max(1, parseInt(p.get('page') || '1', 10));
    var g = p.get('genres') || p.get('genre') || '';
    _browseState.genres      = g ? g.split(',').map(function (s) { return s.trim().toLowerCase(); }) : [];
  }

  function statusLabel(s) {
    var map = { ongoing: 'ongoing', completed: 'completed', hiatus: 'hiatus', dropped: 'dropped' };
    return map[(s || '').toLowerCase()] || 'ongoing';
  }

  function buildCard(c) {
    var slug    = c.slug || '';
    var title   = c.title || 'Unknown';
    var cover   = c.cover || '';
    var rating  = parseFloat(c.rating) || 0;
    var status  = statusLabel(c.status);
    var chs     = (c.chapters || []).length;
    var latestCh = chs > 0 ? c.chapters[0].number : null;

    // local cover path → serve via router
    if (cover && cover.indexOf('http') !== 0)
      cover = cover.replace(/^\/public\//, '/public/');   // already correct

    var ratingBadge = rating > 0
      ? '<div style="position:absolute;top:.5rem;right:.5rem;display:flex;align-items:center;gap:.2rem;background:rgba(0,0,0,.7);backdrop-filter:blur(4px);-webkit-backdrop-filter:blur(4px);padding:.15rem .4rem;border-radius:.25rem">' +
        '<svg style="width:.75rem;height:.75rem;color:#facc15;flex-shrink:0" fill="currentColor" viewBox="0 0 20 20"><path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z"/></svg>' +
        '<span style="font-size:.625rem;font-weight:700;color:#fff">' + rating.toFixed(1) + '</span></div>'
      : '';

    var chBadge = latestCh !== null
      ? '<div style="position:absolute;bottom:.5rem;left:.5rem;background:rgba(0,0,0,.7);backdrop-filter:blur(4px);-webkit-backdrop-filter:blur(4px);padding:.1rem .4rem;border-radius:.25rem">' +
        '<span style="font-size:.6rem;font-weight:600;color:rgba(255,255,255,.85)">Ch. ' + latestCh + '</span></div>'
      : '';

    var statusColor = status === 'completed' ? 'bg-blue-500/20 text-blue-300'
      : status === 'hiatus' ? 'bg-yellow-500/20 text-yellow-300'
      : status === 'dropped' ? 'bg-red-500/20 text-red-300'
      : 'bg-[#913FE2]/20 text-[#A78BFA]';

    var imgStyle = 'width:100%;height:100%;object-fit:cover;transition:transform .3s;display:block';

    return '<div class="series-card group bg-[#1f1a2e] rounded-lg overflow-hidden" style="transition:box-shadow .2s,transform .2s" ' +
      'onmouseover="this.style.boxShadow=\'0 0 0 2px #913FE2,0 8px 32px rgba(145,63,226,.25)\';this.querySelector(\'img\').style.transform=\'scale(1.05)\'" ' +
      'onmouseout="this.style.boxShadow=\'\';this.querySelector(\'img\').style.transform=\'\'">' +
      '<a href="/comics/' + slug + '" style="display:block;position:relative;aspect-ratio:3/4;overflow:hidden">' +
        '<img src="' + cover + '" alt="' + title.replace(/"/g, '&quot;') + '" style="' + imgStyle + '" loading="lazy" ' +
          'onerror="this.style.background=\'#1D1B22\';this.removeAttribute(\'src\')">' +
        ratingBadge + chBadge +
      '</a>' +
      '<div style="padding:.75rem">' +
        '<a href="/comics/' + slug + '"><h3 style="font-size:.8125rem;font-weight:600;color:#fff;overflow:hidden;display:-webkit-box;-webkit-line-clamp:1;-webkit-box-orient:vertical" ' +
          'onmouseover="this.style.color=\'#913FE2\'" onmouseout="this.style.color=\'#fff\'">' + title + '</h3></a>' +
        '<div style="display:flex;align-items:center;gap:.5rem;margin-top:.5rem;flex-wrap:wrap">' +
          '<span style="font-size:.75rem;font-weight:500;color:#fff;background:rgba(255,255,255,.08);padding:.15rem .5rem;border-radius:.25rem">' + chs + ' Ch.</span>' +
          '<span style="font-size:.75rem;font-weight:500;padding:.15rem .5rem;border-radius:.25rem;text-transform:capitalize" class="' + statusColor + '">' + status + '</span>' +
        '</div>' +
      '</div>' +
    '</div>';
  }

  function filterAndSort(comics) {
    var s = _browseState;
    var result = comics.filter(function (c) {
      if (s.search && (c.title || '').toLowerCase().indexOf(s.search) === -1) return false;
      if (s.status !== 'all' && (c.status || '').toLowerCase() !== s.status) return false;
      if (s.type !== 'all' && (c.type || '').toLowerCase() !== s.type) return false;
      if (s.minChapters > 0 && (c.chapters || []).length < s.minChapters) return false;
      if (s.creator !== 'all' && (c.author || '').toLowerCase() !== s.creator) return false;
      if (s.genres.length > 0) {
        var cg = (c.genres || []).map(function (g) { return g.toLowerCase(); });
        var ok = s.genres.every(function (g) { return cg.some(function (cg2) { return cg2.indexOf(g) !== -1; }); });
        if (!ok) return false;
      }
      return true;
    });
    // Sort
    result.sort(function (a, b) {
      if (s.sort === 'alpha')   return (a.title || '').localeCompare(b.title || '');
      if (s.sort === 'rating')  return (parseFloat(b.rating) || 0) - (parseFloat(a.rating) || 0);
      if (s.sort === 'views')   return ((b.viewCount || 0) - (a.viewCount || 0));
      /* 'latest' default */    return ((b.latestTs || 0) - (a.latestTs || 0));
    });
    return result;
  }

  function renderBrowse(comics) {
    var filtered = filterAndSort(comics);
    var total    = filtered.length;
    var perPage  = _browseState.perPage;
    var page     = Math.min(_browseState.page, Math.max(1, Math.ceil(total / perPage)));
    var start    = (page - 1) * perPage;
    var pageComics = filtered.slice(start, start + perPage);

    // Update count badge
    var countEl = document.getElementById('series-count');
    if (countEl) { countEl.textContent = total; countEl.setAttribute('data-total', total); }

    // Render grid
    var grid = document.getElementById('series-grid');
    if (grid) {
      if (pageComics.length === 0) {
        grid.innerHTML = '<div style="grid-column:1/-1;text-align:center;padding:4rem 1rem;color:rgba(255,255,255,.4)">' +
          '<svg width="48" height="48" fill="none" viewBox="0 0 24 24" stroke="currentColor" style="margin:0 auto .75rem;display:block;opacity:.3"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M9.172 16.172a4 4 0 015.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>' +
          '<p style="font-size:.875rem">No series found</p></div>';
      } else {
        grid.innerHTML = pageComics.map(buildCard).join('');
      }
    }

    // Render pagination
    renderPagination(page, Math.ceil(total / perPage));
  }

  function renderPagination(current, totalPages) {
    var nav = document.getElementById('pagination-nav');
    if (!nav) return;
    if (totalPages <= 1) { nav.innerHTML = ''; return; }

    function pageBtn(n, label, active, disabled) {
      var base = 'display:inline-flex;align-items:center;justify-content:center;width:2rem;height:2rem;border-radius:.375rem;font-size:.8125rem;font-weight:700;cursor:pointer;border:none;transition:background .15s;';
      if (disabled) base += 'background:rgba(255,255,255,.06);color:rgba(255,255,255,.25);cursor:default;pointer-events:none';
      else if (active) base += 'background:#913FE2;color:#fff';
      else base += 'background:rgba(255,255,255,.08);color:#fff';
      var click = disabled ? '' : 'onclick="window.__browseGoPage(' + n + ')"';
      return '<button ' + click + ' style="' + base + '" aria-label="' + (label || 'Page ' + n) + '">' + (label || n) + '</button>';
    }

    var html = '<div style="display:flex;align-items:center;gap:.375rem;flex-wrap:wrap;justify-content:center">';
    // Prev
    html += pageBtn(current - 1, '‹', false, current <= 1);

    // Page numbers
    var pages = [];
    if (totalPages <= 7) {
      for (var i = 1; i <= totalPages; i++) pages.push(i);
    } else {
      pages = [1];
      if (current > 3) pages.push('…');
      for (var j = Math.max(2, current - 1); j <= Math.min(totalPages - 1, current + 1); j++) pages.push(j);
      if (current < totalPages - 2) pages.push('…');
      pages.push(totalPages);
    }

    pages.forEach(function (p) {
      if (p === '…') {
        html += '<span style="color:rgba(255,255,255,.3);padding:0 .25rem">…</span>';
      } else {
        html += pageBtn(p, null, p === current, false);
      }
    });

    html += pageBtn(current + 1, '›', false, current >= totalPages);
    html += '</div>';
    nav.innerHTML = html;
  }

  window.__browseGoPage = function (n) {
    _browseState.page = n;
    if (_browseComics) renderBrowse(_browseComics);
    var p = new URLSearchParams(location.search);
    p.set('page', n);
    history.replaceState(null, '', location.pathname + '?' + p.toString());
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  function initBrowsePage() {
    if (_browseActive) return;
    _browseActive = true;
    getParams();

    // Pre-fill search input if ?search= in URL
    if (_browseState.search) {
      document.querySelectorAll('input[placeholder*="Search"]').forEach(function (inp) {
        inp.value = _browseState.search.charAt(0).toUpperCase() + _browseState.search.slice(1);
      });
    }

    // Wire search inputs (Enter → redirect to /browse?search=...)
    document.querySelectorAll('input[placeholder*="Search"]').forEach(wireSearch);
    // Nav search on browse page: autocomplete dropdown
    document.querySelectorAll('input[placeholder="Search..."]').forEach(wireSearchDropdown);

    // Browse-specific inputs: also live-filter on every keystroke
    document.querySelectorAll('input[placeholder*="Search series"]').forEach(function (inp) {
      if (inp._fixLive) return;
      inp._fixLive = true;
      inp.addEventListener('input', function () {
        _browseState.search = this.value.trim().toLowerCase();
        _browseState.page = 1;
        if (_browseComics) renderBrowse(_browseComics);
        // Sync URL param
        var p = new URLSearchParams(location.search);
        if (_browseState.search) p.set('search', _browseState.search);
        else p.delete('search');
        history.replaceState(null, '', location.pathname + (p.toString() ? '?' + p.toString() : ''));
      });
    });

    // Fetch comics and render
    fetch('/api/comics.json')
      .then(function (r) { return r.json(); })
      .then(function (data) {
        // Sort by latest update descending
        data.sort(function (a, b) {
          return ((b.latestTs || 0) - (a.latestTs || 0)) || a.title.localeCompare(b.title);
        });
        _browseComics = data;
        renderBrowse(data);
        wireBrowseFilters(data);
      })
      .catch(function () {
        // Fallback: keep existing SSR cards, just fix links
        fixLinks();
      });
  }

  function wireBrowseFilters(comics) {
    // ── Collect unique genres, types, authors from data ──
    var genreSet = {}, typeSet = {}, authorSet = {};
    comics.forEach(function (c) {
      (c.genres || []).forEach(function (g) { genreSet[g.toLowerCase()] = g; });
      var t = (c.type || '').trim();
      if (t) typeSet[t.toLowerCase()] = t;
      var a = (c.author || '').trim();
      if (a) authorSet[a.toLowerCase()] = a;
    });
    var genres  = Object.values(genreSet).sort();
    var types   = Object.values(typeSet).sort();
    var authors = Object.values(authorSet).sort();

    // ── Config per button label ──
    // Each config:
    //   key: _browseState field to update
    //   opts: array of {label, val} objects
    //   multi: true → checkbox list, false → radio list
    //   isSort: true → change sort order, no state key
    var SORT_OPTS = [
      { label: 'Latest Update', val: 'latest' },
      { label: 'Alphabetical',  val: 'alpha'  },
      { label: 'Rating',        val: 'rating' },
      { label: 'Most Viewed',   val: 'views'  },
    ];
    var STATUS_OPTS = ['All','Ongoing','Completed','Hiatus','Dropped'].map(function (s) {
      return { label: s, val: s.toLowerCase() };
    });
    var TYPE_OPTS = [{ label: 'All', val: 'all' }].concat(types.map(function (t) {
      return { label: t, val: t.toLowerCase() };
    }));
    var GENRE_OPTS   = genres.map(function (g) { return { label: g, val: g.toLowerCase() }; });
    var CREATOR_OPTS = [{ label: 'All', val: 'all' }].concat(authors.map(function (a) {
      return { label: a, val: a.toLowerCase() };
    }));
    var MINCH_OPTS = [
      { label: 'Any',   val: 0   },
      { label: '10+',   val: 10  },
      { label: '25+',   val: 25  },
      { label: '50+',   val: 50  },
      { label: '100+',  val: 100 },
      { label: '200+',  val: 200 },
    ];

    function matchLabel(spanText, keyword) {
      return spanText.toLowerCase().indexOf(keyword.toLowerCase()) !== -1;
    }

    function getConfig(spanText) {
      if (matchLabel(spanText, 'Latest Update') || matchLabel(spanText, 'Latest')) {
        return { key: 'sort', opts: SORT_OPTS, multi: false, isSort: true };
      }
      if (matchLabel(spanText, 'Status')) {
        return { key: 'status', opts: STATUS_OPTS, multi: false };
      }
      if (matchLabel(spanText, 'Type')) {
        return { key: 'type', opts: TYPE_OPTS, multi: false };
      }
      if (matchLabel(spanText, 'Genres') || matchLabel(spanText, 'Genre')) {
        return { key: 'genres', opts: GENRE_OPTS, multi: true };
      }
      if (matchLabel(spanText, 'Minimum Chapters') || matchLabel(spanText, 'Min')) {
        return { key: 'minChapters', opts: MINCH_OPTS, multi: false, isNum: true };
      }
      if (matchLabel(spanText, 'Creator')) {
        return { key: 'creator', opts: CREATOR_OPTS, multi: false };
      }
      return null;
    }

    // ── Helper: build a checkmark SVG ──
    var CHECK_SVG = '<svg width="10" height="10" fill="none" viewBox="0 0 10 10" stroke="#fff" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M2 5l2 2 4-4"/></svg>';

    function makeCheck() {
      var el = document.createElement('span');
      el.style.cssText = 'width:.875rem;height:.875rem;border:1.5px solid rgba(255,255,255,.3);border-radius:.2rem;flex-shrink:0;display:inline-flex;align-items:center;justify-content:center;transition:background .12s,border-color .12s';
      return el;
    }
    function activateCheck(c) {
      c.style.background = '#913FE2';
      c.style.borderColor = '#913FE2';
      c.innerHTML = CHECK_SVG;
    }
    function deactivateCheck(c) {
      c.style.background = '';
      c.style.borderColor = 'rgba(255,255,255,.3)';
      c.innerHTML = '';
    }

    // ── Wire each dropdown button ──
    document.querySelectorAll('button[data-dropdown="true"]').forEach(function (btn) {
      if (btn._fixDrop) return;
      btn._fixDrop = true;

      var spanText = (btn.querySelector('span') || {}).textContent || '';
      var cfg = getConfig(spanText);
      if (!cfg) return; // Creator etc — skip

      // Build panel
      var panel = document.createElement('div');
      panel.className = '_fix-drop-panel';
      panel.style.cssText = [
        'display:none', 'position:absolute', 'top:calc(100% + .375rem)', 'left:0',
        'z-index:500', 'background:#1C1924', 'border:1px solid rgba(255,255,255,.1)',
        'border-radius:.75rem', 'padding:.5rem', 'box-shadow:0 16px 48px rgba(0,0,0,.55)',
        cfg.multi ? 'min-width:220px;max-width:300px;max-height:320px;overflow-y:auto' : 'min-width:180px'
      ].join(';');

      // Track check elements for radio (single-select) reset
      var checkEls = [];

      cfg.opts.forEach(function (opt) {
        var item = document.createElement('div');
        item.style.cssText = 'display:flex;align-items:center;gap:.5rem;padding:.4rem .6rem;border-radius:.375rem;cursor:pointer;color:rgba(255,255,255,.8);font-size:.8125rem;transition:background .1s';
        item.onmouseover = function () { this.style.background = 'rgba(255,255,255,.07)'; };
        item.onmouseout  = function () { this.style.background = ''; };

        var chk = makeCheck();
        checkEls.push(chk);

        // Mark initially active option
        var isActive = false;
        if (cfg.multi) {
          isActive = _browseState.genres.indexOf(opt.val) !== -1;
        } else if (cfg.isSort) {
          isActive = _browseState.sort === opt.val;
        } else if (cfg.isNum) {
          isActive = _browseState.minChapters === opt.val;
        } else {
          isActive = _browseState[cfg.key] === opt.val || (opt.val === 'all' && _browseState[cfg.key] === 'all');
        }
        if (isActive) activateCheck(chk);

        var lbl = document.createElement('span');
        lbl.textContent = opt.label;

        item.appendChild(chk);
        item.appendChild(lbl);

        item.addEventListener('click', function (e) {
          e.stopPropagation();
          if (cfg.multi) {
            // Genre: toggle checkbox
            var idx = _browseState.genres.indexOf(opt.val);
            if (idx === -1) { _browseState.genres.push(opt.val); activateCheck(chk); }
            else { _browseState.genres.splice(idx, 1); deactivateCheck(chk); }
          } else {
            // Radio: deactivate all, activate clicked
            checkEls.forEach(deactivateCheck);
            activateCheck(chk);
            if (cfg.isSort)     _browseState.sort        = opt.val;
            else if (cfg.isNum) _browseState.minChapters = opt.val;
            else                _browseState[cfg.key]    = opt.val;
            // Close panel after single-select
            panel.style.display = 'none';
          }
          _browseState.page = 1;
          if (_browseComics) renderBrowse(_browseComics);
          // Update button label for sort/single-select
          if (!cfg.multi) {
            var labelSpan = btn.querySelector('span');
            if (labelSpan && cfg.isSort) labelSpan.textContent = opt.label;
          }
        });

        panel.appendChild(item);
      });

      // Attach panel
      var parent = btn.parentElement;
      parent.style.position = 'relative';
      parent.appendChild(panel);

      // Toggle
      btn.addEventListener('click', function (e) {
        e.stopPropagation();
        var wasOpen = panel.style.display !== 'none';
        document.querySelectorAll('._fix-drop-panel').forEach(function (p2) { p2.style.display = 'none'; });
        if (!wasOpen) panel.style.display = 'block';
      });
    });

    // ── Hide Bookmarked toggle (no data-dropdown) ──
    document.querySelectorAll('button').forEach(function (btn) {
      var span = btn.querySelector('span');
      if (!span || span.textContent.trim() !== 'Hide Bookmarked') return;
      if (btn._fixBookmark) return;
      btn._fixBookmark = true;

      var active = false;
      btn.addEventListener('click', function () {
        active = !active;
        if (active) {
          btn.style.background = '#913FE2';
          btn.style.borderColor = '#913FE2';
          btn.style.color = '#fff';
          // Show info toast
          var t = document.getElementById('_mu-bm-toast');
          if (t) t.remove();
          t = document.createElement('div');
          t.id = '_mu-bm-toast';
          t.style.cssText = 'position:fixed;bottom:1.5rem;right:1.5rem;z-index:99999;background:#1D1B22;color:#fff;padding:.75rem 1.1rem;border-radius:.75rem;border:1px solid rgba(255,255,255,.12);box-shadow:0 8px 32px rgba(0,0,0,.5);font-size:.8125rem;opacity:0;transition:opacity .2s';
          t.innerHTML = '<b style="color:#913FE2">Bookmarks</b><span style="color:rgba(255,255,255,.6)"> — bu local mirrorda mavjud emas</span>';
          document.body.appendChild(t);
          requestAnimationFrame(function () { t.style.opacity = '1'; });
          setTimeout(function () { t.style.opacity = '0'; setTimeout(function () { t.remove(); }, 220); }, 2500);
        } else {
          btn.style.background = '';
          btn.style.borderColor = '';
          btn.style.color = '';
        }
      });
    });

    // Close all panels on outside click
    document.addEventListener('click', function () {
      document.querySelectorAll('._fix-drop-panel').forEach(function (p) { p.style.display = 'none'; });
    });
  }

  /* ══════════════════════════════════════════════
     HERO CAROUSEL (Embla replacement)
     HeroCarouselEmbla.js is missing — we show the
     pre-rendered slides and add simple navigation.
  ══════════════════════════════════════════════ */
  function fixHeroCarousel() {
    var skeleton  = document.querySelector('.hero-skeleton');
    var embla     = document.querySelector('.embla-hero');
    var container = document.querySelector('.embla-hero__container');
    if (!embla || !container) return;

    // Hide skeleton, reveal carousel
    if (skeleton) { skeleton.style.opacity = '0'; skeleton.style.pointerEvents = 'none'; }
    embla.style.opacity = '1';

    var slides = Array.from(container.querySelectorAll('.embla-hero__slide'));
    if (slides.length === 0) return;

    var current = 0;
    slides.forEach(function (s, i) { if (s.classList.contains('is-active')) current = i; });

    // Enable pointer-events on all slide links
    slides.forEach(function (s) {
      var link = s.querySelector('.slide-link');
      if (link) link.style.pointerEvents = 'auto';
    });

    /* ── Set active slide (centers it) ── */
    function setActive(idx) {
      idx = Math.max(0, Math.min(slides.length - 1, idx));
      slides[current].classList.remove('is-active');
      current = idx;
      slides[current].classList.add('is-active');
      // Scroll to center the active slide
      var s   = slides[current];
      var tgt = s.offsetLeft + s.offsetWidth / 2 - container.offsetWidth / 2;
      container.scrollTo({ left: tgt, behavior: 'smooth' });
    }

    /* ── Click on a slide → activate it + update background ── */
    slides.forEach(function (s, i) {
      s.addEventListener('click', function (e) {
        if (i !== current) { e.preventDefault(); setActive(i); updateBg(); }
      });
    });

    /* ── Detect center slide after scroll ── */
    function updateActiveFromScroll() {
      var mid = container.scrollLeft + container.offsetWidth / 2;
      var best = 0, bestDist = Infinity;
      slides.forEach(function (s, i) {
        var dist = Math.abs(s.offsetLeft + s.offsetWidth / 2 - mid);
        if (dist < bestDist) { bestDist = dist; best = i; }
      });
      if (best !== current) {
        slides[current].classList.remove('is-active');
        current = best;
        slides[current].classList.add('is-active');
      }
    }

    /* ── Smooth inertia drag ── */
    container.style.overflow  = 'hidden';
    container.style.userSelect = 'none';
    container.style.cursor    = 'default';

    var drag = {
      active: false, moved: false,
      startX: 0, startScroll: 0,
      lastX: 0, lastTime: 0, velocity: 0,
      raf: null
    };

    function cancelMomentum() {
      if (drag.raf) { cancelAnimationFrame(drag.raf); drag.raf = null; }
    }

    function applyMomentum() {
      drag.velocity *= 0.92;           // friction — change to slow down faster/slower
      if (Math.abs(drag.velocity) < 0.5) {
        updateActiveFromScroll();
        updateBg();
        return;
      }
      container.scrollLeft += drag.velocity;
      drag.raf = requestAnimationFrame(applyMomentum);
    }

    container.addEventListener('mousedown', function (e) {
      cancelMomentum();
      drag.active     = true;
      drag.moved      = false;
      drag.startX     = e.pageX;
      drag.startScroll = container.scrollLeft;
      drag.lastX      = e.pageX;
      drag.lastTime   = Date.now();
      drag.velocity   = 0;
    });

    window.addEventListener('mousemove', function (e) {
      if (!drag.active) return;
      var dx = e.pageX - drag.startX;
      if (!drag.moved && Math.abs(dx) < 6) return;
      drag.moved = true;
      container.style.cursor = 'grabbing';

      // Track velocity
      var now = Date.now();
      var dt  = now - drag.lastTime || 1;
      drag.velocity = (drag.lastX - e.pageX) / dt * 14;  // speed multiplier
      drag.lastX    = e.pageX;
      drag.lastTime = now;

      container.scrollLeft = drag.startScroll + (drag.startX - e.pageX);
    });

    window.addEventListener('mouseup', function () {
      if (!drag.active) return;
      drag.active = false;
      container.style.cursor = 'default';
      if (drag.moved) {
        drag.raf = requestAnimationFrame(applyMomentum);
        // updateBg called inside applyMomentum → updateActiveFromScroll
      }
    });

    container.addEventListener('click', function (e) {
      if (drag.moved) { e.stopPropagation(); e.preventDefault(); drag.moved = false; }
    }, true);

    /* ── Touch drag ── */
    var touchStartX = 0, touchScrollLeft = 0;
    container.addEventListener('touchstart', function (e) {
      touchStartX    = e.touches[0].pageX;
      touchScrollLeft = container.scrollLeft;
    }, { passive: true });
    container.addEventListener('touchmove', function (e) {
      var dx = e.touches[0].pageX - touchStartX;
      container.scrollLeft = touchScrollLeft - dx;
    }, { passive: true });
    container.addEventListener('touchend', function () {
      updateActiveFromScroll();
    });

    /* ── Background image changes with active slide ── */
    var bgImg = document.querySelector('.hero-section-embla > img');
    function updateBg() {
      if (!bgImg) return;
      var activeImg = slides[current].querySelector('img');
      if (activeImg) {
        // Use the larger (non -400) version for background
        var src = activeImg.src.replace(/-400(\.webp)$/, '$1');
        bgImg.style.transition = 'opacity .5s';
        bgImg.style.opacity = '0';
        setTimeout(function () {
          bgImg.src = src;
          bgImg.style.opacity = '1';
        }, 300);
      }
    }

    /* ── Auto-rotate every 5 seconds ── */
    var autoTimer = setInterval(function () {
      var next = (current + 1) % slides.length;
      setActive(next);
      updateBg();
    }, 5000);

    embla.addEventListener('mouseenter', function () { clearInterval(autoTimer); });
    embla.addEventListener('mouseleave', function () {
      autoTimer = setInterval(function () {
        setActive((current + 1) % slides.length);
        updateBg();
      }, 5000);
    });

    // Start with the MIDDLE slide active so it appears centered
    setTimeout(function () { setActive(Math.floor(slides.length / 2)); updateBg(); }, 80);
  }

  /* ══════════════════════════════════════════════
     TRENDING CAROUSEL — wire Next/Prev + drag
  ══════════════════════════════════════════════ */
  function fixTrendingCarousel() {
    var wrap      = document.querySelector('.embla-trending');
    var container = document.querySelector('.embla-trending__container');
    var nextBtn   = document.querySelector('button[aria-label="Next series"]');
    if (!wrap || !container || !nextBtn || nextBtn._fixTrend) return;
    nextBtn._fixTrend = true;

    var slides = container.querySelectorAll('.embla-trending__slide');
    var slideW = slides.length > 0 ? (slides[0].offsetWidth || 150) + 12 : 162;

    function scrollBy(delta) { container.scrollBy({ left: delta, behavior: 'smooth' }); }

    // Wire existing Next button
    nextBtn.addEventListener('click', function () { scrollBy(slideW * 3); });

    // Build Prev button
    var prevBtn = document.createElement('button');
    prevBtn.setAttribute('aria-label', 'Previous series');
    prevBtn.setAttribute('type', 'button');
    var btnBase = 'position:absolute;top:100px;transform:translateY(-50%);width:2rem;height:2rem;' +
      'background:rgba(0,0,0,.7);border-radius:50%;display:flex;align-items:center;' +
      'justify-content:center;cursor:pointer;z-index:10;border:none;color:#fff;transition:opacity .2s,background .15s';
    prevBtn.style.cssText = btnBase + ';left:.5rem';
    nextBtn.style.cssText = btnBase + ';right:.5rem';
    prevBtn.innerHTML = '<svg width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 19l-7-7 7-7"/></svg>';
    prevBtn.onmouseover = function () { this.style.background = 'rgba(0,0,0,.9)'; };
    prevBtn.onmouseout  = function () { this.style.background = 'rgba(0,0,0,.7)'; };
    prevBtn.addEventListener('click', function () { scrollBy(-slideW * 3); });
    nextBtn.parentElement.appendChild(prevBtn);

    // Hide/show buttons based on scroll position
    function updateBtnVisibility() {
      var sl   = container.scrollLeft;
      var maxSl = container.scrollWidth - container.offsetWidth;
      prevBtn.style.opacity = sl <= 2        ? '0' : '1';
      prevBtn.style.pointerEvents = sl <= 2  ? 'none' : 'auto';
      nextBtn.style.opacity = sl >= maxSl - 2 ? '0' : '1';
      nextBtn.style.pointerEvents = sl >= maxSl - 2 ? 'none' : 'auto';
    }

    container.addEventListener('scroll', updateBtnVisibility, { passive: true });
    updateBtnVisibility(); // run once on init (hides prev at start)

    // Smooth inertia drag (same as hero)
    var td = { active:false, moved:false, startX:0, startScroll:0, lastX:0, lastTime:0, velocity:0, raf:null };

    function tCancelMomentum() { if (td.raf) { cancelAnimationFrame(td.raf); td.raf = null; } }
    function tApplyMomentum() {
      td.velocity *= 0.90;
      if (Math.abs(td.velocity) < 0.5) return;
      container.scrollLeft += td.velocity;
      td.raf = requestAnimationFrame(tApplyMomentum);
    }

    container.style.overflow   = 'hidden';
    container.style.userSelect = 'none';

    container.addEventListener('mousedown', function (e) {
      tCancelMomentum();
      td.active = true; td.moved = false;
      td.startX = e.pageX; td.startScroll = container.scrollLeft;
      td.lastX = e.pageX; td.lastTime = Date.now(); td.velocity = 0;
    });
    window.addEventListener('mousemove', function (e) {
      if (!td.active) return;
      var dx = e.pageX - td.startX;
      if (!td.moved && Math.abs(dx) < 6) return;
      td.moved = true;
      var now = Date.now(), dt = now - td.lastTime || 1;
      td.velocity = (td.lastX - e.pageX) / dt * 12;
      td.lastX = e.pageX; td.lastTime = now;
      container.scrollLeft = td.startScroll + (td.startX - e.pageX);
    });
    window.addEventListener('mouseup', function () {
      if (!td.active) return;
      td.active = false;
      if (td.moved) td.raf = requestAnimationFrame(tApplyMomentum);
    });
    container.addEventListener('click', function (e) {
      if (td.moved) { e.stopPropagation(); e.preventDefault(); td.moved = false; }
    }, true);

    // Touch
    var tTouch = { startX:0, startScroll:0 };
    container.addEventListener('touchstart', function (e) {
      tTouch.startX = e.touches[0].pageX;
      tTouch.startScroll = container.scrollLeft;
    }, { passive:true });
    container.addEventListener('touchmove', function (e) {
      container.scrollLeft = tTouch.startScroll - (e.touches[0].pageX - tTouch.startX);
    }, { passive:true });
  }

  /* ══════════════════════════════════════════════
     ANNOUNCEMENTS CAROUSEL — wire Next/Prev + drag
  ══════════════════════════════════════════════ */
  function fixAnnouncementsCarousel() {
    var container = document.querySelector('.embla-announcements__container');
    var nextBtn   = document.querySelector('button[aria-label="Next announcement"]');
    if (!container || !nextBtn || nextBtn._fixAnn) return;
    nextBtn._fixAnn = true;

    var slides = container.querySelectorAll('.embla-announcements__slide');
    var slideW = slides.length > 0 ? (slides[0].offsetWidth || 400) + 14 : 414;

    function scrollBy(d) { container.scrollBy({ left: d, behavior: 'smooth' }); }

    nextBtn.addEventListener('click', function () { scrollBy(slideW); });

    // Prev button
    var prevBtn = document.createElement('button');
    prevBtn.setAttribute('type', 'button');
    prevBtn.setAttribute('aria-label', 'Previous announcement');
    var bStyle = 'position:absolute;top:50%;transform:translateY(-50%);width:2rem;height:2rem;' +
      'background:rgba(0,0,0,.7);border-radius:50%;display:flex;align-items:center;' +
      'justify-content:center;z-index:10;border:none;color:#fff;cursor:pointer;transition:opacity .2s,background .15s';
    prevBtn.style.cssText = bStyle + ';left:.5rem';
    nextBtn.style.cssText = bStyle + ';right:.5rem';
    prevBtn.innerHTML = '<svg width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 19l-7-7 7-7"/></svg>';
    prevBtn.onmouseover = function () { this.style.background = 'rgba(0,0,0,.9)'; };
    prevBtn.onmouseout  = function () { this.style.background = 'rgba(0,0,0,.7)'; };
    prevBtn.addEventListener('click', function () { scrollBy(-slideW); });
    nextBtn.parentElement.appendChild(prevBtn);

    // Hide at edges
    function updateVis() {
      var sl = container.scrollLeft, max = container.scrollWidth - container.offsetWidth;
      prevBtn.style.opacity = sl <= 2 ? '0' : '1';
      prevBtn.style.pointerEvents = sl <= 2 ? 'none' : 'auto';
      nextBtn.style.opacity = sl >= max - 2 ? '0' : '1';
      nextBtn.style.pointerEvents = sl >= max - 2 ? 'none' : 'auto';
    }
    container.addEventListener('scroll', updateVis, { passive: true });
    updateVis();

    // Inertia drag
    var ad = { active:false, moved:false, startX:0, startScroll:0, lastX:0, lastTime:0, velocity:0, raf:null };
    function cancelM() { if (ad.raf) { cancelAnimationFrame(ad.raf); ad.raf = null; } }
    function applyM() {
      ad.velocity *= 0.88;
      if (Math.abs(ad.velocity) < 0.5) { updateVis(); return; }
      container.scrollLeft += ad.velocity;
      ad.raf = requestAnimationFrame(applyM);
    }
    container.style.overflow = 'hidden';
    container.style.userSelect = 'none';

    container.addEventListener('mousedown', function (e) {
      cancelM(); ad.active=true; ad.moved=false;
      ad.startX=e.pageX; ad.startScroll=container.scrollLeft;
      ad.lastX=e.pageX; ad.lastTime=Date.now(); ad.velocity=0;
    });
    window.addEventListener('mousemove', function (e) {
      if (!ad.active) return;
      var dx = e.pageX - ad.startX;
      if (!ad.moved && Math.abs(dx) < 6) return;
      ad.moved = true;
      var now = Date.now(), dt = now - ad.lastTime || 1;
      ad.velocity = (ad.lastX - e.pageX) / dt * 12;
      ad.lastX = e.pageX; ad.lastTime = now;
      container.scrollLeft = ad.startScroll + (ad.startX - e.pageX);
    });
    window.addEventListener('mouseup', function () {
      if (!ad.active) return; ad.active = false;
      if (ad.moved) ad.raf = requestAnimationFrame(applyM);
    });
    container.addEventListener('click', function (e) {
      if (ad.moved) { e.stopPropagation(); e.preventDefault(); ad.moved = false; }
    }, true);

    // Touch
    var at = { startX:0, startScroll:0 };
    container.addEventListener('touchstart', function (e) {
      at.startX = e.touches[0].pageX; at.startScroll = container.scrollLeft;
    }, { passive:true });
    container.addEventListener('touchmove', function (e) {
      container.scrollLeft = at.startScroll - (e.touches[0].pageX - at.startX);
    }, { passive:true });
    container.addEventListener('touchend', updateVis);
  }

  /* ══════════════════════════════════════════════
     POPULAR SIDEBAR TABS — Weekly / Monthly / All Time
  ══════════════════════════════════════════════ */
  function fixPopularTabs() {
    // Buttons contain 2 spans each — use includes() not exact match
    function tabPeriod(btn) {
      var t = btn.textContent || '';
      if (t.indexOf('Weekly')   !== -1) return 0;
      if (t.indexOf('Monthly')  !== -1) return 1;
      if (t.indexOf('All Time') !== -1) return 2;
      return -1;
    }

    // Find the Popular section wrapper
    var popularSections = [];
    document.querySelectorAll('button').forEach(function (btn) {
      if (tabPeriod(btn) !== 0) return;          // look for Weekly buttons
      var parent = btn.parentElement;
      if (parent._fixTabs) return;
      parent._fixTabs = true;

      // Collect sibling tab buttons inside same parent
      var btns = Array.from(parent.querySelectorAll('button')).filter(function (b) {
        return tabPeriod(b) >= 0;
      });
      if (btns.length < 2) return;

      // Find comic list: nearest .flex.flex-col.gap-3 in ancestor
      var ancestor = parent;
      var listEl = null;
      for (var i = 0; i < 6; i++) {
        ancestor = ancestor.parentElement;
        if (!ancestor) break;
        listEl = ancestor.querySelector('.flex.flex-col.gap-3');
        if (listEl) break;
      }

      btns.forEach(function (btn) {
        btn.addEventListener('click', function () {
          var period = tabPeriod(btn);
          // Active style
          btns.forEach(function (b) {
            b.style.background = '';
            b.style.color = 'rgba(255,255,255,.6)';
          });
          btn.style.background = '#913FE2';
          btn.style.color = '#fff';
          // Re-render list
          if (listEl && _browseComics) renderPopularList(listEl, period);
        });
      });
    });
  }

  function renderPopularList(container, periodIdx) {
    if (!_browseComics) return;
    var comics = _browseComics.slice();

    // Sort by viewCount desc for all periods (we only have one dataset)
    comics.sort(function (a, b) {
      if (periodIdx === 0) { // Weekly — latest first
        return ((b.latestTs || 0) - (a.latestTs || 0));
      } else if (periodIdx === 1) { // Monthly — by rating
        return (parseFloat(b.rating) || 0) - (parseFloat(a.rating) || 0);
      } else { // All Time — by view count
        return ((b.viewCount || 0) - (a.viewCount || 0)) ||
               ((parseFloat(b.rating) || 0) - (parseFloat(a.rating) || 0));
      }
    });

    comics = comics.slice(0, 10);
    var starSvg = '<svg class="w-3 h-3 fill-yellow-400" viewBox="0 0 24 24"><path d="M11.525 2.295a.53.53 0 0 1 .95 0l2.31 4.679a2.123 2.123 0 0 0 1.595 1.16l5.166.756a.53.53 0 0 1 .294.904l-3.736 3.638a2.123 2.123 0 0 0-.611 1.878l.882 5.14a.53.53 0 0 1-.771.56l-4.618-2.428a2.122 2.122 0 0 0-1.973 0L6.396 21.01a.53.53 0 0 1-.77-.56l.881-5.139a2.122 2.122 0 0 0-.611-1.879L2.16 9.795a.53.53 0 0 1 .294-.906l5.165-.755a2.122 2.122 0 0 0 1.597-1.16z"/></svg>';

    container.innerHTML = comics.map(function (c, i) {
      var cover  = c.cover || '';
      var rating = parseFloat(c.rating) || 0;
      var genres = (c.genres || []).slice(0, 3).join(', ');
      return '<div class="flex gap-3 px-2 py-2.5 relative rounded-lg hover:bg-white/[0.03] transition-colors group cursor-pointer" onclick="location.href=\'/comics/' + c.slug + '\'">' +
        '<div class="relative flex-shrink-0"><div class="overflow-hidden rounded-lg">' +
        '<img src="' + cover + '" alt="' + (c.title||'').replace(/"/g,'&quot;') + '" class="w-12 md:w-14 h-16 md:h-[72px] object-cover transition-transform duration-300 group-hover:scale-105" loading="lazy" onerror="this.style.background=\'#1D1B22\'">' +
        '</div><div class="absolute -top-1 -left-1 w-5 h-5 bg-[#913FE2] rounded-full flex items-center justify-center text-xs font-bold text-white">' + (i+1) + '</div></div>' +
        '<div class="flex-1 min-w-0 overflow-hidden">' +
        '<span class="block text-[14px] font-medium text-white leading-tight line-clamp-2 group-hover:text-[#913FE2] transition-colors">' + (c.title||'') + '</span>' +
        '<p class="text-[12px] text-[#888] mt-1">' + genres + '</p>' +
        '<div class="mt-1 flex items-center gap-0.5">' + starSvg +
        '<span class="text-xs text-[#999] font-bold ml-1">' + (rating > 0 ? rating.toFixed(1) : '—') + '</span></div>' +
        '</div></div>';
    }).join('');
  }

  /* ══════════════════════════════════════════════
     AUTH STATE — check session + update nav
  ══════════════════════════════════════════════ */
  var _muUser = null;  // current logged-in user or null

  function checkAuth(cb) {
    fetch('/api/auth/me', { credentials: 'same-origin' })
      .then(function (r) { return r.json(); })
      .then(function (d) { _muUser = d.user || null; if (cb) cb(_muUser); })
      .catch(function ()  { _muUser = null; if (cb) cb(null); });
  }

  function renderNavUser(user) {
    document.querySelectorAll('.user-menu-login').forEach(function (el) {
      el._fixLogin = true;
      if (user) {
        // Logged-in: show avatar + name + logout
        var initials = (user.name || 'U').slice(0, 2).toUpperCase();
        el.style.cssText = 'display:flex;align-items:center;gap:.5rem';
        el.innerHTML =
          '<div style="display:flex;align-items:center;gap:.5rem;cursor:pointer;padding:.3rem .6rem;border-radius:.5rem;transition:background .15s" onmouseover="this.style.background=\'rgba(255,255,255,.08)\'" onmouseout="this.style.background=\'\'" onclick="_muUserMenu(this)">' +
            '<div style="width:2rem;height:2rem;border-radius:50%;background:linear-gradient(135deg,#913FE2,#7B2FD1);display:inline-flex;align-items:center;justify-content:center;font-weight:700;font-size:.75rem;color:#fff;flex-shrink:0">' + initials + '</div>' +
            '<span style="font-size:.875rem;font-weight:500;color:rgba(255,255,255,.85);max-width:100px;overflow:hidden;white-space:nowrap;text-overflow:ellipsis">' + (user.name || user.email) + '</span>' +
            '<svg width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2" style="opacity:.5"><path stroke-linecap="round" stroke-linejoin="round" d="M19 9l-7 7-7-7"/></svg>' +
          '</div>';
      } else {
        // Logged-out: show Login + Register buttons
        el.style.cssText = 'display:flex;align-items:center;gap:.5rem';
        el.innerHTML =
          '<a href="/login" style="display:inline-flex;align-items:center;padding:.4rem .875rem;border-radius:.5rem;font-size:.8125rem;font-weight:600;color:#fff;background:rgba(255,255,255,.18);border:1.5px solid rgba(255,255,255,.55);text-decoration:none;transition:background .15s" onmouseover="this.style.background=\'rgba(255,255,255,.28)\'" onmouseout="this.style.background=\'rgba(255,255,255,.18)\'">Kirish</a>' +
          '<a href="/register" style="display:inline-flex;align-items:center;padding:.4rem .875rem;border-radius:.5rem;font-size:.8125rem;font-weight:600;color:#913FE2;background:#fff;border:1.5px solid #fff;text-decoration:none;transition:opacity .15s" onmouseover="this.style.opacity=\'.88\'" onmouseout="this.style.opacity=\'1\'">Ro\'yxat</a>';
      }
    });
  }

  /* User dropdown menu (when logged in) */
  window._muUserMenu = function (trigger) {
    var existing = document.getElementById('_mu-user-dd');
    if (existing) { existing.remove(); return; }

    var dd = document.createElement('div');
    dd.id = '_mu-user-dd';
    dd.style.cssText = [
      'position:absolute', 'top:calc(100% + .5rem)', 'right:0',
      'z-index:9999', 'background:#1C1924',
      'border:1px solid rgba(255,255,255,.1)', 'border-radius:.75rem',
      'padding:.5rem', 'min-width:180px',
      'box-shadow:0 12px 40px rgba(0,0,0,.5)'
    ].join(';');

    // User info row
    if (_muUser) {
      var info = document.createElement('div');
      info.style.cssText = 'padding:.5rem .75rem .75rem;border-bottom:1px solid rgba(255,255,255,.08);margin-bottom:.25rem';
      info.innerHTML = '<div style="font-size:.875rem;font-weight:600;color:#fff">' + (_muUser.name || '') + '</div>' +
        '<div style="font-size:.75rem;color:rgba(255,255,255,.4);margin-top:.1rem">' + (_muUser.email || '') + '</div>';
      dd.appendChild(info);
    }

    function ddItem(icon, label, action) {
      var item = document.createElement('div');
      item.style.cssText = 'display:flex;align-items:center;gap:.625rem;padding:.5rem .75rem;border-radius:.375rem;cursor:pointer;color:rgba(255,255,255,.75);font-size:.875rem;transition:background .1s';
      item.onmouseover = function () { this.style.background = 'rgba(255,255,255,.07)'; };
      item.onmouseout  = function () { this.style.background = ''; };
      item.innerHTML   = icon + label;
      item.onclick     = action;
      dd.appendChild(item);
    }

    ddItem('<svg width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2" style="flex-shrink:0"><path stroke-linecap="round" stroke-linejoin="round" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"/></svg>', 'Profile', function () { dd.remove(); });
    ddItem('<svg width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2" style="flex-shrink:0"><path stroke-linecap="round" stroke-linejoin="round" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1"/></svg>', 'Log out', function () {
      fetch('/api/auth/logout', { credentials: 'same-origin' })
        .then(function () { _muUser = null; renderNavUser(null); dd.remove(); });
    });

    // Position relative to trigger's parent
    var parent = trigger.closest('.user-menu-login') || trigger.parentElement;
    parent.style.position = 'relative';
    parent.appendChild(dd);

    // Close on outside click
    setTimeout(function () {
      document.addEventListener('click', function closer(e) {
        if (!dd.contains(e.target) && e.target !== trigger) { dd.remove(); document.removeEventListener('click', closer); }
      });
    }, 0);
  };

  function fixLoginButtons() {
    document.querySelectorAll('.user-menu-login').forEach(function (el) {
      if (el._fixLogin) return;
      el._fixLogin = true;
      // Show placeholder buttons until auth check completes
      el.style.cssText = 'display:flex;align-items:center;gap:.5rem';
      el.innerHTML =
        '<a href="/login" style="display:inline-flex;align-items:center;padding:.4rem .875rem;border-radius:.5rem;font-size:.8125rem;font-weight:600;color:#fff;background:rgba(255,255,255,.18);border:1.5px solid rgba(255,255,255,.55);text-decoration:none" onmouseover="this.style.background=\'rgba(255,255,255,.28)\'" onmouseout="this.style.background=\'rgba(255,255,255,.18)\'">Kirish</a>' +
        '<a href="/register" style="display:inline-flex;align-items:center;padding:.4rem .875rem;border-radius:.5rem;font-size:.8125rem;font-weight:600;color:#913FE2;background:#fff;border:1.5px solid #fff;text-decoration:none" onmouseover="this.style.opacity=\'.88\'" onmouseout="this.style.opacity=\'1\'">Ro\'yxat</a>';
    });
  }

  /* ══════════════════════════════════════════════
     LATEST UPDATES — wire pagination on home page
  ══════════════════════════════════════════════ */
  function fixLatestUpdates() {
    // Find "Latest Updates" h2
    var h2 = null;
    document.querySelectorAll('h2').forEach(function (el) {
      if (el.textContent.trim() === 'Latest Updates') h2 = el;
    });
    if (!h2) return;
    var section = h2.closest('section');
    if (!section) return;

    var PERPAGE = 10;
    var _luPage = 1;
    var _luData = null;

    function timeAgo(ts) {
      if (!ts) return '';
      var diff = Math.floor(Date.now() / 1000) - ts;
      if (diff < 3600)   return Math.floor(diff / 60)    + ' min ago';
      if (diff < 86400)  return Math.floor(diff / 3600)  + ' hours ago';
      if (diff < 604800) return Math.floor(diff / 86400) + ' days ago';
      return Math.floor(diff / 604800) + ' weeks ago';
    }

    function buildItem(comic) {
      var chs = (comic.chapters || []).slice().sort(function (a, b) { return b.number - a.number; }).slice(0, 3);
      var chapHtml = chs.length > 0
        ? chs.map(function (ch) {
            return '<a href="/reader/' + comic.slug + '/' + ch.number + '" style="display:flex;align-items:center;justify-content:space-between" class="hover:text-[#913FE2] transition-colors group">' +
              '<div class="flex items-center min-w-0"><span class="flex-1 min-w-0 truncate text-[14px] text-white/50">' +
              '<span class="group-hover:text-[#913FE2] font-medium text-white/90">Chapter ' + ch.number + '</span></span></div>' +
              '<time class="text-white/60 text-[11px] whitespace-nowrap flex-shrink-0 ml-2">' + (ch.date || '') + '</time></a>';
          }).join('')
        : '<span style="font-size:.8rem;color:rgba(255,255,255,.35);font-style:italic">Hali boblar yo\'q</span>';
      return '<div class="grid grid-cols-12 gap-2 py-4 px-2 border-b border-[#312f40]">' +
        '<a href="/comics/' + comic.slug + '" class="col-span-4 sm:col-span-3 md:col-span-4 lg:col-span-3 overflow-hidden rounded-md group">' +
        '<img src="' + (comic.cover || '') + '" alt="' + comic.title + '" class="w-[90%] sm:w-full aspect-[3/4] object-cover rounded-md group-hover:opacity-60 transition-opacity" style="aspect-ratio:3/4" loading="lazy" onerror="this.style.background=\'#1D1B22\'">' +
        '</a><div class="col-span-8 sm:col-span-9 md:col-span-8 lg:col-span-9 flex flex-col min-w-0">' +
        '<a href="/comics/' + comic.slug + '" class="font-bold text-base line-clamp-1 hover:text-[#913FE2] transition-colors mb-2">' + comic.title + '</a>' +
        '<div class="flex flex-col gap-1.5 sm:pl-2">' + chapHtml + '</div></div></div>';
    }

    function renderLUPagination(cur, total) {
      var wrap = section.querySelector('[id="lu-pagination"]');
      if (!wrap) return;
      function btn(n, label, active, disabled) {
        var st = 'display:inline-flex;align-items:center;justify-content:center;width:2rem;height:2rem;border-radius:.375rem;font-size:.8125rem;font-weight:700;cursor:pointer;border:none;transition:background .15s;';
        st += disabled ? 'background:rgba(255,255,255,.1);color:rgba(255,255,255,.25);cursor:default;pointer-events:none'
                       : active ? 'background:#913FE2;color:#fff' : 'background:rgba(255,255,255,.1);color:#fff';
        var cl = disabled ? '' : 'onclick="window.__luGoPage(' + n + ')"';
        return '<button ' + cl + ' style="' + st + '">' + (label || n) + '</button>';
      }
      var h = '<div style="display:flex;align-items:center;gap:.375rem;flex-wrap:wrap;justify-content:center">';
      h += btn(cur - 1, '‹', false, cur <= 1);
      var pages = [];
      if (total <= 7) { for (var i = 1; i <= total; i++) pages.push(i); }
      else {
        pages = [1];
        if (cur > 3) pages.push('…');
        for (var j = Math.max(2, cur - 1); j <= Math.min(total - 1, cur + 1); j++) pages.push(j);
        if (cur < total - 2) pages.push('…');
        pages.push(total);
      }
      pages.forEach(function (p) {
        h += p === '…' ? '<span style="color:rgba(255,255,255,.3);padding:0 .25rem">…</span>' : btn(p, null, p === cur, false);
      });
      h += btn(cur + 1, '›', false, cur >= total);
      h += '</div>';
      wrap.innerHTML = h;
    }

    function renderLU(page) {
      _luPage = page;
      if (!_luData) return;
      var slice = _luData.slice((page - 1) * PERPAGE, page * PERPAGE);
      var itemsWrap = section.querySelector('[id="lu-items"]');
      if (itemsWrap) itemsWrap.innerHTML = slice.map(buildItem).join('');
      renderLUPagination(page, Math.ceil(_luData.length / PERPAGE));
    }

    window.__luGoPage = function (n) {
      renderLU(n);
      section.scrollIntoView({ behavior: 'smooth', block: 'start' });
    };

    // Replace static SSR content with dynamic structure
    (function loadLU() {
      var data = _browseComics || [];
      var withCh    = data.filter(function (c) { return c.chapters && c.chapters.length > 0; })
                          .sort(function (a, b) { return (b.latestTs || 0) - (a.latestTs || 0); });
      var withoutCh = data.filter(function (c) { return !c.chapters || c.chapters.length === 0; });
      _luData = withCh.concat(withoutCh);

      // Existing items are direct children of the outer 2-col grid container.
      // We reuse that container as #lu-items so its grid CSS still applies.
      var existingItems = section.querySelectorAll('.grid.grid-cols-12');
      var itemsWrap;
      if (existingItems.length > 0) {
        var parent = existingItems[0].parentElement;
        // Make sure this parent is actually a multi-col grid container, not a single cell
        // Walk up until we find a container that's a direct child of section or is >50% of section width
        if (parent && parent.parentElement === section) {
          itemsWrap = parent;
        } else if (parent && parent.parentElement && parent.parentElement.parentElement === section) {
          itemsWrap = parent.parentElement;
        } else {
          itemsWrap = parent || section;
        }
        existingItems.forEach(function (el) { el.remove(); });
      } else {
        itemsWrap = document.createElement('div');
        section.appendChild(itemsWrap);
      }
      itemsWrap.id = 'lu-items';
      // Responsive grid: 1-column mobile, 2-column tablet+
      function setLUGrid() {
        var cols = window.innerWidth >= 640 ? 'repeat(2,minmax(0,1fr))' : '1fr';
        itemsWrap.style.cssText = 'display:grid;grid-template-columns:' + cols + ';width:100%;box-sizing:border-box;padding:0 1rem';
      }
      setLUGrid();
      window.addEventListener('resize', setLUGrid);

      // Pagination wrapper — insert AFTER the grid, not inside it
      var paginationWrap = document.getElementById('lu-pagination');
      if (!paginationWrap) {
        paginationWrap = document.createElement('div');
        paginationWrap.id = 'lu-pagination';
        paginationWrap.style.cssText = 'display:flex;align-items:center;justify-content:center;margin-top:1rem;padding:0 1rem';
        itemsWrap.parentElement ? itemsWrap.parentElement.insertBefore(paginationWrap, itemsWrap.nextSibling)
                                : section.appendChild(paginationWrap);
      }

      // Remove old static pagination
      var existingPagDiv = section.querySelector('.flex.items-center.justify-center.mt-4');
      if (existingPagDiv && existingPagDiv.id !== 'lu-pagination') existingPagDiv.remove();

      renderLU(1);
    })();
  }

  /* ══════════════════════════════════════════════
     PAGE DETECTION HELPERS
  ══════════════════════════════════════════════ */
  function isBookmarksPage()  { return location.pathname === '/bookmarks'; }
  function isComicDetailPage(){ return /^\/comics\/[^/]+$/.test(location.pathname); }

  /* ══════════════════════════════════════════════
     BOOKMARKS PAGE — server-side API
  ══════════════════════════════════════════════ */
  function initBookmarksPage() {
    var loading = document.getElementById('bm-loading');
    var loginEl = document.getElementById('bm-login-notice');
    var emptyEl = document.getElementById('bm-empty');
    var grid    = document.getElementById('bm-grid');
    if (!grid) return;

    function showState(st) {
      if (loading) loading.style.display = st === 'loading' ? '' : 'none';
      if (loginEl) loginEl.style.display = st === 'login'   ? '' : 'none';
      if (emptyEl) emptyEl.style.display = st === 'empty'   ? '' : 'none';
      if (grid)    grid.style.display    = st === 'grid'    ? '' : 'none';
    }
    showState('loading');

    fetch('/api/auth/me', { credentials: 'same-origin' })
      .then(function (r) { return r.json(); })
      .then(function (d) {
        if (!d.user) { showState('login'); return; }
        return fetch('/api/bookmarks', { credentials: 'same-origin' })
          .then(function (r) { return r.json(); })
          .then(function (res) {
            var bm = res.data || [];
            if (!bm.length) { showState('empty'); return; }
            showState('grid');
            renderBookmarks(bm);
          });
      })
      .catch(function () { showState('empty'); });

    function renderBookmarks(items) {
      grid.innerHTML = '';
      items.forEach(function (b) {
        var status = { Ongoing: 'Davom etmoqda', Completed: 'Tugallangan', Hiatus: "To'xtatilgan" }[b.status] || b.status || '';

        var wrap = document.createElement('div');
        wrap.className = 'bm-card';
        wrap.style.position = 'relative';

        var link = document.createElement('a');
        link.href = '/comics/' + escHtml(b.slug);
        link.style.cssText = 'display:block;text-decoration:none;color:inherit';

        var img = document.createElement('img');
        img.src = escHtml(b.cover || '');
        img.alt = '';
        img.loading = 'lazy';
        img.style.cssText = 'width:100%;aspect-ratio:3/4;object-fit:cover;background:#1D1B22;display:block';
        img.onerror = function () { this.style.background = '#1D1B22'; };

        var body = document.createElement('div');
        body.style.cssText = 'padding:.6rem .75rem .75rem';

        var titleEl = document.createElement('div');
        titleEl.style.cssText = 'font-size:.8125rem;font-weight:600;overflow:hidden;white-space:nowrap;text-overflow:ellipsis';
        titleEl.textContent = b.title || '';

        var metaEl = document.createElement('div');
        metaEl.style.cssText = 'font-size:.72rem;color:rgba(255,255,255,.4);margin-top:.2rem';
        metaEl.textContent = status;

        body.appendChild(titleEl);
        body.appendChild(metaEl);
        link.appendChild(img);
        link.appendChild(body);

        var delBtn = document.createElement('button');
        delBtn.textContent = "O'chirish";
        delBtn.style.cssText = 'display:block;width:calc(100% - 1.5rem);margin:.1rem .75rem .75rem;padding:.3rem 0;background:rgba(255,50,50,.15);color:rgba(255,100,100,.9);border:none;border-radius:.375rem;font-size:.75rem;cursor:pointer;transition:background .15s';
        delBtn.onmouseover = function () { this.style.background = 'rgba(255,50,50,.3)'; };
        delBtn.onmouseout  = function () { this.style.background = 'rgba(255,50,50,.15)'; };
        (function (slug, card, btn) {
          btn.addEventListener('click', function () {
            btn.disabled = true; btn.textContent = '…';
            fetch('/api/bookmarks/' + encodeURIComponent(slug), { method: 'DELETE', credentials: 'same-origin' })
              .then(function () {
                card.style.transition = 'opacity .25s';
                card.style.opacity = '0';
                setTimeout(function () {
                  card.remove();
                  if (!grid.children.length) showState('empty');
                }, 260);
              })
              .catch(function () { btn.disabled = false; btn.textContent = "O'chirish"; });
          });
        }(b.slug, wrap, delBtn));

        wrap.appendChild(link);
        wrap.appendChild(delBtn);
        grid.appendChild(wrap);
      });
    }
  }

  /* ══════════════════════════════════════════════
     REACTIONS — emoji reaksiyalar
  ══════════════════════════════════════════════ */
  function initReactions() {
    var section = document.getElementById('mu-reactions');
    if (!section) return;
    var slug    = section.dataset.slug || location.pathname.replace(/^\/comics\//, '').replace(/\/$/, '');
    var stKey   = 'mu-react-' + slug;
    var countKey= 'mu-react-counts-' + slug;
    var myVote  = localStorage.getItem(stKey) || '';
    var counts  = JSON.parse(localStorage.getItem(countKey) || '{}');

    var totalEl = document.getElementById('mu-reactions-total');
    var btns    = section.querySelectorAll('.mu-reaction-btn');

    function totalCount() {
      return Object.values(counts).reduce(function (s, n) { return s + n; }, 0);
    }
    function refresh() {
      btns.forEach(function (btn) {
        var label   = btn.dataset.reaction;
        var cnt     = counts[label] || 0;
        var active  = myVote === label;
        btn.querySelector('.mu-reaction-count').textContent = cnt;
        btn.style.background = active ? 'rgba(145,63,226,.2)' : '';
        btn.style.outline    = active ? '2px solid #913FE2' : '';
      });
      if (totalEl) {
        var t = totalCount();
        totalEl.textContent = t + ' ta reaksiya';
      }
    }

    refresh();

    btns.forEach(function (btn) {
      btn.addEventListener('click', function () {
        var label = btn.dataset.reaction;
        if (myVote === label) {
          // toggle off
          counts[label] = Math.max(0, (counts[label] || 1) - 1);
          myVote = '';
        } else {
          if (myVote && counts[myVote]) counts[myVote] = Math.max(0, counts[myVote] - 1);
          counts[label] = (counts[label] || 0) + 1;
          myVote = label;
        }
        localStorage.setItem(stKey, myVote);
        localStorage.setItem(countKey, JSON.stringify(counts));
        refresh();
      });
    });
  }

  /* ══════════════════════════════════════════════
     COMMENTS — komik sahifaga izohlar bo'limi
  ══════════════════════════════════════════════ */
  function escHtml(s) {
    return String(s || '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
  }

  function initCommentsSection() {
    if (!isComicDetailPage()) return;
    var slug = location.pathname.replace(/^\/comics\//, '').replace(/\/$/, '');
    if (!slug) return;

    // Izoh bo'limini joylashtiramiz — anchor div ni almashtirish, yo'q bo'lsa article ga qo'shamiz
    var anchor  = document.getElementById('mu-comments-anchor');
    var article = document.querySelector('article') || document.querySelector('main');
    if (!anchor && !article) return;

    var section = document.createElement('section');
    section.id  = 'mu-comments';
    section.style.cssText = 'padding:1.5rem;background:#1C1924;border-radius:1rem';
    section.innerHTML =
      '<h2 style="font-size:1.1rem;font-weight:700;margin:0 0 1rem">Izohlar</h2>' +
      '<div id="cm-form" style="margin-bottom:1.25rem;display:none">' +
        '<textarea id="cm-input" placeholder="Izoh yozing…" rows="3" style="width:100%;box-sizing:border-box;background:#13111A;color:#fff;border:1.5px solid rgba(255,255,255,.12);border-radius:.625rem;padding:.65rem .875rem;font-size:.875rem;resize:vertical;outline:none;transition:border-color .15s" onfocus="this.style.borderColor=\'#913FE2\'" onblur="this.style.borderColor=\'rgba(255,255,255,.12)\'"></textarea>' +
        '<button id="cm-submit" style="margin-top:.5rem;padding:.5rem 1.25rem;background:#913FE2;color:#fff;border:none;border-radius:.5rem;font-weight:600;font-size:.875rem;cursor:pointer;transition:background .15s" onmouseover="this.style.background=\'#7c35c2\'" onmouseout="this.style.background=\'#913FE2\'">Yuborish</button>' +
      '</div>' +
      '<div id="cm-login-note" style="display:none;font-size:.85rem;color:rgba(255,255,255,.4);margin-bottom:1rem">' +
        'Izoh qoldirish uchun <a href="/login" style="color:#913FE2">kiring</a>.' +
      '</div>' +
      '<div id="cm-list"></div>';
    if (anchor) {
      anchor.parentNode.replaceChild(section, anchor);
    } else {
      article.appendChild(section);
    }

    var list    = document.getElementById('cm-list');
    var form    = document.getElementById('cm-form');
    var loginN  = document.getElementById('cm-login-note');
    var input   = document.getElementById('cm-input');
    var submit  = document.getElementById('cm-submit');

    // Foydalanuvchi tekshirish
    fetch('/api/auth/me', { credentials: 'same-origin' })
      .then(function (r) { return r.json(); })
      .then(function (d) {
        if (d.user) { form.style.display = ''; }
        else        { loginN.style.display = ''; }
      });

    // Izohlarni yuklash
    function loadComments() {
      list.innerHTML = '<div style="color:rgba(255,255,255,.3);font-size:.85rem">Yuklanmoqda…</div>';
      fetch('/api/comments/' + slug)
        .then(function (r) { return r.json(); })
        .then(function (res) {
          var comments = res.data || [];
          if (!comments.length) {
            list.innerHTML = '<div style="color:rgba(255,255,255,.3);font-size:.85rem;padding:.5rem 0">Hali izoh yo\'q. Birinchi bo\'ling!</div>';
            return;
          }
          list.innerHTML = '';
          comments.forEach(function (c) {
            var initials = (c.username || 'U').slice(0, 2).toUpperCase();
            var isMine   = !!(_muUser && _muUser.id === c.userId);

            var row = document.createElement('div');
            row.style.cssText = 'display:flex;gap:.75rem;padding:.75rem 0;border-bottom:1px solid rgba(255,255,255,.06)';
            row.dataset.cmid = c.id;

            var avatar = document.createElement('div');
            avatar.style.cssText = 'width:2.25rem;height:2.25rem;border-radius:50%;background:linear-gradient(135deg,#913FE2,#7B2FD1);display:flex;align-items:center;justify-content:center;font-weight:700;font-size:.75rem;color:#fff;flex-shrink:0';
            avatar.textContent = initials;

            var body = document.createElement('div');
            body.style.cssText = 'flex:1;min-width:0';

            var meta = document.createElement('div');
            meta.style.cssText = 'display:flex;align-items:center;gap:.5rem;margin-bottom:.25rem';

            var uname = document.createElement('span');
            uname.style.cssText = 'font-size:.85rem;font-weight:600';
            uname.textContent = c.username || '';

            var date = document.createElement('span');
            date.style.cssText = 'font-size:.75rem;color:rgba(255,255,255,.3)';
            date.textContent = (c.createdAt || '').slice(0, 10);

            meta.appendChild(uname);
            meta.appendChild(date);

            if (isMine) {
              var delbtn = document.createElement('button');
              delbtn.textContent = "O'chirish";
              delbtn.style.cssText = 'margin-left:auto;font-size:.72rem;color:rgba(255,80,80,.7);background:none;border:none;cursor:pointer;padding:.1rem .4rem';
              (function (id, el) {
                delbtn.addEventListener('click', function () {
                  if (!confirm("Bu izohni o'chirasizmi?")) return;
                  delbtn.disabled = true;
                  fetch('/api/comments/' + encodeURIComponent(slug) + '/' + encodeURIComponent(id),
                    { method: 'DELETE', credentials: 'same-origin' })
                    .then(function () { loadComments(); })
                    .catch(function () { delbtn.disabled = false; });
                });
              }(c.id, delbtn));
              meta.appendChild(delbtn);
            }

            var txt = document.createElement('p');
            txt.style.cssText = 'font-size:.875rem;color:rgba(255,255,255,.8);margin:0;line-height:1.5;word-break:break-word';
            txt.textContent = c.text || '';

            body.appendChild(meta);
            body.appendChild(txt);
            row.appendChild(avatar);
            row.appendChild(body);
            list.appendChild(row);
          });
        })
        .catch(function () { list.innerHTML = '<div style="color:rgba(255,50,50,.6);font-size:.85rem">Izohlarni yuklashda xatolik</div>'; });
    }
    loadComments();

    submit.addEventListener('click', function () {
      var text = (input.value || '').trim();
      if (!text) return;
      submit.disabled = true; submit.textContent = '…';
      fetch('/api/comments/' + slug, {
        method: 'POST',
        credentials: 'same-origin',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: text }),
      })
      .then(function (r) { return r.json(); })
      .then(function (res) {
        if (res.ok) { input.value = ''; loadComments(); }
        else alert(res.error || 'Xatolik');
        submit.disabled = false; submit.textContent = 'Yuborish';
      })
      .catch(function () { submit.disabled = false; submit.textContent = 'Yuborish'; });
    });

  }

  /* ══════════════════════════════════════════════
     BOOKMARK TOGGLE — komik sahifadagi tugma
  ══════════════════════════════════════════════ */
  function initBookmarkToggle() {
    if (!isComicDetailPage()) return;
    var slug = location.pathname.replace(/^\/comics\//, '').replace(/\/$/, '');
    if (!slug) return;

    // "Add to Bookmarks" yoki shunga o'xshash tugmani topamiz
    var bmBtn = null;
    document.querySelectorAll('button, a').forEach(function (el) {
      var t = (el.textContent || '').toLowerCase();
      if ((t.includes('bookmark') || t.includes('saqlash') || t.includes('add to list')) && !bmBtn) bmBtn = el;
    });

    // Tugma topilmasa — o'zimiz qo'shamiz
    if (!bmBtn) {
      var article = document.querySelector('article') || document.querySelector('main');
      if (!article) return;
      bmBtn = document.createElement('button');
      bmBtn.id = 'mu-bm-btn';
      bmBtn.style.cssText = 'display:inline-flex;align-items:center;gap:.5rem;padding:.55rem 1.1rem;border-radius:.5rem;font-size:.85rem;font-weight:600;cursor:pointer;border:1.5px solid rgba(255,255,255,.2);background:transparent;color:rgba(255,255,255,.8);transition:all .15s;margin-top:1rem';
      bmBtn.innerHTML = '<svg width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M17 21l-5-3-5 3V5a2 2 0 0 1 2-2h6a2 2 0 0 1 2 2z"/></svg><span>Saqlash</span>';
      var insertTarget = article.querySelector('h1');
      if (insertTarget && insertTarget.parentElement) {
        insertTarget.parentElement.insertBefore(bmBtn, insertTarget.nextSibling);
      } else {
        article.prepend(bmBtn);
      }
    }

    if (!bmBtn || bmBtn._muBm) return;
    bmBtn._muBm = true;

    var saved = false;
    function setActive(v) {
      saved = v;
      bmBtn.style.background   = v ? '#913FE2' : 'transparent';
      bmBtn.style.borderColor  = v ? '#913FE2' : 'rgba(255,255,255,.2)';
      bmBtn.style.color        = v ? '#fff' : 'rgba(255,255,255,.8)';
      var sp = bmBtn.querySelector('span');
      if (sp) sp.textContent = v ? 'Saqlangan' : 'Saqlash';
    }

    // Hozirgi holat
    fetch('/api/auth/me', { credentials: 'same-origin' })
      .then(function (r) { return r.json(); })
      .then(function (d) {
        if (!d.user) return;
        return fetch('/api/bookmarks', { credentials: 'same-origin' })
          .then(function (r) { return r.json(); })
          .then(function (res) {
            var already = (res.data || []).some(function (b) { return b.slug === slug; });
            setActive(already);
          });
      });

    bmBtn.addEventListener('click', function () {
      if (!_muUser) { location.href = '/login'; return; }
      if (saved) {
        fetch('/api/bookmarks/' + slug, { method: 'DELETE', credentials: 'same-origin' })
          .then(function () { setActive(false); });
      } else {
        fetch('/api/bookmarks', {
          method: 'POST', credentials: 'same-origin',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ slug: slug }),
        }).then(function () { setActive(true); });
      }
    });
  }

  /* ══════════════════════════════════════════════
     SERVICE WORKER REGISTRATION
  ══════════════════════════════════════════════ */
  function registerServiceWorker() {
    if (!('serviceWorker' in navigator)) return;
    navigator.serviceWorker.register('/sw.js', { scope: '/' })
      .catch(function (e) { /* silent — sw optional */ });
  }

  /* ══════════════════════════════════════════════
     MOBILE NAV — Ranking + Bookmarks qo'shish
  ══════════════════════════════════════════════ */
  function addNavLinks() {
    // Mavjud drawer nav ga Ranking va Bookmarks qo'shamiz
    var drawer = document.querySelector('[id="mu-mobile-drawer"]');
    // Drawer hali yo'q bo'lsa ham keyingi renderda MutationObserver ushlab oladi
    document.querySelectorAll('a[href="/browse"]').forEach(function (a) {
      var parent = a.parentElement;
      if (!parent || parent._muNavExtra) return;
      parent._muNavExtra = true;

      [{ n: 'Reyting', h: '/ranking' }, { n: 'Saqlanganlar', h: '/bookmarks' }].forEach(function (l) {
        var link = document.createElement('a');
        link.href = l.h;
        // Match existing nav link classes exactly
        link.className = a.className || '';
        link.style.cssText = 'display:flex;align-items:center;justify-content:center;padding:.5rem .75rem;border-radius:.375rem;transition:background .15s;text-decoration:none;color:rgba(255,255,255,.9);font-size:.875rem;white-space:nowrap';
        link.innerHTML = '<div>' + l.n + '</div>';
        link.onmouseover = function () { this.style.background = 'rgba(0,0,0,.25)'; };
        link.onmouseout  = function () { this.style.background = ''; };
        parent.insertBefore(link, a.nextSibling);
      });
    });
  }

  /* ══════════════════════════════════════════════
     IMAGE ERRORS
  ══════════════════════════════════════════════ */
  function fixImages() {
    document.querySelectorAll('img').forEach(function (img) {
      img.addEventListener('error', function () {
        this.style.background = '#1D1B22';
        this.style.minHeight  = '40px';
      });
    });
  }

  /* ══════════════════════════════════════════════
     INIT
  ══════════════════════════════════════════════ */
  function init() {
    fixLinks();
    fixLoginButtons();
    fixResourcesDropdown();
    fixMobileNav();
    fixHeroCarousel();
    fixTrendingCarousel();
    fixAnnouncementsCarousel();
    fixPopularTabs();
    fixImages();
    addNavLinks();
    registerServiceWorker();

    // Sahifaga qarab funksiyalar
    if (isBrowsePage()) {
      initBrowsePage();
    } else if (isBookmarksPage()) {
      initBookmarksPage();
    } else {
      // Wire search on non-browse pages
      document.querySelectorAll('input[placeholder*="Search"]').forEach(wireSearch);
      document.querySelectorAll('input[placeholder="Search..."]').forEach(wireSearchDropdown);
      fetch('/api/comics.json')
        .then(function (r) { return r.json(); })
        .then(function (data) { _browseComics = data; fixLatestUpdates(); });
    }

    initReactions();

    // Check auth state — then init features requiring user
    checkAuth(function (user) {
      renderNavUser(user);
      if (typeof window.muSyncDrawerAuth === 'function') window.muSyncDrawerAuth(user);
      initBookmarkToggle();
      initCommentsSection();
    });

    // Watch for dynamic DOM changes
    new MutationObserver(function (muts) {
      var added = muts.some(function (m) { return m.addedNodes.length > 0; });
      if (added) {
        fixLinks();
        fixLoginButtons();
        document.querySelectorAll('input[placeholder*="Search"]').forEach(wireSearch);
      }
    }).observe(document.body, { childList: true, subtree: true });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
