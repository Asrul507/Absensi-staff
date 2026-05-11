// ============================================================
// GENIUS PRESENCE — script.js v5.0 (FIXED LOGIN)
// ============================================================

const SUPA_URL = ‘'https://bllqpxhcykzshpzbdogy.supabase.co'’;
const SUPA_KEY = ‘eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJsbHFweGhjeWt6c2hwemJkb2d5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzg0Njg3NTEsImV4cCI6MjA5NDA0NDc1MX0.odqXIJbMDQEBksX012ZgPOtPQXCdPMvo_bbO90fuUQw’;

// ── Supabase fetch ──────────────────────────────────────────
async function sb(table, method, body, qs) {
method = method || ‘GET’;
qs     = qs     || ‘’;
var res = await fetch(SUPA_URL + ‘/rest/v1/’ + table + qs, {
method: method,
headers: {
‘Content-Type’:  ‘application/json’,
‘apikey’:        SUPA_KEY,
‘Authorization’: ’Bearer ’ + SUPA_KEY,
‘Prefer’:        ‘return=representation’,
},
body: body ? JSON.stringify(body) : undefined,
});
var txt = await res.text();
if (!res.ok) {
var m = ’HTTP ’ + res.status;
try { var e = JSON.parse(txt); m = e.message || e.hint || e.details || m; } catch(x){}
throw new Error(m);
}
return txt ? JSON.parse(txt) : [];
}

// ── State ───────────────────────────────────────────────────
var CU          = null;  // current user
var PAGE        = ‘’;
var CAM         = null;
var FOTO        = null;
var ABSEN_MODE  = null;
var GPS_LAT     = null;
var GPS_LNG     = null;
var T_ABSEN     = null;  // today’s absen record
var T_JADWAL    = null;  // today’s jadwal
var CLOCK_IV    = null;
var SHIFTS      = [];
var ALL_USERS   = [];
var REKAP_DATA  = [];
var IMP_ROWS    = [];
var IMP_BULAN   = ‘’;

// role check — case insensitive
function isAdmin() {
if (!CU || !CU.role) return false;
return CU.role.trim().toLowerCase() === ‘admin’;
}

// ── INIT ────────────────────────────────────────────────────
// Tidak async di root — hanya check localStorage
document.addEventListener(‘DOMContentLoaded’, function() {
// Bersihkan semua localStorage versi lama
localStorage.removeItem(‘genius_user’);

var raw = localStorage.getItem(‘gns_v5’);
if (raw) {
try {
CU = JSON.parse(raw);
startApp();
} catch(e) {
localStorage.removeItem(‘gns_v5’);
}
}
// Jika tidak ada session, tampilkan halaman login (default sudah tampil)
});

// ── TOGGLE FORM ─────────────────────────────────────────────
function showSignup() {
document.getElementById(‘form-login’).style.display  = ‘none’;
document.getElementById(‘form-signup’).style.display = ‘block’;
}
function showLogin() {
document.getElementById(‘form-signup’).style.display = ‘none’;
document.getElementById(‘form-login’).style.display  = ‘block’;
}

// ── LOGIN ───────────────────────────────────────────────────
async function login() {
var email = document.getElementById(‘login-email’).value.trim();
var pass  = document.getElementById(‘login-pass’).value;

// Reset debug box
var dbg = document.getElementById(‘debug-box’);
dbg.style.display = ‘none’;
dbg.innerHTML = ‘’;

if (!email) { showDebug(‘⚠️ Isi email terlebih dahulu’); return; }
if (!pass)  { showDebug(‘⚠️ Isi password terlebih dahulu’); return; }

showLoading();
try {
var rows = await sb(‘users’, ‘GET’, null,
‘?email=eq.’ + encodeURIComponent(email) + ‘&select=*’);

```
if (!rows || rows.length === 0) {
  showDebug('❌ Email <b>' + email + '</b> tidak ditemukan di database.<br><br>' +
    '💡 Pastikan:<br>• Email benar<br>• RLS tabel <b>users</b> sudah di-disable di Supabase');
  return;
}

var u = rows[0];

// Tampilkan info akun yang ditemukan untuk debug
showDebug('✅ Akun ditemukan!<br>' +
  'Nama: <b>' + u.nama_lengkap + '</b><br>' +
  'Role di DB: <b>"' + u.role + '"</b><br>' +
  'isAdmin: <b>' + (u.role.trim().toLowerCase()==='admin') + '</b><br>' +
  'Status: <b>' + u.status_akun + '</b>');

if (u.password !== pass) {
  showDebug('❌ Password salah!<br>Akun: <b>' + u.nama_lengkap + '</b><br>Role: <b>' + u.role + '</b>');
  return;
}

if (u.status_akun === 'Nonaktif') {
  showDebug('❌ Akun <b>Nonaktif</b>. Hubungi Admin.');
  return;
}

// Login berhasil
CU = u;
localStorage.setItem('gns_v5', JSON.stringify(CU));

// Sembunyikan debug box lalu masuk app
setTimeout(function() {
  dbg.style.display = 'none';
  startApp();
}, 800);
```

} catch(e) {
showDebug(’❌ <b>Error koneksi:</b> ’ + e.message + ‘<br><br>’ +
‘🔧 <b>Solusi:</b><br>’ +
‘1. Buka <a href="https://supabase.com" target="_blank" style="color:#60a5fa;">supabase.com</a><br>’ +
‘2. Table Editor → users<br>’ +
‘3. Klik “RLS enabled” → Disable RLS<br>’ +
‘4. Ulangi untuk tabel: absensi, jadwal, shift, pengajuan’);
} finally {
hideLoading();
}
}

function showDebug(html) {
var dbg = document.getElementById(‘debug-box’);
dbg.style.display = ‘block’;
dbg.innerHTML = html;
}

// ── SIGNUP ──────────────────────────────────────────────────
async function signup() {
var nama  = document.getElementById(‘su-nama’).value.trim();
var email = document.getElementById(‘su-email’).value.trim();
var pass  = document.getElementById(‘su-pass’).value;
var pass2 = document.getElementById(‘su-pass2’).value;
var role  = document.getElementById(‘su-role’).value;

if (!nama || !email || !pass || !pass2) { toast(‘Lengkapi semua field’, ‘error’); return; }
if (pass !== pass2)  { toast(‘Konfirmasi password tidak cocok’, ‘error’); return; }
if (pass.length < 6) { toast(‘Password minimal 6 karakter’, ‘error’); return; }

showLoading();
try {
var cek = await sb(‘users’, ‘GET’, null,
‘?email=eq.’ + encodeURIComponent(email) + ‘&select=id_karyawan’);
if (cek.length) { toast(‘Email sudah terdaftar’, ‘error’); return; }

```
await sb('users', 'POST', {
  nama_lengkap: nama,
  email:        email,
  password:     pass,
  role:         role,
  status_akun:  'Aktif',
});

toast('Akun "' + nama + '" (' + role + ') berhasil dibuat! Silakan login.', 'success');
['su-nama','su-email','su-pass','su-pass2'].forEach(function(id) {
  document.getElementById(id).value = '';
});
showLogin();
document.getElementById('login-email').value = email;
```

} catch(e) {
toast(’Gagal daftar: ’ + e.message, ‘error’);
} finally {
hideLoading();
}
}

// ── LOGOUT ──────────────────────────────────────────────────
function logout() {
if (!confirm(‘Yakin ingin keluar?’)) return;
localStorage.removeItem(‘gns_v5’);
CU = null;
if (CLOCK_IV) clearInterval(CLOCK_IV);
document.getElementById(‘appPage’).style.display   = ‘none’;
document.getElementById(‘loginPage’).style.display = ‘flex’;
document.getElementById(‘login-email’).value = ‘’;
document.getElementById(‘login-pass’).value  = ‘’;
showLogin();
}

// ============================================================
// APP SHELL
// ============================================================
function startApp() {
document.getElementById(‘loginPage’).style.display = ‘none’;
document.getElementById(‘appPage’).style.display   = ‘block’;

document.getElementById(‘userName’).textContent = CU.nama_lengkap.split(’ ’)[0];
var rt = document.getElementById(‘roleTag’);
rt.textContent   = isAdmin() ? ‘ADMIN’ : ‘STAFF’;
rt.style.background = isAdmin() ? ‘rgba(251,191,36,.2)’ : ‘rgba(148,163,184,.15)’;
rt.style.color      = isAdmin() ? ‘#fbbf24’ : ‘#94a3b8’;

buildSidebar();
buildBottomNav();
navigateTo(‘dashboard’);
}

function buildSidebar() {
var adminMenu = [
{p:‘dashboard’,         i:‘fa-gauge’,          l:‘Dashboard’},
{p:‘rekap’,             i:‘fa-chart-bar’,      l:‘Rekap Absensi’},
{p:‘kelola-jadwal’,     i:‘fa-table’,          l:‘Kelola Jadwal’},
{p:‘kelola-shift’,      i:‘fa-clock’,          l:‘Master Shift’},
{p:‘kelola-user’,       i:‘fa-users’,          l:‘Karyawan’},
{p:‘approve-pengajuan’, i:‘fa-check-to-slot’,  l:‘Approve Izin/Cuti’},
{p:‘profil’,            i:‘fa-user’,           l:‘Profil’},
];
var staffMenu = [
{p:‘dashboard’,       i:‘fa-house’,         l:‘Dashboard’},
{p:‘riwayat-absensi’, i:‘fa-fingerprint’,   l:‘Riwayat Absensi’},
{p:‘jadwal-saya’,     i:‘fa-calendar-days’, l:‘Jadwal Saya’},
{p:‘pengajuan’,       i:‘fa-file-medical’,  l:‘Pengajuan’},
{p:‘profil’,          i:‘fa-user’,          l:‘Profil’},
];
var menu = isAdmin() ? adminMenu : staffMenu;
var navHtml = ‘<div class="sidebar-divider">’ + (isAdmin() ? ‘ADMIN PANEL’ : ‘MENU’) + ‘</div>’;
navHtml += menu.map(function(x) {
return ‘<a class="sidebar-link" data-p="' + x.p + '" onclick="go(\'' + x.p + '\')">’ +
‘<i class="fa-solid ' + x.i + '"></i> ’ + x.l + ‘</a>’;
}).join(’’);

document.getElementById(‘sidebar’).innerHTML =
‘<div class="sidebar-header">’ +
‘<div class="sidebar-logo">🏢</div>’ +
‘<div><div class="sidebar-title">GENIUS</div><div class="sidebar-sub">Living Plaza Balikpapan</div></div>’ +
‘</div>’ +
‘<div class="sidebar-user">’ +
‘<div class="sidebar-avatar"><i class="fa-solid fa-user"></i></div>’ +
‘<div><div class="sidebar-name">’ + CU.nama_lengkap + ‘</div>’ +
‘<div class="sidebar-role">’ + CU.role + ‘</div></div>’ +
‘</div>’ +
‘<div class="sidebar-nav">’ + navHtml + ‘</div>’ +
‘<button class="sidebar-logout" onclick="logout()"><i class="fa-solid fa-right-from-bracket"></i> Keluar</button>’;
}

