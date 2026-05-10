// ============================================
// GENIUS PRESENCE - script.js
// Versi: Shift + Import Jadwal
// ============================================

const API_URL = "https://script.google.com/macros/s/AKfycby9bz31OAyjCsORDtbkxdY7yUUnB4lmxmxrJdLE0g3meXm6TVSN9tkLhXCQWjgM8xS5/exec";

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
    } else showToast(res.message || "Login gagal", "error");
  } catch(err) { showToast("Gagal terhubung ke server", "error"); }
  finally { showLoading(false); }
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

// ============================================
// SIDEBAR & BOTTOM NAV
// ============================================
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
      <a class="sidebar-link" onclick="navigateTo('jadwal')"><i class="fa-solid fa-calendar-days"></i> Jadwal Shift</a>
      <a class="sidebar-link" onclick="navigateTo('riwayat')"><i class="fa-solid fa-clock-rotate-left"></i> Riwayat</a>
      <a class="sidebar-link" onclick="navigateTo('pengajuan')"><i class="fa-solid fa-file-alt"></i> Pengajuan Izin</a>
      <a class="sidebar-link" onclick="navigateTo('profil')"><i class="fa-solid fa-user-circle"></i> Profil</a>
      ${isAdmin ? `
      <div class="sidebar-divider">Admin Panel</div>
      <a class="sidebar-link" onclick="navigateTo('monitoring')"><i class="fa-solid fa-chart-line"></i> Monitoring</a>
      <a class="sidebar-link" onclick="navigateTo('import-jadwal')"><i class="fa-solid fa-file-import"></i> Import Jadwal</a>
      <a class="sidebar-link" onclick="navigateTo('atur-jadwal')"><i class="fa-solid fa-calendar-pen"></i> Atur Jadwal Manual</a>
      <a class="sidebar-link" onclick="navigateTo('master-shift')"><i class="fa-solid fa-list-check"></i> Master Shift</a>
      <a class="sidebar-link" onclick="navigateTo('kelola-user')"><i class="fa-solid fa-users-cog"></i> Kelola User</a>
      <a class="sidebar-link" onclick="navigateTo('approve-pengajuan')"><i class="fa-solid fa-check-circle"></i> Approve Izin</a>
      ` : ""}
    </nav>
    <button onclick="logout()" class="sidebar-logout"><i class="fa-solid fa-right-from-bracket"></i> Keluar</button>
  `;
}

function renderBottomNav() {
  const isAdmin = currentUser.role === "Admin";
  document.getElementById("bottomNav").innerHTML = `
    <button onclick="navigateTo('absensi')"      id="nav-absensi"      class="nav-item"><i class="fa-solid fa-fingerprint"></i><span>Absensi</span></button>
    <button onclick="navigateTo('jadwal')"       id="nav-jadwal"       class="nav-item"><i class="fa-solid fa-calendar-days"></i><span>Jadwal</span></button>
    <button onclick="navigateTo('riwayat')"      id="nav-riwayat"      class="nav-item"><i class="fa-solid fa-clock-rotate-left"></i><span>Riwayat</span></button>
    <button onclick="navigateTo('pengajuan')"    id="nav-pengajuan"    class="nav-item"><i class="fa-solid fa-file-alt"></i><span>Izin</span></button>
    ${isAdmin
      ? `<button onclick="navigateTo('import-jadwal')" id="nav-import-jadwal" class="nav-item"><i class="fa-solid fa-file-import"></i><span>Import</span></button>`
      : `<button onclick="navigateTo('profil')"        id="nav-profil"        class="nav-item"><i class="fa-solid fa-user-circle"></i><span>Profil</span></button>`}
  `;
}

// ============================================
// NAVIGATION
// ============================================
function navigateTo(page) {
  currentPage = page; closeSidebar(); stopCamera();
  document.querySelectorAll(".nav-item").forEach(b => b.classList.remove("active"));
  const btn = document.getElementById("nav-" + page);
  if (btn) btn.classList.add("active");
  document.querySelectorAll(".sidebar-link").forEach(l => l.classList.remove("active"));
  document.getElementById("content").innerHTML = "";
  switch(page) {
    case "absensi":           renderAbsensi();           break;
    case "jadwal":            renderJadwalStaff();       break;
    case "riwayat":           renderRiwayat();           break;
    case "pengajuan":         renderPengajuan();         break;
    case "profil":            renderProfil();            break;
    case "monitoring":        renderMonitoring();        break;
    case "import-jadwal":     renderImportJadwal();      break;
    case "atur-jadwal":       renderAturJadwal();        break;
    case "master-shift":      renderMasterShift();       break;
    case "kelola-user":       renderKelolaUser();        break;
    case "approve-pengajuan": renderApprovePengajuan();  break;
    default:
      document.getElementById("content").innerHTML =
        `<div class="empty-state"><i class="fa-solid fa-circle-exclamation"></i><p>Halaman tidak ditemukan</p></div>`;
  }
}

// ============================================
// PAGE: ABSENSI
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
    <div id="absensi-action-box"></div>`;
  await loadStatusAbsensi();
}

function getTanggalHari() {
  return new Date().toLocaleDateString("id-ID", { weekday:"long", day:"2-digit", month:"long", year:"numeric" });
}

async function loadStatusAbsensi() {
  try {
    const res = await fetchAPI({ action: "getStatusAbsensi", nama: currentUser.nama });
    renderStatusAndAction(res);
  } catch(err) {
    document.getElementById("status-absensi-box").innerHTML = `<div class="empty-state error"><p>Gagal memuat status</p></div>`;
  }
}

function renderStatusAndAction(res) {
  const statusBox   = document.getElementById("status-absensi-box");
  const actionBox   = document.getElementById("absensi-action-box");
  const sudahMasuk  = !!res.sudahMasuk, sudahPulang = !!res.sudahPulang;
  const waktuMasuk  = res.waktuMasuk  ? formatDateTime(res.waktuMasuk)  : null;
  const waktuPulang = res.waktuPulang ? formatDateTime(res.waktuPulang) : null;
  const shift = res.shift, ketTelat = res.ketTelat || "";

  const shiftHTML = shift
    ? `<div class="shift-info-bar"><i class="fa-solid fa-clock"></i>
        <span>Shift <b>${shift.nama}</b> &nbsp;|&nbsp;
          <i class="fa-solid fa-right-to-bracket" style="color:#3b82f6;"></i> ${shift.jamMasuk}
          &nbsp;–&nbsp;
          <i class="fa-solid fa-right-from-bracket" style="color:#f97316;"></i> ${shift.jamPulang}
        </span></div>`
    : `<div class="shift-info-bar" style="background:#fef9c3;color:#92400e;border-color:#fde68a;">
        <i class="fa-solid fa-triangle-exclamation"></i>
        <span>Tidak ada jadwal shift hari ini</span></div>`;

  statusBox.innerHTML = `
    ${shiftHTML}
    <div style="display:flex;gap:12px;justify-content:center;flex-wrap:wrap;margin-top:12px;">
      <div class="status-tile ${sudahMasuk?'done':'pending'}">
        <i class="fa-solid ${sudahMasuk?'fa-circle-check':'fa-circle-xmark'}"></i>
        <div class="status-tile-label">Absen Masuk</div>
        <div class="status-tile-time">${sudahMasuk?waktuMasuk:'—'}</div>
      </div>
      <div class="status-tile ${sudahPulang?'done':(sudahMasuk?'pending':'locked')}">
        <i class="fa-solid ${sudahPulang?'fa-circle-check':(sudahMasuk?'fa-circle-xmark':'fa-lock')}"></i>
        <div class="status-tile-label">Absen Pulang</div>
        <div class="status-tile-time">${sudahPulang?waktuPulang:(sudahMasuk?'—':'Tunggu masuk dulu')}</div>
      </div>
    </div>
    ${ketTelat?`<div class="ket-telat-badge">${getTelatIcon(ketTelat)} ${ketTelat}</div>`:""}`;

  if (sudahMasuk && sudahPulang) {
    actionBox.innerHTML = `
      <div class="card absensi-done-card">
        <i class="fa-solid fa-circle-check" style="font-size:36px;color:#22c55e;"></i>
        <p style="font-weight:700;font-size:16px;margin:10px 0 4px;">Absensi Hari Ini Selesai!</p>
        <p style="font-size:13px;color:#64748b;">Masuk: <b>${waktuMasuk}</b><br>Pulang: <b>${waktuPulang}</b></p>
        ${ketTelat?`<div class="ket-telat-badge" style="margin-top:8px;">${getTelatIcon(ketTelat)} ${ketTelat}</div>`:""}
      </div>`;
    return;
  }
  actionBox.innerHTML = buildAbsensiCard(sudahMasuk ? "pulang" : "masuk");
}

