// ============================================
// GENIUS PRESENCE - script.js (FINAL SUPABASE)
// ============================================

const SUPABASE_URL = "https://kuldbrivmpqpoyeilbav.supabase.co";
const SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imt1bGRicml2bXBxcG95ZWlsYmF2Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzgzOTI4NDMsImV4cCI6MjA5Mzk2ODg0M30.je9yMizaJs5OJ4yuaxnw2vwPeGy1F_0j75SMU1IZZso";
const _supabase = supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

let currentUser  = null;
let cameraStream = null;
let currentPage  = "absensi";

// 1. INISIALISASI SAAT START
document.addEventListener("DOMContentLoaded", () => {
  const saved = localStorage.getItem("currentUser");
  if (saved) {
    try {
      currentUser = JSON.parse(saved);
      showApp();
    } catch (e) {
      localStorage.removeItem("currentUser");
      showLogin();
    }
  } else {
    showLogin();
  }
});

// 2. FUNGSI LOGIN (PASTI TEMBUS)
async function login() {
  const emailInput = document.getElementById("username").value.trim().toLowerCase();
  const passInput = document.getElementById("password").value.trim();

  if (!emailInput || !passInput) return showToast("Email & Password wajib diisi", "error");

  showLoading(true);
  try {
    // Cari user di tabel 'users'
    const { data, error } = await _supabase
      .from('users')
      .select('*')
      .eq('email', emailInput)
      .eq('password', passInput);

    if (error) throw error;

    if (data && data.length > 0) {
      const user = data[0];
      currentUser = {
        id: user.id_karyawan,
        nama: user.nama_lengkap,
        email: user.email,
        role: user.role
      };
      localStorage.setItem("currentUser", JSON.stringify(currentUser));
      showToast("Berhasil Masuk!", "success");
      showApp();
    } else {
      showToast("Email atau Password Salah!", "error");
    }
  } catch (err) {
    showToast("Error: " + err.message, "error");
  } finally {
    showLoading(false);
  }
}

// 3. TAMPILAN APLIKASI
function showApp() {
  document.getElementById("loginPage").style.display = "none";
  document.getElementById("appPage").style.display = "block";
  document.getElementById("userName").textContent = currentUser.nama;
  renderSidebar();
  renderBottomNav();
  navigateTo("absensi");
}

function showLogin() {
  document.getElementById("loginPage").style.display = "flex";
  document.getElementById("appPage").style.display = "none";
}

function logout() {
  if (confirm("Yakin ingin keluar?")) {
    localStorage.removeItem("currentUser");
    location.reload();
  }
}

// 4. NAVIGASI
function navigateTo(page) {
  currentPage = page;
  closeSidebar();
  stopCamera();
  
  const content = document.getElementById("content");
  content.innerHTML = "";

  if (page === "absensi") renderAbsensi();
  else if (page === "riwayat") renderRiwayat();
  else if (page === "profil") renderProfil();
  else if (page === "monitoring" && currentUser.role === "Admin") renderMonitoring();
  else content.innerHTML = "<div class='empty-state'>Halaman belum tersedia</div>";
}

// 5. HALAMAN ABSENSI (LOGIKA INTI)
async function renderAbsensi() {
  const content = document.getElementById("content");
  content.innerHTML = `
    <div class="page-header">
        <h2><i class="fa-solid fa-fingerprint"></i> Absensi</h2>
        <p>${new Date().toLocaleDateString('id-ID', {weekday:'long', day:'numeric', month:'long'})}</p>
    </div>
    <div id="absensi-area"></div>
  `;
  await checkAbsenStatus();
}

async function checkAbsenStatus() {
  const today = new Date().toISOString().split('T')[0];
  const area = document.getElementById("absensi-area");
  
  area.innerHTML = "<div class='loading-state'>Mengecek data...</div>";

  const { data } = await _supabase
    .from('absensi')
    .select('*')
    .eq('nama', currentUser.nama)
    .eq('tanggal', today)
    .single();

  if (!data) {
    area.innerHTML = buildAbsenCard("masuk");
  } else if (!data.waktu_pulang) {
    area.innerHTML = `
      <div class="card" style="border-left:4px solid #3b82f6; margin-bottom:15px;">
        Sudah Absen Masuk: <b>${data.waktu_masuk}</b>
      </div>
    ` + buildAbsenCard("pulang");
  } else {
    area.innerHTML = `
      <div class="card absensi-done-card">
        <i class="fa-solid fa-circle-check" style="color:#22c55e; font-size:40px;"></i>
        <h3>Absensi Selesai!</h3>
        <p>Masuk: ${data.waktu_masuk} | Pulang: ${data.waktu_pulang}</p>
      </div>`;
  }
}

