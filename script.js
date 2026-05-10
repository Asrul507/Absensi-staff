// ==========================================
// GENIUS PRESENCE APP - script.js v3.0
// Role-based UI: Admin & Staff
// ==========================================

const SUPA_URL  = ‘https://kuldbrivmpqpoyeilbav.supabase.co’;
const SUPA_ANON = ‘eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imt1bGRicml2bXBxcG95ZWlsYmF2Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzgzOTI4NDMsImV4cCI6MjA5Mzk2ODg0M30.je9yMizaJs5OJ4yuaxnw2vwPeGy1F_0j75SMU1IZZso’;

// ==========================================
// SUPABASE HELPER
// ==========================================
async function sb(table, method = ‘GET’, body = null, query = ‘’) {
const url = `${SUPA_URL}/rest/v1/${table}${query}`;
const opts = {
method,
headers: {
‘Content-Type’: ‘application/json’,
‘apikey’: SUPA_ANON,
‘Authorization’: `Bearer ${SUPA_ANON}`,
‘Prefer’: ‘return=representation’,
},
};
if (body) opts.body = JSON.stringify(body);
const res = await fetch(url, opts);
const txt = await res.text();
if (!res.ok) {
let msg = `HTTP ${res.status}`;
try { const e = JSON.parse(txt); msg = e.message || e.hint || e.details || msg; } catch(_) {}
console.error(’[SB Error]’, res.status, txt);
throw new Error(msg);
}
return txt ? JSON.parse(txt) : [];
}

// ==========================================
// STATE
// ==========================================
let currentUser   = null;
let currentPage   = ‘’;
let cameraStream  = null;
let capturedB64   = null;
let absenMode     = null;
let userLat = null, userLng = null;
let todayAbsen    = null;
let todayJadwal   = null;
let clockInterval = null;
let allShifts     = [];
let allUsers      = [];
let rekapData     = [];
let importRows    = [];
let importBulan   = ‘’;

const isadmin = () => currentUser?.role === ‘admin’;
const enc     = (s) => encodeURIComponent(s);
const todayStr= () => new Date().toLocaleDateString(‘sv-SE’);

// ==========================================
// INIT
// ==========================================
document.addEventListener(‘DOMContentLoaded’, () => {
const saved = localStorage.getItem(‘genius_user’);
if (saved) { currentUser = JSON.parse(saved); showApp(); }
});

// ==========================================
// AUTH
// ==========================================
async function login() {
const email = document.getElementById(‘username’).value.trim();
const pass  = document.getElementById(‘password’).value;
if (!email || !pass) { toast(‘Isi email dan password’, ‘error’); return; }
showLoading();
try {
const rows = await sb(‘users’, ‘GET’, null, `?email=eq.${enc(email)}&select=*`);
if (!rows.length) { toast(‘Email tidak ditemukan’, ‘error’); return; }
const u = rows[0];
if (u.password !== pass) { toast(‘Password salah’, ‘error’); return; }
if (u.status_akun === ‘Nonaktif’) { toast(‘Akun nonaktif, hubungi admin’, ‘error’); return; }
currentUser = u;
localStorage.setItem(‘genius_user’, JSON.stringify(currentUser));
showApp();
} catch(e) {
toast(’Error: ’ + e.message, ‘error’);
} finally { hideLoading(); }
}

function logout() {
if (!confirm(‘Yakin ingin keluar?’)) return;
localStorage.removeItem(‘genius_user’);
currentUser = null;
if (clockInterval) clearInterval(clockInterval);
document.getElementById(‘loginPage’).style.display = ‘flex’;
document.getElementById(‘appPage’).style.display   = ‘none’;
document.getElementById(‘username’).value = ‘’;
document.getElementById(‘password’).value = ‘’;
}

// ==========================================
// APP SHELL
// ==========================================
function showApp() {
document.getElementById(‘loginPage’).style.display = ‘none’;
document.getElementById(‘appPage’).style.display   = ‘block’;
document.getElementById(‘userName’).textContent = currentUser.nama_lengkap.split(’ ’)[0];
buildSidebar();
buildBottomNav();
navigateTo(‘dashboard’);
}

// ––––– SIDEBAR –––––
function buildSidebar() {
const u = currentUser;
let nav = ‘’;
if (isadmin()) {
nav = ` <div class="sidebar-divider">ADMIN PANEL</div> <a class="sidebar-link" data-page="dashboard" onclick="go('dashboard')"><i class="fa-solid fa-gauge"></i> Dashboard</a> <a class="sidebar-link" data-page="rekap" onclick="go('rekap')"><i class="fa-solid fa-chart-bar"></i> Rekap Absensi</a> <a class="sidebar-link" data-page="kelola-jadwal" onclick="go('kelola-jadwal')"><i class="fa-solid fa-table"></i> Kelola Jadwal</a> <a class="sidebar-link" data-page="kelola-shift" onclick="go('kelola-shift')"><i class="fa-solid fa-clock"></i> Master Shift</a> <a class="sidebar-link" data-page="kelola-user" onclick="go('kelola-user')"><i class="fa-solid fa-users"></i> Karyawan</a> <a class="sidebar-link" data-page="approve-pengajuan" onclick="go('approve-pengajuan')"><i class="fa-solid fa-check-to-slot"></i> Approve Izin/Cuti</a> <div class="sidebar-divider">AKUN</div> <a class="sidebar-link" data-page="profil" onclick="go('profil')"><i class="fa-solid fa-user"></i> Profil</a>`;
} else {
nav = ` <div class="sidebar-divider">MENU</div> <a class="sidebar-link" data-page="dashboard" onclick="go('dashboard')"><i class="fa-solid fa-house"></i> Dashboard</a> <a class="sidebar-link" data-page="riwayat-absensi" onclick="go('riwayat-absensi')"><i class="fa-solid fa-fingerprint"></i> Riwayat Absensi</a> <a class="sidebar-link" data-page="jadwal-saya" onclick="go('jadwal-saya')"><i class="fa-solid fa-calendar-days"></i> Jadwal Saya</a> <a class="sidebar-link" data-page="pengajuan" onclick="go('pengajuan')"><i class="fa-solid fa-file-medical"></i> Pengajuan</a> <div class="sidebar-divider">AKUN</div> <a class="sidebar-link" data-page="profil" onclick="go('profil')"><i class="fa-solid fa-user"></i> Profil</a>`;
}
document.getElementById(‘sidebar’).innerHTML = ` <div class="sidebar-header"> <div class="sidebar-logo">🏢</div> <div><div class="sidebar-title">GENIUS</div><div class="sidebar-sub">Living Plaza Balikpapan</div></div> </div> <div class="sidebar-user"> <div class="sidebar-avatar"><i class="fa-solid fa-user"></i></div> <div> <div class="sidebar-name">${u.nama_lengkap}</div> <div class="sidebar-role">${u.role}</div> </div> </div> <div class="sidebar-nav">${nav}</div> <button class="sidebar-logout" onclick="logout()"><i class="fa-solid fa-right-from-bracket"></i> Keluar</button>`;
}

// ––––– BOTTOM NAV –––––
function buildBottomNav() {
const items = isadmin()
? [
{ page:‘dashboard’,         icon:‘fa-gauge’,          label:‘Home’   },
{ page:‘rekap’,             icon:‘fa-chart-bar’,      label:‘Rekap’  },
{ page:‘kelola-jadwal’,     icon:‘fa-table’,          label:‘Jadwal’ },
{ page:‘approve-pengajuan’, icon:‘fa-check-to-slot’,  label:‘Izin’   },
{ page:‘kelola-user’,       icon:‘fa-users’,          label:‘User’   },
]
: [
{ page:‘dashboard’,       icon:‘fa-house’,         label:‘Home’    },
{ page:‘riwayat-absensi’, icon:‘fa-fingerprint’,   label:‘Absensi’ },
{ page:‘jadwal-saya’,     icon:‘fa-calendar-days’, label:‘Jadwal’  },
{ page:‘pengajuan’,       icon:‘fa-file-medical’,  label:‘Izin’    },
{ page:‘profil’,          icon:‘fa-user’,          label:‘Profil’  },
];
document.getElementById(‘bottomNav’).innerHTML = items.map(i => ` <button class="nav-item${currentPage===i.page?' active':''}" onclick="navigateTo('${i.page}')"> <i class="fa-solid ${i.icon}"></i><span>${i.label}</span> </button>`).join(’’);
}

function go(page) { closeSidebar(); navigateTo(page); }

function toggleSidebar() {
document.getElementById(‘sidebar’).classList.toggle(‘open’);
document.getElementById(‘overlay’).classList.toggle(‘show’);
}
function closeSidebar() {
document.getElementById(‘sidebar’).classList.remove(‘open’);
document.getElementById(‘overlay’).classList.remove(‘show’);
}

async function navigateTo(page) {
currentPage = page;
buildBottomNav();
document.querySelectorAll(’.sidebar-link’).forEach(a =>
a.classList.toggle(‘active’, a.dataset.page === page));
document.getElementById(‘content’).innerHTML =
`<div class="loading-state"><i class="fa-solid fa-spinner fa-spin"></i> Memuat...</div>`;

const routes = {
‘dashboard’:          isadmin() ? renderDashboardadmin : renderDashboardStaff,
‘rekap’:              renderRekap,
‘kelola-jadwal’:      renderKelolaJadwal,
‘kelola-shift’:       renderKelolaShift,
‘kelola-user’:        renderKelolaUser,
‘approve-pengajuan’:  renderApprovePengajuan,
‘riwayat-absensi’:    renderRiwayatAbsensi,
‘jadwal-saya’:        renderJadwalSaya,
‘pengajuan’:          renderPengajuan,
‘profil’:             renderProfil,
};
if (routes[page]) await routes[page]();
else document.getElementById(‘content’).innerHTML =
`<div class="empty-state"><i class="fa-solid fa-circle-question"></i><p>Halaman tidak ditemukan</p></div>`;
}

// ==========================================
// CLOCK
// ==========================================
function startClock() {
if (clockInterval) clearInterval(clockInterval);
const tick = () => {
const el = document.getElementById(‘clock-display’);
if (!el) { clearInterval(clockInterval); return; }
el.textContent = new Date().toLocaleTimeString(‘id-ID’);
};
tick();
clockInterval = setInterval(tick, 1000);
}