function buildBottomNav() {
var adminItems = [
{p:‘dashboard’,         i:‘fa-gauge’,          l:‘Home’},
{p:‘rekap’,             i:‘fa-chart-bar’,      l:‘Rekap’},
{p:‘kelola-jadwal’,     i:‘fa-table’,          l:‘Jadwal’},
{p:‘approve-pengajuan’, i:‘fa-check-to-slot’,  l:‘Izin’},
{p:‘kelola-user’,       i:‘fa-users’,          l:‘User’},
];
var staffItems = [
{p:‘dashboard’,       i:‘fa-house’,         l:‘Home’},
{p:‘riwayat-absensi’, i:‘fa-fingerprint’,   l:‘Absensi’},
{p:‘jadwal-saya’,     i:‘fa-calendar-days’, l:‘Jadwal’},
{p:‘pengajuan’,       i:‘fa-file-medical’,  l:‘Izin’},
{p:‘profil’,          i:‘fa-user’,          l:‘Profil’},
];
var items = isAdmin() ? adminItems : staffItems;
document.getElementById(‘bottomNav’).innerHTML = items.map(function(x) {
return ‘<button class="nav-item' + (PAGE === x.p ? ' active' : '') +
'" onclick="navigateTo(\'' + x.p + '\')">’ +
‘<i class="fa-solid ' + x.i + '"></i><span>’ + x.l + ‘</span></button>’;
}).join(’’);
}

function go(p)          { closeSidebar(); navigateTo(p); }
function toggleSidebar() { document.getElementById(‘sidebar’).classList.toggle(‘open’); document.getElementById(‘overlay’).classList.toggle(‘show’); }
function closeSidebar()  { document.getElementById(‘sidebar’).classList.remove(‘open’); document.getElementById(‘overlay’).classList.remove(‘show’); }

async function navigateTo(p) {
PAGE = p;
buildBottomNav();
document.querySelectorAll(’.sidebar-link’).forEach(function(a) {
a.classList.toggle(‘active’, a.dataset.p === p);
});
document.getElementById(‘content’).innerHTML =
‘<div class="loading-state"><i class="fa-solid fa-spinner fa-spin"></i> Memuat…</div>’;

try {
if (p === ‘dashboard’)          { isAdmin() ? await pgDashAdmin()   : await pgDashStaff(); }
else if (p === ‘rekap’)         { await pgRekap(); }
else if (p === ‘kelola-jadwal’) { await pgKelolaJadwal(); }
else if (p === ‘kelola-shift’)  { await pgKelolaShift(); }
else if (p === ‘kelola-user’)   { await pgKelolaUser(); }
else if (p === ‘approve-pengajuan’) { await pgApprovePQ(); }
else if (p === ‘riwayat-absensi’)   { await pgRiwayatAbsensi(); }
else if (p === ‘jadwal-saya’)   { await pgJadwalSaya(); }
else if (p === ‘pengajuan’)     { await pgPengajuan(); }
else if (p === ‘profil’)        { await pgProfil(); }
else { C().innerHTML = errH(‘Halaman tidak ditemukan’); }
} catch(e) {
C().innerHTML = errH(e.message);
}
}

function startClock() {
if (CLOCK_IV) clearInterval(CLOCK_IV);
CLOCK_IV = setInterval(function() {
var el = document.getElementById(‘clock-display’);
if (!el) { clearInterval(CLOCK_IV); return; }
el.textContent = new Date().toLocaleTimeString(‘id-ID’);
}, 1000);
var el = document.getElementById(‘clock-display’);
if (el) el.textContent = new Date().toLocaleTimeString(‘id-ID’);
}

// ============================================================
// DASHBOARD STAFF
// ============================================================
async function pgDashStaff() {
var today = tgl();
try {
var jRes = await sb(‘jadwal’, ‘GET’, null,
‘?nama=eq.’ + enc(CU.nama_lengkap) + ‘&tanggal=eq.’ + today + ‘&select=*’);
var aRes = await sb(‘absensi’, ‘GET’, null,
‘?nama=eq.’ + enc(CU.nama_lengkap) + ‘&tanggal=eq.’ + today + ’&select=*’);
T_JADWAL = jRes[0] || null;
T_ABSEN  = aRes[0] || null;

```
var wr   = wkRange();
var week = await sb('absensi', 'GET', null,
  '?nama=eq.' + enc(CU.nama_lengkap) + '&tanggal=gte.' + wr[0] + '&tanggal=lte.' + wr[1] + '&select=*');

var sm = !!(T_ABSEN && T_ABSEN.waktu_masuk);
var sp = !!(T_ABSEN && T_ABSEN.waktu_pulang);
var wm = sm ? ft(T_ABSEN.waktu_masuk)  : '--:--';
var wp = sp ? ft(T_ABSEN.waktu_pulang) : '--:--';
var hadir = week.filter(function(x){return x.waktu_masuk;}).length;
var telat  = week.filter(function(x){return x.status_masuk==='Terlambat';}).length;

C().innerHTML =
  '<div class="card" style="background:linear-gradient(135deg,#1e3a8a,#1d4ed8,#0369a1);border:none;margin-bottom:12px;">' +
    '<div style="font-size:12px;opacity:.75;">' + fdLong(today) + '</div>' +
    '<div id="clock-display" style="font-size:30px;font-weight:800;letter-spacing:2px;margin:4px 0;">--:--:--</div>' +
    '<div style="font-size:13px;opacity:.8;">Halo, <b>' + CU.nama_lengkap.split(' ')[0] + '</b> 👋</div>' +
  '</div>' +

  (T_JADWAL
    ? '<div class="shift-info-bar"><i class="fa-solid fa-rotate"></i> Shift <b>' + T_JADWAL.nama_shift + '</b> &nbsp;·&nbsp; ' + ft(T_JADWAL.jam_masuk) + ' – ' + ft(T_JADWAL.jam_pulang) + '</div>'
    : '<div class="shift-info-bar" style="background:rgba(234,179,8,.08);border-color:rgba(234,179,8,.3);color:#fbbf24;"><i class="fa-solid fa-triangle-exclamation"></i> Tidak ada jadwal shift hari ini</div>') +

  '<div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-bottom:12px;">' +
    '<button class="btn-absensi" ' + (sm ? 'style="background:linear-gradient(135deg,#059669,#047857);cursor:default;"' : 'onclick="openAbsen(\'masuk\')"') + '>' +
      '<i class="fa-solid fa-' + (sm ? 'circle-check' : 'right-to-bracket') + '"></i>' +
      '<span style="font-size:13px;">' + (sm ? '✓ Masuk ' + wm : 'Absen Masuk') + '</span>' +
    '</button>' +
    '<button class="btn-absensi" ' + (!sm ? 'disabled style="opacity:.4;cursor:not-allowed;"' : sp ? 'style="background:linear-gradient(135deg,#d97706,#b45309);cursor:default;"' : 'onclick="openAbsen(\'pulang\')" style="background:linear-gradient(135deg,#dc2626,#b91c1c);"') + '>' +
      '<i class="fa-solid fa-' + (sp ? 'circle-check' : 'right-from-bracket') + '"></i>' +
      '<span style="font-size:13px;">' + (sp ? '✓ Pulang ' + wp : 'Absen Pulang') + '</span>' +
    '</button>' +
  '</div>' +

  (T_ABSEN ?
    '<div class="card" style="margin-bottom:12px;">' +
      '<h3><i class="fa-solid fa-circle-info" style="color:#60a5fa"></i> Status Absen Hari Ini</h3>' +
      '<div style="display:flex;gap:10px;margin-top:10px;">' +
        '<div class="status-tile ' + (sm?'done':'pending') + '">' +
          '<i class="fa-solid fa-arrow-right-to-bracket"></i>' +
          '<div class="status-tile-label">Masuk</div>' +
          '<div style="font-size:20px;font-weight:800;margin:4px 0;">' + wm + '</div>' +
          sBadge(T_ABSEN.status_masuk) +
          (T_ABSEN.ket_telat ? '<div class="ket-telat-badge" style="margin-top:6px;font-size:11px;"><i class="fa-solid fa-clock"></i> ' + T_ABSEN.ket_telat + '</div>' : '') +
        '</div>' +
        '<div class="status-tile ' + (sp?'done':'locked') + '">' +
          '<i class="fa-solid fa-arrow-right-from-bracket"></i>' +
          '<div class="status-tile-label">Pulang</div>' +
          '<div style="font-size:20px;font-weight:800;margin:4px 0;">' + wp + '</div>' +
          (T_ABSEN.status_pulang ? sBadge(T_ABSEN.status_pulang) : '<div style="font-size:12px;color:#475569;">Belum pulang</div>') +
        '</div>' +
      '</div>' +
    '</div>' : '') +

  '<div class="stats-grid">' +
    '<div class="stat-card green"><div class="stat-icon"><i class="fa-solid fa-calendar-check"></i></div><div class="stat-val">' + hadir + '</div><div class="stat-label">Hadir Minggu Ini</div></div>' +
    '<div class="stat-card red"><div class="stat-icon"><i class="fa-solid fa-clock"></i></div><div class="stat-val">' + telat + '</div><div class="stat-label">Terlambat</div></div>' +
    '<div class="stat-card blue"><div class="stat-icon"><i class="fa-solid fa-calendar-week"></i></div><div class="stat-val">' + week.length + '</div><div class="stat-label">Total Shift</div></div>' +
  '</div>' +

  '<div class="card">' +
    '<h3><i class="fa-solid fa-file-medical" style="color:#60a5fa"></i> Pengajuan Cepat</h3>' +
    '<div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:8px;">' +
      '<button class="btn-outline" onclick="openPQ(\'Izin\')" style="flex-direction:column;gap:4px;padding:12px 8px;justify-content:center;text-align:center;"><i class="fa-solid fa-file-lines" style="font-size:20px;"></i><span style="font-size:11px;">Izin</span></button>' +
      '<button class="btn-outline" onclick="openPQ(\'Sakit\')" style="flex-direction:column;gap:4px;padding:12px 8px;justify-content:center;text-align:center;border-color:rgba(239,68,68,.4);color:#f87171;"><i class="fa-solid fa-notes-medical" style="font-size:20px;"></i><span style="font-size:11px;">Sakit</span></button>' +
      '<button class="btn-outline" onclick="openPQ(\'Cuti\')" style="flex-direction:column;gap:4px;padding:12px 8px;justify-content:center;text-align:center;border-color:rgba(16,185,129,.4);color:#34d399;"><i class="fa-solid fa-umbrella-beach" style="font-size:20px;"></i><span style="font-size:11px;">Cuti</span></button>' +
    '</div>' +
  '</div>';

startClock();
```

} catch(e) { C().innerHTML = errH(e.message); }
}

