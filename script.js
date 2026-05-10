// ============================================
// GENIUS PRESENCE - FULL SUPABASE VERSION
// ============================================

const SUPABASE_URL = "https://kuldbrivmpqpoyeilbav.supabase.co";
const SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imt1bGRicml2bXBxcG95ZWlsYmF2Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzgzOTI4NDMsImV4cCI6MjA5Mzk2ODg0M30.je9yMizaJs5OJ4yuaxnw2vwPeGy1F_0j75SMU1IZZso";
const _supabase = supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

let currentUser  = null;
let cameraStream = null;
let currentPage  = "absensi";
let allShifts    = [];

// ============================================
// INIT
// ============================================
document.addEventListener("DOMContentLoaded", () => {
  const saved = localStorage.getItem("currentUser");
  if (saved) {
    try { currentUser = JSON.parse(saved); showApp(); }
    catch(e) { localStorage.removeItem("currentUser"); showLogin(); }
  } else { showLogin(); }
});

// ============================================
// BRIDGE: FETCH API (MESIN PENGHUBUNG)
// ============================================
async function fetchAPI(params, postData = null) {
  const action = params.action;
  const today = new Date().toISOString().split('T')[0];

  try {
    // 1. LOGIN
    if (action === "login") {
      const { data, error } = await _supabase.from('users').select('*').eq('email', params.email).eq('password', params.password).single();
      if (error || !data) return { success: false, message: "Email/Password Salah" };
      return { success: true, user: { id: data.id_karyawan, nama: data.nama_lengkap, email: data.email, role: data.role } };
    }

    // 2. STATUS ABSENSI
    if (action === "getStatusAbsensi") {
      const { data } = await _supabase.from('absensi').select('*').eq('nama', params.nama).eq('tanggal', today).single();
      if (!data) return { success: true };
      return { success: true, sudahMasuk: true, sudahPulang: !!data.waktu_pulang, waktuMasuk: data.waktu_masuk, waktuPulang: data.waktu_pulang, ketTelat: data.ket_telat };
    }

    // 3. UPLOAD FOTO
    if (action === "uploadFoto") {
      const fileName = `img_${Date.now()}.jpg`;
      const blob = await (await fetch("data:image/jpeg;base64," + postData.foto)).blob();
      await _supabase.storage.from('foto-absensi').upload(fileName, blob);
      const { data: url } = _supabase.storage.from('foto-absensi').getPublicUrl(fileName);
      return { success: true, linkFoto: url.publicUrl };
    }

    // 4. PROSES ABSENSI
    if (action === "absensi") {
      const jam = new Date().toLocaleTimeString('id-ID', { hour12: false });
      if (params.tipe === "masuk") {
        await _supabase.from('absensi').insert([{
          nama: params.nama, tanggal: today, waktu_masuk: jam,
          lat_masuk: params.latitude, lng_masuk: params.longitude, foto_masuk: params.linkFoto, status_masuk: 'Hadir'
        }]);
      } else {
        await _supabase.from('absensi').update({
          waktu_pulang: jam, lat_pulang: params.latitude, lng_pulang: params.longitude, foto_pulang: params.linkFoto, status_pulang: 'Selesai'
        }).eq('nama', params.nama).eq('tanggal', today);
      }
      return { success: true };
    }

    // 5. MONITORING & KELOLA USER
    if (action === "getAbsensiHarian") {
      const { data } = await _supabase.from('absensi').select('*').eq('tanggal', today);
      const { count } = await _supabase.from('users').select('*', { count: 'exact', head: true });
      return { success: true, data: data || [], totalStaff: count };
    }
    if (action === "getUsers") {
      const { data } = await _supabase.from('users').select('*');
      return { success: true, data: data.map(u => ({ id: u.id_karyawan, nama: u.nama_lengkap, email: u.email, role: u.role, status: u.status_akun })) };
    }

    // 6. RIWAYAT
    if (action === "getAbsensi") {
      const { data } = await _supabase.from('absensi').select('*').eq('nama', params.nama).order('tanggal', { ascending: false });
      return { success: true, data: data || [] };
    }

    // 7. SHIFT
    if (action === "getShift") {
      const { data } = await _supabase.from('shift').select('*');
      return { success: true, data: data.map(s => ({ id: s.id, nama: s.nama_shift, jamMasuk: s.jam_masuk, jamPulang: s.jam_pulang, keterangan: s.keterangan })) };
    }

    return { success: false, message: "Action belum dimigrasi" };
  } catch (e) { return { success: false, message: e.message }; }
}

