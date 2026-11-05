// A language change keeps the current activity link and section, including app mode.
(() => {
  const current = new URL(location.href);
  const other = document.documentElement.lang === 'fr' ? '/index-en.html' : '/index.html';
  for (const link of document.querySelectorAll('[data-lang-switch]')) {
    link.href = other + current.search + current.hash;
    link.addEventListener('click', () => {
      link.href = other + location.search + location.hash;
      try { sessionStorage.setItem('beyboo-language-selection', JSON.stringify(selection)); } catch {}
    });
  }
  if (current.searchParams.get('app') === '1' && current.searchParams.get('install') === '1') {
    document.querySelector('.beyboo-app-header [data-app-dialog="install"]')?.click();
  }
})();
