// ==========================================
// GENIUS PRESENCE APP - script.js
// Supabase Vanilla JS Implementation
// ==========================================

const SUPA_URL  = 'https://kuldbrivmpqpoyeilbav.supabase.co';
const SUPA_ANON = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imt1bGRicml2bXBxcG95ZWlsYmF2Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzgzOTI4NDMsImV4cCI6MjA5Mzk2ODg0M30.je9yMizaJs5OJ4yuaxnw2vwPeGy1F_0j75SMU1IZZso';

// ---- Supabase REST Helper ----
async function sb(table, method = 'GET', body = null, query = '') {
  const url = `${SUPA_URL}/rest/v1/${table}${query}`;
  const opts = {
    method,
    headers: {
      'Content-Type': 'application/json',
      'apikey': SUPA_ANON,
      'Authorization': `Bearer ${SUPA_ANON}`,
      'Prefer': 'return=representation',
    },
  };
  if (body) opts.body = JSON.stringify(body);
  const res = await fetch(url, opts);
  const txt = await res.text();
  if (!res.ok) {
    let errMsg = `HTTP ${res.status}`;
    try {
      const err = JSON.parse(txt);
      errMsg = err.message || err.hint || err.details || errMsg;
    } catch(_) {}
    console.error('[Supabase Error]', res.status, txt);
    throw new Error(errMsg);
  }
  return txt ? JSON.parse(txt) : [];
}

// ---- State ----
let currentUser = null;
let currentPage = 'dashboard';
let cameraStream = null;
let capturedFotoB64 = null;
let absenMode = null; // 'masuk' or 'pulang'
let userLat = null, userLng = null;
let todayAbsen = null;
let todayJadwal = null;

// ==========================================
// INIT
// ==========================================
document.addEventListener('DOMContentLoaded', () => {
  const saved = localStorage.getItem('genius_user');
  if (saved) {
    currentUser = JSON.parse(saved);
    showApp();
  }
});

// ==========================================
// AUTH
// ==========================================
async function login() {
  const email = document.getElementById('username').value.trim();
  const pass  = document.getElementById('password').value;
  if (!email || !pass) { toast('Isi email dan password', 'error'); return; }
  showLoading();
  try {
    // Step 1: Cari user berdasarkan email dulu
    const byEmail = await sb('users', 'GET', null,
      `?email=eq.${encodeURIComponent(email)}&select=*`);

    if (!byEmail.length) {
      toast('Email tidak ditemukan', 'error');
      return;
    }

    const user = byEmail[0];

    // Step 2: Cek password
    if (user.password !== pass) {
      toast('Password salah', 'error');
      return;
    }

    // Step 3: Cek status akun
    if (user.status_akun === 'Nonaktif') {
      toast('Akun Anda dinonaktifkan, hubungi Admin', 'error');
      return;
    }

    currentUser = user;
    localStorage.setItem('genius_user', JSON.stringify(currentUser));
    showApp();
  } catch(e) {
    console.error('Login error:', e);
    // Jika RLS memblokir, minta user untuk cek Supabase
    if (e.message.includes('permission') || e.message.includes('policy') || e.message.includes('401') || e.message.includes('403')) {
      toast('Akses ditolak. RLS aktif — lihat petunjuk di bawah.', 'error');
      showRLSGuide();
    } else {
      toast('Gagal login: ' + e.message, 'error');
    }
  } finally { hideLoading(); }
}

function showRLSGuide() {
  // Tampilkan panduan RLS jika diblokir
  const box = document.getElementById('loginPage');
  if (document.getElementById('rls-guide')) return;
  const guide = document.createElement('div');
  guide.id = 'rls-guide';
  guide.style.cssText = `
    margin-top:16px; background:rgba(239,68,68,0.12);
    border:1px solid rgba(239,68,68,0.3); border-radius:14px;
    padding:16px; font-size:13px; color:#fca5a5; line-height:1.7;
  `;
  guide.innerHTML = `
    <b style="color:#f87171;">⚠️ Row Level Security (RLS) Aktif</b><br><br>
    Ikuti langkah berikut di <b>Supabase Dashboard</b>:<br>
    1. Buka <b>Table Editor → users</b><br>
    2. Klik <b>RLS Disabled</b> → atau buka <b>Authentication → Policies</b><br>
    3. Pilih tabel <b>users</b><br>
    4. Klik <b>"Disable RLS"</b> (untuk development)<br><br>
    <i style="color:#94a3b8;">Atau tambahkan Policy: Allow anon SELECT on users</i>
  `;
  box.appendChild(guide);
}

function logout() {
  if (!confirm('Yakin keluar?')) return;
  localStorage.removeItem('genius_user');
  currentUser = null;
  document.getElementById('loginPage').style.display = 'flex';
  document.getElementById('appPage').style.display = 'none';
  document.getElementById('username').value = '';
  document.getElementById('password').value = '';
}

// ==========================================
// APP SHELL
// ==========================================
function showApp() {
  document.getElementById('loginPage').style.display = 'none';
  document.getElementById('appPage').style.display = 'block';
  document.getElementById('userName').textContent = currentUser.nama_lengkap.split(' ')[0];
  buildSidebar();
  buildBottomNav();
  navigateTo('dashboard');
}

function buildSidebar() {
  const isAdmin = currentUser.role === 'Admin';
  let html = `
    <div class="sidebar-header">
      <div class="sb-name">${currentUser.nama_lengkap}</div>
      <div class="sb-role">${currentUser.role} • ${currentUser.email}</div>
    </div>
    <nav class="sidebar-nav">
      <div class="nav-section">Menu Utama</div>
      <a href="#" onclick="navigateTo('dashboard');closeSidebar();return false;" data-page="dashboard">
        <i class="fa-solid fa-house"></i> Dashboard
      </a>
      <a href="#" onclick="navigateTo('absensi');closeSidebar();return false;" data-page="absensi">
        <i class="fa-solid fa-fingerprint"></i> Absensi Saya
      </a>
      <a href="#" onclick="navigateTo('jadwal');closeSidebar();return false;" data-page="jadwal">
        <i class="fa-solid fa-calendar-days"></i> Jadwal Shift
      </a>
      <a href="#" onclick="navigateTo('pengajuan');closeSidebar();return false;" data-page="pengajuan">
        <i class="fa-solid fa-file-medical"></i> Pengajuan Izin
      </a>`;
  if (isAdmin) {
    html += `
      <div class="nav-section">Admin</div>
      <a href="#" onclick="navigateTo('rekap');closeSidebar();return false;" data-page="rekap">
        <i class="fa-solid fa-chart-bar"></i> Rekap Absensi
      </a>
      <a href="#" onclick="navigateTo('kelola-jadwal');closeSidebar();return false;" data-page="kelola-jadwal">
        <i class="fa-solid fa-table"></i> Kelola Jadwal
      </a>
      <a href="#" onclick="navigateTo('kelola-shift');closeSidebar();return false;" data-page="kelola-shift">
        <i class="fa-solid fa-clock"></i> Kelola Shift
      </a>
      <a href="#" onclick="navigateTo('kelola-user');closeSidebar();return false;" data-page="kelola-user">
        <i class="fa-solid fa-users"></i> Kelola Karyawan
      </a>
      <a href="#" onclick="navigateTo('approve-pengajuan');closeSidebar();return false;" data-page="approve-pengajuan">
        <i class="fa-solid fa-check-to-slot"></i> Approve Pengajuan
      </a>`;
  }
  html += `
      <div class="nav-section">Akun</div>
      <a href="#" onclick="navigateTo('profil');closeSidebar();return false;" data-page="profil">
        <i class="fa-solid fa-user"></i> Profil Saya
      </a>
      <a href="#" onclick="logout();return false;">
        <i class="fa-solid fa-right-from-bracket"></i> Keluar
      </a>
    </nav>`;
  document.getElementById('sidebar').innerHTML = html;
}