function getTelatIcon(ket) {
  if (!ket) return "";
  if (ket.includes("Terlambat") || ket.includes("lebih awal")) return "⚠️";
  if (ket.includes("Tepat")) return "✅";
  if (ket.includes("Lembur")) return "⏰";
  return "ℹ️";
}

function buildAbsensiCard(tipe) {
  const isMasuk = tipe === "masuk";
  const color   = isMasuk ? "#3b82f6" : "#f97316";
  const icon    = isMasuk ? "fa-right-to-bracket" : "fa-right-from-bracket";
  const label   = isMasuk ? "Absen Masuk" : "Absen Pulang";
  const id      = "cam-" + tipe;
  return `
    <div class="card" style="margin-top:0;">
      <h3 style="display:flex;align-items:center;gap:8px;color:${color};margin-bottom:6px;">
        <i class="fa-solid ${icon}"></i> ${label}
      </h3>
      <p style="font-size:13px;color:#64748b;margin-bottom:14px;">Tekan tombol, arahkan wajah ke kamera, lalu ambil foto — absensi tersimpan otomatis.</p>
      <div class="camera-wrap" id="${id}-wrap">
        <video id="${id}-video" autoplay playsinline style="display:none;width:100%;height:100%;object-fit:cover;border-radius:12px;"></video>
        <img   id="${id}-img"   src="" style="display:none;width:100%;height:100%;object-fit:cover;border-radius:12px;">
        <div   id="${id}-ph"    style="width:100%;height:100%;display:flex;flex-direction:column;align-items:center;justify-content:center;color:#94a3b8;gap:10px;">
          <i class="fa-solid fa-camera" style="font-size:44px;"></i>
          <span style="font-size:13px;">Kamera belum aktif</span>
        </div>
      </div>
      <div id="${id}-gps" class="gps-status idle" style="margin:12px 0 4px;">
        <i class="fa-solid fa-location-dot"></i><span>GPS akan diambil otomatis saat kamera dibuka</span>
      </div>
      <div style="display:flex;gap:10px;margin-top:12px;flex-wrap:wrap;">
        <button id="${id}-open"    onclick="bukaKameraAbsensi('${tipe}')" class="btn-absensi" style="background:${color};flex:1;">
          <i class="fa-solid fa-camera"></i> Buka Kamera & Ambil Lokasi
        </button>
        <button id="${id}-capture" onclick="ambilFotoDanKirim('${tipe}')" class="btn-absensi" style="background:#22c55e;flex:1;display:none;">
          <i class="fa-solid fa-circle-dot"></i> Ambil Foto & Kirim Absensi
        </button>
        <button id="${id}-retake"  onclick="ulangiAbsensi('${tipe}')" class="btn-secondary" style="flex:1;display:none;">
          <i class="fa-solid fa-rotate-left"></i> Ulangi
        </button>
      </div>
    </div>`;
}

async function bukaKameraAbsensi(tipe) {
  const id = "cam-" + tipe;
  const gpsEl = document.getElementById(id + "-gps");
  gpsEl.className = "gps-status loading";
  gpsEl.innerHTML = `<i class="fa-solid fa-spinner fa-spin"></i> <span>Mengambil GPS...</span>`;
  try {
    cameraStream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "user" }, audio: false });
    const video = document.getElementById(id + "-video");
    video.srcObject = cameraStream; video.style.display = "block";
    document.getElementById(id + "-ph").style.display = "none";
    document.getElementById(id + "-img").style.display = "none";
    document.getElementById(id + "-open").style.display = "none";
    document.getElementById(id + "-capture").style.display = "inline-flex";
  } catch(err) {
    showToast("Gagal akses kamera: " + err.message, "error");
    gpsEl.className = "gps-status idle";
    gpsEl.innerHTML = `<i class="fa-solid fa-location-dot"></i><span>GPS akan diambil otomatis saat kamera dibuka</span>`;
    return;
  }
  if (navigator.geolocation) {
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const v = document.getElementById(id + "-video");
        if (v) { v.dataset.lat = pos.coords.latitude; v.dataset.lng = pos.coords.longitude; }
        gpsEl.className = "gps-status success";
        gpsEl.innerHTML = `<i class="fa-solid fa-check"></i><span>GPS: ${pos.coords.latitude.toFixed(5)}, ${pos.coords.longitude.toFixed(5)}</span>`;
      },
      (err) => { gpsEl.className = "gps-status error"; gpsEl.innerHTML = `<i class="fa-solid fa-xmark"></i><span>GPS gagal: ${err.message}</span>`; },
      { enableHighAccuracy: true, timeout: 10000 }
    );
  }
}

async function ambilFotoDanKirim(tipe) {
  const id = "cam-" + tipe;
  const video = document.getElementById(id + "-video");
  const gpsEl = document.getElementById(id + "-gps");
  const lat = video.dataset.lat || "", lng = video.dataset.lng || "";
  if (!lat || !lng) {
    showToast(gpsEl.className.includes("loading") ? "GPS masih diproses, tunggu sebentar..." : "GPS belum berhasil. Coba ulangi.",
      gpsEl.className.includes("loading") ? "info" : "error");
    return;
  }
  const canvas = document.createElement("canvas");
  canvas.width = video.videoWidth || 640; canvas.height = video.videoHeight || 480;
  canvas.getContext("2d").drawImage(video, 0, 0);
  const fotoBase64 = canvas.toDataURL("image/jpeg", 0.75).split(",")[1];
  const img = document.getElementById(id + "-img");
  img.src = "data:image/jpeg;base64," + fotoBase64; img.style.display = "block";
  video.style.display = "none";
  document.getElementById(id + "-capture").style.display = "none";
  document.getElementById(id + "-retake").style.display  = "inline-flex";
  stopCamera();
  showLoading(true);
  try {
    const uploadRes = await fetchAPI({ action: "uploadFoto", nama: currentUser.nama }, { foto: fotoBase64 });
    if (!uploadRes.success) throw new Error(uploadRes.message || "Upload foto gagal");
    const absenRes = await fetchAPI({ action: "absensi", tipe, nama: currentUser.nama, latitude: lat, longitude: lng, linkFoto: uploadRes.linkFoto });
    if (absenRes.success) {
      let msg = `✅ Absen ${tipe === "masuk" ? "Masuk" : "Pulang"} berhasil!`;
      if (absenRes.shift)    msg += ` | Shift: ${absenRes.shift}`;
      if (absenRes.ketTelat) msg += ` | ${absenRes.ketTelat}`;
      showToast(msg, "success");
      setTimeout(() => renderAbsensi(), 800);
    } else { showToast(absenRes.message || "Absensi gagal", "error"); ulangiAbsensi(tipe); }
  } catch(err) { showToast("Error: " + err.message, "error"); ulangiAbsensi(tipe); }
  finally { showLoading(false); }
}

function ulangiAbsensi(tipe) {
  const id = "cam-" + tipe; stopCamera();
  const el = (s) => document.getElementById(id + s);
  if (el("-img"))     el("-img").style.display = "none";
  if (el("-video"))   { el("-video").style.display = "none"; el("-video").srcObject = null; }
  if (el("-ph"))      el("-ph").style.display = "flex";
  if (el("-open"))    el("-open").style.display = "inline-flex";
  if (el("-capture")) el("-capture").style.display = "none";
  if (el("-retake"))  el("-retake").style.display  = "none";
  if (el("-gps"))     { el("-gps").className = "gps-status idle"; el("-gps").innerHTML = `<i class="fa-solid fa-location-dot"></i><span>GPS akan diambil otomatis saat kamera dibuka</span>`; }
}

function stopCamera() {
  if (cameraStream) { cameraStream.getTracks().forEach(t => t.stop()); cameraStream = null; }
}

// ============================================
// PAGE: JADWAL SHIFT (Staff)
// ============================================
async function renderJadwalStaff() {
  const now = new Date();
  const bulan = `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,"0")}`;
  document.getElementById("content").innerHTML = `
    <div class="page-header"><h2><i class="fa-solid fa-calendar-days"></i> Jadwal Shift Saya</h2></div>
    <div class="card" style="padding:12px;">
      <div style="display:flex;align-items:center;gap:8px;margin-bottom:12px;">
        <label style="font-size:13px;font-weight:600;">Bulan:</label>
        <input type="month" id="pilih-bulan-staff" value="${bulan}"
          onchange="loadJadwalStaff(this.value)"
          style="flex:1;padding:6px 10px;border:1px solid #e2e8f0;border-radius:8px;font-size:13px;">
      </div>
      <div id="jadwal-staff-list">
        <div class="loading-state"><i class="fa-solid fa-spinner fa-spin"></i> Memuat jadwal...</div>
      </div>
    </div>`;
  await loadJadwalStaff(bulan);
}

