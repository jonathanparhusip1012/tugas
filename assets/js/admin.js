/**
 * Koteshu Indonesia — Panel Admin
 * File: assets/js/admin.js
 *
 * Halaman ini tidak ditautkan dari situs publik. Perlindungan sebenarnya ada di
 * Supabase: login (Auth) + kebijakan RLS select/delete hanya untuk role authenticated.
 */

import { SUPABASE_URL, SUPABASE_ANON_KEY, TABEL_KLAIM, supabaseSiap } from "./config.js";

const CDN_SUPABASE = "https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.119.0/+esm";
const BATAS_BARIS = 500;

const el = {
    loginView: document.getElementById("loginView"),
    dashboardView: document.getElementById("dashboardView"),
    loginForm: document.getElementById("loginForm"),
    loginStatus: document.getElementById("loginStatus"),
    loginSubmit: document.getElementById("loginSubmit"),
    email: document.getElementById("email"),
    password: document.getElementById("password"),

    userEmail: document.getElementById("userEmail"),
    logoutBtn: document.getElementById("logoutBtn"),
    refreshBtn: document.getElementById("refreshBtn"),

    adminStatus: document.getElementById("adminStatus"),
    searchInput: document.getElementById("searchInput"),
    filterMetode: document.getElementById("filterMetode"),
    exportBtn: document.getElementById("exportBtn"),

    dataBody: document.getElementById("dataBody"),
    tableInfo: document.getElementById("tableInfo"),

    statTotal: document.getElementById("statTotal"),
    statToday: document.getElementById("statToday"),
    statTodayDate: document.getElementById("statTodayDate"),
    statGps: document.getElementById("statGps"),
    statIp: document.getElementById("statIp")
};

const state = {
    semua: [],
    tampil: [],
    total: 0,
    user: null
};

let clientSupabase = null;
let userIdTerakhir = null;
let sedangLogin = false;

/* ==================================================================
   1. Supabase client
   ================================================================== */
async function dapatkanClient() {
    if (clientSupabase) return clientSupabase;
    if (!supabaseSiap) {
        throw new Error(
            "Supabase belum dikonfigurasi. Isi SUPABASE_URL dan SUPABASE_ANON_KEY di assets/js/config.js."
        );
    }

    const { createClient } = await import(CDN_SUPABASE);
    clientSupabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
        auth: { persistSession: true, autoRefreshToken: true }
    });
    return clientSupabase;
}

/* ==================================================================
   2. Helper tampilan
   ================================================================== */
function setStatus(target, tipe, pesan) {
    if (!target) return;
    target.className = (target.classList.contains("admin-status") ? "admin-status" : "status") +
        " is-visible " + (target.classList.contains("admin-status") ? "admin-status--" : "status--") + tipe;
    target.textContent = pesan;
}

function sembunyikanStatus(target) {
    if (!target) return;
    target.className = target.classList.contains("admin-status") ? "admin-status" : "status";
    target.textContent = "";
}

function formatTanggal(nilai) {
    const tanggal = new Date(nilai);
    if (Number.isNaN(tanggal.getTime())) return { utama: "—", kecil: "" };

    const utama = new Intl.DateTimeFormat("id-ID", {
        day: "2-digit", month: "short", year: "numeric"
    }).format(tanggal);

    const kecil = new Intl.DateTimeFormat("id-ID", {
        hour: "2-digit", minute: "2-digit"
    }).format(tanggal).replace(".", ":");

    return { utama, kecil };
}

function formatNomor(nomor) {
    if (!nomor) return "—";
    const bersih = String(nomor).replace(/\D/g, "");
    if (bersih.length < 9) return String(nomor);

    const tanpaNol = bersih.startsWith("62") ? bersih.slice(2) : bersih.replace(/^0/, "");
    return "+62 " + tanpaNol.slice(0, 3) + "-" + tanpaNol.slice(3, 7) + "-" + tanpaNol.slice(7);
}

function buatBadgeMetode(metode) {
    const label = { GPS: "GPS", IP: "IP", TIDAK_TERSEDIA: "Tanpa lokasi" }[metode] || metode || "—";
    const warna = metode === "GPS" ? "gps" : metode === "IP" ? "ip" : "none";
    const span = document.createElement("span");
    span.className = "badge badge--" + warna;
    span.textContent = label;
    return span;
}

/* ==================================================================
   3. Login / logout
   ================================================================== */
function tampilkanLogin() {
    el.loginView.hidden = false;
    el.dashboardView.hidden = true;
    state.user = null;
    state.semua = [];
    state.tampil = [];
}

