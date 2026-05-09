// =============================================
// ABSENSI STAFF - Living Plaza Balikpapan
// script.js - Frontend Logic
// =============================================

const API_URL = "https://script.google.com/macros/s/AKfycby9bz31OAyjCsORDtbkxdY7yUUnB4lmxmxrJdLE0g3meXm6TVSN9tkLhXCQWjgM8xS5/exec";

let currentUser = null;
let cameraStream = null;
let capturedPhotoBase64 = null;
let qrScanner = null;
let currentPage = "absensi";

// =============================================
// INIT
// =============================================
document.addEventListener("DOMContentLoaded", () => {
  const saved = localStorage.getItem("currentUser");
  if (saved) {
    currentUser = JSON.parse(saved);
    showApp();
  } else {
    showLogin();
  }
});

// =============================================
// LOGIN
// =============================================
async function login(e) {
  if (e) e.preventDefault();
  const email = document.getElementById("username").value.trim();
  const password = document.getElementById("password").value.trim();

  if (!email || !password) return showToast("Email dan password wajib diisi", "error");

  const btn = document.getElementById("loginBtn");
  btn.classList.add("loading");
  btn.querySelector(".btn-text").textContent = "Memproses...";
  showLoading(true);

  try {
    const res = await fetchAPI({ action: "login", email, password });
    if (res.success) {
      currentUser = res.user;
      localStorage.setItem("currentUser", JSON.stringify(currentUser));
      showToast("Selamat datang, " + currentUser.nama + "!", "success");
      showApp();
    } else {
      showToast(res.message, "error");
    }
  } catch (err) {
    showToast("Gagal terhubung ke server", "error");
  } finally {
    btn.classList.remove("loading");
    btn.querySelector(".btn-text").textContent = "Masuk";
    showLoading(false);
  }
}

// =============================================
// LOGOUT
// =============================================
function logout() {
  if (!confirm("Yakin ingin keluar?")) return;
  stopCamera();
  currentUser = null;
  localStorage.removeItem("currentUser");
  showLogin();
  showToast("Berhasil keluar", "info");
}

// =============================================
// SHOW LOGIN / APP
// =============================================
function showLogin() {
  document.getElementById("loginPage").style.display = "flex";
  document.getElementById("appPage").style.display = "none";
}

function showApp() {
  document.getElementById("loginPage").style.display = "none";
  document.getElementById("appPage").style.display = "block";
  document.getElementById("userName").textContent = currentUser.nama;
  renderSidebar();
  renderBottomNav();
  navigateTo("absensi");
}

// =============================================
// SIDEBAR
// =============================================
function renderSidebar() {
  const isAdmin = currentUser.role === "Admin";
  const sidebar = document.getElementById("sidebar");
  sidebar.innerHTML = `
    <div class="sidebar-header">
      <div class="sidebar-logo">🏢</div>
      <div>
        <div class="sidebar-title">Living Plaza</div>
        <div class="sidebar-sub">Balikpapan</div>
      </div>
    </div>
    <div class="sidebar-user">
      <div class="sidebar-avatar"><i class="fa-solid fa-user"></i></div>
      <div>
        <div class="sidebar-name">${currentUser.nama}</div>
        <div class="sidebar-role">${currentUser.role}</div>
      </div>
    </div>
    <nav class="sidebar-nav">
      <a class="sidebar-link" onclick="navigateTo('absensi')"><i class="fa-solid fa-fingerprint"></i> Absensi</a>
      <a class="sidebar-link" onclick="navigateTo('riwayat')"><i class="fa-solid fa-clock-rotate-left"></i> Riwayat Absensi</a>
      <a class="sidebar-link" onclick="navigateTo('pengajuan')"><i class="fa-solid fa-file-alt"></i> Pengajuan Izin</a>
      <a class="sidebar-link" onclick="navigateTo('profil')"><i class="fa-solid fa-user-circle"></i> Profil</a>
      ${isAdmin ? `
      <div class="sidebar-divider">Admin</div>
      <a class="sidebar-link" onclick="navigateTo('monitoring')"><i class="fa-solid fa-chart-line"></i> Monitoring</a>
      <a class="sidebar-link" onclick="navigateTo('kelola-user')"><i class="fa-solid fa-users-cog"></i> Kelola User</a>
      <a class="sidebar-link" onclick="navigateTo('approve-pengajuan')"><i class="fa-solid fa-check-circle"></i> Approve Izin</a>
      ` : ""}
    </nav>
    <button onclick="logout()" class="sidebar-logout"><i class="fa-solid fa-right-from-bracket"></i> Keluar</button>
  `;
}

