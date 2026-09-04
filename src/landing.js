const TRUCK_ICON = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="1" y="7" width="14" height="9"/><path d="M15 11h4l3 3v2h-7"/><circle cx="6" cy="18" r="2"/><circle cx="18" cy="18" r="2"/></svg>`;
const CHECK_ICON = `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M20 6L9 17l-5-5"/></svg>`;
const WHATSAPP_ICON = `<svg width="17" height="17" viewBox="0 0 24 24" fill="currentColor"><path d="M12.04 2C6.58 2 2.13 6.45 2.13 11.91c0 1.75.46 3.39 1.26 4.81L2 22l5.42-1.42a9.87 9.87 0 004.62 1.18h.01c5.46 0 9.9-4.45 9.9-9.9C21.96 6.45 17.5 2 12.04 2zm5.8 14.02c-.25.7-1.24 1.28-1.98 1.44-.5.1-1.16.19-3.38-.72-2.83-1.17-4.66-4.05-4.8-4.24-.14-.19-1.15-1.53-1.15-2.92 0-1.39.73-2.07 1-2.35.25-.28.55-.35.73-.35h.53c.17 0 .4-.03.62.48.25.6.85 2.07.92 2.22.07.15.12.33.02.53-.1.2-.15.32-.3.5-.15.17-.31.38-.44.51-.15.15-.3.31-.13.6.17.3.77 1.27 1.65 2.06 1.13 1.02 2.09 1.33 2.38 1.48.3.15.47.13.64-.08.17-.2.72-.84.92-1.13.19-.28.39-.24.65-.14.27.1 1.7.8 1.99.95.3.15.49.22.56.35.08.14.08.79-.17 1.5z"/></svg>`;
const WHATSAPP_URL = 'https://wa.me/260979034246?text=' + encodeURIComponent("Hi, I'd like to get TruckManager set up for my company.");

const FEATURES = [
  { icon: '<rect x="3" y="3" width="7" height="9"/><rect x="14" y="3" width="7" height="5"/><rect x="14" y="12" width="7" height="9"/><rect x="3" y="16" width="7" height="5"/>',
    title: 'Live Fleet Dashboard', text: 'Open the app and see it all — which trucks are moving, which are sitting idle, and how the month is looking financially. No refreshing, no asking around.' },
  { icon: '<rect x="1" y="7" width="14" height="9"/><path d="M15 11h4l3 3v2h-7"/><circle cx="6" cy="18" r="2"/><circle cx="18" cy="18" r="2"/>',
    title: 'Fleet & Subcontractor Management', text: 'Keep your own trucks and the subcontracted ones in the same system, clearly marked apart, so nothing gets mixed up when it\'s time to invoice.' },
  { icon: '<path d="M9 5H5a2 2 0 00-2 2v12a2 2 0 002 2h12a2 2 0 002-2V7a2 2 0 00-2-2h-4"/><path d="M9 3h6v4H9z"/>',
    title: 'Cross-Border Trip Tracking', text: 'Log a truck at Chirundu, at Beitbridge, wherever it crosses — everyone on your team sees it instantly, not the next time someone calls in.' },
  { icon: '<rect x="2" y="5" width="20" height="14" rx="2"/><path d="M2 10h20"/>',
    title: 'Payments & Invoices', text: 'Every load gets its own invoice automatically. Mark what\'s paid, what\'s partial, and print something client-ready without opening Excel.' },
  { icon: '<path d="M3 3v18h18"/><path d="M7 15l4-6 4 4 5-8"/>',
    title: 'Expenses & Auto-Calculated Commission', text: 'Give it a rate per ton and the tonnage — it works out the freight rate itself. Subcontractor commission too, no calculator needed.' },
  { icon: '<circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/>',
    title: 'Real-Time, Always in Sync', text: 'Update something at the border post from your phone, and your dispatcher sees it on their laptop before you\'ve put the phone away.' }
];

function miniSidebar(active) {
  const items = ['Dashboard', 'Fleet Management', 'Trip Management', 'Payments & Invoices'];
  return `<div class="mini-sidebar">${items.map(i => `<div class="mini-nav-item ${i === active ? 'active' : ''}"><span class="dot"></span>${i}</div>`).join('')}</div>`;
}