async function loadJadwalStaff(bulan) {
  const listEl = document.getElementById("jadwal-staff-list");
  if (!listEl) return;
  listEl.innerHTML = `<div class="loading-state"><i class="fa-solid fa-spinner fa-spin"></i> Memuat...</div>`;
  try {
    const res = await fetchAPI({ action: "getJadwalStaff", nama: currentUser.nama, bulan });
    if (!res.success || !res.data || !res.data.length) {
      listEl.innerHTML = `<div class="empty-state"><i class="fa-solid fa-calendar-xmark"></i><p>Belum ada jadwal untuk bulan ini</p></div>`;
      return;
    }
    const todayStr = new Date().toISOString().slice(0,10);
    listEl.innerHTML = res.data.map(item => {
      const isToday = item.tanggal === todayStr;
      const isPast  = item.tanggal < todayStr;
      const c = getShiftColor(item.shiftNama);
      return `
        <div class="jadwal-item ${isToday?'jadwal-today':''} ${isPast?'jadwal-past':''}">
          <div class="jadwal-tgl">
            <div class="jadwal-tgl-num">${item.tanggal.slice(8)}</div>
            <div class="jadwal-tgl-hari">${getHariPendek(item.tanggal)}</div>
          </div>
          <div class="jadwal-shift-badge" style="background:${c.bg};color:${c.text};">
            <i class="fa-solid fa-clock"></i> ${item.shiftNama}
          </div>
          <div class="jadwal-jam">
            <span><i class="fa-solid fa-right-to-bracket" style="color:#3b82f6;"></i> ${item.jamMasuk}</span>
            <span><i class="fa-solid fa-right-from-bracket" style="color:#f97316;"></i> ${item.jamPulang}</span>
          </div>
          ${isToday?`<div class="jadwal-today-badge">Hari Ini</div>`:""}
        </div>`;
    }).join("");
  } catch(err) {
    listEl.innerHTML = `<div class="empty-state error"><p>Gagal memuat jadwal</p></div>`;
  }
}

// ============================================
// PAGE: IMPORT JADWAL (Admin) ← FITUR BARU
// ============================================
async function renderImportJadwal() {
  if (currentUser.role !== "Admin") return navigateTo("absensi");

  document.getElementById("content").innerHTML = `
    <div class="page-header">
      <h2><i class="fa-solid fa-file-import"></i> Import Jadwal dari Sheet</h2>
    </div>

    <!-- Panduan -->
    <div class="card import-guide">
      <h3 style="margin-bottom:10px;font-size:15px;"><i class="fa-solid fa-circle-info" style="color:#3b82f6;"></i> Cara Penggunaan</h3>
      <ol style="padding-left:18px;font-size:13px;color:#475569;line-height:1.8;">
        <li>Buka Google Sheets yang sama dengan app ini</li>
        <li>Buat sheet baru bernama <b>JadwalImport</b></li>
        <li>Isi dengan format berikut:</li>
      </ol>
      <div class="import-format-box">
        <table class="import-table-preview">
          <tr>
            <th>Nama</th><th>2026-05-01</th><th>2026-05-02</th><th>2026-05-03</th><th>...</th>
          </tr>
          <tr>
            <td>Budi</td>
            <td><span class="shift-chip pagi">Pagi</span></td>
            <td><span class="shift-chip sore">Sore</span></td>
            <td><span class="shift-chip malam">Malam</span></td>
            <td class="muted">...</td>
          </tr>
          <tr>
            <td>Andi</td>
            <td><span class="shift-chip sore">Sore</span></td>
            <td><span class="shift-chip malam">Malam</span></td>
            <td><span class="shift-chip pagi">Pagi</span></td>
            <td class="muted">...</td>
          </tr>
          <tr>
            <td>Siti</td>
            <td><span class="shift-chip libur">Libur</span></td>
            <td><span class="shift-chip pagi">Pagi</span></td>
            <td><span class="shift-chip libur">Libur</span></td>
            <td class="muted">...</td>
          </tr>
        </table>
      </div>
      <ul style="padding-left:18px;font-size:12px;color:#64748b;margin-top:8px;line-height:1.7;">
        <li>Baris 1 = header: kolom A = "Nama", kolom B dst = tanggal format <b>yyyy-MM-dd</b></li>
        <li>Nama shift harus sama persis dengan <b>Master Shift</b> (Pagi/Sore/Malam)</li>
        <li>Isi <b>Libur</b> atau kosongkan untuk hari libur</li>
        <li>Bisa sekaligus banyak staff dan banyak bulan dalam 1 sheet</li>
      </ul>
    </div>

    <!-- Pilih Bulan & Preview -->
    <div class="card" style="padding:14px;">
      <h3 style="font-size:14px;margin-bottom:12px;"><i class="fa-solid fa-magnifying-glass"></i> Preview Sebelum Import</h3>
      <div style="display:flex;gap:8px;flex-wrap:wrap;align-items:flex-end;">
        <div style="flex:1;min-width:140px;">
          <label style="font-size:12px;font-weight:600;color:#64748b;display:block;margin-bottom:4px;">Filter Bulan</label>
          <input type="month" id="import-bulan"
            style="width:100%;padding:8px 10px;border:1px solid #e2e8f0;border-radius:8px;font-size:13px;">
        </div>
        <button onclick="previewImport()" class="btn-outline" style="height:38px;padding:0 16px;">
          <i class="fa-solid fa-eye"></i> Preview
        </button>
        <button onclick="jalankanImport()" class="btn-primary" style="height:38px;padding:0 16px;" id="btn-import" disabled>
          <i class="fa-solid fa-file-import"></i> Import Sekarang
        </button>
      </div>
      <p style="font-size:12px;color:#94a3b8;margin-top:6px;">
        <i class="fa-solid fa-lightbulb" style="color:#f59e0b;"></i>
        Kosongkan filter bulan untuk import semua bulan sekaligus
      </p>
    </div>

    <div id="import-preview-box"></div>
  `;
}

