import { signUp, logIn, resetPassword, signInWithGoogle, friendlyAuthError } from './firebase.js';

const GOOGLE_ICON = `<svg width="18" height="18" viewBox="0 0 48 48"><path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3c-1.6 4.7-6.1 8-11.3 8-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.9 1.1 8 3.1l5.7-5.7C34.5 6.1 29.5 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.7-.4-3.5z"/><path fill="#FF3D00" d="M6.3 14.7l6.6 4.8C14.6 15.9 18.9 13 24 13c3.1 0 5.9 1.1 8 3.1l5.7-5.7C34.5 6.1 29.5 4 24 4 16.3 4 9.7 8.3 6.3 14.7z"/><path fill="#4CAF50" d="M24 44c5.4 0 10.3-2.1 14-5.5l-6.5-5.5c-2 1.5-4.6 2.5-7.5 2.5-5.2 0-9.6-3.3-11.3-7.9l-6.5 5C9.6 39.6 16.3 44 24 44z"/><path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-.8 2.3-2.2 4.2-4.1 5.6l6.5 5.5C39.9 36.9 44 31 44 24c0-1.3-.1-2.7-.4-3.5z"/></svg>`;

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
        ${!isReset ? `
        <button type="button" class="btn btn-google" id="authGoogle" ${authState.busy ? 'disabled' : ''}>
          ${GOOGLE_ICON} Continue with Google
        </button>
        <div class="auth-divider"><span>or</span></div>` : ''}
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
  const googleBtn = document.getElementById('authGoogle');
  if (googleBtn) {
    googleBtn.addEventListener('click', onGoogleSignIn);
  }
}

async function onGoogleSignIn() {
  authState.busy = true;
  authState.error = '';
  authState.info = '';
  renderAuthScreen();
  try {
    await signInWithGoogle();
    // onAuthStateChanged in main.js takes over from here.
  } catch (err) {
    authState.busy = false;
    authState.error = friendlyAuthError(err);
    renderAuthScreen();
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