function dashboardMockup() {
  return `
  <div class="browser-mockup reveal">
    <div class="browser-mockup-bar"><span class="dot"></span><span class="dot"></span><span class="dot"></span><div class="browser-mockup-url">truck-manger.com/dashboard</div></div>
    <div class="browser-mockup-body" style="display:flex;gap:16px;">
      ${miniSidebar('Dashboard')}
      <div class="mini-app-body">
        <div style="font-size:15px;font-weight:800;margin-bottom:2px;">Live Overview</div>
        <div style="font-size:10.5px;color:var(--ink-soft);margin-bottom:12px;">Friday, September 4, 2026</div>
        <div class="kpi-row" style="grid-template-columns:repeat(4,1fr);gap:8px;margin-bottom:14px;">
          <div class="kpi total" style="padding:10px 12px;"><div class="num" style="font-size:19px;">3</div><div class="lbl" style="font-size:9px;">Total Fleet</div></div>
          <div class="kpi blue" style="padding:10px 12px;"><div class="num" style="font-size:19px;">2</div><div class="lbl" style="font-size:9px;">On-Trip</div></div>
          <div class="kpi green" style="padding:10px 12px;"><div class="num" style="font-size:19px;">1</div><div class="lbl" style="font-size:9px;">Available</div></div>
          <div class="kpi red" style="padding:10px 12px;"><div class="num" style="font-size:19px;">0</div><div class="lbl" style="font-size:9px;">Maintenance</div></div>
        </div>
        <div class="panel" style="padding:12px;">
          <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:10px;">
            <span style="font-size:11px;font-weight:700;">BAZ 4471 · Copper Cathodes, 32t</span>
            <span class="badge blue" style="font-size:9px;padding:3px 8px;">In Transit</span>
          </div>
          <div class="route-track">
            <div class="stamp done" style="width:16px;height:16px;">&#10003;</div><div class="seg done"></div>
            <div class="stamp done" style="width:16px;height:16px;">&#10003;</div><div class="seg done"></div>
            <div class="stamp active" style="width:16px;height:16px;">&#9679;</div><div class="seg"></div>
            <div class="stamp" style="width:16px;height:16px;"></div>
          </div>
          <div class="route-labels" style="margin-top:4px;">
            <span style="font-size:8px;">Ndola</span><span style="font-size:8px;">Chirundu</span><span style="font-size:8px;">Harare</span><span style="font-size:8px;">Joburg</span>
          </div>
        </div>
      </div>
    </div>
  </div>`;
}

function tripMockup() {
  return `
  <div class="browser-mockup reveal">
    <div class="browser-mockup-bar"><span class="dot"></span><span class="dot"></span><span class="dot"></span><div class="browser-mockup-url">truck-manger.com/trips</div></div>
    <div class="browser-mockup-body">
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:10px;">
        <div><span class="trip-id" style="font-size:10px;">TRP-2026-0003</span> · <b style="font-size:11.5px;">BAZ 4471</b></div>
        <span class="badge blue" style="font-size:9px;padding:3px 8px;">In Transit</span>
      </div>
      <table style="font-size:10.5px;width:100%;border-collapse:collapse;">
        <thead><tr><th style="text-align:left;padding:6px 8px;background:var(--surface);font-size:8.5px;color:var(--ink-soft);">Location</th><th style="text-align:left;padding:6px 8px;background:var(--surface);font-size:8.5px;color:var(--ink-soft);">Status</th><th style="text-align:left;padding:6px 8px;background:var(--surface);font-size:8.5px;color:var(--ink-soft);">Time</th></tr></thead>
        <tbody>
          <tr><td style="padding:7px 8px;border-bottom:1px solid var(--surface-2);">Ndola</td><td style="padding:7px 8px;border-bottom:1px solid var(--surface-2);"><span class="badge blue" style="font-size:8.5px;padding:2px 7px;">Departed</span></td><td style="padding:7px 8px;border-bottom:1px solid var(--surface-2);color:var(--ink-soft);">Sep 4</td></tr>
          <tr><td style="padding:7px 8px;border-bottom:1px solid var(--surface-2);">Chirundu Border</td><td style="padding:7px 8px;border-bottom:1px solid var(--surface-2);"><span class="badge green" style="font-size:8.5px;padding:2px 7px;">Border Cleared</span></td><td style="padding:7px 8px;border-bottom:1px solid var(--surface-2);color:var(--ink-soft);">Sep 5</td></tr>
          <tr><td style="padding:7px 8px;">Harare</td><td style="padding:7px 8px;"><span class="badge blue" style="font-size:8.5px;padding:2px 7px;">In Transit</span></td><td style="padding:7px 8px;color:var(--ink-soft);">Sep 6</td></tr>
        </tbody>
      </table>
      <div class="profit-bar" style="margin-top:12px;padding:10px 12px;">
        <span class="lbl" style="font-size:10px;">Freight $5,280.00 − Expenses $615.00</span>
        <span class="val pos" style="font-size:14px;">$4,665.00</span>
      </div>
    </div>
  </div>`;
}

