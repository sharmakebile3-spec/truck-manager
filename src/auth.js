import { signUp, logIn, friendlyAuthError } from './firebase.js';

const authState = { mode: 'login', error: '', busy: false };

export function renderAuthScreen() {
  const root = document.getElementById('auth-root');
  const isLogin = authState.mode === 'login';
  root.innerHTML = `
    <div class="auth-shell">
      <div class="auth-card">
        <div class="auth-brand">
          <div class="brand-mark">TM</div>
          <div><div class="name">TruckManager</div><div class="tag">Fleet &amp; Cross-Border Ops</div></div>
        </div>
        <h2>${isLogin ? 'Ku soo gal akoonkaaga' : 'Samayso akoon cusub'}</h2>
        <div class="auth-sub">${isLogin ? 'Geli username-kaaga iyo password-kaaga.' : 'Username iyo password samee si aad u bilowdo.'}</div>
        ${authState.error ? `<div class="auth-error">${authState.error}</div>` : ''}
        <form id="authForm">
          <div class="auth-field">
            <label>Username</label>
            <input id="authUsername" autocomplete="username" placeholder="tusaale: opsmanager" required>
          </div>
          <div class="auth-field">
            <label>Password</label>
            <input id="authPassword" type="password" autocomplete="${isLogin ? 'current-password' : 'new-password'}" placeholder="ugu yaraan 6 xaraf" required>
          </div>
          <button class="btn btn-primary auth-submit" type="submit" ${authState.busy ? 'disabled' : ''}>
            ${authState.busy ? 'Fadlan sug…' : (isLogin ? 'Log In' : 'Sign Up')}
          </button>
        </form>
        <div class="auth-switch">
          ${isLogin
            ? `Akoon ma lihid? <button id="authSwitch">Samayso mid</button>`
            : `Akoon ma leedahay? <button id="authSwitch">Log In</button>`}
        </div>
      </div>
    </div>`;

  document.getElementById('authForm').addEventListener('submit', onAuthSubmit);
  document.getElementById('authSwitch').addEventListener('click', () => {
    authState.mode = isLogin ? 'signup' : 'login';
    authState.error = '';
    renderAuthScreen();
  });
}

async function onAuthSubmit(evt) {
  evt.preventDefault();
  const username = document.getElementById('authUsername').value.trim();
  const password = document.getElementById('authPassword').value;
  if (!username || !password) return;

  authState.busy = true;
  authState.error = '';
  renderAuthScreen();

  try {
    if (authState.mode === 'login') {
      await logIn(username, password);
    } else {
      await signUp(username, password);
    }
    // onAuthStateChanged in main.js takes over from here.
  } catch (err) {
    authState.busy = false;
    authState.error = friendlyAuthError(err);
    renderAuthScreen();
  }
}

export function showAuthScreen() {
  document.getElementById('auth-root').style.display = 'block';
  document.getElementById('app-root').style.display = 'none';
  renderAuthScreen();
}

export function hideAuthScreen() {
  document.getElementById('auth-root').style.display = 'none';
  document.getElementById('app-root').style.display = 'flex';
}
