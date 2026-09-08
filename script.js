(() => {
  'use strict';
  const urls = window.MIENGIEH_DOWNLOAD_URLS || {};
  const status = document.querySelector('#download-status');
  document.querySelectorAll('[data-download]').forEach(control => {
    const value = urls[control.dataset.download];
    let url;
    try { url = new URL(value); } catch (_) { /* Keep the safe markup fallback. */ }
    if (url && url.protocol === 'https:') {
      if (control.tagName === 'A') control.href = url.href;
      else {
        const link = document.createElement('a');
        link.className = control.className;
        link.href = url.href;
        link.innerHTML = control.innerHTML;
        link.dataset.download = control.dataset.download;
        control.replaceWith(link);
      }
      if (control.dataset.download === 'chromeWebStore') status.textContent = '';
    } else if (control.tagName === 'BUTTON') {
      control.addEventListener('click', () => {
        status.textContent = 'Chrome Web Store listing is coming soon.';
      });
    }
  });
  const reduced = matchMedia('(prefers-reduced-motion: reduce)');
  if ('IntersectionObserver' in window) {
    const observer = new IntersectionObserver(entries => entries.forEach(entry => {
      if (entry.isIntersecting) {
        if (!reduced.matches) entry.target.classList.add('entered');
        observer.unobserve(entry.target);
      }
    }), { threshold: .12 });
    document.querySelectorAll('.reveal').forEach(el => observer.observe(el));
  }
})();