function paymentsMockup() {
  return `
  <div class="browser-mockup reveal">
    <div class="browser-mockup-bar"><span class="dot"></span><span class="dot"></span><span class="dot"></span><div class="browser-mockup-url">truck-manger.com/payments</div></div>
    <div class="browser-mockup-body">
      <div class="kpi-row" style="grid-template-columns:repeat(3,1fr);gap:8px;margin-bottom:12px;">
        <div class="kpi total" style="padding:10px 12px;"><div class="num" style="font-size:16px;">$13,700</div><div class="lbl" style="font-size:8.5px;">Total Invoiced</div></div>
        <div class="kpi green" style="padding:10px 12px;"><div class="num" style="font-size:16px;">$6,560</div><div class="lbl" style="font-size:8.5px;">Collected</div></div>
        <div class="kpi red" style="padding:10px 12px;"><div class="num" style="font-size:16px;">$7,140</div><div class="lbl" style="font-size:8.5px;">Outstanding</div></div>
      </div>
      <div class="panel" style="padding:12px;margin-bottom:8px;">
        <div style="display:flex;justify-content:space-between;margin-bottom:6px;">
          <span style="font-size:11px;font-weight:700;">Copperbelt Exports</span>
          <span class="badge green" style="font-size:8.5px;padding:3px 8px;">Paid</span>
        </div>
        <div style="background:var(--surface-2);border-radius:20px;height:6px;overflow:hidden;"><div style="height:100%;width:100%;background:var(--green);"></div></div>
      </div>
      <div class="panel" style="padding:12px;">
        <div style="display:flex;justify-content:space-between;margin-bottom:6px;">
          <span style="font-size:11px;font-weight:700;">Kariba Minerals Ltd</span>
          <span class="badge orange" style="font-size:8.5px;padding:3px 8px;">Partial</span>
        </div>
        <div style="background:var(--surface-2);border-radius:20px;height:6px;overflow:hidden;"><div style="height:100%;width:50%;background:var(--orange);"></div></div>
      </div>
    </div>
  </div>`;
}