// ============================================
// FUNGSI TAMPILAN (SAMA PERSIS DENGAN KODE LAMA KAMU)
// ============================================

async function login() {
  const email = (document.getElementById("username").value || "").trim();
  const password = (document.getElementById("password").value || "").trim();
  
  if (!email || !password) return showToast("Email dan password wajib diisi", "error");
  
  showLoading(true);
  try {
    // Kita panggil Supabase
    const { data, error } = await _supabase
      .from('users')
      .select('*')
      .eq('email', email)
      .eq('password', password)
      .single();

    if (error) {
      // INI PENTING: Jika error, kita munculkan pesan aslinya di Console
      console.error("Supabase Error:", error);
      showToast("Error: " + error.message, "error"); 
    } else if (data) {
      currentUser = { id: data.id_karyawan, nama: data.nama_lengkap, email: data.email, role: data.role };
      localStorage.setItem("currentUser", JSON.stringify(currentUser));
      showToast("Selamat datang!", "success");
      showApp();
    }
  } catch(err) {
    console.error("JS Error:", err);
    showToast("Gagal terhubung ke database", "error");
  } finally {
    showLoading(false);
  }
}

function logout() {
  if (!confirm("Yakin ingin keluar?")) return;
  stopCamera(); currentUser = null;
  localStorage.removeItem("currentUser");
  showLogin(); showToast("Berhasil keluar", "info");
}

function showLogin() {
  document.getElementById("loginPage").style.display = "flex";
  document.getElementById("appPage").style.display   = "none";
}

function showApp() {
  document.getElementById("loginPage").style.display = "none";
  document.getElementById("appPage").style.display   = "block";
  document.getElementById("userName").textContent    = currentUser.nama;
  renderSidebar(); renderBottomNav(); navigateTo("absensi");
}

// --- SIDEBAR & NAV ---
function renderSidebar() {
  const isAdmin = currentUser.role === "Admin";
  document.getElementById("sidebar").innerHTML = `
    <div class="sidebar-header">
      <div class="sidebar-logo">🏢</div>
      <div><div class="sidebar-title">Living Plaza</div><div class="sidebar-sub">Balikpapan</div></div>
    </div>
    <div class="sidebar-user">
      <div class="sidebar-avatar"><i class="fa-solid fa-user"></i></div>
      <div><div class="sidebar-name">${currentUser.nama}</div><div class="sidebar-role">${currentUser.role}</div></div>
    </div>
    <nav class="sidebar-nav">
      <a class="sidebar-link" onclick="navigateTo('absensi')"><i class="fa-solid fa-fingerprint"></i> Absensi</a>
      <a class="sidebar-link" onclick="navigateTo('riwayat')"><i class="fa-solid fa-clock-rotate-left"></i> Riwayat</a>
      <a class="sidebar-link" onclick="navigateTo('profil')"><i class="fa-solid fa-user-circle"></i> Profil</a>
      ${isAdmin ? `
      <div class="sidebar-divider">Admin Panel</div>
      <a class="sidebar-link" onclick="navigateTo('monitoring')"><i class="fa-solid fa-chart-line"></i> Monitoring</a>
      <a class="sidebar-link" onclick="navigateTo('master-shift')"><i class="fa-solid fa-list-check"></i> Master Shift</a>
      <a class="sidebar-link" onclick="navigateTo('kelola-user')"><i class="fa-solid fa-users-cog"></i> Kelola User</a>
      ` : ""}
    </nav>
    <button onclick="logout()" class="sidebar-logout"><i class="fa-solid fa-right-from-bracket"></i> Keluar</button>
  `;
}