// ==========================================
// DASHBOARD STAFF
// ==========================================
async function renderDashboardStaff() {
const today = todayStr();
try {
const [[j], [a]] = await Promise.all([
sb(‘jadwal’,‘GET’,null,`?nama=eq.${enc(currentUser.nama_lengkap)}&tanggal=eq.${today}&select=*`),
sb(‘absensi’,‘GET’,null,`?nama=eq.${enc(currentUser.nama_lengkap)}&tanggal=eq.${today}&select=*`),
]);
todayJadwal = j || null;
todayAbsen  = a || null;

```
const [mon, sun] = weekRange();
const week = await sb('absensi','GET',null,
  `?nama=eq.${enc(currentUser.nama_lengkap)}&tanggal=gte.${mon}&tanggal=lte.${sun}&select=*`);

const hadir = week.filter(x=>x.waktu_masuk).length;
const telat  = week.filter(x=>x.status_masuk==='Terlambat').length;
const sm = !!todayAbsen?.waktu_masuk;
const sp = !!todayAbsen?.waktu_pulang;
const wm = sm ? fmtTime(todayAbsen.waktu_masuk)  : '--:--';
const wp = sp ? fmtTime(todayAbsen.waktu_pulang) : '--:--';

document.getElementById('content').innerHTML = `
  <div class="card" style="background:linear-gradient(135deg,#1e3a8a,#1d4ed8,#0369a1);border:none;margin-bottom:12px;">
    <div style="font-size:12px;opacity:.75;margin-bottom:4px;">${fmtDateLong(today)}</div>
    <div id="clock-display" style="font-size:30px;font-weight:800;letter-spacing:2px;margin-bottom:4px;">--:--:--</div>
    <div style="font-size:13px;opacity:.8;">Halo, <b>${currentUser.nama_lengkap.split(' ')[0]}</b> 👋</div>
  </div>

  ${todayJadwal
    ? `<div class="shift-info-bar"><i class="fa-solid fa-rotate"></i>
        <span>Shift <b>${todayJadwal.nama_shift}</b> &nbsp;·&nbsp; ${fmtTime(todayJadwal.jam_masuk)} – ${fmtTime(todayJadwal.jam_pulang)}</span>
       </div>`
    : `<div class="shift-info-bar" style="background:rgba(234,179,8,.08);border-color:rgba(234,179,8,.3);color:#fbbf24;">
        <i class="fa-solid fa-triangle-exclamation"></i>&nbsp; Tidak ada jadwal shift hari ini
       </div>`}

  <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-bottom:12px;">
    <button class="btn-absensi" onclick="${sm?'':\"openAbsen('masuk')\"}"
      style="${sm?'background:linear-gradient(135deg,#059669,#047857);cursor:default;':''}">
      <i class="fa-solid fa-${sm?'circle-check':'right-to-bracket'}"></i>
      <span style="font-size:13px;">${sm?'✓ Masuk '+wm:'Absen Masuk'}</span>
    </button>
    <button class="btn-absensi" onclick="${sp?'':\"openAbsen('pulang')\"}"
      ${!sm?'disabled':''} style="${sp?'background:linear-gradient(135deg,#d97706,#b45309);cursor:default;':!sm?'opacity:.4;cursor:not-allowed;':'background:linear-gradient(135deg,#dc2626,#b91c1c);'}">
      <i class="fa-solid fa-${sp?'circle-check':'right-from-bracket'}"></i>
      <span style="font-size:13px;">${sp?'✓ Pulang '+wp:'Absen Pulang'}</span>
    </button>
  </div>

  ${todayAbsen ? `
  <div class="card" style="margin-bottom:12px;">
    <h3 style="margin-bottom:12px;"><i class="fa-solid fa-circle-info" style="color:#60a5fa"></i> Status Absen Hari Ini</h3>
    <div style="display:flex;gap:10px;">
      <div class="status-tile ${sm?'done':'pending'}">
        <i class="fa-solid fa-arrow-right-to-bracket"></i>
        <div class="status-tile-label">Masuk</div>
        <div style="font-size:20px;font-weight:800;margin:4px 0;">${wm}</div>
        ${statusBadge(todayAbsen.status_masuk)}
        ${todayAbsen.ket_telat?`<div class="ket-telat-badge" style="margin-top:6px;font-size:11px;"><i class="fa-solid fa-clock"></i> ${todayAbsen.ket_telat}</div>`:''}
      </div>
      <div class="status-tile ${sp?'done':'locked'}">
        <i class="fa-solid fa-arrow-right-from-bracket"></i>
        <div class="status-tile-label">Pulang</div>
        <div style="font-size:20px;font-weight:800;margin:4px 0;">${wp}</div>
        ${todayAbsen.status_pulang?statusBadge(todayAbsen.status_pulang):'<div style="font-size:12px;color:#475569;">Belum pulang</div>'}
      </div>
    </div>
  </div>` : ''}

  <div class="stats-grid">
    <div class="stat-card green"><div class="stat-icon"><i class="fa-solid fa-calendar-check"></i></div><div class="stat-val">${hadir}</div><div class="stat-label">Hadir Minggu Ini</div></div>
    <div class="stat-card red"><div class="stat-icon"><i class="fa-solid fa-clock"></i></div><div class="stat-val">${telat}</div><div class="stat-label">Terlambat</div></div>
    <div class="stat-card blue"><div class="stat-icon"><i class="fa-solid fa-calendar-week"></i></div><div class="stat-val">${week.length}</div><div class="stat-label">Total Shift</div></div>
  </div>

  <div class="card">
    <h3><i class="fa-solid fa-file-medical" style="color:#60a5fa"></i> Pengajuan Cepat</h3>
    <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:8px;">
      <button class="btn-outline" onclick="bukaModal('Izin')" style="flex-direction:column;gap:4px;padding:12px 8px;text-align:center;justify-content:center;">
        <i class="fa-solid fa-file-lines" style="font-size:20px;"></i><span style="font-size:11px;">Izin</span>
      </button>
      <button class="btn-outline" onclick="bukaModal('Sakit')" style="flex-direction:column;gap:4px;padding:12px 8px;text-align:center;justify-content:center;border-color:rgba(239,68,68,.4);color:#f87171;">
        <i class="fa-solid fa-notes-medical" style="font-size:20px;"></i><span style="font-size:11px;">Sakit</span>
      </button>
      <button class="btn-outline" onclick="bukaModal('Cuti')" style="flex-direction:column;gap:4px;padding:12px 8px;text-align:center;justify-content:center;border-color:rgba(16,185,129,.4);color:#34d399;">
        <i class="fa-solid fa-umbrella-beach" style="font-size:20px;"></i><span style="font-size:11px;">Cuti</span>
      </button>
    </div>
  </div>`;
startClock();
```

} catch(e) { document.getElementById(‘content’).innerHTML = errHtml(e.message); }
}

function bukaModal(tipe) {
document.getElementById(‘pengajuan-tipe’).value = tipe;
document.getElementById(‘pengajuan-ket’).value  = ‘’;
document.getElementById(‘pengajuan-link’).value = ‘’;
document.getElementById(‘modal-pengajuan’).classList.add(‘show’);
}

// ==========================================
// DASHBOARD ADMIN
// ==========================================
async function renderDashboardadmin() {
const today = todayStr();
const [y,m]  = today.split(’-’);
const from   = `${y}-${m}-01`;
const lastD  = new Date(y,m,0).getDate();
const to     = `${y}-${m}-${String(lastD).padStart(2,'0')}`;
try {
const [absenHari, users, pending] = await Promise.all([
sb(‘absensi’,‘GET’,null,`?tanggal=eq.${today}&select=*`),
sb(‘users’,‘GET’,null,`?status_akun=eq.Aktif&select=id_karyawan,nama_lengkap,role`),
sb(‘pengajuan’,‘GET’,null,`?status_approve=eq.Pending&select=*`),
]);
const absenBulan = await sb(‘absensi’,‘GET’,null,`?tanggal=gte.${from}&tanggal=lte.${to}&select=waktu_masuk,status_masuk`);

```
const totalStaff   = users.length;
const hadirHari    = absenHari.filter(a=>a.waktu_masuk).length;
const telatHari    = absenHari.filter(a=>a.status_masuk==='Terlambat').length;
const izinPending  = pending.length;
const hadirBulan   = absenBulan.filter(a=>a.waktu_masuk).length;
const telatBulan   = absenBulan.filter(a=>a.status_masuk==='Terlambat').length;
const hadirNama    = new Set(absenHari.filter(a=>a.waktu_masuk).map(a=>a.nama));
const belumAbsen   = users.filter(u=>!hadirNama.has(u.nama_lengkap));

document.getElementById('content').innerHTML = `
  <div class="card" style="background:linear-gradient(135deg,#1e3a8a,#1d4ed8);border:none;margin-bottom:12px;">
    <div style="font-size:12px;opacity:.7;">${fmtDateLong(today)}</div>
    <div id="clock-display" style="font-size:24px;font-weight:800;margin:4px 0;">--:--:--</div>
    <div style="font-size:13px;opacity:.8;">admin · <b>${currentUser.nama_lengkap.split(' ')[0]}</b></div>
  </div>

  <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-bottom:12px;">
    <div class="card" style="margin-bottom:0;text-align:center;">
      <div style="font-size:10px;color:#64748b;font-weight:700;text-transform:uppercase;margin-bottom:4px;">Hadir Hari Ini</div>
      <div style="font-size:38px;font-weight:800;color:#34d399;line-height:1;">${hadirHari}</div>
      <div style="font-size:12px;color:#475569;margin-top:4px;">dari ${totalStaff} karyawan</div>
    </div>
    <div class="card" style="margin-bottom:0;text-align:center;">
      <div style="font-size:10px;color:#64748b;font-weight:700;text-transform:uppercase;margin-bottom:4px;">Izin Pending</div>
      <div style="font-size:38px;font-weight:800;color:#fbbf24;line-height:1;">${izinPending}</div>
      <div style="font-size:12px;color:#475569;margin-top:4px;">perlu disetujui</div>
    </div>
    <div class="card" style="margin-bottom:0;text-align:center;">
      <div style="font-size:10px;color:#64748b;font-weight:700;text-transform:uppercase;margin-bottom:4px;">Terlambat Hari Ini</div>
      <div style="font-size:38px;font-weight:800;color:#f87171;line-height:1;">${telatHari}</div>
      <div style="font-size:12px;color:#475569;margin-top:4px;">orang</div>
    </div>
    <div class="card" style="margin-bottom:0;text-align:center;">
      <div style="font-size:10px;color:#64748b;font-weight:700;text-transform:uppercase;margin-bottom:4px;">Hadir Bulan Ini</div>
      <div style="font-size:38px;font-weight:800;color:#60a5fa;line-height:1;">${hadirBulan}</div>
      <div style="font-size:12px;color:#475569;margin-top:4px;">${telatBulan} terlambat</div>
    </div>
  </div>

  <div class="card" style="margin-bottom:12px;">
    <h3><i class="fa-solid fa-bolt" style="color:#fbbf24"></i> Aksi Cepat</h3>
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;">
      <button class="btn-primary" onclick="navigateTo('kelola-jadwal')"><i class="fa-solid fa-table"></i> Atur Jadwal</button>
      <button class="btn-primary" onclick="navigateTo('rekap')"><i class="fa-solid fa-chart-bar"></i> Rekap Absensi</button>
      <button class="btn-primary" onclick="navigateTo('approve-pengajuan')"
        style="${izinPending?'background:linear-gradient(135deg,#d97706,#b45309);':''}">
        <i class="fa-solid fa-check-to-slot"></i> Approve Izin
        ${izinPending?`<span style="background:rgba(255,255,255,.25);border-radius:20px;padding:1px 8px;font-size:11px;">${izinPending}</span>`:''}
      </button>
      <button class="btn-primary" onclick="navigateTo('kelola-user')"><i class="fa-solid fa-users"></i> Kelola User</button>
    </div>
  </div>

  ${belumAbsen.length ? `
  <div class="card" style="margin-bottom:12px;">
    <h3><i class="fa-solid fa-user-clock" style="color:#f87171"></i> Belum Absen Hari Ini (${belumAbsen.length})</h3>
    ${belumAbsen.map(u=>`
    <div class="user-card" style="margin-bottom:8px;">
      <div class="user-avatar"><i class="fa-solid fa-user"></i></div>
      <div class="user-info"><div class="user-nama">${u.nama_lengkap}</div><div class="user-email">${u.role}</div></div>
    </div>`).join('')}
  </div>` : `
  <div class="card">
    <h3><i class="fa-solid fa-circle-check" style="color:#34d399"></i> Semua Karyawan Sudah Absen 🎉</h3>
    <p style="color:#64748b;font-size:13px;">Semua ${totalStaff} karyawan aktif telah absen hari ini.</p>
  </div>`}

  <div class="card">
    <h3><i class="fa-solid fa-list" style="color:#60a5fa"></i> Absen Masuk Hari Ini</h3>
    ${absenHari.filter(a=>a.waktu_masuk).length===0
      ? `<div class="empty-state" style="padding:20px;"><i class="fa-solid fa-inbox"></i><p>Belum ada absen masuk</p></div>`
      : `<div class="card-list">${absenHari.filter(a=>a.waktu_masuk)
          .sort((a,b)=>a.waktu_masuk.localeCompare(b.waktu_masuk))
          .map(a=>`
        <div class="absensi-card">
          <div class="absensi-foto-placeholder"><i class="fa-solid fa-user"></i></div>
          <div class="absensi-card-body">
            <div class="absensi-nama">${a.nama}</div>
            <div class="absensi-waktu"><i class="fa-solid fa-clock"></i> Masuk ${fmtTime(a.waktu_masuk)}${a.waktu_pulang?' · Pulang '+fmtTime(a.waktu_pulang):''}</div>
            <div class="absensi-info">${a.nama_shift||'-'}</div>
          </div>
          <span class="absensi-badge ${a.status_masuk==='Tepat Waktu'?'success':'warning'}">${a.status_masuk||'-'}</span>
        </div>`).join('')}</div>`}
  </div>`;
startClock();
```

} catch(e) { document.getElementById(‘content’).innerHTML = errHtml(e.message); }
}