// =============================================
// BOTTOM NAV
// =============================================
function renderBottomNav() {
  const isAdmin = currentUser.role === "Admin";
  const nav = document.getElementById("bottomNav");
  nav.innerHTML = `
    <button onclick="navigateTo('absensi')" id="nav-absensi" class="nav-item">
      <i class="fa-solid fa-fingerprint"></i><span>Absensi</span>
    </button>
    <button onclick="navigateTo('riwayat')" id="nav-riwayat" class="nav-item">
      <i class="fa-solid fa-clock-rotate-left"></i><span>Riwayat</span>
    </button>
    <button onclick="navigateTo('pengajuan')" id="nav-pengajuan" class="nav-item">
      <i class="fa-solid fa-file-alt"></i><span>Pengajuan</span>
    </button>
    ${isAdmin ? `<button onclick="navigateTo('monitoring')" id="nav-monitoring" class="nav-item">
      <i class="fa-solid fa-chart-line"></i><span>Monitor</span>
    </button>` : ""}
    <button onclick="navigateTo('profil')" id="nav-profil" class="nav-item">
      <i class="fa-solid fa-user-circle"></i><span>Profil</span>
    </button>
  `;
}

// =============================================
// NAVIGATION
// =============================================
function navigateTo(page) {
  currentPage = page;
  closeSidebar();
  stopCamera();

  // Update active nav
  document.querySelectorAll(".nav-item").forEach(b => b.classList.remove("active"));
  const activeBtn = document.getElementById("nav-" + page);
  if (activeBtn) activeBtn.classList.add("active");

  // Update active sidebar link
  document.querySelectorAll(".sidebar-link").forEach(l => l.classList.remove("active"));

  const content = document.getElementById("content");
  content.innerHTML = "";

  switch (page) {
    case "absensi": renderAbsensi(); break;
    case "riwayat": renderRiwayat(); break;
    case "pengajuan": renderPengajuan(); break;
    case "profil": renderProfil(); break;
    case "monitoring": renderMonitoring(); break;
    case "kelola-user": renderKelolaUser(); break;
    case "approve-pengajuan": renderApprovePengajuan(); break;
    default: content.innerHTML = `<div class="empty-state"><i class="fa-solid fa-circle-exclamation"></i><p>Halaman tidak ditemukan</p></div>`;
  }
}

// =============================================
// PAGE: ABSENSI
// =============================================
function renderAbsensi() {
  const content = document.getElementById("content");
  content.innerHTML = `
    <div class="page-header">
      <h2><i class="fa-solid fa-fingerprint"></i> Absensi</h2>
      <p>Lakukan absensi dengan selfie + GPS</p>
    </div>

    <div class="absensi-tabs">
      <button class="tab-btn active" onclick="switchAbsensiTab('selfie', this)"><i class="fa-solid fa-camera"></i> Selfie + GPS</button>
      <button class="tab-btn" onclick="switchAbsensiTab('qr', this)"><i class="fa-solid fa-qrcode"></i> QR Code</button>
    </div>

    <div id="tab-selfie" class="tab-content">
      <div class="camera-section">
        <div class="camera-wrap">
          <video id="cameraVideo" autoplay playsinline></video>
          <canvas id="cameraCanvas" style="display:none;"></canvas>
          <div id="photoPreview" class="photo-preview" style="display:none;">
            <img id="photoImg" src="" alt="Foto Selfie">
          </div>
          <div class="camera-overlay">
            <div class="face-guide"></div>
          </div>
        </div>
        <div class="camera-controls">
          <button id="btnCamera" onclick="startCamera()" class="btn-primary"><i class="fa-solid fa-camera"></i> Buka Kamera</button>
          <button id="btnCapture" onclick="capturePhoto()" class="btn-success" style="display:none;"><i class="fa-solid fa-circle"></i> Ambil Foto</button>
          <button id="btnRetake" onclick="retakePhoto()" class="btn-secondary" style="display:none;"><i class="fa-solid fa-redo"></i> Ulangi</button>
        </div>
      </div>

      <div class="gps-section">
        <div id="gpsStatus" class="gps-status idle">
          <i class="fa-solid fa-location-dot"></i>
          <span>GPS belum diambil</span>
        </div>
        <button onclick="getLocation()" class="btn-outline"><i class="fa-solid fa-location-crosshairs"></i> Ambil Lokasi GPS</button>
        <input type="hidden" id="gpsLat">
        <input type="hidden" id="gpsLng">
      </div>

      <button onclick="submitAbsensiSelfie()" class="btn-absensi">
        <i class="fa-solid fa-check-circle"></i> Kirim Absensi
      </button>
    </div>

    <div id="tab-qr" class="tab-content" style="display:none;">
      <div class="qr-section">
        <div class="qr-wrap">
          <video id="qrVideo" autoplay playsinline></video>
          <div class="qr-overlay"><div class="qr-scanner-line"></div></div>
        </div>
        <p class="qr-hint">Arahkan kamera ke QR Code absensi</p>
        <button onclick="startQRScanner()" class="btn-primary"><i class="fa-solid fa-qrcode"></i> Mulai Scan</button>
        <button onclick="stopQRScanner()" class="btn-secondary" id="btnStopQR" style="display:none;"><i class="fa-solid fa-stop"></i> Stop Scan</button>
      </div>
    </div>
  `;
}

