/**
 * Koteshu Indonesia — halaman promo
 * File: assets/js/promo.js
 *
 * Alur klaim:
 *   1. Pengunjung mengisi nama + WhatsApp dan mencentang persetujuan.
 *   2. Browser meminta izin lokasi (GPS). Bila ditolak, dipakai perkiraan dari IP.
 *   3. Satu baris disimpan ke Supabase: tanggal, gps_ip, metode, koordinat, dll.
 *   4. Kode voucher dikembalikan ke pengunjung.
 */

import { SUPABASE_URL, SUPABASE_ANON_KEY, TABEL_KLAIM, supabaseSiap } from "./config.js";

const CDN_SUPABASE = "https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm";
const GPS_TIMEOUT = 9000;
const IP_TIMEOUT = 6000;

const el = {
    form: document.getElementById("claimForm"),
    submit: document.getElementById("claimSubmit"),
    status: document.getElementById("claimStatus"),
    voucher: document.getElementById("voucherBox"),
    voucherCode: document.getElementById("voucherCode"),
    copyBtn: document.getElementById("copyCode"),
    nama: document.getElementById("nama"),
    whatsapp: document.getElementById("whatsapp"),
    consent: document.getElementById("consent"),
    countdown: {
        hari: document.getElementById("cdHari"),
        jam: document.getElementById("cdJam"),
        menit: document.getElementById("cdMenit"),
        detik: document.getElementById("cdDetik")
    },
    year: document.getElementById("year")
};

let clientSupabase = null;
let sedangKirim = false;

/* ==================================================================
   1. Hitung mundur sampai tengah malam
   ================================================================== */
function mulaiHitungMundur() {
    const { hari, jam, menit, detik } = el.countdown;
    if (!hari || !jam || !menit || !detik) return;

    const tick = () => {
        const sekarang = new Date();
        const tengahMalam = new Date(sekarang);
        tengahMalam.setHours(24, 0, 0, 0);

        let sisa = Math.max(0, Math.floor((tengahMalam - sekarang) / 1000));
        const d = Math.floor(sisa / 86400); sisa %= 86400;
        const h = Math.floor(sisa / 3600); sisa %= 3600;
        const m = Math.floor(sisa / 60);
        const s = sisa % 60;

        hari.textContent = String(d).padStart(2, "0");
        jam.textContent = String(h).padStart(2, "0");
        menit.textContent = String(m).padStart(2, "0");
        detik.textContent = String(s).padStart(2, "0");
    };

    tick();
    setInterval(tick, 1000);
}

/* ==================================================================
   2. Helper status
   ================================================================== */
function tampilkanStatus(tipe, pesan, memuat = false) {
    if (!el.status) return;

    el.status.className = "status is-visible status--" + tipe;
    el.status.replaceChildren();

    if (memuat) {
        const spinner = document.createElement("span");
        spinner.className = "spinner";
        spinner.setAttribute("aria-hidden", "true");
        el.status.appendChild(spinner);
    }

    const teks = document.createElement("span");
    teks.textContent = pesan;
    el.status.appendChild(teks);

    if (memuat) {
        el.status.setAttribute("role", "status");
        el.status.setAttribute("aria-live", "polite");
    } else {
        el.status.setAttribute("role", tipe === "error" ? "alert" : "status");
        el.status.setAttribute("aria-live", tipe === "error" ? "assertive" : "polite");
    }
}

function sembunyikanStatus() {
    if (el.status) el.status.className = "status";
}

function kunciForm(kunci) {
    if (!el.submit) return;
    el.submit.disabled = kunci;
    el.submit.textContent = kunci ? "Memproses klaim…" : "Klaim Voucher 50%";
}

/* ==================================================================
   3. Validasi input
   ================================================================== */
function normalisasiNomor(nilai) {
    const digit = nilai.replace(/[^\d+]/g, "");
    if (digit.startsWith("+62")) return digit.slice(3);
    if (digit.startsWith("62")) return digit.slice(2);
    if (digit.startsWith("0")) return digit.slice(1);
    return digit;
}