function buildBottomNav() {
  const isAdmin = currentUser.role === 'Admin';
  let items = [
    { page: 'dashboard', icon: 'fa-house', label: 'Home' },
    { page: 'absensi', icon: 'fa-fingerprint', label: 'Absensi' },
    { page: 'jadwal', icon: 'fa-calendar-days', label: 'Jadwal' },
    { page: 'pengajuan', icon: 'fa-file-medical', label: 'Izin' },
  ];
  if (isAdmin) items.push({ page: 'rekap', icon: 'fa-chart-bar', label: 'Rekap' });

  document.getElementById('bottomNav').innerHTML = items.map(i => `
    <button class="bottom-nav-item${currentPage === i.page ? ' active' : ''}" onclick="navigateTo('${i.page}')">
      <i class="fa-solid ${i.icon}"></i>
      <span>${i.label}</span>
    </button>`).join('');
}

function toggleSidebar() {
  document.getElementById('sidebar').classList.toggle('open');
  document.getElementById('overlay').classList.toggle('active');
}

function closeSidebar() {
  document.getElementById('sidebar').classList.remove('open');
  document.getElementById('overlay').classList.remove('active');
}

async function navigateTo(page) {
  currentPage = page;
  buildBottomNav();
  // Update sidebar active
  document.querySelectorAll('#sidebar a[data-page]').forEach(a => {
    a.classList.toggle('active', a.dataset.page === page);
  });
  const cont = document.getElementById('content');
  cont.innerHTML = '<div class="empty-state"><i class="fa-solid fa-spinner fa-spin"></i><p>Memuat...</p></div>';

  switch(page) {
    case 'dashboard':      await renderDashboard(); break;
    case 'absensi':        await renderAbsensiSaya(); break;
    case 'jadwal':         await renderJadwal(); break;
    case 'pengajuan':      await renderPengajuan(); break;
    case 'rekap':          await renderRekap(); break;
    case 'kelola-jadwal':  await renderKelolaJadwal(); break;
    case 'kelola-shift':   await renderKelolaShift(); break;
    case 'kelola-user':    await renderKelolaUser(); break;
    case 'approve-pengajuan': await renderApprovePengajuan(); break;
    case 'profil':         await renderProfil(); break;
    default: cont.innerHTML = '<div class="empty-state"><i class="fa-solid fa-circle-question"></i><p>Halaman tidak ditemukan</p></div>';
  }
}

// ==========================================
// DASHBOARD
// ==========================================
async function renderDashboard() {
  const today = todayStr();
  try {
    const [jadwalList, absenList] = await Promise.all([
      sb('jadwal', 'GET', null, `?nama=eq.${encodeURIComponent(currentUser.nama_lengkap)}&tanggal=eq.${today}&select=*`),
      sb('absensi', 'GET', null, `?nama=eq.${encodeURIComponent(currentUser.nama_lengkap)}&tanggal=eq.${today}&select=*`),
    ]);

    todayJadwal = jadwalList[0] || null;
    todayAbsen  = absenList[0] || null;

    const waktuMasuk  = todayAbsen?.waktu_masuk  ? fmtTime(todayAbsen.waktu_masuk) : '--:--';
    const waktuPulang = todayAbsen?.waktu_pulang ? fmtTime(todayAbsen.waktu_pulang) : '--:--';
    const sudahMasuk  = !!todayAbsen?.waktu_masuk;
    const sudahPulang = !!todayAbsen?.waktu_pulang;

    // Weekly stats
    const [mon, sun] = getWeekRange();
    const weekAbsen = await sb('absensi', 'GET', null,
      `?nama=eq.${encodeURIComponent(currentUser.nama_lengkap)}&tanggal=gte.${mon}&tanggal=lte.${sun}&select=*`);
    const hadir = weekAbsen.filter(a => a.waktu_masuk).length;
    const telat = weekAbsen.filter(a => a.status_masuk === 'Terlambat').length;

    document.getElementById('content').innerHTML = `
      <div>
        <div class="card" style="background:linear-gradient(135deg,#1e40af,#3b82f6);color:#fff;margin-bottom:12px;">
          <div style="font-size:.75rem;opacity:.8;">📅 ${fmtDateLong(today)}</div>
          <div style="font-size:1.5rem;font-weight:800;margin-top:4px;" id="clock-display">--:--:--</div>
          <div style="font-size:.8rem;opacity:.8;margin-top:2px;">Selamat datang, <b>${currentUser.nama_lengkap.split(' ')[0]}</b> 👋</div>
        </div>

        ${todayJadwal ? `
        <div class="shift-info-box">
          <div class="sib-label">🔄 Shift Hari Ini</div>
          <div class="sib-name">${todayJadwal.nama_shift || 'Shift'}</div>
          <div class="sib-time"><i class="fa-solid fa-clock"></i> ${fmtTime(todayJadwal.jam_masuk)} - ${fmtTime(todayJadwal.jam_pulang)}</div>
        </div>` : `
        <div class="card" style="border-left:4px solid #f59e0b;">
          <div style="color:#d97706;font-weight:700;"><i class="fa-solid fa-triangle-exclamation"></i> Tidak ada jadwal shift hari ini</div>
        </div>`}

        <div class="absen-row">
          <button class="btn-absen masuk${sudahMasuk ? ' done' : ''}" onclick="${sudahMasuk ? '' : "openAbsen('masuk')"}">
            <i class="fa-solid fa-${sudahMasuk ? 'check-circle' : 'right-to-bracket'}"></i>
            <span>${sudahMasuk ? 'Masuk ' + waktuMasuk : 'Absen Masuk'}</span>
          </button>
          <button class="btn-absen pulang${sudahPulang ? ' done' : ''}" 
            onclick="${sudahPulang ? '' : "openAbsen('pulang')"}"
            ${!sudahMasuk ? 'disabled' : ''}>
            <i class="fa-solid fa-${sudahPulang ? 'check-circle' : 'right-from-bracket'}"></i>
            <span>${sudahPulang ? 'Pulang ' + waktuPulang : 'Absen Pulang'}</span>
          </button>
        </div>

        <div class="stats-grid">
          <div class="stat-card green">
            <div class="stat-label">Hadir Minggu Ini</div>
            <div class="stat-value">${hadir}</div>
            <div class="stat-sub">Hari</div>
          </div>
          <div class="stat-card red">
            <div class="stat-label">Terlambat</div>
            <div class="stat-value">${telat}</div>
            <div class="stat-sub">Kali minggu ini</div>
          </div>
        </div>

        ${todayAbsen ? `
        <div class="card">
          <div class="card-title"><i class="fa-solid fa-circle-check"></i> Status Absen Hari Ini</div>
          <div style="display:flex;gap:12px;flex-wrap:wrap;">
            <div>
              <div style="font-size:.72rem;color:var(--gray);font-weight:700;">MASUK</div>
              <div style="font-weight:700;">${waktuMasuk}</div>
              ${badgeHtml(todayAbsen.status_masuk)}
            </div>
            <div>
              <div style="font-size:.72rem;color:var(--gray);font-weight:700;">PULANG</div>
              <div style="font-weight:700;">${waktuPulang}</div>
              ${todayAbsen.status_pulang ? badgeHtml(todayAbsen.status_pulang) : '<span style="color:var(--gray);font-size:.8rem;">-</span>'}
            </div>
          </div>
        </div>` : ''}

        <div class="card">
          <div class="card-title"><i class="fa-solid fa-file-medical"></i> Pengajuan Cepat</div>
          <button class="btn-primary" onclick="openModalPengajuan()" style="width:100%;justify-content:center;">
            <i class="fa-solid fa-plus"></i> Ajukan Izin / Sakit
          </button>
        </div>
      </div>
    `;

    // Live clock
    startClock();
  } catch(e) {
    document.getElementById('content').innerHTML = errHtml(e.message);
  }
}

