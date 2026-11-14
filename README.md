# Koteshu Indonesia — Website Latihan

Website profil kafe + halaman promo dengan penyimpanan data klaim (tanggal & GPS/IP)
ke **Supabase**. Tanpa framework, tanpa build step — cukup HTML, CSS, dan JavaScript.

## Struktur file

```
.
├── index.html              # Beranda kafe (hero, tentang, menu, galeri, ulasan, lokasi)
├── promo.html              # Halaman promo 50% + formulir klaim voucher
├── admin.html              # Panel admin (tidak ditautkan dari situs)
├── assets/
│   ├── css/
│   │   ├── style.css       # Design system + halaman beranda
│   │   ├── promo.css       # Gaya khusus halaman promo
│   │   └── admin.css       # Gaya panel admin
│   ├── js/
│   │   ├── main.js         # Navbar, animasi scroll, filter menu, jam buka hari ini
│   │   ├── promo.js        # Hitung mundur, geolokasi/IP, simpan ke Supabase
│   │   ├── admin.js        # Login admin, tabel data, filter, ekspor CSV, hapus baris
│   │   └── config.js       # URL + anon key Supabase (ISI DI SINI)
│   ├── favicon.svg
│   └── promo.png           # Poster promo
├── supabase/
│   ├── schema.sql          # Tabel voucher_claims + policy INSERT untuk anon
│   └── admin_rls.sql       # Policy SELECT/DELETE untuk admin yang login
├── robots.txt
├── dev.py                  # Server lokal yang meniru URL tanpa .html (GitHub Pages)
├── simpan_data.php         # (LAMA) penyimpanan ke file teks — tidak dipakai lagi
└── README.md
```

## 1. Jalankan secara lokal

Geolokasi browser hanya berjalan di `https://` atau `localhost`. Jadi jangan buka
file dengan klik ganda (`file://`), gunakan server lokal:

```bash
python3 dev.py          # default port 8000
python3 dev.py 5500     # atau port lain
```

Lalu buka:

| Halaman | URL |
| --- | --- |
| Beranda | <http://localhost:8000/> |
| Promo | <http://localhost:8000/promo> |
| Admin | <http://localhost:8000/admin> |

`dev.py` meniru perilaku GitHub Pages: `/promo` dilayani dari `promo.html`,
dan `/promo/` dialihkan ke `/promo`. Tanpa skrip ini, `python3 -m http.server`
hanya bisa membuka `/promo.html`.

## 1b. URL tanpa ekstensi

Semua tautan di situs memakai URL bersih (`/promo`, `/admin`), bukan `.html`.
Ini berjalan otomatis di **GitHub Pages**, karena `/promo` dilayani dari
`promo.html` (`.html` tetap bisa dibuka). Tag `<link rel="canonical">` dipasang
agar mesin pencari memilih satu URL.

Kalau nanti pindah hosting, tambahkan aturan berikut:

- **Cloudflare Pages / Netlify** — buat file `_redirects`:
  ```
  /promo   /promo.html   200
  /admin   /admin.html   200
  ```
- **Apache (cPanel)** — `.htaccess`:
  ```apache
  RewriteEngine On
  RewriteCond %{REQUEST_FILENAME}.html -f
  RewriteRule ^([^.]*)$ $1.html [L]
  ```
- **Nginx**:
  ```nginx
  try_files $uri $uri.html $uri/ =404;
  ```

## 2. Siapkan Supabase

1. Buat akun di <https://supabase.com> lalu **New project** (pilih region terdekat, mis. Singapore).
2. Buka **SQL Editor → New query**, tempel seluruh isi `supabase/schema.sql`, lalu **Run**.
   Perintah ini membuat tabel `voucher_claims`, indeks, dan kebijakan RLS.
3. Buka **Project Settings → API**, salin:
   - `Project URL`
   - `anon public` key
4. Isi keduanya di `assets/js/config.js`:

```js
export const SUPABASE_URL = "https://xxxxxxxxxxxx.supabase.co";
export const SUPABASE_ANON_KEY = "eyJhbGciOi...";
```

5. Muat ulang `promo.html`, isi formulir, dan klaim. Baris baru akan muncul di
   **Table Editor → voucher_claims**.

### Kolom yang disimpan

