/**
 * Konfigurasi Supabase — Koteshu Indonesia
 * File: assets/js/config.js
 *
 * Cara mengisi:
 * 1. Buat project di https://supabase.com
 * 2. Buka Project Settings > API
 * 3. Salin "Project URL" dan "anon public key" ke bawah
 *
 * PENTING: anon key aman dipakai di browser karena hanya boleh INSERT
 * (lihat supabase/schema.sql). JANGAN pernah menaruh service_role key di file ini.
 */

export const SUPABASE_URL = "https://tytzlnobuxpfmuozistw.supabase.co";
export const SUPABASE_ANON_KEY = "sb_publishable_SYuGXAnYUZy9KD5-x60YqA_F52Cq-Ej";
export const TABEL_KLAIM = "voucher_claims";

/** true bila URL & key sudah diisi (bukan placeholder). */
export const supabaseSiap =
    !SUPABASE_URL.includes("GANTI") &&
    !SUPABASE_ANON_KEY.includes("GANTI") &&
    SUPABASE_URL.startsWith("https://");