function validasiForm() {
    const nama = (el.nama?.value || "").trim();
    const nomor = normalisasiNomor(el.whatsapp?.value || "");

    if (nama.length < 2) {
        return { valid: false, pesan: "Nama minimal 2 karakter." };
    }
    if (!/^8\d{8,12}$/.test(nomor)) {
        return { valid: false, pesan: "Nomor WhatsApp tidak valid. Contoh: 0812-3456-7890." };
    }
    if (!el.consent?.checked) {
        return { valid: false, pesan: "Centang persetujuan penyimpanan data terlebih dahulu." };
    }

    return { valid: true, nama, nomor };
}

/* ==================================================================
   4. Ambil lokasi: GPS, lalu fallback ke IP
   ================================================================== */
function ambilGPS() {
    return new Promise((resolve) => {
        if (!navigator.geolocation) return resolve(null);

        let selesai = false;
        const selesaiSekali = (nilai) => {
            if (selesai) return;
            selesai = true;
            resolve(nilai);
        };

        const batas = setTimeout(() => selesaiSekali(null), GPS_TIMEOUT);

        navigator.geolocation.getCurrentPosition(
            (pos) => {
                clearTimeout(batas);
                selesaiSekali({
                    latitude: Number(pos.coords.latitude.toFixed(6)),
                    longitude: Number(pos.coords.longitude.toFixed(6)),
                    akurasi: Math.round(pos.coords.accuracy)
                });
            },
            () => {
                clearTimeout(batas);
                selesaiSekali(null);
            },
            { enableHighAccuracy: true, timeout: GPS_TIMEOUT, maximumAge: 0 }
        );
    });
}

async function ambilLokasiIP() {
    const endpoint = ["https://ipapi.co/json/", "https://ipwho.is/"];

    for (const url of endpoint) {
        const kontrol = new AbortController();
        const batas = setTimeout(() => kontrol.abort(), IP_TIMEOUT);

        try {
            const res = await fetch(url, { signal: kontrol.signal, headers: { Accept: "application/json" } });
            if (!res.ok) throw new Error("HTTP " + res.status);
            const data = await res.json();

            const ip = data.ip || data.query || null;
            if (!ip) throw new Error("IP kosong");

            return {
                ip,
                kota: data.city || data.kota || null,
                wilayah: data.region || data.region_code || null,
                provider: data.org || data.connection?.isp || null,
                latitude: typeof data.latitude === "number" ? data.latitude : null,
                longitude: typeof data.longitude === "number" ? data.longitude : null
            };
        } catch (error) {
            console.warn("[Koteshu] Gagal mengambil lokasi IP dari", url, error.message);
        } finally {
            clearTimeout(batas);
        }
    }

    return null;
}

/* ==================================================================
   5. Supabase
   ================================================================== */
async function dapatkanClient() {
    if (clientSupabase) return clientSupabase;
    if (!supabaseSiap) {
        throw new Error(
            "Supabase belum dikonfigurasi. Buka assets/js/config.js dan isi SUPABASE_URL serta SUPABASE_ANON_KEY."
        );
    }

    const { createClient } = await import(CDN_SUPABASE);
    clientSupabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
        auth: { persistSession: false }
    });
    return clientSupabase;
}

function buatKodeVoucher() {
    const acak = new Uint8Array(3);
    crypto.getRandomValues(acak);
    const hex = Array.from(acak, (b) => b.toString(16).padStart(2, "0")).join("");
    return "KTX-" + hex.toUpperCase();
}

/* ==================================================================
   6. Alur klaim
   ================================================================== */
