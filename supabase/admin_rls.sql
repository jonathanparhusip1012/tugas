-- ============================================================================
-- Koteshu Indonesia — Hak akses Panel Admin
-- Jalankan setelah supabase/schema.sql, di SQL Editor Supabase.
--
-- Model keamanan:
--   anon          : hanya INSERT (klaim dari halaman promo)
--   authenticated : boleh SELECT + DELETE (panel admin, setelah login)
-- ============================================================================

-- 1. Baca data untuk user yang sudah login
grant select on public.voucher_claims to authenticated;

drop policy if exists "admin boleh membaca klaim" on public.voucher_claims;

create policy "admin boleh membaca klaim"
    on public.voucher_claims
    for select
    to authenticated
    using (true);

-- 2. Hapus data (untuk pembersihan / retensi) — opsional
grant delete on public.voucher_claims to authenticated;

drop policy if exists "admin boleh menghapus klaim" on public.voucher_claims;

create policy "admin boleh menghapus klaim"
    on public.voucher_claims
    for delete
    to authenticated
    using (true);

-- ============================================================================
-- PENTING: siapa pun yang punya akun (authenticated) bisa membaca data ini.
-- Karena itu, matikan pendaftaran publik:
--   Supabase Dashboard > Authentication > Sign In / Providers > Email
--   → nonaktifkan "Allow new users to sign up"
-- Lalu buat akun admin secara manual:
--   Authentication > Users > Add user (isi email + password, centang auto confirm)
-- ============================================================================

-- ----------------------------------------------------------------------------
-- OPSIONAL — versi lebih ketat: hanya email tertentu yang boleh membaca.
-- Ganti email di bawah, lalu jalankan blok ini (menimpa policy sebelumnya).
-- ----------------------------------------------------------------------------
-- drop policy if exists "admin boleh membaca klaim" on public.voucher_claims;

-- create policy "admin boleh membaca klaim"
--     on public.voucher_claims
--     for select
--     to authenticated
--     using ((auth.jwt() ->> 'email') = 'admin@koteshuindonesia.my.id');

-- drop policy if exists "admin boleh menghapus klaim" on public.voucher_claims;

-- create policy "admin boleh menghapus klaim"
--     on public.voucher_claims
--     for delete
--     to authenticated
--     using ((auth.jwt() ->> 'email') = 'admin@koteshuindonesia.my.id');