function switchAbsensiTab(tab, btn) {
  document.querySelectorAll(".tab-btn").forEach(b => b.classList.remove("active"));
  btn.classList.add("active");
  document.getElementById("tab-selfie").style.display = tab === "selfie" ? "block" : "none";
  document.getElementById("tab-qr").style.display = tab === "qr" ? "block" : "none";
  stopCamera();
}

// =============================================
// CAMERA
// =============================================
async function startCamera() {
  try {
    cameraStream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "user" }, audio: false });
    const video = document.getElementById("cameraVideo");
    video.srcObject = cameraStream;
    document.getElementById("btnCamera").style.display = "none";
    document.getElementById("btnCapture").style.display = "inline-flex";
    document.getElementById("photoPreview").style.display = "none";
    video.style.display = "block";
  } catch (err) {
    showToast("Gagal akses kamera: " + err.message, "error");
  }
}

function capturePhoto() {
  const video = document.getElementById("cameraVideo");
  const canvas = document.getElementById("cameraCanvas");
  canvas.width = video.videoWidth;
  canvas.height = video.videoHeight;
  canvas.getContext("2d").drawImage(video, 0, 0);

  capturedPhotoBase64 = canvas.toDataURL("image/jpeg", 0.7).split(",")[1];

  const img = document.getElementById("photoImg");
  img.src = "data:image/jpeg;base64," + capturedPhotoBase64;
  document.getElementById("photoPreview").style.display = "block";
  document.getElementById("cameraVideo").style.display = "none";
  document.getElementById("btnCapture").style.display = "none";
  document.getElementById("btnRetake").style.display = "inline-flex";

  stopCamera();
  showToast("Foto berhasil diambil!", "success");
}

function retakePhoto() {
  capturedPhotoBase64 = null;
  document.getElementById("photoPreview").style.display = "none";
  document.getElementById("btnRetake").style.display = "none";
  document.getElementById("btnCamera").style.display = "inline-flex";
}

function stopCamera() {
  if (cameraStream) {
    cameraStream.getTracks().forEach(t => t.stop());
    cameraStream = null;
  }
}

// =============================================
// GPS
// =============================================
function getLocation() {
  const status = document.getElementById("gpsStatus");
  status.className = "gps-status loading";
  status.innerHTML = `<i class="fa-solid fa-spinner fa-spin"></i> <span>Mengambil lokasi...</span>`;

  if (!navigator.geolocation) {
    status.className = "gps-status error";
    status.innerHTML = `<i class="fa-solid fa-xmark"></i> <span>GPS tidak didukung</span>`;
    return;
  }

  navigator.geolocation.getCurrentPosition(
    (pos) => {
      document.getElementById("gpsLat").value = pos.coords.latitude;
      document.getElementById("gpsLng").value = pos.coords.longitude;
      status.className = "gps-status success";
      status.innerHTML = `<i class="fa-solid fa-check"></i> <span>GPS: ${pos.coords.latitude.toFixed(5)}, ${pos.coords.longitude.toFixed(5)}</span>`;
      showToast("Lokasi berhasil didapat!", "success");
    },
    (err) => {
      status.className = "gps-status error";
      status.innerHTML = `<i class="fa-solid fa-xmark"></i> <span>Gagal: ${err.message}</span>`;
      showToast("Gagal ambil GPS: " + err.message, "error");
    },
    { enableHighAccuracy: true, timeout: 10000 }
  );
}

// =============================================
// SUBMIT ABSENSI SELFIE
// =============================================
async function submitAbsensiSelfie() {
  if (!capturedPhotoBase64) return showToast("Ambil foto selfie terlebih dahulu", "error");
  const lat = document.getElementById("gpsLat").value;
  const lng = document.getElementById("gpsLng").value;
  if (!lat || !lng) return showToast("Ambil lokasi GPS terlebih dahulu", "error");

  showLoading(true);
  try {
    // Upload foto dulu
    const uploadRes = await fetchAPI({ action: "uploadFoto", foto: capturedPhotoBase64, nama: currentUser.nama });
    if (!uploadRes.success) throw new Error(uploadRes.message);

    // Kirim absensi
    const absenRes = await fetchAPI({
      action: "absensi",
      nama: currentUser.nama,
      latitude: lat,
      longitude: lng,
      linkFoto: uploadRes.linkFoto
    });

    if (absenRes.success) {
      showToast("✅ Absensi berhasil! Waktu: " + absenRes.waktu, "success");
      capturedPhotoBase64 = null;
      retakePhoto();
      document.getElementById("gpsStatus").className = "gps-status idle";
      document.getElementById("gpsStatus").innerHTML = `<i class="fa-solid fa-location-dot"></i> <span>GPS belum diambil</span>`;
      document.getElementById("gpsLat").value = "";
      document.getElementById("gpsLng").value = "";
    } else {
      showToast(absenRes.message, "error");
    }
  } catch (err) {
    showToast("Error: " + err.message, "error");
  } finally {
    showLoading(false);
  }
}

