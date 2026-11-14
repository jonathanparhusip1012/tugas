# Koteshu Indonesia — Website Latihan

Website profil kafe + halaman promo dengan penyimpanan data klaim (tanggal & GPS/IP)
ke **Supabase**. Tanpa framework, tanpa build step — cukup HTML, CSS, dan JavaScript.

## Struktur file

```
.
├── index.html              # Beranda kafe (hero, tentang, menu, galeri, ulasan, lokasi)
├── promo.html              # Halaman promo 50% + formulir klaim voucher
├── assets/
│   ├── css/
│   │   ├── style.css       # Design system + halaman beranda
│   │   └── promo.css       # Gaya khusus halaman promo
│   ├── js/
│   │   ├── main.js         # Navbar, animasi scroll, filter menu, jam buka hari ini
│   │   ├── promo.js        # Hitung mundur, geolokasi/IP, simpan ke Supabase
│   │   └── config.js       # URL + anon key Supabase (ISI DI SINI)
│   ├── favicon.svg
│   └── promo.png           # Poster promo
├── supabase/
│   └── schema.sql          # Tabel voucher_claims + kebijakan RLS
├── simpan_data.php         # (LAMA) penyimpanan ke file teks — tidak dipakai lagi
└── README.md
```

## 1. Jalankan secara lokal

Geolokasi browser hanya berjalan di `https://` atau `localhost`. Jadi jangan buka
file dengan klik ganda (`file://`), gunakan server lokal:

```bash
python3 -m http.server 8000
# lalu buka http://localhost:8000
```

Atau di VS Code pakai ekstensi **Live Server**.

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

- `anon key` memang untuk browser. Yang melindungi data adalah **RLS**:
  pengunjung hanya boleh `INSERT`, tidak boleh `SELECT` — jadi lokasi orang lain tidak bisa dibaca.
- **Jangan pernah** menaruh `service_role` key di file frontend. Key itu hanya untuk
  Supabase Dashboard / server.
- Membaca data klaim: lewat Table Editor, atau `service_role` key di skrip lokal/backend.
- Isi `persetujuan = true` divalidasi dua kali (di JS dan di policy RLS).
- Bila halaman dipakai publik, tambahkan pembatas klaim (mis. Cloudflare Turnstile
  atau Edge Function dengan rate limit per IP) agar tidak dibanjiri klaim palsu.
- Batasi penyimpanan: data lokasi sebaiknya dihapus berkala setelah promo selesai.

## 4. Deploy

Situs ini statis, cocok untuk GitHub Pages:

1. Push seluruh folder ke repository.
2. **Settings → Pages → Deploy from branch** (`main` / root).
3. Domain kustom diatur lewat file `CNAME` (sudah ada).
4. Setelah online (HTTPS), geolokasi browser akan berfungsi normal.

## Catatan

- `simpan_data.php` adalah versi lama yang menulis ke `log_korban.txt`. Sudah tidak
  dipakai oleh halaman mana pun dan boleh dihapus.
- Proyek ini untuk latihan. Untuk dipakai komersial, lengkapi kebijakan privasi,
  dasar pemrosesan data sesuai UU PDP, dan mekanisme penghapusan data pengunjung.
