import {
  trucksRef, tripsRef, expensesRef, paymentsRef,
  listenCollection, addDocWithId, updateDocById, deleteDocById,
  nextTripSequence, listenTripCounter, updateDisplayName
} from './firebase.js';
import { getTheme, applyTheme } from './theme.js';

/* =========================================================
   DATA MODEL (populated live from Firestore, see initApp)
========================================================= */
const DB = { trucks: [], trips: [], expenses: [], payments: [] };
let currentUser = null;
let unsubscribers = [];
let nextSeqPreview = 1;
const loaded = { trucks: false, trips: false, expenses: false, payments: false };

/* =========================================================
   UI STATE
========================================================= */
const UI = {
  route:'dashboard',
  profileTruckId:null, profileTab:'current',
  showRegisterForm:false,
  registerForm:{plate:'',model:'',trailer1:'',trailer2:'',driverName:'',driverId:'',driverPhone:'',status:'Available',maintenanceNote:''},
  fleetFilter:'all', fleetSearch:'', editingTruckId:null,
  showWizard:false,
  wizardForm:{truckId:'',clientName:'',origin:'',destination:'',cargoDesc:'',cargoTons:'',freightRate:'',departureDate:'',estDelivery:''},
  wizardCheckpoints:[], newCheckpointName:'',
  tripsSearch:'', tripsFilter:'all',
  expandedTripId:null,
  checkpointForm:{location:'',status:'Departed',notes:'',date:'',issueType:''},
  checkpointEditIdx:null,
  expenseForm:{category:'Fuel',subtype:'',amount:'',liters:'',station:'',receipt:''},
  expenseEditId:null,
  paymentFilter:'all', viewInvoiceTripId:null,
  paymentForm:{tripId:null, amount:'', note:''},
  reportTab:'fleet',
  settingsDisplayName:'', settingsSaved:false
};

const CHECKPOINT_STATUSES = ['Departed','Arrived at Border','In Customs Clearance','Border Cleared','In Transit','Delayed / Issue','Delivered'];
const DISPATCH_SUBTYPES = ['Driver Allowance','Toll Gates & Border Fees','Loading / Unloading'];
const OTHER_SUBTYPES = ['Maintenance / Repairs','Fines / Police Clearance','Miscellaneous'];
const ISSUE_TYPES = ['Mechanical Breakdown','Truck Held / Detained (Police, Customs, Roadblock)','Accident','Other Issue'];
const COMMON_LOCATIONS = ['Ndola','Lusaka','Kitwe','Livingstone','Solwezi','Kazungula Border','Chirundu Border','Nakonde Border','Tunduma Border','Beitbridge Border','Harare','Beira Corridor','Beira Port','Johannesburg','Kolwezi (DRC)','Lubumbashi (DRC)','Nairobi','Dar es Salaam','Mutare'];

/* =========================================================
   HELPERS
========================================================= */
function fmt$(n){ n = Number(n)||0; return '$' + n.toLocaleString('en-US',{minimumFractionDigits:2,maximumFractionDigits:2}); }
function fmtDate(d){ if(!d) return '—'; const dt = new Date(d); return dt.toLocaleDateString('en-US',{month:'short',day:'numeric',year:'numeric'}); }
function fmtDateTime(d){ if(!d) return '—'; const dt = new Date(d); return dt.toLocaleDateString('en-US',{month:'short',day:'numeric'}) + ' · ' + dt.toLocaleTimeString('en-US',{hour:'2-digit',minute:'2-digit'}); }
function nowISO(){ return new Date().toISOString(); }
function todayInput(){ return new Date().toISOString().slice(0,10); }
function pad4(n){ return String(n).padStart(4,'0'); }
function truckById(id){ return DB.trucks.find(t=>t.id===id); }
function tripById(id){ return DB.trips.find(t=>t.id===id); }
function esc(s){ return (s===undefined||s===null)?'':String(s).replace(/</g,'&lt;'); }
function toDatetimeLocalValue(isoOrNull){
  const d = isoOrNull ? new Date(isoOrNull) : new Date();
  const p = n => String(n).padStart(2,'0');
  return `${d.getFullYear()}-${p(d.getMonth()+1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`;
}
function fromDatetimeLocalValue(val){ return val ? new Date(val).toISOString() : nowISO(); }

function statusColorClass(status){
  switch(status){
    case 'Available': case 'Delivered': case 'Border Cleared': return 'green';
    case 'On-Trip': case 'In Transit': case 'Departed': return 'blue';
    case 'Arrived at Border': case 'In Customs Clearance': return 'orange';
    case 'Maintenance': case 'Delayed / Issue': return 'red';
    default: return 'blue';
  }
}
function tripExpenses(tripId){ return DB.expenses.filter(e=>e.tripId===tripId); }
function tripExpenseTotal(tripId){ return tripExpenses(tripId).reduce((s,e)=>s+e.amount,0); }
function tripProfit(trip){ return trip.freightRevenue - tripExpenseTotal(trip.id); }
function truckTrips(truckId){ return DB.trips.filter(t=>t.truckId===truckId); }

function paymentByTripId(tripId){ return DB.payments.find(p=>p.tripId===tripId); }
function paymentStatusColor(s){ return s==='Paid'?'green':s==='Partial'?'orange':'red'; }
function paymentBalance(p,trip){ return (trip?trip.freightRevenue:0) - (p?p.paidAmount:0); }
function totalCollected(){ return DB.payments.reduce((s,p)=>s+p.paidAmount,0); }
function totalInvoiced(){ return DB.payments.reduce((s,p)=>s+(p.amount||0),0); }
function totalOutstanding(){ return totalInvoiced()-totalCollected(); }

/* =========================================================
   FIRESTORE-BACKED MUTATIONS
========================================================= */
async function ensurePayment(tripId){
  let p = paymentByTripId(tripId);
  if(!p){
    const trip = tripById(tripId);
    const data = {tripId, amount:trip?trip.freightRevenue:0, paidAmount:0, status:'Unpaid', invoiceDate:'', notes:'', entries:[]};
    const id = await addDocWithId(paymentsRef(currentUser.uid), data);
    p = {id, ...data};
    DB.payments.push(p);
  }
  return p;
}

async function submitPaymentEntry(tripId){
  const amt = parseFloat(UI.paymentForm.amount);
  if(!amt||amt<=0){ alert('Please enter a valid amount.'); return; }
  const p = await ensurePayment(tripId);
  const newPaid = Math.min(p.paidAmount + amt, p.amount);
  const entries = [...(p.entries||[]), {amount:amt, date:todayInput(), note:UI.paymentForm.note.trim()}];
  const status = newPaid >= p.amount ? 'Paid' : newPaid > 0 ? 'Partial' : 'Unpaid';
  const invoiceDate = p.invoiceDate || todayInput();
  await updateDocById(paymentsRef(currentUser.uid), p.id, {paidAmount:newPaid, entries, status, invoiceDate});
  UI.paymentForm = {tripId:null, amount:'', note:''};
  render();
}
async function setPaymentStatus(tripId, status){
  const p = await ensurePayment(tripId);
  const data = {status};
  if(status==='Paid'){ data.paidAmount = p.amount; if(!p.invoiceDate) data.invoiceDate=todayInput(); }
  if(status==='Unpaid'){ data.paidAmount=0; data.entries=[]; }
  if(status==='Partial' && p.paidAmount===0){ data.paidAmount = Math.round(p.amount*0.5); }
  if(!p.invoiceDate && status!=='Unpaid' && !data.invoiceDate) data.invoiceDate = todayInput();
  await updateDocById(paymentsRef(currentUser.uid), p.id, data);
  render();
}
function setPaymentFilter(f){ UI.paymentFilter=f; render(); }
function setReportTab(t){ UI.reportTab=t; render(); }
function openInvoice(tripId){ UI.viewInvoiceTripId=tripId; render(); }
function closeInvoice(){ UI.viewInvoiceTripId=null; render(); }
async function deletePaymentEntry(tripId, idx){
  if(!confirm('Delete this payment entry?')) return;
  const p = paymentByTripId(tripId);
  if(!p||!p.entries) return;
  const removedAmt = p.entries[idx] ? p.entries[idx].amount : 0;
  const entries = p.entries.slice(); entries.splice(idx,1);
  const paidAmount = Math.max(0, p.paidAmount - removedAmt);
  const status = paidAmount<=0 ? 'Unpaid' : paidAmount >= p.amount ? 'Paid' : 'Partial';
  await updateDocById(paymentsRef(currentUser.uid), p.id, {entries, paidAmount, status});
  render();
}