// =============================================
// QR SCANNER (menggunakan jsQR)
// =============================================
async function startQRScanner() {
  try {
    cameraStream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "environment" }, audio: false });
    const video = document.getElementById("qrVideo");
    video.srcObject = cameraStream;
    document.getElementById("btnStopQR").style.display = "inline-flex";
    scanQRFrame(video);
  } catch (err) {
    showToast("Gagal akses kamera: " + err.message, "error");
  }
}

function scanQRFrame(video) {
  if (!cameraStream) return;
  const canvas = document.createElement("canvas");
  const ctx = canvas.getContext("2d");

  const tick = () => {
    if (!cameraStream || video.readyState !== video.HAVE_ENOUGH_DATA) {
      requestAnimationFrame(tick);
      return;
    }
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);

    if (typeof jsQR !== "undefined") {
      const code = jsQR(imageData.data, imageData.width, imageData.height);
      if (code) {
        stopQRScanner();
        handleQRResult(code.data);
        return;
      }
    }
    requestAnimationFrame(tick);
  };
  requestAnimationFrame(tick);
}

function stopQRScanner() {
  stopCamera();
  document.getElementById("btnStopQR").style.display = "none";
}

async function handleQRResult(data) {
  // QR harus berisi token valid, misal: "ABSENSI-LIVINGPLAZA-{tanggal}"
  const today = new Date().toISOString().slice(0, 10);
  const validToken = "ABSENSI-LIVINGPLAZA-" + today;

  if (data !== validToken) {
    showToast("QR Code tidak valid atau sudah kadaluarsa", "error");
    return;
  }

  showLoading(true);
  try {
    const res = await fetchAPI({
      action: "absensi",
      nama: currentUser.nama,
      latitude: "-",
      longitude: "-",
      linkFoto: "-"
    });
    if (res.success) {
      showToast("✅ Absensi QR berhasil! " + res.waktu, "success");
    } else {
      showToast(res.message, "error");
    }
  } catch (err) {
    showToast("Error: " + err.message, "error");
  } finally {
    showLoading(false);
  }
}

// =============================================
// PAGE: RIWAYAT ABSENSI
// =============================================
async function renderRiwayat() {
  const content = document.getElementById("content");
  content.innerHTML = `
    <div class="page-header">
      <h2><i class="fa-solid fa-clock-rotate-left"></i> Riwayat Absensi</h2>
    </div>
    <div id="riwayat-list" class="card-list">
      <div class="loading-state"><i class="fa-solid fa-spinner fa-spin"></i> Memuat data...</div>
    </div>
  `;

  try {
    const res = await fetchAPI({ action: "getAbsensi", nama: currentUser.nama });
    const list = document.getElementById("riwayat-list");
    if (!res.success || res.data.length === 0) {
      list.innerHTML = `<div class="empty-state"><i class="fa-solid fa-inbox"></i><p>Belum ada riwayat absensi</p></div>`;
      return;
    }
    list.innerHTML = res.data.map(item => `
      <div class="absensi-card">
        <div class="absensi-card-left">
          ${item.foto && item.foto !== "-" ? `<img src="${item.foto}" class="absensi-foto" alt="selfie">` : `<div class="absensi-foto-placeholder"><i class="fa-solid fa-user"></i></div>`}
        </div>
        <div class="absensi-card-body">
          <div class="absensi-waktu">${formatDateTime(item.waktu)}</div>
          <div class="absensi-info">
            <i class="fa-solid fa-location-dot"></i>
            ${item.latitude && item.latitude !== "-" 
              ? `<a href="https://maps.google.com?q=${item.latitude},${item.longitude}" target="_blank">${parseFloat(item.latitude).toFixed(4)}, ${parseFloat(item.longitude).toFixed(4)}</a>`
              : "Lokasi tidak tersedia"}
          </div>
        </div>
        <div class="absensi-badge success">Hadir</div>
      </div>
    `).join("");
  } catch (err) {
    document.getElementById("riwayat-list").innerHTML = `<div class="empty-state error"><i class="fa-solid fa-triangle-exclamation"></i><p>Gagal memuat data</p></div>`;
  }
}

