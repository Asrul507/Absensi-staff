// ============================================
// GENIUS PRESENCE - script.js
// ============================================

const API_URL = "https://script.google.com/macros/s/AKfycby-tuIW6LZAHSxnioSRL_vPRC7SKRb5UToR_q1WO7ONum2sBLa9a633FDbrOQ7CPh8d/exec";

let currentUser = null;
let cameraStream = null;
let currentPage = "absensi";

// ============================================
// INIT
// ============================================
document.addEventListener("DOMContentLoaded", () => {
  const saved = localStorage.getItem("currentUser");
  if (saved) {
    try {
      currentUser = JSON.parse(saved);
      showApp();
    } catch(e) {
      localStorage.removeItem("currentUser");
      showLogin();
    }
  } else {
    showLogin();
  }
});

// ============================================
// LOGIN / LOGOUT
// ============================================
async function login() {
  const email    = (document.getElementById("username").value || "").trim();
  const password = (document.getElementById("password").value || "").trim();
  if (!email || !password) return showToast("Email dan password wajib diisi", "error");

  showLoading(true);
  try {
    const res = await fetchAPI({ action: "login", email, password });
    if (res.success) {
      currentUser = res.user;
      localStorage.setItem("currentUser", JSON.stringify(currentUser));
      showToast("Selamat datang, " + currentUser.nama + "!", "success");
      showApp();
    } else {
      showToast(res.message || "Login gagal", "error");
    }
  } catch (err) {
    showToast("Gagal terhubung ke server", "error");
  } finally {
    showLoading(false);
  }
}

function logout() {
  if (!confirm("Yakin ingin keluar?")) return;
  stopCamera();
  currentUser = null;
  localStorage.removeItem("currentUser");
  showLogin();
  showToast("Berhasil keluar", "info");
}

// ============================================
// SHOW LOGIN / APP
// ============================================
function showLogin() {
  document.getElementById("loginPage").style.display = "flex";
  document.getElementById("appPage").style.display   = "none";
}

function showApp() {
  document.getElementById("loginPage").style.display = "none";
  document.getElementById("appPage").style.display   = "block";
  document.getElementById("userName").textContent    = currentUser.nama;
  renderSidebar();
  renderBottomNav();
  navigateTo("absensi");
}