function tampilkanDashboard(user) {
    state.user = user;
    el.loginView.hidden = true;
    el.dashboardView.hidden = false;
    if (el.userEmail) el.userEmail.textContent = user?.email || "admin";
    muatData();
}

function terjemahkanErrorLogin(pesan) {
    if (/invalid login credentials/i.test(pesan)) return "Email atau password salah.";
    if (/email not confirmed/i.test(pesan)) return "Email belum dikonfirmasi. Cek kotak masuk Anda.";
    if (/rate limit|too many/i.test(pesan)) return "Terlalu banyak percobaan. Coba lagi beberapa menit lagi.";
    return pesan;
}

async function prosesLogin(event) {
    event.preventDefault();
    if (sedangLogin) return;

    sembunyikanStatus(el.loginStatus);

    const email = (el.email?.value || "").trim();
    const password = el.password?.value || "";

    if (!email || !password) {
        setStatus(el.loginStatus, "error", "Email dan password wajib diisi.");
        return;
    }

    sedangLogin = true;
    el.loginSubmit.disabled = true;
    el.loginSubmit.textContent = "Memeriksa…";

    try {
        const supabase = await dapatkanClient();
        const { data, error } = await supabase.auth.signInWithPassword({ email, password });

        if (error) throw new Error(terjemahkanErrorLogin(error.message));

        el.loginForm.reset();
        tampilkanDashboard(data.user);
    } catch (error) {
        console.error("[Admin] Login gagal:", error);
        setStatus(el.loginStatus, "error", error.message);
    } finally {
        sedangLogin = false;
        el.loginSubmit.disabled = false;
        el.loginSubmit.textContent = "Masuk";
    }
}

async function prosesLogout() {
    try {
        const supabase = await dapatkanClient();
        await supabase.auth.signOut();
    } catch (error) {
        console.error("[Admin] Logout gagal:", error);
    }
    tampilkanLogin();
    sembunyikanStatus(el.adminStatus);
}

/* ==================================================================
   4. Ambil & render data
   ================================================================== */
function renderSkeleton() {
    const frag = document.createDocumentFragment();
    for (let i = 0; i < 5; i++) {
        const tr = document.createElement("tr");
        tr.className = "skeleton-row";
        const td = document.createElement("td");
        td.colSpan = 7;
        td.textContent = "Memuat…";
        tr.appendChild(td);
        frag.appendChild(tr);
    }
    el.dataBody.replaceChildren(frag);
}

function renderStatistik() {
    const data = state.semua;
    const hariIni = new Date().toDateString();

    const jumlahHariIni = data.filter((row) => new Date(row.tanggal).toDateString() === hariIni).length;
    const jumlahGps = data.filter((row) => row.metode === "GPS").length;
    const jumlahIp = data.filter((row) => row.metode !== "GPS").length;

    if (el.statTotal) el.statTotal.textContent = String(state.total || data.length);
    if (el.statToday) el.statToday.textContent = String(jumlahHariIni);
    if (el.statGps) el.statGps.textContent = String(jumlahGps);
    if (el.statIp) el.statIp.textContent = String(jumlahIp);

    if (el.statTodayDate) {
        el.statTodayDate.textContent = new Intl.DateTimeFormat("id-ID", {
            weekday: "long", day: "numeric", month: "long"
        }).format(new Date());
    }
}