let clockInterval = null;
function startClock() {
  if (clockInterval) clearInterval(clockInterval);
  const el = document.getElementById('clock-display');
  if (!el) return;
  const tick = () => {
    if (!document.getElementById('clock-display')) { clearInterval(clockInterval); return; }
    document.getElementById('clock-display').textContent = new Date().toLocaleTimeString('id-ID');
  };
  tick();
  clockInterval = setInterval(tick, 1000);
}

// ==========================================
// ABSENSI SAYA
// ==========================================
async function renderAbsensiSaya() {
  const thisMonth = new Date().toISOString().slice(0, 7);
  try {
    const list = await sb('absensi', 'GET', null,
      `?nama=eq.${encodeURIComponent(currentUser.nama_lengkap)}&tanggal=gte.${thisMonth}-01&order=tanggal.desc&select=*`);

    const hadir = list.filter(a => a.waktu_masuk).length;
    const telat  = list.filter(a => a.status_masuk === 'Terlambat').length;

    document.getElementById('content').innerHTML = `
      <div class="page-header">
        <h2><i class="fa-solid fa-fingerprint"></i> Absensi Saya</h2>
      </div>
      <div class="stats-grid" style="margin-bottom:12px;">
        <div class="stat-card green"><div class="stat-label">Total Hadir</div><div class="stat-value">${hadir}</div></div>
        <div class="stat-card red"><div class="stat-label">Terlambat</div><div class="stat-value">${telat}</div></div>
      </div>
      <div id="absen-list">
        ${list.length === 0 ? emptyHtml('Belum ada data absensi bulan ini') : list.map(a => `
        <div class="absen-record">
          <div class="ar-top">
            <div class="ar-date">${fmtDateLong(a.tanggal)}</div>
            ${badgeHtml(a.status_masuk)}
          </div>
          <div class="ar-times">
            <span class="ar-time-item"><i class="fa-solid fa-arrow-right-to-bracket" style="color:var(--primary)"></i> ${a.waktu_masuk ? fmtTime(a.waktu_masuk) : '-'}</span>
            <span class="ar-time-item"><i class="fa-solid fa-arrow-right-from-bracket" style="color:var(--danger)"></i> ${a.waktu_pulang ? fmtTime(a.waktu_pulang) : '-'}</span>
            <span class="ar-time-item"><i class="fa-solid fa-clock"></i> ${a.nama_shift || '-'}</span>
          </div>
          ${a.ket_telat ? `<div style="font-size:.78rem;color:var(--danger);margin-top:4px;"><i class="fa-solid fa-triangle-exclamation"></i> ${a.ket_telat}</div>` : ''}
        </div>`).join('')}
      </div>`;
  } catch(e) {
    document.getElementById('content').innerHTML = errHtml(e.message);
  }
}

// ==========================================
// JADWAL SHIFT
// ==========================================
async function renderJadwal() {
  const now = new Date();
  const defaultMonth = now.toISOString().slice(0, 7);
  document.getElementById('content').innerHTML = `
    <div class="page-header">
      <h2><i class="fa-solid fa-calendar-days"></i> Jadwal Shift</h2>
    </div>
    <div class="jadwal-filters">
      <input type="month" id="filter-bulan" value="${defaultMonth}" onchange="loadJadwal()">
    </div>
    <div id="jadwal-content"><div class="empty-state"><i class="fa-solid fa-spinner fa-spin"></i></div></div>`;
  await loadJadwal();
}

async function loadJadwal() {
  const bulan = document.getElementById('filter-bulan')?.value;
  if (!bulan) return;
  const [y, m] = bulan.split('-');
  const from = `${y}-${m}-01`;
  const lastDay = new Date(y, m, 0).getDate();
  const to = `${y}-${m}-${String(lastDay).padStart(2,'0')}`;

  const cont = document.getElementById('jadwal-content');
  cont.innerHTML = '<div class="empty-state"><i class="fa-solid fa-spinner fa-spin"></i></div>';
  try {
    const list = await sb('jadwal', 'GET', null,
      `?nama=eq.${encodeURIComponent(currentUser.nama_lengkap)}&tanggal=gte.${from}&tanggal=lte.${to}&order=tanggal.asc&select=*`);

    if (!list.length) { cont.innerHTML = emptyHtml('Tidak ada jadwal bulan ini'); return; }
    cont.innerHTML = list.map(j => `
      <div class="absen-record">
        <div class="ar-top">
          <div class="ar-date">${fmtDateLong(j.tanggal)}</div>
          <span class="badge badge-blue">${j.nama_shift || 'Shift'}</span>
        </div>
        <div class="ar-times">
          <span><i class="fa-solid fa-clock"></i> ${fmtTime(j.jam_masuk)} - ${fmtTime(j.jam_pulang)}</span>
        </div>
      </div>`).join('');
  } catch(e) {
    cont.innerHTML = errHtml(e.message);
  }
}

// ==========================================
// PENGAJUAN IZIN (Staff)
// ==========================================
async function renderPengajuan() {
  try {
    const list = await sb('pengajuan', 'GET', null,
      `?nama_karyawan=eq.${encodeURIComponent(currentUser.nama_lengkap)}&order=tgl_submit.desc&select=*`);
    document.getElementById('content').innerHTML = `
      <div class="page-header">
        <h2><i class="fa-solid fa-file-medical"></i> Pengajuan Izin</h2>
        <button class="btn-primary btn-sm" onclick="openModalPengajuan()"><i class="fa-solid fa-plus"></i> Ajukan</button>
      </div>
      <div id="pengajuan-list">
        ${list.length === 0 ? emptyHtml('Belum ada pengajuan') : list.map(p => pengajuanCardHtml(p, false)).join('')}
      </div>`;
  } catch(e) {
    document.getElementById('content').innerHTML = errHtml(e.message);
  }
}

