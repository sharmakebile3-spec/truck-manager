import './style.css';
import { watchAuth, logOut } from './firebase.js';
import { showAuthScreen, hideAuthScreen } from './auth.js';
import { initApp, teardownApp } from './app.js';
import { initTheme } from './theme.js';

initTheme();

document.getElementById('logoutBtn').addEventListener('click', () => {
  teardownApp();
  logOut();
});

watchAuth(user => {
  if (user) {
    hideAuthScreen();
    initApp(user);
  } else {
    teardownApp();
    showAuthScreen();
  }
});