function renderTabel(baris) {
    if (!el.dataBody) return;

    if (!baris.length) {
        const tr = document.createElement("tr");
        const td = document.createElement("td");
        td.colSpan = 7;
        td.className = "empty-row";
        td.innerHTML =
            "<strong>Tidak ada data yang cocok.</strong>" +
            "Coba ubah kata kunci pencarian, filter metode, atau muat ulang.";
        tr.appendChild(td);
        el.dataBody.replaceChildren(tr);
        return;
    }

    const frag = document.createDocumentFragment();

    baris.forEach((row) => {
        const tr = document.createElement("tr");

        // Tanggal
        const tanggal = formatTanggal(row.tanggal);
        const tdTanggal = document.createElement("td");
        const bTanggal = document.createElement("span");
        bTanggal.className = "cell-strong";
        bTanggal.textContent = tanggal.utama;
        const sJam = document.createElement("span");
        sJam.className = "cell-muted";
        sJam.textContent = tanggal.kecil + " waktu lokal";
        tdTanggal.append(bTanggal, sJam);

        // Pengunjung
        const tdOrang = document.createElement("td");
        const bNama = document.createElement("span");
        bNama.className = "cell-strong";
        bNama.textContent = row.nama || "Tanpa nama";
        const sNomor = document.createElement("span");
        sNomor.className = "cell-muted";
        sNomor.textContent = formatNomor(row.whatsapp);
        tdOrang.append(bNama, sNomor);

        // Metode
        const tdMetode = document.createElement("td");
        tdMetode.appendChild(buatBadgeMetode(row.metode));

        // Lokasi
        const tdLokasi = document.createElement("td");
        if (typeof row.latitude === "number" && typeof row.longitude === "number") {
            const tautan = document.createElement("a");
            tautan.className = "map-link";
            tautan.href = `https://www.google.com/maps?q=${row.latitude},${row.longitude}`;
            tautan.target = "_blank";
            tautan.rel = "noopener";
            tautan.textContent = "Buka peta";
            const koordinat = document.createElement("span");
            koordinat.className = "cell-muted mono";
            koordinat.textContent = `${row.latitude}, ${row.longitude}`;
            tdLokasi.append(tautan, koordinat);

            if (row.akurasi) {
                const akurasi = document.createElement("span");
                akurasi.className = "cell-muted";
                akurasi.textContent = `akurasi ±${row.akurasi} m`;
                tdLokasi.appendChild(akurasi);
            }
        } else {
            const teks = document.createElement("span");
            teks.className = "mono";
            teks.textContent = row.gps_ip || "—";
            tdLokasi.appendChild(teks);
        }

        // Kota / provider
        const tdKota = document.createElement("td");
        const namaKota = document.createElement("span");
        namaKota.className = "cell-strong";
        namaKota.textContent = row.kota || "—";
        tdKota.appendChild(namaKota);
        if (row.provider) {
            const provider = document.createElement("span");
            provider.className = "cell-muted";
            provider.textContent = row.provider;
            tdKota.appendChild(provider);
        }

        // Kode voucher
        const tdKode = document.createElement("td");
        const chip = document.createElement("span");
        chip.className = "code-chip";
        chip.textContent = row.kode_voucher || "—";
        tdKode.appendChild(chip);

        // Aksi
        const tdAksi = document.createElement("td");
        const hapus = document.createElement("button");
        hapus.type = "button";
        hapus.className = "row-delete";
        hapus.dataset.id = row.id;
        hapus.dataset.kode = row.kode_voucher || "";
        hapus.setAttribute("aria-label", `Hapus klaim ${row.kode_voucher || ""}`);
        hapus.title = "Hapus baris";
        hapus.innerHTML = '<svg class="icon" width="16" height="16" aria-hidden="true"><use href="#i-trash"></use></svg>';
        tdAksi.appendChild(hapus);

        tr.append(tdTanggal, tdOrang, tdMetode, tdLokasi, tdKota, tdKode, tdAksi);
        frag.appendChild(tr);
    });

    el.dataBody.replaceChildren(frag);
}

function renderInfo() {
    if (!el.tableInfo) return;
    el.tableInfo.textContent =
        `Menampilkan ${state.tampil.length} dari ${state.semua.length} baris yang dimuat ` +
        `(total di database: ${state.total}).`;
}

/* ==================================================================
   5. Filter & pencarian
   ================================================================== */
function terapkanFilter() {
    const kata = (el.searchInput?.value || "").trim().toLowerCase();
    const metode = el.filterMetode?.value || "semua";

    state.tampil = state.semua.filter((row) => {
        if (metode !== "semua" && row.metode !== metode) return false;
        if (!kata) return true;

        return [
            row.nama, row.whatsapp, row.kode_voucher, row.kota, row.provider,
            row.ip_address, row.gps_ip, row.metode
        ].some((nilai) => String(nilai || "").toLowerCase().includes(kata));
    });

    renderTabel(state.tampil);
    renderInfo();
}

/* ==================================================================
   6. Muat ulang data
   ================================================================== */
async function muatData() {
    if (!el.dataBody) return;

    sembunyikanStatus(el.adminStatus);
    renderSkeleton();

    try {
        const supabase = await dapatkanClient();
        const { data, error, count } = await supabase
            .from(TABEL_KLAIM)
            .select("*", { count: "exact" })
            .order("tanggal", { ascending: false })
            .limit(BATAS_BARIS);

        if (error) throw new Error(error.message);

        state.semua = Array.isArray(data) ? data : [];
        state.total = typeof count === "number" ? count : state.semua.length;

        renderStatistik();
        terapkanFilter();

        setStatus(el.adminStatus, "success", `Data berhasil dimuat: ${state.semua.length} baris.`);
        setTimeout(() => sembunyikanStatus(el.adminStatus), 3500);
    } catch (error) {
        console.error("[Admin] Gagal memuat data:", error);
        setStatus(
            el.adminStatus,
            "error",
            "Gagal memuat data: " + error.message +
            " Pastikan policy SELECT untuk role authenticated sudah dibuat (supabase/admin_rls.sql)."
        );

        const tr = document.createElement("tr");
        const td = document.createElement("td");
        td.colSpan = 7;
        td.className = "empty-row";
        td.innerHTML = "<strong>Data tidak dapat dimuat.</strong>Periksa pesan error di atas.";
        tr.appendChild(td);
        el.dataBody.replaceChildren(tr);
    }
}