// ============================================================
// DASHBOARD ADMIN
// ============================================================
async function pgDashAdmin() {
var today = tgl();
var ym    = today.split(’-’);
var y = ym[0], m = ym[1];
var from = y+’-’+m+’-01’;
var lastD = new Date(parseInt(y), parseInt(m), 0).getDate();
var to   = y+’-’+m+’-’+String(lastD).padStart(2,‘0’);

try {
var absenHari  = await sb(‘absensi’,  ‘GET’, null, ‘?tanggal=eq.’+today+’&select=*’);
var users      = await sb(‘users’,    ‘GET’, null, ‘?status_akun=eq.Aktif&select=id_karyawan,nama_lengkap,role’);
var pending    = await sb(‘pengajuan’,‘GET’, null, ’?status_approve=eq.Pending&select=*’);
var absenBulan = await sb(‘absensi’,  ‘GET’, null, ‘?tanggal=gte.’+from+’&tanggal=lte.’+to+’&select=waktu_masuk,status_masuk’);

```
var hadirHari  = absenHari.filter(function(a){return a.waktu_masuk;}).length;
var telatHari  = absenHari.filter(function(a){return a.status_masuk==='Terlambat';}).length;
var hadirBulan = absenBulan.filter(function(a){return a.waktu_masuk;}).length;
var telatBulan = absenBulan.filter(function(a){return a.status_masuk==='Terlambat';}).length;
var hadirSet   = {};
absenHari.filter(function(a){return a.waktu_masuk;}).forEach(function(a){hadirSet[a.nama]=true;});
var belum = users.filter(function(u){return !hadirSet[u.nama_lengkap];});

C().innerHTML =
  '<div class="card" style="background:linear-gradient(135deg,#1e3a8a,#1d4ed8);border:none;margin-bottom:12px;">' +
    '<div style="font-size:12px;opacity:.7;">' + fdLong(today) + '</div>' +
    '<div id="clock-display" style="font-size:24px;font-weight:800;margin:4px 0;">--:--:--</div>' +
    '<div style="font-size:13px;opacity:.8;">Admin Panel · <b>' + CU.nama_lengkap.split(' ')[0] + '</b></div>' +
  '</div>' +

  '<div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-bottom:12px;">' +
    kpiCard('Hadir Hari Ini', hadirHari, 'dari '+users.length+' karyawan', '#34d399') +
    kpiCard('Izin Pending', pending.length, 'perlu disetujui', '#fbbf24') +
    kpiCard('Terlambat Hari Ini', telatHari, 'orang', '#f87171') +
    kpiCard('Hadir Bulan Ini', hadirBulan, telatBulan+' terlambat', '#60a5fa') +
  '</div>' +

  '<div class="card" style="margin-bottom:12px;">' +
    '<h3><i class="fa-solid fa-bolt" style="color:#fbbf24"></i> Aksi Cepat</h3>' +
    '<div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;">' +
      '<button class="btn-primary" onclick="navigateTo(\'kelola-jadwal\')"><i class="fa-solid fa-table"></i> Atur Jadwal</button>' +
      '<button class="btn-primary" onclick="navigateTo(\'rekap\')"><i class="fa-solid fa-chart-bar"></i> Rekap Absensi</button>' +
      '<button class="btn-primary" onclick="navigateTo(\'approve-pengajuan\')" style="' + (pending.length?'background:linear-gradient(135deg,#d97706,#b45309);':'') + '">' +
        '<i class="fa-solid fa-check-to-slot"></i> Approve Izin' +
        (pending.length ? ' <span style="background:rgba(255,255,255,.25);border-radius:20px;padding:1px 8px;font-size:11px;">'+pending.length+'</span>' : '') +
      '</button>' +
      '<button class="btn-primary" onclick="navigateTo(\'kelola-user\')"><i class="fa-solid fa-users"></i> Kelola User</button>' +
    '</div>' +
  '</div>' +

  (belum.length ?
    '<div class="card" style="margin-bottom:12px;">' +
      '<h3><i class="fa-solid fa-user-clock" style="color:#f87171"></i> Belum Absen (' + belum.length + ')</h3>' +
      belum.map(function(u){return '<div class="user-card" style="margin-bottom:8px;"><div class="user-avatar"><i class="fa-solid fa-user"></i></div><div class="user-info"><div class="user-nama">'+u.nama_lengkap+'</div><div class="user-email">'+u.role+'</div></div></div>';}).join('') +
    '</div>' :
    '<div class="card"><h3><i class="fa-solid fa-circle-check" style="color:#34d399"></i> Semua Karyawan Sudah Absen 🎉</h3></div>') +

  '<div class="card">' +
    '<h3><i class="fa-solid fa-list" style="color:#60a5fa"></i> Absen Masuk Hari Ini</h3>' +
    (hadirHari === 0 ? emptyH('Belum ada absen masuk') :
      '<div class="card-list">' +
      absenHari.filter(function(a){return a.waktu_masuk;})
        .sort(function(a,b){return a.waktu_masuk.localeCompare(b.waktu_masuk);})
        .map(function(a){return '<div class="absensi-card"><div class="absensi-foto-placeholder"><i class="fa-solid fa-user"></i></div><div class="absensi-card-body"><div class="absensi-nama">'+a.nama+'</div><div class="absensi-waktu"><i class="fa-solid fa-clock"></i> '+ft(a.waktu_masuk)+(a.waktu_pulang?' · Pulang '+ft(a.waktu_pulang):'')+' </div><div class="absensi-info">'+(a.nama_shift||'-')+'</div></div><span class="absensi-badge '+(a.status_masuk==='Tepat Waktu'?'success':'warning')+'">'+(a.status_masuk||'-')+'</span></div>';}).join('') +
      '</div>') +
  '</div>';

startClock();
```

} catch(e) { C().innerHTML = errH(e.message); }
}

function kpiCard(label, val, sub, color) {
return ‘<div class="card" style="margin:0;text-align:center;">’ +
‘<div style="font-size:10px;color:#64748b;font-weight:700;text-transform:uppercase;margin-bottom:4px;">’+label+’</div>’ +
‘<div style="font-size:38px;font-weight:800;color:'+color+';line-height:1;">’+val+’</div>’ +
‘<div style="font-size:12px;color:#475569;margin-top:4px;">’+sub+’</div>’ +
‘</div>’;
}

// ============================================================
// ABSEN — Kamera + GPS
// ============================================================
async function openAbsen(mode) {
ABSEN_MODE = mode; FOTO = null;
document.getElementById(‘modal-absen-title’).textContent = mode===‘masuk’ ? ‘📸 Absen Masuk’ : ‘📸 Absen Pulang’;
document.getElementById(‘foto-preview-box’).style.display  = ‘none’;
document.getElementById(‘camera-container’).style.display  = ‘block’;
document.getElementById(‘absen-actions’).style.display     = ‘flex’;
document.getElementById(‘absen-confirm-actions’).style.display = ‘none’;
document.getElementById(‘lokasi-info’).className = ‘gps-status loading’;
document.getElementById(‘lokasi-info’).innerHTML = ‘<i class="fa-solid fa-spinner fa-spin"></i> Mengambil lokasi…’;
document.getElementById(‘modal-absen’).classList.add(‘show’);
try {
CAM = await navigator.mediaDevices.getUserMedia({video:{facingMode:‘user’},audio:false});
document.getElementById(‘camera-video’).srcObject = CAM;
} catch(e) { toast(‘Kamera tidak bisa diakses’,‘error’); }
if (navigator.geolocation) {
navigator.geolocation.getCurrentPosition(
function(p) {
GPS_LAT = p.coords.latitude.toFixed(6);
GPS_LNG = p.coords.longitude.toFixed(6);
document.getElementById(‘lokasi-info’).className = ‘gps-status success’;
document.getElementById(‘lokasi-info’).innerHTML = ’<i class="fa-solid fa-location-dot"></i> ‘+GPS_LAT+’, ’+GPS_LNG;
},
function() {
GPS_LAT = GPS_LNG = null;
document.getElementById(‘lokasi-info’).className = ‘gps-status error’;
document.getElementById(‘lokasi-info’).innerHTML = ‘<i class="fa-solid fa-triangle-exclamation"></i> Lokasi tidak tersedia’;
}
);
}
}

function closeModalAbsen() { document.getElementById(‘modal-absen’).classList.remove(‘show’); stopCam(); }
function stopCam() { if(CAM){CAM.getTracks().forEach(function(t){t.stop();});CAM=null;} }

function ambilFoto() {
var v=document.getElementById(‘camera-video’), cv=document.getElementById(‘camera-canvas’);
cv.width=v.videoWidth||320; cv.height=v.videoHeight||240;
cv.getContext(‘2d’).drawImage(v,0,0);
FOTO = cv.toDataURL(‘image/jpeg’,.7);
document.getElementById(‘foto-preview’).src = FOTO;
document.getElementById(‘foto-preview-box’).style.display  = ‘block’;
document.getElementById(‘camera-container’).style.display  = ‘none’;
document.getElementById(‘absen-actions’).style.display     = ‘none’;
document.getElementById(‘absen-confirm-actions’).style.display = ‘flex’;
stopCam();
}

async function retakeFoto() {
FOTO = null;
document.getElementById(‘foto-preview-box’).style.display  = ‘none’;
document.getElementById(‘camera-container’).style.display  = ‘block’;
document.getElementById(‘absen-actions’).style.display     = ‘flex’;
document.getElementById(‘absen-confirm-actions’).style.display = ‘none’;
try { CAM=await navigator.mediaDevices.getUserMedia({video:{facingMode:‘user’},audio:false}); document.getElementById(‘camera-video’).srcObject=CAM; } catch(_){}
}

async function submitAbsen() {
var now   = new Date();
var ts    = now.toTimeString().slice(0,8);
var today = tgl();
showLoading();
try {
var jdw = T_JADWAL;
if (!jdw) {
var jr = await sb(‘jadwal’,‘GET’,null,’?nama=eq.’+enc(CU.nama_lengkap)+’&tanggal=eq.’+today+’&select=*’);
jdw = jr[0] || null;
}
if (ABSEN_MODE === ‘masuk’) {
var ex = await sb(‘absensi’,‘GET’,null,’?nama=eq.’+enc(CU.nama_lengkap)+’&tanggal=eq.’+today+’&select=id’);
if (ex.length) { toast(‘Sudah absen masuk hari ini’,‘error’); closeModalAbsen(); return; }
var st=‘Tepat Waktu’, ket=’’;
if (jdw && jdw.jam_masuk) {
var parts=jdw.jam_masuk.split(’:’);
var jdwM=parseInt(parts[0])*60+parseInt(parts[1]);
var nowM=now.getHours()*60+now.getMinutes();
if (nowM > jdwM+10) { st=‘Terlambat’; ket=‘Terlambat ‘+(nowM-jdwM)+’ menit’; }
}
await sb(‘absensi’,‘POST’,{
nama:CU.nama_lengkap, tanggal:today, waktu_masuk:ts,
lat_masuk:GPS_LAT, lng_masuk:GPS_LNG, foto_masuk:FOTO,
status_masuk:st, ket_telat:ket,
shift_id:jdw?jdw.shift_id:null, nama_shift:jdw?jdw.nama_shift:null,
});
toast(‘Absen masuk berhasil · ‘+st,‘success’);
} else {
var ex2 = await sb(‘absensi’,‘GET’,null,’?nama=eq.’+enc(CU.nama_lengkap)+’&tanggal=eq.’+today+’&select=id’);
if (!ex2.length) { toast(‘Absen masuk belum ada’,‘error’); closeModalAbsen(); return; }
var sp=‘Normal’;
if (jdw && jdw.jam_pulang) {
var pp=jdw.jam_pulang.split(’:’);
var jdwP=parseInt(pp[0])*60+parseInt(pp[1]);
if (now.getHours()*60+now.getMinutes() < jdwP-10) sp=‘Pulang Awal’;
}
await sb(‘absensi?id=eq.’+ex2[0].id,‘PATCH’,{
waktu_pulang:ts, lat_pulang:GPS_LAT, lng_pulang:GPS_LNG,
foto_pulang:FOTO, status_pulang:sp,
});
toast(‘Absen pulang berhasil!’,‘success’);
}
closeModalAbsen();
await navigateTo(‘dashboard’);
} catch(e) { toast(’Gagal absen: ’+e.message,‘error’); }
finally { hideLoading(); }
}