async function prosesKlaim(event) {
    event?.preventDefault();
    if (sedangKirim) return;

    sembunyikanStatus();
    if (el.voucher) el.voucher.classList.remove("is-visible");

    const validasi = validasiForm();
    if (!validasi.valid) {
        tampilkanStatus("error", validasi.pesan);
        (validasi.pesan.includes("Nama") ? el.nama : el.whatsapp)?.focus();
        return;
    }

    sedangKirim = true;
    kunciForm(true);

    try {
        // --- Langkah 1: lokasi GPS ---
        tampilkanStatus("info", "Meminta izin lokasi ke browser…", true);
        const gps = await ambilGPS();

        let metode = "GPS";
        let gpsIp = "";
        let latitude = null;
        let longitude = null;
        let akurasi = null;
        let ipAddress = null;
        let kota = null;
        let provider = null;

        if (gps) {
            latitude = gps.latitude;
            longitude = gps.longitude;
            akurasi = gps.akurasi;
            gpsIp = `${gps.latitude}, ${gps.longitude}`;
            tampilkanStatus("info", "Lokasi GPS berhasil dibaca. Menyimpan data…", true);
        } else {
            // --- Langkah 2: fallback lokasi perkiraan dari IP ---
            tampilkanStatus("info", "Izin lokasi tidak diberikan. Mengambil perkiraan lokasi dari IP…", true);
            const dataIp = await ambilLokasiIP();

            if (dataIp) {
                metode = "IP";
                ipAddress = dataIp.ip;
                kota = dataIp.kota;
                provider = dataIp.provider;
                latitude = dataIp.latitude;
                longitude = dataIp.longitude;
                gpsIp = dataIp.latitude !== null && dataIp.longitude !== null
                    ? `${dataIp.latitude}, ${dataIp.longitude}`
                    : dataIp.ip;
            } else {
                metode = "TIDAK_TERSEDIA";
                gpsIp = "tidak tersedia";
            }
        }

        // --- Langkah 3: simpan ke Supabase ---
        const kode = buatKodeVoucher();
        const supabase = await dapatkanClient();

        const payload = {
            tanggal: new Date().toISOString(),
            gps_ip: gpsIp,
            metode,
            latitude,
            longitude,
            akurasi,
            ip_address: ipAddress,
            kota,
            provider,
            nama: validasi.nama,
            whatsapp: validasi.nomor,
            kode_voucher: kode,
            persetujuan: true,
            user_agent: (navigator.userAgent || "").slice(0, 250)
        };

        const { error } = await supabase.from(TABEL_KLAIM).insert(payload);

        if (error) throw new Error(error.message);

        // --- Langkah 4: tampilkan voucher ---
        tampilkanStatus("success", "Voucher berhasil disimpan. Tunjukkan kode di bawah ke barista.");
        if (el.voucherCode) el.voucherCode.textContent = kode;
        if (el.voucher) {
            el.voucher.classList.add("is-visible");
            el.voucher.scrollIntoView({ behavior: "smooth", block: "nearest" });
        }

        el.form?.reset();
    } catch (error) {
        console.error("[Koteshu] Klaim gagal:", error);
        tampilkanStatus(
            "error",
            "Klaim gagal disimpan: " + error.message + " Silakan coba lagi atau hubungi barista kami."
        );
    } finally {
        sedangKirim = false;
        kunciForm(false);
    }
}

/* ==================================================================
   7. Salin kode voucher
   ================================================================== */
async function salinKode() {
    const kode = el.voucherCode?.textContent?.trim();
    if (!kode) return;

    try {
        await navigator.clipboard.writeText(kode);
        el.copyBtn.textContent = "Tersalin";
    } catch {
        // Fallback untuk browser tanpa Clipboard API / non-HTTPS
        const area = document.createElement("textarea");
        area.value = kode;
        area.setAttribute("readonly", "");
        area.style.position = "fixed";
        area.style.opacity = "0";
        document.body.appendChild(area);
        area.select();
        document.execCommand("copy");
        area.remove();
        el.copyBtn.textContent = "Tersalin";
    }

    setTimeout(() => {
        if (el.copyBtn) el.copyBtn.textContent = "Salin";
    }, 2000);
}

/* ==================================================================
   8. Inisialisasi
   ================================================================== */
mulaiHitungMundur();

if (el.year) el.year.textContent = String(new Date().getFullYear());

if (el.form) el.form.addEventListener("submit", prosesKlaim);
if (el.copyBtn) el.copyBtn.addEventListener("click", salinKode);

if (!supabaseSiap) {
    console.warn(
        "[Koteshu] assets/js/config.js belum diisi. Klaim voucher tidak akan tersimpan sampai SUPABASE_URL dan SUPABASE_ANON_KEY diisi."
    );
}