function pengajuanCardHtml(p, isAdmin) {
  const statusClass = { 'Pending': 'pending', 'Disetujui': 'approved', 'Ditolak': 'rejected' }[p.status_approve] || 'pending';
  const badgeClass = { 'Pending': 'badge-yellow', 'Disetujui': 'badge-green', 'Ditolak': 'badge-red' }[p.status_approve] || 'badge-gray';
  return `
    <div class="pengajuan-card ${statusClass}">
      <div class="pq-header">
        <div>
          ${isAdmin ? `<div class="pq-name">${p.nama_karyawan}</div>` : ''}
          <div class="pq-type"><i class="fa-solid fa-tag"></i> ${p.tipe_izin}</div>
        </div>
        <span class="badge ${badgeClass}">${p.status_approve}</span>
      </div>
      <div class="pq-ket">${p.keterangan || '-'}</div>
      ${p.link_surat_sakit ? `<div style="margin-top:6px;"><a href="${p.link_surat_sakit}" target="_blank" style="color:var(--primary);font-size:.8rem;"><i class="fa-solid fa-link"></i> Lihat Surat</a></div>` : ''}
      <div class="pq-date"><i class="fa-regular fa-clock"></i> ${fmtDateTime(p.tgl_submit)}</div>
      ${isAdmin && p.status_approve === 'Pending' ? `
      <div class="pq-actions">
        <button class="btn-primary btn-sm" onclick="approvePengajuan(${p.id_pengajuan},'Disetujui')"><i class="fa-solid fa-check"></i> Setujui</button>
        <button class="btn-danger btn-sm" onclick="approvePengajuan(${p.id_pengajuan},'Ditolak')"><i class="fa-solid fa-xmark"></i> Tolak</button>
      </div>` : ''}
    </div>`;
}

// ==========================================
// REKAP ABSENSI (Admin)
// ==========================================
async function renderRekap() {
  const today = todayStr();
  const [y, m] = today.split('-');
  document.getElementById('content').innerHTML = `
    <div class="page-header">
      <h2><i class="fa-solid fa-chart-bar"></i> Rekap Absensi</h2>
    </div>
    <div class="filter-row">
      <input type="month" id="rekap-bulan" value="${y}-${m}" onchange="loadRekap()">
      <input type="text" id="rekap-search" placeholder="Cari nama..." oninput="loadRekap()" style="flex:2;">
    </div>
    <div id="rekap-content"><div class="empty-state"><i class="fa-solid fa-spinner fa-spin"></i></div></div>`;
  await loadRekap();
}

async function loadRekap() {
  const bulan = document.getElementById('rekap-bulan')?.value;
  const search = document.getElementById('rekap-search')?.value.toLowerCase() || '';
  if (!bulan) return;
  const [y, m] = bulan.split('-');
  const from = `${y}-${m}-01`;
  const lastDay = new Date(y, m, 0).getDate();
  const to = `${y}-${m}-${String(lastDay).padStart(2,'0')}`;

  const cont = document.getElementById('rekap-content');
  cont.innerHTML = '<div class="empty-state"><i class="fa-solid fa-spinner fa-spin"></i></div>';
  try {
    let list = await sb('absensi', 'GET', null,
      `?tanggal=gte.${from}&tanggal=lte.${to}&order=tanggal.desc&select=*`);
    if (search) list = list.filter(a => a.nama.toLowerCase().includes(search));

    if (!list.length) { cont.innerHTML = emptyHtml('Tidak ada data'); return; }

    // Group by name for summary
    const byName = {};
    list.forEach(a => {
      if (!byName[a.nama]) byName[a.nama] = { hadir: 0, telat: 0, pulang: 0 };
      if (a.waktu_masuk) byName[a.nama].hadir++;
      if (a.status_masuk === 'Terlambat') byName[a.nama].telat++;
      if (a.waktu_pulang) byName[a.nama].pulang++;
    });

    cont.innerHTML = `
      <div class="card" style="margin-bottom:12px;">
        <div class="card-title"><i class="fa-solid fa-users"></i> Ringkasan Per Karyawan</div>
        <div class="tbl-wrap">
          <table>
            <thead><tr><th>Nama</th><th>Hadir</th><th>Terlambat</th><th>Pulang</th></tr></thead>
            <tbody>
              ${Object.entries(byName).map(([n,s]) => `
              <tr>
                <td><b>${n}</b></td>
                <td><span class="badge badge-green">${s.hadir}</span></td>
                <td><span class="badge badge-red">${s.telat}</span></td>
                <td><span class="badge badge-blue">${s.pulang}</span></td>
              </tr>`).join('')}
            </tbody>
          </table>
        </div>
      </div>
      <div class="card">
        <div class="card-title"><i class="fa-solid fa-list"></i> Detail Absensi</div>
        <div class="tbl-wrap">
          <table>
            <thead><tr><th>Tanggal</th><th>Nama</th><th>Shift</th><th>Masuk</th><th>Pulang</th><th>Status</th></tr></thead>
            <tbody>
              ${list.map(a => `
              <tr>
                <td style="white-space:nowrap;">${fmtDate(a.tanggal)}</td>
                <td>${a.nama}</td>
                <td>${a.nama_shift || '-'}</td>
                <td>${a.waktu_masuk ? fmtTime(a.waktu_masuk) : '-'}</td>
                <td>${a.waktu_pulang ? fmtTime(a.waktu_pulang) : '-'}</td>
                <td>${badgeHtml(a.status_masuk)}</td>
              </tr>`).join('')}
            </tbody>
          </table>
        </div>
      </div>`;
  } catch(e) {
    cont.innerHTML = errHtml(e.message);
  }
}

// ==========================================
// KELOLA JADWAL (Admin)
// ==========================================
async function renderKelolaJadwal() {
  const today = todayStr();
  const [y, m] = today.split('-');
  document.getElementById('content').innerHTML = `
    <div class="page-header">
      <h2><i class="fa-solid fa-table"></i> Kelola Jadwal</h2>
    </div>
    <div class="filter-row">
      <input type="month" id="kj-bulan" value="${y}-${m}" onchange="loadKelolaJadwal()">
      <input type="text" id="kj-nama" placeholder="Cari nama..." oninput="loadKelolaJadwal()" style="flex:2;">
    </div>
    <div class="card" style="margin-bottom:12px;">
      <div class="card-title"><i class="fa-solid fa-plus-circle"></i> Tambah Jadwal</div>
      <div class="filter-row" style="flex-wrap:wrap;">
        <input type="text" id="kj-new-nama" placeholder="Nama karyawan" style="flex:2;min-width:140px;">
        <input type="date" id="kj-new-tgl" value="${today}" style="flex:1;min-width:120px;">
        <select id="kj-new-shift" style="flex:1;min-width:120px;">
          <option value="">-- Pilih Shift --</option>
        </select>
      </div>
      <button class="btn-primary" onclick="tambahJadwal()" style="width:100%;justify-content:center;margin-top:6px;">
        <i class="fa-solid fa-plus"></i> Tambah Jadwal
      </button>
    </div>
    <div id="kj-content"><div class="empty-state"><i class="fa-solid fa-spinner fa-spin"></i></div></div>`;
  await loadShiftOptions('kj-new-shift');
  await loadKelolaJadwal();
}