// ============================================================
// RIWAYAT ABSENSI — Staff (hanya miliknya)
// ============================================================
async function pgRiwayatAbsensi() {
var def = new Date().toISOString().slice(0,7);
C().innerHTML =
‘<div class="page-header-row"><h2><i class="fa-solid fa-fingerprint"></i> Riwayat Absensi Saya</h2></div>’ +
‘<div class="card" style="padding:12px;margin-bottom:12px;">’ +
‘<label style="'+LS()+'">PILIH BULAN</label>’ +
‘<input type="month" id="ab-bulan" value="'+def+'" onchange="loadRiwayat()" style="width:100%;'+IS()+'">’ +
‘</div>’ +
‘<div id="riwayat-c">’ + loadingH() + ‘</div>’;
await loadRiwayat();
}

async function loadRiwayat() {
var b = document.getElementById(‘ab-bulan’); if(!b) return;
var bv = b.value; if(!bv) return;
var ym=bv.split(’-’), y=ym[0], m=ym[1];
var from=y+’-’+m+’-01’, to=y+’-’+m+’-’+String(new Date(parseInt(y),parseInt(m),0).getDate()).padStart(2,‘0’);
var c = document.getElementById(‘riwayat-c’); c.innerHTML=loadingH();
try {
var list = await sb(‘absensi’,‘GET’,null,
‘?nama=eq.’+enc(CU.nama_lengkap)+’&tanggal=gte.’+from+’&tanggal=lte.’+to+’&order=tanggal.desc&select=*’);
var hadir  = list.filter(function(a){return a.waktu_masuk;}).length;
var telat  = list.filter(function(a){return a.status_masuk===‘Terlambat’;}).length;
var pulang = list.filter(function(a){return a.waktu_pulang;}).length;
c.innerHTML =
‘<div class="stats-grid" style="margin-bottom:12px;">’ +
‘<div class="stat-card green"><div class="stat-icon"><i class="fa-solid fa-calendar-check"></i></div><div class="stat-val">’+hadir+’</div><div class="stat-label">Hadir</div></div>’ +
‘<div class="stat-card red"><div class="stat-icon"><i class="fa-solid fa-clock"></i></div><div class="stat-val">’+telat+’</div><div class="stat-label">Terlambat</div></div>’ +
‘<div class="stat-card blue"><div class="stat-icon"><i class="fa-solid fa-right-from-bracket"></i></div><div class="stat-val">’+pulang+’</div><div class="stat-label">Pulang</div></div>’ +
‘</div>’ +
(!list.length ? emptyH(‘Tidak ada data bulan ini’) :
list.map(function(a) {
return ‘<div class="riwayat-card">’ +
‘<div class="riwayat-tanggal"><i class="fa-solid fa-calendar-day"></i> ‘+fdLong(a.tanggal)+’ ‘+sBadge(a.status_masuk)+(a.ket_telat?’<span class="ket-telat-mini"><i class="fa-solid fa-clock"></i> ‘+a.ket_telat+’</span>’:’’)+’</div>’ +
‘<div class="riwayat-rows">’ +
‘<div class="riwayat-row"><div class="riwayat-tipe masuk"><i class="fa-solid fa-arrow-right-to-bracket"></i> Masuk</div><div class="riwayat-detail"><div class="riwayat-waktu">’+(a.waktu_masuk?ft(a.waktu_masuk):’—’)+’</div>’+(a.lat_masuk?’<a class="riwayat-lokasi" href="https://maps.google.com/?q='+a.lat_masuk+','+a.lng_masuk+'" target="_blank"><i class="fa-solid fa-location-dot"></i> Peta</a>’:’’)+’</div></div>’ +
‘<div class="riwayat-row"><div class="riwayat-tipe pulang"><i class="fa-solid fa-arrow-right-from-bracket"></i> Pulang</div><div class="riwayat-detail"><div class="riwayat-waktu">’+(a.waktu_pulang?ft(a.waktu_pulang):’—’)+’</div>’+(a.lat_pulang?’<a class="riwayat-lokasi" href="https://maps.google.com/?q='+a.lat_pulang+','+a.lng_pulang+'" target="_blank"><i class="fa-solid fa-location-dot"></i> Peta</a>’:’’)+’</div></div>’ +
‘</div>’ +
‘</div>’;
}).join(’’));
} catch(e) { c.innerHTML=errH(e.message); }
}

// ============================================================
// JADWAL SAYA — Staff
// ============================================================
async function pgJadwalSaya() {
var def = new Date().toISOString().slice(0,7);
C().innerHTML =
‘<div class="page-header-row"><h2><i class="fa-solid fa-calendar-days"></i> Jadwal Saya</h2></div>’ +
‘<div class="card" style="padding:12px;margin-bottom:12px;">’ +
‘<input type="month" id="jd-bulan" value="'+def+'" onchange="loadJdw()" style="width:100%;'+IS()+'">’ +
‘</div>’ +
‘<div id="jd-c">’+loadingH()+’</div>’;
await loadJdw();
}

async function loadJdw() {
var b=document.getElementById(‘jd-bulan’); if(!b) return;
var bv=b.value; if(!bv) return;
var ym=bv.split(’-’),y=ym[0],m=ym[1];
var from=y+’-’+m+’-01’,to=y+’-’+m+’-’+String(new Date(parseInt(y),parseInt(m),0).getDate()).padStart(2,‘0’);
var c=document.getElementById(‘jd-c’); c.innerHTML=loadingH();
try {
var list=await sb(‘jadwal’,‘GET’,null,’?nama=eq.’+enc(CU.nama_lengkap)+’&tanggal=gte.’+from+’&tanggal=lte.’+to+’&order=tanggal.asc&select=*’);
if(!list.length){c.innerHTML=emptyH(‘Tidak ada jadwal bulan ini’);return;}
var today=tgl();
c.innerHTML=’<div class="card" style="padding:8px 0;">’+
list.map(function(j){
var isT=j.tanggal===today,isP=j.tanggal<today;
var d=new Date(j.tanggal+‘T00:00:00’),sc=shiftC(j.nama_shift);
return ‘<div class="jadwal-item'+(isT?' jadwal-today':isP?' jadwal-past':'')+'">’+
‘<div class="jadwal-tgl"><div class="jadwal-tgl-num" style="color:'+(isT?'#60a5fa':'#e2e8f0')+'">’+d.getDate()+’</div><div class="jadwal-tgl-hari">’+d.toLocaleDateString(‘id-ID’,{weekday:‘short’})+’</div></div>’+
‘<div class="jadwal-shift-badge" style="background:'+sc.bg+';color:'+sc.text+';"><i class="fa-solid fa-clock"></i> ‘+(j.nama_shift||‘Shift’)+’</div>’+
‘<div class="jadwal-jam"><span><i class="fa-solid fa-arrow-right-to-bracket"></i> ‘+ft(j.jam_masuk)+’</span><span><i class="fa-solid fa-arrow-right-from-bracket"></i> ‘+ft(j.jam_pulang)+’</span></div>’+
(isT?’<span class="jadwal-today-badge">HARI INI</span>’:’’)+
‘</div>’;
}).join(’’)+
‘</div>’;
} catch(e){c.innerHTML=errH(e.message);}
}

// ============================================================
// PENGAJUAN — Staff
// ============================================================
async function pgPengajuan() {
try {
var list=await sb(‘pengajuan’,‘GET’,null,’?nama_karyawan=eq.’+enc(CU.nama_lengkap)+’&order=tgl_submit.desc&select=*’);
C().innerHTML=
‘<div class="page-header-row"><h2><i class="fa-solid fa-file-medical"></i> Pengajuan Saya</h2></div>’+
‘<div style="display:flex;gap:8px;margin-bottom:12px;">’+
‘<button class="btn-outline btn-sm" onclick="openPQ(\'Izin\')" style="flex:1;justify-content:center;"><i class="fa-solid fa-file-lines"></i> Izin</button>’+
‘<button class="btn-outline btn-sm" onclick="openPQ(\'Sakit\')" style="flex:1;justify-content:center;border-color:rgba(239,68,68,.4);color:#f87171;"><i class="fa-solid fa-notes-medical"></i> Sakit</button>’+
‘<button class="btn-outline btn-sm" onclick="openPQ(\'Cuti\')" style="flex:1;justify-content:center;border-color:rgba(16,185,129,.4);color:#34d399;"><i class="fa-solid fa-umbrella-beach"></i> Cuti</button>’+
‘</div>’+
(!list.length?emptyH(‘Belum ada pengajuan’):list.map(function(p){return cPQ(p,false);}).join(’’));
} catch(e){C().innerHTML=errH(e.message);}
}

function openPQ(tipe) {
document.getElementById(‘pengajuan-tipe’).value = tipe;
document.getElementById(‘pengajuan-ket’).value  = ‘’;
document.getElementById(‘pengajuan-link’).value = ‘’;
document.getElementById(‘modal-pengajuan’).classList.add(‘show’);
}
function closeModalPengajuan() { document.getElementById(‘modal-pengajuan’).classList.remove(‘show’); }

async function submitPengajuan() {
var payload={nama_karyawan:CU.nama_lengkap,tipe_izin:document.getElementById(‘pengajuan-tipe’).value,keterangan:document.getElementById(‘pengajuan-ket’).value.trim(),link_surat_sakit:document.getElementById(‘pengajuan-link’).value.trim()||null,status_approve:‘Pending’};
if(!payload.keterangan){toast(‘Isi keterangan’,‘error’);return;}
showLoading();
try{await sb(‘pengajuan’,‘POST’,payload);toast(‘Pengajuan terkirim!’,‘success’);closeModalPengajuan();if(PAGE===‘pengajuan’)await pgPengajuan();}
catch(e){toast(’Gagal: ’+e.message,‘error’);}finally{hideLoading();}
}

function cPQ(p,admin) {
var sc={Pending:‘warning’,Disetujui:‘success’,Ditolak:‘danger’}[p.status_approve]||’’;
var ic={Izin:‘fa-file-lines’,Sakit:‘fa-notes-medical’,Cuti:‘fa-umbrella-beach’}[p.tipe_izin]||‘fa-file’;
return ‘<div class="pengajuan-card">’+
‘<div class="pengajuan-header"><div>’+(admin?’<div style="font-size:14px;font-weight:700;margin-bottom:2px;">’+p.nama_karyawan+’</div>’:’’)+
‘<div class="pengajuan-tipe"><i class="fa-solid '+ic+'"></i> ‘+p.tipe_izin+’</div></div>’+
‘<span class="status-badge '+sc+'">’+p.status_approve+’</span></div>’+
‘<div class="pengajuan-ket">’+(p.keterangan||’-’)+’</div>’+
(p.link_surat_sakit?’<a class="btn-link" href="'+p.link_surat_sakit+'" target="_blank" style="display:inline-flex;margin-bottom:6px;"><i class="fa-solid fa-link"></i> Lihat Surat</a>’:’’)+
‘<div class="pengajuan-footer"><span style="font-size:12px;color:#475569;"><i class="fa-regular fa-clock"></i> ‘+fdT(p.tgl_submit)+’</span>’+
(admin&&p.status_approve===‘Pending’?’<div class="approve-actions"><button class="btn-approve" onclick="approvePQ('+p.id_pengajuan+',\'Disetujui\')"><i class="fa-solid fa-check"></i> Setujui</button><button class="btn-reject" onclick="approvePQ('+p.id_pengajuan+',\'Ditolak\')"><i class="fa-solid fa-xmark"></i> Tolak</button></div>’:’’)+
‘</div></div>’;
}

