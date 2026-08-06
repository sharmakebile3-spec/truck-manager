const STORAGE_KEY = 'tm-theme';

export function getTheme() {
  return localStorage.getItem(STORAGE_KEY) === 'dark' ? 'dark' : 'light';
}

export function applyTheme(theme) {
  document.documentElement.setAttribute('data-theme', theme === 'dark' ? 'dark' : 'light');
  localStorage.setItem(STORAGE_KEY, theme === 'dark' ? 'dark' : 'light');
}

export function initTheme() {
  applyTheme(getTheme());
}