async function previewImport() {
  const bulan  = document.getElementById("import-bulan").value || "";
  const preBox = document.getElementById("import-preview-box");
  const btnImp = document.getElementById("btn-import");
  preBox.innerHTML = `<div class="loading-state"><i class="fa-solid fa-spinner fa-spin"></i> Membaca sheet JadwalImport...</div>`;
  btnImp.disabled = true;

  try {
    const res = await fetchAPI({ action: "previewImport", role: currentUser.role, bulan });
    if (!res.success) {
      preBox.innerHTML = `<div class="card" style="border-left:4px solid #ef4444;padding:14px;">
        <p style="color:#ef4444;font-weight:600;"><i class="fa-solid fa-circle-exclamation"></i> ${res.message}</p>
      </div>`;
      return;
    }

    // Ringkasan
    const adaError = res.totalError > 0;
    let html = `
      <div class="card" style="padding:14px;">
        <h3 style="font-size:14px;margin-bottom:10px;"><i class="fa-solid fa-table-list"></i> Hasil Preview</h3>
        <div style="display:flex;gap:10px;flex-wrap:wrap;margin-bottom:14px;">
          <div class="import-stat-box blue"><div class="import-stat-num">${res.totalStaff}</div><div class="import-stat-lab">Staff</div></div>
          <div class="import-stat-box green"><div class="import-stat-num">${res.totalHari}</div><div class="import-stat-lab">Hari</div></div>
          <div class="import-stat-box teal"><div class="import-stat-num">${res.totalOk}</div><div class="import-stat-lab">Jadwal OK</div></div>
          ${adaError ? `<div class="import-stat-box red"><div class="import-stat-num">${res.totalError}</div><div class="import-stat-lab">Error</div></div>` : ""}
        </div>`;

    // Tampilkan error dulu jika ada
    if (adaError) {
      const errors = res.preview.filter(p => !p.valid);
      html += `
        <div style="background:#fef2f2;border:1px solid #fecaca;border-radius:8px;padding:10px;margin-bottom:12px;">
          <p style="color:#dc2626;font-weight:600;font-size:13px;margin-bottom:6px;">
            <i class="fa-solid fa-triangle-exclamation"></i> ${errors.length} entri bermasalah — perbaiki di sheet sebelum import:
          </p>
          ${errors.slice(0,10).map(e => `
            <div style="font-size:12px;color:#7f1d1d;padding:2px 0;">
              <b>${e.nama}</b> — ${e.tanggal}: ${e.pesan}
            </div>`).join("")}
          ${errors.length > 10 ? `<p style="font-size:12px;color:#7f1d1d;margin-top:4px;">...dan ${errors.length-10} lainnya</p>` : ""}
        </div>`;
    }

    // Tabel preview per staff
    // Kelompokkan per nama
    const byNama = {};
    res.preview.filter(p => p.valid && p.shiftNama !== "Libur").forEach(p => {
      if (!byNama[p.nama]) byNama[p.nama] = [];
      byNama[p.nama].push(p);
    });

    const namaList = Object.keys(byNama).sort();
    if (namaList.length) {
      html += `<p style="font-size:13px;font-weight:600;margin-bottom:8px;color:#374151;">Preview Jadwal (non-libur):</p>`;
      html += `<div style="overflow-x:auto;">
        <table style="width:100%;border-collapse:collapse;font-size:12px;">
          <thead>
            <tr style="background:#f8fafc;">
              <th style="padding:6px 10px;text-align:left;border-bottom:1px solid #e2e8f0;">Nama</th>
              <th style="padding:6px 10px;text-align:left;border-bottom:1px solid #e2e8f0;">Tanggal</th>
              <th style="padding:6px 10px;text-align:left;border-bottom:1px solid #e2e8f0;">Shift</th>
              <th style="padding:6px 10px;text-align:left;border-bottom:1px solid #e2e8f0;">Jam Masuk</th>
              <th style="padding:6px 10px;text-align:left;border-bottom:1px solid #e2e8f0;">Jam Pulang</th>
            </tr>
          </thead>
          <tbody>`;

      namaList.forEach(nama => {
        byNama[nama].forEach((item, idx) => {
          const c = getShiftColor(item.shiftNama);
          html += `
            <tr style="border-bottom:1px solid #f1f5f9;">
              <td style="padding:5px 10px;">${idx === 0 ? `<b>${nama}</b>` : ""}</td>
              <td style="padding:5px 10px;color:#64748b;">${formatTanggal(item.tanggal)}</td>
              <td style="padding:5px 10px;">
                <span style="background:${c.bg};color:${c.text};padding:2px 8px;border-radius:20px;font-size:11px;font-weight:600;">${item.shiftNama}</span>
              </td>
              <td style="padding:5px 10px;color:#3b82f6;">${item.jamMasuk || "-"}</td>
              <td style="padding:5px 10px;color:#f97316;">${item.jamPulang || "-"}</td>
            </tr>`;
        });
      });
      html += `</tbody></table></div>`;
    }

    html += `</div>`;
    preBox.innerHTML = html;

    // Enable tombol import hanya jika tidak ada error (atau biarkan import meski ada error)
    btnImp.disabled = false;
    if (adaError) {
      btnImp.style.background = "#f97316";
      btnImp.innerHTML = `<i class="fa-solid fa-triangle-exclamation"></i> Import (ada ${res.totalError} error, akan dilewati)`;
    } else {
      btnImp.style.background = "";
      btnImp.innerHTML = `<i class="fa-solid fa-file-import"></i> Import Sekarang (${res.totalOk} jadwal)`;
    }

  } catch(err) {
    preBox.innerHTML = `<div class="empty-state error"><p>Gagal membaca sheet: ${err.message}</p></div>`;
  }
}

async function jalankanImport() {
  const bulan  = document.getElementById("import-bulan").value || "";
  const btnImp = document.getElementById("btn-import");
  btnImp.disabled = true;

  showLoading(true);
  try {
    const res = await fetchAPI({ action: "importJadwal", role: currentUser.role, bulan });
    if (res.success) {
      showToast("✅ " + res.message, "success");
      // Tampilkan ringkasan hasil
      document.getElementById("import-preview-box").innerHTML = `
        <div class="card" style="border-left:4px solid #22c55e;padding:14px;">
          <p style="font-weight:700;color:#15803d;font-size:15px;margin-bottom:8px;">
            <i class="fa-solid fa-circle-check"></i> Import Berhasil!
          </p>
          <p style="font-size:13px;color:#374151;">
            ✅ ${res.created} jadwal baru ditambahkan<br>
            🔄 ${res.updated} jadwal diperbarui<br>
            📅 ${res.skipped} hari libur dilewati<br>
            ${res.errors && res.errors.length ? `⚠️ ${res.errors.length} error dilewati` : ""}
          </p>
        </div>`;
    } else {
      showToast(res.message, "error");
      btnImp.disabled = false;
    }
  } catch(err) {
    showToast("Error: " + err.message, "error");
    btnImp.disabled = false;
  } finally {
    showLoading(false);
  }
}

// ============================================
// PAGE: ATUR JADWAL MANUAL (Admin)
// ============================================
async function renderAturJadwal() {
  if (currentUser.role !== "Admin") return navigateTo("absensi");
  const now   = new Date();
  const bulan = `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,"0")}`;
  document.getElementById("content").innerHTML = `
    <div class="page-header">
      <h2><i class="fa-solid fa-calendar-pen"></i> Atur Jadwal Manual</h2>
    </div>
    <div class="card" style="padding:12px;margin-bottom:0;">
      <div style="display:flex;gap:8px;flex-wrap:wrap;align-items:flex-end;">
        <div style="flex:1;min-width:120px;">
          <label style="font-size:12px;font-weight:600;color:#64748b;">Bulan</label>
          <input type="month" id="jadwal-bulan" value="${bulan}" style="width:100%;padding:8px 10px;border:1px solid #e2e8f0;border-radius:8px;font-size:13px;margin-top:4px;">
        </div>
        <div style="flex:2;min-width:150px;">
          <label style="font-size:12px;font-weight:600;color:#64748b;">Staff</label>
          <select id="jadwal-staff" style="width:100%;padding:8px 10px;border:1px solid #e2e8f0;border-radius:8px;font-size:13px;margin-top:4px;">
            <option value="">-- Pilih Staff --</option>
          </select>
        </div>
        <button onclick="loadGridJadwal()" class="btn-primary" style="height:38px;padding:0 16px;margin-top:4px;">
          <i class="fa-solid fa-magnifying-glass"></i> Tampilkan
        </button>
      </div>
    </div>
    <div id="bulk-action-bar" style="display:none;" class="card" style="padding:10px 12px;margin-top:0;">
      <p style="font-size:12px;font-weight:600;color:#64748b;margin-bottom:8px;">Isi semua hari sekaligus:</p>
      <div style="display:flex;gap:8px;flex-wrap:wrap;align-items:center;">
        <select id="bulk-shift" style="flex:1;padding:7px 10px;border:1px solid #e2e8f0;border-radius:8px;font-size:13px;">
          <option value="">-- Pilih Shift --</option>
        </select>
        <button onclick="applyBulkShift()" class="btn-primary" style="height:36px;padding:0 14px;">
          <i class="fa-solid fa-wand-magic-sparkles"></i> Terapkan ke Semua Hari
        </button>
        <button onclick="saveJadwal()" class="btn-success" style="height:36px;padding:0 14px;">
          <i class="fa-solid fa-floppy-disk"></i> Simpan
        </button>
      </div>
    </div>
    <div id="jadwal-grid-wrap"></div>`;
  await Promise.all([loadStaffOptions(), loadShiftCache()]);
}

async function loadStaffOptions() {
  try {
    const res = await fetchAPI({ action: "getUsers", role: currentUser.role });
    const sel = document.getElementById("jadwal-staff");
    if (!sel || !res.success) return;
    res.data.filter(u => u.status === "Aktif").forEach(u => {
      const opt = document.createElement("option");
      opt.value = u.nama; opt.textContent = u.nama; sel.appendChild(opt);
    });
  } catch(e) {}
}

async function loadShiftCache() {
  try {
    const res = await fetchAPI({ action: "getShift" });
    if (res.success) allShifts = res.data || [];
    const sel = document.getElementById("bulk-shift");
    if (sel) allShifts.forEach(s => {
      const opt = document.createElement("option");
      opt.value = s.id; opt.textContent = `${s.nama} (${s.jamMasuk}–${s.jamPulang})`; sel.appendChild(opt);
    });
  } catch(e) {}
}

let gridJadwalData = {}, gridStaff = "", gridBulan = "";