// =============================================
// PAGE: PENGAJUAN IZIN
// =============================================
async function renderPengajuan() {
  const content = document.getElementById("content");
  content.innerHTML = `
    <div class="page-header">
      <h2><i class="fa-solid fa-file-alt"></i> Pengajuan Izin</h2>
    </div>

    <div class="card form-card">
      <h3>Buat Pengajuan</h3>
      <div class="field">
        <label>Tipe Izin</label>
        <select id="tipeIzin">
          <option value="Sakit">Sakit</option>
          <option value="Cuti">Cuti</option>
          <option value="Izin Mendadak">Izin Mendadak</option>
          <option value="Keperluan Keluarga">Keperluan Keluarga</option>
          <option value="Lainnya">Lainnya</option>
        </select>
      </div>
      <div class="field">
        <label>Keterangan</label>
        <textarea id="keteranganIzin" placeholder="Jelaskan alasan pengajuan izin..." rows="3"></textarea>
      </div>
      <div class="field">
        <label>Link Surat Sakit (Opsional)</label>
        <input type="url" id="linkSurat" placeholder="https://drive.google.com/...">
      </div>
      <button onclick="submitPengajuan()" class="btn-primary"><i class="fa-solid fa-paper-plane"></i> Kirim Pengajuan</button>
    </div>

    <div class="page-header" style="margin-top:24px;">
      <h3>Riwayat Pengajuan</h3>
    </div>
    <div id="pengajuan-list" class="card-list">
      <div class="loading-state"><i class="fa-solid fa-spinner fa-spin"></i> Memuat data...</div>
    </div>
  `;

  loadPengajuanList();
}

async function loadPengajuanList() {
  try {
    const res = await fetchAPI({ action: "getPengajuan", nama: currentUser.nama, role: currentUser.role });
    const list = document.getElementById("pengajuan-list");
    if (!res.success || res.data.length === 0) {
      list.innerHTML = `<div class="empty-state"><i class="fa-solid fa-inbox"></i><p>Belum ada pengajuan</p></div>`;
      return;
    }
    list.innerHTML = res.data.map(item => `
      <div class="pengajuan-card">
        <div class="pengajuan-header">
          <span class="pengajuan-tipe">${item.tipe}</span>
          <span class="status-badge ${getStatusClass(item.status)}">${item.status}</span>
        </div>
        <div class="pengajuan-ket">${item.keterangan || "-"}</div>
        <div class="pengajuan-footer">
          <small><i class="fa-solid fa-calendar"></i> ${formatDateTime(item.tglSubmit)}</small>
          ${item.linkSurat ? `<a href="${item.linkSurat}" target="_blank" class="btn-link"><i class="fa-solid fa-file-medical"></i> Lihat Surat</a>` : ""}
        </div>
      </div>
    `).join("");
  } catch (err) {
    document.getElementById("pengajuan-list").innerHTML = `<div class="empty-state error"><p>Gagal memuat data</p></div>`;
  }
}

async function submitPengajuan() {
  const tipe = document.getElementById("tipeIzin").value;
  const keterangan = document.getElementById("keteranganIzin").value.trim();
  const linkSurat = document.getElementById("linkSurat").value.trim();

  if (!keterangan) return showToast("Keterangan wajib diisi", "error");

  showLoading(true);
  try {
    const res = await fetchAPI({
      action: "pengajuan",
      nama: currentUser.nama,
      tipe, keterangan, linkSurat
    });
    if (res.success) {
      showToast("Pengajuan berhasil dikirim!", "success");
      document.getElementById("keteranganIzin").value = "";
      document.getElementById("linkSurat").value = "";
      loadPengajuanList();
    } else {
      showToast(res.message, "error");
    }
  } catch (err) {
    showToast("Error: " + err.message, "error");
  } finally {
    showLoading(false);
  }
}

// =============================================
// PAGE: PROFIL
// =============================================
function renderProfil() {
  const content = document.getElementById("content");
  content.innerHTML = `
    <div class="page-header">
      <h2><i class="fa-solid fa-user-circle"></i> Profil</h2>
    </div>
    <div class="card profil-card">
      <div class="profil-avatar"><i class="fa-solid fa-user"></i></div>
      <div class="profil-info">
        <h3>${currentUser.nama}</h3>
        <p>${currentUser.email}</p>
        <span class="role-badge">${currentUser.role}</span>
      </div>
    </div>

    <div class="card form-card" style="margin-top:16px;">
      <h3><i class="fa-solid fa-lock"></i> Ganti Password</h3>
      <div class="field">
        <label>Password Lama</label>
        <input type="password" id="oldPassword" placeholder="Password saat ini">
      </div>
      <div class="field">
        <label>Password Baru</label>
        <input type="password" id="newPassword" placeholder="Password baru">
      </div>
      <div class="field">
        <label>Konfirmasi Password</label>
        <input type="password" id="confirmPassword" placeholder="Ulangi password baru">
      </div>
      <button onclick="changePassword()" class="btn-primary"><i class="fa-solid fa-save"></i> Simpan</button>
    </div>
  `;
}

