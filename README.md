# Ucapan Ulang Tahun Minimalis (static)

This is a small, minimal static website to wish a happy birthday. It uses a small synthesized backsound (generated with Web Audio API) so no copyrighted audio files are included.

Cara menjalankan (Docker Compose):

```bash
# di folder proyek (yang berisi docker-compose.yml)
docker compose up --build

# lalu buka http://localhost:8080
```

Pengaturan & catatan:
- Tekan tombol "Play Music" pada halaman untuk memulai backsound (dibutuhkan interaksi pengguna di beberapa browser).
- Jika ingin mengganti backsound dengan file MP3/OGG Anda sendiri: tambahkan file ke folder `assets/` dan modifikasi `app.js` untuk menggunakan <audio> atau AudioContext.createMediaElementSource.
 - Jika ingin mengganti backsound dengan file MP3/OGG Anda sendiri: tambahkan file ke folder `assets/` dengan nama `happy_birthday_instrumental.mp3` (atau update `index.html` src) sehingga file lengkapnya adalah `assets/happy_birthday_instrumental.mp3`. Kode sekarang akan:
	 - otomatis try-play file `assets/happy_birthday_instrumental.mp3` saat Anda menekan tombol "Play Music";
	 - jika file tidak ada atau pemutaran gagal, akan kembali menggunakan backsound sintetis yang sudah ada.
- Port yang digunakan: 8080 -> container 80. Ubah `docker-compose.yml` jika perlu.