/* ==================================================================
   7. Hapus satu baris
   ================================================================== */
async function hapusBaris(id, kode) {
    if (!id) return;
    if (!window.confirm(`Hapus klaim ${kode || "ini"}? Tindakan ini tidak bisa dibatalkan.`)) return;

    try {
        const supabase = await dapatkanClient();
        const { error } = await supabase.from(TABEL_KLAIM).delete().eq("id", id);
        if (error) throw new Error(error.message);

        state.semua = state.semua.filter((row) => row.id !== id);
        state.total = Math.max(0, state.total - 1);

        renderStatistik();
        terapkanFilter();
        setStatus(el.adminStatus, "success", `Klaim ${kode || ""} dihapus.`);
    } catch (error) {
        console.error("[Admin] Gagal menghapus:", error);
        setStatus(el.adminStatus, "error", "Gagal menghapus data: " + error.message);
    }
}

/* ==================================================================
   8. Ekspor CSV
   ================================================================== */
function unduhCSV() {
    if (!state.tampil.length) {
        setStatus(el.adminStatus, "info", "Tidak ada data untuk diekspor.");
        return;
    }

    const kolom = [
        "tanggal", "nama", "whatsapp", "metode", "gps_ip", "latitude", "longitude",
        "akurasi", "ip_address", "kota", "provider", "kode_voucher", "persetujuan", "user_agent"
    ];

    const escape = (nilai) => {
        if (nilai === null || nilai === undefined) return "";
        const teks = String(nilai).replace(/"/g, '""');
        return /[",\n;]/.test(teks) ? `"${teks}"` : teks;
    };

    const baris = [kolom.join(",")];
    state.tampil.forEach((row) => {
        baris.push(kolom.map((k) => escape(row[k])).join(","));
    });

    const blob = new Blob(["\uFEFF" + baris.join("\r\n")], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const tautan = document.createElement("a");
    const tanggal = new Date().toISOString().slice(0, 10);

    tautan.href = url;
    tautan.download = `klaim-koteshu-${tanggal}.csv`;
    document.body.appendChild(tautan);
    tautan.click();
    tautan.remove();
    URL.revokeObjectURL(url);

    setStatus(el.adminStatus, "success", `CSV berisi ${state.tampil.length} baris diunduh.`);
}

/* ==================================================================
   9. Inisialisasi
   ================================================================== */
async function inisialisasi() {
    if (el.loginForm) el.loginForm.addEventListener("submit", prosesLogin);
    if (el.logoutBtn) el.logoutBtn.addEventListener("click", prosesLogout);
    if (el.refreshBtn) el.refreshBtn.addEventListener("click", muatData);
    if (el.exportBtn) el.exportBtn.addEventListener("click", unduhCSV);
    if (el.searchInput) el.searchInput.addEventListener("input", terapkanFilter);
    if (el.filterMetode) el.filterMetode.addEventListener("change", terapkanFilter);

    if (el.dataBody) {
        el.dataBody.addEventListener("click", (event) => {
            const tombol = event.target.closest(".row-delete");
            if (!tombol) return;
            hapusBaris(tombol.dataset.id, tombol.dataset.kode);
        });
    }

    try {
        const supabase = await dapatkanClient();

        // Sesi tersimpan (refresh browser) → langsung ke dashboard
        const { data } = await supabase.auth.getSession();
        userIdTerakhir = data.session?.user?.id ?? null;

        if (data.session?.user) tampilkanDashboard(data.session.user);
        else tampilkanLogin();

        // Reaksi terhadap login/logout dari tab lain atau sesi kedaluwarsa
        supabase.auth.onAuthStateChange((_event, session) => {
            const id = session?.user?.id ?? null;
            if (id === userIdTerakhir) return;
            userIdTerakhir = id;

            if (session?.user) tampilkanDashboard(session.user);
            else {
                tampilkanLogin();
                sembunyikanStatus(el.adminStatus);
            }
        });
    } catch (error) {
        console.error("[Admin] Inisialisasi gagal:", error);
        tampilkanLogin();
        setStatus(el.loginStatus, "error", error.message);
        if (el.loginSubmit) el.loginSubmit.disabled = true;
    }
}

inisialisasi();