async function loadGridJadwal() {
  const bulan = document.getElementById("jadwal-bulan").value;
  const staff = document.getElementById("jadwal-staff").value;
  if (!bulan) return showToast("Pilih bulan terlebih dahulu", "error");
  if (!staff) return showToast("Pilih staff terlebih dahulu", "error");
  gridBulan = bulan; gridStaff = staff; gridJadwalData = {};
  const wrap = document.getElementById("jadwal-grid-wrap");
  wrap.innerHTML = `<div class="loading-state"><i class="fa-solid fa-spinner fa-spin"></i> Memuat...</div>`;
  document.getElementById("bulk-action-bar").style.display = "block";
  try {
    const res = await fetchAPI({ action: "getJadwal", role: currentUser.role, bulan });
    if (res.success && res.data) res.data.filter(item => item.nama === staff).forEach(item => { gridJadwalData[item.tanggal] = item.shiftId; });
    renderGridJadwal(bulan, staff);
  } catch(err) { wrap.innerHTML = `<div class="empty-state error"><p>Gagal memuat jadwal</p></div>`; }
}

function renderGridJadwal(bulan, staff) {
  const wrap = document.getElementById("jadwal-grid-wrap");
  const [yr, mo] = bulan.split("-").map(Number);
  const totalHari = new Date(yr, mo, 0).getDate();
  const todayStr  = new Date().toISOString().slice(0,10);
  let html = `
    <div class="card" style="padding:12px;margin-top:0;">
      <p style="font-size:13px;color:#64748b;margin-bottom:10px;">
        Jadwal untuk <b>${staff}</b> — <b>${getNamaBulan(mo)} ${yr}</b>
      </p>
      <div class="jadwal-grid">`;
  for (let d = 1; d <= totalHari; d++) {
    const tgl = `${bulan}-${String(d).padStart(2,"0")}`;
    const isToday = tgl === todayStr;
    const hariIdx = new Date(tgl).getDay();
    const hariName = ["Min","Sen","Sel","Rab","Kam","Jum","Sab"][hariIdx];
    const shiftId = gridJadwalData[tgl] || "";
    const shiftOpt = allShifts.map(s => `<option value="${s.id}" ${s.id===shiftId?"selected":""}>${s.nama}</option>`).join("");
    html += `
      <div class="jadwal-grid-item ${isToday?'today':''} ${hariIdx===0?'minggu':''}">
        <div class="jadwal-grid-tgl">
          <span class="jadwal-grid-num">${d}</span>
          <span class="jadwal-grid-hari">${hariName}</span>
        </div>
        <select class="jadwal-grid-sel" data-tgl="${tgl}" onchange="onGridChange('${tgl}',this.value)">
          <option value="">— Libur —</option>${shiftOpt}
        </select>
      </div>`;
  }
  html += `</div></div>`;
  wrap.innerHTML = html;
}

function onGridChange(tgl, shiftId) {
  if (shiftId) gridJadwalData[tgl] = shiftId; else delete gridJadwalData[tgl];
}

function applyBulkShift() {
  const shiftId = document.getElementById("bulk-shift").value;
  if (!shiftId) return showToast("Pilih shift terlebih dahulu", "error");
  document.querySelectorAll(".jadwal-grid-sel").forEach(sel => { sel.value = shiftId; gridJadwalData[sel.dataset.tgl] = shiftId; });
  showToast("Shift diterapkan ke semua hari. Jangan lupa simpan!", "info");
}

async function saveJadwal() {
  if (!gridStaff || !gridBulan) return showToast("Pilih staff dan bulan dulu", "error");
  const entries = Object.entries(gridJadwalData).map(([tanggal, shiftId]) => ({ nama: gridStaff, tanggal, shiftId }));
  if (!entries.length) return showToast("Belum ada jadwal yang diisi", "error");
  showLoading(true);
  try {
    const res = await fetchAPI({ action: "setJadwalBulk", role: currentUser.role, entries: JSON.stringify(entries) });
    if (res.success) showToast("✅ " + res.message, "success"); else showToast(res.message, "error");
  } catch(err) { showToast("Error: " + err.message, "error"); }
  finally { showLoading(false); }
}

// ============================================
// PAGE: MASTER SHIFT (Admin)
// ============================================
async function renderMasterShift() {
  if (currentUser.role !== "Admin") return navigateTo("absensi");
  document.getElementById("content").innerHTML = `
    <div class="page-header-row">
      <h2><i class="fa-solid fa-list-check"></i> Master Shift</h2>
      <button onclick="showFormTambahShift()" class="btn-primary btn-sm"><i class="fa-solid fa-plus"></i> Tambah</button>
    </div>
    <div id="shift-list"><div class="loading-state"><i class="fa-solid fa-spinner fa-spin"></i> Memuat...</div></div>`;
  await loadShiftList();
}

async function loadShiftList() {
  try {
    const res = await fetchAPI({ action: "getShift" });
    allShifts = res.data || [];
    const list = document.getElementById("shift-list");
    if (!res.success || !allShifts.length) {
      list.innerHTML = `<div class="empty-state"><i class="fa-solid fa-inbox"></i><p>Belum ada shift. Tambah shift dulu.</p></div>`;
      return;
    }
    list.innerHTML = allShifts.map(s => {
      const c = getShiftColor(s.nama);
      return `
        <div class="shift-card">
          <div class="shift-card-dot" style="background:${c.bg};"></div>
          <div class="shift-card-info">
            <div class="shift-card-nama">${s.nama}</div>
            <div class="shift-card-jam">
              <i class="fa-solid fa-right-to-bracket" style="color:#3b82f6;"></i> ${s.jamMasuk}
              &nbsp;–&nbsp;
              <i class="fa-solid fa-right-from-bracket" style="color:#f97316;"></i> ${s.jamPulang}
            </div>
            ${s.keterangan?`<div class="shift-card-ket">${s.keterangan}</div>`:""}
          </div>
          <div class="user-actions">
            <button onclick="showFormEditShift('${s.id}','${s.nama}','${s.jamMasuk}','${s.jamPulang}','${s.keterangan||""}')" class="btn-icon edit"><i class="fa-solid fa-pen"></i></button>
            <button onclick="hapusShift('${s.id}','${s.nama}')" class="btn-icon delete"><i class="fa-solid fa-trash"></i></button>
          </div>
        </div>`;
    }).join("");
  } catch(err) { document.getElementById("shift-list").innerHTML = `<div class="empty-state error"><p>Gagal memuat shift</p></div>`; }
}

function showFormTambahShift() {
  document.getElementById("content").innerHTML = `
    <div class="page-header-row">
      <h2><button onclick="renderMasterShift()" class="btn-back"><i class="fa-solid fa-arrow-left"></i></button> Tambah Shift</h2>
    </div>
    <div class="card">
      <div class="field"><label>Nama Shift</label><input type="text" id="sf-nama" placeholder="contoh: Pagi, Sore, Malam"></div>
      <div class="field"><label>Jam Masuk</label><input type="time" id="sf-masuk" value="07:00"></div>
      <div class="field"><label>Jam Pulang</label><input type="time" id="sf-pulang" value="15:00"></div>
      <div class="field"><label>Keterangan (opsional)</label><input type="text" id="sf-ket"></div>
      <button onclick="simpanShiftBaru()" class="btn-primary full"><i class="fa-solid fa-plus"></i> Tambah Shift</button>
    </div>`;
}

function showFormEditShift(id, nama, jamMasuk, jamPulang, ket) {
  document.getElementById("content").innerHTML = `
    <div class="page-header-row">
      <h2><button onclick="renderMasterShift()" class="btn-back"><i class="fa-solid fa-arrow-left"></i></button> Edit Shift</h2>
    </div>
    <div class="card">
      <div class="field"><label>Nama Shift</label><input type="text" id="sf-nama" value="${nama}"></div>
      <div class="field"><label>Jam Masuk</label><input type="time" id="sf-masuk" value="${jamMasuk}"></div>
      <div class="field"><label>Jam Pulang</label><input type="time" id="sf-pulang" value="${jamPulang}"></div>
      <div class="field"><label>Keterangan (opsional)</label><input type="text" id="sf-ket" value="${ket}"></div>
      <button onclick="simpanEditShift('${id}')" class="btn-primary full"><i class="fa-solid fa-floppy-disk"></i> Simpan Perubahan</button>
    </div>`;
}