export function renderLandingScreen(onLogin) {
  const root = document.getElementById('landing-root');
  root.innerHTML = `
  <div class="landing">
    <nav class="landing-nav">
      <div class="landing-nav-inner">
        <div class="landing-nav-brand">
          <div class="brand-mark" style="width:32px;height:32px;">${TRUCK_ICON.replace('<svg ', '<svg width="17" height="17" ')}</div>
          <div><div class="name">TruckManager</div></div>
        </div>
        <button class="btn btn-primary btn-sm" id="landingLoginBtn">Log In</button>
      </div>
    </nav>

    <header class="landing-hero">
      <div class="landing-container landing-hero-grid">
        <div>
          <div class="landing-eyebrow"><span class="dot"></span>Built in Zambia, for cross-border fleets</div>
          <h1>Stop finding out about your trucks from a <span>phone call.</span></h1>
          <p class="lede">Every truck, every border crossing, every dollar owed — on one screen, updated the moment it happens. No more digging through WhatsApp voice notes to figure out where a load actually is.</p>
          <div class="landing-cta-row">
            <button class="btn btn-primary" id="landingLoginBtn2">Log In to Your Account</button>
            <a class="btn btn-ghost" href="${WHATSAPP_URL}" target="_blank" rel="noopener">${WHATSAPP_ICON} Chat on WhatsApp</a>
          </div>
          <div class="landing-trustline">${CHECK_ICON.replace('width="16" height="16"', 'width="14" height="14"')} Set up by invitation only — your company's data stays yours.</div>
        </div>
        <div class="landing-hero-mockup reveal">${dashboardMockup()}</div>
      </div>
    </header>

    <section class="landing-section">
      <div class="landing-container">
        <div class="landing-section-head reveal">
          <div class="kicker">Everything in one console</div>
          <h2>Built for the way cross-border trucking actually works</h2>
          <p>Dispatch, border tracking, expenses, invoicing — the same work your team already does, just without the spreadsheets and the group chats.</p>
        </div>
        <div class="landing-features-grid">
          ${FEATURES.map((f, i) => `
          <div class="landing-feature-card reveal" style="transition-delay:${i * 60}ms;">
            <div class="landing-feature-icon"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="21" height="21">${f.icon}</svg></div>
            <h3>${f.title}</h3>
            <p>${f.text}</p>
          </div>`).join('')}
        </div>
      </div>
    </section>

    <section class="landing-section" style="padding-top:24px;">
      <div class="landing-container">
        <div class="landing-showcase-row">
          <div class="landing-showcase-text reveal">
            <div class="kicker">Trip Management</div>
            <h3>Every checkpoint, logged the moment it happens</h3>
            <p>A truck clears customs, gets held up, or breaks down — log it once and the route updates for everyone watching. No group chat needed to know where a load actually is.</p>
            <ul>
              <li>${CHECK_ICON}Freight rate worked out for you from tons × rate per ton</li>
              <li>${CHECK_ICON}Full history of every checkpoint, with a timestamp</li>
              <li>${CHECK_ICON}Trip profit recalculated the second an expense is added</li>
            </ul>
          </div>
          <div class="landing-showcase-visual reveal">${tripMockup()}</div>
        </div>
        <div class="landing-showcase-row reverse">
          <div class="landing-showcase-text reveal">
            <div class="kicker">Payments & Invoices</div>
            <h3>Stop wondering who still owes you money</h3>
            <p>Every trip becomes an invoice the moment it's dispatched. Log a payment as it lands, and the outstanding balance updates itself — across your whole fleet, not just one trip.</p>
            <ul>
              <li>${CHECK_ICON}Outstanding balance at a glance, fleet-wide</li>
              <li>${CHECK_ICON}A client-ready invoice, printed in one click</li>
              <li>${CHECK_ICON}Subcontractor commission kept separate from your margin</li>
            </ul>
          </div>
          <div class="landing-showcase-visual reveal">${paymentsMockup()}</div>
        </div>
      </div>
    </section>

    <section class="landing-section landing-trust">
      <div class="landing-container">
        <div class="landing-section-head reveal">
          <div class="kicker">Why trust it with your numbers</div>
          <h2>Your data. Nobody else's.</h2>
        </div>
        <div class="landing-trust-grid">
          <div class="landing-trust-item reveal">
            <div class="num">${CHECK_ICON}Locked to your company</div>
            <p>Every truck, trip, and cent is walled off to your account. That's enforced by the database itself, not just by the app you're looking at.</p>
          </div>
          <div class="landing-trust-item reveal" style="transition-delay:80ms;">
            <div class="num">${CHECK_ICON}Backed up as you work</div>
            <p>Your data is copied across multiple data centers the second you save it — no end-of-day backup job to remember.</p>
          </div>
          <div class="landing-trust-item reveal" style="transition-delay:160ms;">
            <div class="num">${CHECK_ICON}No open sign-up</div>
            <p>We set up every account ourselves. There's no public sign-up page for a stranger to stumble onto.</p>
          </div>
        </div>
      </div>
    </section>

    <section class="landing-section">
      <div class="landing-final-cta reveal">
        <h2>Ready to put your fleet on TruckManager?</h2>
        <p>Message us on WhatsApp and we'll get your company set up — most teams are running the same day.</p>
        <div class="landing-cta-row">
          <a class="btn btn-primary" href="${WHATSAPP_URL}" target="_blank" rel="noopener">${WHATSAPP_ICON} Chat on WhatsApp</a>
          <button class="btn btn-ghost" id="landingLoginBtn3" style="background:transparent;border-color:#4B5563;color:#fff;">Already have an account? Log In</button>
        </div>
      </div>
    </section>

    <footer class="landing-footer">
      <div class="landing-nav-brand">
        <div class="brand-mark" style="width:28px;height:28px;">${TRUCK_ICON.replace('<svg ', '<svg width="15" height="15" ')}</div>
        <div><div class="name" style="font-size:14px;">TruckManager</div></div>
      </div>
      © ${new Date().getFullYear()} TruckManager · Fleet &amp; Cross-Border Ops
    </footer>
  </div>`;

  ['landingLoginBtn', 'landingLoginBtn2', 'landingLoginBtn3'].forEach(id => {
    const btn = document.getElementById(id);
    if (btn) btn.addEventListener('click', onLogin);
  });

  const observer = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        entry.target.classList.add('in-view');
        observer.unobserve(entry.target);
      }
    });
  }, { threshold: 0.15 });
  root.querySelectorAll('.reveal').forEach(el => observer.observe(el));
}

export function showLandingScreen(onLogin) {
  document.getElementById('landing-root').style.display = 'block';
  document.getElementById('auth-root').style.display = 'none';
  document.getElementById('app-root').style.display = 'none';
  renderLandingScreen(onLogin);
}

export function hideLandingScreen() {
  document.getElementById('landing-root').style.display = 'none';
}
