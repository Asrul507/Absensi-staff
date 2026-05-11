cat > /mnt/user-data/outputs/absensi-app/script.js << 'ENDSCRIPT'
// ============================================================
// GENIUS PRESENCE — script.js v4.0
// Fix: login bug, role detection, signup, role-based UI
// ============================================================

const SUPA_URL  = 'https://kuldbrivmpqpoyeilbav.supabase.co';
const SUPA_KEY  = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imt1bGRicml2bXBxcG95ZWlsYmF2Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzgzOTI4NDMsImV4cCI6MjA5Mzk2ODg0M30.je9yMizaJs5OJ4yuaxnw2vwPeGy1F_0j75SMU1IZZso';

// ── Supabase REST ──────────────────────────────────────────
async function sb(table, method='GET', body=null, qs='') {
  const res = await fetch(`${SUPA_URL}/rest/v1/${table}${qs}`, {
    method,
    headers:{
      'Content-Type':'application/json',
      'apikey': SUPA_KEY,
      'Authorization':'Bearer '+SUPA_KEY,
      'Prefer':'return=representation',
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const txt = await res.text();
  if (!res.ok) {
    let m = `HTTP ${res.status}`;
    try { const e=JSON.parse(txt); m=e.message||e.hint||e.details||m; } catch(_){}
    throw new Error(m);
  }
  return txt ? JSON.parse(txt) : [];
}

// ── State ──────────────────────────────────────────────────
let CU           = null;   // currentUser
let PAGE         = '';
let CAM          = null;   // camera stream
let FOTO         = null;   // captured base64
let ABSEN_MODE   = null;
let GPS_LAT      = null;
let GPS_LNG      = null;
let TODAY_ABSEN  = null;
let TODAY_JADWAL = null;
let CLOCK_IV     = null;
let SHIFTS       = [];
let USERS        = [];
let REKAP_DATA   = [];
let IMP_ROWS     = [];
let IMP_BULAN    = '';

// ── Role helper — CASE INSENSITIVE ─────────────────────────
// INI penyebab bug utama: role di DB bisa 'admin' atau 'Admin'
function userIsAdmin() {
  if (!CU) return false;
  const r = (CU.role || '').toString().trim().toLowerCase();
  return r === 'admin';
}

const enc = s => encodeURIComponent(s);
const tgl = () => new Date().toLocaleDateString('sv-SE');

// ============================================================
// INIT — bersihkan localStorage lama lalu cek session
// ============================================================
document.addEventListener('DOMContentLoaded', async () => {
  const raw = localStorage.getItem('gns_user');
  if (!raw) return; // tidak ada session
  try {
    const cached = JSON.parse(raw);
    // Selalu re-fetch dari DB untuk memastikan role & status terbaru
    const rows = await sb('users','GET',null,
      `?id_karyawan=eq.${enc(cached.id_karyawan)}&select=*`);
    if (rows.length && rows[0].status_akun !== 'Nonaktif') {
      CU = rows[0];
      localStorage.setItem('gns_user', JSON.stringify(CU));
      startApp();
    } else {
      localStorage.removeItem('gns_user');
    }
  } catch(_) {
    // Jika offline/gagal, pakai cached data
    try { CU = JSON.parse(raw); startApp(); } catch(__) { localStorage.removeItem('gns_user'); }
  }
});

// ============================================================
// AUTH — Login, Signup, Logout
// ============================================================
function showSignup() {
  document.getElementById('form-login').style.display  = 'none';
  document.getElementById('form-signup').style.display = 'block';
  document.getElementById('debug-box').style.display   = 'none';
}
function showLogin() {
  document.getElementById('form-signup').style.display = 'none';
  document.getElementById('form-login').style.display  = 'block';
}

async function login() {
  const email = document.getElementById('login-email').value.trim();
  const pass  = document.getElementById('login-pass').value;
  if (!email || !pass) { toast('Isi email dan password','error'); return; }

  showLoading();
  document.getElementById('debug-box').style.display = 'none';

  try {
    // Ambil user berdasarkan email
    const rows = await sb('users','GET',null, `?email=eq.${enc(email)}&select=*`);

    // Debug info
    const dbg = document.getElementById('debug-box');

    if (!rows.length) {
      dbg.style.display = 'block';
      dbg.innerHTML = `⚠️ Email "<b>${email}</b>" tidak ditemukan di database.`;
      toast('Email tidak terdaftar','error');
      return;
    }

    const u = rows[0];

    // Tampilkan debug role ke layar (sementara untuk troubleshoot)
    dbg.style.display = 'block';
    dbg.innerHTML = `✅ Akun ditemukan:<br>
      Nama: <b>${u.nama_lengkap}</b><br>
      Role di DB: <b>"${u.role}"</b><br>
      Status: <b>${u.status_akun}</b><br>
      isAdmin: <b>${(u.role||'').trim().toLowerCase()==='admin'}</b>`;

    if (u.password !== pass) {
      toast('Password salah','error');
      dbg.innerHTML += '<br>❌ Password tidak cocok';
      return;
    }
    if (u.status_akun === 'Nonaktif') {
      toast('Akun nonaktif, hubungi Admin','error');
      return;
    }

    CU = u;
    localStorage.setItem('gns_user', JSON.stringify(CU));
    // Sembunyikan debug setelah 2 detik lalu masuk app
    setTimeout(() => { startApp(); }, 600);

  } catch(e) {
    toast('Error koneksi: '+e.message,'error');
    const dbg = document.getElementById('debug-box');
    dbg.style.display = 'block';
    dbg.innerHTML = `❌ Error: ${e.message}<br><br>
      Pastikan RLS tabel <b>users</b> sudah di-disable di Supabase Dashboard.`;
  } finally { hideLoading(); }
}

async function signup() {
  const nama  = document.getElementById('su-nama').value.trim();
  const email = document.getElementById('su-email').value.trim();
  const pass  = document.getElementById('su-pass').value;
  const pass2 = document.getElementById('su-pass2').value;
  const role  = document.getElementById('su-role').value;

  if (!nama||!email||!pass||!pass2) { toast('Lengkapi semua field','error'); return; }
  if (pass !== pass2)  { toast('Konfirmasi password tidak cocok','error'); return; }
  if (pass.length < 6) { toast('Password minimal 6 karakter','error'); return; }

  showLoading();
  try {
    const cek = await sb('users','GET',null,`?email=eq.${enc(email)}&select=id_karyawan`);
    if (cek.length) { toast('Email sudah terdaftar, silakan login','error'); return; }

    await sb('users','POST',{
      nama_lengkap: nama,
      email:        email,
      password:     pass,
      role:         role,       // 'Admin' atau 'Staff' persis dari select
      status_akun:  'Aktif',
    });

    toast(`Akun "${nama}" (${role}) berhasil dibuat!`,'success');
    ['su-nama','su-email','su-pass','su-pass2'].forEach(id => document.getElementById(id).value='');
    showLogin();
    document.getElementById('login-email').value = email;
    document.getElementById('login-pass').focus();
  } catch(e) {
    toast('Gagal daftar: '+e.message,'error');
  } finally { hideLoading(); }
}

function logout() {
  if (!confirm('Yakin ingin keluar?')) return;
  localStorage.removeItem('gns_user');
  CU = null;
  if (CLOCK_IV) clearInterval(CLOCK_IV);
  document.getElementById('appPage').style.display   = 'none';
  document.getElementById('loginPage').style.display = 'flex';
  document.getElementById('login-email').value = '';
  document.getElementById('login-pass').value  = '';
  document.getElementById('debug-box').style.display = 'none';
  showLogin();
}

// ============================================================
// APP SHELL
// ============================================================
function startApp() {
  document.getElementById('loginPage').style.display = 'none';
  document.getElementById('appPage').style.display   = 'block';

  // Tampilkan nama + badge role di topbar
  document.getElementById('userName').textContent = CU.nama_lengkap.split(' ')[0];
  const rt = document.getElementById('roleTag');
  rt.textContent = userIsAdmin() ? 'ADMIN' : 'STAFF';
  rt.style.background = userIsAdmin() ? 'rgba(251,191,36,.2)' : 'rgba(148,163,184,.15)';
  rt.style.color       = userIsAdmin() ? '#fbbf24' : '#94a3b8';

  buildSidebar();
  buildBottomNav();
  navigateTo('dashboard');
}

// ── Sidebar ────────────────────────────────────────────────
function buildSidebar() {
  const u = CU;
  const adminMenu = `
    <div class="sidebar-divider">ADMIN PANEL</div>
    <a class="sidebar-link" data-p="dashboard"         onclick="go('dashboard')"><i class="fa-solid fa-gauge"></i> Dashboard</a>
    <a class="sidebar-link" data-p="rekap"             onclick="go('rekap')"><i class="fa-solid fa-chart-bar"></i> Rekap Absensi</a>
    <a class="sidebar-link" data-p="kelola-jadwal"     onclick="go('kelola-jadwal')"><i class="fa-solid fa-table"></i> Kelola Jadwal</a>
    <a class="sidebar-link" data-p="kelola-shift"      onclick="go('kelola-shift')"><i class="fa-solid fa-clock"></i> Master Shift</a>
    <a class="sidebar-link" data-p="kelola-user"       onclick="go('kelola-user')"><i class="fa-solid fa-users"></i> Karyawan</a>
    <a class="sidebar-link" data-p="approve-pengajuan" onclick="go('approve-pengajuan')"><i class="fa-solid fa-check-to-slot"></i> Approve Izin/Cuti</a>
    <div class="sidebar-divider">AKUN</div>
    <a class="sidebar-link" data-p="profil" onclick="go('profil')"><i class="fa-solid fa-user"></i> Profil</a>`;

  const staffMenu = `
    <div class="sidebar-divider">MENU</div>
    <a class="sidebar-link" data-p="dashboard"       onclick="go('dashboard')"><i class="fa-solid fa-house"></i> Dashboard</a>
    <a class="sidebar-link" data-p="riwayat-absensi" onclick="go('riwayat-absensi')"><i class="fa-solid fa-fingerprint"></i> Riwayat Absensi</a>
    <a class="sidebar-link" data-p="jadwal-saya"     onclick="go('jadwal-saya')"><i class="fa-solid fa-calendar-days"></i> Jadwal Saya</a>
    <a class="sidebar-link" data-p="pengajuan"       onclick="go('pengajuan')"><i class="fa-solid fa-file-medical"></i> Pengajuan</a>
    <div class="sidebar-divider">AKUN</div>
    <a class="sidebar-link" data-p="profil" onclick="go('profil')"><i class="fa-solid fa-user"></i> Profil</a>`;

  document.getElementById('sidebar').innerHTML = `
    <div class="sidebar-header">
      <div class="sidebar-logo">🏢</div>
      <div><div class="sidebar-title">GENIUS</div><div class="sidebar-sub">Living Plaza Balikpapan</div></div>
    </div>
    <div class="sidebar-user">
      <div class="sidebar-avatar"><i class="fa-solid fa-user"></i></div>
      <div>
        <div class="sidebar-name">${u.nama_lengkap}</div>
        <div class="sidebar-role">${u.role} · ${u.email}</div>
      </div>
    </div>
    <div class="sidebar-nav">${userIsAdmin() ? adminMenu : staffMenu}</div>
    <button class="sidebar-logout" onclick="logout()"><i class="fa-solid fa-right-from-bracket"></i> Keluar</button>`;
}

// ── Bottom Nav ─────────────────────────────────────────────
function buildBottomNav() {
  const items = userIsAdmin()
    ? [
        {p:'dashboard',         i:'fa-gauge',          l:'Home'},
        {p:'rekap',             i:'fa-chart-bar',      l:'Rekap'},
        {p:'kelola-jadwal',     i:'fa-table',          l:'Jadwal'},
        {p:'approve-pengajuan', i:'fa-check-to-slot',  l:'Izin'},
        {p:'kelola-user',       i:'fa-users',          l:'User'},
      ]
    : [
        {p:'dashboard',       i:'fa-house',         l:'Home'},
        {p:'riwayat-absensi', i:'fa-fingerprint',   l:'Absensi'},
        {p:'jadwal-saya',     i:'fa-calendar-days', l:'Jadwal'},
        {p:'pengajuan',       i:'fa-file-medical',  l:'Izin'},
        {p:'profil',          i:'fa-user',          l:'Profil'},
      ];
  document.getElementById('bottomNav').innerHTML = items.map(x=>`
    <button class="nav-item${PAGE===x.p?' active':''}" onclick="navigateTo('${x.p}')">
      <i class="fa-solid ${x.i}"></i><span>${x.l}</span>
    </button>`).join('');
}

function go(p)         { closeSidebar(); navigateTo(p); }
function toggleSidebar(){ document.getElementById('sidebar').classList.toggle('open'); document.getElementById('overlay').classList.toggle('show'); }
function closeSidebar() { document.getElementById('sidebar').classList.remove('open'); document.getElementById('overlay').classList.remove('show'); }

async function navigateTo(p) {
  PAGE = p;
  buildBottomNav();
  document.querySelectorAll('.sidebar-link').forEach(a => a.classList.toggle('active', a.dataset.p===p));
  document.getElementById('content').innerHTML = `<div class="loading-state"><i class="fa-solid fa-spinner fa-spin"></i> Memuat...</div>`;
  const map = {
    'dashboard':          userIsAdmin() ? pgDashAdmin : pgDashStaff,
    'rekap':              pgRekap,
    'kelola-jadwal':      pgKelolaJadwal,
    'kelola-shift':       pgKelolaShift,
    'kelola-user':        pgKelolaUser,
    'approve-pengajuan':  pgApprovePQ,
    'riwayat-absensi':    pgRiwayatAbsensi,
    'jadwal-saya':        pgJadwalSaya,
    'pengajuan':          pgPengajuan,
    'profil':             pgProfil,
  };
  if (map[p]) await map[p]();
  else document.getElementById('content').innerHTML = errH('Halaman tidak ditemukan');
}

// ── Clock ──────────────────────────────────────────────────
function startClock() {
  if (CLOCK_IV) clearInterval(CLOCK_IV);
  const tick = () => { const el=document.getElementById('clock-display'); if(!el){clearInterval(CLOCK_IV);return;} el.textContent=new Date().toLocaleTimeString('id-ID'); };
  tick(); CLOCK_IV=setInterval(tick,1000);
}

// ============================================================
// DASHBOARD STAFF
// ============================================================
async function pgDashStaff() {
  const today = tgl();
  try {
    const [[j],[a]] = await Promise.all([
      sb('jadwal','GET',null,`?nama=eq.${enc(CU.nama_lengkap)}&tanggal=eq.${today}&select=*`),
      sb('absensi','GET',null,`?nama=eq.${enc(CU.nama_lengkap)}&tanggal=eq.${today}&select=*`),
    ]);
    TODAY_JADWAL=j||null; TODAY_ABSEN=a||null;
    const [mon,sun]=wkRange();
    const week=await sb('absensi','GET',null,`?nama=eq.${enc(CU.nama_lengkap)}&tanggal=gte.${mon}&tanggal=lte.${sun}&select=*`);
    const sm=!!TODAY_ABSEN?.waktu_masuk, sp=!!TODAY_ABSEN?.waktu_pulang;
    const wm=sm?ft(TODAY_ABSEN.waktu_masuk):'--:--', wp=sp?ft(TODAY_ABSEN.waktu_pulang):'--:--';

    C().innerHTML=`
      <div class="card" style="background:linear-gradient(135deg,#1e3a8a,#1d4ed8,#0369a1);border:none;margin-bottom:12px;">
        <div style="font-size:12px;opacity:.75;">${fdLong(today)}</div>
        <div id="clock-display" style="font-size:30px;font-weight:800;letter-spacing:2px;margin:4px 0;">--:--:--</div>
        <div style="font-size:13px;opacity:.8;">Halo, <b>${CU.nama_lengkap.split(' ')[0]}</b> 👋</div>
      </div>

      ${TODAY_JADWAL
        ?`<div class="shift-info-bar"><i class="fa-solid fa-rotate"></i> Shift <b>${TODAY_JADWAL.nama_shift}</b> &nbsp;·&nbsp; ${ft(TODAY_JADWAL.jam_masuk)} – ${ft(TODAY_JADWAL.jam_pulang)}</div>`
        :`<div class="shift-info-bar" style="background:rgba(234,179,8,.08);border-color:rgba(234,179,8,.3);color:#fbbf24;"><i class="fa-solid fa-triangle-exclamation"></i> Tidak ada jadwal shift hari ini</div>`}

      <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-bottom:12px;">
        <button class="btn-absensi" onclick="${sm?'':\"openAbsen('masuk')\"}"
          style="${sm?'background:linear-gradient(135deg,#059669,#047857);cursor:default;':''}">
          <i class="fa-solid fa-${sm?'circle-check':'right-to-bracket'}"></i>
          <span style="font-size:13px;">${sm?'✓ Masuk '+wm:'Absen Masuk'}</span>
        </button>
        <button class="btn-absensi" onclick="${sp?'':\"openAbsen('pulang')\"}"
          ${!sm?'disabled':''}
          style="${sp?'background:linear-gradient(135deg,#d97706,#b45309);cursor:default;':!sm?'opacity:.4;cursor:not-allowed;':'background:linear-gradient(135deg,#dc2626,#b91c1c);'}">
          <i class="fa-solid fa-${sp?'circle-check':'right-from-bracket'}"></i>
          <span style="font-size:13px;">${sp?'✓ Pulang '+wp:'Absen Pulang'}</span>
        </button>
      </div>

      ${TODAY_ABSEN?`
      <div class="card" style="margin-bottom:12px;">
        <h3><i class="fa-solid fa-circle-info" style="color:#60a5fa"></i> Status Absen Hari Ini</h3>
        <div style="display:flex;gap:10px;margin-top:10px;">
          <div class="status-tile ${sm?'done':'pending'}">
            <i class="fa-solid fa-arrow-right-to-bracket"></i>
            <div class="status-tile-label">Masuk</div>
            <div style="font-size:20px;font-weight:800;margin:4px 0;">${wm}</div>
            ${sBadge(TODAY_ABSEN.status_masuk)}
            ${TODAY_ABSEN.ket_telat?`<div class="ket-telat-badge" style="margin-top:6px;font-size:11px;"><i class="fa-solid fa-clock"></i> ${TODAY_ABSEN.ket_telat}</div>`:''}
          </div>
          <div class="status-tile ${sp?'done':'locked'}">
            <i class="fa-solid fa-arrow-right-from-bracket"></i>
            <div class="status-tile-label">Pulang</div>
            <div style="font-size:20px;font-weight:800;margin:4px 0;">${wp}</div>
            ${TODAY_ABSEN.status_pulang?sBadge(TODAY_ABSEN.status_pulang):'<div style="font-size:12px;color:#475569;">Belum pulang</div>'}
          </div>
        </div>
      </div>`:''}

      <div class="stats-grid">
        <div class="stat-card green"><div class="stat-icon"><i class="fa-solid fa-calendar-check"></i></div><div class="stat-val">${week.filter(x=>x.waktu_masuk).length}</div><div class="stat-label">Hadir Minggu Ini</div></div>
        <div class="stat-card red"><div class="stat-icon"><i class="fa-solid fa-clock"></i></div><div class="stat-val">${week.filter(x=>x.status_masuk==='Terlambat').length}</div><div class="stat-label">Terlambat</div></div>
        <div class="stat-card blue"><div class="stat-icon"><i class="fa-solid fa-calendar-week"></i></div><div class="stat-val">${week.length}</div><div class="stat-label">Total Shift</div></div>
      </div>

      <div class="card">
        <h3><i class="fa-solid fa-file-medical" style="color:#60a5fa"></i> Pengajuan Cepat</h3>
        <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:8px;">
          <button class="btn-outline" onclick="openPQ('Izin')" style="flex-direction:column;gap:4px;padding:12px 8px;justify-content:center;text-align:center;">
            <i class="fa-solid fa-file-lines" style="font-size:20px;"></i><span style="font-size:11px;">Izin</span></button>
          <button class="btn-outline" onclick="openPQ('Sakit')" style="flex-direction:column;gap:4px;padding:12px 8px;justify-content:center;text-align:center;border-color:rgba(239,68,68,.4);color:#f87171;">
            <i class="fa-solid fa-notes-medical" style="font-size:20px;"></i><span style="font-size:11px;">Sakit</span></button>
          <button class="btn-outline" onclick="openPQ('Cuti')" style="flex-direction:column;gap:4px;padding:12px 8px;justify-content:center;text-align:center;border-color:rgba(16,185,129,.4);color:#34d399;">
            <i class="fa-solid fa-umbrella-beach" style="font-size:20px;"></i><span style="font-size:11px;">Cuti</span></button>
        </div>
      </div>`;
    startClock();
  } catch(e) { C().innerHTML=errH(e.message); }
}

// ============================================================
// DASHBOARD ADMIN
// ============================================================
async function pgDashAdmin() {
  const today=tgl(); const [y,m]=today.split('-');
  const from=`${y}-${m}-01`, to=`${y}-${m}-${String(new Date(y,m,0).getDate()).padStart(2,'0')}`;
  try {
    const [absenHari, users, pending] = await Promise.all([
      sb('absensi','GET',null,`?tanggal=eq.${today}&select=*`),
      sb('users','GET',null,`?status_akun=eq.Aktif&select=id_karyawan,nama_lengkap,role`),
      sb('pengajuan','GET',null,`?status_approve=eq.Pending&select=*`),
    ]);
    const absenBulan = await sb('absensi','GET',null,`?tanggal=gte.${from}&tanggal=lte.${to}&select=waktu_masuk,status_masuk`);
    const hadirHari  = absenHari.filter(a=>a.waktu_masuk).length;
    const telatHari  = absenHari.filter(a=>a.status_masuk==='Terlambat').length;
    const hadirBulan = absenBulan.filter(a=>a.waktu_masuk).length;
    const telatBulan = absenBulan.filter(a=>a.status_masuk==='Terlambat').length;
    const hadirSet   = new Set(absenHari.filter(a=>a.waktu_masuk).map(a=>a.nama));
    const belum      = users.filter(u=>!hadirSet.has(u.nama_lengkap));

    C().innerHTML=`
      <div class="card" style="background:linear-gradient(135deg,#1e3a8a,#1d4ed8);border:none;margin-bottom:12px;">
        <div style="font-size:12px;opacity:.7;">${fdLong(today)}</div>
        <div id="clock-display" style="font-size:24px;font-weight:800;margin:4px 0;">--:--:--</div>
        <div style="font-size:13px;opacity:.8;">Admin Panel · <b>${CU.nama_lengkap.split(' ')[0]}</b></div>
      </div>

      <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-bottom:12px;">
        <div class="card" style="margin:0;text-align:center;"><div style="font-size:10px;color:#64748b;font-weight:700;text-transform:uppercase;margin-bottom:4px;">Hadir Hari Ini</div><div style="font-size:38px;font-weight:800;color:#34d399;line-height:1;">${hadirHari}</div><div style="font-size:12px;color:#475569;margin-top:4px;">dari ${users.length} karyawan</div></div>
        <div class="card" style="margin:0;text-align:center;"><div style="font-size:10px;color:#64748b;font-weight:700;text-transform:uppercase;margin-bottom:4px;">Izin Pending</div><div style="font-size:38px;font-weight:800;color:#fbbf24;line-height:1;">${pending.length}</div><div style="font-size:12px;color:#475569;margin-top:4px;">perlu disetujui</div></div>
        <div class="card" style="margin:0;text-align:center;"><div style="font-size:10px;color:#64748b;font-weight:700;text-transform:uppercase;margin-bottom:4px;">Terlambat Hari Ini</div><div style="font-size:38px;font-weight:800;color:#f87171;line-height:1;">${telatHari}</div><div style="font-size:12px;color:#475569;margin-top:4px;">orang</div></div>
        <div class="card" style="margin:0;text-align:center;"><div style="font-size:10px;color:#64748b;font-weight:700;text-transform:uppercase;margin-bottom:4px;">Hadir Bulan Ini</div><div style="font-size:38px;font-weight:800;color:#60a5fa;line-height:1;">${hadirBulan}</div><div style="font-size:12px;color:#475569;margin-top:4px;">${telatBulan} terlambat</div></div>
      </div>

      <div class="card" style="margin-bottom:12px;">
        <h3><i class="fa-solid fa-bolt" style="color:#fbbf24"></i> Aksi Cepat</h3>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;">
          <button class="btn-primary" onclick="navigateTo('kelola-jadwal')"><i class="fa-solid fa-table"></i> Atur Jadwal</button>
          <button class="btn-primary" onclick="navigateTo('rekap')"><i class="fa-solid fa-chart-bar"></i> Rekap Absensi</button>
          <button class="btn-primary" onclick="navigateTo('approve-pengajuan')" style="${pending.length?'background:linear-gradient(135deg,#d97706,#b45309);':''}">
            <i class="fa-solid fa-check-to-slot"></i> Approve Izin ${pending.length?`<span style="background:rgba(255,255,255,.25);border-radius:20px;padding:1px 8px;font-size:11px;">${pending.length}</span>`:''}
          </button>
          <button class="btn-primary" onclick="navigateTo('kelola-user')"><i class="fa-solid fa-users"></i> Kelola User</button>
        </div>
      </div>

      ${belum.length?`
      <div class="card" style="margin-bottom:12px;">
        <h3><i class="fa-solid fa-user-clock" style="color:#f87171"></i> Belum Absen (${belum.length})</h3>
        ${belum.map(u=>`<div class="user-card" style="margin-bottom:8px;"><div class="user-avatar"><i class="fa-solid fa-user"></i></div><div class="user-info"><div class="user-nama">${u.nama_lengkap}</div><div class="user-email">${u.role}</div></div></div>`).join('')}
      </div>`:`
      <div class="card"><h3><i class="fa-solid fa-circle-check" style="color:#34d399"></i> Semua Karyawan Sudah Absen 🎉</h3></div>`}

      <div class="card">
        <h3><i class="fa-solid fa-list" style="color:#60a5fa"></i> Absen Masuk Hari Ini</h3>
        ${!absenHari.filter(a=>a.waktu_masuk).length
          ?emptyH('Belum ada absen masuk')
          :`<div class="card-list">${absenHari.filter(a=>a.waktu_masuk).sort((a,b)=>a.waktu_masuk.localeCompare(b.waktu_masuk)).map(a=>`
          <div class="absensi-card">
            <div class="absensi-foto-placeholder"><i class="fa-solid fa-user"></i></div>
            <div class="absensi-card-body">
              <div class="absensi-nama">${a.nama}</div>
              <div class="absensi-waktu"><i class="fa-solid fa-clock"></i> ${ft(a.waktu_masuk)}${a.waktu_pulang?' · Pulang '+ft(a.waktu_pulang):''}</div>
              <div class="absensi-info">${a.nama_shift||'-'}</div>
            </div>
            <span class="absensi-badge ${a.status_masuk==='Tepat Waktu'?'success':'warning'}">${a.status_masuk||'-'}</span>
          </div>`).join('')}</div>`}
      </div>`;
    startClock();
  } catch(e) { C().innerHTML=errH(e.message); }
}

// ============================================================
// ABSEN — Kamera + GPS
// ============================================================
async function openAbsen(mode) {
  ABSEN_MODE=mode; FOTO=null;
  document.getElementById('modal-absen-title').textContent = mode==='masuk'?'📸 Absen Masuk':'📸 Absen Pulang';
  document.getElementById('foto-preview-box').style.display  = 'none';
  document.getElementById('camera-container').style.display  = 'block';
  document.getElementById('absen-actions').style.display     = 'flex';
  document.getElementById('absen-confirm-actions').style.display = 'none';
  document.getElementById('lokasi-info').className = 'gps-status loading';
  document.getElementById('lokasi-info').innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Mengambil lokasi...';
  document.getElementById('modal-absen').classList.add('show');
  try {
    CAM = await navigator.mediaDevices.getUserMedia({video:{facingMode:'user'},audio:false});
    document.getElementById('camera-video').srcObject = CAM;
  } catch(e) { toast('Kamera tidak bisa diakses','error'); }
  navigator.geolocation?.getCurrentPosition(
    p => { GPS_LAT=p.coords.latitude.toFixed(6); GPS_LNG=p.coords.longitude.toFixed(6);
      document.getElementById('lokasi-info').className='gps-status success';
      document.getElementById('lokasi-info').innerHTML=`<i class="fa-solid fa-location-dot"></i> ${GPS_LAT}, ${GPS_LNG}`; },
    () => { GPS_LAT=GPS_LNG=null;
      document.getElementById('lokasi-info').className='gps-status error';
      document.getElementById('lokasi-info').innerHTML='<i class="fa-solid fa-triangle-exclamation"></i> Lokasi tidak tersedia'; }
  );
}

function closeModalAbsen(){ document.getElementById('modal-absen').classList.remove('show'); stopCam(); }
function stopCam(){ if(CAM){CAM.getTracks().forEach(t=>t.stop());CAM=null;} }

function ambilFoto(){
  const v=document.getElementById('camera-video'), cv=document.getElementById('camera-canvas');
  cv.width=v.videoWidth||320; cv.height=v.videoHeight||240;
  cv.getContext('2d').drawImage(v,0,0);
  FOTO=cv.toDataURL('image/jpeg',.7);
  document.getElementById('foto-preview').src=FOTO;
  document.getElementById('foto-preview-box').style.display='block';
  document.getElementById('camera-container').style.display='none';
  document.getElementById('absen-actions').style.display='none';
  document.getElementById('absen-confirm-actions').style.display='flex';
  stopCam();
}

async function retakeFoto(){
  FOTO=null;
  document.getElementById('foto-preview-box').style.display='none';
  document.getElementById('camera-container').style.display='block';
  document.getElementById('absen-actions').style.display='flex';
  document.getElementById('absen-confirm-actions').style.display='none';
  try{ CAM=await navigator.mediaDevices.getUserMedia({video:{facingMode:'user'},audio:false}); document.getElementById('camera-video').srcObject=CAM; }catch(_){}
}

async function submitAbsen(){
  const now=new Date(), ts=now.toTimeString().slice(0,8), today=tgl();
  showLoading();
  try{
    let jdw=TODAY_JADWAL;
    if(!jdw){ const r=await sb('jadwal','GET',null,`?nama=eq.${enc(CU.nama_lengkap)}&tanggal=eq.${today}&select=*`); jdw=r[0]||null; }
    if(ABSEN_MODE==='masuk'){
      const ex=await sb('absensi','GET',null,`?nama=eq.${enc(CU.nama_lengkap)}&tanggal=eq.${today}&select=id`);
      if(ex.length){toast('Sudah absen masuk hari ini','error');closeModalAbsen();return;}
      let st='Tepat Waktu',ket='';
      if(jdw?.jam_masuk){const[jh,jm]=jdw.jam_masuk.split(':').map(Number),nm=now.getHours()*60+now.getMinutes(),jm2=jh*60+jm;if(nm>jm2+10){st='Terlambat';ket=`Terlambat ${nm-jm2} menit`;}}
      await sb('absensi','POST',{nama:CU.nama_lengkap,tanggal:today,waktu_masuk:ts,lat_masuk:GPS_LAT,lng_masuk:GPS_LNG,foto_masuk:FOTO,status_masuk:st,ket_telat:ket,shift_id:jdw?.shift_id||null,nama_shift:jdw?.nama_shift||null});
      toast(`Absen masuk berhasil · ${st}`,'success');
    }else{
      const ex=await sb('absensi','GET',null,`?nama=eq.${enc(CU.nama_lengkap)}&tanggal=eq.${today}&select=id`);
      if(!ex.length){toast('Absen masuk belum ada','error');closeModalAbsen();return;}
      let sp='Normal';
      if(jdw?.jam_pulang){const[jh,jm]=jdw.jam_pulang.split(':').map(Number);if(now.getHours()*60+now.getMinutes()<jh*60+jm-10)sp='Pulang Awal';}
      await sb(`absensi?id=eq.${ex[0].id}`,'PATCH',{waktu_pulang:ts,lat_pulang:GPS_LAT,lng_pulang:GPS_LNG,foto_pulang:FOTO,status_pulang:sp});
      toast('Absen pulang berhasil!','success');
    }
    closeModalAbsen(); await navigateTo('dashboard');
  }catch(e){toast('Gagal absen: '+e.message,'error');}
  finally{hideLoading();}
}

// ============================================================
// RIWAYAT ABSENSI — Staff (hanya miliknya sendiri)
// ============================================================
async function pgRiwayatAbsensi(){
  const def=new Date().toISOString().slice(0,7);
  C().innerHTML=`
    <div class="page-header-row"><h2><i class="fa-solid fa-fingerprint"></i> Riwayat Absensi Saya</h2></div>
    <div class="card" style="padding:12px;margin-bottom:12px;">
      <label style="font-size:11px;color:#64748b;font-weight:700;display:block;margin-bottom:6px;">PILIH BULAN</label>
      <input type="month" id="ab-bulan" value="${def}" onchange="loadRiwayat()" style="width:100%;${IS()}">
    </div>
    <div id="riwayat-c"><div class="loading-state"><i class="fa-solid fa-spinner fa-spin"></i></div></div>`;
  await loadRiwayat();
}

async function loadRiwayat(){
  const b=document.getElementById('ab-bulan')?.value; if(!b)return;
  const[y,m]=b.split('-'),from=`${y}-${m}-01`,to=`${y}-${m}-${String(new Date(y,m,0).getDate()).padStart(2,'0')}`;
  const c=document.getElementById('riwayat-c'); c.innerHTML=loading();
  try{
    const list=await sb('absensi','GET',null,`?nama=eq.${enc(CU.nama_lengkap)}&tanggal=gte.${from}&tanggal=lte.${to}&order=tanggal.desc&select=*`);
    c.innerHTML=`
      <div class="stats-grid" style="margin-bottom:12px;">
        <div class="stat-card green"><div class="stat-icon"><i class="fa-solid fa-calendar-check"></i></div><div class="stat-val">${list.filter(a=>a.waktu_masuk).length}</div><div class="stat-label">Hadir</div></div>
        <div class="stat-card red"><div class="stat-icon"><i class="fa-solid fa-clock"></i></div><div class="stat-val">${list.filter(a=>a.status_masuk==='Terlambat').length}</div><div class="stat-label">Terlambat</div></div>
        <div class="stat-card blue"><div class="stat-icon"><i class="fa-solid fa-right-from-bracket"></i></div><div class="stat-val">${list.filter(a=>a.waktu_pulang).length}</div><div class="stat-label">Pulang</div></div>
      </div>
      ${!list.length?emptyH('Tidak ada data bulan ini'):list.map(a=>`
      <div class="riwayat-card">
        <div class="riwayat-tanggal"><i class="fa-solid fa-calendar-day"></i> ${fdLong(a.tanggal)} ${sBadge(a.status_masuk)} ${a.ket_telat?`<span class="ket-telat-mini"><i class="fa-solid fa-clock"></i> ${a.ket_telat}</span>`:''}</div>
        <div class="riwayat-rows">
          <div class="riwayat-row"><div class="riwayat-tipe masuk"><i class="fa-solid fa-arrow-right-to-bracket"></i> Masuk</div><div class="riwayat-detail"><div class="riwayat-waktu">${a.waktu_masuk?ft(a.waktu_masuk):'—'}</div>${a.lat_masuk?`<a class="riwayat-lokasi" href="https://maps.google.com/?q=${a.lat_masuk},${a.lng_masuk}" target="_blank"><i class="fa-solid fa-location-dot"></i> Peta</a>`:''}</div></div>
          <div class="riwayat-row"><div class="riwayat-tipe pulang"><i class="fa-solid fa-arrow-right-from-bracket"></i> Pulang</div><div class="riwayat-detail"><div class="riwayat-waktu">${a.waktu_pulang?ft(a.waktu_pulang):'—'}</div>${a.lat_pulang?`<a class="riwayat-lokasi" href="https://maps.google.com/?q=${a.lat_pulang},${a.lng_pulang}" target="_blank"><i class="fa-solid fa-location-dot"></i> Peta</a>`:''}</div></div>
        </div>
      </div>`).join('')}`;
  }catch(e){c.innerHTML=errH(e.message);}
}

// ============================================================
// JADWAL SAYA — Staff (hanya namanya sendiri)
// ============================================================
async function pgJadwalSaya(){
  const def=new Date().toISOString().slice(0,7);
  C().innerHTML=`
    <div class="page-header-row"><h2><i class="fa-solid fa-calendar-days"></i> Jadwal Saya</h2></div>
    <div class="card" style="padding:12px;margin-bottom:12px;">
      <input type="month" id="jd-bulan" value="${def}" onchange="loadJdwSaya()" style="width:100%;${IS()}">
    </div>
    <div id="jd-c"><div class="loading-state"><i class="fa-solid fa-spinner fa-spin"></i></div></div>`;
  await loadJdwSaya();
}

async function loadJdwSaya(){
  const b=document.getElementById('jd-bulan')?.value; if(!b)return;
  const[y,m]=b.split('-'),from=`${y}-${m}-01`,to=`${y}-${m}-${String(new Date(y,m,0).getDate()).padStart(2,'0')}`;
  const c=document.getElementById('jd-c'); c.innerHTML=loading();
  try{
    const list=await sb('jadwal','GET',null,`?nama=eq.${enc(CU.nama_lengkap)}&tanggal=gte.${from}&tanggal=lte.${to}&order=tanggal.asc&select=*`);
    if(!list.length){c.innerHTML=emptyH('Tidak ada jadwal bulan ini');return;}
    const today=tgl();
    c.innerHTML=`<div class="card" style="padding:8px 0;">${list.map(j=>{
      const isT=j.tanggal===today,isP=j.tanggal<today,d=new Date(j.tanggal+'T00:00:00'),sc=shiftC(j.nama_shift);
      return`<div class="jadwal-item${isT?' jadwal-today':isP?' jadwal-past':''}">
        <div class="jadwal-tgl"><div class="jadwal-tgl-num" style="color:${isT?'#60a5fa':'#e2e8f0'}">${d.getDate()}</div><div class="jadwal-tgl-hari">${d.toLocaleDateString('id-ID',{weekday:'short'})}</div></div>
        <div class="jadwal-shift-badge" style="background:${sc.bg};color:${sc.text};"><i class="fa-solid fa-clock"></i> ${j.nama_shift||'Shift'}</div>
        <div class="jadwal-jam"><span><i class="fa-solid fa-arrow-right-to-bracket"></i> ${ft(j.jam_masuk)}</span><span><i class="fa-solid fa-arrow-right-from-bracket"></i> ${ft(j.jam_pulang)}</span></div>
        ${isT?'<span class="jadwal-today-badge">HARI INI</span>':''}
      </div>`;}).join('')}</div>`;
  }catch(e){c.innerHTML=errH(e.message);}
}

// ============================================================
// PENGAJUAN — Staff
// ============================================================
async function pgPengajuan(){
  try{
    const list=await sb('pengajuan','GET',null,`?nama_karyawan=eq.${enc(CU.nama_lengkap)}&order=tgl_submit.desc&select=*`);
    C().innerHTML=`
      <div class="page-header-row"><h2><i class="fa-solid fa-file-medical"></i> Pengajuan Saya</h2></div>
      <div style="display:flex;gap:8px;margin-bottom:12px;">
        <button class="btn-outline btn-sm" onclick="openPQ('Izin')" style="flex:1;justify-content:center;"><i class="fa-solid fa-file-lines"></i> Izin</button>
        <button class="btn-outline btn-sm" onclick="openPQ('Sakit')" style="flex:1;justify-content:center;border-color:rgba(239,68,68,.4);color:#f87171;"><i class="fa-solid fa-notes-medical"></i> Sakit</button>
        <button class="btn-outline btn-sm" onclick="openPQ('Cuti')" style="flex:1;justify-content:center;border-color:rgba(16,185,129,.4);color:#34d399;"><i class="fa-solid fa-umbrella-beach"></i> Cuti</button>
      </div>
      ${!list.length?emptyH('Belum ada pengajuan'):list.map(p=>cPQ(p,false)).join('')}`;
  }catch(e){C().innerHTML=errH(e.message);}
}

function openPQ(tipe){ document.getElementById('pengajuan-tipe').value=tipe; document.getElementById('pengajuan-ket').value=''; document.getElementById('pengajuan-link').value=''; document.getElementById('modal-pengajuan').classList.add('show'); }
function closeModalPengajuan(){ document.getElementById('modal-pengajuan').classList.remove('show'); }

async function submitPengajuan(){
  const p={nama_karyawan:CU.nama_lengkap,tipe_izin:document.getElementById('pengajuan-tipe').value,keterangan:document.getElementById('pengajuan-ket').value.trim(),link_surat_sakit:document.getElementById('pengajuan-link').value.trim()||null,status_approve:'Pending'};
  if(!p.keterangan){toast('Isi keterangan','error');return;}
  showLoading();
  try{await sb('pengajuan','POST',p);toast('Pengajuan terkirim!','success');closeModalPengajuan();if(PAGE==='pengajuan')await pgPengajuan();}
  catch(e){toast('Gagal: '+e.message,'error');}
  finally{hideLoading();}
}

function cPQ(p,admin){
  const sc={Pending:'warning',Disetujui:'success',Ditolak:'danger'}[p.status_approve]||'';
  const ic={Izin:'fa-file-lines',Sakit:'fa-notes-medical',Cuti:'fa-umbrella-beach'}[p.tipe_izin]||'fa-file';
  return`<div class="pengajuan-card">
    <div class="pengajuan-header">
      <div>${admin?`<div style="font-size:14px;font-weight:700;margin-bottom:2px;">${p.nama_karyawan}</div>`:''}<div class="pengajuan-tipe"><i class="fa-solid ${ic}"></i> ${p.tipe_izin}</div></div>
      <span class="status-badge ${sc}">${p.status_approve}</span>
    </div>
    <div class="pengajuan-ket">${p.keterangan||'-'}</div>
    ${p.link_surat_sakit?`<a class="btn-link" href="${p.link_surat_sakit}" target="_blank" style="display:inline-flex;margin-bottom:6px;"><i class="fa-solid fa-link"></i> Lihat Surat</a>`:''}
    <div class="pengajuan-footer">
      <span style="font-size:12px;color:#475569;"><i class="fa-regular fa-clock"></i> ${fdT(p.tgl_submit)}</span>
      ${admin&&p.status_approve==='Pending'?`<div class="approve-actions"><button class="btn-approve" onclick="approvePQ(${p.id_pengajuan},'Disetujui')"><i class="fa-solid fa-check"></i> Setujui</button><button class="btn-reject" onclick="approvePQ(${p.id_pengajuan},'Ditolak')"><i class="fa-solid fa-xmark"></i> Tolak</button></div>`:''}
    </div>
  </div>`;
}

// ============================================================
// REKAP ABSENSI — Admin
// ============================================================
async function pgRekap(){
  const today=tgl();const[y,m]=today.split('-');
  C().innerHTML=`
    <div class="page-header-row"><h2><i class="fa-solid fa-chart-bar"></i> Rekap Absensi</h2><button class="btn-outline btn-sm" onclick="exportRekap()"><i class="fa-solid fa-file-excel"></i> Export CSV</button></div>
    <div class="card" style="padding:14px;margin-bottom:12px;">
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-bottom:8px;">
        <div><label style="${LS()}">BULAN</label><input type="month" id="rek-bulan" value="${y}-${m}" style="${IS()}" onchange="syncRekap()"></div>
        <div><label style="${LS()}">SHIFT</label><select id="rek-shift" style="${SS()}"><option value="">Semua Shift</option></select></div>
      </div>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-bottom:8px;">
        <div><label style="${LS()}">DARI</label><input type="date" id="rek-dari" style="${IS()}"></div>
        <div><label style="${LS()}">SAMPAI</label><input type="date" id="rek-sampai" style="${IS()}"></div>
      </div>
      <input type="text" id="rek-cari" placeholder="🔍 Cari nama..." oninput="loadRekap()" style="width:100%;${IS()}margin-bottom:8px;">
      <button class="btn-primary full" onclick="loadRekap()"><i class="fa-solid fa-magnifying-glass"></i> Tampilkan</button>
    </div>
    <div id="rek-c"><div class="loading-state"><i class="fa-solid fa-spinner fa-spin"></i></div></div>`;
  await loadShiftSel('rek-shift');
  const fd=`${y}-${m}-01`,ld=`${y}-${m}-${String(new Date(y,m,0).getDate()).padStart(2,'0')}`;
  document.getElementById('rek-dari').value=fd; document.getElementById('rek-sampai').value=ld;
  await loadRekap();
}

function syncRekap(){const b=document.getElementById('rek-bulan').value;if(!b)return;const[y,m]=b.split('-');document.getElementById('rek-dari').value=`${y}-${m}-01`;document.getElementById('rek-sampai').value=`${y}-${m}-${String(new Date(y,m,0).getDate()).padStart(2,'0')}`;loadRekap();}

async function loadRekap(){
  const dari=document.getElementById('rek-dari')?.value,sampai=document.getElementById('rek-sampai')?.value;
  const cari=(document.getElementById('rek-cari')?.value||'').toLowerCase(),shiftF=document.getElementById('rek-shift')?.value||'';
  if(!dari||!sampai)return;
  const c=document.getElementById('rek-c');c.innerHTML=loading();
  try{
    let q=`?tanggal=gte.${dari}&tanggal=lte.${sampai}&order=tanggal.desc,nama.asc&select=*`;
    if(shiftF)q+=`&nama_shift=eq.${enc(shiftF)}`;
    let list=await sb('absensi','GET',null,q);
    if(cari)list=list.filter(a=>a.nama.toLowerCase().includes(cari));
    REKAP_DATA=list;
    if(!list.length){c.innerHTML=emptyH('Tidak ada data');return;}
    const bN={};list.forEach(a=>{if(!bN[a.nama])bN[a.nama]={hadir:0,telat:0,pulang:0,lupa:0};if(a.waktu_masuk)bN[a.nama].hadir++;if(a.status_masuk==='Terlambat')bN[a.nama].telat++;if(a.waktu_pulang)bN[a.nama].pulang++;if(a.waktu_masuk&&!a.waktu_pulang)bN[a.nama].lupa++;});
    const maxH=Math.max(...Object.values(bN).map(x=>x.hadir),1);
    c.innerHTML=`
      <div class="import-stats-row">
        <div class="import-stat-box blue"><div class="import-stat-num">${list.length}</div><div class="import-stat-lab">Total</div></div>
        <div class="import-stat-box green"><div class="import-stat-num">${list.filter(a=>a.waktu_masuk).length}</div><div class="import-stat-lab">Hadir</div></div>
        <div class="import-stat-box red"><div class="import-stat-num">${list.filter(a=>a.status_masuk==='Terlambat').length}</div><div class="import-stat-lab">Terlambat</div></div>
        <div class="import-stat-box teal"><div class="import-stat-num">${list.filter(a=>a.status_pulang==='Pulang Awal').length}</div><div class="import-stat-lab">Pulang Awal</div></div>
      </div>
      <div class="card" style="margin-bottom:12px;">
        <h3><i class="fa-solid fa-chart-bar" style="color:#60a5fa"></i> Grafik Kehadiran</h3>
        ${Object.entries(bN).sort((a,b)=>b[1].hadir-a[1].hadir).map(([n,s])=>`
        <div style="margin-bottom:12px;">
          <div style="display:flex;justify-content:space-between;font-size:12px;margin-bottom:4px;"><span style="font-weight:600;">${n}</span><span style="color:#64748b;">${s.hadir} hadir · <span style="color:#f87171;">${s.telat} telat</span></span></div>
          <div style="background:rgba(255,255,255,.06);border-radius:20px;height:10px;overflow:hidden;"><div style="height:100%;width:${Math.round(s.hadir/maxH*100)}%;background:linear-gradient(90deg,#3b82f6,#06b6d4);border-radius:20px;"></div></div>
        </div>`).join('')}
      </div>
      <div class="card" style="margin-bottom:12px;">
        <h3><i class="fa-solid fa-users" style="color:#34d399"></i> Ringkasan per Karyawan</h3>
        <div style="overflow-x:auto;"><table style="width:100%;border-collapse:collapse;font-size:12px;min-width:360px;">
          <thead><tr style="background:rgba(255,255,255,.04);"><th style="padding:8px 10px;text-align:left;color:#64748b;">Nama</th><th style="padding:8px 10px;text-align:center;color:#34d399;">Hadir</th><th style="padding:8px 10px;text-align:center;color:#f87171;">Telat</th><th style="padding:8px 10px;text-align:center;color:#60a5fa;">Pulang</th><th style="padding:8px 10px;text-align:center;color:#fbbf24;">Lupa Pulang</th></tr></thead>
          <tbody>${Object.entries(bN).map(([n,s])=>`<tr style="border-top:1px solid rgba(255,255,255,.04);"><td style="padding:8px 10px;font-weight:600;">${n}</td><td style="padding:8px 10px;text-align:center;"><span class="status-badge success">${s.hadir}</span></td><td style="padding:8px 10px;text-align:center;"><span class="status-badge danger">${s.telat}</span></td><td style="padding:8px 10px;text-align:center;"><span class="status-badge" style="background:rgba(59,130,246,.14);color:#60a5fa;">${s.pulang}</span></td><td style="padding:8px 10px;text-align:center;"><span class="status-badge warning">${s.lupa}</span></td></tr>`).join('')}</tbody>
        </table></div>
      </div>
      <div class="card"><h3><i class="fa-solid fa-list" style="color:#a78bfa"></i> Detail (${list.length})</h3>
        <div style="overflow-x:auto;"><table style="width:100%;border-collapse:collapse;font-size:12px;min-width:480px;">
          <thead><tr style="background:rgba(255,255,255,.04);"><th style="padding:8px 10px;text-align:left;color:#64748b;">Tanggal</th><th style="padding:8px 10px;text-align:left;color:#64748b;">Nama</th><th style="padding:8px 10px;text-align:left;color:#64748b;">Shift</th><th style="padding:8px 10px;text-align:center;color:#64748b;">Masuk</th><th style="padding:8px 10px;text-align:center;color:#64748b;">Pulang</th><th style="padding:8px 10px;text-align:center;color:#64748b;">Status</th></tr></thead>
          <tbody>${list.map(a=>`<tr style="border-top:1px solid rgba(255,255,255,.04);"><td style="padding:7px 10px;color:#94a3b8;white-space:nowrap;">${fd(a.tanggal)}</td><td style="padding:7px 10px;font-weight:600;">${a.nama}</td><td style="padding:7px 10px;">${a.nama_shift||'-'}</td><td style="padding:7px 10px;text-align:center;">${a.waktu_masuk?ft(a.waktu_masuk):'—'}</td><td style="padding:7px 10px;text-align:center;">${a.waktu_pulang?ft(a.waktu_pulang):'—'}</td><td style="padding:7px 10px;text-align:center;">${sBadge(a.status_masuk)}</td></tr>`).join('')}</tbody>
        </table></div>
      </div>`;
  }catch(e){c.innerHTML=errH(e.message);}
}

function exportRekap(){if(!REKAP_DATA.length){toast('Tidak ada data','error');return;}dlCSV([['Tanggal','Nama','Shift','Masuk','Pulang','Status Masuk','Status Pulang','Ket Telat'],...REKAP_DATA.map(a=>[a.tanggal,a.nama,a.nama_shift||'',a.waktu_masuk||'',a.waktu_pulang||'',a.status_masuk||'',a.status_pulang||'',a.ket_telat||''])],`rekap_${Date.now()}.csv`);toast('Export berhasil!','success');}

// ============================================================
// KELOLA JADWAL — Admin (Manual + Import CSV)
// ============================================================
async function pgKelolaJadwal(){
  const today=tgl();const[y,m]=today.split('-');
  C().innerHTML=`
    <div class="page-header-row"><h2><i class="fa-solid fa-table"></i> Kelola Jadwal</h2></div>
    <div style="display:flex;gap:8px;margin-bottom:14px;">
      <button id="tab-m" class="btn-primary btn-sm" onclick="swTab('m')"><i class="fa-solid fa-pen"></i> Input Manual</button>
      <button id="tab-i" class="btn-outline btn-sm" onclick="swTab('i')"><i class="fa-solid fa-upload"></i> Import CSV</button>
    </div>
    <div id="pnl-m">
      <div class="card" style="padding:14px;margin-bottom:12px;">
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-bottom:8px;">
          <div><label style="${LS()}">BULAN</label><input type="month" id="kj-bulan" value="${y}-${m}" style="${IS()}"></div>
          <div><label style="${LS()}">KARYAWAN</label><select id="kj-user" style="${SS()}"><option value="">Pilih Karyawan</option></select></div>
        </div>
        <button class="btn-primary full" onclick="loadGrid()"><i class="fa-solid fa-table"></i> Tampilkan Grid</button>
      </div>
      <div id="kj-grid"></div>
    </div>
    <div id="pnl-i" style="display:none;">
      <div class="card import-guide" style="margin-bottom:12px;">
        <h3><i class="fa-solid fa-circle-info" style="color:#60a5fa"></i> Cara Import dari Excel</h3>
        <ol><li>Download template CSV (nama karyawan sudah terisi otomatis)</li><li>Buka di Excel / Google Sheets</li><li>Isi kolom tanggal dengan <b>nama shift persis</b> (Pagi/Sore/Malam) atau kosongkan untuk libur</li><li>Save As CSV → upload di bawah</li></ol>
        <div class="import-format-box"><table class="import-table-preview"><thead><tr><th>Nama</th><th>01</th><th>02</th><th>03</th><th>...</th></tr></thead><tbody><tr><td>Budi Santoso</td><td><span class="shift-chip pagi">Pagi</span></td><td><span class="shift-chip sore">Sore</span></td><td><span class="shift-chip libur">Libur</span></td><td style="color:#475569;">...</td></tr></tbody></table></div>
        <p class="import-tip"><i class="fa-solid fa-lightbulb" style="color:#fbbf24"></i> Nama karyawan harus <b>sama persis</b> dengan data di sistem.</p>
      </div>
      <div class="card" style="padding:14px;margin-bottom:12px;">
        <h3 style="margin-bottom:10px;"><i class="fa-solid fa-download" style="color:#34d399"></i> Step 1 — Download Template</h3>
        <div style="display:flex;gap:8px;align-items:flex-end;flex-wrap:wrap;margin-bottom:16px;">
          <div style="flex:1;min-width:140px;"><label style="${LS()}">BULAN</label><input type="month" id="imp-bulan" value="${y}-${m}" style="${IS()}"></div>
          <button class="btn-success" onclick="dlTemplate()" style="height:40px;white-space:nowrap;"><i class="fa-solid fa-download"></i> Download Template CSV</button>
        </div>
        <h3 style="margin-bottom:10px;"><i class="fa-solid fa-upload" style="color:#a78bfa"></i> Step 2 — Upload File CSV</h3>
        <div onclick="document.getElementById('imp-file').click()" style="border:2px dashed rgba(255,255,255,.15);border-radius:12px;padding:24px;text-align:center;cursor:pointer;" onmouseover="this.style.borderColor='rgba(59,130,246,.5)'" onmouseout="this.style.borderColor='rgba(255,255,255,.15)'">
          <i class="fa-solid fa-file-csv" style="font-size:40px;color:#64748b;display:block;margin-bottom:10px;"></i>
          <p style="color:#64748b;font-size:13px;">Klik untuk pilih file CSV</p>
        </div>
        <input type="file" id="imp-file" accept=".csv" style="display:none;" onchange="previewCSV()">
        <div id="imp-prev" style="margin-top:12px;"></div>
      </div>
    </div>`;
  await Promise.all([loadUserSel('kj-user'),ensureShifts()]);
}

function swTab(t){
  document.getElementById('pnl-m').style.display=t==='m'?'':'none';
  document.getElementById('pnl-i').style.display=t==='i'?'':'none';
  document.getElementById('tab-m').className=t==='m'?'btn-primary btn-sm':'btn-outline btn-sm';
  document.getElementById('tab-i').className=t==='i'?'btn-primary btn-sm':'btn-outline btn-sm';
}

async function loadGrid(){
  const bulan=document.getElementById('kj-bulan')?.value,nama=document.getElementById('kj-user')?.value;
  const area=document.getElementById('kj-grid');
  if(!bulan||!nama){area.innerHTML=emptyH('Pilih bulan dan karyawan');return;}
  const[y,m]=bulan.split('-'),lastD=new Date(y,m,0).getDate();
  const from=`${y}-${m}-01`,to=`${y}-${m}-${String(lastD).padStart(2,'0')}`;
  area.innerHTML=loading();
  try{
    await ensureShifts();
    const ex=await sb('jadwal','GET',null,`?nama=eq.${enc(nama)}&tanggal=gte.${from}&tanggal=lte.${to}&select=*`);
    const jMap={}; ex.forEach(j=>jMap[j.tanggal]=j);
    const today=tgl(),opts=['<option value="">— Libur —</option>',...SHIFTS.map(s=>`<option value="${s.id}">${s.nama_shift}</option>`)].join('');
    const days=Array.from({length:lastD},(_,i)=>`${y}-${m}-${String(i+1).padStart(2,'0')}`);
    area.innerHTML=`<div class="card" style="padding:14px;">
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:14px;flex-wrap:wrap;gap:8px;">
        <h3 style="margin:0;"><i class="fa-solid fa-calendar-days" style="color:#60a5fa"></i> ${nama} — ${new Date(y,m-1).toLocaleDateString('id-ID',{month:'long',year:'numeric'})}</h3>
        <button class="btn-primary btn-sm" onclick="saveGrid('${nama}','${y}','${m}',${lastD})"><i class="fa-solid fa-save"></i> Simpan Jadwal</button>
      </div>
      <div class="jadwal-grid">${days.map(tgl2=>{const d=new Date(tgl2+'T00:00:00'),isSun=d.getDay()===0,isT=tgl2===today;return`<div class="jadwal-grid-item${isT?' today':''}${isSun?' minggu':''}"><div class="jadwal-grid-tgl"><span class="jadwal-grid-num" style="${isT?'color:#60a5fa;':''}">${d.getDate()}</span><span class="jadwal-grid-hari">${d.toLocaleDateString('id-ID',{weekday:'short'})}</span></div><select class="jadwal-grid-sel" id="sel-${tgl2}">${opts}</select></div>`;}).join('')}
      </div>
    </div>`;
    days.forEach(t2=>{const sel=document.getElementById(`sel-${t2}`);if(sel&&jMap[t2])sel.value=jMap[t2].shift_id||'';});
  }catch(e){area.innerHTML=errH(e.message);}
}

async function saveGrid(nama,y,m,lastD){
  showLoading();
  try{
    await sb(`jadwal?nama=eq.${enc(nama)}&tanggal=gte.${y}-${m}-01&tanggal=lte.${y}-${m}-${String(lastD).padStart(2,'0')}`,'DELETE');
    let n=0;
    for(let d=1;d<=lastD;d++){const t=`${y}-${m}-${String(d).padStart(2,'0')}`,sel=document.getElementById(`sel-${t}`);if(!sel?.value)continue;const sh=SHIFTS.find(s=>s.id==sel.value);if(!sh)continue;await sb('jadwal','POST',{nama,tanggal:t,shift_id:sh.id,nama_shift:sh.nama_shift,jam_masuk:sh.jam_masuk,jam_pulang:sh.jam_pulang});n++;}
    toast(`✅ Jadwal ${nama} disimpan — ${n} hari aktif`,'success');
  }catch(e){toast('Gagal: '+e.message,'error');}
  finally{hideLoading();}
}

async function dlTemplate(){
  const b=document.getElementById('imp-bulan')?.value;if(!b){toast('Pilih bulan','error');return;}
  const[y,m]=b.split('-'),lastD=new Date(y,m,0).getDate();
  const users=await sb('users','GET',null,'?status_akun=eq.Aktif&select=nama_lengkap&order=nama_lengkap.asc');
  dlCSV([['Nama',...Array.from({length:lastD},(_,i)=>String(i+1).padStart(2,'0'))],...users.map(u=>[u.nama_lengkap,...Array(lastD).fill('')])],`template_jadwal_${b}.csv`);
  toast('Template didownload!','success');
}

async function previewCSV(){
  const file=document.getElementById('imp-file').files[0];
  const b=document.getElementById('imp-bulan')?.value;
  if(!file)return;if(!b){toast('Pilih bulan di Step 1','error');return;}
  const[y,m]=b.split('-'),text=await file.text();
  const lines=text.trim().split(/\r?\n/).map(l=>{const r=[];let cur='',q=false;for(const ch of l){if(ch==='"')q=!q;else if(ch===','&&!q){r.push(cur.trim());cur='';}else cur+=ch;}r.push(cur.trim());return r;});
  const header=lines[0],dataRows=lines.slice(1).filter(r=>r[0]?.trim());
  await ensureShifts();
  const shMap={};SHIFTS.forEach(s=>shMap[s.nama_shift.toLowerCase()]=s);
  const errs=[],rows=[];
  dataRows.forEach(row=>{const nama=row[0]?.trim();if(!nama)return;for(let i=1;i<header.length;i++){const v=row[i]?.trim();if(!v||['libur','-',''].includes(v.toLowerCase()))continue;const sh=shMap[v.toLowerCase()];if(!sh){errs.push(`"${nama}" tgl ${header[i]}: shift "${v}" tidak ditemukan`);continue;}rows.push({nama,tanggal:`${y}-${m}-${header[i].trim().padStart(2,'0')}`,shift_id:sh.id,nama_shift:sh.nama_shift,jam_masuk:sh.jam_masuk,jam_pulang:sh.jam_pulang});}});
  IMP_ROWS=rows;IMP_BULAN=b;
  const namaSet=[...new Set(rows.map(r=>r.nama))];
  document.getElementById('imp-prev').innerHTML=`
    ${errs.length?`<div class="import-error-box" style="margin-bottom:12px;"><p><i class="fa-solid fa-triangle-exclamation"></i> ${errs.length} baris bermasalah:</p>${errs.slice(0,5).map(e=>`<div class="import-error-item">• ${e}</div>`).join('')}${errs.length>5?`<div class="import-error-item" style="color:#94a3b8;">...+${errs.length-5} lainnya</div>`:''}</div>`:''}
    <div style="background:rgba(59,130,246,.08);border:1px solid rgba(59,130,246,.2);border-radius:12px;padding:14px;margin-bottom:12px;">
      <div style="font-weight:700;color:#60a5fa;margin-bottom:8px;"><i class="fa-solid fa-table"></i> Preview — ${file.name}</div>
      <div style="font-size:13px;color:#94a3b8;line-height:1.9;">📋 ${dataRows.length} baris dibaca · 👥 ${namaSet.length} karyawan · ✅ ${rows.length} jadwal valid</div>
    </div>
    ${rows.length?`<button class="btn-primary full" id="btn-imp" onclick="doImport()"><i class="fa-solid fa-upload"></i> Import ${rows.length} Jadwal Sekarang</button>`:emptyH('Tidak ada data valid')}`;
}

async function doImport(){
  if(!IMP_ROWS.length){toast('Tidak ada data','error');return;}
  const[y,m]=IMP_BULAN.split('-');
  if(!confirm(`Import ${IMP_ROWS.length} jadwal untuk bulan ${new Date(y,m-1).toLocaleDateString('id-ID',{month:'long',year:'numeric'})}?\nJadwal lama bulan ini akan dihapus per karyawan.`))return;
  document.getElementById('btn-imp').disabled=true;showLoading();
  try{
    const from=`${y}-${m}-01`,to=`${y}-${m}-${String(new Date(y,m,0).getDate()).padStart(2,'0')}`;
    const ns=[...new Set(IMP_ROWS.map(r=>r.nama))];
    for(const n of ns)await sb(`jadwal?nama=eq.${enc(n)}&tanggal=gte.${from}&tanggal=lte.${to}`,'DELETE');
    let ok=0;for(const r of IMP_ROWS){await sb('jadwal','POST',r);ok++;}
    toast(`Import berhasil: ${ok} jadwal, ${ns.length} karyawan`,'success');
    document.getElementById('imp-prev').innerHTML=`<div class="import-result-box"><div class="result-title"><i class="fa-solid fa-circle-check"></i> Import Berhasil!</div><div class="import-result-item"><i class="fa-solid fa-check"></i> ${ok} jadwal disimpan</div><div class="import-result-item"><i class="fa-solid fa-users"></i> ${ns.length} karyawan: ${ns.join(', ')}</div></div>`;
    IMP_ROWS=[];document.getElementById('imp-file').value='';
  }catch(e){toast('Gagal import: '+e.message,'error');document.getElementById('btn-imp').disabled=false;}
  finally{hideLoading();}
}

// ============================================================
// MASTER SHIFT
// ============================================================
async function pgKelolaShift(){
  C().innerHTML=`<div class="page-header-row"><h2><i class="fa-solid fa-clock"></i> Master Shift</h2><button class="btn-primary btn-sm" onclick="openModalShift()"><i class="fa-solid fa-plus"></i> Tambah</button></div><div id="shift-list"><div class="loading-state"><i class="fa-solid fa-spinner fa-spin"></i></div></div>`;
  await loadShiftList();
}

async function loadShiftList(){
  try{
    SHIFTS=await sb('shift','GET',null,'?select=*&order=nama_shift.asc');
    const c=document.getElementById('shift-list');
    if(!SHIFTS.length){c.innerHTML=emptyH('Belum ada shift');return;}
    c.innerHTML=SHIFTS.map(s=>{const sc=shiftC(s.nama_shift);return`<div class="shift-card"><div class="shift-card-dot" style="background:${sc.text};"></div><div class="shift-card-info"><div class="shift-card-nama">${s.nama_shift}</div><div class="shift-card-jam"><i class="fa-solid fa-clock"></i> ${ft(s.jam_masuk)} – ${ft(s.jam_pulang)}</div>${s.keterangan?`<div class="shift-card-ket">${s.keterangan}</div>`:''}</div><div style="display:flex;gap:6px;"><button class="btn-icon edit" onclick='openModalShift(${JSON.stringify(s)})'><i class="fa-solid fa-pen"></i></button><button class="btn-icon delete" onclick="hapusShift(${s.id})"><i class="fa-solid fa-trash"></i></button></div></div>`;}).join('');
  }catch(e){document.getElementById('shift-list').innerHTML=errH(e.message);}
}

function openModalShift(s=null){document.getElementById('modal-shift-title').textContent=s?'Edit Shift':'Tambah Shift';document.getElementById('shift-id').value=s?.id||'';document.getElementById('shift-nama').value=s?.nama_shift||'';document.getElementById('shift-masuk').value=s?.jam_masuk?.slice(0,5)||'';document.getElementById('shift-pulang').value=s?.jam_pulang?.slice(0,5)||'';document.getElementById('shift-ket').value=s?.keterangan||'';document.getElementById('modal-shift').classList.add('show');}
function closeModalShift(){document.getElementById('modal-shift').classList.remove('show');}

async function saveShift(){
  const id=document.getElementById('shift-id').value;
  const p={nama_shift:document.getElementById('shift-nama').value.trim(),jam_masuk:document.getElementById('shift-masuk').value,jam_pulang:document.getElementById('shift-pulang').value,keterangan:document.getElementById('shift-ket').value.trim()};
  if(!p.nama_shift||!p.jam_masuk||!p.jam_pulang){toast('Lengkapi data shift','error');return;}
  showLoading();
  try{if(id)await sb(`shift?id=eq.${id}`,'PATCH',p);else await sb('shift','POST',p);toast(id?'Shift diperbarui':'Shift ditambahkan','success');closeModalShift();await loadShiftList();}
  catch(e){toast('Gagal: '+e.message,'error');}finally{hideLoading();}
}

async function hapusShift(id){if(!confirm('Hapus shift ini?'))return;showLoading();try{await sb(`shift?id=eq.${id}`,'DELETE');toast('Shift dihapus','success');await loadShiftList();}catch(e){toast('Gagal: '+e.message,'error');}finally{hideLoading();}}

// ============================================================
// KELOLA USER — Admin
// ============================================================
async function pgKelolaUser(){
  C().innerHTML=`
    <div class="page-header-row"><h2><i class="fa-solid fa-users"></i> Kelola Karyawan</h2><button class="btn-primary btn-sm" onclick="document.getElementById('modal-add-user').classList.add('show')"><i class="fa-solid fa-plus"></i> Tambah</button></div>
    <input type="text" placeholder="🔍 Cari nama atau email..." oninput="filterUsers(this.value)" style="width:100%;${IS()}margin-bottom:10px;">
    <div id="user-list"><div class="loading-state"><i class="fa-solid fa-spinner fa-spin"></i></div></div>`;
  await loadUserList();
}

async function loadUserList(){try{USERS=await sb('users','GET',null,'?select=*&order=nama_lengkap.asc');renderUsers(USERS);}catch(e){document.getElementById('user-list').innerHTML=errH(e.message);}}
function filterUsers(q){renderUsers(USERS.filter(u=>u.nama_lengkap.toLowerCase().includes(q.toLowerCase())||u.email.toLowerCase().includes(q.toLowerCase())));}
function renderUsers(list){
  const c=document.getElementById('user-list');
  if(!list.length){c.innerHTML=emptyH('Tidak ada karyawan');return;}
  c.innerHTML=list.map(u=>`<div class="user-card"><div class="user-avatar"><i class="fa-solid fa-user"></i></div><div class="user-info"><div class="user-nama">${u.nama_lengkap} <span class="role-badge">${u.role}</span></div><div class="user-email">${u.email}</div><span class="status-badge ${u.status_akun==='Aktif'?'success':'danger'}">${u.status_akun}</span></div><div class="user-actions"><button class="btn-icon edit" onclick='openModalEdit(${JSON.stringify(u)})'><i class="fa-solid fa-pen"></i></button><button class="btn-icon delete" onclick="deleteUser('${u.id_karyawan}')"><i class="fa-solid fa-trash"></i></button></div></div>`).join('');
}

function openModalEdit(u){document.getElementById('edit-user-id').value=u.id_karyawan;document.getElementById('edit-nama').value=u.nama_lengkap;document.getElementById('edit-nip').value=u.email;document.getElementById('edit-jabatan').value=u.role;document.getElementById('edit-status-user').value=u.status_akun;document.getElementById('edit-password').value='';document.getElementById('modal-edit-user').classList.add('show');}
function closeModalEdit(){document.getElementById('modal-edit-user').classList.remove('show');}

async function saveEditUser(){
  const id=document.getElementById('edit-user-id').value;
  const p={nama_lengkap:document.getElementById('edit-nama').value.trim(),role:document.getElementById('edit-jabatan').value,status_akun:document.getElementById('edit-status-user').value};
  const np=document.getElementById('edit-password').value;if(np)p.password=np;
  showLoading();
  try{await sb(`users?id_karyawan=eq.${id}`,'PATCH',p);toast('Data diperbarui','success');closeModalEdit();await loadUserList();if(id===CU.id_karyawan){CU={...CU,...p};localStorage.setItem('gns_user',JSON.stringify(CU));}}
  catch(e){toast('Gagal: '+e.message,'error');}finally{hideLoading();}
}

function closeModalAddUser(){document.getElementById('modal-add-user').classList.remove('show');}
async function saveAddUser(){
  const p={nama_lengkap:document.getElementById('add-nama').value.trim(),email:document.getElementById('add-email').value.trim(),password:document.getElementById('add-password').value,role:document.getElementById('add-role').value,status_akun:'Aktif'};
  if(!p.nama_lengkap||!p.email||!p.password){toast('Lengkapi semua field','error');return;}
  showLoading();
  try{await sb('users','POST',p);toast('Karyawan ditambahkan','success');closeModalAddUser();['add-nama','add-email','add-password'].forEach(id=>document.getElementById(id).value='');await loadUserList();}
  catch(e){toast('Gagal: '+e.message,'error');}finally{hideLoading();}
}

async function deleteUser(id){
  if(id===CU.id_karyawan){toast('Tidak bisa hapus akun sendiri','error');return;}
  if(!confirm('Hapus user ini?'))return;
  showLoading();try{await sb(`users?id_karyawan=eq.${id}`,'DELETE');toast('User dihapus','success');await loadUserList();}catch(e){toast('Gagal: '+e.message,'error');}finally{hideLoading();}
}

// ============================================================
// APPROVE PENGAJUAN — Admin
// ============================================================
async function pgApprovePQ(){
  C().innerHTML=`
    <div class="page-header-row"><h2><i class="fa-solid fa-check-to-slot"></i> Approve Izin/Cuti/Sakit</h2></div>
    <div style="display:flex;gap:6px;margin-bottom:12px;flex-wrap:wrap;">
      ${[['','Semua'],['Pending','⏳ Pending'],['Disetujui','✅ Disetujui'],['Ditolak','❌ Ditolak']].map(([v,l])=>`<button id="pqt-${v||'all'}" class="btn-${v===''?'primary':'outline'} btn-sm" onclick="fPQ('${v}')">${l}</button>`).join('')}
    </div>
    <div id="pq-list"><div class="loading-state"><i class="fa-solid fa-spinner fa-spin"></i></div></div>`;
  await loadPQ('');
}

async function fPQ(s){[['','all'],['Pending','Pending'],['Disetujui','Disetujui'],['Ditolak','Ditolak']].forEach(([v,k])=>{const el=document.getElementById(`pqt-${k}`);if(el)el.className=v===s?'btn-primary btn-sm':'btn-outline btn-sm';});await loadPQ(s);}

async function loadPQ(s){
  let q='?order=tgl_submit.desc&select=*';if(s)q+=`&status_approve=eq.${s}`;
  const c=document.getElementById('pq-list');c.innerHTML=loading();
  try{const list=await sb('pengajuan','GET',null,q);if(!list.length){c.innerHTML=emptyH('Tidak ada pengajuan');return;}c.innerHTML=list.map(p=>cPQ(p,true)).join('');}
  catch(e){c.innerHTML=errH(e.message);}
}

async function approvePQ(id,s){
  if(!confirm(`${s==='Disetujui'?'Setujui':'Tolak'} pengajuan ini?`))return;
  showLoading();try{await sb(`pengajuan?id_pengajuan=eq.${id}`,'PATCH',{status_approve:s});toast(`Pengajuan ${s}`,'success');await loadPQ('');}catch(e){toast('Gagal: '+e.message,'error');}finally{hideLoading();}
}

// compat alias
const approvePengajuan = approvePQ;

// ============================================================
// PROFIL
// ============================================================
async function pgProfil(){
  C().innerHTML=`
    <div class="card" style="margin-bottom:12px;">
      <div class="profil-card">
        <div class="profil-avatar"><i class="fa-solid fa-user"></i></div>
        <div class="profil-info"><h3>${CU.nama_lengkap}</h3><p>${CU.email}</p><span class="role-badge">${CU.role}</span> <span class="status-badge ${CU.status_akun==='Aktif'?'success':'danger'}">${CU.status_akun}</span></div>
      </div>
    </div>
    <div class="card" style="margin-bottom:12px;">
      <h3><i class="fa-solid fa-key" style="color:#fbbf24"></i> Ubah Password</h3>
      <div class="field"><label>Password Lama</label><input type="password" id="p-old" placeholder="Password saat ini"/></div>
      <div class="field"><label>Password Baru</label><input type="password" id="p-new" placeholder="Password baru"/></div>
      <div class="field"><label>Konfirmasi</label><input type="password" id="p-conf" placeholder="Ulangi password baru"/></div>
      <button class="btn-primary full" onclick="gantiPwd()"><i class="fa-solid fa-save"></i> Simpan Password</button>
    </div>
    <button class="sidebar-logout" style="width:100%;justify-content:center;" onclick="logout()"><i class="fa-solid fa-right-from-bracket"></i> Keluar</button>`;
}

async function gantiPwd(){
  const o=document.getElementById('p-old').value,n=document.getElementById('p-new').value,c=document.getElementById('p-conf').value;
  if(!o||!n||!c){toast('Isi semua field','error');return;}
  if(o!==CU.password){toast('Password lama salah','error');return;}
  if(n!==c){toast('Konfirmasi tidak cocok','error');return;}
  if(n.length<6){toast('Minimal 6 karakter','error');return;}
  showLoading();
  try{await sb(`users?id_karyawan=eq.${CU.id_karyawan}`,'PATCH',{password:n});CU.password=n;localStorage.setItem('gns_user',JSON.stringify(CU));toast('Password berhasil diubah','success');['p-old','p-new','p-conf'].forEach(id=>document.getElementById(id).value='');}
  catch(e){toast('Gagal: '+e.message,'error');}finally{hideLoading();}
}

// ============================================================
// HELPERS — Select options
// ============================================================
async function ensureShifts(){if(!SHIFTS.length)SHIFTS=await sb('shift','GET',null,'?select=*&order=nama_shift.asc');}
async function loadShiftSel(id){await ensureShifts();const sel=document.getElementById(id);if(!sel)return;while(sel.options.length>1)sel.remove(1);SHIFTS.forEach(s=>sel.appendChild(new Option(`${s.nama_shift} (${ft(s.jam_masuk)}-${ft(s.jam_pulang)})`,s.nama_shift)));}
async function loadUserSel(id){try{if(!USERS.length)USERS=await sb('users','GET',null,'?status_akun=eq.Aktif&select=id_karyawan,nama_lengkap&order=nama_lengkap.asc');const sel=document.getElementById(id);if(!sel)return;while(sel.options.length>1)sel.remove(1);USERS.forEach(u=>sel.appendChild(new Option(u.nama_lengkap,u.nama_lengkap)));}catch(_){}}

// ============================================================
// FORMAT HELPERS
// ============================================================
const ft   = t  => t?t.slice(0,5):'--:--';
const fd   = d  => d?new Date(d+'T00:00:00').toLocaleDateString('id-ID',{day:'2-digit',month:'short',year:'numeric'}):'-';
const fdLong = d=> d?new Date(d+'T00:00:00').toLocaleDateString('id-ID',{weekday:'long',day:'2-digit',month:'long',year:'numeric'}):'-';
const fdT  = dt => dt?new Date(dt).toLocaleString('id-ID',{day:'2-digit',month:'short',year:'numeric',hour:'2-digit',minute:'2-digit'}):'-';

function wkRange(){const n=new Date(),d=n.getDay()||7,mon=new Date(n),sun=new Date(n);mon.setDate(n.getDate()-d+1);sun.setDate(n.getDate()-d+7);return[mon.toLocaleDateString('sv-SE'),sun.toLocaleDateString('sv-SE')];}

function sBadge(s){if(!s)return'';const m={'Tepat Waktu':'success','Terlambat':'danger','Normal':'success','Pulang Awal':'warning','Aktif':'success','Nonaktif':'danger','Pending':'warning','Disetujui':'success','Ditolak':'danger'};return`<span class="status-badge ${m[s]||''}">${s}</span>`;}

function shiftC(n){const s=(n||'').toLowerCase();if(s.includes('pagi'))return{bg:'rgba(59,130,246,.15)',text:'#60a5fa'};if(s.includes('sore'))return{bg:'rgba(249,115,22,.15)',text:'#fb923c'};if(s.includes('malam'))return{bg:'rgba(139,92,246,.15)',text:'#a78bfa'};if(s.includes('libur'))return{bg:'rgba(100,116,139,.12)',text:'#64748b'};return{bg:'rgba(20,184,166,.15)',text:'#2dd4bf'};}

const C      = () => document.getElementById('content');
const emptyH = m  => `<div class="empty-state"><i class="fa-solid fa-inbox"></i><p>${m}</p></div>`;
const errH   = m  => `<div class="empty-state error"><i class="fa-solid fa-circle-exclamation"></i><p>Error: ${m}</p></div>`;
const loading= () => `<div class="loading-state"><i class="fa-solid fa-spinner fa-spin"></i> Memuat...</div>`;
const IS     = () => `background:rgba(255,255,255,.07);border:1px solid rgba(255,255,255,.1);border-radius:10px;color:#fff;padding:9px 12px;font-size:13px;outline:none;`;
const SS     = () => `background:#1e293b;border:1px solid rgba(255,255,255,.1);border-radius:10px;color:#fff;padding:9px 12px;font-size:13px;outline:none;width:100%;`;
const LS     = () => `font-size:10px;color:#64748b;font-weight:700;display:block;margin-bottom:4px;text-transform:uppercase;`;

// ============================================================
// LOADING & TOAST
// ============================================================
function showLoading(){document.getElementById('loading-overlay').style.display='flex';}
function hideLoading(){document.getElementById('loading-overlay').style.display='none';}

function toast(msg,type='info'){
  const c=document.getElementById('toast-container'),el=document.createElement('div');
  el.className=`toast toast-${type}`;
  el.innerHTML=`<i class="fa-solid ${type==='success'?'fa-circle-check':type==='error'?'fa-circle-exclamation':'fa-circle-info'}"></i> ${msg}`;
  c.appendChild(el);
  requestAnimationFrame(()=>el.classList.add('show'));
  setTimeout(()=>{el.classList.remove('show');setTimeout(()=>el.remove(),300);},3500);
}

// ============================================================
// MODAL — Close on backdrop + kamera
// ============================================================
document.querySelectorAll('.modal-bg').forEach(m=>{
  m.addEventListener('click',e=>{if(e.target===m){m.classList.remove('show');stopCam();}});
});

function stopCam(){if(CAM){CAM.getTracks().forEach(t=>t.stop());CAM=null;}}

// CSV download
//function dlCSV(rows,name){const csv=rows.map(r=>r.map(v=>`"${String(v||'').replace(/"/g,'""')}"`).join(',')).join('\n');const a=document.createElement('a');a.href=URL.createObjectURL(new Blob(['\uFEFF'+csv],{type:'text/csv;charset=utf-8;'}));a.download=name;a.click();}
//ENDSCRIPT
//echo "script.js done — $(wc -l < /mnt/user-data/outputs/absensi-app/script.js) lines"