// ==========================================
// ABSEN — KAMERA & GPS
// ==========================================
async function openAbsen(mode) {
absenMode   = mode;
capturedB64 = null;
document.getElementById(‘modal-absen-title’).textContent = mode===‘masuk’?‘📸 Absen Masuk’:‘📸 Absen Pulang’;
document.getElementById(‘foto-preview-box’).style.display  = ‘none’;
document.getElementById(‘camera-container’).style.display  = ‘block’;
document.getElementById(‘absen-actions’).style.display     = ‘flex’;
document.getElementById(‘absen-confirm-actions’).style.display = ‘none’;
document.getElementById(‘lokasi-info’).className = ‘gps-status loading’;
document.getElementById(‘lokasi-info’).innerHTML = ‘<i class="fa-solid fa-spinner fa-spin"></i> Mengambil lokasi…’;
document.getElementById(‘modal-absen’).classList.add(‘show’);

try {
cameraStream = await navigator.mediaDevices.getUserMedia({ video:{ facingMode:‘user’ }, audio:false });
document.getElementById(‘camera-video’).srcObject = cameraStream;
} catch(e) { toast(’Kamera tidak bisa diakses: ’+e.message,‘error’); }

navigator.geolocation?.getCurrentPosition(
pos => {
userLat = pos.coords.latitude.toFixed(6);
userLng = pos.coords.longitude.toFixed(6);
document.getElementById(‘lokasi-info’).className = ‘gps-status success’;
document.getElementById(‘lokasi-info’).innerHTML = `<i class="fa-solid fa-location-dot"></i> ${userLat}, ${userLng}`;
},
() => {
userLat = null; userLng = null;
document.getElementById(‘lokasi-info’).className = ‘gps-status error’;
document.getElementById(‘lokasi-info’).innerHTML = ‘<i class="fa-solid fa-triangle-exclamation"></i> Lokasi tidak tersedia’;
}
);
}

function closeModalAbsen() { document.getElementById(‘modal-absen’).classList.remove(‘show’); stopCamera(); }
function stopCamera() { if(cameraStream){ cameraStream.getTracks().forEach(t=>t.stop()); cameraStream=null; } }

function ambilFoto() {
const v = document.getElementById(‘camera-video’);
const c = document.getElementById(‘camera-canvas’);
c.width=v.videoWidth||320; c.height=v.videoHeight||240;
c.getContext(‘2d’).drawImage(v,0,0);
capturedB64 = c.toDataURL(‘image/jpeg’,0.7);
document.getElementById(‘foto-preview’).src = capturedB64;
document.getElementById(‘foto-preview-box’).style.display  = ‘block’;
document.getElementById(‘camera-container’).style.display  = ‘none’;
document.getElementById(‘absen-actions’).style.display     = ‘none’;
document.getElementById(‘absen-confirm-actions’).style.display = ‘flex’;
stopCamera();
}

async function retakeFoto() {
capturedB64 = null;
document.getElementById(‘foto-preview-box’).style.display  = ‘none’;
document.getElementById(‘camera-container’).style.display  = ‘block’;
document.getElementById(‘absen-actions’).style.display     = ‘flex’;
document.getElementById(‘absen-confirm-actions’).style.display = ‘none’;
try {
cameraStream = await navigator.mediaDevices.getUserMedia({ video:{ facingMode:‘user’ }, audio:false });
document.getElementById(‘camera-video’).srcObject = cameraStream;
} catch(e) {}
}

async function submitAbsen() {
const now     = new Date();
const timeStr = now.toTimeString().slice(0,8);
const today   = todayStr();
showLoading();
try {
let jdw = todayJadwal;
if (!jdw) {
const r = await sb(‘jadwal’,‘GET’,null,`?nama=eq.${enc(currentUser.nama_lengkap)}&tanggal=eq.${today}&select=*`);
jdw = r[0]||null;
}
if (absenMode===‘masuk’) {
const ex = await sb(‘absensi’,‘GET’,null,`?nama=eq.${enc(currentUser.nama_lengkap)}&tanggal=eq.${today}&select=id`);
if (ex.length) { toast(‘Sudah absen masuk hari ini’,‘error’); closeModalAbsen(); return; }
let status=‘Tepat Waktu’, ket=’’;
if (jdw?.jam_masuk) {
const [jh,jm] = jdw.jam_masuk.split(’:’).map(Number);
const nowM = now.getHours()*60+now.getMinutes();
const jdwM = jh*60+jm;
if (nowM > jdwM+10) { status=‘Terlambat’; ket=`Terlambat ${nowM-jdwM} menit`; }
}
await sb(‘absensi’,‘POST’,{
nama:currentUser.nama_lengkap, tanggal:today,
waktu_masuk:timeStr, lat_masuk:userLat, lng_masuk:userLng,
foto_masuk:capturedB64, status_masuk:status, ket_telat:ket,
shift_id:jdw?.shift_id||null, nama_shift:jdw?.nama_shift||null,
});
toast(`Absen masuk berhasil · ${status}`,‘success’);
} else {
const ex = await sb(‘absensi’,‘GET’,null,`?nama=eq.${enc(currentUser.nama_lengkap)}&tanggal=eq.${today}&select=id`);
if (!ex.length) { toast(‘Absen masuk belum ada’,‘error’); closeModalAbsen(); return; }
let sp=‘Normal’;
if (jdw?.jam_pulang) {
const [jh,jm] = jdw.jam_pulang.split(’:’).map(Number);
if (now.getHours()*60+now.getMinutes() < jh*60+jm-10) sp=‘Pulang Awal’;
}
await sb(`absensi?id=eq.${ex[0].id}`,‘PATCH’,{
waktu_pulang:timeStr, lat_pulang:userLat, lng_pulang:userLng,
foto_pulang:capturedB64, status_pulang:sp,
});
toast(‘Absen pulang berhasil!’,‘success’);
}
closeModalAbsen();
await navigateTo(‘dashboard’);
} catch(e) { toast(’Gagal absen: ’+e.message,‘error’); }
finally { hideLoading(); }
}

// ==========================================
// RIWAYAT ABSENSI (Staff — hanya miliknya)
// ==========================================
async function renderRiwayatAbsensi() {
const def = new Date().toISOString().slice(0,7);
document.getElementById(‘content’).innerHTML = ` <div class="page-header-row"><h2><i class="fa-solid fa-fingerprint"></i> Riwayat Absensi Saya</h2></div> <div class="card" style="padding:12px;margin-bottom:12px;"> <label style="font-size:11px;color:#64748b;font-weight:700;display:block;margin-bottom:6px;">PILIH BULAN</label> <input type="month" id="ab-bulan" value="${def}" onchange="loadRiwayatAbsensi()" style="width:100%;${inputStyle()}"> </div> <div id="riwayat-content"><div class="loading-state"><i class="fa-solid fa-spinner fa-spin"></i></div></div>`;
await loadRiwayatAbsensi();
}

async function loadRiwayatAbsensi() {
const bulan = document.getElementById(‘ab-bulan’)?.value; if(!bulan) return;
const [y,m] = bulan.split(’-’);
const from=`${y}-${m}-01`, to=`${y}-${m}-${String(new Date(y,m,0).getDate()).padStart(2,'0')}`;
const cont = document.getElementById(‘riwayat-content’);
cont.innerHTML=`<div class="loading-state"><i class="fa-solid fa-spinner fa-spin"></i></div>`;
try {
const list = await sb(‘absensi’,‘GET’,null,
`?nama=eq.${enc(currentUser.nama_lengkap)}&tanggal=gte.${from}&tanggal=lte.${to}&order=tanggal.desc&select=*`);
const hadir=list.filter(a=>a.waktu_masuk).length;
const telat=list.filter(a=>a.status_masuk===‘Terlambat’).length;
const pulang=list.filter(a=>a.waktu_pulang).length;

```
cont.innerHTML = `
  <div class="stats-grid" style="margin-bottom:12px;">
    <div class="stat-card green"><div class="stat-icon"><i class="fa-solid fa-calendar-check"></i></div><div class="stat-val">${hadir}</div><div class="stat-label">Hadir</div></div>
    <div class="stat-card red"><div class="stat-icon"><i class="fa-solid fa-clock"></i></div><div class="stat-val">${telat}</div><div class="stat-label">Terlambat</div></div>
    <div class="stat-card blue"><div class="stat-icon"><i class="fa-solid fa-right-from-bracket"></i></div><div class="stat-val">${pulang}</div><div class="stat-label">Pulang</div></div>
  </div>
  ${!list.length ? emptyHtml('Tidak ada data absensi bulan ini') :
    list.map(a=>`
    <div class="riwayat-card">
      <div class="riwayat-tanggal">
        <i class="fa-solid fa-calendar-day"></i> ${fmtDateLong(a.tanggal)}
        ${statusBadge(a.status_masuk)}
        ${a.ket_telat?`<span class="ket-telat-mini"><i class="fa-solid fa-clock"></i> ${a.ket_telat}</span>`:''}
      </div>
      <div class="riwayat-rows">
        <div class="riwayat-row">
          <div class="riwayat-tipe masuk"><i class="fa-solid fa-arrow-right-to-bracket"></i> Masuk</div>
          <div class="riwayat-detail">
            <div class="riwayat-waktu">${a.waktu_masuk?fmtTime(a.waktu_masuk):'—'}</div>
            ${a.lat_masuk?`<a class="riwayat-lokasi" href="https://maps.google.com/?q=${a.lat_masuk},${a.lng_masuk}" target="_blank"><i class="fa-solid fa-location-dot"></i> Peta</a>`:''}
          </div>
        </div>
        <div class="riwayat-row">
          <div class="riwayat-tipe pulang"><i class="fa-solid fa-arrow-right-from-bracket"></i> Pulang</div>
          <div class="riwayat-detail">
            <div class="riwayat-waktu">${a.waktu_pulang?fmtTime(a.waktu_pulang):'—'}</div>
            ${a.lat_pulang?`<a class="riwayat-lokasi" href="https://maps.google.com/?q=${a.lat_pulang},${a.lng_pulang}" target="_blank"><i class="fa-solid fa-location-dot"></i> Peta</a>`:''}
          </div>
        </div>
      </div>
    </div>`).join('')}`;
```

} catch(e) { cont.innerHTML=errHtml(e.message); }
}

