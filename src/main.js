import './style.css';
import { watchAuth, logOut, listenLicense } from './firebase.js';
import { showAuthScreen, hideAuthScreen } from './auth.js';
import { initApp, teardownApp } from './app.js';
import { showPendingScreen, hidePendingScreen } from './license.js';
import { initTheme } from './theme.js';

// Paused: turn back on once firestore.rules (license gate) is published
// in the Firebase Console and the first admin account is licensed.
const LICENSE_GATE_ENABLED = false;

initTheme();

document.getElementById('logoutBtn').addEventListener('click', () => {
  teardownApp();
  logOut();
});

let unsubLicense = null;
let appInitialized = false;

watchAuth(user => {
  if (unsubLicense) { unsubLicense(); unsubLicense = null; }

  if (user) {
    hideAuthScreen();
    document.getElementById('pending-root').style.display = 'none';

    if (!LICENSE_GATE_ENABLED) {
      if (!appInitialized) {
        initApp(user);
        appInitialized = true;
      }
      return;
    }

    unsubLicense = listenLicense(user.email, (licensed) => {
      if (licensed) {
        hidePendingScreen();
        if (!appInitialized) {
          initApp(user);
          appInitialized = true;
        }
      } else {
        if (appInitialized) {
          teardownApp();
          appInitialized = false;
        }
        showPendingScreen(user);
      }
    });
  } else {
    teardownApp();
    appInitialized = false;
    showAuthScreen();
  }
});