// ============================================================
// REKAP — Admin
// ============================================================
async function pgRekap() {
var today=tgl(),ym=today.split(’-’),y=ym[0],m=ym[1];
C().innerHTML=
‘<div class="page-header-row"><h2><i class="fa-solid fa-chart-bar"></i> Rekap Absensi</h2><button class="btn-outline btn-sm" onclick="exportRekap()"><i class="fa-solid fa-file-excel"></i> Export CSV</button></div>’+
‘<div class="card" style="padding:14px;margin-bottom:12px;">’+
‘<div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-bottom:8px;">’+
‘<div><label style="'+LS()+'">BULAN</label><input type="month" id="rek-bulan" value="'+y+'-'+m+'" style="'+IS()+'" onchange="syncRekap()"></div>’+
‘<div><label style="'+LS()+'">SHIFT</label><select id="rek-shift" style="'+SS()+'"><option value="">Semua Shift</option></select></div>’+
‘</div>’+
‘<div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-bottom:8px;">’+
‘<div><label style="'+LS()+'">DARI</label><input type="date" id="rek-dari" style="'+IS()+'"></div>’+
‘<div><label style="'+LS()+'">SAMPAI</label><input type="date" id="rek-sampai" style="'+IS()+'"></div>’+
‘</div>’+
‘<input type="text" id="rek-cari" placeholder="🔍 Cari nama..." oninput="loadRekap()" style="width:100%;'+IS()+'margin-bottom:8px;">’+
‘<button class="btn-primary full" onclick="loadRekap()"><i class="fa-solid fa-magnifying-glass"></i> Tampilkan</button>’+
‘</div>’+
‘<div id="rek-c">’+loadingH()+’</div>’;
await loadShiftSel(‘rek-shift’);
var fd=y+’-’+m+’-01’,ld=y+’-’+m+’-’+String(new Date(parseInt(y),parseInt(m),0).getDate()).padStart(2,‘0’);
document.getElementById(‘rek-dari’).value=fd; document.getElementById(‘rek-sampai’).value=ld;
await loadRekap();
}

function syncRekap(){var b=document.getElementById(‘rek-bulan’).value;if(!b)return;var ym=b.split(’-’),y=ym[0],m=ym[1];document.getElementById(‘rek-dari’).value=y+’-’+m+’-01’;document.getElementById(‘rek-sampai’).value=y+’-’+m+’-’+String(new Date(parseInt(y),parseInt(m),0).getDate()).padStart(2,‘0’);loadRekap();}

async function loadRekap(){
var dari=document.getElementById(‘rek-dari’)?.value,sampai=document.getElementById(‘rek-sampai’)?.value;
var cari=(document.getElementById(‘rek-cari’)?.value||’’).toLowerCase();
var shiftF=document.getElementById(‘rek-shift’)?.value||’’;
if(!dari||!sampai)return;
var c=document.getElementById(‘rek-c’); c.innerHTML=loadingH();
try{
var q=’?tanggal=gte.’+dari+’&tanggal=lte.’+sampai+’&order=tanggal.desc,nama.asc&select=*’;
if(shiftF)q+=’&nama_shift=eq.’+enc(shiftF);
var list=await sb(‘absensi’,‘GET’,null,q);
if(cari)list=list.filter(function(a){return a.nama.toLowerCase().includes(cari);});
REKAP_DATA=list;
if(!list.length){c.innerHTML=emptyH(‘Tidak ada data’);return;}
var bN={};
list.forEach(function(a){if(!bN[a.nama])bN[a.nama]={hadir:0,telat:0,pulang:0,lupa:0};if(a.waktu_masuk)bN[a.nama].hadir++;if(a.status_masuk===‘Terlambat’)bN[a.nama].telat++;if(a.waktu_pulang)bN[a.nama].pulang++;if(a.waktu_masuk&&!a.waktu_pulang)bN[a.nama].lupa++;});
var maxH=1;Object.values(bN).forEach(function(s){if(s.hadir>maxH)maxH=s.hadir;});
var html=
‘<div class="import-stats-row">’+
‘<div class="import-stat-box blue"><div class="import-stat-num">’+list.length+’</div><div class="import-stat-lab">Total</div></div>’+
‘<div class="import-stat-box green"><div class="import-stat-num">’+list.filter(function(a){return a.waktu_masuk;}).length+’</div><div class="import-stat-lab">Hadir</div></div>’+
‘<div class="import-stat-box red"><div class="import-stat-num">’+list.filter(function(a){return a.status_masuk===‘Terlambat’;}).length+’</div><div class="import-stat-lab">Terlambat</div></div>’+
‘<div class="import-stat-box teal"><div class="import-stat-num">’+list.filter(function(a){return a.status_pulang===‘Pulang Awal’;}).length+’</div><div class="import-stat-lab">Pulang Awal</div></div>’+
‘</div>’+
‘<div class="card" style="margin-bottom:12px;"><h3><i class="fa-solid fa-chart-bar" style="color:#60a5fa"></i> Grafik Kehadiran</h3>’+
Object.keys(bN).sort(function(a,b){return bN[b].hadir-bN[a].hadir;}).map(function(n){var s=bN[n];return’<div style="margin-bottom:12px;"><div style="display:flex;justify-content:space-between;font-size:12px;margin-bottom:4px;"><span style="font-weight:600;">’+n+’</span><span style="color:#64748b;">’+s.hadir+’ hadir · <span style="color:#f87171;">’+s.telat+’ telat</span></span></div><div style="background:rgba(255,255,255,.06);border-radius:20px;height:10px;overflow:hidden;"><div style="height:100%;width:'+Math.round(s.hadir/maxH*100)+'%;background:linear-gradient(90deg,#3b82f6,#06b6d4);border-radius:20px;"></div></div></div>’;}).join(’’)+’</div>’+
‘<div class="card" style="margin-bottom:12px;"><h3><i class="fa-solid fa-users" style="color:#34d399"></i> Ringkasan</h3><div style="overflow-x:auto;"><table style="width:100%;border-collapse:collapse;font-size:12px;min-width:360px;"><thead><tr style="background:rgba(255,255,255,.04);"><th style="padding:8px 10px;text-align:left;color:#64748b;">Nama</th><th style="padding:8px 10px;text-align:center;color:#34d399;">Hadir</th><th style="padding:8px 10px;text-align:center;color:#f87171;">Telat</th><th style="padding:8px 10px;text-align:center;color:#60a5fa;">Pulang</th><th style="padding:8px 10px;text-align:center;color:#fbbf24;">Lupa Pulang</th></tr></thead><tbody>’+
Object.keys(bN).map(function(n){var s=bN[n];return’<tr style="border-top:1px solid rgba(255,255,255,.04);"><td style="padding:8px 10px;font-weight:600;">’+n+’</td><td style="padding:8px 10px;text-align:center;"><span class="status-badge success">’+s.hadir+’</span></td><td style="padding:8px 10px;text-align:center;"><span class="status-badge danger">’+s.telat+’</span></td><td style="padding:8px 10px;text-align:center;"><span class="status-badge" style="background:rgba(59,130,246,.14);color:#60a5fa;">’+s.pulang+’</span></td><td style="padding:8px 10px;text-align:center;"><span class="status-badge warning">’+s.lupa+’</span></td></tr>’;}).join(’’)+
‘</tbody></table></div></div>’+
‘<div class="card"><h3><i class="fa-solid fa-list" style="color:#a78bfa"></i> Detail (’+list.length+’)</h3><div style="overflow-x:auto;"><table style="width:100%;border-collapse:collapse;font-size:12px;min-width:480px;"><thead><tr style="background:rgba(255,255,255,.04);"><th style="padding:8px 10px;text-align:left;color:#64748b;">Tanggal</th><th style="padding:8px 10px;text-align:left;color:#64748b;">Nama</th><th style="padding:8px 10px;text-align:left;color:#64748b;">Shift</th><th style="padding:8px 10px;text-align:center;color:#64748b;">Masuk</th><th style="padding:8px 10px;text-align:center;color:#64748b;">Pulang</th><th style="padding:8px 10px;text-align:center;color:#64748b;">Status</th></tr></thead><tbody>’+
list.map(function(a){return’<tr style="border-top:1px solid rgba(255,255,255,.04);"><td style="padding:7px 10px;color:#94a3b8;white-space:nowrap;">’+fd(a.tanggal)+’</td><td style="padding:7px 10px;font-weight:600;">’+a.nama+’</td><td style="padding:7px 10px;">’+(a.nama_shift||’-’)+’</td><td style="padding:7px 10px;text-align:center;">’+(a.waktu_masuk?ft(a.waktu_masuk):’—’)+’</td><td style="padding:7px 10px;text-align:center;">’+(a.waktu_pulang?ft(a.waktu_pulang):’—’)+’</td><td style="padding:7px 10px;text-align:center;">’+sBadge(a.status_masuk)+’</td></tr>’;}).join(’’)+
‘</tbody></table></div></div>’;
c.innerHTML=html;
}catch(e){c.innerHTML=errH(e.message);}
}

function exportRekap(){if(!REKAP_DATA.length){toast(‘Tidak ada data’,‘error’);return;}dlCSV([[‘Tanggal’,‘Nama’,‘Shift’,‘Masuk’,‘Pulang’,‘Status Masuk’,‘Status Pulang’,‘Ket Telat’]].concat(REKAP_DATA.map(function(a){return[a.tanggal,a.nama,a.nama_shift||’’,a.waktu_masuk||’’,a.waktu_pulang||’’,a.status_masuk||’’,a.status_pulang||’’,a.ket_telat||’’];})),‘rekap_’+Date.now()+’.csv’);toast(‘Export berhasil!’,‘success’);}

