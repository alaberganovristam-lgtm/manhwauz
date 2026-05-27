'use strict';

/* ── Flash auto-hide ─────────────────────── */
(function(){
  var f = document.querySelector('.flash');
  if(f) setTimeout(function(){ f.style.opacity='0'; f.style.transition='opacity .4s'; setTimeout(function(){f.remove()},400); }, 4000);
})();

/* ── Confirm dialog ──────────────────────── */
window.confirmDelete = function(msg, form){
  if(confirm(msg || "O'chirishni tasdiqlaysizmi?")) form.submit();
};

/* ── CSRF token helper ───────────────────── */
window.CSRF = document.querySelector('meta[name=csrf]')?.content || '';

/* ── Generic fetch helper ────────────────── */
window.apiFetch = function(url, opts){
  opts = opts || {};
  opts.headers = opts.headers || {};
  opts.headers['X-CSRF-Token'] = window.CSRF;
  opts.credentials = 'same-origin';
  return fetch(url, opts);
};

/* ── Sidebar toggle (mobile) ─────────────── */
document.addEventListener('click', function(e){
  var sb = document.getElementById('sidebar');
  if(!sb) return;
  if(sb.classList.contains('open') && !sb.contains(e.target)){
    sb.classList.remove('open');
  }
});