async function simpanShiftBaru() {
  const nama=document.getElementById("sf-nama").value.trim();
  const jamMasuk=document.getElementById("sf-masuk").value;
  const jamPulang=document.getElementById("sf-pulang").value;
  const ket=document.getElementById("sf-ket").value.trim();
  if (!nama||!jamMasuk||!jamPulang) return showToast("Nama shift dan jam wajib diisi","error");
  showLoading(true);
  try {
    const res=await fetchAPI({action:"addShift",role:currentUser.role,nama,jamMasuk,jamPulang,keterangan:ket});
    if(res.success){showToast("Shift berhasil ditambahkan!","success");renderMasterShift();}else showToast(res.message,"error");
  }catch(err){showToast("Error: "+err.message,"error");}finally{showLoading(false);}
}

async function simpanEditShift(id) {
  const nama=document.getElementById("sf-nama").value.trim();
  const jamMasuk=document.getElementById("sf-masuk").value;
  const jamPulang=document.getElementById("sf-pulang").value;
  const ket=document.getElementById("sf-ket").value.trim();
  if (!nama||!jamMasuk||!jamPulang) return showToast("Nama shift dan jam wajib diisi","error");
  showLoading(true);
  try {
    const res=await fetchAPI({action:"editShift",role:currentUser.role,id,nama,jamMasuk,jamPulang,keterangan:ket});
    if(res.success){showToast("Shift berhasil diperbarui!","success");renderMasterShift();}else showToast(res.message,"error");
  }catch(err){showToast("Error: "+err.message,"error");}finally{showLoading(false);}
}

async function hapusShift(id, nama) {
  if (!confirm(`Hapus shift "${nama}"?`)) return;
  showLoading(true);
  try {
    const res=await fetchAPI({action:"deleteShift",role:currentUser.role,id});
    if(res.success){showToast("Shift berhasil dihapus","success");renderMasterShift();}else showToast(res.message,"error");
  }catch(err){showToast("Error: "+err.message,"error");}finally{showLoading(false);}
}

// ============================================
// PAGE: RIWAYAT
// ============================================
async function renderRiwayat() {
  document.getElementById("content").innerHTML = `
    <div class="page-header"><h2><i class="fa-solid fa-clock-rotate-left"></i> Riwayat Absensi</h2></div>
    <div id="riwayat-list" class="card-list">
      <div class="loading-state"><i class="fa-solid fa-spinner fa-spin"></i> Memuat data...</div>
    </div>`;
  try {
    const res = await fetchAPI({ action: "getAbsensi", nama: currentUser.nama });
    const list = document.getElementById("riwayat-list");
    if (!res.success || !res.data || !res.data.length) {
      list.innerHTML = `<div class="empty-state"><i class="fa-solid fa-inbox"></i><p>Belum ada riwayat absensi</p></div>`;
      return;
    }
    const sorted = [...res.data].sort((a,b) => new Date(b.tanggal) - new Date(a.tanggal));
    list.innerHTML = sorted.map(item => {
      const lupaM = item.statusMasuk === "Lupa Absen Masuk";
      const lupaP = item.statusPulang === "Lupa Absen Pulang";
      const c = getShiftColor(item.shiftNama);
      const shiftBadge = item.shiftNama
        ? `<span class="shift-mini-badge" style="background:${c.bg};color:${c.text};">${item.shiftNama}</span>` : "";
      return `
        <div class="riwayat-card">
          <div class="riwayat-tanggal">
            <i class="fa-solid fa-calendar-day"></i> ${formatTanggal(item.tanggal)} ${shiftBadge}
            ${item.ketTelat?`<span class="ket-telat-mini">${getTelatIcon(item.ketTelat)} ${item.ketTelat}</span>`:""}
          </div>
          <div class="riwayat-rows">
            <div class="riwayat-row ${lupaM?'lupa':''}">
              <div class="riwayat-tipe masuk"><i class="fa-solid fa-right-to-bracket"></i> Masuk</div>
              <div class="riwayat-detail">
                ${lupaM?`<span class="badge-lupa">⚠️ Lupa Absen Masuk</span>`
                  :`<div class="riwayat-waktu">${formatWaktu(item.waktuMasuk)}</div>
                    ${item.latMasuk&&item.latMasuk!=="-"?`<a href="https://maps.google.com?q=${item.latMasuk},${item.lngMasuk}" target="_blank" class="riwayat-lokasi"><i class="fa-solid fa-location-dot"></i> Lihat Lokasi</a>`:`<span class="riwayat-lokasi muted">Lokasi tidak ada</span>`}
                    ${item.fotoMasuk&&item.fotoMasuk!=="-"?`<a href="${item.fotoMasuk}" target="_blank" class="riwayat-foto-link"><i class="fa-solid fa-image"></i> Foto</a>`:""}`}
              </div>
            </div>
            <div class="riwayat-row ${lupaP?'lupa':''}">
              <div class="riwayat-tipe pulang"><i class="fa-solid fa-right-from-bracket"></i> Pulang</div>
              <div class="riwayat-detail">
                ${lupaP?`<span class="badge-lupa">⚠️ Lupa Absen Pulang</span>`
                  :item.waktuPulang?`<div class="riwayat-waktu">${formatWaktu(item.waktuPulang)}</div>
                    ${item.latPulang&&item.latPulang!=="-"?`<a href="https://maps.google.com?q=${item.latPulang},${item.lngPulang}" target="_blank" class="riwayat-lokasi"><i class="fa-solid fa-location-dot"></i> Lihat Lokasi</a>`:`<span class="riwayat-lokasi muted">Lokasi tidak ada</span>`}
                    ${item.fotoPulang&&item.fotoPulang!=="-"?`<a href="${item.fotoPulang}" target="_blank" class="riwayat-foto-link"><i class="fa-solid fa-image"></i> Foto</a>`:""}`
                  :`<span style="color:#94a3b8;font-size:13px;">Belum absen pulang</span>`}
              </div>
            </div>
          </div>
        </div>`;
    }).join("");
  } catch(err) {
    document.getElementById("riwayat-list").innerHTML = `<div class="empty-state error"><i class="fa-solid fa-triangle-exclamation"></i><p>Gagal memuat data</p></div>`;
  }
}

// ============================================
// PAGE: PENGAJUAN, PROFIL, MONITORING, KELOLA USER, APPROVE
// (sama seperti sebelumnya)
// ============================================
async function renderPengajuan() {
  document.getElementById("content").innerHTML = `
    <div class="page-header"><h2><i class="fa-solid fa-file-alt"></i> Pengajuan Izin</h2></div>
    <div class="card">
      <h3>Buat Pengajuan Baru</h3>
      <div class="field"><label>Tipe Izin</label>
        <select id="tipeIzin"><option value="Sakit">Sakit</option><option value="Cuti">Cuti</option><option value="Izin Mendadak">Izin Mendadak</option><option value="Keperluan Keluarga">Keperluan Keluarga</option><option value="Lainnya">Lainnya</option></select></div>
      <div class="field"><label>Keterangan</label><textarea id="keteranganIzin" placeholder="Jelaskan alasan..." rows="3"></textarea></div>
      <div class="field"><label>Link Surat <span style="color:#64748b;font-weight:400;">(opsional)</span></label><input type="url" id="linkSurat" placeholder="https://drive.google.com/..."></div>
      <button onclick="submitPengajuan()" class="btn-primary full"><i class="fa-solid fa-paper-plane"></i> Kirim Pengajuan</button>
    </div>
    <div class="page-header" style="margin-top:8px;"><h2 style="font-size:16px;"><i class="fa-solid fa-list"></i> Riwayat Pengajuan</h2></div>
    <div id="pengajuan-list" class="card-list"><div class="loading-state"><i class="fa-solid fa-spinner fa-spin"></i> Memuat...</div></div>`;
  loadPengajuanList();
}

async function loadPengajuanList() {
  try {
    const res=await fetchAPI({action:"getPengajuan",nama:currentUser.nama,role:currentUser.role});
    const list=document.getElementById("pengajuan-list");
    if(!res.success||!res.data||!res.data.length){list.innerHTML=`<div class="empty-state"><i class="fa-solid fa-inbox"></i><p>Belum ada pengajuan</p></div>`;return;}
    list.innerHTML=res.data.map(item=>`
      <div class="pengajuan-card">
        <div class="pengajuan-header"><span class="pengajuan-tipe">${item.tipe}</span><span class="status-badge ${getStatusClass(item.status)}">${item.status}</span></div>
        <div class="pengajuan-ket">${item.keterangan||"-"}</div>
        <div class="pengajuan-footer"><small style="color:#64748b;"><i class="fa-solid fa-calendar"></i> ${formatDateTime(item.tglSubmit)}</small>${item.linkSurat?`<a href="${item.linkSurat}" target="_blank" class="btn-link"><i class="fa-solid fa-file-medical"></i> Lihat Surat</a>`:""}</div>
      </div>`).join("");
  }catch(err){document.getElementById("pengajuan-list").innerHTML=`<div class="empty-state error"><p>Gagal memuat data</p></div>`;}
}