async function changePassword() {
  const oldPassword = document.getElementById("oldPassword").value.trim();
  const newPassword = document.getElementById("newPassword").value.trim();
  const confirmPassword = document.getElementById("confirmPassword").value.trim();

  if (!oldPassword || !newPassword || !confirmPassword) return showToast("Semua field wajib diisi", "error");
  if (newPassword !== confirmPassword) return showToast("Password baru tidak cocok", "error");
  if (newPassword.length < 6) return showToast("Password minimal 6 karakter", "error");

  showLoading(true);
  try {
    const res = await fetchAPI({
      action: "changePassword",
      email: currentUser.email,
      oldPassword, newPassword
    });
    if (res.success) {
      showToast("Password berhasil diubah!", "success");
      document.getElementById("oldPassword").value = "";
      document.getElementById("newPassword").value = "";
      document.getElementById("confirmPassword").value = "";
    } else {
      showToast(res.message, "error");
    }
  } catch (err) {
    showToast("Error: " + err.message, "error");
  } finally {
    showLoading(false);
  }
}

// =============================================
// PAGE: MONITORING (Admin)
// =============================================
async function renderMonitoring() {
  if (currentUser.role !== "Admin") return navigateTo("absensi");
  const content = document.getElementById("content");
  content.innerHTML = `
    <div class="page-header">
      <h2><i class="fa-solid fa-chart-line"></i> Monitoring Absensi</h2>
      <p>Data absensi hari ini</p>
    </div>
    <div id="monitor-stats" class="stats-grid">
      <div class="loading-state"><i class="fa-solid fa-spinner fa-spin"></i> Memuat...</div>
    </div>
    <div id="monitor-list" class="card-list"></div>
  `;

  try {
    const res = await fetchAPI({ action: "getAbsensiHarian", role: currentUser.role });
    const stats = document.getElementById("monitor-stats");
    const list = document.getElementById("monitor-list");

    stats.innerHTML = `
      <div class="stat-card green">
        <div class="stat-icon"><i class="fa-solid fa-user-check"></i></div>
        <div class="stat-val">${res.data.length}</div>
        <div class="stat-label">Hadir</div>
      </div>
      <div class="stat-card red">
        <div class="stat-icon"><i class="fa-solid fa-user-xmark"></i></div>
        <div class="stat-val">${Math.max(0, (res.totalStaff || 0) - res.data.length)}</div>
        <div class="stat-label">Tidak Hadir</div>
      </div>
      <div class="stat-card blue">
        <div class="stat-icon"><i class="fa-solid fa-users"></i></div>
        <div class="stat-val">${res.totalStaff || 0}</div>
        <div class="stat-label">Total Staff</div>
      </div>
    `;

    if (res.data.length === 0) {
      list.innerHTML = `<div class="empty-state"><i class="fa-solid fa-inbox"></i><p>Belum ada absensi hari ini</p></div>`;
      return;
    }

    list.innerHTML = `<h3 style="padding:0 4px;margin-bottom:8px;">Daftar Hadir Hari Ini</h3>` + res.data.map((item, i) => `
      <div class="absensi-card">
        <div class="absensi-card-left">
          <span class="absensi-num">${i + 1}</span>
          ${item.foto && item.foto !== "-" ? `<img src="${item.foto}" class="absensi-foto" alt="selfie">` : `<div class="absensi-foto-placeholder"><i class="fa-solid fa-user"></i></div>`}
        </div>
        <div class="absensi-card-body">
          <div class="absensi-nama">${item.nama}</div>
          <div class="absensi-waktu">${formatDateTime(item.waktu)}</div>
          <div class="absensi-info">
            <i class="fa-solid fa-location-dot"></i>
            ${item.latitude && item.latitude !== "-" 
              ? `<a href="https://maps.google.com?q=${item.latitude},${item.longitude}" target="_blank">${parseFloat(item.latitude).toFixed(4)}, ${parseFloat(item.longitude).toFixed(4)}</a>`
              : "QR / Tanpa GPS"}
          </div>
        </div>
        <div class="absensi-badge success">Hadir</div>
      </div>
    `).join("");
  } catch (err) {
    document.getElementById("monitor-stats").innerHTML = `<div class="empty-state error"><p>Gagal memuat data</p></div>`;
  }
}

// =============================================
// PAGE: KELOLA USER (Admin)
// =============================================
async function renderKelolaUser() {
  if (currentUser.role !== "Admin") return navigateTo("absensi");
  const content = document.getElementById("content");
  content.innerHTML = `
    <div class="page-header">
      <h2><i class="fa-solid fa-users-cog"></i> Kelola User</h2>
      <button onclick="showAddUserForm()" class="btn-primary btn-sm"><i class="fa-solid fa-plus"></i> Tambah User</button>
    </div>
    <div id="user-list" class="card-list">
      <div class="loading-state"><i class="fa-solid fa-spinner fa-spin"></i> Memuat...</div>
    </div>
  `;
  loadUserList();
}