async function loadShiftOptions(selectId) {
  try {
    const shifts = await sb('shift', 'GET', null, '?select=*&order=nama_shift.asc');
    const sel = document.getElementById(selectId);
    if (!sel) return;
    shifts.forEach(s => {
      const opt = document.createElement('option');
      opt.value = s.id;
      opt.textContent = `${s.nama_shift} (${fmtTime(s.jam_masuk)}-${fmtTime(s.jam_pulang)})`;
      opt.dataset.nama = s.nama_shift;
      opt.dataset.masuk = s.jam_masuk;
      opt.dataset.pulang = s.jam_pulang;
      sel.appendChild(opt);
    });
  } catch(e) {}
}

async function loadKelolaJadwal() {
  const bulan = document.getElementById('kj-bulan')?.value;
  const nama = document.getElementById('kj-nama')?.value.toLowerCase() || '';
  if (!bulan) return;
  const [y, m] = bulan.split('-');
  const from = `${y}-${m}-01`;
  const lastDay = new Date(y, m, 0).getDate();
  const to = `${y}-${m}-${String(lastDay).padStart(2,'0')}`;

  const cont = document.getElementById('kj-content');
  cont.innerHTML = '<div class="empty-state"><i class="fa-solid fa-spinner fa-spin"></i></div>';
  try {
    let list = await sb('jadwal', 'GET', null,
      `?tanggal=gte.${from}&tanggal=lte.${to}&order=tanggal.asc&select=*`);
    if (nama) list = list.filter(j => j.nama.toLowerCase().includes(nama));

    if (!list.length) { cont.innerHTML = emptyHtml('Tidak ada jadwal'); return; }

    cont.innerHTML = `<div class="card"><div class="tbl-wrap"><table>
      <thead><tr><th>Tanggal</th><th>Nama</th><th>Shift</th><th>Jam</th><th>Aksi</th></tr></thead>
      <tbody>
        ${list.map(j => `
        <tr>
          <td>${fmtDate(j.tanggal)}</td>
          <td>${j.nama}</td>
          <td><span class="badge badge-blue">${j.nama_shift || '-'}</span></td>
          <td style="white-space:nowrap;">${fmtTime(j.jam_masuk)} - ${fmtTime(j.jam_pulang)}</td>
          <td><button class="action-btn delete" onclick="hapusJadwal(${j.id})"><i class="fa-solid fa-trash"></i></button></td>
        </tr>`).join('')}
      </tbody>
    </table></div></div>`;
  } catch(e) {
    cont.innerHTML = errHtml(e.message);
  }
}

async function tambahJadwal() {
  const nama = document.getElementById('kj-new-nama').value.trim();
  const tgl = document.getElementById('kj-new-tgl').value;
  const shiftSel = document.getElementById('kj-new-shift');
  const shiftId = shiftSel.value;
  if (!nama || !tgl || !shiftId) { toast('Lengkapi semua field', 'error'); return; }
  const opt = shiftSel.selectedOptions[0];
  showLoading();
  try {
    await sb('jadwal', 'POST', {
      nama,
      tanggal: tgl,
      shift_id: parseInt(shiftId),
      nama_shift: opt.dataset.nama,
      jam_masuk: opt.dataset.masuk,
      jam_pulang: opt.dataset.pulang,
    });
    toast('Jadwal berhasil ditambahkan', 'success');
    document.getElementById('kj-new-nama').value = '';
    await loadKelolaJadwal();
  } catch(e) { toast('Gagal: ' + e.message, 'error'); }
  finally { hideLoading(); }
}

async function hapusJadwal(id) {
  if (!confirm('Hapus jadwal ini?')) return;
  showLoading();
  try {
    await sb(`jadwal?id=eq.${id}`, 'DELETE');
    toast('Jadwal dihapus', 'success');
    await loadKelolaJadwal();
  } catch(e) { toast('Gagal hapus: ' + e.message, 'error'); }
  finally { hideLoading(); }
}

// ==========================================
// KELOLA SHIFT (Admin)
// ==========================================
async function renderKelolaShift() {
  document.getElementById('content').innerHTML = `
    <div class="page-header">
      <h2><i class="fa-solid fa-clock"></i> Kelola Shift</h2>
      <button class="btn-primary btn-sm" onclick="openModalShift()"><i class="fa-solid fa-plus"></i> Tambah</button>
    </div>
    <div id="shift-list"><div class="empty-state"><i class="fa-solid fa-spinner fa-spin"></i></div></div>`;
  await loadShiftList();
}

async function loadShiftList() {
  try {
    const list = await sb('shift', 'GET', null, '?select=*&order=nama_shift.asc');
    const cont = document.getElementById('shift-list');
    if (!list.length) { cont.innerHTML = emptyHtml('Belum ada shift'); return; }
    cont.innerHTML = list.map(s => `
      <div class="shift-card">
        <div class="sc-icon"><i class="fa-solid fa-clock"></i></div>
        <div class="sc-info">
          <div class="sc-name">${s.nama_shift}</div>
          <div class="sc-time">${fmtTime(s.jam_masuk)} - ${fmtTime(s.jam_pulang)}${s.keterangan ? ' · ' + s.keterangan : ''}</div>
        </div>
        <div class="sc-actions">
          <button class="action-btn" onclick='editShift(${JSON.stringify(s)})'><i class="fa-solid fa-pen"></i></button>
          <button class="action-btn delete" onclick="hapusShift(${s.id})"><i class="fa-solid fa-trash"></i></button>
        </div>
      </div>`).join('');
  } catch(e) {
    document.getElementById('shift-list').innerHTML = errHtml(e.message);
  }
}

function openModalShift(shift = null) {
  document.getElementById('modal-shift-title').textContent = shift ? 'Edit Shift' : 'Tambah Shift';
  document.getElementById('shift-id').value = shift?.id || '';
  document.getElementById('shift-nama').value = shift?.nama_shift || '';
  document.getElementById('shift-masuk').value = shift?.jam_masuk?.slice(0,5) || '';
  document.getElementById('shift-pulang').value = shift?.jam_pulang?.slice(0,5) || '';
  document.getElementById('shift-ket').value = shift?.keterangan || '';
  document.getElementById('modal-shift').classList.add('open');
}

function closeModalShift() { document.getElementById('modal-shift').classList.remove('open'); }

function editShift(s) { openModalShift(s); }