// ==========================================
// JADWAL SAYA (Staff — hanya namanya sendiri)
// ==========================================
async function renderJadwalSaya() {
const def = new Date().toISOString().slice(0,7);
document.getElementById(‘content’).innerHTML = ` <div class="page-header-row"><h2><i class="fa-solid fa-calendar-days"></i> Jadwal Saya</h2></div> <div class="card" style="padding:12px;margin-bottom:12px;"> <label style="font-size:11px;color:#64748b;font-weight:700;display:block;margin-bottom:6px;">PILIH BULAN</label> <input type="month" id="jd-bulan" value="${def}" onchange="loadJadwalSaya()" style="width:100%;${inputStyle()}"> </div> <div id="jadwal-content"><div class="loading-state"><i class="fa-solid fa-spinner fa-spin"></i></div></div>`;
await loadJadwalSaya();
}

async function loadJadwalSaya() {
const bulan = document.getElementById(‘jd-bulan’)?.value; if(!bulan) return;
const [y,m] = bulan.split(’-’);
const from=`${y}-${m}-01`, to=`${y}-${m}-${String(new Date(y,m,0).getDate()).padStart(2,'0')}`;
const cont = document.getElementById(‘jadwal-content’);
cont.innerHTML=`<div class="loading-state"><i class="fa-solid fa-spinner fa-spin"></i></div>`;
try {
const list = await sb(‘jadwal’,‘GET’,null,
`?nama=eq.${enc(currentUser.nama_lengkap)}&tanggal=gte.${from}&tanggal=lte.${to}&order=tanggal.asc&select=*`);
if (!list.length) { cont.innerHTML=emptyHtml(‘Tidak ada jadwal bulan ini’); return; }
const today=todayStr();
cont.innerHTML=`<div class="card" style="padding:8px 0;"> ${list.map(j=>{ const isToday=j.tanggal===today, isPast=j.tanggal<today; const d=new Date(j.tanggal+'T00:00:00'); const c=shiftColor(j.nama_shift); return `
<div class="jadwal-item${isToday?' jadwal-today':isPast?' jadwal-past':''}">
<div class="jadwal-tgl">
<div class="jadwal-tgl-num" style="color:${isToday?'#60a5fa':'#e2e8f0'}">${d.getDate()}</div>
<div class="jadwal-tgl-hari">${d.toLocaleDateString(‘id-ID’,{weekday:‘short’})}</div>
</div>
<div class="jadwal-shift-badge" style="background:${c.bg};color:${c.text};">
<i class="fa-solid fa-clock"></i> ${j.nama_shift||‘Shift’}
</div>
<div class="jadwal-jam">
<span><i class="fa-solid fa-arrow-right-to-bracket"></i> ${fmtTime(j.jam_masuk)}</span>
<span><i class="fa-solid fa-arrow-right-from-bracket"></i> ${fmtTime(j.jam_pulang)}</span>
</div>
${isToday?’<span class="jadwal-today-badge">HARI INI</span>’:’’}
</div>`}).join('')} </div>`;
} catch(e) { cont.innerHTML=errHtml(e.message); }
}

// ==========================================
// PENGAJUAN (Staff)
// ==========================================
async function renderPengajuan() {
try {
const list = await sb(‘pengajuan’,‘GET’,null,
`?nama_karyawan=eq.${enc(currentUser.nama_lengkap)}&order=tgl_submit.desc&select=*`);
document.getElementById(‘content’).innerHTML = ` <div class="page-header-row"> <h2><i class="fa-solid fa-file-medical"></i> Pengajuan Saya</h2> <button class="btn-primary btn-sm" onclick="bukaModal('Izin')"><i class="fa-solid fa-plus"></i> Ajukan</button> </div> <div style="display:flex;gap:8px;margin-bottom:12px;"> <button class="btn-outline btn-sm" onclick="bukaModal('Izin')" style="flex:1;justify-content:center;"><i class="fa-solid fa-file-lines"></i> Izin</button> <button class="btn-outline btn-sm" onclick="bukaModal('Sakit')" style="flex:1;justify-content:center;border-color:rgba(239,68,68,.4);color:#f87171;"><i class="fa-solid fa-notes-medical"></i> Sakit</button> <button class="btn-outline btn-sm" onclick="bukaModal('Cuti')" style="flex:1;justify-content:center;border-color:rgba(16,185,129,.4);color:#34d399;"><i class="fa-solid fa-umbrella-beach"></i> Cuti</button> </div> ${!list.length ? emptyHtml('Belum ada pengajuan') : list.map(p=>cardPengajuan(p,false)).join('')}`;
} catch(e) { document.getElementById(‘content’).innerHTML=errHtml(e.message); }
}

function openModalPengajuan() { bukaModal(‘Izin’); }
function closeModalPengajuan() { document.getElementById(‘modal-pengajuan’).classList.remove(‘show’); }

async function submitPengajuan() {
const payload = {
nama_karyawan: currentUser.nama_lengkap,
tipe_izin:     document.getElementById(‘pengajuan-tipe’).value,
keterangan:    document.getElementById(‘pengajuan-ket’).value.trim(),
link_surat_sakit: document.getElementById(‘pengajuan-link’).value.trim()||null,
status_approve:‘Pending’,
};
if (!payload.keterangan) { toast(‘Isi keterangan terlebih dahulu’,‘error’); return; }
showLoading();
try {
await sb(‘pengajuan’,‘POST’,payload);
toast(‘Pengajuan berhasil dikirim!’,‘success’);
closeModalPengajuan();
if (currentPage===‘pengajuan’) await renderPengajuan();
} catch(e) { toast(’Gagal: ’+e.message,‘error’); }
finally { hideLoading(); }
}

function cardPengajuan(p, adminView) {
const sc={Pending:‘warning’,Disetujui:‘success’,Ditolak:‘danger’}[p.status_approve]||’’;
const icon={Izin:‘fa-file-lines’,Sakit:‘fa-notes-medical’,Cuti:‘fa-umbrella-beach’}[p.tipe_izin]||‘fa-file’;
return `

  <div class="pengajuan-card">
    <div class="pengajuan-header">
      <div>
        ${adminView?`<div style="font-size:14px;font-weight:700;margin-bottom:2px;">${p.nama_karyawan}</div>`:''}
        <div class="pengajuan-tipe"><i class="fa-solid ${icon}"></i> ${p.tipe_izin}</div>
      </div>
      <span class="status-badge ${sc}">${p.status_approve}</span>
    </div>
    <div class="pengajuan-ket">${p.keterangan||'-'}</div>
    ${p.link_surat_sakit?`<a class="btn-link" href="${p.link_surat_sakit}" target="_blank" style="margin-bottom:6px;display:inline-flex;"><i class="fa-solid fa-link"></i> Lihat Surat/Foto</a>`:''}
    <div class="pengajuan-footer">
      <span style="font-size:12px;color:#475569;"><i class="fa-regular fa-clock"></i> ${fmtDateTime(p.tgl_submit)}</span>
      ${adminView&&p.status_approve==='Pending'?`
      <div class="approve-actions">
        <button class="btn-approve" onclick="approvePengajuan(${p.id_pengajuan},'Disetujui')"><i class="fa-solid fa-check"></i> Setujui</button>
        <button class="btn-reject"  onclick="approvePengajuan(${p.id_pengajuan},'Ditolak')"><i class="fa-solid fa-xmark"></i> Tolak</button>
      </div>`:''}
    </div>
  </div>`;
}

// ==========================================
// REKAP ABSENSI (Admin)
// ==========================================
async function renderRekap() {
const today=todayStr(); const [y,m]=today.split(’-’);
document.getElementById(‘content’).innerHTML = ` <div class="page-header-row"> <h2><i class="fa-solid fa-chart-bar"></i> Rekap Absensi</h2> <button class="btn-outline btn-sm" onclick="exportRekap()"><i class="fa-solid fa-file-excel"></i> Export CSV</button> </div> <div class="card" style="padding:14px;margin-bottom:12px;"> <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-bottom:8px;"> <div> <label style="font-size:10px;color:#64748b;font-weight:700;display:block;margin-bottom:4px;">BULAN</label> <input type="month" id="rek-bulan" value="${y}-${m}" style="${inputStyle()}" onchange="syncRekap()"> </div> <div> <label style="font-size:10px;color:#64748b;font-weight:700;display:block;margin-bottom:4px;">SHIFT</label> <select id="rek-shift" style="width:100%;${selectStyle()}"><option value="">Semua Shift</option></select> </div> </div> <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-bottom:8px;"> <div> <label style="font-size:10px;color:#64748b;font-weight:700;display:block;margin-bottom:4px;">DARI</label> <input type="date" id="rek-dari" style="${inputStyle()}"> </div> <div> <label style="font-size:10px;color:#64748b;font-weight:700;display:block;margin-bottom:4px;">SAMPAI</label> <input type="date" id="rek-sampai" style="${inputStyle()}"> </div> </div> <input type="text" id="rek-cari" placeholder="🔍 Cari nama karyawan..." oninput="loadRekap()" style="width:100%;${inputStyle()}margin-bottom:8px;"> <button class="btn-primary full" onclick="loadRekap()"><i class="fa-solid fa-magnifying-glass"></i> Tampilkan Rekap</button> </div> <div id="rekap-content"><div class="loading-state"><i class="fa-solid fa-spinner fa-spin"></i></div></div>`;

await loadShiftSelect(‘rek-shift’);
const fd=`${y}-${m}-01`, ld=`${y}-${m}-${String(new Date(y,m,0).getDate()).padStart(2,'0')}`;
document.getElementById(‘rek-dari’).value   = fd;
document.getElementById(‘rek-sampai’).value = ld;
await loadRekap();
}

