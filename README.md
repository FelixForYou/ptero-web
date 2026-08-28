# Ptero Web

Dashboard web (bukan bot Telegram lagi) untuk kelola & bersihin server **Pterodactyl** lewat **PTLA (Application API)** + **PTLC (Client API)**. Multi-user — tiap orang daftar akun sendiri (cukup username & password) dan isi konfigurasi panel-nya masing-masing di menu Pengaturan.

## Fitur

- **Login/Register sendiri** — tanpa nomor HP/email, cuma username unik + password (ada indikator kekuatan password & tombol generate password kuat otomatis).
- Tiap user simpan **PTLA/PTLC key & URL panel sendiri** — tidak saling ketuker.
- Dashboard ringkasan: total server, suspended, online/offline, jumlah node & user panel, log aktivitas.
- Kelola server: list + cari, suspend/unsuspend, reinstall, hapus satuan, hapus banyak sekaligus (checklist), export CSV.
- **Bersihkan Semua Server** — hapus semua kecuali ID yang dilindungi.
- **Bersihkan Server Offline** — hapus HANYA server yang statusnya offline. Ini butuh **Client API key (ptlc_...)**, karena Application API (ptla_) memang tidak menyediakan status hidup/mati server secara akurat — kemungkinan besar ini penyebab fitur serupa sebelumnya "gak ke-detect". Kalau ptlc_ belum diisi, fitur ini akan kasih pesan jelas alih-alih diam-diam gagal.
- Tampilan neobrutalism (border tebal, bayangan keras, warna cerah) dengan animasi di semua tombol, dan bottom navigation ala dashboard mobile.

## Batasan yang perlu kamu tahu

- Deteksi online/offline mengandalkan endpoint `GET /api/client/servers/{id}/resources` dari Client API. Key Client API hanya bisa "melihat" server yang memang bisa diakses oleh akun pemilik key tersebut di panel Pterodactyl (server milik sendiri, atau server yang panel-nya kasih akses admin penuh ke API Client). Kalau sebuah server tidak bisa diakses lewat key itu, statusnya ditandai **"Tidak diketahui"** dan otomatis DILEWATI saat "Bersihkan Server Offline" (supaya tidak salah hapus server yang sebenarnya online).
- Aplikasi ini pakai SQLite file (`data.sqlite`) untuk simpan akun & konfigurasi — cocok dijalankan di VPS/server Node biasa (Railway, Render, VPS, dsb). **Bukan untuk Vercel serverless**, karena filesystem Vercel bersifat sementara sehingga data akun akan hilang.

## Cara Menjalankan

```bash
cd ptero-web
npm install
cp .env.example .env
# edit .env, isi JWT_SECRET dengan string acak yang panjang
npm start
```

Buka `http://localhost:3000` (atau domain kamu). Klik tab **Daftar**, buat akun, lalu buka menu **Pengaturan** untuk isi:

1. URL Panel (`https://panel-kamu.com`)
2. Application API Key (`ptla_...`) — dari Admin → Application API
3. Client API Key (`ptlc_...`, opsional tapi disarankan) — dari Account Settings → API Credentials
4. ID server yang dilindungi (default `1`)

## Struktur Project

```
ptero-web/
├── server.js              # entrypoint Express
├── db.js                  # setup SQLite + skema
├── middleware/auth.js      # JWT & hashing password
├── lib/pterodactyl.js      # wrapper PTLA + PTLC API
├── routes/
│   ├── auth.js             # register/login/logout/me
│   ├── config.js           # simpan konfigurasi panel per-user
│   └── servers.js          # list/suspend/reinstall/hapus/bersihkan
└── public/                 # frontend (HTML/CSS/JS polos, tanpa build step)
```

## Keamanan

- Password di-hash pakai bcrypt, tidak pernah disimpan plain text.
- Sesi login pakai JWT di cookie `httpOnly` (tidak bisa diakses JS di browser).
- API key panel disimpan di database lokal kamu sendiri (`data.sqlite`) — jangan upload file ini ke publik/git (sudah ada di `.gitignore`).
- Set `NODE_ENV=production` saat deploy dengan HTTPS supaya cookie dikirim secure.
