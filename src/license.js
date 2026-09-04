import { logOut } from './firebase.js';

function esc(s) {
  return (s === undefined || s === null) ? '' : String(s).replace(/</g, '&lt;');
}

export function showPendingScreen(user) {
  document.getElementById('auth-root').style.display = 'none';
  document.getElementById('app-root').style.display = 'none';
  const root = document.getElementById('pending-root');
  root.style.display = 'block';
  root.innerHTML = `
    <div class="auth-shell">
      <div class="auth-card">
        <div class="auth-card-brand">
          <div class="brand-mark"><svg viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" width="22" height="22"><rect x="1" y="7" width="14" height="9"/><path d="M15 11h4l3 3v2h-7"/><circle cx="6" cy="18" r="2"/><circle cx="18" cy="18" r="2"/></svg></div>
          <div><div class="name">TruckManager</div><div class="tag">Fleet &amp; Cross-Border Ops</div></div>
        </div>
        <h2>Account pending activation</h2>
        <div class="auth-sub">Your account is created, but not activated yet.</div>
        <div class="auth-info">Signed in as <b>${esc(user.email)}</b>. Contact us to activate your TruckManager subscription — this page will unlock automatically as soon as it's activated, no need to log in again.</div>
        <button class="btn btn-ghost auth-submit" id="pendingLogout">Log Out</button>
      </div>
    </div>`;
  document.getElementById('pendingLogout').addEventListener('click', () => logOut());
}

export function hidePendingScreen() {
  const root = document.getElementById('pending-root');
  root.style.display = 'none';
  root.innerHTML = '';
}
