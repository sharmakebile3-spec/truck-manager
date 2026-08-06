import { signUp, logIn, friendlyAuthError } from './firebase.js';

const authState = { mode: 'login', error: '', busy: false };

export function renderAuthScreen() {
  const root = document.getElementById('auth-root');
  const isLogin = authState.mode === 'login';
  root.innerHTML = `
    <div class="auth-shell">
      <div class="auth-visual">
        <div class="auth-visual-inner">
          <div class="brand-mark">TM</div>
          <h1>Run your fleet with total visibility.</h1>
          <p class="lede">TruckManager keeps every truck, trip, and invoice in one place — synced live across your team.</p>
          <div class="auth-feature-list">
            <div class="auth-feature">
              <div class="dot">&#10003;</div>
              <div class="txt"><b>Live fleet &amp; trip tracking</b><span>See truck status and border checkpoints update in real time.</span></div>
            </div>
            <div class="auth-feature">
              <div class="dot">&#10003;</div>
              <div class="txt"><b>Expenses &amp; profit per trip</b><span>Log fuel and dispatch costs, see net profit instantly.</span></div>
            </div>
            <div class="auth-feature">
              <div class="dot">&#10003;</div>
              <div class="txt"><b>Payments &amp; invoices</b><span>Track what's collected and print client invoices in one click.</span></div>
            </div>
          </div>
        </div>
      </div>
      <div class="auth-form-side">
      <div class="auth-card">
        <div class="auth-card-brand">
          <div class="brand-mark">TM</div>
          <div><div class="name">TruckManager</div><div class="tag">Fleet &amp; Cross-Border Ops</div></div>
        </div>
        <h2>${isLogin ? 'Welcome back' : 'Create your account'}</h2>
        <div class="auth-sub">${isLogin ? 'Sign in with your username and password.' : 'Choose a username and password to get started.'}</div>
        ${authState.error ? `<div class="auth-error">${authState.error}</div>` : ''}
        <form id="authForm">
          <div class="auth-field">
            <label>Username</label>
            <input id="authUsername" autocomplete="username" placeholder="e.g. opsmanager" required>
          </div>
          <div class="auth-field">
            <label>Password</label>
            <input id="authPassword" type="password" autocomplete="${isLogin ? 'current-password' : 'new-password'}" placeholder="At least 6 characters" required>
          </div>
          <button class="btn btn-primary auth-submit" type="submit" ${authState.busy ? 'disabled' : ''}>
            ${authState.busy ? 'Please wait…' : (isLogin ? 'Log In' : 'Sign Up')}
          </button>
        </form>
        <div class="auth-switch">
          ${isLogin
            ? `Don't have an account? <button id="authSwitch">Sign Up</button>`
            : `Already have an account? <button id="authSwitch">Log In</button>`}
        </div>
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