async function submitPengajuan() {
  const tipe=document.getElementById("tipeIzin").value;
  const keterangan=document.getElementById("keteranganIzin").value.trim();
  const linkSurat=document.getElementById("linkSurat").value.trim();
  if(!keterangan) return showToast("Keterangan wajib diisi","error");
  showLoading(true);
  try{const res=await fetchAPI({action:"pengajuan",nama:currentUser.nama,tipe,keterangan,linkSurat});if(res.success){showToast("Pengajuan berhasil dikirim!","success");document.getElementById("keteranganIzin").value="";document.getElementById("linkSurat").value="";loadPengajuanList();}else showToast(res.message,"error");}
  catch(err){showToast("Error: "+err.message,"error");}finally{showLoading(false);}
}

function renderProfil() {
  document.getElementById("content").innerHTML = `
    <div class="page-header"><h2><i class="fa-solid fa-user-circle"></i> Profil Saya</h2></div>
    <div class="card profil-card">
      <div class="profil-avatar"><i class="fa-solid fa-user"></i></div>
      <div class="profil-info"><h3>${currentUser.nama}</h3><p>${currentUser.email}</p><span class="role-badge">${currentUser.role}</span></div>
    </div>
    <div class="card" style="margin-top:4px;">
      <h3><i class="fa-solid fa-lock"></i> Ganti Password</h3>
      <div class="field"><label>Password Lama</label><input type="password" id="oldPassword" placeholder="Password saat ini"></div>
      <div class="field"><label>Password Baru</label><input type="password" id="newPassword" placeholder="Minimal 6 karakter"></div>
      <div class="field"><label>Konfirmasi</label><input type="password" id="confirmPassword" placeholder="Ulangi password baru"></div>
      <button onclick="changePassword()" class="btn-primary full"><i class="fa-solid fa-save"></i> Simpan Password</button>
    </div>`;
}

async function changePassword() {
  const o=document.getElementById("oldPassword").value.trim();
  const n=document.getElementById("newPassword").value.trim();
  const c=document.getElementById("confirmPassword").value.trim();
  if(!o||!n||!c) return showToast("Semua field wajib diisi","error");
  if(n!==c)      return showToast("Password baru tidak cocok","error");
  if(n.length<6) return showToast("Password minimal 6 karakter","error");
  showLoading(true);
  try{const res=await fetchAPI({action:"changePassword",email:currentUser.email,oldPassword:o,newPassword:n});if(res.success){showToast("Password berhasil diubah!","success");["oldPassword","newPassword","confirmPassword"].forEach(id=>document.getElementById(id).value="");}else showToast(res.message,"error");}
  catch(err){showToast("Error: "+err.message,"error");}finally{showLoading(false);}
}

async function renderMonitoring() {
  if(currentUser.role!=="Admin") return navigateTo("absensi");
  document.getElementById("content").innerHTML=`
    <div class="page-header"><h2><i class="fa-solid fa-chart-line"></i> Monitoring Absensi</h2><p>Data kehadiran hari ini</p></div>
    <div id="monitor-stats" class="stats-grid"><div class="loading-state" style="grid-column:1/-1;"><i class="fa-solid fa-spinner fa-spin"></i> Memuat...</div></div>
    <div id="monitor-list" class="card-list"></div>`;
  try{
    const res=await fetchAPI({action:"getAbsensiHarian",role:currentUser.role});
    const hadir=res.data?res.data.length:0,total=res.totalStaff||0;
    document.getElementById("monitor-stats").innerHTML=`
      <div class="stat-card green"><div class="stat-icon"><i class="fa-solid fa-user-check"></i></div><div class="stat-val">${hadir}</div><div class="stat-label">Hadir</div></div>
      <div class="stat-card red"><div class="stat-icon"><i class="fa-solid fa-user-xmark"></i></div><div class="stat-val">${Math.max(0,total-hadir)}</div><div class="stat-label">Tidak Hadir</div></div>
      <div class="stat-card blue"><div class="stat-icon"><i class="fa-solid fa-users"></i></div><div class="stat-val">${total}</div><div class="stat-label">Total Staff</div></div>`;
    const list=document.getElementById("monitor-list");
    if(!res.data||!res.data.length){list.innerHTML=`<div class="empty-state"><i class="fa-solid fa-inbox"></i><p>Belum ada absensi hari ini</p></div>`;return;}
    list.innerHTML=`<p style="font-size:14px;font-weight:600;margin-bottom:10px;">Daftar Hadir Hari Ini</p>`+
      res.data.map((item,i)=>{const c=getShiftColor(item.shiftNama);return`
        <div class="absensi-card">
          <div class="absensi-card-left"><span class="absensi-num">${i+1}</span>${item.fotoMasuk&&item.fotoMasuk!=="-"?`<img src="${item.fotoMasuk}" class="absensi-foto">`:`<div class="absensi-foto-placeholder"><i class="fa-solid fa-user"></i></div>`}</div>
          <div class="absensi-card-body">
            <div class="absensi-nama">${item.nama}</div>
            ${item.shiftNama?`<span class="shift-mini-badge" style="background:${c.bg};color:${c.text};">${item.shiftNama}</span>`:""}
            <div class="absensi-waktu"><i class="fa-solid fa-right-to-bracket" style="color:#3b82f6;"></i> ${item.waktuMasuk?formatDateTime(item.waktuMasuk):"-"}</div>
            <div class="absensi-waktu"><i class="fa-solid fa-right-from-bracket" style="color:#f97316;"></i> ${item.waktuPulang?formatDateTime(item.waktuPulang):'<span style="color:#94a3b8;">Belum pulang</span>'}</div>
            ${item.ketTelat?`<div style="font-size:11px;color:#64748b;">${getTelatIcon(item.ketTelat)} ${item.ketTelat}</div>`:""}
          </div>
          <div class="absensi-badge ${item.waktuPulang?'success':'warning'}">${item.waktuPulang?'Lengkap':'Masuk'}</div>
        </div>`;}).join("");
  }catch(err){document.getElementById("monitor-stats").innerHTML=`<div class="empty-state error" style="grid-column:1/-1;"><p>Gagal memuat data</p></div>`;}
}

async function renderKelolaUser(){
  if(currentUser.role!=="Admin") return navigateTo("absensi");
  document.getElementById("content").innerHTML=`
    <div class="page-header-row"><h2><i class="fa-solid fa-users-cog"></i> Kelola User</h2><button onclick="showAddUserForm()" class="btn-primary btn-sm"><i class="fa-solid fa-plus"></i> Tambah</button></div>
    <div id="user-list"><div class="loading-state"><i class="fa-solid fa-spinner fa-spin"></i> Memuat...</div></div>`;
  loadUserList();
}

async function loadUserList(){
  try{const res=await fetchAPI({action:"getUsers",role:currentUser.role});const list=document.getElementById("user-list");if(!res.success||!res.data||!res.data.length){list.innerHTML=`<div class="empty-state"><i class="fa-solid fa-inbox"></i><p>Belum ada user</p></div>`;return;}
  list.innerHTML=res.data.map(user=>`<div class="user-card"><div class="user-avatar"><i class="fa-solid fa-user"></i></div><div class="user-info"><div class="user-nama">${user.nama}</div><div class="user-email">${user.email}</div><div style="display:flex;gap:6px;margin-top:4px;"><span class="role-badge">${user.role}</span><span class="status-badge ${user.status==='Aktif'?'success':'danger'}">${user.status}</span></div></div><div class="user-actions"><button onclick="openEditUser('${user.id}','${user.nama}','${user.email}','${user.role}','${user.status}')" class="btn-icon edit"><i class="fa-solid fa-pen"></i></button><button onclick="deleteUser('${user.id}','${user.nama}')" class="btn-icon delete"><i class="fa-solid fa-trash"></i></button></div></div>`).join("");}
  catch(err){document.getElementById("user-list").innerHTML=`<div class="empty-state error"><p>Gagal memuat data</p></div>`;}
}