async function saveShift() {
  const id = document.getElementById('shift-id').value;
  const payload = {
    nama_shift: document.getElementById('shift-nama').value.trim(),
    jam_masuk:  document.getElementById('shift-masuk').value,
    jam_pulang: document.getElementById('shift-pulang').value,
    keterangan: document.getElementById('shift-ket').value.trim(),
  };
  if (!payload.nama_shift || !payload.jam_masuk || !payload.jam_pulang) {
    toast('Lengkapi data shift', 'error'); return;
  }
  showLoading();
  try {
    if (id) {
      await sb(`shift?id=eq.${id}`, 'PATCH', payload);
      toast('Shift diperbarui', 'success');
    } else {
      await sb('shift', 'POST', payload);
      toast('Shift ditambahkan', 'success');
    }
    closeModalShift();
    await loadShiftList();
  } catch(e) { toast('Gagal: ' + e.message, 'error'); }
  finally { hideLoading(); }
}

async function hapusShift(id) {
  if (!confirm('Hapus shift ini?')) return;
  showLoading();
  try {
    await sb(`shift?id=eq.${id}`, 'DELETE');
    toast('Shift dihapus', 'success');
    await loadShiftList();
  } catch(e) { toast('Gagal: ' + e.message, 'error'); }
  finally { hideLoading(); }
}

// ==========================================
// KELOLA USER (Admin)
// ==========================================
async function renderKelolaUser() {
  document.getElementById('content').innerHTML = `
    <div class="page-header">
      <h2><i class="fa-solid fa-users"></i> Karyawan</h2>
      <button class="btn-primary btn-sm" onclick="document.getElementById('modal-add-user').classList.add('open')">
        <i class="fa-solid fa-plus"></i> Tambah
      </button>
    </div>
    <div class="search-box">
      <i class="fa-solid fa-magnifying-glass"></i>
      <input type="text" placeholder="Cari nama atau email..." oninput="filterUsers(this.value)" id="user-search">
    </div>
    <div id="user-list"><div class="empty-state"><i class="fa-solid fa-spinner fa-spin"></i></div></div>`;
  await loadUserList();
}

let allUsers = [];
async function loadUserList() {
  try {
    allUsers = await sb('users', 'GET', null, '?select=*&order=nama_lengkap.asc');
    renderUserList(allUsers);
  } catch(e) {
    document.getElementById('user-list').innerHTML = errHtml(e.message);
  }
}

function filterUsers(q) {
  const filtered = allUsers.filter(u =>
    u.nama_lengkap.toLowerCase().includes(q.toLowerCase()) ||
    u.email.toLowerCase().includes(q.toLowerCase()));
  renderUserList(filtered);
}

function renderUserList(list) {
  const cont = document.getElementById('user-list');
  if (!list.length) { cont.innerHTML = emptyHtml('Tidak ada karyawan'); return; }
  cont.innerHTML = list.map(u => `
    <div class="user-item">
      <div class="user-avatar">${u.nama_lengkap[0].toUpperCase()}</div>
      <div class="ui-info">
        <div class="ui-name">${u.nama_lengkap}</div>
        <div class="ui-email">${u.email} · ${u.role}</div>
        ${badgeHtml(u.status_akun)}
      </div>
      <div class="ui-actions">
        <button class="action-btn" onclick='openModalEdit(${JSON.stringify(u)})'><i class="fa-solid fa-pen"></i></button>
        <button class="action-btn delete" onclick="deleteUser('${u.id_karyawan}')"><i class="fa-solid fa-trash"></i></button>
      </div>
    </div>`).join('');
}

function openModalEdit(u) {
  document.getElementById('edit-user-id').value = u.id_karyawan;
  document.getElementById('edit-nama').value = u.nama_lengkap;
  document.getElementById('edit-nip').value = u.email;
  document.getElementById('edit-jabatan').value = u.role;
  document.getElementById('edit-status-user').value = u.status_akun;
  document.getElementById('edit-password').value = '';
  document.getElementById('modal-edit-user').classList.add('open');
}

function closeModalEdit() { document.getElementById('modal-edit-user').classList.remove('open'); }

async function saveEditUser() {
  const id = document.getElementById('edit-user-id').value;
  const payload = {
    nama_lengkap: document.getElementById('edit-nama').value.trim(),
    role: document.getElementById('edit-jabatan').value,
    status_akun: document.getElementById('edit-status-user').value,
  };
  const newPass = document.getElementById('edit-password').value;
  if (newPass) payload.password = newPass;
  showLoading();
  try {
    await sb(`users?id_karyawan=eq.${id}`, 'PATCH', payload);
    toast('Data user diperbarui', 'success');
    closeModalEdit();
    await loadUserList();
    // Update local if editing self
    if (id === currentUser.id_karyawan) {
      currentUser = { ...currentUser, ...payload };
      localStorage.setItem('genius_user', JSON.stringify(currentUser));
    }
  } catch(e) { toast('Gagal: ' + e.message, 'error'); }
  finally { hideLoading(); }
}

function closeModalAddUser() { document.getElementById('modal-add-user').classList.remove('open'); }

async function saveAddUser() {
  const payload = {
    nama_lengkap: document.getElementById('add-nama').value.trim(),
    email: document.getElementById('add-email').value.trim(),
    password: document.getElementById('add-password').value,
    role: document.getElementById('add-role').value,
  };
  if (!payload.nama_lengkap || !payload.email || !payload.password) {
    toast('Lengkapi semua field', 'error'); return;
  }
  showLoading();
  try {
    await sb('users', 'POST', payload);
    toast('Karyawan berhasil ditambahkan', 'success');
    closeModalAddUser();
    document.getElementById('add-nama').value = '';
    document.getElementById('add-email').value = '';
    document.getElementById('add-password').value = '';
    await loadUserList();
  } catch(e) { toast('Gagal: ' + e.message, 'error'); }
  finally { hideLoading(); }
}

async function deleteUser(id) {
  if (id === currentUser.id_karyawan) { toast('Tidak bisa menghapus akun sendiri', 'error'); return; }
  if (!confirm('Hapus user ini? Data absensi terkait tidak ikut terhapus.')) return;
  showLoading();
  try {
    await sb(`users?id_karyawan=eq.${id}`, 'DELETE');
    toast('User dihapus', 'success');
    await loadUserList();
  } catch(e) { toast('Gagal: ' + e.message, 'error'); }
  finally { hideLoading(); }
}

// ==========================================
// APPROVE PENGAJUAN (Admin)
// ==========================================
async function renderApprovePengajuan() {
  document.getElementById('content').innerHTML = `
    <div class="page-header">
      <h2><i class="fa-solid fa-check-to-slot"></i> Pengajuan</h2>
    </div>
    <div class="filter-row">
      <select id="filter-status-pq" onchange="loadPengajuanAdmin()">
        <option value="">Semua Status</option>
        <option value="Pending">Pending</option>
        <option value="Disetujui">Disetujui</option>
        <option value="Ditolak">Ditolak</option>
      </select>
    </div>
    <div id="pq-admin-list"><div class="empty-state"><i class="fa-solid fa-spinner fa-spin"></i></div></div>`;
  await loadPengajuanAdmin();
}