function syncRekap() {
const b=document.getElementById(‘rek-bulan’).value; if(!b) return;
const [y,m]=b.split(’-’);
document.getElementById(‘rek-dari’).value   = `${y}-${m}-01`;
document.getElementById(‘rek-sampai’).value = `${y}-${m}-${String(new Date(y,m,0).getDate()).padStart(2,'0')}`;
loadRekap();
}

async function loadRekap() {
const dari   = document.getElementById(‘rek-dari’)?.value;
const sampai = document.getElementById(‘rek-sampai’)?.value;
const cari   = (document.getElementById(‘rek-cari’)?.value||’’).toLowerCase();
const shiftF = document.getElementById(‘rek-shift’)?.value||’’;
if (!dari||!sampai) return;
const cont = document.getElementById(‘rekap-content’);
cont.innerHTML=`<div class="loading-state"><i class="fa-solid fa-spinner fa-spin"></i></div>`;
try {
let q=`?tanggal=gte.${dari}&tanggal=lte.${sampai}&order=tanggal.desc,nama.asc&select=*`;
if (shiftF) q+=`&nama_shift=eq.${enc(shiftF)}`;
let list = await sb(‘absensi’,‘GET’,null,q);
if (cari) list=list.filter(a=>a.nama.toLowerCase().includes(cari));
rekapData=list;
if (!list.length) { cont.innerHTML=emptyHtml(‘Tidak ada data untuk filter ini’); return; }

```
// Ringkasan per karyawan
const byName={};
list.forEach(a=>{
  if(!byName[a.nama]) byName[a.nama]={hadir:0,telat:0,pulang:0,lupaP:0};
  if(a.waktu_masuk) byName[a.nama].hadir++;
  if(a.status_masuk==='Terlambat') byName[a.nama].telat++;
  if(a.waktu_pulang) byName[a.nama].pulang++;
  if(a.waktu_masuk&&!a.waktu_pulang) byName[a.nama].lupaP++;
});

const maxH=Math.max(...Object.values(byName).map(x=>x.hadir),1);

cont.innerHTML=`
  <!-- KPI -->
  <div class="import-stats-row">
    <div class="import-stat-box blue"><div class="import-stat-num">${list.length}</div><div class="import-stat-lab">Total Data</div></div>
    <div class="import-stat-box green"><div class="import-stat-num">${list.filter(a=>a.waktu_masuk).length}</div><div class="import-stat-lab">Hadir</div></div>
    <div class="import-stat-box red"><div class="import-stat-num">${list.filter(a=>a.status_masuk==='Terlambat').length}</div><div class="import-stat-lab">Terlambat</div></div>
    <div class="import-stat-box teal"><div class="import-stat-num">${list.filter(a=>a.status_pulang==='Pulang Awal').length}</div><div class="import-stat-lab">Pulang Awal</div></div>
  </div>

  <!-- Grafik -->
  <div class="card" style="margin-bottom:12px;">
    <h3><i class="fa-solid fa-chart-bar" style="color:#60a5fa"></i> Grafik Kehadiran per Karyawan</h3>
    ${Object.entries(byName).sort((a,b)=>b[1].hadir-a[1].hadir).map(([nama,s])=>`
    <div style="margin-bottom:12px;">
      <div style="display:flex;justify-content:space-between;font-size:12px;margin-bottom:4px;">
        <span style="font-weight:600;">${nama}</span>
        <span style="color:#64748b;">${s.hadir} hadir · <span style="color:#f87171;">${s.telat} telat</span></span>
      </div>
      <div style="background:rgba(255,255,255,.06);border-radius:20px;height:10px;overflow:hidden;">
        <div style="height:100%;width:${Math.round(s.hadir/maxH*100)}%;background:linear-gradient(90deg,#3b82f6,#06b6d4);border-radius:20px;"></div>
      </div>
    </div>`).join('')}
  </div>

  <!-- Tabel Ringkasan -->
  <div class="card" style="margin-bottom:12px;">
    <h3><i class="fa-solid fa-users" style="color:#34d399"></i> Ringkasan per Karyawan</h3>
    <div style="overflow-x:auto;">
      <table style="width:100%;border-collapse:collapse;font-size:12px;min-width:360px;">
        <thead><tr style="background:rgba(255,255,255,.04);">
          <th style="padding:8px 10px;text-align:left;color:#64748b;">Nama</th>
          <th style="padding:8px 10px;text-align:center;color:#34d399;">Hadir</th>
          <th style="padding:8px 10px;text-align:center;color:#f87171;">Telat</th>
          <th style="padding:8px 10px;text-align:center;color:#60a5fa;">Pulang</th>
          <th style="padding:8px 10px;text-align:center;color:#fbbf24;">Lupa Pulang</th>
        </tr></thead>
        <tbody>${Object.entries(byName).map(([n,s])=>`
        <tr style="border-top:1px solid rgba(255,255,255,.04);">
          <td style="padding:8px 10px;font-weight:600;">${n}</td>
          <td style="padding:8px 10px;text-align:center;"><span class="status-badge success">${s.hadir}</span></td>
          <td style="padding:8px 10px;text-align:center;"><span class="status-badge danger">${s.telat}</span></td>
          <td style="padding:8px 10px;text-align:center;"><span class="status-badge" style="background:rgba(59,130,246,.14);color:#60a5fa;">${s.pulang}</span></td>
          <td style="padding:8px 10px;text-align:center;"><span class="status-badge warning">${s.lupaP}</span></td>
        </tr>`).join('')}
        </tbody>
      </table>
    </div>
  </div>

  <!-- Detail -->
  <div class="card">
    <h3><i class="fa-solid fa-list" style="color:#a78bfa"></i> Detail (${list.length} data)</h3>
    <div style="overflow-x:auto;">
      <table style="width:100%;border-collapse:collapse;font-size:12px;min-width:480px;">
        <thead><tr style="background:rgba(255,255,255,.04);">
          <th style="padding:8px 10px;text-align:left;color:#64748b;">Tanggal</th>
          <th style="padding:8px 10px;text-align:left;color:#64748b;">Nama</th>
          <th style="padding:8px 10px;text-align:left;color:#64748b;">Shift</th>
          <th style="padding:8px 10px;text-align:center;color:#64748b;">Masuk</th>
          <th style="padding:8px 10px;text-align:center;color:#64748b;">Pulang</th>
          <th style="padding:8px 10px;text-align:center;color:#64748b;">Status</th>
        </tr></thead>
        <tbody>${list.map(a=>`
        <tr style="border-top:1px solid rgba(255,255,255,.04);">
          <td style="padding:7px 10px;color:#94a3b8;white-space:nowrap;">${fmtDate(a.tanggal)}</td>
          <td style="padding:7px 10px;font-weight:600;">${a.nama}</td>
          <td style="padding:7px 10px;">${a.nama_shift||'-'}</td>
          <td style="padding:7px 10px;text-align:center;">${a.waktu_masuk?fmtTime(a.waktu_masuk):'—'}</td>
          <td style="padding:7px 10px;text-align:center;">${a.waktu_pulang?fmtTime(a.waktu_pulang):'—'}</td>
          <td style="padding:7px 10px;text-align:center;">${statusBadge(a.status_masuk)}</td>
        </tr>`).join('')}
        </tbody>
      </table>
    </div>
  </div>`;
```

} catch(e) { cont.innerHTML=errHtml(e.message); }
}

function exportRekap() {
if (!rekapData.length) { toast(‘Tidak ada data’,‘error’); return; }
const hdr=[‘Tanggal’,‘Nama’,‘Shift’,‘Masuk’,‘Pulang’,‘Status Masuk’,‘Status Pulang’,‘Ket Telat’,‘Lat Masuk’,‘Lng Masuk’];
const rows=rekapData.map(a=>[a.tanggal,a.nama,a.nama_shift||’’,a.waktu_masuk||’’,a.waktu_pulang||’’,
a.status_masuk||’’,a.status_pulang||’’,a.ket_telat||’’,a.lat_masuk||’’,a.lng_masuk||’’]);
dlCSV([hdr,…rows],`rekap_absensi_${Date.now()}.csv`);
toast(‘Export berhasil!’,‘success’);
}

// ==========================================
// KELOLA JADWAL (Admin) — Manual + Import CSV
// ==========================================
async function renderKelolaJadwal() {
const today=todayStr(); const [y,m]=today.split(’-’);
document.getElementById(‘content’).innerHTML = `
<div class="page-header-row"><h2><i class="fa-solid fa-table"></i> Kelola Jadwal</h2></div>
<div style="display:flex;gap:8px;margin-bottom:14px;">
<button id="tab-manual" class="btn-primary btn-sm" onclick="switchTab('manual')"><i class="fa-solid fa-pen"></i> Input Manual</button>
<button id="tab-import" class="btn-outline btn-sm" onclick="switchTab('import')"><i class="fa-solid fa-upload"></i> Import CSV</button>
</div>

```
<!-- PANEL MANUAL -->
<div id="panel-manual">
  <div class="card" style="padding:14px;margin-bottom:12px;">
    <h3 style="margin-bottom:12px;"><i class="fa-solid fa-pen" style="color:#60a5fa"></i> Pilih Karyawan & Bulan</h3>
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-bottom:8px;">
      <div>
        <label style="font-size:10px;color:#64748b;font-weight:700;display:block;margin-bottom:4px;">BULAN</label>
        <input type="month" id="kj-bulan" value="${y}-${m}" style="${inputStyle()}">
      </div>
      <div>
        <label style="font-size:10px;color:#64748b;font-weight:700;display:block;margin-bottom:4px;">KARYAWAN</label>
        <select id="kj-user" style="width:100%;${selectStyle()}"><option value="">Pilih Karyawan</option></select>
      </div>
    </div>
    <button class="btn-primary full" onclick="loadGridJadwal()"><i class="fa-solid fa-table"></i> Tampilkan Grid</button>
  </div>
  <div id="kj-grid"></div>
</div>

<!-- PANEL IMPORT -->
<div id="panel-import" style="display:none;">
  <!-- Panduan -->
  <div class="card import-guide" style="margin-bottom:12px;">
    <h3><i class="fa-solid fa-circle-info" style="color:#60a5fa"></i> Cara Import Jadwal dari Excel/CSV</h3>
    <ol>
      <li>Download template CSV sesuai bulan yang dipilih</li>
      <li>Buka dengan Excel / Google Sheets</li>
      <li>Isi kolom tanggal (01–31) dengan <b>nama shift persis</b> sesuai master shift (misal: <b>Pagi</b>, <b>Sore</b>, <b>Malam</b>) atau kosongkan untuk libur</li>
      <li>Save as <b>CSV</b>, lalu upload di bawah</li>
    </ol>
    <div class="import-format-box">
      <table class="import-table-preview">
        <thead><tr><th>Nama</th><th>01</th><th>02</th><th>03</th><th>...</th><th>31</th></tr></thead>
        <tbody>
          <tr><td>Budi Santoso</td><td><span class="shift-chip pagi">Pagi</span></td><td><span class="shift-chip sore">Sore</span></td><td><span class="shift-chip libur">Libur</span></td><td style="color:#475569;">...</td><td><span class="shift-chip malam">Malam</span></td></tr>
          <tr><td>Siti Aisyah</td><td><span class="shift-chip malam">Malam</span></td><td><span class="shift-chip pagi">Pagi</span></td><td><span class="shift-chip pagi">Pagi</span></td><td style="color:#475569;">...</td><td><span class="shift-chip libur">Libur</span></td></tr>
        </tbody>
      </table>
    </div>
    <p class="import-tip"><i class="fa-solid fa-lightbulb" style="color:#fbbf24"></i> Nama karyawan di CSV harus <b>sama persis</b> dengan data di sistem (termasuk huruf besar/kecil).</p>
  </div>

  <!-- Download template + Upload -->
  <div class="card" style="padding:14px;margin-bottom:12px;">
    <h3 style="margin-bottom:12px;"><i class="fa-solid fa-download" style="color:#34d399"></i> Step 1 — Download Template</h3>
    <div style="display:flex;gap:8px;align-items:flex-end;flex-wrap:wrap;margin-bottom:16px;">
      <div style="flex:1;min-width:140px;">
        <label style="font-size:10px;color:#64748b;font-weight:700;display:block;margin-bottom:4px;">BULAN</label>
        <input type="month" id="imp-bulan" value="${y}-${m}" style="${inputStyle()}">
      </div>
      <button class="btn-success" onclick="downloadTemplate()" style="height:40px;white-space:nowrap;">
        <i class="fa-solid fa-download"></i> Download Template CSV
      </button>
    </div>

    <h3 style="margin-bottom:12px;"><i class="fa-solid fa-upload" style="color:#a78bfa"></i> Step 2 — Upload File CSV</h3>
    <div onclick="document.getElementById('imp-file').click()"
      style="border:2px dashed rgba(255,255,255,.15);border-radius:12px;padding:24px;text-align:center;cursor:pointer;transition:.2s;"
      onmouseover="this.style.borderColor='rgba(59,130,246,.5)'" onmouseout="this.style.borderColor='rgba(255,255,255,.15)'">
      <i class="fa-solid fa-file-csv" style="font-size:40px;color:#64748b;display:block;margin-bottom:10px;"></i>
      <p style="color:#64748b;font-size:13px;margin-bottom:8px;">Klik untuk memilih file CSV</p>
      <p style="color:#475569;font-size:11px;">Format: .csv (dari Excel Save As CSV)</p>
    </div>
    <input type="file" id="imp-file" accept=".csv" style="display:none;" onchange="previewCSV()">
    <div id="imp-preview" style="margin-top:12px;"></div>
  </div>
</div>`;
```

await Promise.all([loadUserSelect(‘kj-user’), ensureShifts()]);
}

