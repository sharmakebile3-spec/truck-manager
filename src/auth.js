import { signUp, logIn, resetPassword, friendlyAuthError } from './firebase.js';

const authState = { mode: 'login', error: '', info: '', busy: false };

export function renderAuthScreen() {
  const root = document.getElementById('auth-root');
  const mode = authState.mode;
  const isLogin = mode === 'login';
  const isReset = mode === 'reset';

  const heading = isReset ? 'Reset your password' : isLogin ? 'Welcome back' : 'Create your account';
  const sub = isReset
    ? "Enter your email and we'll send you a link to reset your password."
    : isLogin ? 'Sign in with your email and password.' : 'Sign up with your email and password.';

  root.innerHTML = `
    <div class="auth-shell">
      <div class="auth-card">
        <div class="auth-card-brand">
          <div class="brand-mark">TM</div>
          <div><div class="name">TruckManager</div><div class="tag">Fleet &amp; Cross-Border Ops</div></div>
        </div>
        <h2>${heading}</h2>
        <div class="auth-sub">${sub}</div>
        ${authState.error ? `<div class="auth-error">${authState.error}</div>` : ''}
        ${authState.info ? `<div class="auth-info">${authState.info}</div>` : ''}
        <form id="authForm">
          <div class="auth-field">
            <label>Email</label>
            <input id="authEmail" type="email" autocomplete="email" required>
          </div>
          ${!isReset ? `
          <div class="auth-field">
            <label>Password</label>
            <input id="authPassword" type="password" autocomplete="${isLogin ? 'current-password' : 'new-password'}" required>
          </div>` : ''}
          ${isLogin ? `<div class="auth-forgot"><button type="button" id="authForgot">Forgot password?</button></div>` : ''}
          <button class="btn btn-primary auth-submit" type="submit" ${authState.busy ? 'disabled' : ''}>
            ${authState.busy ? 'Please wait…' : (isReset ? 'Send Reset Link' : isLogin ? 'Log In' : 'Sign Up')}
          </button>
        </form>
        <div class="auth-switch">
          ${isReset
            ? `<button id="authSwitch">Back to Log In</button>`
            : isLogin
              ? `Don't have an account? <button id="authSwitch">Sign Up</button>`
              : `Already have an account? <button id="authSwitch">Log In</button>`}
        </div>
      </div>
    </div>`;

  document.getElementById('authForm').addEventListener('submit', onAuthSubmit);
  document.getElementById('authSwitch').addEventListener('click', () => {
    authState.mode = isReset ? 'login' : (isLogin ? 'signup' : 'login');
    authState.error = '';
    authState.info = '';
    renderAuthScreen();
  });
  const forgotBtn = document.getElementById('authForgot');
  if (forgotBtn) {
    forgotBtn.addEventListener('click', () => {
      authState.mode = 'reset';
      authState.error = '';
      authState.info = '';
      renderAuthScreen();
    });
  }
}

async function onAuthSubmit(evt) {
  evt.preventDefault();
  const email = document.getElementById('authEmail').value.trim();
  const passwordField = document.getElementById('authPassword');
  const password = passwordField ? passwordField.value : null;
  if (!email || (authState.mode !== 'reset' && !password)) return;

  authState.busy = true;
  authState.error = '';
  authState.info = '';
  renderAuthScreen();

  try {
    if (authState.mode === 'login') {
      await logIn(email, password);
      // onAuthStateChanged in main.js takes over from here.
    } else if (authState.mode === 'signup') {
      await signUp(email, password);
      // onAuthStateChanged in main.js takes over from here.
    } else {
      await resetPassword(email);
      authState.busy = false;
      authState.info = "If an account exists for that email, a reset link is on its way — check your inbox.";
      renderAuthScreen();
    }
  } catch (err) {
    authState.busy = false;
    if (authState.mode === 'reset' && err.code === 'auth/user-not-found') {
      // Don't reveal whether an account exists.
      authState.info = "If an account exists for that email, a reset link is on its way — check your inbox.";
    } else {
      authState.error = friendlyAuthError(err);
    }
    renderAuthScreen();
  }
}

export function showAuthScreen() {
  authState.mode = 'login';
  authState.error = '';
  authState.info = '';
  document.getElementById('auth-root').style.display = 'block';
  document.getElementById('app-root').style.display = 'none';
  renderAuthScreen();
}

export function hideAuthScreen() {
  document.getElementById('auth-root').style.display = 'none';
  document.getElementById('app-root').style.display = 'flex';
}