| Kolom | Isi |
| --- | --- |
| `tanggal` | Waktu klaim (`timestamptz`) |
| `gps_ip` | `"lat, lng"` bila GPS diizinkan, atau alamat IP bila ditolak |
| `metode` | `GPS`, `IP`, atau `TIDAK_TERSEDIA` |
| `latitude`, `longitude`, `akurasi` | Detail koordinat (null bila tidak ada) |
| `ip_address`, `kota`, `provider` | Hasil lookup IP (ipapi.co / ipwho.is) |
| `nama`, `whatsapp`, `kode_voucher` | Data klaim |
| `persetujuan` | `true` — bukti pengunjung mencentang izin |
| `user_agent` | Jenis browser |

Query laporan cepat:

```sql
select tanggal, metode, gps_ip, kota, kode_voucher
from public.voucher_claims
order by tanggal desc
limit 20;
```

## 3. Keamanan

- `anon key` / `publishable key` memang untuk browser. Yang melindungi data adalah **RLS**:
  pengunjung hanya boleh `INSERT`, tidak boleh `SELECT` — jadi lokasi orang lain tidak bisa dibaca.
- **Jangan pernah** menaruh `service_role` key di file frontend. Key itu hanya untuk
  Supabase Dashboard / server.
- Membaca data klaim: lewat Table Editor, atau `service_role` key di skrip lokal/backend.
- Isi `persetujuan = true` divalidasi dua kali (di JS dan di policy RLS).
- Bila halaman dipakai publik, tambahkan pembatas klaim (mis. Cloudflare Turnstile
  atau Edge Function dengan rate limit per IP) agar tidak dibanjiri klaim palsu.
- Batasi penyimpanan: data lokasi sebaiknya dihapus berkala setelah promo selesai.

## 4. Panel admin

Halaman: **`/admin.html`** — tidak ada tautan ke halaman ini dari situs publik,
tidak diindeks mesin pencari (`noindex`), dan tidak muncul di navigasi mana pun.

### Aktifkan

1. Jalankan `supabase/admin_rls.sql` di SQL Editor.
2. **Matikan pendaftaran publik**: Authentication → Sign In / Providers → Email →
   nonaktifkan *Allow new users to sign up*.
3. Buat akun admin: **Authentication → Users → Add user**, isi email + password,
   centang *Auto Confirm User*.
4. Buka `http://localhost:8000/admin.html` (atau `https://domain-anda/admin.html`)
   lalu login dengan akun tersebut.

### Fitur

- Ringkasan: total klaim, klaim hari ini, jumlah via GPS, via IP/tanpa lokasi.
- Tabel 500 data terbaru: tanggal, nama, WhatsApp, metode, koordinat/IP, kota,
  provider, kode voucher.
- Tautan "Buka peta" ke Google Maps bila koordinat tersedia.
- Pencarian (nama/WhatsApp/kode/kota/IP) dan filter metode.
- Ekspor CSV (sudah ada BOM, aman dibuka di Excel).
- Hapus satu baris untuk retensi data.

### Catatan keamanan

- Menyembunyikan halaman **bukan** pengamanan. Yang melindungi data adalah
  Supabase Auth + policy RLS `select`/`delete` untuk role `authenticated`.
- Dengan policy contoh, **semua** user yang login bisa membaca data. Untuk lebih
  ketat, pakai versi email-allowlist yang sudah disediakan (dikomentari) di
  `supabase/admin_rls.sql`, atau gunakan Supabase Auth Hooks.
- Sesi login disimpan di browser. Selalu klik **Keluar** di komputer bersama.
- Jangan menaruh tautan ke `admin.html` di halaman publik.

## 5. Deploy

Situs ini statis, cocok untuk GitHub Pages:

1. Push seluruh folder ke repository.
2. **Settings → Pages → Deploy from branch** (`main` / root).
3. Domain kustom diatur lewat file `CNAME` (sudah ada).
4. Setelah online (HTTPS), geolokasi browser akan berfungsi normal.
5. URL bersih langsung aktif: `/promo` dan `/admin` (tanpa `.html`).

## Catatan

- `simpan_data.php` adalah versi lama yang menulis ke `log_korban.txt`. Sudah tidak
  dipakai oleh halaman mana pun dan boleh dihapus.
- Library `supabase-js` dimuat dari CDN jsDelivr (versi dipin: 2.119.0), jadi halaman
  promo & admin memerlukan koneksi internet.
- Proyek ini untuk latihan. Untuk dipakai komersial, lengkapi kebijakan privasi,
  dasar pemrosesan data sesuai UU PDP, dan mekanisme penghapusan data pengunjung.