function switchTab(tab) {
document.getElementById(‘panel-manual’).style.display = tab===‘manual’?’’:‘none’;
document.getElementById(‘panel-import’).style.display = tab===‘import’?’’:‘none’;
document.getElementById(‘tab-manual’).className = tab===‘manual’?‘btn-primary btn-sm’:‘btn-outline btn-sm’;
document.getElementById(‘tab-import’).className = tab===‘import’?‘btn-primary btn-sm’:‘btn-outline btn-sm’;
}

// –– GRID MANUAL ––
async function loadGridJadwal() {
const bulan = document.getElementById(‘kj-bulan’)?.value;
const nama  = document.getElementById(‘kj-user’)?.value;
const area  = document.getElementById(‘kj-grid’);
if (!bulan) { area.innerHTML=emptyHtml(‘Pilih bulan’); return; }
if (!nama)  { area.innerHTML=emptyHtml(‘Pilih karyawan’); return; }
const [y,m] = bulan.split(’-’);
const lastD = new Date(y,m,0).getDate();
const from=`${y}-${m}-01`, to=`${y}-${m}-${String(lastD).padStart(2,'0')}`;
area.innerHTML=`<div class="loading-state"><i class="fa-solid fa-spinner fa-spin"></i></div>`;
try {
await ensureShifts();
const existing = await sb(‘jadwal’,‘GET’,null,`?nama=eq.${enc(nama)}&tanggal=gte.${from}&tanggal=lte.${to}&select=*`);
const jdwMap={}; existing.forEach(j=>{ jdwMap[j.tanggal]=j; });
const today=todayStr();
const shiftOpts=[’<option value="">— Libur —</option>’,…allShifts.map(s=>`<option value="${s.id}">${s.nama_shift}</option>`)].join(’’);
const days=Array.from({length:lastD},(_,i)=>`${y}-${m}-${String(i+1).padStart(2,'0')}`);

```
area.innerHTML=`
  <div class="card" style="padding:14px;">
    <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:14px;flex-wrap:wrap;gap:8px;">
      <h3 style="margin:0;"><i class="fa-solid fa-calendar-days" style="color:#60a5fa"></i>
        ${nama} — ${new Date(y,m-1).toLocaleDateString('id-ID',{month:'long',year:'numeric'})}</h3>
      <button class="btn-primary btn-sm" onclick="saveGrid('${nama}','${y}','${m}',${lastD})">
        <i class="fa-solid fa-save"></i> Simpan Jadwal
      </button>
    </div>
    <div class="jadwal-grid">
      ${days.map(tgl=>{
        const d=new Date(tgl+'T00:00:00');
        const num=d.getDate(), hari=d.toLocaleDateString('id-ID',{weekday:'short'});
        const isMinggu=d.getDay()===0, isToday=tgl===today;
        return `
        <div class="jadwal-grid-item${isToday?' today':''}${isMinggu?' minggu':''}">
          <div class="jadwal-grid-tgl">
            <span class="jadwal-grid-num" style="${isToday?'color:#60a5fa;':''}">${num}</span>
            <span class="jadwal-grid-hari">${hari}</span>
          </div>
          <select class="jadwal-grid-sel" id="sel-${tgl}">${shiftOpts}</select>
        </div>`;
      }).join('')}
    </div>
  </div>`;

// Set nilai dari data existing
days.forEach(tgl=>{ const sel=document.getElementById(`sel-${tgl}`); if(sel&&jdwMap[tgl]) sel.value=jdwMap[tgl].shift_id||''; });
```

} catch(e) { area.innerHTML=errHtml(e.message); }
}

async function saveGrid(nama, y, m, lastD) {
showLoading();
try {
const from=`${y}-${m}-01`, to=`${y}-${m}-${String(lastD).padStart(2,'0')}`;
await sb(`jadwal?nama=eq.${enc(nama)}&tanggal=gte.${from}&tanggal=lte.${to}`,‘DELETE’);
let count=0;
for (let d=1;d<=lastD;d++) {
const tgl=`${y}-${m}-${String(d).padStart(2,'0')}`;
const sel=document.getElementById(`sel-${tgl}`);
if (!sel?.value) continue;
const sh=allShifts.find(s=>s.id==sel.value); if(!sh) continue;
await sb(‘jadwal’,‘POST’,{nama,tanggal:tgl,shift_id:sh.id,nama_shift:sh.nama_shift,jam_masuk:sh.jam_masuk,jam_pulang:sh.jam_pulang});
count++;
}
toast(`✅ Jadwal ${nama} disimpan — ${count} hari aktif`,‘success’);
} catch(e) { toast(’Gagal simpan: ’+e.message,‘error’); }
finally { hideLoading(); }
}

// –– IMPORT CSV ––
async function downloadTemplate() {
const bulan=document.getElementById(‘imp-bulan’)?.value;
if (!bulan) { toast(‘Pilih bulan dulu’,‘error’); return; }
const [y,m]=bulan.split(’-’);
const lastD=new Date(y,m,0).getDate();
const users=await sb(‘users’,‘GET’,null,’?status_akun=eq.Aktif&select=nama_lengkap&order=nama_lengkap.asc’);
const cols=[‘Nama’,…Array.from({length:lastD},(_,i)=>String(i+1).padStart(2,‘0’))];
const rows=users.map(u=>[u.nama_lengkap,…Array(lastD).fill(’’)]);
dlCSV([cols,…rows],`template_jadwal_${bulan}.csv`);
toast(‘Template berhasil didownload!’,‘success’);
}

async function previewCSV() {
const file=document.getElementById(‘imp-file’).files[0];
const bulan=document.getElementById(‘imp-bulan’)?.value;
if (!file) return;
if (!bulan) { toast(‘Pilih bulan di Step 1 dulu’,‘error’); return; }
const [y,m]=bulan.split(’-’);
const text=await file.text();

// Parse CSV dengan benar (handle koma dalam kutip)
const lines=text.trim().split(/\r?\n/).map(line=>{
const res=[]; let cur=’’, inQ=false;
for(const ch of line){
if(ch===’”’){inQ=!inQ;}
else if(ch===’,’&&!inQ){res.push(cur.trim());cur=’’;}
else cur+=ch;
}
res.push(cur.trim()); return res;
});

const header=lines[0];
const dataRows=lines.slice(1).filter(r=>r[0]&&r[0].trim());

await ensureShifts();
const shiftMap={};
allShifts.forEach(s=>{ shiftMap[s.nama_shift.toLowerCase()]=s; });

const errors=[], rows=[];
dataRows.forEach(row=>{
const nama=row[0]?.trim(); if(!nama) return;
for(let i=1;i<header.length;i++){
const val=row[i]?.trim();
if(!val||[‘libur’,’-’,’’].includes(val.toLowerCase())) continue;
const sh=shiftMap[val.toLowerCase()];
if(!sh){ errors.push(`"${nama}" tgl ${header[i]}: shift "${val}" tidak ditemukan di master shift`); continue; }
const tgl=`${y}-${m}-${header[i].trim().padStart(2,'0')}`;
rows.push({nama,tanggal:tgl,shift_id:sh.id,nama_shift:sh.nama_shift,jam_masuk:sh.jam_masuk,jam_pulang:sh.jam_pulang});
}
});

importRows=rows; importBulan=bulan;
const namaSet=[…new Set(rows.map(r=>r.nama))];

document.getElementById(‘imp-preview’).innerHTML=` ${errors.length?`
<div class="import-error-box" style="margin-bottom:12px;">
<p><i class="fa-solid fa-triangle-exclamation"></i> ${errors.length} baris bermasalah (tetap bisa import data yang valid):</p>
${errors.slice(0,5).map(e=>`<div class="import-error-item">• ${e}</div>`).join(’’)}
${errors.length>5?`<div class="import-error-item" style="color:#94a3b8;">...dan ${errors.length-5} lainnya</div>`:’’}
</div>`:''} <div style="background:rgba(59,130,246,.08);border:1px solid rgba(59,130,246,.2);border-radius:12px;padding:14px;margin-bottom:12px;"> <div style="font-weight:700;color:#60a5fa;margin-bottom:8px;"><i class="fa-solid fa-table"></i> Preview Import — ${file.name}</div> <div style="font-size:13px;color:#94a3b8;line-height:1.8;"> 📋 <b>${dataRows.length}</b> baris data dibaca<br> 👥 <b>${namaSet.length}</b> karyawan ditemukan: ${namaSet.join(', ')}<br> ✅ <b>${rows.length}</b> baris jadwal siap diimport<br> 📅 Bulan: <b>${new Date(y,m-1).toLocaleDateString('id-ID',{month:'long',year:'numeric'})}</b> </div> </div> ${rows.length?`<button class="btn-primary full" id="btn-do-import" onclick="doImport()">
<i class="fa-solid fa-upload"></i> Import ${rows.length} Jadwal Sekarang
</button>`:`<div class="empty-state" style="padding:20px;"><i class="fa-solid fa-triangle-exclamation" style="color:#f87171;"></i><p style="color:#f87171;">Tidak ada data valid untuk diimport</p></div>`}`;
}