// ============================================================
// KELOLA JADWAL — Admin
// ============================================================
async function pgKelolaJadwal(){
var today=tgl(),ym=today.split(’-’),y=ym[0],m=ym[1];
C().innerHTML=
‘<div class="page-header-row"><h2><i class="fa-solid fa-table"></i> Kelola Jadwal</h2></div>’+
‘<div style="display:flex;gap:8px;margin-bottom:14px;">’+
‘<button id="tab-m" class="btn-primary btn-sm" onclick="swTab(\'m\')"><i class="fa-solid fa-pen"></i> Input Manual</button>’+
‘<button id="tab-i" class="btn-outline btn-sm" onclick="swTab(\'i\')"><i class="fa-solid fa-upload"></i> Import CSV</button>’+
‘</div>’+
‘<div id="pnl-m">’+
‘<div class="card" style="padding:14px;margin-bottom:12px;">’+
‘<div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-bottom:8px;">’+
‘<div><label style="'+LS()+'">BULAN</label><input type="month" id="kj-bulan" value="'+y+'-'+m+'" style="'+IS()+'"></div>’+
‘<div><label style="'+LS()+'">KARYAWAN</label><select id="kj-user" style="'+SS()+'"><option value="">Pilih Karyawan</option></select></div>’+
‘</div>’+
‘<button class="btn-primary full" onclick="loadGrid()"><i class="fa-solid fa-table"></i> Tampilkan Grid</button>’+
‘</div>’+
‘<div id="kj-grid"></div>’+
‘</div>’+
‘<div id="pnl-i" style="display:none;">’+
‘<div class="card import-guide" style="margin-bottom:12px;"><h3><i class="fa-solid fa-circle-info" style="color:#60a5fa"></i> Cara Import dari Excel/CSV</h3>’+
‘<ol><li>Download template CSV (nama karyawan sudah otomatis terisi)</li><li>Buka di Excel / Google Sheets</li><li>Isi kolom tanggal dengan nama shift persis (Pagi/Sore/Malam) atau kosongkan untuk libur</li><li>Save As CSV → upload di bawah</li></ol>’+
‘<div class="import-format-box"><table class="import-table-preview"><thead><tr><th>Nama</th><th>01</th><th>02</th><th>03</th><th>…</th></tr></thead><tbody><tr><td>Budi</td><td><span class="shift-chip pagi">Pagi</span></td><td><span class="shift-chip sore">Sore</span></td><td><span class="shift-chip libur">Libur</span></td><td style="color:#475569;">…</td></tr></tbody></table></div>’+
‘<p class="import-tip"><i class="fa-solid fa-lightbulb" style="color:#fbbf24"></i> Nama karyawan harus <b>sama persis</b> dengan data di sistem.</p>’+
‘</div>’+
‘<div class="card" style="padding:14px;">’+
‘<h3 style="margin-bottom:10px;"><i class="fa-solid fa-download" style="color:#34d399"></i> Step 1 — Download Template</h3>’+
‘<div style="display:flex;gap:8px;align-items:flex-end;flex-wrap:wrap;margin-bottom:16px;">’+
‘<div style="flex:1;min-width:140px;"><label style="'+LS()+'">BULAN</label><input type="month" id="imp-bulan" value="'+y+'-'+m+'" style="'+IS()+'"></div>’+
‘<button class="btn-success" onclick="dlTemplate()" style="height:40px;white-space:nowrap;"><i class="fa-solid fa-download"></i> Download Template CSV</button>’+
‘</div>’+
‘<h3 style="margin-bottom:10px;"><i class="fa-solid fa-upload" style="color:#a78bfa"></i> Step 2 — Upload CSV</h3>’+
‘<div onclick="document.getElementById(\'imp-file\').click()" style="border:2px dashed rgba(255,255,255,.15);border-radius:12px;padding:24px;text-align:center;cursor:pointer;" onmouseover="this.style.borderColor=\'rgba(59,130,246,.5)\'" onmouseout="this.style.borderColor=\'rgba(255,255,255,.15)\'">’+
‘<i class="fa-solid fa-file-csv" style="font-size:40px;color:#64748b;display:block;margin-bottom:10px;"></i>’+
‘<p style="color:#64748b;font-size:13px;">Klik untuk pilih file CSV</p>’+
‘</div>’+
‘<input type="file" id="imp-file" accept=".csv" style="display:none;" onchange="previewCSV()">’+
‘<div id="imp-prev" style="margin-top:12px;"></div>’+
‘</div>’+
‘</div>’;
await Promise.all([loadUserSel(‘kj-user’), ensureShifts()]);
}

function swTab(t){document.getElementById(‘pnl-m’).style.display=t===‘m’?’’:‘none’;document.getElementById(‘pnl-i’).style.display=t===‘i’?’’:‘none’;document.getElementById(‘tab-m’).className=t===‘m’?‘btn-primary btn-sm’:‘btn-outline btn-sm’;document.getElementById(‘tab-i’).className=t===‘i’?‘btn-primary btn-sm’:‘btn-outline btn-sm’;}

async function loadGrid(){
var bulan=document.getElementById(‘kj-bulan’)?.value,nama=document.getElementById(‘kj-user’)?.value;
var area=document.getElementById(‘kj-grid’);
if(!bulan||!nama){area.innerHTML=emptyH(‘Pilih bulan dan karyawan’);return;}
var ym=bulan.split(’-’),y=ym[0],m=ym[1],lastD=new Date(parseInt(y),parseInt(m),0).getDate();
var from=y+’-’+m+’-01’,to=y+’-’+m+’-’+String(lastD).padStart(2,‘0’);
area.innerHTML=loadingH();
try{
await ensureShifts();
var ex=await sb(‘jadwal’,‘GET’,null,’?nama=eq.’+enc(nama)+’&tanggal=gte.’+from+’&tanggal=lte.’+to+’&select=*’);
var jMap={};ex.forEach(function(j){jMap[j.tanggal]=j;});
var today=tgl(),opts=’<option value="">— Libur —</option>’+SHIFTS.map(function(s){return’<option value="'+s.id+'">’+s.nama_shift+’</option>’;}).join(’’);
var days=[];for(var d=1;d<=lastD;d++)days.push(y+’-’+m+’-’+String(d).padStart(2,‘0’));
area.innerHTML=’<div class="card" style="padding:14px;">’+
‘<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:14px;flex-wrap:wrap;gap:8px;">’+
‘<h3 style="margin:0;"><i class="fa-solid fa-calendar-days" style="color:#60a5fa"></i> ‘+nama+’ — ‘+new Date(parseInt(y),parseInt(m)-1).toLocaleDateString(‘id-ID’,{month:‘long’,year:‘numeric’})+’</h3>’+
‘<button class="btn-primary btn-sm" onclick="saveGrid(\''+nama+'\',\''+y+'\',\''+m+'\','+lastD+')"><i class="fa-solid fa-save"></i> Simpan Jadwal</button>’+
‘</div>’+
‘<div class="jadwal-grid">’+
days.map(function(t2){var d2=new Date(t2+‘T00:00:00’),isSun=d2.getDay()===0,isT=t2===today;return’<div class="jadwal-grid-item'+(isT?' today':'')+(isSun?' minggu':'')+'"><div class="jadwal-grid-tgl"><span class="jadwal-grid-num" style="'+(isT?'color:#60a5fa;':'')+'">’+d2.getDate()+’</span><span class="jadwal-grid-hari">’+d2.toLocaleDateString(‘id-ID’,{weekday:‘short’})+’</span></div><select class="jadwal-grid-sel" id="sel-'+t2+'">’+opts+’</select></div>’;}).join(’’)+
‘</div></div>’;
days.forEach(function(t2){var sel=document.getElementById(‘sel-’+t2);if(sel&&jMap[t2])sel.value=jMap[t2].shift_id||’’;});
}catch(e){area.innerHTML=errH(e.message);}
}

async function saveGrid(nama,y,m,lastD){
showLoading();
try{
await sb(‘jadwal?nama=eq.’+enc(nama)+’&tanggal=gte.’+y+’-’+m+’-01&tanggal=lte.’+y+’-’+m+’-’+String(lastD).padStart(2,‘0’),‘DELETE’);
var n=0;
for(var d=1;d<=lastD;d++){var t2=y+’-’+m+’-’+String(d).padStart(2,‘0’),sel=document.getElementById(‘sel-’+t2);if(!sel||!sel.value)continue;var sh=null;SHIFTS.forEach(function(s){if(s.id==sel.value)sh=s;});if(!sh)continue;await sb(‘jadwal’,‘POST’,{nama:nama,tanggal:t2,shift_id:sh.id,nama_shift:sh.nama_shift,jam_masuk:sh.jam_masuk,jam_pulang:sh.jam_pulang});n++;}
toast(‘✅ Jadwal ‘+nama+’ disimpan — ‘+n+’ hari aktif’,‘success’);
}catch(e){toast(’Gagal: ’+e.message,‘error’);}finally{hideLoading();}
}

async function dlTemplate(){
var b=document.getElementById(‘imp-bulan’)?.value;if(!b){toast(‘Pilih bulan’,‘error’);return;}
var ym=b.split(’-’),y=ym[0],m=ym[1],lastD=new Date(parseInt(y),parseInt(m),0).getDate();
var users=await sb(‘users’,‘GET’,null,’?status_akun=eq.Aktif&select=nama_lengkap&order=nama_lengkap.asc’);
var cols=[‘Nama’];for(var d=1;d<=lastD;d++)cols.push(String(d).padStart(2,‘0’));
var rows=users.map(function(u){var r=[u.nama_lengkap];for(var d=1;d<=lastD;d++)r.push(’’);return r;});
dlCSV([cols].concat(rows),‘template_jadwal_’+b+’.csv’);
toast(‘Template didownload!’,‘success’);
}

async function previewCSV(){
var file=document.getElementById(‘imp-file’).files[0];
var b=document.getElementById(‘imp-bulan’)?.value;
if(!file)return;if(!b){toast(‘Pilih bulan di Step 1’,‘error’);return;}
var ym=b.split(’-’),y=ym[0],m=ym[1],text=await file.text();
var lines=text.trim().split(/\r?\n/).map(function(l){var r=[],cur=’’,q=false;for(var i=0;i<l.length;i++){var ch=l[i];if(ch===’”’)q=!q;else if(ch===’,’&&!q){r.push(cur.trim());cur=’’;}else cur+=ch;}r.push(cur.trim());return r;});
var header=lines[0],dataRows=lines.slice(1).filter(function(r){return r[0]&&r[0].trim();});
await ensureShifts();
var shMap={};SHIFTS.forEach(function(s){shMap[s.nama_shift.toLowerCase()]=s;});
var errs=[],rows=[];
dataRows.forEach(function(row){var nama=row[0]&&row[0].trim();if(!nama)return;for(var i=1;i<header.length;i++){var v=row[i]&&row[i].trim();if(!v||v.toLowerCase()===‘libur’||v===’-’)continue;var sh=shMap[v.toLowerCase()];if(!sh){errs.push(’”’+nama+’” tgl ‘+header[i]+’: shift “’+v+’” tidak ditemukan’);return;}var d=header[i].trim().padStart(2,‘0’);rows.push({nama:nama,tanggal:y+’-’+m+’-’+d,shift_id:sh.id,nama_shift:sh.nama_shift,jam_masuk:sh.jam_masuk,jam_pulang:sh.jam_pulang});}});
IMP_ROWS=rows;IMP_BULAN=b;
var namaSet={};rows.forEach(function(r){namaSet[r.nama]=true;});var ns=Object.keys(namaSet);
document.getElementById(‘imp-prev’).innerHTML=
(errs.length?’<div class="import-error-box" style="margin-bottom:12px;"><p><i class="fa-solid fa-triangle-exclamation"></i> ‘+errs.length+’ baris bermasalah:</p>’+errs.slice(0,5).map(function(e){return’<div class="import-error-item">• ‘+e+’</div>’;}).join(’’)+(errs.length>5?’<div class="import-error-item" style="color:#94a3b8;">…+’+( errs.length-5)+’ lainnya</div>’:’’)+’</div>’:’’)+
‘<div style="background:rgba(59,130,246,.08);border:1px solid rgba(59,130,246,.2);border-radius:12px;padding:14px;margin-bottom:12px;">’+
‘<div style="font-weight:700;color:#60a5fa;margin-bottom:8px;"><i class="fa-solid fa-table"></i> Preview — ‘+file.name+’</div>’+
‘<div style="font-size:13px;color:#94a3b8;line-height:1.9;">📋 ‘+dataRows.length+’ baris · 👥 ‘+ns.length+’ karyawan · ✅ ‘+rows.length+’ jadwal valid</div>’+
‘</div>’+
(rows.length?’<button class="btn-primary full" id="btn-imp" onclick="doImport()"><i class="fa-solid fa-upload"></i> Import ‘+rows.length+’ Jadwal Sekarang</button>’:emptyH(‘Tidak ada data valid’));
}