async function loadUserList() {
  try {
    const res = await fetchAPI({ action: "getUsers", role: currentUser.role });
    const list = document.getElementById("user-list");
    if (!res.success || res.data.length === 0) {
      list.innerHTML = `<div class="empty-state"><i class="fa-solid fa-inbox"></i><p>Belum ada user</p></div>`;
      return;
    }
    list.innerHTML = res.data.map(user => `
      <div class="user-card">
        <div class="user-avatar"><i class="fa-solid fa-user"></i></div>
        <div class="user-info">
          <div class="user-nama">${user.nama}</div>
          <div class="user-email">${user.email}</div>
          <div style="display:flex;gap:6px;margin-top:4px;">
            <span class="role-badge">${user.role}</span>
            <span class="status-badge ${user.status === 'Aktif' ? 'success' : 'danger'}">${user.status}</span>
          </div>
        </div>
        <div class="user-actions">
          <button onclick="openEditUser('${user.id}','${user.nama}','${user.email}','${user.role}','${user.status}')" class="btn-icon edit"><i class="fa-solid fa-pen"></i></button>
          <button onclick="deleteUser('${user.id}','${user.nama}')" class="btn-icon delete"><i class="fa-solid fa-trash"></i></button>
        </div>
      </div>
    `).join("");
  } catch (err) {
    document.getElementById("user-list").innerHTML = `<div class="empty-state error"><p>Gagal memuat data</p></div>`;
  }
}

function showAddUserForm() {
  const content = document.getElementById("content");
  content.innerHTML = `
    <div class="page-header">
      <button onclick="renderKelolaUser()" class="btn-back"><i class="fa-solid fa-arrow-left"></i></button>
      <h2>Tambah User Baru</h2>
    </div>
    <div class="card form-card">
      <div class="field"><label>Nama Lengkap</label><input type="text" id="add-nama" placeholder="Nama lengkap"></div>
      <div class="field"><label>Email</label><input type="email" id="add-email" placeholder="email@hotel.com"></div>
      <div class="field"><label>Password</label><input type="password" id="add-password" placeholder="Password"></div>
      <div class="field"><label>Role</label>
        <select id="add-role">
          <option value="Staff">Staff</option>
          <option value="Admin">Admin</option>
        </select>
      </div>
      <button onclick="addUser()" class="btn-primary"><i class="fa-solid fa-plus"></i> Tambah User</button>
    </div>
  `;
}

async function addUser() {
  const nama = document.getElementById("add-nama").value.trim();
  const email = document.getElementById("add-email").value.trim();
  const password = document.getElementById("add-password").value.trim();
  const jabatan = document.getElementById("add-role").value;

  if (!nama || !email || !password) return showToast("Semua field wajib diisi", "error");

  showLoading(true);
  try {
    const res = await fetchAPI({ action: "addUser", role: currentUser.role, nama, email, password, jabatan });
    if (res.success) {
      showToast("User berhasil ditambahkan!", "success");
      renderKelolaUser();
    } else {
      showToast(res.message, "error");
    }
  } catch (err) {
    showToast("Error: " + err.message, "error");
  } finally {
    showLoading(false);
  }
}

function openEditUser(id, nama, email, jabatan, status) {
  document.getElementById("edit-user-id").value = id;
  document.getElementById("edit-nama").value = nama;
  document.getElementById("edit-nip").value = email;
  document.getElementById("edit-jabatan").value = jabatan;
  document.getElementById("edit-password").value = "";
  document.getElementById("modal-edit-user").style.display = "flex";
}

function closeModalEdit() {
  document.getElementById("modal-edit-user").style.display = "none";
}

async function saveEditUser() {
  const id = document.getElementById("edit-user-id").value;
  const nama = document.getElementById("edit-nama").value.trim();
  const jabatan = document.getElementById("edit-jabatan").value;
  const password = document.getElementById("edit-password").value.trim();

  showLoading(true);
  try {
    const res = await fetchAPI({ action: "editUser", role: currentUser.role, id, nama, jabatan, password });
    if (res.success) {
      showToast("User berhasil diperbarui!", "success");
      closeModalEdit();
      loadUserList();
    } else {
      showToast(res.message, "error");
    }
  } catch (err) {
    showToast("Error: " + err.message, "error");
  } finally {
    showLoading(false);
  }
}

async function deleteUser(id, nama) {
  if (!confirm(`Hapus user "${nama}"? Tindakan ini tidak bisa dibatalkan.`)) return;
  showLoading(true);
  try {
    const res = await fetchAPI({ action: "deleteUser", role: currentUser.role, id });
    if (res.success) {
      showToast("User berhasil dihapus", "success");
      loadUserList();
    } else {
      showToast(res.message, "error");
    }
  } catch (err) {
    showToast("Error: " + err.message, "error");
  } finally {
    showLoading(false);
  }
}

