(() => {
  let storedTheme = null;
  try { storedTheme = localStorage.getItem('fieldyield-theme'); } catch { storedTheme = null; }
  const systemTheme = typeof matchMedia === 'function' && matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  const theme = storedTheme === 'light' || storedTheme === 'dark' ? storedTheme : systemTheme;
  document.documentElement.dataset.theme = theme;
  document.documentElement.style.colorScheme = theme;
})();