function renderBottomNav() {
  const isAdmin = currentUser.role === "Admin";
  document.getElementById("bottomNav").innerHTML = `
    <button onclick="navigateTo('absensi')" id="nav-absensi" class="nav-item"><i class="fa-solid fa-fingerprint"></i><span>Absensi</span></button>
    <button onclick="navigateTo('riwayat')" id="nav-riwayat" class="nav-item"><i class="fa-solid fa-clock-rotate-left"></i><span>Riwayat</span></button>
    ${isAdmin 
      ? `<button onclick="navigateTo('monitoring')" id="nav-monitoring" class="nav-item"><i class="fa-solid fa-chart-line"></i><span>Monitor</span></button>` 
      : `<button onclick="navigateTo('profil')" id="nav-profil" class="nav-item"><i class="fa-solid fa-user-circle"></i><span>Profil</span></button>`}
  `;
}

function navigateTo(page) {
  currentPage = page; closeSidebar(); stopCamera();
  document.querySelectorAll(".nav-item").forEach(b => b.classList.remove("active"));
  const btn = document.getElementById("nav-" + page);
  if (btn) btn.classList.add("active");
  document.getElementById("content").innerHTML = "";
  
  if (page === "absensi") renderAbsensi();
  else if (page === "monitoring") renderMonitoring();
  else if (page === "riwayat") renderRiwayat();
  else if (page === "profil") renderProfil();
  else if (page === "master-shift") renderMasterShift();
  else if (page === "kelola-user") renderKelolaUser();
}

// --- FUNGSI HALAMAN (ABSENSI, CAMERA, DLL) ---
async function renderAbsensi() {
  document.getElementById("content").innerHTML = `
    <div class="page-header"><h2><i class="fa-solid fa-fingerprint"></i> Absensi</h2><p>${getTanggalHari()}</p></div>
    <div id="status-absensi-box" class="card" style="text-align:center;padding:18px 12px;"><div class="loading-state">Mengecek status...</div></div>
    <div id="absensi-action-box"></div>`;
  await loadStatusAbsensi();
}

async function loadStatusAbsensi() {
  try {
    const res = await fetchAPI({ action: "getStatusAbsensi", nama: currentUser.nama });
    renderStatusAndAction(res);
  } catch(err) { document.getElementById("status-absensi-box").innerHTML = "Error memuat status"; }
}

function renderStatusAndAction(res) {
  const statusBox = document.getElementById("status-absensi-box");
  const actionBox = document.getElementById("absensi-action-box");
  const sudahMasuk = !!res.sudahMasuk, sudahPulang = !!res.sudahPulang;

  statusBox.innerHTML = `
    <div style="display:flex;gap:12px;justify-content:center;">
      <div class="status-tile ${sudahMasuk?'done':'pending'}">Masuk: ${res.waktuMasuk || '--:--'}</div>
      <div class="status-tile ${sudahPulang?'done':'pending'}">Pulang: ${res.waktuPulang || '--:--'}</div>
    </div>`;

  if (!sudahMasuk || !sudahPulang) {
    actionBox.innerHTML = buildAbsensiCard(sudahMasuk ? "pulang" : "masuk");
  } else {
    actionBox.innerHTML = `<div class="card" style="text-align:center">✅ Absensi hari ini selesai!</div>`;
  }
}