function downloadCSV(filename, rows){
  const csv = rows.map(r=>r.map(c=>'"'+String(c===undefined?'':c).replace(/"/g,'""')+'"').join(',')).join('\n');
  const blob = new Blob([csv],{type:'text/csv'});
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a'); a.href=url; a.download=filename;
  document.body.appendChild(a); a.click(); document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
function exportFleetCSV(){
  const rows = [['Plate','Model','Trailer 1','Trailer 2','Driver','Driver ID','Phone','Status']];
  DB.trucks.forEach(t=>rows.push([t.plate,t.model,t.trailer1,t.trailer2,t.driverName,t.driverId,t.driverPhone,t.status]));
  downloadCSV('fleet-export.csv', rows);
}
function exportTripsCSV(){
  const rows = [['Trip Ref','Truck','Origin','Destination','Status','Freight Revenue ($)','Expenses ($)','Profit ($)']];
  DB.trips.forEach(t=>{
    const truck = truckById(t.truckId);
    rows.push([t.ref, truck?truck.plate:'—', t.origin, t.destination, t.status, t.freightRevenue.toFixed(2), tripExpenseTotal(t.id).toFixed(2), tripProfit(t).toFixed(2)]);
  });
  downloadCSV('trips-export.csv', rows);
}
function exportPaymentsCSV(){
  const rows=[['Trip Ref','Client','Route','Freight ($)','Expenses ($)','Profit ($)','Paid ($)','Balance ($)','Status','Invoice Date']];
  DB.trips.forEach(t=>{
    const p=paymentByTripId(t.id);
    rows.push([t.ref, t.clientName||'—', t.origin+'→'+t.destination, t.freightRevenue.toFixed(2), tripExpenseTotal(t.id).toFixed(2), tripProfit(t).toFixed(2), p?p.paidAmount.toFixed(2):'0.00', paymentBalance(p,t).toFixed(2), p?p.status:'Unpaid', p?p.invoiceDate:'—']);
  });
  downloadCSV('payments-export.csv', rows);
}
function printInvoice(tripId){
  const trip = tripById(tripId);
  if(!trip) return;
  const p = paymentByTripId(tripId)||{status:'Unpaid',paidAmount:0,amount:trip.freightRevenue,invoiceDate:'',entries:[]};
  const truck = truckById(trip.truckId);
  const expTotal = tripExpenseTotal(tripId);
  const expenses = tripExpenses(tripId);
  const balance = paymentBalance(p, trip);
  const invoiceNum = 'INV-' + pad4(tripId.slice(-4).replace(/\D/g,'') || '0');
  const invoiceDate = p.invoiceDate || todayInput();
  const statusBg = p.status==='Paid'?'#E6F5EB':p.status==='Partial'?'#FCF0DE':'#FCE9E8';
  const statusColor = p.status==='Paid'?'#15803D':p.status==='Partial'?'#C2650B':'#DC2626';
  const balColor = balance>0?'#DC2626':'#15803D';

  const expRows = expenses.map(e=>`<tr><td>${e.category}</td><td>${(e.subtype||(e.station?(e.station+(e.liters?' · '+e.liters+'L':'')):'—'))}</td><td style="text-align:right;">${fmt$(e.amount)}</td></tr>`).join('');

  const html = `<!DOCTYPE html><html><head><meta charset="UTF-8"><title>Invoice ${invoiceNum}</title>
  <style>*{box-sizing:border-box;margin:0;padding:0;}body{font-family:system-ui,sans-serif;font-size:13.5px;color:#111827;padding:32px 40px;max-width:800px;margin:auto;}
  h1{font-size:24px;font-weight:800;}.mono{font-family:monospace;}
  table{width:100%;border-collapse:collapse;margin:8px 0;}
  th{background:#F8FAFC;text-align:left;padding:9px 12px;font-size:11px;text-transform:uppercase;letter-spacing:.04em;color:#6B7280;border-bottom:1px solid #E6EAF0;}
  td{padding:10px 12px;border-bottom:1px solid #F1F5F9;font-size:13px;}
  .info-box{background:#F8FAFC;border-radius:8px;padding:12px 16px;}
  .section-label{font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:.04em;color:#6B7280;margin:18px 0 8px;}
  .two-col{display:grid;grid-template-columns:1fr 1fr;gap:16px;margin-bottom:22px;}
  .row{display:flex;justify-content:space-between;padding:5px 0;font-size:13px;border-bottom:1px solid #F1F5F9;}
  .big-total{display:flex;justify-content:space-between;padding:10px 0;font-size:18px;font-weight:800;border-top:2px solid #E6EAF0;}
  .footer{text-align:center;margin-top:28px;font-size:11.5px;color:#9CA3AF;}</style></head>
  <body>
  <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:24px;">
    <div><div style="font-size:22px;font-weight:800;">TruckManager</div><div style="font-size:12px;color:#6B7280;margin-top:2px;">Fleet &amp; Cross-Border Logistics</div></div>
    <div style="text-align:right;"><div style="font-size:22px;font-weight:800;color:#2563EB;">INVOICE</div><div class="mono" style="color:#6B7280;">${invoiceNum}</div><div style="font-size:12px;color:#6B7280;">Date: ${fmtDate(invoiceDate)}</div></div>
  </div>
  <div class="two-col">
    <div class="info-box"><div class="section-label">Billed To</div><div style="font-size:16px;font-weight:700;">${trip.clientName||'—'}</div></div>
    <div class="info-box"><div class="section-label">Shipment Details</div>
      <div><b>Trip Ref:</b> <span class="mono">${trip.ref}</span></div>
      <div><b>Truck:</b> ${truck?truck.plate:'—'} (${truck?truck.model:'—'})</div>
      <div><b>Driver:</b> ${truck?truck.driverName:'—'}</div>
      <div><b>Route:</b> ${trip.origin} → ${trip.destination}</div>
      <div><b>Cargo:</b> ${trip.cargoDesc}, ${trip.cargoTons}t</div>
      <div><b>Departure:</b> ${fmtDate(trip.departureDate)}</div>
    </div>
  </div>
  <table><thead><tr><th>Description</th><th style="text-align:right;">Amount</th></tr></thead>
  <tbody><tr><td><b>Freight Service</b><br><span style="font-size:12px;color:#6B7280;">${trip.origin} → ${trip.destination} · ${trip.cargoTons}t</span></td>
  <td style="text-align:right;font-weight:700;font-size:15px;">${fmt$(trip.freightRevenue)}</td></tr></tbody></table>
  <div style="display:flex;justify-content:flex-end;margin-top:14px;">
    <div style="width:280px;">
      <div class="row"><span>Subtotal</span><span>${fmt$(trip.freightRevenue)}</span></div>
      <div class="row" style="color:#15803D;"><span>Amount Received</span><span>−${fmt$(p.paidAmount)}</span></div>
      <div class="big-total"><span>Balance Due</span><span style="color:${balColor};">${fmt$(balance)}</span></div>
    </div>
  </div>
  <div style="margin-top:16px;padding:10px 14px;border-radius:8px;background:${statusBg};display:flex;justify-content:space-between;align-items:center;">
    <span style="font-weight:600;">Payment Status</span>
    <span style="font-weight:700;color:${statusColor};">${p.status}</span>
  </div>
  ${expenses.length>0?`<div class="section-label" style="margin-top:24px;">Trip Expense Breakdown (Internal)</div>
  <table><thead><tr><th>Category</th><th>Detail</th><th style="text-align:right;">Amount</th></tr></thead>
  <tbody>${expRows}<tr><td colspan="2" style="font-weight:700;border-top:2px solid #E6EAF0;">Total Expenses</td><td style="text-align:right;font-weight:700;border-top:2px solid #E6EAF0;">${fmt$(expTotal)}</td></tr>
  <tr><td colspan="2" style="font-weight:700;color:${balColor};">Net Profit</td><td style="text-align:right;font-weight:700;color:${trip.freightRevenue-expTotal>=0?'#15803D':'#DC2626'};">${fmt$(trip.freightRevenue-expTotal)}</td></tr></tbody></table>`:''}
  <div class="footer">Thank you for your business.</div>
  </body></html>`;

  const win = window.open('','_blank','width=820,height=960');
  if(!win){ alert('Pop-up blocked — please allow pop-ups for this page and try again.'); return; }
  win.document.write(html);
  win.document.close();
  win.focus();
  setTimeout(()=>{ win.print(); }, 400);
}

/* =========================================================
   NAV / ROUTING
========================================================= */
const NAV_ITEMS = [
  {key:'dashboard', label:'Dashboard', icon:'<rect x="3" y="3" width="7" height="9"/><rect x="14" y="3" width="7" height="5"/><rect x="14" y="12" width="7" height="9"/><rect x="3" y="16" width="7" height="5"/>'},
  {key:'fleet', label:'Fleet Management', icon:'<rect x="1" y="7" width="14" height="9"/><path d="M15 11h4l3 3v2h-7"/><circle cx="6" cy="18" r="2"/><circle cx="18" cy="18" r="2"/>'},
  {key:'trips', label:'Trip Management', icon:'<path d="M9 5H5a2 2 0 00-2 2v12a2 2 0 002 2h12a2 2 0 002-2V7a2 2 0 00-2-2h-4"/><path d="M9 3h6v4H9z"/>'},
  {key:'payments', label:'Payments & Invoices', icon:'<rect x="2" y="5" width="20" height="14" rx="2"/><path d="M2 10h20"/>'},
  {key:'reports', label:'Reports', icon:'<path d="M3 3v18h18"/><path d="M7 15l4-6 4 4 5-8"/>'},
  {key:'settings', label:'Settings', icon:'<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 11-2.83 2.83l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-4 0v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 11-2.83-2.83l.06-.06A1.65 1.65 0 004.6 15a1.65 1.65 0 00-1.51-1H3a2 2 0 010-4h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 112.83-2.83l.06.06A1.65 1.65 0 009 4.6a1.65 1.65 0 001-1.51V3a2 2 0 014 0v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 112.83 2.83l-.06.06A1.65 1.65 0 0019.4 9a1.65 1.65 0 001.51 1H21a2 2 0 010 4h-.09a1.65 1.65 0 00-1.51 1z"/>'}
];
function renderNav(){
  document.getElementById('navList').innerHTML = NAV_ITEMS.map(n=>`
    <div class="nav-item ${UI.route===n.key?'active':''}" onclick="setRoute('${n.key}')">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">${n.icon}</svg>
      ${n.label}
    </div>`).join('');
}
function setRoute(route){
  UI.route = route;
  if(route!=='profile') UI.profileTruckId=null;
  UI.expandedTripId=null;
  if(route==='settings' && currentUser) UI.settingsDisplayName = currentUser.displayName || (currentUser.email ? currentUser.email.split('@')[0] : '');
  render();
}
function openProfile(id){ UI.route='profile'; UI.profileTruckId=id; UI.profileTab='current'; render(); }
function setProfileTab(tab){ UI.profileTab=tab; render(); }

/* =========================================================
   MASTER RENDER
========================================================= */
function render(){
  if(!currentUser) return;
  const app = document.getElementById('app');
  if(!(loaded.trucks && loaded.trips && loaded.expenses && loaded.payments)){
    app.innerHTML = '<div class="empty">Loading your data…</div>';
    return;
  }
  renderNav();
  if(UI.route==='dashboard') app.innerHTML = renderDashboard();
  else if(UI.route==='fleet') app.innerHTML = renderFleet();
  else if(UI.route==='trips') app.innerHTML = renderTrips();
  else if(UI.route==='profile') app.innerHTML = renderProfile();
  else if(UI.route==='payments') app.innerHTML = renderPayments();
  else if(UI.route==='reports') app.innerHTML = renderReports();
  else if(UI.route==='settings') app.innerHTML = renderSettings();

  const overlay = document.getElementById('invoice-overlay');
  if(overlay){
    if(UI.viewInvoiceTripId){
      overlay.innerHTML = renderInvoiceModal(UI.viewInvoiceTripId);
      overlay.style.display = 'flex';
      document.body.style.overflow = 'hidden';
    } else {
      overlay.innerHTML = '';
      overlay.style.display = 'none';
      document.body.style.overflow = '';
    }
  }
}

/* =========================================================
   DASHBOARD
========================================================= */
function renderDashboard(){
  const total = DB.trucks.length;
  const onTrip = DB.trucks.filter(t=>t.status==='On-Trip').length;
  const available = DB.trucks.filter(t=>t.status==='Available').length;
  const maintenance = DB.trucks.filter(t=>t.status==='Maintenance').length;

  const activeTrips = DB.trips.filter(t=>t.status!=='Delivered');

  const totalRevenue = DB.trips.reduce((s,t)=>s+t.freightRevenue,0);
  const totalExpense = DB.expenses.reduce((s,e)=>s+e.amount,0);
  const netProfit = totalRevenue - totalExpense;
  const catTotal = cat => DB.expenses.filter(e=>e.category===cat).reduce((s,e)=>s+e.amount,0);
  const dispatchT = catTotal('Dispatch'), fuelT = catTotal('Fuel'), otherT = catTotal('Other');
  const pct = v => totalExpense>0 ? Math.round(v/totalExpense*100) : 0;

  return `
    <div class="page-head">
      <div><h1>Live Overview</h1><div class="sub">${new Date().toLocaleDateString('en-US',{weekday:'long',month:'long',day:'numeric',year:'numeric'})}</div></div>
      <button class="btn btn-primary" onclick="setRoute('trips'); UI.showWizard=true; render();">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4"><path d="M12 5v14M5 12h14"/></svg>
        Dispatch New Trip
      </button>
    </div>

    <div class="kpi-row">
      <div class="kpi total"><div class="num">${total}</div><div class="lbl">Total Fleet</div></div>
      <div class="kpi blue"><div class="num">${onTrip}</div><div class="lbl">On-Trip</div></div>
      <div class="kpi green"><div class="num">${available}</div><div class="lbl">Available</div></div>
      <div class="kpi red"><div class="num">${maintenance}</div><div class="lbl">Maintenance</div></div>
    </div>

    ${total===0 ? `<div class="panel"><div class="empty">No trucks registered yet. Go to <b onclick="setRoute('fleet')" style="cursor:pointer;color:var(--accent);">Fleet Management</b> to get started.</div></div>` : `
    <div class="grid-2">
      <div class="panel">
        <div class="panel-head"><h2>Trip Status Feed &amp; Live Border Tracking</h2><span class="count">${activeTrips.length} active</span></div>
        <div class="panel-body">
          ${activeTrips.length===0 ? '<div class="empty">No active trips right now.</div>' : activeTrips.map(trip=>{
            const truck = truckById(trip.truckId);
            const last = trip.checkpoints[trip.checkpoints.length-1];
            return `
            <div class="trip-row">
              <div class="trip-row-top">
                <div><span class="trip-id">${trip.ref}</span> · <b>${truck?truck.plate:'—'}</b> · ${esc(trip.cargoDesc)}, ${trip.cargoTons}t</div>
                <span class="badge ${statusColorClass(trip.status)}">${trip.status}</span>
              </div>
              ${buildRouteTrack(trip)}
              ${last && last.notes ? `<div class="route-note">${esc(last.notes)} · logged ${fmtDateTime(last.timestamp)}</div>` : ''}
            </div>`;
          }).join('')}
        </div>
      </div>

      <div class="panel">
        <div class="panel-head"><h2>Monthly Financial Snapshot</h2><span class="count">all trips to date</span></div>
        <div class="panel-body" style="padding:16px;">
          <div class="exp-cat" style="margin-bottom:10px;"><div class="lbl">Freight Revenue</div><div class="val" style="color:var(--green);">${fmt$(totalRevenue)}</div></div>
          <div class="exp-cat" style="margin-bottom:10px;"><div class="lbl">Total Expenses</div><div class="val" style="color:var(--red);">${fmt$(totalExpense)}</div></div>
          <div class="profit-bar"><span class="lbl">Net Fleet Profit</span><span class="val ${netProfit>=0?'pos':'neg'}">${fmt$(netProfit)}</span></div>
          <div class="divider" style="margin:14px 0 10px;"></div>
          <div style="font-size:11.5px;font-weight:700;color:var(--ink-soft);text-transform:uppercase;letter-spacing:.04em;margin-bottom:8px;">Payment Summary</div>
          <div style="display:flex;justify-content:space-between;margin-bottom:6px;font-size:13px;"><span style="color:var(--ink-soft);">Total Invoiced</span><b>${fmt$(totalInvoiced())}</b></div>
          <div style="display:flex;justify-content:space-between;margin-bottom:6px;font-size:13px;"><span style="color:var(--ink-soft);">Collected</span><b style="color:var(--green);">${fmt$(totalCollected())}</b></div>
          <div style="display:flex;justify-content:space-between;font-size:13px;"><span style="color:var(--ink-soft);">Outstanding</span><b style="color:var(--red);">${fmt$(totalOutstanding())}</b></div>
          <button class="btn btn-ghost btn-sm" style="width:100%;justify-content:center;margin-top:12px;" onclick="setRoute('payments')">View All Payments →</button>
          <div style="margin-top:14px;">
            <div style="display:flex;justify-content:space-between;font-size:10.5px;color:var(--ink-soft);margin-bottom:6px;">
              <span>DISPATCH ${pct(dispatchT)}%</span><span>FUEL ${pct(fuelT)}%</span><span>OTHER ${pct(otherT)}%</span>
            </div>
            <div style="display:flex;height:9px;border-radius:20px;overflow:hidden;background:var(--surface-2);">
              <div style="width:${pct(dispatchT)}%;background:var(--accent);"></div>
              <div style="width:${pct(fuelT)}%;background:var(--ink);"></div>
              <div style="width:${pct(otherT)}%;background:var(--orange);"></div>
            </div>
          </div>
        </div>
      </div>
    </div>`}`;
}

function buildRouteTrack(trip){
  const plan = trip.routePlan;
  const loggedLocations = trip.checkpoints.map(c=>c.location);
  const lastCp = trip.checkpoints[trip.checkpoints.length-1];
  let track = '<div class="route-track">';
  plan.forEach((loc,i)=>{
    const isCurrent = lastCp && lastCp.location===loc;
    const isLogged = loggedLocations.includes(loc);
    const cls = isCurrent ? 'active' : (isLogged ? 'done' : 'pending');
    track += `<div class="stamp ${cls}">${cls==='done'?'&#10003;':(cls==='active'?'&#9679;':'')}</div>`;
    if(i<plan.length-1){
      const nextLogged = loggedLocations.includes(plan[i+1]);
      track += `<div class="seg ${nextLogged?'done':(isCurrent?'active':'')}"></div>`;
    }
  });
  track += '</div><div class="route-labels">' + plan.map(l=>`<span>${esc(l)}</span>`).join('') + '</div>';
  return track;
}

/* =========================================================
   FLEET
========================================================= */
function toggleRegisterForm(){ UI.showRegisterForm = !UI.showRegisterForm; render(); }
async function submitRegisterTruck(){
  const f = UI.registerForm;
  if(!f.plate.trim() || !f.model.trim() || !f.driverName.trim()){
    alert('Please fill in Truck Registration Number, Model, and Driver Name.'); return;
  }
  await addDocWithId(trucksRef(currentUser.uid), {
    plate:f.plate.trim(), model:f.model.trim(),
    trailer1:f.trailer1.trim()||'—', trailer2:f.trailer2.trim()||'—',
    driverName:f.driverName.trim(), driverId:f.driverId.trim()||'—', driverPhone:f.driverPhone.trim()||'—',
    status:f.status, maintenanceNote: f.status==='Maintenance' ? (f.maintenanceNote||'') : ''
  });
  UI.registerForm = {plate:'',model:'',trailer1:'',trailer2:'',driverName:'',driverId:'',driverPhone:'',status:'Available',maintenanceNote:''};
  UI.showRegisterForm = false;
  render();
}
async function saveTruckStatus(truckId, newStatus, note){
  await updateDocById(trucksRef(currentUser.uid), truckId, {status:newStatus, maintenanceNote: newStatus==='Maintenance' ? (note||'') : ''});
  UI.editingTruckId = null;
  render();
}
function setFleetFilter(f){ UI.fleetFilter=f; render(); }
function updateFleetSearch(v){ UI.fleetSearch=v; render(); }
async function deleteTruck(id){
  if(!confirm('Delete this truck? Its trips and expenses will also be deleted.')) return;
  const tripIds = DB.trips.filter(t=>t.truckId===id).map(t=>t.id);
  const jobs = [deleteDocById(trucksRef(currentUser.uid), id)];
  tripIds.forEach(tid=>jobs.push(deleteDocById(tripsRef(currentUser.uid), tid)));
  DB.expenses.filter(e=>tripIds.includes(e.tripId)).forEach(e=>jobs.push(deleteDocById(expensesRef(currentUser.uid), e.id)));
  DB.payments.filter(p=>tripIds.includes(p.tripId)).forEach(p=>jobs.push(deleteDocById(paymentsRef(currentUser.uid), p.id)));
  await Promise.all(jobs);
  if(UI.editingTruckId===id) UI.editingTruckId=null;
  render();
}

function renderFleet(){
  const f = UI.registerForm;
  let list = DB.trucks.slice();
  if(UI.fleetFilter!=='all') list = list.filter(t=>t.status===UI.fleetFilter);
  if(UI.fleetSearch.trim()){
    const q = UI.fleetSearch.toLowerCase();
    list = list.filter(t=> t.plate.toLowerCase().includes(q) || t.driverName.toLowerCase().includes(q) || t.model.toLowerCase().includes(q));
  }
  const counts = {
    all: DB.trucks.length,
    'On-Trip': DB.trucks.filter(t=>t.status==='On-Trip').length,
    'Available': DB.trucks.filter(t=>t.status==='Available').length,
    'Maintenance': DB.trucks.filter(t=>t.status==='Maintenance').length
  };

  return `
    <div class="page-head">
      <div><h1>Fleet Management</h1><div class="sub">${DB.trucks.length} registered trucks · click a card to open its portfolio</div></div>
      <div style="display:flex;gap:8px;">
        <button class="btn btn-ghost" onclick="exportFleetCSV()">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 3v12M7 10l5 5 5-5"/><path d="M5 21h14"/></svg>
          Export CSV
        </button>
        <button class="btn btn-primary" onclick="toggleRegisterForm()">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4"><path d="M12 5v14M5 12h14"/></svg>
          ${UI.showRegisterForm ? 'Close Form' : 'Register Truck'}
        </button>
      </div>
    </div>

    ${UI.showRegisterForm ? `
    <div class="form-card">
      <h3>New Truck Registration</h3>
      <div class="form-hint">Fields marked * are required. This truck will appear as Available (or your chosen status) as soon as you save it.</div>

      <div class="form-section-label">① Truck Details</div>
      <div class="field-row">
        <div class="field"><label>Truck Registration Number *</label><input value="${esc(f.plate)}" oninput="UI.registerForm.plate=this.value" placeholder="e.g. AIF 422"></div>
        <div class="field"><label>Model *</label><input value="${esc(f.model)}" oninput="UI.registerForm.model=this.value" placeholder="e.g. Volvo FH16"></div>
      </div>
      <div class="field-row">
        <div class="field"><label>Trailer 1 Plate Number</label><input value="${esc(f.trailer1)}" oninput="UI.registerForm.trailer1=this.value" placeholder="e.g. T 102 A"></div>
        <div class="field"><label>Trailer 2 Plate Number</label><input value="${esc(f.trailer2)}" oninput="UI.registerForm.trailer2=this.value" placeholder="e.g. T 102 B (Interlink)"></div>
      </div>

      <div class="form-section-label">② Driver Details</div>
      <div class="field-row">
        <div class="field"><label>Assigned Driver Name *</label><input value="${esc(f.driverName)}" oninput="UI.registerForm.driverName=this.value" placeholder="Full name"></div>
        <div class="field"><label>Driver Passport / NRC ID</label><input value="${esc(f.driverId)}" oninput="UI.registerForm.driverId=this.value" placeholder="e.g. 483920/11/1"></div>
      </div>
      <div class="field-row">
        <div class="field"><label>Driver Phone Number</label><input value="${esc(f.driverPhone)}" oninput="UI.registerForm.driverPhone=this.value" placeholder="+260 ..."></div>
        <div class="field"><label>Truck Status</label>
          <select onchange="UI.registerForm.status=this.value">
            <option ${f.status==='Available'?'selected':''}>Available</option>
            <option ${f.status==='On-Trip'?'selected':''}>On-Trip</option>
            <option ${f.status==='Maintenance'?'selected':''}>Maintenance</option>
          </select>
        </div>
      </div>
      <div class="divider"></div>
      <button class="btn btn-primary" onclick="submitRegisterTruck()">Save Truck</button>
    </div>` : ''}

    <div class="toolbar">
      <div class="toolbar-left">
        <span class="chip ${UI.fleetFilter==='all'?'active':''}" onclick="setFleetFilter('all')">All (${counts.all})</span>
        <span class="chip ${UI.fleetFilter==='On-Trip'?'active':''}" onclick="setFleetFilter('On-Trip')">On-Trip (${counts['On-Trip']})</span>
        <span class="chip ${UI.fleetFilter==='Available'?'active':''}" onclick="setFleetFilter('Available')">Available (${counts['Available']})</span>
        <span class="chip ${UI.fleetFilter==='Maintenance'?'active':''}" onclick="setFleetFilter('Maintenance')">Maintenance (${counts['Maintenance']})</span>
      </div>
      <input class="search-box" placeholder="Search truck, driver, model…" value="${esc(UI.fleetSearch)}" oninput="updateFleetSearch(this.value)">
    </div>

    <div class="truck-grid">
      ${list.length===0 ? '<div class="empty">No trucks match this filter.</div>' : list.map(t=>{
        const currentTrip = DB.trips.find(tr=>tr.truckId===t.id && tr.status!=='Delivered');
        const isEditing = UI.editingTruckId===t.id;
        return `
        <div class="truck-card ${isEditing?'editing':''}">
          <div class="truck-card-top" onclick="${isEditing?'':`openProfile('${t.id}')`}">
            <div><div class="plate">${esc(t.plate)}</div><div class="model">${esc(t.model)}</div></div>
            <span class="badge ${statusColorClass(t.status)}">${t.status}</span>
          </div>
          <div class="truck-meta">
            <div><b>Driver:</b> ${esc(t.driverName)}</div>
            <div><b>Trailers:</b> ${esc(t.trailer1)} / ${esc(t.trailer2)}</div>
            <div><b>Current trip:</b> ${currentTrip?currentTrip.ref:'—'}</div>
          </div>
          ${t.status==='Maintenance' && t.maintenanceNote && !isEditing ? `
          <div class="maintenance-note"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="12" height="12"><path d="M12 9v4M12 17h.01"/><path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"/></svg> ${esc(t.maintenanceNote)}</div>` : ''}
          ${isEditing ? `
          <div class="edit-truck-form" onclick="event.stopPropagation()">
            <div class="field" style="margin-bottom:10px;">
              <label>Status</label>
              <select id="editTruckStatus_${t.id}">
                <option ${t.status==='Available'?'selected':''}>Available</option>
                <option ${t.status==='On-Trip'?'selected':''}>On-Trip</option>
                <option ${t.status==='Maintenance'?'selected':''}>Maintenance</option>
              </select>
            </div>
            <div class="field" style="margin-bottom:10px;">
              <label>Maintenance Issue (describe what is wrong)</label>
              <textarea id="editTruckNote_${t.id}" rows="3" placeholder="e.g. Front brake pads worn out, gearbox oil leak...">${esc(t.maintenanceNote)}</textarea>
            </div>
            <div style="display:flex;gap:8px;">
              <button class="btn btn-primary btn-sm" onclick="saveTruckStatus('${t.id}', document.getElementById('editTruckStatus_${t.id}').value, document.getElementById('editTruckNote_${t.id}').value)">Save</button>
              <button class="btn btn-ghost btn-sm" onclick="UI.editingTruckId=null; render();">Cancel</button>
            </div>
          </div>` : `
          <div style="display:flex;gap:8px;margin-top:12px;">
            <button class="btn btn-ghost btn-sm" onclick="event.stopPropagation(); openProfile('${t.id}')">View Profile</button>
            <button class="btn btn-ghost btn-sm" onclick="event.stopPropagation(); UI.editingTruckId='${t.id}'; render();">${t.status==='Maintenance'?'Edit Issue':'Update Status'}</button>
            <button class="btn btn-danger-outline btn-sm" onclick="event.stopPropagation(); deleteTruck('${t.id}')">Delete</button>
          </div>`}
        </div>`;
      }).join('')}
    </div>`;
}

/* =========================================================
   TRIPS
========================================================= */
function toggleWizard(){ UI.showWizard = !UI.showWizard; render(); }
function onWizardTruckChange(val){ UI.wizardForm.truckId = val; render(); }
function addWizardCheckpoint(){
  const name = UI.newCheckpointName.trim();
  if(!name) return;
  UI.wizardCheckpoints.push(name);
  UI.newCheckpointName='';
  render();
  const input = document.getElementById('cpNameInput');
  if(input) input.focus();
}
function handleCpNameKeydown(evt){
  if(evt.key==='Enter'){ evt.preventDefault(); addWizardCheckpoint(); }
}
function removeWizardCheckpoint(i){ UI.wizardCheckpoints.splice(i,1); render(); }

async function submitTrip(){
  const f = UI.wizardForm;
  if(!f.truckId){ alert('Please select a Truck (it must be Available).'); return; }
  if(!f.origin.trim() || !f.destination.trim()){ alert('Please fill in Origin and Destination.'); return; }
  if(!f.clientName.trim()){ alert('Please enter the Client / Customer Name.'); return; }
  const truck = truckById(f.truckId);
  if(!truck || truck.status!=='Available'){ alert('This truck is not Available right now.'); return; }

  const seq = await nextTripSequence(currentUser.uid);
  const ref = 'TRP-2026-' + pad4(seq);
  const routePlan = [f.origin.trim(), ...UI.wizardCheckpoints, f.destination.trim()];
  const tripData = {
    ref, truckId: truck.id, clientName: f.clientName.trim(),
    origin: f.origin.trim(), destination: f.destination.trim(),
    cargoDesc: f.cargoDesc.trim() || '—', cargoTons: parseFloat(f.cargoTons)||0,
    freightRevenue: parseFloat(f.freightRate)||0,
    departureDate: f.departureDate || todayInput(), estDelivery: f.estDelivery || '',
    routePlan,
    checkpoints:[{location:f.origin.trim(), status:'Departed', timestamp: nowISO(), notes:'Trip dispatched', issueType:''}],
    status:'Departed'
  };
  const tripId = await addDocWithId(tripsRef(currentUser.uid), tripData);
  await updateDocById(trucksRef(currentUser.uid), truck.id, {status:'On-Trip'});
  await addDocWithId(paymentsRef(currentUser.uid), {tripId, amount:tripData.freightRevenue, paidAmount:0, status:'Unpaid', invoiceDate:'', notes:'', entries:[]});

  UI.wizardForm = {truckId:'',clientName:'',origin:'',destination:'',cargoDesc:'',cargoTons:'',freightRate:'',departureDate:'',estDelivery:''};
  UI.wizardCheckpoints = [];
  UI.showWizard = false;
  UI.expandedTripId = tripId;
  render();
}

function toggleTripExpand(id){
  UI.expandedTripId = (UI.expandedTripId===id) ? null : id;
  resetCheckpointForm();
  resetExpenseForm();
  render();
}
function resetCheckpointForm(){ UI.checkpointForm = {location:'', status:'Departed', notes:'', date:'', issueType:''}; UI.checkpointEditIdx = null; }
function resetExpenseForm(){ UI.expenseForm = {category:'Fuel', subtype:'', amount:'', liters:'', station:'', receipt:''}; UI.expenseEditId = null; }
function onExpenseCategoryChange(val){ UI.expenseForm.category=val; UI.expenseForm.subtype=''; render(); }
function onCheckpointStatusChange(val){ UI.checkpointForm.status=val; if(val!=='Delayed / Issue') UI.checkpointForm.issueType=''; render(); }

async function submitCheckpoint(tripId){
  const trip = tripById(tripId);
  const f = UI.checkpointForm;
  const loc = (f.location||'').trim() || trip.destination;
  const entry = {
    location: loc, status: f.status,
    timestamp: fromDatetimeLocalValue(f.date),
    notes: f.notes.trim(),
    issueType: f.status==='Delayed / Issue' ? (f.issueType||'') : ''
  };
  let checkpoints = trip.checkpoints.slice();
  if(UI.checkpointEditIdx!==null && UI.checkpointEditIdx!==undefined){
    checkpoints[UI.checkpointEditIdx] = entry;
  } else {
    checkpoints.push(entry);
  }
  checkpoints.sort((a,b)=> new Date(a.timestamp) - new Date(b.timestamp));
  const status = checkpoints[checkpoints.length-1].status;
  await updateDocById(tripsRef(currentUser.uid), tripId, {checkpoints, status});
  await updateDocById(trucksRef(currentUser.uid), trip.truckId, {status: status==='Delivered' ? 'Available' : 'On-Trip'});
  resetCheckpointForm();
  render();
}
function editCheckpoint(tripId, idx){
  const trip = tripById(tripId);
  const c = trip.checkpoints[idx];
  UI.checkpointForm = {location:c.location, status:c.status, notes:c.notes||'', date:toDatetimeLocalValue(c.timestamp), issueType:c.issueType||''};
  UI.checkpointEditIdx = idx;
  UI.expandedTripId = tripId;
  render();
}
async function deleteCheckpoint(tripId, idx){
  if(!confirm('Delete this location update?')) return;
  const trip = tripById(tripId);
  const checkpoints = trip.checkpoints.slice();
  checkpoints.splice(idx,1);
  const status = checkpoints.length ? checkpoints[checkpoints.length-1].status : 'Departed';
  await updateDocById(tripsRef(currentUser.uid), tripId, {checkpoints, status});
  await updateDocById(trucksRef(currentUser.uid), trip.truckId, {status: status==='Delivered' ? 'Available' : 'On-Trip'});
  if(UI.checkpointEditIdx===idx) resetCheckpointForm();
  render();
}
function cancelCheckpointEdit(){ resetCheckpointForm(); render(); }

async function submitExpense(tripId){
  const f = UI.expenseForm;
  const amt = parseFloat(f.amount);
  if(!amt || amt<=0){ alert('Please enter a valid amount ($).'); return; }
  const record = {
    tripId, category:f.category, subtype:f.subtype||'',
    amount:amt, liters: f.liters?parseFloat(f.liters):null, station:f.station.trim(), receipt:f.receipt.trim()
  };
  if(UI.expenseEditId!==null && UI.expenseEditId!==undefined){
    await updateDocById(expensesRef(currentUser.uid), UI.expenseEditId, record);
  } else {
    record.date = nowISO();
    await addDocWithId(expensesRef(currentUser.uid), record);
  }
  resetExpenseForm();
  render();
}
function editExpense(id){
  const e = DB.expenses.find(x=>x.id===id);
  UI.expenseForm = {category:e.category, subtype:e.subtype||'', amount:String(e.amount), liters:e.liters?String(e.liters):'', station:e.station||'', receipt:e.receipt||''};
  UI.expenseEditId = id;
  render();
}
async function deleteExpense(id){
  if(!confirm('Delete this expense?')) return;
  await deleteDocById(expensesRef(currentUser.uid), id);
  if(UI.expenseEditId===id) resetExpenseForm();
  render();
}
function cancelExpenseEdit(){ resetExpenseForm(); render(); }

function updateTripsSearch(v){ UI.tripsSearch=v; render(); }
function setTripsFilter(v){ UI.tripsFilter=v; render(); }

function renderTrips(){
  const availableTrucks = DB.trucks.filter(t=>t.status==='Available');
  const wf = UI.wizardForm;
  const selectedTruck = wf.truckId ? truckById(wf.truckId) : null;

  let list = DB.trips.slice().sort((a,b)=> new Date(b.departureDate) - new Date(a.departureDate));
  if(UI.tripsFilter==='active') list = list.filter(t=>t.status!=='Delivered');
  if(UI.tripsFilter==='delivered') list = list.filter(t=>t.status==='Delivered');
  if(UI.tripsSearch.trim()){
    const q = UI.tripsSearch.toLowerCase();
    list = list.filter(t=>{
      const truck = truckById(t.truckId);
      return t.ref.toLowerCase().includes(q) || t.origin.toLowerCase().includes(q) || t.destination.toLowerCase().includes(q) || (truck && truck.plate.toLowerCase().includes(q));
    });
  }

  return `
    <datalist id="commonLocations">${COMMON_LOCATIONS.map(l=>`<option value="${esc(l)}">`).join('')}</datalist>
    <div class="page-head">
      <div><h1>Trip Management</h1><div class="sub">${DB.trips.length} trips total · dispatch, track checkpoints, log expenses</div></div>
      <div style="display:flex;gap:8px;">
        <button class="btn btn-ghost" onclick="exportTripsCSV()">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 3v12M7 10l5 5 5-5"/><path d="M5 21h14"/></svg>
          Export CSV
        </button>
        <button class="btn btn-primary" onclick="toggleWizard()">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4"><path d="M12 5v14M5 12h14"/></svg>
          ${UI.showWizard?'Close Wizard':'Create New Trip'}
        </button>
      </div>
    </div>

    ${UI.showWizard ? `
    <div class="form-card">
      <h3>Create New Trip</h3>
      <div class="form-hint">Fill this in from top to bottom — the truck you pick fills in the driver and trailers for you.</div>

      <div class="form-section-label">① Truck &amp; Trip Reference</div>
      <div class="field-row">
        <div class="field">
          <label>Select Truck (Available only) *</label>
          <select onchange="onWizardTruckChange(this.value)">
            <option value="">— choose an available truck —</option>
            ${availableTrucks.map(t=>`<option value="${t.id}" ${wf.truckId===t.id?'selected':''}>${esc(t.plate)} — ${esc(t.model)}</option>`).join('')}
          </select>
          ${availableTrucks.length===0 ? '<div class="hint" style="color:var(--red);">No trucks are currently Available. Free one up or register a new truck first.</div>' : '<div class="hint">Only trucks not already on a trip show up here.</div>'}
        </div>
        <div class="field"><label>Trip Reference</label><input class="mono" value="TRP-2026-${pad4(nextSeqPreview)}" disabled><div class="hint">Generated automatically</div></div>
      </div>

      ${selectedTruck ? `
      <div class="autofill-box">
        <div class="title">✓ Auto-filled from ${esc(selectedTruck.plate)}</div>
        <div class="row"><span>Assigned Driver</span><b>${esc(selectedTruck.driverName)}</b></div>
        <div class="row"><span>Trailer 1</span><b>${esc(selectedTruck.trailer1)}</b></div>
        <div class="row"><span>Trailer 2</span><b>${esc(selectedTruck.trailer2)}</b></div>
      </div>` : ''}

      <div class="form-section-label">② Route</div>
      <div class="field-row">
        <div class="field"><label>Origin *</label><input value="${esc(wf.origin)}" oninput="UI.wizardForm.origin=this.value" placeholder="e.g. Ndola" list="commonLocations"></div>
        <div class="field"><label>Destination *</label><input value="${esc(wf.destination)}" oninput="UI.wizardForm.destination=this.value" placeholder="e.g. Johannesburg, SA" list="commonLocations"></div>
      </div>
      <div class="field">
        <label>Route Checkpoints (border posts or towns in between — optional)</label>
        <div style="display:flex;gap:8px;">
          <input id="cpNameInput" list="commonLocations" oninput="UI.newCheckpointName=this.value" onkeydown="handleCpNameKeydown(event)" value="${esc(UI.newCheckpointName)}" placeholder="Type or pick a border post, then press Enter" style="flex:1;">
          <button type="button" class="btn btn-ghost btn-sm" onclick="addWizardCheckpoint()">+ Add Checkpoint</button>
        </div>
        <div class="hint">Pick from the suggestions or type your own, then press Enter or "Add Checkpoint" — add each stop in the order the truck will pass through it.</div>
      </div>
      ${UI.wizardCheckpoints.length ? `<div style="margin-top:12px;">${UI.wizardCheckpoints.map((c,i)=>`<span class="cp-tag">${i+1}. ${esc(c)}<button onclick="removeWizardCheckpoint(${i})">&times;</button></span>`).join('')}</div>` : `<div class="hint" style="margin-top:8px;">No checkpoints added yet — this trip will only track Origin and Destination unless you add stops above.</div>`}

      <div class="form-section-label">③ Client &amp; Cargo</div>
      <div class="field-row">
        <div class="field"><label>Client / Customer Name *</label><input value="${esc(wf.clientName)}" oninput="UI.wizardForm.clientName=this.value" placeholder="e.g. Zambia Copper Corp"><div class="hint">The company or person who contracted this shipment.</div></div>
        <div class="field"><label>Cargo Description</label><input value="${esc(wf.cargoDesc)}" oninput="UI.wizardForm.cargoDesc=this.value" placeholder="e.g. Copper Cathodes"></div>
      </div>
      <div class="field-row">
        <div class="field"><label>Cargo Weight (Tons)</label><input type="number" value="${esc(wf.cargoTons)}" oninput="UI.wizardForm.cargoTons=this.value" placeholder="e.g. 34"></div>
        <div class="field"><label>Freight Rate ($ USD) *</label><input type="number" value="${esc(wf.freightRate)}" oninput="UI.wizardForm.freightRate=this.value" placeholder="e.g. 5200"><div class="hint">This becomes the invoice amount sent to the client.</div></div>
      </div>
      <div class="field-row">
        <div class="field"><label>Departure Date</label><input type="date" value="${esc(wf.departureDate)}" oninput="UI.wizardForm.departureDate=this.value"></div>
        <div class="field"><label>Estimated Delivery Date</label><input type="date" value="${esc(wf.estDelivery)}" oninput="UI.wizardForm.estDelivery=this.value"></div>
      </div>

      <div class="divider"></div>
      <button class="btn btn-primary" onclick="submitTrip()" ${availableTrucks.length===0?'disabled':''}>Dispatch Trip</button>
    </div>` : ''}

    <div class="toolbar">
      <div class="toolbar-left">
        <span class="chip ${UI.tripsFilter==='all'?'active':''}" onclick="setTripsFilter('all')">All (${DB.trips.length})</span>
        <span class="chip ${UI.tripsFilter==='active'?'active':''}" onclick="setTripsFilter('active')">Active (${DB.trips.filter(t=>t.status!=='Delivered').length})</span>
        <span class="chip ${UI.tripsFilter==='delivered'?'active':''}" onclick="setTripsFilter('delivered')">Delivered (${DB.trips.filter(t=>t.status==='Delivered').length})</span>
      </div>
      <input class="search-box" placeholder="Search trip ref, truck, location…" value="${esc(UI.tripsSearch)}" oninput="updateTripsSearch(this.value)">
    </div>

    <div class="panel">
      <div class="panel-body">
        ${list.length===0 ? '<div class="empty">No trips match this filter.</div>' : list.map(trip=>renderTripRow(trip)).join('')}
      </div>
    </div>`;
}

function renderTripRow(trip){
  const truck = truckById(trip.truckId);
  const expanded = UI.expandedTripId===trip.id;
  const revenue = trip.freightRevenue, expTotal = tripExpenseTotal(trip.id), profit = tripProfit(trip);
  const cf = UI.checkpointForm, ef = UI.expenseForm;

  return `
  <div class="trip-row">
    <div class="trip-row-top">
      <div><span class="trip-id">${trip.ref}</span> · <b>${truck?truck.plate:'—'}</b> · ${esc(trip.origin)} &rarr; ${esc(trip.destination)} · ${esc(trip.cargoDesc)}, ${trip.cargoTons}t</div>
      <div style="display:flex;gap:8px;align-items:center;">
        <span class="badge ${statusColorClass(trip.status)}">${trip.status}</span>
        <button class="btn btn-ghost btn-sm" onclick="toggleTripExpand('${trip.id}')">${expanded?'Hide':'Manage Trip'}</button>
      </div>
    </div>
    ${buildRouteTrack(trip)}
  </div>
  ${expanded ? `
  <div class="trip-detail">
    <div class="detail-stack">

      <div class="detail-card">
        <h3><span class="step-num">1</span>Where is this truck right now?</h3>
        ${trip.status==='Delivered' ? '<div class="route-note" style="border-left-color:var(--green);margin-bottom:14px;">This trip has been marked Delivered — the truck was returned to Available status automatically. You can still edit or delete entries below if something needs correcting.</div>' : ''}
        <table>
          <thead><tr><th>Location</th><th>Status</th><th>Time</th><th>Issue</th><th>Notes</th><th></th></tr></thead>
          <tbody>
            ${trip.checkpoints.map((c,idx)=>`<tr>
              <td>${esc(c.location)}</td>
              <td><span class="badge ${statusColorClass(c.status)}">${c.status}</span></td>
              <td>${fmtDateTime(c.timestamp)}</td>
              <td>${c.issueType?`<span class="badge red">${esc(c.issueType)}</span>`:'—'}</td>
              <td>${esc(c.notes)||'—'}</td>
              <td class="row-actions"><button class="icon-btn" onclick="editCheckpoint('${trip.id}',${idx})" title="Edit">Edit</button><button class="icon-btn danger" onclick="deleteCheckpoint('${trip.id}',${idx})" title="Delete">Delete</button></td>
            </tr>`).join('')}
          </tbody>
        </table>
        <div class="divider"></div>
        <div class="form-hint" style="margin-bottom:14px;">${UI.checkpointEditIdx!==null ? 'Editing an existing location update — change what you need and Save.' : 'Log where the truck is now — since a trip can take several days, log a new update every time it moves. This updates the progress bar and truck status everywhere in the app.'}</div>
        <div class="field-row">
          <div class="field"><label>Current Checkpoint</label>
            <input list="commonLocations" value="${esc(cf.location)}" oninput="UI.checkpointForm.location=this.value" placeholder="Pick from the route or type a location">
            <div class="hint">Route stops: ${trip.routePlan.map(esc).join(' → ')}</div>
          </div>
          <div class="field"><label>Checkpoint Status</label>
            <select onchange="onCheckpointStatusChange(this.value)">
              ${CHECKPOINT_STATUSES.map(s=>`<option ${cf.status===s?'selected':''}>${s}</option>`).join('')}
            </select>
            <div class="hint">Choosing "Delivered" frees this truck back to Available automatically.</div>
          </div>
        </div>
        <div class="field-row">
          <div class="field"><label>Date &amp; Time</label><input type="datetime-local" value="${esc(cf.date || toDatetimeLocalValue())}" oninput="UI.checkpointForm.date=this.value"><div class="hint">Defaults to now — change it if you're logging an update from an earlier day.</div></div>
          ${cf.status==='Delayed / Issue' ? `
          <div class="field"><label>Issue Type</label>
            <select onchange="UI.checkpointForm.issueType=this.value">
              <option value="">— select the type of issue —</option>
              ${ISSUE_TYPES.map(s=>`<option ${cf.issueType===s?'selected':''}>${s}</option>`).join('')}
            </select>
            <div class="hint">Covers breakdowns, and trucks held/detained by police or customs.</div>
          </div>` : `<div></div>`}
        </div>
        <div class="field" style="margin-bottom:16px;"><label>Notes / Remarks</label><textarea rows="2" oninput="UI.checkpointForm.notes=this.value" placeholder="e.g. Customs documents pending, or details of the breakdown / hold-up">${esc(cf.notes)}</textarea></div>
        <div style="display:flex;gap:10px;">
          <button class="btn btn-primary" onclick="submitCheckpoint('${trip.id}')">${UI.checkpointEditIdx!==null ? 'Save Changes' : 'Log Location Update'}</button>
          ${UI.checkpointEditIdx!==null ? `<button class="btn btn-ghost" onclick="cancelCheckpointEdit()">Cancel</button>` : ''}
        </div>
      </div>

      <div class="detail-card">
        <h3><span class="step-num">2</span>Expenses on this trip</h3>
        <div class="expense-cats">
          <div class="exp-cat"><div class="lbl">Dispatch</div><div class="val">${fmt$(tripExpenses(trip.id).filter(e=>e.category==='Dispatch').reduce((s,e)=>s+e.amount,0))}</div></div>
          <div class="exp-cat"><div class="lbl">Fuel</div><div class="val">${fmt$(tripExpenses(trip.id).filter(e=>e.category==='Fuel').reduce((s,e)=>s+e.amount,0))}</div></div>
          <div class="exp-cat"><div class="lbl">Other</div><div class="val">${fmt$(tripExpenses(trip.id).filter(e=>e.category==='Other').reduce((s,e)=>s+e.amount,0))}</div></div>
        </div>
        <table>
          <thead><tr><th>Category</th><th>Detail</th><th>Amount</th><th></th></tr></thead>
          <tbody>
            ${tripExpenses(trip.id).length===0?'<tr><td colspan="4" style="color:var(--ink-soft);">No expenses logged yet — add the first one below.</td></tr>':tripExpenses(trip.id).map(e=>`
              <tr><td>${e.category}</td><td>${esc(e.subtype)||(e.station?esc(e.station)+' · '+e.liters+'L · '+esc(e.receipt):'—')}</td><td>${fmt$(e.amount)}</td>
              <td class="row-actions"><button class="icon-btn" onclick="editExpense('${e.id}')" title="Edit">Edit</button><button class="icon-btn danger" onclick="deleteExpense('${e.id}')" title="Delete">Delete</button></td></tr>
            `).join('')}
          </tbody>
        </table>

        <div class="divider"></div>
        <div class="form-hint" style="margin-bottom:14px;">${UI.expenseEditId!==null ? 'Editing an existing expense — change what you need and Save.' : "Pick a category — the form below adjusts to ask only what's relevant."}</div>
        <div class="field-row">
          <div class="field"><label>Category</label>
            <select onchange="onExpenseCategoryChange(this.value)">
              <option ${ef.category==='Dispatch'?'selected':''}>Dispatch</option>
              <option ${ef.category==='Fuel'?'selected':''}>Fuel</option>
              <option ${ef.category==='Other'?'selected':''}>Other</option>
            </select>
          </div>
          <div class="field"><label>Amount ($ USD) *</label><input type="number" value="${esc(ef.amount)}" oninput="UI.expenseForm.amount=this.value" placeholder="e.g. 80"></div>
        </div>
        ${ef.category==='Dispatch' ? `
        <div class="field" style="margin-bottom:16px;"><label>Type</label>
          <select onchange="UI.expenseForm.subtype=this.value">
            <option value="">— select —</option>
            ${DISPATCH_SUBTYPES.map(s=>`<option ${ef.subtype===s?'selected':''}>${s}</option>`).join('')}
          </select>
        </div>` : ''}
        ${ef.category==='Fuel' ? `
        <div class="field-row">
          <div class="field"><label>Fuel Quantity (Liters)</label><input type="number" value="${esc(ef.liters)}" oninput="UI.expenseForm.liters=this.value" placeholder="e.g. 420"></div>
          <div class="field"><label>Fuel Station Name</label><input value="${esc(ef.station)}" oninput="UI.expenseForm.station=this.value" placeholder="e.g. Chirundu Fuel Stop"></div>
        </div>
        <div class="field" style="margin-bottom:16px;"><label>Receipt Number</label><input value="${esc(ef.receipt)}" oninput="UI.expenseForm.receipt=this.value" placeholder="e.g. FS-2291"></div>` : ''}
        ${ef.category==='Other' ? `
        <div class="field" style="margin-bottom:16px;"><label>Type</label>
          <select onchange="UI.expenseForm.subtype=this.value">
            <option value="">— select —</option>
            ${OTHER_SUBTYPES.map(s=>`<option ${ef.subtype===s?'selected':''}>${s}</option>`).join('')}
          </select>
        </div>` : ''}
        <div style="display:flex;gap:10px;">
          <button class="btn btn-primary" onclick="submitExpense('${trip.id}')">${UI.expenseEditId!==null ? 'Save Changes' : 'Add Expense'}</button>
          ${UI.expenseEditId!==null ? `<button class="btn btn-ghost" onclick="cancelExpenseEdit()">Cancel</button>` : ''}
        </div>

        <div class="profit-bar">
          <span class="lbl">Freight ${fmt$(revenue)} &minus; Expenses ${fmt$(expTotal)}</span>
          <span class="val ${profit>=0?'pos':'neg'}">${fmt$(profit)}</span>
        </div>
      </div>
    </div>
  </div>` : ''}`;
}

/* =========================================================
   TRUCK PORTFOLIO / PROFILE
========================================================= */
function renderProfile(){
  const truck = truckById(UI.profileTruckId);
  if(!truck) return '<div class="empty">Truck not found.</div>';
  const trips = truckTrips(truck.id);
  const currentTrip = trips.find(t=>t.status!=='Delivered');
  const history = trips.filter(t=>t.status==='Delivered');
  const allExpenses = DB.expenses.filter(e=>trips.some(t=>t.id===e.tripId));
  const totalRevenue = trips.reduce((s,t)=>s+t.freightRevenue,0);
  const totalExpense = allExpenses.reduce((s,e)=>s+e.amount,0);
  const roi = totalRevenue - totalExpense;

  return `
    <button class="btn btn-ghost btn-sm" style="margin-bottom:14px;" onclick="setRoute('fleet')">&larr; Back to Fleet</button>
    <div class="profile-header">
      <div>
        <div class="plate mono">${esc(truck.plate)}</div>
        <div class="model">${esc(truck.model)}</div>
        <div class="profile-driver">
          <div class="item">Driver<b>${esc(truck.driverName)}</b></div>
          <div class="item">ID / NRC<b class="mono">${esc(truck.driverId)}</b></div>
          <div class="item">Phone<b class="mono">${esc(truck.driverPhone)}</b></div>
          <div class="item">Trailer 1<b class="mono">${esc(truck.trailer1)}</b></div>
          <div class="item">Trailer 2<b class="mono">${esc(truck.trailer2)}</b></div>
        </div>
      </div>
      <span class="badge ${statusColorClass(truck.status)}" style="font-size:11px;padding:5px 13px;">${truck.status}</span>
    </div>

    <div class="tabs">
      <div class="tab ${UI.profileTab==='current'?'active':''}" onclick="setProfileTab('current')">Current Trip &amp; Route Status</div>
      <div class="tab ${UI.profileTab==='history'?'active':''}" onclick="setProfileTab('history')">Trip History (${history.length})</div>
      <div class="tab ${UI.profileTab==='ledger'?'active':''}" onclick="setProfileTab('ledger')">Expense Ledger</div>
      <div class="tab ${UI.profileTab==='roi'?'active':''}" onclick="setProfileTab('roi')">Financial ROI</div>
    </div>

    <div class="tab-panel">
      ${UI.profileTab==='current' ? renderProfileCurrent(truck, currentTrip) : ''}
      ${UI.profileTab==='history' ? renderProfileHistory(history) : ''}
      ${UI.profileTab==='ledger' ? renderProfileLedger(allExpenses) : ''}
      ${UI.profileTab==='roi' ? renderProfileROI(trips, totalRevenue, totalExpense, roi) : ''}
    </div>`;
}

function renderProfileCurrent(truck, trip){
  if(!trip){
    return `<div class="panel"><div class="empty">No active trip for ${esc(truck.plate)} right now.
      ${truck.status==='Available' ? `<div style="margin-top:10px;"><button class="btn btn-primary btn-sm" onclick="UI.wizardForm.truckId='${truck.id}'; setRoute('trips'); UI.showWizard=true; render();">Dispatch a Trip</button></div>` : ''}
    </div></div>`;
  }
  const last = trip.checkpoints[trip.checkpoints.length-1];
  return `
    <div class="panel" style="padding:18px;">
      <div style="display:flex;justify-content:space-between;margin-bottom:12px;">
        <div><span class="trip-id">${trip.ref}</span> · ${esc(trip.cargoDesc)}, ${trip.cargoTons}t · Freight ${fmt$(trip.freightRevenue)}</div>
        <span class="badge ${statusColorClass(trip.status)}">${trip.status}</span>
      </div>
      ${buildRouteTrack(trip)}
      ${last && last.notes ? `<div class="route-note">${esc(last.notes)} · Expected arrival ${fmtDate(trip.estDelivery)}</div>` : `<div class="route-note">Expected arrival ${fmtDate(trip.estDelivery)}</div>`}
      <div style="margin-top:12px;"><button class="btn btn-ghost btn-sm" onclick="setRoute('trips'); UI.expandedTripId='${trip.id}'; render();">Manage checkpoints &amp; expenses &rarr;</button></div>
    </div>`;
}

function renderProfileHistory(history){
  if(history.length===0) return '<div class="panel"><div class="empty">No completed trips yet.</div></div>';
  return `<div class="panel"><table>
    <thead><tr><th>Trip ID</th><th>Route</th><th>Cargo</th><th>Delivered</th><th>Revenue</th></tr></thead>
    <tbody>${history.map(t=>{
      const delivered = t.checkpoints.find(c=>c.status==='Delivered');
      return `<tr><td class="mono">${t.ref}</td><td>${esc(t.origin)} &rarr; ${esc(t.destination)}</td><td>${esc(t.cargoDesc)}, ${t.cargoTons}t</td><td>${delivered?fmtDate(delivered.timestamp):'—'}</td><td>${fmt$(t.freightRevenue)}</td></tr>`;
    }).join('')}</tbody>
  </table></div>`;
}

function renderProfileLedger(expenses){
  const catTotal = cat => expenses.filter(e=>e.category===cat).reduce((s,e)=>s+e.amount,0);
  return `
    <div class="expense-cats">
      <div class="exp-cat"><div class="lbl">Dispatch / Allowance</div><div class="val">${fmt$(catTotal('Dispatch'))}</div></div>
      <div class="exp-cat"><div class="lbl">Fuel</div><div class="val">${fmt$(catTotal('Fuel'))}</div></div>
      <div class="exp-cat"><div class="lbl">Other</div><div class="val">${fmt$(catTotal('Other'))}</div></div>
    </div>
    <div class="panel"><table>
      <thead><tr><th>Date</th><th>Trip</th><th>Category</th><th>Detail</th><th>Amount</th></tr></thead>
      <tbody>${expenses.length===0?'<tr><td colspan="5" style="color:var(--ink-soft);">No expenses recorded.</td></tr>':expenses.map(e=>{
        const t = tripById(e.tripId);
        return `<tr><td>${fmtDate(e.date)}</td><td class="mono">${t?t.ref:'—'}</td><td>${e.category}</td><td>${esc(e.subtype)||(e.station?esc(e.station)+' · '+e.liters+'L':'—')}</td><td>${fmt$(e.amount)}</td></tr>`;
      }).join('')}</tbody>
    </table></div>`;
}

function renderProfileROI(trips, totalRevenue, totalExpense, roi){
  return `
    <div class="profit-bar" style="margin-top:0;">
      <span class="lbl">Lifetime Net Profit — this truck</span>
      <span class="val ${roi>=0?'pos':'neg'}">${fmt$(roi)}</span>
    </div>
    <div class="panel" style="margin-top:14px;"><table>
      <thead><tr><th>Trip ID</th><th>Route</th><th>Revenue</th><th>Expenses</th><th>Profit</th></tr></thead>
      <tbody>${trips.length===0?'<tr><td colspan="5" style="color:var(--ink-soft);">No trips yet.</td></tr>':trips.map(t=>{
        const exp = tripExpenseTotal(t.id), pr = t.freightRevenue-exp;
        return `<tr><td class="mono">${t.ref}</td><td>${esc(t.origin)} &rarr; ${esc(t.destination)}</td><td>${fmt$(t.freightRevenue)}</td><td>${fmt$(exp)}</td><td style="color:${pr>=0?'var(--green)':'var(--red)'};font-weight:600;">${fmt$(pr)}</td></tr>`;
      }).join('')}</tbody>
    </table></div>`;
}

/* =========================================================
   PAYMENTS MODULE
========================================================= */
function renderPayments(){
  let list = DB.trips.slice().sort((a,b)=> new Date(b.departureDate) - new Date(a.departureDate));
  if(UI.paymentFilter==='Unpaid') list=list.filter(t=>{const p=paymentByTripId(t.id);return !p||p.status==='Unpaid';});
  if(UI.paymentFilter==='Partial') list=list.filter(t=>{const p=paymentByTripId(t.id);return p&&p.status==='Partial';});
  if(UI.paymentFilter==='Paid') list=list.filter(t=>{const p=paymentByTripId(t.id);return p&&p.status==='Paid';});
  const unpaidC=DB.trips.filter(t=>{const p=paymentByTripId(t.id);return !p||p.status==='Unpaid';}).length;
  const partialC=DB.trips.filter(t=>{const p=paymentByTripId(t.id);return p&&p.status==='Partial';}).length;
  const paidC=DB.trips.filter(t=>{const p=paymentByTripId(t.id);return p&&p.status==='Paid';}).length;

  return `
    <div class="page-head">
      <div><h1>Payments &amp; Invoices</h1><div class="sub">Track freight payments per trip — log received amounts and print invoices</div></div>
      <button class="btn btn-ghost" onclick="exportPaymentsCSV()">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 3v12M7 10l5 5 5-5"/><path d="M5 21h14"/></svg>Export CSV
      </button>
    </div>
    <div class="kpi-row">
      <div class="kpi total"><div class="num">${fmt$(totalInvoiced())}</div><div class="lbl">Total Invoiced</div></div>
      <div class="kpi green"><div class="num">${fmt$(totalCollected())}</div><div class="lbl">Collected</div></div>
      <div class="kpi red"><div class="num">${fmt$(totalOutstanding())}</div><div class="lbl">Outstanding</div></div>
      <div class="kpi blue"><div class="num">${paidC}</div><div class="lbl">Fully Paid</div></div>
    </div>
    <div class="toolbar">
      <div class="toolbar-left">
        <span class="chip ${UI.paymentFilter==='all'?'active':''}" onclick="setPaymentFilter('all')">All (${DB.trips.length})</span>
        <span class="chip ${UI.paymentFilter==='Unpaid'?'active':''}" onclick="setPaymentFilter('Unpaid')">Unpaid (${unpaidC})</span>
        <span class="chip ${UI.paymentFilter==='Partial'?'active':''}" onclick="setPaymentFilter('Partial')">Partial (${partialC})</span>
        <span class="chip ${UI.paymentFilter==='Paid'?'active':''}" onclick="setPaymentFilter('Paid')">Paid (${paidC})</span>
      </div>
    </div>
    <div style="display:flex;flex-direction:column;gap:14px;">
      ${list.length===0?'<div class="empty">No trips match this filter.</div>':list.map(trip=>{
        const p=paymentByTripId(trip.id)||{status:'Unpaid',paidAmount:0,amount:trip.freightRevenue,invoiceDate:'',notes:'',entries:[]};
        const truck=truckById(trip.truckId), expTotal=tripExpenseTotal(trip.id), profit=tripProfit(trip), balance=paymentBalance(p,trip);
        const paidPct=p.amount>0?Math.round(p.paidAmount/p.amount*100):0;
        const isLogging=UI.paymentForm.tripId===trip.id;
        return `
        <div class="panel">
          <div style="padding:20px 24px;">
            <div style="display:flex;justify-content:space-between;align-items:flex-start;flex-wrap:wrap;gap:10px;margin-bottom:14px;">
              <div>
                <div style="display:flex;align-items:center;gap:10px;margin-bottom:5px;">
                  <span class="trip-id">${trip.ref}</span>
                  <span class="badge ${paymentStatusColor(p.status)}">${p.status}</span>
                </div>
                <div style="font-size:16px;font-weight:700;">${esc(trip.clientName||'—')}</div>
                <div style="font-size:12.5px;color:var(--ink-soft);margin-top:3px;">${truck?truck.plate:'—'} · ${esc(trip.origin)} → ${esc(trip.destination)} · ${esc(trip.cargoDesc)}, ${trip.cargoTons}t · ${fmtDate(trip.departureDate)}</div>
              </div>
              <div style="text-align:right;flex-shrink:0;">
                <div style="font-size:24px;font-weight:800;color:var(--green);">${fmt$(p.paidAmount)}</div>
                <div style="font-size:12px;color:var(--ink-soft);">of ${fmt$(trip.freightRevenue)} invoiced</div>
              </div>
            </div>
            <div style="background:var(--surface-2);border-radius:20px;height:8px;margin-bottom:6px;overflow:hidden;">
              <div style="height:100%;width:${Math.min(paidPct,100)}%;background:${paidPct>=100?'var(--green)':paidPct>0?'var(--orange)':'var(--line)'};border-radius:20px;"></div>
            </div>
            <div style="display:flex;justify-content:space-between;font-size:11.5px;color:var(--ink-soft);margin-bottom:16px;">
              <span>${paidPct}% received</span>
              <span>Balance: <b style="color:${balance>0?'var(--red)':'var(--green)'};">${fmt$(balance)}</b></span>
            </div>
            <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:10px;margin-bottom:14px;">
              <div class="exp-cat"><div class="lbl">Freight Invoice</div><div class="val" style="font-size:17px;">${fmt$(trip.freightRevenue)}</div></div>
              <div class="exp-cat"><div class="lbl">Trip Expenses</div><div class="val" style="font-size:17px;color:var(--red);">${fmt$(expTotal)}</div></div>
              <div class="exp-cat"><div class="lbl">Net Profit</div><div class="val" style="font-size:17px;color:${profit>=0?'var(--green)':'var(--red)'};">${fmt$(profit)}</div></div>
            </div>
            ${p.entries&&p.entries.length>0?`
            <div style="margin-bottom:14px;">
              <div style="font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:.04em;color:var(--ink-soft);margin-bottom:8px;">Payment History</div>
              ${p.entries.map((e,ei)=>`<div style="display:flex;justify-content:space-between;align-items:center;font-size:12.5px;padding:6px 0;border-bottom:1px solid var(--surface-2);">
                <span style="color:var(--ink-soft);">${fmtDate(e.date)}${e.note?' · '+esc(e.note):''}</span>
                <div style="display:flex;align-items:center;gap:8px;"><b style="color:var(--green);">+${fmt$(e.amount)}</b>
                  <button class="icon-btn danger" onclick="deletePaymentEntry('${trip.id}',${ei})">Delete</button>
                </div>
              </div>`).join('')}
            </div>`:''}
            <div style="display:flex;gap:8px;flex-wrap:wrap;align-items:center;">
              <button class="btn btn-primary btn-sm" onclick="openInvoice('${trip.id}')">View Invoice</button>
              <button class="btn btn-ghost btn-sm" onclick="printInvoice('${trip.id}')">🖨 Print / PDF</button>
              ${p.status!=='Paid'?`<button class="btn btn-ghost btn-sm" onclick="UI.paymentForm={tripId:'${trip.id}',amount:'',note:''}; render();">+ Log Payment</button>`:''}
              ${p.status==='Unpaid'?`<button class="btn btn-ghost btn-sm" onclick="setPaymentStatus('${trip.id}','Partial')">Mark 50% Partial</button>`:''}
              ${p.status!=='Paid'?`<button class="btn btn-ghost btn-sm" onclick="setPaymentStatus('${trip.id}','Paid')">Mark as Paid</button>`:''}
            </div>
            ${isLogging?`
            <div style="margin-top:14px;padding-top:14px;border-top:1px solid var(--line);">
              <div style="font-size:13px;font-weight:600;margin-bottom:10px;">Log Payment Received</div>
              <div class="field-row">
                <div class="field"><label>Amount Received ($)</label><input type="number" value="${esc(UI.paymentForm.amount)}" oninput="UI.paymentForm.amount=this.value" placeholder="e.g. 2600"></div>
                <div class="field"><label>Note (optional)</label><input value="${esc(UI.paymentForm.note)}" oninput="UI.paymentForm.note=this.value" placeholder="e.g. 50% advance via bank transfer"></div>
              </div>
              <div style="display:flex;gap:8px;">
                <button class="btn btn-primary btn-sm" onclick="submitPaymentEntry('${trip.id}')">Save Payment</button>
                <button class="btn btn-ghost btn-sm" onclick="UI.paymentForm={tripId:null,amount:'',note:''}; render();">Cancel</button>
              </div>
            </div>`:''}
          </div>
        </div>`;
      }).join('')}
    </div>`;
}

/* =========================================================
   INVOICE MODAL
========================================================= */
function renderInvoiceModal(tripId){
  const trip=tripById(tripId);
  if(!trip) return '';
  const p=paymentByTripId(tripId)||{status:'Unpaid',paidAmount:0,amount:trip.freightRevenue,invoiceDate:'',entries:[]};
  const truck=truckById(trip.truckId), expTotal=tripExpenseTotal(tripId), expenses=tripExpenses(tripId);
  const balance=paymentBalance(p,trip), invoiceNum='INV-'+pad4(tripId.slice(-4).replace(/\D/g,'') || '0');
  const invoiceDate=p.invoiceDate||todayInput();
  return `
  <div class="invoice-box">
    <button class="invoice-close-btn no-print" onclick="closeInvoice()">✕ Close</button>
    <div class="no-print" style="display:flex;justify-content:space-between;align-items:center;margin-bottom:18px;padding-right:60px;">
      <h2 style="font-size:17px;">Invoice ${invoiceNum}</h2>
      <button class="btn btn-primary btn-sm" onclick="printInvoice('${tripId}')">🖨 Print / Save PDF</button>
    </div>
    <div class="invoice-content">
      <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:22px;">
        <div><div style="font-size:20px;font-weight:800;">TruckManager</div><div style="font-size:12px;color:var(--ink-soft);">Fleet &amp; Cross-Border Logistics</div></div>
        <div style="text-align:right;"><div style="font-size:20px;font-weight:800;color:var(--accent);">INVOICE</div><div class="mono" style="color:var(--ink-soft);">${invoiceNum}</div><div style="font-size:12px;color:var(--ink-soft);">Date: ${fmtDate(invoiceDate)}</div></div>
      </div>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:14px;margin-bottom:20px;">
        <div style="background:var(--surface);border-radius:8px;padding:12px 14px;">
          <div style="font-size:10.5px;font-weight:700;text-transform:uppercase;letter-spacing:.04em;color:var(--ink-soft);margin-bottom:6px;">Billed To</div>
          <div style="font-size:15px;font-weight:700;">${esc(trip.clientName||'—')}</div>
        </div>
        <div style="background:var(--surface);border-radius:8px;padding:12px 14px;font-size:12.5px;">
          <div style="font-size:10.5px;font-weight:700;text-transform:uppercase;letter-spacing:.04em;color:var(--ink-soft);margin-bottom:6px;">Shipment Details</div>
          <div><b>Trip Ref:</b> <span class="mono">${trip.ref}</span></div>
          <div><b>Truck:</b> ${truck?truck.plate:'—'} (${truck?truck.model:'—'})</div>
          <div><b>Driver:</b> ${truck?truck.driverName:'—'}</div>
          <div><b>Route:</b> ${esc(trip.origin)} → ${esc(trip.destination)}</div>
          <div><b>Cargo:</b> ${esc(trip.cargoDesc)}, ${trip.cargoTons}t</div>
          <div><b>Departure:</b> ${fmtDate(trip.departureDate)}</div>
        </div>
      </div>
      <table><thead><tr><th>Description</th><th style="text-align:right;">Amount</th></tr></thead>
      <tbody><tr>
        <td><b>Freight Service</b><br><span style="font-size:12px;color:var(--ink-soft);">${esc(trip.origin)} → ${esc(trip.destination)} · ${trip.cargoTons}t</span></td>
        <td style="text-align:right;font-weight:700;font-size:15px;">${fmt$(trip.freightRevenue)}</td>
      </tr></tbody></table>
      <div style="display:flex;justify-content:flex-end;margin-top:12px;">
        <div style="width:270px;">
          <div style="display:flex;justify-content:space-between;padding:6px 0;font-size:13px;border-bottom:1px solid var(--line);"><span>Subtotal</span><span>${fmt$(trip.freightRevenue)}</span></div>
          <div style="display:flex;justify-content:space-between;padding:6px 0;font-size:13px;color:var(--green);border-bottom:1px solid var(--line);"><span>Amount Received</span><span>−${fmt$(p.paidAmount)}</span></div>
          <div style="display:flex;justify-content:space-between;padding:10px 0;font-size:18px;font-weight:800;border-top:2px solid var(--line);"><span>Balance Due</span><span style="color:${balance>0?'var(--red)':'var(--green)'};">${fmt$(balance)}</span></div>
        </div>
      </div>
      <div style="margin-top:14px;padding:10px 14px;border-radius:8px;background:${p.status==='Paid'?'var(--green-tint)':p.status==='Partial'?'var(--orange-tint)':'var(--red-tint)'};display:flex;justify-content:space-between;align-items:center;">
        <span style="font-weight:600;font-size:13.5px;">Payment Status</span>
        <span class="badge ${paymentStatusColor(p.status)}" style="font-size:11px;">${p.status}</span>
      </div>
      ${expenses.length>0?`
      <div style="margin-top:20px;border-top:1px solid var(--line);padding-top:14px;">
        <div style="font-size:10.5px;font-weight:700;text-transform:uppercase;letter-spacing:.04em;color:var(--ink-soft);margin-bottom:8px;">Trip Expense Breakdown (Internal Record)</div>
        <table style="font-size:12px;">
          <thead><tr><th>Category</th><th>Detail</th><th style="text-align:right;">Amount</th></tr></thead>
          <tbody>
            ${expenses.map(e=>`<tr><td>${e.category}</td><td>${esc(e.subtype)||(e.station?esc(e.station)+(e.liters?' · '+e.liters+'L':''):'—')}</td><td style="text-align:right;">${fmt$(e.amount)}</td></tr>`).join('')}
            <tr><td colspan="2" style="font-weight:700;border-top:2px solid var(--line);">Total Expenses</td><td style="text-align:right;font-weight:700;border-top:2px solid var(--line);">${fmt$(expTotal)}</td></tr>
            <tr><td colspan="2" style="font-weight:700;color:${trip.freightRevenue-expTotal>=0?'var(--green)':'var(--red)'};">Net Profit</td><td style="text-align:right;font-weight:700;color:${trip.freightRevenue-expTotal>=0?'var(--green)':'var(--red)'};">${fmt$(trip.freightRevenue-expTotal)}</td></tr>
          </tbody>
        </table>
      </div>`:''}
      <div style="margin-top:20px;text-align:center;font-size:11.5px;color:var(--ink-soft);">Thank you for your business. For payment queries, contact our accounts department.</div>
    </div>
  </div>`;
}

/* =========================================================
   REPORTS MODULE
========================================================= */
function renderReports(){
  return `
    <div class="page-head"><div><h1>Reports</h1><div class="sub">Full business intelligence — download any section as CSV</div></div></div>
    <div class="tabs">
      <div class="tab ${UI.reportTab==='fleet'?'active':''}" onclick="setReportTab('fleet')">Fleet Report</div>
      <div class="tab ${UI.reportTab==='trips'?'active':''}" onclick="setReportTab('trips')">Trips Report</div>
      <div class="tab ${UI.reportTab==='payments'?'active':''}" onclick="setReportTab('payments')">Payments Report</div>
    </div>
    <div class="tab-panel">
      ${UI.reportTab==='fleet'?renderFleetReport():''}
      ${UI.reportTab==='trips'?renderTripsReport():''}
      ${UI.reportTab==='payments'?renderPaymentsReport():''}
    </div>`;
}

function renderFleetReport(){
  const total=DB.trucks.length, onTrip=DB.trucks.filter(t=>t.status==='On-Trip').length;
  const avail=DB.trucks.filter(t=>t.status==='Available').length, maint=DB.trucks.filter(t=>t.status==='Maintenance').length;
  return `
    <div style="display:flex;justify-content:flex-end;margin-bottom:14px;">
      <button class="btn btn-ghost btn-sm" onclick="exportFleetCSV()">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 3v12M7 10l5 5 5-5"/><path d="M5 21h14"/></svg>Download Fleet CSV
      </button>
    </div>
    <div class="kpi-row">
      <div class="kpi total"><div class="num">${total}</div><div class="lbl">Total Trucks</div></div>
      <div class="kpi blue"><div class="num">${onTrip}</div><div class="lbl">On-Trip</div></div>
      <div class="kpi green"><div class="num">${avail}</div><div class="lbl">Available</div></div>
      <div class="kpi red"><div class="num">${maint}</div><div class="lbl">Maintenance</div></div>
    </div>
    <div class="panel"><table>
      <thead><tr><th>Truck</th><th>Model</th><th>Driver</th><th>Status</th><th>Total Trips</th><th>Revenue Generated</th><th>Issue Note</th></tr></thead>
      <tbody>${DB.trucks.map(t=>{
        const trips=truckTrips(t.id), rev=trips.reduce((s,tr)=>s+tr.freightRevenue,0);
        return `<tr>
          <td class="mono" style="cursor:pointer;color:var(--accent);" onclick="openProfile('${t.id}')">${esc(t.plate)}</td>
          <td>${esc(t.model)}</td><td>${esc(t.driverName)}</td>
          <td><span class="badge ${statusColorClass(t.status)}">${t.status}</span></td>
          <td>${trips.length}</td><td>${fmt$(rev)}</td>
          <td style="font-size:12px;color:${t.maintenanceNote?'var(--orange)':'var(--ink-soft)'};">${esc(t.maintenanceNote)||'—'}</td>
        </tr>`;
      }).join('')}</tbody>
    </table></div>`;
}

function renderTripsReport(){
  const totalRev=DB.trips.reduce((s,t)=>s+t.freightRevenue,0);
  const totalExp=DB.expenses.reduce((s,e)=>s+e.amount,0), totalProfit=totalRev-totalExp;
  return `
    <div style="display:flex;justify-content:flex-end;margin-bottom:14px;">
      <button class="btn btn-ghost btn-sm" onclick="exportTripsCSV()">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 3v12M7 10l5 5 5-5"/><path d="M5 21h14"/></svg>Download Trips CSV
      </button>
    </div>
    <div class="kpi-row">
      <div class="kpi total"><div class="num">${DB.trips.length}</div><div class="lbl">Total Trips</div></div>
      <div class="kpi green"><div class="num">${fmt$(totalRev)}</div><div class="lbl">Total Revenue</div></div>
      <div class="kpi red"><div class="num">${fmt$(totalExp)}</div><div class="lbl">Total Expenses</div></div>
      <div class="kpi blue"><div class="num">${fmt$(totalProfit)}</div><div class="lbl">Net Profit</div></div>
    </div>
    <div class="panel"><table>
      <thead><tr><th>Trip Ref</th><th>Client</th><th>Truck</th><th>Route</th><th>Cargo</th><th>Status</th><th>Revenue</th><th>Expenses</th><th>Profit</th></tr></thead>
      <tbody>${DB.trips.map(t=>{
        const truck=truckById(t.truckId), exp=tripExpenseTotal(t.id), pr=tripProfit(t);
        return `<tr>
          <td class="mono">${t.ref}</td><td style="font-weight:600;">${esc(t.clientName||'—')}</td>
          <td class="mono">${truck?truck.plate:'—'}</td>
          <td style="font-size:12px;">${esc(t.origin)} → ${esc(t.destination)}</td>
          <td style="font-size:12px;">${esc(t.cargoDesc)}, ${t.cargoTons}t</td>
          <td><span class="badge ${statusColorClass(t.status)}">${t.status}</span></td>
          <td>${fmt$(t.freightRevenue)}</td><td>${fmt$(exp)}</td>
          <td style="font-weight:700;color:${pr>=0?'var(--green)':'var(--red)'};">${fmt$(pr)}</td>
        </tr>`;
      }).join('')}</tbody>
    </table></div>`;
}

function renderPaymentsReport(){
  return `
    <div style="display:flex;justify-content:flex-end;margin-bottom:14px;">
      <button class="btn btn-ghost btn-sm" onclick="exportPaymentsCSV()">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 3v12M7 10l5 5 5-5"/><path d="M5 21h14"/></svg>Download Payments CSV
      </button>
    </div>
    <div class="kpi-row">
      <div class="kpi total"><div class="num">${fmt$(totalInvoiced())}</div><div class="lbl">Total Invoiced</div></div>
      <div class="kpi green"><div class="num">${fmt$(totalCollected())}</div><div class="lbl">Collected</div></div>
      <div class="kpi red"><div class="num">${fmt$(totalOutstanding())}</div><div class="lbl">Outstanding</div></div>
      <div class="kpi blue"><div class="num">${DB.payments.filter(p=>p.status==='Paid').length}</div><div class="lbl">Fully Paid</div></div>
    </div>
    <div class="panel"><table>
      <thead><tr><th>Trip Ref</th><th>Client</th><th>Route</th><th>Invoice</th><th>Expenses</th><th>Net Profit</th><th>Received</th><th>Balance</th><th>Status</th><th></th></tr></thead>
      <tbody>${DB.trips.map(t=>{
        const p=paymentByTripId(t.id)||{status:'Unpaid',paidAmount:0,amount:t.freightRevenue,invoiceDate:''};
        const exp=tripExpenseTotal(t.id), pr=tripProfit(t), bal=paymentBalance(p,t);
        return `<tr>
          <td class="mono">${t.ref}</td><td style="font-weight:600;">${esc(t.clientName||'—')}</td>
          <td style="font-size:12px;">${esc(t.origin)} → ${esc(t.destination)}</td>
          <td>${fmt$(t.freightRevenue)}</td><td style="color:var(--red);">${fmt$(exp)}</td>
          <td style="font-weight:600;color:${pr>=0?'var(--green)':'var(--red)'};">${fmt$(pr)}</td>
          <td style="color:var(--green);font-weight:600;">${fmt$(p.paidAmount)}</td>
          <td style="font-weight:600;color:${bal>0?'var(--red)':'var(--green)'};">${fmt$(bal)}</td>
          <td><span class="badge ${paymentStatusColor(p.status)}">${p.status}</span></td>
          <td><button class="icon-btn" onclick="openInvoice('${t.id}')">Invoice</button></td>
        </tr>`;
      }).join('')}</tbody>
    </table></div>`;
}

/* =========================================================
   SETTINGS
========================================================= */
async function saveDisplayName(){
  const name = UI.settingsDisplayName.trim();
  if(!name){ alert('Please enter a display name.'); return; }
  await updateDisplayName(currentUser, name);
  currentUser.displayName = name;
  document.getElementById('topbarUserName').textContent = name;
  document.getElementById('topAvatar').textContent = name.slice(0,2).toUpperCase();
  UI.settingsSaved = true;
  render();
}
function setTheme(theme){
  applyTheme(theme);
  render();
}

function renderSettings(){
  const email = currentUser.email || '—';
  const theme = getTheme();
  return `
    <div class="page-head">
      <div><h1>Settings</h1><div class="sub">Manage your profile and appearance preferences</div></div>
    </div>

    <div class="form-card" style="max-width:560px;">
      <h3>Profile</h3>
      <div class="form-hint">Your login email can't be changed here. Your display name is what teammates see in the app.</div>
      <div class="field" style="margin-bottom:16px;max-width:320px;">
        <label>Email (login)</label>
        <input value="${esc(email)}" disabled>
      </div>
      <div class="field" style="margin-bottom:8px;max-width:280px;">
        <label>Display Name</label>
        <input value="${esc(UI.settingsDisplayName)}" oninput="UI.settingsDisplayName=this.value; UI.settingsSaved=false;" placeholder="e.g. Ops Manager">
      </div>
      <div style="display:flex;align-items:center;gap:12px;margin-top:14px;">
        <button class="btn btn-primary btn-sm" onclick="saveDisplayName()">Save Changes</button>
        ${UI.settingsSaved ? '<span style="font-size:12.5px;color:var(--green);font-weight:600;">Saved ✓</span>' : ''}
      </div>
    </div>

    <div class="form-card" style="max-width:560px;">
      <h3>Appearance</h3>
      <div class="form-hint">Choose how TruckManager looks on this device.</div>
      <div style="display:flex;gap:10px;">
        <button class="btn ${theme==='light'?'btn-primary':'btn-ghost'} btn-sm" onclick="setTheme('light')">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/></svg>
          Light
        </button>
        <button class="btn ${theme==='dark'?'btn-primary':'btn-ghost'} btn-sm" onclick="setTheme('dark')">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 12.79A9 9 0 1111.21 3 7 7 0 0021 12.79z"/></svg>
          Dark
        </button>
      </div>
    </div>`;
}

/* =========================================================
   APP LIFECYCLE (called from main.js on auth state changes)
========================================================= */
export function initApp(user){
  currentUser = user;
  const displayName = user.displayName || (user.email ? user.email.split('@')[0] : 'User');
  document.getElementById('topbarUserName').textContent = displayName;
  document.getElementById('topAvatar').textContent = displayName.slice(0,2).toUpperCase();

  DB.trucks = []; DB.trips = []; DB.expenses = []; DB.payments = [];
  loaded.trucks = loaded.trips = loaded.expenses = loaded.payments = false;
  UI.route = 'dashboard'; UI.profileTruckId = null; UI.expandedTripId = null;

  unsubscribers.push(listenCollection(trucksRef(user.uid), rows => { DB.trucks = rows; loaded.trucks = true; render(); }));
  unsubscribers.push(listenCollection(tripsRef(user.uid), rows => { DB.trips = rows; loaded.trips = true; render(); }));
  unsubscribers.push(listenCollection(expensesRef(user.uid), rows => { DB.expenses = rows; loaded.expenses = true; render(); }));
  unsubscribers.push(listenCollection(paymentsRef(user.uid), rows => { DB.payments = rows; loaded.payments = true; render(); }));
  unsubscribers.push(listenTripCounter(user.uid, seq => { nextSeqPreview = seq; if(UI.route==='trips') render(); }));

  render();
}

export function teardownApp(){
  unsubscribers.forEach(u => u());
  unsubscribers = [];
  currentUser = null;
}

/* Expose functions referenced from inline HTML event handlers (onclick, oninput, ...) */
Object.assign(window, {
  UI, render, setRoute, openProfile, setProfileTab,
  toggleRegisterForm, submitRegisterTruck, setFleetFilter, updateFleetSearch, saveTruckStatus, deleteTruck,
  toggleWizard, onWizardTruckChange, addWizardCheckpoint, removeWizardCheckpoint, handleCpNameKeydown, submitTrip,
  updateTripsSearch, setTripsFilter, toggleTripExpand, editCheckpoint, deleteCheckpoint, onCheckpointStatusChange,
  submitCheckpoint, cancelCheckpointEdit, onExpenseCategoryChange, submitExpense, editExpense, deleteExpense, cancelExpenseEdit,
  exportFleetCSV, exportTripsCSV, exportPaymentsCSV, setPaymentFilter, openInvoice, closeInvoice, printInvoice,
  setPaymentStatus, deletePaymentEntry, submitPaymentEntry, setReportTab,
  saveDisplayName, setTheme
});