async function doImport() {
if (!importRows.length) { toast(‘Tidak ada data’,‘error’); return; }
const [y,m]=importBulan.split(’-’);
if (!confirm(`Import ${importRows.length} jadwal untuk bulan ${new Date(y,m-1).toLocaleDateString('id-ID',{month:'long',year:'numeric'})}?\n\nJadwal lama bulan ini untuk karyawan yang ada di file akan dihapus.`)) return;
document.getElementById(‘btn-do-import’).disabled=true;
showLoading();
try {
const from=`${y}-${m}-01`, to=`${y}-${m}-${String(new Date(y,m,0).getDate()).padStart(2,'0')}`;
const namaSet=[…new Set(importRows.map(r=>r.nama))];
// Hapus jadwal lama per nama
for(const nama of namaSet){
await sb(`jadwal?nama=eq.${enc(nama)}&tanggal=gte.${from}&tanggal=lte.${to}`,‘DELETE’);
}
// Insert baru
let ok=0;
for(const row of importRows){ await sb(‘jadwal’,‘POST’,row); ok++; }
toast(`Import berhasil: ${ok} jadwal untuk ${namaSet.length} karyawan`,‘success’);
document.getElementById(‘imp-preview’).innerHTML=` <div class="import-result-box"> <div class="result-title"><i class="fa-solid fa-circle-check"></i> Import Berhasil!</div> <div class="import-result-item"><i class="fa-solid fa-check"></i> ${ok} jadwal berhasil disimpan</div> <div class="import-result-item"><i class="fa-solid fa-users"></i> ${namaSet.length} karyawan diperbarui: ${namaSet.join(', ')}</div> </div>`;
importRows=[]; document.getElementById(‘imp-file’).value=’’;
} catch(e) { toast(’Gagal import: ’+e.message,‘error’); document.getElementById(‘btn-do-import’).disabled=false; }
finally { hideLoading(); }
}

// ==========================================
// MASTER SHIFT
// ==========================================
async function renderKelolaShift() {
document.getElementById(‘content’).innerHTML=` <div class="page-header-row"> <h2><i class="fa-solid fa-clock"></i> Master Shift</h2> <button class="btn-primary btn-sm" onclick="openModalShift()"><i class="fa-solid fa-plus"></i> Tambah</button> </div> <div id="shift-list"><div class="loading-state"><i class="fa-solid fa-spinner fa-spin"></i></div></div>`;
await loadShiftList();
}

async function loadShiftList() {
try {
allShifts = await sb(‘shift’,‘GET’,null,’?select=*&order=nama_shift.asc’);
const cont=document.getElementById(‘shift-list’);
if(!allShifts.length){ cont.innerHTML=emptyHtml(‘Belum ada shift’); return; }
cont.innerHTML=allShifts.map(s=>{const c=shiftColor(s.nama_shift);return` <div class="shift-card"> <div class="shift-card-dot" style="background:${c.text};"></div> <div class="shift-card-info"> <div class="shift-card-nama">${s.nama_shift}</div> <div class="shift-card-jam"><i class="fa-solid fa-clock"></i> ${fmtTime(s.jam_masuk)} – ${fmtTime(s.jam_pulang)}</div> ${s.keterangan?`<div class="shift-card-ket">${s.keterangan}</div>`:''} </div> <div style="display:flex;gap:6px;"> <button class="btn-icon edit" onclick='openModalShift(${JSON.stringify(s)})'><i class="fa-solid fa-pen"></i></button> <button class="btn-icon delete" onclick="hapusShift(${s.id})"><i class="fa-solid fa-trash"></i></button> </div> </div>`;}).join(’’);
} catch(e) { document.getElementById(‘shift-list’).innerHTML=errHtml(e.message); }
}

function openModalShift(s=null){
document.getElementById(‘modal-shift-title’).textContent=s?‘Edit Shift’:‘Tambah Shift’;
document.getElementById(‘shift-id’).value=s?.id||’’;
document.getElementById(‘shift-nama’).value=s?.nama_shift||’’;
document.getElementById(‘shift-masuk’).value=s?.jam_masuk?.slice(0,5)||’’;
document.getElementById(‘shift-pulang’).value=s?.jam_pulang?.slice(0,5)||’’;
document.getElementById(‘shift-ket’).value=s?.keterangan||’’;
document.getElementById(‘modal-shift’).classList.add(‘show’);
}
function closeModalShift(){ document.getElementById(‘modal-shift’).classList.remove(‘show’); }

async function saveShift(){
const id=document.getElementById(‘shift-id’).value;
const payload={
nama_shift:document.getElementById(‘shift-nama’).value.trim(),
jam_masuk:document.getElementById(‘shift-masuk’).value,
jam_pulang:document.getElementById(‘shift-pulang’).value,
keterangan:document.getElementById(‘shift-ket’).value.trim(),
};
if(!payload.nama_shift||!payload.jam_masuk||!payload.jam_pulang){toast(‘Lengkapi data shift’,‘error’);return;}
showLoading();
try{
if(id) await sb(`shift?id=eq.${id}`,‘PATCH’,payload);
else   await sb(‘shift’,‘POST’,payload);
toast(id?‘Shift diperbarui’:‘Shift ditambahkan’,‘success’);
closeModalShift(); await loadShiftList();
}catch(e){toast(’Gagal: ’+e.message,‘error’);}
finally{hideLoading();}
}

async function hapusShift(id){
if(!confirm(‘Hapus shift ini?’)) return;
showLoading();
try{ await sb(`shift?id=eq.${id}`,‘DELETE’); toast(‘Shift dihapus’,‘success’); await loadShiftList(); }
catch(e){toast(’Gagal: ’+e.message,‘error’);}
finally{hideLoading();}
}

// ==========================================
// KELOLA USER (Admin)
// ==========================================
async function renderKelolaUser() {
document.getElementById(‘content’).innerHTML=` <div class="page-header-row"> <h2><i class="fa-solid fa-users"></i> Kelola Karyawan</h2> <button class="btn-primary btn-sm" onclick="document.getElementById('modal-add-user').classList.add('show')"> <i class="fa-solid fa-plus"></i> Tambah </button> </div> <div style="margin-bottom:10px;"> <input type="text" placeholder="🔍 Cari nama atau email..." oninput="filterUsers(this.value)" style="width:100%;${inputStyle()}"> </div> <div id="user-list"><div class="loading-state"><i class="fa-solid fa-spinner fa-spin"></i></div></div>`;
await loadUserList();
}

async function loadUserList(){
try{
allUsers=await sb(‘users’,‘GET’,null,’?select=*&order=nama_lengkap.asc’);
renderUserList(allUsers);
}catch(e){ document.getElementById(‘user-list’).innerHTML=errHtml(e.message); }
}

function filterUsers(q){ renderUserList(allUsers.filter(u=>u.nama_lengkap.toLowerCase().includes(q.toLowerCase())||u.email.toLowerCase().includes(q.toLowerCase()))); }

function renderUserList(list){
const cont=document.getElementById(‘user-list’);
if(!list.length){ cont.innerHTML=emptyHtml(‘Tidak ada karyawan’); return; }
cont.innerHTML=list.map(u=>`

  <div class="user-card">
    <div class="user-avatar"><i class="fa-solid fa-user"></i></div>
    <div class="user-info">
      <div class="user-nama">${u.nama_lengkap} <span class="role-badge">${u.role}</span></div>
      <div class="user-email">${u.email}</div>
      <span class="status-badge ${u.status_akun==='Aktif'?'success':'danger'}">${u.status_akun}</span>
    </div>
    <div class="user-actions">
      <button class="btn-icon edit" onclick='openModalEdit(${JSON.stringify(u)})'><i class="fa-solid fa-pen"></i></button>
      <button class="btn-icon delete" onclick="deleteUser('${u.id_karyawan}')"><i class="fa-solid fa-trash"></i></button>
    </div>
  </div>`).join('');
}

function openModalEdit(u){
document.getElementById(‘edit-user-id’).value=u.id_karyawan;
document.getElementById(‘edit-nama’).value=u.nama_lengkap;
document.getElementById(‘edit-nip’).value=u.email;
document.getElementById(‘edit-jabatan’).value=u.role;
document.getElementById(‘edit-status-user’).value=u.status_akun;
document.getElementById(‘edit-password’).value=’’;
document.getElementById(‘modal-edit-user’).classList.add(‘show’);
}
function closeModalEdit(){ document.getElementById(‘modal-edit-user’).classList.remove(‘show’); }

async function saveEditUser(){
const id=document.getElementById(‘edit-user-id’).value;
const payload={
nama_lengkap:document.getElementById(‘edit-nama’).value.trim(),
role:document.getElementById(‘edit-jabatan’).value,
status_akun:document.getElementById(‘edit-status-user’).value,
};
const np=document.getElementById(‘edit-password’).value;
if(np) payload.password=np;
showLoading();
try{
await sb(`users?id_karyawan=eq.${id}`,‘PATCH’,payload);
toast(‘Data karyawan diperbarui’,‘success’);
closeModalEdit(); await loadUserList();
if(id===currentUser.id_karyawan){ currentUser={…currentUser,…payload}; localStorage.setItem(‘genius_user’,JSON.stringify(currentUser)); }
}catch(e){toast(’Gagal: ’+e.message,‘error’);}
finally{hideLoading();}
}

function closeModalAddUser(){ document.getElementById(‘modal-add-user’).classList.remove(‘show’); }

async function saveAddUser(){
const payload={
nama_lengkap:document.getElementById(‘add-nama’).value.trim(),
email:document.getElementById(‘add-email’).value.trim(),
password:document.getElementById(‘add-password’).value,
role:document.getElementById(‘add-role’).value,
status_akun:‘Aktif’,
};
if(!payload.nama_lengkap||!payload.email||!payload.password){toast(‘Lengkapi semua field’,‘error’);return;}
showLoading();
try{
await sb(‘users’,‘POST’,payload);
toast(‘Karyawan berhasil ditambahkan’,‘success’);
closeModalAddUser();
[‘add-nama’,‘add-email’,‘add-password’].forEach(id=>document.getElementById(id).value=’’);
await loadUserList();
}catch(e){toast(’Gagal: ’+e.message,‘error’);}
finally{hideLoading();}
}

async function deleteUser(id){
if(id===currentUser.id_karyawan){toast(‘Tidak bisa hapus akun sendiri’,‘error’);return;}
if(!confirm(‘Hapus user ini? Data absensinya tidak ikut terhapus.’)) return;
showLoading();
try{ await sb(`users?id_karyawan=eq.${id}`,‘DELETE’); toast(‘User dihapus’,‘success’); await loadUserList(); }
catch(e){toast(’Gagal: ’+e.message,‘error’);}
finally{hideLoading();}
}