// ============================================
// SIDEBAR
// ============================================
function renderSidebar() {
  const isAdmin = currentUser.role === "Admin";
  document.getElementById("sidebar").innerHTML = `
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
      <div class="sidebar-divider">Admin Panel</div>
      <a class="sidebar-link" onclick="navigateTo('monitoring')"><i class="fa-solid fa-chart-line"></i> Monitoring</a>
      <a class="sidebar-link" onclick="navigateTo('kelola-user')"><i class="fa-solid fa-users-cog"></i> Kelola User</a>
      <a class="sidebar-link" onclick="navigateTo('approve-pengajuan')"><i class="fa-solid fa-check-circle"></i> Approve Izin</a>
      ` : ""}
    </nav>
    <button onclick="logout()" class="sidebar-logout">
      <i class="fa-solid fa-right-from-bracket"></i> Keluar
    </button>
  `;
}

// ============================================
// BOTTOM NAV
// ============================================
function renderBottomNav() {
  const isAdmin = currentUser.role === "Admin";
  document.getElementById("bottomNav").innerHTML = `
    <button onclick="navigateTo('absensi')"   id="nav-absensi"   class="nav-item"><i class="fa-solid fa-fingerprint"></i><span>Absensi</span></button>
    <button onclick="navigateTo('riwayat')"   id="nav-riwayat"   class="nav-item"><i class="fa-solid fa-clock-rotate-left"></i><span>Riwayat</span></button>
    <button onclick="navigateTo('pengajuan')" id="nav-pengajuan" class="nav-item"><i class="fa-solid fa-file-alt"></i><span>Pengajuan</span></button>
    ${isAdmin ? `<button onclick="navigateTo('monitoring')" id="nav-monitoring" class="nav-item"><i class="fa-solid fa-chart-line"></i><span>Monitor</span></button>` : ""}
    <button onclick="navigateTo('profil')"    id="nav-profil"    class="nav-item"><i class="fa-solid fa-user-circle"></i><span>Profil</span></button>
  `;
}

// ============================================
// NAVIGATION
// ============================================
function navigateTo(page) {
  currentPage = page;
  closeSidebar();
  stopCamera();

  document.querySelectorAll(".nav-item").forEach(b => b.classList.remove("active"));
  const activeBtn = document.getElementById("nav-" + page);
  if (activeBtn) activeBtn.classList.add("active");
  document.querySelectorAll(".sidebar-link").forEach(l => l.classList.remove("active"));
  document.getElementById("content").innerHTML = "";

  switch (page) {
    case "absensi":           renderAbsensi();           break;
    case "riwayat":           renderRiwayat();           break;
    case "pengajuan":         renderPengajuan();         break;
    case "profil":            renderProfil();            break;
    case "monitoring":        renderMonitoring();        break;
    case "kelola-user":       renderKelolaUser();        break;
    case "approve-pengajuan": renderApprovePengajuan();  break;
    default:
      document.getElementById("content").innerHTML =
        `<div class="empty-state"><i class="fa-solid fa-circle-exclamation"></i><p>Halaman tidak ditemukan</p></div>`;
  }
}

// ============================================
// PAGE: ABSENSI - Masuk & Pulang
// ============================================
async function renderAbsensi() {
  document.getElementById("content").innerHTML = `
    <div class="page-header">
      <h2><i class="fa-solid fa-fingerprint"></i> Absensi</h2>
      <p>${getTanggalHari()}</p>
    </div>
    <div id="status-absensi-box" class="card" style="text-align:center;padding:18px 12px;">
      <div class="loading-state"><i class="fa-solid fa-spinner fa-spin"></i> Mengecek status...</div>
    </div>
    <div id="absensi-action-box"></div>
  `;
  await loadStatusAbsensi();
}

function getTanggalHari() {
  return new Date().toLocaleDateString("id-ID", {
    weekday:"long", day:"2-digit", month:"long", year:"numeric"
  });
}

async function loadStatusAbsensi() {
  try {
    const res = await fetchAPI({ action: "getStatusAbsensi", nama: currentUser.nama });
    renderStatusAndAction(res);
  } catch(err) {
    document.getElementById("status-absensi-box").innerHTML =
      `<div class="empty-state error"><p>Gagal memuat status absensi</p></div>`;
  }
}

function renderStatusAndAction(res) {
  const statusBox   = document.getElementById("status-absensi-box");
  const actionBox   = document.getElementById("absensi-action-box");
  const sudahMasuk  = !!res.sudahMasuk;
  const sudahPulang = !!res.sudahPulang;
  const waktuMasuk  = res.waktuMasuk  ? formatDateTime(res.waktuMasuk)  : null;
  const waktuPulang = res.waktuPulang ? formatDateTime(res.waktuPulang) : null;

  // ---- Status tiles ----
  statusBox.innerHTML = `
    <div style="display:flex;gap:12px;justify-content:center;flex-wrap:wrap;">
      <div class="status-tile ${sudahMasuk ? 'done' : 'pending'}">
        <i class="fa-solid ${sudahMasuk ? 'fa-circle-check' : 'fa-circle-xmark'}"></i>
        <div class="status-tile-label">Absen Masuk</div>
        <div class="status-tile-time">${sudahMasuk ? waktuMasuk : '—'}</div>
      </div>
      <div class="status-tile ${sudahPulang ? 'done' : (sudahMasuk ? 'pending' : 'locked')}">
        <i class="fa-solid ${sudahPulang ? 'fa-circle-check' : (sudahMasuk ? 'fa-circle-xmark' : 'fa-lock')}"></i>
        <div class="status-tile-label">Absen Pulang</div>
        <div class="status-tile-time">${sudahPulang ? waktuPulang : (sudahMasuk ? '—' : 'Tunggu masuk dulu')}</div>
      </div>
    </div>
  `;

  // ---- Action ----
  if (sudahMasuk && sudahPulang) {
    actionBox.innerHTML = `
      <div class="card absensi-done-card">
        <i class="fa-solid fa-circle-check" style="font-size:36px;color:#22c55e;"></i>
        <p style="font-weight:700;font-size:16px;margin:10px 0 4px;">Absensi Hari Ini Selesai!</p>
        <p style="font-size:13px;color:#64748b;">
          Masuk: <b>${waktuMasuk}</b><br>Pulang: <b>${waktuPulang}</b>
        </p>
      </div>`;
    return;
  }

  actionBox.innerHTML = buildAbsensiCard(sudahMasuk ? "pulang" : "masuk");
}

function buildAbsensiCard(tipe) {
  const isMasuk = tipe === "masuk";
  const label   = isMasuk ? "Absen Masuk" : "Absen Pulang";
  const icon    = isMasuk ? "fa-right-to-bracket" : "fa-right-from-bracket";
  const color   = isMasuk ? "#3b82f6" : "#f97316";
  const id      = "cam-" + tipe;

  return `
    <div class="card" style="margin-top:0;">
      <h3 style="display:flex;align-items:center;gap:8px;color:${color};margin-bottom:6px;">
        <i class="fa-solid ${icon}"></i> ${label}
      </h3>
      <p style="font-size:13px;color:#64748b;margin-bottom:14px;">
        Tekan tombol, arahkan wajah ke kamera, lalu ambil foto — absensi tersimpan otomatis.
      </p>

      <!-- Kamera / Preview -->
      <div class="camera-wrap" id="${id}-wrap">
        <video id="${id}-video" autoplay playsinline
          style="display:none;width:100%;height:100%;object-fit:cover;border-radius:12px;"></video>
        <img id="${id}-img" src="" alt="foto"
          style="display:none;width:100%;height:100%;object-fit:cover;border-radius:12px;">
        <div id="${id}-ph" style="width:100%;height:100%;display:flex;flex-direction:column;
          align-items:center;justify-content:center;color:#94a3b8;gap:10px;">
          <i class="fa-solid fa-camera" style="font-size:44px;"></i>
          <span style="font-size:13px;">Kamera belum aktif</span>
        </div>
      </div>

      <!-- Status GPS -->
      <div id="${id}-gps" class="gps-status idle" style="margin:12px 0 4px;">
        <i class="fa-solid fa-location-dot"></i>
        <span>GPS akan diambil otomatis saat kamera dibuka</span>
      </div>

      <!-- Tombol -->
      <div style="display:flex;gap:10px;margin-top:12px;flex-wrap:wrap;">
        <button id="${id}-open"
          onclick="bukaKameraAbsensi('${tipe}')"
          class="btn-absensi" style="background:${color};flex:1;">
          <i class="fa-solid fa-camera"></i> Buka Kamera & Ambil Lokasi
        </button>
        <button id="${id}-capture"
          onclick="ambilFotoDanKirim('${tipe}')"
          class="btn-absensi" style="background:#22c55e;flex:1;display:none;">
          <i class="fa-solid fa-circle-dot"></i> Ambil Foto & Kirim Absensi
        </button>
        <button id="${id}-retake"
          onclick="ulangiAbsensi('${tipe}')"
          class="btn-secondary" style="flex:1;display:none;">
          <i class="fa-solid fa-rotate-left"></i> Ulangi
        </button>
      </div>
    </div>
  `;
}

// ============================================
// KAMERA - Buka & Ambil GPS sekaligus
// ============================================
async function bukaKameraAbsensi(tipe) {
  const id    = "cam-" + tipe;
  const gpsEl = document.getElementById(id + "-gps");

  gpsEl.className = "gps-status loading";
  gpsEl.innerHTML = `<i class="fa-solid fa-spinner fa-spin"></i> <span>Mengambil GPS...</span>`;

  // Buka kamera
  try {
    cameraStream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "user" }, audio: false });
    const video = document.getElementById(id + "-video");
    video.srcObject = cameraStream;
    video.style.display = "block";
    document.getElementById(id + "-ph").style.display      = "none";
    document.getElementById(id + "-img").style.display     = "none";
    document.getElementById(id + "-open").style.display    = "none";
    document.getElementById(id + "-capture").style.display = "inline-flex";
  } catch(err) {
    showToast("Gagal akses kamera: " + err.message, "error");
    gpsEl.className = "gps-status idle";
    gpsEl.innerHTML = `<i class="fa-solid fa-location-dot"></i> <span>GPS akan diambil otomatis saat kamera dibuka</span>`;
    return;
  }

  // Ambil GPS bersamaan (non-blocking)
  if (navigator.geolocation) {
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const video = document.getElementById(id + "-video");
        if (video) {
          video.dataset.lat = pos.coords.latitude;
          video.dataset.lng = pos.coords.longitude;
        }
        gpsEl.className = "gps-status success";
        gpsEl.innerHTML = `<i class="fa-solid fa-check"></i>
          <span>GPS: ${pos.coords.latitude.toFixed(5)}, ${pos.coords.longitude.toFixed(5)}</span>`;
      },
      (err) => {
        gpsEl.className = "gps-status error";
        gpsEl.innerHTML = `<i class="fa-solid fa-xmark"></i> <span>GPS gagal: ${err.message}</span>`;
      },
      { enableHighAccuracy: true, timeout: 10000 }
    );
  } else {
    gpsEl.className = "gps-status error";
    gpsEl.innerHTML = `<i class="fa-solid fa-xmark"></i> <span>GPS tidak didukung browser ini</span>`;
  }
}

// ============================================
// AMBIL FOTO → LANGSUNG SUBMIT
// ============================================
async function ambilFotoDanKirim(tipe) {
  const id    = "cam-" + tipe;
  const video = document.getElementById(id + "-video");
  const gpsEl = document.getElementById(id + "-gps");
  const lat   = video.dataset.lat || "";
  const lng   = video.dataset.lng || "";

  if (!lat || !lng) {
    if (gpsEl.className.includes("loading")) {
      showToast("GPS masih diproses, tunggu sebentar lalu coba lagi...", "info");
    } else {
      showToast("GPS belum berhasil. Coba tutup dan buka kamera lagi.", "error");
    }
    return;
  }

  // Capture dari video
  const canvas = document.createElement("canvas");
  canvas.width  = video.videoWidth  || 640;
  canvas.height = video.videoHeight || 480;
  canvas.getContext("2d").drawImage(video, 0, 0);
  const fotoBase64 = canvas.toDataURL("image/jpeg", 0.75).split(",")[1];

  // Tampilkan preview & sembunyikan video
  const img = document.getElementById(id + "-img");
  img.src = "data:image/jpeg;base64," + fotoBase64;
  img.style.display = "block";
  video.style.display = "none";
  document.getElementById(id + "-capture").style.display = "none";
  document.getElementById(id + "-retake").style.display  = "inline-flex";
  stopCamera();

  // Kirim ke server
  showLoading(true);
  try {
    const uploadRes = await fetchAPI(
      { action: "uploadFoto", nama: currentUser.nama },
      { foto: fotoBase64 }
    );
    if (!uploadRes.success) throw new Error(uploadRes.message || "Upload foto gagal");

    const absenRes = await fetchAPI({
      action:    "absensi",
      tipe:      tipe,
      nama:      currentUser.nama,
      latitude:  lat,
      longitude: lng,
      linkFoto:  uploadRes.linkFoto
    });

    if (absenRes.success) {
      const labelTipe = tipe === "masuk" ? "Masuk" : "Pulang";
      showToast(`✅ Absen ${labelTipe} berhasil! ${absenRes.waktu}`, "success");
      setTimeout(() => renderAbsensi(), 800);
    } else {
      showToast(absenRes.message || "Absensi gagal", "error");
      ulangiAbsensi(tipe);
    }
  } catch(err) {
    showToast("Error: " + err.message, "error");
    ulangiAbsensi(tipe);
  } finally {
    showLoading(false);
  }
}

function ulangiAbsensi(tipe) {
  const id = "cam-" + tipe;
  stopCamera();
  const el = (sel) => document.getElementById(id + sel);
  if (el("-img"))     { el("-img").style.display     = "none"; }
  if (el("-video"))   { el("-video").style.display   = "none"; el("-video").srcObject = null; }
  if (el("-ph"))      { el("-ph").style.display       = "flex"; }
  if (el("-open"))    { el("-open").style.display     = "inline-flex"; }
  if (el("-capture")) { el("-capture").style.display  = "none"; }
  if (el("-retake"))  { el("-retake").style.display   = "none"; }
  if (el("-gps"))     {
    el("-gps").className = "gps-status idle";
    el("-gps").innerHTML = `<i class="fa-solid fa-location-dot"></i>
      <span>GPS akan diambil otomatis saat kamera dibuka</span>`;
  }
}

function stopCamera() {
  if (cameraStream) {
    cameraStream.getTracks().forEach(t => t.stop());
    cameraStream = null;
  }
}

// ============================================
// PAGE: RIWAYAT
// ============================================
async function renderRiwayat() {
  document.getElementById("content").innerHTML = `
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

    if (!res.success || !res.data || res.data.length === 0) {
      list.innerHTML = `<div class="empty-state"><i class="fa-solid fa-inbox"></i><p>Belum ada riwayat absensi</p></div>`;
      return;
    }

    // Urutkan terbaru dulu
    const sorted = [...res.data].sort((a, b) =>
      new Date(b.tanggal) - new Date(a.tanggal)
    );

    list.innerHTML = sorted.map(item => {
      const lupaM = item.statusMasuk  === "Lupa Absen Masuk";
      const lupaP = item.statusPulang === "Lupa Absen Pulang";

      return `
        <div class="riwayat-card">
          <div class="riwayat-tanggal">
            <i class="fa-solid fa-calendar-day"></i>
            ${formatTanggal(item.tanggal)}
          </div>
          <div class="riwayat-rows">
            <div class="riwayat-row ${lupaM ? 'lupa' : ''}">
              <div class="riwayat-tipe masuk"><i class="fa-solid fa-right-to-bracket"></i> Masuk</div>
              <div class="riwayat-detail">
                ${lupaM
                  ? `<span class="badge-lupa">⚠️ Lupa Absen Masuk</span>`
                  : `<div class="riwayat-waktu">${formatWaktu(item.waktuMasuk)}</div>
                     ${item.latMasuk && item.latMasuk !== "-"
                       ? `<a href="https://maps.google.com?q=${item.latMasuk},${item.lngMasuk}" target="_blank" class="riwayat-lokasi">
                            <i class="fa-solid fa-location-dot"></i> Lihat Lokasi</a>`
                       : `<span class="riwayat-lokasi muted">Lokasi tidak ada</span>`}
                     ${item.fotoMasuk && item.fotoMasuk !== "-"
                       ? `<a href="${item.fotoMasuk}" target="_blank" class="riwayat-foto-link">
                            <i class="fa-solid fa-image"></i> Foto</a>` : ""}`
                }
              </div>
            </div>
            <div class="riwayat-row ${lupaP ? 'lupa' : ''}">
              <div class="riwayat-tipe pulang"><i class="fa-solid fa-right-from-bracket"></i> Pulang</div>
              <div class="riwayat-detail">
                ${lupaP
                  ? `<span class="badge-lupa">⚠️ Lupa Absen Pulang</span>`
                  : item.waktuPulang
                    ? `<div class="riwayat-waktu">${formatWaktu(item.waktuPulang)}</div>
                       ${item.latPulang && item.latPulang !== "-"
                         ? `<a href="https://maps.google.com?q=${item.latPulang},${item.lngPulang}" target="_blank" class="riwayat-lokasi">
                              <i class="fa-solid fa-location-dot"></i> Lihat Lokasi</a>`
                         : `<span class="riwayat-lokasi muted">Lokasi tidak ada</span>`}
                       ${item.fotoPulang && item.fotoPulang !== "-"
                         ? `<a href="${item.fotoPulang}" target="_blank" class="riwayat-foto-link">
                              <i class="fa-solid fa-image"></i> Foto</a>` : ""}`
                    : `<span style="color:#94a3b8;font-size:13px;">Belum absen pulang</span>`
                }
              </div>
            </div>
          </div>
        </div>
      `;
    }).join("");

  } catch(err) {
    document.getElementById("riwayat-list").innerHTML =
      `<div class="empty-state error"><i class="fa-solid fa-triangle-exclamation"></i><p>Gagal memuat data</p></div>`;
  }
}