async function doImport(){
if(!IMP_ROWS.length){toast(‘Tidak ada data’,‘error’);return;}
var ym=IMP_BULAN.split(’-’),y=ym[0],m=ym[1];
if(!confirm(‘Import ‘+IMP_ROWS.length+’ jadwal? Jadwal lama bulan ini akan dihapus per karyawan.’))return;
var btn=document.getElementById(‘btn-imp’);if(btn)btn.disabled=true;
showLoading();
try{
var from=y+’-’+m+’-01’,to=y+’-’+m+’-’+String(new Date(parseInt(y),parseInt(m),0).getDate()).padStart(2,‘0’);
var nsObj={};IMP_ROWS.forEach(function(r){nsObj[r.nama]=true;});var ns=Object.keys(nsObj);
for(var i=0;i<ns.length;i++)await sb(‘jadwal?nama=eq.’+enc(ns[i])+’&tanggal=gte.’+from+’&tanggal=lte.’+to,‘DELETE’);
var ok=0;for(var j=0;j<IMP_ROWS.length;j++){await sb(‘jadwal’,‘POST’,IMP_ROWS[j]);ok++;}
toast(‘Import berhasil: ‘+ok+’ jadwal, ‘+ns.length+’ karyawan’,‘success’);
document.getElementById(‘imp-prev’).innerHTML=’<div class="import-result-box"><div class="result-title"><i class="fa-solid fa-circle-check"></i> Import Berhasil!</div><div class="import-result-item"><i class="fa-solid fa-check"></i> ‘+ok+’ jadwal disimpan</div><div class="import-result-item"><i class="fa-solid fa-users"></i> ‘+ns.length+’ karyawan: ‘+ns.join(’, ‘)+’</div></div>’;
IMP_ROWS=[];document.getElementById(‘imp-file’).value=’’;
}catch(e){toast(’Gagal: ’+e.message,‘error’);if(btn)btn.disabled=false;}finally{hideLoading();}
}

// ============================================================
// MASTER SHIFT
// ============================================================
async function pgKelolaShift(){
C().innerHTML=’<div class="page-header-row"><h2><i class="fa-solid fa-clock"></i> Master Shift</h2><button class="btn-primary btn-sm" onclick="openModalShift()"><i class="fa-solid fa-plus"></i> Tambah</button></div><div id="shift-list">’+loadingH()+’</div>’;
await loadShiftList();
}
async function loadShiftList(){
try{SHIFTS=await sb(‘shift’,‘GET’,null,’?select=*&order=nama_shift.asc’);var c=document.getElementById(‘shift-list’);if(!SHIFTS.length){c.innerHTML=emptyH(‘Belum ada shift’);return;}c.innerHTML=SHIFTS.map(function(s){var sc=shiftC(s.nama_shift);return’<div class="shift-card"><div class="shift-card-dot" style="background:'+sc.text+';"></div><div class="shift-card-info"><div class="shift-card-nama">’+s.nama_shift+’</div><div class="shift-card-jam"><i class="fa-solid fa-clock"></i> ‘+ft(s.jam_masuk)+’ – ‘+ft(s.jam_pulang)+’</div>’+(s.keterangan?’<div class="shift-card-ket">’+s.keterangan+’</div>’:’’)+’ </div><div style="display:flex;gap:6px;"><button class=“btn-icon edit” onclick='openModalShift(’+JSON.stringify(s)+’)' ><i class="fa-solid fa-pen"></i></button><button class="btn-icon delete" onclick="hapusShift('+s.id+')"><i class="fa-solid fa-trash"></i></button></div></div>’;}).join(’’);}catch(e){document.getElementById(‘shift-list’).innerHTML=errH(e.message);}
}
function openModalShift(s){s=s||null;document.getElementById(‘modal-shift-title’).textContent=s?‘Edit Shift’:‘Tambah Shift’;document.getElementById(‘shift-id’).value=s?s.id:’’;document.getElementById(‘shift-nama’).value=s?s.nama_shift:’’;document.getElementById(‘shift-masuk’).value=s?s.jam_masuk.slice(0,5):’’;document.getElementById(‘shift-pulang’).value=s?s.jam_pulang.slice(0,5):’’;document.getElementById(‘shift-ket’).value=s?s.keterangan||’’:’’;document.getElementById(‘modal-shift’).classList.add(‘show’);}
function closeModalShift(){document.getElementById(‘modal-shift’).classList.remove(‘show’);}
async function saveShift(){var id=document.getElementById(‘shift-id’).value,p={nama_shift:document.getElementById(‘shift-nama’).value.trim(),jam_masuk:document.getElementById(‘shift-masuk’).value,jam_pulang:document.getElementById(‘shift-pulang’).value,keterangan:document.getElementById(‘shift-ket’).value.trim()};if(!p.nama_shift||!p.jam_masuk||!p.jam_pulang){toast(‘Lengkapi data shift’,‘error’);return;}showLoading();try{if(id)await sb(‘shift?id=eq.’+id,‘PATCH’,p);else await sb(‘shift’,‘POST’,p);toast(id?‘Shift diperbarui’:‘Shift ditambahkan’,‘success’);closeModalShift();await loadShiftList();}catch(e){toast(’Gagal: ’+e.message,‘error’);}finally{hideLoading();}}
async function hapusShift(id){if(!confirm(‘Hapus shift ini?’))return;showLoading();try{await sb(‘shift?id=eq.’+id,‘DELETE’);toast(‘Shift dihapus’,‘success’);await loadShiftList();}catch(e){toast(’Gagal: ’+e.message,‘error’);}finally{hideLoading();}}