function buildAbsenCard(tipe) {
  return `
    <div class="card">
      <h3>Absen ${tipe === 'masuk' ? 'Datang' : 'Pulang'}</h3>
      <div class="camera-wrap">
        <video id="video" autoplay playsinline style="width:100%; height:100%; object-fit:cover;"></video>
        <canvas id="canvas" style="display:none;"></canvas>
      </div>
      <button onclick="prosesAbsen('${tipe}')" class="btn-absensi" style="background:${tipe==='masuk'?'#3b82f6':'#f97316'}">
        Ambil Foto & Kirim
      </button>
    </div>`;
  setTimeout(() => startCamera(), 100);
}

async function startCamera() {
  cameraStream = await navigator.mediaDevices.getUserMedia({ video: true });
  document.getElementById("video").srcObject = cameraStream;
}

async function prosesAbsen(tipe) {
  showLoading(true);
  try {
    // GPS & Foto
    const pos = await new Promise((res, rej) => navigator.geolocation.getCurrentPosition(res, rej));
    const video = document.getElementById("video");
    const canvas = document.getElementById("canvas");
    canvas.width = 400; canvas.height = 300;
    canvas.getContext("2d").drawImage(video, 0, 0, 400, 300);
    const blob = await new Promise(res => canvas.toBlob(res, 'image/jpeg', 0.6));

    // Upload Foto
    const fileName = `${tipe}_${currentUser.nama}_${Date.now()}.jpg`;
    await _supabase.storage.from('foto-absensi').upload(fileName, blob);
    const { data: url } = _supabase.storage.from('foto-absensi').getPublicUrl(fileName);

    const jam = new Date().toLocaleTimeString('id-ID', { hour12: false });
    const tgl = new Date().toISOString().split('T')[0];

    if (tipe === "masuk") {
      await _supabase.from('absensi').insert([{
        nama: currentUser.nama, tanggal: tgl, waktu_masuk: jam,
        lat_masuk: pos.coords.latitude.toString(), lng_masuk: pos.coords.longitude.toString(),
        foto_masuk: url.publicUrl, status_masuk: 'Hadir'
      }]);
    } else {
      await _supabase.from('absensi').update({
        waktu_pulang: jam, lat_pulang: pos.coords.latitude.toString(),
        lng_pulang: pos.coords.longitude.toString(), foto_pulang: url.publicUrl, status_pulang: 'Pulang'
      }).eq('nama', currentUser.nama).eq('tanggal', tgl);
    }

    showToast("Absen Berhasil!", "success");
    renderAbsensi();
  } catch (e) {
    showToast(e.message, "error");
  } finally {
    showLoading(false);
    stopCamera();
  }
}

// 6. HELPERS & UI
function renderSidebar() {
  const isAdmin = currentUser.role === "Admin";
  document.getElementById("sidebar").innerHTML = `
    <div class="sidebar-header"><div class="sidebar-title">GENIUS APP</div></div>
    <nav class="sidebar-nav">
      <a class="sidebar-link" onclick="navigateTo('absensi')">Absensi</a>
      <a class="sidebar-link" onclick="navigateTo('riwayat')">Riwayat</a>
      ${isAdmin ? `<a class="sidebar-link" onclick="navigateTo('monitoring')">Monitoring</a>` : ''}
      <a class="sidebar-link" onclick="logout()">Keluar</a>
    </nav>`;
}

function renderBottomNav() {
  document.getElementById("bottomNav").innerHTML = `
    <button onclick="navigateTo('absensi')" class="nav-item">Absensi</button>
    <button onclick="navigateTo('riwayat')" class="nav-item">Riwayat</button>
    <button onclick="navigateTo('profil')" class="nav-item">Profil</button>`;
}

function toggleSidebar() { document.getElementById("sidebar").classList.toggle("open"); document.getElementById("overlay").classList.toggle("show"); }
function closeSidebar() { document.getElementById("sidebar").classList.remove("open"); document.getElementById("overlay").classList.remove("show"); }
function stopCamera() { if (cameraStream) { cameraStream.getTracks().forEach(t => t.stop()); cameraStream = null; } }
function showLoading(s) { document.getElementById("loading-overlay").style.display = s ? "flex" : "none"; }
function showToast(m, t) {
  const c = document.getElementById("toast-container");
  const div = document.createElement("div");
  div.className = `toast toast-${t} show`;
  div.innerHTML = m;
  c.appendChild(div);
  setTimeout(() => div.remove(), 3000);
}