// ============================================
// PAGE: PENGAJUAN
// ============================================
async function renderPengajuan() {
  document.getElementById("content").innerHTML = `
    <div class="page-header">
      <h2><i class="fa-solid fa-file-alt"></i> Pengajuan Izin</h2>
    </div>
    <div class="card">
      <h3>Buat Pengajuan Baru</h3>
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
        <label>Link Surat Pendukung <span style="color:#64748b;font-weight:400;">(opsional)</span></label>
        <input type="url" id="linkSurat" placeholder="https://drive.google.com/...">
      </div>
      <button onclick="submitPengajuan()" class="btn-primary full">
        <i class="fa-solid fa-paper-plane"></i> Kirim Pengajuan
      </button>
    </div>
    <div class="page-header" style="margin-top:8px;">
      <h2 style="font-size:16px;"><i class="fa-solid fa-list"></i> Riwayat Pengajuan</h2>
    </div>
    <div id="pengajuan-list" class="card-list">
      <div class="loading-state"><i class="fa-solid fa-spinner fa-spin"></i> Memuat...</div>
    </div>
  `;
  loadPengajuanList();
}

async function loadPengajuanList() {
  try {
    const res = await fetchAPI({ action: "getPengajuan", nama: currentUser.nama, role: currentUser.role });
    const list = document.getElementById("pengajuan-list");
    if (!res.success || !res.data || res.data.length === 0) {
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
          <small style="color:#64748b;"><i class="fa-solid fa-calendar"></i> ${formatDateTime(item.tglSubmit)}</small>
          ${item.linkSurat ? `<a href="${item.linkSurat}" target="_blank" class="btn-link"><i class="fa-solid fa-file-medical"></i> Lihat Surat</a>` : ""}
        </div>
      </div>
    `).join("");
  } catch(err) {
    document.getElementById("pengajuan-list").innerHTML = `<div class="empty-state error"><p>Gagal memuat data</p></div>`;
  }
}

async function submitPengajuan() {
  const tipe       = document.getElementById("tipeIzin").value;
  const keterangan = document.getElementById("keteranganIzin").value.trim();
  const linkSurat  = document.getElementById("linkSurat").value.trim();
  if (!keterangan) return showToast("Keterangan wajib diisi", "error");
  showLoading(true);
  try {
    const res = await fetchAPI({ action: "pengajuan", nama: currentUser.nama, tipe, keterangan, linkSurat });
    if (res.success) {
      showToast("Pengajuan berhasil dikirim!", "success");
      document.getElementById("keteranganIzin").value = "";
      document.getElementById("linkSurat").value = "";
      loadPengajuanList();
    } else {
      showToast(res.message, "error");
    }
  } catch(err) { showToast("Error: " + err.message, "error"); }
  finally { showLoading(false); }
}

// ============================================
// PAGE: PROFIL
// ============================================
function renderProfil() {
  document.getElementById("content").innerHTML = `
    <div class="page-header">
      <h2><i class="fa-solid fa-user-circle"></i> Profil Saya</h2>
    </div>
    <div class="card profil-card">
      <div class="profil-avatar"><i class="fa-solid fa-user"></i></div>
      <div class="profil-info">
        <h3>${currentUser.nama}</h3>
        <p>${currentUser.email}</p>
        <span class="role-badge">${currentUser.role}</span>
      </div>
    </div>
    <div class="card" style="margin-top:4px;">
      <h3><i class="fa-solid fa-lock"></i> Ganti Password</h3>
      <div class="field"><label>Password Lama</label><input type="password" id="oldPassword" placeholder="Password saat ini"></div>
      <div class="field"><label>Password Baru</label><input type="password" id="newPassword" placeholder="Minimal 6 karakter"></div>
      <div class="field"><label>Konfirmasi Password Baru</label><input type="password" id="confirmPassword" placeholder="Ulangi password baru"></div>
      <button onclick="changePassword()" class="btn-primary full"><i class="fa-solid fa-save"></i> Simpan Password</button>
    </div>
  `;
}

async function changePassword() {
  const oldPassword     = document.getElementById("oldPassword").value.trim();
  const newPassword     = document.getElementById("newPassword").value.trim();
  const confirmPassword = document.getElementById("confirmPassword").value.trim();
  if (!oldPassword || !newPassword || !confirmPassword) return showToast("Semua field wajib diisi", "error");
  if (newPassword !== confirmPassword) return showToast("Password baru tidak cocok", "error");
  if (newPassword.length < 6) return showToast("Password minimal 6 karakter", "error");
  showLoading(true);
  try {
    const res = await fetchAPI({ action: "changePassword", email: currentUser.email, oldPassword, newPassword });
    if (res.success) {
      showToast("Password berhasil diubah!", "success");
      ["oldPassword","newPassword","confirmPassword"].forEach(id => document.getElementById(id).value = "");
    } else {
      showToast(res.message, "error");
    }
  } catch(err) { showToast("Error: " + err.message, "error"); }
  finally { showLoading(false); }
}

// ============================================
// PAGE: MONITORING (Admin)
// ============================================
async function renderMonitoring() {
  if (currentUser.role !== "Admin") return navigateTo("absensi");
  document.getElementById("content").innerHTML = `
    <div class="page-header">
      <h2><i class="fa-solid fa-chart-line"></i> Monitoring Absensi</h2>
      <p>Data kehadiran hari ini</p>
    </div>
    <div id="monitor-stats" class="stats-grid">
      <div class="loading-state" style="grid-column:1/-1;"><i class="fa-solid fa-spinner fa-spin"></i> Memuat...</div>
    </div>
    <div id="monitor-list" class="card-list"></div>
  `;
  try {
    const res = await fetchAPI({ action: "getAbsensiHarian", role: currentUser.role });
    const hadir = res.data ? res.data.length : 0;
    const total = res.totalStaff || 0;
    document.getElementById("monitor-stats").innerHTML = `
      <div class="stat-card green">
        <div class="stat-icon"><i class="fa-solid fa-user-check"></i></div>
        <div class="stat-val">${hadir}</div>
        <div class="stat-label">Hadir</div>
      </div>
      <div class="stat-card red">
        <div class="stat-icon"><i class="fa-solid fa-user-xmark"></i></div>
        <div class="stat-val">${Math.max(0, total - hadir)}</div>
        <div class="stat-label">Tidak Hadir</div>
      </div>
      <div class="stat-card blue">
        <div class="stat-icon"><i class="fa-solid fa-users"></i></div>
        <div class="stat-val">${total}</div>
        <div class="stat-label">Total Staff</div>
      </div>
    `;
    const list = document.getElementById("monitor-list");
    if (!res.data || res.data.length === 0) {
      list.innerHTML = `<div class="empty-state"><i class="fa-solid fa-inbox"></i><p>Belum ada absensi hari ini</p></div>`;
      return;
    }
    list.innerHTML = `<p style="font-size:14px;font-weight:600;margin-bottom:10px;">Daftar Hadir Hari Ini</p>` +
      res.data.map((item, i) => `
        <div class="absensi-card">
          <div class="absensi-card-left">
            <span class="absensi-num">${i+1}</span>
            ${item.fotoMasuk && item.fotoMasuk !== "-"
              ? `<img src="${item.fotoMasuk}" class="absensi-foto" alt="selfie">`
              : `<div class="absensi-foto-placeholder"><i class="fa-solid fa-user"></i></div>`}
          </div>
          <div class="absensi-card-body">
            <div class="absensi-nama">${item.nama}</div>
            <div class="absensi-waktu">
              <i class="fa-solid fa-right-to-bracket" style="color:#3b82f6;"></i>
              ${item.waktuMasuk ? formatDateTime(item.waktuMasuk) : "-"}
            </div>
            <div class="absensi-waktu">
              <i class="fa-solid fa-right-from-bracket" style="color:#f97316;"></i>
              ${item.waktuPulang
                ? formatDateTime(item.waktuPulang)
                : '<span style="color:#94a3b8;">Belum absen pulang</span>'}
            </div>
          </div>
          <div class="absensi-badge ${item.waktuPulang ? 'success' : 'warning'}">
            ${item.waktuPulang ? 'Lengkap' : 'Masuk'}
          </div>
        </div>
      `).join("");
  } catch(err) {
    document.getElementById("monitor-stats").innerHTML =
      `<div class="empty-state error" style="grid-column:1/-1;"><p>Gagal memuat data</p></div>`;
  }
}

// ============================================
// PAGE: KELOLA USER (Admin)
// ============================================
async function renderKelolaUser() {
  if (currentUser.role !== "Admin") return navigateTo("absensi");
  document.getElementById("content").innerHTML = `
    <div class="page-header-row">
      <h2><i class="fa-solid fa-users-cog"></i> Kelola User</h2>
      <button onclick="showAddUserForm()" class="btn-primary btn-sm"><i class="fa-solid fa-plus"></i> Tambah</button>
    </div>
    <div id="user-list">
      <div class="loading-state"><i class="fa-solid fa-spinner fa-spin"></i> Memuat...</div>
    </div>
  `;
  loadUserList();
}

async function loadUserList() {
  try {
    const res = await fetchAPI({ action: "getUsers", role: currentUser.role });
    const list = document.getElementById("user-list");
    if (!res.success || !res.data || res.data.length === 0) {
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
  } catch(err) {
    document.getElementById("user-list").innerHTML = `<div class="empty-state error"><p>Gagal memuat data</p></div>`;
  }
}

function showAddUserForm() {
  document.getElementById("content").innerHTML = `
    <div class="page-header-row">
      <h2><button onclick="renderKelolaUser()" class="btn-back"><i class="fa-solid fa-arrow-left"></i></button> Tambah User</h2>
    </div>
    <div class="card">
      <div class="field"><label>Nama Lengkap</label><input type="text" id="add-nama" placeholder="Nama lengkap"></div>
      <div class="field"><label>Email</label><input type="email" id="add-email" placeholder="email@perusahaan.com"></div>
      <div class="field"><label>Password</label><input type="password" id="add-password" placeholder="Minimal 6 karakter"></div>
      <div class="field"><label>Role</label>
        <select id="add-role"><option value="Staff">Staff</option><option value="Admin">Admin</option></select>
      </div>
      <button onclick="addUser()" class="btn-primary full"><i class="fa-solid fa-plus"></i> Tambah User</button>
    </div>
  `;
}

async function addUser() {
  const nama     = document.getElementById("add-nama").value.trim();
  const email    = document.getElementById("add-email").value.trim();
  const password = document.getElementById("add-password").value.trim();
  const jabatan  = document.getElementById("add-role").value;
  if (!nama || !email || !password) return showToast("Semua field wajib diisi", "error");
  if (password.length < 6) return showToast("Password minimal 6 karakter", "error");
  showLoading(true);
  try {
    const res = await fetchAPI({ action: "addUser", role: currentUser.role, nama, email, password, jabatan });
    if (res.success) { showToast("User berhasil ditambahkan!", "success"); renderKelolaUser(); }
    else showToast(res.message, "error");
  } catch(err) { showToast("Error: " + err.message, "error"); }
  finally { showLoading(false); }
}

function openEditUser(id, nama, email, jabatan, status) {
  document.getElementById("edit-user-id").value      = id;
  document.getElementById("edit-nama").value         = nama;
  document.getElementById("edit-nip").value          = email;
  document.getElementById("edit-jabatan").value      = jabatan;
  document.getElementById("edit-status-user").value  = status;
  document.getElementById("edit-password").value     = "";
  document.getElementById("modal-edit-user").classList.add("show");
}
function closeModalEdit() { document.getElementById("modal-edit-user").classList.remove("show"); }

async function saveEditUser() {
  const id       = document.getElementById("edit-user-id").value;
  const nama     = document.getElementById("edit-nama").value.trim();
  const jabatan  = document.getElementById("edit-jabatan").value;
  const status   = document.getElementById("edit-status-user").value;
  const password = document.getElementById("edit-password").value.trim();
  showLoading(true);
  try {
    const res = await fetchAPI({ action: "editUser", role: currentUser.role, id, nama, jabatan, status, password });
    if (res.success) { showToast("User berhasil diperbarui!", "success"); closeModalEdit(); loadUserList(); }
    else showToast(res.message, "error");
  } catch(err) { showToast("Error: " + err.message, "error"); }
  finally { showLoading(false); }
}

async function deleteUser(id, nama) {
  if (!confirm(`Hapus user "${nama}"? Tindakan ini tidak bisa dibatalkan.`)) return;
  showLoading(true);
  try {
    const res = await fetchAPI({ action: "deleteUser", role: currentUser.role, id });
    if (res.success) { showToast("User berhasil dihapus", "success"); loadUserList(); }
    else showToast(res.message, "error");
  } catch(err) { showToast("Error: " + err.message, "error"); }
  finally { showLoading(false); }
}

// ============================================
// PAGE: APPROVE PENGAJUAN (Admin)
// ============================================
async function renderApprovePengajuan() {
  if (currentUser.role !== "Admin") return navigateTo("absensi");
  document.getElementById("content").innerHTML = `
    <div class="page-header">
      <h2><i class="fa-solid fa-check-circle"></i> Approve Pengajuan</h2>
    </div>
    <div id="approve-list" class="card-list">
      <div class="loading-state"><i class="fa-solid fa-spinner fa-spin"></i> Memuat...</div>
    </div>
  `;
  try {
    const res = await fetchAPI({ action: "getPengajuan", role: currentUser.role, nama: "" });
    const list = document.getElementById("approve-list");
    if (!res.success || !res.data || res.data.length === 0) {
      list.innerHTML = `<div class="empty-state"><i class="fa-solid fa-inbox"></i><p>Tidak ada pengajuan</p></div>`;
      return;
    }
    list.innerHTML = res.data.map(item => `
      <div class="pengajuan-card">
        <div class="pengajuan-header">
          <div>
            <div style="font-size:13px;color:#64748b;margin-bottom:2px;">${item.nama}</div>
            <span class="pengajuan-tipe">${item.tipe}</span>
          </div>
          <span class="status-badge ${getStatusClass(item.status)}">${item.status}</span>
        </div>
        <div class="pengajuan-ket">${item.keterangan || "-"}</div>
        <div class="pengajuan-footer">
          <small style="color:#64748b;"><i class="fa-solid fa-calendar"></i> ${formatDateTime(item.tglSubmit)}</small>
          ${item.linkSurat ? `<a href="${item.linkSurat}" target="_blank" class="btn-link"><i class="fa-solid fa-file-medical"></i> Lihat Surat</a>` : ""}
        </div>
        ${item.status === "Menunggu" ? `
        <div class="approve-actions">
          <button onclick="approvePengajuan('${item.id}','Disetujui')" class="btn-approve"><i class="fa-solid fa-check"></i> Setujui</button>
          <button onclick="approvePengajuan('${item.id}','Ditolak')"   class="btn-reject"><i class="fa-solid fa-xmark"></i> Tolak</button>
        </div>` : ""}
      </div>
    `).join("");
  } catch(err) {
    document.getElementById("approve-list").innerHTML = `<div class="empty-state error"><p>Gagal memuat data</p></div>`;
  }
}

async function approvePengajuan(id, status) {
  const label = status === "Disetujui" ? "menyetujui" : "menolak";
  if (!confirm(`Yakin ingin ${label} pengajuan ini?`)) return;
  showLoading(true);
  try {
    const res = await fetchAPI({ action: "approvePengajuan", role: currentUser.role, id, status });
    if (res.success) { showToast(`Pengajuan berhasil ${status.toLowerCase()}!`, "success"); renderApprovePengajuan(); }
    else showToast(res.message, "error");
  } catch(err) { showToast("Error: " + err.message, "error"); }
  finally { showLoading(false); }
}

// ============================================
// SIDEBAR TOGGLE
// ============================================
function toggleSidebar() {
  document.getElementById("sidebar").classList.toggle("open");
  document.getElementById("overlay").classList.toggle("show");
}
function closeSidebar() {
  document.getElementById("sidebar").classList.remove("open");
  document.getElementById("overlay").classList.remove("show");
}

// ============================================
// FETCH API
// ============================================
async function fetchAPI(params, postData = null) {
  if (postData) {
    const body = { ...params, ...postData };
    const res = await fetch(API_URL, {
      method: "POST",
      headers: { "Content-Type": "text/plain;charset=utf-8" },
      body: JSON.stringify(body),
    });
    if (!res.ok) throw new Error("HTTP " + res.status);
    return res.json();
  }
  const url = new URL(API_URL);
  Object.entries(params).forEach(([k, v]) => url.searchParams.append(k, v));
  const res = await fetch(url.toString());
  if (!res.ok) throw new Error("HTTP " + res.status);
  return res.json();
}

// ============================================
// UI HELPERS
// ============================================
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
  setTimeout(() => { toast.classList.remove("show"); setTimeout(() => toast.remove(), 400); }, 3500);
}

function formatDateTime(dt) {
  if (!dt) return "-";
  const d = new Date(dt);
  if (isNaN(d)) return dt;
  return d.toLocaleDateString("id-ID", { day:"2-digit", month:"long", year:"numeric" })
    + " " + d.toLocaleTimeString("id-ID", { hour:"2-digit", minute:"2-digit" });
}

function formatTanggal(tgl) {
  if (!tgl) return "-";
  const d = new Date(tgl + "T00:00:00");
  if (isNaN(d)) return tgl;
  return d.toLocaleDateString("id-ID", { weekday:"long", day:"2-digit", month:"long", year:"numeric" });
}

function formatWaktu(dt) {
  if (!dt) return "-";
  const d = new Date(dt);
  if (isNaN(d)) return dt;
  return d.toLocaleTimeString("id-ID", { hour:"2-digit", minute:"2-digit" });
}

function getStatusClass(status) {
  if (!status) return "warning";
  const s = status.toLowerCase();
  if (s === "disetujui") return "success";
  if (s === "ditolak")   return "danger";
  return "warning";
}