// ============================================================
// KELOLA USER
// ============================================================
async function pgKelolaUser(){
C().innerHTML=’<div class="page-header-row"><h2><i class="fa-solid fa-users"></i> Kelola Karyawan</h2><button class="btn-primary btn-sm" onclick="document.getElementById(\'modal-add-user\').classList.add(\'show\')"><i class="fa-solid fa-plus"></i> Tambah</button></div>’+
‘<input type="text" placeholder="🔍 Cari nama atau email..." oninput="filterUsers(this.value)" style="width:100%;'+IS()+'margin-bottom:10px;">’+
‘<div id="user-list">’+loadingH()+’</div>’;
await loadUserList();
}
async function loadUserList(){try{ALL_USERS=await sb(‘users’,‘GET’,null,’?select=*&order=nama_lengkap.asc’);renderUsers(ALL_USERS);}catch(e){document.getElementById(‘user-list’).innerHTML=errH(e.message);}}
function filterUsers(q){renderUsers(ALL_USERS.filter(function(u){return u.nama_lengkap.toLowerCase().includes(q.toLowerCase())||u.email.toLowerCase().includes(q.toLowerCase());}));}
function renderUsers(list){var c=document.getElementById(‘user-list’);if(!list.length){c.innerHTML=emptyH(‘Tidak ada karyawan’);return;}c.innerHTML=list.map(function(u){return’<div class="user-card"><div class="user-avatar"><i class="fa-solid fa-user"></i></div><div class="user-info"><div class="user-nama">’+u.nama_lengkap+’ <span class="role-badge">’+u.role+’</span></div><div class="user-email">’+u.email+’</div><span class="status-badge '+(u.status_akun==='Aktif'?'success':'danger')+'">’+u.status_akun+’</span></div><div class="user-actions"><button class=“btn-icon edit” onclick='openModalEdit(’+JSON.stringify(u)+’)' ><i class="fa-solid fa-pen"></i></button><button class="btn-icon delete" onclick="deleteUser(\''+u.id_karyawan+'\')"><i class="fa-solid fa-trash"></i></button></div></div>’;}).join(’’);}
function openModalEdit(u){document.getElementById(‘edit-user-id’).value=u.id_karyawan;document.getElementById(‘edit-nama’).value=u.nama_lengkap;document.getElementById(‘edit-nip’).value=u.email;document.getElementById(‘edit-jabatan’).value=u.role;document.getElementById(‘edit-status-user’).value=u.status_akun;document.getElementById(‘edit-password’).value=’’;document.getElementById(‘modal-edit-user’).classList.add(‘show’);}
function closeModalEdit(){document.getElementById(‘modal-edit-user’).classList.remove(‘show’);}
async function saveEditUser(){var id=document.getElementById(‘edit-user-id’).value,p={nama_lengkap:document.getElementById(‘edit-nama’).value.trim(),role:document.getElementById(‘edit-jabatan’).value,status_akun:document.getElementById(‘edit-status-user’).value};var np=document.getElementById(‘edit-password’).value;if(np)p.password=np;showLoading();try{await sb(‘users?id_karyawan=eq.’+id,‘PATCH’,p);toast(‘Data diperbarui’,‘success’);closeModalEdit();await loadUserList();if(id===CU.id_karyawan){CU=Object.assign({},CU,p);localStorage.setItem(‘gns_v5’,JSON.stringify(CU));}}catch(e){toast(‘Gagal: ‘+e.message,‘error’);}finally{hideLoading();}}
function closeModalAddUser(){d
function closeModalAddUser(){document.getElementById(‘modal-add-user’).classList.remove(‘show’);}
async function saveAddUser(){
var p={
nama_lengkap:document.getElementById(‘add-nama’).value.trim(),
email:document.getElementById(‘add-email’).value.trim(),
password:document.getElementById(‘add-password’).value,
role:document.getElementById(‘add-role’).value,
status_akun:‘Aktif’
};
if(!p.nama_lengkap||!p.email||!p.password){toast(‘Lengkapi semua field’,‘error’);return;}
showLoading();
try{
await sb(‘users’,‘POST’,p);
toast(‘Karyawan ditambahkan’,‘success’);
closeModalAddUser();
[‘add-nama’,‘add-email’,‘add-password’].forEach(function(id){document.getElementById(id).value=’’;});
await loadUserList();
}catch(e){toast(’Gagal: ’+e.message,‘error’);}finally{hideLoading();}
}

async function deleteUser(id){
if(id===CU.id_karyawan){toast(‘Tidak bisa hapus akun sendiri’,‘error’);return;}
if(!confirm(‘Hapus user ini?’))return;
showLoading();
try{await sb(‘users?id_karyawan=eq.’+id,‘DELETE’);toast(‘User dihapus’,‘success’);await loadUserList();}
catch(e){toast(’Gagal: ’+e.message,‘error’);}finally{hideLoading();}
}

// ============================================================
// APPROVE PENGAJUAN
// ============================================================
async function pgApprovePQ(){
C().innerHTML=
‘<div class="page-header-row"><h2><i class="fa-solid fa-check-to-slot"></i> Approve Izin/Cuti/Sakit</h2></div>’+
‘<div style="display:flex;gap:6px;margin-bottom:12px;flex-wrap:wrap;">’+
[[’’,‘Semua’],[‘Pending’,‘⏳ Pending’],[‘Disetujui’,‘✅ Disetujui’],[‘Ditolak’,‘❌ Ditolak’]].map(function(x){
return ‘<button id="pqt-'+(x[0]||'all')+'" class="btn-'+(x[0]===''?'primary':'outline')+' btn-sm" onclick="fPQ(''+x[0]+'')">’+x[1]+’</button>’;
}).join(’’)+
‘</div><div id="pq-list">’+loadingH()+’</div>’;
await loadPQ(’’);
}

async function fPQ(s){
[[’’,‘all’],[‘Pending’,‘Pending’],[‘Disetujui’,‘Disetujui’],[‘Ditolak’,‘Ditolak’]].forEach(function(x){
var el=document.getElementById(‘pqt-’+x[1]);
if(el) el.className=(x[0]===s?‘btn-primary’:‘btn-outline’)+’ btn-sm’;
});
await loadPQ(s);
}

async function loadPQ(s){
var q=’?order=tgl_submit.desc&select=*’;
if(s) q+=’&status_approve=eq.’+s;
var c=document.getElementById(‘pq-list’);
c.innerHTML=loadingH();
try{
var list=await sb(‘pengajuan’,‘GET’,null,q);
if(!list.length){c.innerHTML=emptyH(‘Tidak ada pengajuan’);return;}
c.innerHTML=list.map(function(p){return cPQ(p,true);}).join(’’);
}catch(e){c.innerHTML=errH(e.message);}
}

async function approvePQ(id,s){
if(!confirm((s===‘Disetujui’?‘Setujui’:‘Tolak’)+’ pengajuan ini?’))return;
showLoading();
try{
await sb(‘pengajuan?id_pengajuan=eq.’+id,‘PATCH’,{status_approve:s});
toast(‘Pengajuan ‘+s,‘success’);
await loadPQ(’’);
}catch(e){toast(’Gagal: ’+e.message,‘error’);}finally{hideLoading();}
}
var approvePengajuan = approvePQ;

// ============================================================
// PROFIL
// ============================================================
async function pgProfil(){
C().innerHTML=
‘<div class="card" style="margin-bottom:12px;">’+
‘<div class="profil-card">’+
‘<div class="profil-avatar"><i class="fa-solid fa-user"></i></div>’+
‘<div class="profil-info">’+
‘<h3>’+CU.nama_lengkap+’</h3>’+
‘<p>’+CU.email+’</p>’+
‘<span class="role-badge">’+CU.role+’</span> ‘+
‘<span class="status-badge '+(CU.status_akun==='Aktif'?'success':'danger')+'">’+CU.status_akun+’</span>’+
‘</div>’+
‘</div>’+
‘</div>’+
‘<div class="card" style="margin-bottom:12px;">’+
‘<h3><i class="fa-solid fa-key" style="color:#fbbf24"></i> Ubah Password</h3>’+
‘<div class="field"><label>Password Lama</label><input type="password" id="p-old" placeholder="Password saat ini"/></div>’+
‘<div class="field"><label>Password Baru</label><input type="password" id="p-new" placeholder="Min 6 karakter"/></div>’+
‘<div class="field"><label>Konfirmasi</label><input type="password" id="p-conf" placeholder="Ulangi password baru"/></div>’+
‘<button class="btn-primary full" onclick="gantiPwd()"><i class="fa-solid fa-save"></i> Simpan Password</button>’+
‘</div>’+
‘<div class="card" style="margin-bottom:12px;">’+
‘<h3><i class="fa-solid fa-circle-info" style="color:#60a5fa"></i> Info Akun</h3>’+
‘<div style="font-size:13px;color:#64748b;line-height:2.2;">’+
‘<div>ID: <span style="color:#94a3b8;font-size:11px;">’+CU.id_karyawan+’</span></div>’+
‘<div>Bergabung: <span style="color:#94a3b8;">’+fdT(CU.created_at)+’</span></div>’+
‘</div>’+
‘</div>’+
‘<button class="sidebar-logout" style="width:100%;justify-content:center;" onclick="logout()">’+
‘<i class="fa-solid fa-right-from-bracket"></i> Keluar’+
‘</button>’;
}

async function gantiPwd(){
var o=document.getElementById(‘p-old’).value;
var n=document.getElementById(‘p-new’).value;
var c2=document.getElementById(‘p-conf’).value;
if(!o||!n||!c2){toast(‘Isi semua field’,‘error’);return;}
if(o!==CU.password){toast(‘Password lama salah’,‘error’);return;}
if(n!==c2){toast(‘Konfirmasi tidak cocok’,‘error’);return;}
if(n.length<6){toast(‘Minimal 6 karakter’,‘error’);return;}
showLoading();
try{
await sb(‘users?id_karyawan=eq.’+CU.id_karyawan,‘PATCH’,{password:n});
CU.password=n;
localStorage.setItem(‘gns_v5’,JSON.stringify(CU));
toast(‘Password berhasil diubah’,‘success’);
[‘p-old’,‘p-new’,‘p-conf’].forEach(function(id){document.getElementById(id).value=’’;});
}catch(e){toast(’Gagal: ’+e.message,‘error’);}finally{hideLoading();}
}

// ============================================================
// HELPERS — select options
// ============================================================
async function ensureShifts(){
if(!SHIFTS.length) SHIFTS=await sb(‘shift’,‘GET’,null,’?select=*&order=nama_shift.asc’);
}

async function loadShiftSel(id){
await ensureShifts();
var sel=document.getElementById(id); if(!sel)return;
while(sel.options.length>1) sel.remove(1);
SHIFTS.forEach(function(s){
sel.appendChild(new Option(s.nama_shift+’ (’+ft(s.jam_masuk)+’-’+ft(s.jam_pulang)+’)’,s.nama_shift));
});
}

async function loadUserSel(id){
try{
if(!ALL_USERS.length)
ALL_USERS=await sb(‘users’,‘GET’,null,’?status_akun=eq.Aktif&select=id_karyawan,nama_lengkap&order=nama_lengkap.asc’);
var sel=document.getElementById(id); if(!sel)return;
while(sel.options.length>1) sel.remove(1);
ALL_USERS.forEach(function(u){sel.appendChild(new Option(u.nama_lengkap,u.nama_lengkap));});
}catch(_){}
}

// ============================================================
// FORMAT & UTILITY HELPERS
// ============================================================
var enc    = function(s){return encodeURIComponent(s);};
var tgl    = function(){return new Date().toLocaleDateString(‘sv-SE’);};
var ft     = function(t){return t?t.slice(0,5):’–:–’;};
var fd     = function(d){return d?new Date(d+‘T00:00:00’).toLocaleDateString(‘id-ID’,{day:‘2-digit’,month:‘short’,year:‘numeric’}):’-’;};
var fdLong = function(d){return d?new Date(d+‘T00:00:00’).toLocaleDateString(‘id-ID’,{weekday:‘long’,day:‘2-digit’,month:‘long’,year:‘numeric’}):’-’;};
var fdT    = function(dt){return dt?new Date(dt).toLocaleString(‘id-ID’,{day:‘2-digit’,month:‘short’,year:‘numeric’,hour:‘2-digit’,minute:‘2-digit’}):’-’;};

function wkRange(){
var n=new Date(),d=n.getDay()||7,mon=new Date(n),sun=new Date(n);
mon.setDate(n.getDate()-d+1); sun.setDate(n.getDate()-d+7);
return[mon.toLocaleDateString(‘sv-SE’),sun.toLocaleDateString(‘sv-SE’)];
}

function sBadge(s){
if(!s)return’’;
var m={
‘Tepat Waktu’:‘success’,‘Terlambat’:‘danger’,
‘Normal’:‘success’,‘Pulang Awal’:‘warning’,
‘Aktif’:‘success’,‘Nonaktif’:‘danger’,
‘Pending’:‘warning’,‘Disetujui’:‘success’,‘Ditolak’:‘danger’
};
return’<span class="status-badge '+(m[s]||'')+'">’+s+’</span>’;
}

function shiftC(n){
var s=(n||’’).toLowerCase();
if(s.indexOf(‘pagi’)>-1)  return{bg:‘rgba(59,130,246,.15)’,text:’#60a5fa’};
if(s.indexOf(‘sore’)>-1)  return{bg:‘rgba(249,115,22,.15)’,text:’#fb923c’};
if(s.indexOf(‘malam’)>-1) return{bg:‘rgba(139,92,246,.15)’,text:’#a78bfa’};
if(s.indexOf(‘libur’)>-1) return{bg:‘rgba(100,116,139,.12)’,text:’#64748b’};
return{bg:‘rgba(20,184,166,.15)’,text:’#2dd4bf’};
}

function C()       {return document.getElementById(‘content’);}
function emptyH(m) {return’<div class="empty-state"><i class="fa-solid fa-inbox"></i><p>’+m+’</p></div>’;}
function errH(m)   {return’<div class="empty-state error"><i class="fa-solid fa-circle-exclamation"></i><p>Error: ‘+m+’</p></div>’;}
function loadingH(){return’<div class="loading-state"><i class="fa-solid fa-spinner fa-spin"></i> Memuat…</div>’;}
function IS(){return’background:rgba(255,255,255,.07);border:1px solid rgba(255,255,255,.1);border-radius:10px;color:#fff;padding:9px 12px;font-size:13px;outline:none;’;}
function SS(){return’background:#1e293b;border:1px solid rgba(255,255,255,.1);border-radius:10px;color:#fff;padding:9px 12px;font-size:13px;outline:none;width:100%;’;}
function LS(){return’font-size:10px;color:#64748b;font-weight:700;display:block;margin-bottom:4px;text-transform:uppercase;’;}

// ============================================================
// LOADING & TOAST
// ============================================================
function showLoading(){document.getElementById(‘loading-overlay’).style.display=‘flex’;}
function hideLoading(){document.getElementById(‘loading-overlay’).style.display=‘none’;}

function toast(msg,type){
type=type||‘info’;
var c=document.getElementById(‘toast-container’),el=document.createElement(‘div’);
el.className=‘toast toast-’+type;
var ic=type===‘success’?‘fa-circle-check’:type===‘error’?‘fa-circle-exclamation’:‘fa-circle-info’;
el.innerHTML=’<i class="fa-solid '+ic+'"></i> ’+msg;
c.appendChild(el);
requestAnimationFrame(function(){el.classList.add(‘show’);});
setTimeout(function(){el.classList.remove(‘show’);setTimeout(function(){el.remove();},300);},3500);
}

function dlCSV(rows,name){
var csv=rows.map(function(r){
return r.map(function(v){return’”’+String(v||’’).replace(/”/g,’””’)+’”’;}).join(’,’);
}).join(’\n’);
var a=document.createElement(‘a’);
a.href=URL.createObjectURL(new Blob([’\uFEFF’+csv],{type:‘text/csv;charset=utf-8;’}));
a.download=name; a.click();
}

// ============================================================
// MODAL CLOSE ON BACKDROP + CAMERA STOP
// ============================================================
document.querySelectorAll(’.modal-bg’).forEach(function(m){
m.addEventListener(‘click’,function(e){
if(e.target===m){m.classList.remove(‘show’);stopCam();}
});
});

function stopCam(){
if(CAM){CAM.getTracks().forEach(function(t){t.stop();});CAM=null;}
}