async function loadPengajuanAdmin() {
  const statusFilter = document.getElementById('filter-status-pq')?.value;
  let q = '?order=tgl_submit.desc&select=*';
  if (statusFilter) q += `&status_approve=eq.${statusFilter}`;
  const cont = document.getElementById('pq-admin-list');
  cont.innerHTML = '<div class="empty-state"><i class="fa-solid fa-spinner fa-spin"></i></div>';
  try {
    const list = await sb('pengajuan', 'GET', null, q);
    if (!list.length) { cont.innerHTML = emptyHtml('Tidak ada pengajuan'); return; }
    cont.innerHTML = list.map(p => pengajuanCardHtml(p, true)).join('');
  } catch(e) { cont.innerHTML = errHtml(e.message); }
}

async function approvePengajuan(id, status) {
  if (!confirm(`${status === 'Disetujui' ? 'Setujui' : 'Tolak'} pengajuan ini?`)) return;
  showLoading();
  try {
    await sb(`pengajuan?id_pengajuan=eq.${id}`, 'PATCH', { status_approve: status });
    toast(`Pengajuan ${status}`, 'success');
    await loadPengajuanAdmin();
  } catch(e) { toast('Gagal: ' + e.message, 'error'); }
  finally { hideLoading(); }
}

// ==========================================
// PROFIL
// ==========================================
async function renderProfil() {
  const u = currentUser;
  document.getElementById('content').innerHTML = `
    <div class="profile-card">
      <div class="profile-avatar">${u.nama_lengkap[0].toUpperCase()}</div>
      <div class="profile-name">${u.nama_lengkap}</div>
      <div class="profile-role">${u.role} · ${u.email}</div>
    </div>
    <div class="card">
      <div class="card-title"><i class="fa-solid fa-key"></i> Ubah Password</div>
      <div class="field"><label>Password Lama</label><input type="password" id="p-old" placeholder="Password saat ini"></div>
      <div class="field"><label>Password Baru</label><input type="password" id="p-new" placeholder="Password baru"></div>
      <div class="field"><label>Konfirmasi</label><input type="password" id="p-conf" placeholder="Ulangi password baru"></div>
      <button class="btn-primary" onclick="gantiPassword()" style="width:100%;justify-content:center;">
        <i class="fa-solid fa-save"></i> Simpan Password
      </button>
    </div>
    <div class="card">
      <div class="card-title"><i class="fa-solid fa-info-circle"></i> Info Akun</div>
      <div style="font-size:.85rem;color:var(--gray);line-height:2;">
        <div><b>ID Karyawan:</b> ${u.id_karyawan}</div>
        <div><b>Status:</b> ${u.status_akun}</div>
        <div><b>Bergabung:</b> ${fmtDateTime(u.created_at)}</div>
      </div>
    </div>
    <button class="btn-secondary" onclick="logout()" style="width:100%;justify-content:center;margin-top:4px;">
      <i class="fa-solid fa-right-from-bracket"></i> Keluar
    </button>`;
}

async function gantiPassword() {
  const oldP = document.getElementById('p-old').value;
  const newP = document.getElementById('p-new').value;
  const confP = document.getElementById('p-conf').value;
  if (!oldP || !newP || !confP) { toast('Isi semua field', 'error'); return; }
  if (newP !== confP) { toast('Konfirmasi password tidak cocok', 'error'); return; }
  if (oldP !== currentUser.password) { toast('Password lama salah', 'error'); return; }
  showLoading();
  try {
    await sb(`users?id_karyawan=eq.${currentUser.id_karyawan}`, 'PATCH', { password: newP });
    currentUser.password = newP;
    localStorage.setItem('genius_user', JSON.stringify(currentUser));
    toast('Password berhasil diubah', 'success');
    document.getElementById('p-old').value = '';
    document.getElementById('p-new').value = '';
    document.getElementById('p-conf').value = '';
  } catch(e) { toast('Gagal: ' + e.message, 'error'); }
  finally { hideLoading(); }
}

// ==========================================
// ABSEN (Foto + Lokasi)
// ==========================================
async function openAbsen(mode) {
  absenMode = mode;
  capturedFotoB64 = null;
  document.getElementById('modal-absen-title').textContent = mode === 'masuk' ? 'Absen Masuk' : 'Absen Pulang';
  document.getElementById('foto-preview-box').style.display = 'none';
  document.getElementById('camera-container').style.display = 'block';
  document.getElementById('absen-actions').style.display = 'flex';
  document.getElementById('absen-confirm-actions').style.display = 'none';
  document.getElementById('lokasi-info').textContent = '📍 Mengambil lokasi...';
  document.getElementById('modal-absen').classList.add('open');

  // Start camera
  try {
    cameraStream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'user' }, audio: false });
    document.getElementById('camera-video').srcObject = cameraStream;
  } catch(e) {
    toast('Kamera tidak dapat diakses: ' + e.message, 'error');
  }

  // Get location
  if (navigator.geolocation) {
    navigator.geolocation.getCurrentPosition(
      pos => {
        userLat = pos.coords.latitude.toFixed(6);
        userLng = pos.coords.longitude.toFixed(6);
        document.getElementById('lokasi-info').innerHTML = `<i class="fa-solid fa-location-dot" style="color:var(--success)"></i> Lokasi: ${userLat}, ${userLng}`;
      },
      () => {
        userLat = null; userLng = null;
        document.getElementById('lokasi-info').textContent = '⚠️ Lokasi tidak tersedia';
      }
    );
  }
}

function closeModalAbsen() {
  document.getElementById('modal-absen').classList.remove('open');
  stopCamera();
}

function stopCamera() {
  if (cameraStream) {
    cameraStream.getTracks().forEach(t => t.stop());
    cameraStream = null;
  }
}

function ambilFoto() {
  const video = document.getElementById('camera-video');
  const canvas = document.getElementById('camera-canvas');
  canvas.width = video.videoWidth || 320;
  canvas.height = video.videoHeight || 240;
  canvas.getContext('2d').drawImage(video, 0, 0);
  capturedFotoB64 = canvas.toDataURL('image/jpeg', 0.7);

  document.getElementById('foto-preview').src = capturedFotoB64;
  document.getElementById('foto-preview-box').style.display = 'block';
  document.getElementById('camera-container').style.display = 'none';
  document.getElementById('absen-actions').style.display = 'none';
  document.getElementById('absen-confirm-actions').style.display = 'flex';
  stopCamera();
}

function retakeFoto() {
  capturedFotoB64 = null;
  document.getElementById('foto-preview-box').style.display = 'none';
  document.getElementById('camera-container').style.display = 'block';
  document.getElementById('absen-actions').style.display = 'flex';
  document.getElementById('absen-confirm-actions').style.display = 'none';
  openAbsenCamera();
}

async function openAbsenCamera() {
  try {
    cameraStream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'user' }, audio: false });
    document.getElementById('camera-video').srcObject = cameraStream;
  } catch(e) {}
}