// =============================================
// PAGE: APPROVE PENGAJUAN (Admin)
// =============================================
async function renderApprovePengajuan() {
  if (currentUser.role !== "Admin") return navigateTo("absensi");
  const content = document.getElementById("content");
  content.innerHTML = `
    <div class="page-header">
      <h2><i class="fa-solid fa-check-circle"></i> Approve Pengajuan Izin</h2>
    </div>
    <div id="approve-list" class="card-list">
      <div class="loading-state"><i class="fa-solid fa-spinner fa-spin"></i> Memuat...</div>
    </div>
  `;

  try {
    const res = await fetchAPI({ action: "getPengajuan", role: currentUser.role, nama: "" });
    const list = document.getElementById("approve-list");
    if (!res.success || res.data.length === 0) {
      list.innerHTML = `<div class="empty-state"><i class="fa-solid fa-inbox"></i><p>Tidak ada pengajuan</p></div>`;
      return;
    }
    list.innerHTML = res.data.map(item => `
      <div class="pengajuan-card">
        <div class="pengajuan-header">
          <div>
            <div class="user-nama">${item.nama}</div>
            <span class="pengajuan-tipe">${item.tipe}</span>
          </div>
          <span class="status-badge ${getStatusClass(item.status)}">${item.status}</span>
        </div>
        <div class="pengajuan-ket">${item.keterangan || "-"}</div>
        <div class="pengajuan-footer">
          <small><i class="fa-solid fa-calendar"></i> ${formatDateTime(item.tglSubmit)}</small>
          ${item.linkSurat ? `<a href="${item.linkSurat}" target="_blank" class="btn-link"><i class="fa-solid fa-file-medical"></i> Lihat Surat</a>` : ""}
        </div>
        ${item.status === "Menunggu" ? `
        <div class="approve-actions">
          <button onclick="approvePengajuan('${item.id}','Disetujui')" class="btn-approve"><i class="fa-solid fa-check"></i> Setujui</button>
          <button onclick="approvePengajuan('${item.id}','Ditolak')" class="btn-reject"><i class="fa-solid fa-xmark"></i> Tolak</button>
        </div>` : ""}
      </div>
    `).join("");
  } catch (err) {
    document.getElementById("approve-list").innerHTML = `<div class="empty-state error"><p>Gagal memuat data</p></div>`;
  }
}

async function approvePengajuan(id, status) {
  const label = status === "Disetujui" ? "menyetujui" : "menolak";
  if (!confirm(`Yakin ingin ${label} pengajuan ini?`)) return;
  showLoading(true);
  try {
    const res = await fetchAPI({ action: "approvePengajuan", role: currentUser.role, id, status });
    if (res.success) {
      showToast(`Pengajuan berhasil ${status.toLowerCase()}!`, "success");
      renderApprovePengajuan();
    } else {
      showToast(res.message, "error");
    }
  } catch (err) {
    showToast("Error: " + err.message, "error");
  } finally {
    showLoading(false);
  }
}

// =============================================
// SIDEBAR TOGGLE
// =============================================
function toggleSidebar() {
  document.getElementById("sidebar").classList.toggle("open");
  document.getElementById("overlay").classList.toggle("show");
}

function closeSidebar() {
  document.getElementById("sidebar").classList.remove("open");
  document.getElementById("overlay").classList.remove("show");
}

// =============================================
// HELPERS
// =============================================
async function fetchAPI(params) {
  const url = new URL(API_URL);
  Object.entries(params).forEach(([k, v]) => url.searchParams.append(k, v));
  const res = await fetch(url.toString());
  return res.json();
}

function showLoading(show) {
  document.getElementById("loading-overlay").style.display = show ? "flex" : "none";
}

function showToast(message, type = "info") {
  const container = document.getElementById("toast-container");
  const toast = document.createElement("div");
  toast.className = `toast toast-${type}`;
  const icons = { success: "fa-check-circle", error: "fa-circle-exclamation", info: "fa-circle-info" };
  toast.innerHTML = `<i class="fa-solid ${icons[type] || icons.info}"></i> ${message}`;
  container.appendChild(toast);
  setTimeout(() => toast.classList.add("show"), 10);
  setTimeout(() => {
    toast.classList.remove("show");
    setTimeout(() => toast.remove(), 400);
  }, 3500);
}

function formatDateTime(dt) {
  if (!dt) return "-";
  const d = new Date(dt);
  if (isNaN(d)) return dt;
  return d.toLocaleDateString("id-ID", { day: "2-digit", month: "long", year: "numeric" })
    + " " + d.toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" });
}

function getStatusClass(status) {
  if (!status) return "";
  const s = status.toLowerCase();
  if (s === "disetujui") return "success";
  if (s === "ditolak") return "danger";
  return "warning";
}