function buildAbsensiCard(tipe) {
  const isMasuk = tipe === "masuk";
  return `
    <div class="card">
      <h3>Absen ${tipe.toUpperCase()}</h3>
      <div class="camera-wrap" id="cam-${tipe}-wrap">
        <video id="cam-video" autoplay playsinline style="width:100%; border-radius:12px;"></video>
        <canvas id="cam-canvas" style="display:none;"></canvas>
      </div>
      <div id="gps-status" class="gps-status idle">GPS akan diambil otomatis</div>
      <button onclick="bukaKameraAbsensi('${tipe}')" id="btn-open" class="btn-absensi">Buka Kamera</button>
      <button onclick="ambilFotoDanKirim('${tipe}')" id="btn-capture" class="btn-absensi" style="display:none; background:#22c55e;">Kirim Absen</button>
    </div>`;
}

async function bukaKameraAbsensi(tipe) {
  try {
    cameraStream = await navigator.mediaDevices.getUserMedia({ video: true });
    document.getElementById("cam-video").srcObject = cameraStream;
    document.getElementById("btn-open").style.display = "none";
    document.getElementById("btn-capture").style.display = "block";
    
    navigator.geolocation.getCurrentPosition((pos) => {
      window.currentLat = pos.coords.latitude;
      window.currentLng = pos.coords.longitude;
      document.getElementById("gps-status").innerHTML = "📍 Lokasi Berhasil Diambil";
    });
  } catch(e) { showToast("Gagal buka kamera", "error"); }
}

async function ambilFotoDanKirim(tipe) {
  showLoading(true);
  const video = document.getElementById("cam-video");
  const canvas = document.getElementById("cam-canvas");
  canvas.width = 400; canvas.height = 300;
  canvas.getContext("2d").drawImage(video, 0, 0, 400, 300);
  const fotoBase64 = canvas.toDataURL("image/jpeg", 0.7).split(",")[1];

  try {
    const upload = await fetchAPI({ action: "uploadFoto", nama: currentUser.nama }, { foto: fotoBase64 });
    const res = await fetchAPI({ 
      action: "absensi", tipe, nama: currentUser.nama, 
      latitude: window.currentLat, longitude: window.currentLng, linkFoto: upload.linkFoto 
    });
    if (res.success) {
      showToast("Absen Berhasil!", "success");
      renderAbsensi();
    }
  } catch(e) { showToast("Gagal kirim absen", "error"); }
  finally { showLoading(false); stopCamera(); }
}

// --- MONITORING (ADMIN) ---
async function renderMonitoring() {
  document.getElementById("content").innerHTML = `<h3>Monitoring Kehadiran</h3><div id="monitor-list" class="card-list">Loading...</div>`;
  const res = await fetchAPI({ action: "getAbsensiHarian" });
  const list = document.getElementById("monitor-list");
  if (res.data.length === 0) {
    list.innerHTML = "Belum ada staff yang absen hari ini.";
  } else {
    list.innerHTML = res.data.map(item => `
      <div class="absensi-card">
        <img src="${item.foto_masuk}" class="absensi-foto">
        <div class="absensi-card-body">
          <b>${item.nama}</b><br>
          <small>Masuk: ${item.waktu_masuk} | Pulang: ${item.waktu_pulang || '-'}</small>
        </div>
      </div>
    `).join("");
  }
}

// --- HELPERS ---
function stopCamera() { if (cameraStream) { cameraStream.getTracks().forEach(t => t.stop()); cameraStream = null; } }
function showLoading(show) { document.getElementById("loading-overlay").style.display = show ? "flex" : "none"; }
function showToast(m, type) { 
  const container = document.getElementById("toast-container");
  const t = document.createElement("div");
  t.className = `toast toast-${type} show`;
  t.innerHTML = m;
  container.appendChild(t);
  setTimeout(() => t.remove(), 3000);
}
function getTanggalHari() { return new Date().toLocaleDateString("id-ID", { weekday:"long", day:"2-digit", month:"long", year:"numeric" }); }
function toggleSidebar(){document.getElementById("sidebar").classList.toggle("open");document.getElementById("overlay").classList.toggle("show");}
function closeSidebar(){document.getElementById("sidebar").classList.remove("open");document.getElementById("overlay").classList.remove("show");}