async function submitAbsen() {
  const now = new Date();
  const timeStr = now.toTimeString().slice(0, 8);
  const today = todayStr();

  showLoading();
  try {
    // Get today's jadwal for status calculation
    let jadwal = todayJadwal;
    if (!jadwal) {
      const j = await sb('jadwal', 'GET', null,
        `?nama=eq.${encodeURIComponent(currentUser.nama_lengkap)}&tanggal=eq.${today}&select=*`);
      jadwal = j[0] || null;
    }

    if (absenMode === 'masuk') {
      // Calculate status
      let statusMasuk = 'Tepat Waktu';
      let ketTelat = '';
      if (jadwal?.jam_masuk) {
        const [jh, jm] = jadwal.jam_masuk.split(':').map(Number);
        const jadwalMenit = jh * 60 + jm;
        const nowMenit = now.getHours() * 60 + now.getMinutes();
        if (nowMenit > jadwalMenit + 10) {
          statusMasuk = 'Terlambat';
          const selisih = nowMenit - jadwalMenit;
          ketTelat = `Terlambat ${selisih} menit`;
        }
      }

      // Check if already absen today
      const existing = await sb('absensi', 'GET', null,
        `?nama=eq.${encodeURIComponent(currentUser.nama_lengkap)}&tanggal=eq.${today}&select=id`);

      if (existing.length) {
        toast('Sudah absen masuk hari ini', 'error');
        closeModalAbsen();
        return;
      }

      await sb('absensi', 'POST', {
        nama: currentUser.nama_lengkap,
        tanggal: today,
        waktu_masuk: timeStr,
        lat_masuk: userLat,
        lng_masuk: userLng,
        foto_masuk: capturedFotoB64,
        status_masuk: statusMasuk,
        ket_telat: ketTelat,
        shift_id: jadwal?.shift_id || null,
        nama_shift: jadwal?.nama_shift || null,
      });
      toast(`Absen masuk berhasil! ${statusMasuk}`, 'success');

    } else {
      // Pulang - update record
      const existing = await sb('absensi', 'GET', null,
        `?nama=eq.${encodeURIComponent(currentUser.nama_lengkap)}&tanggal=eq.${today}&select=id`);
      if (!existing.length) { toast('Data absen masuk tidak ditemukan', 'error'); closeModalAbsen(); return; }

      // Status pulang
      let statusPulang = 'Tepat Waktu';
      if (jadwal?.jam_pulang) {
        const [jh, jm] = jadwal.jam_pulang.split(':').map(Number);
        const jadwalMenit = jh * 60 + jm;
        const nowMenit = now.getHours() * 60 + now.getMinutes();
        if (nowMenit < jadwalMenit - 10) statusPulang = 'Pulang Awal';
      }

      await sb(`absensi?id=eq.${existing[0].id}`, 'PATCH', {
        waktu_pulang: timeStr,
        lat_pulang: userLat,
        lng_pulang: userLng,
        foto_pulang: capturedFotoB64,
        status_pulang: statusPulang,
      });
      toast('Absen pulang berhasil!', 'success');
    }

    closeModalAbsen();
    await navigateTo('dashboard');
  } catch(e) {
    toast('Gagal absen: ' + e.message, 'error');
  } finally {
    hideLoading();
  }
}

// ==========================================
// PENGAJUAN MODAL
// ==========================================
function openModalPengajuan() {
  document.getElementById('pengajuan-tipe').value = 'Sakit';
  document.getElementById('pengajuan-ket').value = '';
  document.getElementById('pengajuan-link').value = '';
  document.getElementById('modal-pengajuan').classList.add('open');
}

function closeModalPengajuan() { document.getElementById('modal-pengajuan').classList.remove('open'); }

async function submitPengajuan() {
  const payload = {
    nama_karyawan: currentUser.nama_lengkap,
    tipe_izin: document.getElementById('pengajuan-tipe').value,
    keterangan: document.getElementById('pengajuan-ket').value.trim(),
    link_surat_sakit: document.getElementById('pengajuan-link').value.trim() || null,
    status_approve: 'Pending',
  };
  if (!payload.keterangan) { toast('Isi keterangan', 'error'); return; }
  showLoading();
  try {
    await sb('pengajuan', 'POST', payload);
    toast('Pengajuan terkirim!', 'success');
    closeModalPengajuan();
    if (currentPage === 'pengajuan') await renderPengajuan();
  } catch(e) { toast('Gagal: ' + e.message, 'error'); }
  finally { hideLoading(); }
}

// ==========================================
// HELPERS
// ==========================================
function todayStr() {
  return new Date().toLocaleDateString('sv-SE'); // YYYY-MM-DD
}

function fmtDate(d) {
  if (!d) return '-';
  return new Date(d + 'T00:00:00').toLocaleDateString('id-ID', { day:'2-digit', month:'short', year:'numeric' });
}

function fmtDateLong(d) {
  if (!d) return '-';
  return new Date(d + 'T00:00:00').toLocaleDateString('id-ID', { weekday:'long', day:'2-digit', month:'long', year:'numeric' });
}

function fmtTime(t) {
  if (!t) return '--:--';
  return t.slice(0, 5);
}

function fmtDateTime(dt) {
  if (!dt) return '-';
  return new Date(dt).toLocaleString('id-ID', { day:'2-digit', month:'short', year:'numeric', hour:'2-digit', minute:'2-digit' });
}

function getWeekRange() {
  const now = new Date();
  const day = now.getDay() || 7;
  const mon = new Date(now); mon.setDate(now.getDate() - day + 1);
  const sun = new Date(now); sun.setDate(now.getDate() - day + 7);
  return [mon.toLocaleDateString('sv-SE'), sun.toLocaleDateString('sv-SE')];
}

function badgeHtml(status) {
  if (!status) return '';
  const map = {
    'Tepat Waktu': 'badge-green',
    'Terlambat': 'badge-red',
    'Pulang Awal': 'badge-yellow',
    'Aktif': 'badge-green',
    'Nonaktif': 'badge-red',
    'Pending': 'badge-yellow',
    'Disetujui': 'badge-green',
    'Ditolak': 'badge-red',
    'Lupa Absen': 'badge-gray',
  };
  const cls = map[status] || 'badge-gray';
  return `<span class="badge ${cls}">${status}</span>`;
}

function emptyHtml(msg) {
  return `<div class="empty-state"><i class="fa-solid fa-inbox"></i><p>${msg}</p></div>`;
}

function errHtml(msg) {
  return `<div class="empty-state"><i class="fa-solid fa-circle-exclamation" style="color:var(--danger)"></i><p style="color:var(--danger);">Error: ${msg}</p></div>`;
}

function showLoading() {
  document.getElementById('loading-overlay').classList.add('active');
}

function hideLoading() {
  document.getElementById('loading-overlay').classList.remove('active');
}

function toast(msg, type = 'info') {
  const container = document.getElementById('toast-container');
  const el = document.createElement('div');
  el.className = `toast ${type}`;
  const icon = type === 'success' ? 'fa-check-circle' : type === 'error' ? 'fa-circle-exclamation' : 'fa-circle-info';
  el.innerHTML = `<i class="fa-solid ${icon}"></i> ${msg}`;
  container.appendChild(el);
  setTimeout(() => el.remove(), 3500);
}

// ==========================================
// Close modals when clicking outside
// ==========================================
document.querySelectorAll('.modal-bg').forEach(modal => {
  modal.addEventListener('click', e => {
    if (e.target === modal) {
      modal.classList.remove('open');
      stopCamera();
    }
  });
});