function showAddUserForm(){document.getElementById("content").innerHTML=`<div class="page-header-row"><h2><button onclick="renderKelolaUser()" class="btn-back"><i class="fa-solid fa-arrow-left"></i></button> Tambah User</h2></div><div class="card"><div class="field"><label>Nama Lengkap</label><input type="text" id="add-nama" placeholder="Nama lengkap"></div><div class="field"><label>Email</label><input type="email" id="add-email" placeholder="email@perusahaan.com"></div><div class="field"><label>Password</label><input type="password" id="add-password" placeholder="Minimal 6 karakter"></div><div class="field"><label>Role</label><select id="add-role"><option value="Staff">Staff</option><option value="Admin">Admin</option></select></div><button onclick="addUser()" class="btn-primary full"><i class="fa-solid fa-plus"></i> Tambah User</button></div>`;}
async function addUser(){const nama=document.getElementById("add-nama").value.trim(),email=document.getElementById("add-email").value.trim(),password=document.getElementById("add-password").value.trim(),jabatan=document.getElementById("add-role").value;if(!nama||!email||!password) return showToast("Semua field wajib diisi","error");if(password.length<6) return showToast("Password minimal 6 karakter","error");showLoading(true);try{const res=await fetchAPI({action:"addUser",role:currentUser.role,nama,email,password,jabatan});if(res.success){showToast("User berhasil ditambahkan!","success");renderKelolaUser();}else showToast(res.message,"error");}catch(err){showToast("Error: "+err.message,"error");}finally{showLoading(false);}
}
function openEditUser(id,nama,email,jabatan,status){document.getElementById("edit-user-id").value=id;document.getElementById("edit-nama").value=nama;document.getElementById("edit-nip").value=email;document.getElementById("edit-jabatan").value=jabatan;document.getElementById("edit-status-user").value=status;document.getElementById("edit-password").value="";document.getElementById("modal-edit-user").classList.add("show");}
function closeModalEdit(){document.getElementById("modal-edit-user").classList.remove("show");}
async function saveEditUser(){const id=document.getElementById("edit-user-id").value,nama=document.getElementById("edit-nama").value.trim(),jabatan=document.getElementById("edit-jabatan").value,status=document.getElementById("edit-status-user").value,password=document.getElementById("edit-password").value.trim();showLoading(true);try{const res=await fetchAPI({action:"editUser",role:currentUser.role,id,nama,jabatan,status,password});if(res.success){showToast("User berhasil diperbarui!","success");closeModalEdit();loadUserList();}else showToast(res.message,"error");}catch(err){showToast("Error: "+err.message,"error");}finally{showLoading(false);}
}
async function deleteUser(id,nama){if(!confirm(`Hapus user "${nama}"?`)) return;showLoading(true);try{const res=await fetchAPI({action:"deleteUser",role:currentUser.role,id});if(res.success){showToast("User berhasil dihapus","success");loadUserList();}else showToast(res.message,"error");}catch(err){showToast("Error: "+err.message,"error");}finally{showLoading(false);}
}

async function renderApprovePengajuan(){
  if(currentUser.role!=="Admin") return navigateTo("absensi");
  document.getElementById("content").innerHTML=`<div class="page-header"><h2><i class="fa-solid fa-check-circle"></i> Approve Pengajuan</h2></div><div id="approve-list" class="card-list"><div class="loading-state"><i class="fa-solid fa-spinner fa-spin"></i> Memuat...</div></div>`;
  try{const res=await fetchAPI({action:"getPengajuan",role:currentUser.role,nama:""});const list=document.getElementById("approve-list");if(!res.success||!res.data||!res.data.length){list.innerHTML=`<div class="empty-state"><i class="fa-solid fa-inbox"></i><p>Tidak ada pengajuan</p></div>`;return;}
  list.innerHTML=res.data.map(item=>`<div class="pengajuan-card"><div class="pengajuan-header"><div><div style="font-size:13px;color:#64748b;margin-bottom:2px;">${item.nama}</div><span class="pengajuan-tipe">${item.tipe}</span></div><span class="status-badge ${getStatusClass(item.status)}">${item.status}</span></div><div class="pengajuan-ket">${item.keterangan||"-"}</div><div class="pengajuan-footer"><small style="color:#64748b;"><i class="fa-solid fa-calendar"></i> ${formatDateTime(item.tglSubmit)}</small>${item.linkSurat?`<a href="${item.linkSurat}" target="_blank" class="btn-link"><i class="fa-solid fa-file-medical"></i> Lihat Surat</a>`:""}</div>${item.status==="Menunggu"?`<div class="approve-actions"><button onclick="approvePengajuan('${item.id}','Disetujui')" class="btn-approve"><i class="fa-solid fa-check"></i> Setujui</button><button onclick="approvePengajuan('${item.id}','Ditolak')" class="btn-reject"><i class="fa-solid fa-xmark"></i> Tolak</button></div>`:""}</div>`).join("");}
  catch(err){document.getElementById("approve-list").innerHTML=`<div class="empty-state error"><p>Gagal memuat data</p></div>`;}
}

async function approvePengajuan(id,status){
  if(!confirm(`Yakin ingin ${status==="Disetujui"?"menyetujui":"menolak"} pengajuan ini?`)) return;
  showLoading(true);try{const res=await fetchAPI({action:"approvePengajuan",role:currentUser.role,id,status});if(res.success){showToast(`Pengajuan berhasil ${status.toLowerCase()}!`,"success");renderApprovePengajuan();}else showToast(res.message,"error");}catch(err){showToast("Error: "+err.message,"error");}finally{showLoading(false);}
}

// ============================================
// SIDEBAR TOGGLE
// ============================================
function toggleSidebar(){document.getElementById("sidebar").classList.toggle("open");document.getElementById("overlay").classList.toggle("show");}
function closeSidebar(){document.getElementById("sidebar").classList.remove("open");document.getElementById("overlay").classList.remove("show");}

// ============================================
// FETCH API
// ============================================
async function fetchAPI(params, postData=null) {
  if (postData) {
    const res=await fetch(API_URL,{method:"POST",headers:{"Content-Type":"text/plain;charset=utf-8"},body:JSON.stringify({...params,...postData})});
    if(!res.ok) throw new Error("HTTP "+res.status);
    return res.json();
  }
  const url=new URL(API_URL);
  Object.entries(params).forEach(([k,v])=>url.searchParams.append(k,v));
  const res=await fetch(url.toString());
  if(!res.ok) throw new Error("HTTP "+res.status);
  return res.json();
}

// ============================================
// HELPERS
// ============================================
function showLoading(show){document.getElementById("loading-overlay").style.display=show?"flex":"none";}
function showToast(message,type="info"){
  const c=document.getElementById("toast-container"),t=document.createElement("div");
  t.className=`toast toast-${type}`;
  const icons={success:"fa-check-circle",error:"fa-circle-exclamation",info:"fa-circle-info"};
  t.innerHTML=`<i class="fa-solid ${icons[type]||icons.info}"></i> ${message}`;
  c.appendChild(t);setTimeout(()=>t.classList.add("show"),10);
  setTimeout(()=>{t.classList.remove("show");setTimeout(()=>t.remove(),400);},3500);
}
function formatDateTime(dt){if(!dt)return"-";const d=new Date(dt);if(isNaN(d))return dt;return d.toLocaleDateString("id-ID",{day:"2-digit",month:"long",year:"numeric"})+" "+d.toLocaleTimeString("id-ID",{hour:"2-digit",minute:"2-digit"});}
function formatTanggal(tgl){if(!tgl)return"-";const d=new Date(tgl+"T00:00:00");if(isNaN(d))return tgl;return d.toLocaleDateString("id-ID",{weekday:"long",day:"2-digit",month:"long",year:"numeric"});}
function formatWaktu(dt){if(!dt)return"-";const d=new Date(dt);if(isNaN(d))return dt;return d.toLocaleTimeString("id-ID",{hour:"2-digit",minute:"2-digit"});}
function getStatusClass(s){if(!s)return"warning";const l=s.toLowerCase();if(l==="disetujui")return"success";if(l==="ditolak")return"danger";return"warning";}
function getHariPendek(tgl){return["Min","Sen","Sel","Rab","Kam","Jum","Sab"][new Date(tgl+"T00:00:00").getDay()];}
function getNamaBulan(mo){return["","Januari","Februari","Maret","April","Mei","Juni","Juli","Agustus","September","Oktober","November","Desember"][mo];}
function getShiftColor(nama){
  if(!nama)return{bg:"#f1f5f9",text:"#64748b"};
  const n=nama.toLowerCase();
  if(n.includes("pagi")) return{bg:"#dbeafe",text:"#1d4ed8"};
  if(n.includes("sore")) return{bg:"#ffedd5",text:"#c2410c"};
  if(n.includes("malam"))return{bg:"#ede9fe",text:"#6d28d9"};
  return{bg:"#dcfce7",text:"#15803d"};
}