// ==========================================
// APPROVE PENGAJUAN (Admin)
// ==========================================
async function renderApprovePengajuan() {
document.getElementById(‘content’).innerHTML=` <div class="page-header-row"><h2><i class="fa-solid fa-check-to-slot"></i> Approve Izin/Cuti/Sakit</h2></div> <div style="display:flex;gap:6px;margin-bottom:12px;flex-wrap:wrap;"> ${[['','Semua'],['Pending','⏳ Pending'],['Disetujui','✅ Disetujui'],['Ditolak','❌ Ditolak']].map(([v,l])=>`
<button id="pqtab-${v||'all'}" class="btn-${v===''?'primary':'outline'} btn-sm" onclick="filterPQ('${v}')">${l}</button>`).join('')} </div> <div id="pq-list"><div class="loading-state"><i class="fa-solid fa-spinner fa-spin"></i></div></div>`;
await loadPQ(’’);
}

async function filterPQ(status){
[[’’,‘all’],[‘Pending’,‘Pending’],[‘Disetujui’,‘Disetujui’],[‘Ditolak’,‘Ditolak’]].forEach(([v,k])=>{
const el=document.getElementById(`pqtab-${k}`);
if(el) el.className=v===status?‘btn-primary btn-sm’:‘btn-outline btn-sm’;
});
await loadPQ(status);
}

async function loadPQ(status){
let q=’?order=tgl_submit.desc&select=*’;
if(status) q+=`&status_approve=eq.${status}`;
const cont=document.getElementById(‘pq-list’);
cont.innerHTML=`<div class="loading-state"><i class="fa-solid fa-spinner fa-spin"></i></div>`;
try{
const list=await sb(‘pengajuan’,‘GET’,null,q);
if(!list.length){cont.innerHTML=emptyHtml(‘Tidak ada pengajuan’);return;}
cont.innerHTML=list.map(p=>cardPengajuan(p,true)).join(’’);
}catch(e){cont.innerHTML=errHtml(e.message);}
}

async function approvePengajuan(id,status){
if(!confirm(`${status==='Disetujui'?'Setujui':'Tolak'} pengajuan ini?`)) return;
showLoading();
try{
await sb(`pengajuan?id_pengajuan=eq.${id}`,‘PATCH’,{status_approve:status});
toast(`Pengajuan ${status}`,‘success’);
await loadPQ(’’);
}catch(e){toast(’Gagal: ’+e.message,‘error’);}
finally{hideLoading();}
}

// ==========================================
// PROFIL
// ==========================================
async function renderProfil(){
const u=currentUser;
document.getElementById(‘content’).innerHTML=` <div class="card" style="margin-bottom:12px;"> <div class="profil-card"> <div class="profil-avatar"><i class="fa-solid fa-user"></i></div> <div class="profil-info"> <h3>${u.nama_lengkap}</h3> <p>${u.email}</p> <span class="role-badge">${u.role}</span> <span class="status-badge ${u.status_akun==='Aktif'?'success':'danger'}" style="margin-left:6px;">${u.status_akun}</span> </div> </div> </div> <div class="card" style="margin-bottom:12px;"> <h3><i class="fa-solid fa-key" style="color:#fbbf24"></i> Ubah Password</h3> <div class="field"><label>Password Lama</label><input type="password" id="p-old" placeholder="Password saat ini"></div> <div class="field"><label>Password Baru</label><input type="password" id="p-new" placeholder="Password baru"></div> <div class="field"><label>Konfirmasi Password</label><input type="password" id="p-conf" placeholder="Ulangi password baru"></div> <button class="btn-primary full" onclick="gantiPassword()"><i class="fa-solid fa-save"></i> Simpan Password</button> </div> <div class="card" style="margin-bottom:12px;"> <h3><i class="fa-solid fa-info-circle" style="color:#60a5fa"></i> Info Akun</h3> <div style="font-size:13px;color:#64748b;line-height:2.2;"> <div>ID: <span style="color:#94a3b8;font-size:11px;">${u.id_karyawan}</span></div> <div>Bergabung: <span style="color:#94a3b8;">${fmtDateTime(u.created_at)}</span></div> </div> </div> <button class="sidebar-logout" style="width:100%;justify-content:center;" onclick="logout()"> <i class="fa-solid fa-right-from-bracket"></i> Keluar </button>`;
}

async function gantiPassword(){
const o=document.getElementById(‘p-old’).value;
const n=document.getElementById(‘p-new’).value;
const c=document.getElementById(‘p-conf’).value;
if(!o||!n||!c){toast(‘Isi semua field’,‘error’);return;}
if(o!==currentUser.password){toast(‘Password lama salah’,‘error’);return;}
if(n!==c){toast(‘Konfirmasi tidak cocok’,‘error’);return;}
if(n.length<6){toast(‘Password minimal 6 karakter’,‘error’);return;}
showLoading();
try{
await sb(`users?id_karyawan=eq.${currentUser.id_karyawan}`,‘PATCH’,{password:n});
currentUser.password=n;
localStorage.setItem(‘genius_user’,JSON.stringify(currentUser));
toast(‘Password berhasil diubah’,‘success’);
[‘p-old’,‘p-new’,‘p-conf’].forEach(id=>document.getElementById(id).value=’’);
}catch(e){toast(’Gagal: ’+e.message,‘error’);}
finally{hideLoading();}
}

// ==========================================
// UTILS — Load selects
// ==========================================
async function ensureShifts(){
if(!allShifts.length) allShifts=await sb(‘shift’,‘GET’,null,’?select=*&order=nama_shift.asc’);
}

async function loadShiftSelect(selId){
await ensureShifts();
const sel=document.getElementById(selId); if(!sel) return;
while(sel.options.length>1) sel.remove(1);
allShifts.forEach(s=>{ const o=new Option(`${s.nama_shift} (${fmtTime(s.jam_masuk)}-${fmtTime(s.jam_pulang)})`,s.nama_shift); sel.appendChild(o); });
}

async function loadUserSelect(selId){
try{
if(!allUsers.length) allUsers=await sb(‘users’,‘GET’,null,’?status_akun=eq.Aktif&select=id_karyawan,nama_lengkap&order=nama_lengkap.asc’);
const sel=document.getElementById(selId); if(!sel) return;
while(sel.options.length>1) sel.remove(1);
allUsers.forEach(u=>sel.appendChild(new Option(u.nama_lengkap,u.nama_lengkap)));
}catch(e){}
}

// ==========================================
// FORMAT HELPERS
// ==========================================
function fmtDate(d){ if(!d) return ‘-’; return new Date(d+‘T00:00:00’).toLocaleDateString(‘id-ID’,{day:‘2-digit’,month:‘short’,year:‘numeric’}); }
function fmtDateLong(d){ if(!d) return ‘-’; return new Date(d+‘T00:00:00’).toLocaleDateString(‘id-ID’,{weekday:‘long’,day:‘2-digit’,month:‘long’,year:‘numeric’}); }
function fmtTime(t){ return t?t.slice(0,5):’–:–’; }
function fmtDateTime(dt){ if(!dt) return ‘-’; return new Date(dt).toLocaleString(‘id-ID’,{day:‘2-digit’,month:‘short’,year:‘numeric’,hour:‘2-digit’,minute:‘2-digit’}); }

function weekRange(){
const n=new Date(), day=n.getDay()||7;
const mon=new Date(n); mon.setDate(n.getDate()-day+1);
const sun=new Date(n); sun.setDate(n.getDate()-day+7);
return [mon.toLocaleDateString(‘sv-SE’),sun.toLocaleDateString(‘sv-SE’)];
}

function statusBadge(s){
if(!s) return ‘’;
const m={
‘Tepat Waktu’:‘success’,‘Terlambat’:‘danger’,‘Normal’:‘success’,
‘Pulang Awal’:‘warning’,‘Aktif’:‘success’,‘Nonaktif’:‘danger’,
‘Pending’:‘warning’,‘Disetujui’:‘success’,‘Ditolak’:‘danger’,
};
return `<span class="status-badge ${m[s]||''}">${s}</span>`;
}

function shiftColor(nama){
const n=(nama||’’).toLowerCase();
if(n.includes(‘pagi’))  return {bg:‘rgba(59,130,246,.15)’,text:’#60a5fa’};
if(n.includes(‘sore’))  return {bg:‘rgba(249,115,22,.15)’,text:’#fb923c’};
if(n.includes(‘malam’)) return {bg:‘rgba(139,92,246,.15)’,text:’#a78bfa’};
if(n.includes(‘libur’)) return {bg:‘rgba(100,116,139,.12)’,text:’#64748b’};
return {bg:‘rgba(20,184,166,.15)’,text:’#2dd4bf’};
}

function emptyHtml(msg){ return `<div class="empty-state"><i class="fa-solid fa-inbox"></i><p>${msg}</p></div>`; }
function errHtml(msg){ return `<div class="empty-state error"><i class="fa-solid fa-circle-exclamation"></i><p>Error: ${msg}</p></div>`; }
function inputStyle(){ return `background:rgba(255,255,255,.07);border:1px solid rgba(255,255,255,.1);border-radius:10px;color:#fff;padding:9px 12px;font-size:13px;outline:none;`; }
function selectStyle(){ return `background:#1e293b;border:1px solid rgba(255,255,255,.1);border-radius:10px;color:#fff;padding:9px 12px;font-size:13px;outline:none;`; }

function dlCSV(rows,filename){
const csv=rows.map(r=>r.map(v=>`"${String(v||'').replace(/"/g,'""')}"`).join(’,’)).join(’\n’);
const a=document.createElement(‘a’);
a.href=URL.createObjectURL(new Blob([’\uFEFF’+csv],{type:‘text/csv;charset=utf-8;’}));
a.download=filename; a.click();
}

// ==========================================
// LOADING & TOAST
// ==========================================
function showLoading(){ document.getElementById(‘loading-overlay’).style.display=‘flex’; }
function hideLoading(){ document.getElementById(‘loading-overlay’).style.display=‘none’; }

function toast(msg,type=‘info’){
const c=document.getElementById(‘toast-container’);
const el=document.createElement(‘div’);
el.className=`toast toast-${type}`;
const ic={success:‘fa-circle-check’,error:‘fa-circle-exclamation’,info:‘fa-circle-info’}[type]||‘fa-circle-info’;
el.innerHTML=`<i class="fa-solid ${ic}"></i> ${msg}`;
c.appendChild(el);
requestAnimationFrame(()=>el.classList.add(‘show’));
setTimeout(()=>{ el.classList.remove(‘show’); setTimeout(()=>el.remove(),300); },3200);
}

// ==========================================
// MODAL CLOSE ON BACKDROP
// ==========================================
document.querySelectorAll(’.modal-bg’).forEach(m=>{
m.addEventListener(‘click’,e=>{ if(e.target===m){ m.classList.remove(‘show’); stopCamera(); } });
});

function stopCamera(){ if(cameraStream){ cameraStream.getTracks().forEach(t=>t.stop()); cameraStream=null; } }